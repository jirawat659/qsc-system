import React, { useState, useEffect } from "react";
import {
  Sparkles, CheckCircle2, AlertTriangle, HelpCircle,
  RefreshCw, X, ShieldAlert, FileText, Camera, MessageSquare
} from "lucide-react";
import ModalWrapper from "../shared/ModalWrapper";
import api from "../config/api";

export default function AiCapAdvisorModal({ taskId, onClose }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const fetchCapAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/ai/cap-analysis/${taskId}`);
      setData(res.data);
    } catch (err) {
      console.error("Failed to load AI CAP analysis:", err);
      setError("ไม่สามารถวิเคราะห์ข้อมูลด้วย AI ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (taskId) {
      fetchCapAnalysis();
    }
  }, [taskId]);

  const getReadinessBadge = (status) => {
    switch (status) {
      case "READY_TO_REVIEW":
        return {
          label: "หลักฐานพร้อมรับการพิจารณา",
          className: "bg-emerald-100 text-emerald-800 border-emerald-200"
        };
      case "REJECT_SUGGESTED":
        return {
          label: "หลักฐานยังไม่ตรงเกณฑ์",
          className: "bg-rose-100 text-rose-800 border-rose-200"
        };
      default:
        return {
          label: "รอหลักฐาน/การตอบกลับเพิ่มเติม",
          className: "bg-amber-100 text-amber-800 border-amber-200"
        };
    }
  };

  return (
    <ModalWrapper onClose={onClose} maxWidth="max-w-xl">
      <div className="flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-teal-50/80 to-sky-50/80 rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#0F6659] text-white flex items-center justify-center shadow-md shadow-[#0F6659]/20">
              <Sparkles size={20} className="animate-pulse" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
                AI วิเคราะห์งานแก้ไข & บทสนทนา
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                ประมวลผลข้อบกพร่อง รูปภาพ และแชทเพื่อช่วยผู้ตรวจพิจารณา
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={fetchCapAnalysis}
              disabled={loading}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-white/80 transition-all cursor-pointer disabled:opacity-50"
              title="วิเคราะห์ใหม่"
            >
              <RefreshCw size={18} className={loading ? "animate-spin text-[#0F6659]" : ""} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-white/80 transition-all cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
              <div className="w-12 h-12 rounded-2xl bg-teal-50 text-[#0F6659] flex items-center justify-center animate-bounce">
                <Sparkles size={24} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700">กำลังอ่านบทสนทนาและรูปภาพในห้องแชท...</p>
                <p className="text-xs text-slate-400 mt-0.5">AI กำลังประเมินความสอดคล้องของหลักฐาน</p>
              </div>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm font-medium flex items-center justify-between">
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
              {/* Readiness Banner */}
              {data && (
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <span className="text-xs font-bold text-slate-700">สถานะความพร้อมของหลักฐาน:</span>
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${getReadinessBadge(data.readinessToClose).className}`}>
                    {getReadinessBadge(data.readinessToClose).label}
                  </span>
                </div>
              )}

              {/* Auditor Advice Box */}
              {data?.auditorAdvice && (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-900 to-teal-900 text-white shadow-md">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">🎯</span>
                    <div>
                      <p className="text-xs font-bold text-emerald-300 mb-1">คำแนะนำสำหรับผู้ตรวจประเมิน</p>
                      <p className="text-xs sm:text-sm leading-relaxed text-slate-100 font-medium">
                        {data.auditorAdvice}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Progress & Summary */}
              {data?.progressStatus && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700">
                  <span className="font-bold text-slate-800">ความคืบหน้าจากแชท: </span>
                  <span>{data.progressStatus}</span>
                </div>
              )}

              {/* Strengths */}
              {data?.strengthPoints && data.strengthPoints.length > 0 && (
                <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/70 space-y-2">
                  <h4 className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                    <CheckCircle2 size={16} className="text-emerald-600" />
                    จุดที่สาขาแก้ไขได้ตรงประเด็น
                  </h4>
                  <ul className="space-y-1.5 pl-6 list-disc text-xs text-emerald-800">
                    {data.strengthPoints.map((pt, i) => (
                      <li key={i} className="leading-relaxed">{pt}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Areas to Verify */}
              {data?.areasToVerify && data.areasToVerify.length > 0 && (
                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/70 space-y-2">
                  <h4 className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <AlertTriangle size={16} className="text-amber-600" />
                    จุดที่ควรตรวจสอบหรือขอหลักฐานเพิ่ม
                  </h4>
                  <ul className="space-y-1.5 pl-6 list-disc text-xs text-amber-800">
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
        <div className="p-4 border-t border-slate-100 bg-slate-50/80 rounded-b-3xl text-center">
          <p className="text-[11px] text-slate-500">
            💡 คำแนะนำนี้ประมวลผลโดย AI เพื่อช่วยผู้ประเมินประกอบการพิจารณา ผู้ตรวจยังคงเป็นผู้ตัดสินใจขั้นสุดท้าย
          </p>
        </div>
      </div>
    </ModalWrapper>
  );
}
