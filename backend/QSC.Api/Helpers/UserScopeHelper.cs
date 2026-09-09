using System.Formats.Asn1;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using QSC.Api.Data;
using QSC.Api.Models;

namespace QSC.Api.Helpers
{
    public static class UserScopeHelper
    {
        public static async Task<(int UserId, string Role, List<int>? AllowedLocationIds)> GetUserScopeAsync(ClaimsPrincipal userPrincipal, AppDbContext context)
        {
            var userIdStr = userPrincipal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdStr, out int userId))
            {
                return (0, string.Empty, new List<int>());
            }

            var user = await context.Users
                .AsNoTracking()
                .Include(u => u.Role)
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null || !user.IsActive)
            {
                return (0, string.Empty, new List<int>());
            }

            var role = user.Role?.Code ?? string.Empty;

            // AUDITEE (Store Manager) is ALWAYS strictly restricted to assigned branches
            if (role == "AUDITEE" || user.BranchScope == "SPECIFIC")
            {
                var allowedIds = await context.UserLocations
                    .AsNoTracking()
                    .Where(ul => ul.UserId == user.Id)
                    .Select(ul => ul.LocationId)
                    .ToListAsync();

                return (user.Id, role, allowedIds);
            }

            // ADMIN, STANDARD, AUDITOR, and EXEC have global organization visibility when BranchScope is ALL
            if (role == "ADMIN" || role == "EXEC" || (role == "STANDARD" && user.BranchScope != "SPECIFIC") || user.BranchScope == "ALL")
            {
                return (user.Id, role, null); // null means access to ALL branches
            }

            var defaultAllowedIds = await context.UserLocations
                .AsNoTracking()
                .Where(ul => ul.UserId == user.Id)
                .Select(ul => ul.LocationId)
                .ToListAsync();

            return (user.Id, role, defaultAllowedIds);
        }

        public static async Task<(int UserId, String Role, List<int>? AllowedBrandIds)> GetUserBrandScopeAsync(ClaimsPrincipal userPrincipal, AppDbContext context)
        {
            var userIdStr = userPrincipal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdStr, out int userId))
            {
                return (0, string.Empty, new List<int>());
            }

            var user = await context.Users
                .AsNoTracking()
                .Include(u => u.Role)
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null || !user.IsActive)
            {
                return (0, string.Empty, new List<int>());
            }

            var role = user.Role?.Code ?? string.Empty;

            // AUDITEE (Store Manager) is ALWAYS strictly restricted to assigned brands
            if (role == "AUDITEE" || user.BrandScope == "SPECIFIC")
            {
                var allowedBrandIds = await context.UserBrands
                    .AsNoTracking()
                    .Where(ul => ul.UserId == user.Id)
                    .Select(ul => ul.BrandId)
                    .ToListAsync();

                return (user.Id, role, allowedBrandIds);
            }

            // ADMIN, STANDARD, AUDITOR, and EXEC have global organization visibility when BrandScope is ALL
            if (role == "ADMIN" || role == "EXEC" || (role == "STANDARD" && user.BrandScope != "SPECIFIC") || user.BrandScope == "ALL")
            {
                return (user.Id, role, null); // null means access to ALL brands
            }

            var defaultAllowedBrandIds = await context.UserBrands
                .AsNoTracking()
                .Where(ul => ul.UserId == user.Id)
                .Select(ul => ul.BrandId)
                .ToListAsync();

            return (user.Id, role, defaultAllowedBrandIds);
        }

        // ใช้ร่วมกันในทุก controller ที่คืนรายการ Location
        // ถ้า AllowedBrandIds เป็น null หมายถึงเห็นได้ทุกแบรนด์ รวมถึง Location แบบ org-wide เช่น HQ
        // ถ้าเป็นรายการ หมายถึงต้องมี LocationBrand ที่ตรงกันเท่านั้น (Location ที่ไม่มีแบรนด์จะไม่ผ่าน)
        public static IQueryable<Location> ApplyLocationAccessFilter(
            IQueryable<Location> query,
            List<int>? allowedLocationIds,
            List<int>? allowedBrandIds)
        {
            if (allowedLocationIds != null)
            {
                query = query.Where(location => allowedLocationIds.Contains(location.Id));
            }

            if (allowedBrandIds != null)
            {
                query = query.Where(location =>
                    location.LocationBrands.Any(link => allowedBrandIds.Contains(link.BrandId)));
            }

            return query;
        }
    }
}
