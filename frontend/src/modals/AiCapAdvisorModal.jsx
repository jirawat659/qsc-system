import React, { useState, useEffect } from "react";
import {
  Sparkles, CheckCircle2, AlertTriangle,
  RefreshCw, X, ShieldAlert, Camera, MessageSquare
} from "lucide-react";
import ModalWrapper from "../shared/ModalWrapper";
import api from "../config/api";

export default function AiCapAdvisorModal({ taskId, onClose }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [aiCooldown, setAiCooldown] = useState(0);

  useEffect(() => {
    if (aiCooldown > 0) {
      const timer = setInterval(() => {
        setAiCooldown(prev => (prev > 1 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [aiCooldown]);

  const fetchCapAnalysis = async (isManual = false) => {
    if (loading || (isManual && aiCooldown > 0)) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/ai/cap-analysis/${taskId}`);
      setData(res.data);
      if (isManual) {
        setAiCooldown(15); // ⏳ 15 วินาที cooldown
      }
    } catch (err) {
      console.error("Failed to load AI CAP analysis:", err);
      if (err?.response?.status === 429) {
        setError(err?.response?.data?.message || "คุณเรียกใช้งาน AI ถี่เกินไป กรุณารอ 1 นาทีก่อนลองใหม่");
      } else {
        setError("ไม่สามารถวิเคราะห์ข้อมูลด้วย AI ได้ กรุณาลองใหม่อีกครั้ง");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (taskId) {
      fetchCapAnalysis(false);
    }
  }, [taskId]);

  const getReadinessBadge = (status) => {
    switch (status) {
      case "READY_TO_REVIEW":
        return {
          label: "หลักฐานพร้อมรับการพิจารณา",
          className: "bg-emerald-50 text-emerald-700 border-emerald-200"
        };
      case "REJECT_SUGGESTED":
        return {
          label: "หลักฐานยังไม่ตรงเกณฑ์",
          className: "bg-rose-50 text-rose-700 border-rose-200"
        };
      default:
        return {
          label: "รอหลักฐานเพิ่มเติม",
          className: "bg-amber-50 text-amber-700 border-amber-200"
        };
    }
  };

  return (
    <ModalWrapper onClose={onClose} maxWidth="max-w-lg">
      <div className="flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-teal-50/60 to-emerald-50/60 rounded-t-3xl">
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
              className={`px-2.5 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1 transition-all ${
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
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-white transition-all cursor-pointer"
            >
              <X size={19} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-3.5">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2.5 text-center">
              <div className="w-10 h-10 rounded-2xl bg-teal-50 text-[#0F6659] flex items-center justify-center animate-bounce">
                <Sparkles size={20} />
              </div>
              <p className="text-xs font-bold text-slate-600">กำลังอ่านบทสนทนาและตรวจสอบรูปถ่ายหลักฐาน...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center justify-between">
              <span>{error}</span>
              <button
                type="button"
                onClick={fetchCapAnalysis}
                className="px-3 py-1 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 cursor-pointer"
              >
                ลองใหม่
              </button>
            </div>
          ) : (
            <>
              {/* Readiness Status Banner */}
              {data && (
                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <span className="text-xs font-bold text-slate-700">สถานะความพร้อม:</span>
                  <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${getReadinessBadge(data.readinessToClose).className}`}>
                    {getReadinessBadge(data.readinessToClose).label}
                  </span>
                </div>
              )}

              {/* Auditor Advice Box */}
              {data?.auditorAdvice && (
                <div className="p-4 rounded-2xl bg-[#0F6659] text-white shadow-2xs">
                  <div className="flex items-start gap-2.5">
                    <Sparkles size={16} className="text-emerald-300 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-emerald-200 mb-1">คำแนะนำสำหรับผู้ตรวจประเมิน</p>
                      <p className="text-xs sm:text-sm leading-relaxed text-slate-100 font-medium">
                        {data.auditorAdvice}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Strengths */}
              {data?.strengthPoints && data.strengthPoints.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200/70 space-y-1.5">
                  <h4 className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                    <CheckCircle2 size={15} className="text-emerald-600" />
                    จุดที่สาขาแก้ไขได้ตรงประเด็น
                  </h4>
                  <ul className="space-y-1 pl-5 list-disc text-xs text-emerald-800">
                    {data.strengthPoints.map((pt, i) => (
                      <li key={i} className="leading-relaxed">{pt}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Areas to Verify */}
              {data?.areasToVerify && data.areasToVerify.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/70 space-y-1.5">
                  <h4 className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <AlertTriangle size={15} className="text-amber-600" />
                    จุดที่ควรสังเกตเพิ่มเติม
                  </h4>
                  <ul className="space-y-1 pl-5 list-disc text-xs text-amber-800">
                    {data.areasToVerify.map((pt, i) => (
                      <li key={i} className="leading-relaxed">{pt}</li>
                    ))}
                  </ul>
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
    </ModalWrapper>
  );
}
