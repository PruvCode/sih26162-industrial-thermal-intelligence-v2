/**
 * Derived intelligence views.
 *
 * Every number the product shows in a panel, a story or a report is computed
 * here from ONE dataset. Nothing in this file invents data, and no component
 * is allowed to compute its own totals — that is how the previous build ended
 * up describing 12,543 events above a map with ten dots on it.
 */

import { getDataset, getEventEvidence, getEventHistory, WINDOW_DAYS } from './dataset';
import { DATA_PROVENANCE, priorityBand, type ThermalHotspot } from './dataset';
import { CLASS_LABELS, describeConfidence } from '@/lib/constants';
import type { ThermalEvent, ThermalClass, EventFilters } from '@/types/event';
import type {
  AnomalyStory,
  AnalyticsView,
  DensityCell,
  EventDetail,
  IntelligenceReport,
  PersistentSource,
  WatchtowerDigest,
} from '@/types/intelligence';

// ── Event field accessors ──────────────────────────────────────────────────
// The seeded generator attaches priority/persistence as optional fields on the
// event so list sorting is cheap. These read them with safe fallbacks so a
// future real API response (which may not carry them) still renders.

export function eventPriorityScore(e: ThermalEvent): number {
  const s = (e as ThermalEvent & { priorityScore?: number }).priorityScore;
  if (typeof s === 'number') return s;
  return 0;
}

export function eventActiveDays(e: ThermalEvent): number {
  const d = (e as ThermalEvent & { activeDays?: number }).activeDays;
  if (typeof d === 'number') return d;
  return 1;
}

export function eventPriorityBand(e: ThermalEvent) {
  return priorityBand(eventPriorityScore(e));
}

export function eventClass(e: ThermalEvent): ThermalClass {
  return e.classification?.class ?? 'other';
}

export function eventConfidence(e: ThermalEvent): number {
  return e.classification?.confidence ?? 0;
}

// ── Persistent sources ─────────────────────────────────────────────────────

function toPersistentSource(h: ThermalHotspot): PersistentSource {
  return {
    hotspotId: h.id,
    label: h.facilityName ?? h.wildfireRegionName ?? `${h.district} cluster`,
    kind: h.kind,
    state: h.state,
    district: h.district,
    lng: h.lng,
    lat: h.lat,
    activeDays: h.activeDays,
    detectionCount: h.detectionCount,
    dominantClass: h.dominantClass,
    maxFrp: h.maxFrp,
    avgBrightness: h.avgBrightness,
    priorityScore: h.priorityScore,
    facilityName: h.facilityName,
    facilityType: h.facilityType,
    distanceKm: h.distanceKm,
    firstDate: h.firstDate,
    lastDate: h.lastDate,
  };
}

/** Persistent hotspot ranking — ordered by active days, then detections. */
export function getPersistentSources(limit = 12): PersistentSource[] {
  return getDataset()
    .hotspots.filter((h) => h.detectionCount > 0)
    .slice()
    .sort((a, b) => b.activeDays - a.activeDays || b.detectionCount - a.detectionCount)
    .slice(0, limit)
    .map(toPersistentSource);
}

export function getSourceForEvent(eventId: string): PersistentSource | null {
  const { events, hotspots } = getDataset();
  const event = events.find((e) => e.id === eventId);
  if (!event || event.clusterId === undefined) return null;
  const hotspot = hotspots.find((h) => h.id === event.clusterId);
  return hotspot ? toPersistentSource(hotspot) : null;
}

// ── Anomaly story ──────────────────────────────────────────────────────────

/**
 * Compose a short structured narrative from measured fields.
 *
 * This is deterministic template composition over real numbers, NOT a language
 * model: it can never contradict the badges shown next to it.
 */
