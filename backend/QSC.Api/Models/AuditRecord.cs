using System;
using System.Collections.Generic;

namespace QSC.Api.Models
{
    public class AuditRecord
    {
        public int Id { get; set; }
        public int LocationId { get; set; }
        public Location? Location { get; set; }
        public int SurveyFormId { get; set; }
        public SurveyForm? SurveyForm { get; set; }
        public int PrimaryAuditorId { get; set; }
        public User? PrimaryAuditor { get; set; }
        public int? AuditeeUserId { get; set; }
        public User? AuditeeUser { get; set; }
        public string? AuditeeNameText { get; set; }
        public int? AuditScheduleId { get; set; }
        public AuditSchedule? AuditSchedule { get; set; }
        public DateTime AuditDate { get; set; } = DateTime.UtcNow;
        public double TotalScore { get; set; }
        public double MaxScore { get; set; }
        public double PercentageScore { get; set; }
        public bool IsPassed { get; set; }
        public bool HasCriticalDefect { get; set; } = false;
        public int StaffCount { get; set; } = 0;
        public string AuditType { get; set; } = "announced";
        public string? Notes { get; set; }
        public string? MetadataValuesJson { get; set; }
        
        // Digital Signatures
        public string? AuditorSignatureUrl { get; set; }
        public string? AuditeeSignatureUrl { get; set; }
        public DateTime? SignedAt { get; set; }

        // Start & End GPS Coordinates
        public double? StartLatitude { get; set; }
        public double? StartLongitude { get; set; }
        public double? EndLatitude { get; set; }
        public double? EndLongitude { get; set; }
        public DateTime? StartedAt { get; set; }
        public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;

        public List<AuditResponse> Responses { get; set; } = new();
    }
}
