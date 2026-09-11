using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using QSC.Api.Helpers;
using QSC.Api.Models;

namespace QSC.Api.Data
{
    public static class DatabaseSeeder
    {
        public static void Initialize(AppDbContext context, IWebHostEnvironment env, bool forceRecreate = false)
        {
            // 1. Ensure upload directories exist
            var uploadsDir = UploadHelper.GetUploadsRootPath(env);
            Directory.CreateDirectory(Path.Combine(uploadsDir, "signatures"));
            Directory.CreateDirectory(Path.Combine(uploadsDir, "audit_images"));
            Directory.CreateDirectory(Path.Combine(uploadsDir, "cap_images"));
            EnsureSampleImages(uploadsDir);

            if (context.Database.IsRelational())
            {
                try
                {
                    context.Database.Migrate();
                }
                catch
                {
                    context.Database.EnsureCreated();
                }
            }
            else
            {
                context.Database.EnsureCreated();
            }

            // Ensure schema updates exist for SQLite
            try
            {
                var conn = context.Database.GetDbConnection();
                if (conn.State != System.Data.ConnectionState.Open) conn.Open();

                // 1. AuditSchedules.Time
                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = "PRAGMA table_info(AuditSchedules);";
                    using var reader = cmd.ExecuteReader();
                    bool hasTime = false;
                    while (reader.Read())
                    {
                        if (string.Equals(reader["name"]?.ToString(), "Time", StringComparison.OrdinalIgnoreCase))
                        {
                            hasTime = true;
                            break;
                        }
                    }
                    reader.Close();
                    if (!hasTime)
                    {
                        using var alterCmd = conn.CreateCommand();
                        alterCmd.CommandText = "ALTER TABLE AuditSchedules ADD COLUMN Time TEXT;";
                        alterCmd.ExecuteNonQuery();
                    }
                }

                // 2. Roles.NavConfigJson
                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = "PRAGMA table_info(Roles);";
                    using var reader = cmd.ExecuteReader();
                    bool hasNavConfig = false;
                    while (reader.Read())
                    {
                        if (string.Equals(reader["name"]?.ToString(), "NavConfigJson", StringComparison.OrdinalIgnoreCase))
                        {
                            hasNavConfig = true;
                            break;
                        }
                    }
                    reader.Close();
                    if (!hasNavConfig)
                    {
                        using var alterCmd = conn.CreateCommand();
                        alterCmd.CommandText = "ALTER TABLE Roles ADD COLUMN NavConfigJson TEXT;";
                        alterCmd.ExecuteNonQuery();
                    }
                }

                // 3. CapTaskComments.ImageUrl
                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = "PRAGMA table_info(CapTaskComments);";
                    using var reader = cmd.ExecuteReader();
                    bool hasImageUrl = false;
                    while (reader.Read())
                    {
                        if (string.Equals(reader["name"]?.ToString(), "ImageUrl", StringComparison.OrdinalIgnoreCase))
                        {
                            hasImageUrl = true;
                            break;
                        }
                    }
                    reader.Close();
                    if (!hasImageUrl)
                    {
                        using var alterCmd = conn.CreateCommand();
                        alterCmd.CommandText = "ALTER TABLE CapTaskComments ADD COLUMN ImageUrl TEXT;";
                        alterCmd.ExecuteNonQuery();
                    }
                }

