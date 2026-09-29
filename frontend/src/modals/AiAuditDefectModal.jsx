import React, { useState, useEffect } from "react";
import { Sparkles, AlertTriangle, RefreshCw, X, LayoutList, Lightbulb } from "lucide-react";
import ModalWrapper from "../shared/ModalWrapper";
import api, { AI_REQUEST_TIMEOUT_MS } from "../config/api";

export default function AiAuditDefectModal({ auditRecordId, onClose }) {
  const AUDIT_AI_CACHE_KEY = `qsc_ai_audit_cache_${auditRecordId}`;
  const AUDIT_AI_COOLDOWN_KEY = `qsc_ai_cooldown_audit_${auditRecordId}`;

  const getRemainingAuditCooldown = () => {
    try {
      const expiry = parseInt(sessionStorage.getItem(AUDIT_AI_COOLDOWN_KEY) || "0", 10);
      const remaining = Math.ceil((expiry - Date.now()) / 1000);
      return remaining > 0 ? remaining : 0;
    } catch {
      return 0;
    }
  };

  // 🔹 เช็ค cache ทันทีตอน mount ให้ข้อมูลขึ้นแบบ 0ms delay ถ้ามีอยู่แล้วและมีข้อมูลวิธีแก้ไข (action)
  const [data, setData] = useState(() => {
    try {
      const cached = sessionStorage.getItem(AUDIT_AI_CACHE_KEY);
      if (!cached) return null;
      const parsed = JSON.parse(cached);
      // ถ้าแคชเดิมยังไม่มีฟิลด์ action ให้ข้ามไปโหลดใหม่เพื่อให้ได้คำแนะนำวิธีแก้ไข
      if (parsed?.categoryGroups?.length > 0 && !parsed.categoryGroups[0]?.action) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(() => {
    try {
      const cached = sessionStorage.getItem(AUDIT_AI_CACHE_KEY);
      if (!cached) return true;
      const parsed = JSON.parse(cached);
      if (parsed?.categoryGroups?.length > 0 && !parsed.categoryGroups[0]?.action) {
        return true;
      }
      return false;
    } catch {
      return true;
    }
  });

  const [error, setError] = useState(null);
  const [aiCooldown, setAiCooldown] = useState(getRemainingAuditCooldown);

  // ⏳ นับถอยหลัง cooldown ตามเวลาจริง
  useEffect(() => {
    const updateCountdown = () => {
      const remaining = getRemainingAuditCooldown();
      setAiCooldown(remaining);
      return remaining;
    };

    updateCountdown();
    const timer = setInterval(() => {
      const remaining = updateCountdown();
      if (remaining <= 0) setAiCooldown(0);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const setCooldownSeconds = (seconds) => {
    try {
      const expiry = Date.now() + seconds * 1000;
      sessionStorage.setItem(AUDIT_AI_COOLDOWN_KEY, expiry.toString());
    } catch (e) {}
    setAiCooldown(seconds);
  };

  const fetchAuditAnalysis = async (isManual = false) => {
    // 🌟 ถ้าเรียกอัตโนมัติและมี cache ที่มี action ครบอยู่แล้ว ใช้ cache เลย ไม่ต้องยิง API
    if (!isManual) {
      try {
        const cached = sessionStorage.getItem(AUDIT_AI_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.summary && (parsed.categoryGroups?.length === 0 || parsed.categoryGroups?.every(g => g.action))) {
            setData(parsed);
            setLoading(false);
            return;
          }
        }
      } catch (e) {}
    }

    if (isManual && (loading || getRemainingAuditCooldown() > 0)) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/ai/audit-analysis/${auditRecordId}`, {
        timeout: AI_REQUEST_TIMEOUT_MS,
        params: isManual ? { forceRefresh: true } : undefined
      });
      if (res.data) {
        setData(res.data);
        try {
          sessionStorage.setItem(AUDIT_AI_CACHE_KEY, JSON.stringify(res.data));
        } catch (e) {}
      }
      if (isManual) {
        setCooldownSeconds(15); // ⏳ 15 วินาที cooldown เหมือนจุดอื่น
      }
    } catch (err) {
      console.error("Failed to load AI audit defect analysis:", err);
      if (err?.response?.status === 429) {
        setCooldownSeconds(30);
        setError(err?.response?.data?.message || "คุณเรียกใช้งาน AI ถี่เกินไป กรุณารอ 30 วินาทีก่อนลองใหม่");
      } else if (err?.response?.status === 403) {
        setError("คุณไม่มีสิทธิ์ดูข้อมูลการตรวจนี้");
      } else {
        setError("ไม่สามารถวิเคราะห์ข้อมูลด้วย AI ได้ กรุณาลองใหม่อีกครั้ง");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (auditRecordId && !data) {
      fetchAuditAnalysis(false);
    }
  }, [auditRecordId]);

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
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-800">
                  AI วิเคราะห์ข้อบกพร่อง
                </h2>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                สรุปหมวดหมู่ ข้อบกพร่อง และวิธีแก้ไข
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => fetchAuditAnalysis(true)}
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
        <div className="p-5 overflow-y-auto overscroll-contain space-y-3">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2.5 text-center">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-[#0F6659] flex items-center justify-center animate-bounce">
                <Sparkles size={20} />
              </div>
              <p className="text-xs font-bold text-slate-600">กำลังวิเคราะห์ข้อบกพร่องและวิธีแก้ไข...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center justify-between gap-2">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => fetchAuditAnalysis(true)}
                className="px-3 py-1 bg-rose-600 text-white rounded-2xl text-xs font-bold hover:bg-rose-700 cursor-pointer shrink-0"
              >
                ลองใหม่
              </button>
            </div>
          ) : (
            <>
              {/* 🌟 สรุปรวม 1 ประโยค */}
              {data?.summary && (
                <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex items-start gap-2.5">
                  <Sparkles size={16} className="text-[#0F6659] shrink-0 mt-0.5" />
                  <span className="text-xs sm:text-sm font-bold text-slate-800 leading-relaxed">{data.summary}</span>
                </div>
              )}

              {/* 🌟 หมวดหมู่ข้อบกพร่อง และวิธีแก้ไขที่แนะนำ */}
              {data?.categoryGroups && data.categoryGroups.length > 0 && (
                <div className="rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden shadow-2xs">
                  {data.categoryGroups.map((g, i) => (
                    <div key={i} className="p-3.5 bg-white space-y-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <LayoutList size={15} className="text-slate-400 shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-extrabold text-slate-800 break-words leading-snug">{g.category}</div>
                            {g.note && (
                              <div className="text-[11px] text-slate-500 font-medium break-words leading-relaxed mt-0.5">
                                {g.note}
                              </div>
                            )}
                          </div>
                        </div>
                        <span className="shrink-0 text-[11px] font-black px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 mt-0.5">
                          ตก {g.count} ข้อ
                        </span>
                      </div>

                      {/* 💡 วิธีแก้ไขที่แนะนำจาก AI */}
                      {g.action && (
                        <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200/70 flex items-start gap-2">
                          <Lightbulb size={14} className="text-[#0F6659] shrink-0 mt-0.5" />
                          <div className="text-xs text-slate-700 leading-relaxed font-medium break-words min-w-0 flex-1">
                            <span className="font-extrabold text-[#0F6659]">วิธีแก้ไข: </span>
                            {g.action}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* 🌟 จุดที่ควรแก้ก่อน */}
              {data?.priorityFocus && (
                <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 flex items-start gap-2.5">
                  <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs sm:text-sm font-bold text-amber-950 leading-relaxed min-w-0 flex-1 break-words">
                    <span className="font-extrabold text-amber-900">เร่งด่วนที่สุด: </span>
                    {data.priorityFocus}
                  </div>
                </div>
              )}

              {data?.disclaimer && (
                <p className="text-[10px] text-slate-400 text-center pt-1">{data.disclaimer}</p>
              )}
            </>
          )}
        </div>
      </div>
    </ModalWrapper>
  );
}