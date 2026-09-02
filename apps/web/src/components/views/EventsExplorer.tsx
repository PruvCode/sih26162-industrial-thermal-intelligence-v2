'use client';

/**
 * EVENTS EXPLORER.
 *
 * The map is for spatial reasoning; this is for enumeration. Same filter
 * pipeline, same selection action — selecting a row here opens the identical
 * investigation panel the map does, so there is exactly one notion of "the
 * selected event" across the application.
 */

import { useState } from 'react';
import { Table2, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';
import { useFilteredEvents } from '@/features/events/useFilteredEvents';
import { CLASS_LABELS, EVENT_COLORS, PRIORITY_COLORS, PRIORITY_LABELS, describeConfidence } from '@/lib/constants';
import { eventActiveDays, eventClass, eventConfidence, eventPriorityBand, eventPriorityScore } from '@/data/derive';
import { formatEventId, formatDateTime } from '@/lib/formatters';
import { Button, Dot, EmptyState, IconButton, SectionLabel, Skeleton } from '@/components/ui/primitives';

const PAGE_SIZE = 50;

type SortKey = 'recent' | 'priority' | 'intensity' | 'persistence';

const SORTS: Array<{ id: SortKey; label: string }> = [
  { id: 'recent', label: 'Recent' },
  { id: 'priority', label: 'Priority' },
  { id: 'intensity', label: 'Intensity' },
  { id: 'persistence', label: 'Persistence' },
];

export function EventsExplorer() {
  const { events, total, isLoading } = useFilteredEvents();
  const selectedEventId = useAppStore((s) => s.selectedEventId);
  const selectEvent = useAppStore((s) => s.selectEvent);
  const setView = useAppStore((s) => s.setView);
  const filters = useAppStore((s) => s.filters);
  const setFilters = useAppStore((s) => s.setFilters);
  const [page, setPage] = useState(0);

  const pageCount = Math.max(1, Math.ceil(events.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const rows = events.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const focus = (id: string) => {
    selectEvent(id);
    setView('command');
  };

  return (
    <div className="flex h-full flex-col px-6 py-5">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Table2 className="h-3.5 w-3.5 text-[#8FE6FF]" />
            <h1 className="font-display text-[26px] leading-none text-[#F2F6FA]">Events</h1>
          </div>
          <p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-[#8798AC]">
            {events.length.toLocaleString()} of {total.toLocaleString()} detections match current filters
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.02] p-1">
            <ArrowUpDown className="ml-1 h-2.5 w-2.5 text-[#6B7C90]" />
            {SORTS.map((s) => (
              <button
                key={s.id}
                type="button"
                data-cursor="button"
                onClick={() => setFilters({ sort: s.id })}
                className={cn(
                  'rounded px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] transition-colors duration-200',
                  filters.sort === s.id
                    ? 'bg-[rgba(0,217,255,0.12)] text-[#8FE6FF]'
                    : 'text-[#8798AC] hover:text-[#DCE4EE]'
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          <Button variant="ghost" onClick={() => setView('command')}>
            Back to map
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden rounded-glass border border-white/[0.07]">
        <div className="h-full overflow-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-[#0A0E14]/95 backdrop-blur-md">
              <tr className="border-b border-white/[0.08]">
                <Th className="w-[124px]">Event</Th>
                <Th className="w-[150px]">Acquired (UTC)</Th>
                <Th className="w-[130px]">Classification</Th>
                <Th className="w-[92px]">Confidence</Th>
                <Th className="w-[104px]">Priority</Th>
                <Th className="w-[72px] text-right">FRP</Th>
                <Th className="w-[64px] text-right">Days</Th>
                <Th>Location</Th>
                <Th className="w-[168px]">Nearest facility</Th>
              </tr>
            </thead>

            <tbody>
              {isLoading ? (
                Array.from({ length: 12 }).map((_, i) => (
                  <tr key={i} className="border-b border-white/[0.04]">
                    <td colSpan={9} className="px-3 py-2">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <EmptyState
                      title="No events match"
                      detail="Relax the filters in the navigator, or reset them and start again."
                    />
                  </td>
                </tr>
              ) : (
                rows.map((e) => {
                  const cls = eventClass(e);
                  const conf = eventConfidence(e);
                  const band = eventPriorityBand(e);
                  const confMeta = describeConfidence(conf);
                  const active = e.id === selectedEventId;

                  return (
                    <tr
                      key={e.id}
                      onClick={() => focus(e.id)}
                      data-cursor="button"
                      className={cn(
                        'cursor-pointer border-b border-white/[0.04] transition-colors duration-200',
                        active ? 'bg-[rgba(0,217,255,0.07)]' : 'hover:bg-white/[0.03]'
                      )}
                    >
                      <Td>
                        <span className="flex items-center gap-2">
                          <Dot color={EVENT_COLORS[cls]} pulse={band === 'critical'} />
                          <span
                            className={cn(
                              'font-mono text-[10.5px]',
                              active ? 'text-[#8FE6FF]' : 'text-[#DCE4EE]'
                            )}
                          >
                            {formatEventId(e.id)}
                          </span>
                        </span>
                      </Td>
                      <Td className="font-mono tabular-nums text-[#A9B6C6]">{formatDateTime(e.acqDatetime)}</Td>
                      <Td>
                        <span className="text-[11.5px] text-[#C3CFDD]">{CLASS_LABELS[cls]}</span>
                      </Td>
                      <Td>
                        <span className="flex items-center gap-1.5">
                          <span className="h-[4px] w-[26px] overflow-hidden rounded-full bg-white/[0.07]">
                            <span
                              className="block h-full rounded-full"
                              style={{ width: `${conf * 100}%`, background: confMeta.color }}
                            />
                          </span>
                          <span className="font-mono text-[10px] tabular-nums" style={{ color: confMeta.color }}>
                            {Math.round(conf * 100)}%
                          </span>
                        </span>
                      </Td>
                      <Td>
                        <span
                          className="font-mono text-[10px] uppercase tracking-[0.1em]"
                          style={{ color: PRIORITY_COLORS[band] }}
                        >
                          {PRIORITY_LABELS[band]} · {eventPriorityScore(e)}
                        </span>
                      </Td>
                      <Td className="text-right font-mono tabular-nums text-[#C3CFDD]">
                        {(e.frp ?? 0).toFixed(1)}
                      </Td>
                      <Td className="text-right font-mono tabular-nums text-[#C3CFDD]">
                        {eventActiveDays(e)}
                      </Td>
                      <Td className="text-[#A9B6C6]">
                        {[e.enrichment?.admin?.district, e.enrichment?.admin?.state].filter(Boolean).join(', ') ||
                          '—'}
                      </Td>
                      <Td className="text-[#A9B6C6]">
                        {e.enrichment?.nearestIndustrialSite
                          ? `${e.enrichment.nearestIndustrialSite.name}`
                          : '—'}
                      </Td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pagination ────────────────────────────────────────────────── */}
      <footer className="mt-3 flex shrink-0 items-center gap-3">
        <SectionLabel>
          Page {safePage + 1} / {pageCount}
        </SectionLabel>
        <span className="font-mono text-[9px] tabular-nums text-[#6B7C90]">
          {rows.length} rows · {events.length.toLocaleString()} matching
        </span>
        <div className="ml-auto flex items-center gap-1">
          <IconButton
            label="Previous page"
            disabled={safePage === 0}
            onClick={() => setPage(Math.max(0, safePage - 1))}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton
            label="Next page"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      </footer>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        'px-3 py-2 text-left font-mono text-[8px] uppercase tracking-[0.14em] text-[#6B7C90]',
        className
      )}
    >
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn('px-3 py-[7px] text-[11.5px]', className)}>{children}</td>;
}
