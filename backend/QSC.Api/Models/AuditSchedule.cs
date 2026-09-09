using System;
using System.Collections.Generic;

namespace QSC.Api.Models
{
    public class AuditSchedule
    {
        public int Id { get; set; }
        public int LocationId { get; set; }
        public Location? Location { get; set; }
        public int SurveyFormId { get; set; }
        public SurveyForm? SurveyForm { get; set; }
        public DateTime ScheduledDate { get; set; }
        public string? Time { get; set; }
        public string AuditType { get; set; } = "announced"; // announced, spot, undercover
        public string Status { get; set; } = "pending"; // pending, in_progress, completed
        public string? Notes { get; set; }
        public int CreatedBy { get; set; }
        public User? Creator { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public List<AuditScheduleAuditor> Auditors { get; set; } = new();
    }
}
