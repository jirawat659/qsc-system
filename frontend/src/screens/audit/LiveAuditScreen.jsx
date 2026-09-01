import React, { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  PenTool, RotateCcw, Edit3, AlertCircle, ChevronDown, Store,
  MapPin, Navigation, Search, Sparkles, ChevronRight, CheckCircle2,
  XCircle, Minus, Camera, MessageSquare, Plus, Trash2, Clock,
  ClipboardList, Check, Loader2, Save, ShieldAlert, CheckCheck,
  RefreshCw, AlertTriangle, X
} from "lucide-react";

import { c, sans, mono, cardStyle } from "../../config/theme";
import { TopBarContext } from "../../context/TopBarContext";
import { DataContext } from "../../context/DataContext";
import { getDistanceInMeters, formatDistance, DEFAULT_USER_COORDS } from "../../utils/geo";
import api from "../../config/api";

import ModalWrapper from "../../shared/ModalWrapper";
import Header from "../../shared/Header";
import Section from "../../shared/Section";
import ScoreRing from "../../shared/ScoreRing";
import ErrorBoundary from "../../shared/ErrorBoundary";
import { compressImageFile } from "../../utils/imageCompressor";

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
      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none text-slate-800 focus:border-[#0F6659] bg-slate-50/80 ios-zoom-fix-xs"
    />
  );
};

