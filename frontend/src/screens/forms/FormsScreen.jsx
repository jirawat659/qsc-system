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
import FormEditorScreen from "./FormEditorScreen";


export default function FormsScreen({ isDesktop, onBack }) {
  const { forms, refreshData } = React.useContext(DataContext);
  const [editing, setEditing] = useState(undefined);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");

  const formsList = useMemo(() => {
    if (forms && forms.length > 0) {
      return forms.map(f => ({
        id: f.id,
        name: f.title,
        title: f.title,
        version: f.version || "v1.0",
        date: f.createdAt ? new Date(f.createdAt).toLocaleDateString('th-TH') : "15 ส.ค. 2569",
        author: f.createdBy?.fullName || "ทีมมาตรฐาน QA",
        type: f.locationType?.code || "STORE",
        status: f.isActive ? "active" : "draft",
        usedCount: f.auditRecords?.length || 0,
        itemCount: f.sections ? f.sections.reduce((acc, s) => acc + (s.items?.length || 0), 0) : 11,
        sections: f.sections || []
      }));
    }
    return INITIAL_FORMS_LIST;
  }, [forms]);

  if (editing !== undefined) {
    return (
      <FormEditorScreen
        form={editing}
        onBack={() => {
          setEditing(undefined);
          if (refreshData) refreshData();
        }}
        onSave={(savedForm) => {
          setEditing(undefined);
          if (refreshData) refreshData();
        }}
      />
    );
  }

  const filteredForms = formsList.filter(f => {
    const matchType = filterType === "all" || f.type.includes(filterType);
    const q = searchTerm.toLowerCase();
    const matchSearch = !searchTerm.trim() || f.name.toLowerCase().includes(q) || f.type.toLowerCase().includes(q) || f.version.toLowerCase().includes(q);
    return matchType && matchSearch;
  });

  return (
    <div className="page-transition p-4 sm:p-6 space-y-4 w-full max-w-[100%] sm:max-w-[96%] md:max-w-[92%] mx-auto pb-12">
      <Header
        title="แบบฟอร์มการตรวจมาตรฐาน"
        subtitle="จัดการแบบฟอร์ม เกณฑ์คะแนนผ่าน และผู้ตรวจที่ได้รับมอบหมาย"
        onBack={onBack}
        action={
          <button
            type="button"
            onClick={() => setEditing(null)}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-bold cursor-pointer shadow-sm hover:bg-emerald-800 transition-all text-white bg-[#0F6659] shrink-0"
          >
            <Plus size={16} /> สร้างฟอร์มใหม่
          </button>
        }
      />

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาชื่อแบบฟอร์ม, หมวดหมู่, หรือเวอร์ชัน..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs sm:text-sm pl-10 pr-9 py-2.5 rounded-2xl bg-white border border-slate-200 shadow-2xs outline-none font-semibold text-slate-800 focus:border-emerald-600 transition-colors"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm("")} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer rounded-lg">
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
          {[
            { key: "all", label: "ทั้งหมด" },
            { key: "หน้าร้าน", label: "หน้าร้าน" },
            { key: "โรงงาน", label: "โรงงาน/คลัง" },
            { key: "ออฟฟิศ", label: "สำนักงาน" },
          ].map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilterType(tab.key)}
              className={`px-3 py-2 rounded-xl text-xs font-bold shrink-0 cursor-pointer transition-colors ${
                filterType === tab.key
                  ? 'bg-[#0F6659] text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Long Vertical List (ปุ่มหัวข้อใหญ่ ชัดเจน ตัดข้อความยืดยาวออก) */}
      <div className="flex flex-col gap-3">
        {filteredForms.map((f) => (
          <div
            key={f.id}
            onClick={() => setEditing(f)}
            className="w-full rounded-2xl sm:rounded-3xl p-4 sm:p-5 bg-white border border-slate-200 shadow-2xs hover:border-emerald-500 hover:shadow-xs transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left group"
          >
            {/* Left Info */}
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 bg-emerald-50 text-[#0F6659] border border-emerald-200 group-hover:bg-[#0F6659] group-hover:text-white transition-colors">
                <ClipboardCheck size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 leading-snug group-hover:text-[#0F6659] transition-colors">
                  {f.name}
                </h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700">
                    {f.type}
                  </span>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-lg bg-emerald-100 text-emerald-800">
                    {f.version}
                  </span>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-lg bg-emerald-50 text-[#0F6659] border border-emerald-200">
                    เกณฑ์ ≥{f.passingScore}%
                  </span>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-lg bg-blue-50 text-blue-800 border border-blue-200">
                    {f.targetMode === "specific" && f.targetUnits?.length ? `ใช้ ${f.targetUnits.length} สาขา` : "ใช้ได้ทุกสาขา"}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Action Button */}
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditing(f);
                }}
                className="px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold text-white cursor-pointer shadow-xs active:scale-95 flex items-center gap-1.5 bg-[#0F6659] hover:bg-emerald-800 transition-all"
              >
                <span>แก้ไขฟอร์ม</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        ))}

        {filteredForms.length === 0 && (
          <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200 text-sm text-slate-400 font-bold">
            ไม่พบแบบฟอร์มที่ตรงกับคำค้นหา
          </div>
        )}
      </div>
    </div>
  );
}
