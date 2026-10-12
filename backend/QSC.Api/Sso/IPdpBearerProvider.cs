using System.Security.Claims;

namespace QSC.Api.Sso;

/// <summary>
/// คืน Bearer ที่ QSC ใช้เรียก PDP (/check) แทนผู้ใช้ปัจจุบัน "หลังเริ่ม session แล้ว"
/// ยังไม่ทราบวิธีที่ถูกต้อง — รอคำตอบจากทีม AU Portal (launch token อายุแค่ ~15-300 วินาที ใช้ต่อไม่ได้)
/// เมื่อรู้แล้วให้เขียนคลาสใหม่ที่ implement interface นี้ (เช่น client credentials / MSAL silent) แล้วเปลี่ยน DI ใน Program.cs
/// </summary>
public interface IPdpBearerProvider
{
    /// <returns>Bearer token หรือ null ถ้าไม่มี (ผู้เรียกต้อง fail-closed)</returns>
    Task<string?> GetAsync(ClaimsPrincipal user, CancellationToken ct);
}

/// <summary>ค่าเริ่มต้น: ยังไม่มีวิธีขอ Bearer — ถ้าเปิด EnforcePdpPermissions ไว้จะปฏิเสธทุกสิทธิ์ของ session SSO</summary>
public sealed class UnconfiguredBearerProvider : IPdpBearerProvider
{
    public Task<string?> GetAsync(ClaimsPrincipal user, CancellationToken ct) => Task.FromResult<string?>(null);
}
