'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { SEVERITY_CONFIG, type SeverityLevel } from '@/lib/severity';

const LEGEND_ITEMS: SeverityLevel[] = ['critical', 'high', 'medium', 'low'];

export function MapLegend() {
  const [visible, setVisible] = useState(true);

  return (
    <div
      className="absolute bottom-12 left-5 z-10 rounded-lg overflow-hidden"
      style={{
        background: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
      }}
    >
      <button
        onClick={() => setVisible((v) => !v)}
        className="flex items-center gap-2 px-3 py-2 text-[#64748B] transition-colors hover:text-[#94A3B8]"
      >
        <span className="font-mono text-[9px] tracking-[0.1em] uppercase">Legend</span>
        <svg
          width="6" height="6" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5"
          className={cn('ml-auto transition-transform duration-200', visible && 'rotate-180')}
        >
          <path d="M1 3l3 3 3-3" />
        </svg>
      </button>

      {visible && (
        <div className="flex flex-col gap-1.5 border-t border-white/[0.05] px-3 pb-2.5 pt-2">
          {LEGEND_ITEMS.map((level) => {
            const config = SEVERITY_CONFIG[level];
            return (
              <div key={level} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: config.color }} />
                <span className="font-mono text-[9px] text-[#94A3B8]/50">
                  {config.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
