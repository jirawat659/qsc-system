using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using QSC.Api.Data;
using QSC.Api.Helpers;
using QSC.Api.Models;
using QSC.Api.Services;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace QSC.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _config;
        private readonly LoginRateLimiterService _rateLimiter;
        private readonly IActivityLogger _activityLogger;
        private readonly IWebHostEnvironment _env;

        public AuthController(AppDbContext context, IConfiguration config, LoginRateLimiterService rateLimiter, IActivityLogger activityLogger, IWebHostEnvironment env)
        {
            _context = context;
            _config = config;
            _rateLimiter = rateLimiter;
            _activityLogger = activityLogger;
            _env = env;
        }

        private string GetClientIp()
        {
            if (Request.Headers.TryGetValue("X-Forwarded-For", out var forwardedFor) && !string.IsNullOrWhiteSpace(forwardedFor))
            {
                return forwardedFor.ToString().Split(',')[0].Trim();
            }
            return HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown_ip";
        }

        public class LoginDto
        {
            public string Username { get; set; } = string.Empty;
            public string Password { get; set; } = string.Empty;
        }

        public class ResetPasswordDto
        {
            public int UserId { get; set; }
            public string NewPassword { get; set; } = string.Empty;
        }

        public class ChangePasswordDto
        {
            public int UserId { get; set; }
            public string OldPassword { get; set; } = string.Empty;
            public string NewPassword { get; set; } = string.Empty;
        }

        [AllowAnonymous]
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginDto dto)
        {
            // ปิดทางรหัสผ่านได้ด้วย config Auth:PasswordLoginEnabled=false (ใช้ตอน cutover ไป SSO อย่างเดียว)
            if (!_config.GetValue<bool>("Auth:PasswordLoginEnabled", true))
                return StatusCode(StatusCodes.Status403Forbidden, new
                {
                    message = "ระบบปิดการเข้าสู่ระบบด้วยรหัสผ่านแล้ว กรุณาเข้าสู่ระบบผ่าน Microsoft Entra ID หรือ AU Portal",
                    code = "password_login_disabled"
                });

            var trimmedUsername = dto.Username?.Trim() ?? string.Empty;
            var clientIp = GetClientIp();

            // 1. ตรวจสอบสถานะ Account / IP Lockout ก่อนคำนวณรหัสผ่าน
            if (_rateLimiter.IsLockedOut(trimmedUsername, clientIp, out int remainingLockSeconds))
            {
                var minutes = (int)Math.Ceiling(remainingLockSeconds / 60.0);
                return StatusCode(StatusCodes.Status429TooManyRequests, new
                {
                    message = $"คุณกรอกรหัสผ่านผิดเกินกำหนด บัญชีถูกระงับชั่วคราว กรุณารออีก {minutes} นาที ({remainingLockSeconds} วินาที)",
                    isLocked = true,
                    retryAfterSeconds = remainingLockSeconds
                });
            }

            var user = await _context.Users
                .Include(u => u.Role)
                .FirstOrDefaultAsync(u => u.Username == trimmedUsername);

            // 🌟 ตรวจสอบตัวพิมพ์เล็ก-พิมพ์ใหญ่ให้ตรงกันเป๊ะ (Case-Sensitive Match)
            if (user == null || user.Username != trimmedUsername)
            {
                var (isLocked, remainingAttempts, lockoutSeconds) = _rateLimiter.RecordFailedAttempt(trimmedUsername, clientIp);
                if (isLocked)
                {
                    return StatusCode(StatusCodes.Status429TooManyRequests, new
                    {
                        message = $"คุณกรอกรหัสผ่านผิดเกินกำหนด บัญชีถูกระงับชั่วคราวเป็นเวลา {LoginRateLimiterService.LockoutDuration.TotalMinutes} นาที",
                        isLocked = true,
                        retryAfterSeconds = lockoutSeconds
                    });
                }

                return Unauthorized(new
                {
                    message = $"ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง (เหลือโอกาสอีก {remainingAttempts} ครั้ง)",
                    remainingAttempts
                });
            }

            // Verify BCrypt Password
            bool passwordValid = false;
            try
            {
                passwordValid = BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash);
            }
            catch
            {
                passwordValid = false;
            }

            if (!passwordValid)
            {
                var (isLocked, remainingAttempts, lockoutSeconds) = _rateLimiter.RecordFailedAttempt(trimmedUsername, clientIp);
                if (isLocked)
                {
                    return StatusCode(StatusCodes.Status429TooManyRequests, new
                    {
                        message = $"คุณกรอกรหัสผ่านผิดเกินกำหนด บัญชีถูกระงับชั่วคราวเป็นเวลา {LoginRateLimiterService.LockoutDuration.TotalMinutes} นาที",
                        isLocked = true,
                        retryAfterSeconds = lockoutSeconds
                    });
                }

                return Unauthorized(new
                {
                    message = $"ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง (เหลือโอกาสอีก {remainingAttempts} ครั้ง)",
                    remainingAttempts
                });
            }

            if (!user.IsActive)
            {
                return StatusCode(403, new { message = "บัญชีผู้ใช้นี้ถูกระงับการใช้งานชั่วคราว กรุณาติดต่อผู้ดูแลระบบ" });
            }

            // รีเซ็ตประวัติการล็อกอินผิดเมื่อเข้าสู่ระบบสำเร็จ
            _rateLimiter.ResetAttempts(trimmedUsername, clientIp);

            // Load user permissions
            var permissions = await _context.RolePermissions
                .Where(rp => rp.RoleId == user.RoleId)
                .Include(rp => rp.Permission)
                .Select(rp => rp.Permission!.Code)
                .ToListAsync();

            // Load assigned locations for specific branch scope
            var allowedLocationIds = new List<int>();
            if (user.BranchScope == "SPECIFIC")
            {
                allowedLocationIds = await _context.UserLocations
                    .Where(ul => ul.UserId == user.Id)
                    .Select(ul => ul.LocationId)
                    .ToListAsync();
            }

            // Load assigned brands for specific brand scope
            var allowedBrandIds = new List<int>();
            if (user.BrandScope == "SPECIFIC")
            {
                allowedBrandIds = await _context.UserBrands
                    .Where(ub => ub.UserId == user.Id)
                    .Select(ub => ub.BrandId)
                    .ToListAsync();
            }

            // Generate JWT Token
            var jwtKey = _config["Jwt:Key"] ?? throw new InvalidOperationException("JWT Key is missing in Configuration!");
            var jwtIssuer = _config["Jwt:Issuer"] ?? "QscApi";
            var jwtAudience = _config["Jwt:Audience"] ?? "QscFrontend";

            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.UTF8.GetBytes(jwtKey);
            var roleCode = user.Role?.Code ?? string.Empty;

            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(new[]
                {
                    new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                    new Claim(ClaimTypes.Name, user.Username),
                    new Claim(ClaimTypes.Role, roleCode)
                }),
                Expires = DateTime.UtcNow.AddHours(8),
                Issuer = jwtIssuer,
                Audience = jwtAudience,
                SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
            };

            var token = tokenHandler.CreateToken(tokenDescriptor);
            var tokenString = tokenHandler.WriteToken(token);

            // ฝัง session token ลงใน HttpOnly cookie
            CookieHelper.AppendSessionCookie(Response, tokenString, _env);

            var navConfig = RoleNavHelper.ParseOrDefault(user.Role?.NavConfigJson, roleCode);
            var navConfigJson = !string.IsNullOrWhiteSpace(user.Role?.NavConfigJson)
                ? user.Role.NavConfigJson
                : RoleNavHelper.Serialize(navConfig);

            await _activityLogger.LogAsync(user.Id, "LOGIN", "User", user.Id);

            return Ok(new
            {
                token = tokenString,
                user = new
                {
                    id = user.Id,
                    username = user.Username,
                    fullName = user.FullName,
                    role = roleCode,
                    roleName = user.Role?.Name ?? "ผู้ใช้งาน",
                    navConfigJson = navConfigJson,
                    navConfig = navConfig,
                    branchScope = user.BranchScope,
                    allowedLocationIds = allowedLocationIds,
                    brandScope = user.BrandScope,
                    allowedBrandIds = allowedBrandIds,
                    mustChangePassword = user.MustChangePassword,
                    permissions = permissions
                }
            });
        }

        [AllowAnonymous]
        [HttpPost("logout")]
        public IActionResult Logout()
        {
            CookieHelper.DeleteSessionCookie(Response, _env);
            return Ok(new { message = "ออกจากระบบเรียบร้อยแล้ว" });
        }

        [Authorize]
        [HttpPost("change-password")]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordDto dto)
        {
            var currentUserIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var currentUserRole = User.FindFirst(ClaimTypes.Role)?.Value;

            if (string.IsNullOrEmpty(currentUserIdStr))
            {
                return Unauthorized(new { message = "กรุณาเข้าสู่ระบบก่อนทำรายการ" });
            }

            if (dto.UserId <= 0 && int.TryParse(currentUserIdStr, out var parsedMyId))
            {
                dto.UserId = parsedMyId;
            }

            // Non-admin users can only change their own password
            if (currentUserRole != "ADMIN" && currentUserIdStr != dto.UserId.ToString())
            {
                return StatusCode(403, new { message = "ไม่มีสิทธิ์เปลี่ยนรหัสผ่านของผู้ใช้อื่น" });
            }

            var user = await _context.Users.FindAsync(dto.UserId);
            if (user == null) return NotFound(new { message = "ไม่พบผู้ใช้ในระบบ" });

            if (string.IsNullOrWhiteSpace(dto.NewPassword) || dto.NewPassword.Length < 6)
            {
                return BadRequest(new { message = "รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร" });
            }

            // Verify old password
            if (!string.IsNullOrWhiteSpace(dto.OldPassword) || currentUserRole != "ADMIN")
            {
                if (string.IsNullOrWhiteSpace(dto.OldPassword))
                {
                    return BadRequest(new { message = "กรุณาระบุรหัสผ่านเดิม" });
                }

                bool oldValid = false;
                try
                {
                    oldValid = BCrypt.Net.BCrypt.Verify(dto.OldPassword, user.PasswordHash);
                }
                catch
                {
                    oldValid = false;
                }

                if (!oldValid)
                {
                    return BadRequest(new { message = "รหัสผ่านเดิมไม่ถูกต้อง" });
                }
            }

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
            user.MustChangePassword = false;
            await _context.SaveChangesAsync();

            return Ok(new { message = "เปลี่ยนรหัสผ่านสำเร็จเรียบร้อยแล้ว" });
        }

        [Authorize(Roles = "ADMIN")]
        [HttpPost("reset-password")]
        public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.NewPassword) || dto.NewPassword.Length < 6)
            {
                return BadRequest(new { message = "รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร" });
            }

            var user = await _context.Users.FindAsync(dto.UserId);
            if (user == null) return NotFound(new { message = "ไม่พบผู้ใช้ในระบบ" });

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
            user.MustChangePassword = true; // Force user to change on next login
            await _context.SaveChangesAsync();

            return Ok(new { message = $"รีเซ็ตรหัสผ่านของผู้ใช้ {user.Username} สำเร็จแล้ว" });
        }
    }
}