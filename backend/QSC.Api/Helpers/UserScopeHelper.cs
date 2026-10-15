using System.Formats.Asn1;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using QSC.Api.Data;
using QSC.Api.Models;

namespace QSC.Api.Helpers
{
    public record UserFullScope(int UserId, string Role, List<int>? AllowedLocationIds, List<int>? AllowedBrandIds);

    public static class UserScopeHelper
    {
        public static async Task<UserFullScope> GetUserFullScopeAsync(ClaimsPrincipal userPrincipal, AppDbContext context)
        {
            var userIdStr = userPrincipal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdStr, out int userId))
            {
                return new UserFullScope(0, string.Empty, new List<int>(), new List<int>());
            }

            var roleClaim = userPrincipal.FindFirst(ClaimTypes.Role)?.Value ?? string.Empty;

            var user = await context.Users
                .AsNoTracking()
                .Include(u => u.Role)
                .Include(u => u.UserLocations)
                .Include(u => u.UserBrands)
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null || !user.IsActive)
            {
                return new UserFullScope(0, string.Empty, new List<int>(), new List<int>());
            }

            if (roleClaim == "ADMIN" || roleClaim == "EXEC")
            {
                return new UserFullScope(userId, roleClaim, null, null);
            }

            var role = user.Role?.Code ?? string.Empty;

            // 🌟 ถ้ามาจาก SSO (auth == "sso") ให้ยึด Scope ตามที่ PDP อนุญาตใน Claims (PDP ชนะเสมอ)
            if (userPrincipal.FindFirst("auth")?.Value == "sso")
            {
                var branchScopeClaim = userPrincipal.FindFirst("branch_scope")?.Value;
                List<int>? ssoLocationIds = null;
                if (branchScopeClaim == "SPECIFIC")
                {
                    var locStr = userPrincipal.FindFirst("allowed_locations")?.Value;
                    ssoLocationIds = !string.IsNullOrWhiteSpace(locStr)
                        ? locStr.Split(',', StringSplitOptions.RemoveEmptyEntries)
                                .Select(s => int.TryParse(s, out var id) ? id : 0)
                                .Where(id => id > 0)
                                .ToList()
                        : new List<int>();
                }

                var brandScopeClaim = userPrincipal.FindFirst("brand_scope")?.Value;
                List<int>? ssoBrandIds = null;
                if (brandScopeClaim == "SPECIFIC")
                {
                    var brandStr = userPrincipal.FindFirst("allowed_brands")?.Value;
                    ssoBrandIds = !string.IsNullOrWhiteSpace(brandStr)
                        ? brandStr.Split(',', StringSplitOptions.RemoveEmptyEntries)
                                  .Select(s => int.TryParse(s, out var id) ? id : 0)
                                  .Where(id => id > 0)
                                  .ToList()
                        : new List<int>();
                }

                var effectiveRole = !string.IsNullOrWhiteSpace(roleClaim) ? roleClaim : role;
                return new UserFullScope(user.Id, effectiveRole, ssoLocationIds, ssoBrandIds);
            }

            List<int>? allowedLocationIds = null;
            if (role == "AUDITEE" || user.BranchScope == "SPECIFIC")
            {
                allowedLocationIds = user.UserLocations.Select(ul => ul.LocationId).ToList();
            }
            else if (role != "ADMIN" && role != "EXEC" && (role != "STANDARD" || user.BranchScope == "SPECIFIC") && user.BranchScope != "ALL")
            {
                allowedLocationIds = user.UserLocations.Select(ul => ul.LocationId).ToList();
            }

            List<int>? allowedBrandIds = null;
            if (role == "AUDITEE" || user.BrandScope == "SPECIFIC")
            {
                allowedBrandIds = user.UserBrands.Select(ub => ub.BrandId).ToList();
            }
            else if (role != "ADMIN" && role != "EXEC" && (role != "STANDARD" || user.BrandScope == "SPECIFIC") && user.BrandScope != "ALL")
            {
                allowedBrandIds = user.UserBrands.Select(ub => ub.BrandId).ToList();
            }

            return new UserFullScope(user.Id, role, allowedLocationIds, allowedBrandIds);
        }

        public static async Task<(int UserId, string Role, List<int>? AllowedLocationIds)> GetUserScopeAsync(ClaimsPrincipal userPrincipal, AppDbContext context)
        {
            var scope = await GetUserFullScopeAsync(userPrincipal, context);
            return (scope.UserId, scope.Role, scope.AllowedLocationIds);
        }

        public static async Task<(int UserId, string Role, List<int>? AllowedBrandIds)> GetUserBrandScopeAsync(ClaimsPrincipal userPrincipal, AppDbContext context)
        {
            var scope = await GetUserFullScopeAsync(userPrincipal, context);
            return (scope.UserId, scope.Role, scope.AllowedBrandIds);
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

        // 🌟 Dynamic permission check ตาม pattern เดียวกับ AuditController.UpdateAuditRecord:
        // เช็คจากตาราง RolePermission ตรงๆ แทนที่จะ hardcode [Authorize(Roles=...)] เพื่อให้ Admin
        // ไปเปิด/ปิดสิทธิ์ (เช่น "users.manage", "roles.manage") ให้ role ไหนก็ได้จากหน้า "บทบาทและสิทธิ์"
        // ADMIN ผ่านเสมอโดยไม่ต้องมีแถวใน RolePermission (กันเคส seed ข้อมูลไม่ครบ)
        public static async Task<bool> HasPermissionAsync(ClaimsPrincipal userPrincipal, string permissionCode, AppDbContext context)
        {
            // ถ้ามาจาก SSO (auth == "sso"): เช็คสิทธิ์จาก PDP ที่ฝังมาใน Token
            if (userPrincipal.FindFirst("auth")?.Value == "sso")
            {
                var role = userPrincipal.FindFirst(ClaimTypes.Role)?.Value;
                if (string.Equals(role, "ADMIN", StringComparison.OrdinalIgnoreCase)) return true;

                if (userPrincipal.FindAll("perm").Any(c => string.Equals(c.Value, permissionCode, StringComparison.OrdinalIgnoreCase)))
                    return true;

                var permClaimStr = userPrincipal.FindFirst("permissions")?.Value;
                if (!string.IsNullOrWhiteSpace(permClaimStr))
                {
                    var perms = permClaimStr.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                    if (perms.Any(p => string.Equals(p, permissionCode, StringComparison.OrdinalIgnoreCase)))
                        return true;
                }

                return false;
            }

            var roleClaim = userPrincipal.FindFirst(ClaimTypes.Role)?.Value ?? string.Empty;
            return await HasPermissionAsync(roleClaim, permissionCode, context);
        }

        public static async Task<bool> HasPermissionAsync(string role, string permissionCode, AppDbContext context)
        {
            if (role == "ADMIN") return true;
            if (string.IsNullOrEmpty(role)) return false;

            return await context.RolePermissions
                .Include(rp => rp.Role)
                .Include(rp => rp.Permission)
                .AnyAsync(rp => rp.Role!.Code == role && rp.Permission!.Code == permissionCode);
        }
    }
}