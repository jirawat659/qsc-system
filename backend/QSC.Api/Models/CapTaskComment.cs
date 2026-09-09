using System;

namespace QSC.Api.Models
{
    public class CapTaskComment
    {
        public int Id { get; set; }
        public int CapTaskId { get; set; }
        public CapTask? CapTask { get; set; }
        public int SenderId { get; set; }
        public User? Sender { get; set; }
        public string SenderRole { get; set; } = "AUDITEE"; // AUDITEE, QA, ADMIN
        public string Message { get; set; } = string.Empty;
        public string? ImageUrl { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
