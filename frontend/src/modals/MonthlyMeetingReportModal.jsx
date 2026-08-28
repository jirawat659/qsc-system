import React, { useState, useMemo } from "react";
import {
  ShieldCheck,
  BarChart3,
  Download,
  X,
} from "lucide-react";

import { c, mono } from "../config/theme";
import { DataContext } from "../context/DataContext";
import ModalWrapper from "../shared/ModalWrapper";

export default function MonthlyMeetingReportModal({ onClose }) {
  const { locations = [], auditRecords = [], capTasks = [] } = React.useContext(DataContext);

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
  const totalLocations = locations.length;
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
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800">
            {totalLocations > 0 ? `${totalLocations} สาขา` : 'ยังไม่มีข้อมูลสาขา'}
          </span>
        </div>

        {/* 1. Core KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
            <div className="text-xs font-bold text-emerald-800">อัตราผ่านเกณฑ์ (≥85%)</div>
            <div className="text-xl font-bold text-emerald-900 font-mono mt-0.5">{passRate}%</div>
            <div className="text-xs text-emerald-700">{passedCount} จาก {monthRecords.length} รายการ</div>
          </div>
          <div className="p-3 rounded-2xl bg-teal-50 border border-teal-200">
            <div className="text-xs font-bold text-teal-800">ดีเยี่ยม (≥90%)</div>
            <div className="text-xl font-bold text-teal-900 font-mono mt-0.5">{excellentRate}%</div>
            <div className="text-xs text-teal-700">{excellentCount} รายการตัวอย่าง</div>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="text-xs font-bold text-slate-600">เวลาตรวจเฉลี่ย/สาขา</div>
            <div className="text-xl font-bold text-slate-800 font-mono mt-0.5">-</div>
            <div className="text-xs text-slate-400">ไม่มีข้อมูลในระบบ</div>
          </div>
          <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200">
            <div className="text-xs font-bold text-amber-800">คะแนนเฉลี่ย</div>
            <div className="text-xl font-bold text-amber-900 font-mono mt-0.5">{avgScore}%</div>
            <div className="text-xs text-amber-700">{monthRecords.length} รายการตรวจ</div>
          </div>
        </div>

        {/* 2. Category Breakdown */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-700">คะแนนเฉลี่ยแยกตามหมวดหมู่ (Category Averages)</h4>
          {sectionBreakdown.length > 0 ? (
            <div className="space-y-2">
              {sectionBreakdown.map(cat => (
                <div key={cat.title} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-slate-700">
                    <span>{cat.title}</span>
                    <span style={{ fontFamily: mono }}>{cat.percent}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full bg-[#0F6659]" style={{ width: `${cat.percent}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-400">
              ไม่มีข้อมูลหมวดหมู่สำหรับเดือนนี้
            </div>
          )}
        </div>

        {/* 3. Top 5 Defect Frequency */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-700">ข้อบกพร่องที่พบบ่อยที่สุดในรอบเดือน (Top 5 Defect Frequency)</h4>
          {topDefects.length > 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
              {topDefects.map((def, idx) => (
                <div key={idx} className="p-3 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-red-100 text-red-700 font-bold text-xs flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-800 truncate">{def.text}</div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-red-700 font-mono">{def.count} ครั้ง</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-400">
              ไม่พบข้อบกพร่องในเดือนนี้
            </div>
          )}
        </div>

        {/* 4. CAP Summary */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-emerald-700" />
            <span>สรุปงาน CAP ประจำเดือน</span>
          </h4>
          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-center">
              <div className="text-xl font-bold text-slate-800 font-mono">{totalCaps}</div>
              <div className="text-xs text-slate-500 font-bold mt-0.5">รายการทั้งหมด</div>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
              <div className="text-xl font-bold text-emerald-800 font-mono">{closedCaps}</div>
              <div className="text-xs text-emerald-700 font-bold mt-0.5">ปิดแล้ว</div>
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
          onClick={() => {}}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-700 cursor-pointer shadow-2xs"
        >
          <Download size={14} /> ส่งออกสรุปรายงานประจำเดือน (.csv)
        </button>
        <button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-[#0F6659] text-white text-xs font-bold cursor-pointer shadow-md">
          ปิดหน้ารายงาน
        </button>
      </div>
    </ModalWrapper>
  );
}
