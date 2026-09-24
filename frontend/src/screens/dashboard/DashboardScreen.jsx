import React, { useState, useMemo, useEffect, useRef } from "react";
import { CalendarDays, ChevronDown, CheckCircle2, Sparkles, BarChart3, FileSpreadsheet, Info, X, AlertCircle } from "lucide-react";
import { ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, AreaChart, Area, PieChart, Pie } from "recharts";

import { c, mono, cardStyle } from "../../config/theme";
import { getDynamicBrandLines, getDynamicRegionLines, getCategoryDisplay } from "../../config/constants";
import { DataContext } from "../../context/DataContext";
import { exportToExcel } from "../../utils/exportToExcel";
import { parseAuditDate } from "../../utils/formatters";
import api, { AI_REQUEST_TIMEOUT_MS } from "../../config/api";

import ModalWrapper from "../../shared/ModalWrapper";
import Header from "../../shared/Header";
import Section from "../../shared/Section";
import ScoreRing from "../../shared/ScoreRing";
import HistoryList from "../../shared/HistoryList";
import ErrorBoundary from "../../shared/ErrorBoundary";
import ExcelExportModal from "../../modals/ExcelExportModal";
import MonthlyMeetingReportModal from "../../modals/MonthlyMeetingReportModal";
import BranchProfile from "./BranchProfile";
import AllAuditHistoryScreen from "./AllAuditHistoryScreen";
import AuditHistoryDetail from "../audit/AuditHistoryDetail";

