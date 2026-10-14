using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using QSC.Api.Models;

namespace QSC.Api.Sso;

/// <summary>
/// ออก session JWT ของ QSC (HS256 เหมือน AuthController.Login เดิมทุกประการ)
/// แยกออกมาเพื่อให้ password login กับ SSO ใช้ร่วมกัน — เมื่อ cutover แล้วให้ AuthController เรียกตัวนี้แทนโค้ดซ้ำ
/// </summary>
public sealed class TokenService(IConfiguration config)
{
    public string Issue(User user, string roleCode)
    {
        var key = Encoding.UTF8.GetBytes(config["Jwt:Key"] ?? throw new InvalidOperationException("JWT Key is missing in Configuration!"));
        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Role, roleCode),
            new Claim("auth", "sso"),   // บอกว่า session นี้มาจาก SSO (ใช้แยกจาก password login ในเฟสถัดไป)
        };
        // oid ใช้เรียก PDP ภายหลัง (เช่น /check ก่อน action sensitive)
        if (user.EntraOid is Guid oid) claims.Add(new Claim("oid", oid.ToString()));

        // อายุ session สำหรับ SSO แยกต่างหาก (ค่าเริ่มต้น 2 ชม. หรือกำหนดใน AuPortal:SessionTtlHours)
        int ssoTtlHours = config.GetValue<int>("AuPortal:SessionTtlHours", 2);

        var descriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = DateTime.UtcNow.AddHours(ssoTtlHours),
            Issuer = config["Jwt:Issuer"] ?? "QscApi",
            Audience = config["Jwt:Audience"] ?? "QscFrontend",
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature),
        };
        var handler = new JwtSecurityTokenHandler();
        return handler.WriteToken(handler.CreateToken(descriptor));
    }
}
