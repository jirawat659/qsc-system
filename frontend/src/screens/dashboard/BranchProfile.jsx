import AuditHistoryDetail from "../audit/AuditHistoryDetail";
import ExcelExportModal from "../../modals/ExcelExportModal";
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
import { ROLES, NAV_BY_ROLE } from "../../config/roles";
import { TODAY, AUDIT_TYPES, AUDIT_TYPE_META, CAP_STATUS_MAP, REGION_LINES, BRAND_LINES } from "../../config/constants";
import { TopBarContext } from "../../context/TopBarContext";
import { DataContext } from "../../context/DataContext";
import { exportToExcel } from "../../utils/exportToExcel";

import ModalWrapper from "../../shared/ModalWrapper";
import Header from "../../shared/Header";
import Section from "../../shared/Section";
import ScoreRing from "../../shared/ScoreRing";
import HistoryList from "../../shared/HistoryList";
import ErrorBoundary from "../../shared/ErrorBoundary";


export default function BranchProfile({ unit, onBack }) {
  const { auditRecords } = React.useContext(DataContext);
  const [selectedAudit, setSelectedAudit] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);

  // 🌟 Real-time audit history for this specific branch
  const branchHistory = useMemo(() => {
    if (!unit) return [];
    const fromDb = (auditRecords || []).filter(r => 
      (r.locationId && r.locationId === unit.id) || 
      (r.locationName && (r.locationName === unit.name || r.locationName === unit.fullName)) ||
      (r.location?.name && (r.location.name === unit.name || r.location.name === unit.fullName))
    );

    if (fromDb.length > 0) {
      return fromDb.map(r => {
        const score = Math.round(r.percentageScore || 0);
        const rawDate = r.auditDate || r.createdAt;
        const dateFormatted = rawDate ? new Date(rawDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) : "-";
        const auditorVal = r.primaryAuditor?.fullName || r.auditorName || r.auditor || "-";
        const formVal = r.surveyFormTitle || r.surveyForm?.title || r.form || "-";
        return {
          id: r.id,
          date: dateFormatted,
          auditDate: rawDate,
          score: score,
          percentageScore: score,
          auditor: auditorVal,
          auditorName: auditorVal,
          form: formVal,
          formName: formVal,
          auditType: (r.auditType === 'unannounced' || r.auditType === 'spot') ? "นอกกำหนดการ" : (r.auditType === 'undercover' ? "ปลอมตัว" : "ตามกำหนดการ"),
          status: r.isPassed ? "pass" : "fail",
          isPassed: r.isPassed,
          hasCriticalDefect: r.hasCriticalDefect,
          ...r
        };
      });
    }

    return unit.history || [];
  }, [auditRecords, unit]);

  const latestScore = branchHistory.length > 0 ? branchHistory[0].score : (unit?.lastScore !== undefined ? unit.lastScore : 0);

  if (selectedAudit) {
    return <AuditHistoryDetail unitName={unit?.fullName || unit?.name} record={selectedAudit} onBack={() => setSelectedAudit(null)} />;
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 w-full max-w-[100%] sm:max-w-[96%] md:max-w-[92%] mx-auto pb-8">
      <Header title={unit?.fullName || unit?.name || "-"} subtitle={unit?.region || "-"} onBack={onBack} />
      <div className="space-y-4">
        <div className="rounded-3xl p-5 shadow-2xs" style={cardStyle}>
          <div className="flex items-start gap-2.5 text-xs mb-2" style={{ color: c.muted }}>
            <MapPin size={15} className="mt-0.5 shrink-0" style={{ color: c.faint }} /> {unit?.address || "-"}
          </div>
          <div className="flex items-center gap-2.5 text-xs" style={{ color: c.muted }}>
            <Phone size={15} style={{ color: c.faint }} /> {unit?.phone || "-"}
          </div>
          <div className="mt-4 pt-4 flex items-center justify-between gap-3" style={{ borderTop: `1px solid ${c.border}` }}>
            <div className="min-w-0 flex-1">
              <span className="text-xs font-semibold block text-slate-500">คะแนนตรวจล่าสุด (เกณฑ์ 85%)</span>
              <button
                type="button"
                onClick={() => setShowExportModal(true)}
                className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300 text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-2xs max-w-full"
              >
                <Download size={13} className="shrink-0 text-emerald-700" />
                <span className="truncate">ส่งออก Excel (.csv)</span>
              </button>
            </div>
            <ScoreRing score={latestScore} size={40} />
          </div>
        </div>
        <Section title={`ประวัติการตรวจรายครั้งย้อนหลัง (${branchHistory.length} รอบตรวจ)`} action={<span className="text-xs font-medium" style={{ color: c.faint }}>แตะเพื่อดูรายละเอียด</span>}>
          <HistoryList history={branchHistory} onSelect={setSelectedAudit} />
        </Section>
      </div>

      {showExportModal && (
        <ExcelExportModal initialUnit={unit} onClose={() => setShowExportModal(false)} />
      )}
    </div>
  );
}
