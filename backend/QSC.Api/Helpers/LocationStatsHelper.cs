using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using QSC.Api.Data;

namespace QSC.Api.Helpers
{
    public static class LocationStatsHelper
    {
        /// <summary>
        /// คำนวณและอัปเดต LastScore และ LastAuditDate ของสาขาจากผลตรวจที่เสร็จสิ้นล่าสุดจริง
        /// </summary>
        public static async Task UpdateLocationLastAuditStatsAsync(AppDbContext context, int locationId)
        {
            var location = await context.Locations.FindAsync(locationId);
            if (location == null) return;

            var latestAudit = await context.AuditRecords
                .AsNoTracking()
                .Where(a => a.LocationId == locationId)
                .OrderByDescending(a => a.AuditDate)
                .ThenByDescending(a => a.Id)
                .Select(a => new { a.PercentageScore, a.AuditDate })
                .FirstOrDefaultAsync();

            if (latestAudit != null)
            {
                location.LastScore = latestAudit.PercentageScore;
                location.LastAuditDate = latestAudit.AuditDate;
            }
            else
            {
                location.LastScore = 0.0;
                location.LastAuditDate = null;
            }
        }
    }
}