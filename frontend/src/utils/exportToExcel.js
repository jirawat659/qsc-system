/**
 * exportToExcel.js — Multi-Sheet .xlsx Export
 *
 * ใช้ SheetJS (xlsx) สร้างไฟล์ Excel หลายชีทจากฐานข้อมูลกลางชุดเดียว
 * ไม่มีการ copy-paste ข้อมูลซ้ำ ทุกชีทสร้างจาก auditRecords ชุดเดียวกัน
 *
 * รายงาน Type A (mode="org") — เปิดจาก Dashboard หลัก:
 *   ชีท 1: บันทึกดิบ     — ทุก record ทุกสาขา
 *   ชีท 2: อันดับเดือนนี้ — Top-N เรียงคะแนน
 *   ชีท 3: เฉลี่ยแยกหมวด — PD/PC/S/C/DM เฉลี่ยทุกสาขา
 *   ชีท 4: เทรนด์รายปี   — % รวมรายเดือน (ม.ค.–ธ.ค.)
 *   ชีท 5: จัดเกรดประจำปี — เฉลี่ยทั้งปี + เกรด A/B/C/D
 *
 * รายงาน Type B (mode="branch") — เปิดจาก Branch Profile:
 *   ชีท 1: ประวัติคะแนน  — ทุกรอบของสาขานั้น
 *   ชีท 2: คำตอบรายข้อ   — รอบล่าสุด ทุกคำถาม + คะแนน + หมวด
 *   ชีท 3: สรุปหมวด      — เฉลี่ย PD/PC/S/C/DM ย้อนหลัง
 */

import * as XLSX from "xlsx";

// ============================================================
// HELPERS
// ============================================================

const THAI_MONTHS_FULL = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
];
const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
];

function thaiDate(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "-";
  const day = d.getDate();
  const month = THAI_MONTHS_FULL[d.getMonth()];
  const year = d.getFullYear() + 543;
  return `${day} ${month} ${year}`;
}

function thaiDateShort(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "-";
  return `${d.getDate()} ${THAI_MONTHS_SHORT[d.getMonth()]} ${(d.getFullYear() + 543) % 100}`;
}

function gradeLabel(avg) {
  if (avg >= 90) return "A — ดีเยี่ยม";
  if (avg >= 87) return "B — ดีมาก";
  if (avg >= 85) return "C — ผ่านเกณฑ์";
  return "D — ต่ำกว่าเกณฑ์";
}

function passLabel(score) {
  if (score >= 90) return "ดีเยี่ยม";
  if (score >= 85) return "ผ่านเกณฑ์";
  return "ต่ำกว่าเกณฑ์";
}

/** กรองช่วงเวลาจาก records */
function filterByTimeRange(records, timeRange) {
  if (!timeRange || timeRange === "all") return records;
  const now = new Date();
  let cutoff;
  if (timeRange === "1M") cutoff = new Date(now.getFullYear(), now.getMonth(), 1);
  else if (timeRange === "3M") cutoff = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  else if (timeRange === "6M") cutoff = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  else if (timeRange === "1Y") cutoff = new Date(now.getFullYear(), 0, 1);
  if (!cutoff) return records;
  return records.filter(r => {
    const d = new Date(r.auditDate || r.date);
    return !isNaN(d.getTime()) && d >= cutoff;
  });
}

/** ดึงคะแนนแยกหมวด PD/PC/S/C/DM จาก responses ของ record หนึ่ง */
function getCategoryScores(record) {
  const catMap = { PD: [], PC: [], S: [], C: [], DM: [] };
  const responses = record.responses || [];
  for (const res of responses) {
    if (res.isNa) continue;
    const code = (res.categoryCode || "").toUpperCase();
    if (catMap[code]) {
      catMap[code].push({ given: res.scoreGiven ?? 0, full: res.fullScore ?? 0 });
    }
  }
  const result = {};
  for (const [cat, items] of Object.entries(catMap)) {
    if (items.length === 0) {
      result[cat] = null;
    } else {
      const totalFull = items.reduce((s, i) => s + i.full, 0);
      const totalGiven = items.reduce((s, i) => s + i.given, 0);
      result[cat] = totalFull > 0 ? Math.round((totalGiven / totalFull) * 100) : null;
    }
  }
  return result;
}

/** สร้าง sheet จาก array ของ row objects */
function makeSheet(rows, colWidths) {
  const ws = XLSX.utils.json_to_sheet(rows, { skipHeader: false });
  if (colWidths) {
    ws["!cols"] = colWidths.map(w => ({ wch: w }));
  }
  return ws;
}

