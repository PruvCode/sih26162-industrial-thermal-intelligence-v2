/**
 * Derived intelligence types.
 *
 * These are *views* over `ThermalEvent[]`, never independent data. Everything
 * in here is computed by `src/data/derive.ts` from the one seeded dataset, so
 * the map, the analytics, the story and the report can never disagree with
 * each other — the exact failure the previous build had when it showed ten
 * dots under a headline claiming 12,543 events.
 */

import type {
  ThermalEvent,
  ThermalClass,
  Evidence,
  HistoricalObservation,
  PriorityBand,
  EventFilters,
} from './event';

/** A persistent thermal source, ranked. Powers the hotspot ranking feature. */
export interface PersistentSource {
  hotspotId: number;
  label: string;
  kind: 'industrial' | 'wildfire' | 'residue';
  state: string;
  district: string;
  lng: number;
  lat: number;
  activeDays: number;
  detectionCount: number;
  dominantClass: ThermalClass;
  maxFrp: number;
  avgBrightness: number;
  priorityScore: number;
  facilityName?: string;
  facilityType?: string;
  distanceKm?: number;
  firstDate: string;
  lastDate: string;
}

/** Everything the investigation panel needs about one event. */
export interface EventDetail {
  event: ThermalEvent;
  /** The persistent source this detection belongs to, if any. */
  source: PersistentSource | null;
  history: HistoricalObservation[];
  evidence: Evidence | null;
  priorityBand: PriorityBand;
  confidenceBand: 'high' | 'moderate' | 'uncertain';
  story: AnomalyStory;
  breadcrumb: string[];
}

/**
 * A concise structured narrative generated from structured fields. This is
 * template composition over measured values — not a chat model.
 */
export interface AnomalyStory {
  headline: string;
  sentences: string[];
  /** Ordered, most significant first. */
  drivers: Array<{ label: string; value: string; weight: number }>;
  caveats: string[];
}

/** Regional density cell for the thermal heatmap. */
export interface DensityCell {
  lng: number;
  lat: number;
  count: number;
  /** Mean fire radiative power in MW across the cell. */
  meanFrp: number;
  dominantClass: ThermalClass;
}

/** Watchtower digest — the monitoring view (new / priority / persistent). */
export interface WatchtowerDigest {
  generatedAt: string;
  windowDays: number;
  newEvents: ThermalEvent[];
  priorityEvents: ThermalEvent[];
  persistentSources: PersistentSource[];
  totals: {
    events: number;
    sources: number;
    persistentSources: number;
    industrial: number;
    requiresReview: number;
  };
}

/** Structured intelligence summary ready for export. */
export interface IntelligenceReport {
  eventId: string;
  generatedAt: string;
  classification: ThermalClass;
  classificationLabel: string;
  confidence: number;
  confidenceBand: string;
  priorityBand: PriorityBand;
  priorityScore: number;
  location: {
    lat: number;
    lng: number;
    state?: string;
    district?: string;
    breadcrumb: string[];
  };
  persistence: { activeDays: number; detectionCount: number; windowDays: number };
  thermal: { brightness: number; frp?: number; satellite: string; instrument: string; daynight: string };
  nearestFacility?: { name: string; type: string; distanceKm: number; bearingDeg?: number };
  keyEvidence: Array<{ factor: string; weight: number; detail: string; source: string }>;
  caveats: string[];
  provenance: {
    dataType: string;
    primarySource: string;
    satellites: string;
    modelVersion: string;
    industrialContext: string;
  };
}

/** Full analytics view derived from one dataset. */
export interface AnalyticsView {
  windowDays: number;
  period: { start: string; end: string };
  totals: {
    events: number;
    sources: number;
    persistentSources: number;
    industrialShare: number;
    requiresReview: number;
  };
  byClass: Array<{ class: ThermalClass; count: number; avgConfidence: number; share: number }>;
  byPriority: Array<{ band: PriorityBand; count: number }>;
  byState: Array<{ state: string; count: number }>;
  byDay: Array<{ date: string; count: number; industrial: number }>;
  bySatellite: Array<{ satellite: string; count: number }>;
  topSources: PersistentSource[];
}

export type { EventFilters };
