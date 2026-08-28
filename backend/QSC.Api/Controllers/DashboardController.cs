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

        [HttpGet("overview")]
        public async Task<IActionResult> GetOverviewStats()
        {
            var (currentUserId, role, allowedLocationIds) = await UserScopeHelper.GetUserScopeAsync(User, _context);

            var locQuery = _context.Locations.AsNoTracking().Where(l => l.IsActive).AsQueryable();

            if (allowedLocationIds != null)
            {
                locQuery = locQuery.Where(l => allowedLocationIds.Contains(l.Id));
            }

            var locations = await locQuery.Select(l => new { l.Id, l.LastScore }).ToListAsync();
            var locIds = locations.Select(l => l.Id).ToList();

            var totalBranches = locations.Count;
            var passedBranches = locations.Count(l => l.LastScore >= 85);
            var improveBranches = locations.Count(l => l.LastScore >= 70 && l.LastScore < 85);
            var criticalBranches = locations.Count(l => l.LastScore < 70);

            var avgScore = locations.Any() ? Math.Round(locations.Average(l => l.LastScore), 1) : 0;

            var totalAuditsCompleted = await _context.AuditRecords
                .AsNoTracking()
                .Where(r => locIds.Contains(r.LocationId))
                .CountAsync();

            var pendingCaps = await _context.CapTasks
                .AsNoTracking()
                .Where(c => locIds.Contains(c.LocationId) && (c.Status == "OPEN" || c.Status == "SUBMITTED" || c.Status == "REJECTED"))
                .CountAsync();

            var upcomingAudits = await _context.AuditSchedules
                .AsNoTracking()
                .Where(s => locIds.Contains(s.LocationId) && s.Status == "pending")
                .CountAsync();

            return Ok(new
            {
                totalBranches,
                passedBranches,
                improveBranches,
                criticalBranches,
                passPercentage = totalBranches > 0 ? Math.Round((double)passedBranches / totalBranches * 100, 1) : 0,
                avgScore,
                pendingCaps,
                upcomingAudits,
                totalAuditsCompleted
            });
        }

        [HttpGet("rankings")]
        public async Task<IActionResult> GetRankings()
        {
            var (currentUserId, role, allowedLocationIds) = await UserScopeHelper.GetUserScopeAsync(User, _context);

            var locQuery = _context.Locations.AsNoTracking().Where(l => l.IsActive).AsQueryable();

            if (allowedLocationIds != null)
            {
                locQuery = locQuery.Where(l => allowedLocationIds.Contains(l.Id));
            }

            var topBranches = await locQuery
                .OrderByDescending(l => l.LastScore)
                .Take(5)
                .Select(l => new { l.Id, l.Code, l.Name, l.Region, l.LastScore, l.LastAuditDate })
                .ToListAsync();

            var bottomBranches = await locQuery
                .OrderBy(l => l.LastScore)
                .Take(5)
                .Select(l => new { l.Id, l.Code, l.Name, l.Region, l.LastScore, l.LastAuditDate })
                .ToListAsync();

            return Ok(new
            {
                top5 = topBranches,
                bottom5 = bottomBranches
            });
        }

        [HttpGet("trends")]
        public async Task<IActionResult> GetTrends()
        {
            var (currentUserId, role, allowedLocationIds) = await UserScopeHelper.GetUserScopeAsync(User, _context);

            var now = DateTime.UtcNow;
            var startOf6Months = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc).AddMonths(-5);
            var endOfPeriod = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc).AddMonths(1);

            var auditQuery = _context.AuditRecords
                .AsNoTracking()
                .Where(a => a.AuditDate >= startOf6Months && a.AuditDate < endOfPeriod);

            if (allowedLocationIds != null)
            {
                auditQuery = auditQuery.Where(a => allowedLocationIds.Contains(a.LocationId));
            }

            var periodAudits = await auditQuery
                .Select(a => new { a.AuditDate, a.PercentageScore, a.IsPassed })
                .ToListAsync();

            var months = new List<object>();
            var thaiMonths = new[] { "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค." };

            for (int i = 5; i >= 0; i--)
            {
                var targetMonth = now.AddMonths(-i);
                var startOfMonth = new DateTime(targetMonth.Year, targetMonth.Month, 1, 0, 0, 0, DateTimeKind.Utc);
                var endOfMonth = startOfMonth.AddMonths(1);

                var monthAudits = periodAudits
                    .Where(a => a.AuditDate >= startOfMonth && a.AuditDate < endOfMonth)
                    .ToList();

                double? avg = monthAudits.Any() ? Math.Round(monthAudits.Average(a => a.PercentageScore), 1) : null;
                double? passRate = monthAudits.Any() ? Math.Round((double)monthAudits.Count(a => a.IsPassed) / monthAudits.Count * 100, 1) : null;
                var monthLabel = thaiMonths[targetMonth.Month - 1] + " " + ((targetMonth.Year + 543) % 100);

                months.Add(new
                {
                    month = monthLabel,
                    score = avg,
                    auditCount = monthAudits.Count,
                    passRate = passRate
                });
            }

            var locQuery = _context.Locations.Where(l => l.IsActive).AsQueryable();
            if (allowedLocationIds != null)
            {
                locQuery = locQuery.Where(l => allowedLocationIds.Contains(l.Id));
            }

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
    }
}
