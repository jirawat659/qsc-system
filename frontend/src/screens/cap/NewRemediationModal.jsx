import React, { useState, useMemo, useEffect, useRef } from "react";
import { Camera, Check, X, AlertTriangle, Wrench, MapPin, Store, ChevronRight, Plus, Calendar, FileText, Loader2, Layers, ClipboardList } from "lucide-react";

import ModalWrapper from "../../shared/ModalWrapper";
import { compressImageFile, validateImageFile } from "../../utils/imageCompressor";
import { isFormApplicableToLocation } from "../../utils/formMatching";
import LocationSelectModal from "../../modals/LocationSelectModal";
import api from "../../config/api";
import { getCategoryDisplay } from "../../config/constants";

export const CORE_SCORE_CATEGORIES = [
  "Product",
  "Process",
  "Service",
  "Cleanliness",
  "Documents"
];

export default function NewRemediationModal({ onClose, onSuccess, locations = [], currentUser }) {
  const [selectedLocationId, setSelectedLocationId] = useState(locations[0]?.id || null);
  const [showLocationSelectModal, setShowLocationSelectModal] = useState(false);

  // Cascading Form & Category States
  const [forms, setForms] = useState([]);
  const [selectedFormId, setSelectedFormId] = useState("");
  const [selectedCategoryName, setSelectedCategoryName] = useState("");
  const [isLoadingForms, setIsLoadingForms] = useState(false);

  const [issueItem, setIssueItem] = useState("");
  const [description, setDescription] = useState("");
  
  const [deadlineDate, setDeadlineDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  });
  
  const [photos, setPhotos] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const fileInputRef = useRef(null);

  const selectedLoc = useMemo(() => {
    return locations.find(l => String(l.id) === String(selectedLocationId)) || locations[0];
  }, [locations, selectedLocationId]);

  // ดึงรายการแบบฟอร์มทั้งหมดตอนเปิด Modal
  useEffect(() => {
    let isMounted = true;
    setIsLoadingForms(true);
    api.get("/form")
      .then(res => {
        if (isMounted && Array.isArray(res.data)) {
          setForms(res.data.filter(f => f.isActive));
        }
      })
      .catch(err => console.warn("Failed to fetch forms:", err))
      .finally(() => { if (isMounted) setIsLoadingForms(false); });
    return () => { isMounted = false; };
  }, []);

  // กรองฟอร์มที่เข้ากับสาขาที่เลือก (isFormApplicableToLocation)
  const applicableForms = useMemo(() => {
    if (!selectedLoc) return [];
    return forms.filter(f => isFormApplicableToLocation(f, selectedLoc));
  }, [forms, selectedLoc]);

  // เลือกลำดับฟอร์มอัตโนมัติเมื่อสาขาเปลี่ยน
  useEffect(() => {
    if (applicableForms.length > 0) {
      setSelectedFormId(applicableForms[0].id.toString());
    } else {
      setSelectedFormId("");
    }
  }, [applicableForms]);

  // 🏷️ ดึงเฉพาะ "หมวดของคะแนน" (Score Categories) ไม่นำหมวดคำถาม/โซนการตรวจ (Section Title) มารวม
  const availableCategories = useMemo(() => {
    const catSet = new Set();

    // 1. ดึงจาก item.categoryName ในฟอร์มที่เลือก และกรองให้อยู่ใน 5 หมวดหลัก
    if (selectedFormId) {
      const currentForm = applicableForms.find(f => f.id.toString() === selectedFormId.toString());
      if (currentForm && currentForm.sections) {
        currentForm.sections.forEach(sec => {
          (sec.items || []).forEach(item => {
            let cat = (item.categoryName || item.category || "").trim();
            const upper = cat.toUpperCase();
            if (cat === "Product" || upper === "PD" || upper === "QLT" || cat.includes("คุณภาพ")) cat = "Product";
            else if (cat === "Process" || upper === "PC" || upper === "OPS" || cat.includes("กระบวนการ")) cat = "Process";
            else if (cat === "Service" || upper === "S" || upper === "SVC" || cat.includes("บริการ")) cat = "Service";
            else if (cat === "Cleanliness" || upper === "C" || upper === "CLN" || cat.includes("สะอาด")) cat = "Cleanliness";
            else if (cat === "Documents" || upper === "DM" || upper === "DOC" || cat.includes("เอกสาร")) cat = "Documents";
            else cat = "Product";
            if (cat) catSet.add(cat);
          });
        });
      }
    }

    // 2. ให้มี 5 หมวดคะแนนหลักตามมาตรฐาน QSC เป็นตัวเลือกเสมอ (เรียงตามลำดับมาตรฐาน)
    CORE_SCORE_CATEGORIES.forEach(core => catSet.add(core));

    const result = Array.from(catSet);
    result.sort((a, b) => CORE_SCORE_CATEGORIES.indexOf(a) - CORE_SCORE_CATEGORIES.indexOf(b));
    return result;
  }, [selectedFormId, applicableForms]);

  // เลือกลำดับหมวดหมู่อัตโนมัติ
  useEffect(() => {
    if (availableCategories.length > 0) {
      setSelectedCategoryName(availableCategories[0]);
    } else {
      setSelectedCategoryName("Product");
    }
  }, [availableCategories]);

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

    try {
      const compressedUrls = await Promise.all(validFiles.map(f => compressImageFile(f)));
      setPhotos(prev => [...prev, ...compressedUrls]);
      if (formError && validationErrors.length === 0) setFormError(null);
    } catch (err) {
      console.error("Compression error:", err);
      setFormError("เกิดข้อผิดพลาดในการประมวลผลรูปภาพ กรุณาลองใหม่อีกครั้ง");
    }
    e.target.value = "";
  };

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
      setFormError("กรุณาระบุรายละเอียดคำแนะนำสิ่งที่สาขาต้องดำเนินการแก้ไข");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const deadlineIso = deadlineDate ? new Date(`${deadlineDate}T23:59:59.000Z`).toISOString() : null;
      
      const payload = {
        locationId: selectedLoc.id,
        categoryName: selectedCategoryName || "ทั่วไป",
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
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors">
          <X size={16} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 flex-1 overflow-y-auto min-h-0 custom-tab-scrollbar">
        {formError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
            <AlertTriangle size={15} className="shrink-0 text-rose-600" />
            <span>{formError}</span>
          </div>
        )}

        {/* 1. เลือกสาขา (Location) */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <MapPin size={14} className="text-[#0F6659]" />
            <span>สาขาที่ต้องการมอบหมายงานแก้ไข <span className="text-rose-500">*</span></span>
          </label>
          <div
            onClick={() => setShowLocationSelectModal(true)}
            className="w-full p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-[#0F6659] cursor-pointer transition-all flex items-center justify-between gap-3 shadow-2xs group"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#0F6659] flex items-center justify-center shrink-0">
                <Store size={20} />
              </div>
              <div className="min-w-0 flex-1">
                {selectedLoc ? (
                  <div>
                    <div className="text-sm font-bold text-slate-800 line-clamp-1">{selectedLoc.fullName || selectedLoc.name}</div>
                    <div className="text-xs text-slate-500">รหัส: {selectedLoc.code} | {selectedLoc.region}</div>
                  </div>
                ) : (
                  <div className="text-sm font-bold text-slate-700">แตะเพื่อเลือกสาขา</div>
                )}
              </div>
            </div>
            <ChevronRight size={18} className="text-slate-400 group-hover:text-[#0F6659]" />
          </div>
        </div>

        {/* 2. เลือกแบบฟอร์ม (Form) & 3. เลือกหมวดหมู่ (Category) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <ClipboardList size={14} className="text-[#0F6659]" />
              <span>แบบฟอร์มตรวจประเมิน</span>
            </label>
            <select
              value={selectedFormId}
              onChange={(e) => setSelectedFormId(e.target.value)}
              disabled={isLoadingForms || applicableForms.length === 0}
              className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 focus:border-[#0F6659] outline-none"
            >
              {applicableForms.length > 0 ? (
                applicableForms.map(f => (
                  <option key={f.id} value={f.id}>{f.title}</option>
                ))
              ) : (
                <option value="">ไม่มีฟอร์มที่ตรงกับสาขานี้</option>
              )}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Layers size={14} className="text-[#0F6659]" />
              <span>หมวดหมู่ข้อบกพร่อง</span>
            </label>
            <select
              value={selectedCategoryName}
              onChange={(e) => setSelectedCategoryName(e.target.value)}
              className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 focus:border-[#0F6659] outline-none"
            >
              {availableCategories.length > 0 ? (
                availableCategories.map(cat => (
                  <option key={cat} value={cat}>{getCategoryDisplay(cat)}</option>
                ))
              ) : (
                <option value="ทั่วไป">ทั่วไป</option>
              )}
            </select>
          </div>
        </div>

        {/* 4. หัวข้อข้อบกพร่อง */}
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
            placeholder="เช่น อุณหภูมิตู้แช่เย็นไม่ได้มาตรฐาน, ป้ายราคาสินค้าไม่ตรง..."
            className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 outline-none font-semibold text-slate-800 focus:border-[#0F6659]"
          />
        </div>

        {/* 5. รายละเอียด */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 block">
            รายละเอียดและคำแนะนำสิ่งที่สาขาต้องแก้ไข <span className="text-rose-500">*</span>
          </label>
          <textarea
            value={description}
            required
            rows={3}
            onChange={(e) => {
              setDescription(e.target.value);
              if (formError) setFormError(null);
            }}
            placeholder="ระบุสิ่งที่ควรปรับปรุงแก้ไขอย่างละเอียด..."
            className="w-full p-3 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium bg-white text-slate-800 focus:border-[#0F6659] outline-none"
          />
        </div>

        {/* 6. กำหนดส่งมอบ */}
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
            className="w-full text-xs sm:text-sm p-2.5 rounded-xl bg-white border border-slate-200 outline-none font-bold text-slate-800 focus:border-[#0F6659]"
          />
        </div>

        {/* 7. รูปถ่าย Defect ก่อนแก้ไข */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Camera size={14} className="text-slate-500" />
              <span>แนบรูปถ่ายปัญหาตอนตรวจพบ (Audit Finding Photo - ถ้ามี)</span>
            </label>
            {photos.length > 0 && (
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                {photos.length} รูป
              </span>
            )}
          </div>

          <input type="file" accept="image/jpeg,image/png,image/webp" multiple ref={fileInputRef} onChange={handleFileChange} className="hidden" />

          {photos.length > 0 ? (
            <div className="grid grid-cols-4 gap-2">
              {photos.map((img, idx) => (
                <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200">
                  <img src={img} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotos(prev => prev.filter((_, i) => i !== idx))}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center text-xs"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-500 hover:text-[#0F6659]"
              >
                <Plus size={18} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full p-3 rounded-xl border-2 border-dashed border-slate-300 hover:border-[#0F6659] bg-slate-50 flex items-center justify-center gap-2 text-xs font-semibold text-slate-600"
            >
              <Camera size={16} className="text-[#0F6659]" />
              <span>แตะเพื่อแนบรูปถ่ายข้อบกพร่อง</span>
            </button>
          )}
        </div>
      </form>

      <div className="p-4 border-t border-slate-100 bg-white shrink-0">
        <button
          type="button"
          disabled={isSubmitting}
          onClick={handleSubmit}
          className="w-full py-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 bg-[#0F6659] hover:bg-emerald-800 text-white disabled:opacity-60"
        >
          {isSubmitting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>กำลังมอบหมายงาน...</span>
            </>
          ) : (
            <>
              <Check size={16} /> <span>มอบหมายงานแก้ไขให้สาขา</span>
            </>
          )}
        </button>
      </div>

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