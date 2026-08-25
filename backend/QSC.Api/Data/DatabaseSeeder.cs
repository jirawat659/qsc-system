using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Microsoft.AspNetCore.Hosting;
using QSC.Api.Models;

namespace QSC.Api.Data
{
    public static class DatabaseSeeder
    {
        public static void Initialize(AppDbContext context, IWebHostEnvironment env)
        {
            // 1. Ensure upload directories exist
            var webRoot = env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
            var uploadsDir = Path.Combine(webRoot, "uploads");
            Directory.CreateDirectory(Path.Combine(uploadsDir, "signatures"));
            Directory.CreateDirectory(Path.Combine(uploadsDir, "audit_images"));
            Directory.CreateDirectory(Path.Combine(uploadsDir, "cap_images"));

            context.Database.EnsureCreated();

            // Check if already seeded
            if (context.Roles.Any())
            {
                return;
            }

            // ==========================================
            // 1. SEED ROLES
            // ==========================================
            var adminRole = new Role { Code = "ADMIN", Name = "ผู้ดูแลระบบ (Admin)", Description = "จัดการผู้ใช้ สิทธิ์ และการตั้งค่าระบบทั้งหมด" };
            var auditorRole = new Role { Code = "AUDITOR", Name = "ผู้ตรวจประเมินหน้างาน (Auditor)", Description = "ลงพื้นที่ตรวจหน้างาน บันทึกผล และเปิดตั๋ว CAP" };
            var auditeeRole = new Role { Code = "AUDITEE", Name = "ผู้รับการตรวจ / ผู้จัดการสาขา (Auditee)", Description = "ดูผลตรวจสาขาตนเอง ชี้แจงและส่งงานแก้ไข CAP" };
            var standardRole = new Role { Code = "STANDARD", Name = "ผู้ดูแลมาตรฐาน (QA/QC)", Description = "สร้างแบบฟอร์ม วางแผนตรวจ และอนุมัติปิดงาน CAP" };
            var execRole = new Role { Code = "EXEC", Name = "ผู้บริหารระดับสูง (Executive)", Description = "ดูสรุปผลภาพรวมและวิเคราะห์สถิติระดับองค์กร" };

            context.Roles.AddRange(adminRole, auditorRole, auditeeRole, standardRole, execRole);
            context.SaveChanges();

            // ==========================================
            // 2. SEED PERMISSIONS
            // ==========================================
            var permissions = new List<Permission>
            {
                // Dashboard
                new Permission { Code = "menu.dashboard", Name = "เข้าดูหน้าแดชบอร์ดภาพรวม", Module = "Dashboard" },
                new Permission { Code = "dashboard.executive", Name = "ดูข้อมูลภาพรวมระดับผู้บริหาร", Module = "Dashboard" },
                
                // Audit
                new Permission { Code = "menu.audit", Name = "เข้าเมนูตรวจหน้างานสด", Module = "Audit" },
                new Permission { Code = "audit.start", Name = "เริ่มทำการตรวจประเมิน", Module = "Audit" },
                new Permission { Code = "audit.submit", Name = "ส่งผลการตรวจและลงนาม", Module = "Audit" },

                // Schedule
                new Permission { Code = "menu.schedules", Name = "เข้าดูตารางแผนการตรวจ", Module = "Schedule" },
                new Permission { Code = "schedules.manage", Name = "สร้างและแก้ไขนัดหมายตรวจ", Module = "Schedule" },

                // Forms
                new Permission { Code = "menu.forms", Name = "เข้าดูแม่แบบฟอร์มตรวจ", Module = "Form" },
                new Permission { Code = "forms.manage", Name = "สร้างและแก้ไขแบบฟอร์มการตรวจ", Module = "Form" },

                // CAP
                new Permission { Code = "menu.cap", Name = "เข้าดูรายการงานแก้ไข CAP", Module = "CAP" },
                new Permission { Code = "cap.resolve", Name = "ส่งหลักฐานแก้ไขข้อบกพร่อง (สาขา)", Module = "CAP" },
                new Permission { Code = "cap.approve", Name = "ตรวจสอบและอนุมัติปิดงาน CAP (QA)", Module = "CAP" },

                // Analytics
                new Permission { Code = "menu.analytics", Name = "เข้าดูรายงานและการวิเคราะห์สถิติ", Module = "Analytics" },

                // System & Admin
                new Permission { Code = "menu.admin", Name = "เข้าเมนูจัดการระบบ (Admin Panel)", Module = "System" },
                new Permission { Code = "users.manage", Name = "จัดการบัญชีผู้ใช้และรีเซ็ตรหัสผ่าน", Module = "System" },
                new Permission { Code = "roles.manage", Name = "จัดการบทบาทและสิทธิ์การใช้งาน", Module = "System" },
                new Permission { Code = "locations.manage", Name = "จัดการข้อมูลสาขาและประเภทสถานที่", Module = "System" }
            };

            context.Permissions.AddRange(permissions);
            context.SaveChanges();

            // Map Role Permissions
            var rolePerms = new List<RolePermission>();

            // Admin has all permissions
            foreach (var p in permissions)
            {
                rolePerms.Add(new RolePermission { RoleId = adminRole.Id, PermissionId = p.Id });
            }

            // Auditor permissions
            var auditorPermCodes = new[] { "menu.dashboard", "menu.audit", "audit.start", "audit.submit", "menu.schedules", "menu.cap", "cap.approve", "menu.analytics" };
            foreach (var p in permissions.Where(x => auditorPermCodes.Contains(x.Code)))
            {
                rolePerms.Add(new RolePermission { RoleId = auditorRole.Id, PermissionId = p.Id });
            }

            // Auditee (Store Manager) permissions
            var auditeePermCodes = new[] { "menu.dashboard", "menu.cap", "cap.resolve" };
            foreach (var p in permissions.Where(x => auditeePermCodes.Contains(x.Code)))
            {
                rolePerms.Add(new RolePermission { RoleId = auditeeRole.Id, PermissionId = p.Id });
            }

            // Standard (QA) permissions
            var standardPermCodes = new[] { "menu.dashboard", "menu.audit", "menu.schedules", "schedules.manage", "menu.forms", "forms.manage", "menu.cap", "cap.approve", "menu.analytics" };
            foreach (var p in permissions.Where(x => standardPermCodes.Contains(x.Code)))
            {
                rolePerms.Add(new RolePermission { RoleId = standardRole.Id, PermissionId = p.Id });
            }

            // Executive permissions
            var execPermCodes = new[] { "menu.dashboard", "dashboard.executive", "menu.schedules", "menu.forms", "menu.cap", "menu.analytics" };
            foreach (var p in permissions.Where(x => execPermCodes.Contains(x.Code)))
            {
                rolePerms.Add(new RolePermission { RoleId = execRole.Id, PermissionId = p.Id });
            }

            context.RolePermissions.AddRange(rolePerms);
            context.SaveChanges();

            // ==========================================
            // 3. SEED LOCATION TYPES
            // ==========================================
            var storeType = new LocationType { Code = "STORE", Name = "สาขาหน้าร้าน (Store / Restaurant)", Description = "ร้านอาหารและสาขาบริการลูกค้า" };
            var plantType = new LocationType { Code = "PLANT", Name = "โรงงานผลิตและคลังสินค้า (Plant & Warehouse)", Description = "ศูนย์กระจายสินค้าและไลน์แปรรูป" };
            var officeType = new LocationType { Code = "OFFICE", Name = "สำนักงานใหญ่ (Headquarters)", Description = "ฝ่ายบริหารและศูนย์สนับสนุนงาน" };
            var cloudKitchenType = new LocationType { Code = "CLOUD_KITCHEN", Name = "ครัวกลาง (Cloud Kitchen)", Description = "ครัวกลางเตรียมวัตถุดิบและเดลิเวอรี" };

            context.LocationTypes.AddRange(storeType, plantType, officeType, cloudKitchenType);
            context.SaveChanges();

            // ==========================================
            // 4. SEED USERS
            // ==========================================
            var adminUser = new User
            {
                Username = "admin",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("1234"),
                FullName = "ผู้ดูแลระบบสูงสุด (System Admin)",
                RoleId = adminRole.Id,
                BranchScope = "ALL",
                MustChangePassword = false
            };

            var auditorSomchai = new User
            {
                Username = "somchai",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("1234"),
                FullName = "นายสมชาย ใจดี (Lead Auditor)",
                RoleId = auditorRole.Id,
                BranchScope = "ALL",
                MustChangePassword = false
            };

            var auditeeSiam = new User
            {
                Username = "auditee_siam",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("1234"),
                FullName = "นายวิชาญ บริการเลิศ (ผจก. สาขาสยามพารากอน)",
                RoleId = auditeeRole.Id,
                BranchScope = "SPECIFIC",
                MustChangePassword = false
            };

            var auditeeAri = new User
            {
                Username = "auditee_ari",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("1234"),
                FullName = "น.ส.มาลี สดใส (ผจก. สาขาอารีย์)",
                RoleId = auditeeRole.Id,
                BranchScope = "SPECIFIC",
                MustChangePassword = false
            };

            var standardKanda = new User
            {
                Username = "kanda",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("1234"),
                FullName = "นางกานดา มาตรฐานดี (QA Director)",
                RoleId = standardRole.Id,
                BranchScope = "ALL",
                MustChangePassword = false
            };

            var execDavid = new User
            {
                Username = "david",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("1234"),
                FullName = "Mr. David Miller (VP Operations)",
                RoleId = execRole.Id,
                BranchScope = "ALL",
                MustChangePassword = false
            };

            context.Users.AddRange(adminUser, auditorSomchai, auditeeSiam, auditeeAri, standardKanda, execDavid);
            context.SaveChanges();

            // ==========================================
            // 5. SEED LOCATIONS
            // ==========================================
            var siamLoc = new Location
            {
                Code = "BKK-001",
                Name = "สาขาสยามพารากอน (Siam Paragon)",
                LocationTypeId = storeType.Id,
                ManagerUserId = auditeeSiam.Id,
                Latitude = 13.7466,
                Longitude = 100.5347,
                Region = "กรุงเทพฯ และปริมณฑล",
                BrandName = "QSC Grand Restaurant",
                Address = "ชั้น G สยามพารากอน ถ.พระราม 1 ปทุมวัน กรุงเทพฯ 10330",
                Phone = "02-123-4567",
                LastScore = 92.5,
                LastAuditDate = DateTime.UtcNow.AddDays(-14)
            };

            var ariLoc = new Location
            {
                Code = "BKK-002",
                Name = "สาขาอารีย์ (Ari Branch)",
                LocationTypeId = storeType.Id,
                ManagerUserId = auditeeAri.Id,
                Latitude = 13.7797,
                Longitude = 100.5447,
                Region = "กรุงเทพฯ และปริมณฑล",
                BrandName = "QSC Bistro",
                Address = "อาคาร ลาวิลล่า พหลโยธิน พญาไท กรุงเทพฯ 10400",
                Phone = "02-234-5678",
                LastScore = 86.0,
                LastAuditDate = DateTime.UtcNow.AddDays(-28)
            };

            var ctwLoc = new Location
            {
                Code = "BKK-003",
                Name = "สาขาเซ็นทรัลเวิลด์ (CentralWorld)",
                LocationTypeId = storeType.Id,
                Latitude = 13.7469,
                Longitude = 100.5398,
                Region = "กรุงเทพฯ และปริมณฑล",
                BrandName = "QSC Grand Restaurant",
                Address = "ชั้น 6 เซ็นทรัลเวิลด์ ถ.ราชดำริ ปทุมวัน กรุงเทพฯ 10330",
                Phone = "02-345-6789",
                LastScore = 78.5,
                LastAuditDate = DateTime.UtcNow.AddDays(-40)
            };

            var plantBangna = new Location
            {
                Code = "PLANT-01",
                Name = "โรงงานผลิตและศูนย์แปรรูปบางนา (Bangna Central Kitchen)",
                LocationTypeId = plantType.Id,
                Latitude = 13.6682,
                Longitude = 100.6341,
                Region = "กรุงเทพฯ และปริมณฑล",
                BrandName = "QSC Production Hub",
                Address = "ถ.บางนา-ตราด กม.18 บางพลี สมุทรปราการ 10540",
                Phone = "02-456-7890",
                LastScore = 96.0,
                LastAuditDate = DateTime.UtcNow.AddDays(-7)
            };

            var hqLoc = new Location
            {
                Code = "HQ-01",
                Name = "สำนักงานใหญ่อโศก (Asoke Headquarters)",
                LocationTypeId = officeType.Id,
                Latitude = 13.7380,
                Longitude = 100.5604,
                Region = "กรุงเทพฯ และปริมณฑล",
                BrandName = "QSC Holding",
                Address = "อาคารเอกซ์เชนจ์ ทาวเวอร์ ถ.สุขุมวิท คลองเตย กรุงเทพฯ 10110",
                Phone = "02-567-8901",
                LastScore = 98.0,
                LastAuditDate = DateTime.UtcNow.AddDays(-60)
            };

            context.Locations.AddRange(siamLoc, ariLoc, ctwLoc, plantBangna, hqLoc);
            context.SaveChanges();

            // Link User Locations for Specific Scoped Managers
            context.UserLocations.AddRange(
                new UserLocation { UserId = auditeeSiam.Id, LocationId = siamLoc.Id },
                new UserLocation { UserId = auditeeAri.Id, LocationId = ariLoc.Id }
            );
            context.SaveChanges();

            // ==========================================
            // 6. SEED SURVEY FORM (QSC Core Standard v1.0)
            // ==========================================
            var coreForm = new SurveyForm
            {
                Title = "แบบฟอร์มมาตรฐาน 5 ดาว (QSC Core Checklist)",
                LocationTypeId = storeType.Id,
                PassingScore = 85.0,
                TargetingMode = "ALL_LOCATIONS",
                Version = "v1.0",
                IsLatest = true,
                IsActive = true,
                CreatedBy = standardKanda.Id,
                CreatedAt = DateTime.UtcNow
            };

            context.SurveyForms.Add(coreForm);
            context.SaveChanges();

            // Section 1: Quality & Food Safety
            var sec1 = new SurveySection
            {
                SurveyFormId = coreForm.Id,
                Title = "1. คุณภาพและความปลอดภัยของอาหาร (Quality & Food Safety)",
                OrderIndex = 1,
                WeightPercent = 40.0,
                IsActive = true
            };

            // Section 2: Service & Operations
            var sec2 = new SurveySection
            {
                SurveyFormId = coreForm.Id,
                Title = "2. การบริการและความเร็วในการส่งมอบ (Service Excellence)",
                OrderIndex = 2,
                WeightPercent = 30.0,
                IsActive = true
            };

            // Section 3: Cleanliness & 5S
            var sec3 = new SurveySection
            {
                SurveyFormId = coreForm.Id,
                Title = "3. ความสะอาดและสุขาภิบาล 5ส (Cleanliness & 5S)",
                OrderIndex = 3,
                WeightPercent = 30.0,
                IsActive = true
            };

            context.SurveySections.AddRange(sec1, sec2, sec3);
            context.SaveChanges();

            // Items for Sec 1 (Critical Items)
            context.SurveyItems.AddRange(
                new SurveyItem { SurveySectionId = sec1.Id, QuestionText = "อุณหภูมิตู้แช่แข็งต่ำกว่า -18°C และตู้แช่เย็น 0-4°C ถูกต้องตามมาตรฐาน", QuestionType = "YESNO", FullScore = 10.0, IsCritical = true, OrderIndex = 1, IsActive = true },
                new SurveyItem { SurveySectionId = sec1.Id, QuestionText = "การติดฉลากระบุวันผลิต/วันหมดอายุ (FIFO Labeling) บนวัตถุดิบทุกชนิด", QuestionType = "YESNO", FullScore = 10.0, IsCritical = true, OrderIndex = 2, IsActive = true },
                new SurveyItem { SurveySectionId = sec1.Id, QuestionText = "การปรุงอาหารสุกด้วยอุณหภูมิใจกลางเนื้อสัตว์ตามเกณฑ์ที่กำหนด", QuestionType = "YESNO", FullScore = 10.0, IsCritical = false, OrderIndex = 3, IsActive = true },
                new SurveyItem { SurveySectionId = sec1.Id, QuestionText = "การควบคุมน้ำหนักและสัดส่วนวัตถุดิบ (Portion Control)", QuestionType = "SCALE", FullScore = 10.0, IsCritical = false, OrderIndex = 4, IsActive = true }
            );

            // Items for Sec 2
            context.SurveyItems.AddRange(
                new SurveyItem { SurveySectionId = sec2.Id, QuestionText = "พนักงานแต่งกายถูกต้อง สะอาด สวมหมวกและป้ายชื่อเรียบร้อย", QuestionType = "YESNO", FullScore = 10.0, IsCritical = false, OrderIndex = 1, IsActive = true },
                new SurveyItem { SurveySectionId = sec2.Id, QuestionText = "ความเร็วในการเสิร์ฟอาหารและเครื่องดื่มเป็นไปตาม SLA (ภายใน 10 นาที)", QuestionType = "SCALE", FullScore = 10.0, IsCritical = false, OrderIndex = 2, IsActive = true },
                new SurveyItem { SurveySectionId = sec2.Id, QuestionText = "การต้อนรับลูกค้าด้วยรอยยิ้มและการกล่าวคำทักทายมาตรฐาน", QuestionType = "SCALE", FullScore = 10.0, IsCritical = false, OrderIndex = 3, IsActive = true }
            );

            // Items for Sec 3
            context.SurveyItems.AddRange(
                new SurveyItem { SurveySectionId = sec3.Id, QuestionText = "ไม่พบร่องรอยสัตว์พาหะ แมลง หรือหนูในพื้นที่ปรุงและรับประทานอาหาร", QuestionType = "YESNO", FullScore = 10.0, IsCritical = true, OrderIndex = 1, IsActive = true },
                new SurveyItem { SurveySectionId = sec3.Id, QuestionText = "ความสะอาดของโต๊ะ เก้าอี้ พื้นทางเดิน และจุดสัมผัสร่วม", QuestionType = "YESNO", FullScore = 10.0, IsCritical = false, OrderIndex = 2, IsActive = true },
                new SurveyItem { SurveySectionId = sec3.Id, QuestionText = "ความสะอาดของห้องสุขา อ่างล้างมือ และอุปกรณ์ทำความสะอาดครบถ้วน", QuestionType = "SCALE", FullScore = 10.0, IsCritical = false, OrderIndex = 3, IsActive = true },
                new SurveyItem { SurveySectionId = sec3.Id, QuestionText = "การจัดการขยะและการแยกขยะเปียก/ขยะแห้งถูกสุขลักษณะ", QuestionType = "YESNO", FullScore = 10.0, IsCritical = false, OrderIndex = 4, IsActive = true }
            );
            context.SaveChanges();

            // ==========================================
            // 7. SEED AUDIT SCHEDULE
            // ==========================================
            var sched1 = new AuditSchedule
            {
                LocationId = siamLoc.Id,
                SurveyFormId = coreForm.Id,
                ScheduledDate = DateTime.UtcNow.AddDays(2),
                AuditType = "announced",
                Status = "pending",
                Notes = "ตรวจรอบประจำเดือนสิงหาคม เน้นย้ำระบบควบคุมความเย็นและมาตรฐานความสะอาด",
                CreatedBy = standardKanda.Id,
                CreatedAt = DateTime.UtcNow
            };

            context.AuditSchedules.Add(sched1);
            context.SaveChanges();

            context.AuditScheduleAuditors.Add(new AuditScheduleAuditor
            {
                AuditScheduleId = sched1.Id,
                AuditorId = auditorSomchai.Id,
                IsLead = true
            });
            context.SaveChanges();
        }
    }
}
