'use client';

/**
 * ANALYTICS VIEW.
 *
 * Deliberately not a dashboard of decorative gauges. Every chart here answers
 * a question an operator actually asks: what are we seeing, how sure are we,
 * where is it concentrated, and which sources are worth a person's attention.
 */

import { useMemo } from 'react';
import { Activity, BarChart3, MapPinned, Radar, ServerCrash } from 'lucide-react';
import { useAllEvents, useAnalytics, usePersistentSources } from '@/features/events/hooks';
import { useAppStore } from '@/store/useAppStore';
import { CLASS_LABELS, CLASS_SHORT, EVENT_COLORS, PRIORITY_COLORS, PRIORITY_LABELS } from '@/lib/constants';
import { eventPriorityScore } from '@/data/derive';
import { formatDate } from '@/lib/formatters';
import { Badge, Button, EmptyState, ErrorState, Metric, SectionLabel, Skeleton } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import { useFilteredEvents } from '@/features/events/useFilteredEvents';

export function AnalyticsView() {
  const { data, isLoading, isError, refetch } = useAnalytics();
  const { data: sourcesData } = usePersistentSources(10);
  const { data: allData } = useAllEvents();
  const selectEvent = useAppStore((s) => s.selectEvent);
  const setView = useAppStore((s) => s.setView);
  const { events: visibleEvents } = useFilteredEvents();

  const view = data?.data ?? null;
  const sources = sourcesData?.data ?? [];

  const maxDay = useMemo(
    () => Math.max(1, ...(view?.byDay ?? []).map((d) => d.count)),
    [view]
  );

  /**
   * A source is an abstraction over many detections; clicking one has to land
   * on a concrete event. Pick the highest-priority detection belonging to that
   * cluster so the analyst arrives at the most significant record.
   */
  const representativeFor = useMemo(() => {
    const map = new Map<number, string>();
    const events = allData?.data ?? [];
    for (const e of events) {
      if (e.clusterId === undefined) continue;
      const existing = map.get(e.clusterId);
      if (existing === undefined) {
        map.set(e.clusterId, e.id);
        continue;
      }
      const current = events.find((x) => x.id === existing);
      if (current && eventPriorityScore(e) > eventPriorityScore(current)) {
        map.set(e.clusterId, e.id);
      }
    }
    return map;
  }, [allData]);

  if (isLoading) {
    return (
      <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    );
  }

  if (isError || !view) {
    return (
      <div className="flex h-full items-center justify-center">
        <ErrorState
          title="Analytics unavailable"
          detail="The summary could not be derived from the current dataset."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-6 py-5">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-3.5 w-3.5 text-[#8FE6FF]" />
            <h1 className="font-display text-[26px] leading-none text-[#F2F6FA]">Analytics</h1>
          </div>
          <p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-[#8798AC]">
            {formatDate(view.period.start)} — {formatDate(view.period.end)} · {view.windowDays}-day window ·{' '}
            {view.totals.events.toLocaleString()} detections
          </p>
        </div>
        <Button variant="ghost" onClick={() => setView('command')}>
          Back to map
        </Button>
      </header>

      {/* ── Headline figures ───────────────────────────────────────────── */}
      <section className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card label="Detections" value={view.totals.events.toLocaleString()} sub={`${visibleEvents.length} match current filters`} tone="accent" icon={<Activity className="h-3 w-3" />} />
        <Card label="Distinct sources" value={view.totals.sources.toLocaleString()} sub={`${view.totals.persistentSources} persistent`} icon={<Radar className="h-3 w-3" />} />
        <Card label="Industrial share" value={`${(view.totals.industrialShare * 100).toFixed(1)}%`} sub="Of all classified detections" icon={<MapPinned className="h-3 w-3" />} />
        <Card label="Require review" value={view.totals.requiresReview.toLocaleString()} sub="Confidence below 55%" tone="warn" icon={<ServerCrash className="h-3 w-3" />} />
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* ── Class distribution ───────────────────────────────────────── */}
        <Panel title="Classification distribution" span="xl:col-span-1">
          <ul className="space-y-3">
            {view.byClass.map((c) => (
              <li key={c.class}>
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <span className="text-[12px] text-[#DCE4EE]">{CLASS_LABELS[c.class]}</span>
                  <span className="font-mono text-[10px] tabular-nums text-[#8798AC]">
                    {c.count.toLocaleString()} · {(c.share * 100).toFixed(1)}%
                  </span>
                </div>
                <Bar
                  value={c.share}
                  color={EVENT_COLORS[c.class]}
                  sub={`mean confidence ${(c.avgConfidence * 100).toFixed(0)}%`}
                />
              </li>
            ))}
          </ul>
        </Panel>

        {/* ── Daily volume ─────────────────────────────────────────────── */}
        <Panel title="Detections per day" span="xl:col-span-2">
          <div className="flex h-[132px] items-end gap-[2px]">
            {view.byDay.map((d) => {
              const h = Math.max(2, (d.count / maxDay) * 100);
              const indShare = d.count ? d.industrial / d.count : 0;
              return (
                <div
                  key={d.date}
                  className="group relative flex-1"
                  style={{ height: '100%' }}
                  title={`${d.date}: ${d.count} detections (${d.industrial} industrial)`}
                >
                  <div
                    className="absolute bottom-0 w-full rounded-[1px] transition-all duration-300"
                    style={{
                      height: `${h}%`,
                      background: `linear-gradient(to top, ${'#EF4444'}00, ${'#EF4444'}${Math.round(indShare * 90 + 30).toString(16).padStart(2, '0')})`,
                      borderTop: `1px solid ${EVENT_COLORS.industrial_fire}${Math.round(indShare * 155 + 100).toString(16).padStart(2, '0')}`,
                    }}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between font-mono text-[8.5px] tabular-nums text-[#6B7C90]">
            <span>{formatDate(view.period.start)}</span>
            <span>Industrial portion shaded</span>
            <span>{formatDate(view.period.end)}</span>
          </div>
        </Panel>

        {/* ── Priority ─────────────────────────────────────────────────── */}
        <Panel title="Priority bands" span="xl:col-span-1">
          <ul className="space-y-2.5">
            {view.byPriority.map((p) => (
              <li key={p.band} className="flex items-center gap-3">
                <Badge color={PRIORITY_COLORS[p.band]}>{PRIORITY_LABELS[p.band]}</Badge>
                <span className="ml-auto font-mono text-[12px] tabular-nums text-[#E8EDF3]">
                  {p.count.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-4 border-t border-white/[0.06] pt-3">
            <SectionLabel>By state</SectionLabel>
            <ul className="mt-2 max-h-[168px] space-y-1.5 overflow-y-auto pr-1">
              {view.byState.slice(0, 12).map((s) => (
                <li key={s.state} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[11.5px] text-[#C3CFDD]">{s.state}</span>
                  <Bar value={s.count / Math.max(1, view.byState[0]?.count ?? 1)} color="#4E9BBF" width={72} />
                  <span className="w-9 shrink-0 text-right font-mono text-[10px] tabular-nums text-[#8798AC]">
                    {s.count}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>

        {/* ── Hotspot ranking ──────────────────────────────────────────── */}
        <Panel
          title="Persistent source ranking"
          span="xl:col-span-2"
          action={<span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#6B7C90]">Top {sources.length}</span>}
        >
          {sources.length === 0 ? (
            <EmptyState title="No persistent sources" detail="No source met the persistence threshold in this window." />
          ) : (
            <div className="-mx-1 overflow-hidden rounded-md border border-white/[0.06]">
              <div className="grid grid-cols-[28px_1fr_88px_72px_64px_60px] gap-2 border-b border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5">
                <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-[#6B7C90]">#</span>
                <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-[#6B7C90]">Source</span>
                <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-[#6B7C90]">Facility</span>
                <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-[#6B7C90]">State</span>
                <span className="text-right font-mono text-[8px] uppercase tracking-[0.14em] text-[#6B7C90]">Days</span>
                <span className="text-right font-mono text-[8px] uppercase tracking-[0.14em] text-[#6B7C90]">Score</span>
              </div>
              <ul className="divide-y divide-white/[0.04]">
                {sources.map((s, i) => (
                  <li key={s.hotspotId}>
                    <button
                      type="button"
                      data-cursor="button"
                      onClick={() => {
                        const eventId = representativeFor.get(s.hotspotId);
                        if (!eventId) return;
                        selectEvent(eventId);
                        setView('command');
                      }}
                      className="grid w-full grid-cols-[28px_1fr_88px_72px_64px_60px] items-center gap-2 px-2.5 py-[7px] text-left transition-colors duration-200 hover:bg-white/[0.035]"
                    >
                      <span className="font-mono text-[10px] tabular-nums text-[#6B7C90]">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[11.5px] text-[#DCE4EE]">{s.label}</span>
                        <span className="flex items-center gap-1.5">
                          <span
                            className="h-[5px] w-[5px] rounded-full"
                            style={{ background: EVENT_COLORS[s.dominantClass] }}
                          />
                          <span className="font-mono text-[8.5px] uppercase tracking-[0.1em] text-[#6B7C90]">
                            {CLASS_SHORT[s.dominantClass]} · {s.detectionCount} det
                          </span>
                        </span>
                      </span>
                      <span className="truncate font-mono text-[9.5px] text-[#A9B6C6]">
                        {s.facilityName ?? '—'}
                      </span>
                      <span className="truncate font-mono text-[9.5px] text-[#A9B6C6]">{s.state}</span>
                      <span className="text-right font-mono text-[10px] tabular-nums text-[#C3CFDD]">
                        {s.activeDays}
                      </span>
                      <span className="text-right font-mono text-[11px] tabular-nums text-[#8FE6FF]">
                        {s.priorityScore}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>

        {/* ── Instruments ──────────────────────────────────────────────── */}
        <Panel title="Instrument contribution" span="xl:col-span-1">
          <ul className="space-y-3">
            {view.bySatellite.map((s) => {
              const share = s.count / Math.max(1, view.totals.events);
              return (
                <li key={s.satellite}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-2">
                    <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#DCE4EE]">
                      {s.satellite}
                    </span>
                    <span className="font-mono text-[10px] tabular-nums text-[#8798AC]">
                      {s.count.toLocaleString()} · {(share * 100).toFixed(0)}%
                    </span>
                  </div>
                  <Bar value={share} color="#4E9BBF" />
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

// ── Small parts ─────────────────────────────────────────────────────────────

function Card({
  label,
  value,
  sub,
  tone = 'default',
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'default' | 'accent' | 'warn' | 'good';
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-glass border border-white/[0.07] bg-white/[0.02] p-3.5">
      <div className="flex items-center gap-1.5">
        <span className="text-[#8798AC]">{icon}</span>
        <SectionLabel>{label}</SectionLabel>
      </div>
      <Metric label="" value={value} sub={sub} tone={tone} />
    </div>
  );
}

function Panel({
  title,
  children,
  span,
  action,
}: {
  title: string;
  children: React.ReactNode;
  span?: string;
  action?: React.ReactNode;
}) {
  return (
    <section className={cn('rounded-glass border border-white/[0.07] bg-white/[0.02] p-3.5', span)}>
      <header className="mb-3 flex items-center gap-2">
        <h2 className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-[#E8EDF3]">{title}</h2>
        {action && <span className="ml-auto">{action}</span>}
      </header>
      {children}
    </section>
  );
}

function Bar({
  value,
  color,
  width,
  sub,
}: {
  value: number;
  color: string;
  width?: number;
  sub?: string;
}) {
  return (
    <div>
      <div
        className="h-[5px] overflow-hidden rounded-full bg-white/[0.05]"
        style={width ? { width } : undefined}
      >
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{
            width: `${Math.min(100, Math.max(0, value * 100))}%`,
            background: color,
            boxShadow: `0 0 8px ${color}66`,
          }}
        />
      </div>
      {sub && <p className="mt-1 font-mono text-[8.5px] text-[#5A6B7F]">{sub}</p>}
    </div>
  );
}
