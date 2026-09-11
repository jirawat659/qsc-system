import React from 'react';
import { Check, Tag } from "lucide-react";

/**
 * BrandChipSelector — กด chip เพื่อเลือก/ยกเลิกแบรนด์ (multi-select แบบ filter)
 *
 * หมายเหตุ: เดิมรองรับการตั้ง "แบรนด์หลัก" (primary) ด้วยปุ่มดาว แต่แนวคิดนี้ถูก
 * ถอดออกทั้งระบบแล้ว (ลบคอลัมน์ IsPrimary ออกจาก LocationBrand — ดู Phase 4.1)
 * จึงตัดฟีเจอร์นี้ออกจากคอมโพเนนต์ด้วย ไม่ให้เหลือ UI ที่กดแล้วไม่มีผลอะไร
 *
 * Props:
 *  - brands: [{ id, name, code }]
 *  - selectedIds (หรือ value เป็นชื่อ alias เดียวกัน): number[]
 *  - onChange: (newSelectedIds: number[]) => void
 *  - mode: 'multi' | 'single'  (default 'multi')
 *  - size: 'xs' | 'sm' | 'md'  (default 'sm')
 */
export default function BrandChipSelector({
  brands = [],
  selectedIds,
  value,
  onChange,
  mode = 'multi',
  size = 'sm',
  activeOnly = false,
}) {
  const ids = selectedIds ?? value ?? [];
  const list = activeOnly ? brands.filter((b) => b.isActive !== false) : brands;

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

  if (!list.length) {
    return <p className="text-xs text-slate-400 italic">ไม่มีแบรนด์ในระบบ</p>;
  }

  return (
    <div className="flex flex-wrap gap-1.5 max-w-full overflow-hidden">
      {list.map((b) => {
        const active = ids.includes(b.id);
        const isDeactivated = b.isActive === false;
        return (
          <button
            key={b.id}
            type="button"
            onClick={() => toggle(b.id)}
            className={`${pad} rounded-full border font-semibold flex items-center transition-all cursor-pointer max-w-full truncate ${
              active
                ? 'bg-[#0F6659] border-[#0F6659] text-white shadow-2xs'
                : isDeactivated
                ? 'bg-slate-50 border-dashed border-slate-300 text-slate-400 hover:border-slate-400'
                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            {active ? <Check size={iconSize} strokeWidth={2.5} /> : <Tag size={iconSize} className="opacity-50" />}
            <span className="truncate">{b.name}</span>
            {isDeactivated && (
              <span className="text-[10px] text-rose-500 font-normal ml-0.5 shrink-0">(ปิดใช้งาน)</span>
            )}
          </button>
        );
      })}
    </div>
  );
}