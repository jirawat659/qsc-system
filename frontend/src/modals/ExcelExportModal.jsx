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



export default function ExcelExportModal({ initialUnit = null, onClose }) {
  const { locations } = React.useContext(DataContext);
  const isBranchScoped = !!initialUnit;
  const [exportMode, setExportMode] = useState(isBranchScoped ? "detailed_questions" : "all"); // 'all' | 'unit' | 'detailed_questions'
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUnit, setSelectedUnit] = useState(initialUnit || locations[0]);
  const [selectedRound, setSelectedRound] = useState("latest"); // 'latest' | 'round_index' | 'all' | '1M' | '3M' | '6M' | '1Y'
  const [timeRange, setTimeRange] = useState("all"); // 'all' | '1M' | '3M' | '6M' | '1Y'
  const [regionFilter, setRegionFilter] = useState("all");

  const filteredUnits = useMemo(() => {
    if (!searchQuery.trim()) return locations;
    const q = searchQuery.toLowerCase();
    return locations.filter(u => 
      u.name.toLowerCase().includes(q) || 
      u.fullName.toLowerCase().includes(q) || 
      u.region.toLowerCase().includes(q) ||
      u.address.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const handleDownload = () => {
    exportToExcel({
      mode: exportMode,
      targetUnit: selectedUnit,
      timeRange: isBranchScoped ? selectedRound : timeRange,
      region: regionFilter
    });
    onClose();
  };

  return (
    <ModalWrapper onClose={onClose} maxWidth="max-w-lg">
      <div className="p-5 sm:p-6 space-y-4 flex-1 overflow-y-auto min-h-0" style={{ background: c.surface }}>
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: c.border }}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-800 shrink-0">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <span className="text-sm font-bold block" style={{ color: c.ink }}>
                {isBranchScoped ? `ส่งออกรายงาน: ${selectedUnit.fullName || selectedUnit.name}` : "ส่งออกข้อมูลรายงาน Excel (.csv)"}
              </span>
              <span className="text-xs text-slate-500">
                {isBranchScoped ? `ภูมิภาค: ${selectedUnit.region}` : "ศูนย์รวบรวมข้อมูลการตรวจมาตรฐาน Q.S.C."}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100 cursor-pointer text-slate-400 hover:text-slate-700">
            <X size={16} />
          </button>
        </div>

        {/* ---------------- SCENARIO A: OPENED FROM SPECIFIC BRANCH PROFILE ---------------- */}
        {isBranchScoped ? (
          <div className="space-y-4">
            {/* 1. Report Type Selector (คำตอบรายข้อ vs สรุปประวัติคะแนน) */}
            <div>
              <label className="text-xs font-bold block mb-1.5 text-slate-700">1. เลือกประเภทรายงานที่ต้องการนำออก</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setExportMode("detailed_questions")}
                  className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                    exportMode === "detailed_questions"
                      ? 'bg-emerald-50 border-emerald-600 shadow-2xs'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span>คำตอบรายข้อ คอมเมนต์</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1 leading-snug">
                    คำตอบรายข้อ ประเภทคำตอบ รูปถ่าย
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setExportMode("unit")}
                  className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                    exportMode === "unit"
                      ? 'bg-emerald-50 border-emerald-600 shadow-2xs'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span>ประวัติคะแนน</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1 leading-snug">
                    สรุปคะแนนย้อนหลัง
                  </div>
                </button>
              </div>
            </div>

            {/* 2. Inspection Round / Time Range Selector */}
            <div>
              <label className="text-xs font-bold block mb-1.5 text-slate-700">2. เลือกรอบการตรวจ หรือช่วงเวลาย้อนหลัง</label>
              <select
                value={selectedRound}
                onChange={(e) => setSelectedRound(e.target.value)}
                className="w-full text-xs p-3 rounded-xl outline-none font-bold border"
                style={{ background: c.bg, color: c.ink, borderColor: c.border }}
              >
                {/*<optgroup label="เลือกรอบการตรวจเฉพาะรอบ">
                  {(selectedUnit.history || []).map((h, i) => (
                    <option key={i} value={i === 0 ? "latest" : `round_${i}`}>
                      {i === 0 ? `⭐ รอบตรวจล่าสุด (${h.date}) — คะแนน ${h.score}%` : `รอบตรวจวันที่ ${h.date} — คะแนน ${h.score}%`}
                    </option>
                  ))}
                </optgroup>*/}
                <optgroup label="เลือกช่วงเวลาย้อนหลัง">
                  <option value="all">ทั้งหมด ({selectedUnit.history?.length || 0} รอบ)</option>
                  <option value="1M">ย้อนหลัง 1 เดือน</option>
                  <option value="3M">ย้อนหลัง 3 เดือน</option>
                  <option value="6M">ย้อนหลัง 6 เดือน</option>
                  <option value="1Y">ย้อนหลัง 1 ปี</option>
                </optgroup>
              </select>
            </div>

            {/* Information Summary Card */}
            <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-950 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                <CheckCircle2 size={14} className="text-emerald-700" />
                <span>เตรียมไฟล์ (.csv):</span>
              </div>
              <div className="text-xs text-emerald-800 leading-relaxed pl-5">
                • สาขา: <b>{selectedUnit.name}</b>
                <br />
                • ประเภท: <b>{exportMode === "detailed_questions" ? "รายงานคำตอบแบบฟอร์มรายข้อ + คอมเมนต์" : "ประวัติสรุปคะแนน"}</b>
              </div>
            </div>
          </div>
        ) : (
          /* ---------------- SCENARIO B: OPENED FROM MAIN DASHBOARD ---------------- */
          <div className="space-y-4">
            {/* Mode Selector Tabs */}
            <div className="flex bg-slate-200/80 p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => setExportMode("all")}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  exportMode === "all" ? 'bg-white text-[#0F6659] shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                📊 รวมทุกสาขาทั่วประเทศ
              </button>
              <button
                type="button"
                onClick={() => setExportMode("detailed_questions")}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  exportMode === "detailed_questions" ? 'bg-white text-[#0F6659] shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🏢 ค้นหาเลือกรายสาขา
              </button>
            </div>

            {exportMode === "all" ? (
              <div className="space-y-3.5">
                <div>
                  <label className="text-xs font-bold block mb-1" style={{ color: c.muted }}>เลือกช่วงเวลาการตรวจ</label>
                  <select
                    value={timeRange}
                    onChange={(e) => setTimeRange(e.target.value)}
                    className="w-full text-xs p-3 rounded-xl outline-none font-bold border"
                    style={{ background: c.bg, color: c.ink, borderColor: c.border }}
                  >
                    <option value="all">ทั้งหมด (ทุกรอบตรวจที่บันทึกไว้)</option>
                    <option value="1M">รอบตรวจ 1 เดือนล่าสุด (สิงหาคม 2569)</option>
                    <option value="3M">รอบตรวจย้อนหลัง 3 เดือน (Q3 2569)</option>
                    <option value="6M">รอบตรวจย้อนหลัง 6 เดือน (มี.ค. - ส.ค. 69)</option>
                    <option value="1Y">รอบตรวจทั้งปี (YTD 2569)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold block mb-1" style={{ color: c.muted }}>กรองตามภูมิภาค</label>
                  <select
                    value={regionFilter}
                    onChange={(e) => setRegionFilter(e.target.value)}
                    className="w-full text-xs p-3 rounded-xl outline-none font-bold border"
                    style={{ background: c.bg, color: c.ink, borderColor: c.border }}
                  >
                    <option value="all">ทุกภูมิภาคทั่วประเทศ (100+ สาขา)</option>
                    <option value="กรุงเทพ">เขตกรุงเทพฯ และปริมณฑล</option>
                    <option value="เหนือ">เขตภาคเหนือ</option>
                    <option value="ตะวันออก">เขตภาคตะวันออก</option>
                    <option value="ใต้">เขตภาคใต้</option>
                  </select>
                </div>
              </div>
            ) : (
              <div className="space-y-3.5">
                <div>
                  <label className="text-xs font-bold block mb-1" style={{ color: c.muted }}>ค้นหาสาขาที่ต้องการส่งออก</label>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="พิมพ์ชื่อสาขา เช่น สยาม, อารีย์, เชียงใหม่..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full text-xs pl-8 pr-8 py-2.5 rounded-xl outline-none font-bold border"
                      style={{ background: c.bg, color: c.ink, borderColor: c.border }}
                    />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer">
                        <X size={13} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="max-h-36 overflow-y-auto space-y-1.5 p-1 border rounded-2xl" style={{ borderColor: c.border, background: c.bg }}>
                  {filteredUnits.length === 0 && (
                    <div className="text-center py-4 text-xs text-slate-400 font-medium">ไม่พบสาขาที่ค้นหา</div>
                  )}
                  {filteredUnits.map((u) => {
                    const isSelected = selectedUnit?.name === u.name;
                    return (
                      <button
                        key={u.name}
                        type="button"
                        onClick={() => setSelectedUnit(u)}
                        className={`w-full p-2.5 rounded-xl text-left flex items-center justify-between transition-all cursor-pointer ${
                          isSelected ? 'bg-white shadow-2xs border border-emerald-600' : 'hover:bg-white/80 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <ScoreRing score={u.lastScore} size={30} />
                          <div className="min-w-0 truncate">
                            <div className="text-xs font-bold truncate text-slate-900">{u.name}</div>
                            <div className="text-xs text-slate-400 truncate">{u.region}</div>
                          </div>
                        </div>
                        {isSelected && <Check size={16} className="text-emerald-700 shrink-0 mr-1" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Download Action Button */}
        <button
          type="button"
          onClick={handleDownload}
          className="w-full py-3.5 px-4 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all hover:scale-[1.01] active:scale-[0.99]"
          style={{ background: c.accent, color: "#fff" }}
        >
          <Download size={16} className="shrink-0" />
          <span className="truncate max-w-[260px] sm:max-w-none">
            {isBranchScoped 
              ? `ดาวน์โหลดรายงาน Excel (${selectedUnit.name})` 
              : exportMode === "all" 
              ? "ดาวน์โหลดรายงาน Excel รวมทุกสาขา" 
              : `ดาวน์โหลดรายงาน: ${selectedUnit?.name}`}
          </span>
        </button>
      </div>
    </ModalWrapper>
  );
}
