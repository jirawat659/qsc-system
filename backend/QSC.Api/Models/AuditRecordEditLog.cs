using System;

namespace QSC.Api.Models
{
    /// <summary>
    /// เก็บ trail การแก้ไขบันทึกตรวจที่ส่งแล้ว — 1 แถวต่อ 1 ครั้งที่แก้
    /// บังคับมี Reason เสมอ (validate ที่ AuditController.UpdateAuditRecord)
    /// </summary>
    public class AuditRecordEditLog
    {
        public int Id { get; set; }
        public int AuditRecordId { get; set; }
        public AuditRecord? AuditRecord { get; set; }
        public int EditedByUserId { get; set; }
        public User? EditedByUser { get; set; }
        public DateTime EditedAt { get; set; } = DateTime.UtcNow;
        public string Reason { get; set; } = string.Empty;      // บังคับกรอกเสมอ
        public string? ChangesSummaryJson { get; set; }         // เก็บค่าก่อน/หลังของ field หลักๆ ที่เปลี่ยน (ไว้ตรวจสอบย้อนหลัง)
    }
}