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
    setExpandedNotes(prev => ({ ...prev, [itemId]: !prev[itemId] }));
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
      setError("กรุณาระบุเหตุผลในการแก้ไขบันทึกผลตรวจ");
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
          {/* Top Row: Icon + Title + Close Button */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-emerald-100/80 border border-emerald-300/70 flex items-center justify-center text-[#0F6659] shadow-2xs shrink-0">
                <Edit3 size={16} />
              </div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-800 leading-tight truncate">
                แก้ไขบันทึกผลการตรวจ
              </h3>
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

          {/* Sub Row: Details (Branch Name + Record ID) */}
          <div className="pl-10.5">
            <p className="text-xs text-slate-500 font-medium truncate">
              {record?.location?.name || record?.locationName || "สาขา"} · ID: #{record.id}
            </p>
          </div>
        </div>

        {/* Live Score Sticky Bar */}
        <div className="px-5 py-3 bg-[#0F6659] text-white flex items-center justify-between gap-3 shrink-0 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className="opacity-80">คะแนนจำลอง (Live Preview):</span>
            <div className="flex items-center gap-1.5 font-bold" style={{ fontFamily: mono }}>
              <span className="opacity-60 line-through text-xs">{originalScore}%</span>
              <ArrowRight size={13} className="opacity-70" />
              <span className="text-sm sm:text-base font-black text-emerald-200">{liveScoring.percent}%</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${liveScoring.isPassed ? 'bg-emerald-400/20 text-emerald-100 border border-emerald-400/40' : 'bg-rose-400/20 text-rose-100 border border-rose-400/40'}`}>
              {liveScoring.isPassed ? "✓ ผ่านเกณฑ์" : "⚠️ ปรับปรุง"}
            </span>
            {liveScoring.hasCritFail && (
              <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-500 text-white animate-pulse">
                Critical ตก
              </span>
            )}
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
              <span>เหตุผลในการแก้ไขผลตรวจ <span className="text-rose-600 font-bold">* (จำเป็นต้องระบุ)</span></span>
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
                const shouldShowNote = isEdited || !!expandedNotes[itemId] || !!(state.notes && state.notes.trim());

                return (
                  <div 
                    key={itemId || idx}
                    className={`p-3.5 rounded-2xl border transition-all shadow-2xs space-y-2.5 ${
                      isEdited 
                        ? 'border-[#0F6659]/60 bg-emerald-50/25 ring-1 ring-[#0F6659]/20' 
                        : 'border-slate-200/80 bg-white hover:border-slate-300'
                    }`}
                  >
                    {/* 🌟 เอารวมเป็นแถบเดียวกัน: เลขข้อ + คำถาม + ปุ่มตัวเลือก */}
                    <div className="flex items-start sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-2.5 flex-1 min-w-0">
                        <span className="shrink-0 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono text-xs font-bold mt-0.5 sm:mt-0">
                          #{idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className="text-xs sm:text-sm font-bold text-slate-800 leading-snug">
                            {qText}
                          </span>
                          {isCrit && (
                            <span className="ml-2 inline-block px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-rose-50 text-rose-600 border border-rose-200 align-middle">
                              Critical
                            </span>
                          )}
                          {isEdited && (
                            <span className="ml-2 inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 align-middle">
                              มีการแก้ไข
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Pill Toggles */}
                      <div className="flex items-center gap-1 shrink-0">
                        {state.type === "scale" ? (
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((num) => (
                              <button
                                key={num}
                                type="button"
                                onClick={() => handleSetScale(itemId, num)}
                                className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                  state.scaleScore === num
                                    ? 'bg-[#0F6659] text-white shadow-2xs'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                                }`}
                              >
                                {num}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleToggleYesNo(itemId, "yes")}
                              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95 ${
                                !state.isNa && state.isPassed
                                  ? 'bg-emerald-600 text-white shadow-2xs'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                              }`}
                            >
                              <CheckCircle2 size={13} />
                              <span>ผ่าน</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleYesNo(itemId, "no")}
                              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95 ${
                                !state.isNa && !state.isPassed
                                  ? 'bg-rose-600 text-white shadow-2xs'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                              }`}
                            >
                              <XCircle size={13} />
                              <span>ตก</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleYesNo(itemId, "na")}
                              className={`px-2 py-1.5 rounded-xl text-xs font-bold flex items-center gap-0.5 cursor-pointer transition-all active:scale-95 ${
                                state.isNa
                                  ? 'bg-slate-700 text-white shadow-2xs'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-400'
                              }`}
                              title="ไม่ประเมิน / ยกเว้นข้อนี้"
                            >
                              <MinusCircle size={13} />
                              <span>N/A</span>
                            </button>
                          </>
                        )}

                        {/* Optional button to add note manually if not edited */}
                        {!isEdited && !shouldShowNote && (
                          <button
                            type="button"
                            onClick={() => toggleExpandNote(itemId)}
                            className="w-7 h-7 rounded-lg text-slate-400 hover:text-[#0F6659] hover:bg-emerald-50 flex items-center justify-center transition-colors cursor-pointer"
                            title="เพิ่มหมายเหตุสำหรับข้อนี้"
                          >
                            <MessageSquare size={13} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 🌟 ถ้ามีการแก้ จะขึ้นช่องมาให้คอมเม้นอัตโนมัติ */}
                    {shouldShowNote && (
                      <div className="pt-1 animate-in fade-in slide-in-from-top-1 duration-150">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 mb-1">
                          <MessageSquare size={12} className="text-[#0F6659]" />
                          <span>
                            {isEdited ? "ระบุเหตุผล/หมายเหตุในการแก้ไขข้อนี้:" : "หมายเหตุสำหรับข้อนี้:"}
                          </span>
                        </div>
                        <input
                          type="text"
                          value={state.notes || ""}
                          onChange={(e) => handleNoteChange(itemId, e.target.value)}
                          placeholder="พิมพ์หมายเหตุเพิ่มเติมสำหรับข้อนี้ (ถ้ามี)..."
                          className="w-full text-xs px-3.5 py-2 rounded-xl border border-emerald-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6659] text-slate-800 placeholder:text-slate-400 shadow-2xs font-sans"
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

