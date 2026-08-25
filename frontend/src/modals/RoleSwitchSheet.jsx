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



export default function RoleSwitchSheet({ role, selectedAuditor, onSelectRole, onSelectAuditor, onClose }) {
  const [activeTab, setActiveTab] = useState("roles");
  const [searchAuditor, setSearchAuditor] = useState("");
  const [zoneFilter, setZoneFilter] = useState("all");

  const filteredAuditors = useMemo(() => {
    return AUDITORS_DATA.filter((a) => {
      const matchZone = zoneFilter === "all" || a.team.includes(zoneFilter) || a.teamLabel.includes(zoneFilter);
      const q = searchAuditor.toLowerCase();
      const matchSearch =
        !searchAuditor.trim() ||
        a.name.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q) ||
        a.role.toLowerCase().includes(q) ||
        a.team.toLowerCase().includes(q) ||
        a.expertise.toLowerCase().includes(q);
      return matchZone && matchSearch;
    });
  }, [searchAuditor, zoneFilter]);

  return (
    <ModalWrapper onClose={onClose} maxWidth="max-w-lg">
      <div className="p-5 sm:p-6 space-y-4 flex-1 overflow-y-auto min-h-0 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b shrink-0" style={{ borderColor: c.border }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold">
              <Users size={18} />
            </div>
            <div>
              <span className="text-sm sm:text-base font-bold block leading-none" style={{ color: c.ink }}>
                บัญชีผู้ใช้งานระบบ
              </span>
              <span className="text-xs font-medium text-slate-400 mt-0.5 block">
                เลือกบัญชีผู้ตรวจหรือบทบาทอื่นๆ
              </span>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-100 cursor-pointer" style={{ background: c.bg }}>
            <X size={15} style={{ color: c.muted }} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex p-1 rounded-2xl bg-slate-100/80 border border-slate-200/60 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("roles")}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === "roles"
                ? "bg-white text-emerald-900 shadow-xs border border-slate-200/60"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Layers size={14} className={activeTab === "roles" ? "text-emerald-700" : "text-slate-400"} />
            <span>บทบาท ({ROLES.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("auditors")}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === "auditors"
                ? "bg-white text-emerald-900 shadow-xs border border-slate-200/60"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <UserCheck size={14} className={activeTab === "auditors" ? "text-emerald-700" : "text-slate-400"} />
            <span>บัญชีผู้ตรวจ ({AUDITORS_DATA.length})</span>
          </button>
        </div>

        {/* TAB 1: ALL ROLES SIMULATION */}
        {activeTab === "roles" && (
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {ROLES.map((r) => {
              const isSelected = role === r.id;
              const rUser = r.id === "AUDITOR" ? selectedAuditor : ROLE_USER_MAP[r.id];
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    if (r.id === "AUDITOR") {
                      onSelectAuditor(selectedAuditor || AUDITORS_DATA[0]);
                    } else {
                      onSelectRole(r.id);
                    }
                    onClose();
                  }}
                  className={`w-full p-4 rounded-2xl border text-left cursor-pointer transition-all ${
                    isSelected
                      ? "bg-emerald-50/90 border-2 border-emerald-600 shadow-md ring-2 ring-emerald-600/20"
                      : "bg-white border-slate-200 hover:border-emerald-300 hover:bg-slate-50 shadow-2xs text-slate-800"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs shadow-xs ${
                        isSelected ? 'bg-[#0F6659] text-white' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {rUser?.avatar || r.label.slice(0, 2)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs sm:text-sm font-bold text-slate-900">{r.label}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-mono font-bold ${
                            isSelected ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {r.id}
                          </span>
                          {isSelected && (
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white flex items-center gap-1">
                              <Check size={11} strokeWidth={3} /> กำลังใช้งาน
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-semibold mt-0.5 text-slate-600">
                          ชื่อจำลอง: {rUser?.name} ({rUser?.title || rUser?.role || "ผู้ตรวจ"})
                        </div>
                        <div className="text-xs mt-0.5 text-slate-500">
                          {r.desc}
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                        <Check size={14} strokeWidth={3} />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
        
        {/* TAB 2: ALL 6 AUDITORS SIMULATION */}
        {activeTab === "auditors" && (
          <div className="flex-1 flex flex-col min-h-0 space-y-3">
            {/* Search and Zone Filter */}
            <div className="space-y-2 shrink-0">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="ค้นหาผู้ตรวจ..."
                  value={searchAuditor}
                  onChange={(e) => setSearchAuditor(e.target.value)}
                  className="w-full text-xs pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 outline-none font-bold text-slate-800 focus:border-emerald-600 focus:bg-white transition-all"
                />
                {searchAuditor && (
                  <button onClick={() => setSearchAuditor("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer">
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Zone Filter Chips */}
              <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
                {[
                  { key: "all", label: "ทั้งหมด" },
                  { key: "กทม.", label: "กทม. และปริมณฑล" },
                  { key: "ภาคเหนือ", label: "ภาคเหนือ/อีสาน" },
                  { key: "ภาคตะวันออก", label: "ตะวันออก/ใต้" },
                ].map(chip => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => setZoneFilter(chip.key)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold shrink-0 cursor-pointer transition-colors ${
                      zoneFilter === chip.key
                        ? 'bg-emerald-800 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            {/* List of 6 Auditor Cards */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1" style={{ scrollbarWidth: "thin" }}>
              {filteredAuditors.map((auditor) => {
                const isSelected = role === "AUDITOR" && selectedAuditor?.id === auditor.id;
                return (
                  <div
                    key={auditor.id}
                    onClick={() => {
                      onSelectAuditor(auditor);
                      onClose();
                    }}
                    className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer text-left ${
                      isSelected
                        ? "bg-emerald-50/90 border-2 border-emerald-600 shadow-md ring-2 ring-emerald-600/20"
                        : "bg-white border-slate-200/90 hover:border-emerald-300 hover:bg-slate-50/80 shadow-2xs"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm text-white shadow-xs shrink-0"
                          style={{ background: auditor.badgeColor }}
                        >
                          {auditor.avatar}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs sm:text-sm font-bold text-slate-900">{auditor.name}</span>
                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                              {auditor.id}
                            </span>
                            {isSelected && (
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white flex items-center gap-1">
                                <Check size={11} strokeWidth={3} /> กำลังใช้งาน
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-600 font-semibold mt-0.5">
                            {auditor.role}{/* · {auditor.team}*/}
                          </div>
                          {/*<div className="text-xs text-slate-400 font-medium flex items-center gap-3 mt-1 flex-wrap">
                            <span>✉️ {auditor.email}</span>
                            <span>📞 {auditor.phone}</span>
                          </div>*/}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs flex-wrap gap-2">
                      <div className="text-slate-500 font-medium">
                        ประสบการณ์: <b className="text-slate-700">{auditor.expYears}</b> · ตรวจแล้ว: <b className="text-slate-700">{auditor.completedAudits} สาขา</b> · คะแนนเฉลี่ย: <b className="text-emerald-700">{auditor.avgScore}</b>
                      </div>
                      <button
                        type="button"
                        className="text-xs font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 cursor-pointer bg-emerald-100/70 px-2.5 py-1 rounded-xl"
                      >
                        เข้าสู่ระบบ ➔
                      </button>
                    </div>
                  </div>
                );
              })}

              {filteredAuditors.length === 0 && (
                <div className="text-center py-8 text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  ไม่พบผู้ตรวจที่ตรงกับคำค้นหา
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </ModalWrapper>
  );
}
