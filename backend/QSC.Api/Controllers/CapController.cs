using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QSC.Api.Data;
using QSC.Api.Models;

namespace QSC.Api.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class CapController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IWebHostEnvironment _env;

        public CapController(AppDbContext context, IWebHostEnvironment env)
        {
            _context = context;
            _env = env;
        }

        [HttpGet]
        public async Task<IActionResult> GetCapTasks([FromQuery] int? locationId, [FromQuery] int? assignedTo, [FromQuery] string? status)
        {
            var query = _context.CapTasks
                .Include(t => t.Location)
                .Include(t => t.Assignee)
                .Include(t => t.Verifier)
                .Include(t => t.AuditRecord)
                .AsQueryable();

            if (locationId.HasValue) query = query.Where(t => t.LocationId == locationId.Value);
            if (assignedTo.HasValue) query = query.Where(t => t.AssignedTo == assignedTo.Value);
            if (!string.IsNullOrEmpty(status)) query = query.Where(t => t.Status == status);

            var tasks = await query.OrderByDescending(t => t.CreatedAt).ToListAsync();

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
                completedAt = t.CompletedAt,
                closedAt = t.ClosedAt,
                createdAt = t.CreatedAt
            });

            return Ok(result);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetCapTaskDetail(int id)
        {
            var task = await _context.CapTasks
                .Include(t => t.Location)
                .Include(t => t.Assignee)
                .Include(t => t.Verifier)
                .Include(t => t.Images)
                .Include(t => t.Comments)
                    .ThenInclude(c => c.Sender)
                .FirstOrDefaultAsync(t => t.Id == id);

            if (task == null) return NotFound();

            // Fetch BEFORE images directly from AuditResponseImage
            var beforeImages = new List<string>();
            if (task.AuditResponseId.HasValue)
            {
                beforeImages = await _context.AuditResponseImages
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
                completedAt = task.CompletedAt,
                closedAt = task.ClosedAt,
                createdAt = task.CreatedAt,
                beforeImages = beforeImages,
                afterImages = task.Images.Select(img => new
                {
                    id = img.Id,
                    imageUrl = img.ImageUrl,
                    uploadedBy = img.UploadedBy,
                    uploadedAt = img.UploadedAt
                }).ToList(),
                comments = task.Comments.OrderBy(c => c.CreatedAt).Select(c => new
                {
                    id = c.Id,
                    senderId = c.SenderId,
                    senderName = c.Sender?.FullName,
                    senderRole = c.SenderRole,
                    message = c.Message,
                    createdAt = c.CreatedAt
                }).ToList()
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
            var task = new CapTask
            {
                LocationId = dto.LocationId,
                AuditRecordId = dto.AuditRecordId ?? 0,
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
            public int UserId { get; set; }
            public string Message { get; set; } = string.Empty;
            public List<string> ImageUrls { get; set; } = new();
        }

        [HttpPost("{id}/submit")]
        public async Task<IActionResult> SubmitRemediation(int id, [FromBody] SubmitRemediationDto dto)
        {
            var task = await _context.CapTasks.FindAsync(id);
            if (task == null) return NotFound();

            task.Status = "SUBMITTED";
            task.CompletedAt = DateTime.UtcNow;

            // Add Chat Comment
            if (!string.IsNullOrWhiteSpace(dto.Message))
            {
                _context.CapTaskComments.Add(new CapTaskComment
                {
                    CapTaskId = id,
                    SenderId = dto.UserId,
                    SenderRole = "AUDITEE",
                    Message = dto.Message,
                    CreatedAt = DateTime.UtcNow
                });
            }

            // Save AFTER images
            if (dto.ImageUrls.Any())
            {
                foreach (var url in dto.ImageUrls)
                {
                    _context.CapTaskImages.Add(new CapTaskImage
                    {
                        CapTaskId = id,
                        Phase = "AFTER",
                        ImageUrl = url,
                        UploadedBy = dto.UserId,
                        UploadedAt = DateTime.UtcNow
                    });
                }
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = "ส่งมอบงานแก้ไขเรียบร้อยแล้ว", status = task.Status });
        }

        public class CloseCapDto
        {
            public int VerifierUserId { get; set; }
            public string? Note { get; set; }
        }

        [Authorize(Roles = "ADMIN,STANDARD,AUDITOR")]
        [HttpPost("{id}/close")]
        public async Task<IActionResult> CloseCap(int id, [FromBody] CloseCapDto dto)
        {
            var task = await _context.CapTasks.FindAsync(id);
            if (task == null) return NotFound();

            task.Status = "CLOSED";
            task.VerifiedBy = dto.VerifierUserId;
            task.ClosedAt = DateTime.UtcNow;

            if (!string.IsNullOrWhiteSpace(dto.Note))
            {
                _context.CapTaskComments.Add(new CapTaskComment
                {
                    CapTaskId = id,
                    SenderId = dto.VerifierUserId,
                    SenderRole = "QA",
                    Message = $"[อนุมัติปิดงาน] {dto.Note}",
                    CreatedAt = DateTime.UtcNow
                });
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = "อนุมัติและปิดงานแก้ไขสมบูรณ์แล้ว", status = task.Status });
        }

        public class RejectCapDto
        {
            public int VerifierUserId { get; set; }
            public string Reason { get; set; } = string.Empty;
        }

        [Authorize(Roles = "ADMIN,STANDARD,AUDITOR")]
        [HttpPost("{id}/reject")]
        public async Task<IActionResult> RejectCap(int id, [FromBody] RejectCapDto dto)
        {
            var task = await _context.CapTasks.FindAsync(id);
            if (task == null) return NotFound();

            task.Status = "REJECTED";

            _context.CapTaskComments.Add(new CapTaskComment
            {
                CapTaskId = id,
                SenderId = dto.VerifierUserId,
                SenderRole = "QA",
                Message = $"[ตีกลับให้แก้ไขใหม่] {dto.Reason}",
                CreatedAt = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();
            return Ok(new { message = "ส่งข้อความตีกลับให้สาขาแก้ไขใหม่แล้ว", status = task.Status });
        }

        public class PostCommentDto
        {
            public int SenderId { get; set; }
            public string SenderRole { get; set; } = "AUDITEE";
            public string Message { get; set; } = string.Empty;
        }

        [HttpPost("{id}/comments")]
        public async Task<IActionResult> PostComment(int id, [FromBody] PostCommentDto dto)
        {
            var comment = new CapTaskComment
            {
                CapTaskId = id,
                SenderId = dto.SenderId,
                SenderRole = dto.SenderRole,
                Message = dto.Message,
                CreatedAt = DateTime.UtcNow
            };

            _context.CapTaskComments.Add(comment);
            await _context.SaveChangesAsync();

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
            await System.IO.File.WriteAllBytesAsync(filePath, bytes);

            var relativeUrl = $"/uploads/cap_images/{fileName}";
            return Ok(new { url = relativeUrl });
        }
    }
}
