import React, { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { List, ClipboardCheck, Store, MapPin, Camera, CheckCircle2, XCircle, PenTool, Check, MessageSquare, Edit3, Megaphone, X, Maximize2, CheckCheck, ExternalLink, AlertTriangle, SlidersHorizontal, BarChart3, Wrench, Minus, History, ChevronRight, FileText, Calendar, User, FileSpreadsheet } from "lucide-react";


import { c, sans, mono, cardStyle } from "../../config/theme";
import { ROLES, NAV_BY_ROLE } from "../../config/roles";
import { TODAY, AUDIT_TYPES, AUDIT_TYPE_META, CAP_STATUS_MAP, REGION_LINES, BRAND_LINES } from "../../config/constants";
import { TopBarContext } from "../../context/TopBarContext";
import { DataContext } from "../../context/DataContext";
import { exportToExcel } from "../../utils/exportToExcel";
import api, { getFullImageUrl } from "../../config/api";

import ModalWrapper from "../../shared/ModalWrapper";
import Header from "../../shared/Header";
import Section from "../../shared/Section";
import ScoreRing from "../../shared/ScoreRing";
import HistoryList from "../../shared/HistoryList";
import ErrorBoundary from "../../shared/ErrorBoundary";
import CapSubmissionModal from "../../modals/CapSubmissionModal";
import ViewCapEvidenceModal from "../../modals/ViewCapEvidenceModal";
import AuditEditLogsModal from "../../modals/AuditEditLogsModal";
import EditAuditRecordModal from "../../modals/EditAuditRecordModal";

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
  const title = sec?.title || q?.sectionTitle || "";
  if (title) {
    if (title.includes("สะอาด") || title.includes("สุขอนามัย") || title.includes("CLN")) return "ความสะอาด";
    if (title.includes("เอกสาร") || title.includes("DOC")) return "เอกสาร";
    if (title.includes("บริการ") || title.includes("SVC")) return "การบริการ";
    if (title.includes("คุณภาพ") || title.includes("QLT")) return "คุณภาพสินค้า";
    if (title.includes("กระบวนการ") || title.includes("โรงงาน") || title.includes("OPS") || title.includes("GMP")) return "กระบวนการทำงาน";
  }
  const text = q?.text || q?.questionText || "";
  if (text) {
    if (text.includes("สะอาด") || text.includes("ฆ่าเชื้อ") || text.includes("ล้างมือ")) return "ความสะอาด";
    if (text.includes("เอกสาร") || text.includes("Log") || text.includes("FIFO") || text.includes("บันทึก") || text.includes("รายงาน")) return "เอกสาร";
    if (text.includes("บริการ") || text.includes("ทักทาย") || text.includes("เสิร์ฟ")) return "การบริการ";
    if (text.includes("คุณภาพ") || text.includes("อุณหภูมิ") || text.includes("TPM")) return "คุณภาพสินค้า";
    if (text.includes("กระบวนการ") || text.includes("เครื่องจักร") || text.includes("พาหะ") || text.includes("แต่งกาย") || text.includes("หนีไฟ")) return "กระบวนการทำงาน";
  }
  return "ความสะอาด";
};

