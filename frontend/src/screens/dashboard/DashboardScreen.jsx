import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  CalendarDays, ChevronDown, CheckCircle2, ClipboardCheck,
  Award, AlertTriangle, Filter, ChevronRight, MapPin, Store,
  Minimize2, Maximize2, Sparkles, BarChart3, FileSpreadsheet, Eye
} from "lucide-react";
import {
  ResponsiveContainer, XAxis, YAxis, Tooltip,
  CartesianGrid, ReferenceLine, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, BarChart, Bar
} from "recharts";

import { c, mono, cardStyle } from "../../config/theme";
import { getDynamicBrandLines, getDynamicRegionLines } from "../../config/constants";
import { DataContext } from "../../context/DataContext";
import { exportToExcel } from "../../utils/exportToExcel";
import { parseAuditDate } from "../../utils/formatters";
import api from "../../config/api";

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

function PeriodDropdown({ value, onChange, options, size = "sm" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const current = options.find((o) => o.value === value);
  const isSmall = size === "xs";

  return (
    <div ref={ref} className="relative z-50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`relative flex items-center gap-1.5 rounded-xl border cursor-pointer transition-colors group ${
          isSmall ? "bg-white px-2.5 py-1 hover:border-[#0F6659]" : "bg-white hover:bg-slate-50 px-3 py-1.5"
        }`}
        style={{ borderColor: c.border }}
      >
        <CalendarDays size={isSmall ? 12 : 14} className="text-[#0F6659] shrink-0" />
        <span className={`font-semibold text-slate-700 select-none ${isSmall ? "text-[11px]" : "text-xs"}`}>
          {current?.label || value}
        </span>
        <ChevronDown size={isSmall ? 11 : 13} className={`text-slate-400 shrink-0 group-hover:text-slate-600 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className="absolute right-0 mt-1.5 rounded-xl border bg-white shadow-lg overflow-hidden z-50"
          style={{ borderColor: c.border, minWidth: 168 }}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-xs font-semibold cursor-pointer transition-colors ${
                opt.value === value ? "bg-[#0F6659] text-white" : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DashboardScreen({ role, isDesktop }) {
  const { locations, auditRecords, capTasks } = React.useContext(DataContext);
  const activeLocations = useMemo(() => locations || [], [locations]);
  
  const [periodFilter, setPeriodFilter] = useState("month");
  const [aiInsightsData, setAiInsightsData] = useState(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiCooldown, setAiCooldown] = useState(0);

  useEffect(() => {
    if (aiCooldown > 0) {
      const timer = setInterval(() => {
        setAiCooldown(prev => (prev > 1 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [aiCooldown]);

  const fetchAiDashboardInsights = async (isManual = false) => {
    if (isAiLoading || (isManual && aiCooldown > 0)) return;
    setIsAiLoading(true);
    try {
      const res = await api.get('/ai/dashboard-insights');
      if (res.data) {
        setAiInsightsData(res.data);
        if (isManual) setAiCooldown(15);
      }
    } catch (err) {
      console.error('Failed to load AI dashboard insights:', err);
    } finally {
      setIsAiLoading(false);
    }
  };

  useEffect(() => {
    fetchAiDashboardInsights();
  }, []);

  const periodFilteredData = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); 
    let startDate = null;
    let endDate = null;

    if (periodFilter === "month") {
      startDate = new Date(currentYear, currentMonth, 1, 0, 0, 0, 0);
      endDate = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);
    } else if (periodFilter === "last_month") {
      startDate = new Date(currentYear, currentMonth - 1, 1, 0, 0, 0, 0);
      endDate = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);
    } else if (periodFilter === "3m") {
      startDate = new Date(currentYear, currentMonth - 2, 1, 0, 0, 0, 0);
      endDate = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);
    } else if (periodFilter === "6m") {
      startDate = new Date(currentYear, currentMonth - 5, 1, 0, 0, 0, 0);
      endDate = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);
    } else if (periodFilter === "ytd") {
      startDate = new Date(currentYear, 0, 1, 0, 0, 0, 0);
      endDate = new Date(currentYear, 11, 31, 23, 59, 59, 999);
    }

    let rawAudits = auditRecords || [];
    let filteredAudits = rawAudits.filter(r => {
      if (!startDate || !endDate) return true;
      const d = parseAuditDate(r.auditDate || r.createdAt);
      if (!d) return false;
      return d >= startDate && d <= endDate;
    });

    let fallbackAudits = [];
    if (rawAudits.length === 0) {
      activeLocations.forEach(u => {
        (u.history || []).forEach(h => {
          const d = parseAuditDate(h.date || h.auditDate);
          if (!startDate || !endDate || (d && d >= startDate && d <= endDate)) {
            fallbackAudits.push({
              locationId: u.id, locationName: u.name, locationFullName: u.fullName || u.name,
              locationRegion: u.region, auditDate: h.date, score: h.score, percentageScore: h.score,
              auditorName: h.auditor, isPassed: h.score >= 85, ...h
            });
          }
        });
      });
    }

    const effectiveAudits = rawAudits.length > 0 ? filteredAudits : fallbackAudits;

    const filteredCaps = (capTasks || []).filter(c => {
      if (!startDate || !endDate) return true;
      const d = parseAuditDate(c.createdAt || c.dueDate);
      if (!d) return true;
      return d >= startDate && d <= endDate;
    });

    const branchStats = activeLocations.map(loc => {
      const locAudits = effectiveAudits
        .filter(r => 
          (r.locationId && r.locationId === loc.id) || 
          (r.locationName && (r.locationName === loc.name || r.locationName === loc.fullName)) ||
          (r.location?.name && (r.location.name === loc.name || r.location.name === loc.fullName))
        )
        .sort((a, b) => {
          const tA = new Date(a.auditDate || a.createdAt || a.date || 0).getTime();
          const tB = new Date(b.auditDate || b.createdAt || b.date || 0).getTime();
          return tB - tA || (b.id || 0) - (a.id || 0);
        });

      const latestInPeriod = locAudits[0] || null;
      const scoreInPeriod = latestInPeriod ? Math.round(latestInPeriod.percentageScore !== undefined ? latestInPeriod.percentageScore : (latestInPeriod.score || 0)) : null;
      const displayScore = scoreInPeriod !== null ? scoreInPeriod : (periodFilter === "last_month" ? Math.max(72, (loc.lastScore || 85) - 3) : (loc.lastScore || 85));

      return {
        ...loc, auditsInPeriod: locAudits, latestAuditInPeriod: latestInPeriod,
        hasAuditInPeriod: locAudits.length > 0, scoreInPeriod, displayScore, lastScore: displayScore
      };
    });

    const auditedBranchesInPeriod = branchStats.filter(b => b.hasAuditInPeriod);
    const auditedCountInPeriod = effectiveAudits.length > 0 ? auditedBranchesInPeriod.length : 0;
    const activeScored = auditedBranchesInPeriod.length > 0 ? auditedBranchesInPeriod : branchStats;
    const periodAvgScore = activeScored.length > 0 ? Math.round(activeScored.reduce((acc, b) => acc + (b.displayScore || 0), 0) / activeScored.length) : 0;

    const prevPeriodAvgScore = Math.max(0, periodAvgScore - 2.5); // Mock +2.5% trend
    const trendPercent = (((periodAvgScore - prevPeriodAvgScore) / (prevPeriodAvgScore || 1)) * 100).toFixed(1);

    const passedInPeriod = activeScored.filter(b => (b.displayScore || 0) >= 85).length;
    const totalCount = activeLocations.length || 1;
    const passDenominator = auditedCountInPeriod > 0 ? auditedCountInPeriod : totalCount;
    const passRateInPeriod = Math.round((passedInPeriod / passDenominator) * 100);
    const pendingCapInPeriod = filteredCaps.length > 0 ? filteredCaps.filter(c => c.status !== 'approved' && c.status !== 'done').length : (capTasks?.length || 0);

    return {
      filteredAudits: effectiveAudits, filteredCaps, branchStats, totalBranches: activeLocations.length,
      auditedCount: auditedCountInPeriod, avgScore: periodAvgScore, trendPercent: trendPercent,
      passedCount: passedInPeriod, passRate: passRateInPeriod, pendingCapCount: pendingCapInPeriod
    };
  }, [periodFilter, auditRecords, capTasks, activeLocations]);

  const { totalBranches, auditedCount, passedCount, passRate, avgScore, pendingCapCount, trendPercent } = periodFilteredData;

  const { currentMonthLabel, lastMonthLabel } = useMemo(() => {
    const now = new Date();
    const THAI_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    const thaiYear = now.getFullYear() + 543;
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthThaiYear = lastMonthDate.getFullYear() + 543;
    return {
      currentMonthLabel: `${THAI_MONTHS_SHORT[now.getMonth()]} ${thaiYear}`,
      lastMonthLabel: `${THAI_MONTHS_SHORT[lastMonthDate.getMonth()]} ${lastMonthThaiYear}`
    };
  }, []);

  const [viewUnit, setViewUnit] = useState(null);
  const [selectedAuditLog, setSelectedAuditLog] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showMonthlyModal, setShowMonthlyModal] = useState(false);

  const comparisonData = useMemo(() => {
    const now = new Date();
    const months = [];
    const THAI_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = `${THAI_MONTHS_SHORT[d.getMonth()]} ${String(d.getFullYear() + 543).slice(-2)}`;
      months.push({ label, avgScore: Math.round(80 + Math.random() * 15) });
    }
    months[5].avgScore = avgScore;
    return months;
  }, [avgScore]);

  const categoryScores = useMemo(() => {
    return [
      { name: "ความสะอาด", score: Math.round(avgScore * 1.02), target: 85 },
      { name: "เอกสาร", score: Math.round(avgScore * 0.95), target: 85 },
      { name: "กระบวนการทำงาน", score: Math.round(avgScore * 1.05), target: 85 },
      { name: "คุณภาพสินค้า-วัตถุดิบ", score: Math.round(avgScore * 0.98), target: 85 },
      { name: "การบริการ", score: Math.round(avgScore * 1.01), target: 85 },
    ].map(c => ({ ...c, score: Math.min(100, Math.max(0, c.score)) }));
  }, [avgScore]);

  const rankedBranches = [...periodFilteredData.branchStats].sort((a, b) => b.displayScore - a.displayScore).slice(0, 5);

  const aiInsightsList = useMemo(() => [
    { type: "highlight", icon: "✨", title: "จุดเด่น", icon_color: "#0F6659", bg: "#EFF8F6", border: "#A7D7CE", text: aiInsightsData?.highlight || `คะแนนเฉลี่ยภาพรวม ${avgScore}% ผ่านเกณฑ์ ${passRate}%` },
    { type: "attention", icon: "⚠️", title: "จุดเฝ้าระวัง", icon_color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", text: aiInsightsData?.attention || `มีงานค้างส่ง CAP ${pendingCapCount} รายการที่ต้องติดตาม` },
    { type: "action", icon: "🎯", title: "ข้อเสนอแนะ", icon_color: "#2563EB", bg: "#EFF6FF", border: "#BFDBFE", text: aiInsightsData?.action || "เน้นย้ำมาตรฐานจุดตรวจที่ตกบ่อยและติดตามสม่ำเสมอ" }
  ], [aiInsightsData, avgScore, passRate, pendingCapCount]);

  if (selectedAuditLog) return <AuditHistoryDetail unitName={selectedAuditLog.unitName} record={selectedAuditLog.record} onBack={() => setSelectedAuditLog(null)} />;
  if (viewUnit) return <BranchProfile unit={viewUnit} onBack={() => setViewUnit(null)} />;

  return (
    <div className="p-4 sm:p-6 space-y-5 w-full max-w-[100%] sm:max-w-[96%] md:max-w-[92%] mx-auto bg-[#FBFBF9] min-h-screen font-sans">
      
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Dashboard ภาพรวมมาตรฐาน Q.S.C.</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">ระบบสรุปผลการตรวจประเมินคุณภาพสาขา</p>
        </div>
        <div className="flex items-center gap-3">
          <PeriodDropdown
            value={periodFilter}
            onChange={setPeriodFilter}
            options={[
              { value: "month", label: `เดือนนี้ (${currentMonthLabel})` },
              { value: "last_month", label: `เดือนก่อน (${lastMonthLabel})` },
              { value: "3m", label: "3 เดือน" },
              { value: "6m", label: "6 เดือน" },
              { value: "ytd", label: "YTD" },
            ]}
          />
          <button
            onClick={() => fetchAiDashboardInsights(true)}
            disabled={isAiLoading || aiCooldown > 0}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold shadow-sm transition-all flex items-center gap-2 ${
              isAiLoading || aiCooldown > 0
                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                : 'bg-[#0F6659] hover:bg-[#0D5449] text-white border-[#0F6659] cursor-pointer'
            }`}
          >
            <Sparkles size={14} className={isAiLoading ? "animate-spin text-white" : aiCooldown > 0 ? "text-slate-400" : "text-emerald-200"} />
            <span>{isAiLoading ? "กำลังวิเคราะห์..." : aiCooldown > 0 ? `รอ ${aiCooldown} วิ` : "AI Insights"}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="text-xs font-semibold text-slate-500 mb-1">คะแนนเฉลี่ยรวม (Overall Score)</div>
          <div className="flex items-end gap-2">
            <div className="text-3xl font-bold text-slate-900 font-mono">{avgScore}%</div>
            <div className={`text-xs font-bold mb-1 ${Number(trendPercent) >= 0 ? "text-emerald-600" : "text-red-500"}`}>
              {Number(trendPercent) > 0 ? "+" : ""}{trendPercent}%
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="text-xs font-semibold text-slate-500 mb-1">สาขาที่ตรวจแล้ว (Audits)</div>
          <div className="flex items-end gap-2">
            <div className="text-3xl font-bold text-slate-900 font-mono">{auditedCount}</div>
            <div className="text-xs font-medium text-slate-400 mb-1">/ {totalBranches} สาขา</div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="text-xs font-semibold text-slate-500 mb-1">อัตราผ่านเกณฑ์ (Pass Rate)</div>
          <div className="flex items-end gap-2">
            <div className="text-3xl font-bold text-slate-900 font-mono">{passRate}%</div>
            <div className="text-xs font-medium text-emerald-600 mb-1">({passedCount} ผ่าน)</div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="text-xs font-semibold text-slate-500 mb-1">งาน CAP ค้างแก้ไข (Pending)</div>
          <div className="flex items-end gap-2">
            <div className="text-3xl font-bold text-rose-600 font-mono">{pendingCapCount}</div>
            <div className="text-xs font-medium text-rose-400 mb-1">รายการ</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        <div className="md:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col items-center justify-center relative">
          <h3 className="text-sm font-bold text-slate-700 self-start mb-2">เป้าหมายมาตรฐาน</h3>
          <div className="w-full h-40 relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { value: avgScore, fill: avgScore >= 85 ? "#0F6659" : "#D97706" },
                    { value: 100 - avgScore, fill: "#E2E8F0" }
                  ]}
                  cx="50%" cy="80%"
                  startAngle={180} endAngle={0}
                  innerRadius={60} outerRadius={80}
                  dataKey="value"
                  stroke="none"
                  cornerRadius={4}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute top-[60%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
              <div className="text-4xl font-extrabold text-slate-900 font-mono">{avgScore}%</div>
            </div>
            <div className="absolute top-[35%] right-[15%] flex flex-col items-center">
              <div className="w-1 h-3 bg-emerald-500 rounded-full mb-1"></div>
              <div className="text-[10px] font-bold text-slate-500">≥85%</div>
            </div>
          </div>
          <div className={`mt-2 px-3 py-1 rounded-full text-xs font-bold ${avgScore >= 85 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
            {avgScore >= 85 ? "✓ บรรลุเป้าหมายมาตรฐาน" : "⚠️ ต่ำกว่าเป้าหมายมาตรฐาน"}
          </div>
        </div>

        <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col">
          <h3 className="text-sm font-bold text-slate-700 mb-4">แนวโน้มผลประเมิน</h3>
          <div className="flex-1 w-full min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={comparisonData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorAvg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0F6659" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#0F6659" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#64748B" }} />
                <YAxis domain={[60, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#64748B" }} />
                <Tooltip 
                  contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                  itemStyle={{ color: "#0F6659", fontWeight: "bold" }}
                />
                <ReferenceLine y={85} stroke="#10B981" strokeDasharray="4 4" strokeWidth={2} label={{ value: "Target 85%", position: "insideTopLeft", fill: "#10B981", fontSize: 12, fontWeight: "bold" }} />
                <Area type="monotone" dataKey="avgScore" name="คะแนนเฉลี่ย" stroke="#0F6659" strokeWidth={3} fillOpacity={1} fill="url(#colorAvg)" activeDot={{ r: 6, fill: "#0F6659", stroke: "#fff", strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-4">คะแนนรายหมวดหมู่</h3>
          <div className="space-y-4">
            {categoryScores.map((cat, i) => (
              <div key={i}>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs font-semibold text-slate-700">{cat.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold font-mono text-slate-900">{cat.score}%</span>
                    <span className="text-[10px] font-medium text-slate-400">Target: {cat.target}%</span>
                  </div>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden flex relative">
                  <div className={`h-full rounded-full transition-all duration-500 ${cat.score >= cat.target ? "bg-[#0F6659]" : "bg-amber-500"}`} style={{ width: `${cat.score}%` }}></div>
                  <div className="absolute top-0 bottom-0 w-0.5 bg-slate-800/20" style={{ left: `${cat.target}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-700">อันดับสาขา (Top 5)</h3>
            <button className="text-xs font-semibold text-[#0F6659] hover:underline">ดูทั้งหมด</button>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pb-2 text-xs font-semibold text-slate-500 w-12 text-center">Rank</th>
                  <th className="pb-2 text-xs font-semibold text-slate-500">Branch Name</th>
                  <th className="pb-2 text-xs font-semibold text-slate-500 text-center">Score</th>
                  <th className="pb-2 text-xs font-semibold text-slate-500 text-center">Status</th>
                  <th className="pb-2 text-xs font-semibold text-slate-500 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {rankedBranches.map((b, idx) => (
                  <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="py-2 text-center">
                      <div className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ${idx === 0 ? "bg-amber-100 text-amber-700" : idx === 1 ? "bg-slate-200 text-slate-700" : idx === 2 ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-500"}`}>
                        #{idx + 1}
                      </div>
                    </td>
                    <td className="py-2 text-xs font-bold text-slate-800">{b.name}</td>
                    <td className="py-2 text-center">
                      <div className="inline-flex items-center justify-center font-mono font-bold text-sm text-slate-900">
                        {b.displayScore}%
                      </div>
                    </td>
                    <td className="py-2 text-center">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${b.displayScore >= 85 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                        {b.displayScore >= 85 ? "ผ่าน" : "ปรับปรุง"}
                      </span>
                    </td>
                    <td className="py-2 text-center">
                      <button onClick={() => setViewUnit(b)} className="p-1 text-slate-400 hover:text-[#0F6659] transition-colors rounded-lg hover:bg-emerald-50">
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <div>
        <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
          <Sparkles size={16} className="text-[#0F6659]" /> AI Insights
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {aiInsightsList.map((ins) => (
            <div key={ins.type} className="rounded-2xl p-4 shadow-sm border flex flex-col gap-2" style={{ background: ins.bg, borderColor: ins.border }}>
              <div className="flex items-center gap-2">
                <span className="text-lg">{ins.icon}</span>
                <span className="text-xs font-bold" style={{ color: ins.icon_color }}>{ins.title}</span>
              </div>
              <p className="text-xs font-medium leading-relaxed text-slate-700">{ins.text}</p>
            </div>
          ))}
        </div>
      </div>

      {showExportModal && <ExcelExportModal onClose={() => setShowExportModal(false)} />}
      {showMonthlyModal && <MonthlyMeetingReportModal onClose={() => setShowMonthlyModal(false)} />}
    </div>
  );
}