export function buildAnomalyStory(event: ThermalEvent, source: PersistentSource | null): AnomalyStory {
  const cls = eventClass(event);
  const clsLabel = CLASS_LABELS[cls].toLowerCase();
  const place =
    [event.enrichment?.admin?.district, event.enrichment?.admin?.state].filter(Boolean).join(', ') ||
    'the region';
  const site = event.enrichment?.nearestIndustrialSite;
  const activeDays = source?.activeDays ?? eventActiveDays(event);
  const frp = event.frp ?? 0;
  const history = getEventHistory(event.id);
  const nightCount = history.filter((h) => {
    const hour = Number(h.acqDatetime.slice(11, 13));
    return hour >= 17 || hour < 6;
  }).length;
  const nightShare = history.length ? nightCount / history.length : 0;

  const sentences: string[] = [];
  const drivers: AnomalyStory['drivers'] = [];
  const caveats: string[] = [];

  sentences.push(
    `A thermal anomaly was detected near ${place} on ${formatDay(event.acqDatetime)}, classified as ${clsLabel} at ${Math.round(
      eventConfidence(event) * 100
    )}% confidence.`
  );

  if (site) {
    const proximity = site.distanceKm <= 1 ? 'inside the perimeter of' : `${site.distanceKm.toFixed(1)} km from`;
    sentences.push(
      `The source sits ${proximity} ${site.name} (${site.type.replace(/_/g, ' ')}), which raises the likelihood of an industrial origin.`
    );
    drivers.push({
      label: 'Nearest facility',
      value: `${site.name} · ${site.distanceKm.toFixed(1)} km`,
      weight: site.distanceKm <= 3 ? 0.34 : 0.14,
    });
  } else {
    sentences.push('No catalogued industrial facility lies within 25 km of the detection.');
    drivers.push({ label: 'Nearest facility', value: 'None within 25 km', weight: -0.16 });
  }

  if (activeDays >= 8) {
    sentences.push(
      `The same source has been observed on ${activeDays} of the last ${WINDOW_DAYS} days, indicating a persistent emitter rather than a one-off event.`
    );
    drivers.push({ label: 'Persistence', value: `${activeDays} / ${WINDOW_DAYS} days`, weight: 0.22 });
  } else if (activeDays > 1) {
    sentences.push(`The source has been observed on ${activeDays} days in the ${WINDOW_DAYS}-day window.`);
    drivers.push({ label: 'Repeat detections', value: `${activeDays} days`, weight: 0.1 });
  } else {
    sentences.push('This is a single detection within the observation window.');
    drivers.push({ label: 'Persistence', value: 'Single detection', weight: -0.12 });
    caveats.push('A single detection is not sufficient to establish a persistent source.');
  }

  if (frp >= 45) {
    sentences.push(`Radiative power peaked at ${frp.toFixed(1)} MW, well above routine process heat.`);
    drivers.push({ label: 'Peak FRP', value: `${frp.toFixed(1)} MW`, weight: 0.24 });
  } else if (frp >= 15) {
    sentences.push(`Radiative power measured ${frp.toFixed(1)} MW.`);
    drivers.push({ label: 'Peak FRP', value: `${frp.toFixed(1)} MW`, weight: 0.13 });
  } else {
    sentences.push(`Radiative power measured ${frp.toFixed(1)} MW — consistent with routine process heat.`);
    drivers.push({ label: 'Peak FRP', value: `${frp.toFixed(1)} MW`, weight: -0.14 });
  }

  if (nightShare >= 0.55) {
    sentences.push(
      `${Math.round(nightShare * 100)}% of detections at this source occur at night, which is characteristic of continuous industrial operation.`
    );
    drivers.push({ label: 'Night activity', value: `${Math.round(nightShare * 100)}%`, weight: 0.11 });
  }

  const landCover = event.enrichment?.landCover;
  if (landCover) {
    drivers.push({ label: 'Land cover', value: landCover, weight: 0 });
    if (landCover === 'forest' || landCover === 'shrubland' || landCover === 'cropland') {
      caveats.push(
        `Land cover is classified as ${landCover}, which is also consistent with vegetation or residue burning.`
      );
    }
  }

  const desc = describeConfidence(eventConfidence(event));
  if (desc.requiresReview) {
    caveats.push('Model confidence is below the review threshold. Treat the classification as provisional.');
  }
  if (event.confidence < 55) {
    caveats.push(`Sensor detection confidence is ${event.confidence}% (low band) — the pixel may be contaminated.`);
  }

  drivers.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));

  const headline =
    cls === 'industrial_fire'
      ? 'Industrial fire signature'
      : cls === 'persistent_thermal_source'
        ? 'Persistent thermal source'
        : cls === 'natural_wildfire'
          ? 'Vegetation fire signature'
          : 'Unclassified thermal anomaly';

  return { headline, sentences, drivers, caveats };
}

