using System;
using System.Collections.Generic;

namespace QSC.Api.Models
{
    public class SurveyForm
    {
        public int Id { get; set; }
        public int? FormGroupId { get; set; } // self-ref for version lineage
        public SurveyForm? FormGroup { get; set; }
        public string Title { get; set; } = string.Empty;
        public int? LocationTypeId { get; set; }
        public LocationType? LocationType { get; set; }
        public double PassingScore { get; set; } = 85.0;
        public string TargetingMode { get; set; } = "ALL_LOCATIONS"; // ALL_LOCATIONS or SPECIFIC_LOCATIONS
        public string Version { get; set; } = "v1.0";
        public bool IsLatest { get; set; } = true;
        public bool IsActive { get; set; } = true;
        public int? CreatedBy { get; set; }
        public User? Creator { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public List<SurveySection> Sections { get; set; } = new();
    }
}
