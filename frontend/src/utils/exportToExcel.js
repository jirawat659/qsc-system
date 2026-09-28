// ต้องติดตั้ง: npm i xlsx-js-style   (ใช้ API เดียวกับ xlsx แต่รองรับ style: ตัวหนา/เส้นขอบ/จัดกึ่งกลาง)
// ถ้าไม่อยากเพิ่มไลบรารี เปลี่ยนบรรทัดนี้กลับเป็น  import * as XLSX from "xlsx";  ไฟล์ยังสร้างได้ แต่ style จะถูกข้าม
import * as XLSX from "xlsx";

const CATS = ["PD", "PC", "S", "C", "DM"];
const FONT = "Tahoma";
const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
];

// ============================================================
// 0. ช่วงเวลา (ใช้ร่วมกับ ExcelExportModal เพื่อให้กรองตรงกันทั้งฝั่งดึงข้อมูลและฝั่งสร้างไฟล์)
// ============================================================

// วันเริ่มของช่วงที่ผู้ใช้เลือก (null = ทั้งหมด)
export function getRangeStart(timeRange, now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (timeRange) {
    case "1M": return new Date(y, m, 1);
    case "3M": return new Date(y, m - 2, 1);
    case "6M": return new Date(y, m - 5, 1);
    case "1Y": return new Date(y, 0, 1); // ตาม label "ทั้งปี (YTD)"
    default: return null;
  }
}

// วันที่เริ่มดึงข้อมูลจาก API = ครอบคลุม (ช่วงที่เลือก) + (ต้นปีนี้ สำหรับชีทเฉลี่ยทั้งปี) + (ย้อนหลัง 3 เดือน สำหรับคำนวณ (2)/(3))
export function getFetchStart(timeRange, now = new Date()) {
  const start = getRangeStart(timeRange, now);
  if (!start) return null;
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const base = start < jan1 ? start : jan1;
  return new Date(base.getFullYear(), base.getMonth() - 3, 1);
}

