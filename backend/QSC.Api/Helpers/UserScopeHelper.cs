using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using QSC.Api.Data;

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

            // ADMIN, STANDARD, and EXEC have global organization visibility (unless STANDARD has SPECIFIC branch scope)
            if (role == "ADMIN" || role == "EXEC" || (role == "STANDARD" && user.BranchScope != "SPECIFIC") || user.BranchScope == "ALL")
            {
                return (user.Id, role, null); // null means access to ALL branches
            }

            // AUDITEE and SPECIFIC scope -> strictly restricted to assigned branches
            var allowedIds = await context.UserLocations
                .AsNoTracking()
                .Where(ul => ul.UserId == user.Id)
                .Select(ul => ul.LocationId)
                .ToListAsync();

            return (user.Id, role, allowedIds);
        }
    }
}
