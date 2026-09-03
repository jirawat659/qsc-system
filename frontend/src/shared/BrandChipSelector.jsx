import React from 'react';
import { Check, Tag, Star } from 'lucide-react';

/**
 * BrandChipSelector — กด chip เพื่อเลือก/ยกเลิกแบรนด์ (multi-select แบบ filter)
 * รองรับการตั้ง "แบรนด์หลัก" (primary) ด้วยปุ่มดาว เมื่อส่ง primaryId + onSetPrimary มา
 *
 * Props:
 *  - brands: [{ id, name, code }]
 *  - selectedIds (หรือ value เป็นชื่อ alias เดียวกัน): number[]
 *  - onChange: (newSelectedIds: number[]) => void
 *  - mode: 'multi' | 'single'  (default 'multi')
 *  - size: 'sm' | 'md'         (default 'md')
 *  - primaryId?: number | null       — ถ้าส่งมา จะแสดงปุ่มดาวบนชิปที่ถูกเลือก
 *  - onSetPrimary?: (id: number) => void
 */
export default function BrandChipSelector({
  brands = [],
  selectedIds,
  value,
  onChange,
  mode = 'multi',
  size = 'md',
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

  const pad = size === 'sm' ? 'pl-3 pr-2.5 py-1.5 text-xs' : 'pl-3.5 pr-3 py-2 text-sm';

  if (!brands.length) {
    return <p className="text-xs text-slate-400 italic">ไม่มีแบรนด์ในระบบ</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {brands.map((b) => {
        const active = ids.includes(b.id);
        const isPrimary = active && onSetPrimary && primaryId === b.id;
        return (
          <button
            key={b.id}
            type="button"
            onClick={() => toggle(b.id)}
            className={`${pad} rounded-full border font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              active
                ? 'bg-[#0F6659] border-[#0F6659] text-white shadow-2xs'
                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            {active ? <Check size={14} strokeWidth={3} /> : <Tag size={14} className="opacity-50" />}
            {b.name}
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
                <Star size={13} fill={isPrimary ? 'currentColor' : 'none'} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}