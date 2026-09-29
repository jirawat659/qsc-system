import React, { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, CheckCircle2, X, Search, Filter, AlertTriangle, Download, Wrench, ArrowUpDown, Calendar } from "lucide-react";


import { c, sans, mono, cardStyle } from "../../config/theme";
import { ROLES, NAV_BY_ROLE } from "../../config/roles";
import { TODAY, AUDIT_TYPES, AUDIT_TYPE_META, CAP_STATUS_MAP, REGION_LINES, BRAND_LINES } from "../../config/constants";
import { TopBarContext } from "../../context/TopBarContext";
import { DataContext } from "../../context/DataContext";
import { exportToExcel } from "../../utils/exportToExcel";
import api from "../../config/api";

import ModalWrapper from "../../shared/ModalWrapper";
import Header from "../../shared/Header";
import Section from "../../shared/Section";
import ScoreRing from "../../shared/ScoreRing";
import HistoryList from "../../shared/HistoryList";
import ErrorBoundary from "../../shared/ErrorBoundary";
import ExcelExportModal from "../../modals/ExcelExportModal";

// ---------- เกณฑ์และตัวช่วยสรุปสถานะรายสาขา ----------
const PASS_SCORE = 85;      // ผ่านเกณฑ์
const WARN_SCORE = 70;      // ต่ำกว่านี้ = วิกฤต
const STALE_DAYS = 90;      // ไม่ได้ตรวจเกินกี่วันถือว่า "ตกรอบ"

// สาขาที่ยังไม่เคยมีผลตรวจ: Locations.LastAuditDate = null และ LastScore = 0
// (ห้ามนับเป็น "วิกฤต" เพราะคะแนน 0 ไม่ใช่คะแนนจริง)
const hasAudit = (u) => !!u?.lastAuditDate;

// ---------- รอบเดือน (เทียบตามเวลาไทย UTC+7) ----------
const bkkParts = (d) => {
  const x = new Date(new Date(d).getTime() + 7 * 3600000);
  return { y: x.getUTCFullYear(), m: x.getUTCMonth(), day: x.getUTCDate() };
};

// ตรวจแล้วในเดือนปัจจุบันหรือยัง (ถ้ายัง = ยังไม่นับคะแนน แสดงเป็น "-")
const isAuditedThisMonth = (u) => {
  if (!hasAudit(u)) return false;
  if (Number.isNaN(new Date(u.lastAuditDate).getTime())) return false;
  const a = bkkParts(u.lastAuditDate);
  const n = bkkParts(Date.now());
  return a.y === n.y && a.m === n.m;
};

// สถานะรายสาขา: คิดคะแนนเฉพาะที่ตรวจในเดือนนี้ ที่เหลือ = "pending" (รอตรวจเดือนนี้)
const getBranchStatus = (u) => {
  if (!isAuditedThisMonth(u)) return "pending";
  const sc = Number(u.lastScore) || 0;
  return sc >= PASS_SCORE ? "passed" : sc >= WARN_SCORE ? "improve" : "critical";
};

const fmtDate = (d) =>
  new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit", timeZone: "Asia/Bangkok" });

// ชื่อสาขาแบบ [รหัสย่อ] · [ชื่อเต็ม] (ถ้าไม่มีรหัสแสดงเฉพาะชื่อ)
const BranchTitle = ({ u }) => (
  <>
    {u.code && (
      <>
        <span className="font-mono font-medium text-slate-400">{u.code}</span>
        <span className="font-normal text-slate-300"> · </span>
      </>
    )}
    {u.name}
  </>
);

// สีของวงกลมคะแนน / ป้ายสถานะ (ใช้ร่วมกันทั้งตารางและการ์ดมือถือ)
const STATUS_STYLE = {
  passed:   { circle: "border-emerald-600 text-emerald-800", badge: "bg-emerald-100 text-emerald-800", text: "ผ่านเกณฑ์" },
  improve:  { circle: "border-amber-600 text-amber-800",     badge: "bg-amber-100 text-amber-900",     text: "ต้องปรับปรุง" },
  critical: { circle: "border-rose-600 text-rose-700",       badge: "bg-rose-100 text-rose-800",       text: "วิกฤต" },
  pending:  { circle: "border-slate-300 text-slate-400",     badge: "bg-slate-100 text-slate-600",     text: "รอตรวจเดือนนี้" },
};

