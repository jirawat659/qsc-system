namespace QSC.Api.Models
{
    public class SurveyFormTargetLocation
    {
        public int Id { get; set; }
        public int SurveyFormId { get; set; }
        public SurveyForm? SurveyForm { get; set; }
        public int LocationId { get; set; }
        public Location? Location { get; set; }
    }
}

