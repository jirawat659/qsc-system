import React, { useState, useMemo, useContext, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Edit3, CheckCircle2, XCircle, MinusCircle, AlertTriangle, Save, Loader2, ArrowRight, MessageSquare, Users, FileText, Thermometer, Calendar, Clock, SlidersHorizontal, ChevronDown } from "lucide-react";
import api from "../config/api";
import { mono } from "../config/theme";
import { DataContext } from "../context/DataContext";

export default function EditAuditRecordModal({ isOpen, onClose, record, onSaveSuccess }) {
  const { forms = [] } = useContext(DataContext) || {};
  const [currentRecord, setCurrentRecord] = useState(record);
  const [fetchedFormConfig, setFetchedFormConfig] = useState(null);
  const [reason, setReason] = useState("");
  const [staffCount, setStaffCount] = useState(record?.staffCount || 0);
  const [generalNotes, setGeneralNotes] = useState(record?.notes || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Sync record prop to currentRecord
  useEffect(() => {
    setCurrentRecord(record);
  }, [record]);

  // When modal opens, fetch latest record from API to ensure fresh answers
  useEffect(() => {
    if (!isOpen || !record?.id) return;
    api.get(`/audit/${record.id}`)
      .then(res => {
        if (res.data) {
          setCurrentRecord(res.data);
        }
      })
      .catch(() => {});
  }, [isOpen, record?.id]);

  // Load and resolve form metadataConfig
  useEffect(() => {
    if (currentRecord?.surveyForm?.metadataConfig || currentRecord?.surveyForm?.metadataConfigJson) return;
    const matched = forms.find(f => f.id === currentRecord?.surveyFormId);
    if (matched?.metadataConfig || matched?.metadataConfigJson) return;

    if (currentRecord?.surveyFormId) {
      api.get(`/form/${currentRecord.surveyFormId}`)
        .then(res => {
          if (res.data?.metadataConfig) {
            setFetchedFormConfig(res.data.metadataConfig);
          } else if (res.data?.metadataConfigJson) {
            try {
              setFetchedFormConfig(JSON.parse(res.data.metadataConfigJson));
            } catch (e) {}
          }
        })
        .catch(() => {});
    }
  }, [currentRecord?.surveyFormId, currentRecord?.surveyForm, forms]);

  const formMetaFields = useMemo(() => {
    const direct = currentRecord?.surveyForm?.metadataConfig;
    if (Array.isArray(direct) && direct.length > 0) return direct;

    if (currentRecord?.surveyForm?.metadataConfigJson) {
      try {
        const parsed = JSON.parse(currentRecord.surveyForm.metadataConfigJson);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }

    const fromContext = forms.find(f => f.id === currentRecord?.surveyFormId);
    if (Array.isArray(fromContext?.metadataConfig) && fromContext.metadataConfig.length > 0) {
      return fromContext.metadataConfig;
    }
    if (fromContext?.metadataConfigJson) {
      try {
        const parsed = JSON.parse(fromContext.metadataConfigJson);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }

    if (Array.isArray(fetchedFormConfig) && fetchedFormConfig.length > 0) {
      return fetchedFormConfig;
    }

    return null;
  }, [currentRecord, forms, fetchedFormConfig]);

  const [metadataValues, setMetadataValues] = useState(() => {
    let initial = {};
    if (record?.metadataValues && typeof record.metadataValues === "object") {
      initial = { ...record.metadataValues };
    } else if (record?.metadataValuesJson) {
      try {
        const parsed = JSON.parse(record.metadataValuesJson);
        if (parsed && typeof parsed === "object") initial = { ...parsed };
      } catch (e) {}
    }

    if (initial.staff_count === undefined && record?.staffCount) {
      initial.staff_count = record.staffCount;
    }
    return initial;
  });

  useEffect(() => {
    if (!currentRecord) return;
    let initial = {};
    if (currentRecord.metadataValues && typeof currentRecord.metadataValues === "object") {
      initial = { ...currentRecord.metadataValues };
    } else if (currentRecord.metadataValuesJson) {
      try {
        const parsed = JSON.parse(currentRecord.metadataValuesJson);
        if (parsed && typeof parsed === "object") initial = { ...parsed };
      } catch (e) {}
    }
    if (initial.staff_count === undefined && currentRecord.staffCount) {
      initial.staff_count = currentRecord.staffCount;
    }
    setMetadataValues(initial);
  }, [currentRecord]);

  const handleMetaValueChange = (fieldId, val) => {
    setMetadataValues(prev => ({ ...prev, [fieldId]: val }));
    if (fieldId === "staff_count" || fieldId === "staffCount") {
      setStaffCount(Number(val) || 0);
    }
  };

  // Match form schema from DataContext or currentRecord
  const matchedForm = useMemo(() => {
    return (forms || []).find(f => 
      (currentRecord?.surveyFormId && (f.id === currentRecord.surveyFormId || String(f.id) === String(currentRecord.surveyFormId))) ||
      (currentRecord?.formId && (f.id === currentRecord.formId || String(f.id) === String(currentRecord.formId))) ||
      (f.title && (f.title === currentRecord?.surveyFormTitle || f.title === currentRecord?.formName || f.title === currentRecord?.form))
    );
  }, [forms, currentRecord]);

  // Build complete questions list matching responses
  const checklistQuestions = useMemo(() => {
    if (!currentRecord) return [];

    const resList = currentRecord.responses || [];

    // 1. If form schema has sections & items, match questions through form
    if (matchedForm?.sections && Array.isArray(matchedForm.sections) && matchedForm.sections.length > 0) {
      const itemsList = [];
      let runningNum = 1;

      matchedForm.sections.forEach((sec) => {
        (sec.items || []).forEach((item) => {
          let res = resList.find(r => 
            (r.surveyItemId && Number(r.surveyItemId) === Number(item.id)) ||
            (r.surveyItem?.id && Number(r.surveyItem.id) === Number(item.id)) ||
            (r.questionText && item.questionText && r.questionText.trim().toLowerCase() === item.questionText.trim().toLowerCase()) ||
            (r.questionText && item.text && r.questionText.trim().toLowerCase() === item.text.trim().toLowerCase()) ||
            (r.surveyItem?.questionText && item.questionText && r.surveyItem.questionText.trim().toLowerCase() === item.questionText.trim().toLowerCase()) ||
            (r.surveyItem?.questionText && item.text && r.surveyItem.questionText.trim().toLowerCase() === item.text.trim().toLowerCase())
          );

          if (!res && resList[runningNum - 1]) {
            res = resList[runningNum - 1];
          }
          res = res || {};

          const itemId = item.id || res.surveyItemId || res.surveyItem?.id || `item_${runningNum}`;
          const qText = item.questionText || item.text || res.questionText || res.surveyItem?.questionText || `ข้อตรวจที่ ${runningNum}`;
          const qType = (res.questionType || res.surveyItem?.questionType || item.questionType || item.type || "yesno").toLowerCase();
          const fullScore = Number(res.fullScore !== undefined ? res.fullScore : (res.surveyItem?.fullScore || item.fullScore || 10));
          const isCrit = res.isCritical !== undefined ? res.isCritical : (res.surveyItem?.isCritical || item.isCritical || item.critical || false);

          itemsList.push({
            runningNum: runningNum++,
            surveyItemId: itemId,
            questionText: qText,
            questionType: qType,
            fullScore: fullScore,
            isCritical: isCrit,
            originalRes: res
          });
        });
      });

      if (itemsList.length > 0) return itemsList;
    }

    // 2. Otherwise map responses directly from currentRecord
    return resList.map((res, idx) => {
      const itemId = res.surveyItemId || res.id || `item_${idx + 1}`;
      const qText = res.questionText || res.surveyItem?.questionText || `ข้อตรวจที่ ${idx + 1}`;
      const qType = (res.questionType || res.surveyItem?.questionType || "yesno").toLowerCase();
      const fullScore = Number(res.fullScore !== undefined ? res.fullScore : (res.surveyItem?.fullScore || 10));
      const isCrit = res.isCritical !== undefined ? res.isCritical : (res.surveyItem?.isCritical || false);

      return {
        runningNum: idx + 1,
        surveyItemId: itemId,
        questionText: qText,
        questionType: qType,
        fullScore: fullScore,
        isCritical: isCrit,
        originalRes: res
      };
    });
  }, [currentRecord, matchedForm]);

  // Helper to parse answer status accurately from response
  const parseResponseAnswer = (q) => {
    const res = q.originalRes || {};
    const qType = (q.questionType || "yesno").toLowerCase();
    const fullScore = Number(q.fullScore || 10);

    // Is N/A
    const isNa = res.isNa === true || res.isNa === 1 || res.isNa === "true" || res.rawAnswer === "na" || res.answerValue === "na";

    // Is Passed
    let isPassed = true;
    if (isNa) {
      isPassed = false;
    } else if (res.isPassed !== undefined && res.isPassed !== null) {
      isPassed = res.isPassed === true || res.isPassed === 1 || res.isPassed === "true" || res.isPassed === "yes";
    } else if (res.rawAnswer !== undefined && res.rawAnswer !== null) {
      isPassed = res.rawAnswer === "yes" || res.rawAnswer === true || res.rawAnswer === 1 || res.rawAnswer === "1";
    } else if (res.scoreGiven !== undefined && res.scoreGiven !== null) {
      isPassed = Number(res.scoreGiven) > 0;
    } else if (res.id || res.surveyItemId) {
      isPassed = Number(res.scoreGiven || 0) > 0;
    } else {
      isPassed = true;
    }

    // Scale Score (1 to 5)
    let scaleScore = null;
    if (qType === "scale") {
      if (res.scaleScore !== undefined && res.scaleScore !== null) {
        scaleScore = Number(res.scaleScore);
      } else if (res.rawAnswer && !isNaN(Number(res.rawAnswer))) {
        scaleScore = Math.max(1, Math.min(5, Number(res.rawAnswer)));
      } else if (res.scoreGiven !== undefined && res.scoreGiven !== null) {
        scaleScore = Math.max(1, Math.min(5, Math.round((Number(res.scoreGiven) / fullScore) * 5)));
      } else {
        scaleScore = isPassed ? 5 : 2;
      }
    }

    // Score Given
    let scoreGiven = 0;
    if (isNa) {
      scoreGiven = 0;
    } else if (qType === "scale") {
      scoreGiven = ((scaleScore || 5) / 5) * fullScore;
    } else {
      scoreGiven = isPassed ? fullScore : 0;
    }

    return {
      surveyItemId: q.surveyItemId,
      isNa,
      isPassed,
      scoreGiven,
      fullScore,
      type: qType,
      scaleScore,
      notes: res.notes || "",
      imageUrls: (res.images || []).map(img => img.imageUrl || img)
    };
  };

  const buildInitialState = () => {
    const map = {};
    checklistQuestions.forEach(q => {
      map[q.surveyItemId] = parseResponseAnswer(q);
    });
    return map;
  };

  // State
  const [answersState, setAnswersState] = useState(buildInitialState);
  const [initialAnswers, setInitialAnswers] = useState(buildInitialState);
  const [expandedNotes, setExpandedNotes] = useState({});

  // 🔄 Sync state whenever modal opens, currentRecord changes, or questions change
  useEffect(() => {
    if (!isOpen || !currentRecord) return;
    const initialMap = {};
    checklistQuestions.forEach(q => {
      initialMap[q.surveyItemId] = parseResponseAnswer(q);
    });
    setAnswersState(initialMap);
    setInitialAnswers(initialMap);
    setReason("");
    setGeneralNotes(currentRecord?.notes || "");
    setStaffCount(currentRecord?.staffCount || 0);
    setExpandedNotes({});
    setError(null);
  }, [isOpen, currentRecord?.id, checklistQuestions]);

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

  // Calculate live preview score
  const liveScoring = useMemo(() => {
    let earned = 0;
    let max = 0;
    let hasCritFail = false;

    checklistQuestions.forEach((q) => {
      const state = answersState[q.surveyItemId];
      if (!state) return;

      const full = state.fullScore || 10;
      if (state.isNa) {
        // N/A: excluded from total
        return;
      }

      max += full;
      if (state.type === "scale") {
        const sc = ((state.scaleScore || 5) / 5) * full;
        earned += sc;
      } else {
        if (state.isPassed) earned += full;
      }

      if (q.isCritical && !state.isPassed && !state.isNa) {
        hasCritFail = true;
      }
    });

    const percent = max > 0 ? Math.round((earned / max) * 100) : 0;
    const isPassed = percent >= (currentRecord?.surveyForm?.passingScore || 85) && !hasCritFail;

    return { earned, max, percent, isPassed, hasCritFail };
  }, [answersState, checklistQuestions, currentRecord]);

  if (!isOpen || !currentRecord) return null;

  const originalScore = typeof currentRecord.score === "number" ? currentRecord.score : typeof currentRecord.percentageScore === "number" ? Math.round(currentRecord.percentageScore) : 0;

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
    const invalidEditedItems = checklistQuestions.filter((q) => {
      const itemId = q.surveyItemId;
      if (!isQuestionEdited(itemId)) return false;
      const note = answersState[itemId]?.notes?.trim();
      return !note;
    });

    if (invalidEditedItems.length > 0) {
      // บังคับเปิดแถบคอมเมนต์ของทุกข้อที่ยังไม่ได้ระบุ
      setExpandedNotes((prev) => {
        const next = { ...prev };
        invalidEditedItems.forEach((q) => {
          next[q.surveyItemId] = true;
        });
        return next;
      });

      setError(`กรุณาระบุคอมเมนต์สำหรับทุกข้อที่มีการแก้ไข (${invalidEditedItems.length} ข้อที่ยังไม่ได้ระบุ) ก่อนบันทึก`);

      // เลื่อนจอไปโฟกัสข้อแรกที่ยังไม่ระบุคอมเมนต์
      const firstInvalidId = invalidEditedItems[0].surveyItemId;
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
      const payloadResponses = checklistQuestions.map((q) => {
        const s = answersState[q.surveyItemId] || parseResponseAnswer(q);
        return {
          surveyItemId: Number(q.surveyItemId) || q.originalRes?.surveyItemId || 0,
          scoreGiven: s.scoreGiven,
          isPassed: s.isPassed,
          isNa: s.isNa,
          rawAnswer: s.isNa ? "na" : (s.type === "scale" ? String(s.scaleScore) : (s.isPassed ? "yes" : "no")),
          notes: s.notes || null,
          imageUrls: s.imageUrls || []
        };
      });

      const payload = {
        reason: reason.trim(),
        auditeeUserId: currentRecord.auditeeUserId || null,
        auditeeNameText: currentRecord.auditeeNameText || currentRecord.auditeeName || null,
        staffCount: Number(metadataValues.staff_count ?? staffCount) || 0,
        auditType: metadataValues.audit_type || currentRecord.auditType || "announced",
        notes: generalNotes || null,
        metadataValuesJson: JSON.stringify(metadataValues),
        responses: payloadResponses
      };

      const res = await api.put(`/audit/${currentRecord.id}`, payload);
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

            {/* 🌟 คะแนนเก่า / ใหม่ แสดงบนแถบบนขวา (เปลี่ยนเป็นสีเหลืองถ้าตก) */}
            <div className="flex items-center gap-2 shrink-0">
              <div 
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl shadow-2xs text-xs font-bold transition-all border ${
                  liveScoring.isPassed
                    ? 'bg-[#0F6659] text-white border-emerald-700/50'
                    : 'bg-amber-500 text-amber-950 border-amber-600/40 shadow-amber-500/20'
                }`}
                style={{ fontFamily: mono }}
              >
                <span className={`line-through text-[11px] ${liveScoring.isPassed ? 'opacity-70 text-emerald-100' : 'opacity-75 text-amber-900'}`}>
                  {originalScore}%
                </span>
                <ArrowRight size={12} className={liveScoring.isPassed ? "text-emerald-300 shrink-0" : "text-amber-900 shrink-0"} />
                <span className={`text-[10px] sm:text-sm font-black ${liveScoring.isPassed ? 'text-emerald-200' : 'text-slate-900'}`}>
                  {liveScoring.percent}%
                </span>
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
              {currentRecord?.location?.name || currentRecord?.locationName || "สาขา"} · ID: #{currentRecord?.id}
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
              placeholder="ระบุเหตุผลในการแก้ไข เช่น ปรับคะแนนข้อความสะอาดตู้เย็นเนื่องจากภาพถ่ายเพิ่มเติม..."
              className="w-full text-xs p-3 rounded-xl bg-white border border-amber-300 focus:outline-none focus:ring-2 focus:ring-[#0F6659] text-slate-800 placeholder-slate-400 transition-all font-sans"
            />
          </div>

          {/* 🌟 Form Metadata Details Fields (ดึงมาจากแบบฟอร์ม: ตัวเลข, อุณหภูมิ, ปฏิทิน, คำอธิบาย ฯลฯ) */}
          <div className="space-y-2">
            <div className="text-xs font-extrabold text-slate-700 flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="flex items-center gap-1.5">
                <span>ข้อมูลและรายละเอียดการตรวจ (Audit Form Details)</span>
              </span>
              <span className="text-[11px] text-slate-400 font-medium">ตามที่กำหนดในแบบฟอร์ม</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {formMetaFields && formMetaFields.filter(f => f.enabled !== false && f.type !== 'auditor').length > 0 ? (
                formMetaFields
                  .filter(f => f.enabled !== false && f.type !== 'auditor')
                  .map((field) => {
                    const val = metadataValues[field.id] ?? (field.id === 'staff_count' ? staffCount : '');
                    const isTemp = field.unit?.includes('°') || field.label?.includes('อุณหภูมิ');

                    if (field.type === 'number') {
                      return (
                        <div key={field.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1">
                          <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                            {isTemp ? <Thermometer size={13} className="text-amber-500" /> : <Users size={13} className="text-slate-500" />}
                            <span>{field.label} {field.unit ? `(${field.unit})` : ''}</span>
                            {field.required && <span className="text-rose-500">*</span>}
                          </label>
                          <div className="relative flex items-center">
                            <input
                              type="number"
                              min={field.min !== undefined ? field.min : -50}
                              max={field.max !== undefined ? field.max : 999999}
                              value={val}
                              onChange={(e) => handleMetaValueChange(field.id, e.target.value)}
                              placeholder={field.placeholder || `ระบุ${field.label}`}
                              className="w-full text-xs p-2 pr-12 rounded-lg bg-white border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#0F6659] font-bold text-slate-800"
                            />
                            {field.unit && (
                              <span className="absolute right-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 select-none border border-slate-200">
                                {field.unit}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    }

                    if (field.type === 'date') {
                      return (
                        <div key={field.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1">
                          <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                            <Calendar size={13} className="text-emerald-600" />
                            <span>{field.label}</span>
                            {field.required && <span className="text-rose-500">*</span>}
                          </label>
                          <input
                            type="date"
                            value={val}
                            onChange={(e) => handleMetaValueChange(field.id, e.target.value)}
                            className="w-full text-xs p-2 rounded-lg bg-white border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#0F6659] font-bold text-slate-800"
                          />
                        </div>
                      );
                    }

                    if (field.type === 'time') {
                      return (
                        <div key={field.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1">
                          <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                            <Clock size={13} className="text-emerald-600" />
                            <span>{field.label}</span>
                            {field.required && <span className="text-rose-500">*</span>}
                          </label>
                          <input
                            type="time"
                            value={val}
                            onChange={(e) => handleMetaValueChange(field.id, e.target.value)}
                            className="w-full text-xs p-2 rounded-lg bg-white border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#0F6659] font-bold text-slate-800"
                          />
                        </div>
                      );
                    }

                    if (field.type === 'select') {
                      return (
                        <div key={field.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1">
                          <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                            <SlidersHorizontal size={13} className="text-slate-500" />
                            <span>{field.label}</span>
                            {field.required && <span className="text-rose-500">*</span>}
                          </label>
                          <div className="relative">
                            <select
                              value={val}
                              onChange={(e) => handleMetaValueChange(field.id, e.target.value)}
                              className="w-full text-xs sm:text-sm pl-4 pr-10 py-3 min-h-[50px] rounded-2xl bg-slate-50 border border-slate-200 outline-none font-semibold text-slate-700 focus:border-[#0F6659] focus:bg-white transition-all shadow-xs cursor-pointer appearance-none truncate"
                            >
                              <option value="">-- เลือก --</option>
                              {(field.options || []).map((opt, i) => (
                                <option key={i} value={opt}>{opt}</option>
                              ))}
                            </select>
                            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                              <ChevronDown size={18} />
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // Default text / textarea
                    return (
                      <div key={field.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1">
                        <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                          <FileText size={13} className="text-slate-400" />
                          <span>{field.label}</span>
                          {field.required && <span className="text-rose-500">*</span>}
                        </label>
                        <input
                          type="text"
                          value={val}
                          onChange={(e) => handleMetaValueChange(field.id, e.target.value)}
                          placeholder={field.placeholder || `ระบุ${field.label}`}
                          className="w-full text-xs p-2 rounded-lg bg-white border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#0F6659] text-slate-800 font-medium"
                        />
                      </div>
                    );
                  })
              ) : (
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                    <Users size={12} className="text-slate-400" />
                    <span>จำนวนพนักงานขณะตรวจ (คน)</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={staffCount}
                    onChange={(e) => {
                      setStaffCount(e.target.value);
                      handleMetaValueChange('staff_count', e.target.value);
                    }}
                    className="w-full text-xs p-2 rounded-lg bg-white border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#0F6659] font-bold text-slate-800"
                  />
                </div>
              )}

              {/* หมายเหตุภาพรวมการตรวจ */}
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1 sm:col-span-2">
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
          </div>

          {/* Questions Checklist */}
          <div className="space-y-3">
            <div className="text-xs font-extrabold text-slate-700 flex items-center justify-between border-b border-slate-100 pb-2">
              <span>รายการคำตอบข้อตรวจประเมิน</span>
              <span className="text-[11px] text-slate-400 font-medium">ปรับคำตอบได้ทีละข้อ</span>
            </div>

            <div className="space-y-3">
              {checklistQuestions.map((q, idx) => {
                const itemId = q.surveyItemId;
                const state = answersState[itemId] || parseResponseAnswer(q);
                const qText = q.questionText;
                const isCrit = q.isCritical;

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
                            <span>{isEdited ? "เหตุผล " : "คอมเมนต์ "}</span>
                            {isEdited && (
                              <span className="text-rose-600 font-extrabold text-[11px]">* (จำเป็น)</span>
                            )}
                          </div>
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
            className="px-4 py-2 rounded-2xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200/80 cursor-pointer active:scale-95 transition-all"
          >
            ยกเลิก
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !reason.trim()}
            className="px-5 py-2 rounded-2xl bg-[#0F6659] hover:bg-[#0c5247] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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

