import React, { useState, useEffect } from "react";
import {
  Sparkles, Calendar, AlertTriangle, CheckCircle2,
  Clock, Store, ArrowRight, RefreshCw, X, ShieldAlert,
  ChevronRight, MapPin, Award
} from "lucide-react";
import ModalWrapper from "../shared/ModalWrapper";
import api from "../config/api";

export default function AiScheduleAdvisorModal({ onClose, onSelectBranchForSchedule }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const fetchRecommendations = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/ai/schedule-recommendations");
      setData(res.data);
    } catch (err) {
      console.error("Failed to load AI schedule recommendations:", err);
      setError("ไม่สามารถโหลดคำแนะนำจาก AI ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const getPriorityBadge = (lvl) => {
    switch (lvl) {
      case "CRITICAL":
        return {
          label: "ความเสี่ยงวิกฤต",
          className: "bg-rose-100 text-rose-800 border-rose-200"
        };
      case "HIGH":
        return {
          label: "ความสำคัญสูง",
          className: "bg-amber-100 text-amber-800 border-amber-200"
        };
      default:
        return {
          label: "ตามรอบมาตรฐาน",
          className: "bg-emerald-100 text-emerald-800 border-emerald-200"
        };
    }
  };

  return (
    <ModalWrapper onClose={onClose} maxWidth="max-w-2xl">
      <div className="flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-50/80 to-teal-50/80 rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
              <Sparkles size={20} className="animate-pulse" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
                AI แนะนำแผนการลงตรวจสาขา
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {data?.generatedBy || "AI Engine"}
                </span>
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                วิเคราะห์ความเสี่ยงและรอบการตรวจอย่างน้อย 1 ครั้ง/เดือน
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={fetchRecommendations}
              disabled={loading}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-white/80 transition-all cursor-pointer disabled:opacity-50"
              title="วิเคราะห์ใหม่"
            >
              <RefreshCw size={18} className={loading ? "animate-spin text-emerald-600" : ""} />
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
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center animate-bounce">
                <Sparkles size={24} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700">กำลังประมวลผลประวัติการตรวจ...</p>
                <p className="text-xs text-slate-400 mt-0.5">AI กำลังคัดกรองสาขาที่มีความเสี่ยงสูงและยังไม่ได้รับการตรวจ</p>
              </div>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm font-medium flex items-center justify-between">
              <span>{error}</span>
              <button
                type="button"
                onClick={fetchRecommendations}
                className="px-3 py-1 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 cursor-pointer"
              >
                ลองใหม่
              </button>
            </div>
          ) : (
            <>
              {/* Summary Banner */}
              {data?.summary && (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-md">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">✨</span>
                    <div>
                      <p className="text-xs font-bold text-emerald-400 mb-1">บทวิเคราะห์ภาพรวมประจำเดือน</p>
                      <p className="text-xs sm:text-sm leading-relaxed text-slate-200 font-medium">
                        {data.summary}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Recommendations List */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    5 สาขาที่ AI แนะนำให้เข้าตรวจเร่งด่วน
                  </h3>
                  <span className="text-[11px] text-slate-400 font-medium">
                    ค้างตรวจเดือนนี้: {data?.totalBranchesPendingMonthlyAudit || 0} สาขา
                  </span>
                </div>

                {(data?.recommendations || []).map((b, idx) => {
                  const badge = getPriorityBadge(b.priorityLevel);
                  return (
                    <div
                      key={b.locationId}
                      className="p-4 sm:p-5 rounded-2xl border border-slate-200/80 bg-white hover:border-emerald-300 hover:shadow-sm transition-all flex flex-col gap-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 font-bold text-sm flex items-center justify-center shrink-0 border border-slate-200">
                            #{idx + 1}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-bold text-slate-800">{b.locationName}</h4>
                              <span className="text-[11px] font-semibold text-slate-500">({b.brandName})</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.className}`}>
                                {badge.label}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                              <MapPin size={12} /> {b.region || "ไม่ระบุภูมิภาค"}
                            </p>
                          </div>
                        </div>

                        {/* Last Score Badge */}
                        <div className="text-right shrink-0">
                          <div className="text-xs font-bold text-slate-700">
                            รอบล่าสุด: {b.lastScore != null ? `${b.lastScore}%` : "ยังไม่เคยตรวจ"}
                          </div>
                          <p className="text-[10px] text-slate-400">
                            {b.daysSinceLastAudit < 999 ? `${b.daysSinceLastAudit} วันที่แล้ว` : "สาขาใหม่"}
                          </p>
                        </div>
                      </div>

                      {/* AI Reasoning */}
                      <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-100 text-xs text-slate-700 space-y-1">
                        <p className="font-semibold text-slate-800 flex items-center gap-1">
                          <span className="text-emerald-600 font-bold">เหตุผลวิเคราะห์:</span> {b.reason}
                        </p>
                        {b.suggestedFocus && (
                          <p className="text-[11px] text-slate-500">
                            <span className="font-semibold text-slate-600">จุดที่ควรเน้นตรวจ:</span> {b.suggestedFocus}
                          </p>
                        )}
                      </div>

                      {/* Action Button */}
                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (onSelectBranchForSchedule) {
                              onSelectBranchForSchedule(b);
                            }
                            onClose();
                          }}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs hover:shadow-md active:scale-98 cursor-pointer flex items-center gap-1.5"
                        >
                          <Calendar size={14} />
                          <span>กำหนดการตรวจสาขานี้</span>
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer Disclaimer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/80 rounded-b-3xl text-center">
          <p className="text-[11px] text-slate-500">
            💡 คำแนะนำนี้ประมวลผลโดย AI เพื่อช่วยวางแผนการลงตรวจ ผู้ตรวจและหัวหน้างานเป็นผู้ตัดสินใจจัดตารางจริง
          </p>
        </div>
      </div>
    </ModalWrapper>
  );
}
