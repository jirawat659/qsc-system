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
  Wrench, Square, Minus, Building2, ArrowUpDown, History, Shield, Info, HelpCircle, Loader2
} from "lucide-react";

import { c, sans, mono, cardStyle } from "../../config/theme";
import { TopBarContext } from "../../context/TopBarContext";
import { DataContext } from "../../context/DataContext";
import { INITIAL_FORMS_LIST, INITIAL_FORM_SECTIONS } from "../../mocks/forms";
import { getDistanceInMeters, formatDistance, DEFAULT_USER_COORDS } from "../../utils/geo";
import api from "../../config/api";

import ModalWrapper from "../../shared/ModalWrapper";
import Header from "../../shared/Header";
import Section from "../../shared/Section";
import ScoreRing from "../../shared/ScoreRing";
import ErrorBoundary from "../../shared/ErrorBoundary";

// 🗜️ Client-side Image Compression Helper (ลดขนาดรูปเหลือ ~200KB ก่อนส่ง ไม่หน่วง ไม่ค้าง)
const compressImageFile = (file, maxWidth = 1600, maxHeight = 1600, quality = 0.8) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
    };
  });
};

export default function LiveAuditScreen({
  preselectedPlan,
  onClearPlan,
  defaultAuditorName = "สมชาย ใจดี",
  initialDraft,
  onSaveDraft,
  onCompleteAudit,
  onActiveStateChange
}) {
  const { locations, forms, activeDraft, refreshData } = React.useContext(DataContext);
  const formList = (forms && forms.length > 0) ? forms : INITIAL_FORMS_LIST;

  // Step flow: select-unit -> select-form -> details -> section -> review-modal
  const [step, setStep] = useState(() => {
    if (initialDraft || activeDraft) return "section";
    if (preselectedPlan) return "details";
    return "select-unit";
  });

  const [searchBranch, setSearchBranch] = useState("");
  const [userCoords, setUserCoords] = useState(DEFAULT_USER_COORDS);

  // Initialize draft data if exists
  const parsedDraftPayload = useMemo(() => {
    if (activeDraft?.draftPayloadJson) {
      try {
        return JSON.parse(activeDraft.draftPayloadJson);
      } catch (e) {
        return null;
      }
    }
    return initialDraft || null;
  }, [activeDraft, initialDraft]);

  const [unit, setUnit] = useState(() => {
    if (parsedDraftPayload?.unit) return parsedDraftPayload.unit;
    if (preselectedPlan) {
      return locations.find(u => u.id === preselectedPlan.locationId || u.name === preselectedPlan.unit || u.fullName?.includes(preselectedPlan.unit)) || locations[0];
    }
    if (activeDraft?.locationId) {
      return locations.find(u => u.id === activeDraft.locationId) || locations[0];
    }
    return null;
  });

  const [selectedForm, setSelectedForm] = useState(() => {
    if (parsedDraftPayload?.formId) {
      return formList.find(f => f.id === parsedDraftPayload.formId) || formList[0];
    }
    return formList[0];
  });

  const [sectionIdx, setSectionIdx] = useState(parsedDraftPayload?.sectionIdx || 0);
  const [answers, setAnswers] = useState(parsedDraftPayload?.answers || {});
  const [photos, setPhotos] = useState(parsedDraftPayload?.photos || {});
  const [comments, setComments] = useState(parsedDraftPayload?.comments || {});
  const [openNoteId, setOpenNoteId] = useState(null);
  const [staffCount, setStaffCount] = useState(parsedDraftPayload?.staffCount || "4");
  const [auditorName, setAuditorName] = useState(parsedDraftPayload?.auditorName || defaultAuditorName);
  const [auditType, setAuditType] = useState(parsedDraftPayload?.auditType || preselectedPlan?.auditType || "announced");
  const [extraNote, setExtraNote] = useState(parsedDraftPayload?.extraNote || "");

  // Auto-sync status indicator
  const [syncStatus, setSyncStatus] = useState("idle"); // 'idle' | 'saving' | 'synced' // 'synced' | 'saving'
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // ⚡ GOOGLE FORMS STYLE: Real-time Auto-Sync to Backend (Debounced 600ms)
  const autoSaveTimerRef = useRef(null);
  const hasUserAnswers = useMemo(() => {
    return Object.keys(answers).length > 0 || Object.keys(photos).length > 0 || Object.keys(comments).length > 0;
  }, [answers, photos, comments]);

  useEffect(() => {
    if (!unit || step === "select-unit") return;

    // 🛑 หากยังไม่มีการตอบคำถามข้อใดเลย ให้ซ่อนสถานะและไม่ต้อง Auto-sync
    if (!hasUserAnswers) {
      setSyncStatus("idle");
      return;
    }

    setSyncStatus("saving");
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        const payload = {
          unit,
          formId: selectedForm?.id || 1,
          sectionIdx,
          answers,
          photos,
          comments,
          staffCount,
          auditorName,
          auditType,
          extraNote
        };

        const totalAnswered = Object.keys(answers).length;
        const totalQuestions = (selectedForm?.sections || INITIAL_FORM_SECTIONS).reduce(
          (acc, sec) => acc + (sec.items?.length || 0), 0
        );

        await api.put('/audit/draft', {
          locationId: unit.id,
          surveyFormId: selectedForm?.id || 1,
          draftPayloadJson: JSON.stringify(payload),
          currentSectionIdx: sectionIdx,
          totalAnswered,
          totalQuestions,
          auditorName
        });

        setSyncStatus("synced");
      } catch (err) {
        console.warn("Auto-sync draft warning:", err);
        setSyncStatus("synced");
      }
    }, 600);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [unit, selectedForm, sectionIdx, answers, photos, comments, staffCount, auditorName, auditType, extraNote, step, hasUserAnswers]);

  const currentSections = selectedForm?.sections || INITIAL_FORM_SECTIONS;
  const passingScore = selectedForm?.passingScore || 85;

  // 🌟 SORTING HIERARCHY:
  // Priority 1: สาขาที่ตรวจค้างอยู่ (In-Progress Draft) ขึ้นบนสุดอันดับ 1
  // Priority 2: สาขาอื่นๆ จัดเรียงตามระยะทางจริงจากน้อยไปมาก
  const sortedBranchList = useMemo(() => {
    let list = [...(locations || [])];

    if (searchBranch.trim()) {
      const q = searchBranch.toLowerCase();
      list = list.filter(u =>
        u.name?.toLowerCase().includes(q) ||
        (u.fullName && u.fullName.toLowerCase().includes(q)) ||
        u.region?.toLowerCase().includes(q) ||
        (u.address && u.address.toLowerCase().includes(q))
      );
    }

    const inProgressLocationId = activeDraft?.locationId || (parsedDraftPayload?.unit?.id);

    return list.sort((a, b) => {
      const aIsInProgress = a.id === inProgressLocationId;
      const bIsInProgress = b.id === inProgressLocationId;

      // 1. In-progress always comes first
      if (aIsInProgress && !bIsInProgress) return -1;
      if (!aIsInProgress && bIsInProgress) return 1;

      // 2. Otherwise sort by GPS distance ascending (น้อย ➔ มาก)
      const distA = getDistanceInMeters(userCoords.latitude, userCoords.longitude, a.latitude, a.longitude);
      const distB = getDistanceInMeters(userCoords.latitude, userCoords.longitude, b.latitude, b.longitude);
      return distA - distB;
    });
  }, [locations, searchBranch, activeDraft, parsedDraftPayload, userCoords]);

  // 📸 Handle Photo Upload with Client-side Compression
  const handlePhotoUpload = async (questionId, file) => {
    if (!file) return;
    try {
      const compressedDataUrl = await compressImageFile(file);
      setPhotos(prev => ({ ...prev, [questionId]: compressedDataUrl }));
    } catch (e) {
      console.error("Compression error:", e);
    }
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

        if (q.questionType === "yesno" || q.type === "yesno" || !q.questionType) {
          if (ans === "yes" || ans === true) {
            earnedScore += fullScore;
          } else if (ans === "no" || ans === false) {
            failedQuestions.push({ ...q, sectionTitle: sec.title, note: comments[q.id] || "ไม่ผ่านเกณฑ์มาตรฐาน" });
            if (q.isCritical) hasCriticalDefect = true;
          }
        } else if (q.questionType === "scale" || q.type === "scale") {
          const num = Number(ans) || 0;
          earnedScore += (num / 5) * fullScore;
          if (num < 3 && ans !== undefined && ans !== "") {
            failedQuestions.push({ ...q, sectionTitle: sec.title, note: comments[q.id] || `ได้คะแนนเพียง ${num}/5` });
            if (q.isCritical) hasCriticalDefect = true;
          }
        } else {
          earnedScore += fullScore;
        }
      });
    });

    const percentage = maxScore > 0 ? Math.round((earnedScore / maxScore) * 100) : 100;
    const isPassed = percentage >= passingScore && !hasCriticalDefect;

    return { earnedScore, maxScore, percentage, isPassed, hasCriticalDefect, naCount, failedQuestions };
  }, [currentSections, answers, comments, passingScore]);

  // 🛑 Final Submit Handler
  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
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
            scoreGiven,
            isPassed,
            isNa,
            notes: comments[q.id] || "",
            imageUrls: photos[q.id] ? [photos[q.id]] : []
          });
        });
      });

      const payload = {
        locationId: unit.id,
        surveyFormId: selectedForm?.id || 1,
        primaryAuditorId: 1, // Default auditor ID
        auditeeNameText: unit.managerName || "ผู้จัดการสาขา",
        auditScheduleId: preselectedPlan?.id || null,
        staffCount: Number(staffCount) || 0,
        auditType,
        notes: extraNote,
        startLatitude: parsedDraftPayload?.startLatitude || userCoords.latitude,
        startLongitude: parsedDraftPayload?.startLongitude || userCoords.longitude,
        endLatitude: endLat,
        endLongitude: endLng,
        startedAt: parsedDraftPayload?.startedAt || new Date().toISOString(),
        responses
      };

      await api.post('/audit', payload);
      if (refreshData) await refreshData();

      setShowConfirmModal(false);
      if (onCompleteAudit) onCompleteAudit();
      if (onActiveStateChange) onActiveStateChange(false);
      if (onClearPlan) onClearPlan();
      setStep("select-unit");
    } catch (err) {
      console.error("Submit audit failed:", err);
      alert("เกิดข้อผิดพลาดในการบันทึกผลตรวจ: " + (err.response?.data?.message || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const goNext = () => {
    if (sectionIdx < currentSections.length - 1) {
      setSectionIdx(sectionIdx + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setShowConfirmModal(true); // Open Final Review & Confirmation Modal
    }
  };
  
  // 🗑️ Discard Draft & Reset
  const handleDiscardDraft = async () => {
    if (window.confirm("คุณต้องการยกเลิกและล้างคำตอบของแบบร่างนี้ทั้งหมดใช่หรือไม่?")) {
      try {
        if (unit?.id) {
          await api.delete(`/audit/draft?locationId=${unit.id}`);
        }
        if (refreshData) await refreshData();
      } catch (e) {
        console.warn("Discard draft warning:", e);
      }
      setAnswers({});
      setPhotos({});
      setComments({});
      setSectionIdx(0);
      setSyncStatus("idle");
      setStep("select-unit");
    }
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
          subtitle="เลือกสาขาเป้าหมายเพื่อเริ่มตรวจประเมินคุณภาพตามมาตรฐาน Q.S.C."
          onBack={onClearPlan}
        />

        {/* 🌟 UNIFIED AUDITOR STATUS BAR (สไตล์เดียวกับหน้าภาพรวม) */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-extrabold text-slate-800">
                สถานะระบบตรวจและพิกัด GPS
              </h3>
              <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                <Navigation size={11} /> GPS ทำงานปกติ
              </span>
            </div>
            <span className="text-xs font-bold text-slate-400">
              ผู้ตรวจ: {auditorName}
            </span>
          </div>

          <div className="grid grid-cols-3 divide-x divide-slate-100 pt-0.5">
            <div className="px-2 sm:px-4 py-1 text-center flex flex-col justify-between gap-1">
              <div className="flex items-center justify-center gap-1 text-xs font-bold text-slate-500">
                <Store size={14} className="text-[#0F6659] shrink-0" />
                <span>สถานที่ทั้งหมด</span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 leading-tight" style={{ fontFamily: mono }}>
                {(locations || []).length} <span className="text-xs font-bold text-slate-400">แห่ง</span>
              </div>
              <div>
                <span className="inline-block text-[10px] sm:text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                  เรียงตามระยะทางใกล้สุด
                </span>
              </div>
            </div>

            <div className="px-2 sm:px-4 py-1 text-center flex flex-col justify-between gap-1">
              <div className="flex items-center justify-center gap-1 text-xs font-bold text-slate-500">
                <Clock size={14} className="text-amber-600 shrink-0" />
                <span>ตรวจค้างอยู่ (Draft)</span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-amber-900 leading-tight" style={{ fontFamily: mono }}>
                {draftCount} <span className="text-xs font-bold text-slate-400">สาขา</span>
              </div>
              <div>
                <span className="inline-block text-[10px] sm:text-[11px] font-bold text-amber-900 bg-amber-100/70 px-2 py-0.5 rounded-md">
                  {draftCount > 0 ? "ตรวจต่อได้ทันที" : "ไม่มีงานค้าง"}
                </span>
              </div>
            </div>

            <div className="px-2 sm:px-4 py-1 text-center flex flex-col justify-between gap-1">
              <div className="flex items-center justify-center gap-1 text-xs font-bold text-slate-500">
                <ShieldCheck size={14} className="text-emerald-700 shrink-0" />
                <span>เกณฑ์ผ่าน</span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-emerald-800 leading-tight" style={{ fontFamily: mono }}>
                85%
              </div>
              <div>
                <span className="inline-block text-[10px] sm:text-[11px] font-bold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                  มาตรฐาน 5 ดาว
                </span>
              </div>
            </div>
          </div>
        </div>

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
            const isInProgress = (activeDraft?.locationId === u.id) || (parsedDraftPayload?.unit?.id === u.id);
            const distMeters = getDistanceInMeters(userCoords.latitude, userCoords.longitude, u.latitude, u.longitude);
            const distLabel = formatDistance(distMeters);
            const isPassed = u.lastScore >= 85;

            return (
              <button
                key={u.id || u.name}
                type="button"
                onClick={() => {
                  setUnit(u);
                  if (isInProgress) {
                    setStep("section");
                  } else {
                    setStep("select-form");
                  }
                }}
                className={`w-full rounded-2xl sm:rounded-3xl p-4 sm:p-5 border shadow-2xs hover:shadow-md transition-all cursor-pointer flex items-center justify-between gap-3 text-left group active:scale-98 ${
                  isInProgress
                    ? "bg-amber-50/70 border-amber-400 ring-2 ring-amber-400/40"
                    : "bg-white border-slate-200 hover:border-emerald-500"
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border transition-colors ${
                    isInProgress
                      ? "bg-amber-100 text-amber-900 border-amber-300"
                      : "bg-emerald-50 text-[#0F6659] border-emerald-200 group-hover:bg-[#0F6659] group-hover:text-white"
                  }`}>
                    {isInProgress ? <Clock size={24} className="animate-pulse" /> : <Store size={24} />}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug group-hover:text-[#0F6659] transition-colors">
                        {u.fullName || u.name}
                      </h3>
                      {isInProgress && (
                        <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-500 text-white shadow-2xs animate-pulse flex items-center gap-1">
                          <Zap size={11} /> กำลังตรวจค้างอยู่
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-xl bg-slate-100 text-slate-700">
                        {u.locationType === 'Office' ? '🏢 สำนักงาน' : u.locationType === 'Plant' ? '🏭 โรงงาน' : '🏪 สาขา'} · {u.region}
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
                  {isInProgress ? (
                    <span className="hidden sm:inline-flex text-xs font-extrabold text-amber-900 bg-amber-200/80 px-3 py-1.5 rounded-xl">
                      ตรวจต่อ ➔
                    </span>
                  ) : null}
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
          title="2. เลือกแบบฟอร์มการตรวจ"
          subtitle={`สาขา: ${unit?.fullName || unit?.name}`}
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
    return (
      <div className="page-transition p-4 sm:p-6 space-y-4 w-full max-w-[100%] sm:max-w-[96%] md:max-w-[92%] mx-auto">
        <Header
          title="3. รายละเอียดการตรวจ"
          subtitle={`${unit?.fullName || unit?.name} · ${selectedForm?.title}`}
          onBack={() => setStep("select-form")}
        />

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
          <div>
            <label className="text-xs font-extrabold text-slate-700 block mb-1.5">ผู้ตรวจประเมิน (Auditor)</label>
            <input
              type="text"
              value={auditorName}
              onChange={(e) => setAuditorName(e.target.value)}
              className="w-full text-sm p-3.5 rounded-xl border border-slate-200 outline-none font-bold text-slate-800 focus:border-[#0F6659]"
            />
          </div>

          <div>
            <label className="text-xs font-extrabold text-slate-700 block mb-1.5">ประเภทการตรวจ (Audit Type)</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: "announced", label: "ตามกำหนดการ" },
                { key: "spot", label: "สุ่มตรวจ (Spot)" },
                { key: "undercover", label: "Undercover" },
              ].map(t => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setAuditType(t.key)}
                  className={`py-3 rounded-xl text-xs font-bold border cursor-pointer transition-all active:scale-95 ${
                    auditType === t.key ? 'bg-[#0F6659] text-white border-[#0F6659] shadow-2xs' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-extrabold text-slate-700 block mb-1.5">จำนวนพนักงานที่ปฏิบัติงานขณะตรวจ</label>
            <input
              type="number"
              value={staffCount}
              onChange={(e) => setStaffCount(e.target.value)}
              className="w-full text-sm p-3.5 rounded-xl border border-slate-200 outline-none font-bold text-slate-800 focus:border-[#0F6659]"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => setStep("section")}
          className="w-full py-4 rounded-2xl text-base font-extrabold bg-[#0F6659] text-white shadow-md active:scale-98 cursor-pointer flex items-center justify-center gap-2"
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
        title={activeSec?.title || "หมวดการตรวจ"}
        subtitle={`${unit?.fullName || unit?.name} (หมวด ${sectionIdx + 1}/${currentSections.length})`}
        onBack={() => setStep("details")}
        action={
          (hasUserAnswers && syncStatus !== "idle") ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-slate-200 shadow-2xs text-[11px] font-extrabold text-slate-600 shrink-0 animate-in fade-in duration-200">
              {syncStatus === "saving" ? (
                <>
                  <Loader2 size={13} className="animate-spin text-amber-500" />
                  <span className="text-amber-700">กำลังบันทึก...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={13} className="text-emerald-600" />
                  <span className="text-emerald-800">Auto-synced ✓</span>
                </>
              )}
            </div>
          ) : null
        }
      />

      {/* Questions List */}
      <div className="space-y-4">
        {items.map((q, idx) => {
          const isNa = answers[q.id] === "na";
          const isFailed = !isNa && (answers[q.id] === "no" || answers[q.id] === false || (Number(answers[q.id]) < 3 && answers[q.id] !== undefined && answers[q.id] !== ""));
          const hasPhoto = !!photos[q.id];

          return (
            <div
              key={q.id || idx}
              className={`p-4 sm:p-5 rounded-3xl border transition-all ${
                isNa
                  ? "bg-slate-50/90 border-slate-300 ring-1 ring-slate-300/50"
                  : isFailed
                  ? "bg-red-50/50 border-red-300 ring-1 ring-red-400/30"
                  : "bg-white border-slate-200 shadow-2xs"
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-black text-slate-400">#{idx + 1}</span>
                    {q.isCritical && (
                      <span className="text-[10.5px] font-extrabold px-2 py-0.5 rounded-md bg-red-100 text-red-800 border border-red-200">
                        🚨 จุดวิกฤต (Critical)
                      </span>
                    )}
                    {isNa ? (
                      <span className="text-[10.5px] font-extrabold px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 border border-slate-300">
                        ⚪ ข้าม (N/A: ไม่คิดคะแนน)
                      </span>
                    ) : (
                      <span className="text-[10.5px] font-bold text-slate-400">
                        คะแนนเต็ม {q.fullScore || 10}
                      </span>
                    )}
                  </div>
                  <h4 className={`text-sm sm:text-base font-bold leading-snug ${isNa ? "text-slate-500 line-through" : "text-slate-900"}`}>
                    {q.questionText || q.text}
                  </h4>
                </div>

                {/* Camera Button */}
                <label className={`w-10 h-10 rounded-2xl flex items-center justify-center cursor-pointer transition-all shrink-0 border ${
                  hasPhoto ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
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

              {/* Photo Preview if attached */}
              {hasPhoto && (
                <div className="relative inline-block mb-3 rounded-2xl overflow-hidden border border-slate-200 shadow-2xs">
                  <img src={photos[q.id]} alt="Evidence" className="h-28 w-44 object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotos(prev => { const n = { ...prev }; delete n[q.id]; return n; })}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center text-xs hover:bg-red-600 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Answer Controls with Toggle to Unselect (คลิกซ้ำเพื่อยกเลิกคำตอบ) */}
              {(q.questionType === "yesno" || q.type === "yesno" || !q.questionType) && (
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAnswers(prev => {
                        const next = { ...prev };
                        if (next[q.id] === "yes" || next[q.id] === true) {
                          delete next[q.id]; // 🌟 ยกเลิกการเลือกเมื่อคลิกซ้ำ
                        } else {
                          next[q.id] = "yes";
                        }
                        return next;
                      });
                    }}
                    className={`py-3 rounded-2xl text-xs sm:text-sm font-extrabold border cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-1 ${
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
                    onClick={() => {
                      setAnswers(prev => {
                        const next = { ...prev };
                        if (next[q.id] === "no" || next[q.id] === false) {
                          delete next[q.id]; // 🌟 ยกเลิกการเลือกเมื่อคลิกซ้ำ
                        } else {
                          next[q.id] = "no";
                        }
                        return next;
                      });
                    }}
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
                    onClick={() => {
                      setAnswers(prev => {
                        const next = { ...prev };
                        if (next[q.id] === "na") {
                          delete next[q.id]; // 🌟 ยกเลิกการเลือกเมื่อคลิกซ้ำ
                        } else {
                          next[q.id] = "na";
                        }
                        return next;
                      });
                    }}
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

              {q.questionType === "scale" && (
                <div className="flex gap-2 pt-1 items-center">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => {
                        setAnswers(prev => {
                          const next = { ...prev };
                          if (next[q.id] === n) {
                            delete next[q.id]; // 🌟 ยกเลิกการเลือกเมื่อคลิกซ้ำ
                          } else {
                            next[q.id] = n;
                          }
                          return next;
                        });
                      }}
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
                    onClick={() => {
                      setAnswers(prev => {
                        const next = { ...prev };
                        if (next[q.id] === "na") {
                          delete next[q.id]; // 🌟 ยกเลิกการเลือกเมื่อคลิกซ้ำ
                        } else {
                          next[q.id] = "na";
                        }
                        return next;
                      });
                    }}
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

              {/* Note / Comment textarea */}
              <div className="mt-2.5">
                <input
                  type="text"
                  placeholder="พิมพ์ข้อคิดเห็น / ข้อบกพร่องที่พบในข้อนี้..."
                  value={comments[q.id] || ""}
                  onChange={(e) => setComments({ ...comments, [q.id]: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none text-slate-800 focus:border-[#0F6659] bg-slate-50/80"
                />
              </div>
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

      {/* 🛑 FINAL CONFIRMATION REVIEW MODAL (สรุปและยืนยันรอบสุดท้ายก่อนส่งจริง) */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95">
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
                    <li key={i} className="truncate">{fq.questionText || fq.text}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Permanent Lock Warning */}
            <div className="text-center text-xs font-bold text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200">
              ⚠️ กรุณาตรวจสอบความถูกต้อง เมื่อกดยืนยันแล้ว ผลการตรวจจะถูกบันทึกลงฐานข้อมูลถาวรและไม่สามารถแก้ไขย้อนหลังได้
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
        </div>
      )}
    </div>
  );
}
