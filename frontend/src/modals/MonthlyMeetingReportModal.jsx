import React, { useState, useMemo } from "react";
import { BarChart3, Download, X } from "lucide-react";

import { c, mono } from "../config/theme";
import { DataContext } from "../context/DataContext";
import ModalWrapper from "../shared/ModalWrapper";

export default function MonthlyMeetingReportModal({ onClose }) {
  const { visibleLocations = [], auditRecords = [], capTasks = [] } = React.useContext(DataContext);

  // ── ชื่อเดือนปัจจุบัน (ภาษาไทย + พ.ศ.) ──────────────────────────────────
  const now = new Date();
  const thaiMonths = [
    'มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
    'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม',
  ];
  const currentMonthName = `${thaiMonths[now.getMonth()]} ${now.getFullYear() + 543}`;
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // ── auditRecords ของเดือนนี้ ──────────────────────────────────────────────
  const monthRecords = useMemo(() =>
    auditRecords.filter(r => {
      const d = new Date(r.auditDate || r.submittedAt || r.createdAt);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }),
    [auditRecords, currentMonth, currentYear]
  );

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const totalLocations = visibleLocations.length;
  const avgScore = monthRecords.length > 0
    ? Math.round(monthRecords.reduce((sum, r) => sum + (r.percentageScore || r.score || 0), 0) / monthRecords.length)
    : 0;
  const passRate = monthRecords.length > 0
    ? Math.round(monthRecords.filter(r => r.isPassed).length / monthRecords.length * 100)
    : 0;
  const passedCount = monthRecords.filter(r => r.isPassed).length;
  const excellentCount = monthRecords.filter(r => (r.percentageScore || r.score || 0) >= 90).length;
  const excellentRate = monthRecords.length > 0
    ? Math.round(excellentCount / monthRecords.length * 100)
    : 0;

  // ── คะแนนแยกหมวดหมู่ ──────────────────────────────────────────────────────
  const sectionBreakdown = useMemo(() => {
    const sectionScores = {};
    monthRecords.forEach(r => {
      (r.responses || []).forEach(resp => {
        const sec = resp.sectionTitle || resp.surveySection?.title || 'อื่นๆ';
        if (!sectionScores[sec]) sectionScores[sec] = { total: 0, count: 0 };
        sectionScores[sec].total += (resp.scoreGiven || 0);
        sectionScores[sec].count += (resp.fullScore || 10);
      });
    });
    return Object.entries(sectionScores).map(([title, s]) => ({
      title,
      percent: s.count > 0 ? Math.round(s.total / s.count * 100) : 0,
    }));
  }, [monthRecords]);

  // ── Top 5 Defects ─────────────────────────────────────────────────────────
  const topDefects = useMemo(() => {
    const defectMap = {};
    monthRecords.forEach(r => {
      (r.responses || []).forEach(resp => {
        if (resp.isPassed === false && !resp.isNa) {
          const key = resp.questionText || resp.surveyItem?.text || 'ไม่ระบุ';
          defectMap[key] = (defectMap[key] || 0) + 1;
        }
      });
    });
    return Object.entries(defectMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([text, count]) => ({ text, count }));
  }, [monthRecords]);

  // ── CAP Stats ─────────────────────────────────────────────────────────────
  const monthCaps = useMemo(() =>
    capTasks.filter(c => {
      const d = new Date(c.createdAt);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }),
    [capTasks, currentMonth, currentYear]
  );
  const closedCaps = monthCaps.filter(c => c.status === 'CLOSED' || c.status === 'closed').length;
  const totalCaps = monthCaps.length;
  const pendingCaps = totalCaps - closedCaps;

  const handleExportCsv = () => {
    let csv = "\uFEFF";
    csv += `รายงานสรุปผลการตรวจสำหรับที่ประชุมประจำเดือน (Monthly Meeting Quality Review)\n`;
    csv += `ประจำเดือน: ${currentMonthName}, วันที่ออกรายงาน: ${new Date().toLocaleDateString('th-TH')}\n\n`;
    
    csv += `1. สรุปภาพรวม KPI ประจำเดือน\n`;
    csv += `สาขาทั้งหมด,สาขาที่ตรวจแล้วในเดือนนี้,คะแนนเฉลี่ยรวม(%),อัตราผ่านเกณฑ์(%),ดีเยี่ยม(≥90%),ผ่านเกณฑ์(≥85%),ตกเกณฑ์\n`;
    csv += `"${totalLocations}","${monthRecords.length}","${avgScore}%","${passRate}%","${excellentCount}","${passedCount}","${monthRecords.length - passedCount}"\n\n`;
    
    csv += `2. ผลคะแนนเฉลี่ยแยกตามหมวดหมู่\n`;
    csv += `ลำดับ,หมวดหมู่,คะแนนเฉลี่ย(%)\n`;
    if (sectionBreakdown.length > 0) {
      sectionBreakdown.forEach((s, idx) => {
        csv += `"${idx + 1}","${s.title}","${s.percent}%"\n`;
      });
    } else {
      csv += `"-","ไม่พบข้อมูลคำตอบการตรวจในเดือนนี้","-"\n`;
    }
    csv += `\n`;

    csv += `3. Top 5 ข้อบกพร่องที่พบบ่อย (Defect Frequency)\n`;
    csv += `ลำดับ,ข้อบกพร่อง,จำนวนครั้งที่พบ\n`;
    if (topDefects.length > 0) {
      topDefects.forEach((d, idx) => {
        csv += `"${idx + 1}","${d.text}","${d.count} ครั้ง"\n`;
      });
    } else {
      csv += `"-","ไม่พบข้อบกพร่องในเดือนนี้","-"\n`;
    }
    csv += `\n`;

    csv += `4. สถานะงานแก้ไข CAP ประจำเดือน\n`;
    csv += `งาน CAP ทั้งหมด,ปิดงานสำเร็จ (Closed),รอดำเนินการ (Pending)\n`;
    csv += `"${monthCaps.length}","${closedCaps}","${pendingCaps}"\n`;

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `QSC_Monthly_Meeting_Report_${currentYear + 543}_${currentMonth + 1}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <ModalWrapper onClose={onClose} maxWidth="max-w-2xl">
      {/* Header */}
      <div className="shrink-0 p-4 sm:p-5 border-b flex items-center justify-between" style={{ borderColor: c.border, background: "#FAF9F5" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-800 shrink-0">
            <BarChart3 size={20} />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-800">รายงานสรุปผลการตรวจสำหรับที่ประชุมประจำเดือน</h3>
            <p className="text-xs text-slate-500">Executive Monthly Quality &amp; Standards Review</p>
          </div>
        </div>
        <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-200 active:scale-90 cursor-pointer transition-all">
          <X size={18} style={{ color: c.faint }} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 space-y-5">
        {/* Period Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
          <div>
            <div className="text-xs font-bold text-slate-400">รอบรายงาน</div>
            <div className="text-xs sm:text-sm font-bold text-slate-800">
              สรุปผลการตรวจสอบมาตรฐาน Q.S.C. ประจำเดือน {currentMonthName}
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs">
            ตรวจแล้ว {monthRecords.length}/{totalLocations} สาขา
          </span>
        </div>

        {/* Executive KPI Summary */}
        <div>
          <div className="text-xs font-bold text-slate-500 mb-2">สรุปภาพรวม KPI ประจำเดือน</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-center">
              <div className="text-2xl font-bold text-slate-800 font-mono">{avgScore}%</div>
              <div className="text-xs text-slate-500 font-bold mt-0.5">คะแนนเฉลี่ยรวม</div>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
              <div className="text-2xl font-bold text-emerald-800 font-mono">{passRate}%</div>
              <div className="text-xs text-emerald-700 font-bold mt-0.5">อัตราผ่านเกณฑ์</div>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
              <div className="text-2xl font-bold text-emerald-800 font-mono">{excellentRate}%</div>
              <div className="text-xs text-emerald-700 font-bold mt-0.5">ดีเยี่ยม (≥90%)</div>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
              <div className="text-2xl font-bold text-emerald-800 font-mono">{monthRecords.length}</div>
              <div className="text-xs text-emerald-700 font-bold mt-0.5">สาขาที่ตรวจแล้ว</div>
            </div>
          </div>
        </div>

        {/* Section Breakdown */}
        {sectionBreakdown.length > 0 && (
          <div>
            <div className="text-xs font-bold text-slate-500 mb-2">คะแนนเฉลี่ยแยกตามหมวดหมู่</div>
            <div className="space-y-2">
              {sectionBreakdown.map((s, idx) => (
                <div key={idx} className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                    <span className="text-slate-700">{s.title}</span>
                    <span className={s.percent >= 85 ? "text-emerald-700" : "text-amber-700"}>
                      {s.percent}%
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        s.percent >= 90 ? "bg-emerald-500" : s.percent >= 85 ? "bg-[#0F6659]" : "bg-amber-500"
                      }`}
                      style={{ width: `${s.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top 5 Defect Frequency */}
        <div>
          <div className="text-xs font-bold text-slate-500 mb-2">Top 5 ข้อบกพร่องที่พบบ่อย (Defect Frequency)</div>
          {topDefects.length > 0 ? (
            <div className="space-y-1.5">
              {topDefects.map((d, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-rose-50/60 border border-rose-200/60 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 text-rose-900 font-medium">
                    <span className="w-5 h-5 rounded-full bg-rose-200 text-rose-800 font-bold flex items-center justify-center text-[10px] shrink-0">
                      {idx + 1}
                    </span>
                    <span className="line-clamp-1">{d.text}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-bold shrink-0">
                    {d.count} ครั้ง
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-400 font-medium">
              ไม่พบข้อบกพร่องในเดือนนี้
            </div>
          )}
        </div>

        {/* CAP Status */}
        <div>
          <div className="text-xs font-bold text-slate-500 mb-2">สถานะงานแก้ไขข้อบกพร่อง (CAP) ประจำเดือน</div>
          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-center">
              <div className="text-xl font-bold text-slate-800 font-mono">{totalCaps}</div>
              <div className="text-xs text-slate-500 font-bold mt-0.5">งาน CAP ทั้งหมด</div>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
              <div className="text-xl font-bold text-emerald-800 font-mono">{closedCaps}</div>
              <div className="text-xs text-emerald-700 font-bold mt-0.5">ปิดงานแล้ว</div>
            </div>
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-center">
              <div className="text-xl font-bold text-amber-800 font-mono">{pendingCaps}</div>
              <div className="text-xs text-amber-700 font-bold mt-0.5">รอดำเนินการ</div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="shrink-0 p-4 border-t bg-slate-50 flex items-center justify-between gap-2" style={{ borderColor: c.border }}>
        <button
          type="button"
          onClick={handleExportCsv}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-white border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-700 cursor-pointer shadow-2xs transition-all active:scale-95"
        >
          <Download size={14} />
          <span>ส่งออกสรุปรายงานประจำเดือน (.csv)</span>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-5 py-2.5 rounded-2xl bg-[#0F6659] hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer shadow-md transition-all active:scale-95"
        >
          ปิดหน้ารายงาน
        </button>
      </div>
    </ModalWrapper>
  );
}
