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

    // 🌟 DTO ผลวิเคราะห์ข้อบกพร่องหน้า "ผลการตรวจ" — ตั้งใจให้สั้น/กระชับ (หมวดหมู่ + จำนวน)
    // ใช้โครงเดียวกันทั้งตอน AI ตอบสำเร็จและตอน fallback แบบกฎง่ายๆ เพื่อให้ UI ไม่ต้องมี 2 แบบ
    public class AuditDefectCategoryGroupDto
    {
        [JsonPropertyName("category")]
        public string Category { get; set; } = string.Empty;

        [JsonPropertyName("count")]
        public int Count { get; set; }

        [JsonPropertyName("note")]
        public string Note { get; set; } = string.Empty; // สรุปปัญหาที่ตรวจพบสั้นๆ 1 ประโยค

        [JsonPropertyName("action")]
        public string Action { get; set; } = string.Empty; // วิธีแก้ไขที่แนะนำ สั้นกระชับ 1 ประโยค นำไปปฏิบัติได้จริง
    }

    public class AuditDefectAnalysisDto
    {
        [JsonPropertyName("auditRecordId")]
        public int AuditRecordId { get; set; }

        [JsonPropertyName("summary")]
        public string Summary { get; set; } = string.Empty; // สรุปรวม 1 ประโยคสั้นๆ

        [JsonPropertyName("categoryGroups")]
        public List<AuditDefectCategoryGroupDto> CategoryGroups { get; set; } = new();

        [JsonPropertyName("priorityFocus")]
        public string PriorityFocus { get; set; } = string.Empty; // จุดที่ควรแก้ก่อน 1 ประโยคสั้นๆ

        [JsonPropertyName("generatedBy")]
        public string GeneratedBy { get; set; } = "AI Engine";

        [JsonPropertyName("generatedAt")]
        public DateTime? GeneratedAt { get; set; }

        [JsonPropertyName("disclaimer")]
        public string Disclaimer { get; set; } = "คำแนะนำนี้ประมวลผลโดย AI เพื่อช่วยผู้ตรวจประกอบการพิจารณา ไม่ใช่คำตัดสินสุดท้าย";
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

        private string GetBaseUrl()
        {
            return _config["AI:BaseUrl"]
                ?? Environment.GetEnvironmentVariable("AI_BASE_URL")
                ?? "http://localhost:11434";
        }

        private bool IsAiEnabled()
        {
            var raw = _config["AI:Enabled"];
            if (string.IsNullOrWhiteSpace(raw)) return true; // เปิดใช้งาน AI เป็นค่าเริ่มต้น (local ไม่ต้องมี API key)
            return bool.TryParse(raw, out var enabled) && enabled;
        }

        private string GetModel()
        {
            return _config["AI:Model"] ?? "qwen3.5:9b";
        }

        // DASHBOARD
        public async Task<DashboardAiInsightsDto> GetDashboardInsightsAsync(
            ClaimsPrincipal user, 
            DateTime? targetMonth = null,
            string? period = "month",
            int? brandId = null)
        {
            var (_, _, allowedLocationIds) = await UserScopeHelper.GetUserScopeAsync(user, _context);
            var (_, _, allowedBrandIds) = await UserScopeHelper.GetUserBrandScopeAsync(user, _context);

            // 🌟 Auto-resolve brandId if not explicitly provided:
            // 1) User is restricted to 1 brand in UserBrands
            // 2) Or all user's accessible locations belong to exactly 1 brand
            if (!brandId.HasValue)
            {
                if (allowedBrandIds != null && allowedBrandIds.Count == 1)
                {
                    brandId = allowedBrandIds.First();
                }
                else if (allowedLocationIds != null && allowedLocationIds.Count > 0)
                {
                    var locBrandIds = await _context.LocationBrands
                        .Where(lb => allowedLocationIds.Contains(lb.LocationId))
                        .Select(lb => lb.BrandId)
                        .Distinct()
                        .ToListAsync();
                    if (locBrandIds.Count == 1)
                    {
                        brandId = locBrandIds[0];
                    }
                }
            }

            DateTime startUtc, endUtc;
            if (targetMonth.HasValue)
            {
                startUtc = new DateTime(targetMonth.Value.Year, targetMonth.Value.Month, 1, 0, 0, 0, DateTimeKind.Utc);
                endUtc = startUtc.AddMonths(1).AddTicks(-1);
            }
            else
            {
                var ranges = TimezoneHelper.GetPeriodDateRanges(period);
                startUtc = ranges.StartUtc;
                endUtc = ranges.EndUtc;
            }

            // 🚀 Query 1: ดึงเฉพาะข้อมูลสรุปสถิติที่จำเป็น (id, score, isPassed) ไม่ Include entity responses มหาศาล
            var auditQuery = _context.AuditRecords
                .AsNoTracking()
                .Where(r => r.AuditDate >= startUtc && r.AuditDate <= endUtc);

            if (allowedLocationIds != null)
            {
                auditQuery = auditQuery.Where(r => allowedLocationIds.Contains(r.LocationId));
            }
            if (brandId.HasValue)
            {
                auditQuery = auditQuery.Where(r => r.Location != null && r.Location.LocationBrands.Any(lb => lb.BrandId == brandId.Value));
            }
            else if (allowedBrandIds != null)
            {
                auditQuery = auditQuery.Where(r => r.Location != null && r.Location.LocationBrands.Any(lb => allowedBrandIds.Contains(lb.BrandId)));
            }

            var auditStats = await auditQuery
                .Select(r => new { r.Id, r.PercentageScore, r.IsPassed })
                .ToListAsync();

            var totalAudits = auditStats.Count;
            var avgScore = totalAudits > 0 ? Math.Round(auditStats.Average(r => r.PercentageScore), 2) : 0;
            var passCount = auditStats.Count(r => r.IsPassed);
            var passRate = totalAudits > 0 ? Math.Round((double)passCount / totalAudits * 100, 2) : 0;

            // 🚀 Query 2: นับจำนวนงาน CAP ค้างด้วย CountAsync ตรงๆ ใน DB (ไม่โหลดทั้ง Entity เข้า Memory)
            var pendingCapsQuery = _context.CapTasks
                .AsNoTracking()
                .Where(c => c.Status != "CLOSED" && c.Status != "closed" && c.Status != "CANCELLED" && c.Status != "cancelled");

            if (allowedLocationIds != null)
            {
                pendingCapsQuery = pendingCapsQuery.Where(c => allowedLocationIds.Contains(c.LocationId));
            }
            if (brandId.HasValue)
            {
                pendingCapsQuery = pendingCapsQuery.Where(c => c.Location != null && c.Location.LocationBrands.Any(lb => lb.BrandId == brandId.Value));
            }
            else if (allowedBrandIds != null)
            {
                pendingCapsQuery = pendingCapsQuery.Where(c => c.Location != null && c.Location.LocationBrands.Any(lb => allowedBrandIds.Contains(lb.BrandId)));
            }

            var pendingCapsCount = await pendingCapsQuery.CountAsync();

            // 🚀 Query 2.1: ดึงรายละเอียดหัวข้อปัญหาของงาน CAP ค้าง เพื่อให้ AI และ Fallback สรุปหัวข้อได้ชัดเจน
            var pendingCapList = await pendingCapsQuery
                .Select(c => new { 
                    c.CategoryName, 
                    c.IssueItem 
                })
                .Take(10)
                .ToListAsync();

            var pendingIssues = pendingCapList
                .Select(c => {
                    if (!string.IsNullOrWhiteSpace(c.CategoryName) && c.CategoryName.Trim() != "ทั่วไป")
                    {
                        return c.CategoryName.Trim();
                    }
                    var text = (c.IssueItem ?? "").Replace(".", "").Trim();
                    if (text.Contains("Take Home", StringComparison.OrdinalIgnoreCase)) return "สินค้า Take Home";
                    if (text.Contains("ป้ายสินค้า", StringComparison.OrdinalIgnoreCase)) return "ป้ายสินค้า";
                    var parts = text.Split(new[] { '/', '-', '(', ',' }, StringSplitOptions.RemoveEmptyEntries);
                    return parts.Length > 0 ? parts[0].Trim() : (string.IsNullOrWhiteSpace(text) ? "ทั่วไป" : text);
                })
                .Where(s => !string.IsNullOrWhiteSpace(s) && !s.StartsWith("ข้อ"))
                .Distinct()
                .Take(4)
                .ToList();

            string pendingCapSummary = pendingIssues.Count > 0 
                ? string.Join(", ", pendingIssues) 
                : "ไม่มีงานค้างส่ง";

            // 🚀 Query 3: หาข้อบกพร่องที่พบบ่อยสุดรายข้อ (คำถามจริง + หมวดหมู่) เพื่อให้คำแนะนำเจาะจงไม่ปลายเปิด
            var auditIds = auditStats.Select(a => a.Id).ToList();
            string topDefectShort = "ไม่พบข้อบกพร่อง";
            string topDefectQuestion = "";
            var topFailedQuestionsFormatted = new List<string>();

            if (auditIds.Count > 0)
            {
                var topDefectItems = await _context.AuditResponses
                    .AsNoTracking()
                    .Where(res => auditIds.Contains(res.AuditRecordId) && !res.IsPassed && !res.IsNa)
                    .GroupBy(res => new {
                        Category = res.CategoryName ?? (res.SurveyItem != null ? res.SurveyItem.CategoryName : "ทั่วไป"),
                        Question = res.SurveyItem != null ? res.SurveyItem.QuestionText : (res.CategoryName ?? "ทั่วไป")
                    })
                    .Select(g => new { 
                        Category = g.Key.Category, 
                        Question = g.Key.Question, 
                        Count = g.Count() 
                    })
                    .OrderByDescending(x => x.Count)
                    .Take(3)
                    .ToListAsync();

                if (topDefectItems.Count > 0)
                {
                    topDefectShort = topDefectItems[0].Category ?? "ทั่วไป";
                    
                    // สกัดชื่อข้อคำถามให้เป็นสาระสำคัญจริง ไม่เป็นแค่ตัวเลข เช่น "ข้อ 14"
                    string ExtractMeaningfulTopic(string? raw, string? category)
                    {
                        if (string.IsNullOrWhiteSpace(raw)) return "";
                        var text = raw.Trim();

                        var parts = text.Split(new[] { '-', ':', '—', '/' }, StringSplitOptions.RemoveEmptyEntries)
                                        .Select(p => p.Trim())
                                        .Where(p => !string.IsNullOrWhiteSpace(p))
                                        .ToList();

                        if (parts.Count > 1)
                        {
                            if (System.Text.RegularExpressions.Regex.IsMatch(parts[0], @"^(ข้อที่?\s*\d+|\d+\.?)$", System.Text.RegularExpressions.RegexOptions.IgnoreCase))
                            {
                                text = string.Join(" ", parts.Skip(1));
                            }
                            else
                            {
                                text = parts[0];
                            }
                        }

                        text = System.Text.RegularExpressions.Regex.Replace(text, @"^(ข้อที่?\s*\d+[\.:\s\-]*|\d+[\.:\s\-]+)", "", System.Text.RegularExpressions.RegexOptions.IgnoreCase).Trim();
                        text = text.Trim('.', '-', ':', ' ', '"', '\'');

                        if (string.IsNullOrWhiteSpace(text) || System.Text.RegularExpressions.Regex.IsMatch(text, @"^(ข้อที่?\s*\d+|\d+)$", System.Text.RegularExpressions.RegexOptions.IgnoreCase))
                        {
                            if (!string.IsNullOrWhiteSpace(category) && category != "ทั่วไป")
                            {
                                return $"หมวด{category}";
                            }
                            return "";
                        }

                        return text;
                    }

                    topDefectQuestion = ExtractMeaningfulTopic(topDefectItems[0].Question, topDefectItems[0].Category);

                    foreach (var item in topDefectItems)
                    {
                        var cleanPart = ExtractMeaningfulTopic(item.Question, item.Category);
                        var desc = !string.IsNullOrWhiteSpace(cleanPart) ? cleanPart : item.Category;
                        topFailedQuestionsFormatted.Add($"- หมวด{item.Category}: {desc} (ตก {item.Count} ครั้ง)");
                    }
                }
            }

            var failedListText = topFailedQuestionsFormatted.Count > 0 
                ? string.Join("\n", topFailedQuestionsFormatted)
                : "- ไม่พบข้อบกพร่องเด่นชัด";

            string brandLabel = "ทุกแบรนด์";
            if (brandId.HasValue)
            {
                string? bName = await _context.Brands.Where(b => b.Id == brandId.Value).Select(b => b.Name).FirstOrDefaultAsync();
                if (!string.IsNullOrEmpty(bName)) brandLabel = bName;
            }
            else if (allowedBrandIds != null && allowedBrandIds.Count > 1)
            {
                var allowedNames = await _context.Brands.Where(b => allowedBrandIds.Contains(b.Id)).Select(b => b.Name).ToListAsync();
                if (allowedNames.Count > 0) brandLabel = string.Join(", ", allowedNames);
            }

            string periodLabel = period switch
            {
                "last_month" => "เดือนที่แล้ว",
                "3m" => "3 เดือนย้อนหลัง",
                "6m" => "6 เดือนย้อนหลัง",
                "ytd" => "ตั้งแต่ต้นปี (YTD)",
                _ => "เดือนนี้"
            };

            if (IsAiEnabled())
            {
                try
                {
                    var prompt = $@"
คุณคือ AI ผู้เชี่ยวชาญด้านระบบควบคุมคุณภาพมาตรฐานร้านอาหาร (QSC) เน้นตอบสั้น กระชับ ตรงประเด็น
ข้อมูลสรุปการตรวจประเมินจริงของแบรนด์ {brandLabel} (ช่วงเวลา: {periodLabel}):
- แบรนด์: {brandLabel}
- รอบตรวจทั้งหมด: {totalAudits} ครั้ง (คะแนนเฉลี่ย {avgScore}%, ผ่านเกณฑ์ {passRate}%)
- งาน CAP ที่ค้างอยู่ ({pendingCapsCount} รายการ): {pendingCapSummary}
- จุดที่ตรวจตกบ่อยที่สุดจริงในหน้างานของแบรนด์ {brandLabel}:
{failedListText}

คำสั่งสร้างผลวิเคราะห์เป็น JSON ภาษาไทย (สั้น กระชับ ตรงประเด็น ไม่เกริ่น):
{{
  ""highlight"": ""สรุปผลคะแนนเฉลี่ยและอัตราผ่านของแบรนด์ {brandLabel} 1 ประโยคสั้น (เช่น คะแนนเฉลี่ย ({brandLabel}) {avgScore}% ผ่านเกณฑ์ {passRate}%)"",
  ""attention"": ""ระบุจำนวนงาน CAP ค้าง และสรุปสั้นๆ ว่าพบปัญหาในหัวข้ออะไรบ้างให้ชัดเจน (เช่น งาน CAP ค้าง {pendingCapsCount} รายการ พบปัญหาเรื่อง{pendingCapSummary})"",
  ""action"": ""เสนอแนวทางแก้ไขหรือข้อปฏิบัติที่เจาะจงชัดเจนตรงจุดตามปัญหาที่ตรวจตกจริงของแบรนด์ {brandLabel} ห้ามตอบกว้างๆ ปลายเปิด และห้ามระบุแค่หมายเลขข้อ เช่น ข้อ 14 โดยไม่มีชื่อเรื่อง (เช่น กวดขันเรื่อง{(!string.IsNullOrWhiteSpace(topDefectQuestion) ? topDefectQuestion : topDefectShort)} และตรวจสอบสต๊อกทุกกะ)""
}}
ตอบเฉพาะ JSON ล้วนๆ
";
                    var aiResultJson = await CallLocalAiApiAsync(prompt, GetModel());
                    if (!string.IsNullOrWhiteSpace(aiResultJson))
                    {
                        var parsed = JsonSerializer.Deserialize<DashboardAiInsightsDto>(aiResultJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                        if (parsed != null && !string.IsNullOrWhiteSpace(parsed.Highlight))
                        {
                            parsed.GeneratedBy = $"Local AI ({GetModel()})";
                            parsed.GeneratedAt = DateTime.UtcNow;
                            return parsed;
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Local AI API call failed for Dashboard Insights. Falling back to rule-based.");
                }
            }

            // Fallback: ข้อความสั้น กระชับ เจาะจงชัดเจน ไม่ปลายเปิด
            string fallbackAttention = pendingCapsCount > 0
                ? $"งาน CAP ค้าง {pendingCapsCount} รายการ (พบปัญหา: {pendingCapSummary})"
                : "ไม่มีงานค้างส่ง CAP จัดการได้ตามกรอบเวลา";

            string fallbackAction;
            if (!string.IsNullOrWhiteSpace(topDefectQuestion))
            {
                if (topDefectQuestion.StartsWith("หมวด"))
                {
                    fallbackAction = $"กวดขันและติดตามการแก้ไขมาตรฐาน{topDefectQuestion} อย่างใกล้ชิด";
                }
                else
                {
                    fallbackAction = $"เน้นย้ำมาตรฐานเรื่อง \"{topDefectQuestion}\" ทันที";
                }
            }
            else if (pendingIssues.Count > 0)
            {
                var issue = pendingIssues[0];
                fallbackAction = issue.StartsWith("หมวด")
                    ? $"กวดขันและติดตามการแก้ไขมาตรฐาน{issue} ทันที"
                    : $"กวดขันและแก้ไขปัญหาเรื่อง \"{issue}\" ทันที";
            }
            else if (!string.IsNullOrWhiteSpace(topDefectShort) && topDefectShort != "ไม่พบข้อบกพร่อง" && topDefectShort != "ทั่วไป")
            {
                fallbackAction = $"ติดตามการแก้ไขมาตรฐานหมวด{topDefectShort} อย่างใกล้ชิด";
            }
            else
            {
                fallbackAction = "ควรรักษามาตรฐานการสุ่มตรวจตามรอบอย่างต่อเนื่อง";
            }

            return new DashboardAiInsightsDto
            {
                Highlight = totalAudits > 0
                    ? $"คะแนนเฉลี่ย ({brandLabel}) {avgScore}% ผ่านเกณฑ์ {passRate}%"
                    : $"ยังไม่มีรอบตรวจของ {brandLabel} ในช่วง{periodLabel}",
                Attention = fallbackAttention,
                Action = fallbackAction,
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
                .Where(c => c.Status != "CLOSED" && c.Status != "closed" && c.Status != "CANCELLED" && c.Status != "cancelled")
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
                    BrandName = string.Join(", ", loc.LocationBrands.Select(lb => lb.Brand?.Name).Where(n => !string.IsNullOrEmpty(n))),
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

            if (IsAiEnabled() && ranked.Any())
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
                    var aiJson = await CallLocalAiApiAsync(prompt, GetModel());
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
                            GeneratedBy = $"Local AI ({GetModel()})"
                        };
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Local AI API call failed for Schedule Planner. Using fallback.");
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

            if (IsAiEnabled())
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
                    var aiJson = await CallLocalAiApiAsync(prompt, GetModel());
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
                    _logger.LogWarning(ex, "Local AI API call failed for CAP Analysis. Using rule-based fallback.");
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

        // ── 🩺 AI ANALYSIS FOR AUDIT RESULT PAGE ("ผลการตรวจ") ──
        // คืน null เมื่อ user ไม่มีสิทธิ์เข้าถึง audit record นี้ (เช็คแบบเดียวกับ GetAuditRecords)
        public async Task<AuditDefectAnalysisDto?> AnalyzeAuditRecordDefectsAsync(ClaimsPrincipal user, int auditRecordId, bool forceRefresh = false)
        {
            var (_, role, allowedLocationIds) = await UserScopeHelper.GetUserScopeAsync(user, _context);
            var (_, _, allowedBrandIds) = await UserScopeHelper.GetUserBrandScopeAsync(user, _context);

            var record = await _context.AuditRecords
                .Include(r => r.Location)
                    .ThenInclude(l => l!.LocationBrands)
                .Include(r => r.Responses)
                    .ThenInclude(resp => resp.SurveyItem)
                .FirstOrDefaultAsync(r => r.Id == auditRecordId);

            if (record == null) return null;

            // 🌟 เช็คสิทธิ์เข้าถึง — เหมือน guard ที่ใช้ใน GetAuditRecords ทุกประการ กัน user เห็นข้อมูลสาขาที่ไม่ใช่ของตัวเอง
            // หมายเหตุ: role AUDITEE ที่ allowedLocationIds เป็น null หมายถึง "ไม่มีสิทธิ์เข้าถึงสาขาไหนเลย" (deny-by-default)
            // ต่างจาก role อื่นที่ null หมายถึง "ไม่ถูกจำกัด" (เช่น แอดมิน/ผู้บริหาร) — ต้องแยกเช็คให้ตรงกับ GetAuditRecords
            if (role == "AUDITEE" && allowedLocationIds == null)
            {
                return null;
            }
            if (allowedLocationIds != null && !allowedLocationIds.Contains(record.LocationId))
            {
                return null;
            }
            if (allowedBrandIds != null)
            {
                var brandOk = record.Location != null &&
                    record.Location.LocationBrands.Any(lb => allowedBrandIds.Contains(lb.BrandId));
                if (!brandOk) return null;
            }

            // 🌟 ใช้ผลที่เคย generate ไว้แล้ว ถ้ามี (และต้องมี action ครบในทุกหมวดหมู่)
            if (!forceRefresh && !string.IsNullOrWhiteSpace(record.AiAnalysisJson))
            {
                try
                {
                    var cached = JsonSerializer.Deserialize<AuditDefectAnalysisDto>(record.AiAnalysisJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                    // ถ้าแคชเดิมมี action ครบในทุกหมวด ให้ใช้แคชได้เลย ถ้าเป็นรุ่นเก่าที่ไม่มี action ให้ปล่อย generate ใหม่
                    if (cached != null && (cached.CategoryGroups.Count == 0 || cached.CategoryGroups.All(c => !string.IsNullOrWhiteSpace(c.Action))))
                    {
                        return cached;
                    }
                }
                catch { /* ผลเก่ารูปแบบไม่ตรง ปล่อยให้ generate ใหม่ */ }
            }

            var defects = record.Responses.Where(r => !r.IsPassed && !r.IsNa).ToList();

            // 🌟 ไม่มีข้อบกพร่องเลย ไม่ต้องยิง AI เลย ประหยัดทรัพยากร local server
            if (defects.Count == 0)
            {
                var passResult = new AuditDefectAnalysisDto
                {
                    AuditRecordId = auditRecordId,
                    Summary = "ไม่พบข้อบกพร่องในการตรวจครั้งนี้",
                    PriorityFocus = "ไม่มีจุดที่ต้องแก้ไขเร่งด่วน",
                    GeneratedBy = "Rule-based",
                    GeneratedAt = DateTime.UtcNow
                };
                await SaveAuditAnalysisAsync(auditRecordId, passResult);
                return passResult;
            }

            // 🌟 จำกัดจำนวนข้อบกพร่องที่ส่งเข้า prompt กัน prompt ยาวเกินจนช้า/timeout (ส่งแค่ข้อความ ไม่ส่งรูป)
            var defectsForPrompt = defects.Take(20).Select(d => new
            {
                category = d.CategoryName ?? d.SurveyItem?.CategoryName ?? "ไม่ระบุหมวด",
                question = d.SurveyItem?.QuestionText ?? "",
                note = d.Notes ?? ""
            }).ToList();

            var groupedByCategory = defects
                .GroupBy(d => d.CategoryName ?? d.SurveyItem?.CategoryName ?? "ไม่ระบุหมวด")
                .Select(g => new { category = g.Key, count = g.Count() })
                .OrderByDescending(g => g.count)
                .ToList();

            if (IsAiEnabled())
            {
                try
                {
                    var defectListText = string.Join("\n", defectsForPrompt.Select((d, i) =>
                        $"{i + 1}. [{d.category}] {d.question}{(string.IsNullOrWhiteSpace(d.note) ? "" : $" — หมายเหตุผู้ตรวจ: {d.note}")}"));

                    var prompt = $@"
คุณคือ AI ผู้ช่วยตรวจสอบมาตรฐานคุณภาพ QSC (เน้นตอบสั้น กระชับ ตรงประเด็นแบบผู้บริหาร ตัดคำเกริ่นและคำเชื่อมที่ยืดเยื้อออกทั้งหมด เอาเฉพาะเนื้อหาสำคัญที่ต้องปฏิบัติ)

กฎการตอบอย่างเคร่งครัด:
- ห้ามใช้คำเกริ่นยืดเยื้อ เช่น 'พบปัญหาหลักได้แก่', 'ซึ่งส่งผลกระทบต่อ...', 'เพื่อป้องกันความเสี่ยง'
- summary: สรุปประเด็นสำคัญสั้นมาก 1 ประโยค (ความยาวไม่เกิน 15 คำ)
- note: ระบุปัญหาที่พบแบบสั้นกระชับ ตรงจุดที่สุด (ไม่เกิน 15 คำ)
- action: ระบุสิ่งที่ต้องทำทันที ขึ้นต้นด้วยกริยาปฏิบัติชัดเจน (ไม่เกิน 15 คำ)
- priorityFocus: สิ่งที่ต้องทำด่วนที่สุดเป็นอันดับแรก 1 ประโยคสั้น (ไม่เกิน 15 คำ)

รายการข้อบกพร่องที่ตรวจพบ ({defects.Count} ข้อ):
{defectListText}

ตอบเป็น JSON ภาษาไทยตามโครงสร้างนี้เท่านั้น:
{{
  ""summary"": ""สรุปประเด็นสำคัญสั้นมาก 1 ประโยค"",
  ""categoryGroups"": [
    {{
      ""category"": ""ชื่อหมวดหมู่"",
      ""count"": จำนวนข้อในหมวดนี้,
      ""note"": ""ปัญหาที่พบแบบตรงจุดสั้นกระชับ"",
      ""action"": ""สิ่งที่ต้องทำทันที""
    }}
  ],
  ""priorityFocus"": ""สิ่งที่ต้องทำด่วนที่สุดอันดับแรก 1 ประโยค""
}}
ตอบเฉพาะ JSON ล้วนๆ
";
                    var aiJson = await CallLocalAiApiAsync(prompt, GetModel());
                    if (!string.IsNullOrWhiteSpace(aiJson))
                    {
                        var parsed = JsonSerializer.Deserialize<AuditDefectAnalysisDto>(aiJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                        if (parsed != null && parsed.CategoryGroups.Count > 0)
                        {
                            parsed.AuditRecordId = auditRecordId;
                            parsed.GeneratedBy = $"Local AI ({GetModel()})";
                            parsed.GeneratedAt = DateTime.UtcNow;
                            await SaveAuditAnalysisAsync(auditRecordId, parsed);
                            return parsed;
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Local AI API call failed for Audit Defect Analysis. Using rule-based fallback.");
                }
            }

            // Fallback: สั้น กระชับ หมวดหมู่ + จำนวน + วิธีแก้ไขเบื้องต้น
            var fallbackResult = new AuditDefectAnalysisDto
            {
                AuditRecordId = auditRecordId,
                Summary = $"พบข้อบกพร่องทั้งหมด {defects.Count} ข้อ ใน {groupedByCategory.Count} หมวดหมู่",
                CategoryGroups = groupedByCategory.Select(g => new AuditDefectCategoryGroupDto
                {
                    Category = g.category,
                    Count = g.count,
                    Note = $"ตก {g.count} ข้อในหมวดนี้",
                    Action = $"ทบทวนขั้นตอนและตรวจสอบรายการที่ไม่ผ่านในหมวด {g.category} เพื่อแก้ไขปรับปรุงให้ตรงตามมาตรฐาน"
                }).ToList(),
                PriorityFocus = $"ควรแก้หมวด \"{groupedByCategory.First().category}\" ก่อน เพราะพบข้อบกพร่องมากที่สุด ({groupedByCategory.First().count} ข้อ)",
                GeneratedBy = "Rule-based",
                GeneratedAt = DateTime.UtcNow
            };
            await SaveAuditAnalysisAsync(auditRecordId, fallbackResult);
            return fallbackResult;
        }

        private async Task SaveAuditAnalysisAsync(int auditRecordId, AuditDefectAnalysisDto result)
        {
            try
            {
                var record = await _context.AuditRecords.FirstOrDefaultAsync(r => r.Id == auditRecordId);
                if (record == null) return;
                record.AiAnalysisJson = JsonSerializer.Serialize(result);
                record.AiAnalysisGeneratedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to save AI audit-defect analysis cache for record {Id}.", auditRecordId);
            }
        }


        public async Task<string> AskScheduleQuestionAsync(ClaimsPrincipal user, string question)
        {
            if (string.IsNullOrWhiteSpace(question)) return "กรุณาระบุคำถามที่ต้องการถาม AI ครับ";

            var scheduleData = await GetScheduleRecommendationsAsync(user);
            var branchesSummary = string.Join("\n", scheduleData.Recommendations.Select((b, i) =>
                $"- อันดับ {i + 1}: สาขา {b.LocationName} ({b.BrandName}), เขต {b.Region}, ความเร่งด่วน {b.PriorityLevel}, ตรวจเดือนนี้={(b.HasAuditedThisMonth ? "ตรวจแล้ว" : "ยังไม่ตรวจ")}, เหตุผล: {b.Reason}, ผู้ตรวจแนะนำ: {b.SuggestedAuditorName} ({b.AuditorReason})"));

            if (IsAiEnabled())
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
                    var answer = await CallLocalAiApiAsync(prompt, GetModel(), isJson: false);
                    if (!string.IsNullOrWhiteSpace(answer))
                    {
                        return answer.Trim();
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Local AI API call failed for AskScheduleQuestion.");
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

        // ── 🖥️ LOCAL AI API CALL HELPER (Ollama /api/chat, ex. qwen3.5:9b) ──
        private async Task<string?> CallLocalAiApiAsync(string prompt, string model, bool isJson = true)
        {
            var client = _httpClientFactory.CreateClient();
            // 🌟 Local model (เช่น qwen3.5:9b) มักช้ากว่า cloud API เดิมมาก โดยเฉพาะถ้าไม่มี GPU
            // แรง — ปรับได้ผ่าน appsettings "AI:TimeoutSeconds" โดยไม่ต้อง deploy ใหม่ทุกครั้งที่
            // เจอเครื่องช้า/เร็วต่างกัน ค่าเริ่มต้น 60 วิ (เดิม hardcode 8 วิสำหรับ Gemini)
            var timeoutSeconds = int.TryParse(_config["AI:TimeoutSeconds"], out var t) ? t : 60;
            client.Timeout = TimeSpan.FromSeconds(timeoutSeconds);

            var baseUrl = GetBaseUrl().TrimEnd('/');
            var endpoint = $"{baseUrl}/api/chat";

            // 🌟 แม่แบบ JSON คงที่ — จุดที่เปลี่ยนได้มีแค่ "content" (prompt) กับ "format" (isJson)
            // เวลาจะเพิ่มจุดเรียก AI ใหม่ ก็แค่ประกอบ prompt แล้วเรียกฟังก์ชันนี้ ไม่ต้องแตะโครง request เลย
            var requestBody = new Dictionary<string, object?>
            {
                ["model"] = model,
                ["think"] = false,
                ["stream"] = false,
                ["messages"] = new[]
                {
                    new { role = "user", content = prompt }
                }
            };
            if (isJson)
            {
                requestBody["format"] = "json";
            }

            var content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
            var response = await client.PostAsync(endpoint, content);

            if (!response.IsSuccessStatusCode)
            {
                var errorText = await response.Content.ReadAsStringAsync();
                _logger.LogWarning("Local AI API error ({StatusCode}): {Error}", response.StatusCode, errorText);
                return null;
            }

            var responseJson = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(responseJson);
            var root = doc.RootElement;

            if (root.TryGetProperty("message", out var messageObj) &&
                messageObj.TryGetProperty("content", out var contentProp))
            {
                return contentProp.GetString();
            }

            return null;
        }
    }
}