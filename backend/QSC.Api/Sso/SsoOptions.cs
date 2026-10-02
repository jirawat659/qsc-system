namespace QSC.Api.Sso;

/// <summary>bind จาก section "AuPortal" ใน appsettings (ชื่อ key ตรงกับเอกสารสเปค)</summary>
public sealed class SsoOptions
{
    public string PdpBaseUrl { get; set; } = "";          // ใช้เรียก PDP + derive JWKS + เป็นค่า iss (ทาง B)
    public string AppCode { get; set; } = "";             // ใช้เรียก PDP + เป็นค่า aud (ทาง B)
    public string LaunchCallbackPath { get; set; } = "/sso/callback";
    public string? EntraTenantId { get; set; }            // เฉพาะทาง A (ค่ากลางจากทีม AU Portal)
    public string? EntraClientId { get; set; }            // เฉพาะทาง A

    public int PdpTimeoutSeconds { get; set; } = 5;
    public int JtiTtlSeconds { get; set; } = 330;         // ต้องมากกว่าอายุ token สูงสุดของทาง B (~300 วิ)

    public string BaseUrl => PdpBaseUrl.TrimEnd('/');
}
