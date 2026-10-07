import React, { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ChevronRight } from "lucide-react";
import { c, sans, mono, cardStyle } from "../config/theme";
import { TopBarContext } from "../context/TopBarContext";
import { DataContext } from "../context/DataContext";

import ScoreRing from "./ScoreRing";

export default function HistoryList({ history, onSelect }) {
  if (!history || !history.length) {
    return <div className="text-xs py-5 text-center rounded-2xl font-bold text-slate-400 bg-white border border-dashed border-slate-200">ยังไม่มีประวัติการตรวจ</div>;
  }
  return (
    <div className="flex flex-col gap-2.5">
      {history.map((h, i) => {
        const isPassed = h.isPassed !== undefined ? h.isPassed : (h.score >= (h.passingScore || 85));
        return (
          <button
            key={i}
            type="button"
            onClick={onSelect ? () => onSelect(h) : undefined}
            className="w-full rounded-2xl p-3.5 sm:p-4 bg-white border border-slate-200 shadow-2xs hover:border-emerald-500 hover:shadow-xs transition-all cursor-pointer flex items-center justify-between gap-3 text-left group active:scale-98"
          >
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              <ScoreRing score={h.score} size={38} />
              <div className="min-w-0 flex-1">
                <div className="text-sm sm:text-base font-bold text-slate-900 leading-snug group-hover:text-[#0F6659] transition-colors">
                  วันที่ {h.date}
                </div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs font-medium text-slate-600">
                    ผู้ตรวจ: {h.auditor || "สมชาย ใจดี"}
                  </span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${
                    isPassed ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
                  }`}>
                    {isPassed ? "✓ ผ่านเกณฑ์" : "⚠️ มีงานแก้ไข"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 text-[#0F6659] font-bold text-xs group-hover:bg-[#0F6659] group-hover:text-white transition-all shrink-0">
              <span>ดูรายงาน</span>
              <ChevronRight size={14} />
            </div>
          </button>
        );
      })}
    </div>
  );
}
