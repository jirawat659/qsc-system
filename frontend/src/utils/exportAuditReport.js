// ============================================================
// exportAuditReport.js
// ส่งออก "รายงานผลการตรวจ QSC" รายรอบตรวจ เป็นไฟล์ .xlsx ตามแบบตัวอย่าง (A4 แนวตั้ง 8 คอลัมน์)
//
// แบ่งเป็น 3 ชั้น เพื่อให้ทดสอบและแก้ไขแยกกันได้
//   1) buildAuditReportModel()   แปลงข้อมูลรอบตรวจ (ที่หน้าจอมีอยู่แล้ว) → model กลาง ไม่แตะ Excel
//   2) buildAuditReportWorkbook() วาด model ลง Workbook (ExcelJS ถูกส่งเข้ามา จึงทดสอบใน Node ได้)
//   3) exportAuditReportToExcel() ตัวเรียกใช้จากปุ่ม: โหลด ExcelJS แบบ lazy → สร้างไฟล์ → ดาวน์โหลด
//
// ตาราง (grid) ในข้อคำถามมี 2 รูปแบบการแสดงผล
//   - inline   : ตารางย่อยซ้อนใต้แถวคำถาม (คอลัมน์ B–H) ใช้เมื่อขนาดไม่ใหญ่
//                ถ้าคอลัมน์เกิน INLINE_MAX_COLS จะตัดเป็นหลายบล็อกโดยซ้ำคอลัมน์ "รายการ"
//   - appendix : ตารางใหญ่ย้ายไปชีต "ตารางแนบ" (แนวนอน) แล้วลิงก์กลับจากแถวคำถาม
// ============================================================

// ---------- ค่าคงที่ของรูปแบบ (ตรงกับไฟล์ตัวอย่าง) ----------
const FONT = "Tahoma";
const C = {
  teal: "FF0F6659", tealDark: "FF0B4D43", tealLight: "FFE6F2F0",
  ink: "FF1E293B", muted: "FF64748B", line: "FFCBD5E1",
  roseBg: "FFFFE4E6", rose: "FFBE123C", slateBg: "FFF1F5F9", white: "FFFFFFFF"
};
const COL_W = [6, 30, 18, 7, 7, 12, 9, 22];          // A..H
const NCOL = COL_W.length;
const INLINE_MAX_COLS = 5;    // จำนวนคอลัมน์ข้อมูลของ grid ต่อ 1 บล็อกในชีตหลัก
const INLINE_MAX_ROWS = 15;   // grid ที่มีแถวมากกว่านี้ → ชีตตารางแนบ
const INLINE_MAX_CHUNKS = 2;  // grid ที่ต้องตัดเกินกี่บล็อก → ชีตตารางแนบ
const APPX_SHEET = "ตารางแนบ";
const NON_SCORED_NOTE_MARKER = "\n[หมายเหตุ]: ";       // ต้องตรงกับ AuditHistoryDetail.jsx

export const DEFAULT_CATEGORIES = [
  { key: "Product", label: "Product (คุณภาพสินค้า)" },
  { key: "Process", label: "Process (กระบวนการทำงาน)" },
  { key: "Service", label: "Service (การบริการ)" },
  { key: "Cleanliness", label: "Cleanliness (ความสะอาด)" },
  { key: "Documents", label: "Documents (เอกสาร)" }
];

// คอลัมน์ข้อมูลของตารางย่อย แมปลงบนคอลัมน์จริง C..H (ดัชนี 3..8) แบบ merge ตามจำนวนคอลัมน์
const SPAN_LAYOUT = {
  1: [[3, 8]],
  2: [[3, 5], [6, 8]],
  3: [[3, 4], [5, 6], [7, 8]],
  4: [[3, 3], [4, 5], [6, 7], [8, 8]],
  5: [[3, 3], [4, 5], [6, 6], [7, 7], [8, 8]]
};

// ============================================================
// ตัวช่วยทั่วไป
// ============================================================

function parseServerDate(d) {
  if (!d) return null;
  let s = String(d).trim();
  // backend ส่ง DateTime เป็น UTC แต่ไม่มี Z (เหมือน formatTimeWithSeconds ในหน้าจอ)
  if (!/[zZ]$/.test(s) && !/[+-]\d{2}:?\d{2}$/.test(s)) s += "Z";
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : dt;
}

export function formatBkk(d, withSeconds = true) {
  const dt = d instanceof Date ? d : parseServerDate(d);
  if (!dt) return "-";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Bangkok", day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
    }).formatToParts(dt).map(p => [p.type, p.value])
  );
  const date = `${parts.day}/${parts.month}/${parts.year}`;
  return `${date} ${parts.hour}:${parts.minute}${withSeconds ? ":" + parts.second : ""}`;
}

