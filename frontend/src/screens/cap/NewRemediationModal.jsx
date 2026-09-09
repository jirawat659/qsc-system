import React, { useState, useMemo, useRef } from "react";
import { Camera, Check, X, AlertTriangle, Wrench, MapPin, Store, ChevronRight, Plus, Calendar, FileText, Loader2 } from "lucide-react";

import { c, sans, mono } from "../../config/theme";
import ModalWrapper from "../../shared/ModalWrapper";
import { compressImageFile } from "../../utils/imageCompressor";
import LocationSelectModal from "../../modals/LocationSelectModal";
import api from "../../config/api";

export default function NewRemediationModal({ onClose, onSuccess, locations = [], currentUser }) {
  const [selectedLocationId, setSelectedLocationId] = useState(locations[0]?.id || 1);
  const [showLocationSelectModal, setShowLocationSelectModal] = useState(false);
  const [issueItem, setIssueItem] = useState("");
  const [description, setDescription] = useState("");
  
  // Default deadline: 7 days from today
  const [deadlineDate, setDeadlineDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  });
  
  const [photos, setPhotos] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    try {
      const fileList = Array.from(files);
      const compressedUrls = await Promise.all(fileList.map(f => compressImageFile(f)));
      setPhotos(prev => [...prev, ...compressedUrls]);
      if (formError) setFormError(null);
    } catch (err) {
      console.error("Compression error:", err);
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          setPhotos(prev => [...prev, ev.target.result]);
          if (formError) setFormError(null);
        };
        reader.readAsDataURL(file);
      });
    }
    e.target.value = "";
  };

  const handleRemovePhoto = (idx) => {
    setPhotos(prev => prev.filter((_, i) => i !== idx));
  };

  const selectedLoc = useMemo(() => {
    return locations.find(l => String(l.id) === String(selectedLocationId)) || locations[0];
  }, [locations, selectedLocationId]);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!selectedLoc?.id) {
      setFormError("กรุณาเลือกสาขาที่ต้องการมอบหมายงานแก้ไข");
      return;
    }
    if (!issueItem.trim()) {
      setFormError("กรุณาระบุหัวข้อข้อบกพร่องหรือปัญหาที่ตรวจพบ");
      return;
    }
    if (!description.trim()) {
      setFormError("กรุณาระบุรายละเอียดและคำแนะนำสิ่งที่สาขาต้องดำเนินการแก้ไข");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const deadlineIso = deadlineDate ? new Date(`${deadlineDate}T23:59:59.000Z`).toISOString() : null;
      
      const payload = {
        locationId: selectedLoc.id,
        issueItem: issueItem.trim(),
        description: description.trim(),
        submissionDeadline: deadlineIso,
        imageUrls: photos
      };

      const res = await api.post("/cap", payload);
      if (onSuccess) onSuccess(res.data);
      onClose();
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || "เกิดข้อผิดพลาดในการสร้างงานแก้ไข");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalWrapper onClose={onClose} maxWidth="max-w-lg">
      {/* Pinned Header */}
      <div className="p-4 border-b flex items-center justify-between shrink-0 bg-slate-50 border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-[#0F6659] shrink-0 font-bold">
            <Wrench size={16} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">สร้างงานแก้ไขใหม่ให้สาขา (Assign CAP Task)</h3>
            <p className="text-[11px] text-slate-500">มอบหมายข้อบกพร่องเพื่อให้ผู้จัดการร้านดำเนินการปรับปรุงแก้ไข</p>
          </div>
        </div>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 cursor-pointer transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Scrollable Form Body */}
      <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 flex-1 overflow-y-auto min-h-0 custom-tab-scrollbar">
        {formError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
            <AlertTriangle size={15} className="shrink-0 text-rose-600" />
            <span>{formError}</span>
          </div>
        )}

        {/* 1. Dedicated Interactive Branch Selector */}
        <div className="min-w-0 w-full space-y-1.5">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <MapPin size={14} className="text-[#0F6659]" />
            <span>สาขาที่ต้องการมอบหมายงานแก้ไข <span className="text-rose-500">*</span></span>
          </label>

          <div
            onClick={() => setShowLocationSelectModal(true)}
            className="w-full p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200/90 hover:border-[#0F6659] hover:bg-emerald-50/20 cursor-pointer transition-all flex items-center justify-between gap-3 shadow-2xs group active:scale-[0.99] min-w-0"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-emerald-50 text-[#0F6659] border border-emerald-200/60 flex items-center justify-center shrink-0 font-bold group-hover:bg-[#0F6659] group-hover:text-white transition-all shadow-2xs">
                <Store size={20} />
              </div>

              <div className="min-w-0 flex-1">
                {selectedLoc ? (
                  <div className="space-y-1">
                    <div className="text-sm sm:text-base font-bold text-slate-800 line-clamp-2 group-hover:text-[#0F6659] transition-colors leading-snug">
                      {selectedLoc.fullName || selectedLoc.name}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                      {selectedLoc.code && (
                        <span className="font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded-md text-[11px]">
                          {selectedLoc.code}
                        </span>
                      )}
                      {selectedLoc.region && (
                        <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                          <span>📍 {selectedLoc.region}</span>
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-sm font-bold text-slate-700 group-hover:text-[#0F6659] transition-colors">
                      แตะเพื่อเลือกสาขา
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

        {/* 2. Issue Title / Defect Subject */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <FileText size={14} className="text-[#0F6659]" />
            <span>หัวข้อข้อบกพร่อง / ปัญหาที่ตรวจพบ <span className="text-rose-500">*</span></span>
          </label>
          <input
            type="text"
            required
            value={issueItem}
            onChange={(e) => {
              setIssueItem(e.target.value);
              if (formError) setFormError(null);
            }}
            placeholder="เช่น ความสะอาดบริเวณเตาปรุงอาหาร, อุณหภูมิตู้แช่เย็นไม่ได้มาตรฐาน..."
            className="w-full text-xs sm:text-sm px-3.5 py-3 rounded-2xl bg-white border border-slate-200 outline-none font-semibold text-slate-800 focus:border-[#0F6659] transition-all shadow-2xs placeholder:text-slate-400"
          />
        </div>

        {/* 3. Description & Correction Guidelines */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 block">
            รายละเอียดสิ่งที่ต้องปรับปรุงแก้ไข (คำแนะนำแก่สาขา) <span className="text-rose-500">*</span>
          </label>
          <textarea
            value={description}
            required
            rows={3}
            onChange={(e) => {
              setDescription(e.target.value);
              if (formError) setFormError(null);
            }}
            placeholder="ระบุสิ่งที่ควรปรับปรุงแก้ไข"
            className="w-full p-3 rounded-2xl border border-slate-200 text-xs sm:text-sm font-medium bg-white text-slate-800 placeholder:text-slate-400 focus:border-[#0F6659] outline-none shadow-2xs leading-relaxed"
          />
        </div>

        {/* 4. Submission Deadline */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Calendar size={14} className="text-[#0F6659]" />
            <span>กำหนดส่งมอบงานแก้ไข (Deadline) <span className="text-rose-500">*</span></span>
          </label>
          <input
            type="date"
            required
            value={deadlineDate}
            onChange={(e) => setDeadlineDate(e.target.value)}
            className="w-full text-xs sm:text-sm p-3 rounded-2xl bg-white border border-slate-200 outline-none font-bold text-slate-800 focus:border-[#0F6659] transition-all shadow-2xs cursor-pointer"
          />
        </div>

        {/* 5. Defect Photos Found during Audit (Optional Before Photos) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Camera size={14} className="text-slate-500" />
              <span>แนบรูปถ่ายปัญหาตอนตรวจพบ (Audit Finding Photo - ถ้ามี)</span>
            </label>
            {photos.length > 0 && (
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                แนบแล้ว {photos.length} รูป
              </span>
            )}
          </div>

          <input
            type="file"
            accept="image/*"
            multiple
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />

          {photos.length > 0 ? (
            <div className="space-y-2.5">
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                {photos.map((img, idx) => (
                  <div
                    key={idx}
                    className="relative aspect-square rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 shadow-2xs group"
                  >
                    <img
                      src={img}
                      alt={`Defect ${idx + 1}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30 pointer-events-none" />

                    <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-white text-[10px] font-bold font-mono">
                      #{idx + 1}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(idx)}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center cursor-pointer transition-all shadow-sm active:scale-90"
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
                  className="aspect-square rounded-2xl border-2 border-dashed border-slate-300 hover:border-[#0F6659] hover:bg-emerald-50/40 bg-slate-50 flex flex-col items-center justify-center gap-1.5 text-slate-500 hover:text-[#0F6659] cursor-pointer transition-all active:scale-95 group"
                >
                  <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center group-hover:border-emerald-300 transition-colors shadow-2xs">
                    <Plus size={16} className="text-slate-500 group-hover:text-[#0F6659]" />
                  </div>
                  <span className="text-[11px] font-bold text-slate-600 group-hover:text-[#0F6659]">เพิ่มรูป</span>
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 px-0.5">
                <span>รูปถ่ายนี้จะแสดงเป็นภาพก่อนแก้ไข (Before) ให้สาขาเห็น</span>
                <button
                  type="button"
                  onClick={() => setPhotos([])}
                  className="text-rose-600 hover:text-rose-700 font-semibold cursor-pointer"
                >
                  ลบทั้งหมด
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full p-3.5 sm:p-4 rounded-2xl border-2 border-dashed border-slate-300 hover:border-[#0F6659] bg-slate-50 hover:bg-emerald-50/40 flex flex-col items-center justify-center gap-1.5 text-slate-600 transition-all cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center group-hover:border-emerald-300 group-hover:scale-105 transition-all shadow-2xs">
                <Camera size={20} className="text-slate-400 group-hover:text-[#0F6659]" />
              </div>
              <div className="text-center">
                <div className="text-xs sm:text-sm font-bold text-slate-700 group-hover:text-[#0F6659] transition-colors">
                  แตะเพื่อแนบรูปถ่ายปัญหาตอนตรวจพบ
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  (ไม่บังคับ) สาขาจะเห็นรูปนี้เป็นภาพตั้งต้นก่อนแก้ไข
                </div>
              </div>
            </button>
          )}
        </div>
      </form>

      {/* Pinned Bottom Action Footer */}
      <div className="p-4 border-t border-slate-100 bg-white shrink-0">
        <button
          type="button"
          disabled={isSubmitting}
          onClick={handleSubmit}
          className="w-full py-3.5 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md bg-[#0F6659] hover:bg-emerald-800 text-white transition-all active:scale-[0.99] disabled:opacity-60"
        >
          {isSubmitting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>กำลังบันทึกและมอบหมายงาน...</span>
            </>
          ) : (
            <>
              <Check size={16} /> <span>มอบหมายงานแก้ไขให้สาขา</span>
            </>
          )}
        </button>
      </div>

      {/* 🏬 Dedicated Full-Screen Branch Selector Modal */}
      {showLocationSelectModal && (
        <LocationSelectModal
          currentLocationId={selectedLoc?.id}
          currentLocationName={selectedLoc?.name}
          locations={locations}
          onSelect={(loc) => {
            setSelectedLocationId(loc.id);
            setShowLocationSelectModal(false);
          }}
          onClose={() => setShowLocationSelectModal(false)}
        />
      )}
    </ModalWrapper>
  );
}
