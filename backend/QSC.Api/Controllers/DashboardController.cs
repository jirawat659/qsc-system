using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QSC.Api.Data;

namespace QSC.Api.Controllers
{
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
        public async Task<IActionResult> GetOverviewStats([FromQuery] int? userId)
        {
            var locQuery = _context.Locations.Where(l => l.IsActive).AsQueryable();

            if (userId.HasValue)
            {
                var user = await _context.Users.FindAsync(userId.Value);
                if (user != null && user.BranchScope == "SPECIFIC")
                {
                    var allowedIds = await _context.UserLocations
                        .Where(ul => ul.UserId == user.Id)
                        .Select(ul => ul.LocationId)
                        .ToListAsync();

                    locQuery = locQuery.Where(l => allowedIds.Contains(l.Id));
                }
            }

            var locations = await locQuery.ToListAsync();
            var locIds = locations.Select(l => l.Id).ToList();

            var audits = await _context.AuditRecords
                .Where(r => locIds.Contains(r.LocationId))
                .ToListAsync();

            var caps = await _context.CapTasks
                .Where(c => locIds.Contains(c.LocationId))
                .ToListAsync();

            var schedules = await _context.AuditSchedules
                .Where(s => locIds.Contains(s.LocationId))
                .ToListAsync();

            var totalBranches = locations.Count;
            var passedBranches = locations.Count(l => l.LastScore >= 85);
            var improveBranches = locations.Count(l => l.LastScore >= 70 && l.LastScore < 85);
            var criticalBranches = locations.Count(l => l.LastScore < 70);

            var avgScore = locations.Any() ? Math.Round(locations.Average(l => l.LastScore), 1) : 0;
            var pendingCaps = caps.Count(c => c.Status == "OPEN" || c.Status == "SUBMITTED" || c.Status == "REJECTED");
            var upcomingAudits = schedules.Count(s => s.Status == "pending");

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
                totalAuditsCompleted = audits.Count
            });
        }

        [HttpGet("rankings")]
        public async Task<IActionResult> GetRankings()
        {
            var topBranches = await _context.Locations
                .Where(l => l.IsActive)
                .OrderByDescending(l => l.LastScore)
                .Take(5)
                .Select(l => new { l.Id, l.Code, l.Name, l.Region, l.LastScore, l.LastAuditDate })
                .ToListAsync();

            var bottomBranches = await _context.Locations
                .Where(l => l.IsActive)
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
            var now = DateTime.UtcNow;
            var months = new List<object>();
            var thaiMonths = new[] { "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค." };

            for (int i = 5; i >= 0; i--)
            {
                var targetMonth = now.AddMonths(-i);
                var startOfMonth = new DateTime(targetMonth.Year, targetMonth.Month, 1, 0, 0, 0, DateTimeKind.Utc);
                var endOfMonth = startOfMonth.AddMonths(1);

                var monthAudits = await _context.AuditRecords
                    .Where(a => a.AuditDate >= startOfMonth && a.AuditDate < endOfMonth)
                    .ToListAsync();

                var avg = monthAudits.Any() ? Math.Round(monthAudits.Average(a => a.PercentageScore), 1) : 85.0 + (5 - i);
                var monthLabel = thaiMonths[targetMonth.Month - 1] + " " + ((targetMonth.Year + 543) % 100);

                months.Add(new
                {
                    month = monthLabel,
                    score = avg,
                    auditCount = monthAudits.Count,
                    passRate = monthAudits.Any() ? Math.Round((double)monthAudits.Count(a => a.IsPassed) / monthAudits.Count * 100, 1) : 85.0
                });
            }

            var regionalScores = await _context.Locations
                .Where(l => l.IsActive)
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
