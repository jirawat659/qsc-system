using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace QSC.Api.Sso;

public sealed record PdpScope(string Dimension, IReadOnlyList<string> Codes);

public sealed record PdpGrants(bool Ok, IReadOnlyList<string> Permissions, IReadOnlyList<PdpScope> Scopes, string? Error = null)
{
    public static PdpGrants Fail(string error) => new(false, Array.Empty<string>(), Array.Empty<PdpScope>(), error);
    /// <summary>เข้าแอปได้ = PDP ตอบสำเร็จและมีสิทธิ์อย่างน้อย 1 รายการ (สันนิษฐานจากเอกสาร ยืนยันกับทีม AU Portal)</summary>
    public bool CanEnter => Ok && Permissions.Count > 0;
}

public sealed record PdpDecision(bool Allowed, string Reason);

/// <summary>
/// ตัวเรียก PDP ตัวเดียวของระบบ — FAIL-CLOSED: error/timeout/ตอบแปลก = deny เสมอ
/// รูปแบบ response ของ my-grants เป็นข้อสันนิษฐาน แก้ที่ ParseGrants จุดเดียวเมื่อได้ตัวอย่างจริง
/// </summary>
public sealed class PdpClient(HttpClient http, IOptions<SsoOptions> options, ILogger<PdpClient> log)
{
    private readonly SsoOptions _o = options.Value;

    public async Task<PdpGrants> GetMyGrantsAsync(string oid, string bearer, CancellationToken ct)
    {
        try
        {
            using var cts = LinkedTimeout(ct);
            var url = $"{_o.BaseUrl}/api/pdp/my-grants?subject={Uri.EscapeDataString(oid)}&application={Uri.EscapeDataString(_o.AppCode)}";
            using var req = new HttpRequestMessage(HttpMethod.Get, url);
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", bearer);
            using var res = await http.SendAsync(req, cts.Token);
            if (!res.IsSuccessStatusCode) return PdpGrants.Fail($"pdp_http_{(int)res.StatusCode}");
            using var doc = await JsonDocument.ParseAsync(await res.Content.ReadAsStreamAsync(cts.Token), cancellationToken: cts.Token);
            return ParseGrants(doc.RootElement);
        }
        catch (Exception ex)
        {
            log.LogWarning(ex, "PDP my-grants ล้มเหลว (fail-closed)");
            return PdpGrants.Fail("pdp_unavailable");
        }
    }

    /// <summary>ยิงสดทุกครั้ง ห้าม cache</summary>
    public async Task<PdpDecision> CheckAsync(string oid, string action, string? scopeDimension, string? scopeCode,
        string bearer, CancellationToken ct)
    {
        try
        {
            using var cts = LinkedTimeout(ct);
            var body = JsonSerializer.Serialize(new { subject = oid, application = _o.AppCode, action, scopeDimension, scopeCode });
            using var req = new HttpRequestMessage(HttpMethod.Post, $"{_o.BaseUrl}/api/pdp/check")
            { Content = new StringContent(body, Encoding.UTF8, "application/json") };
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", bearer);
            using var res = await http.SendAsync(req, cts.Token);
            if (!res.IsSuccessStatusCode) return new PdpDecision(false, $"pdp_http_{(int)res.StatusCode}");
            using var doc = await JsonDocument.ParseAsync(await res.Content.ReadAsStreamAsync(cts.Token), cancellationToken: cts.Token);
            var root = doc.RootElement;
            var allowed = root.TryGetProperty("allowed", out var a) && a.ValueKind == JsonValueKind.True;
            var reason = root.TryGetProperty("reason", out var r) && r.ValueKind == JsonValueKind.String ? r.GetString()! : "";
            return new PdpDecision(allowed, reason);
        }
        catch (Exception ex)
        {
            log.LogWarning(ex, "PDP check ล้มเหลว (fail-closed)");
            return new PdpDecision(false, "pdp_unavailable");
        }
    }

    // ---- จุดเดียวที่ผูกกับหน้าตา response (สันนิษฐาน): { permissions: [..], scopes: [{dimension, codes:[..]}] } ----
    private static PdpGrants ParseGrants(JsonElement root)
    {
        var perms = new List<string>();
        if (root.TryGetProperty("permissions", out var p) && p.ValueKind == JsonValueKind.Array)
            foreach (var e in p.EnumerateArray())
            {
                if (e.ValueKind == JsonValueKind.String) perms.Add(e.GetString()!);
                else if (e.ValueKind == JsonValueKind.Object && e.TryGetProperty("code", out var c) && c.ValueKind == JsonValueKind.String)
                    perms.Add(c.GetString()!);
            }

        var scopes = new List<PdpScope>();
        if (root.TryGetProperty("scopes", out var s) && s.ValueKind == JsonValueKind.Array)
            foreach (var e in s.EnumerateArray())
                if (e.TryGetProperty("dimension", out var d) && d.ValueKind == JsonValueKind.String
                    && e.TryGetProperty("codes", out var cs) && cs.ValueKind == JsonValueKind.Array)
                    scopes.Add(new PdpScope(d.GetString()!, cs.EnumerateArray().Where(x => x.ValueKind == JsonValueKind.String).Select(x => x.GetString()!).ToList()));

        return new PdpGrants(true, perms, scopes);
    }

    private CancellationTokenSource LinkedTimeout(CancellationToken ct)
    {
        var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        cts.CancelAfter(TimeSpan.FromSeconds(_o.PdpTimeoutSeconds));
        return cts;
    }
}
