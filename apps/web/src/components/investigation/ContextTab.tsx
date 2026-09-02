'use client';

/**
 * CONTEXT — what is physically around this detection?
 *
 * A hot pixel in a refinery perimeter and a hot pixel in a forest are the same
 * pixel. Classification only becomes credible when the surroundings are on the
 * record, so this tab states the nearest facility with distance and bearing,
 * the land cover, the exposure (population density), and the other thermal
 * activity within the immediate area.
 */

import { useMemo } from 'react';
import { Factory, Trees, Users, MapPin, Compass, Layers } from 'lucide-react';
import type { EventDetail } from '@/types/intelligence';
import { useAppStore } from '@/store/useAppStore';
import { useAllEvents } from '@/features/events/hooks';
import { CLASS_LABELS, CLASS_SHORT, EVENT_COLORS } from '@/lib/constants';
import { distanceKm, bearingDeg, formatLatLng } from '@/lib/geo';
import { eventClass } from '@/data/derive';
import { formatEventId, formatFrp } from '@/lib/formatters';
import { EmptyState, SectionLabel, Skeleton } from '@/components/ui/primitives';

/** Radius for "the immediate area". Large enough to capture a facility cluster. */
const NEIGHBOUR_KM = 25;
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

function cardinal(deg: number): string {
  return COMPASS[Math.round(((deg % 360) / 45)) % 8];
}

