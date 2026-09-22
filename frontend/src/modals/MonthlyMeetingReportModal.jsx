import React, { useState, useMemo, useEffect } from "react";
import { BarChart3, Download, X, Loader2, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";

import { c, mono } from "../config/theme";
import { DataContext } from "../context/DataContext";
import ModalWrapper from "../shared/ModalWrapper";
import api from "../config/api";

const THAI_MONTHS_FULL = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
];
const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
];
const ENG_MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "April", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const BRAND_ABBR_MAP = {
  "After You": "AU",
  "after you": "AU",
  "AU": "AU",
  "Mikka": "MK",
  "mikka": "MK"
};

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

function makeSheet(aoa, widths) {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  if (widths) ws["!cols"] = widths.map(w => ({ wch: w }));
  return ws;
}

export default function MonthlyMeetingReportModal({ onClose }) {
  const { visibleLocations = [], selectedBrand = "After You" } = React.useContext(DataContext);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const thaiYear = currentYear + 543;
  const shortYear = thaiYear % 100;
  const currentMonthName = `${THAI_MONTHS_FULL[currentMonth]} ${thaiYear}`;
  const monthNameShort = THAI_MONTHS_SHORT[currentMonth];
  const monthStr = String(currentMonth + 1).padStart(2, "0");

  const [monthRecords, setMonthRecords] = useState([]);
  const [allYearRecords, setAllYearRecords] = useState([]);
  const [monthCaps, setMonthCaps] = useState([]);
  const [isLoadingReport, setIsLoadingReport] = useState(true);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [reportError, setReportError] = useState(null);

  const fetchAllPaged = async (endpoint, params = {}) => {
    const pageSize = 100;
    let page = 1;
    let all = [];
    let totalCount = Infinity;
    while (all.length < totalCount) {
      const res = await api.get(endpoint, { params: { ...params, page, pageSize, includeResponses: true } });
      const data = res.data;
      const items = Array.isArray(data) ? data : (data?.items || []);
      totalCount = Array.isArray(data) ? items.length : (data?.totalCount ?? items.length);
      all = all.concat(items);
      if (items.length === 0) break;
      page += 1;
    }
    return all;
  };

  useEffect(() => {
    let isMounted = true;
    (async () => {
      setIsLoadingReport(true);
      setReportError(null);
      try {
        // 1. กำหนดช่วงเวลา: ตั้งแต่วันที่ 1 ม.ค. ถึง 31 ธ.ค. ของปีปัจจุบัน
        const startOfYear = new Date(currentYear, 0, 1).toISOString();
        const endOfYear = new Date(currentYear + 1, 0, 1).toISOString();

        // 2. ดึงข้อมูลปีนี้รวดเดียวผ่าน API ที่ Backend คุณทำไว้แล้ว (ยิงแค่ 2 เส้นพร้อมกัน)
        const [recordsRes, capsRes] = await Promise.all([
          api.get('/audit/records', {
            params: {
              startDate: startOfYear,
              endDate: endOfYear,
              includeResponses: true // ดึง responses มาในตัว ไม่ต้องยิงซ้ำรายตัวอีก
            }
          }),
          api.get('/cap')
        ]);

        const allYearRecordsData = Array.isArray(recordsRes.data) 
          ? recordsRes.data 
          : (recordsRes.data?.items || []);
        
        const allCapsData = Array.isArray(capsRes.data) 
          ? capsRes.data 
          : (capsRes.data?.items || []);

        // 3. กรองเฉพาะเดือนนี้จากข้อมูลปีปัจจุบันที่ได้มา (คำนวณในแรม ไม่ต้องยิงเน็ตเพิ่ม)
        const isThisMonth = (rawDate) => {
          if (!rawDate) return false;
          const d = new Date(rawDate);
          return !isNaN(d.getTime()) && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        };

        const recordsThisMonth = allYearRecordsData.filter(r => 
          isThisMonth(r.auditDate || r.submittedAt || r.createdAt)
        );
        const capsThisMonth = allCapsData.filter(cItem => isThisMonth(cItem.createdAt));

        if (isMounted) {
          setAllYearRecords(allYearRecordsData);
          setMonthRecords(recordsThisMonth);
          setMonthCaps(capsThisMonth);
        }
      } catch (err) {
        console.error("Load report error:", err);
        if (isMounted) setReportError("ไม่สามารถดึงข้อมูลสำหรับสรุปรายงานประจำเดือนได้ครบถ้วน");
      } finally {
        if (isMounted) setIsLoadingReport(false);
      }
    })();
    return () => { isMounted = false; };
  }, [currentMonth, currentYear]);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const totalLocations = visibleLocations.length;
  const avgScore = monthRecords.length > 0
    ? Math.round(monthRecords.reduce((sum, r) => sum + (r.percentageScore || r.score || 0), 0) / monthRecords.length)
    : 0;
  const passRate = monthRecords.length > 0
    ? Math.round(monthRecords.filter(r => r.isPassed).length / monthRecords.length * 100)
    : 0;
  const passedCount = monthRecords.filter(r => r.isPassed).length;
  const excellentCount = monthRecords.filter(r => (r.percentageScore || r.score || 0) >= 90).length;
  const excellentRate = monthRecords.length > 0
    ? Math.round(excellentCount / monthRecords.length * 100)
    : 0;

  // ── Section Breakdown ─────────────────────────────────────────────────────
  const sectionBreakdown = useMemo(() => {
    const categoryScores = {};
    monthRecords.forEach(r => {
      (r.responses || []).forEach(resp => {
        if (resp.isNa) return;
        const cat = (resp.categoryName || resp.surveyItem?.categoryName || resp.sectionTitle || 'ทั่วไป').trim();
        if (!categoryScores[cat]) categoryScores[cat] = { total: 0, count: 0 };
        categoryScores[cat].total += (resp.scoreGiven || 0);
        categoryScores[cat].count += (resp.fullScore > 0 ? resp.fullScore : 10);
      });
    });
    return Object.entries(categoryScores)
      .map(([title, s]) => ({
        title,
        percent: s.count > 0 ? Math.round((s.total / s.count) * 100) : 0,
      }))
      .sort((a, b) => b.percent - a.percent);
  }, [monthRecords]);

  // ── Top 5 Defects ─────────────────────────────────────────────────────────
  const topDefects = useMemo(() => {
    const defectMap = {};
    monthRecords.forEach(r => {
      (r.responses || []).forEach(resp => {
        if (resp.isPassed === false && !resp.isNa) {
          const key = resp.questionText || resp.surveyItem?.text || 'ไม่ระบุ';
          defectMap[key] = (defectMap[key] || 0) + 1;
        }
      });
    });
    return Object.entries(defectMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([text, count]) => ({ text, count }));
  }, [monthRecords]);

  // ── CAP Stats ─────────────────────────────────────────────────────────────
  const closedCaps = monthCaps.filter(cItem => cItem.status === 'CLOSED' || cItem.status === 'closed').length;
  const totalCaps = monthCaps.length;
  const pendingCaps = totalCaps - closedCaps;

  // ── 🌟 สร้างรายงาน Excel 6 ชีทหลัก ──────────────────────────────────────────
  const handleExportFullExcel = () => {
    setIsExportingExcel(true);
    try {
      const wb = XLSX.utils.book_new();

      // 1. ชีท: บันทึกคะแนนตรวจ (ตัดค่าน้ำออก สูตรเลื่อนเป็น F ถึง K)
      const dateHeader = `25${shortYear}-${monthStr}-01 00:00:00`;
      const sheet1Aoa = [
        [dateHeader],
        ["คำอธิบายเพิ่มเติม: ตัวย่อสาขา(2) หมายถึงเดือนปัจจุบันไม่ผ่านและเดือนที่ผ่านมาล่าสุดก็ไม่ผ่าน(ไม่ผ่าน 2 เดือนติดต่อกัน)"],
        ["คำอธิบายเพิ่มเติม: ตัวย่อสาขา(3) หมายถึงเดือนปัจจุบันไม่ผ่านและสองเดือนที่ผ่านมาล่าสุดก็ไม่ผ่าน(ไม่ผ่าน 3 เดือนติดต่อกัน)"],
        ["No.", "Branch", "Date", "Time", "On Shift ", "PD.", "PC.", "S.", "C.", "DM.", "Percent", "Inspector"]
      ];

      monthRecords.forEach((r, idx) => {
        const cats = getCategoryScores(r);
        const suffix = getBranchFailSuffix(r.locationId, allYearRecords, r.auditDate);
        sheet1Aoa.push([
          idx + 1,
          `${r.locationCode || r.locationName || "-"}${suffix}`,
          formatThaiDateShort(r.auditDate),
          extractTime(r.auditDate, r.time),
          r.teamOnShift || r.shiftLeader || "-",
          cats.PD, cats.PC, cats.S, cats.C, cats.DM,
          Math.round(r.percentageScore ?? 0),
          r.inspectorName || r.auditorName || "-"
        ]);
      });

      if (monthRecords.length > 0) {
        const endRow = 4 + monthRecords.length;
        sheet1Aoa.push([
          "เฉลี่ย", "", "", "", "",
          { t: "n", f: `AVERAGE(F5:F${endRow})` },
          { t: "n", f: `AVERAGE(G5:G${endRow})` },
          { t: "n", f: `AVERAGE(H5:H${endRow})` },
          { t: "n", f: `AVERAGE(I5:I${endRow})` },
          { t: "n", f: `AVERAGE(J5:J${endRow})` },
          { t: "n", f: `AVERAGE(K5:K${endRow})` },
          ""
        ]);
      }
      XLSX.utils.book_append_sheet(wb, makeSheet(sheet1Aoa, [6, 18, 14, 10, 16, 8, 8, 8, 8, 8, 10, 20]), "บันทึกคะแนนตรวจ");

      // 2. ชีท: เรียงอันดับ [เดือน]
      const sheet2Aoa = [
        [],
        ["บริษัท  อาฟเตอร์ ยู จำกัด มหาชน"],
        ["รายการผลการตรวจสอบคุณภาพ และมาตรฐานภายในบริษัท อาฟเตอร์ ยู"],
        [`แผนภูมิแสดงเปอร์เซ็นต์คะแนนผลตรวจสาขาของ ${selectedBrand} ประจำเดือน ${monthNameShort}  ${thaiYear}`],
        [...Array(17).fill(""), "สาขา", "Percent"]
      ];
      const sortedMonthRecords = [...monthRecords].sort((a, b) => (b.percentageScore || 0) - (a.percentageScore || 0));
      sortedMonthRecords.forEach((r, idx) => {
        sheet2Aoa.push([...Array(16).fill(""), idx + 1, r.locationCode || r.locationName, Math.round(r.percentageScore || 0)]);
      });
      XLSX.utils.book_append_sheet(wb, makeSheet(sheet2Aoa), `เรียงอันดับ ${monthNameShort}`);

      // 3. ชีท: แยกหมวดหมู่คะแนนเฉลี่ยทุกสาขา (12 เดือน)
      const sheet3Aoa = [
        [],
        ["บริษัท  อาฟเตอร์ ยู จำกัด มหาชน"],
        [`แผนภูมิแสดงเปอร์เซ็นต์เปรียบเทียบแยกหมวด รวมทั้งบริษัท ของ ${selectedBrand} ปี ${thaiYear}`],
        [],
        ["หมวด", ...THAI_MONTHS_SHORT, "เฉลี่ยทั้งปี"]
      ];
      ["PD", "PC", "S", "C", "DM"].forEach((cat, idx) => {
        const row = [cat];
        for (let m = 0; m < 12; m++) {
          const mRecords = allYearRecords.filter(r => new Date(r.auditDate).getMonth() === m);
          const scores = mRecords.map(r => getCategoryScores(r)[cat]).filter(s => typeof s === "number");
          row.push(scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : "-");
        }
        row.push({ t: "n", f: `AVERAGE(B${6 + idx}:M${6 + idx})` });
        sheet3Aoa.push(row);
      });
      XLSX.utils.book_append_sheet(wb, makeSheet(sheet3Aoa, [10, ...Array(12).fill(8), 12]), "แยกหมวดแยกสาขา");

      // 4. ชีท: ภาพรวมบริษัทต่อปี (12 เดือน)
      const sheet4Aoa = [
        [],
        ["บริษัท  อาฟเตอร์ ยู จำกัด มหาชน"],
        [`แผนภูมิแสดงเปอร์เซ็นต์คะแนนโดยรวมทั้งบริษัทของ ${selectedBrand} ปี ${thaiYear}`],
        [],
        [...Array(10).fill(""), "เดือน", "Percent"]
      ];
      for (let m = 0; m < 12; m++) {
        const mRecords = allYearRecords.filter(r => new Date(r.auditDate).getMonth() === m);
        const avg = mRecords.length > 0 ? Math.round(mRecords.reduce((s, r) => s + (r.percentageScore || 0), 0) / mRecords.length) : "-";
        sheet4Aoa.push([...Array(10).fill(""), THAI_MONTHS_SHORT[m], avg]);
      }
      sheet4Aoa.push([...Array(10).fill(""), "เฉลี่ย", { t: "n", f: "AVERAGE(L6:L17)" }]);
      XLSX.utils.book_append_sheet(wb, makeSheet(sheet4Aoa), `Company ${thaiYear}`);

      // 5. ชีท: แยกหมวดหมู่คะแนนตามสาขา (สาขา x 6 แถว x 12 เดือน)
      const sheet5Aoa = [
        [`คะแนนแยกหมวด(แยกสาขา) ${thaiYear}`],
        ["No.", "Branch/ Month", "", ...ENG_MONTHS_SHORT, "%  เฉลี่ย "]
      ];
      const uniqueBranches = Array.from(new Set(allYearRecords.map(r => r.locationCode || r.locationName)));
      let curRow = 3;
      uniqueBranches.forEach((bName, bIdx) => {
        const bRecords = allYearRecords.filter(r => (r.locationCode || r.locationName) === bName);
        ["PD", "PC", "S", "C", "DM", "%"].forEach((metric, mIdx) => {
          const row = [mIdx === 0 ? bIdx + 1 : "", mIdx === 0 ? bName : "", metric];
          for (let m = 0; m < 12; m++) {
            const mRec = bRecords.find(r => new Date(r.auditDate).getMonth() === m);
            if (!mRec) row.push("-");
            else if (metric === "%") row.push(Math.round(mRec.percentageScore || 0));
            else row.push(getCategoryScores(mRec)[metric] ?? "-");
          }
          row.push({ t: "n", f: `AVERAGE(D${curRow}:O${curRow})` });
          sheet5Aoa.push(row);
          curRow++;
        });
      });
      XLSX.utils.book_append_sheet(wb, makeSheet(sheet5Aoa, [6, 18, 8, ...Array(12).fill(7), 12]), "แยกหมวดสาขา");

      // 6. ชีท: คะแนนเฉลี่ยทั้งปีจัดแบ่งเกรดตามกรุ๊ป (A / B / C)
      const sheet6Aoa = [
        [`AVG. ${currentYear} & Divide into groups`],
        ["Groups", "No.", "Branch", "PD.", "PC.", "S.", "C.", "DM.", "Percent", "A", "90.00-100.00"],
        ["", "", "", "", "", "", "", "", "", "B", "87.00-89.99"],
        ["", "", "", "", "", "", "", "", "", "C", "<87.00"]
      ];
      const branchSummary = uniqueBranches.map(name => {
        const bRecs = allYearRecords.filter(r => (r.locationCode || r.locationName) === name);
        const avg = bRecs.length > 0 ? Math.round(bRecs.reduce((s, r) => s + (r.percentageScore || 0), 0) / bRecs.length) : 0;
        return { name, avg };
      }).sort((a, b) => b.avg - a.avg);

      branchSummary.forEach((b, i) => {
        const grp = b.avg >= 90 ? "Group A" : b.avg >= 87 ? "Group B" : "Group C";
        sheet6Aoa.push([grp, i + 1, b.name, "-", "-", "-", "-", "-", b.avg]);
      });
      XLSX.utils.book_append_sheet(wb, makeSheet(sheet6Aoa), "คะแนนเฉลี่ยทั้งปี");

      // ── ตั้งชื่อไฟล์ด้วยตัวย่อแบรนด์ ─────────────────────────────
      const brandShort = (BRAND_ABBR_MAP[selectedBrand] || selectedBrand || "AU").trim();
      const formName = "AU. Operation Excellence";
      let fileTitle = "";
      if (formName.toLowerCase().startsWith(brandShort.toLowerCase())) {
        fileTitle = formName;
      } else {
        fileTitle = `${brandShort} ${formName}`.trim();
      }

      const yearTwoDigits = String(currentYear).slice(-2); // เช่น 2026 -> 26
      const fileName = `${fileTitle} ${monthStr}.${yearTwoDigits}.xlsx`
        .replace(/[\\/:*?"<>|]/g, "_")
        .replace(/\s+/g, " ")
        .trim();

      XLSX.writeFile(wb, fileName);
    } catch (err) {
      console.error("Export error:", err);
      alert("เกิดข้อผิดพลาดในการสร้างไฟล์ Excel รายงานประจำเดือน");
    } finally {
      setIsExportingExcel(false);
    }
  };

  return (
    <ModalWrapper onClose={onClose} maxWidth="max-w-2xl">
      {/* Header */}
      <div className="shrink-0 p-4 sm:p-5 border-b flex items-center justify-between" style={{ borderColor: c.border, background: "#FAF9F5" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-800 shrink-0">
            <BarChart3 size={20} />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-800">รายงานสรุปผลการตรวจสำหรับที่ประชุมประจำเดือน</h3>
            <p className="text-xs text-slate-500">Executive Monthly Quality &amp; Standards Review</p>
          </div>
        </div>
        <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-200 active:scale-90 cursor-pointer transition-all">
          <X size={18} style={{ color: c.faint }} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overscroll-contain min-h-0 p-4 sm:p-6 space-y-5">
        {isLoadingReport && (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-400">
            <Loader2 size={22} className="animate-spin" />
            <span className="text-xs font-bold">กำลังรวบรวมข้อมูลสำหรับรายงานประจำเดือน...</span>
          </div>
        )}
        {!isLoadingReport && reportError && (
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 text-center">
            {reportError}
          </div>
        )}
        {!isLoadingReport && (
        <>
        <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
          <div>
            <div className="text-xs font-bold text-slate-400">รอบรายงาน</div>
            <div className="text-xs sm:text-sm font-bold text-slate-800">
              สรุปผลการตรวจสอบมาตรฐาน Q.S.C. ประจำเดือน {currentMonthName}
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs">
            ตรวจแล้ว {monthRecords.length}/{totalLocations} สาขา
          </span>
        </div>

        {/* Executive KPI Summary */}
        <div>
          <div className="text-xs font-bold text-slate-500 mb-2">สรุปภาพรวม KPI ประจำเดือน</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-center">
              <div className="text-2xl font-bold text-slate-800 font-mono">{avgScore}%</div>
              <div className="text-xs text-slate-500 font-bold mt-0.5">คะแนนเฉลี่ยรวม</div>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
              <div className="text-2xl font-bold text-emerald-800 font-mono">{passRate}%</div>
              <div className="text-xs text-emerald-700 font-bold mt-0.5">อัตราผ่านเกณฑ์</div>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
              <div className="text-2xl font-bold text-emerald-800 font-mono">{excellentRate}%</div>
              <div className="text-xs text-emerald-700 font-bold mt-0.5">ดีเยี่ยม (≥90%)</div>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
              <div className="text-2xl font-bold text-emerald-800 font-mono">{monthRecords.length}</div>
              <div className="text-xs text-emerald-700 font-bold mt-0.5">สาขาที่ตรวจแล้ว</div>
            </div>
          </div>
        </div>

        {/* Section Breakdown */}
        {sectionBreakdown.length > 0 && (
          <div>
            <div className="text-xs font-bold text-slate-500 mb-2">คะแนนเฉลี่ยแยกตามหมวดหมู่</div>
            <div className="space-y-2">
              {sectionBreakdown.map((s, idx) => (
                <div key={idx} className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                    <span className="text-slate-700">{s.title}</span>
                    <span className={s.percent >= 85 ? "text-emerald-700" : "text-amber-700"}>
                      {s.percent}%
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        s.percent >= 90 ? "bg-emerald-500" : s.percent >= 85 ? "bg-[#0F6659]" : "bg-amber-500"
                      }`}
                      style={{ width: `${s.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top 5 Defect Frequency */}
        <div>
          <div className="text-xs font-bold text-slate-500 mb-2">Top 5 ข้อบกพร่องที่พบบ่อย (Defect Frequency)</div>
          {topDefects.length > 0 ? (
            <div className="space-y-1.5">
              {topDefects.map((d, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-rose-50/60 border border-rose-200/60 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 text-rose-900 font-medium">
                    <span className="w-5 h-5 rounded-full bg-rose-200 text-rose-800 font-bold flex items-center justify-center text-[10px] shrink-0">
                      {idx + 1}
                    </span>
                    <span className="line-clamp-1">{d.text}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-bold shrink-0">
                    {d.count} ครั้ง
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-400 font-medium">
              ไม่พบข้อบกพร่องในเดือนนี้
            </div>
          )}
        </div>

        {/* CAP Status */}
        <div>
          <div className="text-xs font-bold text-slate-500 mb-2">สถานะงานแก้ไขข้อบกพร่อง (CAP) ประจำเดือน</div>
          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-center">
              <div className="text-xl font-bold text-slate-800 font-mono">{totalCaps}</div>
              <div className="text-xs text-slate-500 font-bold mt-0.5">งาน CAP ทั้งหมด</div>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
              <div className="text-xl font-bold text-emerald-800 font-mono">{closedCaps}</div>
              <div className="text-xs text-emerald-700 font-bold mt-0.5">ปิดงานแล้ว</div>
            </div>
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-center">
              <div className="text-xl font-bold text-amber-800 font-mono">{pendingCaps}</div>
              <div className="text-xs text-amber-700 font-bold mt-0.5">รอดำเนินการ</div>
            </div>
          </div>
        </div>
        </>
        )}
      </div>

      {/* Footer Actions */}
      <div className="shrink-0 p-4 border-t bg-slate-50 flex items-center justify-between gap-2" style={{ borderColor: c.border }}>
        <button
          type="button"
          onClick={handleExportFullExcel}
          disabled={isLoadingReport || isExportingExcel}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#0F6659] hover:bg-emerald-800 text-xs font-bold text-white cursor-pointer shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isExportingExcel ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <FileSpreadsheet size={15} />
          )}
          <span>{isExportingExcel ? "กำลังสร้างไฟล์ Excel..." : "ดาวน์โหลดรายงานประจำเดือน (.xlsx)"}</span>
        </button>

        <button
          type="button"
          onClick={onClose}
          className="px-5 py-2.5 rounded-2xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer shadow-2xs transition-all active:scale-95"
        >
          ปิดหน้ารายงาน
        </button>
      </div>
    </ModalWrapper>
  );
}