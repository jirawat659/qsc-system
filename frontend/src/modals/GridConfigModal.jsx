import React, { useState } from "react";
import {
  X, Plus, Trash2, Table, Check, ChevronUp, ChevronDown, Sparkles, Calculator, Type, CircleDot, CheckSquare, HelpCircle, Eye, Pencil
} from "lucide-react";
import ModalWrapper from "../shared/ModalWrapper";

export const CASH_AUDIT_PRESET = {
  title: "ตารางตรวจนับเงินสดในแคชเชียร์",
  columns: [
    { id: "col_count", label: "จำนวน (ใบ/เหรียญ)", type: "number", autoSum: false },
    { id: "col_total", label: "มูลค่ารวม (บาท)", type: "number", autoSum: true }
  ],
  rows: [
    { id: "r_1000", label: "ธนบัตร 1,000 บาท" },
    { id: "r_500", label: "ธนบัตร 500 บาท" },
    { id: "r_100", label: "ธนบัตร 100 บาท" },
    { id: "r_50", label: "ธนบัตร 50 บาท" },
    { id: "r_20", label: "ธนบัตร 20 บาท" },
    { id: "r_coin_10", label: "เหรียญ 10 บาท" },
    { id: "r_coin_5", label: "เหรียญ 5 บาท" },
    { id: "r_coin_2", label: "เหรียญ 2 บาท" },
    { id: "r_coin_1", label: "เหรียญ 1 บาท" }
  ]
};

export const EQUIPMENT_PRESET = {
  title: "ตารางตรวจเช็คสถานะอุปกรณ์และเครื่องจักร",
  columns: [
    { id: "col_status_ok", label: "ปกติ", type: "radio", autoSum: false },
    { id: "col_status_bad", label: "ชำรุด", type: "radio", autoSum: false },
    { id: "col_cleaned", label: "ทำความสะอาดแล้ว", type: "checkbox", autoSum: false },
    { id: "col_note", label: "หมายเหตุ / อาการ", type: "text", autoSum: false }
  ],
  rows: [
    { id: "r_eq_1", label: "เครื่องชงกาแฟ Espresso" },
    { id: "r_eq_2", label: "เครื่องบดเมล็ดกาแฟ" },
    { id: "r_eq_3", label: "เครื่องปั่นน้ำผลไม้" },
    { id: "r_eq_4", label: "ตู้แช่นมสด / วัตถุดิบ" },
    { id: "r_eq_5", label: "เครื่องกรองน้ำ" }
  ]
};

