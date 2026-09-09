using Microsoft.EntityFrameworkCore;
using QSC.Api.Data;
using QSC.Api.Helpers;
using QSC.Api.Models;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace QSC.Api.Services
{
    public class DashboardAiInsightsDto
    {
        [JsonPropertyName("highlight")]
        public string Highlight { get; set; } = string.Empty;

        [JsonPropertyName("attention")]
        public string Attention { get; set; } = string.Empty;

        [JsonPropertyName("action")]
        public string Action { get; set; } = string.Empty;

        [JsonPropertyName("generatedBy")]
        public string GeneratedBy { get; set; } = "AI Engine";

        [JsonPropertyName("generatedAt")]
        public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;
    }

    public class ScheduleRecommendationItemDto
    {
        [JsonPropertyName("locationId")]
        public int LocationId { get; set; }

        [JsonPropertyName("locationName")]
        public string LocationName { get; set; } = string.Empty;

        [JsonPropertyName("brandName")]
        public string BrandName { get; set; } = string.Empty;

        [JsonPropertyName("region")]
        public string Region { get; set; } = string.Empty;

        [JsonPropertyName("priorityLevel")]
        public string PriorityLevel { get; set; } = "HIGH"; // "CRITICAL", "HIGH", "MEDIUM"

        [JsonPropertyName("lastScore")]
        public double? LastScore { get; set; }

        [JsonPropertyName("lastAuditDate")]
        public DateTime? LastAuditDate { get; set; }

        [JsonPropertyName("daysSinceLastAudit")]
        public int DaysSinceLastAudit { get; set; }

        [JsonPropertyName("hasAuditedThisMonth")]
        public bool HasAuditedThisMonth { get; set; }

        [JsonPropertyName("pendingCapCount")]
        public int PendingCapCount { get; set; }

        [JsonPropertyName("reason")]
        public string Reason { get; set; } = string.Empty;

        [JsonPropertyName("suggestedFocus")]
        public string SuggestedFocus { get; set; } = string.Empty;

        [JsonPropertyName("suggestedAuditorName")]
        public string SuggestedAuditorName { get; set; } = string.Empty;

        [JsonPropertyName("auditorReason")]
        public string AuditorReason { get; set; } = string.Empty;
    }

    public class ScheduleAiRecommendationsDto
    {
        [JsonPropertyName("summary")]
        public string Summary { get; set; } = string.Empty;

        [JsonPropertyName("recommendations")]
        public List<ScheduleRecommendationItemDto> Recommendations { get; set; } = new();

        [JsonPropertyName("totalBranchesPendingMonthlyAudit")]
        public int TotalBranchesPendingMonthlyAudit { get; set; }

        [JsonPropertyName("generatedBy")]
        public string GeneratedBy { get; set; } = "AI Engine";
    }

    public class CapAiAnalysisDto
    {
        [JsonPropertyName("taskId")]
        public int TaskId { get; set; }

        [JsonPropertyName("issueSummary")]
        public string IssueSummary { get; set; } = string.Empty;

        [JsonPropertyName("progressStatus")]
        public string ProgressStatus { get; set; } = string.Empty;

        [JsonPropertyName("strengthPoints")]
        public List<string> StrengthPoints { get; set; } = new();

        [JsonPropertyName("areasToVerify")]
        public List<string> AreasToVerify { get; set; } = new();

        [JsonPropertyName("auditorAdvice")]
        public string AuditorAdvice { get; set; } = string.Empty;

        [JsonPropertyName("readinessToClose")]
        public string ReadinessToClose { get; set; } = "PENDING_PROOF"; // "READY_TO_REVIEW", "PENDING_PROOF", "REJECT_SUGGESTED"

        [JsonPropertyName("confidencePercent")]
        public int ConfidencePercent { get; set; } = 88;

        [JsonPropertyName("nextAuditAdvice")]
        public string? NextAuditAdvice { get; set; }

        [JsonPropertyName("savedNextAuditNote")]
        public string? SavedNextAuditNote { get; set; }

        [JsonPropertyName("followUpStatus")]
        public string FollowUpStatus { get; set; } = "NONE";

        [JsonPropertyName("disclaimer")]
        public string Disclaimer { get; set; } = "คำแนะนำนี้ประมวลผลโดย AI เพื่อช่วยผู้ประเมินประกอบการพิจารณา ผู้ตรวจยังคงเป็นผู้ตัดสินใจขั้นสุดท้าย";
    }

    public class AiService
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _config;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<AiService> _logger;

        public AiService(
            AppDbContext context,
            IConfiguration config,
            IHttpClientFactory httpClientFactory,
            ILogger<AiService> logger)
        {
            _context = context;
            _config = config;
            _httpClientFactory = httpClientFactory;
            _logger = logger;
        }

        private string GetApiKey()
        {
            return _config["AI:ApiKey"] 
                ?? Environment.GetEnvironmentVariable("AI_API_KEY") 
                ?? Environment.GetEnvironmentVariable("GEMINI_API_KEY") 
                ?? string.Empty;
        }

        private string GetModel()
        {
            return _config["AI:Model"] ?? "gemini-flash-latest";
        }

        // DASHBOARD
        public async Task<DashboardAiInsightsDto> GetDashboardInsightsAsync(ClaimsPrincipal user, DateTime? targetMonth = null)
        {
            var (_, _, allowedLocationIds) = await UserScopeHelper.GetUserScopeAsync(user, _context);
            var (_, _, allowedBrandIds) = await UserScopeHelper.GetUserBrandScopeAsync(user, _context);

            var month = targetMonth ?? DateTime.UtcNow;
            var startOfMonth = new DateTime(month.Year, month.Month, 1);
            var endOfMonth = startOfMonth.AddMonths(1).AddTicks(-1);

            var monthRecordsQuery = _context.AuditRecords
                .AsNoTracking()
                .Include(r => r.Location)
                .Include(r => r.Responses)
                    .ThenInclude(res => res.SurveyItem)
                        .ThenInclude(item => item!.SurveySection)
                .Where(r => r.AuditDate >= startOfMonth && r.AuditDate <= endOfMonth)
                .AsQueryable();

            if (allowedLocationIds != null)
            {
                monthRecordsQuery = monthRecordsQuery.Where(r => allowedLocationIds.Contains(r.LocationId));
            }
            if (allowedBrandIds != null)
            {
                monthRecordsQuery = monthRecordsQuery.Where(r => r.Location != null && r.Location.LocationBrands.Any(lb => allowedBrandIds.Contains(lb.BrandId)));
            }

            var monthRecords = await monthRecordsQuery.ToListAsync();

            var pendingCapsQuery = _context.CapTasks
                .AsNoTracking()
                .Include(c => c.Location)
                .Where(c => c.Status != "CLOSED" && c.Status != "closed")
                .AsQueryable();

            if (allowedLocationIds != null)
            {
                pendingCapsQuery = pendingCapsQuery.Where(c => allowedLocationIds.Contains(c.LocationId));
            }
            if (allowedBrandIds != null)
            {
                pendingCapsQuery = pendingCapsQuery.Where(c => c.Location != null && c.Location.LocationBrands.Any(lb => allowedBrandIds.Contains(lb.BrandId)));
            }

            var pendingCaps = await pendingCapsQuery.ToListAsync();

            var totalAudits = monthRecords.Count;
            var avgScore = totalAudits > 0 ? Math.Round(monthRecords.Average(r => r.PercentageScore), 1) : 0;
            var passCount = monthRecords.Count(r => r.IsPassed);
            var passRate = totalAudits > 0 ? Math.Round((double)passCount / totalAudits * 100, 1) : 0;

            var defectFrequencies = monthRecords
                .SelectMany(r => r.Responses)
                .Where(res => !res.IsPassed && !res.IsNa)
                .GroupBy(res => res.SurveyItem?.QuestionText ?? "ข้อบกพร่องทั่วไป")
                .Select(g => new { Question = g.Key, Count = g.Count() })
                .OrderByDescending(x => x.Count)
                .Take(3)
                .ToList();

            string TruncateText(string text, int maxLen = 30)
            {
                if (string.IsNullOrWhiteSpace(text)) return string.Empty;
                var clean = text.Split('(')[0].Trim();
                return clean.Length > maxLen ? clean.Substring(0, maxLen - 3) + "..." : clean;
            }

            var topDefectShort = defectFrequencies.Any() 
                ? TruncateText(defectFrequencies.First().Question, 28)
                : "ไม่พบข้อบกพร่อง";

            var apiKey = GetApiKey();
            if (!string.IsNullOrWhiteSpace(apiKey))
            {
                try
                {
                    var prompt = $@"
คุณคือ AI ผู้เชี่ยวชาญด้านระบบควบคุมคุณภาพมาตรฐานร้านอาหาร (QSC)
ให้สรุปสถิติประจำเดือนแบบสั้น กระชับ ตรงประเด็น (ความยาวไม่เกิน 1 ประโยคสั้นๆ ต่อหัวข้อ)
คำแนะนำในการใช้ภาษา:
- ให้ใช้สำนวนภาษาไทยที่เป็นธรรมชาติ สลับคำเกริ่นและคำเชื่อมให้มีความสดใหม่ในแต่ละรอบ โดยคงตัวเลขสถิติตามข้อมูลจริงไว้อย่างแม่นยำ 100%
- highlight: สรุปภาพรวมคะแนน ({avgScore}%) และอัตราผ่าน ({passRate}%) ให้อ่านง่าย เช่น สถิติผลตรวจเฉลี่ย หรือภาพรวมมาตรฐานรอบนี้
- attention: ระบุเรื่องที่ต้องเฝ้าระวัง เช่น งาน CAP ที่ค้าง ({pendingCaps.Count} รายการ) หรือจุดบกพร่องที่พบบ่อย ({topDefectShort})
- action: ข้อเสนอแนะเชิงปฏิบัติการที่กระชับ ตรงประเด็น 1 ประโยค
ตอบเป็น JSON:
{{
  ""highlight"": ""ข้อความสรุปจุดเด่นสั้นๆ 1 ประโยค"",
  ""attention"": ""ข้อความจุดเฝ้าระวังสั้นๆ 1 ประโยค"",
  ""action"": ""ข้อความข้อเสนอแนะสั้นๆ 1 ประโยค""
}}
ข้อมูลจริง: รอบตรวจ {totalAudits} ครั้ง, คะแนนเฉลี่ย {avgScore}%, ผ่านเกณฑ์ {passRate}%, งาน CAP ค้าง {pendingCaps.Count} รายการ, ตกบ่อยสุด: {topDefectShort}
ตอบเฉพาะ JSON ล้วนๆ
";
                    var aiResultJson = await CallGeminiRestApiAsync(prompt, apiKey, GetModel());
                    if (!string.IsNullOrWhiteSpace(aiResultJson))
                    {
                        var parsed = JsonSerializer.Deserialize<DashboardAiInsightsDto>(aiResultJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                        if (parsed != null && !string.IsNullOrWhiteSpace(parsed.Highlight))
                        {
                            parsed.GeneratedBy = "Gemini AI";
                            parsed.GeneratedAt = DateTime.UtcNow;
                            return parsed;
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Gemini API call failed for Dashboard Insights. Falling back to rule-based.");
                }
            }

            // Fallback: ข้อความสั้น กระชับ อ่านง่าย
            return new DashboardAiInsightsDto
            {
                Highlight = totalAudits > 0
                    ? $"คะแนนเฉลี่ยภาพรวม {avgScore}% ผ่านเกณฑ์มาตรฐาน {passRate}%"
                    : "ระบบพร้อมสำหรับการบันทึกผลตรวจรอบใหม่",
                Attention = pendingCaps.Count > 0
                    ? $"งานค้างส่ง CAP {pendingCaps.Count} รายการ (พบตกบ่อย: {topDefectShort})"
                    : "ไม่มีงานค้างส่ง CAP จัดการได้ตามกรอบเวลา",
                Action = defectFrequencies.Any()
                    ? $"เน้นย้ำมาตรฐาน {topDefectShort} เป็นพิเศษ"
                    : "ควรรักษามาตรฐานการสุ่มตรวจตามรอบอย่างต่อเนื่อง",
                GeneratedBy = "Smart Analytics Engine",
                GeneratedAt = DateTime.UtcNow
            };
        }

        // SCHEDULE
        public async Task<ScheduleAiRecommendationsDto> GetScheduleRecommendationsAsync(ClaimsPrincipal user)
        {
            var (_, _, allowedLocationIds) = await UserScopeHelper.GetUserScopeAsync(user, _context);
            var (_, _, allowedBrandIds) = await UserScopeHelper.GetUserBrandScopeAsync(user, _context);

            var now = DateTime.UtcNow;
            var startOfMonth = new DateTime(now.Year, now.Month, 1);
            var endOfMonth = startOfMonth.AddMonths(1).AddTicks(-1);

            var locationsQuery = _context.Locations
                .AsNoTracking()
                .Include(l => l.LocationBrands).ThenInclude(lb => lb.Brand)
                .Where(l => l.IsActive)
                .AsQueryable();

            if (allowedLocationIds != null)
            {
                locationsQuery = locationsQuery.Where(l => allowedLocationIds.Contains(l.Id));
            }
            if (allowedBrandIds != null)
            {
                locationsQuery = locationsQuery.Where(l => l.LocationBrands.Any(lb => allowedBrandIds.Contains(lb.BrandId)));
            }

            var locations = await locationsQuery.ToListAsync();

            var audits = await _context.AuditRecords
                .AsNoTracking()
                .Include(r => r.PrimaryAuditor)
                .OrderByDescending(r => r.AuditDate)
                .ToListAsync();

            var capTasks = await _context.CapTasks
                .AsNoTracking()
                .Where(c => c.Status != "CLOSED" && c.Status != "closed")
                .ToListAsync();

            var auditors = await _context.Users
                .AsNoTracking()
                .Include(u => u.Role)
                .Where(u => u.IsActive && (u.Role!.Code == "AUDITOR" || u.Role!.Code == "STANDARD" || u.Role!.Code == "ADMIN"))
                .ToListAsync();

            var branchStats = new List<ScheduleRecommendationItemDto>();

            foreach (var loc in locations)
            {
                var locAudits = audits.Where(a => a.LocationId == loc.Id).ToList();
                var lastAudit = locAudits.FirstOrDefault();
                var auditedThisMonth = locAudits.Any(a => a.AuditDate >= startOfMonth && a.AuditDate <= endOfMonth);
                var daysSince = lastAudit != null ? (int)(now - lastAudit.AuditDate).TotalDays : 999;
                var pendingCaps = capTasks.Count(c => c.LocationId == loc.Id);
                var lastScore = lastAudit?.PercentageScore;

                // คำนวณความเสี่ยง
                string priority = "MEDIUM";
                var reasons = new List<string>();

                if (!auditedThisMonth)
                {
                    reasons.Add("ยังไม่ได้ตรวจรอบเดือนนี้");
                }

                if (lastScore.HasValue && lastScore.Value < 70)
                {
                    priority = "CRITICAL";
                    reasons.Add($"คะแนนวิกฤต ({lastScore.Value}%)");
                }
                else if (lastScore.HasValue && lastScore.Value < 85)
                {
                    priority = priority == "CRITICAL" ? "CRITICAL" : "HIGH";
                    reasons.Add($"คะแนนตกเกณฑ์ ({lastScore.Value}%)");
                }

                if (pendingCaps > 0)
                {
                    priority = "HIGH";
                    reasons.Add($"CAP ค้าง {pendingCaps} รายการ");
                }

                if (daysSince >= 45 && daysSince < 999)
                {
                    reasons.Add($"ไม่ได้ตรวจมาแล้ว {daysSince} วัน");
                }

                if (lastAudit == null)
                {
                    priority = "HIGH";
                    reasons.Add("ยังไม่มีประวัติตรวจ");
                }

                // แนะนำผู้ตรวจ
                string suggestedAuditor = "";
                string auditorReason = "";
                
                if (lastAudit?.PrimaryAuditor != null && !string.IsNullOrWhiteSpace(lastAudit.PrimaryAuditor.FullName))
                {
                    suggestedAuditor = lastAudit.PrimaryAuditor.FullName;
                    auditorReason = "เคยเข้าตรวจสาขานี้ในรอบก่อนหน้า มีความคุ้นเคยกับประวัติและปัญหาเดิมของสาขา";
                }
                else if (auditors.Any())
                {
                    var assignedAuditor = auditors[loc.Id % auditors.Count];
                    suggestedAuditor = assignedAuditor.FullName;
                    auditorReason = "แนะนำตามการกระจายภาระงานและเขตพื้นที่รับผิดชอบ";
                }

                branchStats.Add(new ScheduleRecommendationItemDto
                {
                    LocationId = loc.Id,
                    LocationName = loc.Name,
                    BrandName = string.Join(", ", loc.LocationBrands.OrderByDescending(lb => lb.IsPrimary).Select(lb => lb.Brand.Name)),
                    Region = loc.Region,
                    PriorityLevel = priority,
                    LastScore = lastScore,
                    LastAuditDate = lastAudit?.AuditDate,
                    DaysSinceLastAudit = daysSince,
                    HasAuditedThisMonth = auditedThisMonth,
                    PendingCapCount = pendingCaps,
                    Reason = reasons.Any() ? string.Join(" • ", reasons) : "ครบกำหนดรอบตรวจตามรอบมาตรฐานประจำเดือน",
                    SuggestedFocus = lastScore < 85 ? "เน้นสุ่มตรวจจุดที่เคยตกเกณฑ์และติดตามผล CAP" : "ตรวจประเมินมาตรฐานประจำเดือนตามปกติ",
                    SuggestedAuditorName = suggestedAuditor,
                    AuditorReason = auditorReason
                });
            }

            // จัดลำดับ: ไม่ได้ตรวจเดือนนี้ + คะแนนต่ำ + CAP ค้าง ขึ้นก่อน
            var ranked = branchStats
                .OrderByDescending(b => !b.HasAuditedThisMonth)
                .ThenBy(b => b.LastScore ?? 0)
                .ThenByDescending(b => b.PendingCapCount)
                .ThenByDescending(b => b.DaysSinceLastAudit)
                .Take(3)
                .ToList();

            var totalPendingMonthly = branchStats.Count(b => !b.HasAuditedThisMonth);

            var apiKey = GetApiKey();
            if (!string.IsNullOrWhiteSpace(apiKey) && ranked.Any())
            {
                try
                {
                    var branchesInfo = string.Join("\n", ranked.Select((b, idx) => 
                        $"{idx+1}. {b.LocationName} ({b.BrandName}): คะแนนล่าสุด {(b.LastScore.HasValue ? b.LastScore + "%" : "ยังไม่เคยตรวจ")}, ประวัติ={(b.DaysSinceLastAudit >= 999 ? "ยังไม่เคยตรวจ" : "ตรวจล่าสุดเมื่อ " + b.DaysSinceLastAudit + " วันก่อน")}, ตรวจเดือนนี้={b.HasAuditedThisMonth}, CAPค้าง={b.PendingCapCount}"));

                    var branchCount = ranked.Count;
                    var prompt = $@"
คุณคือ AI ผู้ช่วยวางแผนตารางตรวจมาตรฐาน QSC (เน้นคำตอบสั้น กระชับ ตรงประเด็น ผู้บริหารอ่านเข้าใจทันที)
กฎองค์กร: ทุกสาขาต้องได้รับการตรวจอย่างน้อย 1 ครั้งต่อเดือน

จงวิเคราะห์ข้อมูลสาขาความเสี่ยงสูงจำนวน {branchCount} สาขานี้ (วิเคราะห์เฉพาะสาขาที่ให้มาเท่านั้น ห้ามคิดสาขาอื่นเพิ่ม) และตอบเป็น JSON สั้นกระชับตามเงื่อนไข:
1. summary: สรุปภาพรวมสั้นมาก 1 ประโยค (ความยาวไม่เกิน 20 คำ โดยสลับสำนวนหรือคำเกริ่นให้หลากหลายในแต่ละรอบ)
2. reasons: เหตุผลของแต่ละสาขาแบบ 'สั้นกระชับมาก 1 ประโยค' (ความยาวไม่เกิน 15 คำต่อสาขา ใช้สำนวนตรงไปตรงมา ห้ามใส่ชื่อสาขาซ้ำในเหตุผล และห้ามพูดถึง 999 วัน) โดยมีจำนวนข้อในอาร์เรย์ reasons เท่ากับ {branchCount} ข้อพอดี

รูปแบบ JSON:
{{
  ""summary"": ""ข้อความสรุปใจความสำคัญสั้นกระชับ 1 ประโยค"",
  ""reasons"": [
     ""เหตุผลสั้นๆ สำหรับสาขาที่ให้มาในรายการ""
  ]
}}

ข้อมูลสาขา:
{branchesInfo}
ตอบเฉพาะ JSON ล้วนๆ
";
                    var aiJson = await CallGeminiRestApiAsync(prompt, apiKey, GetModel());
                    if (!string.IsNullOrWhiteSpace(aiJson))
                    {
                        using var doc = JsonDocument.Parse(aiJson);
                        var root = doc.RootElement;
                        var summary = root.GetProperty("summary").GetString();
                        if (root.TryGetProperty("reasons", out var reasonsArr) && reasonsArr.ValueKind == JsonValueKind.Array)
                        {
                            var rList = reasonsArr.EnumerateArray().Select(x => x.GetString() ?? "").ToList();
                            for (int i = 0; i < ranked.Count && i < rList.Count; i++)
                            {
                                if (!string.IsNullOrWhiteSpace(rList[i]))
                                {
                                    ranked[i].Reason = rList[i];
                                }
                            }
                        }

                        return new ScheduleAiRecommendationsDto
                        {
                            Summary = summary ?? (totalPendingMonthly > 0 ? $"แนะนำเร่งจัดตารางตรวจ {totalPendingMonthly} สาขาความเสี่ยงสูงที่ยังไม่ได้รับการตรวจในเดือนนี้" : "สาขาได้รับการตรวจตามรอบมาตรฐานเรียบร้อยแล้ว"),
                            Recommendations = ranked,
                            TotalBranchesPendingMonthlyAudit = totalPendingMonthly,
                            GeneratedBy = "Gemini AI"
                        };
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Gemini API call failed for Schedule Planner. Using fallback.");
                }
            }

            return new ScheduleAiRecommendationsDto
            {
                Summary = $"แนะนำเร่งจัดตารางตรวจ {totalPendingMonthly} สาขาความเสี่ยงสูงที่ยังไม่ได้รับการตรวจในเดือนนี้",
                Recommendations = ranked,
                TotalBranchesPendingMonthlyAudit = totalPendingMonthly,
                GeneratedBy = "Smart Analytics Engine"
            };
        }

        // CAP CHAT & EVIDENCE ANALYSIS
        // Returns null when the caller has no access to this CAP task's location/brand (controller should respond 403).
        public async Task<CapAiAnalysisDto?> AnalyzeCapTaskAsync(ClaimsPrincipal user, int capTaskId)
        {
            var (currentUserId, _, allowedLocationIds) = await UserScopeHelper.GetUserScopeAsync(user, _context);
            var (_, _, allowedBrandIds) = await UserScopeHelper.GetUserBrandScopeAsync(user, _context);

            var task = await _context.CapTasks
                .AsNoTracking()
                .Include(t => t.Location)
                .Include(t => t.Images)
                .Include(t => t.Comments)
                    .ThenInclude(c => c.Sender)
                .FirstOrDefaultAsync(t => t.Id == capTaskId);

            if (task == null)
            {
                return new CapAiAnalysisDto
                {
                    TaskId = capTaskId,
                    IssueSummary = "ไม่พบข้อมูลงาน CAP ที่ระบุ",
                    AuditorAdvice = "ไม่สามารถวิเคราะห์ได้เนื่องจากไม่พบข้อมูลงานในระบบ"
                };
            }

            // Same ownership rule already enforced in CapController: must have location access
            // (or be the assignee) and, if brand-scoped, the location must carry an allowed brand.
            if (allowedLocationIds != null && !allowedLocationIds.Contains(task.LocationId) && task.AssignedTo != currentUserId)
            {
                return null;
            }
            if (allowedBrandIds != null)
            {
                var brandOk = await _context.LocationBrands
                    .AnyAsync(lb => lb.LocationId == task.LocationId && allowedBrandIds.Contains(lb.BrandId));
                if (!brandOk)
                {
                    return null;
                }
            }

            var beforeImgs = task.Images.Where(i => i.Phase == "BEFORE").ToList();
            var afterImgs = task.Images.Where(i => i.Phase == "AFTER").ToList();
            var comments = task.Comments.OrderBy(c => c.CreatedAt).ToList();

            var chatHistory = comments.Any()
                ? string.Join("\n", comments.Select(c => $"[{c.Sender?.FullName ?? "ผู้ใช้"}]: {c.Message}"))
                : "ยังไม่มีการสนทนาในห้องแชท";

            var apiKey = GetApiKey();
            if (!string.IsNullOrWhiteSpace(apiKey))
            {
                try
                {
                    var prompt = $@"
คุณคือ AI ผู้ช่วยผู้ประเมินมาตรฐานคุณภาพ (QSC Lead Auditor Assistant)
หน้าที่ของคุณคือ อ่านข้อมูลข้อบกพร่อง รูปภาพ และประวัติการแชทพูดคุยระหว่างสาขากับผู้ตรวจ เพื่อช่วยแนะนำผู้ประเมินว่าควรพิจารณาอย่างไร (ผู้ประเมินเป็นผู้ตัดสินใจจริง)
ให้ใช้สำนวนภาษาไทยอย่างเป็นธรรมชาติ มีความสดใหม่และสร้างสรรค์ในข้อเสนอแนะ ไม่ใช้ประโยคซ้ำเดิม

ข้อมูลงาน CAP:
- สาขา: {task.Location?.Name}
- หัวข้อข้อบกพร่อง: {task.IssueItem}
- รายละเอียดปัญหา: {task.Description}
- กำหนดส่งงาน: {task.SubmissionDeadline:yyyy-MM-dd}
- รูปภาพก่อนแก้ (Before Images): มี {beforeImgs.Count} รูป
- รูปภาพหลังแก้ (After Images): มี {afterImgs.Count} รูป
- ประวัติการพูดคุยในแชท:
{chatHistory}

จงวิเคราะห์และตอบเป็น JSON ภาษาไทยดังนี้:
{{
  ""issueSummary"": ""สรุปปัญหาและสิ่งที่สาขาต้องทำสั้นๆ 1 ประโยค"",
  ""progressStatus"": ""สรุปสถานะความคืบหน้าปัจจุบันตามที่สาขาแจ้งในแชท 1 ประโยค"",
  ""strengthPoints"": [""จุดที่ดี / ข้อดีที่สาขาทำได้ตรงเกณฑ์ 1-2 ข้อ""],
  ""areasToVerify"": [""จุดที่ควรดูเพิ่ม / จุดที่ต้องระวังหรือสังเกตเพิ่มเติม 1-2 ข้อ""],
  ""nextAuditAdvice"": ""คำแนะนำสำหรับการตรวจรอบถัดไป (เช่น จุดที่ควรสุ่มตรวจซ้ำ หรือปล่อยว่าง null หากไม่มีข้อแนะนำพิเศษ)"",
  ""confidencePercent"": 92,
  ""auditorAdvice"": ""คำแนะนำชัดเจนสำหรับผู้ตรวจประเมิน"",
  ""readinessToClose"": ""READY_TO_REVIEW"" หรือ ""PENDING_PROOF"" หรือ ""REJECT_SUGGESTED""
}}
ตอบเฉพาะ JSON ล้วนๆ
";
                    var aiJson = await CallGeminiRestApiAsync(prompt, apiKey, GetModel());
                    if (!string.IsNullOrWhiteSpace(aiJson))
                    {
                        var parsed = JsonSerializer.Deserialize<CapAiAnalysisDto>(aiJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                        if (parsed != null)
                        {
                            parsed.TaskId = capTaskId;
                            parsed.SavedNextAuditNote = task.NextAuditNote;
                            parsed.FollowUpStatus = task.FollowUpStatus;
                            if (parsed.ConfidencePercent <= 0) parsed.ConfidencePercent = 90;
                            return parsed;
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Gemini API call failed for CAP Analysis. Using rule-based fallback.");
                }
            }

            // Fallback
            var hasAfter = afterImgs.Any();
            var hasChat = comments.Count > 0;

            var strengths = new List<string>();
            var toVerify = new List<string>();
            string advice;
            string readiness;
            int confidence = 78;
            string? nextAdvice = null;

            if (hasAfter && hasChat)
            {
                strengths.Add("สาขาได้ส่งรูปภาพหลักฐานหลังการแก้ไขเรียบร้อยแล้ว");
                strengths.Add("มีการชี้แจงรายละเอียดการแก้ไขผ่านระบบแชท");
                toVerify.Add("ตรวจสอบว่ารูปภาพหลังแก้ครอบคลุมจุดบกพร่องเดิมอย่างชัดเจน");
                nextAdvice = "สุ่มตรวจจุดนี้ซ้ำในรอบถัดไปเพื่อติดตามว่ายังคงรักษามาตรฐานได้ต่อเนื่องหรือไม่";
                advice = "หลักฐานเบื้องต้นครบถ้วน แนะนำให้ผู้ประเมินตรวจสอบความคมชัดของรูปภาพก่อนกดอนุมัติปิดงาน";
                readiness = "READY_TO_REVIEW";
                confidence = 94;
            }
            else if (hasChat && !hasAfter)
            {
                strengths.Add("สาขาได้ตอบรับและแจ้งความคืบหน้าในแชทแล้ว");
                toVerify.Add("สาขายังไม่ได้แนบรูปถ่ายหลักฐานยืนยันหลังการปรับปรุงแก้ไข");
                advice = "สาขารายงานข้อความแล้วแต่ยังขาดรูปถ่ายจริง แนะนำให้ผู้ตรวจพิมพ์ขอรูปภาพ Before/After เพิ่มเติมก่อนพิจารณาปิดงาน";
                readiness = "PENDING_PROOF";
                confidence = 86;
            }
            else
            {
                toVerify.Add("ยังไม่พบการตอบกลับหรือส่งหลักฐานจากทางสาขา");
                advice = "ยังไม่มีความคืบหน้า แนะนำให้ผู้ตรวจส่งข้อความติดตามผลผ่านแชทก่อนถึงกำหนดเวลา SLA";
                readiness = "PENDING_PROOF";
                confidence = 80;
            }

            return new CapAiAnalysisDto
            {
                TaskId = capTaskId,
                IssueSummary = task.IssueItem,
                ProgressStatus = hasChat ? "สาขาได้เริ่มดำเนินการและแจ้งข้อมูลในแชทแล้ว" : "อยู่ระหว่างรอสาขาดำเนินการ",
                StrengthPoints = strengths,
                AreasToVerify = toVerify,
                NextAuditAdvice = nextAdvice,
                ConfidencePercent = confidence,
                AuditorAdvice = advice,
                ReadinessToClose = readiness,
                SavedNextAuditNote = task.NextAuditNote,
                FollowUpStatus = task.FollowUpStatus
            };
        }

        // ── 💬 INTERACTIVE Q&A FOR SCHEDULE ADVISOR ──
        public async Task<string> AskScheduleQuestionAsync(ClaimsPrincipal user, string question)
        {
            if (string.IsNullOrWhiteSpace(question)) return "กรุณาระบุคำถามที่ต้องการถาม AI ครับ";

            var scheduleData = await GetScheduleRecommendationsAsync(user);
            var branchesSummary = string.Join("\n", scheduleData.Recommendations.Select((b, i) =>
                $"- อันดับ {i + 1}: สาขา {b.LocationName} ({b.BrandName}), เขต {b.Region}, ความเร่งด่วน {b.PriorityLevel}, ตรวจเดือนนี้={(b.HasAuditedThisMonth ? "ตรวจแล้ว" : "ยังไม่ตรวจ")}, เหตุผล: {b.Reason}, ผู้ตรวจแนะนำ: {b.SuggestedAuditorName} ({b.AuditorReason})"));

            var apiKey = GetApiKey();
            if (!string.IsNullOrWhiteSpace(apiKey))
            {
                try
                {
                    var prompt = $@"
คุณคือ AI ผู้ช่วยวางแผนตารางตรวจมาตรฐาน QSC ขององค์กร (ให้คำตอบสั้น กระชับ ตรงประเด็น เป็นกันเองและสุภาพ)
ข้อมูลการจัดอันดับสาขาเร่งด่วน:
{branchesSummary}

สถิติภาพรวม:
- สาขาค้างตรวจในเดือนนี้: {scheduleData.TotalBranchesPendingMonthlyAudit} สาขา

คำถามของผู้ใช้: ""{question}""

คำแนะนำในการตอบ:
- ตอบเป็นภาษาไทย ความยาวสั้นกระชับ 2-3 ประโยค
- อธิบายเหตุผลหรือผู้ตรวจที่เหมาะสมให้ชัดเจนตามข้อมูลจริง
- ตอบเป็นข้อความธรรมดา ไม่ต้องมี JSON
";
                    var answer = await CallGeminiRestApiAsync(prompt, apiKey, GetModel(), isJson: false);
                    if (!string.IsNullOrWhiteSpace(answer))
                    {
                        return answer.Trim();
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Gemini API call failed for AskScheduleQuestion.");
                }
            }

            // Fallback smart rule-based reply
            if (question.Contains("ทำไม") || question.Contains("เร่งด่วน") || question.Contains("สาขาแรก"))
            {
                var top = scheduleData.Recommendations.FirstOrDefault();
                if (top != null)
                {
                    return $"สาขา {top.LocationName} ถูกจัดเป็นอันดับแรกเนื่องจาก {top.Reason} และยังไม่ได้รับการตรวจในรอบเดือนนี้ จึงมีความเสี่ยงต่อมาตรฐาน QSC สูงที่สุดครับ";
                }
            }

            if (question.Contains("ใคร") || question.Contains("ผู้ตรวจ") || question.Contains("Auditor"))
            {
                var top = scheduleData.Recommendations.FirstOrDefault();
                if (top != null)
                {
                    return $"สำหรับสาขา {top.LocationName} แนะนำให้ {top.SuggestedAuditorName} เป็นผู้เข้าตรวจ เนื่องจาก {top.AuditorReason} ครับ";
                }
            }

            return $"จากข้อมูลล่าสุด มีสาขาค้างตรวจในเดือนนี้ {scheduleData.TotalBranchesPendingMonthlyAudit} สาขา โดยแนะนำให้จัดทีมลงตรวจสาขาความเสี่ยงสูง 3 อันดับแรกก่อน เพื่อรักษามาตรฐาน QSC ประจำเดือนครับ";
        }

        // ── 🌐 GEMINI REST API CALL HELPER ──
        private async Task<string?> CallGeminiRestApiAsync(string prompt, string apiKey, string model, bool isJson = true)
        {
            var client = _httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(8);

            var endpoint = $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}";

            object generationConfig = isJson
                ? new { responseMimeType = "application/json", temperature = 0.6, topP = 0.95 }
                : new { temperature = 0.7, topP = 0.95 };

            var requestBody = new
            {
                contents = new[]
                {
                    new
                    {
                        parts = new[]
                        {
                            new { text = prompt }
                        }
                    }
                },
                generationConfig
            };

            var content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
            var response = await client.PostAsync(endpoint, content);

            if (!response.IsSuccessStatusCode)
            {
                var errorText = await response.Content.ReadAsStringAsync();
                _logger.LogWarning("Gemini API error ({StatusCode}): {Error}", response.StatusCode, errorText);
                return null;
            }

            var responseJson = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(responseJson);
            var root = doc.RootElement;

            if (root.TryGetProperty("candidates", out var candidates) && candidates.GetArrayLength() > 0)
            {
                var firstCandidate = candidates[0];
                if (firstCandidate.TryGetProperty("content", out var cObj) &&
                    cObj.TryGetProperty("parts", out var parts) && parts.GetArrayLength() > 0)
                {
                    var text = parts[0].GetProperty("text").GetString();
                    return text;
                }
            }

            return null;
        }
    }
}