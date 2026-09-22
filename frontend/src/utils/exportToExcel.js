import * as XLSX from "xlsx";

// ============================================================
// 1. ฟังก์ชันตัวช่วยจัดการข้อมูลและวันที่
// ============================================================

const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
];

function formatThaiDateShort(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "-";
  return `${d.getDate()} ${THAI_MONTHS_SHORT[d.getMonth()]} ${(d.getFullYear() + 543) % 100}`;
}

function extractTime(dateStr, timeStr) {
  if (timeStr) return timeStr;
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? "-" : d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
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
      result[cat] = record[`score${cat}`] != null ? Math.round(record[`score${cat}`]) : "-";
    } else {
      const totalFull = items.reduce((s, i) => s + i.full, 0);
      const totalGiven = items.reduce((s, i) => s + i.given, 0);
      result[cat] = totalFull > 0 ? Math.round((totalGiven / totalFull) * 100) : "-";
    }
  }
  return result;
}

function getBranchFailSuffix(locationId, allRecords, auditDate) {
  if (!locationId || !allRecords || allRecords.length === 0) return "";
  const targetDate = new Date(auditDate || new Date());
  const history = allRecords
    .filter(r => r.locationId === locationId && new Date(r.auditDate || r.date) <= targetDate)
    .sort((a, b) => new Date(b.auditDate || b.date) - new Date(a.auditDate || a.date));

  if (history.length < 2) return "";
  const s0 = Math.round(history[0]?.percentageScore ?? history[0]?.score ?? 100);
  const s1 = Math.round(history[1]?.percentageScore ?? history[1]?.score ?? 100);
  const s2 = history[2] ? Math.round(history[2]?.percentageScore ?? history[2]?.score ?? 100) : 100;

  if (s0 < 85 && s1 < 85 && s2 < 85) return "(3)";
  if (s0 < 85 && s1 < 85) return "(2)";
  return "";
}

function createSheetWithWidths(aoa, widths) {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  if (widths && widths.length > 0) {
    ws["!cols"] = widths.map(w => ({ wch: w }));
  }
  return ws;
}

// ============================================================
// 2. ฟังก์ชันสร้างชีตย่อยแต่ละชีต
// ============================================================

// ชีตที่ 1 & 2: ตารางบันทึกคะแนนตรวจ
function buildAuditRecordSheet(records, allRecords, isSorted = false) {
  const now = new Date();
  const dateHeader = `25${(now.getFullYear() + 543) % 100}-${String(now.getMonth() + 1).padStart(2, '0')}-01 00:00:00`;

  const aoa = [
    [dateHeader],
    ["คำอธิบายเพิ่มเติม: ตัวย่อสาขา(2) หมายถึงเดือนปัจจุบันไม่ผ่านและเดือนที่ผ่านมาล่าสุดก็ไม่ผ่าน(ไม่ผ่าน 2 เดือนติดต่อกัน)"],
    ["คำอธิบายเพิ่มเติม: ตัวย่อสาขา(3) หมายถึงเดือนปัจจุบันไม่ผ่านและสองเดือนที่ผ่านมาล่าสุดก็ไม่ผ่าน(ไม่ผ่าน 3 เดือนติดต่อกัน)"],
    ["No.", "Branch", "Date", "Time", "On Shift ", "วัดคุณภาพน้ำ(TDS/ppm)", "PD.", "PC.", "S.", "C.", "DM.", "Percent", "Inspector"]
  ];

  let rows = [...records];
  if (isSorted) {
    rows.sort((a, b) => (b.percentageScore || 0) - (a.percentageScore || 0));
  }

  rows.forEach((r, idx) => {
    const cats = getCategoryScores(r);
    const suffix = getBranchFailSuffix(r.locationId, allRecords, r.auditDate);
    const branchName = `${r.locationCode || r.locationName || "-"}${suffix}`;
    const score = Math.round(r.percentageScore ?? r.score ?? 0);

    aoa.push([
      idx + 1,
      branchName,
      formatThaiDateShort(r.auditDate),
      extractTime(r.auditDate, r.time),
      r.teamOnShift || r.shiftLeader || "-",
      extractTDS(r),
      cats.PD,
      cats.PC,
      cats.S,
      cats.C,
      cats.DM,
      score,
      r.inspectorName || r.auditorName || "-"
    ]);
  });

  // ใส่สูตร AVERAGE ตามช่วงแถวที่มีข้อมูลจริง
  const count = rows.length;
  if (count > 0) {
    const startRow = 5;
    const endRow = 4 + count;
    aoa.push([
      "เฉลี่ย", "", "", "", "", "",
      { t: "n", f: `AVERAGE(G${startRow}:G${endRow})` },
      { t: "n", f: `AVERAGE(H${startRow}:H${endRow})` },
      { t: "n", f: `AVERAGE(I${startRow}:I${endRow})` },
      { t: "n", f: `AVERAGE(J${startRow}:J${endRow})` },
      { t: "n", f: `AVERAGE(K${startRow}:K${endRow})` },
      { t: "n", f: `AVERAGE(L${startRow}:L${endRow})` },
      ""
    ]);
  }

  return createSheetWithWidths(aoa, [6, 18, 14, 10, 16, 22, 8, 8, 8, 8, 8, 10, 20]);
}

