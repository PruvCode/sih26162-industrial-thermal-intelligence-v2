'use client';

/**
 * EVENT NAVIGATOR — detect and prioritise.
 *
 * Search, filters and the ranked event list. Reads from the same filtered
 * dataset the map renders, so the count in the header can never disagree with
 * the number of markers on screen.
 */

import { memo, useCallback, useMemo, useState } from 'react';
import { Search, X, Star, StarOff, SlidersHorizontal, Layers, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';
import { useFilteredEvents } from '@/features/events/useFilteredEvents';
import { CLASS_LABELS, CLASS_SHORT, EVENT_COLORS, PRIORITY_COLORS, THERMAL_CLASSES } from '@/lib/constants';
import { eventActiveDays, eventClass, eventConfidence, eventPriorityBand, eventPriorityScore } from '@/data/derive';
import { formatEventId } from '@/lib/formatters';
import { Button, IconButton, SectionLabel, Skeleton } from '@/components/ui/primitives';
import { LayerControlPanel, useActiveLayerCount } from '@/components/map/LayerControl';
import type { ThermalEvent } from '@/types/event';
import type { PriorityBand, ThermalClass } from '@/types/event';

const SORTS: Array<{ id: 'recent' | 'priority' | 'intensity' | 'persistence'; label: string }> = [
  { id: 'priority', label: 'Priority' },
  { id: 'recent', label: 'Recent' },
  { id: 'intensity', label: 'Intensity' },
  { id: 'persistence', label: 'Persistence' },
];

const BANDS: PriorityBand[] = ['critical', 'high', 'moderate', 'low'];

/** Rendered rows are capped; the dataset is thousands of records and every
 *  row is a memoised component with hover handlers. */
const PAGE_SIZE = 80;

export function EventNavigator() {
  const filters = useAppStore((s) => s.filters);
  const setFilters = useAppStore((s) => s.setFilters);
  const resetFilters = useAppStore((s) => s.resetFilters);
  const selectedId = useAppStore((s) => s.selectedEventId);
  const selectEvent = useAppStore((s) => s.selectEvent);
  const hoverEvent = useAppStore((s) => s.hoverEvent);
  const watchlist = useAppStore((s) => s.watchlist);
  const toggleWatch = useAppStore((s) => s.toggleWatch);

  const [showFilters, setShowFilters] = useState(false);
  const [showLayers, setShowLayers] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const activeLayerCount = useActiveLayerCount();

  const { events, total, isLoading } = useFilteredEvents();

  const states = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of events) {
      const s = e.enrichment?.admin?.state ?? 'Unassigned';
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [events]);

  const onSearch = useCallback(
    (value: string) => {
      setFilters({ query: value });
      setLimit(PAGE_SIZE);
    },
    [setFilters]
  );

  const hasActiveFilters =
    filters.classes.length > 0 ||
    filters.states.length > 0 ||
    filters.bands.length > 0 ||
    filters.minConfidence > 0 ||
    filters.minPersistence > 0 ||
    filters.query.length > 0;

  return (
    <div className="pointer-events-auto flex h-full w-[320px] flex-col overflow-hidden rounded-glass glass-elevated">
      {/* Header */}
      <div className="shrink-0 border-b border-white/[0.06] px-3.5 py-3">
        <div className="mb-2.5 flex items-center justify-between">
          <SectionLabel>Event navigator</SectionLabel>
          <span className="font-mono text-[10px] tabular-nums text-[#DCE4EE]">
            {isLoading ? '—' : total.toLocaleString()}
          </span>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6B7C90]" />
          <input
            type="search"
            value={filters.query}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Event ID, district, state, facility"
            aria-label="Search thermal events"
            className="w-full rounded-md border border-white/[0.08] bg-white/[0.03] py-2 pl-8 pr-8 font-mono text-[11px] text-[#E8EDF3] placeholder:text-[#5A6B7F] focus:border-[rgba(0,217,255,0.4)] focus:outline-none"
          />
          {filters.query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => onSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6B7C90] hover:text-[#DCE4EE]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="mt-2.5 flex items-center gap-1.5">
          <IconButton
            label={showFilters ? 'Hide filters' : 'Show filters'}
            active={showFilters || hasActiveFilters}
            onClick={() => setShowFilters((v) => !v)}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </IconButton>
          <div className="relative">
            <IconButton
              label={showLayers ? 'Hide map layers' : 'Show map layers'}
              active={showLayers}
              aria-pressed={showLayers}
              onClick={() => setShowLayers((v) => !v)}
            >
              <Layers className="h-3.5 w-3.5" />
            </IconButton>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-1.5 -top-1.5 flex h-[13px] min-w-[13px] items-center justify-center rounded-full border border-[rgba(0,217,255,0.4)] bg-[#0A1018] px-[3px] font-mono text-[8px] tabular-nums leading-none text-[#8FE6FF]"
            >
              {activeLayerCount}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-1">
            {SORTS.map((s) => (
              <button
                key={s.id}
                type="button"
                data-cursor="button"
                onClick={() => setFilters({ sort: s.id })}
                className={cn(
                  'rounded px-1.5 py-1 font-mono text-[9px] uppercase tracking-[0.1em] transition-colors duration-200',
                  filters.sort === s.id ? 'text-[#8FE6FF]' : 'text-[#6B7C90] hover:text-[#DCE4EE]'
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="shrink-0 space-y-3.5 border-b border-white/[0.06] bg-black/20 px-3.5 py-3">
          <FilterGroup label="Classification">
            {THERMAL_CLASSES.map((c) => {
              const on = filters.classes.includes(c);
              return (
                <Chip
                  key={c}
                  active={on}
                  color={EVENT_COLORS[c]}
                  label={CLASS_SHORT[c]}
                  title={CLASS_LABELS[c]}
                  onClick={() =>
                    setFilters({
                      classes: on ? filters.classes.filter((x) => x !== c) : [...filters.classes, c],
                    })
                  }
                />
              );
            })}
          </FilterGroup>

          <FilterGroup label="Priority">
            {BANDS.map((b) => {
              const on = filters.bands.includes(b);
              return (
                <Chip
                  key={b}
                  active={on}
                  color={PRIORITY_COLORS[b]}
                  label={b}
                  onClick={() =>
                    setFilters({ bands: on ? filters.bands.filter((x) => x !== b) : [...filters.bands, b] })
                  }
                />
              );
            })}
          </FilterGroup>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <SectionLabel>Min confidence</SectionLabel>
              <span className="font-mono text-[10px] tabular-nums text-[#DCE4EE]">{filters.minConfidence}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={95}
              step={5}
              value={filters.minConfidence}
              onChange={(e) => setFilters({ minConfidence: Number(e.target.value) })}
              aria-label="Minimum classification confidence"
              className="w-full accent-[#00D9FF]"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <SectionLabel>Min active days</SectionLabel>
              <span className="font-mono text-[10px] tabular-nums text-[#DCE4EE]">{filters.minPersistence}</span>
            </div>
            <input
              type="range"
              min={0}
              max={25}
              step={1}
              value={filters.minPersistence}
              onChange={(e) => setFilters({ minPersistence: Number(e.target.value) })}
              aria-label="Minimum active days"
              className="w-full accent-[#00D9FF]"
            />
          </div>

          <FilterGroup label="State">
            {states.map(([state, count]) => {
              const on = filters.states.includes(state);
              return (
                <Chip
                  key={state}
                  active={on}
                  label={`${state} ${count}`}
                  onClick={() =>
                    setFilters({
                      states: on ? filters.states.filter((x) => x !== state) : [...filters.states, state],
                    })
                  }
                />
              );
            })}
          </FilterGroup>

          {hasActiveFilters && (
            <Button variant="ghost" className="w-full" onClick={resetFilters}>
              Clear filters
            </Button>
          )}
        </div>
      )}

      {/* Map layers */}
      {showLayers && <LayerControlPanel />}

      {/* List */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-[62px] w-full" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#A9B6C6]">No events match</p>
            <p className="mt-2 text-[11px] leading-relaxed text-[#8798AC]">
              Relax a filter or clear the search to widen the result set.
            </p>
            {hasActiveFilters && (
              <Button variant="ghost" className="mt-3" onClick={resetFilters}>
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <>
            {events.slice(0, limit).map((event) => (
              <EventRow
                key={event.id}
                event={event}
                selected={event.id === selectedId}
                watched={watchlist.includes(event.id)}
                onSelect={selectEvent}
                onHover={hoverEvent}
                onWatch={toggleWatch}
              />
            ))}
            {events.length > limit && (
              <button
                type="button"
                data-cursor="button"
                onClick={() => setLimit((l) => l + PAGE_SIZE)}
                className="flex w-full items-center justify-center gap-2 border-t border-white/[0.05] py-3 font-mono text-[9px] uppercase tracking-[0.14em] text-[#8798AC] hover:bg-white/[0.03] hover:text-[#DCE4EE]"
              >
                <ChevronDown className="h-3 w-3" />
                {events.length - limit} more
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Row ────────────────────────────────────────────────────────────────────

const EventRow = memo(function EventRow({
  event,
  selected,
  watched,
  onSelect,
  onHover,
  onWatch,
}: {
  event: ThermalEvent;
  selected: boolean;
  watched: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onWatch: (id: string) => void;
}) {
  const cls = eventClass(event);
  const color = EVENT_COLORS[cls];
  const band = eventPriorityBand(event);

  return (
    <div
      role="button"
      tabIndex={0}
      data-testid="event-row"
      data-cursor="event"
      data-event-id={event.id}
      aria-pressed={selected}
      onClick={() => onSelect(event.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(event.id);
        }
      }}
      onMouseEnter={() => onHover(event.id)}
      onMouseLeave={() => onHover(null)}
      className={cn(
        'group flex cursor-pointer gap-2.5 border-b border-white/[0.04] px-3.5 py-2.5 transition-colors duration-150',
        selected ? 'bg-[rgba(0,217,255,0.07)]' : 'hover:bg-white/[0.035]'
      )}
    >
      <span
        className="mt-[5px] h-[7px] w-[7px] shrink-0 rounded-full"
        style={{ background: color, boxShadow: `0 0 7px ${color}88` }}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[11px] text-[#E8EDF3]">{formatEventId(event.id)}</span>
          <span
            className="font-mono text-[9px] uppercase tracking-[0.1em]"
            style={{ color: PRIORITY_COLORS[band as PriorityBand] }}
          >
            {band}
          </span>
          <button
            type="button"
            aria-label={watched ? 'Remove from watchlist' : 'Add to watchlist'}
            title={watched ? 'Watching' : 'Watch'}
            onClick={(e) => {
              e.stopPropagation();
              onWatch(event.id);
            }}
            className={cn(
              'ml-auto shrink-0 transition-opacity duration-150',
              watched ? 'text-[#FACC15] opacity-100' : 'text-[#6B7C90] opacity-0 hover:text-[#DCE4EE] group-hover:opacity-100'
            )}
          >
            {watched ? <Star className="h-3 w-3 fill-current" /> : <StarOff className="h-3 w-3" />}
          </button>
        </div>

        <div className="mt-1 truncate text-[11px] text-[#A9B6C6]">
          {event.enrichment?.admin?.district}
          {event.enrichment?.admin?.district && event.enrichment?.admin?.state ? ', ' : ''}
          {event.enrichment?.admin?.state}
        </div>

        <div className="mt-1 flex items-center gap-2.5 font-mono text-[9px] tabular-nums text-[#6B7C90]">
          <span>{Math.round(eventConfidence(event) * 100)}%</span>
          <span>·</span>
          <span>{(event.frp ?? 0).toFixed(1)} MW</span>
          <span>·</span>
          <span>{eventActiveDays(event)}d</span>
          <span className="ml-auto">{eventPriorityScore(event)}</span>
        </div>
      </div>
    </div>
  );
});

// ── Bits ───────────────────────────────────────────────────────────────────

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5">
        <SectionLabel>{label}</SectionLabel>
      </div>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function Chip({
  active,
  label,
  color,
  title,
  onClick,
}: {
  active: boolean;
  label: string;
  color?: string;
  title?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-cursor="button"
      title={title}
      aria-pressed={active}
      onClick={onClick}
      className="rounded border px-1.5 py-1 font-mono text-[9px] uppercase tracking-[0.1em] transition-all duration-150"
      style={{
        borderColor: active ? (color ?? '#00D9FF') + '88' : 'rgba(255,255,255,0.08)',
        background: active ? (color ?? '#00D9FF') + '1F' : 'transparent',
        color: active ? (color ?? '#8FE6FF') : '#8798AC',
      }}
    >
      {label}
    </button>
  );
}
