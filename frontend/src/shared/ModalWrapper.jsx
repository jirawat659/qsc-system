import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { c } from "../config/theme";

export default function ModalWrapper({ children, onClose, maxWidth = "max-w-2xl", closeOnBackdrop = false }) {
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && onClose) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const content = (
    <div
      className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-x-hidden overflow-y-auto overscroll-contain animate-in fade-in duration-200 h-[100dvh] w-full max-w-full"
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        className={`modal-transition bg-white rounded-3xl ${maxWidth} w-full max-w-full shadow-2xl overflow-hidden flex flex-col max-h-[85dvh] sm:max-h-[88dvh] my-auto border transform-gpu`}
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