const daysSinceAudit = (u) => {
  if (!hasAudit(u)) return null;
  const t = new Date(u.lastAuditDate).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86400000);
};

const isStaleBranch = (u) => {
  const d = daysSinceAudit(u);
  return d !== null && d > STALE_DAYS;
};

const STATUS_SEGMENTS = [
  { key: "passed",    label: "ผ่านเกณฑ์",     hint: `≥${PASS_SCORE}%`,               bar: "bg-[#0F6659]", dot: "bg-[#0F6659]", activeCls: "border-[#0F6659] ring-2 ring-emerald-500/40" },
  { key: "improve",   label: "ต้องปรับปรุง",  hint: `${WARN_SCORE}-${PASS_SCORE - 1}%`, bar: "bg-amber-500", dot: "bg-amber-500", activeCls: "border-amber-600 ring-2 ring-amber-400/50" },
  { key: "critical",  label: "วิกฤต",         hint: `<${WARN_SCORE}%`,               bar: "bg-rose-600",  dot: "bg-rose-600",  activeCls: "border-rose-600 ring-2 ring-rose-400/50" },
  { key: "pending",   label: "รอตรวจเดือนนี้", hint: "ยังไม่มีผล",                   bar: "bg-slate-300", dot: "bg-slate-400", activeCls: "border-slate-500 ring-2 ring-slate-300" },
];

