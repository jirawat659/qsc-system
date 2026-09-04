import React from 'react';
import { Check, Tag, Star } from "lucide-react";

/**
 * BrandChipSelector — กด chip เพื่อเลือก/ยกเลิกแบรนด์ (multi-select แบบ filter)
 * รองรับการตั้ง "แบรนด์หลัก" (primary) ด้วยปุ่มดาว เมื่อส่ง primaryId + onSetPrimary มา
 *
 * Props:
 *  - brands: [{ id, name, code }]
 *  - selectedIds (หรือ value เป็นชื่อ alias เดียวกัน): number[]
 *  - onChange: (newSelectedIds: number[]) => void
 *  - mode: 'multi' | 'single'  (default 'multi')
 *  - size: 'xs' | 'sm' | 'md'  (default 'sm')
 *  - primaryId?: number | null       — ถ้าส่งมา จะแสดงปุ่มดาวบนชิปที่ถูกเลือก
 *  - onSetPrimary?: (id: number) => void
 */
export default function BrandChipSelector({
  brands = [],
  selectedIds,
  value,
  onChange,
  mode = 'multi',
  size = 'sm',
  primaryId = null,
  onSetPrimary,
}) {
  const ids = selectedIds ?? value ?? [];

  const toggle = (id) => {
    if (mode === 'single') {
      onChange(ids[0] === id ? [] : [id]);
      return;
    }
    onChange(
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
    );
  };

  const pad =
    size === 'xs'
      ? 'px-2 py-0.5 text-[11px] gap-1'
      : size === 'md'
      ? 'px-3 py-1.5 text-xs sm:text-sm gap-1.5'
      : 'px-2.5 py-1 text-xs gap-1.5';

  const iconSize = size === 'xs' ? 11 : size === 'md' ? 13 : 12;

  if (!brands.length) {
    return <p className="text-xs text-slate-400 italic">ไม่มีแบรนด์ในระบบ</p>;
  }

  return (
    <div className="flex flex-wrap gap-1.5 max-w-full overflow-hidden">
      {brands.map((b) => {
        const active = ids.includes(b.id);
        const isPrimary = active && onSetPrimary && primaryId === b.id;
        return (
          <button
            key={b.id}
            type="button"
            onClick={() => toggle(b.id)}
            className={`${pad} rounded-full border font-semibold flex items-center transition-all cursor-pointer max-w-full truncate ${
              active
                ? 'bg-[#0F6659] border-[#0F6659] text-white shadow-2xs'
                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            {active ? <Check size={iconSize} strokeWidth={2.5} /> : <Tag size={iconSize} className="opacity-50" />}
            <span className="truncate">{b.name}</span>
            {active && onSetPrimary && (
              <span
                role="button"
                title={isPrimary ? 'แบรนด์หลัก' : 'ตั้งเป็นแบรนด์หลัก'}
                onClick={(e) => {
                  e.stopPropagation();
                  onSetPrimary(b.id);
                }}
                className="ml-0.5 -mr-1 p-0.5 rounded-full hover:bg-white/20"
              >
                <Star size={iconSize} fill={isPrimary ? 'currentColor' : 'none'} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}