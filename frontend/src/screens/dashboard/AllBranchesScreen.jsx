import React, { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  LayoutDashboard, CalendarDays, List, ClipboardList, ClipboardCheck,
  Scale, Store, MapPin, ChevronLeft, ChevronRight, Camera, Bell,
  CheckCircle2, XCircle, Banknote, Users, Settings, MoreHorizontal,
  Navigation, Phone, PenTool, Check, FileText, Copy, Plus, ShieldCheck,
  MessageSquare, ImagePlus, Send, Clock, Trash2, GripVertical, Edit3,
  Megaphone, Eye, EyeOff, Zap, X, ChevronDown, ChevronUp, History as HistoryIcon,
  Maximize2, Minimize2, CheckCheck, RefreshCw, Key, ShieldAlert,
  Laptop, Smartphone, Search, Filter, ArrowUpRight, ExternalLink,
  Award, TrendingUp, AlertTriangle, Sparkles, SlidersHorizontal,
  BarChart3, CheckSquare, Layers, UserCheck, Download, FileSpreadsheet,
  Wrench, Square, Minus, Building2, ArrowUpDown, History, Shield, Info, HelpCircle
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, BarChart, Bar, ReferenceLine, LineChart, Line, Legend, Cell, PieChart, Pie
} from "recharts";

import { c, sans, mono, cardStyle } from "../../config/theme";
import { ROLES, NAV_BY_ROLE } from "../../config/roles";
import { TODAY, AUDIT_TYPES, AUDIT_TYPE_META, CAP_STATUS_MAP, REGION_LINES, BRAND_LINES } from "../../config/constants";
import { TopBarContext } from "../../context/TopBarContext";
import { DataContext } from "../../context/DataContext";
import { exportToExcel } from "../../utils/exportToExcel";

import ModalWrapper from "../../shared/ModalWrapper";
import Header from "../../shared/Header";
import Section from "../../shared/Section";
import ScoreRing from "../../shared/ScoreRing";
import HistoryList from "../../shared/HistoryList";
import ErrorBoundary from "../../shared/ErrorBoundary";
import ExcelExportModal from "../../modals/ExcelExportModal";

