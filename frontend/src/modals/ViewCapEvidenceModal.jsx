import React, { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, CheckCheck } from "lucide-react";


import { c, sans, mono, cardStyle } from "../config/theme";
import ModalWrapper from "../shared/ModalWrapper";
import Header from "../shared/Header";
import Section from "../shared/Section";
import ScoreRing from "../shared/ScoreRing";
import HistoryList from "../shared/HistoryList";
import ErrorBoundary from "../shared/ErrorBoundary";
import { getFullImageUrl } from "../config/api";
import { lockBodyScroll, unlockBodyScroll } from "../utils/scrollLock";

export default function ViewCapEvidenceModal({ cap, onClose }) {
  const [previewPhoto, setPreviewPhoto] = useState(null);

  useEffect(() => {
    if (!previewPhoto) return;
    lockBodyScroll();
    return () => {
      unlockBodyScroll();
    };
  }, [previewPhoto]);

  const afterPhotos = useMemo(() => {
    if (!cap) return [];
    if (Array.isArray(cap.imageUrls) && cap.imageUrls.length > 0) return cap.imageUrls;
    if (Array.isArray(cap.photos) && cap.photos.length > 0) return cap.photos;
    if (Array.isArray(cap.images) && cap.images.length > 0) return cap.images;
    if (cap.photo) return [cap.photo];
    return [];
  }, [cap]);

  return (
    <>
      <ModalWrapper onClose={onClose} maxWidth="max-w-md">
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: c.border, background: "#FAF9F5" }}>
          <div className="flex items-center gap-2">
            <CheckCheck size={18} className="text-emerald-700" />
            <h3 className="text-sm font-bold text-slate-800">หลักฐานการส่งงานแก้ไข (CAP)</h3>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-200 active:scale-90 cursor-pointer transition-all">
            <X size={18} style={{ color: c.faint }} />
          </button>
        </div>

        <div className="p-4 space-y-3.5 flex-1 overflow-y-auto">
          <div className="p-3 rounded-xl bg-slate-50 border space-y-1">
            <div className="text-xs font-bold text-slate-400">ข้อคำถามที่ {cap.qNum}</div>
            <div className="text-xs font-bold text-slate-800">{cap.qText}</div>
          </div>

          <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 space-y-1">
            <div className="text-xs font-bold text-emerald-800">รายละเอียดสิ่งที่สาขาแก้ไข:</div>
            <div className="text-xs font-semibold text-emerald-950">"{cap.actionText}"</div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600">รูปถ่ายหลักฐานหลังการแก้ไข (After Photos):</span>
              {afterPhotos.length > 0 && (
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                  {afterPhotos.length} รูป
                </span>
              )}
            </div>

            {afterPhotos.length > 0 ? (
              <div className="grid grid-cols-3 gap-2 pt-1">
                {afterPhotos.map((img, idx) => {
                  const url = getFullImageUrl(img);
                  return (
                    <div
                      key={idx}
                      onClick={() => setPreviewPhoto(url)}
                      className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shadow-2xs group cursor-pointer hover:border-emerald-500 transition-all"
                    >
                      <img
                        src={url}
                        alt={`Evidence ${idx + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-md bg-black/60 text-white text-[9px] font-bold font-mono">
                        #{idx + 1}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-center">
                <span className="text-xs font-bold text-emerald-700 block">✓ ส่งมอบงานแล้ว</span>
                <span className="text-xs text-slate-500">ไม่มีรูปถ่ายแนบ</span>
              </div>
            )}
          </div>

          <div className="text-xs space-y-1 border-t pt-2" style={{ borderColor: c.border, color: c.muted }}>
            <div className="flex justify-between"><span>ผู้ส่งมอบงาน:</span><span className="font-bold text-slate-800">{cap.responsibleName}</span></div>
            <div className="flex justify-between"><span>เวลาที่ส่งมอบ:</span><span className="font-bold text-slate-800">{cap.submittedAt}</span></div>
            <div className="flex justify-between"><span>สถานะ:</span><span className="font-bold text-emerald-700">⏳ รอผู้ตรวจ Lead Auditor ตรวจสอบและอนุมัติ</span></div>
          </div>
        </div>

        <div className="p-3 border-t bg-slate-50" style={{ borderColor: c.border }}>
          <button onClick={onClose} className="w-full py-2.5 rounded-2xl bg-slate-200 hover:bg-slate-300 font-bold text-xs text-slate-700 cursor-pointer">
            ปิดหน้าต่าง
          </button>
        </div>
      </ModalWrapper>

      {/* 🔍 MODAL ขยายรูปภาพขนาดเต็ม (Lightbox) */}
      {previewPhoto && (
        <div 
          className="fixed inset-0 z-[100000] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setPreviewPhoto(null)}
        >
          <div className="relative max-w-2xl max-h-[85dvh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPreviewPhoto(null)}
              className="absolute -top-10 right-0 w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center cursor-pointer transition-all shadow-md"
              title="ปิด"
            >
              <X size={18} />
            </button>
            <img
              src={previewPhoto}
              alt="Preview"
              className="max-h-[80dvh] w-auto max-w-full rounded-2xl object-contain shadow-2xl border border-white/10"
            />
          </div>
        </div>
      )}
    </>
  );
}
