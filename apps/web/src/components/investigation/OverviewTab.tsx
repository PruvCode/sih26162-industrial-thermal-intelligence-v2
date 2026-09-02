'use client';

/**
 * OVERVIEW — the anomaly story plus the subtle relationship view.
 *
 * The relationship diagram is deliberately small: event → facility /
 * persistence / intensity / evidence. It is a reading aid for four numbers the
 * analyst already has, not a spider chart.
 */

import { useMemo } from 'react';
import { Crosshair, Factory, Flame, Repeat, FileCheck2, AlertTriangle } from 'lucide-react';
import type { EventDetail } from '@/types/intelligence';
import { CLASS_LABELS, EVENT_COLORS, describeConfidence } from '@/lib/constants';
import { eventClass, eventConfidence, eventPriorityScore } from '@/data/derive';
import { formatDateTime } from '@/lib/formatters';
import { SectionLabel } from '@/components/ui/primitives';
import { WINDOW_DAYS } from '@/data/dataset';

export function OverviewTab({ detail }: { detail: EventDetail }) {
  const { event, source, story } = detail;
  const cls = eventClass(event);
  const conf = eventConfidence(event);
  const site = event.enrichment?.nearestIndustrialSite;
  const activeDays = source?.activeDays ?? 1;

  /** Normalised 0..1 magnitudes for the relationship spokes. */
  const spokes = useMemo(
    () => [
      {
        icon: Factory,
        label: 'Industrial proximity',
        value: site
          ? site.distanceKm <= 3
            ? 'Immediate'
            : `${site.distanceKm.toFixed(1)} km`
          : 'None',
        magnitude: site ? Math.max(0.08, 1 - Math.min(site.distanceKm, 25) / 25) : 0.05,
        color: '#F97316',
      },
      {
        icon: Repeat,
        label: 'Persistence',
        value: `${activeDays}/${WINDOW_DAYS} days`,
        magnitude: Math.min(1, activeDays / WINDOW_DAYS),
        color: '#00D9FF',
      },
      {
        icon: Flame,
        label: 'Thermal intensity',
        value: `${(event.frp ?? 0).toFixed(1)} MW`,
        magnitude: Math.min(1, (event.frp ?? 0) / 90),
        color: '#EF4444',
      },
      {
        icon: FileCheck2,
        label: 'Evidence strength',
        value: `${Math.round(conf * 100)}%`,
        magnitude: conf,
        color: '#22C55E',
      },
    ],
    [site, activeDays, event.frp, conf]
  );

  return (
    <div className="space-y-5">
      {/* Story */}
      <section>
        <div className="mb-2 flex items-center gap-2">
          <span className="h-[6px] w-[6px] rounded-full" style={{ background: EVENT_COLORS[cls] }} />
          <SectionLabel>{story.headline}</SectionLabel>
        </div>
        <p className="text-[12.5px] leading-[1.75] text-[#B6C2D0]">
          {story.sentences.join(' ')}
        </p>
      </section>

      {/* Relationship view */}
      <section>
        <SectionLabel>Signal composition</SectionLabel>
        <div className="mt-2.5 rounded-md border border-white/[0.06] bg-black/20 p-3">
          <div className="mb-3 flex items-center gap-2 border-b border-white/[0.05] pb-2.5">
            <Crosshair className="h-3.5 w-3.5 text-[#8798AC]" />
            <span className="font-mono text-[11px] tracking-[0.06em] text-[#E8EDF3]">
              {CLASS_LABELS[cls]}
            </span>
            <span className="ml-auto font-mono text-[9px] tabular-nums text-[#6B7C90]">
              {event.id.toUpperCase().replace(/_/g, '-')}
            </span>
          </div>

          <div className="space-y-2.5">
            {spokes.map((s) => (
              <div key={s.label} className="flex items-center gap-2.5">
                <s.icon className="h-3 w-3 shrink-0" style={{ color: s.color }} />
                <span className="w-[124px] shrink-0 text-[11px] text-[#A9B6C6]">{s.label}</span>
                <div className="h-[3px] min-w-0 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                  <div
                    className="h-full rounded-full transition-[width] duration-700"
                    style={{
                      width: `${Math.max(3, s.magnitude * 100)}%`,
                      background: s.color,
                      transitionTimingFunction: 'cubic-bezier(0.16,1,0.3,1)',
                    }}
                  />
                </div>
                <span className="w-[74px] shrink-0 text-right font-mono text-[10px] tabular-nums text-[#DCE4EE]">
                  {s.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Detection facts */}
      <section>
        <SectionLabel>Detection</SectionLabel>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2.5">
          <Row label="Acquired" value={formatDateTime(event.acqDatetime)} />
          <Row label="Satellite" value={`${event.satellite} · ${event.instrument}`} />
          <Row label="Brightness" value={`${event.brightness.toFixed(1)} K`} />
          <Row label="Bright T31" value={event.brightT31 ? `${event.brightT31.toFixed(1)} K` : '—'} />
          <Row label="Overpass" value={event.daynight === 'N' ? 'Night' : 'Day'} />
          <Row label="Sensor confidence" value={`${event.confidence}%`} />
          <Row label="Scan / track" value={`${event.scan ?? '—'} / ${event.track ?? '—'}`} />
          <Row label="Priority score" value={String(eventPriorityScore(event))} />
        </dl>
      </section>

      {/* Caveats */}
      {story.caveats.length > 0 && (
        <section>
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle className="h-3 w-3 text-[#F97316]" />
            <SectionLabel>Caveats</SectionLabel>
          </div>
          <ul className="space-y-1.5">
            {story.caveats.map((c) => (
              <li key={c} className="flex gap-2 text-[11.5px] leading-relaxed text-[#C3A98C]">
                <span className="mt-[6px] h-[3px] w-[3px] shrink-0 rounded-full bg-[#F97316]" />
                {c}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Confidence note */}
      <section className="rounded-md border border-white/[0.06] bg-black/20 px-3 py-2.5">
        <p className="text-[11px] leading-relaxed text-[#8798AC]">
          <span className="font-mono uppercase tracking-[0.12em]" style={{ color: describeConfidence(conf).color }}>
            {describeConfidence(conf).label}
          </span>{' '}
          — {describeConfidence(conf).note}
        </p>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[8px] uppercase tracking-[0.14em] text-[#6B7C90]">{label}</dt>
      <dd className="mt-0.5 truncate font-mono text-[11px] tabular-nums text-[#DCE4EE]">{value}</dd>
    </div>
  );
}
