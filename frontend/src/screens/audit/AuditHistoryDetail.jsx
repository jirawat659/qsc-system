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
  Wrench, Square, Minus, Building2, ArrowUpDown, History, Shield, Info, HelpCircle
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, BarChart, Bar, ReferenceLine, LineChart, Line, Legend, Cell, PieChart, Pie
} from "recharts";

import { c, sans, mono, cardStyle } from "../../config/theme";
import { ROLES, NAV_BY_ROLE } from "../../config/roles";
import { TODAY, AUDIT_TYPES, AUDIT_TYPE_META, CAP_STATUS_MAP, REGION_LINES, BRAND_LINES } from "../../config/constants";
import { TopBarContext } from "../../context/TopBarContext";
import { DataContext } from "../../context/DataContext";
import { exportToExcel } from "../../utils/exportToExcel";
import { getFullImageUrl } from "../../config/api";

import ModalWrapper from "../../shared/ModalWrapper";
import Header from "../../shared/Header";
import Section from "../../shared/Section";
import ScoreRing from "../../shared/ScoreRing";
import HistoryList from "../../shared/HistoryList";
import ErrorBoundary from "../../shared/ErrorBoundary";
import CapSubmissionModal from "../../modals/CapSubmissionModal";
import ViewCapEvidenceModal from "../../modals/ViewCapEvidenceModal";


