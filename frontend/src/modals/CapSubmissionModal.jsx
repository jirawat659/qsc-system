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



export default function CapSubmissionModal({ question, unitName, onSave, onClose }) {
  const [actionText, setActionText] = useState("");
  const [photoAttached, setPhotoAttached] = useState(false);
  const [responsibleName, setResponsibleName] = useState("ผู้จัดการสาขา (Store Manager)");
  const [dueDate, setDueDate] = useState("ภายใน 24 ชม. (เร่งด่วน)");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!actionText.trim()) {
      alert("กรุณากรอกรายละเอียดการดำเนินการแก้ไข");
      return;
    }
    if (!photoAttached) {
      alert("กรุณาแนบรูปถ่ายหลักฐานหลังการแก้ไขก่อนส่งงาน");
      return;
    }
    onSave({
      qId: question.id,
      qNum: question.num,
      qText: question.text,
      auditorNote: question.note,
      actionText,
      photoAttached,
      responsibleName,
      dueDate,
      submittedAt: new Date().toLocaleDateString("th-TH", { day: 'numeric', month: 'short', year: '2-digit' }) + " " + new Date().toLocaleTimeString("th-TH", { hour: '2-digit', minute: '2-digit' }) + " น.",
      status: "pending_approval",
    });
    onClose();
  };

  return (
    <ModalWrapper onClose={onClose} maxWidth="max-w-lg">
        {/* Modal Header */}
        <div className="shrink-0 p-4 border-b flex items-center justify-between" style={{ borderColor: c.border, background: "#FAF9F5" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-800 shrink-0">
              <Wrench size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">ส่งมอบงานแก้ไข (Corrective Action - CAP)</h3>
              <p className="text-xs text-slate-500">{unitName} · ข้อคำถามที่ {question.num}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-200 active:bg-slate-300 cursor-pointer transition-colors">
            <X size={18} style={{ color: c.faint }} />
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Issue Summary Box */}
          <div className="p-3.5 rounded-2xl bg-red-50/80 border border-red-200 space-y-1.5">
            <div className="text-xs font-bold text-red-900 flex items-center gap-1.5">
              <AlertTriangle size={14} className="text-red-600" />
              <span>ข้อบกพร่องที่ตรวจพบ (Defect)</span>
            </div>
            <div className="text-xs font-bold text-slate-800">{question.text}</div>
            {question.note && (
              <div className="text-xs text-amber-900 bg-white/90 p-2.5 rounded-xl border border-amber-200/80 font-medium">
                💬 <b>บันทึกของผู้ตรวจ:</b> {question.note}
              </div>
            )}
          </div>

          {/* Corrective Action Taken Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">
              1. สิ่งที่สาขาได้ดำเนินการแก้ไขหน้างาน <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              required
              value={actionText}
              onChange={(e) => setActionText(e.target.value)}
              placeholder="ระบุสิ่งที่สาขาได้ดำเนินการแก้ไข เช่น ได้ทำการขัดล้างทำความสะอาดคราบไขมันหลังเตาปรุงอาหารเรียบร้อยแล้ว และตั้งรอบทำความสะอาด Deep Clean ทุกสัปดาห์..."
              className="w-full text-xs p-3 rounded-xl border outline-none font-medium text-slate-800 focus:border-emerald-600"
              style={{ borderColor: c.border, background: c.bg }}
            />
          </div>

          {/* Upload After Photo Evidence */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">
              2. แนบรูปถ่ายหลักฐานหลังการแก้ไข (After Photo)
            </label>
            <div
              onClick={() => setPhotoAttached(!photoAttached)}
              className={`p-4 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                photoAttached
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                  : 'bg-slate-50 border-slate-300 hover:bg-slate-100 text-slate-600'
              }`}
            >
              <Camera size={22} className={photoAttached ? 'text-emerald-700' : 'text-slate-400'} />
              <div className="text-center">
                <div className="text-xs font-bold">
                  {photoAttached ? "✓ แนบรูปถ่ายหลักฐานหลังแก้ไขเรียบร้อย (1 รูป)" : "แตะเพื่อถ่ายรูปหรืออัปโหลดหลักฐานหลังแก้ไข"}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {photoAttached ? "แตะอีกครั้งหากต้องการเปลี่ยนรูป" : "รองรับไฟล์ JPG, PNG พร้อมประทับเวลา GPS"}
                </div>
              </div>
            </div>
          </div>

          {/* Responsible Person */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">ผู้รับผิดชอบงานแก้ไข</label>
              <input
                type="text"
                value={responsibleName}
                onChange={(e) => setResponsibleName(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl border outline-none font-medium"
                style={{ borderColor: c.border, background: c.bg }}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">กำหนดส่งมอบงาน</label>
              <input
                type="text"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl border outline-none font-medium"
                style={{ borderColor: c.border, background: c.bg }}
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md text-white transition-all active:scale-[0.99]"
              style={{ background: "#0F6659" }}
            >
              <Send size={15} /> ส่งหลักฐานเพื่อขออนุมัติปิดงานแก้ไข (CAP)
            </button>
          </div>
        </form>
    </ModalWrapper>
  );
}
