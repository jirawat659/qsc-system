using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using QSC.Api.Helpers;
using QSC.Api.Services;
using System.Security.Claims;
using System.Threading.Tasks;

namespace QSC.Api.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class ActivityController : ControllerBase
    {
        private readonly IActivityLogger _activityLogger;

        public ActivityController(IActivityLogger activityLogger)
        {
            _activityLogger = activityLogger;
        }

        public class ExportActivityDto
        {
            public string Action { get; set; } = string.Empty;
            public string? EntityType { get; set; }
            public int? EntityId { get; set; }
            public int? LocationId { get; set; }
        }

        [HttpPost("export")]
        public async Task<IActionResult> LogExportActivity([FromBody] ExportActivityDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Action) || !dto.Action.StartsWith("EXPORT_"))
            {
                return BadRequest(new { message = "รหัสกิจกรรมไม่ถูกต้อง (ต้องขึ้นต้นด้วย EXPORT_)" });
            }

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdClaim, out var userId) || userId <= 0)
            {
                return Unauthorized();
            }

            await _activityLogger.LogAsync(userId, dto.Action, dto.EntityType, dto.EntityId, dto.LocationId);
            return Ok(new { success = true });
        }
    }
}
