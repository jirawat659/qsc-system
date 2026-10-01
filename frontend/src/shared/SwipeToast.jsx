'use client';

import { useEffect, useRef, useState } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon } from '@hugeicons/core-free-icons';

const SWIPE_TOAST_CSS = `
.swipe-toast {
  --st-bg: #0F6659;
  --st-ink: #ffffff;
  --st-fuse: #34d399;
  --st-fuse-h: 2.5px;
  --st-w: 380px;
  --st-radius: 16px;
  --st-slide: 380ms;
  --st-gap: 10px;
  --st-offset: 20px;
  --st-z: 999999999;
  --st-ease-out: cubic-bezier(0.23, 1, 0.32, 1);

  display: grid;
  grid-template-rows: 1fr;
  width: min(var(--st-w), 100%);
  color: var(--st-ink);
  font-family: inherit;
  font-size: 13px;
  line-height: 1.5;
  pointer-events: none !important;
}

.swipe-toast[data-inline='false'] {
  position: fixed;
  right: var(--st-offset);
  bottom: calc(var(--st-offset) + env(safe-area-inset-bottom, 0px));
  z-index: var(--st-z);
  width: min(var(--st-w), calc(100vw - 2 * var(--st-offset)));
  pointer-events: none !important;
}

.swipe-toast[data-inline='false'][data-position='top'] {
  top: calc(var(--st-top-offset, var(--st-offset)) + env(safe-area-inset-top, 0px));
  bottom: auto;
  left: 50%;
  right: auto;
  transform: translateX(-50%);
  width: min(var(--st-w), calc(100vw - 2 * var(--st-offset)));
  pointer-events: none !important;
}

@media (max-width: 768px) {
  .swipe-toast[data-inline='false'] {
    --st-offset: 12px;
  }

  .swipe-toast[data-inline='false'][data-position='top'] {
    --st-top-offset: 70px;
  }

  .swipe-toast__card {
    padding: 11px 14px;
    gap: 8px;
  }

  .swipe-toast__title {
    font-size: 12.5px;
  }

  .swipe-toast__desc {
    font-size: 11px;
  }
}

.swipe-toast[data-inline='true'] {
  transition: grid-template-rows var(--st-slide) var(--st-ease-out);
}

.swipe-toast[data-inline='true'][data-mounted='false'] {
  grid-template-rows: 0fr;
}

.swipe-toast[data-inline='true'][data-phase='closing'],
.swipe-toast[data-inline='true'][data-phase='gone'] {
  grid-template-rows: 0fr;
}

.swipe-toast[data-inline='true'][data-phase='closing'] {
  transition-duration: calc(var(--st-slide) * 0.7);
}

.swipe-toast[data-inline='true'][data-phase='gone'] {
  transition-duration: 200ms;
}

.swipe-toast__gate,
.swipe-toast__lift {
  min-height: 0;
  pointer-events: none !important;
}

.swipe-toast[data-inline='true'] .swipe-toast__lift {
  margin-top: var(--st-gap);
}

.swipe-toast__lift {
  opacity: 1;
  transform: translateY(0);
  transition:
    transform var(--st-slide) var(--st-ease-out),
    opacity calc(var(--st-slide) * 0.6) ease;
}

@starting-style {
  .swipe-toast[data-inline='true'] {
    grid-template-rows: 0fr;
  }

  .swipe-toast:not([data-position='top']) .swipe-toast__lift {
    opacity: 0;
    transform: translateY(100%);
  }

  .swipe-toast[data-position='top'] .swipe-toast__lift {
    opacity: 0;
    transform: translateY(-100%);
  }
}

.swipe-toast:not([data-position='top'])[data-mounted='false'] .swipe-toast__lift {
  opacity: 0;
  transform: translateY(100%);
}

.swipe-toast[data-position='top'][data-mounted='false'] .swipe-toast__lift {
  opacity: 0;
  transform: translateY(-100%);
}

.swipe-toast:not([data-position='top'])[data-phase='closing'] .swipe-toast__lift {
  opacity: 0;
  transform: translateY(100%);
  transition:
    transform calc(var(--st-slide) * 0.7) var(--st-ease-out),
    opacity calc(var(--st-slide) * 0.5) ease;
}

.swipe-toast[data-position='top'][data-phase='closing'] .swipe-toast__lift {
  opacity: 0;
  transform: translateY(-100%);
  transition:
    transform calc(var(--st-slide) * 0.7) var(--st-ease-out),
    opacity calc(var(--st-slide) * 0.5) ease;
}

.swipe-toast:not([data-position='top'])[data-phase='gone'] .swipe-toast__lift {
  opacity: 0;
  visibility: hidden;
  transform: translateY(100%);
}

.swipe-toast[data-position='top'][data-phase='gone'] .swipe-toast__lift {
  opacity: 0;
  visibility: hidden;
  transform: translateY(-100%);
}

.swipe-toast[data-phase='closing'],
.swipe-toast[data-phase='closing'] *,
.swipe-toast[data-phase='gone'],
.swipe-toast[data-phase='gone'] * {
  pointer-events: none !important;
}

.swipe-toast[data-phase='gone'] {
  display: none !important;
  visibility: hidden !important;
}

.swipe-toast[data-instant] .swipe-toast__lift {
  transition-duration: 0s;
}

.swipe-toast__card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px 16px;
  border-radius: var(--st-radius);
  overflow: hidden;
  background: var(--st-bg);
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 10px 25px -3px rgba(0, 0, 0, 0.22),
    0 0 0 1px rgba(255, 255, 255, 0.15);
  cursor: grab;
  outline: none;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
  backdrop-filter: blur(8px);
  pointer-events: auto;
}

.swipe-toast__card[data-swiping] {
  cursor: grabbing;
}

.swipe-toast[data-dismissible='false'] .swipe-toast__card {
  cursor: default;
  touch-action: auto;
}

.swipe-toast__icon {
  display: inline-flex;
  flex: none;
  width: 20px;
  height: 20px;
  align-items: center;
  justify-content: center;
}

.swipe-toast__icon svg {
  width: 100%;
  height: 100%;
}

.swipe-toast__body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.swipe-toast__title {
  font-weight: 600;
  font-size: 13px;
  line-height: 1.4;
  letter-spacing: -0.01em;
}

.swipe-toast__desc {
  color: color-mix(in srgb, var(--st-ink) 78%, transparent);
  font-weight: 400;
  font-size: 11.5px;
  line-height: 1.35;
}

.swipe-toast__action,
.swipe-toast__close {
  flex: none;
  border: 0;
  font: inherit;
  cursor: pointer;
  outline: none;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  transition:
    transform 160ms var(--st-ease-out),
    background-color 160ms ease,
    opacity 160ms ease;
}

.swipe-toast__action {
  height: 26px;
  padding: 0 10px;
  border-radius: 6px;
  background: var(--st-ink);
  color: var(--st-bg);
  font-size: 12px;
  font-weight: 600;
}

.swipe-toast__close {
  position: relative;
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  opacity: 0.75;
}

.swipe-toast__close::before {
  content: '';
  position: absolute;
  inset: -6px;
}

.swipe-toast__action:active,
.swipe-toast__close:active {
  transform: scale(0.95);
}

@media (hover: hover) and (pointer: fine) {
  .swipe-toast__action:hover {
    opacity: 0.9;
  }

  .swipe-toast__close:hover {
    opacity: 1;
    background: color-mix(in srgb, var(--st-ink) 15%, transparent);
  }
}

.swipe-toast__fuse {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: var(--st-fuse-h);
  background: linear-gradient(
    90deg,
    transparent 0%,
    color-mix(in srgb, var(--st-fuse) 25%, transparent) 8%,
    color-mix(in srgb, var(--st-fuse) 60%, transparent) 18%,
    var(--st-fuse) 35%,
    var(--st-fuse) 65%,
    color-mix(in srgb, var(--st-fuse) 60%, transparent) 82%,
    color-mix(in srgb, var(--st-fuse) 25%, transparent) 92%,
    transparent 100%
  );
  transform-origin: left center;
  pointer-events: none;
}

.swipe-toast[data-fuse='top'] .swipe-toast__fuse {
  top: 0;
  bottom: auto;
}

.swipe-toast[data-fuse='none'] .swipe-toast__fuse {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .swipe-toast__lift {
    transform: none !important;
    transition: opacity 200ms ease;
  }

  .swipe-toast__action:active,
  .swipe-toast__close:active {
    transform: none;
  }
}
`;

