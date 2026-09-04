using System;

namespace QSC.Api.Models
{
    public class User
    {
        public int Id { get; set; }
        public string Username { get; set; } = string.Empty;
        [System.Text.Json.Serialization.JsonIgnore]
        public string PasswordHash { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public int RoleId { get; set; }
        public Role? Role { get; set; }
        public string BranchScope { get; set; } = "ALL"; // ALL or SPECIFIC
        public string BrandScope { get; set; } = "ALL"; // ALL or SPECIFIC
        public bool MustChangePassword { get; set; } = true;
        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public ICollection<UserLocation> UserLocations { get; set; } = new List<UserLocation>();
        public ICollection<UserBrand> UserBrands { get; set; } = new List<UserBrand>();
    }
}