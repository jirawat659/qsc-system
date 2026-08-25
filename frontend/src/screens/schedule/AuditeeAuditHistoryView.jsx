import AuditHistoryDetail from "../audit/AuditHistoryDetail";
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
import CapSubmissionModal from "../../modals/CapSubmissionModal";
import ViewCapEvidenceModal from "../../modals/ViewCapEvidenceModal";


export default function AuditeeAuditHistoryView() {
  const { locations } = React.useContext(DataContext);
  const [selectedAuditLog, setSelectedAuditLog] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const myUnit = locations[0]; // สาขาสยาม

  if (selectedAuditLog) {
    return (
      <AuditHistoryDetail
        unitName={myUnit.fullName || myUnit.name}
        record={selectedAuditLog}
        onBack={() => setSelectedAuditLog(null)}
      />
    );
  }

  const filteredHistory = (myUnit.history || []).filter(h => {
    const matchStatus = filterStatus === "all" || 
      (filterStatus === "passed" && h.score >= 85) || 
      (filterStatus === "cap" && h.score < 85);
    const q = searchTerm.toLowerCase();
    const matchSearch = !searchTerm.trim() || 
      h.date.toLowerCase().includes(q) || 
      (h.auditor && h.auditor.toLowerCase().includes(q)) || 
      (h.status && h.status.toLowerCase().includes(q));
    return matchStatus && matchSearch;
  });

  return (
    <div className="page-transition p-4 sm:p-5 space-y-3.5 w-full max-w-[100%] sm:max-w-[96%] md:max-w-[92%] mx-auto pb-12">
      {/* 🌟 1. PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-0.5">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900">
            ประวัติการตรวจ: {myUnit.fullName || myUnit.name}
          </h2>
          <p className="text-xs font-medium text-slate-500">
            ผลคะแนนและการตรวจประเมินย้อนหลังทั้งหมด
          </p>
        </div>
        <span className="text-xs font-bold px-3 py-1 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-200 self-start sm:self-auto shadow-2xs">
          ทั้งหมด {myUnit.history?.length || 0} รอบ
        </span>
      </div>

      {/* 🌟 UNIFIED SUMMARY BAR (สไตล์เดียวกับ Dashboard หลัก) */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <h3 className="text-sm sm:text-base font-extrabold text-slate-800">
              ภาพรวมผลการตรวจประเมินของสาขา
            </h3>
            <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              {myUnit.fullName || myUnit.name}
            </span>
          </div>
          <span className="text-xs font-bold text-slate-400">
            ทั้งหมด {myUnit.history?.length || 0} รอบตรวจ
          </span>
        </div>

        {/* 3 Metric Columns with Hairline Dividers */}
        <div className="grid grid-cols-3 divide-x divide-slate-100 pt-0.5">
          <div className="px-2 sm:px-4 py-1 text-center flex flex-col justify-between gap-1">
            <div className="flex items-center justify-center gap-1 text-xs font-bold text-slate-500">
              <Award size={14} className="text-amber-700 shrink-0" />
              <span>คะแนนรอบล่าสุด</span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-amber-900 leading-tight" style={{ fontFamily: mono }}>
              {myUnit.lastScore}%
            </div>
            <div>
              <span className={`inline-block text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-md ${
                myUnit.lastScore >= 85 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"
              }`}>
                {myUnit.lastScore >= 85 ? "✓ ผ่านเกณฑ์" : "⚠️ ต้องส่งงานแก้ไข"}
              </span>
            </div>
          </div>

          <div className="px-2 sm:px-4 py-1 text-center flex flex-col justify-between gap-1">
            <div className="flex items-center justify-center gap-1 text-xs font-bold text-slate-500">
              <ClipboardCheck size={14} className="text-slate-600 shrink-0" />
              <span>ตรวจประเมินแล้ว</span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 leading-tight" style={{ fontFamily: mono }}>
              {myUnit.history?.length || 0} <span className="text-xs font-bold text-slate-400">รอบ</span>
            </div>
            <div>
              <span className="inline-block text-[10px] sm:text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                ประวัติสมบูรณ์
              </span>
            </div>
          </div>

          <div className="px-2 sm:px-4 py-1 text-center flex flex-col justify-between gap-1">
            <div className="flex items-center justify-center gap-1 text-xs font-bold text-slate-500">
              <CheckCircle2 size={14} className="text-emerald-700 shrink-0" />
              <span>ผ่านเกณฑ์</span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-800 leading-tight" style={{ fontFamily: mono }}>
              {myUnit.history ? myUnit.history.filter(h => h.score >= 85).length : 0} <span className="text-xs font-bold text-slate-400">รอบ</span>
            </div>
            <div>
              <span className="inline-block text-[10px] sm:text-[11px] font-bold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                เกณฑ์ผ่าน ≥85%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 🌟 3. SEARCH & FILTER BAR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-0.5">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาวันที่ตรวจ หรือชื่อผู้ตรวจ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs sm:text-sm pl-9 pr-8 py-2.5 rounded-2xl bg-white border border-slate-200 shadow-2xs outline-none font-bold text-slate-800 focus:border-[#0F6659] transition-colors"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer rounded-lg">
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
          {[
            { key: "all", label: "ทุกรอบตรวจ" },
            { key: "passed", label: "ผ่านเกณฑ์ (≥85%)" },
            { key: "cap", label: "มีงานแก้ไข (<85%)" },
          ].map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilterStatus(tab.key)}
              className={`px-3 py-2 rounded-xl text-xs font-bold shrink-0 cursor-pointer transition-colors ${
                filterStatus === tab.key
                  ? 'bg-[#0F6659] text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 🌟 4. AUDIT LIST */}
      <div className="flex flex-col gap-2.5 pt-0.5">
        {filteredHistory.map((h, idx) => {
          const isLatest = myUnit.history && myUnit.history.length > 0 && h.date === myUnit.history[0].date;
          const isPass = h.score >= 85;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => setSelectedAuditLog(h)}
              className="w-full rounded-2xl p-3.5 sm:p-4 bg-white border border-slate-200 shadow-2xs hover:border-emerald-500 hover:shadow-xs transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left group active:scale-98"
            >
              {/* Left Info with Score Ring */}
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                <ScoreRing score={h.score} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-[#0F6659] transition-colors leading-snug">
                      รอบตรวจวันที่ {h.date}
                    </h3>
                    {isLatest && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900">
                        ล่าสุด
                      </span>
                    )}
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                      isPass ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
                    }`}>
                      {isPass ? "✓ ผ่านเกณฑ์" : "⚠️ มีงานแก้ไข"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-600 flex-wrap">
                    <span className="font-medium">ผู้ตรวจ: {h.auditor || "สมชาย ใจดี"}</span>
                    <span className="text-slate-300">•</span>
                    <span>ฟอร์มร้านอาหาร v3</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-400">ลงนามแล้ว</span>
                  </div>
                </div>
              </div>

              {/* Right Action Button */}
              <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 text-[#0F6659] font-bold text-xs group-hover:bg-[#0F6659] group-hover:text-white transition-all self-end sm:self-center shrink-0 shadow-2xs">
                <span>ดูผลตรวจรายข้อ</span>
                <ChevronRight size={14} />
              </div>
            </button>
          );
        })}

        {filteredHistory.length === 0 && (
          <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-slate-200 text-xs text-slate-400 font-bold">
            ไม่พบประวัติการตรวจที่ตรงกับคำค้นหา
          </div>
        )}
      </div>
    </div>
  );
}
