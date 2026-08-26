import FormsScreen from "../forms/FormsScreen";
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
import AdminSubScreen from "./AdminSubScreen";
import ConsolidatedReportsScreen from "./ConsolidatedReportsScreen";
import MasterManagementScreen from "./MasterManagementScreen";


export default function AdminMoreScreen({ role = "STANDARD", onNavigate }) {
  const [open, setOpen] = useState(null);

  const tools = [
    {
      key: "master_management",
      icon: Layers,
      label: "การจัดการ",
      desc: "จัดการข้อมูลผู้ใช้งาน, เพิ่มสถานที่/สาขา และประเภทสถานที่",
      roles: ["STANDARD", "ADMIN"]
    },
    {
      key: "reports",
      icon: FileSpreadsheet,
      label: "รายงานผลการตรวจ",
      desc: "ดูผลตรวจรายครั้งในตาราง กรองข้อมูล และส่งออก Excel",
      roles: ["STANDARD", "EXEC", "ADMIN"]
    },
    {
      key: "schedule",
      icon: CalendarDays,
      label: "แผนการตรวจ",
      desc: "ดูแผนตรวจและสาขาที่ถูกมอบหมายให้ผู้ตรวจ",
      route: "schedule",
      roles: ["STANDARD", "ADMIN"]
    },
    {
      key: "forms",
      icon: ClipboardList,
      label: "จัดการแบบฟอร์มการตรวจ",
      desc: "สร้าง แก้ไข และกำหนดเกณฑ์สำหรับแบบฟอร์มตรวจประเมิน",
      roles: ["STANDARD", "ADMIN"]
    },
    { 
      key: "cap",
      icon: Wrench,
      label: "ติดตามและพิจารณางานแก้ไข (CAP)",
      desc: "ตรวจสอบหลักฐานการแก้ไขข้อบกพร่องและอนุมัติปิดงาน",
      route: "cap",
      roles: ["STANDARD", "ADMIN"]
    },
    { 
      key: "users", 
      icon: Users, 
      label: "จัดการผู้ใช้งานและบทบาท", 
      desc: "กำหนดสิทธิ์ผู้ตรวจ ผู้จัดการสาขา และผู้บริหาร",
      roles: ["STANDARD", "ADMIN"]
    },
    { 
      key: "org", 
      icon: Store, 
      label: "ผังโครงสร้างองค์กรและสาขา", 
      desc: "ผังแบรนด์ พื้นที่ และสาขาทั้งหมด 105 แห่ง",
      roles: ["STANDARD", "ADMIN", "EXEC"]
    },
    { 
      key: "permissions", 
      icon: ShieldCheck, 
      label: "กำหนดสิทธิ์การเข้าถึงระบบ", 
      desc: "ตั้งค่าสิทธิ์ตามขอบเขตงานและพื้นที่รับผิดชอบ",
      roles: ["ADMIN"]
    },
    { 
      key: "integrations", 
      icon: Key, 
      label: "การเชื่อมต่อ API & Webhook", 
      desc: "ระบบเชื่อมต่อ ERP, POS และ LINE Notify",
      roles: ["ADMIN"]
    },
    { 
      key: "settings", 
      icon: Settings, 
      label: "ตั้งค่านโยบายและเกณฑ์มาตรฐาน", 
      desc: "เกณฑ์คะแนนผ่าน ≥85% และกำหนดเวลาส่งงาน SLA",
      roles: ["STANDARD", "ADMIN"]
    },

    {
      key: "auditor_profile",
      icon: UserCheck,
      label: "ข้อมูลผู้ตรวจและสังกัด",
      desc: "ดูข้อมูลโปรไฟล์และพื้นที่ความรับผิดชอบ",
      roles: ["AUDITOR"]
    },
    {
      key: "branch_info",
      icon: Store,
      label: "ข้อมูลสาขาและคู่มือมาตรฐาน SOP",
      desc: "ดูข้อมูลประจำสาขาและเอกสารเกณฑ์มาตรฐานร้าน",
      roles: ["AUDITEE"]
    },
    {
      key: "contact_qa",
      icon: MessageSquare,
      label: "ติดต่อฝ่ายมาตรฐาน (QA Support)",
      desc: "สอบถามข้อสงสัยเกี่ยวกับเกณฑ์การตรวจประเมิน",
      roles: ["AUDITEE"]
    }
  ].filter((tool) => !tool.roles || tool.roles.includes(role));

  if (open === "master_management") {
    return <MasterManagementScreen onBack={() => setOpen(null)} />;
  }

  if (open === "reports") {
    return <ConsolidatedReportsScreen onBack={() => setOpen(null)} />;
  }

  if (open === "auditor_profile") {
    return (
      <AdminSubScreen title="ข้อมูลผู้ตรวจประเมิน" onBack={() => setOpen(null)}>
        <div className="rounded-3xl p-6 bg-white border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-[#0F6659] flex items-center justify-center text-xl font-bold">
              ส
            </div>
            <div>
              <div className="text-base sm:text-lg font-bold text-slate-900">คุณสมชาย ใจดี</div>
              <div className="text-xs text-slate-500 font-medium">ตำแหน่ง: เจ้าหน้าที่ตรวจสอบคุณภาพ (QC Lead)</div>
              <div className="text-xs text-emerald-700 font-semibold mt-0.5">สถานะ: ปฏิบัติหน้าที่หน้าร้าน (Active)</div>
            </div>
          </div>
          <div className="border-t pt-4 space-y-2 text-xs sm:text-sm text-slate-700">
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-400">สังกัดฝ่าย:</span>
              <span className="font-semibold">Quality Control (QC)</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-400">พื้นที่รับผิดชอบ:</span>
              <span className="font-semibold">กรุงเทพฯ ตอนกลาง & เหนือ</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-400">สิทธิ์การใช้งาน:</span>
              <span className="font-semibold text-emerald-800">ตรวจหน้างานตามแผนที่ได้รับมอบหมาย</span>
            </div>
          </div>
        </div>
      </AdminSubScreen>
    );
  }

  if (open === "branch_info") {
    return (
      <AdminSubScreen title="ข้อมูลสาขาและคู่มือ SOP" onBack={() => setOpen(null)}>
        <div className="rounded-3xl p-6 bg-white border border-slate-200 shadow-2xs space-y-4">
          <div className="text-base font-bold text-slate-900">🏬 Urban Burger - สาขาสยามพารากอน</div>
          <p className="text-xs text-slate-500 font-medium">รหัสสาขา: UB-BKK-001 · ชั้น G โซน Food Passage</p>
          <div className="border-t pt-3 space-y-2 text-xs sm:text-sm">
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="font-bold text-slate-800">📘 คู่มือมาตรฐานสุขอนามัยและความปลอดภัย v3.2</div>
              <div className="text-xs text-slate-500 mt-1">อัปเดตล่าสุด: 15 สิงหาคม 2569</div>
            </div>
          </div>
        </div>
      </AdminSubScreen>
    );
  }

  if (open === "contact_qa") {
    return (
      <AdminSubScreen title="ติดต่อฝ่ายมาตรฐาน (QA Support)" onBack={() => setOpen(null)}>
        <div className="rounded-3xl p-6 bg-white border border-slate-200 shadow-2xs space-y-4 text-center py-10">
          <MessageSquare size={40} className="mx-auto text-[#0F6659]" />
          <div className="text-base font-bold text-slate-900">ฝ่ายประกันคุณภาพ (Quality Assurance)</div>
          <p className="text-xs text-slate-500 font-medium max-w-sm mx-auto">
            หากมีข้อสงสัยเกี่ยวกับเกณฑ์คะแนนหรือต้องการคำแนะนำในการแก้ไขข้อบกพร่อง สามารถติดต่อได้ที่
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-50 text-[#0F6659] text-xs font-bold border border-emerald-200">
            📞 02-999-9999 ต่อ 102 (ทีม QA)
          </div>
        </div>
      </AdminSubScreen>
    );
  }

  if (open === "forms") {
    return <FormsScreen isDesktop={true} onBack={() => setOpen(null)} />;
  }

  if (open === "users") {
    return (
      <AdminSubScreen title="จัดการผู้ใช้งานและบทบาท" onBack={() => setOpen(null)}>
        <div className="space-y-3">
          {MOCK_USERS.map((u) => (
            <div key={u.id} className="rounded-3xl p-4 bg-white border border-slate-200 shadow-2xs flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-[#0F6659] flex items-center justify-center font-bold text-sm shrink-0">
                {u.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm sm:text-base font-extrabold text-slate-900 truncate">{u.name}</div>
                <div className="text-xs sm:text-sm text-slate-500 font-medium truncate mt-0.5">{u.role} · {u.email}</div>
              </div>
              <span className={`text-xs font-bold px-3 py-1 rounded-full shrink-0 ${
                u.status === "ใช้งานอยู่" ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-500'
              }`}>
                {u.status}
              </span>
            </div>
          ))}
        </div>
      </AdminSubScreen>
    );
  }

  if (open === "org") {
    return (
      <AdminSubScreen title="ผังโครงสร้างองค์กรและสาขา" onBack={() => setOpen(null)}>
        <div className="rounded-3xl p-6 bg-white border border-slate-200 shadow-2xs space-y-4">
          <div className="text-base sm:text-lg font-extrabold text-[#0F6659] border-b pb-3">{ORG_TREE.company}</div>
          {ORG_TREE.brands.map((b) => (
            <div key={b.name} className="ml-2 pl-4 border-l-2 border-emerald-400 space-y-2">
              <div className="text-sm sm:text-base font-bold text-slate-900">{b.name}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {b.regions.map((r) => (
                  <div key={r} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-medium text-slate-700">
                    📍 {r}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </AdminSubScreen>
    );
  }

  if (open === "permissions") {
    return (
      <AdminSubScreen title="กำหนดสิทธิ์การเข้าถึงระบบ" onBack={() => setOpen(null)}>
        <div className="flex flex-col gap-3">
          {ROLE_PERMISSIONS_LIST.map((r) => (
            <div key={r.role} className="rounded-3xl p-5 bg-white border border-slate-200 shadow-2xs space-y-2.5">
              <div className="text-sm sm:text-base font-extrabold text-slate-900">{r.role}</div>
              <div className="flex flex-wrap gap-2">
                {r.perms.map((p) => (
                  <span key={p} className="text-xs sm:text-sm font-bold px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-200">
                    ✓ {p}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </AdminSubScreen>
    );
  }

  if (open === "integrations") {
    return (
      <AdminSubScreen title="การเชื่อมต่อ API & Webhook" onBack={() => setOpen(null)}>
        <div className="rounded-3xl overflow-hidden bg-white border border-slate-200 shadow-2xs divide-y divide-slate-100">
          {API_INTEGRATIONS.map((a) => (
            <div key={a.name} className="flex items-center gap-4 px-5 py-4">
              <div className="flex-1 min-w-0">
                <div className="text-sm sm:text-base font-extrabold text-slate-900 truncate">{a.name}</div>
                <div className="text-xs text-slate-500 font-medium mt-0.5">ซิงก์ข้อมูลล่าสุด {a.lastSync}</div>
              </div>
              <span className={`text-xs font-bold px-3 py-1 rounded-full shrink-0 ${
                a.status === "เชื่อมต่อแล้ว" ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-600'
              }`}>
                {a.status}
              </span>
            </div>
          ))}
        </div>
      </AdminSubScreen>
    );
  }

  if (open === "settings") {
    return (
      <AdminSubScreen title="ตั้งค่านโยบายและเกณฑ์มาตรฐาน" onBack={() => setOpen(null)}>
        <div className="rounded-3xl p-6 bg-white border border-slate-200 shadow-2xs space-y-4">
          <div className="space-y-3">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-800 text-sm">เกณฑ์คะแนนผ่านขั้นต่ำ (Passing Threshold)</div>
                <div className="text-xs text-slate-500">กำหนดคะแนนร้อยละขั้นต่ำเพื่อให้ถือว่าผ่านการตรวจ</div>
              </div>
              <span className="text-base font-bold text-emerald-800 font-mono">85%</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-800 text-sm">กำหนดเวลาส่งแผนแก้ไข (CAP SLA)</div>
                <div className="text-xs text-slate-500">จำนวนวันที่สาขาต้องส่งหลักฐานหลังพบข้อบกพร่อง</div>
              </div>
              <span className="text-base font-bold text-amber-800 font-mono">3 วัน</span>
            </div>
          </div>
        </div>
      </AdminSubScreen>
    );
  }

  return (
    <div className="page-transition p-4 sm:p-6 space-y-4 w-full max-w-[100%] sm:max-w-[96%] md:max-w-[92%] mx-auto pb-12">
      {/* Page Header */}
      <div>
        <h2 className="text-base sm:text-lg font-bold text-slate-900">
          {role === "STANDARD" ? "เครื่องมือ QA" : role === "EXEC" ? "ศูนย์ข้อมูลผู้บริหาร" : role === "ADMIN" ? "เครื่องมือผู้ดูแลระบบ" : "ระบบของฉัน"}
        </h2>
        <p className="text-xs font-medium text-slate-500 mt-0.5">
          รวมเครื่องมือที่เกี่ยวข้องกับบทบาทและสิทธิ์การใช้งานของคุณ
        </p>
      </div>

      {/* 🌟 LONG VERTICAL LIST (ลิสต์ยาวเต็มแถว ตัวหนังสือใหญ่ อ่านง่ายมาก) */}
      <div className="flex flex-col gap-3.5">
        {tools.map((tItem) => (
          <button 
            key={tItem.key} 
            onClick={() => tItem.route && onNavigate ? onNavigate(tItem.route) : setOpen(tItem.key)} 
            className={`w-full rounded-3xl p-5 sm:p-6 flex items-center gap-4 text-left shadow-2xs transition-all cursor-pointer group active:scale-98 border ${
              tItem.featured
                ? 'bg-gradient-to-r from-emerald-50/70 via-white to-white border-emerald-300 hover:border-[#0F6659] shadow-xs ring-1 ring-emerald-500/20'
                : 'bg-white border-slate-200 hover:border-emerald-500 hover:shadow-xs'
            }`}
          >
            {/* Large Icon Box */}
            <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shrink-0 border transition-colors ${
              tItem.featured
                ? 'bg-[#0F6659] text-white border-emerald-600 shadow-2xs'
                : 'bg-emerald-50 text-[#0F6659] border-emerald-200 group-hover:bg-[#0F6659] group-hover:text-white'
            }`}>
              <tItem.icon size={26} />
            </div>

            {/* Label & Description */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 block group-hover:text-[#0F6659] transition-colors leading-snug">
                  {tItem.label}
                </h3>
                {tItem.featured && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-[#0F6659] border border-emerald-300">
                    เมนูหลัก
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5 line-clamp-1">
                {tItem.desc}
              </p>
            </div>

            {/* Large Right Arrow */}
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-50 text-slate-400 group-hover:text-[#0F6659] group-hover:bg-emerald-50 transition-all shrink-0">
              <ChevronRight size={20} className="group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
