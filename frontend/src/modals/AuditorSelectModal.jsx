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
import ModalWrapper from "../shared/ModalWrapper";
import Header from "../shared/Header";
import Section from "../shared/Section";
import ScoreRing from "../shared/ScoreRing";
import HistoryList from "../shared/HistoryList";
import ErrorBoundary from "../shared/ErrorBoundary";
import api from "../config/api";


import { DataContext } from "../context/DataContext";

let cachedAuditorsData = null;

export default function AuditorSelectModal({ currentAuditor, onSelect, onClose }) {
  const { schedules } = React.useContext(DataContext);
  const [search, setSearch] = useState("");
  const [teamTab, setTeamTab] = useState("all");
  const [dbUsers, setDbUsers] = useState(() => cachedAuditorsData || []);

  useEffect(() => {
    let isMounted = true;
    api.get('/user')
      .then(res => {
        if (isMounted && res.data && Array.isArray(res.data)) {
          // แสดงเฉพาะผู้ที่มีสิทธิ์ตรวจ (Role AUDITOR เท่านั้น)
          const auditorsOnly = res.data.filter(u => 
            u.roleCode === 'AUDITOR' || 
            u.role === 'AUDITOR' || 
            (u.roleName && (u.roleName.includes('ผู้ตรวจ') || u.roleName.includes('Auditor')))
          );
          cachedAuditorsData = auditorsOnly;
          setDbUsers(auditorsOnly);
        }
      })
      .catch(err => console.warn("Could not load users for AuditorSelectModal:", err));
    return () => { isMounted = false; };
  }, []);

  const auditorsList = useMemo(() => {
    if (dbUsers.length > 0) {
      return dbUsers.map(u => {
        const uName = u.fullName || u.username;
        // Compute real active audit tasks for this auditor from live schedules
        const activeCount = (schedules || []).filter(s => {
          const matchAuditor = (s.auditorName && s.auditorName.includes(uName)) ||
            (s.auditor && s.auditor.includes(uName)) ||
            (s.auditors && s.auditors.some(a => a.fullName && a.fullName.includes(uName)));
          return matchAuditor && s.status !== "completed";
        }).length;

        return {
          id: u.id,
          name: uName,
          role: u.roleName || "ผู้ตรวจประเมิน (QA Auditor)",
          team: u.roleCode === 'AUDITOR' ? 'qa' : 'ops',
          teamLabel: u.roleName || 'ทีมผู้ตรวจประเมิน (QA)',
          phone: u.phoneNumber || u.phone || "-",
          avatar: (u.fullName || u.username || "AU").substring(0, 2),
          rating: null,
          auditsCount: activeCount,
          activeCount: activeCount
        };
      });
    }
    return [];
  }, [dbUsers, schedules]);

  const filteredAuditors = useMemo(() => {
    let list = [...auditorsList];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a => 
        a.name.toLowerCase().includes(q) || 
        a.role.toLowerCase().includes(q) || 
        a.teamLabel.toLowerCase().includes(q)
      );
    }
    return list;
  }, [auditorsList, search]);

  return (
    <ModalWrapper onClose={onClose} maxWidth="max-w-md">
        {/* Modal Header */}
        <div className="shrink-0 p-4 border-b flex items-center justify-between" style={{ borderColor: c.border, background: "#FAF9F5" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-800 shrink-0">
              <Users size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold" style={{ color: c.ink }}>เลือกผู้ตรวจประเมิน</h3>
              <p className="text-xs" style={{ color: c.faint }}>จัดกลุ่มตามทีมและค้นหารายชื่อ</p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-200 active:scale-90 cursor-pointer transition-all">
            <X size={18} style={{ color: c.faint }} />
          </button>
        </div>

        {/* Search & Team Filter Tabs */}
        <div className="p-3 border-b space-y-2 bg-white" style={{ borderColor: c.border }}>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: c.faint }} />
            <input
              type="text"
              placeholder="ค้นหาชื่อผู้ตรวจ, บทบาท, หรือทีม..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8.5 pr-3 py-2 text-xs rounded-xl border outline-none focus:border-emerald-600 font-medium ios-zoom-fix-xs"
              style={{ borderColor: c.border, background: c.bg }}
            />
          </div>

          {/*<div className="flex gap-1 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
            {[
              { key: "all", label: "ทั้งหมด" },
              { key: "กทม. และปริมณฑล", label: "กทม./ปริมณฑล" },
              { key: "ภาคเหนือและอีสาน", label: "เหนือ/อีสาน" },
              { key: "ภาคตะวันออกและใต้", label: "ตะวันออก/ใต้" },
            ].map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setTeamTab(tab.key)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 cursor-pointer transition-colors ${
                  teamTab === tab.key ? 'bg-[#0F6659] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>*/}
        </div>

        {/* List of Auditors - Clean, spacious cards without divide-y clashing */}
        <div className="flex-1 overflow-y-auto min-h-0 custom-tab-scrollbar p-3 pb-6 space-y-2" style={{ background: "#FAF9F5" }}>
          {/* Quick Option: All Auditors Card */}
          {/*<button
            type="button"
            onClick={() => { onSelect("ทั้งหมด"); onClose(); }}
            className={`w-full flex items-center justify-between p-3 rounded-2xl text-left cursor-pointer transition-all ${
              currentAuditor === "ทั้งหมด"
                ? 'bg-emerald-50/90 border-2 border-emerald-600 shadow-xs'
                : 'bg-white border border-slate-200/80 hover:border-emerald-300 hover:bg-slate-50/80 shadow-2xs'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                currentAuditor === "ทั้งหมด" ? 'bg-emerald-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-700'
              }`}>
                All
              </div>
              <div className="min-w-0">
                <div className="text-xs sm:text-xs sm:text-sm font-bold" style={{ color: c.ink }}>ผู้ตรวจทุกคน (ทั้งหมดในระบบ)</div>
                <div className="text-xs font-medium" style={{ color: c.faint }}>แสดงตารางงานของทุกคนพร้อมกัน</div>
              </div>
            </div>
            {currentAuditor === "ทั้งหมด" && (
              <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <Check size={13} strokeWidth={3} />
              </div>
            )}
          </button>*/}
          {/* Individual Auditor Cards */}
          {filteredAuditors.map((auditor) => {
            const isSelected = currentAuditor === auditor.name;
            return (
              <button
                key={auditor.id}
                type="button"
                onClick={() => { onSelect(auditor.name); onClose(); }}
                className={`w-full flex items-center justify-between p-3 rounded-2xl text-left cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-emerald-50/90 border-2 border-emerald-600 shadow-xs'
                    : 'bg-white border border-slate-200/80 hover:border-emerald-300 hover:bg-slate-50/80 shadow-2xs'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                    isSelected ? 'bg-emerald-600 text-white shadow-2xs' : 'bg-emerald-100/80 text-emerald-800'
                  }`}>
                    {auditor.name.slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs sm:text-xs sm:text-sm font-bold truncate" style={{ color: c.ink }}>{auditor.name}</div>
                    <div className="text-xs text-slate-500 font-medium truncate mt-0.5">
                      {auditor.teamLabel} · {auditor.role}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/60">
                    {auditor.activeCount} งานตรวจ
                  </span>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <Check size={13} strokeWidth={3} />
                    </div>
                  )}
                </div>
              </button>
            );
          })}

          {filteredAuditors.length === 0 && (
            <div className="text-center text-xs py-10 text-slate-400 font-medium bg-white rounded-2xl border border-slate-200">
              ไม่พบรายชื่อผู้ตรวจตามคำค้นหา
            </div>
          )}
        </div>
    </ModalWrapper>
  );
}
