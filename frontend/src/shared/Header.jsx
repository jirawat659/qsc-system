import React from "react";
import { ChevronLeft, Menu } from "lucide-react";
import { TopBarContext } from "../context/TopBarContext";

export default function Header({ 
  title, 
  onBack, 
  subtitle, 
  action, 
  isAudit = false,
  leftActionType = "back",
  sectionBadgeNumber = null,
  onMenuClick = null
}) {
  const { setSubHeader } = React.useContext(TopBarContext);
  const onBackRef = React.useRef(onBack);
  onBackRef.current = onBack;
  const onMenuClickRef = React.useRef(onMenuClick);
  onMenuClickRef.current = onMenuClick;
  const actionRef = React.useRef(action);
  actionRef.current = action;
  const titleRef = React.useRef(title);
  titleRef.current = title;
  const hasBack = Boolean(onBack);

  const listenersRef = React.useRef(new Set());
  const subscribeAction = React.useCallback((fn) => {
    listenersRef.current.add(fn);
    return () => listenersRef.current.delete(fn);
  }, []);

  React.useEffect(() => {
    listenersRef.current.forEach(fn => fn());
  }, [action]);

  // 1. Sync with mobile TopBarContext without triggering infinite re-render loops
  React.useEffect(() => {
    if (!title || !setSubHeader) return;

    setSubHeader(prev => {
      // If already matched, return identical reference so React bails out of re-renders
      if (
        prev &&
        prev.title === title &&
        prev.subtitle === subtitle &&
        prev.isAudit === isAudit &&
        prev.hasBack === hasBack &&
        prev.leftActionType === leftActionType &&
        prev.sectionBadgeNumber === sectionBadgeNumber
      ) {
        return prev;
      }

      return {
        title,
        subtitle,
        action: <ActionRenderer actionRef={actionRef} subscribe={subscribeAction} />,
        isAudit,
        hasBack,
        leftActionType,
        sectionBadgeNumber,
        onMenuClick: onMenuClick ? () => {
          if (onMenuClickRef.current) onMenuClickRef.current();
        } : null,
        onBack: hasBack ? () => {
          if (onBackRef.current) onBackRef.current();
        } : null
      };
    });
  }, [title, subtitle, hasBack, isAudit, leftActionType, sectionBadgeNumber, onMenuClick, setSubHeader, subscribeAction]);

  // 2. Clear subHeader ONLY when this Header component actually unmounts
  React.useEffect(() => {
    return () => {
      if (setSubHeader) {
        setSubHeader(null);
      }
    };
  }, [setSubHeader]);

  if (!title && !onBack) return null;

  return (
    <div className="hidden lg:flex items-center justify-between gap-3 pb-3 pt-1 animate-in fade-in duration-150">
      <div className="flex items-center gap-3.5 min-w-0">
        {onBack && (
          <button
            type="button"
            onClick={leftActionType === "menu" && onMenuClick ? onMenuClick : onBack}
            className="w-10 h-10 rounded-2xl bg-white hover:bg-emerald-50 hover:border-emerald-300 text-slate-700 hover:text-[#0F6659] border border-slate-200 shadow-2xs flex items-center justify-center cursor-pointer transition-all active:scale-90 shrink-0 group"
            title={leftActionType === "menu" ? "เปิดหมวดหมู่" : "ย้อนกลับ (Go Back)"}
          >
            {leftActionType === "menu" ? (
              <Menu size={20} className="text-[#0F6659]" />
            ) : (
              <ChevronLeft size={22} className="group-hover:-translate-x-0.5 transition-transform text-[#0F6659]" />
            )}
          </button>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {sectionBadgeNumber && (
              <span className="w-6 h-6 rounded-lg bg-[#0F6659] text-white flex items-center justify-center text-xs font-black shrink-0 shadow-2xs">
                {sectionBadgeNumber}
              </span>
            )}
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 leading-tight truncate">
              {title}
            </h1>
          </div>
          {subtitle && (
            <p className="text-xs font-normal text-slate-500 mt-0.5 truncate">
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

function ActionRenderer({ actionRef, subscribe }) {
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    if (!subscribe) return;
    return subscribe(() => setTick(t => t + 1));
  }, [subscribe]);
  return actionRef.current || null;
}