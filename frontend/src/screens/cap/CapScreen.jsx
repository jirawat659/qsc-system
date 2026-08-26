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
import CapDetailScreen from "./CapDetailScreen";
import NewRemediationModal from "./NewRemediationModal";


export default function CapScreen({ isDesktop, onBack, role = "STANDARD" }) {
  const { capTasks } = React.useContext(DataContext);
  const [selected, setSelected] = useState(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const capList = useMemo(() => {
    if (capTasks && capTasks.length > 0) {
      return capTasks.map(t => ({
        id: t.id,
        title: t.issueItem || "ข้อบกพร่องจากการตรวจ",
        unit: t.location?.name || t.locationName || "สาขาสยาม",
        issueItem: t.issueItem || t.description,
        desc: t.description || "ต้องดำเนินการแก้ไขตามมาตรฐาน Q.S.C.",
        status: t.status === "OPEN" ? "pending" : t.status === "SUBMITTED" ? "submitted" : t.status === "CLOSED" ? "approved" : t.status === "REJECTED" ? "rejected" : t.status,
        deadline: t.submissionDeadline ? new Date(t.submissionDeadline).toLocaleDateString('th-TH') : "3 วันหลังจากตรวจ",
        createdAt: t.createdAt ? new Date(t.createdAt).toLocaleDateString('th-TH') : "วันนี้",
        raw: t
      }));
    }
    return INITIAL_CAP_LIST;
  }, [capTasks]);

  if (selected) return <CapDetailScreen item={selected} onBack={() => setSelected(null)} />;

  const filteredCapList = capList.filter(item => {
    const matchStatus = statusFilter === "all" || item.status === statusFilter;
    const q = searchTerm.toLowerCase();
    const matchSearch =
      !searchTerm.trim() ||
      item.title.toLowerCase().includes(q) ||
      item.unit.toLowerCase().includes(q) ||
      (item.issueItem && item.issueItem.toLowerCase().includes(q)) ||
      item.desc.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  return (
    <div className="page-transition p-4 sm:p-6 space-y-4 w-full max-w-[100%] sm:max-w-[96%] md:max-w-[92%] mx-auto pb-12">
      <Header
        title={role === "AUDITEE" ? "แชทติดตามงานแก้ไข (CAP Threads)" : "ส่งมอบงานแก้ไขข้อบกพร่อง (CAP)"}
        subtitle={role === "AUDITEE" ? "รายการงานแก้ไขที่ยื่นเรื่องแล้ว และประวัติการพูดคุยกับ QA/QC" : "ติดตามและส่งมอบหลักฐานการแก้ไขข้อบกพร่องจากการตรวจประเมิน"}
        onBack={onBack}
        action={
          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-bold cursor-pointer shadow-sm hover:bg-emerald-800 transition-all text-white bg-[#0F6659] shrink-0"
          >
            <Plus size={16} /> ส่งงานแก้ไขใหม่
          </button>
        }
      />

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาชื่องานแก้ไข, สาขา หรือข้อคำถาม..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs sm:text-sm pl-10 pr-9 py-2.5 rounded-2xl bg-white border border-slate-200 shadow-2xs outline-none font-bold text-slate-800 focus:border-emerald-600 transition-colors"
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
            { key: "pending", label: "เกินกำหนด SLA" },
            { key: "submitted", label: "รออนุมัติ" },
            { key: "done", label: "ปิดงานแล้ว" },
          ].map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-2 rounded-xl text-xs font-bold shrink-0 cursor-pointer transition-colors ${
                statusFilter === tab.key
                  ? 'bg-[#0F6659] text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Long Vertical List (ปุ่มหัวข้อใหญ่ ชัดเจน เน้นๆ) */}
      <div className="flex flex-col gap-3">
        {filteredCapList.map((item, i) => {
          const st = CAP_STATUS_MAP[item.status] || CAP_STATUS_MAP.pending;
          return (
            <button
              key={i}
              onClick={() => setSelected(item)}
              className="w-full rounded-2xl sm:rounded-3xl p-4 sm:p-5 bg-white border border-slate-200 shadow-2xs hover:border-emerald-500 hover:shadow-xs transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left group"
            >
              {/* Left Info */}
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border"
                  style={{ background: st.bg, color: st.fg, borderColor: `${st.fg}33` }}
                >
                  <Wrench size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug group-hover:text-[#0F6659] transition-colors">
                    {item.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                      {item.unit}
                    </span>
                    <span className="text-xs font-normal text-slate-500">
                      ครบกำหนด {item.deadline}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Status Badge & Arrow */}
              <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                <span
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-lg border"
                  style={{ background: st.bg, color: st.fg, borderColor: `${st.fg}40` }}
                >
                  <span className="w-2 h-2 rounded-full" style={{ background: st.fg }} />
                  {st.label}
                </span>
                <ChevronRight size={18} className="text-slate-400 group-hover:text-slate-700 transition-colors" />
              </div>
            </button>
          );
        })}

        {filteredCapList.length === 0 && (
          <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200 text-sm text-slate-400 font-medium">
            ไม่พบรายการส่งมอบงานแก้ไขที่ตรงกับคำค้นหา
          </div>
        )}
      </div>

      {showNewModal && (
        <NewRemediationModal
          onClose={() => setShowNewModal(false)}
          onSubmit={(newItem) => setCapList([newItem, ...capList])}
        />
      )}
    </div>
  );
}