// ── Event detail (investigation mode) ──────────────────────────────────────

export function getEventDetail(eventId: string): EventDetail | null {
  const { events } = getDataset();
  const event = events.find((e) => e.id === eventId);
  if (!event) return null;

  const source = getSourceForEvent(eventId);
  const history = getEventHistory(eventId);
  const evidence = getEventEvidence(eventId);
  const conf = eventConfidence(event);

  const breadcrumb = [
    'EARTH',
    'INDIA',
    (event.enrichment?.admin?.state ?? 'UNKNOWN').toUpperCase(),
    (event.enrichment?.admin?.district ?? 'UNKNOWN').toUpperCase(),
  ];

  return {
    event,
    source,
    history,
    evidence,
    priorityBand: eventPriorityBand(event),
    confidenceBand: describeConfidence(conf).band,
    story: buildAnomalyStory(event, source),
    breadcrumb,
  };
}

// ── Regional density (heatmap) ─────────────────────────────────────────────

/**
 * Bin events into a coarse grid. Resolution is chosen per call so the heatmap
 * reads as "activity across India" rather than as individual dots.
 */
export function getRegionalDensity(step = 0.6): DensityCell[] {
  const { events } = getDataset();
  const cells = new Map<string, DensityCell & { frpSum: number; classTally: Map<ThermalClass, number> }>();

  for (const e of events) {
    const [lng, lat] = e.geometry.coordinates as [number, number];
    const keyLng = Math.floor(lng / step);
    const keyLat = Math.floor(lat / step);
    const key = `${keyLng}:${keyLat}`;
    let cell = cells.get(key);
    if (!cell) {
      cell = {
        lng: (keyLng + 0.5) * step,
        lat: (keyLat + 0.5) * step,
        count: 0,
        meanFrp: 0,
        dominantClass: 'other',
        frpSum: 0,
        classTally: new Map(),
      };
      cells.set(key, cell);
    }
    cell.count += 1;
    cell.frpSum += e.frp ?? 0;
    const cls = eventClass(e);
    cell.classTally.set(cls, (cell.classTally.get(cls) ?? 0) + 1);
  }

  return [...cells.values()].map((c) => {
    let dominantClass: ThermalClass = 'other';
    let best = -1;
    for (const [cls, n] of c.classTally) {
      if (n > best) {
        best = n;
        dominantClass = cls;
      }
    }
    return {
      lng: c.lng,
      lat: c.lat,
      count: c.count,
      meanFrp: c.count ? Number((c.frpSum / c.count).toFixed(2)) : 0,
      dominantClass,
    };
  });
}

// ── Watchtower (monitoring digest) ─────────────────────────────────────────

export function getWatchtowerDigest(now = Date.now()): WatchtowerDigest {
  const { events, hotspots } = getDataset();
  const sorted = events.slice().sort((a, b) => (a.acqDatetime < b.acqDatetime ? 1 : -1));

  const newEvents = sorted.slice(0, 12);
  const priorityEvents = events
    .slice()
    .sort((a, b) => eventPriorityScore(b) - eventPriorityScore(a))
    .slice(0, 12);

  const persistentSources = getPersistentSources(8);
  const industrial = events.filter((e) => {
    const c = eventClass(e);
    return c === 'industrial_fire' || c === 'persistent_thermal_source';
  }).length;

  const requiresReview = events.filter((e) => describeConfidence(eventConfidence(e)).requiresReview).length;

  return {
    generatedAt: new Date(now).toISOString(),
    windowDays: WINDOW_DAYS,
    newEvents,
    priorityEvents,
    persistentSources,
    totals: {
      events: events.length,
      sources: hotspots.filter((h) => h.detectionCount > 0).length,
      persistentSources: hotspots.filter((h) => h.activeDays >= 8).length,
      industrial,
      requiresReview,
    },
  };
}

// ── Analytics ──────────────────────────────────────────────────────────────

