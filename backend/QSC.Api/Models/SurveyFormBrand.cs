namespace QSC.Api.Models
{
    public class SurveyFormBrand
    {
        public int Id { get; set; }
        public int SurveyFormId { get; set; }
        public SurveyForm? SurveyForm { get; set; }
        public int BrandId { get; set; }
        public Brand? Brand { get; set; }
    }
}