                // 4. SurveyItems.CategoryCode & CategoryName
                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = "PRAGMA table_info(SurveyItems);";
                    using var reader = cmd.ExecuteReader();
                    bool hasCatCode = false, hasCatName = false;
                    while (reader.Read())
                    {
                        var colName = reader["name"]?.ToString();
                        if (string.Equals(colName, "CategoryCode", StringComparison.OrdinalIgnoreCase)) hasCatCode = true;
                        if (string.Equals(colName, "CategoryName", StringComparison.OrdinalIgnoreCase)) hasCatName = true;
                    }
                    reader.Close();
                    if (!hasCatCode)
                    {
                        using var alterCmd = conn.CreateCommand();
                        alterCmd.CommandText = "ALTER TABLE SurveyItems ADD COLUMN CategoryCode TEXT;";
                        alterCmd.ExecuteNonQuery();
                    }
                    if (!hasCatName)
                    {
                        using var alterCmd = conn.CreateCommand();
                        alterCmd.CommandText = "ALTER TABLE SurveyItems ADD COLUMN CategoryName TEXT;";
                        alterCmd.ExecuteNonQuery();
                    }
                }

                // 5. SurveyForms.BrandId
                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = "PRAGMA table_info(SurveyForms);";
                    using var reader = cmd.ExecuteReader();
                    bool hasBrandId = false;
                    while (reader.Read())
                    {
                        if (string.Equals(reader["name"]?.ToString(), "BrandId", StringComparison.OrdinalIgnoreCase))
                        {
                            hasBrandId = true;
                            break;
                        }
                    }
                    reader.Close();
                    if (!hasBrandId)
                    {
                        using var alterCmd = conn.CreateCommand();
                        alterCmd.CommandText = "ALTER TABLE SurveyForms ADD COLUMN BrandId INTEGER NULL;";
                        alterCmd.ExecuteNonQuery();
                    }
                }

                // 6. Locations.LocationTypeId
                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = "PRAGMA table_info(Locations);";
                    using var reader = cmd.ExecuteReader();
                    bool hasLocationTypeId = false;
                    while (reader.Read())
                    {
                        if (string.Equals(reader["name"]?.ToString(), "LocationTypeId", StringComparison.OrdinalIgnoreCase))
                        {
                            hasLocationTypeId = true;
                            break;
                        }
                    }
                    reader.Close();
                    if (!hasLocationTypeId)
                    {
                        using var alterCmd = conn.CreateCommand();
                        alterCmd.CommandText = "ALTER TABLE Locations ADD COLUMN LocationTypeId INTEGER NULL;";
                        alterCmd.ExecuteNonQuery();
                    }
                }

                // 5. AuditResponses.CategoryName
                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = "PRAGMA table_info(AuditResponses);";
                    using var reader = cmd.ExecuteReader();
                    bool hasCatName = false;
                    while (reader.Read())
                    {
                        if (string.Equals(reader["name"]?.ToString(), "CategoryName", StringComparison.OrdinalIgnoreCase))
                        {
                            hasCatName = true;
                            break;
                        }
                    }
                    reader.Close();
                    if (!hasCatName)
                    {
                        using var alterCmd = conn.CreateCommand();
                        alterCmd.CommandText = "ALTER TABLE AuditResponses ADD COLUMN CategoryName TEXT;";
                        alterCmd.ExecuteNonQuery();
                    }
                }

                // 6. AuditRecords.MetadataValuesJson
                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = "PRAGMA table_info(AuditRecords);";
                    using var reader = cmd.ExecuteReader();
                    bool hasCol = false;
                    while (reader.Read())
                    {
                        if (string.Equals(reader["name"]?.ToString(), "MetadataValuesJson", StringComparison.OrdinalIgnoreCase))
                        {
                            hasCol = true;
                            break;
                        }
                    }
                    reader.Close();
                    if (!hasCol)
                    {
                        using var alterCmd = conn.CreateCommand();
                        alterCmd.CommandText = "ALTER TABLE AuditRecords ADD COLUMN MetadataValuesJson TEXT;";
                        alterCmd.ExecuteNonQuery();
                    }
                }

                // 7. SurveyForms.MetadataConfigJson
                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = "PRAGMA table_info(SurveyForms);";
                    using var reader = cmd.ExecuteReader();
                    bool hasCol = false;
                    while (reader.Read())
                    {
                        if (string.Equals(reader["name"]?.ToString(), "MetadataConfigJson", StringComparison.OrdinalIgnoreCase))
                        {
                            hasCol = true;
                            break;
                        }
                    }
                    reader.Close();
                    if (!hasCol)
                    {
                        using var alterCmd = conn.CreateCommand();
                        alterCmd.CommandText = "ALTER TABLE SurveyForms ADD COLUMN MetadataConfigJson TEXT;";
                        alterCmd.ExecuteNonQuery();
                    }
                }

                // 8. AuditRecords.IsBackdated
                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = "PRAGMA table_info(AuditRecords);";
                    using var reader = cmd.ExecuteReader();
                    bool hasCol = false;
                    while (reader.Read())
                    {
                        if (string.Equals(reader["name"]?.ToString(), "IsBackdated", StringComparison.OrdinalIgnoreCase))
                        {
                            hasCol = true;
                            break;
                        }
                    }
                    reader.Close();
                    if (!hasCol)
                    {
                        using var alterCmd = conn.CreateCommand();
                        alterCmd.CommandText = "ALTER TABLE AuditRecords ADD COLUMN IsBackdated INTEGER NOT NULL DEFAULT 0;";
                        alterCmd.ExecuteNonQuery();
                    }
                }

                // 8.1 AuditDrafts.AuditScheduleId
                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = "PRAGMA table_info(AuditDrafts);";
                    using var reader = cmd.ExecuteReader();
                    bool hasSchedCol = false;
                    while (reader.Read())
                    {
                        if (string.Equals(reader["name"]?.ToString(), "AuditScheduleId", StringComparison.OrdinalIgnoreCase))
                        {
                            hasSchedCol = true;
                            break;
                        }
                    }
                    reader.Close();
                    if (!hasSchedCol)
                    {
                        using var alterCmd = conn.CreateCommand();
                        alterCmd.CommandText = "ALTER TABLE AuditDrafts ADD COLUMN AuditScheduleId INTEGER NULL;";
                        alterCmd.ExecuteNonQuery();
                    }
                }

                // 8.2 CapTasks.NextAuditNote, FollowUpStatus, FollowUpScheduleId
                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = "PRAGMA table_info(CapTasks);";
                    using var reader = cmd.ExecuteReader();
                    bool hasNoteCol = false, hasStatusCol = false, hasSchedCol = false;
                    while (reader.Read())
                    {
                        var cName = reader["name"]?.ToString();
                        if (string.Equals(cName, "NextAuditNote", StringComparison.OrdinalIgnoreCase)) hasNoteCol = true;
                        if (string.Equals(cName, "FollowUpStatus", StringComparison.OrdinalIgnoreCase)) hasStatusCol = true;
                        if (string.Equals(cName, "FollowUpScheduleId", StringComparison.OrdinalIgnoreCase)) hasSchedCol = true;
                    }
                    reader.Close();
                    if (!hasNoteCol)
                    {
                        using var alterCmd = conn.CreateCommand();
                        alterCmd.CommandText = "ALTER TABLE CapTasks ADD COLUMN NextAuditNote TEXT;";
                        alterCmd.ExecuteNonQuery();
                    }
                    if (!hasStatusCol)
                    {
                        using var alterCmd = conn.CreateCommand();
                        alterCmd.CommandText = "ALTER TABLE CapTasks ADD COLUMN FollowUpStatus TEXT DEFAULT 'NONE';";
                        alterCmd.ExecuteNonQuery();
                    }
                    if (!hasSchedCol)
                    {
                        using var alterCmd = conn.CreateCommand();
                        alterCmd.CommandText = "ALTER TABLE CapTasks ADD COLUMN FollowUpScheduleId INTEGER NULL;";
                        alterCmd.ExecuteNonQuery();
                    }
                }

                // 9. Ensure SurveyFormBrands table exists
                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = @"
                        CREATE TABLE IF NOT EXISTS SurveyFormBrands (
                            Id INTEGER PRIMARY KEY AUTOINCREMENT,
                            SurveyFormId INTEGER NOT NULL,
                            BrandId INTEGER NOT NULL,
                            FOREIGN KEY (SurveyFormId) REFERENCES SurveyForms (Id) ON DELETE CASCADE,
                            FOREIGN KEY (BrandId) REFERENCES Brands (Id) ON DELETE CASCADE
                        );
                        CREATE INDEX IF NOT EXISTS IX_SurveyFormBrands_SurveyFormId ON SurveyFormBrands (SurveyFormId);
                        CREATE INDEX IF NOT EXISTS IX_SurveyFormBrands_BrandId ON SurveyFormBrands (BrandId);
                    ";
                    cmd.ExecuteNonQuery();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[DatabaseSeeder] Migration warning: {ex.Message}");
            }

            // Backfill existing roles if NavConfigJson is NULL or empty
            try
            {
                var existingRoles = context.Roles.ToList();
                bool roleUpdated = false;
                foreach (var role in existingRoles)
                {
                    if (string.IsNullOrWhiteSpace(role.NavConfigJson))
                    {
                        role.NavConfigJson = RoleNavHelper.GetDefaultNavConfigJson(role.Code);
                        roleUpdated = true;
                    }
                }
                if (roleUpdated)
                {
                    context.SaveChanges();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[DatabaseSeeder] Role NavConfig backfill warning: {ex.Message}");
            }

            // Check if already seeded (never wipe existing data if database is already initialized)
            if (!forceRecreate && context.Roles.Any())
            {
                EnsureBrandAndUserBrandData(context);
                EnsurePermissionsAndRoles(context);

                Console.WriteLine("[DatabaseSeeder] Database already initialized. Skipping seed to protect production data.");
                return;
            }

            // Only wipe if forceRecreate was explicitly requested
            if (forceRecreate && context.Roles.Any())
            {
                context.CapTaskComments.RemoveRange(context.CapTaskComments);
                context.CapTaskImages.RemoveRange(context.CapTaskImages);
                context.CapTasks.RemoveRange(context.CapTasks);
                context.AuditResponseImages.RemoveRange(context.AuditResponseImages);
                context.AuditResponses.RemoveRange(context.AuditResponses);
                context.AuditRecords.RemoveRange(context.AuditRecords);
                context.AuditDrafts.RemoveRange(context.AuditDrafts);
                context.AuditScheduleAuditors.RemoveRange(context.AuditScheduleAuditors);
                context.AuditSchedules.RemoveRange(context.AuditSchedules);
                context.SurveyItems.RemoveRange(context.SurveyItems);
                context.SurveySections.RemoveRange(context.SurveySections);
                context.SurveyFormTargetLocations.RemoveRange(context.SurveyFormTargetLocations);
                context.SurveyForms.RemoveRange(context.SurveyForms);
                // ล้างตาราง join ก่อนลบ entity หลักเพื่อรองรับทั้ง SQLite และฐานข้อมูลที่ใช้ FK จริง
                context.UserBrands.RemoveRange(context.UserBrands);
                context.LocationBrands.RemoveRange(context.LocationBrands);
                context.UserLocations.RemoveRange(context.UserLocations);
                context.Locations.RemoveRange(context.Locations);
                context.Brands.RemoveRange(context.Brands);
                context.LocationTypes.RemoveRange(context.LocationTypes);
                context.RolePermissions.RemoveRange(context.RolePermissions);
                context.Permissions.RemoveRange(context.Permissions);
                context.Users.RemoveRange(context.Users);
                context.Roles.RemoveRange(context.Roles);
                context.SaveChanges();
            }

            // ==========================================
            // 1. SEED ROLES
            // ==========================================
            var adminRole = new Role { Code = "ADMIN", Name = "ผู้ดูแลระบบ (Admin)", Description = "จัดการผู้ใช้ สิทธิ์ และการตั้งค่าระบบทั้งหมด", NavConfigJson = RoleNavHelper.GetDefaultNavConfigJson("ADMIN") };
            var auditorRole = new Role { Code = "AUDITOR", Name = "ผู้ตรวจประเมิน (QA Auditor)", Description = "ลงพื้นที่ตรวจหน้างาน บันทึกผล และเปิดตั๋ว CAP", NavConfigJson = RoleNavHelper.GetDefaultNavConfigJson("AUDITOR") };
            var auditeeRole = new Role { Code = "AUDITEE", Name = "ผู้จัดการสาขา (Store Manager)", Description = "ดูผลตรวจสาขาตนเอง ชี้แจงและส่งงานแก้ไข CAP", NavConfigJson = RoleNavHelper.GetDefaultNavConfigJson("AUDITEE") };
            var standardRole = new Role { Code = "STANDARD", Name = "ผู้ดูแลมาตรฐาน (QA Director)", Description = "สร้างแบบฟอร์ม วางแผนตรวจ และอนุมัติปิดงาน CAP", NavConfigJson = RoleNavHelper.GetDefaultNavConfigJson("STANDARD") };
            var execRole = new Role { Code = "EXEC", Name = "ผู้บริหารระดับสูง (Executive / COO)", Description = "ดูสรุปผลภาพรวมและวิเคราะห์สถิติระดับองค์กร", NavConfigJson = RoleNavHelper.GetDefaultNavConfigJson("EXEC") };

            context.Roles.AddRange(adminRole, auditorRole, auditeeRole, standardRole, execRole);
            context.SaveChanges();

            // ==========================================
            // 2. SEED PERMISSIONS
            // ==========================================
            var permissions = new List<Permission>
            {
                new Permission { Code = "audit.edit", Name = "แก้ไขการตรวจบันทึกที่ส่งแล้ว พร้อมระบุเหตุผล", Module = "Audit" },
                new Permission { Code = "audit.start", Name = "เริ่มทำการตรวจประเมิน", Module = "Audit" },
                new Permission { Code = "audit.submit", Name = "ส่งผลการตรวจและลงนาม", Module = "Audit" },
                new Permission { Code = "cap.approve", Name = "ตรวจสอบและอนุมัติปิดงาน CAP (QA)", Module = "CAP" },
                new Permission { Code = "cap.resolve", Name = "ส่งหลักฐานแก้ไขข้อบกพร่อง (สาขา)", Module = "CAP" },
                new Permission { Code = "dashboard.executive", Name = "ดูข้อมูลภาพรวมระดับผู้บริหาร", Module = "Dashboard" },
                new Permission { Code = "forms.manage", Name = "สร้างและแก้ไขแบบฟอร์มการตรวจ", Module = "Form" },
                new Permission { Code = "locations.manage", Name = "จัดการข้อมูลสาขาและประเภทสถานที่", Module = "System" },
                new Permission { Code = "menu.admin", Name = "เข้าเมนูจัดการระบบ (Admin Panel)", Module = "System" },
                new Permission { Code = "menu.analytics", Name = "เข้าดูรายงานและการวิเคราะห์สถิติ", Module = "Analytics" },
                new Permission { Code = "menu.audit", Name = "เข้าเมนูตรวจหน้างานสด", Module = "Audit" },
                new Permission { Code = "menu.cap", Name = "เข้าดูรายการงานแก้ไข CAP", Module = "CAP" },
                new Permission { Code = "menu.dashboard", Name = "เข้าดูหน้าแดชบอร์ดภาพรวม", Module = "Dashboard" },
                new Permission { Code = "menu.forms", Name = "เข้าดูแม่แบบฟอร์มตรวจ", Module = "Form" },
                new Permission { Code = "menu.schedules", Name = "เข้าดูตารางแผนการตรวจ", Module = "Schedule" },
                new Permission { Code = "roles.manage", Name = "จัดการบทบาทและสิทธิ์การใช้งาน", Module = "System" },
                new Permission { Code = "schedules.manage", Name = "สร้างและแก้ไขนัดหมายตรวจ", Module = "Schedule" },
                new Permission { Code = "users.manage", Name = "จัดการบัญชีผู้ใช้และรีเซ็ตรหัสผ่าน", Module = "System" }
            };

            context.Permissions.AddRange(permissions);
            context.SaveChanges();

            // Map Role Permissions
            var rolePerms = new List<RolePermission>();
            foreach (var p in permissions)
            {
                rolePerms.Add(new RolePermission { RoleId = adminRole.Id, PermissionId = p.Id });
            }

            var auditorPermCodes = new[] { "menu.dashboard", "menu.audit", "audit.start", "audit.submit", "menu.schedules", "menu.cap", "cap.approve", "menu.analytics" };
            foreach (var p in permissions.Where(x => auditorPermCodes.Contains(x.Code)))
            {
                rolePerms.Add(new RolePermission { RoleId = auditorRole.Id, PermissionId = p.Id });
            }

            var auditeePermCodes = new[] { "menu.dashboard", "menu.cap", "cap.resolve" };
            foreach (var p in permissions.Where(x => auditeePermCodes.Contains(x.Code)))
            {
                rolePerms.Add(new RolePermission { RoleId = auditeeRole.Id, PermissionId = p.Id });
            }

            var standardPermCodes = new[] { "menu.dashboard", "menu.audit", "menu.schedules", "schedules.manage", "menu.forms", "forms.manage", "menu.cap", "cap.approve", "menu.analytics" };
            foreach (var p in permissions.Where(x => standardPermCodes.Contains(x.Code)))
            {
                rolePerms.Add(new RolePermission { RoleId = standardRole.Id, PermissionId = p.Id });
            }

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
            var defaultPasswordHash = BCrypt.Net.BCrypt.HashPassword("1234");

            var adminUser = new User { Username = "admin", PasswordHash = defaultPasswordHash, FullName = "ผู้ดูแลระบบสูงสุด (System Admin - ทุกแบรนด์)", RoleId = adminRole.Id, BranchScope = "ALL", BrandScope = "ALL", MustChangePassword = false };
            var auditorSomchai = new User { Username = "somchai", PasswordHash = defaultPasswordHash, FullName = "คุณสมชาย ใจดี (Lead QA - Urban Burger)", RoleId = auditorRole.Id, BranchScope = "ALL", BrandScope = "SPECIFIC", MustChangePassword = false };
            var auditorSarah = new User { Username = "sarah", PasswordHash = defaultPasswordHash, FullName = "Sarah Wong (Lead QA - Cafe Luna)", RoleId = auditorRole.Id, BranchScope = "ALL", BrandScope = "SPECIFIC", MustChangePassword = false };
            var auditorJohn = new User { Username = "john", PasswordHash = defaultPasswordHash, FullName = "John Doe (Senior QA - Artisan Bakery)", RoleId = auditorRole.Id, BranchScope = "ALL", BrandScope = "SPECIFIC", MustChangePassword = false };
            var auditorKrit = new User { Username = "krit", PasswordHash = defaultPasswordHash, FullName = "นายกฤษณ์ พร้อมใจ (Regional QA - ทุกแบรนด์)", RoleId = auditorRole.Id, BranchScope = "ALL", BrandScope = "ALL", MustChangePassword = false };
            var auditorMike = new User { Username = "miketan", PasswordHash = defaultPasswordHash, FullName = "Mike Tan (Field QA - Urban Burger)", RoleId = auditorRole.Id, BranchScope = "ALL", BrandScope = "SPECIFIC", MustChangePassword = false };
            var auditorAnan = new User { Username = "anan", PasswordHash = defaultPasswordHash, FullName = "นายอนันต์ รักษ์ดี (Southern QA - Urban Burger)", RoleId = auditorRole.Id, BranchScope = "ALL", BrandScope = "SPECIFIC", MustChangePassword = false };
            var auditorSomchaiK = new User { Username = "somchaik", PasswordHash = defaultPasswordHash, FullName = "นายสมชาย ขจรเกียรติ (Eastern QA - Artisan Bakery)", RoleId = auditorRole.Id, BranchScope = "ALL", BrandScope = "SPECIFIC", MustChangePassword = false };
            
            var standardKanda = new User { Username = "kanda", PasswordHash = defaultPasswordHash, FullName = "นางกานดา มาตรฐานดี (QA Director - ทุกแบรนด์)", RoleId = standardRole.Id, BranchScope = "ALL", BrandScope = "ALL", MustChangePassword = false };
            var execDavid = new User { Username = "david", PasswordHash = defaultPasswordHash, FullName = "Mr. David Chen (Chief Operating Officer - ทุกแบรนด์)", RoleId = execRole.Id, BranchScope = "ALL", BrandScope = "ALL", MustChangePassword = false };

            // Store Managers
            var auditeeSiam = new User { Username = "auditee_siam", PasswordHash = defaultPasswordHash, FullName = "นายสมชาย ธนากร (ผจก. Urban Burger - สยามพารากอน)", RoleId = auditeeRole.Id, BranchScope = "SPECIFIC", BrandScope = "SPECIFIC", MustChangePassword = false };
            var auditeeAri = new User { Username = "auditee_ari", PasswordHash = defaultPasswordHash, FullName = "นายเคน วรพจน์ (ผจก. Cafe Luna - อารีย์)", RoleId = auditeeRole.Id, BranchScope = "SPECIFIC", BrandScope = "SPECIFIC", MustChangePassword = false };
            var auditeeSukhumvit = new User { Username = "auditee_sukhumvit", PasswordHash = defaultPasswordHash, FullName = "นายวิชัย รัตนะ (ผจก. Urban Burger - สุขุมวิท 24)", RoleId = auditeeRole.Id, BranchScope = "SPECIFIC", BrandScope = "SPECIFIC", MustChangePassword = false };
            var auditeeBangna = new User { Username = "auditee_bangna", PasswordHash = defaultPasswordHash, FullName = "น.ส.ณัฐพร สุขเกษม (ผจก. Urban Burger - เมกาบางนา)", RoleId = auditeeRole.Id, BranchScope = "SPECIFIC", BrandScope = "SPECIFIC", MustChangePassword = false };
            var auditeeLadprao = new User { Username = "auditee_ladprao", PasswordHash = defaultPasswordHash, FullName = "น.ส.นิภา เกษมสุข (ผจก. Urban Burger - เซ็นทรัลลาดพร้าว)", RoleId = auditeeRole.Id, BranchScope = "SPECIFIC", BrandScope = "SPECIFIC", MustChangePassword = false };
            var auditeeChiangmai = new User { Username = "auditee_chiangmai", PasswordHash = defaultPasswordHash, FullName = "นายพงษ์พันธ์ จันทร์ดี (ผจก. Urban Burger - เซ็นทรัลเชียงใหม่)", RoleId = auditeeRole.Id, BranchScope = "SPECIFIC", BrandScope = "SPECIFIC", MustChangePassword = false };
            var auditeePhuket = new User { Username = "auditee_phuket", PasswordHash = defaultPasswordHash, FullName = "นายชูศักดิ์ บุญเรือง (ผจก. Urban Burger - เซ็นทรัลภูเก็ต)", RoleId = auditeeRole.Id, BranchScope = "SPECIFIC", BrandScope = "SPECIFIC", MustChangePassword = false };
            var auditeePattaya = new User { Username = "auditee_pattaya", PasswordHash = defaultPasswordHash, FullName = "นางสายใจ บุญช่วย (ผจก. Artisan Bakery - เซ็นทรัลพัทยา)", RoleId = auditeeRole.Id, BranchScope = "SPECIFIC", BrandScope = "SPECIFIC", MustChangePassword = false };
            var auditeeRayong = new User { Username = "auditee_rayong", PasswordHash = defaultPasswordHash, FullName = "นายธนาคาร มงคล (ผจก. Artisan Bakery - ระยอง)", RoleId = auditeeRole.Id, BranchScope = "SPECIFIC", BrandScope = "SPECIFIC", MustChangePassword = false };

            context.Users.AddRange(
                adminUser, auditorSomchai, auditorSarah, auditorJohn, auditorKrit, auditorMike, auditorAnan, auditorSomchaiK,
                standardKanda, execDavid,
                auditeeSiam, auditeeAri, auditeeSukhumvit, auditeeBangna, auditeeLadprao, auditeeChiangmai, auditeePhuket, auditeePattaya, auditeeRayong
            );
            context.SaveChanges();

            var now = DateTime.UtcNow;

            // ==========================================
            // 4b. SEED BRANDS (normalized — mirrors the free-text BrandName values used below)
            // ==========================================
            var brandDefs = new[]
            {
                new Brand { Code = "UB", Name = "Urban Burger", CreatedAt = now },
                new Brand { Code = "CL", Name = "Cafe Luna", CreatedAt = now },
                new Brand { Code = "AB", Name = "Artisan Bakery", CreatedAt = now },
                new Brand { Code = "CS", Name = "Central Supply", CreatedAt = now },
                new Brand { Code = "QSCH", Name = "QSC Holding", CreatedAt = now },
            };
            context.Brands.AddRange(brandDefs);
            context.SaveChanges();
            var brandIdByName = brandDefs.ToDictionary(b => b.Name, b => b.Id);

            // ==========================================
            // 5. SEED LOCATIONS (25+ Enterprise Branches across Brands & Regions)
            // ==========================================
            var locations = new List<Location>
            {
                // --- Urban Burger ---
                new Location { Code = "UB-001", Name = "สาขาสยามพารากอน (Siam Paragon Flagship)", LocationTypeId = storeType.Id, ManagerUserId = auditeeSiam.Id, Latitude = 13.7466, Longitude = 100.5347, Region = "กรุงเทพฯ และปริมณฑล", Address = "ชั้น G สยามพารากอน ถ.พระราม 1 ปทุมวัน กรุงเทพฯ 10330", Phone = "02-123-4567", LastScore = 98.5, LastAuditDate = now.AddDays(-14) },
                new Location { Code = "UB-002", Name = "สาขาสุขุมวิท 24 (Sukhumvit 24)", LocationTypeId = storeType.Id, ManagerUserId = auditeeSukhumvit.Id, Latitude = 13.7291, Longitude = 100.5678, Region = "กรุงเทพฯ และปริมณฑล", Address = "ซอยสุขุมวิท 24 คลองตัน คลองเตย กรุงเทพฯ 10110", Phone = "02-234-5678", LastScore = 91.2, LastAuditDate = now.AddDays(-21) },
                new Location { Code = "UB-003", Name = "สาขาเมกาบางนา (Mega Bangna Drive-thru)", LocationTypeId = storeType.Id, ManagerUserId = auditeeBangna.Id, Latitude = 13.6468, Longitude = 100.6802, Region = "กรุงเทพฯ และปริมณฑล", Address = "ศูนย์การค้าเมกาบางนา ถ.บางนา-ตราด กม.8 สมุทรปราการ 10540", Phone = "02-345-6789", LastScore = 94.8, LastAuditDate = now.AddDays(-13) },
                new Location { Code = "UB-004", Name = "สาขาเซ็นทรัลลาดพร้าว (Central Ladprao)", LocationTypeId = storeType.Id, ManagerUserId = auditeeLadprao.Id, Latitude = 13.8164, Longitude = 100.5611, Region = "กรุงเทพฯ และปริมณฑล", Address = "ชั้น 3 เซ็นทรัลลาดพร้าว ถ.พหลโยธิน จตุจักร กรุงเทพฯ 10900", Phone = "02-456-7890", LastScore = 86.9, LastAuditDate = now.AddDays(-23) },
                new Location { Code = "UB-005", Name = "สาขาแฟชั่นไอส์แลนด์ (Fashion Island)", LocationTypeId = storeType.Id, Latitude = 13.8247, Longitude = 100.6789, Region = "กรุงเทพฯ และปริมณฑล", Address = "ชั้น B แฟชั่นไอส์แลนด์ ถ.รามอินทรา คันนายาว กรุงเทพฯ 10230", Phone = "02-567-8901", LastScore = 93.0, LastAuditDate = now.AddDays(-30) },
                new Location { Code = "UB-006", Name = "สาขาเซ็นทรัลเชียงใหม่ (Central Chiang Mai)", LocationTypeId = storeType.Id, ManagerUserId = auditeeChiangmai.Id, Latitude = 18.7997, Longitude = 99.0178, Region = "ภาคเหนือ", Address = "ชั้น 4 เซ็นทรัลเชียงใหม่ ถ.ซุปเปอร์ไฮเวย์ อ.เมือง จ.เชียงใหม่ 50000", Phone = "053-123-456", LastScore = 96.4, LastAuditDate = now.AddDays(-18) },
                new Location { Code = "UB-007", Name = "สาขาเชียงรายแอร์พอร์ต (Chiang Rai Airport Mall)", LocationTypeId = storeType.Id, Latitude = 19.9520, Longitude = 99.8820, Region = "ภาคเหนือ", Address = "ชั้น 1 ศูนย์การค้าแอร์พอร์ตพลาซ่า อ.เมือง จ.เชียงราย 57000", Phone = "053-234-567", LastScore = 92.8, LastAuditDate = now.AddDays(-25) },
                new Location { Code = "UB-008", Name = "สาขาเซ็นทรัลภูเก็ต (Central Festival Phuket)", LocationTypeId = storeType.Id, ManagerUserId = auditeePhuket.Id, Latitude = 7.8920, Longitude = 98.3670, Region = "ภาคใต้", Address = "ชั้น 3 เซ็นทรัลภูเก็ต ถ.วิชิตสงคราม อ.เมือง จ.ภูเก็ต 83000", Phone = "076-123-456", LastScore = 88.4, LastAuditDate = now.AddDays(-22) },
                new Location { Code = "UB-009", Name = "สาขาหาดใหญ่ ลีการ์เดนส์ (Hat Yai Lee Gardens)", LocationTypeId = storeType.Id, Latitude = 7.0068, Longitude = 100.4715, Region = "ภาคใต้", Address = "ถ.เสน่หานุสรณ์ อ.หาดใหญ่ จ.สงขลา 90110", Phone = "074-234-567", LastScore = 91.0, LastAuditDate = now.AddDays(-35) },
                new Location { Code = "UB-010", Name = "สาขาเซ็นทรัลขอนแก่น (Central Khon Kaen)", LocationTypeId = storeType.Id, Latitude = 16.4320, Longitude = 102.8240, Region = "ภาคตะวันออกเฉียงเหนือ", Address = "ชั้น G เซ็นทรัลขอนแก่น ถ.ศรีจันทร์ อ.เมือง จ.ขอนแก่น 40000", Phone = "043-123-456", LastScore = 89.5, LastAuditDate = now.AddDays(-32) },
                new Location { Code = "UB-011", Name = "สาขาเทอร์มินอล 21 โคราช (Terminal 21 Korat)", LocationTypeId = storeType.Id, Latitude = 14.9810, Longitude = 102.0980, Region = "ภาคตะวันออกเฉียงเหนือ", Address = "ชั้น 4 เทอร์มินอล 21 ถ.มิตรภาพ อ.เมือง จ.นครราชสีมา 30000", Phone = "044-234-567", LastScore = 93.2, LastAuditDate = now.AddDays(-29) },

                // --- Cafe Luna ---
                new Location { Code = "CL-001", Name = "สาขาอารีย์ (Ari Craft Yard)", LocationTypeId = storeType.Id, ManagerUserId = auditeeAri.Id, Latitude = 13.7797, Longitude = 100.5447, Region = "กรุงเทพฯ และปริมณฑล", Address = "โครงการ ลาวิลล่า พหลโยธิน พญาไท กรุงเทพฯ 10400", Phone = "02-678-9012", LastScore = 97.8, LastAuditDate = now.AddDays(-16) },
                new Location { Code = "CL-002", Name = "สาขาทองหล่อ 13 (Thong Lo 13)", LocationTypeId = storeType.Id, Latitude = 13.7335, Longitude = 100.5822, Region = "กรุงเทพฯ และปริมณฑล", Address = "ซอยทองหล่อ 13 สุขุมวิท 55 คลองตันเหนือ วัฒนา กรุงเทพฯ 10110", Phone = "02-789-0123", LastScore = 92.1, LastAuditDate = now.AddDays(-19) },
                new Location { Code = "CL-003", Name = "สาขาสีลมคอมเพล็กซ์ (Silom Complex)", LocationTypeId = storeType.Id, Latitude = 13.7285, Longitude = 100.5348, Region = "กรุงเทพฯ และปริมณฑล", Address = "ชั้น 2 สีลมคอมเพล็กซ์ ถ.สีลม บางรัก กรุงเทพฯ 10500", Phone = "02-890-1234", LastScore = 94.0, LastAuditDate = now.AddDays(-24) },
                new Location { Code = "CL-004", Name = "สาขาไอคอนสยาม (IconSiam Riverside)", LocationTypeId = storeType.Id, Latitude = 13.7268, Longitude = 100.5108, Region = "กรุงเทพฯ และปริมณฑล", Address = "ชั้น G โซน Veranda ไอคอนสยาม คลองสาน กรุงเทพฯ 10600", Phone = "02-901-2345", LastScore = 95.5, LastAuditDate = now.AddDays(-12) },
                new Location { Code = "CL-005", Name = "สาขานิมมานเชียงใหม่ (Nimman Promenade)", LocationTypeId = storeType.Id, Latitude = 18.7960, Longitude = 98.9680, Region = "ภาคเหนือ", Address = "ถนนนิมมานเหมินท์ ซอย 9 ต.สุเทพ อ.เมือง จ.เชียงใหม่ 50200", Phone = "053-345-678", LastScore = 95.9, LastAuditDate = now.AddDays(-17) },
                new Location { Code = "CL-006", Name = "สาขาเซ็นทรัลอุดรธานี (Central Udon Thani)", LocationTypeId = storeType.Id, Latitude = 17.4060, Longitude = 102.7930, Region = "ภาคตะวันออกเฉียงเหนือ", Address = "ชั้น 2 เซ็นทรัลอุดรธานี ถ.ประจักษ์ศิลปาคม อ.เมือง จ.อุดรธานี 41000", Phone = "042-123-456", LastScore = 91.8, LastAuditDate = now.AddDays(-27) },

                // --- Artisan Bakery ---
                new Location { Code = "AB-001", Name = "สาขาเอ็มควอเทียร์ (EmQuartier Flagship)", LocationTypeId = storeType.Id, Latitude = 13.7314, Longitude = 100.5698, Region = "กรุงเทพฯ และปริมณฑล", Address = "ชั้น G อาคาร The Glass Quartier เอ็มควอเทียร์ สุขุมวิท กรุงเทพฯ 10110", Phone = "02-012-3456", LastScore = 97.2, LastAuditDate = now.AddDays(-15) },
                new Location { Code = "AB-002", Name = "สาขาเซ็นทรัลพระราม 9 (Central Rama 9)", LocationTypeId = storeType.Id, Latitude = 13.7580, Longitude = 100.5660, Region = "กรุงเทพฯ และปริมณฑล", Address = "ชั้น B เซ็นทรัลพระราม 9 ถ.รัชดาภิเษก ห้วยขวาง กรุงเทพฯ 10310", Phone = "02-123-7890", LastScore = 89.0, LastAuditDate = now.AddDays(-42) },
                new Location { Code = "AB-003", Name = "สาขาเซ็นทรัลพัทยา (Central Pattaya)", LocationTypeId = storeType.Id, ManagerUserId = auditeePattaya.Id, Latitude = 12.9350, Longitude = 100.8830, Region = "ภาคตะวันออก", Address = "ชั้น 1 เซ็นทรัลพัทยาบีช ถ.พัทยาสาย 1 อ.บางละมุง จ.ชลบุรี 20150", Phone = "038-123-456", LastScore = 93.5, LastAuditDate = now.AddDays(-21) },
                new Location { Code = "AB-004", Name = "สาขาระยองซิตี้ (Rayong City Center)", LocationTypeId = storeType.Id, ManagerUserId = auditeeRayong.Id, Latitude = 12.6830, Longitude = 101.2780, Region = "ภาคตะวันออก", Address = "ถ.สุขุมวิท ต.เชิงเนิน อ.เมือง จ.ระยอง 21000", Phone = "038-234-567", LastScore = 84.2, LastAuditDate = now.AddDays(-24) },
                new Location { Code = "AB-005", Name = "สาขาเซ็นทรัลชลบุรี (Central Chonburi)", LocationTypeId = storeType.Id, Latitude = 13.3370, Longitude = 100.9650, Region = "ภาคตะวันออก", Address = "ชั้น 1 เซ็นทรัลชลบุรี ถ.สุขุมวิท อ.เมือง จ.ชลบุรี 20000", Phone = "038-345-678", LastScore = 90.5, LastAuditDate = now.AddDays(-37) },

                // --- Plants & Kitchens & HQ ---
                new Location { Code = "PLANT-01", Name = "โรงงานผลิตและศูนย์แปรรูปบางนา (Bangna Central Kitchen)", LocationTypeId = plantType.Id, Latitude = 13.6682, Longitude = 100.6341, Region = "กรุงเทพฯ และปริมณฑล", Address = "ถ.บางนา-ตราด กม.18 ต.บางโฉลง อ.บางพลี จ.สมุทรปราการ 10540", Phone = "02-456-7890", LastScore = 96.0, LastAuditDate = now.AddDays(-7) },
                new Location { Code = "PLANT-02", Name = "คลังสินค้าและศูนย์กระจายสินค้าอยุธยา (Ayutthaya Logistics Hub)", LocationTypeId = plantType.Id, Latitude = 14.3530, Longitude = 100.5770, Region = "ภาคกลาง", Address = "นิคมอุตสาหกรรมโรจนะ อ.อุทัย จ.พระนครศรีอยุธยา 13210", Phone = "035-123-456", LastScore = 91.5, LastAuditDate = now.AddDays(-10) },
                new Location { Code = "CK-01", Name = "ครัวกลางพัฒนาการ (Pattanakarn Cloud Kitchen)", LocationTypeId = cloudKitchenType.Id, Latitude = 13.7340, Longitude = 100.6280, Region = "กรุงเทพฯ และปริมณฑล", Address = "ถ.พัฒนาการ สวนหลวง กรุงเทพฯ 10250", Phone = "02-321-4567", LastScore = 94.0, LastAuditDate = now.AddDays(-5) },
                new Location { Code = "HQ-01", Name = "สำนักงานใหญ่อโศก (Asoke Headquarters)", LocationTypeId = officeType.Id, Latitude = 13.7380, Longitude = 100.5604, Region = "กรุงเทพฯ และปริมณฑล", Address = "อาคารเอกซ์เชนจ์ ทาวเวอร์ ถ.สุขุมวิท คลองเตย กรุงเทพฯ 10110", Phone = "02-567-8901", LastScore = 98.0, LastAuditDate = now.AddDays(-60) }
            };

            context.Locations.AddRange(locations);
            context.SaveChanges();

            // Backfill ความสัมพันธ์ Location-Brand จาก BrandName เดิม
            // ร้านค้าทั่วไป: 1 Location -> 1 Brand และแบรนด์เดิมเป็น Primary
            // Plant/Cloud Kitchen: ใช้ร่วมกัน 3 แบรนด์ โดย Urban Burger เป็น Primary ตามแผน
            var sharedFacilityCodes = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "PLANT-01",
                "PLANT-02",
                "CK-01"
            };
            var sharedBrandNames = new[] { "Urban Burger", "Cafe Luna", "Artisan Bakery" };
            var locationBrandLinks = new List<LocationBrand>();

            foreach (var loc in locations)
            {
                if (sharedFacilityCodes.Contains(loc.Code))
                {
                    foreach (var brandName in sharedBrandNames)
                    {
                        if (brandIdByName.TryGetValue(brandName, out var brandId))
                        {
                            locationBrandLinks.Add(new LocationBrand
                            {
                                LocationId = loc.Id,
                                BrandId = brandId
                            });
                        }
                    }

                    continue;
                }

                string? targetBrandName = loc.Code switch
                {
                    var c when c.StartsWith("UB") => "Urban Burger",
                    var c when c.StartsWith("CL") => "Cafe Luna",
                    var c when c.StartsWith("AB") => "Artisan Bakery",
                    "HQ-01" => "QSC Holding",
                    "GG" => "Genger",
                    _ => null
                };

                if (targetBrandName != null && brandIdByName.TryGetValue(targetBrandName, out var targetBrandId))
                {
                    locationBrandLinks.Add(new LocationBrand
                    {
                        LocationId = loc.Id,
                        BrandId = targetBrandId
                    });
                }
            }

            context.LocationBrands.AddRange(locationBrandLinks);
            context.SaveChanges();

            // Link User Locations
            context.UserLocations.AddRange(
                new UserLocation { UserId = auditeeSiam.Id, LocationId = locations[0].Id },
                new UserLocation { UserId = auditeeSukhumvit.Id, LocationId = locations[1].Id },
                new UserLocation { UserId = auditeeBangna.Id, LocationId = locations[2].Id },
                new UserLocation { UserId = auditeeLadprao.Id, LocationId = locations[3].Id },
                new UserLocation { UserId = auditeeChiangmai.Id, LocationId = locations[5].Id },
                new UserLocation { UserId = auditeePhuket.Id, LocationId = locations[7].Id },
                new UserLocation { UserId = auditeeAri.Id, LocationId = locations[11].Id },
                new UserLocation { UserId = auditeePattaya.Id, LocationId = locations[19].Id },
                new UserLocation { UserId = auditeeRayong.Id, LocationId = locations[20].Id }
            );
            context.SaveChanges();

            // Link User Brands (Auditors & Store Managers mapped to specific brands)
            context.UserBrands.AddRange(
                new UserBrand { UserId = auditorSomchai.Id, BrandId = brandDefs[0].Id },  // Urban Burger
                new UserBrand { UserId = auditorMike.Id, BrandId = brandDefs[0].Id },     // Urban Burger
                new UserBrand { UserId = auditorAnan.Id, BrandId = brandDefs[0].Id },     // Urban Burger
                new UserBrand { UserId = auditorSarah.Id, BrandId = brandDefs[1].Id },    // Cafe Luna
                new UserBrand { UserId = auditorJohn.Id, BrandId = brandDefs[2].Id },     // Artisan Bakery
                new UserBrand { UserId = auditorSomchaiK.Id, BrandId = brandDefs[2].Id }, // Artisan Bakery
                new UserBrand { UserId = auditeeSiam.Id, BrandId = brandDefs[0].Id },
                new UserBrand { UserId = auditeeSukhumvit.Id, BrandId = brandDefs[0].Id },
                new UserBrand { UserId = auditeeBangna.Id, BrandId = brandDefs[0].Id },
                new UserBrand { UserId = auditeeLadprao.Id, BrandId = brandDefs[0].Id },
                new UserBrand { UserId = auditeeChiangmai.Id, BrandId = brandDefs[0].Id },
                new UserBrand { UserId = auditeePhuket.Id, BrandId = brandDefs[0].Id },
                new UserBrand { UserId = auditeeAri.Id, BrandId = brandDefs[1].Id },
                new UserBrand { UserId = auditeePattaya.Id, BrandId = brandDefs[2].Id },
                new UserBrand { UserId = auditeeRayong.Id, BrandId = brandDefs[2].Id }
            );
            context.SaveChanges();

            // ==========================================
            // 6. SEED SURVEY FORMS (3 Templates)
            // ==========================================
            // Form 1: QSC Core Checklist 2026
            var form1 = new SurveyForm
            {
                Title = "แบบฟอร์มมาตรฐาน 5 ดาว (QSC Core Checklist 2026)",
                LocationTypeId = storeType.Id,
                BrandId = brandDefs[0].Id,
                PassingScore = 85.0,
                TargetingMode = "ALL_LOCATIONS",
                Version = "v3.4",
                IsLatest = true,
                IsActive = true,
                CreatedBy = standardKanda.Id,
                CreatedAt = now.AddMonths(-6)
            };

            // Form 2: GMP & HACCP Plant Audit
            var form2 = new SurveyForm
            {
                Title = "แบบฟอร์มตรวจสอบมาตรฐานโรงงานและคลังสินค้า (GMP & HACCP Plant Audit)",
                LocationTypeId = plantType.Id,
                BrandId = brandDefs[0].Id,
                PassingScore = 90.0,
                TargetingMode = "ALL_LOCATIONS",
                Version = "v2.1",
                IsLatest = true,
                IsActive = true,
                CreatedBy = standardKanda.Id,
                CreatedAt = now.AddMonths(-4)
            };

            // Form 3: Cloud Kitchen & Delivery SOP
            var form3 = new SurveyForm
            {
                Title = "แบบฟอร์มตรวจประเมินครัวกลางและการจัดส่ง (Cloud Kitchen & Delivery SOP)",
                LocationTypeId = cloudKitchenType.Id,
                BrandId = brandDefs[1].Id,
                PassingScore = 85.0,
                TargetingMode = "ALL_LOCATIONS",
                Version = "v1.5",
                IsLatest = true,
                IsActive = true,
                CreatedBy = standardKanda.Id,
                CreatedAt = now.AddMonths(-2)
            };

            context.SurveyForms.AddRange(form1, form2, form3);
            context.SaveChanges();

            // Sections & Items for Form 1
            var secCLN = new SurveySection { SurveyFormId = form1.Id, Title = "หมวด ก: มาตรฐานสุขอนามัยและความสะอาด (CLN)", OrderIndex = 1, WeightPercent = 30.0, IsActive = true };
            var secQLT = new SurveySection { SurveyFormId = form1.Id, Title = "หมวด ข: คุณภาพอาหาร ความสด และการควบคุมอุณหภูมิ (QLT)", OrderIndex = 2, WeightPercent = 30.0, IsActive = true };
            var secSVC = new SurveySection { SurveyFormId = form1.Id, Title = "หมวด ค: การบริการ ความเร็ว และความสุภาพ (SVC)", OrderIndex = 3, WeightPercent = 20.0, IsActive = true };
            var secSAF = new SurveySection { SurveyFormId = form1.Id, Title = "หมวด ง: ความปลอดภัยสถานที่ และระบบควบคุมเงินสด (SAF)", OrderIndex = 4, WeightPercent = 20.0, IsActive = true };

            context.SurveySections.AddRange(secCLN, secQLT, secSVC, secSAF);
            context.SaveChanges();

            var item1_1 = new SurveyItem { SurveySectionId = secCLN.Id, QuestionText = "จุดล้างมือมีสบู่เหลว แอลกอฮอล์ และกระดาษเช็ดมือพร้อมใช้งาน", QuestionType = "YESNO", FullScore = 10.0, IsCritical = false, CategoryCode = "CLN", CategoryName = "ความสะอาด", OrderIndex = 1, IsActive = true };
            var item1_2 = new SurveyItem { SurveySectionId = secCLN.Id, QuestionText = "ตู้เย็นและตู้แช่เย็นควบคุมอุณหภูมิ <= 4.0°C พร้อมบันทึก Log สม่ำเสมอ", QuestionType = "YESNO", FullScore = 15.0, IsCritical = true, CategoryCode = "DOC", CategoryName = "เอกสาร", OrderIndex = 2, IsActive = true };
            var item1_3 = new SurveyItem { SurveySectionId = secCLN.Id, QuestionText = "ฮูดดูดควัน ตะแกรงดักไขมัน และท่อระบายน้ำพื้นสะอาดปราศจากคราบสะสม", QuestionType = "YESNO", FullScore = 10.0, IsCritical = false, CategoryCode = "CLN", CategoryName = "ความสะอาด", OrderIndex = 3, IsActive = true };
            var item1_4 = new SurveyItem { SurveySectionId = secCLN.Id, QuestionText = "โต๊ะทานอาหาร ภาชนะเครื่องปรุง และหัวจ่ายเครื่องดื่มเช็ดฆ่าเชื้อทุก 2 ชม.", QuestionType = "YESNO", FullScore = 5.0, IsCritical = false, CategoryCode = "CLN", CategoryName = "ความสะอาด", OrderIndex = 4, IsActive = true };

            var item1_5 = new SurveyItem { SurveySectionId = secQLT.Id, QuestionText = "ค่าน้ำมันทอด TPM ไม่เกิน 22% (ตรวจสอบด้วยเครื่องวัดดิจิทัล)", QuestionType = "YESNO", FullScore = 10.0, IsCritical = true, CategoryCode = "QLT", CategoryName = "คุณภาพสินค้า", OrderIndex = 1, IsActive = true };
            var item1_6 = new SurveyItem { SurveySectionId = secQLT.Id, QuestionText = "อุณหภูมิแกนกลางของเนื้อสัตว์ปรุงสุกถึง >= 75°C นาน 15 วินาที", QuestionType = "YESNO", FullScore = 15.0, IsCritical = true, CategoryCode = "QLT", CategoryName = "คุณภาพสินค้า", OrderIndex = 2, IsActive = true };
            var item1_7 = new SurveyItem { SurveySectionId = secQLT.Id, QuestionText = "วัตถุดิบทั้งหมดติดป้าย FIFO ระบุวันผลิตและวันหมดอายุย่อยชัดเจน", QuestionType = "YESNO", FullScore = 10.0, IsCritical = false, CategoryCode = "DOC", CategoryName = "เอกสาร", OrderIndex = 3, IsActive = true };

            var item1_8 = new SurveyItem { SurveySectionId = secSVC.Id, QuestionText = "พนักงานต้อนรับกล่าวทักทายภายใน 5 วินาทีด้วยรอยยิ้มและคำทักทายมาตรฐาน", QuestionType = "SCALE", FullScore = 5.0, IsCritical = false, CategoryCode = "SVC", CategoryName = "การบริการ", OrderIndex = 1, IsActive = true };
            var item1_9 = new SurveyItem { SurveySectionId = secSVC.Id, QuestionText = "ความเร็วในการเสิร์ฟ (สั่งซื้อจนถึงรับสินค้า) ไม่เกิน 180 วินาที", QuestionType = "SCALE", FullScore = 10.0, IsCritical = false, CategoryCode = "SVC", CategoryName = "การบริการ", OrderIndex = 2, IsActive = true };
            var item1_10 = new SurveyItem { SurveySectionId = secSVC.Id, QuestionText = "การแต่งกาย ป้ายชื่อ และหมวกเก็บผมถูกต้องตามระเบียบบริษัท 100%", QuestionType = "YESNO", FullScore = 5.0, IsCritical = false, CategoryCode = "OPS", CategoryName = "กระบวนการทำงาน", OrderIndex = 3, IsActive = true };

            var item1_11 = new SurveyItem { SurveySectionId = secSAF.Id, QuestionText = "ทางหนีไฟไม่มีสิ่งกีดขวาง และถังดับเพลิงมีสติกเกอร์ตรวจเช็คประจำเดือน", QuestionType = "YESNO", FullScore = 10.0, IsCritical = true, CategoryCode = "OPS", CategoryName = "กระบวนการทำงาน", OrderIndex = 1, IsActive = true };
            var item1_12 = new SurveyItem { SurveySectionId = secSAF.Id, QuestionText = "เงินสดย่อยในลิ้นชักตรงกับรายงานกะ POS โดยไม่มีเงินส่วนเกิน", QuestionType = "SCALE", FullScore = 10.0, IsCritical = false, CategoryCode = "DOC", CategoryName = "เอกสาร", OrderIndex = 2, IsActive = true };

            context.SurveyItems.AddRange(item1_1, item1_2, item1_3, item1_4, item1_5, item1_6, item1_7, item1_8, item1_9, item1_10, item1_11, item1_12);
            context.SaveChanges();

            // Sections & Items for Form 2 (Plant)
            var secPlant1 = new SurveySection { SurveyFormId = form2.Id, Title = "หมวด 1: มาตรฐาน GMP & สุขลักษณะโรงงาน", OrderIndex = 1, WeightPercent = 50.0, IsActive = true };
            var secPlant2 = new SurveySection { SurveyFormId = form2.Id, Title = "หมวด 2: ระบบความเย็นและสายการผลิตอัตโนมัติ", OrderIndex = 2, WeightPercent = 50.0, IsActive = true };
            context.SurveySections.AddRange(secPlant1, secPlant2);
            context.SaveChanges();

            context.SurveyItems.AddRange(
                new SurveyItem { SurveySectionId = secPlant1.Id, QuestionText = "การควบคุมสัตว์พาหะและตาข่ายดักแมลงทางเข้าไลน์ผลิตสมบูรณ์ 100%", QuestionType = "YESNO", FullScore = 20.0, IsCritical = true, CategoryCode = "OPS", CategoryName = "กระบวนการทำงาน", OrderIndex = 1, IsActive = true },
                new SurveyItem { SurveySectionId = secPlant1.Id, QuestionText = "การทำความสะอาดฆ่าเชื้อเครื่องจักร CIP ตามรอบเวลา", QuestionType = "YESNO", FullScore = 15.0, IsCritical = false, CategoryCode = "CLN", CategoryName = "ความสะอาด", OrderIndex = 2, IsActive = true },
                new SurveyItem { SurveySectionId = secPlant2.Id, QuestionText = "ระบบควบคุมอุณหภูมิห้องเย็นกลาง (-22°C ถึง -18°C) บันทึกอัตโนมัติ 24 ชม.", QuestionType = "YESNO", FullScore = 25.0, IsCritical = true, CategoryCode = "QLT", CategoryName = "คุณภาพสินค้า", OrderIndex = 1, IsActive = true },
                new SurveyItem { SurveySectionId = secPlant2.Id, QuestionText = "เครื่องตรวจจับโลหะ (Metal Detector) ผ่านการทดสอบ Test Piece ทุก 2 ชม.", QuestionType = "YESNO", FullScore = 20.0, IsCritical = true, CategoryCode = "OPS", CategoryName = "กระบวนการทำงาน", OrderIndex = 2, IsActive = true }
            );
            context.SaveChanges();

            // ==========================================
            // 7. SEED AUDIT RECORDS & RESPONSES (Comprehensive Historical Records)
            // ==========================================
            var auditRecords = new List<AuditRecord>
            {
                // 🟢 1. ผ่าน / ดีเยี่ยม (98.5%) - Siam Paragon
                new AuditRecord { LocationId = locations[0].Id, SurveyFormId = form1.Id, PrimaryAuditorId = auditorSarah.Id, AuditeeUserId = auditeeSiam.Id, AuditDate = now.AddDays(-14), TotalScore = 113.5, MaxScore = 115.0, PercentageScore = 98.5, IsPassed = true, HasCriticalDefect = false, MetadataValuesJson = "{\"staff_count\": 12}", AuditType = "announced", Notes = "สาขาทำผลงานได้ยอดเยี่ยม รักษาความสะอาดและมาตรฐานอุณหภูมิตู้แช่ได้ดีมาก", StartedAt = now.AddDays(-14).AddHours(-2), SubmittedAt = now.AddDays(-14) },

                // 🟢 2. ผ่าน / ดีเยี่ยม (97.8%) - Ari Craft Yard (Cafe Luna)
                new AuditRecord { LocationId = locations[11].Id, SurveyFormId = form1.Id, PrimaryAuditorId = auditorJohn.Id, AuditeeUserId = auditeeAri.Id, AuditDate = now.AddDays(-16), TotalScore = 112.5, MaxScore = 115.0, PercentageScore = 97.8, IsPassed = true, HasCriticalDefect = false, MetadataValuesJson = "{\"staff_count\": 8}", AuditType = "announced", Notes = "การบริการรวดเร็ว บาริสต้าต้อนรับดีเยี่ยม มีข้อปรับปรุงเล็กน้อยเรื่องกล่องใส่วัตถุดิบ", StartedAt = now.AddDays(-16).AddHours(-1.5), SubmittedAt = now.AddDays(-16) },

                // 🟢 3. ผ่าน / ดีเยี่ยม (97.2%) - EmQuartier (Artisan Bakery)
                new AuditRecord { LocationId = locations[17].Id, SurveyFormId = form1.Id, PrimaryAuditorId = auditorSarah.Id, AuditDate = now.AddDays(-15), TotalScore = 111.8, MaxScore = 115.0, PercentageScore = 97.2, IsPassed = true, HasCriticalDefect = false, MetadataValuesJson = "{\"staff_count\": 10}", AuditType = "announced", Notes = "ครัวสะอาด มาตรฐานเบเกอรี่และการควบคุมอุณหภูมิเตาอบยอดเยี่ยม", StartedAt = now.AddDays(-15).AddHours(-2), SubmittedAt = now.AddDays(-15) },

                // 🟢 4. ผ่าน / ดีเยี่ยม (96.4%) - Central Chiang Mai
                new AuditRecord { LocationId = locations[5].Id, SurveyFormId = form1.Id, PrimaryAuditorId = auditorKrit.Id, AuditeeUserId = auditeeChiangmai.Id, AuditDate = now.AddDays(-18), TotalScore = 110.8, MaxScore = 115.0, PercentageScore = 96.4, IsPassed = true, HasCriticalDefect = false, MetadataValuesJson = "{\"staff_count\": 9}", AuditType = "announced", Notes = "มาตรฐาน QSC ครบถ้วน ทีมงานพร้อมเพรียง จุดล้างมือและป้าย FIFO เรียบร้อย", StartedAt = now.AddDays(-18).AddHours(-1.8), SubmittedAt = now.AddDays(-18) },

                // 🟢 5. ผ่าน / ดีเยี่ยม (95.9%) - Nimman Promenade
                new AuditRecord { LocationId = locations[15].Id, SurveyFormId = form1.Id, PrimaryAuditorId = auditorKrit.Id, AuditDate = now.AddDays(-17), TotalScore = 110.3, MaxScore = 115.0, PercentageScore = 95.9, IsPassed = true, HasCriticalDefect = false, MetadataValuesJson = "{\"staff_count\": 7}", AuditType = "unannounced", Notes = "สุ่มตรวจนอกกำหนดการ รักษามาตรฐานความสะอาดและบริการได้คงเส้นคงวา", StartedAt = now.AddDays(-17).AddHours(-1.2), SubmittedAt = now.AddDays(-17) },

                // 🟢 6. ผ่านเกณฑ์มาตรฐาน (94.8%) - Mega Bangna (Drive-thru)
                new AuditRecord { LocationId = locations[2].Id, SurveyFormId = form1.Id, PrimaryAuditorId = auditorMike.Id, AuditeeUserId = auditeeBangna.Id, AuditDate = now.AddDays(-13), TotalScore = 109.0, MaxScore = 115.0, PercentageScore = 94.8, IsPassed = true, HasCriticalDefect = false, MetadataValuesJson = "{\"staff_count\": 14}", AuditType = "announced", Notes = "Drive-thru ทำความเร็วได้ดีมาก เปิด CAP ล้างเครื่องทำน้ำแข็งและเปลี่ยนไส้กรอง", StartedAt = now.AddDays(-13).AddHours(-2), SubmittedAt = now.AddDays(-13) },

                // 🟢 7. ผ่านเกณฑ์มาตรฐาน (94.0%) - Silom Complex
                new AuditRecord { LocationId = locations[13].Id, SurveyFormId = form1.Id, PrimaryAuditorId = auditorSarah.Id, AuditDate = now.AddDays(-24), TotalScore = 108.1, MaxScore = 115.0, PercentageScore = 94.0, IsPassed = true, HasCriticalDefect = false, MetadataValuesJson = "{\"staff_count\": 9}", AuditType = "announced", Notes = "ระบบจัดคิวมีประสิทธิภาพ พนักงานแต่งกายเรียบร้อย อุณหภูมินมและน้ำแข็งได้เกณฑ์", StartedAt = now.AddDays(-24).AddHours(-1.5), SubmittedAt = now.AddDays(-24) },

                // 🟢 8. ผ่านเกณฑ์มาตรฐาน (93.5%) - Central Pattaya
                new AuditRecord { LocationId = locations[19].Id, SurveyFormId = form1.Id, PrimaryAuditorId = auditorSomchaiK.Id, AuditeeUserId = auditeePattaya.Id, AuditDate = now.AddDays(-21), TotalScore = 107.5, MaxScore = 115.0, PercentageScore = 93.5, IsPassed = true, HasCriticalDefect = false, MetadataValuesJson = "{\"staff_count\": 11}", AuditType = "announced", Notes = "การควบคุมกลิ่นและสุขาภิบาลดีมาก ขนมปังอบสดตามรอบเวลา SOP", StartedAt = now.AddDays(-21).AddHours(-1.8), SubmittedAt = now.AddDays(-21) },

                // 🟢 9. ผ่านเกณฑ์มาตรฐาน (93.2%) - Terminal 21 Korat
                new AuditRecord { LocationId = locations[10].Id, SurveyFormId = form1.Id, PrimaryAuditorId = auditorMike.Id, AuditDate = now.AddDays(-29), TotalScore = 107.2, MaxScore = 115.0, PercentageScore = 93.2, IsPassed = true, HasCriticalDefect = false, MetadataValuesJson = "{\"staff_count\": 8}", AuditType = "announced", Notes = "สาขาภูมิภาคตะวันออกเฉียงเหนือทำผลงานได้ดี จัดเก็บวัตถุดิบแยกหมวดหมู่ชัดเจน", StartedAt = now.AddDays(-29).AddHours(-1.5), SubmittedAt = now.AddDays(-29) },

                // 🟢 10. ผ่านเกณฑ์มาตรฐาน (92.1%) - Thong Lo 13 (Undercover Audit)
                new AuditRecord { LocationId = locations[12].Id, SurveyFormId = form1.Id, PrimaryAuditorId = auditorJohn.Id, AuditDate = now.AddDays(-19), TotalScore = 105.9, MaxScore = 115.0, PercentageScore = 92.1, IsPassed = true, HasCriticalDefect = false, MetadataValuesJson = "{\"staff_count\": 6}", AuditType = "undercover", Notes = "ตรวจแบบปลอมตัว (Mystery Shopper) บริการสุภาพ รวดเร็ว พบโพรบวัดอุณหภูมิต้องสอบเทียบ", StartedAt = now.AddDays(-19).AddHours(-1), SubmittedAt = now.AddDays(-19) },

                // 🟢 11. ผ่านเกณฑ์มาตรฐาน (91.2%) - Sukhumvit 24
                new AuditRecord { LocationId = locations[1].Id, SurveyFormId = form1.Id, PrimaryAuditorId = auditorJohn.Id, AuditeeUserId = auditeeSukhumvit.Id, AuditDate = now.AddDays(-21), TotalScore = 104.9, MaxScore = 115.0, PercentageScore = 91.2, IsPassed = true, HasCriticalDefect = false, MetadataValuesJson = "{\"staff_count\": 8}", AuditType = "announced", Notes = "จุดล้างมือและป้าย FIFO เรียบร้อยดี แนะนำให้เปลี่ยนขอบยางฝาบ่อดักไขมัน", StartedAt = now.AddDays(-21).AddHours(-1.7), SubmittedAt = now.AddDays(-21) },

                // 🟢 12. ผ่านเกณฑ์มาตรฐาน (89.5%) - Central Khon Kaen
                new AuditRecord { LocationId = locations[9].Id, SurveyFormId = form1.Id, PrimaryAuditorId = auditorMike.Id, AuditDate = now.AddDays(-32), TotalScore = 102.9, MaxScore = 115.0, PercentageScore = 89.5, IsPassed = true, HasCriticalDefect = false, MetadataValuesJson = "{\"staff_count\": 9}", AuditType = "announced", Notes = "พื้นที่ครัวสะอาด เรียบร้อย มีข้อปรับปรุงเรื่องเวลาการเสิร์ฟช่วงพีค", StartedAt = now.AddDays(-32).AddHours(-1.6), SubmittedAt = now.AddDays(-32) },

                // 🟢 13. ผ่านเกณฑ์คาบเส้น (86.9%) - Central Ladprao
                new AuditRecord { LocationId = locations[3].Id, SurveyFormId = form1.Id, PrimaryAuditorId = auditorMike.Id, AuditeeUserId = auditeeLadprao.Id, AuditDate = now.AddDays(-23), TotalScore = 99.9, MaxScore = 115.0, PercentageScore = 86.9, IsPassed = true, HasCriticalDefect = false, MetadataValuesJson = "{\"staff_count\": 11}", AuditType = "announced", Notes = "ขอบยางประตูตู้แช่แข็งเสื่อมสภาพ เปิดตั๋ว CAP ซ่อมแซมด่วน", StartedAt = now.AddDays(-23).AddHours(-2), SubmittedAt = now.AddDays(-23) },

                // 🔴 14. ตกเกณฑ์เพราะข้อบกพร่องวิกฤต (88.4% แต่ไม่ผ่าน!) - Central Festival Phuket
                new AuditRecord { LocationId = locations[7].Id, SurveyFormId = form1.Id, PrimaryAuditorId = auditorAnan.Id, AuditeeUserId = auditeePhuket.Id, AuditDate = now.AddDays(-22), TotalScore = 101.7, MaxScore = 115.0, PercentageScore = 88.4, IsPassed = false, HasCriticalDefect = true, MetadataValuesJson = "{\"staff_count\": 10}", AuditType = "announced", Notes = "ตรวจพบค่าน้ำมันทอด TPM เกินเกณฑ์วิกฤต (24.5%) ตกเกณฑ์มาตรฐานทันที เปิดตั๋ว CAP ให้เปลี่ยนน้ำมันใหม่ 100%", StartedAt = now.AddDays(-22).AddHours(-2.2), SubmittedAt = now.AddDays(-22) },

                // 🔴 15. ตกเกณฑ์เพราะคะแนนไม่ถึง 85% (84.2%) - Rayong City Center
                new AuditRecord { LocationId = locations[20].Id, SurveyFormId = form1.Id, PrimaryAuditorId = auditorSomchaiK.Id, AuditeeUserId = auditeeRayong.Id, AuditDate = now.AddDays(-24), TotalScore = 96.8, MaxScore = 115.0, PercentageScore = 84.2, IsPassed = false, HasCriticalDefect = false, MetadataValuesJson = "{\"staff_count\": 7}", AuditType = "announced", Notes = "คะแนนไม่ถึงเกณฑ์ 85% พนักงานฝึกหัดไม่สวมตาข่ายคลุมผม และทางหนีไฟมีกล่องวางขวาง เปิดตั๋ว CAP เคลียร์พื้นที่ทันที", StartedAt = now.AddDays(-24).AddHours(-1.8), SubmittedAt = now.AddDays(-24) },

                // 🔴 16. ตกเกณฑ์คะแนนต่ำมาก (76.5%) - Central Rama 9
                new AuditRecord { LocationId = locations[18].Id, SurveyFormId = form1.Id, PrimaryAuditorId = auditorJohn.Id, AuditDate = now.AddDays(-42), TotalScore = 88.0, MaxScore = 115.0, PercentageScore = 76.5, IsPassed = false, HasCriticalDefect = false, MetadataValuesJson = "{\"staff_count\": 8}", AuditType = "unannounced", Notes = "สุ่มตรวจพบวัตถุดิบไม่ติดป้ายวันหมดอายุย่อย ตู้เย็นอุณหภูมิแกว่ง และจุดเตรียมอาหารไม่เป็นระเบียบ", StartedAt = now.AddDays(-42).AddHours(-2), SubmittedAt = now.AddDays(-42) },

                // 🔴 17. ตกเกณฑ์โรงงานอุตสาหกรรม (56.3% Critical Defect) - Bangna Central Kitchen (PLANT-01)
                new AuditRecord { LocationId = locations[22].Id, SurveyFormId = form2.Id, PrimaryAuditorId = auditorSarah.Id, AuditDate = now.AddDays(-7), TotalScore = 45.0, MaxScore = 80.0, PercentageScore = 56.3, IsPassed = false, HasCriticalDefect = true, MetadataValuesJson = "{\"staff_count\": 35}", AuditType = "announced", Notes = "พบข้อบกพร่องวิกฤตเรื่องตาข่ายดักแมลง และระบบ CIP ล่าช้า ต้องเปิดตั๋ว CAP แก้ไขด่วนระดับโรงงาน", StartedAt = now.AddDays(-7).AddHours(-3), SubmittedAt = now.AddDays(-7) }
            };

            context.AuditRecords.AddRange(auditRecords);
            context.SaveChanges();

            // Add responses for each audit record
            var plantItems = context.SurveyItems.Where(i => i.SurveySection != null && i.SurveySection.SurveyFormId == form2.Id).OrderBy(i => i.Id).ToList();
            var responseImagesToSeed = new List<AuditResponseImage>();

            foreach (var record in auditRecords)
            {
                if (record.SurveyFormId == form2.Id && plantItems.Count >= 4)
                {
                    var resp1 = new AuditResponse { AuditRecordId = record.Id, SurveyItemId = plantItems[0].Id, ScoreGiven = 0.0, IsPassed = false, Notes = "พบตาข่ายดักแมลงชำรุดที่ทางเข้าไลน์ผลิตสมบูรณ์" };
                    var resp2 = new AuditResponse { AuditRecordId = record.Id, SurveyItemId = plantItems[1].Id, ScoreGiven = 0.0, IsPassed = false, Notes = "รอบเวลา CIP ล่าช้ากว่ากำหนด 45 นาที" };
                    var resp3 = new AuditResponse { AuditRecordId = record.Id, SurveyItemId = plantItems[2].Id, ScoreGiven = 25.0, IsPassed = true };
                    var resp4 = new AuditResponse { AuditRecordId = record.Id, SurveyItemId = plantItems[3].Id, ScoreGiven = 20.0, IsPassed = true };

                    context.AuditResponses.AddRange(resp1, resp2, resp3, resp4);
                    context.SaveChanges();

                    responseImagesToSeed.Add(new AuditResponseImage { AuditResponseId = resp1.Id, ImageUrl = "/uploads/audit_images/insect_mesh_damaged.webp", UploadedBy = record.PrimaryAuditorId, UploadedAt = record.AuditDate });
                    continue;
                }

                var isTop = record.PercentageScore >= 95.0;
                var isFailed = !record.IsPassed;
                var isPhuket = record.LocationId == locations[7].Id;
                var isRayong = record.LocationId == locations[20].Id;
                var isRama9 = record.LocationId == locations[18].Id;

                var r1 = new AuditResponse { AuditRecordId = record.Id, SurveyItemId = item1_1.Id, ScoreGiven = 10.0, IsPassed = true };
                var r2 = new AuditResponse { AuditRecordId = record.Id, SurveyItemId = item1_2.Id, ScoreGiven = (isRama9) ? 0.0 : 15.0, IsPassed = !isRama9, Notes = isRama9 ? "ตู้เย็นอุณหภูมิ 7.8°C เกินเกณฑ์ 4.0°C" : null };
                var r3 = new AuditResponse { AuditRecordId = record.Id, SurveyItemId = item1_3.Id, ScoreGiven = 10.0, IsPassed = true };
                var r4 = new AuditResponse { AuditRecordId = record.Id, SurveyItemId = item1_4.Id, ScoreGiven = 5.0, IsPassed = true };
                var r5 = new AuditResponse { AuditRecordId = record.Id, SurveyItemId = item1_5.Id, ScoreGiven = isPhuket ? 0.0 : 10.0, IsPassed = !isPhuket, Notes = isPhuket ? "TPM วัดได้ 24.5% (เกณฑ์วิกฤตห้ามเกิน 22%)" : null };
                var r6 = new AuditResponse { AuditRecordId = record.Id, SurveyItemId = item1_6.Id, ScoreGiven = 15.0, IsPassed = true };
                var r7 = new AuditResponse { AuditRecordId = record.Id, SurveyItemId = item1_7.Id, ScoreGiven = isRama9 ? 0.0 : 10.0, IsPassed = !isRama9, Notes = isRama9 ? "พบวัตถุดิบ 4 กล่องไม่มีป้าย FIFO และวันหมดอายุย่อย" : null };
                var r8 = new AuditResponse { AuditRecordId = record.Id, SurveyItemId = item1_8.Id, ScoreGiven = isTop ? 5.0 : 4.0, IsPassed = true };
                var r9 = new AuditResponse { AuditRecordId = record.Id, SurveyItemId = item1_9.Id, ScoreGiven = isTop ? 10.0 : 8.0, IsPassed = true };
                var r10 = new AuditResponse { AuditRecordId = record.Id, SurveyItemId = item1_10.Id, ScoreGiven = (isRayong || isPhuket) ? 0.0 : 5.0, IsPassed = !(isRayong || isPhuket), Notes = (isRayong || isPhuket) ? "พนักงานเตรียมอาหารไม่สวมตาข่ายเก็บผม" : null };
                var r11 = new AuditResponse { AuditRecordId = record.Id, SurveyItemId = item1_11.Id, ScoreGiven = isRayong ? 0.0 : 10.0, IsPassed = !isRayong, Notes = isRayong ? "มีกล่องพัสดุและลังขวางทางหนีไฟด้านหลัง" : null };
                var r12 = new AuditResponse { AuditRecordId = record.Id, SurveyItemId = item1_12.Id, ScoreGiven = 10.0, IsPassed = true };

                context.AuditResponses.AddRange(r1, r2, r3, r4, r5, r6, r7, r8, r9, r10, r11, r12);
                context.SaveChanges();

                if (isPhuket)
                {
                    responseImagesToSeed.Add(new AuditResponseImage { AuditResponseId = r5.Id, ImageUrl = "/uploads/audit_images/oil_tpm_high.webp", UploadedBy = record.PrimaryAuditorId, UploadedAt = record.AuditDate });
                    responseImagesToSeed.Add(new AuditResponseImage { AuditResponseId = r10.Id, ImageUrl = "/uploads/audit_images/kitchen_hairnet_missing.webp", UploadedBy = record.PrimaryAuditorId, UploadedAt = record.AuditDate });
                }
                if (isRayong)
                {
                    responseImagesToSeed.Add(new AuditResponseImage { AuditResponseId = r11.Id, ImageUrl = "/uploads/audit_images/fire_exit_boxes.webp", UploadedBy = record.PrimaryAuditorId, UploadedAt = record.AuditDate });
                }
                if (isRama9)
                {
                    responseImagesToSeed.Add(new AuditResponseImage { AuditResponseId = r2.Id, ImageUrl = "/uploads/audit_images/fridge_temp_high.webp", UploadedBy = record.PrimaryAuditorId, UploadedAt = record.AuditDate });
                    responseImagesToSeed.Add(new AuditResponseImage { AuditResponseId = r7.Id, ImageUrl = "/uploads/audit_images/expired_no_label.webp", UploadedBy = record.PrimaryAuditorId, UploadedAt = record.AuditDate });
                }
            }

            if (responseImagesToSeed.Any())
            {
                context.AuditResponseImages.AddRange(responseImagesToSeed);
                context.SaveChanges();
            }

            // ==========================================
            // 8. SEED AUDIT SCHEDULES (Completed, In Progress, Pending Upcoming, Cancelled)
            // ==========================================
            var schedCompleted1 = new AuditSchedule { LocationId = locations[0].Id, SurveyFormId = form1.Id, ScheduledDate = now.AddDays(-14), Time = "10:00 - 12:00 น.", AuditType = "announced", Status = "completed", Notes = "ตรวจรอบปกติประจำเดือน สยามพารากอน", CreatedBy = standardKanda.Id, CreatedAt = now.AddMonths(-1) };
            var schedCompleted2 = new AuditSchedule { LocationId = locations[11].Id, SurveyFormId = form1.Id, ScheduledDate = now.AddDays(-16), Time = "13:30 - 15:30 น.", AuditType = "announced", Status = "completed", Notes = "ตรวจรอบปกติประจำเดือน อารีย์", CreatedBy = standardKanda.Id, CreatedAt = now.AddMonths(-1) };
            var schedCompleted3 = new AuditSchedule { LocationId = locations[2].Id, SurveyFormId = form1.Id, ScheduledDate = now.AddDays(-13), Time = "10:00 - 12:00 น.", AuditType = "announced", Status = "completed", Notes = "ตรวจรอบปกติ เมกาบางนา", CreatedBy = standardKanda.Id, CreatedAt = now.AddMonths(-1) };
            var schedCompleted4 = new AuditSchedule { LocationId = locations[17].Id, SurveyFormId = form1.Id, ScheduledDate = now.AddDays(-15), Time = "14:00 - 16:00 น.", AuditType = "announced", Status = "completed", Notes = "ตรวจรอบปกติ เอ็มควอเทียร์", CreatedBy = standardKanda.Id, CreatedAt = now.AddMonths(-1) };

            // 🟡 กำลังตรวจ วันนี้ (In Progress with Active Draft)
            var schedTodayInProg = new AuditSchedule { LocationId = locations[4].Id, SurveyFormId = form1.Id, ScheduledDate = now, Time = "10:00 - 12:00 น.", AuditType = "announced", Status = "in_progress", Notes = "ตรวจประจำวัน สาขาแฟชั่นไอส์แลนด์ (กำลังดำเนินการตรวจ)", CreatedBy = standardKanda.Id, CreatedAt = now.AddDays(-5) };

            // ⚪ กำหนดการล่วงหน้า (Pending / Upcoming - หลากหลายประเภทและสาขา)
            var schedTodayAfternoon = new AuditSchedule { LocationId = locations[12].Id, SurveyFormId = form1.Id, ScheduledDate = now, Time = "14:00 - 16:00 น.", AuditType = "unannounced", Status = "pending", Notes = "สุ่มตรวจช่วงบ่าย ทองหล่อ 13", CreatedBy = standardKanda.Id, CreatedAt = now.AddDays(-2) };
            var schedTomorrow = new AuditSchedule { LocationId = locations[3].Id, SurveyFormId = form1.Id, ScheduledDate = now.AddDays(1), Time = "10:00 - 12:00 น.", AuditType = "announced", Status = "pending", Notes = "ตรวจรอบปกติและติดตามงานซ่อมขอบยางตู้แช่ เซ็นทรัลลาดพร้าว", CreatedBy = standardKanda.Id, CreatedAt = now.AddDays(-2) };
            var schedPhuket = new AuditSchedule { LocationId = locations[7].Id, SurveyFormId = form1.Id, ScheduledDate = now.AddDays(3), Time = "13:30 - 15:30 น.", AuditType = "announced", Status = "pending", Notes = "ตรวจติดตามผลค่าน้ำมันทอด TPM และสุขอนามัย เซ็นทรัลภูเก็ต", CreatedBy = standardKanda.Id, CreatedAt = now.AddDays(-1) };
            var schedRayong = new AuditSchedule { LocationId = locations[20].Id, SurveyFormId = form1.Id, ScheduledDate = now.AddDays(5), Time = "10:00 - 12:00 น.", AuditType = "unannounced", Status = "pending", Notes = "สุ่มตรวจทางหนีไฟและอุปกรณ์ความปลอดภัย ระยองซิตี้", CreatedBy = standardKanda.Id, CreatedAt = now.AddDays(-1) };
            var schedIconSiam = new AuditSchedule { LocationId = locations[14].Id, SurveyFormId = form1.Id, ScheduledDate = now.AddDays(7), Time = "15:00 - 17:00 น.", AuditType = "undercover", Status = "pending", Notes = "ตรวจแบบปลอมตัว Mystery Shopper ไอคอนสยาม", CreatedBy = standardKanda.Id, CreatedAt = now.AddDays(-1) };
            var schedRama9 = new AuditSchedule { LocationId = locations[18].Id, SurveyFormId = form1.Id, ScheduledDate = now.AddDays(9), Time = "11:00 - 13:00 น.", AuditType = "announced", Status = "pending", Notes = "ตรวจติดตามป้ายวันหมดอายุและมาตรฐานความสะอาด เซ็นทรัลพระราม 9", CreatedBy = standardKanda.Id, CreatedAt = now.AddDays(-1) };
            var schedPlant = new AuditSchedule { LocationId = locations[22].Id, SurveyFormId = form2.Id, ScheduledDate = now.AddDays(12), Time = "09:00 - 16:00 น.", AuditType = "announced", Status = "pending", Notes = "ตรวจ GMP & HACCP โรงงานบางนา", CreatedBy = standardKanda.Id, CreatedAt = now.AddDays(-1) };

            // ❌ ยกเลิกนัดตรวจ (Cancelled)
            var schedCancelled = new AuditSchedule { LocationId = locations[21].Id, SurveyFormId = form1.Id, ScheduledDate = now.AddDays(-2), Time = "10:00 - 12:00 น.", AuditType = "announced", Status = "cancelled", Notes = "ยกเลิกนัดหมายเนื่องจากสาขาปิดปรับปรุงระบบไฟฟ้าและท่อระบายน้ำชั่วคราว", CreatedBy = standardKanda.Id, CreatedAt = now.AddDays(-7) };

            context.AuditSchedules.AddRange(
                schedCompleted1, schedCompleted2, schedCompleted3, schedCompleted4,
                schedTodayInProg, schedTodayAfternoon, schedTomorrow,
                schedPhuket, schedRayong, schedIconSiam, schedRama9, schedPlant, schedCancelled
            );
            context.SaveChanges();

            context.AuditScheduleAuditors.AddRange(
                new AuditScheduleAuditor { AuditScheduleId = schedCompleted1.Id, AuditorId = auditorSarah.Id, IsLead = true },
                new AuditScheduleAuditor { AuditScheduleId = schedCompleted2.Id, AuditorId = auditorJohn.Id, IsLead = true },
                new AuditScheduleAuditor { AuditScheduleId = schedCompleted3.Id, AuditorId = auditorMike.Id, IsLead = true },
                new AuditScheduleAuditor { AuditScheduleId = schedCompleted4.Id, AuditorId = auditorSarah.Id, IsLead = true },
                new AuditScheduleAuditor { AuditScheduleId = schedTodayInProg.Id, AuditorId = auditorSomchai.Id, IsLead = true },
                new AuditScheduleAuditor { AuditScheduleId = schedTodayAfternoon.Id, AuditorId = auditorSarah.Id, IsLead = true },
                new AuditScheduleAuditor { AuditScheduleId = schedTomorrow.Id, AuditorId = auditorMike.Id, IsLead = true },
                new AuditScheduleAuditor { AuditScheduleId = schedPhuket.Id, AuditorId = auditorAnan.Id, IsLead = true },
                new AuditScheduleAuditor { AuditScheduleId = schedRayong.Id, AuditorId = auditorSomchaiK.Id, IsLead = true },
                new AuditScheduleAuditor { AuditScheduleId = schedIconSiam.Id, AuditorId = auditorJohn.Id, IsLead = true },
                new AuditScheduleAuditor { AuditScheduleId = schedRama9.Id, AuditorId = auditorJohn.Id, IsLead = true },
                new AuditScheduleAuditor { AuditScheduleId = schedPlant.Id, AuditorId = auditorSarah.Id, IsLead = true }
            );
            context.SaveChanges();

            // ==========================================
            // 8b. SEED AUDIT DRAFTS (3 Active Drafts in Progress)
            // ==========================================
            var draftFashionIsland = new AuditDraft
            {
                LocationId = locations[4].Id,
                SurveyFormId = form1.Id,
                AuditorId = auditorSomchai.Id,
                AuditScheduleId = schedTodayInProg.Id,
                DraftPayloadJson = "{\"locationId\":" + locations[4].Id + ",\"formId\":" + form1.Id + ",\"auditorName\":\"คุณสมชาย ใจดี\",\"answers\":{\"1\":true,\"2\":true,\"3\":false,\"4\":true},\"currentSectionIdx\":0,\"startedAt\":\"" + now.ToString("o") + "\"}",
                CurrentSectionIdx = 0,
                TotalAnswered = 4,
                TotalQuestions = 12,
                StartedAt = now.AddHours(-1),
                UpdatedAt = now.AddMinutes(-15)
            };

            var draftThongLo = new AuditDraft
            {
                LocationId = locations[12].Id,
                SurveyFormId = form1.Id,
                AuditorId = auditorSarah.Id,
                AuditScheduleId = schedTodayAfternoon.Id,
                DraftPayloadJson = "{\"locationId\":" + locations[12].Id + ",\"formId\":" + form1.Id + ",\"auditorName\":\"Sarah Wong\",\"answers\":{\"1\":true,\"2\":true,\"3\":true,\"4\":true,\"5\":true,\"6\":true,\"7\":true,\"8\":true},\"currentSectionIdx\":1,\"startedAt\":\"" + now.ToString("o") + "\"}",
                CurrentSectionIdx = 1,
                TotalAnswered = 8,
                TotalQuestions = 12,
                StartedAt = now.AddHours(-1.5),
                UpdatedAt = now.AddMinutes(-25)
            };

            var draftRama9 = new AuditDraft
            {
                LocationId = locations[18].Id,
                SurveyFormId = form1.Id,
                AuditorId = auditorJohn.Id,
                DraftPayloadJson = "{\"locationId\":" + locations[18].Id + ",\"formId\":" + form1.Id + ",\"auditorName\":\"John Doe\",\"answers\":{\"1\":true,\"2\":true,\"3\":true,\"4\":true,\"5\":true,\"6\":true,\"7\":true,\"8\":true,\"9\":true,\"10\":true,\"11\":false},\"currentSectionIdx\":3,\"startedAt\":\"" + now.ToString("o") + "\"}",
                CurrentSectionIdx = 3,
                TotalAnswered = 11,
                TotalQuestions = 12,
                StartedAt = now.AddHours(-2),
                UpdatedAt = now.AddMinutes(-5)
            };

            context.AuditDrafts.AddRange(draftFashionIsland, draftThongLo, draftRama9);
            context.SaveChanges();

            // ==========================================
            // 9. SEED CAP TASKS & COMMENTS (Comprehensive Lifecycle & Multi-Case Coverage)
            // ==========================================
            // 🔴 Case 1: OPEN - Overdue SLA (เลยกำหนด 3 วัน)
            var cap1 = new CapTask
            {
                AuditRecordId = auditRecords[12].Id, // Central Ladprao
                LocationId = locations[3].Id,
                IssueItem = "เปลี่ยนขอบยางซิลิโคนประตูตู้แช่แข็งแบบ Walk-in",
                Description = "ขอบยางประตูตู้แช่แข็งชำรุด มีไอน้ำเกาะและอุณหภูมิรั่วไหล ต้องประสานช่างเปลี่ยนขอบยางใหม่",
                SubmissionDeadline = now.AddDays(-3), // เลยกำหนด
                Status = "OPEN",
                AssignedTo = auditeeLadprao.Id,
                CreatedAt = now.AddDays(-10),
                NextAuditNote = "ตรวจเช็คขอบยางซิลิโคนและทดสอบระดับอุณหภูมิความเย็นของตู้แช่แข็งอย่างละเอียด",
                FollowUpStatus = "PENDING"
            };

            // 🟡 Case 2: OPEN - Due Soon (เร่งด่วน ครบกำหนดพรุ่งนี้)
            var cap2 = new CapTask
            {
                AuditRecordId = auditRecords[14].Id, // Rayong
                LocationId = locations[20].Id,
                IssueItem = "ติดตั้งไฟฉุกเฉินสำรองและเคลียร์กล่องขวางทางออกประตูด้านหลัง",
                Description = "ทางหนีไฟมีกล่องพัสดุวางซ้อนทับ และไฟฉุกเฉินสำรองแบตเตอรี่เสื่อมสภาพ ต้องแก้ไขทันที",
                SubmissionDeadline = now.AddDays(1), // พรุ่งนี้
                Status = "OPEN",
                AssignedTo = auditeeRayong.Id,
                CreatedAt = now.AddDays(-3),
                NextAuditNote = "ตรวจสอบทางหนีไฟและทดสอบระบบไฟฉุกเฉินสำรองทันทีที่เข้าตรวจ",
                FollowUpStatus = "PENDING"
            };

            // 🟢 Case 3: OPEN - Normal SLA (เหลือเวลา 6 วัน)
            var cap3 = new CapTask
            {
                AuditRecordId = auditRecords[10].Id, // Sukhumvit 24
                LocationId = locations[1].Id,
                IssueItem = "ล้างทำความสะอาดเครื่องทำน้ำแข็งและเปลี่ยนไส้กรองน้ำ",
                Description = "เครื่องทำน้ำแข็งมีคราบตะกรันสะสม ต้องทำการ Deep Cleaning และเปลี่ยนไส้กรองประจำรอบ",
                SubmissionDeadline = now.AddDays(6),
                Status = "OPEN",
                AssignedTo = auditeeSukhumvit.Id,
                CreatedAt = now.AddDays(-2),
                NextAuditNote = "สุ่มตรวจความสะอาดถังน้ำแข็งและเช็ครอบการเปลี่ยนไส้กรองน้ำประจำเดือน",
                FollowUpStatus = "PENDING"
            };

            // ⚠️ Case 4: OPEN - Critical Defect (เซ็นทรัลภูเก็ต ข้อที่ 1)
            var cap4 = new CapTask
            {
                AuditRecordId = auditRecords[13].Id, // Phuket
                LocationId = locations[7].Id,
                IssueItem = "เปลี่ยนถ่ายน้ำมันทอดและทำความสะอาดหม้อทอดด่วน (TPM 24.5%)",
                Description = "ตรวจพบค่าน้ำมันทอด TPM สูงถึง 24.5% ซึ่งเกินเกณฑ์ความปลอดภัยวิกฤต (ห้ามเกิน 22%) ต้องหยุดใช้น้ำมันทันทีและเปลี่ยนน้ำมันใหม่ทั้งระบบ",
                SubmissionDeadline = now.AddDays(2),
                Status = "OPEN",
                AssignedTo = auditeePhuket.Id,
                CreatedAt = now.AddDays(-2),
                NextAuditNote = "ใช้เครื่องวัดดิจิทัลวัดค่าน้ำมันทอด TPM ซ้ำทันทีที่ไปถึงสาขา",
                FollowUpStatus = "PENDING"
            };

            // ⚠️ Case 5: OPEN - Personal Hygiene (เซ็นทรัลภูเก็ต ข้อที่ 2 - แสดงเคสหลายข้อในสาขาเดียว!)
            var cap5 = new CapTask
            {
                AuditRecordId = auditRecords[13].Id, // Phuket
                LocationId = locations[7].Id,
                IssueItem = "สวมหมวกคลุมผมและถุงมืออนามัยระหว่างสัมผัสอาหารปรุงสุก",
                Description = "พนักงานเตรียมอาหารไม่สวมตาข่ายเก็บผมให้มิดชิด และไม่สวมถุงมือขณะหยิบจับอาหารพร้อมรับประทาน",
                SubmissionDeadline = now.AddDays(4),
                Status = "OPEN",
                AssignedTo = auditeePhuket.Id,
                CreatedAt = now.AddDays(-2),
                NextAuditNote = "ตรวจเช็คการแต่งกาย สุขอนามัยส่วนบุคคล และการสวมตาข่ายคลุมผมของพนักงานครัว 100%",
                FollowUpStatus = "PENDING"
            };

            // 🏭 Case 6: OPEN - Plant GMP
            var cap6 = new CapTask
            {
                AuditRecordId = auditRecords[16].Id, // Bangna Plant
                LocationId = locations[22].Id,
                IssueItem = "ซ่อมแซมตาข่ายดักแมลงและปรับตั้งรอบเวลา CIP ไลน์ผลิต",
                Description = "พบตาข่ายดักแมลงทางเข้าไลน์ผลิตมีรอยขาด และรอบทำความสะอาด CIP ล่าช้ากว่ามาตรฐาน 45 นาที",
                SubmissionDeadline = now.AddDays(5),
                Status = "OPEN",
                CreatedAt = now.AddDays(-4),
                NextAuditNote = "ตรวจเช็คตาข่ายดักแมลงทางเข้าไลน์ผลิตและทดสอบรอบเวลา CIP",
                FollowUpStatus = "PENDING"
            };

            // 📤 Case 7: SUBMITTED - รอ QA ตรวจสอบ (Siam Paragon)
            var cap7 = new CapTask
            {
                AuditRecordId = auditRecords[0].Id, // Siam Paragon
                LocationId = locations[0].Id,
                IssueItem = "ซ่อมแซมระบบไฟ LED และสายเซนเซอร์ตู้แช่โชว์หน้าร้าน",
                Description = "ไฟ LED ภายในตู้แช่กระพริบและสายไฟเซนเซอร์หย่อนคล้อย",
                SubmissionDeadline = now.AddDays(1),
                Status = "SUBMITTED",
                AssignedTo = auditeeSiam.Id,
                CreatedAt = now.AddDays(-5),
                NextAuditNote = "เช็คความสว่างของไฟตู้แช่และทดสอบสัญญาณเตือนเซนเซอร์",
                FollowUpStatus = "PENDING"
            };

            // 📤 Case 8: SUBMITTED - รอ QA ตรวจสอบ (Cafe Luna Ari)
            var cap8 = new CapTask
            {
                AuditRecordId = auditRecords[1].Id, // Ari
                LocationId = locations[11].Id,
                IssueItem = "เปลี่ยนกล่องใส่วัตถุดิบที่ชำรุดเป็นกล่อง Food Grade มาตรฐาน NSF",
                Description = "พบกล่องพลาสติกใส่วัตถุดิบมีรอยร้าวบริเวณมุมฝาปิด ให้จัดซื้อกล่อง Food Grade NSF ทดแทน",
                SubmissionDeadline = now.AddDays(3),
                Status = "SUBMITTED",
                AssignedTo = auditeeAri.Id,
                CreatedAt = now.AddDays(-4),
                NextAuditNote = "สุ่มตรวจสภาพกล่องใส่วัตถุดิบทั้งหมดในพื้นที่บาร์กาแฟ",
                FollowUpStatus = "PENDING"
            };

            // ↩️ Case 9: REJECTED - ส่งกลับแก้ไข พร้อมเหตุผลจาก QA (Central Rama 9)
            var cap9 = new CapTask
            {
                AuditRecordId = auditRecords[15].Id, // Rama 9
                LocationId = locations[18].Id,
                IssueItem = "จัดทำป้ายฉลากวันหมดอายุย่อย (Secondary Shelf Life) บนกล่องวัตถุดิบ",
                Description = "พบวัตถุดิบในตู้เย็นเตรียมอาหารไม่มีป้ายระบุวันหมดอายุย่อย ต้องติดป้ายระบุวันที่และเวลาหมดอายุชัดเจนทุกกล่อง",
                SubmissionDeadline = now.AddDays(2),
                Status = "REJECTED",
                CreatedAt = now.AddDays(-6),
                NextAuditNote = "สุ่มตรวจป้าย Secondary Shelf Life บนกล่องวัตถุดิบในตู้เตรียมอาหารทุกจุด",
                FollowUpStatus = "PENDING"
            };

            // ✅ Case 10: CLOSED - อนุมัติปิดงานแล้ว และแนะนำไปใช้ในรอบตรวจแล้ว (USED Status!)
            var cap10 = new CapTask
            {
                AuditRecordId = auditRecords[5].Id, // Mega Bangna
                LocationId = locations[2].Id,
                IssueItem = "เปลี่ยนขอบยางฝาปิดบ่อดักไขมันป้องกันกลิ่นย้อน",
                Description = "ขอบยางฝาบ่อดักไขมันเสื่อมสภาพ ดำเนินการเปลี่ยนขอบยางและซีลซิลิโคนใหม่เรียบร้อย",
                SubmissionDeadline = now.AddDays(-5),
                Status = "CLOSED",
                AssignedTo = auditeeBangna.Id,
                VerifiedBy = auditorMike.Id,
                CompletedAt = now.AddDays(-6),
                ClosedAt = now.AddDays(-5),
                CreatedAt = now.AddDays(-12),
                NextAuditNote = "ตรวจเช็คขอบยางฝาบ่อดักไขมันและกลิ่นย้อนในพื้นที่ล้างภาชนะ",
                FollowUpStatus = "USED",
                FollowUpScheduleId = schedCompleted3.Id
            };

            // ✅ Case 11: CLOSED - อนุมัติปิดงานแล้ว (EmQuartier)
            var cap11 = new CapTask
            {
                AuditRecordId = auditRecords[2].Id, // EmQuartier
                LocationId = locations[17].Id,
                IssueItem = "เปลี่ยนชุดควบคุมเทอร์โมสตัทเตาทอดเบเกอรี่",
                Description = "เทอร์โมสตัทเตาทอดตอบสนองช้า ช่างเทคนิคได้ทำการเปลี่ยนอะไหล่แท้และทดสอบอุณหภูมิผ่านเกณฑ์",
                SubmissionDeadline = now.AddDays(-7),
                Status = "CLOSED",
                VerifiedBy = auditorSarah.Id,
                CompletedAt = now.AddDays(-8),
                ClosedAt = now.AddDays(-7),
                CreatedAt = now.AddDays(-14),
                NextAuditNote = "ทดสอบอุณหภูมิเตาทอดเบเกอรี่ด้วยเทอร์โมมิเตอร์มาตรฐาน",
                FollowUpStatus = "USED",
                FollowUpScheduleId = schedCompleted4.Id
            };

            // ✅ Case 12: CLOSED - ปิดงานปกติ ไม่มีคำแนะนำรอบหน้า (NONE Status)
            var cap12 = new CapTask
            {
                AuditRecordId = auditRecords[3].Id, // Central Chiang Mai
                LocationId = locations[5].Id,
                IssueItem = "ปรับปรุงจุดล้างมือและเติมสบู่เหลวฆ่าเชื้อให้พร้อมใช้งาน",
                Description = "จุดล้างมือพนักงานสบู่เหลวหมด ดำเนินการเติมสบู่เหลวและติดตั้งป้ายขั้นตอนการล้างมือ 7 ขั้นตอนเรียบร้อย",
                SubmissionDeadline = now.AddDays(-10),
                Status = "CLOSED",
                AssignedTo = auditeeChiangmai.Id,
                VerifiedBy = auditorKrit.Id,
                CompletedAt = now.AddDays(-11),
                ClosedAt = now.AddDays(-10),
                CreatedAt = now.AddDays(-16),
                FollowUpStatus = "NONE"
            };

            context.CapTasks.AddRange(cap1, cap2, cap3, cap4, cap5, cap6, cap7, cap8, cap9, cap10, cap11, cap12);
            context.SaveChanges();

            // Seed Evidence Images (Before & After)
            context.CapTaskImages.AddRange(
                new CapTaskImage { CapTaskId = cap7.Id, Phase = "AFTER", ImageUrl = "/uploads/cap_images/after_led_repaired.webp", UploadedBy = auditeeSiam.Id, UploadedAt = now.AddDays(-1) },
                new CapTaskImage { CapTaskId = cap8.Id, Phase = "AFTER", ImageUrl = "/uploads/cap_images/after_nsf_containers.webp", UploadedBy = auditeeAri.Id, UploadedAt = now.AddDays(-2) },
                new CapTaskImage { CapTaskId = cap9.Id, Phase = "AFTER", ImageUrl = "/uploads/cap_images/after_blurry_labels.webp", UploadedBy = auditorJohn.Id, UploadedAt = now.AddDays(-2) },
                new CapTaskImage { CapTaskId = cap10.Id, Phase = "AFTER", ImageUrl = "/uploads/cap_images/after_grease_trap_seal.webp", UploadedBy = auditeeBangna.Id, UploadedAt = now.AddDays(-6) }
            );

            // Seed CAP Comments for communication audit trail (back-and-forth discussions)
            context.CapTaskComments.AddRange(
                // Cap 7 (Siam - SUBMITTED)
                new CapTaskComment { CapTaskId = cap7.Id, SenderId = auditeeSiam.Id, SenderRole = "AUDITEE", Message = "ช่างอาคารเข้ามาเปลี่ยนหลอดไฟ LED และเก็บสายเซนเซอร์เข้าท่อร้อยสายเรียบร้อยแล้วครับ แนบรูปหลักฐานแล้วครับ", CreatedAt = now.AddDays(-1).AddHours(-4) },
                new CapTaskComment { CapTaskId = cap7.Id, SenderId = auditorSarah.Id, SenderRole = "QA", Message = "ได้รับรูปภาพหลักฐานเรียบร้อย อยู่ระหว่างการตรวจสอบผลงานเพื่ออนุมัติปิดตั๋วค่ะ", CreatedAt = now.AddHours(-12) },

                // Cap 8 (Ari - SUBMITTED)
                new CapTaskComment { CapTaskId = cap8.Id, SenderId = auditeeAri.Id, SenderRole = "AUDITEE", Message = "เบิกกล่องมาตรฐาน NSF ใหม่จากคลังกลางจำนวน 6 ใบมาเปลี่ยนแทนกล่องที่ชำรุดเรียบร้อยแล้วครับ", CreatedAt = now.AddDays(-2) },

                // Cap 9 (Rama 9 - REJECTED Case!)
                new CapTaskComment { CapTaskId = cap9.Id, SenderId = auditeeLadprao.Id, SenderRole = "AUDITEE", Message = "ได้ดำเนินการพิมพ์และติดฉลากลงบนกล่องแล้วครับ ขอส่งให้ QA ตรวจสอบครับ", CreatedAt = now.AddDays(-2).AddHours(-6) },
                new CapTaskComment { CapTaskId = cap9.Id, SenderId = auditorJohn.Id, SenderRole = "QA", Message = "รูปถ่ายที่ส่งมาไม่ชัดเจน ไม่เห็นตัวเลขวันที่และเวลาหมดอายุ กรุณาถ่ายภาพโคลสอัพที่เห็นฉลากชัดเจนแล้วส่งเข้ามาใหม่อีกครั้งครับ", CreatedAt = now.AddDays(-1) },

                // Cap 10 (Mega Bangna - CLOSED)
                new CapTaskComment { CapTaskId = cap10.Id, SenderId = auditeeBangna.Id, SenderRole = "AUDITEE", Message = "เปลี่ยนขอบยางฝาบ่อดักไขมันใหม่เรียบร้อย ไม่มีกลิ่นรบกวน", CreatedAt = now.AddDays(-6) },
                new CapTaskComment { CapTaskId = cap10.Id, SenderId = auditorMike.Id, SenderRole = "QA", Message = "ตรวจเช็คหน้างานรอบย่อยเรียบร้อย อนุมัติปิดงาน CAP ครับ", CreatedAt = now.AddDays(-5) }
            );
            context.SaveChanges();
        }

        /// <summary>
        /// ซิงค์ข้อมูล Brand, LocationBrand, และ UserBrand ให้สมบูรณ์เสมอ แม้ฐานข้อมูลจะมีข้อมูลอยู่เดิมแล้ว
        /// ช่วยให้ Admin/Auditor ทดสอบการแยกข้อมูลตามแบรนด์ (Brand Scope & Filtering) ได้ทันที
        /// </summary>
        public static void EnsureBrandAndUserBrandData(AppDbContext context)
        {
            try
            {
                var now = DateTime.UtcNow;

                // 1. Ensure Brands exist
                var existingBrands = context.Brands.ToList();
                var brandDefs = new[]
                {
                    new Brand { Code = "UB", Name = "Urban Burger", Description = "เบอร์เกอร์และอาหารฟาสต์ฟู้ดพรีเมียม", CreatedAt = now },
                    new Brand { Code = "CL", Name = "Cafe Luna", Description = "คาเฟ่เครื่องดื่ม ขนมหวาน และกาแฟ Specialty", CreatedAt = now },
                    new Brand { Code = "AB", Name = "Artisan Bakery", Description = "เบเกอรี่ ขนมปังอบสด และครัวซองต์ฝรั่งเศส", CreatedAt = now },
                    new Brand { Code = "CS", Name = "Central Supply", Description = "โรงงานผลิต ครัวกลาง และศูนย์กระจายสินค้า", CreatedAt = now },
                    new Brand { Code = "QSCH", Name = "QSC Holding", Description = "สำนักงานใหญ่และศูนย์สนับสนุนองค์กร", CreatedAt = now }
                };

                bool brandsAdded = false;
                foreach (var def in brandDefs)
                {
                    if (!existingBrands.Any(b => b.Code == def.Code || b.Name == def.Name))
                    {
                        context.Brands.Add(def);
                        brandsAdded = true;
                    }
                }
                if (brandsAdded) context.SaveChanges();

                var allBrands = context.Brands.ToList();
                var ubBrand = allBrands.FirstOrDefault(b => b.Code == "UB");
                var clBrand = allBrands.FirstOrDefault(b => b.Code == "CL");
                var abBrand = allBrands.FirstOrDefault(b => b.Code == "AB");

                if (ubBrand == null || clBrand == null || abBrand == null) return;

                // 2. Ensure LocationBrands exist for all active locations
                var existingLocBrands = context.LocationBrands.ToList();
                var locations = context.Locations.ToList();
                bool locBrandsAdded = false;

                foreach (var loc in locations)
                {
                    if (string.Equals(loc.Code, "HQ-01", StringComparison.OrdinalIgnoreCase)) continue;

                    if (loc.Code.StartsWith("PLANT") || loc.Code.StartsWith("CK"))
                    {
                        var sharedBrands = new[] { ubBrand, clBrand, abBrand };
                        foreach (var b in sharedBrands)
                        {
                            if (!existingLocBrands.Any(lb => lb.LocationId == loc.Id && lb.BrandId == b.Id))
                            {
                                context.LocationBrands.Add(new LocationBrand
                                {
                                    LocationId = loc.Id,
                                    BrandId = b.Id
                                });
                                locBrandsAdded = true;
                            }
                        }
                    }
                    else if (loc.Code.StartsWith("UB"))
                    {
                        if (!existingLocBrands.Any(lb => lb.LocationId == loc.Id && lb.BrandId == ubBrand.Id))
                        {
                            context.LocationBrands.Add(new LocationBrand { LocationId = loc.Id, BrandId = ubBrand.Id });
                            locBrandsAdded = true;
                        }
                    }
                    else if (loc.Code.StartsWith("CL"))
                    {
                        if (!existingLocBrands.Any(lb => lb.LocationId == loc.Id && lb.BrandId == clBrand.Id))
                        {
                            context.LocationBrands.Add(new LocationBrand { LocationId = loc.Id, BrandId = clBrand.Id });
                            locBrandsAdded = true;
                        }
                    }
                    else if (loc.Code.StartsWith("AB"))
                    {
                        if (!existingLocBrands.Any(lb => lb.LocationId == loc.Id && lb.BrandId == abBrand.Id))
                        {
                            context.LocationBrands.Add(new LocationBrand { LocationId = loc.Id, BrandId = abBrand.Id });
                            locBrandsAdded = true;
                        }
                    }
                }
                if (locBrandsAdded) context.SaveChanges();

                // 3. Ensure UserBrand assignments and BrandScope for testing
                var existingUserBrands = context.UserBrands.ToList();
                if (!existingUserBrands.Any())
                {
                    var users = context.Users.ToList();
                    bool usersUpdated = false;

                    void MapUserToBrand(string username, int brandId, string newTitle)
                    {
                        var u = users.FirstOrDefault(x => x.Username == username);
                        if (u != null)
                        {
                            if (u.BrandScope != "SPECIFIC") { u.BrandScope = "SPECIFIC"; usersUpdated = true; }
                            if (u.FullName != newTitle) { u.FullName = newTitle; usersUpdated = true; }
                            if (!existingUserBrands.Any(ub => ub.UserId == u.Id && ub.BrandId == brandId))
                            {
                                context.UserBrands.Add(new UserBrand { UserId = u.Id, BrandId = brandId });
                                usersUpdated = true;
                            }
                        }
                    }

                    void SetUserAllBrands(string username, string newTitle)
                    {
                        var u = users.FirstOrDefault(x => x.Username == username);
                        if (u != null)
                        {
                            if (u.BrandScope != "ALL") { u.BrandScope = "ALL"; usersUpdated = true; }
                            if (u.FullName != newTitle) { u.FullName = newTitle; usersUpdated = true; }
                        }
                    }

                    // Auditors with specific brands
                    MapUserToBrand("somchai", ubBrand.Id, "คุณสมชาย ใจดี (Lead QA - Urban Burger)");
                    MapUserToBrand("sarah", clBrand.Id, "Sarah Wong (Lead QA - Cafe Luna)");
                    MapUserToBrand("john", abBrand.Id, "John Doe (Senior QA - Artisan Bakery)");
                    MapUserToBrand("miketan", ubBrand.Id, "Mike Tan (Field QA - Urban Burger)");
                    MapUserToBrand("anan", ubBrand.Id, "นายอนันต์ รักษ์ดี (Southern QA - Urban Burger)");
                    MapUserToBrand("somchaik", abBrand.Id, "นายสมชาย ขจรเกียรติ (Eastern QA - Artisan Bakery)");

                    // Auditors / Admins with ALL brands
                    SetUserAllBrands("admin", "ผู้ดูแลระบบสูงสุด (System Admin - ทุกแบรนด์)");
                    SetUserAllBrands("krit", "นายกฤษณ์ พร้อมใจ (Regional QA - ทุกแบรนด์)");
                    SetUserAllBrands("kanda", "นางกานดา มาตรฐานดี (QA Director - ทุกแบรนด์)");
                    SetUserAllBrands("david", "Mr. David Chen (COO - ทุกแบรนด์)");

                    // Auditees / Store Managers
                    MapUserToBrand("auditee_siam", ubBrand.Id, "นายสมชาย ธนากร (ผจก. Urban Burger - สยามพารากอน)");
                    MapUserToBrand("auditee_sukhumvit", ubBrand.Id, "นายวิชัย รัตนะ (ผจก. Urban Burger - สุขุมวิท 24)");
                    MapUserToBrand("auditee_bangna", ubBrand.Id, "น.ส.ณัฐพร สุขเกษม (ผจก. Urban Burger - เมกาบางนา)");
                    MapUserToBrand("auditee_ladprao", ubBrand.Id, "น.ส.นิภา เกษมสุข (ผจก. Urban Burger - เซ็นทรัลลาดพร้าว)");
                    MapUserToBrand("auditee_chiangmai", ubBrand.Id, "นายพงษ์พันธ์ จันทร์ดี (ผจก. Urban Burger - เซ็นทรัลเชียงใหม่)");
                    MapUserToBrand("auditee_phuket", ubBrand.Id, "นายชูศักดิ์ บุญเรือง (ผจก. Urban Burger - เซ็นทรัลภูเก็ต)");
                    MapUserToBrand("auditee_ari", clBrand.Id, "นายเคน วรพจน์ (ผจก. Cafe Luna - อารีย์)");
                    MapUserToBrand("auditee_pattaya", abBrand.Id, "นางสายใจ บุญช่วย (ผจก. Artisan Bakery - เซ็นทรัลพัทยา)");
                    MapUserToBrand("auditee_rayong", abBrand.Id, "นายธนาคาร มงคล (ผจก. Artisan Bakery - ระยอง)");

                    if (usersUpdated)
                    {
                        context.SaveChanges();
                    }
                }
                Console.WriteLine("[DatabaseSeeder] EnsureBrandAndUserBrandData: Brand scope and mappings verified successfully!");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[DatabaseSeeder] Brand backfill warning: {ex.Message}");
            }
        }

        private static void EnsurePermissionsAndRoles(AppDbContext context)
        {
            try
            {
                var existingPermissions = context.Permissions.ToList();
                var permEdit = existingPermissions.FirstOrDefault(p => p.Code == "audit.edit");
                if (permEdit == null)
                {
                    permEdit = new Permission
                    {
                        Code = "audit.edit",
                        Name = "แก้ไขการตรวจบันทึกที่ส่งแล้ว พร้อมระบุเหตุผล",
                        Module = "Audit"
                    };
                    context.Permissions.Add(permEdit);
                    context.SaveChanges();
                    Console.WriteLine("[DatabaseSeeder] Created missing permission: audit.edit");
                }

                var adminRole = context.Roles.FirstOrDefault(r => r.Code == "ADMIN");
                if (adminRole != null)
                {
                    var hasAdminEdit = context.RolePermissions.Any(rp => rp.RoleId == adminRole.Id && rp.PermissionId == permEdit.Id);
                    if (!hasAdminEdit)
                    {
                        context.RolePermissions.Add(new RolePermission
                        {
                            RoleId = adminRole.Id,
                            PermissionId = permEdit.Id
                        });
                        context.SaveChanges();
                        Console.WriteLine("[DatabaseSeeder] Linked audit.edit to ADMIN role");
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[DatabaseSeeder] EnsurePermissionsAndRoles warning: {ex.Message}");
            }
        }

        private static void EnsureSampleImages(string uploadsDir)
        {
            try
            {
                var capDir = Path.Combine(uploadsDir, "cap_images");
                var auditDir = Path.Combine(uploadsDir, "audit_images");
                Directory.CreateDirectory(capDir);
                Directory.CreateDirectory(auditDir);

                // Find any existing real image to copy from
                var existingCap = Directory.GetFiles(capDir, "*.*")
                    .FirstOrDefault(f => f.EndsWith(".jpg", StringComparison.OrdinalIgnoreCase) || f.EndsWith(".png", StringComparison.OrdinalIgnoreCase));
                var existingAudit = Directory.GetFiles(auditDir, "*.*")
                    .FirstOrDefault(f => f.EndsWith(".jpg", StringComparison.OrdinalIgnoreCase) || f.EndsWith(".png", StringComparison.OrdinalIgnoreCase))
                    ?? existingCap;

                byte[] defaultCapBytes;
                if (existingCap != null && File.Exists(existingCap))
                {
                    defaultCapBytes = File.ReadAllBytes(existingCap);
                }
                else
                {
                    defaultCapBytes = Convert.FromBase64String("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7");
                }

                var capNames = new[] { "after_led_repaired.webp", "after_nsf_containers.webp", "after_blurry_labels.webp", "after_grease_trap_seal.webp" };
                foreach (var name in capNames)
                {
                    var p = Path.Combine(capDir, name);
                    if (!File.Exists(p) || new FileInfo(p).Length == 0)
                    {
                        File.WriteAllBytes(p, defaultCapBytes);
                    }
                }

                byte[] auditBytes = (existingAudit != null && File.Exists(existingAudit)) ? File.ReadAllBytes(existingAudit) : defaultCapBytes;
                var auditNames = new[] { "insect_mesh_damaged.webp", "oil_tpm_high.webp", "kitchen_hairnet_missing.webp", "fire_exit_boxes.webp", "fridge_temp_high.webp", "expired_no_label.webp" };
                foreach (var name in auditNames)
                {
                    var p = Path.Combine(auditDir, name);
                    if (!File.Exists(p) || new FileInfo(p).Length == 0)
                    {
                        File.WriteAllBytes(p, auditBytes);
                    }
                }
                Console.WriteLine("[DatabaseSeeder] Sample upload images verified and populated on disk!");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[DatabaseSeeder] EnsureSampleImages warning: {ex.Message}");
            }
        }
    }
}
