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

        public LocationController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetLocations([FromQuery] bool? activeOnly)
        {
            var (_, _, allowedLocationIds) = await UserScopeHelper.GetUserScopeAsync(User, _context);
            var (_, _, allowedBrandIds) = await UserScopeHelper.GetUserBrandScopeAsync(User, _context);

            var query = _context.Locations
                .AsNoTracking()
                .Include(l => l.LocationType)
                .Include(l => l.ManagerUser)
                .Include(l => l.LocationBrands).ThenInclude(lb => lb.Brand)
                .AsQueryable();

            if (activeOnly == true)
            {
                query = query.Where(l => l.IsActive);
            }

            if (allowedLocationIds != null)
            {
                query = query.Where(l => allowedLocationIds.Contains(l.Id));
            }

            if (allowedBrandIds != null)
            {
                // Brand-restricted user ต้องเห็นเฉพาะ Location ที่มีแบรนด์ตรงกับสิทธิ์
                // ดังนั้น Location ที่ไม่มี LocationBrand (เช่น HQ-01) จะไม่แสดงใน scope นี้
                query = query.Where(l =>
                    l.LocationBrands.Any(lb => allowedBrandIds.Contains(lb.BrandId)));
            }

            var locations = await query.OrderByDescending(l => l.IsActive).ThenBy(l => l.Code).ToListAsync();
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
            await _context.SaveChangesAsync();

            return NoContent();
        }
    }

    [Authorize]
    [ApiController]
    [Route("api/location-type")]
    public class LocationTypeController : ControllerBase
    {
        private readonly AppDbContext _context;

        public LocationTypeController(AppDbContext context)
        {
            _context = context;
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

        public BrandController(AppDbContext context)
        {
            _context = context;
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

            await _context.SaveChangesAsync();
            return Ok(existing);
        }

        [Authorize(Roles = "ADMIN")]
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteBrand(int id)
        {
            var brand = await _context.Brands.FindAsync(id);
            if (brand == null) return NotFound();

            // LocationBrand ใช้ Cascade delete: ลบ Brand แล้วลบเฉพาะแถว join ที่เกี่ยวข้อง
            // ไม่ลบ Location เพื่อไม่ให้สถานที่เสียหายหรือถูกลบตามแบรนด์
            _context.Brands.Remove(brand);
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}