const THAI_MARKS = /[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/g; // สระบน/ล่าง วรรณยุกต์ ไม่กินความกว้าง

// ประมาณจำนวนบรรทัดของข้อความในช่อง (Excel ไม่ auto-fit แถวที่มี merge เราจึงตั้งความสูงเอง)
function estimateLines(text, widthChars, fontSize = 10) {
  const w = Math.max(1, widthChars - 1.5);
  const scale = (fontSize / 11) * 1.08;
  return String(text ?? "").split("\n").reduce((sum, para) => {
    const units = para.replace(THAI_MARKS, "").length * scale;
    return sum + Math.max(1, Math.ceil(units / w));
  }, 0);
}
const rowHeightFor = (lines, min = 21) => Math.max(min, lines * 13.5 + 7.5);
const spanWidth = (c1, c2) => COL_W.slice(c1 - 1, c2).reduce((a, b) => a + b, 0);

const isPlainObject = v => v && typeof v === "object" && !Array.isArray(v);
const safeParse = v => { if (typeof v !== "string") return v; try { return JSON.parse(v); } catch { return v; } };
const toNumber = v => { if (v === "" || v === null || v === undefined) return null; const n = Number(v); return Number.isFinite(n) ? n : null; };

// คำตอบข้อไม่คิดคะแนนเก็บใน Notes เป็น "คำตอบ" หรือ "คำตอบ\n[หมายเหตุ]: คอมเมนต์"
function extractComment(note) {
  const t = String(note ?? "");
  const i = t.indexOf(NON_SCORED_NOTE_MARKER);
  return i >= 0 ? t.slice(i + NON_SCORED_NOTE_MARKER.length).trim() : "";
}

// ============================================================
// 1) MODEL  — แปลงข้อมูลที่หน้าจอมีอยู่แล้ว ให้เป็นโครงที่ Excel ใช้
// ============================================================
function normalizeGrid(q) {
  const cfg = safeParse(q.fieldConfig);
  const columns = Array.isArray(cfg?.columns) ? cfg.columns : [];
  const rows = Array.isArray(cfg?.rows) ? cfg.rows : [];
  if (!columns.length || !rows.length) return null;
  const raw = q.rawValue !== undefined ? q.rawValue : (q.rawAnswer !== undefined ? q.rawAnswer : q.value);
  const data = isPlainObject(safeParse(raw)) ? safeParse(raw) : {};
  return {
    columns: columns.map((c, i) => ({ id: c.id ?? `c${i}`, label: c.label || `คอลัมน์ ${i + 1}`, type: c.type || "text", autoSum: !!c.autoSum })),
    rows: rows.map((r, i) => ({
      id: r.id ?? `r${i}`,
      label: r.label || `แถว ${i + 1}`,
      cells: columns.map((c, ci) => {
        const rowId = r.id ?? `r${i}`;
        const colId = c.id ?? `c${ci}`;
        const rawVal = data[`${rowId}_${colId}`] ?? data[`${rowId}_${c.id}`] ?? data[`${r.id}_${colId}`] ?? data[`${r.id}_${c.id}`];
        const type = c.type || "text";
        if (type === "number") return toNumber(rawVal);
        if (type === "radio" || type === "checkbox") return rawVal ? "✓" : "";
        return rawVal === undefined || rawVal === null ? "" : String(rawVal);
      })
    }))
  };
}

function answerText(q) {
  if (q.isScored) {
    if (q.isNa) return "N/A";
    if (q.type === "scale") return q.scaleScore != null ? `${q.scaleScore} / 5` : (q.scoreGiven != null && q.fullScore != null ? `${q.scoreGiven} / ${q.fullScore}` : "-");
    if (q.type === "yesno" || typeof q.answer === "boolean") {
      const isPass = q.answer === true || q.answer === "yes" || q.isPassed === true;
      return isPass ? "ผ่าน" : "ไม่ผ่าน";
    }
    if (q.rawAnswer !== undefined && q.rawAnswer !== null && q.rawAnswer !== "") {
      const str = String(q.rawAnswer).trim().toLowerCase();
      if (str === "yes" || str === "true" || str === "ผ่าน") return "ผ่าน";
      if (str === "no" || str === "false" || str === "ไม่ผ่าน") return "ไม่ผ่าน";
      return String(q.rawAnswer);
    }
    return q.isPassed ? "ผ่าน" : "ไม่ผ่าน";
  }
  const v = safeParse(q.rawAnswer !== undefined ? q.rawAnswer : q.rawValue);
  if (Array.isArray(v)) return v.length ? v.join(", ") : "-";
  if (isPlainObject(v)) return "-";
  const s = String(v ?? "").trim();
  if (!s) return "-";
  if (q.type === "number") {
    const unit = safeParse(q.fieldConfig)?.unit;
    return unit ? `${s} ${unit}` : s;
  }
  if (q.type === "date" && /^\d{4}-\d{2}-\d{2}/.test(s)) return `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
  return s;
}

function estimateGridRows(grid) {
  if (!grid || !Array.isArray(grid.columns) || !Array.isArray(grid.rows)) return 0;
  const cols = grid.columns;
  const chunks = Math.ceil(cols.length / INLINE_MAX_COLS);
  let count = 0;
  for (let ci = 0; ci < chunks; ci++) {
    if (chunks > 1) count += 1;
    count += 1;
    count += grid.rows.length;
    if (cols.some(c => c.autoSum)) count += 1;
  }
  return count;
}

/**
 * @param {object} p
 * @param {object} p.record        รอบตรวจ (currentRecord)
 * @param {Array}  p.sections      formBreakdown จากหน้าจอ [{title, questions:[...]}]
 * @param {Array}  p.metaFields    allDisplayMetadataFields [{label,value,unit}]
 * @param {number} p.passingScore  เกณฑ์ผ่าน (%)
 * @param {Function} p.categoryOf  (q, sec) => "Product" | ...   ใช้ getQuestionCategory ของหน้าจอ
 * @param {object} p.header        ข้อความส่วนหัวที่หน้าจอประกอบไว้แล้ว
 */
export function buildAuditReportModel({ record, sections, metaFields = [], passingScore = 85, categoryOf, header, categories, categoryOrder }) {
  const questions = [];
  const outSections = (sections || []).map((sec, sIdx) => {
    const qs = (sec.questions || []).map(q => {
      const isGrid = q.type === "grid";
      const grid = isGrid ? normalizeGrid(q) : null;
      const scored = !!q.isScored;
      const counted = scored && !q.isNa;
      const cat = scored ? (categoryOf ? categoryOf(q, sec) : (q.category || "-")) : "-";
      const item = {
        num: q.num,
        text: q.text,
        kind: isGrid && grid ? "grid" : "item",
        answer: isGrid && grid ? "" : answerText(q),
        scored,
        given: counted ? Number(q.scoreGiven) || 0 : null,
        full: counted ? Number(q.fullScore) || 0 : null,
        category: cat,
        note: scored ? (q.note || "") : extractComment(q.note),
        grid
      };
      questions.push(item);
      return item;
    });
    const t = String(sec.title || "").trim();
    return { title: /^\d+[.)]/.test(t) ? t : `${sIdx + 1}. ${t}`, questions: qs };
  });

  // 🌟 สรุปคะแนนรายหมวดแบบ Dynamic ตามข้อคำถามจริงในฟอร์ม (ไม่ hardcode 5 หมวดคงที่)
  const scoredQuestions = questions.filter(q => q.scored && q.category && q.category !== "-");
  const presentCatKeys = [];
  scoredQuestions.forEach(q => {
    if (!presentCatKeys.includes(q.category)) {
      presentCatKeys.push(q.category);
    }
  });

  // จัดลำดับหมวดหมู่ตาม categoryOrder ถ้ามี หรือตามลำดับมาตรฐานเริ่มต้น
  let effectiveOrder = null;
  const rawOrder = categoryOrder || record?.surveyForm?.categoryOrderJson || record?.categoryOrderJson || record?.surveyForm?.categories;
  if (typeof rawOrder === "string") {
    try {
      const parsed = JSON.parse(rawOrder);
      if (Array.isArray(parsed) && parsed.length > 0) effectiveOrder = parsed;
    } catch (e) {}
  } else if (Array.isArray(rawOrder) && rawOrder.length > 0) {
    effectiveOrder = rawOrder;
  }
  if (!effectiveOrder) {
    effectiveOrder = DEFAULT_CATEGORIES.map(c => c.key);
  }

  const getOrderIndex = (catKey) => {
    if (!catKey || !Array.isArray(effectiveOrder)) return -1;
    const target = String(catKey).toLowerCase().trim();
    return effectiveOrder.findIndex(item => {
      const val = typeof item === "object" && item !== null ? (item.key || item.name || item.label || "") : String(item);
      return val.toLowerCase().trim() === target;
    });
  };

  presentCatKeys.sort((a, b) => {
    const idxA = getOrderIndex(a);
    const idxB = getOrderIndex(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b, "th");
  });

  const getCategoryLabel = (key) => {
    const def = DEFAULT_CATEGORIES.find(c => c.key.toLowerCase() === String(key).toLowerCase());
    if (def) return def.label;
    return key;
  };

  const resolvedCategories = presentCatKeys.map(key => {
    const custom = Array.isArray(categories) ? categories.find(c => (c.key || c.name || c) === key) : null;
    const label = custom?.label || custom?.title || getCategoryLabel(key);
    return { key, label };
  });

  // Fallback กรณีไม่มีข้อคิดคะแนนเลย ให้มี 1 แถวกันสูตร Excel error
  if (resolvedCategories.length === 0) {
    if (Array.isArray(categories) && categories.length > 0) {
      categories.forEach(c => resolvedCategories.push(typeof c === "string" ? { key: c, label: getCategoryLabel(c) } : c));
    } else {
      resolvedCategories.push({ key: "General", label: "คะแนนทั่วไป" });
    }
  }

  // สรุปคะแนนรายหมวด (ค่าที่คำนวณไว้ใส่เป็น cached result ให้โปรแกรมที่ไม่คำนวณสูตรยังเห็นตัวเลข)
  const catTotals = resolvedCategories.map(c => {
    const own = questions.filter(q => q.scored && q.given !== null && q.category === c.key);
    return { ...c, given: own.reduce((s, q) => s + q.given, 0), full: own.reduce((s, q) => s + q.full, 0) };
  });
  const given = catTotals.reduce((s, c) => s + c.given, 0);
  const full = catTotals.reduce((s, c) => s + c.full, 0);

  // แยก metaFields เป็น simpleDetails (ข้อมูลข้อความทั่วไป) และ gridDetails (ตารางข้อมูล)
  const simpleDetails = [];
  const gridDetails = [];

  (metaFields || []).forEach(f => {
    const isGrid = f.type === "grid" || f.questionType === "grid" || (f.fieldConfig && Array.isArray(f.fieldConfig.columns) && f.fieldConfig.columns.length > 0);
    const grid = isGrid ? normalizeGrid(f) : null;
    if (isGrid && grid) {
      gridDetails.push({
        id: f.id,
        label: f.label || "ตารางข้อมูล",
        grid
      });
    } else {
      let displayVal = f.value;
      const raw = f.rawValue !== undefined ? f.rawValue : f.value;
      const parsed = safeParse(raw);
      if (isPlainObject(parsed)) {
        displayVal = Object.entries(parsed).map(([k, v]) => `${k}: ${v}`).join(", ");
      } else if (Array.isArray(parsed)) {
        displayVal = parsed.join(", ");
      }
      simpleDetails.push({
        label: f.label,
        value: `${displayVal ?? "-"}${f.unit || ""}`
      });
    }
  });

  return {
    header,
    passing: passingScore / 100,
    hasCritical: !!record?.hasCriticalDefect,
    categories: catTotals,
    totals: { given, full },
    details: simpleDetails,
    gridDetails,
    sections: outSections
  };
}

// ============================================================
// 2) WORKBOOK
// ============================================================
const thin = { style: "thin", color: { argb: C.line } };
const medium = { style: "medium", color: { argb: C.teal } };
const BOX = { top: thin, bottom: thin, left: thin, right: thin };
const solid = argb => ({ type: "pattern", pattern: "solid", fgColor: { argb } });

// เขียนช่องช่วง (merge ได้) โดยใส่สไตล์ทุกช่องในช่วงก่อน merge เพื่อให้เส้นขอบครบ
function box(ws, r1, c1, r2, c2, value, st = {}) {
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      const cell = ws.getCell(r, c);
      cell.font = { name: FONT, size: st.size ?? 10, bold: !!st.bold, italic: !!st.italic, color: { argb: st.color ?? C.ink } };
      if (st.fill) cell.fill = solid(st.fill);
      cell.alignment = { horizontal: st.h ?? "left", vertical: st.v ?? "middle", wrapText: st.wrap !== false, indent: st.indent ?? 0 };
      if (st.border) cell.border = st.border;
      if (st.numFmt) cell.numFmt = st.numFmt;
    }
  }
  if (r2 > r1 || c2 > c1) ws.mergeCells(r1, c1, r2, c2);
  if (value !== undefined && value !== null) ws.getCell(r1, c1).value = value;
  return ws.getCell(r1, c1);
}
const formula = (f, result) => ({ formula: f, result });

// ---------- ตารางย่อย (inline) ซ้อนใต้แถวคำถาม ----------
function writeInlineGrid(ws, r, q) {
  const { grid } = q;
  const cols = grid.columns;
  const chunks = [];
  for (let i = 0; i < cols.length; i += INLINE_MAX_COLS) chunks.push(cols.slice(i, i + INLINE_MAX_COLS).map((c, k) => ({ ...c, idx: i + k })));
  const start = r;

  chunks.forEach((chunk, ci) => {
    const spans = SPAN_LAYOUT[chunk.length];
    if (chunks.length > 1) {
      box(ws, r, 2, r, NCOL, `ตารางที่ ${ci + 1}/${chunks.length}  (คอลัมน์ ${chunk[0].idx + 1}–${chunk[chunk.length - 1].idx + 1})`, { size: 8, italic: true, color: C.muted });
      ws.getRow(r).height = 15; r++;
    }
    // หัวตาราง
    box(ws, r, 2, r, 2, "รายการ", { size: 9, bold: true, color: C.tealDark, fill: C.tealLight, h: "center", border: BOX });
    let hl = 1;
    chunk.forEach((col, k) => {
      const [c1, c2] = spans[k];
      box(ws, r, c1, r, c2, col.label + (col.autoSum ? "  (∑)" : ""), { size: 9, bold: true, color: C.tealDark, fill: C.tealLight, h: "center", border: BOX });
      hl = Math.max(hl, estimateLines(col.label, spanWidth(c1, c2), 9));
    });
    ws.getRow(r).height = rowHeightFor(hl, 20); r++;

    // แถวข้อมูล
    const firstData = r;
    grid.rows.forEach(row => {
      box(ws, r, 2, r, 2, row.label, { size: 9, border: BOX });
      let lines = estimateLines(row.label, COL_W[1], 9);
      chunk.forEach((col, k) => {
        const [c1, c2] = spans[k];
        const v = row.cells[col.idx];
        const isNum = col.type === "number";
        const center = col.type === "radio" || col.type === "checkbox";
        const cellNumFmt = isNum ? (Number.isInteger(v) ? "#,##0" : "#,##0.00") : undefined;
        box(ws, r, c1, r, c2, v === null || v === "" ? null : v, { size: 9, border: BOX, h: isNum ? "right" : center ? "center" : "left", numFmt: cellNumFmt });
        if (typeof v === "string") lines = Math.max(lines, estimateLines(v, spanWidth(c1, c2), 9));
      });
      ws.getRow(r).height = rowHeightFor(lines, 18); r++;
    });
    const lastData = r - 1;

    // แถวรวม (สูตร SUM จริง ถ้ามีคอลัมน์ที่เปิด autoSum)
    if (chunk.some(c => c.autoSum)) {
      box(ws, r, 2, r, 2, "รวม", { size: 9, bold: true, color: C.tealDark, fill: C.tealLight, h: "right", border: BOX });
      chunk.forEach((col, k) => {
        const [c1, c2] = spans[k];
        if (col.autoSum) {
          const L = ws.getColumn(c1).letter;
          const sum = grid.rows.reduce((s, row) => s + (row.cells[col.idx] || 0), 0);
          const sumFmt = Number.isInteger(sum) ? "#,##0" : "#,##0.00";
          box(ws, r, c1, r, c2, formula(`SUM(${L}${firstData}:${L}${lastData})`, sum), { size: 9, bold: true, color: C.tealDark, fill: C.tealLight, h: "right", border: BOX, numFmt: sumFmt });
        } else box(ws, r, c1, r, c2, null, { size: 9, fill: C.tealLight, border: BOX });
      });
      ws.getRow(r).height = 19; r++;
    }
  });

  // แถบซ้าย (คอลัมน์ A) รวมเป็นช่องเดียวตลอดบล็อก ให้เห็นว่าตารางนี้อยู่ใต้ข้อไหน
  // ห้ามมีตัวเลขในช่อง A เพื่อให้สูตร SUMIFS(... A ">0") ไม่นับแถวของตารางย่อย
  box(ws, start, 1, r - 1, 1, null, { fill: C.slateBg, border: BOX });
  return r;
}

// ---------- ชีต "ตารางแนบ" สำหรับตารางขนาดใหญ่ ----------
function writeAppendixGrid(ws, r, q, tag) {
  const { grid } = q;
  const nCols = grid.columns.length;
  const last = 2 + nCols - 1;
  box(ws, r, 1, r, last, `${tag}  ข้อ ${q.num}: ${q.text}`, { size: 11, bold: true, color: C.teal, border: { bottom: medium } });
  ws.getRow(r).height = 24; r++;

  box(ws, r, 1, r, 1, "ลำดับ", { size: 9, bold: true, color: C.white, fill: C.teal, h: "center", border: BOX });
  box(ws, r, 2, r, 2, "รายการ", { size: 9, bold: true, color: C.white, fill: C.teal, h: "center", border: BOX });
  let hl = 1;
  grid.columns.forEach((col, i) => {
    box(ws, r, 3 + i, r, 3 + i, col.label + (col.autoSum ? "  (∑)" : ""), { size: 9, bold: true, color: C.white, fill: C.teal, h: "center", border: BOX });
    hl = Math.max(hl, estimateLines(col.label, 14, 9));
  });
  ws.getRow(r).height = rowHeightFor(hl, 22); r++;

  const first = r;
  grid.rows.forEach((row, ri) => {
    box(ws, r, 1, r, 1, ri + 1, { size: 9, h: "center", border: BOX });
    box(ws, r, 2, r, 2, row.label, { size: 9, border: BOX });
    let lines = estimateLines(row.label, 32, 9);
    grid.columns.forEach((col, i) => {
      const v = row.cells[i];
      const isNum = col.type === "number";
      const cellNumFmt = isNum ? (Number.isInteger(v) ? "#,##0" : "#,##0.00") : undefined;
      box(ws, r, 3 + i, r, 3 + i, v === null || v === "" ? null : v, { size: 9, border: BOX, h: isNum ? "right" : (col.type === "radio" || col.type === "checkbox") ? "center" : "left", numFmt: cellNumFmt });
      if (typeof v === "string") lines = Math.max(lines, estimateLines(v, 14, 9));
    });
    ws.getRow(r).height = rowHeightFor(lines, 18); r++;
  });
  const lastData = r - 1;

  if (grid.columns.some(c => c.autoSum)) {
    box(ws, r, 1, r, 2, "รวม", { size: 9, bold: true, color: C.tealDark, fill: C.tealLight, h: "right", border: BOX });
    grid.columns.forEach((col, i) => {
      const L = ws.getColumn(3 + i).letter;
      if (col.autoSum) {
        const sum = grid.rows.reduce((s, row) => s + (row.cells[i] || 0), 0);
        const sumFmt = Number.isInteger(sum) ? "#,##0" : "#,##0.00";
        box(ws, r, 3 + i, r, 3 + i, formula(`SUM(${L}${first}:${L}${lastData})`, sum), { size: 9, bold: true, color: C.tealDark, fill: C.tealLight, h: "right", border: BOX, numFmt: sumFmt });
      } else box(ws, r, 3 + i, r, 3 + i, null, { fill: C.tealLight, border: BOX });
    });
    ws.getRow(r).height = 19; r++;
  }
  return r + 1; // เว้น 1 บรรทัดก่อนตารางถัดไป
}

function needsAppendix(grid) {
  const chunks = Math.ceil(grid.columns.length / INLINE_MAX_COLS);
  return grid.rows.length > INLINE_MAX_ROWS || chunks > INLINE_MAX_CHUNKS;
}

/**
 * @param {object} ExcelJS  โมดูล exceljs (ส่งเข้ามา เพื่อ lazy-load ในเบราว์เซอร์และทดสอบใน Node ได้)
 * @param {object} model    ผลจาก buildAuditReportModel
 * @param {object} [opts]   { signatures: { auditor: {buffer, extension}, auditee: {...} } }
 */
export function buildAuditReportWorkbook(ExcelJS, model, opts = {}) {
  const { header: H, sections, categories, totals } = model;
  const wb = new ExcelJS.Workbook();
  wb.creator = "QSC System";
  wb.created = new Date();
  const ws = wb.addWorksheet("รายงานผลการตรวจ", { views: [{ showGridLines: false }] });
  COL_W.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  // ---------- ตำแหน่งแถวของส่วนบน (คงที่ตามตัวอย่าง) ----------
  const catFirst = 17;
  const catLast = catFirst + categories.length - 1;
  const catTotal = catLast + 1;
  const detailsHead = catTotal + 2;
  const metaRows = Math.max(1, Math.ceil(model.details.length / 2));

  // คำนวณจำนวนแถวที่ใช้สำหรับ gridDetails ในส่วนรายละเอียดการตรวจ
  let gridMetaRows = 0;
  if ((model.gridDetails || []).length > 0) {
    gridMetaRows += 1; // spacing ก่อนเริ่มตาราง
    model.gridDetails.forEach(g => {
      gridMetaRows += 1; // title row ของตาราง
      gridMetaRows += estimateGridRows(g.grid); // rows ของตาราง
      gridMetaRows += 1; // spacing ท้ายตาราง
    });
  }

  const bodyTitle = detailsHead + 1 + metaRows + gridMetaRows + 1;
  const tblHead = bodyTitle + 1;
  const bodyFirst = tblHead + 1;

  // ---------- ตารางผลรายข้อ (เขียนก่อน เพราะสูตรด้านบนอ้างช่วงแถวนี้) ----------
  let r = bodyFirst;
  const appendix = [];
  sections.forEach(sec => {
    box(ws, r, 1, r, NCOL, sec.title, { bold: true, color: C.tealDark, fill: C.tealLight, border: BOX });
    ws.getRow(r).height = 19.5; r++;
    sec.questions.forEach(q => {
      const isGrid = q.kind === "grid";
      const toAppx = isGrid && needsAppendix(q.grid);
      const tag = toAppx ? `T${appendix.length + 1}` : null;
      if (toAppx) appendix.push({ q, tag });

      const ansText = isGrid ? (toAppx ? `ดูตารางแนบ ${tag}` : "ดูตารางด้านล่าง") : q.answer;
      const dash = { h: "center", border: BOX };
      // ข้อไม่คิดคะแนนที่คำตอบเป็นข้อความยาว → ขยายช่องคำตอบกินคอลัมน์ C–F (ไม่มีคะแนนให้แสดงอยู่แล้ว)
      const wideAnswer = !q.scored && !isGrid && estimateLines(ansText, COL_W[2]) >= 3;
      box(ws, r, 1, r, 1, q.num, dash);
      box(ws, r, 2, r, 2, q.text, { border: BOX });
      const ansEnd = wideAnswer ? 6 : 3;
      const ac = box(ws, r, 3, r, ansEnd, ansText, { border: BOX, italic: isGrid, color: isGrid ? C.teal : C.ink });
      if (!wideAnswer) {
        box(ws, r, 4, r, 4, q.given !== null ? q.given : "-", dash);
        box(ws, r, 5, r, 5, q.full !== null ? q.full : "-", dash);
        box(ws, r, 6, r, 6, q.category, dash);
      }
      box(ws, r, 7, r, 8, q.note || null, { border: BOX });
      ws.getRow(r).height = rowHeightFor(Math.max(
        estimateLines(q.text, COL_W[1]), estimateLines(ansText, spanWidth(3, ansEnd)), estimateLines(q.note, spanWidth(7, 8))
      ));
      if (toAppx) ac.value = { text: ansText, hyperlink: `#'${APPX_SHEET}'!A1` }; // ปรับเป็นแถวจริงหลังเขียนชีตแนบ
      const rowAt = r;
      r++;
      if (isGrid && !toAppx) r = writeInlineGrid(ws, r, q);
      q._row = rowAt;
    });
  });
  const bodyLast = r - 1;

  // แถวรวมท้ายตาราง: ใช้ SUMIFS เงื่อนไข A>0 เพื่อไม่นับตัวเลขในตารางย่อย
  const rngA = `$A$${bodyFirst}:$A$${bodyLast}`;
  const rngD = `$D$${bodyFirst}:$D$${bodyLast}`;
  const rngE = `$E$${bodyFirst}:$E$${bodyLast}`;
  const rngF = `$F$${bodyFirst}:$F$${bodyLast}`;
  const bodyTotal = bodyLast + 1;
  const totSt = { size: 10, bold: true, color: C.tealDark, fill: C.tealLight, h: "center", border: { top: medium, bottom: medium, left: thin, right: thin } };
  box(ws, bodyTotal, 1, bodyTotal, 3, "รวมคะแนนทุกข้อ", { ...totSt, h: "right" });
  box(ws, bodyTotal, 4, bodyTotal, 4, formula(`SUMIFS(${rngD},${rngA},">0")`, totals.given), totSt);
  box(ws, bodyTotal, 5, bodyTotal, 5, formula(`SUMIFS(${rngE},${rngA},">0")`, totals.full), totSt);
  box(ws, bodyTotal, 6, bodyTotal, 6, formula(`IF(E${bodyTotal}=0,"-",D${bodyTotal}/E${bodyTotal})`, totals.full ? totals.given / totals.full : "-"), { ...totSt, numFmt: "0.00%" });
  ws.getRow(bodyTotal).height = 21.75;

  // ---------- ลายเซ็น ----------
  const sigImgRow = bodyTotal + 2;
  ws.getRow(bodyTotal + 1).height = 10;
  ws.getRow(sigImgRow).height = 58;
  const sigBlocks = [
    { c1: 2, c2: 3, name: H.auditor, role: "ผู้ตรวจ", at: H.signedAt, img: opts.signatures?.auditor },
    { c1: 6, c2: 8, name: H.auditee, role: `ผู้รับการตรวจ (ผู้จัดการสาขา)`, at: H.signedAt, img: opts.signatures?.auditee }
  ];
  sigBlocks.forEach(b => {
    box(ws, sigImgRow, b.c1, sigImgRow, b.c2, null, { border: { bottom: thin } });
    box(ws, sigImgRow + 1, b.c1, sigImgRow + 1, b.c2, `(${b.name})`, { h: "center" });
    box(ws, sigImgRow + 2, b.c1, sigImgRow + 2, b.c2, b.role, { size: 9, bold: true, color: C.muted, h: "center" });
    box(ws, sigImgRow + 3, b.c1, sigImgRow + 3, b.c2, `วันที่ลงนาม: ${b.at}`, { size: 8, color: C.muted, h: "center" });
    if (b.img?.buffer) {
      const id = wb.addImage({ buffer: b.img.buffer, extension: b.img.extension || "png" });
      const widthChars = spanWidth(b.c1, b.c2);
      ws.addImage(id, { tl: { col: b.c1 - 1 + Math.max(0, (widthChars - 17) / widthChars / 2 * (b.c2 - b.c1 + 1)), row: sigImgRow - 1 + 0.06 }, ext: { width: 120, height: 52 } });
    }
  });
  ws.getRow(sigImgRow + 1).height = 18;
  ws.getRow(sigImgRow + 2).height = 15;
  ws.getRow(sigImgRow + 3).height = 15;
  ws.getRow(sigImgRow + 4).height = 10;
  box(ws, sigImgRow + 5, 1, sigImgRow + 5, NCOL, "เอกสารนี้สร้างโดยระบบ QSC (Quality & Service Check)", { size: 8, color: C.muted, h: "center" });

  // ---------- ส่วนหัวรายงาน ----------
  // แถบสีบน/ล่างของหัวรายงาน (ไม่ merge เพราะแถว 2–3 ถูก merge เป็นชุดของตัวเอง)
  [1, 4].forEach(rr => { for (let c = 1; c <= NCOL; c++) ws.getCell(rr, c).fill = solid(C.teal); });
  ws.getRow(1).height = 7.5; ws.getRow(4).height = 7.5; ws.getRow(5).height = 7.5;
  box(ws, 2, 1, 2, 5, "รายงานผลการตรวจ QSC", { size: 20, bold: true, color: C.white, fill: C.teal });
  box(ws, 2, 6, 2, 8, `เลขที่รายงาน: ${H.reportNo}`, { bold: true, color: C.white, fill: C.teal, h: "right" });
  box(ws, 3, 1, 3, 5, "Quality & Service Check", { color: C.white, fill: C.teal });
  box(ws, 3, 6, 3, 8, `วันที่ออกรายงาน: ${H.issuedAt}`, { size: 9, color: C.white, fill: C.teal, h: "right" });
  ws.getRow(2).height = 34; ws.getRow(3).height = 18;

  box(ws, 6, 1, 6, 4, H.location, { size: 14, bold: true, wrap: false });
  box(ws, 7, 1, 7, 4, H.brandType, { wrap: false });
  box(ws, 8, 1, 8, 4, `แบบฟอร์ม: ${H.form}`, { wrap: false });
  [["วันเวลาเริ่มตรวจ", H.startedAt], ["วันเวลาสิ้นสุดตรวจ", H.endedAt], ["ผู้ตรวจ", H.auditor], ["ผู้รับการตรวจ", H.auditee]].forEach(([k, v], i) => {
    box(ws, 6 + i, 5, 6 + i, 6, k, { size: 9, color: C.muted, wrap: false });
    box(ws, 6 + i, 7, 6 + i, 8, v, { bold: true, wrap: false });
  });
  ws.getRow(6).height = 24;
  ws.getRow(7).height = 20;
  ws.getRow(8).height = 20;
  ws.getRow(9).height = 20;
  ws.getRow(10).height = 7.5;

  // กล่องคะแนนรวม
  const boxLbl = { size: 9, bold: true, fill: C.tealLight, h: "center", color: C.tealDark };
  box(ws, 11, 1, 11, 3, "คะแนนรวมของรอบตรวจ", boxLbl);
  box(ws, 11, 4, 11, 6, "คะแนนที่ได้ / คะแนนเต็ม", boxLbl);
  box(ws, 11, 7, 11, 8, "ผลการตรวจ", boxLbl);
  const pct = totals.full ? totals.given / totals.full : 0;
  const verdict = model.hasCritical ? "ไม่ผ่านเกณฑ์" : (pct >= model.passing ? "ผ่านเกณฑ์" : "ไม่ผ่านเกณฑ์");
  box(ws, 12, 1, 13, 3, formula(`IF(E${bodyTotal}=0,0,D${bodyTotal}/E${bodyTotal})`, pct), { size: 15, bold: true, color: C.tealDark, fill: C.tealLight, h: "center", numFmt: "0.00%" });
  box(ws, 12, 4, 13, 6, formula(`D${bodyTotal}&" / "&E${bodyTotal}`, `${totals.given} / ${totals.full}`), { size: 14, bold: true, fill: C.tealLight, h: "center" });
  box(ws, 12, 7, 13, 8, formula(`IF(${model.hasCritical ? "TRUE" : "FALSE"},"ไม่ผ่านเกณฑ์",IF($A$12>=${model.passing},"ผ่านเกณฑ์","ไม่ผ่านเกณฑ์"))`, verdict), { size: 12, bold: true, color: C.white, fill: pct >= model.passing && !model.hasCritical ? C.teal : C.rose, h: "center" });
  ws.getRow(12).height = 24; ws.getRow(13).height = 24; ws.getRow(14).height = 7.5;
  ws.addConditionalFormatting({ ref: "G12:H13", rules: [
    { type: "expression", formulae: ['$G$12="ผ่านเกณฑ์"'], style: { font: { color: { argb: C.white } }, fill: { type: "pattern", pattern: "solid", bgColor: { argb: C.teal } } } },
    { type: "expression", formulae: ['$G$12="ไม่ผ่านเกณฑ์"'], style: { font: { color: { argb: C.white } }, fill: { type: "pattern", pattern: "solid", bgColor: { argb: C.rose } } } }
  ] });

  // สรุปคะแนนรายหมวด
  box(ws, 15, 1, 15, NCOL, "สรุปคะแนนรายหมวด", { size: 12, bold: true, color: C.teal, border: { bottom: medium } });
  ws.getRow(15).height = 24;
  const hd = { size: 12, bold: true, color: C.white, fill: C.teal, h: "center", border: BOX };
  box(ws, 16, 1, 16, 1, "ลำดับ", hd); box(ws, 16, 2, 16, 3, "หมวดคะแนน", hd);
  box(ws, 16, 4, 16, 4, "ได้", hd); box(ws, 16, 5, 16, 5, "เต็ม", hd); box(ws, 16, 6, 16, 6, "%", hd); box(ws, 16, 7, 16, 8, "สถานะ", hd);
  ws.getRow(16).height = 21.75;
  categories.forEach((c, i) => {
    const row = catFirst + i;
    const st = { size: 12, border: BOX, h: "center" };
    const p = c.full ? c.given / c.full : "-";
    box(ws, row, 1, row, 1, i + 1, { ...st, wrap: false });
    box(ws, row, 2, row, 3, c.label, { ...st, h: "left", wrap: false });
    box(ws, row, 4, row, 4, formula(`SUMIFS(${rngD},${rngF},"${c.key}",${rngA},">0")`, c.given), { ...st, wrap: false });
    box(ws, row, 5, row, 5, formula(`SUMIFS(${rngE},${rngF},"${c.key}",${rngA},">0")`, c.full), { ...st, wrap: false });
    box(ws, row, 6, row, 6, formula(`IF(E${row}=0,"-",D${row}/E${row})`, p), { ...st, bold: true, numFmt: "0.00%", wrap: false });
    box(ws, row, 7, row, 8, formula(`IF(E${row}=0,"N/A",IF(F${row}>=${model.passing},"ผ่าน","ไม่ผ่าน"))`, c.full ? (p >= model.passing ? "ผ่าน" : "ไม่ผ่าน") : "N/A"), { ...st, bold: true, wrap: false });
    ws.getRow(row).height = 21.75;
  });
  const tt = { size: 12, bold: true, color: C.tealDark, fill: C.tealLight, h: "center", border: { top: medium, bottom: medium, left: thin, right: thin } };
  box(ws, catTotal, 1, catTotal, 3, "คะแนนรวม", { ...tt, h: "right", wrap: false });
  box(ws, catTotal, 4, catTotal, 4, formula(`SUM(D${catFirst}:D${catLast})`, totals.given), { ...tt, wrap: false });
  box(ws, catTotal, 5, catTotal, 5, formula(`SUM(E${catFirst}:E${catLast})`, totals.full), { ...tt, wrap: false });
  box(ws, catTotal, 6, catTotal, 6, formula(`IF(E${catTotal}=0,"-",D${catTotal}/E${catTotal})`, pct), { ...tt, numFmt: "0.00%", wrap: false });
  box(ws, catTotal, 7, catTotal, 8, formula(`IF(E${catTotal}=0,"N/A",IF(F${catTotal}>=${model.passing},"ผ่าน","ไม่ผ่าน"))`, verdict === "ผ่านเกณฑ์" ? "ผ่าน" : "ไม่ผ่าน"), { ...tt, border: BOX, wrap: false });
  ws.getRow(catTotal).height = 21.75; ws.getRow(catTotal + 1).height = 7.5;
  const cf = (val, bg, fg) => ({ type: "cellIs", operator: "equal", formulae: [`"${val}"`], style: { font: { color: { argb: fg } }, fill: { type: "pattern", pattern: "solid", bgColor: { argb: bg } } } });
  ws.addConditionalFormatting({ ref: `G${catFirst}:H${catTotal}`, rules: [cf("ผ่าน", C.tealLight, C.tealDark), cf("ไม่ผ่าน", C.roseBg, C.rose), cf("N/A", C.slateBg, C.muted)] });

  // รายละเอียดการตรวจ (ป้าย/ค่า 2 ชุดต่อแถว)
  box(ws, detailsHead, 1, detailsHead, NCOL, "รายละเอียดการตรวจ", { size: 12, bold: true, color: C.teal, border: { bottom: medium }, wrap: false });
  ws.getRow(detailsHead).height = 24;
  for (let i = 0; i < metaRows * 2; i += 2) {
    const row = detailsHead + 1 + i / 2;
    [[model.details[i], 1, 3], [model.details[i + 1], 5, 7]].forEach(([d, lc, vc]) => {
      const lEnd = lc === 1 ? 2 : 6, vEnd = lc === 1 ? 4 : 8;
      box(ws, row, lc, row, lEnd, d?.label ?? null, { size: 9, color: C.muted, border: { bottom: thin }, wrap: false });
      box(ws, row, vc, row, vEnd, d?.value ?? null, { bold: true, border: { bottom: thin }, wrap: false });
    });
    ws.getRow(row).height = 20;
  }

  // วาดตารางข้อมูลในส่วนรายละเอียดการตรวจ (ถ้ามี)
  if ((model.gridDetails || []).length > 0) {
    let rGrid = detailsHead + 1 + metaRows;
    ws.getRow(rGrid).height = 7.5;
    rGrid++;

    model.gridDetails.forEach(g => {
      box(ws, rGrid, 1, rGrid, NCOL, `ตาราง: ${g.label}`, { size: 10, bold: true, color: C.tealDark, fill: C.tealLight, border: BOX });
      ws.getRow(rGrid).height = 20;
      rGrid++;

      rGrid = writeInlineGrid(ws, rGrid, { grid: g.grid, text: g.label, num: "" });
      ws.getRow(rGrid).height = 7.5;
      rGrid++;
    });
  }

  ws.getRow(bodyTitle - 1).height = 7.5;
  box(ws, bodyTitle, 1, bodyTitle, NCOL, "ผลการตรวจรายข้อ", { size: 12, bold: true, color: C.teal });
  ws.getRow(bodyTitle).height = 24;

  // หัวตารางผลรายข้อ (พิมพ์ซ้ำทุกหน้า)
  ["ลำดับ", "คำถาม", "คำตอบ", "ได้", "เต็ม", "หมวดคะแนน"].forEach((t, i) => box(ws, tblHead, i + 1, tblHead, i + 1, t, { bold: true, color: C.white, fill: C.teal, h: "center", border: BOX }));
  box(ws, tblHead, 7, tblHead, 8, "หมายเหตุ", { bold: true, color: C.white, fill: C.teal, h: "center", border: BOX });
  ws.getRow(tblHead).height = 22;

  ws.pageSetup = {
    paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0,
    horizontalCentered: true, printTitlesRow: `${tblHead}:${tblHead}`,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.3, footer: 0.3 }
  };
  ws.headerFooter.oddFooter = `&L&8${H.reportNo}&C&8หน้า &P / &N&R&8${H.location}`;

  // ---------- ชีตตารางแนบ ----------
  if (appendix.length) {
    const ax = wb.addWorksheet(APPX_SHEET, { views: [{ showGridLines: false }] });
    const maxCols = Math.max(...appendix.map(a => a.q.grid.columns.length));
    ax.getColumn(1).width = 7; ax.getColumn(2).width = 32;
    for (let i = 0; i < maxCols; i++) ax.getColumn(3 + i).width = 14;
    box(ax, 1, 1, 1, Math.min(2 + maxCols, 8), `ตารางแนบ — ${H.location}  (${H.reportNo})`, { size: 14, bold: true, color: C.white, fill: C.teal });
    ax.getRow(1).height = 30;
    let ar = 3;
    appendix.forEach(({ q, tag }) => {
      const startRow = ar;
      ar = writeAppendixGrid(ax, ar, q, tag);
      // ลิงก์กลับ/ไป ระหว่างชีตหลักกับตารางแนบ
      const cell = ws.getCell(q._row, 3);
      cell.value = { text: `ดูตารางแนบ ${tag}`, hyperlink: `#'${APPX_SHEET}'!A${startRow}` };
      cell.font = { name: FONT, size: 10, underline: true, color: { argb: C.teal } };
    });
    ax.pageSetup = { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 } };
  }
  return wb;
}

