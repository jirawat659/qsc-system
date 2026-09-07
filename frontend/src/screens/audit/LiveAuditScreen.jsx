import React, { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { PenTool, RotateCcw, Edit3, AlertCircle, ChevronDown, ChevronLeft, Store, Navigation, Search, ChevronRight, CheckCircle2, XCircle, Minus, Camera, MessageSquare, Plus, Trash2, Clock, ClipboardList, Check, Loader2, Save, CheckCheck, AlertTriangle, X, Calendar, BarChart3 } from "lucide-react";

import { c, sans, mono, cardStyle } from "../../config/theme";
import { TopBarContext } from "../../context/TopBarContext";
import { DataContext } from "../../context/DataContext";
import { getDistanceInMeters, formatDistance, DEFAULT_USER_COORDS } from "../../utils/geo";
import api from "../../config/api";

import ModalWrapper from "../../shared/ModalWrapper";
import Header from "../../shared/Header";
import Breadcrumbs from "../../shared/Breadcrumbs";
import Section from "../../shared/Section";
import ScoreRing from "../../shared/ScoreRing";
import ErrorBoundary from "../../shared/ErrorBoundary";
import { compressImageFile } from "../../utils/imageCompressor";
import { isFormApplicableToLocation } from "../../utils/formMatching";

const QuestionCommentInput = ({ initialValue, onChange }) => {
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
      placeholder="พิมพ์ข้อคิดเห็น / ข้อบกพร่องที่พบในข้อนี้..."
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
};

// 📊 หมวดหมู่คะแนนหลัก 5 หมวดตามมาตรฐาน QSC
export const CORE_CATEGORY_ORDER = [
  "ความสะอาด",
  "เอกสาร",
  "กระบวนการทำงาน",
  "คุณภาพสินค้า",
  "การบริการ"
];

// 🏷️ ดึงชื่อหมวดคะแนนของคำถามแต่ละข้อ (แยกอิสระจากหมวดคำถามของฟอร์ม)
export const getQuestionCategory = (q, sec) => {
  let name = (q?.categoryName || q?.category || "").trim();
  if (name) {
    if (name === "คุณภาพสินค้า-วัตถุดิบ") return "คุณภาพสินค้า";
    return name;
  }
  if (q?.categoryCode) {
    const code = q.categoryCode.toUpperCase();
    if (code === "CLN") return "ความสะอาด";
    if (code === "DOC") return "เอกสาร";
    if (code === "OPS") return "กระบวนการทำงาน";
    if (code === "QLT") return "คุณภาพสินค้า";
    if (code === "SVC") return "การบริการ";
    if (code === "REG" || code === "RULE") return "ความถูกระเบียบ";
    if (code === "SAF") return "ความปลอดภัย";
  }
  if (sec?.title) {
    if (sec.title.includes("สะอาด") || sec.title.includes("สุขอนามัย") || sec.title.includes("CLN")) return "ความสะอาด";
    if (sec.title.includes("เอกสาร") || sec.title.includes("DOC")) return "เอกสาร";
    if (sec.title.includes("บริการ") || sec.title.includes("SVC")) return "การบริการ";
    if (sec.title.includes("คุณภาพ") || sec.title.includes("QLT")) return "คุณภาพสินค้า";
    if (sec.title.includes("กระบวนการ") || sec.title.includes("โรงงาน") || sec.title.includes("OPS") || sec.title.includes("GMP")) return "กระบวนการทำงาน";
  }
  return "ความสะอาด";
};

// ✍️ Touch & Mouse High-DPI Digital Signature Pad — เปิดเป็น Modal เต็มจอเวลาเซ็น (ไม่เซ็นในหน้าเดิม)
function SignaturePadCanvas({ onDone, onCancel }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);

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
  }, []);

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
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    setHasSigned(false);
  };

  const confirmSign = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSigned) return;
    onDone(canvas.toDataURL('image/png'));
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
          {!hasSigned && (
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
            disabled={!hasSigned}
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
        {hasSigned ? (
          <img src={signatureUrl} alt={label} className="max-h-full max-w-full object-contain" />
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
          onCancel={() => setShowModal(false)}
          onDone={(dataUrl) => {
            onSignChange(dataUrl);
            setShowModal(false);
          }}
        />,
        document.body
      )}
    </div>
  );
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
  const { currentUser: ctxUser, locations: allLocations, visibleLocations, forms, activeDraft, activeDrafts, refreshData } = React.useContext(DataContext);
  const currentUser = propUser || ctxUser;
  const formList = forms || [];

  const targetLocationId = preselectedPlan?.locationId || (preselectedPlan?.locationName ? allLocations.find(l => l.name === preselectedPlan.locationName || l.fullName === preselectedPlan.locationName)?.id : null);
  const targetFormId = preselectedPlan?.surveyFormId;

  // 🎯 Find draft strictly matching THIS branch (locationId) and form
  const matchedDraftRecord = useMemo(() => {
    if (preselectedPlan?.isNewAudit) return null; // New audit NEVER uses existing draft

    // If preselectedPlan itself is the draft and explicitly requested resume
    if (preselectedPlan?.isResume && (preselectedPlan?.draftPayloadJson || preselectedPlan?.answers)) {
      return preselectedPlan;
    }

    // If this is not a resume request (e.g. user clicked "เริ่มตรวจตามแผนงาน" on a fresh plan), do NOT load draft
    if (preselectedPlan && !preselectedPlan.isResume) {
      return null;
    }

    if (!targetLocationId && !preselectedPlan?.locationName && !preselectedPlan?.unit) {
      return null;
    }

    const allDrafts = activeDrafts && activeDrafts.length > 0 ? activeDrafts : (activeDraft ? [activeDraft] : []);
    const found = allDrafts.find(d => {
      const dLocId = d.locationId || d.location?.id || d.unit?.id;
      const dLocName = d.locationName || d.locationFullName || d.unit?.name || d.unit?.fullName;
      const matchLoc = (targetLocationId && dLocId === targetLocationId) ||
        (preselectedPlan?.locationName && (dLocName === preselectedPlan.locationName || dLocName === preselectedPlan.unit)) ||
        (preselectedPlan?.unit && (dLocName === preselectedPlan.unit || (d.locationFullName && d.locationFullName.includes(preselectedPlan.unit))));
      const matchForm = !targetFormId || d.surveyFormId === targetFormId || d.formId === targetFormId;
      return matchLoc && matchForm;
    });

    return found || null;
  }, [preselectedPlan, targetLocationId, targetFormId, activeDrafts, activeDraft, allLocations]);

  // Parse draft payload ONLY if it matched THIS branch
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

    // Check localStorage scoped by locationId
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

  // 🌟 SORTING HIERARCHY: จัดเรียงตามระยะทาง GPS จากน้อยไปมาก สำหรับการตรวจงานใหม่
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
        const matchBrand = (u.locationBrands || []).some(lb =>
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

    // Sort by GPS distance ascending (น้อย ➔ มาก)
    return list.sort((a, b) => {
      const distA = getDistanceInMeters(userCoords.latitude, userCoords.longitude, a.latitude, a.longitude);
      const distB = getDistanceInMeters(userCoords.latitude, userCoords.longitude, b.latitude, b.longitude);
      return distA - distB;
    });
  }, [visibleLocations, searchBranch, userCoords, currentUser]);

  // Step flow: select-unit -> select-form -> audit
  // 🌟 หากเป็นการเปิดฉบับร่างค้างตรวจ หรือตามแผนงาน ให้ข้ามไปหน้า 'audit' ทันที!
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
    if (isResumeDraft && parsedDraftPayload?.unit) return parsedDraftPayload.unit;
    if (isFromAssignedPlan || isResumeDraft) {
      const locId = preselectedPlan?.locationId || targetLocationId;
      const locName = preselectedPlan?.locationName || preselectedPlan?.unit;
      return allLocations.find(u =>
        (locId && u.id === locId) ||
        (locName && (u.name === locName || u.fullName === locName || (u.fullName && u.fullName.includes(locName))))
      ) || allLocations[0];
    }
    return null;
  });

  // 🌟 Filter forms strictly applicable to the currently selected unit (Brand + Location Type + Specific Targets)
  const applicableForms = useMemo(() => {
    if (!unit) return formList;
    return formList.filter(f => isFormApplicableToLocation(f, unit));
  }, [formList, unit]);

  const [selectedForm, setSelectedForm] = useState(() => {
    const targetFId = (isResumeDraft && parsedDraftPayload?.formId) ? parsedDraftPayload.formId : (preselectedPlan?.surveyFormId || targetFormId);
    if (targetFId) {
      return formList.find(f => f.id === targetFId) || formList[0];
    }
    if (unit) {
      const matched = formList.filter(f => isFormApplicableToLocation(f, unit));
      if (matched.length > 0) return matched[0];
    }
    return formList[0];
  });

  const [sectionIdx, setSectionIdx] = useState(isResumeDraft ? (parsedDraftPayload?.sectionIdx || 0) : 0);
  const [answers, setAnswers] = useState(isResumeDraft ? (parsedDraftPayload?.answers || {}) : {});
  const [photos, setPhotos] = useState(isResumeDraft ? (parsedDraftPayload?.photos || {}) : {});
  const [comments, setComments] = useState(isResumeDraft ? (parsedDraftPayload?.comments || {}) : {});
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
    // กรองเฉพาะผู้ใช้งานที่มีสิทธิ์ตรวจ: AUDITOR, ADMIN, STANDARD
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
  const [extraNote, setExtraNote] = useState(isResumeDraft ? (parsedDraftPayload?.extraNote || "") : "");
  const [isBackdated, setIsBackdated] = useState(() => Boolean(parsedDraftPayload?.isBackdated));
  const [backdatedStartDate, setBackdatedStartDate] = useState(() => parsedDraftPayload?.backdatedStartDate || "");
  const [backdatedEndDate, setBackdatedEndDate] = useState(() => parsedDraftPayload?.backdatedEndDate || "");

  // Auto-sync status indicator
  const [syncStatus, setSyncStatus] = useState("idle"); // 'idle' | 'saving' | 'synced' // 'synced' | 'saving'
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDiscardConfirmModal, setShowDiscardConfirmModal] = useState(false);
  const [highlightedQuestionId, setHighlightedQuestionId] = useState(null);
  const [auditeeSignature, setAuditeeSignature] = useState(null);
  const [auditorSignature, setAuditorSignature] = useState(null);
  const [auditeeSignName, setAuditeeSignName] = useState(unit?.managerName || "ผู้จัดการสาขา");
  const [auditStartedAt, setAuditStartedAt] = useState(() => parsedDraftPayload?.startedAt || new Date().toISOString());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [isCategoryBreakdownExpanded, setIsCategoryBreakdownExpanded] = useState(true);

  useEffect(() => {
    if (unit?.managerName) {
      setAuditeeSignName(unit.managerName);
    }
    // Update coordinates from unit if available
    if (unit?.latitude && unit?.longitude) {
      setUserCoords({
        latitude: unit.latitude,
        longitude: unit.longitude
      });
    }
  }, [unit]);

  // 📍 GPS location tracking on mount (single watcher — no more race between two getCurrentPosition calls)
  useEffect(() => {
    let cancelled = false;
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled || !pos?.coords) return;
          setUserCoords({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          });
        },
        (err) => {
          if (cancelled) return;
          // Fallback to unit coordinates if GPS not permitted
          if (unit?.latitude && unit?.longitude) {
            setUserCoords({
              latitude: unit.latitude,
              longitude: unit.longitude
            });
          }
        },
        { enableHighAccuracy: true, timeout: 6000 }
      );
    }
    return () => {
      cancelled = true;
    };
  }, []);

  // 📍 Automatic Draft Hydration Effect (Runs ONCE when draft data arrives for this specific branch)
  // 🛡️ Includes form version validation: if the form was updated since the draft was saved,
  //    discard stale answers whose SurveyItemIds no longer exist in the current form.
  const hasHydratedDraftRef = useRef(false);
  useEffect(() => {
    if (parsedDraftPayload && !hasHydratedDraftRef.current && isResumeDraft) {
      hasHydratedDraftRef.current = true;

      // 🛡️ Form Version Validation: check that draft answer keys still exist in the current form
      const currentForm = selectedForm || formList.find(f => f.id === parsedDraftPayload.formId);
      const currentItemIds = new Set();
      if (currentForm?.sections) {
        for (const sec of currentForm.sections) {
          for (const item of (sec.items || [])) {
            currentItemIds.add(String(item.id));
          }
        }
      }

      if (parsedDraftPayload.answers && Object.keys(parsedDraftPayload.answers).length > 0) {
        if (currentItemIds.size > 0) {
          // Filter out answers whose SurveyItemId no longer exists in the current form
          const validAnswers = {};
          const staleKeys = [];
          for (const [key, val] of Object.entries(parsedDraftPayload.answers)) {
            if (currentItemIds.has(String(key))) {
              validAnswers[key] = val;
            } else {
              staleKeys.push(key);
            }
          }
          if (staleKeys.length > 0) {
            console.warn(`[Draft] ⚠️ Discarded ${staleKeys.length} stale answer(s) — form was updated since draft was saved`);
          }
          setAnswers(validAnswers);
        } else {
          setAnswers(parsedDraftPayload.answers);
        }
      }
      if (parsedDraftPayload.photos && Object.keys(parsedDraftPayload.photos).length > 0) {
        // Also filter photos by valid item IDs
        if (currentItemIds.size > 0) {
          const validPhotos = {};
          for (const [key, val] of Object.entries(parsedDraftPayload.photos)) {
            if (currentItemIds.has(String(key))) {
              validPhotos[key] = val;
            }
          }
          setPhotos(validPhotos);
        } else {
          setPhotos(parsedDraftPayload.photos);
        }
      }
      if (parsedDraftPayload.comments && Object.keys(parsedDraftPayload.comments).length > 0) {
        if (currentItemIds.size > 0) {
          const validComments = {};
          for (const [key, val] of Object.entries(parsedDraftPayload.comments)) {
            if (currentItemIds.has(String(key))) {
              validComments[key] = val;
            }
          }
          setComments(validComments);
        } else {
          setComments(parsedDraftPayload.comments);
        }
      }
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
        setUnit(parsedDraftPayload.unit);
      }
      if (parsedDraftPayload.formId && (!selectedForm || selectedForm.id !== parsedDraftPayload.formId)) {
        const foundForm = formList.find(f => f.id === parsedDraftPayload.formId);
        if (foundForm) setSelectedForm(foundForm);
      }
      setStep("audit");
      setActiveTab(2);
    }
  }, [parsedDraftPayload, isResumeDraft, unit, selectedForm, formList]);

  // Inform parent whether an active live audit is happening
  useEffect(() => {
    const isActivelyAuditing = step === "audit";
    if (onActiveStateChangeRef.current) {
      onActiveStateChangeRef.current(isActivelyAuditing);
    }
    return () => {
      if (onActiveStateChangeRef.current) onActiveStateChangeRef.current(false);
    };
  }, [step]);

  // 🌟 Sync subHeader to MainDashboard TopBar (แทนที่แถบโลโก้ด้วยปุ่มย้อนกลับ)
  useEffect(() => {
    if (!setSubHeader) return;
    if (step === "select-unit") {
      setSubHeader(prev => (prev === null ? prev : null));
      return;
    }

    const title = step === "select-form" ? "เลือกแบบฟอร์มการตรวจ" : (unit?.fullName || unit?.name || "ตรวจประเมิน QSC");
    const subtitle = step === "select-form" ? (unit?.fullName || unit?.name || "-") : (selectedForm?.title || "แบบฟอร์มการตรวจ");

    setSubHeader(prev => {
      if (
        prev &&
        prev.title === title &&
        prev.subtitle === subtitle &&
        prev.isAudit === true &&
        prev.hasBack === true
      ) {
        return prev;
      }

      return {
        title,
        subtitle,
        hasBack: true,
        isAudit: true,
        onBack: () => {
          if (step === "select-form") {
            setStep("select-unit");
          } else {
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
  }, [step, unit?.id, unit?.name, unit?.fullName, selectedForm?.id, selectedForm?.title, isResumeDraft, isFromAssignedPlan, setSubHeader]);

  // 📡 Report real-time sync status to parent TopBar
  useEffect(() => {
    if (onSyncStatusChangeRef.current) {
      onSyncStatusChangeRef.current(step === "audit" ? syncStatus : "idle");
    }
  }, [syncStatus, step]);

  // 🔝 Always scroll window and container to top when changing steps or tabs
  const scrollToTop = () => {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.querySelector('main')?.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.body.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    } catch (e) { }
  };

  useEffect(() => {
    scrollToTop();
    const t1 = setTimeout(scrollToTop, 20);
    const t2 = setTimeout(scrollToTop, 100);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [step, activeTab]);

  // ⚡ Instant Event-driven Auto-Sync to Backend & LocalStorage
  const autoSaveTimerRef = useRef(null);
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
      Object.keys(metadataValues).length > 0
    );
  }, [answers, photos, comments, staffCount, extraNote, metadataValues, isBackdated, backdatedStartDate, backdatedEndDate]);

  const performSaveDraft = async (overrideData = {}) => {
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

      if (!currentUnit?.id || !currentForm?.id || step !== "audit") {
        setSyncStatus("idle");
        return;
      }

      const totalAnswered = Object.keys(currentAnswers).length;

      // 🎯 Only persist draft when the auditor has answered at least 1 question
      if (totalAnswered === 0) {
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
        isBackdated: currentIsBackdated,
        backdatedStartDate: currentBackdatedStartDate,
        backdatedEndDate: currentBackdatedEndDate,
        startedAt: parsedDraftPayload?.startedAt || new Date().toISOString()
      };

      const totalQuestions = (currentForm?.sections || []).reduce(
        (acc, sec) => acc + (sec.items?.length || 0), 0
      );

      const draftPayloadJson = JSON.stringify(payload);

      // 1. Instant localStorage cache specifically scoped to THIS location & form
      try {
        localStorage.setItem(`qsc_draft_${currentUnit.id}_${currentForm.id}`, draftPayloadJson);
      } catch (e) { }

      const effectiveSchedId = (preselectedPlan?.id && Number(preselectedPlan.id) > 0) 
        ? Number(preselectedPlan.id) 
        : (preselectedPlan?.scheduleId ? Number(preselectedPlan.scheduleId) : null);

      // 2. Persist to SQLite Backend
      await api.put('/audit/draft', {
        locationId: currentUnit.id,
        surveyFormId: currentForm.id,
        auditorId: currentUser?.id || 1,
        auditScheduleId: effectiveSchedId,
        draftPayloadJson: draftPayloadJson,
        currentSectionIdx: currentSectionIdx,
        totalAnswered,
        totalQuestions,
        startLatitude: parsedDraftPayload?.startLatitude || userCoords.latitude,
        startLongitude: parsedDraftPayload?.startLongitude || userCoords.longitude,
        startedAt: payload.startedAt
      });

      setSyncStatus("synced");

      const draftObj = {
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
      
      setSyncStatus("error");
    }
  };

  // 🔄 Auto-Sync whenever any details, answers, or metadata change
  useEffect(() => {
    if (!unit?.id || !selectedForm?.id || step !== "audit") {
      setSyncStatus("idle");
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
    }, 400);

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
    step,
    currentUser
  ]);

  const currentSections = selectedForm?.sections || [];
  const passingScore = selectedForm?.passingScore || 85;

  const paginatedBranchList = useMemo(() => {
    const start = (branchPage - 1) * branchPageSize;
    return sortedBranchList.slice(start, start + branchPageSize);
  }, [sortedBranchList, branchPage]);

  // 📸 Handle Photo Upload with Client-side Compression & Multiple Photos Support
  const handlePhotoUpload = async (questionId, files) => {
    if (!files || files.length === 0) return;
    try {
      const fileList = Array.from(files);
      const compressedUrls = await Promise.all(fileList.map(f => compressImageFile(f)));
      setPhotos(prev => {
        const existing = Array.isArray(prev[questionId])
          ? prev[questionId]
          : (prev[questionId] ? [prev[questionId]] : []);
        const next = { ...prev, [questionId]: [...existing, ...compressedUrls] };
        performSaveDraft({ photos: next });
        return next;
      });
    } catch (e) {
      console.error("Compression error:", e);
    }
  };

  const handlePhotoDelete = (questionId, photoIdx) => {
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
      performSaveDraft({ photos: next });
      return next;
    });
  };

  // ⚡ Handle Answer Select with Instant Save
  const handleAnswerSelect = (questionId, val) => {
    if (highlightedQuestionId === questionId) {
      setHighlightedQuestionId(null);
    }
    setAnswers(prev => {
      const next = { ...prev };
      if (next[questionId] === val) {
        delete next[questionId]; // Toggle to unselect
      } else {
        next[questionId] = val;
      }
      performSaveDraft({ answers: next });
      return next;
    });
  };

  // 📝 Handle Comment Change with Debounced Save
  const handleCommentChange = (questionId, val) => {
    setComments(prev => {
      const next = { ...prev, [questionId]: val };
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(() => {
        performSaveDraft({ comments: next });
      }, 350);
      return next;
    });
  };

  // Calculate live scores & stats (with N/A Fair Scoring & Critical Defect check)
  const scoreAnalysis = useMemo(() => {
    let earnedScore = 0;
    let maxScore = 0;
    let naCount = 0;
    let hasCriticalDefect = false;
    const failedQuestions = [];

    currentSections.forEach(sec => {
      (sec.items || []).forEach(q => {
        const ans = answers[q.id];

        // 🌟 1. If question is marked as N/A ("ข้าม"): do not count in maxScore
        if (ans === "na") {
          naCount++;
          return; // Skip adding to maxScore
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

    const percentage = maxScore > 0 ? Math.round((earnedScore / maxScore) * 100) : 100;
    const isPassed = percentage >= passingScore && !hasCriticalDefect;

    return { earnedScore, maxScore, percentage, isPassed, hasCriticalDefect, naCount, failedQuestions };
  }, [currentSections, answers, comments, passingScore]);

  // 📊 Live Category Score Breakdown (หมวดหมู่คะแนน - แยกอิสระจากหมวดคำถาม)
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

        // N/A questions: excluded from maxScore (Fair Scoring)
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
      const percentage = cat.maxScore > 0 ? Math.round((cat.earnedScore / cat.maxScore) * 100) : 0;
      return {
        ...cat,
        percentage,
      };
    });

    // Sort by CORE_CATEGORY_ORDER, then others alphabetically
    categories.sort((a, b) => {
      const idxA = CORE_CATEGORY_ORDER.indexOf(a.name);
      const idxB = CORE_CATEGORY_ORDER.indexOf(b.name);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.name.localeCompare(b.name, "th");
    });

    return categories;
  }, [currentSections, answers]);

  // 🌟 ตรวจสอบข้อที่ยังไม่ได้ตอบทั้งหมดในทุกหมวด
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

  // 🌟 ฟังก์ชันเลื่อนไปยังข้อที่ยังไม่ตอบ พร้อมแสดงขอบแดงและหายไปเองหลัง 3 วินาที
  const triggerHighlightQuestion = (questionId, targetSectionIdx) => {
    if (targetSectionIdx !== undefined && targetSectionIdx !== sectionIdx) {
      setSectionIdx(targetSectionIdx);
    }
    setHighlightedQuestionId(questionId);

    setTimeout(() => {
      const el = document.getElementById(`question-card-${questionId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150);

    // 🌟 แสดงขอบแดงชั่วคราว (3 วินาที) แล้วหายไปเองโดยอัตโนมัติ
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => {
      setHighlightedQuestionId(null);
    }, 3000);
  };

  // 🌟 ตรวจสอบความถูกต้องและครบถ้วนของทุกหมวดหมู่ (Tab 1, Tab 2, Tab 3) ก่อนส่งผลตรวจ
  const validateEntireAuditForm = () => {
    // 1️⃣ ตรวจสอบ Tab 1: ข้อมูลการตรวจ (Audit Details)
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

    // 2️⃣ ตรวจสอบ Tab 2: รายการตรวจทุกหมวดหมู่ (Checklist Questions)
    const missing = checkUnansweredQuestions();
    if (missing.length > 0) {
      setActiveTab(2);
      const firstMissing = missing[0];
      triggerHighlightQuestion(firstMissing.questionId, firstMissing.sectionIdx);
      alert(`⚠️ กรุณาตอบคำถามให้ครบทุกข้อ (ยังเหลืออีก ${missing.length} ข้อที่ยังไม่ได้ตอบ ในหมวด: "${firstMissing.sectionTitle}")`);
      return false;
    }

    // 3️⃣ ตรวจสอบ Tab 3: การลงชื่อรับทราบผลตรวจ (Signatures)
    if (!auditeeSignName?.trim()) {
      setActiveTab(3);
      alert("⚠️ กรุณาระบุชื่อ-นามสกุลของผู้รับการตรวจ / ผจก.สาขา");
      return false;
    }

    if (!auditeeSignature) {
      setActiveTab(3);
      alert("⚠️ กรุณาลงลายมือชื่อผู้รับการตรวจ / ผจก.สาขา ให้เรียบร้อย");
      return false;
    }

    if (!auditorSignature) {
      setActiveTab(3);
      alert("⚠️ กรุณาลงลายมือชื่อผู้ตรวจประเมิน ให้เรียบร้อย");
      return false;
    }

    return true;
  };

  // 🛑 Final Submit Handler
  const handleFinalSubmit = async () => {
    if (!validateEntireAuditForm()) {
      setShowConfirmModal(false);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      // 📍 Capture End GPS Coordinates on Submit
      let endLat = userCoords.latitude;
      let endLng = userCoords.longitude;

      if ("geolocation" in navigator) {
        try {
          const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 3000 }));
          endLat = pos.coords.latitude;
          endLng = pos.coords.longitude;
        } catch (e) {
          // fallback to userCoords
        }
      }

      const responses = [];
      currentSections.forEach(sec => {
        (sec.items || []).forEach(q => {
          const ans = answers[q.id];
          const isNa = (ans === "na");
          let isPassed = true;
          let scoreGiven = q.fullScore || 10;

          if (isNa) {
            isPassed = true;
            scoreGiven = 0;
          } else if (q.questionType === "yesno" || q.type === "yesno" || !q.questionType) {
            isPassed = (ans === "yes" || ans === true);
            scoreGiven = isPassed ? (q.fullScore || 10) : 0;
          } else if (q.questionType === "scale" || q.type === "scale") {
            const num = Number(ans) || 5;
            isPassed = num >= 3;
            scoreGiven = (num / 5) * (q.fullScore || 10);
          }

          const rawPhotos = photos[q.id];
          const itemPhotos = Array.isArray(rawPhotos)
            ? rawPhotos
            : (rawPhotos ? [rawPhotos] : []);

          responses.push({
            surveyItemId: q.id,
            rawAnswer: String(ans !== undefined ? ans : "yes"),
            answerValue: String(ans !== undefined ? ans : "yes"),
            scaleScore: typeof ans === "number" ? ans : (!isNaN(Number(ans)) ? Number(ans) : null),
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
        : (parsedDraftPayload?.startedAt || auditStartedAt || new Date().toISOString());

      const effectiveSubmittedAt = isBackdated && backdatedEndDate
        ? new Date(backdatedEndDate).toISOString()
        : new Date().toISOString();

      const payload = {
        locationId: Number(unit.id),
        surveyFormId: Number(selectedForm?.id || 1),
        primaryAuditorId: currentUser?.id ? Number(currentUser.id) : null,
        auditeeUserId: (unit.managerUserId && Number(unit.managerUserId) > 0) ? Number(unit.managerUserId) : null,
        auditeeNameText: auditeeSignName || unit.managerName || "-",
        auditScheduleId: (preselectedPlan?.id && Number(preselectedPlan.id) > 0) ? Number(preselectedPlan.id) : null,
        staffCount: Number(staffCount) || 0,
        auditType: auditType || "announced",
        notes: extraNote || "",
        metadataValuesJson: JSON.stringify(metadataValues),
        auditorSignatureUrl: auditorSignature || null,
        auditeeSignatureUrl: auditeeSignature || null,
        signedAt: new Date().toISOString(),
        startLatitude: parsedDraftPayload?.startLatitude || userCoords.latitude || unit?.latitude,
        startLongitude: parsedDraftPayload?.startLongitude || userCoords.longitude || unit?.longitude,
        endLatitude: endLat || userCoords.latitude || unit?.latitude,
        endLongitude: endLng || userCoords.longitude || unit?.longitude,
        isBackdated: Boolean(isBackdated),
        startedAt: effectiveStartedAt,
        submittedAt: effectiveSubmittedAt,
        responses
      };

      await api.post('/audit', payload);
      try {
        localStorage.removeItem('qsc_live_audit_draft');
        if (unit?.id) localStorage.removeItem(`qsc_draft_${unit.id}_${selectedForm?.id || 1}`);
      } catch (e) { }
      if (refreshData) await refreshData();

      setShowConfirmModal(false);
      if (onCompleteAudit) onCompleteAudit();
      if (onActiveStateChange) onActiveStateChange(false);
      if (onClearPlan) onClearPlan();
      setStep("select-unit");
    } catch (err) {
      console.error("Submit audit failed:", err);
      setSubmitError(err.response?.data?.message || err.message || "เกิดข้อผิดพลาดในการบันทึกผลตรวจ");
    } finally {
      setIsSubmitting(false);
    }
  };

  const goNext = () => {
    // 🌟 หากยังไม่ใช่หมวดสุดท้าย ("หมวดถัดไป") ➔ เปลี่ยนหมวดได้อิสระ ไม่ต้องแสดงขอบแดง
    if (sectionIdx < currentSections.length - 1) {
      setSectionIdx(sectionIdx + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // 🌟 เฉพาะตอนอยู่ที่ปุ่มสุดท้าย ("ตรวจสอบและส่งผลตรวจ") ➔ จึงตรวจสอบว่าตอบครบทุกข้อหรือยัง
    const missing = checkUnansweredQuestions();
    if (missing.length > 0) {
      const firstMissing = missing[0];
      triggerHighlightQuestion(firstMissing.questionId, firstMissing.sectionIdx);
      return;
    }

    setShowConfirmModal(true); // Open Final Review & Confirmation Modal
  };

  // 🗑️ Discard Draft & Reset (ลบแบบร่างถาวรและกลับหน้าหลัก)
  const confirmDiscardDraft = async () => {
    try {
      const targetLocId = unit?.id || preselectedPlan?.locationId;
      const targetFormId = selectedForm?.id || parsedDraftPayload?.formId || preselectedPlan?.surveyFormId || 1;
      const targetAuditorId = currentUser?.id || 1;

      if (targetLocId) {
        await api.delete(`/audit/draft?locationId=${targetLocId}&surveyFormId=${targetFormId}&auditorId=${targetAuditorId}`);
      } else {
        await api.delete(`/audit/draft?auditorId=${targetAuditorId}`);
      }
      try {
        localStorage.removeItem('qsc_live_audit_draft');
        if (targetLocId) localStorage.removeItem(`qsc_draft_${targetLocId}_${targetFormId}`);
      } catch (e) { }
      if (onSaveDraft) onSaveDraft(null);
      if (refreshData) await refreshData();
    } catch (e) {
      
    }

    // เคลียร์ State ฟอร์ม
    setAnswers({});
    setPhotos({});
    setComments({});
    setSectionIdx(0);
    setIsBackdated(false);
    setBackdatedStartDate("");
    setBackdatedEndDate("");
    setSyncStatus("idle");
    setShowDiscardConfirmModal(false);

    // ล้างสาขาที่เลือกไว้และบังคับกลับไปหน้าเลือกสาขา (select-unit)
    if (setUnit) setUnit(null);
    setStep("select-unit");
  };

  const handleDiscardDraft = () => {
    setShowDiscardConfirmModal(true);
  };

  const goPrevSection = () => {
    setSectionIdx(Math.max(0, sectionIdx - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ════════════════════════════════════════════════════════════════════════════
  // STEP 1: SELECT UNIT (IN-PROGRESS FIRST + DISTANCE ASCENDING)
  // ════════════════════════════════════════════════════════════════════════════
  if (step === "select-unit") {
    const draftCount = activeDraft ? 1 : 0;

    return (
      <div className="page-transition p-4 sm:p-6 space-y-4 w-full max-w-[100%] sm:max-w-[96%] md:max-w-[92%] mx-auto pb-16">
        {/* 🌟 In-page Breadcrumb (แถบบนใช้โลโก้ปกติ ไม่สลับเป็นย้อนกลับ) */}
        <div className="space-y-1">
          <Breadcrumbs
            items={[
              { label: "ตรวจประเมินหน้างาน (Live Audit)", onClick: onClearPlan },
              { label: "เลือกสาขา" },
            ]}
          />
          <p className="text-xs text-slate-500 font-medium px-1">เลือกสาขาเพื่อเริ่มตรวจประเมินคุณภาพ</p>
        </div>

        {/* Search Box */}
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

        {/* Branch Cards List */}
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
              const isPassed = u.lastScore >= 85;

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
                  className="w-full rounded-2xl sm:rounded-3xl p-4 sm:p-5 border shadow-2xs hover:shadow-md transition-all cursor-pointer flex items-center justify-between gap-3 text-left group active:scale-98 bg-white border-slate-200 hover:border-emerald-500"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border transition-colors bg-emerald-50 text-[#0F6659] border-emerald-200 group-hover:bg-[#0F6659] group-hover:text-white">
                      <Store size={24} />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-[15px] sm:text-[16px] font-bold text-slate-900 leading-snug group-hover:text-[#0F6659] transition-colors">
                          {u.fullName || u.name}
                        </h3>
                      </div>

                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {/* Brand badges */}
                        {(() => {
                          const brands = (u.locationBrands || [])
                            .map(lb => lb.brand?.name || lb.brandName)
                            .filter(Boolean);
                          if (brands.length === 0 && (u.brand?.name || u.brandName)) {
                            brands.push(u.brand?.name || u.brandName);
                          }
                          if (brands.length === 0) return null;
                          return (
                            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-xl bg-teal-50 text-teal-800 border border-teal-200/80">
                              🏷️ {brands.join(", ")}
                            </span>
                          );
                        })()}

                        <span className="text-xs font-medium px-2.5 py-0.5 rounded-xl bg-slate-100 text-slate-700">
                          {((u.locationType?.code === 'Office' || u.locationType === 'Office') ? '🏢 สำนักงาน' : (u.locationType?.code === 'Plant' || u.locationType === 'Plant') ? '🏭 โรงงาน' : '🏪 สาขา')} · {u.region}
                        </span>
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-xl bg-emerald-100 text-emerald-800 flex items-center gap-1">
                          <Navigation size={11} /> {distLabel}
                        </span>
                        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-xl ${isPassed ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
                          คะแนนล่าสุด {u.lastScore}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <ChevronRight size={20} className="text-slate-400 group-hover:text-emerald-700 group-hover:translate-x-1 transition-all" />
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

                {/* 🌟 กล่องกรอกตัวเลขหน้า */}
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

    return (
      <div className="page-transition p-4 sm:p-6 space-y-4 w-full max-w-[100%] sm:max-w-[96%] md:max-w-[92%] mx-auto">
        {/* 🌟 In-page Breadcrumb */}
        <div className="space-y-1">
          <Breadcrumbs
            items={[
              { label: "ตรวจประเมินหน้างาน (Live Audit)", onClick: onClearPlan },
              { label: `เลือกสาขา (${unit?.name || 'สาขา'})`, onClick: () => setStep("select-unit") },
              { label: "เลือกฟอร์ม" },
            ]}
          />
          <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
            <p className="text-xs text-slate-500 font-medium">
              แบบฟอร์มที่เปิดให้ใช้งานสำหรับสาขา <strong className="text-slate-800">{unit?.fullName || unit?.name}</strong>
              <span className="text-slate-400 font-normal"> ({unitTypeName}{unitBrands ? ` · แบรนด์ ${unitBrands}` : ''})</span>
            </p>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-emerald-50 text-[#0F6659] border border-emerald-200">
              พบ {applicableForms.length} แบบฟอร์ม
            </span>
          </div>
        </div>

        {applicableForms.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 sm:p-10 border border-slate-200 text-center shadow-xs space-y-4 my-4">
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
                className={`rounded-3xl p-5 text-left border shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-4 group active:scale-98 ${selectedForm?.id === f.id ? 'border-[#0F6659] bg-emerald-50/40 ring-2 ring-emerald-500/30' : 'bg-white border-slate-200 hover:border-emerald-400'
                  }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-extrabold px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700">
                      เกณฑ์ผ่าน {f.passingScore || 85}%
                    </span>
                    <span className="text-xs font-bold text-slate-400">
                      {(f.sections || []).length} หมวดการตรวจ
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
    const handleProceedToSection = () => {
      // Validate all required metadata fields
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

    return (
      <div className="page-transition w-full min-h-screen bg-slate-50/50 pb-20">
        {/* Top Summary & Live Score Card */}
        <div className="pt-2.5 pb-2 px-3 sm:px-4">
          <div className="bg-white rounded-3xl p-3.5 sm:p-4 border border-slate-200 shadow-2xs flex items-center justify-between gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
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
                  <span className="text-sm sm:text-base font-black text-slate-800 leading-none">{scoreAnalysis.percentage}%</span>
                </div>
              </div>
              <span className={`text-[9px] sm:text-[10px] font-extrabold mt-1.5 ${scoreAnalysis.isPassed ? 'text-emerald-600' : 'text-amber-600'}`}>
                {scoreAnalysis.isPassed ? "ผ่านเกณฑ์มาตรฐาน" : "กำลังประเมิน"}
              </span>
              <span className="text-[9px] text-slate-400 font-medium">เกณฑ์ ≥ {passingScore}%</span>
            </div>
          </div>
        </div>

        {/* 📊 Category Scores Breakdown Card (แสดงคะแนนแยกตามหมวดหมู่คะแนน) */}
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
                  {/*<span className="text-[10px] font-bold text-slate-400">
                    เกณฑ์ผ่าน ≥ {passingScore}%
                  </span>*/}
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
                        <div className="w-28 sm:w-32 shrink-0 truncate text-xs font-bold text-slate-700" title={cat.name}>
                          {cat.name}
                        </div>

                        {/* Progress Bar [█████████] */}
                        <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ease-out ${barColor}`}
                            style={{ width: `${Math.min(100, Math.max(0, cat.percentage))}%` }}
                          />
                        </div>

                        {/* Percentage (e.g. 91%) */}
                        <div className="w-10 text-right shrink-0">
                          <span className={`font-mono font-black text-xs ${textColor}`}>
                            {cat.percentage}%
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

        {/* Navigation Tabs */}
        <div className="px-4 mb-4 mt-2">
          <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-2xs">
            {[
              { id: 1, label: "ข้อมูลการตรวจ", icon: <ClipboardList size={14} /> },
              { id: 2, label: "รายการตรวจ", icon: <CheckCheck size={14} /> },
              { id: 3, label: "ลงชื่อ&ส่งผล", icon: <PenTool size={14} /> }
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
              {/*<h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 mb-3">ข้อมูลการตรวจ (Audit Details)</h3>*/}

              {activeMetadataFields.map((field) => {
                // System field: Auditor
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
                          className="w-full text-xs sm:text-sm pl-4 pr-10 py-3 min-h-[50px] rounded-2xl bg-slate-50 border border-slate-200 outline-none font-semibold text-slate-700 focus:border-[#0F6659] focus:bg-white transition-all shadow-xs cursor-pointer appearance-none truncate"
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

                // System field: Audit Type
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

                // System field: Staff Count
                if (field.id === "staff_count") {
                  return (
                    <div key={field.id} className="w-full">
                      <label className="text-xs font-extrabold text-slate-700 block mb-1.5">
                        {field.label} {field.required && <span className="text-rose-500">*</span>}
                      </label>
                      <div className="relative flex items-center w-full">
                        <input
                          type="number"
                          min="0"
                          value={staffCount}
                          onChange={(e) => {
                            const val = e.target.value;
                            setStaffCount(val);
                            performSaveDraft({ staffCount: val });
                          }}
                          className="w-full text-xs sm:text-sm py-2.5 px-3 pr-14 rounded-xl border border-slate-200 outline-none font-bold bg-white text-slate-800 focus:border-[#0F6659] shadow-2xs"
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

                // Number field with custom unit
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
                          className="w-full text-xs sm:text-sm py-2.5 px-3 pr-14 rounded-xl border border-slate-200 outline-none font-bold bg-white focus:border-[#0F6659] shadow-2xs"
                        />
                        {field.unit && (
                          <div className="absolute right-2.5 px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 select-none">
                            {field.unit}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                // Date Picker field
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
                          className="w-full text-sm py-3 px-3.5 pr-10 rounded-2xl border border-slate-200 outline-none font-bold bg-white focus:border-[#0F6659] shadow-2xs text-slate-800 min-h-[48px] cursor-pointer"
                        />
                        <Calendar size={18} className="absolute right-3.5 text-[#0F6659] pointer-events-none shrink-0" />
                        {!currentVal && (
                          <div className="absolute inset-0 left-3.5 flex items-center pointer-events-none text-slate-400 text-sm font-medium">
                            วว/ดด/ปปปป
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                // Time Picker field
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
                          className="w-full text-sm py-3 px-3.5 pr-10 rounded-2xl border border-slate-200 outline-none font-bold bg-white focus:border-[#0F6659] shadow-2xs text-slate-800 min-h-[48px] cursor-pointer"
                        />
                        <Clock size={18} className="absolute right-3.5 text-[#0F6659] pointer-events-none shrink-0" />
                        {!currentVal && (
                          <div className="absolute inset-0 left-3.5 flex items-center pointer-events-none text-slate-400 text-sm font-medium">
                            --:--
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                // Select / Choice Badges field
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
                            className="w-full text-xs sm:text-sm pl-4 pr-10 py-3 min-h-[50px] rounded-2xl bg-slate-50 border border-slate-200 outline-none font-semibold text-slate-700 focus:border-[#0F6659] focus:bg-white transition-all shadow-xs cursor-pointer appearance-none truncate"
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

                // Toggle Switch field
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

                // Text / Note field (Unified text & multi-line note)
                return (
                  <div key={field.id}>
                    <label className="text-xs font-extrabold text-slate-700 block mb-1.5">
                      {field.label} {field.required && <span className="text-rose-500">*</span>}
                    </label>
                    <textarea
                      rows={2}
                      value={currentVal || ""}
                      onChange={(e) => setMetadataValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                      placeholder={field.placeholder || "กรอกข้อความหรือหมายเหตุ..."}
                      className="w-full text-sm p-3.5 rounded-xl border border-slate-200 outline-none font-medium bg-white focus:border-[#0F6659] shadow-2xs resize-y min-h-[46px]"
                    />
                  </div>
                );
              })}

              {/* Backdated Audit Toggle Card */}
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
                          className="w-full text-xs sm:text-sm py-2.5 px-3.5 pr-10 rounded-xl border border-slate-200 outline-none font-semibold text-slate-800 focus:border-[#0F6659] shadow-2xs min-h-[44px] cursor-pointer"
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
                          className="w-full text-xs sm:text-sm py-2.5 px-3.5 pr-10 rounded-xl border border-slate-200 outline-none font-semibold text-slate-800 focus:border-[#0F6659] shadow-2xs min-h-[44px] cursor-pointer"
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
            <div className="space-y-6 animate-in fade-in duration-200">
              {currentSections.map((sec, sIdx) => (
                <div key={sec.id || sIdx} className="space-y-3">
                  <div className="sticky top-44 z-30 flex items-center justify-between gap-2 bg-slate-50/95 backdrop-blur-sm py-2 px-1 rounded-xl">
                    <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-[#0F6659] text-white flex items-center justify-center text-xs">{sIdx + 1}</span>
                      {sec.title}
                    </h3>
                    <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-2xs">
                      {sec.items?.filter(item => answers[item.id] !== undefined && answers[item.id] !== "").length}/{sec.items?.length || 0} ตอบแล้ว
                    </span>
                  </div>

                  <div className="space-y-4">
                    {(sec.items || []).map((q, idx) => {
                      const isHighlighted = highlightedQuestionId === q.id;
                      const isNa = answers[q.id] === "na";
                      const isFailed = !isNa && (answers[q.id] === "no" || answers[q.id] === false || (Number(answers[q.id]) < 3 && answers[q.id] !== undefined && answers[q.id] !== ""));
                      const rawP = photos[q.id];
                      const questionPhotos = Array.isArray(rawP) ? rawP : (rawP ? [rawP] : []);
                      const hasPhoto = questionPhotos.length > 0;
                      const qType = (q.questionType || q.type || "YESNO").toString().toLowerCase();
                      const isScale = qType === "scale" || qType === "rating";
                      const isCommentOpen = Boolean(openComments[q.id] || (comments[q.id] && comments[q.id].trim().length > 0));
                      const scoreGiven = isNa ? 0 : (isScale ? (Number(answers[q.id]) || 0) / 5 * (q.fullScore || 10) : ((answers[q.id] === "yes" || answers[q.id] === true) ? (q.fullScore || 10) : 0));
                      const isAnswered = answers[q.id] !== undefined && answers[q.id] !== "";

                      return (
                        <div
                          key={q.id || idx}
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
                                {getQuestionCategory(q, sec)}
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
                                  onClick={() => setOpenComments(prev => ({ ...prev, [q.id]: !isCommentOpen }))}
                                  className={`w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer transition-all border ${(comments[q.id] && comments[q.id].trim().length > 0)
                                      ? 'bg-amber-50 text-amber-700 border-amber-300'
                                      : isCommentOpen
                                        ? 'bg-slate-200 text-slate-800 border-slate-300'
                                        : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                                    }`}
                                >
                                  <MessageSquare size={16} className={(comments[q.id] && comments[q.id].trim().length > 0) ? "fill-amber-400/40" : ""} />
                                </button>
                                <label
                                  className={`h-9 px-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all border ${hasPhoto ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                                    }`}
                                  title="แนบรูปถ่าย (ถ่ายภาพ หรือ เลือกรูปจากคลังภาพในเครื่อง)"
                                >
                                  <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    className="hidden"
                                    onChange={(e) => {
                                      handlePhotoUpload(q.id, e.target.files);
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
                            <h4 className={`w-full text-sm sm:text-base font-semibold leading-snug ${isNa ? "text-slate-400 line-through" : "text-slate-800"}`}>
                              {q.questionText || q.text}
                            </h4>
                          </div>

                          {/* 📸 Horizontal Photo Gallery */}
                          {hasPhoto && (
                            <div className="flex items-center gap-2 overflow-x-auto py-1 mb-3 custom-tab-scrollbar">
                              {questionPhotos.map((imgUrl, imgIdx) => (
                                <div key={imgIdx} className="relative shrink-0 rounded-xl overflow-hidden border border-slate-200 shadow-2xs group">
                                  <img src={imgUrl} alt={`Evidence ${imgIdx + 1}`} className="h-20 w-28 object-cover" />
                                  <button
                                    type="button"
                                    onClick={() => handlePhotoDelete(q.id, imgIdx)}
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
                              {/* Add More Photos Quick Button inside gallery */}
                              <label className="h-20 w-20 shrink-0 rounded-xl border-2 border-dashed border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/50 flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-emerald-700 cursor-pointer transition-all">
                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  className="hidden"
                                  onChange={(e) => {
                                    handlePhotoUpload(q.id, e.target.files);
                                    e.target.value = '';
                                  }}
                                />
                                <Plus size={18} />
                                <span className="text-[10px] font-bold">เพิ่มรูป</span>
                              </label>
                            </div>
                          )}

                          {!isScale && (
                            <div className="grid grid-cols-3 gap-2">
                              <button type="button" onClick={() => handleAnswerSelect(q.id, "yes")} className={`py-3 rounded-2xl text-[11px] sm:text-xs font-bold border cursor-pointer transition-all flex flex-col items-center justify-center gap-1 ${answers[q.id] === "yes" || answers[q.id] === true ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-600/30' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}>
                                <CheckCircle2 size={18} /><span>ผ่าน</span>
                              </button>
                              <button type="button" onClick={() => handleAnswerSelect(q.id, "no")} className={`py-3 rounded-2xl text-[11px] sm:text-xs font-bold border cursor-pointer transition-all flex flex-col items-center justify-center gap-1 ${answers[q.id] === "no" || answers[q.id] === false ? 'bg-rose-600 text-white border-rose-600 shadow-md ring-2 ring-rose-600/30' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}>
                                <XCircle size={18} /><span>ไม่ผ่าน</span>
                              </button>
                              <button type="button" onClick={() => handleAnswerSelect(q.id, "na")} className={`py-3 rounded-2xl text-[11px] sm:text-xs font-bold border cursor-pointer transition-all flex flex-col items-center justify-center gap-1 ${answers[q.id] === "na" ? 'bg-slate-700 text-white border-slate-700 shadow-md ring-2 ring-slate-700/30' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}>
                                <Minus size={18} /><span>ข้าม</span>
                              </button>
                            </div>
                          )}

                          {isScale && (
                            <div className="flex gap-1.5 items-center">
                              {[1, 2, 3, 4, 5].map((n) => (
                                <button key={n} type="button" onClick={() => handleAnswerSelect(q.id, n)} className={`flex-1 py-2.5 rounded-xl text-sm font-black cursor-pointer transition-all border ${answers[q.id] === n ? 'bg-[#0F6659] text-white border-[#0F6659] shadow-md ring-2 ring-[#0F6659]/30' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}>
                                  {n}
                                </button>
                              ))}
                              <button type="button" onClick={() => handleAnswerSelect(q.id, "na")} className={`px-2.5 py-2.5 rounded-xl flex items-center justify-center text-[10px] font-black cursor-pointer transition-all border ${answers[q.id] === "na" ? 'bg-slate-700 text-white border-slate-700 shadow-md' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                                <Minus size={14} className="mr-0.5" /> N/A
                              </button>
                            </div>
                          )}

                          {isCommentOpen && (
                            <div className="mt-3">
                              <QuestionCommentInput initialValue={comments[q.id]} onChange={(val) => handleCommentChange(q.id, val)} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="pt-4">
                <button type="button" onClick={() => setActiveTab(3)} className="w-full py-4 rounded-2xl text-sm font-extrabold bg-[#0F6659] text-white shadow-md active:scale-95 flex items-center justify-center gap-2">
                  ไปที่การลงชื่อและส่งผล <ChevronRight size={16} />
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
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-5">
                {/*<h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">การลงชื่อรับทราบผลตรวจ (Signatures)</h3>*/}

                <SignaturePad
                  label={`1. ผู้รับการตรวจ / ผจก.สาขา (${unit?.fullName || unit?.name})`}
                  signatoryName={auditeeSignName}
                  //onNameChange={setAuditeeSignName}
                  onSignChange={setAuditeeSignature}
                  signatureUrl={auditeeSignature}
                  //placeholderName="ระบุชื่อ-นามสกุล..."
                />

                <SignaturePad
                  label={`2. ผู้ตรวจประเมิน (${auditorName || defaultAuditorName})`}
                  onSignChange={setAuditorSignature}
                  signatureUrl={auditorSignature}
                />
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-slate-800">สรุปคะแนนประเมิน</h3>
                  <span className={`text-xs font-black px-2.5 py-1 rounded-xl ${scoreAnalysis.isPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                    {scoreAnalysis.percentage}%
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
                  {scoreAnalysis.percentage}%
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
                <button onClick={() => setShowDiscardConfirmModal(false)} className="py-3 px-4 rounded-2xl bg-slate-100 text-slate-700 font-bold text-xs">ย้อนกลับ</button>
                <button onClick={confirmDiscardDraft} className="py-3 px-4 rounded-2xl bg-rose-600 text-white font-bold text-xs shadow-md">ยืนยันลบ</button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  }

  return null;
}