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
import { ROLES, NAV_BY_ROLE, ROLE_USER_MAP } from "../../config/roles";
import { TODAY, AUDIT_TYPES, AUDIT_TYPE_META, CAP_STATUS_MAP, REGION_LINES, BRAND_LINES } from "../../config/constants";
import { TopBarContext } from "../../context/TopBarContext";
import { DataContext } from "../../context/DataContext";
import { INITIAL_UNITS, LOCATIONS } from "../../mocks/locations";
import { INITIAL_SCHEDULE } from "../../mocks/schedule";
import { INITIAL_FORM_SECTIONS, INITIAL_FORMS_LIST } from "../../mocks/forms";
import { AUDITORS_DATA, AUDITORS_LIST } from "../../mocks/auditors";
import { INITIAL_NOTIFICATIONS } from "../../mocks/notifications";
import { INITIAL_CAP_LIST } from "../../mocks/cap";
import { TRENDS_DATA, TRENDS_BY_REGION, TRENDS_BY_BRAND } from "../../mocks/trends";
import { AI_INSIGHTS } from "../../mocks/aiInsights";
import { MOCK_USERS, ORG_TREE, ROLE_PERMISSIONS_LIST, API_INTEGRATIONS } from "../../mocks/admin";
import { exportToExcel } from "../../utils/exportToExcel";

import ModalWrapper from "../../shared/ModalWrapper";
import Header from "../../shared/Header";
import Section from "../../shared/Section";
import ScoreRing from "../../shared/ScoreRing";
import HistoryList from "../../shared/HistoryList";
import ErrorBoundary from "../../shared/ErrorBoundary";
import CapSubmissionModal from "../../modals/CapSubmissionModal";
import ViewCapEvidenceModal from "../../modals/ViewCapEvidenceModal";