// ============================================================
// 3) ปุ่ม Export
// ============================================================
export async function loadSignatureImage(url, toFullUrl = u => u) {
  if (!url) return null;
  try {
    const res = await fetch(toFullUrl(url));
    if (!res.ok) return null;
    const type = res.headers.get("content-type") || "";
    return { buffer: await res.arrayBuffer(), extension: type.includes("jpeg") || type.includes("jpg") ? "jpeg" : "png" };
  } catch { return null; } // ลายเซ็นโหลดไม่ได้ → ปล่อยช่องว่างให้เซ็นด้วยมือ ไม่ทำให้ export ล้ม
}

export async function exportAuditReportToExcel({ record, sections, metaFields, passingScore, categoryOf, header, signatureUrls = {}, toFullUrl, categories, categoryOrder }) {
  const model = buildAuditReportModel({ record, sections, metaFields, passingScore, categoryOf, header, categories, categoryOrder });
  const [{ default: ExcelJS }, auditorSig, auditeeSig] = await Promise.all([
    import("exceljs"),
    loadSignatureImage(signatureUrls.auditor, toFullUrl),
    loadSignatureImage(signatureUrls.auditee, toFullUrl)
  ]);
  const wb = buildAuditReportWorkbook(ExcelJS, model, { signatures: { auditor: auditorSig, auditee: auditeeSig } });
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const y = header.issuedAt.slice(6, 10), m = header.issuedAt.slice(3, 5), d = header.issuedAt.slice(0, 2);
  const filename = `${header.reportNo}_${(header.locationCode || "QSC").replace(/[\\/:*?"<>|]/g, "_")}_${y}${m}${d}.xlsx`;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export default exportAuditReportToExcel;