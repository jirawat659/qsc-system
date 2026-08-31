using System;

namespace QSC.Api.Models
{
    public class Role
    {
        public int Id { get; set; }
        public string Code { get; set; } = string.Empty; // ADMIN, AUDITOR, AUDITEE, STANDARD, EXEC
        public string Name { get; set; } = string.Empty; // ผู้ตรวจประเมิน, ผู้ดูแลมาตรฐาน (QA), etc.
        public string? Description { get; set; }
        public string? NavConfigJson { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}

