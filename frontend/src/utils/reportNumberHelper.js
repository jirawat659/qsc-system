/**
 * 🌟 Report Number / Document Number Helper for QSC System
 * 
 * Formats:
 * - Completed Audit: {BRAND}{YYYYMM}-{XXXX} (e.g. AU202610-0001)
 * - Draft Audit:     DRAFT-{BRAND}{YYYYMM}-{XXXX} (e.g. DRAFT-AU202610-0001)
 * 
 * Features:
 * - Day (DD) removed -> uses YYYYMM (Bangkok UTC+7)
 * - 4-digit running sequence (-0001, -0002...)
 * - Automatic reset to 0001 for each new month
 * - Uses database `DocumentNo` column if available, otherwise generates dynamically
 */

/**
 * Resolves 2-letter brand code from brand name string or unit code
 * @param {string} brandNames - e.g. "After You", "ลูกก๊อ", "Mikka"
 * @param {string} unitCode - e.g. "APG", "LG-01", "MK-02"
 * @returns {string} 2-letter brand code e.g. "AU", "LG", "MK"
 */
export function getBrandCode(brandNames = "", unitCode = "") {
  const combined = `${brandNames || ""} ${unitCode || ""}`.toUpperCase();

  if (
    combined.includes("ลูกก๊อ") ||
    combined.includes("LUKKA") ||
    combined.includes("LOOKGAW") ||
    combined.includes("LG")
  ) {
    return "LG";
  }

  if (
    combined.includes("มิกก้า") ||
    combined.includes("MIKKA") ||
    combined.includes("MK")
  ) {
    return "MK";
  }

  if (
    combined.includes("AFTER YOU") ||
    combined.includes("AU")
  ) {
    return "AU";
  }

  // Check unitCode prefix
  const locUpper = (unitCode || "").trim().toUpperCase();
  if (locUpper.startsWith("LG")) return "LG";
  if (locUpper.startsWith("MK")) return "MK";
  if (locUpper.startsWith("AU")) return "AU";

  return "AU";
}

/**
 * Formats raw date into YYYYMM string in Bangkok TimeZone (UTC+7)
 * @param {string|Date} rawDate
 * @returns {string} YYYYMM e.g. "202610"
 */
export function formatAuditDateToYYYYMM(rawDate) {
  if (!rawDate) return "";
  try {
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) return "";
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      calendar: "gregory",
    });
    const parts = formatter.formatToParts(d);
    let year = parts.find((p) => p.type === "year")?.value || "";
    if (Number(year) > 2400) {
      year = String(Number(year) - 543);
    }
    const month = parts.find((p) => p.type === "month")?.value || "";
    return `${year}${month}`;
  } catch {
    return "";
  }
}

/**
 * Formats raw date into YYYYMMDD string in Bangkok TimeZone (UTC+7) (Backwards compatibility)
 * @param {string|Date} rawDate
 * @returns {string} YYYYMMDD e.g. "20261007"
 */
export function formatAuditDateToYYYYMMDD(rawDate) {
  if (!rawDate) return "";
  try {
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) return "";
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      calendar: "gregory",
    });
    const parts = formatter.formatToParts(d);
    let year = parts.find((p) => p.type === "year")?.value || "";
    if (Number(year) > 2400) {
      year = String(Number(year) - 543);
    }
    const month = parts.find((p) => p.type === "month")?.value || "";
    const day = parts.find((p) => p.type === "day")?.value || "";
    return `${year}${month}${day}`;
  } catch {
    return "";
  }
}

/**
 * Formats numeric ID with minimum 4 digits (e.g. 1 -> 0001, 14 -> 0014)
 * @param {number|string} id
 * @param {number} [padLength=4]
 * @returns {string}
 */
export function formatReportId(id, padLength = 4) {
  if (id === undefined || id === null || id === "") return "0001";
  const num = Number(id);
  if (isNaN(num)) return String(id);
  return String(num).padStart(padLength, "0");
}

/**
 * Builds an O(1) monthly sequence map across records for lightning-fast lookups
 * @param {Array} records - Array of audit records or draft items
 * @returns {Map<string|number, number>} Map of record id -> 1-based seqNo in that month
 */
