import React, { useState } from "react";
import { X, Calendar, Clock, MapPin, User, FileText, Tag, Check, AlertCircle } from "lucide-react";
import { c, sans, mono } from "../config/theme";
import { INITIAL_UNITS } from "../mocks/locations";
import { AUDITORS_LIST } from "../mocks/auditors";
import { INITIAL_FORMS_LIST } from "../mocks/forms";
import ModalWrapper from "../shared/ModalWrapper";
import api from "../config/api";

export default function NewScheduleModal({ onClose, onSave, defaultDay = 18, locations = INITIAL_UNITS, forms = INITIAL_FORMS_LIST }) {
  const [selectedUnitName, setSelectedUnitName] = useState(locations[0]?.name || "สาขาสยามพารากอน");
  const [scheduledDate, setScheduledDate] = useState("2026-08-25");
  const [scheduledTime, setScheduledTime] = useState("10:00 - 12:00 น.");
  const [assignedAuditor, setAssignedAuditor] = useState(AUDITORS_LIST[0]?.name || "สมชาย ใจดี");
  const [selectedFormId, setSelectedFormId] = useState(forms[0]?.id || 1);
  const [auditType, setAuditType] = useState("announced");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const selectedUnit = locations.find(u => u.name === selectedUnitName || u.fullName === selectedUnitName) || locations[0];
  const selectedForm = forms.find(f => f.id === selectedFormId) || forms[0];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      if (selectedUnit?.id) {
        await api.post('/schedule', {
          locationId: selectedUnit.id,
          surveyFormId: typeof selectedFormId === 'number' ? selectedFormId : 1,
          auditorName: assignedAuditor,
          auditType: auditType.toLowerCase(),
          scheduledDate: new Date(scheduledDate).toISOString(),
          notes: notes.trim()
        });
      }
    } catch (err) {
      console.warn("Backend schedule save:", err.message);
    }

    // Parse day from scheduledDate (YYYY-MM-DD)
    const dateObj = new Date(scheduledDate);
    const dayNumber = !isNaN(dateObj.getDate()) ? dateObj.getDate() : defaultDay;

    const newSchedule = {
      id: "sch-" + Date.now(),
      unit: selectedUnit?.name || selectedUnitName,
      unitFullName: selectedUnit?.fullName || selectedUnitName,
      region: selectedUnit?.region || "กรุงเทพฯ",
      day: dayNumber,
      dateFormatted: scheduledDate,
      time: scheduledTime,
      auditor: assignedAuditor,
      formTitle: selectedForm?.title || selectedForm?.name || "แบบฟอร์มมาตรฐาน 5 ดาว (QSC Core)",
      formId: selectedFormId,
      type: auditType,
      notes: notes.trim(),
      status: "pending"
    };

    if (onSave) {
      onSave(newSchedule);
    }
    setIsSaving(false);
    onClose();
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
            <h3 className="text-base font-bold text-slate-800">กำหนดการตรวจสาขาใหม่</h3>
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
        {/* 1. Branch Selector */}
        <div>
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
            <MapPin size={14} className="text-[#0F6659]" />
            <span>สาขาที่ต้องเข้าตรวจ</span>
          </label>
          <select
            value={selectedUnitName}
            onChange={(e) => setSelectedUnitName(e.target.value)}
            className="w-full text-xs sm:text-sm p-3 rounded-xl bg-slate-50 border border-slate-200 outline-none font-bold text-slate-800 focus:border-[#0F6659] cursor-pointer"
          >
            {locations.map((u) => (
              <option key={u.id || u.name} value={u.name}>
                {u.fullName || u.name} ({u.locationType === 'Office' ? 'สำนักงาน' : u.locationType === 'Plant' ? 'โรงงาน' : 'สาขา'})
              </option>
            ))}
          </select>
        </div>

        {/* 2. Date & Time */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
              <Calendar size={14} className="text-[#0F6659]" />
              <span>วันที่ตรวจ</span>
            </label>
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full text-xs sm:text-sm p-3 rounded-xl bg-slate-50 border border-slate-200 outline-none font-bold text-slate-800 focus:border-[#0F6659]"
              required
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
              <Clock size={14} className="text-[#0F6659]" />
              <span>ช่วงเวลา</span>
            </label>
            <input
              type="text"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              placeholder="เช่น 10:00 - 12:00 น."
              className="w-full text-xs sm:text-sm p-3 rounded-xl bg-slate-50 border border-slate-200 outline-none font-bold text-slate-800 focus:border-[#0F6659]"
            />
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
              value={assignedAuditor}
              onChange={(e) => setAssignedAuditor(e.target.value)}
              className="w-full text-xs sm:text-sm p-3 rounded-xl bg-slate-50 border border-slate-200 outline-none font-bold text-slate-800 focus:border-[#0F6659] cursor-pointer"
            >
              {AUDITORS_LIST.map(a => (
                <option key={a.name} value={a.name}>{a.name} ({a.role})</option>
              ))}
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
              className="w-full text-xs sm:text-sm p-3 rounded-xl bg-slate-50 border border-slate-200 outline-none font-bold text-slate-800 focus:border-[#0F6659] cursor-pointer"
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
              { key: "spot", label: "สุ่มตรวจ (Spot)" },
              { key: "undercover", label: "Undercover" },
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
            className="w-full text-xs sm:text-sm p-3 rounded-xl bg-slate-50 border border-slate-200 outline-none font-medium text-slate-800 focus:border-[#0F6659]"
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
    </ModalWrapper>
  );
}
