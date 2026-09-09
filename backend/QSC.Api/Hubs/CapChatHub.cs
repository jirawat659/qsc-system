using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using QSC.Api.Data;
using QSC.Api.Helpers;
using QSC.Api.Models;
using System;
using System.IO;
using System.Security.Claims;
using System.Threading.Tasks;

namespace QSC.Api.Hubs
{
    [Authorize]
    public class CapChatHub : Hub
    {
        private readonly AppDbContext _context;
        private readonly IWebHostEnvironment _env;

        public CapChatHub(AppDbContext context, IWebHostEnvironment env)
        {
            _context = context;
            _env = env;
        }

        private static bool IsValidImageSignature(byte[] bytes)
        {
            if (bytes == null || bytes.Length < 12) return false;
            if (bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF) return true;
            if (bytes[0] == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47) return true;
            if (bytes[0] == 0x52 && bytes[1] == 0x49 && bytes[2] == 0x46 && bytes[3] == 0x46 &&
                bytes[8] == 0x57 && bytes[9] == 0x45 && bytes[10] == 0x42 && bytes[11] == 0x50) return true;
            if (bytes[0] == 0x47 && bytes[1] == 0x49 && bytes[2] == 0x46 && bytes[3] == 0x38) return true;
            return false;
        }

        private async Task<string> SaveBase64IfPresentAsync(string? input, string subfolder, string prefix)
        {
            if (string.IsNullOrWhiteSpace(input) || !input.StartsWith("data:image/")) return input ?? string.Empty;

            try
            {
                var webRoot = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
                var dir = Path.Combine(webRoot, "uploads", subfolder);
                Directory.CreateDirectory(dir);

                var base64Clean = input;
                var ext = "webp";
                if (input.Contains("data:image/png")) ext = "png";
                else if (input.Contains("data:image/jpeg") || input.Contains("data:image/jpg")) ext = "jpg";

                if (base64Clean.Contains(",")) base64Clean = base64Clean.Split(',')[1];
                var bytes = Convert.FromBase64String(base64Clean);

                if (bytes.Length > 0 && bytes.Length <= 10 * 1024 * 1024 && IsValidImageSignature(bytes))
                {
                    var fileName = $"{prefix}_{DateTime.UtcNow:yyyyMMdd_HHmmss}_{Guid.NewGuid().ToString().Substring(0, 8)}.{ext}";
                    var filePath = Path.Combine(dir, fileName);
                    await System.IO.File.WriteAllBytesAsync(filePath, bytes);
                    return $"/uploads/{subfolder}/{fileName}";
                }
            }
            catch
            {
                // Fallback
            }
            return input;
        }

        public async Task JoinCapRoom(int capTaskId)
        {
            if (capTaskId <= 0) return;

            var task = await _context.CapTasks.AsNoTracking().FirstOrDefaultAsync(t => t.Id == capTaskId);
            if (task == null) return;

            var (currentUserId, role, allowedLocationIds) = await UserScopeHelper.GetUserScopeAsync(Context.User ?? new ClaimsPrincipal(), _context);

            // If user has restricted branch scope (e.g. Auditee/Store Manager), ensure they only access their branch's CAP tasks
            if (allowedLocationIds != null && !allowedLocationIds.Contains(task.LocationId) && task.AssignedTo != currentUserId)
            {
                throw new HubException("คุณไม่มีสิทธิ์เข้าถึงห้องแชทของงาน CAP นี้");
            }

            var groupName = $"cap_{capTaskId}";
            await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
        }

        public async Task LeaveCapRoom(int capTaskId)
        {
            if (capTaskId <= 0) return;
            var groupName = $"cap_{capTaskId}";
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
        }

