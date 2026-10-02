using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace QSC.Api.Sso;

public enum SsoRoute { Launch, Entra }

public sealed record SsoIdentity(string Oid, string? Jti, SsoRoute Route);

public sealed record SsoValidation(SsoIdentity? Identity, string? Error)
{
    public bool Ok => Identity != null;
    public static SsoValidation Fail(string error) => new(null, error);
}

/// <summary>
/// ตรวจ token ขาเข้าของทั้งสองทาง: รับเฉพาะ RS256, ตรวจ iss/aud/exp/nbf ผ่าน JWKS
/// แยกจาก JwtBearer ของ QSC (ซึ่งใช้ HS256 กับ session token ของตัวเอง) โดยสิ้นเชิง
/// </summary>
public sealed class SsoTokenValidator(
    IHttpClientFactory httpFactory, IMemoryCache cache, IOptions<SsoOptions> options, ILogger<SsoTokenValidator> log)
{
    private static readonly string[] AllowedAlgs = { SecurityAlgorithms.RsaSha256 }; // "RS256" เท่านั้น
    private static readonly TimeSpan MinRefreshInterval = TimeSpan.FromSeconds(30);   // กันถูกยิงให้ดึง JWKS รัวๆ
    private readonly SsoOptions _o = options.Value;
    private readonly JsonWebTokenHandler _handler = new();

    private sealed record JwksEntry(IList<SecurityKey> Keys, DateTimeOffset FetchedAt);

    public async Task<SsoValidation> ValidateAsync(string? token, SsoRoute route, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(token)) return SsoValidation.Fail("missing_token");

        string issuer, audience, jwksUrl;
        if (route == SsoRoute.Launch)
        {
            if (string.IsNullOrEmpty(_o.PdpBaseUrl) || string.IsNullOrEmpty(_o.AppCode))
                return SsoValidation.Fail("launch_not_configured");
            issuer = _o.BaseUrl;
            audience = _o.AppCode;                       // aud ต้องเป็น AppCode ของแอปเราเอง
            jwksUrl = $"{_o.BaseUrl}/api/auth/jwks";
        }
        else
        {
            if (string.IsNullOrEmpty(_o.EntraTenantId) || string.IsNullOrEmpty(_o.EntraClientId))
                return SsoValidation.Fail("entra_not_configured");
            issuer = $"https://login.microsoftonline.com/{_o.EntraTenantId}/v2.0";
            audience = _o.EntraClientId;                 // ค่ากลางเดียวกับ AU Portal ทุกแอป
            jwksUrl = $"https://login.microsoftonline.com/{_o.EntraTenantId}/discovery/v2.0/keys";
        }

        // ด่านแรก: เช็ค alg ก่อนแตะ key ใดๆ (ปฏิเสธ none / HS*)
        JsonWebToken jwt;
        try { jwt = _handler.ReadJsonWebToken(token); }
        catch { return SsoValidation.Fail("malformed"); }
        if (jwt.Alg != SecurityAlgorithms.RsaSha256) return SsoValidation.Fail("alg_not_allowed");

        IList<SecurityKey> keys;
        try { keys = await GetKeysAsync(jwksUrl, force: false, ct); }
        catch (Exception ex) { log.LogWarning(ex, "SSO: โหลด JWKS ไม่ได้"); return SsoValidation.Fail("jwks_unavailable"); }

        var result = await _handler.ValidateTokenAsync(token, BuildParams(issuer, audience, keys));

        // key อาจเพิ่งหมุน (rotate): ลองดึง JWKS ใหม่ 1 ครั้งแล้วตรวจซ้ำ
        if (!result.IsValid && result.Exception is SecurityTokenSignatureKeyNotFoundException or SecurityTokenInvalidSignatureException)
        {
            try
            {
                var fresh = await GetKeysAsync(jwksUrl, force: true, ct);
                if (!ReferenceEquals(fresh, keys))
                    result = await _handler.ValidateTokenAsync(token, BuildParams(issuer, audience, fresh));
            }
            catch (Exception ex) { log.LogWarning(ex, "SSO: refresh JWKS ไม่ได้"); }
        }

        if (!result.IsValid) return SsoValidation.Fail(Classify(result.Exception));

        // subject ต้องเป็น oid เท่านั้น (ห้าม email/upn)
        if (!result.Claims.TryGetValue("oid", out var oidObj) || oidObj is not string oid || string.IsNullOrWhiteSpace(oid))
            return SsoValidation.Fail("missing_oid");

        string? jti = result.Claims.TryGetValue("jti", out var j) ? j as string : null;
        if (route == SsoRoute.Launch && string.IsNullOrEmpty(jti)) return SsoValidation.Fail("missing_jti");

        return new SsoValidation(new SsoIdentity(oid, jti, route), null);
    }

    private static TokenValidationParameters BuildParams(string issuer, string audience, IList<SecurityKey> keys) => new()
    {
        ValidateIssuer = true, ValidIssuer = issuer,
        ValidateAudience = true, ValidAudience = audience,
        ValidateLifetime = true, RequireExpirationTime = true,   // ครอบคลุม exp + nbf
        ClockSkew = TimeSpan.FromSeconds(5),                     // token ทาง B อายุสั้นมาก ไม่ควรเผื่อเยอะ
        ValidateIssuerSigningKey = true, RequireSignedTokens = true,
        IssuerSigningKeys = keys,
        ValidAlgorithms = AllowedAlgs,
    };

    private static string Classify(Exception? ex) => ex switch
    {
        SecurityTokenExpiredException => "expired",
        SecurityTokenNotYetValidException => "not_yet_valid",
        SecurityTokenInvalidAudienceException => "bad_aud",
        SecurityTokenInvalidIssuerException => "bad_iss",
        SecurityTokenSignatureKeyNotFoundException or SecurityTokenInvalidSignatureException => "bad_signature",
        _ => "invalid",
    };

    private async Task<IList<SecurityKey>> GetKeysAsync(string url, bool force, CancellationToken ct)
    {
        var cacheKey = "sso:jwks:" + url;
        if (cache.TryGetValue(cacheKey, out JwksEntry? cached) && cached != null)
        {
            if (!force || DateTimeOffset.UtcNow - cached.FetchedAt < MinRefreshInterval) return cached.Keys;
        }
        var http = httpFactory.CreateClient();
        http.Timeout = TimeSpan.FromSeconds(5);
        var json = await http.GetStringAsync(url, ct);
        var keys = new JsonWebKeySet(json).GetSigningKeys();
        cache.Set(cacheKey, new JwksEntry(keys, DateTimeOffset.UtcNow), TimeSpan.FromHours(1));
        return keys;
    }
}
