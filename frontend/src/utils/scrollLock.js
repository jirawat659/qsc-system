let openModalCount = 0;
let scrollY = 0;
let previousBodyOverflow = "";
let previousHtmlOverflow = "";
let previousBodyPosition = "";
let previousBodyTop = "";
let previousBodyLeft = "";
let previousBodyRight = "";
let previousBodyWidth = "";
let previousBodyPaddingRight = "";
const lockedMainElements = [];

export function lockBodyScroll() {
  if (typeof document === "undefined") return;

  if (openModalCount === 0) {
    scrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;

    previousBodyOverflow = document.body.style.overflow;
    previousHtmlOverflow = document.documentElement.style.overflow;
    previousBodyPosition = document.body.style.position;
    previousBodyTop = document.body.style.top;
    previousBodyLeft = document.body.style.left;
    previousBodyRight = document.body.style.right;
    previousBodyWidth = document.body.style.width;
    previousBodyPaddingRight = document.body.style.paddingRight;

    // Prevent layout shift from scrollbar disappearing on desktop
    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollBarWidth > 0) {
      document.body.style.paddingRight = `${scrollBarWidth}px`;
    }

    // 📱 Bulletproof Mobile Scroll Lock:
    // On iOS Safari and Mobile Chrome, overflow: hidden on body/html DOES NOT stop touch dragging.
    // Setting position: fixed with top: -scrollY completely freezes background scrolling.
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";

    // Also freeze any scrollable <main> container in the app
    lockedMainElements.length = 0;
    const mains = document.querySelectorAll('main');
    mains.forEach(m => {
      lockedMainElements.push({ element: m, overflow: m.style.overflow });
      m.style.overflow = 'hidden';
    });
  }
  openModalCount++;
}

export function unlockBodyScroll() {
  if (typeof document === "undefined") return;
  openModalCount = Math.max(0, openModalCount - 1);

  if (openModalCount === 0) {
    document.body.style.overflow = previousBodyOverflow || "";
    document.documentElement.style.overflow = previousHtmlOverflow || "";
    document.body.style.position = previousBodyPosition || "";
    document.body.style.top = previousBodyTop || "";
    document.body.style.left = previousBodyLeft || "";
    document.body.style.right = previousBodyRight || "";
    document.body.style.width = previousBodyWidth || "";
    document.body.style.paddingRight = previousBodyPaddingRight || "";

    // Restore scrollable <main> elements
    lockedMainElements.forEach(({ element, overflow }) => {
      if (element) element.style.overflow = overflow || "";
    });
    lockedMainElements.length = 0;

    // Restore scroll position
    window.scrollTo(0, scrollY);
  }
}

export function forceUnlockBodyScroll() {
  if (typeof document === "undefined") return;
  openModalCount = 0;
  document.body.style.overflow = "";
  document.documentElement.style.overflow = "";
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.width = "";
  document.body.style.paddingRight = "";

  lockedMainElements.forEach(({ element, overflow }) => {
    if (element) element.style.overflow = overflow || "";
  });
  lockedMainElements.length = 0;
}

