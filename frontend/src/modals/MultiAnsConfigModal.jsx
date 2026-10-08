import React, { useState } from "react";
import { X, Plus, Trash2, Check, ListChecks, UtensilsCrossed, Sparkles } from "lucide-react";
import ModalWrapper from "../shared/ModalWrapper";

export default function MultiAnsConfigModal({
  isOpen,
  onClose,
  initialConfig,
  initialTitle,
  onSave
}) {
  if (!isOpen) return null;

  const [title, setTitle] = useState(initialTitle || "");
  const [allowAddItem, setAllowAddItem] = useState(
    initialConfig?.allowAddItem !== undefined ? Boolean(initialConfig.allowAddItem) : true
  );

  const [criteria, setCriteria] = useState(() => {
    if (initialConfig?.criteria && Array.isArray(initialConfig.criteria) && initialConfig.criteria.length > 0) {
      return JSON.parse(JSON.stringify(initialConfig.criteria));
    }
    return [
      { id: "decor", label: "การตกแต่ง", type: "yesno" },
      { id: "taste", label: "รสชาติ", type: "yesno" }
    ];
  });

  const [items, setItems] = useState(() => {
    if (initialConfig?.items && Array.isArray(initialConfig.items) && initialConfig.items.length > 0) {
      return JSON.parse(JSON.stringify(initialConfig.items));
    }
    return [
      { id: "item_1", name: "Chocolate toast with strawberry" },
      { id: "item_2", name: "Baby Shibuya" }
    ];
  });

  // Criteria actions
  const handleAddCriterion = () => {
    const newId = `crit_${Date.now()}`;
    setCriteria(prev => [...prev, { id: newId, label: `เกณฑ์ที่ ${prev.length + 1}`, type: "yesno" }]);
  };

  const handleUpdateCriterion = (idx, label) => {
    setCriteria(prev => prev.map((c, i) => i === idx ? { ...c, label } : c));
  };

  const handleRemoveCriterion = (idx) => {
    if (criteria.length <= 1) {
      alert("ต้องมีเกณฑ์การประเมินอย่างน้อย 1 รายการ");
      return;
    }
    setCriteria(prev => prev.filter((_, i) => i !== idx));
  };

  // Item / Menu actions
  const handleAddItem = () => {
    const newId = `item_${Date.now()}`;
    setItems(prev => [...prev, { id: newId, name: `รายการที่ ${prev.length + 1}` }]);
  };

  const handleUpdateItem = (idx, name) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, name } : item));
  };

  const handleRemoveItem = (idx) => {
    if (items.length <= 1) {
      alert("ต้องมีรายการเมนูเริ่มต้นอย่างน้อย 1 รายการ");
      return;
    }
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    if (!title.trim()) {
      alert("กรุณาระบุหัวข้อคำถาม");
      return;
    }
    const cleanCriteria = criteria
      .map(c => ({ ...c, label: c.label.trim() }))
      .filter(c => c.label.length > 0);

    if (cleanCriteria.length === 0) {
      alert("กรุณาระบุเกณฑ์การประเมินอย่างน้อย 1 รายการ");
      return;
    }

    const cleanItems = items
      .map(it => ({ ...it, name: it.name.trim() }))
      .filter(it => it.name.length > 0);

    if (cleanItems.length === 0) {
      alert("กรุณาระบุรายการเมนูอย่างน้อย 1 รายการ");
      return;
    }

    onSave({
      title: title.trim(),
      fieldConfig: {
        criteria: cleanCriteria,
        items: cleanItems,
        allowAddItem
      }
    });
  };

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} size="lg">
      <div className="bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4.5 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-white border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <ListChecks size={20} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-800">
                ตั้งค่าเกณฑ์และรายการเมนู (Multiple Answer)
              </h3>
              <p className="text-xs text-slate-500">
                กำหนดเกณฑ์ประเมินย่อยและรายการเมนูสำหรับตรวจหน้างาน
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Question Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">
              หัวข้อคำถาม / กลุ่มการตรวจ
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="เช่น การประเมินคุณภาพและรสชาติอาหาร"
              className="w-full text-sm font-semibold px-4 py-2.5 rounded-2xl border border-slate-200 focus:border-blue-500 focus:outline-none shadow-2xs"
            />
          </div>

          {/* Section 1: Evaluation Criteria */}
          <div className="space-y-3 p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListChecks size={16} className="text-blue-600" />
                <span className="text-sm font-bold text-slate-800">
                  เกณฑ์การประเมินย่อย (Criteria)
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold font-mono">
                  {criteria.length}
                </span>
              </div>
              <button
                type="button"
                onClick={handleAddCriterion}
                className="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold flex items-center gap-1 hover:bg-blue-700 shadow-2xs cursor-pointer active:scale-95 transition-all"
              >
                <Plus size={14} />
                <span>เพิ่มเกณฑ์</span>
              </button>
            </div>

            <div className="space-y-2">
              {criteria.map((crit, idx) => (
                <div key={crit.id || idx} className="flex items-center gap-2">
                  <span className="w-6 text-xs font-bold text-slate-400 text-center font-mono shrink-0">
                    {idx + 1}.
                  </span>
                  <input
                    type="text"
                    value={crit.label}
                    onChange={(e) => handleUpdateCriterion(idx, e.target.value)}
                    placeholder="ชื่อเกณฑ์ เช่น การตกแต่ง, รสชาติ"
                    className="flex-1 text-xs sm:text-sm font-medium px-3 py-2 rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveCriterion(idx)}
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    title="ลบเกณฑ์นี้"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Items / Menu */}
          <div className="space-y-3 p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UtensilsCrossed size={16} className="text-[#0F6659]" />
                <span className="text-sm font-bold text-slate-800">
                  รายการเมนูเริ่มต้น (Preset Items)
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold font-mono">
                  {items.length}
                </span>
              </div>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-3 py-1.5 rounded-xl bg-[#0F6659] text-white text-xs font-bold flex items-center gap-1 hover:bg-[#0d564b] shadow-2xs cursor-pointer active:scale-95 transition-all"
              >
                <Plus size={14} />
                <span>เพิ่มเมนู</span>
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {items.map((item, idx) => (
                <div key={item.id || idx} className="flex items-center gap-2">
                  <span className="w-6 text-xs font-bold text-slate-400 text-center font-mono shrink-0">
                    {idx + 1}.
                  </span>
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => handleUpdateItem(idx, e.target.value)}
                    placeholder="ชื่อเมนู / รายการ"
                    className="flex-1 text-xs sm:text-sm font-medium px-3 py-2 rounded-xl border border-slate-200 bg-white focus:border-[#0F6659] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    title="ลบเมนูนี้"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Option: allowAddItem */}
          <label className="flex items-center gap-3 p-3.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer select-none transition-all">
            <input
              type="checkbox"
              checked={allowAddItem}
              onChange={(e) => setAllowAddItem(e.target.checked)}
              className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
            />
            <div className="min-w-0">
              <span className="text-xs sm:text-sm font-bold text-slate-800 block">
                อนุญาตให้ผู้ตรวจกดเพิ่มรายการเมนูใหม่หน้างานได้
              </span>
              <span className="text-[11px] text-slate-500 block">
                หากเปิดไว้ ผู้ตรวจสามารถกดปุ่ม "+ เพิ่มรายการ" เพื่อตรวจเมนูอื่นๆ ที่อยู่นอกเหนือจากรายการตั้งต้นได้
              </span>
            </div>
          </label>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-2.5 rounded-2xl text-xs sm:text-sm font-bold bg-[#0F6659] text-white hover:bg-[#0d564b] shadow-md shadow-[#0F6659]/20 flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
          >
            <Check size={16} />
            <span>บันทึกการตั้งค่า</span>
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
}
