import React, { useRef, useEffect, useState, useMemo } from "react";
import { Clock, ChevronUp, ChevronDown } from "lucide-react";

const ITEM_HEIGHT = 44; // px per item
const VISIBLE_COUNT = 5; // 5 visible rows, middle is active (index 2)

function WheelColumn({ items, value, onChange, label }) {
  const containerRef = useRef(null);
  const isScrollingRef = useRef(false);
  const timeoutRef = useRef(null);

  const selectedIndex = useMemo(() => {
    const idx = items.indexOf(value);
    return idx >= 0 ? idx : 0;
  }, [items, value]);

  // Initial scroll position on mount and value changes
  useEffect(() => {
    if (!isScrollingRef.current && containerRef.current) {
      containerRef.current.scrollTop = selectedIndex * ITEM_HEIGHT;
    }
  }, [selectedIndex]);

  const handleScroll = (e) => {
    isScrollingRef.current = true;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    const scrollTop = e.target.scrollTop;
    const index = Math.round(scrollTop / ITEM_HEIGHT);
    const clampedIndex = Math.max(0, Math.min(items.length - 1, index));

    timeoutRef.current = setTimeout(() => {
      isScrollingRef.current = false;
      if (items[clampedIndex] !== value) {
        onChange(items[clampedIndex]);
      }
      // Snap to exact offset
      if (containerRef.current) {
        containerRef.current.scrollTo({
          top: clampedIndex * ITEM_HEIGHT,
          behavior: "smooth"
        });
      }
    }, 120);
  };

  const handleItemClick = (item, idx) => {
    onChange(item);
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: idx * ITEM_HEIGHT,
        behavior: "smooth"
      });
    }
  };

  const stepUp = () => {
    const nextIdx = Math.max(0, selectedIndex - 1);
    handleItemClick(items[nextIdx], nextIdx);
  };

  const stepDown = () => {
    const nextIdx = Math.min(items.length - 1, selectedIndex + 1);
    handleItemClick(items[nextIdx], nextIdx);
  };

  return (
    <div className="flex-1 flex flex-col items-center select-none">
      {/* Column Label */}
      <span className="text-[11px] font-bold text-slate-400 mb-1">{label}</span>

      {/* Up Button */}
      <button
        type="button"
        onClick={stepUp}
        className="w-full py-1 flex items-center justify-center text-slate-300 hover:text-[#0F6659] transition-colors cursor-pointer"
      >
        <ChevronUp size={16} />
      </button>

      {/* Roller Container */}
      <div className="relative w-full h-[220px] overflow-hidden rounded-2xl bg-white border border-slate-200/80 shadow-inner">
        {/* Center Active Highlight Frame */}
        <div
          className="absolute left-2 right-2 pointer-events-none rounded-xl bg-emerald-50/90 border border-emerald-400/80 shadow-xs z-10"
          style={{
            top: `${2 * ITEM_HEIGHT}px`,
            height: `${ITEM_HEIGHT}px`
          }}
        />

        {/* Top Fade Gradient */}
        <div className="absolute top-0 left-0 right-0 h-[88px] bg-gradient-to-b from-white via-white/80 to-transparent pointer-events-none z-20" />

        {/* Bottom Fade Gradient */}
        <div className="absolute bottom-0 left-0 right-0 h-[88px] bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none z-20" />

        {/* Scrollable Items List */}
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="w-full h-full overflow-y-auto overscroll-contain snap-y snap-mandatory scroll-smooth no-scrollbar"
          style={{
            paddingTop: `${2 * ITEM_HEIGHT}px`,
            paddingBottom: `${2 * ITEM_HEIGHT}px`
          }}
        >
          {items.map((item, idx) => {
            const isSelected = item === value;
            return (
              <div
                key={item}
                onClick={() => handleItemClick(item, idx)}
                style={{ height: `${ITEM_HEIGHT}px` }}
                className={`flex items-center justify-center cursor-pointer transition-all snap-center font-mono ${
                  isSelected
                    ? "text-[#0F6659] font-black text-xl scale-110 z-30"
                    : "text-slate-400 hover:text-slate-700 font-bold text-sm"
                }`}
              >
                {item}
              </div>
            );
          })}
        </div>
      </div>

      {/* Down Button */}
      <button
        type="button"
        onClick={stepDown}
        className="w-full py-1 flex items-center justify-center text-slate-300 hover:text-[#0F6659] transition-colors cursor-pointer"
      >
        <ChevronDown size={16} />
      </button>
    </div>
  );
}

export default function MobileTimePicker({
  value = "10:00",
  onChange,
  label = "เลือกเวลา"
}) {
  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")), []);
  const minutes = useMemo(() => ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"], []);

  const [currentHour, currentMinute] = useMemo(() => {
    const parts = (value || "10:00").split(":");
    return [parts[0] || "10", parts[1] || "00"];
  }, [value]);

  const handleHourChange = (newHour) => {
    onChange(`${newHour}:${currentMinute}`);
  };

  const handleMinuteChange = (newMinute) => {
    onChange(`${currentHour}:${newMinute}`);
  };

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Clock size={14} className="text-[#0F6659]" />
            <span>{label}</span>
          </label>
          <span className="text-xs font-black font-mono px-2.5 py-0.5 rounded-lg bg-emerald-100 text-[#0F6659]">
            {value} น.
          </span>
        </div>
      )}

      {/* 2-Column Wheel Roller (Hours & Minutes) */}
      <div className="p-3 bg-slate-50/90 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          {/* Hour Column */}
          <WheelColumn
            items={hours}
            value={currentHour}
            onChange={handleHourChange}
            label="ชั่วโมง (HH)"
          />

          {/* Colon Separator */}
          <div className="text-xl font-black text-slate-400 mt-5">:</div>

          {/* Minute Column */}
          <WheelColumn
            items={minutes}
            value={currentMinute}
            onChange={handleMinuteChange}
            label="นาที (MM)"
          />
        </div>
      </div>
    </div>
  );
}