function InfoPopover({ title, description, align="right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isAlignRight = align === "right";

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="mt-1 text-slate-400 hover:text-slate-600 transition-colors p-0.5 cursor-pointer rounded-md hover:bg-slate-100"
      >
        <Info size={16} />
      </button>

      {open && (
        <div
          className={`absolute top-full mt-2 w-56 sm:w-64 p-3 bg-slate-900/95 text-white rounded-xl shadow-2xl z-50 text-xs border border-slate-700 animate-in fade-in zoom-in-95 backdrop-blur-sm ${
            isAlignRight ? "-right-2 sm:right-0" : "-left-2 sm:left-0"
          }`}
        >
          <div className="flex justify-between items-start mb-1 gap-2">
            <span className="font-bold text-slate-100">{title}</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-slate-400 hover:text-white p-0.5"
            >
              <X size={12} />
            </button>
          </div>
          <p className="text-slate-300 font-normal leading-relaxed">{description}</p>
          <div
            className={`absolute -top-1 w-2 h-2 bg-slate-900 border-t border-l border-slate-700 rotate-45 ${
              isAlignRight ? "right-3" : "left-3"
            }`}
          />
        </div>
      )}
    </div>
  );
}

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

  return (
    <div ref={ref} className="relative z-50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs cursor-pointer transition-colors group"
      >
        <CalendarDays size={13} className="text-[#0F6659] shrink-0" />
        <span className="font-semibold text-slate-700 select-none text-xs">
          {current?.label || value}
        </span>
        <ChevronDown size={12} className={`text-slate-400 shrink-0 group-hover:text-slate-600 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 mt-1.5 rounded-2xl border bg-white shadow-xl overflow-hidden z-50 py-1 min-w-[200px] border-slate-200 animate-in fade-in zoom-in-95">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full text-left px-3.5 py-2.5 text-xs font-bold cursor-pointer transition-colors flex items-center justify-between ${
                opt.value === value ? "bg-[#0F6659] text-white" : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span>{opt.label}</span>
              {opt.value === value && <CheckCircle2 size={13} className="text-white shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const DASHBOARD_AI_CACHE_KEY = "qsc_ai_dashboard_cache";
const DASHBOARD_COOLDOWN_KEY = "qsc_ai_cooldown_dashboard";

// 🌟 In-Memory Cache for Instant Tab Switching (Stale-While-Revalidate)
const dashboardApiCache = new Map();

const getRemainingDashboardCooldown = () => {
  try {
    const expiry = parseInt(sessionStorage.getItem(DASHBOARD_COOLDOWN_KEY) || "0", 10);
    const remaining = Math.ceil((expiry - Date.now()) / 1000);
    return remaining > 0 ? remaining : 0;
  } catch {
    return 0;
  }
};

export default function DashboardScreen({ role, isDesktop }) {
  const { locations: visibleLocations, auditRecords, capTasks, currentUser, selectedBrandId, brands } = React.useContext(DataContext);
  const activeLocations = useMemo(() => visibleLocations || [], [visibleLocations]);

  const userRole = (role || currentUser?.role || currentUser?.roleCode || '').toUpperCase();
  const isBranchManager = userRole === "AUDITEE" || userRole === "BRANCH_MANAGER" || currentUser?.branchScope === "SPECIFIC";
  
  const [periodFilter, setPeriodFilter] = useState("month");
  const [aiInsightsData, setAiInsightsData] = useState(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [justUpdated, setJustUpdated] = useState(false);
  const [aiCooldown, setAiCooldown] = useState(0);

  // 🌟 Effective Brand: ถ้าผู้ใช้เลือกแบรนด์ หรือมีสิทธิ์เข้าถึงเพียงแบรนด์เดียว (เช่น After You) ให้ผูกแบรนด์นั้นทันที
  const effectiveBrandId = selectedBrandId || (brands?.length === 1 ? brands[0].id : null);
  const activeBrand = (brands || []).find(b => b.id === effectiveBrandId);
  const brandDisplayName = activeBrand?.name || (effectiveBrandId ? "แบรนด์ที่เลือก" : "ทุกแบรนด์");

  const dashboardCacheKey = useMemo(
    () => `qsc_ai_dashboard_cache_${currentUser?.id || 'default'}_${effectiveBrandId || 'all'}_${periodFilter || 'month'}`,
    [currentUser?.id, effectiveBrandId, periodFilter]
  );
  const dashboardCooldownKey = useMemo(
    () => `qsc_ai_cooldown_dashboard_${currentUser?.id || 'default'}_${effectiveBrandId || 'all'}`,
    [currentUser?.id, effectiveBrandId]
  );

  const getRemainingDashboardCooldown = () => {
    try {
      const expiry = parseInt(sessionStorage.getItem(dashboardCooldownKey) || "0", 10);
      const remaining = Math.ceil((expiry - Date.now()) / 1000);
      return remaining > 0 ? remaining : 0;
    } catch {
      return 0;
    }
  };

  // ⏳ Keep countdown alive based on real wall-clock time even when navigating away & back
  useEffect(() => {
    const updateCountdown = () => {
      const remaining = getRemainingDashboardCooldown();
      setAiCooldown(remaining);
      return remaining;
    };

    updateCountdown();
    const timer = setInterval(() => {
      const remaining = updateCountdown();
      if (remaining <= 0) {
        setAiCooldown(0);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [dashboardCooldownKey]);

  const setCooldownSeconds = (seconds) => {
    try {
      const expiry = Date.now() + seconds * 1000;
      sessionStorage.setItem(dashboardCooldownKey, expiry.toString());
    } catch (e) {}
    setAiCooldown(seconds);
  };

  const fetchAiDashboardInsights = async (isManual = false) => {
    // 🌟 ถ้าเป็นการเปิดหน้าจอ และมี Cache อยู่แล้วในเซสชันนี้ -> ดึงจาก Cache ทันที ไม่ยิง API ซ้ำ
    if (!isManual) {
      try {
        const cached = sessionStorage.getItem(dashboardCacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.highlight) {
            setAiInsightsData(parsed);
            return;
          }
        }
      } catch (e) {}
      // ถ้ายังไม่มี Cache (เพิ่งเข้าระบบมาครั้งแรก) จะไหลลงไปยิงขอคำแนะนำจาก AI อัตโนมัติ 1 ครั้งแรก
    }

    if (isAiLoading || (isManual && getRemainingDashboardCooldown() > 0)) return;
    setIsAiLoading(true);
    try {
      const params = {};
      if (periodFilter) params.period = periodFilter;
      if (effectiveBrandId) params.brandId = effectiveBrandId;

      const res = await api.get('/ai/dashboard-insights', { 
        params,
        timeout: AI_REQUEST_TIMEOUT_MS 
      });
      if (res.data) {
        try {
          sessionStorage.setItem(dashboardCacheKey, JSON.stringify(res.data));
        } catch (e) {}
        setAiInsightsData(res.data);
        if (isManual) {
          setCooldownSeconds(15);
          setJustUpdated(true);
          setTimeout(() => setJustUpdated(false), 3500);
        }
      }
    } catch (err) {
      if (err?.response?.status === 429) {
        console.warn('AI Rate Limit reached, using smart analytics engine fallback.');
        if (isManual) setCooldownSeconds(30);
      } else {
        console.warn('AI dashboard insights unavailable, using smart analytics fallback:', err?.message || err);
      }
    } finally {
      setIsAiLoading(false);
    }
  };

  useEffect(() => {
    fetchAiDashboardInsights(false);
  }, [dashboardCacheKey]);

  // 🌟 Client fallback for top branches in case backend returns empty top5
  const clientFallbackTopBranches = useMemo(() => {
    if (!activeLocations || activeLocations.length === 0) return [];
    return activeLocations
      .filter(loc => (loc.lastScore ?? loc.percentageScore) !== undefined)
      .sort((a, b) => (b.lastScore ?? b.percentageScore ?? 0) - (a.lastScore ?? a.percentageScore ?? 0))
      .slice(0, 5)
      .map(b => ({
        ...b,
        effectiveScore: Number(b.lastScore ?? b.percentageScore ?? 0),
        hasAudit: true
      }));
  }, [activeLocations]);

  // รับผลรวม KPI สรุปจาก Database (พร้อม Stale-While-Revalidate In-Memory Cache)
  const cacheKey = `${periodFilter}_${effectiveBrandId || 'all'}`;
  const initialCached = dashboardApiCache.get(cacheKey);

  const [dashboardStats, setDashboardStats] = useState(() => initialCached?.stats || {
    totalBranches: 0,
    auditedCount: 0,
    totalInspections: 0,
    prevTotalInspections: 0,
    inspectionDiff: null,
    passedCount: 0,
    passRate: 0,
    avgScore: 0,
    trendPercent: null,
    pendingCaps: 0
  });
  const [topBranches, setTopBranches] = useState(() => initialCached?.topBranches || []);
  const [categoryScores, setCategoryScores] = useState(() => initialCached?.categoryScores || []);
  const [isStatsLoading, setIsStatsLoading] = useState(() => !initialCached);
  const [isFetchError, setIsFetchError] = useState(false);
  const [retryTrigger, setRetryTrigger] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const currentKey = `${periodFilter}_${effectiveBrandId || 'all'}`;
    const cached = dashboardApiCache.get(currentKey);
    const now = Date.now();

    // ⚡ ถ้ามีแคช ให้แสดงข้อมูลทันที 0ms ไม่มีหน้าจอกระพริบ
    if (cached) {
      setDashboardStats(cached.stats);
      setTopBranches(cached.topBranches);
      setCategoryScores(cached.categoryScores);
      setIsStatsLoading(false);
      // ถ้าแคชยังใหม่มาก (< 45 วินาที) และไม่ได้กดลองใหม่ ไม่ต้องยิง API ซ้ำซ้อน
      if (now - cached.timestamp < 45000 && retryTrigger === 0) {
        return;
      }
    } else {
      setIsStatsLoading(true);
    }

    const queryParams = { period: periodFilter };
    if (effectiveBrandId) {
      queryParams.brandId = effectiveBrandId;
    }

    // ยิงดึง Overview, Rankings และ CategoryScores พร้อมกันตามรอบ Period และ Brand
    Promise.allSettled([
      api.get('/dashboard/overview', { params: queryParams }),
      api.get('/dashboard/rankings', { params: queryParams }),
      api.get('/dashboard/category-scores', { params: queryParams })
    ]).then(([overviewRes, rankingRes, categoryRes]) => {
      if (!isMounted) return;
      const isAnyFailed = overviewRes.status === 'rejected' || rankingRes.status === 'rejected' || categoryRes.status === 'rejected';
      setIsFetchError(isAnyFailed);

      const newStats = (overviewRes.status === 'fulfilled' && overviewRes.value.data) 
        ? overviewRes.value.data 
        : (cached?.stats || dashboardStats);
      const newTopBranches = (rankingRes.status === 'fulfilled' && rankingRes.value.data?.top5) 
        ? rankingRes.value.data.top5 
        : (cached?.topBranches || []);
      const newCategoryScores = (categoryRes.status === 'fulfilled' && Array.isArray(categoryRes.value.data)) 
        ? categoryRes.value.data 
        : (cached?.categoryScores || []);

      setDashboardStats(newStats);
      setTopBranches(newTopBranches);
      setCategoryScores(newCategoryScores);

      if (!isAnyFailed) {
        dashboardApiCache.set(currentKey, {
          stats: newStats,
          topBranches: newTopBranches,
          categoryScores: newCategoryScores,
          timestamp: Date.now()
        });
      }
    }).finally(() => {
      if (isMounted) setIsStatsLoading(false);
    });

    return () => { isMounted = false; };
  }, [periodFilter, effectiveBrandId, retryTrigger]);

  // ดึงตัวแปรสรุปจาก State แทน
  const { totalBranches, auditedCount, totalInspections, prevTotalInspections, inspectionDiff, passedCount, passRate, avgScore, pendingCaps: pendingCapCount, trendPercent } = dashboardStats;

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
  const [showExportModal, setShowExportModal] = useState(false);
  const [showMonthlyModal, setShowMonthlyModal] = useState(false);
  const [trendsData, setTrendsData] = useState([]);

  useEffect(() => {
    let isMounted = true;
    api.get('/dashboard/trends')
      .then(res => {
        if (isMounted && res.data?.monthlyTrends) {
          setTrendsData(res.data.monthlyTrends);
        }
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, []);

  const comparisonData = useMemo(() => {
    const now = new Date();
    const THAI_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    
    if (trendsData && trendsData.length > 0) {
      return trendsData.map(t => ({
        label: t.month,
        avgScore: t.score !== null && t.score !== undefined ? Math.round(t.score) : avgScore
      }));
    }

    const months = [];
    const rawAudits = auditRecords || [];

    for (let i = 5; i >= 0; i--) {
      const targetMonthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const targetYear = targetMonthDate.getFullYear();
      const targetMonth = targetMonthDate.getMonth();
      const label = `${THAI_MONTHS_SHORT[targetMonth]} ${String(targetYear + 543).slice(-2)}`;

      const startOfMonth = new Date(targetYear, targetMonth, 1, 0, 0, 0, 0);
      const endOfMonth = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);

      const monthAudits = rawAudits.filter(r => {
        const d = parseAuditDate(r.auditDate || r.createdAt);
        return d && d >= startOfMonth && d <= endOfMonth;
      });

      let monthAvg = null;
      if (monthAudits.length > 0) {
        monthAvg = Math.round(monthAudits.reduce((acc, r) => acc + (r.percentageScore || r.score || 0), 0) / monthAudits.length);
      } else {
        monthAvg = avgScore > 0 ? avgScore : 93;
      }

      months.push({ label, avgScore: monthAvg });
    }

    return months;
  }, [trendsData, auditRecords, avgScore]);

  const rankedBranches = useMemo(() => {
    // 🌟 1. ถ้ามี topBranches จาก API สำหรับรอบเวลานี้โดยเฉพาะ (คัดมาจาก AuditRecords ตาม period แล้ว)
    if (topBranches && topBranches.length > 0) {
      return topBranches.map(b => ({
        ...b,
        effectiveScore: Number(b.lastScore ?? b.percentageScore ?? b.avgScore ?? 0),
        hasAudit: true
      }));
    }

    // 🌟 2. Client fallback: ดึงจาก clientFallbackTopBranches
    return clientFallbackTopBranches;
  }, [topBranches, clientFallbackTopBranches]);

  const topPendingCapTopic = useMemo(() => {
    if (!capTasks || capTasks.length === 0) return "";
    const active = capTasks.filter(c => c.status !== "CLOSED" && c.status !== "closed" && c.status !== "CANCELLED" && c.status !== "cancelled");
    if (active.length === 0) return "";
    const topics = active
      .map(c => {
        if (c.categoryName && c.categoryName.trim() && c.categoryName.trim() !== "ทั่วไป") {
          return c.categoryName.trim();
        }
        let text = (c.issueItem || "").replace(/\./g, '').trim();
        if (text.toLowerCase().includes("take home")) return "สินค้า Take Home";
        if (text.includes("ป้ายสินค้า")) return "ป้ายสินค้า";
        const parts = text.split(/[-/(,]/).filter(Boolean);
        let cleaned = parts.length > 1 && /^ข้อ(ที่)?\s*\d+/i.test(parts[0].trim()) ? parts[1].trim() : (parts[0] ? parts[0].trim() : text);
        cleaned = cleaned.replace(/^(ข้อที่?\s*\d+[\s\-.:]*|\d+[\s\-.:]+)/i, '').trim();
        return cleaned;
      })
      .filter(s => s && !/^ข้อ(ที่)?\s*\d+$/i.test(s));
    const unique = Array.from(new Set(topics));
    return unique.slice(0, 3).join(", ");
  }, [capTasks]);

  const aiInsightsList = useMemo(() => [
    { 
      type: "highlight", 
      icon: "✨", 
      title: "จุดเด่น", 
      iconClass: "text-[#0F6659]", 
      bgClass: "bg-[#EFF8F6] border-[#A7D7CE]", 
      text: aiInsightsData?.highlight || `คะแนนเฉลี่ยภาพรวม (${brandDisplayName}) ${avgScore}% ผ่านเกณฑ์ ${passRate}%` 
    },
    { 
      type: "attention", 
      icon: "⚠️", 
      title: "จุดเฝ้าระวัง", 
      iconClass: "text-amber-600", 
      bgClass: "bg-amber-50 border-amber-200", 
      text: aiInsightsData?.attention || (pendingCapCount > 0 
        ? (topPendingCapTopic ? `งาน CAP ค้าง ${pendingCapCount} รายการ (พบปัญหา: ${topPendingCapTopic})` : `มีงานค้างส่ง CAP ${pendingCapCount} รายการที่ต้องติดตาม`)
        : "ไม่มีงานค้างส่ง CAP จัดการได้ตามกรอบเวลา")
    },
    { 
      type: "action", 
      icon: "🎯", 
      title: "ข้อเสนอแนะ", 
      iconClass: "text-[#0F6659]", 
      bgClass: "bg-emerald-50 border-emerald-200", 
      text: (() => {
        const act = aiInsightsData?.action;
        // ถ้า action จาก API หรือ Cache เก่ายังมีคำว่า "ข้อ 14" หรือ "ข้อ XX" ล้วนๆ ให้กรองและแสดงผลหัวข้อปัญหาจริง
        if (act && /เรื่อง\s*["'«]?ข้อ(ที่)?\s*\d+["'»]?/i.test(act)) {
          if (topPendingCapTopic) {
            return `กวดขันและแก้ไขปัญหาเรื่อง "${topPendingCapTopic}" ทันที`;
          }
          return "ติดตามและกวดขันการปฏิบัติตามมาตรฐานการตรวจประเมินอย่างใกล้ชิด";
        }
        return act || (topPendingCapTopic 
          ? `กวดขันและแก้ไขปัญหาเรื่อง "${topPendingCapTopic}" ทันที` 
          : "เน้นย้ำการสุ่มตรวจประเมินตามมาตรฐานอย่างต่อเนื่อง");
      })()
    }
  ], [aiInsightsData, avgScore, passRate, pendingCapCount, topPendingCapTopic, brandDisplayName]);
  if (viewUnit) return <BranchProfile unit={viewUnit} onBack={() => setViewUnit(null)} />;

  return (
    <div className="p-3.5 sm:p-6 space-y-4 sm:space-y-5 w-full max-w-[100%] sm:max-w-[96%] md:max-w-[92%] mx-auto bg-[#FBFBF9] min-h-screen font-sans pb-28 sm:pb-8">
      
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-slate-800 tracking-tight">Dashboard ภาพรวมมาตรฐาน Q.S.C.</h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5 sm:mt-1">ระบบสรุปผลการตรวจประเมินคุณภาพสาขา</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
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
            onClick={() => setShowMonthlyModal(true)}
            className="px-2.5 sm:px-3 py-1.5 rounded-2xl border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold shadow-2xs cursor-pointer flex items-center gap-1.5 transition-colors"
          >
            <BarChart3 size={13} className="text-[#0F6659]" />
            <span>รายงานประจำเดือน</span>
          </button>
          <button
            onClick={() => setShowExportModal(true)}
            className="px-2.5 sm:px-3 py-1.5 rounded-2xl border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold shadow-2xs cursor-pointer flex items-center gap-1.5 transition-colors"
          >
            <FileSpreadsheet size={13} className="text-[#0F6659]" />
            <span>ส่งออก Excel</span>
          </button>
        </div>
      </div>

      {/* ⚠️ L2: แจ้งเตือนกรณีไม่สามารถรีเฟรชข้อมูลล่าสุดได้ */}
      {isFetchError && (
        <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold shadow-2xs">
          <AlertCircle size={16} className="text-amber-600 shrink-0" />
          <span className="flex-1">ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์เพื่อรีเฟรชข้อมูลล่าสุดได้ ระบบกำลังแสดงข้อมูลแคชเดิม</span>
          <button 
            type="button"
            onClick={() => {
              dashboardApiCache.clear();
              setIsStatsLoading(true);
              setIsFetchError(false);
              setRetryTrigger(prev => prev + 1);
            }}
            className="px-2.5 py-1 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 text-[11px] font-bold cursor-pointer transition-colors shrink-0"
          >
            ลองใหม่
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200 shadow-xs sm:shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="text-[11px] sm:text-xs font-semibold text-slate-500 mb-0.5 sm:mb-1">Total Audits</div>
            <InfoPopover 
              align="left"
              title="Total Audits"
              description="จำนวนครั้งการตรวจประเมินทั้งหมดที่เกิดขึ้นจริงในช่วงเวลาที่เลือก (รวมการตรวจซ้ำของสาขา)"
            />
          </div>
          <div className="flex items-end gap-1 sm:gap-2">
            <div className="text-2xl sm:text-3xl font-bold text-slate-900 font-mono">{totalInspections || auditedCount}</div>
            <div className="text-[10px] sm:text-xs font-medium text-slate-400 mb-0.5 sm:mb-1">ครั้ง</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200 shadow-xs sm:shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="text-[11px] sm:text-xs font-semibold text-slate-500 mb-0.5 sm:mb-1">Audited Branches</div>
            <InfoPopover 
              title="Audited Branches"
              description="จำนวนสาขาที่ได้รับการตรวจประเมินแล้วอย่างน้อย 1 ครั้ง เทียบกับสาขาทั้งหมด"
            />
          </div>
          <div className="flex items-end gap-1 sm:gap-2">
            <div className="text-2xl sm:text-3xl font-bold text-slate-900 font-mono">{auditedCount}</div>
            <div className="text-[10px] sm:text-xs font-medium text-slate-400 mb-0.5 sm:mb-1">/ {totalBranches} สาขา</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200 shadow-xs sm:shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="text-[11px] sm:text-xs font-semibold text-slate-500 mb-0.5 sm:mb-1">Pass Rate</div>
            <InfoPopover 
              align="left"
              title="Pass Rate"
              description="สัดส่วนเปอร์เซ็นต์ของสาขาที่ได้คะแนนผ่านเกณฑ์มาตรฐาน (ตั้งแต่ 85% ขึ้นไป)"
            />
          </div>
          <div className="flex items-end gap-1 sm:gap-2">
            <div className="text-2xl sm:text-3xl font-bold text-slate-900 font-mono">{parseFloat(Number(passRate).toFixed(2))}%</div>
            <div className="text-[10px] sm:text-xs font-medium text-emerald-600 mb-0.5 sm:mb-1">({passedCount} ผ่าน)</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200 shadow-xs sm:shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="text-[11px] sm:text-xs font-semibold text-slate-500 mb-0.5 sm:mb-1">Pending</div>
            <InfoPopover 
              title="Pending CAP"
              description="จำนวนรายการแผนปฏิบัติการแก้ไข (CAP) ที่ยังรอดำเนินการหรือยังไม่ได้รับการอนุมัติ"
            />
          </div>
          <div className="flex items-end gap-1 sm:gap-2">
            <div className="text-2xl sm:text-3xl font-bold text-rose-600 font-mono">{pendingCapCount}</div>
            <div className="text-[10px] sm:text-xs font-medium text-rose-400 mb-0.5 sm:mb-1">รายการ</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
        <div className="md:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-xs sm:shadow-sm p-4 sm:p-5 flex flex-col items-center justify-center relative min-w-0">
          <h3 className="text-sm font-bold text-slate-700 self-start mb-2">เป้าหมายมาตรฐาน</h3>
          <div className="w-full h-32 sm:h-40 relative flex items-center justify-center">
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
            <div className="absolute top-[68%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
              <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 font-mono">{parseFloat(Number(avgScore).toFixed(2))}%</div>
            </div>
            <div className="absolute top-[35%] right-[12%] sm:right-[15%] flex flex-col items-center pointer-events-none">
              <div className="w-1 h-3 bg-[#0F6659] rounded-full mb-0.5"></div>
              <div className="text-[10px] font-bold text-slate-500">≥85%</div>
            </div>
          </div>
          <div className={`mt-2 px-3 py-1 rounded-full text-xs font-bold ${avgScore >= 85 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
            {avgScore >= 85 ? "✓ บรรลุเป้าหมายมาตรฐาน" : "⚠️ ต่ำกว่าเป้าหมายมาตรฐาน"}
          </div>
          {trendPercent !== null && (
            <div className={`mt-1.5 text-xs font-bold flex items-center justify-center gap-1 ${Number(trendPercent) >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
              <span>{Number(trendPercent) > 0 ? "▲ +" : Number(trendPercent) < 0 ? "▼ " : ""}{trendPercent}%</span>
              <span className="text-[11px] font-normal text-slate-400">เทียบช่วงก่อน</span>
            </div>
          )}
        </div>

        <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs sm:shadow-sm p-4 sm:p-5 flex flex-col min-w-0">
          <h3 className="text-sm font-bold text-slate-700 mb-3 sm:mb-4">แนวโน้มผลประเมิน</h3>
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
                <ReferenceLine y={85} stroke="#0F6659" strokeDasharray="4 4" strokeWidth={2} label={{ value: "Target 85%", position: "insideTopLeft", fill: "#0F6659", fontSize: 12, fontWeight: "bold" }} />
                <Area type="monotone" dataKey="avgScore" name="คะแนนเฉลี่ย" stroke="#0F6659" strokeWidth={3} fillOpacity={1} fill="url(#colorAvg)" activeDot={{ r: 6, fill: "#0F6659", stroke: "#fff", strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className={`grid grid-cols-1 ${!isBranchManager ? "lg:grid-cols-2" : ""} gap-4 sm:gap-5`}>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs sm:shadow-sm p-4 sm:p-5 min-w-0">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="text-sm font-bold text-slate-700">คะแนนรายหมวดหมู่</h3>
            <span className="text-xs font-semibold text-slate-400">Target: {categoryScores[0]?.target || 85}%</span>
          </div>
          <div className="space-y-3.5 sm:space-y-4">
            {categoryScores.map((cat, i) => (
              <div key={i}>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs font-semibold text-slate-700">{getCategoryDisplay(cat.name)}</span>
                  <span className="text-xs font-bold font-mono text-slate-900">{parseFloat(Number(cat.score).toFixed(2))}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden flex relative">
                  <div className={`h-full rounded-full transition-all duration-500 ${cat.score >= (cat.target || 85) ? "bg-[#0F6659]" : "bg-amber-500"}`} style={{ width: `${cat.score}%` }}></div>
                  <div className="absolute top-0 bottom-0 w-0.5 bg-slate-800/20" style={{ left: `${cat.target || 85}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {!isBranchManager && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs sm:shadow-sm p-4 sm:p-5 flex flex-col min-w-0">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h3 className="text-sm font-bold text-slate-700">อันดับสาขา (Top 5)</h3>
            </div>
            <div className="overflow-x-auto flex-1">
              {rankedBranches.length === 0 ? (
                <div className="py-10 text-center flex flex-col items-center justify-center text-slate-400">
                  <BarChart3 size={28} className="text-slate-300 mb-2" />
                  <p className="text-xs font-medium">ไม่มีข้อมูลการตรวจประเมินในช่วงเวลานี้</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="pb-2 text-xs font-semibold text-slate-500 w-12 text-center">อันดับ</th>
                      <th className="pb-2 text-xs font-semibold text-slate-500 px-2">ชื่อสาขา</th>
                      <th className="pb-2 text-xs font-semibold text-slate-500 text-center w-5 sm:w-16 px-3">คะแนน</th>
                      <th className="pb-2 text-xs font-semibold text-slate-500 text-center w-5 sm:w-16 px-3">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankedBranches.map((b, idx) => {
                      const score = b.effectiveScore;
                      return (
                        <tr 
                          key={b.id || idx} 
                          onClick={() => setViewUnit(b)} 
                          className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors cursor-pointer group"
                        >
                          <td className="py-2.5 text-center">
                            <div className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ${idx === 0 ? "bg-amber-100 text-amber-700" : idx === 1 ? "bg-slate-200 text-slate-700" : idx === 2 ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-500"}`}>
                              #{idx + 1}
                            </div>
                          </td>
                          <td className="py-2.5 px-2 text-xs font-bold text-slate-800 group-hover:text-[#0F6659] transition-colors">{b.name}</td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="inline-flex items-center justify-center font-mono font-bold text-sm text-slate-900">
                              {score !== null ? `${parseFloat(Number(score).toFixed(2))}%` : "-"}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {score !== null ? (
                              <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold inline-block shadow-2xs ${score >= 85 ? "bg-emerald-100 text-[#0F6659]" : "bg-amber-100 text-amber-800"}`}>
                                {score >= 85 ? "ผ่าน" : "ปรับปรุง"}
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-medium inline-block bg-slate-100 text-slate-500">
                                ยังไม่ตรวจ
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <Sparkles size={16} className="text-[#0F6659]" /> AI Insights
            </h3>
            {justUpdated && (
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 animate-in fade-in flex items-center gap-1 shadow-2xs">
                <CheckCircle2 size={12} className="text-emerald-600" /> อัปเดตข้อมูล
              </span>
            )}
          </div>
          <button
            onClick={() => fetchAiDashboardInsights(true)}
            disabled={isAiLoading || aiCooldown > 0}
            className={`px-3 py-1.5 rounded-2xl border text-xs font-bold shadow-2xs transition-all flex items-center gap-2 ${
              isAiLoading || aiCooldown > 0
                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                : 'bg-[#0F6659] hover:bg-emerald-800 text-white border-[#0F6659] cursor-pointer active:scale-95'
            }`}
          >
            <Sparkles size={14} className={isAiLoading ? "animate-spin text-white" : aiCooldown > 0 ? "text-slate-400" : "text-emerald-200"} />
            <span>{isAiLoading ? "กำลังวิเคราะห์..." : aiCooldown > 0 ? `รอ ${aiCooldown} วิ` : "วิเคราะห์ด้วย AI"}</span>
          </button>
        </div>

        {isAiLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Skeleton 1: จุดเด่น */}
            <div className="rounded-2xl p-4 shadow-sm border border-emerald-200/80 bg-emerald-50/40 animate-pulse flex flex-col gap-2.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-200/90 shrink-0" />
                <div className="h-3.5 w-28 rounded-md bg-emerald-200/90" />
              </div>
              <div className="space-y-1.5 pt-1">
                <div className="h-3 w-full rounded bg-emerald-200/50" />
                <div className="h-3 w-4/5 rounded bg-emerald-200/40" />
                <div className="h-3 w-2/3 rounded bg-emerald-200/30" />
              </div>
            </div>

            {/* Skeleton 2: จุดเฝ้าระวัง */}
            <div className="rounded-2xl p-4 shadow-sm border border-amber-200/80 bg-amber-50/40 animate-pulse flex flex-col gap-2.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-amber-200/90 shrink-0" />
                <div className="h-3.5 w-28 rounded-md bg-amber-200/90" />
              </div>
              <div className="space-y-1.5 pt-1">
                <div className="h-3 w-full rounded bg-amber-200/50" />
                <div className="h-3 w-4/5 rounded bg-amber-200/40" />
                <div className="h-3 w-2/3 rounded bg-amber-200/30" />
              </div>
            </div>

            {/* Skeleton 3: ข้อเสนอแนะ */}
            <div className="rounded-2xl p-4 shadow-sm border border-teal-200/80 bg-teal-50/40 animate-pulse flex flex-col gap-2.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-teal-200/90 shrink-0" />
                <div className="h-3.5 w-28 rounded-md bg-teal-200/90" />
              </div>
              <div className="space-y-1.5 pt-1">
                <div className="h-3 w-full rounded bg-teal-200/50" />
                <div className="h-3 w-4/5 rounded bg-teal-200/40" />
                <div className="h-3 w-2/3 rounded bg-teal-200/30" />
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {aiInsightsList.map((ins) => (
              <div
                key={ins.type}
                className={`rounded-2xl p-4 shadow-sm border flex flex-col gap-2 transition-all duration-300 ${ins.bgClass}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{ins.icon}</span>
                  <span className={`text-xs font-bold ${ins.iconClass}`}>{ins.title}</span>
                </div>
                <p className="text-xs font-medium leading-relaxed text-slate-700">{ins.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {showExportModal && <ExcelExportModal onClose={() => setShowExportModal(false)} />}
      {showMonthlyModal && <MonthlyMeetingReportModal onClose={() => setShowMonthlyModal(false)} />}
    </div>
  );
}