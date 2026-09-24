import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Menu, PenTool, RotateCcw, Edit3, AlertCircle, ChevronDown, ChevronLeft, ChevronUp, Store, Navigation, Search, ChevronRight, CheckCircle2, XCircle, Minus, Camera, MessageSquare, Plus, Trash2, Clock, ClipboardList, Check, Loader2, Save, CheckCheck, AlertTriangle, X, Calendar, BarChart3, FileText, Coins, Banknote } from "lucide-react";

import { c, sans, mono, cardStyle } from "../../config/theme";
import { TopBarContext } from "../../context/TopBarContext";
import { DataContext } from "../../context/DataContext";
import { getDistanceInMeters, formatDistance, DEFAULT_USER_COORDS } from "../../utils/geo";
import api, { getFullImageUrl } from "../../config/api";
import { getCategoryDisplay } from "../../config/constants";

import ModalWrapper from "../../shared/ModalWrapper";
import Header from "../../shared/Header";
import Breadcrumbs from "../../shared/Breadcrumbs";
import Section from "../../shared/Section";
import ScoreRing from "../../shared/ScoreRing";
import ErrorBoundary from "../../shared/ErrorBoundary";
import { compressImageFile, validateImageFile } from "../../utils/imageCompressor";
import { isFormApplicableToLocation } from "../../utils/formMatching";
import { lockBodyScroll, unlockBodyScroll } from "../../utils/scrollLock";

// 💰 ชนิดธนบัตรและเหรียญมาตรฐานสำหรับระบบตรวจนับเงินสด
export const CASH_DENOMINATIONS = [1000, 500, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.25];

const QuestionCommentInput = React.memo(({ initialValue, onChange }) => {
  const [localValue, setLocalValue] = useState(initialValue || "");
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    setLocalValue(initialValue || "");
  }, [initialValue]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (localValue !== (initialValue || "")) {
        onChangeRef.current(localValue);
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [localValue, initialValue]);

  return (
    <input
      type="text"
      placeholder="ข้อคิดเห็น..."
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={() => {
        if (localValue !== (initialValue || "")) {
          onChangeRef.current(localValue);
        }
      }}
      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none text-slate-800 focus:border-[#0F6659] bg-slate-50/80"
    />
  );
});

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
  const title = sec?.title || "";
  if (title.includes("คุณภาพ") || title.includes("QLT") || title.includes("Product")) return "Product";
  if (title.includes("กระบวนการ") || title.includes("โรงงาน") || title.includes("OPS") || title.includes("Process") || title.includes("GMP")) return "Process";
  if (title.includes("บริการ") || title.includes("SVC") || title.includes("Service")) return "Service";
  if (title.includes("สะอาด") || title.includes("สุขอนามัย") || title.includes("CLN") || title.includes("Cleanliness")) return "Cleanliness";
  if (title.includes("เอกสาร") || title.includes("DOC") || title.includes("Documents")) return "Documents";

  return "Product";
};

// 🌟 QuestionCard — แยกออกมาจาก inline JSX เดิมที่อยู่ในลูป .map() ตรงๆ ในคอมโพเนนต์หลัก
// เหตุผล: ของเดิมทุกคำถาม (อาจมีเป็นร้อยข้อ) render อยู่ในฟังก์ชันเดียวกับฟอร์มทั้งหมด
// พอตอบข้อไหนข้อหนึ่ง React ก็ต้อง re-render คำถามทุกข้อพร้อมกันหมด เพราะไม่มีขอบเขต component
// แยกให้ React.memo เทียบ props ได้ — ถ้า props ของการ์ดนี้ไม่เปลี่ยน (ไม่ใช่ข้อที่เพิ่งตอบ) จะไม่ re-render เลย
//
// ⚠️ กติกาสำคัญที่ทำให้ memo ใช้ได้ผลจริง: รับ "ค่าเฉพาะของคำถามข้อนี้" เป็น props
// (เช่น answer แทนที่จะรับ answers ทั้งก้อน) และ handler ทุกตัวที่ส่งเข้ามาต้องเป็น reference คงที่
// (ห่อด้วย useCallback ที่ต้นทาง) ไม่งั้น React.memo จะเทียบ props แล้วเจอว่าเปลี่ยนทุกครั้งอยู่ดี
const QuestionCard = React.memo(function QuestionCard({
  q,
  sec,
  idx,
  answer,
  photosForQuestion,
  commentValue,
  openCommentOverride,
  photoUploadError,
  isHighlighted,
  onAnswerSelect,
  onCommentChange,
  onPhotoUpload,
  onPhotoDelete,
  onToggleComment
}) {
  const isNa = answer === "na";
  const isFailed = !isNa && (answer === "no" || answer === false || (Number(answer) < 3 && answer !== undefined && answer !== ""));
  const rawP = photosForQuestion;
  const questionPhotos = Array.isArray(rawP) ? rawP : (rawP ? [rawP] : []);
  const hasPhoto = questionPhotos.length > 0;
  const qType = (q.questionType || q.type || "YESNO").toString().toLowerCase();
  const isScale = qType === "scale" || qType === "rating";
  const isCommentRequired = isFailed;
  const isCommentOpen = Boolean(isCommentRequired || openCommentOverride || (commentValue && commentValue.trim().length > 0));
  const scoreGiven = isNa ? 0 : (isScale ? (Number(answer) || 0) / 5 * (q.fullScore || 10) : ((answer === "yes" || answer === true) ? (q.fullScore || 10) : 0));
  const isAnswered = answer !== undefined && answer !== "";

  return (
    <div
      id={`question-card-${q.id}`}
      className={`p-4 sm:p-5 rounded-3xl border transition-all duration-300 ${isHighlighted
          ? "bg-rose-50/95 border-2 border-rose-500 ring-4 ring-rose-300/60 shadow-lg animate-pulse"
          : isNa
            ? "bg-slate-50/90 border-slate-300"
            : isFailed
              ? "bg-red-50/50 border-red-300"
              : "bg-white border-slate-200 shadow-2xs"
        }`}
    >
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="text-[11px] font-black text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md">ข้อ {q.orderIndex || idx + 1}</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
            {q.categoryName || q.category || "ทั่วไป"}
          </span>
          {q.isCritical && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-red-100 text-red-800 border border-red-200">สำคัญ</span>
          )}
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100">
            คะแนน {isAnswered && !isNa ? scoreGiven : 0} / {q.fullScore || 10}
          </span>
          {isHighlighted && (
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-600 text-white animate-bounce">กรุณาตอบข้อนี้!</span>
          )}

          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            <button
              type="button"
              onClick={() => onToggleComment(q.id, isCommentOpen)}
              className={`w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer transition-all border ${(commentValue && commentValue.trim().length > 0)
                  ? 'bg-amber-50 text-amber-700 border-amber-300'
                  : isCommentOpen
                    ? 'bg-slate-200 text-slate-800 border-slate-300'
                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                }`}
            >
              <MessageSquare size={16} className={(commentValue && commentValue.trim().length > 0) ? "fill-amber-400/40" : ""} />
            </button>
            <label
              className={`h-9 px-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all border ${hasPhoto ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                }`}
              title="แนบรูปถ่าย (ถ่ายภาพ หรือ เลือกรูปจากคลังภาพในเครื่อง)"
            >
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(e) => {
                  onPhotoUpload(q.id, e.target.files);
                  e.target.value = '';
                }}
              />
              <Camera size={16} />
              {hasPhoto && (
                <span className="text-[11px] font-black font-mono">
                  {questionPhotos.length}
                </span>
              )}
            </label>
          </div>
        </div>
        <h4 className={`w-full text-sm sm:text-base font-semibold leading-snug break-words [overflow-wrap:anywhere] ${isNa ? "text-slate-400 line-through" : "text-slate-800"}`}>
          {q.questionText || q.text}
        </h4>
      </div>

      {hasPhoto && (
        <div className="flex items-center gap-2 overflow-x-auto py-1 mb-3 custom-tab-scrollbar">
          {questionPhotos.map((imgUrl, imgIdx) => (
            <div key={imgIdx} className="relative shrink-0 rounded-xl overflow-hidden border border-slate-200 shadow-2xs group">
              <img src={imgUrl} alt={`Evidence ${imgIdx + 1}`} className="h-20 w-28 object-cover" />
              <button
                type="button"
                onClick={() => onPhotoDelete(q.id, imgIdx)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 hover:bg-rose-600 text-white flex items-center justify-center text-[10px] font-bold cursor-pointer transition-all shadow-sm"
                title="ลบรูปภาพนี้"
              >
                ✕
              </button>
              <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-md bg-black/60 text-white text-[9px] font-bold font-mono">
                #{imgIdx + 1}
              </span>
            </div>
          ))}
          <label className="h-20 w-20 shrink-0 rounded-xl border-2 border-dashed border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/50 flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-emerald-700 cursor-pointer transition-all">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(e) => {
                onPhotoUpload(q.id, e.target.files);
                e.target.value = '';
              }}
            />
            <Plus size={18} />
            <span className="text-[10px] font-bold">เพิ่มรูป</span>
          </label>
        </div>
      )}

      {photoUploadError && (
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-2.5 py-1.5 mb-3">
          <AlertTriangle size={13} className="shrink-0" />
          <span>{photoUploadError}</span>
        </div>
      )}

      {!isScale && (
        <div className="grid grid-cols-3 gap-2">
          <button type="button" onClick={() => onAnswerSelect(q.id, "yes")} className={`py-3 rounded-2xl text-[11px] sm:text-xs font-bold border cursor-pointer transition-all flex flex-col items-center justify-center gap-1 ${answer === "yes" || answer === true ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-600/30' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}>
            <CheckCircle2 size={18} /><span>ผ่าน</span>
          </button>
          <button type="button" onClick={() => onAnswerSelect(q.id, "no")} className={`py-3 rounded-2xl text-[11px] sm:text-xs font-bold border cursor-pointer transition-all flex flex-col items-center justify-center gap-1 ${answer === "no" || answer === false ? 'bg-rose-600 text-white border-rose-600 shadow-md ring-2 ring-rose-600/30' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}>
            <XCircle size={18} /><span>ไม่ผ่าน</span>
          </button>
          <button type="button" onClick={() => onAnswerSelect(q.id, "na")} className={`py-3 rounded-2xl text-[11px] sm:text-xs font-bold border cursor-pointer transition-all flex flex-col items-center justify-center gap-1 ${answer === "na" ? 'bg-slate-700 text-white border-slate-700 shadow-md ring-2 ring-slate-700/30' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}>
            <Minus size={18} /><span>ข้าม</span>
          </button>
        </div>
      )}

      {isScale && (
        <div className="flex gap-1.5 items-center">
          {[5, 4, 3, 2, 1].map((n) => (
            <button key={n} type="button" onClick={() => onAnswerSelect(q.id, n)} className={`flex-1 py-2.5 rounded-xl text-sm font-black cursor-pointer transition-all border ${answer === n ? 'bg-[#0F6659] text-white border-[#0F6659] shadow-md ring-2 ring-[#0F6659]/30' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}>
              {n}
            </button>
          ))}
          <button type="button" onClick={() => onAnswerSelect(q.id, "na")} className={`px-2.5 py-2.5 rounded-xl flex items-center justify-center text-[10px] font-black cursor-pointer transition-all border ${answer === "na" ? 'bg-slate-700 text-white border-slate-700 shadow-md' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
            <Minus size={14} className="mr-0.5" /> N/A
          </button>
        </div>
      )}

      {isCommentOpen && (
        <div className="mt-3">
          <QuestionCommentInput initialValue={commentValue} onChange={(val) => onCommentChange(q.id, val)} />
        </div>
      )}
    </div>
  );
});

// ✍️ Touch & Mouse High-DPI Digital Signature Pad — เปิดเป็น Modal เต็มจอเวลาเซ็น
function SignaturePadCanvas({ initialSignatureUrl, onDone, onCancel }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(Boolean(initialSignatureUrl));
  const [isLoadingOldSignature, setIsLoadingOldSignature] = useState(Boolean(initialSignatureUrl));

  useEffect(() => {
    lockBodyScroll();
    return () => {
      unlockBodyScroll();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = '#0F6659';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 🎨 Load existing / old signature onto canvas if present
    if (initialSignatureUrl) {
      setIsLoadingOldSignature(true);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        if (!canvasRef.current) return;
        const currentCtx = canvasRef.current.getContext('2d');
        const padding = 16;
        const availableW = Math.max(10, rect.width - (padding * 2));
        const availableH = Math.max(10, rect.height - (padding * 2));
        const imgW = img.naturalWidth || img.width || 1;
        const imgH = img.naturalHeight || img.height || 1;
        const scale = Math.min(availableW / imgW, availableH / imgH, 1);
        const drawW = imgW * scale;
        const drawH = imgH * scale;
        const offsetX = (rect.width - drawW) / 2;
        const offsetY = (rect.height - drawH) / 2;
        currentCtx.drawImage(img, offsetX, offsetY, drawW, drawH);
        setHasSigned(true);
        setIsLoadingOldSignature(false);
      };
      img.onerror = () => {
        setIsLoadingOldSignature(false);
      };
      img.src = getFullImageUrl(initialSignatureUrl);
    }
  }, [initialSignatureUrl]);

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if (e.touches && e.touches[0]) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e) => {
    setIsDrawing(true);
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.lineTo(x, y);
      ctx.stroke();
      setHasSigned(true);
    }
  };

  const stopDrawing = () => {
    if (isDrawing) setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    setHasSigned(false);
  };

  const confirmSign = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSigned) return;
    try {
      let dataUrl;
      try {
        dataUrl = canvas.toDataURL('image/webp', 0.85);
        if (!dataUrl.startsWith('data:image/webp')) {
          dataUrl = canvas.toDataURL('image/png');
        }
      } catch {
        dataUrl = canvas.toDataURL('image/png');
      }
      onDone(dataUrl);
    } catch (e) {
      console.warn("Canvas toDataURL failed (possibly cross-origin), falling back to initial signature", e);
      if (initialSignatureUrl) {
        onDone(initialSignatureUrl);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-end sm:items-center justify-center animate-in fade-in duration-150">
      <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl p-4 sm:p-5 space-y-3 animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <PenTool size={15} className="text-[#0F6659]" />
            เซ็นชื่อลงในกรอบด้านล่าง
          </h3>
          <button type="button" onClick={onCancel} className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center cursor-pointer text-slate-500">
            <X size={16} />
          </button>
        </div>

        <div className="relative border-2 border-dashed border-slate-300 rounded-2xl bg-white overflow-hidden touch-none shadow-2xs">
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="w-full h-56 sm:h-64 cursor-crosshair block"
          />
          {isLoadingOldSignature && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70 pointer-events-none text-slate-500 text-xs font-semibold gap-2">
              <Loader2 size={16} className="animate-spin text-[#0F6659]" />
              <span>กำลังโหลดลายเซ็นเดิม...</span>
            </div>
          )}
          {!hasSigned && !isLoadingOldSignature && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400 text-xs font-medium gap-1.5 select-none">
              <Edit3 size={14} />
              <span>แตะหรือลากเพื่อเซ็นชื่อลงในกรอบนี้</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={clearCanvas}
            className="flex-1 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95"
          >
            <RotateCcw size={14} />
            ล้างลายเซ็น
          </button>
          <button
            type="button"
            onClick={confirmSign}
            disabled={!hasSigned || isLoadingOldSignature}
            className="flex-1 py-3 rounded-2xl bg-[#0F6659] hover:bg-[#0c5449] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95"
          >
            <CheckCircle2 size={14} />
            ยืนยันลายเซ็น
          </button>
        </div>
      </div>
    </div>
  );
}

function SignaturePad({ label, signatoryName, onNameChange, onSignChange, placeholderName = "ระบุชื่อผู้ลงนาม...", signatureUrl }) {
  const [showModal, setShowModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const hasSigned = Boolean(signatureUrl);

  return (
    <div className="space-y-1.5 text-left">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <PenTool size={13} className="text-[#0F6659]" />
          <span>{label}</span>
        </label>
        {hasSigned && (
          <button
            type="button"
            onClick={() => onSignChange(null)}
            className="text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw size={11} />
            <span>ล้างลายเซ็น</span>
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="relative w-full border-2 border-dashed border-slate-300 rounded-2xl bg-white overflow-hidden hover:border-[#0F6659]/50 transition-colors shadow-2xs h-24 sm:h-28 flex items-center justify-center cursor-pointer"
      >
        {isUploading ? (
          <div className="flex items-center justify-center gap-2 text-slate-500 text-xs font-semibold">
            <Loader2 size={16} className="animate-spin text-[#0F6659]" />
            <span>กำลังบันทึกลายเซ็น...</span>
          </div>
        ) : hasSigned ? (
          <img src={getFullImageUrl(signatureUrl)} alt={label} className="max-h-full max-w-full object-contain" />
        ) : (
          <div className="flex items-center justify-center text-slate-400 text-xs font-medium gap-1.5 select-none">
            <Edit3 size={14} />
            <span>แตะเพื่อเซ็นชื่อ</span>
          </div>
        )}
      </button>

      {onNameChange && (
        <input
          type="text"
          value={signatoryName || ''}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={placeholderName}
          className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white font-semibold text-slate-800 outline-none focus:border-[#0F6659] shadow-2xs ios-zoom-fix-xs"
        />
      )}

      {showModal && typeof document !== "undefined" && createPortal(
        <SignaturePadCanvas
          initialSignatureUrl={signatureUrl}
          onCancel={() => setShowModal(false)}
          onDone={async (dataUrl) => {
            setShowModal(false);
            if (dataUrl === signatureUrl) return; // Unchanged
            onSignChange(dataUrl);
            try {
              setIsUploading(true);
              const res = await api.post('/audit/upload-signature', { 
                base64Data: dataUrl,
                previousUrl: signatureUrl,
                signatoryType: label?.includes("ผู้รับ") ? "auditee" : "auditor"
              });
              if (res.data?.url) {
                onSignChange(res.data.url);
              }
            } catch (err) {
              console.warn("Upload signature to server failed, keeping dataUrl:", err);
            } finally {
              setIsUploading(false);
            }
          }}
        />,
        document.body
      )}
    </div>
  );
}

// 📱 Modern Top-Down Navigation Drawer (สไลด์คลี่ลงมาจากด้านบน รูดปัดขึ้นเพื่อเก็บ)
function CategoryNavigationDrawer({ onClose, categoryItems, activeTab, activeSectionIdx, onSelectCategory }) {
  const [mounted, setMounted] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const startYRef = useRef(0);
  const currentYRef = useRef(0);
  const startTimeRef = useRef(0);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setMounted(true);
    });
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
    // อนุญาตเฉพาะการปัดขึ้นด้านบน (deltaY < 0) เพื่อดันเก็บเข้าขอบบน
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

  // Mouse handlers for desktop testing / devtools
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

  // สำหรับ Top Sheet: ตำแหน่งเริ่มต้นหรือตอนปิดจะอยู่ที่ -100% (ซ่อนเหนือนอกจอ)
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
      className="fixed inset-0 z-[99999] flex flex-col justify-start backdrop-blur-xs"
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
        {/* Header Bar ด้านบนสุด */}
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
            <h2 className="text-base font-black text-slate-800">ไปยังหัวข้อที่ต้องการ</h2>
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
          {categoryItems.map((item, itemIndex) => {
            const isCurrent = (item.id === "details" && activeTab === 1) ||
                              (item.id === "summary" && activeTab === 3) ||
                              (item.id === "submit" && activeTab === 3) ||
                              (activeTab === 2 && item.index === activeSectionIdx);
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
                <span className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-[#0F6659] flex items-center justify-center shrink-0 shadow-2xs">
                  {item.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-xs sm:text-sm font-bold text-slate-800">{item.label}</span>
                  {item.id === "details" && <span className="block text-[11px] text-slate-400">ข้อมูลสาขาและรายละเอียดการตรวจ</span>}
                  {item.id === "cash-audit" && <span className="block text-[11px] text-slate-400">ตรวจนับเงินสดตามชนิดธนบัตรและเหรียญ</span>}
                  {item.id === "summary" && <span className="block text-[11px] text-slate-400">สรุปผลการตรวจและข้อเสนอแนะภาพรวม</span>}
                  {item.id === "submit" && <span className="block text-[11px] text-slate-400">ลงลายมือชื่อดิจิทัลและส่งผลตรวจ</span>}
                </div>
                {item.count && (
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-lg shrink-0">
                    {item.count.startsWith("฿") || item.count === "พิมพ์แล้ว" || item.count.includes("แล้ว") ? item.count : `${item.count} ตอบแล้ว`}
                  </span>
                )}
                {itemIndex > 0 && item.id !== "submit" && <ChevronRight size={14} className="text-slate-300 shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* แถบมือจับสำหรับรูดปัดขึ้นเพื่อปิด (Bottom Drag Handle Bar) */}
        <div
          className="w-full py-2.5 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none hover:bg-slate-50/70 transition-colors border-t border-slate-100 bg-slate-50/50 shrink-0"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          onMouseDown={handleMouseDown}
          title="แตะหรือปัดขึ้นเพื่อปิด"
        >
          <div className="w-12 h-1.5 bg-slate-300 active:bg-slate-400 rounded-full mx-auto transition-colors" />
        </div>
      </div>
    </div>
  );
}

// 🏷️ คำนวณสถานะการตรวจประจำเดือน (4 สถานะ: กำลังตรวจ, ตรวจแล้วเดือนนี้, มีแผนตรวจ, ยังไม่ได้ตรวจเดือนนี้)
export const getLocationMonthlyStatus = (location, { auditRecords = [], activeDrafts = [], schedules = [] } = {}) => {
  if (!location) {
    return {
      key: "not_audited",
      label: "ยังไม่ได้ตรวจเดือนนี้",
      badgeClass: "bg-rose-50 text-rose-800 border border-rose-200/90",
    };
  }

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const locId = location.id ? Number(location.id) : null;
  const locName = (location.name || "").trim().toLowerCase();
  const locFullName = (location.fullName || "").trim().toLowerCase();

  const isLocationMatch = (targetId, targetName, targetFullName) => {
    if (locId && targetId && Number(targetId) === locId) return true;
    if (locName) {
      const tn = (targetName || "").trim().toLowerCase();
      const tfn = (targetFullName || "").trim().toLowerCase();
      if (tn && (tn === locName || tn === locFullName)) return true;
      if (tfn && (tfn === locName || tfn === locFullName)) return true;
    }
    return false;
  };

  // 1. Priority 1: กำลังตรวจ (มี Draft ค้างอยู่ของสาขานี้)
  const allDrafts = Array.isArray(activeDrafts) ? activeDrafts : [];
  const hasDraft = allDrafts.some(d => {
    const dLocId = d.locationId || d.location?.id || d.unit?.id;
    const dLocName = d.locationName || d.unit?.name;
    const dLocFullName = d.locationFullName || d.unit?.fullName;
    return isLocationMatch(dLocId, dLocName, dLocFullName);
  });

  if (hasDraft) {
    return {
      key: "in_progress",
      label: "กำลังตรวจ",
      badgeClass: "bg-amber-50 text-amber-800 border border-amber-200/90",
    };
  }

  // 2. Priority 2: ตรวจแล้วเดือนนี้ (มี AuditRecord สำเร็จในเดือน/ปีปัจจุบัน)
  const allRecords = Array.isArray(auditRecords) ? auditRecords : [];
  const hasAuditedThisMonth = allRecords.some(r => {
    const rLocId = r.locationId || r.location?.id || r.unit?.id;
    const rLocName = r.locationName || r.location?.name || r.unit?.name;
    const rLocFullName = r.locationFullName || r.location?.fullName || r.unit?.fullName;
    if (!isLocationMatch(rLocId, rLocName, rLocFullName)) return false;

    const rawDate = r.auditDate || r.submittedAt || r.createdAt || r.date;
    if (!rawDate) return false;
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) return false;
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  if (hasAuditedThisMonth) {
    return {
      key: "audited",
      label: "ตรวจแล้วเดือนนี้",
      badgeClass: "bg-emerald-50 text-emerald-800 border border-emerald-200/90",
    };
  }

  // 3. Priority 3: มีแผนตรวจ (มี AuditSchedule ในเดือน/ปีปัจจุบันที่ยังไม่เสร็จ)
  const allSchedules = Array.isArray(schedules) ? schedules : [];
  const hasScheduleThisMonth = allSchedules.some(s => {
    const sLocId = s.locationId || s.location?.id;
    const sLocName = s.locationName || s.location?.name;
    const sLocFullName = s.locationFullName || s.location?.fullName;
    if (!isLocationMatch(sLocId, sLocName, sLocFullName)) return false;

    if (s.status === 'completed' || s.status === 'done' || s.status === 'cancelled') return false;

    const rawDate = s.scheduledDate || s.date || s.auditDate;
    if (!rawDate) return false;
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) return false;
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  if (hasScheduleThisMonth) {
    return {
      key: "scheduled",
      label: "มีแผนตรวจ",
      badgeClass: "bg-sky-50 text-sky-800 border border-sky-200/90",
    };
  }

  // 4. Priority 4: ยังไม่ได้ตรวจเดือนนี้ (Fallback)
  return {
    key: "not_audited",
    label: "ยังไม่ได้ตรวจเดือนนี้",
    badgeClass: "bg-rose-50 text-rose-800 border border-rose-200/90",
  };
};

// 🌟 Location Status Badge (กรอบรอบข้อความ ไม่มีจุดสี ไม่มีเวลา)
export function LocationStatusBadge({ statusInfo, className = "" }) {
  if (!statusInfo) return null;
  return (
    <span
      className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold tracking-tight shrink-0 transition-all shadow-2xs ${statusInfo.badgeClass} ${className}`}
    >
      {statusInfo.label}
    </span>
  );
}

