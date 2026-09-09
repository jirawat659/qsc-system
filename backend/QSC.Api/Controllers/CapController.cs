using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using QSC.Api.Data;
using QSC.Api.Hubs;
using QSC.Api.Models;
using QSC.Api.Helpers;

namespace QSC.Api.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class CapController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IWebHostEnvironment _env;
        private readonly IHubContext<CapChatHub> _hubContext;

        public CapController(AppDbContext context, IWebHostEnvironment env, IHubContext<CapChatHub> hubContext)
        {
            _context = context;
            _env = env;
            _hubContext = hubContext;
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

        [HttpGet]
        public async Task<IActionResult> GetCapTasks(
            [FromQuery] int? locationId,
            [FromQuery] int? auditRecordId,
            [FromQuery] int? assignedTo,
            [FromQuery] string? status,
            [FromQuery] int? limit)
        {
            var (currentUserId, role, allowedLocationIds) = await UserScopeHelper.GetUserScopeAsync(User, _context);
            var (_, _, allowedBrandIds) = await UserScopeHelper.GetUserBrandScopeAsync(User, _context);

            var query = _context.CapTasks
                .AsNoTracking()
                .Include(t => t.Location)
                .Include(t => t.Assignee)
                .Include(t => t.Verifier)
                .Include(t => t.AuditRecord)
                    .ThenInclude(ar => ar!.PrimaryAuditor)
                .Include(t => t.AuditResponse)
                    .ThenInclude(resp => resp!.SurveyItem)
                .Include(t => t.Images)
                .AsQueryable();

            if (role == "AUDITEE")
            {
                if (allowedLocationIds != null)
                {
                    query = query.Where(t => allowedLocationIds.Contains(t.LocationId) || t.AssignedTo == currentUserId);
                }
                else
                {
                    return Ok(new List<object>());
                }
            }
            else if (allowedLocationIds != null)
            {
                query = query.Where(t => allowedLocationIds.Contains(t.LocationId));
            }

            if (locationId.HasValue)
            {
                if (allowedLocationIds != null && !allowedLocationIds.Contains(locationId.Value))
                {
                    return Ok(new List<object>());
                }
                query = query.Where(t => t.LocationId == locationId.Value);
            }
            if (auditRecordId.HasValue) query = query.Where(t => t.AuditRecordId == auditRecordId.Value);
            if (assignedTo.HasValue) query = query.Where(t => t.AssignedTo == assignedTo.Value);
            if (!string.IsNullOrEmpty(status)) query = query.Where(t => t.Status == status);
            if (allowedBrandIds != null)
            {
                query = query.Where(t => t.Location != null && t.Location.LocationBrands.Any(lb => allowedBrandIds.Contains(lb.BrandId)));
            }

            query = query.OrderByDescending(t => t.CreatedAt);

            if (limit.HasValue)
            {
                query = query.Take(Math.Clamp(limit.Value, 1, 500));
            }
            else
            {
                // Default safety ceiling: prevent pulling excessive historical CAPs in one go
                query = query.Take(300);
            }

            var tasks = await query.ToListAsync();

            var result = tasks.Select(t => new
            {
                id = t.Id,
                auditRecordId = t.AuditRecordId,
                auditResponseId = t.AuditResponseId,
                locationId = t.LocationId,
                locationCode = t.Location?.Code,
                locationName = t.Location?.Name,
                issueItem = t.IssueItem,
                description = t.Description,
                submissionDeadline = t.SubmissionDeadline,
                status = t.Status,
                assignedTo = t.AssignedTo,
                assigneeName = t.Assignee?.FullName,
                verifiedBy = t.VerifiedBy,
                verifierName = t.Verifier?.FullName,
                auditorName = t.AuditRecord?.PrimaryAuditor?.FullName ?? t.Verifier?.FullName ?? "-",
                auditScore = t.AuditRecord?.PercentageScore,
                questionNumber = t.AuditResponse?.SurveyItem?.OrderIndex,
                afterImages = t.Images.Where(img => img.Phase == "AFTER").Select(img => new
                {
                    id = img.Id,
                    imageUrl = img.ImageUrl,
                    uploadedAt = img.UploadedAt
                }).ToList(),
                completedAt = t.CompletedAt,
                closedAt = t.ClosedAt,
                createdAt = t.CreatedAt
            });

            return Ok(result);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetCapTaskDetail(int id)
        {
            var (currentUserId, role, allowedLocationIds) = await UserScopeHelper.GetUserScopeAsync(User, _context);
            var (_, _, allowedBrandIds) = await UserScopeHelper.GetUserBrandScopeAsync(User, _context);

            var task = await _context.CapTasks
                .AsNoTracking()
                .Include(t => t.Location)
                .Include(t => t.Assignee)
                .Include(t => t.Verifier)
                .Include(t => t.AuditRecord)
                    .ThenInclude(ar => ar!.PrimaryAuditor)
                .Include(t => t.AuditResponse)
                    .ThenInclude(resp => resp!.SurveyItem)
                .Include(t => t.Images)
                    .ThenInclude(img => img.Uploader)
                        .ThenInclude(u => u!.Role)
                .Include(t => t.Comments)
                    .ThenInclude(c => c.Sender)
                        .ThenInclude(u => u!.Role)
                .FirstOrDefaultAsync(t => t.Id == id);

            if (task == null) return NotFound();

            if (allowedLocationIds != null && !allowedLocationIds.Contains(task.LocationId) && task.AssignedTo != currentUserId)
            {
                return Forbid();
            }

            if (allowedBrandIds != null)
            {
                bool brandOk = await _context.LocationBrands.AnyAsync(lb => lb.LocationId == task.LocationId && allowedBrandIds.Contains(lb.BrandId));
                if (!brandOk && task.AssignedTo != currentUserId)
                {
                    return Forbid();
                }
            }

            // Fetch BEFORE images directly from AuditResponseImage
            var beforeImages = new List<string>();
            if (task.AuditResponseId.HasValue)
            {
                beforeImages = await _context.AuditResponseImages
                    .AsNoTracking()
                    .Where(img => img.AuditResponseId == task.AuditResponseId.Value)
                    .Select(img => img.ImageUrl)
                    .ToListAsync();
            }

            return Ok(new
            {
                id = task.Id,
                auditRecordId = task.AuditRecordId,
                auditResponseId = task.AuditResponseId,
                locationId = task.LocationId,
                locationCode = task.Location?.Code,
                locationName = task.Location?.Name,
                issueItem = task.IssueItem,
                description = task.Description,
                submissionDeadline = task.SubmissionDeadline,
                status = task.Status,
                assignedTo = task.AssignedTo,
                assigneeName = task.Assignee?.FullName,
                verifiedBy = task.VerifiedBy,
                verifierName = task.Verifier?.FullName,
                auditorName = task.AuditRecord?.PrimaryAuditor?.FullName ?? task.Verifier?.FullName ?? "-",
                auditScore = task.AuditRecord?.PercentageScore,
                questionNumber = task.AuditResponse?.SurveyItem?.OrderIndex,
                questionText = task.AuditResponse?.SurveyItem?.QuestionText ?? task.IssueItem,
                categoryName = task.AuditResponse?.SurveyItem?.CategoryName ?? task.AuditResponse?.CategoryName,
                scoreGiven = task.AuditResponse?.ScoreGiven,
                fullScore = task.AuditResponse?.SurveyItem?.FullScore ?? 10.0,
                completedAt = task.CompletedAt,
                closedAt = task.ClosedAt,
                createdAt = task.CreatedAt,
                beforeImages = beforeImages,
                afterImages = task.Images.Select(img => new
                {
                    id = img.Id,
                    imageUrl = img.ImageUrl,
                    uploadedBy = img.UploadedBy,
                    uploaderName = img.Uploader?.FullName ?? "ผู้ใช้งาน",
                    uploaderRole = img.Uploader?.Role?.Code ?? "STANDARD",
                    uploadedAt = img.UploadedAt
                }).ToList(),
                comments = task.Comments.OrderBy(c => c.CreatedAt).Select(c => new
                {
                    id = c.Id,
                    senderId = c.SenderId,
                    senderName = c.Sender?.FullName ?? "ผู้ใช้งาน",
                    senderRole = c.Sender?.Role?.Code ?? c.SenderRole,
                    message = c.Message,
                    imageUrl = c.ImageUrl,
                    createdAt = c.CreatedAt
                }).ToList(),
                nextAuditNote = task.NextAuditNote,
                followUpStatus = task.FollowUpStatus
            });
        }

        public class CreateManualCapDto
        {
            public int LocationId { get; set; }
            public int? AuditRecordId { get; set; }
            public string IssueItem { get; set; } = string.Empty;
            public string Description { get; set; } = string.Empty;
            public DateTime? SubmissionDeadline { get; set; }
            public int? AssignedTo { get; set; }
        }

        [Authorize(Roles = "ADMIN,STANDARD,AUDITOR")]
        [HttpPost]
        public async Task<IActionResult> CreateManualCap([FromBody] CreateManualCapDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.IssueItem))
                return BadRequest(new { message = "กรุณาระบุรายการปัญหา" });
            if (string.IsNullOrWhiteSpace(dto.Description))
                return BadRequest(new { message = "กรุณาระบุรายละเอียดปัญหา" });

            var (currentUserId, role, allowedLocationIds) = await UserScopeHelper.GetUserScopeAsync(User, _context);
            var (_, _, allowedBrandIds) = await UserScopeHelper.GetUserBrandScopeAsync(User, _context);

            if (allowedLocationIds != null && !allowedLocationIds.Contains(dto.LocationId))
            {
                return Forbid();
            }

            if (allowedBrandIds != null)
            {
                bool brandOk = await _context.LocationBrands.AnyAsync(lb => lb.LocationId == dto.LocationId && allowedBrandIds.Contains(lb.BrandId));
                if (!brandOk)
                {
                    return Forbid();
                }
            }

            var task = new CapTask
            {
                LocationId = dto.LocationId,
                AuditRecordId = dto.AuditRecordId,
                AuditResponseId = null, // Manual
                IssueItem = dto.IssueItem,
                Description = dto.Description,
                SubmissionDeadline = dto.SubmissionDeadline ?? DateTime.UtcNow.AddDays(7),
                Status = "OPEN",
                AssignedTo = dto.AssignedTo,
                CreatedAt = DateTime.UtcNow
            };

            _context.CapTasks.Add(task);
            await _context.SaveChangesAsync();

            return Ok(task);
        }

        public class SubmitRemediationDto
        {
            public string Message { get; set; } = string.Empty;
            public List<string> ImageUrls { get; set; } = new();
        }

        [HttpPost("{id}/submit")]
        public async Task<IActionResult> SubmitRemediation(int id, [FromBody] SubmitRemediationDto dto)
        {
            var (currentUserId, role, allowedLocationIds) = await UserScopeHelper.GetUserScopeAsync(User, _context);
            var (_, _, allowedBrandIds) = await UserScopeHelper.GetUserBrandScopeAsync(User, _context);

            var task = await _context.CapTasks.FindAsync(id);
            if (task == null) return NotFound();

            if (allowedLocationIds != null && !allowedLocationIds.Contains(task.LocationId) && task.AssignedTo != currentUserId)
            {
                return Forbid();
            }

            if (allowedBrandIds != null)
            {
                bool brandOk = await _context.LocationBrands.AnyAsync(lb => lb.LocationId == task.LocationId && allowedBrandIds.Contains(lb.BrandId));
                if (!brandOk && task.AssignedTo != currentUserId)
                {
                    return Forbid();
                }
            }

            if (string.Equals(task.Status, "CLOSED", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new { message = "งานแก้ไขนี้ถูกปิดแล้ว ไม่สามารถส่งข้อมูลเพิ่มเติมได้ (Cannot submit remediation to a closed CAP task)" });
            }

            task.Status = "SUBMITTED";
            task.CompletedAt = DateTime.UtcNow;

            var user = await _context.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.Id == currentUserId);
            var now = DateTime.UtcNow;

            string? firstSavedImageUrl = null;

            // Save AFTER images
            if (dto.ImageUrls != null && dto.ImageUrls.Any())
            {
                foreach (var url in dto.ImageUrls)
                {
                    var savedUrl = await SaveBase64IfPresentAsync(url, "cap_images", "cap");
                    if (firstSavedImageUrl == null && !string.IsNullOrWhiteSpace(savedUrl))
                    {
                        firstSavedImageUrl = savedUrl;
                    }

                    _context.CapTaskImages.Add(new CapTaskImage
                    {
                        CapTaskId = id,
                        Phase = "AFTER",
                        ImageUrl = savedUrl,
                        UploadedBy = currentUserId,
                        UploadedAt = now
                    });
                }
            }

            // Add Chat Comment (with or without image attachment)
            if (!string.IsNullOrWhiteSpace(dto.Message) || !string.IsNullOrWhiteSpace(firstSavedImageUrl))
            {
                var comment = new CapTaskComment
                {
                    CapTaskId = id,
                    SenderId = currentUserId,
                    SenderRole = role,
                    Message = dto.Message ?? string.Empty,
                    ImageUrl = firstSavedImageUrl,
                    CreatedAt = now
                };
                _context.CapTaskComments.Add(comment);
                await _context.SaveChangesAsync();

                // Broadcast via SignalR
                var commentPayload = new
                {
                    id = comment.Id,
                    capTaskId = id,
                    userId = currentUserId,
                    userName = user?.FullName ?? user?.Username ?? "ผู้ใช้งาน",
                    userRole = user?.Role?.Code ?? role,
                    comment = comment.Message,
                    message = comment.Message,
                    imageUrl = comment.ImageUrl,
                    isAuditorComment = false,
                    createdAt = comment.CreatedAt
                };
                await _hubContext.Clients.Group($"cap_{id}").SendAsync("ReceiveCapMessage", commentPayload);
            }
            else
            {
                await _context.SaveChangesAsync();
            }

            // Broadcast real-time status update
            await _hubContext.Clients.Group($"cap_{id}").SendAsync("CapStatusUpdated", new
            {
                capTaskId = id,
                status = task.Status,
                updatedBy = user?.FullName ?? user?.Username ?? "ผู้ใช้งาน",
                updatedAt = task.CompletedAt
            });

            return Ok(new { message = "ส่งมอบงานแก้ไขเรียบร้อยแล้ว", status = task.Status });
        }

        public class CloseCapDto
        {
            public string? Note { get; set; }
        }

        [Authorize(Roles = "ADMIN,STANDARD,AUDITOR")]
        [HttpPost("{id}/close")]
        public async Task<IActionResult> CloseCap(int id, [FromBody] CloseCapDto dto)
        {
            var (currentUserId, role, allowedLocationIds) = await UserScopeHelper.GetUserScopeAsync(User, _context);
            var (_, _, allowedBrandIds) = await UserScopeHelper.GetUserBrandScopeAsync(User, _context);

            var task = await _context.CapTasks.FindAsync(id);
            if (task == null) return NotFound();

            if (allowedLocationIds != null && !allowedLocationIds.Contains(task.LocationId))
            {
                return Forbid();
            }

            if (allowedBrandIds != null)
            {
                bool brandOk = await _context.LocationBrands.AnyAsync(lb => lb.LocationId == task.LocationId && allowedBrandIds.Contains(lb.BrandId));
                if (!brandOk)
                {
                    return Forbid();
                }
            }

            var user = await _context.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.Id == currentUserId);
            var now = DateTime.UtcNow;

            if (task.Status != "CLOSED")
            {
                task.Status = "CLOSED";
                task.VerifiedBy = currentUserId;
                task.ClosedAt = now;
            }

            if (!string.IsNullOrWhiteSpace(dto.Note))
            {
                var comment = new CapTaskComment
                {
                    CapTaskId = id,
                    SenderId = currentUserId,
                    SenderRole = role,
                    Message = $"[อนุมัติปิดงาน] {dto.Note}",
                    CreatedAt = now
                };
                _context.CapTaskComments.Add(comment);

                var commentPayload = new
                {
                    id = comment.Id,
                    capTaskId = id,
                    userId = currentUserId,
                    userName = user?.FullName ?? user?.Username ?? "ผู้ใช้งาน",
                    userRole = user?.Role?.Code ?? role,
                    comment = comment.Message,
                    message = comment.Message,
                    imageUrl = (string?)null,
                    isAuditorComment = true,
                    createdAt = comment.CreatedAt
                };
                await _hubContext.Clients.Group($"cap_{id}").SendAsync("ReceiveCapMessage", commentPayload);
            }

            await _context.SaveChangesAsync();

            // Broadcast real-time CLOSED status update
            await _hubContext.Clients.Group($"cap_{id}").SendAsync("CapStatusUpdated", new
            {
                capTaskId = id,
                status = "CLOSED",
                note = dto.Note,
                updatedBy = user?.FullName ?? user?.Username ?? "ผู้ตรวจประเมิน",
                updatedAt = task.ClosedAt ?? now
            });

            return Ok(new { message = "อนุมัติและปิดงานแก้ไขสมบูรณ์แล้ว", status = task.Status });
        }

        public class RejectCapDto
        {
            public string Reason { get; set; } = string.Empty;
        }

        [Authorize(Roles = "ADMIN,STANDARD,AUDITOR")]
        [HttpPost("{id}/reject")]
        public async Task<IActionResult> RejectCap(int id, [FromBody] RejectCapDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Reason))
                return BadRequest(new { message = "กรุณาระบุเหตุผลในการปฏิเสธ" });

            var (currentUserId, role, allowedLocationIds) = await UserScopeHelper.GetUserScopeAsync(User, _context);
            var (_, _, allowedBrandIds) = await UserScopeHelper.GetUserBrandScopeAsync(User, _context);

            var task = await _context.CapTasks.FindAsync(id);
            if (task == null) return NotFound();

            if (allowedLocationIds != null && !allowedLocationIds.Contains(task.LocationId))
            {
                return Forbid();
            }

            if (allowedBrandIds != null)
            {
                bool brandOk = await _context.LocationBrands.AnyAsync(lb => lb.LocationId == task.LocationId && allowedBrandIds.Contains(lb.BrandId));
                if (!brandOk)
                {
                    return Forbid();
                }
            }

            if (string.Equals(task.Status, "CLOSED", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new { message = "Cannot reject a closed CAP task" });
            }

            task.Status = "REJECTED";
            var now = DateTime.UtcNow;
            var user = await _context.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.Id == currentUserId);

            var comment = new CapTaskComment
            {
                CapTaskId = id,
                SenderId = currentUserId,
                SenderRole = role,
                Message = $"[ตีกลับให้แก้ไขใหม่] {dto.Reason}",
                CreatedAt = now
            };
            _context.CapTaskComments.Add(comment);

            await _context.SaveChangesAsync();

            var commentPayload = new
            {
                id = comment.Id,
                capTaskId = id,
                userId = currentUserId,
                userName = user?.FullName ?? user?.Username ?? "ผู้ตรวจประเมิน",
                userRole = user?.Role?.Code ?? role,
                comment = comment.Message,
                message = comment.Message,
                imageUrl = (string?)null,
                isAuditorComment = true,
                createdAt = comment.CreatedAt
            };
            await _hubContext.Clients.Group($"cap_{id}").SendAsync("ReceiveCapMessage", commentPayload);

            await _hubContext.Clients.Group($"cap_{id}").SendAsync("CapStatusUpdated", new
            {
                capTaskId = id,
                status = "REJECTED",
                note = dto.Reason,
                updatedBy = user?.FullName ?? user?.Username ?? "ผู้ตรวจประเมิน",
                updatedAt = now
            });

            return Ok(new { message = "ส่งข้อความตีกลับให้สาขาแก้ไขใหม่แล้ว", status = task.Status });
        }

        public class UpdateStatusDto
        {
            public string Status { get; set; } = string.Empty;
            public string? Note { get; set; }
        }

        [Authorize(Roles = "ADMIN,STANDARD,AUDITOR")]
        [HttpPut("{id}/status")]
        public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdateStatusDto dto)
        {
            var allowedStatuses = new[] { "OPEN", "SUBMITTED", "REJECTED", "CLOSED" };
            if (!allowedStatuses.Contains(dto.Status?.ToUpper()))
                return BadRequest(new { message = "สถานะไม่ถูกต้อง" });

            var (currentUserId, role, allowedLocationIds) = await UserScopeHelper.GetUserScopeAsync(User, _context);
            var (_, _, allowedBrandIds) = await UserScopeHelper.GetUserBrandScopeAsync(User, _context);

            var task = await _context.CapTasks.FindAsync(id);
            if (task == null) return NotFound();

            if (allowedLocationIds != null && !allowedLocationIds.Contains(task.LocationId))
            {
                return Forbid();
            }

            if (allowedBrandIds != null)
            {
                bool brandOk = await _context.LocationBrands.AnyAsync(lb => lb.LocationId == task.LocationId && allowedBrandIds.Contains(lb.BrandId));
                if (!brandOk)
                {
                    return Forbid();
                }
            }

            var now = DateTime.UtcNow;
            var user = await _context.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.Id == currentUserId);

            var newStatus = dto.Status.ToUpper();
            task.Status = newStatus;
            if (newStatus == "CLOSED" && !task.ClosedAt.HasValue)
            {
                task.ClosedAt = now;
            }

            if (!string.IsNullOrWhiteSpace(dto.Note))
            {
                var comment = new CapTaskComment
                {
                    CapTaskId = id,
                    SenderId = currentUserId,
                    SenderRole = role,
                    Message = $"[{dto.Status}] {dto.Note}",
                    CreatedAt = now
                };
                _context.CapTaskComments.Add(comment);

                var commentPayload = new
                {
                    id = comment.Id,
                    capTaskId = id,
                    userId = currentUserId,
                    userName = user?.FullName ?? user?.Username ?? "ผู้ใช้งาน",
                    userRole = user?.Role?.Code ?? role,
                    comment = comment.Message,
                    message = comment.Message,
                    imageUrl = (string?)null,
                    isAuditorComment = true,
                    createdAt = comment.CreatedAt
                };
                await _hubContext.Clients.Group($"cap_{id}").SendAsync("ReceiveCapMessage", commentPayload);
            }

            await _context.SaveChangesAsync();

            await _hubContext.Clients.Group($"cap_{id}").SendAsync("CapStatusUpdated", new
            {
                capTaskId = id,
                status = task.Status,
                note = dto.Note,
                updatedBy = user?.FullName ?? user?.Username ?? "ผู้ใช้งาน",
                updatedAt = now
            });

            return Ok(new { message = $"ปรับปรุงสถานะเป็น {task.Status} สำเร็จ", status = task.Status });
        }

        public class PostCommentDto
        {
            public string Message { get; set; } = string.Empty;
        }

        [HttpPost("{id}/comments")]
        public async Task<IActionResult> PostComment(int id, [FromBody] PostCommentDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Message))
                return BadRequest(new { message = "กรุณาระบุข้อความ" });

            var (currentUserId, role, allowedLocationIds) = await UserScopeHelper.GetUserScopeAsync(User, _context);
            var (_, _, allowedBrandIds) = await UserScopeHelper.GetUserBrandScopeAsync(User, _context);

            var task = await _context.CapTasks.FindAsync(id);
            if (task == null) return NotFound();

            if (allowedLocationIds != null && !allowedLocationIds.Contains(task.LocationId) && task.AssignedTo != currentUserId)
            {
                return Forbid();
            }

            if (allowedBrandIds != null)
            {
                bool brandOk = await _context.LocationBrands.AnyAsync(lb => lb.LocationId == task.LocationId && allowedBrandIds.Contains(lb.BrandId));
                if (!brandOk && task.AssignedTo != currentUserId)
                {
                    return Forbid();
                }
            }

            if (string.Equals(task.Status, "CLOSED", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new { message = "Cannot add comments to a closed CAP task" });
            }

            var now = DateTime.UtcNow;
            var user = await _context.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.Id == currentUserId);

            var comment = new CapTaskComment
            {
                CapTaskId = id,
                SenderId = currentUserId,
                SenderRole = role,
                Message = dto.Message ?? string.Empty,
                CreatedAt = now
            };

            _context.CapTaskComments.Add(comment);
            await _context.SaveChangesAsync();

            bool isAuditorComment = string.Equals(role, "AUDITOR", StringComparison.OrdinalIgnoreCase)
                                 || string.Equals(role, "ADMIN", StringComparison.OrdinalIgnoreCase)
                                 || string.Equals(role, "STANDARD", StringComparison.OrdinalIgnoreCase);

            var commentPayload = new
            {
                id = comment.Id,
                capTaskId = id,
                userId = currentUserId,
                userName = user?.FullName ?? user?.Username ?? "ผู้ใช้งาน",
                userRole = user?.Role?.Code ?? role,
                comment = comment.Message,
                message = comment.Message,
                imageUrl = (string?)null,
                isAuditorComment = isAuditorComment,
                createdAt = comment.CreatedAt
            };
            await _hubContext.Clients.Group($"cap_{id}").SendAsync("ReceiveCapMessage", commentPayload);

            return Ok(comment);
        }

        [HttpPost("upload-image")]
        public async Task<IActionResult> UploadCapImage([FromBody] AuditController.Base64UploadDto dto)
        {
            if (string.IsNullOrEmpty(dto.Base64Data)) return BadRequest("No image data");

            var webRoot = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
            var dir = Path.Combine(webRoot, "uploads", "cap_images");
            Directory.CreateDirectory(dir);

            var fileName = $"cap_{DateTime.UtcNow:yyyyMMdd_HHmmss}_{Guid.NewGuid().ToString().Substring(0, 8)}.webp";
            var filePath = Path.Combine(dir, fileName);

            var base64Clean = dto.Base64Data;
            if (base64Clean.Contains(",")) base64Clean = base64Clean.Split(',')[1];
            var bytes = Convert.FromBase64String(base64Clean);

            if (bytes.Length > 10 * 1024 * 1024)
            {
                return BadRequest(new { message = "ขนาดไฟล์รูปภาพเกินกำหนด (ไม่เกิน 10MB)" });
            }

            if (!IsValidImageSignature(bytes))
            {
                return BadRequest(new { message = "รูปแบบไฟล์รูปภาพไม่ถูกต้อง (รองรับเฉพาะ JPEG, PNG, WEBP, GIF)" });
            }

            await System.IO.File.WriteAllBytesAsync(filePath, bytes);

            var relativeUrl = $"/uploads/cap_images/{fileName}";
            return Ok(new { url = relativeUrl });
        }

        public class SaveNextAuditNoteDto
        {
            public string? Note { get; set; }
        }

        [Authorize(Roles = "ADMIN,STANDARD,AUDITOR")]
        [HttpPost("{id}/next-audit-note")]
        public async Task<IActionResult> SaveNextAuditNote(int id, [FromBody] SaveNextAuditNoteDto dto)
        {
            var task = await _context.CapTasks.FindAsync(id);
            if (task == null) return NotFound(new { message = "ไม่พบงาน CAP ที่ระบุ" });

            if (string.IsNullOrWhiteSpace(dto.Note))
            {
                task.NextAuditNote = null;
                task.FollowUpStatus = "NONE";
            }
            else
            {
                task.NextAuditNote = dto.Note.Trim();
                task.FollowUpStatus = "PENDING";
            }

            await _context.SaveChangesAsync();
            return Ok(new
            {
                message = "บันทึกคำแนะนำสำหรับรอบตรวจถัดไปเรียบร้อยแล้ว",
                nextAuditNote = task.NextAuditNote,
                followUpStatus = task.FollowUpStatus
            });
        }

        [HttpGet("pending-recommendations")]
        public async Task<IActionResult> GetPendingRecommendations([FromQuery] int locationId)
        {
            var recommendations = await _context.CapTasks
                .AsNoTracking()
                .Where(c => c.LocationId == locationId && c.FollowUpStatus == "PENDING" && !string.IsNullOrWhiteSpace(c.NextAuditNote))
                .OrderByDescending(c => c.CreatedAt)
                .Select(c => new
                {
                    id = c.Id,
                    issueItem = c.IssueItem,
                    description = c.Description,
                    nextAuditNote = c.NextAuditNote,
                    createdAt = c.CreatedAt
                })
                .ToListAsync();

            return Ok(recommendations);
        }
    }
}