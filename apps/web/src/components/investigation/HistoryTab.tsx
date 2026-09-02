'use client';

/**
 * HISTORY — has this source been seen before?
 *
 * A single thermal detection means almost nothing. A source that appears on
 * nine of the last thirty days, at the same coordinates, with the same
 * brightness profile, is an operating process. This tab is the whole argument,
 * so it leads with the rhythm (the chart) and only then lists the raw
 * observations.
 *
 * Every row is clickable: selecting an observation re-points the entire
 * application at that detection, because "show me the one where it flared" is
 * the actual analyst motion.
 */

import { useMemo } from 'react';
import { History, ArrowRight } from 'lucide-react';
import type { EventDetail } from '@/types/intelligence';
import type { HistoricalObservation } from '@/types/event';
import { useAppStore } from '@/store/useAppStore';
import { EVENT_COLORS } from '@/lib/constants';
import { eventClass } from '@/data/derive';
import { formatDate, formatDateTime, formatEventId, formatFrp } from '@/lib/formatters';
import { EmptyState, SectionLabel } from '@/components/ui/primitives';

const CHART_W = 336;
const CHART_H = 88;
const PAD_X = 4;
const PAD_Y = 8;

export function HistoryTab({ detail }: { detail: EventDetail }) {
  const selectEvent = useAppStore((s) => s.selectEvent);
  const history = detail.history;

  const series = useMemo(() => {
    if (!history.length) return null;
    const pts = history
      .slice()
      .sort((a, b) => (a.acqDatetime < b.acqDatetime ? -1 : 1))
      .map((h) => ({
        obs: h,
        t: new Date(h.acqDatetime).getTime(),
        v: h.frp ?? Math.max(0, h.brightness - 290),
      }));

    const times = pts.map((p) => p.t);
    const values = pts.map((p) => p.v);
    const tMin = Math.min(...times);
    const tMax = Math.max(...times);
    const vMax = Math.max(...values, 0.001);

    const span = Math.max(1, tMax - tMin);
    const x = (t: number) => PAD_X + ((t - tMin) / span) * (CHART_W - PAD_X * 2);
    const y = (v: number) => CHART_H - PAD_Y - (v / vMax) * (CHART_H - PAD_Y * 2);

    const coords = pts.map((p) => ({ p, cx: x(p.t), cy: y(p.v) }));
    const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.cx.toFixed(1)},${c.cy.toFixed(1)}`).join(' ');
    const area = `${line} L${coords[coords.length - 1].cx.toFixed(1)},${CHART_H - PAD_Y} L${coords[0].cx.toFixed(1)},${CHART_H - PAD_Y} Z`;

    // Distinct days, and the longest gap — both are persistence signals.
    let longestGapDays = 0;
    for (let i = 1; i < pts.length; i += 1) {
      const gap = (pts[i].t - pts[i - 1].t) / 86_400_000;
      if (gap > longestGapDays) longestGapDays = gap;
    }

    return {
      coords,
      line,
      area,
      first: pts[0],
      last: pts[pts.length - 1],
      distinctDays: new Set(pts.map((p) => new Date(p.t).toISOString().slice(0, 10))).size,
      longestGapDays: Math.round(longestGapDays),
      spanDays: Math.ceil(span / 86_400_000),
      peak: pts.reduce((a, b) => (b.v > a.v ? b : a)),
    };
  }, [history]);

  if (!history.length || !series) {
    return (
      <EmptyState
        title="Single detection"
        detail="This coordinate has been observed once within the current window. Persistence metrics appear once a second overpass records the same source."
      />
    );
  }

  const color = EVENT_COLORS[eventClass(detail.event)];
  const firstDate = formatDate(series.first.obs.acqDatetime);
  const lastDate = formatDate(series.last.obs.acqDatetime);

  return (
    <div className="space-y-5">
      {/* ── Persistence summary ────────────────────────────────────────── */}
      <section>
        <SectionLabel>Persistence</SectionLabel>
        <p className="mt-2 text-[12.5px] leading-relaxed text-[#C3CFDD]">
          This source was recorded{' '}
          <span className="font-mono text-[#E8EDF3]">{history.length} times</span> across{' '}
          <span className="font-mono text-[#E8EDF3]">{series.distinctDays} distinct days</span> in a{' '}
          <span className="font-mono text-[#E8EDF3]">{series.spanDays}-day</span> span —{' '}
          {series.distinctDays >= 5
            ? 'a recurring thermal process, not an isolated ignition.'
            : 'intermittent, consistent with episodic activity.'}
        </p>
      </section>

      {/* ── Signal chart ───────────────────────────────────────────────── */}
      <section>
        <div className="mb-1.5 flex items-baseline justify-between">
          <SectionLabel>Radiative power over time</SectionLabel>
          <span className="font-mono text-[9px] tabular-nums text-[#6B7C90]">
            PEAK {formatFrp(series.peak.v)}
          </span>
        </div>

        <svg
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          className="h-[88px] w-full overflow-visible"
          role="img"
          aria-label={`Thermal signal history: ${history.length} observations between ${firstDate} and ${lastDate}`}
        >
          <defs>
            <linearGradient id="hist-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.26" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* baseline */}
          <line
            x1={PAD_X}
            y1={CHART_H - PAD_Y}
            x2={CHART_W - PAD_X}
            y2={CHART_H - PAD_Y}
            stroke="rgba(255,255,255,0.07)"
            strokeWidth="1"
          />

          <path d={series.area} fill="url(#hist-fill)" />
          <path
            d={series.line}
            fill="none"
            stroke={color}
            strokeWidth="1.35"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {series.coords.map((c) => {
            const isCurrent = c.p.obs.eventId === detail.event.id;
            return (
              <g key={`${c.p.obs.eventId}-${c.p.t}`}>
                {isCurrent && (
                  <circle cx={c.cx} cy={c.cy} r="5.5" fill={color} fillOpacity="0.18" stroke={color} strokeWidth="1" />
                )}
                <circle
                  cx={c.cx}
                  cy={c.cy}
                  r={isCurrent ? 3 : 2}
                  fill={isCurrent ? color : '#0B0F16'}
                  stroke={color}
                  strokeWidth="1"
                />
              </g>
            );
          })}
        </svg>

        <div className="mt-1 flex justify-between font-mono text-[8.5px] tabular-nums text-[#6B7C90]">
          <span>{firstDate}</span>
          <span>LONGEST GAP {series.longestGapDays}d</span>
          <span>{lastDate}</span>
        </div>
      </section>

      {/* ── Observation log ────────────────────────────────────────────── */}
      <section>
        <div className="mb-2 flex items-center gap-2">
          <History className="h-3 w-3 text-[#8798AC]" />
          <SectionLabel>Observation log</SectionLabel>
          <span className="ml-auto font-mono text-[9px] tabular-nums text-[#6B7C90]">
            {history.length} records
          </span>
        </div>

        <div className="-mx-1 overflow-hidden rounded-md border border-white/[0.06]">
          {/* header */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 border-b border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5">
            <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-[#6B7C90]">Acquired</span>
            <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-[#6B7C90]">Sat</span>
            <span className="text-right font-mono text-[8px] uppercase tracking-[0.14em] text-[#6B7C90]">K</span>
            <span className="text-right font-mono text-[8px] uppercase tracking-[0.14em] text-[#6B7C90]">
              FRP
            </span>
          </div>

          <ul className="max-h-[196px] divide-y divide-white/[0.04] overflow-y-auto">
            {series.coords
              .slice()
              .reverse()
              .map((c) => (
                <HistoryRow
                  key={`${c.p.obs.eventId}-${c.p.t}`}
                  obs={c.p.obs}
                  current={c.p.obs.eventId === detail.event.id}
                  onSelect={() => selectEvent(c.p.obs.eventId)}
                />
              ))}
          </ul>
        </div>

        <p className="mt-2 font-mono text-[8.5px] uppercase tracking-[0.12em] text-[#6B7C90]">
          Select a record to re-focus the map on that detection
        </p>
      </section>
    </div>
  );
}

function HistoryRow({
  obs,
  current,
  onSelect,
}: {
  obs: HistoricalObservation;
  current: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        data-cursor="button"
        onClick={onSelect}
        aria-current={current ? 'true' : undefined}
        title={formatEventId(obs.eventId)}
        className={[
          'group grid w-full grid-cols-[1fr_auto_auto_auto] items-center gap-2 px-2.5 py-[7px] text-left transition-colors duration-200',
          current ? 'bg-[rgba(0,217,255,0.07)]' : 'hover:bg-white/[0.035]',
        ].join(' ')}
      >
        <span
          className="truncate font-mono text-[10px] tabular-nums"
          style={{ color: current ? '#8FE6FF' : '#A9B6C6' }}
        >
          {formatDateTime(obs.acqDatetime)}
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-[#8798AC]">
          {obs.satellite}
        </span>
        <span className="text-right font-mono text-[10px] tabular-nums text-[#C3CFDD]">
          {obs.brightness.toFixed(0)}
        </span>
        <span className="flex items-center justify-end gap-1 text-right font-mono text-[10px] tabular-nums text-[#C3CFDD]">
          {obs.frp !== undefined ? obs.frp.toFixed(1) : '—'}
          <ArrowRight className="h-2.5 w-2.5 text-[#3E4C5E] transition-colors duration-200 group-hover:text-[#8FE6FF]" />
        </span>
      </button>
    </li>
  );
}
