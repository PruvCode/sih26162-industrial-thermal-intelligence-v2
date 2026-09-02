'use client';

/**
 * WATCHTOWER — the monitoring view.
 *
 * The map answers "what is happening". This answers "what changed, and what is
 * still running". Three columns, because those are the three questions an
 * operator opens a monitoring screen with: what is new, what matters most,
 * what never stops.
 */

import { Eye, Clock, AlertTriangle, Flame, Snowflake } from 'lucide-react';
import { useWatchtower, useAllEvents } from '@/features/events/hooks';
import { useAppStore } from '@/store/useAppStore';
import { CLASS_SHORT, EVENT_COLORS, PRIORITY_COLORS, PRIORITY_LABELS, describeConfidence } from '@/lib/constants';
import { eventClass, eventConfidence, eventPriorityBand, eventPriorityScore, relativeAge } from '@/data/derive';
import { DEMO_REFERENCE_DATE } from '@/data/dataset';
import { formatEventId, formatDateTime } from '@/lib/formatters';
import { Dot, EmptyState, ErrorState, SectionLabel, Skeleton } from '@/components/ui/primitives';
import type { ThermalEvent } from '@/types/event';

export function Watchtower() {
  const { data, isLoading, isError, refetch } = useWatchtower();
  const { data: allData } = useAllEvents();
  const selectEvent = useAppStore((s) => s.selectEvent);
  const setView = useAppStore((s) => s.setView);
  const watchlist = useAppStore((s) => s.watchlist);

  const digest = data?.data ?? null;
  const watchedEvents = (allData?.data ?? []).filter((e) => watchlist.includes(e.id));

  const focus = (id: string) => {
    selectEvent(id);
    setView('command');
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 p-6 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-72 w-full" />
        ))}
      </div>
    );
  }

  if (isError || !digest) {
    return (
      <div className="flex h-full items-center justify-center">
        <ErrorState title="Monitoring unavailable" detail="The digest could not be assembled." onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-6 py-5">
      <header className="mb-5">
        <div className="flex items-center gap-2">
          <Eye className="h-3.5 w-3.5 text-[#8FE6FF]" />
          <h1 className="font-display text-[26px] leading-none text-[#F2F6FA]">Watchtower</h1>
        </div>
        <p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-[#8798AC]">
          {digest.totals.events.toLocaleString()} detections · {digest.totals.persistentSources} persistent sources ·{' '}
          {digest.totals.requiresReview} awaiting review · {digest.windowDays}-day window
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <Column
          title="Newest detections"
          icon={<Clock className="h-3 w-3" />}
          count={digest.newEvents.length}
          empty="No recent detections"
        >
          {digest.newEvents.map((e) => (
            <EventRow key={e.id} event={e} onSelect={focus} showAge />
          ))}
        </Column>

        <Column
          title="Highest priority"
          icon={<AlertTriangle className="h-3 w-3" />}
          count={digest.priorityEvents.length}
          empty="No prioritised detections"
        >
          {digest.priorityEvents.map((e) => (
            <EventRow key={e.id} event={e} onSelect={focus} showScore />
          ))}
        </Column>

        <Column
          title="Persistent sources"
          icon={<Flame className="h-3 w-3" />}
          count={digest.persistentSources.length}
          empty="No persistent sources"
        >
          {digest.persistentSources.length === 0 ? null : (
            <ul className="space-y-1.5">
              {digest.persistentSources.map((s, i) => (
                <li key={s.hotspotId}>
                  <div
                    className="rounded-md border border-white/[0.06] bg-white/[0.015] px-2.5 py-2"
                    data-cursor="panel"
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-[9px] tabular-nums text-[#6B7C90]">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[11.5px] text-[#DCE4EE]">{s.label}</span>
                      <span className="shrink-0 font-mono text-[11px] tabular-nums text-[#8FE6FF]">
                        {s.priorityScore}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 pl-6">
                      <span
                        className="h-[5px] w-[5px] rounded-full"
                        style={{ background: EVENT_COLORS[s.dominantClass] }}
                      />
                      <span className="font-mono text-[8.5px] uppercase tracking-[0.1em] text-[#6B7C90]">
                        {CLASS_SHORT[s.dominantClass]}
                      </span>
                      <span className="font-mono text-[8.5px] uppercase tracking-[0.1em] text-[#6B7C90]">
                        {s.state}
                      </span>
                      <span className="ml-auto font-mono text-[9px] tabular-nums text-[#A9B6C6]">
                        {s.activeDays}d / {s.detectionCount} det
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Column>
      </div>

      {/* ── Watchlist ─────────────────────────────────────────────────── */}
      <section className="mt-5">
        <div className="mb-2.5 flex items-center gap-2">
          <SectionLabel>Watchlist</SectionLabel>
          <span className="font-mono text-[9px] tabular-nums text-[#6B7C90]">{watchedEvents.length}</span>
        </div>

        {watchedEvents.length === 0 ? (
          <div className="rounded-glass border border-dashed border-white/[0.09] px-4 py-6 text-center">
            <Snowflake className="mx-auto h-4 w-4 text-[#5A6B7F]" />
            <p className="mt-2.5 text-[12px] text-[#8798AC]">
              Events you star are tracked here and persist across reloads.
            </p>
          </div>
        ) : (
          <div className="grid gap-1.5 md:grid-cols-2 xl:grid-cols-3">
            {watchedEvents.map((e) => (
              <EventRow key={e.id} event={e} onSelect={focus} showScore />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ── Small parts ─────────────────────────────────────────────────────────────

function Column({
  title,
  icon,
  count,
  empty,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-glass border border-white/[0.07] bg-white/[0.02] p-3.5">
      <header className="mb-3 flex items-center gap-2">
        <span className="text-[#8798AC]">{icon}</span>
        <h2 className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-[#E8EDF3]">{title}</h2>
        <span className="ml-auto font-mono text-[9px] tabular-nums text-[#6B7C90]">{count}</span>
      </header>
      {count === 0 ? <EmptyState title={empty} /> : <ul className="space-y-1.5">{children}</ul>}
    </section>
  );
}

function EventRow({
  event,
  onSelect,
  showAge,
  showScore,
}: {
  event: ThermalEvent;
  onSelect: (id: string) => void;
  showAge?: boolean;
  showScore?: boolean;
}) {
  const cls = eventClass(event);
  const conf = eventConfidence(event);
  const band = eventPriorityBand(event);
  const confMeta = describeConfidence(conf);

  return (
    <li>
      <button
        type="button"
        data-cursor="button"
        onClick={() => onSelect(event.id)}
        className="group flex w-full items-center gap-2.5 rounded-md border border-white/[0.06] bg-white/[0.015] px-2.5 py-1.5 text-left transition-colors duration-200 hover:border-white/[0.13] hover:bg-white/[0.04]"
      >
        <Dot color={EVENT_COLORS[cls]} pulse={band === 'critical'} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-mono text-[10.5px] text-[#DCE4EE]">
            {formatEventId(event.id)}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="font-mono text-[8.5px] uppercase tracking-[0.1em] text-[#6B7C90]">
              {CLASS_SHORT[cls]}
            </span>
            {showAge && (
              <span className="font-mono text-[8.5px] tabular-nums text-[#5A6B7F]">
                {relativeAge(event.acqDatetime, DEMO_REFERENCE_DATE)}
              </span>
            )}
          </span>
        </span>

        {showScore && (
          <span
            className="shrink-0 font-mono text-[11px] tabular-nums"
            style={{ color: PRIORITY_COLORS[band] }}
            title={`${PRIORITY_LABELS[band]} priority`}
          >
            {eventPriorityScore(event)}
          </span>
        )}

        <span
          className="shrink-0 font-mono text-[9px] tabular-nums"
          style={{ color: confMeta.color }}
          title={confMeta.note}
        >
          {Math.round(conf * 100)}%
        </span>

        <span className="hidden shrink-0 font-mono text-[8.5px] tabular-nums text-[#5A6B7F] xl:block">
          {formatDateTime(event.acqDatetime)}
        </span>
      </button>
    </li>
  );
}
