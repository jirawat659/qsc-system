let openModalCount = 0;
let previousBodyOverflow = "";
let previousHtmlOverflow = "";

export function lockBodyScroll() {
  if (typeof document === "undefined") return;
  if (openModalCount === 0) {
    previousBodyOverflow = document.body.style.overflow;
    previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
  }
  openModalCount++;
}

export function unlockBodyScroll() {
  if (typeof document === "undefined") return;
  openModalCount = Math.max(0, openModalCount - 1);
  if (openModalCount === 0) {
    document.body.style.overflow = previousBodyOverflow || "";
    document.documentElement.style.overflow = previousHtmlOverflow || "";
  }
}

export function forceUnlockBodyScroll() {
  if (typeof document === "undefined") return;
  openModalCount = 0;
  document.body.style.overflow = "";
  document.documentElement.style.overflow = "";
}

