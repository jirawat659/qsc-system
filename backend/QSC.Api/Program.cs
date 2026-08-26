using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using QSC.Api.Data;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// ตั้งค่า SQLite
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReact", policy => 
        policy.SetIsOriginAllowed(origin => true)
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials());
});

// ตั้งค่า JWT Authentication
var jwtKey = builder.Configuration["Jwt:Key"] ?? "QSC_Secret_Key_Super_Secure_2026_Enterprise_Auth_JWT_Token_Key!";
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "QSC.Api";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "QSC.App";

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

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/openapi/v1.json", "QSC.Api v1");
    });
}

app.MapControllers();

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