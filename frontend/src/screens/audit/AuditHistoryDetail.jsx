import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { List, ClipboardCheck, Store, MapPin, Camera, CheckCircle2, XCircle, PenTool, Check, MessageSquare, Edit3, Megaphone, X, Maximize2, CheckCheck, ExternalLink, AlertTriangle, SlidersHorizontal, BarChart3, Wrench, Minus, History, ChevronRight, ChevronDown, ChevronUp, FileText, Calendar, User, FileSpreadsheet, Sparkles, Table } from "lucide-react";


import { c, sans, mono, cardStyle } from "../../config/theme";
import { TODAY, AUDIT_TYPES, AUDIT_TYPE_META, CAP_STATUS_MAP, REGION_LINES, BRAND_LINES, CATEGORY_DISPLAY_MAP, getCategoryDisplay } from "../../config/constants";
import { TopBarContext } from "../../context/TopBarContext";
import { DataContext } from "../../context/DataContext";
import { exportAuditReportToExcel, formatBkk } from "../../utils/exportAuditReport";
import api, { getFullImageUrl } from "../../config/api";

import ModalWrapper from "../../shared/ModalWrapper";
import Header from "../../shared/Header";
import Section from "../../shared/Section";
import ScoreRing from "../../shared/ScoreRing";
import HistoryList from "../../shared/HistoryList";
import ErrorBoundary from "../../shared/ErrorBoundary";
import CapDetailScreen from "../cap/CapDetailScreen";
import AuditEditLogsModal from "../../modals/AuditEditLogsModal";
import EditAuditRecordModal from "../../modals/EditAuditRecordModal";
import AiAuditDefectModal from "../../modals/AiAuditDefectModal";
import DynamicFieldRenderer from "../../shared/DynamicFieldRenderer";

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
// แสดงผลเป็นตารางเต็มรูปแบบเหมือนตอนตรวจ (DynamicFieldRenderer type="grid" readOnly)
// โดยตั้งค่าเริ่มต้นให้ซ่อนไว้ เพื่อให้ผู้ใช้กดเปิดดูเองตามต้องการ
function CollapsibleGridTable({ label, fieldConfig, value, defaultOpen = false, className = "" }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

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
      isOpen ? "bg-white border-[#0F6659]/40 shadow-sm" : "bg-slate-50/90 border-slate-200 hover:border-[#0F6659]/40 hover:bg-slate-50"
    } ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="w-full p-3 sm:p-3.5 flex items-center justify-between text-left cursor-pointer transition-colors select-none group"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all ${
            isOpen ? "bg-[#0F6659] text-white shadow-2xs" : "bg-white text-[#0F6659] border border-slate-200/90 shadow-2xs group-hover:border-[#0F6659]/50"
          }`}>
            <Table size={15} />
          </div>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-extrabold text-slate-800 truncate">
              {label || "ตารางข้อมูล"}
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
            {isOpen ? "ซ่อนตาราง" : "เปิดดูตาราง"}
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
            readOnly={true}
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

  return "Product";
};

// 🌟 สรุปสถิติคะแนน/การผ่านของหมวดหมู่
export const getSectionStats = (sec) => {
  const isInfo = sec?.sectionType === "INFO" || (sec?.questions && sec.questions.length > 0 && sec.questions.every(q => q.isScored === false));
  const scoredQuestions = (sec?.questions || []).filter(q => q.isScored !== false && !["grid","number","select","radio","checkbox","text","date","time","auditor"].includes(q.type || q.questionType));
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

export default function AuditHistoryDetail({ unitName, record = {}, onBack }) {
  const { locations: allLocations, forms = [], getFormDetail, currentUser, refreshData } = React.useContext(DataContext);
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
        fullScore: q.fullScore || existing.fullScore || 10
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
  const canEditAudit = currentUser?.role === "ADMIN" || currentUser?.roleCode === "ADMIN" || (currentUser?.permissions || []).includes("audit.edit");
  const [editLogsCount, setEditLogsCount] = useState(0);
  const [showEditLogsModal, setShowEditLogsModal] = useState(false);
  const [showEditFormModal, setShowEditFormModal] = useState(false);
  const [showAiDefectModal, setShowAiDefectModal] = useState(false);

  const fetchEditLogs = () => {
    if (!currentRecord?.id) return;
    api.get(`/audit/${currentRecord.id}/edit-logs`)
      .then(res => {
        if (Array.isArray(res.data)) {
          setEditLogsCount(res.data.length);
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
  const passingScore = currentRecord.passingScore || currentRecord.surveyForm?.passingScore || 85;
  const dateStr = currentRecord.date || (currentRecord.auditDate ? new Date(currentRecord.auditDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) : "-");
  const actualInspectDateStr = currentRecord.startedAt ? new Date(currentRecord.startedAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) : dateStr;
  const createdDateStr = currentRecord.createdAt ? new Date(currentRecord.createdAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;
  const auditorName = currentRecord.auditor || currentRecord.auditorName || currentRecord.primaryAuditor?.fullName || "-";
  const formTitle = currentRecord.form || currentRecord.formName || currentRecord.surveyFormTitle || currentRecord.surveyForm?.title || "-";
  const passed = currentRecord.isPassed !== undefined ? currentRecord.isPassed : (score >= passingScore && !currentRecord.hasCriticalDefect);
  const hasCritical = currentRecord.hasCriticalDefect || (currentRecord.responses && currentRecord.responses.some(r => r.isCritical && !r.isPassed));
  const locationTitle = unitName || currentRecord.unitFullName || currentRecord.locationName || currentRecord.location?.name || "-";
  const managerName = currentRecord.auditeeName || currentRecord.auditeeUser?.fullName || "-";
  const staffCount = currentRecord.staffCount || 0;
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

        const resolvedType = f.type || matchedMeta?.type || (matchedMeta?.fieldConfig?.columns ? "grid" : "text");
        const resolvedFieldConfig = f.fieldConfig || matchedMeta?.fieldConfig || (matchedMeta ? { options: matchedMeta.options, columns: matchedMeta.columns, rows: matchedMeta.rows } : null);

        return {
          id: f.id || `field_${idx}`,
          label: f.label || matchedMeta?.label || (f.id ? f.id.replace(/^meta_/, '').replace(/_/g, ' ') : `ข้อมูลที่ ${idx + 1}`),
          value: displayVal,
          rawValue: f.value,
          type: resolvedType,
          fieldConfig: resolvedFieldConfig,
          unit: f.unit ? (f.unit.startsWith(" ") ? f.unit : ` ${f.unit}`) : ""
        };
      });
    }

    // 2. กรณีประวัติเก่าที่ยังไม่มี _fields: ดึง schema จาก form config มาจับคู่
    const defaultSystemConfig = [
      { id: "auditor", label: "ผู้ตรวจประเมิน (Auditor)", type: "auditor", enabled: true, isSystem: true },
      { id: "audit_type", label: "ประเภทการตรวจ (Audit Type)", type: "select", enabled: true, isSystem: true },
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
          const displayVal = typeof val === "boolean" 
            ? (val ? "✓ ใช่ (Yes)" : "ไม่ใช่ (No)")
            : String(val);
          list.push({
            id: field.id,
            label: field.label || field.placeholder || field.id.replace(/^meta_/, '').replace(/_/g, ' '),
            value: displayVal,
            rawValue: val,
            type: field.type || (field.fieldConfig?.columns ? "grid" : "text"),
            fieldConfig: field.fieldConfig || { options: field.options, columns: field.columns, rows: field.rows },
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
        list.push({
          id: k,
          label: finalLabel,
          value: typeof v === "boolean" ? (v ? "✓ ใช่ (Yes)" : "ไม่ใช่ (No)") : String(v),
          rawValue: v,
          type: finalType,
          fieldConfig: finalConfig,
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
            // Find corresponding response
            let res = currentRecord.responses.find(r => 
              (r.surveyItemId && Number(r.surveyItemId) === Number(item.id)) ||
              (r.surveyItem?.id && Number(r.surveyItem.id) === Number(item.id)) ||
              (r.questionText && item.questionText && r.questionText.trim().toLowerCase() === item.questionText.trim().toLowerCase()) ||
              (r.questionText && item.text && r.questionText.trim().toLowerCase() === item.text.trim().toLowerCase()) ||
              (r.surveyItem?.questionText && item.questionText && r.surveyItem.questionText.trim().toLowerCase() === item.questionText.trim().toLowerCase()) ||
              (r.surveyItem?.questionText && item.text && r.surveyItem.questionText.trim().toLowerCase() === item.text.trim().toLowerCase())
            );

            res = res || {};

            const qText = item.questionText || item.text || res.questionText || `ข้อตรวจที่ ${runningNum}`;
            const qType = (res.questionType || item.questionType || item.type || "YESNO").toLowerCase();
            const isNonScored = (sec.sectionType === "INFO") || item.isScored === false || ["grid","number","select","radio","checkbox","text","date","time","auditor"].includes(qType);
            const fullSc = isNonScored ? 0 : (res.fullScore !== undefined ? res.fullScore : (item.fullScore || 10));
            const isCrit = !isNonScored && (res.isCritical !== undefined ? res.isCritical : (item.isCritical || item.critical || false));
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
                          ? (calculatedScaleScore !== null ? calculatedScaleScore >= 3 : (res.scoreGiven !== undefined ? res.scoreGiven >= (fullSc * 0.6) : true))
                          : (res.scoreGiven > 0))));

            const calculatedScore = isNonScored ? 0 : (isNa ? 0 : (res.scoreGiven !== undefined ? res.scoreGiven : (isPass ? fullSc : 0)));

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
              text: qText,
              type: qType,
              questionType: qType,
              isScored: !isNonScored,
              fieldConfig: item.fieldConfig || res.fieldConfig || res.surveyItem?.fieldConfig,
              rawAnswer: resolvedRawAnswer,
              answer: qType === "scale"
                ? (calculatedScaleScore !== null ? calculatedScaleScore : (res.scoreGiven !== undefined ? res.scoreGiven : (isPass ? 5 : 3)))
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
              hasPhoto: (res.images && res.images.length > 0) || (!isPass && !isNa && res.hasPhoto),
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
        const isNonScored = res.isScored === false || res.surveyItem?.isScored === false || ["grid","number","select","radio","checkbox","text","date","time","auditor"].includes(qType);
        const isCrit = !isNonScored && (res.isCritical !== undefined ? res.isCritical : (res.surveyItem?.isCritical || false));
        const fullSc = isNonScored ? 0 : (res.fullScore !== undefined ? res.fullScore : (res.surveyItem?.fullScore || 10));
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
                      ? (calculatedScaleScore !== null ? calculatedScaleScore >= 3 : (res.scoreGiven !== undefined ? res.scoreGiven >= (fullSc * 0.6) : true))
                      : (res.scoreGiven > 0))));

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
          text: qText,
          type: qType,
          questionType: qType,
          isScored: !isNonScored,
          fieldConfig: res.fieldConfig || res.surveyItem?.fieldConfig,
          rawAnswer: resolvedRawAnswer,
          answer: qType === "scale"
            ? (calculatedScaleScore !== null ? calculatedScaleScore : (res.scoreGiven !== undefined ? res.scoreGiven : (isPass ? 5 : 3)))
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

  // 📊 Calculated Category Scores Breakdown (จัดกลุ่มตามหมวดหมู่คะแนน ไม่ใช่หมวดหมู่คำถาม)
  const categoryScores = useMemo(() => {
    const catMap = new Map();

    formBreakdown.forEach(sec => {
      (sec.questions || []).forEach(q => {
        if (q.isScored === false || ["grid","number","select","radio","checkbox","text","date","time","auditor"].includes(q.type || q.questionType)) {
          return;
        }
        const catName = getQuestionCategory(q, sec);
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

        if (q.isNa) {
          return; // Fair scoring: N/A questions excluded from max
        }

        const full = Number(q.fullScore) || 10;
        catData.max += full;

        if (q.scoreGiven !== undefined) {
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

    // Sort according to CORE_CATEGORY_ORDER
    categories.sort((a, b) => {
      const idxA = CORE_CATEGORY_ORDER.indexOf(a.title);
      const idxB = CORE_CATEGORY_ORDER.indexOf(b.title);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.title.localeCompare(b.title, "th");
    });

    return categories;
  }, [formBreakdown]);

  // 📤 ส่งออกรายงานรายรอบตรวจเป็น Excel (ใช้ข้อมูลชุดเดียวกับที่แสดงบนหน้าจอ: formBreakdown / allDisplayMetadataFields)
  const [isExportingReport, setIsExportingReport] = useState(false);
  const handleExportReport = async () => {
    if (isExportingReport) return;
    setIsExportingReport(true);
    try {
      const recId = currentRecord?.id || record?.id;
      const typeName = matchedLocation?.locationType?.name || currentRecord.location?.locationType?.name || "-";
      await exportAuditReportToExcel({
        record: currentRecord,
        sections: formBreakdown,
        metaFields: allDisplayMetadataFields,
        passingScore,
        categoryOf: getQuestionCategory,
        toFullUrl: getFullImageUrl,
        signatureUrls: {
          auditor: currentRecord.auditorSignatureUrl || currentRecord.auditorSignature,
          auditee: currentRecord.auditeeSignatureUrl || currentRecord.auditeeSignature
        },
        header: {
          reportNo: `QSC-${String(recId || 0).padStart(6, "0")}`,
          issuedAt: formatBkk(new Date(), false).slice(0, 10),
          locationCode: currentRecord.locationCode || matchedLocation?.code || "",
          location: `${currentRecord.locationCode || matchedLocation?.code || ""} ${locationTitle}`.trim(),
          brandType: `${currentRecord.locationBrand || "-"} / ${typeName}`,
          form: formTitle,
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
        if (q.isScored === false || ["grid","number","select","radio","checkbox","text","date","time","auditor"].includes(q.type || q.questionType)) return;
        if (q.isNa) return;

        const full = Number(q.fullScore) || 10;
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
          const full = Number(q.fullScore) || 10;
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

  // Header action buttons (แสดงปุ่มแก้ไขผลตรวจเมื่อมีสิทธิ์)
  const headerAction = useMemo(() => (
    <div className="flex items-center gap-2">
      {canEditAudit && (
        <button
          type="button"
          onClick={() => setShowEditFormModal(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white hover:bg-emerald-50 text-slate-700 hover:text-[#0F6659] border border-slate-200 text-xs font-bold shadow-2xs transition-all active:scale-95 cursor-pointer group"
          title="แก้ไขผลการตรวจ (ต้องระบุเหตุผล)"
        >
          <Edit3 size={13} className="text-[#0F6659] group-hover:scale-110 transition-transform" />
          <span>แก้ไขผลตรวจ</span>
        </button>
      )}
    </div>
  ), [canEditAudit]);

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
    : "รายละเอียดผลการตรวจ";

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
    <div className="page-transition p-4 sm:p-6 space-y-4 w-full max-w-[100%] sm:max-w-[96%] md:max-w-[92%] mx-auto pb-12">
      <Header 
        title={currentHeaderTitle}
        subtitle={currentHeaderSubtitle}
        sectionBadgeNumber={currentHeaderBadge}
        leftActionType={currentLeftActionType}
        onMenuClick={() => setIsCategoryDrawerOpen(true)}
        onBack={onBack}
        action={headerAction}
      />
      
      {/* 🌟 1. ALL-IN-ONE SLEEK HERO SUMMARY CARD (ตรงตามแบบ Mockup) */}
      <div className="rounded-3xl p-5 sm:p-6 bg-white border border-slate-200/90 shadow-2xs space-y-4">
        {/* Top Section: Score Ring, Numbers, Status Pill, and Export Excel Button */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4 sm:gap-5 min-w-0">
            {/* Circular Gauge Ring with 12 o'clock notch */}
            <div className={`relative flex items-center justify-center w-[80px] h-[80px] sm:w-[88px] sm:h-[88px] rounded-full border-[5.5px] shadow-2xs shrink-0 bg-white font-mono font-black text-sm sm:text-base text-slate-900 select-none ${
              passed
                ? 'border-[#0F6659]'
                : hasCritical
                ? 'border-rose-600'
                : 'border-amber-500'
            }`}>
              {parseFloat(Number(score).toFixed(2))}%
              <div className="absolute -top-[5.5px] left-1/2 -translate-x-1/2 w-2 h-2 bg-white rounded-full" />
            </div>

            {/* Score Text & Status Pill */}
            <div className="min-w-0">
              <div className="text-3xl sm:text-4xl font-black text-slate-900 font-mono tracking-tight leading-none">
                {parseFloat(Number(score).toFixed(2))}%
              </div>
              <div className="text-xs sm:text-sm font-semibold text-slate-400 mt-1">
                เกณฑ์ผ่าน ≥{passingScore}%
              </div>
              <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full shadow-2xs ${
                  passed
                    ? 'bg-[#0F6659] text-white'
                    : hasCritical
                    ? 'bg-rose-600 text-white'
                    : 'bg-amber-500 text-white'
                }`}>
                  {passed ? (
                    <CheckCircle2 size={13} className="text-white shrink-0" />
                  ) : hasCritical ? (
                    <XCircle size={13} className="text-white shrink-0" />
                  ) : (
                    <AlertTriangle size={13} className="text-white shrink-0" />
                  )}
                  <span>{passed ? "ผ่านเกณฑ์มาตรฐาน" : hasCritical ? "ตกข้อสำคัญ" : "ต้องส่งงานแก้ไข"}</span>
                </span>
                {isBackdated && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                    ⏳ บันทึกย้อนหลัง
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
            <div className="min-w-0">
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
            <div className="min-w-0">
              <div className="text-[11px] text-slate-400 font-semibold">ผู้ตรวจ</div>
              <div className="text-xs sm:text-sm font-extrabold text-slate-800 leading-snug break-words" title={auditorName}>
                {auditorName}
              </div>
            </div>
          </div>
        </div>

        {/* Fourth Section: Edit History Callout (เมื่อมีประวัติการแก้ไข) */}
        {editLogsCount > 0 && (
          <div className="p-3 sm:p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200/90 space-y-2.5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                <History size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs sm:text-sm font-bold text-amber-950">
                    ประวัติการแก้ไข
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-amber-200/80 text-amber-950 text-[11px] font-black shadow-2xs">
                    {editLogsCount} ครั้ง
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowEditLogsModal(true)}
              className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold shadow-2xs cursor-pointer transition-all active:scale-[0.98]"
            >
              <span>ดูประวัติการแก้ไข</span>
              <ChevronRight size={14} className="text-amber-700" />
            </button>
          </div>
        )}
      </div>

      {/* 🌟 5-TAB SEGMENTED SELECTOR (ตรงตาม Mockup) */}
      <div className="grid grid-cols-5 bg-white rounded-2xl p-1.5 border border-slate-200/80 shadow-2xs gap-1">
        {[
          { key: "overview", label: "คะแนน", icon: BarChart3 },
          { key: "responses", label: "ผลตรวจ", icon: ClipboardCheck },
          { key: "photos", label: "รูปภาพ", icon: Camera },
          { key: "sign", label: "สรุป&ลงชื่อ", icon: PenTool },
          { key: "location", label: "ตำแหน่ง", icon: MapPin },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all cursor-pointer select-none active:scale-95 ${
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
                    const isNonScored = q.isScored === false || ["grid","number","select","radio","checkbox","text","date","time","auditor"].includes(q.type || q.questionType);
                    const full = Number(q.fullScore) || 10;
                    const currentSc = q.scoreGiven !== undefined ? Number(q.scoreGiven) : (typeof q.answer === 'number' ? q.answer : (q.answer === true ? full : 0));
                    const isPass = isNonScored
                      ? true
                      : (q.isNa
                          ? true
                          : q.isPassed !== undefined
                          ? q.isPassed
                          : q.type === "yesno" 
                          ? q.answer === true 
                          : q.type === "scale" 
                            ? (q.scaleScore ? q.scaleScore >= 3 : (currentSc >= (full * 0.6))) 
                            : true);

                    return (
                      <div 
                        key={q.id} 
                        className="p-4 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-3 transition-all hover:border-slate-300"
                      >
                        {/* Question Header & Score Badge at Top Right */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5 flex-1 min-w-0">
                            <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-extrabold text-xs flex items-center justify-center shrink-0 mt-0.5">
                              {q.num}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm sm:text-base font-bold text-slate-900 leading-snug break-words [overflow-wrap:anywhere]">
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

                          {/* 🌟 มุมขวาบนของข้อ: แสดงเป็นคะแนน หรือ ข้อมูลไม่คิดคะแนน */}
                          <div className="shrink-0">
                            {isNonScored ? (
                              <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-bold px-2.5 py-1 rounded-full border bg-slate-100 text-slate-600 border-slate-200">
                                ข้อมูลไม่คิดคะแนน
                              </span>
                            ) : (
                              <span className={`inline-flex items-center gap-1 text-xs sm:text-sm font-bold px-3 py-1 rounded-full border shadow-2xs ${
                                q.isNa
                                  ? "bg-slate-100 text-slate-500 border-slate-200"
                                  : isPass
                                  ? "bg-emerald-50 text-[#0F6659] border-emerald-200"
                                  : "bg-red-50 text-red-700 border-red-300"
                               } font-mono`}>
                                <span>{q.scoreGiven !== undefined ? q.scoreGiven : (isPass ? full : 0)} / {full}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 🌟 แสดงรูปแบบคำตอบ: หากเป็นข้อไม่คิดคะแนน ให้เรนเดอร์ DynamicFieldRenderer (readOnly) หรือ CollapsibleGridTable ถ้าเป็นตาราง */}
                        {isNonScored ? (
                          (q.type === "grid" || q.questionType === "grid") ? (
                            <div className="pt-1.5 w-full">
                              <CollapsibleGridTable
                                label={q.text || "ตารางข้อมูล"}
                                fieldConfig={q.fieldConfig}
                                value={q.rawAnswer || q.answer}
                                defaultOpen={false}
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
                                const isSelected = !q.isNa && (selectedScale === n);
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
                                  q.isNa
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
                                !q.isNa && isPass
                                  ? 'bg-slate-200/90 text-emerald-800 border-emerald-300/80'
                                  : 'bg-slate-50 text-slate-400/80 border-slate-200/60 opacity-40'
                              }`}
                            >
                              <CheckCircle2 size={18} className={!q.isNa && isPass ? "text-emerald-700" : "text-slate-400"} />
                              <span>ผ่าน</span>
                            </div>

                            {/* ไม่ผ่าน / No */}
                            <div
                              className={`py-2.5 sm:py-3 rounded-2xl text-[11px] sm:text-xs font-bold border transition-all flex flex-col items-center justify-center gap-1 ${
                                !q.isNa && !isPass
                                  ? 'bg-slate-200/90 text-rose-800 border-rose-300/80'
                                  : 'bg-slate-50 text-slate-400/80 border-slate-200/60 opacity-40'
                              }`}
                            >
                              <XCircle size={18} className={!q.isNa && !isPass ? "text-rose-700" : "text-slate-400"} />
                              <span>ไม่ผ่าน</span>
                            </div>

                            {/* ข้าม (N/A) */}
                            <div
                              className={`py-2.5 sm:py-3 rounded-2xl text-[11px] sm:text-xs font-bold border transition-all flex flex-col items-center justify-center gap-1 ${
                                q.isNa
                                  ? 'bg-slate-200/90 text-slate-700 border-slate-300'
                                  : 'bg-slate-50 text-slate-400/80 border-slate-200/60 opacity-40'
                              }`}
                            >
                              <Minus size={18} className={q.isNa ? "text-slate-700" : "text-slate-400"} />
                              <span>ข้าม</span>
                            </div>
                          </div>
                        )}

                        {/* 🌟 ส่วนคอมเม้น: ถ้าไม่มีคอมเม้นจริง ไม่ต้องแสดงกล่องบันทึกผู้ตรวจ */}
                        {isRealCommentText(q.note, q.rawAnswer) && (
                          <div className="p-2.5 px-3 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2 bg-slate-50 text-slate-800 border border-slate-200">
                            <MessageSquare size={14} className="shrink-0 text-slate-400" />
                            <span><b>บันทึกผู้ตรวจ:</b> {q.note}</span>
                          </div>
                        )}

                        {/* Photo Thumbnail / Preview Button */}
                        {q.images && q.images.length > 0 ? (
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
                        ) : null}

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
                  const isPassing = s.percent >= (currentRecord?.passingScore || 85);
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
                        return (
                          <div key={item.id} className="col-span-full">
                            <CollapsibleGridTable
                              label={item.label}
                              fieldConfig={item.fieldConfig}
                              value={item.rawValue}
                              defaultOpen={false}
                            />
                          </div>
                        );
                      }
                      return (
                        <div key={item.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                          <div className="text-[11px] font-bold text-slate-500 capitalize">{item.label}</div>
                          <div className="text-sm font-extrabold text-slate-800 mt-0.5">
                            {item.value}{item.unit}
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
                {score < 85 || (recordCaps && recordCaps.length > 0)
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
          {Boolean(currentRecord.notes && currentRecord.notes.trim()) && (
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
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-xs sm:text-sm text-slate-700 font-medium whitespace-pre-wrap leading-relaxed">
                {currentRecord.notes}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Inspector Signature */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2.5">
              <div className="text-xs font-bold text-slate-500">ผู้ตรวจประเมิน</div>
              <div className="h-28 rounded-xl bg-slate-50 border border-dashed border-slate-200 flex flex-col items-center justify-center p-2 text-center overflow-hidden">
                {(currentRecord.auditorSignatureUrl || currentRecord.auditorSignature) ? (
                  <img
                    src={getFullImageUrl(currentRecord.auditorSignatureUrl || currentRecord.auditorSignature)}
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
              <div className="text-xs text-center font-bold text-emerald-700">
                ✓ ยืนยันผลตรวจแล้ว
              </div>
            </div>

            {/* Store Manager Signature */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2.5">
              <div className="text-xs font-bold text-slate-500">ผู้จัดการสาขา (ผู้รับตรวจ)</div>
              <div className="h-28 rounded-xl bg-slate-50 border border-dashed border-slate-200 flex flex-col items-center justify-center p-2 text-center overflow-hidden">
                {(currentRecord.auditeeSignatureUrl || currentRecord.auditeeSignature) ? (
                  <img
                    src={getFullImageUrl(currentRecord.auditeeSignatureUrl || currentRecord.auditeeSignature)}
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
              <div className="text-xs text-center font-bold text-emerald-700">
                ✓ ลงนามรับทราบแล้ว
              </div>
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
                    {(!startLat || !startLng) && (
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-800">
                        ก่อนตรวจไม่บันทึก
                      </span>
                    )}
                  </div>
                  <div className="text-[11.5px] text-slate-500 font-medium space-y-0.5">
                    <div>เวลาเริ่ม: <span className="font-bold text-slate-700">{startedTimeStr}</span></div>
                    {startLat && startLng && (
                      <div>พิกัด: <span className="font-bold text-slate-700 font-mono">{`${Number(startLat).toFixed(6)}, ${Number(startLng).toFixed(6)}`}</span></div>
                    )}
                  </div>
                </div>
                {startLat && startLng ? (
                  <a
                    href={`https://www.google.com/maps?q=${startLat},${startLng}`}
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
                {startLat && startLng ? (
                  <iframe
                    title="Start Location Map"
                    width="100%"
                    height="100%"
                    loading="lazy"
                    allowFullScreen
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://maps.google.com/maps?q=${startLat},${startLng}&hl=th&z=16&output=embed`}
                    className="w-full h-full block border-0"
                  />
                ) : (
                  <div className="text-center p-6 text-slate-400 space-y-1.5">
                    <MapPin size={28} className="mx-auto text-slate-300" />
                    <div className="text-xs sm:text-sm font-bold text-slate-600">ก่อนตรวจไม่บันทึก</div>
                  </div>
                )}
              </div>
            </div>

            {/* 🔵 MAP 2: จุดส่งผลตรวจ (Submit Location) */}
            <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="text-xs font-black text-slate-800 flex items-center gap-1.5 flex-wrap">
                    <span>2. จุดส่งผลตรวจ (Submit Inspection)</span>
                    {(!endLat || !endLng) && (
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-800">
                        หลังตรวจไม่บันทึก
                      </span>
                    )}
                  </div>
                  <div className="text-[11.5px] text-slate-500 font-medium space-y-0.5">
                    <div>เวลาส่งผล: <span className="font-bold text-slate-700">{submittedTimeStr}</span></div>
                    {endLat && endLng && (
                      <div>พิกัด: <span className="font-bold text-slate-700 font-mono">{`${Number(endLat).toFixed(6)}, ${Number(endLng).toFixed(6)}`}</span></div>
                    )}
                  </div>
                </div>
                {endLat && endLng ? (
                  <a
                    href={`https://www.google.com/maps?q=${endLat},${endLng}`}
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
                {endLat && endLng ? (
                  <iframe
                    title="Submit Location Map"
                    width="100%"
                    height="100%"
                    loading="lazy"
                    allowFullScreen
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://maps.google.com/maps?q=${endLat},${endLng}&hl=th&z=16&output=embed`}
                    className="w-full h-full block border-0"
                  />
                ) : (
                  <div className="text-center p-6 text-slate-400 space-y-1.5">
                    <MapPin size={28} className="mx-auto text-slate-300" />
                    <div className="text-xs sm:text-sm font-bold text-slate-600">หลังตรวจไม่บันทึก</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 AUDIT EDIT LOGS MODAL (ประวัติการแก้ไข) */}
      <AuditEditLogsModal
        isOpen={showEditLogsModal}
        onClose={() => setShowEditLogsModal(false)}
        auditRecordId={currentRecord?.id}
      />

      {/* 🌟 EDIT AUDIT RECORD MODAL (ฟอร์มแก้ไขผลการตรวจ) */}
      <EditAuditRecordModal
        isOpen={showEditFormModal}
        onClose={() => setShowEditFormModal(false)}
        record={currentRecord}
        onSaveSuccess={handleSaveSuccess}
      />

      {/* 🌟 AI DEFECT ANALYSIS MODAL (วิเคราะห์ข้อบกพร่องด้วย AI) */}
      {showAiDefectModal && (
        <AiAuditDefectModal
          auditRecordId={currentRecord?.id}
          onClose={() => setShowAiDefectModal(false)}
        />
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

      {/* 🌟 Floating Scroll-to-Top Button (ปุ่มเลื่อนขึ้นบนสุดเหมือนตอนตรวจ) */}
      {typeof document !== "undefined" && createPortal(
        <button
          type="button"
          onClick={() => {
            window.scrollTo({ top: 0, behavior: "smooth" });
            const mainEl = document.querySelector('main');
            if (mainEl) mainEl.scrollTo({ top: 0, behavior: "smooth" });
          }}
          aria-label="เลื่อนขึ้นบนสุดของหน้า"
          title="เลื่อนขึ้นบนสุดของหน้า"
          className={`fixed bottom-4 right-3 sm:bottom-6 sm:right-6 z-40 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#0F6659] hover:bg-[#0c5247] active:bg-[#093e36] text-white shadow-lg shadow-[#0F6659]/30 border border-emerald-600/30 flex items-center justify-center cursor-pointer transition-all duration-300 active:scale-90 ${
            isScrolled
              ? "opacity-100 translate-y-0 scale-100 pointer-events-auto"
              : "opacity-0 translate-y-3 scale-75 pointer-events-none"
          }`}
        >
          <ChevronUp size={20} strokeWidth={2.8} />
        </button>,
        document.body
      )}
    </div>
  );
}