namespace QSC.Api.Models
{
    public class LocationType
    {
        public int Id { get; set; }
        public string Code { get; set; } = string.Empty; // STORE, PLANT, OFFICE, CLOUD_KITCHEN
        public string Name { get; set; } = string.Empty; // สาขาหน้าร้าน, โรงงานผลิต, สำนักงานใหญ่
        public string? Description { get; set; }
        public bool IsActive { get; set; } = true;
    }
}

