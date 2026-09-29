import React, { useState, useMemo } from "react";
import { Clock, X, Check, Sparkles, Sunrise, Sun, Sunset, Moon } from "lucide-react";
import { c, sans, mono } from "../config/theme";
import ModalWrapper from "../shared/ModalWrapper";
import MobileTimePicker from "../shared/MobileTimePicker";

export default function MobileTimeRangeModal({
  currentTime = "10:00 - 12:00 น.",
  onSelectTime,
  onClose
}) {
  const parseInitialTime = (timeStr) => {
    try {
      const match = (timeStr || "").match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
      if (match) {
        return { start: match[1].padStart(5, "0"), end: match[2].padStart(5, "0") };
      }
      const single = (timeStr || "").match(/(\d{1,2}:\d{2})/);
      if (single) {
        return { start: single[1].padStart(5, "0"), end: "12:00" };
      }
    } catch (e) {}
    return { start: "10:00", end: "12:00" };
  };

  const initial = useMemo(() => parseInitialTime(currentTime), [currentTime]);

  const [activeTab, setActiveTab] = useState("start"); // "start" | "end"
  const [startTime, setStartTime] = useState(initial.start);
  const [endTime, setEndTime] = useState(initial.end);

  const presets = [
    { label: "ช่วงสาย", range: "09:00 - 11:00 น.", s: "09:00", e: "11:00", icon: Sunrise },
    { label: "ก่อนเที่ยง (Peak)", range: "10:00 - 12:00 น.", s: "10:00", e: "12:00", icon: Sun },
    { label: "รอบบ่าย", range: "13:00 - 15:00 น.", s: "13:00", e: "15:00", icon: Sun },
    { label: "บ่ายแก่", range: "14:00 - 16:00 น.", s: "14:00", e: "16:00", icon: Sun },
    { label: "รอบเย็น", range: "16:00 - 18:00 น.", s: "16:00", e: "18:00", icon: Sunset },
    { label: "รอบค่ำ", range: "18:00 - 20:00 น.", s: "18:00", e: "20:00", icon: Moon },
  ];

  // Calculate Duration
  const durationText = useMemo(() => {
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    let diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff < 0) diff += 24 * 60;
    const hrs = Math.floor(diff / 60);
    const mins = diff % 60;
    if (mins === 0) return `${hrs} ชั่วโมง`;
    return `${hrs} ชม. ${mins} นาที`;
  }, [startTime, endTime]);

  const formattedResult = `${startTime} - ${endTime} น.`;

  const handleStartChange = (val) => {
    setStartTime(val);
    // Auto adjust end time if start is after end
    const [sh, sm] = val.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    if (sh * 60 + sm >= eh * 60 + em) {
      const newEndH = String(Math.min(23, sh + 2)).padStart(2, "0");
      setEndTime(`${newEndH}:${String(sm).padStart(2, "0")}`);
    }
  };

  const handleApplyPreset = (p) => {
    setStartTime(p.s);
    setEndTime(p.e);
  };

  const handleConfirm = () => {
    onSelectTime(formattedResult);
    onClose();
  };

  return (
    <ModalWrapper onClose={onClose} maxWidth="max-w-md">
      <div className="flex flex-col max-h-[85dvh] bg-white rounded-3xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b flex items-center justify-between shrink-0" style={{ borderColor: c.border, background: "#FAF9F5" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#0F6659] to-[#15806e] text-white flex items-center justify-center font-black shadow-md shrink-0">
              <Clock size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 leading-snug">เลือกช่วงเวลาตรวจ</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                เลื่อนวงล้อหมุนเวลา (Drum Wheel) เหมือนบนมือถือ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-200 active:scale-90 cursor-pointer transition-all text-slate-400 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto overscroll-contain space-y-4 max-h-[68dvh]">
          {/* Step 1 & Step 2 Switcher */}
          <div className="grid grid-cols-2 gap-2.5 p-1 bg-slate-100/90 rounded-2xl border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab("start")}
              className={`p-3 rounded-xl text-left cursor-pointer transition-all flex items-center justify-between ${
                activeTab === "start"
                  ? "bg-white shadow-sm border border-emerald-500 ring-2 ring-emerald-500/20 text-[#0F6659]"
                  : "hover:bg-white/50 text-slate-600"
              }`}
            >
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">1. เวลาเริ่มตรวจ</span>
                <div className="text-lg font-black font-mono text-slate-900 mt-0.5">{startTime} น.</div>
              </div>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                activeTab === "start" ? "bg-[#0F6659] text-white" : "bg-slate-200 text-slate-400"
              }`}>
                1
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("end")}
              className={`p-3 rounded-xl text-left cursor-pointer transition-all flex items-center justify-between ${
                activeTab === "end"
                  ? "bg-white shadow-sm border border-emerald-500 ring-2 ring-emerald-500/20 text-[#0F6659]"
                  : "hover:bg-white/50 text-slate-600"
              }`}
            >
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">2. เวลาสิ้นสุด</span>
                <div className="text-lg font-black font-mono text-slate-900 mt-0.5">{endTime} น.</div>
              </div>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                activeTab === "end" ? "bg-[#0F6659] text-white" : "bg-slate-200 text-slate-400"
              }`}>
                2
              </div>
            </button>
          </div>

          {/* Time Summary Banner */}
          <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs">
            <span className="font-bold text-[#0F6659]">
              ช่วงเวลา: <strong className="font-mono text-emerald-950">{formattedResult}</strong>
            </span>
            <span className="font-black px-2.5 py-0.5 rounded-full bg-[#0F6659] text-white text-[11px]">
              ⏱️ {durationText}
            </span>
          </div>

          {/* Mobile Scroll Wheel Picker */}
          {activeTab === "start" ? (
            <MobileTimePicker
              value={startTime}
              onChange={handleStartChange}
              label="เลื่อนหมุนเวลาเริ่มต้น (Start Time)"
            />
          ) : (
            <MobileTimePicker
              value={endTime}
              onChange={setEndTime}
              label="เลื่อนหมุนเวลาสิ้นสุด (End Time)"
            />
          )}

          {/* Quick Presets */}
          <div className="space-y-2 pt-1">
            <div className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <Sparkles size={13} className="text-[#0F6659]" />
              <span>หรือเลือกช่วงเวลายอดนิยม</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {presets.map((p) => {
                const Icon = p.icon;
                const isSelected = startTime === p.s && endTime === p.e;
                return (
                  <button
                    key={p.range}
                    type="button"
                    onClick={() => handleApplyPreset(p)}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between ${
                      isSelected
                        ? "bg-emerald-50 border-emerald-500 text-emerald-950 font-bold shadow-2xs"
                        : "bg-white border-slate-200 hover:border-emerald-400 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected ? "bg-[#0F6659] text-white" : "bg-slate-100 text-slate-500"
                      }`}>
                        <Icon size={13} />
                      </div>
                      <div>
                        <div className="text-xs font-black font-mono leading-tight">{p.s}-{p.e}</div>
                        <div className="text-[10px] text-slate-400 font-medium">{p.label}</div>
                      </div>
                    </div>
                    {isSelected && <Check size={14} className="text-[#0F6659] shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-slate-50/80 flex items-center gap-3 shrink-0 border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl bg-white hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-bold border border-slate-200 cursor-pointer shadow-2xs transition-all active:scale-95"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 py-3 rounded-2xl bg-[#0F6659] hover:bg-emerald-800 text-white text-xs sm:text-sm font-black shadow-md cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-1.5"
          >
            <Check size={16} />
            <span>ตกลง ({formattedResult})</span>
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
}
