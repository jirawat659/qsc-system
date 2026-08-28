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
import ScoreRing from "../../shared/ScoreRing";
import Header from "../../shared/Header";
import ExcelExportModal from "../../modals/ExcelExportModal";
import AuditHistoryDetail from "../audit/AuditHistoryDetail";
import BranchProfile from "./BranchProfile";
import api from "../../config/api";
import { parseAuditTimestamp } from "../../utils/formatters";

export default function AllAuditHistoryScreen({ onBack, onSelectLog, onExportExcel, currentAuditorName = null, title = "รายงานผลการตรวจ" }) {
  const { locations, auditRecords, capTasks } = React.useContext(DataContext);
  const activeLocations = locations || [];
  const [trendsData, setTrendsData] = useState([]);

  useEffect(() => {
    let isMounted = true;
    api.get('/dashboard/trends')
      .then(res => {
        if (isMounted && res.data?.monthlyTrends) {
          setTrendsData(res.data.monthlyTrends.map(t => ({
            label: t.month,
            score: t.score
          })));
        }
      })
      .catch(err => console.warn("Could not load trends in AllAuditHistoryScreen:", err));
    return () => { isMounted = false; };
  }, []);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [sortBy, setSortBy] = useState("date-desc"); // 'date-desc' | 'date-asc' | 'branch-asc' | 'branch-desc' | 'score-desc' | 'score-asc'
  const [viewType, setViewType] = useState("history"); // 'history' (รายครั้ง) | 'table' (สาขา) | 'chart' (กราฟ)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedAuditLog, setSelectedAuditLog] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const pageSize = 10;

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterCategory, sortBy, viewType]);

  // Sync input text with currentPage when navigating via buttons
  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  // 🌟 Dynamic Real-time Calculations from Database
  const totalBranches = activeLocations.length;
  const auditedCount = (auditRecords && auditRecords.length > 0) ? auditRecords.length : 0;
  const passedBranches = activeLocations.filter(u => (u.lastScore || 0) >= 85);
  const passedCount = passedBranches.length;
  const avgScore = totalBranches > 0 ? Math.round(activeLocations.reduce((acc, l) => acc + (l.lastScore || 0), 0) / totalBranches) : 0;
  const pendingCapCount = (capTasks && capTasks.length > 0) 
    ? capTasks.filter(c => c.status !== 'approved' && c.status !== 'CLOSED').length 
    : 0;

  // 🌟 Map logs from Live Database if available, otherwise from mocks
  const allLogs = useMemo(() => {
    if (auditRecords && auditRecords.length > 0) {
      return auditRecords.map((r) => {
        const score = Math.round(r.percentageScore || 0);
        const branchName = r.locationName || r.location?.name || "-";
        const branchFullName = r.locationName || r.location?.fullName || r.location?.name || "-";
        const rawDate = r.auditDate || r.createdAt;
        const dateFormatted = rawDate ? new Date(rawDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) : "-";
        const timestamp = parseAuditTimestamp(rawDate, r.id);
        const auditorVal = r.primaryAuditor?.fullName || r.auditorName || r.auditor || "-";
        const formVal = r.surveyFormTitle || r.surveyForm?.title || r.form || "-";
        return {
          id: r.id,
          unitName: branchName,
          unitFullName: branchFullName,
          region: r.locationRegion || r.location?.region || "-",
          date: dateFormatted,
          rawDate: rawDate,
          timestamp: timestamp,
          score: score,
          auditor: auditorVal,
          formName: formVal,
          auditType: (r.auditType === 'unannounced' || r.auditType === 'spot') ? "นอกกำหนดการ" : (r.auditType === 'undercover' ? "ปลอมตัว" : "ตามกำหนดการ"),
          status: r.isPassed ? "pass" : "fail",
          record: {
            ...r,
            unitName: branchName,
            unitFullName: branchFullName,
            score: score,
            percentageScore: score,
            date: dateFormatted,
            auditDate: r.auditDate,
            auditor: auditorVal,
            auditorName: auditorVal,
            form: formVal,
            formName: formVal,
            surveyFormTitle: formVal,
            status: r.isPassed ? "pass" : "fail",
            isPassed: r.isPassed,
            hasCriticalDefect: r.hasCriticalDefect
          }
        };
      });
    }

    const logs = [];
    activeLocations.forEach(u => {
      (u.history || []).forEach((h, hIdx) => {
        const timestamp = parseAuditTimestamp(h.date, h.id || hIdx);
        logs.push({
          id: h.id || `hist-${u.id || u.name}-${hIdx}`,
          unitName: u.name,
          unitFullName: u.fullName || u.name,
          region: u.region || "-",
          date: h.date,
          rawDate: h.date,
          timestamp: timestamp,
          score: h.score,
          auditor: h.auditor || "-",
          formName: h.form || "-",
          auditType: (h.auditType === 'unannounced' || h.auditType === 'spot') ? "นอกกำหนดการ" : (h.auditType === 'undercover' ? "ปลอมตัว" : "ตามกำหนดการ"),
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
      list = list.filter(l => l.score < 85);
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

    // 🌟 Sorting Logic:
    if (sortBy === "date-desc") {
      list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0) || (b.id || 0) - (a.id || 0));
    } else if (sortBy === "date-asc") {
      list.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0) || (a.id || 0) - (b.id || 0));
    } else if (sortBy === "branch-asc" || sortBy === "branch") {
      list.sort((a, b) => (a.unitName || "").localeCompare(b.unitName || "", "th"));
    } else if (sortBy === "branch-desc") {
      list.sort((a, b) => (b.unitName || "").localeCompare(a.unitName || "", "th"));
    } else if (sortBy === "score-desc") {
      list.sort((a, b) => (b.score || 0) - (a.score || 0));
    } else if (sortBy === "score-asc") {
      list.sort((a, b) => (a.score || 0) - (b.score || 0));
    } else {
      list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0) || (b.id || 0) - (a.id || 0));
    }

    return list;
  }, [baseLogs, searchTerm, filterCategory, sortBy]);

  // 🌟 Map branches list with real last score, date, and complete history across all rounds
  const allBranches = useMemo(() => {
    return activeLocations.map(u => {
      // Filter ALL audit records for this branch from live database
      const branchAudits = (auditRecords || []).filter(r => 
        (r.locationId && r.locationId === u.id) || 
        (r.locationName && (r.locationName === u.name || r.locationName === u.fullName)) ||
        (r.location?.name && (r.location.name === u.name || r.location.name === u.fullName))
      );

      const mappedHistory = branchAudits.map(r => {
        const score = Math.round(r.percentageScore || 0);
        const rawDate = r.auditDate || r.createdAt;
        const dateFormatted = rawDate ? new Date(rawDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) : "-";
        const auditorVal = r.primaryAuditor?.fullName || r.auditorName || r.auditor || "-";
        const formVal = r.surveyFormTitle || r.surveyForm?.title || r.form || "-";
        return {
          id: r.id,
          date: dateFormatted,
          auditDate: rawDate,
          score: score,
          percentageScore: score,
          auditor: auditorVal,
          auditorName: auditorVal,
          form: formVal,
          formName: formVal,
          auditType: r.auditType === 'followup' ? "ตรวจติดตามผล (Follow-up)" : "ตรวจมาตรฐานรอบปกติ (Announced)",
          status: r.isPassed ? "pass" : "fail",
          isPassed: r.isPassed,
          hasCriticalDefect: r.hasCriticalDefect,
          ...r
        };
      });

      const finalHistory = mappedHistory.length > 0 ? mappedHistory : (u.history || []);
      const lastAudit = mappedHistory[0] || (u.history && u.history[0]) || null;
      const rawDate = lastAudit?.auditDate || lastAudit?.date || u.lastAuditDate || null;
      const timestamp = parseAuditTimestamp(rawDate, u.id);
      const lastScore = lastAudit ? lastAudit.score : (u.lastScore !== undefined ? u.lastScore : 0);
      const dateFormatted = rawDate ? (lastAudit?.date || new Date(rawDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })) : "-";
      const locTypeName = u.locationType?.name || (typeof u.locationType === 'string' ? u.locationType : null) || u.type || "-";

      return {
        ...u,
        id: u.id,
        name: u.name,
        fullName: u.fullName || u.name,
        code: u.code,
        region: u.region || "-",
        address: u.address || "-",
        phone: u.phone || "-",
        locationType: locTypeName,
        lastScore: lastScore,
        score: lastScore,
        lastAuditDate: rawDate,
        dateFormatted: dateFormatted,
        timestamp: timestamp,
        history: finalHistory,
        latestRecord: lastAudit,
        rawLocation: u
      };
    });
  }, [activeLocations, auditRecords]);

  const filteredAndSortedBranches = useMemo(() => {
    let list = [...allBranches];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(l =>
        (l.name && l.name.toLowerCase().includes(q)) ||
        (l.fullName && l.fullName.toLowerCase().includes(q)) ||
        (l.code && l.code.toLowerCase().includes(q)) ||
        (l.region && l.region.toLowerCase().includes(q)) ||
        (l.locationType && l.locationType.toLowerCase().includes(q)) ||
        (l.dateFormatted && l.dateFormatted.toLowerCase().includes(q))
      );
    }

    if (filterCategory === "passed") {
      list = list.filter(l => l.lastScore >= 85);
    } else if (filterCategory === "improve") {
      list = list.filter(l => l.lastScore < 85);
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

    // 🌟 Sorting for branches:
    if (sortBy === "date-desc") {
      list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0) || (b.id || 0) - (a.id || 0));
    } else if (sortBy === "date-asc") {
      list.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0) || (a.id || 0) - (b.id || 0));
    } else if (sortBy === "branch-asc" || sortBy === "branch") {
      list.sort((a, b) => (a.name || "").localeCompare(b.name || "", "th"));
    } else if (sortBy === "branch-desc") {
      list.sort((a, b) => (b.name || "").localeCompare(a.name || "", "th"));
    } else if (sortBy === "score-desc") {
      list.sort((a, b) => (b.lastScore || 0) - (a.lastScore || 0));
    } else if (sortBy === "score-asc") {
      list.sort((a, b) => (a.lastScore || 0) - (b.lastScore || 0));
    } else {
      list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0) || (b.id || 0) - (a.id || 0));
    }

    return list;
  }, [allBranches, searchTerm, filterCategory, sortBy]);

  // Pagination calculation
  const activeList = viewType === "table" ? filteredAndSortedBranches : filteredAndSortedLogs;
  const totalCount = activeList.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedLogs = filteredAndSortedLogs.slice(startIndex, startIndex + pageSize);
  const paginatedBranches = filteredAndSortedBranches.slice(startIndex, startIndex + pageSize);
  const startItem = totalCount === 0 ? 0 : startIndex + 1;
  const endItem = Math.min(startIndex + pageSize, totalCount);

  // Submit typed page number only on Enter or Blur
  const handlePageSubmit = () => {
    const val = parseInt(pageInput, 10);
    if (!isNaN(val)) {
      const targetPage = Math.max(1, Math.min(totalPages, val));
      setCurrentPage(targetPage);
      setPageInput(String(targetPage));
    } else {
      setPageInput(String(currentPage));
    }
  };

  if (selectedBranch) {
    return (
      <BranchProfile
        unit={selectedBranch}
        onBack={() => setSelectedBranch(null)}
      />
    );
  }

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
            <span>{new Date().toLocaleDateString('th-TH', { month: 'short', year: 'numeric' })}</span>
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

            <div className="flex items-center gap-2 flex-1 w-full">
              <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 flex-1 w-full hover:border-[#0F6659] transition-colors">
                <Filter size={13} className="text-[#0F6659] shrink-0" />
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="bg-transparent text-xs font-bold outline-none cursor-pointer text-slate-700 flex-1 w-full"
                >
                  <option value="all">ทุกสาขา</option>
                  <option value="passed">ผ่านเกณฑ์ (≥85%)</option>
                  <option value="improve">ต้องปรับปรุง (&lt;85%)</option>
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

        {/* ── Tab Content: ตารางผลตรวจรายครั้ง ── */}
        {viewType === "history" ? (
          <div className="space-y-2">
            <div className="overflow-x-auto custom-tab-scrollbar">
              <table className="w-full text-left border-collapse min-w-[1100px] table-fixed">
                {/* Table Header */}
                <thead>
                  <tr className="border-b border-slate-200/80 bg-[#FAF9F5] text-slate-700 text-xs font-bold select-none">
                    <th className="py-3 px-4 w-[50%]">
                      <button 
                        type="button" 
                        onClick={() => setSortBy(prev => prev === 'branch-asc' ? 'branch-desc' : 'branch-asc')}
                        className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
                          sortBy.startsWith('branch') ? 'text-[#0F6659] font-black' : 'hover:text-[#0F6659]'
                        }`}
                        title="เรียงตามชื่อสาขา (ก-ฮ / ฮ-ก)"
                      >
                        <span className="truncate">รอบตรวจ & สาขา</span>
                        {sortBy === 'branch-asc' && <span className="text-[10px] font-black text-[#0F6659] bg-emerald-100 px-1.5 py-0.5 rounded-md shrink-0">▲ ก-ฮ</span>}
                        {sortBy === 'branch-desc' && <span className="text-[10px] font-black text-[#0F6659] bg-emerald-100 px-1.5 py-0.5 rounded-md shrink-0">▼ ฮ-ก</span>}
                        {!sortBy.startsWith('branch') && <ArrowUpDown size={13} className="text-slate-400 shrink-0" />}
                      </button>
                    </th>
                    <th className="py-3 px-4 w-[15%] text-center">
                      <button
                        type="button"
                        onClick={() => setSortBy(prev => prev === 'score-desc' ? 'score-asc' : 'score-desc')}
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full border shadow-2xs text-xs font-bold transition-all cursor-pointer ${
                          sortBy.startsWith('score')
                            ? 'bg-emerald-50 border-emerald-400 text-[#0F6659] font-black ring-2 ring-emerald-500/20'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-[#0F6659] hover:text-[#0F6659]'
                        }`}
                        title="เรียงตามคะแนน (มากไปน้อย / น้อยไปมาก)"
                      >
                        <span>คะแนน</span>
                        {sortBy === 'score-desc' && <span className="text-[10px] text-[#0F6659] font-black">▼</span>}
                        {sortBy === 'score-asc' && <span className="text-[10px] text-[#0F6659] font-black">▲</span>}
                        {!sortBy.startsWith('score') && <ArrowUpDown size={11} className="text-slate-400" />}
                      </button>
                    </th>
                    <th className="py-3 px-4 w-[30%]">
                      <span className="truncate">แบบฟอร์มการตรวจ</span>
                    </th>
                    <th className="py-3 px-4 w-[15%]">
                      <button 
                        type="button" 
                        onClick={() => setSortBy(prev => prev === 'date-desc' ? 'date-asc' : 'date-desc')}
                        className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
                          sortBy.startsWith('date') ? 'text-[#0F6659] font-black' : 'hover:text-[#0F6659]'
                        }`}
                        title="เรียงตามวันที่ตรวจ (ล่าสุด / เก่าสุด)"
                      >
                        <span className="truncate">วันที่ตรวจ</span>
                        {sortBy === 'date-desc' && <span className="text-[10px] font-black text-[#0F6659] bg-emerald-100 px-1.5 py-0.5 rounded-md shrink-0">▼</span>}
                        {sortBy === 'date-asc' && <span className="text-[10px] font-black text-[#0F6659] bg-emerald-100 px-1.5 py-0.5 rounded-md shrink-0">▲</span>}
                        {!sortBy.startsWith('date') && <ArrowUpDown size={13} className="text-slate-400 shrink-0" />}
                      </button>
                    </th>
                    <th className="py-3 px-4 w-[23%]">
                      <span className="truncate">ผู้ตรวจประเมิน</span>
                    </th>
                    <th className="py-3 px-4 w-[12%] text-center">
                      <span className="truncate">สถานะ</span>
                    </th>
                  </tr>
                </thead>

                {/* Table Body */}
                <tbody className="divide-y divide-slate-100 bg-white">
                  {paginatedLogs.map((log, idx) => {
                    const rowNumber = (currentPage - 1) * pageSize + idx + 1;
                    const isPassed = log.score >= 85;
                    const isCritical = log.score < 70;

                    // Score Circle Color:
                    const circleColor = isCritical
                      ? "border-rose-600 text-rose-700"
                      : isPassed
                      ? "border-emerald-600 text-emerald-800"
                      : "border-amber-600 text-amber-800";

                    // Percentage Pill:
                    const scorePill = isCritical
                      ? "bg-rose-50 text-rose-700 border border-rose-200/60"
                      : isPassed
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                      : "bg-amber-50 text-amber-700 border border-amber-200/60";

                    // Status Pill:
                    const statusBadge = isCritical
                      ? "bg-rose-100 text-rose-800"
                      : isPassed
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-900";

                    const statusText = isCritical ? "วิกฤต" : isPassed ? "ผ่านเกณฑ์" : "ต้องปรับปรุง";

                    return (
                      <tr
                        key={log.id || idx}
                        onClick={() => {
                          if (onSelectLog) {
                            onSelectLog({ unitName: log.unitFullName, record: log.record });
                          } else {
                            setSelectedAuditLog({ unitName: log.unitFullName, record: log.record });
                          }
                        }}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      >
                        {/* 1. รอบตรวจ & สาขา */}
                        <td className="py-3.5 px-4 overflow-hidden">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-xs font-semibold text-slate-400 w-4 text-center shrink-0 font-mono">
                              {rowNumber}
                            </span>
                            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-xs shrink-0 font-mono bg-white shadow-2xs ${circleColor}`}>
                              {log.score}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-bold text-slate-900 group-hover:text-[#0F6659] transition-colors truncate" title={log.unitName}>
                                {log.unitName}
                              </div>
                              <div className="text-xs text-slate-400 font-normal truncate mt-0.5" title={log.region}>
                                {log.region}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 2. คะแนน */}
                        <td className="py-3.5 px-4 text-center overflow-hidden">
                          <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold font-mono ${scorePill}`}>
                            {log.score}%
                          </span>
                        </td>

                        {/* 3. แบบฟอร์มการตรวจ */}
                        <td className="py-3.5 px-4 overflow-hidden">
                          <div className="min-w-0">
                            <div className="text-xs sm:text-sm font-semibold text-slate-800 truncate" title={log.formName}>
                              {log.formName}
                            </div>
                            <div className="text-xs text-slate-400 font-normal truncate mt-0.5" title={log.auditType}>
                              {log.auditType}
                            </div>
                          </div>
                        </td>

                        {/* 4. วันที่ตรวจ */}
                        <td className="py-3.5 px-4 text-xs sm:text-sm font-normal text-slate-700 overflow-hidden">
                          <div className="truncate" title={log.date}>
                            {log.date}
                          </div>
                        </td>

                        {/* 5. ผู้ตรวจประเมิน */}
                        <td className="py-3.5 px-4 text-xs sm:text-sm font-normal text-slate-700 overflow-hidden">
                          <div className="truncate" title={log.auditor}>
                            {log.auditor}
                          </div>
                        </td>

                        {/* 6. สถานะ & Arrow */}
                        <td className="py-3.5 px-4 text-center overflow-hidden">
                          <div className="flex items-center justify-center gap-2">
                            <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${statusBadge}`}>
                              {statusText}
                            </span>
                            <ChevronRight size={16} className="text-slate-300 group-hover:text-[#0F6659] group-hover:translate-x-0.5 transition-all shrink-0" />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filteredAndSortedLogs.length === 0 && (
                <div className="text-center py-12 text-xs text-slate-400 font-medium bg-white">
                  ไม่พบข้อมูลผลการตรวจที่ตรงกับคำค้นหา
                </div>
              )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-3 border-t border-slate-100 text-xs font-medium text-slate-500 bg-white">
                <span>หน้า {currentPage} จาก {totalPages} ({totalCount} รายการ)</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold disabled:opacity-40 cursor-pointer transition-all active:scale-95"
                  >
                    ก่อนหน้า
                  </button>
                  
                  {/* ช่องเล็กสำหรับพิมพ์เลขหน้า (กด Enter หรือคลิกออกนอกช่องเพื่อเปลี่ยนหน้า) */}
                  <input
                    type="number"
                    min="1"
                    max={totalPages}
                    value={pageInput}
                    onChange={(e) => setPageInput(e.target.value)}
                    onBlur={handlePageSubmit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handlePageSubmit();
                        e.target.blur();
                      }
                    }}
                    className="w-10 h-7 text-center text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-xl outline-none focus:border-[#0F6659] focus:ring-1 focus:ring-[#0F6659] shadow-2xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />

                  <button
                    type="button"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold disabled:opacity-40 cursor-pointer transition-all active:scale-95 text-xs"
                  >
                    ถัดไป
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : viewType === "table" ? (
          /* ── Tab: สาขา (Branch Tab with Sorting & Pagination) ── */
          <div className="space-y-2">
            <div className="overflow-x-auto custom-tab-scrollbar">
              <table className="w-full text-left border-collapse min-w-[1000px] table-fixed">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-[#FAF9F5] text-slate-700 text-xs font-bold select-none">
                    <th className="py-3 px-4 w-[50%]">
                      <button 
                        type="button" 
                        onClick={() => setSortBy(prev => prev === 'branch-asc' ? 'branch-desc' : 'branch-asc')}
                        className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
                          sortBy.startsWith('branch') ? 'text-[#0F6659] font-black' : 'hover:text-[#0F6659]'
                        }`}
                        title="เรียงตามชื่อสาขา (ก-ฮ / ฮ-ก)"
                      >
                        <span className="truncate">อันดับ & ชื่อสาขา</span>
                        {sortBy === 'branch-asc' && <span className="text-[10px] font-black text-[#0F6659] bg-emerald-100 px-1.5 py-0.5 rounded-md shrink-0">▲ ก-ฮ</span>}
                        {sortBy === 'branch-desc' && <span className="text-[10px] font-black text-[#0F6659] bg-emerald-100 px-1.5 py-0.5 rounded-md shrink-0">▼ ฮ-ก</span>}
                        {!sortBy.startsWith('branch') && <ArrowUpDown size={13} className="text-slate-400 shrink-0" />}
                      </button>
                    </th>
                    <th className="py-3 px-4 w-[13%] text-center">
                      <button
                        type="button"
                        onClick={() => setSortBy(prev => prev === 'score-desc' ? 'score-asc' : 'score-desc')}
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full border shadow-2xs text-xs font-bold transition-all cursor-pointer ${
                          sortBy.startsWith('score')
                            ? 'bg-emerald-50 border-emerald-400 text-[#0F6659] font-black ring-2 ring-emerald-500/20'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-[#0F6659] hover:text-[#0F6659]'
                        }`}
                        title="เรียงตามคะแนน (มากไปน้อย / น้อยไปมาก)"
                      >
                        <span>คะแนน</span>
                        {sortBy === 'score-desc' && <span className="text-[10px] text-[#0F6659] font-black">▼</span>}
                        {sortBy === 'score-asc' && <span className="text-[10px] text-[#0F6659] font-black">▲</span>}
                        {!sortBy.startsWith('score') && <ArrowUpDown size={11} className="text-slate-400" />}
                      </button>
                    </th>
                    <th className="py-3 px-4 w-[20%]">
                      <span className="truncate">ภูมิภาค / ประเภท</span>
                    </th>
                    <th className="py-3 px-4 w-[13%]">
                      <button 
                        type="button" 
                        onClick={() => setSortBy(prev => prev === 'date-desc' ? 'date-asc' : 'date-desc')}
                        className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
                          sortBy.startsWith('date') ? 'text-[#0F6659] font-black' : 'hover:text-[#0F6659]'
                        }`}
                        title="เรียงตามเวลาตรวจล่าสุด (ล่าสุด / เก่าสุด)"
                      >
                        <span className="truncate">ตรวจล่าสุด</span>
                        {sortBy === 'date-desc' && <span className="text-[10px] font-black text-[#0F6659] bg-emerald-100 px-1.5 py-0.5 rounded-md shrink-0">▼</span>}
                        {sortBy === 'date-asc' && <span className="text-[10px] font-black text-[#0F6659] bg-emerald-100 px-1.5 py-0.5 rounded-md shrink-0">▲</span>}
                        {!sortBy.startsWith('date') && <ArrowUpDown size={13} className="text-slate-400 shrink-0" />}
                      </button>
                    </th>
                    <th className="py-3 px-4 w-[15%] text-center">
                      <span className="truncate">สถานะ</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {paginatedBranches.map((u, idx) => {
                    const rowNumber = (currentPage - 1) * pageSize + idx + 1;
                    const isPassed = u.lastScore >= 85;
                    const isCritical = u.lastScore < 70;

                    const circleColor = isCritical
                      ? "border-rose-600 text-rose-700"
                      : isPassed
                      ? "border-emerald-600 text-emerald-800"
                      : "border-amber-600 text-amber-800";

                    const scorePill = isCritical
                      ? "bg-rose-50 text-rose-700 border border-rose-200/60"
                      : isPassed
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                      : "bg-amber-50 text-amber-700 border border-amber-200/60";

                    const statusBadge = isCritical
                      ? "bg-rose-100 text-rose-800"
                      : isPassed
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-900";

                    const statusText = isCritical ? "วิกฤต" : isPassed ? "ผ่านเกณฑ์" : "ต้องปรับปรุง";

                    return (
                      <tr
                        key={u.id || u.name || idx}
                        onClick={() => {
                          setSelectedBranch(u);
                        }}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      >
                        {/* 1. อันดับ & สาขา */}
                        <td className="py-3.5 px-4 overflow-hidden">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-xs font-semibold text-slate-400 w-4 text-center shrink-0 font-mono">
                              {rowNumber}
                            </span>
                            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-xs shrink-0 font-mono bg-white shadow-2xs ${circleColor}`}>
                              {u.lastScore}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-bold text-slate-900 group-hover:text-[#0F6659] transition-colors truncate" title={u.name}>
                                {u.name}
                              </div>
                              <div className="text-xs text-slate-400 font-normal truncate mt-0.5" title={u.fullName || u.region}>
                                {u.fullName || u.region}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 2. คะแนน */}
                        <td className="py-3.5 px-4 text-center overflow-hidden">
                          <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold font-mono ${scorePill}`}>
                            {u.lastScore}%
                          </span>
                        </td>

                        {/* 3. ภูมิภาค */}
                        <td className="py-3.5 px-4 overflow-hidden">
                          <div className="min-w-0">
                            <div className="text-xs sm:text-sm font-semibold text-slate-800 truncate" title={u.region}>
                              {u.region}
                            </div>
                            <div className="text-xs text-slate-400 font-normal truncate mt-0.5" title={u.locationType}>
                              {u.locationType}
                            </div>
                          </div>
                        </td>

                        {/* 4. ตรวจล่าสุด */}
                        <td className="py-3.5 px-4 text-xs sm:text-sm font-normal text-slate-700 overflow-hidden">
                          <div className="truncate" title={u.dateFormatted}>
                            {u.dateFormatted}
                          </div>
                        </td>

                        {/* 5. สถานะ & Arrow */}
                        <td className="py-3.5 px-4 text-center overflow-hidden">
                          <div className="flex items-center justify-center gap-2">
                            <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${statusBadge}`}>
                              {statusText}
                            </span>
                            <ChevronRight size={16} className="text-slate-300 group-hover:text-[#0F6659] group-hover:translate-x-0.5 transition-all shrink-0" />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filteredAndSortedBranches.length === 0 && (
                <div className="text-center py-12 text-xs text-slate-400 font-medium bg-white">
                  ไม่พบข้อมูลสาขาที่ตรงกับคำค้นหา
                </div>
              )}
            </div>

            {/* Pagination Controls for Branch Tab */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-3 border-t border-slate-100 text-xs font-medium text-slate-500 bg-white">
                <span>หน้า {currentPage} จาก {totalPages} ({totalCount} สาขา)</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold disabled:opacity-40 cursor-pointer transition-all active:scale-95"
                  >
                    ก่อนหน้า
                  </button>
                  
                  <input
                    type="number"
                    min="1"
                    max={totalPages}
                    value={pageInput}
                    onChange={(e) => setPageInput(e.target.value)}
                    onBlur={handlePageSubmit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handlePageSubmit();
                        e.target.blur();
                      }
                    }}
                    className="w-10 h-7 text-center text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-xl outline-none focus:border-[#0F6659] focus:ring-1 focus:ring-[#0F6659] shadow-2xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />

                  <button
                    type="button"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold disabled:opacity-40 cursor-pointer transition-all active:scale-95 text-xs"
                  >
                    ถัดไป
                  </button>
                </div>
              </div>
            )}
          </div>

        ) : (
          /* ── Tab: กราฟ (Charts) ── */
          <div className="p-4 space-y-4">
            <div className="text-xs font-bold text-slate-700">แนวโน้มคะแนนเฉลี่ยย้อนหลัง 6 เดือน</div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendsData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="scoreGradReport" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0F6659" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#0F6659" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis domain={['dataMin - 4', 100]} tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }} 
                    formatter={(val) => [`${val}%`, 'คะแนนเฉลี่ย']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="score" 
                    stroke="#0F6659" 
                    strokeWidth={3} 
                    dot={{ r: 4, fill: '#0F6659' }}
                    activeDot={{ r: 6 }}
                    fillOpacity={1} 
                    fill="url(#scoreGradReport)" 
                    name="คะแนนเฉลี่ย" 
                  />
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
