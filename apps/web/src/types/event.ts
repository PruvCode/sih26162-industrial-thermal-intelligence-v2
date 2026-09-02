/** Composite priority band. Deliberately separate from `ThermalClass`: class is
 *  "what is it", priority is "how much should anyone care". */
export type PriorityBand = 'critical' | 'high' | 'moderate' | 'low';

export interface ThermalEvent {
  id: string;
  geometry: GeoJSON.Point;
  brightness: number;
  brightT31?: number;
  scan?: number;
  track?: number;
  frp?: number;
  acqDatetime: string;
  satellite: string;
  instrument: string;
  confidence: number;
  daynight: 'D' | 'N';
  source: string;
  clusterId?: number;
  classification?: Classification;
  enrichment?: EventEnrichment;
  /** 0..100 composite of persistence + industrial proximity + intensity + context. */
  priorityScore?: number;
  priorityBand?: PriorityBand;
  /** Distinct days this source was seen within the observation window. */
  activeDays?: number;
  /** Total detections at this source within the observation window. */
  detectionCount?: number;
}

export interface Classification {
  class: ThermalClass;
  confidence: number;
  allProbabilities: Record<ThermalClass, number>;
  modelVersion: string;
  evidence?: Evidence;
  createdAt: string;
}

export type ThermalClass =
  | 'industrial_fire'
  | 'persistent_thermal_source'
  | 'natural_wildfire'
  | 'other';

export interface EventEnrichment {
  nearestIndustrialSite?: {
    id: number;
    name: string;
    type: string;
    distanceKm: number;
    bearingDeg: number;
  };
  landCover?: string;
  admin?: {
    state?: string;
    district?: string;
  };
  populationDensity?: number;
}

export interface Evidence {
  positiveFactors: Array<{
    factor: string;
    weight: number;
    detail: string;
    source: string;
  }>;
  negativeFactors: Array<{
    factor: string;
    weight: number;
    detail: string;
    source: string;
  }>;
  shapSummary: {
    topFeatures: Array<{
      feature: string;
      shapValue: number;
    }>;
  };
}

export interface EventFeatures {
  eventId: string;
  features: Record<string, number | string | boolean>;
  shapValues?: Record<string, Record<string, number>>;
  featureVersion: string;
  computedAt: string;
}

export interface IndustrialSite {
  id: number;
  geometry: GeoJSON.Polygon | GeoJSON.Point;
  name: string;
  industrialType: string;
  osmId?: string;
  tags: Record<string, string>;
  verified: boolean;
}

export interface HistoricalObservation {
  eventId: string;
  acqDatetime: string;
  geometry: GeoJSON.Point;
  brightness: number;
  confidence: number;
  frp?: number;
  satellite: string;
}

export interface PersistenceCluster {
  id: number;
  centroid: GeoJSON.Point;
  geom: GeoJSON.Polygon;
  detectionCount: number;
  uniqueDates: number;
  temporalSpanDays: number;
  brightnessTrend?: number;
  regularityScore?: number;
  dominantClass?: ThermalClass;
  associatedSiteId?: number;
  siteName?: string;
  siteType?: string;
  siteDistanceM?: number;
}

export interface EventGeoJSON extends GeoJSON.FeatureCollection {
  features: EventGeoJSONFeature[];
}

export interface EventGeoJSONFeature extends GeoJSON.Feature {
  geometry: GeoJSON.Point;
  properties: {
    id: string;
    brightness: number;
    confidence: number;
    acqDatetime: string;
    satellite: string;
    class?: ThermalClass;
    classConfidence?: number;
    clusterId?: number;
    [key: string]: unknown;
  };
}

export interface IndustrialGeoJSON extends GeoJSON.FeatureCollection {
  features: IndustrialGeoJSONFeature[];
}

export interface IndustrialGeoJSONFeature extends GeoJSON.Feature {
  properties: {
    id: number;
    name: string;
    industrialType: string;
    color: string;
    [key: string]: unknown;
  };
}

export interface EventFilters {
  bbox?: [number, number, number, number];
  classes?: ThermalClass[];
  confidenceMin?: number;
  startDate?: string;
  endDate?: string;
  source?: string;
  limit?: number;
  offset?: number;
  // ── Investigation filters used by the operational UI ────────────────────
  states?: string[];
  priorityBands?: PriorityBand[];
  /** Minimum distinct active days at the source. */
  minPersistence?: number;
  /** Free-text match on event id, district, state or facility name. */
  query?: string;
  sort?: 'recent' | 'priority' | 'intensity' | 'persistence';
}

export interface AnalyticsSummary {
  period: { start: string; end: string };
  totals: { events: number; classified: number; unclassified: number };
  byClass: Array<{ class: ThermalClass; count: number; avgConfidence: number }>;
  bySource: Array<{ source: string; count: number }>;
  byDay: Array<{ date: string; count: number }>;
  topClusters: Array<{
    clusterId: number;
    detectionCount: number;
    centroid: [number, number];
    dominantClass: ThermalClass;
  }>;
}

export interface Pagination {
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
}
