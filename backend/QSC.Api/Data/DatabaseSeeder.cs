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
    /// <summary>
    /// เตรียมฐานข้อมูลให้พร้อมใช้งาน — เฉพาะ "การตั้งค่าระบบ" เท่านั้น
    /// (Roles, Permissions, RolePermissions, LocationTypes, บัญชี admin)
    ///
    /// ข้อมูลธุรกิจ (แบรนด์ / สาขา / ฟอร์มตรวจ) ไม่ได้ seed จากที่นี่ — มาจาก
    /// Data/Seed/seed-legacy-master.sql ซึ่งดึงข้อมูลจริงจากระบบ QSC เดิม
    /// ดูวิธีรันได้ที่ Data/Seed/README.md
    ///
    /// ทุก method ในนี้เป็น idempotent (upsert ตาม Code) จึงปลอดภัยที่จะรันทุกครั้งที่แอปสตาร์ท
    /// และจะไม่เขียนทับข้อมูลที่ผู้ใช้แก้ไขเองไว้
    /// </summary>
    public static class DatabaseSeeder
    {
        public static void Initialize(AppDbContext context, IWebHostEnvironment env)
        {
            EnsureUploadDirectories(env);

            try
            {
                context.Database.Migrate();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"⚠️ Database.Migrate warning/error (continuing with seeders): {ex.Message}");
            }

            DedupeLegacyDuplicates(context);
            EnsureRoles(context);
            EnsurePermissions(context);
            EnsureRolePermissions(context);
            EnsureLocationTypes(context);
            EnsureAdminUser(context);
            EnsureDocumentNumbers(context);
            EnsureColumnLengths(context);
        }

        // ==========================================================
        // โฟลเดอร์เก็บไฟล์อัปโหลด
        // ==========================================================
        private static void EnsureUploadDirectories(IWebHostEnvironment env)
        {
            var webRoot = env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
            var uploadsDir = Path.Combine(webRoot, "uploads");
            Directory.CreateDirectory(Path.Combine(uploadsDir, "signatures"));
            Directory.CreateDirectory(Path.Combine(uploadsDir, "audit_images"));
            Directory.CreateDirectory(Path.Combine(uploadsDir, "cap_images"));
        }

        // ==========================================================
        // ซ่อมแถวซ้ำที่เกิดจาก seeder รุ่นก่อน
        //
        // seeder รุ่นก่อนใส่ข้อมูลชุดเดียวกันสองรอบบนฐานข้อมูลเปล่า และ index
        // ของ Code ไม่ได้เป็น unique จึงเกิดแถวซ้ำ (เช่น Brands 10 แถวจาก 5 แบรนด์,
        // permission audit.edit ซ้ำสองแถว) — รวมให้เหลือแถวแรกสุดและย้าย FK ตามไปด้วย
        // ==========================================================
        private static void DedupeLegacyDuplicates(AppDbContext context)
        {
            var removed = 0;

            // ---- Roles
            foreach (var group in context.Roles.ToList().GroupBy(r => r.Code).Where(g => g.Count() > 1))
            {
                var keeper = group.OrderBy(r => r.Id).First();
                foreach (var dup in group.Where(r => r.Id != keeper.Id))
                {
                    foreach (var u in context.Users.Where(u => u.RoleId == dup.Id).ToList())
                        u.RoleId = keeper.Id;
                    RepointOrDrop(context.RolePermissions,
                        rp => rp.RoleId == dup.Id,
                        rp => rp.RoleId = keeper.Id,
                        rp => context.RolePermissions.Any(x => x.RoleId == keeper.Id && x.PermissionId == rp.PermissionId),
                        context);
                    context.Roles.Remove(dup);
                    removed++;
                }
            }

            // ---- Permissions
            foreach (var group in context.Permissions.ToList().GroupBy(p => p.Code).Where(g => g.Count() > 1))
            {
                var keeper = group.OrderBy(p => p.Id).First();
                foreach (var dup in group.Where(p => p.Id != keeper.Id))
                {
                    RepointOrDrop(context.RolePermissions,
                        rp => rp.PermissionId == dup.Id,
                        rp => rp.PermissionId = keeper.Id,
                        rp => context.RolePermissions.Any(x => x.PermissionId == keeper.Id && x.RoleId == rp.RoleId),
                        context);
                    context.Permissions.Remove(dup);
                    removed++;
                }
            }

            // ---- LocationTypes
            foreach (var group in context.LocationTypes.ToList().GroupBy(t => t.Code).Where(g => g.Count() > 1))
            {
                var keeper = group.OrderBy(t => t.Id).First();
                foreach (var dup in group.Where(t => t.Id != keeper.Id))
                {
                    foreach (var loc in context.Locations.Where(l => l.LocationTypeId == dup.Id).ToList())
                        loc.LocationTypeId = keeper.Id;
                    foreach (var form in context.SurveyForms.Where(f => f.LocationTypeId == dup.Id).ToList())
                        form.LocationTypeId = keeper.Id;
                    context.LocationTypes.Remove(dup);
                    removed++;
                }
            }

            // ---- Brands
            foreach (var group in context.Brands.ToList().GroupBy(b => b.Code).Where(g => g.Count() > 1))
            {
                var keeper = group.OrderBy(b => b.Id).First();
                foreach (var dup in group.Where(b => b.Id != keeper.Id))
                {
                    RepointOrDrop(context.LocationBrands,
                        lb => lb.BrandId == dup.Id,
                        lb => lb.BrandId = keeper.Id,
                        lb => context.LocationBrands.Any(x => x.BrandId == keeper.Id && x.LocationId == lb.LocationId),
                        context);
                    RepointOrDrop(context.UserBrands,
                        ub => ub.BrandId == dup.Id,
                        ub => ub.BrandId = keeper.Id,
                        ub => context.UserBrands.Any(x => x.BrandId == keeper.Id && x.UserId == ub.UserId),
                        context);
                    RepointOrDrop(context.SurveyFormBrands,
                        fb => fb.BrandId == dup.Id,
                        fb => fb.BrandId = keeper.Id,
                        fb => context.SurveyFormBrands.Any(x => x.BrandId == keeper.Id && x.SurveyFormId == fb.SurveyFormId),
                        context);
                    foreach (var form in context.SurveyForms.Where(f => f.BrandId == dup.Id).ToList())
                        form.BrandId = keeper.Id;
                    context.Brands.Remove(dup);
                    removed++;
                }
            }

            if (removed > 0)
            {
                context.SaveChanges();
                Console.WriteLine($"[DatabaseSeeder] รวมแถวซ้ำจาก seeder รุ่นก่อน {removed} แถว");
            }
        }

        /// <summary>
        /// ย้ายแถว join ไปชี้ตัวที่เก็บไว้ — ถ้าย้ายแล้วจะซ้ำกับที่มีอยู่ ให้ลบทิ้งแทน
        /// </summary>
        private static void RepointOrDrop<T>(
            Microsoft.EntityFrameworkCore.DbSet<T> set,
            Func<T, bool> match,
            Action<T> repoint,
            Func<T, bool> wouldDuplicate,
            AppDbContext context) where T : class
        {
            foreach (var row in set.ToList().Where(match))
            {
                if (wouldDuplicate(row)) set.Remove(row);
                else repoint(row);
            }
            context.SaveChanges();
        }

        // ==========================================================
        // บทบาท (Roles)
        // ==========================================================
        private static void EnsureRoles(AppDbContext context)
        {
            var defs = new[]
            {
                new Role { Code = "ADMIN",    Name = "ผู้ดูแลระบบ (Admin)",                   Description = "จัดการผู้ใช้ สิทธิ์ และการตั้งค่าระบบทั้งหมด" },
                new Role { Code = "AUDITOR",  Name = "ผู้ตรวจประเมิน (QA Auditor)",           Description = "ลงพื้นที่ตรวจหน้างาน บันทึกผล และเปิดตั๋ว CAP" },
                new Role { Code = "AUDITEE",  Name = "ผู้จัดการสาขา (Store Manager)",         Description = "ดูผลตรวจสาขาตนเอง ชี้แจงและส่งงานแก้ไข CAP" },
                new Role { Code = "STANDARD", Name = "ผู้ดูแลมาตรฐาน (QA Director)",          Description = "สร้างแบบฟอร์ม วางแผนตรวจ และอนุมัติปิดงาน CAP" },
                new Role { Code = "EXEC",     Name = "ผู้บริหารระดับสูง (Executive / COO)",   Description = "ดูสรุปผลภาพรวมและวิเคราะห์สถิติระดับองค์กร" }
            };

            var existing = context.Roles.ToList();
            var changed = false;

            foreach (var def in defs)
            {
                var row = existing.FirstOrDefault(r => r.Code == def.Code);
                if (row == null)
                {
                    def.NavConfigJson = RoleNavHelper.GetDefaultNavConfigJson(def.Code);
                    def.CreatedAt = DateTime.UtcNow;
                    context.Roles.Add(def);
                    changed = true;
                }
                else if (string.IsNullOrWhiteSpace(row.NavConfigJson))
                {
                    // เติม nav config ให้บทบาทเดิมที่ยังว่าง — ไม่แตะค่าที่ผู้ใช้ตั้งเองไว้
                    row.NavConfigJson = RoleNavHelper.GetDefaultNavConfigJson(row.Code);
                    changed = true;
                }
            }

            if (changed) context.SaveChanges();
        }

        // ==========================================================
        // สิทธิ์ (Permissions)
        // ==========================================================
        private static readonly (string Code, string Name, string Module)[] PermissionDefs =
        {
            ("activity.view",       "ดูประวัติกิจกรรมการใช้งานระบบ",                "System"),
            ("audit.delete",        "ลบข้อมูลผลการตรวจประเมิน",                     "Audit"),
            ("audit.edit",          "แก้ไขการตรวจบันทึกที่ส่งแล้ว พร้อมระบุเหตุผล", "Audit"),
            ("audit.reopen",        "ย้อนสถานะผลตรวจที่ส่งแล้วกลับเป็นแบบร่าง",     "Audit"),
            ("audit.start",         "เริ่มทำการตรวจประเมิน",                        "Audit"),
            ("audit.submit",        "ส่งผลการตรวจและลงนาม",                         "Audit"),
            ("cap.approve",         "ตรวจสอบและอนุมัติปิดงาน CAP (QA)",             "CAP"),
            ("cap.resolve",         "ส่งหลักฐานแก้ไขข้อบกพร่อง (สาขา)",             "CAP"),
            ("dashboard.executive", "ดูข้อมูลภาพรวมระดับผู้บริหาร",                 "Dashboard"),
            ("forms.manage",        "สร้างและแก้ไขแบบฟอร์มการตรวจ",                 "Form"),
            ("locations.manage",    "จัดการข้อมูลสาขาและประเภทสถานที่",             "System"),
            ("menu.admin",          "เข้าเมนูจัดการระบบ (Admin Panel)",             "System"),
            ("menu.analytics",      "เข้าดูรายงานและการวิเคราะห์สถิติ",             "Analytics"),
            ("menu.audit",          "เข้าเมนูตรวจหน้างานสด",                        "Audit"),
            ("menu.cap",            "เข้าดูรายการงานแก้ไข CAP",                     "CAP"),
            ("menu.dashboard",      "เข้าดูหน้าแดชบอร์ดภาพรวม",                     "Dashboard"),
            ("menu.forms",          "เข้าดูแม่แบบฟอร์มตรวจ",                        "Form"),
            ("menu.schedules",      "เข้าดูตารางแผนการตรวจ",                        "Schedule"),
            ("roles.manage",        "จัดการบทบาทและสิทธิ์การใช้งาน",                "System"),
            ("schedules.manage",    "สร้างและแก้ไขนัดหมายตรวจ",                     "Schedule"),
            ("users.manage",        "จัดการบัญชีผู้ใช้และรีเซ็ตรหัสผ่าน",           "System")
        };

        private static void EnsurePermissions(AppDbContext context)
        {
            var existing = context.Permissions.ToList();
            var added = false;

            foreach (var (code, name, module) in PermissionDefs)
            {
                if (existing.Any(p => p.Code == code)) continue;
                context.Permissions.Add(new Permission { Code = code, Name = name, Module = module });
                added = true;
            }

            if (added) context.SaveChanges();
        }

        // ==========================================================
        // สิทธิ์ของแต่ละบทบาท
        //
        // ADMIN ได้ทุกสิทธิ์ ส่วนบทบาทอื่นได้ตามรายการด้านล่าง
        // เพิ่มเฉพาะที่ยังไม่มี — สิทธิ์ที่ผู้ดูแลถอดออกเองจะไม่ถูกใส่กลับ
        // ยกเว้น ADMIN ที่ต้องได้ครบเสมอเพื่อไม่ให้ล็อกตัวเองออกจากระบบ
        // ==========================================================
        private static readonly Dictionary<string, string[]> RolePermissionDefs = new()
        {
            ["AUDITOR"] = new[]
            {
                "menu.dashboard", "menu.audit", "audit.start", "audit.submit",
                "menu.schedules", "menu.cap", "cap.approve", "menu.analytics"
            },
            ["AUDITEE"] = new[]
            {
                "menu.dashboard", "menu.cap", "cap.resolve"
            },
            ["STANDARD"] = new[]
            {
                "menu.dashboard", "menu.audit", "menu.schedules", "schedules.manage",
                "menu.forms", "forms.manage", "menu.cap", "cap.approve", "menu.analytics"
            },
            ["EXEC"] = new[]
            {
                "menu.dashboard", "dashboard.executive", "menu.schedules",
                "menu.forms", "menu.cap", "menu.analytics"
            }
        };

        private static void EnsureRolePermissions(AppDbContext context)
        {
            var roleIdByCode = context.Roles.ToDictionary(r => r.Code, r => r.Id);
            var permIdByCode = context.Permissions.ToDictionary(p => p.Code, p => p.Id);
            var existing = context.RolePermissions
                .Select(rp => new { rp.RoleId, rp.PermissionId })
                .ToHashSet();

            var added = false;

            void Grant(string roleCode, IEnumerable<string> permCodes)
            {
                if (!roleIdByCode.TryGetValue(roleCode, out var roleId)) return;
                foreach (var code in permCodes)
                {
                    if (!permIdByCode.TryGetValue(code, out var permId)) continue;
                    if (existing.Contains(new { RoleId = roleId, PermissionId = permId })) continue;
                    context.RolePermissions.Add(new RolePermission { RoleId = roleId, PermissionId = permId });
                    existing.Add(new { RoleId = roleId, PermissionId = permId });
                    added = true;
                }
            }

            Grant("ADMIN", PermissionDefs.Select(p => p.Code));
            foreach (var (roleCode, permCodes) in RolePermissionDefs) Grant(roleCode, permCodes);

            if (added) context.SaveChanges();
        }

        // ==========================================================
        // ประเภทสถานที่
        // ==========================================================
        private static void EnsureLocationTypes(AppDbContext context)
        {
            var defs = new[]
            {
                new LocationType { Code = "STORE",         Name = "สาขาหน้าร้าน (Store / Restaurant)",              Description = "ร้านอาหารและสาขาบริการลูกค้า" },
                new LocationType { Code = "PLANT",         Name = "โรงงานผลิตและคลังสินค้า (Plant & Warehouse)",    Description = "ศูนย์กระจายสินค้าและไลน์แปรรูป" },
                new LocationType { Code = "OFFICE",        Name = "สำนักงานใหญ่ (Headquarters)",                    Description = "ฝ่ายบริหารและศูนย์สนับสนุนงาน" },
                new LocationType { Code = "CLOUD_KITCHEN", Name = "ครัวกลาง (Cloud Kitchen)",                       Description = "ครัวกลางเตรียมวัตถุดิบและเดลิเวอรี" }
            };

            var existing = context.LocationTypes.Select(t => t.Code).ToHashSet();
            var added = false;

            foreach (var def in defs)
            {
                if (existing.Contains(def.Code)) continue;
                context.LocationTypes.Add(def);
                added = true;
            }

            if (added) context.SaveChanges();
        }

        // ==========================================================
        // บัญชีผู้ดูแลระบบตั้งต้น
        //
        // สร้างให้เฉพาะเมื่อยังไม่มีบัญชี admin เท่านั้น จะไม่แตะรหัสผ่าน ชื่อ
        // หรือ scope ของบัญชีที่มีอยู่แล้ว
        // ==========================================================
        private static void EnsureAdminUser(AppDbContext context)
        {
            if (context.Users.Any(u => u.Username == "admin")) return;

            var adminRoleId = context.Roles.Where(r => r.Code == "ADMIN").Select(r => r.Id).FirstOrDefault();
            if (adminRoleId == 0)
            {
                Console.WriteLine("[DatabaseSeeder] ไม่พบบทบาท ADMIN — ข้ามการสร้างบัญชี admin");
                return;
            }

            context.Users.Add(new User
            {
                Username = "admin",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("1234"),
                FullName = "ผู้ดูแลระบบ",
                RoleId = adminRoleId,
                BranchScope = "ALL",
                BrandScope = "ALL",
                MustChangePassword = true,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            });
            context.SaveChanges();

            Console.WriteLine("[DatabaseSeeder] สร้างบัญชี admin ตั้งต้นแล้ว (รหัสผ่าน 1234 — ต้องเปลี่ยนเมื่อเข้าใช้ครั้งแรก)");
        }

        // ==========================================================
        // อัปเดต DocumentNo ย้อนหลังให้ข้อมูลผลตรวจและแบบร่างเดิมที่ยังไม่มีรหัส
        // ==========================================================
        private static void EnsureDocumentNumbers(AppDbContext context)
        {
            try
            {
                // 1. ตรวจสอบและอัปเดต AuditRecords ที่ยังไม่มี DocumentNo
                if (context.AuditRecords.Any(ar => ar.DocumentNo == null))
                {
                    var sqlRecords = @"
                        WITH CTE AS (
                            SELECT 
                                ar.Id,
                                ar.AuditDate,
                                BrandCode = CASE 
                                    WHEN b.Name LIKE N'%ลูกก๊อ%' OR b.Name LIKE '%Lukka%' OR b.Name LIKE '%Lookgaw%' OR l.Code LIKE 'LG%' THEN 'LG'
                                    WHEN b.Name LIKE N'%มิกก้า%' OR b.Name LIKE '%Mikka%' OR l.Code LIKE 'MK%' THEN 'MK'
                                    ELSE 'AU'
                                END,
                                YearMonth = FORMAT(DATEADD(HOUR, 7, ar.AuditDate), 'yyyyMM', 'en-US')
                            FROM AuditRecords ar
                            LEFT JOIN Locations l ON ar.LocationId = l.Id
                            OUTER APPLY (
                                SELECT TOP 1 b.Name 
                                FROM LocationBrands lb 
                                JOIN Brands b ON lb.BrandId = b.Id 
                                WHERE lb.LocationId = l.Id
                            ) b
                        ),
                        Sequenced AS (
                            SELECT 
                                Id,
                                BrandCode,
                                YearMonth,
                                Seq = ROW_NUMBER() OVER (PARTITION BY BrandCode, YearMonth ORDER BY AuditDate ASC, Id ASC)
                            FROM CTE
                        )
                        UPDATE ar
                        SET ar.DocumentNo = s.BrandCode + s.YearMonth + '-' + RIGHT('0000' + CAST(s.Seq AS VARCHAR(10)), 4)
                        FROM AuditRecords ar
                        JOIN Sequenced s ON ar.Id = s.Id
                        WHERE ar.DocumentNo IS NULL;";

                    context.Database.ExecuteSqlRaw(sqlRecords);
                    Console.WriteLine("[DatabaseSeeder] อัปเดต DocumentNo ย้อนหลังให้ผลตรวจเดิมสำเร็จ");
                }

                // 2. ตรวจสอบและอัปเดต AuditDrafts ที่ยังไม่มี DocumentNo
                if (context.AuditDrafts.Any(d => d.DocumentNo == null))
                {
                    var sqlDrafts = @"
                        WITH CTE AS (
                            SELECT 
                                d.Id,
                                d.CreatedAt,
                                BrandCode = CASE 
                                    WHEN b.Name LIKE N'%ลูกก๊อ%' OR b.Name LIKE '%Lukka%' OR b.Name LIKE '%Lookgaw%' OR l.Code LIKE 'LG%' THEN 'LG'
                                    WHEN b.Name LIKE N'%มิกก้า%' OR b.Name LIKE '%Mikka%' OR l.Code LIKE 'MK%' THEN 'MK'
                                    ELSE 'AU'
                                END,
                                YearMonth = FORMAT(DATEADD(HOUR, 7, d.CreatedAt), 'yyyyMM', 'en-US')
                            FROM AuditDrafts d
                            LEFT JOIN Locations l ON d.LocationId = l.Id
                            OUTER APPLY (
                                SELECT TOP 1 b.Name 
                                FROM LocationBrands lb 
                                JOIN Brands b ON lb.BrandId = b.Id 
                                WHERE lb.LocationId = l.Id
                            ) b
                        ),
                        Sequenced AS (
                            SELECT 
                                Id,
                                BrandCode,
                                YearMonth,
                                Seq = ROW_NUMBER() OVER (PARTITION BY BrandCode, YearMonth ORDER BY CreatedAt ASC, Id ASC)
                            FROM CTE
                        )
                        UPDATE d
                        SET d.DocumentNo = 'DRAFT-' + s.BrandCode + s.YearMonth + '-' + RIGHT('0000' + CAST(s.Seq AS VARCHAR(10)), 4)
                        FROM AuditDrafts d
                        JOIN Sequenced s ON d.Id = s.Id
                        WHERE d.DocumentNo IS NULL;";

                    context.Database.ExecuteSqlRaw(sqlDrafts);
                    Console.WriteLine("[DatabaseSeeder] อัปเดต DocumentNo ย้อนหลังให้แบบร่างเดิมสำเร็จ");
                }

                // 3. ปรับปรุง DocumentNo ที่อาจมี พ.ศ. 2569 ให้เป็น ค.ศ. 2026
                context.Database.ExecuteSqlRaw(@"
                    UPDATE AuditDrafts SET DocumentNo = REPLACE(DocumentNo, '2569', '2026') WHERE DocumentNo LIKE '%2569%';
                    UPDATE AuditRecords SET DocumentNo = REPLACE(DocumentNo, '2569', '2026') WHERE DocumentNo LIKE '%2569%';
                ");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[DatabaseSeeder] ไม่สามารถอัปเดต DocumentNo ย้อนหลังได้: {ex.Message}");
            }
        }

        private static void EnsureColumnLengths(AppDbContext context)
        {
            try
            {
                // ขยาย ReopenReason เป็น nvarchar(max) เพื่อไม่จำกัดตัวอักษรและไม่จองพื้นที่ล่วงหน้า
                context.Database.ExecuteSqlRaw(@"
                    IF EXISTS (
                        SELECT 1 FROM sys.columns 
                        WHERE object_id = OBJECT_ID('AuditRecords') 
                          AND name = 'ReopenReason' 
                          AND max_length > 0
                    )
                    BEGIN
                        ALTER TABLE [AuditRecords] ALTER COLUMN [ReopenReason] nvarchar(max) NULL;
                    END
                ");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[DatabaseSeeder] EnsureColumnLengths warning: {ex.Message}");
            }
        }
    }
}
