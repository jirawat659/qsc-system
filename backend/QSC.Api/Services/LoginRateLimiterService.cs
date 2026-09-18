using Microsoft.Extensions.Caching.Memory;

namespace QSC.Api.Services
{
    public class LoginRateLimiterService
    {
        private readonly IMemoryCache _cache;
        private readonly ILogger<LoginRateLimiterService> _logger;

        public const int MaxFailedAttempts = 5;
        public const int MaxIpFailedAttempts = 15;
        public static readonly TimeSpan LockoutDuration = TimeSpan.FromMinutes(1);
        public static readonly TimeSpan AttemptWindow = TimeSpan.FromMinutes(15);

        public LoginRateLimiterService(IMemoryCache cache, ILogger<LoginRateLimiterService> logger)
        {
            _cache = cache;
            _logger = logger;
        }

        private static string GetUserAttemptKey(string username) => $"login_attempts_u_{username.Trim().ToLowerInvariant()}";
        private static string GetUserLockoutKey(string username) => $"login_lockout_u_{username.Trim().ToLowerInvariant()}";
        private static string GetIpAttemptKey(string clientIp) => $"login_attempts_ip_{clientIp.Trim()}";
        private static string GetIpLockoutKey(string clientIp) => $"login_lockout_ip_{clientIp.Trim()}";

        public bool IsLockedOut(string username, string clientIp, out int remainingSeconds)
        {
            remainingSeconds = 0;
            var now = DateTime.UtcNow;

            // 1. ตรวจสอบการล็อกระดับชื่อผู้ใช้ (Username Lockout)
            if (!string.IsNullOrWhiteSpace(username))
            {
                var userKey = GetUserLockoutKey(username);
                if (_cache.TryGetValue(userKey, out DateTime userLockUntil) && userLockUntil > now)
                {
                    remainingSeconds = (int)Math.Ceiling((userLockUntil - now).TotalSeconds);
                    return true;
                }
            }

            // 2. ตรวจสอบการล็อกระดับไอพี (IP Lockout)
            if (!string.IsNullOrWhiteSpace(clientIp))
            {
                var ipKey = GetIpLockoutKey(clientIp);
                if (_cache.TryGetValue(ipKey, out DateTime ipLockUntil) && ipLockUntil > now)
                {
                    remainingSeconds = (int)Math.Ceiling((ipLockUntil - now).TotalSeconds);
                    return true;
                }
            }

            return false;
        }

        public (bool IsLocked, int RemainingAttempts, int LockoutSeconds) RecordFailedAttempt(string username, string clientIp)
        {
            var now = DateTime.UtcNow;
            int userAttempts = 0;
            int ipAttempts = 0;

            // บันทึกความพยายามที่ผิดระดับ Username
            if (!string.IsNullOrWhiteSpace(username))
            {
                var userAttemptKey = GetUserAttemptKey(username);
                userAttempts = _cache.GetOrCreate(userAttemptKey, entry =>
                {
                    entry.SlidingExpiration = AttemptWindow;
                    return 0;
                }) + 1;

                _cache.Set(userAttemptKey, userAttempts, AttemptWindow);

                if (userAttempts >= MaxFailedAttempts)
                {
                    var lockUntil = now.Add(LockoutDuration);
                    _cache.Set(GetUserLockoutKey(username), lockUntil, LockoutDuration);
                    _cache.Remove(userAttemptKey); // ล้างเคาน์เตอร์เมื่อล็อกแล้ว

                    _logger.LogWarning("Account lockout triggered for user '{Username}' from IP {ClientIp}. Locked for {Minutes} minutes.",
                        username, clientIp, LockoutDuration.TotalMinutes);

                    return (IsLocked: true, RemainingAttempts: 0, LockoutSeconds: (int)LockoutDuration.TotalSeconds);
                }
            }

            // บันทึกความพยายามที่ผิดระดับ IP (ป้องกันสุ่มหลาย Username จากเครื่องเดียวกัน)
            if (!string.IsNullOrWhiteSpace(clientIp))
            {
                var ipAttemptKey = GetIpAttemptKey(clientIp);
                ipAttempts = _cache.GetOrCreate(ipAttemptKey, entry =>
                {
                    entry.SlidingExpiration = AttemptWindow;
                    return 0;
                }) + 1;

                _cache.Set(ipAttemptKey, ipAttempts, AttemptWindow);

                if (ipAttempts >= MaxIpFailedAttempts)
                {
                    var lockUntil = now.Add(LockoutDuration);
                    _cache.Set(GetIpLockoutKey(clientIp), lockUntil, LockoutDuration);
                    _cache.Remove(ipAttemptKey);

                    _logger.LogWarning("IP lockout triggered for IP {ClientIp}. Locked for {Minutes} minutes.",
                        clientIp, LockoutDuration.TotalMinutes);

                    return (IsLocked: true, RemainingAttempts: 0, LockoutSeconds: (int)LockoutDuration.TotalSeconds);
                }
            }

            int remaining = Math.Max(0, MaxFailedAttempts - userAttempts);
            return (IsLocked: false, RemainingAttempts: remaining, LockoutSeconds: 0);
        }

        public void ResetAttempts(string username, string clientIp)
        {
            if (!string.IsNullOrWhiteSpace(username))
            {
                _cache.Remove(GetUserAttemptKey(username));
                _cache.Remove(GetUserLockoutKey(username));
            }

            if (!string.IsNullOrWhiteSpace(clientIp))
            {
                _cache.Remove(GetIpAttemptKey(clientIp));
                _cache.Remove(GetIpLockoutKey(clientIp));
            }
        }
    }
}

