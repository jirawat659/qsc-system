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
  Wrench, Square, Minus, Building2, ArrowUpDown, History, Shield, Info, HelpCircle, Loader2, AlertCircle, Save, RotateCcw
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
      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none text-slate-800 focus:border-[#0F6659] bg-slate-50/80"
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
          className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white font-semibold text-slate-800 outline-none focus:border-[#0F6659] shadow-2xs"
        />
      )}
    </div>
  );
}


export default function LiveAuditScreen({
  preselectedPlan,
  onClearPlan,
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

  // Step flow: select-unit -> select-form -> details -> section -> review-modal
  // 🌟 หากเป็นการเปิดฉบับร่างค้างตรวจ ให้ข้ามไปหน้า 'section' ทันที!
  const [step, setStep] = useState(() => {
    if (isResumeDraft) return "section";
    if (isFromAssignedPlan) return "details";
    return "select-unit";
  });

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
  const [staffCount, setStaffCount] = useState(isResumeDraft ? (parsedDraftPayload?.staffCount || "0") : "0");
  const [auditorName, setAuditorName] = useState(isResumeDraft ? (parsedDraftPayload?.auditorName || defaultAuditorName) : defaultAuditorName);
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
      setStep("section");
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
    const isActivelyAuditing = step === "details" || step === "section";
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
  }, [unit, selectedForm, sectionIdx, answers, photos, comments, staffCount, auditorName, auditType, extraNote, step, hasUserAnswers, currentUser]);

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

  // 📸 Handle Photo Upload with Client-side Compression & Instant Draft Save
  const handlePhotoUpload = async (questionId, file) => {
    if (!file) return;
    try {
      const compressedDataUrl = await compressImageFile(file);
      setPhotos(prev => {
        const next = { ...prev, [questionId]: compressedDataUrl };
        performSaveDraft({ photos: next });
        return next;
      });
    } catch (e) {
      console.error("Compression error:", e);
    }
  };

  const handlePhotoDelete = (questionId) => {
    setPhotos(prev => {
      const next = { ...prev };
      delete next[questionId];
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

          responses.push({
            surveyItemId: q.id,
            rawAnswer: String(ans !== undefined ? ans : "yes"),
            answerValue: String(ans !== undefined ? ans : "yes"),
            scaleScore: typeof ans === "number" ? ans : (!isNaN(Number(ans)) ? Number(ans) : null),
            scoreGiven,
            isPassed,
            isNa,
            notes: comments[q.id] || "",
            imageUrls: photos[q.id] ? [photos[q.id]] : []
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
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาชื่อสาขา, โรงงาน หรือสำนักงาน..."
            value={searchBranch}
            onChange={(e) => setSearchBranch(e.target.value)}
            className="w-full text-xs sm:text-sm pl-11 pr-9 py-3 rounded-2xl bg-white border border-slate-200 shadow-2xs outline-none font-bold text-slate-800 focus:border-[#0F6659] transition-colors"
          />
          {searchBranch && (
            <button onClick={() => setSearchBranch("")} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer rounded-lg">
              <X size={14} />
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
              onClick={() => { setSelectedForm(f); setStep("details"); }}
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
  // STEP 3: DETAILS (AUDITOR INFO & TYPE)
  // ════════════════════════════════════════════════════════════════════════════
  if (step === "details") {
    const handleProceedToSection = () => {
      const errors = {};
      if (!auditorName || !auditorName.trim()) {
        errors.auditorName = "กรุณาระบุชื่อผู้ตรวจประเมิน (ห้ามเว้นว่าง)";
      }
      if (!auditType || (auditType !== "announced" && auditType !== "spot" && auditType !== "unannounced" && auditType !== "undercover")) {
        errors.auditType = "กรุณาเลือกประเภทการตรวจ (ห้ามเว้นว่าง)";
      }
      if (!staffCount || isNaN(Number(staffCount)) || Number(staffCount) <= 0) {
        errors.staffCount = "กรุณาระบุจำนวนพนักงานที่ปฏิบัติงานขณะตรวจ (อย่างน้อย 1 คน)";
      }

      if (Object.keys(errors).length > 0) {
        setDetailsErrors(errors);
        return;
      }

      setDetailsErrors({});
      setStep("section");
    };

    return (
      <div className="page-transition p-4 sm:p-6 space-y-4 w-full max-w-[100%] sm:max-w-[96%] md:max-w-[92%] mx-auto">
        <Header
          title="รายละเอียดการตรวจ"
          subtitle={`${unit?.fullName || unit?.name}\n${selectedForm?.title || selectedForm?.name || "แบบฟอร์มการตรวจ"}`}
          onBack={() => {
            if (isFromAssignedPlan) {
              onClearPlan();
            } else {
              setStep("select-form");
            }
          }}
        />

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
          {/* 1. ผู้ตรวจประเมิน */}
          <div>
            <label className="text-xs font-extrabold text-slate-700 block mb-1.5 flex items-center gap-1">
              <span>ผู้ตรวจประเมิน (Auditor)</span>
              <span className="text-rose-500 font-black">*</span>
            </label>
            <input
              type="text"
              placeholder="ระบุชื่อผู้ตรวจประเมิน..."
              value={auditorName}
              onChange={(e) => {
                setAuditorName(e.target.value);
                if (detailsErrors.auditorName) {
                  setDetailsErrors(prev => ({ ...prev, auditorName: null }));
                }
              }}
              className={`w-full text-sm p-3.5 rounded-xl border outline-none font-bold transition-all ${
                detailsErrors.auditorName
                  ? 'border-rose-400 bg-rose-50/40 text-slate-800 ring-2 ring-rose-300/40 focus:border-rose-500'
                  : 'border-slate-200 text-slate-800 focus:border-[#0F6659]'
              }`}
            />
            {detailsErrors.auditorName && (
              <p className="text-[11px] font-bold text-rose-600 mt-1 flex items-center gap-1 animate-in fade-in duration-150">
                <AlertCircle size={12} className="shrink-0" />
                <span>{detailsErrors.auditorName}</span>
              </p>
            )}
          </div>

          {/* 2. ประเภทการตรวจ */}
          <div>
            <label className="text-xs font-extrabold text-slate-700 block mb-1.5 flex items-center gap-1">
              <span>ประเภทการตรวจ (Audit Type)</span>
              <span className="text-rose-500 font-black">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: "announced", label: "ตามกำหนดการ" },
                { key: "unannounced", label: "นอกกำหนดการ" },
                { key: "undercover", label: "ปลอมตัว" },
              ].map(t => {
                const isSelected = auditType === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => {
                      setAuditType(t.key);
                      if (detailsErrors.auditType) {
                        setDetailsErrors(prev => ({ ...prev, auditType: null }));
                      }
                    }}
                    className={`py-3 rounded-xl text-xs font-bold border cursor-pointer transition-all active:scale-95 ${
                      isSelected
                        ? 'bg-[#0F6659] text-white border-[#0F6659] shadow-2xs ring-2 ring-[#0F6659]/30'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
            {detailsErrors.auditType && (
              <p className="text-[11px] font-bold text-rose-600 mt-1 flex items-center gap-1 animate-in fade-in duration-150">
                <AlertCircle size={12} className="shrink-0" />
                <span>{detailsErrors.auditType}</span>
              </p>
            )}
          </div>

          {/* 3. จำนวนพนักงาน */}
          <div>
            <label className="text-xs font-extrabold text-slate-700 block mb-1.5 flex items-center gap-1">
              <span>จำนวนพนักงานที่ปฏิบัติงานขณะตรวจ</span>
              <span className="text-rose-500 font-black">*</span>
            </label>
            <input
              type="number"
              min="1"
              placeholder="ระบุจำนวนพนักงาน (คน)..."
              value={staffCount}
              onChange={(e) => {
                setStaffCount(e.target.value);
                if (detailsErrors.staffCount) {
                  setDetailsErrors(prev => ({ ...prev, staffCount: null }));
                }
              }}
              className={`w-full text-sm p-3.5 rounded-xl border outline-none font-bold transition-all ${
                detailsErrors.staffCount
                  ? 'border-rose-400 bg-rose-50/40 text-slate-800 ring-2 ring-rose-300/40 focus:border-rose-500'
                  : 'border-slate-200 text-slate-800 focus:border-[#0F6659]'
              }`}
            />
            {detailsErrors.staffCount && (
              <p className="text-[11px] font-bold text-rose-600 mt-1 flex items-center gap-1 animate-in fade-in duration-150">
                <AlertCircle size={12} className="shrink-0" />
                <span>{detailsErrors.staffCount}</span>
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleProceedToSection}
          className="w-full py-4 rounded-2xl text-base font-extrabold bg-[#0F6659] hover:bg-[#0c5248] text-white shadow-md active:scale-98 cursor-pointer flex items-center justify-center gap-2 transition-all"
        >
          <span>เริ่มตรวจข้อประเมิน</span>
          <ChevronRight size={18} />
        </button>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // STEP 4: SECTION QUESTIONS WITH REAL-TIME AUTO-SYNC (GOOGLE FORMS STYLE)
  // ════════════════════════════════════════════════════════════════════════════
  const activeSec = currentSections[sectionIdx] || currentSections[0];
  const items = activeSec?.items || [];

  return (
    <div className="page-transition p-4 sm:p-6 space-y-4 w-full max-w-[100%] sm:max-w-[96%] md:max-w-[92%] mx-auto pb-16">
      {/* Header with Auto-Sync Status Indicator */}
      <Header
        title={selectedForm?.title || "ตรวจประเมินหน้างาน"}
        subtitle={`${unit?.fullName || unit?.name}\n${activeSec?.title || "หมวดการตรวจ"} (${sectionIdx + 1}/${currentSections.length})`}
        onBack={async () => {
          await performSaveDraft();
          if (onClearPlan) {
            onClearPlan();
          } else {
            setStep("select-unit");
          }
        }}
        action={
          <div className="flex items-center gap-1.5 shrink-0">
            {syncStatus === "saving" ? (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-300 shadow-2xs text-[11px] font-bold text-amber-800 animate-pulse">
                <Loader2 size={12} className="animate-spin text-amber-600" />
                <span>Syncing...</span>
              </div>
            ) : syncStatus === "error" ? (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-300 shadow-2xs text-[11px] font-bold text-rose-800">
                <AlertCircle size={12} className="text-rose-600" />
                <span>Sync ไม่สำเร็จ</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-300/90 shadow-2xs text-[11px] font-bold text-emerald-800">
                <CheckCircle2 size={12} className="text-emerald-600" />
                <span>Sync</span>
              </div>
            )}
          </div>
        }
      />

      {/* 🌟 Horizontal Scrollable Category Bar (แถบเลือกหมวดหมู่เลื่อนๆ) */}
      <div className="overflow-x-auto pb-1 custom-tab-scrollbar scroll-smooth" style={{ scrollbarWidth: "none" }}>
        <div className="flex gap-2 min-w-max">
          {currentSections.map((sec, sIdx) => {
            const isCurrent = sIdx === sectionIdx;
            const secItems = sec.items || [];
            const answeredCount = secItems.filter(item => answers[item.id] !== undefined && answers[item.id] !== "").length;
            const isCompleted = secItems.length > 0 && answeredCount === secItems.length;

            return (
              <button
                key={sec.id || sIdx}
                type="button"
                onClick={() => setSectionIdx(sIdx)}
                className={`px-3.5 py-2 rounded-2xl text-xs font-bold cursor-pointer transition-all shrink-0 flex items-center gap-2 border shadow-2xs ${
                  isCurrent
                    ? 'bg-[#0F6659] text-white border-[#0F6659] shadow-xs ring-2 ring-[#0F6659]/30'
                    : isCompleted
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                  isCurrent
                    ? 'bg-white/20 text-white'
                    : isCompleted
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}>
                  {isCompleted && !isCurrent ? <Check size={11} strokeWidth={3} /> : (sIdx + 1)}
                </span>
                <span className="whitespace-nowrap">{sec.title}</span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                  isCurrent ? 'bg-black/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  {answeredCount}/{secItems.length}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Questions List */}
      <div className="space-y-4">
        {items.map((q, idx) => {
          const isHighlighted = highlightedQuestionId === q.id;
          const isNa = answers[q.id] === "na";
          const isFailed = !isNa && (answers[q.id] === "no" || answers[q.id] === false || (Number(answers[q.id]) < 3 && answers[q.id] !== undefined && answers[q.id] !== ""));
          const hasPhoto = !!photos[q.id];
          const qType = (q.questionType || q.type || "YESNO").toString().toLowerCase();
          const isScale = qType === "scale" || qType === "rating";
          const isCommentOpen = Boolean(openComments[q.id] || (comments[q.id] && comments[q.id].trim().length > 0));

          return (
            <div
              key={q.id || idx}
              id={`question-card-${q.id}`}
              className={`p-4 sm:p-5 rounded-3xl border transition-all duration-300 ${
                isHighlighted
                  ? "bg-rose-50/95 border-2 border-rose-500 ring-4 ring-rose-300/60 shadow-lg animate-pulse"
                  : isNa
                  ? "bg-slate-50/90 border-slate-300 ring-1 ring-slate-300/50"
                  : isFailed
                  ? "bg-red-50/50 border-red-300 ring-1 ring-red-400/30"
                  : "bg-white border-slate-200 shadow-2xs"
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-semibold text-slate-400">#{idx + 1}</span>
                    {isHighlighted && (
                      <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-rose-600 text-white animate-bounce shadow-xs flex items-center gap-1">
                        <AlertTriangle size={12} />
                        <span>กรุณาตอบข้อนี้</span>
                      </span>
                    )}
                    {q.isCritical && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-red-100 text-red-800 border border-red-200">
                        🚨 จุดวิกฤต (Critical)
                      </span>
                    )}
                    {isNa ? (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 border border-slate-300">
                        ⚪ ข้าม (N/A: ไม่คิดคะแนน)
                      </span>
                    ) : (
                      <span className="text-[11px] font-normal text-slate-400">
                        คะแนนเต็ม {q.fullScore || 10}
                      </span>
                    )}
                  </div>
                  <h4 className={`text-sm sm:text-base font-medium leading-snug ${isNa ? "text-slate-500 line-through" : "text-slate-900"}`}>
                    {q.questionText || q.text}
                  </h4>
                </div>

                {/* Right Action Buttons: Comment Toggle + Camera */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Comment Toggle Button */}
                  <button
                    type="button"
                    onClick={() => setOpenComments(prev => ({ ...prev, [q.id]: !isCommentOpen }))}
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center cursor-pointer transition-all border ${
                      (comments[q.id] && comments[q.id].trim().length > 0)
                        ? 'bg-amber-50 text-amber-800 border-amber-300 shadow-2xs'
                        : isCommentOpen
                        ? 'bg-slate-200 text-slate-800 border-slate-300'
                        : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                    }`}
                    title={isCommentOpen ? "ซ่อนกล่องข้อคิดเห็น" : "พิมพ์ข้อคิดเห็น / บันทึกข้อบกพร่อง"}
                  >
                    <MessageSquare size={17} className={(comments[q.id] && comments[q.id].trim().length > 0) ? "fill-amber-400/40 text-amber-700" : ""} />
                  </button>

                  {/* Camera Button */}
                  <label className={`w-10 h-10 rounded-2xl flex items-center justify-center cursor-pointer transition-all shrink-0 border ${
                    hasPhoto ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs' : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                  }`} title="ถ่ายรูปหลักฐาน">
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => handlePhotoUpload(q.id, e.target.files[0])}
                    />
                    <Camera size={18} />
                  </label>
                </div>
              </div>

              {/* Photo Preview if attached */}
              {hasPhoto && (
                <div className="relative inline-block mb-3 rounded-2xl overflow-hidden border border-slate-200 shadow-2xs">
                  <img src={photos[q.id]} alt="Evidence" className="h-28 w-44 object-cover" />
                  <button
                    type="button"
                    onClick={() => handlePhotoDelete(q.id)}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center text-xs hover:bg-red-600 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Answer Controls with Toggle to Unselect (คลิกซ้ำเพื่อยกเลิกคำตอบ) */}
              {!isScale && (
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleAnswerSelect(q.id, "yes")}
                    className={`py-2.5 sm:py-3 rounded-2xl text-xs sm:text-sm font-semibold border cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-1 ${
                      answers[q.id] === "yes" || answers[q.id] === true
                        ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                    title="คลิกซ้ำเพื่อยกเลิกคำตอบ"
                  >
                    <CheckCircle2 size={15} />
                    <span>ผ่าน</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAnswerSelect(q.id, "no")}
                    className={`py-3 rounded-2xl text-xs sm:text-sm font-extrabold border cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-1 ${
                      answers[q.id] === "no" || answers[q.id] === false
                        ? 'bg-red-700 text-white border-red-700 shadow-2xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                    title="คลิกซ้ำเพื่อยกเลิกคำตอบ"
                  >
                    <XCircle size={15} />
                    <span>ไม่ผ่าน</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAnswerSelect(q.id, "na")}
                    className={`py-3 rounded-2xl text-xs sm:text-sm font-extrabold border cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-1 ${
                      answers[q.id] === "na"
                        ? 'bg-slate-700 text-white border-slate-700 shadow-2xs'
                        : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                    }`}
                    title="ข้ามข้อนี้ไป ไม่นำคะแนนเต็มไปนับรวม"
                  >
                    <Minus size={15} />
                    <span>ข้าม</span>
                  </button>
                </div>
              )}

              {isScale && (
                <div className="flex gap-2 pt-1 items-center">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => handleAnswerSelect(q.id, n)}
                      className={`flex-1 py-3 rounded-xl flex items-center justify-center text-sm font-extrabold cursor-pointer transition-all active:scale-95 ${
                        answers[q.id] === n
                          ? 'bg-[#0F6659] text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                      title="คลิกซ้ำเพื่อยกเลิก"
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleAnswerSelect(q.id, "na")}
                    className={`px-3 py-3 rounded-xl flex items-center justify-center text-xs font-extrabold cursor-pointer transition-all active:scale-95 border ${
                      answers[q.id] === "na"
                        ? 'bg-slate-700 text-white border-slate-700'
                        : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                    }`}
                    title="ข้ามข้อนี้ไป ไม่นำคะแนนเต็มไปนับรวม"
                  >
                    <Minus size={13} className="mr-0.5" />
                    <span>ข้าม</span>
                  </button>
                </div>
              )}

              {/* Note / Comment textarea - shown ONLY when toggled or has text */}
              {isCommentOpen && (
                <div className="mt-2.5 animate-in fade-in slide-in-from-top-1 duration-150">
                  <QuestionCommentInput
                    initialValue={comments[q.id]}
                    onChange={(val) => handleCommentChange(q.id, val)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Navigation Footer */}
      <div className="space-y-3 pt-4">
        <div className="flex gap-3">
          {sectionIdx > 0 && (
            <button
              type="button"
              onClick={goPrevSection}
              className="flex-1 py-4 rounded-2xl text-sm font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer shadow-2xs active:scale-98"
            >
              ย้อนกลับ
            </button>
          )}
          <button
            type="button"
            onClick={goNext}
            className="flex-1 py-4 rounded-2xl text-sm sm:text-base font-extrabold bg-[#0F6659] text-white shadow-md active:scale-98 cursor-pointer flex items-center justify-center gap-2"
          >
            <span>{sectionIdx < currentSections.length - 1 ? "หมวดถัดไป ➔" : "ตรวจสอบและส่งผลตรวจ ➔"}</span>
          </button>
        </div>

        {/* 🗑️ Discard Draft Option */}
        {hasUserAnswers && (
          <div className="text-center pt-1">
            <button
              type="button"
              onClick={handleDiscardDraft}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-red-600 transition-colors cursor-pointer py-1.5 px-3 rounded-xl hover:bg-red-50"
            >
              <Trash2 size={13} />
              <span>ยกเลิกและล้างแบบร่างการตรวจนี้</span>
            </button>
          </div>
        )}
      </div>

      {/* 🛑 FINAL CONFIRMATION REVIEW MODAL (สรุปและยืนยันรอบสุดท้ายก่อนส่งจริง - Fullscreen Portal) */}
      {showConfirmModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="text-center">
              <div className="w-14 h-14 rounded-3xl bg-emerald-100 text-[#0F6659] flex items-center justify-center mx-auto mb-3 shadow-2xs">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="text-xl font-extrabold text-slate-900">สรุปผลการตรวจประเมิน</h3>
              <p className="text-xs font-bold text-slate-500 mt-0.5">{unit?.fullName || unit?.name}</p>
            </div>

            {/* Score Ring Summary */}
            <div className={`rounded-2xl p-4 text-center border ${
              scoreAnalysis.isPassed ? 'bg-emerald-50/70 border-emerald-300' : 'bg-red-50/70 border-red-300'
            }`}>
              <div className="text-xs font-bold text-slate-500 mb-1">คะแนนรวมที่คำนวณได้ (เกณฑ์ผ่าน {passingScore}%)</div>
              <div className="text-4xl sm:text-5xl font-black" style={{ color: scoreAnalysis.isPassed ? '#0F6659' : '#B91C1C', fontFamily: mono }}>
                {scoreAnalysis.percentage}%
              </div>
              <div className={`text-xs font-extrabold mt-1.5 ${scoreAnalysis.isPassed ? 'text-emerald-800' : 'text-red-800'}`}>
                {scoreAnalysis.isPassed ? "✓ ผ่านเกณฑ์มาตรฐาน Q.S.C." : "⚠️ ไม่ผ่านเกณฑ์ (ต้องสร้างตั๋ว CAP แก้ไข)"}
              </div>
              {scoreAnalysis.naCount > 0 && (
                <div className="text-[11px] font-bold text-slate-500 mt-1">
                  ⚪ มีข้อที่ข้าม (N/A) ทั้งหมด {scoreAnalysis.naCount} ข้อ (คำนวณคะแนนเต็ม {scoreAnalysis.maxScore} คะแนน)
                </div>
              )}
            </div>

            {/* Critical Defect Alert */}
            {scoreAnalysis.hasCriticalDefect && (
              <div className="bg-red-50 border border-red-300 p-3.5 rounded-2xl flex items-start gap-2.5 text-red-950 text-xs font-extrabold shadow-2xs">
                <ShieldAlert size={18} className="text-red-600 shrink-0 mt-0.5" />
                <div>
                  <div className="text-red-800">🚨 พบข้อบกพร่องระดับวิกฤต (Critical Defect)</div>
                  <div className="text-[11px] text-red-700 font-normal mt-0.5 leading-relaxed">
                    ระบบบังคับปรับตกทั้งฉบับโดยอัตโนมัติ เพื่อให้เป็นไปตามมาตรฐานความปลอดภัยทางอาหารสากล
                  </div>
                </div>
              </div>
            )}

            {/* Failed Items warning */}
            {scoreAnalysis.failedQuestions.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl space-y-1.5">
                <div className="text-xs font-extrabold text-amber-950 flex items-center gap-1.5">
                  <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                  <span>ตรวจพบข้อบกพร่อง {scoreAnalysis.failedQuestions.length} รายการ (จะสร้างตั๋ว CAP อัตโนมัติ):</span>
                </div>
                <ul className="text-[11.5px] text-amber-900 space-y-1 pl-4 list-disc font-medium">
                  {scoreAnalysis.failedQuestions.map((fq, i) => (
                    <li key={i} className="truncate">- {fq.questionText || fq.text}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Submit Error Banner */}
            {submitError && (
              <div className="bg-rose-50 border border-rose-300 p-3.5 rounded-2xl flex items-start gap-2.5 text-rose-950 text-xs font-bold shadow-2xs">
                <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <div className="text-rose-800">เกิดข้อผิดพลาดในการบันทึกผลตรวจ</div>
                  <div className="text-[11px] text-rose-700 font-normal mt-0.5 leading-relaxed">{submitError}</div>
                </div>
              </div>
            )}

            {/* ✍️ DIGITAL SIGNATURES SECTION (การลงนามรับทราบผลตรวจ) */}
            <div className="bg-slate-50/90 border border-slate-200 p-4 rounded-2xl space-y-3.5 text-left">
              <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                <div className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <PenTool size={14} className="text-[#0F6659]" />
                  <span>การลงนามรับทราบผลตรวจ (Digital Signatures)</span>
                </div>
                <span className="text-[10.5px] font-bold text-slate-400">เซ็นชื่อด้วยนิ้วหรือปากกา</span>
              </div>

              {/* 1. Auditee / Store Manager Signature */}
              <SignaturePad
                label={`1. ลายเซ็นผู้จัดการสาขา / ผู้รับการตรวจ (${unit?.fullName || unit?.name})`}
                signatoryName={auditeeSignName}
                onNameChange={setAuditeeSignName}
                onSignChange={setAuditeeSignature}
                placeholderName="ระบุชื่อ-นามสกุล ผู้จัดการสาขา / ผู้รับตรวจ"
              />

              {/* 2. Auditor Signature */}
              <SignaturePad
                label={`2. ลายเซ็นผู้ตรวจประเมิน (${currentUser?.name || defaultAuditorName})`}
                onSignChange={setAuditorSignature}
              />
            </div>

            {/* Permanent Lock Warning */}
            <div className="text-center text-xs font-bold text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200">
              ⚠️ กรุณาตรวจสอบความถูกต้องก่อนกดยืนยัน
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={isSubmitting}
                className="flex-1 py-3.5 rounded-2xl text-xs sm:text-sm font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer transition-colors"
              >
                ย้อนกลับไปแก้ไข
              </button>
              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={isSubmitting}
                className="flex-1 py-3.5 rounded-2xl text-xs sm:text-sm font-extrabold bg-[#0F6659] hover:bg-emerald-800 text-white shadow-md active:scale-98 cursor-pointer flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>กำลังบันทึก...</span>
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    <span>ยืนยันและส่งผลตรวจ</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 🗑️ Custom Discard Draft Confirm Modal (Fullscreen Portal) */}
      {showDiscardConfirmModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 space-y-4 text-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-3xl bg-rose-50 border border-rose-200/80 text-rose-600 flex items-center justify-center mx-auto shadow-2xs">
              <Trash2 size={28} strokeWidth={2} />
            </div>

            <div className="space-y-1">
              <h4 className="text-lg font-black text-slate-900">ยกเลิกร่างการตรวจ?</h4>
              <p className="text-xs text-slate-500 font-medium px-2">
                คุณต้องการยกเลิกและล้างคำตอบของแบบร่างสาขา <br/>
                <span className="font-bold text-slate-800">"{unit?.fullName || unit?.name}"</span> ทั้งหมดใช่หรือไม่?
              </p>
            </div>

            <div className="pt-2 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setShowDiscardConfirmModal(false)}
                className="py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs cursor-pointer transition-all active:scale-95 border border-slate-200"
              >
                ย้อนกลับ
              </button>
              <button
                type="button"
                onClick={confirmDiscardDraft}
                className="py-3 px-4 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs cursor-pointer transition-all active:scale-95 shadow-md shadow-rose-600/20 flex items-center justify-center gap-1.5"
              >
                ยืนยันยกเลิกร่าง
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
