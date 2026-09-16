using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using QSC.Api.Services;

namespace QSC.Api.Controllers
{
    [Authorize]
    [EnableRateLimiting("AiRateLimit")]
    [ApiController]
    [Route("api/[controller]")]
    public class AiController : ControllerBase
    {
        private readonly AiService _aiService;

        public AiController(AiService aiService)
        {
            _aiService = aiService;
        }

        // 1. 📊 GET /api/ai/dashboard-insights
        [HttpGet("dashboard-insights")]
        public async Task<IActionResult> GetDashboardInsights(
            [FromQuery] DateTime? month,
            [FromQuery] string? period = "month",
            [FromQuery] int? brandId = null)
        {
            var result = await _aiService.GetDashboardInsightsAsync(User, month, period, brandId);
            return Ok(result);
        }

        // 2. 📅 GET /api/ai/schedule-recommendations
        [HttpGet("schedule-recommendations")]
        public async Task<IActionResult> GetScheduleRecommendations()
        {
            var result = await _aiService.GetScheduleRecommendationsAsync(User);
            return Ok(result);
        }

        // 3. 💬 GET /api/ai/cap-analysis/{id}
        [HttpGet("cap-analysis/{id}")]
        public async Task<IActionResult> GetCapAnalysis(int id)
        {
            var result = await _aiService.AnalyzeCapTaskAsync(User, id);
            if (result == null)
            {
                return Forbid();
            }
            return Ok(result);
        }

        public class AskScheduleQuestionDto
        {
            public string Question { get; set; } = string.Empty;
        }

        // 4. 💬 POST /api/ai/ask-schedule
        [HttpPost("ask-schedule")]
        public async Task<IActionResult> AskSchedule([FromBody] AskScheduleQuestionDto dto)
        {
            var answer = await _aiService.AskScheduleQuestionAsync(User, dto?.Question ?? string.Empty);
            return Ok(new { answer });
        }
        // 5. 🩺 GET /api/ai/audit-analysis/{id}
        [HttpGet("audit-analysis/{id}")]
        public async Task<IActionResult> GetAuditDefectAnalysis(int id, [FromQuery] bool forceRefresh = false)
        {
            var result = await _aiService.AnalyzeAuditRecordDefectsAsync(User, id, forceRefresh);
            if (result == null)
            {
                return Forbid();
            }
            return Ok(result);
        }
    }
}