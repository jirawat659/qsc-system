import React, { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Store, Camera, Send, Trash2, X, AlertTriangle, Wrench, Plus, Loader2 } from "lucide-react";


import { c, sans, mono, cardStyle } from "../config/theme";
import ModalWrapper from "../shared/ModalWrapper";
import Header from "../shared/Header";
import Section from "../shared/Section";
import ScoreRing from "../shared/ScoreRing";
import HistoryList from "../shared/HistoryList";
import ErrorBoundary from "../shared/ErrorBoundary";
import { compressImageFile, validateImageFile } from "../utils/imageCompressor";
import { lockBodyScroll, unlockBodyScroll } from "../utils/scrollLock";

export default function CapSubmissionModal({ question, unitName, onSave, onClose }) {
  const [actionText, setActionText] = useState("");
  const [photos, setPhotos] = useState([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [previewModalPhoto, setPreviewModalPhoto] = useState(null);

  useEffect(() => {
    if (!previewModalPhoto) return;
    lockBodyScroll();
    return () => {
      unlockBodyScroll();
    };
  }, [previewModalPhoto]);
  const [responsibleName, setResponsibleName] = useState("ผู้จัดการสาขา (Store Manager)");
  const [dueDate, setDueDate] = useState("ภายใน 24 ชม. (เร่งด่วน)");
  const [formError, setFormError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const rawFileList = Array.from(files);
    const validFiles = [];
    const validationErrors = [];

    for (const f of rawFileList) {
      const check = validateImageFile(f);
      if (!check.valid) {
        validationErrors.push(`${f.name || "ไฟล์"}: ${check.message}`);
      } else {
        validFiles.push(f);
      }
    }

    if (validationErrors.length > 0) {
      setFormError(validationErrors.join(" | "));
      if (validFiles.length === 0) {
        e.target.value = "";
        return;
      }
    }

    setIsCompressing(true);
    try {
      const compressedUrls = await Promise.all(validFiles.map((f) => compressImageFile(f)));
      setPhotos((prev) => [...prev, ...compressedUrls]);
      if (formError && validationErrors.length === 0) setFormError(null);
    } catch (err) {
      console.error("Compression error:", err);
      setFormError("เกิดข้อผิดพลาดในการประมวลผลรูปภาพ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsCompressing(false);
    }
    e.target.value = "";
  };

  const handleRemovePhoto = (idx) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!actionText.trim()) {
      setFormError("กรุณากรอกรายละเอียดการดำเนินการแก้ไข");
      return;
    }
    if (photos.length === 0) {
      setFormError("กรุณาแนบรูปถ่ายหลักฐานหลังการแก้ไขอย่างน้อย 1 รูป");
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
      photo: photos[0],
      photos: photos,
      images: photos,
      imageUrls: photos,
      responsibleName,
      dueDate,
      submittedAt: new Date().toLocaleDateString("th-TH", { day: 'numeric', month: 'short', year: '2-digit' }) + " " + new Date().toLocaleTimeString("th-TH", { hour: '2-digit', minute: '2-digit' }) + " น.",
      status: "pending_approval",
    });
    onClose();
  };

  return (
    <>
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
              placeholder="ระบุสิ่งที่สาขาได้ดำเนินการแก้ไข เช่น ได้ทำการขัดล้างทำความสะอาดคราบไขมันหลังเตาปรุงอาหารเรียบร้อยแล้ว"
              className="w-full text-xs p-3 rounded-xl border outline-none font-medium text-slate-800 focus:border-emerald-600"
              style={{ borderColor: c.border, background: c.bg }}
            />
          </div>

          {/* Upload After Photo Evidence */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 block">
                2. แนบรูปถ่ายหลักฐานหลังการแก้ไข (After Photo) <span className="text-red-500">*</span>
              </label>
              {photos.length > 0 && (
                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-300">
                  แนบแล้ว {photos.length} รูป
                </span>
              )}
            </div>

            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />

            {photos.length === 0 ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-5 rounded-2xl border-2 border-dashed border-slate-300 hover:border-[#0F6659] bg-slate-50 hover:bg-emerald-50/30 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all text-slate-600 active:scale-[0.99] group"
              >
                <div className="w-11 h-11 rounded-2xl bg-white border border-slate-200 flex items-center justify-center group-hover:border-emerald-300 group-hover:bg-emerald-50 text-slate-400 group-hover:text-[#0F6659] transition-all shadow-2xs">
                  {isCompressing ? (
                    <Loader2 size={22} className="animate-spin text-[#0F6659]" />
                  ) : (
                    <Camera size={22} />
                  )}
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-slate-700 group-hover:text-[#0F6659] transition-colors">
                    {isCompressing ? "กำลังประมวลผลรูปภาพ..." : "แตะเพื่ออัปโหลดรูปภาพ"}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    รองรับไฟล์ JPG, PNG
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                  {photos.map((img, idx) => (
                    <div
                      key={idx}
                      className="relative aspect-square rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 shadow-2xs group cursor-pointer"
                      onClick={() => setPreviewModalPhoto(img)}
                    >
                      <img
                        src={img}
                        alt={`Evidence ${idx + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20 pointer-events-none" />

                      <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-white text-[10px] font-bold font-mono">
                        #{idx + 1}
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemovePhoto(idx);
                        }}
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 hover:bg-rose-600 text-white flex items-center justify-center cursor-pointer transition-all shadow-sm active:scale-90"
                        title="ลบรูปนี้"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}

                  {/* Add More Tile */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isCompressing}
                    className="aspect-square rounded-2xl border-2 border-dashed border-slate-300 hover:border-[#0F6659] hover:bg-emerald-50/40 bg-slate-50 flex flex-col items-center justify-center gap-1.5 text-slate-500 hover:text-[#0F6659] cursor-pointer transition-all active:scale-95 group disabled:opacity-50"
                  >
                    <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center group-hover:border-emerald-300 transition-colors shadow-2xs">
                      {isCompressing ? (
                        <Loader2 size={16} className="animate-spin text-[#0F6659]" />
                      ) : (
                        <Plus size={16} className="text-slate-500 group-hover:text-[#0F6659]" />
                      )}
                    </div>
                    <span className="text-[11px] font-bold text-slate-600 group-hover:text-[#0F6659]">
                      {isCompressing ? "กำลังบีบอัด..." : "เพิ่มรูป"}
                    </span>
                  </button>
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

      {/* 🔍 MODAL ขยายรูปภาพขนาดเต็ม (Lightbox) */}
      {previewModalPhoto && (
        <div 
          className="fixed inset-0 z-[100000] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setPreviewModalPhoto(null)}
        >
          <div className="relative max-w-2xl max-h-[85dvh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPreviewModalPhoto(null)}
              className="absolute -top-10 right-0 w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center cursor-pointer transition-all shadow-md"
              title="ปิด"
            >
              <X size={18} />
            </button>
            <img
              src={previewModalPhoto}
              alt="Preview"
              className="max-h-[80dvh] w-auto max-w-full rounded-2xl object-contain shadow-2xl border border-white/10"
            />
          </div>
        </div>
      )}
    </>
  );
}
