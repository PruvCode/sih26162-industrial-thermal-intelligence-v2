/**
 * WIRE → DOMAIN MAPPERS.
 *
 * The backend speaks FIRMS vocabulary (satellite codes, categorical confidence,
 * separate date and time columns). The UI speaks the product vocabulary
 * (display names, 0..1 confidence, one ISO instant).
 *
 * This translation lives here and nowhere else, so a backend field rename is a
 * one-file change instead of a hunt through twenty components. Every mapper is
 * total: given a backend object it always returns a renderable domain object,
 * never `undefined`, because a missing field must degrade to a blank cell —
 * not crash a page.
 */

import type { Evidence, HistoricalObservation, ThermalClass, ThermalEvent } from '@/types/event';
import type {
  DensityCell,
  IntelligenceReport,
  PersistentSource,
  WatchtowerDigest,
} from '@/types/intelligence';
import type {
  BackendDensityCell,
  BackendDensityResponse,
  BackendEventReport,
  BackendPersistentSource,
  BackendPersistentSourcesResponse,
  BackendWatchtower,
  BackendEvidenceResponse,
  BackendThermalEvent,
} from './dto';

/**
 * FIRMS identifies satellites by a one-character code. The UI has always shown
 * the full name, so map rather than leak the code into the Analytics chart.
 */
const SATELLITE_NAMES: Record<string, string> = {
  N: 'Suomi-NPP',
  N20: 'NOAA-20',
  NOAA20: 'NOAA-20',
  'NOAA-20': 'NOAA-20',
  'NOAA 20': 'NOAA-20',
  A: 'Aqua',
  T: 'Terra',
};

export function satelliteName(raw: string | null | undefined): string {
  if (!raw) return 'Unknown';
  const trimmed = raw.trim();
  return SATELLITE_NAMES[trimmed] ?? SATELLITE_NAMES[trimmed.toUpperCase()] ?? trimmed;
}

/**
 * Confidence arrives as a category from FIRMS and as a 0..1 score from the ML
 * model. The UI needs a number. Both are accepted so the backend can tighten
 * its contract to numeric later without a frontend change.
 */
const CONFIDENCE_SCORES: Record<string, number> = {
  high: 0.9,
  h: 0.9,
  medium: 0.6,
  nominal: 0.6,
  m: 0.6,
  low: 0.3,
  l: 0.3,
};

export function confidenceToNumber(raw: string | number | null | undefined): number {
  if (raw === null || raw === undefined || raw === '') return 0;
  if (typeof raw === 'number') return Math.min(1, Math.max(0, raw));

  const numeric = Number(raw);
  if (!Number.isNaN(numeric)) return Math.min(1, Math.max(0, numeric));

  return CONFIDENCE_SCORES[raw.trim().toLowerCase()] ?? 0.5;
}

/**
 * FIRMS splits the observation into `acq_date` and `acq_time` ("HHMM"), both in
 * UTC. The domain model has a single `acqDatetime`.
 *
 * The calendar date is taken from the string and recombined with `Date.UTC`,
 * deliberately NOT via `new Date(date)`. `new Date('2026-08-30')` parses as
 * *local* midnight, so on any machine east of UTC the instant lands on the
 * previous day — an off-by-one that silently mis-files every detection. This
 * function returns the same instant regardless of the viewer's timezone.
 */
export function acqToIso(date: string | null | undefined, time: string | null | undefined): string {
  if (!date) return new Date(0).toISOString();

  const parts = /^(\d{4})-(\d{2})-(\d{2})/.exec(date.trim());
  if (!parts) {
    // Not a date-like string. Fall back to Date's own parsing so an ISO
    // instant from a future backend version still works.
    const parsed = new Date(date);
    return Number.isNaN(parsed.getTime()) ? new Date(0).toISOString() : parsed.toISOString();
  }

  const [, year, month, day] = parts;
  const raw = (time ?? '').trim();
  const padded = /^\d{3,4}$/.test(raw) ? raw.padStart(4, '0') : '0000';
  const hours = Number(padded.slice(0, 2));
  const minutes = Number(padded.slice(2, 4));

  return new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day), hours, minutes, 0, 0)
  ).toISOString();
}

