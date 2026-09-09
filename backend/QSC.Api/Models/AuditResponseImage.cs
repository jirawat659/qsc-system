using System;

namespace QSC.Api.Models
{
    public class AuditResponseImage
    {
        public int Id { get; set; }
        public int AuditResponseId { get; set; }
        public AuditResponse? AuditResponse { get; set; }
        public string ImageUrl { get; set; } = string.Empty; // Relative path e.g. /uploads/audit_images/img_12.webp
        public int UploadedBy { get; set; }
        public User? Uploader { get; set; }
        public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
    }
}

