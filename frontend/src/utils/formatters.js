// 📅 Centralized Thai Date, Time & Status Formatters

export const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
];

export const THAI_MONTHS_FULL = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
];

export const THAI_MONTH_INDEX_MAP = {
  "ม.ค.": 0, "ม.ค": 0, "ก.พ.": 1, "ก.พ": 1, "มี.ค.": 2, "มี.ค": 2,
  "เม.ย.": 3, "เม.ย": 3, "พ.ค.": 4, "พ.ค": 4, "มิ.ย.": 5, "มิ.ย": 5,
  "ก.ค.": 6, "ก.ค": 6, "ส.ค.": 7, "ส.ค": 7, "ก.ย.": 8, "ก.ย": 8,
  "ต.ค.": 9, "ต.ค": 9, "พ.ย.": 10, "พ.ย": 10, "ธ.ค.": 11, "ธ.ค": 11
};

export const formatThaiDate = (dateVal, options = { year: 'numeric', month: 'short', day: 'numeric' }) => {
  if (!dateVal) return '-';
  const d = typeof dateVal === 'string' || typeof dateVal === 'number' ? new Date(dateVal) : dateVal;
  return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('th-TH', options);
};

export const formatThaiTime = (dateVal) => {
  if (!dateVal) return '-';
  const d = typeof dateVal === 'string' || typeof dateVal === 'number' ? new Date(dateVal) : dateVal;
  return isNaN(d.getTime()) ? '-' : d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';
};

export const parseAuditTimestamp = (dateVal, fallbackId = 0) => {
  if (!dateVal) return Number(fallbackId) || 0;
  if (typeof dateVal === 'number') return dateVal;
  
  const parsed = new Date(dateVal).getTime();
  if (!isNaN(parsed) && parsed > 0) return parsed;
  
  const parts = String(dateVal).trim().split(/\s+/);
  if (parts.length >= 3) {
    const day = parseInt(parts[0], 10);
    const month = THAI_MONTH_INDEX_MAP[parts[1]] ?? 7;
    let year = parseInt(parts[2], 10);
    if (year > 2500) year -= 543;
    if (!isNaN(day) && !isNaN(year)) return new Date(year, month, day).getTime();
  }
  return Number(fallbackId) || 0;
};

export const parseAuditDate = (dateVal) => {
  if (!dateVal) return null;
  if (typeof dateVal === 'number') return new Date(dateVal);
  const d = new Date(dateVal);
  if (!isNaN(d.getTime())) return d;
  
  const parts = String(dateVal).trim().split(/\s+/);
  if (parts.length >= 3) {
    const day = parseInt(parts[0], 10);
    const month = THAI_MONTH_INDEX_MAP[parts[1]] ?? 7;
    let year = parseInt(parts[2], 10);
    if (year > 2500) year -= 543;
    if (!isNaN(day) && !isNaN(year)) {
      return new Date(year, month, day);
    }
  }
  return null;
};

export const THAI_COLLOQUIAL = [
  "มกรา", "กุมภา", "มีนา", "เมษา", "พฤษภา", "มิถุนา",
  "กรกฎา", "สิงหา", "กันยา", "ตุลา", "พฤศจิกา", "ธันวา"
];

export const ENG_MONTHS_SHORT = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec"
];

export const ENG_MONTHS_FULL = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december"
];

const ALL_MONTH_INDEX_MAP = (() => {
  const map = {};
  for (let i = 0; i < 12; i++) {
    map[THAI_MONTHS_SHORT[i].toLowerCase()] = i;
    map[THAI_MONTHS_SHORT[i].replace(/\./g, "").toLowerCase()] = i;
    map[THAI_MONTHS_FULL[i].toLowerCase()] = i;
    map[THAI_COLLOQUIAL[i].toLowerCase()] = i;
    map[ENG_MONTHS_SHORT[i].toLowerCase()] = i;
    map[ENG_MONTHS_FULL[i].toLowerCase()] = i;
  }
  map["พฤศจิก"] = 10;
  map["sept"] = 8;
  return map;
})();

