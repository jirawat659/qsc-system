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
import api from "../../config/api";

import ModalWrapper from "../../shared/ModalWrapper";
import Header from "../../shared/Header";
import Section from "../../shared/Section";
import ScoreRing from "../../shared/ScoreRing";
import HistoryList from "../../shared/HistoryList";
import ErrorBoundary from "../../shared/ErrorBoundary";
import FormEditorScreen from "./FormEditorScreen";


export default function FormsScreen({ isDesktop, onBack, role = "STANDARD" }) {
  const { forms, refreshData } = React.useContext(DataContext);
  const [editing, setEditing] = useState(undefined);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [locationTypes, setLocationTypes] = useState([]);
  const [deleteModalForm, setDeleteModalForm] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const canManageForms = role === "STANDARD" || role === "ADMIN";

  const handleDeleteForm = async () => {
    if (!deleteModalForm) return;
    setIsDeleting(true);
    try {
      if (deleteModalForm.id && typeof deleteModalForm.id === 'number') {
        await api.delete(`/form/${deleteModalForm.id}`);
      }
      if (refreshData) refreshData();
    } catch (err) {
      console.error("Error deleting form:", err);
      alert("ไม่สามารถลบแบบฟอร์มได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsDeleting(false);
      setDeleteModalForm(null);
    }
  };

  // Fetch location types / categories dynamically from database
  useEffect(() => {
    let isMounted = true;
    api.get('/location-type')
      .then(res => {
        if (isMounted && res.data && Array.isArray(res.data)) {
          setLocationTypes(res.data);
        }
      })
      .catch(err => {
        console.warn("Could not load location types from API:", err);
      });
    return () => { isMounted = false; };
  }, []);

  const formsList = useMemo(() => {
    if (forms && forms.length > 0) {
      return forms.map(f => ({
        id: f.id,
        name: f.title,
        title: f.title,
        version: f.version || "v1.0",
        date: f.createdAt ? new Date(f.createdAt).toLocaleDateString('th-TH') : "15 ส.ค. 2569",
        author: f.createdBy?.fullName || "ทีมมาตรฐาน QA",
        type: f.locationTypeName || f.locationType?.name || f.locationType?.code || "หน้าร้าน",
        locationTypeId: f.locationTypeId,
        status: f.isActive ? "active" : "draft",
        usedCount: f.usedCount !== undefined ? f.usedCount : (f.auditRecords?.length || 0),
        scheduledCount: f.scheduledCount || 0,
        isInUse: f.isInUse || (f.usedCount > 0) || (f.scheduledCount > 0),
        itemCount: f.sections ? f.sections.reduce((acc, s) => acc + (s.items?.length || 0), 0) : 11,
        totalScore: f.sections ? f.sections.reduce((acc, s) => acc + (s.items ? s.items.reduce((iAcc, i) => iAcc + (Number(i.fullScore) || 10), 0) : 0), 0) : 100,
        sections: f.sections || []
      }));
    }
    return INITIAL_FORMS_LIST;
  }, [forms]);

  // Dynamically create category tabs from database location types
  const categoryTabs = useMemo(() => {
    if (locationTypes && locationTypes.length > 0) {
      return [
        { key: "all", label: "ทั้งหมด" },
        ...locationTypes.map(lt => {
          const shortName = lt.name?.split('(')[0]?.trim() || lt.name || lt.code;
          return {
            key: String(lt.id),
            id: lt.id,
            code: lt.code,
            label: shortName,
            fullLabel: lt.name || lt.code
          };
        })
      ];
    }

    // Fallback: derive distinct types from loaded forms
    const distinctTypes = Array.from(new Set(formsList.map(f => f.type).filter(Boolean)));
    if (distinctTypes.length > 0) {
      return [
        { key: "all", label: "ทั้งหมด" },
        ...distinctTypes.map(t => ({
          key: t,
          label: t.split('(')[0]?.trim() || t,
          fullLabel: t
        }))
      ];
    }

    return [{ key: "all", label: "ทั้งหมด" }];
  }, [locationTypes, formsList]);

  if (editing !== undefined) {
    return (
      <FormEditorScreen
        form={editing}
        readOnly={!canManageForms}
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
    let matchType = filterType === "all";
    if (!matchType) {
      const selectedTab = categoryTabs.find(t => t.key === filterType);
      if (selectedTab) {
        if (f.locationTypeId && selectedTab.id && f.locationTypeId === selectedTab.id) {
          matchType = true;
        } else {
          const typeStr = (f.type || "").toLowerCase();
          const codeMatch = selectedTab.code && typeStr.includes(selectedTab.code.toLowerCase());
          const labelMatch = selectedTab.label && typeStr.includes(selectedTab.label.toLowerCase());
          const fullMatch = selectedTab.fullLabel && typeStr.includes(selectedTab.fullLabel.toLowerCase());
          const keyMatch = typeStr.includes(filterType.toLowerCase());
          matchType = Boolean(codeMatch || labelMatch || fullMatch || keyMatch);
        }
      }
    }
    const q = searchTerm.toLowerCase();
    const matchSearch = !searchTerm.trim() || f.name.toLowerCase().includes(q) || f.type?.toLowerCase().includes(q) || f.version?.toLowerCase().includes(q);
    return matchType && matchSearch;
  });

  return (
    <div className="page-transition p-4 sm:p-6 space-y-4 w-full max-w-[100%] sm:max-w-[96%] md:max-w-[92%] mx-auto pb-12">
      <Header
        title="แบบฟอร์มการตรวจมาตรฐาน"
        subtitle="จัดการแบบฟอร์ม เกณฑ์คะแนนผ่าน และผู้ตรวจที่ได้รับมอบหมาย"
        onBack={onBack}
      />

      {/* Search & Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาชื่อแบบฟอร์ม, หรือหมวดหมู่..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs sm:text-sm pl-10 pr-9 py-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs outline-none font-normal text-slate-600 focus:text-slate-800 focus:border-[#0F6659] transition-colors placeholder:text-slate-400"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm("")} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer rounded-lg">
              <X size={14} />
            </button>
          )}
        </div>

        {canManageForms && (
          <button
            type="button"
            onClick={() => setEditing(null)}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#0F6659] hover:bg-emerald-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs cursor-pointer active:scale-95 transition-all shrink-0"
          >
            <Plus size={15} />
            <span>สร้างฟอร์มใหม่</span>
          </button>
        )}
      </div>

      {/* Dynamic Filter Pills from Database */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
        {categoryTabs.map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilterType(tab.key)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 cursor-pointer transition-all active:scale-95 ${
              filterType === tab.key
                ? 'bg-[#0F6659] text-white shadow-2xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Forms List */}
      <div className="flex flex-col gap-3">
        {filteredForms.map((f) => (
          <div
            key={f.id}
            onClick={() => setEditing(f)}
            className="w-full rounded-2xl p-4 sm:p-5 bg-white border border-slate-200 shadow-2xs hover:border-[#0F6659] hover:shadow-xs transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left group"
          >
            {/* Left Info */}
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 bg-emerald-50 text-[#0F6659] border border-emerald-200 group-hover:bg-[#0F6659] group-hover:text-white transition-colors">
                <ClipboardCheck size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm sm:text-base font-bold text-slate-800 leading-snug group-hover:text-[#0F6659] transition-colors truncate">
                  {f.name}
                </h3>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <span className="text-[11px] sm:text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                    {f.type}
                  </span>
                  <span className="text-[11px] sm:text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-[#0F6659] border border-emerald-200">
                    เกณฑ์ ≥ {f.passingScore || 85}%
                  </span>
                  <span className="text-[11px] sm:text-xs font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200/80">
                    {f.itemCount} {f.totalScore || 100} คะแนน
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
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 border border-slate-200 group-hover:bg-[#0F6659] group-hover:text-white group-hover:border-[#0F6659] cursor-pointer shadow-2xs active:scale-95 flex items-center gap-1 bg-slate-50/80 transition-all"
              >
                <span>แก้ไขฟอร์ม</span>
                <ChevronRight size={14} />
              </button>

              {canManageForms && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteModalForm(f);
                  }}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 cursor-pointer shadow-2xs active:scale-90 transition-all"
                  title="ลบแบบฟอร์มนี้"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          </div>
        ))}

        {filteredForms.length === 0 && (
          <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200 text-sm text-slate-400 font-bold">
            ไม่พบแบบฟอร์มที่ตรงกับคำค้นหา
          </div>
        )}
      </div>

      {/* 🛑 Delete Form Confirmation Modal with Smart In-Use Warning */}
      {deleteModalForm && (
        <ModalWrapper onClose={() => !isDeleting && setDeleteModalForm(null)} maxWidth="max-w-md">
          <div className="p-6 space-y-4 text-center">
            {/* Warning Icon */}
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto shadow-xs ${
              deleteModalForm.isInUse || deleteModalForm.usedCount > 0 || deleteModalForm.scheduledCount > 0
                ? "bg-amber-100 text-amber-600"
                : "bg-rose-100 text-rose-600"
            }`}>
              {deleteModalForm.isInUse || deleteModalForm.usedCount > 0 || deleteModalForm.scheduledCount > 0 ? (
                <AlertTriangle size={28} strokeWidth={2.2} />
              ) : (
                <Trash2 size={26} strokeWidth={2.2} />
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-base sm:text-lg font-black text-slate-800">
                {deleteModalForm.isInUse || deleteModalForm.usedCount > 0 || deleteModalForm.scheduledCount > 0
                  ? "คำเตือน: แบบฟอร์มนี้มีการใช้งานอยู่!"
                  : "ยืนยันการลบแบบฟอร์ม?"}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-sm mx-auto">
                ต้องการลบแบบฟอร์ม <strong className="text-slate-800">"{deleteModalForm.name || deleteModalForm.title}"</strong> ออกจากระบบใช่หรือไม่?
              </p>
            </div>

            {/* In-Use Alert Box */}
            {(deleteModalForm.isInUse || deleteModalForm.usedCount > 0 || deleteModalForm.scheduledCount > 0) ? (
              <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200 text-left space-y-1.5 text-xs text-amber-900">
                <div className="font-bold flex items-center gap-1.5 text-amber-800">
                  <AlertTriangle size={14} className="shrink-0 text-amber-600" />
                  <span>ประวัติการใช้งานในระบบปัจจุบัน:</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-slate-700 pl-1 text-[11px]">
                  {deleteModalForm.usedCount > 0 && (
                    <li>มีการใช้ตรวจประเมินไปแล้ว: <strong className="text-amber-900">{deleteModalForm.usedCount} ครั้ง</strong></li>
                  )}
                  {deleteModalForm.scheduledCount > 0 && (
                    <li>มีกำหนดการนัดตรวจล่วงหน้า: <strong className="text-purple-900">{deleteModalForm.scheduledCount} รายการ</strong></li>
                  )}
                </ul>
                <p className="text-[11px] text-slate-500 pt-1 border-t border-amber-200/60 leading-tight">
                  * หากยืนยันลบ ระบบจะปิดการใช้งานฟอร์ม (Deactivate) เพื่อล็อกประวัติผลตรวจเดิมไว้ และจะไม่สามารถเลือกฟอร์มนี้ตรวจใหม่ได้
                </p>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 text-center">
                ✅ แบบฟอร์มนี้ยังไม่มีประวัติการนำไปใช้ตรวจ สามารถลบได้อย่างปลอดภัย
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteModalForm(null)}
                className="py-3 px-4 rounded-2xl text-xs sm:text-sm font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors active:scale-95 disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteForm}
                className={`py-3 px-4 rounded-2xl text-xs sm:text-sm font-bold text-white shadow-md cursor-pointer transition-colors active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50 ${
                  deleteModalForm.isInUse || deleteModalForm.usedCount > 0 || deleteModalForm.scheduledCount > 0
                    ? "bg-amber-600 hover:bg-amber-700 shadow-amber-200"
                    : "bg-rose-600 hover:bg-rose-700 shadow-rose-200"
                }`}
              >
                <Trash2 size={16} />
                <span>{isDeleting ? "กำลังดำเนินการ..." : "ยืนยันการลบ"}</span>
              </button>
            </div>
          </div>
        </ModalWrapper>
      )}
    </div>
  );
}