/**
 * Backend label → domain class.
 *
 * Returns `undefined` for anything unrecognised rather than forcing 'other',
 * because "the model has not classified this yet" and "the model classified
 * this as other" are different statements and the UI renders them differently.
 */
export function mapClassLabel(label: string | null | undefined): ThermalClass | undefined {
  if (!label) return undefined;
  const normalised = label.trim().toLowerCase().replace(/[\s-]+/g, '_');
  const valid: ThermalClass[] = ['industrial_fire', 'persistent_thermal_source', 'natural_wildfire', 'other'];
  return valid.includes(normalised as ThermalClass) ? (normalised as ThermalClass) : undefined;
}

export function mapThermalEvent(dto: BackendThermalEvent): ThermalEvent {
  const satellite = satelliteName(dto.satellite);
  const instrument = dto.instrument?.trim() || 'Unknown';

  return {
    id: dto.id,
    // GeoJSON is [lng, lat]. Reversing this pair is the single most common bug
    // in geospatial work, so it is stated explicitly.
    geometry: { type: 'Point', coordinates: [dto.longitude, dto.latitude] },
    brightness: dto.brightness ?? 0,
    scan: dto.scan ?? undefined,
    track: dto.track ?? undefined,
    frp: dto.frp ?? undefined,
    acqDatetime: acqToIso(dto.acq_date, dto.acq_time),
    satellite,
    instrument,
    confidence: confidenceToNumber(dto.confidence),
    daynight: dto.daynight === 'D' ? 'D' : 'N',
    // The backend has no product/source column yet; compose one from the
    // instrument so the bySource breakdown stays populated. Replace with a real
    // `source` column when the ingestion pipeline lands.
    source: `${instrument.toUpperCase()}_${satellite.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_NRT`,
  };
}

export function mapThermalEvents(items: BackendThermalEvent[]): ThermalEvent[] {
  return items.map(mapThermalEvent);
}

/**
 * Backend evidence → domain evidence.
 *
 * The backend returns one flat `components` list with signed weights. The UI
 * splits them into supporting and contradicting factors and needs a
 * SHAP-ordered feature list for the explanation chart.
 */
export function mapEvidence(dto: BackendEvidenceResponse): Evidence {
  const toFactor = (c: BackendEvidenceResponse['components'][number]) => ({
    factor: c.label,
    weight: c.weight,
    detail: c.description,
    source: c.component_type,
  });

  const components = dto.components ?? [];

  return {
    positiveFactors: components.filter((c) => c.weight >= 0).map(toFactor),
    negativeFactors: components.filter((c) => c.weight < 0).map(toFactor),
    shapSummary: {
      topFeatures: [...components]
        .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
        .slice(0, 8)
        .map((c) => ({ feature: c.label, shapValue: c.weight })),
    },
  };
}

/**
 * Historical observations.
 *
 * `GET /events/{id}/history` is typed `list[dict]` on the backend, so this
 * cannot assume a fixed schema yet. It reads the fields a FIRMS-style row
 * always has and falls back to the parent event's id, so the timeline renders
 * even against a partially-shaped response.
 */
export function mapHistory(raw: unknown, eventId: string): HistoricalObservation[] {
  if (!Array.isArray(raw)) return [];

  return raw.map((item) => {
    const row = (item ?? {}) as Partial<BackendThermalEvent> & { event_id?: string };
    return {
      eventId: row.event_id ?? row.id ?? eventId,
      acqDatetime: acqToIso(row.acq_date, row.acq_time),
      geometry: { type: 'Point', coordinates: [row.longitude ?? 0, row.latitude ?? 0] },
      brightness: row.brightness ?? 0,
      confidence: confidenceToNumber(row.confidence),
      frp: row.frp ?? undefined,
      satellite: satelliteName(row.satellite),
    };
  });
}

/* ── Intelligence endpoints (persistent sources / density / watchtower / report) ── */

export function mapPersistentSource(dto: BackendPersistentSource): PersistentSource {
  return {
    hotspotId: dto.hotspot_id,
    label: dto.label,
    kind: dto.kind,
    state: dto.state,
    district: dto.district,
    // GeoJSON is [lng, lat] — same reversal rule as mapThermalEvent.
    lng: dto.lon,
    lat: dto.lat,
    activeDays: dto.active_days,
    detectionCount: dto.detection_count,
    dominantClass: mapClassLabel(dto.dominant_class) ?? 'other',
    maxFrp: dto.max_frp ?? 0,
    avgBrightness: dto.avg_brightness ?? 0,
    priorityScore: dto.priority_score,
    facilityName: dto.facility_name ?? undefined,
    facilityType: dto.facility_type ?? undefined,
    distanceKm: dto.distance_km ?? undefined,
    firstDate: dto.first_date ?? '',
    lastDate: dto.last_date ?? '',
  };
}

