import React, { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { 
  X, Edit3, CheckCircle2, XCircle, MinusCircle, AlertTriangle, 
  Save, Loader2, ArrowRight, MessageSquare, Users, FileText
} from "lucide-react";
import api from "../config/api";
import { mono } from "../config/theme";

export default function EditAuditRecordModal({ isOpen, onClose, record, onSaveSuccess }) {
  const [reason, setReason] = useState("");
  const [staffCount, setStaffCount] = useState(record?.staffCount || 0);
  const [generalNotes, setGeneralNotes] = useState(record?.notes || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Store initial answers state to detect changes per question
  const initialAnswers = useMemo(() => {
    const map = {};
    (record?.responses || []).forEach((res) => {
      const itemId = res.surveyItemId || res.surveyItem?.id;
      if (!itemId) return;

      const isNa = !!(res.isNa || res.rawAnswer === "na");
      const isPass = isNa ? false : (res.isPassed !== undefined ? res.isPassed : (res.scoreGiven > 0));
      const qType = (res.surveyItem?.questionType || "yesno").toLowerCase();

      map[itemId] = {
        isNa,
        isPassed: isPass,
        scaleScore: res.scaleScore || (qType === "scale" ? 5 : null),
        notes: res.notes || ""
      };
    });
    return map;
  }, [record]);

  const [expandedNotes, setExpandedNotes] = useState({});

  const toggleExpandNote = (itemId) => {
    setExpandedNotes((prev) => {
      const isCurrentlyOpen = prev[itemId] !== undefined
        ? prev[itemId]
        : (isQuestionEdited(itemId) || !!(answersState[itemId]?.notes && answersState[itemId].notes.trim()));
      return {
        ...prev,
        [itemId]: !isCurrentlyOpen
      };
    });
  };

  const isQuestionEdited = (itemId) => {
    const orig = initialAnswers[itemId];
    const curr = answersState[itemId];
    if (!orig || !curr) return false;

    if (orig.isNa !== curr.isNa) return true;
    if (orig.isPassed !== curr.isPassed) return true;
    if (curr.type === "scale" && orig.scaleScore !== curr.scaleScore) return true;

    return false;
  };

  // Initialize editable answers mapped by surveyItemId
  const [answersState, setAnswersState] = useState(() => {
    const map = {};
    (record?.responses || []).forEach((res) => {
      const itemId = res.surveyItemId || res.surveyItem?.id;
      if (!itemId) return;

      const isNa = !!(res.isNa || res.rawAnswer === "na");
      const isPass = isNa ? false : (res.isPassed !== undefined ? res.isPassed : (res.scoreGiven > 0));
      const qType = (res.surveyItem?.questionType || "yesno").toLowerCase();

      map[itemId] = {
        surveyItemId: itemId,
        isNa: isNa,
        isPassed: isPass,
        scoreGiven: res.scoreGiven !== undefined ? res.scoreGiven : (isPass ? (res.surveyItem?.fullScore || 10) : 0),
        fullScore: res.surveyItem?.fullScore || 10,
        type: qType,
        scaleScore: res.scaleScore || (qType === "scale" ? 5 : null),
        notes: res.notes || "",
        imageUrls: (res.images || []).map(img => img.imageUrl)
      };
    });
    return map;
  });

  // Calculate live preview score
  const liveScoring = useMemo(() => {
    let earned = 0;
    let max = 0;
    let hasCritFail = false;

    (record?.responses || []).forEach((res) => {
      const itemId = res.surveyItemId || res.surveyItem?.id;
      const state = answersState[itemId];
      if (!state) return;

      const full = state.fullScore || 10;
      if (state.isNa) {
        // N/A: excluded from total
        return;
      }

      max += full;
      if (state.type === "scale") {
        const sc = (state.scaleScore / 5) * full;
        earned += sc;
      } else {
        if (state.isPassed) earned += full;
      }

      if (res.surveyItem?.isCritical && !state.isPassed && !state.isNa) {
        hasCritFail = true;
      }
    });

    const percent = max > 0 ? Math.round((earned / max) * 100) : 0;
    const isPassed = percent >= (record?.surveyForm?.passingScore || 85) && !hasCritFail;

    return { earned, max, percent, isPassed, hasCritFail };
  }, [answersState, record]);

  if (!isOpen || !record) return null;

  const originalScore = typeof record.score === "number" ? record.score : typeof record.percentageScore === "number" ? Math.round(record.percentageScore) : 0;

  const handleToggleYesNo = (itemId, choice) => {
    setAnswersState((prev) => {
      const current = prev[itemId] || { fullScore: 10, notes: "", imageUrls: [] };
      if (choice === "na") {
        return {
          ...prev,
          [itemId]: { ...current, isNa: true, isPassed: false, scoreGiven: 0 }
        };
      }
      if (choice === "yes") {
        return {
          ...prev,
          [itemId]: { ...current, isNa: false, isPassed: true, scoreGiven: current.fullScore }
        };
      }
      // choice === "no"
      return {
        ...prev,
        [itemId]: { ...current, isNa: false, isPassed: false, scoreGiven: 0 }
      };
    });
    setExpandedNotes(prev => ({ ...prev, [itemId]: true }));
  };

  const handleSetScale = (itemId, val) => {
    setAnswersState((prev) => {
      const current = prev[itemId] || { fullScore: 10, notes: "", imageUrls: [] };
      const score = (val / 5) * current.fullScore;
      return {
        ...prev,
        [itemId]: {
          ...current,
          isNa: false,
          isPassed: val >= 3,
          scaleScore: val,
          scoreGiven: score
        }
      };
    });
    setExpandedNotes(prev => ({ ...prev, [itemId]: true }));
  };

  const handleNoteChange = (itemId, val) => {
    setAnswersState((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], notes: val }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError("กรุณาระบุเหตุผลภาพรวมในการแก้ไขผลตรวจ");
      return;
    }

    // 🌟 ตรวจสอบว่าข้อที่มีการแก้ไข ถูกระบุคอมเมนต์ครบทุกข้อหรือไม่
    const invalidEditedItems = (record?.responses || []).filter((res) => {
      const itemId = res.surveyItemId || res.surveyItem?.id;
      if (!itemId) return false;
      if (!isQuestionEdited(itemId)) return false;
      const note = answersState[itemId]?.notes?.trim();
      return !note;
    });

    if (invalidEditedItems.length > 0) {
      // บังคับเปิดแถบคอมเมนต์ของทุกข้อที่ยังไม่ได้ระบุ
      setExpandedNotes((prev) => {
        const next = { ...prev };
        invalidEditedItems.forEach((res) => {
          const itemId = res.surveyItemId || res.surveyItem?.id;
          next[itemId] = true;
        });
        return next;
      });

      setError(`กรุณาระบุคอมเมนต์สำหรับทุกข้อที่มีการแก้ไข (${invalidEditedItems.length} ข้อที่ยังไม่ได้ระบุ) ก่อนบันทึก`);

      // เลื่อนจอไปโฟกัสข้อแรกที่ยังไม่ระบุคอมเมนต์
      const firstInvalidId = invalidEditedItems[0].surveyItemId || invalidEditedItems[0].surveyItem?.id;
      setTimeout(() => {
        const el = document.getElementById(`note-input-${firstInvalidId}`);
        if (el) {
          el.focus();
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 50);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payloadResponses = Object.values(answersState).map((s) => ({
        surveyItemId: s.surveyItemId,
        scoreGiven: s.scoreGiven,
        isPassed: s.isPassed,
        isNa: s.isNa,
        rawAnswer: s.isNa ? "na" : (s.type === "scale" ? String(s.scaleScore) : (s.isPassed ? "yes" : "no")),
        notes: s.notes || null,
        imageUrls: s.imageUrls || []
      }));

      const payload = {
        reason: reason.trim(),
        auditeeUserId: record.auditeeUserId || null,
        auditeeNameText: record.auditeeNameText || record.auditeeName || null,
        staffCount: Number(staffCount) || 0,
        auditType: record.auditType || "announced",
        notes: generalNotes || null,
        metadataValuesJson: record.metadataValuesJson || null,
        responses: payloadResponses
      };

      const res = await api.put(`/audit/${record.id}`, payload);
      if (onSaveSuccess) onSaveSuccess(res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "เกิดข้อผิดพลาดในการบันทึกการแก้ไข");
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl max-h-[90vh] bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/90 shrink-0 space-y-1">
          {/* Top Row: Icon + Title + Score Preview (เก่า / ใหม่) + Close Button */}
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-emerald-100/80 border border-emerald-300/70 flex items-center justify-center text-[#0F6659] shadow-2xs shrink-0">
                <Edit3 size={16} />
              </div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-800 leading-tight truncate">
                แก้ไขบันทึกผลการตรวจ
              </h3>
            </div>

            {/* 🌟 คะแนนเก่า / ใหม่ แสดงบนแถบบนขวา */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#0F6659] text-white shadow-2xs text-xs font-bold" style={{ fontFamily: mono }}>
                <span className="opacity-70 line-through text-[11px]">{originalScore}%</span>
                <ArrowRight size={12} className="text-emerald-300 shrink-0" />
                <span className="text-emerald-200 text-xs sm:text-sm font-black">{liveScoring.percent}%</span>
                {liveScoring.hasCritFail && (
                  <span className="text-[10px] px-1 py-0.5 rounded bg-rose-500 text-white font-extrabold">
                    Critical ตก
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer transition-colors border border-slate-200/60 shadow-2xs active:scale-95 shrink-0"
                title="ปิดหน้าต่าง"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Sub Row: Details (Branch Name + Record ID) */}
          <div className="pl-10.5">
            <p className="text-xs text-slate-500 font-medium truncate">
              {record?.location?.name || record?.locationName || "สาขา"} · ID: #{record.id}
            </p>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-5">
          {error && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Mandatory Reason Box */}
          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-2">
            <label className="text-xs font-extrabold text-amber-900 flex items-center gap-1.5">
              <MessageSquare size={13} className="text-amber-700" />
              <span>เหตุผลในการแก้ไขผลตรวจ <span className="text-rose-600 font-bold">*</span></span>
            </label>
            <textarea
              required
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="ระบุเหตุผลในการแก้ไข เช่น ปรับคะแนนข้อความสะอาดตู้เย็นเนื่องจากตรวจสอบภาพถ่ายเพิ่มเติม..."
              className="w-full text-xs p-3 rounded-xl bg-white border border-amber-300 focus:outline-none focus:ring-2 focus:ring-[#0F6659] text-slate-800 placeholder-slate-400 transition-all font-sans"
            />
          </div>

          {/* Quick Meta Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1">
              <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                <Users size={12} className="text-slate-400" />
                <span>จำนวนพนักงานขณะตรวจ (คน)</span>
              </label>
              <input
                type="number"
                min={0}
                value={staffCount}
                onChange={(e) => setStaffCount(e.target.value)}
                className="w-full text-xs p-2 rounded-lg bg-white border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#0F6659] font-bold text-slate-800"
              />
            </div>
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1">
              <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                <FileText size={12} className="text-slate-400" />
                <span>หมายเหตุภาพรวมการตรวจ</span>
              </label>
              <input
                type="text"
                value={generalNotes}
                onChange={(e) => setGeneralNotes(e.target.value)}
                placeholder="ระบุหมายเหตุเพิ่มเติม (ถ้ามี)"
                className="w-full text-xs p-2 rounded-lg bg-white border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#0F6659] text-slate-800"
              />
            </div>
          </div>

          {/* Questions Checklist */}
          <div className="space-y-3">
            <div className="text-xs font-extrabold text-slate-700 flex items-center justify-between border-b border-slate-100 pb-2">
              <span>รายการคำตอบข้อตรวจประเมิน</span>
              <span className="text-[11px] text-slate-400 font-medium">ปรับคำตอบได้ทีละข้อ</span>
            </div>

            <div className="space-y-3">
              {(record?.responses || []).map((res, idx) => {
                const itemId = res.surveyItemId || res.surveyItem?.id;
                const state = answersState[itemId];
                if (!state) return null;

                const qText = res.questionText || res.surveyItem?.questionText || `ข้อตรวจที่ ${idx + 1}`;
                const isCrit = res.isCritical !== undefined ? res.isCritical : res.surveyItem?.isCritical;

                const isEdited = isQuestionEdited(itemId);
                const isNoteMissing = isEdited && (!state.notes || !state.notes.trim());
                const shouldShowNote = isEdited || !!expandedNotes[itemId] || !!(state.notes && state.notes.trim());

                return (
                  <div 
                    key={itemId || idx}
                    className={`p-3.5 sm:p-4 rounded-2xl border transition-all shadow-2xs space-y-3 ${
                      isNoteMissing
                        ? 'border-rose-300 bg-rose-50/15 ring-1 ring-rose-400/20'
                        : isEdited 
                        ? 'border-[#0F6659]/60 bg-emerald-50/25 ring-1 ring-[#0F6659]/20' 
                        : 'border-slate-200/80 bg-white hover:border-slate-300'
                    }`}
                  >
                    {/* 🌟 1. แถวบนสุด: เลขข้อทางซ้าย / ปุ่มเปิดปิดคอมเม้นทางขวา */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-mono text-xs font-bold border border-slate-200/60 shadow-2xs">
                          #{idx + 1}
                        </span>
                        {isCrit && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-50 text-rose-600 border border-rose-200">
                            Critical
                          </span>
                        )}
                        {isEdited && (
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                            isNoteMissing 
                              ? 'bg-rose-50 text-rose-700 border-rose-200' 
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}>
                            {isNoteMissing ? "แก้ไขแล้ว (รอใส่เหตุผล)" : "มีการแก้ไข"}
                          </span>
                        )}
                      </div>

                      {/* ปุ่มเปิดปิดคอมเมนต์ทางขวา */}
                      <button
                        type="button"
                        onClick={() => toggleExpandNote(itemId)}
                        className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border active:scale-95 ${
                          isNoteMissing
                            ? 'bg-rose-50 text-rose-700 border-rose-300'
                            : shouldShowNote
                            ? 'bg-[#0F6659] text-white border-[#0F6659] shadow-2xs'
                            : 'bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-[#0F6659] border-slate-200'
                        }`}
                        title={shouldShowNote ? "ปิดแถบคอมเมนต์" : "เปิดแถบคอมเมนต์"}
                      >
                        <MessageSquare size={13} />
                        <span>
                          {isNoteMissing ? "ต้องใส่เหตุผล *" : (shouldShowNote ? "ปิดคอมเมนต์" : (state.notes ? "ดูคอมเมนต์" : "คอมเมนต์"))}
                        </span>
                        {state.notes && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                        )}
                      </button>
                    </div>

                    {/* 🌟 2. ต่อมา: คำถามของข้อจะเรียงยาวจากซ้ายไปขวา */}
                    <div className="text-xs sm:text-sm font-bold text-slate-800 leading-relaxed">
                      {qText}
                    </div>

                    {/* 🌟 3. ลงมาล่างอีก: คำตอบเอาไว้สำหรับแก้ */}
                    <div>
                      {state.type === "scale" ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {[1, 2, 3, 4, 5].map((num) => (
                            <button
                              key={num}
                              type="button"
                              onClick={() => handleSetScale(itemId, num)}
                              className={`flex-1 min-w-[42px] py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                                state.scaleScore === num
                                  ? 'bg-[#0F6659] text-white border-[#0F6659] shadow-2xs'
                                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {num}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                          <button
                            type="button"
                            onClick={() => handleToggleYesNo(itemId, "yes")}
                            className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 border ${
                              !state.isNa && state.isPassed
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs ring-2 ring-emerald-600/20'
                                : 'bg-slate-50 hover:bg-emerald-50 text-slate-700 border-slate-200 hover:border-emerald-200'
                            }`}
                          >
                            <CheckCircle2 size={14} />
                            <span>ผ่าน</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleYesNo(itemId, "no")}
                            className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 border ${
                              !state.isNa && !state.isPassed
                                ? 'bg-rose-600 text-white border-rose-600 shadow-2xs ring-2 ring-rose-600/20'
                                : 'bg-slate-50 hover:bg-rose-50 text-slate-700 border-slate-200 hover:border-rose-200'
                            }`}
                          >
                            <XCircle size={14} />
                            <span>ตก</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleYesNo(itemId, "na")}
                            className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 border ${
                              state.isNa
                                ? 'bg-slate-700 text-white border-slate-700 shadow-2xs ring-2 ring-slate-700/20'
                                : 'bg-slate-50 hover:bg-slate-100 text-slate-500 border-slate-200'
                            }`}
                            title="ไม่ประเมิน / ยกเว้นข้อนี้"
                          >
                            <MinusCircle size={14} />
                            <span>N/A</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* 🌟 4. ถ้ามีกดปุ่มคอมเม้นจะแสดงแถบล่างมาให้ใส่คอมเม้นเพิ่ม (เด้งขึ้นมาอัตโนมัติเมื่อแก้) */}
                    {shouldShowNote && (
                      <div className="pt-2 animate-in fade-in slide-in-from-top-1 duration-150 border-t border-slate-100 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                            <MessageSquare size={12} className={isEdited ? "text-amber-600" : "text-[#0F6659]"} />
                            <span>{isEdited ? "ระบุเหตุผล / หมายเหตุในการแก้ไขข้อนี้:" : "คอมเมนต์ / หมายเหตุสำหรับข้อนี้:"}</span>
                            {isEdited && (
                              <span className="text-rose-600 font-extrabold text-[11px]">* (จำเป็น)</span>
                            )}
                          </div>
                          {isNoteMissing && (
                            <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 animate-pulse">
                              บังคับระบุก่อนบันทึก
                            </span>
                          )}
                        </div>
                        <input
                          id={`note-input-${itemId}`}
                          type="text"
                          value={state.notes || ""}
                          onChange={(e) => handleNoteChange(itemId, e.target.value)}
                          placeholder={isEdited ? "พิมพ์เหตุผลที่แก้ไขข้อนี้ (จำเป็นต้องระบุ)..." : "พิมพ์หมายเหตุเพิ่มเติมสำหรับข้อนี้..."}
                          className={`w-full text-xs px-3.5 py-2.5 rounded-xl border font-sans outline-none transition-all shadow-2xs ${
                            isNoteMissing
                              ? 'border-rose-400 bg-rose-50/20 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 text-slate-800 placeholder:text-rose-400'
                              : 'border-emerald-300 bg-white focus:border-[#0F6659] focus:ring-2 focus:ring-[#0F6659]/20 text-slate-800 placeholder:text-slate-400'
                          }`}
                          autoFocus={isEdited}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </form>

        {/* Footer Buttons */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200/80 cursor-pointer active:scale-95 transition-all"
          >
            ยกเลิก
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !reason.trim()}
            className="px-5 py-2 rounded-xl bg-[#0F6659] hover:bg-[#0c5247] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>กำลังบันทึก...</span>
              </>
            ) : (
              <>
                <Save size={14} />
                <span>บันทึกการแก้ไข</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modalContent, document.body) : null;
}