export default function AuditHistoryDetail({ unitName, record = {}, onBack }) {
  const { locations } = React.useContext(DataContext);
  const [activeTab, setActiveTab] = useState("responses"); // 'responses' | 'overview' | 'photos' | 'sign'
  const [capSubmissions, setCapSubmissions] = useState({});
  const [disputeSubmitted, setDisputeSubmitted] = useState(record.status === "Disputed");
  const [submittingCapQuestion, setSubmittingCapQuestion] = useState(null);
  const [viewingCap, setViewingCap] = useState(null);

  // Normalized audit record attributes
  const score = typeof record.score === "number" ? record.score : typeof record.percentageScore === "number" ? Math.round(record.percentageScore) : 85;
  const dateStr = record.date || (record.auditDate ? new Date(record.auditDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) : "วันนี้");
  const auditorName = record.auditor || record.auditorName || record.primaryAuditor?.fullName || "คุณสมชาย ใจดี (Lead Auditor)";
  const formTitle = record.form || record.formName || record.surveyFormTitle || record.surveyForm?.title || "แบบฟอร์มมาตรฐาน 5 ดาว (QSC Core Checklist 2026)";
  const passed = record.isPassed !== undefined ? record.isPassed : (score >= 85 && !record.hasCriticalDefect);
  const hasCritical = record.hasCriticalDefect || (record.responses && record.responses.some(r => r.isCritical && !r.isPassed));
  const locationTitle = unitName || record.unitFullName || record.locationName || record.location?.name || "สาขา";
  const managerName = record.auditeeName || record.auditeeUser?.fullName || "ผู้จัดการสาขา";
  const staffCount = record.staffCount || 10;
  const auditType = record.auditType === "followup" ? "ตรวจติดตามผล (Follow-up)" : "ตรวจมาตรฐานรอบปกติ (Announced)";

  // Dynamic Form Question Breakdown
  const formBreakdown = useMemo(() => {
    // If real responses exist from DB API
    if (record.responses && Array.isArray(record.responses) && record.responses.length > 0) {
      const sectionsMap = {};
      
      record.responses.forEach((res, idx) => {
        let secName = "หมวด ก: มาตรฐานสุขอนามัยและความสะอาด (CLN)";
        const qText = res.questionText || res.surveyItem?.questionText || `ข้อตรวจที่ ${idx + 1}`;
        const qType = (res.questionType || res.surveyItem?.questionType || "YESNO").toLowerCase();
        const isCrit = res.isCritical !== undefined ? res.isCritical : (res.surveyItem?.isCritical || false);
        const fullSc = res.fullScore !== undefined ? res.fullScore : (res.surveyItem?.fullScore || 10);
        const isPass = res.isPassed !== undefined ? res.isPassed : (res.scoreGiven > 0);

        if (qText.includes("อุณหภูมิ") || qText.includes("น้ำมัน") || qText.includes("สุก") || qText.includes("FIFO") || qText.includes("แช่") || qText.includes("GMP")) {
          secName = "หมวด ข: คุณภาพอาหาร ความสด และการควบคุมอุณหภูมิ (QLT)";
        } else if (qText.includes("บริการ") || qText.includes("ทักทาย") || qText.includes("ความเร็ว") || qText.includes("แต่งกาย")) {
          secName = "หมวด ค: การบริการ ความเร็ว และความสุภาพ (SVC)";
        } else if (qText.includes("หนีไฟ") || qText.includes("ดับเพลิง") || qText.includes("เงินสด") || qText.includes("ความปลอดภัย") || qText.includes("เครื่องจักร")) {
          secName = "หมวด ง: ความปลอดภัย และการควบคุมมาตรฐาน (SAF)";
        }

        if (!sectionsMap[secName]) {
          sectionsMap[secName] = { title: secName, questions: [] };
        }

        sectionsMap[secName].questions.push({
          num: idx + 1,
          id: `q_${res.id || idx}`,
          text: qText,
          type: qType,
          answer: qType === "scale" ? (res.scoreGiven || (isPass ? 5 : 3)) : isPass,
          scoreGiven: res.scoreGiven,
          fullScore: fullSc,
          isCritical: isCrit,
          note: res.notes || (isPass ? "ผลการตรวจผ่านเกณฑ์มาตรฐาน SOP เรียบร้อย" : isCrit ? "🚨 พบข้อบกพร่องวิกฤต (Critical Failure) ต้องเปิดตั๋ว CAP ด่วน" : "พบข้อบกพร่อง ต้องดำเนินการแก้ไขตามข้อเสนอแนะ"),
          hasPhoto: !isPass || (res.images && res.images.length > 0),
          images: res.images || []
        });
      });

      return Object.values(sectionsMap);
    }

    // Fallback contextual generator based on score and location
    const isHigh = score >= 90;
    const isFail = score < 85;

    return [
      {
        title: "หมวด ก: มาตรฐานสุขอนามัยและความสะอาด (CLN)",
        questions: [
          {
            num: 1,
            id: "q1",
            text: "จุดล้างมือมีสบู่เหลว แอลกอฮอล์ และกระดาษเช็ดมือพร้อมใช้งาน",
            type: "yesno",
            answer: true,
            note: "จุดล้างมือสะอาด มีสบู่เหลวและกระดาษเช็ดมือครบถ้วน",
            hasPhoto: false,
          },
          {
            num: 2,
            id: "q2",
            text: "ตู้เย็นและตู้แช่เย็นควบคุมอุณหภูมิ <= 4.0°C พร้อมบันทึก Log สม่ำเสมอ",
            type: "yesno",
            answer: score >= 80,
            isCritical: true,
            note: score >= 80 ? "อุณหภูมิตู้แช่ 2.8°C ผ่านเกณฑ์มาตรฐาน" : "อุณหภูมิตู้แช่สูงผิดปกติ 6.5°C มีปัญหาที่ขอบยาง",
            hasPhoto: score < 80,
          },
          {
            num: 3,
            id: "q3",
            text: "ฮูดดูดควัน ตะแกรงดักไขมัน และท่อระบายน้ำพื้นสะอาดปราศจากคราบสะสม",
            type: "yesno",
            answer: !isFail,
            note: !isFail ? "ล้างทำความสะอาดตะแกรงดักไขมันประจำรอบเรียบร้อย" : "พบคราบไขมันสะสมบริเวณตะแกรงดักไขมัน (เปิด CAP)",
            hasPhoto: isFail,
          }
        ]
      },
      {
        title: "หมวด ข: คุณภาพอาหาร ความสด และการควบคุมอุณหภูมิ (QLT)",
        questions: [
          {
            num: 4,
            id: "q4",
            text: "ค่าน้ำมันทอด TPM ไม่เกิน 22% (ตรวจสอบด้วยเครื่องวัดดิจิทัล)",
            type: "yesno",
            answer: !hasCritical,
            isCritical: true,
            note: !hasCritical ? "ค่าน้ำมันทอด TPM 14.2% ผ่านเกณฑ์มาตรฐาน" : "ค่าน้ำมันทอด TPM 24.5% เกินเกณฑ์มาตรฐานกำหนด (เปิด CAP ด่วน)",
            hasPhoto: hasCritical,
          },
          {
            num: 5,
            id: "q5",
            text: "อุณหภูมิแกนกลางของเนื้อสัตว์ปรุงสุกถึง >= 75°C นาน 15 วินาที",
            type: "yesno",
            answer: true,
            isCritical: true,
            note: "อุณหภูมิแกนกลางเนื้อสัตว์ปรุงสุกวัดได้ 79.0°C ผ่านเกณฑ์",
            hasPhoto: false,
          },
          {
            num: 6,
            id: "q6",
            text: "วัตถุดิบทั้งหมดติดป้าย FIFO ระบุวันผลิตและวันหมดอายุย่อยชัดเจน",
            type: "yesno",
            answer: true,
            note: "ป้าย FIFO ครบถ้วน ระบุวันผลิต/หมดอายุถูกต้อง",
            hasPhoto: false,
          }
        ]
      },
      {
        title: "หมวด ค: การบริการ ความเร็ว และความสุภาพ (SVC)",
        questions: [
          {
            num: 7,
            id: "q7",
            text: "พนักงานต้อนรับกล่าวทักทายภายใน 5 วินาทีด้วยรอยยิ้มมาตรฐาน",
            type: "scale",
            answer: isHigh ? 5 : 4,
            note: "พนักงานกล่าวต้อนรับสุภาพ ยิ้มแย้มแจ่มใส",
            hasPhoto: false,
          },
          {
            num: 8,
            id: "q8",
            text: "ความเร็วในการเสิร์ฟ (สั่งซื้อจนถึงรับสินค้า) ไม่เกิน 180 วินาที",
            type: "scale",
            answer: isHigh ? 5 : 4,
            note: "เวลาเฉลี่ยในการออกออเดอร์ 2.2 นาที (ตามเกณฑ์มาตรฐาน ≤ 3 นาที)",
            hasPhoto: false,
          }
        ]
      }
    ];
  }, [record, score, passed, hasCritical]);

  // Calculated Sections Score Breakdown
  const sections = useMemo(() => {
    return formBreakdown.map(sec => {
      const totalQ = sec.questions.length;
      let earned = 0;
      let maxScore = totalQ * 10;
      sec.questions.forEach(q => {
        if (q.type === "scale") {
          earned += ((q.answer || 5) / 5) * 10;
        } else if (q.answer === true) {
          earned += 10;
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
        const isPass = q.type === "yesno" ? q.answer === true : q.type === "scale" ? q.answer >= 4 : true;
        if (!isPass) {
          list.push({
            text: `${q.text} (${q.note})`,
            critical: q.isCritical || false
          });
        }
      });
    });
    return list;
  }, [formBreakdown]);

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
            <div className="text-xs text-slate-500 font-medium mt-0.5">
              เกณฑ์คะแนนผ่าน ≥85% · {passed ? "รักษามาตรฐานได้ยอดเยี่ยม" : `มีข้อบกพร่องที่ต้องแก้ไข ${issues.length || 1} ข้อ`}
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

      {/* 🌟 4-TAB SEGMENTED SELECTOR */}
      <div className="grid grid-cols-4 bg-white rounded-2xl p-1.5 border border-slate-200 shadow-2xs gap-1">
        {[
          { key: "responses", label: "ผลตรวจ", icon: ClipboardCheck },
          { key: "overview", label: "คะแนน", icon: BarChart3 },
          { key: "photos", label: "รูปภาพ", icon: Camera },
          { key: "sign", label: "ลายเซ็น", icon: PenTool },
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
              <span className="text-[11.5px] sm:text-xs font-bold leading-tight tracking-tight">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: DETAILED FORM RESPONSES */}
      {activeTab === "responses" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {formBreakdown.map((sec, secIdx) => {
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
                    const isPass = q.type === "yesno" ? q.answer === true : q.type === "scale" ? q.answer >= 4 : true;
                    const hasCap = !!capSubmissions[q.id];

                    return (
                      <div 
                        key={q.id} 
                        className={`p-4 rounded-2xl border shadow-2xs space-y-2.5 transition-all ${
                          isPass ? "bg-white border-slate-200" : "bg-amber-50/20 border-amber-300"
                        }`}
                      >
                        {/* Question Header & Badge */}
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
                                  ⚠️ ข้อวิกฤต (Critical Item)
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Response Badge */}
                          <div className="shrink-0">
                            {q.type === "yesno" && (
                              <span className={`inline-flex items-center gap-1.5 text-xs sm:text-sm font-extrabold px-3 py-1 rounded-xl border ${
                                q.answer 
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-300" 
                                  : "bg-red-50 text-red-700 border-red-300"
                              }`}>
                                {q.answer ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                                <span>{q.answer ? "ผ่าน" : "ไม่ผ่าน"}</span>
                              </span>
                            )}

                            {q.type === "scale" && (
                              <span className={`inline-flex items-center gap-1 text-xs sm:text-sm font-extrabold px-3 py-1 rounded-xl border ${
                                q.answer >= 4 
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-300" 
                                  : "bg-amber-50 text-amber-800 border-amber-300"
                              }`}>
                                <span>⭐ {q.answer}/5</span>
                              </span>
                            )}

                            {q.type === "text" && (
                              <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 border border-slate-200">
                                รายละเอียด
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Text Answer */}
                        {q.type === "text" && (
                          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-medium text-slate-800">
                            "{q.answer}"
                          </div>
                        )}

                        {/* Auditor Note */}
                        {q.note && q.type !== "text" && (
                          <div className={`p-2.5 px-3 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2 ${
                            isPass ? "bg-slate-50 text-slate-700 border border-slate-200" : "bg-amber-50 text-amber-950 border border-amber-200"
                          }`}>
                            <MessageSquare size={14} className="shrink-0 text-slate-400" />
                            <span><b>บันทึกผู้ตรวจ:</b> {q.note}</span>
                          </div>
                        )}

                        {/* Photo Preview Button */}
                        {q.hasPhoto && (
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
                        )}

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
          })}
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
            <Section title="ข้อบกพร่องที่ต้องส่งมอบงานแก้ไข (CAP)">
              <div className="flex flex-col gap-2">
                {issues.map((iss, i) => (
                  <div key={i} className="rounded-2xl p-3.5 flex items-start gap-2.5" style={{ background: iss.critical ? c.riskSoft : c.warnSoft }}>
                    {iss.critical && <Megaphone size={16} style={{ color: c.risk, marginTop: 1 }} className="shrink-0" />}
                    <p className="text-xs leading-relaxed font-medium" style={{ color: iss.critical ? c.risk : c.warn }}>{iss.text}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {issues.length === 0 && (
            <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-center text-xs font-bold text-emerald-800">
              ✓ ไม่พบข้อบกพร่องในการตรวจรอบนี้ สาขาปฏิบัติตามมาตรฐาน SOP ได้อย่างสมบูรณ์
            </div>
          )}
        </div>
      )}

      {/* TAB 3: DUAL PHOTO ALBUMS */}
      {activeTab === "photos" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-2">
              <Camera size={16} className="text-emerald-700" />
              <span>คลังภาพบันทึกหลักฐานการตรวจ ({locationTitle})</span>
            </h3>
            <span className="text-xs text-slate-500">แยกหมวดหมู่ชัดเจน</span>
          </div>

          {/* Album 1: On-site Inspection Photos */}
          <div className="p-4 rounded-3xl bg-white border shadow-2xs space-y-3" style={{ borderColor: c.border }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900">📷 1. อัลบั้มรูปตรวจหน้างาน (Inspection Photos)</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${score < 85 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'}`}>
                  {score < 85 ? '1 รูปบันทึกข้อบกพร่อง' : '1 รูปภาพสภาพทั่วไป'}
                </span>
              </div>
              <span className="text-xs text-slate-400">บันทึกโดยผู้ตรวจ</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="h-36 rounded-xl bg-slate-200/80 flex flex-col items-center justify-center text-slate-500 relative overflow-hidden border">
                  <Camera size={28} className="text-slate-400 mb-1" />
                  <span className="text-xs font-bold text-slate-700">รูปถ่ายหน้างาน ({locationTitle})</span>
                  <span className="text-xs text-slate-400">บันทึกเมื่อ {dateStr} 10:20 น.</span>
                  <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-md text-white text-[9.5px] font-bold ${score < 85 ? 'bg-red-600' : 'bg-emerald-700'}`}>
                    {score < 85 ? 'Defect (ข้อบกพร่อง)' : 'Standard (สภาพเรียบร้อย)'}
                  </div>
                </div>
                <div className="text-xs text-slate-600 font-medium">
                  💬 <b>คำอธิบาย:</b> {score < 85 ? (issues[0]?.text || "พบคราบสกปรกหรืออุณหภูมิไม่ได้เกณฑ์มาตรฐาน") : "ทำความสะอาดเรียบร้อยตามมาตรฐาน SOP"}
                </div>
              </div>
            </div>
          </div>

          {/* Album 2: CAP Corrective Action Evidence Photos */}
          <div className="p-4 rounded-3xl bg-white border shadow-2xs space-y-3" style={{ borderColor: c.border }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900">🛠️ 2. อัลบั้มรูปหลักฐานการแก้ไข (CAP After-Photos)</span>
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
                      <CheckCircle2 size={28} className="text-emerald-700 mb-1" />
                      <span className="text-xs font-bold text-emerald-950">รูปถ่ายหลังแก้ไข ({locationTitle})</span>
                      <span className="text-xs text-emerald-700">ส่งมอบเมื่อ {cap.submittedAt}</span>
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
            <div className="p-4 rounded-2xl bg-white border shadow-2xs space-y-2" style={{ borderColor: c.border }}>
              <div className="text-xs font-bold text-slate-400">ลายมือชื่อผู้ตรวจประเมิน</div>
              <div className="h-24 rounded-xl bg-slate-50 border border-dashed border-slate-200 flex flex-col items-center justify-center">
                <span className="font-serif italic text-lg text-emerald-800 font-bold">{auditorName}</span>
                <span className="text-xs text-slate-400 font-medium mt-1">ตรวจหน้างานเมื่อ {dateStr} 10:45 น.</span>
              </div>
              <div className="text-xs text-slate-600 font-medium text-center">
                สถานะ: <span className="font-bold text-emerald-700">✓ ยืนยันการตรวจสำเร็จ ({auditType})</span>
              </div>
            </div>

            {/* Store Manager Signature */}
            <div className="p-4 rounded-2xl bg-white border shadow-2xs space-y-2" style={{ borderColor: c.border }}>
              <div className="text-xs font-bold text-slate-400">ลายมือชื่อผู้จัดการสถานที่รับทราบผล</div>
              <div className="h-24 rounded-xl bg-slate-50 border border-dashed border-slate-200 flex flex-col items-center justify-center">
                <span className="font-serif italic text-lg text-slate-700 font-bold">{managerName}</span>
                <span className="text-xs text-slate-400 font-medium mt-1">ลงนามรับทราบเมื่อ {dateStr} 11:15 น. (พนักงาน {staffCount} คน)</span>
              </div>
              <div className="text-xs text-slate-600 font-medium text-center">
                สถานะ: <span className="font-bold text-emerald-700">✓ ลงนามรับทราบผลเรียบร้อย</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