export function getAnalyticsView(events?: ThermalEvent[]): AnalyticsView {
  const all = events ?? getDataset().events;
  const { hotspots } = getDataset();

  const byClassMap = new Map<ThermalClass, { count: number; confSum: number }>();
  const byPriorityMap = new Map<string, number>();
  const byStateMap = new Map<string, number>();
  const byDayMap = new Map<string, { count: number; industrial: number }>();
  const bySatMap = new Map<string, number>();

  for (const e of all) {
    const cls = eventClass(e);
    const conf = eventConfidence(e);
    const entry = byClassMap.get(cls) ?? { count: 0, confSum: 0 };
    entry.count += 1;
    entry.confSum += conf;
    byClassMap.set(cls, entry);

    const band = eventPriorityBand(e);
    byPriorityMap.set(band, (byPriorityMap.get(band) ?? 0) + 1);

    const state = e.enrichment?.admin?.state ?? 'Unassigned';
    byStateMap.set(state, (byStateMap.get(state) ?? 0) + 1);

    const day = e.acqDatetime.slice(0, 10);
    const dayEntry = byDayMap.get(day) ?? { count: 0, industrial: 0 };
    dayEntry.count += 1;
    if (cls === 'industrial_fire' || cls === 'persistent_thermal_source') dayEntry.industrial += 1;
    byDayMap.set(day, dayEntry);

    bySatMap.set(e.satellite, (bySatMap.get(e.satellite) ?? 0) + 1);
  }

  const total = all.length || 1;
  const dates = all.map((e) => e.acqDatetime).sort();
  const industrial = all.filter((e) => {
    const c = eventClass(e);
    return c === 'industrial_fire' || c === 'persistent_thermal_source';
  }).length;

  return {
    windowDays: WINDOW_DAYS,
    period: { start: dates[0] ?? '', end: dates[dates.length - 1] ?? '' },
    totals: {
      events: all.length,
      sources: hotspots.filter((h) => h.detectionCount > 0).length,
      persistentSources: hotspots.filter((h) => h.activeDays >= 8).length,
      industrialShare: Number(((industrial / total) * 100).toFixed(1)),
      requiresReview: all.filter((e) => describeConfidence(eventConfidence(e)).requiresReview).length,
    },
    byClass: [...byClassMap.entries()]
      .map(([cls, v]) => ({
        class: cls,
        count: v.count,
        avgConfidence: Number((v.confSum / v.count).toFixed(2)),
        share: Number(((v.count / total) * 100).toFixed(1)),
      }))
      .sort((a, b) => b.count - a.count),
    byPriority: (['critical', 'high', 'moderate', 'low'] as const).map((band) => ({
      band,
      count: byPriorityMap.get(band) ?? 0,
    })),
    byState: [...byStateMap.entries()]
      .map(([state, count]) => ({ state, count }))
      .sort((a, b) => b.count - a.count),
    byDay: [...byDayMap.entries()]
      .map(([date, v]) => ({ date, count: v.count, industrial: v.industrial }))
      .sort((a, b) => (a.date < b.date ? -1 : 1)),
    bySatellite: [...bySatMap.entries()]
      .map(([satellite, count]) => ({ satellite, count }))
      .sort((a, b) => b.count - a.count),
    topSources: getPersistentSources(8),
  };
}

// ── Intelligence report ────────────────────────────────────────────────────

export function buildIntelligenceReport(eventId: string): IntelligenceReport | null {
  const detail = getEventDetail(eventId);
  if (!detail) return null;
  const { event, source, evidence, story } = detail;
  const [lng, lat] = event.geometry.coordinates as [number, number];
  const site = event.enrichment?.nearestIndustrialSite;

  return {
    eventId: event.id,
    generatedAt: new Date().toISOString(),
    classification: eventClass(event),
    classificationLabel: CLASS_LABELS[eventClass(event)],
    confidence: eventConfidence(event),
    confidenceBand: describeConfidence(eventConfidence(event)).label,
    priorityBand: detail.priorityBand,
    priorityScore: eventPriorityScore(event),
    location: {
      lat,
      lng,
      state: event.enrichment?.admin?.state,
      district: event.enrichment?.admin?.district,
      breadcrumb: detail.breadcrumb,
    },
    persistence: {
      activeDays: source?.activeDays ?? eventActiveDays(event),
      detectionCount: source?.detectionCount ?? 1,
      windowDays: WINDOW_DAYS,
    },
    thermal: {
      brightness: event.brightness,
      frp: event.frp,
      satellite: event.satellite,
      instrument: event.instrument,
      daynight: event.daynight === 'N' ? 'Night' : 'Day',
    },
    nearestFacility: site
      ? { name: site.name, type: site.type, distanceKm: site.distanceKm, bearingDeg: site.bearingDeg }
      : undefined,
    keyEvidence: (evidence?.positiveFactors ?? []).map((f) => ({
      factor: f.factor,
      weight: f.weight,
      detail: f.detail,
      source: f.source,
    })),
    caveats: story.caveats,
    provenance: {
      dataType: DATA_PROVENANCE.dataType,
      primarySource: DATA_PROVENANCE.primarySource,
      satellites: DATA_PROVENANCE.satellites,
      modelVersion: DATA_PROVENANCE.modelVersion,
      industrialContext: DATA_PROVENANCE.industrialContext,
    },
  };
}

