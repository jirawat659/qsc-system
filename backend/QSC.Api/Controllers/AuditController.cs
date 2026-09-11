using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using QSC.Api.Data;
using QSC.Api.Models;
using QSC.Api.Helpers;
using QSC.Api.Hubs;

namespace QSC.Api.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class AuditController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IWebHostEnvironment _env;
        private readonly ILogger<AuditController> _logger;
        private readonly IHubContext<CapChatHub> _hubContext;

        public AuditController(AppDbContext context, IWebHostEnvironment env, ILogger<AuditController> logger, IHubContext<CapChatHub> hubContext)
        {
            _context = context;
            _env = env;
            _logger = logger;
            _hubContext = hubContext;
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
                var uploadsRoot = UploadHelper.GetUploadsRootPath(_env);
                var dir = Path.Combine(uploadsRoot, subfolder);
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
            catch (Exception ex)
            {
                Console.WriteLine($"[AuditController] Base64 image conversion error ({prefix}): {ex.Message}");
            }
            return input;
        }

        // ==========================================
        // 1. LIVE AUDIT DRAFTS & AUTO-SYNC
        // ==========================================
        [HttpGet("draft")]
        public async Task<IActionResult> GetDraft([FromQuery] int? locationId, [FromQuery] int? surveyFormId, [FromQuery] int? auditorId, [FromQuery] int? scheduleId)
        {
            var (currentUserId, role, allowedLocationIds) = await UserScopeHelper.GetUserScopeAsync(User, _context);
            var (_, _, allowedBrandIds) = await UserScopeHelper.GetUserBrandScopeAsync(User, _context);
            // 🔒 IDOR FIX: a non-admin used to be able to pass ?auditorId=<someone else> and read
            // that person's in-progress live-audit draft (unsubmitted answers, notes, start GPS,
            // in-progress photos). Only ADMIN may look up another auditor's draft; everyone else
            // is always scoped to their own id regardless of what they pass in the query string.
            int targetAuditorId = (role == "ADMIN" && auditorId.HasValue && auditorId.Value > 0)
                ? auditorId.Value
                : currentUserId;

            var query = _context.AuditDrafts
                .Where(d => (allowedLocationIds == null || allowedLocationIds.Contains(d.LocationId)) &&
                            (allowedBrandIds == null || (d.Location != null && d.Location.LocationBrands.Any(lb => allowedBrandIds.Contains(lb.BrandId)))));

            if (scheduleId.HasValue && scheduleId.Value > 0)
            {
                query = query.Where(d => d.AuditScheduleId == scheduleId.Value);
            }
            else
            {
                if (locationId.HasValue)
                {
                    query = query.Where(d => d.LocationId == locationId.Value);
                }

                if (surveyFormId.HasValue)
                {
                    query = query.Where(d => d.SurveyFormId == surveyFormId.Value);
                }

                query = query.Where(d => d.AuditorId == targetAuditorId);

                query = query.Where(d => d.AuditScheduleId == null);
            }

            var draft = await query.OrderByDescending(d => d.UpdatedAt).FirstOrDefaultAsync();

            return Ok(draft);
        }

        [HttpGet("drafts")]
        public async Task<IActionResult> GetAuditorDrafts([FromQuery] int? auditorId)
        {
            var (currentUserId, role, allowedLocationIds) = await UserScopeHelper.GetUserScopeAsync(User, _context);
            var (_, _, allowedBrandIds) = await UserScopeHelper.GetUserBrandScopeAsync(User, _context);

            var query = _context.AuditDrafts
                .Include(d => d.Location)
                .Include(d => d.SurveyForm)
                .Where(d => (allowedLocationIds == null || allowedLocationIds.Contains(d.LocationId)) &&
                            (allowedBrandIds == null || (d.Location != null && d.Location.LocationBrands.Any(lb => allowedBrandIds.Contains(lb.BrandId)))));

            // 🔒 IDOR FIX: non-admins used to be able to pass ?auditorId=<someone else> and the
            // filter would OR it with their own id, so it never actually excluded anything they
            // asked for — any auditor could list any other auditor's full stack of live drafts.
            // Only ADMIN may request another auditor's drafts; everyone else is pinned to their own id.
            if (role == "ADMIN")
            {
                if (auditorId.HasValue && auditorId.Value > 0)
                {
                    query = query.Where(d => d.AuditorId == auditorId.Value);
                }
            }
            else
            {
                query = query.Where(d => d.AuditorId == currentUserId);
            }

            var allDrafts = await query.OrderByDescending(d => d.UpdatedAt).ToListAsync();

            return Ok(allDrafts);
        }

        public class DraftSaveDto
        {
            public int? Id { get; set; }
            public int LocationId { get; set; }
            public int SurveyFormId { get; set; } = 1;
            public int AuditorId { get; set; }
            public int? AuditScheduleId { get; set; }
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
            var (_, _, allowedBrandIds) = await UserScopeHelper.GetUserBrandScopeAsync(User, _context);

            var canAccessLocation = await _context.Locations.AnyAsync(location =>
                location.Id == dto.LocationId &&
                (allowedLocationIds == null || allowedLocationIds.Contains(location.Id)) &&
                (allowedBrandIds == null || location.LocationBrands.Any(lb => allowedBrandIds.Contains(lb.BrandId))));
            if (!canAccessLocation) return Forbid();

            // 🎯 Do not save draft if no questions have been answered
            if (dto.TotalAnswered <= 0)
            {
                return Ok(new { message = "No answers yet, draft skipped", totalAnswered = 0 });
            }

            // 🔒 IDOR FIX: dto.AuditorId came straight from the client with no ownership check —
            // a non-admin could set it to another real auditor's id and have a brand-new draft
            // silently attributed to that person. Non-admins are now always pinned to their own id;
            // only ADMIN may explicitly attribute a draft to someone else.
            int effectiveAuditorId = (role == "ADMIN" && dto.AuditorId > 0) ? dto.AuditorId : currentUserId;

            // Update schedule status if explicit schedule was provided
            AuditSchedule? targetSchedule = null;
            if (dto.AuditScheduleId.HasValue && dto.AuditScheduleId.Value > 0)
            {
                targetSchedule = await _context.AuditSchedules.FindAsync(dto.AuditScheduleId.Value);
                if (targetSchedule != null && targetSchedule.Status == "pending")
                {
                    targetSchedule.Status = "in_progress";
                }
            }

            int? effectiveScheduleId = (targetSchedule != null) ? targetSchedule.Id : null;

            AuditDraft? draft = null;
            // 1. If explicit Draft ID was passed, update that specific draft row
            if (dto.Id.HasValue && dto.Id.Value > 0)
            {
                draft = await _context.AuditDrafts.FindAsync(dto.Id.Value);
            }

            // 2. If no Draft ID but an AuditScheduleId was provided, match draft by AuditScheduleId
            if (draft == null && effectiveScheduleId.HasValue)
            {
                draft = await _context.AuditDrafts
                    .Where(d => d.AuditScheduleId == effectiveScheduleId.Value)
                    .OrderByDescending(d => d.UpdatedAt)
                    .FirstOrDefaultAsync();
            }

            // 🔒 IDOR FIX: an existing draft found by id (or by schedule) was updated with zero
            // ownership check beyond location scope — any AUDITOR/STANDARD with access to the same
            // branch could pass another auditor's live draft id and overwrite their in-progress
            // answers/photos/notes. Non-admins may only continue writing to their own drafts.
            if (draft != null && role != "ADMIN" && draft.AuditorId != currentUserId)
            {
                return Forbid();
            }

            // 3. If still no draft, insert a brand-new row (ensures separate rows for ad-hoc drafts)
            if (draft == null)
            {
                draft = new AuditDraft
                {
                    LocationId = dto.LocationId,
                    SurveyFormId = dto.SurveyFormId,
                    AuditorId = effectiveAuditorId,
                    AuditScheduleId = effectiveScheduleId,
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
                draft.AuditScheduleId = effectiveScheduleId ?? draft.AuditScheduleId;
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
        public async Task<IActionResult> DiscardDraft([FromQuery] int? id, [FromQuery] int? locationId, [FromQuery] int? surveyFormId, [FromQuery] int? auditorId, [FromQuery] int? scheduleId)
        {
            var (currentUserId, role, allowedLocationIds) = await UserScopeHelper.GetUserScopeAsync(User, _context);
            var (_, _, allowedBrandIds) = await UserScopeHelper.GetUserBrandScopeAsync(User, _context);

            var query = _context.AuditDrafts.AsQueryable();

            if (id.HasValue && id.Value > 0)
            {
                query = query.Where(d => d.Id == id.Value);
            }
            else
            {
                if (locationId.HasValue && locationId.Value > 0)
                    query = query.Where(d => d.LocationId == locationId.Value);

                if (surveyFormId.HasValue && surveyFormId.Value > 0)
                    query = query.Where(d => d.SurveyFormId == surveyFormId.Value);

                // 🐛 FIX: without this, discarding by (locationId, surveyFormId) alone — with no
                // explicit draft id — could delete a *different* schedule occurrence's draft for
                // the same location/form. Scope to the specific schedule when one is given.
                if (scheduleId.HasValue && scheduleId.Value > 0)
                    query = query.Where(d => d.AuditScheduleId == scheduleId.Value);
            }

            if (allowedLocationIds != null)
                query = query.Where(d => allowedLocationIds.Contains(d.LocationId));

            if (allowedBrandIds != null)
                query = query.Where(d => d.Location != null &&
                    d.Location.LocationBrands.Any(lb => allowedBrandIds.Contains(lb.BrandId)));

            // 🔒 CRITICAL FIX: this used to be
            //   d.AuditorId == targetAuditorId || d.AuditorId == currentUserId || d.AuditorId == 1
            // — an unconditional "|| d.AuditorId == 1" leftover (looks like debug/test code) meant
            // ANY non-admin auditor/standard user could delete user #1's in-progress draft (and
            // silently revert their assigned schedule back to "pending") just by knowing or
            // guessing the draft id, regardless of who they actually were. It also let a non-admin
            // pass ?auditorId=<someone else> to reach other people's drafts the same way the GET
            // endpoints above did. Non-admins are now always scoped strictly to their own drafts.
            if (role == "ADMIN")
            {
                if (auditorId.HasValue && auditorId.Value > 0)
                {
                    query = query.Where(d => d.AuditorId == auditorId.Value);
                }
            }
            else
            {
                query = query.Where(d => d.AuditorId == currentUserId);
            }

            var drafts = await query.ToListAsync();
            if (drafts.Any())
            {
                // Revert any related in_progress schedule back to pending
                foreach (var d in drafts)
                {
                    AuditSchedule? scheduleToRevert = null;
                    if (d.AuditScheduleId.HasValue && d.AuditScheduleId.Value > 0)
                    {
                        scheduleToRevert = await _context.AuditSchedules.FindAsync(d.AuditScheduleId.Value);
                    }
                    if (scheduleToRevert == null)
                    {
                        scheduleToRevert = await _context.AuditSchedules
                            .Where(s => s.LocationId == d.LocationId && s.Status == "in_progress")
                            .OrderByDescending(s => s.ScheduledDate)
                            .FirstOrDefaultAsync();
                    }
                    if (scheduleToRevert != null && scheduleToRevert.Status == "in_progress")
                    {
                        scheduleToRevert.Status = "pending";
                    }
                }

                _context.AuditDrafts.RemoveRange(drafts);
            }

            // Also revert schedule if explicit scheduleId was provided (even if no draft existed)
            if (scheduleId.HasValue && scheduleId.Value > 0)
            {
                var directSchedule = await _context.AuditSchedules.FindAsync(scheduleId.Value);
                if (directSchedule != null && directSchedule.Status == "in_progress")
                {
                    directSchedule.Status = "pending";
                }
            }
            else if (!drafts.Any() && locationId.HasValue && locationId.Value > 0)
            {
                var locSchedule = await _context.AuditSchedules
                    .Where(s => s.LocationId == locationId.Value && s.Status == "in_progress")
                    .OrderByDescending(s => s.ScheduledDate)
                    .FirstOrDefaultAsync();
                if (locSchedule != null)
                {
                    locSchedule.Status = "pending";
                }
            }

            await _context.SaveChangesAsync();
            return NoContent();
        }

        // ==========================================
        // 2. FILE UPLOADS (IMAGES & SIGNATURES)
        // ==========================================
        public class Base64UploadDto
        {
            public string Base64Data { get; set; } = string.Empty;
            public string FileName { get; set; } = "upload.webp";
            public string? PreviousUrl { get; set; }
        }

        [HttpPost("upload-image")]
        public async Task<IActionResult> UploadImage([FromBody] Base64UploadDto dto)
        {
            if (string.IsNullOrEmpty(dto.Base64Data)) return BadRequest("No image data");

            var uploadsRoot = UploadHelper.GetUploadsRootPath(_env);
            var dir = Path.Combine(uploadsRoot, "audit_images");
            Directory.CreateDirectory(dir);

            // Clean previous image if exists
            if (!string.IsNullOrWhiteSpace(dto.PreviousUrl) && dto.PreviousUrl.StartsWith("/uploads/audit_images/"))
            {
                try
                {
                    var oldFile = Path.Combine(dir, Path.GetFileName(dto.PreviousUrl));
                    if (System.IO.File.Exists(oldFile)) System.IO.File.Delete(oldFile);
                }
                catch { }
            }

            var fileName = $"img_{DateTime.UtcNow:yyyyMMdd_HHmmss}_{Guid.NewGuid().ToString().Substring(0, 8)}.webp";
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

            var uploadsRoot = UploadHelper.GetUploadsRootPath(_env);
            var dir = Path.Combine(uploadsRoot, "signatures");
            Directory.CreateDirectory(dir);

            // Clean previous signature file to prevent disk clutter
            if (!string.IsNullOrWhiteSpace(dto.PreviousUrl) && dto.PreviousUrl.StartsWith("/uploads/signatures/"))
            {
                try
                {
                    var oldFile = Path.Combine(dir, Path.GetFileName(dto.PreviousUrl));
                    if (System.IO.File.Exists(oldFile)) System.IO.File.Delete(oldFile);
                }
                catch { }
            }

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
            public int? DraftId { get; set; }
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

            // Start & End GPS & Timing
            public double? StartLatitude { get; set; }
            public double? StartLongitude { get; set; }
            public double? EndLatitude { get; set; }
            public double? EndLongitude { get; set; }
            public bool IsBackdated { get; set; } = false;
            public DateTime? StartedAt { get; set; }
            public DateTime? SubmittedAt { get; set; }

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

        // 🌟 คำนวณคะแนนฝั่ง Server เสมอ (ห้ามเชื่อคะแนนจาก client) — ใช้ร่วมกันทั้งตอนส่งครั้งแรกและตอนแก้ไข
        private (double TotalScore, double MaxScore, bool HasCriticalDefect, List<ComputedItemResponse> Responses, Dictionary<int, SurveyItem> AllItems) ComputeScoring(
            SurveyForm form, List<ResponseSubmitDto> responses)
        {
            var allItems = form.Sections.SelectMany(s => s.Items).ToDictionary(i => i.Id);

            double totalScore = 0.0;
            double maxScore = 0.0;
            bool hasCriticalDefect = false;
            var processedResponses = new List<ComputedItemResponse>();

            foreach (var respDto in responses)
            {
                if (!allItems.TryGetValue(respDto.SurveyItemId, out var item)) continue;

                string raw = (respDto.RawAnswer ?? respDto.AnswerValue ?? (respDto.IsNa ? "na" : (respDto.IsPassed ? "yes" : "no"))).Trim().ToLower();
                bool isNa = respDto.IsNa || raw == "na" || raw == "skip" || raw == "ข้าม";
                double scoreGiven = 0.0;
                bool isPassed = true;

                if (isNa)
                {
                    isNa = true;
                    scoreGiven = 0.0;
                    isPassed = true;
                }
                else if (item.QuestionType?.ToLower() == "scale")
                {
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
                    bool isYes;
                    if (raw == "no" || raw == "false" || raw == "0")
                    {
                        isYes = false;
                    }
                    else if (raw == "yes" || raw == "true" || raw == "1")
                    {
                        isYes = true;
                    }
                    else
                    {
                        // 🐛 FIX: this used to fall back to the client-supplied IsPassed flag,
                        // which defeats the whole point of recomputing scores server-side
                        // ("ห้ามเชื่อคะแนนจาก client" per the comment on ComputeScoring above).
                        // A raw answer that isn't a recognized yes/no token is fail-closed
                        // (treated as ไม่ผ่าน) instead of trusting the client's verdict.
                        isYes = false;
                    }

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

            return (totalScore, maxScore, hasCriticalDefect, processedResponses, allItems);
        }

        [Authorize(Roles = "ADMIN,AUDITOR,STANDARD")]
        [HttpPost]
        public async Task<IActionResult> SubmitAudit([FromBody] SubmitAuditDto dto)
        {
            var (currentUserId, role, allowedLocationIds) = await UserScopeHelper.GetUserScopeAsync(User, _context);
            var (_, _, allowedBrandIds) = await UserScopeHelper.GetUserBrandScopeAsync(User, _context);

            var canAccessLocation = await _context.Locations.AnyAsync(location =>
                location.Id == dto.LocationId &&
                (allowedLocationIds == null || allowedLocationIds.Contains(location.Id)) &&
                (allowedBrandIds == null || location.LocationBrands.Any(lb => allowedBrandIds.Contains(lb.BrandId))));
            if (!canAccessLocation) return Forbid();

            var form = await _context.SurveyForms
                .Include(f => f.Sections)
                    .ThenInclude(s => s.Items)
                .Include(f => f.FormBrands)
                .Include(f => f.TargetLocations)
                .FirstOrDefaultAsync(f => f.Id == dto.SurveyFormId);

            if (form == null || !form.IsActive) return BadRequest(new { message = "ไม่พบแบบฟอร์มการตรวจหรือแบบฟอร์มถูกปิดการใช้งาน" });

            var (totalScore, maxScore, hasCriticalDefect, processedResponses, allItems) = ComputeScoring(form, dto.Responses);

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

                    // 🛡️ Check if this schedule has already been audited
                    if (await _context.AuditRecords.AnyAsync(r => r.AuditScheduleId == validScheduleId.Value))
                    {
                        return BadRequest(new { message = "รายการตรวจตามแผนนี้ได้รับการส่งผลประเมินเรียบร้อยแล้ว" });
                    }
                }
            }

            // 🛡️ Ensure valid LocationId (สิทธิ์ถูกตรวจแล้วด้านบน ห้าม fallback ไปสถานที่อื่น)
            var location = await _context.Locations
                .Include(l => l.LocationBrands)
                .FirstOrDefaultAsync(l => l.Id == dto.LocationId);
            if (location == null)
            {
                return BadRequest(new { message = "ไม่พบข้อมูลสาขาในระบบ" });
            }

            // 🛡️ Validate form compatibility with branch brand/location type/targeting

            if (form.LocationTypeId.HasValue && form.LocationTypeId.Value > 0 && form.LocationTypeId.Value != location.LocationTypeId)
            {
                return BadRequest(new { message = "แบบฟอร์มนี้ไม่ตรงกับประเภทสถานที่ของสาขานี้" });
            }

            if (string.Equals(form.TargetingMode, "SPECIFIC_LOCATIONS", StringComparison.OrdinalIgnoreCase) && form.TargetLocations.Any())
            {
                if (!form.TargetLocations.Any(tl => tl.LocationId == location.Id))
                {
                    return BadRequest(new { message = "แบบฟอร์มนี้ไม่ได้กำหนดให้ใช้กับสาขานี้" });
                }
            }

            var formBrandIds = form.FormBrands.Select(fb => fb.BrandId).ToList();
            if (form.BrandId.HasValue && !formBrandIds.Contains(form.BrandId.Value))
            {
                formBrandIds.Add(form.BrandId.Value);
            }

            if (formBrandIds.Any())
            {
                var locBrandIds = location.LocationBrands.Select(lb => lb.BrandId).ToList();
                if (!locBrandIds.Any(lbid => formBrandIds.Contains(lbid)))
                {
                    return BadRequest(new { message = "แบบฟอร์มนี้ใช้ได้เฉพาะแบรนด์ที่กำหนดไว้เท่านั้น" });
                }
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
                    IsBackdated = dto.IsBackdated,
                    StartedAt = dto.StartedAt ?? DateTime.UtcNow,
                    SubmittedAt = dto.SubmittedAt ?? DateTime.UtcNow
                };

                // Save Responses & Images + Auto-create CAP Tasks for failed items
                var capTasksToCreate = new List<CapTask>();

                foreach (var computedResp in processedResponses)
                {
                    allItems.TryGetValue(computedResp.SurveyItemId, out var item);
                    var catName = item?.CategoryName ?? item?.SurveySection?.Title ?? "ทั่วไป";
                    if (catName.Length > 100) catName = catName.Substring(0, 100);

                    var response = new AuditResponse
                    {
                        SurveyItemId = computedResp.SurveyItemId,
                        ScoreGiven = computedResp.ScoreGiven,
                        IsPassed = computedResp.IsPassed,
                        IsNa = computedResp.IsNa,
                        Notes = computedResp.Notes,
                        CategoryName = catName
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
                        var issueItem = item?.QuestionText ?? "ข้อบกพร่องมาตรฐาน";
                        var desc = !string.IsNullOrWhiteSpace(computedResp.Notes) ? computedResp.Notes : $"ไม่ผ่านเกณฑ์การประเมิน: {issueItem}";

                        capTasksToCreate.Add(new CapTask
                        {
                            AuditRecord = record,
                            AuditResponse = response,
                            LocationId = dto.LocationId,
                            CategoryName = catName,
                            IssueItem = issueItem.Length > 250 ? issueItem.Substring(0, 250) : issueItem,
                            Description = desc,
                            SubmissionDeadline = DateTime.UtcNow.AddDays(7),
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

                // Mark Schedule completed
                if (validScheduleId.HasValue)
                {
                    var schedule = await _context.AuditSchedules.FindAsync(validScheduleId.Value);
                    if (schedule != null)
                    {
                        schedule.Status = "completed";
                    }
                }

                // Delete Draft(s) specifically targeted
                if (dto.DraftId.HasValue && dto.DraftId.Value > 0)
                {
                    var targetDraft = await _context.AuditDrafts.FindAsync(dto.DraftId.Value);
                    if (targetDraft != null)
                    {
                        _context.AuditDrafts.Remove(targetDraft);
                    }
                }
                else if (validScheduleId.HasValue)
                {
                    var schedDrafts = await _context.AuditDrafts
                        .Where(d => d.AuditScheduleId == validScheduleId.Value)
                        .ToListAsync();
                    if (schedDrafts.Any())
                    {
                        _context.AuditDrafts.RemoveRange(schedDrafts);
                    }
                }
                else
                {
                    var adhocDrafts = await _context.AuditDrafts
                        .Where(d => d.LocationId == dto.LocationId && d.SurveyFormId == dto.SurveyFormId && d.AuditScheduleId == null && (d.AuditorId == primaryAuditorId || d.AuditorId == currentUserId))
                        .ToListAsync();
                    if (adhocDrafts.Any())
                    {
                        _context.AuditDrafts.RemoveRange(adhocDrafts);
                    }
                }

                await _context.SaveChangesAsync();
                await LocationStatsHelper.UpdateLocationLastAuditStatsAsync(_context, dto.LocationId);
                await _context.SaveChangesAsync();

                await transaction.CommitAsync();

                // 📡 Broadcast real-time event to clients: new audit completed!
                try
                {
                    await _hubContext.Clients.All.SendAsync("AuditCreated", new
                    {
                        auditRecordId = record.Id,
                        locationId = record.LocationId,
                        percentageScore = percentageScore,
                        isPassed = isOverallPassed,
                        auditDate = record.AuditDate
                    });
                }
                catch (Exception hubEx)
                {
                    _logger.LogWarning(hubEx, "Failed to broadcast AuditCreated SignalR event");
                }

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
                _logger.LogError(ex, "Error saving audit result");
                return StatusCode(500, new { message = "เกิดข้อผิดพลาดในการบันทึกผลตรวจ กรุณาลองใหม่อีกครั้ง" });
            }
        }

        // ==========================================
        // 4. AUDIT HISTORY & DETAILS
        // ==========================================
        [HttpGet("records")]
        [HttpGet]
        public async Task<IActionResult> GetAuditRecords(
            [FromQuery] int? locationId,
            [FromQuery] int? auditorId,
            [FromQuery] int? limit,
            [FromQuery] int? brandId,
            [FromQuery] int? page,
            [FromQuery] int? pageSize,
            [FromQuery] DateTime? startDate,
            [FromQuery] DateTime? endDate)
        {
            var (currentUserId, role, allowedLocationIds) = await UserScopeHelper.GetUserScopeAsync(User, _context);
            var (_, _, allowedBrandIds) = await UserScopeHelper.GetUserBrandScopeAsync(User, _context);

            var query = _context.AuditRecords
                .AsNoTracking()
                .Include(r => r.Location)
                    .ThenInclude(l => l!.LocationBrands)
                        .ThenInclude(lb => lb.Brand)
                .Include(r => r.SurveyForm)
                .Include(r => r.PrimaryAuditor)
                .Include(r => r.AuditeeUser)
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

            if (allowedBrandIds != null)
            {
                query = query.Where(r => r.Location != null &&
                    r.Location.LocationBrands.Any(lb => allowedBrandIds.Contains(lb.BrandId)));
            }

            if (locationId.HasValue)
            {
                if (allowedLocationIds != null && !allowedLocationIds.Contains(locationId.Value))
                {
                    return Ok(new List<object>());
                }
                if (allowedBrandIds != null)
                {
                    var canAccessRequestedLocation = await _context.Locations.AnyAsync(location =>
                        location.Id == locationId.Value &&
                        location.LocationBrands.Any(lb => allowedBrandIds.Contains(lb.BrandId)));
                    if (!canAccessRequestedLocation) return Ok(new List<object>());
                }
                query = query.Where(r => r.LocationId == locationId.Value);
            }

            if (brandId.HasValue)
            {
                if (allowedBrandIds != null && !allowedBrandIds.Contains(brandId.Value))
                {
                    return Ok(new List<object>());
                }
                query = query.Where(r => r.Location != null &&
                    r.Location.LocationBrands.Any(lb => lb.BrandId == brandId.Value));
            }

            if (auditorId.HasValue) query = query.Where(r => r.PrimaryAuditorId == auditorId.Value);

            // 🌟 ค้นหาตามช่วงวันที่ (ใช้เมื่อผู้ใช้พิมพ์เดือน/ปีในช่องค้นหา เช่น "มี.ค 2568")
            // startDate รวม, endDate ไม่รวม (exclusive upper bound) — ยิงตรงไป DB ด้วย index บน AuditDate
            // ไม่ผ่าน buffer ฝั่ง client เลย เพราะเป็นคนละ path กับการ browse ปกติ
            if (startDate.HasValue)
            {
                query = query.Where(r => r.AuditDate >= startDate.Value);
            }
            if (endDate.HasValue)
            {
                query = query.Where(r => r.AuditDate < endDate.Value);
            }

            query = query.OrderByDescending(r => r.AuditDate);

            // 🚀 Pagination support: If page or pageSize is specified, apply pagination
            int totalCount = 0;
            if (page.HasValue || pageSize.HasValue)
            {
                totalCount = await query.CountAsync();
                int currentPage = Math.Max(1, page ?? 1);
                int currentPageSize = Math.Clamp(pageSize ?? 50, 1, 100);
                query = query.Skip((currentPage - 1) * currentPageSize).Take(currentPageSize);
            }
            else if (limit.HasValue)
            {
                query = query.Take(Math.Clamp(limit.Value, 1, 500));
            }
            else
            {
                // Default safety ceiling: prevent dumping endless records in one single request
                query = query.Take(300);
            }

            var records = await query.ToListAsync();

            var result = records.Select(r => new
            {
                id = r.Id,
                locationId = r.LocationId,
                locationCode = r.Location?.Code,
                locationName = r.Location?.Name,
                locationRegion = r.Location?.Region,
                locationBrand = r.Location?.LocationBrands != null && r.Location.LocationBrands.Any()
                    ? string.Join(", ", r.Location.LocationBrands.Select(lb => lb.Brand.Name).Where(n => !string.IsNullOrWhiteSpace(n)))
                    : "-",
                locationBrands = r.Location?.LocationBrands
                    .OrderBy(lb => lb.Brand.Name)
                    .Select(lb => new
                    {
                        id = lb.BrandId,
                        name = lb.Brand.Name
                    })
                    .ToList(),
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
                isBackdated = r.IsBackdated
            });

            // 🚀 When paginated (page/pageSize provided), wrap with totalCount so the
            // frontend can drive "load more" / page indicators correctly.
            if (page.HasValue || pageSize.HasValue)
            {
                return Ok(new
                {
                    items = result,
                    totalCount,
                    page = Math.Max(1, page ?? 1),
                    pageSize = Math.Clamp(pageSize ?? 50, 1, 100)
                });
            }

            return Ok(result);
        }

        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetAuditDetail(int id)
        {
            var (currentUserId, role, allowedLocationIds) = await UserScopeHelper.GetUserScopeAsync(User, _context);
            var (_, _, allowedBrandIds) = await UserScopeHelper.GetUserBrandScopeAsync(User, _context);

            var record = await _context.AuditRecords
                .AsNoTracking()
                .Include(r => r.Location)
                    .ThenInclude(l => l!.LocationBrands)
                        .ThenInclude(lb => lb.Brand)
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

            if (allowedBrandIds != null &&
                (record.Location == null ||
                 !record.Location.LocationBrands.Any(lb => allowedBrandIds.Contains(lb.BrandId))))
            {
                return Forbid();
            }

            var r = record;
            var result = new
            {
                id = r.Id,
                locationId = r.LocationId,
                locationCode = r.Location?.Code,
                locationName = r.Location?.Name,
                locationRegion = r.Location?.Region,
                locationBrand = r.Location?.LocationBrands != null && r.Location.LocationBrands.Any()
                    ? string.Join(", ", r.Location.LocationBrands.Select(lb => lb.Brand.Name).Where(n => !string.IsNullOrWhiteSpace(n)))
                    : "-",
                locationBrands = r.Location?.LocationBrands
                    .OrderBy(lb => lb.Brand.Name)
                    .Select(lb => new
                    {
                        id = lb.BrandId,
                        name = lb.Brand.Name
                    })
                    .ToList(),
                location = r.Location,
                surveyForm = r.SurveyForm,
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
                isBackdated = r.IsBackdated,
                responses = r.Responses?
                    .OrderBy(res => res.SurveyItem?.SurveySection?.OrderIndex ?? 0)
                    .ThenBy(res => res.SurveyItem?.OrderIndex ?? 0)
                    .Select(res => new
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
                        categoryName = res.CategoryName ?? res.SurveyItem?.CategoryName ?? res.SurveyItem?.SurveySection?.Title ?? "ทั่วไป",
                        surveyItem = res.SurveyItem,
                        images = res.Images?.Select(img => new
                        {
                            id = img.Id,
                            imageUrl = img.ImageUrl,
                            uploadedAt = img.UploadedAt
                        }).ToList()
                    }).ToList()
            };

            return Ok(result);
        }

        // ==========================================
        // 5. EDIT AUDIT RECORD (ต้องมีสิทธิ์ audit.edit + ระบุเหตุผลเสมอ ไม่จำกัดเวลา)
        // ==========================================
        public class UpdateAuditRecordDto
        {
            // เหตุผลการแก้ไข — บังคับกรอกทุกครั้ง ไม่งั้นแก้ไม่ได้
            public string Reason { get; set; } = string.Empty;

            public int? AuditeeUserId { get; set; }
            public string? AuditeeNameText { get; set; }
            public int StaffCount { get; set; } = 0;
            public string AuditType { get; set; } = "announced";
            public string? Notes { get; set; }
            public string? MetadataValuesJson { get; set; }

            // Start & End times
            public DateTime? StartedAt { get; set; }
            public DateTime? SubmittedAt { get; set; }
            public DateTime? AuditDate { get; set; }

            // Signatures
            public string? AuditorSignatureUrl { get; set; }
            public string? AuditeeSignatureUrl { get; set; }

            // GPS Coordinates
            public double? StartLatitude { get; set; }
            public double? StartLongitude { get; set; }
            public double? EndLatitude { get; set; }
            public double? EndLongitude { get; set; }

            // แก้คำตอบทั้งชุดใหม่ (คะแนนคำนวณฝั่ง server ใหม่ทั้งหมดเหมือนตอนส่งครั้งแรก)
            public List<ResponseSubmitDto> Responses { get; set; } = new();
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateAuditRecord(int id, [FromBody] UpdateAuditRecordDto dto)
        {
            var (currentUserId, role, allowedLocationIds) = await UserScopeHelper.GetUserScopeAsync(User, _context);
            var (_, _, allowedBrandIds) = await UserScopeHelper.GetUserBrandScopeAsync(User, _context);

            // 1) สิทธิ์ audit.edit ต้องผูกกับ role แบบ dynamic ผ่านตาราง RolePermission
            //    (ไม่ hardcode [Authorize(Roles=...)] เพื่อให้ Admin ไปเปิด/ปิดให้ role ไหนก็ได้จากหน้า "บทบาทและสิทธิ์")
            var hasEditPermission = await _context.RolePermissions
                .Include(rp => rp.Role)
                .Include(rp => rp.Permission)
                .AnyAsync(rp => rp.Role!.Code == role && rp.Permission!.Code == "audit.edit");
            if (!hasEditPermission) return Forbid();

            // 2) บังคับกรอกเหตุผลเสมอ — ไม่มีเหตุผล = แก้ไม่ได้ (ไม่จำกัดเวลาที่แก้ไขได้)
            if (string.IsNullOrWhiteSpace(dto.Reason))
            {
                return BadRequest(new { message = "กรุณาระบุเหตุผลในการแก้ไขบันทึกทุกครั้ง" });
            }

            var record = await _context.AuditRecords
                .Include(r => r.Location)
                    .ThenInclude(l => l!.LocationBrands)
                .Include(r => r.SurveyForm)
                .Include(r => r.Responses)
                    .ThenInclude(res => res.Images)
                .FirstOrDefaultAsync(r => r.Id == id);

            if (record == null) return NotFound();

            // 3) เช็ค location/brand scope ตาม pattern เดียวกับ endpoint อื่นในระบบ
            if (allowedLocationIds != null && !allowedLocationIds.Contains(record.LocationId))
            {
                return Forbid();
            }

            if (allowedBrandIds != null &&
                (record.Location == null ||
                 !record.Location.LocationBrands.Any(lb => allowedBrandIds.Contains(lb.BrandId))))
            {
                return Forbid();
            }

            var form = await _context.SurveyForms
                .Include(f => f.Sections)
                    .ThenInclude(s => s.Items)
                .FirstOrDefaultAsync(f => f.Id == record.SurveyFormId);

            if (form == null) return NotFound(new { message = "ไม่พบแบบฟอร์มการตรวจที่ผูกกับบันทึกนี้" });

            // 4) คำนวณคะแนนใหม่ทั้งชุดฝั่ง server (ใช้ helper เดียวกับตอนส่งครั้งแรก — ห้ามเชื่อคะแนนจาก client)
            var (totalScore, maxScore, hasCriticalDefect, processedResponses, allItems) = ComputeScoring(form, dto.Responses);
            double percentageScore = (maxScore > 0) ? Math.Round((totalScore / maxScore) * 100.0, 1) : 100.0;
            bool isOverallPassed = (percentageScore >= form.PassingScore) && (!hasCriticalDefect);

            // 1. เก็บคำตอบและข้อมูลเดิมไว้ทำ Item-Level Diff ก่อนเคลียร์
            var previousResponsesList = record.Responses.Select(r =>
            {
                allItems.TryGetValue(r.SurveyItemId, out var matchedItem);
                return new
                {
                    r.SurveyItemId,
                    QuestionText = r.SurveyItem?.QuestionText ?? matchedItem?.QuestionText ?? $"ข้อที่ {r.SurveyItemId}",
                    SectionTitle = r.SurveyItem?.SurveySection?.Title ?? matchedItem?.SurveySection?.Title ?? "รายการตรวจ",
                    r.IsPassed,
                    r.ScoreGiven,
                    r.IsNa,
                    Notes = r.Notes ?? "",
                    ImageUrls = r.Images.Select(img => img.ImageUrl).ToList()
                };
            }).ToList();

            // 2. คำนวณความต่างรายข้อ (Item-level diff)
            var changedItems = new List<object>();
            foreach (var computedResp in processedResponses)
            {
                var prev = previousResponsesList.FirstOrDefault(p => p.SurveyItemId == computedResp.SurveyItemId);
                var currentNotes = computedResp.Notes ?? "";
                var currentImages = computedResp.ImageUrls ?? new List<string>();

                bool isScoreDiff = prev == null || prev.IsPassed != computedResp.IsPassed || prev.ScoreGiven != computedResp.ScoreGiven || prev.IsNa != computedResp.IsNa;
                bool isNoteDiff = prev == null ? !string.IsNullOrWhiteSpace(currentNotes) : prev.Notes.Trim() != currentNotes.Trim();
                bool isImageDiff = prev == null ? currentImages.Any() : (prev.ImageUrls.Count != currentImages.Count || prev.ImageUrls.Except(currentImages).Any());

                if (isScoreDiff || isNoteDiff || isImageDiff)
                {
                    allItems.TryGetValue(computedResp.SurveyItemId, out var itemMeta);
                    changedItems.Add(new
                    {
                        surveyItemId = computedResp.SurveyItemId,
                        questionText = prev?.QuestionText ?? itemMeta?.QuestionText ?? $"ข้อที่ {computedResp.SurveyItemId}",
                        sectionTitle = prev?.SectionTitle ?? itemMeta?.SurveySection?.Title ?? "รายการตรวจ",
                        before = prev != null ? new
                        {
                            isPassed = prev.IsPassed,
                            scoreGiven = prev.ScoreGiven,
                            isNa = prev.IsNa,
                            notes = prev.Notes,
                            imageUrls = prev.ImageUrls
                        } : null,
                        after = new
                        {
                            isPassed = computedResp.IsPassed,
                            scoreGiven = computedResp.ScoreGiven,
                            isNa = computedResp.IsNa,
                            notes = currentNotes,
                            imageUrls = currentImages
                        }
                    });
                }
            }

            // 3. เก็บ Overview ก่อนและหลังแก้
            var beforeOverview = new
            {
                totalScore = record.TotalScore,
                maxScore = record.MaxScore,
                percentageScore = record.PercentageScore,
                isPassed = record.IsPassed,
                hasCriticalDefect = record.HasCriticalDefect,
                auditType = record.AuditType,
                notes = record.Notes,
                startedAt = record.StartedAt,
                submittedAt = record.SubmittedAt,
                startLatitude = record.StartLatitude,
                startLongitude = record.StartLongitude,
                endLatitude = record.EndLatitude,
                endLongitude = record.EndLongitude
            };

            var afterOverview = new
            {
                totalScore,
                maxScore,
                percentageScore,
                isPassed = isOverallPassed,
                hasCriticalDefect,
                auditType = dto.AuditType,
                notes = dto.Notes,
                startedAt = dto.StartedAt,
                submittedAt = dto.SubmittedAt,
                startLatitude = dto.StartLatitude,
                startLongitude = dto.StartLongitude,
                endLatitude = dto.EndLatitude,
                endLongitude = dto.EndLongitude
            };

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // 🛡️ Validate AuditeeUserId ถ้าส่งมา
                int? validAuditeeUserId = null;
                if (dto.AuditeeUserId.HasValue && dto.AuditeeUserId.Value > 0 &&
                    await _context.Users.AnyAsync(u => u.Id == dto.AuditeeUserId.Value))
                {
                    validAuditeeUserId = dto.AuditeeUserId.Value;
                }

                // อัปเดตค่าหลักของ record
                record.AuditeeUserId = validAuditeeUserId;
                if (dto.AuditeeNameText != null) record.AuditeeNameText = dto.AuditeeNameText;
                record.AuditType = dto.AuditType;
                record.Notes = dto.Notes;
                record.MetadataValuesJson = dto.MetadataValuesJson;

                // เวลาเริ่ม-สิ้นสุด
                if (dto.StartedAt.HasValue) record.StartedAt = dto.StartedAt.Value;
                if (dto.SubmittedAt.HasValue) record.SubmittedAt = dto.SubmittedAt.Value;
                if (dto.AuditDate.HasValue) record.AuditDate = dto.AuditDate.Value;

                // ลายเซ็น
                if (!string.IsNullOrWhiteSpace(dto.AuditorSignatureUrl))
                {
                    record.AuditorSignatureUrl = await SaveBase64IfPresentAsync(dto.AuditorSignatureUrl, "signatures", "sig_auditor");
                }
                if (!string.IsNullOrWhiteSpace(dto.AuditeeSignatureUrl))
                {
                    record.AuditeeSignatureUrl = await SaveBase64IfPresentAsync(dto.AuditeeSignatureUrl, "signatures", "sig_auditee");
                }

                // พิกัดสถานที่
                if (dto.StartLatitude.HasValue) record.StartLatitude = dto.StartLatitude.Value;
                if (dto.StartLongitude.HasValue) record.StartLongitude = dto.StartLongitude.Value;
                if (dto.EndLatitude.HasValue) record.EndLatitude = dto.EndLatitude.Value;
                if (dto.EndLongitude.HasValue) record.EndLongitude = dto.EndLongitude.Value;

                record.TotalScore = totalScore;
                record.MaxScore = maxScore;
                record.PercentageScore = percentageScore;
                record.IsPassed = isOverallPassed;
                record.HasCriticalDefect = hasCriticalDefect;

                // ลบคำตอบเดิมทั้งหมดแล้วสร้างใหม่ตามชุดที่แก้ (ง่ายและชัวร์กว่าการไล่ diff ทีละข้อ)
                _context.AuditResponses.RemoveRange(record.Responses);
                record.Responses.Clear();

                foreach (var computedResp in processedResponses)
                {
                    allItems.TryGetValue(computedResp.SurveyItemId, out var itemMeta);
                    var catName = itemMeta?.CategoryName ?? itemMeta?.SurveySection?.Title ?? "ทั่วไป";
                    if (catName.Length > 100) catName = catName.Substring(0, 100);

                    var response = new AuditResponse
                    {
                        SurveyItemId = computedResp.SurveyItemId,
                        ScoreGiven = computedResp.ScoreGiven,
                        IsPassed = computedResp.IsPassed,
                        IsNa = computedResp.IsNa,
                        Notes = computedResp.Notes,
                        CategoryName = catName
                    };

                    if (computedResp.ImageUrls != null && computedResp.ImageUrls.Any())
                    {
                        foreach (var imgUrl in computedResp.ImageUrls)
                        {
                            var savedImgUrl = await SaveBase64IfPresentAsync(imgUrl, "audit_images", "audit");
                            response.Images.Add(new AuditResponseImage
                            {
                                ImageUrl = savedImgUrl,
                                UploadedBy = currentUserId,
                                UploadedAt = DateTime.UtcNow
                            });
                        }
                    }
                    record.Responses.Add(response);
                }

                _context.AuditRecordEditLogs.Add(new AuditRecordEditLog
                {
                    AuditRecordId = record.Id,
                    EditedByUserId = currentUserId,
                    EditedAt = DateTime.UtcNow,
                    Reason = dto.Reason.Trim(),
                    ChangesSummaryJson = System.Text.Json.JsonSerializer.Serialize(new
                    {
                        before = beforeOverview,
                        after = afterOverview,
                        changedItemsCount = changedItems.Count,
                        changedItems
                    })
                });

                await _context.SaveChangesAsync();
                await LocationStatsHelper.UpdateLocationLastAuditStatsAsync(_context, record.LocationId);
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new
                {
                    auditRecordId = record.Id,
                    totalScore,
                    maxScore,
                    percentageScore,
                    isPassed = isOverallPassed,
                    hasCriticalDefect,
                    message = "แก้ไขบันทึกการตรวจสำเร็จ บันทึกเหตุผลไว้ในประวัติแล้ว"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Error editing audit record");
                return StatusCode(500, new { message = "เกิดข้อผิดพลาดในการแก้ไขบันทึกการตรวจ กรุณาลองใหม่อีกครั้ง" });
            }
        }

        // ดูประวัติการแก้ไขทั้งหมดของบันทึกตรวจ 1 รายการ (เรียงล่าสุดก่อน)
        [HttpGet("{id:int}/edit-logs")]
        public async Task<IActionResult> GetAuditEditLogs(int id)
        {
            var (_, role, allowedLocationIds) = await UserScopeHelper.GetUserScopeAsync(User, _context);
            var (_, _, allowedBrandIds) = await UserScopeHelper.GetUserBrandScopeAsync(User, _context);

            var record = await _context.AuditRecords
                .AsNoTracking()
                .Include(r => r.Location)
                    .ThenInclude(l => l!.LocationBrands)
                .FirstOrDefaultAsync(r => r.Id == id);

            if (record == null) return NotFound();

            if (allowedLocationIds != null && !allowedLocationIds.Contains(record.LocationId)) return Forbid();
            if (allowedBrandIds != null &&
                (record.Location == null || !record.Location.LocationBrands.Any(lb => allowedBrandIds.Contains(lb.BrandId))))
            {
                return Forbid();
            }

            var logs = await _context.AuditRecordEditLogs
                .AsNoTracking()
                .Include(l => l.EditedByUser)
                .Where(l => l.AuditRecordId == id)
                .OrderByDescending(l => l.EditedAt)
                .Select(l => new
                {
                    l.Id,
                    l.EditedAt,
                    l.Reason,
                    editedByName = l.EditedByUser != null ? l.EditedByUser.FullName : "ผู้ใช้งาน",
                    l.ChangesSummaryJson
                })
                .ToListAsync();

            return Ok(logs);
        }

        // ==========================================
        // ลบผลตรวจ + คืนค่าสถิติสาขากลับอัตโนมัติ
        // ==========================================
        [Authorize]
        [HttpDelete("{id:int}")]
        public async Task<IActionResult> DeleteAuditRecord(int id)
        {
            var (currentUserId, role, allowedLocationIds) = await UserScopeHelper.GetUserScopeAsync(User, _context);
            var (_, _, allowedBrandIds) = await UserScopeHelper.GetUserBrandScopeAsync(User, _context);

            var hasDeletePermission = role == "ADMIN" || await _context.RolePermissions
                .Include(rp => rp.Role)
                .Include(rp => rp.Permission)
                .AnyAsync(rp => rp.Role!.Code == role && rp.Permission!.Code == "audit.delete");

            if (!hasDeletePermission) return Forbid();

            var record = await _context.AuditRecords
                .Include(r => r.Location).ThenInclude(l => l!.LocationBrands)
                .Include(r => r.Responses).ThenInclude(res => res.Images)
                .FirstOrDefaultAsync(r => r.Id == id);

            if (record == null) return NotFound();
            if (allowedLocationIds != null && !allowedLocationIds.Contains(record.LocationId)) return Forbid();
            if (allowedBrandIds != null && (record.Location == null || !record.Location.LocationBrands.Any(lb => allowedBrandIds.Contains(lb.BrandId)))) return Forbid();

            int locationId = record.LocationId;

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var linkedCaps = await _context.CapTasks
                    .Where(c => c.AuditRecordId == id || record.Responses.Select(res => res.Id).Contains(c.AuditResponseId ?? 0))
                    .ToListAsync();

                foreach (var cap in linkedCaps)
                {
                    cap.AuditRecordId = null;
                    cap.AuditResponseId = null;
                }

                var logs = await _context.AuditRecordEditLogs.Where(l => l.AuditRecordId == id).ToListAsync();
                _context.AuditRecordEditLogs.RemoveRange(logs);

                _context.AuditRecords.Remove(record);
                await _context.SaveChangesAsync();

                // อัปเดตสถิติสาขากลับเป็นคะแนนของผลตรวจก่อนหน้า
                await LocationStatsHelper.UpdateLocationLastAuditStatsAsync(_context, locationId);
                await _context.SaveChangesAsync();

                await transaction.CommitAsync();
                return Ok(new { message = "ลบผลตรวจและคำนวณคะแนนล่าสุดของสาขาใหม่เรียบร้อยแล้ว" });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Error deleting audit record {Id}", id);
                return StatusCode(500, new { message = "เกิดข้อผิดพลาดในการลบผลตรวจ" });
            }
        }
    }
}