import React, { useState, useMemo, useContext, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  X, Edit3, CheckCircle2, XCircle, MinusCircle, AlertTriangle, Save, Loader2,
  ArrowRight, MessageSquare, Users, FileText, Thermometer, Calendar, Clock,
  SlidersHorizontal, ChevronDown, Camera, Plus, MapPin, PenTool, RotateCcw,
  Navigation, CheckSquare, Trash2, ExternalLink, Check, Coins
} from "lucide-react";
import api, { getFullImageUrl } from "../config/api";
import { compressImageFile, validateImageFile } from "../utils/imageCompressor";
import { mono } from "../config/theme";
import { DataContext } from "../context/DataContext";
import { lockBodyScroll, unlockBodyScroll } from "../utils/scrollLock";

// ✍️ Digital Signature Pad Modal (High-DPI Touch & Mouse)
function SignaturePadModal({ title, initialSignatureUrl, onDone, onCancel }) {
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
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = "#0F6659";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // 🎨 Load existing / old signature onto canvas if present
    if (initialSignatureUrl) {
      setIsLoadingOldSignature(true);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        if (!canvasRef.current) return;
        const currentCtx = canvasRef.current.getContext("2d");
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
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current?.getContext("2d");
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
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    setHasSigned(false);
  };

  const confirmSign = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSigned) return;
    try {
      const dataUrl = canvas.toDataURL("image/png");
      onDone(dataUrl);
    } catch (e) {
      console.warn("Canvas toDataURL failed, falling back to initial signature", e);
      if (initialSignatureUrl) {
        onDone(initialSignatureUrl);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100000] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white rounded-3xl p-5 space-y-3.5 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <PenTool size={16} className="text-[#0F6659]" />
            <span>{title || "เซ็นชื่อลงในกรอบ"}</span>
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center cursor-pointer text-slate-500 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <div className="relative border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50/50 overflow-hidden touch-none">
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="w-full h-52 cursor-crosshair block bg-white"
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
              <span>ใช้นิ้วหรือเมาส์ลากเพื่อเซ็นชื่อ</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={clearCanvas}
            className="flex-1 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95"
          >
            <RotateCcw size={13} />
            <span>ล้างลายเซ็น</span>
          </button>
          <button
            type="button"
            onClick={confirmSign}
            disabled={!hasSigned || isLoadingOldSignature}
            className="flex-1 py-2.5 rounded-2xl bg-[#0F6659] hover:bg-[#0c5247] text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <CheckCircle2 size={14} />
            <span>ยืนยันลายเซ็น</span>
          </button>
        </div>
      </div>
    </div>
  );
}

