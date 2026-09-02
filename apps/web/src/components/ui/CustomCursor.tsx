'use client';

/**
 * INTELLIGENCE CURSOR.
 *
 * Four variants, smoothed with lerp, no glow blob:
 *   default  small glass point
 *   map      precision reticle
 *   event    targeting brackets
 *   button   subtle ring
 *
 * Accessibility rules that the previous build got wrong:
 *  - `cursor: none` is applied by JS, only when the pointer is fine AND the
 *    user has NOT asked for reduced motion. It is never in the stylesheet, so
 *    reduced-motion and touch users always keep a native pointer.
 *  - The layer is removed entirely on coarse pointers.
 */

import { useEffect, useRef, useState } from 'react';

type Variant = 'default' | 'map' | 'event' | 'button';

export default function CustomCursor() {
  const [enabled, setEnabled] = useState(false);
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fine = window.matchMedia('(pointer: fine)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!fine || reduced) {
      document.body.style.removeProperty('cursor');
      setEnabled(false);
      return;
    }
    setEnabled(true);
    document.body.style.cursor = 'none';
    return () => {
      document.body.style.removeProperty('cursor');
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let x = targetX;
    let y = targetY;
    let ringX = targetX;
    let ringY = targetY;
    let raf = 0;
    let visible = false;

    const onMove = (e: PointerEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
      if (!visible) {
        visible = true;
        x = ringX = targetX;
        y = ringY = targetY;
        dot.style.opacity = '1';
        ring.style.opacity = '1';
      }

      const el = e.target as HTMLElement | null;
      const attributed = el?.closest?.('[data-cursor]') as HTMLElement | null;
      const variant = (attributed?.dataset.cursor ??
        (el?.closest('button, a, [role="button"], input, select, textarea') ? 'button' : 'default')) as Variant;

      dot.dataset.variant = variant;
      ring.dataset.variant = variant;
    };

    const onLeave = () => {
      visible = false;
      dot.style.opacity = '0';
      ring.style.opacity = '0';
    };

    const tick = () => {
      raf = requestAnimationFrame(tick);
      x += (targetX - x) * 0.35;
      y += (targetY - y) * 0.35;
      ringX += (targetX - ringX) * 0.16;
      ringY += (targetY - ringY) * 0.16;
      dot.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
      ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`;
    };
    raf = requestAnimationFrame(tick);

    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[999]">
      <div
        ref={dotRef}
        className="absolute left-0 top-0 h-[5px] w-[5px] rounded-full bg-[#E6EEF7] opacity-0 transition-opacity duration-200"
        style={{ boxShadow: '0 0 6px rgba(230,238,247,0.5)' }}
      />
      <div ref={ringRef} className="cursor-ring absolute left-0 top-0 opacity-0 transition-opacity duration-200" />
      <style jsx>{`
        .cursor-ring {
          width: 22px;
          height: 22px;
          border: 1px solid rgba(230, 238, 247, 0.35);
          border-radius: 999px;
          background: rgba(230, 238, 247, 0.04);
          transition: width 200ms cubic-bezier(0.16, 1, 0.3, 1),
            height 200ms cubic-bezier(0.16, 1, 0.3, 1),
            border-radius 200ms cubic-bezier(0.16, 1, 0.3, 1),
            border-color 200ms cubic-bezier(0.16, 1, 0.3, 1),
            opacity 200ms linear;
        }
        .cursor-ring[data-variant='default'] {
          width: 22px;
          height: 22px;
        }
        .cursor-ring[data-variant='button'] {
          width: 34px;
          height: 34px;
          border-color: rgba(0, 217, 255, 0.5);
        }
        .cursor-ring[data-variant='map'] {
          width: 26px;
          height: 26px;
          border-radius: 2px;
          border-color: rgba(0, 217, 255, 0.4);
        }
        .cursor-ring[data-variant='event'] {
          width: 30px;
          height: 30px;
          border-radius: 2px;
          border-color: rgba(249, 115, 22, 0.75);
          background: rgba(249, 115, 22, 0.06);
        }
      `}</style>
    </div>
  );
}