// ============================================================
// SHEET BUILDERS — TYPE A (Org-level)
// ============================================================

/** ชีท 1: บันทึกดิบ */
function buildRawLogSheet(records, locations) {
  const locMap = {};
  (locations || []).forEach(l => { locMap[l.id] = l; });

  const rows = records.map((r, i) => {
    const cats = getCategoryScores(r);
    const score = Math.round(r.percentageScore || 0);
    return {
      "ลำดับ": i + 1,
      "รหัสสาขา": r.locationCode || "-",
      "ชื่อสาขา": r.locationName || "-",
      "ภูมิภาค": r.locationRegion || "-",
      "วันที่ตรวจ": thaiDate(r.auditDate),
      "ประเภทการตรวจ": r.auditType === "unannounced" ? "ไม่แจ้งล่วงหน้า" : "แจ้งล่วงหน้า",
      "ผู้ตรวจ": r.auditorName || "-",
      "ผู้รับการตรวจ": r.auditeeName || "-",
      "PD (%)": cats.PD !== null ? cats.PD : "-",
      "PC (%)": cats.PC !== null ? cats.PC : "-",
      "S (%)": cats.S !== null ? cats.S : "-",
      "C (%)": cats.C !== null ? cats.C : "-",
      "DM (%)": cats.DM !== null ? cats.DM : "-",
      "คะแนนรวม (%)": score,
      "ผลการตรวจ": passLabel(score),
      "Critical Defect": r.hasCriticalDefect ? "พบ" : "-",
      "หมายเหตุ": r.notes || "-"
    };
  });

  if (rows.length === 0) {
    rows.push({ "ลำดับ": "-", "รหัสสาขา": "ไม่มีข้อมูลในช่วงเวลาที่เลือก" });
  }

  return makeSheet(rows, [5, 12, 20, 14, 16, 16, 18, 18, 8, 8, 8, 8, 8, 14, 14, 14, 30]);
}

/** ชีท 2: อันดับเดือนนี้ */
function buildMonthlyRankSheet(records) {
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  // กรองเฉพาะเดือนปัจจุบัน แล้วหาคะแนนล่าสุดต่อสาขา
  const monthRecords = records.filter(r => {
    const d = new Date(r.auditDate);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  });

  // รวมกลุ่มตามสาขา → เอาคะแนนล่าสุด
  const byBranch = {};
  for (const r of monthRecords) {
    const key = r.locationId;
    if (!byBranch[key] || new Date(r.auditDate) > new Date(byBranch[key].auditDate)) {
      byBranch[key] = r;
    }
  }

  const ranked = Object.values(byBranch)
    .sort((a, b) => b.percentageScore - a.percentageScore);

  const rows = ranked.map((r, i) => {
    const score = Math.round(r.percentageScore || 0);
    return {
      "อันดับ": i + 1,
      "รหัสสาขา": r.locationCode || "-",
      "ชื่อสาขา": r.locationName || "-",
      "ภูมิภาค": r.locationRegion || "-",
      "คะแนน (%)": score,
      "ผล": passLabel(score),
      "วันที่ตรวจ": thaiDate(r.auditDate),
      "ผู้ตรวจ": r.auditorName || "-"
    };
  });

  const label = `เดือน${THAI_MONTHS_FULL[thisMonth]} ${now.getFullYear() + 543}`;
  if (rows.length === 0) {
    rows.push({ "อันดับ": "-", "รหัสสาขา": `ยังไม่มีผลตรวจใน${label}` });
  }

  return makeSheet(rows, [6, 12, 22, 14, 12, 14, 16, 18]);
}

/** ชีท 3: เฉลี่ยแยกหมวด (ทุกสาขา) */
function buildCategoryAvgSheet(records) {
  // รวมกลุ่มตามสาขา
  const branchData = {};
  for (const r of records) {
    const key = r.locationId;
    if (!branchData[key]) {
      branchData[key] = { name: r.locationName, region: r.locationRegion, PD: [], PC: [], S: [], C: [], DM: [], overall: [] };
    }
    const cats = getCategoryScores(r);
    for (const cat of ["PD", "PC", "S", "C", "DM"]) {
      if (cats[cat] !== null) branchData[key][cat].push(cats[cat]);
    }
    branchData[key].overall.push(Math.round(r.percentageScore || 0));
  }

  const avg = arr => arr.length > 0 ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : "-";

  const rows = Object.values(branchData).map(b => ({
    "ชื่อสาขา": b.name || "-",
    "ภูมิภาค": b.region || "-",
    "PD — Product (%)": avg(b.PD),
    "PC — Process (%)": avg(b.PC),
    "S — Service (%)": avg(b.S),
    "C — Cleanliness (%)": avg(b.C),
    "DM — Documents (%)": avg(b.DM),
    "รวมเฉลี่ย (%)": avg(b.overall),
    "จำนวนรอบตรวจ": b.overall.length
  }));

  if (rows.length === 0) {
    rows.push({ "ชื่อสาขา": "ไม่มีข้อมูล responses (ต้องใช้ includeResponses=true)" });
  }

  return makeSheet(rows, [22, 14, 16, 16, 16, 16, 16, 14, 12]);
}

