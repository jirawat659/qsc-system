import AuditHistoryDetail from "../audit/AuditHistoryDetail";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ClipboardCheck, ChevronRight, CheckCircle2, X, Search, Award, Info } from "lucide-react";


import { c, sans, mono, cardStyle } from "../../config/theme";
import { ROLES, NAV_BY_ROLE } from "../../config/roles";
import { TODAY, AUDIT_TYPES, AUDIT_TYPE_META, CAP_STATUS_MAP, REGION_LINES, BRAND_LINES } from "../../config/constants";
import { TopBarContext } from "../../context/TopBarContext";
import { DataContext } from "../../context/DataContext";
import { exportToExcel } from "../../utils/exportToExcel";

import ModalWrapper from "../../shared/ModalWrapper";
import Header from "../../shared/Header";
import Section from "../../shared/Section";
import ScoreRing from "../../shared/ScoreRing";
import HistoryList from "../../shared/HistoryList";
import ErrorBoundary from "../../shared/ErrorBoundary";
import CapSubmissionModal from "../../modals/CapSubmissionModal";
import ViewCapEvidenceModal from "../../modals/ViewCapEvidenceModal";


export default function AuditeeAuditHistoryView() {
  const { locations: allLocations, auditRecords } = React.useContext(DataContext);
  const [selectedAuditLog, setSelectedAuditLog] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const myUnit = allLocations[0] || {}; // สาขาของ Auditee

  const branchHistory = useMemo(() => {
    if (!myUnit || !myUnit.id) return [];
    const fromDb = (auditRecords || []).filter(r => 
      (r.locationId && r.locationId === myUnit.id) || 
      (r.locationName && (r.locationName === myUnit.name || r.locationName === myUnit.fullName)) ||
      (r.location?.name && (r.location.name === myUnit.name || r.location.name === myUnit.fullName))
    );

    if (fromDb.length > 0) {
      return fromDb.map(r => {
        const score = Math.round(r.percentageScore || 0);
        const rawDate = r.auditDate || r.createdAt;
        const dateFormatted = rawDate ? new Date(rawDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) : "15 ส.ค. 2569";
        const auditorVal = r.primaryAuditor?.fullName || r.auditorName || r.auditor || "นายสมชาย ใจดี";
        const formVal = r.surveyFormTitle || r.surveyForm?.title || r.form || "แบบฟอร์มมาตรฐาน 5 ดาว (QSC Core)";
        return {
          id: r.id,
          date: dateFormatted,
          auditDate: rawDate,
          score: score,
          percentageScore: score,
          auditor: auditorVal,
          auditorName: auditorVal,
          form: formVal,
          formName: formVal,
          auditType: (r.auditType === 'unannounced' || r.auditType === 'spot') ? "นอกกำหนดการ" : (r.auditType === 'undercover' ? "ปลอมตัว" : "ตามกำหนดการ"),
          status: r.isPassed ? "pass" : "fail",
          isPassed: r.isPassed,
          hasCriticalDefect: r.hasCriticalDefect,
          ...r
        };
      });
    }

    return myUnit.history || [];
  }, [auditRecords, myUnit]);

  if (selectedAuditLog) {
    return (
      <AuditHistoryDetail
        unitName={myUnit.fullName || myUnit.name}
        record={selectedAuditLog}
        onBack={() => setSelectedAuditLog(null)}
      />
    );
  }

  const filteredHistory = (branchHistory || []).filter(h => {
    const matchStatus = filterStatus === "all" || 
      (filterStatus === "passed" && h.score >= 85) || 
      (filterStatus === "cap" && h.score < 85);
    const q = searchTerm.toLowerCase();
    const matchSearch = !searchTerm.trim() || 
      (h.date && h.date.toLowerCase().includes(q)) || 
      (h.auditor && h.auditor.toLowerCase().includes(q)) || 
      (h.status && h.status.toLowerCase().includes(q));
    return matchStatus && matchSearch;
  });

  return (
    <div className="page-transition p-4 sm:p-5 space-y-3.5 w-full max-w-[100%] sm:max-w-[96%] md:max-w-[92%] mx-auto pb-12">
      {/* 🌟 1. PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-0.5">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900">
            ประวัติการตรวจ: {myUnit.fullName || myUnit.name}
          </h2>
          <p className="text-xs font-medium text-slate-500">
            ผลคะแนนและการตรวจประเมินย้อนหลังทั้งหมด
          </p>
        </div>
        <span className="text-xs font-bold px-3 py-1 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-200 self-start sm:self-auto shadow-2xs">
          ทั้งหมด {myUnit.history?.length || 0} รอบ
        </span>
      </div>

      {/* 🌟 UNIFIED SUMMARY BAR (สไตล์เดียวกับ Dashboard หลัก) */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <h3 className="text-sm sm:text-base font-extrabold text-slate-800">
              ภาพรวมผลการตรวจประเมินของสาขา
            </h3>
            <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              {myUnit.fullName || myUnit.name}
            </span>
          </div>
          <span className="text-xs font-bold text-slate-400">
            ทั้งหมด {myUnit.history?.length || 0} รอบตรวจ
          </span>
        </div>

        {/* 3 Metric Columns with Hairline Dividers */}
        <div className="grid grid-cols-3 divide-x divide-slate-100 pt-0.5">
          <div className="px-2 sm:px-4 py-1 text-center flex flex-col justify-between gap-1">
            <div className="flex items-center justify-center gap-1 text-xs font-bold text-slate-500">
              <Award size={14} className="text-amber-700 shrink-0" />
              <span>คะแนนรอบล่าสุด</span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-amber-900 leading-tight" style={{ fontFamily: mono }}>
              {myUnit.lastScore}%
            </div>
            <div>
              <span className={`inline-block text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-md ${
                myUnit.lastScore >= 85 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"
              }`}>
                {myUnit.lastScore >= 85 ? "✓ ผ่านเกณฑ์" : "⚠️ ต้องส่งงานแก้ไข"}
              </span>
            </div>
          </div>

          <div className="px-2 sm:px-4 py-1 text-center flex flex-col justify-between gap-1">
            <div className="flex items-center justify-center gap-1 text-xs font-bold text-slate-500">
              <ClipboardCheck size={14} className="text-slate-600 shrink-0" />
              <span>ตรวจประเมินแล้ว</span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 leading-tight" style={{ fontFamily: mono }}>
              {myUnit.history?.length || 0} <span className="text-xs font-bold text-slate-400">รอบ</span>
            </div>
            <div>
              <span className="inline-block text-[10px] sm:text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                ประวัติสมบูรณ์
              </span>
            </div>
          </div>

          <div className="px-2 sm:px-4 py-1 text-center flex flex-col justify-between gap-1">
            <div className="flex items-center justify-center gap-1 text-xs font-bold text-slate-500">
              <CheckCircle2 size={14} className="text-emerald-700 shrink-0" />
              <span>ผ่านเกณฑ์</span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-800 leading-tight" style={{ fontFamily: mono }}>
              {myUnit.history ? myUnit.history.filter(h => h.score >= 85).length : 0} <span className="text-xs font-bold text-slate-400">รอบ</span>
            </div>
            <div>
              <span className="inline-block text-[10px] sm:text-[11px] font-bold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                เกณฑ์ผ่าน ≥85%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 🌟 3. SEARCH & FILTER BAR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-0.5">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาวันที่ตรวจ หรือชื่อผู้ตรวจ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs sm:text-sm pl-9 pr-8 py-2.5 rounded-2xl bg-white border border-slate-200 shadow-2xs outline-none font-bold text-slate-800 focus:border-[#0F6659] transition-colors"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer rounded-lg">
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
          {[
            { key: "all", label: "ทุกรอบตรวจ" },
            { key: "passed", label: "ผ่านเกณฑ์ (≥85%)" },
            { key: "cap", label: "มีงานแก้ไข (<85%)" },
          ].map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilterStatus(tab.key)}
              className={`px-3 py-2 rounded-xl text-xs font-bold shrink-0 cursor-pointer transition-colors ${
                filterStatus === tab.key
                  ? 'bg-[#0F6659] text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 🌟 4. AUDIT LIST */}
      <div className="flex flex-col gap-2.5 pt-0.5">
        {filteredHistory.map((h, idx) => {
          const isLatest = myUnit.history && myUnit.history.length > 0 && h.date === myUnit.history[0].date;
          const isPass = h.score >= 85;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => setSelectedAuditLog(h)}
              className="w-full rounded-2xl p-3.5 sm:p-4 bg-white border border-slate-200 shadow-2xs hover:border-emerald-500 hover:shadow-xs transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left group active:scale-98"
            >
              {/* Left Info with Score Ring */}
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                <ScoreRing score={h.score} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-[#0F6659] transition-colors leading-snug">
                      รอบตรวจวันที่ {h.date}
                    </h3>
                    {isLatest && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900">
                        ล่าสุด
                      </span>
                    )}
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                      isPass ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
                    }`}>
                      {isPass ? "✓ ผ่านเกณฑ์" : "⚠️ มีงานแก้ไข"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-600 flex-wrap">
                    <span className="font-medium">ผู้ตรวจ: {h.auditor || "สมชาย ใจดี"}</span>
                    <span className="text-slate-300">•</span>
                    <span>ฟอร์มร้านอาหาร v3</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-400">ลงนามแล้ว</span>
                  </div>
                </div>
              </div>

              {/* Right Action Button */}
              <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 text-[#0F6659] font-bold text-xs group-hover:bg-[#0F6659] group-hover:text-white transition-all self-end sm:self-center shrink-0 shadow-2xs">
                <span>ดูผลตรวจรายข้อ</span>
                <ChevronRight size={14} />
              </div>
            </button>
          );
        })}

        {filteredHistory.length === 0 && (
          <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-slate-200 text-xs text-slate-400 font-bold">
            ไม่พบประวัติการตรวจที่ตรงกับคำค้นหา
          </div>
        )}
      </div>
    </div>
  );
}
