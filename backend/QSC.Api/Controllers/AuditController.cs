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
        private readonly IConfiguration _config;

        public AuditController(AppDbContext context, IWebHostEnvironment env, ILogger<AuditController> logger, IHubContext<CapChatHub> hubContext, IConfiguration config)
        {
            _context = context;
            _env = env;
            _logger = logger;
            _hubContext = hubContext;
            _config = config;
        }

        private static bool IsValidImageSignature(byte[] bytes)
        {
            return UploadHelper.IsValidImageSignature(bytes, out _);
        }

        private Task<string> SaveBase64IfPresentAsync(string? input, string subfolder, string prefix, long maxSizeBytes = 10 * 1024 * 1024)
        {
            return UploadHelper.SaveBase64IfPresentAsync(_env, input, subfolder, prefix, maxSizeBytes);
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

            // 🛡️ Auto-clean and exclude drafts whose schedule is already completed or audited
            var completedOrAuditedScheduleIds = await _context.AuditSchedules
                .Where(s => s.Status == "completed")
                .Select(s => s.Id)
                .ToListAsync();

            var auditRecordScheduleIds = await _context.AuditRecords
                .Where(r => r.AuditScheduleId.HasValue)
                .Select(r => r.AuditScheduleId!.Value)
                .ToListAsync();

            var excludeScheduleIds = completedOrAuditedScheduleIds.Union(auditRecordScheduleIds).ToHashSet();

            var staleDrafts = allDrafts.Where(d => d.AuditScheduleId.HasValue && excludeScheduleIds.Contains(d.AuditScheduleId.Value)).ToList();
            if (staleDrafts.Any())
            {
                _context.AuditDrafts.RemoveRange(staleDrafts);
                await _context.SaveChangesAsync();
                allDrafts = allDrafts.Except(staleDrafts).ToList();
            }

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
            try
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

                // 🔒 IDOR FIX: dto.AuditorId came straight from the client with no ownership check
                int effectiveAuditorId = (role == "ADMIN" && dto.AuditorId > 0) ? dto.AuditorId : currentUserId;
                if (effectiveAuditorId <= 0 || !await _context.Users.AnyAsync(u => u.Id == effectiveAuditorId))
                {
                    return BadRequest(new { message = "ไม่พบข้อมูลผู้ตรวจในระบบ กรุณาระบุผู้ตรวจที่ถูกต้อง" });
                }

                // Ensure valid SurveyFormId (H2: ห้าม fallback สุ่มผูกฟอร์มอื่น หากฟอร์มไม่ถูกต้องให้แจ้งเตือนทันที)
                int effectiveFormId = dto.SurveyFormId;
                if (effectiveFormId <= 0 || !await _context.SurveyForms.AnyAsync(f => f.Id == effectiveFormId))
                {
                    return BadRequest(new { message = "แบบฟอร์มการตรวจไม่ถูกต้องหรือไม่พบในระบบ" });
                }

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

                // 2.1 M1: If ad-hoc audit (no schedule), match existing active draft for this auditor + location + form
                // เพื่อป้องกันการสร้างดราฟต์ซ้ำซ้อนกรณี client ส่ง auto-save ติดๆ กันก่อนได้ id กลับไป
                if (draft == null && !effectiveScheduleId.HasValue)
                {
                    draft = await _context.AuditDrafts
                        .Where(d => d.LocationId == dto.LocationId && d.SurveyFormId == effectiveFormId && d.AuditorId == effectiveAuditorId && d.AuditScheduleId == null)
                        .OrderByDescending(d => d.UpdatedAt)
                        .FirstOrDefaultAsync();
                }

                // 🔒 IDOR FIX: an existing draft found by id (or by schedule) was updated with zero
                // ownership check beyond location scope
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
                        SurveyFormId = effectiveFormId,
                        AuditorId = effectiveAuditorId,
                        AuditScheduleId = effectiveScheduleId,
                        DraftPayloadJson = dto.DraftPayloadJson ?? "{}",
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
                    draft.SurveyFormId = effectiveFormId;
                    draft.AuditScheduleId = effectiveScheduleId ?? draft.AuditScheduleId;
                    draft.DraftPayloadJson = dto.DraftPayloadJson ?? "{}";
                    draft.CurrentSectionIdx = dto.CurrentSectionIdx;
                    draft.TotalAnswered = dto.TotalAnswered;
                    draft.TotalQuestions = dto.TotalQuestions;
                    if (!draft.StartLatitude.HasValue && dto.StartLatitude.HasValue)
                    {
                        draft.StartLatitude = dto.StartLatitude;
                        draft.StartLongitude = dto.StartLongitude;
                    }
                    if (!draft.StartedAt.HasValue)
                    {
                        draft.StartedAt = dto.StartedAt ?? DateTime.UtcNow;
                    }
                    draft.UpdatedAt = DateTime.UtcNow;
                }

                const int maxRetries = 3;
                for (int attempt = 1; attempt <= maxRetries; attempt++)
                {
                    try
                    {
                        await _context.SaveChangesAsync();
                        break;
                    }
                    catch (DbUpdateConcurrencyException ex)
                    {
                        if (attempt >= maxRetries)
                        {
                            _logger.LogWarning(ex, "Concurrency conflict saving draft {DraftId} after {Retries} retries - latest state preserved in DB", draft?.Id, maxRetries);
                            break;
                        }

                        _logger.LogInformation("Concurrency conflict saving draft {DraftId}. Resolving and retrying attempt {Attempt}...", draft?.Id, attempt);
                        foreach (var entry in ex.Entries)
                        {
                            var databaseValues = await entry.GetDatabaseValuesAsync();
                            if (databaseValues == null)
                            {
                                break;
                            }
                            entry.OriginalValues.SetValues(databaseValues);
                        }
                    }
                }

                return Ok(draft);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving audit draft: {Message} Inner: {Inner}", ex.Message, ex.InnerException?.Message);
                return StatusCode(500, new { 
                    message = "เกิดข้อผิดพลาดในการบันทึกแบบร่าง กรุณาลองใหม่อีกครั้ง",
                    error = ex.Message,
                    details = ex.InnerException?.Message
                });
            }
        }

        [Authorize(Roles = "ADMIN,AUDITOR,STANDARD")]
        [HttpDelete("draft")]
        public async Task<IActionResult> DiscardDraft([FromQuery] int? id, [FromQuery] int? locationId, [FromQuery] int? surveyFormId, [FromQuery] int? auditorId, [FromQuery] int? scheduleId)
        {
            var (currentUserId, role, allowedLocationIds) = await UserScopeHelper.GetUserScopeAsync(User, _context);

            var draftsToDelete = new List<AuditDraft>();

            // 1. By specific Draft ID (Most specific - ONLY delete this targeted draft)
            if (id.HasValue && id.Value > 0)
            {
                var specificDraft = await _context.AuditDrafts.FindAsync(id.Value);
                if (specificDraft != null)
                {
                    if (role == "ADMIN" || specificDraft.AuditorId == currentUserId || (allowedLocationIds != null && allowedLocationIds.Contains(specificDraft.LocationId)))
                    {
                        draftsToDelete.Add(specificDraft);
                    }
                }
            }
            // 2. By Schedule ID (Only if no specific draft ID was passed)
            else if (scheduleId.HasValue && scheduleId.Value > 0)
            {
                var schedDrafts = await _context.AuditDrafts
                    .Where(d => d.AuditScheduleId == scheduleId.Value)
                    .ToListAsync();
                draftsToDelete.AddRange(schedDrafts);
            }
            // 3. By Location ID & Form ID for this specific auditor (Only if neither ID nor Schedule ID was passed)
            else if (locationId.HasValue && locationId.Value > 0)
            {
                var locQuery = _context.AuditDrafts.Where(d => d.LocationId == locationId.Value);

                if (surveyFormId.HasValue && surveyFormId.Value > 0)
                {
                    locQuery = locQuery.Where(d => d.SurveyFormId == surveyFormId.Value);
                }

                int effectiveAuditorId = (role == "ADMIN" && auditorId.HasValue && auditorId.Value > 0)
                    ? auditorId.Value
                    : currentUserId;

                locQuery = locQuery.Where(d => d.AuditorId == effectiveAuditorId && d.AuditScheduleId == null);

                if (allowedLocationIds != null)
                {
                    locQuery = locQuery.Where(d => allowedLocationIds.Contains(d.LocationId));
                }

                // 🎯 Safety: ลบเฉพาะแบบร่างล่าสุด 1 รายการของรอบตรวจปัจจุบันเท่านั้น ไม่แตะต้องประวัติหรือดราฟต์เก่า
                var latestDraft = await locQuery.OrderByDescending(d => d.UpdatedAt).FirstOrDefaultAsync();
                if (latestDraft != null)
                {
                    draftsToDelete.Add(latestDraft);
                }
            }

            // Deduplicate
            var uniqueDrafts = draftsToDelete.GroupBy(d => d.Id).Select(g => g.First()).ToList();
            if (uniqueDrafts.Any())
            {
                // Revert any related in_progress schedule back to pending
                foreach (var d in uniqueDrafts)
                {
                    if (d.AuditScheduleId.HasValue)
                    {
                        var sched = await _context.AuditSchedules.FindAsync(d.AuditScheduleId.Value);
                        if (sched != null && sched.Status == "in_progress")
                        {
                            sched.Status = "pending";
                        }
                    }
                }

                _context.AuditDrafts.RemoveRange(uniqueDrafts);
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
            else if (locationId.HasValue && locationId.Value > 0)
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
            public int? ScheduleId { get; set; }
            public string? LocationCode { get; set; }
            public int? SurveyItemId { get; set; }
            public int? CapTaskId { get; set; }
            public string? SignatoryType { get; set; }
            public string? Prefix { get; set; }
        }

        [HttpPost("upload-image")]
        public async Task<IActionResult> UploadImage([FromBody] Base64UploadDto dto)
        {
            if (string.IsNullOrEmpty(dto.Base64Data)) return BadRequest(new { message = "กรุณาแนบข้อมูลรูปภาพ" });

            // Clean previous image if exists
            if (!string.IsNullOrWhiteSpace(dto.PreviousUrl) && dto.PreviousUrl.StartsWith("/uploads/"))
            {
                try
                {
                    var uploadsRoot = UploadHelper.GetUploadsRootPath(_env, _config);
                    var relPath = dto.PreviousUrl.Substring("/uploads/".Length).Replace('/', Path.DirectorySeparatorChar);
                    var oldFile = Path.Combine(uploadsRoot, relPath);
                    if (System.IO.File.Exists(oldFile)) System.IO.File.Delete(oldFile);
                }
                catch { }
            }

            try
            {
                var relativeUrl = await UploadHelper.SaveAuditItemPhotoAsync(
                    _env, _config, dto.Base64Data, dto.ScheduleId, dto.LocationCode, dto.SurveyItemId, 10 * 1024 * 1024);
                return Ok(new { url = relativeUrl });
            }
            catch (InvalidImageUploadException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error uploading audit image");
                return StatusCode(500, new { message = "เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ กรุณาลองใหม่อีกครั้ง" });
            }
        }

        [HttpPost("upload-signature")]
        public async Task<IActionResult> UploadSignature([FromBody] Base64UploadDto dto)
        {
            if (string.IsNullOrEmpty(dto.Base64Data)) return BadRequest(new { message = "กรุณาแนบข้อมูลลายเซ็น" });

            // Clean previous signature file to prevent disk clutter
            if (!string.IsNullOrWhiteSpace(dto.PreviousUrl) && dto.PreviousUrl.StartsWith("/uploads/"))
            {
                try
                {
                    var uploadsRoot = UploadHelper.GetUploadsRootPath(_env, _config);
                    var relPath = dto.PreviousUrl.Substring("/uploads/".Length).Replace('/', Path.DirectorySeparatorChar);
                    var oldFile = Path.Combine(uploadsRoot, relPath);
                    if (System.IO.File.Exists(oldFile)) System.IO.File.Delete(oldFile);
                }
                catch { }
            }

            try
            {
                var relativeUrl = await UploadHelper.SaveSignaturePhotoAsync(
                    _env, _config, dto.Base64Data, dto.ScheduleId, dto.LocationCode, dto.SignatoryType ?? "auditor", 2 * 1024 * 1024);
                return Ok(new { url = relativeUrl });
            }
            catch (InvalidImageUploadException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error uploading signature");
                return StatusCode(500, new { message = "เกิดข้อผิดพลาดในการอัปโหลดลายเซ็น กรุณาลองใหม่อีกครั้ง" });
            }
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
            public DateTime? AuditDate { get; set; }
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
            public double MaxScore { get; set; } // คะแนนเต็มที่ใช้คิดข้อนี้ → AuditResponse.MaxScore
            public bool IsPassed { get; set; }
            public bool IsNa { get; set; }
            public string? Notes { get; set; }
            public List<string> ImageUrls { get; set; } = new();
        }

        private static string NormalizeAuditType(string? input)
        {
            if (string.IsNullOrWhiteSpace(input)) return "announced";
            var at = input.Trim().ToLowerInvariant();
            if (at.Contains("spot") || at.Contains("unannounced") || at.Contains("นอกกำหนดการ")) return "spot";
            if (at.Contains("undercover") || at.Contains("ปลอมตัว") || at.Contains("ไม่เปิดเผยตัว")) return "undercover";
            if (at.Contains("announced") || at.Contains("ตามกำหนดการ")) return "announced";
            return input.Trim().Length > 20 ? input.Trim().Substring(0, 20) : input.Trim();
        }

        // 🌟 คำนวณคะแนนฝั่ง Server เสมอ (ห้ามเชื่อคะแนนจาก client) — ใช้ร่วมกันทั้งตอนส่งครั้งแรกและตอนแก้ไข
        //
        // maxScoreByItem: คะแนนเต็มของข้อที่บันทึกไว้แล้ว (AuditResponse.MaxScore) ใช้ตอนแก้ไขงานเดิม
        // เพื่อให้คิดคะแนนใหม่ด้วยคะแนนเต็ม ณ วันตรวจ ไม่ใช่คะแนนเต็มปัจจุบันของฟอร์ม — งานประวัติที่
        // import มา ข้อเดียวกันมีคะแนนต่างกันตามยุค ถ้าใช้ SurveyItem.FullScore แก้แค่หมายเหตุ
        // คะแนนรวม/ผ่าน-ไม่ผ่าน ก็เพี้ยนทันที ข้อที่ไม่มีใน dictionary (งานใหม่ หรือข้อที่เพิ่งเพิ่ม)
        // ใช้ SurveyItem.FullScore ตามเดิม
        private (double TotalScore, double MaxScore, bool HasCriticalDefect, List<ComputedItemResponse> Responses, Dictionary<int, SurveyItem> AllItems) ComputeScoring(
            SurveyForm form, List<ResponseSubmitDto> responses, IReadOnlyDictionary<int, double>? maxScoreByItem = null)
        {
            var allItems = form.Sections.SelectMany(s => s.Items).ToDictionary(i => i.Id);

            double totalScore = 0.0;
            double maxScore = 0.0;
            bool hasCriticalDefect = false;
            var processedResponses = new List<ComputedItemResponse>();

            foreach (var respDto in responses)
            {
                if (!allItems.TryGetValue(respDto.SurveyItemId, out var item)) continue;

                double fullScore = maxScoreByItem != null && maxScoreByItem.TryGetValue(item.Id, out var savedMax)
                    ? savedMax
                    : item.FullScore;

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
                    else if (fullScore > 0) scaleVal = (respDto.ScoreGiven / fullScore) * 5.0;
                    else scaleVal = 3.0;

                    scaleVal = Math.Clamp(scaleVal, 1.0, 5.0);
                    scoreGiven = Math.Round((scaleVal / 5.0) * fullScore, 2);
                    isPassed = scaleVal >= 3.0;

                    maxScore += fullScore;
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

                    scoreGiven = isYes ? fullScore : 0.0;
                    isPassed = isYes;

                    maxScore += fullScore;
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
                    // เก็บทุกข้อรวม N/A — ผู้อ่านกรอง N/A ออกจากคะแนนเต็มเอง และถ้าภายหลังแก้ข้อ N/A
                    // เป็นผ่าน/ไม่ผ่าน จะยังรู้คะแนนเต็ม ณ วันตรวจ
                    MaxScore = fullScore,
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
                .AsNoTracking()
                .AsSplitQuery()
                .Include(f => f.Sections)
                    .ThenInclude(s => s.Items)
                .Include(f => f.FormBrands)
                .Include(f => f.TargetLocations)
                .FirstOrDefaultAsync(f => f.Id == dto.SurveyFormId);

            if (form == null || !form.IsActive) return BadRequest(new { message = "ไม่พบแบบฟอร์มการตรวจหรือแบบฟอร์มถูกปิดการใช้งาน" });

            var (totalScore, maxScore, hasCriticalDefect, processedResponses, allItems) = ComputeScoring(form, dto.Responses);

            double percentageScore = (maxScore > 0) ? Math.Round((totalScore / maxScore) * 100.0, 2) : 100.0;
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
                    return BadRequest(new { message = "ไม่พบข้อมูลผู้ตรวจในระบบ กรุณาระบุผู้ตรวจที่ถูกต้อง" });
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

            // Fallback 1: If no schedule ID directly provided, check if the targeted draft is linked to a schedule
            if (!validScheduleId.HasValue && dto.DraftId.HasValue && dto.DraftId.Value > 0)
            {
                var draftCheck = await _context.AuditDrafts.FindAsync(dto.DraftId.Value);
                if (draftCheck?.AuditScheduleId.HasValue == true && draftCheck.AuditScheduleId.Value > 0)
                {
                    if (await _context.AuditSchedules.AnyAsync(s => s.Id == draftCheck.AuditScheduleId.Value))
                    {
                        validScheduleId = draftCheck.AuditScheduleId.Value;
                    }
                }
            }

            // Fallback 2: Check if there is an in-progress schedule for this branch & form specifically for this auditor
            if (!validScheduleId.HasValue)
            {
                var inProgressSched = await _context.AuditSchedules
                    .Where(s => s.LocationId == dto.LocationId &&
                                s.SurveyFormId == dto.SurveyFormId &&
                                s.Status == "in_progress" &&
                                (s.Auditors.Any(a => a.AuditorId == primaryAuditorId) || s.CreatedBy == primaryAuditorId))
                    .OrderByDescending(s => s.ScheduledDate)
                    .FirstOrDefaultAsync();

                if (inProgressSched != null)
                {
                    validScheduleId = inProgressSched.Id;
                }
            }

            // 🛡️ Check if this schedule has already been audited
            if (validScheduleId.HasValue)
            {
                if (await _context.AuditRecords.AnyAsync(r => r.AuditScheduleId == validScheduleId.Value))
                {
                    // If schedule was already audited, unlink to prevent constraint failure while allowing audit submission to succeed
                    validScheduleId = null;
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
                // Convert Base64 Signatures to Server Files (จำกัดขนาดลายเซ็นไม่เกิน 2MB)
                var auditorSigUrl = await UploadHelper.SaveSignaturePhotoAsync(
                    _env, _config, dto.AuditorSignatureUrl, validScheduleId, location.Code, "auditor", 2 * 1024 * 1024);
                var auditeeSigUrl = await UploadHelper.SaveSignaturePhotoAsync(
                    _env, _config, dto.AuditeeSignatureUrl, validScheduleId, location.Code, "auditee", 2 * 1024 * 1024);

                // 🌟 ผูก AuditDate และ StartedAt เข้าด้วยกันเป็นเวลาเริ่มตรวจจริงเสมอ
                var effectiveStartedAt = dto.StartedAt ?? dto.AuditDate ?? DateTime.UtcNow;
                var effectiveSubmittedAt = dto.SubmittedAt ?? DateTime.UtcNow;

                // Create AuditRecord
                var record = new AuditRecord
                {
                    LocationId = dto.LocationId,
                    SurveyFormId = dto.SurveyFormId,
                    PrimaryAuditorId = primaryAuditorId,
                    AuditeeUserId = validAuditeeUserId,
                    AuditeeNameText = dto.AuditeeNameText,
                    AuditScheduleId = validScheduleId,
                    AuditDate = effectiveStartedAt,
                    TotalScore = totalScore,
                    MaxScore = maxScore,
                    PercentageScore = percentageScore,
                    IsPassed = isOverallPassed,
                    HasCriticalDefect = hasCriticalDefect,
                    AuditType = NormalizeAuditType(dto.AuditType),
                    Notes = dto.Notes,
                    MetadataValuesJson = dto.MetadataValuesJson,
                    AuditorSignatureUrl = string.IsNullOrWhiteSpace(auditorSigUrl) ? null : auditorSigUrl,
                    AuditeeSignatureUrl = string.IsNullOrWhiteSpace(auditeeSigUrl) ? null : auditeeSigUrl,
                    SignedAt = dto.SignedAt ?? DateTime.UtcNow,
                    StartLatitude = dto.StartLatitude,
                    StartLongitude = dto.StartLongitude,
                    EndLatitude = dto.EndLatitude,
                    EndLongitude = dto.EndLongitude,
                    IsBackdated = dto.IsBackdated,
                    StartedAt = effectiveStartedAt,
                    SubmittedAt = effectiveSubmittedAt
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
                        MaxScore = computedResp.MaxScore,
                        IsPassed = computedResp.IsPassed,
                        IsNa = computedResp.IsNa,
                        Notes = computedResp.Notes,
                        CategoryName = catName,
                        CategoryCode = item?.CategoryCode
                    };

                    // Attach Images (auto-saved to /uploads/audit_images/ if base64)
                    if (computedResp.ImageUrls != null && computedResp.ImageUrls.Any())
                    {
                        foreach (var imgUrl in computedResp.ImageUrls)
                        {
                            if (string.IsNullOrWhiteSpace(imgUrl)) continue;
                            var savedImgUrl = await UploadHelper.SaveAuditItemPhotoAsync(
                                _env, _config, imgUrl, validScheduleId, location.Code, computedResp.SurveyItemId, 10 * 1024 * 1024);
                            if (!string.IsNullOrWhiteSpace(savedImgUrl))
                            {
                                response.Images.Add(new AuditResponseImage
                                {
                                    ImageUrl = savedImgUrl,
                                    UploadedBy = primaryAuditorId,
                                    UploadedAt = DateTime.UtcNow
                                });
                            }
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

                // Delete ALL matching Draft(s) comprehensively to prevent lingering drafts
                var draftsToDelete = new List<AuditDraft>();

                if (dto.DraftId.HasValue && dto.DraftId.Value > 0)
                {
                    var targetDraft = await _context.AuditDrafts.FindAsync(dto.DraftId.Value);
                    if (targetDraft != null) draftsToDelete.Add(targetDraft);
                }

                if (validScheduleId.HasValue)
                {
                    var schedDrafts = await _context.AuditDrafts
                        .Where(d => d.AuditScheduleId == validScheduleId.Value)
                        .ToListAsync();
                    draftsToDelete.AddRange(schedDrafts);
                }

                var relatedDrafts = await _context.AuditDrafts
                    .Where(d => d.LocationId == dto.LocationId &&
                                d.SurveyFormId == dto.SurveyFormId &&
                                (d.AuditorId == primaryAuditorId || d.AuditorId == currentUserId))
                    .ToListAsync();
                draftsToDelete.AddRange(relatedDrafts);

                var uniqueDrafts = draftsToDelete.GroupBy(d => d.Id).Select(g => g.First()).ToList();
                if (uniqueDrafts.Any())
                {
                    _context.AuditDrafts.RemoveRange(uniqueDrafts);
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
            catch (InvalidImageUploadException ex)
            {
                await transaction.RollbackAsync();
                _logger.LogWarning(ex, "Invalid image uploaded during audit submission: {Message}", ex.Message);
                return BadRequest(new { message = ex.Message });
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
            [FromQuery] DateTime? endDate,
            [FromQuery] bool includeResponses = false)
        {
            var (currentUserId, role, allowedLocationIds) = await UserScopeHelper.GetUserScopeAsync(User, _context);
            var (_, _, allowedBrandIds) = await UserScopeHelper.GetUserBrandScopeAsync(User, _context);

            // 🌟 includeResponses=true: ใช้สำหรับ Excel export เท่านั้น — โหลด Responses+SurveyItem
            // เพื่อสร้างชีท "คำตอบรายข้อ" โดยไม่กระทบ performance ของ list view ปกติ
            IQueryable<AuditRecord> query;
            if (includeResponses)
            {
                query = _context.AuditRecords
                    .AsNoTracking()
                    .AsSplitQuery()
                    .Include(r => r.Location)
                        .ThenInclude(l => l!.LocationBrands)
                            .ThenInclude(lb => lb.Brand)
                    .Include(r => r.SurveyForm)
                    .Include(r => r.PrimaryAuditor)
                    .Include(r => r.AuditeeUser)
                    .Include(r => r.Responses)
                        .ThenInclude(res => res.SurveyItem)
                            .ThenInclude(item => item!.SurveySection)
                    .AsQueryable();
            }
            else
            {
                query = _context.AuditRecords
                    .AsNoTracking()
                    .AsSplitQuery()
                    .Include(r => r.Location)
                        .ThenInclude(l => l!.LocationBrands)
                            .ThenInclude(lb => lb.Brand)
                    .Include(r => r.SurveyForm)
                    .Include(r => r.PrimaryAuditor)
                    .Include(r => r.AuditeeUser)
                    .AsQueryable();
            }

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
            else if (startDate.HasValue || endDate.HasValue)
            {
                // 🌟 ค้นหาแบบระบุช่วงวันที่ (เช่น พิมพ์เดือน/ปีในช่องค้นหา) ข้อมูลถูกจำกัดขอบเขต
                // ด้วยช่วงวันที่อยู่แล้วโดยธรรมชาติ ไม่ควร cap ที่ 300 เหมือน browse ปกติ เพราะองค์กร
                // ที่มีหลายสาขา/role กว้าง (เช่น แอดมิน) อาจมี audit ในเดือนเดียวเกิน 300 รายการ
                // แล้วจะโดนตัดทิ้งแบบเงียบๆ โดยผู้ใช้ไม่รู้ตัว
                query = query.Take(2000);
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
                surveyFormVersion = r.SurveyForm?.Version ?? "v1.0",
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
                // 🌟 responses: จะส่งเฉพาะเมื่อ includeResponses=true (Excel export)
                // เพื่อให้สร้างชีท "คำตอบรายข้อ" ได้ครบโดยไม่ต้องยิง API เพิ่มทีละ record
                responses = includeResponses
                    ? r.Responses?
                        .OrderBy(res => res.SurveyItem?.SurveySection?.OrderIndex ?? 0)
                        .ThenBy(res => res.SurveyItem?.OrderIndex ?? 0)
                        .Select(res => new
                        {
                            surveyItemId = res.SurveyItemId,
                            questionText = res.SurveyItem?.QuestionText,
                            sectionTitle = res.SurveyItem?.SurveySection?.Title,
                            // หมวด ณ วันตรวจของคำตอบก่อน (ระบบเดิมเคยย้ายข้อเดิมไปหมวดอื่นตามยุค) → หมวดของคำถาม
                            categoryCode = res.CategoryCode ?? res.SurveyItem?.CategoryCode,
                            categoryName = res.CategoryName ?? res.SurveyItem?.CategoryName ?? res.SurveyItem?.SurveySection?.Title ?? "ทั่วไป",
                            // คะแนนเต็ม ณ วันตรวจ (งานประวัติข้อเดียวกันคะแนนต่างกันตามยุค) → ค่าปัจจุบันของฟอร์ม
                            fullScore = res.MaxScore ?? res.SurveyItem?.FullScore ?? 0,
                            scoreGiven = res.ScoreGiven,
                            isPassed = res.IsPassed,
                            isNa = res.IsNa,
                            isCritical = res.SurveyItem?.IsCritical ?? false,
                            notes = res.Notes
                        }).ToList()
                    : null
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
                .AsSplitQuery()
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
                surveyFormVersion = r.SurveyForm?.Version ?? "v1.0",
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
                        // คะแนนเต็ม ณ วันตรวจ → ค่าปัจจุบันของฟอร์ม (คะแนนแยกหมวดในหน้ารายละเอียดคิดจากค่านี้)
                        fullScore = res.MaxScore ?? res.SurveyItem?.FullScore,
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
                        // หมวด ณ วันตรวจของคำตอบ — frontend (getQuestionCategory) อ่าน categoryCode ก่อน
                        // surveyItem.categoryCode ซึ่งเป็นหมวดของคำถามยุคล่าสุด
                        categoryCode = res.CategoryCode ?? res.SurveyItem?.CategoryCode,
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
                .AsSplitQuery()
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
                .AsNoTracking()
                .AsSplitQuery()
                .Include(f => f.Sections)
                    .ThenInclude(s => s.Items)
                .FirstOrDefaultAsync(f => f.Id == record.SurveyFormId);

            if (form == null) return NotFound(new { message = "ไม่พบแบบฟอร์มการตรวจที่ผูกกับบันทึกนี้" });

            // 4) คำนวณคะแนนใหม่ทั้งชุดฝั่ง server (ใช้ helper เดียวกับตอนส่งครั้งแรก — ห้ามเชื่อคะแนนจาก client)
            //    ใช้คะแนนเต็ม ณ วันตรวจที่บันทึกไว้ (AuditResponse.MaxScore) ไม่ใช่คะแนนเต็มปัจจุบันของฟอร์ม
            //    — ไม่งั้นแก้งานประวัติแม้แค่หมายเหตุ คะแนนรวม/ผ่าน-ไม่ผ่านจะเพี้ยนจากระบบเดิม
            var savedMaxByItem = record.Responses
                .Where(r => r.MaxScore.HasValue)
                .GroupBy(r => r.SurveyItemId)
                .ToDictionary(g => g.Key, g => g.First().MaxScore!.Value);
            var (totalScore, maxScore, hasCriticalDefect, processedResponses, allItems) = ComputeScoring(form, dto.Responses, savedMaxByItem);
            double percentageScore = (maxScore > 0) ? Math.Round((totalScore / maxScore) * 100.0, 2) : 100.0;
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
                record.AuditType = NormalizeAuditType(dto.AuditType);
                record.Notes = dto.Notes;
                record.MetadataValuesJson = dto.MetadataValuesJson;

                // เวลาเริ่ม-สิ้นสุด (ผูก AuditDate และ StartedAt เข้าด้วยกัน)
                if (dto.StartedAt.HasValue)
                {
                    record.StartedAt = dto.StartedAt.Value;
                    record.AuditDate = dto.StartedAt.Value;
                }
                if (dto.SubmittedAt.HasValue) record.SubmittedAt = dto.SubmittedAt.Value;
                if (dto.AuditDate.HasValue) record.AuditDate = dto.AuditDate.Value;

                // ลายเซ็น (จำกัดขนาดไม่เกิน 2MB)
                if (!string.IsNullOrWhiteSpace(dto.AuditorSignatureUrl))
                {
                    record.AuditorSignatureUrl = await UploadHelper.SaveSignaturePhotoAsync(
                        _env, _config, dto.AuditorSignatureUrl, record.AuditScheduleId, record.Location?.Code, "auditor", 2 * 1024 * 1024);
                }
                if (!string.IsNullOrWhiteSpace(dto.AuditeeSignatureUrl))
                {
                    record.AuditeeSignatureUrl = await UploadHelper.SaveSignaturePhotoAsync(
                        _env, _config, dto.AuditeeSignatureUrl, record.AuditScheduleId, record.Location?.Code, "auditee", 2 * 1024 * 1024);
                }

                // พิกัดสถานที่ (อนุญาตให้เป็น null ได้ หากไม่มี GPS หรือต้องการล้างค่า)
                record.StartLatitude = dto.StartLatitude;
                record.StartLongitude = dto.StartLongitude;
                record.EndLatitude = dto.EndLatitude;
                record.EndLongitude = dto.EndLongitude;

                record.TotalScore = totalScore;
                record.MaxScore = maxScore;
                record.PercentageScore = percentageScore;
                record.IsPassed = isOverallPassed;
                record.HasCriticalDefect = hasCriticalDefect;

                // 📸 1. รวบรวม Metadata ของรูปภาพเดิมทั้งหมด (URL -> UploadedBy, UploadedAt)
                // เพื่อให้รูปเดิมที่ไม่ได้ถูกแก้ไข คงผู้อัปโหลดและวันเวลาที่ถ่ายจริงไว้ ไม่ถูกเขียนทับด้วยเวลาแก้ไข
                var existingImageMetadata = new Dictionary<string, (int UploadedBy, DateTime UploadedAt)>(StringComparer.OrdinalIgnoreCase);
                foreach (var oldResp in record.Responses)
                {
                    foreach (var img in oldResp.Images)
                    {
                        if (!string.IsNullOrWhiteSpace(img.ImageUrl) && !existingImageMetadata.ContainsKey(img.ImageUrl))
                        {
                            existingImageMetadata[img.ImageUrl] = (img.UploadedBy, img.UploadedAt);
                        }
                    }
                }

                // 🔗 2. โหลด CapTasks ทั้งหมดที่ผูกกับบันทึกนี้
                var oldResponseIds = record.Responses.Select(r => r.Id).ToList();
                var linkedCaps = await _context.CapTasks
                    .AsSplitQuery()
                    .Include(c => c.Images)
                    .Include(c => c.Comments)
                    .Where(c => c.AuditRecordId == record.Id || oldResponseIds.Contains(c.AuditResponseId ?? 0))
                    .ToListAsync();

                var linkedCapsBySurveyItem = new Dictionary<int, List<CapTask>>();
                foreach (var cap in linkedCaps)
                {
                    var oldResp = record.Responses.FirstOrDefault(r => r.Id == cap.AuditResponseId);
                    if (oldResp != null)
                    {
                        if (!linkedCapsBySurveyItem.TryGetValue(oldResp.SurveyItemId, out var list))
                        {
                            list = new List<CapTask>();
                            linkedCapsBySurveyItem[oldResp.SurveyItemId] = list;
                        }
                        list.Add(cap);
                    }
                }

                // 🔄 3. Diff / In-place Update AuditResponse แทนการลบแล้วสร้างใหม่
                // รักษา AuditResponse.Id เดิมไว้ ไม่ต้องปลดลิงก์ AuditResponseId = null
                var existingResponsesByItem = record.Responses
                    .GroupBy(r => r.SurveyItemId)
                    .ToDictionary(g => g.Key, g => g.First());
                var processedItemIds = new HashSet<int>();

                var newCapTasksToCreate = new List<CapTask>();
                int capTasksDeletedCount = 0;
                int capTasksCancelledCount = 0;

                foreach (var computedResp in processedResponses)
                {
                    processedItemIds.Add(computedResp.SurveyItemId);
                    allItems.TryGetValue(computedResp.SurveyItemId, out var itemMeta);
                    var catName = itemMeta?.CategoryName ?? itemMeta?.SurveySection?.Title ?? "ทั่วไป";
                    if (catName.Length > 100) catName = catName.Substring(0, 100);

                    // รวบรวมรูปภาพที่ต้องการของข้อนี้ (บันทึก Base64 ถ้ามี)
                    var targetImageUrls = new List<string>();
                    if (computedResp.ImageUrls != null && computedResp.ImageUrls.Any())
                    {
                        foreach (var imgUrl in computedResp.ImageUrls)
                        {
                            if (string.IsNullOrWhiteSpace(imgUrl)) continue;
                            var savedImgUrl = await UploadHelper.SaveAuditItemPhotoAsync(
                                _env, _config, imgUrl, record.AuditScheduleId, record.Location?.Code, computedResp.SurveyItemId, 10 * 1024 * 1024);
                            if (!string.IsNullOrWhiteSpace(savedImgUrl))
                            {
                                targetImageUrls.Add(savedImgUrl);
                            }
                        }
                    }

                    AuditResponse response;
                    if (existingResponsesByItem.TryGetValue(computedResp.SurveyItemId, out var existingResp))
                    {
                        // 🟢 In-place Update คำตอบเดิม (Id เดิมไม่เปลี่ยน, FK ไม่หลุด)
                        response = existingResp;
                        response.ScoreGiven = computedResp.ScoreGiven;
                        response.MaxScore = computedResp.MaxScore;
                        response.IsPassed = computedResp.IsPassed;
                        response.IsNa = computedResp.IsNa;
                        response.Notes = computedResp.Notes;
                        // เก็บหมวด ณ วันตรวจของคำตอบเดิมไว้ ไม่เขียนทับจากตัวคำถาม — งานประวัติ ระบบเดิม
                        // เคยย้ายข้อเดิมไปหมวดอื่นตามยุค หมวดของ SurveyItem จึงถูกแค่ยุคล่าสุด
                        if (!string.IsNullOrWhiteSpace(response.CategoryName)) catName = response.CategoryName;
                        response.CategoryName = catName;
                        response.CategoryCode ??= itemMeta?.CategoryCode;

                        // ลบรูปภาพที่ถูกนำออก
                        var imagesToRemove = response.Images
                            .Where(img => !targetImageUrls.Contains(img.ImageUrl, StringComparer.OrdinalIgnoreCase))
                            .ToList();
                        foreach (var remImg in imagesToRemove)
                        {
                            response.Images.Remove(remImg);
                            _context.AuditResponseImages.Remove(remImg);
                        }

                        // เพิ่มรูปภาพใหม่
                        var currentImageUrls = response.Images
                            .Select(img => img.ImageUrl)
                            .ToHashSet(StringComparer.OrdinalIgnoreCase);

                        foreach (var targetUrl in targetImageUrls)
                        {
                            if (!currentImageUrls.Contains(targetUrl))
                            {
                                int imgUploadedBy = currentUserId;
                                DateTime imgUploadedAt = DateTime.UtcNow;
                                if (existingImageMetadata.TryGetValue(targetUrl, out var meta))
                                {
                                    imgUploadedBy = meta.UploadedBy;
                                    imgUploadedAt = meta.UploadedAt;
                                }

                                response.Images.Add(new AuditResponseImage
                                {
                                    ImageUrl = targetUrl,
                                    UploadedBy = imgUploadedBy,
                                    UploadedAt = imgUploadedAt
                                });
                            }
                        }
                    }
                    else
                    {
                        // 🟢 ข้อใหม่ที่เพิ่งเพิ่มเข้ามาในฟอร์ม
                        response = new AuditResponse
                        {
                            SurveyItemId = computedResp.SurveyItemId,
                            ScoreGiven = computedResp.ScoreGiven,
                            MaxScore = computedResp.MaxScore,
                            IsPassed = computedResp.IsPassed,
                            IsNa = computedResp.IsNa,
                            Notes = computedResp.Notes,
                            CategoryName = catName,
                            CategoryCode = itemMeta?.CategoryCode
                        };

                        foreach (var targetUrl in targetImageUrls)
                        {
                            int imgUploadedBy = currentUserId;
                            DateTime imgUploadedAt = DateTime.UtcNow;
                            if (existingImageMetadata.TryGetValue(targetUrl, out var meta))
                            {
                                imgUploadedBy = meta.UploadedBy;
                                imgUploadedAt = meta.UploadedAt;
                            }

                            response.Images.Add(new AuditResponseImage
                            {
                                ImageUrl = targetUrl,
                                UploadedBy = imgUploadedBy,
                                UploadedAt = imgUploadedAt
                            });
                        }
                        record.Responses.Add(response);
                    }

                    // 🌟 4. จัดการ CAP แบบ Hybrid ตาม Logic เดิมที่มีอยู่แล้ว 100%
                    bool hasExistingOpenCap = false;
                    if (linkedCapsBySurveyItem.TryGetValue(computedResp.SurveyItemId, out var capsForThisItem))
                    {
                        bool isResolvedNow = computedResp.IsNa || computedResp.IsPassed;
                        foreach (var cap in capsForThisItem)
                        {
                            bool isAlreadyDone = string.Equals(cap.Status, "CLOSED", StringComparison.OrdinalIgnoreCase)
                                || string.Equals(cap.Status, "CANCELLED", StringComparison.OrdinalIgnoreCase);

                            if (isResolvedNow && !isAlreadyDone)
                            {
                                // 👉 ตรวจสอบว่าสาขาเคยมีกิจกรรม/ส่งงานหรือยัง
                                bool isUntouched = (cap.Images == null || !cap.Images.Any())
                                    && (cap.Comments == null || !cap.Comments.Any())
                                    && string.Equals(cap.Status, "OPEN", StringComparison.OrdinalIgnoreCase);

                                if (isUntouched)
                                {
                                    // 🗑️ สาขายังไม่ได้แตะต้องเลย -> ลบออกทันที สะอาด 100%
                                    _context.CapTasks.Remove(cap);
                                    capTasksDeletedCount++;
                                    continue;
                                }
                                else
                                {
                                    // 🔒 สาขาเคยส่งรูปหรือแชทแล้ว -> เปลี่ยนเป็น CANCELLED เพื่อรักษาหลักฐาน
                                    cap.AuditResponse = response;
                                    cap.Status = "CANCELLED";
                                    cap.ClosedAt = DateTime.UtcNow;
                                    cap.Comments ??= new List<CapTaskComment>();
                                    cap.Comments.Add(new CapTaskComment
                                    {
                                        SenderId = currentUserId,
                                        SenderRole = role,
                                        Message = $"[ระบบ] ยกเลิกงานแก้ไขนี้อัตโนมัติ เนื่องจากผลการตรวจประเมินถูกแก้ไขเป็น \"ผ่าน\"/N.A. — เหตุผลการแก้ไข: {dto.Reason.Trim()}",
                                        CreatedAt = DateTime.UtcNow
                                    });
                                    capTasksCancelledCount++;
                                    isAlreadyDone = true;
                                }
                            }
                            else
                            {
                                // ข้อนี้ยังไม่ผ่าน หรือเป็นงานที่จบแล้ว -> ผูกกลับเข้ากับ response
                                cap.AuditResponse = response;
                            }

                            if (!isAlreadyDone)
                            {
                                hasExistingOpenCap = true;
                            }
                        }
                    }

                    // 🆕 ถ้าแก้ไขแล้วพบว่าข้อนี้ "ไม่ผ่าน" และยังไม่มีงานแก้ไขที่เปิดอยู่ผูกอยู่เดิม
                    // ให้สร้างงานแก้ไขใหม่อัตโนมัติ เหมือนตอน SubmitAudit
                    if (!computedResp.IsNa && !computedResp.IsPassed && !hasExistingOpenCap)
                    {
                        var issueItem = itemMeta?.QuestionText ?? "ข้อบกพร่องมาตรฐาน";
                        var desc = !string.IsNullOrWhiteSpace(computedResp.Notes)
                            ? computedResp.Notes
                            : $"ไม่ผ่านเกณฑ์การประเมิน (พบจากการแก้ไขบันทึกย้อนหลัง): {issueItem}";

                        newCapTasksToCreate.Add(new CapTask
                        {
                            AuditRecord = record,
                            AuditResponse = response,
                            LocationId = record.LocationId,
                            CategoryName = catName,
                            IssueItem = issueItem.Length > 250 ? issueItem.Substring(0, 250) : issueItem,
                            Description = desc,
                            SubmissionDeadline = DateTime.UtcNow.AddDays(7),
                            Status = "OPEN",
                            AssignedTo = record.AuditeeUserId,
                            CreatedAt = DateTime.UtcNow
                        });
                    }
                }

                // 🧹 5. ลบ AuditResponse ที่ไม่มีในแบบฟอร์มแล้ว (ถ้ามี)
                var orphanedResponses = record.Responses.Where(r => !processedItemIds.Contains(r.SurveyItemId)).ToList();
                foreach (var orphan in orphanedResponses)
                {
                    if (linkedCapsBySurveyItem.TryGetValue(orphan.SurveyItemId, out var orphanCaps))
                    {
                        foreach (var cap in orphanCaps)
                        {
                            if ((cap.Images == null || !cap.Images.Any()) && (cap.Comments == null || !cap.Comments.Any()))
                            {
                                _context.CapTasks.Remove(cap);
                                capTasksDeletedCount++;
                            }
                            else
                            {
                                cap.AuditResponseId = null;
                                cap.Status = "CANCELLED";
                                capTasksCancelledCount++;
                            }
                        }
                    }
                    _context.AuditResponses.Remove(orphan);
                    record.Responses.Remove(orphan);
                }

                if (newCapTasksToCreate.Any())
                {
                    _context.CapTasks.AddRange(newCapTasksToCreate);
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
                        changedItems,
                        newCapTasksCreated = newCapTasksToCreate.Count,
                        capTasksDeleted = capTasksDeletedCount,
                        capTasksCancelled = capTasksCancelledCount
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
            catch (InvalidImageUploadException ex)
            {
                await transaction.RollbackAsync();
                _logger.LogWarning(ex, "Invalid image uploaded during audit edit: {Message}", ex.Message);
                return BadRequest(new { message = ex.Message });
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
                .AsSplitQuery()
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