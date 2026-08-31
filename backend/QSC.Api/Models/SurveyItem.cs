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
        public string? CategoryCode { get; set; } // CLN, DOC, OPS, QLT, SVC, etc.
        public string? CategoryName { get; set; } // ความสะอาด, เอกสาร, กระบวนการทำงาน, คุณภาพสินค้า-วัตถุดิบ, การบริการ
        public int OrderIndex { get; set; } = 0;
        public bool IsActive { get; set; } = true;
    }
}