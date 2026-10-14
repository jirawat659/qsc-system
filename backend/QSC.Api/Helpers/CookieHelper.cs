using Microsoft.AspNetCore.Http;

namespace QSC.Api.Helpers;

public static class CookieHelper
{
    public const string CookieName = "qsc_token";

    public static void AppendSessionCookie(HttpResponse response, string token, IWebHostEnvironment env, int expireHours = 8)
    {
        var isDev = env.IsDevelopment();

        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            // ในโหมด Development (HTTP/localhost) ต้องเป็น SameSite=Lax และ Secure=false
            // ในโหมด Production (HTTPS) ต้องเป็น Secure=true และ SameSite=Lax (หรือ None ถ้าแยก subdomain/domain)
            Secure = !isDev,
            SameSite = SameSiteMode.Lax,
            Expires = DateTimeOffset.UtcNow.AddHours(expireHours),
            Path = "/"
        };

        response.Cookies.Append(CookieName, token, cookieOptions);
    }

    public static void DeleteSessionCookie(HttpResponse response, IWebHostEnvironment env)
    {
        var isDev = env.IsDevelopment();
        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = !isDev,
            SameSite = SameSiteMode.Lax,
            Path = "/"
        };

        response.Cookies.Delete(CookieName, cookieOptions);
    }
}