export default function GridConfigModal({ isOpen, onClose, initialConfig, initialTitle, onSave }) {
  if (!isOpen) return null;

  const [title, setTitle] = useState(initialTitle || "");
  const [columns, setColumns] = useState(() => {
    if (initialConfig?.columns && initialConfig.columns.length > 0) {
      return JSON.parse(JSON.stringify(initialConfig.columns));
    }
    return [
      { id: "col_1", label: "", type: "number", autoSum: false },
      { id: "col_2", label: "", type: "number", autoSum: true }
    ];
  });

  const [rows, setRows] = useState(() => {
    if (initialConfig?.rows && initialConfig.rows.length > 0) {
      return JSON.parse(JSON.stringify(initialConfig.rows));
    }
    return [
      { id: "r_1", label: "" },
      { id: "r_2", label: "" },
      { id: "r_3", label: "" }
    ];
  });

  const [activeTab, setActiveTab] = useState("builder"); // 'builder' | 'preview'
  const [errorMessage, setErrorMessage] = useState(null);

  // Column operations
  const addColumn = () => {
    const newId = "col_" + Date.now();
    setColumns([
      ...columns,
      {
        id: newId,
        label: "",
        type: "number",
        autoSum: false
      }
    ]);
    setTimeout(() => {
      const el = document.getElementById(`grid-col-input-${newId}`);
      if (el) {
        el.focus();
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 60);
  };

  const updateColumn = (idx, patch) => {
    setColumns(prev => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  };

  const removeColumn = (idx) => {
    if (columns.length <= 1) {
      setErrorMessage("ตารางต้องมีอย่างน้อย 1 คอลัมน์");
      return;
    }
    setColumns(prev => prev.filter((_, i) => i !== idx));
  };

  const moveColumn = (idx, dir) => {
    const target = dir === "up" ? idx - 1 : idx + 1;
    if (target < 0 || target >= columns.length) return;
    const next = [...columns];
    const temp = next[idx];
    next[idx] = next[target];
    next[target] = temp;
    setColumns(next);
  };

  // Row operations
  const addRow = () => {
    const newId = "row_" + Date.now();
    setRows([
      ...rows,
      {
        id: newId,
        label: ""
      }
    ]);
    setTimeout(() => {
      const el = document.getElementById(`grid-row-input-${newId}`);
      if (el) {
        el.focus();
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 60);
  };

  const updateRow = (idx, label) => {
    setRows(prev => prev.map((r, i) => (i === idx ? { ...r, label } : r)));
  };

  const removeRow = (idx) => {
    if (rows.length <= 1) {
      setErrorMessage("ตารางต้องมีอย่างน้อย 1 แถว");
      return;
    }
    setRows(prev => prev.filter((_, i) => i !== idx));
  };

  const moveRow = (idx, dir) => {
    const target = dir === "up" ? idx - 1 : idx + 1;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    const temp = next[idx];
    next[idx] = next[target];
    next[target] = temp;
    setRows(next);
  };

  const applyPreset = (preset) => {
    setTitle(preset.title);
    setColumns(JSON.parse(JSON.stringify(preset.columns)));
    setRows(JSON.parse(JSON.stringify(preset.rows)));
    setErrorMessage(null);
  };

  const handleSave = () => {
    const finalTitle = title.trim() || "ตารางข้อมูล";

    // หากปล่อยว่างไว้ ให้ใช้ชื่อตามลำดับอัตโนมัติ (Placeholder fallback)
    const finalizedColumns = columns.map((c, i) => ({
      ...c,
      label: c.label?.trim() ? c.label.trim() : `คอลัมน์ที่ ${i + 1}`
    }));

    const finalizedRows = rows.map((r, i) => ({
      ...r,
      label: r.label?.trim() ? r.label.trim() : `รายการที่ ${i + 1}`
    }));

    onSave({
      title: finalTitle,
      fieldConfig: {
        columns: finalizedColumns,
        rows: finalizedRows
      }
    });
    onClose();
  };

  return (
    <ModalWrapper onClose={onClose} maxWidth="max-w-4xl" closeOnBackdrop={false}>
      <div className="flex flex-col h-full max-h-[90vh]">
        {/* Header */}
        <div className="flex flex-col gap-2 p-4 sm:p-5 border-b border-slate-100 shrink-0">
          {/* Top row: Icon + View Switcher + Close Button */}
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-[#0F6659] flex items-center justify-center shrink-0">
              <Table size={18} />
            </div>

            <div className="flex items-center gap-2">
              {/* View Switcher: Builder vs Preview */}
              <div className="flex p-0.5 rounded-xl bg-slate-100 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setActiveTab("builder")}
                  className={`px-3 py-1.5 rounded-lg cursor-pointer transition-all ${
                    activeTab === "builder" ? "bg-white text-[#0F6659] font-bold shadow-2xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  ตั้งค่า
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("preview")}
                  className={`px-3 py-1.5 rounded-lg cursor-pointer transition-all flex items-center gap-1.5 ${
                    activeTab === "preview" ? "bg-white text-[#0F6659] font-bold shadow-2xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Eye size={13} />
                  <span>ตัวอย่าง</span>
                </button>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors"
                title="ปิด"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Bottom row: Title & Subtitle */}
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
              กำหนดตารางข้อมูล
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              ตั้งค่าแถว คอลัมน์ ประเภทข้อมูล และรวมยอดอัตโนมัติ
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mx-4 sm:mx-6 mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center justify-between">
            <span>⚠️ {errorMessage}</span>
            <button type="button" onClick={() => setErrorMessage(null)} className="text-rose-500 hover:text-rose-800">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Body Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {activeTab === "builder" ? (
            <>
              {/* 1. Grid Title & Quick Presets */}
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  {/* Presets */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-400 font-medium">ตัวอย่างแบบร่าง:</span>
                    <button
                      type="button"
                      onClick={() => applyPreset(CASH_AUDIT_PRESET)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[#0F6659] text-[11px] font-bold border border-emerald-200 cursor-pointer transition-all active:scale-95 flex items-center gap-1"
                    >
                      <span>ตรวจนับเงินสด</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset(EQUIPMENT_PRESET)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-[11px] font-bold border border-slate-200 cursor-pointer transition-all active:scale-95"
                    >
                      <span>ตรวจเช็คอุปกรณ์</span>
                    </button>
                  </div>
                </div>
                
                <label className="text-xs font-bold text-slate-700">
                  ชื่อหัวข้อ <span className="text-rose-500">*</span>
                </label>

                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="เช่น ตารางตรวจนับเงินสด, ตรวจนับสต็อกวัตถุดิบ..."
                  className="w-full text-sm font-semibold px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-[#0F6659] shadow-2xs"
                />
              </div>

              {/* 2. Columns Config */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-[#0F6659] text-white flex items-center justify-center text-[10px] font-bold">1</span>
                    <h4 className="text-sm font-bold text-slate-800">
                      กำหนดคอลัมน์ (Columns) ({columns.length})
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={addColumn}
                    className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-[#0F6659] text-xs font-bold border border-emerald-200 cursor-pointer flex items-center gap-1.5 transition-all active:scale-95"
                  >
                    <Plus size={14} />
                    <span>เพิ่มคอลัมน์</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {columns.map((col, idx) => (
                    <div
                      key={col.id || idx}
                      className="p-3 sm:p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300 transition-all space-y-2.5"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                        {/* Reorder and Col Index */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveColumn(idx, "up")}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                          >
                            <ChevronUp size={15} />
                          </button>
                          <button
                            type="button"
                            disabled={idx === columns.length - 1}
                            onClick={() => moveColumn(idx, "down")}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                          >
                            <ChevronDown size={15} />
                          </button>
                          <span className="text-xs font-mono font-bold text-slate-500 w-5 text-center">
                            #{idx + 1}
                          </span>
                        </div>

                        {/* Column Title */}
                        <div className="flex-1 min-w-0 relative">
                          <textarea
                            id={`grid-col-input-${col.id}`}
                            rows={1}
                            value={col.label || ""}
                            onChange={(e) => {
                              updateColumn(idx, { label: e.target.value });
                              e.target.style.height = 'auto';
                              e.target.style.height = `${e.target.scrollHeight}px`;
                            }}
                            onFocus={(e) => {
                              e.target.style.height = 'auto';
                              e.target.style.height = `${e.target.scrollHeight}px`;
                            }}
                            placeholder={`คอลัมน์ที่ ${idx + 1}`}
                            className="w-full text-xs sm:text-sm font-semibold pl-3 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-[#0F6659] resize-none overflow-hidden block transition-[height]"
                          />
                          <Pencil size={13} className="absolute right-2.5 top-3 text-slate-300 pointer-events-none" />
                        </div>

                        {/* Column Type Select */}
                        <div className="w-full sm:w-44 shrink-0 relative">
                          <select
                            value={col.type || "number"}
                            onChange={(e) => {
                              const newType = e.target.value;
                              updateColumn(idx, {
                                type: newType,
                                autoSum: newType === "number" ? col.autoSum : false
                              });
                            }}
                            className="w-full text-xs font-semibold pl-3 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-[#0F6659] cursor-pointer appearance-none"
                          >
                            <option value="number">ใส่จำนวน (Number)</option>
                            <option value="text">ใส่ข้อความ (Text)</option>
                            <option value="radio">ตัวเลือกเดียว (Radio)</option>
                            <option value="checkbox">หลายตัวเลือก (Checkbox)</option>
                          </select>
                          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>

                        {/* Auto Sum Toggle Switch (Only for number columns) */}
                        <div className="flex items-center justify-between sm:justify-start gap-2 shrink-0">
                          {col.type === "number" ? (
                            <label className="flex items-center gap-2 cursor-pointer select-none px-2 py-1 rounded-xl hover:bg-emerald-50/60 transition-colors">
                              <input
                                type="checkbox"
                                checked={!!col.autoSum}
                                onChange={(e) => updateColumn(idx, { autoSum: e.target.checked })}
                                className="w-4 h-4 rounded text-[#0F6659] focus:ring-[#0F6659] border-slate-300 cursor-pointer"
                              />
                              <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                                <Calculator size={13} className={col.autoSum ? "text-[#0F6659]" : "text-slate-400"} />
                                <span>รวมยอดท้ายตาราง</span>
                              </span>
                            </label>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic px-2">
                              (ไม่รองรับรวมยอด)
                            </span>
                          )}

                          {/* Delete Column Button */}
                          <button
                            type="button"
                            onClick={() => removeColumn(idx)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl cursor-pointer transition-colors"
                            title="ลบคอลัมน์นี้"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Rows Config */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-[#0F6659] text-white flex items-center justify-center text-[10px] font-bold">2</span>
                    <h4 className="text-sm font-bold text-slate-800">
                      กำหนดแถว (Rows) ({rows.length})
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={addRow}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-bold border border-slate-200 cursor-pointer flex items-center gap-1.5 transition-all active:scale-95"
                  >
                    <Plus size={14} />
                    <span>เพิ่มแถว</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {rows.map((row, idx) => (
                    <div
                      key={row.id || idx}
                      className="flex items-center gap-1.5 p-2 rounded-xl border border-slate-200 bg-white"
                    >
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveRow(idx, "up")}
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        type="button"
                        disabled={idx === rows.length - 1}
                        onClick={() => moveRow(idx, "down")}
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                      >
                        <ChevronDown size={14} />
                      </button>
                      <span className="text-[11px] font-mono text-slate-400 w-4 text-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="flex-1 relative">
                        <textarea
                          id={`grid-row-input-${row.id}`}
                          rows={1}
                          value={row.label || ""}
                          onChange={(e) => {
                            updateRow(idx, e.target.value);
                            e.target.style.height = 'auto';
                            e.target.style.height = `${e.target.scrollHeight}px`;
                          }}
                          onFocus={(e) => {
                            e.target.style.height = 'auto';
                            e.target.style.height = `${e.target.scrollHeight}px`;
                          }}
                          placeholder={`รายการที่ ${idx + 1}`}
                          className="w-full text-xs font-semibold pl-2.5 pr-7 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-[#0F6659] resize-none overflow-hidden block transition-[height]"
                        />
                        <Pencil size={12} className="absolute right-2 top-2 text-slate-300 pointer-events-none" />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeRow(idx)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                        title="ลบแถวนี้"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            /* PREVIEW TAB */
            <div className="space-y-4">
              <div>
                <h4 className="text-base font-bold text-slate-800">{title || "(ยังไม่ได้ตั้งชื่อตาราง)"}</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  นี่คือหน้าตาตัวอย่างของตารางที่ผู้ตรวจจะเห็นในหน้าจอ Live Audit
                </p>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-x-auto shadow-2xs">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700">
                      <th className="py-2.5 px-3 font-bold w-12 text-center">ลำดับ</th>
                      <th className="py-2.5 px-3 font-bold min-w-[140px]">รายการ</th>
                      {columns.map((col, cIdx) => (
                        <th key={col.id || cIdx} className="py-2.5 px-3 font-bold min-w-[130px]">
                          <div className="flex items-center gap-1">
                            <span>{col.label || `คอลัมน์ ${cIdx + 1}`}</span>
                            {col.autoSum && (
                              <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 text-[#0F6659] rounded font-mono font-bold">
                                รวมยอด
                              </span>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {rows.map((row, rIdx) => (
                      <tr key={row.id || rIdx} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-xs">
                          {rIdx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-800">
                          {row.label || `รายการที่ ${rIdx + 1}`}
                        </td>
                        {columns.map((col, cIdx) => (
                          <td key={col.id || cIdx} className="py-2 px-3">
                            {col.type === "number" && (
                              <input
                                type="number"
                                placeholder="0"
                                disabled
                                className="w-full py-1 px-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-xs font-mono outline-none"
                              />
                            )}
                            {col.type === "text" && (
                              <input
                                type="text"
                                placeholder="กรอกข้อความ..."
                                disabled
                                className="w-full py-1 px-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-xs outline-none"
                              />
                            )}
                            {col.type === "radio" && (
                              <div className="flex items-center justify-center py-1">
                                <input
                                  type="radio"
                                  name={`preview_row_${rIdx}`}
                                  disabled
                                  className="w-4 h-4 text-[#0F6659] border-slate-300"
                                />
                              </div>
                            )}
                            {col.type === "checkbox" && (
                              <div className="flex items-center justify-center py-1">
                                <input
                                  type="checkbox"
                                  disabled
                                  className="w-4 h-4 rounded text-[#0F6659] border-slate-300"
                                />
                              </div>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}

                    {/* Auto Sum Row if any column has autoSum enabled */}
                    {columns.some(c => c.autoSum) && (
                      <tr className="bg-emerald-50/70 font-bold border-t-2 border-emerald-200 text-emerald-950">
                        <td className="py-2.5 px-3 text-center font-mono">∑</td>
                        <td className="py-2.5 px-3">ยอดรวมทั้งหมด (Total)</td>
                        {columns.map((col, cIdx) => (
                          <td key={col.id || cIdx} className="py-2.5 px-3 font-mono">
                            {col.autoSum ? "0.00" : "-"}
                          </td>
                        ))}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/60 cursor-pointer transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#0F6659] text-white hover:bg-[#0c5247] cursor-pointer shadow-sm active:scale-95 flex items-center gap-1.5 transition-all"
            >
              <Check size={15} />
              <span>บันทึกตาราง</span>
            </button>
          </div>
        </div>
      </div>
    </ModalWrapper>
  );
}

