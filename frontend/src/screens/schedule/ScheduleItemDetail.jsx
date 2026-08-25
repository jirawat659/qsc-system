import AuditHistoryDetail from "../audit/AuditHistoryDetail";
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
  Wrench, Square, Minus, Building2, ArrowUpDown, History, Shield, Info, HelpCircle, Lock
} from "lucide-react";

import { c, sans, mono, cardStyle } from "../../config/theme";
import { AUDIT_TYPES, AUDIT_TYPE_META } from "../../config/constants";
import { DataContext } from "../../context/DataContext";
import Header from "../../shared/Header";
import Section from "../../shared/Section";
import HistoryList from "../../shared/HistoryList";
import api from "../../config/api";

export default function ScheduleItemDetail({ item, role, onBack, onStartAudit }) {
  const { locations, refreshData } = React.useContext(DataContext);
  const [selectedAudit, setSelectedAudit] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const unit = useMemo(() => {
    return locations.find(u => u.name === item.unit || u.fullName?.includes(item.unit) || u.id === item.locationId);
  }, [locations, item]);

  const auditTypeMeta = AUDIT_TYPE_META[item.auditType || "announced"] || AUDIT_TYPE_META.announced;
  const isAuditorOrAdmin = role === "AUDITOR" || role === "ADMIN" || role === "EXECUTIVE";
  const isCompleted = item.status === "completed" || item.status === "Done";
  const isPending = item.status === "pending" || !item.status;

  const handleDeleteSchedule = async () => {
    if (isCompleted) {
      alert("ไม่สามารถลบนัดหมายที่ตรวจเสร็จสิ้นแล้วได้ เพื่อความโปร่งใสของข้อมูล");
      return;
    }

    if (window.confirm(`คุณแน่ใจหรือไม่ที่จะลบนัดหมายตรวจสาขา "${item.unit || item.locationName}"?`)) {
      setIsDeleting(true);
      try {
        if (item.id) {
          await api.delete(`/schedule/${item.id}`);
        }
        if (refreshData) await refreshData();
        alert("ลบนัดหมายตรวจเรียบร้อยแล้ว");
        onBack();
      } catch (err) {
        alert("เกิดข้อผิดพลาดในการลบ: " + (err.response?.data?.message || err.message));
      } finally {
        setIsDeleting(false);
      }
    }
  };

  if (selectedAudit) {
    return <AuditHistoryDetail audit={selectedAudit} onBack={() => setSelectedAudit(null)} />;
  }

  return (
    <div className="page-transition p-4 sm:p-6 space-y-4 w-full max-w-[100%] sm:max-w-[96%] md:max-w-[92%] mx-auto pb-12">
      <Header title="รายละเอียดกำหนดการตรวจ" onBack={onBack} />

      <div className="space-y-4">
        {/* Main Info Card */}
        <div className="rounded-3xl p-5 sm:p-6 shadow-2xs space-y-4 bg-white border border-slate-200">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-extrabold text-slate-400 mb-1">สาขาเป้าหมาย</div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">{item.unit || item.locationName}</h2>
              <div className="text-xs font-semibold text-slate-500 mt-1">{item.date} · {item.time || "09:00 - 12:00 น."}</div>
            </div>
            <div className="text-right shrink-0">
              <span className={`inline-flex items-center gap-1 text-xs font-extrabold px-3 py-1 rounded-full ${
                isCompleted ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
              }`}>
                {isCompleted ? <Check size={13} /> : <Clock size={13} />}
                <span>{isCompleted ? "ตรวจเสร็จสิ้นแล้ว" : "รอนัดตรวจ"}</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100">
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <div className="text-[11px] font-extrabold text-slate-400">ผู้ตรวจประเมิน</div>
              <div className="text-xs sm:text-sm font-bold text-slate-800 mt-0.5">{item.auditor || item.auditorName}</div>
            </div>
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <div className="text-[11px] font-extrabold text-slate-400">แบบฟอร์มที่ใช้</div>
              <div className="text-xs sm:text-sm font-bold text-slate-800 mt-0.5 truncate">{item.form || item.surveyFormTitle}</div>
            </div>
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 col-span-2 sm:col-span-1">
              <div className="text-[11px] font-extrabold text-slate-400">ประเภทการตรวจ</div>
              <div className="text-xs sm:text-sm font-bold text-slate-800 mt-0.5">{auditTypeMeta.label}</div>
            </div>
          </div>
        </div>

        {/* Address & Contact */}
        {unit && (
          <div className="rounded-3xl p-5 shadow-2xs space-y-2 bg-white border border-slate-200">
            <div className="flex items-start gap-2 text-xs font-semibold text-slate-600">
              <MapPin size={15} className="mt-0.5 shrink-0 text-[#0F6659]" />
              <span>{unit.address}</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <Phone size={15} className="shrink-0 text-[#0F6659]" />
              <span>{unit.phone}</span>
            </div>
          </div>
        )}

        {/* 🔒 Action Buttons & Status Restrictions */}
        {isCompleted ? (
          /* Locked Status: Completed audits cannot be edited or deleted */
          <div className="rounded-2xl p-4 flex items-center justify-between border bg-slate-50 border-slate-200 shadow-2xs text-slate-600">
            <div className="flex items-center gap-2.5">
              <Lock size={18} className="text-slate-400" />
              <div className="text-xs font-bold text-slate-700">
                งานนี้ตรวจเสร็จสิ้นแล้ว · ข้อมูลถูกบันทึกถาวร (ล็อกไม่สามารถแก้ไขหรือลบได้)
              </div>
            </div>
            <span className="text-xs font-extrabold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-xl shrink-0">
              ✓ บันทึกผลแล้ว
            </span>
          </div>
        ) : (
          /* Pending / In-Progress Actions */
          <div className="space-y-2.5">
            {isAuditorOrAdmin && (
              <button
                type="button"
                onClick={() => onStartAudit(item)}
                className="w-full py-4 rounded-2xl text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-md bg-[#0F6659] text-white transition-all active:scale-[0.99]"
              >
                <ClipboardCheck size={18} /> เริ่มตรวจสาขานี้ตามแผนงานทันที ➔
              </button>
            )}

            {/* ✏️ Edit / 🗑️ Delete Buttons (Only for Pending Schedules) */}
            {isPending && (
              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => alert("ระบบจะเปิดหน้าต่างแก้ไขข้อมูลนัดหมายนี้")}
                  className="flex-1 py-3 rounded-xl text-xs font-extrabold bg-white border border-slate-300 hover:border-emerald-500 text-slate-700 hover:text-[#0F6659] cursor-pointer shadow-2xs transition-all active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Edit3 size={15} />
                  <span>แก้ไขนัดหมาย</span>
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSchedule}
                  disabled={isDeleting}
                  className="flex-1 py-3 rounded-xl text-xs font-extrabold bg-white border border-red-200 hover:bg-red-50 text-red-600 cursor-pointer shadow-2xs transition-all active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={15} />
                  <span>{isDeleting ? "กำลังลบ..." : "ยกเลิก/ลบนัดตรวจ"}</span>
                </button>
              </div>
            )}
          </div>
        )}

        <Section title="ประวัติการตรวจย้อนหลัง" action={<span className="text-xs font-medium text-slate-400">แตะเพื่อดูรายละเอียด</span>}>
          <HistoryList history={unit?.history || []} onSelect={setSelectedAudit} />
        </Section>
      </div>
    </div>
  );
}
