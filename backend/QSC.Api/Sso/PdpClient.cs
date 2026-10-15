using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace QSC.Api.Sso;

public sealed record PdpScope(string Dimension, IReadOnlyList<string> Codes);

public sealed record PdpGrants(bool Ok, IReadOnlyList<string> Permissions, IReadOnlyList<PdpScope> Scopes, IReadOnlyList<string>? Roles = null, string? Error = null)
{
    public static PdpGrants Fail(string error) => new(false, Array.Empty<string>(), Array.Empty<PdpScope>(), Array.Empty<string>(), error);
    /// <summary>เข้าแอปได้ = PDP ตอบสำเร็จและมีสิทธิ์อย่างน้อย 1 รายการ (สันนิษฐานจากเอกสาร ยืนยันกับทีม AU Portal)</summary>
    public bool CanEnter => Ok && (Permissions.Count > 0 || (Roles != null && Roles.Count > 0));
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
            var url = $"{_o.BaseUrl}/api/pdp/my-grants?subject={Uri.EscapeDataString(oid)}&application={Uri.EscapeDataString(_o.AppCode)}";
            using var res = await SendWithRetryAsync(() =>
            {
                var r = new HttpRequestMessage(HttpMethod.Get, url);
                r.Headers.Authorization = new AuthenticationHeaderValue("Bearer", bearer);
                return r;
            }, ct);
            if (!res.IsSuccessStatusCode) return PdpGrants.Fail($"pdp_http_{(int)res.StatusCode}");
            using var doc = await JsonDocument.ParseAsync(await res.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
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
            var body = JsonSerializer.Serialize(new { subject = oid, application = _o.AppCode, action, scopeDimension, scopeCode });
            using var res = await SendWithRetryAsync(() =>
            {
                var r = new HttpRequestMessage(HttpMethod.Post, $"{_o.BaseUrl}/api/pdp/check")
                { Content = new StringContent(body, Encoding.UTF8, "application/json") };
                r.Headers.Authorization = new AuthenticationHeaderValue("Bearer", bearer);
                return r;
            }, ct);
            if (!res.IsSuccessStatusCode) return new PdpDecision(false, $"pdp_http_{(int)res.StatusCode}");
            using var doc = await JsonDocument.ParseAsync(await res.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
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

    // ---- แกะข้อมูลจาก Response ของ AU Portal ตามโครงสร้างจริง: { data: { grants: [ { permission, scopes: [ { dimension, code } ] } ] } } ----
    private static PdpGrants ParseGrants(JsonElement root)
    {
        // รองรับทั้งแบบครอบด้วย { "data": { "grants": [ ... ] } } และแบบ flat
        var target = root.TryGetProperty("data", out var dataElem) && dataElem.ValueKind == JsonValueKind.Object
            ? dataElem
            : root;

        var perms = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var scopeMap = new Dictionary<string, HashSet<string>>(StringComparer.OrdinalIgnoreCase);

        // 1. แกะจากโครงสร้างจริงของ AU Portal: data.grants
        if (target.TryGetProperty("grants", out var grantsElem) && grantsElem.ValueKind == JsonValueKind.Array)
        {
            foreach (var g in grantsElem.EnumerateArray())
            {
                if (g.TryGetProperty("permission", out var p) && p.ValueKind == JsonValueKind.String)
                {
                    var pStr = p.GetString()?.Trim();
                    if (!string.IsNullOrEmpty(pStr)) perms.Add(pStr);
                }

                if (g.TryGetProperty("scopes", out var s) && s.ValueKind == JsonValueKind.Array)
                {
                    foreach (var sc in s.EnumerateArray())
                    {
                        string? dim = null;
                        string? code = null;

                        if (sc.TryGetProperty("dimension", out var dProp) && dProp.ValueKind == JsonValueKind.String)
                            dim = dProp.GetString()?.Trim();

                        if (sc.TryGetProperty("code", out var cProp) && cProp.ValueKind == JsonValueKind.String)
                            code = cProp.GetString()?.Trim();

                        if (!string.IsNullOrEmpty(dim) && !string.IsNullOrEmpty(code))
                        {
                            if (!scopeMap.TryGetValue(dim, out var codeSet))
                            {
                                codeSet = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                                scopeMap[dim] = codeSet;
                            }
                            codeSet.Add(code);
                        }
                    }
                }
            }
        }

        // 2. Fallback: รองรับแบบ permissions: [ ... ] และ scopes: [ { dimension, codes: [ ... ] } ]
        if (perms.Count == 0 && target.TryGetProperty("permissions", out var pList) && pList.ValueKind == JsonValueKind.Array)
        {
            foreach (var e in pList.EnumerateArray())
            {
                if (e.ValueKind == JsonValueKind.String) perms.Add(e.GetString()!);
                else if (e.ValueKind == JsonValueKind.Object && e.TryGetProperty("code", out var c) && c.ValueKind == JsonValueKind.String)
                    perms.Add(c.GetString()!);
            }
        }

        if (scopeMap.Count == 0 && target.TryGetProperty("scopes", out var sList) && sList.ValueKind == JsonValueKind.Array)
        {
            foreach (var e in sList.EnumerateArray())
            {
                if (e.TryGetProperty("dimension", out var d) && d.ValueKind == JsonValueKind.String
                    && e.TryGetProperty("codes", out var cs) && cs.ValueKind == JsonValueKind.Array)
                {
                    var dim = d.GetString()!;
                    if (!scopeMap.TryGetValue(dim, out var codeSet))
                    {
                        codeSet = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                        scopeMap[dim] = codeSet;
                    }
                    foreach (var c in cs.EnumerateArray())
                    {
                        if (c.ValueKind == JsonValueKind.String) codeSet.Add(c.GetString()!);
                    }
                }
            }
        }

        var scopes = scopeMap
            .Select(kv => new PdpScope(kv.Key, kv.Value.ToList()))
            .ToList();

        // 3. แกะ roles จาก response (ถ้ามี)
        var roles = new List<string>();
        if (target.TryGetProperty("roles", out var rList) && rList.ValueKind == JsonValueKind.Array)
        {
            foreach (var r in rList.EnumerateArray())
            {
                if (r.ValueKind == JsonValueKind.String)
                {
                    var rStr = r.GetString()?.Trim();
                    if (!string.IsNullOrEmpty(rStr)) roles.Add(rStr);
                }
            }
        }
        else if (root.TryGetProperty("roles", out var rListRoot) && rListRoot.ValueKind == JsonValueKind.Array)
        {
            foreach (var r in rListRoot.EnumerateArray())
            {
                if (r.ValueKind == JsonValueKind.String)
                {
                    var rStr = r.GetString()?.Trim();
                    if (!string.IsNullOrEmpty(rStr)) roles.Add(rStr);
                }
            }
        }

        return new PdpGrants(true, perms.ToList(), scopes, roles);
    }

    // ---- retry เฉพาะความล้มเหลวชั่วคราว (ต่อไม่ติด/timeout/408/502/503/504) ----
    // ลองสูงสุด 3 ครั้ง; หมดแล้วยังไม่สำเร็จ = ปล่อยให้ผู้เรียก fail-closed ตามเดิม
    // เวลารอสูงสุด ≈ 3 × PdpTimeoutSeconds + backoff — ควรตั้ง AuPortal:PdpTimeoutSeconds ไว้ 3–5 วินาที
    private static readonly int[] RetryDelaysMs = { 200, 600 };

    private static bool IsTransient(HttpStatusCode s) =>
        s is HttpStatusCode.RequestTimeout or HttpStatusCode.BadGateway
          or HttpStatusCode.ServiceUnavailable or HttpStatusCode.GatewayTimeout;

    private async Task<HttpResponseMessage> SendWithRetryAsync(Func<HttpRequestMessage> build, CancellationToken ct)
    {
        for (var attempt = 0; ; attempt++)
        {
            var last = attempt >= RetryDelaysMs.Length;
            try
            {
                using var cts = LinkedTimeout(ct);   // timeout ต่อครั้ง
                using var req = build();             // HttpRequestMessage ใช้ซ้ำไม่ได้ ต้องสร้างใหม่ทุกครั้ง
                var res = await http.SendAsync(req, cts.Token);   // buffer เนื้อหาเสร็จก่อน cts ถูก dispose
                if (last || !IsTransient(res.StatusCode)) return res;
                res.Dispose();
            }
            catch (Exception ex) when (!last && !ct.IsCancellationRequested
                                       && (ex is HttpRequestException or OperationCanceledException))
            {
                log.LogWarning(ex, "PDP ล้มเหลวครั้งที่ {Attempt} — จะลองใหม่", attempt + 1);
            }
            await Task.Delay(RetryDelaysMs[attempt] + Random.Shared.Next(0, 150), ct);   // backoff + jitter
        }
    }

    private CancellationTokenSource LinkedTimeout(CancellationToken ct)
    {
        var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        cts.CancelAfter(TimeSpan.FromSeconds(_o.PdpTimeoutSeconds));
        return cts;
    }
}