const EASE_OUT = [0.23, 1, 0.32, 1];
const FLICK = 0.11;
const DEAD_ZONE = 3;
const RESIST_PX = 24;
const COLLAPSE_MS = 200;
const EXIT = 0.7;
const BURN = [{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }];
const HAS_STARTING_STYLE = typeof window !== 'undefined' && 'CSSStartingStyleRule' in window;

const rubberband = (over, dim, c = 0.55) => (over * dim * c) / (dim + c * Math.abs(over));
const velocityOf = hist => {
  if (hist.length < 2) return 0;
  const [t0, y0] = hist[0];
  const [t1, y1] = hist[hist.length - 1];
  return performance.now() - t1 > 100 ? 0 : (y1 - y0) / Math.max(1, t1 - t0);
};

export default function SwipeToast({
  title = 'File archived',
  description = '',
  icon,
  actionLabel = '',
  onAction,
  open = true,
  onClose,
  background = '#0F6659',
  color = '#ffffff',
  fuseColor = '#34d399',
  width = 380,
  radius = 16,
  slideMs = 380,
  settleBounce = 0.2,
  swipeDistance = 40,
  duration = 4000,
  fuse = 'bottom',
  pauseOnHover = true,
  closeButton = false,
  inline = false,
  dismissible = true,
  position = 'top',
  topOffset,
  className = ''
}) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState(open ? 'open' : 'gone');
  const [instant, setInstant] = useState(false);
  const [mounted, setMounted] = useState(HAS_STARTING_STYLE);
  const cardRef = useRef(null);
  const fuseRef = useRef(null);
  const anim = useRef(null);
  const drag = useRef(null);
  const flags = useRef({ hover: false, interacting: false, focus: false, hidden: false });
  const lastInput = useRef('pointer');
  const pendingClose = useRef(null);
  const closeTimer = useRef(undefined);
  const reason = useRef('timeout');
  const leaving = useRef(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const latest = useRef({});
  latest.current = { onClose, onAction, slideMs, inline };

  const isTop = position === 'top';

  const y = useMotionValue(0);
  const fade = useMotionValue(1);
  const transform = useTransform(y, v => `translateY(${v}px)`);

  const syncFuse = () => {
    const a = anim.current;
    if (!a) return;
    const f = flags.current;
    if (f.hover || f.interacting || f.focus || f.hidden) a.pause();
    else if (a.playState === 'paused') a.play();
  };
  const finish = why => {
    setPhase('gone');
    leaving.current = false;
    if (latest.current.inline) closeTimer.current = setTimeout(() => latest.current.onClose?.(why), COLLAPSE_MS);
    else latest.current.onClose?.(why);
  };
  const close = why => {
    if (phaseRef.current !== 'open' || leaving.current) return;
    if (drag.current) {
      pendingClose.current = why;
      return;
    }
    anim.current?.pause();
    reason.current = why;
    const now = why === 'escape' || ((why === 'action' || why === 'close') && lastInput.current === 'keyboard');
    setInstant(now);
    setPhase('closing');
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => finish(why), now ? 0 : latest.current.slideMs * EXIT + 60);
  };
  const rescue = () => {
    clearTimeout(closeTimer.current);
    setInstant(false);
    y.set(0);
    fade.set(1);
    setPhase('open');
  };

  useEffect(() => {
    if (!open) {
      if (phaseRef.current !== 'gone') close('programmatic');
    } else {
      if (phaseRef.current !== 'open') rescue();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (mounted) return;
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, [mounted]);

  useEffect(() => {
    const fuseEl = fuseRef.current;
    if (!fuseEl) return;
    anim.current?.cancel();
    if (duration <= 0) return;
    const a = fuseEl.animate(BURN, {
      duration,
      easing: 'linear',
      fill: 'forwards'
    });
    anim.current = a;
    a.onfinish = () => close('timeout');
    syncFuse();
    return () => a.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration]);

  useEffect(() => {
    const onVisibilityChange = () => {
      flags.current.hidden = document.hidden;
      syncFuse();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const swipeOut = (fromY, vy) => {
    leaving.current = true;
    const targetY = isTop
      ? fromY - Math.max(80, Math.abs(vy) * 120)
      : fromY + Math.max(80, vy * 120);
    const ms = Math.max(120, Math.min(latest.current.slideMs * 0.7, 260));
    animate(y, targetY, { duration: ms / 1000, ease: EASE_OUT });
    animate(fade, 0, { duration: ms / 1000, ease: 'easeOut' });
    setTimeout(() => finish('swipe'), ms);
  };

  const onPointerDown = e => {
    if (!dismissible) return;
    if (e.target.closest('button')) return;
    lastInput.current = 'pointer';
    drag.current = { id: e.pointerId, startY: e.clientY, originY: y.get(), moved: false, hist: [] };
    flags.current.interacting = true;
    anim.current?.pause();
    cardRef.current?.setPointerCapture(e.pointerId);
  };
  const onPointerMove = e => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const raw = e.clientY - d.startY;
    if (!d.moved && Math.abs(raw) < DEAD_ZONE) return;
    if (!d.moved) {
      d.moved = true;
      if (cardRef.current) cardRef.current.dataset.swiping = '';
    }
    const next = isTop
      ? (raw > 0 ? rubberband(raw, RESIST_PX) : raw)
      : (raw < 0 ? -rubberband(-raw, RESIST_PX) : raw);
    y.set(d.originY + next);
    d.hist.push([performance.now(), next]);
    if (d.hist.length > 4) d.hist.shift();
  };
  const onPointerUp = e => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (cardRef.current) delete cardRef.current.dataset.swiping;
    try {
      cardRef.current?.releasePointerCapture(e.pointerId);
    } catch {}
    flags.current.interacting = false;
    const dy = y.get();
    const v = velocityOf(d.hist);
    const shouldDismiss = isTop
      ? (dy < 0 && (v < -FLICK || (Math.abs(dy) >= swipeDistance && v <= 0)))
      : (dy > 0 && (v > FLICK || (dy >= swipeDistance && v >= 0)));

    if (shouldDismiss) {
      swipeOut(dy, v);
      return;
    }
    if (d.moved) {
      animate(
        y,
        0,
        reduce
          ? { duration: 0.2, ease: EASE_OUT }
          : { type: 'spring', duration: 0.5, bounce: settleBounce, velocity: v * 1000 }
      );
    }
    const queued = pendingClose.current;
    pendingClose.current = null;
    if (queued) close(queued);
    else syncFuse();
  };

  if (phase === 'gone') {
    return null;
  }

  return (
    <div
      className={`swipe-toast${className ? ` ${className}` : ''}`}
      data-phase={phase}
      data-inline={inline ? 'true' : 'false'}
      data-position={position}
      data-fuse={duration > 0 ? fuse : 'none'}
      data-dismissible={dismissible ? 'true' : 'false'}
      data-instant={instant ? '' : undefined}
      data-mounted={mounted ? 'true' : 'false'}
      style={{
        '--st-bg': background,
        '--st-ink': color,
        '--st-fuse': fuseColor,
        '--st-w': `${width}px`,
        '--st-radius': `${radius}px`,
        '--st-slide': `${slideMs}ms`,
        '--st-gap': '10px',
        ...(topOffset !== undefined && {
          '--st-top-offset': typeof topOffset === 'number' ? `${topOffset}px` : topOffset
        })
      }}
    >
      <style>{SWIPE_TOAST_CSS}</style>
      <div className="swipe-toast__gate">
        <div className="swipe-toast__lift">
          <motion.div
            ref={cardRef}
            className="swipe-toast__card"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            tabIndex={0}
            style={{ transform, opacity: fade }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onPointerEnter={() => {
              if (!pauseOnHover) return;
              flags.current.hover = true;
              syncFuse();
            }}
            onPointerLeave={() => {
              flags.current.hover = false;
              syncFuse();
            }}
            onFocus={() => {
              flags.current.focus = true;
              syncFuse();
            }}
            onBlur={e => {
              if (!e.currentTarget.contains(e.relatedTarget)) {
                flags.current.focus = false;
                syncFuse();
              }
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') lastInput.current = 'keyboard';
              if (e.key === 'Escape' && dismissible) {
                e.stopPropagation();
                close('escape');
              }
            }}
          >
            {icon ? (
              <span className="swipe-toast__icon" aria-hidden="true">
                {icon}
              </span>
            ) : null}
            <span className="swipe-toast__body">
              <span className="swipe-toast__title">{title}</span>
              {description ? <span className="swipe-toast__desc">{description}</span> : null}
            </span>
            {actionLabel ? (
              <button
                type="button"
                className="swipe-toast__action"
                onClick={() => {
                  latest.current.onAction?.();
                  close('action');
                }}
              >
                {actionLabel}
              </button>
            ) : null}
            {closeButton ? (
              <button type="button" className="swipe-toast__close" aria-label="Close" onClick={() => close('close')}>
                <HugeiconsIcon icon={Cancel01Icon} size={12} strokeWidth={2.5} />
              </button>
            ) : null}
            <i ref={fuseRef} className="swipe-toast__fuse" aria-hidden="true" />
          </motion.div>
        </div>
      </div>
    </div>
  );
}
