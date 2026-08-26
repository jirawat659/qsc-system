import { KPI_DATA } from "../../mocks/dashboard";
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
import { ROLES, NAV_BY_ROLE, ROLE_USER_MAP } from "../../config/roles";
import { TODAY, AUDIT_TYPES, AUDIT_TYPE_META, CAP_STATUS_MAP, REGION_LINES, BRAND_LINES } from "../../config/constants";
import { TopBarContext } from "../../context/TopBarContext";
import { DataContext } from "../../context/DataContext";
import { INITIAL_UNITS, LOCATIONS } from "../../mocks/locations";
import { INITIAL_SCHEDULE } from "../../mocks/schedule";
import { INITIAL_FORM_SECTIONS, INITIAL_FORMS_LIST } from "../../mocks/forms";
import { AUDITORS_DATA, AUDITORS_LIST } from "../../mocks/auditors";
import { INITIAL_NOTIFICATIONS } from "../../mocks/notifications";
import { INITIAL_CAP_LIST } from "../../mocks/cap";
import { TRENDS_DATA, TRENDS_BY_REGION, TRENDS_BY_BRAND } from "../../mocks/trends";
import { AI_INSIGHTS } from "../../mocks/aiInsights";
import { MOCK_USERS, ORG_TREE, ROLE_PERMISSIONS_LIST, API_INTEGRATIONS } from "../../mocks/admin";
import { exportToExcel } from "../../utils/exportToExcel";

import ModalWrapper from "../../shared/ModalWrapper";
import Header from "../../shared/Header";
import Section from "../../shared/Section";
import ScoreRing from "../../shared/ScoreRing";
import HistoryList from "../../shared/HistoryList";
import ErrorBoundary from "../../shared/ErrorBoundary";
import ExcelExportModal from "../../modals/ExcelExportModal";
import MonthlyMeetingReportModal from "../../modals/MonthlyMeetingReportModal";
import BranchProfile from "./BranchProfile";
import AllBranchesScreen from "./AllBranchesScreen";
import AllAuditHistoryScreen from "./AllAuditHistoryScreen";
import AuditHistoryDetail from "../audit/AuditHistoryDetail";