// ชีตที่ 3: สรุปคะแนนเฉลี่ยทั้งปี จัดเกรด A, B, C
function buildGradingSheet(records) {
  const currentYear = new Date().getFullYear();
  const branchMap = {};

  records.forEach(r => {
    const key = r.locationId || r.locationName;
    if (!branchMap[key]) {
      branchMap[key] = {
        name: r.locationCode || r.locationName,
        scores: [],
        cats: { PD: [], PC: [], S: [], C: [], DM: [] }
      };
    }
    branchMap[key].scores.push(Math.round(r.percentageScore || 0));
    const cScores = getCategoryScores(r);
    for (const cat of ["PD", "PC", "S", "C", "DM"]) {
      if (typeof cScores[cat] === "number") branchMap[key].cats[cat].push(cScores[cat]);
    }
  });

  const calcAvg = arr => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

  const branchList = Object.values(branchMap).map(b => ({
    name: b.name,
    avgScore: calcAvg(b.scores),
    PD: calcAvg(b.cats.PD),
    PC: calcAvg(b.cats.PC),
    S: calcAvg(b.cats.S),
    C: calcAvg(b.cats.C),
    DM: calcAvg(b.cats.DM),
  })).sort((a, b) => b.avgScore - a.avgScore);

  const groupA = branchList.filter(b => b.avgScore >= 90);
  const groupB = branchList.filter(b => b.avgScore >= 87 && b.avgScore < 90);
  const groupC = branchList.filter(b => b.avgScore < 87);

  const aoa = [
    [`AVG. ${currentYear} & Divide into groups`],
    ["Groups", "No.", "Branch", "PD.", "PC.", "S.", "C.", "DM.", "Percent", "เกณฑ์", "ช่วงคะแนน"]
  ];

  let currentNo = 1;
  const appendGroup = (label, criteria, list) => {
    list.forEach((item, idx) => {
      aoa.push([
        idx === 0 ? `${label} (${list.length} Br.)` : "",
        currentNo++,
        item.name,
        item.PD, item.PC, item.S, item.C, item.DM,
        item.avgScore,
        idx === 0 ? label : "",
        idx === 0 ? criteria : ""
      ]);
    });
  };

  appendGroup("A", "90.00 - 100.00", groupA);
  appendGroup("B", "87.00 - 89.99", groupB);
  appendGroup("C", "< 87.00", groupC);

  return createSheetWithWidths(aoa, [16, 6, 18, 8, 8, 8, 8, 8, 10, 10, 16]);
}

// ชีตที่ 4: สรุปคะแนนเฉลี่ยแต่ละโซน
function buildZoneSheet(records) {
  const now = new Date();
  const dateHeader = `25${(now.getFullYear() + 543) % 100}-${String(now.getMonth() + 1).padStart(2, '0')}-01 00:00:00`;

  const aoa = [
    [dateHeader],
    ["อันดับ", "AEREA ZONE", "PD.", "PC.", "S.", "C.", "DM.", "Percent"]
  ];

  const zoneMap = {};
  records.forEach(r => {
    const zone = r.locationRegion || r.inspectorName || "โซนทั่วไป";
    if (!zoneMap[zone]) {
      zoneMap[zone] = { scores: [], PD: [], PC: [], S: [], C: [], DM: [] };
    }
    zoneMap[zone].scores.push(Math.round(r.percentageScore || 0));
    const cats = getCategoryScores(r);
    for (const c of ["PD", "PC", "S", "C", "DM"]) {
      if (typeof cats[c] === "number") zoneMap[zone][c].push(cats[c]);
    }
  });

  const calcAvg = arr => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : "-";

  const zoneList = Object.entries(zoneMap).map(([zone, data]) => ({
    zone,
    avgScore: calcAvg(data.scores),
    PD: calcAvg(data.PD),
    PC: calcAvg(data.PC),
    S: calcAvg(data.S),
    C: calcAvg(data.C),
    DM: calcAvg(data.DM)
  })).sort((a, b) => (typeof b.avgScore === "number" ? b.avgScore : 0) - (typeof a.avgScore === "number" ? a.avgScore : 0));

  zoneList.forEach((z, idx) => {
    aoa.push([idx + 1, z.zone, z.PD, z.PC, z.S, z.C, z.DM, z.avgScore]);
  });

  if (zoneList.length > 0) {
    const lastRow = zoneList.length + 2;
    aoa.push([
      "เฉลี่ย", "",
      { t: "n", f: `AVERAGE(C3:C${lastRow})` },
      { t: "n", f: `AVERAGE(D3:D${lastRow})` },
      { t: "n", f: `AVERAGE(E3:E${lastRow})` },
      { t: "n", f: `AVERAGE(F3:F${lastRow})` },
      { t: "n", f: `AVERAGE(G3:G${lastRow})` },
      { t: "n", f: `AVERAGE(H3:H${lastRow})` }
    ]);
  }

  return createSheetWithWidths(aoa, [8, 20, 8, 8, 8, 8, 8, 10]);
}

