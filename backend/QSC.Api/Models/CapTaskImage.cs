using System;

namespace QSC.Api.Models
{
    public class CapTaskImage
    {
        public int Id { get; set; }
        public int CapTaskId { get; set; }
        public CapTask? CapTask { get; set; }
        public string Phase { get; set; } = "AFTER"; // AFTER (remediation evidence)
        public string ImageUrl { get; set; } = string.Empty; // Relative path e.g. /uploads/cap_images/after_1.webp
        public int? UploadedBy { get; set; }
        public User? Uploader { get; set; }
        public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
    }
}

