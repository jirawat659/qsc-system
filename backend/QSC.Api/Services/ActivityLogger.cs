using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using QSC.Api.Data;
using QSC.Api.Models;
using System;
using System.Threading.Tasks;

namespace QSC.Api.Services
{
    public interface IActivityLogger
    {
        void Add(int userId, string action, string? entityType = null, int? entityId = null, int? locationId = null, DateTime? occurredAt = null, string? details = null);
        Task LogAsync(int userId, string action, string? entityType = null, int? entityId = null, int? locationId = null, DateTime? occurredAt = null, string? details = null);
    }

    public class ActivityLogger : IActivityLogger
    {
        private readonly AppDbContext _context;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<ActivityLogger> _logger;

        public ActivityLogger(AppDbContext context, IServiceScopeFactory scopeFactory, ILogger<ActivityLogger> logger)
        {
            _context = context;
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        public void Add(int userId, string action, string? entityType = null, int? entityId = null, int? locationId = null, DateTime? occurredAt = null, string? details = null)
        {
            _context.ActivityLogs.Add(new ActivityLog
            {
                UserId = userId,
                Action = action,
                EntityType = entityType,
                EntityId = entityId,
                LocationId = locationId,
                OccurredAt = occurredAt ?? DateTime.UtcNow,
                Details = details
            });
        }

        public async Task LogAsync(int userId, string action, string? entityType = null, int? entityId = null, int? locationId = null, DateTime? occurredAt = null, string? details = null)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                db.ActivityLogs.Add(new ActivityLog
                {
                    UserId = userId,
                    Action = action,
                    EntityType = entityType,
                    EntityId = entityId,
                    LocationId = locationId,
                    OccurredAt = occurredAt ?? DateTime.UtcNow,
                    Details = details
                });
                await db.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to log activity: {Action} for user {UserId}", action, userId);
            }
        }
    }
}
