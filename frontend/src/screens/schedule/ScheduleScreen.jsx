import React, { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, List, Plus, Users, ChevronLeft, ChevronRight, Clock, ChevronDown, X, Sparkles, CheckCircle2 } from "lucide-react";

import { c, sans, mono, cardStyle } from "../../config/theme";
import { TODAY } from "../../config/constants";
import { DataContext } from "../../context/DataContext";

import Header from "../../shared/Header";
import AuditorSelectModal from "../../modals/AuditorSelectModal";
import NewScheduleModal from "../../modals/NewScheduleModal";
import AiScheduleAdvisorModal from "../../modals/AiScheduleAdvisorModal";
import ScheduleItemDetail from "./ScheduleItemDetail";
import AuditeeAuditHistoryView from "./AuditeeAuditHistoryView";

export default function ScheduleScreen({ role, currentUser, isDesktop, onStartAuditDirect, currentAuditorName, onBack }) {
  const userRole = (role || currentUser?.role || "").toUpperCase();
  const isAuditor = userRole === "AUDITOR";
  const isAuditee = userRole === "AUDITEE";
  const isAggregate = !isAuditor && !isAuditee; // Only ADMIN, STANDARD, EXEC can see all auditors & choose auditor filter
  const myAuditorName = currentAuditorName || currentUser?.name || currentUser?.username || "";

  const canCreateSchedule = userRole === "STANDARD" || userRole === "ADMIN" || (currentUser?.permissions || []).includes("schedules.manage");
  const [view, setView] = useState("calendar"); // 'calendar' | 'list'
  const [auditorFilter, setAuditorFilter] = useState(() => isAuditor ? myAuditorName : "ทั้งหมด");
  const [selectedAuditorId, setSelectedAuditorId] = useState(null);
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [detail, setDetail] = useState(null);
  const [showAuditorModal, setShowAuditorModal] = useState(false);
  const { schedules, locations, allLocations, forms, auditRecords, refreshData, brands, activeDrafts } = React.useContext(DataContext);
  const [showNewScheduleModal, setShowNewScheduleModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [showAiQuickPopover, setShowAiQuickPopover] = useState(false);
  const [showAiDetailModal, setShowAiDetailModal] = useState(false);
  const [listPage, setListPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const LIST_PAGE_SIZE = 10;

  const scheduleList = useMemo(() => {
    if (schedules && schedules.length > 0) {
      return schedules.map(s => {
        const dateObj = new Date(s.scheduledDate);
        const day = !isNaN(dateObj.getDate()) ? dateObj.getDate() : 1;
        const h = !isNaN(dateObj.getHours()) ? dateObj.getHours() : 0;
        const m = !isNaN(dateObj.getMinutes()) ? dateObj.getMinutes() : 0;
        const timeFormatted = s.time || ((h === 0 && m === 0) 
          ? "-"
          : `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} - ${String(Math.min(23, h + 2)).padStart(2, '0')}:${String(m).padStart(2, '0')} น.`);
        
        const auditorNames = [
          s.auditorName,
          s.auditor,
          ...(s.auditors || []).map(a => a.fullName || a.name || a.username)
        ].filter(Boolean);

        // ตรวจสอบว่าสาขานี้ตรวจเสร็จแล้วหรือยัง
        const isCompleted = s.status === "completed" || s.status === "done" || s.isCompleted || (auditRecords || []).some(ar => {
          if (ar.auditScheduleId && Number(ar.auditScheduleId) === Number(s.id)) return true;
          if (Number(ar.locationId) === Number(s.locationId)) {
            const ad = new Date(ar.auditDate || ar.submittedAt || ar.createdAt);
            const diffDays = Math.abs((ad.getTime() - dateObj.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays <= 2 && (!s.surveyFormId || !ar.surveyFormId || Number(ar.surveyFormId) === Number(s.surveyFormId))) {
              return true;
            }
          }
          return false;
        });

        const hasActiveDraft = (activeDrafts || []).some(d =>
          (d.auditScheduleId && Number(d.auditScheduleId) === Number(s.id)) ||
          (Number(d.locationId) === Number(s.locationId) && (!s.surveyFormId || !d.surveyFormId || Number(d.surveyFormId) === Number(s.surveyFormId)))
        );

        const now = new Date();
        const isToday = !isNaN(dateObj.getTime()) && 
          dateObj.getFullYear() === now.getFullYear() && 
          dateObj.getMonth() === now.getMonth() && 
          dateObj.getDate() === now.getDate();

        let computedStatus = "upcoming";
        if (isCompleted) {
          computedStatus = "done";
        } else if (hasActiveDraft || s.status === "in_progress") {
          computedStatus = "in_progress";
        } else if (isToday) {
          computedStatus = "today";
        } else {
          computedStatus = "upcoming";
        }

        return {
          id: s.id,
          locationId: s.locationId,
          surveyFormId: s.surveyFormId,
          scheduledDate: s.scheduledDate,
          dateFormatted: !isNaN(dateObj.getTime()) ? dateObj.toISOString().slice(0, 10) : undefined,
          unit: s.locationName,
          unitFullName: s.locationFullName || s.locationName,
          locationName: s.locationName,
          region: s.region || "-",
          day,
          date: s.scheduledDate ? new Date(s.scheduledDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) : "-",
          time: timeFormatted,
          auditor: s.auditorName || s.auditor || (s.auditors?.[0]?.fullName) || "-",
          auditorName: s.auditorName || s.auditor || (s.auditors?.[0]?.fullName) || "-",
          auditorNames: auditorNames,
          auditors: s.auditors || [],
          auditorId: s.auditors?.[0]?.id || s.auditorId,
          auditorIds: (s.auditors || []).map(a => a.id || a.auditorId).filter(Boolean),
          createdBy: s.createdBy,
          form: s.surveyFormTitle || "-",
          surveyFormTitle: s.surveyFormTitle,
          status: computedStatus,
          isCompleted,
          auditType: s.auditType || "announced",
          notes: s.notes
        };
      });
    }
    return [];
  }, [schedules, auditRecords]);

  // Helper: Extract all distinct individual auditor name tokens for exact equality matching
  const getScheduleAuditorTokens = (s) => {
    const rawList = [
      s.auditor,
      s.auditorName,
      ...(Array.isArray(s.auditorNames) ? s.auditorNames : []),
      ...(Array.isArray(s.auditors) ? s.auditors.map(a => a?.fullName || a?.name || a?.username) : [])
    ];

    const tokens = new Set();
    rawList.filter(Boolean).forEach(item => {
      if (typeof item === "string") {
        const fullTrimmed = item.trim().toLowerCase();
        if (fullTrimmed && fullTrimmed !== "-") {
          tokens.add(fullTrimmed);
        }
        // Split delimited names (e.g. "QC Test, QC Test2" or "QC Test / QC Test2")
        item.split(/[,;/|\n]|\s+และ\s+|\s+&\s+/).forEach(part => {
          const cleaned = part.trim().toLowerCase();
          if (cleaned && cleaned !== "-") {
            tokens.add(cleaned);
          }
        });
      }
    });

    return Array.from(tokens);
  };

  // Filtered schedules by auditor (Instant in-memory filtering with exact name & ID match)
  const filteredSchedules = useMemo(() => {
    return scheduleList
      .filter((s) => {
        // If AUDITOR -> strictly restrict to their own assigned schedules only
        if (isAuditor) {
          const myId = currentUser?.id;
          const myTarget = (myAuditorName || currentUser?.name || currentUser?.fullName || "").toLowerCase().trim();
          const myUsername = (currentUser?.username || "").toLowerCase().trim();

          // 1. Match by Auditor ID
          if (myId) {
            const hasMyId = (s.auditors || []).some(a => (a.id === myId || a.auditorId === myId)) ||
                            (s.auditorIds || []).includes(myId) ||
                            s.auditorId === myId ||
                            s.createdBy === myId;
            if (hasMyId) return true;
          }

          // 2. Exact token matching on assigned auditor names
          const tokens = getScheduleAuditorTokens(s);
          if (myTarget && tokens.includes(myTarget)) return true;
          if (myUsername && tokens.includes(myUsername)) return true;

          return false;
        }

        // For ADMIN, STANDARD, EXEC
        if (!auditorFilter || auditorFilter === "ทั้งหมด") return true;

        // 1. Match by selected auditor ID if available
        if (selectedAuditorId) {
          const hasSelectedId = (s.auditors || []).some(a => (a.id === selectedAuditorId || a.auditorId === selectedAuditorId)) ||
                                (s.auditorIds || []).includes(selectedAuditorId) ||
                                s.auditorId === selectedAuditorId;
          if (hasSelectedId) return true;
        }

        // 2. Exact token matching on assigned auditor names
        const target = auditorFilter.toLowerCase().trim();
        const tokens = getScheduleAuditorTokens(s);
        if (tokens.includes(target)) return true;

        return false;
      })
      .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime() || (a.time || "").localeCompare(b.time || ""));
  }, [scheduleList, isAuditor, myAuditorName, currentUser?.id, currentUser?.name, currentUser?.username, auditorFilter, selectedAuditorId]);

  const todaySchedules = useMemo(() => {
    const now = new Date();
    const todayY = now.getFullYear();
    const todayM = now.getMonth();
    const todayD = now.getDate();
    return filteredSchedules.filter(s => {
      const d = new Date(s.scheduledDate);
      return d.getFullYear() === todayY && d.getMonth() === todayM && d.getDate() === todayD;
    });
  }, [filteredSchedules]);

  // รายการที่ยังไม่ได้ตรวจในวันนี้ (Pending Only)
  const pendingTodaySchedules = useMemo(() => {
    return todaySchedules.filter(s => s.status !== "done" && !s.isCompleted);
  }, [todaySchedules]);

  // จำนวนสาขาที่ตรวจเสร็จแล้วในวันนี้
  const completedTodayCount = useMemo(() => {
    return todaySchedules.filter(s => s.status === "done" || s.isCompleted).length;
  }, [todaySchedules]);

  // สาขาถัดไปที่ต้องเข้าตรวจ (ยังไม่ตรวจ)
  const nextScheduleToAudit = useMemo(() => {
    return pendingTodaySchedules.length > 0 ? pendingTodaySchedules[0] : null;
  }, [pendingTodaySchedules]);

  const prevMonth = () => {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const jumpToToday = () => {
    const now = new Date();
    setViewDate(now);
    setSelectedDate(now);
  };

  const currentMonthLabel = viewDate.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
  const selectedDateLabel = selectedDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });

  const isSameDay = (d1, d2) => {
    if (!d1 || !d2) return false;
    const a = new Date(d1);
    const b = new Date(d2);
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  };

  // 🌟 Real Dynamic Calendar Grid (Monday-first)
  const calendarGrid = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    // Total days in this month
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // First day of month (0 = Sun, 1 = Mon, ..., 6 = Sat)
    const firstDayRaw = new Date(year, month, 1).getDay();
    const startWeekday = (firstDayRaw + 6) % 7; // Mon = 0, Sun = 6

    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const cells = [];

    // 1. Previous month leading days
    for (let i = startWeekday - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      cells.push({
        day: dayNum,
        date: new Date(year, month - 1, dayNum),
        isCurrentMonth: false,
        isPrevMonth: true
      });
    }

    // 2. Current month days
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      cells.push({
        day: dayNum,
        date: new Date(year, month, dayNum),
        isCurrentMonth: true
      });
    }

    // 3. Next month trailing days to complete grid
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let dayNum = 1; dayNum <= remaining; dayNum++) {
      cells.push({
        day: dayNum,
        date: new Date(year, month + 1, dayNum),
        isCurrentMonth: false,
        isNextMonth: true
      });
    }

    return cells;
  }, [viewDate]);

  // Schedules in viewing month
  const monthScheduleCount = useMemo(() => {
    return filteredSchedules.filter(s => {
      const d = new Date(s.scheduledDate);
      return d.getFullYear() === viewDate.getFullYear() && d.getMonth() === viewDate.getMonth();
    }).length;
  }, [filteredSchedules, viewDate]);

  // Schedules on selected date
  const dayItems = useMemo(() => {
    return filteredSchedules.filter(s => isSameDay(s.scheduledDate, selectedDate));
  }, [filteredSchedules, selectedDate]);

  // Reset list page on filter or view change
  useEffect(() => {
    setListPage(1);
  }, [auditorFilter, viewDate, view]);

  useEffect(() => {
    setPageInput(String(listPage));
  }, [listPage]);

  const totalListPages = Math.max(1, Math.ceil(filteredSchedules.length / LIST_PAGE_SIZE));
  const paginatedSchedules = useMemo(() => {
    const start = (listPage - 1) * LIST_PAGE_SIZE;
    return filteredSchedules.slice(start, start + LIST_PAGE_SIZE);
  }, [filteredSchedules, listPage]);

  const handlePageSubmit = () => {
    const val = parseInt(pageInput, 10);
    if (!isNaN(val)) {
      const clamped = Math.max(1, Math.min(totalListPages, val));
      setListPage(clamped);
      setPageInput(String(clamped));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      setPageInput(String(listPage));
    }
  };

  const statusStyle = {
    today: { label: "วันนี้", fg: "#0F6659", bg: "#E3F0ED" },
    in_progress: { label: "กำลังตรวจ", fg: "#D97706", bg: "#FEF3C7" },
    upcoming: { label: "นัดหมาย", fg: "#059669", bg: "#ECFDF5" },
    done: { label: "เสร็จแล้ว", fg: "#64748B", bg: "#F1F5F9" },
  };

  if (role === "AUDITEE") {
    return <AuditeeAuditHistoryView />;
  }

  if (detail) {
    return (
      <ScheduleItemDetail
        item={detail}
        onBack={() => setDetail(null)}
        onStartAudit={onStartAuditDirect}
        role={role}
        onEdit={(itemToEdit) => {
          setDetail(null);
          setEditingSchedule(itemToEdit);
          setShowNewScheduleModal(true);
        }}
      />
    );
  }

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
              className={`px-3 py-2 rounded-2xl cursor-pointer transition-all flex items-center justify-center ${
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
              className={`px-3 py-2 rounded-2xl cursor-pointer transition-all flex items-center justify-center ${
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

        {/* Row 2: Full Width Action Button (Visible for STANDARD & ADMIN) */}
        {canCreateSchedule && (
          <button
            type="button"
            onClick={() => setShowNewScheduleModal(true)}
            className="w-full py-2.5 px-4 rounded-2xl bg-gradient-to-tr from-[#0F6659] via-[#117a6b] to-emerald-700 hover:opacity-95 text-white font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-md active:scale-[0.99] transition-all cursor-pointer"
          >
            <Plus size={18} />
            <span>กำหนดการตรวจใหม่</span>
          </button>
        )}
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
                ค้นหา
              </span>
              <ChevronDown size={15} />
            </div>
          </button>

          {auditorFilter !== "ทั้งหมด" && (
            <button
              type="button"
              onClick={() => {
                setAuditorFilter("ทั้งหมด");
                setSelectedAuditorId(null);
              }}
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
                onClick={prevMonth}
                className="p-2 hover:bg-slate-100 rounded-2xl cursor-pointer transition-colors text-slate-500 hover:text-slate-900"
                title="เดือนก่อนหน้า"
              >
                <ChevronLeft size={18} />
              </button>

              <div className="text-center flex flex-col items-center">
                <button
                  type="button"
                  onClick={jumpToToday}
                  className="group px-3 py-1 -my-1 rounded-2xl hover:bg-emerald-50/70 border border-transparent hover:border-emerald-200 transition-all cursor-pointer flex items-center justify-center active:scale-95"
                  title="คลิกเพื่อกลับไปยังเดือนและวันปัจจุบัน"
                >
                  <span className="text-base sm:text-lg font-bold text-slate-800 group-hover:text-[#0F6659] tracking-tight transition-colors">
                    {currentMonthLabel}
                  </span>
                </button>
                <span className="text-xs text-slate-400 font-normal block mt-0.5">
                  {monthScheduleCount} รายการตรวจในเดือนนี้
                </span>
              </div>

              <button
                type="button"
                onClick={nextMonth}
                className="p-2 hover:bg-slate-100 rounded-2xl cursor-pointer transition-colors text-slate-500 hover:text-slate-900"
                title="เดือนถัดไป"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Weekday Names Header */}
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-400">
              {["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."].map((d) => (
                <div key={d} className="py-1">{d}</div>
              ))}
            </div>

            {/* Calendar Days 7-column Grid */}
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {calendarGrid.map((cell, idx) => {
                const cellDate = cell.date;
                const cellSchedules = filteredSchedules.filter(s => isSameDay(s.scheduledDate, cellDate));
                const hasEvents = cellSchedules.length > 0;
                const isSelected = isSameDay(cellDate, selectedDate);
                const today = new Date();
                const isToday = isSameDay(cellDate, today);
                const isPast = cellDate < new Date(today.getFullYear(), today.getMonth(), today.getDate());

                const hasCompleted = cellSchedules.some(s => s.status === "done" || s.status === "completed");
                const hasPending = cellSchedules.some(s => s.status !== "done" && s.status !== "completed");

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSelectedDate(cellDate);
                      if (!cell.isCurrentMonth) {
                        setViewDate(new Date(cellDate.getFullYear(), cellDate.getMonth(), 1));
                      }
                    }}
                    className={`aspect-square rounded-2xl flex flex-col items-center justify-center text-xs sm:text-sm cursor-pointer transition-all relative group ${
                      !cell.isCurrentMonth ? "opacity-30 hover:opacity-70" : ""
                    } ${
                      isSelected 
                        ? "bg-[#0F6659] text-white font-bold" 
                        : isToday 
                        ? "bg-[#E3F0ED] text-[#1C2129] font-bold border-[1.5px] border-[#0F6659]" 
                        : isPast 
                        ? "text-slate-400 font-medium border border-transparent" 
                        : "text-[#1C2129] font-medium border border-transparent"
                    }`}
                  >
                    <span className="leading-none">{cell.day}</span>
                    {hasEvents && (
                      <div className="flex items-center gap-0.5 mt-1">
                        {hasCompleted && (
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white" : "bg-[#0F6659]"}`}
                          />
                        )}
                        {hasPending && (
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white" : "bg-[#0F6659]"}`}
                          />
                        )}
                      </div>
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
                  วันที่ {selectedDateLabel}
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
                    key={s.id || i}
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
                        className="text-xs font-extrabold px-2.5 py-1 rounded-lg"
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
                    ไม่มีกำหนดการตรวจในวันที่ {selectedDateLabel}
                  </div>
                  {canCreateSchedule && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSchedule(null);
                        setShowNewScheduleModal(true);
                      }}
                      className="px-3.5 py-1.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-[#0F6659] text-xs font-extrabold cursor-pointer border border-emerald-200/80 transition-all inline-flex items-center gap-1"
                    >
                      <Plus size={14} />
                      <span>เพิ่มนัดตรวจในวันนี้</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* 📋 LIST VIEW (CHRONOLOGICAL TIMELINE) */
        <div className="flex flex-col gap-3">
          {filteredSchedules.length === 0 && (
            <div className="text-center py-12 rounded-3xl font-bold text-sm text-slate-400 border border-dashed border-slate-200 bg-white">
              ไม่พบรายการตรวจที่ตรงกับตัวกรอง
            </div>
          )}
          {paginatedSchedules.map((s, i) => {
            const st = statusStyle[s.status] || { label: "นัดหมาย", fg: "#0F6659", bg: "#E3F0ED" };
            const schedDate = new Date(s.scheduledDate);
            const today = new Date();
            const isPast = schedDate < new Date(today.getFullYear(), today.getMonth(), today.getDate());
            return (
              <button
                key={s.id || i}
                type="button"
                onClick={() => setDetail(s)}
                className={`w-full rounded-3xl p-4 sm:p-5 flex items-center gap-4 text-left shadow-2xs hover:bg-slate-50 border border-slate-200 bg-white transition-colors cursor-pointer ${isPast ? "opacity-70" : "opacity-100"}`}
              >
                <div className="w-12 text-center shrink-0">
                  <div className={`text-xl font-bold font-mono ${isPast ? "text-slate-400" : "text-slate-900"}`}>
                    {!isNaN(schedDate.getDate()) ? schedDate.getDate() : s.day}
                  </div>
                  <div className="text-xs font-medium text-slate-400">
                    {!isNaN(schedDate.getTime()) ? schedDate.toLocaleDateString('th-TH', { month: 'short' }) : "ส.ค."}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-extrabold text-slate-800 truncate">{s.unitFullName || s.unit}</div>
                  <div className="text-xs font-medium text-slate-400 mt-0.5">
                    {s.time} {s.auditor && `· ผู้ตรวจ: ${s.auditor}`}
                  </div>
                </div>
                <span
                  className="text-xs font-extrabold px-3 py-1 rounded-lg shrink-0"
                  style={{ color: st.fg, background: st.bg }}
                >
                  {st.label}
                </span>
                <ChevronRight size={16} className="text-slate-400" />
              </button>
            );
          })}

          {/* Pagination Controls */}
          <div className="flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs text-xs font-medium text-slate-500 bg-white mt-2 mb-8">
            <span>
              หน้า {listPage} จาก {totalListPages} ({filteredSchedules.length} รายการ)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setListPage((p) => Math.max(1, p - 1));
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                disabled={listPage === 1}
                className="px-3 py-1.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold disabled:opacity-40 cursor-pointer transition-all active:scale-95 text-xs"
              >
                ก่อนหน้า
              </button>

              {/* ช่องเล็กสำหรับพิมพ์เลขหน้า (กด Enter หรือคลิกออกนอกช่องเพื่อเปลี่ยนหน้า) */}
              <input
                type="number"
                min="1"
                max={totalListPages}
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                onBlur={handlePageSubmit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handlePageSubmit();
                    e.target.blur();
                  }
                }}
                className="w-10 h-8 text-center text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-lg outline-none focus:border-[#0F6659] focus:ring-1 focus:ring-[#0F6659] shadow-2xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />

              <button
                type="button"
                onClick={() => {
                  setListPage((p) => Math.min(totalListPages, p + 1));
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                disabled={listPage >= totalListPages}
                className="px-3 py-1.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold disabled:opacity-40 cursor-pointer transition-all active:scale-95 text-xs"
              >
                ถัดไป
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showAuditorModal && (
        <AuditorSelectModal
          currentAuditor={auditorFilter}
          onSelect={(auditorName, auditorId) => {
            setAuditorFilter(auditorName);
            setSelectedAuditorId(auditorId || null);
          }}
          onClose={() => setShowAuditorModal(false)}
        />
      )}

      {showNewScheduleModal && (
        <NewScheduleModal
          defaultDay={selectedDate.getDate()}
          currentUser={currentUser}
          locations={allLocations && allLocations.length > 0 ? allLocations : locations}
          brands={brands}
          forms={forms}
          scheduleToEdit={editingSchedule}
          onClose={() => {
            setShowNewScheduleModal(false);
            setEditingSchedule(null);
          }}
          onSave={async () => {
            setShowNewScheduleModal(false);
            setEditingSchedule(null);
            if (refreshData) await refreshData();
          }}
        />
      )}

      {/* 🌟 FIXED FLOATING AI ACTION BUTTON & QUICK POPOVER (PORTAL TO BODY) */}
      {typeof document !== "undefined" && createPortal(
        <div className="fixed right-4 bottom-20 z-40 flex flex-col items-end pointer-events-auto">
          {/* Quick Advice Popover */}
          {showAiQuickPopover && (
            <div className="mb-2 w-72 sm:w-80 p-4 rounded-3xl bg-white border border-emerald-300 shadow-2xl shadow-emerald-950/20 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-900">
                  <Sparkles size={15} className="text-emerald-600 animate-pulse" />
                  <span>คำแนะนำจาก AI</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAiQuickPopover(false)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-start gap-2 text-slate-700 font-medium">
                  <CalendarDays size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    มีนัดหมาย <b>{todaySchedules.length}</b> รายการในวันนี้
                    {todaySchedules.length > 0 && (
                      <span className="text-slate-500 font-normal"> (ตรวจเสร็จ {completedTodayCount}/{todaySchedules.length})</span>
                    )}
                  </span>
                </div>

                {nextScheduleToAudit ? (
                  <div className="flex items-start gap-2 text-slate-700 text-[11px] leading-relaxed p-2 rounded-xl bg-amber-50/90 border border-amber-200/80">
                    <Clock size={14} className="text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      ควรเตรียมตรวจสาขา <b className="text-amber-900 font-bold">{nextScheduleToAudit.unitFullName || nextScheduleToAudit.locationName}</b> ({nextScheduleToAudit.time || "ตามเวลา"})
                    </span>
                  </div>
                ) : todaySchedules.length > 0 ? (
                  <div className="flex items-start gap-2 text-emerald-800 text-[11px] leading-relaxed p-2 rounded-xl bg-emerald-50/90 border border-emerald-200/80">
                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      ตรวจเสร็จสิ้นครบทุกสาขาของวันนี้แล้ว ({completedTodayCount} รายการ)
                    </span>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 text-slate-600 text-[11px] leading-relaxed p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <Clock size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      แนะนำจัดตารางตรวจสาขาที่ยังไม่ได้ตรวจในรอบเดือนนี้
                    </span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowAiQuickPopover(false);
                  setShowAiDetailModal(true);
                }}
                className="w-full py-2 bg-[#0F6659] hover:bg-emerald-800 text-white rounded-2xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5 active:scale-98"
              >
                <span>ดูรายละเอียด</span>
              </button>
            </div>
          )}

          {/* Floating Trigger Button */}
          <button
            type="button"
            onClick={() => setShowAiQuickPopover(prev => !prev)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-[#0F6659] hover:bg-emerald-800 text-white font-bold text-xs shadow-xl shadow-emerald-950/25 active:scale-95 transition-all cursor-pointer border border-emerald-500/30"
            title="คำแนะนำจาก AI"
          >
            <Sparkles size={15} className="animate-pulse" />
            <span>AI</span>
          </button>
        </div>,
        document.body
      )}

      {/* Full AI Schedule Advisor Modal */}
      {showAiDetailModal && (
        <AiScheduleAdvisorModal
          onClose={() => setShowAiDetailModal(false)}
        />
      )}
    </div>
  );
}