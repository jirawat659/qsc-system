using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Hosting;

namespace QSC.Api.Helpers
{
    public static class UploadHelper
    {
        public static string GetUploadsRootPath(IWebHostEnvironment env)
        {
            try
            {
                var frontendUploadsPath = Path.GetFullPath(Path.Combine(env.ContentRootPath, "..", "..", "frontend", "public", "uploads"));
                if (Directory.Exists(frontendUploadsPath) || Directory.Exists(Path.GetFullPath(Path.Combine(env.ContentRootPath, "..", "..", "frontend", "public"))))
                {
                    Directory.CreateDirectory(frontendUploadsPath);
                    return frontendUploadsPath;
                }
            }
            catch {}

            var webRoot = env.WebRootPath ?? Path.Combine(env.ContentRootPath, "wwwroot");
            var defaultUploadsPath = Path.Combine(webRoot, "uploads");
            Directory.CreateDirectory(defaultUploadsPath);
            return defaultUploadsPath;
        }

        /// <summary>
        /// ตรวจสอบ Magic Bytes ของไฟล์รูปภาพจริง (ป้องกันไฟล์ปลอมแปลงหรือเปลี่ยนนามสกุล)
        /// รองรับเฉพาะ JPEG, PNG, WebP, GIF
        /// </summary>
        public static bool IsValidImageSignature(byte[] bytes, out string extension)
        {
            extension = "webp";
            if (bytes == null || bytes.Length < 12) return false;

            // JPEG: FF D8 FF
            if (bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF)
            {
                extension = "jpg";
                return true;
            }

            // PNG: 89 50 4E 47
            if (bytes[0] == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47)
            {
                extension = "png";
                return true;
            }

            // WebP: RIFF .... WEBP
            if (bytes[0] == 0x52 && bytes[1] == 0x49 && bytes[2] == 0x46 && bytes[3] == 0x46 &&
                bytes[8] == 0x57 && bytes[9] == 0x45 && bytes[10] == 0x42 && bytes[11] == 0x50)
            {
                extension = "webp";
                return true;
            }

            // GIF: GIF8
            if (bytes[0] == 0x47 && bytes[1] == 0x49 && bytes[2] == 0x46 && bytes[3] == 0x38)
            {
                extension = "gif";
                return true;
            }

            return false;
        }

        /// <summary>
        /// ตรวจสอบและบันทึก Base64 Data URL ลง Hard Disk เซิร์ฟเวอร์ และคืนค่าเป็น Relative URL (/uploads/...)
        /// หากไม่ใช่รูปภาพ, ขนาดเกินกำหนด, หรือข้อมูลเสียหาย จะโยน InvalidImageUploadException เพื่อแจ้งเตือนทันที
        /// </summary>
        public static async Task<string> SaveBase64IfPresentAsync(
            IWebHostEnvironment env, 
            string? input, 
            string subfolder, 
            string prefix, 
            long maxSizeBytes = 10 * 1024 * 1024)
        {
            if (string.IsNullOrWhiteSpace(input)) return string.Empty;
            
            // หากเป็น URL เดิมอยู่แล้ว (เช่น /uploads/...) ให้คืนค่าเดิมกลับไป
            if (!input.StartsWith("data:image/")) return input;

            var uploadsRoot = GetUploadsRootPath(env);
            var dir = Path.Combine(uploadsRoot, subfolder);
            Directory.CreateDirectory(dir);

            var base64Clean = input;
            if (base64Clean.Contains(","))
            {
                base64Clean = base64Clean.Split(',')[1];
            }

            byte[] bytes;
            try
            {
                bytes = Convert.FromBase64String(base64Clean);
            }
            catch (FormatException)
            {
                throw new InvalidImageUploadException("ไฟล์รูปภาพเสียหายหรือไม่ถูกต้อง กรุณาถ่าย/แนบรูปใหม่อีกครั้ง");
            }

            if (bytes.Length == 0)
            {
                throw new InvalidImageUploadException("ไฟล์รูปภาพว่างเปล่า กรุณาแนบรูปใหม่อีกครั้ง");
            }

            if (bytes.Length > maxSizeBytes)
            {
                var maxMb = Math.Round((double)maxSizeBytes / (1024 * 1024), 1);
                throw new InvalidImageUploadException($"ไฟล์รูปภาพมีขนาดใหญ่เกิน {maxMb}MB กรุณาลดขนาดรูปแล้วลองใหม่อีกครั้ง");
            }

            if (!IsValidImageSignature(bytes, out var ext))
            {
                throw new InvalidImageUploadException("ไฟล์ที่แนบมาไม่ใช่ไฟล์รูปภาพที่รองรับ (รองรับ JPG, PNG, WebP เท่านั้น)");
            }

            var fileName = $"{prefix}_{DateTime.UtcNow:yyyyMMdd_HHmmss}_{Guid.NewGuid().ToString().Substring(0, 8)}.{ext}";
            var filePath = Path.Combine(dir, fileName);
            await File.WriteAllBytesAsync(filePath, bytes);

            return $"/uploads/{subfolder}/{fileName}";
        }
    }
}
