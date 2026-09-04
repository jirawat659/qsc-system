using System;

namespace QSC.Api.Models
{
    public class Brand
    {
        public int Id { get; set;}
        public  string Code {get; set;} = string.Empty;
        public string Name {get; set;} = string.Empty;
        public string? Description {get; set;}
        public bool IsActive {get; set;} = true;
        public DateTime CreatedAt {get; set;} = DateTime.UtcNow;

        public ICollection<LocationBrand> LocationBrands { get; set; } = new List<LocationBrand>();
        public ICollection<UserBrand> UserBrands { get; set; } = new List<UserBrand>();
    }
}