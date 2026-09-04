import AuditHistoryDetail from "../audit/AuditHistoryDetail";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ClipboardCheck, MapPin, Phone, Check, Clock, Trash2, Edit3, Info, Lock } from "lucide-react";

import { c, sans, mono, cardStyle } from "../../config/theme";
import { AUDIT_TYPES, AUDIT_TYPE_META } from "../../config/constants";
import { DataContext } from "../../context/DataContext";
import Header from "../../shared/Header";
import Section from "../../shared/Section";
import HistoryList from "../../shared/HistoryList";
import api from "../../config/api";

export default function ScheduleItemDetail({ item, role, onBack, onStartAudit, onEdit }) {
  const { locations: visibleLocations, auditRecords, refreshData } = React.useContext(DataContext);
  const [selectedAudit, setSelectedAudit] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const isAuditorOrAdmin = role === "AUDITOR" || role === "ADMIN" || role === "STANDARD";
  const canManageSchedule = role === "ADMIN" || role === "STANDARD";
  const isCompleted = item.status === "done" || item.status === "completed";
  const isPending = !isCompleted;

  const unit = visibleLocations?.find((u) => (
    u.name === item.unit ||
    u.fullName === item.unit ||
    u.id === item.locationId ||
    (item.unit && u.name && item.unit.includes(u.name)) ||
    (item.locationName && u.name && item.locationName.includes(u.name)) ||
    (item.unit && u.fullName && item.unit.includes(u.fullName))
  ));

  // 🌟 Real-time audit history for this specific branch from SQLite DB
  const branchHistory = useMemo(() => {
    const targetId = item.locationId || unit?.id;
    const targetName = item.unit || item.locationName || unit?.name || unit?.fullName || "";

    const fromDb = (auditRecords || []).filter(r => {
      const matchId = targetId && (r.locationId === targetId || r.location?.id === targetId);
      const matchName = targetName && (
        r.locationName === targetName ||
        r.location?.name === targetName ||
        r.location?.fullName === targetName ||
        (r.unitName && r.unitName === targetName) ||
        (r.locationName && targetName.includes(r.locationName)) ||
        (targetName && r.locationName && targetName.includes(r.locationName)) ||
        (r.location?.name && targetName.includes(r.location.name))
      );
      return matchId || matchName;
    });

    if (fromDb.length > 0) {
      return fromDb.map(r => {
        const score = Math.round(r.percentageScore || 0);
        const rawDate = r.auditDate || r.createdAt;
        const dateFormatted = rawDate ? new Date(rawDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) : "-";
        const auditorVal = r.primaryAuditor?.fullName || r.auditorName || r.auditor || "-";
        const formVal = r.surveyFormTitle || r.surveyForm?.title || r.form || "-";
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

    return unit?.history || [];
  }, [auditRecords, item, unit]);

  const auditTypeMeta = {
    announced: { label: "ตรวจมาตรฐานรอบปกติ (Announced)", color: "text-blue-700 bg-blue-50 border-blue-200" },
    unannounced: { label: "ตรวจสุ่มไม่แจ้งล่วงหน้า (Unannounced)", color: "text-amber-700 bg-amber-50 border-amber-200" },
    spot: { label: "ตรวจเฉพาะกิจ (Spot Check)", color: "text-purple-700 bg-purple-50 border-purple-200" },
    undercover: { label: "ตรวจแบบประเมินลึกลับ (Undercover)", color: "text-rose-700 bg-rose-50 border-rose-200" },
    followup: { label: "ตรวจติดตามผลงานแก้ไข (Follow-up)", color: "text-emerald-700 bg-emerald-50 border-emerald-200" }
  };

  const currentType = auditTypeMeta[item.auditType] || auditTypeMeta.announced;

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      if (item.id) {
        await api.delete(`/schedule/${item.id}`);
      }
      if (refreshData) {
        await refreshData();
      }
      setShowDeleteModal(false);
      onBack();
    } catch (err) {
      setDeleteError(err.response?.data?.message || err.message || "เกิดข้อผิดพลาดในการลบ");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteSchedule = () => {
    if (isCompleted) {
      setDeleteError("ไม่สามารถลบนัดหมายที่ตรวจเสร็จสิ้นแล้วได้ เพื่อความโปร่งใสของข้อมูล");
      return;
    }
    setShowDeleteModal(true);
  };

  if (selectedAudit) {
    return (
      <AuditHistoryDetail
        unitName={item.unit || item.locationName || unit?.fullName || unit?.name}
        record={selectedAudit}
        onBack={() => setSelectedAudit(null)}
      />
    );
  }

  return (
    <div className="page-transition p-4 sm:p-6 space-y-4 w-full max-w-[100%] sm:max-w-[96%] md:max-w-[92%] mx-auto pb-12">
      <Header title="รายละเอียดกำหนดการตรวจ" onBack={onBack} />

      <div className="space-y-4">
        {/* Main Info Card */}
        <div className="rounded-3xl p-5 sm:p-6 shadow-2xs space-y-4 bg-white border border-slate-200">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-extrabold text-slate-400 mb-1">สาขาเป้าหมาย</div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">{item.unit || item.locationName}</h2>
              <div className="text-xs font-semibold text-slate-500 mt-1">{item.date || "-"} {item.time ? `· ${item.time}` : ""}</div>
            </div>
            <div className="text-right shrink-0">
              <span className={`inline-flex items-center gap-1 text-xs font-extrabold px-3 py-1 rounded-full ${
                isCompleted ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
              }`}>
                {isCompleted ? <Check size={13} /> : <Clock size={13} />}
                <span>{isCompleted ? "ตรวจเสร็จสิ้นแล้ว" : "รอนัดตรวจ"}</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100">
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <div className="text-[11px] font-extrabold text-slate-400">ผู้ตรวจประเมิน</div>
              <div className="text-xs sm:text-sm font-bold text-slate-800 mt-0.5">{item.auditor || item.auditorName}</div>
            </div>
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <div className="text-[11px] font-extrabold text-slate-400">แบบฟอร์มที่ใช้</div>
              <div className="text-xs sm:text-sm font-bold text-slate-800 mt-0.5 truncate">{item.form || item.surveyFormTitle}</div>
            </div>
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 col-span-2 sm:col-span-1">
              <div className="text-[11px] font-extrabold text-slate-400">ประเภทการตรวจ</div>
              <div className="text-xs sm:text-sm font-bold text-slate-800 mt-0.5">{auditTypeMeta.label}</div>
            </div>
          </div>
        </div>

        {/* Address & Contact */}
        {unit && (
          <div className="rounded-3xl p-5 shadow-2xs space-y-2 bg-white border border-slate-200">
            <div className="flex items-start gap-2 text-xs font-semibold text-slate-600">
              <MapPin size={15} className="mt-0.5 shrink-0 text-[#0F6659]" />
              <span>{unit.address}</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <Phone size={15} className="shrink-0 text-[#0F6659]" />
              <span>{unit.phone}</span>
            </div>
          </div>
        )}

        {/* 🔒 Action Buttons & Status Restrictions */}
        {isCompleted ? (
          /* Locked Status: Completed audits cannot be edited or deleted */
          <div className="rounded-2xl p-4 flex items-center justify-between border bg-slate-50 border-slate-200 shadow-2xs text-slate-600">
            <div className="flex items-center gap-2.5">
              <Lock size={18} className="text-slate-400" />
              <div className="text-xs font-bold text-slate-700">
                ตรวจเสร็จสิ้น · ข้อมูลถูกบันทึกเรียบร้อย
              </div>
            </div>
            <span className="text-xs font-extrabold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-xl shrink-0">
              ✓ บันทึกผลแล้ว
            </span>
          </div>
        ) : (
          /* Pending / In-Progress Actions */
          <div className="space-y-2.5">
            {isAuditorOrAdmin && (
              <button
                type="button"
                onClick={() => onStartAudit(item)}
                className="w-full py-4 rounded-2xl text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-md bg-[#0F6659] text-white transition-all active:scale-[0.99]"
              >
                <ClipboardCheck size={18} /> เริ่มตรวจสาขานี้ตามแผนงานทันที ➔
              </button>
            )}

            {/* ✏️ Edit / 🗑️ Delete Buttons (Only for Pending Schedules) */}
            {isPending && (
              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => onEdit && onEdit(item)}
                  className="flex-1 py-3 rounded-xl text-xs font-extrabold bg-white border border-slate-300 hover:border-emerald-500 text-slate-700 hover:text-[#0F6659] cursor-pointer shadow-2xs transition-all active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Edit3 size={15} />
                  <span>แก้ไขนัดหมาย</span>
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSchedule}
                  disabled={isDeleting}
                  className="flex-1 py-3 rounded-xl text-xs font-extrabold bg-white border border-red-200 hover:bg-red-50 text-red-600 cursor-pointer shadow-2xs transition-all active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={15} />
                  <span>{isDeleting ? "กำลังลบ..." : "ยกเลิก/ลบนัดตรวจ"}</span>
                </button>
              </div>
            )}
          </div>
        )}

        <Section title="ประวัติการตรวจย้อนหลัง" action={<span className="text-xs font-medium text-slate-400">แตะเพื่อดูรายละเอียด</span>}>
          <HistoryList history={branchHistory} onSelect={setSelectedAudit} />
        </Section>
      </div>

      {/* 🗑️ Custom Delete Schedule Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 space-y-4 text-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-3xl bg-rose-50 border border-rose-200/80 text-rose-600 flex items-center justify-center mx-auto shadow-2xs">
              <Trash2 size={28} strokeWidth={2} />
            </div>

            <div className="space-y-1">
              <h4 className="text-lg font-black text-slate-900">ลบนัดหมายการตรวจ?</h4>
              <p className="text-xs text-slate-500 font-medium px-2">
                คุณแน่ใจหรือไม่ที่จะลบนัดหมายตรวจสาขา <br/>
                <span className="font-bold text-slate-800">"{item.unit || item.locationName}"</span>?
              </p>
              {deleteError && (
                <p className="text-xs font-bold text-rose-600 bg-rose-50 p-2 rounded-xl border border-rose-200 mt-2">
                  ⚠️ {deleteError}
                </p>
              )}
            </div>

            <div className="pt-2 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs cursor-pointer transition-all active:scale-95 border border-slate-200"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="py-3 px-4 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs cursor-pointer transition-all active:scale-95 shadow-md shadow-rose-600/20 flex items-center justify-center gap-1.5"
              >
                {isDeleting ? "กำลังลบ..." : "ยืนยันลบข้อมูล"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
