import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  FileText, Plus, Trash2, Edit3, GripVertical, Check, X,
  AlertTriangle, ShieldAlert, Sparkles, ChevronDown, ChevronUp,
  Layers, CheckCircle2, ArrowUpDown, Info, Tag, SlidersHorizontal, Loader2
} from "lucide-react";

import { c, sans, mono, cardStyle } from "../../config/theme";
import Header from "../../shared/Header";
import Section from "../../shared/Section";
import ModalWrapper from "../../shared/ModalWrapper";
import api from "../../config/api";

export default function FormEditorScreen({ form, onBack, onSave }) {
  const [formName, setFormName] = useState(form ? (form.name || form.title) : "แบบฟอร์มมาตรฐานใหม่");
  const [formType, setFormType] = useState(form ? (form.type || form.locationTypeName || "สาขาหน้าร้าน") : "สาขาหน้าร้าน");
  const [locationTypeId, setLocationTypeId] = useState(form?.locationTypeId || 1);
  const [locationTypes, setLocationTypes] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [description, setDescription] = useState(
    form?.description || "แบบฟอร์มตรวจสอบมาตรฐานคุณภาพ การบริการ และสุขอนามัยประจำสาขา (Q.S.C. Standard)"
  );
  const [passingScore, setPassingScore] = useState(form ? form.passingScore : 85);

  useEffect(() => {
    let isMounted = true;
    api.get('/location-type')
      .then(res => {
        if (isMounted && res.data && Array.isArray(res.data)) {
          setLocationTypes(res.data);
          if (!form?.locationTypeId && res.data.length > 0) {
            setLocationTypeId(res.data[0].id);
            setFormType(res.data[0].name || res.data[0].code);
          }
        }
      })
      .catch(err => {
        console.warn("Could not load location types:", err);
      });
    return () => { isMounted = false; };
  }, [form]);

  const [sections, setSections] = useState(() => {
    if (form?.sections && form.sections.length > 0) {
      return form.sections.map(s => ({
        id: s.id,
        title: s.title,
        orderIndex: s.orderIndex,
        weightPercent: s.weightPercent || 0,
        items: (s.items || []).map(i => ({
          id: i.id || ("q_" + Math.random().toString(36).substr(2, 9)),
          text: i.questionText || i.text || i.title || "",
          type: (i.questionType || i.type || "yesno").toLowerCase(),
          fullScore: Number(i.fullScore !== undefined ? i.fullScore : (i.maxScore !== undefined ? i.maxScore : 10)),
          critical: !!(i.isCritical !== undefined ? i.isCritical : i.critical)
        }))
      }));
    }
    return [
      {
        title: "1. ความสะอาดและสุขอนามัย (Cleanliness)",
        weightPercent: 0,
        items: [
          { id: "q1", text: "พื้น ผนัง และโต๊ะรับประทานอาหารสะอาด ปราศจากคราบไขมัน", type: "yesno", fullScore: 10, critical: false },
          { id: "q2", text: "พนักงานแต่งกายถูกสุขลักษณะ สวมหมวกคลุมผมและผ้ากันเปื้อน", type: "yesno", fullScore: 10, critical: false },
          { id: "q3", text: "ความสะอาดของห้องน้ำลูกค้าและอุปกรณ์ล้างมือ", type: "scale", fullScore: 10, critical: false }
        ]
      },
      {
        title: "2. มาตรฐานการบริการและความเร็ว (Service)",
        weightPercent: 0,
        items: [
          { id: "q4", text: "พนักงานกล่าวทักทายและต้อนรับลูกค้าภายใน 5 วินาที", type: "yesno", fullScore: 10, critical: false },
          { id: "q5", text: "ความรวดเร็วและถูกต้องในการส่งมอบออเดอร์", type: "scale", fullScore: 10, critical: false }
        ]
      }
    ];
  });

  const [editingId, setEditingId] = useState(null);
  const [editingSecIdx, setEditingSecIdx] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null); // { type: 'section' | 'item', secIdx, itemId?, title?, text?, itemIdx? }
  const toastTimerRef = useRef(null);

  // Drag-to-reorder state and refs
  const itemRefs = useRef({});
  const sectionRefs = useRef({});
  const dragRef = useRef(null);
  const [dragUI, setDragUI] = useState(null);

  const showToast = (msg) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(msg);
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 2500);
  };

  // Add a new section and auto-scroll to it
  const addSection = () => {
    const newSecNumber = sections.length + 1;
    const newSecIdx = sections.length;
    const newSection = {
      title: `${newSecNumber}. หมวดหมู่ใหม่ (New Section)`,
      weightPercent: 0,
      items: [
        { id: "q_" + Date.now(), text: "ระบุข้อคำถามที่ต้องการตรวจประเมิน...", type: "yesno", fullScore: 10, critical: false }
      ]
    };
    setSections([...sections, newSection]);
    //showToast("เพิ่มหมวดหมู่ใหม่เรียบร้อยแล้ว");

    // Auto-scroll smooth to newly added section
    setTimeout(() => {
      const el = sectionRefs.current[newSecIdx];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 80);
  };

  // Request remove section (Open popup confirm)
  const handleRequestRemoveSection = (secIdx) => {
    if (sections.length <= 1) {
      alert("แบบฟอร์มต้องมีอย่างน้อย 1 หมวดหมู่");
      return;
    }
    const sec = sections[secIdx];
    setDeleteTarget({
      type: "section",
      secIdx,
      title: sec.title,
      itemCount: sec.items?.length || 0
    });
  };

  // Add question to section and auto-scroll to it
  const addItemToSection = (secIdx) => {
    const next = [...sections];
    const newId = "q_" + Date.now();
    next[secIdx].items.push({
      id: newId,
      text: "ระบุข้อคำถามใหม่...",
      type: "yesno",
      fullScore: 10,
      critical: false
    });
    setSections(next);

    // Auto-scroll smooth to newly added question
    setTimeout(() => {
      const itemEl = itemRefs.current[`${secIdx}-${newId}`];
      if (itemEl) {
        itemEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 80);
  };

  // Request remove question (Open popup confirm)
  const handleRequestRemoveItem = (secIdx, item, itemIdx) => {
    if (sections[secIdx].items.length <= 1) {
      alert("หมวดหมู่นี้ต้องมีคำถามอย่างน้อย 1 ข้อ");
      return;
    }
    setDeleteTarget({
      type: "item",
      secIdx,
      itemId: item.id,
      itemIdx: itemIdx + 1,
      text: item.text
    });
  };

  // Execute confirmed deletion
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    if (deleteTarget.type === "form") {
      try {
        if (typeof deleteTarget.id === 'number') {
          await api.delete(`/form/${deleteTarget.id}`);
        }
      } catch (err) {
        console.warn("Could not delete from api:", err);
      }
      setDeleteTarget(null);
      onBack();
      return;
    }

    if (deleteTarget.type === "section") {
      const next = sections.filter((_, idx) => idx !== deleteTarget.secIdx);
      setSections(next);
      //showToast("ลบหมวดหมู่ออกเรียบร้อยแล้ว");
    } else if (deleteTarget.type === "item") {
      const next = [...sections];
      next[deleteTarget.secIdx].items = next[deleteTarget.secIdx].items.filter(i => i.id !== deleteTarget.itemId);
      setSections(next);
      //showToast("ลบข้อคำถามเรียบร้อยแล้ว");
    }

    setDeleteTarget(null);
  };

  // Update question text
  const updateItemText = (secIdx, itemId, newText) => {
    const next = [...sections];
    const targetItem = next[secIdx].items.find(i => i.id === itemId);
    if (targetItem) {
      targetItem.text = newText;
      setSections(next);
    }
  };

  // Update question type (yesno / scale / text)
  const updateItemType = (secIdx, itemId, newType) => {
    const next = [...sections];
    const targetItem = next[secIdx].items.find(i => i.id === itemId);
    if (targetItem) {
      targetItem.type = newType;
      setSections(next);
    }
  };

  // Toggle Critical Failure Flag
  const toggleItemCritical = (secIdx, itemId) => {
    const next = [...sections];
    const targetItem = next[secIdx].items.find(i => i.id === itemId);
    if (targetItem) {
      targetItem.critical = !targetItem.critical;
      setSections(next);
    }
  };

  // Update section title
  const updateSectionTitle = (secIdx, newTitle) => {
    const next = [...sections];
    next[secIdx].title = newTitle;
    setSections(next);
  };

  // Move section Up/Down
  const moveSection = (secIdx, direction) => {
    const targetIdx = direction === 'up' ? secIdx - 1 : secIdx + 1;
    if (targetIdx < 0 || targetIdx >= sections.length) return;
    const next = [...sections];
    const temp = next[secIdx];
    next[secIdx] = next[targetIdx];
    next[targetIdx] = temp;
    setSections(next);
    //showToast("สลับลำดับหมวดหมู่เรียบร้อย");
  };

  // Drag handlers for reordering items inside a section
  const handlePointerDown = (e, secIdx, itemId) => {
    e.preventDefault();
    const section = sections[secIdx];
    if (!section) return;
    const itemIds = section.items.map(i => i.id);
    const startIdx = itemIds.indexOf(itemId);
    if (startIdx === -1) return;

    const tops = [];
    const heights = [];
    itemIds.forEach(id => {
      const el = itemRefs.current[`${secIdx}-${id}`];
      if (el) {
        const rect = el.getBoundingClientRect();
        tops.push(rect.top + window.scrollY);
        heights.push(rect.height);
      } else {
        tops.push(0);
        heights.push(60);
      }
    });

    const startPointerY = e.clientY;
    dragRef.current = {
      secIdx,
      id: itemId,
      startIdx,
      currentIdx: startIdx,
      itemIds,
      tops,
      heights,
      startPointerY
    };

    setDragUI({ secIdx, id: itemId, deltaY: 0, displace: {} });

    const handlePointerMove = (moveEvent) => {
      if (!dragRef.current) return;
      const d = dragRef.current;
      const deltaY = moveEvent.clientY - d.startPointerY;
      const currentCenterY = d.tops[d.startIdx] + deltaY + d.heights[d.startIdx] / 2;

      let newIdx = d.startIdx;
      for (let i = 0; i < d.tops.length; i++) {
        const itemCenter = d.tops[i] + d.heights[i] / 2;
        if (i < d.startIdx && currentCenterY < itemCenter) {
          newIdx = i;
          break;
        } else if (i > d.startIdx && currentCenterY > itemCenter) {
          newIdx = i;
        }
      }

      d.currentIdx = newIdx;
      const displace = {};
      d.itemIds.forEach((id, i) => {
        if (id === d.id) return;
        if (d.startIdx < newIdx && i > d.startIdx && i <= newIdx) {
          displace[id] = -d.heights[d.startIdx];
        } else if (d.startIdx > newIdx && i >= newIdx && i < d.startIdx) {
          displace[id] = d.heights[d.startIdx];
        } else {
          displace[id] = 0;
        }
      });

      setDragUI({ secIdx: d.secIdx, id: d.id, deltaY, displace });
    };

    const handlePointerUp = () => {
      if (dragRef.current) {
        const d = dragRef.current;
        if (d.startIdx !== d.currentIdx) {
          const next = [...sections];
          const items = [...next[d.secIdx].items];
          const [movedItem] = items.splice(d.startIdx, 1);
          items.splice(d.currentIdx, 0, movedItem);
          next[d.secIdx].items = items;
          setSections(next);
          //showToast("สลับลำดับข้อคำถามเรียบร้อย");
        }
      }
      dragRef.current = null;
      setDragUI(null);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  const totalQuestions = useMemo(() => {
    return sections.reduce((sum, s) => sum + s.items.length, 0);
  }, [sections]);

  const handleFormSave = async () => {
    if (!formName.trim()) {
      alert("กรุณาระบุชื่อแบบฟอร์ม");
      return;
    }

    setIsSaving(true);
    const dto = {
      title: formName.trim(),
      locationTypeId: locationTypeId || 1,
      passingScore: Number(passingScore) || 85,
      targetingMode: "ALL_LOCATIONS",
      version: form?.version || "v1.0",
      sections: sections.map((sec, sIdx) => ({
        id: typeof sec.id === 'number' ? sec.id : undefined,
        title: sec.title,
        orderIndex: sIdx + 1,
        weightPercent: 0,
        items: (sec.items || []).map((item, iIdx) => ({
          id: typeof item.id === 'number' ? item.id : undefined,
          questionText: item.text,
          questionType: item.type === "scale" ? "SCALE" : "YESNO",
          fullScore: 10,
          isCritical: !!item.critical,
          orderIndex: iIdx + 1
        }))
      }))
    };

    let backendId = form?.id;
    try {
      if (form?.id && typeof form.id === 'number') {
        await api.put(`/form/${form.id}`, dto);
      } else {
        const res = await api.post('/form', dto);
        if (res.data?.id) backendId = res.data.id;
      }
    } catch (err) {
      console.warn("Could not save form directly to API, saving locally:", err);
    }

    const savedForm = {
      id: backendId || form?.id || "f_" + Date.now(),
      name: formName.trim(),
      title: formName.trim(),
      type: formType,
      locationTypeId: locationTypeId || 1,
      description: description.trim(),
      passingScore: Number(passingScore) || 85,
      sections: sections,
      itemCount: totalQuestions,
      updatedAt: "วันนี้"
    };

    if (onSave) {
      onSave(savedForm);
    }
    setIsSaving(false);
    onBack();
  };

  return (
    <div className="page-transition p-4 sm:p-6 space-y-6 w-full max-w-[100%] sm:max-w-[92%] mx-auto pb-24">
      {/* 1. TOP HEADER */}
      <Header
        title={form ? `แก้ไขแบบฟอร์ม: ${form.name || form.title}` : "สร้างแบบฟอร์มมาตรฐานใหม่"}
        subtitle="กำหนดเกณฑ์คะแนน หัวข้อ และหมวดหมู่คำถามสำหรับการตรวจประเมิน"
        onBack={onBack}
      />

      {/* ⚠️ IN-USE WARNING BANNER */}
      {(form?.usedCount > 0 || form?.scheduledCount > 0) && (
        <div className="rounded-2xl p-4 bg-amber-50/90 border border-amber-200 text-amber-950 flex items-start gap-3 shadow-2xs">
          <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm space-y-1">
            <p className="font-bold text-amber-950 flex items-center gap-2 flex-wrap">
              <span>แบบฟอร์มนี้มีการใช้งานอยู่ในระบบ</span>
              {form.usedCount > 0 && (
                <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-mono text-xs font-bold">
                  ตรวจแล้ว {form.usedCount} ครั้ง
                </span>
              )}
              {form.scheduledCount > 0 && (
                <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-900 font-mono text-xs font-bold">
                  มีนัดตรวจ {form.scheduledCount} รายการ
                </span>
              )}
            </p>
            <p className="text-slate-600 text-xs leading-relaxed">
              การแก้ไขข้อคำถามหรือเกณฑ์คะแนน ระบบจะจัดเก็บเป็นประวัติเวอร์ชันใหม่อัตโนมัติ เพื่อรักษาความถูกต้องของรายงานผลตรวจย้อนหลัง
            </p>
          </div>
        </div>
      )}

      {/* 🌟 2. STREAMLINED FORM SETTINGS CARD */}
      <div className="rounded-3xl p-5 sm:p-6 bg-white border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-[#0F6659] flex items-center justify-center font-bold shrink-0">
              <FileText size={18} />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-slate-800 leading-snug">ข้อมูลทั่วไปและเกณฑ์ของแบบฟอร์ม</h3>
          </div>
          <div className="text-right shrink-0 px-2.5 py-1 rounded-xl bg-emerald-50 text-[#0F6659] border border-emerald-200/80 shadow-2xs">
            <div className="text-[11px] font-normal leading-tight whitespace-nowrap text-emerald-800">
              {sections.length} หมวดหมู่
            </div>
            <div className="text-[11px] font-normal leading-tight whitespace-nowrap text-emerald-700 mt-0.5">
              {totalQuestions} ข้อคำถาม
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* 1. ชื่อแบบฟอร์ม */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">
              ชื่อแบบฟอร์มการตรวจ (Form Title) <span className="text-rose-500">*</span>
            </label>
            <input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="เช่น แบบฟอร์มมาตรฐาน 5 ดาว (QSC Core Store Audit)..."
              className="w-full text-sm sm:text-base font-normal px-4.5 py-3.5 rounded-2xl bg-white border border-slate-200 text-slate-500 focus:text-slate-800 focus:border-[#0F6659] outline-none transition-all shadow-xs placeholder:text-slate-400"
              required
            />
          </div>

          {/* 2. แถวเดียวกัน: เกณฑ์คะแนนผ่าน (ย่อสั้น) + ประเภทฟอร์ม */}
          <div className="flex gap-3 items-start">
            {/* เกณฑ์คะแนนผ่าน (%) */}
            <div className="w-[115px] sm:w-[130px] shrink-0">
              <label className="block text-sm font-medium text-slate-600 mb-1.5 truncate">
                เกณฑ์ผ่าน (%) <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center justify-between px-3 py-2.5 rounded-2xl bg-white border border-slate-200 focus-within:border-[#0F6659] transition-all shadow-xs gap-1">
                <div className="flex items-center gap-1 min-w-0">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={passingScore}
                    onChange={(e) => setPassingScore(Math.min(100, Math.max(1, Number(e.target.value) || 0)))}
                    className="w-7 text-sm sm:text-base font-normal text-slate-600 focus:text-slate-800 outline-none font-mono text-center p-0 bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    required
                  />
                  <span className="text-xs font-medium text-slate-400 select-none whitespace-nowrap">
                    % ขึ้นไป
                  </span>
                </div>
                <div className="flex flex-col items-center justify-center shrink-0 -my-1">
                  <button
                    type="button"
                    onClick={() => setPassingScore(prev => Math.min(100, (Number(prev) || 0) + 1))}
                    className="p-0.5 text-slate-400 hover:text-[#0F6659] hover:bg-slate-100 rounded cursor-pointer active:scale-90 transition-all leading-none"
                    title="เพิ่มคะแนน"
                  >
                    <ChevronUp size={13} strokeWidth={2.5} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPassingScore(prev => Math.max(1, (Number(prev) || 0) - 1))}
                    className="p-0.5 text-slate-400 hover:text-[#0F6659] hover:bg-slate-100 rounded cursor-pointer active:scale-90 transition-all leading-none"
                    title="ลดคะแนน"
                  >
                    <ChevronDown size={13} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            </div>

            {/* ประเภทฟอร์ม */}
            <div className="flex-1 min-w-0">
              <label className="block text-sm font-medium text-slate-600 mb-1.5 truncate">
                ประเภทฟอร์ม (Category)
              </label>
              <select
                value={locationTypeId || ""}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setLocationTypeId(val);
                  const selectedObj = locationTypes.find(lt => lt.id === val);
                  if (selectedObj) setFormType(selectedObj.name || selectedObj.code);
                }}
                className="w-full text-sm sm:text-base font-normal px-4.5 py-3.5 rounded-2xl bg-white border border-slate-200 text-slate-500 focus:text-slate-800 focus:border-[#0F6659] outline-none transition-all shadow-xs cursor-pointer truncate"
              >
                {locationTypes.length > 0 ? (
                  locationTypes.map(lt => (
                    <option key={lt.id} value={lt.id}>{lt.name || lt.code}</option>
                  ))
                ) : (
                  <>
                    <option value={1}>สาขาหน้าร้าน (Store Front)</option>
                    <option value={2}>ครัวและคลังสินค้า (Kitchen & Storage)</option>
                    <option value={3}>ขับรถรับ (Drive-Thru)</option>
                    <option value={4}>จัดส่งและเดลิเวอรี (Delivery)</option>
                    <option value={5}>ตรวจความปลอดภัยอาหาร (Food Safety)</option>
                  </>
                )}
              </select>
            </div>
          </div>

          {/* 3. คำอธิบายแบบฟอร์ม */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">
              คำอธิบาย / วัตถุประสงค์การตรวจ
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="ระบุคำอธิบาย หรือข้อแนะนำสำหรับผู้ตรวจ..."
              className="w-full text-sm sm:text-base font-normal px-4.5 py-3.5 rounded-2xl bg-white border border-slate-200 text-slate-500 focus:text-slate-800 focus:border-[#0F6659] outline-none transition-all shadow-xs placeholder:text-slate-400"
            />
          </div>
        </div>
      </div>

      {/* 🌟 3. SECTIONS & QUESTIONS BUILDER */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-[#0F6659]" />
            <h3 className="text-base font-extrabold text-slate-800">หมวดหมู่และข้อคำถามการตรวจ</h3>
          </div>
          <button
            type="button"
            onClick={addSection}
            className="px-3.5 py-2 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-[#0F6659] font-extrabold text-xs sm:text-sm border border-emerald-200 flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all active:scale-95"
          >
            <Plus size={16} />
            <span>เพิ่มหมวดหมู่ใหม่</span>
          </button>
        </div>

        {sections.map((sec, secIdx) => (
          <div
            key={secIdx}
            ref={(el) => { sectionRefs.current[secIdx] = el; }}
            className="rounded-3xl p-4 sm:p-6 bg-white border border-slate-200 shadow-2xs space-y-4 transition-all"
          >
            {/* Section Header Bar */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <span className="w-7 h-7 rounded-xl bg-emerald-100 text-[#0F6659] flex items-center justify-center text-xs font-black shrink-0">
                  {secIdx + 1}
                </span>

                {editingSecIdx === secIdx ? (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <input
                      type="text"
                      value={sec.title}
                      onChange={(e) => updateSectionTitle(secIdx, e.target.value)}
                      onBlur={() => setEditingSecIdx(null)}
                      onKeyDown={(e) => { if (e.key === "Enter") setEditingSecIdx(null); }}
                      className="text-sm sm:text-base font-bold px-3 py-1.5 rounded-xl border border-[#0F6659] bg-white text-slate-800 focus:outline-none flex-1 shadow-2xs"
                      autoFocus
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-2 min-w-0 group cursor-pointer flex-1" onClick={() => setEditingSecIdx(secIdx)}>
                    <h4 className="text-sm sm:text-base font-bold text-slate-800 truncate">{sec.title}</h4>
                    <Edit3 size={14} className="text-slate-300 group-hover:text-[#0F6659] shrink-0 transition-colors" />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {/* Reorder Section Buttons */}
                <button
                  type="button"
                  disabled={secIdx === 0}
                  onClick={() => moveSection(secIdx, 'up')}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                  title="เลื่อนหมวดหมู่ขึ้น"
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  type="button"
                  disabled={secIdx === sections.length - 1}
                  onClick={() => moveSection(secIdx, 'down')}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                  title="เลื่อนหมวดหมู่ลง"
                >
                  <ChevronDown size={16} />
                </button>

                <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-slate-100 text-slate-600">
                  {sec.items.length} ข้อ
                </span>

                <button
                  type="button"
                  onClick={() => handleRequestRemoveSection(secIdx)}
                  className="p-2 rounded-xl text-red-500 hover:bg-red-50 cursor-pointer transition-colors"
                  title="ลบหมวดหมู่นี้"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {/* Questions List */}
            <div className="space-y-3">
              {sec.items.map((item, itemIdx) => {
                const isDragging = dragUI && dragUI.secIdx === secIdx && dragUI.id === item.id;
                const displacePx = (dragUI && dragUI.secIdx === secIdx && dragUI.displace[item.id]) || 0;

                return (
                  <div
                    key={item.id}
                    ref={(el) => { itemRefs.current[`${secIdx}-${item.id}`] = el; }}
                    style={{
                      transform: isDragging
                        ? `translateY(${dragUI.deltaY}px) scale(1.01)`
                        : displacePx
                        ? `translateY(${displacePx}px)`
                        : undefined,
                      zIndex: isDragging ? 40 : 1,
                      boxShadow: isDragging ? "0 16px 32px rgba(0,0,0,0.12)" : undefined,
                      borderColor: item.critical ? "#FCA5A5" : undefined,
                      background: item.critical ? "#FFFDFD" : "#FAFAF8",
                      transition: isDragging ? "box-shadow 0.15s" : "transform 0.18s cubic-bezier(0.2,0,0,1)"
                    }}
                    className="p-3.5 sm:p-4 rounded-2xl border border-slate-200 space-y-3 relative transition-colors"
                  >
                    {/* 1. Item Header Bar: Drag Handle + Question Number (Left) | Score + Critical + Delete (Right) */}
                    <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-200/60">
                      {/* Left: Drag Handle & Question Number Badge */}
                      <div className="flex items-center gap-2 min-w-0">
                        <button
                          type="button"
                          onPointerDown={(e) => handlePointerDown(e, secIdx, item.id)}
                          className="p-1 text-slate-400 hover:text-slate-700 cursor-grab active:cursor-grabbing rounded-lg hover:bg-slate-200/60 shrink-0 touch-none"
                          title="คลิกลากเพื่อสลับลำดับข้อ"
                        >
                          <GripVertical size={16} />
                        </button>
                        <span className="text-xs font-black text-slate-800 font-mono px-2.5 py-0.5 bg-slate-100 border border-slate-200/80 rounded-lg">
                          ข้อ {itemIdx + 1}
                        </span>
                        {item.critical && (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 flex items-center gap-1">
                            <ShieldAlert size={12} />
                            <span>จุดวิกฤต (ตกทันที)</span>
                          </span>
                        )}
                      </div>

                      {/* Right: Score Input + Critical Toggle + Delete */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Score Setting Input */}
                        <div className="flex items-center gap-1 bg-white border border-slate-200/90 rounded-xl px-2.5 py-1 shadow-2xs hover:border-[#0F6659] transition-colors">
                          <span className="text-[11px] font-bold text-slate-400">คะแนน:</span>
                          <input
                            type="number"
                            min="1"
                            max="500"
                            value={item.fullScore !== undefined ? item.fullScore : 10}
                            onChange={(e) => updateItemScore(secIdx, item.id, e.target.value)}
                            className="w-7 text-xs font-black text-center font-mono text-[#0F6659] outline-none bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none p-0"
                            title="กำหนดคะแนนเต็มของข้อนี้"
                          />
                          <span className="text-[11px] font-bold text-slate-400">แต้ม</span>
                        </div>

                        {/* Critical Toggle Button */}
                        <button
                          type="button"
                          onClick={() => toggleItemCritical(secIdx, item.id)}
                          className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs ${
                            item.critical
                              ? 'bg-rose-50 text-rose-600 border border-rose-200'
                              : 'bg-white border border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50'
                          }`}
                          title={item.critical ? "ปลดจุดวิกฤต" : "ตั้งเป็นจุดวิกฤต (ตกทันที)"}
                        >
                          <ShieldAlert size={14} />
                          <span className="text-[11px] font-bold hidden sm:inline">{item.critical ? "จุดวิกฤต" : "ตั้งวิกฤต"}</span>
                        </button>

                        {/* Delete Question Button */}
                        <button
                          type="button"
                          onClick={() => handleRequestRemoveItem(secIdx, item, itemIdx)}
                          className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
                          title="ลบคำถามข้อนี้"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {/* 2. Full-Width Question Text Area */}
                    <div className="w-full">
                      {editingId === item.id ? (
                        <div className="flex items-center gap-2 w-full">
                          <textarea
                            rows={2}
                            value={item.text}
                            onChange={(e) => updateItemText(secIdx, item.id, e.target.value)}
                            onBlur={() => setEditingId(null)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                setEditingId(null);
                              }
                            }}
                            placeholder="ระบุข้อความคำถามสำหรับการตรวจประเมิน..."
                            className="w-full text-xs sm:text-sm font-medium p-3 rounded-xl border border-[#0F6659] bg-white text-slate-800 outline-none shadow-2xs resize-none leading-relaxed"
                            autoFocus
                          />
                        </div>
                      ) : (
                        <div
                          onClick={() => setEditingId(item.id)}
                          className="w-full group/text cursor-pointer hover:bg-emerald-50/50 p-2.5 -mx-1 rounded-xl transition-all flex items-start justify-between gap-3"
                          title="คลิกเพื่อแก้ไขข้อความคำถาม"
                        >
                          <p className="text-xs sm:text-sm font-medium text-slate-800 group-hover/text:text-[#0F6659] transition-colors leading-relaxed flex-1 break-words">
                            {item.text}
                          </p>
                          <Edit3 size={15} className="text-slate-300 group-hover/text:text-[#0F6659] shrink-0 mt-0.5 transition-colors" />
                        </div>
                      )}
                    </div>

                    {/* Question Type Selector Buttons */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100/80">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-400">ประเภทคำตอบ:</span>
                        <div className="flex rounded-xl p-0.5 bg-slate-200/70 text-xs font-bold">
                          <button
                            type="button"
                            onClick={() => updateItemType(secIdx, item.id, "yesno")}
                            className={`px-3 py-1 rounded-lg cursor-pointer transition-all ${
                              item.type === "yesno" ? 'bg-white text-[#0F6659] shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            ผ่าน / ไม่ผ่าน
                          </button>
                          <button
                            type="button"
                            onClick={() => updateItemType(secIdx, item.id, "scale")}
                            className={`px-3 py-1 rounded-lg cursor-pointer transition-all ${
                              item.type === "scale" ? 'bg-white text-[#0F6659] shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            คะแนน 1-5
                          </button>
                          <button
                            type="button"
                            onClick={() => updateItemType(secIdx, item.id, "text")}
                            className={`px-3 py-1 rounded-lg cursor-pointer transition-all ${
                              item.type === "text" ? 'bg-white text-[#0F6659] shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            ข้อความ/บันทึก
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add Question Button */}
            <button
              type="button"
              onClick={() => addItemToSection(secIdx)}
              className="w-full py-3 rounded-2xl bg-slate-50 hover:bg-emerald-50/60 border border-dashed border-slate-300 hover:border-emerald-400 text-xs sm:text-sm font-extrabold text-slate-600 hover:text-[#0F6659] flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99]"
            >
              <Plus size={16} />
              <span>เพิ่มข้อคำถามในหมวดหมู่นี้</span>
            </button>
          </div>
        ))}
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-[#1C2129] text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-2.5 animate-in slide-in-from-bottom-3 duration-200 border border-slate-700">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          <span className="text-emerald-300">{toastMessage}</span>
        </div>
      )}

      {/* 🌟 4. BOTTOM ACTION BUTTONS */}
      <div className="pt-3 flex items-center gap-3">
        {form?.id && (
          <button
            type="button"
            onClick={() => setDeleteTarget({ type: "form", title: formName, id: form.id })}
            className="px-4 py-4 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 border border-red-200 text-red-600 hover:bg-red-50 cursor-pointer shadow-xs active:scale-95 transition-all shrink-0"
            title="ลบแบบฟอร์มนี้ออกจากระบบ"
          >
            <Trash2 size={16} />
            <span className="hidden sm:inline">ลบแบบฟอร์มนี้</span>
          </button>
        )}
        <button
          type="button"
          onClick={handleFormSave}
          className="flex-1 py-4 rounded-2xl text-sm sm:text-base font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-md text-white active:scale-95 bg-gradient-to-tr from-[#0F6659] via-[#117a6b] to-emerald-700 hover:opacity-95 transition-all"
        >
          <Check size={18} />
          <span>บันทึกและเผยแพร่แบบฟอร์ม</span>
        </button>
      </div>

      {/* 🛑 5. POPUP CONFIRMATION FOR DELETION */}
      {deleteTarget && (
        <ModalWrapper onClose={() => setDeleteTarget(null)} maxWidth="max-w-md">
          <div className="p-6 space-y-4 text-center">
            {/* Warning Icon */}
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto shadow-xs ${
              deleteTarget.type === "form" && (form?.usedCount > 0 || form?.scheduledCount > 0)
                ? "bg-amber-100 text-amber-600"
                : "bg-rose-100 text-rose-600"
            }`}>
              {deleteTarget.type === "form" && (form?.usedCount > 0 || form?.scheduledCount > 0) ? (
                <AlertTriangle size={28} strokeWidth={2.2} />
              ) : (
                <Trash2 size={26} strokeWidth={2.2} />
              )}
            </div>

            {/* Content Message */}
            <div className="space-y-2">
              <h3 className="text-base sm:text-lg font-black text-slate-800">
                {deleteTarget.type === "form"
                  ? (form?.usedCount > 0 || form?.scheduledCount > 0 ? "คำเตือน: แบบฟอร์มนี้มีการใช้งานอยู่!" : "ยืนยันการลบแบบฟอร์มนี้?")
                  : deleteTarget.type === "section"
                  ? "ยืนยันการลบหมวดหมู่?"
                  : "ยืนยันการลบข้อคำถาม?"}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-sm mx-auto">
                {deleteTarget.type === "form" ? (
                  <>
                    คุณต้องการลบแบบฟอร์ม <strong className="text-slate-800">"{deleteTarget.title}"</strong> ออกจากระบบใช่หรือไม่?
                  </>
                ) : deleteTarget.type === "section" ? (
                  <>
                    คุณต้องการลบหมวดหมู่ <strong className="text-slate-800">"{deleteTarget.title}"</strong> ใช่หรือไม่? ข้อคำถามทั้งหมด <strong className="text-rose-600 font-bold">{deleteTarget.itemCount} ข้อ</strong> ในหมวดนี้จะถูกลบออกด้วย
                  </>
                ) : (
                  <>
                    คุณต้องการลบข้อคำถาม <strong className="text-slate-800">ข้อ {deleteTarget.itemIdx}</strong> ใช่หรือไม่?
                    <span className="italic text-slate-700 block mt-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 text-xs text-left">
                      "{deleteTarget.text}"
                    </span>
                  </>
                )}
              </p>
            </div>

            {/* In-Use Alert Box inside Modal */}
            {deleteTarget.type === "form" && (form?.usedCount > 0 || form?.scheduledCount > 0) && (
              <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200 text-left space-y-1.5 text-xs text-amber-900">
                <div className="font-bold flex items-center gap-1.5 text-amber-800">
                  <AlertTriangle size={14} className="shrink-0 text-amber-600" />
                  <span>ประวัติการใช้งานในระบบปัจจุบัน:</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-slate-700 pl-1 text-[11px]">
                  {form.usedCount > 0 && (
                    <li>มีการใช้ตรวจประเมินไปแล้ว: <strong className="text-amber-900">{form.usedCount} ครั้ง</strong></li>
                  )}
                  {form.scheduledCount > 0 && (
                    <li>มีกำหนดการนัดตรวจล่วงหน้า: <strong className="text-purple-900">{form.scheduledCount} รายการ</strong></li>
                  )}
                </ul>
                <p className="text-[11px] text-slate-500 pt-1 border-t border-amber-200/60 leading-tight">
                  * หากยืนยันลบ ระบบจะปิดการใช้งานฟอร์ม (Deactivate) เพื่อล็อกประวัติผลตรวจเดิมไว้ และจะไม่สามารถเลือกฟอร์มนี้ตรวจใหม่ได้
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="py-3 px-4 rounded-2xl text-xs sm:text-sm font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors active:scale-95"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className={`py-3 px-4 rounded-2xl text-xs sm:text-sm font-bold text-white shadow-md cursor-pointer transition-colors active:scale-95 flex items-center justify-center gap-1.5 ${
                  deleteTarget.type === "form" && (form?.usedCount > 0 || form?.scheduledCount > 0)
                    ? "bg-amber-600 hover:bg-amber-700 shadow-amber-200"
                    : "bg-rose-600 hover:bg-rose-700 shadow-rose-200"
                }`}
              >
                <Trash2 size={16} />
                <span>ยืนยันการลบ</span>
              </button>
            </div>
          </div>
        </ModalWrapper>
      )}
    </div>
  );
}
