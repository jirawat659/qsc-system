namespace QSC.Api.Models
{
    public class Permission
    {
        public int Id { get; set; }
        public string Code { get; set; } = string.Empty; // menu.dashboard, menu.audit, forms.manage, cap.approve
        public string Name { get; set; } = string.Empty; // ชื่อสิทธิ์ เช่น เข้าเมนูตรวจหน้างานสด
        public string Module { get; set; } = string.Empty; // Dashboard, Audit, Schedule, Form, CAP, System
        public string? Description { get; set; }
    }
}