import React, { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Camera, Check, Trash2, X, AlertTriangle, Wrench, ChevronDown, MapPin, Store, ChevronRight, Plus } from "lucide-react";


import { c, sans, mono, cardStyle } from "../../config/theme";
import { ROLES, NAV_BY_ROLE } from "../../config/roles";
import { TODAY, AUDIT_TYPES, AUDIT_TYPE_META, CAP_STATUS_MAP, REGION_LINES, BRAND_LINES } from "../../config/constants";
import { TopBarContext } from "../../context/TopBarContext";
import { DataContext } from "../../context/DataContext";
import { exportToExcel } from "../../utils/exportToExcel";

import ModalWrapper from "../../shared/ModalWrapper";
import Header from "../../shared/Header";
import Section from "../../shared/Section";
import ScoreRing from "../../shared/ScoreRing";
import HistoryList from "../../shared/HistoryList";
import ErrorBoundary from "../../shared/ErrorBoundary";
import { compressImageFile } from "../../utils/imageCompressor";
import LocationSelectModal from "../../modals/LocationSelectModal";

export default function NewRemediationModal({ onClose, onSubmit, locations = [], currentUser }) {
  const [selectedLocationId, setSelectedLocationId] = useState(locations[0]?.id || 1);
  const [showLocationSelectModal, setShowLocationSelectModal] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState("q1");
  const [remediationNote, setRemediationNote] = useState("");
  const [photos, setPhotos] = useState([]);
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
      // Fallback if compression fails
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

  const availableIssues = [
    { id: "q1", title: "ข้อ 1: พื้น ผนัง และโต๊ะรับประทานอาหารสะอาด ปราศจากคราบไขมัน" },
    { id: "q2", title: "ข้อ 2: พนักงานแต่งกายถูกสุขลักษณะ สวมหมวกคลุมผมและผ้ากันเปื้อน" },
    { id: "q7", title: "ข้อ 7: อุณหภูมิตู้แช่เย็นวัตถุดิบไม่เกินเกณฑ์กำหนด (≤ 4.0°C)" },
  ];

  const handleSubmit = () => {
    if (!remediationNote.trim()) {
      setFormError("กรุณากรอกรายละเอียดการแก้ไข");
      return;
    }
    if (photos.length === 0) {
      setFormError("กรุณาแนบรูปภาพหลักฐานหลังแก้ไขอย่างน้อย 1 รูป");
      return;
    }
    setFormError(null);
    onSubmit({
      id: "CAP-" + Date.now().toString().slice(-3),
      locationId: selectedLoc?.id || 1,
      title: availableIssues.find(x => x.id === selectedIssue)?.title.split(":")[1]?.trim() || "งานแก้ไขสุขอนามัย",
      unit: selectedLoc?.name || selectedLoc?.fullName || "สาขาสยาม",
      status: "submitted",
      due: "รอผู้ตรวจอนุมัติ",
      overdue: false,
      issueItem: availableIssues.find(x => x.id === selectedIssue)?.title,
      desc: remediationNote,
      photo: photos[0],
      photos: photos,
      images: photos,
      assignedTo: currentUser?.name || "ผู้จัดการสาขา",
      deadline: "24 ส.ค. 2569",
      auditScore: 76,
      timeline: [
        { 
          who: `${currentUser?.name || "ผู้จัดการสาขา"} (${selectedLoc?.name || "สาขา"})`, 
          text: remediationNote, 
          photo: photos[0],
          photos: photos,
          time: "เมื่อสักครู่",
          isMe: true
        }
      ]
    });
    onClose();
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
            <h3 className="text-sm font-bold text-slate-800">ส่งมอบงานแก้ไขใหม่ (Manual CAP)</h3>
            <p className="text-[11px] text-slate-500">สำหรับสาขาที่ต้องการส่งหลักฐานแก้ไขเพิ่มเติม</p>
          </div>
        </div>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 cursor-pointer transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Scrollable Form Body */}
      <div className="p-4 sm:p-5 space-y-4 flex-1 overflow-y-auto min-h-0 custom-tab-scrollbar">
        {formError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
            <AlertTriangle size={15} className="shrink-0 text-rose-600" />
            <span>{formError}</span>
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

        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1.5">ข้อบกพร่องที่ต้องการแก้ไข</label>
          <div className="relative">
            <select
              value={selectedIssue}
              onChange={(e) => setSelectedIssue(e.target.value)}
              className="w-full text-xs sm:text-sm pl-4 pr-10 py-3 min-h-[50px] rounded-2xl bg-slate-50 border border-slate-200 outline-none font-semibold text-slate-700 focus:border-[#0F6659] focus:bg-white transition-all shadow-xs cursor-pointer appearance-none truncate"
            >
              {availableIssues.map(issue => (
                <option key={issue.id} value={issue.id}>{issue.title}</option>
              ))}
            </select>
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <ChevronDown size={18} />
            </div>
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1.5">รายละเอียดการดำเนินการแก้ไข</label>
          <textarea
            value={remediationNote}
            onChange={(e) => {
              setRemediationNote(e.target.value);
              if (formError) setFormError(null);
            }}
            placeholder="อธิบายสิ่งที่สาขาได้ดำเนินการปรับปรุงแก้ไข..."
            rows={3}
            className="w-full p-3 rounded-2xl border border-slate-200 text-xs sm:text-sm font-medium bg-white text-slate-800 placeholder-slate-400 focus:border-[#0F6659] outline-none shadow-2xs"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <span>รูปภาพหลักฐานหลังแก้ไข</span>
              <span className="text-red-500">*</span>
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
                      alt={`Evidence ${idx + 1}`}
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
                <span>เลือกเพิ่มได้หลายรูปพร้อมกัน</span>
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
              className="w-full p-4 sm:p-5 rounded-2xl border-2 border-dashed border-slate-300 hover:border-[#0F6659] bg-slate-50 hover:bg-emerald-50/40 flex flex-col items-center justify-center gap-2 text-slate-600 transition-all cursor-pointer group"
            >
              <div className="w-11 h-11 rounded-2xl bg-white border border-slate-200 flex items-center justify-center group-hover:border-emerald-300 group-hover:scale-105 transition-all shadow-2xs">
                <Camera size={22} className="text-slate-400 group-hover:text-[#0F6659]" />
              </div>
              <div className="text-center">
                <div className="text-xs sm:text-sm font-bold text-slate-700 group-hover:text-[#0F6659] transition-colors">
                  แตะเพื่อถ่ายรูปหรือเลือกรูปหลักฐาน (เลือกได้หลายรูป)
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  รองรับไฟล์ภาพ JPG, PNG พร้อมบีบอัดให้อัตโนมัติ
                </div>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Pinned Bottom Action Footer */}
      <div className="p-4 border-t border-slate-100 bg-white shrink-0">
        <button
          type="button"
          onClick={handleSubmit}
          className="w-full py-3.5 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md bg-[#0F6659] hover:bg-emerald-800 text-white transition-all active:scale-[0.99]"
        >
          <Check size={16} /> <span>ส่งรายงานและหลักฐานการแก้งาน</span>
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
