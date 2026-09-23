using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;

namespace QSC.Api.Helpers
{
    public static class UploadHelper
    {
        /// <summary>
        /// ดึง Path หลักของโฟลเดอร์ uploads (Root Path)
        /// โดยอ่านจาก appsettings.json ในหมวด "Storage:UploadPath" เป็นลำดับแรก
        /// หากไม่ได้ตั้งค่าไว้ จะเลือกโฟลเดอร์ frontend/public/uploads หรือ wwwroot/uploads ตามลำดับ
        /// </summary>
        public static string GetUploadsRootPath(IWebHostEnvironment env, IConfiguration? config = null)
        {
            if (config != null)
            {
                var configuredPath = config["Storage:UploadPath"];
                if (!string.IsNullOrWhiteSpace(configuredPath))
                {
                    try
                    {
                        var resolvedPath = Path.IsPathRooted(configuredPath)
                            ? configuredPath
                            : Path.GetFullPath(Path.Combine(env.ContentRootPath, configuredPath));
                        
                        if (!Directory.Exists(resolvedPath))
                        {
                            Directory.CreateDirectory(resolvedPath);
                        }
                        return resolvedPath;
                    }
                    catch { }
                }
            }

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

        public static string SanitizeFolderName(string? name)
        {
            if (string.IsNullOrWhiteSpace(name)) return "unknown";
            var invalidChars = Path.GetInvalidFileNameChars();
            var cleaned = new string(name.Where(ch => !invalidChars.Contains(ch) && ch != ' ' && ch != '/' && ch != '\\').ToArray());
            return string.IsNullOrWhiteSpace(cleaned) ? "unknown" : cleaned.Trim();
        }

        /// <summary>
        /// ตรวจสอบ Magic Bytes ของไฟล์รูปภาพจริง (ป้องกันไฟล์ปลอมแปลงหรือเปลี่ยนนามสกุล)
        /// รองรับเฉพาะ WebP, JPEG, PNG, GIF
        /// </summary>
        public static bool IsValidImageSignature(byte[] bytes, out string extension)
        {
            extension = "webp";
            if (bytes == null || bytes.Length < 12) return false;

            // WebP: RIFF .... WEBP
            if (bytes[0] == 0x52 && bytes[1] == 0x49 && bytes[2] == 0x46 && bytes[3] == 0x46 &&
                bytes[8] == 0x57 && bytes[9] == 0x45 && bytes[10] == 0x42 && bytes[11] == 0x50)
            {
                extension = "webp";
                return true;
            }

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

            // GIF: GIF8
            if (bytes[0] == 0x47 && bytes[1] == 0x49 && bytes[2] == 0x46 && bytes[3] == 0x38)
            {
                extension = "gif";
                return true;
            }

            return false;
        }

        /// <summary>
        /// บันทึกรูปภาพ Base64 ลงในโครงสร้างโฟลเดอร์ที่กำหนด
        /// </summary>
        public static async Task<string> SaveBase64FileAsync(
            IWebHostEnvironment env,
            IConfiguration? config,
            string? input,
            string relativeDirectory,
            string fileNameWithoutExt,
            long maxSizeBytes = 10 * 1024 * 1024)
        {
            if (string.IsNullOrWhiteSpace(input)) return string.Empty;
            if (!input.StartsWith("data:image/")) return input; // If already a saved URL, return as-is

            var uploadsRoot = GetUploadsRootPath(env, config);
            var normalizedRelDir = relativeDirectory.Replace('\\', '/').Trim('/');
            var targetDir = Path.Combine(uploadsRoot, normalizedRelDir);
            if (!Directory.Exists(targetDir))
            {
                Directory.CreateDirectory(targetDir);
            }

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
                throw new InvalidImageUploadException("ไฟล์ที่แนบมาไม่ใช่ไฟล์รูปภาพที่รองรับ (รองรับ WebP, JPG, PNG เท่านั้น)");
            }

            var finalFileName = $"{fileNameWithoutExt}.{ext}";
            var filePath = Path.Combine(targetDir, finalFileName);

            // ป้องกันชื่อไฟล์ซ้ำในโฟลเดอร์เดียวกัน
            if (File.Exists(filePath))
            {
                finalFileName = $"{fileNameWithoutExt}_{Random.Shared.Next(10, 99)}.{ext}";
                filePath = Path.Combine(targetDir, finalFileName);
            }

            await File.WriteAllBytesAsync(filePath, bytes);
            return $"/uploads/{normalizedRelDir}/{finalFileName}";
        }

