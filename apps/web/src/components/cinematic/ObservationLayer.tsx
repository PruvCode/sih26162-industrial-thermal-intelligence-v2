'use client';

/**
 * OBSERVATION MODE.
 *
 * The intermediate state the previous build was missing entirely — the reason
 * the dashboard appeared to "pop" out of nowhere.
 *
 * Between the planet dissolving and the operational UI materialising, the
 * screen shows India with minimal technical metadata and the thermal signal
 * beginning to register. No panels, no lists, no chrome.
 */

import { useEffect, useRef } from 'react';
import { experience } from '@/hooks/useExperience';
import { HANDOFF } from '@/lib/constants';
import { AOI_CENTER } from '@/lib/geo';
import { clamp01, smootherstep } from '@/lib/motion';

interface ObservationLayerProps {
  /** Human-readable "last updated" stamp. */
  lastUpdated: string;
  eventCount: number;
  /** Position of the operational UI reveal, used to fade this layer back out. */
  operationalReveal: number;
}

export function ObservationLayer({ lastUpdated, eventCount, operationalReveal }: ObservationLayerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const signalRef = useRef<HTMLDivElement>(null);

  // Fade with the raw observation ramp so the motion stays continuous even
  // though React only sees the quantised operational reveal.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const root = rootRef.current;
      if (!root) return;
      const p = experience.progress;
      // Rise through the observation band, fall as the operational UI arrives.
      // Bands come from HANDOFF so the dissolve, this layer, the backdrop and
      // the map stay on one clock — see the note in lib/constants.ts.
      const opacity =
        smootherstep(HANDOFF.observationIn[0], HANDOFF.observationIn[1], p) *
        (1 - smootherstep(HANDOFF.observationOut[0], HANDOFF.observationOut[1], p));
      root.style.opacity = String(clamp01(opacity));
      root.style.visibility = opacity < 0.01 ? 'hidden' : 'visible';
      if (signalRef.current) {
        const s = clamp01(smootherstep(0.72, 0.86, p) * (1 - smootherstep(0.9, 0.97, p)));
        signalRef.current.style.opacity = String(s);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const [lat, lng] = [AOI_CENTER[1], AOI_CENTER[0]];

  return (
    <div
      ref={rootRef}
      aria-hidden={operationalReveal > 0.5}
      className="pointer-events-none absolute inset-0 z-20"
      style={{ opacity: 0, visibility: 'hidden' }}
    >
      {/* Regional framing hairlines — a quiet instrument reticle, not a HUD. */}
      <div className="absolute left-1/2 top-1/2 h-[46vh] w-[46vh] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.05]" />
      <div className="absolute left-1/2 top-1/2 h-[68vh] w-[68vh] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.03]" />

      {/* Minimal metadata — bottom left */}
      <div className="absolute bottom-14 left-6 sm:left-10 lg:left-16 xl:left-20">
        <div className="mb-3 h-px w-24 bg-[rgba(0,217,255,0.35)]" />
        <h2 className="font-display text-[clamp(2.6rem,7vw,5.4rem)] font-light leading-[0.9] tracking-[0.02em] text-[#F2F6FA]">
          INDIA
        </h2>
        <div className="mt-5 flex flex-col gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[#7C8CA0]">
          <span className="tabular-nums">
            {Math.abs(lat).toFixed(4)}° N, {Math.abs(lng).toFixed(4)}° E
          </span>
          <span>VIIRS · Global Observation</span>
          <span>Last updated {lastUpdated}</span>
        </div>
      </div>

      {/* Signal read-out — bottom right */}
      <div ref={signalRef} className="absolute bottom-14 right-6 text-right sm:right-10 lg:right-16 xl:right-20" style={{ opacity: 0 }}>
        <div className="flex items-center justify-end gap-2">
          <span className="h-[5px] w-[5px] rounded-full bg-[#F97316]" style={{ boxShadow: '0 0 10px rgba(249,115,22,0.7)' }} />
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#C8D3DF]">
            Thermal signal acquired
          </span>
        </div>
        <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[#6A7A8E]">
          <span className="tabular-nums text-[#B4C0CF]">{eventCount.toLocaleString()}</span> detections · 30-day window
        </div>
      </div>
    </div>
  );
}
