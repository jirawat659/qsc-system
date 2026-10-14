using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using QSC.Api.Data;
using QSC.Api.Helpers;
using QSC.Api.Services;

namespace QSC.Api.Sso;

[ApiController]
[AllowAnonymous]
[EnableRateLimiting("SsoRateLimit")]
[Route("api/auth/sso")]
public class SsoController(
    AppDbContext db, SsoTokenValidator validator, JtiStore jtiStore, PdpClient pdp, TokenService tokens,
    ILogger<SsoController> log, IActivityLogger activityLogger, IWebHostEnvironment env, IConfiguration config) : ControllerBase
{
    public record SsoTokenDto(string Token);

    /// <summary>ทาง B: token จาก AU Portal launcher (frontend อ่านจาก ?token= แล้วล้าง URL ก่อนเรียก)</summary>
    [HttpPost("launch")]
    public Task<IActionResult> Launch([FromBody] SsoTokenDto dto, CancellationToken ct) => Handle(dto.Token, SsoRoute.Launch, ct);

    /// <summary>ทาง A: token จาก Entra หลังผู้ใช้กด "เข้าสู่ระบบด้วย EntraID"</summary>
    [HttpPost("entra")]
    public Task<IActionResult> Entra([FromBody] SsoTokenDto dto, CancellationToken ct) => Handle(dto.Token, SsoRoute.Entra, ct);

    /// <summary>ค่าเริ่มต้นสำหรับหน้า Login (ไม่มีความลับ): tenant/client id สำหรับ MSAL + flag ว่าเปิดทางไหนบ้าง</summary>
    [HttpGet("config")]
    public IActionResult GetConfig([FromServices] IOptions<SsoOptions> options, [FromServices] IConfiguration cfg)
    {
        var o = options.Value;
        return Ok(new
        {
            entraEnabled = !string.IsNullOrEmpty(o.EntraTenantId) && !string.IsNullOrEmpty(o.EntraClientId),
            tenantId = o.EntraTenantId,
            clientId = o.EntraClientId,
            launcherEnabled = !string.IsNullOrEmpty(o.PdpBaseUrl) && !string.IsNullOrEmpty(o.AppCode),
            passwordLoginEnabled = cfg.GetValue<bool>("Auth:PasswordLoginEnabled", true),
        });
    }

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
        if (!Guid.TryParse(id.Oid, out var oid)) return Unauthorized(new { message = "ข้อมูลยืนยันตัวตนไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่อีกครั้ง", code = "bad_oid" });

        var user = await db.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.EntraOid == oid, ct);
        if (user == null)
            return StatusCode(403, new { message = "บัญชีนี้ยังไม่ได้ผูกกับผู้ใช้งานในระบบ QSC กรุณาติดต่อผู้ดูแลระบบ", code = "account_not_linked" });
        if (!user.IsActive)
            return StatusCode(403, new { message = "บัญชีผู้ใช้นี้ถูกระงับการใช้งานชั่วคราว กรุณาติดต่อผู้ดูแลระบบ", code = "user_inactive" });

        // 4) ถาม PDP — PDP คือผู้ตัดสินเพียงที่เดียว ไม่มี fallback ไปใช้ Role ใน DB ของ QSC (fail-closed)
        var grants = await pdp.GetMyGrantsAsync(id.Oid, token, ct);
        if (!grants.Ok)
        {
            log.LogWarning("SSO PDP my-grants ไม่สำเร็จ ({Error}) — ปฏิเสธ (fail-closed)", grants.Error);
            return StatusCode(503, new { message = "ไม่สามารถตรวจสอบสิทธิ์กับ AU Portal ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง", code = "pdp_unavailable" });
        }
        if (!grants.CanEnter)
            return StatusCode(403, new { message = "คุณไม่มีสิทธิ์เข้าใช้งานระบบ QSC", code = "pdp_deny" });
        var permissions = grants.Permissions.ToList();

        // 5) scope สาขา/แบรนด์ (ของเดิมของ QSC ยังใช้ตามเดิมในเฟสนี้)
        var allowedLocationIds = user.BranchScope == "SPECIFIC"
            ? await db.UserLocations.Where(x => x.UserId == user.Id).Select(x => x.LocationId).ToListAsync(ct) : new List<int>();
        var allowedBrandIds = user.BrandScope == "SPECIFIC"
            ? await db.UserBrands.Where(x => x.UserId == user.Id).Select(x => x.BrandId).ToListAsync(ct) : new List<int>();

        // 6) ออก session ของ QSC เอง แล้วตอบรูปเดิมเหมือน /auth/login เพื่อให้ frontend แทบไม่ต้องแก้
        var roleCode = user.Role?.Code ?? string.Empty;
        var navConfig = RoleNavHelper.ParseOrDefault(user.Role?.NavConfigJson, roleCode);
        var navConfigJson = !string.IsNullOrWhiteSpace(user.Role?.NavConfigJson) ? user.Role!.NavConfigJson : RoleNavHelper.Serialize(navConfig);

        // บันทึกการเข้าระบบลง ActivityLog เหมือนที่ AuthController.Login ทำ (ไม่งั้นการล็อกอินผ่าน SSO จะไม่ปรากฏในประวัติ)
        await activityLogger.LogAsync(user.Id, "LOGIN", "User", user.Id);

        var sessionToken = tokens.Issue(user, roleCode);
        int ssoTtlHours = config.GetValue<int>("AuPortal:SessionTtlHours", 2);
        CookieHelper.AppendSessionCookie(Response, sessionToken, env, ssoTtlHours);

        return Ok(new
        {
            token = sessionToken,
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