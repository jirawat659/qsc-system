using Microsoft.EntityFrameworkCore;
using QSC.Api.Data;
using QSC.Api.Models;
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
            return _config["AI:Model"] ?? "gemini-1.5-flash";
        }

        // DASHBOARD
        public async Task<DashboardAiInsightsDto> GetDashboardInsightsAsync(DateTime? targetMonth = null)
        {
            var month = targetMonth ?? DateTime.UtcNow;
            var startOfMonth = new DateTime(month.Year, month.Month, 1);
            var endOfMonth = startOfMonth.AddMonths(1).AddTicks(-1);

            var monthRecords = await _context.AuditRecords
                .AsNoTracking()
                .Include(r => r.Location)
                .Include(r => r.Responses)
                    .ThenInclude(res => res.SurveyItem)
                        .ThenInclude(item => item!.SurveySection)
                .Where(r => r.AuditDate >= startOfMonth && r.AuditDate <= endOfMonth)
                .ToListAsync();

            var pendingCaps = await _context.CapTasks
                .AsNoTracking()
                .Where(c => c.Status != "CLOSED" && c.Status != "closed")
                .ToListAsync();

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
ตอบเป็น JSON:
{{
  ""highlight"": ""ประโยคสั้นมาก 1 ประโยค เช่น คะแนนเฉลี่ยภาพรวม {avgScore}% ผ่านเกณฑ์ {passRate}%"",
  ""attention"": ""ประโยคสั้นมาก 1 ประโยค ระบุงาน CAP ค้าง {pendingCaps.Count} รายการ หรือข้อบกพร่องสั้นๆ"",
  ""action"": ""ประโยคสั้นมาก 1 ประโยค ข้อเสนอแนะสั้นๆ กระชับ""
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
        public async Task<ScheduleAiRecommendationsDto> GetScheduleRecommendationsAsync()
        {
            var now = DateTime.UtcNow;
            var startOfMonth = new DateTime(now.Year, now.Month, 1);
            var endOfMonth = startOfMonth.AddMonths(1).AddTicks(-1);

            var locations = await _context.Locations
                .AsNoTracking()
                .Where(l => l.IsActive)
                .ToListAsync();

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
                    reasons.Add("ยังไม่ได้รับการตรวจในเดือนนี้ (เกณฑ์อย่างน้อย 1 ครั้ง/เดือน)");
                }

                if (lastScore.HasValue && lastScore.Value < 70)
                {
                    priority = "CRITICAL";
                    reasons.Add($"คะแนนรอบล่าสุดวิกฤต ({lastScore.Value}%)");
                }
                else if (lastScore.HasValue && lastScore.Value < 85)
                {
                    priority = priority == "CRITICAL" ? "CRITICAL" : "HIGH";
                    reasons.Add($"คะแนนรอบล่าสุดต่ำกว่าเกณฑ์มาตรฐาน ({lastScore.Value}%)");
                }

                if (pendingCaps > 0)
                {
                    priority = "HIGH";
                    reasons.Add($"มีงานแก้ไข CAP ค้างอยู่ {pendingCaps} รายการ");
                }

                if (daysSince >= 45 && daysSince < 999)
                {
                    reasons.Add($"ไม่ได้เข้าตรวจมาแล้ว {daysSince} วัน");
                }

                if (lastAudit == null)
                {
                    priority = "HIGH";
                    reasons.Add("ยังไม่เคยมีประวัติการเข้าตรวจประเมิน");
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
                    BrandName = loc.BrandName,
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
                        $"{idx+1}. {b.LocationName} ({b.BrandName}): คะแนนล่าสุด {b.LastScore?.ToString() ?? "ไม่มี"}%, ไม่ได้ตรวจ {b.DaysSinceLastAudit} วัน, ตรวจเดือนนี้={b.HasAuditedThisMonth}, CAPค้าง={b.PendingCapCount}"));

                    var prompt = $@"
คุณคือ AI ผู้ช่วยวางแผนตารางตรวจมาตรฐาน QSC
องค์กรมีกฎบังคับ: 'ทุกสาขาต้องได้รับการตรวจอย่างน้อย 1 ครั้งต่อเดือน'
จงวิเคราะห์สาขาที่จัดอันดับความสำคัญเร่งด่วน 3 อันดับแรกนี้ และสรุปคำแนะนำในรูปแบบ JSON:
{{
  ""summary"": ""ข้อความสรุปภาพรวมแผนการตรวจของเดือน 2-3 ประโยค แนะนำภาพรวมทีม Auditor"",
  ""reasons"": [
     ""เหตุผลวิเคราะห์สั้นๆ เจาะจงสำหรับสาขาที่ 1"",
     ""เหตุผลวิเคราะห์สั้นๆ เจาะจงสำหรับสาขาที่ 2"",
     ""เหตุผลวิเคราะห์สั้นๆ เจาะจงสำหรับสาขาที่ 3""
  ]
}}

ข้อมูลสาขาที่จัดอันดับ:
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
                            Summary = summary ?? $"พบ {totalPendingMonthly} สาขาที่ยังไม่ได้รับการตรวจในเดือนนี้ แนะนำให้ทีมผู้ตรวจจัดตารางลงตรวจ 3 สาขาความเสี่ยงสูงนี้เป็นลำดับแรก",
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
                Summary = $"พบ {totalPendingMonthly} สาขาที่ยังไม่ได้รับการตรวจในเดือนนี้ แนะนำให้ทีมผู้ตรวจจัดตารางลงตรวจ 5 สาขาด้านล่างเป็นลำดับแรกตามเกณฑ์ความเสี่ยงและรอบ SLA",
                Recommendations = ranked,
                TotalBranchesPendingMonthlyAudit = totalPendingMonthly,
                GeneratedBy = "Smart Analytics Engine"
            };
        }

        // CAP CHAT & EVIDENCE ANALYSIS
        public async Task<CapAiAnalysisDto> AnalyzeCapTaskAsync(int capTaskId)
        {
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
  ""strengthPoints"": [""จุดที่สาขาทำได้ดี/แก้ไขตรงประเด็น 1-2 ข้อ""],
  ""areasToVerify"": [""จุดที่ผู้ประเมินควรตรวจสอบหรือขอหลักฐานเพิ่ม 1-2 ข้อ""],
  ""auditorAdvice"": ""คำแนะนำชัดเจนสำหรับผู้ตรวจประเมิน (เช่น ควรอนุมัติ / ควรขอรูปมุมกว้างเพิ่ม / ควรสุ่มตรวจหน้างานซ้ำ)"",
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

            if (hasAfter && hasChat)
            {
                strengths.Add("สาขาได้ส่งรูปภาพหลักฐานหลังการแก้ไขเรียบร้อยแล้ว");
                strengths.Add("มีการชี้แจงรายละเอียดการแก้ไขผ่านระบบแชท");
                toVerify.Add("ตรวจสอบว่ารูปภาพหลังแก้ครอบคลุมจุดบกพร่องเดิมอย่างชัดเจน");
                advice = "หลักฐานเบื้องต้นครบถ้วน แนะนำให้ผู้ประเมินตรวจสอบความคมชัดของรูปภาพก่อนกดอนุมัติปิดงาน";
                readiness = "READY_TO_REVIEW";
            }
            else if (hasChat && !hasAfter)
            {
                strengths.Add("สาขาได้ตอบรับและแจ้งความคืบหน้าในแชทแล้ว");
                toVerify.Add("สาขายังไม่ได้แนบรูปถ่ายหลักฐานยืนยันหลังการปรับปรุงแก้ไข");
                advice = "สาขารายงานข้อความแล้วแต่ยังขาดรูปถ่ายจริง แนะนำให้ผู้ตรวจพิมพ์ขอรูปภาพ Before/After เพิ่มเติมก่อนพิจารณาปิดงาน";
                readiness = "PENDING_PROOF";
            }
            else
            {
                toVerify.Add("ยังไม่พบการตอบกลับหรือส่งหลักฐานจากทางสาขา");
                advice = "ยังไม่มีความคืบหน้า แนะนำให้ผู้ตรวจส่งข้อความติดตามผลผ่านแชทก่อนถึงกำหนดเวลา SLA";
                readiness = "PENDING_PROOF";
            }

            return new CapAiAnalysisDto
            {
                TaskId = capTaskId,
                IssueSummary = task.IssueItem,
                ProgressStatus = hasChat ? "สาขาได้เริ่มดำเนินการและแจ้งข้อมูลในแชทแล้ว" : "อยู่ระหว่างรอสาขาดำเนินการ",
                StrengthPoints = strengths,
                AreasToVerify = toVerify,
                AuditorAdvice = advice,
                ReadinessToClose = readiness
            };
        }

        // ── 🌐 GEMINI REST API CALL HELPER ──
        private async Task<string?> CallGeminiRestApiAsync(string prompt, string apiKey, string model)
        {
            var client = _httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(15);

            var endpoint = $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}";

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
                generationConfig = new
                {
                    responseMimeType = "application/json",
                    temperature = 0.2
                }
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
