using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QSC.Api.Data;

using QSC.Api.Helpers;

namespace QSC.Api.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class DashboardController : ControllerBase
    {
        private readonly AppDbContext _context;

        public DashboardController(AppDbContext context)
        {
            _context = context;
        }

        private (DateTime StartUtc, DateTime EndUtc, DateTime PrevStartUtc, DateTime PrevEndUtc) GetPeriodDateRanges(string? period)
        {
            return TimezoneHelper.GetPeriodDateRanges(period);
        }

        [HttpGet("overview")]
        public async Task<IActionResult> GetOverviewStats([FromQuery] string? period = "month", [FromQuery] int? brandId = null)
        {
            var (currentUserId, role, allowedLocationIds) = await UserScopeHelper.GetUserScopeAsync(User, _context);
            var (_, _, allowedBrandIds) = await UserScopeHelper.GetUserBrandScopeAsync(User, _context);

            var locQuery = _context.Locations.AsNoTracking().Where(l => l.IsActive);
            if (allowedLocationIds != null) locQuery = locQuery.Where(l => allowedLocationIds.Contains(l.Id));
            if (brandId.HasValue) locQuery = locQuery.Where(l => l.LocationBrands.Any(lb => lb.BrandId == brandId.Value));
            else if (allowedBrandIds != null) locQuery = locQuery.Where(l => l.LocationBrands.Any(lb => allowedBrandIds.Contains(lb.BrandId)));

            var targetLocIds = await locQuery.Select(l => l.Id).ToListAsync();
            int totalBranches = targetLocIds.Count;

            var (startUtc, endUtc, prevStartUtc, prevEndUtc) = GetPeriodDateRanges(period);

            var periodAudits = await _context.AuditRecords
                .AsNoTracking()
                .Where(a => targetLocIds.Contains(a.LocationId) && a.AuditDate >= startUtc && a.AuditDate < endUtc)
                .Select(a => new { a.Id, a.LocationId, a.PercentageScore, a.IsPassed, a.AuditDate })
                .ToListAsync();

            var prevPeriodAudits = await _context.AuditRecords
                .AsNoTracking()
                .Where(a => targetLocIds.Contains(a.LocationId) && a.AuditDate >= prevStartUtc && a.AuditDate < prevEndUtc)
                .Select(a => new { a.Id, a.LocationId, a.PercentageScore, a.IsPassed, a.AuditDate })
                .ToListAsync();

            // 🌟 คำนวณตามคะแนนรอบล่าสุดของแต่ละสถานที่ในช่วงเวลานั้น (Latest Audit per Location)
            var latestAuditsByLoc = periodAudits
                .GroupBy(a => a.LocationId)
                .Select(g => g.OrderByDescending(a => a.AuditDate).ThenByDescending(a => a.Id).First())
                .ToList();

            var prevLatestAuditsByLoc = prevPeriodAudits
                .GroupBy(a => a.LocationId)
                .Select(g => g.OrderByDescending(a => a.AuditDate).ThenByDescending(a => a.Id).First())
                .ToList();

            int totalInspections = periodAudits.Count;
            int prevTotalInspections = prevPeriodAudits.Count;
            int? inspectionDiff = (prevPeriodAudits.Count > 0 || periodAudits.Count > 0) ? (totalInspections - prevTotalInspections) : null;

            int auditedCount = latestAuditsByLoc.Count;
            int passedCount = latestAuditsByLoc.Count(a => a.IsPassed);
            double passRate = auditedCount > 0 ? Math.Round((double)passedCount / auditedCount * 100.0, 1) : 0.0;
            double avgScore = latestAuditsByLoc.Any() ? Math.Round(latestAuditsByLoc.Average(a => a.PercentageScore), 1) : 0.0;

            double? prevAvgScore = prevLatestAuditsByLoc.Any() ? Math.Round(prevLatestAuditsByLoc.Average(a => a.PercentageScore), 1) : null;
            string? trendPercent = (prevAvgScore.HasValue && prevAvgScore.Value > 0)
                ? (((avgScore - prevAvgScore.Value) / prevAvgScore.Value) * 100.0).ToString("F1")
                : null;

            int pendingCaps = await _context.CapTasks
                .AsNoTracking()
                .Where(c => targetLocIds.Contains(c.LocationId) && (c.Status == "OPEN" || c.Status == "SUBMITTED" || c.Status == "REJECTED"))
                .CountAsync();

            return Ok(new
            {
                totalBranches,
                auditedCount,
                totalInspections,
                prevTotalInspections,
                inspectionDiff,
                passedCount,
                passRate,
                avgScore,
                trendPercent,
                pendingCaps
            });
        }

        [HttpGet("rankings")]
        public async Task<IActionResult> GetRankings([FromQuery] string? period = "month", [FromQuery] int? brandId = null)
        {
            var (currentUserId, role, allowedLocationIds) = await UserScopeHelper.GetUserScopeAsync(User, _context);
            var (_, _, allowedBrandIds) = await UserScopeHelper.GetUserBrandScopeAsync(User, _context);

            var (startUtc, endUtc, _, _) = GetPeriodDateRanges(period);

            // 🌟 1. กรองผลตรวจ AuditRecords ตามช่วงเวลาที่เลือก (Period) และสิทธิ์สาขา/แบรนด์
            var auditQuery = _context.AuditRecords
                .AsNoTracking()
                .Where(a => a.AuditDate >= startUtc && a.AuditDate < endUtc);

            if (allowedLocationIds != null)
                auditQuery = auditQuery.Where(a => allowedLocationIds.Contains(a.LocationId));

            if (brandId.HasValue)
                auditQuery = auditQuery.Where(a => a.Location != null && a.Location.LocationBrands.Any(lb => lb.BrandId == brandId.Value));
            else if (allowedBrandIds != null)
                auditQuery = auditQuery.Where(a => a.Location != null && a.Location.LocationBrands.Any(lb => allowedBrandIds.Contains(lb.BrandId)));

            // 🌟 2. จัดอันดับ Top 5 สาขาที่มีผลการตรวจจริงในช่วงเวลาที่เลือก โดยเรียงจากคะแนนสูงสุด
            var topInPeriod = await auditQuery
                .GroupBy(a => new { a.LocationId, a.Location!.Code, a.Location.Name, a.Location.Region })
                .Select(g => new
                {
                    Id = g.Key.LocationId,
                    Code = g.Key.Code,
                    Name = g.Key.Name,
                    Region = g.Key.Region,
                    LastScore = Math.Round(g.OrderByDescending(a => a.AuditDate).Select(a => a.PercentageScore).FirstOrDefault(), 1),
                    AvgScore = Math.Round(g.Average(a => a.PercentageScore), 1),
                    AuditCount = g.Count(),
                    LastAuditDate = g.Max(a => a.AuditDate),
                    HasAudited = true
                })
                .OrderByDescending(x => x.LastScore)
                .Take(5)
                .ToListAsync();

            return Ok(new { top5 = topInPeriod });
        }

        // 🌟 แก้ไข GetTrends: ใช้ TimezoneHelper ตัดรอบเดือนตามเวลาไทย (UTC+7)
        [HttpGet("trends")]
        public async Task<IActionResult> GetTrends()
        {
            var (currentUserId, role, allowedLocationIds) = await UserScopeHelper.GetUserScopeAsync(User, _context);
            var (_, _, allowedBrandIds) = await UserScopeHelper.GetUserBrandScopeAsync(User, _context);

            var nowUtc = DateTime.UtcNow;
            var nowBkk = TimezoneHelper.ToBangkokTime(nowUtc);

            var currentMonthStartBkk = new DateTime(nowBkk.Year, nowBkk.Month, 1, 0, 0, 0, DateTimeKind.Unspecified);
            var startOf6MonthsBkk = currentMonthStartBkk.AddMonths(-5);
            var endOfPeriodBkk = currentMonthStartBkk.AddMonths(1);

            var startOf6MonthsUtc = TimezoneHelper.ToUtcFromBangkok(startOf6MonthsBkk);
            var endOfPeriodUtc = TimezoneHelper.ToUtcFromBangkok(endOfPeriodBkk);

            var auditQuery = _context.AuditRecords
                .AsNoTracking()
                .Where(a => a.AuditDate >= startOf6MonthsUtc && a.AuditDate < endOfPeriodUtc);

            if (allowedLocationIds != null)
            {
                auditQuery = auditQuery.Where(a => allowedLocationIds.Contains(a.LocationId));
            }

            if (allowedBrandIds != null)
            {
                auditQuery = auditQuery.Where(a => a.Location != null && a.Location.LocationBrands.Any(lb => allowedBrandIds.Contains(lb.BrandId)));
            }

            var periodAudits = await auditQuery
                .Select(a => new { a.Id, a.LocationId, a.AuditDate, a.PercentageScore, a.IsPassed })
                .ToListAsync();

            var months = new List<object>();
            var thaiMonths = new[] { "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค." };

            for (int i = 5; i >= 0; i--)
            {
                var targetMonthBkk = currentMonthStartBkk.AddMonths(-i);
                var startOfMonthBkk = new DateTime(targetMonthBkk.Year, targetMonthBkk.Month, 1, 0, 0, 0, DateTimeKind.Unspecified);
                var endOfMonthBkk = startOfMonthBkk.AddMonths(1);

                var startOfMonthUtc = TimezoneHelper.ToUtcFromBangkok(startOfMonthBkk);
                var endOfMonthUtc = TimezoneHelper.ToUtcFromBangkok(endOfMonthBkk);

                var monthAudits = periodAudits
                    .Where(a => a.AuditDate >= startOfMonthUtc && a.AuditDate < endOfMonthUtc)
                    .ToList();

                var latestMonthAudits = monthAudits
                    .GroupBy(a => a.LocationId)
                    .Select(g => g.OrderByDescending(a => a.AuditDate).ThenByDescending(a => a.Id).First())
                    .ToList();

                double? avg = latestMonthAudits.Any() ? Math.Round(latestMonthAudits.Average(a => a.PercentageScore), 1) : null;
                double? passRate = latestMonthAudits.Any() ? Math.Round((double)latestMonthAudits.Count(a => a.IsPassed) / latestMonthAudits.Count * 100, 1) : null;
                var monthLabel = thaiMonths[targetMonthBkk.Month - 1] + " " + ((targetMonthBkk.Year + 543) % 100);

                months.Add(new
                {
                    month = monthLabel,
                    score = avg,
                    auditCount = latestMonthAudits.Count,
                    passRate = passRate
                });
            }

            var locQuery = _context.Locations.Where(l => l.IsActive).AsQueryable();
            if (allowedLocationIds != null) locQuery = locQuery.Where(l => allowedLocationIds.Contains(l.Id));
            if (allowedBrandIds != null) locQuery = locQuery.Where(l => l.LocationBrands.Any(lb => allowedBrandIds.Contains(lb.BrandId)));

            var regionalScores = await locQuery
                .GroupBy(l => l.Region)
                .Select(g => new
                {
                    region = g.Key,
                    avgScore = Math.Round(g.Average(l => l.LastScore), 1),
                    totalBranches = g.Count()
                })
                .ToListAsync();

            return Ok(new
            {
                monthlyTrends = months,
                regionalScores = regionalScores
            });
        }

        [HttpGet("category-scores")]
        public async Task<IActionResult> GetCategoryScores(
            [FromQuery] string? period = "month",
            [FromQuery] int? brandId = null,
            [FromQuery] int? locationId = null)
        {
            var (currentUserId, role, allowedLocationIds) = await UserScopeHelper.GetUserScopeAsync(User, _context);
            var (_, _, allowedBrandIds) = await UserScopeHelper.GetUserBrandScopeAsync(User, _context);

            var (startUtc, endUtc, _, _) = GetPeriodDateRanges(period);

            var recordQuery = _context.AuditRecords
                .AsNoTracking()
                .Where(r => r.AuditDate >= startUtc && r.AuditDate < endUtc);

            if (locationId.HasValue)
            {
                recordQuery = recordQuery.Where(r => r.LocationId == locationId.Value);
            }
            else if (allowedLocationIds != null)
            {
                recordQuery = recordQuery.Where(r => allowedLocationIds.Contains(r.LocationId));
            }

            if (brandId.HasValue)
            {
                recordQuery = recordQuery.Where(r => r.Location != null && r.Location.LocationBrands.Any(lb => lb.BrandId == brandId.Value));
            }
            else if (allowedBrandIds != null)
            {
                recordQuery = recordQuery.Where(r => r.Location != null && r.Location.LocationBrands.Any(lb => allowedBrandIds.Contains(lb.BrandId)));
            }

            var responseQuery = _context.AuditResponses
                .AsNoTracking()
                .Where(resp => !resp.IsNa)
                .Where(resp => recordQuery.Any(rec => rec.Id == resp.AuditRecordId));

            var rawCategoryData = await responseQuery
                .Select(resp => new
                {
                    CategoryName = !string.IsNullOrWhiteSpace(resp.CategoryName)
                        ? resp.CategoryName
                        : (!string.IsNullOrWhiteSpace(resp.SurveyItem!.CategoryName)
                            ? resp.SurveyItem.CategoryName
                            : (resp.SurveyItem.SurveySection != null ? resp.SurveyItem.SurveySection.Title : "ทั่วไป")),
                    ScoreGiven = resp.ScoreGiven,
                    // คะแนนเต็ม ณ วันตรวจก่อน (งานประวัติข้อเดียวกันคะแนนต่างกันตามยุค) แล้วค่อยใช้ค่าปัจจุบันของฟอร์ม
                    FullScore = resp.MaxScore != null
                        ? resp.MaxScore.Value
                        : (resp.SurveyItem != null && resp.SurveyItem.FullScore > 0 ? resp.SurveyItem.FullScore : 10.0)
                })
                .ToListAsync();

            var categoryScores = rawCategoryData
                .GroupBy(d => d.CategoryName.Trim())
                .Select(g =>
                {
                    var totalScoreGiven = g.Sum(x => x.ScoreGiven);
                    var totalFullScore = g.Sum(x => x.FullScore);
                    var percentage = totalFullScore > 0 ? Math.Round((totalScoreGiven / totalFullScore) * 100.0, 1) : 0.0;

                    return new
                    {
                        name = g.Key,
                        score = percentage,
                        target = 85
                    };
                })
                .OrderByDescending(c => c.score)
                .ToList();

            return Ok(categoryScores);
        }
    }
}
