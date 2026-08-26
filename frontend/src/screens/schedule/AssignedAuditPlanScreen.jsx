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


export default function AssignedAuditPlanScreen({ auditorName, onStart, activeDraft, onResumeDraft }) {
  const plans = INITIAL_SCHEDULE.filter((plan) => plan.auditor === auditorName);

  return (
    <div className="page-transition p-4 sm:p-6 space-y-4 w-full max-w-[100%] sm:max-w-[92%] mx-auto pb-12">
      {/* 🌟 IN-PROGRESS DRAFT BANNER & RESUME CARD */}
      {activeDraft && (
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-white shadow-lg space-y-3 animate-in slide-in-from-top-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping"></span>
              <span className="text-xs font-extrabold uppercase tracking-wider text-amber-100">กำลังดำเนินการตรวจ (ค้างอยู่)</span>
            </div>
            <span className="text-[11px] font-bold bg-black/20 px-2.5 py-1 rounded-full text-amber-100">
              บันทึกล่าสุด {activeDraft.savedAt || "เมื่อสักครู่"}
            </span>
          </div>

          <div className="bg-white/10 backdrop-blur-xs p-3.5 rounded-2xl border border-white/20 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-base font-extrabold truncate">{activeDraft.unit?.fullName || activeDraft.unit?.name}</div>
              <div className="text-xs text-amber-100 truncate mt-0.5">{activeDraft.form?.name} · กำลังทำหมวดที่ {(activeDraft.sectionIdx || 0) + 1}</div>
            </div>

            <button
              type="button"
              onClick={onResumeDraft}
              className="px-4 py-2.5 rounded-xl bg-white hover:bg-amber-50 text-amber-900 font-extrabold text-xs sm:text-sm cursor-pointer shadow-md active:scale-95 transition-all flex items-center gap-1.5 shrink-0"
            >
              <span>ตรวจต่อ</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {plans.map((plan) => {
          const isThisPlanInDraft = activeDraft && (activeDraft.unit?.name === plan.unit || activeDraft.unit?.fullName?.includes(plan.unit));
          return (
            <button
              key={plan.id || `${plan.day}-${plan.unit}`}
              type="button"
              onClick={() => {
                if (isThisPlanInDraft) onResumeDraft();
                else onStart(plan);
              }}
              className={`w-full p-4 rounded-2xl border shadow-2xs hover:shadow-sm transition-all text-left flex items-center gap-3 cursor-pointer ${
                isThisPlanInDraft 
                  ? 'bg-amber-50/90 border-amber-300 ring-2 ring-amber-400/40' 
                  : 'bg-white border-slate-200 hover:border-emerald-500'
              }`}
            >
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                isThisPlanInDraft ? 'bg-amber-100 text-amber-900' : 'bg-emerald-50 text-emerald-800'
              }`}>
                <CalendarDays size={19} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-extrabold text-slate-900 truncate">{plan.unit}</span>
                  {isThisPlanInDraft ? (
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-amber-200 text-amber-950 border border-amber-300 animate-pulse">
                      🟡 กำลังตรวจ
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                      รอดำเนินการ
                    </span>
                  )}
                </div>
                <div className="text-xs font-medium text-slate-500 mt-0.5">{plan.day} ส.ค. 2569 · {plan.time} · {plan.auditType || "ตรวจตามแผน"}</div>
              </div>
              <ChevronRight size={18} className={isThisPlanInDraft ? "text-amber-700" : "text-slate-400"} />
            </button>
          );
        })}
        {plans.length === 0 && <div className="text-center py-12 rounded-3xl border border-dashed border-slate-200 bg-white text-sm font-bold text-slate-400">ยังไม่มีแผนตรวจที่ได้รับมอบหมาย</div>}
      </div>
    </div>
  );
}
