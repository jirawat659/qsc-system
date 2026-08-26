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


export default function NewRemediationModal({ onClose, onSubmit, locations = INITIAL_UNITS, currentUser }) {
  const [selectedLocationId, setSelectedLocationId] = useState(locations[0]?.id || 1);
  const [selectedIssue, setSelectedIssue] = useState("q1");
  const [remediationNote, setRemediationNote] = useState("");
  const [photoAttached, setPhotoAttached] = useState(false);

  const availableIssues = [
    { id: "q1", title: "ข้อ q1: พื้น ผนัง และโต๊ะรับประทานอาหารสะอาด ปราศจากคราบไขมัน (ไม่ผ่าน)" },
    { id: "q2", title: "ข้อ q2: พนักงานแต่งกายถูกสุขลักษณะ สวมหมวกคลุมผมและผ้ากันเปื้อน (ไม่ผ่าน)" },
    { id: "q6", title: "ข้อ q6: อุณหภูมิตู้แช่เย็นวัตถุดิบไม่เกินเกณฑ์กำหนด (≤ 4.0°C) (ไม่ผ่าน)" },
  ];

  const selectedLoc = locations.find(l => l.id === Number(selectedLocationId)) || locations[0];

  return (
    <ModalWrapper onClose={onClose} maxWidth="max-w-lg">
      <div className="p-6 space-y-4 flex-1 overflow-y-auto min-h-0" style={{ background: c.surface }}>
        <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: c.border }}>
          <div className="flex items-center gap-2">
            <Scale size={18} style={{ color: c.accent }} />
            <span className="text-sm font-bold" style={{ color: c.ink }}>เปิดส่งมอบงานแก้ไขใหม่ (จากผลตรวจล่าสุด)</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 cursor-pointer"><X size={14} /></button>
        </div>

        <p className="text-xs text-slate-500 font-medium leading-relaxed">
          📌 <strong>หมายเหตุ:</strong> การส่งมอบงานแก้ไขเป็นการบันทึกการปฏิบัติตาม SOP ให้ถูกต้อง ไม่มีการแก้ไขคะแนนเดิมของการตรวจ เพื่อรักษาประวัติการประเมินที่โปร่งใส
        </p>

        <div>
          <label className="text-xs font-bold block mb-1.5" style={{ color: c.muted }}>เลือกข้อคำถามที่ไม่ผ่านที่ต้องการส่งงานแก้ไข</label>
          <select
            value={selectedIssue}
            onChange={(e) => setSelectedIssue(e.target.value)}
            className="w-full text-xs p-3 rounded-xl outline-none font-bold border"
            style={{ background: c.bg, color: c.ink, borderColor: c.border }}
          >
            {availableIssues.map((it) => (
              <option key={it.id} value={it.id}>{it.title}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-bold block mb-1.5" style={{ color: c.muted }}>รายละเอียดการดำเนินการแก้ไข</label>
          <textarea
            rows={3}
            value={remediationNote}
            onChange={(e) => setRemediationNote(e.target.value)}
            placeholder="อธิบายขั้นตอนการแก้ไข การทำความสะอาด หรือการซ่อมบำรุงตามมาตรฐาน..."
            className="w-full text-xs p-3 rounded-xl outline-none font-medium border"
            style={{ background: c.bg, color: c.ink, borderColor: c.border }}
          />
        </div>

        <div className="rounded-2xl p-4 flex items-center justify-between border" style={{ borderColor: c.border, background: c.bg }}>
          <div>
            <span className="text-xs font-bold block" style={{ color: c.ink }}>แนบรูปภาพหลักฐานหลังแก้ไข (After Photo)</span>
            <span className="text-xs text-slate-400">{photoAttached ? "✓ แนบรูปภาพสำเร็จ (1 ภาพ)" : "ยังไม่ได้แนบรูปภาพ"}</span>
          </div>
          <button
            type="button"
            onClick={() => setPhotoAttached(!photoAttached)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
              photoAttached ? 'bg-[#0F6659] text-white' : 'bg-white border text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Camera size={14} />
            <span>{photoAttached ? "เปลี่ยนรูป" : "ถ่ายรูป/แนบไฟล์"}</span>
          </button>
        </div>

        <button
          onClick={() => {
            if (!remediationNote.trim()) {
              alert("กรุณากรอกรายละเอียดการแก้ไข");
              return;
            }
            if (!photoAttached) {
              alert("กรุณาแนบรูปภาพหลักฐานหลังแก้ไขก่อนส่งงาน");
              return;
            }
            onSubmit({
              id: "CAP-" + Date.now().toString().slice(-3),
              locationId: selectedLoc?.id || 1,
              title: availableIssues.find(x => x.id === selectedIssue)?.title.split(":")[1]?.trim() || "งานแก้ไขสุขอนามัย",
              unit: selectedLoc?.name || selectedLoc?.fullName || "สาขาสยาม",
              status: "submitted",
              due: "รอผู้ตรวจอนุมัติ",
              overdue: false,
              issueItem: availableIssues.find(x => x.id === selectedIssue)?.title,
              desc: remediationNote,
              assignedTo: currentUser?.name || "ผู้จัดการสาขา",
              deadline: "24 ส.ค. 2569",
              auditScore: 76,
              timeline: [
                { who: `${currentUser?.name || "ผู้จัดการสาขา"} (${selectedLoc?.name || "สาขา"})`, text: remediationNote + (photoAttached ? " (แนบรูปหลักฐานหลังแก้ไข)" : ""), time: "เมื่อสักครู่" }
              ]
            });
            onClose();
          }}
          className="w-full py-3.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md"
          style={{ background: c.accent, color: "#fff" }}
        >
          <Check size={15} /> ส่งรายงานและหลักฐานการแก้งาน
        </button>
      </div>
    </ModalWrapper>
  );
}
