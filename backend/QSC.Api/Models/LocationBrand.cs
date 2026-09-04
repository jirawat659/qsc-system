using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace QSC.Api.Models
{
    [Table("LocationBrands")]
    public class LocationBrand
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int LocationId { get; set; }
        [ForeignKey(nameof(LocationId))]
        public virtual Location Location { get; set; } = null!;

        [Required]
        public int BrandId { get; set; }
        [ForeignKey(nameof(BrandId))]
        public virtual Brand Brand { get; set; } = null!;

        public bool IsPrimary { get; set; } = false;
    }
}