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
        public async Task<IActionResult> GetDashboardInsights([FromQuery] DateTime? month)
        {
            var result = await _aiService.GetDashboardInsightsAsync(month);
            return Ok(result);
        }

        // 2. 📅 GET /api/ai/schedule-recommendations
        [HttpGet("schedule-recommendations")]
        public async Task<IActionResult> GetScheduleRecommendations()
        {
            var result = await _aiService.GetScheduleRecommendationsAsync();
            return Ok(result);
        }

        // 3. 💬 GET /api/ai/cap-analysis/{id}
        [HttpGet("cap-analysis/{id}")]
        public async Task<IActionResult> GetCapAnalysis(int id)
        {
            var result = await _aiService.AnalyzeCapTaskAsync(id);
            return Ok(result);
        }
    }
}