export default function AllBranchesScreen({ onBack, onSelectUnit, onExportExcel }) {
  const { locations } = React.useContext(DataContext);
  const activeLocations = locations || [];
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [sortBy, setSortBy] = useState("score-desc"); // 'score-desc' | 'score-asc' | 'name' | 'date'
  const [currentPage, setCurrentPage] = useState(1);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showScoreFilter, setShowScoreFilter] = useState(false);
  const pageSize = 10;

  // Reset page to 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterCategory, sortBy]);

  const filteredAndSorted = useMemo(() => {
    let list = [...activeLocations];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(u =>
        u.name.toLowerCase().includes(q) ||
        (u.fullName && u.fullName.toLowerCase().includes(q)) ||
        u.region.toLowerCase().includes(q) ||
        (u.history && u.history[0]?.auditor?.toLowerCase().includes(q))
      );
    }

    if (filterCategory === "passed") {
      list = list.filter(u => u.lastScore >= 85);
    } else if (filterCategory === "improve") {
      list = list.filter(u => u.lastScore >= 70 && u.lastScore < 85);
    } else if (filterCategory === "critical") {
      list = list.filter(u => u.lastScore < 70);
    } else if (filterCategory === "bkk") {
      list = list.filter(u => u.region.includes("กรุงเทพ"));
    } else if (filterCategory === "upcountry") {
      list = list.filter(u => !u.region.includes("กรุงเทพ"));
    }

    const parseDistance = (d) => {
      if (!d) return 99999;
      const num = parseFloat(String(d).replace(/[^0-9.]/g, ''));
      return isNaN(num) ? 99999 : num;
    };

    if (sortBy === "distance") {
      list.sort((a, b) => parseDistance(a.distance) - parseDistance(b.distance));
    } else if (sortBy === "score-desc") {
      list.sort((a, b) => b.lastScore - a.lastScore);
    } else if (sortBy === "score-asc") {
      list.sort((a, b) => a.lastScore - b.lastScore);
    } else if (sortBy === "name") {
      list.sort((a, b) => a.name.localeCompare(b.name, "th"));
    } else if (sortBy === "date") {
      list.sort((a, b) => (b.history?.[0]?.date || "").localeCompare(a.history?.[0]?.date || ""));
    }

    return list;
  }, [searchTerm, filterCategory, sortBy]);

  const totalCount = filteredAndSorted.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedUnits = filteredAndSorted.slice(startIndex, startIndex + pageSize);
  const startItem = totalCount === 0 ? 0 : startIndex + 1;
  const endItem = Math.min(startIndex + pageSize, totalCount);

  const passedCount = activeLocations.filter(u => u.lastScore >= 85).length;
  const improveCount = activeLocations.filter(u => u.lastScore >= 70 && u.lastScore < 85).length;
  const criticalCount = activeLocations.filter(u => u.lastScore < 70).length;

  return (
    <div className="page-transition p-4 sm:p-6 space-y-4 w-full max-w-[100%] sm:max-w-[96%] md:max-w-[92%] mx-auto pb-12">
      <Header
        title="ตารางคะแนนและสถานะทุกสาขา"
        subtitle={`ข้อมูลทั้งหมด ${activeLocations.length} สาขาทั่วประเทศ`}
        onBack={onBack}
      />

      {/* 🌟 1. PREMIUM INTERACTIVE SUMMARY KPI CARDS (คลิกการ์ดเพื่อกรองตารางได้ทันที) */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
        {/* Card 1: ผ่านเกณฑ์ */}
        <button
          type="button"
          onClick={() => setFilterCategory(filterCategory === "passed" ? "all" : "passed")}
          className={`rounded-2xl sm:rounded-3xl p-3 sm:p-4.5 bg-gradient-to-b from-emerald-50/80 via-white to-white border shadow-2xs hover:shadow-xs transition-all text-left flex flex-col justify-between gap-2 cursor-pointer active:scale-98 ${
            filterCategory === "passed"
              ? "border-[#0F6659] ring-2 ring-emerald-500/40 shadow-sm"
              : "border-emerald-200/80 hover:border-emerald-400"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11.5px] sm:text-xs font-extrabold text-emerald-950 truncate">ผ่านเกณฑ์ (≥85%)</span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-emerald-100 text-[#0F6659] flex items-center justify-center shrink-0">
              <CheckCircle2 size={15} strokeWidth={2.5} />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-none" style={{ fontFamily: mono }}>
              {passedCount} <span className="text-xs font-bold text-slate-400">สาขา</span>
            </div>
            <div className="mt-1.5">
              <span className="text-[10px] sm:text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.5 rounded-md">
                คิดเป็น {Math.round((passedCount / activeLocations.length) * 100)}%
              </span>
            </div>
          </div>
        </button>

        {/* Card 2: ต้องปรับปรุง */}
        <button
          type="button"
          onClick={() => setFilterCategory(filterCategory === "improve" ? "all" : "improve")}
          className={`rounded-2xl sm:rounded-3xl p-3 sm:p-4.5 bg-gradient-to-b from-amber-50/80 via-white to-white border shadow-2xs hover:shadow-xs transition-all text-left flex flex-col justify-between gap-2 cursor-pointer active:scale-98 ${
            filterCategory === "improve"
              ? "border-amber-600 ring-2 ring-amber-400/50 shadow-sm"
              : "border-amber-200/80 hover:border-amber-400"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11.5px] sm:text-xs font-extrabold text-amber-950 truncate">ต้องปรับปรุง (70-84%)</span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <Wrench size={15} strokeWidth={2.5} />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-900 leading-none" style={{ fontFamily: mono }}>
              {improveCount} <span className="text-xs font-bold text-slate-400">สาขา</span>
            </div>
            <div className="mt-1.5">
              <span className="text-[10px] sm:text-[11px] font-bold text-amber-900 bg-amber-50 border border-amber-200/60 px-1.5 py-0.5 rounded-md">
                มีงานแก้ไข CAP
              </span>
            </div>
          </div>
        </button>

        {/* Card 3: วิกฤต */}
        <button
          type="button"
          onClick={() => setFilterCategory(filterCategory === "critical" ? "all" : "critical")}
          className={`rounded-2xl sm:rounded-3xl p-3 sm:p-4.5 bg-gradient-to-b from-rose-50/80 via-white to-white border shadow-2xs hover:shadow-xs transition-all text-left flex flex-col justify-between gap-2 cursor-pointer active:scale-98 ${
            filterCategory === "critical"
              ? "border-rose-600 ring-2 ring-rose-400/50 shadow-sm"
              : "border-rose-200/80 hover:border-rose-400"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11.5px] sm:text-xs font-extrabold text-rose-950 truncate">วิกฤต (&lt;70%)</span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
              <AlertTriangle size={15} strokeWidth={2.5} />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-rose-800 leading-none" style={{ fontFamily: mono }}>
              {criticalCount} <span className="text-xs font-bold text-slate-400">สาขา</span>
            </div>
            <div className="mt-1.5">
              <span className="text-[10px] sm:text-[11px] font-bold text-rose-800 bg-rose-50 border border-rose-200/60 px-1.5 py-0.5 rounded-md">
                ต้องเข้าตรวจซ้ำ
              </span>
            </div>
          </div>
        </button>
      </div>

      {/* 🌟 2. Search & Excel Export Row (ปุ่ม Excel อยู่แถวเดียวกับค้นหา) */}
      <div className="flex items-center gap-2.5 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาชื่อสาขา, ภูมิภาค หรือชื่อผู้ตรวจ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs sm:text-sm pl-10 pr-9 py-2.5 rounded-xl bg-slate-50 border border-slate-200 outline-none font-semibold text-slate-800 focus:border-[#0F6659] transition-colors"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer">
              <X size={14} />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            if (onExportExcel) onExportExcel();
            setShowExportModal(true);
          }}
          className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2.5 rounded-xl bg-white border border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/60 text-xs font-extrabold text-slate-800 hover:text-[#0F6659] cursor-pointer shadow-2xs transition-all active:scale-95 shrink-0"
          title="ส่งออกรายงานเป็นไฟล์ Excel"
        >
          <Download size={15} className="text-[#0F6659]" />
          <span>Excel</span>
        </button>
      </div>

      {/* Active Filter Indicator Tag (if filtered) */}
      {filterCategory !== "all" && (
        <div className="flex items-center gap-2 animate-in fade-in">
          <span className="text-xs font-bold text-slate-500">ตัวกรองที่ใช้งาน:</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100 text-[#0F6659] text-xs font-extrabold border border-emerald-300 shadow-2xs">
            {filterCategory === "passed" && "✓ ผ่านเกณฑ์ (≥85%)"}
            {filterCategory === "improve" && "⚠️ ต้องปรับปรุง (70-84%)"}
            {filterCategory === "critical" && "🚨 วิกฤต (<70%)"}
            {filterCategory === "bkk" && "📍 กรุงเทพฯ และปริมณฑล"}
            {filterCategory === "upcountry" && "📍 ต่างจังหวัด"}
            <button type="button" onClick={() => setFilterCategory("all")} className="hover:text-red-700 cursor-pointer">
              <X size={13} />
            </button>
          </span>
          <button type="button" onClick={() => setFilterCategory("all")} className="text-xs font-bold text-slate-400 hover:text-slate-700 underline cursor-pointer">
            ล้างตัวกรอง
          </button>
        </div>
      )}

      {/* 🌟 4. Mobile-Friendly Horizontal Scroll Table */}
      <div className="rounded-3xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto custom-tab-scrollbar">
          <table className="w-full min-w-[780px] text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/80 bg-[#FAF9F5] text-slate-700 text-xs font-bold select-none">
                <th className="py-3 px-4 w-[28%]">
                  <button 
                    type="button" 
                    onClick={() => setSortBy(prev => prev === 'name' ? 'score-desc' : 'name')}
                    className="flex items-center gap-1.5 hover:text-[#0F6659] transition-colors cursor-pointer"
                  >
                    <span>อันดับ & ชื่อสาขา</span>
                    <ArrowUpDown size={13} className="text-slate-400" />
                  </button>
                </th>
                <th className="py-3 px-4 w-[12%] text-center">
                  <button
                    type="button"
                    onClick={() => setSortBy(prev => prev === 'score-desc' ? 'score-asc' : 'score-desc')}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white border border-slate-200 shadow-2xs hover:border-[#0F6659] text-xs font-bold text-slate-700 hover:text-[#0F6659] transition-all cursor-pointer"
                  >
                    <span>คะแนน</span>
                    <span className="text-[10px] text-slate-400">▽</span>
                  </button>
                </th>
                <th className="py-3 px-4 w-[20%]">ภูมิภาค / ประเภท</th>
                <th className="py-3 px-4 w-[16%]">
                  <button 
                    type="button" 
                    onClick={() => setSortBy(prev => prev === 'date' ? 'score-desc' : 'date')}
                    className="flex items-center gap-1 hover:text-[#0F6659] transition-colors cursor-pointer"
                  >
                    <span>ตรวจล่าสุด</span>
                    <ArrowUpDown size={13} className="text-[#0F6659]" />
                  </button>
                </th>
                <th className="py-3 px-4 w-[12%]">ผู้ตรวจประเมิน</th>
                <th className="py-3 px-4 w-[12%] text-center pr-6">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {paginatedUnits.map((u, idx) => {
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
                const overallIdx = startIndex + idx + 1;

                return (
                  <tr
                    key={u.name || idx}
                    onClick={() => onSelectUnit(u)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                  >
                    {/* 1. อันดับ & ชื่อสาขา */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-slate-400 w-4 text-center shrink-0 font-mono">
                          {overallIdx}
                        </span>
                        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-xs shrink-0 font-mono bg-white shadow-2xs ${circleColor}`}>
                          {u.lastScore}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-900 group-hover:text-[#0F6659] transition-colors truncate">
                            {u.name}
                          </div>
                          <div className="text-xs text-slate-400 font-normal truncate mt-0.5">
                            {u.fullName || u.region}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* 2. คะแนน */}
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold font-mono ${scorePill}`}>
                        {u.lastScore}%
                      </span>
                    </td>

                    {/* 3. ภูมิภาค */}
                    <td className="py-3.5 px-4">
                      <div className="text-xs sm:text-sm font-semibold text-slate-800 truncate">
                        {u.region}
                      </div>
                      <div className="text-xs text-slate-400 font-normal truncate mt-0.5">
                        {u.locationType?.name || (typeof u.locationType === 'string' ? u.locationType : null) || u.type || "-"}
                      </div>
                    </td>

                    {/* 4. วันที่ตรวจล่าสุด */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-xs sm:text-sm font-normal text-slate-700">
                      {u.history && u.history[0]?.date ? u.history[0].date : (u.lastAuditDate ? new Date(u.lastAuditDate).toLocaleDateString('th-TH') : "-")}
                    </td>

                    {/* 5. ผู้ตรวจประเมิน */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-xs sm:text-sm font-normal text-slate-700">
                      {u.history && u.history[0]?.auditor ? u.history[0].auditor : (u.auditorName || "-")}
                    </td>

                    {/* 6. สถานะ & Arrow */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-center pr-5">
                      <div className="flex items-center justify-end gap-3">
                        <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold ${statusBadge}`}>
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

          {paginatedUnits.length === 0 && (
            <div className="text-center py-12 text-xs text-slate-400 font-medium bg-white">
              ไม่พบข้อมูลสาขาที่ตรงกับคำค้นหา
            </div>
          )}
        </div>

        {/* 🌟 5. Pagination & Summary Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3.5 border-t text-xs font-medium text-slate-600 bg-[#FAF9F5]" style={{ borderColor: c.border }}>
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">
              แสดง {startItem} - {endItem}
            </span>
            <span>จากทั้งหมด {totalCount} สาขา</span>
            <span className="text-slate-400 hidden sm:inline">•</span>
            <span className="text-slate-500 hidden sm:inline">หน้า {currentPage} จาก {totalPages}</span>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1 transition-all ${
                  currentPage === 1
                    ? 'text-slate-300 bg-slate-100 cursor-not-allowed'
                    : 'text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 active:scale-95 cursor-pointer shadow-2xs'
                }`}
              >
                <ChevronLeft size={14} />
                <span>ก่อนหน้า</span>
              </button>

              {/* Page Number Buttons */}
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-8 h-8 rounded-xl font-bold text-xs flex items-center justify-center transition-all cursor-pointer ${
                    currentPage === pageNum
                      ? 'bg-[#0F6659] text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {pageNum}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1 transition-all ${
                  currentPage === totalPages
                    ? 'text-slate-300 bg-slate-100 cursor-not-allowed'
                    : 'text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 active:scale-95 cursor-pointer shadow-2xs'
                }`}
              >
                <span>ถัดไป</span>
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>

        {filteredAndSorted.length === 0 && (
          <div className="text-center text-sm py-12 text-slate-400 font-medium">
            ไม่พบสาขาที่ตรงกับคำค้นหาหรือตัวกรอง
          </div>
        )}
      </div>

      {showExportModal && (
        <ExcelExportModal onClose={() => setShowExportModal(false)} />
      )}
    </div>
  );
}
