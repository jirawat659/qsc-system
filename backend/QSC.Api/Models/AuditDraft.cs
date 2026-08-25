using System;

namespace QSC.Api.Models
{
    public class AuditDraft
    {
        public int Id { get; set; }
        public int LocationId { get; set; }
        public Location? Location { get; set; }
        public int SurveyFormId { get; set; }
        public SurveyForm? SurveyForm { get; set; }
        public int AuditorId { get; set; }
        public User? Auditor { get; set; }
        public string DraftPayloadJson { get; set; } = string.Empty;
        public int CurrentSectionIdx { get; set; } = 0;
        public int TotalAnswered { get; set; } = 0;
        public int TotalQuestions { get; set; } = 0;
        public double? StartLatitude { get; set; }
        public double? StartLongitude { get; set; }
        public DateTime? StartedAt { get; set; }
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
