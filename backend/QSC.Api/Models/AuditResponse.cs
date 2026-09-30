using System.Collections.Generic;

namespace QSC.Api.Models
{
    public class AuditResponse
    {
        public int Id { get; set; }
        public int AuditRecordId { get; set; }
        public AuditRecord? AuditRecord { get; set; }
        public int SurveyItemId { get; set; }
        public SurveyItem? SurveyItem { get; set; }
        public double ScoreGiven { get; set; }

        // คะแนนเต็มของข้อ "ณ วันตรวจ" — SurveyItem.FullScore เก็บได้ค่าเดียวต่อข้อ แต่งานประวัติที่
        // import จากระบบเดิม ข้อเดียวกันมีคะแนนเต็มต่างกันตามยุคที่ฟอร์มถูกปรับ (คะแนนแยกหมวดจึงผิด
        // ถ้าใช้ SurveyItem.FullScore) งานใหม่เก็บค่าจากฟอร์มตอนส่ง
        // null = คำตอบที่สร้างก่อนมีช่องนี้ → ผู้อ่านใช้ SurveyItem.FullScore แทน
        public double? MaxScore { get; set; }

        public bool IsPassed { get; set; }
        public bool IsNa { get; set; } = false; // Not Applicable (N/A) / ข้าม
        public string? CategoryName { get; set; } // Product, Process, Service, Cleanliness, Documents
        // รหัสหมวด "ณ วันตรวจ" (QLT/OPS/SVC/CLN/DOC) คู่กับ CategoryName — ระบบเดิมเคยย้ายข้อเดิมไปหมวดอื่น
        // ตามยุค SurveyItem.CategoryCode จึงถูกแค่ยุคล่าสุด null = คำตอบก่อนมีช่องนี้ → ใช้ของ SurveyItem
        public string? CategoryCode { get; set; }
        public string? AnswerValue { get; set; } // ค่าคำตอบจริง (เช่น "yes", "no", "1".."5", json ตาราง, หรือข้อความ)
        public string? Notes { get; set; } // ความคิดเห็น/บันทึกของผู้ตรวจ (แยกจากคำตอบเด็ดขาด ไม่ปนกัน)

        public List<AuditResponseImage> Images { get; set; } = new();
    }
}
