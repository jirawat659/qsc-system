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

// 🔎 ตรวจจับข้อความค้นหาที่พิมพ์เป็น "เดือน" หรือ "เดือน+ปี" ภาษาไทยล้วนๆ
// เช่น "มีนาคม", "มี.ค", "มี.ค.", "มีนาคม 2568", "มี.ค 2568"
// - ไม่ใส่ปี -> default เป็นปีปัจจุบัน (ค.ศ.)
// - ใส่ปี พ.ศ. (>2500) -> แปลงเป็น ค.ศ. อัตโนมัติ
// คืนค่า null ถ้าข้อความทั้งหมดไม่ใช่ pattern เดือน/ปีล้วนๆ (กันไม่ให้ทับคำค้นหาอื่น เช่น ชื่อสาขา)
const THAI_FULL_MONTH_INDEX_MAP = THAI_MONTHS_FULL.reduce((acc, name, idx) => {
  acc[name] = idx;
  return acc;
}, {});

// รองรับกรณีผู้ใช้พิมพ์แบบตัดจุดออกหมด เช่น "ม.ค." -> "มค", "มี.ค." -> "มีค"
// สร้างจาก THAI_MONTH_INDEX_MAP อัตโนมัติ กันพลาดกรณีแก้ mapping ต้นทางแล้วลืมอัปเดตที่นี่
const THAI_MONTH_NO_DOT_INDEX_MAP = Object.keys(THAI_MONTH_INDEX_MAP).reduce((acc, key) => {
  const noDot = key.replace(/\./g, '');
  if (noDot) acc[noDot] = THAI_MONTH_INDEX_MAP[key];
  return acc;
}, {});

export const parseThaiMonthYearQuery = (text) => {
  if (!text) return null;
  // ตัดคำว่า "พ.ศ." / "ค.ศ." ที่ผู้ใช้อาจพิมพ์คั่นกลางระหว่างเดือนกับปีออกก่อน
  // เช่น "มีนาคม พ.ศ. 2568" หรือ "มี.ค. ค.ศ. 2025" -> เหลือแค่ "มีนาคม 2568"
  const q = text.trim().replace(/(?:พ\.ศ\.?|ค\.ศ\.?)\s*/g, '').trim();
  if (!q) return null;

  const match = q.match(/^([ก-๙.]+?)\s*(\d{4})?$/);
  if (!match) return null;

  const monthToken = match[1].trim();
  const allMonthTokens = { ...THAI_MONTH_INDEX_MAP, ...THAI_FULL_MONTH_INDEX_MAP, ...THAI_MONTH_NO_DOT_INDEX_MAP };
  const monthIndex = allMonthTokens[monthToken];
  if (monthIndex === undefined) return null;

  let year;
  if (match[2]) {
    year = parseInt(match[2], 10);
    if (year > 2500) year -= 543; // พ.ศ. -> ค.ศ.
  } else {
    year = new Date().getFullYear();
  }

  const startDate = new Date(year, monthIndex, 1, 0, 0, 0, 0);
  const endDate = new Date(year, monthIndex + 1, 1, 0, 0, 0, 0); // exclusive upper bound

  return {
    startDate,
    endDate,
    monthIndex,
    year,
    label: `${THAI_MONTHS_FULL[monthIndex]} ${year + 543}`
  };
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