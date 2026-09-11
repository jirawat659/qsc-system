using System;

namespace QSC.Api.Helpers
{
    public static class TimezoneHelper
    {
        private static readonly TimeZoneInfo BangkokZone = ResolveBangkokTimeZone();

        private static TimeZoneInfo ResolveBangkokTimeZone()
        {
            try
            {
                // Windows TimeZone ID
                return TimeZoneInfo.FindSystemTimeZoneById("SE Asia Standard Time");
            }
            catch (TimeZoneNotFoundException)
            {
                try
                {
                    // Linux / macOS IANA TimeZone ID
                    return TimeZoneInfo.FindSystemTimeZoneById("Asia/Bangkok");
                }
                catch
                {
                    // Fallback Custom TimeZone
                    return TimeZoneInfo.CreateCustomTimeZone(
                        "SE Asia Standard Time",
                        TimeSpan.FromHours(7),
                        "SE Asia Standard Time",
                        "SE Asia Standard Time"
                    );
                }
            }
        }

        public static DateTime ToBangkokTime(DateTime utcDateTime)
        {
            var utcKind = utcDateTime.Kind == DateTimeKind.Utc 
                ? utcDateTime 
                : DateTime.SpecifyKind(utcDateTime, DateTimeKind.Utc);
            return TimeZoneInfo.ConvertTimeFromUtc(utcKind, BangkokZone);
        }

        public static DateTime ToUtcFromBangkok(DateTime bangkokDateTime)
        {
            var unspecified = DateTime.SpecifyKind(bangkokDateTime, DateTimeKind.Unspecified);
            return TimeZoneInfo.ConvertTimeToUtc(unspecified, BangkokZone);
        }
    }
}