// ── Filtering + search ─────────────────────────────────────────────────────

export interface ExplorerFilters extends EventFilters {
  classes?: ThermalClass[];
  states?: string[];
  bands?: Array<'critical' | 'high' | 'moderate' | 'low'>;
  /**
   * Minimum classification confidence, **as a percentage (0–100)**. The
   * navigator slider and the API both work in percent; `eventConfidence`
   * returns a 0–1 fraction. The conversion happens once, here.
   */
  minConfidence?: number;
  minPersistence?: number;
  query?: string;
  sort?: 'recent' | 'priority' | 'intensity' | 'persistence';
}

/**
 * Free-text search across event id, district, state, facility and source id.
 * Case- and punctuation-insensitive: "evt-10482", "EVT_10482" and "10482" all
 * find the same event.
 */
export function matchesQuery(e: ThermalEvent, raw: string): boolean {
  const q = raw.trim().toLowerCase();
  if (!q) return true;
  const digits = q.replace(/\D/g, '');
  const haystack = [
    e.id,
    e.id.replace(/\D/g, ''),
    e.enrichment?.admin?.state ?? '',
    e.enrichment?.admin?.district ?? '',
    e.enrichment?.nearestIndustrialSite?.name ?? '',
    e.satellite,
    eventClass(e).replace(/_/g, ' '),
  ]
    .join(' ')
    .toLowerCase();

  if (digits.length >= 3 && haystack.includes(digits)) return true;
  return haystack.includes(q);
}

export function applyExplorerFilters(events: ThermalEvent[], f: ExplorerFilters): ThermalEvent[] {
  const out = events.filter((e) => {
    if (f.classes?.length && !f.classes.includes(eventClass(e))) return false;
    if (f.states?.length && !f.states.includes(e.enrichment?.admin?.state ?? '')) return false;
    if (f.bands?.length && !f.bands.includes(eventPriorityBand(e))) return false;
    // minConfidence is a percentage; eventConfidence is a 0..1 fraction.
    if (f.minConfidence !== undefined && eventConfidence(e) * 100 < f.minConfidence) return false;
    if (f.minPersistence !== undefined && eventActiveDays(e) < f.minPersistence) return false;
    if (f.startDate && e.acqDatetime < f.startDate) return false;
    if (f.endDate && e.acqDatetime > f.endDate) return false;
    if (f.query && !matchesQuery(e, f.query)) return false;
    return true;
  });

  switch (f.sort) {
    case 'priority':
      return out.sort((a, b) => eventPriorityScore(b) - eventPriorityScore(a));
    case 'intensity':
      return out.sort((a, b) => (b.frp ?? 0) - (a.frp ?? 0) || b.brightness - a.brightness);
    case 'persistence':
      return out.sort((a, b) => eventActiveDays(b) - eventActiveDays(a));
    case 'recent':
    default:
      return out.sort((a, b) => (a.acqDatetime < b.acqDatetime ? 1 : -1));
  }
}

// ── Formatting helpers ─────────────────────────────────────────────────────

function formatDay(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** Human-readable relative age against the fixed demo reference date. */
export function relativeAge(iso: string, referenceIso: string): string {
  const diffMin = Math.max(0, Math.round((new Date(referenceIso).getTime() - new Date(iso).getTime()) / 60000));
  if (diffMin < 60) return `${diffMin}m ago`;
  const h = Math.round(diffMin / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}