export function ContextTab({ detail }: { detail: EventDetail }) {
  const selectEvent = useAppStore((s) => s.selectEvent);
  const { data } = useAllEvents();
  const allEvents = data?.data ?? [];

  const [lng, lat] = detail.event.geometry.coordinates as [number, number];
  const site = detail.event.enrichment?.nearestIndustrialSite;
  const landCover = detail.event.enrichment?.landCover;
  const population = detail.event.enrichment?.populationDensity;
  const admin = detail.event.enrichment?.admin;

  const neighbours = useMemo(() => {
    if (!allEvents.length) return [];
    return allEvents
      .filter((e) => e.id !== detail.event.id)
      .map((e) => {
        const [elng, elat] = e.geometry.coordinates as [number, number];
        return { event: e, km: distanceKm(lng, lat, elng, elat) };
      })
      .filter((n) => n.km <= NEIGHBOUR_KM)
      .sort((a, b) => a.km - b.km)
      .slice(0, 8);
  }, [allEvents, lng, lat, detail.event.id]);

  const hasSite = Boolean(site);
  const hasGeo = Boolean(landCover || population !== undefined);

  if (!hasSite && !hasGeo && neighbours.length === 0) {
    return (
      <EmptyState
        title="No contextual layers"
        detail="Industrial, land-cover and exposure enrichment is unavailable for this coordinate. Detection geometry remains valid."
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Coordinates ────────────────────────────────────────────────── */}
      <section>
        <SectionLabel>Position</SectionLabel>
        <div className="mt-2 flex items-baseline gap-2">
          <MapPin className="h-3 w-3 shrink-0 self-center text-[#8798AC]" />
          <span className="font-mono text-[13px] tabular-nums text-[#E8EDF3]">
            {formatLatLng(lat, lng)}
          </span>
        </div>
        <p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-[#8798AC]">
          {detail.breadcrumb.slice(1).join(' · ')}
        </p>
      </section>

      {/* ── Nearest facility ───────────────────────────────────────────── */}
      {site && (
        <section>
          <div className="mb-2 flex items-center gap-2">
            <Factory className="h-3 w-3 text-[#8798AC]" />
            <SectionLabel>Nearest industrial facility</SectionLabel>
          </div>

          <div className="rounded-md border border-white/[0.07] bg-white/[0.02] p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] leading-snug text-[#E8EDF3]">{site.name}</p>
                <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-[#8798AC]">
                  {site.type}
                </p>
              </div>

              {/* Bearing dial — small, functional, not decorative. */}
              <div className="flex shrink-0 flex-col items-center gap-1">
                <svg viewBox="0 0 40 40" className="h-10 w-10" aria-hidden="true">
                  <circle cx="20" cy="20" r="17" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                  <circle cx="20" cy="20" r="12" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                  <g transform={`rotate(${site.bearingDeg} 20 20)`}>
                    <path d="M20 6 L23.4 20 L20 17.2 L16.6 20 Z" fill="#00D9FF" fillOpacity="0.9" />
                  </g>
                  <circle cx="20" cy="20" r="1.6" fill="#8798AC" />
                </svg>
                <span className="font-mono text-[8px] tracking-[0.1em] text-[#6B7C90]">
                  {cardinal(site.bearingDeg)}
                </span>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-2.5">
              <Readout label="Distance" value={`${site.distanceKm.toFixed(2)} km`} />
              <Readout label="Bearing" value={`${site.bearingDeg.toFixed(0)}° ${cardinal(site.bearingDeg)}`} />
            </div>

            <p className="mt-2.5 text-[11.5px] leading-relaxed text-[#A9B6C6]">
              {site.distanceKm <= 1.5
                ? 'Within the facility perimeter — the thermal source is co-located with registered industrial infrastructure.'
                : site.distanceKm <= 5
                  ? 'Within the immediate industrial buffer — plausibly associated with this facility.'
                  : 'Nearby but not co-located — association should be treated as suggestive, not confirmed.'}
            </p>
          </div>
        </section>
      )}

      {/* ── Setting ────────────────────────────────────────────────────── */}
      {(landCover || population !== undefined) && (
        <section>
          <div className="mb-2 flex items-center gap-2">
            <Layers className="h-3 w-3 text-[#8798AC]" />
            <SectionLabel>Setting</SectionLabel>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {landCover && (
              <div className="rounded-md border border-white/[0.07] bg-white/[0.02] p-2.5">
                <div className="flex items-center gap-1.5">
                  <Trees className="h-2.5 w-2.5 text-[#8798AC]" />
                  <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-[#6B7C90]">
                    Land cover
                  </span>
                </div>
                <p className="mt-1.5 text-[12px] capitalize leading-snug text-[#DCE4EE]">{landCover}</p>
              </div>
            )}

            {population !== undefined && (
              <div className="rounded-md border border-white/[0.07] bg-white/[0.02] p-2.5">
                <div className="flex items-center gap-1.5">
                  <Users className="h-2.5 w-2.5 text-[#8798AC]" />
                  <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-[#6B7C90]">
                    Exposure
                  </span>
                </div>
                <p className="mt-1.5 font-mono text-[13px] tabular-nums leading-none text-[#DCE4EE]">
                  {population.toLocaleString()}
                  <span className="ml-1 text-[9px] text-[#8798AC]">/km²</span>
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Nearby activity ────────────────────────────────────────────── */}
      <section>
        <div className="mb-2 flex items-center gap-2">
          <Compass className="h-3 w-3 text-[#8798AC]" />
          <SectionLabel>Activity within {NEIGHBOUR_KM} km</SectionLabel>
          <span className="ml-auto font-mono text-[9px] tabular-nums text-[#6B7C90]">
            {neighbours.length}
          </span>
        </div>

        {!allEvents.length ? (
          <div className="space-y-1.5">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : neighbours.length === 0 ? (
          <p className="rounded-md border border-white/[0.06] bg-white/[0.015] px-3 py-3 text-[11.5px] leading-relaxed text-[#8798AC]">
            No other thermal detections within {NEIGHBOUR_KM} km in the current window. This is an
            isolated source.
          </p>
        ) : (
          <ul className="space-y-1">
            {neighbours.map((n) => {
              const cls = eventClass(n.event);
              return (
                <li key={n.event.id}>
                  <button
                    type="button"
                    data-cursor="button"
                    onClick={() => selectEvent(n.event.id)}
                    className="flex w-full items-center gap-2.5 rounded-md border border-white/[0.06] bg-white/[0.015] px-2.5 py-1.5 text-left transition-colors duration-200 hover:border-white/[0.12] hover:bg-white/[0.04]"
                  >
                    <span
                      className="h-[7px] w-[7px] shrink-0 rounded-full"
                      style={{ background: EVENT_COLORS[cls], boxShadow: `0 0 7px ${EVENT_COLORS[cls]}99` }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-[10px] text-[#DCE4EE]">
                        {formatEventId(n.event.id)}
                      </span>
                      <span className="block truncate font-mono text-[8.5px] uppercase tracking-[0.1em] text-[#6B7C90]">
                        {CLASS_SHORT[cls] ?? CLASS_LABELS[cls]}
                      </span>
                    </span>
                    <span className="shrink-0 text-right font-mono text-[10px] tabular-nums text-[#A9B6C6]">
                      {n.km < 1 ? `${(n.km * 1000).toFixed(0)} m` : `${n.km.toFixed(1)} km`}
                      <span className="ml-1.5 text-[9px] text-[#6B7C90]">
                        {formatFrp(n.event.frp ?? 0)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── Admin ──────────────────────────────────────────────────────── */}
      <section className="border-t border-white/[0.06] pt-3">
        <SectionLabel>Administrative</SectionLabel>
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
          <Row label="State" value={admin?.state ?? '—'} />
          <Row label="District" value={admin?.district ?? '—'} />
        </dl>
      </section>
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-[#6B7C90]">{label}</span>
      <span className="font-mono text-[12px] tabular-nums leading-none text-[#E8EDF3]">{value}</span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[8px] uppercase tracking-[0.14em] text-[#6B7C90]">{label}</dt>
      <dd className="mt-0.5 truncate text-[11.5px] text-[#DCE4EE]">{value}</dd>
    </div>
  );
}
