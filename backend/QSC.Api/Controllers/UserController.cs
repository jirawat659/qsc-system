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

        public UserController(AppDbContext context)
        {
            _context = context;
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

        [HttpGet]
        public async Task<IActionResult> GetUsers([FromQuery] bool? activeOnly)
        {
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
                isActive = u.IsActive,
                createdAt = u.CreatedAt,
                locationIds = u.UserLocations.Select(ul => ul.LocationId).ToList(),
                brandScope = u.BrandScope,
                brandIds = u.UserBrands.Select(ub => ub.BrandId).ToList()
            });

            return Ok(result);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetUser(int id)
        {
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

            if (string.IsNullOrWhiteSpace(dto.Password) || dto.Password.Length < 6)
            {
                return BadRequest(new { message = "รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร" });
            }

            if (await _context.Users.AnyAsync(u => u.Username.ToLower() == dto.Username.ToLower()))
            {
                return BadRequest(new { message = "ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว" });
            }

            var user = new User
            {
                Username = dto.Username,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
                FullName = dto.FullName,
                RoleId = dto.RoleId,
                BranchScope = dto.BranchScope,
                BrandScope = dto.BrandScope,
                MustChangePassword = true,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

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

            return CreatedAtAction(nameof(GetUser), new { id = user.Id }, user);
        }

        [Authorize(Roles = "ADMIN")]
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateUser(int id, [FromBody] UpdateUserDto dto)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound();

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

            await _context.SaveChangesAsync();
            return Ok(user);
        }

        [Authorize(Roles = "ADMIN")]
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteUser(int id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound();

            user.IsActive = false; // Soft delete
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

        public RoleController(AppDbContext context)
        {
            _context = context;
        }

        public class RoleDto
        {
            public string Code { get; set; } = string.Empty;
            public string Name { get; set; } = string.Empty;
            public string? Description { get; set; }
            public List<int> PermissionIds { get; set; } = new();
            public RoleNavConfigDto? NavConfig { get; set; }
            public string? NavConfigJson { get; set; }
        }

        [HttpGet]
        public async Task<IActionResult> GetRoles()
        {
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

            if (dto.PermissionIds.Any())
            {
                foreach (var permId in dto.PermissionIds)
                {
                    _context.RolePermissions.Add(new RolePermission { RoleId = role.Id, PermissionId = permId });
                }
                await _context.SaveChangesAsync();
            }

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

            if (dto.PermissionIds.Any())
            {
                foreach (var permId in dto.PermissionIds)
                {
                    _context.RolePermissions.Add(new RolePermission { RoleId = id, PermissionId = permId });
                }
            }

            await _context.SaveChangesAsync();
            return Ok(role);
        }

        [HttpGet("permissions")]
        public async Task<IActionResult> GetPermissions()
        {
            var permissions = await _context.Permissions
                .AsNoTracking()
                .OrderBy(p => p.Code)
                .ToListAsync();

            return Ok(permissions);
        }
    }
}