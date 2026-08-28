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

            var query = _context.Locations
                .AsNoTracking()
                .Include(l => l.LocationType)
                .Include(l => l.ManagerUser)
                .AsQueryable();

            if (activeOnly == true)
            {
                query = query.Where(l => l.IsActive);
            }

            if (allowedLocationIds != null)
            {
                query = query.Where(l => allowedLocationIds.Contains(l.Id));
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
                .FirstOrDefaultAsync(l => l.Id == id);

            if (location == null) return NotFound();
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
            existing.BrandName = location.BrandName;
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
}
