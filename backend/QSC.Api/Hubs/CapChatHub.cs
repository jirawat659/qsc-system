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
            return UploadHelper.IsValidImageSignature(bytes, out _);
        }

        private Task<string> SaveBase64IfPresentAsync(string? input, string subfolder, string prefix, long maxSizeBytes = 10 * 1024 * 1024)
        {
            return UploadHelper.SaveBase64IfPresentAsync(_env, input, subfolder, prefix, maxSizeBytes);
        }

        public override async Task OnConnectedAsync()
        {
            try
            {
                var (currentUserId, role, allowedLocationIds) = await UserScopeHelper.GetUserScopeAsync(Context.User ?? new ClaimsPrincipal(), _context);
                var (_, _, allowedBrandIds) = await UserScopeHelper.GetUserBrandScopeAsync(Context.User ?? new ClaimsPrincipal(), _context);

                if (allowedLocationIds == null && allowedBrandIds == null)
                {
                    await Groups.AddToGroupAsync(Context.ConnectionId, "audit_all");
                }
                else
                {
                    var q = _context.Locations.AsNoTracking().Where(l => l.IsActive);
                    if (allowedLocationIds != null) q = q.Where(l => allowedLocationIds.Contains(l.Id));
                    if (allowedBrandIds != null) q = q.Where(l => l.LocationBrands.Any(lb => allowedBrandIds.Contains(lb.BrandId)));

                    var locIds = await q.Select(l => l.Id).ToListAsync();
                    foreach (var id in locIds)
                    {
                        await Groups.AddToGroupAsync(Context.ConnectionId, $"loc_{id}");
                    }
                }
            }
            catch
            {
                // Fallback gracefully
            }
            await base.OnConnectedAsync();
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
                try
                {
                    processedImageUrl = await SaveBase64IfPresentAsync(imageUrl, "cap_images", "cap", 10 * 1024 * 1024);
                }
                catch (InvalidImageUploadException ex)
                {
                    throw new HubException(ex.Message);
                }
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

        public async Task JoinAuditRoom(string roomKey)
        {
            if (string.IsNullOrWhiteSpace(roomKey)) return;
            await Groups.AddToGroupAsync(Context.ConnectionId, roomKey);
        }

        public async Task LeaveAuditRoom(string roomKey)
        {
            if (string.IsNullOrWhiteSpace(roomKey)) return;
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, roomKey);
        }
    }
}
