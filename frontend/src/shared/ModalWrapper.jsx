import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { c } from "../config/theme";
import { lockBodyScroll, unlockBodyScroll } from "../utils/scrollLock";

export default function ModalWrapper({ children, onClose, maxWidth = "max-w-2xl", closeOnBackdrop = false, zIndex = 9999 }) {
  useEffect(() => {
    lockBodyScroll();
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && onClose) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      unlockBodyScroll();
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const content = (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-x-hidden overflow-y-auto overscroll-contain animate-in fade-in duration-200 h-[100dvh] w-full max-w-full"
      style={{ zIndex }}
      onClick={closeOnBackdrop ? onClose : undefined}
      onTouchMove={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
        }
      }}
    >
      <div
        className={`modal-transition bg-white rounded-3xl ${maxWidth} w-full max-w-full shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[90dvh] my-auto border transform-gpu overscroll-contain`}
        style={{ borderColor: c.border, transform: 'translateZ(0)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );

  if (typeof document !== "undefined") {
    return createPortal(content, document.body);
  }
  return content;
}
