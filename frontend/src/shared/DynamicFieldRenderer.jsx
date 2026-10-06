import React, { useMemo } from "react";
import {
  Calculator,
  Plus,
  Minus,
  Check,
  ChevronDown,
  Calendar,
  Clock,
  User,
  Hash,
  Table,
  CheckSquare
} from "lucide-react";
import MultiItemAuditCard from "../modals/MultiItemAuditCard";

/**
 * 🌟 DynamicFieldRenderer
 * Renders non-scored custom fields across:
 * - LiveAuditScreen (Conducting audit)
 * - AuditHistoryDetail (Read-only viewing)
 * - EditAuditRecordModal (Editing audit results)
 *
 * Supported Types:
 * 1. "grid"     : Interactive table with rows, columns, auto-sum, and cell types (number, text, radio, checkbox)
 * 2. "multians" : Multi-criteria evaluation card
 * 3. "number"   : Number input with [-] / [+] steppers and unit label
 * 4. "select"   : Dropdown selector
 * 5. "radio"    : Single-choice radio buttons
 * 6. "checkbox" : Multiple-choice checkboxes
 * 7. "text"     : Text input / textarea
 * 8. "date"     : Date picker
 * 9. "time"     : Time picker
 * 10. "auditor" : Auditor selector
 */
export default function DynamicFieldRenderer({
  type = "text",
  fieldConfig = {},
  value,
  onChange,
  readOnly = false,
  placeholder = "",
  label = "",
  auditorOptions = []
}) {
  const normType = String(type || "text").toLowerCase();

  // ==========================================
  // 0. MULTI-ANSWER EVALUATION (MULTIANS)
  // ==========================================
  if (normType === "multians") {
    return (
      <MultiItemAuditCard
        question={{ fieldConfig }}
        value={value}
        onChange={onChange}
        readOnly={readOnly}
      />
    );
  }

  // ==========================================
  // 1. GRID / TABLE DATA
  // ==========================================
  if (normType === "grid") {
    const columns = fieldConfig?.columns || [];
    const rows = fieldConfig?.rows || [];

    // Parse cell values safely
    const gridData = useMemo(() => {
      if (!value) return {};
      if (typeof value === "object") return value;
      try {
        const parsed = JSON.parse(value);
        return typeof parsed === "object" && parsed !== null ? parsed : {};
      } catch (e) {
        return {};
      }
    }, [value]);

    const updateCell = (rowId, colId, cellVal) => {
      if (readOnly || !onChange) return;
      const next = { ...gridData, [`${rowId}_${colId}`]: cellVal };
      onChange(JSON.stringify(next));
    };

    const handleRadioCell = (rowId, colId) => {
      if (readOnly || !onChange) return;
      const next = { ...gridData };
      // Clear other radio columns in the same row
      columns.filter(c => c.type === "radio").forEach(c => {
        delete next[`${rowId}_${c.id}`];
      });
      next[`${rowId}_${colId}`] = true;
      onChange(JSON.stringify(next));
    };

    const handleCheckboxCell = (rowId, colId) => {
      if (readOnly || !onChange) return;
      const current = Boolean(gridData[`${rowId}_${colId}`]);
      const next = { ...gridData, [`${rowId}_${colId}`]: !current };
      onChange(JSON.stringify(next));
    };

    // Calculate sums for number columns
    const hasAnyAutoSum = columns.some(c => c.autoSum);

    return (
      <div className="w-full space-y-2">
        <div className="overflow-x-auto rounded-2xl border border-slate-200/90 bg-white shadow-2xs">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                <th className="py-2.5 px-3 w-10 text-center font-mono">#</th>
                <th className="py-2.5 px-3 min-w-[130px] sm:min-w-[160px]">รายการ</th>
                {columns.map((col, cIdx) => (
                  <th
                    key={col.id || cIdx}
                    className={`py-2.5 px-3 whitespace-nowrap ${
                      col.type === "number" ? "text-right" : col.type === "radio" || col.type === "checkbox" ? "text-center" : "text-left"
                    }`}
                  >
                    <div className={`inline-flex items-center gap-1 ${col.type === "number" ? "justify-end" : col.type === "radio" || col.type === "checkbox" ? "justify-center" : "justify-start"}`}>
                      <span>{col.label}</span>
                      {col.autoSum && (
                        <span className="text-[10px] px-1 py-0.2 rounded bg-emerald-100 text-[#0F6659] font-bold" title="รวมยอดท้ายตาราง">
                          ∑
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {rows.map((row, rIdx) => (
                <tr key={row.id || rIdx} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px] select-none">
                    {rIdx + 1}
                  </td>
                  <td className="py-2 px-3 font-semibold text-slate-800 text-xs sm:text-sm">
                    {row.label}
                  </td>
                  {columns.map((col, cIdx) => {
                    const cellKey = `${row.id}_${col.id}`;
                    const cellVal = gridData[cellKey];

                    if (col.type === "radio") {
                      const isChecked = Boolean(cellVal);
                      return (
                        <td key={col.id || cIdx} className="py-2 px-3 text-center">
                          {readOnly ? (
                            <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${isChecked ? "bg-emerald-600 text-white" : "text-slate-300"}`}>
                              {isChecked ? "●" : "○"}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleRadioCell(row.id, col.id)}
                              className={`w-6 h-6 rounded-full border flex items-center justify-center mx-auto transition-all cursor-pointer ${
                                isChecked
                                  ? "bg-emerald-600 border-emerald-600 text-white shadow-2xs ring-2 ring-emerald-600/30"
                                  : "border-slate-300 bg-white hover:border-emerald-500"
                              }`}
                            >
                              {isChecked && <span className="w-2.5 h-2.5 rounded-full bg-white" />}
                            </button>
                          )}
                        </td>
                      );
                    }

                    if (col.type === "checkbox") {
                      const isChecked = Boolean(cellVal);
                      return (
                        <td key={col.id || cIdx} className="py-2 px-3 text-center">
                          {readOnly ? (
                            <span className={`inline-flex items-center justify-center w-5 h-5 rounded-md ${isChecked ? "bg-emerald-600 text-white" : "text-slate-300"}`}>
                              {isChecked ? "✓" : "—"}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleCheckboxCell(row.id, col.id)}
                              className={`w-5 h-5 rounded-md border flex items-center justify-center mx-auto transition-all cursor-pointer ${
                                isChecked
                                  ? "bg-emerald-600 border-emerald-600 text-white shadow-2xs"
                                  : "border-slate-300 bg-white hover:border-emerald-500"
                              }`}
                            >
                              {isChecked && <Check size={13} strokeWidth={3} />}
                            </button>
                          )}
                        </td>
                      );
                    }

                    if (col.type === "number") {
                      return (
                        <td key={col.id || cIdx} className="py-2 px-3 text-right">
                          {readOnly ? (
                            <span className="font-mono font-bold text-slate-800 text-xs sm:text-sm">
                              {cellVal !== undefined && cellVal !== "" ? Number(cellVal).toLocaleString() : "—"}
                            </span>
                          ) : (
                            <input
                              type="number"
                              value={cellVal !== undefined ? cellVal : ""}
                              onChange={(e) => updateCell(row.id, col.id, e.target.value)}
                              placeholder="0"
                              className="w-24 sm:w-28 text-right text-xs sm:text-sm font-mono font-bold py-1.5 px-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-[#0F6659] focus:ring-1 focus:ring-[#0F6659] shadow-2xs"
                            />
                          )}
                        </td>
                      );
                    }

                    // Default: Text
                    return (
                      <td key={col.id || cIdx} className="py-2 px-3 text-left">
                        {readOnly ? (
                          <span className="text-slate-800 text-xs font-medium">
                            {cellVal || "—"}
                          </span>
                        ) : (
                          <input
                            type="text"
                            value={cellVal !== undefined ? cellVal : ""}
                            onChange={(e) => updateCell(row.id, col.id, e.target.value)}
                            placeholder="ระบุข้อความ..."
                            className="w-full text-xs font-medium py-1.5 px-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-[#0F6659] shadow-2xs"
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {/* 🌟 AUTO-SUM FOOTER ROW */}
              {hasAnyAutoSum && (
                <tr className="bg-emerald-50/70 border-t-2 border-emerald-200 font-bold text-slate-900">
                  <td colSpan={2} className="py-2.5 px-3 text-right font-extrabold text-xs sm:text-sm text-[#0F6659]">
                    <div className="flex items-center justify-end gap-1.5">
                      <Calculator size={14} className="text-[#0F6659]" />
                      <span>รวมยอดทั้งหมด (Total):</span>
                    </div>
                  </td>
                  {columns.map((col, cIdx) => {
                    if (col.autoSum) {
                      const total = rows.reduce((sum, r) => {
                        const raw = gridData[`${r.id}_${col.id}`];
                        const n = parseFloat(raw);
                        return sum + (isNaN(n) ? 0 : n);
                      }, 0);
                      return (
                        <td key={col.id || cIdx} className="py-2.5 px-3 text-right font-mono font-black text-[#0F6659] text-xs sm:text-base">
                          {total.toLocaleString()}
                        </td>
                      );
                    }
                    return <td key={col.id || cIdx} className="py-2.5 px-3 text-center text-slate-300 font-mono">—</td>;
                  })}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ==========================================
  // 2. NUMBER WITH STEPPERS [-] [+]
  // ==========================================
  if (normType === "number") {
    const numVal = value !== undefined && value !== null && value !== "" ? Number(value) : 0;
    const unit = fieldConfig?.unit || "";

    const handleStep = (delta) => {
      if (readOnly || !onChange) return;
      const nextVal = Math.max(0, numVal + delta);
      onChange(nextVal);
    };

    if (readOnly) {
      return (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-800">
          <span className="font-mono font-bold text-base text-[#0F6659]">
            {value !== undefined && value !== null && value !== "" ? Number(value).toLocaleString() : "0"}
          </span>
          {unit && <span className="text-xs font-semibold text-slate-600">{unit}</span>}
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 flex-wrap">
        <div className="inline-flex items-center rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden p-1">
          <button
            type="button"
            onClick={() => handleStep(-1)}
            disabled={numVal <= 0}
            className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-slate-100 text-slate-700 flex items-center justify-center cursor-pointer transition-colors active:scale-95 shrink-0"
            title="ลด 1"
          >
            <Minus size={16} strokeWidth={2.5} />
          </button>

          <input
            type="number"
            value={value !== undefined && value !== null ? value : ""}
            onChange={(e) => onChange && onChange(e.target.value === "" ? "" : Number(e.target.value))}
            placeholder="0"
            className="w-20 sm:w-24 text-center font-mono font-black text-sm sm:text-base text-slate-800 outline-none bg-transparent"
          />

          <button
            type="button"
            onClick={() => handleStep(1)}
            className="w-10 h-10 rounded-xl bg-[#0F6659] hover:bg-emerald-800 text-white flex items-center justify-center cursor-pointer transition-colors active:scale-95 shadow-2xs shrink-0"
            title="เพิ่ม 1"
          >
            <Plus size={16} strokeWidth={2.5} />
          </button>
        </div>

        {unit && (
          <span className="px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 shadow-2xs">
            {unit}
          </span>
        )}
      </div>
    );
  }

  // ==========================================
  // 3. DROPDOWN (SELECT)
  // ==========================================
  if (normType === "select") {
    const options = fieldConfig?.options || [];
    const currentVal = value !== undefined && value !== null ? String(value) : "";

    if (readOnly) {
      return (
        <span className="inline-flex items-center px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[#0F6659] text-xs font-bold shadow-2xs">
          {currentVal || "—"}
        </span>
      );
    }

    return (
      <div className="relative max-w-sm w-full">
        <select
          value={currentVal}
          onChange={(e) => onChange && onChange(e.target.value)}
          className="w-full text-xs sm:text-sm pl-4 pr-10 py-2.5 rounded-xl border border-slate-200 bg-white font-semibold text-slate-800 focus:outline-none focus:border-[#0F6659] shadow-2xs cursor-pointer appearance-none"
        >
          <option value="">-- กรุณาเลือก --</option>
          {options.map((opt, i) => (
            <option key={i} value={opt}>{opt}</option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
          <ChevronDown size={16} />
        </div>
      </div>
    );
  }

  // ==========================================
  // 4. RADIO (SINGLE CHOICE)
  // ==========================================
  if (normType === "radio") {
    const options = fieldConfig?.options || [];
    const currentVal = value !== undefined && value !== null ? String(value) : "";

    if (readOnly) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[#0F6659] text-xs font-bold shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-[#0F6659]" />
          <span>{currentVal || "—"}</span>
        </span>
      );
    }

    return (
      <div className="flex flex-wrap items-center gap-2">
        {options.map((opt, i) => {
          const isSelected = currentVal === opt;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onChange && onChange(opt)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-2 active:scale-95 shadow-2xs ${
                isSelected
                  ? "bg-[#0F6659] text-white border-[#0F6659] ring-2 ring-[#0F6659]/30"
                  : "bg-white text-slate-700 border-slate-200 hover:border-emerald-300 hover:bg-slate-50"
              }`}
            >
              <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${isSelected ? "border-white bg-white" : "border-slate-300 bg-white"}`}>
                {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-[#0F6659]" />}
              </span>
              <span>{opt}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // ==========================================
  // 5. CHECKBOX (MULTI CHOICE)
  // ==========================================
  if (normType === "checkbox") {
    const options = fieldConfig?.options || [];
    const selectedList = useMemo(() => {
      if (!value) return [];
      if (Array.isArray(value)) return value;
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [String(value)];
      } catch (e) {
        return [String(value)];
      }
    }, [value]);

    const handleToggle = (opt) => {
      if (readOnly || !onChange) return;
      const next = selectedList.includes(opt)
        ? selectedList.filter(o => o !== opt)
        : [...selectedList, opt];
      onChange(JSON.stringify(next));
    };

    if (readOnly) {
      if (selectedList.length === 0) {
        return <span className="text-slate-400 text-xs italic">—</span>;
      }
      return (
        <div className="flex flex-wrap items-center gap-1.5">
          {selectedList.map((opt, i) => (
            <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-[#0F6659] text-xs font-bold shadow-2xs">
              <Check size={12} strokeWidth={3} />
              <span>{opt}</span>
            </span>
          ))}
        </div>
      );
    }

    return (
      <div className="flex flex-wrap items-center gap-2">
        {options.map((opt, i) => {
          const isSelected = selectedList.includes(opt);
          return (
            <button
              key={i}
              type="button"
              onClick={() => handleToggle(opt)}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-2 active:scale-95 shadow-2xs ${
                isSelected
                  ? "bg-emerald-50 border-emerald-400 text-[#0F6659] ring-2 ring-emerald-400/20"
                  : "bg-white text-slate-700 border-slate-200 hover:border-emerald-300 hover:bg-slate-50"
              }`}
            >
              <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                isSelected ? "bg-[#0F6659] border-[#0F6659] text-white" : "border-slate-300 bg-white"
              }`}>
                {isSelected && <Check size={11} strokeWidth={3} />}
              </div>
              <span>{opt}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // ==========================================
  // 6. DATE PICKER
  // ==========================================
  if (normType === "date") {
    const dateVal = value !== undefined && value !== null ? String(value) : "";
    if (readOnly) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 text-xs font-semibold shadow-2xs">
          <Calendar size={13} className="text-[#0F6659]" />
          <span>{dateVal || "—"}</span>
        </span>
      );
    }

    return (
      <div className="relative max-w-xs w-full">
        <input
          type="date"
          value={dateVal}
          onChange={(e) => onChange && onChange(e.target.value)}
          className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white font-semibold text-slate-800 focus:outline-none focus:border-[#0F6659] shadow-2xs"
        />
      </div>
    );
  }

  // ==========================================
  // 7. TIME PICKER
  // ==========================================
  if (normType === "time") {
    const timeVal = value !== undefined && value !== null ? String(value) : "";
    if (readOnly) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 text-xs font-semibold shadow-2xs">
          <Clock size={13} className="text-[#0F6659]" />
          <span>{timeVal || "—"}</span>
        </span>
      );
    }

    return (
      <div className="relative max-w-xs w-full">
        <input
          type="time"
          value={timeVal}
          onChange={(e) => onChange && onChange(e.target.value)}
          className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white font-semibold text-slate-800 focus:outline-none focus:border-[#0F6659] shadow-2xs"
        />
      </div>
    );
  }

  // ==========================================
  // 8. AUDITOR SELECT
  // ==========================================
  if (normType === "auditor") {
    const auditorVal = value !== undefined && value !== null ? String(value) : "";
    if (readOnly) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[#0F6659] text-xs font-bold shadow-2xs">
          <User size={13} className="text-[#0F6659]" />
          <span>{auditorVal || "—"}</span>
        </span>
      );
    }

    return (
      <div className="relative max-w-sm w-full">
        <select
          value={auditorVal}
          onChange={(e) => onChange && onChange(e.target.value)}
          className="w-full text-xs sm:text-sm pl-4 pr-10 py-2.5 rounded-xl border border-slate-200 bg-white font-semibold text-slate-800 focus:outline-none focus:border-[#0F6659] shadow-2xs cursor-pointer appearance-none"
        >
          <option value="">-- เลือกผู้ตรวจ --</option>
          {auditorOptions.map((u, i) => (
            <option key={u.id || i} value={u.fullName || u.name || u}>{u.fullName || u.name || u}</option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
          <ChevronDown size={16} />
        </div>
      </div>
    );
  }

  // ==========================================
  // 9. TEXT / TEXTAREA (DEFAULT)
  // ==========================================
  const textVal = value !== undefined && value !== null ? String(value) : "";
  if (readOnly) {
    return (
      <p className="text-xs sm:text-sm text-slate-800 font-medium leading-relaxed whitespace-pre-wrap">
        {textVal || "—"}
      </p>
    );
  }

  return (
    <textarea
      rows={2}
      value={textVal}
      onChange={(e) => onChange && onChange(e.target.value)}
      placeholder={placeholder || "พิมพ์รายละเอียดที่นี่..."}
      className="w-full text-xs sm:text-sm p-3 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:border-[#0F6659] shadow-2xs resize-y"
    />
  );
}

