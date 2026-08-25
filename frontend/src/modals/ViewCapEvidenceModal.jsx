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

import { c, sans, mono, cardStyle } from "../config/theme";
import { ROLES, NAV_BY_ROLE, ROLE_USER_MAP } from "../config/roles";
import { TODAY, AUDIT_TYPES, AUDIT_TYPE_META, CAP_STATUS_MAP, REGION_LINES, BRAND_LINES } from "../config/constants";
import { TopBarContext } from "../context/TopBarContext";
import { DataContext } from "../context/DataContext";
import { INITIAL_UNITS, LOCATIONS } from "../mocks/locations";
import { INITIAL_SCHEDULE } from "../mocks/schedule";
import { INITIAL_FORM_SECTIONS, INITIAL_FORMS_LIST } from "../mocks/forms";
import { AUDITORS_DATA, AUDITORS_LIST } from "../mocks/auditors";
import { INITIAL_NOTIFICATIONS } from "../mocks/notifications";
import { INITIAL_CAP_LIST } from "../mocks/cap";
import { TRENDS_DATA, TRENDS_BY_REGION, TRENDS_BY_BRAND } from "../mocks/trends";
import { AI_INSIGHTS } from "../mocks/aiInsights";
import { MOCK_USERS, ORG_TREE, ROLE_PERMISSIONS_LIST, API_INTEGRATIONS } from "../mocks/admin";
import { exportToExcel } from "../utils/exportToExcel";
import ModalWrapper from "../shared/ModalWrapper";
import Header from "../shared/Header";
import Section from "../shared/Section";
import ScoreRing from "../shared/ScoreRing";
import HistoryList from "../shared/HistoryList";
import ErrorBoundary from "../shared/ErrorBoundary";



export default function ViewCapEvidenceModal({ cap, onClose }) {
  return (
    <ModalWrapper onClose={onClose} maxWidth="max-w-md">
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: c.border, background: "#FAF9F5" }}>
          <div className="flex items-center gap-2">
            <CheckCheck size={18} className="text-emerald-700" />
            <h3 className="text-sm font-bold text-slate-800">หลักฐานการส่งงานแก้ไข (CAP)</h3>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-200 active:scale-90 cursor-pointer transition-all">
            <X size={18} style={{ color: c.faint }} />
          </button>
        </div>

        <div className="p-4 space-y-3.5 flex-1 overflow-y-auto">
          <div className="p-3 rounded-xl bg-slate-50 border space-y-1">
            <div className="text-xs font-bold text-slate-400">ข้อคำถามที่ {cap.qNum}</div>
            <div className="text-xs font-bold text-slate-800">{cap.qText}</div>
          </div>

          <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 space-y-1">
            <div className="text-xs font-bold text-emerald-800">รายละเอียดสิ่งที่สาขาแก้ไข:</div>
            <div className="text-xs font-semibold text-emerald-950">"{cap.actionText}"</div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border space-y-2">
            <div className="text-xs font-bold text-slate-500">รูปถ่ายหลักฐานเปรียบเทียบ (Before / After):</div>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-2.5 rounded-lg bg-red-50 border border-red-200">
                <span className="text-xs font-bold text-red-700 block mb-1">📷 ก่อนแก้ไข (Before)</span>
                <span className="text-xs text-slate-500">รูปถ่ายขณะตรวจ</span>
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                <span className="text-xs font-bold text-emerald-700 block mb-1">✓ หลังแก้ไข (After)</span>
                <span className="text-xs text-slate-500">รูปถ่ายหลักฐานสาขา</span>
              </div>
            </div>
          </div>

          <div className="text-xs space-y-1 border-t pt-2" style={{ borderColor: c.border, color: c.muted }}>
            <div className="flex justify-between"><span>ผู้ส่งมอบงาน:</span><span className="font-bold text-slate-800">{cap.responsibleName}</span></div>
            <div className="flex justify-between"><span>เวลาที่ส่งมอบ:</span><span className="font-bold text-slate-800">{cap.submittedAt}</span></div>
            <div className="flex justify-between"><span>สถานะ:</span><span className="font-bold text-emerald-700">⏳ รอผู้ตรวจ Lead Auditor ตรวจสอบและอนุมัติ</span></div>
          </div>
        </div>

        <div className="p-3 border-t bg-slate-50" style={{ borderColor: c.border }}>
          <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 font-bold text-xs text-slate-700 cursor-pointer">
            ปิดหน้าต่าง
          </button>
        </div>
    </ModalWrapper>
  );
}