        /// <summary>
        /// 📸 บันทึกรูปข้อตรวจ: uploads/{YYYY-MM-DD}/audit_{job}/audits/item_{itemId}_{random4}.webp
        /// </summary>
        public static async Task<string> SaveAuditItemPhotoAsync(
            IWebHostEnvironment env,
            IConfiguration? config,
            string? input,
            int? scheduleId,
            string? locationCode,
            int? surveyItemId,
            long maxSizeBytes = 10 * 1024 * 1024)
        {
            if (string.IsNullOrWhiteSpace(input)) return string.Empty;
            if (!input.StartsWith("data:image/")) return input;

            var dateFolder = DateTime.UtcNow.ToString("yyyy-MM-dd");
            var locCode = SanitizeFolderName(locationCode);
            var jobFolder = (scheduleId.HasValue && scheduleId.Value > 0)
                ? $"audit_s{scheduleId.Value}_{locCode}"
                : $"audit_{locCode}";

            var relativeDir = $"{dateFolder}/{jobFolder}/audits";
            var itemNum = surveyItemId.HasValue && surveyItemId.Value > 0 ? surveyItemId.Value.ToString() : "0";
            var random4 = Random.Shared.Next(1000, 9999);
            var fileNameWithoutExt = $"item_{itemNum}_{random4}";

            return await SaveBase64FileAsync(env, config, input, relativeDir, fileNameWithoutExt, maxSizeBytes);
        }

        /// <summary>
        /// ✍️ บันทึกรูปลายเซ็น: uploads/{YYYY-MM-DD}/audit_{job}/signatures/sig_{type}_{yyyyMMdd}.webp
        /// </summary>
        public static async Task<string> SaveSignaturePhotoAsync(
            IWebHostEnvironment env,
            IConfiguration? config,
            string? input,
            int? scheduleId,
            string? locationCode,
            string signatoryType,
            long maxSizeBytes = 2 * 1024 * 1024)
        {
            if (string.IsNullOrWhiteSpace(input)) return string.Empty;
            if (!input.StartsWith("data:image/")) return input;

            var dateFolder = DateTime.UtcNow.ToString("yyyy-MM-dd");
            var locCode = SanitizeFolderName(locationCode);
            var jobFolder = (scheduleId.HasValue && scheduleId.Value > 0)
                ? $"audit_s{scheduleId.Value}_{locCode}"
                : $"audit_{locCode}";

            var relativeDir = $"{dateFolder}/{jobFolder}/signatures";
            var sigType = (signatoryType ?? "auditor").ToLowerInvariant().Contains("auditee") ? "auditee" : "auditor";
            var ymd = DateTime.UtcNow.ToString("yyyyMMdd");
            var fileNameWithoutExt = $"sig_{sigType}_{ymd}";

            return await SaveBase64FileAsync(env, config, input, relativeDir, fileNameWithoutExt, maxSizeBytes);
        }

        /// <summary>
        /// 🔧 บันทึกรูปงาน CAP: uploads/{YYYY-MM-DD}/cap_{capId}/{prefix}_{random4}.webp
        /// prefix รองรับ: defect, fix (หรือ fig), chat
        /// </summary>
        public static async Task<string> SaveCapPhotoAsync(
            IWebHostEnvironment env,
            IConfiguration? config,
            string? input,
            int? capTaskId,
            string prefix = "fix",
            long maxSizeBytes = 10 * 1024 * 1024)
        {
            if (string.IsNullOrWhiteSpace(input)) return string.Empty;
            if (!input.StartsWith("data:image/")) return input;

            var dateFolder = DateTime.UtcNow.ToString("yyyy-MM-dd");
            var capFolder = (capTaskId.HasValue && capTaskId.Value > 0) ? $"cap_{capTaskId.Value}" : "cap";
            var relativeDir = $"{dateFolder}/{capFolder}";

            var cleanPrefix = prefix?.ToLowerInvariant() switch
            {
                "fix" => "fix",
                "fig" => "fix",
                "defect" => "defect",
                "chat" => "chat",
                _ => "fix"
            };

            var random4 = Random.Shared.Next(1000, 9999);
            var fileNameWithoutExt = $"{cleanPrefix}_{random4}";

            return await SaveBase64FileAsync(env, config, input, relativeDir, fileNameWithoutExt, maxSizeBytes);
        }

        /// <summary>
        /// Fallback สำหรับการบันทึกแบบเดิม (Backward Compatibility)
        /// </summary>
        public static async Task<string> SaveBase64IfPresentAsync(
            IWebHostEnvironment env, 
            string? input, 
            string subfolder, 
            string prefix, 
            long maxSizeBytes = 10 * 1024 * 1024)
        {
            if (string.IsNullOrWhiteSpace(input)) return string.Empty;
            if (!input.StartsWith("data:image/")) return input;

            var dateFolder = DateTime.UtcNow.ToString("yyyy-MM-dd");
            var relativeDir = $"{dateFolder}/{subfolder}";
            var random4 = Random.Shared.Next(1000, 9999);
            var fileNameWithoutExt = $"{prefix}_{random4}";

            return await SaveBase64FileAsync(env, null, input, relativeDir, fileNameWithoutExt, maxSizeBytes);
        }
    }
}
