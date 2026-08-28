import React, { useState, useEffect } from "react";
import {
  Sparkles, Calendar, AlertTriangle, CheckCircle2,
  Clock, Store, RefreshCw, X, ShieldAlert,
  MapPin, Award, UserCheck, Check
} from "lucide-react";
import ModalWrapper from "../shared/ModalWrapper";
import api from "../config/api";

export default function AiScheduleAdvisorModal({ onClose }) {
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
          className: "bg-rose-50 text-rose-700 border-rose-200"
        };
      case "HIGH":
        return {
          label: "ควรตรวจก่อน",
          className: "bg-amber-50 text-amber-700 border-amber-200"
        };
      default:
        return {
          label: "ตามรอบเดือน",
          className: "bg-emerald-50 text-emerald-700 border-emerald-200"
        };
    }
  };

  return (
    <ModalWrapper onClose={onClose} maxWidth="max-w-xl">
      <div className="flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-50/60 to-teal-50/60 rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-700 text-white flex items-center justify-center shadow-xs">
              <Sparkles size={19} className="animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                คำแนะนำจากระบบอัจฉริยะ AI
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                เกณฑ์มาตรฐานตรวจอย่างน้อย 1 ครั้ง / เดือน
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={fetchRecommendations}
              disabled={loading}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-white transition-all cursor-pointer disabled:opacity-50"
              title="วิเคราะห์ใหม่"
            >
              <RefreshCw size={17} className={loading ? "animate-spin text-emerald-600" : ""} />
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
        <div className="p-5 overflow-y-auto space-y-4">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2.5 text-center">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center animate-bounce">
                <Sparkles size={20} />
              </div>
              <p className="text-xs font-bold text-slate-600">กำลังวิเคราะห์ประวัติการตรวจและจัดลำดับสาขา...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center justify-between">
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
                <div className="p-3.5 rounded-2xl bg-emerald-950 text-white shadow-2xs">
                  <div className="flex items-start gap-2.5">
                    <Sparkles size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                    <p className="text-xs leading-relaxed text-slate-200 font-medium">
                      {data.summary}
                    </p>
                  </div>
                </div>
              )}

              {/* Recommendations List */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between px-0.5">
                  <h3 className="text-xs font-bold text-slate-600">
                    ลำดับสาขาที่แนะนำให้เข้าตรวจ
                  </h3>
                  <span className="text-[11px] text-slate-500 font-medium">
                    ค้างตรวจเดือนนี้: <b className="text-emerald-800 font-extrabold">{data?.totalBranchesPendingMonthlyAudit || 0}</b> สาขา
                  </span>
                </div>

                {(data?.recommendations || []).map((b, idx) => {
                  const badge = getPriorityBadge(b.priorityLevel);
                  return (
                    <div
                      key={b.locationId}
                      className="p-4 rounded-2xl border border-slate-200/90 bg-white space-y-2.5"
                    >
                      {/* Branch Name & Priority */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 font-extrabold text-xs flex items-center justify-center shrink-0">
                            {idx + 1}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="text-xs sm:text-sm font-extrabold text-slate-800">{b.locationName}</h4>
                              <span className="text-[11px] font-medium text-slate-400">({b.brandName})</span>
                            </div>
                            <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <MapPin size={10} /> {b.region || "ไม่ระบุโซน"} · รอบล่าสุด: {b.lastScore != null ? `${b.lastScore}%` : "ยังไม่เคยตรวจ"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {b.hasAuditedThisMonth ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1">
                              <CheckCircle2 size={10} className="text-emerald-600" />
                              ตรวจรอบเดือนนี้แล้ว
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-rose-50 text-rose-700 border-rose-200 flex items-center gap-1">
                              <AlertTriangle size={10} className="text-rose-600" />
                              ยังไม่ตรวจเดือนนี้
                            </span>
                          )}
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.className}`}>
                            {badge.label}
                          </span>
                        </div>
                      </div>

                      {/* AI Reasoning */}
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1.5">
                        <div className="text-slate-700 leading-relaxed font-medium">
                          <span className="font-bold text-emerald-800">📌 เหตุผล:</span> {b.reason}
                        </div>

                        {/* Suggested Auditor */}
                        {b.suggestedAuditorName && (
                          <div className="pt-1 border-t border-slate-200/60 flex items-center gap-1.5 text-[11px] text-slate-600">
                            <UserCheck size={12} className="text-emerald-700 shrink-0" />
                            <span>
                              <b className="text-slate-800 font-bold">ผู้ตรวจที่แนะนำ:</b> {b.suggestedAuditorName}
                              {b.auditorReason && <span className="text-slate-400 ml-1">({b.auditorReason})</span>}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer Disclaimer */}
        <div className="p-3.5 border-t border-slate-100 bg-slate-50/80 rounded-b-3xl text-center">
          <p className="text-[11px] text-slate-400 font-medium">
            💡 คำแนะนำนี้สร้างโดย AI เพื่อเป็นข้อมูลสนับสนุนการตัดสินใจของผู้ตรวจและทีมบริหารเท่านั้น
          </p>
        </div>
      </div>
    </ModalWrapper>
  );
}
