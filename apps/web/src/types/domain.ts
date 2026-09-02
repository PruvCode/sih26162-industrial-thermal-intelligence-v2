/**
 * CANONICAL DOMAIN MODELS.
 *
 * The app already had two type modules and they stay the source of truth:
 *   - `types/event.ts`        — the detection/event envelope + GeoJSON shapes
 *   - `types/intelligence.ts` — derived views (persistent sources, watchtower, analytics)
 *
 * This module does two things and nothing more:
 *   1. Adds the models the backend contract needs that were previously
 *      implicit (Location, Confidence, the detection/observation split,
 *      WatchtowerItem, Page<T>).
 *   2. Re-exports the existing models under the names the API contract uses.
 *
 * Nothing here duplicates a field. Where a concept already existed it is
 * aliased, not redefined — two definitions of "priority" is exactly how a
 * frontend and a backend drift apart.
 */

import type {
  ThermalEvent,
  ThermalClass,
  Classification,
  Evidence,
  IndustrialSite,
  HistoricalObservation,
  PriorityBand,
  AnalyticsSummary,
} from './event';
import type {
  PersistentSource,
  WatchtowerDigest,
  IntelligenceReport,
  EventDetail,
  AnalyticsView,
  DensityCell,
} from './intelligence';

/* ── Geometry ─────────────────────────────────────────────────────────── */

/** WGS84 coordinate pair. */
export interface Location {
  lat: number;
  lng: number;
}

/**
 * `[west, south, east, north]` — the order MapLibre, GeoJSON and the API's
 * `bbox` query parameter all use. Every bounding box in the codebase must be
 * this order; a silent lng/lat swap is the classic geospatial bug.
 */
export type BoundingBox = [number, number, number, number];

/* ── Confidence & priority ────────────────────────────────────────────── */

/**
 * Human-readable confidence band. The satellite product gives a categorical
 * confidence (low/medium/high); the ML model gives a 0..1 score. Both collapse
 * to these three bands so the UI has one thing to render.
 */
export type ConfidenceBand = 'high' | 'moderate' | 'uncertain';

export interface Confidence {
  /** 0..1. */
  value: number;
  band: ConfidenceBand;
}

/* ── Detection layer ──────────────────────────────────────────────────── */

/**
 * One satellite detection — a single pixel observation as delivered by FIRMS,
 * before any classification, enrichment or prioritisation.
 *
 * This is the raw row. `ThermalEvent` (in types/event.ts) is what the UI
 * consumes: a detection *plus* classification, facility enrichment, persistence
 * and priority. Keeping the two separate is what lets the backend store raw
 * detections and derive events without the frontend knowing the difference.
 */
export interface ThermalDetection {
  id: string;
  /** ISO-8601. */
  detectedAt: string;
  location: Location;
  /** Brightness temperature in Kelvin. */
  brightness: number;
  /** Channel T31 brightness in Kelvin. */
  brightT31?: number;
  /** Fire Radiative Power in MW. */
  frp?: number;
  scan?: number;
  track?: number;
  satellite: string;
  instrument: string;
  /** 0..1 */
  confidence: number;
  daynight: 'D' | 'N';
  /** Data source identifier, e.g. `VIIRS_SNPP_NRT`. */
  source: string;
}

/** A repeat observation of the same source. */
export interface SatelliteObservation {
  id: string;
  /** ISO-8601. */
  detectedAt: string;
  location: Location;
  brightness: number;
  frp?: number;
  confidence: number;
  satellite: string;
  instrument: string;
}

/** All observations of one persistent source inside the analysis window. */
export interface DetectionHistory {
  sourceId: string;
  windowDays: number;
  /** Distinct calendar days the source was seen. */
  activeDays: number;
  detectionCount: number;
  observations: SatelliteObservation[];
}

/* ── Facility ─────────────────────────────────────────────────────────── */

/**
 * An industrial facility. `IndustrialSite` in types/event.ts is the GIS-shaped
 * record (GeoJSON geometry, OSM tags); this is the flat contract the API speaks.
 */
export interface Facility {
  id: string;
  name: string;
  type: string;
  location: Location;
  state?: string;
  district?: string;
  industrialCategory?: string;
  verified?: boolean;
}

/* ── Watchtower ───────────────────────────────────────────────────────── */

/** One row of the monitoring digest. */
export interface WatchtowerItem {
  id: string;
  kind: 'new' | 'priority' | 'persistent';
  label: string;
  priorityBand: PriorityBand;
  /** ISO-8601 — the newest activity for this item. */
  detectedAt: string;
  eventId?: string;
  sourceId?: string;
  state?: string;
  district?: string;
}

/* ── Pagination ───────────────────────────────────────────────────────── */

/**
 * Offset pagination envelope. Matches the FastAPI `ThermalEventList` response
 * (`items`/`total`/`page`/`page_size`/`pages`) with the size field renamed to
 * camelCase by the mapper.
 */
export interface Page<T> {
  items: T[];
  total: number;
  /** 1-based. */
  page: number;
  pageSize: number;
  pages: number;
}

/* ── ML integration boundary ──────────────────────────────────────────── */

/**
 * The ONLY shape the backend and frontend agree on with the ML system.
 *
 * The ML team can change model architecture, framework or feature set freely.
 * As long as they return this, nothing else in the stack changes. `modelVersion`
 * is mandatory — without it a bad model rollout is untraceable.
 */
export interface MlClassificationResult {
  classification: ThermalClass;
  /** 0..1 */
  confidence: number;
  modelVersion: string;
  /** ISO-8601 — when inference ran, not when the satellite observed. */
  inferenceTimestamp: string;
  /** Per-class probabilities, for the evidence panel. */
  allProbabilities?: Record<ThermalClass, number>;
}

/* ── Aliases: one vocabulary, zero duplicated fields ──────────────────── */

export type { ThermalEvent, ThermalClass, Classification, Evidence, IndustrialSite, PriorityBand, AnalyticsSummary, HistoricalObservation };
export type { PersistentSource, WatchtowerDigest, IntelligenceReport, EventDetail, AnalyticsView, DensityCell };

/** An enriched detection — what the UI actually renders. */
export type Event = ThermalEvent;

/** The exportable investigation report. */
export type InvestigationReport = IntelligenceReport;
