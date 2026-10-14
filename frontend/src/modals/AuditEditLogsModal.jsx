import React, { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X, ShieldCheck, AlertCircle, Loader2,
  ChevronDown, ChevronUp, ChevronRight,
  PenLine, Check, Play
} from "lucide-react";
import api, { getFullImageUrl } from "../config/api";
import { lockBodyScroll, unlockBodyScroll } from "../utils/scrollLock";
import { formatActivityLogDetails } from "../utils/formatters";

export default function AuditEditLogsModal({ 
  isOpen, 
  onClose, 
  auditRecordId, 
  draftId,
  auditRecord = null, 
  questions = [] 
}) {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedCards, setExpandedCards] = useState({});
  const [showAllItemsMap, setShowAllItemsMap] = useState({});
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
    if (!isOpen || (!auditRecordId && !draftId)) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    const endpoint = draftId
      ? `/audit/draft/${draftId}/logs`
      : `/audit/${auditRecordId}/edit-logs`;

    api.get(endpoint)
      .then((res) => {
        if (isMounted) setLogs(res.data || []);
      })
      .catch((err) => {
        if (isMounted) setError(err.response?.data?.message || "ไม่สามารถโหลดประวัติการตรวจได้");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, auditRecordId, draftId]);

  const parseSummary = (jsonStr) => {
    if (!jsonStr) return null;
    try {
      return JSON.parse(jsonStr);
    } catch {
      return null;
    }
  };

  const formatDateTime = (isoString) => {
    if (!isoString) return "-";
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return "-";
      const datePart = d.toLocaleDateString("th-TH", {
        year: "numeric",
        month: "short",
        day: "numeric"
      });
      const timePart = d.toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit"
      }) + " น.";
      return `${datePart} · ${timePart}`;
    } catch {
      return "-";
    }
  };

  const toggleExpandCard = (logId) => {
    setExpandedCards(prev => ({
      ...prev,
      [logId]: !prev[logId]
    }));
  };

  const toggleShowAllItems = (logId) => {
    setShowAllItemsMap(prev => ({
      ...prev,
      [logId]: !prev[logId]
    }));
  };

  // คะแนนปัจจุบัน
  const currentScore = useMemo(() => {
    if (logs && logs.length > 0) {
      const latestEdit = logs.find(l => l.changesSummaryJson);
      if (latestEdit) {
        const latestSummary = parseSummary(latestEdit.changesSummaryJson);
        const after = latestSummary?.after || {};
        const scoreVal = after.PercentageScore ?? after.percentageScore;
        if (scoreVal !== undefined && scoreVal !== null) {
          return parseFloat(Number(scoreVal).toFixed(1));
        }
      }
    }
    if (auditRecord?.percentageScore !== undefined && auditRecord?.percentageScore !== null) {
      return parseFloat(Number(auditRecord.percentageScore).toFixed(1));
    }
    return null;
  }, [logs, auditRecord]);

  // แม็ปปิ้ง surveyItemId / id / text -> เลขข้อจริง (#1, #2...)
  const questionNumMap = useMemo(() => {
    const map = new Map();
    if (Array.isArray(questions)) {
      questions.forEach((q, idx) => {
        const num = q.num !== undefined && q.num !== null ? q.num : (idx + 1);
        if (q.surveyItemId) map.set(Number(q.surveyItemId), num);
        if (q.id) map.set(String(q.id), num);
        if (q.text && typeof q.text === "string") {
          map.set(q.text.trim().toLowerCase(), num);
        }
      });
    }
    return map;
  }, [questions]);

  const getQuestionNum = useCallback((item, fallbackIdx) => {
    if (item.surveyItemId && questionNumMap.has(Number(item.surveyItemId))) {
      return questionNumMap.get(Number(item.surveyItemId));
    }
    if (item.questionText && questionNumMap.has(item.questionText.trim().toLowerCase())) {
      return questionNumMap.get(item.questionText.trim().toLowerCase());
    }
    if (item.qNum !== undefined && item.qNum !== null) {
      return item.qNum;
    }
    return fallbackIdx + 1;
  }, [questionNumMap]);

  // 🌟 ฟอร์แมตรายละเอียดข้อความใน Log ให้คนทั่วไปอ่านเข้าใจง่าย (แปลง JSON ตาราง / Multians เป็นรายการชื่อและตัวเลข)
  const formatLogDetails = useCallback((detailsStr) => {
    return formatActivityLogDetails(detailsStr, questions);
  }, [questions]);

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg max-h-[92dvh] sm:max-h-[88dvh] bg-white rounded-t-[32px] sm:rounded-[28px] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div>
            <h3 className="text-base sm:text-lg font-extrabold text-slate-800 leading-tight">
              ประวัติการตรวจ
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {currentScore != null ? `คะแนนตอนนี้ ${currentScore}% · ` : ""}{logs.length > 0 ? `มีกิจกรรม ${logs.length} รายการ` : "ข้อมูลการตรวจ"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer transition-colors border border-slate-200/80 shadow-2xs active:scale-95"
            aria-label="ปิดหน้าต่าง"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body: Timeline */}
        <div className="p-5 sm:p-6 overflow-y-auto overscroll-contain flex-1 custom-tab-scrollbar bg-white">
          {isLoading ? (
            <div className="py-14 flex flex-col items-center justify-center text-slate-400 gap-2.5">
              <Loader2 size={24} className="animate-spin text-[#0F6659]" />
              <span className="text-xs font-semibold">กำลังดึงข้อมูลประวัติการตรวจ...</span>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          ) : (
            <div className="relative">
              {logs.map((item, idx) => {
                const isLast = idx === logs.length - 1;
                const eventType = item.eventType || (item.changesSummaryJson ? "EDIT" : "UNKNOWN");
                const summary = parseSummary(item.changesSummaryJson);
                const before = summary?.before || {};
                const after = summary?.after || {};
                const changedItems = Array.isArray(summary?.changedItems) ? summary.changedItems : [];

                const beforeScore = before.PercentageScore ?? before.percentageScore;
                const afterScore = after.PercentageScore ?? after.percentageScore;

                const isReopenLog = eventType === "REOPEN" || summary?.action === "REOPEN" || (item.reason && item.reason.includes("[ย้อนสถานะผลตรวจ]"));
                const cleanReason = (item.reason || "").replace(/^\[ย้อนสถานะผลตรวจ\]\s*/, "");

                // กรองเฉพาะข้อที่มีการเปลี่ยนแปลงจริง
                const realChangedItems = changedItems.filter(it => {
                  const b = it.before || {};
                  const a = it.after || {};
                  const isScoreDiff = b.isPassed !== a.isPassed || b.scoreGiven !== a.scoreGiven || b.isNa !== a.isNa;
                  const isNoteDiff = (b.notes || "").trim() !== (a.notes || "").trim();
                  const isImgDiff = (b.imageUrls?.length || 0) !== (a.imageUrls?.length || 0);
                  const isAnsDiff = (b.answerValue || "").trim() !== (a.answerValue || "").trim();
                  const hasEditReason = Boolean(it.editReason && it.editReason.trim());
                  return isScoreDiff || isNoteDiff || isImgDiff || hasEditReason || (Boolean(b.answerValue) && isAnsDiff);
                });

                const sortedChangedItems = [...realChangedItems].sort((a, b) => {
                  const numA = Number(getQuestionNum(a, 0)) || 0;
                  const numB = Number(getQuestionNum(b, 0)) || 0;
                  return numA - numB;
                });

                const isDetailOpen = Boolean(expandedCards[item.id]);
                const isShowAll = Boolean(showAllItemsMap[item.id]);
                const visibleItems = isShowAll ? sortedChangedItems : sortedChangedItems.slice(0, 3);
                const hasMoreItems = sortedChangedItems.length > 3;
                const remainingCount = sortedChangedItems.length - 3;

                // 🌟 แยกตามประเภทของ Event
                // 1. DRAFT_SAVE: บันทึกแบบร่าง
                if (eventType === "DRAFT_SAVE") {
                  return (
                    <div key={item.id || idx} className={`relative pl-12 ${isLast ? "" : "pb-7"} group`}>
                      {!isLast && <div className="absolute left-[17px] top-9 -bottom-2 w-[2px] bg-slate-200" />}
                      <div className="absolute left-0 top-0 w-9 h-9 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 z-10 shadow-2xs">
                        <PenLine size={15} />
                      </div>
                      <div className="space-y-1 min-w-0">
                        <div className="h-9 flex items-center">
                          <span className="text-sm font-bold text-slate-800">
                            {formatDateTime(item.editedAt)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap pt-0.5">
                          <span className="text-xs sm:text-sm font-bold text-slate-800">
                            บันทึกแบบร่าง
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-xl bg-amber-50 text-amber-800 font-semibold text-[11px] border border-amber-200/80">
                            แบบร่าง
                          </span>
                        </div>
                        {item.details && (
                          <div className="text-xs font-sans font-medium text-slate-700 bg-slate-50 border border-slate-200/80 rounded-xl px-2.5 py-1.5 mt-1 leading-relaxed break-words">
                            {formatLogDetails(item.details)}
                          </div>
                        )}
                        <div className="text-xs text-slate-500 font-medium pt-0.5 truncate" title={`โดย ${item.editedByName || "ผู้ใช้งาน"}`}>
                          โดย {item.editedByName || "ผู้ใช้งาน"}
                        </div>
                      </div>
                    </div>
                  );
                }

                // 2. START: เริ่มการตรวจ
                if (eventType === "START") {
                  return (
                    <div key={item.id || idx} className={`relative pl-12 ${isLast ? "" : "pb-7"} group`}>
                      {!isLast && <div className="absolute left-[17px] top-9 -bottom-2 w-[2px] bg-slate-200" />}
                      <div className="absolute left-0 top-0 w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 z-10 shadow-2xs">
                        <Play size={13} className="fill-current translate-x-0.5" />
                      </div>
                      <div className="space-y-1 min-w-0">
                        <div className="h-9 flex items-center">
                          <span className="text-sm font-bold text-slate-800">
                            {formatDateTime(item.editedAt)}
                          </span>
                        </div>
                        <div className="text-xs sm:text-sm font-bold text-slate-800 pt-0.5">
                          เริ่มการตรวจ
                        </div>
                        {item.details && (
                          <div className="text-xs font-sans font-medium text-slate-700 bg-slate-50 border border-slate-200/80 rounded-xl px-2.5 py-1.5 mt-1 leading-relaxed break-words">
                            {formatLogDetails(item.details)}
                          </div>
                        )}
                        <div className="text-xs text-slate-500 font-medium pt-0.5 truncate" title={`โดย ${item.editedByName || "ผู้ตรวจประเมิน"}`}>
                          โดย {item.editedByName || "ผู้ตรวจประเมิน"}
                        </div>
                      </div>
                    </div>
                  );
                }

                // 3. SUBMIT: บันทึกผลการตรวจ
                if (eventType === "SUBMIT") {
                  return (
                    <div key={item.id || idx} className={`relative pl-12 ${isLast ? "" : "pb-7"} group`}>
                      {!isLast && <div className="absolute left-[17px] top-9 -bottom-2 w-[2px] bg-slate-200" />}
                      <div className="absolute left-0 top-0 w-9 h-9 rounded-full bg-[#D1F2E8] text-[#0F6659] flex items-center justify-center shrink-0 z-10 shadow-2xs">
                        <Check size={18} strokeWidth={2.6} />
                      </div>
                      <div className="space-y-1 min-w-0">
                        <div className="h-9 flex items-center">
                          <span className="text-sm font-bold text-slate-800">
                            {formatDateTime(item.editedAt)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap pt-0.5">
                          <span className="text-xs sm:text-sm font-bold text-slate-800">
                            บันทึกผลการตรวจ
                          </span>
                          {auditRecord?.percentageScore != null && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-xl bg-slate-100 text-slate-600 font-semibold text-xs border border-slate-200/60">
                              คะแนน {parseFloat(Number(auditRecord.percentageScore).toFixed(1))}%
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 font-medium pt-0.5 truncate" title={`โดย ${item.editedByName || "ผู้ตรวจประเมิน"}`}>
                          โดย {item.editedByName || "ผู้ตรวจประเมิน"}
                        </div>
                      </div>
                    </div>
                  );
                }

                // 4. REOPEN: ย้อนผลการตรวจเป็นแบบร่าง
                if (isReopenLog) {
                  return (
                    <div key={item.id || idx} className={`relative pl-12 ${isLast ? "" : "pb-7"} group`}>
                      {!isLast && <div className="absolute left-[17px] top-9 -bottom-2 w-[2px] bg-slate-200" />}
                      <div className="absolute left-0 top-0 w-9 h-9 rounded-full bg-rose-100 text-rose-800 flex items-center justify-center shrink-0 z-10 shadow-2xs">
                        <RotateCcw size={15} />
                      </div>
                      <div className="space-y-1 min-w-0">
                        <div className="h-9 flex items-center">
                          <span className="text-sm font-bold text-slate-800">
                            {formatDateTime(item.editedAt)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap pt-0.5">
                          <span className="text-xs sm:text-sm font-bold text-slate-800">
                            ย้อนผลการตรวจเป็นแบบร่าง
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-xl bg-rose-100 text-rose-800 font-bold text-xs border border-rose-300">
                            ย้อนสถานะ
                          </span>
                        </div>
                        {cleanReason && (
                          <div className="text-xs text-slate-600 font-medium">
                            <span className="text-slate-400">เหตุผล: </span>
                            <span>{cleanReason}</span>
                          </div>
                        )}
                        <div className="text-xs text-slate-500 font-medium pt-0.5 truncate" title={`โดย ${item.editedByName || "ผู้ดูแลระบบ"}`}>
                          โดย {item.editedByName || "ผู้ดูแลระบบ"}
                        </div>
                      </div>
                    </div>
                  );
                }

                // 5. EDIT: แก้ไขผลตรวจ
                return (
                  <div key={item.id || idx} className={`relative pl-12 ${isLast ? "" : "pb-7"} group`}>
                    {!isLast && <div className="absolute left-[17px] top-9 -bottom-2 w-[2px] bg-slate-200" />}
                    <div className="absolute left-0 top-0 w-9 h-9 rounded-full bg-[#0F6659] text-white flex items-center justify-center shrink-0 z-10 shadow-2xs">
                      <PenLine size={16} />
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="h-9 flex items-center">
                        <span className="text-sm font-bold text-slate-800">
                          {formatDateTime(item.editedAt)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap pt-0.5">
                        <span className="text-xs sm:text-sm font-bold text-slate-800">
                          แก้ไขผลตรวจ
                        </span>
                        {beforeScore !== undefined && afterScore !== undefined && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-xl bg-[#E6F4F1] text-[#0F6659] font-bold text-xs border border-[#0F6659]/10">
                            <span>{parseFloat(Number(beforeScore).toFixed(1))}%</span>
                            <span className="text-[#0F6659]/60 font-mono">→</span>
                            <span>{parseFloat(Number(afterScore).toFixed(1))}%</span>
                          </span>
                        )}
                        {realChangedItems.length > 0 && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-xl bg-slate-100 text-slate-600 font-semibold text-xs border border-slate-200/60">
                            แก้ {realChangedItems.length} ข้อ
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-500 font-medium pt-0.5 truncate" title={`โดย ${item.editedByName || "ผู้ใช้งาน"}`}>
                        โดย {item.editedByName || "ผู้ใช้งาน"}
                      </div>

                      {cleanReason && (
                        <div className="text-xs text-slate-600 font-medium">
                          <span className="text-slate-400">เหตุผล: </span>
                          <span>{cleanReason}</span>
                        </div>
                      )}

                      {realChangedItems.length > 0 && (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => toggleExpandCard(item.id)}
                            className="inline-flex items-center gap-1 text-xs font-bold text-[#0F6659] hover:text-[#0C5247] hover:underline cursor-pointer transition-colors"
                          >
                            <span>{isDetailOpen ? "ซ่อนรายละเอียด" : "ดูรายละเอียด"}</span>
                            {isDetailOpen ? <ChevronUp size={13} /> : <ChevronRight size={13} />}
                          </button>
                        </div>
                      )}

                      {isDetailOpen && realChangedItems.length > 0 && (
                        <div className="mt-2.5 p-3.5 sm:p-4 rounded-2xl bg-[#F8FAF9] border border-slate-200/80 space-y-2.5 animate-in fade-in duration-200">
                          <div className="text-xs text-slate-500 font-bold">
                            ข้อตรวจที่แก้
                          </div>

                          <div className="divide-y divide-slate-200/70">
                            {visibleItems.map((qItem, itemIdx) => {
                              const b = qItem.before || {};
                              const a = qItem.after || {};
                              const isScoreDiff = b.isPassed !== a.isPassed || b.scoreGiven !== a.scoreGiven || b.isNa !== a.isNa;
                              const isAnsDiff = (b.answerValue || "").trim() !== (a.answerValue || "").trim();

                              const bScore = b.isNa ? "N/A" : (b.scoreGiven !== undefined && b.scoreGiven !== null ? b.scoreGiven : (b.isPassed ? 1 : 0));
                              const aScore = a.isNa ? "N/A" : (a.scoreGiven !== undefined && a.scoreGiven !== null ? a.scoreGiven : (a.isPassed ? 1 : 0));
                              const showScoreRow = bScore !== aScore || isScoreDiff;
                              const showPassFail = b.isPassed !== a.isPassed && !b.isNa && !a.isNa;
                              const actualQNum = getQuestionNum(qItem, itemIdx);

                              const subTextParts = [];
                              if (qItem.sectionTitle) subTextParts.push(qItem.sectionTitle);
                              if (qItem.editReason && qItem.editReason.trim()) subTextParts.push(qItem.editReason.trim());
                              else if (a.notes && a.notes.trim()) subTextParts.push(a.notes.trim());
                              else if (b.notes && b.notes.trim()) subTextParts.push(b.notes.trim());
                              const subText = subTextParts.join(" · ");

                              return (
                                <div key={qItem.surveyItemId || itemIdx} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                                  <div className="min-w-0 flex-1">
                                    <div className="font-bold text-slate-800 truncate" title={`#${actualQNum} ${qItem.questionText}`}>
                                      <span className="text-[#0F6659] font-mono mr-1.5 font-bold">
                                        #{actualQNum}
                                      </span>
                                      <span>{qItem.questionText}</span>
                                    </div>
                                    {subText && (
                                      <div className="text-[11px] text-slate-400 font-medium truncate mt-0.5" title={subText}>
                                        {subText}
                                      </div>
                                    )}
                                  </div>

                                  <div className="shrink-0 flex flex-col items-end">
                                    {showScoreRow && (
                                      <div className="flex items-center gap-1.5 text-xs sm:text-sm font-mono font-semibold">
                                        <span className="text-slate-400">{bScore}</span>
                                        <span className="text-slate-300">→</span>
                                        <span className="font-bold text-slate-900">{aScore}</span>
                                      </div>
                                    )}
                                    {showPassFail && (
                                      <div className="text-[11px] font-bold text-right flex items-center gap-1 mt-0.5">
                                        <span className={b.isPassed ? "text-slate-400" : "text-rose-500"}>
                                          {b.isPassed ? "ผ่าน" : "ไม่ผ่าน"}
                                        </span>
                                        <span className="text-slate-300">→</span>
                                        <span className={a.isPassed ? "text-emerald-700" : "text-rose-600 font-black"}>
                                          {a.isPassed ? "ผ่าน" : "ไม่ผ่าน"}
                                        </span>
                                      </div>
                                    )}
                                    {!showScoreRow && !showPassFail && isAnsDiff && (
                                      <div className="text-[11px] text-slate-500 font-medium">
                                        <span className="line-through text-slate-400 mr-1">{b.answerValue || "-"}</span>
                                        <span className="text-[#0F6659] font-bold">{a.answerValue || "-"}</span>
                                      </div>
                                    )}
                                    {a.imageUrls && a.imageUrls.length > 0 && (
                                      <div className="flex items-center gap-1.5 mt-1.5">
                                        {a.imageUrls.map((url, imgI) => (
                                          <div
                                            key={imgI}
                                            className="relative group cursor-pointer"
                                            onClick={() => setPreviewPhoto(getFullImageUrl(url))}
                                          >
                                            <img
                                              src={getFullImageUrl(url)}
                                              alt="หลักฐาน"
                                              className="w-12 h-12 sm:w-14 sm:h-14 object-cover rounded-xl border border-slate-200/90 shadow-2xs hover:opacity-90 active:scale-95 transition-all"
                                            />
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {hasMoreItems && (
                            <button
                              type="button"
                              onClick={() => toggleShowAllItems(item.id)}
                              className="w-full mt-2 py-2 rounded-xl border border-dashed border-[#0F6659]/30 hover:border-[#0F6659] hover:bg-emerald-50/50 text-[#0F6659] text-xs font-bold transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-1"
                            >
                              {isShowAll ? (
                                <>
                                  <span>ย่อรายการ</span>
                                  <ChevronUp size={13} />
                                </>
                              ) : (
                                <>
                                  <span>ดูทั้งหมด (อีก {remainingCount} ข้อ)</span>
                                  <ChevronDown size={13} />
                                </>
                              )}
                            </button>
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
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-white shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3.5 rounded-2xl bg-[#0F6659] hover:bg-[#0c5247] text-white text-sm font-bold shadow-sm active:scale-98 transition-all cursor-pointer"
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
