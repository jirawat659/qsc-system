using Microsoft.EntityFrameworkCore;
using QSC.Api.Models;

namespace QSC.Api.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }

        // Domain 1: Users & RBAC (6)
        public DbSet<User> Users => Set<User>();
        public DbSet<UserLocation> UserLocations => Set<UserLocation>();
        public DbSet<UserBrand> UserBrands => Set<UserBrand>();
        public DbSet<Role> Roles => Set<Role>();
        public DbSet<Permission> Permissions => Set<Permission>();
        public DbSet<RolePermission> RolePermissions => Set<RolePermission>();

        // Domain 2: Locations & Brands (4)
        public DbSet<LocationType> LocationTypes => Set<LocationType>();
        public DbSet<Location> Locations => Set<Location>();
        public DbSet<Brand> Brands => Set<Brand>();
        public DbSet<LocationBrand> LocationBrands => Set<LocationBrand>();

        // Domain 3: Survey Forms (5)
        public DbSet<SurveyForm> SurveyForms => Set<SurveyForm>();
        public DbSet<SurveyFormTargetLocation> SurveyFormTargetLocations => Set<SurveyFormTargetLocation>();
        public DbSet<SurveyFormBrand> SurveyFormBrands => Set<SurveyFormBrand>();
        public DbSet<SurveySection> SurveySections => Set<SurveySection>();
        public DbSet<SurveyItem> SurveyItems => Set<SurveyItem>();

        // Domain 4: Audit Schedules (2)
        public DbSet<AuditSchedule> AuditSchedules => Set<AuditSchedule>();
        public DbSet<AuditScheduleAuditor> AuditScheduleAuditors => Set<AuditScheduleAuditor>();

        // Domain 5: Live Audit & Records (4)
        public DbSet<AuditDraft> AuditDrafts => Set<AuditDraft>();
        public DbSet<AuditRecord> AuditRecords => Set<AuditRecord>();
        public DbSet<AuditResponse> AuditResponses => Set<AuditResponse>();
        public DbSet<AuditResponseImage> AuditResponseImages => Set<AuditResponseImage>();
        public DbSet<AuditRecordEditLog> AuditRecordEditLogs => Set<AuditRecordEditLog>();

        // Domain 6: CAP Remediation & Chat (3)
        public DbSet<CapTask> CapTasks => Set<CapTask>();
        public DbSet<CapTaskImage> CapTaskImages => Set<CapTaskImage>();
        public DbSet<CapTaskComment> CapTaskComments => Set<CapTaskComment>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // ==========================================
            // STANDARD AUDIT COLUMNS (shadow properties)
            // ค่าถูกเซ็ตโดย AuditStampInterceptor ตอน SaveChanges
            // ==========================================
            // ตารางที่มี property เหล่านี้เป็นของตัวเองอยู่แล้ว (CreatedAt ส่วนใหญ่,
            // SurveyForm/AuditSchedule.CreatedBy ที่เป็น FK, AuditDraft.UpdatedAt) จะใช้ของเดิม
            // และปล่อยให้โค้ดที่มีอยู่เป็นคนเซ็ตค่าเหมือนเดิม
            foreach (var entityType in modelBuilder.Model.GetEntityTypes().ToList())
            {
                var entity = modelBuilder.Entity(entityType.ClrType);

                if (entityType.FindProperty("CreatedBy") is null)
                    entity.Property<int?>("CreatedBy");

                if (entityType.FindProperty("CreatedAt") is null)
                    entity.Property<DateTime>("CreatedAt").HasDefaultValueSql("GETUTCDATE()");

                if (entityType.FindProperty("UpdatedBy") is null)
                    entity.Property<int?>("UpdatedBy");

                if (entityType.FindProperty("UpdatedAt") is null)
                    entity.Property<DateTime?>("UpdatedAt");

                // rowversion — SQL Server เป็นคนเพิ่มค่าเองทุกครั้งที่ row ถูกแก้
                entity.Property<byte[]>("VersionNumber").IsRowVersion();
            }

            // ==========================================
            // ปิด cascade delete ที่ EF ใส่ให้อัตโนมัติกับ FK แบบ required
            // SQL Server ไม่ยอมให้ตารางเดียวถูก cascade ถึงได้หลายเส้นทาง (error 1785)
            // ความสัมพันธ์แบบ parent-child จริงๆ ถูกตั้ง Cascade กลับด้านล่างอีกที
            // ==========================================
            foreach (var fk in modelBuilder.Model.GetEntityTypes().SelectMany(e => e.GetForeignKeys()))
                fk.DeleteBehavior = DeleteBehavior.Restrict;

            // ==========================================
            // STRING LENGTHS
            // SQL Server สร้าง index บน nvarchar(max) ไม่ได้ คอลัมน์ที่ถูก index จึงต้องมีความยาว
            // JSON payload / Notes / Message / QuestionText / Address ปล่อยเป็น nvarchar(max) ตามเดิม
            // ==========================================
            modelBuilder.Entity<User>(e =>
            {
                e.Property(x => x.Username).HasMaxLength(100);
                e.Property(x => x.PasswordHash).HasMaxLength(200);
                e.Property(x => x.FullName).HasMaxLength(200);
                e.Property(x => x.BranchScope).HasMaxLength(20);
                e.Property(x => x.BrandScope).HasMaxLength(20);
            });

            modelBuilder.Entity<Role>(e =>
            {
                e.Property(x => x.Code).HasMaxLength(50);
                e.Property(x => x.Name).HasMaxLength(200);
            });

            modelBuilder.Entity<Permission>(e =>
            {
                e.Property(x => x.Code).HasMaxLength(100);
                e.Property(x => x.Name).HasMaxLength(200);
                e.Property(x => x.Module).HasMaxLength(50);
            });

            modelBuilder.Entity<LocationType>(e =>
            {
                e.Property(x => x.Code).HasMaxLength(50);
                e.Property(x => x.Name).HasMaxLength(200);
            });

            modelBuilder.Entity<Location>(e =>
            {
                e.Property(x => x.Code).HasMaxLength(50);
                e.Property(x => x.Name).HasMaxLength(200);
                e.Property(x => x.Region).HasMaxLength(100);
                e.Property(x => x.Phone).HasMaxLength(50);
            });

            modelBuilder.Entity<Brand>(e =>
            {
                e.Property(x => x.Code).HasMaxLength(50);
                e.Property(x => x.Name).HasMaxLength(200);
            });

            modelBuilder.Entity<SurveyForm>(e =>
            {
                e.Property(x => x.Title).HasMaxLength(300);
                e.Property(x => x.TargetingMode).HasMaxLength(30);
                e.Property(x => x.Version).HasMaxLength(20);
            });

            modelBuilder.Entity<SurveySection>()
                .Property(x => x.Title).HasMaxLength(300);

            modelBuilder.Entity<SurveyItem>(e =>
            {
                e.Property(x => x.QuestionType).HasMaxLength(20);
                e.Property(x => x.CategoryCode).HasMaxLength(20);
                e.Property(x => x.CategoryName).HasMaxLength(100);
            });

            modelBuilder.Entity<AuditSchedule>(e =>
            {
                e.Property(x => x.Time).HasMaxLength(20);
                e.Property(x => x.AuditType).HasMaxLength(20);
                e.Property(x => x.Status).HasMaxLength(20);
            });

            modelBuilder.Entity<AuditRecord>(e =>
            {
                e.Property(x => x.AuditeeNameText).HasMaxLength(200);
                e.Property(x => x.AuditType).HasMaxLength(20);
                e.Property(x => x.AuditorSignatureUrl).HasMaxLength(500);
                e.Property(x => x.AuditeeSignatureUrl).HasMaxLength(500);
            });

            modelBuilder.Entity<AuditResponse>()
                .Property(x => x.CategoryName).HasMaxLength(100);

            modelBuilder.Entity<AuditResponseImage>()
                .Property(x => x.ImageUrl).HasMaxLength(500);

            modelBuilder.Entity<CapTask>(e =>
            {
                e.Property(x => x.IssueItem).HasMaxLength(300);
                e.Property(x => x.Status).HasMaxLength(30);
            });

            modelBuilder.Entity<CapTaskImage>(e =>
            {
                e.Property(x => x.Phase).HasMaxLength(20);
                e.Property(x => x.ImageUrl).HasMaxLength(500);
            });

            modelBuilder.Entity<CapTaskComment>(e =>
            {
                e.Property(x => x.SenderRole).HasMaxLength(20);
                e.Property(x => x.ImageUrl).HasMaxLength(500);
            });

            // ==========================================
            // DATABASE INDEXES STRATEGY (10+ Indexes)
            // ==========================================
            modelBuilder.Entity<User>()
                .HasIndex(u => u.Username)
                .IsUnique();

            // index เดี่ยวบน UserId / LocationId ไม่ต้องมี เพราะเป็น prefix ของ composite ด้านล่างอยู่แล้ว
            modelBuilder.Entity<UserLocation>()
                .HasIndex(ul => new { ul.UserId, ul.LocationId })
                .IsUnique();

            modelBuilder.Entity<UserBrand>()
                .HasIndex(ub => new { ub.UserId, ub.BrandId })
                .IsUnique();

            // 🌟 กันผูก Location-Brand ซ้ำคู่เดิม
            modelBuilder.Entity<LocationBrand>()
                .HasIndex(lb => new { lb.LocationId, lb.BrandId })
                .IsUnique();

            // ค้นจากฝั่ง Brand ต้องมี index ของตัวเอง composite ข้างบนขึ้นต้นด้วย LocationId
            modelBuilder.Entity<LocationBrand>()
                .HasIndex(lb => lb.BrandId);

            modelBuilder.Entity<AuditRecord>()
                .HasIndex(ar => new { ar.LocationId, ar.AuditDate });

            modelBuilder.Entity<AuditRecord>()
                .HasIndex(ar => ar.AuditDate);

            modelBuilder.Entity<AuditScheduleAuditor>()
                .HasIndex(asa => asa.AuditorId);

            modelBuilder.Entity<CapTask>()
                .HasIndex(ct => new { ct.LocationId, ct.Status });

            modelBuilder.Entity<CapTask>()
                .HasIndex(ct => new { ct.AssignedTo, ct.Status });

            modelBuilder.Entity<AuditResponse>()
                .HasIndex(ar => new { ar.SurveyItemId, ar.IsPassed });

            modelBuilder.Entity<AuditResponse>()
                .HasIndex(ar => ar.AuditRecordId);

            modelBuilder.Entity<SurveyItem>()
                .HasIndex(si => si.SurveySectionId);

            modelBuilder.Entity<CapTaskComment>()
                .HasIndex(ctc => ctc.CapTaskId);

            modelBuilder.Entity<AuditRecordEditLog>()
                .HasIndex(l => l.AuditRecordId);

            modelBuilder.Entity<SurveyFormBrand>()
                .HasIndex(sfb => new { sfb.SurveyFormId, sfb.BrandId });

            modelBuilder.Entity<AuditSchedule>()
                .HasIndex(s => new { s.LocationId, s.ScheduledDate });

            modelBuilder.Entity<AuditSchedule>()
                .HasIndex(s => s.ScheduledDate);

            modelBuilder.Entity<AuditScheduleAuditor>()
                .HasIndex(a => new { a.AuditScheduleId, a.AuditorId });

            modelBuilder.Entity<SurveyFormTargetLocation>()
                .HasIndex(t => new { t.SurveyFormId, t.LocationId })
                .IsUnique();

            modelBuilder.Entity<RolePermission>()
                .HasIndex(rp => new { rp.RoleId, rp.PermissionId });

            modelBuilder.Entity<CapTask>()
                .HasIndex(c => c.AuditRecordId);

            // 🌟 หา draft ที่ผู้ตรวจค้างไว้ (ตารางนี้เดิมไม่มี index เลยสักตัว)
            modelBuilder.Entity<AuditDraft>()
                .HasIndex(d => new { d.AuditorId, d.LocationId, d.SurveyFormId });

            modelBuilder.Entity<AuditRecord>()
                .HasIndex(r => r.SurveyFormId);

            // งานตรวจรายผู้ตรวจ เรียงตามวันที่ (AuditController.GetAuditRecords)
            modelBuilder.Entity<AuditRecord>()
                .HasIndex(r => new { r.PrimaryAuditorId, r.AuditDate });

            // GET /api/cap เรียงตาม CreatedAt ภายใต้สาขาที่มีสิทธิ์
            modelBuilder.Entity<CapTask>()
                .HasIndex(c => new { c.LocationId, c.CreatedAt });

            // รายการสาขา เรียง IsActive แล้วตาม Code (LocationController)
            modelBuilder.Entity<Location>()
                .HasIndex(l => new { l.IsActive, l.Code });

            // จัดอันดับสาขาตามคะแนนบน dashboard
            modelBuilder.Entity<Location>()
                .HasIndex(l => new { l.IsActive, l.LastScore });

            modelBuilder.Entity<SurveySection>()
                .HasIndex(s => s.SurveyFormId);

            // composite เดิมขึ้นต้นด้วย SurveyFormId จึงใช้ค้นจาก LocationId ไม่ได้
            modelBuilder.Entity<SurveyFormTargetLocation>()
                .HasIndex(t => t.LocationId);

            modelBuilder.Entity<SurveyForm>()
                .HasIndex(f => new { f.IsActive, f.IsLatest });

            modelBuilder.Entity<AuditSchedule>()
                .HasIndex(s => new { s.Status, s.ScheduledDate });

            modelBuilder.Entity<CapTask>()
                .HasIndex(c => new { c.Status, c.SubmissionDeadline });

            modelBuilder.Entity<Location>().HasIndex(l => l.Code);
            modelBuilder.Entity<Brand>().HasIndex(b => b.Code);
            modelBuilder.Entity<Role>().HasIndex(r => r.Code);
            modelBuilder.Entity<Permission>().HasIndex(p => p.Code);
            modelBuilder.Entity<LocationType>().HasIndex(t => t.Code);

            // ==========================================
            // ผูก navigation property เข้ากับคอลัมน์ FK ที่มีอยู่จริง
            // ชื่อ nav ไม่ตรง convention (Assignee vs AssignedTo) EF จึงเคยสร้างคอลัมน์เงา
            // AssigneeId/VerifierId/UploaderId/CreatorId ที่ไม่มีใครเขียนค่า ทำให้ nav เป็น null ตลอด
            // ==========================================
            modelBuilder.Entity<SurveyForm>()
                .HasOne(f => f.Creator)
                .WithMany()
                .HasForeignKey(f => f.CreatedBy)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<AuditSchedule>()
                .HasOne(s => s.Creator)
                .WithMany()
                .HasForeignKey(s => s.CreatedBy)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<AuditResponseImage>()
                .HasOne(img => img.Uploader)
                .WithMany()
                .HasForeignKey(img => img.UploadedBy)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<CapTask>()
                .HasOne(t => t.Assignee)
                .WithMany()
                .HasForeignKey(t => t.AssignedTo)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<CapTask>()
                .HasOne(t => t.Verifier)
                .WithMany()
                .HasForeignKey(t => t.VerifiedBy)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<CapTaskImage>()
                .HasOne(img => img.Uploader)
                .WithMany()
                .HasForeignKey(img => img.UploadedBy)
                .OnDelete(DeleteBehavior.Restrict);

            // ==========================================
            // RELATIONSHIPS & CONSTRAINTS
            // ==========================================
            modelBuilder.Entity<SurveyFormBrand>()
                .HasOne(sfb => sfb.SurveyForm)
                .WithMany(f => f.FormBrands)
                .HasForeignKey(sfb => sfb.SurveyFormId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<SurveyFormBrand>()
                .HasOne(sfb => sfb.Brand)
                .WithMany()
                .HasForeignKey(sfb => sfb.BrandId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<SurveyForm>()
                .HasOne(f => f.FormGroup)
                .WithMany()
                .HasForeignKey(f => f.FormGroupId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<SurveySection>()
                .HasOne(s => s.SurveyForm)
                .WithMany(f => f.Sections)
                .HasForeignKey(s => s.SurveyFormId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<SurveyItem>()
                .HasOne(i => i.SurveySection)
                .WithMany(s => s.Items)
                .HasForeignKey(i => i.SurveySectionId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<AuditRecord>()
                .HasOne(r => r.PrimaryAuditor)
                .WithMany()
                .HasForeignKey(r => r.PrimaryAuditorId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<AuditScheduleAuditor>()
                .HasOne(a => a.AuditSchedule)
                .WithMany(s => s.Auditors)
                .HasForeignKey(a => a.AuditScheduleId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<AuditScheduleAuditor>()
                .HasOne(a => a.Auditor)
                .WithMany()
                .HasForeignKey(a => a.AuditorId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<AuditRecord>()
                .HasOne(r => r.AuditeeUser)
                .WithMany()
                .HasForeignKey(r => r.AuditeeUserId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<AuditResponse>()
                .HasOne(res => res.AuditRecord)
                .WithMany(r => r.Responses)
                .HasForeignKey(res => res.AuditRecordId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<AuditResponseImage>()
                .HasOne(img => img.AuditResponse)
                .WithMany(res => res.Images)
                .HasForeignKey(img => img.AuditResponseId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<CapTask>()
                .HasOne(t => t.AuditRecord)
                .WithMany()
                .HasForeignKey(t => t.AuditRecordId)
                .OnDelete(DeleteBehavior.SetNull);

            // Restrict ไม่ใช่ SetNull เพราะ AuditRecord ลบถึง CapTask ได้ 2 ทาง
            // (ตรงๆ และผ่าน AuditResponse) ซึ่ง SQL Server ไม่ยอม
            modelBuilder.Entity<CapTask>()
                .HasOne(t => t.AuditResponse)
                .WithMany()
                .HasForeignKey(t => t.AuditResponseId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<CapTaskImage>()
                .HasOne(img => img.CapTask)
                .WithMany(t => t.Images)
                .HasForeignKey(img => img.CapTaskId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<CapTaskComment>()
                .HasOne(c => c.CapTask)
                .WithMany(t => t.Comments)
                .HasForeignKey(c => c.CapTaskId)
                .OnDelete(DeleteBehavior.Cascade);

            // 🌟 ลบ AuditRecord ทิ้ง -> ประวัติแก้ไขของมันหายตามได้ (Cascade)
            // ห้ามลบ User ที่เคยแก้ไขบันทึกไว้ ถ้ายังมี log อ้างอิงอยู่ (Restrict กันข้อมูล audit trail หาย)
            modelBuilder.Entity<AuditRecordEditLog>()
                .HasOne(l => l.AuditRecord)
                .WithMany()
                .HasForeignKey(l => l.AuditRecordId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<AuditRecordEditLog>()
                .HasOne(l => l.EditedByUser)
                .WithMany()
                .HasForeignKey(l => l.EditedByUserId)
                .OnDelete(DeleteBehavior.Restrict);

            // 🌟 Location <-> Brand (M2M ผ่าน LocationBrand)
            // ลบ Location ทิ้ง -> join row หายตามได้เลย (Cascade)
            modelBuilder.Entity<LocationBrand>()
                .HasOne(lb => lb.Location)
                .WithMany(l => l.LocationBrands)
                .HasForeignKey(lb => lb.LocationId)
                .OnDelete(DeleteBehavior.Cascade);

            // ลบ Brand หรือ Location แล้วลบแถว join ที่เกี่ยวข้องตาม (Cascade)
            modelBuilder.Entity<LocationBrand>()
                .HasOne(lb => lb.Brand)
                .WithMany(b => b.LocationBrands)
                .HasForeignKey(lb => lb.BrandId)
                .OnDelete(DeleteBehavior.Cascade);

            // 🌟 User <-> Location / Brand (สิทธิ์การเข้าถึงแบบ SPECIFIC)
            // ลบ User หรือ Location/Brand ทิ้ง -> ผูกสิทธิ์เก่าไม่มีความหมายแล้ว ลบตามได้เลย (Cascade)
            modelBuilder.Entity<UserLocation>()
                .HasOne(ul => ul.User)
                .WithMany(u => u.UserLocations)
                .HasForeignKey(ul => ul.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<UserLocation>()
                .HasOne(ul => ul.Location)
                .WithMany(l => l.UserLocations)
                .HasForeignKey(ul => ul.LocationId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<UserBrand>()
                .HasOne(ub => ub.User)
                .WithMany(u => u.UserBrands)
                .HasForeignKey(ub => ub.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<UserBrand>()
                .HasOne(ub => ub.Brand)
                .WithMany(b => b.UserBrands)
                .HasForeignKey(ub => ub.BrandId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}