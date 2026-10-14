import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { List, ClipboardCheck, Store, MapPin, Camera, CheckCircle2, XCircle, PenTool, Check, MessageSquare, Edit3, Megaphone, X, Maximize2, CheckCheck, ExternalLink, AlertTriangle, SlidersHorizontal, BarChart3, Wrench, Minus, History, ChevronRight, ChevronDown, ChevronUp, FileText, Calendar, Clock, User, FileSpreadsheet, Sparkles, Table, Save, RotateCcw, Trash2, Plus, Navigation, Loader2, AlertCircle, MoreVertical } from "lucide-react";


import { c, sans, mono, cardStyle } from "../../config/theme";
import { TODAY, AUDIT_TYPES, AUDIT_TYPE_META, CAP_STATUS_MAP, REGION_LINES, BRAND_LINES, CATEGORY_DISPLAY_MAP, getCategoryDisplay } from "../../config/constants";
import { TopBarContext } from "../../context/TopBarContext";
import { DataContext } from "../../context/DataContext";
import { exportAuditReportToExcel, formatBkk } from "../../utils/exportAuditReport";
import { formatThaiDate, formatThaiTime, parseServerDate } from "../../utils/formatters";
import api, { getFullImageUrl } from "../../config/api";
import { compressImageFile, validateImageFile } from "../../utils/imageCompressor";
import { computeScore } from "../../config/scoring";

import ModalWrapper from "../../shared/ModalWrapper";
import Header from "../../shared/Header";
import Section from "../../shared/Section";
import ScoreRing from "../../shared/ScoreRing";
import HistoryList from "../../shared/HistoryList";
import ErrorBoundary from "../../shared/ErrorBoundary";
import CapDetailScreen from "../cap/CapDetailScreen";
import AuditEditLogsModal from "../../modals/AuditEditLogsModal";
import SignaturePadModal from "../../modals/SignaturePadModal";
import AiAuditDefectModal from "../../modals/AiAuditDefectModal";
import DynamicFieldRenderer from "../../shared/DynamicFieldRenderer";

const toDatetimeLocal = (isoDateStr) => {
  if (!isoDateStr) return "";
  try {
    const d = parseServerDate(isoDateStr);
    if (!d || isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    return "";
  }
};

const NON_SCORED_NOTE_MARKER = "\n[หมายเหตุ]: ";

// backend เก็บคำตอบข้อไม่คิดคะแนนไว้ใน Notes: "คำตอบ" หรือ "คำตอบ\n[หมายเหตุ]: คอมเมนต์"
const splitNonScoredNotes = (notes, qType) => {
  const text = (notes || "").toString();
  const idx = text.indexOf(NON_SCORED_NOTE_MARKER);
  let parsedAns = idx >= 0 ? text.slice(0, idx) : text;
  const parsedComment = idx >= 0 ? text.slice(idx + NON_SCORED_NOTE_MARKER.length).trim() : null;
  const t = String(qType || "").toLowerCase();
  if ((t === "grid" || t === "checkbox") && parsedAns.trim()) {
    try { parsedAns = JSON.parse(parsedAns); } catch {}
  }
  return { answer: parsedAns, comment: parsedComment || null };
};

// ตรวจสอบว่าข้อความเป็นคอมเม้นต์จริงของผู้ตรวจหรือไม่ (ไม่เป็นค่าว่าง ไม่ตรงกับคำตอบ และไม่เป็นก้อน JSON)
const isRealCommentText = (text, answerVal) => {
  if (!text || typeof text !== "string") return false;
  const t = text.trim();
  if (!t) return false;
  if (answerVal !== undefined && answerVal !== null && t === String(answerVal).trim()) return false;
  // 123='{', 91='['
  const firstCharCode = t.charCodeAt(0);
  if (firstCharCode === 123 || firstCharCode === 91) return false;
  return true;
};

// 🌟 ตารางข้อมูลแบบซ่อน/เปิดได้ (Collapsible Grid Table)
// แสดงผลเป็นตารางเต็มรูปแบบเหมือนตอนตรวจ (DynamicFieldRenderer type="grid")
// รองรับทั้งโหมดอ่านอย่างเดียว (readOnly=true) และโหมดแก้ไข (readOnly=false, มี onChange)
function CollapsibleGridTable({
  label,
  fieldConfig,
  value,
  onChange,
  readOnly = true,
  defaultOpen = false,
  className = ""
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  useEffect(() => {
    if (!readOnly && defaultOpen) {
      setIsOpen(true);
    }
  }, [readOnly, defaultOpen]);

  const cellData = useMemo(() => {
    if (!value) return {};
    if (typeof value === "object") return value;
    try {
      const p = JSON.parse(value);
      return typeof p === "object" && p !== null ? p : {};
    } catch (e) {
      return {};
    }
  }, [value]);

  const filledCount = Object.keys(cellData).filter(k => cellData[k] !== undefined && cellData[k] !== null && cellData[k] !== "").length;
  const rowCount = fieldConfig?.rows?.length || 0;
  const colCount = fieldConfig?.columns?.length || 0;

  return (
    <div className={`rounded-2xl border transition-all overflow-hidden ${
      !readOnly
        ? (isOpen ? "bg-white border-emerald-400 shadow-sm ring-1 ring-emerald-400/20" : "bg-slate-50 border-emerald-300 shadow-2xs hover:border-emerald-400")
        : (isOpen ? "bg-white border-[#0F6659]/40 shadow-sm" : "bg-slate-50/90 border-slate-200 hover:border-[#0F6659]/40 hover:bg-slate-50")
    } ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="w-full p-3 sm:p-3.5 flex items-center justify-between text-left cursor-pointer transition-colors select-none group"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all ${
            !readOnly
              ? "bg-[#0F6659] text-white shadow-2xs"
              : (isOpen ? "bg-[#0F6659] text-white shadow-2xs" : "bg-white text-[#0F6659] border border-slate-200/90 shadow-2xs group-hover:border-[#0F6659]/50")
          }`}>
            <Table size={15} />
          </div>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-extrabold text-slate-800 truncate flex items-center gap-2">
              <span>{label || "ตารางข้อมูล"}</span>
            </div>
            <div className="text-[10.5px] text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
              <span>{rowCount > 0 ? `${rowCount} แถว × ${colCount} คอลัมน์` : "ตารางข้อมูล"}</span>
              {filledCount > 0 ? (
                <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60 font-mono text-[9.5px] font-bold">
                  บันทึกแล้ว {filledCount} ช่อง
                </span>
              ) : (
                <span className="text-slate-400 text-[10px]">
                  (ยังไม่มีข้อมูล)
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-2">
          <span className="text-[11px] font-bold text-[#0F6659] hidden sm:inline">
            {isOpen ? "ซ่อนตาราง" : (!readOnly ? "เปิดแก้ไขตาราง" : "เปิดดูตาราง")}
          </span>
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-transform duration-200 ${
            isOpen ? "rotate-180 bg-emerald-50 text-[#0F6659]" : "text-slate-400 bg-white border border-slate-200 shadow-2xs group-hover:text-slate-600"
          }`}>
            <ChevronDown size={14} />
          </div>
        </div>
      </button>

      {isOpen && (
        <div className="p-3 sm:p-4 pt-1 border-t border-slate-100 animate-in fade-in duration-150">
          <DynamicFieldRenderer
            type="grid"
            fieldConfig={fieldConfig}
            value={value}
            onChange={onChange}
            readOnly={readOnly}
          />
        </div>
      )}
    </div>
  );
}

// 📊 หมวดหมู่คะแนนหลัก 5 หมวดตามมาตรฐาน QSC
export const CORE_CATEGORY_ORDER = [
  "Product",
  "Process",
  "Service",
  "Cleanliness",
  "Documents"
];

// 🏷️ ดึงชื่อหมวดคะแนนของคำถามแต่ละข้อ (แยกอิสระจากหมวดคำถามของฟอร์ม)
export const getQuestionCategory = (q, sec) => {
  const name = (q?.categoryName || q?.category || "").trim();
  const code = (q?.categoryCode || "").trim().toUpperCase();

  // 0. ตรวจสอบหมวดข้อมูลทั่วไป/รายละเอียด (ไม่คิดคะแนน)
  if (name === "รายละเอียด" || name.toUpperCase() === "INFO" || code === "INFO" || name === "ข้อมูลทั่วไป") return "รายละเอียด";

  // 1. ตรวจสอบจากชื่อหมวด หรือรหัสย่อ (รองรับทั้ง PD/PC/S/C/DM และรหัสเดิม QLT/OPS/SVC/CLN/DOC)
  if (name === "Product" || code === "PD" || code === "QLT" || name.includes("คุณภาพ")) return "Product";
  if (name === "Process" || code === "PC" || code === "OPS" || name.includes("กระบวนการ") || name.includes("โรงงาน") || name.includes("GMP")) return "Process";
  if (name === "Service" || code === "S" || code === "SVC" || name.includes("บริการ")) return "Service";
  if (name === "Cleanliness" || code === "C" || code === "CLN" || name.includes("สะอาด") || name.includes("สุขอนามัย")) return "Cleanliness";
  if (name === "Documents" || code === "DM" || code === "DOC" || name.includes("เอกสาร")) return "Documents";

  // 2. ตรวจสอบชื่อหมวดหมู่ของฟอร์ม (Section Title)
  const title = sec?.title || q?.sectionTitle || "";
  if (title.includes("คุณภาพ") || title.includes("QLT") || title.includes("Product")) return "Product";
  if (title.includes("กระบวนการ") || title.includes("โรงงาน") || title.includes("OPS") || title.includes("Process") || title.includes("GMP")) return "Process";
  if (title.includes("บริการ") || title.includes("SVC") || title.includes("Service")) return "Service";
  if (title.includes("สะอาด") || title.includes("สุขอนามัย") || title.includes("CLN") || title.includes("Cleanliness")) return "Cleanliness";
  if (title.includes("เอกสาร") || title.includes("DOC") || title.includes("Documents")) return "Documents";

  // 3. ตรวจสอบข้อความของคำถาม (Fallback)
  const text = q?.text || q?.questionText || "";
  if (text.includes("คุณภาพ") || text.includes("อุณหภูมิ") || text.includes("TPM")) return "Product";
  if (text.includes("กระบวนการ") || text.includes("เครื่องจักร") || text.includes("พาหะ") || text.includes("แต่งกาย") || text.includes("หนีไฟ")) return "Process";
  if (text.includes("บริการ") || text.includes("ทักทาย") || text.includes("เสิร์ฟ")) return "Service";
  if (text.includes("สะอาด") || text.includes("ฆ่าเชื้อ") || text.includes("ล้างมือ")) return "Cleanliness";
  if (text.includes("เอกสาร") || text.includes("Log") || text.includes("FIFO") || text.includes("บันทึก") || text.includes("รายงาน")) return "Documents";

  if (name) return name;
  if (title) return title;
  return "Product";
};

// 🌟 สรุปสถิติคะแนน/การผ่านของหมวดหมู่
export const getSectionStats = (sec) => {
  const isInfo = sec?.sectionType === "INFO" || (sec?.questions && sec.questions.length > 0 && sec.questions.every(q => q.isScored === false));
  const scoredQuestions = (sec?.questions || []).filter(q => q.isScored !== false && !["grid","number","select","radio","checkbox","text","date","time","auditor", "multians"].includes(q.type || q.questionType));
  const totalQ = scoredQuestions.length;
  const passedQ = scoredQuestions.filter(q => {
    if (q.isNa) return true;
    if (q.isPassed !== undefined) return q.isPassed;
    if (q.type === "yesno") return q.answer === true;
    if (q.type === "scale") return q.scaleScore ? q.scaleScore >= 3 : (Number(q.answer) >= 3);
    return true;
  }).length;
  const secPassed = totalQ > 0 ? passedQ === totalQ : true;
  return { totalQ, passedQ, secPassed, isInfo, allCount: sec?.questions?.length || 0 };
};

// 🌟 Drawer เลือกกระโดดไปยังหมวดหมู่ในหน้ารายละเอียดผลตรวจ (Quick Navigation Drawer)
function HistoryCategoryNavigationDrawer({ onClose, categoryItems, activeSectionIdx, onSelectCategory }) {
  const [mounted, setMounted] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const startYRef = useRef(0);
  const currentYRef = useRef(0);
  const startTimeRef = useRef(0);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const triggerClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 220);
  }, [isClosing, onClose]);

  // Touch handlers for Drag Handle & Header Bar (ปัดขึ้นเพื่อปิด)
  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    startYRef.current = touch.clientY;
    currentYRef.current = touch.clientY;
    startTimeRef.current = Date.now();
    isDraggingRef.current = true;
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!isDraggingRef.current) return;
    const touch = e.touches[0];
    const deltaY = touch.clientY - startYRef.current;
    if (deltaY < 0) {
      currentYRef.current = touch.clientY;
      setDragY(deltaY);
    } else {
      setDragY(0);
    }
  };

  const handleTouchEnd = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);

    const deltaY = currentYRef.current - startYRef.current;
    const elapsed = Math.max(1, Date.now() - startTimeRef.current);
    const velocity = deltaY / elapsed;

    if (deltaY <= -55 || (deltaY < -18 && velocity <= -0.25)) {
      triggerClose();
    } else {
      setDragY(0);
    }
  };

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    startYRef.current = e.clientY;
    currentYRef.current = e.clientY;
    startTimeRef.current = Date.now();
    isDraggingRef.current = true;
    setIsDragging(true);

    const onMouseMove = (moveEvent) => {
      const deltaY = moveEvent.clientY - startYRef.current;
      if (deltaY < 0) {
        currentYRef.current = moveEvent.clientY;
        setDragY(deltaY);
      } else {
        setDragY(0);
      }
    };

    const onMouseUp = (upEvent) => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      isDraggingRef.current = false;
      setIsDragging(false);

      const deltaY = upEvent.clientY - startYRef.current;
      const elapsed = Math.max(1, Date.now() - startTimeRef.current);
      const velocity = deltaY / elapsed;

      if (deltaY <= -55 || (deltaY < -18 && velocity <= -0.25)) {
        triggerClose();
      } else {
        setDragY(0);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const currentTranslateY = isClosing
    ? '-100%'
    : !mounted
      ? '-100%'
      : dragY < 0
        ? `${dragY}px`
        : '0px';

  const backdropAlpha = isClosing || !mounted
    ? 0
    : dragY < 0
      ? Math.max(0.05, 0.6 * (1 - Math.abs(dragY) / 280))
      : 0.6;

  return (
    <div
      className="fixed inset-0 z-[99999] flex flex-col justify-start backdrop-blur-xs select-none"
      style={{
        backgroundColor: `rgba(0, 0, 0, ${backdropAlpha})`,
        transition: isDragging ? 'none' : 'background-color 0.22s ease-out',
      }}
    >
      <div className="fixed inset-0" onClick={triggerClose} />

      <div
        className="relative z-10 w-full max-w-lg mx-auto bg-white rounded-b-[28px] sm:rounded-b-3xl shadow-[0_20px_50px_rgba(0,0,0,0.22)] max-h-[80vh] flex flex-col overflow-hidden"
        style={{
          transform: `translateY(${currentTranslateY})`,
          transition: isDragging ? 'none' : 'transform 0.24s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header Bar */}
        <div
          className="px-5 pt-4 pb-2.5 flex items-center justify-between border-b border-slate-100 shrink-0 cursor-grab active:cursor-grabbing touch-none select-none bg-white"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          onMouseDown={handleMouseDown}
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#0F6659]">QUICK NAVIGATION</p>
            <h2 className="text-base font-black text-slate-800">ไปยังหมวดหมู่ที่ต้องการ</h2>
          </div>
          <button
            type="button"
            onTouchStart={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={triggerClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-500 flex items-center justify-center cursor-pointer transition-colors"
            title="ปิดเมนู"
          >
            <X size={16} />
          </button>
        </div>

        {/* Category List */}
        <div className="space-y-2 overflow-y-auto px-5 py-3 flex-1">
          {categoryItems.map((item) => {
            const isCurrent = item.index === activeSectionIdx;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (Math.abs(dragY) > 8) return;
                  onSelectCategory(item);
                }}
                className={`w-full p-3 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                  isCurrent
                    ? "bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-400/30"
                    : "bg-slate-50/80 border-slate-200 hover:bg-slate-100/80"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-bold transition-all shadow-2xs ${
                    isCurrent
                      ? "bg-[#0F6659] text-white"
                      : "bg-white text-slate-700 border border-slate-200"
                  }`}
                >
                  <span className="text-[11px] font-black">{item.index + 1}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <p className={`text-xs sm:text-sm font-bold truncate ${isCurrent ? "text-[#0F6659]" : "text-slate-800"}`}>
                    {item.label}
                  </p>
                </div>

                <span
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-xl shrink-0 border shadow-2xs ${
                    item.isPassed
                      ? isCurrent ? "bg-[#0F6659] text-white border-transparent" : "bg-emerald-50 text-[#0F6659] border-emerald-200"
                      : "bg-amber-50 text-amber-900 border-amber-200"
                  }`}
                >
                  {item.count}
                </span>

                <ChevronRight size={16} className={isCurrent ? "text-[#0F6659]" : "text-slate-400"} />
              </button>
            );
          })}
        </div>

        {/* Drag handle pill at bottom */}
        <div
          className="py-2 flex items-center justify-center cursor-grab active:cursor-grabbing border-t border-slate-100 bg-slate-50/60 touch-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          onMouseDown={handleMouseDown}
        >
          <div className="w-12 h-1 rounded-full bg-slate-300" />
        </div>
      </div>
    </div>
  );
}

