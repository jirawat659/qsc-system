using System;

namespace QSC.Api.Helpers
{
    /// <summary>
    /// ข้อยกเว้นเมื่อไฟล์รูปภาพที่ส่งมาไม่ผ่านการตรวจสอบ (เช่น ขนาดเกิน 10MB, ไม่ใช่ไฟล์รูปจริง หรือไฟล์เสียหาย)
    /// </summary>
    public class InvalidImageUploadException : Exception
    {
        public InvalidImageUploadException(string message) : base(message) { }
    }
}

