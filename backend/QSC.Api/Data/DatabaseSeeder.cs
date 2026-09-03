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
            var webRoot = env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
            var uploadsDir = Path.Combine(webRoot, "uploads");
            Directory.CreateDirectory(Path.Combine(uploadsDir, "signatures"));
            Directory.CreateDirectory(Path.Combine(uploadsDir, "audit_images"));
            Directory.CreateDirectory(Path.Combine(uploadsDir, "cap_images"));

            context.Database.EnsureCreated();

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

            // Ensure Brand, LocationBrand, and UserBrand data is always synchronized
            EnsureBrandAndUserBrandData(context);

            // Check if already seeded (never wipe existing data if database is already initialized)
            if (!forceRecreate && context.Roles.Any())
            {
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
                new Permission { Code = "menu.dashboard", Name = "เข้าดูหน้าแดชบอร์ดภาพรวม", Module = "Dashboard" },
                new Permission { Code = "dashboard.executive", Name = "ดูข้อมูลภาพรวมระดับผู้บริหาร", Module = "Dashboard" },
                new Permission { Code = "menu.audit", Name = "เข้าเมนูตรวจหน้างานสด", Module = "Audit" },
                new Permission { Code = "audit.start", Name = "เริ่มทำการตรวจประเมิน", Module = "Audit" },
                new Permission { Code = "audit.submit", Name = "ส่งผลการตรวจและลงนาม", Module = "Audit" },
                new Permission { Code = "menu.schedules", Name = "เข้าดูตารางแผนการตรวจ", Module = "Schedule" },
                new Permission { Code = "schedules.manage", Name = "สร้างและแก้ไขนัดหมายตรวจ", Module = "Schedule" },
                new Permission { Code = "menu.forms", Name = "เข้าดูแม่แบบฟอร์มตรวจ", Module = "Form" },
                new Permission { Code = "forms.manage", Name = "สร้างและแก้ไขแบบฟอร์มการตรวจ", Module = "Form" },
                new Permission { Code = "menu.cap", Name = "เข้าดูรายการงานแก้ไข CAP", Module = "CAP" },
                new Permission { Code = "cap.resolve", Name = "ส่งหลักฐานแก้ไขข้อบกพร่อง (สาขา)", Module = "CAP" },
                new Permission { Code = "cap.approve", Name = "ตรวจสอบและอนุมัติปิดงาน CAP (QA)", Module = "CAP" },
                new Permission { Code = "menu.analytics", Name = "เข้าดูรายงานและการวิเคราะห์สถิติ", Module = "Analytics" },
                new Permission { Code = "menu.admin", Name = "เข้าเมนูจัดการระบบ (Admin Panel)", Module = "System" },
                new Permission { Code = "users.manage", Name = "จัดการบัญชีผู้ใช้และรีเซ็ตรหัสผ่าน", Module = "System" },
                new Permission { Code = "roles.manage", Name = "จัดการบทบาทและสิทธิ์การใช้งาน", Module = "System" },
                new Permission { Code = "locations.manage", Name = "จัดการข้อมูลสาขาและประเภทสถานที่", Module = "System" },
                new Permission { Code = "audit.edit", Name = "แก้ไขการตรวจบันทึกที่ส่งแล้ว พร้อมระบุเหตุผล", Module = "Audit"}
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
                new Location { Code = "UB-001", Name = "สาขาสยามพารากอน (Siam Paragon Flagship)", LocationTypeId = storeType.Id, ManagerUserId = auditeeSiam.Id, Latitude = 13.7466, Longitude = 100.5347, Region = "กรุงเทพฯ และปริมณฑล", BrandName = "Urban Burger", Address = "ชั้น G สยามพารากอน ถ.พระราม 1 ปทุมวัน กรุงเทพฯ 10330", Phone = "02-123-4567", LastScore = 98.5, LastAuditDate = now.AddDays(-14) },
                new Location { Code = "UB-002", Name = "สาขาสุขุมวิท 24 (Sukhumvit 24)", LocationTypeId = storeType.Id, ManagerUserId = auditeeSukhumvit.Id, Latitude = 13.7291, Longitude = 100.5678, Region = "กรุงเทพฯ และปริมณฑล", BrandName = "Urban Burger", Address = "ซอยสุขุมวิท 24 คลองตัน คลองเตย กรุงเทพฯ 10110", Phone = "02-234-5678", LastScore = 91.2, LastAuditDate = now.AddDays(-21) },
                new Location { Code = "UB-003", Name = "สาขาเมกาบางนา (Mega Bangna Drive-thru)", LocationTypeId = storeType.Id, ManagerUserId = auditeeBangna.Id, Latitude = 13.6468, Longitude = 100.6802, Region = "กรุงเทพฯ และปริมณฑล", BrandName = "Urban Burger", Address = "ศูนย์การค้าเมกาบางนา ถ.บางนา-ตราด กม.8 สมุทรปราการ 10540", Phone = "02-345-6789", LastScore = 94.8, LastAuditDate = now.AddDays(-13) },
                new Location { Code = "UB-004", Name = "สาขาเซ็นทรัลลาดพร้าว (Central Ladprao)", LocationTypeId = storeType.Id, ManagerUserId = auditeeLadprao.Id, Latitude = 13.8164, Longitude = 100.5611, Region = "กรุงเทพฯ และปริมณฑล", BrandName = "Urban Burger", Address = "ชั้น 3 เซ็นทรัลลาดพร้าว ถ.พหลโยธิน จตุจักร กรุงเทพฯ 10900", Phone = "02-456-7890", LastScore = 86.9, LastAuditDate = now.AddDays(-23) },
                new Location { Code = "UB-005", Name = "สาขาแฟชั่นไอส์แลนด์ (Fashion Island)", LocationTypeId = storeType.Id, Latitude = 13.8247, Longitude = 100.6789, Region = "กรุงเทพฯ และปริมณฑล", BrandName = "Urban Burger", Address = "ชั้น B แฟชั่นไอส์แลนด์ ถ.รามอินทรา คันนายาว กรุงเทพฯ 10230", Phone = "02-567-8901", LastScore = 93.0, LastAuditDate = now.AddDays(-30) },
                new Location { Code = "UB-006", Name = "สาขาเซ็นทรัลเชียงใหม่ (Central Chiang Mai)", LocationTypeId = storeType.Id, ManagerUserId = auditeeChiangmai.Id, Latitude = 18.7997, Longitude = 99.0178, Region = "ภาคเหนือ", BrandName = "Urban Burger", Address = "ชั้น 4 เซ็นทรัลเชียงใหม่ ถ.ซุปเปอร์ไฮเวย์ อ.เมือง จ.เชียงใหม่ 50000", Phone = "053-123-456", LastScore = 96.4, LastAuditDate = now.AddDays(-18) },
                new Location { Code = "UB-007", Name = "สาขาเชียงรายแอร์พอร์ต (Chiang Rai Airport Mall)", LocationTypeId = storeType.Id, Latitude = 19.9520, Longitude = 99.8820, Region = "ภาคเหนือ", BrandName = "Urban Burger", Address = "ชั้น 1 ศูนย์การค้าแอร์พอร์ตพลาซ่า อ.เมือง จ.เชียงราย 57000", Phone = "053-234-567", LastScore = 92.8, LastAuditDate = now.AddDays(-25) },
                new Location { Code = "UB-008", Name = "สาขาเซ็นทรัลภูเก็ต (Central Festival Phuket)", LocationTypeId = storeType.Id, ManagerUserId = auditeePhuket.Id, Latitude = 7.8920, Longitude = 98.3670, Region = "ภาคใต้", BrandName = "Urban Burger", Address = "ชั้น 3 เซ็นทรัลภูเก็ต ถ.วิชิตสงคราม อ.เมือง จ.ภูเก็ต 83000", Phone = "076-123-456", LastScore = 88.4, LastAuditDate = now.AddDays(-22) },
                new Location { Code = "UB-009", Name = "สาขาหาดใหญ่ ลีการ์เดนส์ (Hat Yai Lee Gardens)", LocationTypeId = storeType.Id, Latitude = 7.0068, Longitude = 100.4715, Region = "ภาคใต้", BrandName = "Urban Burger", Address = "ถ.เสน่หานุสรณ์ อ.หาดใหญ่ จ.สงขลา 90110", Phone = "074-234-567", LastScore = 91.0, LastAuditDate = now.AddDays(-35) },
                new Location { Code = "UB-010", Name = "สาขาเซ็นทรัลขอนแก่น (Central Khon Kaen)", LocationTypeId = storeType.Id, Latitude = 16.4320, Longitude = 102.8240, Region = "ภาคตะวันออกเฉียงเหนือ", BrandName = "Urban Burger", Address = "ชั้น G เซ็นทรัลขอนแก่น ถ.ศรีจันทร์ อ.เมือง จ.ขอนแก่น 40000", Phone = "043-123-456", LastScore = 89.5, LastAuditDate = now.AddDays(-32) },
                new Location { Code = "UB-011", Name = "สาขาเทอร์มินอล 21 โคราช (Terminal 21 Korat)", LocationTypeId = storeType.Id, Latitude = 14.9810, Longitude = 102.0980, Region = "ภาคตะวันออกเฉียงเหนือ", BrandName = "Urban Burger", Address = "ชั้น 4 เทอร์มินอล 21 ถ.มิตรภาพ อ.เมือง จ.นครราชสีมา 30000", Phone = "044-234-567", LastScore = 93.2, LastAuditDate = now.AddDays(-29) },

                // --- Cafe Luna ---
                new Location { Code = "CL-001", Name = "สาขาอารีย์ (Ari Craft Yard)", LocationTypeId = storeType.Id, ManagerUserId = auditeeAri.Id, Latitude = 13.7797, Longitude = 100.5447, Region = "กรุงเทพฯ และปริมณฑล", BrandName = "Cafe Luna", Address = "โครงการ ลาวิลล่า พหลโยธิน พญาไท กรุงเทพฯ 10400", Phone = "02-678-9012", LastScore = 97.8, LastAuditDate = now.AddDays(-16) },
                new Location { Code = "CL-002", Name = "สาขาทองหล่อ 13 (Thong Lo 13)", LocationTypeId = storeType.Id, Latitude = 13.7335, Longitude = 100.5822, Region = "กรุงเทพฯ และปริมณฑล", BrandName = "Cafe Luna", Address = "ซอยทองหล่อ 13 สุขุมวิท 55 คลองตันเหนือ วัฒนา กรุงเทพฯ 10110", Phone = "02-789-0123", LastScore = 92.1, LastAuditDate = now.AddDays(-19) },
                new Location { Code = "CL-003", Name = "สาขาสีลมคอมเพล็กซ์ (Silom Complex)", LocationTypeId = storeType.Id, Latitude = 13.7285, Longitude = 100.5348, Region = "กรุงเทพฯ และปริมณฑล", BrandName = "Cafe Luna", Address = "ชั้น 2 สีลมคอมเพล็กซ์ ถ.สีลม บางรัก กรุงเทพฯ 10500", Phone = "02-890-1234", LastScore = 94.0, LastAuditDate = now.AddDays(-24) },
                new Location { Code = "CL-004", Name = "สาขาไอคอนสยาม (IconSiam Riverside)", LocationTypeId = storeType.Id, Latitude = 13.7268, Longitude = 100.5108, Region = "กรุงเทพฯ และปริมณฑล", BrandName = "Cafe Luna", Address = "ชั้น G โซน Veranda ไอคอนสยาม คลองสาน กรุงเทพฯ 10600", Phone = "02-901-2345", LastScore = 95.5, LastAuditDate = now.AddDays(-12) },
                new Location { Code = "CL-005", Name = "สาขานิมมานเชียงใหม่ (Nimman Promenade)", LocationTypeId = storeType.Id, Latitude = 18.7960, Longitude = 98.9680, Region = "ภาคเหนือ", BrandName = "Cafe Luna", Address = "ถนนนิมมานเหมินท์ ซอย 9 ต.สุเทพ อ.เมือง จ.เชียงใหม่ 50200", Phone = "053-345-678", LastScore = 95.9, LastAuditDate = now.AddDays(-17) },
                new Location { Code = "CL-006", Name = "สาขาเซ็นทรัลอุดรธานี (Central Udon Thani)", LocationTypeId = storeType.Id, Latitude = 17.4060, Longitude = 102.7930, Region = "ภาคตะวันออกเฉียงเหนือ", BrandName = "Cafe Luna", Address = "ชั้น 2 เซ็นทรัลอุดรธานี ถ.ประจักษ์ศิลปาคม อ.เมือง จ.อุดรธานี 41000", Phone = "042-123-456", LastScore = 91.8, LastAuditDate = now.AddDays(-27) },

                // --- Artisan Bakery ---
                new Location { Code = "AB-001", Name = "สาขาเอ็มควอเทียร์ (EmQuartier Flagship)", LocationTypeId = storeType.Id, Latitude = 13.7314, Longitude = 100.5698, Region = "กรุงเทพฯ และปริมณฑล", BrandName = "Artisan Bakery", Address = "ชั้น G อาคาร The Glass Quartier เอ็มควอเทียร์ สุขุมวิท กรุงเทพฯ 10110", Phone = "02-012-3456", LastScore = 97.2, LastAuditDate = now.AddDays(-15) },
                new Location { Code = "AB-002", Name = "สาขาเซ็นทรัลพระราม 9 (Central Rama 9)", LocationTypeId = storeType.Id, Latitude = 13.7580, Longitude = 100.5660, Region = "กรุงเทพฯ และปริมณฑล", BrandName = "Artisan Bakery", Address = "ชั้น B เซ็นทรัลพระราม 9 ถ.รัชดาภิเษก ห้วยขวาง กรุงเทพฯ 10310", Phone = "02-123-7890", LastScore = 89.0, LastAuditDate = now.AddDays(-42) },
                new Location { Code = "AB-003", Name = "สาขาเซ็นทรัลพัทยา (Central Pattaya)", LocationTypeId = storeType.Id, ManagerUserId = auditeePattaya.Id, Latitude = 12.9350, Longitude = 100.8830, Region = "ภาคตะวันออก", BrandName = "Artisan Bakery", Address = "ชั้น 1 เซ็นทรัลพัทยาบีช ถ.พัทยาสาย 1 อ.บางละมุง จ.ชลบุรี 20150", Phone = "038-123-456", LastScore = 93.5, LastAuditDate = now.AddDays(-21) },
                new Location { Code = "AB-004", Name = "สาขาระยองซิตี้ (Rayong City Center)", LocationTypeId = storeType.Id, ManagerUserId = auditeeRayong.Id, Latitude = 12.6830, Longitude = 101.2780, Region = "ภาคตะวันออก", BrandName = "Artisan Bakery", Address = "ถ.สุขุมวิท ต.เชิงเนิน อ.เมือง จ.ระยอง 21000", Phone = "038-234-567", LastScore = 84.2, LastAuditDate = now.AddDays(-24) },
                new Location { Code = "AB-005", Name = "สาขาเซ็นทรัลชลบุรี (Central Chonburi)", LocationTypeId = storeType.Id, Latitude = 13.3370, Longitude = 100.9650, Region = "ภาคตะวันออก", BrandName = "Artisan Bakery", Address = "ชั้น 1 เซ็นทรัลชลบุรี ถ.สุขุมวิท อ.เมือง จ.ชลบุรี 20000", Phone = "038-345-678", LastScore = 90.5, LastAuditDate = now.AddDays(-37) },

                // --- Plants & Kitchens & HQ ---
                new Location { Code = "PLANT-01", Name = "โรงงานผลิตและศูนย์แปรรูปบางนา (Bangna Central Kitchen)", LocationTypeId = plantType.Id, Latitude = 13.6682, Longitude = 100.6341, Region = "กรุงเทพฯ และปริมณฑล", BrandName = "Central Supply", Address = "ถ.บางนา-ตราด กม.18 ต.บางโฉลง อ.บางพลี จ.สมุทรปราการ 10540", Phone = "02-456-7890", LastScore = 96.0, LastAuditDate = now.AddDays(-7) },
                new Location { Code = "PLANT-02", Name = "คลังสินค้าและศูนย์กระจายสินค้าอยุธยา (Ayutthaya Logistics Hub)", LocationTypeId = plantType.Id, Latitude = 14.3530, Longitude = 100.5770, Region = "ภาคกลาง", BrandName = "Central Supply", Address = "นิคมอุตสาหกรรมโรจนะ อ.อุทัย จ.พระนครศรีอยุธยา 13210", Phone = "035-123-456", LastScore = 91.5, LastAuditDate = now.AddDays(-10) },
                new Location { Code = "CK-01", Name = "ครัวกลางพัฒนาการ (Pattanakarn Cloud Kitchen)", LocationTypeId = cloudKitchenType.Id, Latitude = 13.7340, Longitude = 100.6280, Region = "กรุงเทพฯ และปริมณฑล", BrandName = "Central Supply", Address = "ถ.พัฒนาการ สวนหลวง กรุงเทพฯ 10250", Phone = "02-321-4567", LastScore = 94.0, LastAuditDate = now.AddDays(-5) },
                new Location { Code = "HQ-01", Name = "สำนักงานใหญ่อโศก (Asoke Headquarters)", LocationTypeId = officeType.Id, Latitude = 13.7380, Longitude = 100.5604, Region = "กรุงเทพฯ และปริมณฑล", BrandName = "QSC Holding", Address = "อาคารเอกซ์เชนจ์ ทาวเวอร์ ถ.สุขุมวิท คลองเตย กรุงเทพฯ 10110", Phone = "02-567-8901", LastScore = 98.0, LastAuditDate = now.AddDays(-60) }
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
                if (string.Equals(loc.Code, "HQ-01", StringComparison.OrdinalIgnoreCase))
                {
                    // HQ-01 เป็น org-wide: ตั้งใจไม่สร้าง LocationBrand
                    continue;
                }

                if (sharedFacilityCodes.Contains(loc.Code))
                {
                    foreach (var brandName in sharedBrandNames)
                    {
                        if (brandIdByName.TryGetValue(brandName, out var brandId))
                        {
                            locationBrandLinks.Add(new LocationBrand
                            {
                                LocationId = loc.Id,
                                BrandId = brandId,
                                IsPrimary = string.Equals(brandName, "Urban Burger", StringComparison.OrdinalIgnoreCase)
                            });
                        }
                    }

                    continue;
                }

                if (brandIdByName.TryGetValue(loc.BrandName ?? string.Empty, out var legacyBrandId))
                {
                    locationBrandLinks.Add(new LocationBrand
                    {
                        LocationId = loc.Id,
                        BrandId = legacyBrandId,
                        IsPrimary = true
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

            var item1_1 = new SurveyItem { SurveySectionId = secCLN.Id, QuestionText = "จุดล้างมือมีสบู่เหลว แอลกอฮอล์ และกระดาษเช็ดมือพร้อมใช้งาน", QuestionType = "YESNO", FullScore = 10.0, IsCritical = false, OrderIndex = 1, IsActive = true };
            var item1_2 = new SurveyItem { SurveySectionId = secCLN.Id, QuestionText = "ตู้เย็นและตู้แช่เย็นควบคุมอุณหภูมิ <= 4.0°C พร้อมบันทึก Log สม่ำเสมอ", QuestionType = "YESNO", FullScore = 15.0, IsCritical = true, OrderIndex = 2, IsActive = true };
            var item1_3 = new SurveyItem { SurveySectionId = secCLN.Id, QuestionText = "ฮูดดูดควัน ตะแกรงดักไขมัน และท่อระบายน้ำพื้นสะอาดปราศจากคราบสะสม", QuestionType = "YESNO", FullScore = 10.0, IsCritical = false, OrderIndex = 3, IsActive = true };
            var item1_4 = new SurveyItem { SurveySectionId = secCLN.Id, QuestionText = "โต๊ะทานอาหาร ภาชนะเครื่องปรุง และหัวจ่ายเครื่องดื่มเช็ดฆ่าเชื้อทุก 2 ชม.", QuestionType = "YESNO", FullScore = 5.0, IsCritical = false, OrderIndex = 4, IsActive = true };

            var item1_5 = new SurveyItem { SurveySectionId = secQLT.Id, QuestionText = "ค่าน้ำมันทอด TPM ไม่เกิน 22% (ตรวจสอบด้วยเครื่องวัดดิจิทัล)", QuestionType = "YESNO", FullScore = 10.0, IsCritical = true, OrderIndex = 1, IsActive = true };
            var item1_6 = new SurveyItem { SurveySectionId = secQLT.Id, QuestionText = "อุณหภูมิแกนกลางของเนื้อสัตว์ปรุงสุกถึง >= 75°C นาน 15 วินาที", QuestionType = "YESNO", FullScore = 15.0, IsCritical = true, OrderIndex = 2, IsActive = true };
            var item1_7 = new SurveyItem { SurveySectionId = secQLT.Id, QuestionText = "วัตถุดิบทั้งหมดติดป้าย FIFO ระบุวันผลิตและวันหมดอายุย่อยชัดเจน", QuestionType = "YESNO", FullScore = 10.0, IsCritical = false, OrderIndex = 3, IsActive = true };

            var item1_8 = new SurveyItem { SurveySectionId = secSVC.Id, QuestionText = "พนักงานต้อนรับกล่าวทักทายภายใน 5 วินาทีด้วยรอยยิ้มและคำทักทายมาตรฐาน", QuestionType = "SCALE", FullScore = 5.0, IsCritical = false, OrderIndex = 1, IsActive = true };
            var item1_9 = new SurveyItem { SurveySectionId = secSVC.Id, QuestionText = "ความเร็วในการเสิร์ฟ (สั่งซื้อจนถึงรับสินค้า) ไม่เกิน 180 วินาที", QuestionType = "SCALE", FullScore = 10.0, IsCritical = false, OrderIndex = 2, IsActive = true };
            var item1_10 = new SurveyItem { SurveySectionId = secSVC.Id, QuestionText = "การแต่งกาย ป้ายชื่อ และหมวกเก็บผมถูกต้องตามระเบียบบริษัท 100%", QuestionType = "YESNO", FullScore = 5.0, IsCritical = false, OrderIndex = 3, IsActive = true };

            var item1_11 = new SurveyItem { SurveySectionId = secSAF.Id, QuestionText = "ทางหนีไฟไม่มีสิ่งกีดขวาง และถังดับเพลิงมีสติกเกอร์ตรวจเช็คประจำเดือน", QuestionType = "YESNO", FullScore = 10.0, IsCritical = true, OrderIndex = 1, IsActive = true };
            var item1_12 = new SurveyItem { SurveySectionId = secSAF.Id, QuestionText = "เงินสดย่อยในลิ้นชักตรงกับรายงานกะ POS โดยไม่มีเงินส่วนเกิน", QuestionType = "SCALE", FullScore = 10.0, IsCritical = false, OrderIndex = 2, IsActive = true };

            context.SurveyItems.AddRange(item1_1, item1_2, item1_3, item1_4, item1_5, item1_6, item1_7, item1_8, item1_9, item1_10, item1_11, item1_12);
            context.SaveChanges();

            // Sections & Items for Form 2 (Plant)
            var secPlant1 = new SurveySection { SurveyFormId = form2.Id, Title = "หมวด 1: มาตรฐาน GMP & สุขลักษณะโรงงาน", OrderIndex = 1, WeightPercent = 50.0, IsActive = true };
            var secPlant2 = new SurveySection { SurveyFormId = form2.Id, Title = "หมวด 2: ระบบความเย็นและสายการผลิตอัตโนมัติ", OrderIndex = 2, WeightPercent = 50.0, IsActive = true };
            context.SurveySections.AddRange(secPlant1, secPlant2);
            context.SaveChanges();

            context.SurveyItems.AddRange(
                new SurveyItem { SurveySectionId = secPlant1.Id, QuestionText = "การควบคุมสัตว์พาหะและตาข่ายดักแมลงทางเข้าไลน์ผลิตสมบูรณ์ 100%", QuestionType = "YESNO", FullScore = 20.0, IsCritical = true, OrderIndex = 1, IsActive = true },
                new SurveyItem { SurveySectionId = secPlant1.Id, QuestionText = "การทำความสะอาดฆ่าเชื้อเครื่องจักร CIP ตามรอบเวลา", QuestionType = "YESNO", FullScore = 15.0, IsCritical = false, OrderIndex = 2, IsActive = true },
                new SurveyItem { SurveySectionId = secPlant2.Id, QuestionText = "ระบบควบคุมอุณหภูมิห้องเย็นกลาง (-22°C ถึง -18°C) บันทึกอัตโนมัติ 24 ชม.", QuestionType = "YESNO", FullScore = 25.0, IsCritical = true, OrderIndex = 1, IsActive = true },
                new SurveyItem { SurveySectionId = secPlant2.Id, QuestionText = "เครื่องตรวจจับโลหะ (Metal Detector) ผ่านการทดสอบ Test Piece ทุก 2 ชม.", QuestionType = "YESNO", FullScore = 20.0, IsCritical = true, OrderIndex = 2, IsActive = true }
            );
            context.SaveChanges();

            // ==========================================
            // 7. SEED AUDIT RECORDS & RESPONSES (14+ Historical Records)
            // ==========================================
            var auditRecords = new List<AuditRecord>
            {
                new AuditRecord { LocationId = locations[0].Id, SurveyFormId = form1.Id, PrimaryAuditorId = auditorSarah.Id, AuditeeUserId = auditeeSiam.Id, AuditDate = now.AddDays(-14), TotalScore = 113.5, MaxScore = 115.0, PercentageScore = 98.5, IsPassed = true, HasCriticalDefect = false, StaffCount = 12, AuditType = "announced", Notes = "สาขาทำผลงานได้ยอดเยี่ยม รักษาความสะอาดและมาตรฐานอุณหภูมิตู้แช่ได้ดีมาก" },
                new AuditRecord { LocationId = locations[11].Id, SurveyFormId = form1.Id, PrimaryAuditorId = auditorJohn.Id, AuditeeUserId = auditeeAri.Id, AuditDate = now.AddDays(-16), TotalScore = 112.5, MaxScore = 115.0, PercentageScore = 97.8, IsPassed = true, HasCriticalDefect = false, StaffCount = 8, AuditType = "announced", Notes = "การบริการรวดเร็ว บาริสต้าต้อนรับดีเยี่ยม มีข้อปรับปรุงเล็กน้อยเรื่องกล่องใส่วัตถุดิบ" },
                new AuditRecord { LocationId = locations[17].Id, SurveyFormId = form1.Id, PrimaryAuditorId = auditorSarah.Id, AuditDate = now.AddDays(-15), TotalScore = 111.8, MaxScore = 115.0, PercentageScore = 97.2, IsPassed = true, HasCriticalDefect = false, StaffCount = 10, AuditType = "announced", Notes = "ครัวสะอาด มาตรฐานเบเกอรี่และการควบคุมอุณหภูมิเตาอบยอดเยี่ยม" },
                new AuditRecord { LocationId = locations[5].Id, SurveyFormId = form1.Id, PrimaryAuditorId = auditorKrit.Id, AuditeeUserId = auditeeChiangmai.Id, AuditDate = now.AddDays(-18), TotalScore = 110.8, MaxScore = 115.0, PercentageScore = 96.4, IsPassed = true, HasCriticalDefect = false, StaffCount = 9, AuditType = "announced", Notes = "มาตรฐาน QSC ครบถ้วน ทีมงานพร้อมเพรียง" },
                new AuditRecord { LocationId = locations[15].Id, SurveyFormId = form1.Id, PrimaryAuditorId = auditorKrit.Id, AuditDate = now.AddDays(-17), TotalScore = 110.3, MaxScore = 115.0, PercentageScore = 95.9, IsPassed = true, HasCriticalDefect = false, StaffCount = 7, AuditType = "announced", Notes = "รักษามาตรฐานความสะอาดได้คงเส้นคงวา" },
                new AuditRecord { LocationId = locations[2].Id, SurveyFormId = form1.Id, PrimaryAuditorId = auditorMike.Id, AuditeeUserId = auditeeBangna.Id, AuditDate = now.AddDays(-13), TotalScore = 109.0, MaxScore = 115.0, PercentageScore = 94.8, IsPassed = true, HasCriticalDefect = false, StaffCount = 14, AuditType = "announced", Notes = "Drive-thru ทำความเร็วได้ดีมาก เปิด CAP ล้างเครื่องทำน้ำแข็ง" },
                new AuditRecord { LocationId = locations[13].Id, SurveyFormId = form1.Id, PrimaryAuditorId = auditorSarah.Id, AuditDate = now.AddDays(-24), TotalScore = 108.1, MaxScore = 115.0, PercentageScore = 94.0, IsPassed = true, HasCriticalDefect = false, StaffCount = 9, AuditType = "announced", Notes = "ระบบจัดคิวมีประสิทธิภาพ พนักงานแต่งกายเรียบร้อย" },
                new AuditRecord { LocationId = locations[19].Id, SurveyFormId = form1.Id, PrimaryAuditorId = auditorSomchaiK.Id, AuditeeUserId = auditeePattaya.Id, AuditDate = now.AddDays(-21), TotalScore = 107.5, MaxScore = 115.0, PercentageScore = 93.5, IsPassed = true, HasCriticalDefect = false, StaffCount = 11, AuditType = "announced", Notes = "การควบคุมกลิ่นและสุขาภิบาลดีมาก" },
                new AuditRecord { LocationId = locations[1].Id, SurveyFormId = form1.Id, PrimaryAuditorId = auditorJohn.Id, AuditeeUserId = auditeeSukhumvit.Id, AuditDate = now.AddDays(-21), TotalScore = 104.9, MaxScore = 115.0, PercentageScore = 91.2, IsPassed = true, HasCriticalDefect = false, StaffCount = 8, AuditType = "announced", Notes = "จุดล้างมือและป้าย FIFO เรียบร้อยดี" },
                new AuditRecord { LocationId = locations[12].Id, SurveyFormId = form1.Id, PrimaryAuditorId = auditorJohn.Id, AuditDate = now.AddDays(-19), TotalScore = 105.9, MaxScore = 115.0, PercentageScore = 92.1, IsPassed = true, HasCriticalDefect = false, StaffCount = 6, AuditType = "announced", Notes = "ต้องสอบเทียบโพรบวัดอุณหภูมิใหม่" },
                new AuditRecord { LocationId = locations[7].Id, SurveyFormId = form1.Id, PrimaryAuditorId = auditorAnan.Id, AuditeeUserId = auditeePhuket.Id, AuditDate = now.AddDays(-22), TotalScore = 101.7, MaxScore = 115.0, PercentageScore = 88.4, IsPassed = false, HasCriticalDefect = true, StaffCount = 10, AuditType = "announced", Notes = "ตรวจพบค่าน้ำมันทอด TPM เกินเกณฑ์ (24.5%) เปิดตั๋ว CAP ด่วนเพื่อเปลี่ยนถ่ายน้ำมันทันที" },
                new AuditRecord { LocationId = locations[3].Id, SurveyFormId = form1.Id, PrimaryAuditorId = auditorMike.Id, AuditeeUserId = auditeeLadprao.Id, AuditDate = now.AddDays(-23), TotalScore = 99.9, MaxScore = 115.0, PercentageScore = 86.9, IsPassed = true, HasCriticalDefect = false, StaffCount = 11, AuditType = "announced", Notes = "ขอบยางประตูตู้แช่แข็งเสื่อมสภาพ เปิดตั๋ว CAP ซ่อมแซม" },
                new AuditRecord { LocationId = locations[20].Id, SurveyFormId = form1.Id, PrimaryAuditorId = auditorSomchaiK.Id, AuditeeUserId = auditeeRayong.Id, AuditDate = now.AddDays(-24), TotalScore = 96.8, MaxScore = 115.0, PercentageScore = 84.2, IsPassed = false, HasCriticalDefect = false, StaffCount = 7, AuditType = "announced", Notes = "คะแนนไม่ถึงเกณฑ์ 85% พนักงานฝึกหัดไม่สวมตาข่ายคลุมผมและทางหนีไฟมีกล่องวางขวาง" },
                new AuditRecord { LocationId = locations[22].Id, SurveyFormId = form2.Id, PrimaryAuditorId = auditorSarah.Id, AuditDate = now.AddDays(-7), TotalScore = 96.0, MaxScore = 100.0, PercentageScore = 96.0, IsPassed = true, HasCriticalDefect = false, StaffCount = 35, AuditType = "announced", Notes = "มาตรฐานการผลิตโรงงานบางนายอดเยี่ยม สายพานและห้องเย็นทำงานสมบูรณ์" }
            };

            context.AuditRecords.AddRange(auditRecords);
            context.SaveChanges();

            // Add responses for each audit record
            foreach (var record in auditRecords)
            {
                var isTop = record.PercentageScore >= 95.0;
                var isFailed = !record.IsPassed;

                context.AuditResponses.AddRange(
                    new AuditResponse { AuditRecordId = record.Id, SurveyItemId = item1_1.Id, ScoreGiven = 10.0, IsPassed = true },
                    new AuditResponse { AuditRecordId = record.Id, SurveyItemId = item1_2.Id, ScoreGiven = isFailed && record.HasCriticalDefect ? 0.0 : 15.0, IsPassed = !(isFailed && record.HasCriticalDefect), Notes = isFailed && record.HasCriticalDefect ? "อุณหภูมิเกินเกณฑ์" : null },
                    new AuditResponse { AuditRecordId = record.Id, SurveyItemId = item1_3.Id, ScoreGiven = 10.0, IsPassed = true },
                    new AuditResponse { AuditRecordId = record.Id, SurveyItemId = item1_4.Id, ScoreGiven = 5.0, IsPassed = true },
                    new AuditResponse { AuditRecordId = record.Id, SurveyItemId = item1_5.Id, ScoreGiven = (record.LocationId == locations[7].Id) ? 0.0 : 10.0, IsPassed = (record.LocationId != locations[7].Id), Notes = (record.LocationId == locations[7].Id) ? "TPM วัดได้ 24.5%" : null },
                    new AuditResponse { AuditRecordId = record.Id, SurveyItemId = item1_6.Id, ScoreGiven = 15.0, IsPassed = true },
                    new AuditResponse { AuditRecordId = record.Id, SurveyItemId = item1_7.Id, ScoreGiven = 10.0, IsPassed = true },
                    new AuditResponse { AuditRecordId = record.Id, SurveyItemId = item1_8.Id, ScoreGiven = isTop ? 5.0 : 4.0, IsPassed = true },
                    new AuditResponse { AuditRecordId = record.Id, SurveyItemId = item1_9.Id, ScoreGiven = isTop ? 10.0 : 8.0, IsPassed = true },
                    new AuditResponse { AuditRecordId = record.Id, SurveyItemId = item1_10.Id, ScoreGiven = isFailed ? 0.0 : 5.0, IsPassed = !isFailed },
                    new AuditResponse { AuditRecordId = record.Id, SurveyItemId = item1_11.Id, ScoreGiven = (record.LocationId == locations[20].Id) ? 0.0 : 10.0, IsPassed = (record.LocationId != locations[20].Id) },
                    new AuditResponse { AuditRecordId = record.Id, SurveyItemId = item1_12.Id, ScoreGiven = 10.0, IsPassed = true }
                );
            }
            context.SaveChanges();

            // ==========================================
            // 8. SEED AUDIT SCHEDULES (Upcoming, In Progress, Completed)
            // ==========================================
            var schedCompleted1 = new AuditSchedule { LocationId = locations[0].Id, SurveyFormId = form1.Id, ScheduledDate = now.AddDays(-14), AuditType = "announced", Status = "completed", Notes = "ตรวจรอบปกติประจำเดือน", CreatedBy = standardKanda.Id, CreatedAt = now.AddMonths(-1) };
            var schedCompleted2 = new AuditSchedule { LocationId = locations[11].Id, SurveyFormId = form1.Id, ScheduledDate = now.AddDays(-16), AuditType = "announced", Status = "completed", Notes = "ตรวจรอบปกติประจำเดือน", CreatedBy = standardKanda.Id, CreatedAt = now.AddMonths(-1) };
            var schedToday = new AuditSchedule { LocationId = locations[4].Id, SurveyFormId = form1.Id, ScheduledDate = now, AuditType = "announced", Status = "in_progress", Notes = "ตรวจประจำวัน สาขาแฟชั่นไอส์แลนด์", CreatedBy = standardKanda.Id, CreatedAt = now.AddDays(-5) };
            var schedUpcoming1 = new AuditSchedule { LocationId = locations[3].Id, SurveyFormId = form1.Id, ScheduledDate = now.AddDays(2), AuditType = "announced", Status = "pending", Notes = "ตรวจรอบปกติและติดตามงานซ่อมขอบยางตู้แช่", CreatedBy = standardKanda.Id, CreatedAt = now.AddDays(-2) };
            var schedUpcoming2 = new AuditSchedule { LocationId = locations[12].Id, SurveyFormId = form1.Id, ScheduledDate = now.AddDays(4), AuditType = "announced", Status = "pending", Notes = "ตรวจ Service & Speed", CreatedBy = standardKanda.Id, CreatedAt = now.AddDays(-2) };
            var schedUpcoming3 = new AuditSchedule { LocationId = locations[20].Id, SurveyFormId = form1.Id, ScheduledDate = now.AddDays(6), AuditType = "followup", Status = "pending", Notes = "ตรวจติดตามผล (Follow-up) ความสะอาดและทางหนีไฟ", CreatedBy = standardKanda.Id, CreatedAt = now.AddDays(-1) };
            var schedUpcoming4 = new AuditSchedule { LocationId = locations[22].Id, SurveyFormId = form2.Id, ScheduledDate = now.AddDays(8), AuditType = "announced", Status = "pending", Notes = "ตรวจ GMP & HACCP โรงงานบางนา", CreatedBy = standardKanda.Id, CreatedAt = now.AddDays(-1) };
            var schedUpcoming5 = new AuditSchedule { LocationId = locations[8].Id, SurveyFormId = form1.Id, ScheduledDate = now.AddDays(10), AuditType = "announced", Status = "pending", Notes = "ตรวจเปิดสาขาใหม่ หาดใหญ่ ลีการ์เดนส์", CreatedBy = standardKanda.Id, CreatedAt = now.AddDays(-1) };

            context.AuditSchedules.AddRange(schedCompleted1, schedCompleted2, schedToday, schedUpcoming1, schedUpcoming2, schedUpcoming3, schedUpcoming4, schedUpcoming5);
            context.SaveChanges();

            context.AuditScheduleAuditors.AddRange(
                new AuditScheduleAuditor { AuditScheduleId = schedCompleted1.Id, AuditorId = auditorSarah.Id, IsLead = true },
                new AuditScheduleAuditor { AuditScheduleId = schedCompleted2.Id, AuditorId = auditorJohn.Id, IsLead = true },
                new AuditScheduleAuditor { AuditScheduleId = schedToday.Id, AuditorId = auditorSomchai.Id, IsLead = true },
                new AuditScheduleAuditor { AuditScheduleId = schedUpcoming1.Id, AuditorId = auditorMike.Id, IsLead = true },
                new AuditScheduleAuditor { AuditScheduleId = schedUpcoming2.Id, AuditorId = auditorJohn.Id, IsLead = true },
                new AuditScheduleAuditor { AuditScheduleId = schedUpcoming3.Id, AuditorId = auditorSomchaiK.Id, IsLead = true },
                new AuditScheduleAuditor { AuditScheduleId = schedUpcoming4.Id, AuditorId = auditorSarah.Id, IsLead = true },
                new AuditScheduleAuditor { AuditScheduleId = schedUpcoming5.Id, AuditorId = auditorAnan.Id, IsLead = true }
            );
            context.SaveChanges();

            // ==========================================
            // 9. SEED CAP TASKS & COMMENTS (Comprehensive Lifecycle)
            // ==========================================
            var cap1 = new CapTask
            {
                AuditRecordId = auditRecords[11].Id, // Ladprao
                LocationId = locations[3].Id,
                IssueItem = "เปลี่ยนขอบยางซิลิโคนประตูตู้แช่แข็งแบบ Walk-in",
                Description = "ขอบยางประตูตู้แช่แข็งชำรุด มีไอน้ำเกาะและอุณหภูมิรั่วไหล ต้องประสานช่างเปลี่ยนขอบยางใหม่",
                SubmissionDeadline = now.AddDays(3),
                Status = "OPEN",
                AssignedTo = auditeeLadprao.Id,
                CreatedAt = now.AddDays(-2)
            };

            var cap2 = new CapTask
            {
                AuditRecordId = auditRecords[9].Id, // Thong Lo
                LocationId = locations[12].Id,
                IssueItem = "สอบเทียบเครื่องวัดอุณหภูมิแบบโพรบดิจิทัล (T-01, T-02)",
                Description = "เครื่องวัดอุณหภูมิอาหารแสดงผลคลาดเคลื่อน +1.5°C ให้ส่งศูนย์สอบเทียบพร้อมแนบเอกสาร Certificate",
                SubmissionDeadline = now.AddDays(7),
                Status = "OPEN",
                CreatedAt = now.AddDays(-3)
            };

            var cap3 = new CapTask
            {
                AuditRecordId = auditRecords[12].Id, // Rayong
                LocationId = locations[20].Id,
                IssueItem = "ติดตั้งไฟฉุกเฉินสำรองและเคลียร์กล่องขวางทางออกประตูด้านหลัง",
                Description = "ทางหนีไฟมีกล่องพัสดุวางซ้อนทับ และไฟฉุกเฉินสำรองแบตเตอรี่เสื่อมสภาพ ต้องแก้ไขทันที",
                SubmissionDeadline = now.AddDays(2),
                Status = "OPEN",
                AssignedTo = auditeeRayong.Id,
                CreatedAt = now.AddDays(-1)
            };

            var cap4 = new CapTask
            {
                AuditRecordId = auditRecords[5].Id, // Mega Bangna
                LocationId = locations[2].Id,
                IssueItem = "ล้างทำความสะอาดเครื่องทำน้ำแข็งและเปลี่ยนไส้กรองน้ำ",
                Description = "เครื่องทำน้ำแข็งมีคราบตะกรันสะสม ต้องทำการ Deep Cleaning และเปลี่ยนไส้กรองประจำรอบ",
                SubmissionDeadline = now.AddDays(5),
                Status = "OPEN",
                AssignedTo = auditeeBangna.Id,
                CreatedAt = now.AddDays(-2)
            };

            var cap5 = new CapTask
            {
                AuditRecordId = auditRecords[0].Id, // Siam Paragon
                LocationId = locations[0].Id,
                IssueItem = "ซ่อมแซมระบบไฟ LED และสายเซนเซอร์ตู้แช่โชว์หน้าร้าน",
                Description = "ไฟ LED ภายในตู้แช่กระพริบและสายไฟเซนเซอร์หย่อนคล้อย",
                SubmissionDeadline = now.AddDays(-1),
                Status = "SUBMITTED",
                AssignedTo = auditeeSiam.Id,
                CreatedAt = now.AddDays(-5)
            };

            var cap6 = new CapTask
            {
                AuditRecordId = auditRecords[1].Id, // Ari
                LocationId = locations[11].Id,
                IssueItem = "เปลี่ยนกล่องใส่วัตถุดิบที่ชำรุดเป็นกล่องมาตรฐาน NSF",
                Description = "พบกล่องพลาสติกใส่วัตถุดิบมีรอยร้าวบริเวณมุมฝาปิด ให้จัดซื้อกล่อง Food Grade NSF ทดแทน",
                SubmissionDeadline = now.AddDays(4),
                Status = "SUBMITTED",
                AssignedTo = auditeeAri.Id,
                CreatedAt = now.AddDays(-4)
            };

            var cap7 = new CapTask
            {
                AuditRecordId = auditRecords[8].Id, // Sukhumvit 24
                LocationId = locations[1].Id,
                IssueItem = "เปลี่ยนขอบยางฝาปิดบ่อดักไขมันป้องกันกลิ่น",
                Description = "ขอบยางฝาบ่อดักไขมันเสื่อมสภาพ ดำเนินการเปลี่ยนขอบยางและซีลซิลิโคนใหม่เรียบร้อย",
                SubmissionDeadline = now.AddDays(-5),
                Status = "CLOSED",
                AssignedTo = auditeeSukhumvit.Id,
                VerifiedBy = auditorJohn.Id,
                CompletedAt = now.AddDays(-6),
                ClosedAt = now.AddDays(-5),
                CreatedAt = now.AddDays(-10)
            };

            var cap8 = new CapTask
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
                CreatedAt = now.AddDays(-12)
            };

            context.CapTasks.AddRange(cap1, cap2, cap3, cap4, cap5, cap6, cap7, cap8);
            context.SaveChanges();

            // Seed CAP Comments for communication audit trail
            context.CapTaskComments.AddRange(
                new CapTaskComment { CapTaskId = cap5.Id, SenderId = auditeeSiam.Id, SenderRole = "AUDITEE", Message = "ช่างอาคารเข้ามาเปลี่ยนหลอดไฟ LED และเก็บสายเซนเซอร์เข้าท่อร้อยสายเรียบร้อยแล้วครับ แนบรูปหลักฐานแล้วครับ", CreatedAt = now.AddDays(-1) },
                new CapTaskComment { CapTaskId = cap5.Id, SenderId = auditorSarah.Id, SenderRole = "QA", Message = "ได้รับรูปภาพหลักฐานเรียบร้อย อยู่ระหว่างการตรวจสอบเพื่ออนุมัติปิดงานค่ะ", CreatedAt = now.AddHours(-12) },
                new CapTaskComment { CapTaskId = cap6.Id, SenderId = auditeeAri.Id, SenderRole = "AUDITEE", Message = "เบิกกล่องมาตรฐาน NSF ใหม่จากคลังกลางจำนวน 6 ใบมาเปลี่ยนแทนกล่องที่ชำรุดเรียบร้อยแล้วครับ", CreatedAt = now.AddDays(-2) },
                new CapTaskComment { CapTaskId = cap7.Id, SenderId = auditeeSukhumvit.Id, SenderRole = "AUDITEE", Message = "เปลี่ยนขอบยางฝาบ่อดักไขมันใหม่เรียบร้อย ไม่มีกลิ่นรบกวน", CreatedAt = now.AddDays(-6) },
                new CapTaskComment { CapTaskId = cap7.Id, SenderId = auditorJohn.Id, SenderRole = "QA", Message = "ตรวจเช็คหน้างานรอบย่อยเรียบร้อย อนุมัติปิดงาน CAP ครับ", CreatedAt = now.AddDays(-5) }
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
                                    BrandId = b.Id,
                                    IsPrimary = (b.Id == ubBrand.Id)
                                });
                                locBrandsAdded = true;
                            }
                        }
                    }
                    else if (loc.Code.StartsWith("UB") || (loc.BrandName != null && loc.BrandName.Contains("Urban")))
                    {
                        if (!existingLocBrands.Any(lb => lb.LocationId == loc.Id && lb.BrandId == ubBrand.Id))
                        {
                            context.LocationBrands.Add(new LocationBrand { LocationId = loc.Id, BrandId = ubBrand.Id, IsPrimary = true });
                            locBrandsAdded = true;
                        }
                    }
                    else if (loc.Code.StartsWith("CL") || (loc.BrandName != null && loc.BrandName.Contains("Luna")))
                    {
                        if (!existingLocBrands.Any(lb => lb.LocationId == loc.Id && lb.BrandId == clBrand.Id))
                        {
                            context.LocationBrands.Add(new LocationBrand { LocationId = loc.Id, BrandId = clBrand.Id, IsPrimary = true });
                            locBrandsAdded = true;
                        }
                    }
                    else if (loc.Code.StartsWith("AB") || (loc.BrandName != null && loc.BrandName.Contains("Artisan")))
                    {
                        if (!existingLocBrands.Any(lb => lb.LocationId == loc.Id && lb.BrandId == abBrand.Id))
                        {
                            context.LocationBrands.Add(new LocationBrand { LocationId = loc.Id, BrandId = abBrand.Id, IsPrimary = true });
                            locBrandsAdded = true;
                        }
                    }
                }
                if (locBrandsAdded) context.SaveChanges();

                // 3. Ensure UserBrand assignments and BrandScope for testing
                var users = context.Users.ToList();
                var existingUserBrands = context.UserBrands.ToList();
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

                Console.WriteLine("[DatabaseSeeder] EnsureBrandAndUserBrandData: Brand scope and mappings verified successfully!");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[DatabaseSeeder] Brand backfill warning: {ex.Message}");
            }
        }
    }
}