// 🌟 3-Step Progress Indicator พร้อม Smooth Animation (ตัวหนังสืออยู่ด้านล่างของไอคอน)
export function AuditStepIndicator({ currentStep = 1, onGoToStep1, onGoToStep2, className = "" }) {
  // currentStep: 1 = เลือกสาขา, 2 = เลือกฟอร์ม, 3 = ตรวจประเมิน
  return (
    <div className={`w-full max-w-md mx-auto py-3 px-2 sm:px-4 bg-white/95 backdrop-blur-xs rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-2xs ${className}`}>
      <div className="relative flex items-start justify-between">
        {/* Background connecting line passing through center of the circles */}
        <div className="absolute top-[18px] left-[16.67%] right-[16.67%] h-0.5 bg-slate-100 -translate-y-1/2 z-0">
          <div
            className="h-full bg-emerald-500 transition-all duration-500 ease-out"
            style={{
              width: currentStep === 1 ? "0%" : currentStep === 2 ? "50%" : "100%"
            }}
          />
        </div>

        {/* Step 1: เลือกสาขา */}
        <button
          type="button"
          onClick={currentStep > 1 ? onGoToStep1 : undefined}
          disabled={currentStep === 1}
          className={`flex-1 flex flex-col items-center gap-1.5 relative z-10 transition-all duration-300 select-none group ${
            currentStep > 1 ? "cursor-pointer" : "cursor-default"
          }`}
        >
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ring-4 ring-white ${
              currentStep > 1
                ? "bg-emerald-100 text-emerald-700 group-hover:bg-emerald-200 group-hover:scale-105 shadow-2xs"
                : currentStep === 1
                  ? "bg-[#0F6659] text-white shadow-xs scale-105 ring-4 ring-emerald-500/20"
                  : "bg-slate-100 text-slate-400 border border-slate-200"
            }`}
          >
            {currentStep > 1 ? (
              <Check size={16} strokeWidth={3} className="animate-in zoom-in-50 duration-200" />
            ) : (
              <Store size={16} />
            )}
          </div>
          <span
            className={`text-xs tracking-tight text-center transition-colors ${
              currentStep === 1
                ? "text-[#0F6659] font-black"
                : currentStep > 1
                  ? "text-slate-800 font-bold group-hover:text-emerald-700"
                  : "text-slate-400 font-medium"
            }`}
          >
            เลือกสาขา
          </span>
        </button>

        {/* Step 2: เลือกฟอร์ม */}
        <button
          type="button"
          onClick={currentStep > 2 ? onGoToStep2 : undefined}
          disabled={currentStep <= 2}
          className={`flex-1 flex flex-col items-center gap-1.5 relative z-10 transition-all duration-300 select-none group ${
            currentStep > 2 ? "cursor-pointer" : "cursor-default"
          }`}
        >
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ring-4 ring-white ${
              currentStep === 2
                ? "bg-[#0F6659] text-white shadow-xs scale-105 ring-4 ring-emerald-500/20"
                : currentStep > 2
                  ? "bg-emerald-100 text-emerald-700 group-hover:bg-emerald-200 shadow-2xs"
                  : "bg-slate-100 text-slate-400 border border-slate-200"
            }`}
          >
            {currentStep > 2 ? (
              <Check size={16} strokeWidth={3} className="animate-in zoom-in-50 duration-200" />
            ) : (
              <ClipboardList size={16} />
            )}
          </div>
          <span
            className={`text-xs tracking-tight text-center transition-colors ${
              currentStep === 2
                ? "text-[#0F6659] font-black"
                : currentStep > 2
                  ? "text-slate-800 font-bold group-hover:text-emerald-700"
                  : "text-slate-400 font-medium"
            }`}
          >
            เลือกฟอร์ม
          </span>
        </button>

        {/* Step 3: ตรวจประเมิน */}
        <div className="flex-1 flex flex-col items-center gap-1.5 relative z-10 select-none">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ring-4 ring-white ${
              currentStep === 3
                ? "bg-[#0F6659] text-white shadow-xs scale-105 ring-4 ring-emerald-500/20"
                : "bg-slate-100 text-slate-400 border border-slate-200"
            }`}
          >
            <PenTool size={15} />
          </div>
          <span
            className={`text-xs tracking-tight text-center transition-colors ${
              currentStep === 3 ? "text-[#0F6659] font-black" : "text-slate-400 font-medium"
            }`}
          >
            ตรวจประเมิน
          </span>
        </div>
      </div>
    </div>
  );
}

// 🌟 ฟังก์ชันจับคู่คำตอบ/รูปภาพ/คอมเมนต์ของแบบร่างเดิมเข้ากับข้อตรวจของฟอร์มปัจจุบัน
// ป้องกันปัญหาข้อมูลหายเมื่อแบบฟอร์มถูกแก้ไขหรือ Clone เวอร์ชันใหม่ในฐานข้อมูล ทำให้ Item IDs เปลี่ยนไป
export function remapDraftItemsToCurrentForm(draftPayload, form) {
  if (!draftPayload || !form?.sections || !Array.isArray(form.sections) || form.sections.length === 0) {
    return {
      answers: draftPayload?.answers || {},
      photos: draftPayload?.photos || {},
      comments: draftPayload?.comments || {},
      oldToNewIdMap: {}
    };
  }

  const currentItemsFlat = [];
  const currentItemIds = new Set();
  for (const sec of form.sections) {
    for (const item of (sec.items || [])) {
      currentItemIds.add(String(item.id));
      currentItemsFlat.push(item);
    }
  }

  const draftAnswers = draftPayload.answers || {};
  const draftPhotos = draftPayload.photos || {};
  const draftComments = draftPayload.comments || {};

  const allDraftKeys = Array.from(new Set([
    ...Object.keys(draftAnswers),
    ...Object.keys(draftPhotos),
    ...Object.keys(draftComments)
  ]));

  const oldToNewIdMap = {};
  const unmatchedDraftKeys = [];

  for (const k of allDraftKeys) {
    if (currentItemIds.has(String(k))) {
      oldToNewIdMap[String(k)] = String(k);
    } else {
      unmatchedDraftKeys.push(String(k));
    }
  }

  // 🌟 Fallback สำหรับกรณีที่มีการอัปเดตหรือ Clone ฟอร์มใหม่ ทำให้ ID ของข้อตรวจเปลี่ยนไป (เช่น 5877-5896 -> 5897-5916)
  if (unmatchedDraftKeys.length > 0 && currentItemsFlat.length > 0) {
    unmatchedDraftKeys.sort((a, b) => {
      const numA = Number(a);
      const numB = Number(b);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });

    const numericKeys = unmatchedDraftKeys
      .map(k => Number(k))
      .filter(n => !isNaN(n))
      .sort((a, b) => a - b);

    const isAllNumeric = numericKeys.length === unmatchedDraftKeys.length;
    const minOldId = isAllNumeric && numericKeys.length > 0 ? numericKeys[0] : null;
    const maxOldId = isAllNumeric && numericKeys.length > 0 ? numericKeys[numericKeys.length - 1] : null;
    const oldSpan = (minOldId !== null && maxOldId !== null) ? (maxOldId - minOldId + 1) : 0;

    const usedNewIds = new Set(Object.values(oldToNewIdMap));

    // กลยุทธ์ A: ถ้าช่วง ID เก่าเป็นช่วงตัวเลขออโต้รันที่พอดีกับช่วง index ของข้อปัจจุบัน
    if (isAllNumeric && minOldId !== null && oldSpan <= currentItemsFlat.length) {
      for (const oldNum of numericKeys) {
        const targetIdx = oldNum - minOldId;
        if (targetIdx >= 0 && targetIdx < currentItemsFlat.length) {
          const targetItem = currentItemsFlat[targetIdx];
          if (targetItem && !usedNewIds.has(String(targetItem.id))) {
            oldToNewIdMap[String(oldNum)] = String(targetItem.id);
            usedNewIds.add(String(targetItem.id));
          }
        }
      }
    }

    // กลยุทธ์ B: สำหรับคีย์ที่ยังไม่ได้จับคู่ ให้จับคู่ตามลำดับข้อที่ยังว่างอยู่
    let fallbackIdx = 0;
    for (const oldK of unmatchedDraftKeys) {
      if (!oldToNewIdMap[oldK]) {
        while (fallbackIdx < currentItemsFlat.length && usedNewIds.has(String(currentItemsFlat[fallbackIdx].id))) {
          fallbackIdx++;
        }
        if (fallbackIdx < currentItemsFlat.length) {
          const targetItem = currentItemsFlat[fallbackIdx];
          oldToNewIdMap[oldK] = String(targetItem.id);
          usedNewIds.add(String(targetItem.id));
          fallbackIdx++;
        }
      }
    }
  }

  const resolveMappedKey = (key) => oldToNewIdMap[String(key)] || (currentItemIds.has(String(key)) ? String(key) : null);

  const mappedAnswers = {};
  for (const [key, val] of Object.entries(draftAnswers)) {
    const mk = resolveMappedKey(key);
    if (mk && currentItemIds.has(mk)) {
      mappedAnswers[mk] = val;
    }
  }

  const mappedPhotos = {};
  for (const [key, val] of Object.entries(draftPhotos)) {
    const mk = resolveMappedKey(key);
    if (mk && currentItemIds.has(mk)) {
      mappedPhotos[mk] = val;
    }
  }

  const mappedComments = {};
  for (const [key, val] of Object.entries(draftComments)) {
    const mk = resolveMappedKey(key);
    if (mk && currentItemIds.has(mk)) {
      mappedComments[mk] = val;
    }
  }

  return {
    answers: Object.keys(mappedAnswers).length > 0 ? mappedAnswers : draftAnswers,
    photos: Object.keys(mappedPhotos).length > 0 ? mappedPhotos : draftPhotos,
    comments: Object.keys(mappedComments).length > 0 ? mappedComments : draftComments,
    oldToNewIdMap
  };
}

export default function LiveAuditScreen({
  preselectedPlan,
  onClearPlan,
  onBack,
  currentUser: propUser,
  defaultAuditorName = "",
  initialDraft,
  onSaveDraft,
  onCompleteAudit,
  onActiveStateChange,
  onSyncStatusChange
}) {
  const onActiveStateChangeRef = useRef(onActiveStateChange);
  onActiveStateChangeRef.current = onActiveStateChange;

  const onSyncStatusChangeRef = useRef(onSyncStatusChange);
  onSyncStatusChangeRef.current = onSyncStatusChange;

  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  const { setSubHeader } = React.useContext(TopBarContext) || {};
  const { currentUser: ctxUser, locations: allLocations, visibleLocations, forms, getFormDetail, activeDraft, activeDrafts, auditRecords, schedules, refreshData } = React.useContext(DataContext);
  const currentUser = propUser || ctxUser;
  const formList = forms || [];

  const targetLocationId = preselectedPlan?.locationId != null && !isNaN(Number(preselectedPlan.locationId))
    ? Number(preselectedPlan.locationId)
    : (preselectedPlan?.locationName
        ? allLocations.find(l => l.name === preselectedPlan.locationName || l.fullName === preselectedPlan.locationName)?.id
        : (typeof preselectedPlan?.unit === 'object' && preselectedPlan?.unit?.id ? Number(preselectedPlan.unit.id) : null));
  const targetFormId = preselectedPlan?.surveyFormId != null && !isNaN(Number(preselectedPlan.surveyFormId))
    ? Number(preselectedPlan.surveyFormId)
    : null;

  const matchedDraftRecord = useMemo(() => {
    if (preselectedPlan?.isNewAudit) return null;

    const allDrafts = activeDrafts && activeDrafts.length > 0 ? activeDrafts : (activeDraft ? [activeDraft] : []);

    if (preselectedPlan?.isResume) {
      const explicitDraftId = preselectedPlan.originalId || preselectedPlan.id;
      if (explicitDraftId && typeof explicitDraftId === 'number') {
        const foundById = allDrafts.find(d => Number(d.id) === Number(explicitDraftId));
        if (foundById) return foundById;
      }
      if (preselectedPlan?.draftPayloadJson || preselectedPlan?.answers) {
        return preselectedPlan;
      }
    }

    if (preselectedPlan && !preselectedPlan.isResume) {
      return null;
    }

    if (!targetLocationId && !preselectedPlan?.locationName && !preselectedPlan?.unit) {
      return null;
    }

    if (preselectedPlan?.id && typeof preselectedPlan.id === 'number') {
      const foundBySched = allDrafts.find(d => Number(d.auditScheduleId) === Number(preselectedPlan.id));
      if (foundBySched) return foundBySched;
    }

    const pUnitName = typeof preselectedPlan?.unit === 'string'
      ? preselectedPlan.unit
      : (preselectedPlan?.unit?.fullName || preselectedPlan?.unit?.name);

    const found = allDrafts.find(d => {
      const dLocId = d.locationId || d.location?.id || d.unit?.id;
      const dLocName = d.locationName || d.locationFullName || d.unit?.name || d.unit?.fullName;
      const matchLoc = (targetLocationId && Number(dLocId) === Number(targetLocationId)) ||
        (preselectedPlan?.locationName && (dLocName === preselectedPlan.locationName || dLocName === pUnitName)) ||
        (pUnitName && (dLocName === pUnitName || (d.locationFullName && d.locationFullName.includes(pUnitName))));
      const matchForm = !targetFormId || Number(d.surveyFormId) === Number(targetFormId) || Number(d.formId) === Number(targetFormId);
      return matchLoc && matchForm;
    });

    return found || null;
  }, [preselectedPlan, targetLocationId, targetFormId, activeDrafts, activeDraft, allLocations]);

  const parsedDraftPayload = useMemo(() => {
    if (!matchedDraftRecord) return null;

    if (matchedDraftRecord.draftPayloadJson) {
      try {
        return typeof matchedDraftRecord.draftPayloadJson === 'string'
          ? JSON.parse(matchedDraftRecord.draftPayloadJson)
          : matchedDraftRecord.draftPayloadJson;
      } catch (e) { }
    }
    if (matchedDraftRecord.answers && typeof matchedDraftRecord.answers === 'object') {
      return matchedDraftRecord;
    }

    if (targetLocationId) {
      try {
        const localKey = `qsc_draft_${targetLocationId}_${targetFormId || 1}`;
        const localStr = localStorage.getItem(localKey);
        if (localStr) return JSON.parse(localStr);
      } catch (e) { }
    }

    return null;
  }, [matchedDraftRecord, targetLocationId, targetFormId]);

  const isResumeDraft = Boolean(
    !preselectedPlan?.isNewAudit &&
    preselectedPlan?.isResume &&
    parsedDraftPayload
  );

  const isFromAssignedPlan = Boolean(
    preselectedPlan &&
    !preselectedPlan.isNewAudit &&
    !isResumeDraft &&
    (preselectedPlan.locationId || preselectedPlan.locationName || preselectedPlan.unit)
  );

  const [searchBranch, setSearchBranch] = useState("");
  const [userCoords, setUserCoords] = useState(DEFAULT_USER_COORDS);
  const [realStartGps, setRealStartGps] = useState(null);

  const sortedBranchList = useMemo(() => {
    let list = [...(visibleLocations || [])];

    if (currentUser?.branchScope === "SPECIFIC" && Array.isArray(currentUser.allowedLocationIds) && currentUser.allowedLocationIds.length > 0) {
      list = list.filter(u => currentUser.allowedLocationIds.includes(u.id));
    }

    if (searchBranch.trim()) {
      const q = searchBranch.toLowerCase().trim();
      list = list.filter(u => {
        const matchName = u.name?.toLowerCase().includes(q);
        const matchFullName = u.fullName?.toLowerCase().includes(q);
        const matchCode = u.code?.toLowerCase().includes(q);
        const matchRegion = u.region?.toLowerCase().includes(q);
        const matchAddress = u.address?.toLowerCase().includes(q);
        const matchBrand = (u.locationBrands || [])?.some(lb =>
          (lb.brand?.name || lb.brandName || "").toLowerCase().includes(q) ||
          (lb.brand?.code || lb.brandCode || "").toLowerCase().includes(q)
        ) || (u.brand?.name || u.brandName || "").toLowerCase().includes(q) || (u.brand?.code || "").toLowerCase().includes(q);
        const matchType = (
          u.locationType?.name ||
          u.locationType?.code ||
          (typeof u.locationType === 'string' ? u.locationType : '')
        ).toLowerCase().includes(q);

        return matchName || matchFullName || matchCode || matchRegion || matchAddress || matchBrand || matchType;
      });
    }

    return list.sort((a, b) => {
      const distA = getDistanceInMeters(userCoords.latitude, userCoords.longitude, a.latitude, a.longitude);
      const distB = getDistanceInMeters(userCoords.latitude, userCoords.longitude, b.latitude, b.longitude);
      return distA - distB;
    });
  }, [visibleLocations, searchBranch, userCoords, currentUser]);

  const [step, setStep] = useState(() => {
    if (isResumeDraft || isFromAssignedPlan) return "audit";
    return "select-unit";
  });
  const [activeTab, setActiveTab] = useState(1);

  const [branchPage, setBranchPage] = useState(1);
  const branchPageSize = 10;
  const [branchPageInput, setBranchPageInput] = useState("1");

  useEffect(() => {
    setBranchPage(1);
  }, [searchBranch]);

  useEffect(() => {
    setBranchPageInput(String(branchPage));
  }, [branchPage]);

  const totalBranchPages = Math.ceil(sortedBranchList.length / branchPageSize) || 1;
  const handleBranchPageSubmit = () => {
    const val = parseInt(branchPageInput, 10);
    if (!isNaN(val)) {
      const target = Math.max(1, Math.min(totalBranchPages, val));
      setBranchPage(target);
      setBranchPageInput(String(target));
    } else {
      setBranchPageInput(String(branchPage));
    }
  };

  const [unit, setUnit] = useState(() => {
    if (typeof preselectedPlan?.unit === 'object' && preselectedPlan?.unit?.name) {
      if (!targetLocationId || Number(preselectedPlan.unit.id) === Number(targetLocationId)) {
        return preselectedPlan.unit;
      }
    }
    if (isResumeDraft && parsedDraftPayload?.unit) {
      if (!targetLocationId || Number(parsedDraftPayload.unit.id) === Number(targetLocationId)) {
        return parsedDraftPayload.unit;
      }
    }
    if (isFromAssignedPlan || isResumeDraft || targetLocationId || preselectedPlan?.locationName) {
      const locId = targetLocationId || preselectedPlan?.locationId;
      const locName = preselectedPlan?.locationName || (typeof preselectedPlan?.unit === 'string' ? preselectedPlan?.unit : preselectedPlan?.unit?.name);
      const found = allLocations.find(u =>
        (locId && Number(u.id) === Number(locId)) ||
        (locName && (u.name === locName || u.fullName === locName || (u.fullName && u.fullName.includes(locName))))
      );
      if (found) return found;
      if (typeof preselectedPlan?.unit === 'object' && preselectedPlan?.unit) {
        return preselectedPlan.unit;
      }
    }
    return null;
  });

  const applicableForms = useMemo(() => {
    const activeLatestForms = formList.filter(f => 
      ((f.isLatest !== false && f.isLatest !== 0) || Number(f.id) === Number(preselectedPlan?.surveyFormId) || Number(f.id) === Number(targetFormId)) &&
      f.isActive !== false && f.isActive !== 0
    );
    if (!unit) return activeLatestForms;
    return activeLatestForms.filter(f => 
      (preselectedPlan?.surveyFormId && Number(f.id) === Number(preselectedPlan.surveyFormId)) ||
      (targetFormId && Number(f.id) === Number(targetFormId)) ||
      isFormApplicableToLocation(f, unit)
    );
  }, [formList, unit, preselectedPlan?.surveyFormId, targetFormId]);

  const [selectedForm, setSelectedForm] = useState(() => {
    const targetFId = (isResumeDraft && parsedDraftPayload?.formId) 
      ? Number(parsedDraftPayload.formId) 
      : (preselectedPlan?.surveyFormId ? Number(preselectedPlan.surveyFormId) : (targetFormId ? Number(targetFormId) : null));
    if (targetFId) {
      const found = formList.find(f => Number(f.id) === Number(targetFId));
      if (found) return found;
    }
    if (unit) {
      const matched = formList.filter(f => isFormApplicableToLocation(f, unit));
      if (matched.length > 0) return matched[0];
    }
    return null;
  });

  // 🌟 Sync unit from allLocations once data finishes loading asynchronously
  useEffect(() => {
    if (!allLocations || allLocations.length === 0) return;
    const locId = targetLocationId || preselectedPlan?.locationId;
    const locName = preselectedPlan?.locationName || (typeof preselectedPlan?.unit === 'string' ? preselectedPlan?.unit : preselectedPlan?.unit?.name);
    if (locId || locName) {
      const found = allLocations.find(u =>
        (locId && Number(u.id) === Number(locId)) ||
        (locName && (u.name === locName || u.fullName === locName || (u.fullName && u.fullName.includes(locName))))
      );
      if (found) {
        if (!unit || Number(unit.id) !== Number(found.id)) {
          setUnit(found);
        }
      }
    }
  }, [allLocations, targetLocationId, preselectedPlan?.locationId, preselectedPlan?.locationName, preselectedPlan?.unit]);

  // 🌟 Sync selectedForm from formList once forms finish loading asynchronously
  useEffect(() => {
    if (!formList || formList.length === 0) return;
    const targetFId = (isResumeDraft && parsedDraftPayload?.formId) 
      ? Number(parsedDraftPayload.formId) 
      : (preselectedPlan?.surveyFormId ? Number(preselectedPlan.surveyFormId) : (targetFormId ? Number(targetFormId) : null));
    if (targetFId) {
      const found = formList.find(f => Number(f.id) === Number(targetFId));
      if (found && (!selectedForm || Number(selectedForm.id) !== Number(found.id))) {
        setSelectedForm(found);
      }
    } else if (!selectedForm && unit) {
      const matched = formList.filter(f => isFormApplicableToLocation(f, unit));
      if (matched.length > 0) {
        setSelectedForm(matched[0]);
      }
    }
  }, [formList, targetFormId, preselectedPlan?.surveyFormId, isResumeDraft, parsedDraftPayload?.formId, unit]);

  const currentSections = selectedForm?.sections || [];
  const passingScore = selectedForm?.passingScore || 85;

  // 🌟 forms จาก context เป็นแบบ summary (ไม่มี sections) — พอเลือกฟอร์มที่จะใช้ตรวจจริง
  // ต้องดึงคำถามเต็มมาก่อนเสมอ ไม่งั้นหน้าจอตรวจจะไม่มีคำถามให้ตอบ
  useEffect(() => {
    if (!selectedForm?.id || !getFormDetail) return;
    if (Array.isArray(selectedForm.sections)) return; // hydrate แล้ว
    let cancelled = false;
    getFormDetail(selectedForm.id).then(full => {
      if (!cancelled && full && Array.isArray(full.sections)) {
        setSelectedForm(prev => (prev && prev.id === full.id) ? { ...prev, ...full } : prev);
      }
    });
    return () => { cancelled = true; };
  }, [selectedForm?.id, selectedForm?.sections, getFormDetail]);

  // 🌟 Hydrate applicable forms in the background so their full sections/items are ready instantly
  useEffect(() => {
    if (step === "select-form" && getFormDetail && Array.isArray(applicableForms)) {
      applicableForms.forEach(f => {
        if (f?.id && !Array.isArray(f.sections)) {
          getFormDetail(f.id);
        }
      });
    }
  }, [step, applicableForms, getFormDetail]);

  const initialRemappedDraft = useMemo(() => {
    if (!isResumeDraft || !parsedDraftPayload) return null;
    return remapDraftItemsToCurrentForm(parsedDraftPayload, selectedForm);
  }, [isResumeDraft, parsedDraftPayload, selectedForm]);

  const [sectionIdx, setSectionIdx] = useState(isResumeDraft ? (parsedDraftPayload?.sectionIdx || 0) : 0);
  const [answers, setAnswers] = useState(() => initialRemappedDraft?.answers || (isResumeDraft ? (parsedDraftPayload?.answers || {}) : {}));
  const [photos, setPhotos] = useState(() => initialRemappedDraft?.photos || (isResumeDraft ? (parsedDraftPayload?.photos || {}) : {}));
  const [comments, setComments] = useState(() => initialRemappedDraft?.comments || (isResumeDraft ? (parsedDraftPayload?.comments || {}) : {}));
  const [openComments, setOpenComments] = useState({});
  const [staffCount, setStaffCount] = useState(isResumeDraft ? (parsedDraftPayload?.staffCount || "") : "");
  const [auditorName, setAuditorName] = useState(() => {
    if (isResumeDraft && parsedDraftPayload?.auditorName) return parsedDraftPayload.auditorName;
    return currentUser?.fullName || currentUser?.name || defaultAuditorName || "";
  });
  const [metadataValues, setMetadataValues] = useState(() => {
    return parsedDraftPayload?.metadataValues || {};
  });

  const activeMetadataFields = useMemo(() => {
    let fields = null;
    if (selectedForm?.metadataConfig && Array.isArray(selectedForm.metadataConfig) && selectedForm.metadataConfig.length > 0) {
      fields = selectedForm.metadataConfig;
    } else if (selectedForm?.metadataConfigJson) {
      try {
        const parsed = JSON.parse(selectedForm.metadataConfigJson);
        if (Array.isArray(parsed) && parsed.length > 0) fields = parsed;
      } catch (e) { }
    }

    if (!fields || fields.length === 0) {
      fields = [
        { id: "auditor", label: "ผู้ตรวจประเมิน (Auditor)", type: "auditor", required: true, enabled: true, isSystem: true },
        { id: "audit_type", label: "ประเภทการตรวจ (Audit Type)", type: "select", options: ["ตามกำหนดการ", "นอกกำหนดการ", "ปลอมตัว"], required: true, enabled: true, isSystem: true },
        { id: "staff_count", label: "จำนวนพนักงานขณะตรวจ", type: "number", unit: "คน", min: 0, required: true, enabled: true, isSystem: true }
      ];
    }
    return fields.filter(f => f.enabled !== false);
  }, [selectedForm]);

  const [usersList, setUsersList] = useState([]);

  useEffect(() => {
    let isMounted = true;
    api.get('/user')
      .then(res => {
        if (isMounted && res.data && Array.isArray(res.data)) {
          setUsersList(res.data);
        }
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, []);

  const auditorOptions = useMemo(() => {
    const allowedRoles = ['AUDITOR', 'ADMIN', 'STANDARD'];
    const filtered = usersList.filter(u => {
      const rCode = (u.roleCode || u.role?.code || u.role || '').toUpperCase();
      return allowedRoles.includes(rCode);
    });

    const currentName = currentUser?.fullName || currentUser?.name || defaultAuditorName;
    if (currentName && !filtered.some(u => (u.fullName || u.name) === currentName)) {
      const currentRole = (currentUser?.roleCode || currentUser?.role?.code || currentUser?.role || '').toUpperCase();
      if (allowedRoles.includes(currentRole) || !filtered.length) {
        filtered.unshift({
          id: currentUser?.id || 'current',
          fullName: currentName,
          roleCode: currentUser?.roleCode || currentUser?.role || 'AUDITOR'
        });
      }
    }
    return filtered.filter(u => u.isActive !== false);
  }, [usersList, currentUser, defaultAuditorName]);

  useEffect(() => {
    if (!auditorName && (currentUser?.fullName || currentUser?.name)) {
      setAuditorName(currentUser.fullName || currentUser.name);
    }
  }, [currentUser]);

  const [auditType, setAuditType] = useState(() => {
    if (isResumeDraft && parsedDraftPayload?.auditType) {
      const t = parsedDraftPayload.auditType.toLowerCase();
      if (t === "spot" || t === "unannounced") return "spot";
      if (t === "undercover") return "undercover";
      if (t === "announced") return "announced";
      return t;
    }
    if (preselectedPlan?.auditType) {
      const t = preselectedPlan.auditType.toLowerCase();
      if (t === "spot" || t === "unannounced") return "spot";
      if (t === "undercover") return "undercover";
      if (t === "announced") return "announced";
      return t;
    }
    return "";
  });

  const [extraNote, setExtraNote] = useState(() => {
    if (isResumeDraft) {
      return parsedDraftPayload?.extraNote || parsedDraftPayload?.notes || parsedDraftPayload?.auditNotes || parsedDraftPayload?.summary || "";
    }
    return "";
  });
  const [isBackdated, setIsBackdated] = useState(() => Boolean(parsedDraftPayload?.isBackdated));
  const [backdatedStartDate, setBackdatedStartDate] = useState(() => parsedDraftPayload?.backdatedStartDate || "");
  const [backdatedEndDate, setBackdatedEndDate] = useState(() => parsedDraftPayload?.backdatedEndDate || "");

  // 💰 ระบบตรวจนับเงินสด (Cash Audit State)
  const [cashCounts, setCashCounts] = useState(() => {
    if (parsedDraftPayload?.cashCounts && typeof parsedDraftPayload.cashCounts === 'object') {
      return parsedDraftPayload.cashCounts;
    }
    const initial = {};
    CASH_DENOMINATIONS.forEach(d => { initial[d] = "0"; });
    return initial;
  });
  const [isCashSystemOpen, setIsCashSystemOpen] = useState(true);
  const [isPettyCashOpen, setIsPettyCashOpen] = useState(true);

  // คำนวณยอดเงินรวมทั้งหมดแบบเรียลไทม์
  const totalCashAmount = useMemo(() => {
    return CASH_DENOMINATIONS.reduce((sum, denom) => {
      const count = Number(cashCounts[denom]);
      if (!isNaN(count) && count > 0) {
        return sum + count * denom;
      }
      return sum;
    }, 0);
  }, [cashCounts]);

  const handleCashCountChange = useCallback((denom, val) => {
    const cleaned = val === "" ? "" : (val.replace(/[^0-9.]/g, '') || "0");
    setCashCounts(prev => ({
      ...prev,
      [denom]: cleaned
    }));
  }, []);

  const handleResetCashCounts = useCallback(() => {
    const initial = {};
    CASH_DENOMINATIONS.forEach(d => { initial[d] = "0"; });
    setCashCounts(initial);
  }, []);

  // 🛡️ Accurately resolve effective schedule ID across all entry points
  const effectiveSchedId = useMemo(() => {
    if (preselectedPlan?.auditScheduleId && Number(preselectedPlan.auditScheduleId) > 0) {
      return Number(preselectedPlan.auditScheduleId);
    }
    if (preselectedPlan?.scheduleId && Number(preselectedPlan.scheduleId) > 0) {
      return Number(preselectedPlan.scheduleId);
    }
    if (matchedDraftRecord?.auditScheduleId && Number(matchedDraftRecord.auditScheduleId) > 0) {
      return Number(matchedDraftRecord.auditScheduleId);
    }
    if (!preselectedPlan?.isResume && preselectedPlan?.id && Number(preselectedPlan.id) > 0) {
      return Number(preselectedPlan.id);
    }
    if (preselectedPlan?.scheduledDate && preselectedPlan?.id && Number(preselectedPlan.id) > 0) {
      return Number(preselectedPlan.id);
    }
    if (preselectedPlan?.type === 'schedule' && preselectedPlan?.id && Number(preselectedPlan.id) > 0) {
      return Number(preselectedPlan.id);
    }
    return null;
  }, [preselectedPlan, matchedDraftRecord]);

  const initialDraftId = useMemo(() => {
    if (isResumeDraft && matchedDraftRecord?.id && typeof matchedDraftRecord.id === 'number') {
      return matchedDraftRecord.id;
    }
    if (preselectedPlan?.isResume && preselectedPlan?.id && typeof preselectedPlan.id === 'number' && !String(preselectedPlan.id).startsWith('schedule')) {
      if (preselectedPlan?.scheduleId && Number(preselectedPlan.id) === Number(preselectedPlan.scheduleId)) {
        return null;
      }
      if (preselectedPlan?.auditScheduleId && Number(preselectedPlan.id) === Number(preselectedPlan.auditScheduleId)) {
        return null;
      }
      return preselectedPlan.id;
    }
    return null;
  }, [isResumeDraft, matchedDraftRecord, preselectedPlan]);

  const [draftId, setDraftId] = useState(initialDraftId);
  const draftIdRef = useRef(initialDraftId);
  const skipScrollToTopRef = useRef(false);

  const getEffectiveDraftId = useCallback(() => {
    if (draftIdRef.current && typeof draftIdRef.current === 'number' && draftIdRef.current > 0) {
      return draftIdRef.current;
    }
    if (draftId && typeof draftId === 'number' && draftId > 0) {
      return draftId;
    }
    if (initialDraftId && typeof initialDraftId === 'number' && initialDraftId > 0) {
      return initialDraftId;
    }
    if (matchedDraftRecord?.id && typeof matchedDraftRecord.id === 'number' && matchedDraftRecord.id > 0) {
      return matchedDraftRecord.id;
    }
    return null;
  }, [draftId, initialDraftId, matchedDraftRecord]);

  useEffect(() => {
    if (initialDraftId) {
      setDraftId(initialDraftId);
      draftIdRef.current = initialDraftId;
    }
  }, [initialDraftId]);

  const [syncStatus, setSyncStatus] = useState("idle");
  const isDiscardingRef = useRef(false);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDiscardConfirmModal, setShowDiscardConfirmModal] = useState(false);
  const [highlightedQuestionId, setHighlightedQuestionId] = useState(null);
  const [auditeeSignature, setAuditeeSignature] = useState(() => parsedDraftPayload?.auditeeSignature || preselectedPlan?.auditeeSignature || null);
  const [auditorSignature, setAuditorSignature] = useState(() => parsedDraftPayload?.auditorSignature || preselectedPlan?.auditorSignature || null);
  const [auditeeSignName, setAuditeeSignName] = useState(() => parsedDraftPayload?.auditeeSignName || preselectedPlan?.auditeeSignName || unit?.managerName || "ผู้จัดการสาขา");
  const [auditStartedAt, setAuditStartedAt] = useState(() => parsedDraftPayload?.startedAt || new Date().toISOString());
  const auditStartedAtRef = useRef(parsedDraftPayload?.startedAt || null);
  if (!auditStartedAtRef.current && auditStartedAt) {
    auditStartedAtRef.current = auditStartedAt;
  }
  const saveSeqRef = useRef(0);
  const realStartGpsRef = useRef(realStartGps);
  useEffect(() => {
    realStartGpsRef.current = realStartGps;
  }, [realStartGps]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [isCategoryBreakdownExpanded, setIsCategoryBreakdownExpanded] = useState(true);
  const [isAuditHeaderScrolled, setIsAuditHeaderScrolled] = useState(false);
  const [isCategoryDrawerOpen, setIsCategoryDrawerOpen] = useState(false);
  // 🌟 หมวดคำถามที่กำลังเลื่อนผ่านอยู่ ณ ขณะนี้ (ตั้งต้นเป็น null เพื่อไม่ให้โผล่ก่อนเลื่อน)
  const [activeSectionIndex, setActiveSectionIndex] = useState(null);
  const activeSectionIdx = activeSectionIndex ?? 0;

  useEffect(() => {
    if (!isCategoryDrawerOpen) return;
    lockBodyScroll();
    return () => {
      unlockBodyScroll();
    };
  }, [isCategoryDrawerOpen]);

  useEffect(() => {
    if (!showConfirmModal) return;
    lockBodyScroll();
    return () => {
      unlockBodyScroll();
    };
  }, [showConfirmModal]);

  useEffect(() => {
    if (!showDiscardConfirmModal) return;
    lockBodyScroll();
    return () => {
      unlockBodyScroll();
    };
  }, [showDiscardConfirmModal]);
  
  const currentSectionsForHeader = selectedForm?.sections || [];

  // 🌟 ติดตามว่ากำลังเลื่อนผ่านหมวดคำถามไหนอยู่ (Tab 2 เท่านั้น) บันทึกหมวดที่ล็อคติดขอบบนลงใน activeSectionIndex
  useEffect(() => {
    if (step !== "audit") {
      setIsAuditHeaderScrolled(false);
      return undefined;
    }

    const computeActiveSection = () => {
      const scrollY = window.scrollY || document.documentElement.scrollTop || (document.querySelector('main')?.scrollTop || 0);
      setIsAuditHeaderScrolled(scrollY > 60);

      if (activeTab === 2 && currentSectionsForHeader.length > 0) {
        let current = null;
        // ตรวจสอบเฉพาะเมื่อมีการเลื่อนจอลงมาแล้ว (ถ้ายังอยู่บนสุดจะคงค่า null ไว้)
        if (scrollY > 50) {
          for (let i = 0; i < currentSectionsForHeader.length; i++) {
            const sectionEl = document.getElementById(`audit-section-${i}`);
            const headerEl = document.getElementById(`audit-section-header-${i}`);
            
            if (sectionEl) {
              const rect = sectionEl.getBoundingClientRect();
              // เมื่อขอบบนของหมวดเลื่อนขึ้นมาถึง/ใกล้ขอบบน (top <= 95px) และขอบล่างยังไม่พ้นจอ (bottom > 50px)
              if (rect.top <= 95 && rect.bottom > 50) {
                current = i;
                break;
              }
            } else if (headerEl) {
              const rect = headerEl.getBoundingClientRect();
              if (rect.top <= 95 && rect.bottom > 0) {
                current = i;
                break;
              }
            }
          }
        }
        setActiveSectionIndex(current);
      }
    };

    computeActiveSection();
    window.addEventListener("scroll", computeActiveSection, { passive: true });
    document.addEventListener("scroll", computeActiveSection, { passive: true });
    const mainEl = document.querySelector('main');
    if (mainEl) mainEl.addEventListener("scroll", computeActiveSection, { passive: true });
    return () => {
      window.removeEventListener("scroll", computeActiveSection);
      document.removeEventListener("scroll", computeActiveSection);
      if (mainEl) mainEl.removeEventListener("scroll", computeActiveSection);
    };
  }, [step, activeTab, currentSectionsForHeader]);

  const activeSection = activeSectionIndex !== null ? currentSectionsForHeader[activeSectionIndex] : null;
  const activeSectionAnsweredCount = activeSection
    ? (activeSection.items || []).filter(item => answers[item.id] !== undefined && answers[item.id] !== "").length
    : 0;
  const activeSectionTotalCount = activeSection?.items?.length || 0;

  useEffect(() => {
    if (unit?.managerName) {
      setAuditeeSignName(unit.managerName);
    }
  }, [unit]);

  useEffect(() => {
    let cancelled = false;
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled || !pos?.coords) return;
          const coords = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          };
          setUserCoords(coords);
          setRealStartGps(coords);
        },
        (err) => {
          // หากไม่มี GPS หรือผู้ใช้ไม่อนุญาต ไม่ใช้ fallback ใดๆ (คงเป็น null)
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const hasHydratedDraftRef = useRef(false);
  useEffect(() => {
    if (parsedDraftPayload && !hasHydratedDraftRef.current && isResumeDraft) {
      const currentForm = selectedForm || formList.find(f => f.id === parsedDraftPayload.formId);

      // 🌟 forms จาก context เป็น summary ก่อน (ไม่มี sections) ให้รอ hydrate เต็มก่อน
      // ไม่งั้น currentItemIds จะว่างเปล่าเสมอ ทำให้การกรองคำตอบเก่า (stale answers) ไม่ทำงานเลย
      // (useEffect ที่ hydrate selectedForm ด้านบนจะทำให้ effect นี้รันใหม่เองเมื่อโหลดเสร็จ)
      if (currentForm?.id && !Array.isArray(currentForm.sections)) {
        return;
      }

      hasHydratedDraftRef.current = true;

      const { answers: remappedAnswers, photos: remappedPhotos, comments: remappedComments, oldToNewIdMap } =
        remapDraftItemsToCurrentForm(parsedDraftPayload, currentForm);

      if (oldToNewIdMap && Object.keys(oldToNewIdMap).length > 0) {
        console.log(`[Draft] ✅ Hydrated & mapped ${Object.keys(remappedAnswers).length} answer(s), ${Object.keys(remappedPhotos).length} photo(s) to current form items`);
      }

      setAnswers(remappedAnswers);
      setPhotos(remappedPhotos);
      setComments(remappedComments);
      if (parsedDraftPayload.staffCount) {
        setStaffCount(parsedDraftPayload.staffCount);
      }
      if (parsedDraftPayload.auditorName) {
        setAuditorName(parsedDraftPayload.auditorName);
      }
      if (parsedDraftPayload.isBackdated !== undefined) {
        setIsBackdated(Boolean(parsedDraftPayload.isBackdated));
      }
      if (parsedDraftPayload.backdatedStartDate) {
        setBackdatedStartDate(parsedDraftPayload.backdatedStartDate);
      }
      if (parsedDraftPayload.backdatedEndDate) {
        setBackdatedEndDate(parsedDraftPayload.backdatedEndDate);
      }
      if (parsedDraftPayload.auditeeSignature) {
        setAuditeeSignature(parsedDraftPayload.auditeeSignature);
      }
      if (parsedDraftPayload.auditorSignature) {
        setAuditorSignature(parsedDraftPayload.auditorSignature);
      }
      if (parsedDraftPayload.auditeeSignName) {
        setAuditeeSignName(parsedDraftPayload.auditeeSignName);
      }
      if (parsedDraftPayload.auditType) {
        const t = parsedDraftPayload.auditType.toLowerCase();
        if (t === "spot" || t === "unannounced") setAuditType("spot");
        else if (t === "undercover") setAuditType("undercover");
        else if (t === "announced") setAuditType("announced");
      }
      if (parsedDraftPayload.sectionIdx !== undefined) {
        setSectionIdx(parsedDraftPayload.sectionIdx);
      }
      if (parsedDraftPayload.unit && !unit) {
        if (!targetLocationId || Number(parsedDraftPayload.unit.id) === Number(targetLocationId)) {
          setUnit(parsedDraftPayload.unit);
        }
      }
      if (parsedDraftPayload.cashCounts && typeof parsedDraftPayload.cashCounts === 'object') {
        setCashCounts(parsedDraftPayload.cashCounts);
      }
      if (parsedDraftPayload.startedAt) {
        setAuditStartedAt(parsedDraftPayload.startedAt);
        auditStartedAtRef.current = parsedDraftPayload.startedAt;
      }
      if (parsedDraftPayload.formId && (!selectedForm || Number(selectedForm.id) !== Number(parsedDraftPayload.formId))) {
        const foundForm = formList.find(f => Number(f.id) === Number(parsedDraftPayload.formId));
        if (foundForm) setSelectedForm(foundForm);
      }
      setStep("audit");
      setActiveTab(2);
    }
  }, [parsedDraftPayload, isResumeDraft, unit, selectedForm, formList]);

  useEffect(() => {
    const isActivelyAuditing = step === "audit";
    if (onActiveStateChangeRef.current) {
      onActiveStateChangeRef.current(isActivelyAuditing);
    }
    return () => {
      if (onActiveStateChangeRef.current) onActiveStateChangeRef.current(false);
    };
  }, [step]);

  // 🌟 Sync subHeader to MainDashboard TopBar (สลับ Menu/Back เมื่อ Scroll)
  useEffect(() => {
    if (!setSubHeader) return;
    if (step === "select-unit") {
      setSubHeader(prev => (prev === null ? prev : null));
      return;
    }

    const title = step === "select-form" ? "เลือกแบบฟอร์มการตรวจ" : (unit?.fullName || unit?.name || "ตรวจประเมิน QSC");
    const subtitle = step === "select-form" ? (unit?.fullName || unit?.name || "-") : (selectedForm?.title || "แบบฟอร์มการตรวจ");
    const currentActionType = (step === "audit" && isAuditHeaderScrolled) ? "menu" : "back";
    const sectionBadgeNumber = null;

    const isAuditingQuestions = step === "audit";

    setSubHeader(prev => {
      if (
        prev &&
        prev.title === title &&
        prev.subtitle === subtitle &&
        prev.isAudit === isAuditingQuestions &&
        prev.hasBack === true &&
        prev.leftActionType === currentActionType &&
        prev.sectionBadgeNumber === sectionBadgeNumber
      ) {
        return prev;
      }

      return {
        title,
        subtitle,
        hasBack: true,
        isAudit: isAuditingQuestions,
        leftActionType: currentActionType,
        sectionBadgeNumber,
        onMenuClick: () => setIsCategoryDrawerOpen(true),
        onBack: () => {
          if (step === "select-form") {
            setStep("select-unit");
          } else {
            if (isResumeDraft || isFromAssignedPlan) {
              if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
                autoSaveTimerRef.current = null;
                performSaveDraft();
              }
              if (onBackRef.current) onBackRef.current(true);
              return;
            }
            setStep("select-form");
          }
        }
      };
    });

    return () => {
      if (setSubHeader) {
        setSubHeader(prev => (prev?.title === title ? null : prev));
      }
    };
  }, [step, unit?.id, unit?.name, unit?.fullName, selectedForm?.id, selectedForm?.title, isResumeDraft, isFromAssignedPlan, isAuditHeaderScrolled, setSubHeader, activeTab, activeSectionIndex, activeSection, activeSectionAnsweredCount, activeSectionTotalCount]);

  // ล้าง subHeader เมื่อ Component ถูก Unmount
  useEffect(() => {
    return () => {
      if (setSubHeader) {
        setSubHeader(null);
      }
    };
  }, [setSubHeader]);

  useEffect(() => {
    if (onSyncStatusChangeRef.current) {
      onSyncStatusChangeRef.current(step === "audit" ? syncStatus : "idle");
    }
  }, [syncStatus, step]);

  const handleDesktopBack = useCallback(() => {
    if (step === "select-form") {
      setStep("select-unit");
    } else if (step === "audit") {
      if (isResumeDraft || isFromAssignedPlan) {
        if (autoSaveTimerRef.current) {
          clearTimeout(autoSaveTimerRef.current);
          autoSaveTimerRef.current = null;
          performSaveDraft();
        }
        if (onBackRef.current) onBackRef.current(true);
        return;
      }
      setStep("select-form");
    }
  }, [step, isResumeDraft, isFromAssignedPlan]);

  const scrollToTop = () => {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.querySelector('main')?.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.body.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    } catch (e) { }
  };

  useEffect(() => {
    // ยกเลิกการเด้งขึ้นบนสุด
    if (skipScrollToTopRef.current) {
      skipScrollToTopRef.current = false;
      return;
    }
    scrollToTop();
    const t1 = setTimeout(scrollToTop, 20);
    const t2 = setTimeout(scrollToTop, 100);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [step, activeTab]);

  const autoSaveTimerRef = useRef(null);
  const isSavingRef = useRef(false);
  const pendingSaveDataRef = useRef(null);
  const hasPendingSaveRef = useRef(false);
  const hasUserAnswers = useMemo(() => {
    return (
      Object.keys(answers).length > 0 ||
      Object.keys(photos).length > 0 ||
      Object.keys(comments).length > 0 ||
      Boolean(staffCount) ||
      Boolean(extraNote) ||
      Boolean(auditType) ||
      Boolean(isBackdated) ||
      Boolean(backdatedStartDate) ||
      Boolean(backdatedEndDate) ||
      Boolean(auditeeSignature) ||
      Boolean(auditorSignature) ||
      Object.keys(metadataValues).length > 0
    );
  }, [answers, photos, comments, staffCount, extraNote, metadataValues, isBackdated, backdatedStartDate, backdatedEndDate, auditeeSignature, auditorSignature]);

  const performSaveDraft = async (overrideData = {}) => {
    if (isDiscardingRef.current) {
      setSyncStatus("idle");
      return;
    }

    // 🛡️ ป้องกันไม่ให้บันทึกทับก่อนที่ข้อมูลร่างเดิมจะถูก hydrate เข้าสู่ state
    if (isResumeDraft && !hasHydratedDraftRef.current) {
      setSyncStatus("idle");
      return;
    }

    // 🔒 Mutex: If a save is currently in-flight, queue this request so we never send concurrent PUT requests
    if (isSavingRef.current) {
      hasPendingSaveRef.current = true;
      pendingSaveDataRef.current = {
        ...(pendingSaveDataRef.current || {}),
        ...overrideData
      };
      return;
    }

    isSavingRef.current = true;
    const currentSeq = ++saveSeqRef.current;
    try {
      setSyncStatus("saving");
      const currentAnswers = overrideData.answers !== undefined ? overrideData.answers : answers;
      const currentPhotos = overrideData.photos !== undefined ? overrideData.photos : photos;
      const currentComments = overrideData.comments !== undefined ? overrideData.comments : comments;
      const currentSectionIdx = overrideData.sectionIdx !== undefined ? overrideData.sectionIdx : sectionIdx;
      const currentUnit = overrideData.unit || unit;
      const currentForm = overrideData.selectedForm || selectedForm;
      const currentStaffCount = overrideData.staffCount !== undefined ? overrideData.staffCount : staffCount;
      const currentAuditorName = overrideData.auditorName !== undefined ? overrideData.auditorName : auditorName;
      const currentAuditType = overrideData.auditType !== undefined ? overrideData.auditType : auditType;
      const currentExtraNote = overrideData.extraNote !== undefined ? overrideData.extraNote : extraNote;
      const currentMetadataValues = overrideData.metadataValues !== undefined ? overrideData.metadataValues : metadataValues;
      const currentIsBackdated = overrideData.isBackdated !== undefined ? overrideData.isBackdated : isBackdated;
      const currentBackdatedStartDate = overrideData.backdatedStartDate !== undefined ? overrideData.backdatedStartDate : backdatedStartDate;
      const currentBackdatedEndDate = overrideData.backdatedEndDate !== undefined ? overrideData.backdatedEndDate : backdatedEndDate;
      const currentAuditeeSignature = overrideData.auditeeSignature !== undefined ? overrideData.auditeeSignature : auditeeSignature;
      const currentAuditorSignature = overrideData.auditorSignature !== undefined ? overrideData.auditorSignature : auditorSignature;
      const currentAuditeeSignName = overrideData.auditeeSignName !== undefined ? overrideData.auditeeSignName : auditeeSignName;
      const currentCashCounts = overrideData.cashCounts !== undefined ? overrideData.cashCounts : cashCounts;

      if (!currentUnit?.id || !currentForm?.id || step !== "audit") {
        setSyncStatus("idle");
        return;
      }

      const totalAnswered = Object.keys(currentAnswers).length;
      const hasCashData = currentCashCounts && Object.values(currentCashCounts).some(v => v !== "" && v !== "0" && v !== 0);

      if (totalAnswered === 0 && !currentAuditeeSignature && !currentAuditorSignature && !hasCashData) {
        setSyncStatus("idle");
        return;
      }

      const payload = {
        unit: currentUnit,
        formId: currentForm.id,
        sectionIdx: currentSectionIdx,
        answers: currentAnswers,
        photos: currentPhotos,
        comments: currentComments,
        staffCount: currentStaffCount,
        auditorName: currentAuditorName,
        auditType: currentAuditType,
        extraNote: currentExtraNote,
        metadataValues: currentMetadataValues,
        cashCounts: currentCashCounts,
        isBackdated: currentIsBackdated,
        backdatedStartDate: currentBackdatedStartDate,
        backdatedEndDate: currentBackdatedEndDate,
        auditeeSignature: currentAuditeeSignature,
        auditorSignature: currentAuditorSignature,
        auditeeSignName: currentAuditeeSignName,
        startedAt: (() => {
          const effective = auditStartedAtRef.current || auditStartedAt || parsedDraftPayload?.startedAt || new Date().toISOString();
          if (!auditStartedAtRef.current) {
            auditStartedAtRef.current = effective;
            setAuditStartedAt(effective);
          }
          return effective;
        })()
      };

      const totalQuestions = (currentForm?.sections || []).reduce(
        (acc, sec) => acc + (sec.items?.length || 0), 0
      );

      const draftPayloadJson = JSON.stringify(payload);
      const currSchedId = effectiveSchedId;
      const currDraftId = getEffectiveDraftId();

      try {
        if (currSchedId) {
          localStorage.setItem(`qsc_draft_sched_${currSchedId}`, draftPayloadJson);
        } else if (currDraftId) {
          localStorage.setItem(`qsc_draft_id_${currDraftId}`, draftPayloadJson);
        }
        localStorage.setItem(`qsc_draft_${currentUnit.id}_${currentForm.id}`, draftPayloadJson);
      } catch (e) { }

      const res = await api.put('/audit/draft', {
        id: currDraftId,
        locationId: currentUnit.id,
        surveyFormId: currentForm.id,
        auditorId: currentUser?.id || 1,
        auditScheduleId: currSchedId,
        draftPayloadJson: draftPayloadJson,
        currentSectionIdx: currentSectionIdx,
        totalAnswered,
        totalQuestions,
        startLatitude: (realStartGpsRef.current || realStartGps)?.latitude ?? (parsedDraftPayload?.startLatitude ?? null),
        startLongitude: (realStartGpsRef.current || realStartGps)?.longitude ?? (parsedDraftPayload?.startLongitude ?? null),
        startedAt: payload.startedAt
      });

      // 🌟 M2: ป้องกัน race condition ถ้ามี auto-save รอบใหม่กว่าถูกส่งออกไปแล้วขณะที่ request นี้กำลังเดินทาง
      if (currentSeq !== saveSeqRef.current) {
        return;
      }

      if (res?.data?.id) {
        draftIdRef.current = res.data.id;
        setDraftId(res.data.id);
      }

      setSyncStatus("synced");

      const draftObj = {
        id: res?.data?.id || currDraftId,
        auditScheduleId: currSchedId,
        surveyFormId: currentForm.id,
        totalAnswered,
        totalQuestions,
        unit: currentUnit,
        formId: currentForm.id,
        sectionIdx: currentSectionIdx,
        answers: currentAnswers,
        photos: currentPhotos,
        comments: currentComments,
        staffCount: currentStaffCount,
        auditorName: currentAuditorName,
        auditType: currentAuditType,
        extraNote: currentExtraNote,
        metadataValues: currentMetadataValues,
        isBackdated: currentIsBackdated,
        backdatedStartDate: currentBackdatedStartDate,
        backdatedEndDate: currentBackdatedEndDate,
        auditeeSignature: currentAuditeeSignature,
        auditorSignature: currentAuditorSignature,
        auditeeSignName: currentAuditeeSignName,
        locationId: currentUnit.id,
        locationName: currentUnit.name,
        locationFullName: currentUnit.fullName,
        surveyFormTitle: currentForm.title,
        draftPayloadJson: draftPayloadJson,
        totalAnswered,
        totalQuestions,
        savedAt: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
      };

      if (onSaveDraft) onSaveDraft(draftObj);
    } catch (err) {
      if (currentSeq === saveSeqRef.current) {
        setSyncStatus("error");
      }
    } finally {
      isSavingRef.current = false;
      // 🌟 If changes arrived while the previous HTTP save was in-flight, save them immediately now
      if (hasPendingSaveRef.current) {
        hasPendingSaveRef.current = false;
        const queuedData = pendingSaveDataRef.current || {};
        pendingSaveDataRef.current = null;
        performSaveDraft(queuedData);
      }
    }
  };

  useEffect(() => {
    if (!unit?.id || !selectedForm?.id || step !== "audit") {
      setSyncStatus("idle");
      return;
    }

    // 🛡️ ป้องกันไม่ให้ auto-save บันทึกทับร่างเดิมก่อน hydrate เสร็จสมบูรณ์
    if (isResumeDraft && !hasHydratedDraftRef.current) {
      return;
    }

    const totalAnswered = Object.keys(answers || {}).length;
    if (totalAnswered === 0) {
      setSyncStatus("idle");
      return;
    }

    setSyncStatus("saving");
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

    autoSaveTimerRef.current = setTimeout(() => {
      performSaveDraft();
    }, 800);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [
    unit,
    selectedForm,
    sectionIdx,
    answers,
    photos,
    comments,
    staffCount,
    auditorName,
    auditType,
    extraNote,
    metadataValues,
    isBackdated,
    backdatedStartDate,
    backdatedEndDate,
    auditeeSignature,
    auditorSignature,
    auditeeSignName,
    step,
    currentUser
  ]);

  const performSaveDraftRef = useRef(performSaveDraft);
  useEffect(() => {
    performSaveDraftRef.current = performSaveDraft;
  });

  // Flush draft on unmount if any debounce timer is pending
  useEffect(() => {
    return () => {
      if (isDiscardingRef.current) return;
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        performSaveDraftRef.current();
      }
    };
  }, []);

  const paginatedBranchList = useMemo(() => {
    const start = (branchPage - 1) * branchPageSize;
    return sortedBranchList.slice(start, start + branchPageSize);
  }, [sortedBranchList, branchPage]);

  const [photoUploadErrors, setPhotoUploadErrors] = useState({});

  const handlePhotoUpload = useCallback(async (questionId, files) => {
    if (!files || files.length === 0) return;

    setPhotoUploadErrors(prev => {
      if (!prev[questionId]) return prev;
      const next = { ...prev };
      delete next[questionId];
      return next;
    });

    try {
      const rawFileList = Array.from(files);
      const validFiles = [];
      const validationErrors = [];

      for (const file of rawFileList) {
        const check = validateImageFile(file);
        if (!check.valid) {
          validationErrors.push(check.message);
        } else {
          validFiles.push(file);
        }
      }

      if (validationErrors.length > 0) {
        const errText = validationErrors.join(" | ");
        setPhotoUploadErrors(prev => ({
          ...prev,
          [questionId]: errText
        }));
        if (validFiles.length === 0) return;
      }

      const fileList = validFiles;
      const compressedBase64List = await Promise.all(fileList.map(f => compressImageFile(f)));

      // ⚠️ จุดสำคัญ: ห้าม fallback คืน base64 อีกต่อไป เพราะ backend column
      // ImageUrl จำกัดแค่ nvarchar(500) ตัวอักษร แต่ base64 ยาวเป็นแสนตัวอักษร
      const lastBackendError = { msg: null };
      const uploadResults = await Promise.all(
        compressedBase64List.map(async (base64) => {
          try {
            const res = await api.post('/audit/upload-image', { base64Data: base64 });
            const url = res.data?.url;
            if (!url) throw new Error("Upload response missing url");
            return { ok: true, url };
          } catch (uploadErr) {
            console.warn("Photo upload failed:", uploadErr);
            const serverMsg = uploadErr?.response?.data?.message;
            if (serverMsg) lastBackendError.msg = serverMsg;
            return { ok: false };
          }
        })
      );

      const successfulUrls = uploadResults.filter(r => r.ok).map(r => r.url);
      const failedCount = uploadResults.length - successfulUrls.length;

      if (successfulUrls.length > 0) {
        setPhotos(prev => {
          const existing = Array.isArray(prev[questionId])
            ? prev[questionId]
            : (prev[questionId] ? [prev[questionId]] : []);
          const next = { ...prev, [questionId]: [...existing, ...successfulUrls] };
          return next;
        });
      }

      if (failedCount > 0) {
        setPhotoUploadErrors(prev => ({
          ...prev,
          [questionId]: lastBackendError.msg || (failedCount === fileList.length
            ? "อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"
            : `อัปโหลดสำเร็จ ${successfulUrls.length} รูป แต่มี ${failedCount} รูปที่ล้มเหลว กรุณาลองใหม่`)
        }));
      }
    } catch (e) {
      console.error("Compression/Upload error:", e);
      setPhotoUploadErrors(prev => ({ ...prev, [questionId]: "ไม่สามารถประมวลผลรูปภาพได้ กรุณาลองใหม่อีกครั้ง" }));
    }
  }, []);

  const handlePhotoDelete = useCallback((questionId, photoIdx) => {
    setPhotos(prev => {
      const next = { ...prev };
      const existing = Array.isArray(next[questionId])
        ? next[questionId]
        : (next[questionId] ? [next[questionId]] : []);
      if (typeof photoIdx === 'number') {
        const updated = existing.filter((_, i) => i !== photoIdx);
        if (updated.length > 0) {
          next[questionId] = updated;
        } else {
          delete next[questionId];
        }
      } else {
        delete next[questionId];
      }
      return next;
    });
  }, []);

  const handleAnswerSelect = useCallback((questionId, val) => {
    setHighlightedQuestionId(prevHighlighted => (prevHighlighted === questionId ? null : prevHighlighted));

    const isFailing = val === "no" || val === false || (typeof val === "number" && val < 3);

    if (isFailing) {
      setOpenComments(prev => ({ ...prev, [questionId]: true }));
    }

    setAnswers(prev => {
      const next = { ...prev };
      if (next[questionId] === val) {
        delete next[questionId];
      } else {
        next[questionId] = val;
      }
      return next;
    });
  }, []);

  const handleCommentChange = useCallback((questionId, val) => {
    setComments(prev => ({ ...prev, [questionId]: val }));
  }, []);

  const handleToggleComment = useCallback((questionId, currentlyOpen) => {
    setOpenComments(prev => ({ ...prev, [questionId]: !currentlyOpen }));
  }, []);

  const scoreAnalysis = useMemo(() => {
    let earnedScore = 0;
    let maxScore = 0;
    let naCount = 0;
    let hasCriticalDefect = false;
    const failedQuestions = [];

    currentSections.forEach(sec => {
      (sec.items || []).forEach(q => {
        const ans = answers[q.id];

        if (ans === "na") {
          naCount++;
          return;
        }

        const fullScore = (q.fullScore || 10);
        maxScore += fullScore;

        const qType = (q.questionType || q.type || "YESNO").toString().toLowerCase();

        if (qType === "scale" || qType === "rating") {
          const num = Number(ans) || 0;
          earnedScore += (num / 5) * fullScore;
          if (num < 3 && ans !== undefined && ans !== "") {
            failedQuestions.push({ ...q, sectionTitle: sec.title, note: comments[q.id] || `ได้คะแนนเพียง ${num}/5` });
            if (q.isCritical) hasCriticalDefect = true;
          }
        } else {
          if (ans === "yes" || ans === true) {
            earnedScore += fullScore;
          } else if (ans === "no" || ans === false) {
            failedQuestions.push({ ...q, sectionTitle: sec.title, note: comments[q.id] || "ไม่ผ่านเกณฑ์มาตรฐาน" });
            if (q.isCritical) hasCriticalDefect = true;
          }
        }
      });
    });

    const percentage = maxScore > 0 ? Number(((earnedScore / maxScore) * 100).toFixed(2)) : 100;
    const isPassed = percentage >= passingScore && !hasCriticalDefect;

    return { earnedScore, maxScore, percentage, isPassed, hasCriticalDefect, naCount, failedQuestions };
  }, [currentSections, answers, comments, passingScore]);

  const categoryBreakdown = useMemo(() => {
    const catMap = new Map();

    currentSections.forEach((sec) => {
      (sec.items || []).forEach((q) => {
        const catName = getQuestionCategory(q, sec);
        if (!catMap.has(catName)) {
          catMap.set(catName, {
            name: catName,
            totalCount: 0,
            answeredCount: 0,
            earnedScore: 0,
            maxScore: 0,
          });
        }

        const catData = catMap.get(catName);
        catData.totalCount += 1;

        const ans = answers[q.id];
        const isAnswered = ans !== undefined && ans !== null && ans !== "";
        if (isAnswered) {
          catData.answeredCount += 1;
        }

        if (ans === "na") {
          return;
        }

        const fullScore = q.fullScore || 10;
        catData.maxScore += fullScore;

        const qType = (q.questionType || q.type || "YESNO").toString().toLowerCase();
        if (qType === "scale" || qType === "rating") {
          const num = Number(ans) || 0;
          catData.earnedScore += (num / 5) * fullScore;
        } else {
          if (ans === "yes" || ans === true) {
            catData.earnedScore += fullScore;
          }
        }
      });
    });

    const categories = Array.from(catMap.values()).map((cat) => {
      const percentage = cat.maxScore > 0 ? Number(((cat.earnedScore / cat.maxScore) * 100).toFixed(2)) : 0;
      return {
        ...cat,
        percentage,
      };
    });

    // 🌟 Sort categories strictly by the custom sequence (1, 2, 3...) defined in selectedForm
    // (บนสุด 1, รองลงมา 2, 3... ไม่เกี่ยวกับ % คะแนน ตามที่ผู้ใช้กำหนด)
    let formCategoryOrder = null;
    if (selectedForm?.categoryOrderJson) {
      try {
        const parsed = JSON.parse(selectedForm.categoryOrderJson);
        if (Array.isArray(parsed) && parsed.length > 0) formCategoryOrder = parsed;
      } catch (e) {}
    }
    if (!formCategoryOrder && Array.isArray(selectedForm?.categories) && selectedForm.categories.length > 0) {
      formCategoryOrder = selectedForm.categories;
    }

    const effectiveOrder = formCategoryOrder || CORE_CATEGORY_ORDER;

    categories.sort((a, b) => {
      const idxA = effectiveOrder.indexOf(a.name);
      const idxB = effectiveOrder.indexOf(b.name);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.name.localeCompare(b.name, "th");
    });

    return categories;
  }, [currentSections, answers, selectedForm?.categoryOrderJson, selectedForm?.categories]);

  const checkUnansweredQuestions = () => {
    const unanswered = [];
    currentSections.forEach((sec, sIdx) => {
      (sec.items || []).forEach((item, qIdx) => {
        const ans = answers[item.id];
        const isAnswered = ans !== undefined && ans !== null && ans !== "";
        if (!isAnswered) {
          unanswered.push({
            sectionIdx: sIdx,
            sectionTitle: sec.title || `หมวดที่ ${sIdx + 1}`,
            questionId: item.id,
            questionNumber: item.orderIndex || qIdx + 1,
            questionText: item.questionText || item.text || `ข้อที่ ${qIdx + 1}`
          });
        }
      });
    });
    return unanswered;
  };

  const highlightTimerRef = useRef(null);

  const triggerHighlightQuestion = (questionId, targetSectionIdx) => {
    skipScrollToTopRef.current = true;
    if (targetSectionIdx !== undefined && targetSectionIdx !== sectionIdx) {
      setSectionIdx(targetSectionIdx);
    }
    setHighlightedQuestionId(questionId);

    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => {
      setHighlightedQuestionId(null);
    }, 6000);

    let attempts = 0;
    const maxAttempts = 30; // 30 * 50ms = 1.5s

    const tryScroll = () => {
      const el = document.getElementById(`question-card-${questionId}`);
      if (el) {
        // Calculate offset position for sticky headers
        const rect = el.getBoundingClientRect();
        const topOffset = 85;
        const currentScroll = window.scrollY || document.documentElement.scrollTop || document.querySelector('main')?.scrollTop || 0;
        const targetTop = Math.max(0, rect.top + currentScroll - topOffset);

        try {
          window.scrollTo({ top: targetTop, behavior: 'smooth' });
          document.querySelector('main')?.scrollTo({ top: targetTop, behavior: 'smooth' });
        } catch (e) {}

        try {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch (e) {}
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(tryScroll, 50);
      }
    };

    setTimeout(tryScroll, 60);
  };

  const validateEntireAuditForm = () => {
    if (isBackdated) {
      if (!backdatedStartDate?.trim()) {
        setActiveTab(1);
        alert("⚠️ กรุณาระบุวัน-เวลาเริ่มตรวจจริงสำหรับการตรวจย้อนหลัง");
        scrollToTop();
        return false;
      }
      if (!backdatedEndDate?.trim()) {
        setActiveTab(1);
        alert("⚠️ กรุณาระบุวัน-เวลาสิ้นสุดตรวจจริงสำหรับการตรวจย้อนหลัง");
        scrollToTop();
        return false;
      }
      if (new Date(backdatedEndDate) < new Date(backdatedStartDate)) {
        setActiveTab(1);
        alert("⚠️ วัน-เวลาสิ้นสุดตรวจ ต้องไม่เกิดขึ้นก่อนวัน-เวลาเริ่มตรวจ");
        scrollToTop();
        return false;
      }
    }

    for (const field of activeMetadataFields) {
      if (!field.required) continue;

      if (field.type === "auditor" || field.id === "auditor") {
        if (!auditorName?.trim()) {
          setActiveTab(1);
          alert("⚠️ กรุณาระบุผู้ตรวจประเมินในแท็บ 'ข้อมูลการตรวจ'");
          scrollToTop();
          return false;
        }
      }

      if (field.id === "audit_type") {
        if (!auditType?.trim()) {
          setActiveTab(1);
          alert("⚠️ กรุณาเลือกประเภทการตรวจในแท็บ 'ข้อมูลการตรวจ'");
          scrollToTop();
          return false;
        }
      }

      if (field.id === "staff_count") {
        if (staffCount === "" || staffCount === undefined || staffCount === null) {
          setActiveTab(1);
          alert("⚠️ กรุณาระบุจำนวนพนักงานขณะตรวจในแท็บ 'ข้อมูลการตรวจ'");
          scrollToTop();
          return false;
        }
      }

      if (field.id !== "auditor" && field.id !== "audit_type" && field.id !== "staff_count") {
        const val = metadataValues[field.id];
        if (val === undefined || val === null || val === "" || (typeof val === "string" && !val.trim())) {
          setActiveTab(1);
          alert(`⚠️ กรุณากรอกข้อมูล "${field.label}" ในแท็บ 'ข้อมูลการตรวจ'`);
          scrollToTop();
          return false;
        }
      }
    }

    const missing = checkUnansweredQuestions();
    if (missing.length > 0) {
      const firstMissing = missing[0];
      skipScrollToTopRef.current = true;
      setActiveTab(2);
      alert(`⚠️ กรุณาตอบคำถามให้ครบทุกข้อ (ยังเหลืออีก ${missing.length} ข้อที่ยังไม่ได้ตอบ ในหมวด: "${firstMissing.sectionTitle}")`);
      triggerHighlightQuestion(firstMissing.questionId, firstMissing.sectionIdx);
      return false;
    }

    const missingComments = [];
    currentSections.forEach((sec, sIdx) => {
      (sec.items || []).forEach((item, qIdx) => {
        const ans = answers[item.id];
        const isNa = ans === "na";
        const isFailed = !isNa && (
          ans === "no" || 
          ans === false || 
          (typeof ans === "number" && ans < 3) || 
          (!isNaN(Number(ans)) && ans !== "" && ans !== undefined && Number(ans) < 3)
        );

        if (isFailed) {
          const comment = comments[item.id]?.trim();
          if (!comment) {
            missingComments.push({
              sectionIdx: sIdx,
              sectionTitle: sec.title || `หมวดที่ ${sIdx + 1}`,
              questionId: item.id,
              questionNumber: item.orderIndex || qIdx + 1,
              questionText: item.questionText || item.text || `ข้อที่ ${qIdx + 1}`
            });
          }
        }
      });
    });

    if (missingComments.length > 0) {
      const first = missingComments[0];
      skipScrollToTopRef.current = true;
      setActiveTab(2);
      setOpenComments(prev => {
        const next = { ...prev };
        missingComments.forEach(m => { next[m.questionId] = true; });
        return next;
      });
      alert(`⚠️ กรุณาระบุข้อคิดเห็น/เหตุผลสำหรับข้อที่ไม่ผ่านหรือคะแนนต่ำกว่า 3 (ยังขาดอีก ${missingComments.length} ข้อ ในหมวด: "${first.sectionTitle}")`);
      triggerHighlightQuestion(first.questionId, first.sectionIdx);
      return false;
    }

    if (selectedForm?.hasCashAudit) {
      for (const denom of CASH_DENOMINATIONS) {
        const raw = cashCounts[denom];
        if (raw === undefined || raw === null || raw === "" || isNaN(Number(raw)) || Number(raw) < 0) {
          skipScrollToTopRef.current = true;
          setActiveTab(2);
          setIsCashSystemOpen(true);
          setIsPettyCashOpen(true);
          setTimeout(() => {
            const el = document.getElementById("audit-section-cash");
            if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 150);
          alert(`⚠️ กรุณากรอกจำนวนสำหรับเงิน ${denom} บาท ในระบบเงินสด (หากไม่มีให้ใส่ 0)`);
          return false;
        }
      }
    }

    if (!auditeeSignName?.trim()) {
      setActiveTab(3);
      alert("⚠️ กรุณาระบุชื่อ-นามสกุลของผู้รับการตรวจ");
      return false;
    }

    if (!auditeeSignature) {
      setActiveTab(3);
      alert("⚠️ กรุณาลงลายมือชื่อผู้รับการตรวจ ให้เรียบร้อย");
      return false;
    }

    if (!auditorSignature) {
      setActiveTab(3);
      alert("⚠️ กรุณาลงลายมือชื่อผู้ตรวจประเมิน ให้เรียบร้อย");
      return false;
    }

    return true;
  };

  const handleFinalSubmit = async () => {
    if (!validateEntireAuditForm()) {
      setShowConfirmModal(false);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      let endLat = null;
      let endLng = null;

      if ("geolocation" in navigator) {
        try {
          const pos = await new Promise((res, rej) => 
            navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 6000 })
          );
          if (pos?.coords) {
            endLat = pos.coords.latitude;
            endLng = pos.coords.longitude;
          }
        } catch (e) {
          // หากไม่มีสัญญาณ GPS หรือผู้ใช้ไม่อนุญาต ไม่ใช้ fallback (คงเป็น null ตามที่ต้องการ)
        }
      }

      const responses = [];
      currentSections.forEach(sec => {
        (sec.items || []).forEach(q => {
          const ans = answers[q.id];
          const isNa = (ans === "na");
          const qType = (q.questionType || q.type || "YESNO").toString().toLowerCase();
          let isPassed = false;
          let scoreGiven = 0;
          let rawAnswer = String(ans !== undefined ? ans : "yes");

          if (isNa) {
            isPassed = true;
            scoreGiven = 0;
            rawAnswer = "na";
          } else if (qType === "scale") {
            const parsedNum = Number(ans);
            const num = Number.isFinite(parsedNum) ? parsedNum : 0;
            isPassed = num >= 3;
            scoreGiven = Math.round(((num / 5) * (q.fullScore || 10)) * 100) / 100;
            rawAnswer = String(num);
          } else {
            isPassed = (ans === "yes" || ans === true || ans === "true" || ans === 1);
            scoreGiven = isPassed ? (q.fullScore || 10) : 0;
            rawAnswer = isPassed ? "yes" : "no";
          }

          const rawPhotos = photos[q.id];
          const itemPhotos = Array.isArray(rawPhotos)
            ? rawPhotos
            : (rawPhotos ? [rawPhotos] : []);

          responses.push({
            surveyItemId: q.id,
            rawAnswer,
            answerValue: rawAnswer,
            scaleScore: qType === "scale" ? (typeof ans === "number" ? ans : (!isNaN(Number(ans)) ? Number(ans) : 0)) : null,
            scoreGiven,
            isPassed,
            isNa,
            notes: comments[q.id] || "",
            imageUrls: itemPhotos
          });
        });
      });

      const effectiveStartedAt = isBackdated && backdatedStartDate
        ? new Date(backdatedStartDate).toISOString()
        : (auditStartedAtRef.current || auditStartedAt || parsedDraftPayload?.startedAt || new Date().toISOString());

      const effectiveSubmittedAt = isBackdated && backdatedEndDate
        ? new Date(backdatedEndDate).toISOString()
        : new Date().toISOString();

      const targetDraftId = getEffectiveDraftId();
      const targetSchedId = effectiveSchedId;

      const payload = {
        draftId: targetDraftId || null,
        locationId: Number(unit.id),
        surveyFormId: Number(selectedForm?.id || 1),
        primaryAuditorId: currentUser?.id ? Number(currentUser.id) : null,
        auditeeUserId: (unit.managerUserId && Number(unit.managerUserId) > 0) ? Number(unit.managerUserId) : null,
        auditeeNameText: auditeeSignName || unit.managerName || "-",
        auditScheduleId: targetSchedId,
        staffCount: Number(staffCount) || 0,
        auditType: auditType || "announced",
        notes: extraNote || "",
        metadataValuesJson: JSON.stringify({
          ...metadataValues,
          ...(staffCount !== "" && staffCount !== undefined ? { staff_count: staffCount } : {})
        }),
        cashAuditDataJson: selectedForm?.hasCashAudit ? JSON.stringify({
          totalAmount: totalCashAmount,
          items: CASH_DENOMINATIONS.map(denom => ({
            denomination: denom,
            count: Number(cashCounts[denom]) || 0,
            amount: (Number(cashCounts[denom]) || 0) * denom
          }))
        }) : null,
        auditorSignatureUrl: auditorSignature || null,
        auditeeSignatureUrl: auditeeSignature || null,
        signedAt: new Date().toISOString(),
        startLatitude: (realStartGpsRef.current || realStartGps)?.latitude ?? (parsedDraftPayload?.startLatitude ?? null),
        startLongitude: (realStartGpsRef.current || realStartGps)?.longitude ?? (parsedDraftPayload?.startLongitude ?? null),
        endLatitude: endLat,
        endLongitude: endLng,
        isBackdated: Boolean(isBackdated),
        auditDate: effectiveStartedAt,
        startedAt: effectiveStartedAt,
        submittedAt: effectiveSubmittedAt,
        responses
      };

      await api.post('/audit', payload);

      // 🔒 กันไม่ให้ auto-save ยิงเซฟร่างซ้ำตอน component unmount หลังส่งสำเร็จ
      isDiscardingRef.current = true;
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }

      // 🧹 1. Clean localStorage thoroughly for this unit and schedule
      try {
        localStorage.removeItem('qsc_live_audit_draft');
        if (unit?.id) {
          localStorage.removeItem(`qsc_draft_${unit.id}_${selectedForm?.id || 1}`);
          localStorage.removeItem(`qsc_draft_${unit.id}`);
        }
        if (targetSchedId) {
          localStorage.removeItem(`qsc_draft_sched_${targetSchedId}`);
        }
        if (targetDraftId) {
          localStorage.removeItem(`qsc_draft_id_${targetDraftId}`);
        }
        Object.keys(localStorage).forEach(key => {
          if (
            (unit?.id && key.startsWith(`qsc_draft_${unit.id}_`)) ||
            (targetSchedId && key.includes(`sched_${targetSchedId}`)) ||
            (targetDraftId && key.includes(`id_${targetDraftId}`))
          ) {
            localStorage.removeItem(key);
          }
        });
      } catch (e) { }

      // 🧹 2. Defensively call discard API to ensure server drafts are completely removed
      try {
        const discardParams = new URLSearchParams();
        if (targetDraftId) {
          discardParams.append('id', String(targetDraftId));
        } else {
          if (unit?.id) discardParams.append('locationId', String(unit.id));
          if (selectedForm?.id) discardParams.append('surveyFormId', String(selectedForm.id));
          if (targetSchedId) discardParams.append('scheduleId', String(targetSchedId));
          if (currentUser?.id) discardParams.append('auditorId', String(currentUser.id));
        }
        await api.delete(`/audit/draft?${discardParams.toString()}`);
      } catch (e) { }

      // 🧹 3. Reset internal state
      draftIdRef.current = null;
      setDraftId(null);
      setAnswers({});
      setPhotos({});
      setComments({});
      setAuditeeSignature(null);
      setAuditorSignature(null);

      if (onSaveDraft) onSaveDraft(null);
      if (refreshData) await refreshData();

      setShowConfirmModal(false);
      if (onCompleteAudit) onCompleteAudit();
      if (onActiveStateChange) onActiveStateChange(false);
      if (onClearPlan) onClearPlan();
      setStep("select-unit");
    } catch (err) {
      console.error("Submit audit failed:", err);
      const errMsg = err.response?.data?.message || err.message || "เกิดข้อผิดพลาดในการบันทึกผลตรวจ";
      setSubmitError(errMsg);
      alert(`ไม่สามารถส่งผลตรวจได้: ${errMsg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDiscardDraft = async () => {
    isDiscardingRef.current = true;
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    setIsDiscarding(true);
    try {
      const targetDraftId = getEffectiveDraftId();
      const targetScheduleId = effectiveSchedId;
      const targetLocId = unit?.id || preselectedPlan?.locationId;
      const targetFormId = selectedForm?.id || parsedDraftPayload?.formId || preselectedPlan?.surveyFormId || 1;
      const targetAuditorId = currentUser?.id || 1;

      const params = new URLSearchParams();
      if (targetDraftId) {
        params.append('id', String(targetDraftId));
      } else {
        if (targetScheduleId) params.append('scheduleId', String(targetScheduleId));
        if (targetLocId) params.append('locationId', String(targetLocId));
        if (targetFormId) params.append('surveyFormId', String(targetFormId));
        if (targetAuditorId) params.append('auditorId', String(targetAuditorId));
      }

      await api.delete(`/audit/draft?${params.toString()}`);
      try {
        localStorage.removeItem('qsc_live_audit_draft');
        if (targetLocId) {
          localStorage.removeItem(`qsc_draft_${targetLocId}_${targetFormId}`);
          localStorage.removeItem(`qsc_draft_${targetLocId}`);
        }
        if (targetScheduleId) localStorage.removeItem(`qsc_draft_sched_${targetScheduleId}`);
        if (targetDraftId) localStorage.removeItem(`qsc_draft_id_${targetDraftId}`);
        Object.keys(localStorage).forEach(key => {
          if (
            (targetLocId && key.startsWith(`qsc_draft_${targetLocId}_`)) ||
            (targetScheduleId && key.includes(`sched_${targetScheduleId}`)) ||
            (targetDraftId && key.includes(`id_${targetDraftId}`))
          ) {
            localStorage.removeItem(key);
          }
        });
      } catch (e) { }
      if (onSaveDraft) onSaveDraft(null);
      if (refreshData) await refreshData();
    } catch (e) {
      console.error("Failed to discard draft:", e);
    } finally {
      setIsDiscarding(false);
      setShowDiscardConfirmModal(false);
    }

    draftIdRef.current = null;
    setDraftId(null);
    setAnswers({});
    setPhotos({});
    setComments({});
    setAuditeeSignature(null);
    setAuditorSignature(null);
    setSectionIdx(0);
    setIsBackdated(false);
    setBackdatedStartDate("");
    setBackdatedEndDate("");
    setSyncStatus("idle");

    if (setUnit) setUnit(null);
    if (preselectedPlan && onClearPlan) {
      onClearPlan();
    } else {
      setStep("select-unit");
    }
  };

  const handleDiscardDraft = () => {
    setShowDiscardConfirmModal(true);
  };

  // ════════════════════════════════════════════════════════════════════════════
  // STEP 1: SELECT UNIT
  // ════════════════════════════════════════════════════════════════════════════
  if (step === "select-unit") {
    return (
      <div className="page-transition p-4 sm:p-6 space-y-4 w-full max-w-[100%] sm:max-w-[96%] md:max-w-[92%] mx-auto pb-16 animate-in fade-in duration-300">
        <div className="space-y-1">
          <Breadcrumbs
            items={[
              { label: "ตรวจหน้างาน", onClick: onClearPlan },
              { label: "เลือกสาขา" },
            ]}
          />
        </div>

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาชื่อสาขา, แบรนด์, โรงงาน หรือสำนักงาน..."
            value={searchBranch}
            onChange={(e) => setSearchBranch(e.target.value)}
            className="w-full text-xs sm:text-sm pl-8.5 pr-8 py-2 rounded-xl bg-white border border-slate-200 shadow-2xs outline-none font-medium text-slate-800 focus:border-[#0F6659] transition-colors placeholder:text-slate-400 placeholder:font-normal"
          />
          {searchBranch && (
            <button
              type="button"
              onClick={() => setSearchBranch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer rounded-md transition-colors"
              title="ล้างข้อความค้นหา"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {sortedBranchList.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 sm:p-10 border border-slate-200 text-center shadow-2xs space-y-3 my-2">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Search size={22} />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-800">ไม่พบสาขาที่ค้นหา</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                ไม่พบสาขาที่ตรงกับคำค้นหา "{searchBranch}" กรุณาลองค้นหาด้วยชื่อสาขา แบรนด์ หรือภูมิภาคอื่น
              </p>
            </div>
            {searchBranch && (
              <button
                type="button"
                onClick={() => setSearchBranch("")}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition-colors cursor-pointer"
              >
                ล้างคำค้นหา
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {paginatedBranchList.map((u) => {
              const distMeters = getDistanceInMeters(userCoords.latitude, userCoords.longitude, u.latitude, u.longitude);
              const distLabel = formatDistance(distMeters);
              const isPassed = (u.lastScore || 0) >= 85;
              const hasScore = u.lastScore !== undefined && u.lastScore !== null && u.lastScore > 0;

              // รวมชื่อแบรนด์ทั้งหมด
              const brands = (u.locationBrands || [])
                .map(lb => lb.brand?.name || lb.brandName)
                .filter(Boolean);
              if (brands.length === 0 && (u.brand?.name || u.brandName)) {
                brands.push(u.brand?.name || u.brandName);
              }
              const brandText = brands.join(", ");
              const codeText = u.code || u.shortName || "";

              return (
                <button
                  key={u.id || u.name}
                  type="button"
                  onClick={() => {
                    setUnit(u);
                    const matchedForms = formList.filter(f => isFormApplicableToLocation(f, u));
                    if (matchedForms.length > 0) {
                      setSelectedForm(matchedForms[0]);
                    }
                    setStep("select-form");
                  }}
                  className="w-full rounded-2xl p-3.5 sm:p-4 border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-[#0F6659] transition-all cursor-pointer flex items-center justify-between gap-3 text-left group active:scale-[0.99] bg-white"
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    {/* ไอคอนร้านค้าทรงโค้งมน */}
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shrink-0 border transition-all bg-emerald-50 text-[#0F6659] border-emerald-100/80 group-hover:bg-[#0F6659] group-hover:text-white shadow-2xs">
                      <Store size={22} />
                    </div>

                    <div className="min-w-0 flex-1">
                      {/* 1. ชื่อสาขา */}
                      <h3 className="text-sm sm:text-base font-extrabold text-slate-900 group-hover:text-[#0F6659] transition-colors truncate leading-tight">
                        {u.fullName || u.name}
                      </h3>

                      {/* 2. รหัสชื่อตัวย่อ · แบรนด์ */}
                      <p className="text-xs font-semibold text-slate-500 mt-1 truncate flex items-center gap-1.5">
                        {codeText && (
                          <span className="font-extrabold text-slate-700 font-mono tracking-tight shrink-0">
                            {codeText}
                          </span>
                        )}
                        {codeText && brandText && (
                          <span className="w-1 h-1 rounded-full bg-slate-400 shrink-0 mx-0.5 inline-block" />
                        )}
                        {brandText && (
                          <span className="text-slate-500 truncate font-medium">
                            {brandText}
                          </span>
                        )}
                      </p>

                      {/* 3. ระยะห่าง และ คะแนนล่าสุด */}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {/* ระยะห่าง */}
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-600 border border-slate-200/80 shrink-0">
                          <Navigation size={10} className="text-[#0F6659]" />
                          {distLabel}
                        </span>

                        {/* คะแนนล่าสุด */}
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-lg border shrink-0 ${
                          isPassed
                            ? "bg-emerald-50 text-[#0F6659] border-emerald-200/80"
                            : (hasScore
                                ? "bg-amber-50 text-amber-800 border-amber-200/80"
                                : "bg-slate-50 text-slate-500 border-slate-200/80")
                        }`}>
                          คะแนนล่าสุด {u.lastScore !== undefined && u.lastScore !== null ? `${parseFloat(Number(u.lastScore).toFixed(2))}%` : "-"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ปุ่มลูกศรไปข้างหน้าด้านขวา */}
                  <div className="w-8 h-8 rounded-full bg-slate-50 group-hover:bg-emerald-50 text-slate-400 group-hover:text-[#0F6659] flex items-center justify-center shrink-0 transition-all ml-1">
                    <ChevronRight size={16} strokeWidth={2.5} className="group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>
              );
            })}
            {totalBranchPages > 1 && (
            <div className="flex items-center justify-between p-3.5 bg-white rounded-2xl border border-slate-200 text-xs font-semibold text-slate-600 mt-2 shadow-2xs">
              <span>หน้า {branchPage} จาก {totalBranchPages} ({sortedBranchList.length} สาขา)</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setBranchPage(p => Math.max(1, p - 1))}
                  disabled={branchPage === 1}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 cursor-pointer transition-all"
                >
                  ก่อนหน้า
                </button>

                <input
                  type="number"
                  min="1"
                  max={totalBranchPages}
                  value={branchPageInput}
                  onChange={(e) => setBranchPageInput(e.target.value)}
                  onBlur={handleBranchPageSubmit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleBranchPageSubmit();
                      e.currentTarget.blur();
                    }
                  }}
                  className="w-10 h-8 text-center text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-lg outline-none focus:border-[#0F6659] focus:ring-1 focus:ring-[#0F6659] shadow-2xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />

                <button
                  type="button"
                  onClick={() => setBranchPage(p => Math.min(totalBranchPages, p + 1))}
                  disabled={branchPage === totalBranchPages}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 cursor-pointer transition-all"
                >
                  ถัดไป
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

  // ════════════════════════════════════════════════════════════════════════════
  // STEP 2: SELECT FORM
  // ════════════════════════════════════════════════════════════════════════════
  if (step === "select-form") {
    const unitTypeName = unit?.locationType?.name || (typeof unit?.locationType === 'string' ? unit.locationType : "สาขาหน้าร้าน");
    const unitBrands = unit?.locationBrands?.map(lb => lb.brand?.name || lb.brandName).filter(Boolean).join(", ") || "";
    const unitMonthlyStatus = getLocationMonthlyStatus(unit, { auditRecords, activeDrafts, schedules });

    return (
      <div className="page-transition p-4 sm:p-6 space-y-4 w-full max-w-[100%] sm:max-w-[96%] md:max-w-[92%] mx-auto pb-16 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDesktopBack}
            className="hidden lg:flex items-center justify-center w-8 h-8 rounded-xl bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-2xs transition-colors shrink-0 cursor-pointer"
            title="ย้อนกลับไปเลือกสาขา"
          >
            <ChevronLeft size={18} />
          </button>
          <Breadcrumbs
            items={[
              { label: "ตรวจหน้างาน", onClick: onClearPlan },
              { label: `${unit?.name || 'สาขา'}`, onClick: () => setStep("select-unit") },
              { label: "เลือกฟอร์ม" },
            ]}
          />
        </div>

        {/* 🌟 Branch Information Card with Bordered Monthly Status Badge (No Dot, No Time) */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 bg-emerald-50 text-[#0F6659] border border-emerald-200/80 shadow-2xs">
              <Store size={24} />
            </div>
            <div className="min-w-0">
              <h3 className="text-[15px] sm:text-[17px] font-bold text-slate-900 truncate">
                {unit?.fullName || unit?.name || "ไม่ระบุสาขา"}
              </h3>
              <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                {unitBrands ? `${unitBrands}` : ''}
              </p>
            </div>
          </div>

          <div className="shrink-0">
            <LocationStatusBadge statusInfo={unitMonthlyStatus} />
          </div>
        </div>

        {/* Forms Section Header */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-1 px-1">
          <h4 className="text-xs sm:text-sm font-bold text-slate-700">
            แบบฟอร์มที่เปิดให้ใช้งาน
          </h4>
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
            {applicableForms.length} รายการ
          </span>
        </div>

        {applicableForms.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 sm:p-10 border border-slate-200 text-center shadow-xs space-y-4 my-2">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto">
              <AlertCircle size={32} />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-slate-800">ไม่พบแบบฟอร์มที่ตรงกับสาขานี้</h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                สาขา <strong className="text-slate-700">"{unit?.fullName || unit?.name}"</strong> เป็นประเภทสถานที่ 
                <span className="font-semibold text-slate-700"> {unitTypeName}</span> 
                {unitBrands ? <span> (แบรนด์ {unitBrands})</span> : ''} ซึ่งยังไม่มีแบบฟอร์มที่กำหนดไว้สำหรับแบรนด์และประเภทสถานที่นี้
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setStep("select-unit")}
                className="px-5 py-2.5 rounded-2xl bg-[#0F6659] hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold transition-all shadow-xs cursor-pointer inline-flex items-center gap-2"
              >
                <ChevronLeft size={16} />
                <span>เปลี่ยนสาขาที่ต้องการตรวจ</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {applicableForms.map((f) => (
              <button
                key={f.id || f.title}
                type="button"
                onClick={() => { setSelectedForm(f); setStep("audit"); setActiveTab(1); }}
                className={`rounded-3xl p-5 text-left border shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-4 group active:scale-98 ${
                  selectedForm?.id === f.id
                    ? 'border-[#0F6659] bg-emerald-50/40 ring-2 ring-emerald-500/30'
                    : 'bg-white border-slate-200 hover:border-emerald-400'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-extrabold px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700">
                      เกณฑ์ผ่าน {f.passingScore || 85}%
                    </span>
                    <span className="text-xs font-bold text-slate-400">
                      {f.sectionCount !== undefined && f.sectionCount !== null ? f.sectionCount : (f.sections || []).length} หมวดการตรวจ
                    </span>
                  </div>
                  <h3 className="text-[15px] sm:text-[16px] font-bold text-slate-900 group-hover:text-[#0F6659] transition-colors">
                    {f.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1 line-clamp-2">
                    {f.description}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-[13.5px] font-extrabold text-[#0F6659]">เลือกแบบฟอร์มนี้</span>
                  <ChevronRight size={16} className="text-[#0F6659] group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // AUDIT WORKFLOW (3 TABS)
  // ════════════════════════════════════════════════════════════════════════════
  if (step === "audit") {
    if (!unit || !selectedForm) {
      return (
        <div className="w-full min-h-screen bg-slate-50/50 flex flex-col items-center justify-center p-6 space-y-3 pt-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#0F6659]" />
          <p className="text-sm font-semibold text-slate-600">กำลังเตรียมข้อมูลการตรวจ...</p>
        </div>
      );
    }
    const handleProceedToSection = () => {
      for (const field of activeMetadataFields) {
        if (!field.required) continue;

        if (field.type === "auditor" && !auditorName?.trim()) {
          alert("กรุณาระบุผู้ตรวจประเมิน");
          return;
        }

        if (field.id === "audit_type" && !auditType?.trim()) {
          alert("กรุณาเลือกประเภทการตรวจ");
          return;
        }

        if (field.id === "staff_count" && (staffCount === "" || staffCount === undefined)) {
          alert("กรุณาระบุจำนวนพนักงานขณะตรวจ");
          return;
        }

        if (field.id !== "auditor" && field.id !== "audit_type" && field.id !== "staff_count") {
          const val = metadataValues[field.id];
          if (val === undefined || val === null || val === "" || (typeof val === "string" && !val.trim())) {
            alert(`กรุณากรอกข้อมูล "${field.label}"`);
            return;
          }
        }
      }
      setActiveTab(2);
    };

    const handleFinalSubmitTab3 = () => {
      if (!validateEntireAuditForm()) return;
      setShowConfirmModal(true);
    };

    const categoryItems = [
      { id: "details", label: "รายละเอียด", icon: <ClipboardList size={16} />, count: null },
      ...currentSections.map((sec, index) => ({
        id: `section-${index}`,
        label: sec.title || `หมวดที่ ${index + 1}`,
        icon: <span className="text-[11px] font-black">{index + 1}</span>,
        count: `${sec.items?.filter(item => answers[item.id] !== undefined && answers[item.id] !== "").length || 0}/${sec.items?.length || 0}`,
        index,
      })),
      ...(selectedForm?.hasCashAudit ? [{
        id: "cash-audit",
        label: "ระบบเงินสด",
        icon: <Coins size={16} />,
        count: totalCashAmount > 0 ? `฿${totalCashAmount.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : "0 บาท",
      }] : []),
      { id: "summary", label: "สรุป", icon: <FileText size={16} />, count: extraNote?.trim() ? "พิมพ์แล้ว" : null },
      { id: "submit", label: "ลงชื่อและส่งผล", icon: <PenTool size={16} />, count: null },
    ];

    const jumpToCategory = (item) => {
      setIsCategoryDrawerOpen(false);
      if (item.id === "details") {
        setActiveTab(1);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      if (item.id === "cash-audit") {
        setActiveTab(2);
        setIsCashSystemOpen(true);
        setIsPettyCashOpen(true);
        setTimeout(() => {
          const el = document.getElementById("audit-section-cash");
          if (el) {
            const topOffset = 70;
            const elPosition = el.getBoundingClientRect().top;
            const currentScroll = window.scrollY || document.documentElement.scrollTop || document.querySelector('main')?.scrollTop || 0;
            const targetTop = elPosition + currentScroll - topOffset;
            window.scrollTo({ top: targetTop, behavior: "smooth" });
            document.querySelector('main')?.scrollTo({ top: targetTop, behavior: "smooth" });
          } else {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
        }, 150);
        return;
      }
      if (item.id === "summary") {
        setActiveTab(3);
        setTimeout(() => {
          const el = document.getElementById("audit-section-summary");
          if (el) {
            const topOffset = 70;
            const elPosition = el.getBoundingClientRect().top;
            const currentScroll = window.scrollY || document.documentElement.scrollTop || document.querySelector('main')?.scrollTop || 0;
            const targetTop = elPosition + currentScroll - topOffset;
            window.scrollTo({ top: targetTop, behavior: "smooth" });
            document.querySelector('main')?.scrollTo({ top: targetTop, behavior: "smooth" });
          } else {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
        }, 150);
        return;
      }
      if (item.id === "submit") {
        setActiveTab(3);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      // ไม่ให้เด้งขึ้นมาบนสุด
      if (item.index !== undefined) {
        setActiveSectionIndex(item.index);
      }
      if (activeTab !== 2) {
        skipScrollToTopRef.current = true;
        setActiveTab(2);
      }
      // ให้แสดงข้อสอบก่อนค่อยเลื่อนลง
      setTimeout(() => {
        const el = document.getElementById(`audit-section-${item.index}`);
        if (el) {
          const topOffset = 70; // ระยะเผื่อ TopBar ด้านบน
          const elPosition = el.getBoundingClientRect().top;
          const currentScroll = window.scrollY || document.documentElement.scrollTop || document.querySelector('main')?.scrollTop || 0;
          const targetTop = elPosition + currentScroll - topOffset;

          window.scrollTo({ top: targetTop, behavior: "smooth" });
          document.querySelector('main')?.scrollTo({ top: targetTop, behavior: "smooth" });
        }
      }, 150);
    };

    return (
      <div className="w-full min-h-screen bg-slate-50/50 pb-20 pt-[62px]">
        {isCategoryDrawerOpen && typeof document !== "undefined" && createPortal(
          <CategoryNavigationDrawer
            onClose={() => setIsCategoryDrawerOpen(false)}
            categoryItems={categoryItems}
            activeTab={activeTab}
            activeSectionIdx={activeSectionIdx}
            onSelectCategory={jumpToCategory}
          />,
          document.body
        )}
        {/* 🌟 กล่องยุบ-ขยายการ์ดสรุปคะแนนด้านบน เมื่อ scroll */}
        <div className="space-y-2 mb-2">
          {/* Top Summary & Live Score Card */}
          <div className="pt-2.5 pb-2 px-3 sm:px-4">
            <div className="bg-white rounded-3xl p-3.5 sm:p-4 border border-slate-200 shadow-2xs flex items-center justify-between gap-3 sm:gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDesktopBack}
                    className="hidden lg:flex items-center justify-center w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 transition-colors shrink-0 cursor-pointer mr-0.5"
                    title="ย้อนกลับ / บันทึกร่าง"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <h2 className="text-sm sm:text-base font-black text-slate-900 leading-tight truncate">{unit?.fullName || unit?.name}</h2>
                  {syncStatus !== "idle" && (
                    syncStatus === "saving" ? (
                      <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-[10px] font-bold text-amber-700 animate-pulse">
                        <Loader2 size={10} className="animate-spin text-amber-600" /> Syncing...
                      </span>
                    ) : syncStatus === "error" ? (
                      <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-[10px] font-bold text-rose-700">
                        <AlertCircle size={10} className="text-rose-600" /> Error
                      </span>
                    ) : (
                      <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-[#0F6659]">
                        <CheckCircle2 size={10} className="text-[#0F6659]" /> Synced
                      </span>
                    )
                  )}
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5 truncate">{selectedForm?.title}</p>
                <div className="flex items-center gap-2.5 mt-1.5 flex-wrap text-[11px] font-medium text-slate-500">
                  <span className="flex items-center gap-1 min-w-0 max-w-[200px]">
                    <PenTool size={11} className="text-[#0F6659] shrink-0" />
                    <span className="truncate">{auditorName || "ระบุผู้ตรวจ"}</span>
                  </span>
                  <span className="flex items-center gap-1 shrink-0 text-slate-400">
                    <Clock size={11} className="shrink-0" />
                    <span>เริ่ม {new Date(auditStartedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span>
                  </span>
                </div>
              </div>

              <div className="shrink-0 flex flex-col items-center justify-center">
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <path className="text-slate-100" strokeWidth="4" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    <path className={`${scoreAnalysis.percentage >= passingScore ? 'text-emerald-500' : 'text-amber-500'} transition-all duration-1000 ease-out`} strokeDasharray={`${scoreAnalysis.percentage}, 100`} strokeWidth="4" stroke="currentColor" fill="none" strokeLinecap="round" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[12px] sm:text-sm font-black text-slate-800 leading-none">{parseFloat(Number(scoreAnalysis.percentage).toFixed(2))}%</span>
                  </div>
                </div>
                <span className={`text-[9px] sm:text-[10px] font-extrabold mt-1.5 ${scoreAnalysis.isPassed ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {scoreAnalysis.isPassed ? "ผ่านเกณฑ์มาตรฐาน" : "กำลังประเมิน"}
                </span>
                <span className="text-[9px] text-slate-400 font-medium">เกณฑ์ ≥ {passingScore}%</span>
              </div>
            </div>
          </div>

          {/* 📊 Category Scores Breakdown Card */}
          {categoryBreakdown.length > 0 && (
            <div className="px-3 sm:px-4 mb-2">
              <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 border border-slate-200 shadow-2xs transition-all">
                <div
                  className={`flex items-center justify-between gap-2 select-none cursor-pointer ${
                    isCategoryBreakdownExpanded ? "mb-2.5 pb-2 border-b border-slate-100" : ""
                  }`}
                  onClick={() => setIsCategoryBreakdownExpanded(prev => !prev)}
                >
                  <div className="flex items-center gap-1.5">
                    <BarChart3 size={14} className="text-[#0F6659]" />
                    <span className="text-xs font-black text-slate-800 tracking-tight">
                      คะแนนแยกตามหมวดหมู่
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsCategoryBreakdownExpanded(prev => !prev);
                      }}
                      className="flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-lg transition-all cursor-pointer"
                    >
                      <ChevronDown
                        size={13}
                        className={`transition-transform duration-200 ${isCategoryBreakdownExpanded ? "rotate-180" : ""}`}
                      />
                    </button>
                  </div>
                </div>

                {isCategoryBreakdownExpanded && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 animate-in fade-in duration-200">
                    {categoryBreakdown.map((cat) => {
                      const isPassing = cat.percentage >= passingScore;
                      const barColor =
                        cat.answeredCount === 0
                          ? "bg-slate-200"
                          : isPassing
                          ? "bg-emerald-500"
                          : cat.percentage >= 70
                          ? "bg-amber-500"
                          : "bg-rose-500";

                      const textColor =
                        cat.answeredCount === 0
                          ? "text-slate-400"
                          : isPassing
                          ? "text-emerald-700"
                          : cat.percentage >= 70
                          ? "text-amber-700"
                          : "text-rose-700";

                      return (
                        <div key={cat.name} className="flex items-center gap-2.5 py-0.5">
                          <div className="w-44 sm:w-52 shrink-0 truncate text-xs font-bold text-slate-700" title={getCategoryDisplay(cat.name)}>
                            {getCategoryDisplay(cat.name)}
                          </div>

                          <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ease-out ${barColor}`}
                              style={{ width: `${Math.min(100, Math.max(0, cat.percentage))}%` }}
                            />
                          </div>

                          <div className="min-w-[50px] text-right shrink-0">
                            <span className={`font-mono font-black text-xs ${textColor}`}>
                              {parseFloat(Number(cat.percentage).toFixed(2))}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="px-4 mb-4 mt-2">
          <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-2xs">
            {[
              { id: 1, label: "ข้อมูลการตรวจ", icon: <ClipboardList size={14} /> },
              { id: 2, label: "รายการตรวจ", icon: <CheckCheck size={14} /> },
              { id: 3, label: "สรุป & ลงชื่อ", icon: <PenTool size={14} /> }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2 text-[11px] sm:text-xs font-extrabold rounded-xl flex items-center justify-center gap-1.5 transition-all ${activeTab === tab.id
                    ? "bg-[#0F6659] text-white shadow-md"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                  }`}
              >
                {tab.icon}
                <span className="truncate">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="px-4 space-y-4">
          {/* TAB 1: INFO */}
          {activeTab === 1 && (
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-4 animate-in fade-in duration-200">
              {activeMetadataFields.map((field) => {
                if (field.id === "auditor" || field.type === "auditor") {
                  return (
                    <div key={field.id}>
                      <label className="text-xs font-extrabold text-slate-700 block mb-1.5">
                        {field.label} {field.required && <span className="text-rose-500">*</span>}
                      </label>
                      <div className="relative">
                        <select
                          value={auditorName}
                          onChange={(e) => {
                            const val = e.target.value;
                            setAuditorName(val);
                            performSaveDraft({ auditorName: val });
                          }}
                          className="w-full text-xs sm:text-sm pl-4 pr-10 py-3 min-h-[50px] rounded-2xl bg-slate-50 border border-slate-200 outline-none font-medium sm:font-semibold text-slate-700 focus:border-[#0F6659] focus:bg-white transition-all shadow-xs cursor-pointer appearance-none truncate"
                        >
                          <option value="">-- เลือกผู้ตรวจ --</option>
                          {auditorOptions.map(u => (
                            <option key={u.id || u.fullName} value={u.fullName || u.name}>{u.fullName || u.name}</option>
                          ))}
                        </select>
                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                          <ChevronDown size={18} />
                        </div>
                      </div>
                    </div>
                  );
                }

                if (field.id === "audit_type") {
                  const opts = Array.isArray(field.options) && field.options.length > 0
                    ? field.options
                    : ["ตามกำหนดการ", "นอกกำหนดการ", "ปลอมตัว"];
                  return (
                    <div key={field.id}>
                      <label className="text-xs font-extrabold text-slate-700 block mb-1.5">
                        {field.label} {field.required && <span className="text-rose-500">*</span>}
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {opts.map(opt => {
                          const key = opt.includes("นอก") ? "unannounced" : opt.includes("ปลอม") ? "undercover" : "announced";
                          const isSelected = (auditType === key || auditType === opt);
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => {
                                setAuditType(key);
                                performSaveDraft({ auditType: key });
                              }}
                              className={`py-2.5 px-1 rounded-xl text-xs font-bold border transition-all cursor-pointer ${isSelected
                                  ? 'bg-[#0F6659] text-white border-[#0F6659] shadow-2xs'
                                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                }`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                if (field.id === "staff_count") {
                  const currentStaffVal = staffCount !== "" ? staffCount : (metadataValues.staff_count ?? "");
                  return (
                    <div key={field.id} className="w-full">
                      <label className="text-xs font-extrabold text-slate-700 block mb-1.5">
                        {field.label} {field.required && <span className="text-rose-500">*</span>}
                      </label>
                      <div className="relative flex items-center w-full">
                        <input
                          type="number"
                          min="0"
                          value={currentStaffVal}
                          onChange={(e) => {
                            const val = e.target.value;
                            setStaffCount(val);
                            const nextMeta = { ...metadataValues, staff_count: val };
                            setMetadataValues(nextMeta);
                            performSaveDraft({ staffCount: val, metadataValues: nextMeta });
                          }}
                          className="w-full text-xs sm:text-sm py-2.5 px-3 pr-14 rounded-xl border border-slate-200 outline-none font-medium sm:font-bold bg-white text-slate-800 focus:border-[#0F6659] shadow-2xs"
                          placeholder={field.placeholder || "ระบุจำนวน (คน)"}
                        />
                        <div className="absolute right-2 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-bold text-slate-600 select-none pointer-events-none">
                          {field.unit || "คน"}
                        </div>
                      </div>
                    </div>
                  );
                }

                const currentVal = metadataValues[field.id];

                if (field.type === "number") {
                  return (
                    <div key={field.id}>
                      <label className="text-xs font-extrabold text-slate-700 block mb-1.5">
                        {field.label} {field.required && <span className="text-rose-500">*</span>}
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type="number"
                          min={field.min !== undefined ? field.min : 0}
                          max={field.max !== undefined ? field.max : 999999}
                          value={currentVal ?? ""}
                          onChange={(e) => {
                            const next = { ...metadataValues, [field.id]: e.target.value };
                            setMetadataValues(next);
                            performSaveDraft({ metadataValues: next });
                          }}
                          placeholder={field.placeholder || `ระบุตัวเลข${field.unit ? ` (${field.unit})` : ''}`}
                          className="w-full text-xs sm:text-sm py-2.5 px-3 pr-14 rounded-xl border border-slate-200 outline-none font-medium sm:font-bold bg-white focus:border-[#0F6659] shadow-2xs"
                        />
                        {field.unit && (
                          <div className="absolute right-2 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-bold text-slate-600 select-none pointer-events-none">
                            {field.unit}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                if (field.type === "date") {
                  return (
                    <div key={field.id}>
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
                        <Calendar size={13} className="text-[#0F6659]" />
                        <span>{field.label}</span> {field.required && <span className="text-rose-500">*</span>}
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type="date"
                          value={currentVal || ""}
                          onChange={(e) => setMetadataValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                          className="w-full text-xs sm:text-sm py-3 px-3.5 pr-10 rounded-2xl border border-slate-200 outline-none font-medium sm:font-bold bg-white focus:border-[#0F6659] shadow-2xs text-slate-800 min-h-[48px] cursor-pointer"
                        />
                        <Calendar size={18} className="absolute right-3.5 text-[#0F6659] pointer-events-none shrink-0" />
                        {!currentVal && (
                          <div className="absolute inset-0 left-3.5 flex items-center pointer-events-none text-slate-400 text-xs sm:text-sm font-medium">
                            วว/ดด/ปปปป
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                if (field.type === "time") {
                  return (
                    <div key={field.id}>
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
                        <Clock size={13} className="text-[#0F6659]" />
                        <span>{field.label}</span> {field.required && <span className="text-rose-500">*</span>}
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type="time"
                          value={currentVal || ""}
                          onChange={(e) => setMetadataValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                          className="w-full text-xs sm:text-sm py-3 px-3.5 pr-10 rounded-2xl border border-slate-200 outline-none font-medium sm:font-bold bg-white focus:border-[#0F6659] shadow-2xs text-slate-800 min-h-[48px] cursor-pointer"
                        />
                        <Clock size={18} className="absolute right-3.5 text-[#0F6659] pointer-events-none shrink-0" />
                        {!currentVal && (
                          <div className="absolute inset-0 left-3.5 flex items-center pointer-events-none text-slate-400 text-xs sm:text-sm font-medium">
                            --:--
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                if (field.type === "select") {
                  const opts = Array.isArray(field.options) ? field.options : [];
                  const isSmall = opts.length <= 4;
                  return (
                    <div key={field.id}>
                      <label className="text-xs font-extrabold text-slate-700 block mb-1.5">
                        {field.label} {field.required && <span className="text-rose-500">*</span>}
                      </label>
                      {isSmall ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {opts.map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setMetadataValues(prev => ({ ...prev, [field.id]: opt }))}
                              className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${currentVal === opt
                                  ? 'bg-[#0F6659] text-white border-[#0F6659] shadow-2xs'
                                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="relative">
                          <select
                            value={currentVal || ""}
                            onChange={(e) => setMetadataValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                            className="w-full text-xs sm:text-sm pl-4 pr-10 py-3 min-h-[50px] rounded-2xl bg-slate-50 border border-slate-200 outline-none font-medium sm:font-semibold text-slate-700 focus:border-[#0F6659] focus:bg-white transition-all shadow-xs cursor-pointer appearance-none truncate"
                          >
                            <option value="">-- เลือก --</option>
                            {opts.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                            <ChevronDown size={18} />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }

                if (field.type === "toggle") {
                  const isTrue = Boolean(currentVal);
                  return (
                    <div key={field.id} className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                      <div>
                        <span className="text-xs font-extrabold text-slate-800 block">
                          {field.label} {field.required && <span className="text-rose-500">*</span>}
                        </span>
                        {field.placeholder && <span className="text-[11px] text-slate-500">{field.placeholder}</span>}
                      </div>
                      <button
                        type="button"
                        onClick={() => setMetadataValues(prev => ({ ...prev, [field.id]: !isTrue }))}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${isTrue
                            ? 'bg-[#0F6659] text-white shadow-2xs'
                            : 'bg-slate-200 text-slate-600'
                          }`}
                      >
                        {isTrue ? "✓ ใช่ (Yes)" : "ไม่ใช่ (No)"}
                      </button>
                    </div>
                  );
                }

                return (
                  <div key={field.id}>
                    <label className="text-xs font-extrabold text-slate-700 block mb-1.5">
                      {field.label} {field.required && <span className="text-rose-500">*</span>}
                    </label>
                    <textarea
                      rows={2}
                      value={currentVal || ""}
                      onChange={(e) => setMetadataValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                      onInput={(e) => {
                        // 🌟 ยืดขยายความสูงอัตโนมัติตามเนื้อหาที่พิมพ์จริง
                        e.target.style.height = "auto";
                        e.target.style.height = `${Math.max(56, e.target.scrollHeight)}px`;
                      }}
                      placeholder={field.placeholder || "กรอกข้อความหรือหมายเหตุ..."}
                      className="w-full text-xs sm:text-sm placeholder:text-xs sm:placeholder:text-sm p-3.5 rounded-xl border border-slate-200 outline-none font-medium bg-white focus:border-[#0F6659] shadow-2xs resize-y min-h-[46px]"
                    />
                  </div>
                );
              })}

              <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/50 border border-emerald-200/90 space-y-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100/80 text-[#0F6659] flex items-center justify-center shrink-0">
                      <Clock size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-sm sm:text-base font-black text-slate-900 block leading-tight">
                        บันทึกผลการตรวจย้อนหลัง
                      </span>
                      <span className="text-xs sm:text-sm text-slate-600 font-medium block mt-0.5">
                        เปิดใช้งานเมื่อต้องการเพิ่มผลตรวจที่ได้ตรวจจริงในอดีต
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !isBackdated;
                      setIsBackdated(next);
                      if (next && (!backdatedStartDate || !backdatedEndDate)) {
                        const now = new Date();
                        const past = new Date(now.getTime() - 60 * 60 * 1000);
                        const toIsoLocal = (d) => {
                          const pad = (n) => String(n).padStart(2, '0');
                          return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                        };
                        const startStr = backdatedStartDate || toIsoLocal(past);
                        const endStr = backdatedEndDate || toIsoLocal(now);
                        setBackdatedStartDate(startStr);
                        setBackdatedEndDate(endStr);
                        performSaveDraft({ isBackdated: next, backdatedStartDate: startStr, backdatedEndDate: endStr });
                      } else {
                        performSaveDraft({ isBackdated: next });
                      }
                    }}
                    className={`px-4 py-2 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer min-h-[38px] flex items-center justify-center shrink-0 active:scale-95 ${
                      isBackdated ? "bg-[#0F6659] text-white shadow-sm hover:bg-[#0B4E44]" : "bg-slate-200 hover:bg-slate-300 text-slate-700"
                    }`}
                  >
                    {isBackdated ? "เปิด" : "ปิด"}
                  </button>
                </div>

                {isBackdated && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-3 border-t border-emerald-200/60 animate-in fade-in duration-200">
                    <div>
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
                        <Calendar size={14} className="text-[#0F6659]" />
                        <span>เริ่มตรวจจริง</span> <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type="datetime-local"
                          value={backdatedStartDate}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBackdatedStartDate(val);
                            performSaveDraft({ backdatedStartDate: val });
                          }}
                          className="w-full text-xs sm:text-sm py-2.5 px-3.5 pr-10 rounded-xl border border-slate-200 outline-none font-medium sm:font-semibold text-slate-800 focus:border-[#0F6659] shadow-2xs min-h-[44px] cursor-pointer"
                        />
                        <Calendar size={16} className="absolute right-3 text-[#0F6659] pointer-events-none shrink-0" />
                        {!backdatedStartDate && (
                          <div className="absolute inset-0 left-3.5 flex items-center pointer-events-none text-slate-400 text-xs sm:text-sm font-normal">
                            วว/ดด/ปปปป --:--
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
                        <Calendar size={14} className="text-[#0F6659]" />
                        <span>สิ้นสุดตรวจจริง</span> <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type="datetime-local"
                          value={backdatedEndDate}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBackdatedEndDate(val);
                            performSaveDraft({ backdatedEndDate: val });
                          }}
                          className="w-full text-xs sm:text-sm py-2.5 px-3.5 pr-10 rounded-xl border border-slate-200 outline-none font-medium sm:font-semibold text-slate-800 focus:border-[#0F6659] shadow-2xs min-h-[44px] cursor-pointer"
                        />
                        <Calendar size={16} className="absolute right-3 text-[#0F6659] pointer-events-none shrink-0" />
                        {!backdatedEndDate && (
                          <div className="absolute inset-0 left-3.5 flex items-center pointer-events-none text-slate-400 text-xs sm:text-sm font-normal">
                            วว/ดด/ปปปป --:--
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleProceedToSection}
                className="w-full py-4 mt-2 rounded-2xl text-sm font-extrabold bg-[#0F6659] text-white shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer hover:bg-emerald-800 transition-all"
              >
                ไปที่รายการตรวจทั้งหมด <ChevronRight size={16} />
              </button>
              {hasUserAnswers && (
                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={handleDiscardDraft}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-red-600 transition-colors py-2 px-4 rounded-xl hover:bg-red-50"
                  >
                    <Trash2 size={14} />
                    ยกเลิกและลบแบบร่างทั้งหมด
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: QUESTIONS */}
          {activeTab === 2 && (
            <div className="space-y-6">
              {currentSections.map((sec, sIdx) => (
                <div key={sec.id || sIdx} id={`audit-section-${sIdx}`} className="audit-section-anchor space-y-3">
                  {/* 🌟 จุดมาร์คหัวข้อหมวดหมู่: ขนาดเท่าแถบด้านบนหลัก สีเดียวกับพื้นหลัง ตอนปกติไร้เส้นขอบ เมื่อเลื่อนล็อคบนสุดจะเพิ่มเส้นขอบล่างอัตโนมัติ */}
                  <div
                    id={`audit-section-header-${sIdx}`}
                    onClick={() => {
                      setActiveSectionIndex(sIdx);
                      setIsCategoryDrawerOpen(true);
                    }}
                    className={`sticky top-0 z-20 -mx-4 px-4 sm:-mx-6 sm:px-6 min-h-[58px] py-2.5 bg-slate-50/95 backdrop-blur-md flex items-center justify-between gap-2 transition-all duration-200 cursor-pointer group select-none ${
                      activeSectionIndex === sIdx
                        ? "border-b border-slate-200/90 shadow-2xs"
                        : "border-b border-transparent shadow-none"
                    }`}
                    title="แตะเพื่อเลือกหมวดการตรวจ"
                  >
                    <div className="text-sm font-black text-slate-800 flex items-center gap-2 hover:text-[#0F6659] transition-colors min-w-0 flex-1">
                      <span className="w-7 h-7 rounded-xl bg-[#0F6659] text-white flex items-center justify-center shrink-0 text-xs font-black shadow-2xs group-hover:bg-emerald-700 transition-colors">
                        {sIdx + 1}
                      </span>
                      <span className="truncate group-hover:text-[#0F6659] font-black text-slate-800">
                        {sec.title || `หมวดที่ ${sIdx + 1}`}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* 🌟 ปุ่ม ChevronDown ที่คงอยู่ใน DOM เพื่อให้ CSS Transition คลี่ขยายและ Fade เข้าแบบนุ่มนวล */}
                      <span
                        className={`inline-flex items-center justify-center rounded-full bg-slate-200/70 group-hover:bg-emerald-100 text-slate-500 group-hover:text-[#0F6659] shadow-2xs overflow-hidden transition-all duration-300 ease-in-out shrink-0 ${
                          isCategoryDrawerOpen ? "rotate-180 text-[#0F6659] bg-emerald-100" : ""
                        } ${
                          activeSectionIndex === sIdx
                            ? "max-w-[32px] w-8 h-8 opacity-100 scale-100"
                            : "max-w-0 w-0 h-0 opacity-0 scale-0 pointer-events-none"
                        }`}
                      >
                        <ChevronDown size={18} strokeWidth={4} className="shrink-0 transition-transform" />
                      </span>

                      <span className="text-[11px] font-bold text-slate-600 bg-white px-2.5 py-1 rounded-xl border border-slate-200 shadow-2xs shrink-0 group-hover:border-emerald-200 transition-colors">
                        {sec.items?.filter(item => answers[item.id] !== undefined && answers[item.id] !== "").length}/{sec.items?.length || 0} ตอบแล้ว
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {(sec.items || []).map((q, idx) => (
                      <QuestionCard
                        key={q.id || idx}
                        q={q}
                        sec={sec}
                        idx={idx}
                        answer={answers[q.id]}
                        photosForQuestion={photos[q.id]}
                        commentValue={comments[q.id]}
                        openCommentOverride={openComments[q.id]}
                        photoUploadError={photoUploadErrors[q.id]}
                        isHighlighted={highlightedQuestionId === q.id}
                        onAnswerSelect={handleAnswerSelect}
                        onCommentChange={handleCommentChange}
                        onPhotoUpload={handlePhotoUpload}
                        onPhotoDelete={handlePhotoDelete}
                        onToggleComment={handleToggleComment}
                      />
                    ))}
                  </div>
                </div>
              ))}

              {/* 💰 ระบบเงินสด (Cash Audit / Petty Cash System) ตามรูปแรก */}
              {selectedForm?.hasCashAudit && (
                <div id="audit-section-cash" className="audit-section-anchor space-y-3 pt-1">
                  {/* Container หลัก: ระบบเงินสด */}
                  <div className="bg-slate-100/80 rounded-3xl p-3 sm:p-5 border border-slate-200/90 shadow-2xs space-y-3">
                    {/* Header บาร์: ระบบเงินสด พร้อมปุ่มพับเก็บ */}
                    <div
                      onClick={() => setIsCashSystemOpen(prev => !prev)}
                      className="flex items-center justify-between cursor-pointer select-none px-2 py-1"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-[#0F6659] flex items-center justify-center shrink-0 shadow-2xs font-bold">
                          <Coins size={17} />
                        </span>
                        <div>
                          <h3 className="text-sm sm:text-base font-black text-slate-800">
                            ระบบเงินสด
                          </h3>
                          <p className="text-[11px] text-slate-500">
                            ตรวจนับเงินสดตามชนิดธนบัตรและเหรียญ
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-[#0F6659] bg-white px-2.5 py-1 rounded-xl border border-slate-200 shadow-2xs">
                          รวม: ฿{totalCashAmount.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                        </span>
                        <button
                          type="button"
                          className="w-7 h-7 rounded-full bg-white hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors shadow-2xs"
                        >
                          {isCashSystemOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>
                    </div>

                    {/* กล่องย่อย: เงินสดย่อย */}
                    {isCashSystemOpen && (
                      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs space-y-4">
                        <div
                          onClick={() => setIsPettyCashOpen(prev => !prev)}
                          className="flex items-center justify-between cursor-pointer select-none pb-2 border-b border-slate-100"
                        >
                          <div className="flex items-center gap-2">
                            <Banknote size={16} className="text-[#0F6659]" />
                            <h4 className="text-xs sm:text-sm font-black text-slate-800">เงินสดย่อย</h4>
                          </div>
                          <button
                            type="button"
                            className="text-slate-400 hover:text-slate-600 p-1"
                          >
                            {isPettyCashOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                          </button>
                        </div>

                        {isPettyCashOpen && (
                          <div className="space-y-3">
                            {/* ตารางนับเงิน */}
                            <div className="overflow-hidden rounded-xl border border-slate-200/90">
                              <table className="w-full text-xs sm:text-sm text-left border-collapse">
                                <thead>
                                  <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                                    <th className="py-2.5 px-4 w-1/2">ธนบัตร</th>
                                    <th className="py-2.5 px-4 w-1/2 text-right">จำนวน (แบงค์/เหรียญ)</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {CASH_DENOMINATIONS.map((denom) => {
                                    const count = cashCounts[denom] ?? "";
                                    const subtotal = (Number(count) || 0) * denom;
                                    return (
                                      <tr key={denom} className="hover:bg-slate-50/60 transition-colors">
                                        <td className="py-2.5 px-4 font-mono font-bold text-slate-800">
                                          <div className="flex items-center gap-1.5">
                                            <span>{denom >= 1 ? denom.toLocaleString() : denom}</span>
                                            {subtotal > 0 && (
                                              <span className="text-[10px] text-slate-400 font-normal">
                                                (= ฿{subtotal.toLocaleString()})
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                        <td className="py-1.5 px-4 text-right">
                                          <div className="inline-flex items-center justify-end gap-1.5 max-w-[140px] ml-auto">
                                            <input
                                              type="number"
                                              min="0"
                                              step="1"
                                              inputMode="numeric"
                                              pattern="[0-9]*"
                                              value={count}
                                              onChange={(e) => handleCashCountChange(denom, e.target.value)}
                                              onFocus={(e) => {
                                                if (e.target.value === "0") {
                                                  handleCashCountChange(denom, "");
                                                }
                                              }}
                                              onBlur={(e) => {
                                                if (e.target.value === "") {
                                                  handleCashCountChange(denom, "0");
                                                }
                                              }}
                                              placeholder="0"
                                              className="w-full text-right font-mono font-bold text-slate-800 py-1.5 px-3 rounded-lg border border-slate-200 bg-white focus:border-[#0F6659] focus:ring-1 focus:ring-[#0F6659] outline-none text-xs sm:text-sm shadow-2xs transition-all"
                                            />
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                                <tfoot>
                                  <tr className="bg-emerald-50/70 border-t-2 border-emerald-200/80 font-bold text-slate-900">
                                    <td className="py-3 px-4 text-xs sm:text-sm font-black text-slate-900">
                                      รวม
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                      <div className="flex items-center justify-end gap-3">
                                        <span className="font-mono text-sm sm:text-base font-black text-[#0F6659]">
                                          ฿{totalCashAmount.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={handleResetCashCounts}
                                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                          title="ล้างค่าทั้งหมดเป็น 0"
                                        >
                                          <RotateCcw size={15} />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-4">
                <button type="button" onClick={() => setActiveTab(3)} className="w-full py-4 rounded-2xl text-sm font-extrabold bg-[#0F6659] text-white shadow-md active:scale-95 flex items-center justify-center gap-2">
                  ไปที่สรุปและการลงชื่อ <ChevronRight size={16} />
                </button>
              </div>
              {hasUserAnswers && (
                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={handleDiscardDraft}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-red-600 transition-colors py-2 px-4 rounded-xl hover:bg-red-50"
                  >
                    <Trash2 size={14} />
                    ยกเลิกและลบแบบร่างทั้งหมด
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SIGNATURES & SUBMIT */}
          {activeTab === 3 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* 🌟 หมวดหมู่: สรุป (Audit Conclusion & Overall Remarks) - วางก่อนลายเซ็น มีการพิมพ์ตัวอักษรอย่างเดียว */}
              <div id="audit-section-summary" className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#0F6659] border border-emerald-200/60 flex items-center justify-center shrink-0">
                      <FileText size={17} />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-800">สรุปการประเมิน</h3>
                      <p className="text-[11px] font-medium text-slate-500">สรุปผลการตรวจประเมินภาพรวม</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <textarea
                    rows={4}
                    value={extraNote}
                    onChange={(e) => {
                      const val = e.target.value;
                      setExtraNote(val);
                      performSaveDraft({ extraNote: val });
                    }}
                    onInput={(e) => {
                      e.target.style.height = "auto";
                      e.target.style.height = `${Math.max(96, e.target.scrollHeight)}px`;
                    }}
                    placeholder="พิมพ์สรุปผลการตรวจประเมิน ข้อเสนอแนะ..."
                    className="w-full text-xs sm:text-sm placeholder:text-xs sm:placeholder:text-sm p-3.5 rounded-2xl border border-slate-200 outline-none font-medium bg-slate-50/50 focus:bg-white focus:border-[#0F6659] shadow-2xs resize-y min-h-[96px] text-slate-800 leading-relaxed transition-all"
                  />
                </div>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-5">
                <SignaturePad
                  label={`1. ผู้รับการตรวจ (${unit?.fullName || unit?.name})`}
                  signatoryName={auditeeSignName}
                  onSignChange={(sig) => {
                    setAuditeeSignature(sig);
                    performSaveDraft({ auditeeSignature: sig });
                  }}
                  signatureUrl={auditeeSignature}
                />

                <SignaturePad
                  label={`2. ผู้ตรวจประเมิน (${auditorName || defaultAuditorName})`}
                  onSignChange={(sig) => {
                    setAuditorSignature(sig);
                    performSaveDraft({ auditorSignature: sig });
                  }}
                  signatureUrl={auditorSignature}
                />
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-slate-800">สรุปคะแนนประเมิน</h3>
                  <span className={`text-xs font-black px-2.5 py-1 rounded-xl ${scoreAnalysis.isPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                    {parseFloat(Number(scoreAnalysis.percentage).toFixed(2))}%
                  </span>
                </div>
                <div className="space-y-2 text-xs font-medium text-slate-600">
                  <div className="flex justify-between">
                    <span>คะแนนที่ได้</span>
                    <span className="font-bold text-slate-900">{scoreAnalysis.earnedScore.toFixed(1)} / {scoreAnalysis.maxScore}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>ข้อที่ข้าม (N/A)</span>
                    <span className="font-bold text-slate-900">{scoreAnalysis.naCount} ข้อ</span>
                  </div>
                  <div className="flex justify-between text-rose-600">
                    <span>ข้อที่ไม่ผ่าน / บกพร่อง</span>
                    <span className="font-bold">{scoreAnalysis.failedQuestions.length} ข้อ</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleFinalSubmitTab3}
                className="w-full py-4 rounded-3xl text-sm sm:text-base font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-600/20 active:scale-95 flex items-center justify-center gap-2 transition-all"
              >
                <CheckCircle2 size={18} />
                บันทึกและส่งผลตรวจประเมิน
              </button>

              {hasUserAnswers && (
                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={handleDiscardDraft}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-red-600 transition-colors py-2 px-4 rounded-xl hover:bg-red-50"
                  >
                    <Trash2 size={14} />
                    ยกเลิกและลบแบบร่างทั้งหมด
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* CONFIRMATION MODAL */}
        {showConfirmModal && typeof document !== 'undefined' && createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 max-h-[90dvh] overflow-y-auto overscroll-contain">
              <div className="text-center">
                <div className="w-14 h-14 rounded-3xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-3 shadow-2xs">
                  <CheckCircle2 size={32} />
                </div>
                <h3 className="text-xl font-extrabold text-slate-900">ยืนยันการส่งผลตรวจ?</h3>
                <p className="text-xs font-bold text-slate-500 mt-0.5">{unit?.fullName || unit?.name}</p>
              </div>

              <div className={`rounded-2xl p-4 text-center border ${scoreAnalysis.isPassed ? 'bg-emerald-50/70 border-emerald-300' : 'bg-red-50/70 border-red-300'}`}>
                <div className="text-4xl sm:text-5xl font-black mb-2" style={{ color: scoreAnalysis.isPassed ? '#0F6659' : '#B91C1C', fontFamily: mono }}>
                  {parseFloat(Number(scoreAnalysis.percentage).toFixed(2))}%
                </div>
                <div className={`text-xs font-extrabold ${scoreAnalysis.isPassed ? 'text-emerald-800' : 'text-red-800'}`}>
                  {scoreAnalysis.isPassed ? "✓ ผ่านเกณฑ์มาตรฐาน Q.S.C." : "⚠️ ไม่ผ่านเกณฑ์"}
                </div>
              </div>

              {submitError && (
                <div className="bg-rose-50 border border-rose-300 p-3.5 rounded-2xl text-xs font-bold text-rose-800 flex items-start gap-2">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowConfirmModal(false)} disabled={isSubmitting} className="flex-1 py-3.5 rounded-2xl text-xs sm:text-sm font-bold bg-slate-100 hover:bg-slate-200 text-slate-700">
                  ย้อนกลับ
                </button>
                <button type="button" onClick={handleFinalSubmit} disabled={isSubmitting} className="flex-1 py-3.5 rounded-2xl text-xs sm:text-sm font-extrabold bg-[#0F6659] hover:bg-emerald-800 text-white shadow-md flex items-center justify-center gap-2">
                  {isSubmitting ? <><Loader2 size={16} className="animate-spin" /> กำลังบันทึก...</> : <><Check size={16} /> ยืนยันส่งผล</>}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* DISCARD MODAL */}
        {showDiscardConfirmModal && typeof document !== 'undefined' && createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 space-y-4 text-center animate-in zoom-in-95">
              <div className="w-16 h-16 rounded-3xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
                <Trash2 size={28} />
              </div>
              <div>
                <h4 className="text-lg font-black text-slate-900">ยกเลิกร่างการตรวจ?</h4>
                <p className="text-xs text-slate-500 font-medium mt-1 px-2">ข้อมูลที่ตรวจค้างไว้ของสาขานี้จะถูกลบทั้งหมด</p>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDiscardConfirmModal(false)}
                  disabled={isDiscarding}
                  className="py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs disabled:opacity-50"
                >
                  ย้อนกลับ
                </button>
                <button
                  type="button"
                  onClick={confirmDiscardDraft}
                  disabled={isDiscarding}
                  className="py-3 px-4 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isDiscarding ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      กำลังลบ...
                    </>
                  ) : (
                    "ยืนยันลบ"
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* 🌟 Floating Scroll-to-Top Button (ล็อคตรงกับ viewport ผ่าน createPortal ขนาดกะทัดรัด สีเรียบกลืนกับหน้าจอ) */}
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
              isAuditHeaderScrolled
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

  return null;
}