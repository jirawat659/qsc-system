/**
 * 🌟 Report Number Helper for QSC System
 * 
 * Formats:
 * - Completed Audit: {BRAND}{YYYYMMDD}-{ID} (e.g. AU20261007-0001 or AU20261008-14671)
 * - Draft Audit:     DRAFT-{BRAND}{YYYYMMDD}-{ID} (e.g. DRAFT-LG20261007-0105)
 * 
 * ID is based on the primary key in the database:
 * - AuditRecord.Id for completed audits
 * - AuditDraft.Id for drafts
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
 * Formats raw date into YYYYMMDD string in Bangkok TimeZone (UTC+7)
 * @param {string|Date} rawDate
 * @returns {string} YYYYMMDD e.g. "20261007"
 */
export function formatAuditDateToYYYYMMDD(rawDate) {
  if (!rawDate) return "";
  try {
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) return "";

    const bangkokTime = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
    const yyyy = bangkokTime.getFullYear();
    const mm = String(bangkokTime.getMonth() + 1).padStart(2, "0");
    const dd = String(bangkokTime.getDate()).padStart(2, "0");
    return `${yyyy}${mm}${dd}`;
  } catch {
    return "";
  }
}

/**
 * Formats numeric ID with minimum 4 digits (e.g. 1 -> 0001, 14671 -> 14671)
 * @param {number|string} id
 * @returns {string}
 */
export function formatReportId(id) {
  if (id === undefined || id === null || id === "") return "0000";
  const num = Number(id);
  if (isNaN(num)) return String(id);
  return String(num).padStart(4, "0");
}

/**
 * Generates official report number or draft number
 * @param {Object} options
 * @param {number|string} options.id - Database PK (AuditRecord.Id or AuditDraft.Id)
 * @param {string} [options.brand] - Brand name
 * @param {string} [options.brandNames] - Brand names string
 * @param {string} [options.unitCode] - Location unit code
 * @param {string|Date} [options.date] - Audit date
 * @param {string|Date} [options.rawDate] - Raw audit date
 * @param {boolean} [options.isDraft] - Whether this is a draft audit
 * @param {string} [options.type] - Log type ('completed' | 'draft' | 'schedule')
 * @returns {string} Report Number e.g. "AU20261007-0001" or "DRAFT-LG20261007-0105"
 */
export function generateReportNumber({
  id,
  brand,
  brandNames,
  unitCode,
  date,
  rawDate,
  isDraft = false,
  type = ""
} = {}) {
  if (id === undefined || id === null || id === "") return "";

  const brandCode = getBrandCode(brand || brandNames, unitCode);
  const dateStr = formatAuditDateToYYYYMMDD(rawDate || date);
  const paddedId = formatReportId(id);
  const isDraftItem = Boolean(isDraft || type === "draft");

  if (isDraftItem) {
    return `DRAFT-${brandCode}${dateStr}-${paddedId}`;
  }

  return `${brandCode}${dateStr}-${paddedId}`;
}
