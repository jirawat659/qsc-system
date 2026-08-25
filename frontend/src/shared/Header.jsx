import React from "react";
import { ChevronLeft } from "lucide-react";
import { TopBarContext } from "../context/TopBarContext";

export default function Header({ title, onBack, subtitle, action }) {
  const { setSubHeader } = React.useContext(TopBarContext);
  const onBackRef = React.useRef(onBack);
  onBackRef.current = onBack;
  const hasBack = Boolean(onBack);

  // Sync with mobile TopBarContext
  React.useEffect(() => {
    if (title) {
      setSubHeader({
        title,
        subtitle,
        onBack: hasBack ? () => {
          if (onBackRef.current) onBackRef.current();
        } : null
      });
      return () => setSubHeader(null);
    }
  }, [title, subtitle, hasBack, setSubHeader]);

  if (!title && !onBack) return null;

  // 🌟 DESKTOP & TABLET HEADER (lg:flex):
  // Renders a sleek top bar with prominent Back button, Title & Subtitle
  return (
    <div className="hidden lg:flex items-center justify-between gap-3 pb-3 pt-1 animate-in fade-in duration-150">
      <div className="flex items-center gap-3.5 min-w-0">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="w-10 h-10 rounded-2xl bg-white hover:bg-emerald-50 hover:border-emerald-300 text-slate-700 hover:text-[#0F6659] border border-slate-200 shadow-2xs flex items-center justify-center cursor-pointer transition-all active:scale-90 shrink-0 group"
            title="ย้อนกลับ (Go Back)"
          >
            <ChevronLeft size={22} className="group-hover:-translate-x-0.5 transition-transform text-[#0F6659]" />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 leading-tight truncate tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs font-bold text-slate-400 mt-0.5 truncate">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {action && (
        <div className="shrink-0">
          {action}
        </div>
      )}
    </div>
  );
}
