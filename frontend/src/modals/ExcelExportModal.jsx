import React, { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Check, X, Search, Download, FileSpreadsheet, ChevronDown } from "lucide-react";


import { c, sans, mono, cardStyle } from "../config/theme";
import { DataContext } from "../context/DataContext";
import { exportToExcel, getFetchStart, toDateParam } from "../utils/exportToExcel";
import { fetchAllAuditRecords } from "../utils/fetchAllAuditRecords";
import api from "../config/api";
import ModalWrapper from "../shared/ModalWrapper";
import Header from "../shared/Header";
import Section from "../shared/Section";
import ScoreRing from "../shared/ScoreRing";
import HistoryList from "../shared/HistoryList";
import ErrorBoundary from "../shared/ErrorBoundary";



export default function ExcelExportModal({ initialUnit = null, onClose }) {
  const { locations: allLocations, visibleLocations = [] } = React.useContext(DataContext);
  const isBranchScoped = !!initialUnit;
  // mode "org" = รายงานระดับองค์กร (5 ชีท), "branch" = รายงานรายสาขา (3 ชีท)
  const [exportMode, setExportMode] = useState(isBranchScoped ? "branch" : "org");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUnit, setSelectedUnit] = useState(initialUnit || visibleLocations[0]);
  const [timeRange, setTimeRange] = useState("all"); // 'all' | '1M' | '3M' | '6M' | '1Y'
  const [regionFilter, setRegionFilter] = useState("all");
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(null);
  const [exportError, setExportError] = useState(null);


  const timeRangeOptions = useMemo(() => {
    const now = new Date();
    const thaiMonths = [
      "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
      "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
    ];
    const thaiShortMonths = [
      "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
      "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
    ];

    const curMonth = now.getMonth();
    const curYearBE = now.getFullYear() + 543;
    const curYearShort = curYearBE % 100;

    // 1 เดือนล่าสุด (เดือนปัจจุบัน)
    const label1M = `เดือนล่าสุด (${thaiMonths[curMonth]} ${curYearBE})`;

    // ย้อนหลัง 3 เดือน
    const d3M = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const label3M = `ย้อนหลัง 3 เดือน (${thaiShortMonths[d3M.getMonth()]} - ${thaiShortMonths[curMonth]} ${curYearShort})`;

    // ย้อนหลัง 6 เดือน
    const d6M = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const label6M = `ย้อนหลัง 6 เดือน (${thaiShortMonths[d6M.getMonth()]} - ${thaiShortMonths[curMonth]} ${curYearShort})`;

    // ทั้งปี (YTD)
    const label1Y = `ทั้งปี (YTD ${curYearBE})`;

    return [
      { value: "all", label: "ทั้งหมด" },
      { value: "1M", label: label1M },
      { value: "3M", label: label3M },
      { value: "6M", label: label6M },
      { value: "1Y", label: label1Y }
    ];
  }, []);

  const filteredUnits = useMemo(() => {
    if (!searchQuery.trim()) return visibleLocations;
    const q = searchQuery.toLowerCase();
    return visibleLocations.filter(u => 
      u.name?.toLowerCase().includes(q) || 
      u.fullName?.toLowerCase().includes(q) || 
      u.region?.toLowerCase().includes(q) ||
      u.address?.toLowerCase().includes(q)
    );
  }, [searchQuery, visibleLocations]);

  const handleDownload = async () => {
    setIsExporting(true);
    setExportError(null);
    setProgress(null);
    try {
      const fetchStart = getFetchStart(timeRange);
      const fullAuditRecords = await fetchAllAuditRecords(
        {
          ...(selectedUnit?.id && (isBranchScoped || exportMode === "branch") ? { locationId: selectedUnit.id } : {}),
          ...(fetchStart ? { startDate: toDateParam(fetchStart) } : {}),
        },
        { onProgress: (d, t) => setProgress({ d, t }) }
      );

      const selectedTimeOption = timeRangeOptions.find(opt => opt.value === timeRange);

      exportToExcel({
        mode: exportMode,         // "org" หรือ "branch"
        targetUnit: selectedUnit,
        timeRange,
        timeRangeLabel: selectedTimeOption?.label,
        region: regionFilter,
        locations: visibleLocations || [],
        auditRecords: fullAuditRecords || []
      });
      onClose();
    } catch (err) {
      console.error("[ExcelExportModal] Error exporting:", err);
      setExportError("ไม่สามารถดึงข้อมูลสำหรับส่งออกได้ครบถ้วน กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsExporting(false);
      setProgress(null);
    }
  };

  return (

    <ModalWrapper onClose={onClose} maxWidth="max-w-lg">
      <div className="p-5 sm:p-6 space-y-4 flex-1 overflow-y-auto overscroll-contain min-h-0" style={{ background: c.surface }}>
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: c.border }}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-800 shrink-0">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <span className="text-sm font-bold block" style={{ color: c.ink }}>
                {isBranchScoped ? `ส่งออกรายงาน: ${selectedUnit.fullName || selectedUnit.name}` : "ส่งออกข้อมูลรายงาน Excel (.xlsx)"}
              </span>
              <span className="text-xs text-slate-500">
                {isBranchScoped ? `ภูมิภาค: ${selectedUnit.region}` : "ศูนย์รวบรวมข้อมูลการตรวจมาตรฐาน Q.S.C."}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100 cursor-pointer text-slate-400 hover:text-slate-700">
            <X size={16} />
          </button>
        </div>

        {/* ---------------- SCENARIO A: OPENED FROM SPECIFIC BRANCH PROFILE ---------------- */}
        {isBranchScoped ? (
          <div className="space-y-4">
            {/* Info Card */}
            <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-950 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                <CheckCircle2 size={14} className="text-emerald-700" />
                <span>ไฟล์ Excel (.xlsx) จะมี 3 ชีท:</span>
              </div>
              <div className="text-xs text-emerald-800 leading-relaxed pl-5">
                1. <b>ประวัติคะแนน</b> — ทุกรอบที่ตรวจ + คะแนนแยกหมวด<br />
                2. <b>คำตอบรายข้อ (รอบล่าสุด)</b> — ทุกคำถาม, คะแนน, หมวด, หมายเหตุ<br />
                3. <b>สรุปหมวด</b> — เฉลี่ย PD/PC/S/C/DM ย้อนหลังทุกรอบ
              </div>
            </div>

            {/* Time Range Selector */}
            <div>
              <label className="text-xs font-bold block mb-1.5 text-slate-700">เลือกช่วงเวลาย้อนหลัง</label>
              <div className="relative">
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                  className="w-full text-xs sm:text-sm pl-4 pr-10 py-3 min-h-[50px] rounded-2xl bg-slate-50 border border-slate-200 outline-none font-semibold text-slate-700 focus:border-[#0F6659] focus:bg-white transition-all shadow-xs cursor-pointer appearance-none truncate"
                >
                  <option value="all">ทั้งหมด (ทุกรอบ)</option>
                  <option value="1M">ย้อนหลัง 1 เดือน</option>
                  <option value="3M">ย้อนหลัง 3 เดือน</option>
                  <option value="6M">ย้อนหลัง 6 เดือน</option>
                  <option value="1Y">ย้อนหลัง 1 ปี</option>
                </select>
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <ChevronDown size={18} />
                </div>
              </div>
            </div>
          </div>

        ) : (
          /* ---------------- SCENARIO B: OPENED FROM MAIN DASHBOARD ---------------- */
          <div className="space-y-4">
            {/* Mode Selector Tabs */}
            <div className="flex bg-slate-200/80 p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => setExportMode("org")}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  exportMode === "org" ? 'bg-white text-[#0F6659] shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                รวมทุกสาขา (5 ชีท)
              </button>
              <button
                type="button"
                onClick={() => setExportMode("branch")}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  exportMode === "branch" ? 'bg-white text-[#0F6659] shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                เลือกสาขา (3 ชีท)
              </button>
            </div>

            {exportMode === "org" ? (
              <div className="space-y-3.5">
                <div>
                  <label className="text-xs font-bold block mb-1 text-slate-700">เลือกช่วงเวลาการตรวจ</label>
                  <div className="relative">
                    <select
                      value={timeRange}
                      onChange={(e) => setTimeRange(e.target.value)}
                      className="w-full text-xs sm:text-sm pl-4 pr-10 py-3 min-h-[50px] rounded-2xl bg-slate-50 border border-slate-200 outline-none font-semibold text-slate-700 focus:border-[#0F6659] focus:bg-white transition-all shadow-xs cursor-pointer appearance-none truncate"
                    >
                      {timeRangeOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <ChevronDown size={18} />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold block mb-1 text-slate-700">กรองตามภูมิภาค</label>
                  <div className="relative">
                    <select
                      value={regionFilter}
                      onChange={(e) => setRegionFilter(e.target.value)}
                      className="w-full text-xs sm:text-sm pl-4 pr-10 py-3 min-h-[50px] rounded-2xl bg-slate-50 border border-slate-200 outline-none font-semibold text-slate-700 focus:border-[#0F6659] focus:bg-white transition-all shadow-xs cursor-pointer appearance-none truncate"
                    >
                      <option value="all">ทุกภูมิภาค</option>
                      <option value="กรุงเทพ">เขตกรุงเทพฯ และปริมณฑล</option>
                      <option value="เหนือ">เขตภาคเหนือ</option>
                      <option value="ตะวันออก">เขตภาคตะวันออก</option>
                      <option value="ใต้">เขตภาคใต้</option>
                    </select>
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <ChevronDown size={18} />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3.5">
                <div>
                  <label className="text-xs font-bold block mb-1" style={{ color: c.muted }}>ค้นหาสาขาที่ต้องการส่งออก</label>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="พิมพ์ชื่อสาขา เช่น สยาม, อารีย์, เชียงใหม่..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full text-xs pl-8 pr-8 py-2.5 rounded-xl outline-none font-bold border"
                      style={{ background: c.bg, color: c.ink, borderColor: c.border }}
                    />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer">
                        <X size={13} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="max-h-36 overflow-y-auto overscroll-contain space-y-1.5 p-1 border rounded-2xl" style={{ borderColor: c.border, background: c.bg }}>
                  {filteredUnits.length === 0 && (
                    <div className="text-center py-4 text-xs text-slate-400 font-medium">ไม่พบสาขาที่ค้นหา</div>
                  )}
                  {filteredUnits.map((u) => {
                    const isSelected = selectedUnit?.name === u.name;
                    return (
                      <button
                        key={u.name}
                        type="button"
                        onClick={() => setSelectedUnit(u)}
                        className={`w-full p-2.5 rounded-xl text-left flex items-center justify-between transition-all cursor-pointer ${
                          isSelected ? 'bg-white shadow-2xs border border-emerald-600' : 'hover:bg-white/80 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <ScoreRing score={u.lastScore} size={30} />
                          <div className="min-w-0 truncate">
                            <div className="text-xs font-bold truncate text-slate-900">{u.name}</div>
                            <div className="text-xs text-slate-400 truncate">{u.region}</div>
                          </div>
                        </div>
                        {isSelected && <Check size={16} className="text-emerald-700 shrink-0 mr-1" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {exportError && (
          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
            {exportError}
          </div>
        )}

        {/* Download Action Button */}
        <button
          type="button"
          onClick={handleDownload}
          disabled={isExporting}
          className="w-full py-3.5 px-4 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
          style={{ background: c.accent, color: "#fff" }}
        >
          <Download size={16} className="shrink-0" />
          <span className="truncate max-w-[260px] sm:max-w-none">
            {isExporting
              ? `กำลังดึงข้อมูล ${progress?.d ?? 0}/${progress?.t ?? "?"}...`
              : isBranchScoped
              ? `ดาวน์โหลดรายงาน Excel (.xlsx) — ${selectedUnit.name}`
              : exportMode === "org"
              ? "ดาวน์โหลดรายงาน Excel รวมทุกสาขา (5 ชีท)"
              : `ดาวน์โหลดรายงาน Excel: ${selectedUnit?.name} (3 ชีท)`}
          </span>

        </button>
      </div>
    </ModalWrapper>
  );
}
