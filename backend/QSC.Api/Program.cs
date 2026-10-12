using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using QSC.Api.Data;
using QSC.Api.Hubs;
using System.Globalization;
using System.Security.Claims;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;

// Force Gregorian calendar (ค.ศ.) globally for all threads and date formatting
CultureInfo.DefaultThreadCurrentCulture = CultureInfo.InvariantCulture;
CultureInfo.DefaultThreadCurrentUICulture = CultureInfo.InvariantCulture;

var builder = WebApplication.CreateBuilder(args);

// 1. Database Configuration
builder.Services.AddHttpContextAccessor();
builder.Services.AddMemoryCache();
builder.Services.AddSingleton<QSC.Api.Services.LoginRateLimiterService>();
builder.Services.AddScoped<AuditStampInterceptor>();
builder.Services.AddDbContext<AppDbContext>((sp, options) =>
{
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection"));
    options.AddInterceptors(sp.GetRequiredService<AuditStampInterceptor>());
    options.ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning));
});

// 1.1 SSO Services (Microsoft Entra ID & AU Portal Launcher)
builder.Services.Configure<QSC.Api.Sso.SsoOptions>(builder.Configuration.GetSection("AuPortal"));
builder.Services.AddSingleton<QSC.Api.Sso.JtiStore>();
builder.Services.AddSingleton<QSC.Api.Sso.SsoTokenValidator>();
builder.Services.AddSingleton<QSC.Api.Sso.TokenService>();
builder.Services.AddHttpClient<QSC.Api.Sso.PdpClient>();
builder.Services.AddSingleton<QSC.Api.Sso.IPdpBearerProvider, QSC.Api.Sso.UnconfiguredBearerProvider>();
builder.Services.AddScoped<QSC.Api.Services.IPermissionService, QSC.Api.Services.PermissionService>();

// 2. CORS Setup
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() 
    ?? new[] { "http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173", "http://127.0.0.1:3000" };

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReact", policy =>
        policy.SetIsOriginAllowed(origin =>
        {
            if (string.IsNullOrWhiteSpace(origin)) return false;
            try
            {
                var uri = new Uri(origin);
                if (uri.Host == "localhost" || uri.Host == "127.0.0.1")
                    return true;

                // Validate actual IP addresses in private subnets
                if (System.Net.IPAddress.TryParse(uri.Host, out var ip))
                {
                    var bytes = ip.GetAddressBytes();
                    if (bytes.Length == 4)
                    {
                        // 192.168.0.0/16
                        if (bytes[0] == 192 && bytes[1] == 168) return true;
                        // 10.0.0.0/8
                        if (bytes[0] == 10) return true;
                        // 172.16.0.0/12
                        if (bytes[0] == 172 && bytes[1] >= 16 && bytes[1] <= 31) return true;
                    }
                }

                // Check explicit allowed origins list
                return allowedOrigins.Contains(origin);
            }
            catch { return false; }
        })
        .AllowAnyMethod()
        .AllowAnyHeader()
        .AllowCredentials());
});

// 3. JWT Authentication & SignalR Query-String Access Token
var jwtKey = builder.Configuration["Jwt:Key"] ?? throw new InvalidOperationException("JWT Key is missing in Configuration!");
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "QscApi";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "QscFrontend";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ClockSkew = TimeSpan.Zero // ลดการหน่วงเวลาหมดอายุ Token
        };

        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                {
                    context.Token = accessToken;
                }
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

// 4. SignalR & Real-time Services
builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = builder.Environment.IsDevelopment();
    options.MaximumReceiveMessageSize = 15 * 1024 * 1024; // 15MB
});

// 5. Application Services
builder.Services.AddHttpClient();
builder.Services.AddMemoryCache();
builder.Services.AddScoped<QSC.Api.Services.AiService>();
builder.Services.AddScoped<QSC.Api.Services.IActivityLogger, QSC.Api.Services.ActivityLogger>();

// 6. Rate Limiting for AI Endpoints
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, token) =>
    {
        context.HttpContext.Response.ContentType = "application/json; charset=utf-8";
        var isSso = context.HttpContext.Request.Path.StartsWithSegments("/api/auth/sso");
        var msg = isSso ? "ขอเข้าสู่ระบบถี่เกินไป กรุณารอสักครู่แล้วลองใหม่"
                        : "คุณเรียกใช้งาน AI ถี่เกินไป กรุณารอ 1 นาทีก่อนลองใหม่";
        await context.HttpContext.Response.WriteAsync(
            $"{{\"message\": \"{msg}\", \"status\": 429, \"retryAfterSeconds\": 60}}", 
            token);
    };

    // จำกัดต่อ IP สำหรับ /api/auth/sso/* (anonymous endpoint) — เผื่อหลายคนออกอินเทอร์เน็ตผ่าน IP เดียวกัน (NAT ของบริษัท)
    options.AddPolicy("SsoRateLimit", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "anonymous",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 60,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));

    options.AddPolicy("AiRateLimit", httpContext =>
    {
        var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? httpContext.Connection.RemoteIpAddress?.ToString()
            ?? "anonymous";

        return RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: userId,
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0
            });
    });
});

// 7. Controllers & OpenAPI Setup
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
        options.JsonSerializerOptions.Converters.Add(new QSC.Api.Helpers.UtcDateTimeConverter());
        options.JsonSerializerOptions.Converters.Add(new QSC.Api.Helpers.UtcNullableDateTimeConverter());
    });

builder.Services.AddOpenApi();

var app = builder.Build();

// 8. Pipeline Middlewares
// รองรับ Reverse Proxy (เช่น Nginx / Cloudflare)
app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
});

app.UseCors("AllowReact");

app.UseAuthentication();
app.UseAuthorization();

app.UseStaticFiles();

// 🌟 Static Files Configuration for Uploads from appsettings.json (Storage:UploadPath)
var uploadsRootDirectory = QSC.Api.Helpers.UploadHelper.GetUploadsRootPath(app.Environment, app.Configuration);
if (!string.IsNullOrWhiteSpace(uploadsRootDirectory) && Directory.Exists(uploadsRootDirectory))
{
    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(uploadsRootDirectory),
        RequestPath = "/uploads",
        OnPrepareResponse = ctx =>
        {
            ctx.Context.Response.Headers.Append("Access-Control-Allow-Origin", "*");
            ctx.Context.Response.Headers.Append("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
        }
    });
}
app.UseRateLimiter();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/openapi/v1.json", "QSC.Api v1");
    });
}

// 9. Endpoint Mappings
app.MapControllers();
app.MapHub<CapChatHub>("/hubs/cap-chat");

// 10. Database Seeder / Migration
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    try
    {
        DatabaseSeeder.Initialize(db, app.Environment);
        Console.WriteLine("✅ Database migration and system config checked successfully!");
    }
    catch (Exception ex)
    {
        // log ให้เต็ม — ก่อนหน้านี้พิมพ์แค่ ex.Message ทำให้ปัญหา seed หาสาเหตุไม่ได้
        Console.WriteLine($"⚠️ Seeder error: {ex}");
    }
}

app.Run();