using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QSC.Api.Data;
using QSC.Api.Models;
using QSC.Api.Helpers;

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

        private static bool IsValidImageSignature(byte[] bytes)
        {
            if (bytes == null || bytes.Length < 12) return false;

            // JPEG: FF D8 FF
            if (bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF) return true;

            // PNG: 89 50 4E 47
            if (bytes[0] == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47) return true;

            // WebP: RIFF .... WEBP
            if (bytes[0] == 0x52 && bytes[1] == 0x49 && bytes[2] == 0x46 && bytes[3] == 0x46 &&
                bytes[8] == 0x57 && bytes[9] == 0x45 && bytes[10] == 0x42 && bytes[11] == 0x50) return true;

            // GIF: GIF8
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
                // Fallback to storing original data URL if disk write fails
            }
            return input;
        }

        // ==========================================
        // 1. LIVE AUDIT DRAFTS & AUTO-SYNC
        // ==========================================
        [HttpGet("draft")]
        public async Task<IActionResult> GetDraft([FromQuery] int? locationId, [FromQuery] int? surveyFormId, [FromQuery] int? auditorId)
        {
            var (currentUserId, role, allowedLocationIds) = await UserScopeHelper.GetUserScopeAsync(User, _context);
            int targetAuditorId = auditorId.HasValue && auditorId.Value > 0 ? auditorId.Value : currentUserId;

            var query = _context.AuditDrafts
                .AsNoTracking()
                .Include(d => d.Location)
                .Include(d => d.SurveyForm)
                .Where(d => d.AuditorId == targetAuditorId);

            if (locationId.HasValue && locationId.Value > 0)
            {
                if (allowedLocationIds != null && !allowedLocationIds.Contains(locationId.Value)) return Forbid();
                query = query.Where(d => d.LocationId == locationId.Value);
            }
            else if (allowedLocationIds != null)
            {
                query = query.Where(d => allowedLocationIds.Contains(d.LocationId));
            }

            if (surveyFormId.HasValue && surveyFormId.Value > 0)
                query = query.Where(d => d.SurveyFormId == surveyFormId.Value);

            var draft = await query.OrderByDescending(d => d.UpdatedAt).FirstOrDefaultAsync();

            return Ok(draft);
        }

        [HttpGet("drafts")]
        public async Task<IActionResult> GetAuditorDrafts([FromQuery] int? auditorId)
        {
            var (currentUserId, role, allowedLocationIds) = await UserScopeHelper.GetUserScopeAsync(User, _context);
            int targetAuditorId = auditorId.HasValue && auditorId.Value > 0 ? auditorId.Value : currentUserId;

            var query = _context.AuditDrafts
                .AsNoTracking()
                .Include(d => d.Location)
                .Include(d => d.SurveyForm)
                .Where(d => d.AuditorId == targetAuditorId || d.AuditorId == currentUserId);

            if (allowedLocationIds != null)
            {
                query = query.Where(d => allowedLocationIds.Contains(d.LocationId));
            }

            var drafts = await query.OrderByDescending(d => d.UpdatedAt).ToListAsync();

            return Ok(drafts);
        }

        public class DraftSaveDto
        {
            public int LocationId { get; set; }
            public int SurveyFormId { get; set; } = 1;
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
            var (currentUserId, role, allowedLocationIds) = await UserScopeHelper.GetUserScopeAsync(User, _context);
            int effectiveAuditorId = dto.AuditorId > 0 ? dto.AuditorId : currentUserId;

            var draft = await _context.AuditDrafts
                .FirstOrDefaultAsync(d => d.LocationId == dto.LocationId && d.SurveyFormId == dto.SurveyFormId && (d.AuditorId == effectiveAuditorId || d.AuditorId == currentUserId));

            if (draft == null)
            {
                draft = new AuditDraft
                {
                    LocationId = dto.LocationId,
                    SurveyFormId = dto.SurveyFormId,
                    AuditorId = effectiveAuditorId,
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
        public async Task<IActionResult> DiscardDraft([FromQuery] int? locationId, [FromQuery] int? surveyFormId, [FromQuery] int? auditorId)
        {
            var (currentUserId, role, allowedLocationIds) = await UserScopeHelper.GetUserScopeAsync(User, _context);
            int targetAuditorId = auditorId.HasValue && auditorId.Value > 0 ? auditorId.Value : currentUserId;

            var query = _context.AuditDrafts.AsQueryable();

            if (locationId.HasValue && locationId.Value > 0)
                query = query.Where(d => d.LocationId == locationId.Value);

            if (surveyFormId.HasValue && surveyFormId.Value > 0)
                query = query.Where(d => d.SurveyFormId == surveyFormId.Value);

            if (role != "ADMIN")
            {
                query = query.Where(d => d.AuditorId == targetAuditorId || d.AuditorId == currentUserId || d.AuditorId == 1);
            }
            else if (auditorId.HasValue && auditorId.Value > 0)
            {
                query = query.Where(d => d.AuditorId == auditorId.Value);
            }

            var drafts = await query.ToListAsync();
            if (drafts.Any())
            {
                _context.AuditDrafts.RemoveRange(drafts);
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

            if (bytes.Length > 10 * 1024 * 1024)
            {
                return BadRequest(new { message = "ขนาดไฟล์รูปภาพเกินกำหนด (ไม่เกิน 10MB)" });
            }

            if (!IsValidImageSignature(bytes))
            {
                return BadRequest(new { message = "ไฟล์รูปภาพไม่ถูกต้องหรือรูปแบบไม่ปลอดภัย (อนุญาตเฉพาะ JPEG, PNG, WebP)" });
            }

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

            if (bytes.Length > 5 * 1024 * 1024)
            {
                return BadRequest(new { message = "ขนาดไฟล์ลายเซ็นเกินกำหนด (ไม่เกิน 5MB)" });
            }

            if (!IsValidImageSignature(bytes))
            {
                return BadRequest(new { message = "ไฟล์ลายเซ็นไม่ถูกต้องหรือรูปแบบไม่ปลอดภัย" });
            }

            await System.IO.File.WriteAllBytesAsync(filePath, bytes);

            var relativeUrl = $"/uploads/signatures/{fileName}";
            return Ok(new { url = relativeUrl });
        }

        // ==========================================
        // 3. FINAL AUDIT SUBMISSION & SERVER-SIDE FAIR SCORING
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
            public string? MetadataValuesJson { get; set; }

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
            public string? RawAnswer { get; set; } // Raw answer e.g. "yes", "no", "na", "1".."5"
            public string? AnswerValue { get; set; }
            public double? ScaleScore { get; set; }
            public string? Notes { get; set; }
            public List<string> ImageUrls { get; set; } = new();
        }

        public class ComputedItemResponse
        {
            public int SurveyItemId { get; set; }
            public double ScoreGiven { get; set; }
            public bool IsPassed { get; set; }
            public bool IsNa { get; set; }
            public string? Notes { get; set; }
            public List<string> ImageUrls { get; set; } = new();
        }

        [Authorize(Roles = "ADMIN,AUDITOR,STANDARD")]
        [HttpPost]
        public async Task<IActionResult> SubmitAudit([FromBody] SubmitAuditDto dto)
        {
            var (currentUserId, role, allowedLocationIds) = await UserScopeHelper.GetUserScopeAsync(User, _context);

            if (allowedLocationIds != null && !allowedLocationIds.Contains(dto.LocationId))
            {
                return Forbid();
            }

            var form = await _context.SurveyForms
                .Include(f => f.Sections)
                    .ThenInclude(s => s.Items)
                .FirstOrDefaultAsync(f => f.Id == dto.SurveyFormId);

            if (form == null) return NotFound(new { message = "ไม่พบแบบฟอร์มการตรวจ" });

            // Map all items by Id for server-side scoring verification
            var allItems = form.Sections.SelectMany(s => s.Items).ToDictionary(i => i.Id);

            double totalScore = 0.0;
            double maxScore = 0.0;
            bool hasCriticalDefect = false;
            var processedResponses = new List<ComputedItemResponse>();

            // 🌟 1. STRICT SERVER-SIDE SCORING COMPUTATION
            foreach (var respDto in dto.Responses)
            {
                if (!allItems.TryGetValue(respDto.SurveyItemId, out var item)) continue;

                string raw = (respDto.RawAnswer ?? respDto.AnswerValue ?? (respDto.IsNa ? "na" : (respDto.IsPassed ? "yes" : "no"))).Trim().ToLower();
                bool isNa = respDto.IsNa || raw == "na" || raw == "skip" || raw == "ข้าม";
                double scoreGiven = 0.0;
                bool isPassed = true;

                if (isNa)
                {
                    // N/A: excluded from maxScore
                    isNa = true;
                    scoreGiven = 0.0;
                    isPassed = true;
                }
                else if (item.QuestionType?.ToLower() == "scale")
                {
                    // 1..5 scale question
                    double scaleVal = 0.0;
                    if (double.TryParse(raw, out double parsedVal)) scaleVal = parsedVal;
                    else if (respDto.ScaleScore.HasValue) scaleVal = respDto.ScaleScore.Value;
                    else if (item.FullScore > 0) scaleVal = (respDto.ScoreGiven / item.FullScore) * 5.0;
                    else scaleVal = 3.0;

                    scaleVal = Math.Clamp(scaleVal, 1.0, 5.0);
                    scoreGiven = Math.Round((scaleVal / 5.0) * item.FullScore, 2);
                    isPassed = scaleVal >= 3.0;

                    maxScore += item.FullScore;
                    totalScore += scoreGiven;

                    if (item.IsCritical && !isPassed)
                    {
                        hasCriticalDefect = true;
                    }
                }
                else
                {
                    // Yes/No question
                    bool isYes = raw == "yes" || raw == "true" || raw == "1" || respDto.IsPassed;
                    scoreGiven = isYes ? item.FullScore : 0.0;
                    isPassed = isYes;

                    maxScore += item.FullScore;
                    totalScore += scoreGiven;

                    if (item.IsCritical && !isPassed)
                    {
                        hasCriticalDefect = true;
                    }
                }

                processedResponses.Add(new ComputedItemResponse
                {
                    SurveyItemId = respDto.SurveyItemId,
                    ScoreGiven = scoreGiven,
                    IsPassed = isPassed,
                    IsNa = isNa,
                    Notes = respDto.Notes,
                    ImageUrls = respDto.ImageUrls ?? new List<string>()
                });
            }

            double percentageScore = (maxScore > 0) ? Math.Round((totalScore / maxScore) * 100.0, 1) : 100.0;
            bool isOverallPassed = (percentageScore >= form.PassingScore) && (!hasCriticalDefect);

            // 🛡️ Ensure valid PrimaryAuditorId (Foreign Key Validation)
            int primaryAuditorId = currentUserId;
            if (primaryAuditorId <= 0 || !await _context.Users.AnyAsync(u => u.Id == primaryAuditorId))
            {
                if (dto.PrimaryAuditorId > 0 && await _context.Users.AnyAsync(u => u.Id == dto.PrimaryAuditorId))
                {
                    primaryAuditorId = dto.PrimaryAuditorId;
                }
                else
                {
                    var fallbackUser = await _context.Users.FirstOrDefaultAsync();
                    primaryAuditorId = fallbackUser != null ? fallbackUser.Id : (currentUserId > 0 ? currentUserId : 1);
                }
            }

            // 🛡️ Ensure valid AuditeeUserId (Foreign Key Validation)
            int? validAuditeeUserId = null;
            if (dto.AuditeeUserId.HasValue && dto.AuditeeUserId.Value > 0)
            {
                if (await _context.Users.AnyAsync(u => u.Id == dto.AuditeeUserId.Value))
                {
                    validAuditeeUserId = dto.AuditeeUserId.Value;
                }
            }

            // 🛡️ Ensure valid AuditScheduleId (Foreign Key Validation)
            int? validScheduleId = null;
            if (dto.AuditScheduleId.HasValue && dto.AuditScheduleId.Value > 0)
            {
                if (await _context.AuditSchedules.AnyAsync(s => s.Id == dto.AuditScheduleId.Value))
                {
                    validScheduleId = dto.AuditScheduleId.Value;
                }
            }

            // 🛡️ Ensure valid LocationId (Foreign Key Validation)
            var location = await _context.Locations.FindAsync(dto.LocationId);
            if (location == null)
            {
                location = await _context.Locations.FirstOrDefaultAsync();
                if (location == null) return BadRequest(new { message = "ไม่พบข้อมูลสาขาในระบบ" });
                dto.LocationId = location.Id;
            }

            // 🌟 2. ATOMIC DATABASE TRANSACTION
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // Convert Base64 Signatures to Server Files
                var auditorSigUrl = await SaveBase64IfPresentAsync(dto.AuditorSignatureUrl, "signatures", "sig_auditor");
                var auditeeSigUrl = await SaveBase64IfPresentAsync(dto.AuditeeSignatureUrl, "signatures", "sig_auditee");

                // Create AuditRecord
                var record = new AuditRecord
                {
                    LocationId = dto.LocationId,
                    SurveyFormId = dto.SurveyFormId,
                    PrimaryAuditorId = primaryAuditorId,
                    AuditeeUserId = validAuditeeUserId,
                    AuditeeNameText = dto.AuditeeNameText,
                    AuditScheduleId = validScheduleId,
                    AuditDate = DateTime.UtcNow,
                    TotalScore = totalScore,
                    MaxScore = maxScore,
                    PercentageScore = percentageScore,
                    IsPassed = isOverallPassed,
                    HasCriticalDefect = hasCriticalDefect,
                    StaffCount = dto.StaffCount,
                    AuditType = dto.AuditType,
                    Notes = dto.Notes,
                    MetadataValuesJson = dto.MetadataValuesJson,
                    AuditorSignatureUrl = auditorSigUrl,
                    AuditeeSignatureUrl = auditeeSigUrl,
                    SignedAt = dto.SignedAt ?? DateTime.UtcNow,
                    StartLatitude = dto.StartLatitude,
                    StartLongitude = dto.StartLongitude,
                    EndLatitude = dto.EndLatitude,
                    EndLongitude = dto.EndLongitude,
                    StartedAt = dto.StartedAt ?? DateTime.UtcNow,
                    SubmittedAt = DateTime.UtcNow
                };

                // Save Responses & Images + Auto-create CAP Tasks for failed items
                var capTasksToCreate = new List<CapTask>();

                foreach (var computedResp in processedResponses)
                {
                    var response = new AuditResponse
                    {
                        SurveyItemId = computedResp.SurveyItemId,
                        ScoreGiven = computedResp.ScoreGiven,
                        IsPassed = computedResp.IsPassed,
                        IsNa = computedResp.IsNa,
                        Notes = computedResp.Notes
                    };

                    // Attach Images (auto-saved to /uploads/audit_images/ if base64)
                    if (computedResp.ImageUrls != null && computedResp.ImageUrls.Any())
                    {
                        foreach (var imgUrl in computedResp.ImageUrls)
                        {
                            var savedImgUrl = await SaveBase64IfPresentAsync(imgUrl, "audit_images", "audit");
                            response.Images.Add(new AuditResponseImage
                            {
                                ImageUrl = savedImgUrl,
                                UploadedBy = primaryAuditorId,
                                UploadedAt = DateTime.UtcNow
                            });
                        }
                    }

                    record.Responses.Add(response);

                    // Auto-create CAP task if question failed (and not N/A)
                    if (!computedResp.IsNa && !computedResp.IsPassed)
                    {
                        allItems.TryGetValue(computedResp.SurveyItemId, out var item);
                        var issueItem = item?.QuestionText ?? "ข้อบกพร่องมาตรฐาน";
                        var desc = !string.IsNullOrWhiteSpace(computedResp.Notes) ? computedResp.Notes : $"ไม่ผ่านเกณฑ์การประเมิน: {issueItem}";

                        capTasksToCreate.Add(new CapTask
                        {
                            AuditRecord = record,
                            AuditResponse = response,
                            LocationId = dto.LocationId,
                            IssueItem = issueItem.Length > 250 ? issueItem.Substring(0, 250) : issueItem,
                            Description = desc,
                            SubmissionDeadline = DateTime.UtcNow.AddDays(7), // 7-day SLA
                            Status = "OPEN",
                            AssignedTo = validAuditeeUserId,
                            CreatedAt = DateTime.UtcNow
                        });
                    }
                }

                _context.AuditRecords.Add(record);

                if (capTasksToCreate.Any())
                {
                    _context.CapTasks.AddRange(capTasksToCreate);
                }

                // Update Location summary cache
                location.LastScore = percentageScore;
                location.LastAuditDate = DateTime.UtcNow;

                // Mark Schedule completed
                if (validScheduleId.HasValue)
                {
                    var schedule = await _context.AuditSchedules.FindAsync(validScheduleId.Value);
                    if (schedule != null)
                    {
                        schedule.Status = "completed";
                    }
                }
                else
                {
                    // Fallback: If no explicit schedule ID was sent, find any pending schedule for this location & form
                    var pendingSchedule = await _context.AuditSchedules
                        .Where(s => s.LocationId == dto.LocationId && (s.Status == "pending" || s.Status == "in_progress"))
                        .OrderByDescending(s => s.ScheduledDate)
                        .FirstOrDefaultAsync();
                    if (pendingSchedule != null)
                    {
                        pendingSchedule.Status = "completed";
                        record.AuditScheduleId = pendingSchedule.Id;
                    }
                }

                // Delete Draft
                var draft = await _context.AuditDrafts
                    .FirstOrDefaultAsync(d => d.LocationId == dto.LocationId && d.SurveyFormId == dto.SurveyFormId && (d.AuditorId == primaryAuditorId || d.AuditorId == currentUserId));
                if (draft != null)
                {
                    _context.AuditDrafts.Remove(draft);
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new
                {
                    auditRecordId = record.Id,
                    totalScore = totalScore,
                    maxScore = maxScore,
                    percentageScore = percentageScore,
                    isPassed = isOverallPassed,
                    hasCriticalDefect = hasCriticalDefect,
                    capTasksCreated = capTasksToCreate.Count,
                    message = "บันทึกและคำนวณผลการตรวจสำเร็จเรียบร้อยแล้ว"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                var innerMsg = ex.InnerException != null ? ex.InnerException.Message : ex.Message;
                return StatusCode(500, new { message = $"เกิดข้อผิดพลาดในการบันทึกผลตรวจ: {innerMsg}" });
            }
        }

        // ==========================================
        // 4. AUDIT HISTORY & DETAILS
        // ==========================================
        [HttpGet("records")]
        [HttpGet]
        public async Task<IActionResult> GetAuditRecords([FromQuery] int? locationId, [FromQuery] int? auditorId, [FromQuery] int? limit)
        {
            var (currentUserId, role, allowedLocationIds) = await UserScopeHelper.GetUserScopeAsync(User, _context);

            var query = _context.AuditRecords
                .AsNoTracking()
                .Include(r => r.Location)
                .Include(r => r.SurveyForm)
                .Include(r => r.PrimaryAuditor)
                .Include(r => r.AuditeeUser)
                .Include(r => r.Responses)
                    .ThenInclude(res => res.SurveyItem)
                        .ThenInclude(item => item!.SurveySection)
                .Include(r => r.Responses)
                    .ThenInclude(res => res.Images)
                .AsQueryable();

            if (role == "AUDITEE")
            {
                if (allowedLocationIds != null)
                {
                    query = query.Where(r => allowedLocationIds.Contains(r.LocationId));
                }
                else
                {
                    return Ok(new List<object>());
                }
            }
            else if (allowedLocationIds != null)
            {
                query = query.Where(r => allowedLocationIds.Contains(r.LocationId));
            }

            if (locationId.HasValue)
            {
                if (allowedLocationIds != null && !allowedLocationIds.Contains(locationId.Value))
                {
                    return Ok(new List<object>());
                }
                query = query.Where(r => r.LocationId == locationId.Value);
            }

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
                metadataValuesJson = r.MetadataValuesJson,
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
                    surveySectionId = res.SurveyItem?.SurveySectionId,
                    sectionTitle = res.SurveyItem?.SurveySection?.Title,
                    sectionOrderIndex = res.SurveyItem?.SurveySection?.OrderIndex,
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

        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetAuditDetail(int id)
        {
            var (currentUserId, role, allowedLocationIds) = await UserScopeHelper.GetUserScopeAsync(User, _context);

            var record = await _context.AuditRecords
                .AsNoTracking()
                .Include(r => r.Location)
                .Include(r => r.SurveyForm)
                .Include(r => r.PrimaryAuditor)
                .Include(r => r.AuditeeUser)
                .Include(r => r.Responses)
                    .ThenInclude(res => res.SurveyItem)
                        .ThenInclude(item => item!.SurveySection)
                .Include(r => r.Responses)
                    .ThenInclude(res => res.Images)
                .FirstOrDefaultAsync(r => r.Id == id);

            if (record == null) return NotFound();

            if (allowedLocationIds != null && !allowedLocationIds.Contains(record.LocationId))
            {
                return Forbid();
            }

            return Ok(record);
        }
    }
}