// ✍️ Touch & Mouse High-DPI Digital Signature Pad
function SignaturePad({ label, signatoryName, onNameChange, onSignChange, placeholderName = "ระบุชื่อผู้ลงนาม..." }) {
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
    if (isDrawing) {
      setIsDrawing(false);
      const canvas = canvasRef.current;
      if (canvas) {
        onSignChange(canvas.toDataURL('image/png'));
      }
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    setHasSigned(false);
    onSignChange(null);
  };

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
            onClick={clearCanvas}
            className="text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw size={11} />
            <span>ล้างลายเซ็น</span>
          </button>
        )}
      </div>

      <div className="relative border-2 border-dashed border-slate-300 rounded-2xl bg-white overflow-hidden touch-none hover:border-[#0F6659]/50 transition-colors shadow-2xs">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full h-24 sm:h-28 cursor-crosshair block"
        />
        {!hasSigned && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400 text-xs font-medium gap-1.5 select-none">
            <Edit3 size={14} />
            <span>แตะหรือลากเพื่อเซ็นชื่อลงในกรอบนี้</span>
          </div>
        )}
      </div>

      {onNameChange && (
        <input
          type="text"
          value={signatoryName || ''}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={placeholderName}
          className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white font-semibold text-slate-800 outline-none focus:border-[#0F6659] shadow-2xs ios-zoom-fix-xs"
        />
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
  onActiveStateChange
}) {
  const { currentUser: ctxUser, locations, forms, activeDraft, activeDrafts, refreshData } = React.useContext(DataContext);
  const currentUser = propUser || ctxUser;
  const formList = forms || [];

  const targetLocationId = preselectedPlan?.locationId || (preselectedPlan?.locationName ? locations.find(l => l.name === preselectedPlan.locationName || l.fullName === preselectedPlan.locationName)?.id : null);
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
  }, [preselectedPlan, targetLocationId, targetFormId, activeDrafts, activeDraft, locations]);

  // Parse draft payload ONLY if it matched THIS branch
  const parsedDraftPayload = useMemo(() => {
    if (!matchedDraftRecord) return null;

    if (matchedDraftRecord.draftPayloadJson) {
      try {
        return typeof matchedDraftRecord.draftPayloadJson === 'string'
          ? JSON.parse(matchedDraftRecord.draftPayloadJson)
          : matchedDraftRecord.draftPayloadJson;
      } catch (e) {}
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
      } catch (e) {}
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

  // Step flow: select-unit -> select-form -> audit
  // 🌟 หากเป็นการเปิดฉบับร่างค้างตรวจ หรือตามแผนงาน ให้ข้ามไปหน้า 'audit' ทันที!
  const [step, setStep] = useState(() => {
    if (isResumeDraft || isFromAssignedPlan) return "audit";
    return "select-unit";
  });
  const [activeTab, setActiveTab] = useState(1);

  const [searchBranch, setSearchBranch] = useState("");
  const [userCoords, setUserCoords] = useState(DEFAULT_USER_COORDS);

  const [unit, setUnit] = useState(() => {
    if (isResumeDraft && parsedDraftPayload?.unit) return parsedDraftPayload.unit;
    if (isFromAssignedPlan || isResumeDraft) {
      const locId = preselectedPlan?.locationId || targetLocationId;
      const locName = preselectedPlan?.locationName || preselectedPlan?.unit;
      return locations.find(u => 
        (locId && u.id === locId) || 
        (locName && (u.name === locName || u.fullName === locName || (u.fullName && u.fullName.includes(locName))))
      ) || locations[0];
    }
    return null;
  });

  const [selectedForm, setSelectedForm] = useState(() => {
    const targetFId = (isResumeDraft && parsedDraftPayload?.formId) ? parsedDraftPayload.formId : (preselectedPlan?.surveyFormId || targetFormId);
    if (targetFId) {
      return formList.find(f => f.id === targetFId) || formList[0];
    }
    return formList[0];
  });

  const [sectionIdx, setSectionIdx] = useState(isResumeDraft ? (parsedDraftPayload?.sectionIdx || 0) : 0);
  const [answers, setAnswers] = useState(isResumeDraft ? (parsedDraftPayload?.answers || {}) : {});
  const [photos, setPhotos] = useState(isResumeDraft ? (parsedDraftPayload?.photos || {}) : {});
  const [comments, setComments] = useState(isResumeDraft ? (parsedDraftPayload?.comments || {}) : {});
  const [openComments, setOpenComments] = useState({});
  const [openNoteId, setOpenNoteId] = useState(null);
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
      } catch (e) {}
    }

    if (!fields || fields.length === 0) {
      fields = [
        { id: "auditor", label: "ผู้ตรวจประเมิน (Auditor)", type: "auditor", required: true, enabled: true, isSystem: true },
        { id: "audit_type", label: "ประเภทการตรวจ (Audit Type)", type: "select", options: ["ตามกำหนดการ", "นอกกำหนดการ (Spot)", "ปลอมตัว"], required: true, enabled: true, isSystem: true },
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
      .catch(err => console.warn('Could not load users for LiveAuditScreen:', err));
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
  const [detailsErrors, setDetailsErrors] = useState({});

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

  // 📍 Request real device GPS on mount
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (pos?.coords) {
            setUserCoords({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude
            });
          }
        },
        () => {
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
  }, []);

  // 📍 Automatic Draft Hydration Effect (Runs ONCE when draft data arrives for this specific branch)
  const hasHydratedDraftRef = useRef(false);
  useEffect(() => {
    if (parsedDraftPayload && !hasHydratedDraftRef.current && isResumeDraft) {
      hasHydratedDraftRef.current = true;
      if (parsedDraftPayload.answers && Object.keys(parsedDraftPayload.answers).length > 0) {
        setAnswers(parsedDraftPayload.answers);
      }
      if (parsedDraftPayload.photos && Object.keys(parsedDraftPayload.photos).length > 0) {
        setPhotos(parsedDraftPayload.photos);
      }
      if (parsedDraftPayload.comments && Object.keys(parsedDraftPayload.comments).length > 0) {
        setComments(parsedDraftPayload.comments);
      }
      if (parsedDraftPayload.staffCount) {
        setStaffCount(parsedDraftPayload.staffCount);
      }
      if (parsedDraftPayload.auditorName) {
        setAuditorName(parsedDraftPayload.auditorName);
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

  // 📍 GPS location tracking on mount
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserCoords({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          });
        },
        (err) => console.log("Using default BKK coords:", err.message),
        { enableHighAccuracy: false, timeout: 5000 }
      );
    }
  }, []);

  // Inform parent whether an active live audit is happening
  useEffect(() => {
    const isActivelyAuditing = step === "audit";
    if (onActiveStateChange) {
      onActiveStateChange(isActivelyAuditing);
    }
    return () => {
      if (onActiveStateChange) onActiveStateChange(false);
    };
  }, [step, onActiveStateChange]);

  // ⚡ Instant Event-driven Auto-Sync to Backend & LocalStorage
  const autoSaveTimerRef = useRef(null);
  const hasUserAnswers = useMemo(() => {
    return Object.keys(answers).length > 0 || Object.keys(photos).length > 0 || Object.keys(comments).length > 0;
  }, [answers, photos, comments]);

  const performSaveDraft = async (overrideData = {}) => {
    try {
      setSyncStatus("saving");
      const currentAnswers = overrideData.answers !== undefined ? overrideData.answers : answers;
      const currentPhotos = overrideData.photos !== undefined ? overrideData.photos : photos;
      const currentComments = overrideData.comments !== undefined ? overrideData.comments : comments;
      const currentSectionIdx = overrideData.sectionIdx !== undefined ? overrideData.sectionIdx : sectionIdx;
      const currentUnit = overrideData.unit || unit;
      const currentForm = overrideData.selectedForm || selectedForm;
      const currentStaffCount = overrideData.staffCount || staffCount;
      const currentAuditorName = overrideData.auditorName || auditorName;
      const currentAuditType = overrideData.auditType || auditType;
      const currentExtraNote = overrideData.extraNote || extraNote;

      if (!currentUnit?.id || !currentForm?.id) {
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
        metadataValues: metadataValues,
        startedAt: parsedDraftPayload?.startedAt || new Date().toISOString()
      };

      const totalAnswered = Object.keys(currentAnswers).length;
      const totalQuestions = (currentForm?.sections || []).reduce(
        (acc, sec) => acc + (sec.items?.length || 0), 0
      );

      const draftPayloadJson = JSON.stringify(payload);

      // 1. Instant localStorage cache specifically scoped to THIS location & form
      try {
        localStorage.setItem(`qsc_draft_${currentUnit.id}_${currentForm.id}`, draftPayloadJson);
      } catch (e) {}

      // 2. Persist to SQLite Backend
      await api.put('/audit/draft', {
        locationId: currentUnit.id,
        surveyFormId: currentForm.id,
        auditorId: currentUser?.id || 1,
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
        metadataValues: metadataValues,
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
      console.warn("Auto-sync draft error:", err);
      setSyncStatus("error");
    }
  };

  useEffect(() => {
    if (!unit || step === "select-unit") return;

    // 🛑 หากยังไม่มีการตอบคำถามข้อใดเลย ให้ซ่อนสถานะและไม่ต้อง Auto-sync
    if (!hasUserAnswers) {
      setSyncStatus("idle");
      return;
    }

    setSyncStatus("saving");
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

    autoSaveTimerRef.current = setTimeout(() => {
      performSaveDraft();
    }, 600);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [unit, selectedForm, sectionIdx, answers, photos, comments, staffCount, auditorName, auditType, extraNote, metadataValues, step, hasUserAnswers, currentUser]);

  const currentSections = selectedForm?.sections || [];
  const passingScore = selectedForm?.passingScore || 85;

  // 🌟 SORTING HIERARCHY: จัดเรียงตามระยะทาง GPS จากน้อยไปมาก สำหรับการตรวจงานใหม่
  const sortedBranchList = useMemo(() => {
    let list = [...(locations || [])];

    if (currentUser?.branchScope === "SPECIFIC" && Array.isArray(currentUser.allowedLocationIds) && currentUser.allowedLocationIds.length > 0) {
      list = list.filter(u => currentUser.allowedLocationIds.includes(u.id));
    }

    if (searchBranch.trim()) {
      const q = searchBranch.toLowerCase();
      list = list.filter(u =>
        u.name?.toLowerCase().includes(q) ||
        (u.fullName && u.fullName.toLowerCase().includes(q)) ||
        u.region?.toLowerCase().includes(q) ||
        (u.address && u.address.toLowerCase().includes(q))
      );
    }

    // Sort by GPS distance ascending (น้อย ➔ มาก)
    return list.sort((a, b) => {
      const distA = getDistanceInMeters(userCoords.latitude, userCoords.longitude, a.latitude, a.longitude);
      const distB = getDistanceInMeters(userCoords.latitude, userCoords.longitude, b.latitude, b.longitude);
      return distA - distB;
    });
  }, [locations, searchBranch, userCoords, currentUser]);

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

  // 🛑 Final Submit Handler
  const handleFinalSubmit = async () => {
    const missing = checkUnansweredQuestions();
    if (missing.length > 0) {
      setShowConfirmModal(false);
      const firstMissing = missing[0];
      triggerHighlightQuestion(firstMissing.questionId, firstMissing.sectionIdx);
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
        startedAt: parsedDraftPayload?.startedAt || auditStartedAt || new Date().toISOString(),
        responses
      };

      await api.post('/audit', payload);
      try {
        localStorage.removeItem('qsc_live_audit_draft');
        if (unit?.id) localStorage.removeItem(`qsc_draft_${unit.id}_${selectedForm?.id || 1}`);
      } catch (e) {}
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
      } catch (e) {}
      if (onSaveDraft) onSaveDraft(null);
      if (refreshData) await refreshData();
    } catch (e) {
      console.warn("Discard draft warning:", e);
    }
    setAnswers({});
    setPhotos({});
    setComments({});
    setSectionIdx(0);
    setSyncStatus("idle");
    setShowDiscardConfirmModal(false);
    if (onClearPlan) {
      onClearPlan();
    } else {
      setStep("select-unit");
    }
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
        <Header
          title="ตรวจประเมินหน้างาน (Live Audit)"
          subtitle="เลือกสาขาเพื่อเริ่มตรวจประเมินคุณภาพ"
          onBack={onClearPlan}
        />

        {/* Search Box */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาชื่อสาขา, โรงงาน หรือสำนักงาน..."
            value={searchBranch}
            onChange={(e) => setSearchBranch(e.target.value)}
            className="w-full text-xs sm:text-sm pl-8.5 pr-8 py-2 rounded-xl bg-white border border-slate-200 shadow-2xs outline-none font-medium text-slate-800 focus:border-[#0F6659] transition-colors placeholder:text-slate-400 placeholder:font-normal ios-zoom-fix-sm"
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
        <div className="flex flex-col gap-3">
          {sortedBranchList.map((u) => {
            const distMeters = getDistanceInMeters(userCoords.latitude, userCoords.longitude, u.latitude, u.longitude);
            const distLabel = formatDistance(distMeters);
            const isPassed = u.lastScore >= 85;

            return (
              <button
                key={u.id || u.name}
                type="button"
                onClick={() => {
                  setUnit(u);
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
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug group-hover:text-[#0F6659] transition-colors">
                        {u.fullName || u.name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
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
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // STEP 2: SELECT FORM
  // ════════════════════════════════════════════════════════════════════════════
  if (step === "select-form") {
    return (
      <div className="page-transition p-4 sm:p-6 space-y-4 w-full max-w-[100%] sm:max-w-[96%] md:max-w-[92%] mx-auto">
        <Header
          title="ตรวจประเมินหน้างาน (Live Audit)"
          subtitle="เลือกฟอร์มเพื่อเริ่มตรวจประเมินคุณภาพ"
          onBack={() => setStep("select-unit")}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {formList.map((f) => (
            <button
              key={f.id || f.title}
              type="button"
              onClick={() => { setSelectedForm(f); setStep("audit"); setActiveTab(1); }}
              className={`rounded-3xl p-5 text-left border shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-4 group active:scale-98 ${
                selectedForm?.id === f.id ? 'border-[#0F6659] bg-emerald-50/40 ring-2 ring-emerald-500/30' : 'bg-white border-slate-200 hover:border-emerald-400'
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
                <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-[#0F6659] transition-colors">
                  {f.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 mt-1 line-clamp-2">
                  {f.description}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-xs font-extrabold text-[#0F6659]">เลือกแบบฟอร์มนี้</span>
                <ChevronRight size={16} className="text-[#0F6659] group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          ))}
        </div>
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

    const handleFinalSubmitTab3 = async () => {
      const missing = checkUnansweredQuestions();
      if (missing.length > 0) {
        setActiveTab(2);
        const firstMissing = missing[0];
        triggerHighlightQuestion(firstMissing.questionId, firstMissing.sectionIdx);
        return;
      }
      setShowConfirmModal(true);
    };

    return (
      <div className="page-transition w-full min-h-screen bg-slate-50/50 pb-20">
        {/* Sticky Top Header Card */}
        <div className="sticky top-0 z-40 bg-slate-50/95 backdrop-blur-md pt-2 pb-3 px-4 shadow-sm border-b border-slate-200">
          <div className="flex items-center justify-between gap-2 mb-2">
            <button type="button" onClick={() => setStep("select-form")} className="p-1.5 rounded-full hover:bg-slate-200 text-slate-600 transition-colors">
              <ChevronDown className="rotate-90" size={20} />
            </button>
            
            <div className="flex items-center gap-1.5">
              {syncStatus === "saving" ? (
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-700 animate-pulse">
                  <Loader2 size={12} className="animate-spin" />
                  <span>Syncing...</span>
                </div>
              ) : syncStatus === "error" ? (
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-[11px] font-bold text-rose-700">
                  <AlertCircle size={12} />
                  <span>Sync Failed</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-700">
                  <CheckCircle2 size={12} />
                  <span>Synced</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-sm flex items-center justify-between gap-4">
            <div className="flex-1">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">{unit?.fullName || unit?.name}</h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">{selectedForm?.title}</p>
              <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                <span className="text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 flex items-center gap-1">
                  <PenTool size={11} /> {auditorName || "ระบุผู้ตรวจ"}
                </span>
                <span className="text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 flex items-center gap-1">
                  <Clock size={11} /> เริ่ม {new Date(auditStartedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
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
              <span className="text-[9px] text-slate-400 font-medium">เกณฑ์ ≥{passingScore}%</span>
            </div>
          </div>
        </div>

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
                className={`flex-1 py-2 text-[11px] sm:text-xs font-extrabold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === tab.id
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
              <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 mb-3">ข้อมูลการตรวจ (Audit Details)</h3>
              
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
                          onChange={(e) => setAuditorName(e.target.value)}
                          className="w-full text-sm p-3.5 rounded-xl border border-slate-200 outline-none font-bold bg-white focus:border-[#0F6659] shadow-2xs appearance-none pr-10 ios-zoom-fix-sm"
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
                    : ["ตามกำหนดการ", "นอกกำหนดการ (Spot)", "ปลอมตัว"];
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
                              onClick={() => setAuditType(key)}
                              className={`py-2.5 px-1 rounded-xl text-[10px] sm:text-xs font-bold border transition-all cursor-pointer ${
                                isSelected
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
                    <div key={field.id}>
                      <label className="text-xs font-extrabold text-slate-700 block mb-1.5">
                        {field.label} {field.required && <span className="text-rose-500">*</span>}
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type="number"
                          min="0"
                          value={staffCount}
                          onChange={(e) => setStaffCount(e.target.value)}
                          className="w-full text-sm p-3.5 pr-14 rounded-xl border border-slate-200 outline-none font-bold bg-white focus:border-[#0F6659] shadow-2xs ios-zoom-fix-sm"
                          placeholder={field.placeholder || "ระบุจำนวน (คน)"}
                        />
                        <div className="absolute right-3 px-2 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-bold text-slate-600 select-none">
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
                          onChange={(e) => setMetadataValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                          placeholder={field.placeholder || `ระบุตัวเลข${field.unit ? ` (${field.unit})` : ''}`}
                          className="w-full text-sm p-3.5 pr-14 rounded-xl border border-slate-200 outline-none font-bold bg-white focus:border-[#0F6659] shadow-2xs ios-zoom-fix-sm"
                        />
                        {field.unit && (
                          <div className="absolute right-3 px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 select-none">
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
                      <label className="text-xs font-extrabold text-slate-700 block mb-1.5">
                        {field.label} {field.required && <span className="text-rose-500">*</span>}
                      </label>
                      <input
                        type="date"
                        value={currentVal || ""}
                        onChange={(e) => setMetadataValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                        className="w-full text-sm p-3.5 rounded-xl border border-slate-200 outline-none font-bold bg-white focus:border-[#0F6659] shadow-2xs text-slate-800 ios-zoom-fix-sm"
                      />
                    </div>
                  );
                }

                // Time Picker field
                if (field.type === "time") {
                  return (
                    <div key={field.id}>
                      <label className="text-xs font-extrabold text-slate-700 block mb-1.5">
                        {field.label} {field.required && <span className="text-rose-500">*</span>}
                      </label>
                      <input
                        type="time"
                        value={currentVal || ""}
                        onChange={(e) => setMetadataValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                        className="w-full text-sm p-3.5 rounded-xl border border-slate-200 outline-none font-bold bg-white focus:border-[#0F6659] shadow-2xs text-slate-800 ios-zoom-fix-sm"
                      />
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
                              className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                currentVal === opt
                                  ? 'bg-[#0F6659] text-white border-[#0F6659] shadow-2xs'
                                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <select
                          value={currentVal || ""}
                          onChange={(e) => setMetadataValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                          className="w-full text-sm p-3.5 rounded-xl border border-slate-200 outline-none font-bold bg-white focus:border-[#0F6659] shadow-2xs ios-zoom-fix-sm"
                        >
                          <option value="">-- เลือก --</option>
                          {opts.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
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
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isTrue
                            ? 'bg-[#0F6659] text-white shadow-2xs'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {isTrue ? "✓ ใช่ (Yes)" : "ไม่ใช่ (No)"}
                      </button>
                    </div>
                  );
                }

                // Textarea field
                if (field.type === "textarea") {
                  return (
                    <div key={field.id}>
                      <label className="text-xs font-extrabold text-slate-700 block mb-1.5">
                        {field.label} {field.required && <span className="text-rose-500">*</span>}
                      </label>
                      <textarea
                        rows={3}
                        value={currentVal || ""}
                        onChange={(e) => setMetadataValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                        placeholder={field.placeholder || "กรอกรายละเอียด..."}
                        className="w-full text-sm p-3.5 rounded-xl border border-slate-200 outline-none font-medium bg-white focus:border-[#0F6659] shadow-2xs resize-none ios-zoom-fix-sm"
                      />
                    </div>
                  );
                }

                // Text field (default)
                return (
                  <div key={field.id}>
                    <label className="text-xs font-extrabold text-slate-700 block mb-1.5">
                      {field.label} {field.required && <span className="text-rose-500">*</span>}
                    </label>
                    <input
                      type="text"
                      value={currentVal || ""}
                      onChange={(e) => setMetadataValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                      placeholder={field.placeholder || "กรอกข้อมูล..."}
                      className="w-full text-sm p-3.5 rounded-xl border border-slate-200 outline-none font-bold bg-white focus:border-[#0F6659] shadow-2xs ios-zoom-fix-sm"
                    />
                  </div>
                );
              })}

              <button
                type="button"
                onClick={handleProceedToSection}
                className="w-full py-4 mt-2 rounded-2xl text-sm font-extrabold bg-[#0F6659] text-white shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer hover:bg-emerald-800 transition-all"
              >
                ไปที่รายการตรวจทั้งหมด <ChevronRight size={16} />
              </button>
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
                          className={`p-4 sm:p-5 rounded-3xl border transition-all duration-300 ${
                            isHighlighted
                              ? "bg-rose-50/95 border-2 border-rose-500 ring-4 ring-rose-300/60 shadow-lg animate-pulse"
                              : isNa
                              ? "bg-slate-50/90 border-slate-300"
                              : isFailed
                              ? "bg-red-50/50 border-red-300"
                              : "bg-white border-slate-200 shadow-2xs"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                <span className="text-[11px] font-black text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md">ข้อ {q.orderIndex || idx + 1}</span>
                                {q.isCritical && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-red-100 text-red-800 border border-red-200">🚨 จุดวิกฤต (Critical)</span>
                                )}
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100">
                                  คะแนน {isAnswered && !isNa ? scoreGiven : 0} / {q.fullScore || 10}
                                </span>
                                {isHighlighted && (
                                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-600 text-white animate-bounce">กรุณาตอบข้อนี้!</span>
                                )}
                              </div>
                              <h4 className={`text-sm sm:text-base font-semibold leading-snug ${isNa ? "text-slate-400 line-through" : "text-slate-800"}`}>
                                {q.questionText || q.text}
                              </h4>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0 mt-1">
                              <button
                                type="button"
                                onClick={() => setOpenComments(prev => ({ ...prev, [q.id]: !isCommentOpen }))}
                                className={`w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer transition-all border ${
                                  (comments[q.id] && comments[q.id].trim().length > 0)
                                    ? 'bg-amber-50 text-amber-700 border-amber-300'
                                    : isCommentOpen
                                    ? 'bg-slate-200 text-slate-800 border-slate-300'
                                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                <MessageSquare size={16} className={(comments[q.id] && comments[q.id].trim().length > 0) ? "fill-amber-400/40" : ""} />
                              </button>
                              <label
                                className={`h-9 px-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all border ${
                                  hasPhoto ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                                }`}
                                title="แนบรูปถ่าย (ถ่ายภาพ หรือ เลือกรูปจากคลังภาพในเครื่อง)"
                              >
                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  className="hidden ios-zoom-fix-xs"
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
                                  className="hidden ios-zoom-fix-xs"
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
                                <CheckCircle2 size={18} /><span>ผ่าน / Yes</span>
                              </button>
                              <button type="button" onClick={() => handleAnswerSelect(q.id, "no")} className={`py-3 rounded-2xl text-[11px] sm:text-xs font-bold border cursor-pointer transition-all flex flex-col items-center justify-center gap-1 ${answers[q.id] === "no" || answers[q.id] === false ? 'bg-rose-600 text-white border-rose-600 shadow-md ring-2 ring-rose-600/30' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}>
                                <XCircle size={18} /><span>ไม่ผ่าน / No</span>
                              </button>
                              <button type="button" onClick={() => handleAnswerSelect(q.id, "na")} className={`py-3 rounded-2xl text-[11px] sm:text-xs font-bold border cursor-pointer transition-all flex flex-col items-center justify-center gap-1 ${answers[q.id] === "na" ? 'bg-slate-700 text-white border-slate-700 shadow-md ring-2 ring-slate-700/30' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}>
                                <Minus size={18} /><span>ข้าม (N/A)</span>
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
            </div>
          )}

          {/* TAB 3: SIGNATURES & SUBMIT */}
          {activeTab === 3 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-5">
                <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">การลงชื่อรับทราบผลตรวจ (Signatures)</h3>
                
                <SignaturePad
                  label={`1. ผู้รับการตรวจ / ผจก.สาขา (${unit?.fullName || unit?.name})`}
                  signatoryName={auditeeSignName}
                  onNameChange={setAuditeeSignName}
                  onSignChange={setAuditeeSignature}
                  placeholderName="ระบุชื่อ-นามสกุล..."
                />

                <SignaturePad
                  label={`2. ผู้ตรวจประเมิน (${auditorName || defaultAuditorName})`}
                  onSignChange={setAuditorSignature}
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
                    ยกเลิกและล้างแบบร่างทั้งหมด
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* CONFIRMATION MODAL */}
        {showConfirmModal && typeof document !== 'undefined' && createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
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
