using System;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using QSC.Api.Data;
using QSC.Api.Helpers;

namespace QSC.Api.Services
{
    /// <summary>
    /// Background Service สำหรับลบไฟล์รูปภาพกำพร้าที่ตกค้างบนดิสก์
    /// ตรวจจับไฟล์ใน uploads/audit_images ที่อายุเกิน 48 ชั่วโมงและไม่มี Record ในฐานข้อมูลอ้างถึง
    /// </summary>
    public class OrphanFileCleanupService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly IWebHostEnvironment _env;
        private readonly ILogger<OrphanFileCleanupService> _logger;

        public OrphanFileCleanupService(
            IServiceProvider serviceProvider,
            IWebHostEnvironment env,
            ILogger<OrphanFileCleanupService> logger)
        {
            _serviceProvider = serviceProvider;
            _env = env;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("OrphanFileCleanupService has started.");

            // หน่วงเวลา 5 นาทีหลังเปิดระบบ ก่อนเริ่มรอบแรก เพื่อไม่ให้รบกวนช่วง Startup
            try
            {
                await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
            }
            catch (OperationCanceledException)
            {
                return;
            }

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await CleanupOrphanFilesAsync(stoppingToken);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error occurred while executing OrphanFileCleanupService.");
                }

                // วนรอบตรวจสอบวันละ 1 ครั้ง (ทุก 24 ชั่วโมง)
                try
                {
                    await Task.Delay(TimeSpan.FromHours(24), stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
            }

            _logger.LogInformation("OrphanFileCleanupService is stopping.");
        }

        private async Task CleanupOrphanFilesAsync(CancellationToken stoppingToken)
        {
            var uploadsRoot = UploadHelper.GetUploadsRootPath(_env);
            if (!Directory.Exists(uploadsRoot)) return;

            var auditImagesDir = Path.Combine(uploadsRoot, "audit_images");
            if (!Directory.Exists(auditImagesDir)) return;

            // ตรวจหาไฟล์ที่มีอายุมากกว่า 48 ชั่วโมง (ให้เวลาเพียงพอสำหรับงานตรวจที่ยังอยู่ระหว่างทำหรือดราฟต์)
            var threshold = DateTime.UtcNow.AddHours(-48);
            var files = Directory.GetFiles(auditImagesDir);
            if (files.Length == 0) return;

            var candidateFiles = files
                .Select(f => new FileInfo(f))
                .Where(fi => fi.LastWriteTimeUtc < threshold)
                .ToList();

            if (candidateFiles.Count == 0) return;

            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            // 1. รวบรวมชื่อไฟล์ที่ถูกอ้างอิงจริงใน AuditResponseImages
            var auditImageUrls = await db.AuditResponseImages
                .AsNoTracking()
                .Select(img => img.ImageUrl)
                .ToListAsync(stoppingToken);

            var referencedSet = auditImageUrls
                .Where(u => !string.IsNullOrWhiteSpace(u))
                .Select(u => Path.GetFileName(u))
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            // 2. รวบรวมชื่อไฟล์ที่อาจถูกอ้างอิงใน CapTaskImages
            var capImageUrls = await db.CapTaskImages
                .AsNoTracking()
                .Select(img => img.ImageUrl)
                .ToListAsync(stoppingToken);

            foreach (var url in capImageUrls.Where(u => !string.IsNullOrWhiteSpace(u)))
            {
                referencedSet.Add(Path.GetFileName(url));
            }

            // 3. ป้องกันรูปที่อยู่ใน AuditDrafts (DraftPayloadJson)
            var draftPayloads = await db.AuditDrafts
                .AsNoTracking()
                .Select(d => d.DraftPayloadJson)
                .ToListAsync(stoppingToken);

            int deletedCount = 0;
            foreach (var fileInfo in candidateFiles)
            {
                if (stoppingToken.IsCancellationRequested) break;

                var fileName = fileInfo.Name;

                // ถ้ามีใน DB ถาวร ข้าม
                if (referencedSet.Contains(fileName)) continue;

                // ถ้าถูกกล่าวถึงใน DraftPayloadJson ข้าม
                bool isInDraft = draftPayloads.Any(payload => !string.IsNullOrWhiteSpace(payload) && payload.Contains(fileName, StringComparison.OrdinalIgnoreCase));
                if (isInDraft) continue;

                try
                {
                    fileInfo.Delete();
                    deletedCount++;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to delete orphan file: {File}", fileInfo.FullName);
                }
            }

            if (deletedCount > 0)
            {
                _logger.LogInformation("OrphanFileCleanupService successfully cleaned up {Count} orphan files.", deletedCount);
            }
        }
    }
}

