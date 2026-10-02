using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace QSC.Api.Sso;

/// <summary>
/// จำ jti ที่ใช้แล้ว (ทาง B ใช้ได้ครั้งเดียว) เก็บใน memory แค่เท่าอายุ token
/// ข้อจำกัด: ถ้า deploy หลาย instance หรือ restart ระหว่างอายุ token ต้องย้ายไป cache กลาง (Redis/DB)
/// </summary>
public sealed class JtiStore(IMemoryCache cache, IOptions<SsoOptions> options)
{
    private readonly object _gate = new();

    /// <returns>true = ใช้ครั้งแรก, false = เคยใช้แล้ว (replay)</returns>
    public bool TryConsume(string jti)
    {
        var key = "sso:jti:" + jti;
        lock (_gate)
        {
            if (cache.TryGetValue(key, out _)) return false;
            cache.Set(key, true, TimeSpan.FromSeconds(options.Value.JtiTtlSeconds));
            return true;
        }
    }
}
