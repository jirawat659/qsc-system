using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QSC.Api.Data;
using QSC.Api.Helpers;
using QSC.Api.Models;

namespace QSC.Api.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class UserController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly Services.IActivityLogger _activityLogger;
        private readonly Services.IPermissionService _permissions;

        public UserController(AppDbContext context, Services.IActivityLogger activityLogger, Services.IPermissionService permissions)
        {
            _permissions = permissions;
            _context = context;
            _activityLogger = activityLogger;
        }

        public class CreateUserDto
        {
            public string Username { get; set; } = string.Empty;
            public string Password { get; set; } = "1234";
            public string FullName { get; set; } = string.Empty;
            public int RoleId { get; set; }
            public string BranchScope { get; set; } = "ALL";
            public List<int> LocationIds { get; set; } = new();
            public string BrandScope { get; set; } = "ALL";
            public List<int> BrandIds { get; set; } = new();
        }

        public class LinkEntraDto
        {
            /// <summary>Object ID (GUID) ของบัญชี Entra — ส่ง null/ว่าง = ยกเลิกการผูก</summary>
            public string? EntraOid { get; set; }
        }

        public class UpdateUserDto
        {
            public string FullName { get; set; } = string.Empty;
            public int RoleId { get; set; }
            public string BranchScope { get; set; } = "ALL";
            public bool IsActive { get; set; } = true;
            public List<int> LocationIds { get; set; } = new();
            public string BrandScope { get; set; } = "ALL";
            public List<int> BrandIds { get; set; } = new();
        }

        // 🔒 RBAC FIX: GetUsers used to return the FULL directory (branch scope, location/brand
        // assignments, mustChangePassword flag, createdAt) to ANY authenticated user — including
        // AUDITEE store managers — because only [Authorize] (no Roles=) was applied. The Master
        // Management screen is hidden from non-admins in the UI, but the API itself had no such
        // check, so anyone could call GET /api/user directly and dump the entire org's user list.
        // Non-admin callers (e.g. AuditorSelectModal / NewScheduleModal / Live Audit's auditor
        // picker) only ever need id/name/role/active-state to populate an assignee dropdown, so
        // they get a minimal projection unless their role has been granted "users.manage" —
        // checked dynamically via RolePermission (same pattern as UpdateAuditRecord below), so an
        // Admin can still delegate full Master Management access to another role at runtime.
        [HttpGet]
        public async Task<IActionResult> GetUsers([FromQuery] bool? activeOnly)
        {
            var (_, callerRole, _) = await UserScopeHelper.GetUserScopeAsync(User, _context);
            bool canManageUsers = await _permissions.HasAsync(User, "users.manage", HttpContext.RequestAborted);

            var query = _context.Users
                .AsNoTracking()
                .Include(u => u.Role)
                .Include(u => u.UserLocations)
                .Include(u => u.UserBrands)
                .AsQueryable();

            if (activeOnly == true)
            {
                query = query.Where(u => u.IsActive);
            }

            var users = await query
                .OrderByDescending(u => u.IsActive)
                .ThenBy(u => u.Id)
                .ToListAsync();

            if (!canManageUsers)
            {
                var minimal = users.Select(u => new
                {
                    id = u.Id,
                    username = u.Username,
                    fullName = u.FullName,
                    roleId = u.RoleId,
                    roleCode = u.Role?.Code,
                    roleName = u.Role?.Name,
                    branchScope = u.BranchScope,
                    brandScope = u.BrandScope,
                    locationIds = u.UserLocations.Select(ul => ul.LocationId).ToList(),
                    brandIds = u.UserBrands.Select(ub => ub.BrandId).ToList(),
                    isActive = u.IsActive
                });
                return Ok(minimal);
            }

            var result = users.Select(u => new
            {
                id = u.Id,
                username = u.Username,
                fullName = u.FullName,
                roleId = u.RoleId,
                roleCode = u.Role?.Code,
                roleName = u.Role?.Name,
                branchScope = u.BranchScope,
                mustChangePassword = u.MustChangePassword,
                entraOid = u.EntraOid,
                isActive = u.IsActive,
                createdAt = u.CreatedAt,
                locationIds = u.UserLocations.Select(ul => ul.LocationId).ToList(),
                brandScope = u.BrandScope,
                brandIds = u.UserBrands.Select(ub => ub.BrandId).ToList()
            });

            return Ok(result);
        }

        // 🔒 RBAC FIX: not consumed by any non-admin screen — gated on the "users.manage"
        // permission (dynamic, same as GetUsers above) instead of a hardcoded ADMIN role.
        [HttpGet("{id}")]
        public async Task<IActionResult> GetUser(int id)
        {
            var (_, callerRole, _) = await UserScopeHelper.GetUserScopeAsync(User, _context);
            if (!await _permissions.HasAsync(User, "users.manage", HttpContext.RequestAborted))
            {
                return Forbid();
            }

            var user = await _context.Users
                .AsNoTracking()
                .Include(u => u.Role)
                .Include(u => u.UserLocations)
                .Include(u => u.UserBrands)
                .FirstOrDefaultAsync(u => u.Id == id);

            if (user == null) return NotFound();

            return Ok(new
            {
                id = user.Id,
                username = user.Username,
                fullName = user.FullName,
                roleId = user.RoleId,
                roleCode = user.Role?.Code,
                roleName = user.Role?.Name,
                branchScope = user.BranchScope,
                mustChangePassword = user.MustChangePassword,
                entraOid = user.EntraOid,
                isActive = user.IsActive,
                createdAt = user.CreatedAt,
                locationIds = user.UserLocations.Select(ul => ul.LocationId).ToList(),
                brandScope = user.BrandScope,
                brandIds = user.UserBrands.Select(ub => ub.BrandId).ToList()
            });
        }

        [Authorize(Roles = "ADMIN")]
        [HttpPost]
        public async Task<IActionResult> CreateUser([FromBody] CreateUserDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Username))
            {
                return BadRequest(new { message = "กรุณาระบุชื่อผู้ใช้งาน" });
            }

            if (string.IsNullOrWhiteSpace(dto.Password) || dto.Password.Length < 4)
            {
                return BadRequest(new { message = "รหัสผ่านเริ่มต้นต้องมีความยาวอย่างน้อย 4 ตัวอักษร" });
            }

            var trimmedUsername = dto.Username.Trim();
            if (await _context.Users.AnyAsync(u => u.Username == trimmedUsername))
            {
                return BadRequest(new { message = "ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว" });
            }

            var user = new User
            {
                Username = trimmedUsername,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
                FullName = dto.FullName,
                RoleId = dto.RoleId,
                BranchScope = dto.BranchScope,
                BrandScope = dto.BrandScope,
                MustChangePassword = true,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            if (dto.BranchScope == "SPECIFIC" && dto.LocationIds.Any())
            {
                var validLocCount = await _context.Locations.CountAsync(l => dto.LocationIds.Contains(l.Id));
                if (validLocCount != dto.LocationIds.Distinct().Count())
                    return BadRequest(new { message = "สาขาบางรายการไม่พบในระบบ" });
            }

            if (dto.BrandScope == "SPECIFIC" && dto.BrandIds.Any())
            {
                var validBrandCount = await _context.Brands.CountAsync(b => dto.BrandIds.Contains(b.Id));
                if (validBrandCount != dto.BrandIds.Distinct().Count())
                    return BadRequest(new { message = "แบรนด์บางรายการไม่พบในระบบ" });
            }

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            if (dto.BranchScope == "SPECIFIC" && dto.LocationIds.Any())
            {
                var distinctLocIds = dto.LocationIds.Distinct().ToList();
                foreach (var locId in distinctLocIds)
                {
                    _context.UserLocations.Add(new UserLocation { UserId = user.Id, LocationId = locId });
                }
                await _context.SaveChangesAsync();
            }

            if (dto.BrandScope == "SPECIFIC" && dto.BrandIds.Any())
            {
                var distinctBrandIds = dto.BrandIds.Distinct().ToList();
                foreach (var brandId in distinctBrandIds)
                {
                    _context.UserBrands.Add(new UserBrand { UserId = user.Id, BrandId = brandId });
                }
                await _context.SaveChangesAsync();
            }

            var (currentUserId, _, _) = await UserScopeHelper.GetUserScopeAsync(User, _context);
            _activityLogger.Add(currentUserId, "USER_CREATE", "User", user.Id);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetUser), new { id = user.Id }, user);
        }

        [Authorize(Roles = "ADMIN")]
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateUser(int id, [FromBody] UpdateUserDto dto)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound();

            if (dto.BranchScope == "SPECIFIC" && dto.LocationIds.Any())
            {
                var validLocCount = await _context.Locations.CountAsync(l => dto.LocationIds.Contains(l.Id));
                if (validLocCount != dto.LocationIds.Distinct().Count())
                    return BadRequest(new { message = "สาขาบางรายการไม่พบในระบบ" });
            }

            if (dto.BrandScope == "SPECIFIC" && dto.BrandIds.Any())
            {
                var validBrandCount = await _context.Brands.CountAsync(b => dto.BrandIds.Contains(b.Id));
                if (validBrandCount != dto.BrandIds.Distinct().Count())
                    return BadRequest(new { message = "แบรนด์บางรายการไม่พบในระบบ" });
            }

            user.FullName = dto.FullName;
            user.RoleId = dto.RoleId;
            user.BranchScope = dto.BranchScope;
            user.IsActive = dto.IsActive;
            user.BrandScope = dto.BrandScope;

            // Sync UserLocations
            var existingLocs = await _context.UserLocations.Where(ul => ul.UserId == id).ToListAsync();
            _context.UserLocations.RemoveRange(existingLocs);

            if (dto.BranchScope == "SPECIFIC" && dto.LocationIds.Any())
            {
                var distinctLocIds = dto.LocationIds.Distinct().ToList();
                foreach (var locId in distinctLocIds)
                {
                    _context.UserLocations.Add(new UserLocation { UserId = id, LocationId = locId });
                }
            }

            // Sync UserBrands
            var existingBrands = await _context.UserBrands.Where(ub => ub.UserId == id).ToListAsync();
            _context.UserBrands.RemoveRange(existingBrands);

            if (dto.BrandScope == "SPECIFIC" && dto.BrandIds.Any())
            {
                var distinctBrandIds = dto.BrandIds.Distinct().ToList();
                foreach (var brandId in distinctBrandIds)
                {
                    _context.UserBrands.Add(new UserBrand { UserId = id, BrandId = brandId });
                }
            }

            var (editUserId, _, _) = await UserScopeHelper.GetUserScopeAsync(User, _context);
            _activityLogger.Add(editUserId, "USER_EDIT", "User", user.Id);

            await _context.SaveChangesAsync();
            return Ok(user);
        }

        // ผูก/ยกเลิกการผูกบัญชี Entra (Object ID) กับผู้ใช้ QSC — แยก endpoint ออกจาก UpdateUser
        // เพื่อไม่ให้การแก้ไขข้อมูลอื่นที่ไม่ได้ส่งค่านี้มา เผลอล้างการผูกของผู้ใช้
        [Authorize(Roles = "ADMIN")]
        [HttpPut("{id}/entra-oid")]
        public async Task<IActionResult> SetEntraOid(int id, [FromBody] LinkEntraDto dto)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound();

            Guid? oid = null;
            var raw = dto?.EntraOid?.Trim();
            if (!string.IsNullOrEmpty(raw))
            {
                if (!Guid.TryParse(raw, out var parsed) || parsed == Guid.Empty)
                    return BadRequest(new { message = "รูปแบบ Object ID ไม่ถูกต้อง (ต้องเป็น GUID เช่น 3f2b8c1e-9d4a-4c5b-8e2f-1a2b3c4d5e6f)" });
                oid = parsed;

                var owner = await _context.Users.AsNoTracking()
                    .Where(u => u.EntraOid == oid && u.Id != id)
                    .Select(u => u.Username)
                    .FirstOrDefaultAsync();
                if (owner != null)
                    return Conflict(new { message = $"Object ID นี้ถูกผูกกับผู้ใช้ \"{owner}\" อยู่แล้ว" });
            }

            if (user.EntraOid == oid) return Ok(new { id = user.Id, entraOid = user.EntraOid });

            user.EntraOid = oid;
            var (adminId, _, _) = await UserScopeHelper.GetUserScopeAsync(User, _context);
            _activityLogger.Add(adminId, oid == null ? "USER_ENTRA_UNLINK" : "USER_ENTRA_LINK", "User", user.Id);

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException)
            {
                // ชนกับ unique index ของ EntraOid (มีคนผูกพร้อมกัน)
                return Conflict(new { message = "Object ID นี้ถูกผูกกับผู้ใช้อื่นแล้ว" });
            }

            return Ok(new { id = user.Id, entraOid = user.EntraOid });
        }

        [Authorize(Roles = "ADMIN")]
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteUser(int id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound();

            var (deleteUserId, _, _) = await UserScopeHelper.GetUserScopeAsync(User, _context);
            user.IsActive = false; // Soft delete
            _activityLogger.Add(deleteUserId, "USER_DISABLE", "User", user.Id);

            await _context.SaveChangesAsync();
            return NoContent();
        }
    }

    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class RoleController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly Services.IActivityLogger _activityLogger;
        private readonly Services.IPermissionService _permissions;

        public RoleController(AppDbContext context, Services.IActivityLogger activityLogger, Services.IPermissionService permissions)
        {
            _context = context;
            _activityLogger = activityLogger;
            _permissions = permissions;
        }

        public class RoleDto
        {
            public string Code { get; set; } = string.Empty;
            public string Name { get; set; } = string.Empty;
            public string? Description { get; set; }
            public List<int?> PermissionIds { get; set; } = new();
            public RoleNavConfigDto? NavConfig { get; set; }
            public string? NavConfigJson { get; set; }
        }

        // 🔒 RBAC FIX: was [Authorize] only, so any logged-in user (any role) could pull the full
        // Roles ➜ Permissions matrix. Gated on the "roles.manage" permission (dynamic, same
        // RolePermission-lookup pattern as UpdateAuditRecord/GetUsers) instead of a hardcoded role,
        // so Admin can still delegate this screen to another role via the Roles tab.
        [HttpGet]
        public async Task<IActionResult> GetRoles()
        {
            var (_, callerRole, _) = await UserScopeHelper.GetUserScopeAsync(User, _context);
            if (!await _permissions.HasAsync(User, "roles.manage", HttpContext.RequestAborted))
            {
                return Forbid();
            }

            var roles = await _context.Roles
                .Include(r => r.RolePermissions)
                .ThenInclude(rp => rp.Permission)
                .AsNoTracking()
                .OrderBy(r => r.Id)
                .ToListAsync();

            var result = roles.Select(r =>
            {
                var navConfig = RoleNavHelper.ParseOrDefault(r.NavConfigJson, r.Code);
                var navConfigJson = !string.IsNullOrWhiteSpace(r.NavConfigJson)
                    ? r.NavConfigJson
                    : RoleNavHelper.Serialize(navConfig);

                return new
                {
                    id = r.Id,
                    code = r.Code,
                    name = r.Name,
                    description = r.Description,
                    navConfigJson = navConfigJson,
                    navConfig = navConfig,
                    permissionIds = r.RolePermissions.Select(rp => rp.PermissionId).ToList(),
                    permissions = r.RolePermissions.Select(rp => rp.Permission!.Code).ToList()
                };
            });

            return Ok(result);
        }

        [Authorize(Roles = "ADMIN")]
        [HttpPut("{id}/nav-config")]
        public async Task<IActionResult> UpdateRoleNavConfig(int id, [FromBody] RoleNavConfigDto dto)
        {
            var role = await _context.Roles.FindAsync(id);
            if (role == null)
            {
                return NotFound(new { message = "ไม่พบบทบาทที่ระบุ" });
            }

            if (!RoleNavHelper.Validate(dto, out var errorMessage, out var normalizedConfig) || normalizedConfig == null)
            {
                return BadRequest(new { message = errorMessage });
            }

            var jsonString = RoleNavHelper.Serialize(normalizedConfig);
            role.NavConfigJson = jsonString;

            var (menuUserId, _, _) = await UserScopeHelper.GetUserScopeAsync(User, _context);
            _activityLogger.Add(menuUserId, "ROLE_EDIT_MENU", "Role", role.Id);

            await _context.SaveChangesAsync();

            return Ok(new
            {
                success = true,
                message = "บันทึกการตั้งค่าแถบเมนูสำเร็จ",
                navConfig = normalizedConfig,
                navConfigJson = jsonString
            });
        }

        [Authorize(Roles = "ADMIN")]
        [HttpPost]
        public async Task<IActionResult> CreateRole([FromBody] RoleDto dto)
        {
            string? navJson = null;
            if (dto.NavConfig != null)
            {
                if (RoleNavHelper.Validate(dto.NavConfig, out _, out var normalized) && normalized != null)
                {
                    navJson = RoleNavHelper.Serialize(normalized);
                }
            }
            else if (!string.IsNullOrWhiteSpace(dto.NavConfigJson))
            {
                navJson = dto.NavConfigJson;
            }
            else
            {
                navJson = RoleNavHelper.GetDefaultNavConfigJson(dto.Code);
            }

            var role = new Role
            {
                Code = dto.Code.ToUpper(),
                Name = dto.Name,
                Description = dto.Description,
                NavConfigJson = navJson,
                CreatedAt = DateTime.UtcNow
            };

            _context.Roles.Add(role);
            await _context.SaveChangesAsync();

            var validCreatePermIds = (dto.PermissionIds ?? new List<int?>())
                .Where(p => p.HasValue && p.Value > 0)
                .Select(p => p!.Value)
                .Distinct()
                .ToList();

            if (validCreatePermIds.Any())
            {
                foreach (var permId in validCreatePermIds)
                {
                    _context.RolePermissions.Add(new RolePermission { RoleId = role.Id, PermissionId = permId });
                }
                await _context.SaveChangesAsync();
            }

            var (createUserId, _, _) = await UserScopeHelper.GetUserScopeAsync(User, _context);
            _activityLogger.Add(createUserId, "ROLE_CREATE", "Role", role.Id);
            await _context.SaveChangesAsync();

            return Ok(role);
        }

        [Authorize(Roles = "ADMIN")]
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateRole(int id, [FromBody] RoleDto dto)
        {
            var role = await _context.Roles.FindAsync(id);
            if (role == null) return NotFound();

            role.Name = dto.Name;
            role.Description = dto.Description;

            if (dto.NavConfig != null)
            {
                if (RoleNavHelper.Validate(dto.NavConfig, out _, out var normalized) && normalized != null)
                {
                    role.NavConfigJson = RoleNavHelper.Serialize(normalized);
                }
            }
            else if (!string.IsNullOrWhiteSpace(dto.NavConfigJson))
            {
                role.NavConfigJson = dto.NavConfigJson;
            }

            // Sync Permissions
            var existingPerms = await _context.RolePermissions.Where(rp => rp.RoleId == id).ToListAsync();
            _context.RolePermissions.RemoveRange(existingPerms);

            var validUpdatePermIds = (dto.PermissionIds ?? new List<int?>())
                .Where(p => p.HasValue && p.Value > 0)
                .Select(p => p!.Value)
                .Distinct()
                .ToList();

            if (validUpdatePermIds.Any())
            {
                foreach (var permId in validUpdatePermIds)
                {
                    _context.RolePermissions.Add(new RolePermission { RoleId = id, PermissionId = permId });
                }
            }

            var existingPermIds = existingPerms.Select(p => p.PermissionId).OrderBy(x => x).ToList();
            var newPermIds = validUpdatePermIds.OrderBy(x => x).ToList();
            bool permChanged = !existingPermIds.SequenceEqual(newPermIds);

            if (permChanged)
            {
                var (editUserId, _, _) = await UserScopeHelper.GetUserScopeAsync(User, _context);
                _activityLogger.Add(editUserId, "ROLE_EDIT_PERMISSION", "Role", role.Id);
            }

            await _context.SaveChangesAsync();
            return Ok(role);
        }

        // 🔒 RBAC FIX: same issue as GetRoles above — gated on "roles.manage" instead of being
        // open to any authenticated role.
        [HttpGet("permissions")]
        public async Task<IActionResult> GetPermissions()
        {
            var (_, callerRole, _) = await UserScopeHelper.GetUserScopeAsync(User, _context);
            if (!await _permissions.HasAsync(User, "roles.manage", HttpContext.RequestAborted))
            {
                return Forbid();
            }

            var permissions = await _context.Permissions
                .AsNoTracking()
                .OrderBy(p => p.Code)
                .ToListAsync();

            return Ok(permissions);
        }
    }
}