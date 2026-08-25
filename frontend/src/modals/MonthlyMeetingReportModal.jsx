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



export default function MonthlyMeetingReportModal({ onClose }) {
  const [selectedMonth, setSelectedMonth] = useState("สิงหาคม 2569");

  return (
    <ModalWrapper onClose={onClose} maxWidth="max-w-2xl">
      {/* Header */}
      <div className="shrink-0 p-4 sm:p-5 border-b flex items-center justify-between" style={{ borderColor: c.border, background: "#FAF9F5" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-800 shrink-0">
            <BarChart3 size={20} />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-800">รายงานสรุปผลการตรวจสำหรับที่ประชุมประจำเดือน</h3>
            <p className="text-xs text-slate-500">Executive Monthly Quality & Standards Review</p>
          </div>
        </div>
        <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-200 active:scale-90 cursor-pointer transition-all">
          <X size={18} style={{ color: c.faint }} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 space-y-5">
        {/* Top Period Selector & Meeting Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
          <div>
            <div className="text-xs font-bold text-slate-400">รอบรายงาน</div>
            <div className="text-xs sm:text-sm font-bold text-slate-800">สรุปผลการตรวจสอบมาตรฐาน Q.S.C. ประจำเดือน {selectedMonth}</div>
          </div>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800">
            ตรวจแล้ว 128 สาขา
          </span>
        </div>

        {/* 1. Core KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
            <div className="text-xs font-bold text-emerald-800">อัตราผ่านเกณฑ์ (≥85%)</div>
            <div className="text-xl font-bold text-emerald-900 font-mono mt-0.5">82.4%</div>
            <div className="text-xs text-emerald-700">105 จาก 128 สาขา</div>
          </div>
          <div className="p-3 rounded-2xl bg-teal-50 border border-teal-200">
            <div className="text-xs font-bold text-teal-800">ดีเยี่ยม (≥90%)</div>
            <div className="text-xl font-bold text-teal-900 font-mono mt-0.5">34.3%</div>
            <div className="text-xs text-teal-700">44 สาขาตัวอย่าง</div>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="text-xs font-bold text-slate-600">เวลาตรวจเฉลี่ย/สาขา</div>
            <div className="text-xl font-bold text-slate-800 font-mono mt-0.5">4.8 ชม.</div>
            <div className="text-xs text-slate-400">มาตรฐาน 4 - 6 ชม.</div>
          </div>
          <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200">
            <div className="text-xs font-bold text-amber-800">การสุ่มตรวจรอบ 2</div>
            <div className="text-xl font-bold text-amber-900 font-mono mt-0.5">100%</div>
            <div className="text-xs text-amber-700">ยึดคะแนนรอบล่าสุด</div>
          </div>
        </div>

        {/* 2. Specialized Quality Tests */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-emerald-700" />
            <span>ผลการตรวจวัดมาตรฐานเฉพาะทาง (Specialized Parameters)</span>
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="p-3 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">🧊 อุณหภูมิตู้แช่เย็น</span>
                <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">ผ่าน 94%</span>
              </div>
              <div className="text-xs text-slate-500 font-medium">เฉลี่ย 2.8°C (เกณฑ์ ≤ 4.0°C)</div>
            </div>
            <div className="p-3 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">🍟 คุณภาพน้ำมันทอด (TPM)</span>
                <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">ผ่าน 98%</span>
              </div>
              <div className="text-xs text-slate-500 font-medium">เฉลี่ย 14.2% (เกณฑ์ ≤ 25.0%)</div>
            </div>
            <div className="p-3 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">💧 คุณภาพน้ำดื่ม & น้ำแข็ง</span>
                <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">ผ่าน 91%</span>
              </div>
              <div className="text-xs text-slate-500 font-medium">ตรวจเชื้อโคลิฟอร์ม & ตะกอน</div>
            </div>
          </div>
        </div>

        {/* 3. Category Breakdown */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-700">คะแนนเฉลี่ยแยกตามหมวดหมู่ (Category Averages)</h4>
          <div className="space-y-2">
            {[
              { name: "1. ความสะอาดและสุขอนามัย (Cleanliness)", score: 84.5 },
              { name: "2. มาตรฐานการบริการและความเร็ว (Service)", score: 91.2 },
              { name: "3. คุณภาพอาหารและความปลอดภัย (Quality & Safety)", score: 87.8 },
            ].map(cat => (
              <div key={cat.name} className="space-y-1">
                <div className="flex justify-between text-xs font-bold text-slate-700">
                  <span>{cat.name}</span>
                  <span style={{ fontFamily: mono }}>{cat.score}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-[#0F6659]" style={{ width: `${cat.score}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Top 5 Defect Frequency */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-700">ข้อบกพร่องที่พบบ่อยที่สุดในรอบเดือน (Top 5 Defect Frequency)</h4>
          <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
            {[
              { rank: 1, text: "พบคราบไขมันสะสมบริเวณพื้นและผนังหลังเตาปรุงอาหาร (ข้อ 1)", count: 24, percent: "18.7%", status: "แก้แล้ว 21 สาขา" },
              { rank: 2, text: "อุณหภูมิตู้แช่เย็นวัตถุดิบเกิน 4.0°C ก่อนเวลาบริการ (ข้อ 7)", count: 8, percent: "6.2%", status: "แก้แล้ว 8 สาขา" },
              { rank: 3, text: "พนักงานครัวไม่สวมหมวกคลุมผมหรือใส่ไม่มิดชิด (ข้อ 2)", count: 7, percent: "5.5%", status: "ตักเตือนและอบรมซ้ำ" },
              { rank: 4, text: "ป้ายระบุวันหมดอายุ (FIFO Date Label) เลือนราง (ข้อ 8)", count: 4, percent: "3.1%", status: "เปลี่ยนเครื่องพิมพ์ฉลาก" },
              { rank: 5, text: "เวลาส่งมอบออเดอร์หน้าร้านเกิน 3 นาทีในช่วง Peak Hour (ข้อ 5)", count: 3, percent: "2.3%", status: "ปรับผังไลน์ผลิต" },
            ].map((def) => (
              <div key={def.rank} className="p-3 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <span className="w-5 h-5 rounded-full bg-red-100 text-red-700 font-bold text-xs flex items-center justify-center shrink-0">
                    {def.rank}
                  </span>
                  <div className="min-w-0">
                    <div className="font-bold text-slate-800 truncate">{def.text}</div>
                    <div className="text-xs text-emerald-700 font-medium">{def.status}</div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold text-red-700 font-mono">{def.count} สาขา</div>
                  <div className="text-xs text-slate-400">{def.percent}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="shrink-0 p-4 border-t bg-slate-50 flex items-center justify-between gap-2" style={{ borderColor: c.border }}>
        <button
          onClick={() => {
            exportToExcel({ mode: "all", timeRange: "1M" });
          }}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-700 cursor-pointer shadow-2xs"
        >
          <Download size={14} /> ส่งออกสรุปรายงานประจำเดือน (.csv)
        </button>
        <button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-[#0F6659] text-white text-xs font-bold cursor-pointer shadow-md">
          ปิดหน้ารายงาน
        </button>
      </div>
    </ModalWrapper>
  );
}