export default function AuditHistoryDetail({ unitName, record = {}, onBack }) {
  const { locations: allLocations, forms = [], currentUser, refreshData } = React.useContext(DataContext);
  const [activeTab, setActiveTab] = useState("responses"); // 'responses' | 'overview' | 'photos' | 'sign'
  const [capSubmissions, setCapSubmissions] = useState({});
  const [disputeSubmitted, setDisputeSubmitted] = useState(record.status === "Disputed");
  const [submittingCapQuestion, setSubmittingCapQuestion] = useState(null);
  const [viewingCap, setViewingCap] = useState(null);
  const [previewPhoto, setPreviewPhoto] = useState(null);

  // 🌟 Local Record State for Immediate UI Updates on Edit
  const [currentRecord, setCurrentRecord] = useState(record);
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

  // Normalized audit record attributes
  const isBackdated = Boolean(currentRecord.isBackdated);
  const score = typeof currentRecord.score === "number" ? currentRecord.score : typeof currentRecord.percentageScore === "number" ? Math.round(currentRecord.percentageScore) : 0;
  const passingScore = currentRecord.passingScore || currentRecord.surveyForm?.passingScore || 85;
  const dateStr = currentRecord.date || (currentRecord.auditDate ? new Date(currentRecord.auditDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) : "-");
  const actualInspectDateStr = currentRecord.startedAt ? new Date(currentRecord.startedAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) : dateStr;
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
    if (currentRecord?.metadataValues && typeof currentRecord.metadataValues === "object") {
      return currentRecord.metadataValues;
    }
    if (currentRecord?.metadataValuesJson) {
      try {
        return JSON.parse(currentRecord.metadataValuesJson);
      } catch (e) {}
    }
    return {};
  }, [currentRecord]);

  // Location and GPS Metadata
  const matchedLocation = useMemo(() => {
    return allLocations.find(l => (currentRecord.locationId && l.id === currentRecord.locationId) || l.name === locationTitle || l.fullName === locationTitle);
  }, [allLocations, currentRecord.locationId, locationTitle]);

  const branchAddress = currentRecord.location?.address || matchedLocation?.address || "-";
  const startLat = currentRecord.startLatitude || matchedLocation?.latitude;
  const startLng = currentRecord.startLongitude || matchedLocation?.longitude;
  const endLat = currentRecord.endLatitude || matchedLocation?.latitude;
  const endLng = currentRecord.endLongitude || matchedLocation?.longitude;
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
      // 1. Check if we have the matching Form schema in DataContext
      const matchedForm = (forms || []).find(f => 
        (currentRecord.surveyFormId && f.id === currentRecord.surveyFormId) ||
        (currentRecord.formId && f.id === currentRecord.formId) ||
        (f.title && (f.title === currentRecord.surveyFormTitle || f.title === currentRecord.formName || f.title === currentRecord.form))
      );

      if (matchedForm && Array.isArray(matchedForm.sections) && matchedForm.sections.length > 0) {
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

            if (!res && currentRecord.responses[runningNum - 1]) {
              res = currentRecord.responses[runningNum - 1];
            }
            res = res || {};

            const qText = item.questionText || item.text || res.questionText || `ข้อตรวจที่ ${runningNum}`;
            const qType = (res.questionType || item.questionType || item.type || "YESNO").toLowerCase();
            const fullSc = res.fullScore !== undefined ? res.fullScore : (item.fullScore || 10);
            const isCrit = res.isCritical !== undefined ? res.isCritical : (item.isCritical || item.critical || false);
            const isNa = !!(res.isNa || res.rawAnswer === "na" || res.answerValue === "na");
            const isPass = isNa ? true : (res.isPassed !== undefined ? res.isPassed : (res.scoreGiven > 0));
            const calculatedScore = isNa ? 0 : (res.scoreGiven !== undefined ? res.scoreGiven : (isPass ? fullSc : 0));

            secQuestions.push({
              num: runningNum++,
              id: `q_${res.id || item.id || runningNum}`,
              text: qText,
              type: qType,
              answer: qType === "scale" ? (res.scoreGiven !== undefined ? res.scoreGiven : (isPass ? 5 : 3)) : isPass,
              scoreGiven: calculatedScore,
              scaleScore: res.scaleScore || (qType === "scale" && res.scoreGiven !== undefined ? Math.round((res.scoreGiven / fullSc) * 5) : null),
              fullScore: fullSc,
              isCritical: isCrit,
              isNa: isNa,
              categoryName: item.categoryName || item.category || res.categoryName || res.surveyItem?.categoryName,
              categoryCode: item.categoryCode || res.categoryCode || res.surveyItem?.categoryCode,
              sectionTitle: sec.title,
              note: (res.notes && res.notes.trim()) ? res.notes.trim() : null,
              hasPhoto: (res.images && res.images.length > 0) || (!isPass && !isNa && res.hasPhoto),
              images: res.images || []
            });
          });

          if (secQuestions.length > 0) {
            resultSections.push({
              title: sec.title || `หมวดที่ ${sIdx + 1}`,
              orderIndex: sec.orderIndex !== undefined ? sec.orderIndex : sIdx + 1,
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
        const isCrit = res.isCritical !== undefined ? res.isCritical : (res.surveyItem?.isCritical || false);
        const fullSc = res.fullScore !== undefined ? res.fullScore : (res.surveyItem?.fullScore || 10);
        const isNa = !!(res.isNa || res.rawAnswer === "na" || res.answerValue === "na");
        const isPass = isNa ? true : (res.isPassed !== undefined ? res.isPassed : (res.scoreGiven > 0));
        const calculatedScore = isNa ? 0 : (res.scoreGiven !== undefined ? res.scoreGiven : (isPass ? fullSc : 0));

        if (!sectionsMap.has(secName)) {
          sectionsMap.set(secName, {
            title: secName,
            orderIndex: res.sectionOrderIndex !== undefined ? res.sectionOrderIndex : sectionsMap.size + 1,
            questions: []
          });
        }

        sectionsMap.get(secName).questions.push({
          num: runningNum++,
          id: `q_${res.id || idx}`,
          text: qText,
          type: qType,
          answer: qType === "scale" ? (res.scoreGiven !== undefined ? res.scoreGiven : (isPass ? 5 : 3)) : isPass,
          scoreGiven: calculatedScore,
          scaleScore: res.scaleScore || (qType === "scale" && res.scoreGiven !== undefined ? Math.round((res.scoreGiven / fullSc) * 5) : null),
          fullScore: fullSc,
          isCritical: isCrit,
          isNa: isNa,
          categoryName: res.categoryName || res.surveyItem?.categoryName,
          categoryCode: res.categoryCode || res.surveyItem?.categoryCode,
          sectionTitle: secName,
          note: (res.notes && res.notes.trim()) ? res.notes.trim() : null,
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
      const percent = cat.max > 0 ? Math.round((cat.score / cat.max) * 100) : 100;
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

  const sections = categoryScores;

  // Issues List
  const issues = useMemo(() => {
    const list = [];
    formBreakdown.forEach(sec => {
      sec.questions.forEach(q => {
        const full = Number(q.fullScore) || 10;
        const currentSc = q.scoreGiven !== undefined ? Number(q.scoreGiven) : (typeof q.answer === 'number' ? q.answer : 0);
        const isPass = q.type === "yesno" 
          ? q.answer === true 
          : q.type === "scale" 
            ? (currentSc >= (full * 0.7)) 
            : true;

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
          q.images.forEach((img, iIdx) => {
            const url = img.imageUrl || img.url || img;
            if (url) {
              list.push({
                id: img.id || `${q.id}_img_${iIdx}`,
                url: url,
                qNum: q.num,
                qText: q.text,
                secTitle: sec.title,
                isPass: q.isNa ? true : (q.type === "yesno" ? q.answer === true : (q.scoreGiven >= (q.fullScore * 0.7))),
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

  // Header action buttons memoized cleanly
  const headerAction = useMemo(() => (
    <div className="flex items-center gap-2">
      {editLogsCount > 0 && (
        <button
          type="button"
          onClick={() => setShowEditLogsModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300/80 text-xs font-bold shadow-2xs transition-all active:scale-95 cursor-pointer"
          title="ดูประวัติการแก้ไขทั้งหมด"
        >
          <History size={13} className="text-amber-700" />
          <span>ประวัติแก้ไข ({editLogsCount})</span>
        </button>
      )}
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
  ), [editLogsCount, canEditAudit]);

  return (
    <div className="page-transition p-4 sm:p-6 space-y-4 w-full max-w-[100%] sm:max-w-[96%] md:max-w-[92%] mx-auto pb-12">
      <Header 
        title="ผลการตรวจ"
        subtitle="รายละเอียดผลการตรวจ"
        onBack={onBack}
        isAudit={true}
        action={headerAction}
      />
      
      {/* 🌟 1. ALL-IN-ONE SLEEK HERO SUMMARY CARD (ตรงตามแบบ Mockup) */}
      <div className="rounded-3xl p-5 sm:p-6 bg-white border border-slate-200/90 shadow-2xs space-y-4">
        {/* Top Section: Score Ring, Numbers, Status Pill, and Export Excel Button */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4 sm:gap-5 min-w-0">
            {/* Circular Gauge Ring with 12 o'clock notch */}
            <div className="relative flex items-center justify-center w-[74px] h-[74px] sm:w-[82px] sm:h-[82px] rounded-full border-[5.5px] border-[#0F6659] shadow-2xs shrink-0 bg-white font-mono font-black text-xl sm:text-2xl text-slate-900 select-none">
              {score}%
              <div className="absolute -top-[5.5px] left-1/2 -translate-x-1/2 w-2 h-2 bg-white rounded-full" />
            </div>

            {/* Score Text & Status Pill */}
            <div className="min-w-0">
              <div className="text-3xl sm:text-4xl font-black text-slate-900 font-mono tracking-tight leading-none">
                {score}%
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
                  <CheckCircle2 size={13} className="text-white shrink-0" />
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
              onClick={() => {
                exportToExcel({
                  mode: "detailed_questions",
                  targetUnit: matchedLocation || { id: currentRecord?.locationId, name: locationTitle, fullName: locationTitle },
                  locations: allLocations,
                  auditRecords: [currentRecord]
                });
              }}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#0F6659] hover:bg-[#0D5449] text-white flex items-center justify-center shadow-2xs hover:shadow-sm transition-all active:scale-95 cursor-pointer"
              title="ส่งออกรายงาน Excel"
            >
              <FileSpreadsheet size={18} />
            </button>
          </div>
        </div>

        {/* Second Section: Defect Banner (Full Width) */}
        {issues.length > 0 ? (
          <div className="rounded-2xl p-3 sm:p-3.5 bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2.5 shadow-2xs">
            <AlertTriangle size={18} className="text-rose-600 shrink-0" />
            <span className="text-sm font-extrabold">พบข้อบกพร่อง {issues.length} ข้อ</span>
          </div>
        ) : (
          <div className="rounded-2xl p-3 sm:p-3.5 bg-[#F0FDF4] border border-emerald-200/80 text-[#0F6659] flex items-center gap-2.5 shadow-2xs">
            <CheckCircle2 size={18} className="text-[#0F6659] shrink-0" />
            <span className="text-xs sm:text-base font-extrabold">ไม่พบข้อบกพร่อง</span>
          </div>
        )}

        {/* Third Section: Metadata Rows (3 Rows with dividers and mint icons) */}
        <div className="rounded-2xl bg-[#F8FAF9] border border-slate-100/90 px-1.5 py-1.5 sm:px-3 sm:py-3 divide-y divide-slate-100/90 text-xs sm:text-sm mt-3.5 sm:mt-4">
          {/* Row 1: แบบฟอร์ม */}
          <div className="flex items-center gap-1.5 sm:gap-3 pb-2 sm:pb-4">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#0F6659] flex items-center justify-center shrink-0 shadow-2xs">
              <FileText size={16} />
            </div>
            <span className="text-slate-400 font-semibold w-[64px] sm:w-[72px] shrink-0">แบบฟอร์ม</span>
            <span className="font-extrabold text-slate-800 truncate flex-1 min-w-0" title={formTitle}>
              {formTitle}
            </span>
          </div>

          {/* Row 2: วันที่ตรวจ */}
          <div className="flex items-center gap-1.5 sm:gap-3 py-2 sm:py-4">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#0F6659] flex items-center justify-center shrink-0 shadow-2xs">
              <Calendar size={16} />
            </div>
            <span className="text-slate-400 font-semibold w-[64px] sm:w-[72px] shrink-0">วันที่ตรวจ</span>
            <span className="font-extrabold text-slate-800 truncate flex-1 min-w-0">
              {isBackdated ? `${actualInspectDateStr} (${startedTimeStr} - ${submittedTimeStr})` : dateStr}
            </span>
          </div>

          {/* Row 3: ผู้ตรวจ */}
          <div className="flex items-center gap-1.5 sm:gap-3 pt-2 sm:pt-4">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#0F6659] flex items-center justify-center shrink-0 shadow-2xs">
              <User size={16} />
            </div>
            <span className="text-slate-400 font-semibold w-[64px] sm:w-[72px] shrink-0">ผู้ตรวจ</span>
            <span className="font-extrabold text-slate-800 truncate flex-1 min-w-0" title={auditorName}>
              {auditorName}
            </span>
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
                    บันทึกนี้ได้รับการแก้ไข
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-amber-200/80 text-amber-950 text-[11px] font-black shadow-2xs">
                    {editLogsCount} ครั้ง
                  </span>
                </div>
                <div className="text-[11.5px] text-amber-800/85 font-medium mt-0.5 leading-normal">
                  มีบันทึกประวัติการปรับปรุงคะแนนและเหตุผลกำกับ
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
          { key: "responses", label: "ผลตรวจ", icon: ClipboardCheck },
          { key: "overview", label: "คะแนน", icon: BarChart3 },
          { key: "photos", label: "รูปภาพ", icon: Camera },
          { key: "sign", label: "ลายเซ็น", icon: PenTool },
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
            const totalQ = sec.questions.length;
            const passedQ = sec.questions.filter(q => {
              if (q.type === "yesno") return q.answer === true;
              if (q.type === "scale") return q.answer >= 4;
              return true;
            }).length;
            const secPassed = passedQ === totalQ;

            return (
              <div 
                key={secIdx} 
                className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-2xs"
              >
                {/* CATEGORY HEADER */}
                <div className="px-4 sm:px-5 py-3 bg-[#F4F9F6] border-b border-emerald-100 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-full bg-emerald-100 text-[#0F6659] font-black text-xs flex items-center justify-center shrink-0">
                      {secIdx + 1}
                    </span>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900">
                      {sec.title}
                    </h3>
                  </div>

                  {/* Section Status Badge */}
                  <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                    secPassed 
                      ? "bg-emerald-50 text-[#0F6659] border-emerald-200" 
                      : "bg-amber-50 text-amber-900 border-amber-200"
                  }`}>
                    {secPassed ? `ผ่านครบ (${passedQ}/${totalQ})` : `ตก ${totalQ - passedQ} ข้อ`}
                  </span>
                </div>

                {/* QUESTIONS CONTAINER */}
                <div className="p-3.5 sm:p-5 space-y-3">
                  {sec.questions.map((q) => {
                    const full = Number(q.fullScore) || 10;
                    const currentSc = q.scoreGiven !== undefined ? Number(q.scoreGiven) : (typeof q.answer === 'number' ? q.answer : (q.answer === true ? full : 0));
                    const isPass = q.isNa
                      ? true
                      : q.type === "yesno" 
                      ? q.answer === true 
                      : q.type === "scale" 
                        ? (currentSc >= (full * 0.7)) 
                        : true;
                    const hasCap = !q.isNa && !isPass && !!capSubmissions[q.id];

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
                            <div>
                              <div className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                                {q.text}
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                <span className="inline-block text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                                  {getQuestionCategory(q, sec)}
                                </span>
                                {q.isCritical && (
                                  <span className="inline-block text-[10.5px] font-extrabold px-2 py-0.5 rounded-md bg-red-100 text-red-700 border border-red-200">
                                    ⚠️ สำคัญ
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* 🌟 มุมขวาบนของข้อ: แสดงเป็นคะแนนเสมอ */}
                          <div className="shrink-0">
                            <span className={`inline-flex items-center gap-1 text-xs sm:text-sm font-bold px-3 py-1 rounded-full border shadow-2xs ${
                              q.isNa
                                ? "bg-slate-100 text-slate-500 border-slate-200"
                                : isPass
                                ? "bg-emerald-50 text-[#0F6659] border-emerald-200"
                                : "bg-red-50 text-red-700 border-red-300"
                             } font-mono`}>
                              <span>{q.scoreGiven !== undefined ? q.scoreGiven : (isPass ? full : 0)} / {full}</span>
                            </span>
                          </div>
                        </div>

                        {/* 🌟 แสดงรูปแบบปุ่มเหมือนตอนตรวจหน้าร้าน (Live Audit) แต่เป็นโทนสีเทาสุขุมแบบ Disabled (กดแก้ไขไม่ได้) */}
                        {q.type === "scale" ? (
                          <div className="pt-1 space-y-1.5 pointer-events-none select-none cursor-default">
                            <div className="flex gap-1.5 items-center w-full">
                              {[1, 2, 3, 4, 5].map((n) => {
                                const selectedScale = q.scaleScore || (typeof q.answer === 'number' && q.answer <= 5 ? q.answer : Math.round((currentSc / full) * 5));
                                const isSelected = !q.isNa && (selectedScale === n);
                                return (
                                  <div
                                    key={n}
                                    className={`flex-1 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-black border flex items-center justify-center transition-all ${
                                      isSelected
                                        ? n >= 4
                                          ? 'bg-slate-200/90 text-emerald-800 border-emerald-300/80 font-black'
                                          : n === 3
                                          ? 'bg-slate-200/90 text-amber-800 border-amber-300/80 font-black'
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
                              <span>ผ่าน / Yes</span>
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
                              <span>ไม่ผ่าน / No</span>
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
                              <span>ข้าม (N/A)</span>
                            </div>
                          </div>
                        )}

                        {/* 🌟 ส่วนคอมเม้น: ถ้าไม่มีคอมเม้นไม่ต้องแสดงกล่องบันทึกผู้ตรวจ */}
                        {q.note && q.note.trim().length > 0 && (
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
                              <span className="text-[11px] font-bold text-slate-400">คลิกที่รูปเพื่อเปิดดู</span>
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

                        {/* Direct CAP Action Button */}
                        {!isPass && (
                          <div className="pt-2 border-t border-slate-100 flex justify-end">
                            {hasCap ? (
                              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-300 px-3 py-1.5 rounded-xl">
                                <CheckCheck size={16} className="text-emerald-700" />
                                <span className="text-xs font-bold text-emerald-900">ส่งแก้งานแล้ว</span>
                                <button
                                  type="button"
                                  onClick={() => setViewingCap(capSubmissions[q.id])}
                                  className="text-xs font-bold text-emerald-800 underline ml-1 cursor-pointer"
                                >
                                  ดูหลักฐาน
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setSubmittingCapQuestion(q)}
                                className="px-4 py-2 rounded-2xl bg-[#0F6659] text-xs sm:text-sm font-bold text-white cursor-pointer shadow-xs active:scale-95 flex items-center gap-1.5"
                              >
                                <Wrench size={15} />
                                <span>ส่งหลักฐาน CAP ➔</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          }))}
        </div>
      )}

      {/* CAP SUBMISSION MODAL */}
      {submittingCapQuestion && (
        <CapSubmissionModal
          question={submittingCapQuestion}
          unitName={locationTitle}
          onSave={(newCap) => {
            setCapSubmissions(prev => ({ ...prev, [newCap.qId]: newCap }));
          }}
          onClose={() => setSubmittingCapQuestion(null)}
        />
      )}

      {/* VIEW CAP EVIDENCE MODAL */}
      {viewingCap && (
        <ViewCapEvidenceModal
          cap={viewingCap}
          onClose={() => setViewingCap(null)}
        />
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
                  {previewPhoto.secTitle ? `${previewPhoto.secTitle} • ` : ""}บันทึกเมื่อ: {previewPhoto.uploadedAt || dateStr} • {locationTitle}
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
                  {previewPhoto.isPass ? '✓ สภาพเรียบร้อย (Standard)' : '⚠️ พบข้อบกพร่อง (Defect)'}
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
          <Section title="คะแนนแยกตามหมวดหมู่">
            <div className="rounded-2xl overflow-hidden shadow-2xs" style={cardStyle}>
              {categoryScores.map((s, i) => {
                const isPassing = s.percent >= (currentRecord?.passingScore || 85);
                return (
                  <div key={s.title} className="px-4 py-3.5" style={{ borderBottom: i < categoryScores.length - 1 ? `1px solid ${c.border}` : "none" }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-slate-800">{s.title}</span>
                      <span className="text-xs font-bold" style={{ color: c.muted, fontFamily: mono }}>{s.score}/{s.max} ({s.percent}%)</span>
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
          </Section>

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
            <span className="text-xs text-slate-500">แยกหมวดหมู่ชัดเจน</span>
          </div>

          {/* Album 1: On-site Inspection Photos */}
          <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900">📷 อัลบั้มรูปตรวจหน้างาน (Inspection Photos)</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${allInspectionPhotos.length > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                  {allInspectionPhotos.length > 0 ? `${allInspectionPhotos.length} รูปภาพที่แนบ` : 'ไม่มีรูปภาพแนบ'}
                </span>
              </div>
              <span className="text-xs text-slate-400">บันทึกโดยผู้ตรวจ</span>
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
                        {p.isPass ? 'Standard (สภาพเรียบร้อย)' : 'Defect (ข้อบกพร่อง)'}
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900">🛠️ อัลบั้มรูปหลักฐานการแก้ไข (CAP After-Photos)</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  {Object.keys(capSubmissions).length > 0 ? `${Object.keys(capSubmissions).length} รูปส่งแก้ไข` : 'รอส่งมอบหลักฐาน'}
                </span>
              </div>
              <span className="text-xs text-slate-400">ส่งมอบโดยสาขา</span>
            </div>

            {Object.keys(capSubmissions).length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.values(capSubmissions).map((cap, i) => (
                  <div key={i} className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-2">
                    <div className="h-36 rounded-xl bg-emerald-100/70 flex flex-col items-center justify-center text-emerald-800 relative overflow-hidden border border-emerald-300">
                      {cap.imageUrl ? (
                        <img 
                          src={getFullImageUrl(cap.imageUrl)} 
                          alt="CAP after evidence" 
                          className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform" 
                          onClick={() => setPreviewPhoto({
                            url: getFullImageUrl(cap.imageUrl),
                            qNum: cap.qNum || i + 1,
                            qText: cap.qText || "หลักฐานการแก้ไข",
                            secTitle: "งานแก้ไข CAP",
                            isPass: true,
                            note: cap.actionText,
                            uploadedAt: cap.submittedAt || dateStr
                          })}
                        />
                      ) : (
                        <>
                          <CheckCircle2 size={28} className="text-emerald-700 mb-1" />
                          <span className="text-xs font-bold text-emerald-950">รูปถ่ายหลังแก้ไข ({locationTitle})</span>
                          <span className="text-xs text-emerald-700">ส่งมอบเมื่อ {cap.submittedAt}</span>
                        </>
                      )}
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-emerald-700 text-white text-[9.5px] font-bold">
                        ✓ Corrected (หลังแก้ไข)
                      </div>
                    </div>
                    <div className="text-xs text-emerald-950 font-medium">
                      💬 <b>การดำเนินการ:</b> "{cap.actionText}"
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 rounded-2xl bg-slate-50 border border-dashed text-center text-xs text-slate-400 font-medium">
                {score < 85 
                  ? "ยังไม่มีการส่งรูปถ่ายหลักฐานการแก้ไข (สามารถกดปุ่มส่งงานแก้ไขในแท็บคำตอบได้)" 
                  : "รอบการตรวจนี้ผ่านเกณฑ์มาตรฐานครบถ้วน ไม่จำเป็นต้องส่งรูปแก้งาน"}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: SIGNATURES & ACKNOWLEDGEMENT */}
      {activeTab === "sign" && (
        <div className="space-y-4 animate-in fade-in duration-200">
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

          {/* Custom Audit Metadata Information Card */}
          {Object.keys(parsedMetadataValues).length > 0 && (
            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 border-b border-slate-100 pb-2">
                <SlidersHorizontal size={15} className="text-[#0F6659]" />
                <span>ข้อมูลและตัวแปรเฉพาะรอบการตรวจ (Custom Audit Details)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(parsedMetadataValues).map(([key, val]) => {
                  if (val === undefined || val === null || val === "" || key === "auditor" || key === "audit_type" || key === "staff_count") return null;
                  return (
                    <div key={key} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <div className="text-[11px] font-bold text-slate-500 capitalize">{key.replace(/_/g, ' ')}</div>
                      <div className="text-sm font-extrabold text-slate-800 mt-0.5">
                        {typeof val === "boolean" ? (val ? "✓ ใช่ (Yes)" : "ไม่ใช่ (No)") : String(val)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
                <div className="space-y-0.5">
                  <div className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                    <span>1. จุดเริ่มตรวจ (Start Inspection)</span>
                  </div>
                  <div className="text-[11.5px] text-slate-500 font-medium">
                    เวลาเริ่ม: <span className="font-bold text-slate-700">{startedTimeStr}</span> · พิกัด: <span className="font-bold text-slate-700 font-mono">{startLat && startLng ? `${Number(startLat).toFixed(6)}, ${Number(startLng).toFixed(6)}` : "-"}</span>
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
                  <div className="text-center p-4 text-slate-400 space-y-1">
                    <MapPin size={24} className="mx-auto text-slate-300" />
                    <div className="text-xs font-bold">ไม่มีข้อมูลพิกัด GPS จุดเริ่มตรวจ</div>
                  </div>
                )}
              </div>
            </div>

            {/* 🔵 MAP 2: จุดส่งผลตรวจ (Submit Location) */}
            <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                    <span>2. จุดส่งผลตรวจ (Submit Inspection)</span>
                  </div>
                  <div className="text-[11.5px] text-slate-500 font-medium">
                    เวลาส่งผล: <span className="font-bold text-slate-700">{submittedTimeStr}</span> · พิกัด: <span className="font-bold text-slate-700 font-mono">{endLat && endLng ? `${Number(endLat).toFixed(6)}, ${Number(endLng).toFixed(6)}` : "-"}</span>
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
                  <div className="text-center p-4 text-slate-400 space-y-1">
                    <MapPin size={24} className="mx-auto text-slate-300" />
                    <div className="text-xs font-bold">ไม่มีข้อมูลพิกัด GPS จุดส่งผลตรวจ</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Verification Banner */}
          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-center gap-2.5 text-xs font-bold text-emerald-900 shadow-2xs">
            <CheckCircle2 size={18} className="text-[#0F6659] shrink-0" />
            <span>ระบบได้ทำการบันทึกและตรวจสอบตำแหน่งดาวเทียม (GPS Geofence Verified) ทั้งตอนเริ่มตรวจและส่งผลตรวจเรียบร้อยแล้ว</span>
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
    </div>
  );
}
