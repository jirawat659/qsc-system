using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace QSC.Api.Helpers
{
    public class RoleNavConfigDto
    {
        [JsonPropertyName("left")]
        public string Left { get; set; } = "dashboard";

        [JsonPropertyName("center")]
        public string Center { get; set; } = "audit";

        [JsonPropertyName("right")]
        public string Right { get; set; } = "more";
    }

    public static class RoleNavHelper
    {
        public static readonly HashSet<string> AllowedModules = new(StringComparer.OrdinalIgnoreCase)
        {
            "dashboard",
            "audit",
            "schedule",
            "forms",
            "cap",
            "reports",
            "more"
        };

        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            PropertyNameCaseInsensitive = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        public static RoleNavConfigDto GetDefaultNavConfig(string? roleCode)
        {
            return (roleCode?.Trim().ToUpperInvariant()) switch
            {
                "ADMIN" => new RoleNavConfigDto { Left = "dashboard", Center = "more", Right = "audit" },
                "AUDITOR" => new RoleNavConfigDto { Left = "dashboard", Center = "audit", Right = "more" },
                "AUDITEE" or "STORE_MANAGER" => new RoleNavConfigDto { Left = "dashboard", Center = "cap", Right = "more" },
                "STANDARD" or "AREA_MANAGER" => new RoleNavConfigDto { Left = "dashboard", Center = "audit", Right = "more" },
                "EXEC" or "EXECUTIVE" => new RoleNavConfigDto { Left = "dashboard", Center = "schedule", Right = "more" },
                _ => new RoleNavConfigDto { Left = "dashboard", Center = "audit", Right = "more" }
            };
        }

        public static string GetDefaultNavConfigJson(string? roleCode)
        {
            return Serialize(GetDefaultNavConfig(roleCode));
        }

        public static bool Validate(RoleNavConfigDto? dto, out string? errorMessage, out RoleNavConfigDto? normalizedDto)
        {
            normalizedDto = null;

            if (dto == null ||
                string.IsNullOrWhiteSpace(dto.Left) ||
                string.IsNullOrWhiteSpace(dto.Center) ||
                string.IsNullOrWhiteSpace(dto.Right))
            {
                errorMessage = "กรุณาระบุตำแหน่งเมนูให้ครบทั้ง 3 ช่อง (left, center, right)";
                return false;
            }

            var left = dto.Left.Trim().ToLowerInvariant();
            var center = dto.Center.Trim().ToLowerInvariant();
            var right = dto.Right.Trim().ToLowerInvariant();

            if (!AllowedModules.Contains(left) || !AllowedModules.Contains(center) || !AllowedModules.Contains(right))
            {
                errorMessage = "โมดูลที่เลือกไม่ถูกต้อง ต้องเป็นหนึ่งใน: dashboard, audit, schedule, forms, cap, reports, more";
                return false;
            }

            if (left == center || left == right || center == right)
            {
                errorMessage = "ตำแหน่งแถบเมนูต้องไม่ซ้ำกัน (Slots must contain distinct valid modules)";
                return false;
            }

            normalizedDto = new RoleNavConfigDto
            {
                Left = left,
                Center = center,
                Right = right
            };
            errorMessage = null;
            return true;
        }

        public static RoleNavConfigDto ParseOrDefault(string? navConfigJson, string? roleCode)
        {
            if (!string.IsNullOrWhiteSpace(navConfigJson))
            {
                try
                {
                    var parsed = JsonSerializer.Deserialize<RoleNavConfigDto>(navConfigJson, JsonOptions);
                    if (Validate(parsed, out _, out var normalized) && normalized != null)
                    {
                        return normalized;
                    }
                }
                catch
                {
                    // Fallback on JSON parse error
                }
            }

            return GetDefaultNavConfig(roleCode);
        }

        public static string Serialize(RoleNavConfigDto dto)
        {
            return JsonSerializer.Serialize(dto, JsonOptions);
        }
    }
}
