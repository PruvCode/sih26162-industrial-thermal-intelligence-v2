'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { ThermalEvent, ThermalClass } from '@/types/event';
import {
  formatEventId,
  formatClassLabel,
  formatConfidence,
  formatBrightness,
} from '@/lib/formatters';
import {
  getSeverityColor,
  getSeverityFromClass,
  SEVERITY_CONFIG,
} from '@/lib/severity';
import { useDebounce } from '@/hooks/useDebounce';

interface EventListPanelProps {
  events: ThermalEvent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const CLASS_FILTERS: ThermalClass[] = [
  'industrial_fire',
  'persistent_thermal_source',
  'natural_wildfire',
  'other',
];

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d`;
}

export function EventListPanel({
  events,
  selectedId,
  onSelect,
}: EventListPanelProps) {
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeClasses, setActiveClasses] = useState<Set<ThermalClass>>(new Set());

  const debouncedSearch = useDebounce(search, 200);

  const filtered = useMemo(() => {
    let result = [...events];

    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (e) =>
          e.id.toLowerCase().includes(q) ||
          e.classification?.class.toLowerCase().includes(q) ||
          e.enrichment?.nearestIndustrialSite?.name.toLowerCase().includes(q)
      );
    }

    if (activeClasses.size > 0) {
      result = result.filter((e) => {
        const cls = e.classification?.class;
        return cls && activeClasses.has(cls);
      });
    }

    result.sort(
      (a, b) => new Date(b.acqDatetime).getTime() - new Date(a.acqDatetime).getTime()
    );

    return result;
  }, [events, debouncedSearch, activeClasses]);

  const toggleClass = (cls: ThermalClass) => {
    setActiveClasses((prev) => {
      const next = new Set(prev);
      if (next.has(cls)) next.delete(cls);
      else next.add(cls);
      return next;
    });
  };

  return (
    <div
      data-cursor="panel"
      className="glass-panel flex h-full w-[280px] flex-col rounded-xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-[#94A3B8]">
            Live Events
          </span>
          <span className="font-mono text-[9px] text-[#00D9FF] tabular-nums">
            {filtered.length}
          </span>
        </div>
        <button
          onClick={() => setSearchOpen(!searchOpen)}
          className="flex h-6 w-6 items-center justify-center rounded-md text-[#64748B] transition-colors hover:bg-white/[0.06] hover:text-[#94A3B8]"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="5" cy="5" r="3.5" />
            <path d="M7.5 7.5L10.5 10.5" />
          </svg>
        </button>
      </div>

      {/* Search */}
      {searchOpen && (
        <div className="border-b border-white/[0.06] px-3 py-2">
          <input
            autoFocus
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter..."
            className="w-full rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-1 font-mono text-[10px] text-[#94A3B8] placeholder:text-[#475569] focus:border-[#00D9FF]/30 focus:outline-none"
          />
        </div>
      )}

      {/* Class filters */}
      <div className="flex gap-1 border-b border-white/[0.06] px-3 py-2">
        {CLASS_FILTERS.map((cls) => {
          const severity = getSeverityFromClass(cls);
          const config = SEVERITY_CONFIG[severity];
          const active = activeClasses.has(cls);
          return (
            <button
              key={cls}
              onClick={() => toggleClass(cls)}
              className={cn(
                'rounded px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider transition-all',
                active
                  ? 'border border-current'
                  : 'border border-transparent opacity-35 hover:opacity-60'
              )}
              style={{
                color: config.color,
                backgroundColor: active ? `${config.color}12` : 'transparent',
              }}
            >
              {config.shortLabel}
            </button>
          );
        })}
      </div>

      {/* Event list */}
      <div className="flex-1 overflow-y-auto px-2 py-1.5 scrollbar-thin">
        {filtered.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <span className="font-mono text-[10px] text-[#475569]">No events</span>
          </div>
        )}

        {filtered.map((event) => {
          const isSelected = event.id === selectedId;
          const cls = event.classification?.class;
          const color = getSeverityColor(cls);
          const siteDistance = event.enrichment?.nearestIndustrialSite?.distanceKm;

          return (
            <button
              key={event.id}
              onClick={() => onSelect(event.id)}
              className={cn(
                'mb-0.5 flex w-full items-start gap-2 rounded-lg p-2.5 text-left transition-all hover:bg-white/[0.04]',
                isSelected && 'border-l-[1.5px] bg-white/[0.05]'
              )}
              style={{ borderLeftColor: isSelected ? color : 'transparent' }}
            >
              <span
                className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[11px] text-[#F8FAFC]">
                    {formatEventId(event.id)}
                  </span>
                  <span className="truncate text-[9px] text-[#475569]">
                    {cls ? formatClassLabel(cls) : 'Unclassified'}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 font-mono text-[9px] text-[#64748B]">
                  <span>{formatConfidence(event.classification?.confidence ?? 0)}</span>
                  <span className="text-[#475569]">·</span>
                  <span>{formatBrightness(event.brightness)}</span>
                  <span className="text-[#475569]">·</span>
                  <span>{relativeTime(event.acqDatetime)}</span>
                </div>
                {siteDistance != null && (
                  <div className="mt-0.5 truncate text-[8px] text-[#475569]">
                    {event.enrichment?.nearestIndustrialSite?.name}{' '}
                    {siteDistance < 1
                      ? `${(siteDistance * 1000).toFixed(0)}m`
                      : `${siteDistance.toFixed(1)}km`}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
