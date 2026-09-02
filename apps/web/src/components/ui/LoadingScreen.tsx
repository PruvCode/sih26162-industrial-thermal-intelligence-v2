'use client';

/**
 * LOADING SCREEN — real readiness, not a timer.
 *
 * The old screen ran a fixed sequence of setTimeout-driven steps and dismissed
 * itself whether or not anything had actually loaded. This one tracks four real
 * milestones:
 *
 *   EARTH             three.js texture decode (LoadingManager progress)
 *   ATMOSPHERE        first rendered frame from the globe scene
 *   GEOSPATIAL DATA   MapLibre style + glyphs resolved (or declared degraded)
 *   THERMAL EVENTS    dataset generated and indexed
 *
 * A row only ticks when its milestone really fires. A 12s timeout releases the
 * screen regardless, so an unreachable CDN can never wedge the application.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

export type LoadStage = 'earth' | 'atmosphere' | 'geospatial' | 'events';

export interface LoadingScreenProps {
  /** 0..1 texture decode progress from the globe. */
  earthProgress: number;
  stages: Record<LoadStage, boolean>;
  onComplete: () => void;
  /** Milliseconds before the screen releases itself regardless of state. */
  timeoutMs?: number;
}

const STAGES: Array<{ id: LoadStage; label: string }> = [
  { id: 'earth', label: 'Earth' },
  { id: 'atmosphere', label: 'Atmosphere' },
  { id: 'geospatial', label: 'Geospatial data' },
  { id: 'events', label: 'Thermal events' },
];

export default function LoadingScreen({
  earthProgress,
  stages,
  onComplete,
  timeoutMs = 12000,
}: LoadingScreenProps) {
  const [exiting, setExiting] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const completedRef = useRef(false);

  const fraction = useMemo(() => {
    const done = STAGES.filter((s) => stages[s.id]).length;
    // Weight the earth stage by real texture progress so the bar moves
    // continuously instead of jumping a quarter at a time.
    const earthWeight = stages.earth ? 1 : earthProgress;
    return Math.min(1, (done + earthWeight) / STAGES.length);
  }, [earthProgress, stages]);

  const ready = STAGES.every((s) => stages[s.id]);

  useEffect(() => {
    if (ready && !completedRef.current) {
      completedRef.current = true;
      // Brief hold so the final row is legible before the screen leaves.
      const t = window.setTimeout(() => setExiting(true), 460);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [ready]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (!completedRef.current) {
        completedRef.current = true;
        setTimedOut(true);
        setExiting(true);
      }
    }, timeoutMs);
    return () => window.clearTimeout(t);
  }, [timeoutMs]);

  useEffect(() => {
    if (!exiting) return undefined;
    const t = window.setTimeout(onComplete, 720);
    return () => window.clearTimeout(t);
  }, [exiting, onComplete]);

  return (
    <div
      data-testid="loading-screen"
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[900] flex flex-col items-center justify-center bg-[var(--bg-void)] transition-opacity duration-700"
      style={{ opacity: exiting ? 0 : 1, pointerEvents: exiting ? 'none' : 'auto' }}
    >
      <div className="w-[320px] max-w-[80vw]">
        <div className="mb-10 text-center">
          <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#6B7C90]">SIH26162</div>
          <h1 className="mt-4 font-display text-[34px] font-light leading-[1.05] tracking-[0.01em] text-[#F2F6FA]">
            Thermal Intelligence
          </h1>
          <div className="mt-3 font-mono text-[9px] uppercase tracking-[0.24em] text-[#6B7C90]">
            {timedOut ? 'Starting with available resources' : 'Initializing'}
          </div>
        </div>

        <div className="mb-9 h-px w-full overflow-hidden bg-white/[0.07]">
          <div
            className="h-full bg-[rgba(0,217,255,0.55)] transition-[width] duration-500 ease-out"
            style={{ width: `${Math.round(fraction * 100)}%` }}
          />
        </div>

        <ul className="flex flex-col gap-3">
          {STAGES.map((s, i) => {
            const done = stages[s.id];
            const previousDone = i === 0 || stages[STAGES[i - 1].id];
            const active = !done && previousDone;
            return (
              <li key={s.id} className="flex items-center gap-3">
                <span
                  className="h-[5px] w-[5px] shrink-0 rounded-full transition-all duration-300"
                  style={{
                    background: done ? '#22C55E' : active ? '#00D9FF' : '#2A3648',
                    boxShadow: done
                      ? '0 0 8px rgba(34,197,94,0.55)'
                      : active
                        ? '0 0 8px rgba(0,217,255,0.55)'
                        : 'none',
                  }}
                />
                <span
                  className="font-mono text-[10px] uppercase tracking-[0.16em] transition-colors duration-300"
                  style={{ color: done ? '#A9B6C6' : active ? '#DCE4EE' : '#4B5A6E' }}
                >
                  {s.label}
                </span>
                <span className="ml-auto font-mono text-[9px] tabular-nums text-[#4B5A6E]">
                  {done
                    ? 'READY'
                    : s.id === 'earth' && earthProgress > 0
                      ? `${Math.round(earthProgress * 100)}%`
                      : '—'}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