export function mapPersistentSources(dto: BackendPersistentSourcesResponse): PersistentSource[] {
  return dto.sources.map(mapPersistentSource);
}

export function mapDensityCell(dto: BackendDensityCell): DensityCell {
  return {
    lng: dto.lon,
    lat: dto.lat,
    count: dto.count,
    meanFrp: dto.mean_frp ?? 0,
    dominantClass: mapClassLabel(dto.dominant_class) ?? 'other',
  };
}

export function mapDensity(dto: BackendDensityResponse): DensityCell[] {
  return dto.cells.map(mapDensityCell);
}

/**
 * Backend watchtower is count-based; the UI's WatchtowerDigest also carries
 * event/source ARRAYS. We fill `totals` from the counts and leave the lists
 * empty. This is a known contract gap (tracked in docs/api/API_CONTRACT.md):
 * the server returns aggregates, not the underlying event objects, so the
 * "new events" / "priority events" / "ranked sources" lists are not yet
 * populated by the live provider.
 */
export function mapWatchtower(dto: BackendWatchtower): WatchtowerDigest {
  return {
    generatedAt: dto.generated_at,
    windowDays: dto.window_days,
    newEvents: [],
    priorityEvents: [],
    persistentSources: [],
    totals: {
      events: dto.new_events,
      sources: 0,
      persistentSources: dto.persistent_sources,
      industrial: 0,
      requiresReview: dto.requires_review,
    },
  };
}

export function mapEventReport(dto: BackendEventReport): IntelligenceReport {
  const loc = dto.location as Record<string, unknown>;
  const per = dto.persistence as Record<string, unknown>;
  const th = dto.thermal as Record<string, unknown>;
  const fac = dto.nearest_facility as Record<string, unknown> | null;
  const prov = dto.provenance as Record<string, unknown>;

  return {
    eventId: dto.event_id,
    generatedAt: dto.generated_at,
    classification: mapClassLabel(dto.classification) ?? 'other',
    classificationLabel: dto.classification_label,
    confidence: dto.confidence,
    confidenceBand: dto.confidence_band,
    priorityBand: dto.priority_band as IntelligenceReport['priorityBand'],
    priorityScore: dto.priority_score,
    location: {
      lat: Number(loc.lat ?? 0),
      lng: Number(loc.lng ?? 0),
      state: (loc.state as string) ?? undefined,
      district: (loc.district as string) ?? undefined,
      breadcrumb: Array.isArray(loc.breadcrumb) ? (loc.breadcrumb as string[]) : [],
    },
    persistence: {
      activeDays: Number(per.active_days ?? 0),
      detectionCount: Number(per.detection_count ?? 0),
      windowDays: Number(per.window_days ?? 0),
    },
    thermal: {
      brightness: Number(th.brightness ?? 0),
      frp: typeof th.frp === 'number' ? th.frp : undefined,
      satellite: String(th.satellite ?? 'unknown'),
      instrument: String(th.instrument ?? 'unknown'),
      daynight: String(th.daynight ?? 'unknown'),
    },
    nearestFacility: fac
      ? {
          name: String(fac.name ?? ''),
          type: String(fac.type ?? ''),
          distanceKm: Number(fac.distance_km ?? 0),
        }
      : undefined,
    keyEvidence: (dto.key_evidence ?? []).map((k) => ({
      factor: String(k.factor ?? ''),
      weight: Number(k.weight ?? 0),
      detail: String(k.detail ?? ''),
      source: String(k.source ?? ''),
    })),
    caveats: dto.caveats ?? [],
    provenance: {
      dataType: String(prov.data_type ?? ''),
      primarySource: String(prov.primary_source ?? ''),
      satellites: String(prov.satellites ?? ''),
      modelVersion: String(prov.model_version ?? ''),
      industrialContext: String(prov.industrial_context ?? ''),
    },
  };
}
