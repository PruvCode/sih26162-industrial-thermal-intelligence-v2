'use client';

/**
 * Top navigation.
 *
 * Every item does something: it either switches the operational view or it
 * scrolls the user into the product first. There is no item that exists only
 * to look like navigation.
 */

import { cn } from '@/lib/utils';
import { useAppStore, type AppView } from '@/store/useAppStore';
import { scrollToOperational } from '@/hooks/useExperience';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { DEMO_REFERENCE_DATE } from '@/data/dataset';
import { ProvenanceChip } from '@/components/ui/primitives';

const ITEMS: Array<{ id: AppView; label: string; hint: string }> = [
  { id: 'command', label: 'Command', hint: 'Operational map' },
  { id: 'events', label: 'Events', hint: 'Event explorer' },
  { id: 'analytics', label: 'Analytics', hint: 'Detection analytics' },
  { id: 'watchtower', label: 'Watchtower', hint: 'Monitoring digest & watchlist' },
  { id: 'about', label: 'About', hint: 'Methodology & limitations' },
];

export function TopNavigation({ reveal }: { reveal: number }) {
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const reduced = useReducedMotion();

  const go = (id: AppView) => {
    // From the cinematic hero, entering the product is the first action.
    if (reveal < 0.5) scrollToOperational(!reduced);
    setView(id);
  };

  const lastUpdated = new Date(DEMO_REFERENCE_DATE).toISOString().slice(0, 10);

  return (
    <header
      className="glass-nav pointer-events-auto absolute inset-x-0 top-0 z-40 flex h-[52px] items-center justify-between px-4 sm:px-5"
      style={{ opacity: Math.max(0.7, reveal), transition: 'opacity 220ms cubic-bezier(0.16,1,0.3,1)' }}
    >
      {/* Wordmark */}
      <div className="flex items-center gap-3">
        <span className="h-[7px] w-[7px] rounded-full border border-[#00D9FF]/70 bg-[rgba(0,217,255,0.4)]" />
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#DCE4EE]">SIH26162</span>
        <span className="hidden font-mono text-[9px] uppercase tracking-[0.16em] text-[#6B7C90] md:inline">
          Industrial Thermal Intelligence
        </span>
      </div>

      {/* Primary navigation */}
      <nav aria-label="Primary" className="flex items-center gap-0.5">
        {ITEMS.map((item) => {
          const active = view === item.id && reveal > 0.5;
          return (
            <button
              key={item.id}
              type="button"
              data-cursor="button"
              aria-current={active ? 'page' : undefined}
              title={item.hint}
              onClick={() => go(item.id)}
              className={cn(
                'relative rounded-md px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors duration-200',
                active ? 'text-[#8FE6FF]' : 'text-[#B4C0CF] hover:text-[#DCE4EE]'
              )}
            >
              {item.label}
              <span
                className="absolute inset-x-2.5 -bottom-px h-px transition-all duration-300"
                style={{
                  background: active ? '#00D9FF' : 'transparent',
                  opacity: active ? 1 : 0,
                }}
              />
            </button>
          );
        })}
      </nav>

      {/* Provenance strip */}
      <div className="hidden items-center gap-4 lg:flex">
        <ProvenanceChip label="Source" value="NASA FIRMS" />
        <ProvenanceChip label="Updated" value={lastUpdated} />
        <ProvenanceChip label="Data" value="Demo" tone="demo" />
      </div>
    </header>
  );
}
