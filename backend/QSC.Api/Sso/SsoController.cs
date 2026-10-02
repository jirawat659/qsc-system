using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QSC.Api.Data;
using QSC.Api.Helpers;

namespace QSC.Api.Sso;

[ApiController]
[AllowAnonymous]
[Route("api/auth/sso")]
public class SsoController(
    AppDbContext db, SsoTokenValidator validator, JtiStore jtiStore, PdpClient pdp, TokenService tokens,
    ILogger<SsoController> log) : ControllerBase
{
    public record SsoTokenDto(string Token);

    /// <summary>ทาง B: token จาก AU Portal launcher (frontend อ่านจาก ?token= แล้วล้าง URL ก่อนเรียก)</summary>
    [HttpPost("launch")]
    public Task<IActionResult> Launch([FromBody] SsoTokenDto dto, CancellationToken ct) => Handle(dto.Token, SsoRoute.Launch, ct);

    /// <summary>ทาง A: token จาก Entra หลังผู้ใช้กด "เข้าสู่ระบบด้วย EntraID"</summary>
    [HttpPost("entra")]
    public Task<IActionResult> Entra([FromBody] SsoTokenDto dto, CancellationToken ct) => Handle(dto.Token, SsoRoute.Entra, ct);

    private async Task<IActionResult> Handle(string token, SsoRoute route, CancellationToken ct)
    {
        // 1) validate token (RS256 + JWKS + iss/aud/exp/nbf) — ไม่ log ตัว token
        var v = await validator.ValidateAsync(token, route, ct);
        if (!v.Ok)
        {
            log.LogWarning("SSO[{Route}] ปฏิเสธ: {Reason}", route, v.Error);
            return Unauthorized(new { message = "token ไม่ถูกต้องหรือหมดอายุ กรุณาเข้าใหม่จากหน้า AU Portal", code = v.Error });
        }
        var id = v.Identity!;

        // 2) ทาง B: ใช้ได้ครั้งเดียว (jti)
        if (route == SsoRoute.Launch && !jtiStore.TryConsume(id.Jti!))
        {
            log.LogWarning("SSO[Launch] token ถูกใช้ซ้ำ");
            return Unauthorized(new { message = "token ถูกใช้ไปแล้ว กรุณาเข้าใหม่จากหน้า AU Portal", code = "token_replayed" });
        }

        // 3) หาบัญชีใน QSC ด้วย oid
        if (!Guid.TryParse(id.Oid, out var oid)) return Unauthorized(new { message = "oid ไม่ถูกต้อง", code = "bad_oid" });

        var user = await db.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.EntraOid == oid, ct);
        if (user == null)
            return StatusCode(403, new { message = $"บัญชี Microsoft นี้ยังไม่ได้ผูกกับผู้ใช้ใน QSC (OID ของคุณคือ: {id.Oid}) กรุณาติดต่อผู้ดูแลระบบ", code = "account_not_linked", oid = id.Oid });
        if (!user.IsActive)
            return StatusCode(403, new { message = "บัญชีผู้ใช้นี้ถูกระงับการใช้งานชั่วคราว กรุณาติดต่อผู้ดูแลระบบ", code = "user_inactive" });

        // 4) ถาม PDP (ถ้ามี PDP ออนไลน์ใช้สิทธิ์จาก PDP, ถ้า PDP ยังไม่เปิดช่วงทดลองให้ fallback ไปใช้ Role ใน QSC DB)
        var grants = await pdp.GetMyGrantsAsync(id.Oid, token, ct);
        List<string> permissions;
        if (grants.Ok)
        {
            if (!grants.CanEnter)
                return StatusCode(403, new { message = "คุณไม่มีสิทธิ์เข้าใช้งานระบบ QSC", code = "pdp_deny" });
            permissions = grants.Permissions.ToList();
        }
        else
        {
            log.LogWarning("PDP ไม่พร้อมใช้งาน ({Error}) กำลังใช้สิทธิ์จาก Role ในฐานข้อมูล QSC ชั่วคราวสำหรับการทดสอบ", grants.Error);
            permissions = await db.RolePermissions
                .Where(rp => rp.RoleId == user.RoleId)
                .Include(rp => rp.Permission)
                .Select(rp => rp.Permission!.Code)
                .ToListAsync(ct);
        }

        // 5) scope สาขา/แบรนด์ (ของเดิมของ QSC ยังใช้ตามเดิมในเฟสนี้)
        var allowedLocationIds = user.BranchScope == "SPECIFIC"
            ? await db.UserLocations.Where(x => x.UserId == user.Id).Select(x => x.LocationId).ToListAsync(ct) : new List<int>();
        var allowedBrandIds = user.BrandScope == "SPECIFIC"
            ? await db.UserBrands.Where(x => x.UserId == user.Id).Select(x => x.BrandId).ToListAsync(ct) : new List<int>();

        // 6) ออก session ของ QSC เอง แล้วตอบรูปเดิมเหมือน /auth/login เพื่อให้ frontend แทบไม่ต้องแก้
        var roleCode = user.Role?.Code ?? string.Empty;
        var navConfig = RoleNavHelper.ParseOrDefault(user.Role?.NavConfigJson, roleCode);
        var navConfigJson = !string.IsNullOrWhiteSpace(user.Role?.NavConfigJson) ? user.Role!.NavConfigJson : RoleNavHelper.Serialize(navConfig);

        return Ok(new
        {
            token = tokens.Issue(user, roleCode),
            user = new
            {
                id = user.Id, username = user.Username, fullName = user.FullName,
                role = roleCode, roleName = user.Role?.Name ?? "ผู้ใช้งาน",
                navConfigJson, navConfig,
                branchScope = user.BranchScope, allowedLocationIds,
                brandScope = user.BrandScope, allowedBrandIds,
                mustChangePassword = false,          // SSO ไม่มีรหัสผ่านให้เปลี่ยน
                permissions = permissions,
            },
        });
    }
}
