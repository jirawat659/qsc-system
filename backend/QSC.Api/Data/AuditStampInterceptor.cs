using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace QSC.Api.Data
{
    public class AuditStampInterceptor : SaveChangesInterceptor
    {
        private const string VersionColumn = "VersionNumber";

        private readonly IHttpContextAccessor _httpContextAccessor;

        public AuditStampInterceptor(IHttpContextAccessor httpContextAccessor)
        {
            _httpContextAccessor = httpContextAccessor;
        }

        public override InterceptionResult<int> SavingChanges(
            DbContextEventData eventData, InterceptionResult<int> result)
        {
            Stamp(eventData.Context);
            return base.SavingChanges(eventData, result);
        }

        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
        {
            Stamp(eventData.Context);
            return base.SavingChangesAsync(eventData, result, cancellationToken);
        }

        private void Stamp(DbContext? context)
        {
            if (context is null) return;

            var now = DateTime.UtcNow;
            var userId = GetCurrentUserId();

            foreach (var entry in context.ChangeTracker.Entries())
            {
                if (entry.Metadata.FindProperty(VersionColumn) is null) continue;

                // VersionNumber เป็น rowversion ที่ SQL Server จัดการเอง ไม่ต้องเซ็ตที่นี่
                if (entry.State == EntityState.Added)
                {
                    SetIfShadow(entry, "CreatedAt", now);
                    SetIfShadow(entry, "CreatedBy", userId);
                }
                else if (entry.State == EntityState.Modified)
                {
                    SetIfShadow(entry, "UpdatedAt", now);
                    SetIfShadow(entry, "UpdatedBy", userId);
                }
            }
        }

        // เขียนเฉพาะคอลัมน์ที่เป็น shadow property เท่านั้น
        // ตารางที่ประกาศ CreatedAt / UpdatedAt / CreatedBy ไว้เองให้โค้ดเดิมเป็นคนเซ็ตต่อไป
        private static void SetIfShadow(EntityEntry entry, string propertyName, object? value)
        {
            var property = entry.Metadata.FindProperty(propertyName);
            if (property is null || !property.IsShadowProperty()) return;
            entry.Property(propertyName).CurrentValue = value;
        }

        private int? GetCurrentUserId()
        {
            var raw = _httpContextAccessor.HttpContext?.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(raw, out var id) ? id : null;
        }
    }
}
