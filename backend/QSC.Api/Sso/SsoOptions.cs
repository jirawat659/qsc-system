namespace QSC.Api.Sso;

/// <summary>bind จาก section "AuPortal" ใน appsettings (ชื่อ key ตรงกับเอกสารสเปค)</summary>
public sealed class SsoOptions
{
    public string Authority { get; set; } = "";          // Issuer ที่ระบุใน Token (เช่น https://au-identity.local/system)
    public string Audience { get; set; } = "";           // Audience ที่ระบุใน Token (เช่น astraops หรือ qsc)
    public string PdpBaseUrl { get; set; } = "";          // ใช้เรียก PDP + derive JWKS
    public string AppCode { get; set; } = "";             // รหัส Application Code
    public string LaunchCallbackPath { get; set; } = "/sso/callback";
    public string? EntraTenantId { get; set; }            // เฉพาะทาง A (ค่ากลางจากทีม AU Portal)
    public string? EntraClientId { get; set; }            // เฉพาะทาง A

    /// <summary>ชื่อ claim ที่ใช้เป็น subject ส่งให้ PDP (สเปคกำหนด "oid") — ปรับได้ถ้า token จริงใช้ชื่ออื่น (ห้ามใช้ email/upn)</summary>
    public string SubjectClaim { get; set; } = "oid";
    /// <summary>เปิดเฉพาะตอนทดสอบ: log ชื่อ claim + iss/aud/อายุ token (ไม่ log ค่าของ claim อื่น)</summary>
    public bool DebugClaims { get; set; } = false;

    public int PdpTimeoutSeconds { get; set; } = 5;
    public int JtiTtlSeconds { get; set; } = 330;         // ต้องมากกว่าอายุ token สูงสุดของทาง B (~300 วิ)

    public string BaseUrl => PdpBaseUrl.TrimEnd('/');
}
