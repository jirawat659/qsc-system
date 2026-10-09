using System;

namespace QSC.Api.Models
{
    public class ActivityLog
    {
        public int Id { get; set; }
        public DateTime OccurredAt { get; set; } = DateTime.UtcNow;
        public int UserId { get; set; }
        public string Action { get; set; } = string.Empty;
        public string? EntityType { get; set; }
        public int? EntityId { get; set; }
        public int? LocationId { get; set; }
    }
}

