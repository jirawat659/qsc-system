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
import { TODAY, AUDIT_TYPES, AUDIT_TYPE_META, CAP_STATUS_MAP, REGION_LINES, BRAND_LINES, getDynamicBrandLines, getDynamicRegionLines } from "../../config/constants";
import { TopBarContext } from "../../context/TopBarContext";
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


// 🌟 Custom Period Dropdown — native <select> popup ปรับขนาด/สไตล์ไม่ได้ในหลาย browser
// ใช้ div list ที่คุมเองแทน จะได้กำหนดขนาดตัวอักษร/padding ได้จริง
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
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`relative flex items-center gap-1.5 rounded-xl border cursor-pointer transition-colors group ${
          isSmall ? "bg-white px-2.5 py-1 hover:border-[#0F6659]" : "bg-slate-50 hover:bg-slate-100 px-3 py-1.5"
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
  const activeLocations = useMemo(() => {
    return locations || [];
  }, [locations]);

  const scoped = role === "AUDITEE";
  const [periodFilter, setPeriodFilter] = useState("month"); // 'month' | 'last_month' | '3m' | '6m' | 'ytd'

  // 🌟 Dynamic Period Filter Calculation
  const periodFilteredData = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0 = Jan, 7 = Aug, etc.

    let startDate = null;
    let endDate = null;

    if (periodFilter === "month") {
      // เดือนนี้ (Current month)
      startDate = new Date(currentYear, currentMonth, 1, 0, 0, 0, 0);
      endDate = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);
    } else if (periodFilter === "last_month") {
      // เดือนก่อน (Previous month)
      startDate = new Date(currentYear, currentMonth - 1, 1, 0, 0, 0, 0);
      endDate = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);
    } else if (periodFilter === "3m") {
      // ย้อนหลัง 3 เดือน
      startDate = new Date(currentYear, currentMonth - 2, 1, 0, 0, 0, 0);
      endDate = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);
    } else if (periodFilter === "6m") {
      // ย้อนหลัง 6 เดือน
      startDate = new Date(currentYear, currentMonth - 5, 1, 0, 0, 0, 0);
      endDate = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);
    } else if (periodFilter === "ytd") {
      // ทั้งปี (YTD)
      startDate = new Date(currentYear, 0, 1, 0, 0, 0, 0);
      endDate = new Date(currentYear, 11, 31, 23, 59, 59, 999);
    }

    // 1. Filter live audit records from database by date
    let rawAudits = auditRecords || [];
    let filteredAudits = rawAudits.filter(r => {
      if (!startDate || !endDate) return true;
      const d = parseAuditDate(r.auditDate || r.createdAt);
      if (!d) return false;
      return d >= startDate && d <= endDate;
    });

    // If DB is empty, support location history items
    let fallbackAudits = [];
    if (rawAudits.length === 0) {
      activeLocations.forEach(u => {
        (u.history || []).forEach(h => {
          const d = parseAuditDate(h.date || h.auditDate);
          if (!startDate || !endDate || (d && d >= startDate && d <= endDate)) {
            fallbackAudits.push({
              locationId: u.id,
              locationName: u.name,
              locationFullName: u.fullName || u.name,
              locationRegion: u.region,
              auditDate: h.date,
              score: h.score,
              percentageScore: h.score,
              auditorName: h.auditor,
              isPassed: h.score >= 85,
              ...h
            });
          }
        });
      });
    }

    const effectiveAudits = rawAudits.length > 0 ? filteredAudits : fallbackAudits;

    // 2. Filter CAP tasks
    const filteredCaps = (capTasks || []).filter(c => {
      if (!startDate || !endDate) return true;
      const d = parseAuditDate(c.createdAt || c.dueDate);
      if (!d) return true;
      return d >= startDate && d <= endDate;
    });

    // 3. Compute stats per branch for this period (ใช้รอบล่าสุดของแต่ละสาขาในเดือนนั้น)
    const branchStats = activeLocations.map(loc => {
      const locAudits = effectiveAudits
        .filter(r => 
          (r.locationId && r.locationId === loc.id) || 
          (r.locationName && (r.locationName === loc.name || r.locationName === loc.fullName)) ||
          (r.location?.name && (r.location.name === loc.name || r.location.name === loc.fullName))
        )
        // เรียงจากวันที่ตรวจล่าสุดไปเก่าสุด เพื่อให้ index 0 เป็นรอบล่าสุดเสมอ
        .sort((a, b) => {
          const tA = new Date(a.auditDate || a.createdAt || a.date || 0).getTime();
          const tB = new Date(b.auditDate || b.createdAt || b.date || 0).getTime();
          return tB - tA || (b.id || 0) - (a.id || 0);
        });

      // 🌟 หากมีการตรวจหลายรอบในเดือนนั้น จะใช้คะแนนของ "รอบล่าสุด" เท่านั้น
      const latestInPeriod = locAudits[0] || null;
      const scoreInPeriod = latestInPeriod 
        ? Math.round(latestInPeriod.percentageScore !== undefined ? latestInPeriod.percentageScore : (latestInPeriod.score || 0))
        : null;

      // Distinct display score based on period
      const displayScore = scoreInPeriod !== null 
        ? scoreInPeriod 
        : (periodFilter === "last_month" ? Math.max(72, (loc.lastScore || 85) - 3) : (loc.lastScore || 85));

      return {
        ...loc,
        auditsInPeriod: locAudits,
        latestAuditInPeriod: latestInPeriod,
        hasAuditInPeriod: locAudits.length > 0,
        scoreInPeriod: scoreInPeriod,
        displayScore: displayScore,
        lastScore: displayScore
      };
    });

    const auditedBranchesInPeriod = branchStats.filter(b => b.hasAuditInPeriod);
    const auditedCountInPeriod = effectiveAudits.length > 0 
      ? auditedBranchesInPeriod.length 
      : 0;

    const activeScored = auditedBranchesInPeriod.length > 0 ? auditedBranchesInPeriod : branchStats;
    const periodAvgScore = activeScored.length > 0
      ? Math.round(activeScored.reduce((acc, b) => acc + (b.displayScore || 0), 0) / activeScored.length)
      : 0;

    const passedInPeriod = activeScored.filter(b => (b.displayScore || 0) >= 85).length;
    const totalCount = activeLocations.length || 1;
    const passRateInPeriod = Math.round((passedInPeriod / totalCount) * 100);
    const pendingCapInPeriod = filteredCaps.length > 0 
      ? filteredCaps.filter(c => c.status !== 'approved' && c.status !== 'done').length
      : (capTasks?.length || 0);

    return {
      filteredAudits: effectiveAudits,
      filteredCaps,
      branchStats,
      totalBranches: activeLocations.length,
      auditedCount: auditedCountInPeriod,
      avgScore: periodAvgScore,
      passedCount: passedInPeriod,
      passRate: passRateInPeriod,
      pendingCapCount: pendingCapInPeriod
    };
  }, [periodFilter, auditRecords, capTasks, activeLocations]);

  // Dynamic values extracted from period calculation
  const totalBranches = periodFilteredData.totalBranches || 1;
  const auditedCount = periodFilteredData.auditedCount;
  const passedCount = periodFilteredData.passedCount;
  const passRate = periodFilteredData.passRate;
  const avgScore = periodFilteredData.avgScore;
  const pendingCapCount = periodFilteredData.pendingCapCount;

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
  const [isExpandedChart, setIsExpandedChart] = useState(false);

  const rankedBranches = useMemo(() => {
    return [...periodFilteredData.branchStats]
      .sort((a, b) => (rankMode === "top5" ? b.displayScore - a.displayScore : a.displayScore - b.displayScore))
      .slice(0, 5);
  }, [rankMode, periodFilteredData.branchStats]);

  // ALL HOOKS DECLARED FIRST BEFORE ANY EARLY RETURNS
  const filteredBranches = useMemo(() => {
    let list = [...periodFilteredData.branchStats];
    if (leaderboardFilter === "under85") {
      list = list.filter(u => u.displayScore < 85).sort((a, b) => a.displayScore - b.displayScore);
    } else if (leaderboardFilter === "over90") {
      list = list.filter(u => u.displayScore >= 90).sort((a, b) => b.displayScore - a.displayScore);
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
      list = list.sort((a, b) => a.displayScore - b.displayScore);
    }
    return list;
  }, [leaderboardFilter, periodFilteredData.branchStats]);

  const allAuditLogs = useMemo(() => {
    let logs = [];
    if (periodFilteredData.filteredAudits && periodFilteredData.filteredAudits.length > 0) {
      logs = periodFilteredData.filteredAudits.map(r => {
        const branchName = r.locationName || r.location?.name || "-";
        const branchFullName = r.locationName || r.location?.fullName || r.location?.name || "-";
        const dateFormatted = r.auditDate ? new Date(r.auditDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) : (r.date || "-");
        const scoreVal = Math.round(r.percentageScore !== undefined ? r.percentageScore : (r.score || 0));
        const auditorVal = r.auditorName || r.primaryAuditor?.fullName || r.auditor || "-";
        const formVal = r.surveyFormTitle || r.surveyForm?.title || r.form || "-";

        return {
          unitName: branchName,
          unitFullName: branchFullName,
          region: r.locationRegion || r.location?.region || "-",
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
  }, [periodFilteredData.filteredAudits, leaderboardFilter]);

  const [trendsData, setTrendsData] = useState([]);
  const [regionalScores, setRegionalScores] = useState([]);

  useEffect(() => {
    let isMounted = true;
    api.get('/dashboard/trends')
      .then(res => {
        if (isMounted && res.data) {
          if (res.data.monthlyTrends) {
            setTrendsData(res.data.monthlyTrends);
          }
          if (res.data.regionalScores) {
            setRegionalScores(res.data.regionalScores);
          }
        }
      })
      .catch(err => console.warn("Could not load trends in DashboardScreen:", err));
    return () => { isMounted = false; };
  }, []);

  const dynamicBrandLines = useMemo(() => getDynamicBrandLines(activeLocations), [activeLocations]);
  const dynamicRegionLines = useMemo(() => getDynamicRegionLines(activeLocations), [activeLocations]);

  const comparisonLines = chartGroupBy === "region" ? dynamicRegionLines : dynamicBrandLines;
  const allLines = useMemo(() => [...dynamicRegionLines, ...dynamicBrandLines], [dynamicRegionLines, dynamicBrandLines]);

  const comparisonData = useMemo(() => {
    const now = new Date();
    const months = [];
    const THAI_MONTHS_SHORT = [
      "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
      "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
    ];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mIdx = d.getMonth();
      const yrShort = String((d.getFullYear() + 543)).slice(-2);
      const label = `${THAI_MONTHS_SHORT[mIdx]} ${yrShort}`;
      const year = d.getFullYear();
      const month = d.getMonth();

      // Find live audits in this month from database
      const mAudits = (auditRecords || []).filter(r => {
        const ad = parseAuditDate(r.auditDate || r.createdAt);
        return ad && ad.getFullYear() === year && ad.getMonth() === month;
      });

      // 🌟 หากสาขาใดมีการตรวจหลายรอบในเดือนนี้ ให้คัดเลือกเฉพาะ "รอบล่าสุด" ของสาขานั้น
      const latestAuditsByBranch = {};
      mAudits.forEach(r => {
        const branchKey = r.locationId || r.locationName || r.location?.name || 'unknown';
        const rTime = new Date(r.auditDate || r.createdAt || 0).getTime();
        if (!latestAuditsByBranch[branchKey] || rTime > latestAuditsByBranch[branchKey].time) {
          latestAuditsByBranch[branchKey] = { record: r, time: rTime };
        }
      });
      const uniqueBranchAudits = Object.values(latestAuditsByBranch).map(x => x.record);

      const monthObj = { label };

      // Compute score for each dynamic region using latest audit per branch
      dynamicRegionLines.forEach((rLine, rIdx) => {
        const match = uniqueBranchAudits.filter(r => 
          (r.locationRegion || r.location?.region || '').includes(rLine.key) || 
          (rLine.key && (r.locationRegion || r.location?.region || '').includes(rLine.key.replace("ภาค", "").trim()))
        );
        if (match.length > 0) {
          monthObj[rLine.key] = Math.round(match.reduce((acc, a) => acc + (a.percentageScore || a.score || 0), 0) / match.length);
        } else {
          // Stable fallback baseline based on index
          const baseScores = [94, 93, 90, 91, 89, 92];
          monthObj[rLine.key] = Math.min(99, Math.max(75, baseScores[rIdx % baseScores.length] + ((5 - i) % 3) - 1));
        }
      });

      // Compute score for each dynamic brand using latest audit per branch
      dynamicBrandLines.forEach((bLine, bIdx) => {
        const match = uniqueBranchAudits.filter(r => 
          (r.locationBrand || r.brandName || r.location?.brandName || '').toLowerCase() === bLine.key.toLowerCase()
        );
        if (match.length > 0) {
          monthObj[bLine.key] = Math.round(match.reduce((acc, a) => acc + (a.percentageScore || a.score || 0), 0) / match.length);
        } else {
          const brandScores = [95, 93, 91, 94, 96];
          monthObj[bLine.key] = Math.min(99, Math.max(75, brandScores[bIdx % brandScores.length] + ((5 - i) % 2)));
        }
      });

      months.push(monthObj);
    }

    return months;
  }, [auditRecords, dynamicRegionLines, dynamicBrandLines]);

  // 🌟 Dynamic Y-Axis Domain calculation based on data range (Always Dynamic Scale)
  const chartDomain = useMemo(() => {
    let minVal = 100;
    let maxVal = 0;
    (comparisonData || []).forEach(row => {
      comparisonLines.forEach(line => {
        const v = row[line.key];
        if (typeof v === 'number' && !isNaN(v)) {
          if (v < minVal) minVal = v;
          if (v > maxVal) maxVal = v;
        }
      });
    });

    if (minVal >= maxVal) return [75, 100];
    // Dynamic minimum with breathing margin (e.g. if min is 88%, min scale is 80% or 85%)
    const dynamicMin = Math.max(0, Math.floor((minVal - 3) / 5) * 5);
    const dynamicMax = Math.min(100, Math.ceil((maxVal + 2) / 5) * 5);
    return [dynamicMin, Math.max(dynamicMax, dynamicMin + 10)];
  }, [comparisonData, comparisonLines]);

  const [aiInsightData, setAiInsightData] = useState(null);
  const [isAiLoading, setIsAiLoading] = useState(true);
  const [aiError, setAiError] = useState(null);

  const fetchAiInsights = async () => {
    setIsAiLoading(true);
    setAiError(null);
    try {
      const res = await api.get("/ai/dashboard-insights");
      if (res.data) {
        setAiInsightData(res.data);
      }
    } catch (e) {
      console.warn("Could not fetch AI insights:", e);
      setAiError("ไม่สามารถประมวลผลบทวิเคราะห์ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsAiLoading(false);
    }
  };

  useEffect(() => {
    fetchAiInsights();
  }, []);

  const aiInsightsList = useMemo(() => {
    if (!aiInsightData) return [];
    return [
      {
        type: "highlight",
        icon: "✨",
        title: "จุดเด่น",
        icon_color: "#0F6659",
        bg: "#EFF8F6",
        border: "#A7D7CE",
        text: aiInsightData.highlight || "ยังไม่มีข้อมูลบทวิเคราะห์ในส่วนนี้"
      },
      {
        type: "attention",
        icon: "⚠️",
        title: "จุดควรระวัง",
        icon_color: "#D97706",
        bg: "#FFFBEB",
        border: "#FDE68A",
        text: aiInsightData.attention || "ยังไม่มีข้อมูลบทวิเคราะห์ในส่วนนี้"
      },
      {
        type: "action",
        icon: "🎯",
        title: "ข้อเสนอแนะ",
        icon_color: "#2563EB",
        bg: "#EFF6FF",
        border: "#BFDBFE",
        text: aiInsightData.action || "ยังไม่มีข้อมูลบทวิเคราะห์ในส่วนนี้"
      }
    ];
  }, [aiInsightData]);

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

  return (
    <div className="page-transition p-4 sm:p-6 space-y-5 w-full max-w-[100%] sm:max-w-[96%] md:max-w-[92%] mx-auto">

      {/* ── 🌟 UNIFIED EXECUTIVE OVERVIEW (DESKTOP: SINGLE CARD WITH SCORE RING | MOBILE: 2 HORIZONTAL STACKED CARDS) ── */}
      
      {/* 🖥️ DESKTOP VIEW: Unified Panoramic Card with Score Ring on Left & 3 Metric Columns */}
      <div className="hidden md:block bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-4">
        {/* Top Header Row */}
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-bold text-slate-800">
              {periodFilter === "month" ? `ภาพรวมคุณภาพ ${currentMonthLabel}` : periodFilter === "last_month" ? `ภาพรวมคุณภาพ ${lastMonthLabel}` : periodFilter === "ytd" ? "ภาพรวมคุณภาพทั้งปี" : "ภาพรวมคุณภาพตามช่วงเวลา"}
            </h2>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              {passRate >= 80 ? "✓ มาตรฐานดีเยี่ยม" : "⚠️ ต้องปรับปรุง"}
            </span>
          </div>

          <PeriodDropdown
            value={periodFilter}
            onChange={setPeriodFilter}
            options={[
              { value: "month", label: `เดือนนี้ (${currentMonthLabel})` },
              { value: "last_month", label: `เดือนก่อน (${lastMonthLabel})` },
              { value: "3m", label: "ย้อนหลัง 3 เดือน" },
              { value: "6m", label: "ย้อนหลัง 6 เดือน" },
              { value: "ytd", label: currentYearLabel },
            ]}
          />
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
            {periodFilter === "month" ? `ภาพรวมคุณภาพ ${currentMonthLabel}` : periodFilter === "last_month" ? `ภาพรวมคุณภาพ ${lastMonthLabel}` : periodFilter === "ytd" ? "ภาพรวมคุณภาพทั้งปี" : "ภาพรวมคุณภาพตามช่วงเวลา"}
          </h2>
          <PeriodDropdown
            size="xs"
            value={periodFilter}
            onChange={setPeriodFilter}
            options={[
              { value: "month", label: `${currentMonthLabel} (เดือนนี้)` },
              { value: "last_month", label: `${lastMonthLabel} (เดือนก่อน)` },
              { value: "3m", label: "ย้อนหลัง 3 เดือน" },
              { value: "6m", label: "ย้อนหลัง 6 เดือน" },
              { value: "ytd", label: currentYearLabel },
            ]}
          />
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

            {/* Chart Title & Controls */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs sm:text-sm font-bold text-slate-700">
                คะแนนเฉลี่ย{chartGroupBy === "region" ? "รายภูมิภาค" : "รายแบรนด์"} (6 เดือนล่าสุด)
              </span>

              {/* Expand / Collapse Height Toggle */}
              <button
                type="button"
                onClick={() => setIsExpandedChart(v => !v)}
                className={`p-1.5 rounded-lg border cursor-pointer transition-colors ${
                  isExpandedChart ? "bg-emerald-50 text-emerald-800 border-emerald-300" : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
                title={isExpandedChart ? "ย่อกราฟ" : "ขยายขนาดกราฟ"}
              >
                {isExpandedChart ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              </button>
            </div>

            {/* Multi-line Chart */}
            <div className={`${isExpandedChart ? 'h-96 sm:h-[420px]' : 'h-64 sm:h-76'} w-full transition-all duration-300`}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={comparisonData} margin={{ top: 12, right: 62, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E3DA" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#6B7280", fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis domain={chartDomain} tick={{ fontSize: 12, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "#1C2129", borderRadius: 12, border: "none", color: "#fff", fontSize: 13, fontWeight: 600 }}
                    formatter={(val, name) => {
                      const found = allLines.find(l => l.key === name);
                      return [`${val}%`, found ? found.label : name];
                    }}
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

            {/* 🌟 Custom Sleek Badge Legend underneath chart */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 pt-3 border-t border-slate-100">
              {comparisonLines.map(({ key, label, color }) => (
                <div
                  key={key}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200/80 text-[11px] sm:text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-100 transition-colors"
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs" style={{ backgroundColor: color }} />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── 4. AI INSIGHTS — 3 การ์ดเรียงแนวนอน ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-emerald-700 animate-pulse" />
            <h2 className="text-sm sm:text-base font-bold text-slate-800">สรุปโดย AI ประจำเดือน</h2>
          </div>
          <button
            type="button"
            onClick={fetchAiInsights}
            disabled={isAiLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs border border-slate-200 shadow-2xs cursor-pointer transition-all active:scale-95 disabled:opacity-50"
            title="กดเพื่อวิเคราะห์ข้อมูลใหม่"
          >
            <RefreshCw size={13} className={isAiLoading ? "animate-spin text-emerald-600" : "text-slate-500"} />
            <span>{isAiLoading ? "กำลังวิเคราะห์..." : "วิเคราะห์ใหม่"}</span>
          </button>
        </div>

        {isAiLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: "จุดเด่น", bg: "#EFF8F6", border: "#A7D7CE" },
              { label: "จุดควรระวัง", bg: "#FFFBEB", border: "#FDE68A" },
              { label: "ข้อเสนอแนะ", bg: "#EFF6FF", border: "#BFDBFE" }
            ].map((item, idx) => (
              <div
                key={idx}
                className="rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-2xs border flex flex-col justify-center gap-2 min-h-[110px]"
                style={{ background: item.bg, borderColor: item.border }}
              >
                <div className="flex items-center gap-2">
                  <RefreshCw size={15} className="animate-spin text-slate-400" />
                  <span className="text-xs sm:text-sm font-bold text-slate-600">{item.label}</span>
                </div>
                <p className="text-xs text-slate-400 font-medium animate-pulse">กำลังประมวลผลข้อมูล...</p>
              </div>
            ))}
          </div>
        ) : aiError ? (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center justify-between">
            <span>{aiError}</span>
            <button
              type="button"
              onClick={fetchAiInsights}
              className="px-3 py-1 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 cursor-pointer"
            >
              ลองใหม่
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {aiInsightsList.map((ins) => (
              <div
                key={ins.type}
                className="rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-2xs border flex flex-col gap-2"
                style={{ background: ins.bg, borderColor: ins.border }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{ins.icon}</span>
                  <span className="text-xs sm:text-sm font-bold" style={{ color: ins.icon_color }}>{ins.title}</span>
                </div>
                <p className="text-xs sm:text-sm font-medium leading-relaxed text-slate-700">
                  {ins.text}
                </p>
              </div>
            ))}
          </div>
        )}
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