using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QSC.Api.Data;
using QSC.Api.Models;

using QSC.Api.Helpers;

namespace QSC.Api.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class LocationController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly Services.IActivityLogger _activityLogger;

        public LocationController(AppDbContext context, Services.IActivityLogger activityLogger)
        {
            _context = context;
            _activityLogger = activityLogger;
        }

        [HttpGet]
        public async Task<IActionResult> GetLocations([FromQuery] bool? activeOnly)
        {
            var scope = await UserScopeHelper.GetUserFullScopeAsync(User, _context);

            var query = _context.Locations
                .AsNoTracking()
                .AsQueryable();

            if (activeOnly == true)
            {
                query = query.Where(l => l.IsActive);
            }

            if (scope.AllowedLocationIds != null)
            {
                query = query.Where(l => scope.AllowedLocationIds.Contains(l.Id));
            }

            if (scope.AllowedBrandIds != null)
            {
                query = query.Where(l =>
                    l.LocationBrands.Any(lb => scope.AllowedBrandIds.Contains(lb.BrandId)));
            }

            var locations = await query
                .OrderByDescending(l => l.IsActive)
                .ThenBy(l => l.Code)
                .Select(l => new
                {
                    id = l.Id,
                    code = l.Code,
                    name = l.Name,
                    locationTypeId = l.LocationTypeId,
                    locationType = l.LocationType != null ? new
                    {
                        id = l.LocationType.Id,
                        code = l.LocationType.Code,
                        name = l.LocationType.Name,
                        description = l.LocationType.Description,
                        isActive = l.LocationType.IsActive
                    } : null,
                    managerUserId = l.ManagerUserId,
                    managerUserName = l.ManagerUser != null ? l.ManagerUser.FullName : null,
                    managerUser = l.ManagerUser != null ? new
                    {
                        id = l.ManagerUser.Id,
                        username = l.ManagerUser.Username,
                        fullName = l.ManagerUser.FullName
                    } : null,
                    latitude = l.Latitude,
                    longitude = l.Longitude,
                    region = l.Region,
                    address = l.Address,
                    phone = l.Phone,
                    isActive = l.IsActive,
                    lastScore = l.LastScore,
                    lastAuditDate = l.LastAuditDate,
                    lastAuditorName = _context.AuditRecords
                        .Where(a => a.LocationId == l.Id)
                        .OrderByDescending(a => a.AuditDate)
                        .ThenByDescending(a => a.Id)
                        .Select(a => a.PrimaryAuditor != null ? a.PrimaryAuditor.FullName : null)
                        .FirstOrDefault(),
                    auditorName = _context.AuditRecords
                        .Where(a => a.LocationId == l.Id)
                        .OrderByDescending(a => a.AuditDate)
                        .ThenByDescending(a => a.Id)
                        .Select(a => a.PrimaryAuditor != null ? a.PrimaryAuditor.FullName : null)
                        .FirstOrDefault(),
                    createdAt = l.CreatedAt,
                    locationBrands = l.LocationBrands.Select(lb => new
                    {
                        locationId = lb.LocationId,
                        brandId = lb.BrandId,
                        brand = lb.Brand != null ? new
                        {
                            id = lb.Brand.Id,
                            code = lb.Brand.Code,
                            name = lb.Brand.Name
                        } : null
                    }).ToList()
                })
                .ToListAsync();

            return Ok(locations);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetLocation(int id)
        {
            var (_, _, allowedLocationIds) = await UserScopeHelper.GetUserScopeAsync(User, _context);
            if (allowedLocationIds != null && !allowedLocationIds.Contains(id))
            {
                return Forbid();
            }

            var location = await _context.Locations
                .AsNoTracking()
                .Include(l => l.LocationType)
                .Include(l => l.ManagerUser)
                .Include(l => l.LocationBrands).ThenInclude(lb => lb.Brand)
                .FirstOrDefaultAsync(l => l.Id == id);

            if (location == null) return NotFound();

            var (_, _, allowedBrandIds) = await UserScopeHelper.GetUserBrandScopeAsync(User, _context);
            if (allowedBrandIds != null &&
                !location.LocationBrands.Any(lb => allowedBrandIds.Contains(lb.BrandId)))
            {
                return Forbid();
            }

            return Ok(location);
        }

        [Authorize(Roles = "ADMIN")]
        [HttpPost]
        public async Task<IActionResult> CreateLocation([FromBody] Location location)
        {
            location.CreatedAt = DateTime.UtcNow;
            _context.Locations.Add(location);
            await _context.SaveChangesAsync();

            var (createUserId, _, _) = await UserScopeHelper.GetUserScopeAsync(User, _context);
            _activityLogger.Add(createUserId, "LOCATION_CREATE", "Location", location.Id, location.Id);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetLocation), new { id = location.Id }, location);
        }

        [Authorize(Roles = "ADMIN")]
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateLocation(int id, [FromBody] Location location)
        {
            if (id != location.Id) return BadRequest();

            var existing = await _context.Locations.FindAsync(id);
            if (existing == null) return NotFound();

            existing.Code = location.Code;
            existing.Name = location.Name;
            existing.LocationTypeId = location.LocationTypeId;
            existing.ManagerUserId = location.ManagerUserId;
            existing.Latitude = location.Latitude;
            existing.Longitude = location.Longitude;
            existing.Region = location.Region;
            existing.Address = location.Address;
            existing.Phone = location.Phone;
            existing.IsActive = location.IsActive;

            var (editUserId, _, _) = await UserScopeHelper.GetUserScopeAsync(User, _context);
            _activityLogger.Add(editUserId, "LOCATION_EDIT", "Location", existing.Id, existing.Id);

            await _context.SaveChangesAsync();
            return Ok(existing);
        }

        [Authorize(Roles = "ADMIN")]
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteLocation(int id)
        {
            var location = await _context.Locations.FindAsync(id);
            if (location == null) return NotFound();

            location.IsActive = false; // Soft delete

            var (deleteUserId, _, _) = await UserScopeHelper.GetUserScopeAsync(User, _context);
            _activityLogger.Add(deleteUserId, "LOCATION_DISABLE", "Location", location.Id, location.Id);

            await _context.SaveChangesAsync();
            return NoContent();
        }

        // ══════════════════════════════════════════════════════════════
        // 🌟 M2M: ผูก / ถอน / ตั้ง Primary แบรนด์ให้สถานที่
        // ══════════════════════════════════════════════════════════════

        public class BindBrandDto
        {
            public int BrandId { get; set; }
        }

        [Authorize(Roles = "ADMIN")]
        [HttpPost("{id}/brands")]
        public async Task<IActionResult> BindBrand(int id, [FromBody] BindBrandDto dto)
        {
            var location = await _context.Locations.FindAsync(id);
            if (location == null) return NotFound(new { message = "ไม่พบสถานที่ที่ระบุ" });

            var brand = await _context.Brands.FindAsync(dto.BrandId);
            if (brand == null) return NotFound(new { message = "ไม่พบแบรนด์ที่ระบุ" });

            var alreadyBound = await _context.LocationBrands
                .AnyAsync(lb => lb.LocationId == id && lb.BrandId == dto.BrandId);
            if (alreadyBound)
            {
                return BadRequest(new { message = "สถานที่นี้ผูกกับแบรนด์นี้อยู่แล้ว" });
            }

            var newLink = new LocationBrand
            {
                LocationId = id,
                BrandId = dto.BrandId
            };
            _context.LocationBrands.Add(newLink);

            var (bindUserId, _, _) = await UserScopeHelper.GetUserScopeAsync(User, _context);
            _activityLogger.Add(bindUserId, "LOCATION_EDIT", "Location", id, id);

            await _context.SaveChangesAsync();

            return Ok(newLink);
        }

        [Authorize(Roles = "ADMIN")]
        [HttpDelete("{id}/brands/{brandId}")]
        public async Task<IActionResult> UnbindBrand(int id, int brandId)
        {
            var link = await _context.LocationBrands
                .FirstOrDefaultAsync(lb => lb.LocationId == id && lb.BrandId == brandId);
            if (link == null) return NotFound(new { message = "ไม่พบการผูกแบรนด์นี้กับสถานที่นี้" });

            _context.LocationBrands.Remove(link);

            var (unbindUserId, _, _) = await UserScopeHelper.GetUserScopeAsync(User, _context);
            _activityLogger.Add(unbindUserId, "LOCATION_EDIT", "Location", id, id);

            await _context.SaveChangesAsync();

            return NoContent();
        }

        public class SyncLocationBrandsDto
        {
            public List<int> BrandIds { get; set; } = new List<int>();
        }

        [Authorize(Roles = "ADMIN")]
        [HttpPut("{id}/brands")]
        public async Task<IActionResult> SyncBrands(int id, [FromBody] SyncLocationBrandsDto dto)
        {
            var location = await _context.Locations.FindAsync(id);
            if (location == null) return NotFound(new { message = "ไม่พบสถานที่ที่ระบุ" });

            var existingLinks = await _context.LocationBrands
                .Where(lb => lb.LocationId == id)
                .ToListAsync();

            var targetBrandIds = (dto.BrandIds ?? new List<int>()).Distinct().ToList();

            if (targetBrandIds.Any())
            {
                var validBrandCount = await _context.Brands.CountAsync(b => targetBrandIds.Contains(b.Id));
                if (validBrandCount != targetBrandIds.Count)
                {
                    return BadRequest(new { message = "บางแบรนด์ที่ระบุไม่พบในระบบ" });
                }
            }

            var toRemove = existingLinks.Where(lb => !targetBrandIds.Contains(lb.BrandId)).ToList();
            var existingBrandIds = existingLinks.Select(lb => lb.BrandId).ToHashSet();
            var toAdd = targetBrandIds.Where(bid => !existingBrandIds.Contains(bid))
                .Select(bid => new LocationBrand { LocationId = id, BrandId = bid })
                .ToList();

            if (toRemove.Any()) _context.LocationBrands.RemoveRange(toRemove);
            if (toAdd.Any()) _context.LocationBrands.AddRange(toAdd);

            var (syncUserId, _, _) = await UserScopeHelper.GetUserScopeAsync(User, _context);
            _activityLogger.Add(syncUserId, "LOCATION_EDIT", "Location", id, id);

            await _context.SaveChangesAsync();
            return Ok(new { message = "บันทึกการผูกแบรนด์สำเร็จ", count = targetBrandIds.Count });
        }
    }

    [Authorize]
    [ApiController]
    [Route("api/location-type")]
    public class LocationTypeController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly Services.IActivityLogger _activityLogger;

        public LocationTypeController(AppDbContext context, Services.IActivityLogger activityLogger)
        {
            _context = context;
            _activityLogger = activityLogger;
        }

        [HttpGet]
        public async Task<IActionResult> GetLocationTypes()
        {
            var types = await _context.LocationTypes
                .AsNoTracking()
                .Where(t => t.IsActive)
                .OrderBy(t => t.Name)
                .ToListAsync();
            return Ok(types);
        }

        [Authorize(Roles = "ADMIN")]
        [HttpPost]
        public async Task<IActionResult> CreateLocationType([FromBody] LocationType type)
        {
            _context.LocationTypes.Add(type);
            await _context.SaveChangesAsync();

            var (createUserId, _, _) = await UserScopeHelper.GetUserScopeAsync(User, _context);
            _activityLogger.Add(createUserId, "LOCATION_TYPE_CREATE", "LocationType", type.Id);
            await _context.SaveChangesAsync();

            return Ok(type);
        }

        [Authorize(Roles = "ADMIN")]
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateLocationType(int id, [FromBody] LocationType type)
        {
            if (id != type.Id) return BadRequest();
            var existing = await _context.LocationTypes.FindAsync(id);
            if (existing == null) return NotFound();

            existing.Code = type.Code;
            existing.Name = type.Name;
            existing.Description = type.Description;
            existing.IsActive = type.IsActive;

            var (editUserId, _, _) = await UserScopeHelper.GetUserScopeAsync(User, _context);
            _activityLogger.Add(editUserId, "LOCATION_TYPE_EDIT", "LocationType", existing.Id);

            await _context.SaveChangesAsync();
            return Ok(existing);
        }
    }

    [Authorize]
    [ApiController]
    [Route("api/brand")]
    public class BrandController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly Services.IActivityLogger _activityLogger;

        public BrandController(AppDbContext context, Services.IActivityLogger activityLogger)
        {
            _context = context;
            _activityLogger = activityLogger;
        }

        public class UpsertBrandDto
        {
            public string Code { get; set; } = string.Empty;
            public string Name { get; set; } = string.Empty;
            public string? Description { get; set; }
            public bool IsActive { get; set; } = true;
        }

        [HttpGet]
        public async Task<IActionResult> GetBrands([FromQuery] bool? activeOnly)
        {
            var (_, _, allowedBrandIds) = await UserScopeHelper.GetUserBrandScopeAsync(User, _context);
            var query = _context.Brands.AsNoTracking().AsQueryable();

            if (allowedBrandIds != null)
            {
                query = query.Where(b => allowedBrandIds.Contains(b.Id));
            }
            if (activeOnly == true)
            {
                query = query.Where(b => b.IsActive);
            }
            var brands = await query.OrderBy(b => b.Name).ToListAsync();
            return Ok(brands);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetBrand(int id)
        {
            var (_, _, allowedBrandIds) = await UserScopeHelper.GetUserBrandScopeAsync(User, _context);
            if (allowedBrandIds != null && !allowedBrandIds.Contains(id))
            {
                return Forbid();
            }

            var brand = await _context.Brands.AsNoTracking().FirstOrDefaultAsync(b => b.Id == id);
            if (brand == null) return NotFound();
            return Ok(brand);
        }

        [Authorize(Roles = "ADMIN")]
        [HttpPost]
        public async Task<IActionResult> CreateBrand([FromBody] UpsertBrandDto dto)
        {
            var code = (dto.Code ?? string.Empty).Trim().ToUpperInvariant();
            var name = (dto.Name ?? string.Empty).Trim();

            if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(name))
            {
                return BadRequest(new { message = "กรุณาระบุรหัสและชื่อแบรนด์" });
            }

            var duplicate = await _context.Brands.AnyAsync(b =>
                b.Code.ToUpper() == code || b.Name.ToUpper() == name.ToUpper());

            if (duplicate)
            {
                return Conflict(new { message = "รหัสหรือชื่อแบรนด์นี้มีอยู่แล้ว" });
            }

            var brand = new Brand
            {
                Code = code,
                Name = name,
                Description = dto.Description?.Trim(),
                IsActive = dto.IsActive,
                CreatedAt = DateTime.UtcNow
            };

            _context.Brands.Add(brand);
            await _context.SaveChangesAsync();

            var (createUserId, _, _) = await UserScopeHelper.GetUserScopeAsync(User, _context);
            _activityLogger.Add(createUserId, "BRAND_CREATE", "Brand", brand.Id);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetBrand), new { id = brand.Id }, brand);
        }

        [Authorize(Roles = "ADMIN")]
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateBrand(int id, [FromBody] UpsertBrandDto dto)
        {
            var existing = await _context.Brands.FindAsync(id);
            if (existing == null) return NotFound();

            var code = (dto.Code ?? string.Empty).Trim().ToUpperInvariant();
            var name = (dto.Name ?? string.Empty).Trim();

            if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(name))
            {
                return BadRequest(new { message = "กรุณาระบุรหัสและชื่อแบรนด์" });
            }

            var duplicate = await _context.Brands.AnyAsync(b =>
                b.Id != id &&
                (b.Code.ToUpper() == code || b.Name.ToUpper() == name.ToUpper()));

            if (duplicate)
            {
                return Conflict(new { message = "รหัสหรือชื่อแบรนด์นี้มีอยู่แล้ว" });
            }

            existing.Code = code;
            existing.Name = name;
            existing.Description = dto.Description?.Trim();
            existing.IsActive = dto.IsActive;

            var (editUserId, _, _) = await UserScopeHelper.GetUserScopeAsync(User, _context);
            _activityLogger.Add(editUserId, "BRAND_EDIT", "Brand", existing.Id);

            await _context.SaveChangesAsync();
            return Ok(existing);
        }

        [Authorize(Roles = "ADMIN")]
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteBrand(int id)
        {
            var brand = await _context.Brands.FindAsync(id);
            if (brand == null) return NotFound();

            // Soft delete: ปิดการใช้งานแบรนด์ เพื่อรักษาประวัติการตรวจและความสัมพันธ์ในอดีตไม่ให้สูญหาย
            brand.IsActive = false;

            var (deleteUserId, _, _) = await UserScopeHelper.GetUserScopeAsync(User, _context);
            _activityLogger.Add(deleteUserId, "BRAND_DISABLE", "Brand", brand.Id);

            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}