const toDatetimeLocal = (isoDateStr) => {
  if (!isoDateStr) return "";
  try {
    const d = new Date(isoDateStr);
    if (isNaN(d.getTime())) return "";
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

const getAuditDurationText = (startStr, endStr) => {
  if (!startStr || !endStr) return null;
  try {
    const s = new Date(startStr);
    const e = new Date(endStr);
    const diffMs = e.getTime() - s.getTime();
    if (isNaN(diffMs) || diffMs < 0) return null;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    if (hours > 0) {
      return `${hours} ชม. ${mins > 0 ? `${mins} นาที` : ""}`;
    }
    return `${mins} นาที`;
  } catch {
    return null;
  }
};

// 🔍 Helper หาค่าประเภทการตรวจที่ตรงกับตัวเลือกในฟอร์ม (ครอบคลุมทั้ง EN และ TH)
export const matchAuditTypeOption = (raw, options = []) => {
  if (!raw) return (options && options[0]) || "";
  const rawStr = String(raw).trim().toLowerCase();

  // 1. ตรงกันเป๊ะ (Case-insensitive)
  const exact = (options || []).find(opt => opt && opt.toLowerCase() === rawStr);
  if (exact) return exact;

  // 2. Spot / Unannounced / นอกกำหนดการ / สุ่มตรวจ
  if (rawStr.includes("spot") || rawStr.includes("unannounced") || rawStr.includes("นอกกำหนดการ") || rawStr.includes("สุ่มตรวจ")) {
    const matched = (options || []).find(opt => {
      const o = (opt || "").toLowerCase();
      return o.includes("spot") || o.includes("unannounced") || o.includes("นอกกำหนดการ") || o.includes("สุ่มตรวจ");
    });
    if (matched) return matched;
  }

  // 3. Undercover / ปลอมตัว / ไม่เปิดเผยตัว
  if (rawStr.includes("undercover") || rawStr.includes("ปลอมตัว") || rawStr.includes("ไม่เปิดเผยตัว")) {
    const matched = (options || []).find(opt => {
      const o = (opt || "").toLowerCase();
      return o.includes("undercover") || o.includes("ปลอมตัว") || o.includes("ไม่เปิดเผยตัว");
    });
    if (matched) return matched;
  }

  // 4. Announced / ตามกำหนดการ / ปกติ
  if (rawStr.includes("announced") || rawStr.includes("ตามกำหนดการ") || rawStr.includes("ปกติ")) {
    const matched = (options || []).find(opt => {
      const o = (opt || "").toLowerCase();
      return o.includes("announced") || o.includes("ตามกำหนดการ") || o.includes("ปกติ");
    });
    if (matched) return matched;
  }

  // 5. Fallback หาตัวเลือกที่มีคำคล้าย
  const fallback = (options || []).find(opt => opt && (opt.toLowerCase().includes(rawStr) || rawStr.includes(opt.toLowerCase())));
  return fallback || (options && options[0]) || raw;
};

// 💰 ชนิดธนบัตรและเหรียญสำหรับการตรวจนับเงินสด
export const CASH_DENOMINATIONS = [1000, 500, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.25];

// 👤 Helper ดึงชื่อผู้ตรวจจาก record ที่ครอบคลุมทุก navigation property และ metadata
export const getAuditorNameFromRecord = (rec) => {
  if (!rec) return "";
  return rec.primaryAuditor?.fullName ||
         rec.primaryAuditor?.name ||
         rec.auditorName ||
         rec.auditor ||
         rec.metadataValues?.auditor ||
         rec.metadataValues?.auditor_name ||
         rec.metadataValues?.auditorName ||
         "";
};

// 🌟 หมวดหมู่ข้อตรวจ Drawer พร้อมแอนิเมชั่นเลื่อนเข้า-ออก (Slide-in / Slide-out Animation)
function EditSectionNavigationDrawer({ isOpen, onClose, groupedSections, onSelectSection, hasCashAudit }) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [animOpen, setAnimOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimOpen(true));
      });
      return () => cancelAnimationFrame(raf);
    } else {
      setAnimOpen(false);
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 260);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!shouldRender) return null;

  return typeof document !== "undefined" ? createPortal(
    <div className={`fixed inset-0 z-[100001] select-none transition-all ${
      animOpen ? "pointer-events-auto" : "pointer-events-none"
    }`}>
      {/* Backdrop with Fade In / Out */}
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-slate-900/40 backdrop-blur-2xs transition-opacity duration-250 ease-in-out ${
          animOpen ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Drawer Panel with Slide In / Out from Left */}
      <div
        className={`fixed top-0 left-0 bottom-0 w-72 sm:w-80 max-w-[85vw] bg-white shadow-2xl flex flex-col z-[100002] transition-transform duration-250 ease-out transform ${
          animOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="p-4 px-5 border-b border-slate-100 bg-slate-50/90 flex items-center justify-between shrink-0">
          <div>
            <div className="font-bold text-sm text-slate-800">หมวดหมู่ข้อตรวจ</div>
            <div className="text-[11px] text-slate-500 mt-0.5">เลือกหมวดที่ต้องการ</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-all cursor-pointer"
            title="ปิดเมนู"
          >
            <X size={16} />
          </button>
        </div>

        {/* Categories List in user requested order */}
        <div className="overflow-y-auto flex-1 divide-y divide-slate-100 custom-tab-scrollbar">
          {[
            { id: 'sec-reason', label: 'เหตุผลการแก้ไข', icon: '📝' },
            { id: 'sec-time-gps', label: 'เวลาตรวจ & พิกัด GPS', icon: '⏱️' },
            { id: 'sec-meta', label: 'รายละเอียดการตรวจ', icon: '📋' },
            { id: 'sec-signatures', label: 'ลายเซ็นดิจิทัล', icon: '✍️' },
            { id: 'sec-summary-notes', label: 'สรุปผลการตรวจ', icon: '📄' },
            { id: 'sec-checklist', label: 'รายการตรวจ', icon: '🔍', count: `${groupedSections.reduce((acc, s) => acc + s.items.length, 0)} ข้อ` },
            ...groupedSections.map((sec, idx) => ({
              id: sec.id,
              label: sec.title?.toLowerCase().startsWith("หมวด") ? sec.title : `หมวดที่ ${idx + 1}: ${sec.title}`,
              icon: `${idx + 1}`,
              count: `${sec.items.length} ข้อ`,
              isSection: true,
              isSubItem: true,
            })),
            ...(hasCashAudit ? [{ id: 'sec-cash-audit', label: 'ตรวจนับเงินสด', icon: '💵' }] : [])
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onClose();
                onSelectSection(item.id);
              }}
              className={`w-full flex items-center gap-3 px-5 py-3 border-none bg-transparent hover:bg-emerald-50/60 active:bg-emerald-100/60 transition-colors text-left cursor-pointer group ${
                item.isSubItem ? "pl-8 bg-slate-50/40" : ""
              }`}
            >
              {item.isSection ? (
                <span className="w-5 h-5 rounded-lg bg-slate-100 text-slate-700 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                  {item.icon}
                </span>
              ) : (
                <span className="text-lg flex items-center justify-center shrink-0 w-6 h-6 select-none">
                  {item.icon}
                </span>
              )}
              <div className="flex-1 min-w-0">
                <div className={`text-xs font-semibold truncate ${
                  item.isSubItem ? "text-slate-600 group-hover:text-slate-900" : "text-slate-800 group-hover:text-slate-950"
                }`}>
                  {item.label}
                </div>
                {item.count && (
                  <div className="text-[10.5px] text-slate-400 group-hover:text-emerald-700 font-medium mt-0.5">
                    {item.count}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  ) : null;
}

export default function EditAuditRecordModal({ isOpen, onClose, record, onSaveSuccess }) {
  const { forms = [], getFormDetail } = useContext(DataContext) || {};
  const [currentRecord, setCurrentRecord] = useState(record);
  const [fetchedFormConfig, setFetchedFormConfig] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [reason, setReason] = useState("");
  const [staffCount, setStaffCount] = useState(record?.staffCount || 0);
  const [generalNotes, setGeneralNotes] = useState(record?.notes || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState({});
  const [previewModalPhoto, setPreviewModalPhoto] = useState(null);

  // Time States
  const [startedAt, setStartedAt] = useState("");
  const [submittedAt, setSubmittedAt] = useState("");

  // Signatures
  const [auditorSignature, setAuditorSignature] = useState(null);
  const [auditeeSignature, setAuditeeSignature] = useState(null);
  const [auditorNameText, setAuditorNameText] = useState("");
  const [auditeeNameText, setAuditeeNameText] = useState("");
  const [activeSignModal, setActiveSignModal] = useState(null); // 'auditor' | 'auditee' | null

  // GPS Locations: เริ่มตรวจ (Start GPS) & หลังตรวจ (End GPS)
  const [startLatitude, setStartLatitude] = useState("");
  const [startLongitude, setStartLongitude] = useState("");
  const [endLatitude, setEndLatitude] = useState("");
  const [endLongitude, setEndLongitude] = useState("");
  const [isFetchingStartGps, setIsFetchingStartGps] = useState(false);
  const [isFetchingEndGps, setIsFetchingEndGps] = useState(false);
  const [gpsSuccess, setGpsSuccess] = useState({ start: false, end: false });

  const [sectionDrawerOpen, setSectionDrawerOpen] = useState(false);
  const sectionRefs = useRef({});

  useEffect(() => {
    if (!isOpen) return;
    lockBodyScroll();
    return () => {
      unlockBodyScroll();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!previewModalPhoto) return;
    lockBodyScroll();
    return () => {
      unlockBodyScroll();
    };
  }, [previewModalPhoto]);

  // Sync record prop
  useEffect(() => {
    setCurrentRecord(record);
  }, [record]);

  // Fetch latest record from API
  useEffect(() => {
    if (!isOpen || !record?.id) return;
    api.get(`/audit/${record.id}`)
      .then(res => {
        if (res.data) {
          setCurrentRecord(res.data);
        }
      })
      .catch(() => {});
  }, [isOpen, record?.id]);

  // Load user directory for auditor suggestions
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    api.get('/user')
      .then(res => {
        if (isMounted && res.data && Array.isArray(res.data)) {
          setUsersList(res.data);
        }
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, [isOpen]);

  const auditorSuggestions = useMemo(() => {
    return (usersList || []).filter(u => {
      const role = (u.role?.code || u.roleCode || u.role || "").toUpperCase();
      return role === "AUDITOR" || role === "ADMIN" || role === "STANDARD";
    });
  }, [usersList]);

  // Load form metadataConfig if available
  useEffect(() => {
    if (currentRecord?.surveyForm?.metadataConfig || currentRecord?.surveyForm?.metadataConfigJson) return;
    const matched = forms.find(f => f.id === currentRecord?.surveyFormId);
    if (matched?.metadataConfig || matched?.metadataConfigJson) return;

    if (currentRecord?.surveyFormId) {
      api.get(`/form/${currentRecord.surveyFormId}`)
        .then(res => {
          if (res.data?.metadataConfig) {
            setFetchedFormConfig(res.data.metadataConfig);
          } else if (res.data?.metadataConfigJson) {
            try {
              setFetchedFormConfig(JSON.parse(res.data.metadataConfigJson));
            } catch (e) {}
          }
        })
        .catch(() => {});
    }
  }, [currentRecord?.surveyFormId, currentRecord?.surveyForm, forms]);

  const activeMetadataFields = useMemo(() => {
    let fields = null;
    const direct = currentRecord?.surveyForm?.metadataConfig;
    if (Array.isArray(direct) && direct.length > 0) fields = direct;
    else if (currentRecord?.surveyForm?.metadataConfigJson) {
      try {
        const parsed = JSON.parse(currentRecord.surveyForm.metadataConfigJson);
        if (Array.isArray(parsed) && parsed.length > 0) fields = parsed;
      } catch (e) {}
    } else {
      const fromContext = forms.find(f => Number(f.id) === Number(currentRecord?.surveyFormId));
      if (Array.isArray(fromContext?.metadataConfig) && fromContext.metadataConfig.length > 0) {
        fields = fromContext.metadataConfig;
      } else if (fromContext?.metadataConfigJson) {
        try {
          const parsed = JSON.parse(fromContext.metadataConfigJson);
          if (Array.isArray(parsed) && parsed.length > 0) fields = parsed;
        } catch (e) {}
      } else if (Array.isArray(fetchedFormConfig) && fetchedFormConfig.length > 0) {
        fields = fetchedFormConfig;
      }
    }

    if (!fields || fields.length === 0) {
      fields = [
        { id: "auditor", label: "ผู้ตรวจประเมิน (Auditor)", type: "auditor", required: true, enabled: true, isSystem: true },
        { id: "audit_type", label: "ประเภทการตรวจ (Audit Type)", type: "select", options: ["ตามกำหนดการ (Announced)", "นอกกำหนดการ (Spot)", "ตรวจแบบไม่เปิดเผยตัว (Undercover)"], required: true, enabled: true, isSystem: true },
        { id: "staff_count", label: "จำนวนพนักงานขณะตรวจ", type: "number", unit: "คน", min: 0, required: true, enabled: true, isSystem: true },
        { id: "general_notes", label: "หมายเหตุภาพรวมการตรวจ", type: "text", placeholder: "ระบุหมายเหตุเพิ่มเติม (ถ้ามี)...", required: false, enabled: true }
      ];
    }

    return fields.filter(f => f && f.enabled !== false);
  }, [currentRecord, forms, fetchedFormConfig]);

  const [metadataValues, setMetadataValues] = useState({});

  // Match form schema (เฉพาะ ID ตรงกันเท่านั้น ห้ามใช้ชื่อฟอร์มเทียบข้ามเวอร์ชัน)
  const matchedForm = useMemo(() => {
    const targetId = currentRecord?.surveyFormId || currentRecord?.formId;
    if (!targetId) return null;
    return (forms || []).find(f => Number(f.id) === Number(targetId)) || null;
  }, [forms, currentRecord?.surveyFormId, currentRecord?.formId]);

  // 💰 ข้อมูลการตรวจนับเงินสด (Cash Audit)
  const hasCashAudit = Boolean(matchedForm?.hasCashAudit || currentRecord?.cashAuditDataJson);

  const [cashCounts, setCashCounts] = useState(() => {
    const initial = {};
    CASH_DENOMINATIONS.forEach(d => { initial[d] = "0"; });
    if (record?.cashAuditDataJson) {
      try {
        const parsed = typeof record.cashAuditDataJson === 'string' ? JSON.parse(record.cashAuditDataJson) : record.cashAuditDataJson;
        if (parsed?.items && Array.isArray(parsed.items)) {
          parsed.items.forEach(it => {
            if (it.denomination !== undefined) {
              initial[it.denomination] = String(it.count ?? 0);
            }
          });
        }
      } catch (e) {}
    }
    return initial;
  });

  useEffect(() => {
    if (currentRecord?.cashAuditDataJson) {
      try {
        const parsed = typeof currentRecord.cashAuditDataJson === 'string' ? JSON.parse(currentRecord.cashAuditDataJson) : currentRecord.cashAuditDataJson;
        if (parsed?.items && Array.isArray(parsed.items)) {
          setCashCounts(prev => {
            const updated = { ...prev };
            parsed.items.forEach(it => {
              if (it.denomination !== undefined) {
                updated[it.denomination] = String(it.count ?? 0);
              }
            });
            return updated;
          });
        }
      } catch (e) {}
    }
  }, [currentRecord?.cashAuditDataJson]);

  const totalCashAmount = useMemo(() => {
    return CASH_DENOMINATIONS.reduce((sum, denom) => {
      const count = Number(cashCounts[denom]);
      if (!isNaN(count) && count > 0) {
        return sum + count * denom;
      }
      return sum;
    }, 0);
  }, [cashCounts]);

  const handleCashCountChange = (denom, val) => {
    const cleaned = val === "" ? "" : (val.replace(/[^0-9.]/g, '') || "0");
    setCashCounts(prev => ({ ...prev, [denom]: cleaned }));
  };

  // 🌟 forms จาก context เป็นแบบ summary (ไม่มี sections) — โหลดเต็มตาม surveyFormId ของรอบตรวจจริง
  useEffect(() => {
    const targetId = currentRecord?.surveyFormId || currentRecord?.formId;
    if (!targetId || !getFormDetail) return;
    if (matchedForm && Array.isArray(matchedForm.sections)) return; // hydrate แล้ว
    getFormDetail(targetId);
  }, [currentRecord?.surveyFormId, currentRecord?.formId, matchedForm, getFormDetail]);

  // Build checklist questions
  const checklistQuestions = useMemo(() => {
    if (!currentRecord) return [];

    const resList = currentRecord.responses || [];
    const targetFormId = currentRecord?.surveyFormId || currentRecord?.formId;
    const isExactFormMatched = matchedForm && targetFormId && Number(matchedForm.id) === Number(targetFormId);

    if (isExactFormMatched && matchedForm?.sections && Array.isArray(matchedForm.sections) && matchedForm.sections.length > 0) {
      const itemsList = [];
      let runningNum = 1;

      matchedForm.sections.forEach((sec, secIdx) => {
        (sec.items || []).forEach((item, itemIdx) => {
          let res = resList.find(r => 
            (r.surveyItemId && Number(r.surveyItemId) === Number(item.id)) ||
            (r.surveyItem?.id && Number(r.surveyItem.id) === Number(item.id)) ||
            (r.questionText && item.questionText && r.questionText.trim().toLowerCase() === item.questionText.trim().toLowerCase()) ||
            (r.questionText && item.text && r.questionText.trim().toLowerCase() === item.text.trim().toLowerCase()) ||
            (r.surveyItem?.questionText && item.questionText && r.surveyItem.questionText.trim().toLowerCase() === item.questionText.trim().toLowerCase()) ||
            (r.surveyItem?.questionText && item.text && r.surveyItem.questionText.trim().toLowerCase() === item.text.trim().toLowerCase())
          );

          res = res || {};

          const itemId = item.id || res.surveyItemId || res.surveyItem?.id || `item_${runningNum}`;
          const qText = item.questionText || item.text || res.questionText || res.surveyItem?.questionText || `ข้อตรวจที่ ${runningNum}`;
          const qType = (res.questionType || res.surveyItem?.questionType || item.questionType || item.type || "yesno").toLowerCase();
          const fullScore = Number(res.fullScore !== undefined ? res.fullScore : (res.surveyItem?.fullScore || item.fullScore || 10));
          const isCrit = res.isCritical !== undefined ? res.isCritical : (res.surveyItem?.isCritical || item.isCritical || item.critical || false);

          // 🌟 สกัดหรือคำนวณเลขข้อที่แท้จริง (เช่น "1.1", "1.2", "2.1")
          const textMatch = qText.match(/^(?:ข้อ\s*)?(\d+(?:\.\d+)+)/i);
          const singleMatch = qText.match(/^(?:ข้อ\s*)(\d+)(?:\s|$|[:.-])/i);
          const computedNo = textMatch ? textMatch[1] : (singleMatch ? singleMatch[1] : (item.orderIndex || `${secIdx + 1}.${itemIdx + 1}`));

          itemsList.push({
            runningNum: runningNum++,
            secIdx: secIdx,
            itemIdx: itemIdx,
            questionNo: computedNo,
            surveyItemId: itemId,
            questionText: qText,
            questionType: qType,
            fullScore: fullScore,
            isCritical: isCrit,
            sectionId: sec.id || `sec_${secIdx}`,
            sectionTitle: sec.title || `หมวดที่ ${secIdx + 1}`,
            originalRes: res
          });
        });
      });

      if (itemsList.length > 0) return itemsList;
    }

    return resList.map((res, idx) => {
      const itemId = res.surveyItemId || res.id || `item_${idx + 1}`;
      const qText = res.questionText || res.surveyItem?.questionText || `ข้อตรวจที่ ${idx + 1}`;
      const qType = (res.questionType || res.surveyItem?.questionType || "yesno").toLowerCase();
      const fullScore = Number(res.fullScore !== undefined ? res.fullScore : (res.surveyItem?.fullScore || 10));
      const isCrit = res.isCritical !== undefined ? res.isCritical : (res.surveyItem?.isCritical || false);
      const secTitle = res.surveyItem?.surveySection?.title || "รายการตรวจประเมิน";

      const textMatch = qText.match(/^(?:ข้อ\s*)?(\d+(?:\.\d+)+)/i);
      const singleMatch = qText.match(/^(?:ข้อ\s*)(\d+)(?:\s|$|[:.-])/i);
      const computedNo = textMatch ? textMatch[1] : (singleMatch ? singleMatch[1] : String(idx + 1));

      return {
        runningNum: idx + 1,
        questionNo: computedNo,
        surveyItemId: itemId,
        questionText: qText,
        questionType: qType,
        fullScore: fullScore,
        isCritical: isCrit,
        sectionId: `sec_0`,
        sectionTitle: secTitle,
        originalRes: res
      };
    });
  }, [currentRecord, matchedForm]);

  // Group questions by section/category
  const groupedSections = useMemo(() => {
    if (matchedForm?.sections && Array.isArray(matchedForm.sections) && matchedForm.sections.length > 0) {
      return matchedForm.sections.map((sec, secIdx) => {
        const items = checklistQuestions.filter(q => q.sectionTitle === sec.title || q.sectionId === sec.id);
        return {
          id: `sec-cat-${secIdx}`,
          title: sec.title || `หมวดที่ ${secIdx + 1}`,
          description: sec.description || "",
          items: items.length > 0 ? items : []
        };
      }).filter(s => s.items.length > 0);
    }

    const map = {};
    checklistQuestions.forEach(q => {
      const cat = q.sectionTitle || "รายการตรวจประเมิน";
      if (!map[cat]) map[cat] = [];
      map[cat].push(q);
    });

    return Object.keys(map).map((cat, idx) => ({
      id: `sec-cat-${idx}`,
      title: cat,
      items: map[cat]
    }));
  }, [matchedForm, checklistQuestions]);

  const parseResponseAnswer = (q) => {
    const res = q.originalRes || {};
    const qType = (q.questionType || "yesno").toLowerCase();
    const fullScore = Number(q.fullScore || 10);

    const isNa = res.isNa === true || res.isNa === 1 || res.isNa === "true" || res.rawAnswer === "na" || res.answerValue === "na";

    let isPassed = true;
    if (isNa) {
      isPassed = false;
    } else if (res.isPassed !== undefined && res.isPassed !== null) {
      isPassed = res.isPassed === true || res.isPassed === 1 || res.isPassed === "true" || res.isPassed === "yes";
    } else if (res.rawAnswer !== undefined && res.rawAnswer !== null) {
      isPassed = res.rawAnswer === "yes" || res.rawAnswer === true || res.rawAnswer === 1 || res.rawAnswer === "1";
    } else if (res.scoreGiven !== undefined && res.scoreGiven !== null) {
      isPassed = Number(res.scoreGiven) > 0;
    } else if (res.id || res.surveyItemId) {
      isPassed = Number(res.scoreGiven || 0) > 0;
    } else {
      isPassed = true;
    }

    let scaleScore = null;
    if (qType === "scale") {
      if (res.scaleScore !== undefined && res.scaleScore !== null) {
        scaleScore = Number(res.scaleScore);
      } else if (res.rawAnswer && !isNaN(Number(res.rawAnswer))) {
        scaleScore = Math.max(1, Math.min(5, Number(res.rawAnswer)));
      } else if (res.scoreGiven !== undefined && res.scoreGiven !== null) {
        scaleScore = Math.max(1, Math.min(5, Math.round((Number(res.scoreGiven) / fullScore) * 5)));
      } else {
        scaleScore = isPassed ? 5 : 2;
      }
    }

    let scoreGiven = 0;
    if (isNa) {
      scoreGiven = 0;
    } else if (qType === "scale") {
      scoreGiven = ((scaleScore || 5) / 5) * fullScore;
    } else {
      scoreGiven = isPassed ? fullScore : 0;
    }

    let parsedImages = [];
    if (Array.isArray(res.images)) {
      parsedImages = res.images.map(img => img.imageUrl || img).filter(Boolean);
    } else if (Array.isArray(res.imageUrls)) {
      parsedImages = [...res.imageUrls].filter(Boolean);
    }

    return {
      surveyItemId: q.surveyItemId,
      isNa,
      isPassed,
      scoreGiven,
      fullScore,
      type: qType,
      scaleScore,
      notes: res.notes || "",
      imageUrls: parsedImages
    };
  };

  const buildInitialState = () => {
    const map = {};
    checklistQuestions.forEach(q => {
      map[q.surveyItemId] = parseResponseAnswer(q);
    });
    return map;
  };

  const [answersState, setAnswersState] = useState(buildInitialState);
  const [initialAnswers, setInitialAnswers] = useState(buildInitialState);
  const [expandedNotes, setExpandedNotes] = useState({});

  // Initialize/Sync all state on open
  useEffect(() => {
    if (!isOpen || !currentRecord) return;
    const initialMap = {};
    checklistQuestions.forEach(q => {
      initialMap[q.surveyItemId] = parseResponseAnswer(q);
    });
    setAnswersState(initialMap);
    setInitialAnswers(initialMap);
    setReason("");

    const rawNotes = currentRecord?.notes || "";
    setGeneralNotes(rawNotes.includes("????") ? "" : rawNotes);

    setStaffCount(currentRecord?.staffCount || 0);

    // Times
    setStartedAt(toDatetimeLocal(currentRecord?.startedAt || currentRecord?.auditDate || new Date().toISOString()));
    setSubmittedAt(toDatetimeLocal(currentRecord?.submittedAt || currentRecord?.signedAt || currentRecord?.auditDate || new Date().toISOString()));

    // Signatures & Names
    setAuditorSignature(currentRecord?.auditorSignatureUrl || null);
    setAuditeeSignature(currentRecord?.auditeeSignatureUrl || null);
    const resolvedAuditor = getAuditorNameFromRecord(currentRecord);
    setAuditorNameText(resolvedAuditor);
    setAuditeeNameText(currentRecord?.auditeeUser?.fullName || currentRecord?.auditeeNameText || currentRecord?.auditeeName || "ผู้จัดการสาขา");

    // GPS เริ่มตรวจ (Start GPS) & หลังตรวจ (End GPS)
    setStartLatitude(currentRecord?.startLatitude !== undefined && currentRecord?.startLatitude !== null ? String(currentRecord.startLatitude) : "");
    setStartLongitude(currentRecord?.startLongitude !== undefined && currentRecord?.startLongitude !== null ? String(currentRecord.startLongitude) : "");
    setEndLatitude(currentRecord?.endLatitude !== undefined && currentRecord?.endLatitude !== null ? String(currentRecord.endLatitude) : "");
    setEndLongitude(currentRecord?.endLongitude !== undefined && currentRecord?.endLongitude !== null ? String(currentRecord.endLongitude) : "");

    // Metadata
    let initialMeta = {};
    if (currentRecord.metadataValues && typeof currentRecord.metadataValues === "object") {
      initialMeta = { ...currentRecord.metadataValues };
    } else if (currentRecord.metadataValuesJson) {
      try {
        const parsed = JSON.parse(currentRecord.metadataValuesJson);
        if (parsed && typeof parsed === "object") initialMeta = { ...parsed };
      } catch (e) {}
    }

    // 👤 ดึงชื่อผู้ตรวจเก่าใส่ metadata
    if (resolvedAuditor) {
      if (!initialMeta.auditor) initialMeta.auditor = resolvedAuditor;
      if (!initialMeta.auditor_name) initialMeta.auditor_name = resolvedAuditor;
    }

    // 🏷️ ปรับประเภทการตรวจให้ตรงกับตัวเลือก dropdown ในฟอร์มจริงเสมอ
    const auditTypeField = activeMetadataFields.find(f => f.id === "audit_type" || f.id === "auditType");
    const auditTypeOpts = auditTypeField?.options || ["ตามกำหนดการ (Announced)", "นอกกำหนดการ (Spot)", "ตรวจแบบไม่เปิดเผยตัว (Undercover)"];
    const rawAuditType = initialMeta.audit_type || currentRecord.auditType || "announced";
    initialMeta.audit_type = matchAuditTypeOption(rawAuditType, auditTypeOpts);

    // 👥 จำนวนพนักงาน
    if ((initialMeta.staff_count === undefined || initialMeta.staff_count === null) && currentRecord.staffCount !== undefined) {
      initialMeta.staff_count = currentRecord.staffCount;
    }

    // 📝 หมายเหตุ
    if (initialMeta.general_notes === undefined && rawNotes) {
      initialMeta.general_notes = rawNotes;
    }

    setMetadataValues(initialMeta);

    setExpandedNotes({});
    setIsUploadingPhoto({});
    setPreviewModalPhoto(null);
    setError(null);
  }, [isOpen, currentRecord?.id, currentRecord, checklistQuestions, activeMetadataFields]);

  // 🔄 ดึงข้อมูลเดิมจากผลตรวจกลับมาทั้งหมด (Metadata, Auditor, Audit Type, Staff Count, GPS, Times)
  const handleResetToOriginalMetadata = () => {
    if (!currentRecord) return;
    const rawNotes = currentRecord.notes || "";
    setGeneralNotes(rawNotes.includes("????") ? "" : rawNotes);

    const resolvedAuditor = getAuditorNameFromRecord(currentRecord);
    setAuditorNameText(resolvedAuditor);
    setAuditeeNameText(currentRecord?.auditeeUser?.fullName || currentRecord?.auditeeNameText || currentRecord?.auditeeName || "ผู้จัดการสาขา");

    let meta = {};
    if (currentRecord.metadataValues && typeof currentRecord.metadataValues === "object") {
      meta = { ...currentRecord.metadataValues };
    } else if (currentRecord.metadataValuesJson) {
      try {
        const parsed = JSON.parse(currentRecord.metadataValuesJson);
        if (parsed && typeof parsed === "object") meta = { ...parsed };
      } catch (e) {}
    }

    if (resolvedAuditor) {
      meta.auditor = resolvedAuditor;
      meta.auditor_name = resolvedAuditor;
    }

    const auditTypeField = activeMetadataFields.find(f => f.id === "audit_type" || f.id === "auditType");
    const auditTypeOpts = auditTypeField?.options || ["ตามกำหนดการ (Announced)", "นอกกำหนดการ (Spot)", "ตรวจแบบไม่เปิดเผยตัว (Undercover)"];
    const rawAuditType = meta.audit_type || currentRecord.auditType || "announced";
    meta.audit_type = matchAuditTypeOption(rawAuditType, auditTypeOpts);

    if (currentRecord.staffCount !== undefined) {
      meta.staff_count = currentRecord.staffCount;
      setStaffCount(currentRecord.staffCount);
    }

    if (rawNotes) {
      meta.general_notes = rawNotes;
    }

    setMetadataValues(meta);

    // Reset GPS
    setStartLatitude(currentRecord.startLatitude !== undefined && currentRecord.startLatitude !== null ? String(currentRecord.startLatitude) : "");
    setStartLongitude(currentRecord.startLongitude !== undefined && currentRecord.startLongitude !== null ? String(currentRecord.startLongitude) : "");
    setEndLatitude(currentRecord.endLatitude !== undefined && currentRecord.endLatitude !== null ? String(currentRecord.endLatitude) : "");
    setEndLongitude(currentRecord.endLongitude !== undefined && currentRecord.endLongitude !== null ? String(currentRecord.endLongitude) : "");

    // Reset Times
    setStartedAt(toDatetimeLocal(currentRecord.startedAt || currentRecord.auditDate || new Date().toISOString()));
    setSubmittedAt(toDatetimeLocal(currentRecord.submittedAt || currentRecord.signedAt || currentRecord.auditDate || new Date().toISOString()));
  };

  // 🛡️ L4: ป้องกัน memory leak / set state on unmounted component กรณีปิด Modal ขณะรอ GPS
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // 📍 ดึงพิกัด GPS ปัจจุบันมากรอกอัตโนมัติ — แยกอิสระตาม targetType ("start" หรือ "end")
  // (จุดที่แก้จากของเดิม: เดิมปุ่มของแต่ละช่วงเรียก fetchCurrentCoordinates("both") เหมือนกันหมด
  // ทำให้กดปุ่ม "พิกัดเริ่มตรวจ" แล้วดันไปทับพิกัด "หลังตรวจ" ด้วยโดยไม่ตั้งใจ)
  const fetchCurrentCoordinates = (targetType) => {
    const isStart = targetType === "start";
    const isEnd = targetType === "end";
    if (!isStart && !isEnd) return;

    if (isStart) setIsFetchingStartGps(true);
    if (isEnd) setIsFetchingEndGps(true);
    setError(null);

    if (!navigator.geolocation) {
      if (isStart) setIsFetchingStartGps(false);
      if (isEnd) setIsFetchingEndGps(false);
      setError("อุปกรณ์หรือเบราว์เซอร์นี้ไม่รองรับการดึงพิกัด GPS");
      return;
    }

    const applyLocation = (coords) => {
      if (!isMountedRef.current) return;
      if (!coords?.latitude || !coords?.longitude) {
        if (isStart) setIsFetchingStartGps(false);
        if (isEnd) setIsFetchingEndGps(false);
        setError("ไม่พบข้อมูลพิกัดละติจูด/ลองจิจูดจากอุปกรณ์");
        return;
      }
      const latStr = String(Number(coords.latitude).toFixed(6));
      const lngStr = String(Number(coords.longitude).toFixed(6));

      if (isStart) {
        setStartLatitude(latStr);
        setStartLongitude(lngStr);
        setIsFetchingStartGps(false);
      }
      if (isEnd) {
        setEndLatitude(latStr);
        setEndLongitude(lngStr);
        setIsFetchingEndGps(false);
      }

      setGpsSuccess({ start: isStart, end: isEnd });

      setTimeout(() => {
        if (!isMountedRef.current) return;
        setGpsSuccess({ start: false, end: false });
      }, 3000);
    };

    // Stage 1: High accuracy GPS
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        applyLocation(pos.coords);
      },
      (err1) => {
        if (!isMountedRef.current) return;
        if (err1.code === 1) {
          if (isStart) setIsFetchingStartGps(false);
          if (isEnd) setIsFetchingEndGps(false);
          setError("เบราว์เซอร์ปฏิเสธการเข้าถึงตำแหน่ง กรุณากด 'อนุญาต (Allow Location)' ในเบราว์เซอร์");
          return;
        }

        // Stage 2: Fallback without high accuracy for faster response / network location
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            applyLocation(pos.coords);
          },
          (err2) => {
            if (!isMountedRef.current) return;
            if (isStart) setIsFetchingStartGps(false);
            if (isEnd) setIsFetchingEndGps(false);
            if (err2.code === 1) {
              setError("กรุณาอนุญาต (Allow Location) ในการเข้าถึงพิกัด");
            } else if (err2.code === 2) {
              setError("ไม่สามารถระบุพิกัดตำแหน่งได้ (Position Unavailable) กรุณากรอกพิกัดด้วยตนเอง");
            } else if (err2.code === 3) {
              setError("การค้นหาตำแหน่งใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้งหรือกรอกพิกัดด้วยตนเอง");
            } else {
              setError("ไม่สามารถดึงพิกัดได้ กรุณากรอกพิกัดด้วยตนเอง");
            }
          },
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
        );
      },
      { enableHighAccuracy: true, timeout: 4000, maximumAge: 0 }
    );
  };

  const handleFetchStartGps = () => fetchCurrentCoordinates("start");
  const handleFetchEndGps = () => fetchCurrentCoordinates("end");

  const handleMetaValueChange = (fieldId, val) => {
    setMetadataValues(prev => ({ ...prev, [fieldId]: val }));
    if (fieldId === "staff_count" || fieldId === "staffCount") {
      setStaffCount(Number(val) || 0);
    }
    if (fieldId === "general_notes" || fieldId === "notes") {
      setGeneralNotes(val);
    }
    if (fieldId === "auditor" || fieldId === "auditor_name" || fieldId === "auditorName") {
      setAuditorNameText(val);
    }
  };

  const toggleExpandNote = (itemId) => {
    setExpandedNotes((prev) => {
      const isCurrentlyOpen = prev[itemId] !== undefined
        ? prev[itemId]
        : (isQuestionEdited(itemId) || !!(answersState[itemId]?.notes && answersState[itemId].notes.trim()));
      return { ...prev, [itemId]: !isCurrentlyOpen };
    });
  };

  const isScoreEdited = (itemId) => {
    const orig = initialAnswers[itemId];
    const curr = answersState[itemId];
    if (!orig || !curr) return false;
    if (orig.isNa !== curr.isNa) return true;
    if (orig.isPassed !== curr.isPassed) return true;
    if (curr.type === "scale" && orig.scaleScore !== curr.scaleScore) return true;
    return false;
  };

  const isPhotosEdited = (itemId) => {
    const orig = initialAnswers[itemId];
    const curr = answersState[itemId];
    if (!orig || !curr) return false;
    const origPhotos = orig.imageUrls || [];
    const currPhotos = curr.imageUrls || [];
    if (origPhotos.length !== currPhotos.length) return true;
    return origPhotos.some((p, i) => p !== currPhotos[i]);
  };

  const isNoteEdited = (itemId) => {
    const orig = initialAnswers[itemId];
    const curr = answersState[itemId];
    if (!orig || !curr) return false;
    return (orig.notes || "").trim() !== (curr.notes || "").trim();
  };

  const isQuestionEdited = (itemId) => isScoreEdited(itemId) || isPhotosEdited(itemId) || isNoteEdited(itemId);

  const liveScoring = useMemo(() => {
    let earned = 0;
    let max = 0;
    let hasCritFail = false;

    checklistQuestions.forEach((q) => {
      const state = answersState[q.surveyItemId];
      if (!state) return;
      const full = state.fullScore || 10;
      if (state.isNa) return;

      max += full;
      if (state.type === "scale") {
        earned += ((state.scaleScore || 5) / 5) * full;
      } else {
        if (state.isPassed) earned += full;
      }

      if (q.isCritical && !state.isPassed && !state.isNa) {
        hasCritFail = true;
      }
    });

    const percent = max > 0 ? Number(((earned / max) * 100).toFixed(2)) : 0;
    const isPassed = percent >= (currentRecord?.surveyForm?.passingScore || 85) && !hasCritFail;

    return { earned, max, percent, isPassed, hasCritFail };
  }, [answersState, checklistQuestions, currentRecord]);

  const scrollToSection = (sectionId) => {
    setSectionDrawerOpen(false);
    setTimeout(() => {
      const el = sectionRefs.current[sectionId] || document.getElementById(sectionId);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  if (!isOpen || !currentRecord) return null;

  const originalScore = typeof currentRecord.score === "number" ? currentRecord.score : typeof currentRecord.percentageScore === "number" ? currentRecord.percentageScore : 0;
  const auditDurationText = getAuditDurationText(startedAt, submittedAt);

  const handleToggleYesNo = (itemId, choice) => {
    setAnswersState((prev) => {
      const current = prev[itemId] || { fullScore: 10, notes: "", imageUrls: [] };
      if (choice === "na") {
        return { ...prev, [itemId]: { ...current, isNa: true, isPassed: false, scoreGiven: 0 } };
      }
      if (choice === "yes") {
        return { ...prev, [itemId]: { ...current, isNa: false, isPassed: true, scoreGiven: current.fullScore } };
      }
      return { ...prev, [itemId]: { ...current, isNa: false, isPassed: false, scoreGiven: 0 } };
    });
    setExpandedNotes(prev => ({ ...prev, [itemId]: true }));
  };

  const handleSetScale = (itemId, val) => {
    setAnswersState((prev) => {
      const current = prev[itemId] || { fullScore: 10, notes: "", imageUrls: [] };
      return {
        ...prev,
        [itemId]: {
          ...current,
          isNa: false,
          isPassed: val >= 3,
          scaleScore: val,
          scoreGiven: (val / 5) * current.fullScore
        }
      };
    });
    setExpandedNotes(prev => ({ ...prev, [itemId]: true }));
  };

  const handleNoteChange = (itemId, val) => {
    setAnswersState((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], notes: val }
    }));
  };

  const handlePhotoUpload = async (itemId, files) => {
    if (!files || files.length === 0) return;

    const rawFileList = Array.from(files);
    const validFiles = [];
    const validationErrors = [];

    for (const f of rawFileList) {
      const check = validateImageFile(f);
      if (!check.valid) {
        validationErrors.push(`${f.name || "ไฟล์"}: ${check.message}`);
      } else {
        validFiles.push(f);
      }
    }

    if (validationErrors.length > 0) {
      alert(validationErrors.join("\n"));
      if (validFiles.length === 0) return;
    }

    setIsUploadingPhoto((prev) => ({ ...prev, [itemId]: true }));
    try {
      // 1. บีบอัดรูปภาพฝั่ง client ก่อนอัปโหลด
      const compressedBase64List = await Promise.all(validFiles.map((f) => compressImageFile(f)));

      // 2. อัปโหลดตรงไปยัง /audit/upload-image (เหมือน LiveAuditScreen) เพื่อไม่ให้ JSON payload บวม
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
        setAnswersState((prev) => {
          const current = prev[itemId] || { fullScore: 10, notes: "", imageUrls: [] };
          const existing = Array.isArray(current.imageUrls) ? current.imageUrls : [];
          return {
            ...prev,
            [itemId]: { ...current, imageUrls: [...existing, ...successfulUrls] }
          };
        });
      }

      if (failedCount > 0) {
        alert(lastBackendError.msg || (failedCount === validFiles.length
          ? "อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"
          : `อัปโหลดสำเร็จ ${successfulUrls.length} รูป แต่มี ${failedCount} รูปที่ล้มเหลว กรุณาลองใหม่`));
      }
    } catch (e) {
      console.error("Upload error:", e);
      alert("เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsUploadingPhoto((prev) => ({ ...prev, [itemId]: false }));
    }
  };

  const handlePhotoDelete = (itemId, photoIdx) => {
    setAnswersState((prev) => {
      const current = prev[itemId] || { fullScore: 10, notes: "", imageUrls: [] };
      const existing = Array.isArray(current.imageUrls) ? current.imageUrls : [];
      return {
        ...prev,
        [itemId]: { ...current, imageUrls: existing.filter((_, i) => i !== photoIdx) }
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError("กรุณาระบุเหตุผลภาพรวมในการแก้ไขผลตรวจ");
      return;
    }

    const invalidEditedItems = checklistQuestions.filter((q) => {
      const itemId = q.surveyItemId;
      if (!isScoreEdited(itemId)) return false;
      const note = answersState[itemId]?.notes?.trim();
      return !note;
    });

    if (invalidEditedItems.length > 0) {
      setExpandedNotes((prev) => {
        const next = { ...prev };
        invalidEditedItems.forEach((q) => { next[q.surveyItemId] = true; });
        return next;
      });
      setError(`กรุณาระบุคอมเมนต์สำหรับทุกข้อที่มีการแก้ไข (${invalidEditedItems.length} ข้อ) ก่อนบันทึก`);
      const firstInvalidId = invalidEditedItems[0].surveyItemId;
      setTimeout(() => {
        const el = document.getElementById(`note-input-${firstInvalidId}`);
        if (el) {
          el.focus();
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 50);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payloadResponses = checklistQuestions.map((q) => {
        const s = answersState[q.surveyItemId] || parseResponseAnswer(q);
        return {
          surveyItemId: Number(q.surveyItemId) || q.originalRes?.surveyItemId || 0,
          scoreGiven: s.scoreGiven,
          isPassed: s.isPassed,
          isNa: s.isNa,
          rawAnswer: s.isNa ? "na" : (s.type === "scale" ? String(s.scaleScore) : (s.isPassed ? "yes" : "no")),
          notes: s.notes || null,
          imageUrls: s.imageUrls || []
        };
      });

      const resolvedAuditor = metadataValues.auditor || metadataValues.auditor_name || auditorNameText || getAuditorNameFromRecord(currentRecord);
      const finalMetadata = {
        ...metadataValues,
        ...(resolvedAuditor ? { auditor: resolvedAuditor, auditor_name: resolvedAuditor } : {}),
        staff_count: Number(metadataValues.staff_count ?? staffCount) || 0
      };

      const payload = {
        reason: reason.trim(),
        auditeeUserId: currentRecord.auditeeUserId || null,
        auditeeNameText: auditeeNameText.trim() || null,
        staffCount: Number(finalMetadata.staff_count) || 0,
        auditType: (() => {
          const raw = String(metadataValues.audit_type || currentRecord.auditType || "announced").toLowerCase();
          if (raw.includes("spot") || raw.includes("unannounced") || raw.includes("นอกกำหนดการ") || raw.includes("สุ่มตรวจ")) return "spot";
          if (raw.includes("undercover") || raw.includes("ปลอมตัว") || raw.includes("ไม่เปิดเผยตัว")) return "undercover";
          return "announced";
        })(),
        notes: generalNotes || null,
        startedAt: startedAt ? new Date(startedAt).toISOString() : null,
        submittedAt: submittedAt ? new Date(submittedAt).toISOString() : null,
        auditorSignatureUrl: auditorSignature || null,
        auditeeSignatureUrl: auditeeSignature || null,
        startLatitude: startLatitude ? parseFloat(startLatitude) : null,
        startLongitude: startLongitude ? parseFloat(startLongitude) : null,
        endLatitude: endLatitude ? parseFloat(endLatitude) : null,
        endLongitude: endLongitude ? parseFloat(endLongitude) : null,
        metadataValuesJson: JSON.stringify(finalMetadata),
        cashAuditDataJson: hasCashAudit ? JSON.stringify({
          totalAmount: totalCashAmount,
          items: CASH_DENOMINATIONS.map(denom => ({
            denomination: denom,
            count: Number(cashCounts[denom]) || 0,
            amount: (Number(cashCounts[denom]) || 0) * denom
          }))
        }) : (currentRecord?.cashAuditDataJson || null),
        responses: payloadResponses
      };

      const res = await api.put(`/audit/${currentRecord.id}`, payload);
      if (onSaveSuccess) onSaveSuccess(res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "เกิดข้อผิดพลาดในการบันทึกการแก้ไข");
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full max-w-3xl max-h-[92dvh] bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/90 shrink-0 space-y-1">
          {/* Top Row: Icon + Title + Score Preview + Close Button */}
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={() => setSectionDrawerOpen(true)}
                className="w-8 h-8 rounded-xl bg-emerald-100/80 border border-emerald-300/70 flex items-center justify-center text-[#0F6659] shadow-2xs shrink-0 cursor-pointer hover:bg-emerald-200/80 active:scale-95 transition-all"
                title="เปิดหมวดหมู่"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
              </button>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-extrabold text-slate-800 leading-tight truncate">
                  แก้ไขบันทึกผลการตรวจ
                </h3>
                <p className="text-xs text-slate-500 font-medium truncate">
                  {currentRecord?.location?.name || currentRecord?.locationName || "สาขา"} {currentRecord?.surveyForm?.title ? `• ${currentRecord.surveyForm.title}` : ""}
                </p>
              </div>
            </div>

            {/* Live Score Preview Badge */}
            <div className="flex items-center gap-2 shrink-0">
              <div 
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl shadow-2xs text-xs font-bold transition-all border ${
                  liveScoring.isPassed
                    ? 'bg-[#0F6659] text-white border-emerald-700/50'
                    : 'bg-amber-500 text-amber-950 border-amber-600/40 shadow-amber-500/20'
                }`}
                style={{ fontFamily: mono }}
              >
                <span className={`line-through text-[11px] ${liveScoring.isPassed ? 'opacity-70 text-emerald-100' : 'opacity-75 text-amber-900'}`}>
                  {parseFloat(Number(originalScore).toFixed(2))}%
                </span>
                <ArrowRight size={12} className={liveScoring.isPassed ? "text-emerald-300 shrink-0" : "text-amber-900 shrink-0"} />
                <span className={`text-[10px] sm:text-sm font-black ${liveScoring.isPassed ? 'text-emerald-200' : 'text-slate-900'}`}>
                  {parseFloat(Number(liveScoring.percent).toFixed(2))}%
                </span>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer transition-colors border border-slate-200/60 shadow-2xs active:scale-95 shrink-0"
                title="ปิดหน้าต่าง"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* Section Navigation Drawer พร้อมแอนิเมชั่นเลื่อนเข้า-ออก */}
        <EditSectionNavigationDrawer
          isOpen={sectionDrawerOpen}
          onClose={() => setSectionDrawerOpen(false)}
          groupedSections={groupedSections}
          onSelectSection={scrollToSection}
          hasCashAudit={hasCashAudit}
        />

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          className="p-4 sm:p-5 overflow-y-auto overscroll-contain flex-1 space-y-5 custom-tab-scrollbar scroll-smooth"
        >
          {error && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 🌟 1. เหตุผลการแก้ไข (จำเป็น) */}
          <div id="sec-reason" className="space-y-3">
            {/* Mandatory Reason Box */}
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-2 shadow-2xs">
              <label className="text-xs font-extrabold text-amber-900 flex items-center gap-1.5">
                <MessageSquare size={13} className="text-amber-700" />
                <span>เหตุผลในการแก้ไขผลตรวจ <span className="text-rose-600 font-bold">*</span></span>
              </label>
              <textarea
                required
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="ระบุเหตุผลในการแก้ไข..."
                className="w-full text-xs p-3 rounded-xl bg-white border border-amber-300 focus:outline-none focus:ring-2 focus:ring-[#0F6659] text-slate-800 placeholder-slate-400 transition-all font-sans"
              />
            </div>
          </div>

          {/* 🌟 2. เวลาตรวจ & พิกัด GPS */}
          <div id="sec-time-gps" className="space-y-3.5">
            {/* ⏱️ ปรับเวลาเริ่มตรวจ และสิ้นสุดตรวจ */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                <label className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                  <Clock size={14} className="text-[#0F6659]" />
                  <span>เวลาการตรวจประเมิน</span>
                </label>
                {auditDurationText && (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-[#0F6659] border border-emerald-200 shadow-2xs">
                    เวลาตรวจ {auditDurationText}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                    <Calendar size={12} className="text-[#0F6659]" />
                    <span>เวลาเริ่มตรวจ</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={startedAt}
                    onChange={(e) => setStartedAt(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0F6659] font-medium text-slate-800 shadow-2xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                    <Clock size={12} className="text-[#0F6659]" />
                    <span>เวลาสิ้นสุดตรวจ</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={submittedAt}
                    onChange={(e) => setSubmittedAt(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0F6659] font-medium text-slate-800 shadow-2xs"
                  />
                </div>
              </div>
            </div>

            {/* 📍 ตำแหน่งและพิกัดที่ตั้ง (GPS Coordinates: เริ่มตรวจ & หลังตรวจ) */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 shadow-2xs">
              <div className="flex items-center gap-1.5 border-b border-slate-200/60 pb-2">
                <MapPin size={14} className="text-[#0F6659]" />
                <span className="text-xs font-extrabold text-slate-800">ตำแหน่งพิกัดที่ตั้ง (GPS)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* พิกัดตอนเริ่มตรวจ */}
                <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#0F6659]"></span>
                      <span>พิกัดเริ่มตรวจ</span>
                    </span>

                    <button
                      type="button"
                      onClick={handleFetchStartGps}
                      disabled={isFetchingStartGps}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95 disabled:opacity-50 border ${
                        gpsSuccess.start
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                          : "bg-emerald-50 hover:bg-emerald-100 text-[#0F6659] border-emerald-200"
                      }`}
                    >
                      {isFetchingStartGps ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : gpsSuccess.start ? (
                        <Check size={11} className="text-white" />
                      ) : (
                        <Navigation size={11} />
                      )}
                      <span>{gpsSuccess.start ? "ใช้พิกัดปัจจุบัน" : "พิกัดปัจจุบัน"}</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500">ละติจูด (Latitude)</label>
                      <input
                        type="text"
                        value={startLatitude}
                        onChange={(e) => setStartLatitude(e.target.value)}
                        placeholder="เช่น 13.756331"
                        className="w-full text-xs p-2 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0F6659] font-mono font-bold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500">ลองจิจูด (Longitude)</label>
                      <input
                        type="text"
                        value={startLongitude}
                        onChange={(e) => setStartLongitude(e.target.value)}
                        placeholder="เช่น 100.501762"
                        className="w-full text-xs p-2 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0F6659] font-mono font-bold text-slate-800"
                      />
                    </div>
                  </div>

                  {startLatitude && startLongitude && (
                    <div className="pt-0.5 text-right">
                      <a
                        href={`https://www.google.com/maps?q=${startLatitude},${startLongitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#0F6659] hover:underline font-bold text-[11px] inline-flex items-center gap-1"
                      >
                        <span>เปิดใน Google Maps</span>
                        <ExternalLink size={10} />
                      </a>
                    </div>
                  )}
                </div>

                {/* พิกัดตอนหลังตรวจ / สิ้นสุดการตรวจ */}
                <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                      <span>พิกัดหลังตรวจ</span>
                    </span>

                    <button
                      type="button"
                      onClick={handleFetchEndGps}
                      disabled={isFetchingEndGps}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95 disabled:opacity-50 border ${
                        gpsSuccess.end
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                          : "bg-emerald-50 hover:bg-emerald-100 text-[#0F6659] border-emerald-200"
                      }`}
                    >
                      {isFetchingEndGps ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : gpsSuccess.end ? (
                        <Check size={11} className="text-white" />
                      ) : (
                        <Navigation size={11} />
                      )}
                      <span>{gpsSuccess.end ? "ใช้พิกัดปัจจุบัน" : "พิกัดปัจจุบัน"}</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500">ละติจูด (Latitude)</label>
                      <input
                        type="text"
                        value={endLatitude}
                        onChange={(e) => setEndLatitude(e.target.value)}
                        placeholder="เช่น 13.756331"
                        className="w-full text-xs p-2 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0F6659] font-mono font-bold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500">ลองจิจูด (Longitude)</label>
                      <input
                        type="text"
                        value={endLongitude}
                        onChange={(e) => setEndLongitude(e.target.value)}
                        placeholder="เช่น 100.501762"
                        className="w-full text-xs p-2 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0F6659] font-mono font-bold text-slate-800"
                      />
                    </div>
                  </div>

                  {endLatitude && endLongitude && (
                    <div className="pt-0.5 text-right">
                      <a
                        href={`https://www.google.com/maps?q=${endLatitude},${endLongitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#0F6659] hover:underline font-bold text-[11px] inline-flex items-center gap-1"
                      >
                        <span>เปิดใน Google Maps</span>
                        <ExternalLink size={10} />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 🌟 3. ข้อมูลและรายละเอียดการตรวจ (Audit Details / Metadata) */}
          {activeMetadataFields && activeMetadataFields.length > 0 && (
            <div id="sec-meta" className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                  <FileText size={14} className="text-[#0F6659]" />
                  <span>รายละเอียดการตรวจ (Audit Details)</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeMetadataFields.map((field) => {
                  let val = metadataValues[field.id];
                  if (val === undefined || val === null || val === "") {
                    if (field.id === 'staff_count' || field.id === 'staffCount') {
                      val = currentRecord?.staffCount ?? staffCount ?? "";
                    } else if (field.id === 'audit_type' || field.id === 'auditType') {
                      val = matchAuditTypeOption(currentRecord?.auditType || "announced", field.options);
                    } else if (field.id === 'auditor' || field.id === 'auditor_name' || field.id === 'auditorName' || field.type === 'auditor') {
                      val = getAuditorNameFromRecord(currentRecord) || auditorNameText || "";
                    } else if (field.id === 'general_notes' || field.id === 'notes') {
                      val = generalNotes || currentRecord?.notes || "";
                    } else {
                      val = "";
                    }
                  }

                  const isTemp = field.unit?.includes('°') || field.label?.includes('อุณหภูมิ');

                  if (field.id === 'auditor' || field.type === 'auditor') {
                    return (
                      <div key={field.id} className="space-y-1">
                        <label className="text-[10.5px] font-bold text-slate-600 flex items-center gap-1">
                          <Users size={12} className="text-[#0F6659]" />
                          <span>{field.label}</span>
                          {field.required && <span className="text-rose-500">*</span>}
                        </label>
                        <div className="relative flex items-center">
                          <input
                            type="text"
                            list="auditor-suggestions-list"
                            value={val}
                            onChange={(e) => {
                              const nextVal = e.target.value;
                              handleMetaValueChange(field.id, nextVal);
                              setAuditorNameText(nextVal);
                            }}
                            placeholder={field.placeholder || `ระบุ${field.label}`}
                            className="w-full text-xs p-2.5 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#0F6659] font-bold text-slate-800 shadow-2xs"
                          />
                          {auditorSuggestions.length > 0 && (
                            <datalist id="auditor-suggestions-list">
                              {auditorSuggestions.map((u, i) => (
                                <option key={u.id || i} value={u.fullName || u.name} />
                              ))}
                            </datalist>
                          )}
                        </div>
                      </div>
                    );
                  }

                  if (field.type === 'number') {
                    return (
                      <div key={field.id} className="space-y-1">
                        <label className="text-[10.5px] font-bold text-slate-600 flex items-center gap-1">
                          {isTemp ? <Thermometer size={12} className="text-amber-500" /> : <Users size={12} className="text-slate-500" />}
                          <span>{field.label} {field.unit ? `(${field.unit})` : ''}</span>
                          {field.required && <span className="text-rose-500">*</span>}
                        </label>
                        <div className="relative flex items-center">
                          <input
                            type="number"
                            min={field.min !== undefined ? field.min : -50}
                            max={field.max !== undefined ? field.max : 999999}
                            value={val}
                            onChange={(e) => handleMetaValueChange(field.id, e.target.value)}
                            placeholder={field.placeholder || `ระบุ${field.label}`}
                            className="w-full text-xs p-2.5 pr-12 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#0F6659] font-bold text-slate-800 shadow-2xs"
                          />
                          {field.unit && (
                            <span className="absolute right-2 text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 select-none border border-slate-200 pointer-events-none">
                              {field.unit}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  }

                  if (field.type === 'date') {
                    return (
                      <div key={field.id} className="space-y-1">
                        <label className="text-[10.5px] font-bold text-slate-600 flex items-center gap-1">
                          <Calendar size={12} className="text-emerald-600" />
                          <span>{field.label}</span>
                          {field.required && <span className="text-rose-500">*</span>}
                        </label>
                        <input
                          type="date"
                          value={val}
                          onChange={(e) => handleMetaValueChange(field.id, e.target.value)}
                          className="w-full text-xs p-2.5 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#0F6659] font-bold text-slate-800 shadow-2xs"
                        />
                      </div>
                    );
                  }

                  if (field.type === 'time') {
                    return (
                      <div key={field.id} className="space-y-1">
                        <label className="text-[10.5px] font-bold text-slate-600 flex items-center gap-1">
                          <Clock size={12} className="text-emerald-600" />
                          <span>{field.label}</span>
                          {field.required && <span className="text-rose-500">*</span>}
                        </label>
                        <input
                          type="time"
                          value={val}
                          onChange={(e) => handleMetaValueChange(field.id, e.target.value)}
                          className="w-full text-xs p-2.5 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#0F6659] font-bold text-slate-800 shadow-2xs"
                        />
                      </div>
                    );
                  }

                  if (field.type === 'select') {
                    const isAuditType = field.id === 'audit_type' || field.id === 'auditType';
                    const effectiveVal = isAuditType ? matchAuditTypeOption(val || currentRecord?.auditType, field.options) : val;

                    return (
                      <div key={field.id} className="space-y-1">
                        <label className="text-[10.5px] font-bold text-slate-600 flex items-center gap-1">
                          <SlidersHorizontal size={12} className="text-slate-500" />
                          <span>{field.label}</span>
                          {field.required && <span className="text-rose-500">*</span>}
                        </label>
                        <div className="relative">
                          <select
                            value={effectiveVal}
                            onChange={(e) => handleMetaValueChange(field.id, e.target.value)}
                            className="w-full text-xs pl-3 pr-8 py-2.5 rounded-xl bg-white border border-slate-200 outline-none font-semibold text-slate-700 focus:border-[#0F6659] appearance-none shadow-2xs cursor-pointer"
                          >
                            <option value="">-- เลือก --</option>
                            {(field.options || []).map((opt, i) => (
                              <option key={i} value={opt}>{opt}</option>
                            ))}
                          </select>
                          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                            <ChevronDown size={14} />
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={field.id} className="space-y-1">
                      <label className="text-[10.5px] font-bold text-slate-600 flex items-center gap-1">
                        <FileText size={12} className="text-slate-400" />
                        <span>{field.label}</span>
                        {field.required && <span className="text-rose-500">*</span>}
                      </label>
                      <input
                        type="text"
                        value={val}
                        onChange={(e) => handleMetaValueChange(field.id, e.target.value)}
                        placeholder={field.placeholder || `ระบุ${field.label}`}
                        className="w-full text-xs p-2.5 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#0F6659] text-slate-800 font-medium shadow-2xs"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 🌟 4. การแก้ไขลายเซ็นดิจิทัล (Digital Signatures) */}
          <div id="sec-signatures" className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4 shadow-2xs">
            <div className="border-b border-slate-200/60 pb-2">
              <label className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                <PenTool size={14} className="text-[#0F6659]" />
                <span>ลายเซ็นดิจิทัล (Digital Signatures)</span>
              </label>
            </div>

            <div className="space-y-4">
              {/* 1. ผู้รับการตรวจ */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <PenTool size={13} className="text-[#0F6659]" />
                    <span>1. ผู้รับการตรวจ ({currentRecord?.location?.name || currentRecord?.locationName || "สาขา"})</span>
                  </span>
                  {auditeeSignature && (
                    <button
                      type="button"
                      onClick={() => setAuditeeSignature(null)}
                      className="text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw size={11} />
                      <span>ล้างลายเซ็น</span>
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setActiveSignModal('auditee')}
                  className="relative w-full border-2 border-dashed border-slate-300 rounded-2xl bg-white overflow-hidden hover:border-[#0F6659]/60 hover:bg-emerald-50/20 transition-all shadow-2xs h-24 sm:h-28 flex items-center justify-center cursor-pointer group"
                >
                  {auditeeSignature ? (
                    <img src={getFullImageUrl(auditeeSignature)} alt="Auditee Signature" className="max-h-full max-w-full object-contain p-2" />
                  ) : (
                    <div className="flex items-center justify-center text-slate-400 group-hover:text-[#0F6659] text-xs font-medium gap-1.5 select-none transition-colors">
                      <Edit3 size={14} />
                      <span>แตะเพื่อเซ็นชื่อ</span>
                    </div>
                  )}
                </button>
              </div>

              {/* 2. ผู้ตรวจประเมิน */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <PenTool size={13} className="text-[#0F6659]" />
                    <span>2. ผู้ตรวจประเมิน ({auditorNameText || currentRecord?.primaryAuditor?.fullName || "ผู้ตรวจประเมิน"})</span>
                  </span>
                  {auditorSignature && (
                    <button
                      type="button"
                      onClick={() => setAuditorSignature(null)}
                      className="text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw size={11} />
                      <span>ล้างลายเซ็น</span>
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setActiveSignModal('auditor')}
                  className="relative w-full border-2 border-dashed border-slate-300 rounded-2xl bg-white overflow-hidden hover:border-[#0F6659]/60 hover:bg-emerald-50/20 transition-all shadow-2xs h-24 sm:h-28 flex items-center justify-center cursor-pointer group"
                >
                  {auditorSignature ? (
                    <img src={getFullImageUrl(auditorSignature)} alt="Auditor Signature" className="max-h-full max-w-full object-contain p-2" />
                  ) : (
                    <div className="flex items-center justify-center text-slate-400 group-hover:text-[#0F6659] text-xs font-medium gap-1.5 select-none transition-colors">
                      <Edit3 size={14} />
                      <span>แตะเพื่อเซ็นชื่อ</span>
                    </div>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* 🌟 5. สรุปผลการตรวจ (Audit Summary / General Notes) */}
          <div id="sec-summary-notes" className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
              <label className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                <FileText size={14} className="text-[#0F6659]" />
                <span>สรุปผลการตรวจ (Audit Summary)</span>
              </label>
            </div>

            <div className="space-y-1.5">
              <textarea
                rows={3}
                value={generalNotes}
                onChange={(e) => setGeneralNotes(e.target.value)}
                placeholder="พิมพ์สรุปผลการตรวจประเมิน..."
                className="w-full text-xs p-3 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0F6659] text-slate-800 placeholder-slate-400 transition-all font-sans leading-relaxed"
              />
            </div>
          </div>

          {/* 🌟 6. รายการตรวจรายข้อ แยกตามหมวด */}
          <div id="sec-checklist" className="space-y-4 pt-1">
            <div className="text-xs font-extrabold text-slate-700 flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="flex items-center gap-1.5">
                <CheckSquare size={14} className="text-[#0F6659]" />
                <span>รายการตรวจประเมิน</span>
              </span>
            </div>

            {groupedSections.map((sec, secIdx) => (
              <div key={sec.id || secIdx} id={sec.id} ref={el => sectionRefs.current[sec.id] = el} className="space-y-3">
                {/* Header หมวด */}
                <div className="px-3.5 py-2.5 rounded-2xl bg-[#F4F9F6] border border-emerald-100 flex items-center justify-between shadow-2xs">
                  <h4 className="text-xs sm:text-sm font-extrabold text-[#0F6659] flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-[#0F6659] text-white flex items-center justify-center text-xs font-black shrink-0 shadow-2xs">
                      {secIdx + 1}
                    </span>
                    <span>{sec.title}</span>
                  </h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white text-[#0F6659] border border-emerald-200/80 shadow-2xs">
                    {sec.items.length} ข้อ
                  </span>
                </div>

                {/* ข้อตรวจในหมวดนี้ */}
                <div className="space-y-3">
                  {sec.items.map((q, qIdx) => {
                    const itemId = q.surveyItemId;
                    const state = answersState[itemId] || parseResponseAnswer(q);
                    const qText = q.questionText;
                    const qNo = q.questionNo || `${secIdx + 1}.${qIdx + 1}`;
                    const isCrit = q.isCritical;
                    const isScoreChanged = isScoreEdited(itemId);
                    const isEdited = isQuestionEdited(itemId);
                    const isNoteMissing = isScoreChanged && (!state.notes || !state.notes.trim());
                    const shouldShowNote = isEdited || !!expandedNotes[itemId] || !!(state.notes && state.notes.trim());

                    // แสดงข้อความคำถาม โดยตัด prefix เลขข้อที่ซ้ำออกเฉพาะกรณีที่มีข้อความคำถามจริงต่อท้าย
                    const displayQText = (() => {
                      if (!qText) return "";
                      const trimmed = qText.trim();
                      const prefixRegex = new RegExp(`^(?:ข้อ\\s*)?${String(qNo).replace('.', '\\.')}\\s*[:.-]?\\s*`, 'i');
                      const stripped = trimmed.replace(prefixRegex, '').trim();
                      if (stripped.length > 0 && /[\u0E00-\u0E7Fa-zA-Z0-9]/.test(stripped)) {
                        return stripped;
                      }
                      return trimmed;
                    })();

                    return (
                      <div 
                        key={itemId || qIdx}
                        className={`p-3.5 sm:p-4 rounded-2xl border transition-all shadow-2xs space-y-3 ${
                          isNoteMissing
                            ? 'border-rose-300 bg-rose-50/15 ring-1 ring-rose-400/20'
                            : isEdited 
                            ? 'border-[#0F6659]/60 bg-emerald-50/25 ring-1 ring-[#0F6659]/20' 
                            : 'border-slate-200/80 bg-white hover:border-slate-300'
                        }`}
                      >
                        {/* แถวบน: เลขข้อ / ปุ่มคอมเมนต์ / ปุ่มกล้อง */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 font-mono text-xs font-bold border border-slate-200/60 shadow-2xs">
                              ข้อ {qNo}
                            </span>
                            {isCrit && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-50 text-rose-600 border border-rose-200">
                                Critical
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            {/* ปุ่มคอมเมนต์ */}
                            <button
                              type="button"
                              onClick={() => toggleExpandNote(itemId)}
                              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border active:scale-95 ${
                                isNoteMissing
                                  ? 'bg-rose-50 text-rose-700 border-rose-300'
                                  : shouldShowNote
                                  ? 'bg-[#0F6659] text-white border-[#0F6659] shadow-2xs'
                                  : 'bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-[#0F6659] border-slate-200'
                              }`}
                              title={shouldShowNote ? "ปิดแถบคอมเมนต์" : "เปิดแถบคอมเมนต์"}
                            >
                              <MessageSquare size={13} />
                              {state.notes && (
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                              )}
                            </button>

                            {/* ปุ่มแนบรูป */}
                            <label
                              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border active:scale-95 ${
                                (state.imageUrls?.length || 0) > 0
                                  ? 'bg-emerald-50 text-[#0F6659] border-emerald-300 shadow-2xs'
                                  : 'bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-[#0F6659] border-slate-200'
                              }`}
                              title="แนบรูปถ่ายหลักฐาน"
                            >
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                multiple
                                className="hidden"
                                onChange={(e) => {
                                  handlePhotoUpload(itemId, e.target.files);
                                  e.target.value = '';
                                }}
                              />
                              {isUploadingPhoto[itemId] ? (
                                <Loader2 size={13} className="animate-spin text-[#0F6659]" />
                              ) : (
                                <Camera size={13} />
                              )}
                              {(state.imageUrls?.length || 0) > 0 && (
                                <span className="text-[11px] font-mono font-bold text-[#0F6659]">
                                  {state.imageUrls.length}
                                </span>
                              )}
                            </label>
                          </div>
                        </div>

                        {/* คำถาม */}
                        <div className="text-xs sm:text-sm font-bold text-slate-800 leading-relaxed break-words [overflow-wrap:anywhere]">
                          {displayQText}
                        </div>

                        {/* แกลเลอรีรูปถ่าย */}
                        {state.imageUrls && state.imageUrls.length > 0 && (
                          <div className="flex items-center gap-2 overflow-x-auto py-1 custom-tab-scrollbar">
                            {state.imageUrls.map((imgUrl, imgIdx) => (
                              <div key={imgIdx} className="relative shrink-0 rounded-xl overflow-hidden border border-slate-200 shadow-2xs group bg-slate-100">
                                <img
                                  src={getFullImageUrl(imgUrl)}
                                  alt={`Evidence ${imgIdx + 1}`}
                                  className="h-16 sm:h-20 w-22 sm:w-28 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={() => setPreviewModalPhoto(getFullImageUrl(imgUrl))}
                                />
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePhotoDelete(itemId, imgIdx);
                                  }}
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

                            <label className="h-16 sm:h-20 w-16 sm:w-20 shrink-0 rounded-xl border-2 border-dashed border-slate-300 hover:border-[#0F6659] hover:bg-emerald-50/50 flex flex-col items-center justify-center gap-0.5 text-slate-400 hover:text-[#0F6659] cursor-pointer transition-all">
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                multiple
                                className="hidden"
                                onChange={(e) => {
                                  handlePhotoUpload(itemId, e.target.files);
                                  e.target.value = '';
                                }}
                              />
                              <Plus size={16} />
                              <span className="text-[9px] font-bold">เพิ่มรูป</span>
                            </label>
                          </div>
                        )}

                        {/* ตัวเลือกแก้ไขคำตอบ */}
                        <div>
                          {state.type === "scale" ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {[5, 4, 3, 2, 1].map((num) => (
                                <button
                                  key={num}
                                  type="button"
                                  onClick={() => handleSetScale(itemId, num)}
                                  className={`flex-1 min-w-[42px] py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                                    state.scaleScore === num
                                      ? 'bg-[#0F6659] text-white border-[#0F6659] shadow-2xs'
                                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                                  }`}
                                >
                                  {num}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                              <button
                                type="button"
                                onClick={() => handleToggleYesNo(itemId, "yes")}
                                className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 border ${
                                  !state.isNa && state.isPassed
                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs ring-2 ring-emerald-600/20'
                                    : 'bg-slate-50 hover:bg-emerald-50 text-slate-700 border-slate-200 hover:border-emerald-200'
                                }`}
                              >
                                <CheckCircle2 size={14} />
                                <span>ผ่าน</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleToggleYesNo(itemId, "no")}
                                className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 border ${
                                  !state.isNa && !state.isPassed
                                    ? 'bg-rose-600 text-white border-rose-600 shadow-2xs ring-2 ring-rose-600/20'
                                    : 'bg-slate-50 hover:bg-rose-50 text-slate-700 border-slate-200 hover:border-rose-200'
                                }`}
                              >
                                <XCircle size={14} />
                                <span>ตก</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleToggleYesNo(itemId, "na")}
                                className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 border ${
                                  state.isNa
                                    ? 'bg-slate-700 text-white border-slate-700 shadow-2xs ring-2 ring-slate-700/20'
                                    : 'bg-slate-50 hover:bg-slate-100 text-slate-500 border-slate-200'
                                }`}
                                title="ไม่ประเมิน / ยกเว้นข้อนี้"
                              >
                                <MinusCircle size={14} />
                                <span>N/A</span>
                              </button>
                            </div>
                          )}
                        </div>

                        {/* กล่องคอมเมนต์/เหตุผลประจำข้อ */}
                        {shouldShowNote && (
                          <div className="pt-2 animate-in fade-in slide-in-from-top-1 duration-150 border-t border-slate-100 space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                                <MessageSquare size={12} className={isScoreChanged ? "text-amber-600" : isEdited ? "text-[#0F6659]" : "text-slate-400"} />
                                <span>{isScoreChanged ? "เหตุผลที่แก้ไข " : isEdited ? "คอมเมนต์ที่แก้ไข " : "คอมเมนต์ "}</span>
                                {isScoreChanged && (
                                  <span className="text-rose-600 font-extrabold text-[11px]">* (จำเป็น)</span>
                                )}
                              </div>
                            </div>
                            <input
                              id={`note-input-${itemId}`}
                              type="text"
                              value={state.notes || ""}
                              onChange={(e) => handleNoteChange(itemId, e.target.value)}
                              placeholder={isScoreChanged ? "พิมพ์เหตุผลที่แก้ไขข้อนี้ (จำเป็นต้องระบุ)..." : "พิมพ์หมายเหตุ/คอมเมนต์เพิ่มเติม..."}
                              className={`w-full text-xs px-3.5 py-2.5 rounded-xl border font-sans outline-none transition-all shadow-2xs ${
                                isNoteMissing
                                  ? 'border-rose-400 bg-rose-50/20 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 text-slate-800 placeholder:text-rose-400'
                                  : 'border-emerald-300 bg-white focus:border-[#0F6659] focus:ring-2 focus:ring-[#0F6659]/20 text-slate-800 placeholder:text-slate-400'
                              }`}
                              autoFocus={isScoreChanged}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* 🌟 7. ตรวจนับเงินสด (Cash Audit) - แสดงเมื่อฟอร์มเปิดหรือมีข้อมูลเดิม */}
          {hasCashAudit && (
            <div id="sec-cash-audit" className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2 flex-wrap gap-2">
                <div className="flex items-center gap-1.5">
                  <Coins size={15} className="text-[#0F6659]" />
                  <span className="text-xs font-extrabold text-slate-800">การตรวจนับเงินสด (Cash Audit)</span>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3">ชนิดธนบัตร / เหรียญ</th>
                      <th className="py-2.5 px-3 text-center w-28 sm:w-36">จำนวน</th>
                      <th className="py-2.5 px-3 text-right">จำนวนเงิน</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {CASH_DENOMINATIONS.map((denom) => {
                      const count = cashCounts[denom] ?? "";
                      const subtotal = (Number(count) || 0) * denom;
                      return (
                        <tr key={denom} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2 px-3 font-medium text-slate-700">
                            <span className="font-mono font-bold">{denom >= 1 ? denom.toLocaleString() : denom} บาท</span>
                          </td>
                          <td className="py-1.5 px-3 text-center">
                            <input
                              type="number"
                              min="0"
                              value={count}
                              onChange={(e) => handleCashCountChange(denom, e.target.value)}
                              className="w-20 sm:w-28 text-center text-xs py-1.5 px-2 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0F6659] font-mono font-bold text-slate-800"
                            />
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">
                            ฿{subtotal.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t border-slate-200 font-extrabold text-slate-800">
                    <tr>
                      <td colSpan={2} className="py-2.5 px-3 text-right text-xs">ยอดรวมทั้งหมด:</td>
                      <td className="py-2.5 px-3 text-right text-sm font-mono text-[#0F6659]">
                        ฿{totalCashAmount.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </form>

        {/* Footer Buttons */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/90 flex items-center justify-between shrink-0 z-10">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-2xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200/80 cursor-pointer active:scale-95 transition-all"
          >
            ยกเลิก
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !reason.trim()}
            className="px-5 py-2 rounded-2xl bg-[#0F6659] hover:bg-[#0c5247] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>กำลังบันทึก...</span>
              </>
            ) : (
              <>
                <Save size={14} />
                <span>บันทึกการแก้ไข</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ✍️ Signature Drawing Pad Modal */}
      {activeSignModal && (
        <SignaturePadModal
          title={activeSignModal === 'auditor' ? 'เซ็นชื่อผู้ตรวจประเมิน' : 'เซ็นชื่อผู้รับการตรวจ'}
          initialSignatureUrl={activeSignModal === 'auditor' ? auditorSignature : auditeeSignature}
          onDone={(sigDataUrl) => {
            if (activeSignModal === 'auditor') {
              setAuditorSignature(sigDataUrl);
            } else {
              setAuditeeSignature(sigDataUrl);
            }
            setActiveSignModal(null);
          }}
          onCancel={() => setActiveSignModal(null)}
        />
      )}

      {/* 🔍 Lightbox Preview Photo */}
      {previewModalPhoto && (
        <div 
          className="fixed inset-0 z-[100000] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setPreviewModalPhoto(null)}
        >
          <div className="relative max-w-2xl max-h-[85dvh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPreviewModalPhoto(null)}
              className="absolute -top-10 right-0 w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center cursor-pointer transition-all"
              title="ปิด"
            >
              <X size={18} />
            </button>
            <img
              src={previewModalPhoto}
              alt="Preview"
              className="max-h-[80dvh] w-auto max-w-full rounded-2xl object-contain shadow-2xl border border-white/10"
            />
          </div>
        </div>
      )}
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modalContent, document.body) : null;
}