import React, { useState, useEffect, useRef } from "react";
import { X, PenTool, Edit3, Loader2, RotateCcw, CheckCircle2 } from "lucide-react";
import { getFullImageUrl } from "../config/api";
import { lockBodyScroll, unlockBodyScroll } from "../utils/scrollLock";

// ✍️ Digital Signature Pad Modal (High-DPI Touch & Mouse)
export default function SignaturePadModal({ title, initialSignatureUrl, onDone, onCancel }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(Boolean(initialSignatureUrl));
  const [isLoadingOldSignature, setIsLoadingOldSignature] = useState(Boolean(initialSignatureUrl));
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    lockBodyScroll();
    return () => {
      unlockBodyScroll();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = "#0F6659";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // 🎨 Load existing / old signature onto canvas if present
    if (initialSignatureUrl) {
      setIsLoadingOldSignature(true);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        if (!canvasRef.current) return;
        const currentCtx = canvasRef.current.getContext("2d");
        const padding = 16;
        const availableW = Math.max(10, rect.width - (padding * 2));
        const availableH = Math.max(10, rect.height - (padding * 2));
        const imgW = img.naturalWidth || img.width || 1;
        const imgH = img.naturalHeight || img.height || 1;
        const scale = Math.min(availableW / imgW, availableH / imgH, 1);
        const drawW = imgW * scale;
        const drawH = imgH * scale;
        const offsetX = (rect.width - drawW) / 2;
        const offsetY = (rect.height - drawH) / 2;
        currentCtx.drawImage(img, offsetX, offsetY, drawW, drawH);
        setHasSigned(true);
        setIsLoadingOldSignature(false);
      };
      img.onerror = () => {
        // โหลดลายเซ็นเดิมไม่ได้ = บนกรอบไม่มีลายเซ็นจริง ห้ามให้กดยืนยัน (จะได้รูปว่างไปทับของเดิม)
        setIsLoadingOldSignature(false);
        setHasSigned(false);
        setLoadError("โหลดลายเซ็นเดิมไม่ได้ กรุณาเซ็นใหม่ หรือกดยกเลิกเพื่อคงลายเซ็นเดิมไว้");
      };
      img.src = getFullImageUrl(initialSignatureUrl);
    }
  }, [initialSignatureUrl]);

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if (e.touches && e.touches[0]) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e) => {
    setIsDrawing(true);
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      ctx.lineTo(x, y);
      ctx.stroke();
      setHasSigned(true);
    }
  };

  const stopDrawing = () => {
    if (isDrawing) setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    setHasSigned(false);
    setLoadError("");
  };

  const confirmSign = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSigned) return;
    try {
      const dataUrl = canvas.toDataURL("image/png");
      onDone(dataUrl);
    } catch (e) {
      // ห้ามคืนลายเซ็นเดิมแทนแบบเงียบๆ — ผู้ใช้อาจเซ็นใหม่แล้ว ต้องแจ้งให้ทราบ
      console.warn("Canvas toDataURL failed", e);
      setLoadError("บันทึกลายเซ็นไม่สำเร็จ กรุณากด 'ล้างลายเซ็น' แล้วเซ็นใหม่ทั้งหมดอีกครั้ง");
    }
  };

  return (
    <div className="fixed inset-0 z-[100000] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white rounded-3xl p-5 space-y-3.5 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <PenTool size={16} className="text-[#0F6659]" />
            <span>{title || "เซ็นชื่อลงในกรอบ"}</span>
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center cursor-pointer text-slate-500 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <div className="relative border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50/50 overflow-hidden touch-none">
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="w-full h-52 cursor-crosshair block bg-white"
          />
          {isLoadingOldSignature && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70 pointer-events-none text-slate-500 text-xs font-semibold gap-2">
              <Loader2 size={16} className="animate-spin text-[#0F6659]" />
              <span>กำลังโหลดลายเซ็นเดิม...</span>
            </div>
          )}
          {!hasSigned && !isLoadingOldSignature && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400 text-xs font-medium gap-1.5 select-none">
              <Edit3 size={14} />
              <span>ใช้นิ้วหรือเมาส์ลากเพื่อเซ็นชื่อ</span>
            </div>
          )}
        </div>

        {loadError && (
          <p className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
            {loadError}
          </p>
        )}

        <div className="flex items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={clearCanvas}
            className="flex-1 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95"
          >
            <RotateCcw size={13} />
            <span>ล้างลายเซ็น</span>
          </button>
          <button
            type="button"
            onClick={confirmSign}
            disabled={!hasSigned || isLoadingOldSignature}
            className="flex-1 py-2.5 rounded-2xl bg-[#0F6659] hover:bg-[#0c5247] text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <CheckCircle2 size={14} />
            <span>ยืนยันลายเซ็น</span>
          </button>
        </div>
      </div>
    </div>
  );
}