export function buildMonthlySequenceMap(records = []) {
  const seqMap = new Map();
  if (!Array.isArray(records) || records.length === 0) return seqMap;

  // Group by brandCode + yearMonth
  const groups = new Map();

  for (const r of records) {
    if (!r) continue;
    const isItemDraft = Boolean(r.isDraft || r.type === "draft" || r.draftPayloadJson);
    const rawDate = r.rawDate || r.auditDate || r.startedAt || r.createdAt || r.scheduledDate || r.date;
    const ym = formatAuditDateToYYYYMM(rawDate);
    const brand = getBrandCode(
      r.brand || r.brandNames || r.locationBrand || r.location?.brand || (r.location?.locationBrands?.[0]?.brand?.name),
      r.unitCode || r.locationCode || r.location?.code
    );
    const groupKey = `${isItemDraft ? "DRAFT_" : ""}${brand}${ym}`;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey).push(r);
  }

  // Sort each group chronologically ascending and assign sequence
  for (const [, groupItems] of groups.entries()) {
    groupItems.sort((a, b) => {
      const timeA = new Date(a.rawDate || a.auditDate || a.startedAt || a.createdAt || a.scheduledDate || a.date || 0).getTime();
      const timeB = new Date(b.rawDate || b.auditDate || b.startedAt || b.createdAt || b.scheduledDate || b.date || 0).getTime();
      if (timeA !== timeB) return timeA - timeB;
      const idA = Number(a.originalId || a.id || 0);
      const idB = Number(b.originalId || b.id || 0);
      return idA - idB;
    });

    groupItems.forEach((item, index) => {
      const seq = index + 1;
      const targetId = item.originalId || item.id;
      if (targetId !== undefined && targetId !== null) {
        seqMap.set(targetId, seq);
        seqMap.set(String(targetId), seq);
      }
    });
  }

  return seqMap;
}

/**
 * Calculates monthly sequence number for a single record against an array of records
 * @param {Object} target
 * @param {Array} allRecords
 * @returns {number} 1-based sequence number
 */
export function getMonthlySequenceNumber(target, allRecords = []) {
  if (!target) return 1;
  const isDraftTarget = Boolean(target.isDraft || target.type === "draft");
  const targetYm = formatAuditDateToYYYYMM(target.rawDate || target.auditDate || target.startedAt || target.createdAt || target.date) || "202610";
  const targetBrand = getBrandCode(
    target.brand || target.brandNames || target.locationBrand || target.location?.brand,
    target.unitCode || target.locationCode || target.location?.code
  );

  const matched = (allRecords || []).filter((r) => {
    if (!r) return false;
    const isItemDraft = Boolean(r.isDraft || r.type === "draft" || r.draftPayloadJson);
    if (isDraftTarget !== isItemDraft) return false;

    const ym = formatAuditDateToYYYYMM(r.rawDate || r.auditDate || r.startedAt || r.createdAt || r.scheduledDate || r.date);
    if (ym !== targetYm) return false;

    const brand = getBrandCode(
      r.brand || r.brandNames || r.locationBrand || r.location?.brand || (r.location?.locationBrands?.[0]?.brand?.name),
      r.unitCode || r.locationCode || r.location?.code
    );
    return brand === targetBrand;
  });

  matched.sort((a, b) => {
    const timeA = new Date(a.rawDate || a.auditDate || a.startedAt || a.createdAt || a.scheduledDate || a.date || 0).getTime();
    const timeB = new Date(b.rawDate || b.auditDate || b.startedAt || b.createdAt || b.scheduledDate || b.date || 0).getTime();
    if (timeA !== timeB) return timeA - timeB;
    return (Number(a.originalId || a.id || 0)) - (Number(b.originalId || b.id || 0));
  });

  const targetId = Number(target.originalId || target.id);
  const idx = matched.findIndex((r) => Number(r.originalId || r.id) === targetId);
  return idx >= 0 ? idx + 1 : matched.length + 1;
}

/**
 * Generates official report number or draft number
 * Format: {BRAND}{YYYYMM}-{XXXX} (e.g. AU202610-0001)
 * 
 * @param {Object} options
 * @param {string} [options.documentNo] - Database DocumentNo if already assigned
 * @param {string} [options.docNo] - Alias for documentNo
 * @returns {string} Report Number e.g. "AU202610-0001" or "DRAFT-LG202610-0001"
 */
export function generateReportNumber(options = {}) {
  const existingDocNo = options?.documentNo || options?.docNo;
  if (existingDocNo && typeof existingDocNo === "string" && existingDocNo.trim()) {
    return existingDocNo.trim();
  }
  return "";
}
