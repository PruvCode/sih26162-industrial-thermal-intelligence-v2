'use client';

import { useEffect, useState } from 'react';
import { Dot, ProvenanceChip } from '@/components/ui/primitives';
import { DATA_PROVENANCE } from '@/data/dataset';

/**
 * Bottom status bar.
 *
 * Belongs to the operational view. The previous build had this as `position:
 * fixed`, which made it float over the cinematic hero for the entire scroll
 * journey — it is now part of the operational layer and inherits its reveal.
 */
export function StatusBar({
  coordinates,
  breadcrumb,
  visibleCount,
  totalCount,
  degraded,
}: {
  coordinates: { lat: number; lng: number } | null;
  breadcrumb: string[];
  visibleCount: number;
  totalCount: number;
  degraded: boolean;
}) {
  const [clock, setClock] = useState('--:--:--');

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      setClock(`${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`);
    };
    tick();
    // 1s is genuinely needed here — it is a clock, not an animation.
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  const format = (v: number, axis: 'lat' | 'lng') =>
    `${Math.abs(v).toFixed(4)}° ${axis === 'lat' ? (v >= 0 ? 'N' : 'S') : v >= 0 ? 'E' : 'W'}`;

  return (
    <footer className="glass-nav pointer-events-auto absolute inset-x-0 bottom-0 z-40 flex h-[30px] items-center justify-between gap-4 px-4 sm:px-5">
      <span className="min-w-[168px] font-mono text-[9px] tabular-nums tracking-[0.06em] text-[#8798AC]">
        {coordinates ? `${format(coordinates.lat, 'lat')}, ${format(coordinates.lng, 'lng')}` : '—'}
      </span>

      <span className="hidden min-w-0 flex-1 truncate text-center font-mono text-[9px] uppercase tracking-[0.16em] text-[#6B7C90] md:block">
        {breadcrumb.join(' / ')}
      </span>

      <div className="flex items-center gap-3">
        <span className="hidden items-center gap-2 lg:flex">
          <ProvenanceChip label="Sat" value={DATA_PROVENANCE.satellites} />
        </span>
        <span className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.14em]">
          {degraded ? (
            <>
              <Dot color="#F97316" pulse />
              <span className="text-[#FDBA74]">Degraded</span>
            </>
          ) : (
            <>
              <Dot color="#22C55E" pulse />
              <span className="text-[#6BD98A]">Monitoring</span>
            </>
          )}
        </span>
        <span className="font-mono text-[9px] tabular-nums text-[#8798AC]">
          <span className="text-[#DCE4EE]">{visibleCount.toLocaleString()}</span>
          {visibleCount !== totalCount && (
            <span className="text-[#6B7C90]"> / {totalCount.toLocaleString()}</span>
          )}{' '}
          events
        </span>
        <span className="font-mono text-[9px] tabular-nums text-[#8798AC]">{clock} UTC</span>
      </div>
    </footer>
  );
}
