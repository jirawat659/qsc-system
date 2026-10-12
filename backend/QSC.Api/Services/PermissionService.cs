using System.Security.Claims;
using QSC.Api.Data;
using QSC.Api.Helpers;
using QSC.Api.Sso;

namespace QSC.Api.Services;

/// <summary>จุดตัดสินสิทธิ์จุดเดียวของระบบ (แทน UserScopeHelper.HasPermissionAsync ที่เรียกกระจายตาม controller)</summary>
public interface IPermissionService
{
    Task<bool> HasAsync(ClaimsPrincipal user, string permissionCode, CancellationToken ct = default);
}

/// <summary>
/// โหมดการทำงาน:
///  - AuPortal:EnforcePdpPermissions = false (ค่าเริ่มต้น) หรือ session ไม่ได้มาจาก SSO → ใช้ RolePermission ใน DB เหมือนเดิมทุกประการ
///  - EnforcePdpPermissions = true และ session มาจาก SSO (claim auth=sso) → ถาม PDP /check สดทุกครั้ง
///    ไม่ cache, ไม่มี ADMIN bypass (PDP ชนะเสมอ), fail-closed
/// </summary>
public sealed class PermissionService(
    AppDbContext db, PdpClient pdp, IPdpBearerProvider bearer, IConfiguration cfg, ILogger<PermissionService> log)
    : IPermissionService
{
    private const string ObjectIdClaimUri = "http://schemas.microsoft.com/identity/claims/objectidentifier";

    public async Task<bool> HasAsync(ClaimsPrincipal user, string permissionCode, CancellationToken ct = default)
    {
        var viaPdp = user.FindFirst("auth")?.Value == "sso" && cfg.GetValue<bool>("AuPortal:EnforcePdpPermissions", false);
        if (!viaPdp)
        {
            var (_, role, _) = await UserScopeHelper.GetUserScopeAsync(user, db);
            return await UserScopeHelper.HasPermissionAsync(role, permissionCode, db);
        }

        // .NET อาจแปลงชื่อ claim "oid" เป็น URL ยาวตอนอ่านจาก JWT จึงลองทั้งสองชื่อ
        var oid = user.FindFirst("oid")?.Value ?? user.FindFirst(ObjectIdClaimUri)?.Value;
        if (string.IsNullOrWhiteSpace(oid))
        {
            log.LogWarning("PDP check ({Code}) ไม่ได้: session ไม่มี claim oid — ปฏิเสธ", permissionCode);
            return false;
        }

        var token = await bearer.GetAsync(user, ct);
        if (string.IsNullOrWhiteSpace(token))
        {
            log.LogWarning("EnforcePdpPermissions เปิดอยู่ แต่ยังไม่มี Bearer สำหรับเรียก PDP ({Code}) — ปฏิเสธ (fail-closed)", permissionCode);
            return false;
        }

        var decision = await pdp.CheckAsync(oid, permissionCode, null, null, token, ct);
        if (!decision.Allowed)
            log.LogInformation("PDP ปฏิเสธ {Code}: {Reason}", permissionCode, decision.Reason);
        return decision.Allowed;
    }
}