// 🌟 Action Buttons Component for Header (Desktop: Full Pills, Mobile: Dropdown Menu to prevent overflow)
function AuditHeaderActionMenu({
  canEditAudit,
  canReopenAudit,
  isEditing,
  isSaving,
  onEnterEditMode,
  onCancelEditMode,
  onTriggerSave,
  onReopen
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  // เมื่ออยู่ในโหมดแก้ไข (isEditing) ไม่ต้องแสดงปุ่มบน Header เพื่อไม่ให้ซ้ำกับแถบด้านล่าง (Bottom Bar)
  if (isEditing) {
    return null;
  }

  if (!canEditAudit && !canReopenAudit) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {/* Desktop view (หน้าจอคอมพิวเตอร์ / แท็บเล็ต): แสดงปุ่มเต็มตามเดิม */}
      <div className="hidden sm:flex items-center gap-2">
        {canReopenAudit && (
          <button
            type="button"
            onClick={onReopen}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-800 border border-slate-200 text-xs font-bold shadow-2xs transition-all active:scale-95 cursor-pointer group"
            title="ย้อนสถานะผลการตรวจเป็นแบบร่าง"
          >
            <RotateCcw size={13} className="text-amber-600 group-hover:-rotate-45 transition-transform" />
            <span>ย้อนเป็นแบบร่าง</span>
          </button>
        )}
        {canEditAudit && (
          <button
            type="button"
            onClick={onEnterEditMode}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white hover:bg-emerald-50 text-slate-700 hover:text-[#0F6659] border border-slate-200 text-xs font-bold shadow-2xs transition-all active:scale-95 cursor-pointer group"
            title="แก้ไขผลการตรวจ (เข้าสู่โหมดแก้ไขข้อมูลบนหน้า)"
          >
            <Edit3 size={13} className="text-[#0F6659] group-hover:scale-110 transition-transform" />
            <span>แก้ไขผลตรวจ</span>
          </button>
        )}
      </div>

      {/* Mobile view (หน้าจอมือถือ): แสดงเป็นปุ่มไอคอนเดียว กดแล้วเด้ง Dropdown เมนูลงมาเพื่อไม่ให้ล้นหน้าจอ */}
      <div className="relative sm:hidden" ref={menuRef}>
        <button
          type="button"
          onClick={() => setIsOpen(prev => !prev)}
          className={`w-9 h-9 rounded-full flex items-center justify-center border shadow-2xs transition-all active:scale-90 cursor-pointer ${
            isOpen
              ? "bg-emerald-50 text-[#0F6659] border-emerald-300 ring-2 ring-emerald-400/20"
              : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200"
          }`}
          title="เครื่องมือจัดการผลตรวจ"
          aria-label="เครื่องมือจัดการผลตรวจ"
        >
          <MoreVertical size={18} className={isOpen ? "text-[#0F6659]" : "text-slate-700"} />
        </button>

        {isOpen && (
          <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl bg-white backdrop-blur-md border border-slate-200/90 shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 origin-top-right">
            <div className="px-3.5 py-1.5 text-[11px] font-bold text-slate-400 border-b border-slate-100 flex items-center justify-between">
              <span>เครื่องมือการแก้ไข</span>
            </div>

            <div className="p-1 space-y-0.5">
              {canEditAudit && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onEnterEditMode();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-bold text-slate-700 hover:text-[#0F6659] hover:bg-emerald-50/70 transition-colors cursor-pointer group"
                >
                  <div className="w-7 h-7 rounded-lg bg-emerald-100/60 text-[#0F6659] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Edit3 size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-800 group-hover:text-[#0F6659]">แก้ไขผลตรวจ</div>
                    <div className="text-[10px] font-normal text-slate-400">เข้าสู่โหมดแก้ไขข้อมูลบนหน้า</div>
                  </div>
                </button>
              )}

              {canReopenAudit && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onReopen();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-bold text-slate-700 hover:text-amber-800 hover:bg-amber-50/70 transition-colors cursor-pointer group"
                >
                  <div className="w-7 h-7 rounded-lg bg-amber-100/70 text-amber-700 flex items-center justify-center shrink-0 group-hover:-rotate-45 transition-transform">
                    <RotateCcw size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-800 group-hover:text-amber-900">ย้อนเป็นแบบร่าง</div>
                    <div className="text-[10px] font-normal text-slate-400">คัดลอกไปเป็นแบบร่างใหม่</div>
                  </div>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuditHistoryDetail({ unitName, record = {}, onBack, onResumeDraft }) {
  const { locations: allLocations, forms = [], getFormDetail, currentUser, refreshData, auditRecords = [] } = React.useContext(DataContext);
  const [activeTab, setActiveTab] = useState("overview"); // 'responses' | 'overview' | 'photos' | 'sign'
  const [disputeSubmitted, setDisputeSubmitted] = useState(record.status === "Disputed");
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [capSubmissions, setCapSubmissions] = useState({});

  // 🌟 Real CAP Tasks State for Current Audit Record
  const [recordCaps, setRecordCaps] = useState([]);
  const [selectedCapTask, setSelectedCapTask] = useState(null);
  const [loadingCapQuestionId, setLoadingCapQuestionId] = useState(null);

  // 🌟 Local Record State for Immediate UI Updates on Edit
  const [currentRecord, setCurrentRecord] = useState(record);
  const [reopenedFromDocNo, setReopenedFromDocNo] = useState(record?.reopenedFromDocumentNo || null);

  useEffect(() => {
    if (!currentRecord?.reopenedFromRecordId) {
      setReopenedFromDocNo(null);
      return;
    }
    if (currentRecord.reopenedFromDocumentNo) {
      setReopenedFromDocNo(currentRecord.reopenedFromDocumentNo);
      return;
    }
    const matched = (auditRecords || []).find(r => r.id === currentRecord.reopenedFromRecordId);
    if (matched?.documentNo) {
      setReopenedFromDocNo(matched.documentNo);
      return;
    }
    let isMounted = true;
    api.get(`/audit/${currentRecord.reopenedFromRecordId}`)
      .then(res => {
        if (isMounted && res.data?.documentNo) {
          setReopenedFromDocNo(res.data.documentNo);
        }
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, [currentRecord?.reopenedFromRecordId, currentRecord?.reopenedFromDocumentNo, auditRecords]);
  const [isCategoryScoresExpanded, setIsCategoryScoresExpanded] = useState(true);
  const [isAuditDetailsExpanded, setIsAuditDetailsExpanded] = useState(true);
  const [activeSectionIndex, setActiveSectionIndex] = useState(null);
  const [isCategoryDrawerOpen, setIsCategoryDrawerOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const loadCapTasksForRecord = async () => {
    const recId = currentRecord?.id || record?.id;
    if (!recId) return;
    try {
      const res = await api.get(`/cap?auditRecordId=${recId}`);
      if (Array.isArray(res.data)) {
        setRecordCaps(res.data);
      }
    } catch (err) {}
  };

  useEffect(() => {
    loadCapTasksForRecord();
  }, [currentRecord?.id, record?.id]);

  const findCapTaskForQuestion = (q) => {
    if (!recordCaps || recordCaps.length === 0) return null;
    
    // 1. Match by exact auditResponseId (Most accurate from database)
    if (q.auditResponseId) {
      const byResp = recordCaps.find(c => Number(c.auditResponseId) === Number(q.auditResponseId));
      if (byResp) return byResp;
    }

    // 2. Match by exact question text
    const cleanQ = (q.text || "").trim().toLowerCase();
    if (cleanQ) {
      const byExactText = recordCaps.find(c => (c.issueItem || "").trim().toLowerCase() === cleanQ);
      if (byExactText) return byExactText;

      const byText = recordCaps.find(c => {
        const issue = (c.issueItem || "").trim().toLowerCase();
        return issue && (cleanQ.includes(issue) || issue.includes(cleanQ));
      });
      if (byText) return byText;
    }

    // 3. Match by surveyItemId if available
    if (q.surveyItemId) {
      const bySurveyItem = recordCaps.find(c => Number(c.surveyItemId) === Number(q.surveyItemId));
      if (bySurveyItem) return bySurveyItem;
    }

    if (recordCaps.length === 1) return recordCaps[0];
    return null;
  };

  const handleOpenCapChat = async (q) => {
    const existing = findCapTaskForQuestion(q);
    const qImages = (q.images || []).map(img => img.imageUrl || img.url || img).filter(Boolean);
    const qFirstImg = qImages[0] || null;

    if (existing) {
      setSelectedCapTask({
        ...existing,
        unit: currentRecord.location?.name || locationTitle || existing.locationName || unitName,
        locationName: currentRecord.location?.name || locationTitle || existing.locationName || unitName,
        questionNumber: q.num || existing.questionNumber,
        orderIndex: q.num || existing.questionNumber,
        title: existing.issueItem || q.text || "งานแก้ไข CAP",
        desc: existing.description || q.note || "-",
        beforeImageUrl: qFirstImg || existing.beforeImageUrl || null,
        beforeImages: qImages.length > 0 ? qImages : (existing.beforeImages || []),
        scoreGiven: q.scoreGiven !== undefined ? q.scoreGiven : existing.scoreGiven,
        fullScore: Number(q.fullScore ?? existing.fullScore ?? 0)
      });
      return;
    }

    setLoadingCapQuestionId(q.id);
    try {
      const createRes = await api.post("/cap", {
        locationId: currentRecord.locationId || 1,
        auditRecordId: currentRecord.id || record?.id,
        issueItem: q.text || `ข้อบกพร่องข้อที่ ${q.num}`,
        description: q.note || `ไม่ผ่านเกณฑ์การประเมิน: ${q.text || ""}`,
        submissionDeadline: new Date(Date.now() + 7 * 86400000).toISOString()
      });
      const newCap = createRes.data;
      await loadCapTasksForRecord();
      setSelectedCapTask({
        ...newCap,
        unit: currentRecord.location?.name || locationTitle || newCap.locationName || unitName,
        locationName: currentRecord.location?.name || locationTitle || newCap.locationName || unitName,
        questionNumber: q.num,
        orderIndex: q.num,
        title: newCap.issueItem || q.text,
        desc: newCap.description || q.note || "-"
      });
    } catch (err) {
      setSelectedCapTask({
        id: `temp_${Date.now()}`,
        auditRecordId: currentRecord.id || record?.id,
        unit: currentRecord.location?.name || locationTitle || unitName,
        locationName: currentRecord.location?.name || locationTitle || unitName,
        questionNumber: q.num,
        orderIndex: q.num,
        title: q.text || "งานแก้ไข CAP",
        desc: q.note || "-"
      });
    } finally {
      setLoadingCapQuestionId(null);
    }
  };
  useEffect(() => {
    setCurrentRecord(record);
    if (record?.id) {
      api.get(`/audit/${record.id}`)
        .then(res => {
          if (res.data) {
            setCurrentRecord(res.data);
          }
        })
        .catch(() => {});
    }
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    document.documentElement?.scrollTo({ top: 0, left: 0, behavior: "instant" });
    document.body?.scrollTo({ top: 0, left: 0, behavior: "instant" });
    const mainEl = document.querySelector("main");
    if (mainEl) mainEl.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [record]);

  // 🛡️ Permissions & Edit Logs State
  const isReopened = String(currentRecord?.status || "").toUpperCase() === "REOPENED";
  const canEditAudit = !isReopened && (currentUser?.role === "ADMIN" || currentUser?.roleCode === "ADMIN" || (currentUser?.permissions || []).includes("audit.edit"));
  const canReopenAudit = !isReopened && (currentUser?.role === "ADMIN" || currentUser?.roleCode === "ADMIN" || (currentUser?.permissions || []).includes("audit.reopen"));
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [isReopening, setIsReopening] = useState(false);
  const [reopenError, setReopenError] = useState("");
  const [editLogsCount, setEditLogsCount] = useState(0);
  const [showEditLogsModal, setShowEditLogsModal] = useState(false);
  const [showAiDefectModal, setShowAiDefectModal] = useState(false);

  // 🌟 INLINE EDITING STATES (โหมดแก้ไขบนหน้า ไม่ต้องเปิดป๊อบอัพ)
  const [isEditing, setIsEditing] = useState(false);
  const [editAnswersState, setEditAnswersState] = useState({});
  const [initialAnswersState, setInitialAnswersState] = useState({});
  const [expandedCommentItems, setExpandedCommentItems] = useState({});
  const [expandedPhotoItems, setExpandedPhotoItems] = useState({});
  const [editStaffCount, setEditStaffCount] = useState(0);
  const [editAuditType, setEditAuditType] = useState("announced");
  const [editStartedAt, setEditStartedAt] = useState("");
  const [editSubmittedAt, setEditSubmittedAt] = useState("");
  const initialTimesRef = useRef({ started: "", submitted: "" });
  const [editMetadataValues, setEditMetadataValues] = useState({});
  const [editGeneralNotes, setEditGeneralNotes] = useState("");
  const [editAuditorSignature, setEditAuditorSignature] = useState(null);
  const [editAuditeeSignature, setEditAuditeeSignature] = useState(null);
  const [editAuditeeNameText, setEditAuditeeNameText] = useState("");
  const [editStartLatitude, setEditStartLatitude] = useState("");
  const [editStartLongitude, setEditStartLongitude] = useState("");
  const [editEndLatitude, setEditEndLatitude] = useState("");
  const [editEndLongitude, setEditEndLongitude] = useState("");
  const [isFetchingStartGps, setIsFetchingStartGps] = useState(false);
  const [isFetchingEndGps, setIsFetchingEndGps] = useState(false);
  const [activeSignModal, setActiveSignModal] = useState(null); // 'auditor' | 'auditee' | null
  const [usersList, setUsersList] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmSaveModal, setShowConfirmSaveModal] = useState(false);
  const [overallReason, setOverallReason] = useState("");
  const [isUploadingPhoto, setIsUploadingPhoto] = useState({});
  const [previewEditPhoto, setPreviewEditPhoto] = useState(null);

  const [lastUpdatedTimestamp, setLastUpdatedTimestamp] = useState(null);

  const fetchEditLogs = () => {
    if (!currentRecord?.id) return;
    api.get(`/audit/${currentRecord.id}/edit-logs`)
      .then(res => {
        if (Array.isArray(res.data)) {
          setEditLogsCount(res.data.length);
          if (res.data.length > 0 && res.data[0]?.editedAt) {
            setLastUpdatedTimestamp(res.data[0].editedAt);
          }
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchEditLogs();
  }, [currentRecord?.id]);

  const handleSaveSuccess = async () => {
    if (refreshData) refreshData();
    fetchEditLogs();
    if (currentRecord?.id) {
      try {
        const res = await api.get(`/audit/${currentRecord.id}`);
        if (res.data) {
          setCurrentRecord(res.data);
        }
      } catch (err) {}
    }
  };

  const handleConfirmReopen = async () => {
    const trimmed = (reopenReason || "").trim();
    if (!trimmed) {
      setReopenError("กรุณาระบุเหตุผลในการย้อนสถานะ");
      return;
    }
    setIsReopening(true);
    setReopenError("");
    try {
      await api.post(`/audit/${currentRecord.id}/reopen`, {
        reason: trimmed
      });
      setShowReopenModal(false);
      setReopenReason("");
      if (refreshData) refreshData();
      const res = await api.get(`/audit/${currentRecord.id}`);
      if (res.data) {
        setCurrentRecord(res.data);
      }
    } catch (err) {
      const msg = err.response?.data?.message || "เกิดข้อผิดพลาดในการย้อนสถานะผลตรวจ กรุณาลองใหม่อีกครั้ง";
      setReopenError(msg);
    } finally {
      setIsReopening(false);
    }
  };

  // ค้นหา Form Definition ที่ตรงกันเพื่อดึง Schema ของ Metadata (จับคู่ด้วย ID ตรงกันเท่านั้น ห้ามใช้ชื่อฟอร์มเทียบข้ามเวอร์ชัน)
  const matchedForm = useMemo(() => {
    const targetId = currentRecord?.surveyFormId || currentRecord?.formId;
    if (!targetId) return null;
    return (forms || []).find(f => Number(f.id) === Number(targetId)) || null;
  }, [forms, currentRecord?.surveyFormId, currentRecord?.formId]);

  // 🌟 โหลด form detail ของเวอร์ชันที่ตรงกับรอบตรวจนี้ (ตาม surveyFormId) หากยังไม่มี sections หรือ metadataConfig
  useEffect(() => {
    const targetId = currentRecord?.surveyFormId || currentRecord?.formId;
    if (!targetId || !getFormDetail) return;
    if (matchedForm && Array.isArray(matchedForm.sections) && (matchedForm.metadataConfigJson || matchedForm.metadataConfig)) return; // hydrate แล้ว
    getFormDetail(targetId);
  }, [currentRecord?.surveyFormId, currentRecord?.formId, matchedForm, getFormDetail]);

  // Normalized audit record attributes
  const isBackdated = Boolean(currentRecord.isBackdated);
  const score = typeof currentRecord.percentageScore === "number" 
    ? currentRecord.percentageScore 
    : (typeof currentRecord.score === "number" ? currentRecord.score : 0);
  const passingScore = currentRecord.surveyForm?.passingScore ?? currentRecord.passingScore ?? matchedForm?.passingScore ?? 85;
  const dateStr = currentRecord.date || (currentRecord.auditDate ? formatThaiDate(currentRecord.auditDate) : "-");
  const actualInspectDateStr = currentRecord.startedAt ? formatThaiDate(currentRecord.startedAt) : dateStr;
  const createdDateStr = currentRecord.createdAt ? (formatThaiDate(currentRecord.createdAt) + ' ' + formatThaiTime(currentRecord.createdAt)) : null;
  const auditorName = currentRecord.auditor || currentRecord.auditorName || currentRecord.primaryAuditor?.fullName || "-";
  const formTitle = currentRecord.form || currentRecord.formName || currentRecord.surveyFormTitle || currentRecord.surveyForm?.title || "-";
  const passed = currentRecord.isPassed !== undefined ? currentRecord.isPassed : (score >= passingScore && !currentRecord.hasCriticalDefect);
  const hasCritical = currentRecord.hasCriticalDefect || (currentRecord.responses && currentRecord.responses.some(r => r.isCritical && !r.isPassed));
  const locationTitle = unitName || currentRecord.unitFullName || currentRecord.locationName || currentRecord.location?.name || "-";
  const managerName = currentRecord.auditeeName || currentRecord.auditeeUser?.fullName || "-";
  const auditType = (currentRecord.auditType === "unannounced" || currentRecord.auditType === "spot") 
    ? "นอกกำหนดการ" 
    : (currentRecord.auditType === "undercover" ? "ปลอมตัว" : "ตามกำหนดการ");

  const parsedMetadataValues = useMemo(() => {
    let result = {};
    if (currentRecord?.metadataValuesJson) {
      try {
        const parsed = JSON.parse(currentRecord.metadataValuesJson);
        if (parsed && typeof parsed === "object") {
          result = parsed;
        }
      } catch (e) {}
    }
    if (currentRecord?.metadataValues && typeof currentRecord.metadataValues === "object") {
      result = { ...result, ...currentRecord.metadataValues };
      if (currentRecord.metadataValues._fields) {
        result._fields = currentRecord.metadataValues._fields;
      }
    }
    return result;
  }, [currentRecord]);

  const staffCount = useMemo(() => {
    if (currentRecord?.staffCount !== undefined && currentRecord?.staffCount !== null && Number(currentRecord.staffCount) > 0) {
      return Number(currentRecord.staffCount);
    }
    const storedFields = Array.isArray(parsedMetadataValues?._fields)
      ? parsedMetadataValues._fields
      : (Array.isArray(parsedMetadataValues) ? parsedMetadataValues : []);
    const fieldStaff = storedFields.find(f => f.id === "staff_count" || f.id === "staffCount");
    if (fieldStaff?.value !== undefined && fieldStaff?.value !== null && fieldStaff?.value !== "") {
      return Number(fieldStaff.value) || 0;
    }
    if (parsedMetadataValues?.staff_count !== undefined && parsedMetadataValues?.staff_count !== null && parsedMetadataValues?.staff_count !== "") {
      return Number(parsedMetadataValues.staff_count) || 0;
    }
    return Number(currentRecord?.staffCount) || 0;
  }, [currentRecord, parsedMetadataValues]);

  // รวมรายการ Metadata ทั้งหมด (ฟิลด์มาตรฐาน 3 ฟิลด์ + ฟิลด์เพิ่มเติมเฉพาะรอบตรวจ ตามลำดับและ Label ที่ตั้งไว้)
  const allDisplayMetadataFields = useMemo(() => {
    // ฟังก์ชันช่วยแกะ Metadata Schema จาก Form Config
    const extractMetadataConfig = (raw) => {
      if (!raw) return null;
      if (Array.isArray(raw)) return raw;
      if (typeof raw === "string") {
        try {
          return extractMetadataConfig(JSON.parse(raw));
        } catch (e) {
          return null;
        }
      }
      if (typeof raw === "object") {
        if (Array.isArray(raw.metadataConfig)) return raw.metadataConfig;
        if (raw.metadataConfigJson) return extractMetadataConfig(raw.metadataConfigJson);
        if (raw.metadataJson) return extractMetadataConfig(raw.metadataJson);
        if (Array.isArray(raw.fields)) return raw.fields;
      }
      return null;
    };

    const formConfig = extractMetadataConfig(currentRecord?.surveyForm?.metadataConfig)
      || extractMetadataConfig(currentRecord?.surveyForm?.metadataConfigJson)
      || extractMetadataConfig(matchedForm?.metadataConfig)
      || extractMetadataConfig(matchedForm?.metadataConfigJson);

    // 1. ถ้าใน JSON มีการบันทึก _fields แบบมีโครงสร้าง (order, label, value, type, unit)
    const storedFields = Array.isArray(parsedMetadataValues?._fields)
      ? parsedMetadataValues._fields
      : (Array.isArray(parsedMetadataValues) ? parsedMetadataValues : null);

    if (Array.isArray(storedFields) && storedFields.length > 0) {
      const sorted = [...storedFields].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
      return sorted.map((f, idx) => {
        let displayVal = f.value;
        if (f.id === "audit_type") {
          const raw = String(f.value || auditType || "").toLowerCase();
          displayVal = raw.includes("ปลอม") || raw === "undercover"
            ? "ปลอมตัว"
            : (raw.includes("นอก") || raw === "spot" || raw === "unannounced")
              ? "นอกกำหนดการ"
              : "ตามกำหนดการ";
        } else if (f.id === "staff_count") {
          const sc = f.value !== undefined && f.value !== null && f.value !== "" ? f.value : staffCount;
          displayVal = sc !== undefined && sc !== null && sc !== "" ? String(sc) : "-";
        } else if (f.id === "auditor" || f.type === "auditor") {
          displayVal = f.value || "-";
        } else if (Array.isArray(displayVal)) {
          displayVal = displayVal.length > 0 ? displayVal.join(", ") : "-";
        } else if (typeof displayVal === "boolean") {
          displayVal = displayVal ? "✓ ใช่ (Yes)" : "ไม่ใช่ (No)";
        } else if (displayVal === undefined || displayVal === null || displayVal === "") {
          displayVal = "-";
        } else {
          displayVal = String(displayVal);
        }

        const matchedMeta = Array.isArray(formConfig)
          ? formConfig.find(m => m.id === f.id || m.id?.replace(/^meta_/, '') === f.id?.replace(/^meta_/, ''))
          : null;

        const resolvedType = matchedMeta?.type || f.type || (matchedMeta?.fieldConfig?.columns ? "grid" : "text");
        const resolvedFieldConfig = f.fieldConfig || matchedMeta?.fieldConfig || (matchedMeta ? { options: matchedMeta.options, columns: matchedMeta.columns, rows: matchedMeta.rows } : null);
        const resolvedOptions = (f.options && Array.isArray(f.options) && f.options.length > 0)
          ? f.options
          : (f.fieldConfig?.options && Array.isArray(f.fieldConfig.options) && f.fieldConfig.options.length > 0)
          ? f.fieldConfig.options
          : (matchedMeta?.options && Array.isArray(matchedMeta.options) && matchedMeta.options.length > 0)
          ? matchedMeta.options
          : (matchedMeta?.fieldConfig?.options && Array.isArray(matchedMeta.fieldConfig.options) && matchedMeta.fieldConfig.options.length > 0)
          ? matchedMeta.fieldConfig.options
          : null;

        return {
          id: f.id || `field_${idx}`,
          label: f.label || matchedMeta?.label || (f.id ? f.id.replace(/^meta_/, '').replace(/_/g, ' ') : `ข้อมูลที่ ${idx + 1}`),
          value: displayVal,
          rawValue: f.value,
          type: resolvedType,
          fieldConfig: resolvedFieldConfig,
          options: resolvedOptions,
          unit: f.unit ? (f.unit.startsWith(" ") ? f.unit : ` ${f.unit}`) : ""
        };
      });
    }

    // 2. กรณีประวัติเก่าที่ยังไม่มี _fields: ดึง schema จาก form config มาจับคู่
    const defaultSystemConfig = [
      { id: "auditor", label: "ผู้ตรวจประเมิน (Auditor)", type: "auditor", enabled: true, isSystem: true },
      { id: "audit_type", label: "ประเภทการตรวจ (Audit Type)", type: "select", options: ["ตามกำหนดการ", "นอกกำหนดการ", "ปลอมตัว"], enabled: true, isSystem: true },
      { id: "staff_count", label: "จำนวนพนักงานขณะตรวจ", type: "number", unit: "คน", enabled: true, isSystem: true }
    ];

    let effectiveConfig = [];
    if (Array.isArray(formConfig) && formConfig.length > 0) {
      effectiveConfig = [...formConfig];
      defaultSystemConfig.forEach((sysField) => {
        if (!effectiveConfig.some(f => f.id === sysField.id || (sysField.id === "auditor" && f.type === "auditor"))) {
          effectiveConfig.unshift(sysField);
        }
      });
    } else {
      effectiveConfig = defaultSystemConfig;
    }

    const list = [];
    effectiveConfig.forEach(field => {
      if (field.enabled === false) return;

      if (field.id === "auditor" || field.type === "auditor") {
        list.push({
          id: field.id,
          label: field.label || "ผู้ตรวจประเมิน (Auditor)",
          value: parsedMetadataValues[field.id] || parsedMetadataValues.auditor || "-",
          unit: ""
        });
      } else if (field.id === "audit_type") {
        list.push({
          id: field.id,
          label: field.label || "ประเภทการตรวจ (Audit Type)",
          value: auditType,
          type: field.type || "select",
          fieldConfig: field.fieldConfig || { options: field.options },
          options: field.options || field.fieldConfig?.options,
          unit: ""
        });
      } else if (field.id === "staff_count") {
        const sc = parsedMetadataValues.staff_count !== undefined && parsedMetadataValues.staff_count !== null
          ? parsedMetadataValues.staff_count
          : staffCount;
        list.push({
          id: field.id,
          label: field.label || "จำนวนพนักงานขณะตรวจ",
          value: sc !== undefined && sc !== null && sc !== "" ? String(sc) : "-",
          unit: field.unit ? (field.unit.startsWith(" ") ? field.unit : ` ${field.unit}`) : " คน"
        });
      } else {
        const val = parsedMetadataValues[field.id];
        if (val !== undefined && val !== null && val !== "") {
          const displayVal = Array.isArray(val)
            ? (val.length > 0 ? val.join(", ") : "-")
            : typeof val === "boolean" 
              ? (val ? "✓ ใช่ (Yes)" : "ไม่ใช่ (No)")
              : String(val);
          list.push({
            id: field.id,
            label: field.label || field.placeholder || field.id.replace(/^meta_/, '').replace(/_/g, ' '),
            value: displayVal,
            rawValue: val,
            type: field.type || (field.fieldConfig?.columns ? "grid" : "text"),
            fieldConfig: field.fieldConfig || { options: field.options, columns: field.columns, rows: field.rows },
            options: field.options || field.fieldConfig?.options || [],
            unit: field.unit ? (field.unit.startsWith(" ") ? field.unit : ` ${field.unit}`) : ""
          });
        }
      }
    });

    // หากมีค่าใน parsedMetadataValues ที่ไม่ได้อยู่ใน effectiveConfig
    Object.entries(parsedMetadataValues).forEach(([k, v]) => {
      if (v === undefined || v === null || v === "" || k === "auditor" || k === "audit_type" || k === "staff_count" || k === "_fields") return;
      if (!list.some(item => item.id === k)) {
        // หาว่ามี definition ใน formConfig ไหม
        const matchedField = Array.isArray(formConfig) ? formConfig.find(f => f.id === k || f.id?.replace(/^meta_/, '') === k.replace(/^meta_/, '')) : null;
        const finalLabel = matchedField?.label || matchedField?.placeholder || k.replace(/^meta_/, '').replace(/_/g, ' ');
        const finalType = matchedField?.type || (matchedField?.fieldConfig?.columns ? "grid" : (typeof v === "object" ? "grid" : "text"));
        const finalConfig = matchedField?.fieldConfig || (matchedField ? { options: matchedField.options, columns: matchedField.columns, rows: matchedField.rows } : null);
        const displayVal = Array.isArray(v)
          ? (v.length > 0 ? v.join(", ") : "-")
          : typeof v === "boolean" ? (v ? "✓ ใช่ (Yes)" : "ไม่ใช่ (No)") : String(v);
        list.push({
          id: k,
          label: finalLabel,
          value: displayVal,
          rawValue: v,
          type: finalType,
          fieldConfig: finalConfig,
          options: matchedField?.options || finalConfig?.options || [],
          unit: matchedField?.unit ? (matchedField.unit.startsWith(" ") ? matchedField.unit : ` ${matchedField.unit}`) : ""
        });
      }
    });

    return list;
  }, [matchedForm, currentRecord, auditorName, auditType, staffCount, parsedMetadataValues]);

  // Location and GPS Metadata
  const matchedLocation = useMemo(() => {
    return allLocations.find(l => (currentRecord.locationId && l.id === currentRecord.locationId) || l.name === locationTitle || l.fullName === locationTitle);
  }, [allLocations, currentRecord.locationId, locationTitle]);

  const locationCode = currentRecord.locationCode || matchedLocation?.code || currentRecord.location?.code || "";
  const fullLocationName = locationCode ? `${locationCode} - ${locationTitle}` : locationTitle;

  const branchAddress = currentRecord.location?.address || matchedLocation?.address || "-";
  const startLat = currentRecord.startLatitude ?? null;
  const startLng = currentRecord.startLongitude ?? null;
  const endLat = currentRecord.endLatitude ?? null;
  const endLng = currentRecord.endLongitude ?? null;
  const formatTimeWithSeconds = (d, fallback) => {
    if (!d) return fallback;
    let s = String(d).trim();
    if (!s.endsWith("Z") && !s.includes("+") && !s.includes("-", 10)) {
      s = s + "Z";
    }
    const dt = new Date(s);
    if (isNaN(dt.getTime())) return fallback;
    return dt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Bangkok' }) + ' น.';
  };

  const startedTimeStr = formatTimeWithSeconds(currentRecord.startedAt, "-");
  const submittedTimeStr = formatTimeWithSeconds(currentRecord.submittedAt, "-");

  // Dynamic Form Question Breakdown
  const formBreakdown = useMemo(() => {
    // If real responses exist from DB API
    if (currentRecord.responses && Array.isArray(currentRecord.responses) && currentRecord.responses.length > 0) {
      const targetFormId = currentRecord.surveyFormId || currentRecord.formId;
      // 1. ตรวจสอบว่ามี Form schema ใน DataContext ที่มี ID ตรงกับรอบตรวจนี้จริงเท่านั้น (ห้ามจับคู่ด้วยชื่อข้ามเวอร์ชัน)
      const isExactFormMatched = matchedForm && targetFormId && Number(matchedForm.id) === Number(targetFormId);

      if (isExactFormMatched && Array.isArray(matchedForm.sections) && matchedForm.sections.length > 0) {
        let runningNum = 1;
        const resultSections = [];

        matchedForm.sections.forEach((sec, sIdx) => {
          const secQuestions = [];

          (sec.items || []).forEach((item) => {
            // Find corresponding response by strict ID matching
            const matchedRes = currentRecord.responses.find(r => 
              (r.surveyItemId && Number(r.surveyItemId) === Number(item.id)) ||
              (r.surveyItem?.id && Number(r.surveyItem.id) === Number(item.id))
            );
            const hasResponse = Boolean(matchedRes && (matchedRes.id || matchedRes.rawAnswer !== undefined || matchedRes.answerValue !== undefined || matchedRes.scoreGiven !== undefined));
            let res = matchedRes || {};

            const qText = item.questionText || item.text || res.questionText || `ข้อตรวจที่ ${runningNum}`;
            const qType = (res.questionType || item.questionType || item.type || "YESNO").toLowerCase();
            const isNonScored = typeof res.isScored === "boolean"
              ? !res.isScored
              : (typeof item.isScored === "boolean"
                  ? !item.isScored
                  : (sec.sectionType === "INFO" || ["grid","number","select","radio","checkbox","text","date","time","auditor", "multians"].includes(qType)));
            const fullSc = isNonScored ? 0 : (res.fullScore !== undefined ? res.fullScore : (item.fullScore || 0));
            const isCrit = !isNonScored && (res.isCritical !== undefined ? res.isCritical : (item.isCritical || item.critical || false));
            const isNa = !isNonScored && !!(res.isNa || res.rawAnswer === "na" || res.answerValue === "na");

            const calculatedScaleScore = res.scaleScore !== undefined && res.scaleScore !== null
              ? Number(res.scaleScore)
              : (res.rawAnswer && !isNaN(Number(res.rawAnswer)) && Number(res.rawAnswer) >= 1 && Number(res.rawAnswer) <= 5
                  ? Number(res.rawAnswer)
                  : (qType === "scale" && res.scoreGiven !== undefined && fullSc > 0
                      ? Math.max(1, Math.min(5, Math.round((Number(res.scoreGiven) / fullSc) * 5)))
                      : null));

            const isPass = !hasResponse
              ? null
              : (isNonScored
                  ? true
                  : (isNa
                      ? true
                      : (res.isPassed !== undefined
                          ? Boolean(res.isPassed)
                          : (qType === "scale"
                              ? (calculatedScaleScore !== null ? calculatedScaleScore >= 3 : (res.scoreGiven !== undefined ? res.scoreGiven >= (fullSc * 0.6) : null))
                              : (res.scoreGiven !== undefined ? res.scoreGiven > 0 : null)))));

            const calculatedScore = !hasResponse || isNonScored ? 0 : (isNa ? 0 : (res.scoreGiven !== undefined ? res.scoreGiven : (isPass ? fullSc : 0)));

            const nonScored = isNonScored ? splitNonScoredNotes(res.notes, qType) : null;
            let resolvedRawAnswer = isNonScored
              ? (res.answerValue !== undefined && res.answerValue !== null && res.answerValue !== ""
                  ? res.answerValue
                  : (res.rawAnswer !== undefined && res.rawAnswer !== null && res.rawAnswer !== "" ? res.rawAnswer : (nonScored?.answer ?? "")))
              : (res.rawAnswer || res.answerValue || "");

            if ((qType === "grid" || qType === "checkbox") && typeof resolvedRawAnswer === "string" && resolvedRawAnswer.trim()) {
              try { 
                resolvedRawAnswer = JSON.parse(resolvedRawAnswer); 
              } catch (e) {}
            }

            // 🌟 แยกคอมเม้นออกจากคำตอบอย่างแท้จริง ไม่ให้คำตอบหลุดมาแสดงในกล่องบันทึกผู้ตรวจ
            let resolvedNote = null;
            if (res.notes && typeof res.notes === "string" && res.notes.trim()) {
              const trimmed = res.notes.trim();
              if (isNonScored && nonScored?.comment) {
                resolvedNote = nonScored.comment;
              } else if (isRealCommentText(trimmed, resolvedRawAnswer)) {
                resolvedNote = trimmed;
              }
            }

            secQuestions.push({
              num: runningNum++,
              id: `q_${res.id || item.id || runningNum}`,
              auditResponseId: res.id || null,
              surveyItemId: res.surveyItemId || item.id || null,
              hasResponse,
              text: qText,
              type: qType,
              questionType: qType,
              isScored: !isNonScored,
              fieldConfig: item.fieldConfig || res.fieldConfig || res.surveyItem?.fieldConfig,
              rawAnswer: resolvedRawAnswer,
              answer: qType === "scale"
                ? calculatedScaleScore
                : (isNonScored ? resolvedRawAnswer : isPass),
              scoreGiven: calculatedScore,
              scaleScore: calculatedScaleScore,
              fullScore: fullSc,
              isCritical: isCrit,
              isNa: isNa,
              isPassed: isPass,
              categoryName: item.categoryName || item.category || res.categoryName || res.surveyItem?.categoryName,
              categoryCode: item.categoryCode || res.categoryCode || res.surveyItem?.categoryCode,
              sectionTitle: sec.title,
              note: resolvedNote,
              hasPhoto: (res.images && res.images.length > 0) || (isPass === false && !isNa && res.hasPhoto),
              images: res.images || []
            });
          });

          if (secQuestions.length > 0) {
            resultSections.push({
              title: sec.title || `หมวดที่ ${sIdx + 1}`,
              orderIndex: sec.orderIndex !== undefined ? sec.orderIndex : sIdx + 1,
              sectionType: sec.sectionType || (sec.items?.every(i => i.isScored === false) ? "INFO" : "AUDIT"),
              questions: secQuestions
            });
          }
        });

        if (resultSections.length > 0) {
          return resultSections;
        }
      }

      // 2. Otherwise group dynamically by res.sectionTitle / res.surveySectionId
      const sectionsMap = new Map();
      let runningNum = 1;

      currentRecord.responses.forEach((res, idx) => {
        const secName = res.sectionTitle || res.surveyItem?.surveySection?.title || `หมวดที่ 1: การประเมินมาตรฐาน`;
        const qText = res.questionText || res.surveyItem?.questionText || `ข้อตรวจที่ ${idx + 1}`;
        const qType = (res.questionType || res.surveyItem?.questionType || "YESNO").toLowerCase();
        const isNonScored = typeof res.isScored === "boolean"
          ? !res.isScored
          : (typeof res.surveyItem?.isScored === "boolean"
              ? !res.surveyItem.isScored
              : (res.sectionType === "INFO" || res.surveyItem?.surveySection?.sectionType === "INFO" || ["grid","number","select","radio","checkbox","text","date","time","auditor", "multians"].includes(qType)));
        const isCrit = !isNonScored && (res.isCritical !== undefined ? res.isCritical : (res.surveyItem?.isCritical || false));
        const fullSc = isNonScored ? 0 : (res.fullScore !== undefined ? res.fullScore : (res.surveyItem?.fullScore || 0));
        const isNa = !isNonScored && !!(res.isNa || res.rawAnswer === "na" || res.answerValue === "na");

        const calculatedScaleScore = res.scaleScore !== undefined && res.scaleScore !== null
          ? Number(res.scaleScore)
          : (res.rawAnswer && !isNaN(Number(res.rawAnswer)) && Number(res.rawAnswer) >= 1 && Number(res.rawAnswer) <= 5
              ? Number(res.rawAnswer)
              : (qType === "scale" && res.scoreGiven !== undefined && fullSc > 0
                  ? Math.max(1, Math.min(5, Math.round((Number(res.scoreGiven) / fullSc) * 5)))
                  : null));

        const isPass = isNonScored
          ? true
          : (isNa
              ? true
              : (res.isPassed !== undefined
                  ? Boolean(res.isPassed)
                  : (qType === "scale"
                      ? (calculatedScaleScore !== null ? calculatedScaleScore >= 3 : (res.scoreGiven !== undefined ? res.scoreGiven >= (fullSc * 0.6) : null))
                      : (res.scoreGiven !== undefined ? res.scoreGiven > 0 : null))));

        const calculatedScore = isNonScored ? 0 : (isNa ? 0 : (res.scoreGiven !== undefined ? res.scoreGiven : (isPass ? fullSc : 0)));

        if (!sectionsMap.has(secName)) {
          sectionsMap.set(secName, {
            title: secName,
            orderIndex: res.sectionOrderIndex !== undefined ? res.sectionOrderIndex : sectionsMap.size + 1,
            sectionType: res.sectionType || "AUDIT",
            questions: []
          });
        }

        const nonScored = isNonScored ? splitNonScoredNotes(res.notes, qType) : null;
        let resolvedRawAnswer = isNonScored
          ? (res.answerValue !== undefined && res.answerValue !== null && res.answerValue !== ""
              ? res.answerValue
              : (res.rawAnswer !== undefined && res.rawAnswer !== null && res.rawAnswer !== "" ? res.rawAnswer : (nonScored?.answer ?? "")))
          : (res.rawAnswer || res.answerValue || "");

        if ((qType === "grid" || qType === "checkbox") && typeof resolvedRawAnswer === "string" && resolvedRawAnswer.trim()) {
          try { 
            resolvedRawAnswer = JSON.parse(resolvedRawAnswer); 
          } catch (e) {}
        }

        // 🌟 แยกคอมเม้นออกจากคำตอบอย่างแท้จริง ไม่ให้คำตอบหลุดมาแสดงในกล่องบันทึกผู้ตรวจ
        let resolvedNote = null;
        if (res.notes && typeof res.notes === "string" && res.notes.trim()) {
          const trimmed = res.notes.trim();
          if (isNonScored && nonScored?.comment) {
            resolvedNote = nonScored.comment;
          } else if (isRealCommentText(trimmed, resolvedRawAnswer)) {
            resolvedNote = trimmed;
          }
        }

        sectionsMap.get(secName).questions.push({
          num: runningNum++,
          id: `q_${res.id || idx}`,
          auditResponseId: res.id || null,
          surveyItemId: res.surveyItemId || null,
          hasResponse: true,
          text: qText,
          type: qType,
          questionType: qType,
          isScored: !isNonScored,
          fieldConfig: res.fieldConfig || res.surveyItem?.fieldConfig,
          rawAnswer: resolvedRawAnswer,
          answer: qType === "scale"
            ? (calculatedScaleScore !== null ? calculatedScaleScore : (res.scoreGiven !== undefined ? res.scoreGiven : null))
            : (isNonScored ? resolvedRawAnswer : isPass),
          scoreGiven: calculatedScore,
          scaleScore: calculatedScaleScore,
          fullScore: fullSc,
          isCritical: isCrit,
          isNa: isNa,
          isPassed: isPass,
          categoryName: res.categoryName || res.surveyItem?.categoryName,
          categoryCode: res.categoryCode || res.surveyItem?.categoryCode,
          sectionTitle: secName,
          note: resolvedNote,
          hasPhoto: (res.images && res.images.length > 0) || (!isPass && !isNa && res.hasPhoto),
          images: res.images || []
        });
      });

      return Array.from(sectionsMap.values()).sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
    }

    // No responses found from database
    return [];
  }, [currentRecord, forms]);

  // 🌟 รวมรายการคำถามทั้งหมดในฟอร์ม (Flat List)
  const allChecklistQuestions = useMemo(() => {
    return formBreakdown.flatMap(sec => sec.questions || []);
  }, [formBreakdown]);

  const parseResponseAnswer = useCallback((q) => {
    const isNonScored = q.isScored === false || ["grid","number","select","radio","checkbox","text","date","time","auditor", "multians"].includes(q.type || q.questionType);
    const qType = (q.type || q.questionType || "yesno").toLowerCase();
    const fullScore = Number(q.fullScore !== undefined && q.fullScore !== null ? q.fullScore : 0);
    const hasResp = Boolean(q.hasResponse);
    const isNa = !isNonScored && Boolean(q.isNa);
    const isPassed = !isNonScored ? (hasResp ? (q.isPassed !== null && q.isPassed !== undefined ? Boolean(q.isPassed) : (Number(q.scoreGiven || 0) > 0)) : null) : true;
    const scaleScore = qType === "scale" ? (q.scaleScore !== null && q.scaleScore !== undefined ? q.scaleScore : (hasResp && q.scoreGiven !== undefined && fullScore > 0 ? Math.round((Number(q.scoreGiven) / fullScore) * 5) : null)) : null;
    const scoreGiven = !hasResp || isNonScored ? 0 : (isNa ? 0 : (qType === "scale" ? (scaleScore !== null ? (((scaleScore || 5) / 5) * fullScore) : 0) : (isPassed ? fullScore : 0)));
    const parsedImages = Array.isArray(q.images) ? q.images.map(img => img.imageUrl || img.url || img).filter(Boolean) : [];
    const noteVal = (q.note || "").toString().trim();

    return {
      surveyItemId: q.surveyItemId || q.id,
      hasResponse: hasResp,
      userAnswered: hasResp,
      isNa,
      isPassed,
      scoreGiven,
      fullScore,
      type: qType,
      scaleScore,
      rawAnswer: q.rawAnswer || q.answerValue || "",
      answerValue: q.rawAnswer || q.answerValue || "",
      notes: noteVal,
      editReason: "",
      imageUrls: parsedImages
    };
  }, []);

  const handleEnterEditMode = useCallback(() => {
    if (!currentRecord) return;
    const initialMap = {};
    allChecklistQuestions.forEach(q => {
      if (q.surveyItemId) {
        initialMap[q.surveyItemId] = parseResponseAnswer(q);
      }
    });
    setEditAnswersState(initialMap);
    setInitialAnswersState(initialMap);
    setEditStaffCount(staffCount);
    setEditAuditType(currentRecord.auditType || "announced");
    const s0 = toDatetimeLocal(currentRecord.startedAt || currentRecord.auditDate || new Date().toISOString());
    const e0 = toDatetimeLocal(currentRecord.submittedAt || currentRecord.signedAt || currentRecord.auditDate || new Date().toISOString());
    initialTimesRef.current = { started: s0, submitted: e0 };
    setEditStartedAt(s0);
    setEditSubmittedAt(e0);
    setEditGeneralNotes(currentRecord.notes || "");
    setEditAuditorSignature(currentRecord.auditorSignatureUrl || currentRecord.auditorSignature || null);
    setEditAuditeeSignature(currentRecord.auditeeSignatureUrl || currentRecord.auditeeSignature || null);
    setEditAuditeeNameText(currentRecord.auditeeNameText || currentRecord.auditeeUser?.fullName || currentRecord.auditeeName || "");
    setEditStartLatitude(currentRecord.startLatitude !== undefined && currentRecord.startLatitude !== null ? String(currentRecord.startLatitude) : "");
    setEditStartLongitude(currentRecord.startLongitude !== undefined && currentRecord.startLongitude !== null ? String(currentRecord.startLongitude) : "");
    setEditEndLatitude(currentRecord.endLatitude !== undefined && currentRecord.endLatitude !== null ? String(currentRecord.endLatitude) : "");
    setEditEndLongitude(currentRecord.endLongitude !== undefined && currentRecord.endLongitude !== null ? String(currentRecord.endLongitude) : "");
    setEditMetadataValues({
      ...parsedMetadataValues,
      staff_count: staffCount
    });
    setOverallReason("");
    setIsEditing(true);

    api.get("/user")
      .then(res => {
        if (Array.isArray(res.data)) setUsersList(res.data);
      })
      .catch(() => {});
  }, [currentRecord, allChecklistQuestions, parseResponseAnswer, parsedMetadataValues, staffCount]);

  const isScoreChanged = useCallback((itemId) => {
    const orig = initialAnswersState[itemId];
    const curr = editAnswersState[itemId];
    if (!orig || !curr) return false;
    if (orig.isNa !== curr.isNa) return true;
    if (orig.isPassed !== curr.isPassed) return true;
    if (curr.type === "scale" && orig.scaleScore !== curr.scaleScore) return true;
    return false;
  }, [initialAnswersState, editAnswersState]);

  const isItemFailed = useCallback((itemId) => {
    const curr = editAnswersState[itemId];
    if (!curr || curr.isNa) return false;
    if (curr.type === "scale") {
      return curr.scaleScore !== null && curr.scaleScore !== undefined && curr.scaleScore < 3;
    }
    return curr.isPassed === false;
  }, [editAnswersState]);

  const changedQuestionsCount = useMemo(() => {
    if (!isEditing) return 0;
    return allChecklistQuestions.filter(q => q.surveyItemId && isScoreChanged(q.surveyItemId)).length;
  }, [isEditing, allChecklistQuestions, isScoreChanged]);

  const handleCancelEditMode = useCallback(() => {
    if (changedQuestionsCount > 0) {
      if (!window.confirm(`มีการปรับคะแนน ${changedQuestionsCount} ข้อที่ยังไม่ได้บันทึก คุณต้องการยกเลิกการแก้ไขใช่หรือไม่?`)) {
        return;
      }
    }
    setIsEditing(false);
    setEditAnswersState({});
    setInitialAnswersState({});
    setExpandedCommentItems({});
    setExpandedPhotoItems({});
    setEditStartedAt("");
    setEditSubmittedAt("");
  }, [changedQuestionsCount]);

  const liveScoreData = useMemo(() => {
    if (!isEditing || Object.keys(editAnswersState).length === 0) return null;
    return computeScore(allChecklistQuestions, editAnswersState, passingScore, { includeUnansweredInMaxScore: false });
  }, [isEditing, editAnswersState, allChecklistQuestions, passingScore]);

  const displayScore = isEditing && liveScoreData ? liveScoreData.percentage : score;
  const displayPassed = isEditing && liveScoreData ? liveScoreData.isPassed : passed;
  const displayHasCritical = isEditing && liveScoreData ? liveScoreData.hasCriticalDefect : hasCritical;

  const displayStartLat = isEditing ? (editStartLatitude !== "" ? editStartLatitude : null) : startLat;
  const displayStartLng = isEditing ? (editStartLongitude !== "" ? editStartLongitude : null) : startLng;
  const displayEndLat = isEditing ? (editEndLatitude !== "" ? editEndLatitude : null) : endLat;
  const displayEndLng = isEditing ? (editEndLongitude !== "" ? editEndLongitude : null) : endLng;

  const fetchCurrentCoordinates = useCallback((type) => {
    const isStart = type === "start";
    const isEnd = type === "end";
    if (isStart) setIsFetchingStartGps(true);
    if (isEnd) setIsFetchingEndGps(true);

    if (!navigator.geolocation) {
      alert("เบราว์เซอร์ไม่รองรับ Geolocation");
      if (isStart) setIsFetchingStartGps(false);
      if (isEnd) setIsFetchingEndGps(false);
      return;
    }

    const applyCoords = (coords) => {
      const lat = coords.latitude.toFixed(6);
      const lng = coords.longitude.toFixed(6);
      if (isStart) {
        setEditStartLatitude(lat);
        setEditStartLongitude(lng);
        setIsFetchingStartGps(false);
      }
      if (isEnd) {
        setEditEndLatitude(lat);
        setEditEndLongitude(lng);
        setIsFetchingEndGps(false);
      }
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => applyCoords(pos.coords),
      (err1) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => applyCoords(pos.coords),
          (err2) => {
            alert("ไม่สามารถดึงพิกัดตำแหน่งได้ กรุณาระบุพิกัดด้วยตนเอง");
            if (isStart) setIsFetchingStartGps(false);
            if (isEnd) setIsFetchingEndGps(false);
          },
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
        );
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  }, []);

  const handleToggleYesNo = useCallback((itemId, choice) => {
    if (choice === "no") {
      setExpandedCommentItems(prev => ({ ...prev, [itemId]: true }));
    }
    setEditAnswersState(prev => {
      const cur = prev[itemId] || { fullScore: 10, notes: "", editReason: "", imageUrls: [] };
      if (choice === "na") {
        return {
          ...prev,
          [itemId]: {
            ...cur,
            userAnswered: true,
            isNa: true,
            isPassed: true,
            scoreGiven: 0,
            rawAnswer: "na",
            answerValue: "na"
          }
        };
      }
      const isYes = choice === "yes";
      return {
        ...prev,
        [itemId]: {
          ...cur,
          userAnswered: true,
          isNa: false,
          isPassed: isYes,
          scoreGiven: isYes ? cur.fullScore : 0,
          rawAnswer: isYes ? "yes" : "no",
          answerValue: isYes ? "yes" : "no"
        }
      };
    });
  }, []);

  const handleToggleScale = useCallback((itemId, val) => {
    if (val !== "na" && Number(val) < 3) {
      setExpandedCommentItems(prev => ({ ...prev, [itemId]: true }));
    }
    setEditAnswersState(prev => {
      const cur = prev[itemId] || { fullScore: 10, notes: "", editReason: "", imageUrls: [] };
      if (val === "na") {
        return {
          ...prev,
          [itemId]: {
            ...cur,
            userAnswered: true,
            isNa: true,
            isPassed: true,
            scoreGiven: 0,
            scaleScore: null,
            rawAnswer: "na",
            answerValue: "na"
          }
        };
      }
      const num = Number(val);
      const score = Math.round((num / 5) * cur.fullScore * 100) / 100;
      return {
        ...prev,
        [itemId]: {
          ...cur,
          userAnswered: true,
          isNa: false,
          isPassed: num >= 3,
          scaleScore: num,
          scoreGiven: score,
          rawAnswer: String(num),
          answerValue: String(num)
        }
      };
    });
  }, []);

  const handleSetCustomValue = useCallback((itemId, val) => {
    setEditAnswersState(prev => {
      const cur = prev[itemId] || { fullScore: 0, notes: "", editReason: "", imageUrls: [] };
      const strVal = typeof val === "object" ? JSON.stringify(val) : String(val ?? "");
      return {
        ...prev,
        [itemId]: {
          ...cur,
          userAnswered: true,
          rawAnswer: strVal,
          answerValue: strVal,
          scoreGiven: 0,
          isPassed: true,
          isNa: false
        }
      };
    });
  }, []);

  const handleSetNote = useCallback((itemId, text) => {
    setEditAnswersState(prev => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || {}),
        notes: text
      }
    }));
  }, []);

  const handleSetEditReason = useCallback((itemId, text) => {
    setEditAnswersState(prev => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || {}),
        editReason: text
      }
    }));
  }, []);

  const handleDeletePhoto = useCallback((itemId, photoUrl) => {
    setEditAnswersState(prev => {
      const cur = prev[itemId] || {};
      return {
        ...prev,
        [itemId]: {
          ...cur,
          imageUrls: (cur.imageUrls || []).filter(u => u !== photoUrl)
        }
      };
    });
  }, []);

  const handlePhotoUpload = useCallback(async (itemId, files) => {
    if (!files || files.length === 0) return;
    const rawFileList = Array.from(files);
    const validFiles = [];
    for (const f of rawFileList) {
      const check = validateImageFile(f);
      if (check.valid) validFiles.push(f);
      else alert(check.message);
    }
    if (validFiles.length === 0) return;

    setIsUploadingPhoto(prev => ({ ...prev, [itemId]: true }));
    try {
      const compressedList = await Promise.all(validFiles.map(f => compressImageFile(f)));
      const uploadResults = await Promise.all(
        compressedList.map(async (base64) => {
          try {
            const res = await api.post('/audit/upload-image', { base64Data: base64 });
            return res.data?.url || null;
          } catch (e) {
            return null;
          }
        })
      );
      const validUrls = uploadResults.filter(Boolean);
      if (validUrls.length > 0) {
        setEditAnswersState(prev => {
          const cur = prev[itemId] || {};
          return {
            ...prev,
            [itemId]: {
              ...cur,
              imageUrls: [...(cur.imageUrls || []), ...validUrls]
            }
          };
        });
      }
    } catch (err) {
      alert("เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ");
    } finally {
      setIsUploadingPhoto(prev => ({ ...prev, [itemId]: false }));
    }
  }, []);

  const handleTriggerSave = useCallback(() => {
    // 1. ตรวจสอบข้อที่ไม่ผ่าน (ต้องระบุบันทึกความเห็นของผู้ตรวจ ในกรอบสีแดง)
    const missingFailNoteItems = allChecklistQuestions.filter(q => {
      if (!q.isScored) return false;
      if (!isItemFailed(q.surveyItemId)) return false;
      const note = editAnswersState[q.surveyItemId]?.notes?.trim();
      return !note;
    });

    if (missingFailNoteItems.length > 0) {
      setActiveTab("responses");
      setExpandedCommentItems(prev => {
        const next = { ...prev };
        missingFailNoteItems.forEach(q => { next[q.surveyItemId] = true; });
        return next;
      });
      alert(`กรุณาระบุบันทึกความเห็นของผู้ตรวจสำหรับข้อที่ไม่ผ่าน (${missingFailNoteItems.length} ข้อ) ก่อนบันทึก`);
      setTimeout(() => {
        const el = document.getElementById(`edit-note-input-${missingFailNoteItems[0].surveyItemId}`);
        if (el) {
          el.focus();
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 150);
      return;
    }

    // 2. ตรวจสอบข้อที่มีการปรับแก้คะแนน/ผลตรวจ (ต้องระบุเหตุผลการแก้ไข ในกรอบสีเขียว)
    const missingReasonItems = allChecklistQuestions.filter(q => {
      if (!q.isScored) return false;
      if (!isScoreChanged(q.surveyItemId)) return false;
      const itemReason = editAnswersState[q.surveyItemId]?.editReason?.trim();
      return !itemReason;
    });

    if (missingReasonItems.length > 0) {
      setActiveTab("responses");
      setExpandedCommentItems(prev => {
        const next = { ...prev };
        missingReasonItems.forEach(q => { next[q.surveyItemId] = true; });
        return next;
      });
      alert(`กรุณาระบุเหตุผลการแก้ไขสำหรับข้อที่มีการเปลี่ยนคะแนน (${missingReasonItems.length} ข้อ) ก่อนบันทึก`);
      setTimeout(() => {
        const el = document.getElementById(`edit-reason-input-${missingReasonItems[0].surveyItemId}`);
        if (el) {
          el.focus();
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 150);
      return;
    }

    setShowConfirmSaveModal(true);
  }, [allChecklistQuestions, isItemFailed, isScoreChanged, editAnswersState]);

  const handleConfirmSave = useCallback(async () => {
    if (!overallReason.trim()) {
      alert("กรุณาระบุเหตุผลภาพรวมในการแก้ไขผลตรวจ");
      return;
    }

    setIsSaving(true);
    try {
      const toStr = (v) => (v !== null && typeof v === "object") ? JSON.stringify(v) : String(v ?? "");

      // ส่งเฉพาะข้อที่ผู้ใช้แก้จริง (คำตอบ / หมายเหตุ / รูป) ข้อที่ไม่ได้แตะให้ server ใช้ค่าเดิมในฐานข้อมูล
      // เพื่อไม่ให้คำตอบเดิมถูกเขียนทับด้วยค่าที่ฝั่งหน้าจอ derive ขึ้นมาเอง
      const sameJson = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
      const isItemEdited = (q) => {
        const id = q.surveyItemId;
        const curr = editAnswersState[id];
        const orig = initialAnswersState[id];
        if (!curr) return false;
        if (!q.hasResponse) return Boolean(curr.userAnswered);
        if (!orig) return false;
        return (
          isScoreChanged(id) ||
          (curr.notes || "").trim() !== (orig.notes || "").trim() ||
          !sameJson(curr.imageUrls || [], orig.imageUrls || []) ||
          (!q.isScored && toStr(curr.rawAnswer ?? curr.answerValue) !== toStr(orig.rawAnswer ?? orig.answerValue))
        );
      };

      const payloadResponses = allChecklistQuestions
        .filter(isItemEdited)
        .map(q => {
          const s = editAnswersState[q.surveyItemId];
          let rawAns;
          if (!q.isScored) rawAns = toStr(s.rawAnswer ?? s.answerValue ?? s.value);
          else if (s.isNa) rawAns = "na";
          else if (s.type === "scale") rawAns = s.scaleScore !== null && s.scaleScore !== undefined ? String(s.scaleScore) : "";
          else rawAns = s.isPassed === true ? "yes" : (s.isPassed === false ? "no" : "");
          return {
            surveyItemId: Number(q.surveyItemId) || 0,
            rawAnswer: rawAns,
            answerValue: rawAns,
            notes: s.notes && s.notes.trim() ? s.notes.trim() : null,
            editReason: s.editReason && s.editReason.trim() ? s.editReason.trim() : null,
            imageUrls: s.imageUrls || []
          };
        });

      const finalStaffCount = Number(editMetadataValues.staff_count !== undefined ? editMetadataValues.staff_count : editStaffCount) || 0;
      const finalAuditType = (() => {
        const raw = String(editMetadataValues.audit_type || editAuditType || "announced").toLowerCase();
        if (raw.includes("spot") || raw.includes("unannounced") || raw.includes("นอกกำหนดการ") || raw.includes("สุ่มตรวจ")) return "spot";
        if (raw.includes("undercover") || raw.includes("ปลอมตัว") || raw.includes("ไม่เปิดเผยตัว")) return "undercover";
        return "announced";
      })();

      // เขียนคีย์ staff_count / audit_type ลง metadata เฉพาะเมื่อเดิมมีอยู่ หรือผู้ใช้แก้ค่าจริง (ไม่สร้างค่าที่ไม่เคยมี)
      const finalMetadata = { ...editMetadataValues };
      if (editMetadataValues.staff_count !== undefined || finalStaffCount !== Number(currentRecord.staffCount || 0)) {
        finalMetadata.staff_count = finalStaffCount;
      }
      if (editMetadataValues.audit_type !== undefined || String(editAuditType) !== String(currentRecord.auditType || "announced")) {
        finalMetadata.audit_type = finalAuditType === "spot" ? "นอกกำหนดการ" : finalAuditType === "undercover" ? "ปลอมตัว" : "ตามกำหนดการ";
      }

      if (Array.isArray(finalMetadata._fields)) {
        finalMetadata._fields = finalMetadata._fields.map(f => {
          let updatedVal = f.value;
          if (editMetadataValues[f.id] !== undefined) {
            updatedVal = editMetadataValues[f.id];
          } else if (f.id === "staff_count") {
            updatedVal = finalStaffCount;
          } else if (f.id === "audit_type") {
            updatedVal = finalMetadata.audit_type;
          } else if (f.id === "auditor" || f.type === "auditor") {
            updatedVal = editMetadataValues[f.id] || editMetadataValues.auditor || f.value;
          }
          return { ...f, value: updatedVal };
        });
      }

      if (editStartedAt && editSubmittedAt && new Date(editSubmittedAt) < new Date(editStartedAt)) {
        alert("เวลาสิ้นสุดการตรวจต้องไม่ก่อนเวลาเริ่มตรวจ");
        setIsSaving(false);
        return;
      }

      const payload = {
        version: currentRecord.versionNumber || null,
        // ล้างพิกัดเฉพาะเมื่อเดิมมีค่าและผู้ใช้ลบออกจริง
        clearStartGps: (currentRecord.startLatitude != null || currentRecord.startLongitude != null) && !editStartLatitude && !editStartLongitude,
        clearEndGps: (currentRecord.endLatitude != null || currentRecord.endLongitude != null) && !editEndLatitude && !editEndLongitude,
        reason: overallReason.trim(),
        auditeeUserId: currentRecord.auditeeUserId || null,
        auditeeNameText: editAuditeeNameText.trim(), // สตริงว่าง = ล้างค่า (server แปลงเป็น null)
        staffCount: finalStaffCount,
        auditType: finalAuditType,
        notes: editGeneralNotes ?? "", // สตริงว่าง = ล้างหมายเหตุ
        startedAt: editStartedAt && editStartedAt !== initialTimesRef.current.started
          ? new Date(editStartedAt).toISOString() : undefined,
        submittedAt: editSubmittedAt && editSubmittedAt !== initialTimesRef.current.submitted
          ? new Date(editSubmittedAt).toISOString() : undefined,
        auditorSignatureUrl: editAuditorSignature || null,
        auditeeSignatureUrl: editAuditeeSignature || null,
        startLatitude: editStartLatitude ? parseFloat(editStartLatitude) : null,
        startLongitude: editStartLongitude ? parseFloat(editStartLongitude) : null,
        endLatitude: editEndLatitude ? parseFloat(editEndLatitude) : null,
        endLongitude: editEndLongitude ? parseFloat(editEndLongitude) : null,
        metadataValuesJson: JSON.stringify(finalMetadata),
        responses: payloadResponses
      };

      const res = await api.put(`/audit/${currentRecord.id}`, payload);
      setShowConfirmSaveModal(false);
      setIsEditing(false);
      await handleSaveSuccess();
      alert("บันทึกการแก้ไขผลตรวจเรียบร้อยแล้ว");
    } catch (err) {
      if (err.response?.status === 409) {
        alert("ข้อมูลถูกแก้ไขโดยผู้อื่นไปแล้ว กรุณารีเฟรชหน้าจอเพื่อโหลดข้อมูลล่าสุด");
      } else {
        alert(err.response?.data?.message || "เกิดข้อผิดพลาดในการบันทึกการแก้ไข");
      }
    } finally {
      setIsSaving(false);
    }
  }, [
    overallReason,
    allChecklistQuestions,
    editAnswersState,
    parseResponseAnswer,
    initialAnswersState,
    isScoreChanged,
    editMetadataValues,
    editStaffCount,
    editAuditType,
    editStartedAt,
    editSubmittedAt,
    currentRecord,
    editAuditeeNameText,
    editGeneralNotes,
    editAuditorSignature,
    editAuditeeSignature,
    editStartLatitude,
    editStartLongitude,
    editEndLatitude,
    editEndLongitude,
    handleSaveSuccess
  ]);

  const effectiveCategoryOrder = useMemo(() => {
    const rawOrder = matchedForm?.categoryOrderJson || currentRecord?.surveyForm?.categoryOrderJson || currentRecord?.categoryOrderJson || matchedForm?.categories || currentRecord?.surveyForm?.categories;
    if (typeof rawOrder === "string") {
      try {
        const parsed = JSON.parse(rawOrder);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    } else if (Array.isArray(rawOrder) && rawOrder.length > 0) {
      return rawOrder;
    }
    return CORE_CATEGORY_ORDER;
  }, [matchedForm, currentRecord]);

  // 📊 Calculated Category Scores Breakdown (จัดกลุ่มตามหมวดหมู่คะแนน ไม่ใช่หมวดหมู่คำถาม)
  const categoryScores = useMemo(() => {
    const catMap = new Map();

    formBreakdown.forEach(sec => {
      (sec.questions || []).forEach(q => {
        if (q.isScored === false || Number(q.fullScore) === 0 || ["grid","number","select","radio","checkbox","text","date","time","auditor", "multians"].includes(q.type || q.questionType)) {
          return;
        }
        const catName = getQuestionCategory(q, sec);
        if (!catName || catName === "รายละเอียด" || catName === "INFO" || catName === "ข้อมูลทั่วไป") {
          return; // 🌟 ข้ามหมวดรายละเอียด ไม่นำมาคิดในคะแนนหมวดหมู่
        }
        if (!catMap.has(catName)) {
          catMap.set(catName, {
            title: catName,
            score: 0,
            max: 0,
            totalCount: 0,
            answeredCount: 0
          });
        }

        const catData = catMap.get(catName);
        catData.totalCount += 1;

        const editAns = isEditing && q.surveyItemId ? editAnswersState[q.surveyItemId] : null;
        const qIsNa = editAns ? editAns.isNa : q.isNa;

        if (qIsNa) {
          return; // Fair scoring: N/A questions excluded from max
        }

        const full = Number(q.fullScore ?? q.maxScore ?? 0);
        catData.max += full;

        if (editAns) {
          catData.score += Number(editAns.scoreGiven) || 0;
        } else if (q.scoreGiven !== undefined) {
          catData.score += Number(q.scoreGiven) || 0;
        } else if (q.type === "scale") {
          const rating = Number(q.answer) || 5;
          catData.score += rating <= 5 ? (rating / 5) * full : rating;
        } else if (q.answer === true) {
          catData.score += full;
        }
      });
    });

    const categories = Array.from(catMap.values()).map(cat => {
      const roundedScore = Math.round(cat.score * 10) / 10;
      const percent = cat.max > 0 ? (cat.score / cat.max) * 100 : 100;
      return {
        title: cat.title,
        score: roundedScore,
        max: cat.max,
        percent
      };
    });

    const getOrderIdx = (title) => {
      if (!title || !Array.isArray(effectiveCategoryOrder)) return -1;
      const target = String(title).toLowerCase().trim();
      return effectiveCategoryOrder.findIndex(item => {
        const val = typeof item === "object" && item !== null ? (item.key || item.name || item.label || "") : String(item);
        return val.toLowerCase().trim() === target;
      });
    };

    // Sort according to effective category order
    categories.sort((a, b) => {
      const idxA = getOrderIdx(a.title);
      const idxB = getOrderIdx(b.title);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.title.localeCompare(b.title, "th");
    });

    return categories;
  }, [formBreakdown, isEditing, editAnswersState, effectiveCategoryOrder]);

  // 📤 ส่งออกรายงานรายรอบตรวจเป็น Excel (ใช้ข้อมูลชุดเดียวกับที่แสดงบนหน้าจอ: formBreakdown / allDisplayMetadataFields)
  const [isExportingReport, setIsExportingReport] = useState(false);
  const handleExportReport = async () => {
    if (isExportingReport) return;
    setIsExportingReport(true);
    api.post('/activity/export', { action: 'EXPORT_AUDIT_EXCEL' }).catch(() => {});
    try {
      const recId = currentRecord?.id || record?.id;
      const typeName = matchedLocation?.locationType?.name || currentRecord.location?.locationType?.name || "-";
      const officialReportNo = currentRecord?.documentNo || record?.documentNo || "-";

      await exportAuditReportToExcel({
        record: currentRecord,
        sections: formBreakdown,
        metaFields: allDisplayMetadataFields,
        passingScore,
        categoryOf: getQuestionCategory,
        categoryOrder: effectiveCategoryOrder,
        toFullUrl: getFullImageUrl,
        signatureUrls: {
          auditor: currentRecord.auditorSignatureUrl || currentRecord.auditorSignature,
          auditee: currentRecord.auditeeSignatureUrl || currentRecord.auditeeSignature
        },
        header: {
          reportNo: officialReportNo,
          issuedAt: formatBkk(new Date(), false).slice(0, 10),
          locationCode: currentRecord.locationCode || matchedLocation?.code || "",
          location: `${currentRecord.locationCode || matchedLocation?.code || ""} ${locationTitle}`.trim(),
          brandType: `${currentRecord.locationBrand || "-"} / ${typeName}`,
          form: formTitle,
          version: currentRecord.surveyFormVersion || selectedForm?.version || "v1.0",
          startedAt: formatBkk(currentRecord.startedAt || currentRecord.auditDate),
          endedAt: formatBkk(currentRecord.submittedAt),
          auditor: auditorName,
          auditee: /ผู้จัดการ/.test(managerName) ? managerName : `${managerName} (ผู้จัดการสาขา)`,
          signedAt: formatBkk(currentRecord.signedAt || currentRecord.submittedAt, false)
        }
      });
    } catch (err) {
      console.error("Export audit report failed", err);
      alert("ส่งออกรายงานไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsExportingReport(false);
    }
  };

  const sections = categoryScores;

  // Issues List
  const issues = useMemo(() => {
    const list = [];
    formBreakdown.forEach(sec => {
      sec.questions.forEach(q => {
        if (q.isScored === false || ["grid","number","select","radio","checkbox","text","date","time","auditor", "multians"].includes(q.type || q.questionType)) return;
        if (q.isNa) return;

        const full = Number(q.fullScore ?? q.maxScore ?? 0);
        const currentSc = q.scoreGiven !== undefined ? Number(q.scoreGiven) : (typeof q.answer === 'number' ? q.answer : 0);
        const isPass = q.isPassed !== undefined
          ? q.isPassed
          : (q.type === "yesno" 
              ? q.answer === true 
              : q.type === "scale" 
                ? (q.scaleScore ? q.scaleScore >= 3 : (currentSc >= (full * 0.6))) 
                : true);

        if (!isPass) {
          list.push({
            num: q.num,
            title: q.text,
            note: q.note,
            critical: q.isCritical || false
          });
        }
      });
    });
    return list;
  }, [formBreakdown]);

  // Extracted Inspection Photos from all responses
  const allInspectionPhotos = useMemo(() => {
    const list = [];
    formBreakdown.forEach(sec => {
      sec.questions.forEach(q => {
        if (q.images && q.images.length > 0) {
          const full = Number(q.fullScore ?? q.maxScore ?? 0);
          const currentSc = q.scoreGiven !== undefined ? Number(q.scoreGiven) : (typeof q.answer === 'number' ? q.answer : 0);
          const isPass = q.isNa 
            ? true 
            : (q.isPassed !== undefined 
                ? q.isPassed 
                : (q.type === "yesno" 
                    ? q.answer === true 
                    : (q.scaleScore ? q.scaleScore >= 3 : (currentSc >= (full * 0.6)))));

          q.images.forEach((img, iIdx) => {
            const url = img.imageUrl || img.url || img;
            if (url) {
              list.push({
                id: img.id || `${q.id}_img_${iIdx}`,
                url: url,
                qNum: q.num,
                qText: q.text,
                secTitle: sec.title,
                isPass: isPass,
                note: q.note,
                uploadedAt: img.uploadedAt ? formatTimeWithSeconds(img.uploadedAt, dateStr) : dateStr
              });
            }
          });
        }
      });
    });
    return list;
  }, [formBreakdown, dateStr]);

  // Extracted CAP After-Photos from all real CAP tasks
  const allCapAfterPhotos = useMemo(() => {
    const list = [];
    (recordCaps || []).forEach((cap) => {
      if (Array.isArray(cap.afterImages)) {
        cap.afterImages.forEach((img) => {
          list.push({
            id: img.id,
            imageUrl: img.imageUrl,
            uploadedAt: img.uploadedAt,
            capId: cap.id,
            issueItem: cap.issueItem,
            status: cap.status,
            qNum: cap.questionNumber
          });
        });
      }
    });
    if (list.length === 0 && capSubmissions && Object.keys(capSubmissions).length > 0) {
      Object.values(capSubmissions).forEach((cap, i) => {
        list.push({
          id: `sub_${i}`,
          imageUrl: cap.imageUrl,
          uploadedAt: cap.submittedAt,
          capId: cap.qId || i,
          issueItem: cap.actionText || cap.qText || "หลักฐานการแก้ไข",
          status: "SUBMITTED",
          qNum: cap.qNum || i + 1
        });
      });
    }
    return list;
  }, [recordCaps, capSubmissions]);

  // Header action buttons (แสดงปุ่มแก้ไขผลตรวจและย้อนสถานะเมื่อมีสิทธิ์ - Desktop: Pills, Mobile: Dropdown Menu)
  const headerAction = useMemo(() => (
    <AuditHeaderActionMenu
      canEditAudit={canEditAudit}
      canReopenAudit={canReopenAudit}
      isEditing={isEditing}
      isSaving={isSaving}
      onEnterEditMode={handleEnterEditMode}
      onCancelEditMode={handleCancelEditMode}
      onTriggerSave={handleTriggerSave}
      onReopen={() => {
        setReopenReason("");
        setReopenError("");
        setShowReopenModal(true);
      }}
    />
  ), [canEditAudit, canReopenAudit, isEditing, isSaving, handleEnterEditMode, handleCancelEditMode, handleTriggerSave]);

  // 🌟 ติดตามการ Scroll เพื่อแสดงปุ่มเลื่อนขึ้นบนสุด และติดตามหมวดหมู่คำถาม (เฉพาะแท็บผลตรวจ)
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY || document.documentElement.scrollTop || (document.querySelector('main')?.scrollTop || 0);
      setIsScrolled(scrollY > 120);

      if (activeTab === "responses" && formBreakdown.length > 0 && scrollY > 60) {
        let current = null;
        for (let i = 0; i < formBreakdown.length; i++) {
          const sectionEl = document.getElementById(`history-section-${i}`);
          const headerEl = document.getElementById(`history-section-header-${i}`);
          
          if (sectionEl) {
            const rect = sectionEl.getBoundingClientRect();
            // เมื่อขอบบนของหมวดเลื่อนขึ้นมาถึง/ใกล้ขอบบน (top <= 100px) และขอบล่างยังไม่พ้นจอ (bottom > 50px)
            if (rect.top <= 100 && rect.bottom > 50) {
              current = i;
              break;
            }
          } else if (headerEl) {
            const rect = headerEl.getBoundingClientRect();
            if (rect.top <= 100 && rect.bottom > 0) {
              current = i;
              break;
            }
          }
        }
        setActiveSectionIndex(current);
      } else {
        setActiveSectionIndex(null);
      }
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    document.addEventListener("scroll", handleScroll, { passive: true });
    const mainEl = document.querySelector('main');
    if (mainEl) mainEl.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("scroll", handleScroll);
      if (mainEl) mainEl.removeEventListener("scroll", handleScroll);
    };
  }, [activeTab, formBreakdown]);

  // 🌟 ป้องกัน Background Scroll ขณะ Drawer เปิด
  useEffect(() => {
    if (!isCategoryDrawerOpen) return;
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setIsCategoryDrawerOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalStyle;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isCategoryDrawerOpen]);

  // 🌟 รายการหมวดหมู่สำหรับ Quick Navigation Drawer
  const categoryItems = useMemo(() => {
    return formBreakdown.map((sec, index) => {
      const { totalQ, passedQ, secPassed, isInfo, allCount } = getSectionStats(sec);
      return {
        id: `history-section-${index}`,
        index,
        label: sec.title || `หมวดที่ ${index + 1}`,
        count: isInfo ? `${allCount} รายการ (ข้อมูลทั่วไป)` : `ผ่าน (${passedQ}/${totalQ})`,
        isPassed: isInfo ? true : secPassed
      };
    });
  }, [formBreakdown]);

  const jumpToCategory = (item) => {
    setIsCategoryDrawerOpen(false);
    setActiveSectionIndex(item.index);
    setTimeout(() => {
      const el = document.getElementById(`history-section-${item.index}`);
      if (el) {
        const topOffset = 70;
        const elPosition = el.getBoundingClientRect().top;
        const currentScroll = window.scrollY || document.documentElement.scrollTop || document.querySelector('main')?.scrollTop || 0;
        const targetTop = elPosition + currentScroll - topOffset;
        window.scrollTo({ top: targetTop, behavior: "smooth" });
        document.querySelector('main')?.scrollTo({ top: targetTop, behavior: "smooth" });
      }
    }, 120);
  };

  // 🌟 ข้อมูล Header ปรับเปลี่ยนแบบ Dynamic เมื่อเลื่อนดูหมวดหมู่คำถาม (เฉพาะแท็บผลตรวจ)
  const activeSection = (activeTab === "responses" && activeSectionIndex !== null)
    ? formBreakdown[activeSectionIndex]
    : null;

  const activeSectionStats = useMemo(() => {
    if (!activeSection) return null;
    return getSectionStats(activeSection);
  }, [activeSection]);

  const currentHeaderTitle = activeSection
    ? (activeSection.title || `หมวดที่ ${activeSectionIndex + 1}`)
    : "ผลการตรวจ";

  const currentHeaderSubtitle = activeSection
    ? `ผ่าน (${activeSectionStats?.passedQ || 0}/${activeSectionStats?.totalQ || 0})`
    : (locationTitle && locationTitle !== "-" ? `${locationTitle}` : "รายละเอียดผลการตรวจ");

  const currentHeaderBadge = activeSection ? activeSectionIndex + 1 : null;
  const currentLeftActionType = (activeTab === "responses" && activeSectionIndex !== null) ? "menu" : "back";

  // 🌟 Full-Screen CapDetailScreen Integration
  if (selectedCapTask) {
    return (
      <CapDetailScreen
        item={selectedCapTask}
        role={currentUser?.role || currentUser?.roleCode || "STANDARD"}
        currentUser={currentUser}
        refreshData={() => {
          if (refreshData) refreshData();
          loadCapTasksForRecord();
        }}
        onBack={() => {
          setSelectedCapTask(null);
          loadCapTasksForRecord();
        }}
      />
    );
  }

  return (
    <div className={`page-transition p-4 sm:p-6 space-y-4 w-full max-w-[100%] sm:max-w-[96%] md:max-w-[92%] mx-auto ${isEditing ? "pb-28 sm:pb-32" : "pb-12"}`}>
      <Header 
        title={currentHeaderTitle}
        subtitle={currentHeaderSubtitle}
        sectionBadgeNumber={currentHeaderBadge}
        leftActionType={currentLeftActionType}
        onMenuClick={() => setIsCategoryDrawerOpen(true)}
        onBack={onBack}
        action={headerAction}
      />
      
      {/* 🌟 REOPENED / CANCELLED NOTICE BANNER */}
      {isReopened && (
        <div className="p-4 sm:p-5 rounded-3xl bg-amber-50/90 border border-amber-300 text-amber-950 shadow-xs space-y-2.5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-2xl bg-amber-200/80 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-sm sm:text-base text-amber-950">รอบตรวจนี้ถูกย้อนสถานะเป็นแบบร่าง</span>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-900 text-xs font-bold border border-amber-300">
                  ยกเลิกผลการตรวจ
                </span>
              </div>
              {currentRecord?.reopenReason && (
                <p className="text-xs sm:text-sm text-amber-900 mt-1.5 bg-white/70 p-2.5 rounded-xl border border-amber-200/70">
                  <span className="font-bold text-amber-950">เหตุผลในการย้อนสถานะ:</span> {currentRecord.reopenReason}
                </p>
              )}
              <div className="mt-2 text-xs text-amber-800 space-y-1">
                <p className="text-[11px] text-amber-700 font-medium">
                  * ผลตรวจนี้ไม่ถูกนำไปคำนวณคะแนนหรือแสดงในรายงานสถิติของระบบ และไม่สามารถแก้ไขหรือลบได้
                </p>
              </div>
              {(currentRecord?.reopenedDraftId || record?.reopenedDraftId) && onResumeDraft && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      onResumeDraft({
                        id: currentRecord?.reopenedDraftId || record?.reopenedDraftId,
                        documentNo: currentRecord?.reopenedDraftDocumentNo || record?.reopenedDraftDocumentNo,
                        isResume: true
                      });
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0F6659] hover:bg-[#0c5247] text-white text-xs font-bold shadow-xs cursor-pointer transition-all active:scale-95"
                  >
                    <span>ไปที่หน้าตรวจเพื่อแก้ไขต่อ</span>
                    {(currentRecord?.reopenedDraftDocumentNo || record?.reopenedDraftDocumentNo) && (
                      <span className="font-mono text-[11px] opacity-90">({currentRecord?.reopenedDraftDocumentNo || record?.reopenedDraftDocumentNo})</span>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {currentRecord?.reopenedFromRecordId && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 shadow-2xs flex items-center gap-2.5">
          <RotateCcw className="w-4 h-4 text-[#0F6659] shrink-0" />
          <p className="text-xs sm:text-sm text-emerald-900 font-medium">
            ผลการตรวจนี้ส่งจากการย้อนสถานะแบบร่าง (รหัสรอบตรวจเดิม <span className="font-bold font-mono">{reopenedFromDocNo || currentRecord.reopenedFromDocumentNo || `#${currentRecord.reopenedFromRecordId}`}</span>)
          </p>
        </div>
      )}

      {/* 🌟 1. ALL-IN-ONE SLEEK HERO SUMMARY CARD (ตรงตามแบบ Mockup) */}
      <div className="rounded-3xl p-5 sm:p-6 bg-white border border-slate-200/90 shadow-2xs space-y-4">
        {/* Top Section: Score Ring, Numbers, Status Pill, and Export Excel Button */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4 sm:gap-5 min-w-0">
            {/* Circular Gauge Ring with 12 o'clock notch & Passing Threshold Underneath */}
            <div className="flex flex-col items-center shrink-0">
              <div className={`relative flex items-center justify-center w-[80px] h-[80px] sm:w-[88px] sm:h-[88px] rounded-full border-[5.5px] shadow-2xs shrink-0 bg-white font-mono font-black text-[20px] sm:text-[24px]  text-slate-900 select-none ${
                displayPassed
                  ? 'border-[#0F6659]'
                  : displayHasCritical
                  ? 'border-rose-600'
                  : 'border-amber-500'
              }`}>
                {parseFloat(Number(displayScore).toFixed(2))}%
                <div className="absolute -top-[5.5px] left-1/2 -translate-x-1/2 w-2 h-2 bg-white rounded-full" />
              </div>
              <div className="text-[11px] sm:text-xs font-semibold text-slate-400 mt-1.5 text-center whitespace-nowrap">
                เกณฑ์ผ่าน ≥ {passingScore}%
              </div>
            </div>

            {/* Score Text & Status Pill */}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs sm:text-sm font-extrabold text-slate-800 mb-1 leading-snug">
                <MapPin size={14} className="text-[#0F6659] shrink-0" />
                <span className="truncate" title={fullLocationName}>{fullLocationName}</span>
              </div>
              {/* รหัสรอบตรวจ/เอกสาร แสดงเป็นตัวอักษรสีเทาแบบไม่มีกรอบ */}
              <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                {(currentRecord?.documentNo || record?.documentNo) && (
                  <span className="font-mono text-xs font-semibold text-slate-400">
                    {currentRecord?.documentNo || record?.documentNo}
                  </span>
                )}
                {isBackdated && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                    ⏳ บันทึกย้อนหลัง
                  </span>
                )}
              </div>

              <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                {isReopened ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-slate-700 text-white shadow-2xs">
                    <RotateCcw size={13} className="text-white shrink-0" />
                    <span>ย้อนเป็นแบบร่าง (REOPENED)</span>
                  </span>
                ) : (
                  <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full shadow-2xs ${
                    displayPassed
                      ? 'bg-[#0F6659] text-white'
                      : displayHasCritical
                      ? 'bg-rose-600 text-white'
                      : 'bg-amber-500 text-white'
                  }`}>
                    {displayPassed ? (
                      <CheckCircle2 size={13} className="text-white shrink-0" />
                    ) : displayHasCritical ? (
                      <XCircle size={13} className="text-white shrink-0" />
                    ) : (
                      <AlertTriangle size={13} className="text-white shrink-0" />
                    )}
                    <span>{displayPassed ? "ผ่านเกณฑ์มาตรฐาน" : displayHasCritical ? "ตกข้อสำคัญ" : "ต้องส่งงานแก้ไข"}</span>
                  </span>
                )}

              </div>
            </div>
          </div>

          {/* Right: Export Excel Button (ย้ายมาไว้ตรงมุมขวาบนของการ์ดตามที่ผู้ใช้กำหนด) */}
          <div className="shrink-0 ml-auto self-start">
            <button
              type="button"
              onClick={handleExportReport}
              disabled={isExportingReport}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#0F6659] hover:bg-[#0D5449] disabled:opacity-60 disabled:cursor-wait text-white flex items-center justify-center shadow-2xs hover:shadow-sm transition-all active:scale-95 cursor-pointer"
              title={isExportingReport ? "กำลังสร้างรายงาน…" : "ส่งออกรายงาน Excel"}
            >
              <FileSpreadsheet size={18} />
            </button>
          </div>
        </div>

        {/* Second Section: Defect Banner (Full Width) */}
        {issues.length > 0 ? (
          <div className="rounded-2xl p-3 sm:p-3.5 bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-between gap-2.5 shadow-2xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <AlertTriangle size={18} className="text-rose-600 shrink-0" />
              <span className="text-sm font-extrabold">พบข้อบกพร่อง {issues.length} ข้อ</span>
            </div>
            <button
              type="button"
              onClick={() => setShowAiDefectModal(true)}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0F6659] text-white text-xs font-bold shadow-2xs hover:bg-[#0D5449] active:scale-95 transition-all cursor-pointer"
            >
              <Sparkles size={13} />
              <span>AI วิเคราะห์</span>
            </button>
          </div>
        ) : (
          <div className="rounded-2xl p-3 sm:p-3.5 bg-[#F0FDF4] border border-emerald-200/80 text-[#0F6659] flex items-center gap-2.5 shadow-2xs">
            <CheckCircle2 size={18} className="text-[#0F6659] shrink-0" />
            <span className="text-xs sm:text-base font-extrabold">ไม่พบข้อบกพร่อง</span>
          </div>
        )}

        {/* Third Section: Metadata Cards (เดิมเป็นแถวเดียวกันแบบ divide-y + label กว้างคงที่ 64px
            ทำให้ค่าที่ยาว เช่น ชื่อฟอร์ม/ชื่อผู้ตรวจ ถูก truncate เป็น "..." บนจอมือถือแคบๆ
            เปลี่ยนเป็นการ์ดแยกทีละอัน ใช้ break-words แทน truncate จะได้ขึ้นบรรทัดใหม่แทนการตัดข้อความ) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 mt-3.5 sm:mt-4">
          {/* Card: แบบฟอร์ม */}
          <div className="rounded-2xl bg-[#F8FAF9] border border-slate-100/90 p-3 sm:p-3.5 flex items-start gap-2.5 shadow-2xs">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#0F6659] flex items-center justify-center shrink-0 shadow-2xs">
              <FileText size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] text-slate-400 font-semibold">แบบฟอร์ม</div>
              <div className="text-xs sm:text-sm font-extrabold text-slate-800 leading-snug break-words" title={formTitle}>
                {formTitle}
              </div>
            </div>
          </div>

          {/* Card: วันที่ตรวจ */}
          <div className="rounded-2xl bg-[#F8FAF9] border border-slate-100/90 p-3 sm:p-3.5 flex items-start gap-2.5 shadow-2xs">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#0F6659] flex items-center justify-center shrink-0 shadow-2xs">
              <Calendar size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] text-slate-400 font-semibold">วันที่ลงตรวจ</div>
              <div className="text-xs sm:text-sm font-extrabold text-slate-800 leading-snug break-words">
                {isBackdated ? `${actualInspectDateStr} (${startedTimeStr} - ${submittedTimeStr})` : dateStr}
              </div>
              {createdDateStr && (
                <div className="text-[10px] text-slate-400 font-medium mt-0.5" title="วันเวลาที่บันทึกข้อมูลเข้าระบบจริง">
                  บันทึกเข้าระบบ: {createdDateStr} น.
                </div>
              )}
            </div>
          </div>

          {/* Card: ผู้ตรวจ */}
          <div className="rounded-2xl bg-[#F8FAF9] border border-slate-100/90 p-3 sm:p-3.5 flex items-start gap-2.5 shadow-2xs">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#0F6659] flex items-center justify-center shrink-0 shadow-2xs">
              <User size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] text-slate-400 font-semibold">ผู้ตรวจ</div>
              <div className="text-xs sm:text-sm font-extrabold text-slate-800 leading-snug break-words" title={auditorName}>
                {auditorName}
              </div>
            </div>
          </div>
        </div>

        {/* Fourth Section: Edit History Callout (ปุ่มการ์ดตาม Mockup) */}
        <button
          type="button"
          onClick={() => setShowEditLogsModal(true)}
          className="w-full p-3 sm:p-3.5 rounded-2xl bg-[#FFFBEB] hover:bg-[#FEF3C7] border border-[#FDE68A] flex items-center justify-between gap-3 text-left transition-all active:scale-[0.99] cursor-pointer shadow-2xs group"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-[#FEF3C7] text-[#D97706] flex items-center justify-center shrink-0 border border-[#FDE68A]/60 shadow-2xs">
              <History size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-extrabold text-slate-800">ประวัติการตรวจ</span>
                <span className="px-2 py-0.5 rounded-md bg-[#FDE68A] text-[#92400E] text-[11px] font-black">
                  {editLogsCount}
                </span>
                {isReopened && (
                  <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[10px] font-black border border-rose-200">
                    ย้อนสถานะ
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                {lastUpdatedTimestamp ? (
                  <>แก้ไขล่าสุด {formatBkk(lastUpdatedTimestamp, true)}</>
                ) : (
                  <>เริ่มต้นตรวจ {formatBkk(currentRecord?.startedAt || currentRecord?.auditDate, true)}</>
                )}
              </div>
            </div>
          </div>
          <ChevronRight size={18} className="text-[#D97706] shrink-0 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* 🌟 5-TAB SEGMENTED SELECTOR (ตรงตาม Mockup) */}
      <div className="grid grid-cols-5 bg-white rounded-2xl p-1.5 border border-slate-200/80 shadow-2xs gap-1 relative">
        {[
          { key: "overview", label: "คะแนน", icon: BarChart3, editable: true },
          { key: "responses", label: "ผลตรวจ", icon: ClipboardCheck, editable: true },
          { key: "photos", label: "รูปภาพ", icon: Camera, editable: false },
          { key: "sign", label: "สรุป&ลงชื่อ", icon: PenTool, editable: true },
          { key: "location", label: "ตำแหน่ง", icon: MapPin, editable: true },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <div key={tab.key} className="relative">
              {/* 🎈 Animated Speech Bubble Badge with Pencil Icon (เมื่ออยู่ในโหมดแก้ไข) */}
              {isEditing && tab.editable && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none animate-bounce">
                  <div className="relative bg-white text-[#0F6659] border border-emerald-500 px-1.5 py-0.5 rounded-full shadow-xs flex items-center justify-center">
                    <Edit3 size={10} className="text-[#0F6659] stroke-[2.5]" />
                    {/* Speech bubble tail pointing down */}
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white border-r border-b border-emerald-500 rotate-45" />
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`w-full flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all cursor-pointer select-none active:scale-95 ${
                  isActive
                    ? "bg-[#0F6659] text-white shadow-xs font-bold"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-50 font-medium"
                }`}
              >
                <Icon size={18} className={isActive ? "text-white" : "text-slate-400"} />
                <span className="text-[11px] sm:text-xs mt-1 leading-none tracking-tight">
                  {tab.label}
                </span>
              </button>
            </div>
          );
        })}
      </div>

      {/* TAB 1: DETAILED FORM RESPONSES */}
      {activeTab === "responses" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {formBreakdown.length === 0 ? (
            <div className="p-8 sm:p-12 rounded-3xl bg-white border border-dashed border-slate-200 text-center space-y-2.5">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center mx-auto">
                <ClipboardCheck size={26} />
              </div>
              <div className="text-sm font-bold text-slate-700">ไม่พบข้อมูลคำตอบการตรวจ</div>
              <div className="text-xs text-slate-400 max-w-sm mx-auto">รอบการตรวจนี้ยังไม่มีรายละเอียดคำตอบรายข้อที่บันทึกในฐานข้อมูล</div>
            </div>
          ) : (
            formBreakdown.map((sec, secIdx) => {
            const { totalQ, passedQ, secPassed, isInfo, allCount } = getSectionStats(sec);

            return (
              <div 
                key={secIdx} 
                id={`history-section-${secIdx}`}
                className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-2xs"
              >
                {/* CATEGORY HEADER */}
                <div 
                  id={`history-section-header-${secIdx}`}
                  onClick={() => {
                    setActiveSectionIndex(secIdx);
                    setIsCategoryDrawerOpen(true);
                  }}
                  className="px-4 sm:px-5 py-3 bg-[#F4F9F6] hover:bg-emerald-50/70 border-b border-emerald-100 flex items-center justify-between gap-3 cursor-pointer group transition-colors select-none"
                  title="แตะเพื่อเลือกหมวดการตรวจ"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="w-7 h-7 rounded-full bg-emerald-100 text-[#0F6659] font-black text-xs flex items-center justify-center shrink-0 group-hover:bg-[#0F6659] group-hover:text-white transition-colors shadow-2xs">
                      {secIdx + 1}
                    </span>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate group-hover:text-[#0F6659] transition-colors">
                      {sec.title}
                    </h3>
                  </div>

                  {/* Section Status Badge */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isInfo ? (
                      <span className="text-xs font-bold px-3 py-1 rounded-full border bg-slate-50 text-slate-700 border-slate-200">
                        {allCount} รายการ (ข้อมูลทั่วไป)
                      </span>
                    ) : (
                      <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                        secPassed 
                          ? "bg-emerald-50 text-[#0F6659] border-emerald-200" 
                          : "bg-amber-50 text-amber-900 border-amber-200"
                      }`}>
                        ผ่าน ({passedQ}/{totalQ})
                      </span>
                    )}
                  </div>
                </div>

                {/* QUESTIONS CONTAINER */}
                <div className="p-3.5 sm:p-5 space-y-3">
                  {sec.questions.map((q) => {
                    const editAns = isEditing && q.surveyItemId ? editAnswersState[q.surveyItemId] : null;
                    const isNonScored = q.isScored === false || ["grid","number","select","radio","checkbox","text","date","time","auditor", "multians"].includes(q.type || q.questionType);
                    const full = Number(q.fullScore ?? q.maxScore ?? 0);
                    const isAnswered = isNonScored
                      ? true
                      : editAns
                      ? Boolean(editAns.userAnswered || editAns.hasResponse)
                      : Boolean(q.hasResponse || q.auditResponseId);

                    const currentSc = editAns 
                      ? Number(editAns.scoreGiven) || 0 
                      : (q.scoreGiven !== undefined ? Number(q.scoreGiven) : (typeof q.answer === 'number' ? q.answer : (q.answer === true ? full : 0)));

                    const isNa = editAns ? Boolean(editAns.isNa) : Boolean(q.isNa);

                    const isPass = isNonScored
                      ? true
                      : (isNa
                          ? true
                          : editAns
                          ? (editAns.type === "scale" ? (editAns.scaleScore !== null ? editAns.scaleScore >= 3 : true) : Boolean(editAns.isPassed))
                          : (q.isPassed !== undefined && q.isPassed !== null
                              ? q.isPassed
                              : q.type === "yesno" 
                              ? q.answer === true 
                              : q.type === "scale" 
                                ? (q.scaleScore ? q.scaleScore >= 3 : (currentSc >= (full * 0.6))) 
                                : true));

                    const isFail = isAnswered && !isNa && !isNonScored && !isPass;

                    return (
                      <div 
                        key={q.id} 
                        className={`p-4 rounded-2xl border transition-all space-y-3 ${
                          isFail
                            ? 'border-red-200 bg-red-50/15 shadow-2xs hover:border-red-300'
                            : 'border-slate-200 bg-white shadow-2xs hover:border-slate-300'
                        }`}
                      >
                        {/* Question Header & Score Badge at Top Right */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5 flex-1 min-w-0">
                            <span className={`w-6 h-6 rounded-full font-extrabold text-xs flex items-center justify-center shrink-0 mt-0.5 ${
                              isFail ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {q.num}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className={`text-sm sm:text-base font-bold leading-snug break-words [overflow-wrap:anywhere] ${
                                isFail ? 'text-red-700' : 'text-slate-900'
                              }`}>
                                {q.text}
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                <span className="inline-block text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                                  {isNonScored ? "ข้อมูลทั่วไป" : getCategoryDisplay(getQuestionCategory(q, sec))}
                                </span>
                                {!isNonScored && q.isCritical && (
                                  <span className="inline-block text-[10.5px] font-extrabold px-2 py-0.5 rounded-md bg-red-100 text-red-700 border border-red-200">
                                    ⚠️ สำคัญ
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* 🌟 มุมขวาบนของข้อ: ปุ่มคอมเมนต์ & รูปภาพ (เมื่ออยู่ในโหมดแก้ไข) + แสดงคะแนน */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {isEditing && q.surveyItemId && (
                              <div className="flex items-center gap-1 mr-1">
                                {/* Toggle Comment Button */}
                                <button
                                  type="button"
                                  onClick={() => setExpandedCommentItems(prev => ({ ...prev, [q.surveyItemId]: !prev[q.surveyItemId] }))}
                                  className={`p-1.5 rounded-xl border transition-all cursor-pointer active:scale-95 ${
                                    expandedCommentItems[q.surveyItemId] || editAns?.notes || editAns?.editReason
                                      ? 'bg-emerald-50 text-[#0F6659] border-emerald-300 shadow-2xs'
                                      : 'bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-50 border-slate-200 shadow-2xs'
                                  }`}
                                  title="ความเห็น / เหตุผลการแก้ไข"
                                >
                                  <MessageSquare size={14} />
                                </button>
                                {/* Toggle Photo Button */}
                                <button
                                  type="button"
                                  onClick={() => setExpandedPhotoItems(prev => ({ ...prev, [q.surveyItemId]: !prev[q.surveyItemId] }))}
                                  className={`p-1.5 rounded-xl border transition-all cursor-pointer active:scale-95 ${
                                    expandedPhotoItems[q.surveyItemId] || (editAns?.imageUrls && editAns.imageUrls.length > 0)
                                      ? 'bg-emerald-50 text-[#0F6659] border-emerald-300 shadow-2xs'
                                      : 'bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-50 border-slate-200 shadow-2xs'
                                  }`}
                                  title="จัดการรูปภาพหลักฐาน"
                                >
                                  <Camera size={14} />
                                </button>
                              </div>
                            )}

                            {isNonScored ? (
                              <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-bold px-2.5 py-1 rounded-full border bg-slate-100 text-slate-600 border-slate-200">
                                ข้อมูลไม่คิดคะแนน
                              </span>
                            ) : !isAnswered ? (
                              <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-bold px-2.5 py-1 rounded-full border bg-slate-100 text-slate-500 border-slate-200">
                                ยังไม่ประเมิน
                              </span>
                            ) : (
                              <span className={`inline-flex items-center gap-1 text-xs sm:text-sm font-bold px-3 py-1 rounded-full border shadow-2xs ${
                                isNa
                                  ? "bg-slate-100 text-slate-500 border-slate-200"
                                  : isPass
                                  ? "bg-emerald-50 text-[#0F6659] border-emerald-200"
                                  : "bg-rose-50 text-rose-700 border-rose-200"
                              } font-mono`}>
                                <span>{isNa ? 0 : currentSc} / {full}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 🌟 แสดงรูปแบบคำตอบ: โหมดแก้ไขกดเลือกได้ทันที / โหมดดูผลเป็นแบบอ่านอย่างเดียว */}
                        {isEditing && q.surveyItemId ? (
                          isNonScored ? (
                            (q.type === "grid" || q.questionType === "grid") ? (
                              <div className="pt-1.5 w-full">
                                <CollapsibleGridTable
                                  label={q.text || "ตารางข้อมูล"}
                                  fieldConfig={q.fieldConfig}
                                  value={editAns?.rawAnswer || editAns?.answerValue || q.rawAnswer || q.answer}
                                  readOnly={false}
                                  onChange={(val) => handleSetCustomValue(q.surveyItemId, val)}
                                  defaultOpen={true}
                                />
                              </div>
                            ) : (q.type === "multians" || q.questionType === "multians") ? (
                              <div className="pt-1.5 w-full">
                                <DynamicFieldRenderer
                                  type="multians"
                                  fieldConfig={q.fieldConfig}
                                  value={editAns?.rawAnswer || editAns?.answerValue || q.rawAnswer || q.answer}
                                  readOnly={false}
                                  onChange={(val) => handleSetCustomValue(q.surveyItemId, val)}
                                  onViewPhoto={(url) => setPreviewPhoto({ url, qNum: q.num, qText: q.text })}
                                />
                              </div>
                            ) : (
                              <div className="pt-1">
                                <DynamicFieldRenderer
                                  type={q.type || q.questionType}
                                  fieldConfig={q.fieldConfig}
                                  value={editAns?.rawAnswer || editAns?.answerValue || q.rawAnswer || q.answer}
                                  readOnly={false}
                                  onChange={(val) => handleSetCustomValue(q.surveyItemId, val)}
                                />
                              </div>
                            )
                          ) : q.type === "scale" ? (
                            <div className="pt-1 space-y-1.5">
                              <div className="flex gap-1.5 items-center w-full">
                                {[5, 4, 3, 2, 1].map((n) => {
                                  const selectedScale = editAns?.scaleScore;
                                  const isSelected = isAnswered && !isNa && (selectedScale !== null && selectedScale !== undefined && Number(selectedScale) === n);
                                  return (
                                    <button
                                      key={n}
                                      type="button"
                                      onClick={() => handleToggleScale(q.surveyItemId, n)}
                                      className={`flex-1 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-black border flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                                        isSelected
                                          ? n >= 3
                                            ? 'bg-[#0F6659] text-white border-[#0F6659] shadow-xs'
                                            : 'bg-rose-600 text-white border-rose-600 shadow-xs'
                                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-2xs'
                                      }`}
                                    >
                                      {n}
                                    </button>
                                  );
                                })}
                                <button
                                  type="button"
                                  onClick={() => handleToggleScale(q.surveyItemId, "na")}
                                  className={`px-3 py-2 sm:py-2.5 rounded-xl flex items-center justify-center text-[10px] sm:text-xs font-black border transition-all cursor-pointer active:scale-95 ${
                                    isAnswered && isNa
                                      ? 'bg-slate-600 text-white border-slate-600 shadow-xs'
                                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-2xs'
                                  }`}
                                >
                                  <Minus size={14} className="mr-0.5" /> N/A
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-3 gap-2 w-full pt-1">
                              {/* ผ่าน / Yes */}
                              <button
                                type="button"
                                onClick={() => handleToggleYesNo(q.surveyItemId, "yes")}
                                className={`py-2 px-1.5 sm:py-2.5 sm:px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                                  isAnswered && !isNa && isPass
                                    ? 'bg-[#0F6659] text-white border-[#0F6659] shadow-sm font-bold'
                                    : 'bg-white hover:bg-emerald-50 text-emerald-800 border-emerald-200 shadow-2xs'
                                }`}
                              >
                                <CheckCircle2 size={15} className={isAnswered && !isNa && isPass ? "text-white" : "text-emerald-600"} />
                                <span>ผ่าน</span>
                              </button>

                              {/* ไม่ผ่าน / No */}
                              <button
                                type="button"
                                onClick={() => handleToggleYesNo(q.surveyItemId, "no")}
                                className={`py-2 px-1.5 sm:py-2.5 sm:px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                                  isAnswered && !isNa && !isPass
                                    ? 'bg-rose-600 text-white border-rose-600 shadow-sm font-bold'
                                    : 'bg-white hover:bg-rose-50 text-rose-800 border-rose-200 shadow-2xs'
                                }`}
                              >
                                <XCircle size={15} className={isAnswered && !isNa && !isPass ? "text-white" : "text-rose-600"} />
                                <span>ไม่ผ่าน</span>
                              </button>

                              {/* ข้าม (N/A) */}
                              <button
                                type="button"
                                onClick={() => handleToggleYesNo(q.surveyItemId, "na")}
                                className={`py-2 px-1.5 sm:py-2.5 sm:px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                                  isAnswered && isNa
                                    ? 'bg-slate-600 text-white border-slate-600 shadow-sm font-bold'
                                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-2xs'
                                }`}
                              >
                                <Minus size={15} className={isAnswered && isNa ? "text-white" : "text-slate-500"} />
                                <span>ข้าม</span>
                              </button>
                            </div>
                          )
                        ) : (
                          /* View Mode (Read-Only) */
                          isNonScored ? (
                            (q.type === "grid" || q.questionType === "grid") ? (
                              <div className="pt-1.5 w-full">
                                <CollapsibleGridTable
                                  label={q.text || "ตารางข้อมูล"}
                                  fieldConfig={q.fieldConfig}
                                  value={q.rawAnswer || q.answer}
                                  defaultOpen={false}
                                />
                              </div>
                            ) : (q.type === "multians" || q.questionType === "multians") ? (
                              <div className="pt-1.5 w-full">
                                <DynamicFieldRenderer
                                  type="multians"
                                  fieldConfig={q.fieldConfig}
                                  value={q.rawAnswer || q.answer}
                                  readOnly={true}
                                  onViewPhoto={(url) => setPreviewPhoto({ url, qNum: q.num, qText: q.text })}
                                />
                              </div>
                            ) : (
                              <div className="pt-1 pointer-events-none select-none">
                                <DynamicFieldRenderer
                                  type={q.type || q.questionType}
                                  fieldConfig={q.fieldConfig}
                                  value={q.rawAnswer || q.answer}
                                />
                              </div>
                            )
                          ) : q.type === "scale" ? (
                            <div className="pt-1 space-y-1.5 pointer-events-none select-none cursor-default">
                              <div className="flex gap-1.5 items-center w-full">
                                {[5, 4, 3, 2, 1].map((n) => {
                                  const selectedScale = q.scaleScore || (typeof q.answer === 'number' && q.answer <= 5 ? q.answer : Math.round((currentSc / full) * 5));
                                  const isSelected = isAnswered && !q.isNa && (selectedScale !== null && selectedScale !== undefined && Number(selectedScale) === n);
                                  return (
                                    <div
                                      key={n}
                                      className={`flex-1 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-black border flex items-center justify-center transition-all ${
                                        isSelected
                                          ? n >= 3
                                            ? 'bg-slate-200/90 text-emerald-800 border-emerald-300/80 font-black'
                                            : 'bg-slate-200/90 text-rose-800 border-rose-300/80 font-black'
                                          : 'bg-slate-50 text-slate-400/80 border-slate-200/60 opacity-40'
                                      }`}
                                    >
                                      {n}
                                    </div>
                                  );
                                })}
                                <div
                                  className={`px-3 py-2 sm:py-2.5 rounded-xl flex items-center justify-center text-[10px] sm:text-xs font-black border transition-all ${
                                    isAnswered && q.isNa
                                      ? 'bg-slate-200/90 text-slate-700 border-slate-300'
                                      : 'bg-slate-50 text-slate-400/80 border-slate-200/60 opacity-40'
                                  }`}
                                >
                                  <Minus size={14} className="mr-0.5" /> N/A
                                </div>
                              </div>
                            </div>
                          ) : (q.type === "text" || q.type === "textarea") ? (
                            q.answer && typeof q.answer === 'string' && q.answer.trim() && (
                              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-medium text-slate-800 w-full">
                                "{q.answer}"
                              </div>
                            )
                          ) : (
                            <div className="grid grid-cols-3 gap-2 w-full pt-1 pointer-events-none select-none cursor-default">
                              {/* ผ่าน / Yes */}
                              <div
                                className={`py-2.5 sm:py-3 rounded-2xl text-[11px] sm:text-xs font-bold border transition-all flex flex-col items-center justify-center gap-1 ${
                                  isAnswered && !q.isNa && isPass
                                    ? 'bg-slate-200/90 text-emerald-800 border-emerald-300/80'
                                    : 'bg-slate-50 text-slate-400/80 border-slate-200/60 opacity-40'
                                }`}
                              >
                                <CheckCircle2 size={18} className={isAnswered && !q.isNa && isPass ? "text-emerald-700" : "text-slate-400"} />
                                <span>ผ่าน</span>
                              </div>

                              {/* ไม่ผ่าน / No */}
                              <div
                                className={`py-2.5 sm:py-3 rounded-2xl text-[11px] sm:text-xs font-bold border transition-all flex flex-col items-center justify-center gap-1 ${
                                  isAnswered && !q.isNa && !isPass
                                    ? 'bg-slate-200/90 text-rose-800 border-rose-300/80'
                                    : 'bg-slate-50 text-slate-400/80 border-slate-200/60 opacity-40'
                                }`}
                              >
                                <XCircle size={18} className={isAnswered && !q.isNa && !isPass ? "text-rose-700" : "text-slate-400"} />
                                <span>ไม่ผ่าน</span>
                              </div>

                              {/* ข้าม (N/A) */}
                              <div
                                className={`py-2.5 sm:py-3 rounded-2xl text-[11px] sm:text-xs font-bold border transition-all flex flex-col items-center justify-center gap-1 ${
                                  isAnswered && q.isNa
                                    ? 'bg-slate-200/90 text-slate-700 border-slate-300'
                                    : 'bg-slate-50 text-slate-400/80 border-slate-200/60 opacity-40'
                                }`}
                              >
                                <Minus size={18} className={isAnswered && q.isNa ? "text-slate-700" : "text-slate-400"} />
                                <span>ข้าม</span>
                              </div>
                            </div>
                          )
                        )}

                        {/* 🌟 ส่วนคอมเม้นและเหตุผลการแก้ไข (Edit Mode หรือ View Mode) */}
                        {isEditing && q.surveyItemId ? (
                          (expandedCommentItems[q.surveyItemId] || isScoreChanged(q.surveyItemId) || (q.isScored && isItemFailed(q.surveyItemId))) && (
                            <div className={`p-3 rounded-2xl border space-y-2.5 transition-all ${
                              q.isScored && isItemFailed(q.surveyItemId) && !editAns?.notes?.trim()
                                ? 'bg-rose-50/20 border-rose-300 ring-1 ring-rose-400/20'
                                : 'bg-slate-50 border-slate-200'
                            }`}>
                              <div>
                                <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5 mb-1">
                                  <MessageSquare size={13} className="text-[#0F6659]" />
                                  <span>บันทึกความเห็นของผู้ตรวจ</span>
                                  {q.isScored && isItemFailed(q.surveyItemId) && (
                                    <span className="text-rose-500 font-extrabold text-[11px]">* (จำเป็นเมื่อไม่ผ่าน)</span>
                                  )}
                                </label>
                                <textarea
                                  id={`edit-note-input-${q.surveyItemId}`}
                                  value={editAns?.notes || ""}
                                  onChange={(e) => handleSetNote(q.surveyItemId, e.target.value)}
                                  placeholder={q.isScored && isItemFailed(q.surveyItemId) ? "ระบุเหตุผล/ข้อบกพร่องที่ไม่ผ่าน (จำเป็น)..." : "ระบุข้อความหรือบันทึกเพิ่มเติม..."}
                                  rows={2}
                                  className={`w-full text-xs p-2.5 rounded-xl bg-white border font-medium text-slate-800 focus:outline-none focus:ring-1 transition-all ${
                                    q.isScored && isItemFailed(q.surveyItemId) && !editAns?.notes?.trim()
                                      ? "border-rose-400 focus:ring-rose-500 placeholder:text-rose-400 bg-rose-50/30"
                                      : "border-slate-200 focus:ring-[#0F6659]"
                                  }`}
                                />
                              </div>

                              {isScoreChanged(q.surveyItemId) && (
                                <div className={`p-2.5 rounded-xl border space-y-1 transition-all ${
                                  !editAns?.editReason?.trim()
                                    ? "bg-rose-50/30 border-rose-300 ring-1 ring-rose-400/20"
                                    : "bg-amber-50 border-amber-300"
                                }`}>
                                  <label className="text-[11px] font-extrabold text-amber-900 flex items-center gap-1">
                                    <AlertTriangle size={13} className="text-amber-600 shrink-0" />
                                    <span>เหตุผลในการปรับแก้คะแนนข้อนี้ (จำเป็น)</span>
                                    <span className="text-rose-500">*</span>
                                  </label>
                                  <input
                                    id={`edit-reason-input-${q.surveyItemId}`}
                                    type="text"
                                    value={editAns?.editReason || ""}
                                    onChange={(e) => handleSetEditReason(q.surveyItemId, e.target.value)}
                                    placeholder="เช่น ตรวจสอบหลักฐานเพิ่มเติมแล้วพบว่าถูกต้อง..."
                                    className={`w-full text-xs p-2 rounded-lg bg-white border font-medium text-slate-800 focus:outline-none focus:ring-1 transition-all ${
                                      !editAns?.editReason?.trim()
                                        ? "border-rose-400 focus:ring-rose-500 placeholder:text-rose-400"
                                        : "border-amber-300 focus:ring-amber-500"
                                    }`}
                                  />
                                </div>
                              )}
                            </div>
                          )
                        ) : (
                          isRealCommentText(q.note, q.rawAnswer) && (
                            <div className="p-2.5 px-3 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2 bg-slate-50 text-slate-800 border border-slate-200">
                              <MessageSquare size={14} className="shrink-0 text-slate-400" />
                              <span><b>บันทึกผู้ตรวจ:</b> {q.note}</span>
                            </div>
                          )
                        )}

                        {/* 🌟 รูปภาพหลักฐาน (Edit Mode หรือ View Mode) */}
                        {isEditing && q.surveyItemId ? (
                          expandedPhotoItems[q.surveyItemId] && (
                            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                                  <Camera size={14} className="text-[#0F6659]" />
                                  <span>รูปภาพหลักฐาน ({editAns?.imageUrls?.length || 0} รูป)</span>
                                </div>
                                <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#0F6659] hover:bg-[#0c5247] text-white text-[11px] font-bold cursor-pointer transition-all active:scale-95 shadow-2xs">
                                  {isUploadingPhoto[q.surveyItemId] ? (
                                    <Loader2 size={12} className="animate-spin" />
                                  ) : (
                                    <Plus size={12} />
                                  )}
                                  <span>{isUploadingPhoto[q.surveyItemId] ? "กำลังอัปโหลด…" : "เพิ่มรูป"}</span>
                                  <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp,image/jpg"
                                    multiple
                                    className="hidden"
                                    disabled={isUploadingPhoto[q.surveyItemId]}
                                    onChange={(e) => handlePhotoUpload(q.surveyItemId, e.target.files)}
                                  />
                                </label>
                              </div>

                              {editAns?.imageUrls && editAns.imageUrls.length > 0 ? (
                                <div className="flex gap-2 overflow-x-auto pb-1">
                                  {editAns.imageUrls.map((url, uIdx) => (
                                    <div key={uIdx} className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 shrink-0 group">
                                      <img
                                        src={getFullImageUrl(url)}
                                        alt="หลักฐาน"
                                        className="w-full h-full object-cover cursor-pointer"
                                        onClick={() => setPreviewEditPhoto(getFullImageUrl(url))}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleDeletePhoto(q.surveyItemId, url)}
                                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center hover:bg-rose-700 shadow-sm cursor-pointer"
                                        title="ลบรูปภาพนี้"
                                      >
                                        <Trash2 size={10} />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-center py-2 text-[11px] text-slate-400">ยังไม่มีรูปภาพหลักฐาน</div>
                              )}
                            </div>
                          )
                        ) : (
                          q.images && q.images.length > 0 ? (
                            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                                  <Camera size={15} className="text-[#0F6659]" />
                                  <span>รูปภาพหลักฐาน ({q.images.length} รูป)</span>
                                </div>
                              </div>
                              <div className="flex gap-2.5 overflow-x-auto pb-1">
                                {q.images.map((img, imgIdx) => {
                                  const imgUrl = img.imageUrl || img.url || img;
                                  return (
                                    <div 
                                      key={img.id || imgIdx}
                                      onClick={() => setPreviewPhoto({
                                        url: imgUrl,
                                        qNum: q.num,
                                        qText: q.text,
                                        secTitle: sec.title,
                                        isPass,
                                        note: q.note,
                                        uploadedAt: img.uploadedAt ? formatTimeWithSeconds(img.uploadedAt, dateStr) : dateStr
                                      })}
                                      className="group relative w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden border border-slate-200 shrink-0 cursor-pointer shadow-2xs hover:border-[#0F6659] hover:shadow-md transition-all"
                                    >
                                      <img 
                                        src={getFullImageUrl(imgUrl)} 
                                        alt={q.text} 
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                                      />
                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-[11px] font-bold transition-opacity gap-1">
                                        <Maximize2 size={16} />
                                        <span>ขยาย</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : q.hasPhoto ? (
                            <div className="p-2.5 px-3 rounded-xl bg-red-50 border border-red-200 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 text-xs font-bold text-red-800">
                                <Camera size={15} className="text-red-600" />
                                <span>แนบรูปหลักฐานข้อบกพร่อง</span>
                              </div>
                              <button 
                                type="button"
                                onClick={() => setActiveTab("photos")} 
                                className="text-xs font-bold text-red-700 hover:underline cursor-pointer"
                              >
                                เปิดดูรูป ➔
                              </button>
                            </div>
                          ) : null
                        )}

                        {/* 🌟 Direct CAP Action: Enter Real CAP Chat Room / Ticket */}
                        {(() => {
                          const cap = findCapTaskForQuestion(q);
                          const status = (cap?.status || "").toUpperCase();
                          const isCancelled = status === "CANCELLED";

                          if (!isPass || isCancelled) {
                            return (
                              <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                                {/* Live CAP Status Badge */}
                                <div>
                                  {(() => {
                                    if (status === "CLOSED" || status === "APPROVED" || status === "DONE") {
                                      return (
                                        <span className="inline-flex items-center gap-1.5 text-xs font-extrabold px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-300 shadow-2xs">
                                          <CheckCircle2 size={14} className="text-emerald-600" />
                                          <span>อนุมัติและปิดงานแก้ไขแล้ว</span>
                                        </span>
                                      );
                                    }
                                    if (isCancelled) {
                                      return (
                                        <span className="inline-flex items-center gap-1.5 text-xs font-extrabold px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 border border-slate-300 shadow-2xs">
                                          <CheckCircle2 size={14} className="text-slate-500" />
                                          <span>ยกเลิกงาน CAP (แก้ไขผลเป็นผ่านแล้ว)</span>
                                        </span>
                                      );
                                    }
                                    if (status === "SUBMITTED") {
                                      return (
                                        <span className="inline-flex items-center gap-1.5 text-xs font-extrabold px-3 py-1.5 rounded-xl bg-amber-50 text-amber-900 border border-amber-300 shadow-2xs">
                                          <Sparkles size={14} className="text-amber-600" />
                                          <span>สาขาส่งหลักฐานแล้ว (รอตรวจ)</span>
                                        </span>
                                      );
                                    }
                                    return (
                                      <span className="inline-flex items-center gap-1.5 text-xs font-extrabold px-3 py-1.5 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 shadow-2xs">
                                        <AlertTriangle size={14} className="text-rose-600" />
                                        <span>รายการแก้ไข CAP (รอดำเนินการ)</span>
                                      </span>
                                    );
                                  })()}
                                </div>

                                {/* Button to open CAP chat room */}
                                <button
                                  type="button"
                                  disabled={loadingCapQuestionId === q.id}
                                  onClick={() => handleOpenCapChat(q)}
                                  className="px-4 py-2.5 rounded-2xl bg-[#0F6659] hover:bg-[#0B4E44] text-xs sm:text-sm font-bold text-white cursor-pointer shadow-sm active:scale-95 transition-all flex items-center gap-2"
                                  title={isCancelled ? "เปิดดูประวัติการแก้ไขและข้อความยกเลิก" : "เปิดห้องสนทนาเพื่อพูดคุย ส่งรูปถ่ายหลักฐาน และติดตามผลการแก้ไข"}
                                >
                                  {loadingCapQuestionId === q.id ? (
                                    <span>กำลังเปิด...</span>
                                  ) : (
                                    <>
                                      <MessageSquare size={16} />
                                      <span>{isCancelled ? "ดูประวัติ CAP" : "ติดตามงาน CAP ➔"}</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          }))}
        </div>
      )}

      {/* 🖼️ FULLSCREEN IMAGE LIGHTBOX / PREVIEW MODAL */}
      {previewPhoto && (
        <ModalWrapper onClose={() => setPreviewPhoto(null)} maxWidth="max-w-2xl">
          <div className="p-4 border-b flex items-center justify-between bg-slate-50 border-slate-200">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-[#0F6659] flex items-center justify-center font-extrabold text-xs shrink-0">
                {previewPhoto.qNum || "📷"}
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 leading-snug">
                  {previewPhoto.qText || "รูปภาพหลักฐานการตรวจ"}
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  {previewPhoto.secTitle ? `${previewPhoto.secTitle} • ` : ""}บันทึกเมื่อ: {previewPhoto.uploadedAt || dateStr}
                </p>
              </div>
            </div>
            <button 
              type="button"
              onClick={() => setPreviewPhoto(null)} 
              className="w-8 h-8 rounded-full bg-slate-200/80 hover:bg-slate-300 flex items-center justify-center text-slate-600 cursor-pointer transition-all shrink-0"
            >
              <X size={16} />
            </button>
          </div>

          <div className="p-4 space-y-3 max-h-[75dvh] overflow-y-auto overscroll-contain">
            <div className="rounded-2xl overflow-hidden bg-slate-950 border border-slate-200 flex items-center justify-center min-h-[220px]">
              <img 
                src={getFullImageUrl(previewPhoto.url)} 
                alt={previewPhoto.qText} 
                className="max-h-[60vh] w-auto max-w-full object-contain mx-auto" 
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-lg text-white ${
                  previewPhoto.isPass ? 'bg-emerald-600' : 'bg-red-600'
                }`}>
                  {previewPhoto.isPass ? '✓ เรียบร้อย' : '⚠️ ปรับปรุง'}
                </span>
              </div>
              {previewPhoto.note && (
                <div className="text-xs text-slate-700 font-medium leading-relaxed">
                  💬 <b>บันทึกผู้ตรวจ:</b> {previewPhoto.note}
                </div>
              )}
            </div>
          </div>

          <div className="p-3 border-t bg-slate-50 border-slate-200 flex justify-end">
            <button 
              type="button"
              onClick={() => setPreviewPhoto(null)} 
              className="px-5 py-2 rounded-2xl bg-slate-200 hover:bg-slate-300 font-bold text-xs text-slate-700 cursor-pointer transition-all"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        </ModalWrapper>
      )}

      {/* TAB 2: OVERVIEW SCORES & CAP ISSUES */}
      {activeTab === "overview" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <Section
            title={
              <div
                className="flex items-center gap-1.5 cursor-pointer select-none"
                onClick={() => setIsCategoryScoresExpanded(prev => !prev)}
              >
                <span>คะแนนแยกตามหมวดหมู่</span>
              </div>
            }
            action={
              <button
                type="button"
                onClick={() => setIsCategoryScoresExpanded(prev => !prev)}
                className="flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-xl transition-all cursor-pointer"
                title={isCategoryScoresExpanded ? "ซ่อนคะแนนแยกตามหมวดหมู่" : "แสดงคะแนนแยกตามหมวดหมู่"}
              >
                <span>{isCategoryScoresExpanded ? "ซ่อน" : "แสดง"}</span>
                <ChevronDown
                  size={13}
                  className={`transition-transform duration-200 ${isCategoryScoresExpanded ? "rotate-180" : ""}`}
                />
              </button>
            }
          >
            {isCategoryScoresExpanded && (
              <div className="rounded-2xl overflow-hidden shadow-2xs animate-in fade-in duration-200" style={cardStyle}>
                {categoryScores.map((s, i) => {
                  const isPassing = s.percent >= passingScore;
                  return (
                    <div key={s.title} className="px-4 py-3.5" style={{ borderBottom: i < categoryScores.length - 1 ? `1px solid ${c.border}` : "none" }}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-slate-800">{getCategoryDisplay(s.title)}</span>
                        <span className="text-xs font-bold" style={{ color: c.muted, fontFamily: mono }}>{s.score}/{s.max} ({parseFloat(Number(s.percent).toFixed(2))}%)</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden bg-slate-100">
                        <div
                          className="h-full rounded-full transition-all duration-500 ease-out"
                          style={{
                            width: `${s.max > 0 ? Math.min(100, Math.max(0, (s.score / s.max) * 100)) : 0}%`,
                            background: isPassing ? c.accent : s.percent >= 70 ? c.warn : c.risk
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          {/* ข้อมูลและตัวแปรเฉพาะรอบการตรวจ (Custom Audit Details) */}
          {allDisplayMetadataFields.length > 0 && (
            <Section
              title={
                <div
                  className="flex items-center gap-1.5 cursor-pointer select-none"
                  onClick={() => setIsAuditDetailsExpanded(prev => !prev)}
                >
                  <span>ข้อมูลรอบการตรวจ (Audit Details)</span>
                </div>
              }
              action={
                <button
                  type="button"
                  onClick={() => setIsAuditDetailsExpanded(prev => !prev)}
                  className="flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-xl transition-all cursor-pointer"
                  title={isAuditDetailsExpanded ? "ซ่อนข้อมูลรอบการตรวจ" : "แสดงข้อมูลรอบการตรวจ"}
                >
                  <span>{isAuditDetailsExpanded ? "ซ่อน" : "แสดง"}</span>
                  <ChevronDown
                    size={13}
                    className={`transition-transform duration-200 ${isAuditDetailsExpanded ? "rotate-180" : ""}`}
                  />
                </button>
              }
            >
              {isAuditDetailsExpanded && (
                <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3 animate-in fade-in duration-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {allDisplayMetadataFields.map((item) => {
                      if (item.type === "grid") {
                        const gridVal = isEditing
                          ? (editMetadataValues[item.id] !== undefined ? editMetadataValues[item.id] : item.rawValue)
                          : item.rawValue;

                        return (
                          <div key={item.id} className="col-span-full">
                            <CollapsibleGridTable
                              label={item.label}
                              fieldConfig={item.fieldConfig}
                              value={gridVal}
                              readOnly={!isEditing}
                              onChange={isEditing ? ((newVal) => {
                                setEditMetadataValues(prev => ({ ...prev, [item.id]: newVal }));
                              }) : undefined}
                              defaultOpen={isEditing}
                            />
                          </div>
                        );
                      }

                      if (isEditing) {
                        const rawType = String(item.type || item.questionType || "").trim().toLowerCase();
                        const lblLower = String(item.label || "").toLowerCase();

                        // 1. ประเภทการตรวจ (Audit Type)
                        if (item.id === "audit_type") {
                          const options = (item.fieldConfig?.options && item.fieldConfig.options.length > 0)
                            ? item.fieldConfig.options
                            : (item.options && item.options.length > 0)
                            ? item.options
                            : ["ตามกำหนดการ", "นอกกำหนดการ", "ปลอมตัว"];
                          const currentAuditTypeVal = editMetadataValues.audit_type || (
                            editAuditType === "spot" ? "นอกกำหนดการ" :
                            editAuditType === "undercover" ? "ปลอมตัว" :
                            editAuditType === "announced" ? "ตามกำหนดการ" : editAuditType
                          );
                          return (
                            <div key={item.id} className="p-3 rounded-xl bg-slate-50 border border-emerald-300 shadow-2xs relative">
                              <div className="text-[11px] font-bold text-slate-500 capitalize">{item.label}</div>
                              <div className="relative mt-1 flex items-center">
                                <select
                                  value={currentAuditTypeVal}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEditMetadataValues(prev => ({ ...prev, audit_type: val }));
                                    const raw = String(val).toLowerCase();
                                    const mapped = raw.includes("ปลอม") || raw === "undercover" ? "undercover"
                                      : raw.includes("นอก") || raw === "spot" || raw === "unannounced" ? "spot"
                                      : "announced";
                                    setEditAuditType(mapped);
                                  }}
                                  className="w-full text-sm font-extrabold text-slate-800 bg-transparent outline-none pr-6 cursor-pointer appearance-none"
                                >
                                  <option value="">-- เลือกประเภทการตรวจ --</option>
                                  {options.map((opt, oIdx) => (
                                    <option key={oIdx} value={opt}>{opt}</option>
                                  ))}
                                </select>
                                <ChevronDown size={16} className="text-slate-500 pointer-events-none absolute right-0" />
                              </div>
                            </div>
                          );
                        }

                        // 2. ผู้ตรวจประเมิน (Auditor)
                        if (item.id === "auditor" || rawType === "auditor" || rawType === "user") {
                          return (
                            <div key={item.id} className="p-3 rounded-xl bg-slate-50 border border-emerald-300 shadow-2xs relative">
                              <div className="text-[11px] font-bold text-slate-500 capitalize">{item.label}</div>
                              <div className="relative mt-1 flex items-center">
                                {usersList.length > 0 ? (
                                  <>
                                    <select
                                      value={editMetadataValues[item.id] || editMetadataValues.auditor || currentRecord.auditor || ""}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        setEditMetadataValues(prev => ({ ...prev, [item.id]: v, auditor: v }));
                                      }}
                                      className="w-full text-sm font-extrabold text-slate-800 bg-transparent outline-none pr-6 cursor-pointer appearance-none"
                                    >
                                      <option value="">-- เลือกผู้ตรวจ --</option>
                                      {usersList.map(u => (
                                        <option key={u.id} value={u.fullName || u.username}>{u.fullName || u.username}</option>
                                      ))}
                                    </select>
                                    <ChevronDown size={16} className="text-slate-500 pointer-events-none absolute right-0" />
                                  </>
                                ) : (
                                  <div className="flex items-center justify-between gap-2 w-full">
                                    <input
                                      type="text"
                                      value={editMetadataValues[item.id] || editMetadataValues.auditor || currentRecord.auditor || ""}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        setEditMetadataValues(prev => ({ ...prev, [item.id]: v, auditor: v }));
                                      }}
                                      className="w-full text-sm font-extrabold text-slate-800 bg-transparent outline-none"
                                      placeholder="ชื่อผู้ตรวจประเมิน..."
                                    />
                                    <Edit3 size={15} className="text-slate-400 shrink-0 pointer-events-none" />
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        }

                        // 3. จำนวนพนักงานขณะตรวจ (Staff Count)
                        if (item.id === "staff_count") {
                          const currentStaffVal = editMetadataValues[item.id] !== undefined && editMetadataValues[item.id] !== null && editMetadataValues[item.id] !== ""
                            ? editMetadataValues[item.id]
                            : (editStaffCount !== undefined && editStaffCount !== null && editStaffCount !== 0
                              ? editStaffCount
                              : (item.rawValue !== undefined && item.rawValue !== null && item.rawValue !== ""
                                ? item.rawValue
                                : (staffCount ?? 0)));

                          return (
                            <div key={item.id} className="p-3 rounded-xl bg-slate-50 border border-emerald-300 shadow-2xs relative">
                              <div className="text-[11px] font-bold text-slate-500 capitalize">{item.label}</div>
                              <div className="flex items-center justify-between gap-2 mt-1">
                                <div className="flex items-center gap-1 flex-1">
                                  <input
                                    type="number"
                                    min="0"
                                    value={currentStaffVal}
                                    onChange={(e) => {
                                      const val = e.target.value === "" ? "" : (Number(e.target.value) || 0);
                                      setEditStaffCount(Number(val) || 0);
                                      setEditMetadataValues(prev => ({ ...prev, [item.id]: val, staff_count: val }));
                                    }}
                                    className="w-full text-sm font-extrabold text-slate-800 bg-transparent outline-none"
                                  />
                                  <span className="text-xs font-bold text-slate-500 shrink-0">คน</span>
                                </div>
                                <Edit3 size={15} className="text-slate-400 shrink-0 pointer-events-none" />
                              </div>
                            </div>
                          );
                        }

                        // 4. ผ่าน / ไม่ผ่าน (Yes / No) - รองรับ ผ่าน, ไม่ผ่าน, ข้าม (N/A)
                        const isYesNo = rawType === "yesno" || rawType === "yes_no" || rawType === "pass_fail" || lblLower.includes("ผ่าน/ไม่ผ่าน") || lblLower.includes("ผ่าน / ไม่ผ่าน") || lblLower.includes("yes/no") || lblLower.includes("yesno");
                        if (isYesNo) {
                          const baseOptions = (item.fieldConfig?.options && item.fieldConfig.options.length > 0)
                            ? item.fieldConfig.options
                            : (item.options && item.options.length > 0)
                            ? item.options
                            : ["ผ่าน", "ไม่ผ่าน", "ข้าม (N/A)"];
                          
                          const finalOptions = [...baseOptions];
                          if (!finalOptions.some(o => o.includes("ข้าม") || o.includes("N/A") || String(o).toLowerCase() === "na")) {
                            finalOptions.push("ข้าม (N/A)");
                          }

                          const curVal = editMetadataValues[item.id] !== undefined ? editMetadataValues[item.id] : (item.rawValue ?? "");
                          let mappedVal = String(curVal ?? "");
                          if (curVal === true || curVal === "true" || curVal === "yes") mappedVal = "ผ่าน";
                          else if (curVal === false || curVal === "false" || curVal === "no") mappedVal = "ไม่ผ่าน";
                          else if (curVal === "na" || curVal === "skip") mappedVal = "ข้าม (N/A)";

                          return (
                            <div key={item.id} className="p-3 rounded-xl bg-slate-50 border border-emerald-300 shadow-2xs relative">
                              <div className="text-[11px] font-bold text-slate-500 capitalize">{item.label}</div>
                              <div className="relative mt-1 flex items-center">
                                <select
                                  value={mappedVal}
                                  onChange={(e) => setEditMetadataValues(prev => ({ ...prev, [item.id]: e.target.value }))}
                                  className="w-full text-sm font-extrabold text-slate-800 bg-transparent outline-none pr-6 cursor-pointer appearance-none"
                                >
                                  <option value="">-- เลือก ผ่าน/ไม่ผ่าน --</option>
                                  {finalOptions.map((opt, oIdx) => (
                                    <option key={oIdx} value={opt}>{opt}</option>
                                  ))}
                                </select>
                                <ChevronDown size={16} className="text-slate-500 pointer-events-none absolute right-0" />
                              </div>
                            </div>
                          );
                        }

                        // 5. สเกลคะแนน 1-5 (Scale) - ตัวเลขเดี่ยวๆ 1-5
                        const isScale = rawType === "scale" || rawType === "rating" || lblLower.includes("1-5") || lblLower.includes("1 - 5") || lblLower.includes("scale");
                        if (isScale) {
                          const scaleOptions = ["1", "2", "3", "4", "5"];
                          const curVal = editMetadataValues[item.id] !== undefined ? editMetadataValues[item.id] : (item.rawValue ?? "");
                          return (
                            <div key={item.id} className="p-3 rounded-xl bg-slate-50 border border-emerald-300 shadow-2xs relative">
                              <div className="text-[11px] font-bold text-slate-500 capitalize">{item.label}</div>
                              <div className="relative mt-1 flex items-center">
                                <select
                                  value={curVal !== undefined && curVal !== null ? String(curVal) : ""}
                                  onChange={(e) => setEditMetadataValues(prev => ({ ...prev, [item.id]: e.target.value }))}
                                  className="w-full text-sm font-extrabold text-slate-800 bg-transparent outline-none pr-6 cursor-pointer appearance-none"
                                >
                                  <option value="">-- เลือกระดับคะแนน (1-5) --</option>
                                  {scaleOptions.map(num => (
                                    <option key={num} value={num}>{num}</option>
                                  ))}
                                </select>
                                <ChevronDown size={16} className="text-slate-500 pointer-events-none absolute right-0" />
                              </div>
                            </div>
                          );
                        }

                        // 6. ตัวเลือกเดียว (Radio / Ratio / Select)
                        const isSingleSelect = rawType === "select" || rawType === "radio" || rawType === "ratio";
                        if (isSingleSelect) {
                          const options = (item.fieldConfig?.options && item.fieldConfig.options.length > 0)
                            ? item.fieldConfig.options
                            : (item.options && item.options.length > 0)
                            ? item.options
                            : [];
                          const curVal = editMetadataValues[item.id] !== undefined ? editMetadataValues[item.id] : (item.rawValue ?? "");
                          return (
                            <div key={item.id} className="p-3 rounded-xl bg-slate-50 border border-emerald-300 shadow-2xs relative">
                              <div className="text-[11px] font-bold text-slate-500 capitalize">{item.label}</div>
                              <div className="relative mt-1 flex items-center">
                                <select
                                  value={curVal !== undefined && curVal !== null ? String(curVal) : ""}
                                  onChange={(e) => setEditMetadataValues(prev => ({ ...prev, [item.id]: e.target.value }))}
                                  className="w-full text-sm font-extrabold text-slate-800 bg-transparent outline-none pr-6 cursor-pointer appearance-none"
                                >
                                  <option value="">-- เลือกคำตอบ --</option>
                                  {options.map((opt, oIdx) => (
                                    <option key={oIdx} value={opt}>{opt}</option>
                                  ))}
                                </select>
                                <ChevronDown size={16} className="text-slate-500 pointer-events-none absolute right-0" />
                              </div>
                            </div>
                          );
                        }

                        // 7. หลายตัวเลือก (Checkbox / Multi-answer)
                        const isCheckbox = rawType === "checkbox" || rawType === "multians" || rawType === "multi_select";
                        if (isCheckbox) {
                          const options = (item.fieldConfig?.options && item.fieldConfig.options.length > 0)
                            ? item.fieldConfig.options
                            : (item.options && item.options.length > 0)
                            ? item.options
                            : [];
                          const curVal = editMetadataValues[item.id] !== undefined ? editMetadataValues[item.id] : item.rawValue;
                          const currentSelected = (() => {
                            if (!curVal) return [];
                            if (Array.isArray(curVal)) return curVal;
                            if (typeof curVal === "string") {
                              try {
                                const p = JSON.parse(curVal);
                                if (Array.isArray(p)) return p;
                              } catch (e) {}
                              if (curVal.includes(",")) return curVal.split(",").map(s => s.trim()).filter(Boolean);
                              return [curVal.trim()];
                            }
                            return [String(curVal)];
                          })();

                          return (
                            <div key={item.id} className="p-3 rounded-xl bg-slate-50 border border-emerald-300 shadow-2xs relative">
                              <div className="text-[11px] font-bold text-slate-500 capitalize">{item.label}</div>
                              {options.length > 0 ? (
                                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                  {options.map((opt, oIdx) => {
                                    const isChecked = currentSelected.includes(opt);
                                    return (
                                      <button
                                        key={oIdx}
                                        type="button"
                                        onClick={() => {
                                          const next = isChecked
                                            ? currentSelected.filter(x => x !== opt)
                                            : [...currentSelected, opt];
                                          setEditMetadataValues(prev => ({ ...prev, [item.id]: next }));
                                        }}
                                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${
                                          isChecked
                                            ? "bg-emerald-50 text-[#0F6659] border-emerald-400 shadow-2xs ring-1 ring-[#0F6659]/20"
                                            : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                                        }`}
                                      >
                                        <span className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[10px] ${
                                          isChecked ? "bg-[#0F6659] border-[#0F6659] text-white" : "border-slate-300 bg-white"
                                        }`}>
                                          {isChecked && "✓"}
                                        </span>
                                        <span>{opt}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="flex items-center justify-between gap-2 mt-1">
                                  <input
                                    type="text"
                                    value={Array.isArray(currentSelected) ? currentSelected.join(", ") : String(curVal ?? "")}
                                    onChange={(e) => setEditMetadataValues(prev => ({ ...prev, [item.id]: e.target.value.split(",").map(s => s.trim()).filter(Boolean) }))}
                                    className="w-full text-sm font-extrabold text-slate-800 bg-transparent outline-none"
                                    placeholder="คั่นแต่ละตัวเลือกด้วยเครื่องหมายจุลภาค (,)"
                                  />
                                  <Edit3 size={15} className="text-slate-400 shrink-0 pointer-events-none" />
                                </div>
                              )}
                            </div>
                          );
                        }

                        // 8. วันที่ (Date)
                        const isDate = rawType === "date" || (lblLower.includes("วัน") && !lblLower.includes("พนักงาน")) || lblLower.includes("date");
                        if (isDate) {
                          const curVal = editMetadataValues[item.id] !== undefined ? editMetadataValues[item.id] : (item.rawValue ?? "");
                          return (
                            <div key={item.id} className="p-3 rounded-xl bg-slate-50 border border-emerald-300 shadow-2xs relative">
                              <div className="text-[11px] font-bold text-slate-500 capitalize">{item.label}</div>
                              <div className="relative mt-1 flex items-center justify-between gap-2">
                                <input
                                  type="date"
                                  value={curVal ?? ""}
                                  onChange={(e) => setEditMetadataValues(prev => ({ ...prev, [item.id]: e.target.value }))}
                                  className="w-full text-sm font-extrabold text-slate-800 bg-transparent outline-none cursor-pointer"
                                />
                                <Calendar size={15} className="text-slate-400 shrink-0 pointer-events-none" />
                              </div>
                            </div>
                          );
                        }

                        // 9. เวลา (Time)
                        const isTime = rawType === "time" || lblLower.includes("เวลา") || lblLower.includes("time");
                        if (isTime) {
                          const curVal = editMetadataValues[item.id] !== undefined ? editMetadataValues[item.id] : (item.rawValue ?? "");
                          return (
                            <div key={item.id} className="p-3 rounded-xl bg-slate-50 border border-emerald-300 shadow-2xs relative">
                              <div className="text-[11px] font-bold text-slate-500 capitalize">{item.label}</div>
                              <div className="relative mt-1 flex items-center justify-between gap-2">
                                <input
                                  type="time"
                                  value={curVal ?? ""}
                                  onChange={(e) => setEditMetadataValues(prev => ({ ...prev, [item.id]: e.target.value }))}
                                  className="w-full text-sm font-extrabold text-slate-800 bg-transparent outline-none cursor-pointer"
                                />
                                <Clock size={15} className="text-slate-400 shrink-0 pointer-events-none" />
                              </div>
                            </div>
                          );
                        }

                        // 10. ตัวเลข (Number)
                        const isNumber = rawType === "number";
                        if (isNumber) {
                          const curVal = editMetadataValues[item.id] !== undefined ? editMetadataValues[item.id] : (item.rawValue ?? "");
                          return (
                            <div key={item.id} className="p-3 rounded-xl bg-slate-50 border border-emerald-300 shadow-2xs relative">
                              <div className="text-[11px] font-bold text-slate-500 capitalize">{item.label}</div>
                              <div className="flex items-center justify-between gap-2 mt-1">
                                <div className="flex items-center gap-1 flex-1">
                                  <input
                                    type="number"
                                    value={curVal ?? ""}
                                    onChange={(e) => setEditMetadataValues(prev => ({ ...prev, [item.id]: e.target.value }))}
                                    className="w-full text-sm font-extrabold text-slate-800 bg-transparent outline-none"
                                    placeholder={`กรอก${item.label}...`}
                                  />
                                  {item.unit && <span className="text-xs font-bold text-slate-500 shrink-0">{item.unit}</span>}
                                </div>
                                <Edit3 size={15} className="text-slate-400 shrink-0 pointer-events-none" />
                              </div>
                            </div>
                          );
                        }

                        // 11. ข้อความทั่วไป (Text fallback)
                        return (
                          <div key={item.id} className="p-3 rounded-xl bg-slate-50 border border-emerald-300 shadow-2xs relative">
                            <div className="text-[11px] font-bold text-slate-500 capitalize">{item.label}</div>
                            <div className="flex items-center justify-between gap-2 mt-1">
                              <input
                                type="text"
                                value={editMetadataValues[item.id] !== undefined ? editMetadataValues[item.id] : (item.rawValue ?? "")}
                                onChange={(e) => setEditMetadataValues(prev => ({ ...prev, [item.id]: e.target.value }))}
                                className="w-full text-sm font-extrabold text-slate-800 bg-transparent outline-none"
                                placeholder={`กรอก${item.label}...`}
                              />
                              <Edit3 size={15} className="text-slate-400 shrink-0 pointer-events-none" />
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={item.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                          <div className="text-[11px] font-bold text-slate-500 capitalize">{item.label}</div>
                          <div className="text-sm font-extrabold text-slate-800 mt-0.5">
                            {Array.isArray(item.value) ? item.value.join(", ") : item.value}{item.unit}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Section>
          )}

          {issues.length > 0 && (
            <Section title={`ข้อบกพร่องที่ต้องแก้ไข (${issues.length} ข้อ)`}>
              <div className="flex flex-col gap-2">
                {issues.map((iss, i) => (
                  <div key={i} className={`rounded-2xl p-3 sm:p-3.5 flex items-start gap-2.5 ${iss.critical ? "bg-rose-50" : "bg-amber-50"}`}>
                    {iss.critical ? (
                      <Megaphone size={15} className="shrink-0 text-rose-600 mt-0.5" />
                    ) : (
                      <AlertTriangle size={15} className="shrink-0 text-amber-600 mt-0.5" />
                    )}
                    <div className={`text-xs leading-relaxed font-medium space-y-0.5 ${iss.critical ? "text-rose-600" : "text-amber-600"}`}>
                      <div className="font-bold">ข้อ {iss.num || i + 1}. {iss.title}</div>
                      {iss.note && <div className="text-[11.5px] opacity-90">➔ {iss.note}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {issues.length === 0 && (
            <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-center text-xs font-bold text-emerald-800 flex items-center justify-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-700 shrink-0" />
              <span>✓ ผ่านเกณฑ์มาตรฐาน ไม่พบข้อบกพร่อง</span>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: DUAL PHOTO ALBUMS */}
      {activeTab === "photos" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-2">
              <Camera size={16} className="text-[#0F6659]" />
              <span>คลังภาพบันทึกหลักฐานการตรวจ ({locationTitle})</span>
            </h3>
          </div>

          {/* Album 1: On-site Inspection Photos */}
          <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-start sm:items-center justify-between gap-2.5 sm:gap-3">
              <span className="text-xs sm:text-sm font-bold text-slate-900">📷 อัลบั้มรูปตรวจหน้างาน</span>
              <div className="flex flex-col sm:flex-row items-end sm:items-center shrink-0 gap-1 sm:gap-2 text-right">
                <span className="text-[11px] sm:text-xs text-slate-400 font-medium whitespace-nowrap">บันทึกโดยผู้ตรวจ</span>
                <span className={`text-[11px] sm:text-xs font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap ${allInspectionPhotos.length > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                  {allInspectionPhotos.length > 0 ? `${allInspectionPhotos.length} รูปภาพ` : 'ไม่มีรูปภาพ'}
                </span>
              </div>
            </div>

            {allInspectionPhotos.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                {allInspectionPhotos.map((p, pIdx) => (
                  <div 
                    key={p.id || pIdx}
                    onClick={() => setPreviewPhoto(p)}
                    className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5 cursor-pointer hover:border-[#0F6659] hover:shadow-md transition-all group"
                  >
                    <div className="h-44 rounded-xl relative overflow-hidden border bg-slate-900 flex items-center justify-center">
                      <img 
                        src={getFullImageUrl(p.url)} 
                        alt={p.qText} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                      />
                      <div className={`absolute top-2 left-2 px-2.5 py-0.5 rounded-lg text-white text-[10px] font-extrabold shadow-sm ${
                        p.isPass ? 'bg-emerald-600' : 'bg-red-600'
                      }`}>
                        {p.isPass ? 'เรียบร้อย' : 'ปรับปรุง'}
                      </div>
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity gap-1.5">
                        <Maximize2 size={16} />
                        <span>คลิกเพื่อเปิดดูรูปเต็ม</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-bold text-slate-800 line-clamp-1">
                        ข้อ {p.qNum}. {p.qText}
                      </div>
                      <div className="text-[11px] text-slate-400 font-medium flex items-center justify-between">
                        <span>{p.secTitle}</span>
                        <span>{p.uploadedAt}</span>
                      </div>
                      {p.note && (
                        <div className="text-xs text-slate-600 font-medium line-clamp-2 pt-0.5 border-t border-slate-200">
                          💬 {p.note}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-center space-y-2">
                <Camera size={32} className="text-slate-300 mx-auto" />
                <div className="text-xs font-bold text-slate-600">ไม่มีรูปภาพที่แนบในการตรวจนี้</div>
                <div className="text-[11px] text-slate-400">ผู้ตรวจไม่ได้แนบรูปถ่ายประกอบข้อคำถาม</div>
              </div>
            )}
          </div>

          {/* Album 2: CAP Corrective Action Evidence Photos */}
          <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-start sm:items-center justify-between gap-2.5 sm:gap-3">
              <span className="text-xs sm:text-sm font-bold text-slate-900">🛠️ อัลบั้มรูปหลักฐานการแก้ไข</span>
              <div className="flex flex-col sm:flex-row items-end sm:items-center shrink-0 gap-1 sm:gap-2 text-right">
                <span className="text-[11px] sm:text-xs text-slate-400 font-medium whitespace-nowrap">ส่งมอบโดยสาขา</span>
                <span className="text-[11px] sm:text-xs font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap bg-emerald-100 text-emerald-800">
                  {allCapAfterPhotos.length > 0 ? `${allCapAfterPhotos.length} รูปแก้ไข` : 'รอการแก้ไข'}
                </span>
              </div>
            </div>

            {allCapAfterPhotos.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {allCapAfterPhotos.map((photo, i) => (
                  <div key={photo.id || i} className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-2">
                    <div className="h-36 rounded-xl bg-emerald-100/70 flex flex-col items-center justify-center text-emerald-800 relative overflow-hidden border border-emerald-300">
                      <img 
                        src={getFullImageUrl(photo.imageUrl)} 
                        alt="CAP after evidence" 
                        className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform" 
                        onClick={() => setPreviewPhoto({
                          url: getFullImageUrl(photo.imageUrl),
                          qNum: photo.qNum || i + 1,
                          qText: photo.issueItem || "หลักฐานการแก้ไข",
                          secTitle: "งานแก้ไข CAP",
                          isPass: true,
                          note: `งานแก้ไข CAP #${photo.capId} · ${photo.issueItem}`,
                          uploadedAt: photo.uploadedAt ? formatTimeWithSeconds(photo.uploadedAt, dateStr) : dateStr
                        })}
                      />
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-emerald-700 text-white text-[9.5px] font-bold">
                        ✓ Corrected (หลังแก้ไข)
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-emerald-950 font-medium">
                      <span className="truncate">💬 <b>ข้อ:</b> {photo.issueItem}</span>
                      <button 
                        type="button"
                        onClick={() => {
                          const cap = (recordCaps || []).find(c => c.id === photo.capId);
                          if (cap) {
                            setSelectedCapTask({
                              ...cap,
                              unit: currentRecord.location?.name || locationTitle || unitName,
                              locationName: currentRecord.location?.name || locationTitle || unitName,
                              title: cap.issueItem,
                              desc: cap.description || "-"
                            });
                          }
                        }}
                        className="text-[11px] text-[#0F6659] underline font-bold shrink-0 ml-2 cursor-pointer hover:text-[#0B4E44]"
                      >
                        ติดตามงาน CAP ➔
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 rounded-2xl bg-slate-50 border border-dashed text-center text-xs text-slate-400 font-medium">
                {!passed || (recordCaps && recordCaps.length > 0)
                  ? "ยังไม่มีการส่งรูปถ่ายหลักฐานการแก้ไข" 
                  : "รอบการตรวจนี้ผ่านเกณฑ์มาตรฐานครบถ้วน ไม่จำเป็นต้องส่งรูปแก้งาน"}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: SIGNATURES & ACKNOWLEDGEMENT */}
      {activeTab === "sign" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* 🌟 หมวดหมู่: สรุป (Audit Conclusion & Overall Remarks) - วางก่อนลายเซ็น */}
          {(isEditing || Boolean(currentRecord.notes && currentRecord.notes.trim())) && (
            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-emerald-50 text-[#0F6659] border border-emerald-200/60 flex items-center justify-center shrink-0">
                  <FileText size={15} />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-extrabold text-slate-800">หมวดหมู่: สรุป</h3>
                  <p className="text-[11px] font-medium text-slate-500">สรุปผลการตรวจประเมิน ข้อสังเกต หรือข้อเสนอแนะภาพรวม</p>
                </div>
              </div>
              {isEditing ? (
                <textarea
                  value={editGeneralNotes}
                  onChange={(e) => setEditGeneralNotes(e.target.value)}
                  placeholder="ระบุสรุปผลการตรวจประเมิน ข้อสังเกต หรือข้อเสนอแนะภาพรวม..."
                  rows={5}
                  className="w-full p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800 font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0F6659]"
                />
              ) : (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-xs sm:text-sm text-slate-700 font-medium whitespace-pre-wrap leading-relaxed">
                  {currentRecord.notes}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Inspector Signature */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2.5">
              <div className="text-xs font-bold text-slate-500">ผู้ตรวจประเมิน</div>
              <div className="h-28 rounded-xl bg-slate-50 border border-dashed border-slate-200 flex flex-col items-center justify-center p-2 text-center overflow-hidden">
                {(isEditing ? editAuditorSignature : (currentRecord.auditorSignatureUrl || currentRecord.auditorSignature)) ? (
                  <img
                    src={getFullImageUrl(isEditing ? editAuditorSignature : (currentRecord.auditorSignatureUrl || currentRecord.auditorSignature))}
                    alt="ลายเซ็นผู้ตรวจประเมิน"
                    className="max-h-20 object-contain mx-auto"
                  />
                ) : (
                  <>
                    <span className="font-serif italic text-base sm:text-lg text-emerald-800 font-bold leading-tight">{auditorName}</span>
                    <span className="text-[11px] text-slate-400 font-medium mt-1">{dateStr}</span>
                  </>
                )}
              </div>
              {isEditing ? (
                <button
                  type="button"
                  onClick={() => setActiveSignModal("auditor")}
                  className="w-full py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-[#0F6659] border border-emerald-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
                >
                  <PenTool size={13} />
                  <span>{editAuditorSignature ? "แก้ไขลายเซ็น" : "เซ็นชื่อผู้ตรวจ"}</span>
                </button>
              ) : (
                <div className="text-xs text-center font-bold text-emerald-700">
                  ✓ ยืนยันผลตรวจแล้ว
                </div>
              )}
            </div>

            {/* Store Manager Signature */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2.5">
              <div className="text-xs font-bold text-slate-500">ผู้จัดการสาขา (ผู้รับตรวจ)</div>
              <div className="h-28 rounded-xl bg-slate-50 border border-dashed border-slate-200 flex flex-col items-center justify-center p-2 text-center overflow-hidden">
                {(isEditing ? editAuditeeSignature : (currentRecord.auditeeSignatureUrl || currentRecord.auditeeSignature)) ? (
                  <img
                    src={getFullImageUrl(isEditing ? editAuditeeSignature : (currentRecord.auditeeSignatureUrl || currentRecord.auditeeSignature))}
                    alt="ลายเซ็นผู้จัดการสาขา"
                    className="max-h-20 object-contain mx-auto"
                  />
                ) : (
                  <>
                    <span className="font-serif italic text-base sm:text-lg text-slate-800 font-bold leading-tight">{managerName}</span>
                    <span className="text-[11px] text-slate-400 font-medium mt-1">{dateStr} · พนักงาน {staffCount} คน</span>
                  </>
                )}
              </div>
              {isEditing ? (
                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500">ชื่อผู้จัดการสาขา / ผู้รับตรวจ</label>
                    <input
                      type="text"
                      value={editAuditeeNameText}
                      onChange={(e) => setEditAuditeeNameText(e.target.value)}
                      placeholder="ชื่อ-นามสกุล ผู้จัดการสาขา / ผู้รับตรวจ"
                      className="w-full text-xs p-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0F6659] font-medium text-slate-800"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSignModal("auditee")}
                    className="w-full py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-[#0F6659] border border-emerald-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
                  >
                    <PenTool size={13} />
                    <span>{editAuditeeSignature ? "แก้ไขลายเซ็น" : "เซ็นชื่อผู้รับตรวจ"}</span>
                  </button>
                </div>
              ) : (
                <div className="text-xs text-center font-bold text-emerald-700">
                  ✓ ลงนามรับทราบแล้ว
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: GPS LOCATION & GEOFENCE VERIFICATION (ตำแหน่งพิกัดการตรวจ) */}
      {activeTab === "location" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* 🗺️ DUAL MAP GRID: จุดเริ่มตรวจ + จุดส่งผลตรวจ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 🟢 MAP 1: จุดเริ่มตรวจ (Start Location) */}
            <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="text-xs font-black text-slate-800 flex items-center gap-1.5 flex-wrap">
                    <span>1. จุดเริ่มตรวจ (Start Inspection)</span>
                    {(!displayStartLat || !displayStartLng) && (
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-800">
                        ก่อนตรวจไม่บันทึก
                      </span>
                    )}
                  </div>
                  <div className="text-[11.5px] text-slate-500 font-medium space-y-0.5">
                    <div>เวลาเริ่ม: <span className="font-bold text-slate-700">{startedTimeStr}</span></div>
                    {displayStartLat && displayStartLng && (
                      <div>พิกัด: <span className="font-bold text-slate-700 font-mono">{`${Number(displayStartLat).toFixed(6)}, ${Number(displayStartLng).toFixed(6)}`}</span></div>
                    )}
                  </div>
                </div>
                {displayStartLat && displayStartLng ? (
                  <a
                    href={`https://www.google.com/maps?q=${displayStartLat},${displayStartLng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-bold border border-slate-200 shrink-0 flex items-center gap-1 transition-all shadow-2xs"
                    title="เปิดใน Google Maps"
                  >
                    <span>Google Maps</span>
                    <ExternalLink size={11} />
                  </a>
                ) : null}
              </div>

              {/* Map 1 Iframe Embed */}
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-inner bg-slate-100 h-60 sm:h-64 flex items-center justify-center">
                {displayStartLat && displayStartLng ? (
                  <iframe
                    title="Start Location Map"
                    width="100%"
                    height="100%"
                    loading="lazy"
                    allowFullScreen
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://maps.google.com/maps?q=${displayStartLat},${displayStartLng}&hl=th&z=16&output=embed`}
                    className="w-full h-full block border-0"
                  />
                ) : (
                  <div className="text-center p-6 text-slate-400 space-y-1.5">
                    <MapPin size={28} className="mx-auto text-slate-300" />
                    <div className="text-xs sm:text-sm font-bold text-slate-600">ก่อนตรวจไม่บันทึก</div>
                  </div>
                )}
              </div>

              {/* 📍 ส่วนแก้ไขพิกัดจุดเริ่มตรวจ (ละติจูด, ลองติจูด, ดึง GPS) */}
              {isEditing && (
                <div className="pt-2.5 border-t border-slate-100 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">แก้ไขพิกัดเริ่มตรวจ</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => fetchCurrentCoordinates("start")}
                        disabled={isFetchingStartGps}
                        className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-emerald-50 hover:bg-emerald-100 text-[#0F6659] border border-emerald-200 flex items-center gap-1 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                      >
                        {isFetchingStartGps ? <Loader2 size={11} className="animate-spin" /> : <Navigation size={11} />}
                        <span>ดึงพิกัด GPS</span>
                      </button>
                      {(editStartLatitude || editStartLongitude) && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditStartLatitude("");
                            setEditStartLongitude("");
                          }}
                          className="px-2 py-1 rounded-xl text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all cursor-pointer"
                        >
                          ล้างพิกัด
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500">ละติจูด (Latitude)</label>
                      <input
                        type="text"
                        value={editStartLatitude}
                        onChange={(e) => setEditStartLatitude(e.target.value)}
                        placeholder="เช่น 13.756331"
                        className="w-full text-xs p-2 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0F6659] font-mono font-bold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500">ลองจิจูด (Longitude)</label>
                      <input
                        type="text"
                        value={editStartLongitude}
                        onChange={(e) => setEditStartLongitude(e.target.value)}
                        placeholder="เช่น 100.501762"
                        className="w-full text-xs p-2 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0F6659] font-mono font-bold text-slate-800"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 🔵 MAP 2: จุดส่งผลตรวจ (Submit Location) */}
            <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="text-xs font-black text-slate-800 flex items-center gap-1.5 flex-wrap">
                    <span>2. จุดส่งผลตรวจ (Submit Inspection)</span>
                    {(!displayEndLat || !displayEndLng) && (
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-800">
                        หลังตรวจไม่บันทึก
                      </span>
                    )}
                  </div>
                  <div className="text-[11.5px] text-slate-500 font-medium space-y-0.5">
                    <div>เวลาส่งผล: <span className="font-bold text-slate-700">{submittedTimeStr}</span></div>
                    {displayEndLat && displayEndLng && (
                      <div>พิกัด: <span className="font-bold text-slate-700 font-mono">{`${Number(displayEndLat).toFixed(6)}, ${Number(displayEndLng).toFixed(6)}`}</span></div>
                    )}
                  </div>
                </div>
                {displayEndLat && displayEndLng ? (
                  <a
                    href={`https://www.google.com/maps?q=${displayEndLat},${displayEndLng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-bold border border-slate-200 shrink-0 flex items-center gap-1 transition-all shadow-2xs"
                    title="เปิดใน Google Maps"
                  >
                    <span>Google Maps</span>
                    <ExternalLink size={11} />
                  </a>
                ) : null}
              </div>

              {/* Map 2 Iframe Embed */}
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-inner bg-slate-100 h-60 sm:h-64 flex items-center justify-center">
                {displayEndLat && displayEndLng ? (
                  <iframe
                    title="Submit Location Map"
                    width="100%"
                    height="100%"
                    loading="lazy"
                    allowFullScreen
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://maps.google.com/maps?q=${displayEndLat},${displayEndLng}&hl=th&z=16&output=embed`}
                    className="w-full h-full block border-0"
                  />
                ) : (
                  <div className="text-center p-6 text-slate-400 space-y-1.5">
                    <MapPin size={28} className="mx-auto text-slate-300" />
                    <div className="text-xs sm:text-sm font-bold text-slate-600">หลังตรวจไม่บันทึก</div>
                  </div>
                )}
              </div>

              {/* 📍 ส่วนแก้ไขพิกัดจุดส่งผลตรวจ (ละติจูด, ลองติจูด, ดึง GPS) */}
              {isEditing && (
                <div className="pt-2.5 border-t border-slate-100 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">แก้ไขพิกัดส่งผลตรวจ</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => fetchCurrentCoordinates("end")}
                        disabled={isFetchingEndGps}
                        className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-emerald-50 hover:bg-emerald-100 text-[#0F6659] border border-emerald-200 flex items-center gap-1 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                      >
                        {isFetchingEndGps ? <Loader2 size={11} className="animate-spin" /> : <Navigation size={11} />}
                        <span>ดึงพิกัด GPS</span>
                      </button>
                      {(editEndLatitude || editEndLongitude) && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditEndLatitude("");
                            setEditEndLongitude("");
                          }}
                          className="px-2 py-1 rounded-xl text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all cursor-pointer"
                        >
                          ล้างพิกัด
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500">ละติจูด (Latitude)</label>
                      <input
                        type="text"
                        value={editEndLatitude}
                        onChange={(e) => setEditEndLatitude(e.target.value)}
                        placeholder="เช่น 13.756331"
                        className="w-full text-xs p-2 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0F6659] font-mono font-bold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500">ลองจิจูด (Longitude)</label>
                      <input
                        type="text"
                        value={editEndLongitude}
                        onChange={(e) => setEditEndLongitude(e.target.value)}
                        placeholder="เช่น 100.501762"
                        className="w-full text-xs p-2 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0F6659] font-mono font-bold text-slate-800"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 🌟 AUDIT EDIT LOGS MODAL (ประวัติการแก้ไข) */}
      <AuditEditLogsModal
        isOpen={showEditLogsModal}
        onClose={() => setShowEditLogsModal(false)}
        auditRecordId={currentRecord?.id}
        auditRecord={currentRecord}
        questions={allChecklistQuestions}
      />

      {/* 🌟 AI DEFECT ANALYSIS MODAL (วิเคราะห์ข้อบกพร่องด้วย AI) */}
      {showAiDefectModal && (
        <AiAuditDefectModal
          auditRecordId={currentRecord?.id}
          onClose={() => setShowAiDefectModal(false)}
        />
      )}

      {/* 🌟 CONFIRM SAVE INLINE EDIT MODAL */}
      {showConfirmSaveModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 p-5 sm:p-6 space-y-4 animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-[#0F6659] flex items-center justify-center shrink-0">
                  <Save size={18} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-800">ยืนยันการบันทึกการแก้ไข</h3>
                  <p className="text-xs text-slate-500 font-medium">บันทึกการปรับปรุงข้อมูลและคะแนนรอบการตรวจ</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmSaveModal(false)}
                disabled={isSaving}
                className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Change Summary */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">ข้อที่มีการปรับคะแนน:</span>
                <span className="font-bold text-slate-900">{changedQuestionsCount} ข้อ</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">คะแนนเดิม ➔ คะแนนใหม่:</span>
                <div className="flex items-center gap-1.5 font-mono font-bold">
                  <span className="line-through text-slate-400">{parseFloat(Number(score).toFixed(2))}%</span>
                  <span>➔</span>
                  <span className={displayPassed ? 'text-[#0F6659]' : 'text-rose-600'}>
                    {parseFloat(Number(displayScore).toFixed(2))}%
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">ผลการตรวจใหม่:</span>
                <span className={`font-bold px-2.5 py-0.5 rounded-full text-[11px] ${
                  displayPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {displayPassed ? 'ผ่านเกณฑ์มาตรฐาน' : 'ไม่ผ่านเกณฑ์'}
                </span>
              </div>
            </div>

            {/* Audit Times: startedAt & submittedAt */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Clock size={13} className="text-[#0F6659]" />
                  <span>เวลาเริ่มตรวจ</span>
                </label>
                <input
                  type="datetime-local"
                  value={editStartedAt}
                  onChange={(e) => setEditStartedAt(e.target.value)}
                  className="w-full text-xs p-2 rounded-xl bg-white border border-slate-200 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0F6659] text-slate-800 font-semibold shadow-2xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Clock size={13} className="text-[#0F6659]" />
                  <span>เวลาสิ้นสุดการตรวจ</span>
                </label>
                <input
                  type="datetime-local"
                  value={editSubmittedAt}
                  onChange={(e) => setEditSubmittedAt(e.target.value)}
                  className="w-full text-xs p-2 rounded-xl bg-white border border-slate-200 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0F6659] text-slate-800 font-semibold shadow-2xs"
                />
              </div>
            </div>

            {/* Required overall reason */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <span>เหตุผลภาพรวมในการแก้ไขรอบตรวจนี้ (จำเป็น)</span>
                <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={overallReason}
                onChange={(e) => setOverallReason(e.target.value)}
                placeholder="ระบุเหตุผล เช่น ทบทวนหลักฐานเพิ่มเติม, แก้ไขจำนวนพนักงาน, ปรับปรุงรูปถ่าย..."
                rows={3}
                className="w-full text-xs p-3 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0F6659] text-slate-800 font-medium"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowConfirmSaveModal(false)}
                disabled={isSaving}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmSave}
                disabled={isSaving || !overallReason.trim()}
                className="px-4 py-2 rounded-xl bg-[#0F6659] hover:bg-[#0c5247] text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                <span>{isSaving ? "กำลังบันทึก…" : "ยืนยันและบันทึก"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✍️ DIGITAL SIGNATURE PAD MODAL */}
      {activeSignModal && (
        <SignaturePadModal
          title={activeSignModal === "auditor" ? "ลงลายมือชื่อผู้ตรวจประเมิน" : "ลงลายมือชื่อผู้จัดการสาขา (ผู้รับตรวจ)"}
          initialSignatureUrl={activeSignModal === "auditor" ? editAuditorSignature : editAuditeeSignature}
          onDone={(dataUrl) => {
            if (activeSignModal === "auditor") setEditAuditorSignature(dataUrl);
            if (activeSignModal === "auditee") setEditAuditeeSignature(dataUrl);
            setActiveSignModal(null);
          }}
          onCancel={() => setActiveSignModal(null)}
        />
      )}

      {/* 🖼️ PREVIEW EDIT PHOTO MODAL */}
      {previewEditPhoto && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-3 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setPreviewEditPhoto(null)}
        >
          <div className="relative max-w-2xl max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <img
              src={previewEditPhoto}
              alt="ตัวอย่างรูปภาพ"
              className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl"
            />
            <button
              type="button"
              onClick={() => setPreviewEditPhoto(null)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center cursor-pointer shadow-lg"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* 🌟 REOPEN CONFIRMATION MODAL */}
      {showReopenModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 p-5 sm:p-6 space-y-4 animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                  <RotateCcw size={20} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-800 leading-tight">ย้อนสถานะผลตรวจเป็นแบบร่าง</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    รหัส <span className="font-mono font-bold text-slate-700">#{currentRecord?.documentNo || currentRecord?.id}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isReopening && setShowReopenModal(false)}
                disabled={isReopening}
                className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer transition-colors disabled:opacity-50"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-3.5 bg-amber-50/80 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-1.5">
              <p className="font-bold text-amber-950">คำแนะนำและผลกระทบ:</p>
              <ul className="list-disc pl-4 space-y-1 text-slate-700">
                <li>ผลตรวจปัจจุบันจะไม่ถูกนับในรายงานหรือคะแนนสาขา</li>
                <li>ข้อมูลคำตอบจะถูกคัดลอกไปยังแบบร่าง</li>
                <li>หากกดยกเลิกแบบร่างในภายหลัง ผลตรวจเดิมนี้จะกลับมาเป็นปกติ</li>
              </ul>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                เหตุผลในการย้อนสถานะ <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={reopenReason}
                onChange={(e) => {
                  setReopenReason(e.target.value);
                  if (reopenError) setReopenError("");
                }}
                placeholder="ระบุเหตุผล เช่น พบข้อผิดพลาดในข้อมูล, ต้องการตรวจซ่อมแซม, รูปภาพไม่สมบูรณ์..."
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0F6659]/30 focus:border-[#0F6659] resize-none"
                disabled={isReopening}
              />
              <div className="flex justify-between items-center mt-1 text-[11px]">
                <span className="text-rose-500 font-medium">{reopenError}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowReopenModal(false)}
                disabled={isReopening}
                className="px-4 py-2 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmReopen}
                disabled={isReopening || !reopenReason.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isReopening ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                <span>{isReopening ? "กำลังดำเนินการ..." : "ยืนยันย้อนสถานะ"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 Category Navigation Drawer (เลือกเลื่อนดูหมวดหมู่) */}
      {isCategoryDrawerOpen && typeof document !== "undefined" && createPortal(
        <HistoryCategoryNavigationDrawer
          onClose={() => setIsCategoryDrawerOpen(false)}
          categoryItems={categoryItems}
          activeSectionIdx={activeSectionIndex}
          onSelectCategory={jumpToCategory}
        />,
        document.body
      )}

      {/* 🌟 Floating Action Controls มุมขวาล่าง (ปุ่มเลื่อนขึ้นบนสุด และ ปุ่มยกเลิก/บันทึกเมื่ออยู่ในโหมดแก้ไขผลตรวจ) */}
      {typeof document !== "undefined" && createPortal(
        <div className="fixed bottom-7 right-5 sm:bottom-9 sm:right-8 z-50 flex flex-col items-end gap-3 select-none">
          {/* 1. ปุ่มเลื่อนขึ้นบนสุด (อนิเมชัน Fade-in / Fade-out + Slide แบบนุ่มนวล) */}
          <button
            type="button"
            onClick={() => {
              window.scrollTo({ top: 0, behavior: "smooth" });
              const mainEl = document.querySelector('main');
              if (mainEl) mainEl.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className={`w-14 h-14 sm:w-14 sm:h-14 rounded-full bg-white hover:bg-slate-50 text-slate-700 shadow-xl border border-slate-200/80 flex items-center justify-center cursor-pointer transition-all duration-300 ease-out active:scale-90 ${
              isScrolled
                ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
                : "opacity-0 scale-75 translate-y-3 pointer-events-none"
            }`}
            title="เลื่อนขึ้นบนสุดของหน้า"
            aria-label="เลื่อนขึ้นบนสุดของหน้า"
          >
            <ChevronUp size={34} strokeWidth={2.8} />
          </button>

          {/* 2. แถวปุ่มแอ็กชัน (แสดงเฉพาะเมื่ออยู่ในโหมดแก้ไข: ยกเลิก / บันทึกการแก้ไข) */}
          {isEditing && (
            <div className="flex items-center gap-3 animate-in fade-in zoom-in-95 duration-200">
              {/* ปุ่มยกเลิกการแก้ไข (สีขาว กากบาทสีแดง) */}
              <div className="relative w-14 h-14 sm:w-14 sm:h-14 shrink-0">
                <button
                  type="button"
                  onClick={handleCancelEditMode}
                  disabled={isSaving}
                  className="w-14 h-14 sm:w-14 sm:h-14 rounded-full bg-white hover:bg-rose-50 text-rose-600 shadow-xl border border-rose-200 flex items-center justify-center cursor-pointer transition-all duration-300 active:scale-90 disabled:opacity-50"
                  title="ยกเลิกการแก้ไข (ไม่บันทึก)"
                  aria-label="ยกเลิกการแก้ไข"
                >
                  <X size={28} strokeWidth={2.8} />
                </button>
              </div>

              {/* ปุ่มบันทึกการแก้ไข (สีเขียวเข้ม #0F6659) */}
              <div className="relative w-14 h-14 sm:w-14 sm:h-14 shrink-0">
                <button
                  type="button"
                  onClick={!isSaving ? handleTriggerSave : undefined}
                  disabled={isSaving}
                  className={`w-14 h-14 sm:w-14 sm:h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 select-none border touch-manipulation active:scale-95 cursor-pointer shadow-md ${
                    isSaving
                      ? "cursor-wait opacity-90 bg-[#0F6659] text-white border-emerald-600"
                      : "bg-[#0F6659] hover:bg-[#0c5247] text-white border-emerald-600"
                  }`}
                  title={isSaving ? "กำลังบันทึกข้อมูล..." : "บันทึกการแก้ไข"}
                  aria-label="บันทึกการแก้ไข"
                >
                  <span className="relative w-6 h-6 inline-grid place-items-center">
                    <Loader2
                      size={22}
                      className={`col-start-1 row-start-1 animate-spin text-white transition-all duration-200 ${
                        isSaving ? "opacity-100 scale-100" : "opacity-0 scale-50 pointer-events-none"
                      }`}
                    />
                    <Save
                      size={28}
                      strokeWidth={2.8}
                      className={`col-start-1 row-start-1 text-white transition-all duration-200 ${
                        !isSaving ? "opacity-100 scale-100" : "opacity-0 scale-50 pointer-events-none"
                      }`}
                    />
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}