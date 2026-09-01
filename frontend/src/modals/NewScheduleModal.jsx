import React, { useState, useEffect, useRef } from "react";
import { X, Calendar, Clock, MapPin, User, FileText, Tag, Check, AlertCircle, Store, ChevronRight, Search } from "lucide-react";
import { c, sans, mono } from "../config/theme";
import ModalWrapper from "../shared/ModalWrapper";
import LocationSelectModal from "./LocationSelectModal";
import api from "../config/api";

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
    <div className="relative flex-1" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border flex items-center justify-between font-bold cursor-pointer transition-all shadow-2xs ${
          isOpen
            ? 'bg-white border-[#0F6659] ring-2 ring-[#0F6659]/20 text-slate-900'
            : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-white hover:border-slate-300'
        }`}
        title={title}
      >
        <span className="font-mono text-sm tracking-wide">{h}:{m} น.</span>
        <Clock size={15} className="text-slate-400 shrink-0" />
      </button>

      {/* 24-Hour Scrolling Popup - 2 Columns: Hours (00-23) & Minutes (00-59) without AM/PM */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-2.5 flex flex-col w-52 animate-in fade-in zoom-in-95 duration-150">
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

export default function NewScheduleModal({ onClose, onSave, defaultDay = 18, currentUser, locations = [], forms = [], scheduleToEdit = null }) {
  const [selectedUnitName, setSelectedUnitName] = useState(() => scheduleToEdit?.unit || scheduleToEdit?.locationName || locations[0]?.name || "");
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
    if (scheduleToEdit?.day) {
      const d = String(scheduleToEdit.day).padStart(2, '0');
      return `2026-08-${d}`;
    }
    const d = String(defaultDay || 18).padStart(2, '0');
    return `2026-08-${d}`;
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
  const [selectedFormId, setSelectedFormId] = useState(() => scheduleToEdit?.surveyFormId || forms[0]?.id || 1);
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
              const defaultAuditor = auditors.find(a => a.roleCode === 'AUDITOR') || auditors[0];
              return defaultAuditor.id;
            });
          }
        }
      })
      .catch(err => console.warn("Could not load auditors from API:", err));
    return () => { isMounted = false; };
  }, [scheduleToEdit]);

  const selectedUnit = locations.find(u => u.name === selectedUnitName || u.fullName === selectedUnitName) || locations[0];
  const selectedForm = forms.find(f => f.id === selectedFormId) || forms[0];

  const [saveError, setSaveError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError(null);

    const chosenAuditor = dbAuditors.find(a => a.id === assignedAuditorId) || dbAuditors[0];
    const auditorId = chosenAuditor?.id || (currentUser?.id || null);
    const auditorFullName = chosenAuditor?.fullName || chosenAuditor?.username || "-";

    const formattedTime = endTime ? `${startTime} - ${endTime} น.` : `${startTime} น.`;

    // Local datetime string without UTC conversion to prevent timezone shifts
    const localDateTimeStr = `${scheduledDate}T${(startTime || "10:00")}:00`;

    try {
      let savedId = scheduleToEdit?.id;
      if (selectedUnit?.id) {
        const payload = {
          locationId: selectedUnit.id,
          surveyFormId: typeof selectedFormId === 'number' ? selectedFormId : (selectedForm?.id || 1),
          auditorIds: auditorId ? [auditorId] : [],
          createdBy: currentUser?.id || 1,
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
      console.warn("Backend schedule save failed:", err.message);
      setSaveError(err.response?.data?.message || err.message || "ไม่สามารถบันทึกกำหนดการได้ กรุณาลองใหม่อีกครั้ง");
      setIsSaving(false);
    }
  };

  return (
    <ModalWrapper onClose={onClose} maxWidth="max-w-lg">
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
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-200 active:scale-90 cursor-pointer transition-all text-slate-400 hover:text-slate-700"
        >
          <X size={18} />
        </button>
      </div>

      {/* Form Content */}
      <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto max-h-[75vh]">
        {saveError && (
          <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <AlertCircle size={16} className="shrink-0 text-red-500" />
            <span>{saveError}</span>
          </div>
        )}
        {/* 1. Dedicated Interactive Branch Selector */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <MapPin size={14} className="text-[#0F6659]" />
              <span>สาขาเป้าหมายที่ต้องเข้าตรวจ</span>
            </label>
            {/*<span
              onClick={() => setShowLocationSelectModal(true)}
              className="text-[11px] font-bold text-[#0F6659] hover:underline cursor-pointer flex items-center gap-1"
            >
              <Search size={12} />
              <span>ค้นหาจาก {locations.length} สาขา</span>
            </span>*/}
          </div>

          <div
            onClick={() => setShowLocationSelectModal(true)}
            className="w-full p-3 sm:p-3.5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-[#0F6659] hover:bg-emerald-50/30 cursor-pointer transition-all flex items-center justify-between gap-3 shadow-2xs group active:scale-[0.99]"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-[#0F6659] flex items-center justify-center shrink-0 font-bold group-hover:bg-[#0F6659] group-hover:text-white transition-colors">
                <Store size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {selectedUnit?.code && (
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-slate-200/80 text-slate-700 font-mono">
                      {selectedUnit.code}
                    </span>
                  )}
                  {selectedUnit?.region && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-900">
                      📍 {selectedUnit.region}
                    </span>
                  )}
                </div>
                <div className="text-xs sm:text-sm font-extrabold text-slate-900 truncate group-hover:text-[#0F6659] transition-colors mt-0.5">
                  {selectedUnit?.name || selectedUnitName || "แตะเพื่อเลือกสาขา"}
                </div>
                {selectedUnit?.fullName && selectedUnit.fullName !== selectedUnit.name && (
                  <div className="text-[11px] font-medium text-slate-500 truncate">
                    {selectedUnit.fullName}
                  </div>
                )}
              </div>
            </div>

            <div className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 group-hover:border-emerald-300 group-hover:bg-emerald-100 group-hover:text-[#0F6659] text-slate-600 text-xs font-bold shrink-0 transition-colors flex items-center gap-1 shadow-2xs">
              <span>เลือกสาขา</span>
              <ChevronRight size={14} />
            </div>
          </div>
        </div>

        {/* 2. Date & Time (Start on Left, End on Right - Compact) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="scheduledDate" className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
              <Calendar size={14} className="text-[#0F6659]" />
              <span>วันที่ตรวจ</span>
            </label>
            <input
              type="date"
              id="scheduledDate"
              name="scheduledDate"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full text-xs sm:text-sm p-2.5 rounded-xl bg-slate-50 border border-slate-200 outline-none font-bold text-slate-800 focus:border-[#0F6659] focus:bg-white transition-all shadow-2xs ios-zoom-fix-xs"
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Clock size={14} className="text-[#0F6659]" />
                <span>ช่วงเวลา</span>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
              <User size={14} className="text-[#0F6659]" />
              <span>ผู้ตรวจ (Auditor)</span>
            </label>
            <select
              value={assignedAuditorId || ""}
              onChange={(e) => setAssignedAuditorId(Number(e.target.value))}
              className="w-full text-xs sm:text-sm p-3 rounded-xl bg-slate-50 border border-slate-200 outline-none font-bold text-slate-800 focus:border-[#0F6659] cursor-pointer ios-zoom-fix-xs"
            >
              {dbAuditors.length > 0 ? (
                dbAuditors.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.fullName || a.username} ({a.roleName || a.roleCode || a.role || 'ผู้ตรวจ'})
                  </option>
                ))
              ) : (
                <option value="">-- ไม่พบรายชื่อผู้ตรวจ / กำลังโหลด --</option>
              )}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
              <FileText size={14} className="text-[#0F6659]" />
              <span>แบบฟอร์มที่ใช้</span>
            </label>
            <select
              value={selectedFormId}
              onChange={(e) => setSelectedFormId(Number(e.target.value) || e.target.value)}
              className="w-full text-xs sm:text-sm p-3 rounded-xl bg-slate-50 border border-slate-200 outline-none font-bold text-slate-800 focus:border-[#0F6659] cursor-pointer ios-zoom-fix-xs"
            >
              {forms.map(f => (
                <option key={f.id} value={f.id}>{f.title || f.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 4. Type & Notes */}
        <div>
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
            <Tag size={14} className="text-[#0F6659]" />
            <span>ประเภทการตรวจ</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: "announced", label: "ตามกำหนดการ" },
              { key: "unannounced", label: "นอกกำหนดการ" },
              { key: "undercover", label: "ปลอมตัว" },
            ].map(t => (
              <button
                key={t.key}
                type="button"
                onClick={() => setAuditType(t.key)}
                className={`py-2.5 rounded-xl text-xs font-bold border cursor-pointer transition-all active:scale-95 ${
                  auditType === t.key ? 'bg-[#0F6659] text-white border-[#0F6659] shadow-2xs' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1.5">หมายเหตุเพิ่มเติม</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="ระบุจุดที่ต้องเน้นย้ำ หรือข้อความถึงผู้ตรวจ..."
            className="w-full text-xs sm:text-sm p-3 rounded-xl bg-slate-50 border border-slate-200 outline-none font-medium text-slate-800 focus:border-[#0F6659] ios-zoom-fix-xs"
          />
        </div>

        {/* Submit Buttons */}
        <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold cursor-pointer transition-colors"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="flex-1 py-3 rounded-xl bg-[#0F6659] hover:bg-emerald-800 text-white text-xs sm:text-sm font-extrabold shadow-md active:scale-98 cursor-pointer flex items-center justify-center gap-1.5 transition-all"
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
          onSelect={(loc) => {
            setSelectedUnitName(loc.name);
          }}
          onClose={() => setShowLocationSelectModal(false)}
        />
      )}
    </ModalWrapper>
  );
}
