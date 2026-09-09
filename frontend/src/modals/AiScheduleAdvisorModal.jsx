import React, { useState, useEffect, useMemo, useRef, useContext } from "react";
import { createPortal } from "react-dom";
import { 
  Sparkles, 
  RefreshCw, 
  X, 
  MapPin, 
  UserCheck, 
  CheckCircle2, 
  AlertTriangle 
} from "lucide-react";
import api from "../config/api";
import { DataContext } from "../context/DataContext";

export default function AiScheduleAdvisorModal({ onClose }) {
  const { currentUser } = useContext(DataContext) || {};
  const scheduleCacheKey = `qsc_ai_schedule_cache_${currentUser?.id || 'default'}`;
  const scheduleCooldownKey = `qsc_ai_cooldown_schedule_${currentUser?.id || 'default'}`;

  const getRemainingScheduleCooldown = () => {
    try {
      const expiry = parseInt(sessionStorage.getItem(scheduleCooldownKey) || "0", 10);
      const remaining = Math.ceil((expiry - Date.now()) / 1000);
      return remaining > 0 ? remaining : 0;
    } catch {
      return 0;
    }
  };

  // 🔹 Check cache immediately on mount so data renders with 0ms delay!
  const [data, setData] = useState(() => {
    try {
      const cached = sessionStorage.getItem(scheduleCacheKey);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(() => {
    try {
      const cached = sessionStorage.getItem(scheduleCacheKey);
      return !cached;
    } catch {
      return true;
    }
  });

  const [error, setError] = useState(null);
  const [aiCooldown, setAiCooldown] = useState(getRemainingScheduleCooldown);

  // 🔹 Sheet Expansion State: false = 60vh (Compact 3 branches), true = 92vh (Full Screen Details)
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // 🔹 Touch / Mouse drag refs
  const dragStartY = useRef(null);

  // Trigger slide-up animation on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMounted(true);
    }, 20);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsMounted(false);
    setTimeout(onClose, 280);
  };

  // ⏳ Keep countdown alive based on real wall-clock time
  useEffect(() => {
    const updateCountdown = () => {
      const remaining = getRemainingScheduleCooldown();
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
      sessionStorage.setItem(scheduleCooldownKey, expiry.toString());
    } catch (e) {}
    setAiCooldown(seconds);
  };

  const fetchRecommendations = async (isManual = false) => {
    // 🌟 If automatic call and already cached, use cache without calling API
    if (!isManual) {
      try {
        const cached = sessionStorage.getItem(scheduleCacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.recommendations) {
            setData(parsed);
            setLoading(false);
            return;
          }
        }
      } catch (e) {}
    }

    if (isManual && (loading || getRemainingScheduleCooldown() > 0)) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/ai/schedule-recommendations");
      if (res.data) {
        setData(res.data);
        try {
          sessionStorage.setItem(scheduleCacheKey, JSON.stringify(res.data));
        } catch (e) {}
      }
      if (isManual) {
        setCooldownSeconds(15);
      }
    } catch (err) {
      console.error("Failed to load AI schedule recommendations:", err);
      if (err?.response?.status === 429) {
        setCooldownSeconds(30);
        setError(err?.response?.data?.message || "คุณเรียกใช้งาน AI ถี่เกินไป กรุณารอ 30 วินาทีก่อนลองใหม่");
      } else {
        setError("ไม่สามารถโหลดคำแนะนำจาก AI ได้ กรุณาลองใหม่อีกครั้ง");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!data) {
      fetchRecommendations(false);
    }
  }, []);

  // Escape key listener & body scroll lock
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (e) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // ── GESTURE HANDLERS (Drag UP to Expand, Drag DOWN to Close/Collapse) ──
  const handleTouchStart = (e) => {
    dragStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e) => {
    if (dragStartY.current === null) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - dragStartY.current;

    // ⬆️ Dragging UP (> 35px) -> Expand to Full Screen
    if (deltaY < -35 && !isExpanded) {
      setIsExpanded(true);
      dragStartY.current = null;
    } 
    // ⬇️ Dragging DOWN (> 45px)
    else if (deltaY > 45) {
      if (isExpanded) {
        // If full screen, collapse back to 60%
        setIsExpanded(false);
      } else {
        // If at 60%, pull down closes the modal!
        handleClose();
      }
      dragStartY.current = null;
    }
  };

  const handleTouchEnd = () => {
    dragStartY.current = null;
  };

  // Mouse drag support for desktop
  const handleMouseDown = (e) => {
    dragStartY.current = e.clientY;
  };

  const handleMouseMove = (e) => {
    if (dragStartY.current === null) return;
    const deltaY = e.clientY - dragStartY.current;
    if (deltaY < -35 && !isExpanded) {
      setIsExpanded(true);
      dragStartY.current = null;
    } else if (deltaY > 45) {
      if (isExpanded) {
        setIsExpanded(false);
      } else {
        handleClose();
      }
      dragStartY.current = null;
    }
  };

  const handleMouseUp = () => {
    dragStartY.current = null;
  };

  // Clean Reason text
  const cleanReason = (rawReason) => {
    if (!rawReason) return "ครบกำหนดรอบตรวจประจำเดือนตามเกณฑ์มาตรฐาน QSC";
    let text = rawReason.trim();
    text = text.replace(/^[^:：]+[:：]\s*/, '').trim();
    text = text.replace(/999\s*วัน/g, "ยังไม่มีประวัติตรวจ");
    return text || rawReason;
  };

  // Top 3 Recommended Branches
  const topBranches = useMemo(() => {
    if (!data?.recommendations) return [];
    return data.recommendations.slice(0, 3);
  }, [data]);

  const content = (
    <div 
      className={`fixed inset-0 z-[9999] bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden transition-opacity duration-300 ease-out ${
        isMounted ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      onClick={handleClose}
    >
      <div 
        className={`w-full max-w-lg bg-white rounded-t-[32px] sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col transform-gpu transition-all duration-350 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isMounted ? "translate-y-0" : "translate-y-full"
        } ${
          isExpanded ? "h-[92vh] sm:h-[90vh]" : "h-[60vh] sm:h-[60vh]"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── DRAG HANDLE BAR (ลากขึ้นเพื่อขยายเต็มจอ / ลากลงเพื่อปิด) ── */}
        <div 
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onClick={() => setIsExpanded(prev => !prev)}
          className="pt-3 pb-1 flex items-center justify-center cursor-pointer hover:bg-slate-50/80 transition-colors shrink-0 select-none"
          title={isExpanded ? "ดึงลงเพื่อย่อหรือปิด" : "ดึงขึ้นเพื่อดูเต็มหน้าจอ"}
        >
          <div className="w-10 h-1.5 bg-slate-300 hover:bg-[#0F6659] rounded-full transition-colors" />
        </div>

        {/* ── HEADER ── */}
        <div 
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className="px-5 py-3 flex items-center justify-between shrink-0 border-b border-slate-100 select-none cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#0F6659] text-white flex items-center justify-center shadow-xs shrink-0">
              <Sparkles size={20} className="text-emerald-200" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-800 leading-tight">
                คำแนะนำจาก AI
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {isExpanded ? "วิเคราะห์ความเสี่ยงและแนะนำผู้ตรวจเชิงลึก" : "ช่วยจัดลำดับสาขาที่ควรตรวจ 3 อันดับแรก"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Refresh Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fetchRecommendations(true);
              }}
              disabled={loading || aiCooldown > 0}
              className={`w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center transition-all ${
                loading || aiCooldown > 0
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 shadow-2xs cursor-pointer'
              }`}
              title={aiCooldown > 0 ? `รอคูลดาวน์ ${aiCooldown}s` : "วิเคราะห์ใหม่"}
            >
              <RefreshCw size={14} className={loading ? "animate-spin text-[#0F6659]" : ""} />
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleClose();
              }}
              className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 shadow-2xs transition-all cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* ── SCROLLABLE BODY ── */}
        <div 
          className="p-5 overflow-y-auto flex-1 overscroll-contain custom-tab-scrollbar space-y-3"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-center">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-[#0F6659] flex items-center justify-center animate-bounce">
                <Sparkles size={20} />
              </div>
              <p className="text-xs font-bold text-slate-700">กำลังวิเคราะห์ข้อมูลสาขา...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center justify-between">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => fetchRecommendations(true)}
                className="px-3 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 cursor-pointer"
              >
                ลองใหม่
              </button>
            </div>
          ) : (
            <>
              {topBranches.map((b, idx) => (
                <div 
                  key={b.locationId}
                  className="p-4 sm:p-4.5 rounded-2xl border border-slate-200/90 bg-white space-y-2.5 shadow-2xs hover:border-slate-300 transition-all"
                >
                  {/* แถวบน: ลำดับ + ชื่อสาขา + Badge เร่งด่วน */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-emerald-100 text-[#0F6659] font-black text-xs flex items-center justify-center shrink-0">
                        {idx + 1}
                      </div>
                      <h4 className="text-sm sm:text-base font-extrabold text-slate-800 leading-snug">
                        {b.locationName}
                      </h4>
                    </div>
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full border bg-rose-50 text-rose-600 border-rose-100 shrink-0">
                      {b.priorityLevel === "CRITICAL" ? "ความเสี่ยงวิกฤต" : "ควรตรวจด่วน"}
                    </span>
                  </div>

                  {/* แบรนด์ และ พิกัดภูมิภาค */}
                  <div className="pl-9.5 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      {b.brandName && (
                        <span className="inline-block text-[11px] font-bold text-[#0F6659] bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
                          {b.brandName}
                        </span>
                      )}
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                        <MapPin size={11} className="text-slate-400 shrink-0" />
                        <span>{b.region || "กรุงเทพฯ และปริมณฑล"}</span>
                      </div>
                    </div>

                    {/* 🌟 แสดงรายละเอียดเพิ่มเติมเมื่อดึงเต็มจอ (isExpanded === true) 🌟 */}
                    {isExpanded && (
                      <div className="pt-2 space-y-2.5 border-t border-slate-100 animate-in fade-in duration-200">
                        {/* ประวัติการตรวจ และ CAP ค้าง */}
                        <div className="flex items-center gap-2 text-[11px] text-slate-600 font-medium flex-wrap">
                          <span>รอบล่าสุด: <b className="text-slate-800 font-bold">{b.lastScore != null ? `${b.lastScore}%` : "ยังไม่เคยตรวจ"}</b></span>
                          <span>•</span>
                          {b.hasAuditedThisMonth ? (
                            <span className="text-emerald-700 font-semibold flex items-center gap-0.5">
                              <CheckCircle2 size={11} /> ตรวจรอบเดือนนี้แล้ว
                            </span>
                          ) : (
                            <span className="text-rose-600 font-semibold flex items-center gap-0.5">
                              <AlertTriangle size={11} /> ยังไม่ได้ตรวจในรอบเดือนนี้
                            </span>
                          )}
                          {b.pendingCapCount > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-amber-600 font-bold">CAP ค้าง {b.pendingCapCount} รายการ</span>
                            </>
                          )}
                        </div>

                        {/* กล่องเหตุผลจาก AI */}
                        <div className="p-3 rounded-xl bg-emerald-50/40 border border-emerald-100/70 text-xs space-y-1">
                          <div className="font-bold text-[#0F6659] flex items-center gap-1 text-[11px]">
                            <Sparkles size={12} className="text-[#0F6659]" />
                            <span>เหตุผลจาก AI</span>
                          </div>
                          <p className="text-slate-700 leading-relaxed font-medium">
                            {cleanReason(b.reason)}
                          </p>
                        </div>

                        {/* กล่องแนะนำผู้ตรวจ */}
                        {b.suggestedAuditorName && (
                          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs space-y-1">
                            <div className="font-bold text-slate-800 flex items-center gap-1.5 text-[11px]">
                              <UserCheck size={13} className="text-[#0F6659]" />
                              <span>ผู้ตรวจที่แนะนำ: <span className="text-[#0F6659] font-extrabold">{b.suggestedAuditorName}</span></span>
                            </div>
                            {b.auditorReason && (
                              <p className="text-[11px] text-slate-500 leading-relaxed pl-4.5">
                                {b.auditorReason}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

      </div>
    </div>
  );

  if (typeof document !== "undefined") {
    return createPortal(content, document.body);
  }
  return content;
}
