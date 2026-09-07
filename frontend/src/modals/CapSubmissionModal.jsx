import React, { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Store, Camera, Send, Trash2, X, AlertTriangle, Wrench } from "lucide-react";


import { c, sans, mono, cardStyle } from "../config/theme";
import ModalWrapper from "../shared/ModalWrapper";
import Header from "../shared/Header";
import Section from "../shared/Section";
import ScoreRing from "../shared/ScoreRing";
import HistoryList from "../shared/HistoryList";
import ErrorBoundary from "../shared/ErrorBoundary";
import { compressImageFile } from "../utils/imageCompressor";

export default function CapSubmissionModal({ question, unitName, onSave, onClose }) {
  const [actionText, setActionText] = useState("");
  const [photoBase64, setPhotoBase64] = useState(null);
  const [responsibleName, setResponsibleName] = useState("ผู้จัดการสาขา (Store Manager)");
  const [dueDate, setDueDate] = useState("ภายใน 24 ชม. (เร่งด่วน)");
  const [formError, setFormError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file);
      setPhotoBase64(compressed);
      if (formError) setFormError(null);
    } catch (err) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPhotoBase64(ev.target.result);
        if (formError) setFormError(null);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!actionText.trim()) {
      setFormError("กรุณากรอกรายละเอียดการดำเนินการแก้ไข");
      return;
    }
    if (!photoBase64) {
      setFormError("กรุณาแนบรูปถ่ายหลักฐานหลังการแก้ไขก่อนส่งงาน");
      return;
    }
    setFormError(null);
    onSave({
      qId: question.id,
      qNum: question.num,
      qText: question.text,
      auditorNote: question.note,
      actionText,
      photoAttached: true,
      photo: photoBase64,
      imageUrls: [photoBase64],
      responsibleName,
      dueDate,
      submittedAt: new Date().toLocaleDateString("th-TH", { day: 'numeric', month: 'short', year: '2-digit' }) + " " + new Date().toLocaleTimeString("th-TH", { hour: '2-digit', minute: '2-digit' }) + " น.",
      status: "pending_approval",
    });
    onClose();
  };

  return (
    <ModalWrapper onClose={onClose} maxWidth="max-w-lg">
        {/* Modal Header */}
        <div className="shrink-0 p-4 border-b flex items-center justify-between" style={{ borderColor: c.border, background: "#FAF9F5" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-800 shrink-0">
              <Wrench size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">ส่งมอบงานแก้ไข (Corrective Action - CAP)</h3>
              <p className="text-xs text-slate-500">{unitName} · ข้อคำถามที่ {question.num}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-200 active:bg-slate-300 cursor-pointer transition-colors">
            <X size={18} style={{ color: c.faint }} />
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Issue Summary Box */}
          <div className="p-3.5 rounded-2xl bg-red-50/80 border border-red-200 space-y-1.5">
            <div className="text-xs font-bold text-red-900 flex items-center gap-1.5">
              <AlertTriangle size={14} className="text-red-600" />
              <span>ข้อบกพร่องที่ตรวจพบ (Defect)</span>
            </div>
            <div className="text-xs font-bold text-slate-800">{question.text}</div>
            {question.note && (
              <div className="text-xs text-amber-900 bg-white/90 p-2.5 rounded-xl border border-amber-200/80 font-medium">
                💬 <b>บันทึกของผู้ตรวจ:</b> {question.note}
              </div>
            )}
          </div>

          {/* Corrective Action Taken Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">
              1. สิ่งที่สาขาได้ดำเนินการแก้ไขหน้างาน <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              required
              value={actionText}
              onChange={(e) => setActionText(e.target.value)}
              placeholder="ระบุสิ่งที่สาขาได้ดำเนินการแก้ไข เช่น ได้ทำการขัดล้างทำความสะอาดคราบไขมันหลังเตาปรุงอาหารเรียบร้อยแล้ว และตั้งรอบทำความสะอาด Deep Clean ทุกสัปดาห์..."
              className="w-full text-xs p-3 rounded-xl border outline-none font-medium text-slate-800 focus:border-emerald-600"
              style={{ borderColor: c.border, background: c.bg }}
            />
          </div>

          {/* Upload After Photo Evidence */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">
              2. แนบรูปถ่ายหลักฐานหลังการแก้ไข (After Photo) <span className="text-red-500">*</span>
            </label>
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
            {photoBase64 ? (
              <div className="relative rounded-2xl border border-emerald-300 bg-emerald-50/70 p-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={photoBase64}
                    alt="Evidence Preview"
                    className="w-14 h-14 rounded-xl object-cover border border-emerald-400 shrink-0 shadow-2xs"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-emerald-950 truncate">แนบรูปถ่ายหลักฐานสำเร็จ</div>
                    <div className="text-[11px] text-emerald-700 font-medium truncate">พร้อมส่งเพื่อขออนุมัติปิดงาน</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1 text-xs font-bold rounded-2xl border border-emerald-400 bg-white text-emerald-800 hover:bg-emerald-50 cursor-pointer"
                  >
                    เปลี่ยนรูป
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhotoBase64(null)}
                    className="p-1.5 rounded-xl text-red-600 hover:bg-red-50 cursor-pointer"
                    title="ลบรูป"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-4 rounded-2xl border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50 hover:bg-emerald-50/30 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all text-slate-600"
              >
                <Camera size={24} className="text-slate-400" />
                <div className="text-center">
                  <div className="text-xs font-bold text-slate-700">
                    แตะเพื่อถ่ายรูปหรืออัปโหลดหลักฐานหลังแก้ไข
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    รองรับไฟล์ JPG, PNG พร้อมบีบอัดอัตโนมัติ
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Responsible Person */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">ผู้รับผิดชอบงานแก้ไข</label>
              <input
                type="text"
                value={responsibleName}
                onChange={(e) => setResponsibleName(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl border outline-none font-medium"
                style={{ borderColor: c.border, background: c.bg }}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">กำหนดส่งมอบงาน</label>
              <input
                type="text"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl border outline-none font-medium"
                style={{ borderColor: c.border, background: c.bg }}
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md text-white transition-all active:scale-[0.99] bg-[#0F6659]"
            >
              <Send size={15} /> ส่งหลักฐานเพื่อขออนุมัติปิดงานแก้ไข (CAP)
            </button>
          </div>
        </form>
    </ModalWrapper>
  );
}
