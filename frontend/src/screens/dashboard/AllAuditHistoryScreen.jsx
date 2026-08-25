import React, { useState, useMemo, useEffect } from "react";
import {
  Search, ArrowUpDown, ChevronRight, ChevronLeft, CheckCircle2,
  Wrench, AlertTriangle, Download, X, Calendar, User, FileText,
  Building2, MapPin, Filter, ClipboardCheck, CalendarDays, Award
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, BarChart, Bar, ReferenceLine, LineChart, Line, Legend, Cell
} from "recharts";

import { c, sans, mono } from "../../config/theme";
import { DataContext } from "../../context/DataContext";
import { INITIAL_UNITS } from "../../mocks/locations";
import { TRENDS_DATA } from "../../mocks/trends";
import ScoreRing from "../../shared/ScoreRing";
import Header from "../../shared/Header";
import ExcelExportModal from "../../modals/ExcelExportModal";
import AuditHistoryDetail from "../audit/AuditHistoryDetail";

export default function AllAuditHistoryScreen({ onBack, onSelectLog, onExportExcel, currentAuditorName = null, title = "รายงานผลการตรวจ" }) {
  const { locations, auditRecords, capTasks } = React.useContext(DataContext);
  const activeLocations = (locations && locations.length > 0) ? locations : INITIAL_UNITS;
  
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [sortBy, setSortBy] = useState("date-desc"); // 'date-desc' | 'score-desc' | 'score-asc' | 'branch'
  const [viewType, setViewType] = useState("history"); // 'history' (รายครั้ง) | 'table' (สาขา) | 'chart' (กราฟ)
  const [rankMode, setRankMode] = useState("top5");
  const [currentPage, setCurrentPage] = useState(1);
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedAuditLog, setSelectedAuditLog] = useState(null);
  const pageSize = 10;

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterCategory, sortBy, viewType]);

  // 🌟 Dynamic Real-time Calculations from Database
  const totalBranches = activeLocations.length || 5;
  const auditedCount = (auditRecords && auditRecords.length > 0) ? auditRecords.length : 1;
  const passedBranches = activeLocations.filter(u => u.lastScore >= 85);
  const passedCount = passedBranches.length;
  const avgScore = totalBranches > 0 ? Math.round(activeLocations.reduce((acc, l) => acc + (l.lastScore || 0), 0) / totalBranches) : 90;
  const pendingCapCount = (capTasks && capTasks.length > 0) 
    ? capTasks.filter(c => c.status !== 'approved' && c.status !== 'CLOSED').length 
    : 1;

  // 🌟 Map logs from Live Database if available, otherwise from mocks
  const allLogs = useMemo(() => {
    if (auditRecords && auditRecords.length > 0) {
      return auditRecords.map((r) => {
        const score = Math.round(r.percentageScore || 0);
        return {
          id: r.id,
          unitName: r.location?.name || r.locationName || "สาขามาตรฐาน",
          unitFullName: r.location?.fullName || r.locationName || "สาขามาตรฐาน",
          region: r.location?.region || "กรุงเทพและปริมณฑล",
          date: r.auditDate ? new Date(r.auditDate).toLocaleDateString('th-TH') : "15 ส.ค. 2569",
          score: score,
          auditor: r.primaryAuditor?.fullName || r.auditorName || "นายสมชาย ใจดี",
          formName: r.surveyForm?.title || "แบบฟอร์มมาตรฐาน 5 ดาว (QSC Core)",
          auditType: r.auditType === 'followup' ? "ตรวจติดตามผล (Follow-up)" : "ตรวจมาตรฐานรอบปกติ (Announced)",
          status: r.isPassed ? "pass" : "fail",
          record: r
        };
      });
    }

    const logs = [];
    activeLocations.forEach(u => {
      (u.history || []).forEach(h => {
        logs.push({
          id: h.id || Math.random(),
          unitName: u.name,
          unitFullName: u.fullName || u.name,
          region: u.region || "กรุงเทพฯ",
          date: h.date,
          score: h.score,
          auditor: h.auditor || "สมชาย ใจดี",
          formName: h.form || "ตรวจร้านอาหารและเครื่องดื่ม v3",
          auditType: h.auditType || (h.score < 70 ? "ตรวจติดตามผล (Follow-up)" : "ตรวจมาตรฐานรอบปกติ (Announced)"),
          status: h.status,
          record: h
        });
      });
    });
    return logs;
  }, [auditRecords, activeLocations]);

  const baseLogs = useMemo(() => {
    return currentAuditorName ? allLogs.filter((log) => log.auditor.includes(currentAuditorName) || currentAuditorName.includes(log.auditor)) : allLogs;
  }, [allLogs, currentAuditorName]);

  const filteredAndSortedLogs = useMemo(() => {
    let list = [...baseLogs];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(l =>
        (l.unitName && l.unitName.toLowerCase().includes(q)) ||
        (l.unitFullName && l.unitFullName.toLowerCase().includes(q)) ||
        (l.region && l.region.toLowerCase().includes(q)) ||
        (l.date && l.date.toLowerCase().includes(q)) ||
        (l.auditor && l.auditor.toLowerCase().includes(q)) ||
        (l.formName && l.formName.toLowerCase().includes(q))
      );
    }

    if (filterCategory === "passed") {
      list = list.filter(l => l.score >= 85);
    } else if (filterCategory === "improve") {
      list = list.filter(l => l.score >= 70 && l.score < 85);
    } else if (filterCategory === "critical") {
      list = list.filter(l => l.score < 70);
    } else if (filterCategory === "bkk") {
      list = list.filter(l => (l.region || '').includes("กรุงเทพ"));
    } else if (filterCategory === "north") {
      list = list.filter(l => (l.region || '').includes("เหนือ"));
    } else if (filterCategory === "east") {
      list = list.filter(l => (l.region || '').includes("ตะวันออก") && !(l.region || '').includes("เฉียงเหนือ"));
    } else if (filterCategory === "northeast") {
      list = list.filter(l => (l.region || '').includes("ตะวันออกเฉียงเหนือ") || (l.region || '').includes("อีสาน"));
    } else if (filterCategory === "south") {
      list = list.filter(l => (l.region || '').includes("ใต้"));
    }

    if (sortBy === "score-desc") {
      list.sort((a, b) => b.score - a.score);
    } else if (sortBy === "score-asc") {
      list.sort((a, b) => a.score - b.score);
    } else if (sortBy === "branch") {
      list.sort((a, b) => a.unitName.localeCompare(b.unitName, "th"));
    }

    return list;
  }, [baseLogs, searchTerm, filterCategory, sortBy]);

  // Pagination calculation
  const totalCount = filteredAndSortedLogs.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedLogs = filteredAndSortedLogs.slice(startIndex, startIndex + pageSize);
  const startItem = totalCount === 0 ? 0 : startIndex + 1;
  const endItem = Math.min(startIndex + pageSize, totalCount);

  const rankedBranches = useMemo(() => {
    return [...activeLocations]
      .sort((a, b) => (rankMode === "top5" ? b.lastScore - a.lastScore : a.lastScore - b.lastScore))
      .slice(0, 5);
  }, [rankMode, activeLocations]);

  if (selectedAuditLog) {
    return (
      <AuditHistoryDetail
        unitName={selectedAuditLog.unitName}
        record={selectedAuditLog.record}
        onBack={() => setSelectedAuditLog(null)}
      />
    );
  }

  return (
    <div className="page-transition p-3.5 sm:p-6 space-y-4 w-full max-w-[100%] sm:max-w-[96%] md:max-w-[92%] mx-auto pb-28 lg:pb-12" style={{ fontFamily: sans }}>
      
      {/* ── Top Header ── */}
      {onBack && (
        <Header
          title={title}
          subtitle={`${currentAuditorName ? `ประวัติที่ ${currentAuditorName} ตรวจ · ` : ""}บันทึกผลการตรวจ ${baseLogs.length} รอบตรวจ`}
          onBack={onBack}
        />
      )}

      {!onBack && (
        <div className="flex items-center justify-between pb-1 px-1">
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900">{title}</h2>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              {`${currentAuditorName ? `ประวัติที่ ${currentAuditorName} ตรวจ · ` : ""}บันทึกผลการตรวจทั้งหมด ${baseLogs.length} รอบตรวจ`}
            </p>
          </div>
          <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-xl border border-slate-200 shadow-2xs text-[11px] font-bold text-slate-700">
            <CalendarDays size={12} className="text-[#0F6659]" />
            <span>ส.ค. 2569</span>
          </div>
        </div>
      )}

      {/* ── 🌟 1. UNIFIED DASHBOARD SUMMARY HERO CARDS (ตรงตามหน้า Dashboard เป๊ะๆ) ── */}
      <div className="space-y-2.5">
        {/* 📱 Card 1 (บน): วงแหวนคะแนนซ้าย + ข้อความสรุปขวา */}
        <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200 shadow-2xs flex items-center gap-3.5">
          <ScoreRing score={avgScore} size={48} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-extrabold text-slate-400">คะแนนเฉลี่ยภาพรวม</span>
              <span className="text-xs font-black text-slate-900" style={{ fontFamily: mono }}>{avgScore}%</span>
            </div>
            <div className="text-xs font-bold text-emerald-800 mt-0.5 truncate">
              ✓ ผ่านเกณฑ์มาตรฐาน ({passedCount} จาก {totalBranches} สาขา)
            </div>
          </div>
        </div>

        {/* 📱 Card 2 (ล่าง): ไอคอนสถิติตรวจแล้ว & งานค้าง CAP */}
        <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200 shadow-2xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-[#0F6659] border border-emerald-200 flex items-center justify-center shrink-0">
            <ClipboardCheck size={20} />
          </div>
          <div className="min-w-0 flex-1 grid grid-cols-2 gap-2">
            <div>
              <div className="text-[11px] font-bold text-slate-400">ตรวจแล้ว</div>
              <div className="text-xs sm:text-sm font-extrabold text-slate-900 mt-0.5" style={{ fontFamily: mono }}>
                {auditedCount} / {totalBranches} สาขา
              </div>
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-400">งานค้างส่ง CAP</div>
              <div className="text-xs sm:text-sm font-extrabold text-rose-700 mt-0.5" style={{ fontFamily: mono }}>
                {pendingCapCount} รายการ
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 🌟 2. THREE SEGMENTED TABS (รายครั้ง / สาขา / กราฟ) ── */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        
        {/* Toggle Bar — 3 ปุ่มใหญ่เต็มความกว้าง */}
        <div className="p-3 border-b flex gap-2 bg-[#FAF9F5]" style={{ borderColor: c.border }}>
          {[
            { key: "history", label: "📅  รายครั้ง" },
            { key: "table",   label: "📋  สาขา" },
            { key: "chart",   label: "📈  กราฟ" },
          ].map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setViewType(key)}
              className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold cursor-pointer transition-all active:scale-98 ${
                viewType === key
                  ? "bg-[#0F6659] text-white shadow-md"
                  : "bg-white text-slate-600 border border-slate-200 hover:border-emerald-400 hover:text-emerald-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Filter bar (เฉพาะโหมดสาขา / รายครั้ง) */}
        {(viewType === "history" || viewType === "table") && (
          <div className="px-3.5 py-2.5 border-b flex flex-col sm:flex-row items-stretch sm:items-center gap-2" style={{ borderColor: c.border }}>
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="ค้นหาชื่อสาขา, วันที่, ผู้ตรวจ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs pl-8 pr-7 py-2 rounded-xl bg-slate-50 border border-slate-200 outline-none font-semibold text-slate-800 focus:bg-white focus:border-[#0F6659] transition-colors"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X size={12} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 flex-1 sm:flex-none">
                <Filter size={12} className="text-[#0F6659]" />
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="bg-transparent text-xs font-bold outline-none cursor-pointer text-slate-700"
                >
                  <option value="all">ทุกสาขา</option>
                  <option value="passed">ผ่านเกณฑ์ (≥85%)</option>
                  <option value="improve">ต้องปรับปรุง (70-84%)</option>
                  <option value="critical">วิกฤต (&lt;70%)</option>
                  <option value="bkk">เขตกรุงเทพฯ</option>
                  <option value="north">เขตภาคเหนือ</option>
                  <option value="east">เขตภาคตะวันออก</option>
                  <option value="northeast">เขตภาคอีสาน</option>
                  <option value="south">เขตภาคใต้</option>
                </select>
              </div>

              {/* Excel Export Button */}
              <button
                type="button"
                onClick={() => {
                  if (onExportExcel) onExportExcel();
                  setShowExportModal(true);
                }}
                className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:border-[#0F6659] hover:bg-emerald-50 text-xs font-extrabold text-slate-800 hover:text-[#0F6659] cursor-pointer shadow-2xs transition-all active:scale-95 shrink-0"
                title="ส่งออกรายงานเป็น Excel"
              >
                <Download size={13} className="text-[#0F6659]" />
                <span>Excel</span>
              </button>
            </div>
          </div>
        )}

        {/* ── Tab Content ── */}
        {viewType === "history" ? (
          <div className="p-3.5 sm:p-4 space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-slate-700">รอบตรวจล่าสุด ({totalCount} รอบ)</span>
              <button
                type="button"
                onClick={() => setSortBy(prev => prev === 'score-desc' ? 'score-asc' : 'score-desc')}
                className="flex items-center gap-1 text-[11px] font-bold text-[#0F6659] hover:underline cursor-pointer"
              >
                <ArrowUpDown size={11} />
                <span>เรียงคะแนน {sortBy === 'score-desc' ? 'สูง➔ต่ำ' : sortBy === 'score-asc' ? 'ต่ำ➔สูง' : ''}</span>
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {paginatedLogs.map((log, idx) => {
                const isPassed = log.score >= 85;
                const isCritical = log.score < 70;
                const scoreColor = isCritical ? "text-rose-700 bg-rose-50 border-rose-200" : isPassed ? "text-[#0F6659] bg-emerald-50 border-emerald-200" : "text-amber-800 bg-amber-50 border-amber-200";
                const statusBadge = isCritical ? "bg-rose-100 text-rose-800" : isPassed ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800";
                const statusLabel = isCritical ? "วิกฤต" : isPassed ? "ผ่านเกณฑ์" : "ปรับปรุง";

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      if (onSelectLog) {
                        onSelectLog({ unitName: log.unitFullName, record: log.record });
                      } else {
                        setSelectedAuditLog({ unitName: log.unitFullName, record: log.record });
                      }
                    }}
                    className="w-full bg-white rounded-2xl p-3.5 border border-slate-200 shadow-2xs hover:border-[#0F6659] text-left transition-all active:scale-98 cursor-pointer flex flex-col gap-2.5 group"
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-sm font-black border shadow-2xs shrink-0 ${scoreColor}`} style={{ fontFamily: mono }}>
                          {log.score}%
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-black text-slate-900 truncate group-hover:text-[#0F6659] transition-colors">
                            {log.unitName}
                          </div>
                          <div className="text-[11px] font-semibold text-slate-400 truncate flex items-center gap-1 mt-0.5">
                            <MapPin size={11} className="shrink-0" />
                            <span>{log.region}</span>
                          </div>
                        </div>
                      </div>

                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md shrink-0 ${statusBadge}`}>
                        {statusLabel}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 gap-2">
                      <div className="flex items-center gap-3 min-w-0 truncate">
                        <span className="flex items-center gap-1 truncate font-medium">
                          <Calendar size={12} className="text-slate-400 shrink-0" />
                          <span>{log.date}</span>
                        </span>
                        <span className="flex items-center gap-1 truncate font-medium">
                          <User size={12} className="text-slate-400 shrink-0" />
                          <span className="truncate">{log.auditor}</span>
                        </span>
                      </div>
                      <ChevronRight size={16} className="text-slate-300 group-hover:text-[#0F6659] group-hover:translate-x-0.5 transition-all shrink-0" />
                    </div>
                  </button>
                );
              })}

              {filteredAndSortedLogs.length === 0 && (
                <div className="text-center text-xs py-10 text-slate-400 font-bold">
                  ไม่พบประวัติการตรวจที่ตรงกับคำค้นหา
                </div>
              )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs font-medium text-slate-500">
                <span>หน้า {currentPage} จาก {totalPages} ({totalCount} รายการ)</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 font-bold disabled:opacity-40"
                  >
                    ก่อนหน้า
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 font-bold disabled:opacity-40"
                  >
                    ถัดไป
                  </button>
                </div>
              </div>
            )}
          </div>

        ) : viewType === "table" ? (
          /* ── Tab: สาขา (Branch Ranking) ── */
          <div className="p-3.5 sm:p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex rounded-xl overflow-hidden border p-0.5 bg-slate-100 w-full sm:w-auto" style={{ borderColor: c.border }}>
                <button
                  type="button"
                  onClick={() => setRankMode("top5")}
                  className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
                    rankMode === "top5"
                      ? 'bg-emerald-700 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>Top 5 สูงสุด</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRankMode("bottom5")}
                  className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
                    rankMode === "bottom5"
                      ? 'bg-rose-700 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>5 อันดับต่ำสุด</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {rankedBranches.map((u, idx) => {
                const rankBadge = idx === 0 
                  ? "bg-amber-100 text-amber-900 font-black border border-amber-300"
                  : idx === 1
                  ? "bg-slate-200 text-slate-800 font-bold"
                  : idx === 2
                  ? "bg-amber-50 text-amber-800 font-bold"
                  : "bg-slate-100 text-slate-600 font-medium";

                const isPassed = u.lastScore >= 85;
                const isCritical = u.lastScore < 70;

                return (
                  <div
                    key={u.name}
                    className="w-full rounded-2xl p-3 sm:p-3.5 bg-white border border-slate-200 flex items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`w-6 h-6 rounded-xl flex items-center justify-center text-xs shrink-0 ${rankBadge}`}>
                        #{idx + 1}
                      </div>
                      <ScoreRing score={u.lastScore} size={36} />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                          {u.name}
                        </div>
                        <div className="text-[10.5px] text-slate-400 truncate">{u.region}</div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className={`text-xs sm:text-sm font-bold ${
                        isCritical ? 'text-red-700' : isPassed ? 'text-emerald-800' : 'text-amber-800'
                      }`} style={{ fontFamily: mono }}>
                        {u.lastScore}%
                      </div>
                      <div className="text-[10px] font-bold text-slate-400">
                        {isPassed ? "ผ่านเกณฑ์" : isCritical ? "วิกฤต" : "ปรับปรุง"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        ) : (
          /* ── Tab: กราฟ (Charts) ── */
          <div className="p-4 space-y-4">
            <div className="text-xs font-bold text-slate-700">แนวโน้มคะแนนเฉลี่ยย้อนหลัง 6 เดือน</div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={TRENDS_DATA["6M"]} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="scoreGradReport" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0F6659" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#0F6659" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis domain={[60, 100]} tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }} />
                  <Area type="monotone" dataKey="avg" stroke="#0F6659" strokeWidth={2.5} fillOpacity={1} fill="url(#scoreGradReport)" name="คะแนนเฉลี่ย" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

      </div>

      {showExportModal && (
        <ExcelExportModal onClose={() => setShowExportModal(false)} />
      )}
    </div>
  );
}
