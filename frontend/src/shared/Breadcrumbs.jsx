import React from "react";
import { ChevronRight } from "lucide-react";

export default function Breadcrumbs({ items = [] }) {
  if (!items.length) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 px-1 py-1 overflow-x-auto no-scrollbar">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <React.Fragment key={index}>
            {item.onClick && !isLast ? (
              <button
                type="button"
                onClick={item.onClick}
                className="text-xs font-semibold text-slate-500 hover:text-[#0F6659] transition-colors whitespace-nowrap cursor-pointer hover:underline"
              >
                {item.label}
              </button>
            ) : (
              <span
                className={`text-xs whitespace-nowrap ${
                  isLast ? "font-bold text-[#0F6659]" : "text-slate-400 font-medium"
                }`}
              >
                {item.label}
              </span>
            )}

            {!isLast && (
              <ChevronRight size={13} className="text-slate-300 shrink-0 select-none" />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}