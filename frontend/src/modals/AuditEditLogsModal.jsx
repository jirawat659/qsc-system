import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X, History, User, Clock, MessageSquare, ShieldCheck, AlertCircle, Loader2,
  ArrowRight, CheckCircle2, XCircle, MinusCircle, ChevronDown, ChevronUp,
  Image as ImageIcon, MapPin, Calendar, ExternalLink
} from "lucide-react";
import api, { getFullImageUrl } from "../config/api";
import { mono } from "../config/theme";
import { lockBodyScroll, unlockBodyScroll } from "../utils/scrollLock";

export default function AuditEditLogsModal({ isOpen, onClose, auditRecordId }) {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedItems, setExpandedItems] = useState({});
  const [previewPhoto, setPreviewPhoto] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    lockBodyScroll();
    return () => {
      unlockBodyScroll();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!previewPhoto) return;
    lockBodyScroll();
    return () => {
      unlockBodyScroll();
    };
  }, [previewPhoto]);

  useEffect(() => {
    if (!isOpen || !auditRecordId) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    api.get(`/audit/${auditRecordId}/edit-logs`)
      .then((res) => {
        if (isMounted) setLogs(res.data || []);
      })
      .catch((err) => {
        if (isMounted) setError(err.response?.data?.message || "ไม่สามารถโหลดประวัติการแก้ไขได้");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, auditRecordId]);

  if (!isOpen) return null;

  const formatDate = (isoString) => {
    if (!isoString) return "-";
    const d = new Date(isoString);
    return d.toLocaleDateString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }) + " น.";
  };

  const formatShortTime = (isoString) => {
    if (!isoString) return "-";
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return "-";
      return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) + " น.";
    } catch {
      return "-";
    }
  };

  const parseSummary = (jsonStr) => {
    if (!jsonStr) return null;
    try {
      return JSON.parse(jsonStr);
    } catch {
      return null;
    }
  };

  const toggleExpand = (logId) => {
    setExpandedItems(prev => ({
      ...prev,
      [logId]: !prev[logId]
    }));
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl max-h-[88dvh] bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100/80 border border-emerald-300/60 flex items-center justify-center text-[#0F6659] shadow-2xs">
              <History size={16} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-800 leading-tight">
                ประวัติการแก้ไขผลตรวจ
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                บันทึกการตรวจสอบย้อนหลังทุกเวอร์ชัน (Audit Trail & Item Diff)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer transition-colors border border-slate-200/60 shadow-2xs active:scale-95"
          >
            <X size={15} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto overscroll-contain flex-1 space-y-4 custom-tab-scrollbar">
          {isLoading ? (
            <div className="py-14 flex flex-col items-center justify-center text-slate-400 gap-2.5">
              <Loader2 size={24} className="animate-spin text-[#0F6659]" />
              <span className="text-xs font-semibold">กำลังดึงข้อมูลประวัติการแก้ไข...</span>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="py-14 flex flex-col items-center justify-center text-center p-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#0F6659] mb-3 shadow-2xs">
                <ShieldCheck size={28} />
              </div>
              <div className="text-sm font-extrabold text-slate-800">ยังไม่เคยมีการแก้ไขบันทึกนี้</div>
              <div className="text-xs text-slate-500 max-w-xs mt-1 leading-relaxed font-medium">
                ผลการตรวจนี้เป็นข้อมูลต้นฉบับจริงจากการลงพื้นที่ตรวจโดยตรง ไม่มีการเปลี่ยนแปลงย้อนหลัง
              </div>
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {logs.map((log, idx) => {
                const summary = parseSummary(log.changesSummaryJson);
                const before = summary?.before || {};
                const after = summary?.after || {};
                const changedItems = Array.isArray(summary?.changedItems) ? summary.changedItems : [];
                const isExpanded = expandedItems[log.id] !== false; // Default expanded

                const beforeScore = before.PercentageScore ?? before.percentageScore;
                const afterScore = after.PercentageScore ?? after.percentageScore;
                const beforePassed = before.IsPassed ?? before.isPassed;
                const afterPassed = after.IsPassed ?? after.isPassed;

                const beforeStarted = before.StartedAt ?? before.startedAt;
                const afterStarted = after.StartedAt ?? after.startedAt;
                const isTimeChanged = beforeStarted && afterStarted && beforeStarted !== afterStarted;

                return (
                  <div key={log.id || idx} className="relative group animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {/* Timeline Node Icon */}
                    <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-white border-2 border-[#0F6659] flex items-center justify-center shadow-xs">
                      <div className="w-2 h-2 rounded-full bg-[#0F6659]" />
                    </div>

                    {/* Card */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-4.5 shadow-2xs space-y-3 transition-all hover:border-slate-300">
                      {/* Meta Header */}
                      <div className="flex items-start justify-between gap-2 flex-wrap text-xs">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-[#0F6659] font-bold text-[11px] border border-emerald-200 font-mono">
                            แก้ไขครั้งที่ {logs.length - idx}
                          </span>
                          <div className="flex items-center gap-1 font-bold text-slate-800">
                            <User size={13} className="text-slate-400" />
                            <span>{log.editedByName || "ผู้ใช้งาน"}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                          <Clock size={11} />
                          <span>{formatDate(log.editedAt)}</span>
                        </div>
                      </div>

                      {/* Reason Box */}
                      <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs text-slate-700 space-y-1">
                        <div className="text-[10.5px] font-bold text-amber-900 flex items-center gap-1">
                          <MessageSquare size={12} className="text-amber-700" />
                          <span>เหตุผลในการแก้ไข:</span>
                        </div>
                        <div className="font-semibold text-slate-800 leading-relaxed pl-4">
                          "{log.reason}"
                        </div>
                      </div>

                      {/* Overview Badges (Score, Pass/Fail, Time) */}
                      <div className="flex items-center gap-2 flex-wrap text-xs pt-1">
                        {/* Score Diff */}
                        {beforeScore !== undefined && afterScore !== undefined && (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-medium shadow-2xs">
                            <span className="text-slate-400 text-[11px] font-bold">คะแนน:</span>
                            <span className="font-bold line-through text-slate-400 font-mono">
                              {parseFloat(Number(beforeScore).toFixed(2))}%
                            </span>
                            <ArrowRight size={11} className="text-slate-400" />
                            <span className={`font-black font-mono ${afterPassed ? 'text-emerald-700' : 'text-amber-700'}`}>
                              {parseFloat(Number(afterScore).toFixed(2))}%
                            </span>
                          </div>
                        )}

                        {/* Pass/Fail Diff */}
                        {beforePassed !== undefined && afterPassed !== undefined && beforePassed !== afterPassed && (
                          <div className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-50 border border-slate-200 shadow-2xs">
                            <span className={beforePassed ? "text-emerald-600" : "text-rose-500"}>
                              {beforePassed ? "ผ่านเกณฑ์" : "ไม่ผ่าน"}
                            </span>
                            <ArrowRight size={11} className="text-slate-400" />
                            <span className={afterPassed ? "text-emerald-700 font-black" : "text-rose-600 font-black"}>
                              {afterPassed ? "ผ่านเกณฑ์" : "ไม่ผ่าน"}
                            </span>
                          </div>
                        )}

                        {/* Audit Time Diff */}
                        {isTimeChanged && (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium shadow-2xs">
                            <Calendar size={12} className="text-slate-400" />
                            <span className="text-slate-400 text-[11px] font-bold">เวลาเริ่ม:</span>
                            <span className="line-through text-slate-400 font-mono text-[11px]">
                              {formatShortTime(beforeStarted)}
                            </span>
                            <ArrowRight size={10} className="text-slate-400" />
                            <span className="font-bold text-[#0F6659] font-mono text-[11px]">
                              {formatShortTime(afterStarted)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Changed Items (Item-level diff) */}
                      {changedItems.length > 0 && (
                        <div className="pt-2 border-t border-slate-100 space-y-2.5">
                          <button
                            type="button"
                            onClick={() => toggleExpand(log.id)}
                            className="w-full flex items-center justify-between text-xs font-bold text-slate-700 hover:text-[#0F6659] py-1 cursor-pointer transition-colors select-none"
                          >
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-[#0F6659]" />
                              <span>รายการข้อตรวจที่แก้ไข ({changedItems.length} ข้อ)</span>
                            </span>
                            <span className="text-[11px] text-slate-400 flex items-center gap-1">
                              <span>{isExpanded ? "ย่อรายการ" : "ดูรายละเอียด"}</span>
                              {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </span>
                          </button>

                          {isExpanded && (
                            <div className="space-y-2.5 animate-in fade-in duration-200">
                              {changedItems.map((item, itemIdx) => {
                                const b = item.before || {};
                                const a = item.after || {};
                                const isScoreDiff = b.isPassed !== a.isPassed || b.scoreGiven !== a.scoreGiven || b.isNa !== a.isNa;
                                const isNoteDiff = (b.notes || "").trim() !== (a.notes || "").trim();
                                const isImgDiff = (b.imageUrls?.length || 0) !== (a.imageUrls?.length || 0);
                                const isAnsDiff = (b.answerValue || "").trim() !== (a.answerValue || "").trim();
                                const hasEditReason = Boolean(item.editReason && item.editReason.trim());

                                // ซ่อนรายการที่ไม่มีการเปลี่ยนแปลงจริง (ดัก phantom diff จาก log เก่าที่ค้างในระบบ)
                                const hasRealDiff = isScoreDiff || isNoteDiff || isImgDiff || hasEditReason || (Boolean(b.answerValue) && isAnsDiff);
                                if (!hasRealDiff) return null;

                                return (
                                  <div key={item.surveyItemId || itemIdx} className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-2 text-xs">
                                    {/* Item Title + Section */}
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="font-bold text-slate-800 leading-snug flex-1 min-w-0 break-words [overflow-wrap:anywhere]">
                                        <span className="text-[#0F6659] font-mono font-black mr-1.5 shrink-0">#{itemIdx + 1}</span>
                                        <span>{item.questionText}</span>
                                      </div>
                                      {item.sectionTitle && (
                                        <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-bold text-slate-500 shrink-0">
                                          {item.sectionTitle}
                                        </span>
                                      )}
                                    </div>

                                    {/* Result Diff */}
                                    {isScoreDiff && (
                                      <div className="flex items-center gap-2 flex-wrap text-[11px]">
                                        <span className="text-slate-400 font-bold">ผลตรวจ:</span>
                                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-500">
                                          {b.isNa ? (
                                            <span className="font-bold text-slate-500">N/A</span>
                                          ) : b.isPassed ? (
                                            <span className="font-bold text-emerald-600 flex items-center gap-1">
                                              <CheckCircle2 size={11} /> ผ่าน {b.scoreGiven !== undefined && b.scoreGiven !== null ? `(${b.scoreGiven} คะแนน)` : ""}
                                            </span>
                                          ) : (
                                            <span className="font-bold text-rose-500 flex items-center gap-1">
                                              <XCircle size={11} /> ตก {b.scoreGiven !== undefined && b.scoreGiven !== null ? `(${b.scoreGiven} คะแนน)` : ""}
                                            </span>
                                          )}
                                        </div>
                                        <ArrowRight size={11} className="text-slate-400" />
                                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-emerald-300 text-slate-800 shadow-2xs">
                                          {a.isNa ? (
                                            <span className="font-bold text-slate-600">N/A</span>
                                          ) : a.isPassed ? (
                                            <span className="font-bold text-emerald-700 flex items-center gap-1">
                                              <CheckCircle2 size={11} /> ผ่าน {a.scoreGiven !== undefined && a.scoreGiven !== null ? `(${a.scoreGiven} คะแนน)` : ""}
                                            </span>
                                          ) : (
                                            <span className="font-bold text-rose-600 flex items-center gap-1">
                                              <XCircle size={11} /> ตก {a.scoreGiven !== undefined && a.scoreGiven !== null ? `(${a.scoreGiven} คะแนน)` : ""}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {/* Answer Diff (สำหรับข้อที่ไม่คิดคะแนนหรือข้อที่เปลี่ยนคำตอบ) */}
                                    {isAnsDiff && !isScoreDiff && (
                                      <div className="flex items-center gap-2 flex-wrap text-[11px]">
                                        <span className="text-slate-400 font-bold">คำตอบ:</span>
                                        <span className="line-through text-slate-400 font-medium">"{b.answerValue || "-"}"</span>
                                        <ArrowRight size={11} className="text-slate-400" />
                                        <span className="font-bold text-[#0F6659]">"{a.answerValue || "-"}"</span>
                                      </div>
                                    )}

                                    {/* Note Diff */}
                                    {isNoteDiff && (
                                      <div className="p-2 rounded-lg bg-white border border-slate-200 space-y-1 text-[11px]">
                                        {b.notes && (
                                          <div className="text-slate-400 line-through">
                                            <span className="font-bold mr-1">เดิม:</span>
                                            <span>"{b.notes}"</span>
                                          </div>
                                        )}
                                        <div className="text-slate-800 font-semibold">
                                          <span className="text-[#0F6659] font-bold mr-1">{b.notes ? "ใหม่:" : "คอมเมนต์:"}</span>
                                          <span>"{a.notes || "-"}"</span>
                                        </div>
                                      </div>
                                    )}

                                    {/* 🌟 Item Edit Reason (เหตุผลการปรับแก้ข้อนี้) */}
                                    {item.editReason && (
                                      <div className="p-2.5 rounded-lg bg-amber-50/90 border border-amber-200/90 text-[11px] space-y-1">
                                        <div className="font-extrabold text-amber-900 flex items-center gap-1">
                                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                          <span>เหตุผลการปรับแก้ข้อนี้:</span>
                                        </div>
                                        <div className="font-medium text-amber-950 pl-2.5 break-words [overflow-wrap:anywhere]">
                                          "{item.editReason}"
                                        </div>
                                      </div>
                                    )}

                                    {/* Image Gallery Diff */}
                                    {((b.imageUrls && b.imageUrls.length > 0) || (a.imageUrls && a.imageUrls.length > 0)) && (
                                      <div className="space-y-1 pt-1">
                                        <div className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                                          <ImageIcon size={11} />
                                          <span>รูปภาพหลักฐาน ({a.imageUrls?.length || 0} รูป):</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 overflow-x-auto py-1 custom-tab-scrollbar">
                                          {(a.imageUrls || []).map((imgUrl, imgIdx) => (
                                            <img
                                              key={imgIdx}
                                              src={getFullImageUrl(imgUrl)}
                                              alt={`Evidence ${imgIdx + 1}`}
                                              className="w-12 h-12 object-cover rounded-lg border border-slate-200 cursor-pointer hover:opacity-80 transition-opacity shrink-0 shadow-2xs"
                                              onClick={() => setPreviewPhoto(getFullImageUrl(imgUrl))}
                                            />
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-2xl bg-[#0F6659] hover:bg-[#0c5247] text-white text-xs font-bold transition-all cursor-pointer active:scale-95 shadow-sm"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>

      {/* Full Photo Modal */}
      {previewPhoto && (
        <div 
          className="fixed inset-0 z-[100000] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setPreviewPhoto(null)}
        >
          <div className="relative max-w-2xl max-h-[85dvh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPreviewPhoto(null)}
              className="absolute -top-10 right-0 w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center cursor-pointer transition-all"
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
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modalContent, document.body) : null;
}