export const parseThaiMonthYearQuery = (text) => {
  if (!text) return null;
  const raw = text.trim();
  if (!raw) return null;

  const q = raw.toLowerCase();
  const yearMatch = q.match(/^(?:ปี|พ\.?ศ\.?|ค\.?ศ\.?|year)\s*(\d{2,4})$/i) || q.match(/^(\d{4})$/);
  if (yearMatch) {
    let year = parseInt(yearMatch[1], 10);
    if (yearMatch[1].length === 2) {
      if (year >= 50 && year <= 99) year = 2500 + year; // พ.ศ. เช่น 67 -> 2567
      else year = 2000 + year; // ค.ศ. เช่น 24 -> 2024
    }
    // ตรวจสอบว่าเป็นปีที่สมเหตุสมผล (ค.ศ. 1990 - 2100 หรือ พ.ศ. 2530 - 2650)
    if ((year >= 1990 && year <= 2100) || (year >= 2530 && year <= 2650)) {
      const beYear = year > 2500 ? year : year + 543;
      const adYear = year > 2500 ? year - 543 : year;
      const startDate = new Date(adYear, 0, 1, 0, 0, 0, 0);
      const endDate = new Date(adYear + 1, 0, 1, 0, 0, 0, 0); // exclusive upper bound
      return {
        startDate,
        endDate,
        isYearOnly: true,
        year: adYear,
        beYear,
        label: `ปี ${beYear} (${adYear})`
      };
    }
  }

  const numericMonthYearMatch = q.match(/^(\d{4})[-/](\d{1,2})$/) || q.match(/^(\d{1,2})[-/](\d{4})$/);
  if (numericMonthYearMatch) {
    let year = parseInt(numericMonthYearMatch[1].length === 4 ? numericMonthYearMatch[1] : numericMonthYearMatch[2], 10);
    let monthNum = parseInt(numericMonthYearMatch[1].length === 4 ? numericMonthYearMatch[2] : numericMonthYearMatch[1], 10) - 1;
    if (monthNum >= 0 && monthNum <= 11) {
      const beYear = year > 2500 ? year : year + 543;
      const adYear = year > 2500 ? year - 543 : year;
      const startDate = new Date(adYear, monthNum, 1, 0, 0, 0, 0);
      const endDate = new Date(adYear, monthNum + 1, 1, 0, 0, 0, 0);
      return {
        startDate,
        endDate,
        monthIndex: monthNum,
        year: adYear,
        beYear,
        label: `${THAI_MONTHS_FULL[monthNum]} ${beYear}`
      };
    }
  }

  let cleaned = q.replace(/(?:เดือน|ปี|พ\.?ศ\.?|ค\.?ศ\.?|year)\s*/gi, ' ').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);

  let detectedMonthIndex = undefined;
  let detectedYear = undefined;

  for (const part of parts) {
    const noDot = part.replace(/\./g, "");
    if (ALL_MONTH_INDEX_MAP[part] !== undefined && detectedMonthIndex === undefined) {
      detectedMonthIndex = ALL_MONTH_INDEX_MAP[part];
    } else if (ALL_MONTH_INDEX_MAP[noDot] !== undefined && detectedMonthIndex === undefined) {
      detectedMonthIndex = ALL_MONTH_INDEX_MAP[noDot];
    } else if (/^\d{4}$/.test(part) && detectedYear === undefined) {
      detectedYear = parseInt(part, 10);
    } else if (/^\d{2}$/.test(part) && detectedYear === undefined) {
      const shortYear = parseInt(part, 10);
      if (shortYear >= 50 && shortYear <= 99) {
        detectedYear = 2500 + shortYear; // พ.ศ.
      } else if (shortYear >= 0 && shortYear <= 49) {
        detectedYear = 2000 + shortYear; // ค.ศ.
      }
    } else {
      // ถ้ามี token อื่นที่ไม่ใช่เดือนและไม่ใช่เลขปี แปลว่าอาจเป็นคำค้นหาอื่น (เช่น ชื่อสาขา)
      return null;
    }
  }

  if (detectedMonthIndex !== undefined) {
    let adYear;
    let beYear;
    if (detectedYear !== undefined) {
      beYear = detectedYear > 2500 ? detectedYear : detectedYear + 543;
      adYear = detectedYear > 2500 ? detectedYear - 543 : detectedYear;
    } else {
      adYear = new Date().getFullYear();
      beYear = adYear + 543;
    }

    const startDate = new Date(adYear, detectedMonthIndex, 1, 0, 0, 0, 0);
    const endDate = new Date(adYear, detectedMonthIndex + 1, 1, 0, 0, 0, 0);

    return {
      startDate,
      endDate,
      monthIndex: detectedMonthIndex,
      year: adYear,
      beYear,
      label: `${THAI_MONTHS_FULL[detectedMonthIndex]} ${beYear}`
    };
  }

  return null;
};

export const formatScore = (val) => {
  if (val === undefined || val === null || val === "" || isNaN(Number(val))) return "-";
  return parseFloat(Number(val).toFixed(2)).toString();
};

export const getScoreStatus = (score) => {
  const s = Number(score) || 0;
  if (s < 70) {
    return {
      label: 'วิกฤต',
      badgeClass: 'bg-rose-100 text-rose-800 border border-rose-200',
      pillClass: 'bg-rose-50 text-rose-700 border-rose-200/60',
      textClass: 'text-rose-700',
      isCritical: true,
      isPassed: false
    };
  }
  if (s >= 85) {
    return {
      label: 'ผ่านเกณฑ์',
      badgeClass: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
      pillClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
      textClass: 'text-emerald-800',
      isCritical: false,
      isPassed: true
    };
  }
  return {
    label: 'ต้องปรับปรุง',
    badgeClass: 'bg-amber-100 text-amber-900 border border-amber-200',
    pillClass: 'bg-amber-50 text-amber-700 border-amber-200/60',
    textClass: 'text-amber-800',
    isCritical: false,
    isPassed: false
  };
};