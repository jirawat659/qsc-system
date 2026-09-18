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

        public static (DateTime StartUtc, DateTime EndUtc, DateTime PrevStartUtc, DateTime PrevEndUtc) GetPeriodDateRanges(string? period)
        {
            var nowUtc = DateTime.UtcNow;
            var nowBkk = ToBangkokTime(nowUtc);
            var currentMonthStartBkk = new DateTime(nowBkk.Year, nowBkk.Month, 1, 0, 0, 0, DateTimeKind.Unspecified);
            DateTime startBkk, endBkk;

            switch (period?.ToLower())
            {
                case "last_month":
                    startBkk = currentMonthStartBkk.AddMonths(-1);
                    endBkk = currentMonthStartBkk;
                    break;
                case "3m":
                    startBkk = currentMonthStartBkk.AddMonths(-2);
                    endBkk = currentMonthStartBkk.AddMonths(1);
                    break;
                case "6m":
                    startBkk = currentMonthStartBkk.AddMonths(-5);
                    endBkk = currentMonthStartBkk.AddMonths(1);
                    break;
                case "ytd":
                    startBkk = new DateTime(nowBkk.Year, 1, 1, 0, 0, 0, DateTimeKind.Unspecified);
                    endBkk = currentMonthStartBkk.AddMonths(1);
                    break;
                case "month":
                default:
                    startBkk = currentMonthStartBkk;
                    endBkk = currentMonthStartBkk.AddMonths(1);
                    break;
            }

            var startUtc = ToUtcFromBangkok(startBkk);
            var endUtc = ToUtcFromBangkok(endBkk);

            var duration = endUtc - startUtc;
            var prevEndUtc = startUtc;
            var prevStartUtc = startUtc - duration;

            return (startUtc, endUtc, prevStartUtc, prevEndUtc);
        }
    }
}