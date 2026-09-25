import React, { useState, useEffect, useRef, useMemo } from "react";
import { X, Calendar, Clock, MapPin, User, FileText, Tag, Check, AlertCircle, Store, ChevronRight, ChevronDown, Search, Sparkles } from "lucide-react";
import { c, sans, mono } from "../config/theme";
import ModalWrapper from "../shared/ModalWrapper";
import LocationSelectModal from "./LocationSelectModal";
import api from "../config/api";
import { isFormApplicableToLocation } from "../utils/formMatching";

function TimePicker24({ value, onChange, title }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const [h, m] = (value || "10:00").split(':').map(v => (v || "00").padStart(2, '0'));

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const selectHour = (newH) => {
    onChange(`${newH}:${m}`);
  };

  const selectMinute = (newM) => {
    onChange(`${h}:${newM}`);
  };

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

  return (
    <div className="relative flex-1 min-w-0" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full text-xs sm:text-sm px-3 py-2.5 min-h-[44px] rounded-xl border flex items-center justify-between font-semibold cursor-pointer transition-all shadow-2xs ${
          isOpen
            ? 'bg-white border-[#0F6659] ring-2 ring-[#0F6659]/20 text-slate-900'
            : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-white hover:border-slate-300'
        }`}
        title={title}
      >
        <span className="font-mono text-xs sm:text-sm tracking-tight font-bold">{h}:{m} น.</span>
        <Clock size={14} className="text-slate-400 shrink-0 ml-1" />
      </button>

      {/* 24-Hour Scrolling Popup - 2 Columns: Hours (00-23) & Minutes (00-59) without AM/PM */}
      {isOpen && (
        <div className="absolute top-full right-0 sm:left-0 sm:right-auto mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-2.5 flex flex-col w-52 max-w-[calc(100vw-3rem)] animate-in fade-in zoom-in-95 duration-150">
          <div className="grid grid-cols-2 text-center text-[11px] font-extrabold text-slate-400 pb-1.5 mb-1 border-b border-slate-100">
            <span>ชั่วโมง</span>
            <span>นาที</span>
          </div>

          <div className="grid grid-cols-2 gap-1.5 h-48">
            {/* Hours Column (00 - 23) */}
            <div className="overflow-y-auto space-y-0.5 pr-1" style={{ scrollbarWidth: "thin" }}>
              {hours.map(hour => {
                const isSelected = hour === h;
                return (
                  <button
                    key={`h-${hour}`}
                    type="button"
                    onClick={() => selectHour(hour)}
                    className={`w-full py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer text-center ${
                      isSelected
                        ? 'bg-[#0F6659] text-white shadow-xs'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {hour}
                  </button>
                );
              })}
            </div>

            {/* Minutes Column (00 - 59) */}
            <div className="overflow-y-auto space-y-0.5 pr-1 border-l border-slate-100 pl-1" style={{ scrollbarWidth: "thin" }}>
              {minutes.map(min => {
                const isSelected = min === m;
                return (
                  <button
                    key={`m-${min}`}
                    type="button"
                    onClick={() => selectMinute(min)}
                    className={`w-full py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer text-center ${
                      isSelected
                        ? 'bg-[#0F6659] text-white shadow-xs'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {min}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2 mt-1.5 border-t border-slate-100 flex items-center justify-center">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-full py-2 px-4 rounded-xl bg-[#0F6659] text-white text-xs font-bold hover:bg-[#0B4E44] active:scale-95 transition-all shadow-xs cursor-pointer text-center flex items-center justify-center"
            >
              ตกลง
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NewScheduleModal({ onClose, onSave, defaultDay = 18, currentUser, locations = [], forms = [], scheduleToEdit = null, brands = [] }) {
  const [selectedUnitName, setSelectedUnitName] = useState(() => scheduleToEdit?.unit || scheduleToEdit?.locationName || "");
  const [showLocationSelectModal, setShowLocationSelectModal] = useState(false);

  // 📅 Accurate Initial Date parsing (Supports scheduledDate, dateFormatted, day, and defaultDay)
  const parseInitialDate = () => {
    if (scheduleToEdit?.scheduledDate) {
      const d = new Date(scheduleToEdit.scheduledDate);
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
    if (scheduleToEdit?.dateFormatted && /^\d{4}-\d{2}-\d{2}$/.test(scheduleToEdit.dateFormatted)) {
      return scheduleToEdit.dateFormatted;
    }
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    if (scheduleToEdit?.day) {
      const d = String(scheduleToEdit.day).padStart(2, '0');
      return `${yyyy}-${mm}-${d}`;
    }
    const d = String(defaultDay || now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${d}`;
  };

  const [scheduledDate, setScheduledDate] = useState(parseInitialDate);

  // ⏰ Accurate Initial Time parsing (Supports time string like "10:00 - 12:00 น." and scheduledDate)
  const parseInitialTimes = () => {
    if (scheduleToEdit?.time) {
      const match = scheduleToEdit.time.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
      if (match) return { start: match[1].padStart(5, '0'), end: match[2].padStart(5, '0') };
      const single = scheduleToEdit.time.match(/(\d{1,2}:\d{2})/);
      if (single) {
        const [h, m] = single[1].split(':').map(Number);
        const endH = String(Math.min(23, (h || 0) + 2)).padStart(2, '0');
        return { start: single[1].padStart(5, '0'), end: `${endH}:${String(m || 0).padStart(2, '0')}` };
      }
    }
    if (scheduleToEdit?.scheduledDate) {
      const d = new Date(scheduleToEdit.scheduledDate);
      if (!isNaN(d.getTime())) {
        const h = d.getHours();
        const m = d.getMinutes();
        if (h > 0 || m > 0) {
          const startStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          const endH = String(Math.min(23, h + 2)).padStart(2, '0');
          return { start: startStr, end: `${endH}:${String(m).padStart(2, '0')}` };
        }
      }
    }
    return { start: "10:00", end: "12:00" };
  };

  const initialTimes = parseInitialTimes();
  const [startTime, setStartTime] = useState(initialTimes.start);
  const [endTime, setEndTime] = useState(initialTimes.end);

  const [assignedAuditorId, setAssignedAuditorId] = useState(() => {
    if (scheduleToEdit?.auditors?.[0]?.id) return scheduleToEdit.auditors[0].id;
    if (scheduleToEdit?.auditorId) return scheduleToEdit.auditorId;
    return null;
  });
  const [selectedFormId, setSelectedFormId] = useState(() => scheduleToEdit?.surveyFormId || null);
  const [auditType, setAuditType] = useState(() => scheduleToEdit?.auditType || "announced");
  const [notes, setNotes] = useState(() => scheduleToEdit?.notes || "");
  const [isSaving, setIsSaving] = useState(false);
  const [dbAuditors, setDbAuditors] = useState([]);

  useEffect(() => {
    let isMounted = true;
    api.get('/user')
      .then(res => {
        if (isMounted && res.data && Array.isArray(res.data)) {
          const auditors = res.data.filter(u => 
            u.roleCode === 'AUDITOR' || 
            u.role === 'AUDITOR' || 
            (u.roleName && (u.roleName.includes('ผู้ตรวจ') || u.roleName.includes('Auditor')))
          );
          if (auditors.length > 0) {
            setDbAuditors(auditors);
            setAssignedAuditorId(prevId => {
              if (prevId && auditors.some(a => a.id === prevId)) return prevId;

              // If editing an existing schedule, try to match by name
              if (scheduleToEdit?.auditor || scheduleToEdit?.auditorName) {
                const name = (scheduleToEdit.auditor || scheduleToEdit.auditorName).toLowerCase();
                const matched = auditors.find(a => 
                  (a.fullName && name.includes(a.fullName.toLowerCase())) ||
                  (a.username && name.includes(a.username.toLowerCase()))
                );
                if (matched) return matched.id;
              }

              // Default to actual AUDITOR role user (e.g. somchai), not the admin/creator
              const defaultAuditor = auditors.find(a => a.roleCode === 'AUDITOR');
              return defaultAuditor ? defaultAuditor.id : null;
            });
          }
        }
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, [scheduleToEdit]);

  const selectedUnit = locations.find(u => u.name === selectedUnitName || u.fullName === selectedUnitName) || null;

  // 💡 Fetch pending CAP recommendations for selected location
  const [pendingRecommendations, setPendingRecommendations] = useState([]);
  const [showRecommendationsModal, setShowRecommendationsModal] = useState(false);

  useEffect(() => {
    if (selectedUnit?.id) {
      api.get(`/cap/pending-recommendations?locationId=${selectedUnit.id}`)
        .then(res => {
          setPendingRecommendations(Array.isArray(res.data) ? res.data : []);
        })
        .catch(() => {
          setPendingRecommendations([]);
        });
    } else {
      setPendingRecommendations([]);
    }
  }, [selectedUnit?.id]);

  // Smart Form Filtering strictly matching selected unit (Brand + Location Type + Specific Targets)
  // 🌟 กรองเฉพาะแบบฟอร์มเวอร์ชันล่าสุด (isLatest !== false) เพื่อไม่ให้ฟอร์มเวอร์ชันเก่าในอดีตโผล่มาซ้ำ
  const availableForms = useMemo(() => {
    if (!forms || forms.length === 0) return [];
    
    const activeLatestForms = forms.filter(f => 
      ((f.isLatest !== false && f.isLatest !== 0) || f.id === scheduleToEdit?.surveyFormId) &&
      f.isActive !== false && f.isActive !== 0
    );

    if (!selectedUnit) return activeLatestForms;
    return activeLatestForms.filter(f => isFormApplicableToLocation(f, selectedUnit));
  }, [forms, selectedUnit, scheduleToEdit]);

  useEffect(() => {
    if (availableForms.length === 1) {
      setSelectedFormId(availableForms[0].id);
    } else if (availableForms.length > 1) {
      if (selectedFormId && !availableForms.some(f => f.id === selectedFormId)) {
        setSelectedFormId(null);
      }
    } else {
      setSelectedFormId(null);
    }
  }, [availableForms, selectedFormId]);

  const selectedForm = availableForms.find(f => f.id === selectedFormId) || null;

  const [saveError, setSaveError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError(null);

    if (!selectedUnit?.id) {
      setSaveError("กรุณาเลือกสาขาก่อนบันทึกกำหนดการ");
      setIsSaving(false);
      return;
    }

    if (!selectedFormId && !selectedForm?.id) {
      setSaveError("กรุณาเลือกแบบฟอร์มการตรวจ");
      setIsSaving(false);
      return;
    }

    const chosenAuditor = dbAuditors.find(a => a.id === assignedAuditorId) || null;
    const auditorId = chosenAuditor?.id || (assignedAuditorId || null);
    const auditorFullName = chosenAuditor?.fullName || chosenAuditor?.username || "-";

    const formattedTime = endTime ? `${startTime} - ${endTime} น.` : `${startTime} น.`;

    // Local datetime string without UTC conversion to prevent timezone shifts
    const localDateTimeStr = `${scheduledDate}T${(startTime || "10:00")}:00`;

    try {
      let savedId = scheduleToEdit?.id;
      const targetFormId = typeof selectedFormId === 'number' ? selectedFormId : (selectedForm?.id || null);
      if (!targetFormId) {
        setSaveError("กรุณาเลือกแบบฟอร์มการตรวจที่ถูกต้อง");
        setIsSaving(false);
        return;
      }

      const payload = {
        locationId: selectedUnit.id,
        surveyFormId: targetFormId,
        auditorIds: auditorId ? [auditorId] : [],
        createdBy: currentUser?.id ? Number(currentUser.id) : null,
        auditType: auditType.toLowerCase(),
        scheduledDate: localDateTimeStr,
        time: formattedTime,
        notes: notes.trim()
      };

      if (scheduleToEdit?.id) {
        const res = await api.put(`/schedule/${scheduleToEdit.id}`, payload);
        if (res?.data?.id) savedId = res.data.id;
      } else {
        const res = await api.post('/schedule', payload);
        if (res?.data?.id) savedId = res.data.id;
      }
    
      const dateObj = new Date(scheduledDate + 'T00:00:00');
      const dayNumber = !isNaN(dateObj.getDate()) ? dateObj.getDate() : defaultDay;

      const newSchedule = {
        id: savedId || scheduleToEdit?.id,
        locationId: selectedUnit?.id,
        scheduledDate: localDateTimeStr,
        unit: selectedUnit?.name || selectedUnitName,
        unitFullName: selectedUnit?.fullName || selectedUnitName,
        locationName: selectedUnit?.name || selectedUnitName,
        region: selectedUnit?.region || "-",
        day: dayNumber,
        dateFormatted: scheduledDate,
        time: formattedTime,
        auditor: auditorFullName,
        auditorName: auditorFullName,
        auditorId: auditorId,
        auditors: auditorId ? [{ id: auditorId, fullName: auditorFullName, isLead: true }] : [],
        formTitle: selectedForm?.title || selectedForm?.name || "-",
        surveyFormTitle: selectedForm?.title || selectedForm?.name || "-",
        surveyFormId: selectedFormId,
        formId: selectedFormId,
        type: auditType,
        auditType: auditType,
        notes: notes.trim(),
        status: scheduleToEdit?.status || "pending"
      };

      if (onSave) {
        onSave(newSchedule);
      }
      setIsSaving(false);
      onClose();
    } catch (err) {
      setSaveError(err.response?.data?.message || err.message || "ไม่สามารถบันทึกกำหนดการได้ กรุณาลองใหม่อีกครั้ง");
      setIsSaving(false);
    }
  };

  return (
    <ModalWrapper onClose={onClose} maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} className="w-full max-w-full overflow-hidden flex flex-col min-h-0 flex-1">
        {/* Header */}
        <div className="shrink-0 p-4 sm:p-5 border-b flex items-center justify-between" style={{ borderColor: c.border, background: "#FAF9F5" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-800 shrink-0 shadow-2xs">
              <Calendar size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                {scheduleToEdit ? "แก้ไขกำหนดการตรวจสาขา" : "กำหนดการตรวจสาขาใหม่"}
              </h3>
              <p className="text-xs text-slate-500">มอบหมายงานและบันทึกลงฐานข้อมูล</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-200 active:scale-90 cursor-pointer transition-all text-slate-400 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="p-4 sm:p-6 space-y-4 flex-1 overflow-y-auto min-h-0 overscroll-contain custom-tab-scrollbar">
          {saveError && (
            <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <AlertCircle size={16} className="shrink-0 text-red-500" />
              <span>{saveError}</span>
            </div>
          )}
          {/* 1. Dedicated Interactive Branch Selector */}
        <div className="min-w-0 w-full">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <MapPin size={14} className="text-[#0F6659]" />
              <span>สาขาเป้าหมายที่ต้องเข้าตรวจ</span>
            </label>
          </div>

          <div
            onClick={() => setShowLocationSelectModal(true)}
            className="w-full p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200/90 hover:border-[#0F6659] hover:bg-emerald-50/20 cursor-pointer transition-all flex items-center justify-between gap-3 shadow-2xs group active:scale-[0.99] min-w-0"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-emerald-50 text-[#0F6659] border border-emerald-200/60 flex items-center justify-center shrink-0 font-bold group-hover:bg-[#0F6659] group-hover:text-white transition-all shadow-2xs">
                <Store size={20} />
              </div>

              <div className="min-w-0 flex-1">
                {selectedUnit ? (
                  <div className="space-y-1">
                    <div className="text-sm sm:text-base font-bold text-slate-800 line-clamp-2 group-hover:text-[#0F6659] transition-colors leading-snug">
                      {selectedUnit.fullName || selectedUnit.name || selectedUnitName}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                      {selectedUnit.code && (
                        <span className="font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded-md text-[11px]">
                          {selectedUnit.code}
                        </span>
                      )}
                      {selectedUnit.region && (
                        <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                          <span>📍 {selectedUnit.region}</span>
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-sm font-bold text-slate-700 group-hover:text-[#0F6659] transition-colors">
                      แตะเพื่อเลือกสาขาเป้าหมาย
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      ค้นหาตามชื่อสาขา, แบรนด์ หรือเขตพื้นที่
                    </div>
                  </div>
                )}
              </div>
            </div>

            <ChevronRight size={18} className="text-slate-400 group-hover:text-[#0F6659] group-hover:translate-x-0.5 transition-all shrink-0" />
          </div>
        </div>

        {/* 2. Date & Time (Start on Left, End on Right - Compact) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0 w-full">
          <div className="min-w-0">
            <label htmlFor="scheduledDate" className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
              <Calendar size={14} className="text-[#0F6659]" />
              <span>วันที่ตรวจ</span>
            </label>
            <div className="relative">
              <input
                type="date"
                id="scheduledDate"
                name="scheduledDate"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                onClick={(e) => e.target.showPicker?.()}
                className="w-full text-xs sm:text-sm pl-3.5 pr-10 py-2.5 min-h-[44px] rounded-xl bg-slate-50 border border-slate-200 outline-none font-semibold text-slate-800 focus:border-[#0F6659] focus:bg-white transition-all shadow-2xs cursor-pointer"
                required
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <Calendar size={16} />
              </div>
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Clock size={14} className="text-[#0F6659]" />
                <span>ช่วงเวลา</span>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2 min-w-0 w-full">
              <TimePicker24
                value={startTime}
                onChange={(val) => {
                  setStartTime(val);
                  if (val && (!endTime || endTime <= val)) {
                    const [h, m] = val.split(':').map(Number);
                    const newEndH = String(Math.min(23, (h || 0) + 2)).padStart(2, '0');
                    setEndTime(`${newEndH}:${String(m || 0).padStart(2, '0')}`);
                  }
                }}
                title="เวลาเริ่มต้น (00-23 : 00-59)"
              />

              <TimePicker24
                value={endTime}
                onChange={(val) => setEndTime(val)}
                title="เวลาสิ้นสุด (00-23 : 00-59)"
              />
            </div>
          </div>
        </div>

        {/* 3. Auditor & Form */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0 w-full">
          <div className="min-w-0">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
              <User size={14} className="text-[#0F6659]" />
              <span>ผู้ตรวจ (Auditor)</span>
            </label>
            <div className="relative">
              <select
                value={assignedAuditorId || ""}
                onChange={(e) => setAssignedAuditorId(Number(e.target.value) || null)}
                className="w-full text-xs sm:text-sm pl-4 pr-10 py-3 min-h-[50px] rounded-2xl bg-slate-50 border border-slate-200 outline-none font-semibold text-slate-700 focus:border-[#0F6659] focus:bg-white transition-all shadow-xs cursor-pointer appearance-none truncate"
              >
                {dbAuditors.length > 0 ? (
                  <>
                    <option value="">-- กรุณาเลือกผู้ตรวจ --</option>
                    {dbAuditors.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.fullName || a.username} ({a.roleName || a.roleCode || a.role || 'ผู้ตรวจ'})
                      </option>
                    ))}
                  </>
                ) : (
                  <option value="">-- ไม่พบรายชื่อผู้ตรวจ / กำลังโหลด --</option>
                )}
              </select>
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <ChevronDown size={18} />
              </div>
            </div>
          </div>
          <div className="min-w-0">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
              <FileText size={14} className="text-[#0F6659]" />
              <span>แบบฟอร์มที่ใช้</span>
              {availableForms.length > 0 && (
                <span className="text-[11px] font-semibold text-slate-400">({availableForms.length} ฟอร์ม)</span>
              )}
            </label>
            <div className="relative">
              <select
                value={selectedFormId || ""}
                onChange={(e) => setSelectedFormId(Number(e.target.value) || null)}
                disabled={availableForms.length === 0}
                className="w-full text-xs sm:text-sm pl-4 pr-10 py-3 min-h-[50px] rounded-2xl bg-slate-50 border border-slate-200 outline-none font-semibold text-slate-700 focus:border-[#0F6659] focus:bg-white transition-all shadow-xs cursor-pointer appearance-none truncate disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {availableForms.length > 0 ? (
                  <>
                    {availableForms.length > 1 && (
                      <option value="">-- กรุณาเลือกแบบฟอร์ม ({availableForms.length} แบบฟอร์ม) --</option>
                    )}
                    {availableForms.map(f => {
                      const bTag = f.brandNames && f.brandNames.length > 0 ? ` [${f.brandNames.join(', ')}]` : (f.brandName ? ` [${f.brandName}]` : '');
                      return (
                        <option key={f.id} value={f.id}>{f.title || f.name}{bTag}</option>
                      );
                    })}
                  </>
                ) : (
                  <option value="">-- ไม่พบแบบฟอร์มที่ตรงกับสาขานี้ --</option>
                )}
              </select>
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <ChevronDown size={18} />
              </div>
            </div>
            {availableForms.length === 0 && (
              <p className="text-[11px] font-medium text-amber-600 mt-1 flex items-center gap-1">
                <AlertCircle size={12} className="shrink-0" />
                <span>สาขานี้ยังไม่มีแบบฟอร์มที่ตรงกับแบรนด์หรือประเภทสถานที่</span>
              </p>
            )}
          </div>
        </div>

        {/* 4. Type & Notes */}
        <div className="min-w-0 w-full">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
            <Tag size={14} className="text-[#0F6659]" />
            <span>ประเภทการตรวจ</span>
          </label>
          <div className="grid grid-cols-3 gap-1.5 min-w-0 w-full">
            {[
              { key: "announced", label: "ตามกำหนดการ" },
              { key: "unannounced", label: "นอกกำหนดการ" },
              { key: "undercover", label: "ปลอมตัว" },
            ].map(t => (
              <button
                key={t.key}
                type="button"
                onClick={() => setAuditType(t.key)}
                className={`py-3 px-1 rounded-2xl text-xs sm:text-sm font-semibold border cursor-pointer transition-all active:scale-95 truncate text-center ${
                  auditType === t.key ? 'bg-[#0F6659] text-white border-[#0F6659] shadow-2xs' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* 💡 คำแนะนำจากการตรวจ/CAP รอบก่อนหน้า (ถ้ามี) */}
        {pendingRecommendations.length > 0 && (
          <div className="min-w-0 w-full animate-in fade-in slide-in-from-top-1 duration-200">
            <button
              type="button"
              onClick={() => setShowRecommendationsModal(true)}
              className="w-full py-2.5 px-3.5 rounded-2xl bg-amber-50/90 hover:bg-amber-100/90 border border-amber-300/80 text-amber-950 text-xs sm:text-sm font-bold flex items-center justify-between transition-all cursor-pointer shadow-2xs active:scale-[0.99] group"
            >
              <span className="flex items-center gap-2 min-w-0">
                <span className="p-1 rounded-lg bg-amber-200/80 text-amber-800 shrink-0">
                  <Sparkles size={14} className="group-hover:rotate-12 transition-transform" />
                </span>
                <span className="truncate">ดูคำแนะนำจากการตรวจ/CAP รอบก่อนหน้า ({pendingRecommendations.length} ข้อ)</span>
              </span>
              <span className="text-[11px] sm:text-xs font-semibold text-amber-800 underline shrink-0 ml-2">ดูรายละเอียด &gt;</span>
            </button>
          </div>
        )}

        <div className="min-w-0 w-full">
          <label className="text-xs font-bold text-slate-700 block mb-1.5">หมายเหตุเพิ่มเติม</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="ระบุจุดที่ต้องเน้นย้ำ หรือข้อความถึงผู้ตรวจ..."
            className="w-full text-xs sm:text-base p-3.5 rounded-2xl bg-slate-50 border border-slate-200 outline-none font-medium text-slate-800 focus:border-[#0F6659] focus:bg-white shadow-xs resize-none"
          />
        </div>
        </div>

        {/* Pinned Bottom Action Footer */}
        <div className="shrink-0 p-4 border-t border-slate-100 bg-white flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold cursor-pointer transition-colors"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={isSaving || availableForms.length === 0}
            className="flex-1 py-3 rounded-2xl bg-[#0F6659] hover:bg-emerald-800 text-white text-xs sm:text-sm font-extrabold shadow-md active:scale-98 cursor-pointer flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check size={16} />
            <span>{isSaving ? "กำลังบันทึก..." : "บันทึกกำหนดการ"}</span>
          </button>
        </div>
      </form>

      {/* 🏬 Dedicated Full-Screen Branch Selector Modal */}
      {showLocationSelectModal && (
        <LocationSelectModal
          currentLocationId={selectedUnit?.id}
          currentLocationName={selectedUnit?.name || selectedUnitName}
          locations={locations}
          brands={brands}
          onSelect={(loc) => {
            setSelectedUnitName(loc.name);
          }}
          onClose={() => setShowLocationSelectModal(false)}
        />
      )}

      {/* 💡 Pop-up Modal แสดงคำแนะนำจากการตรวจ/CAP รอบก่อนหน้า */}
      {showRecommendationsModal && (
        <ModalWrapper onClose={() => setShowRecommendationsModal(false)} maxWidth="max-w-lg">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-amber-50/50">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
                <Sparkles size={18} />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                  คำแนะนำจากการตรวจรอบก่อนหน้า
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                  สาขา: <span className="font-semibold text-slate-700">{selectedUnit?.name || selectedUnitName}</span> ({pendingRecommendations.length} รายการ)
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowRecommendationsModal(false)}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Recommendations List */}
          <div className="p-4 sm:p-5 overflow-y-auto space-y-3">
            {pendingRecommendations.map((rec, idx) => (
              <div 
                key={rec.id || idx}
                className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3.5 space-y-2 shadow-2xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-amber-100/90 text-amber-900">
                    <span>ข้อที่ {idx + 1}:</span>
                    <span className="truncate max-w-[200px]">{rec.issueItem || "ข้อบกพร่อง"}</span>
                  </span>
                  {rec.createdAt && (
                    <span className="text-[11px] font-medium text-slate-400">
                      {new Date(rec.createdAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })}
                    </span>
                  )}
                </div>

                {rec.description && (
                  <p className="text-xs text-slate-600 pl-1 leading-relaxed">
                    <span className="font-semibold text-slate-700">ปัญหาเดิม:</span> {rec.description}
                  </p>
                )}

                <div className="p-2.5 rounded-xl bg-amber-50/90 border border-amber-200/80 text-xs text-amber-950">
                  <span className="font-bold text-amber-900 block mb-0.5">จุดที่ควรสังเกตเพิ่มเติม:</span>
                  <p className="leading-relaxed whitespace-pre-wrap">{rec.nextAuditNote}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="p-3.5 sm:p-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between gap-3">
            <span className="text-[11px] text-slate-500">
              อ่านเพื่อเป็นข้อมูลอ้างอิงในการลงหมายเหตุกำหนดการ
            </span>
            <button
              type="button"
              onClick={() => setShowRecommendationsModal(false)}
              className="py-2 px-5 rounded-2xl bg-[#0F6659] hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold cursor-pointer transition-colors shadow-2xs shrink-0"
            >
              เข้าใจแล้ว
            </button>
          </div>
        </ModalWrapper>
      )}
    </ModalWrapper>
  );
}
