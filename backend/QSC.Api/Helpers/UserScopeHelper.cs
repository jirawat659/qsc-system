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
            if (roleClaim == "ADMIN" || roleClaim == "EXEC")
            {
                return new UserFullScope(userId, roleClaim, null, null);
            }

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

            var role = user.Role?.Code ?? string.Empty;

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