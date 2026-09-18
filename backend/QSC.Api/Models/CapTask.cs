using System;
using System.Collections.Generic;

namespace QSC.Api.Models
{
    public class CapTask
    {
        public int Id { get; set; }
        public int? AuditRecordId { get; set; }
        public AuditRecord? AuditRecord { get; set; }
        public int? AuditResponseId { get; set; } // Nullable for ad-hoc / manual CAP
        public AuditResponse? AuditResponse { get; set; }
        public int LocationId { get; set; }
        public Location? Location { get; set; }
        public string? CategoryName { get; set; }
        public string IssueItem { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public DateTime SubmissionDeadline { get; set; }
        public string Status { get; set; } = "OPEN"; // OPEN, SUBMITTED, REJECTED, CLOSED
        public int? AssignedTo { get; set; }
        public User? Assignee { get; set; }
        public int? VerifiedBy { get; set; }
        public User? Verifier { get; set; }
        public DateTime? CompletedAt { get; set; }
        public DateTime? ClosedAt { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // 📌 Next Audit Recommendation Follow-Up
        public string? NextAuditNote { get; set; }
        public string FollowUpStatus { get; set; } = "NONE"; // NONE, PENDING, USED
        public int? FollowUpScheduleId { get; set; }

        public List<CapTaskImage> Images { get; set; } = new();
        public List<CapTaskComment> Comments { get; set; } = new();
    }
}
