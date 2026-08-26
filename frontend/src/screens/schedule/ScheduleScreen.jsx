import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  CalendarDays, List, Plus, Users, ChevronLeft, ChevronRight,
  Clock, ChevronDown, X, MapPin, Check, AlertCircle, Sparkles
} from "lucide-react";

import { c, sans, mono, cardStyle } from "../../config/theme";
import { TODAY } from "../../config/constants";
import { INITIAL_SCHEDULE } from "../../mocks/schedule";
import { AUDITORS_LIST } from "../../mocks/auditors";
import { DataContext } from "../../context/DataContext";

import Header from "../../shared/Header";
import AuditorSelectModal from "../../modals/AuditorSelectModal";
import NewScheduleModal from "../../modals/NewScheduleModal";
import ScheduleItemDetail from "./ScheduleItemDetail";
import AuditeeAuditHistoryView from "./AuditeeAuditHistoryView";

export default function ScheduleScreen({ role, isDesktop, onStartAuditDirect, currentAuditorName, onBack }) {
  if (role === "AUDITEE") {
    return <AuditeeAuditHistoryView />;
  }

  const [view, setView] = useState("calendar"); // 'calendar' | 'list'
  const isAggregate = role !== "AUDITOR" && role !== "AUDITEE";
  const [auditorFilter, setAuditorFilter] = useState(() => (role === "AUDITOR" && currentAuditorName) ? currentAuditorName : "ทั้งหมด");
  const [selectedDay, setSelectedDay] = useState(18);
  const [detail, setDetail] = useState(null);
  const [showAuditorModal, setShowAuditorModal] = useState(false);
  const { schedules, locations, forms, refreshData } = React.useContext(DataContext);
  const [showNewScheduleModal, setShowNewScheduleModal] = useState(false);

  const scheduleList = useMemo(() => {
    if (schedules && schedules.length > 0) {
      return schedules.map(s => {
        const dateObj = new Date(s.scheduledDate);
        const day = !isNaN(dateObj.getDate()) ? dateObj.getDate() : 18;
        const timeStr = !isNaN(dateObj.getHours()) 
          ? `${String(dateObj.getHours()).padStart(2, '0')}:00 - ${String(dateObj.getHours() + 2).padStart(2, '0')}:00 น.` 
          : "10:00 - 12:00 น.";
        
        return {
          id: s.id,
          locationId: s.locationId,
          unit: s.locationName,
          unitFullName: s.locationFullName || s.locationName,
          region: s.region || "กรุงเทพฯ",
          day,
          date: `${day} ส.ค. 2569`,
          time: timeStr,
          auditor: s.auditorName || "สมชาย ใจดี",
          form: s.surveyFormTitle || "แบบฟอร์มมาตรฐาน 5 ดาว",
          status: s.status === "completed" ? "done" : s.status === "in_progress" ? "today" : "upcoming",
          auditType: s.auditType || "announced",
          notes: s.notes
        };
      });
    }
    return INITIAL_SCHEDULE;
  }, [schedules]);

  const MONTH_LABELS = ["กรกฎาคม 2569", "สิงหาคม 2569", "กันยายน 2569"];
  const [monthOffset, setMonthOffset] = useState(1); // 1 = สิงหาคม 2569

  useEffect(() => {
    if (role === "AUDITOR" && currentAuditorName) {
      setAuditorFilter(currentAuditorName);
    }
  }, [role, currentAuditorName]);

  if (detail) {
    return (
      <ScheduleItemDetail
        item={detail}
        onBack={() => setDetail(null)}
        onStartAudit={onStartAuditDirect}
        role={role}
      />
    );
  }

  const statusStyle = {
    today: { label: "วันนี้", fg: "#0F6659", bg: "#E3F0ED" },
    upcoming: { label: "นัดหมาย", fg: "#3B82F6", bg: "#EFF6FF" },
    done: { label: "เสร็จแล้ว", fg: "#6B7280", bg: "#F3F4F6" },
  };

  const filtered = scheduleList
    .filter((s) => auditorFilter === "ทั้งหมด" || s.auditor === auditorFilter)
    .sort((a, b) => a.day - b.day || (a.time || "").localeCompare(b.time || ""));

  const dayItems = monthOffset === 1
    ? scheduleList.filter((s) => s.day === selectedDay && (auditorFilter === "ทั้งหมด" || s.auditor === auditorFilter))
    : [];

  return (
    <div className="page-transition p-4 sm:p-6 space-y-4 w-full max-w-[100%] sm:max-w-[96%] md:max-w-[92%] mx-auto pb-24">
      {onBack && (
        <Header
          title={role === "STANDARD" ? "แผนการตรวจและตารางเวลา" : "ตารางเวลาการตรวจ"}
          subtitle="ปฏิทินและแผนการลงตรวจสาขา"
          onBack={onBack}
        />
      )}

      {/* 🌟 1. TOP HEADER (Full Width Button & Top Right View Switcher) */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-3.5">
        {/* Row 1: Title on left, View switcher on top right */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-extrabold text-[#0F6659] flex items-center gap-1.5">
              <CalendarDays size={14} />
              <span>แผนและนัดหมายการลงตรวจ</span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-slate-800 tracking-tight mt-0.5 truncate">
              {role === "AUDITOR"
                ? `งานตรวจของฉัน (${currentAuditorName || "ผู้ตรวจ"})`
                : role === "AUDITEE"
                ? "กำหนดการตรวจสาขา"
                : "ตารางเวลานัดหมายการตรวจ"}
            </h2>
          </div>

          {/* View Toggle Buttons [📅] [📋] in Top Right Corner */}
          <div className="flex rounded-2xl overflow-hidden border border-slate-200 p-1 bg-slate-50 shadow-2xs shrink-0">
            <button
              type="button"
              onClick={() => setView("calendar")}
              className={`px-3 py-2 rounded-xl cursor-pointer transition-all flex items-center justify-center ${
                view === "calendar"
                  ? "bg-[#0F6659] text-white shadow-2xs"
                  : "text-slate-400 hover:text-slate-700"
              }`}
              title="มุมมองปฏิทิน"
            >
              <CalendarDays size={16} />
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={`px-3 py-2 rounded-xl cursor-pointer transition-all flex items-center justify-center ${
                view === "list"
                  ? "bg-[#0F6659] text-white shadow-2xs"
                  : "text-slate-400 hover:text-slate-700"
              }`}
              title="มุมมองรายการ"
            >
              <List size={16} />
            </button>
          </div>
        </div>

        {/* Row 2: Full Width Action Button */}
        <button
          type="button"
          onClick={() => setShowNewScheduleModal(true)}
          className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-tr from-[#0F6659] via-[#117a6b] to-emerald-700 hover:opacity-95 text-white font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-md active:scale-[0.99] transition-all cursor-pointer"
        >
          <Plus size={18} />
          <span>กำหนดการตรวจใหม่</span>
        </button>
      </div>

      {/* 🌟 2. AUDITOR FILTER BAR */}
      {isAggregate && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAuditorModal(true)}
            className="flex-1 flex items-center justify-between px-4 py-3 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 shadow-2xs cursor-pointer transition-all active:scale-[0.99]"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#0F6659] flex items-center justify-center shrink-0 border border-emerald-200/60 font-bold">
                <Users size={16} />
              </div>
              <div className="text-left min-w-0">
                <div className="text-xs font-bold text-slate-400">ผู้ตรวจประเมิน</div>
                <div className="text-xs sm:text-sm font-bold truncate text-slate-800">
                  {auditorFilter === "ทั้งหมด" ? "ผู้ตรวจทุกคน (ทั้งหมดในระบบ)" : auditorFilter}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-slate-400 shrink-0">
              <span className="text-xs font-bold text-[#0F6659] bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200/60">
                เลือก / ค้นหา
              </span>
              <ChevronDown size={15} />
            </div>
          </button>

          {auditorFilter !== "ทั้งหมด" && (
            <button
              type="button"
              onClick={() => setAuditorFilter("ทั้งหมด")}
              className="p-3 rounded-2xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-800 shadow-2xs cursor-pointer flex items-center justify-center shrink-0 transition-colors"
              title="รีเซ็ตแสดงทุกคน"
            >
              <X size={16} />
            </button>
          )}
        </div>
      )}

      {/* 🌟 3. CALENDAR VIEW (SIDE-BY-SIDE 2-COLUMN ON DESKTOP & TABLETS) */}
      {view === "calendar" ? (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-5 items-start">
          {/* 👈 LEFT COLUMN: COMPACT PROPORTIONAL CALENDAR (md:col-span-7) */}
          <div className="md:col-span-7 bg-white rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-2xs space-y-4">
            {/* Month Header Navigation */}
            <div className="flex items-center justify-between px-1">
              <button
                type="button"
                onClick={() => setMonthOffset((m) => Math.max(0, m - 1))}
                disabled={monthOffset === 0}
                className="p-2 hover:bg-slate-100 rounded-xl cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-slate-500 hover:text-slate-900"
              >
                <ChevronLeft size={18} />
              </button>

              <div className="text-center">
                <span className="text-base sm:text-lg font-bold text-slate-800 tracking-tight">
                  {MONTH_LABELS[monthOffset]}
                </span>
                <span className="text-xs text-slate-400 font-normal block mt-0.5">
                  {filtered.length} รายการตรวจในระบบ
                </span>
              </div>

              <button
                type="button"
                onClick={() => setMonthOffset((m) => Math.min(MONTH_LABELS.length - 1, m + 1))}
                disabled={monthOffset === MONTH_LABELS.length - 1}
                className="p-2 hover:bg-slate-100 rounded-xl cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-slate-500 hover:text-slate-900"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {monthOffset !== 1 && (
              <div className="text-center text-xs py-2 rounded-xl text-slate-500 bg-slate-50 border border-slate-200">
                ยังไม่มีนัดหมายในเดือนนี้ (ข้อมูลตัวอย่างมีในเดือนสิงหาคม 2569)
              </div>
            )}

            {/* Weekday Names Header */}
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-400">
              {["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."].map((d) => (
                <div key={d} className="py-1">{d}</div>
              ))}
            </div>

            {/* Calendar Days 7-column Grid */}
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                const hasEvent =
                  monthOffset === 1 &&
                  scheduleList.some(
                    (s) => s.day === day && (auditorFilter === "ทั้งหมด" || s.auditor === auditorFilter)
                  );
                const isSelected = day === selectedDay;
                const isToday = day === TODAY;
                const isPast = day < TODAY;

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    className="aspect-square rounded-2xl flex flex-col items-center justify-center text-xs sm:text-sm cursor-pointer transition-all relative group"
                    style={{
                      background: isSelected ? "#0F6659" : isToday ? "#E3F0ED" : "transparent",
                      color: isSelected ? "#fff" : isPast ? "#9CA3AF" : "#1C2129",
                      fontWeight: isSelected || isToday ? 600 : 400,
                      border: isToday && !isSelected ? "1.5px solid #0F6659" : "1px solid transparent",
                      opacity: isPast && !isSelected ? 0.6 : 1,
                    }}
                  >
                    <span className="leading-none">{day}</span>
                    {hasEvent && (
                      <span
                        className="w-1.5 h-1.5 rounded-full mt-1"
                        style={{ background: isSelected ? "#fff" : isPast ? "#9CA3AF" : "#0F6659" }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 👉 RIGHT COLUMN: FRAMED WHITE CARD FOR SELECTED DAY LIST (md:col-span-5) */}
          <div className="md:col-span-5 bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-2xs space-y-3.5">
            {/* Header of Selected Day with clean border divider */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2.5 h-2.5 rounded-full bg-[#0F6659] shrink-0" />
                <h3 className="text-sm sm:text-base font-bold text-slate-800 truncate">
                  วันที่ {selectedDay} {MONTH_LABELS[monthOffset]}
                </h3>
              </div>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-lg bg-emerald-50 text-[#0F6659] border border-emerald-200 shrink-0">
                {dayItems.length} นัดหมาย
              </span>
            </div>

            {/* List of Day Audit Cards inside the Frame */}
            <div className="space-y-2.5 max-h-[440px] overflow-y-auto pr-1 custom-tab-scrollbar">
              {dayItems.map((s, i) => {
                const st = statusStyle[s.status] || { label: "นัดหมาย", fg: "#0F6659", bg: "#E3F0ED" };
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setDetail(s)}
                    className="w-full rounded-2xl p-3.5 sm:p-4 flex items-center gap-3 text-left bg-slate-50/70 hover:bg-emerald-50/40 border border-slate-200/80 hover:border-emerald-300 transition-all cursor-pointer group active:scale-[0.99]"
                  >
                    <div className="w-9 h-9 rounded-xl bg-white text-[#0F6659] flex items-center justify-center shrink-0 border border-slate-200 group-hover:bg-[#0F6659] group-hover:text-white transition-colors">
                      <Clock size={16} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-extrabold text-slate-800 truncate group-hover:text-[#0F6659] transition-colors">
                        {s.unitFullName || s.unit}
                      </div>
                      <div className="text-xs font-bold text-slate-400 mt-0.5 flex items-center gap-2 truncate">
                        <span>{s.time}</span>
                        {s.auditor && <span>· ผู้ตรวจ: {s.auditor}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className="text-xs font-extrabold px-2.5 py-1 rounded-full"
                        style={{ color: st.fg, background: st.bg }}
                      >
                        {st.label}
                      </span>
                      <ChevronRight size={15} className="text-slate-300 group-hover:text-slate-600 transition-colors" />
                    </div>
                  </button>
                );
              })}

              {dayItems.length === 0 && (
                <div className="text-center py-10 px-4 rounded-2xl bg-slate-50/50 border border-dashed border-slate-200 space-y-2.5">
                  <div className="w-12 h-12 rounded-2xl bg-white text-slate-300 flex items-center justify-center mx-auto border border-slate-200">
                    <CalendarDays size={22} />
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-slate-500">
                    ไม่มีกำหนดการตรวจในวันที่ {selectedDay} สิงหาคม
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowNewScheduleModal(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-[#0F6659] text-xs font-extrabold cursor-pointer border border-emerald-200/80 transition-all inline-flex items-center gap-1"
                  >
                    <Plus size={14} />
                    <span>เพิ่มนัดตรวจในวันนี้</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* 📋 LIST VIEW (CHRONOLOGICAL TIMELINE) */
        <div className="flex flex-col gap-3">
          {filtered.length === 0 && (
            <div className="text-center py-12 rounded-3xl font-bold text-sm text-slate-400 border border-dashed border-slate-200 bg-white">
              ไม่พบรายการตรวจที่ตรงกับตัวกรอง
            </div>
          )}
          {filtered.map((s, i) => {
            const st = statusStyle[s.status] || { label: "นัดหมาย", fg: "#0F6659", bg: "#E3F0ED" };
            const isPast = s.day < TODAY;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setDetail(s)}
                className="w-full rounded-3xl p-4 sm:p-5 flex items-center gap-4 text-left shadow-2xs hover:bg-slate-50 border border-slate-200 bg-white transition-colors cursor-pointer"
                style={{ opacity: isPast ? 0.65 : 1 }}
              >
                <div className="w-12 text-center shrink-0">
                  <div className="text-xl font-bold font-mono" style={{ color: isPast ? "#9CA3AF" : "#1C2129" }}>
                    {s.day}
                  </div>
                  <div className="text-xs font-medium text-slate-400">ส.ค.</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-extrabold text-slate-800 truncate">{s.unitFullName || s.unit}</div>
                  <div className="text-xs font-medium text-slate-400 mt-0.5">
                    {s.time} {s.auditor && `· ผู้ตรวจ: ${s.auditor}`}
                  </div>
                </div>
                <span
                  className="text-xs font-extrabold px-3 py-1 rounded-full shrink-0"
                  style={{ color: st.fg, background: st.bg }}
                >
                  {st.label}
                </span>
                <ChevronRight size={16} className="text-slate-400" />
              </button>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {showAuditorModal && (
        <AuditorSelectModal
          currentAuditor={auditorFilter}
          onSelect={(auditorName) => setAuditorFilter(auditorName)}
          onClose={() => setShowAuditorModal(false)}
        />
      )}

      {showNewScheduleModal && (
        <NewScheduleModal
          defaultDay={selectedDay}
          onClose={() => setShowNewScheduleModal(false)}
          onSave={(newSchedule) => {
            setScheduleList((prev) => [newSchedule, ...prev]);
            if (newSchedule.day) setSelectedDay(newSchedule.day);
          }}
        />
      )}
    </div>
  );
}
