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
    public class AuditController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IWebHostEnvironment _env;

        public AuditController(AppDbContext context, IWebHostEnvironment env)
        {
            _context = context;
            _env = env;
        }

        // ==========================================
        // 1. LIVE AUDIT DRAFTS & AUTO-SYNC
        // ==========================================
        [HttpGet("draft")]
        public async Task<IActionResult> GetDraft([FromQuery] int? locationId, [FromQuery] int? surveyFormId, [FromQuery] int? auditorId)
        {
            var query = _context.AuditDrafts
                .Include(d => d.Location)
                .Include(d => d.SurveyForm)
                .AsQueryable();

            if (locationId.HasValue && locationId.Value > 0)
                query = query.Where(d => d.LocationId == locationId.Value);

            if (surveyFormId.HasValue && surveyFormId.Value > 0)
                query = query.Where(d => d.SurveyFormId == surveyFormId.Value);

            if (auditorId.HasValue && auditorId.Value > 0)
                query = query.Where(d => d.AuditorId == auditorId.Value);

            var draft = await query.OrderByDescending(d => d.UpdatedAt).FirstOrDefaultAsync();

            return Ok(draft);
        }

        [HttpGet("drafts")]
        public async Task<IActionResult> GetAuditorDrafts([FromQuery] int auditorId)
        {
            var drafts = await _context.AuditDrafts
                .Include(d => d.Location)
                .Include(d => d.SurveyForm)
                .Where(d => d.AuditorId == auditorId)
                .OrderByDescending(d => d.UpdatedAt)
                .ToListAsync();

            return Ok(drafts);
        }

        public class DraftSaveDto
        {
            public int LocationId { get; set; }
            public int SurveyFormId { get; set; }
            public int AuditorId { get; set; }
            public string DraftPayloadJson { get; set; } = string.Empty;
            public int CurrentSectionIdx { get; set; } = 0;
            public int TotalAnswered { get; set; } = 0;
            public int TotalQuestions { get; set; } = 0;
            public double? StartLatitude { get; set; }
            public double? StartLongitude { get; set; }
            public DateTime? StartedAt { get; set; }
        }

        [Authorize(Roles = "ADMIN,AUDITOR,STANDARD")]
        [HttpPut("draft")]
        public async Task<IActionResult> SaveDraft([FromBody] DraftSaveDto dto)
        {
            var draft = await _context.AuditDrafts
                .FirstOrDefaultAsync(d => d.LocationId == dto.LocationId && d.SurveyFormId == dto.SurveyFormId && d.AuditorId == dto.AuditorId);

            if (draft == null)
            {
                draft = new AuditDraft
                {
                    LocationId = dto.LocationId,
                    SurveyFormId = dto.SurveyFormId,
                    AuditorId = dto.AuditorId,
                    DraftPayloadJson = dto.DraftPayloadJson,
                    CurrentSectionIdx = dto.CurrentSectionIdx,
                    TotalAnswered = dto.TotalAnswered,
                    TotalQuestions = dto.TotalQuestions,
                    StartLatitude = dto.StartLatitude,
                    StartLongitude = dto.StartLongitude,
                    StartedAt = dto.StartedAt ?? DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                _context.AuditDrafts.Add(draft);
            }
            else
            {
                draft.DraftPayloadJson = dto.DraftPayloadJson;
                draft.CurrentSectionIdx = dto.CurrentSectionIdx;
                draft.TotalAnswered = dto.TotalAnswered;
                draft.TotalQuestions = dto.TotalQuestions;
                if (!draft.StartLatitude.HasValue && dto.StartLatitude.HasValue)
                {
                    draft.StartLatitude = dto.StartLatitude;
                    draft.StartLongitude = dto.StartLongitude;
                    draft.StartedAt = dto.StartedAt ?? DateTime.UtcNow;
                }
                draft.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();
            return Ok(draft);
        }

        [Authorize(Roles = "ADMIN,AUDITOR,STANDARD")]
        [HttpDelete("draft")]
        public async Task<IActionResult> DiscardDraft([FromQuery] int locationId, [FromQuery] int surveyFormId, [FromQuery] int auditorId)
        {
            var draft = await _context.AuditDrafts
                .FirstOrDefaultAsync(d => d.LocationId == locationId && d.SurveyFormId == surveyFormId && d.AuditorId == auditorId);

            if (draft != null)
            {
                _context.AuditDrafts.Remove(draft);
                await _context.SaveChangesAsync();
            }

            return NoContent();
        }

        // ==========================================
        // 2. FILE UPLOADS (IMAGES & SIGNATURES)
        // ==========================================
        public class Base64UploadDto
        {
            public string Base64Data { get; set; } = string.Empty;
            public string FileName { get; set; } = "upload.webp";
        }

        [HttpPost("upload-image")]
        public async Task<IActionResult> UploadImage([FromBody] Base64UploadDto dto)
        {
            if (string.IsNullOrEmpty(dto.Base64Data)) return BadRequest("No image data");

            var webRoot = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
            var dir = Path.Combine(webRoot, "uploads", "audit_images");
            Directory.CreateDirectory(dir);

            var fileName = $"audit_{DateTime.UtcNow:yyyyMMdd_HHmmss}_{Guid.NewGuid().ToString().Substring(0, 8)}.webp";
            var filePath = Path.Combine(dir, fileName);

            var base64Clean = dto.Base64Data;
            if (base64Clean.Contains(",")) base64Clean = base64Clean.Split(',')[1];
            var bytes = Convert.FromBase64String(base64Clean);
            await System.IO.File.WriteAllBytesAsync(filePath, bytes);

            var relativeUrl = $"/uploads/audit_images/{fileName}";
            return Ok(new { url = relativeUrl });
        }

        [HttpPost("upload-signature")]
        public async Task<IActionResult> UploadSignature([FromBody] Base64UploadDto dto)
        {
            if (string.IsNullOrEmpty(dto.Base64Data)) return BadRequest("No signature data");

            var webRoot = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
            var dir = Path.Combine(webRoot, "uploads", "signatures");
            Directory.CreateDirectory(dir);

            var fileName = $"sig_{DateTime.UtcNow:yyyyMMdd_HHmmss}_{Guid.NewGuid().ToString().Substring(0, 8)}.webp";
            var filePath = Path.Combine(dir, fileName);

            var base64Clean = dto.Base64Data;
            if (base64Clean.Contains(",")) base64Clean = base64Clean.Split(',')[1];
            var bytes = Convert.FromBase64String(base64Clean);
            await System.IO.File.WriteAllBytesAsync(filePath, bytes);

            var relativeUrl = $"/uploads/signatures/{fileName}";
            return Ok(new { url = relativeUrl });
        }

        // ==========================================
        // 3. FINAL AUDIT SUBMISSION & FAIR SCORING
        // ==========================================
        public class SubmitAuditDto
        {
            public int LocationId { get; set; }
            public int SurveyFormId { get; set; }
            public int PrimaryAuditorId { get; set; }
            public int? AuditeeUserId { get; set; }
            public string? AuditeeNameText { get; set; }
            public int? AuditScheduleId { get; set; }
            public int StaffCount { get; set; } = 0;
            public string AuditType { get; set; } = "announced";
            public string? Notes { get; set; }

            // Signatures
            public string? AuditorSignatureUrl { get; set; }
            public string? AuditeeSignatureUrl { get; set; }
            public DateTime? SignedAt { get; set; }

            // Start & End GPS
            public double? StartLatitude { get; set; }
            public double? StartLongitude { get; set; }
            public double? EndLatitude { get; set; }
            public double? EndLongitude { get; set; }
            public DateTime? StartedAt { get; set; }

            // Answers
            public List<ResponseSubmitDto> Responses { get; set; } = new();
        }

        public class ResponseSubmitDto
        {
            public int SurveyItemId { get; set; }
            public double ScoreGiven { get; set; }
            public bool IsPassed { get; set; }
            public bool IsNa { get; set; } = false; // "ข้าม" / Not Applicable
            public string? Notes { get; set; }
            public List<string> ImageUrls { get; set; } = new();
        }

        [Authorize(Roles = "ADMIN,AUDITOR,STANDARD")]
        [HttpPost]
        public async Task<IActionResult> SubmitAudit([FromBody] SubmitAuditDto dto)
        {
            var form = await _context.SurveyForms
                .Include(f => f.Sections)
                    .ThenInclude(s => s.Items)
                .FirstOrDefaultAsync(f => f.Id == dto.SurveyFormId);

            if (form == null) return NotFound(new { message = "ไม่พบแบบฟอร์มการตรวจ" });

            // Load all items map for scoring validation
            var allItems = form.Sections.SelectMany(s => s.Items).ToDictionary(i => i.Id);

            double totalScore = 0.0;
            double maxScore = 0.0;
            bool hasCriticalDefect = false;

            // 🌟 1. FAIR DYNAMIC SCORING (Deducting N/A questions) & CRITICAL DEFECT AUTO-FAIL CHECK
            foreach (var respDto in dto.Responses)
            {
                if (allItems.TryGetValue(respDto.SurveyItemId, out var item))
                {
                    if (respDto.IsNa)
                    {
                        // Question is marked N/A -> Do not count full score in maxScore
                        continue;
                    }

                    maxScore += item.FullScore;
                    totalScore += respDto.ScoreGiven;

                    if (item.IsCritical && !respDto.IsPassed)
                    {
                        hasCriticalDefect = true; // 🚨 CRITICAL BREACH!
                    }
                }
            }

            double percentageScore = (maxScore > 0) ? Math.Round((totalScore / maxScore) * 100.0, 1) : 100.0;
            
            // 🌟 Rule: IsPassed = (percentageScore >= 85.0) AND (NOT hasCriticalDefect)
            bool isPassed = (percentageScore >= form.PassingScore) && (!hasCriticalDefect);

            // Create AuditRecord
            var record = new AuditRecord
            {
                LocationId = dto.LocationId,
                SurveyFormId = dto.SurveyFormId,
                PrimaryAuditorId = dto.PrimaryAuditorId,
                AuditeeUserId = dto.AuditeeUserId,
                AuditeeNameText = dto.AuditeeNameText,
                AuditScheduleId = dto.AuditScheduleId,
                AuditDate = DateTime.UtcNow,
                TotalScore = totalScore,
                MaxScore = maxScore,
                PercentageScore = percentageScore,
                IsPassed = isPassed,
                HasCriticalDefect = hasCriticalDefect,
                StaffCount = dto.StaffCount,
                AuditType = dto.AuditType,
                Notes = dto.Notes,
                AuditorSignatureUrl = dto.AuditorSignatureUrl,
                AuditeeSignatureUrl = dto.AuditeeSignatureUrl,
                SignedAt = dto.SignedAt ?? DateTime.UtcNow,
                StartLatitude = dto.StartLatitude,
                StartLongitude = dto.StartLongitude,
                EndLatitude = dto.EndLatitude,
                EndLongitude = dto.EndLongitude,
                StartedAt = dto.StartedAt ?? DateTime.UtcNow,
                SubmittedAt = DateTime.UtcNow
            };

            _context.AuditRecords.Add(record);
            await _context.SaveChangesAsync();

            // Save Responses & Images + Auto-create CAP Tasks for failed items
            var capTasksToCreate = new List<CapTask>();

            foreach (var respDto in dto.Responses)
            {
                var response = new AuditResponse
                {
                    AuditRecordId = record.Id,
                    SurveyItemId = respDto.SurveyItemId,
                    ScoreGiven = respDto.IsNa ? 0.0 : respDto.ScoreGiven,
                    IsPassed = respDto.IsNa ? true : respDto.IsPassed,
                    IsNa = respDto.IsNa,
                    Notes = respDto.Notes
                };

                _context.AuditResponses.Add(response);
                await _context.SaveChangesAsync();

                // Save Images
                if (respDto.ImageUrls != null && respDto.ImageUrls.Any())
                {
                    foreach (var imgUrl in respDto.ImageUrls)
                    {
                        _context.AuditResponseImages.Add(new AuditResponseImage
                        {
                            AuditResponseId = response.Id,
                            ImageUrl = imgUrl,
                            UploadedBy = dto.PrimaryAuditorId,
                            UploadedAt = DateTime.UtcNow
                        });
                    }
                    await _context.SaveChangesAsync();
                }

                // Auto-create CAP task if question failed (and not N/A)
                if (!respDto.IsNa && !respDto.IsPassed)
                {
                    allItems.TryGetValue(respDto.SurveyItemId, out var item);
                    var issueItem = item?.QuestionText ?? "ข้อบกพร่องมาตรฐาน";
                    var desc = !string.IsNullOrWhiteSpace(respDto.Notes) ? respDto.Notes : $"ไม่ผ่านเกณฑ์การประเมิน: {issueItem}";

                    capTasksToCreate.Add(new CapTask
                    {
                        AuditRecordId = record.Id,
                        AuditResponseId = response.Id,
                        LocationId = dto.LocationId,
                        IssueItem = issueItem.Length > 250 ? issueItem.Substring(0, 250) : issueItem,
                        Description = desc,
                        SubmissionDeadline = DateTime.UtcNow.AddDays(7), // 7-day SLA
                        Status = "OPEN",
                        AssignedTo = dto.AuditeeUserId,
                        CreatedAt = DateTime.UtcNow
                    });
                }
            }

            if (capTasksToCreate.Any())
            {
                _context.CapTasks.AddRange(capTasksToCreate);
                await _context.SaveChangesAsync();
            }

            // 🌟 2. UPDATE LOCATION CACHE (last_score & last_audit_date)
            var location = await _context.Locations.FindAsync(dto.LocationId);
            if (location != null)
            {
                location.LastScore = percentageScore;
                location.LastAuditDate = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }

            // 🌟 3. MARK SCHEDULE AS COMPLETED (IF APPLICABLE)
            if (dto.AuditScheduleId.HasValue)
            {
                var schedule = await _context.AuditSchedules.FindAsync(dto.AuditScheduleId.Value);
                if (schedule != null)
                {
                    schedule.Status = "completed";
                    await _context.SaveChangesAsync();
                }
            }

            // 🌟 4. DELETE DRAFT
            var draft = await _context.AuditDrafts
                .FirstOrDefaultAsync(d => d.LocationId == dto.LocationId && d.SurveyFormId == dto.SurveyFormId && d.AuditorId == dto.PrimaryAuditorId);
            if (draft != null)
            {
                _context.AuditDrafts.Remove(draft);
                await _context.SaveChangesAsync();
            }

            return Ok(new
            {
                auditRecordId = record.Id,
                totalScore = totalScore,
                maxScore = maxScore,
                percentageScore = percentageScore,
                isPassed = isPassed,
                hasCriticalDefect = hasCriticalDefect,
                capTasksCreated = capTasksToCreate.Count,
                message = "บันทึกและส่งผลการตรวจสำเร็จเรียบร้อยแล้ว"
            });
        }

        // ==========================================
        // 4. AUDIT HISTORY & DETAILS
        // ==========================================
        [HttpGet]
        public async Task<IActionResult> GetAuditRecords([FromQuery] int? locationId, [FromQuery] int? auditorId, [FromQuery] int? limit)
        {
            var query = _context.AuditRecords
                .Include(r => r.Location)
                .Include(r => r.SurveyForm)
                .Include(r => r.PrimaryAuditor)
                .Include(r => r.AuditeeUser)
                .Include(r => r.Responses)
                    .ThenInclude(res => res.SurveyItem)
                .Include(r => r.Responses)
                    .ThenInclude(res => res.Images)
                .AsQueryable();

            if (locationId.HasValue) query = query.Where(r => r.LocationId == locationId.Value);
            if (auditorId.HasValue) query = query.Where(r => r.PrimaryAuditorId == auditorId.Value);

            query = query.OrderByDescending(r => r.AuditDate);

            if (limit.HasValue) query = query.Take(limit.Value);

            var records = await query.ToListAsync();

            var result = records.Select(r => new
            {
                id = r.Id,
                locationId = r.LocationId,
                locationCode = r.Location?.Code,
                locationName = r.Location?.Name,
                locationRegion = r.Location?.Region,
                locationBrand = r.Location?.BrandName,
                surveyFormId = r.SurveyFormId,
                surveyFormTitle = r.SurveyForm?.Title,
                primaryAuditorId = r.PrimaryAuditorId,
                auditorName = r.PrimaryAuditor?.FullName,
                auditeeUserId = r.AuditeeUserId,
                auditeeName = r.AuditeeUser?.FullName ?? r.AuditeeNameText ?? "ผู้จัดการสาขา",
                auditDate = r.AuditDate,
                totalScore = r.TotalScore,
                maxScore = r.MaxScore,
                percentageScore = r.PercentageScore,
                isPassed = r.IsPassed,
                hasCriticalDefect = r.HasCriticalDefect,
                staffCount = r.StaffCount,
                auditType = r.AuditType,
                notes = r.Notes,
                auditorSignatureUrl = r.AuditorSignatureUrl,
                auditeeSignatureUrl = r.AuditeeSignatureUrl,
                signedAt = r.SignedAt,
                startLatitude = r.StartLatitude,
                startLongitude = r.StartLongitude,
                endLatitude = r.EndLatitude,
                endLongitude = r.EndLongitude,
                startedAt = r.StartedAt,
                submittedAt = r.SubmittedAt,
                responses = r.Responses?.Select(res => new
                {
                    id = res.Id,
                    surveyItemId = res.SurveyItemId,
                    questionText = res.SurveyItem?.QuestionText,
                    questionType = res.SurveyItem?.QuestionType,
                    fullScore = res.SurveyItem?.FullScore,
                    isCritical = res.SurveyItem?.IsCritical,
                    orderIndex = res.SurveyItem?.OrderIndex,
                    scoreGiven = res.ScoreGiven,
                    isPassed = res.IsPassed,
                    isNa = res.IsNa,
                    notes = res.Notes,
                    images = res.Images?.Select(img => new
                    {
                        id = img.Id,
                        imageUrl = img.ImageUrl,
                        uploadedAt = img.UploadedAt
                    }).ToList()
                }).ToList()
            });

            return Ok(result);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetAuditDetail(int id)
        {
            var record = await _context.AuditRecords
                .Include(r => r.Location)
                .Include(r => r.SurveyForm)
                .Include(r => r.PrimaryAuditor)
                .Include(r => r.AuditeeUser)
                .Include(r => r.Responses)
                    .ThenInclude(res => res.SurveyItem)
                .Include(r => r.Responses)
                    .ThenInclude(res => res.Images)
                .FirstOrDefaultAsync(r => r.Id == id);

            if (record == null) return NotFound();

            return Ok(record);
        }
    }
}