/** ชีท 4: เทรนด์รายปี (รวมทุกสาขา รายเดือน) */
function buildYearlyTrendSheet(records) {
  const now = new Date();
  const thisYear = now.getFullYear();

  // สร้าง bucket 12 เดือน
  const monthly = Array.from({ length: 12 }, () => []);
  for (const r of records) {
    const d = new Date(r.auditDate);
    if (d.getFullYear() === thisYear) {
      monthly[d.getMonth()].push(Math.round(r.percentageScore || 0));
    }
  }

  const avg = arr => arr.length > 0 ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : "-";

  // บริษัทรวม
  const companyRow = { "มุมมอง": `บริษัทรวม (${thisYear + 543})` };
  THAI_MONTHS_SHORT.forEach((m, i) => {
    companyRow[m] = avg(monthly[i]);
    companyRow[`จำนวน (${m})`] = monthly[i].length;
  });

  // แยกภูมิภาค
  const regionData = {};
  for (const r of records) {
    const d = new Date(r.auditDate);
    if (d.getFullYear() !== thisYear) continue;
    const reg = r.locationRegion || "ไม่ระบุภูมิภาค";
    if (!regionData[reg]) regionData[reg] = Array.from({ length: 12 }, () => []);
    regionData[reg][d.getMonth()].push(Math.round(r.percentageScore || 0));
  }

  const rows = [companyRow];
  for (const [reg, mthData] of Object.entries(regionData)) {
    const row = { "มุมมอง": `ภูมิภาค: ${reg}` };
    THAI_MONTHS_SHORT.forEach((m, i) => {
      row[m] = avg(mthData[i]);
      row[`จำนวน (${m})`] = mthData[i].length;
    });
    rows.push(row);
  }

  const colWidths = [24, ...Array(24).fill(8)];
  return makeSheet(rows, colWidths);
}

/** ชีท 5: จัดเกรดประจำปี */
function buildGradeSheet(records, locations) {
  const now = new Date();
  const thisYear = now.getFullYear();

  // กรองเฉพาะปีนี้ รวมกลุ่มตามสาขา
  const byBranch = {};
  for (const r of records) {
    const d = new Date(r.auditDate);
    if (d.getFullYear() !== thisYear) continue;
    const key = r.locationId;
    if (!byBranch[key]) {
      byBranch[key] = { name: r.locationName, code: r.locationCode, region: r.locationRegion, scores: [] };
    }
    byBranch[key].scores.push(Math.round(r.percentageScore || 0));
  }

  const avg = arr => arr.length > 0 ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0;

  const sorted = Object.values(byBranch)
    .map(b => ({ ...b, avg: avg(b.scores) }))
    .sort((a, b) => b.avg - a.avg);

  const rows = sorted.map((b, i) => ({
    "อันดับ": i + 1,
    "รหัสสาขา": b.code || "-",
    "ชื่อสาขา": b.name || "-",
    "ภูมิภาค": b.region || "-",
    "เฉลี่ยทั้งปี (%)": b.avg,
    "จำนวนรอบตรวจ": b.scores.length,
    "เกรด": gradeLabel(b.avg),
    "สูงสุด (%)": Math.max(...b.scores),
    "ต่ำสุด (%)": Math.min(...b.scores)
  }));

  if (rows.length === 0) {
    rows.push({ "อันดับ": "-", "ชื่อสาขา": `ยังไม่มีผลตรวจในปี ${thisYear + 543}` });
  }

  return makeSheet(rows, [6, 12, 22, 14, 14, 12, 22, 10, 10]);
}

// ============================================================
// SHEET BUILDERS — TYPE B (Branch-level)
// ============================================================

