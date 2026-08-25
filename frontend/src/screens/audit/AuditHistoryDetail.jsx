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


export default function AuditHistoryDetail({ unitName, record, onBack }) {
  const { locations } = React.useContext(DataContext);
  const [activeTab, setActiveTab] = useState("responses"); // 'responses' | 'overview' | 'sign'
  const [capSubmissions, setCapSubmissions] = useState({});
  const [disputeSubmitted, setDisputeSubmitted] = useState(record.status === "Disputed");
  const [submittingCapQuestion, setSubmittingCapQuestion] = useState(null);
  const [viewingCap, setViewingCap] = useState(null);

  const cat1Max = 50, cat2Max = 50;
  const cat1 = Math.max(0, Math.min(cat1Max, Math.round(record.score * 0.55)));
  const cat2 = Math.max(0, Math.min(cat2Max, record.score - cat1));
  const sections = [
    { title: "ความสะอาดและสุขอนามัย (Cleanliness)", score: cat1, max: cat1Max },
    { title: "มาตรฐานการบริการและความเร็ว (Service)", score: cat2, max: cat2Max },
  ];
  const issues = [];
  if (record.score < 85) issues.push({ text: "พบคราบสกปรกและไขมันสะสมบริเวณพื้นที่ปฏิบัติงาน (ข้อ 1)", critical: false });
  if (record.score < 70) issues.push({ text: "พบข้อบกพร่องด้านความปลอดภัยอาหาร ต้องส่งหลักฐานแก้งานด่วน (ข้อ 6)", critical: true });

  const passed = record.score >= 85;

  // Form question responses breakdown for this audit round
  const formBreakdown = [
    {
      title: "ความสะอาดและสุขอนามัย (Cleanliness)",
      questions: [
        {
          num: 1,
          id: "q1",
          text: "พื้น ผนัง และโต๊ะรับประทานอาหารสะอาด ปราศจากคราบไขมัน",
          type: "yesno",
          answer: record.score >= 85 ? true : false,
          note: record.score >= 85 ? "ทำความสะอาดพื้นและโต๊ะเรียบร้อย ไม่มีคราบไขมันตกค้าง" : "พบคราบไขมันสะสมบริเวณพื้นหลังเตาปรุงอาหาร (เปิดใบงานแก้ไข CAP-001)",
          hasPhoto: record.score < 85,
        },
        {
          num: 2,
          id: "q2",
          text: "พนักงานแต่งกายถูกสุขลักษณะ สวมหมวกคลุมผมและผ้ากันเปื้อน",
          type: "yesno",
          answer: record.score >= 60 ? true : false,
          note: record.score >= 60 ? "พนักงานทุกคนแต่งกายเรียบร้อย สวมหมวกและผ้ากันเปื้อนถูกต้อง" : "พบพนักงานพาร์ทไทม์ 1 คนลืมสวมหมวกคลุมผมระหว่างเตรียมวัตถุดิบ",
          hasPhoto: false,
        },
        {
          num: 3,
          id: "q3",
          text: "ความสะอาดของห้องน้ำลูกค้าและอุปกรณ์ล้างมือ",
          type: "scale",
          answer: record.score >= 90 ? 5 : record.score >= 80 ? 4 : 3,
          note: "มีสบู่ล้างมือและกระดาษเช็ดมือพร้อมใช้งาน พื้นแห้งสะอาดไม่มีกลิ่นอับ",
          hasPhoto: false,
        },
      ]
    },
    {
      title: "มาตรฐานการบริการและความเร็ว (Service)",
      questions: [
        {
          num: 4,
          id: "q4",
          text: "พนักงานกล่าวทักทายและต้อนรับลูกค้าภายใน 5 วินาที",
          type: "yesno",
          answer: true,
          note: "พนักงานหน้าเคาน์เตอร์กล่าวต้อนรับด้วยความสุภาพและยิ้มแย้ม",
          hasPhoto: false,
        },
        {
          num: 5,
          id: "q5",
          text: "ความรวดเร็วและถูกต้องในการส่งมอบออเดอร์",
          type: "scale",
          answer: record.score >= 85 ? 5 : 4,
          note: "เวลาเฉลี่ยในการออกออเดอร์ 2.4 นาที (ตามเกณฑ์มาตรฐาน SOP ≤ 3 นาที)",
          hasPhoto: false,
        },
        {
          num: 6,
          id: "q5_note",
          text: "บันทึกคำชมเชยหรือข้อเสนอแนะด้านการบริการจากลูกค้า",
          type: "text",
          answer: "ลูกค้าประจำชื่นชมความรวดเร็วในการรับออเดอร์และเครื่องดื่มรสชาติตรงตามสูตรมาตรฐาน",
          hasPhoto: false,
        },
      ]
    },
    {
      title: "3. คุณภาพอาหารและความปลอดภัย (Quality & Safety)",
      questions: [
        {
          num: 7,
          id: "q6",
          text: "อุณหภูมิตู้แช่เย็นวัตถุดิบไม่เกินเกณฑ์กำหนด (≤ 4.0°C)",
          type: "yesno",
          answer: record.score < 75 ? false : true,
          note: record.score < 75 ? "อุณหภูมิตู้แช่สูงผิดปกติ วัดได้ 5.8°C แจ้งผู้จัดการสาขาเปลี่ยนซีลยางและซ่อมบำรุงด่วน" : "อุณหภูมิวัดได้ 2.6°C อยู่ในเกณฑ์มาตรฐาน",
          hasPhoto: record.score < 75,
        },
        {
          num: 8,
          id: "q7",
          text: "ป้ายระบุวันหมดอายุ (Date label) ชัดเจนและถูกต้องตาม SOP",
          type: "yesno",
          answer: true,
          note: "วัตถุดิบทุกรายการติดสติกเกอร์ First-in First-out (FIFO) ครบถ้วนชัดเจน",
          hasPhoto: false,
        },
        {
          num: 9,
          id: "q8",
          text: "บันทึกอุณหภูมิน้ำมันทอดและการตรวจวัดค่า TPM",
          type: "text",
          answer: "อุณหภูมิน้ำมันทอด 175°C, ค่าสารโพลาร์ TPM 14% (เกณฑ์ไม่เกิน 25% ผ่านการทดสอบ)",
          hasPhoto: false,
        },
      ]
    }
  ];

  return (
    <div className="page-transition p-4 sm:p-6 space-y-4 w-full max-w-[100%] sm:max-w-[96%] md:max-w-[92%] mx-auto pb-12">
      <Header title={`ผลการตรวจ: ${unitName}`} subtitle={`รอบตรวจวันที่ ${record.date} · ผู้ตรวจ: ${record.auditor || "สมชาย ใจดี"}`} onBack={onBack} />
      
      {/* 🌟 1. ALL-IN-ONE SLEEK HERO SUMMARY CARD (คลีน สบายตา ไม่รก) */}
      <div className="rounded-3xl p-4 sm:p-5 bg-white border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Left: Score Ring & Verdict */}
        <div className="flex items-center gap-4 min-w-0">
          <ScoreRing score={record.score} size={54} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900" style={{ fontFamily: mono }}>
                {record.score}%
              </span>
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-lg ${passed ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-900 border border-amber-200'}`}>
                {passed ? "✓ ผ่านเกณฑ์มาตรฐาน" : "⚠️ ต้องส่งงานแก้ไข (CAP)"}
              </span>
            </div>
            <div className="text-xs text-slate-500 font-medium mt-0.5">
              เกณฑ์คะแนนผ่าน ≥85% · {passed ? "รักษามาตรฐานได้ยอดเยี่ยม" : "มีข้อที่ต้องแก้ไข 1 ข้อ"}
            </div>
          </div>
        </div>

        {/* Right: Clean Meta Information */}
        <div className="flex flex-wrap sm:flex-col items-start sm:items-end justify-between sm:justify-center gap-1.5 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 text-xs">
          <div><span className="text-slate-400 font-medium">แบบฟอร์ม:</span> <span className="font-bold text-[#0F6659] ml-1">SOP ร้านอาหาร v3</span></div>
          <div><span className="text-slate-400 font-medium">วันที่ตรวจ:</span> <span className="font-bold text-slate-800 ml-1">{record.date}</span></div>
          <div><span className="text-slate-400 font-medium">ผู้ตรวจ:</span> <span className="font-bold text-slate-800 ml-1">{record.auditor || "สมชาย ใจดี"}</span></div>
        </div>
      </div>

      {/* 🌟 4-TAB SEGMENTED SELECTOR (แสดงครบทั้ง 4 แท็บพอดีหน้าจอ ไม่มีตกขอบ) */}
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

      {/* TAB 1: DETAILED FORM RESPONSES (ตัวหนังสือใหญ่ ชัดเจน เน้นคำสำคัญ) */}
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
                {/* 🌟 CATEGORY HEADER (Large & Clean) */}
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

                {/* 🌟 QUESTIONS CONTAINER (Large Text & Concise) */}
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
                            <div className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                              {q.text}
                            </div>
                          </div>

                          {/* Response Badge (Large & Clear) */}
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

                        {/* Auditor Note (Concise & Clear) */}
                        {q.note && q.type !== "text" && (
                          <div className={`p-2.5 px-3 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2 ${
                            isPass ? "bg-slate-50 text-slate-700 border border-slate-200" : "bg-amber-50 text-amber-950 border border-amber-200"
                          }`}>
                            <MessageSquare size={14} className="shrink-0 text-slate-400" />
                            <span><b>หมายเหตุ:</b> {q.note}</span>
                          </div>
                        )}

                        {/* Photo Preview Button */}
                        {q.hasPhoto && (
                          <div className="p-2.5 px-3 rounded-xl bg-red-50 border border-red-200 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-xs font-bold text-red-800">
                              <Camera size={15} className="text-red-600" />
                              <span>แนบรูปหลักฐานแล้ว</span>
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
          unitName={unitName}
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
                    <span className="text-xs font-bold" style={{ color: c.muted, fontFamily: mono }}>{s.score}/{s.max}</span>
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
        </div>
      )}

      {/* TAB 3: DUAL PHOTO ALBUMS (รูปตรวจหน้างาน vs รูปหลักฐานส่งแก้งาน) */}
      {activeTab === "photos" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-2">
              <Camera size={16} className="text-emerald-700" />
              <span>คลังภาพบันทึกหลักฐานการตรวจ (Photo Albums)</span>
            </h3>
            <span className="text-xs text-slate-500">แยกหมวดหมู่ชัดเจน</span>
          </div>

          {/* Album 1: On-site Inspection Photos (รูปถ่ายหน้างาน) */}
          <div className="p-4 rounded-3xl bg-white border shadow-2xs space-y-3" style={{ borderColor: c.border }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900">📷 1. อัลบั้มรูปตรวจหน้างาน (Inspection Photos)</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                  {record.score < 85 ? '1 รูปบันทึกข้อบกพร่อง' : '1 รูปภาพสภาพทั่วไป'}
                </span>
              </div>
              <span className="text-xs text-slate-400">บันทึกโดยผู้ตรวจ</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="h-36 rounded-xl bg-slate-200/80 flex flex-col items-center justify-center text-slate-500 relative overflow-hidden border">
                  <Camera size={28} className="text-slate-400 mb-1" />
                  <span className="text-xs font-bold text-slate-700">รูปถ่ายหน้าเตาปรุงอาหาร (ข้อ 1)</span>
                  <span className="text-xs text-slate-400">บันทึกเมื่อ {record.date} 10:20 น.</span>
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-red-600 text-white text-[9.5px] font-bold">
                    Defect (ก่อนแก้ไข)
                  </div>
                </div>
                <div className="text-xs text-slate-600 font-medium">
                  💬 <b>คำอธิบาย:</b> {record.score < 85 ? "พบคราบไขมันสะสมบริเวณพื้นหลังเตาปรุงอาหาร" : "ทำความสะอาดเรียบร้อยตามมาตรฐาน SOP"}
                </div>
              </div>
            </div>
          </div>

          {/* Album 2: CAP Corrective Action Evidence Photos (รูปหลักฐานการแก้ไข) */}
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
                      <span className="text-xs font-bold text-emerald-950">รูปถ่ายหลังขัดล้างทำความสะอาด (ข้อ {cap.qNum})</span>
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
                {record.score < 85 
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
                <span className="font-serif italic text-lg text-emerald-800 font-bold">{record.auditor || "สมชาย ใจดี"}</span>
                <span className="text-xs text-slate-400 font-medium mt-1">ตรวจหน้างานเมื่อ {record.date} 10:45 น.</span>
              </div>
              <div className="text-xs text-slate-600 font-medium text-center">
                สถานะ: <span className="font-bold text-emerald-700">✓ ยืนยันการตรวจสำเร็จ</span>
              </div>
            </div>

            {/* Store Manager Signature */}
            <div className="p-4 rounded-2xl bg-white border shadow-2xs space-y-2" style={{ borderColor: c.border }}>
              <div className="text-xs font-bold text-slate-400">ลายมือชื่อผู้จัดการสาขารับทราบผล</div>
              <div className="h-24 rounded-xl bg-slate-50 border border-dashed border-slate-200 flex flex-col items-center justify-center">
                <span className="font-serif italic text-lg text-slate-700 font-bold">Store Manager</span>
                <span className="text-xs text-slate-400 font-medium mt-1">ลงนามรับทราบเมื่อ {record.date} 11:15 น.</span>
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