export default function DashboardScreen({ role, isDesktop }) {
  const { locations, auditRecords, capTasks } = React.useContext(DataContext);
  const activeLocations = useMemo(() => {
    return (locations && locations.length > 0) ? locations : INITIAL_UNITS;
  }, [locations]);

  // 🌟 Dynamic Real-time Calculations from Database
  const totalBranches = activeLocations.length || 5;
  const auditedCount = (auditRecords && auditRecords.length > 0) ? auditRecords.length : 1;
  const passedBranches = activeLocations.filter(u => u.lastScore >= 85);
  const passedCount = passedBranches.length;
  const passRate = totalBranches > 0 ? Math.round((passedCount / totalBranches) * 100) : 80;
  const avgScore = totalBranches > 0 ? Math.round(activeLocations.reduce((acc, l) => acc + (l.lastScore || 0), 0) / totalBranches) : 88;
  const pendingCapCount = (capTasks && capTasks.length > 0) 
    ? capTasks.filter(c => c.status !== 'approved').length 
    : 1;
  const scoped = role === "AUDITEE";
  const [periodFilter, setPeriodFilter] = useState("month"); // 'month' | 'last_month' | '3m' | '6m' | 'ytd'

  // 🌟 Dynamic Current Thai Month & Year labels
  const { currentMonthLabel, lastMonthLabel, currentYearLabel, currentMonthFullLabel } = useMemo(() => {
    const now = new Date();
    const THAI_MONTHS_SHORT = [
      "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
      "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
    ];
    const THAI_MONTHS_FULL = [
      "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
      "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
    ];
    const thaiYear = now.getFullYear() + 543;
    const curMonth = `${THAI_MONTHS_SHORT[now.getMonth()]} ${thaiYear}`;
    const curMonthFull = `${THAI_MONTHS_FULL[now.getMonth()]} ${thaiYear}`;

    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthThaiYear = lastMonthDate.getFullYear() + 543;
    const prevMonth = `${THAI_MONTHS_SHORT[lastMonthDate.getMonth()]} ${lastMonthThaiYear}`;

    return {
      currentMonthLabel: curMonth,
      currentMonthFullLabel: curMonthFull,
      lastMonthLabel: prevMonth,
      currentYearLabel: `ทั้งปี (YTD ${thaiYear})`
    };
  }, []);
  const [viewType, setViewType] = useState("history"); // 'table' | 'history' | 'chart'
  const [rankMode, setRankMode] = useState("top5"); // 'top5' | 'bottom5'
  const [leaderboardFilter, setLeaderboardFilter] = useState("all"); // 'all' | 'top5' | 'risk' | 'bkk' | 'north' | 'east'
  const [showAllBranches, setShowAllBranches] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [graphTimeRange, setGraphTimeRange] = useState("6M"); // '1M' | '3M' | '6M' | '1Y'
  const [chartGroupBy, setChartGroupBy] = useState("region"); // 'region' | 'brand'
  const [viewUnit, setViewUnit] = useState(null);
  const [selectedAuditLog, setSelectedAuditLog] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showMonthlyModal, setShowMonthlyModal] = useState(false);

  const rankedBranches = useMemo(() => {
    return [...activeLocations]
      .sort((a, b) => (rankMode === "top5" ? b.lastScore - a.lastScore : a.lastScore - b.lastScore))
      .slice(0, 5);
  }, [rankMode, activeLocations]);

  // ALL HOOKS DECLARED FIRST BEFORE ANY EARLY RETURNS
  const filteredBranches = useMemo(() => {
    let list = [...activeLocations];
    if (leaderboardFilter === "under85") {
      list = list.filter(u => u.lastScore < 85).sort((a, b) => a.lastScore - b.lastScore);
    } else if (leaderboardFilter === "over90") {
      list = list.filter(u => u.lastScore >= 90).sort((a, b) => b.lastScore - a.lastScore);
    } else if (leaderboardFilter === "bkk") {
      list = list.filter(u => u.region.includes("กรุงเทพ"));
    } else if (leaderboardFilter === "north") {
      list = list.filter(u => u.region.includes("เหนือ"));
    } else if (leaderboardFilter === "east") {
      list = list.filter(u => u.region.includes("ตะวันออก") && !u.region.includes("เฉียงเหนือ"));
    } else if (leaderboardFilter === "northeast") {
      list = list.filter(u => u.region.includes("ตะวันออกเฉียงเหนือ") || u.region.includes("อีสาน"));
    } else if (leaderboardFilter === "south") {
      list = list.filter(u => u.region.includes("ใต้"));
    } else {
      list = list.sort((a, b) => a.lastScore - b.lastScore);
    }
    return list;
  }, [leaderboardFilter, activeLocations]);

  const allAuditLogs = useMemo(() => {
    let logs = [];
    if (auditRecords && auditRecords.length > 0) {
      logs = auditRecords.map(r => {
        const branchName = r.locationName || r.location?.name || "สาขา";
        const branchFullName = r.locationName || r.location?.fullName || r.location?.name || "สาขา";
        const dateFormatted = r.auditDate ? new Date(r.auditDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) : "วันนี้";
        const scoreVal = Math.round(r.percentageScore !== undefined ? r.percentageScore : (r.score || 0));
        const auditorVal = r.auditorName || r.primaryAuditor?.fullName || r.auditor || "สมชาย ใจดี";
        const formVal = r.surveyFormTitle || r.surveyForm?.title || r.form || "แบบฟอร์มมาตรฐาน 5 ดาว (QSC Core)";

        return {
          unitName: branchName,
          unitFullName: branchFullName,
          region: r.locationRegion || r.location?.region || "กรุงเทพฯ และปริมณฑล",
          date: dateFormatted,
          score: scoreVal,
          auditor: auditorVal,
          form: formVal,
          status: r.isPassed ? "pass" : "fail",
          record: {
            ...r,
            unitName: branchName,
            unitFullName: branchFullName,
            score: scoreVal,
            percentageScore: scoreVal,
            date: dateFormatted,
            auditDate: r.auditDate,
            auditor: auditorVal,
            auditorName: auditorVal,
            form: formVal,
            surveyFormTitle: formVal,
            status: r.isPassed ? "pass" : "fail",
            isPassed: r.isPassed,
            hasCriticalDefect: r.hasCriticalDefect
          }
        };
      });
    } else {
      activeLocations.forEach(u => {
        (u.history || []).forEach(h => {
          logs.push({
            unitName: u.name,
            unitFullName: u.fullName || u.name,
            region: u.region,
            date: h.date,
            score: h.score,
            auditor: h.auditor || "สมชาย ใจดี",
            status: h.status,
            record: h
          });
        });
      });
    }

    if (leaderboardFilter === "under85") {
      return logs.filter(l => l.score < 85);
    } else if (leaderboardFilter === "over90") {
      return logs.filter(l => l.score >= 90).sort((a, b) => b.score - a.score);
    } else if (leaderboardFilter === "bkk") {
      return logs.filter(l => (l.region || '').includes("กรุงเทพ"));
    } else if (leaderboardFilter === "north") {
      return logs.filter(l => (l.region || '').includes("เหนือ"));
    } else if (leaderboardFilter === "east") {
      return logs.filter(l => (l.region || '').includes("ตะวันออก") && !(l.region || '').includes("เฉียงเหนือ"));
    } else if (leaderboardFilter === "northeast") {
      return logs.filter(l => (l.region || '').includes("ตะวันออกเฉียงเหนือ") || (l.region || '').includes("อีสาน"));
    } else if (leaderboardFilter === "south") {
      return logs.filter(l => (l.region || '').includes("ใต้"));
    }
    return logs;
  }, [auditRecords, activeLocations, leaderboardFilter]);

  // SAFE EARLY RETURNS
  if (selectedAuditLog) {
    return <AuditHistoryDetail unitName={selectedAuditLog.unitName} record={selectedAuditLog.record} onBack={() => setSelectedAuditLog(null)} />;
  }

  if (viewUnit) return <BranchProfile unit={viewUnit} onBack={() => setViewUnit(null)} />;

  if (showAllBranches) {
    return (
      <AllBranchesScreen
        onBack={() => setShowAllBranches(false)}
        onSelectUnit={(u) => setViewUnit(u)}
        onExportExcel={() => setShowExportModal(true)}
      />
    );
  }

  if (showAllHistory) {
    return (
      <AllAuditHistoryScreen
        onBack={() => setShowAllHistory(false)}
        onSelectLog={(log) => setSelectedAuditLog(log)}
        onExportExcel={() => setShowExportModal(true)}
      />
    );
  }

  // 🌟 Unified Dashboard for all roles



  const kpiData = KPI_DATA[periodFilter] || KPI_DATA.month;

  const currentTrends = TRENDS_DATA[graphTimeRange] || TRENDS_DATA["6M"];
  const comparisonData = chartGroupBy === "region" ? TRENDS_BY_REGION : TRENDS_BY_BRAND;
  const comparisonLines = chartGroupBy === "region" ? REGION_LINES : BRAND_LINES;

  return (
    <div className="page-transition p-4 sm:p-6 space-y-5 w-full max-w-[100%] sm:max-w-[96%] md:max-w-[92%] mx-auto">

      {/* ── 🌟 UNIFIED EXECUTIVE OVERVIEW (DESKTOP: SINGLE CARD WITH SCORE RING | MOBILE: 2 HORIZONTAL STACKED CARDS) ── */}
      
      {/* 🖥️ DESKTOP VIEW: Unified Panoramic Card with Score Ring on Left & 3 Metric Columns */}
      <div className="hidden md:block bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-4">
        {/* Top Header Row */}
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-bold text-slate-800">
              {periodFilter === "month" ? `ภาพรวมคุณภาพ (${currentMonthLabel})` : periodFilter === "last_month" ? `ภาพรวมคุณภาพ (${lastMonthLabel})` : periodFilter === "ytd" ? "ภาพรวมคุณภาพทั้งปี" : "ภาพรวมคุณภาพตามช่วงเวลา"}
            </h2>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              {passRate >= 80 ? "✓ มาตรฐานดีเยี่ยม" : "⚠️ ต้องปรับปรุง"}
            </span>
          </div>

          <div className="relative flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 cursor-pointer transition-colors shadow-2xs group">
            <CalendarDays size={14} className="text-[#0F6659] shrink-0" />
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
              className="bg-transparent text-xs font-semibold outline-none cursor-pointer text-slate-700 appearance-none pr-5"
            >
              <option value="month">เดือนนี้ ({currentMonthLabel})</option>
              <option value="last_month">เดือนก่อน ({lastMonthLabel})</option>
              <option value="3m">ย้อนหลัง 3 เดือน</option>
              <option value="6m">ย้อนหลัง 6 เดือน</option>
              <option value="ytd">{currentYearLabel}</option>
            </select>
            <ChevronDown size={13} className="text-slate-400 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 group-hover:text-slate-600 transition-colors" />
          </div>
        </div>

        {/* Content Row: Large Hero Score Ring Left + 3 Stat Columns Right */}
        <div className="grid grid-cols-12 gap-6 items-center py-1">
          {/* 🌟 Left: Enlarged Hero Score Ring & Prominent Typography */}
          <div className="col-span-5 flex items-center gap-4 pr-5 border-r border-slate-200/80">
            <ScoreRing score={avgScore} size={86} strokeWidth={6} />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="text-xs sm:text-sm font-semibold text-slate-500">
                คะแนนเฉลี่ยภาพรวม
              </div>
              <div className="text-3xl sm:text-4xl font-bold text-slate-900 leading-none tracking-tight" style={{ fontFamily: mono }}>
                {avgScore}%
              </div>
              <div>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0F6659] bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-lg shadow-2xs">
                  <CheckCircle2 size={13} className="text-[#0F6659]" />
                  <span>{avgScore >= 85 ? "ผ่านเกณฑ์มาตรฐาน (≥85%)" : "ต้องปรับปรุง (เกณฑ์ ≥85%)"}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Right: 3 Metric Columns with Hairline Dividers */}
          <div className="col-span-7 grid grid-cols-3 divide-x divide-slate-100">
            {/* Stat 1: ตรวจแล้ว */}
            <div className="px-3 text-center flex flex-col justify-between gap-1.5">
              <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-600">
                <ClipboardCheck size={15} className="text-emerald-700 shrink-0" />
                <span>สาขาที่ตรวจแล้ว</span>
              </div>
              <div className="text-2xl lg:text-3xl font-bold text-slate-900 leading-tight" style={{ fontFamily: mono }}>
                {auditedCount} <span className="text-xs font-normal text-slate-400">/ {totalBranches}</span>
              </div>
              <div>
                <span className="inline-block text-[11px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-md">
                  คิดเป็น {Math.round((auditedCount / totalBranches) * 100)}%
                </span>
              </div>
            </div>

            {/* Stat 2: ผ่านเกณฑ์ */}
            <div className="px-3 text-center flex flex-col justify-between gap-1.5">
              <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-600">
                <Award size={15} className="text-amber-700 shrink-0" />
                <span>อัตราผ่านเกณฑ์</span>
              </div>
              <div className="text-2xl lg:text-3xl font-bold text-slate-900 leading-tight" style={{ fontFamily: mono }}>
                {passRate}%
              </div>
              <div>
                <span className="inline-block text-[11px] font-medium text-amber-900 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-md">
                  {passedCount} จาก {totalBranches} สาขา
                </span>
              </div>
            </div>

            {/* Stat 3: งานค้าง CAP */}
            <div className="px-3 text-center flex flex-col justify-between gap-1.5">
              <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-600">
                <AlertTriangle size={15} className="text-rose-600 shrink-0" />
                <span>งานค้างส่ง CAP</span>
              </div>
              <div className="text-2xl lg:text-3xl font-bold text-rose-700 leading-tight" style={{ fontFamily: mono }}>
                {pendingCapCount} <span className="text-xs font-normal text-slate-400">งาน</span>
              </div>
              <div>
                <span className="inline-block text-[11px] font-medium text-rose-800 bg-rose-50 border border-rose-200/60 px-2 py-0.5 rounded-md">
                  รออนุมัติหลักฐาน
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 📱 MOBILE VIEW: 2 Stacked Horizontal Cards */}
      <div className="block md:hidden space-y-2.5">
        {/* Mobile Header */}
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-bold text-slate-800">
            {periodFilter === "month" ? `ภาพรวมคุณภาพ (${currentMonthLabel})` : periodFilter === "last_month" ? `ภาพรวมคุณภาพ (${lastMonthLabel})` : periodFilter === "ytd" ? "ภาพรวมคุณภาพทั้งปี" : "ภาพรวมคุณภาพตามช่วงเวลา"}
          </h2>
          <div className="relative flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-slate-200 shadow-2xs hover:border-[#0F6659] transition-colors cursor-pointer group">
            <CalendarDays size={12} className="text-[#0F6659] shrink-0" />
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
              className="bg-transparent text-[11px] font-semibold text-slate-700 outline-none cursor-pointer appearance-none pr-4.5"
            >
              <option value="month">{currentMonthLabel} (เดือนนี้)</option>
              <option value="last_month">{lastMonthLabel} (เดือนก่อน)</option>
              <option value="3m">ย้อนหลัง 3 เดือน</option>
              <option value="6m">ย้อนหลัง 6 เดือน</option>
              <option value="ytd">{currentYearLabel}</option>
            </select>
            <ChevronDown size={11} className="text-slate-400 pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 group-hover:text-slate-600 transition-colors" />
          </div>
        </div>

        {/* 📱 Card 1 (บน): วงแหวนคะแนนซ้าย + ข้อความสรุปขวา */}
        <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200 shadow-2xs flex items-center gap-3.5">
          <ScoreRing score={avgScore} size={48} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-normal text-slate-500">คะแนนเฉลี่ยภาพรวม</span>
              <span className="text-xs font-bold text-slate-900" style={{ fontFamily: mono }}>{avgScore}%</span>
            </div>
            <div className="text-xs font-medium text-emerald-800 mt-0.5 truncate">
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
              <div className="text-[11px] font-normal text-slate-500">ตรวจแล้ว</div>
              <div className="text-xs sm:text-sm font-bold text-slate-900 mt-0.5" style={{ fontFamily: mono }}>
                {auditedCount} / {totalBranches} สาขา
              </div>
            </div>
            <div>
              <div className="text-[11px] font-normal text-slate-500">งานค้างส่ง CAP</div>
              <div className="text-xs sm:text-sm font-bold text-rose-700 mt-0.5" style={{ fontFamily: mono }}>
                {pendingCapCount} รายการ
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. DATA CARD (สาขา / รายครั้ง / กราฟ) ── */}
      <div className="rounded-3xl shadow-2xs overflow-hidden" style={cardStyle}>

        {/* Toggle Bar — 3 ปุ่มใหญ่เต็มความกว้าง */}
        <div className="p-3 border-b flex gap-2" style={{ borderColor: c.border, background: "#FAF9F5" }}>
          {[
            { key: "history", label: "📅  รายครั้ง" },
            { key: "table",   label: "📋  สาขา" },
            { key: "chart",   label: "📈  กราฟ" },
          ].map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setViewType(key)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold cursor-pointer transition-all active:scale-[0.98] ${
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
          <div className="px-4 py-2.5 border-b flex items-center gap-2" style={{ borderColor: c.border }}>
            <Filter size={13} style={{ color: c.accent }} />
            <select
              value={leaderboardFilter}
              onChange={(e) => setLeaderboardFilter(e.target.value)}
              className="bg-transparent text-xs sm:text-sm font-bold outline-none cursor-pointer text-slate-700 flex-1"
            >
              <optgroup label="เกณฑ์คะแนน">
                <option value="all">ทุกสาขา</option>
                <option value="under85">ต่ำกว่า 85% (ต้องปรับปรุง)</option>
                <option value="over90">มากกว่า 90% (ดีเยี่ยม)</option>
              </optgroup>
              <optgroup label="แบ่งตามเขต/ภูมิภาค">
                <option value="bkk">เขตกรุงเทพฯ</option>
                <option value="north">เขตภาคเหนือ</option>
                <option value="east">เขตภาคตะวันออก</option>
                <option value="northeast">เขตภาคอีสาน</option>
                <option value="south">เขตภาคใต้</option>
              </optgroup>
            </select>
          </div>
        )}

        {/* ── Content ── */}
        {viewType === "table" ? (
          <div className="p-3.5 sm:p-4 space-y-3">
            {/* 🌟 1. Toggle between Top 5 vs Bottom 5 */}
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
                      ? 'bg-red-700 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span></span>
                  <span>5 อันดับต่ำสุด</span>
                </button>
              </div>

              <span className="hidden sm:inline-block text-xs font-bold text-slate-400">
                {rankMode === "top5" ? "สาขาที่ทำผลงานยอดเยี่ยม" : "สาขาที่ต้องเร่งแก้ไข"}
              </span>
            </div>

            {/* 🌟 2. 5 Items List (Clean, Sleek, Mobile-Friendly) */}
            <div className="flex flex-col gap-2">
              {rankedBranches.map((u, idx) => {
                const isTop = rankMode === "top5";
                const rankBadge = isTop
                  ? idx === 0 ? "bg-amber-100 text-amber-900 border border-amber-300 font-extrabold"
                    : idx === 1 ? "bg-slate-200 text-slate-800 font-extrabold"
                    : idx === 2 ? "bg-amber-50 text-amber-800 font-bold"
                    : "bg-slate-100 text-slate-600 font-bold"
                  : idx === 0 ? "bg-red-100 text-red-800 border border-red-300 font-extrabold"
                    : "bg-amber-50 text-amber-800 font-bold";

                const isPassed = u.lastScore >= 85;
                const isCritical = u.lastScore < 70;

                return (
                  <button
                    key={u.name || idx}
                    type="button"
                    onClick={() => setViewUnit(u)}
                    className="w-full rounded-2xl p-3 sm:p-3.5 bg-white border border-slate-200 hover:border-emerald-500 hover:shadow-xs transition-all cursor-pointer flex items-center justify-between gap-3 text-left group active:scale-98 shadow-2xs"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Rank Badge #1 - #5 */}
                      <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-xl flex items-center justify-center text-xs shrink-0 ${rankBadge}`}>
                        #{idx + 1}
                      </div>

                      <ScoreRing score={u.lastScore} size={36} />

                      <div className="min-w-0 flex-1">
                        <div className="text-xs sm:text-sm font-bold text-slate-900 truncate group-hover:text-[#0F6659] transition-colors">
                          {u.name}
                        </div>
                      </div>
                    </div>

                    {/* Right Score & Status */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <div className={`text-xs sm:text-sm font-bold ${
                          isCritical ? 'text-red-700' : isPassed ? 'text-emerald-800' : 'text-amber-800'
                        }`} style={{ fontFamily: mono }}>
                          {u.lastScore}%
                        </div>
                        <div className="text-[11px] font-medium text-slate-400">
                          {isPassed ? "ผ่านเกณฑ์" : isCritical ? "วิกฤต" : "ปรับปรุง"}
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-slate-400 group-hover:text-[#0F6659] group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="pt-2 text-center text-[11px] font-semibold text-slate-400">
              แสดง Top 5 บนภาพรวม · ดูข้อมูลทั้งหมดได้ที่ เพิ่มเติม → สาขาทั้งหมด
            </div>
          </div>

        ) : viewType === "history" ? (
          <div className="p-3.5 sm:p-4 space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-slate-700">รอบตรวจล่าสุด 5 รายการ</span>
              <span className="text-xs font-medium text-slate-400">ทั้งหมด {allAuditLogs.length} รอบ</span>
            </div>

            <div className="flex flex-col gap-2">
              {allAuditLogs.slice(0, 5).map((log, idx) => {
                const isPassed = log.score >= 85;
                const isCritical = log.score < 70;
                const statusStyle = isCritical ? "bg-red-100 text-red-700" : isPassed ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800";
                const statusLabel = isCritical ? "วิกฤต" : isPassed ? "ผ่านเกณฑ์" : "ปรับปรุง";

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedAuditLog({ unitName: log.unitFullName, record: log.record })}
                    className="w-full rounded-2xl p-3 sm:p-3.5 bg-white border border-slate-200 hover:border-emerald-500 hover:shadow-xs transition-all cursor-pointer flex items-center justify-between gap-3 text-left group active:scale-98 shadow-2xs"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <ScoreRing score={log.score} size={36} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs sm:text-sm font-bold text-slate-900 truncate group-hover:text-[#0F6659] transition-colors">
                            {log.unitName}
                          </span>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${statusStyle}`}>
                            {statusLabel}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-slate-400 group-hover:text-[#0F6659] transition-colors shrink-0">
                      <ChevronRight size={16} />
                    </div>
                  </button>
                );
              })}

              {allAuditLogs.length === 0 && (
                <div className="text-center text-sm py-10 text-slate-400 font-medium">ไม่พบรายการตรวจตามตัวกรองที่เลือก</div>
              )}
            </div>

            <div className="pt-2 text-center text-[11px] font-semibold text-slate-400">
              แสดง 5 รอบล่าสุด · ดูผลตรวจรายครั้งทั้งหมดได้ที่ เพิ่มเติม → รายงานผลการตรวจ
            </div>
          </div>

        ) : (
          /* ── โหมดกราฟ: ปุ่มเปรียบเทียบ รายภูมิภาค vs รายแบรนด์ ── */
          <div className="p-4 sm:p-5 space-y-4">
            {/* Group-by selector */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setChartGroupBy("region")}
                className={`flex-1 py-3 rounded-xl text-sm font-bold cursor-pointer transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
                  chartGroupBy === "region"
                    ? "bg-[#0F6659] text-white shadow-md"
                    : "bg-white text-slate-600 border border-slate-200 hover:border-emerald-400"
                }`}
              >
                <MapPin size={15} /> รายภูมิภาค
              </button>
              <button
                type="button"
                onClick={() => setChartGroupBy("brand")}
                className={`flex-1 py-3 rounded-xl text-sm font-bold cursor-pointer transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
                  chartGroupBy === "brand"
                    ? "bg-[#0F6659] text-white shadow-md"
                    : "bg-white text-slate-600 border border-slate-200 hover:border-emerald-400"
                }`}
              >
                <Store size={15} /> รายแบรนด์
              </button>
            </div>

            {/* Chart Title */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-slate-700">
                คะแนนเฉลี่ย{chartGroupBy === "region" ? "รายภูมิภาค" : "รายแบรนด์"} (6 เดือนล่าสุด)
              </span>
            </div>

            {/* Multi-line Chart */}
            <div className="h-64 sm:h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={comparisonData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E3DA" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#6B7280", fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[60, 100]} tick={{ fontSize: 12, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "#1C2129", borderRadius: 12, border: "none", color: "#fff", fontSize: 13, fontWeight: 600 }}
                    formatter={(val, name) => {
                      const found = [...REGION_LINES, ...BRAND_LINES].find(l => l.key === name);
                      return [`${val}%`, found ? found.label : name];
                    }}
                  />
                  <Legend
                    formatter={(value) => {
                      const found = [...REGION_LINES, ...BRAND_LINES].find(l => l.key === value);
                      return found ? found.label : value;
                    }}
                    wrapperStyle={{ fontSize: 12, fontWeight: 700, paddingTop: 8 }}
                    iconType="circle"
                    iconSize={8}
                  />
                  <ReferenceLine
                    y={85}
                    stroke="#F97316"
                    strokeDasharray="5 4"
                    strokeWidth={2}
                    label={{ value: "เกณฑ์ 85%", position: "right", fill: "#EA580C", fontSize: 11, fontWeight: 700 }}
                  />
                  <ReferenceLine
                    y={90}
                    stroke="#16A34A"
                    strokeDasharray="5 4"
                    strokeWidth={2}
                    label={{ value: "ดีเยี่ยม 90%", position: "right", fill: "#16A34A", fontSize: 11, fontWeight: 700 }}
                  />
                  {comparisonLines.map(({ key, color }) => (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      stroke={color}
                      strokeWidth={3}
                      dot={{ r: 4, fill: color, strokeWidth: 2, stroke: "#fff" }}
                      activeDot={{ r: 6 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* ── 4. AI INSIGHTS — 3 การ์ดเรียงแนวนอน ── */}
      <div>
        <h2 className="text-sm sm:text-base font-bold mb-3" style={{ color: c.ink }}>สรุปโดย AI ประจำสัปดาห์</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {AI_INSIGHTS.map((ins) => (
            <div
              key={ins.type}
              className="rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-2xs border flex flex-col gap-2"
              style={{ background: ins.bg, borderColor: ins.border }}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">{ins.icon}</span>
                <span className="text-xs sm:text-sm font-bold" style={{ color: ins.icon_color }}>{ins.title}</span>
              </div>
              <p className="text-xs sm:text-xs sm:text-sm font-medium leading-relaxed text-slate-700">
                {ins.text}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── 5. ACTION BUTTONS (ปุ่มใหญ่ด้านล่าง) ── */}
      <div className="flex flex-col sm:flex-row gap-3 pt-1">
        <button
          type="button"
          onClick={() => setShowMonthlyModal(true)}
          className="flex-1 flex items-center justify-center gap-2.5 py-4 rounded-2xl text-sm sm:text-base font-bold cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.98] shadow-md text-white"
          style={{ background: "linear-gradient(135deg, #0F6659, #15806e)" }}
        >
          <BarChart3 size={20} />
          รายงานประชุมประจำเดือน
        </button>
        <button
          type="button"
          onClick={() => setShowExportModal(true)}
          className="flex-1 flex items-center justify-center gap-2.5 py-4 rounded-2xl text-sm sm:text-base font-bold cursor-pointer transition-all hover:bg-emerald-50 active:scale-[0.98] border-2 border-emerald-600 text-emerald-800 bg-white shadow-xs"
        >
          <FileSpreadsheet size={20} />
          ส่งออก Excel
        </button>
      </div>

      {/* Modals */}
      {showExportModal && <ExcelExportModal onClose={() => setShowExportModal(false)} />}
      {showMonthlyModal && <MonthlyMeetingReportModal onClose={() => setShowMonthlyModal(false)} />}
    </div>
  );
}