/** ชีท B1: ประวัติคะแนนสาขา */
function buildBranchHistorySheet(records, unit) {
  const unitRecords = records
    .filter(r => r.locationId === unit?.id || r.locationName === unit?.name)
    .sort((a, b) => new Date(b.auditDate) - new Date(a.auditDate));

  const rows = unitRecords.map((r, i) => {
    const score = Math.round(r.percentageScore || 0);
    const cats = getCategoryScores(r);
    return {
      "ครั้งที่": i + 1,
      "วันที่ตรวจ": thaiDate(r.auditDate),
      "ประเภท": r.auditType === "unannounced" ? "ไม่แจ้งล่วงหน้า" : "แจ้งล่วงหน้า",
      "ผู้ตรวจ": r.auditorName || "-",
      "ผู้รับการตรวจ": r.auditeeName || "-",
      "PD (%)": cats.PD !== null ? cats.PD : "-",
      "PC (%)": cats.PC !== null ? cats.PC : "-",
      "S (%)": cats.S !== null ? cats.S : "-",
      "C (%)": cats.C !== null ? cats.C : "-",
      "DM (%)": cats.DM !== null ? cats.DM : "-",
      "คะแนนรวม (%)": score,
      "ผล": passLabel(score),
      "Critical Defect": r.hasCriticalDefect ? "พบ" : "-",
      "หมายเหตุ": r.notes || "-"
    };
  });

  if (rows.length === 0) {
    rows.push({ "ครั้งที่": "-", "วันที่ตรวจ": "ยังไม่มีประวัติการตรวจ" });
  }

  return makeSheet(rows, [6, 16, 16, 18, 18, 8, 8, 8, 8, 8, 13, 13, 13, 30]);
}

/** ชีท B2: คำตอบรายข้อ (รอบล่าสุด) */
function buildDetailResponseSheet(records, unit) {
  const unitRecords = records
    .filter(r => r.locationId === unit?.id || r.locationName === unit?.name)
    .sort((a, b) => new Date(b.auditDate) - new Date(a.auditDate));

  const latest = unitRecords[0];
  if (!latest) {
    return makeSheet([{ "หมายเหตุ": "ยังไม่มีประวัติการตรวจสาขานี้" }], [50]);
  }

  const responses = latest.responses || [];
  if (responses.length === 0) {
    return makeSheet([{
      "หมายเหตุ": "ไม่พบข้อมูล responses — กรุณาส่งออกอีกครั้ง (API ส่ง includeResponses=true)"
    }], [60]);
  }

  const rows = responses.map((res, i) => {
    const pct = res.fullScore > 0 ? Math.round((res.scoreGiven / res.fullScore) * 100) : 0;
    return {
      "ข้อที่": i + 1,
      "หมวด (Section)": res.sectionTitle || "-",
      "หมวดหมู่ (Category)": res.categoryName || "-",
      "รหัสหมวด": res.categoryCode || "-",
      "คำถาม": res.questionText || "-",
      "Critical": res.isCritical ? "★" : "",
      "N/A": res.isNa ? "✓" : "",
      "คะแนนเต็ม": res.isNa ? "-" : res.fullScore,
      "คะแนนที่ได้": res.isNa ? "-" : res.scoreGiven,
      "% ข้อนี้": res.isNa ? "-" : pct,
      "ผล": res.isNa ? "N/A" : (res.isPassed ? "ผ่าน" : "ไม่ผ่าน"),
      "หมายเหตุผู้ตรวจ": res.notes || ""
    };
  });

  return makeSheet(rows, [5, 20, 18, 10, 50, 7, 5, 10, 10, 10, 10, 40]);
}

/** ชีท B3: สรุปหมวดสาขา (เฉลี่ยทุกรอบ) */
function buildBranchCategorySheet(records, unit) {
  const unitRecords = records
    .filter(r => r.locationId === unit?.id || r.locationName === unit?.name)
    .sort((a, b) => new Date(b.auditDate) - new Date(a.auditDate));

  const catAcc = { PD: [], PC: [], S: [], C: [], DM: [] };
  for (const r of unitRecords) {
    const cats = getCategoryScores(r);
    for (const cat of Object.keys(catAcc)) {
      if (cats[cat] !== null) catAcc[cat].push(cats[cat]);
    }
  }

  const avg = arr => arr.length > 0 ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : "-";

  const CAT_LABELS = {
    PD: "PD — Product (ผลิตภัณฑ์)",
    PC: "PC — Process (กระบวนการ)",
    S:  "S — Service (บริการ)",
    C:  "C — Cleanliness (ความสะอาด)",
    DM: "DM — Documents/Management (เอกสาร)"
  };

  const rows = Object.entries(catAcc).map(([code, scores]) => ({
    "รหัสหมวด": code,
    "ชื่อหมวด": CAT_LABELS[code] || code,
    "เฉลี่ย (%)": avg(scores),
    "จำนวนรอบที่มีข้อมูล": scores.length,
    "สูงสุด (%)": scores.length > 0 ? Math.max(...scores) : "-",
    "ต่ำสุด (%)": scores.length > 0 ? Math.min(...scores) : "-"
  }));

  // สรุปคะแนนรวมด้านล่าง
  const overallScores = unitRecords.map(r => Math.round(r.percentageScore || 0));
  rows.push({
    "รหัสหมวด": "รวม",
    "ชื่อหมวด": "คะแนนรวม Q.S.C.",
    "เฉลี่ย (%)": avg(overallScores),
    "จำนวนรอบที่มีข้อมูล": overallScores.length,
    "สูงสุด (%)": overallScores.length > 0 ? Math.max(...overallScores) : "-",
    "ต่ำสุด (%)": overallScores.length > 0 ? Math.min(...overallScores) : "-"
  });

  return makeSheet(rows, [10, 30, 12, 18, 12, 12]);
}

