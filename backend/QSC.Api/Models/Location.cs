using System;

namespace QSC.Api.Models
{
    public class Location
    {
        public int Id { get; set; }
        public string Code { get; set; } = string.Empty; // BKK-001
        public string Name { get; set; } = string.Empty; // สาขาสยามพารากอน
        public int LocationTypeId { get; set; }
        public LocationType? LocationType { get; set; }
        public int? ManagerUserId { get; set; }
        public User? ManagerUser { get; set; }
        public double Latitude { get; set; }
        public double Longitude { get; set; }
        public string Region { get; set; } = string.Empty;
        public string BrandName { get; set; } = string.Empty;
        public string Address { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public double LastScore { get; set; } = 0.0; // Cache
        public DateTime? LastAuditDate { get; set; } // Cache
        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public ICollection<LocationBrand> LocationBrands { get; set; } = new List<LocationBrand>();
        public ICollection<UserLocation> UserLocations { get; set; } = new List<UserLocation>();
    }
}