        public async Task SendCapMessage(int capTaskId, string message, string? imageUrl)
        {
            if (capTaskId <= 0)
            {
                throw new HubException("Invalid CAP Task ID");
            }

            if (string.IsNullOrWhiteSpace(message) && string.IsNullOrWhiteSpace(imageUrl))
            {
                throw new HubException("Message or image is required");
            }

            var task = await _context.CapTasks
                .Include(t => t.Location)
                .FirstOrDefaultAsync(t => t.Id == capTaskId);

            if (task == null)
            {
                throw new HubException("CAP Task not found");
            }

            if (string.Equals(task.Status, "CLOSED", StringComparison.OrdinalIgnoreCase))
            {
                throw new HubException("Cannot send messages to a closed CAP task");
            }

            var (currentUserId, role, allowedLocationIds) = await UserScopeHelper.GetUserScopeAsync(Context.User ?? new ClaimsPrincipal(), _context);

            if (allowedLocationIds != null && !allowedLocationIds.Contains(task.LocationId) && task.AssignedTo != currentUserId)
            {
                throw new HubException("You do not have access to this CAP task");
            }

            var user = await _context.Users
                .Include(u => u.Role)
                .FirstOrDefaultAsync(u => u.Id == currentUserId);

            string? processedImageUrl = null;
            if (!string.IsNullOrWhiteSpace(imageUrl))
            {
                processedImageUrl = await SaveBase64IfPresentAsync(imageUrl, "cap_images", "cap");
            }

            var comment = new CapTaskComment
            {
                CapTaskId = capTaskId,
                SenderId = currentUserId,
                SenderRole = role,
                Message = message ?? string.Empty,
                ImageUrl = processedImageUrl,
                CreatedAt = DateTime.UtcNow
            };

            _context.CapTaskComments.Add(comment);

            // If image attachment is present, also log in CapTaskImages for remediation records
            if (!string.IsNullOrWhiteSpace(processedImageUrl))
            {
                _context.CapTaskImages.Add(new CapTaskImage
                {
                    CapTaskId = capTaskId,
                    Phase = "AFTER",
                    ImageUrl = processedImageUrl,
                    UploadedBy = currentUserId,
                    UploadedAt = DateTime.UtcNow
                });
            }

            await _context.SaveChangesAsync();

            bool isAuditorComment = string.Equals(role, "AUDITOR", StringComparison.OrdinalIgnoreCase)
                                 || string.Equals(role, "ADMIN", StringComparison.OrdinalIgnoreCase)
                                 || string.Equals(role, "STANDARD", StringComparison.OrdinalIgnoreCase);

            var commentPayload = new
            {
                id = comment.Id,
                capTaskId = comment.CapTaskId,
                userId = currentUserId,
                userName = user?.FullName ?? user?.Username ?? "ผู้ใช้งาน",
                userRole = user?.Role?.Code ?? role,
                comment = comment.Message,
                message = comment.Message,
                imageUrl = comment.ImageUrl,
                isAuditorComment = isAuditorComment,
                createdAt = comment.CreatedAt
            };

            var groupName = $"cap_{capTaskId}";
            await Clients.Group(groupName).SendAsync("ReceiveCapMessage", commentPayload);
        }

        public async Task UpdateCapStatusRealTime(int capTaskId, string newStatus, string? note)
        {
            // Add authorization check
            var roleClaim = Context.User?.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;
            var allowedRoles = new[] { "ADMIN", "STANDARD", "AUDITOR" };
            if (string.IsNullOrEmpty(roleClaim) || !allowedRoles.Contains(roleClaim))
            {
                await Clients.Caller.SendAsync("Error", "ไม่มีสิทธิ์ในการเปลี่ยนสถานะ");
                return;
            }

            if (capTaskId <= 0) return;

            var (currentUserId, role, _) = await UserScopeHelper.GetUserScopeAsync(Context.User ?? new ClaimsPrincipal(), _context);
            var user = await _context.Users.FindAsync(currentUserId);

            var statusPayload = new
            {
                capTaskId = capTaskId,
                status = newStatus,
                note = note,
                updatedBy = user?.FullName ?? user?.Username ?? "ผู้ใช้งาน",
                updatedAt = DateTime.UtcNow
            };

            var groupName = $"cap_{capTaskId}";
            await Clients.Group(groupName).SendAsync("CapStatusUpdated", statusPayload);
        }
    }
}
