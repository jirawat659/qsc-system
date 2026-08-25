using System.Collections.Generic;

namespace QSC.Api.Models
{
    public class AuditResponse
    {
        public int Id { get; set; }
        public int AuditRecordId { get; set; }
        public AuditRecord? AuditRecord { get; set; }
        public int SurveyItemId { get; set; }
        public SurveyItem? SurveyItem { get; set; }
        public double ScoreGiven { get; set; }
        public bool IsPassed { get; set; }
        public bool IsNa { get; set; } = false; // Not Applicable (N/A) / ข้าม
        public string? Notes { get; set; }

        public List<AuditResponseImage> Images { get; set; } = new();
    }
}
