using System.Collections.Generic;

namespace QSC.Api.Models
{
    public class SurveySection
    {
        public int Id { get; set; }
        public int SurveyFormId { get; set; }
        public SurveyForm? SurveyForm { get; set; }
        public string Title { get; set; } = string.Empty;
        public int OrderIndex { get; set; } = 0;
        public double WeightPercent { get; set; } = 0.0;
        public bool IsActive { get; set; } = true;

        public List<SurveyItem> Items { get; set; } = new();
    }
}