export default function AuditHistoryDetail({ unitName, record = {}, onBack }) {
  const { locations, forms = [] } = React.useContext(DataContext);
  const [activeTab, setActiveTab] = useState("responses"); // 'responses' | 'overview' | 'photos' | 'sign'
  const [capSubmissions, setCapSubmissions] = useState({});
  const [disputeSubmitted, setDisputeSubmitted] = useState(record.status === "Disputed");
  const [submittingCapQuestion, setSubmittingCapQuestion] = useState(null);
  const [viewingCap, setViewingCap] = useState(null);
  const [previewPhoto, setPreviewPhoto] = useState(null);

  // Normalized audit record attributes
  const score = typeof record.score === "number" ? record.score : typeof record.percentageScore === "number" ? Math.round(record.percentageScore) : 0;
  const dateStr = record.date || (record.auditDate ? new Date(record.auditDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) : "-");
  const auditorName = record.auditor || record.auditorName || record.primaryAuditor?.fullName || "-";
  const formTitle = record.form || record.formName || record.surveyFormTitle || record.surveyForm?.title || "-";
  const passed = record.isPassed !== undefined ? record.isPassed : (score >= 85 && !record.hasCriticalDefect);
  const hasCritical = record.hasCriticalDefect || (record.responses && record.responses.some(r => r.isCritical && !r.isPassed));
  const locationTitle = unitName || record.unitFullName || record.locationName || record.location?.name || "-";
  const managerName = record.auditeeName || record.auditeeUser?.fullName || "-";
  const staffCount = record.staffCount || 0;
  const auditType = (record.auditType === "unannounced" || record.auditType === "spot") 
    ? "นอกกำหนดการ" 
    : (record.auditType === "undercover" ? "ปลอมตัว" : "ตามกำหนดการ");

  const parsedMetadataValues = useMemo(() => {
    if (record?.metadataValues && typeof record.metadataValues === "object") {
      return record.metadataValues;
    }
    if (record?.metadataValuesJson) {
      try {
        return JSON.parse(record.metadataValuesJson);
      } catch (e) {}
    }
    return {};
  }, [record]);

  // Location and GPS Metadata
  const matchedLocation = useMemo(() => {
    return locations.find(l => (record.locationId && l.id === record.locationId) || l.name === locationTitle || l.fullName === locationTitle);
  }, [locations, record.locationId, locationTitle]);

  const branchAddress = record.location?.address || matchedLocation?.address || "-";
  const startLat = record.startLatitude || matchedLocation?.latitude;
  const startLng = record.startLongitude || matchedLocation?.longitude;
  const endLat = record.endLatitude || matchedLocation?.latitude;
  const endLng = record.endLongitude || matchedLocation?.longitude;
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

  const startedTimeStr = formatTimeWithSeconds(record.startedAt, "-");
  const submittedTimeStr = formatTimeWithSeconds(record.submittedAt, "-");

  // Dynamic Form Question Breakdown
  const formBreakdown = useMemo(() => {
    // If real responses exist from DB API
    if (record.responses && Array.isArray(record.responses) && record.responses.length > 0) {
      // 1. Check if we have the matching Form schema in DataContext
      const matchedForm = (forms || []).find(f => 
        (record.surveyFormId && f.id === record.surveyFormId) ||
        (record.formId && f.id === record.formId) ||
        (f.title && (f.title === record.surveyFormTitle || f.title === record.formName || f.title === record.form))
      );

      if (matchedForm && Array.isArray(matchedForm.sections) && matchedForm.sections.length > 0) {
        let runningNum = 1;
        const resultSections = [];

        matchedForm.sections.forEach((sec, sIdx) => {
          const secQuestions = [];

          (sec.items || []).forEach((item) => {
            // Find corresponding response
            const res = record.responses.find(r => 
              (r.surveyItemId && r.surveyItemId === item.id) ||
              (r.id && r.id === item.id) ||
              (r.questionText && item.questionText && r.questionText.trim() === item.questionText.trim()) ||
              (r.questionText && item.text && r.questionText.trim() === item.text.trim())
            ) || {};

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

      record.responses.forEach((res, idx) => {
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
          note: (res.notes && res.notes.trim()) ? res.notes.trim() : null,
          hasPhoto: (res.images && res.images.length > 0) || (!isPass && !isNa && res.hasPhoto),
          images: res.images || []
        });
      });

      return Array.from(sectionsMap.values()).sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
    }

    // No responses found from database
    return [];
  }, [record, forms]);

  // Calculated Sections Score Breakdown
  const sections = useMemo(() => {
    return formBreakdown.map(sec => {
      let earned = 0;
      let maxScore = 0;

      sec.questions.forEach(q => {
        const full = Number(q.fullScore) || 10;
        maxScore += full;

        if (q.scoreGiven !== undefined) {
          earned += Number(q.scoreGiven) || 0;
        } else if (q.type === "scale") {
          const rating = Number(q.answer) || 5;
          earned += rating <= 5 ? (rating / 5) * full : rating;
        } else if (q.answer === true) {
          earned += full;
        }
      });

      return {
        title: sec.title,
        score: Math.round(earned),
        max: maxScore,
        percent: maxScore > 0 ? Math.round((earned / maxScore) * 100) : 100
      };
    });
  }, [formBreakdown]);

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

  return (
    <div className="page-transition p-4 sm:p-6 space-y-4 w-full max-w-[100%] sm:max-w-[96%] md:max-w-[92%] mx-auto pb-12">
      <Header title={`ผลการตรวจ: ${locationTitle}`} subtitle={`รอบตรวจวันที่ ${dateStr} · ผู้ตรวจ: ${auditorName}`} onBack={onBack} />
      
      {/* 🌟 1. ALL-IN-ONE SLEEK HERO SUMMARY CARD */}
      <div className="rounded-3xl p-4 sm:p-5 bg-white border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Left: Score Ring & Verdict */}
        <div className="flex items-center gap-4 min-w-0">
          <ScoreRing score={score} size={54} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900" style={{ fontFamily: mono }}>
                {score}%
              </span>
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-lg ${passed ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-900 border border-amber-200'}`}>
                {passed ? "✓ ผ่านเกณฑ์มาตรฐาน" : hasCritical ? "🚨 ตกเกณฑ์วิกฤต (Critical)" : "⚠️ ต้องส่งงานแก้ไข (CAP)"}
              </span>
            </div>
            <div className="text-xs text-slate-500 font-medium mt-0.5 space-y-0.5">
              <div>เกณฑ์ผ่าน ≥85%</div>
              <div className={passed ? "text-emerald-700 font-semibold" : "text-amber-800 font-semibold"}>
                {passed ? "✓ ผ่านเกณฑ์มาตรฐาน" : `⚠️ พบข้อบกพร่อง ${issues.length || 1} ข้อ`}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Clean Meta Information */}
        <div className="flex flex-wrap sm:flex-col items-start sm:items-end justify-between sm:justify-center gap-1.5 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 text-xs">
          <div><span className="text-slate-400 font-medium">แบบฟอร์ม:</span> <span className="font-bold text-[#0F6659] ml-1">{formTitle}</span></div>
          <div><span className="text-slate-400 font-medium">วันที่ตรวจ:</span> <span className="font-bold text-slate-800 ml-1">{dateStr}</span></div>
          <div><span className="text-slate-400 font-medium">ผู้ตรวจ:</span> <span className="font-bold text-slate-800 ml-1">{auditorName}</span></div>
        </div>
      </div>

      {/* 🌟 5-TAB SEGMENTED SELECTOR */}
      <div className="grid grid-cols-5 bg-white rounded-2xl p-1.5 border border-slate-200 shadow-2xs gap-1">
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
              className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 py-2 px-1 sm:px-3 rounded-xl cursor-pointer transition-all active:scale-95 text-center ${
                isActive 
                  ? 'bg-[#0F6659] text-white shadow-xs' 
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Icon size={16} strokeWidth={isActive ? 2.5 : 2} className={isActive ? "text-emerald-200" : "text-slate-400"} />
              <span className="text-[11px] sm:text-xs font-bold leading-tight tracking-tight">
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
                    <span className="w-7 h-7 rounded-xl bg-emerald-100 text-[#0F6659] font-extrabold text-xs flex items-center justify-center shrink-0">
                      {secIdx + 1}
                    </span>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900">
                      {sec.title}
                    </h3>
                  </div>

                  {/* Section Status Badge */}
                  <span className={`text-xs font-extrabold px-3 py-1 rounded-full border ${
                    secPassed 
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
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
                        className={`p-4 rounded-2xl border shadow-2xs space-y-3 transition-all ${
                          q.isNa
                            ? "bg-slate-50/60 border-slate-200"
                            : isPass 
                            ? "bg-white border-slate-200" 
                            : "bg-amber-50/20 border-amber-300"
                        }`}
                      >
                        {/* Question Header & Score Badge at Top Right */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5 flex-1 min-w-0">
                            <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 font-extrabold text-xs flex items-center justify-center shrink-0 mt-0.5">
                              {q.num}
                            </span>
                            <div>
                              <div className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                                {q.text}
                              </div>
                              {q.isCritical && (
                                <span className="inline-block mt-1 text-[10.5px] font-extrabold px-2 py-0.5 rounded-md bg-red-100 text-red-700 border border-red-200">
                                  ⚠️ สำคัญ
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 🌟 มุมขวาบนของข้อ: แสดงเป็นคะแนนเสมอ */}
                          <div className="shrink-0">
                            <span className={`inline-flex items-center gap-1 text-xs sm:text-sm font-extrabold px-3 py-1 rounded-xl border shadow-2xs ${
                              q.isNa
                                ? "bg-slate-100 text-slate-500 border-slate-200"
                                : isPass
                                ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                                : "bg-red-50 text-red-700 border-red-300"
                            }`} style={{ fontFamily: mono }}>
                              <span>{q.scoreGiven !== undefined ? q.scoreGiven : (isPass ? full : 0)} / {full}</span>
                            </span>
                          </div>
                        </div>

                        {/* 🌟 ส่วนด้านล่าง: แสดงเป็นคำตอบที่ตอบแบบปกติ */}
                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                          {q.isNa ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 border border-slate-200">
                              <Minus size={14} />
                              <span>ข้าม (N/A)</span>
                            </span>
                          ) : q.type === "yesno" ? (
                            <span className={`inline-flex items-center gap-1.5 text-xs sm:text-sm font-extrabold px-3 py-1.5 rounded-xl border ${
                              q.answer 
                                ? "bg-emerald-50 text-emerald-800 border-emerald-300" 
                                : "bg-red-50 text-red-700 border-red-300"
                            }`}>
                              {q.answer ? <CheckCircle2 size={15} className="text-emerald-600" /> : <XCircle size={15} className="text-red-600" />}
                              <span>{q.answer ? "ผ่าน" : "ไม่ผ่าน"}</span>
                            </span>
                          ) : q.type === "scale" ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-400">คำตอบที่ประเมิน:</span>
                              <span className={`inline-flex items-center gap-1 text-xs sm:text-sm font-extrabold px-3 py-1 rounded-xl border ${
                                (q.scaleScore || q.answer) >= 4 
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-300" 
                                  : (q.scaleScore || q.answer) >= 3
                                  ? "bg-amber-50 text-amber-800 border-amber-300"
                                  : "bg-red-50 text-red-700 border-red-300"
                              }`}>
                                <span>ระดับ {q.scaleScore || (typeof q.answer === 'number' && q.answer <= 5 ? q.answer : Math.round((currentSc / full) * 5))} / 5</span>
                              </span>
                            </div>
                          ) : (
                            q.answer && typeof q.answer === 'string' && q.answer.trim() && (
                              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-medium text-slate-800 w-full">
                                "{q.answer}"
                              </div>
                            )
                          )}
                        </div>

                        {/* 🌟 ส่วนคอมเม้น: ถ้าไม่มีคอมเม้นไม่ต้องแสดงกล่องบันทึกผู้ตรวจ */}
                        {q.note && q.note.trim().length > 0 && (
                          <div className={`p-2.5 px-3 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2 ${
                            isPass ? "bg-slate-50 text-slate-700 border border-slate-200" : "bg-amber-50 text-amber-950 border border-amber-200"
                          }`}>
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
                                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-white cursor-pointer shadow-xs active:scale-95 flex items-center gap-1.5"
                                style={{ background: "#0F6659" }}
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

          <div className="p-4 space-y-3 max-h-[75vh] overflow-y-auto">
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
              className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 font-bold text-xs text-slate-700 cursor-pointer transition-all"
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
              {sections.map((s, i) => (
                <div key={s.title} className="px-4 py-3.5" style={{ borderBottom: i < sections.length - 1 ? `1px solid ${c.border}` : "none" }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold" style={{ color: c.ink }}>{s.title}</span>
                    <span className="text-xs font-bold" style={{ color: c.muted, fontFamily: mono }}>{s.score}/{s.max} ({s.percent}%)</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: c.border }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${(s.score / s.max) * 100}%`, background: s.score / s.max >= 0.85 ? c.accent : s.score / s.max >= 0.7 ? c.warn : c.risk }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {issues.length > 0 && (
            <Section title={`ข้อบกพร่องที่ต้องแก้ไข (${issues.length} ข้อ)`}>
              <div className="flex flex-col gap-2">
                {issues.map((iss, i) => (
                  <div key={i} className="rounded-2xl p-3 sm:p-3.5 flex items-start gap-2.5" style={{ background: iss.critical ? c.riskSoft : c.warnSoft }}>
                    {iss.critical ? (
                      <Megaphone size={15} style={{ color: c.risk, marginTop: 2 }} className="shrink-0" />
                    ) : (
                      <AlertTriangle size={15} style={{ color: c.warn, marginTop: 2 }} className="shrink-0" />
                    )}
                    <div className="text-xs leading-relaxed font-medium space-y-0.5" style={{ color: iss.critical ? c.risk : c.warn }}>
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
          <div className="p-4 rounded-3xl bg-white border shadow-2xs space-y-3" style={{ borderColor: c.border }}>
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
          <div className="p-4 rounded-3xl bg-white border shadow-2xs space-y-3" style={{ borderColor: c.border }}>
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
            <div className="p-4 rounded-2xl bg-white border shadow-2xs space-y-2.5" style={{ borderColor: c.border }}>
              <div className="text-xs font-bold text-slate-500">ผู้ตรวจประเมิน</div>
              <div className="h-28 rounded-xl bg-slate-50 border border-dashed border-slate-200 flex flex-col items-center justify-center p-2 text-center overflow-hidden">
                {(record.auditorSignatureUrl || record.auditorSignature) ? (
                  <img
                    src={getFullImageUrl(record.auditorSignatureUrl || record.auditorSignature)}
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
            <div className="p-4 rounded-2xl bg-white border shadow-2xs space-y-2.5" style={{ borderColor: c.border }}>
              <div className="text-xs font-bold text-slate-500">ผู้จัดการสาขา (ผู้รับตรวจ)</div>
              <div className="h-28 rounded-xl bg-slate-50 border border-dashed border-slate-200 flex flex-col items-center justify-center p-2 text-center overflow-hidden">
                {(record.auditeeSignatureUrl || record.auditeeSignature) ? (
                  <img
                    src={getFullImageUrl(record.auditeeSignatureUrl || record.auditeeSignature)}
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
            <div className="p-4 sm:p-5 rounded-2xl bg-white border shadow-2xs space-y-3" style={{ borderColor: c.border }}>
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
                    เวลาเริ่ม: <span className="font-bold text-slate-700">{startedTimeStr}</span> · พิกัด: <span className="font-bold text-slate-700" style={{ fontFamily: mono }}>{startLat && startLng ? `${Number(startLat).toFixed(6)}, ${Number(startLng).toFixed(6)}` : "-"}</span>
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
                    style={{ border: 0 }}
                    loading="lazy"
                    allowFullScreen
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://maps.google.com/maps?q=${startLat},${startLng}&hl=th&z=16&output=embed`}
                    className="w-full h-full block"
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
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse inline-block" />
                    <span>2. จุดส่งผลตรวจ (Submit Inspection)</span>
                  </div>
                  <div className="text-[11.5px] text-slate-500 font-medium">
                    เวลาส่งผล: <span className="font-bold text-slate-700">{submittedTimeStr}</span> · พิกัด: <span className="font-bold text-slate-700" style={{ fontFamily: mono }}>{endLat && endLng ? `${Number(endLat).toFixed(6)}, ${Number(endLng).toFixed(6)}` : "-"}</span>
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
                    style={{ border: 0 }}
                    loading="lazy"
                    allowFullScreen
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://maps.google.com/maps?q=${endLat},${endLng}&hl=th&z=16&output=embed`}
                    className="w-full h-full block"
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
    </div>
  );
}
