import React, { useState, useEffect } from "react";
import { Sparkles, CheckCircle2, AlertTriangle, RefreshCw, X, Save } from "lucide-react";
import ModalWrapper from "../shared/ModalWrapper";
import api from "../config/api";

export default function AiCapAdvisorModal({ taskId, onClose }) {
  const CAP_AI_CACHE_KEY = `qsc_ai_cap_cache_${taskId}`;
  const CAP_AI_COOLDOWN_KEY = `qsc_ai_cooldown_cap_${taskId}`;

  const getRemainingCapCooldown = () => {
    try {
      const expiry = parseInt(sessionStorage.getItem(CAP_AI_COOLDOWN_KEY) || "0", 10);
      const remaining = Math.ceil((expiry - Date.now()) / 1000);
      return remaining > 0 ? remaining : 0;
    } catch {
      return 0;
    }
  };

  // 🔹 Check cache immediately on mount so data renders with 0ms delay!
  const [data, setData] = useState(() => {
    try {
      const cached = sessionStorage.getItem(CAP_AI_CACHE_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(() => {
    try {
      const cached = sessionStorage.getItem(CAP_AI_CACHE_KEY);
      return !cached;
    } catch {
      return true;
    }
  });

  const [error, setError] = useState(null);
  const [aiCooldown, setAiCooldown] = useState(getRemainingCapCooldown);
  const [nextAuditNote, setNextAuditNote] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    if (data?.savedNextAuditNote) {
      setNextAuditNote(data.savedNextAuditNote);
    } else if (data?.nextAuditAdvice) {
      setNextAuditNote(data.nextAuditAdvice);
    }
  }, [data]);

  // ⏳ Keep countdown alive based on real wall-clock time
  useEffect(() => {
    const updateCountdown = () => {
      const remaining = getRemainingCapCooldown();
      setAiCooldown(remaining);
      return remaining;
    };

    updateCountdown();
    const timer = setInterval(() => {
      const remaining = updateCountdown();
      if (remaining <= 0) {
        setAiCooldown(0);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const setCooldownSeconds = (seconds) => {
    try {
      const expiry = Date.now() + seconds * 1000;
      sessionStorage.setItem(CAP_AI_COOLDOWN_KEY, expiry.toString());
    } catch (e) {}
    setAiCooldown(seconds);
  };

  const fetchCapAnalysis = async (isManual = false) => {
    // 🌟 If automatic call and already cached, use cache without calling API
    if (!isManual) {
      try {
        const cached = sessionStorage.getItem(CAP_AI_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && (parsed.issueSummary || parsed.auditorAdvice)) {
            setData(parsed);
            setLoading(false);
            return;
          }
        }
      } catch (e) {}
    }

    if (isManual && (loading || getRemainingCapCooldown() > 0)) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/ai/cap-analysis/${taskId}`);
      if (res.data) {
        setData(res.data);
        try {
          sessionStorage.setItem(CAP_AI_CACHE_KEY, JSON.stringify(res.data));
        } catch (e) {}
      }
      if (isManual) {
        setCooldownSeconds(15); // ⏳ 15 วินาที cooldown
      }
    } catch (err) {
      console.error("Failed to load AI CAP analysis:", err);
      if (err?.response?.status === 429) {
        setCooldownSeconds(30);
        setError(err?.response?.data?.message || "คุณเรียกใช้งาน AI ถี่เกินไป กรุณารอ 30 วินาทีก่อนลองใหม่");
      } else {
        setError("ไม่สามารถวิเคราะห์ข้อมูลด้วย AI ได้ กรุณาลองใหม่อีกครั้ง");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNextAuditNote = async () => {
    if (!nextAuditNote.trim()) return;
    setIsSavingNote(true);
    try {
      await api.post(`/cap/${taskId}/next-audit-note`, { note: nextAuditNote.trim() });
      setToastMessage("บันทึกคำแนะนำสำหรับรอบตรวจถัดไปเรียบร้อยแล้ว");
      setTimeout(() => setToastMessage(null), 3500);
      if (data) {
        const updated = { ...data, savedNextAuditNote: nextAuditNote.trim(), followUpStatus: "PENDING" };
        setData(updated);
        try {
          sessionStorage.setItem(CAP_AI_CACHE_KEY, JSON.stringify(updated));
        } catch (e) {}
      }
    } catch (err) {
      console.error("Save next audit note error:", err);
      setToastMessage("เกิดข้อผิดพลาดในการบันทึก กรุณาลองใหม่อีกครั้ง");
      setTimeout(() => setToastMessage(null), 3500);
    } finally {
      setIsSavingNote(false);
    }
  };

  useEffect(() => {
    if (taskId && !data) {
      fetchCapAnalysis(false);
    }
  }, [taskId]);

  return (
    <ModalWrapper onClose={onClose} maxWidth="max-w-lg">
      <div className="flex flex-col max-h-[85dvh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-50/60 to-emerald-100/60 rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#0F6659] text-white flex items-center justify-center shadow-xs">
              <Sparkles size={19} className="animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                AI ผู้ช่วยวิเคราะห์งานแก้ไข
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                วิเคราะห์รูปภาพและข้อความสนทนาในห้องแชท
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => fetchCapAnalysis(true)}
              disabled={loading || aiCooldown > 0}
              className={`px-2.5 py-1.5 text-xs font-bold rounded-2xl flex items-center gap-1 transition-all ${
                loading || aiCooldown > 0
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 shadow-2xs cursor-pointer'
              }`}
              title={aiCooldown > 0 ? `รอคูลดาวน์อีก ${aiCooldown} วินาที` : "วิเคราะห์ใหม่"}
            >
              <RefreshCw size={14} className={loading ? "animate-spin text-[#0F6659]" : ""} />
              {aiCooldown > 0 ? <span>{aiCooldown}s</span> : null}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-2xl hover:bg-white transition-all cursor-pointer"
            >
              <X size={19} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto overscroll-contain space-y-3.5">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2.5 text-center">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-[#0F6659] flex items-center justify-center animate-bounce">
                <Sparkles size={20} />
              </div>
              <p className="text-xs font-bold text-slate-600">กำลังอ่านบทสนทนาและตรวจสอบรูปถ่ายหลักฐาน...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center justify-between">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => fetchCapAnalysis(true)}
                className="px-3 py-1 bg-rose-600 text-white rounded-2xl text-xs font-bold hover:bg-rose-700 cursor-pointer"
              >
                ลองใหม่
              </button>
            </div>
          ) : (
            <>
              {/* 🌟 1. ความมั่นใจในการวิเคราะห์ของ AI */}
              {(() => {
                const confidenceScore = data?.confidencePercent || (data?.confidence ? Math.round(data.confidence * 100) : 92);
                return (
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80">
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} className="text-[#0F6659]" />
                      <span className="text-xs font-extrabold text-slate-800">ความมั่นใจในการวิเคราะห์ของ AI</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-16 sm:w-20 bg-emerald-200/60 rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-[#0F6659] h-2 rounded-full transition-all duration-700" 
                          style={{ width: `${confidenceScore}%` }}
                        />
                      </div>
                      <span className="text-xs font-black text-[#0F6659] font-mono px-2.5 py-0.5 rounded-full bg-white border border-emerald-200 shadow-2xs">
                        {confidenceScore}%
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* 🌟 2. จุดที่ดี */}
              {data?.strengthPoints && data.strengthPoints.length > 0 && (
                <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 space-y-2">
                  <h4 className="text-xs sm:text-sm font-extrabold text-emerald-900 flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span>จุดที่ดี</span>
                  </h4>
                  <ul className="space-y-1.5 pl-5 list-disc text-xs text-emerald-900 font-medium">
                    {data.strengthPoints.map((pt, i) => (
                      <li key={i} className="leading-relaxed">{pt}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 🌟 3. จุดที่ควรดูเพิ่ม */}
              {data?.areasToVerify && data.areasToVerify.length > 0 && (
                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-2">
                  <h4 className="text-xs sm:text-sm font-extrabold text-amber-950 flex items-center gap-2">
                    <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                    <span>จุดที่ควรดูเพิ่ม</span>
                  </h4>
                  <ul className="space-y-1.5 pl-5 list-disc text-xs text-amber-900 font-medium">
                    {data.areasToVerify.map((pt, i) => (
                      <li key={i} className="leading-relaxed">{pt}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 🌟 4. คำแนะนำตรวจรอบถัดไป (แสดงเมื่อมีข้อมูล) */}
              {Boolean(data?.nextAuditAdvice || data?.savedNextAuditNote || nextAuditNote) && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs sm:text-sm font-extrabold text-slate-800 flex items-center gap-2">
                      <Sparkles size={16} className="text-[#0F6659] shrink-0" />
                      <span>คำแนะนำตรวจรอบถัดไป</span>
                    </h4>
                    {data?.savedNextAuditNote && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        บันทึกแล้ว
                      </span>
                    )}
                  </div>
                  
                  {data?.nextAuditAdvice && (
                    <p className="text-xs text-slate-700 font-medium bg-white p-3 rounded-xl border border-slate-200 leading-relaxed">
                      {data.nextAuditAdvice}
                    </p>
                  )}

                  <textarea
                    rows={2}
                    value={nextAuditNote}
                    onChange={(e) => setNextAuditNote(e.target.value)}
                    placeholder="ระบุจุดที่ต้องการให้สังเกตเป็นพิเศษในรอบถัดไป..."
                    className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-white text-slate-800 font-medium outline-none focus:border-[#0F6659] focus:ring-1 focus:ring-[#0F6659] shadow-2xs resize-none leading-relaxed"
                  />

                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={handleSaveNextAuditNote}
                      disabled={isSavingNote || !nextAuditNote.trim()}
                      className="px-3.5 py-1.5 rounded-xl bg-[#0F6659] hover:bg-emerald-800 text-white text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                    >
                      <Save size={13} />
                      <span>{isSavingNote ? "กำลังบันทึก..." : "บันทึกคำแนะนำตรวจรอบถัดไป"}</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Disclaimer */}
        <div className="p-3.5 border-t border-slate-100 bg-slate-50/80 rounded-b-3xl text-center">
          <p className="text-[11px] text-slate-400 font-medium">
            💡 ข้อแนะนำนี้สร้างโดย AI เพื่อเป็นข้อมูลประกอบการพิจารณาเท่านั้น
          </p>
        </div>
      </div>

      {/* 🍃 Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[200] bg-emerald-50/95 text-emerald-950 border border-emerald-300 ring-1 ring-emerald-400/20 px-4 py-2.5 rounded-2xl shadow-lg flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </ModalWrapper>
  );
}
