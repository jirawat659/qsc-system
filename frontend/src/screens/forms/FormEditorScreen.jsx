import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  FileText, Plus, Trash2, Edit3, GripVertical, Check, X,
  AlertTriangle, ShieldAlert, Sparkles, ChevronDown, ChevronUp,
  Layers, CheckCircle2, ArrowUpDown, Info, Tag, SlidersHorizontal
} from "lucide-react";

import { c, sans, mono, cardStyle } from "../../config/theme";
import Header from "../../shared/Header";
import Section from "../../shared/Section";

export default function FormEditorScreen({ form, onBack, onSave }) {
  const [formName, setFormName] = useState(form ? form.name : "แบบฟอร์มมาตรฐานใหม่");
  const [formType, setFormType] = useState(form ? form.type : "หน้าร้าน (Store Front)");
  const [description, setDescription] = useState(
    form?.description || "แบบฟอร์มตรวจสอบมาตรฐานคุณภาพ การบริการ และสุขอนามัยประจำสาขา (Q.S.C. Standard)"
  );
  const [passingScore, setPassingScore] = useState(form ? form.passingScore : 85);

  const [sections, setSections] = useState(form?.sections ? form.sections : [
    {
      title: "1. ความสะอาดและสุขอนามัย (Cleanliness)",
      items: [
        { id: "q1", text: "พื้น ผนัง และโต๊ะรับประทานอาหารสะอาด ปราศจากคราบไขมัน", type: "yesno", critical: false },
        { id: "q2", text: "พนักงานแต่งกายถูกสุขลักษณะ สวมหมวกคลุมผมและผ้ากันเปื้อน", type: "yesno", critical: false },
        { id: "q3", text: "ความสะอาดของห้องน้ำลูกค้าและอุปกรณ์ล้างมือ", type: "scale", critical: false }
      ]
    },
    {
      title: "2. มาตรฐานการบริการและความเร็ว (Service)",
      items: [
        { id: "q4", text: "พนักงานกล่าวทักทายและต้อนรับลูกค้าภายใน 5 วินาที", type: "yesno", critical: false },
        { id: "q5", text: "ความรวดเร็วและถูกต้องในการส่งมอบออเดอร์", type: "scale", critical: false }
      ]
    }
  ]);

  const [editingId, setEditingId] = useState(null);
  const [editingSecIdx, setEditingSecIdx] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const toastTimerRef = useRef(null);

  // Drag-to-reorder state and refs
  const itemRefs = useRef({});
  const dragRef = useRef(null);
  const [dragUI, setDragUI] = useState(null);

  const showToast = (msg) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(msg);
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 2500);
  };

  // Add a new section
  const addSection = () => {
    const newSecNumber = sections.length + 1;
    const newSection = {
      title: `${newSecNumber}. หมวดหมู่ใหม่ (New Section)`,
      items: [
        { id: "q_" + Date.now(), text: "ระบุข้อคำถามที่ต้องการตรวจประเมิน...", type: "yesno", critical: false }
      ]
    };
    setSections([...sections, newSection]);
    showToast("เพิ่มหมวดหมู่ใหม่เรียบร้อยแล้ว");
  };

  // Remove a section
  const removeSection = (secIdx) => {
    if (sections.length <= 1) {
      alert("แบบฟอร์มต้องมีอย่างน้อย 1 หมวดหมู่");
      return;
    }
    const next = sections.filter((_, idx) => idx !== secIdx);
    setSections(next);
    showToast("ลบหมวดหมู่ออกเรียบร้อยแล้ว");
  };

  // Add question to section
  const addItemToSection = (secIdx) => {
    const next = [...sections];
    const newId = "q_" + Date.now();
    next[secIdx].items.push({
      id: newId,
      text: "ระบุข้อคำถามใหม่...",
      type: "yesno",
      critical: false
    });
    setSections(next);
    setEditingId(newId);
  };

  // Remove question from section
  const removeItem = (secIdx, itemId) => {
    const next = [...sections];
    if (next[secIdx].items.length <= 1) {
      alert("หมวดหมู่นี้ต้องมีคำถามอย่างน้อย 1 ข้อ");
      return;
    }
    next[secIdx].items = next[secIdx].items.filter(item => item.id !== itemId);
    setSections(next);
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
      showToast(targetItem.critical ? "⚠️ ตั้งเป็นจุดวิกฤต (Critical Item)" : "ปลดจุดวิกฤตแล้ว");
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
    showToast("สลับลำดับหมวดหมู่เรียบร้อย");
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
          showToast("สลับลำดับข้อคำถามเรียบร้อย");
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

  const handleFormSave = () => {
    if (!formName.trim()) {
      alert("กรุณาระบุชื่อแบบฟอร์ม");
      return;
    }

    const savedForm = {
      id: form?.id || "f_" + Date.now(),
      name: formName.trim(),
      type: formType,
      description: description.trim(),
      passingScore: Number(passingScore) || 85,
      sections: sections,
      itemCount: totalQuestions,
      updatedAt: "วันนี้"
    };

    if (onSave) {
      onSave(savedForm);
    }
    onBack();
  };

  return (
    <div className="page-transition p-4 sm:p-6 space-y-6 w-full max-w-[100%] sm:max-w-[92%] mx-auto pb-24">
      {/* 1. TOP HEADER */}
      <Header
        title={form ? `แก้ไขแบบฟอร์ม: ${form.name}` : "สร้างแบบฟอร์มมาตรฐานใหม่"}
        subtitle="กำหนดเกณฑ์คะแนน หัวข้อ และหมวดหมู่คำถามสำหรับการตรวจประเมิน"
        onBack={onBack}
      />

      {/* 🌟 2. STREAMLINED FORM SETTINGS CARD */}
      <div className="rounded-3xl p-5 sm:p-6 bg-white border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-[#0F6659] flex items-center justify-center font-bold">
              <FileText size={18} />
            </div>
            <h3 className="text-base font-extrabold text-slate-800">ข้อมูลทั่วไปและเกณฑ์ของแบบฟอร์ม</h3>
          </div>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 text-[#0F6659] border border-emerald-200">
            {sections.length} หมวดหมู่ · {totalQuestions} ข้อคำถาม
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* ชื่อแบบฟอร์ม */}
          <div className="sm:col-span-2">
            <label className="text-xs font-extrabold text-slate-700 block mb-1.5 flex items-center gap-1.5">
              <span>ชื่อแบบฟอร์มการตรวจ (Form Title) *</span>
            </label>
            <input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="เช่น แบบฟอร์มมาตรฐาน 5 ดาว (QSC Core Store Audit)..."
              className="w-full text-sm font-bold px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 outline-none text-slate-900 focus:bg-white focus:border-[#0F6659] focus:ring-2 focus:ring-emerald-700/10 transition-all"
              required
            />
          </div>

          {/* เกณฑ์คะแนนผ่าน (%) */}
          <div>
            <label className="text-xs font-extrabold text-slate-700 block mb-1.5 flex items-center gap-1.5">
              <Sparkles size={14} className="text-amber-500" />
              <span>เกณฑ์คะแนนผ่าน (%) *</span>
            </label>
            <div className="relative">
              <input
                type="number"
                min="1"
                max="100"
                value={passingScore}
                onChange={(e) => setPassingScore(Number(e.target.value))}
                className="w-full text-sm font-bold px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 outline-none text-slate-900 focus:bg-white focus:border-[#0F6659] focus:ring-2 focus:ring-emerald-700/10 transition-all font-mono"
                required
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                % ขึ้นไป
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          {/* ประเภทแบบฟอร์ม */}
          <div>
            <label className="text-xs font-extrabold text-slate-700 block mb-1.5 flex items-center gap-1.5">
              <Tag size={14} className="text-slate-400" />
              <span>ประเภทฟอร์ม (Category)</span>
            </label>
            <select
              value={formType}
              onChange={(e) => setFormType(e.target.value)}
              className="w-full text-sm font-bold px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 outline-none text-slate-900 focus:bg-white focus:border-[#0F6659] transition-all cursor-pointer"
            >
              <option value="หน้าร้าน (Store Front)">หน้าร้าน (Store Front)</option>
              <option value="ครัวและคลังสินค้า (Kitchen & Storage)">ครัวและคลังสินค้า (Kitchen & Storage)</option>
              <option value="ขับรถรับ (Drive-Thru)">ขับรถรับ (Drive-Thru)</option>
              <option value="จัดส่งและเดลิเวอรี (Delivery)">จัดส่งและเดลิเวอรี (Delivery)</option>
              <option value="ตรวจความปลอดภัยอาหาร (Food Safety)">ตรวจความปลอดภัยอาหาร (Food Safety)</option>
            </select>
          </div>

          {/* คำอธิบายแบบฟอร์ม */}
          <div className="sm:col-span-2">
            <label className="text-xs font-extrabold text-slate-700 block mb-1.5 flex items-center gap-1.5">
              <Info size={14} className="text-slate-400" />
              <span>คำอธิบาย / วัตถุประสงค์การตรวจ</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="ระบุคำอธิบาย หรือข้อแนะนำสำหรับผู้ตรวจ..."
              className="w-full text-sm font-medium px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 outline-none text-slate-800 focus:bg-white focus:border-[#0F6659] transition-all"
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
            className="rounded-3xl p-4 sm:p-6 bg-white border border-slate-200 shadow-2xs space-y-4"
          >
            {/* Section Header Bar */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <span className="w-7 h-7 rounded-xl bg-emerald-100 text-[#0F6659] flex items-center justify-center text-xs font-black shrink-0">
                  {secIdx + 1}
                </span>

                {editingSecIdx === secIdx ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="text"
                      value={sec.title}
                      onChange={(e) => updateSectionTitle(secIdx, e.target.value)}
                      className="text-sm sm:text-base font-extrabold px-3 py-1.5 rounded-xl border border-[#0F6659] bg-emerald-50/40 text-slate-900 outline-none flex-1"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setEditingSecIdx(null)}
                      className="p-2 rounded-xl bg-[#0F6659] text-white hover:bg-[#0B4E44] cursor-pointer"
                    >
                      <Check size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 min-w-0 group cursor-pointer" onClick={() => setEditingSecIdx(secIdx)}>
                    <h4 className="text-sm sm:text-base font-extrabold text-slate-800 truncate">{sec.title}</h4>
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
                  onClick={() => removeSection(secIdx)}
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
                    <div className="flex items-start gap-2.5">
                      {/* Drag Handle */}
                      <button
                        type="button"
                        onPointerDown={(e) => handlePointerDown(e, secIdx, item.id)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 cursor-grab active:cursor-grabbing rounded-lg hover:bg-slate-200/60 shrink-0 touch-none mt-0.5"
                        title="คลิกลากเพื่อสลับลำดับข้อ"
                      >
                        <GripVertical size={16} />
                      </button>

                      {/* Question Index & Text Input */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-black text-slate-500 font-mono">ข้อ {itemIdx + 1}.</span>
                          {item.critical && (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-red-100 text-red-700 flex items-center gap-1">
                              <ShieldAlert size={12} />
                              <span>จุดวิกฤต (ตกทันที)</span>
                            </span>
                          )}
                        </div>

                        {editingId === item.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={item.text}
                              onChange={(e) => updateItemText(secIdx, item.id, e.target.value)}
                              className="w-full text-xs sm:text-sm font-bold px-3 py-2 rounded-xl border border-[#0F6659] bg-white outline-none text-slate-900"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="p-2 rounded-xl bg-[#0F6659] text-white hover:bg-[#0B4E44] cursor-pointer"
                            >
                              <Check size={14} />
                            </button>
                          </div>
                        ) : (
                          <p
                            onClick={() => setEditingId(item.id)}
                            className="text-xs sm:text-sm font-bold text-slate-800 cursor-pointer hover:text-[#0F6659] transition-colors"
                          >
                            {item.text}
                          </p>
                        )}
                      </div>

                      {/* Question Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleItemCritical(secIdx, item.id)}
                          className={`p-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            item.critical
                              ? 'bg-red-50 text-red-600 border border-red-200'
                              : 'text-slate-400 hover:text-red-500 hover:bg-red-50'
                          }`}
                          title={item.critical ? "ปลดจุดวิกฤต" : "ตั้งเป็นจุดวิกฤต (ตกทันที)"}
                        >
                          <ShieldAlert size={16} />
                        </button>

                        <button
                          type="button"
                          onClick={() => removeItem(secIdx, item.id)}
                          className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer transition-colors"
                          title="ลบคำถามข้อนี้"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
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

      {/* 🌟 4. BOTTOM SAVE BUTTON */}
      <div className="pt-3">
        <button
          type="button"
          onClick={handleFormSave}
          className="w-full py-4 rounded-2xl text-sm sm:text-base font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-md text-white active:scale-95 bg-gradient-to-tr from-[#0F6659] via-[#117a6b] to-emerald-700 hover:opacity-95 transition-all"
        >
          <Check size={18} />
          <span>บันทึกและเผยแพร่แบบฟอร์ม</span>
        </button>
      </div>
    </div>
  );
}
