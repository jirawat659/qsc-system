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
import { compressImageFile } from "../../utils/imageCompressor";

export default function NewRemediationModal({ onClose, onSubmit, locations = [], currentUser }) {
  const [selectedLocationId, setSelectedLocationId] = useState(locations[0]?.id || 1);
  const [selectedIssue, setSelectedIssue] = useState("q1");
  const [remediationNote, setRemediationNote] = useState("");
  const [photoBase64, setPhotoBase64] = useState(null);
  const [formError, setFormError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file);
      setPhotoBase64(compressed);
      if (formError) setFormError(null);
    } catch (err) {
      console.warn("Compression failed:", err);
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPhotoBase64(ev.target.result);
        if (formError) setFormError(null);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  };

  const selectedLoc = locations.find(l => l.id === Number(selectedLocationId)) || locations[0];

  const availableIssues = [
    { id: "q1", title: "ข้อ 1: พื้น ผนัง และโต๊ะรับประทานอาหารสะอาด ปราศจากคราบไขมัน" },
    { id: "q2", title: "ข้อ 2: พนักงานแต่งกายถูกสุขลักษณะ สวมหมวกคลุมผมและผ้ากันเปื้อน" },
    { id: "q7", title: "ข้อ 7: อุณหภูมิตู้แช่เย็นวัตถุดิบไม่เกินเกณฑ์กำหนด (≤ 4.0°C)" },
  ];

  return (
    <ModalWrapper onClose={onClose} maxWidth="max-w-md">
      <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: c.border, background: "#FAF9F5" }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-teal-100 flex items-center justify-center text-teal-800">
            <Wrench size={16} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">ส่งมอบงานแก้ไขใหม่ (Manual CAP)</h3>
            <p className="text-[11px] text-slate-500">สำหรับสาขาที่ต้องการส่งหลักฐานแก้ไขเพิ่มเติม</p>
          </div>
        </div>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 cursor-pointer">
          <X size={16} style={{ color: c.faint }} />
        </button>
      </div>

      <div className="p-4 space-y-3.5">
        {formError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
            <AlertTriangle size={15} className="shrink-0 text-rose-600" />
            <span>{formError}</span>
          </div>
        )}

        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1">เลือกสาขา</label>
          <select
            value={selectedLocationId}
            onChange={(e) => setSelectedLocationId(e.target.value)}
            className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-semibold bg-white text-slate-800"
          >
            {locations.map(loc => (
              <option key={loc.id} value={loc.id}>{loc.name} - {loc.fullName || loc.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1">ข้อบกพร่องที่ต้องการแก้ไข</label>
          <select
            value={selectedIssue}
            onChange={(e) => setSelectedIssue(e.target.value)}
            className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-semibold bg-white text-slate-800"
          >
            {availableIssues.map(issue => (
              <option key={issue.id} value={issue.id}>{issue.title}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1">รายละเอียดการดำเนินการแก้ไข</label>
          <textarea
            value={remediationNote}
            onChange={(e) => {
              setRemediationNote(e.target.value);
              if (formError) setFormError(null);
            }}
            placeholder="อธิบายสิ่งที่สาขาได้ดำเนินการปรับปรุงแก้ไข..."
            rows={3}
            className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-semibold bg-white text-slate-800 placeholder-slate-400"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1">
            รูปภาพหลักฐานหลังแก้ไข <span className="text-red-500">*</span>
          </label>
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />

          {photoBase64 ? (
            <div className="relative rounded-2xl border border-emerald-300 bg-emerald-50/70 p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={photoBase64}
                  alt="Evidence"
                  className="w-14 h-14 rounded-xl object-cover border border-emerald-400 shrink-0 shadow-2xs"
                />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-emerald-950 truncate">แนบรูปถ่ายหลักฐานแล้ว</div>
                  <div className="text-[11px] text-emerald-700 font-medium truncate">พร้อมส่งเพื่อขออนุมัติปิดงาน</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1 text-xs font-bold rounded-xl border border-emerald-400 bg-white text-emerald-800 hover:bg-emerald-50 cursor-pointer"
                >
                  เปลี่ยนรูป
                </button>
                <button
                  type="button"
                  onClick={() => setPhotoBase64(null)}
                  className="p-1.5 rounded-xl text-red-600 hover:bg-red-50 cursor-pointer"
                  title="ลบรูป"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full p-4 rounded-2xl border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50 hover:bg-emerald-50/40 flex flex-col items-center justify-center gap-1.5 text-slate-600 transition-all cursor-pointer"
            >
              <Camera size={22} className="text-slate-400 group-hover:text-emerald-700" />
              <div className="text-xs font-bold text-slate-700">แตะเพื่อถ่ายรูปหรือเลือกรูปหลักฐานจากเครื่อง</div>
              <div className="text-[11px] text-slate-400">รองรับไฟล์ภาพ JPG, PNG พร้อมบีบอัดให้อัตโนมัติ</div>
            </button>
          )}
        </div>

        <button
          onClick={() => {
            if (!remediationNote.trim()) {
              setFormError("กรุณากรอกรายละเอียดการแก้ไข");
              return;
            }
            if (!photoBase64) {
              setFormError("กรุณาแนบรูปภาพหลักฐานหลังแก้ไขก่อนส่งงาน");
              return;
            }
            setFormError(null);
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
              photo: photoBase64,
              images: [photoBase64],
              assignedTo: currentUser?.name || "ผู้จัดการสาขา",
              deadline: "24 ส.ค. 2569",
              auditScore: 76,
              timeline: [
                { 
                  who: `${currentUser?.name || "ผู้จัดการสาขา"} (${selectedLoc?.name || "สาขา"})`, 
                  text: remediationNote, 
                  photo: photoBase64,
                  time: "เมื่อสักครู่",
                  isMe: true
                }
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
