'use client';

/**
 * HANDOFF BACKDROP.
 *
 * The floor beneath the globe→map transition. It carries no information — it
 * is the atmosphere the planet dissolves into and the map grows out of, so the
 * middle of the journey reads as depth rather than as a dead screen.
 *
 * Deliberately static: no continuous animation. The only motion is the
 * scroll-driven opacity ramp, which is what the whole product does. A looping
 * glow here would compete with the map's own data for attention.
 *
 * Reads `experience.progress` inside rAF and writes opacity through a ref, so
 * it never re-renders React while scrolling.
 */

import { useEffect, useRef } from 'react';
import { experience } from '@/hooks/useExperience';
import { HANDOFF } from '@/lib/constants';
import { clamp01, smootherstep } from '@/lib/motion';

export function HandoffBackdrop() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const root = rootRef.current;
      if (!root) return;
      const p = experience.progress;
      const opacity =
        smootherstep(HANDOFF.washIn[0], HANDOFF.washIn[1], p) *
        (1 - smootherstep(HANDOFF.washOut[0], HANDOFF.washOut[1], p));
      root.style.opacity = String(clamp01(opacity));
      root.style.visibility = opacity < 0.005 ? 'hidden' : 'visible';
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      ref={rootRef}
      data-testid="handoff-backdrop"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0"
      style={{ opacity: 0, visibility: 'hidden' }}
    >
      {/* Cool atmospheric bloom where the planet was — keeps the descent lit. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 68% 58% at 62% 56%, rgba(0,217,255,0.11) 0%, rgba(0,140,190,0.05) 40%, transparent 74%)',
        }}
      />
      {/* Warm thermal hint low in frame — the signal the map is about to show. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 58% 42% at 56% 78%, rgba(249,115,22,0.06) 0%, rgba(120,53,15,0.03) 45%, transparent 72%)',
        }}
      />
      {/* Horizon band — a faint edge so the frame has an orientation. */}
      <div
        className="absolute inset-x-0 bottom-0 h-[42vh]"
        style={{
          background:
            'linear-gradient(to top, rgba(12,20,32,0.55) 0%, rgba(9,15,24,0.22) 45%, transparent 100%)',
        }}
      />
    </div>
  );
}
