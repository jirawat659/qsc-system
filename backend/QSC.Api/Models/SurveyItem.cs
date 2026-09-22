namespace QSC.Api.Models
{
    public class SurveyItem
    {
        public int Id { get; set; }
        public int SurveySectionId { get; set; }
        public SurveySection? SurveySection { get; set; }
        public string QuestionText { get; set; } = string.Empty;
        public string QuestionType { get; set; } = "YESNO"; // YESNO, SCALE, TEXT
        public double FullScore { get; set; } = 10.0;
        public bool IsCritical { get; set; } = false;
        public string? CategoryCode { get; set; } // PD, PC, S, C, DM
        public string? CategoryName { get; set; } // Product, Process, Service, Cleanliness, Documents
        public int OrderIndex { get; set; } = 0;
        public bool IsActive { get; set; } = true;
    }
}