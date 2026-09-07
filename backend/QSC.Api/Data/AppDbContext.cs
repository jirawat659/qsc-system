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
            // DATABASE INDEXES STRATEGY (10+ Indexes)
            // ==========================================
            modelBuilder.Entity<User>()
                .HasIndex(u => u.Username)
                .IsUnique();

            modelBuilder.Entity<UserLocation>()
                .HasIndex(ul => ul.UserId);

            modelBuilder.Entity<UserLocation>()
                .HasIndex(ul => new { ul.UserId, ul.LocationId })
                .IsUnique();

            modelBuilder.Entity<UserBrand>()
                .HasIndex(ub => ub.UserId);

            modelBuilder.Entity<UserBrand>()
                .HasIndex(ub => new { ub.UserId, ub.BrandId })
                .IsUnique();

            // 🌟 กันผูก Location-Brand ซ้ำคู่เดิม + query .Any() เร็วขึ้นด้วย index เดี่ยว
            modelBuilder.Entity<LocationBrand>()
                .HasIndex(lb => new { lb.LocationId, lb.BrandId })
                .IsUnique();

            modelBuilder.Entity<LocationBrand>()
                .HasIndex(lb => lb.LocationId);

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

            modelBuilder.Entity<CapTask>()
                .HasOne(t => t.AuditResponse)
                .WithMany()
                .HasForeignKey(t => t.AuditResponseId)
                .OnDelete(DeleteBehavior.SetNull);

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