import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Menu, PenTool, RotateCcw, Edit3, Lock, Unlock, AlertCircle, ChevronDown, ChevronLeft, ChevronUp, Store, Navigation, Search, ChevronRight, CheckCircle2, XCircle, Minus, Camera, MessageSquare, Plus, Trash2, Clock, ClipboardList, Check, Loader2, Save, CheckCheck, AlertTriangle, X, Calendar, BarChart3, FileText, RefreshCw, FileSpreadsheet, Eye, Send } from "lucide-react";

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
import DynamicFieldRenderer from "../../shared/DynamicFieldRenderer";
import MultiItemAuditCard from "../../modals/MultiItemAuditCard";
import SwipeToast from "../../shared/SwipeToast";
import { compressImageFile, validateImageFile } from "../../utils/imageCompressor";
import { isFormApplicableToLocation } from "../../utils/formMatching";
import { lockBodyScroll, unlockBodyScroll } from "../../utils/scrollLock";
import signalRService from "../../services/signalrService";
import SyncStatusPill from "../../shared/SyncStatusPill";
import { exportAuditReportToExcel, formatBkk } from "../../utils/exportAuditReport";
import { isItemScored, computeScore, round2 } from "../../config/scoring";

const QuestionCommentInput = React.memo(({ initialValue, onChange, readOnly = false }) => {
  const [localValue, setLocalValue] = useState(initialValue || "");
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    setLocalValue(initialValue || "");
  }, [initialValue]);

  useEffect(() => {
    if (readOnly) return;
    const handler = setTimeout(() => {
      if (localValue !== (initialValue || "")) {
        onChangeRef.current(localValue);
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [localValue, initialValue, readOnly]);

  return (
    <input
      type="text"
      placeholder={readOnly ? "ไม่มีข้อคิดเห็นเพิ่มเติม" : "ข้อคิดเห็น..."}
      value={localValue}
      readOnly={readOnly}
      onChange={(e) => {
        if (!readOnly) setLocalValue(e.target.value);
      }}
      onBlur={() => {
        if (!readOnly && localValue !== (initialValue || "")) {
          onChangeRef.current(localValue);
        }
      }}
      className={`w-full text-xs p-2.5 rounded-xl border outline-none text-slate-800 transition-all ${
        readOnly
          ? "bg-slate-100/90 border-slate-200 text-slate-600 cursor-default select-text"
          : "bg-slate-50/80 border-slate-200 focus:border-[#0F6659] focus:bg-white"
      }`}
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

  if (name) return name;
  if (title) return title;
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
  onToggleComment,
  onViewPhoto,
  auditorOptions,
  readOnly = false
}) {
  const isInfoSec = sec?.sectionType === "INFO";
  const qType = (q.questionType || q.type || "YESNO").toString().toLowerCase();
  const isNonScored = !isItemScored({ ...q, sectionType: sec?.sectionType, sectionTitle: sec?.title });

  const isNa = answer === "na";
  const isScale = qType === "scale" || qType === "rating";
  const isFailed = !isNonScored && !isNa && (answer === "no" || answer === false || (isScale && Number(answer) < 3 && answer !== undefined && answer !== ""));
  const rawP = photosForQuestion;
  const questionPhotos = Array.isArray(rawP) ? rawP : (rawP ? [rawP] : []);
  const hasPhoto = questionPhotos.length > 0;
  const isCommentRequired = isFailed;
  const isCommentOpen = Boolean(isCommentRequired || openCommentOverride || (commentValue && commentValue.trim().length > 0));
  const itemFullScore = Number(q.fullScore ?? q.maxScore ?? 0);
  const scoreGiven = isNonScored ? 0 : (isNa ? 0 : (isScale ? (Number(answer) || 0) / 5 * itemFullScore : ((answer === "yes" || answer === true) ? itemFullScore : 0)));
  const isAnswered = answer !== undefined && answer !== "" && answer !== null;

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
          <span className={`text-[11px] font-black px-1.5 py-0.5 rounded-md ${isFailed ? "text-red-700 bg-red-100" : "text-slate-500 bg-slate-100"}`}>
            {isNonScored ? `รายการที่ ${q.orderIndex || idx + 1}` : `ข้อ ${q.orderIndex || idx + 1}`}
          </span>
          {isNonScored ? (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-[#0F6659] border border-emerald-200">
              ข้อมูลไม่คิดคะแนน
            </span>
          ) : (
            <>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                {q.categoryName || q.category || "ทั่วไป"}
              </span>
              {q.isCritical && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-red-100 text-red-800 border border-red-200">สำคัญ</span>
              )}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${
                isFailed
                  ? "bg-rose-50 text-rose-700 border-rose-200"
                  : isNa
                  ? "bg-slate-100 text-slate-500 border-slate-200"
                  : "bg-emerald-50 text-emerald-700 border-emerald-100"
              }`}>
                คะแนน {isAnswered && !isNa ? scoreGiven : 0} / {itemFullScore}
              </span>
            </>
          )}

          {q.required && isNonScored && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-600 border border-rose-200">
              * บังคับกรอก
            </span>
          )}

          {isHighlighted && (
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-600 text-white animate-bounce">
              {isCommentRequired && !commentValue?.trim() ? "กรุณาระบุข้อคิดเห็น!" : "กรุณาตอบข้อนี้!"}
            </span>
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
            {!readOnly ? (
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
            ) : hasPhoto ? (
              <div
                className="h-9 px-2.5 rounded-xl flex items-center justify-center gap-1.5 border bg-emerald-50 text-[#0F6659] border-emerald-200 select-none"
                title="มีรูปถ่ายหลักฐาน"
              >
                <Camera size={16} />
                <span className="text-[11px] font-black font-mono">
                  {questionPhotos.length}
                </span>
              </div>
            ) : null}
          </div>
        </div>
        <h4 className={`w-full text-sm sm:text-base font-semibold leading-snug break-words [overflow-wrap:anywhere] ${isNa ? "text-slate-400 line-through" : isFailed ? "text-red-700 font-bold" : "text-slate-800"}`}>
          {q.questionText || q.text}
        </h4>
      </div>

      {hasPhoto && (
        <div className="flex items-center gap-2 overflow-x-auto py-1 mb-3 custom-tab-scrollbar">
          {questionPhotos.map((imgUrl, imgIdx) => (
            <div key={imgIdx} className="relative shrink-0 rounded-xl overflow-hidden border border-slate-200 shadow-2xs group">
              <img
                src={imgUrl}
                alt={`Evidence ${imgIdx + 1}`}
                onClick={() => onViewPhoto && onViewPhoto(imgUrl)}
                className="h-20 w-28 object-cover cursor-pointer hover:opacity-90 active:scale-95 transition-all"
                title="คลิกเพื่อดูรูปภาพขนาดเต็ม"
              />
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => onPhotoDelete(q.id, imgIdx)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 hover:bg-rose-600 text-white flex items-center justify-center text-[10px] font-bold cursor-pointer transition-all shadow-sm"
                  title="ลบรูปภาพนี้"
                >
                  ✕
                </button>
              )}
              <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-md bg-black/60 text-white text-[9px] font-bold font-mono">
                #{imgIdx + 1}
              </span>
            </div>
          ))}
          {!readOnly && (
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
          )}
        </div>
      )}

      {photoUploadError && (
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-2.5 py-1.5 mb-3">
          <AlertTriangle size={13} className="shrink-0" />
          <span>{photoUploadError}</span>
        </div>
      )}

      {/* Answer Controls: Non-scored component vs YesNo vs Scale */}
      {isNonScored ? (
        <div className="pt-1">
          {qType === "multians" ? (
            <MultiItemAuditCard
              question={q}
              value={answer}
              onChange={(val) => onAnswerSelect(q.id, val)}
              onPhotoUpload={(subItemId, files) => {
                if (onPhotoUpload && files) {
                  onPhotoUpload(q.id, files);
                }
              }}
              onViewPhoto={onViewPhoto}
              readOnly={readOnly}
            />
          ) : (
            <DynamicFieldRenderer
              type={qType}
              fieldConfig={q.fieldConfig || { options: q.options, unit: q.unit }}
              value={answer}
              onChange={(val) => onAnswerSelect(q.id, val)}
              placeholder={q.placeholder || "ระบุข้อมูล..."}
              auditorOptions={auditorOptions}
              readOnly={readOnly}
            />
          )}
        </div>
      ) : !isScale ? (
        <div className={`grid grid-cols-3 gap-2 ${readOnly ? 'pointer-events-none select-none' : ''}`}>
          <button
            type="button"
            disabled={readOnly}
            onClick={() => onAnswerSelect(q.id, "yes")}
            className={`py-2 px-1.5 sm:py-2.5 sm:px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
              answer === "yes" || answer === true
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-600/30 font-black'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <CheckCircle2 size={14} className={answer === "yes" || answer === true ? "text-white" : ""} />
            <span>ผ่าน</span>
          </button>
          <button
            type="button"
            disabled={readOnly}
            onClick={() => onAnswerSelect(q.id, "no")}
            className={`py-2 px-1.5 sm:py-2.5 sm:px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
              answer === "no" || answer === false
                ? 'bg-rose-600 text-white border-rose-600 shadow-md ring-2 ring-rose-600/30 font-black'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <XCircle size={14} className={answer === "no" || answer === false ? "text-white" : ""} />
            <span>ไม่ผ่าน</span>
          </button>
          <button
            type="button"
            disabled={readOnly}
            onClick={() => onAnswerSelect(q.id, "na")}
            className={`py-2 px-1.5 sm:py-2.5 sm:px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
              answer === "na"
                ? 'bg-slate-700 text-white border-slate-700 shadow-md ring-2 ring-slate-700/30 font-black'
                : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Minus size={14} className={answer === "na" ? "text-white" : ""} />
            <span>ข้าม</span>
          </button>
        </div>
      ) : (
        <div className={`flex gap-1.5 items-center ${readOnly ? 'pointer-events-none select-none' : ''}`}>
          {[5, 4, 3, 2, 1].map((n) => (
            <button
              key={n}
              type="button"
              disabled={readOnly}
              onClick={() => onAnswerSelect(q.id, n)}
              className={`flex-1 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold transition-all border ${
                answer === n
                  ? 'bg-[#0F6659] text-white border-[#0F6659] shadow-md ring-2 ring-[#0F6659]/30 font-black'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            disabled={readOnly}
            onClick={() => onAnswerSelect(q.id, "na")}
            className={`px-2 py-1.5 sm:py-2 rounded-xl flex items-center justify-center text-[10px] font-bold transition-all border ${
              answer === "na"
                ? 'bg-slate-700 text-white border-slate-700 shadow-md font-black'
                : 'bg-slate-50 text-slate-500 border-slate-200'
            }`}
          >
            <Minus size={12} className={`mr-0.5 ${answer === "na" ? "text-white" : ""}`} /> N/A
          </button>
        </div>
      )}

      {isCommentOpen && (
        <div className="mt-3">
          <QuestionCommentInput
            initialValue={commentValue}
            onChange={(val) => onCommentChange(q.id, val)}
            readOnly={readOnly}
          />
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

function SignaturePad({ label, signatoryName, onNameChange, onSignChange, placeholderName = "ระบุชื่อผู้ลงนาม...", signatureUrl, readOnly = false }) {
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
        {hasSigned && !readOnly && (
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
        disabled={readOnly}
        onClick={() => {
          if (!readOnly) setShowModal(true);
        }}
        className={`relative w-full border-2 border-dashed rounded-2xl bg-white overflow-hidden shadow-2xs h-24 sm:h-28 flex items-center justify-center transition-colors ${
          readOnly
            ? "border-slate-200 bg-slate-50/50 cursor-default"
            : "border-slate-300 hover:border-[#0F6659]/50 cursor-pointer"
        }`}
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
            {readOnly ? (
              <span>(ยังไม่มีลายมือชื่อ)</span>
            ) : (
              <>
                <Edit3 size={14} />
                <span>แตะเพื่อเซ็นชื่อ</span>
              </>
            )}
          </div>
        )}
      </button>

      {onNameChange && (
        <input
          type="text"
          value={signatoryName || ''}
          readOnly={readOnly}
          onChange={(e) => {
            if (!readOnly) onNameChange(e.target.value);
          }}
          placeholder={readOnly ? "(ไม่ได้ระบุชื่อผู้ลงนาม)" : placeholderName}
          className={`w-full text-xs p-2.5 rounded-xl border outline-none font-semibold text-slate-800 shadow-2xs ios-zoom-fix-xs ${
            readOnly
              ? "bg-slate-100/90 border-slate-200 cursor-default text-slate-600"
              : "border-slate-200 bg-white focus:border-[#0F6659]"
          }`}
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
                              ((item.id === "summary" || item.id === "submit") && activeTab === 3) ||
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
                  {(item.id === "summary" || item.id === "submit") && <span className="block text-[11px] text-slate-400">สรุปผลการตรวจและลงลายมือชื่อ</span>}
                </div>
                {item.count && (
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-lg shrink-0">
                    {item.count.startsWith("฿") || item.count === "พิมพ์แล้ว" || item.count.includes("แล้ว") ? item.count : `${item.count} ตอบแล้ว`}
                  </span>
                )}
                {itemIndex > 0 && item.id !== "summary" && item.id !== "submit" && <ChevronRight size={14} className="text-slate-300 shrink-0" />}
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

  // 🛡️ ตรวจสอบว่าแบบร่างตรงกับแบบฟอร์มนี้หรือไม่ ถ้าเป็นคนละแบบฟอร์ม (คนละ FormGroupId หรือคนละ Title)
  // ห้ามนำคำตอบมาจับคู่ข้ามฟอร์มเด็ดขาด แต่ถ้าเป็นคนละเวอร์ชันของแบบฟอร์มเดียวกัน ให้ทำการจับคู่คำตอบให้ได้
  const draftFormId = draftPayload.formId || draftPayload.surveyFormId;
  if (draftFormId && Number(draftFormId) !== Number(form.id)) {
    const isSameGroup = form.formGroupId && (
      draftPayload.formGroupId === form.formGroupId ||
      Number(draftPayload.formId) === Number(form.formGroupId) ||
      Number(draftPayload.surveyFormId) === Number(form.formGroupId)
    );
    const isSameTitle = Boolean(
      (form.title && draftPayload.title && form.title.trim() === draftPayload.title.trim()) ||
      (form.title && draftPayload.formTitle && form.title.trim() === draftPayload.formTitle.trim())
    );
    if (!isSameGroup && !isSameTitle) {
      console.warn(`[Draft] Form mismatch: draft was created for form ID ${draftFormId}, but current form is ID ${form.id}. Skipping answer remapping.`);
      return {
        answers: {},
        photos: {},
        comments: {},
        oldToNewIdMap: {}
      };
    }
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

  // 🌟 กลยุทธ์ 0: ใช้ itemLineageMapping จาก MetadataConfigJson ถ้ามี
  let lineageMapping = form.itemLineageMapping || form.metadataConfig?.itemLineageMapping;
  if (!lineageMapping && form.metadataConfigJson) {
    try {
      const parsedMeta = typeof form.metadataConfigJson === 'string' ? JSON.parse(form.metadataConfigJson) : form.metadataConfigJson;
      lineageMapping = parsedMeta?.itemLineageMapping;
    } catch (e) {}
  }

  for (const k of allDraftKeys) {
    if (currentItemIds.has(String(k))) {
      oldToNewIdMap[String(k)] = String(k);
    } else if (lineageMapping && lineageMapping[String(k)] && currentItemIds.has(String(lineageMapping[String(k)]))) {
      oldToNewIdMap[String(k)] = String(lineageMapping[String(k)]);
    } else {
      unmatchedDraftKeys.push(String(k));
    }
  }
  // 🌟 จับคู่เฉพาะข้อที่มี ID เดิมตรงกัน หรือมี DNA lineageMapping 1:1 เท่านั้น
  // ข้อที่ไม่มีการผูกไว้หรือถูกลบออกจากฟอร์มใหม่ จะไม่ถูกเดาลำดับสวมรอย เพื่อป้องกันคำตอบสลับข้อ 100%

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
    answers: mappedAnswers,
    photos: mappedPhotos,
    comments: mappedComments,
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

    // 1. Explicit resume of a draft (e.g. clicked draft card in "กำลังตรวจ")
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

    // 2. Scheduled audit with an existing in-progress draft for that specific schedule
    const schedId = preselectedPlan?.auditScheduleId || (typeof preselectedPlan?.id === 'number' && !preselectedPlan?.isNewAudit ? preselectedPlan.id : null);
    if (schedId && !preselectedPlan?.isNewAudit) {
      const foundBySched = allDrafts.find(d => Number(d.auditScheduleId) === Number(schedId));
      if (foundBySched) return foundBySched;
    }

    // 🌟 Never auto-match drafts by branch & form for a new audit!
    return null;
  }, [preselectedPlan, activeDrafts, activeDraft]);

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

    return null;
  }, [matchedDraftRecord]);

  const isResumeDraft = Boolean(
    !preselectedPlan?.isNewAudit &&
    (preselectedPlan?.isResume || Boolean(matchedDraftRecord)) &&
    parsedDraftPayload
  );

  const effectiveDraftFormId = useMemo(() => {
    if (matchedDraftRecord?.surveyFormId != null && !isNaN(Number(matchedDraftRecord.surveyFormId))) {
      return Number(matchedDraftRecord.surveyFormId);
    }
    if (parsedDraftPayload?.formId != null && !isNaN(Number(parsedDraftPayload.formId))) {
      return Number(parsedDraftPayload.formId);
    }
    if (preselectedPlan?.isResume && preselectedPlan?.surveyFormId != null && !isNaN(Number(preselectedPlan.surveyFormId))) {
      return Number(preselectedPlan.surveyFormId);
    }
    if (targetFormId != null && !isNaN(Number(targetFormId))) {
      return Number(targetFormId);
    }
    return null;
  }, [matchedDraftRecord?.surveyFormId, parsedDraftPayload?.formId, preselectedPlan?.isResume, preselectedPlan?.surveyFormId, targetFormId]);

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
  const [isReadOnlyMode, setIsReadOnlyMode] = useState(() => {
    return Boolean(
      !preselectedPlan?.isNewAudit && (
        isResumeDraft ||
        preselectedPlan?.isResume ||
        preselectedPlan?.status === "in_progress" ||
        preselectedPlan?.type === "draft" ||
        Boolean(initialDraft) ||
        Boolean(matchedDraftRecord)
      )
    );
  });
  const hasInitializedLockRef = useRef(isReadOnlyMode);

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
      ((f.isLatest !== false && f.isLatest !== 0) ||
       Number(f.id) === Number(preselectedPlan?.surveyFormId) ||
       Number(f.id) === Number(targetFormId) ||
       Number(f.id) === Number(effectiveDraftFormId)) &&
      f.isActive !== false && f.isActive !== 0
    );
    if (!unit) return activeLatestForms;
    return activeLatestForms.filter(f => 
      (effectiveDraftFormId && Number(f.id) === Number(effectiveDraftFormId)) ||
      (preselectedPlan?.surveyFormId && Number(f.id) === Number(preselectedPlan.surveyFormId)) ||
      (targetFormId && Number(f.id) === Number(targetFormId)) ||
      isFormApplicableToLocation(f, unit)
    );
  }, [formList, unit, preselectedPlan?.surveyFormId, targetFormId, effectiveDraftFormId]);

  const [selectedForm, setSelectedForm] = useState(() => {
    if (preselectedPlan?.selectedForm) return preselectedPlan.selectedForm;
    const targetFId = effectiveDraftFormId;
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
    const targetFId = effectiveDraftFormId;
    if (targetFId) {
      const found = formList.find(f => Number(f.id) === Number(targetFId));
      if (found && (!selectedForm || Number(selectedForm.id) !== Number(found.id))) {
        setSelectedForm(found);
      } else if (!found && getFormDetail && (!selectedForm || Number(selectedForm.id) !== Number(targetFId))) {
        // 🌟 ดึงข้อมูลฟอร์มเวอร์ชันเดิมของแบบร่างโดยตรงผ่าน API แม้จะเป็นเวอร์ชันเก่าที่ไม่ติดใน summary list
        getFormDetail(targetFId).then(full => {
          if (full && Array.isArray(full.sections)) {
            setSelectedForm(full);
          }
        });
      }
    } else if (!selectedForm && unit && formList && formList.length > 0) {
      const matched = formList.filter(f => isFormApplicableToLocation(f, unit));
      if (matched.length === 1) {
        setSelectedForm(matched[0]);
      }
    }
  }, [formList, effectiveDraftFormId, unit, getFormDetail]);

  const currentSections = selectedForm?.sections || [];
  const passingScore = selectedForm?.passingScore ?? 85;

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
  const loggedInAuditorName = currentUser?.fullName || currentUser?.name || defaultAuditorName || "ผู้ตรวจประเมิน";
  const [auditorName, setAuditorName] = useState(() => {
    if (isResumeDraft && parsedDraftPayload?.auditorName) return parsedDraftPayload.auditorName;
    return currentUser?.fullName || currentUser?.name || defaultAuditorName || "";
  });
  const [metadataValues, setMetadataValues] = useState(() => {
    const meta = parsedDraftPayload?.metadataValues ? { ...parsedDraftPayload.metadataValues } : {};
    if (!meta.auditor) {
      meta.auditor = parsedDraftPayload?.auditorName || currentUser?.fullName || currentUser?.name || defaultAuditorName || "";
    }
    if (!meta.audit_type) {
      meta.audit_type = "ตามกำหนดการ";
    }
    return meta;
  });

  const activeMetadataFields = useMemo(() => {
    let fields = null;
    if (selectedForm?.metadataConfig && Array.isArray(selectedForm.metadataConfig) && selectedForm.metadataConfig.length > 0) {
      fields = selectedForm.metadataConfig;
    } else if (selectedForm?.metadataConfigJson) {
      try {
        const parsed = JSON.parse(selectedForm.metadataConfigJson);
        if (Array.isArray(parsed) && parsed.length > 0) {
          fields = parsed;
        } else if (parsed?.metadataJson) {
          const inner = typeof parsed.metadataJson === "string" ? JSON.parse(parsed.metadataJson) : parsed.metadataJson;
          if (Array.isArray(inner) && inner.length > 0) fields = inner;
        }
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
    if (parsedDraftPayload?.metadataValues?.audit_type) {
      const raw = String(parsedDraftPayload.metadataValues.audit_type).toLowerCase();
      if (raw.includes("ปลอม") || raw === "undercover") return "undercover";
      if (raw.includes("นอก") || raw === "spot" || raw === "unannounced") return "spot";
      return "announced";
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
  const [showSaveTime, setShowSaveTime] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState(() =>
    new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
  );
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
  const performSaveDraftRef = useRef(null);
  const saveSeqRef = useRef(0);
  const realStartGpsRef = useRef(realStartGps);
  useEffect(() => {
    realStartGpsRef.current = realStartGps;
  }, [realStartGps]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const isSubmittedSuccessRef = useRef(false);
  const [remoteSubmittedInfo, setRemoteSubmittedInfo] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [isCategoryBreakdownExpanded, setIsCategoryBreakdownExpanded] = useState(true);
  const [isAuditHeaderScrolled, setIsAuditHeaderScrolled] = useState(false);
  const [isCategoryDrawerOpen, setIsCategoryDrawerOpen] = useState(false);
  // 🌟 หมวดคำถามที่กำลังเลื่อนผ่านอยู่ ณ ขณะนี้ (ตั้งต้นเป็น null เพื่อไม่ให้โผล่ก่อนเลื่อน)
  const [activeSectionIndex, setActiveSectionIndex] = useState(null);
  const activeSectionIdx = activeSectionIndex ?? 0;
  const [previewImageUrl, setPreviewImageUrl] = useState(null);

  useEffect(() => {
    if (!previewImageUrl) return;
    lockBodyScroll();
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setPreviewImageUrl(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      unlockBodyScroll();
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [previewImageUrl]);

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
  const hydratedFormIdRef = useRef(null);
  useEffect(() => {
    if (parsedDraftPayload && isResumeDraft) {
      const currentForm = selectedForm || formList.find(f => f.id === parsedDraftPayload.formId);

      // 🌟 forms จาก context เป็น summary ก่อน (ไม่มี sections) ให้รอ hydrate เต็มก่อน
      // ไม่งั้น currentItemIds จะว่างเปล่าเสมอ ทำให้การกรองคำตอบเก่า (stale answers) ไม่ทำงานเลย
      // (useEffect ที่ hydrate selectedForm ด้านบนจะทำให้ effect นี้รันใหม่เองเมื่อโหลดเสร็จ)
      if (currentForm?.id && !Array.isArray(currentForm.sections)) {
        return;
      }

      if (hasHydratedDraftRef.current && hydratedFormIdRef.current === currentForm?.id) {
        return;
      }

      hasHydratedDraftRef.current = true;
      hydratedFormIdRef.current = currentForm?.id || null;
      if (!hasInitializedLockRef.current) {
        hasInitializedLockRef.current = true;
        setIsReadOnlyMode(true);
      }

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
      if (parsedDraftPayload.metadataValues) {
        setMetadataValues(parsedDraftPayload.metadataValues);
      } else if (parsedDraftPayload.auditorName && parsedDraftPayload.auditorName !== (currentUser?.fullName || currentUser?.name)) {
        setMetadataValues(prev => ({ ...prev, auditor: parsedDraftPayload.auditorName }));
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
      if (parsedDraftPayload.savedAt) {
        setLastSavedTime(parsedDraftPayload.savedAt);
      }
      if (parsedDraftPayload.sectionIdx !== undefined) {
        setSectionIdx(parsedDraftPayload.sectionIdx);
      }
      if (parsedDraftPayload.unit && !unit) {
        if (!targetLocationId || Number(parsedDraftPayload.unit.id) === Number(targetLocationId)) {
          setUnit(parsedDraftPayload.unit);
        }
      }
      if (parsedDraftPayload.startedAt) {
        setAuditStartedAt(parsedDraftPayload.startedAt);
        auditStartedAtRef.current = parsedDraftPayload.startedAt;
      }
      if (parsedDraftPayload.formId && (!selectedForm || Number(selectedForm.id) !== Number(parsedDraftPayload.formId))) {
        if (!targetFormId || Number(targetFormId) === Number(parsedDraftPayload.formId)) {
          const foundForm = formList.find(f => Number(f.id) === Number(parsedDraftPayload.formId));
          if (foundForm) setSelectedForm(foundForm);
        }
      }
      setStep("audit");
      setActiveTab(1);
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

  // 🌟 บันทึกสถานะหน้าตรวจงานลง sessionStorage ให้ตรงกับโครงสร้างที่ MainDashboard รอรับ
  useEffect(() => {
    if (step === "audit" && unit?.id && selectedForm?.id) {
      try {
        const currentLocalDraft = localStorage.getItem(`qsc_draft_${unit.id}_${selectedForm.id}`);
        const sessionData = {
          screen: "audit",
          plan: {
            isResume: true,
            locationId: unit.id,
            surveyFormId: selectedForm.id,
            unit: unit,
            selectedForm: selectedForm,
            id: getEffectiveDraftId(),
            auditScheduleId: effectiveSchedId,
            draftPayloadJson: currentLocalDraft || null
          }
        };
        sessionStorage.setItem("qsc_active_audit_session", JSON.stringify(sessionData));
      } catch (e) {}
    }
  }, [step, unit, selectedForm, effectiveSchedId]);

  const isMigratingDraftRef = useRef(false);
  const [isMigratingDraft, setIsMigratingDraft] = useState(false);

  const newerFormVersion = useMemo(() => {
    if (!selectedForm || step !== "audit") return null;

    // 1. Check if matchedDraftRecord has isFormOutdated
    if (matchedDraftRecord?.isFormOutdated && matchedDraftRecord?.latestFormId) {
      if (Number(selectedForm.id) !== Number(matchedDraftRecord.latestFormId)) {
        return {
          latestFormId: matchedDraftRecord.latestFormId,
          latestVersion: matchedDraftRecord.latestFormVersion || "ล่าสุด"
        };
      }
    }

    // 2. Check if selectedForm is not latest (matches strictly by formGroupId or root Id)
    if (selectedForm.isLatest === false || selectedForm.isLatest === 0) {
      const grpId = selectedForm.formGroupId ?? selectedForm.id;
      const latest = (forms || []).find(f => 
        (f.formGroupId ?? f.id) === grpId &&
        (f.isLatest === true || f.isLatest === 1) &&
        Number(f.id) !== Number(selectedForm.id)
      );
      if (latest) {
        return {
          latestFormId: latest.id,
          latestVersion: latest.version || "ล่าสุด"
        };
      }
    }

    return null;
  }, [selectedForm, step, matchedDraftRecord, forms]);

  // 🔔 SwipeToast แจ้งเตือนเมื่อตรวจพบฟอร์มเวอร์ชันใหม่
  const [showNewFormToast, setShowNewFormToast] = useState(false);

  useEffect(() => {
    if (newerFormVersion && step === "audit") {
      setShowNewFormToast(true);
    } else {
      setShowNewFormToast(false);
    }
  }, [newerFormVersion?.latestVersion, newerFormVersion?.latestFormId, step]);

  const handleMigrateDraft = async () => {
    const versionText = newerFormVersion?.latestVersion ? ` (${newerFormVersion.latestVersion})` : "";
    const ok = window.confirm(
      `การเปลี่ยนเวอร์ชันฟอร์มใหม่ อาจจะทำให้ข้อมูลคำตอบบางข้อหายได้`
    );
    if (!ok) return;

    // 1. 🛡️ เซิร์ฟเวอร์ย้ายเวอร์ชันจากแบบร่างที่บันทึกไว้ จึงต้องบันทึกข้อมูลที่ค้างอยู่ก่อนเริ่มย้าย
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    const queuedBeforeMigrate = pendingSaveDataRef.current || {};
    pendingSaveDataRef.current = null;
    await performSaveDraft(queuedBeforeMigrate);
    for (let i = 0; i < 20 && (isSavingRef.current || hasPendingSaveRef.current); i++) {
      await new Promise(r => setTimeout(r, 150));
    }

    const currentEffDraftId = getEffectiveDraftId();
    if (!currentEffDraftId) {
      alert("ไม่พบแบบร่างในระบบ กรุณาลองใหม่อีกครั้ง");
      return;
    }

    isMigratingDraftRef.current = true;
    setIsMigratingDraft(true);

    try {
      // 2. Call backend migration API
      const res = await api.post(`/audit/draft/${currentEffDraftId}/migrate`);

      if (res.data?.alreadyLatest) {
        if (refreshData) await refreshData();
        alert("ฟอร์มนี้เป็นเวอร์ชันล่าสุดแล้ว");
        return;
      }

      const newFormId = res.data?.newFormId;
      if (!newFormId) {
        throw new Error("ไม่พบฟอร์มเวอร์ชันใหม่ จึงยังไม่ได้ย้ายแบบร่าง");
      }
      const newVersion = res.data?.newVersion || "ล่าสุด";

      // 3. Fetch the full new form details from API
      const formRes = await api.get(`/form/${newFormId}`);
      const fullNewForm = formRes.data;

      // 4. Update selectedForm to the new form and update hydrated ref to prevent stale re-hydration
      hydratedFormIdRef.current = newFormId;
      hasHydratedDraftRef.current = true;
      setSelectedForm(fullNewForm);

      // 5. Apply re-mapped answers directly from migration response
      const rawPayload = res.data?.draftPayloadJson;
      if (rawPayload) {
        try {
          const parsed = typeof rawPayload === "string" ? JSON.parse(rawPayload) : rawPayload;
          if (parsed.answers) setAnswers(parsed.answers);
          if (parsed.photos) setPhotos(parsed.photos);
          if (parsed.comments) setComments(parsed.comments);
        } catch (e) {
          console.warn("Parse migrated draftPayloadJson failed:", e);
        }
      }

      // 6. Clean old storage keys and save new draft key (with safe backup copy)
      try {
        const oldFId = res.data?.oldFormId || selectedForm?.id;
        if (unit?.id && oldFId) {
          const oldKey = `qsc_draft_${unit.id}_${oldFId}`;
          const prevDraft = localStorage.getItem(oldKey);
          if (prevDraft) {
            localStorage.setItem(`qsc_draft_backup_${currentEffDraftId}`, prevDraft);
          }
          localStorage.removeItem(oldKey);
        }
        if (unit?.id && newFormId && res.data?.draftPayloadJson) {
          const payloadStr = typeof res.data.draftPayloadJson === "string"
            ? res.data.draftPayloadJson
            : JSON.stringify(res.data.draftPayloadJson);
          localStorage.setItem(`qsc_draft_${unit.id}_${newFormId}`, payloadStr);
        }
        const activeSession = sessionStorage.getItem("qsc_active_audit_session");
        if (activeSession) {
          const sessionData = JSON.parse(activeSession);
          if (sessionData?.plan) {
            sessionData.plan.surveyFormId = newFormId;
            sessionStorage.setItem("qsc_active_audit_session", JSON.stringify(sessionData));
          }
        }
      } catch (e) {}

      // 7. Refresh global data context once
      if (refreshData) await refreshData();

      alert(`✅ ย้ายคำตอบไปยังฟอร์มเวอร์ชันใหม่ (${newVersion}) สำเร็จแล้ว!`);
    } catch (err) {
      console.error("Failed to migrate draft:", err);
      alert(err.response?.data?.message || err.message || "เกิดข้อผิดพลาดในการย้ายแบบร่าง กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsMigratingDraft(false);
      setTimeout(() => {
        isMigratingDraftRef.current = false;
      }, 800);
    }
  };


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

  // 🌟 โหมดบันทึกด้วยมือ: จดข้อที่เครื่องนี้แก้แล้วแต่ยังไม่กดบันทึก
  // เพื่อให้ข้อมูลที่เครื่องอื่นบันทึกเข้ามาไม่ทับข้อที่ผู้ใช้เครื่องนี้กำลังแก้อยู่
  const dirtyKeysRef = useRef({
    answers: new Set(),
    photos: new Set(),
    comments: new Set(),
    metadataValues: new Set()
  });
  const latestMapsRef = useRef({ answers: {}, photos: {}, comments: {}, metadataValues: {} });
  const lastSaveOkRef = useRef(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isLocalSaving, setIsLocalSaving] = useState(false);
  // true = ถ้าผู้ใช้ออกจากหน้านี้ด้วยวิธีอื่นที่ไม่ใช่ปุ่มย้อนกลับ (เช่น กดเมนูไปหน้าอื่น) ให้บันทึกให้ก่อนเพื่อกันข้อมูลหาย
  // ตั้งเป็น false ถ้าต้องการให้บันทึกด้วยปุ่มเท่านั้นจริงๆ
  const saveOnLeaveSafetyNet = true;

  useEffect(() => {
    latestMapsRef.current = { answers, photos, comments, metadataValues };
  });

  const hasUnsavedLocalChanges = () => {
    if (isDiscardingRef.current || isSubmittedSuccessRef.current) return false;
    const pending = pendingSaveDataRef.current;
    if (pending && Object.keys(pending).length > 0) return true;
    return Object.values(dirtyKeysRef.current).some((set) => set.size > 0);
  };

  const discardLocalUnsaved = () => {
    pendingSaveDataRef.current = null;
    hasPendingSaveRef.current = false;
    dirtyKeysRef.current = {
      answers: new Set(),
      photos: new Set(),
      comments: new Set(),
      metadataValues: new Set()
    };
    isAnswerModifiedRef.current = false;
    setHasUnsavedChanges(false);
  };

  // ถามยืนยันก่อนออกจากหน้าตรวจ ถ้ายังมีข้อมูลที่ไม่ได้กดบันทึก (คืนค่า true = ออกได้)
  const confirmLeaveIfUnsaved = () => {
    if (!hasUnsavedLocalChanges()) return true;
    const ok = window.confirm(
      "มีข้อมูลที่ยังไม่ได้กดบันทึก ถ้าออกตอนนี้ข้อมูลส่วนนั้นจะหายไป\n\nกด OK เพื่อออกโดยไม่บันทึก หรือกด Cancel เพื่ออยู่ต่อแล้วกดปุ่มบันทึก"
    );
    if (!ok) return false;
    discardLocalUnsaved();
    return true;
  };

  const handleDesktopBack = useCallback(() => {
    if (step === "select-form") {
      setStep("select-unit");
    } else if (step === "audit") {
      if (isResumeDraft || isFromAssignedPlan) {
        if (!confirmLeaveIfUnsaved()) return;
        if (onBackRef.current) onBackRef.current(true);
        return;
      }
      if (!confirmLeaveIfUnsaved()) return;
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
  }, [step]);

  const isAnswerModifiedRef = useRef(false);
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

    // 🛡️ ป้องกันไม่ให้ auto-save บันทึกทับขณะกำลังกดย้ายฟอร์มใหม่
    if (isMigratingDraft || isMigratingDraftRef.current) {
      setSyncStatus("idle");
      return;
    }

    // 🛡️ ป้องกันไม่ให้ auto-save บันทึกขณะอยู่ในโหมดล็อก (ดูอย่างเดียว)
    if (isReadOnlyMode) {
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
      lastSaveOkRef.current = false;
      let saveOk = false;
      // แยกชุด "ข้อที่แก้ค้าง" ที่กำลังจะถูกบันทึกออกมา ข้อที่แก้ระหว่างรอ request จะถูกจดเป็นชุดใหม่
      const sentDirty = dirtyKeysRef.current;
      dirtyKeysRef.current = {
        answers: new Set(),
        photos: new Set(),
        comments: new Set(),
        metadataValues: new Set()
      };
      const currentAnswers = overrideData.answers !== undefined ? overrideData.answers : answers;
      const currentPhotos = overrideData.photos !== undefined ? overrideData.photos : photos;
      const currentComments = overrideData.comments !== undefined ? overrideData.comments : comments;
      const currentSectionIdx = overrideData.sectionIdx !== undefined ? overrideData.sectionIdx : sectionIdx;
      const currentUnit = overrideData.unit || unit;
      const currentForm = overrideData.selectedForm || selectedForm;
      const currentStaffCount = overrideData.staffCount !== undefined ? overrideData.staffCount : staffCount;
      const currentAuditorName = overrideData.auditorName !== undefined ? overrideData.auditorName : (loggedInAuditorName || auditorName);
      const currentAuditType = overrideData.auditType !== undefined ? overrideData.auditType : auditType;
      const currentExtraNote = overrideData.extraNote !== undefined ? overrideData.extraNote : extraNote;
      const currentMetadataValues = overrideData.metadataValues !== undefined ? overrideData.metadataValues : metadataValues;
      const currentIsBackdated = overrideData.isBackdated !== undefined ? overrideData.isBackdated : isBackdated;
      const currentBackdatedStartDate = overrideData.backdatedStartDate !== undefined ? overrideData.backdatedStartDate : backdatedStartDate;
      const currentBackdatedEndDate = overrideData.backdatedEndDate !== undefined ? overrideData.backdatedEndDate : backdatedEndDate;
      const currentAuditeeSignature = overrideData.auditeeSignature !== undefined ? overrideData.auditeeSignature : auditeeSignature;
      const currentAuditorSignature = overrideData.auditorSignature !== undefined ? overrideData.auditorSignature : auditorSignature;
      const currentAuditeeSignName = overrideData.auditeeSignName !== undefined ? overrideData.auditeeSignName : auditeeSignName;

      if (!currentUnit?.id || !currentForm?.id || step !== "audit") {
        setSyncStatus("idle");
        return;
      }

      const totalAnswered = Object.keys(currentAnswers).length;
      const hasMetadata = Object.keys(currentMetadataValues || {}).length > 0;
      const hasComments = Object.keys(currentComments || {}).length > 0;
      const hasPhotos = Object.keys(currentPhotos || {}).length > 0;
      const hasAnyData = totalAnswered > 0 || hasMetadata || hasComments || hasPhotos || currentIsBackdated || currentStaffCount || currentExtraNote || currentAuditeeSignature || currentAuditorSignature;

      if (!hasAnyData && !isAnswerModifiedRef.current) {
        setSyncStatus("idle");
        return;
      }
      const currentTimeStr = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

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
        isBackdated: currentIsBackdated,
        backdatedStartDate: currentBackdatedStartDate,
        backdatedEndDate: currentBackdatedEndDate,
        auditeeSignature: currentAuditeeSignature,
        auditorSignature: currentAuditorSignature,
        auditeeSignName: currentAuditeeSignName,
        savedAt: currentTimeStr,
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

      const isExplicitNewAudit = Boolean(preselectedPlan?.isNewAudit && !currDraftId);
      // 🌟 หน่วงเวลาอย่างน้อย ~520ms เพื่อให้ผู้ใช้เห็นจังหวะหมุนทำงานอย่างนุ่มนวล ไม่วาบหายทันที
      const [res] = await Promise.all([
        api.put('/audit/draft', {
          id: currDraftId,
          locationId: currentUnit.id,
          surveyFormId: currentForm.id,
          auditorId: currentUser?.id ? Number(currentUser.id) : null,
          auditScheduleId: currSchedId,
          draftPayloadJson: draftPayloadJson,
          currentSectionIdx: currentSectionIdx,
          totalAnswered,
          totalQuestions,
          startLatitude: (realStartGpsRef.current || realStartGps)?.latitude ?? (parsedDraftPayload?.startLatitude ?? null),
          startLongitude: (realStartGpsRef.current || realStartGps)?.longitude ?? (parsedDraftPayload?.startLongitude ?? null),
          startedAt: payload.startedAt,
          isNewAudit: isExplicitNewAudit
        }),
        new Promise((resolve) => setTimeout(resolve, 350))
      ]);

      saveOk = true;
      lastSaveOkRef.current = true;

      // 🌟 M2: ป้องกัน race condition ถ้ามี auto-save รอบใหม่กว่าถูกส่งออกไปแล้วขณะที่ request นี้กำลังเดินทาง
      if (currentSeq !== saveSeqRef.current) {
        return;
      }

      if (res?.data?.id) {
        const newId = res.data.id;
        const prevId = draftIdRef.current;
        draftIdRef.current = newId;
        setDraftId(newId);
        if (!prevId || prevId !== newId) {
          signalRService.joinAuditRoom(`audit_draft_${newId}`);
        }
      }

      // 🌟 ถ้าระหว่างรอ request มีการแก้เพิ่ม ให้ยังถือว่ามีข้อมูลที่ยังไม่บันทึก
      const stillUnsaved = hasUnsavedLocalChanges();
      isAnswerModifiedRef.current = stillUnsaved;
      setHasUnsavedChanges(stillUnsaved);
      setLastSavedTime(currentTimeStr);
      setSyncStatus(stillUnsaved ? "unsaved" : "synced");

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
      if (err.response?.status === 409) {
        // 409 Conflict: draft was updated/migrated from another device or session
        console.warn("Draft version conflict (409):", err.response?.data?.message);
        if (refreshData) refreshData();
      }
    } finally {
      isSavingRef.current = false;
      if (!saveOk) {
        // บันทึกไม่สำเร็จ/ถูกบล็อก → คืนรายการข้อที่แก้ค้างกลับไป เพื่อให้กดบันทึกซ้ำได้
        let restored = false;
        Object.keys(sentDirty).forEach((field) => {
          sentDirty[field].forEach((k) => {
            dirtyKeysRef.current[field].add(k);
            restored = true;
          });
        });
        if (restored) setHasUnsavedChanges(true);
      }
      // 🌟 If changes arrived while the previous HTTP save was in-flight, save them immediately now
      if (hasPendingSaveRef.current) {
        hasPendingSaveRef.current = false;
        const queuedData = pendingSaveDataRef.current || {};
        pendingSaveDataRef.current = null;
        performSaveDraft(queuedData);
      }
    }
  };

  performSaveDraftRef.current = performSaveDraft;
  useEffect(() => {
    performSaveDraftRef.current = performSaveDraft;
  });

  // 🌟 โหมดบันทึกด้วยมือ: เมื่อผู้ใช้ตอบ/แก้ไข ระบบ "จดว่ามีการแก้ไขค้าง" เท่านั้น ยังไม่ส่งไปเซิร์ฟเวอร์
  // การบันทึกจริงเกิดเมื่อกดปุ่ม "บันทึก" (handleManualSave) → performSaveDraft → เซิร์ฟเวอร์กระจายให้ทุกเครื่องผ่าน SignalR เหมือนเดิม
  const scheduleActionSave = useCallback((overrideData = {}) => {
    isAnswerModifiedRef.current = true;

    ['answers', 'photos', 'comments', 'metadataValues'].forEach((field) => {
      if (overrideData[field] === undefined) return;
      const prev = latestMapsRef.current[field] || {};
      const next = overrideData[field] || {};
      const dirty = dirtyKeysRef.current[field];
      Object.keys(next).forEach((k) => {
        if (JSON.stringify(next[k]) !== JSON.stringify(prev[k])) dirty.add(k);
      });
      Object.keys(prev).forEach((k) => {
        if (!(k in next)) dirty.add(k);
      });
    });

    pendingSaveDataRef.current = {
      ...(pendingSaveDataRef.current || {}),
      ...overrideData
    };
    setHasUnsavedChanges(true);
    setSyncStatus("unsaved");
  }, []);

  const handleManualSave = useCallback(async () => {
    if (isReadOnlyMode || isSavingRef.current || isLocalSaving || !performSaveDraftRef.current) return;

    // 🌟 แสดงสปินเนอร์หมุนทันทีตั้งแต่กดปุ่ม โดยไม่ต้องรอรอบประมวลผลข้อมูลหรือเน็ตเวิร์ก
    setIsLocalSaving(true);
    setSyncStatus("saving");
    await new Promise((resolve) => setTimeout(resolve, 20));

    const wasInFlight = isSavingRef.current;
    const queued = pendingSaveDataRef.current || {};
    pendingSaveDataRef.current = null;

    try {
      await performSaveDraftRef.current(queued);
    } finally {
      setIsLocalSaving(false);
    }

    // ถูกบล็อกหรือบันทึกไม่สำเร็จ → คืนข้อมูลที่ค้างไว้ ไม่ให้หายเงียบๆ
    if (!wasInFlight && !lastSaveOkRef.current) {
      pendingSaveDataRef.current = { ...queued, ...(pendingSaveDataRef.current || {}) };
      setHasUnsavedChanges(true);
      setSyncStatus((prev) => (prev === "error" ? "error" : "unsaved"));
    }
  }, [isReadOnlyMode, isLocalSaving]);

  // 🌟 Auto-fetch the latest draft from server upon entering step === "audit"
  // ONLY if this is NOT a new audit (i.e. resuming an in-progress draft)
  const hasAutoFetchedDraftRef = useRef(false);
  useEffect(() => {
    if (step !== "audit" || !unit?.id || !selectedForm?.id) return;
    if (hasAutoFetchedDraftRef.current) return;
    hasAutoFetchedDraftRef.current = true;

    // 🛡️ If this is an explicit new audit, NEVER pull or auto-fetch old drafts!
    if (preselectedPlan?.isNewAudit) {
      return;
    }

    let isMounted = true;
    const fetchLatestServerDraft = async () => {
      try {
        const targetDraftId = getEffectiveDraftId();
        const schedId = effectiveSchedId;

        // 🛡️ ONLY fetch server draft if we have an explicit target draft ID or schedule ID to resume!
        // NEVER fetch old drafts just by locationId & surveyFormId during a new audit!
        if (!targetDraftId && !schedId) {
          return;
        }

        const params = new URLSearchParams();
        if (targetDraftId) {
          params.set("id", targetDraftId);
        } else if (schedId) {
          params.set("scheduleId", schedId);
        }

        const res = await api.get(`/audit/draft?${params.toString()}`);
        if (!isMounted || !res.data) return;

        const remote = res.data;
        if (remote.id) {
          draftIdRef.current = remote.id;
          setDraftId(remote.id);
        }

        // Hydrate only if answers on this device have not been modified yet
        if (!isAnswerModifiedRef.current && remote.draftPayloadJson) {
          if (!hasInitializedLockRef.current) {
            hasInitializedLockRef.current = true;
            setIsReadOnlyMode(true);
          }
          try {
            const payload = typeof remote.draftPayloadJson === "string"
              ? JSON.parse(remote.draftPayloadJson)
              : remote.draftPayloadJson;

            const currentForm = selectedForm;
            let activeAnswers = payload.answers || {};
            let activePhotos = payload.photos || {};
            let activeComments = payload.comments || {};

            if (currentForm && Array.isArray(currentForm.sections) && currentForm.sections.length > 0) {
              const remapped = remapDraftItemsToCurrentForm(payload, currentForm);
              activeAnswers = remapped.answers;
              activePhotos = remapped.photos;
              activeComments = remapped.comments;
            }

            if (payload.answers !== undefined) {
              setAnswers(prev => {
                // If local state already has answers, merge them preserving local answers so we don't clobber recent answers
                if (prev && Object.keys(prev).length > 0) {
                  return { ...activeAnswers, ...prev };
                }
                return activeAnswers;
              });
            }
            if (payload.photos !== undefined) {
              setPhotos(prev => (prev && Object.keys(prev).length > 0 ? { ...activePhotos, ...prev } : activePhotos));
            }
            if (payload.comments !== undefined) {
              setComments(prev => (prev && Object.keys(prev).length > 0 ? { ...activeComments, ...prev } : activeComments));
            }
            if (payload.staffCount !== undefined) {
              setStaffCount(payload.staffCount);
            }
            if (payload.extraNote !== undefined) {
              setExtraNote(payload.extraNote);
            }
            if (payload.metadataValues && Object.keys(payload.metadataValues).length > 0) {
              setMetadataValues(prev => (Object.keys(prev || {}).length === 0 ? payload.metadataValues : { ...payload.metadataValues, ...prev }));
            }
            if (payload.auditeeSignature !== undefined) {
              setAuditeeSignature(payload.auditeeSignature || null);
            }
            if (payload.auditorSignature !== undefined) {
              setAuditorSignature(payload.auditorSignature || null);
            }
            if (payload.auditeeSignName !== undefined) {
              setAuditeeSignName(payload.auditeeSignName || "");
            }
            if (payload.isBackdated !== undefined) {
              setIsBackdated(Boolean(payload.isBackdated));
            }
            if (payload.backdatedStartDate !== undefined) {
              setBackdatedStartDate(payload.backdatedStartDate);
            }
            if (payload.backdatedEndDate !== undefined) {
              setBackdatedEndDate(payload.backdatedEndDate);
            }
            if (payload.auditType) {
              setAuditType(payload.auditType);
            }
            
            const initialTime = payload.savedAt ||
              (remote.updatedAt ? new Date(remote.updatedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : null);
            if (initialTime) {
              setLastSavedTime(initialTime);
            }

            hasHydratedDraftRef.current = true;
          } catch (parseErr) {
            console.warn("Parse remote draft payload error:", parseErr);
          }
        }
      } catch (err) {
        console.warn("Auto-fetch server draft error:", err);
      }
    };

    fetchLatestServerDraft();
    return () => {
      isMounted = false;
    };
  }, [step, unit?.id, selectedForm?.id, effectiveSchedId, currentUser?.id, preselectedPlan?.isNewAudit, getEffectiveDraftId]);

  // 🌟 Real-time SignalR draft synchronization across multiple devices/screens
  useEffect(() => {
    if (step !== "audit" || !unit?.id || !selectedForm?.id) return;

    const currentDraftId = getEffectiveDraftId();
    const roomsToJoin = [];

    if (currentDraftId) {
      roomsToJoin.push(`audit_draft_${currentDraftId}`);
    }
    if (effectiveSchedId) {
      roomsToJoin.push(`audit_sched_${effectiveSchedId}`);
    }

    roomsToJoin.forEach(room => signalRService.joinAuditRoom(room));

    const unsub = signalRService.onAuditDraftSynced((syncedDraft) => {
      const activeDraftId = draftIdRef.current || getEffectiveDraftId();
      const matchesDraftId = activeDraftId && Number(syncedDraft.draftId) === Number(activeDraftId);
      const matchesSched = effectiveSchedId && Number(syncedDraft.auditScheduleId) === Number(effectiveSchedId);

      if (!matchesDraftId && !matchesSched) return;

      if (syncedDraft.draftId) {
        const isNewRoom = !draftIdRef.current || Number(draftIdRef.current) !== Number(syncedDraft.draftId);
        draftIdRef.current = syncedDraft.draftId;
        setDraftId(syncedDraft.draftId);
        if (isNewRoom) {
          signalRService.joinAuditRoom(`audit_draft_${syncedDraft.draftId}`);
        }
      }

      if (syncedDraft.draftPayloadJson) {
        try {
          if (isSavingRef.current) return;

          const payload = typeof syncedDraft.draftPayloadJson === "string"
            ? JSON.parse(syncedDraft.draftPayloadJson)
            : syncedDraft.draftPayloadJson;

          // 🌟 เมื่อมีเครื่องอื่นบันทึกเข้ามา ให้อัปเดตคำตอบและข้อมูลล่าสุดจากเซิร์ฟเวอร์ทันที ให้แก้ต่อได้เลย
          const currentForm = selectedForm;
          let incomingAnswers = payload.answers || {};
          let incomingPhotos = payload.photos || {};
          let incomingComments = payload.comments || {};

          if (currentForm && Array.isArray(currentForm.sections) && currentForm.sections.length > 0) {
            const remapped = remapDraftItemsToCurrentForm(payload, currentForm);
            incomingAnswers = remapped.answers;
            incomingPhotos = remapped.photos;
            incomingComments = remapped.comments;
          }

          if (payload.answers !== undefined) setAnswers(incomingAnswers);
          if (payload.photos !== undefined) setPhotos(incomingPhotos);
          if (payload.comments !== undefined) setComments(incomingComments);
          if (payload.metadataValues !== undefined) setMetadataValues(payload.metadataValues || {});

          if (payload.staffCount !== undefined) setStaffCount(payload.staffCount || "");
          if (payload.extraNote !== undefined) setExtraNote(payload.extraNote || "");
          if (payload.auditeeSignature !== undefined) setAuditeeSignature(payload.auditeeSignature || null);
          if (payload.auditorSignature !== undefined) setAuditorSignature(payload.auditorSignature || null);
          if (payload.auditeeSignName !== undefined) setAuditeeSignName(payload.auditeeSignName || "");
          if (payload.isBackdated !== undefined) setIsBackdated(Boolean(payload.isBackdated));
          if (payload.backdatedStartDate !== undefined) setBackdatedStartDate(payload.backdatedStartDate || null);
          if (payload.backdatedEndDate !== undefined) setBackdatedEndDate(payload.backdatedEndDate || null);
          if (payload.auditType) setAuditType(payload.auditType);

          dirtyKeysRef.current = {
            answers: new Set(),
            photos: new Set(),
            comments: new Set(),
            metadataValues: new Set()
          };
          pendingSaveDataRef.current = null;
          setHasUnsavedChanges(false);

          const incomingTime = payload.savedAt ||
            (syncedDraft.updatedAt
              ? new Date(syncedDraft.updatedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
              : new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }));

          setLastSavedTime(incomingTime);
          setSyncStatus("synced");
        } catch (e) {
          console.warn("SignalR draft payload parse error:", e);
        }
      }
    });

    const unsubSubmitted = signalRService.onAuditSubmitted((submittedData) => {
      const activeDraftId = draftIdRef.current || getEffectiveDraftId();
      const matchesDraftId = activeDraftId && Number(submittedData.draftId) === Number(activeDraftId);
      const matchesSched = effectiveSchedId && Number(submittedData.auditScheduleId) === Number(effectiveSchedId);

      if (!matchesDraftId && !matchesSched) return;

      // Don't show modal if this device was the one that submitted
      if (isSubmittingRef.current || isSubmittedSuccessRef.current) return;

      setRemoteSubmittedInfo(submittedData);
    });

    return () => {
      unsub();
      unsubSubmitted();
      roomsToJoin.forEach(room => signalRService.leaveAuditRoom(room));
    };
  }, [step, unit?.id, selectedForm?.id, effectiveSchedId, preselectedPlan?.isNewAudit, getEffectiveDraftId]);

  // Flush draft on unmount ONLY if answers were modified by user on this device
  useEffect(() => {
    return () => {
      if (isDiscardingRef.current) return;
      // ตาข่ายนิรภัย: ออกจากหน้านี้ด้วยทางอื่น (เช่น กดเมนูไปหน้าอื่น) ทั้งที่ยังมีข้อมูลค้าง ให้บันทึกก่อนกันข้อมูลหาย
      // (ถ้ากดปุ่มย้อนกลับแล้วเลือก "ออกโดยไม่บันทึก" ข้อมูลค้างจะถูกล้างไปแล้ว จึงไม่บันทึกตรงนี้)
      if (saveOnLeaveSafetyNet && isAnswerModifiedRef.current && performSaveDraftRef.current) {
        if (autoSaveTimerRef.current) {
          clearTimeout(autoSaveTimerRef.current);
          autoSaveTimerRef.current = null;
        }
        const queued = pendingSaveDataRef.current || {};
        pendingSaveDataRef.current = null;
        performSaveDraftRef.current(queued);
      }
    };
  }, []);

  // เตือนก่อนปิดแท็บ/รีเฟรช ถ้ายังมีข้อมูลที่ไม่ได้กดบันทึก
  useEffect(() => {
    if (step !== "audit") return;
    const handleBeforeUnload = (e) => {
      if (hasUnsavedLocalChanges()) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [step]);

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
          scheduleActionSave({ photos: next });
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
  }, [scheduleActionSave]);

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
      scheduleActionSave({ photos: next });
      return next;
    });
  }, [scheduleActionSave]);

  const handleAnswerSelect = useCallback((questionId, val) => {
    setHighlightedQuestionId(prevHighlighted => (prevHighlighted === questionId ? null : prevHighlighted));

    // 🌟 ตรวจสอบว่าคำถามเป็นข้อที่คิดคะแนนหรือไม่ (ถ้าเป็นข้อคิดคะแนนแล้วไม่ผ่าน ให้เด้งเปิดช่องคอมเมนต์ทันที)
    let isScoredItem = false;
    let isScale = false;
    for (const sec of (selectedForm?.sections || [])) {
      const item = (sec.items || []).find(i => i.id === questionId);
      if (item) {
        const qType = (item.questionType || item.type || "YESNO").toString().toLowerCase();
        const isScored = isItemScored({ ...item, sectionType: sec.sectionType, sectionTitle: sec.title });
        if (isScored) {
          isScoredItem = true;
          if (qType === "scale" || qType === "rating") isScale = true;
        }
        break;
      }
    }

    if (isScoredItem) {
      const isFailing = (isScale && typeof val === "number" && val < 3) ||
                        (!isScale && (val === "no" || val === false));
      if (isFailing) {
        setOpenComments(prev => ({ ...prev, [questionId]: true }));
      }
    }

    setAnswers(prev => {
      const next = { ...prev };
      const isToggleType = val === "yes" || val === "no" || val === "na";
      if (isToggleType && next[questionId] === val) {
        delete next[questionId];
      } else {
        next[questionId] = val;
      }
      scheduleActionSave({ answers: next });
      return next;
    });
  }, [selectedForm, scheduleActionSave]);

  const handleCommentChange = useCallback((questionId, val) => {
    setComments(prev => {
      const next = { ...prev, [questionId]: val };
      scheduleActionSave({ comments: next });
      return next;
    });
  }, [scheduleActionSave]);

  const handleToggleComment = useCallback((questionId, currentlyOpen) => {
    setOpenComments(prev => ({ ...prev, [questionId]: !currentlyOpen }));
  }, []);

  const allAuditQuestions = useMemo(() => {
    const list = [];
    currentSections.forEach(sec => {
      (sec.items || []).forEach(q => {
        list.push({
          ...q,
          surveyItemId: q.id,
          sectionType: q.sectionType || sec.sectionType,
          sectionTitle: sec.title,
        });
      });
    });
    return list;
  }, [currentSections]);

  const scoreAnalysis = useMemo(() => {
    const res = computeScore(allAuditQuestions, answers, passingScore, { includeUnansweredInMaxScore: true });
    const failedQuestions = [];

    allAuditQuestions.forEach(q => {
      const itemRes = res.itemResults[q.id];
      if (!itemRes || !itemRes.isScored || itemRes.isNa) return;
      if (!itemRes.isPassed) {
        const qType = (q.questionType || q.type || "YESNO").toString().toUpperCase();
        let defaultNote = "ไม่ผ่านเกณฑ์มาตรฐาน";
        if (itemRes.isUnanswered) {
          defaultNote = "ยังไม่ได้ตอบ";
        } else if (qType === "SCALE") {
          defaultNote = `ได้คะแนนเพียง ${itemRes.answerValue || 0}/5`;
        }
        failedQuestions.push({
          ...q,
          sectionTitle: q.sectionTitle,
          note: comments[q.id] || defaultNote
        });
      }
    });

    return {
      earnedScore: res.totalScore,
      maxScore: res.maxScore,
      percentage: res.percentage,
      isPassed: res.isPassed,
      hasCriticalDefect: res.hasCriticalDefect,
      naCount: res.naCount,
      failedQuestions,
      itemResults: res.itemResults
    };
  }, [allAuditQuestions, answers, comments, passingScore]);

  const categoryBreakdown = useMemo(() => {
    const catMap = new Map();

    currentSections.forEach((sec) => {
      (sec.items || []).forEach((q) => {
        const r = scoreAnalysis.itemResults?.[q.id];
        if (!r || !r.isScored) return; // 🌟 ข้ามหมวด/ข้อไม่คิดคะแนน

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
        if (!r.isUnanswered) catData.answeredCount += 1;
        if (r.isNa) return;

        catData.maxScore += r.maxScore;
        catData.earnedScore += r.scoreGiven;
      });
    });

    const categories = Array.from(catMap.values()).map((cat) => {
      const earned = round2(cat.earnedScore);
      const max = round2(cat.maxScore);
      const percentage = max > 0 ? round2((earned / max) * 100) : 0;
      return {
        ...cat,
        earnedScore: earned,
        maxScore: max,
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
  }, [currentSections, scoreAnalysis, selectedForm?.categoryOrderJson, selectedForm?.categories, getQuestionCategory]);

  // 🌟 ส่งออกรายงาน Excel จากข้อมูลแบบร่าง ณ ปัจจุบันระหว่างตรวจ
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  const handleExportDraftExcel = useCallback(async () => {
    if (isExportingExcel) return;
    setIsExportingExcel(true);
    try {
      const now = new Date();
      const timeStr = formatBkk(now, true);
      const startedStr = auditStartedAt ? formatBkk(auditStartedAt, true) : timeStr;

      // 1. แปลง activeMetadataFields
      const exportMetaFields = (activeMetadataFields || []).map((f) => {
        let val = metadataValues[f.id];
        if (f.id === "staff_count") {
          val = (staffCount !== "" && staffCount !== undefined && staffCount !== null) ? staffCount : (val ?? "");
        } else if (f.id === "audit_type") {
          val = val || (auditType ? (
            auditType === "spot" ? "นอกกำหนดการ" :
            auditType === "undercover" ? "ปลอมตัว" : "ตามกำหนดการ"
          ) : "");
        } else if (f.id === "auditor" || f.type === "auditor") {
          val = val || auditorName || loggedInAuditorName || "";
        }
        return {
          label: f.label || f.placeholder || f.id,
          value: val !== undefined && val !== null ? val : "",
          unit: f.unit || (f.id === "staff_count" ? "คน" : "")
        };
      });

      // 2. แปลง sections และคำถามเป็นโครงสร้างที่ exportAuditReportToExcel คาดหวัง
      const exportSections = (currentSections || []).map((sec, sIdx) => {
        const isInfoSec = sec.sectionType === "INFO";
        return {
          title: sec.title || `หมวดที่ ${sIdx + 1}`,
          questions: (sec.items || []).map((q, qIdx) => {
            const qType = (q.questionType || q.type || "YESNO").toString().toLowerCase();
            const isScored = isItemScored({ ...q, sectionType: sec.sectionType, sectionTitle: sec.title });
            const isNonScored = !isScored;
            const ans = answers[q.id];
            const isNa = ans === "na" || ans === "skip";
            const fullScore = Number(q.fullScore ?? q.maxScore ?? 0);

            let scoreGiven = null;
            let isPassed = false;
            if (isScored && !isNa && ans !== undefined && ans !== null && ans !== "") {
              if (qType === "scale") {
                const num = Number(ans) || 0;
                scoreGiven = round2((num / 5.0) * fullScore);
                isPassed = num >= 3;
              } else {
                const lowerAns = String(ans).toLowerCase();
                const passed = lowerAns === "yes" || lowerAns === "true" || lowerAns === "1";
                scoreGiven = passed ? fullScore : 0;
                isPassed = passed;
              }
            }

            const itemComment = comments[q.id] || "";
            const note = isScored ? itemComment : (itemComment ? `\n[หมายเหตุ]: ${itemComment}` : "");

            return {
              num: q.orderIndex || qIdx + 1,
              text: q.questionText || q.text || `ข้อที่ ${qIdx + 1}`,
              type: qType,
              fieldConfig: q.fieldConfig,
              isScored,
              fullScore,
              isNa,
              answer: ans,
              scaleScore: (qType === "scale" || qType === "rating") ? (Number(ans) || null) : null,
              scoreGiven,
              rawAnswer: ans,
              rawValue: ans,
              note,
              isPassed,
              category: isScored ? getQuestionCategory(q, sec) : "-"
            };
          })
        };
      });

      const brandName = unit?.brand?.name || unit?.brand || "-";
      const typeName = unit?.locationType?.name || unit?.locationType || "-";
      const locationTitle = unit?.fullName || unit?.name || "-";
      const locationCode = unit?.code || "";

      const header = {
        reportNo: `DRAFT-${locationCode || "QSC"}-${formatBkk(now, false).slice(0, 10).replace(/\//g, "")}`,
        issuedAt: formatBkk(now, false).slice(0, 10),
        locationCode: locationCode,
        location: `${locationCode} ${locationTitle}`.trim(),
        brandType: `${brandName} / ${typeName}`,
        form: selectedForm?.title || "แบบฟอร์มการตรวจ",
        startedAt: startedStr,
        endedAt: `กำลังตรวจ (ณ เวลา ${timeStr})`,
        auditor: auditorName || loggedInAuditorName,
        auditee: auditeeSignName ? `${auditeeSignName} (ผู้จัดการสาขา)` : "ผู้จัดการสาขา",
        signedAt: "-"
      };

      const draftRecord = {
        id: (matchedDraftRecord?.id) || 0,
        percentageScore: scoreAnalysis.percentage,
        score: scoreAnalysis.percentage,
        isPassed: scoreAnalysis.isPassed,
        locationName: locationTitle,
        locationCode: locationCode,
        locationBrand: brandName,
        location: unit,
        surveyFormTitle: selectedForm?.title,
        auditDate: auditStartedAt,
        startedAt: auditStartedAt,
        submittedAt: now.toISOString(),
        auditorName: auditorName || loggedInAuditorName,
        auditeeName: auditeeSignName || "ผู้จัดการสาขา"
      };

      await exportAuditReportToExcel({
        record: draftRecord,
        sections: exportSections,
        metaFields: exportMetaFields,
        passingScore: passingScore ?? 85,
        categoryOf: getQuestionCategory,
        categoryOrder: selectedForm?.categoryOrderJson || selectedForm?.categories,
        toFullUrl: getFullImageUrl,
        signatureUrls: {
          auditor: auditorSignature || null,
          auditee: auditeeSignature || null
        },
        header
      });
    } catch (err) {
      console.error("Export draft Excel failed:", err);
      alert("ส่งออกรายงาน Excel ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsExportingExcel(false);
    }
  }, [isExportingExcel, selectedForm, currentSections, answers, comments, photos, activeMetadataFields, metadataValues, staffCount, auditType, unit, auditStartedAt, auditorName, loggedInAuditorName, auditeeSignName, matchedDraftRecord, scoreAnalysis, passingScore, auditorSignature, auditeeSignature, getQuestionCategory]);

  const handleExportDraftExcelRef = useRef(handleExportDraftExcel);
  useEffect(() => {
    handleExportDraftExcelRef.current = handleExportDraftExcel;
  }, [handleExportDraftExcel]);

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
        prev.sectionBadgeNumber === sectionBadgeNumber &&
        prev.actionMigrating === isMigratingDraft &&
        prev.newerVersionKey === (newerFormVersion?.latestVersion || null) &&
        prev.showSaveTime === showSaveTime &&
        prev.lastSavedTime === lastSavedTime && 
        prev.syncStatus === syncStatus &&
        prev.hasUnsavedChanges === hasUnsavedChanges &&
        prev.isExportingExcel === isExportingExcel &&
        prev.isReadOnlyMode === isReadOnlyMode
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
        actionMigrating: isMigratingDraft,
        newerVersionKey: newerFormVersion?.latestVersion || null,
        showSaveTime,
        lastSavedTime,
        syncStatus,
        hasUnsavedChanges,
        isExportingExcel,
        isReadOnlyMode,
        action: (
          <div className="flex items-center gap-1.5 sm:gap-2">

            {/* 🌟 ป้ายสถานะ Synced ย้ายมาแสดงตรงนี้ (ตามรูปที่ 1) */}
            {step === "audit" && (
              <SyncStatusPill
                syncStatus={syncStatus}
                showSaveTime={showSaveTime}
                lastSavedTime={lastSavedTime}
                onToggle={() => setShowSaveTime(prev => !prev)}
              />
            )}



            {/* ปุ่มฟอร์มใหม่เดิม */}
            {newerFormVersion && (
              <button
                type="button"
                onClick={handleMigrateDraft}
                disabled={isMigratingDraft}
                className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-1.5 rounded-full bg-gradient-to-b from-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-600 text-white font-extrabold text-xs shadow-md shadow-amber-500/30 hover:shadow-lg hover:shadow-amber-500/40 active:scale-95 transition-all shrink-0 cursor-pointer disabled:opacity-50"
                title="มีแบบฟอร์มเวอร์ชันใหม่ คลิกเพื่อย้ายคำตอบมายังฟอร์มใหม่"
              >
                {isMigratingDraft ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span className="hidden sm:inline">กำลังย้าย...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw size={13} />
                    <span>ฟอร์มใหม่</span>
                  </>
                )}
              </button>
            )}
          </div>
        ),
        onMenuClick: () => setIsCategoryDrawerOpen(true),
        onBack: () => {
          if (step === "select-form") {
            setStep("select-unit");
          } else {
            if (!confirmLeaveIfUnsaved()) return;
            if (isResumeDraft || isFromAssignedPlan) {
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
  }, [step, unit?.id, unit?.name, unit?.fullName, selectedForm?.id, selectedForm?.title, isResumeDraft, isFromAssignedPlan, isAuditHeaderScrolled, setSubHeader, activeTab, activeSectionIndex, newerFormVersion, isMigratingDraft, showSaveTime, lastSavedTime, syncStatus, hasUnsavedChanges, handleManualSave, isExportingExcel, isReadOnlyMode]);

  const checkUnansweredQuestions = () => {
    const unanswered = [];
    currentSections.forEach((sec, sIdx) => {
      (sec.items || []).forEach((item, qIdx) => {
        const itemWithSec = { ...item, sectionType: item.sectionType || sec.sectionType, sectionTitle: sec.title };
        const isScored = isItemScored(itemWithSec);

        // 🌟 ถ้าเป็นข้อไม่คิดคะแนน: ตรวจเฉพาะข้อที่มีการกดตั้งค่าว่า "ต้องกรอก / บังคับกรอก" (required) เท่านั้น!
        const isItemRequired = Boolean(item.required || item.fieldConfig?.required);
        if (!isScored && !isItemRequired) return;

        const ans = answers[item.id];
        const qType = (item.questionType || item.type || "YESNO").toString().toLowerCase();

        let isAnswered = false;
        if (ans !== undefined && ans !== null && ans !== "") {
          if (ans === "na" || ans === "skip") {
            isAnswered = true;
          } else if (qType === "scale" || qType === "rating") {
            const num = Number(ans);
            isAnswered = !isNaN(num) && num >= 1 && num <= 5;
          } else {
            isAnswered = true;
          }
        }

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
        const val = metadataValues[field.id] || metadataValues["auditor"];
        if (!val || (typeof val === "string" && !val.trim())) {
          setActiveTab(1);
          alert(`⚠️ กรุณาระบุ "${field.label || 'ชื่อผู้ตรวจประเมิน'}" ในแท็บ 'ข้อมูลการตรวจ'`);
          scrollToTop();
          return false;
        }
      }

      if (field.id === "audit_type") {
        const val = auditType || metadataValues["audit_type"] || metadataValues[field.id];
        if (!val || (typeof val === "string" && !val.trim())) {
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

    // 🌟 ตรวจสอบข้อคิดคะแนนที่ตกเกณฑ์ (Yes/No = ไม่ผ่าน หรือ Scale 1-5 ที่คะแนน < 3) บังคับต้องระบุข้อคิดเห็น
    const missingComments = [];
    currentSections.forEach((sec, sIdx) => {
      const isInfoSec = sec.sectionType === "INFO";
      (sec.items || []).forEach((item, qIdx) => {
        const qType = (item.questionType || item.type || "YESNO").toString().toLowerCase();
        const isNonScored = isInfoSec || item.isScored === false || Number(item.fullScore) === 0 || ["grid","number","select","radio","checkbox","text","date","time","auditor","multians"].includes(qType);

        // 🌟 ข้อที่ไม่คิดคะแนน หรือจำนวนตัวเลข ไม่ต้องนำมาเชื่อมกับเงื่อนไขตกเกณฑ์ (< 3) เด็ดขาด
        if (isNonScored) return;

        const ans = answers[item.id];
        const isNa = ans === "na";
        const isScale = qType === "scale" || qType === "rating";
        const isFailed = !isNa && (
          ans === "no" || 
          ans === false || 
          (isScale && typeof ans === "number" && ans < 3) || 
          (isScale && !isNaN(Number(ans)) && ans !== "" && ans !== undefined && Number(ans) < 3)
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
    if (!unit?.id) {
      alert("⚠️ เกิดข้อผิดพลาด: ไม่พบข้อมูลสาขาที่ทำการตรวจ กรุณาตรวจสอบหรือรีเฟรชหน้าจอใหม่อีกครั้ง");
      setShowConfirmModal(false);
      return;
    }

    if (!selectedForm?.id) {
      alert("⚠️ เกิดข้อผิดพลาด: ไม่พบข้อมูลแบบฟอร์มการตรวจ กรุณาตรวจสอบหรือรีเฟรชหน้าจอใหม่อีกครั้ง");
      setShowConfirmModal(false);
      return;
    }

    if (!validateEntireAuditForm()) {
      setShowConfirmModal(false);
      return;
    }

    setIsSubmitting(true);
    isSubmittingRef.current = true;
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
          const isNa = (ans === "na" || ans === "skip");
          const qType = (q.questionType || q.type || "YESNO").toString().toLowerCase();
          const isScored = isItemScored({ ...q, sectionType: sec.sectionType, sectionTitle: sec.title });

          let rawAnswer = "";

          if (!isScored) {
            rawAnswer = typeof ans === "object" ? JSON.stringify(ans) : (ans !== undefined && ans !== null ? String(ans) : "");
          } else if (isNa) {
            rawAnswer = "na";
          } else if (qType === "scale") {
            const parsedNum = Number(ans);
            if (ans === undefined || ans === null || ans === "" || !Number.isFinite(parsedNum) || parsedNum < 1 || parsedNum > 5) {
              // กรองข้อคิดคะแนนที่ยังไม่ตอบออกก่อนส่ง (ไม่เติม "0" หรือค่าเดาสุ่ม)
              return;
            }
            rawAnswer = String(parsedNum);
          } else {
            // YESNO
            if (ans === "yes" || ans === true || ans === "true" || ans === 1) {
              rawAnswer = "yes";
            } else if (ans === "no" || ans === false || ans === "false" || ans === 0) {
              rawAnswer = "no";
            } else {
              // กรองข้อคิดคะแนนที่ยังไม่ตอบออกก่อนส่ง (ไม่เติม "no" แทน)
              return;
            }
          }

          const rawPhotos = photos[q.id];
          const itemPhotos = Array.isArray(rawPhotos)
            ? rawPhotos
            : (rawPhotos ? [rawPhotos] : []);

          responses.push({
            surveyItemId: q.id,
            rawAnswer,
            answerValue: rawAnswer,
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
        surveyFormId: Number(selectedForm.id),
        primaryAuditorId: currentUser?.id ? Number(currentUser.id) : null,
        auditeeUserId: (unit.managerUserId && Number(unit.managerUserId) > 0) ? Number(unit.managerUserId) : null,
        auditeeNameText: auditeeSignName || unit.managerName || "-",
        auditScheduleId: targetSchedId,
        auditType: (() => {
          const raw = auditType || metadataValues["audit_type"] || metadataValues.auditType;
          if (!raw) return "announced";
          const lower = String(raw).toLowerCase();
          if (lower.includes("ปลอม") || lower === "undercover") return "undercover";
          if (lower.includes("นอก") || lower === "spot" || lower === "unannounced") return "spot";
          return "announced";
        })(),
        notes: extraNote || "",
        metadataValuesJson: JSON.stringify({
          _fields: (activeMetadataFields || []).map((field, idx) => {
            let val = metadataValues[field.id];
            if (field.id === "staff_count") {
              val = (staffCount !== "" && staffCount !== undefined && staffCount !== null) ? staffCount : (val ?? "");
            } else if (field.id === "audit_type") {
              val = val || (auditType ? (
                auditType === "spot" ? "นอกกำหนดการ" :
                auditType === "undercover" ? "ปลอมตัว" : "ตามกำหนดการ"
              ) : "");
            } else if (field.id === "auditor" || field.type === "auditor") {
              val = val || "";
            }

            return {
              order: idx + 1,
              id: field.id,
              label: field.label || field.placeholder || field.id,
              value: val !== undefined && val !== null ? val : "",
              type: field.type || "text",
              fieldConfig: field.fieldConfig || (field.options || field.columns || field.rows ? { options: field.options, columns: field.columns, rows: field.rows } : null),
              unit: field.unit || (field.id === "staff_count" ? "คน" : "")
            };
          }),
          ...metadataValues,
          ...(staffCount !== "" && staffCount !== undefined ? { staff_count: staffCount } : {}),
          audit_type: metadataValues.audit_type || (
            auditType === "spot" ? "นอกกำหนดการ" :
            auditType === "undercover" ? "ปลอมตัว" : "ตามกำหนดการ"
          )
        }),
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

      // 🧹 ล้าง sessionStorage หน้าตรวจปัจจุบัน
      try {
        sessionStorage.removeItem("qsc_active_audit_session");
      } catch (e) {}

      // 🧹 1. Clean localStorage thoroughly for this unit and schedule
      try {
        localStorage.removeItem('qsc_live_audit_draft');
        if (unit?.id) {
          if (selectedForm?.id) localStorage.removeItem(`qsc_draft_${unit.id}_${selectedForm.id}`);
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

      isSubmittedSuccessRef.current = true;
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
      isSubmittingRef.current = false;
    }
  };

  const handleAcknowledgeSubmitted = useCallback(() => {
    isDiscardingRef.current = true;
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    try {
      const activeDraftId = draftIdRef.current || getEffectiveDraftId();
      if (activeDraftId) localStorage.removeItem(`qsc_draft_id_${activeDraftId}`);
      if (effectiveSchedId) localStorage.removeItem(`qsc_draft_sched_${effectiveSchedId}`);
      if (unit?.id && selectedForm?.id) localStorage.removeItem(`qsc_draft_${unit.id}_${selectedForm.id}`);
      sessionStorage.removeItem("qsc_active_audit_session");
    } catch (e) {}

    setRemoteSubmittedInfo(null);
    if (refreshData) refreshData();
    if (onCompleteAudit) onCompleteAudit();
    if (onActiveStateChange) onActiveStateChange(false);
    if (onClearPlan) onClearPlan();
    if (onBack) {
      onBack();
    } else {
      setStep("select-unit");
    }
  }, [effectiveSchedId, getEffectiveDraftId, onActiveStateChange, onBack, onClearPlan, onCompleteAudit, refreshData, selectedForm?.id, unit?.id]);

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
      const targetFormId = selectedForm?.id || parsedDraftPayload?.formId || preselectedPlan?.surveyFormId || null;
      const targetAuditorId = currentUser?.id ? Number(currentUser.id) : null;

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
        sessionStorage.removeItem("qsc_active_audit_session")
        localStorage.removeItem('qsc_live_audit_draft');
        if (targetLocId) {
          if (targetFormId) localStorage.removeItem(`qsc_draft_${targetLocId}_${targetFormId}`);
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
                    if (matchedForms.length === 1) {
                      setSelectedForm(matchedForms[0]);
                    } else {
                      setSelectedForm(null);
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
                      เกณฑ์ผ่าน {f.passingScore ?? 85}%
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

        if (field.type === "auditor" || field.id === "auditor") {
          let val = metadataValues[field.id] || metadataValues["auditor"];
          if (!val || (typeof val === "string" && !val.trim())) {
            val = currentUser?.fullName || currentUser?.name || defaultAuditorName || "ผู้ตรวจประเมิน";
            setMetadataValues(prev => ({ ...prev, [field.id]: val, auditor: val }));
          }
        }

        if (field.id === "audit_type") {
          const val = auditType || metadataValues["audit_type"] || metadataValues[field.id];
          if (!val || (typeof val === "string" && !val.trim())) {
            alert("กรุณาเลือกประเภทการตรวจ");
            return;
          }
        }

        if (field.id === "staff_count" && (staffCount === "" || staffCount === undefined)) {
          alert("กรุณาระบุจำนวนพนักงานขณะตรวจ");
          return;
        }

        if (field.id !== "auditor" && field.type !== "auditor" && field.id !== "audit_type" && field.id !== "staff_count") {
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
      { 
        id: "summary", 
        label: "สรุป&ลงชื่อ", 
        icon: <PenTool size={16} />, 
        count: (auditorSignature && auditeeSignature) ? "ลงชื่อแล้ว" : (extraNote?.trim() ? "พิมพ์แล้ว" : null) 
      },
    ];

    const jumpToCategory = (item) => {
      setIsCategoryDrawerOpen(false);
      if (item.id === "details") {
        setActiveTab(1);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      if (item.id === "summary" || item.id === "submit") {
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
                  {/*{syncStatus !== "idle" && (
                    syncStatus === "saving" ? (
                      <span className="inline-flex shrink-0 items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-[10px] font-bold text-amber-700 animate-pulse">
                        <Loader2 size={10} className="animate-spin text-amber-600" /> Syncing...
                      </span>
                    ) : syncStatus === "error" ? (
                      <span className="inline-flex shrink-0 items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-[10px] font-bold text-rose-700">
                        <AlertCircle size={10} className="text-rose-600" /> Error
                      </span>
                    ) : (
                      <span className="inline-flex shrink-0 items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-[#0F6659]">
                        <CheckCircle2 size={10} className="text-[#0F6659]" /> Synced
                      </span>
                    )
                  )}*/}
                  {newerFormVersion && (
                    <button
                      type="button"
                      onClick={handleMigrateDraft}
                      disabled={isMigratingDraft}
                      className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-b from-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-600 text-white font-extrabold text-xs shadow-md shadow-amber-500/30 hover:shadow-lg hover:shadow-amber-500/40 active:scale-95 transition-all shrink-0 cursor-pointer disabled:opacity-50 ml-1.5"
                      title="มีแบบฟอร์มเวอร์ชันใหม่ คลิกเพื่อย้ายคำตอบมายังฟอร์มใหม่"
                    >
                      {isMigratingDraft ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          <span>กำลังย้าย...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw size={12} />
                          <span>ฟอร์มใหม่</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5 truncate">{selectedForm?.title}</p>
                <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
                  <div className="flex items-center gap-2.5 flex-wrap text-[11px] font-medium text-slate-500">
                    <span className="flex items-center gap-1 min-w-0 max-w-[200px]">
                      <PenTool size={11} className="text-[#0F6659] shrink-0" />
                      <span className="truncate">{loggedInAuditorName || "ระบุผู้ตรวจ"}</span>
                    </span>
                    <span className="flex items-center gap-1 shrink-0 text-slate-400">
                      <Clock size={11} className="shrink-0" />
                      <span>เริ่ม {new Date(auditStartedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span>
                    </span>
                  </div>
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
              { id: 3, label: "สรุป&ลงชื่อ", icon: <PenTool size={14} /> }
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
                const currentVal = metadataValues[field.id];

                if (field.type === "grid" || field.type === "radio" || field.type === "checkbox" || field.type === "select") {
                  const resolvedOptions = (field.options && field.options.length > 0)
                    ? field.options
                    : (field.fieldConfig?.options && field.fieldConfig.options.length > 0)
                    ? field.fieldConfig.options
                    : (field.id === "audit_type" ? ["ตามกำหนดการ", "นอกกำหนดการ", "ปลอมตัว"] : []);
                  const resolvedVal = field.id === "audit_type"
                    ? (currentVal || (auditType ? (auditType === "spot" ? "นอกกำหนดการ" : auditType === "undercover" ? "ปลอมตัว" : "ตามกำหนดการ") : ""))
                    : currentVal;
                  return (
                    <div key={field.id} className="space-y-1.5">
                      <label className="text-xs font-extrabold text-slate-700 block">
                        {field.label} {field.required && <span className="text-rose-500">*</span>}
                      </label>
                      <DynamicFieldRenderer
                        type={field.type}
                        fieldConfig={{
                          ...(field.fieldConfig || {}),
                          options: resolvedOptions,
                        }}
                        value={resolvedVal}
                        readOnly={isReadOnlyMode}
                        onChange={(newVal) => {
                          if (isReadOnlyMode) return;
                          const next = { ...metadataValues, [field.id]: newVal };
                          setMetadataValues(next);
                          if (field.id === "audit_type" || field.id === "auditType") {
                            const raw = String(newVal || "").toLowerCase();
                            const mapped = raw.includes("ปลอม") || raw === "undercover" ? "undercover"
                              : raw.includes("นอก") || raw === "spot" || raw === "unannounced" ? "spot"
                              : (raw ? "announced" : "");
                            setAuditType(mapped);
                            scheduleActionSave({ metadataValues: next, auditType: mapped });
                          } else {
                            scheduleActionSave({ metadataValues: next });
                          }
                        }}
                      />
                    </div>
                  );
                }

                if (field.id === "auditor" || field.type === "auditor") {
                  const currentVal = metadataValues[field.id] || "";
                  return (
                    <div key={field.id}>
                      <label className="text-xs font-extrabold text-slate-700 block mb-1.5">
                        {field.label} {field.required && <span className="text-rose-500">*</span>}
                      </label>
                      <div className="relative">
                        <select
                          value={currentVal}
                          disabled={isReadOnlyMode}
                          onChange={(e) => {
                            if (isReadOnlyMode) return;
                            const val = e.target.value;
                            const next = { ...metadataValues, [field.id]: val };
                            setMetadataValues(next);
                            scheduleActionSave({ metadataValues: next });
                          }}
                          className={`w-full text-xs sm:text-sm pl-4 pr-10 py-3 min-h-[50px] rounded-2xl border outline-none font-medium sm:font-semibold text-slate-700 shadow-xs appearance-none truncate transition-all ${
                            isReadOnlyMode ? 'bg-slate-100/90 border-slate-200 cursor-default opacity-80' : 'bg-slate-50 border-slate-200 focus:border-[#0F6659] focus:bg-white cursor-pointer'
                          }`}
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
                    : (field.fieldConfig?.options && field.fieldConfig.options.length > 0
                    ? field.fieldConfig.options
                    : ["ตามกำหนดการ", "นอกกำหนดการ", "ปลอมตัว"]);
                  return (
                    <div key={field.id}>
                      <label className="text-xs font-extrabold text-slate-700 block mb-1.5">
                        {field.label} {field.required && <span className="text-rose-500">*</span>}
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {opts.map(opt => {
                          const key = opt.includes("นอก") ? "spot" : opt.includes("ปลอม") ? "undercover" : "announced";
                          const isSelected = (auditType === key || auditType === opt || metadataValues[field.id] === opt);
                          return (
                            <button
                              key={opt}
                              type="button"
                              disabled={isReadOnlyMode}
                              onClick={() => {
                                if (isReadOnlyMode) return;
                                setAuditType(key);
                                const nextMeta = { ...metadataValues, [field.id]: opt, audit_type: opt };
                                setMetadataValues(nextMeta);
                                scheduleActionSave({ auditType: key, metadataValues: nextMeta });
                              }}
                              className={`py-2.5 px-1 rounded-xl text-xs font-bold border transition-all ${
                                isReadOnlyMode ? 'pointer-events-none select-none' : 'cursor-pointer'
                              } ${isSelected
                                  ? 'bg-[#0F6659] text-white border-[#0F6659] shadow-2xs font-black'
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
                          readOnly={isReadOnlyMode}
                          onChange={(e) => {
                            if (isReadOnlyMode) return;
                            const val = e.target.value;
                            setStaffCount(val);
                            const nextMeta = { ...metadataValues, staff_count: val };
                            setMetadataValues(nextMeta);
                            scheduleActionSave({ staffCount: val, metadataValues: nextMeta });
                          }}
                          className={`w-full text-xs sm:text-sm py-2.5 px-3 pr-14 rounded-xl border border-slate-200 outline-none font-medium sm:font-bold shadow-2xs transition-all ${
                            isReadOnlyMode ? 'bg-slate-100/90 text-slate-600 cursor-default' : 'bg-white text-slate-800 focus:border-[#0F6659]'
                          }`}
                          placeholder={field.placeholder || "ระบุจำนวน (คน)"}
                        />
                        <div className="absolute right-2 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-bold text-slate-600 select-none pointer-events-none">
                          {field.unit || "คน"}
                        </div>
                      </div>
                    </div>
                  );
                }

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
                          readOnly={isReadOnlyMode}
                          onChange={(e) => {
                            if (isReadOnlyMode) return;
                            const next = { ...metadataValues, [field.id]: e.target.value };
                            setMetadataValues(next);
                            scheduleActionSave({ metadataValues: next });
                          }}
                          placeholder={field.placeholder || `ระบุตัวเลข${field.unit ? ` (${field.unit})` : ''}`}
                          className={`w-full text-xs sm:text-sm py-2.5 px-3 pr-14 rounded-xl border border-slate-200 outline-none font-medium sm:font-bold shadow-2xs transition-all ${
                            isReadOnlyMode ? 'bg-slate-100/90 text-slate-600 cursor-default' : 'bg-white focus:border-[#0F6659]'
                          }`}
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
                          disabled={isReadOnlyMode}
                          onChange={(e) => {
                            if (isReadOnlyMode) return;
                            const val = e.target.value;
                            const next = { ...metadataValues, [field.id]: val };
                            setMetadataValues(next);
                            scheduleActionSave({ metadataValues: next });
                          }}
                          className={`w-full text-xs sm:text-sm py-3 px-3.5 pr-10 rounded-2xl border border-slate-200 outline-none font-medium sm:font-bold shadow-2xs text-slate-800 min-h-[48px] transition-all ${
                            isReadOnlyMode ? 'bg-slate-100/90 cursor-default opacity-80' : 'bg-white focus:border-[#0F6659] cursor-pointer'
                          }`}
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
                          disabled={isReadOnlyMode}
                          onChange={(e) => {
                            if (isReadOnlyMode) return;
                            const val = e.target.value;
                            const next = { ...metadataValues, [field.id]: val };
                            setMetadataValues(next);
                            scheduleActionSave({ metadataValues: next });
                          }}
                          className={`w-full text-xs sm:text-sm py-3 px-3.5 pr-10 rounded-2xl border border-slate-200 outline-none font-medium sm:font-bold shadow-2xs text-slate-800 min-h-[48px] transition-all ${
                            isReadOnlyMode ? 'bg-slate-100/90 cursor-default opacity-80' : 'bg-white focus:border-[#0F6659] cursor-pointer'
                          }`}
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
                              disabled={isReadOnlyMode}
                              onClick={() => {
                                if (isReadOnlyMode) return;
                                const next = { ...metadataValues, [field.id]: opt };
                                setMetadataValues(next);
                                scheduleActionSave({ metadataValues: next });
                              }}
                              className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition-all ${
                                isReadOnlyMode ? 'pointer-events-none select-none' : 'cursor-pointer'
                              } ${currentVal === opt
                                  ? 'bg-[#0F6659] text-white border-[#0F6659] shadow-2xs font-black'
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
                            disabled={isReadOnlyMode}
                            onChange={(e) => {
                              if (isReadOnlyMode) return;
                              const val = e.target.value;
                              const next = { ...metadataValues, [field.id]: val };
                              setMetadataValues(next);
                              scheduleActionSave({ metadataValues: next });
                            }}
                            className={`w-full text-xs sm:text-sm pl-4 pr-10 py-3 min-h-[50px] rounded-2xl border outline-none font-medium sm:font-semibold text-slate-700 shadow-xs appearance-none truncate transition-all ${
                              isReadOnlyMode ? 'bg-slate-100/90 border-slate-200 cursor-default opacity-80' : 'bg-slate-50 border-slate-200 focus:border-[#0F6659] focus:bg-white cursor-pointer'
                            }`}
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
                        disabled={isReadOnlyMode}
                        onClick={() => {
                          if (isReadOnlyMode) return;
                          const next = { ...metadataValues, [field.id]: !isTrue };
                          setMetadataValues(next);
                          scheduleActionSave({ metadataValues: next });
                        }}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                          isReadOnlyMode ? 'cursor-default opacity-60' : 'cursor-pointer'
                        } ${isTrue
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
                      readOnly={isReadOnlyMode}
                      onChange={(e) => {
                        if (isReadOnlyMode) return;
                        const val = e.target.value;
                        const next = { ...metadataValues, [field.id]: val };
                        setMetadataValues(next);
                        scheduleActionSave({ metadataValues: next });
                      }}
                      onInput={(e) => {
                        // 🌟 ยืดขยายความสูงอัตโนมัติตามเนื้อหาที่พิมพ์จริง
                        e.target.style.height = "auto";
                        e.target.style.height = `${Math.max(56, e.target.scrollHeight)}px`;
                      }}
                      placeholder={isReadOnlyMode ? "(ไม่มีข้อความ)" : (field.placeholder || "กรอกข้อความหรือหมายเหตุ...")}
                      className={`w-full text-xs sm:text-sm placeholder:text-xs sm:placeholder:text-sm p-3.5 rounded-xl border border-slate-200 outline-none font-medium shadow-2xs resize-y min-h-[46px] transition-all ${
                        isReadOnlyMode ? 'bg-slate-100/90 text-slate-600 cursor-default' : 'bg-white focus:border-[#0F6659]'
                      }`}
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
                    disabled={isReadOnlyMode}
                    onClick={() => {
                      if (isReadOnlyMode) return;
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
                        scheduleActionSave({ isBackdated: next, backdatedStartDate: startStr, backdatedEndDate: endStr });
                      } else {
                        scheduleActionSave({ isBackdated: next });
                      }
                    }}
                    className={`px-4 py-2 rounded-2xl text-xs sm:text-sm font-black transition-all min-h-[38px] flex items-center justify-center shrink-0 ${
                      isReadOnlyMode
                        ? "bg-slate-200 text-slate-400 cursor-default opacity-60"
                        : isBackdated
                          ? "bg-[#0F6659] text-white shadow-sm hover:bg-[#0B4E44] active:scale-95 cursor-pointer"
                          : "bg-slate-200 hover:bg-slate-300 text-slate-700 active:scale-95 cursor-pointer"
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
                          disabled={isReadOnlyMode}
                          onChange={(e) => {
                            if (isReadOnlyMode) return;
                            const val = e.target.value;
                            setBackdatedStartDate(val);
                            scheduleActionSave({ backdatedStartDate: val });
                          }}
                          className={`w-full text-xs sm:text-sm py-2.5 px-3.5 pr-10 rounded-xl border border-slate-200 outline-none font-medium sm:font-semibold shadow-2xs min-h-[44px] transition-all ${
                            isReadOnlyMode ? 'bg-slate-100/90 text-slate-600 cursor-default opacity-80' : 'bg-white text-slate-800 focus:border-[#0F6659] cursor-pointer'
                          }`}
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
                          disabled={isReadOnlyMode}
                          onChange={(e) => {
                            if (isReadOnlyMode) return;
                            const val = e.target.value;
                            setBackdatedEndDate(val);
                            scheduleActionSave({ backdatedEndDate: val });
                          }}
                          className={`w-full text-xs sm:text-sm py-2.5 px-3.5 pr-10 rounded-xl border border-slate-200 outline-none font-medium sm:font-semibold shadow-2xs min-h-[44px] transition-all ${
                            isReadOnlyMode ? 'bg-slate-100/90 text-slate-600 cursor-default opacity-80' : 'bg-white text-slate-800 focus:border-[#0F6659] cursor-pointer'
                          }`}
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
              {hasUserAnswers && !isReadOnlyMode && (
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
                      {activeSectionIndex === sIdx && (
                        <SyncStatusPill
                          syncStatus={syncStatus}
                          showSaveTime={showSaveTime}
                          lastSavedTime={lastSavedTime}
                          onToggle={(e) => {
                            e.stopPropagation(); // ป้องกันไม่ให้ไปเปิด Drawer เมนู
                            setShowSaveTime(prev => !prev);
                          }}
                        />
                      )}
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
                        onViewPhoto={setPreviewImageUrl}
                        auditorOptions={auditorOptions}
                        readOnly={isReadOnlyMode}
                      />
                    ))}
                  </div>
                </div>
              ))}

              <div className="pt-4">
                <button type="button" onClick={() => setActiveTab(3)} className="w-full py-4 rounded-2xl text-sm font-extrabold bg-[#0F6659] text-white shadow-md active:scale-95 flex items-center justify-center gap-2">
                  ไปที่สรุปและลงชื่อ <ChevronRight size={16} />
                </button>
              </div>
              {hasUserAnswers && !isReadOnlyMode && (
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
                    readOnly={isReadOnlyMode}
                    onChange={(e) => {
                      if (isReadOnlyMode) return;
                      const val = e.target.value;
                      setExtraNote(val);
                      scheduleActionSave({ extraNote: val });
                    }}
                    onInput={(e) => {
                      e.target.style.height = "auto";
                      e.target.style.height = `${Math.max(96, e.target.scrollHeight)}px`;
                    }}
                    placeholder={isReadOnlyMode ? "(ไม่มีข้อคิดเห็น/ข้อเสนอแนะเพิ่มเติม)" : "พิมพ์สรุปผลการตรวจประเมิน ข้อเสนอแนะ..."}
                    className={`w-full text-xs sm:text-sm placeholder:text-xs sm:placeholder:text-sm p-3.5 rounded-2xl border border-slate-200 outline-none font-medium shadow-2xs resize-y min-h-[96px] text-slate-800 leading-relaxed transition-all ${
                      isReadOnlyMode
                        ? "bg-slate-100/90 text-slate-600 cursor-default"
                        : "bg-slate-50/50 focus:bg-white focus:border-[#0F6659]"
                    }`}
                  />
                </div>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-5">
                <SignaturePad
                  label={`1. ผู้รับการตรวจ (${unit?.fullName || unit?.name})`}
                  signatoryName={auditeeSignName}
                  onSignChange={(sig) => {
                    if (isReadOnlyMode) return;
                    setAuditeeSignature(sig);
                    scheduleActionSave({ auditeeSignature: sig });
                  }}
                  signatureUrl={auditeeSignature}
                  readOnly={isReadOnlyMode}
                />

                <SignaturePad
                  label={`2. ผู้ตรวจประเมิน (${loggedInAuditorName || auditorName || defaultAuditorName})`}
                  onSignChange={(sig) => {
                    if (isReadOnlyMode) return;
                    setAuditorSignature(sig);
                    scheduleActionSave({ auditorSignature: sig });
                  }}
                  signatureUrl={auditorSignature}
                  readOnly={isReadOnlyMode}
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
                    <span className="font-bold text-slate-900">{parseFloat(Number(scoreAnalysis.earnedScore).toFixed(2))} / {parseFloat(Number(scoreAnalysis.maxScore).toFixed(2))}</span>
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

              {hasUserAnswers && !isReadOnlyMode && (
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


        {/* REMOTE AUDIT SUBMITTED NOTIFICATION MODAL */}
        {remoteSubmittedInfo && typeof document !== 'undefined' && createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-sm sm:max-w-md w-full shadow-2xl border border-slate-200 space-y-5 text-center animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-[#0F6659] flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 size={36} strokeWidth={2.5} />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-xl font-black text-slate-900">
                  ผลการตรวจถูกส่งเรียบร้อยแล้ว
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed px-2">
                  รอบการตรวจนี้ได้รับการส่งผลการประเมินเรียบร้อยแล้ว
                  {remoteSubmittedInfo.submittedByName ? (
                    <> โดย <span className="font-bold text-slate-900">{remoteSubmittedInfo.submittedByName}</span></>
                  ) : null}
                  {remoteSubmittedInfo.percentageScore !== undefined ? (
                    <span className="block mt-2 font-bold text-sm sm:text-base text-[#0F6659]">
                      คะแนน {remoteSubmittedInfo.percentageScore}% ({remoteSubmittedInfo.isPassed ? "ผ่านเกณฑ์" : "ไม่ผ่านเกณฑ์"})
                    </span>
                  ) : null}
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleAcknowledgeSubmitted}
                  className="w-full py-3.5 px-4 rounded-2xl bg-[#0F6659] hover:bg-[#0c5449] active:scale-95 text-white font-extrabold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Check size={18} strokeWidth={2.5} />
                  <span>รับทราบและกลับสู่หน้าหลัก</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* 🌟 ปุ่มลัดแบบไอคอนล้วน มุมขวาล่าง 4 ปุ่ม (เลื่อนขึ้น / ล็อก-ปลดล็อก / บันทึกแบบร่าง / ส่งผลตรวจ) */}
        {step === "audit" && typeof document !== "undefined" && createPortal(
          <div className="fixed bottom-4 right-3 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end gap-2.5 select-none">
            {/* 1. เลื่อนขึ้นบนสุด */}
            <button
              type="button"
              onClick={() => {
                window.scrollTo({ top: 0, behavior: "smooth" });
                const mainEl = document.querySelector("main");
                if (mainEl) mainEl.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="w-11 h-11 rounded-full bg-white hover:bg-slate-50 text-slate-700 shadow-lg border border-slate-200 flex items-center justify-center cursor-pointer transition-transform active:scale-90"
              title="เลื่อนขึ้นบนสุดของหน้า"
              aria-label="เลื่อนขึ้นบนสุดของหน้า"
            >
              <ChevronUp size={22} strokeWidth={2.5} />
            </button>

            {/* 2. สลับโหมดล็อก / ปลดล็อกแก้ไข */}
            <button
              type="button"
              onClick={() => setIsReadOnlyMode(prev => !prev)}
              className={`w-11 h-11 rounded-full shadow-lg flex items-center justify-center cursor-pointer transition-transform active:scale-90 border ${
                isReadOnlyMode
                  ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-600 ring-2 ring-amber-400/40"
                  : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200"
              }`}
              title={isReadOnlyMode ? "คลิกเพื่อปลดล็อกกลับมาแก้ไขผลตรวจ" : "ล็อกหน้าจอ (ดูอย่างเดียว) ป้องกันการเผลอโดนคำตอบ"}
              aria-label={isReadOnlyMode ? "ปลดล็อกแก้ไข" : "ล็อกหน้าจอ"}
            >
              {isReadOnlyMode ? <Edit3 size={20} strokeWidth={2.4} /> : <Eye size={20} strokeWidth={2.4} />}
            </button>

            {/* 3. บันทึกแบบร่าง (แก้ไข = แผ่นดิสก์ / กำลังบันทึก = หมุนโหลด / บันทึกแล้ว = เช็คถูกในวงกลมตามรูป) */}
            {(() => {
              const isSpinning = isLocalSaving || syncStatus === "saving";
              return (
                <button
                  type="button"
                  onClick={hasUnsavedChanges && !isSpinning ? handleManualSave : undefined}
                  disabled={isReadOnlyMode || isSpinning || !hasUnsavedChanges}
                  className={`w-11 h-11 rounded-full shadow-lg flex items-center justify-center transition-colors select-none border touch-manipulation ${
                    isReadOnlyMode
                      ? "bg-white text-slate-300 border-slate-200 cursor-not-allowed"
                      : isSpinning
                      ? "bg-[#0F6659] text-white border-emerald-600 shadow-md cursor-wait"
                      : hasUnsavedChanges
                      ? "bg-[#0F6659] hover:bg-[#0c5247] text-white border-emerald-600 shadow-md cursor-pointer active:scale-95"
                      : "bg-white hover:bg-slate-50 text-emerald-600 border-slate-200 shadow-md cursor-default"
                  }`}
                  title={
                    isReadOnlyMode
                      ? "โหมดดูอย่างเดียว (ปลดล็อกเพื่อแก้ไขและบันทึก)"
                      : isSpinning
                      ? "กำลังบันทึกข้อมูล..."
                      : hasUnsavedChanges
                      ? "คลิกเพื่อบันทึกแบบร่าง (มีข้อมูลที่ยังไม่ได้บันทึก)"
                      : "บันทึกข้อมูลเรียบร้อยแล้ว"
                  }
                  aria-label="บันทึกแบบร่าง"
                >
                  {isReadOnlyMode ? (
                    <Save size={20} strokeWidth={2.4} />
                  ) : isSpinning ? (
                    <Loader2 size={20} className="animate-spin text-white" />
                  ) : hasUnsavedChanges ? (
                    <Save size={20} strokeWidth={2.4} />
                  ) : (
                    <CheckCircle2 size={22} strokeWidth={2.4} className="text-emerald-600" />
                  )}
                </button>
              );
            })()}

            {/* 4. ส่งผลตรวจประเมิน (ย้ายมาจากปุ่มใหญ่เดิมในแท็บ 3) */}
            <button
              id="audit-tab3-submit-btn"
              type="button"
              onClick={handleFinalSubmitTab3}
              disabled={isReadOnlyMode}
              className={`w-11 h-11 rounded-full shadow-lg flex items-center justify-center transition-all active:scale-90 border ${
                isReadOnlyMode
                  ? "bg-slate-200 text-slate-400 border-slate-300 cursor-not-allowed"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 ring-2 ring-emerald-500/30 cursor-pointer shadow-emerald-900/30"
              }`}
              title="บันทึกและส่งผลตรวจประเมิน"
              aria-label="บันทึกและส่งผลตรวจประเมิน"
            >
              <Send size={20} strokeWidth={2.2} />
            </button>
          </div>,
          document.body
        )}

        {/* 🌟 Simple Fullscreen Image Preview Modal */}
        {previewImageUrl && typeof document !== "undefined" && createPortal(
          <div
            className="fixed inset-0 z-[99999] bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 pt-14 pb-6 animate-in fade-in duration-200 select-none cursor-pointer"
            onClick={() => setPreviewImageUrl(null)}
          >
            {/* Image Box - constrained size so it never overflows and button stays visible */}
            <div
              className="relative inline-block max-w-[85vw] max-h-[68vh] sm:max-h-[76vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button at top-right of image (original style) */}
              <button
                type="button"
                onClick={() => setPreviewImageUrl(null)}
                className="absolute -top-10 right-0 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/25 hover:bg-white/40 active:bg-white/60 text-white flex items-center justify-center text-sm sm:text-base font-bold cursor-pointer transition-all shadow-lg border border-white/20 active:scale-95"
                title="ปิด (Esc)"
              >
                ✕
              </button>

              <img
                src={previewImageUrl}
                alt="Preview"
                className="max-w-[85vw] max-h-[68vh] sm:max-h-[76vh] object-contain rounded-xl sm:rounded-2xl shadow-2xl block cursor-default border border-white/10"
              />
            </div>
          </div>,
          document.body
        )}

        {/* 🌟 Modern Swipeable Notification Toast for Outdated Drafts */}
        {newerFormVersion && showNewFormToast && typeof document !== "undefined" && createPortal(
          <SwipeToast
            open={showNewFormToast}
            onClose={() => setShowNewFormToast(false)}
            position="top"
            title={`พบแบบฟอร์มเวอร์ชันใหม่`}
            description="หากย้ายแบบฟอร์ม ข้อมูลคำตอบบางข้ออาจเปลี่ยนแปลงได้"
            icon={<RefreshCw size={18} className="text-emerald-300 shrink-0" />}
            background="#0F6659"
            color="#ffffff"
            fuseColor="#34d399"
            width={400}
            radius={16}
            duration={7000}
            fuse="bottom"
            pauseOnHover={true}
            closeButton={true}
          />,
          document.body
        )}
      </div>
    );
  }

  return null;
}