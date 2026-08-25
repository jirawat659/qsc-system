using Microsoft.EntityFrameworkCore;
using QSC.Api.Models;

namespace QSC.Api.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }

        // Domain 1: Users & RBAC (5)
        public DbSet<User> Users => Set<User>();
        public DbSet<UserLocation> UserLocations => Set<UserLocation>();
        public DbSet<Role> Roles => Set<Role>();
        public DbSet<Permission> Permissions => Set<Permission>();
        public DbSet<RolePermission> RolePermissions => Set<RolePermission>();

        // Domain 2: Locations (2)
        public DbSet<LocationType> LocationTypes => Set<LocationType>();
        public DbSet<Location> Locations => Set<Location>();

        // Domain 3: Survey Forms (4)
        public DbSet<SurveyForm> SurveyForms => Set<SurveyForm>();
        public DbSet<SurveyFormTargetLocation> SurveyFormTargetLocations => Set<SurveyFormTargetLocation>();
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

            // ==========================================
            // RELATIONSHIPS & CONSTRAINTS
            // ==========================================
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
                .OnDelete(DeleteBehavior.Cascade);

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
        }
    }
}