export default function AllBranchesScreen({ onBack, onSelectUnit, onExportExcel }) {
  const { locations: visibleLocations, capTasks } = React.useContext(DataContext);
  // ตัดสาขาที่ปิดกิจการ (isActive = false) ออกจากทั้งตารางและตัวเลขสรุป
  const activeLocations = useMemo(
    () => (visibleLocations || []).filter(l => l.isActive !== false),
    [visibleLocations]
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [sortBy, setSortBy] = useState("score-desc"); // 'score-desc' | 'score-asc' | 'name' | 'date'
  const [currentPage, setCurrentPage] = useState(1);
  const [showExportModal, setShowExportModal] = useState(false);
  // งาน CAP ที่ยังค้าง (OPEN + REJECTED) — ดึงตรงจาก /cap เพราะ capTasks ใน context เป็นแค่ buffer บางส่วน
  const [capRaw, setCapRaw] = useState({ loading: true, tasks: [] });
  const pageSize = 10;

  // Reset page to 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterCategory, sortBy]);

  // ดึง CAP ค้างดำเนินการ (สถานะ OPEN / REJECTED) ทุกหน้า แล้วเก็บเฉพาะ locationId + วันกำหนดส่ง
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const tasks = [];
        for (const status of ["OPEN", "REJECTED"]) {
          for (let page = 1; page <= 10; page++) {
            const res = await api.get("/cap", { params: { status, page, pageSize: 100 } });
            const data = res.data;
            const items = Array.isArray(data) ? data : (data?.items || []);
            items.forEach(t => tasks.push({ locationId: t.locationId, deadline: t.submissionDeadline }));
            if (Array.isArray(data) || items.length < 100) break;
          }
        }
        if (!cancelled) setCapRaw({ loading: false, tasks });
      } catch (e) {
        if (!cancelled) setCapRaw({ loading: false, tasks: [] });
      }
    };
    load();
    return () => { cancelled = true; };
  }, [capTasks?.length]);

  // สรุป CAP เฉพาะสาขาที่แสดงอยู่ในหน้านี้
  const capStats = useMemo(() => {
    const visibleIds = new Set(activeLocations.map(l => l.id));
    const now = Date.now();
    const mine = capRaw.tasks.filter(t => visibleIds.has(t.locationId));
    const overdue = mine.filter(t => t.deadline && new Date(t.deadline).getTime() < now).length;
    const overdueByLoc = new Map();
    mine.forEach(t => {
      if (t.deadline && new Date(t.deadline).getTime() < now) {
        overdueByLoc.set(t.locationId, (overdueByLoc.get(t.locationId) || 0) + 1);
      }
    });
    return {
      loading: capRaw.loading,
      open: mine.length,
      overdue,
      overdueByLoc,
      locationIds: new Set(mine.map(t => t.locationId)),
    };
  }, [capRaw, activeLocations]);

  const filteredAndSorted = useMemo(() => {
    let list = [...activeLocations];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(u => {
        const matchName = u.name?.toLowerCase().includes(q);
        const matchFullName = u.fullName?.toLowerCase().includes(q);
        const matchCode = u.code?.toLowerCase().includes(q);
        const matchRegion = u.region?.toLowerCase().includes(q);
        const matchAuditor = u.history && u.history[0]?.auditor?.toLowerCase().includes(q);
        const matchBrand = (u.locationBrands || []).some(lb =>
          (lb.brand?.name || lb.brandName || "").toLowerCase().includes(q) ||
          (lb.brand?.code || lb.brandCode || "").toLowerCase().includes(q)
        ) || (u.brand?.name || u.brandName || "").toLowerCase().includes(q) || (u.brand?.code || "").toLowerCase().includes(q);
        const matchType = (
          u.locationType?.name ||
          u.locationType?.code ||
          (typeof u.locationType === 'string' ? u.locationType : '')
        ).toLowerCase().includes(q);

        return matchName || matchFullName || matchCode || matchRegion || matchAuditor || matchBrand || matchType;
      });
    }

    if (["passed", "improve", "critical", "pending"].includes(filterCategory)) {
      list = list.filter(u => getBranchStatus(u) === filterCategory);
    } else if (filterCategory === "stale") {
      list = list.filter(isStaleBranch);
    } else if (filterCategory === "cap") {
      list = list.filter(u => capStats.locationIds.has(u.id));
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
    } else if (sortBy === "score-desc" || sortBy === "score-asc") {
      // สาขาที่ยังไม่ตรวจเดือนนี้ (แสดง "-") อยู่ท้ายเสมอ
      const dir = sortBy === "score-desc" ? -1 : 1;
      list.sort((a, b) => {
        const pa = !isAuditedThisMonth(a), pb = !isAuditedThisMonth(b);
        if (pa !== pb) return pa ? 1 : -1;
        return dir * ((Number(a.lastScore) || 0) - (Number(b.lastScore) || 0));
      });
    } else if (sortBy === "name") {
      list.sort((a, b) => a.name.localeCompare(b.name, "th"));
    } else if (sortBy === "date") {
      const ts = (u) => (u.lastAuditDate ? new Date(u.lastAuditDate).getTime() || 0 : 0);
      list.sort((a, b) => ts(b) - ts(a));
    }

    return list;
  }, [activeLocations, capStats, searchTerm, filterCategory, sortBy]);

  const totalCount = filteredAndSorted.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedUnits = filteredAndSorted.slice(startIndex, startIndex + pageSize);
  const startItem = totalCount === 0 ? 0 : startIndex + 1;
  const endItem = Math.min(startIndex + pageSize, totalCount);

  // ---------- ตัวเลขสรุปเหนือตาราง ----------
  const summary = useMemo(() => {
    const counts = { passed: 0, improve: 0, critical: 0, pending: 0 };
    let scoreSum = 0, audited = 0, stale = 0, neverAudited = 0;
    for (const u of activeLocations) {
      const st = getBranchStatus(u);
      counts[st] += 1;
      if (st !== "pending") {
        audited += 1; // ตรวจแล้วในเดือนนี้
        scoreSum += Number(u.lastScore) || 0;
      }
      if (!hasAudit(u)) neverAudited += 1;
      else if (isStaleBranch(u)) stale += 1;
    }
    return {
      total: activeLocations.length,
      counts, audited, stale, neverAudited,
      avg: audited > 0 ? scoreSum / audited : null,
    };
  }, [activeLocations]);

  const toggleFilter = (key) => setFilterCategory(prev => (prev === key ? "all" : key));

  const avgText = summary.avg === null ? "-" : `${parseFloat(summary.avg.toFixed(1))}%`;
  const avgTone = summary.avg === null ? "none" : summary.avg >= PASS_SCORE ? "good" : summary.avg >= WARN_SCORE ? "warn" : "bad";
  const ringBorder = { good: "border-[#0F6659]", warn: "border-amber-500", bad: "border-rose-600", none: "border-slate-300" }[avgTone];
  const pillCls = { good: "bg-[#0F6659] text-white", warn: "bg-amber-500 text-white", bad: "bg-rose-600 text-white", none: "bg-slate-200 text-slate-600" }[avgTone];
  const pillText = { good: "ภาพรวมผ่านเกณฑ์", warn: "ภาพรวมต้องปรับปรุง", bad: "ภาพรวมวิกฤต", none: "ยังไม่มีผลตรวจเดือนนี้" }[avgTone];

  const monthLabel = new Date().toLocaleDateString("th-TH", { month: "short", year: "numeric", timeZone: "Asia/Bangkok" });

  return (
    <div className="page-transition p-4 sm:p-6 space-y-4 w-full max-w-[100%] sm:max-w-[96%] md:max-w-[92%] mx-auto pb-12">
      <Header
        title="ตารางคะแนนและสถานะทุกสาขา"
        subtitle={`ข้อมูลทั้งหมด ${activeLocations.length} สาขาทั่วประเทศ`}
        onBack={onBack}
      />

      {/* 🌟 1. HERO SUMMARY CARD (ดีไซน์เดียวกับหน้ารายงานผลตรวจรายครั้ง แต่สรุปภาพรวมทุกสาขา — คลิกเพื่อกรองตารางได้) */}
      <div className="rounded-3xl p-5 sm:p-6 bg-white border border-slate-200/90 shadow-2xs space-y-4">
        {/* Top: วงแหวนคะแนนเฉลี่ย + ตัวเลขหลัก + สถานะภาพรวม */}
        <div className="flex items-center gap-4 sm:gap-5 min-w-0">
          <div className={`relative flex items-center justify-center w-[80px] h-[80px] sm:w-[88px] sm:h-[88px] rounded-full border-[5.5px] shadow-2xs shrink-0 bg-white font-mono font-black text-sm sm:text-base text-slate-900 select-none ${ringBorder}`}>
            {avgText}
            <div className="absolute -top-[5.5px] left-1/2 -translate-x-1/2 w-2 h-2 bg-white rounded-full" />
          </div>
          <div className="min-w-0">
            <div className="text-3xl sm:text-4xl font-black text-slate-900 font-mono tracking-tight leading-none">
              {summary.counts.passed}
              <span className="text-lg sm:text-xl font-bold text-slate-400"> / {summary.audited} สาขา</span>
            </div>
            <div className="text-xs sm:text-sm font-semibold text-slate-400 mt-1">
              ผ่านเกณฑ์ ≥{PASS_SCORE}% เดือน ({monthLabel})
            </div>
            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full shadow-2xs ${pillCls}`}>
                {avgTone === "good" ? <CheckCircle2 size={13} className="shrink-0" /> : <AlertTriangle size={13} className="shrink-0" />}
                <span>{pillText}</span>
              </span>
            </div>
          </div>
        </div>

        {/* แถบสัดส่วนสถานะทุกสาขา + ชิปกรอง */}
        <div className="space-y-2.5">
          <div className="flex w-full h-3 rounded-full overflow-hidden bg-slate-100">
            {STATUS_SEGMENTS.map(seg => summary.counts[seg.key] > 0 && (
              <button
                key={seg.key}
                type="button"
                onClick={() => toggleFilter(seg.key)}
                title={`${seg.label} ${summary.counts[seg.key]} สาขา`}
                style={{ width: `${(summary.counts[seg.key] / summary.total) * 100}%` }}
                className={`${seg.bar} h-full cursor-pointer transition-opacity ${filterCategory !== "all" && filterCategory !== seg.key ? "opacity-40" : ""}`}
              />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {STATUS_SEGMENTS.map(seg => (
              <button
                key={seg.key}
                type="button"
                onClick={() => toggleFilter(seg.key)}
                className={`inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-opacity ${
                  filterCategory === seg.key ? "text-slate-900" : "text-slate-500"
                } ${filterCategory !== "all" && filterCategory !== seg.key ? "opacity-40" : ""}`}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${seg.dot}`} />
                <span>{seg.label}</span>
                <span className="font-mono font-extrabold text-slate-900">{summary.counts[seg.key]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 🌟 2. Search & Excel Export Row (ปุ่ม Excel อยู่แถวเดียวกับค้นหา) */}
      <div className="flex items-center gap-2.5 bg-white p-2.5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาชื่อสาขา, แบรนด์, ภูมิภาค หรือผู้ตรวจ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs sm:text-sm pl-8.5 pr-8 py-2 rounded-xl bg-slate-50 border border-slate-200 outline-none font-medium text-slate-800 focus:bg-white focus:border-[#0F6659] transition-colors"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer rounded-md transition-colors"
              title="ล้างข้อความค้นหา"
            >
              <X size={13} />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            if (onExportExcel) onExportExcel();
            setShowExportModal(true);
          }}
          className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2.5 rounded-2xl bg-white border border-slate-300 hover:border-[#0F6659] hover:bg-emerald-50/60 text-xs font-extrabold text-slate-800 hover:text-[#0F6659] cursor-pointer shadow-2xs transition-all active:scale-95 shrink-0"
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
            {filterCategory === "pending" && "⏳ รอตรวจเดือนนี้"}
            {filterCategory === "stale" && `🕒 ไม่ได้ตรวจเกิน ${STALE_DAYS} วัน`}
            {filterCategory === "cap" && "🛠️ มี CAP ค้างดำเนินการ"}
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

      {/* 📱 แถบเรียงลำดับสำหรับมือถือ (หัวตารางซ่อนอยู่ จึงต้องมีปุ่มเรียงแยก) */}
      <div className="md:hidden flex items-center gap-2 overflow-x-auto custom-tab-scrollbar pb-0.5">
        <span className="text-xs font-bold text-slate-400 shrink-0">เรียงตาม</span>
        {[
          { key: "score", label: `คะแนน${sortBy === "score-desc" ? " ↓" : sortBy === "score-asc" ? " ↑" : ""}`, active: sortBy.startsWith("score"), onClick: () => setSortBy(p => (p === "score-desc" ? "score-asc" : "score-desc")) },
          { key: "name", label: "ชื่อ", active: sortBy === "name", onClick: () => setSortBy("name") },
          { key: "date", label: "ตรวจล่าสุด", active: sortBy === "date", onClick: () => setSortBy("date") },
        ].map(chip => (
          <button
            key={chip.key}
            type="button"
            onClick={chip.onClick}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-all active:scale-95 ${
              chip.active
                ? "bg-[#0F6659] text-white shadow-2xs"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* 📱 Mobile View (<768px): การ์ดต่อสาขา สไตล์เดียวกับหน้ารายงานผลตรวจ */}
      <div className="block md:hidden space-y-3">
        {paginatedUnits.map((u, idx) => {
          const st = getBranchStatus(u);
          const style = STATUS_STYLE[st];
          const isPending = st === "pending";
          const stale = isStaleBranch(u);
          const capOverdue = capStats.overdueByLoc.get(u.id) || 0;
          const typeName = u.locationType?.name || (typeof u.locationType === "string" ? u.locationType : null) || u.type;
          const subLine = [u.region, typeName].filter(Boolean).join(" · ");

          return (
            <div
              key={u.id ?? idx}
              onClick={() => onSelectUnit(u)}
              className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs hover:border-[#0F6659] active:scale-[0.99] transition-all cursor-pointer space-y-2 group"
            >
              {/* บรรทัด 1: วงกลมคะแนน + ป้ายสถานะ */}
              <div className="flex items-center justify-between">
                <div className={`min-w-[42px] px-2 h-8 rounded-full border-2 flex items-center justify-center font-bold text-xs font-mono bg-white shadow-2xs shrink-0 ${style.circle}`}>
                  {isPending ? "-" : parseFloat(Number(u.lastScore).toFixed(2))}
                </div>
                <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 ${style.badge}`}>
                  {style.text}
                </span>
              </div>

              {/* บรรทัด 2-3: ชื่อสาขา + ภูมิภาค/ประเภท */}
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-slate-900 leading-snug break-words group-hover:text-[#0F6659] transition-colors">
                  <BranchTitle u={u} />
                </h3>
                {subLine && <p className="text-xs text-slate-500 font-medium truncate">{subLine}</p>}
              </div>

              {/* บรรทัด 4: วันที่ตรวจล่าสุด (+ แท็กเตือนเฉพาะเมื่อมีปัญหา) */}
              <div className="flex items-center gap-1.5 flex-wrap text-xs text-slate-400 font-normal">
                <Calendar size={12} className="shrink-0" />
                <span>
                  {!hasAudit(u) ? "ยังไม่เคยตรวจ" : isPending ? `ตรวจล่าสุด ${fmtDate(u.lastAuditDate)}` : fmtDate(u.lastAuditDate)}
                </span>
                {stale && <span className="text-rose-600 font-bold">· เกิน {STALE_DAYS} วัน</span>}
                {capOverdue > 0 && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                    <Wrench size={10} /> CAP เกินกำหนด {capOverdue}
                  </span>
                )}
                <ChevronRight size={15} className="ml-auto text-slate-300 group-hover:text-[#0F6659] transition-colors shrink-0" />
              </div>
            </div>
          );
        })}

        {paginatedUnits.length === 0 && (
          <div className="text-center py-12 text-xs text-slate-400 font-medium bg-white rounded-2xl border border-slate-200 shadow-2xs">
            ไม่พบสาขาที่ตรงกับคำค้นหาหรือตัวกรอง
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs text-xs font-medium text-slate-500">
            <span>หน้า {currentPage} / {totalPages} ({totalCount} สาขา)</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold disabled:opacity-40 cursor-pointer transition-all active:scale-95"
              >
                ก่อนหน้า
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold disabled:opacity-40 cursor-pointer transition-all active:scale-95"
              >
                ถัดไป
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 💻 Tablet & Desktop View (>=768px): ตารางเต็มรูปแบบ */}
      <div className="hidden md:block rounded-3xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
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
                const st = getBranchStatus(u);
                const isUnaudited = st === "pending"; // ยังไม่ตรวจเดือนนี้ → แสดง "-"
                const isPassed = st === "passed";
                const isCritical = st === "critical";

                const circleColor = isUnaudited
                  ? "border-slate-300 text-slate-400"
                  : isCritical
                  ? "border-rose-600 text-rose-700"
                  : isPassed
                  ? "border-emerald-600 text-emerald-800"
                  : "border-amber-600 text-amber-800";

                const scorePill = isUnaudited
                  ? "bg-slate-100 text-slate-500 border border-slate-200/60"
                  : isCritical
                  ? "bg-rose-50 text-rose-700 border border-rose-200/60"
                  : isPassed
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                  : "bg-amber-50 text-amber-700 border border-amber-200/60";

                const statusBadge = isUnaudited
                  ? "bg-slate-100 text-slate-600"
                  : isCritical
                  ? "bg-rose-100 text-rose-800"
                  : isPassed
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-900";

                const statusText = isUnaudited ? "รอตรวจเดือนนี้" : isCritical ? "วิกฤต" : isPassed ? "ผ่านเกณฑ์" : "ต้องปรับปรุง";
                const overallIdx = startIndex + idx + 1;

                return (
                  <tr
                    key={u.id ?? idx}
                    onClick={() => onSelectUnit(u)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                  >
                    {/* 1. อันดับ & ชื่อสาขา */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-slate-400 w-4 text-center shrink-0 font-mono">
                          {overallIdx}
                        </span>
                        <div className={`min-w-[42px] px-2 h-8 rounded-full border-2 flex items-center justify-center font-bold text-xs shrink-0 font-mono bg-white shadow-2xs ${circleColor}`}>
                          {isUnaudited ? "-" : parseFloat(Number(u.lastScore).toFixed(2))}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-900 group-hover:text-[#0F6659] transition-colors truncate">
                            <BranchTitle u={u} />
                          </div>
                          <div className="text-xs text-slate-400 font-normal truncate mt-0.5">
                            {u.fullName || u.region}
                          </div>
                          {(() => {
                            const brands = (u.locationBrands || []).map(lb => lb.brand?.name || lb.brandName).filter(Boolean);
                            if (brands.length === 0 && (u.brand?.name || u.brandName)) brands.push(u.brand?.name || u.brandName);
                            if (!brands.length) return null;
                            return (
                              <div className="flex items-center gap-1 mt-1 flex-wrap">
                                {brands.map((b, bi) => (
                                  <span key={bi} className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-teal-50 text-teal-800 border border-teal-200/70">
                                    🏷️ {b}
                                  </span>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </td>

                    {/* 2. คะแนน */}
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold font-mono ${scorePill}`}>
                        {isUnaudited ? "-" : `${u.lastScore}%`}
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
                      {u.lastAuditDate ? fmtDate(u.lastAuditDate) : "-"}
                    </td>

                    {/* 5. ผู้ตรวจประเมิน */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-xs sm:text-sm font-normal text-slate-700">
                      {u.history && u.history[0]?.auditor ? u.history[0].auditor : (u.auditorName || "-")}
                    </td>

                    {/* 6. สถานะ & Arrow */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-center pr-5">
                      <div className="flex items-center justify-end gap-3">
                        <span className={`inline-flex items-center justify-center px-3 py-1 rounded-lg text-xs font-bold ${statusBadge}`}>
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
                className={`px-3 py-1.5 rounded-2xl font-bold flex items-center gap-1 transition-all ${
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
                  className={`w-8 h-8 rounded-2xl font-bold text-xs flex items-center justify-center transition-all cursor-pointer ${
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
                className={`px-3 py-1.5 rounded-2xl font-bold flex items-center gap-1 transition-all ${
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