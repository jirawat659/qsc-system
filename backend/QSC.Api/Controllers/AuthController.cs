using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using QSC.Api.Data;
using QSC.Api.Models;
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

        public AuthController(AppDbContext context, IConfiguration config)
        {
            _context = context;
            _config = config;
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

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginDto dto)
        {
            var user = await _context.Users
                .Include(u => u.Role)
                .FirstOrDefaultAsync(u => u.Username.ToLower() == dto.Username.ToLower());

            if (user == null)
            {
                return Unauthorized(new { message = "ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง" });
            }

            // Verify BCrypt or fallback to plain text if needed
            bool passwordValid = false;
            try
            {
                passwordValid = BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash);
            }
            catch
            {
                passwordValid = (user.PasswordHash == dto.Password);
            }

            if (!passwordValid)
            {
                return Unauthorized(new { message = "ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง" });
            }

            if (!user.IsActive)
            {
                return StatusCode(403, new { message = "บัญชีผู้ใช้นี้ถูกระงับการใช้งานชั่วคราว กรุณาติดต่อผู้ดูแลระบบ" });
            }

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

            // Generate JWT Token
            var jwtKey = _config["Jwt:Key"] ?? "QSC_Secret_Key_Super_Secure_2026_Enterprise_Auth_JWT_Token_Key!";
            var jwtIssuer = _config["Jwt:Issuer"] ?? "QSC.Api";
            var jwtAudience = _config["Jwt:Audience"] ?? "QSC.App";

            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.UTF8.GetBytes(jwtKey);
            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(new[]
                {
                    new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                    new Claim(ClaimTypes.Name, user.Username),
                    new Claim(ClaimTypes.Role, user.Role?.Code ?? "AUDITOR")
                }),
                Expires = DateTime.UtcNow.AddHours(1),
                Issuer = jwtIssuer,
                Audience = jwtAudience,
                SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
            };

            var token = tokenHandler.CreateToken(tokenDescriptor);
            var tokenString = tokenHandler.WriteToken(token);

            return Ok(new
            {
                token = tokenString,
                user = new
                {
                    id = user.Id,
                    username = user.Username,
                    fullName = user.FullName,
                    role = user.Role?.Code ?? "AUDITOR",
                    roleName = user.Role?.Name ?? "ผู้ใช้งาน",
                    branchScope = user.BranchScope,
                    allowedLocationIds = allowedLocationIds,
                    mustChangePassword = user.MustChangePassword,
                    permissions = permissions
                }
            });
        }

        [HttpPost("change-password")]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordDto dto)
        {
            var user = await _context.Users.FindAsync(dto.UserId);
            if (user == null) return NotFound(new { message = "ไม่พบผู้ใช้ในระบบ" });

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
            user.MustChangePassword = false;
            await _context.SaveChangesAsync();

            return Ok(new { message = "เปลี่ยนรหัสผ่านสำเร็จเรียบร้อยแล้ว" });
        }

        [HttpPost("reset-password")]
        public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordDto dto)
        {
            var user = await _context.Users.FindAsync(dto.UserId);
            if (user == null) return NotFound(new { message = "ไม่พบผู้ใช้ในระบบ" });

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
            user.MustChangePassword = true; // Force user to change on next login
            await _context.SaveChangesAsync();

            return Ok(new { message = $"รีเซ็ตรหัสผ่านของผู้ใช้ {user.Username} สำเร็จแล้ว" });
        }
    }
}

