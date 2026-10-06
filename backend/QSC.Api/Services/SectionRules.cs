using System;
using System.Collections.Generic;
using System.Linq;
using QSC.Api.Models;

namespace QSC.Api.Services
{
    public static class SectionRules
    {
        private static readonly HashSet<string> ScoredQuestionTypes = new(StringComparer.OrdinalIgnoreCase)
        {
            "YESNO",
            "SCALE"
        };

        /// <summary>
        /// ตรวจสอบว่าข้อคำถามนี้เป็นข้อที่นำมาคิดคะแนนหรือไม่ (Scored Item)
        /// ต้องผ่านทุกเงื่อนไข:
        /// 1. FullScore > 0
        /// 2. QuestionType เป็น YESNO หรือ SCALE เท่านั้น
        /// 3. CategoryCode ต้องไม่ใช่ INFO
        /// 4. CategoryName ต้องไม่ใช่ รายละเอียด หรือ ข้อมูลทั่วไป
        /// 5. ไม่อยู่ในหมวดที่เป็น INFO (infoSectionIds)
        /// </summary>
        public static bool IsScoredItem(SurveyItem item, double fullScore, HashSet<int>? infoSectionIds = null)
        {
            if (fullScore <= 0) return false;
            if (infoSectionIds != null && infoSectionIds.Contains(item.SurveySectionId)) return false;
            if (string.Equals(item.CategoryCode, "INFO", StringComparison.OrdinalIgnoreCase)) return false;
            if (string.Equals(item.CategoryName, "รายละเอียด", StringComparison.OrdinalIgnoreCase)) return false;
            if (string.Equals(item.CategoryName, "ข้อมูลทั่วไป", StringComparison.OrdinalIgnoreCase)) return false;

            var qType = (item.QuestionType ?? "YESNO").Trim();
            return ScoredQuestionTypes.Contains(qType);
        }

        /// <summary>
        /// ตรวจสอบว่าหมวดคำถามนี้เป็นหมวดประเภท INFO (หมวดข้อมูลทั่วไป/รายละเอียด ที่ไม่คิดคะแนน) หรือไม่
        /// 1. อิงตาม sectionTypes จาก MetadataConfigJson ด้วยคีย์ OrderIndex.ToString()
        /// 2. Fallback สำหรับแบบฟอร์มเก่าที่ไม่มี sectionTypes: ตรวจจากชื่อหมวด หรือทุกข้อที่ Active ในหมวดเป็นข้อไม่คิดคะแนน
        /// </summary>
        public static bool IsInfoSection(SurveySection sec, IReadOnlyDictionary<string, string> sectionTypes)
        {
            string secKey = sec.OrderIndex.ToString();
            if (sectionTypes.TryGetValue(secKey, out var st))
            {
                return string.Equals(st, "INFO", StringComparison.OrdinalIgnoreCase);
            }

            var title = sec.Title?.Trim();
            if (string.Equals(title, "รายละเอียด", StringComparison.OrdinalIgnoreCase)
                || string.Equals(title, "ข้อมูลทั่วไป", StringComparison.OrdinalIgnoreCase)
                || string.Equals(title, "INFO", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            var activeItems = sec.Items.Where(i => i.IsActive).ToList();
            return activeItems.Count > 0 && activeItems.All(i => !IsScoredItem(i, i.FullScore));
        }
    }
}