// ส่งเป็น YYYY-MM-DD (เวลาท้องถิ่น) เพื่อไม่ให้โดนแปลง timezone ตอน bind DateTime ฝั่ง .NET
export function toDateParam(d) {
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ============================================================
// 1. ฟังก์ชันตัวช่วยจัดการข้อมูลและวันที่
// ============================================================

function formatThaiDateShort(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "-";
  return `${d.getDate()} ${THAI_MONTHS_SHORT[d.getMonth()]} ${(d.getFullYear() + 543) % 100}`;
}

// จัดรูปแบบเวลาเอง (เดิมใช้ toLocaleTimeString ต่อทุกแถว ซึ่งช้ากว่า) ผลลัพธ์เหมือนเดิม เช่น "07:07"
function extractTime(dateStr, timeStr) {
  if (timeStr) return timeStr;
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "-";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function extractTDS(record) {
  if (record.waterQualityTds != null) return record.waterQualityTds;
  if (record.tds != null) return record.tds;
  if (record.notes) {
    const match = record.notes.match(/(\d+)\s*(?:TDS|\/ppm|ppm)/i);
    if (match) return parseInt(match[1], 10);
  }
  return "-";
}

function getCategoryScores(record) {
  const catMap = { PD: [], PC: [], S: [], C: [], DM: [] };
  for (const res of record.responses || []) {
    if (res.isNa) continue;
    const code = (res.categoryCode || "").toUpperCase();
    if (catMap[code]) {
      catMap[code].push({ given: res.scoreGiven ?? 0, full: res.fullScore ?? 0 });
    }
  }
  const result = {};
  for (const [cat, items] of Object.entries(catMap)) {
    if (items.length === 0) {
      result[cat] = record[`score${cat}`] != null ? Math.round(record[`score${cat}`]) : "-";
    } else {
      const totalFull = items.reduce((s, i) => s + i.full, 0);
      const totalGiven = items.reduce((s, i) => s + i.given, 0);
      result[cat] = totalFull > 0 ? Math.round((totalGiven / totalFull) * 100) : "-";
    }
  }
  return result;
}

// คำนวณครั้งเดียวต่อรอบตรวจ (เดิมคำนวณซ้ำทุกชีท) + parse วันที่ครั้งเดียว
function enrich(records) {
  return records.map(r => ({
    ...r,
    _t: Date.parse(r.auditDate || r.date) || 0,
    _cats: getCategoryScores(r)
  }));
}

// ตัวย่อสาขา (2)/(3): จัดกลุ่มตามสาขา + เรียงครั้งเดียว แทนการ filter+sort ทั้งชุดข้อมูลต่อทุกแถว (เดิมเป็น O(n²) และทำซ้ำ 2 ชีท)
function buildSuffixMap(allRecords) {
  const byLoc = new Map();
  for (const r of allRecords) {
    if (!byLoc.has(r.locationId)) byLoc.set(r.locationId, []);
    byLoc.get(r.locationId).push({ id: r.id, t: r._t, s: Math.round(r.percentageScore ?? r.score ?? 100) });
  }
  const map = new Map();
  for (const list of byLoc.values()) {
    list.sort((a, b) => a.t - b.t); // เก่า -> ใหม่
    list.forEach((cur, i) => {
      if (i < 1) { map.set(cur.id, ""); return; }
      const s0 = cur.s;
      const s1 = list[i - 1].s;
      const s2 = i >= 2 ? list[i - 2].s : 100;
      map.set(cur.id, s0 < 85 && s1 < 85 && s2 < 85 ? "(3)" : s0 < 85 && s1 < 85 ? "(2)" : "");
    });
  }
  return map;
}

// ============================================================
// 2. ตัวช่วยจัดรูปแบบ (ไม่ใช้สี/กราฟ: ตัวหนา เส้นขอบ จัดกึ่งกลาง รูปแบบตัวเลข ตัวกรอง)
// ============================================================

const BLACK = { rgb: "000000" };
const BORDER = {
  top: { style: "thin", color: BLACK },
  bottom: { style: "thin", color: BLACK },
  left: { style: "thin", color: BLACK },
  right: { style: "thin", color: BLACK }
};

function putStyle(ws, r, c, style) {
  const addr = XLSX.utils.encode_cell({ r, c });
  if (!ws[addr]) ws[addr] = { t: "s", v: "" }; // ให้ช่องว่างมีเส้นขอบด้วย
  ws[addr].s = { ...(ws[addr].s || {}), ...style };
  return ws[addr];
}

function createSheet(aoa, widths) {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  if (widths?.length) ws["!cols"] = widths.map(w => ({ wch: w }));
  return ws;
}

/**
 * cols            จำนวนคอลัมน์ทั้งหมด
 * titleRows       แถว (เริ่มที่ 0) ที่เป็นหัวเรื่อง/คำอธิบาย → merge ทั้งแถว ไม่มีเส้นขอบ
 * headerRow       แถวหัวตาราง
 * firstDataRow..lastDataRow  ช่วงข้อมูล (นับตามแถวใน aoa เริ่มที่ 0)
 * summaryRow      แถวสรุป/เฉลี่ย (ถ้ามี)
 * leftCols        คอลัมน์ข้อความที่ชิดซ้าย (ที่เหลือจัดกึ่งกลาง)
 * numFmt          { คอลัมน์: "0" | "0.00" }
 */
function formatSheet(ws, { cols, titleRows = [], headerRow, firstDataRow, lastDataRow, summaryRow = null, leftCols = [], numFmt = {}, filter = false }) {
  const merges = [];
  titleRows.forEach((r, i) => {
    merges.push({ s: { r, c: 0 }, e: { r, c: cols - 1 } });
    putStyle(ws, r, 0, {
      font: { name: FONT, sz: i === 0 ? 14 : 10, bold: i === 0, italic: i > 0 },
      alignment: { horizontal: "left", vertical: "center" }
    });
  });
  if (merges.length) ws["!merges"] = merges;

  for (let c = 0; c < cols; c++) {
    putStyle(ws, headerRow, c, {
      font: { name: FONT, sz: 11, bold: true },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: BORDER
    });
  }

  const bodyRows = [];
  for (let r = firstDataRow; r <= lastDataRow; r++) bodyRows.push(r);
  if (summaryRow != null) bodyRows.push(summaryRow);

  for (const r of bodyRows) {
    const isSummary = r === summaryRow;
    for (let c = 0; c < cols; c++) {
      const cell = putStyle(ws, r, c, {
        font: { name: FONT, sz: 11, bold: isSummary },
        alignment: { horizontal: leftCols.includes(c) ? "left" : "center", vertical: "center" },
        border: BORDER
      });
      if (numFmt[c] && (cell.t === "n" || cell.f)) {
        cell.z = numFmt[c];
        cell.s.numFmt = numFmt[c];
      }
    }
  }

  ws["!rows"] = [];
  ws["!rows"][headerRow] = { hpt: 24 };

  if (filter && lastDataRow >= firstDataRow) {
    ws["!autofilter"] = {
      ref: XLSX.utils.encode_range({ s: { r: headerRow, c: 0 }, e: { r: lastDataRow, c: cols - 1 } })
    };
  }
}

// ============================================================
// 3. ฟังก์ชันสร้างชีตย่อยแต่ละชีต
// ============================================================

// ชีตที่ 1 & 2: ตารางบันทึกคะแนนตรวจ
function buildAuditRecordSheet(records, suffixMap, isSorted = false) {
  const now = new Date();
  const dateHeader = `25${(now.getFullYear() + 543) % 100}-${String(now.getMonth() + 1).padStart(2, "0")}-01 00:00:00`;

  const aoa = [
    [dateHeader],
    ["คำอธิบายเพิ่มเติม: ตัวย่อสาขา(2) หมายถึงเดือนปัจจุบันไม่ผ่านและเดือนที่ผ่านมาล่าสุดก็ไม่ผ่าน(ไม่ผ่าน 2 เดือนติดต่อกัน)"],
    ["คำอธิบายเพิ่มเติม: ตัวย่อสาขา(3) หมายถึงเดือนปัจจุบันไม่ผ่านและสองเดือนที่ผ่านมาล่าสุดก็ไม่ผ่าน(ไม่ผ่าน 3 เดือนติดต่อกัน)"],
    ["No.", "Branch", "Date", "Time", "On Shift ", "วัดคุณภาพน้ำ(TDS/ppm)", "PD.", "PC.", "S.", "C.", "DM.", "Percent", "Inspector"]
  ];
  const HEADER_ROW = 3;
  const FIRST_DATA = 4;

  const rows = [...records];
  if (isSorted) rows.sort((a, b) => (b.percentageScore || 0) - (a.percentageScore || 0));

  rows.forEach((r, idx) => {
    const cats = r._cats;
    const branchName = `${r.locationCode || r.locationName || "-"}${suffixMap.get(r.id) || ""}`;
    aoa.push([
      idx + 1,
      branchName,
      formatThaiDateShort(r.auditDate),
      extractTime(r.auditDate, r.time),
      r.teamOnShift || r.shiftLeader || "-",
      extractTDS(r),
      cats.PD, cats.PC, cats.S, cats.C, cats.DM,
      Math.round(r.percentageScore ?? r.score ?? 0),
      r.inspectorName || r.auditorName || "-"
    ]);
  });

  const count = rows.length;
  const lastDataRow = FIRST_DATA + count - 1;
  let summaryRow = null;
  if (count > 0) {
    const startRow = FIRST_DATA + 1; // เลขแถวแบบ Excel (เริ่มที่ 1)
    const endRow = FIRST_DATA + count;
    aoa.push([
      "เฉลี่ย", "", "", "", "", "",
      ...["G", "H", "I", "J", "K", "L"].map(col => ({ t: "n", f: `AVERAGE(${col}${startRow}:${col}${endRow})` })),
      ""
    ]);
    summaryRow = lastDataRow + 1;
  }

  const ws = createSheet(aoa, [6, 18, 14, 10, 16, 22, 8, 8, 8, 8, 8, 10, 20]);
  formatSheet(ws, {
    cols: 13, titleRows: [0, 1, 2], headerRow: HEADER_ROW,
    firstDataRow: FIRST_DATA, lastDataRow, summaryRow,
    leftCols: [1, 4, 12], numFmt: { 6: "0.00", 7: "0.00", 8: "0.00", 9: "0.00", 10: "0.00", 11: "0.00" },
    filter: true
  });
  return ws;
}

// ชีตที่ 3: สรุปคะแนนเฉลี่ยทั้งปี จัดเกรด A, B, C
function buildGradingSheet(yearRecords, year) {
  const branchMap = {};
  yearRecords.forEach(r => {
    const key = r.locationId || r.locationName;
    if (!branchMap[key]) {
      branchMap[key] = { name: r.locationCode || r.locationName, scores: [], cats: { PD: [], PC: [], S: [], C: [], DM: [] } };
    }
    branchMap[key].scores.push(Math.round(r.percentageScore || 0));
    for (const cat of CATS) {
      if (typeof r._cats[cat] === "number") branchMap[key].cats[cat].push(r._cats[cat]);
    }
  });

  const calcAvg = arr => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
  const branchList = Object.values(branchMap).map(b => ({
    name: b.name, avgScore: calcAvg(b.scores),
    PD: calcAvg(b.cats.PD), PC: calcAvg(b.cats.PC), S: calcAvg(b.cats.S), C: calcAvg(b.cats.C), DM: calcAvg(b.cats.DM)
  })).sort((a, b) => b.avgScore - a.avgScore);

  const groupA = branchList.filter(b => b.avgScore >= 90);
  const groupB = branchList.filter(b => b.avgScore >= 87 && b.avgScore < 90);
  const groupC = branchList.filter(b => b.avgScore < 87);

  const aoa = [
    [`AVG. ${year} & Divide into groups`],
    ["Groups", "No.", "Branch", "PD.", "PC.", "S.", "C.", "DM.", "Percent", "เกณฑ์", "ช่วงคะแนน"]
  ];
  let currentNo = 1;
  const appendGroup = (label, criteria, list) => {
    list.forEach((item, idx) => {
      aoa.push([
        idx === 0 ? `${label} (${list.length} Br.)` : "",
        currentNo++, item.name,
        item.PD, item.PC, item.S, item.C, item.DM, item.avgScore,
        idx === 0 ? label : "", idx === 0 ? criteria : ""
      ]);
    });
  };
  appendGroup("A", "90.00 - 100.00", groupA);
  appendGroup("B", "87.00 - 89.99", groupB);
  appendGroup("C", "< 87.00", groupC);

  const ws = createSheet(aoa, [16, 6, 18, 8, 8, 8, 8, 8, 10, 10, 16]);
  formatSheet(ws, {
    cols: 11, titleRows: [0], headerRow: 1, firstDataRow: 2, lastDataRow: aoa.length - 1,
    leftCols: [0, 2]
  });
  return ws;
}

// ชีตที่ 4: สรุปคะแนนเฉลี่ยแต่ละโซน
function buildZoneSheet(records) {
  const now = new Date();
  const dateHeader = `25${(now.getFullYear() + 543) % 100}-${String(now.getMonth() + 1).padStart(2, "0")}-01 00:00:00`;
  const aoa = [[dateHeader], ["อันดับ", "AEREA ZONE", "PD.", "PC.", "S.", "C.", "DM.", "Percent"]];

  const zoneMap = {};
  records.forEach(r => {
    const zone = r.locationRegion || r.inspectorName || "โซนทั่วไป";
    if (!zoneMap[zone]) zoneMap[zone] = { scores: [], PD: [], PC: [], S: [], C: [], DM: [] };
    zoneMap[zone].scores.push(Math.round(r.percentageScore || 0));
    for (const c of CATS) if (typeof r._cats[c] === "number") zoneMap[zone][c].push(r._cats[c]);
  });

  const calcAvg = arr => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : "-";
  const zoneList = Object.entries(zoneMap).map(([zone, d]) => ({
    zone, avgScore: calcAvg(d.scores), PD: calcAvg(d.PD), PC: calcAvg(d.PC), S: calcAvg(d.S), C: calcAvg(d.C), DM: calcAvg(d.DM)
  })).sort((a, b) => (typeof b.avgScore === "number" ? b.avgScore : 0) - (typeof a.avgScore === "number" ? a.avgScore : 0));

  zoneList.forEach((z, idx) => aoa.push([idx + 1, z.zone, z.PD, z.PC, z.S, z.C, z.DM, z.avgScore]));

  const FIRST_DATA = 2;
  const lastDataRow = FIRST_DATA + zoneList.length - 1;
  let summaryRow = null;
  if (zoneList.length > 0) {
    const lastExcelRow = zoneList.length + 2;
    aoa.push([
      "เฉลี่ย", "",
      ...["C", "D", "E", "F", "G", "H"].map(col => ({ t: "n", f: `AVERAGE(${col}3:${col}${lastExcelRow})` }))
    ]);
    summaryRow = lastDataRow + 1;
  }

  const ws = createSheet(aoa, [8, 20, 8, 8, 8, 8, 8, 10]);
  formatSheet(ws, {
    cols: 8, titleRows: [0], headerRow: 1, firstDataRow: FIRST_DATA, lastDataRow, summaryRow,
    leftCols: [1], numFmt: { 2: "0.00", 3: "0.00", 4: "0.00", 5: "0.00", 6: "0.00", 7: "0.00" }
  });
  return ws;
}

// ชีตที่ 5: ข้อมูลเกินอายุ.ไม่ได้คุณภาพ
function buildDefectSheet(records) {
  const aoa = [["No.", "Branch", "Date", "Team on Shift", "รายละเอียด/จำนวนรายการ"]];
  let count = 1;
  records.forEach(r => {
    const defects = (r.responses || []).filter(res => res.isCritical || !res.isPassed);
    if (defects.length > 0) {
      defects.forEach(res => {
        aoa.push([
          count++, r.locationName || r.locationCode || "-", formatThaiDateShort(r.auditDate), r.teamOnShift || r.shiftLeader || "-",
          `${res.questionText || res.categoryName || "ข้อตรวจ"}: ${res.notes || "ไม่ผ่านเกณฑ์"}`
        ]);
      });
    } else if (r.hasCriticalDefect || (r.notes && r.notes.includes("Waste"))) {
      aoa.push([
        count++, r.locationName || r.locationCode || "-", formatThaiDateShort(r.auditDate), r.teamOnShift || r.shiftLeader || "-",
        r.notes || "พบข้อบกพร่องวิกฤต/สินค้าหมดอายุ"
      ]);
    }
  });
  if (aoa.length === 1) aoa.push(["-", "ไม่พบรายการสินค้าเกินอายุหรือไม่ได้คุณภาพ", "-", "-", "-"]);

  const ws = createSheet(aoa, [6, 20, 16, 18, 50]);
  formatSheet(ws, {
    cols: 5, titleRows: [], headerRow: 0, firstDataRow: 1, lastDataRow: aoa.length - 1,
    leftCols: [1, 3, 4], filter: true
  });
  // ข้อความรายละเอียดยาว → ตัดบรรทัดในช่อง
  for (let r = 1; r < aoa.length; r++) {
    const c = ws[XLSX.utils.encode_cell({ r, c: 4 })];
    if (c) c.s = { ...c.s, alignment: { horizontal: "left", vertical: "top", wrapText: true } };
  }
  return ws;
}

// ============================================================
// 4. ฟังก์ชันหลักสำหรับ Export (Entry Point)
// ============================================================

export function exportToExcel({
  formName = "AU. Operation Excellence",
  region = "all",
  timeRange = "all",
  auditRecords = []
}) {
  const now = new Date();
  const monthStr = String(now.getMonth() + 1).padStart(2, "0");
  const yearShort = (now.getFullYear() + 543) % 100;
  const cleanFormName = (formName || "QSC_Report").replace(/[\\/:*?"<>|]/g, "_").trim();
  const filename = `${cleanFormName} ${monthStr}.${yearShort}.xlsx`;

  const all = enrich(auditRecords);
  const suffixMap = buildSuffixMap(all); // ใช้ข้อมูลทั้งหมด (รวมช่วงก่อนหน้า) เพื่อให้ (2)/(3) ถูกต้อง

  // กรองตามช่วงเวลาที่เลือก + ภูมิภาค
  const rangeStart = getRangeStart(timeRange);
  let records = rangeStart ? all.filter(r => r._t >= rangeStart.getTime()) : all;
  if (region !== "all") records = records.filter(r => (r.locationRegion || "").includes(region));

  // ชีท "เฉลี่ยทั้งปี" ใช้เฉพาะปีปัจจุบัน (เดิมใช้ทุกรอบตั้งแต่เริ่มระบบ ทั้งที่หัวชีทเขียนว่า AVG. ปีนี้)
  const year = now.getFullYear();
  const yearRecords = all.filter(r => new Date(r._t).getFullYear() === year);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildAuditRecordSheet(records, suffixMap, false), "บันทึกคะแนนตรวจ ");
  XLSX.utils.book_append_sheet(wb, buildAuditRecordSheet(records, suffixMap, true), "บันทึกคะแนนตรวจ(เรียงอันดับ)");
  XLSX.utils.book_append_sheet(wb, buildGradingSheet(yearRecords, year), "คะแนนเฉลี่ยทั้งปี");
  XLSX.utils.book_append_sheet(wb, buildZoneSheet(records), "คะแนนเฉลี่ยแต่ละโซน");
  XLSX.utils.book_append_sheet(wb, buildDefectSheet(records), "ข้อมูลเกินอายุ.ไม่ได้คุณภาพ");

  XLSX.writeFile(wb, filename);
}

export default exportToExcel;