using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using QSC.Api.Data;
using QSC.Api.Helpers;
using QSC.Api.Models;
using QSC.Api.Services;

namespace QSC.Api.Sso;

[ApiController]
[AllowAnonymous]
[EnableRateLimiting("SsoRateLimit")]
[Route("api/auth/sso")]
public class SsoController(
    AppDbContext db, SsoTokenValidator validator, JtiStore jtiStore, PdpClient pdp, TokenService tokens,
    IOptions<SsoOptions> options, ILogger<SsoController> log, IActivityLogger activityLogger, IWebHostEnvironment env, IConfiguration config) : ControllerBase
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

        var o = options.Value;

        // 3) หาบัญชีใน QSC (เทียบเฉพาะ 3 ขั้น: Oid -> Id -> Username เท่านั้น ถ้าไม่เจอปฏิเสธทันที):
        User? user = null;

        // ขั้นที่ 1: เทียบ OID / GUID (สำหรับ Microsoft Entra ID)
        if (Guid.TryParse(id.Oid, out var oid))
        {
            var oidStr = oid.ToString();
            user = await db.Users.Include(u => u.Role).FirstOrDefaultAsync(u =>
                u.EntraOid == oid ||
                u.PasswordHash == oidStr ||
                u.PasswordHash == id.Oid, ct);
        }

        // ขั้นที่ 2: เทียบเลข Id ในตาราง Users (ถ้าค่าที่ส่งมาเป็นตัวเลข)
        var lookupId = !string.IsNullOrWhiteSpace(id.Sub) ? id.Sub : id.Oid;
        if (user == null && !string.IsNullOrWhiteSpace(lookupId) && int.TryParse(lookupId, out var numId) && numId > 0)
        {
            user = await db.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.Id == numId, ct);
        }

        // ขั้นที่ 3: เทียบ Username / รหัสพนักงาน (เช่น 10016, admin, U001)
        if (user == null && !string.IsNullOrWhiteSpace(lookupId))
        {
            user = await db.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.Username == lookupId, ct);
        }

        if (user == null)
            return StatusCode(403, new { message = "บัญชีนี้ยังไม่ได้ผูกกับผู้ใช้งานในระบบ QSC กรุณาติดต่อผู้ดูแลระบบ", code = "account_not_linked" });
        if (!user.IsActive)
            return StatusCode(403, new { message = "บัญชีผู้ใช้นี้ถูกระงับการใช้งานชั่วคราว กรุณาติดต่อผู้ดูแลระบบ", code = "user_inactive" });

        // 4) ถาม PDP — PDP คือผู้ตัดสินสิทธิ์และ scope ทั้งหมด 100% (Fail-Closed ไม่มี Fallback)
        var grants = await pdp.GetMyGrantsAsync(id.Oid, token, ct);
        if (!grants.Ok)
        {
            log.LogWarning("SSO PDP my-grants ไม่สำเร็จ ({Error}) — ปฏิเสธ (fail-closed)", grants.Error);
            return StatusCode(503, new { message = "ไม่สามารถตรวจสอบสิทธิ์กับ AU Portal ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง", code = "pdp_unavailable" });
        }

        if (!grants.CanEnter)
            return StatusCode(403, new { message = "คุณไม่มีสิทธิ์เข้าใช้งานระบบ QSC", code = "pdp_deny" });

        var permissions = grants.Permissions.ToList();

        // 5) scope สาขา/แบรนด์ จาก PDP เท่านั้น (ไม่มี fallback ไปใช้ DB — PDP ชนะเสมอตามสเปค)
        string branchScope = "SPECIFIC";
        var allowedLocationIds = new List<int>();
        var locScope = grants.Scopes.FirstOrDefault(s =>
            string.Equals(s.Dimension, "branch", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(s.Dimension, "location", StringComparison.OrdinalIgnoreCase));

        List<Location> matchedLocations = new();
        if (locScope != null && locScope.Codes.Any())
        {
            if (locScope.Codes.Any(c => c == "*" || c == "ALL"))
            {
                branchScope = "ALL";
            }
            else
            {
                branchScope = "SPECIFIC";
                var codes = locScope.Codes.ToList();
                var numericIds = codes.Select(c => int.TryParse(c, out var num) ? num : 0).Where(n => n > 0).ToList();

                // เทียบจาก Code หรือ ID เป็นหลัก ถ้าไม่เจอให้ Fallback เทียบจาก Name (ชื่อสาขา)
                matchedLocations = await db.Locations
                    .Include(l => l.LocationBrands)
                    .Where(l => codes.Contains(l.Code)
                             || (numericIds.Count > 0 && numericIds.Contains(l.Id))
                             || codes.Contains(l.Name))
                    .ToListAsync(ct);
                allowedLocationIds = matchedLocations.Select(l => l.Id).ToList();
            }
        }

        string brandScope = "SPECIFIC";
        var allowedBrandIds = new List<int>();
        var brandScopeItem = grants.Scopes.FirstOrDefault(s =>
            string.Equals(s.Dimension, "brand", StringComparison.OrdinalIgnoreCase));

        // 🌟 กรณีที่ 1: ฝั่ง Portal ส่ง Dimension แบรนด์มาด้วย -> ยึดตามที่ Portal ส่งมาเป็นหลัก 100%
        if (brandScopeItem != null && brandScopeItem.Codes.Any())
        {
            if (brandScopeItem.Codes.Any(c => c == "*" || c == "ALL"))
            {
                brandScope = "ALL";
                allowedBrandIds = new List<int>();
            }
            else
            {
                brandScope = "SPECIFIC";
                var explicitCodes = brandScopeItem.Codes.ToList();
                var numericBrandIds = explicitCodes.Select(c => int.TryParse(c, out var num) ? num : 0).Where(n => n > 0).ToList();

                // เทียบจาก Code หรือ ID เป็นหลัก ถ้าไม่เจอให้ Fallback เทียบจาก Name (ชื่อแบรนด์)
                allowedBrandIds = await db.Brands
                    .Where(b => explicitCodes.Contains(b.Code)
                             || (numericBrandIds.Count > 0 && numericBrandIds.Contains(b.Id))
                             || explicitCodes.Contains(b.Name))
                    .Select(b => b.Id)
                    .ToListAsync(ct);
            }
        }
        // 🌟 กรณีที่ 2: ฝั่ง Portal ไม่ได้ส่ง Dimension แบรนด์มา (ส่งมาแค่สาขา) -> ทำ Fallback ตรวจหาแบรนด์จากสาขาให้อัตโนมัติ
        else
        {
            if (branchScope == "ALL")
            {
                brandScope = "ALL";
                allowedBrandIds = new List<int>();
            }
            else
            {
                // Fallback: ดึงแบรนด์ทั้งหมดที่สาขาที่ได้รับอนุญาตสังกัดอยู่
                allowedBrandIds = matchedLocations
                    .SelectMany(l => l.LocationBrands.Select(lb => lb.BrandId))
                    .Distinct()
                    .ToList();

                brandScope = "SPECIFIC";
            }
        }

        // 6) ออก session ของ QSC เอง แล้วตอบรูปเดิมเหมือน /auth/login เพื่อให้ frontend แทบไม่ต้องแก้
        // ยึด Role จาก PDP เป็นหลัก 100% (ถ้า PDP ส่งมา) ถ้าไม่มีจึง fallback เป็น user.Role?.Code
        var roleCode = (grants.Roles != null && grants.Roles.Any(r => !string.IsNullOrWhiteSpace(r)))
            ? grants.Roles.First(r => !string.IsNullOrWhiteSpace(r))
            : (user.Role?.Code ?? string.Empty);

        var navConfig = RoleNavHelper.ParseOrDefault(user.Role?.NavConfigJson, roleCode);
        var navConfigJson = !string.IsNullOrWhiteSpace(user.Role?.NavConfigJson) ? user.Role!.NavConfigJson : RoleNavHelper.Serialize(navConfig);

        // บันทึกการเข้าระบบลง ActivityLog เหมือนที่ AuthController.Login ทำ (ไม่งั้นการล็อกอินผ่าน SSO จะไม่ปรากฏในประวัติ)
        await activityLogger.LogAsync(user.Id, "LOGIN", "User", user.Id);

        var sessionToken = tokens.Issue(user, roleCode, branchScope, allowedLocationIds, brandScope, allowedBrandIds, permissions);
        int ssoTtlHours = config.GetValue<int>("AuPortal:SessionTtlHours", 2);
        CookieHelper.AppendSessionCookie(Response, sessionToken, env, ssoTtlHours);

        return Ok(new
        {
            token = sessionToken,
            user = new
            {
                id = user.Id, username = user.Username, fullName = user.FullName,
                role = roleCode, roleName = user.Role?.Name ?? roleCode,
                navConfigJson, navConfig,
                branchScope, allowedLocationIds,
                brandScope, allowedBrandIds,
                mustChangePassword = false,          // SSO ไม่มีรหัสผ่านให้เปลี่ยน
                permissions = permissions,
            },
        });
    }
}