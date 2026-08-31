using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using QSC.Api.Data;
using QSC.Api.Hubs;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// ตั้งค่า SQLite
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

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
                return uri.Host == "localhost" 
                    || uri.Host == "127.0.0.1" 
                    || uri.Host.StartsWith("192.168.") 
                    || uri.Host.StartsWith("10.")
                    || allowedOrigins.Contains(origin);
            }
            catch
            {
                return false;
            }
        })
        .AllowAnyMethod()
        .AllowAnyHeader()
        .AllowCredentials());
});

// ตั้งค่า JWT Authentication & SignalR WebSocket Token Support
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
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };

        // 🌟 Handle JWT Token from SignalR WebSocket Query String (?access_token=...)
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

builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = true;
    options.MaximumReceiveMessageSize = 15 * 1024 * 1024;
});
builder.Services.AddHttpClient();
builder.Services.AddScoped<QSC.Api.Services.AiService>();

// 🛡️ Rate Limiting for AI Endpoints (10 requests/minute per user)
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, token) =>
    {
        context.HttpContext.Response.ContentType = "application/json; charset=utf-8";
        await context.HttpContext.Response.WriteAsync("{\"message\": \"คุณเรียกใช้งาน AI ถี่เกินไป กรุณารอ 1 นาทีก่อนลองใหม่\", \"status\": 429}", token);
    };

    options.AddPolicy("AiRateLimit", httpContext =>
    {
        var userId = httpContext.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
            ?? httpContext.Connection.RemoteIpAddress?.ToString()
            ?? "anonymous";

        return System.Threading.RateLimiting.RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: userId,
            factory: partition => new System.Threading.RateLimiting.FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = System.Threading.RateLimiting.QueueProcessingOrder.OldestFirst,
                QueueLimit = 0
            });
    });
});

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
    });

builder.Services.AddOpenApi();

var app = builder.Build();

app.UseCors("AllowReact");
app.UseStaticFiles(); // 🌟 Serve /uploads/ directory

app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/openapi/v1.json", "QSC.Api v1");
    });
}

app.MapControllers();
app.MapHub<CapChatHub>("/hubs/cap-chat");

// 🌟 Run Database Seeder on Startup (only seed if database is new or empty)
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    try
    {
        DatabaseSeeder.Initialize(db, app.Environment, forceRecreate: false);
        Console.WriteLine("✅ Database migration and enterprise seeding checked successfully!");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"⚠️ Seeder error: {ex.Message}");
    }
}

app.Run();