// ============================================================
// MAIN EXPORT FUNCTION
// ============================================================

/**
 * @param {Object} options
 * @param {"org"|"branch"} options.mode   - "org" = รายงานระดับองค์กร, "branch" = รายงานรายสาขา
 * @param {Object}  options.targetUnit    - สาขาที่เลือก (mode="branch")
 * @param {string}  options.timeRange     - "all"|"1M"|"3M"|"6M"|"1Y"
 * @param {string}  options.timeRangeLabel - ป้ายช่วงเวลา (แสดงใน header)
 * @param {string}  options.region        - "all"|ชื่อภูมิภาค
 * @param {Array}   options.locations     - รายการสาขาทั้งหมด
 * @param {Array}   options.auditRecords  - ผลตรวจทั้งหมด (รวม responses ถ้า includeResponses=true)
 */
export function exportToExcel({
  mode = "org",
  targetUnit = null,
  timeRange = "all",
  timeRangeLabel = null,
  region = "all",
  locations = [],
  auditRecords = []
}) {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const thaiYear = now.getFullYear() + 543;
  const resolvedLabel = timeRangeLabel || (timeRange === "all" ? "ทั้งหมด" : `ย้อนหลัง ${timeRange}`);

  // กรองช่วงเวลา
  let filteredRecords = filterByTimeRange(auditRecords, timeRange);

  // กรองภูมิภาค (สำหรับ mode=org)
  if (mode === "org" && region !== "all") {
    filteredRecords = filteredRecords.filter(r =>
      (r.locationRegion || "").includes(region)
    );
  }

  const wb = XLSX.utils.book_new();

  if (mode === "org") {
    // ======= Type A: รายงานระดับองค์กร (5 ชีท) =======
    XLSX.utils.book_append_sheet(wb, buildRawLogSheet(filteredRecords, locations),     "1.บันทึกดิบ");
    XLSX.utils.book_append_sheet(wb, buildMonthlyRankSheet(filteredRecords),            "2.อันดับเดือนนี้");
    XLSX.utils.book_append_sheet(wb, buildCategoryAvgSheet(filteredRecords),            "3.เฉลี่ยแยกหมวด");
    XLSX.utils.book_append_sheet(wb, buildYearlyTrendSheet(filteredRecords),            "4.เทรนด์รายปี");
    XLSX.utils.book_append_sheet(wb, buildGradeSheet(filteredRecords, locations),       "5.จัดเกรดประจำปี");

    const filename = `QSC_Master_Report_${region !== "all" ? region + "_" : ""}${timeRange}_${dateStr}.xlsx`;
    XLSX.writeFile(wb, filename);

  } else if (mode === "branch" && targetUnit) {
    // ======= Type B: รายงานรายสาขา (3 ชีท) =======
    // ไม่กรองช่วงเวลาสำหรับ branch history (ใช้ทั้งหมด แล้วชีทแต่ละอันจัดการเอง)
    const allBranchRecords = filterByTimeRange(auditRecords, timeRange);

    XLSX.utils.book_append_sheet(wb, buildBranchHistorySheet(allBranchRecords, targetUnit), "1.ประวัติคะแนน");
    XLSX.utils.book_append_sheet(wb, buildDetailResponseSheet(auditRecords, targetUnit),     "2.คำตอบรายข้อ(ล่าสุด)");
    XLSX.utils.book_append_sheet(wb, buildBranchCategorySheet(allBranchRecords, targetUnit), "3.สรุปหมวด");

    const safeName = (targetUnit.name || "branch").replace(/[/\\?*[\]]/g, "-");
    const filename = `QSC_${safeName}_${timeRange}_${dateStr}.xlsx`;
    XLSX.writeFile(wb, filename);

  } else {
    console.warn("exportToExcel: mode ไม่ถูกต้องหรือไม่ระบุ targetUnit");
  }
}

export default exportToExcel;