// ชีตที่ 5: ข้อมูลเกินอายุ.ไม่ได้คุณภาพ
function buildDefectSheet(records) {
  const aoa = [
    ["No.", "Branch", "Date", "Team on Shift", "รายละเอียด/จำนวนรายการ"]
  ];

  let count = 1;
  records.forEach(r => {
    const defectResponses = (r.responses || []).filter(res => res.isCritical || !res.isPassed);
    if (defectResponses.length > 0) {
      defectResponses.forEach(res => {
        aoa.push([
          count++,
          r.locationName || r.locationCode || "-",
          formatThaiDateShort(r.auditDate),
          r.teamOnShift || r.shiftLeader || "-",
          `${res.questionText || res.categoryName || "ข้อตรวจ"}: ${res.notes || "ไม่ผ่านเกณฑ์"}`
        ]);
      });
    } else if (r.hasCriticalDefect || (r.notes && r.notes.includes("Waste"))) {
      aoa.push([
        count++,
        r.locationName || r.locationCode || "-",
        formatThaiDateShort(r.auditDate),
        r.teamOnShift || r.shiftLeader || "-",
        r.notes || "พบข้อบกพร่องวิกฤต/สินค้าหมดอายุ"
      ]);
    }
  });

  if (aoa.length === 1) {
    aoa.push(["-", "ไม่พบรายการสินค้าเกินอายุหรือไม่ได้คุณภาพ", "-", "-", "-"]);
  }

  return createSheetWithWidths(aoa, [6, 20, 16, 18, 50]);
}

// ============================================================
// 3. ฟังก์ชันหลักสำหรับ Export (Entry Point)
// ============================================================

export function exportToExcel({
  formName = "AU. Operation Excellence",
  region = "all",
  auditRecords = []
}) {
  const now = new Date();
  const monthStr = String(now.getMonth() + 1).padStart(2, "0");
  const yearShort = (now.getFullYear() + 543) % 100;
  
  // ตั้งชื่อไฟล์ตามชื่อฟอร์มและรอบเดือน/ปี เช่น "AU. Operation Excellence 09.26.xlsx"
  const cleanFormName = (formName || "QSC_Report").replace(/[\\/:*?"<>|]/g, "_").trim();
  const filename = `${cleanFormName} ${monthStr}.${yearShort}.xlsx`;

  const wb = XLSX.utils.book_new();

  let records = [...auditRecords];
  if (region !== "all") {
    records = records.filter(r => (r.locationRegion || "").includes(region));
  }

  // สร้างแต่ละชีตตามโครงสร้างแบบร่าง
  XLSX.utils.book_append_sheet(wb, buildAuditRecordSheet(records, auditRecords, false), "บันทึกคะแนนตรวจ ");
  XLSX.utils.book_append_sheet(wb, buildAuditRecordSheet(records, auditRecords, true),  "บันทึกคะแนนตรวจ(เรียงอันดับ)");
  XLSX.utils.book_append_sheet(wb, buildGradingSheet(auditRecords),                     "คะแนนเฉลี่ยทั้งปี");
  XLSX.utils.book_append_sheet(wb, buildZoneSheet(records),                             "คะแนนเฉลี่ยแต่ละโซน");
  XLSX.utils.book_append_sheet(wb, buildDefectSheet(records),                           "ข้อมูลเกินอายุ.ไม่ได้คุณภาพ");

  // สั่งบันทึกไฟล์และดาวน์โหลด
  XLSX.writeFile(wb, filename);
}

export default exportToExcel;