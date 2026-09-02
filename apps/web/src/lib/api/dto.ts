/**
 * WIRE FORMAT — exactly what the FastAPI backend puts on the wire today.
 *
 * These types are intentionally `snake_case` and intentionally nullable: they
 * mirror `apps/api/app/schemas/*.py` field for field. Do not "clean them up" to
 * look like the domain models — the moment they stop matching the server, they
 * stop being useful, and silent `undefined`s start spreading through the UI.
 *
 * Translation to the domain models happens in `mappers.ts`, never here.
 */

/* ── Events ───────────────────────────────────────────────────────────── */

export interface BackendThermalEvent {
  id: string;
  latitude: number;
  longitude: number;
  frp: number | null;
  brightness: number | null;
  scan: number | null;
  track: number | null;
  satellite: string | null;
  instrument: string | null;
  /** Categorical today ("low" | "medium" | "high"). See mappers for the numeric bridge. */
  confidence: string | null;
  daynight: string | null;
  version: string | null;
  acq_date: string | null;
  /** FIRMS time as "HHMM". */
  acq_time: string | null;
  source_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface BackendThermalEventList {
  items: BackendThermalEvent[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

/* ── Evidence ─────────────────────────────────────────────────────────── */

export interface BackendEvidenceComponent {
  component_type: string;
  label: string;
  description: string;
  value: number | null;
  unit: string | null;
  /** 0..1 contribution to the final classification. */
  weight: number;
}

export interface BackendNearbySiteInfo {
  site_id: string;
  name: string;
  industry_type: string;
  distance_km: number;
  risk_level: string;
}

export interface BackendEvidenceResponse {
  event_id: string;
  classification_label: string;
  classification_confidence: number;
  components: BackendEvidenceComponent[];
  nearby_sites: BackendNearbySiteInfo[];
  reasoning_summary: string;
  generated_at: string;
}

/* ── Classification (ML boundary) ─────────────────────────────────────── */

export interface BackendClassificationResponse {
  id: string;
  event_id: string;
  label: string;
  /** 0..1 */
  confidence: number;
  model_version: string | null;
  explanation: string | null;
  features_used: string | null;
  evidence_summary: string | null;
  classified_at: string;
  created_at: string;
}

/* ── Analytics ────────────────────────────────────────────────────────── */

export interface BackendCategoryBreakdown {
  category: string;
  count: number;
  percentage: number;
}

export interface BackendTimeSeriesPoint {
  date: string;
  count: number;
  avg_frp: number | null;
}

export interface BackendTimeSeriesData {
  points: BackendTimeSeriesPoint[];
  interval: string;
}

export interface BackendAnalyticsSummary {
  total_events: number;
  total_sites: number;
  high_risk_events: number;
  avg_frp: number | null;
  max_frp: number | null;
  events_last_24h: number;
  events_last_7d: number;
  classification_breakdown: BackendCategoryBreakdown[];
  time_series: BackendTimeSeriesData;
  top_hotspots: Array<Record<string, unknown>>;
}

/* ── Health ───────────────────────────────────────────────────────────── */

export interface BackendHealth {
  status: string;
  service: string;
  version: string;
}

/* ── Persistent sources ──────────────────────────────────────────────── */

export interface BackendPersistentSource {
  hotspot_id: number;
  label: string;
  kind: 'industrial' | 'wildfire' | 'residue';
  state: string;
  district: string;
  lat: number;
  lon: number;
  active_days: number;
  detection_count: number;
  dominant_class: string;
  max_frp: number | null;
  avg_brightness: number | null;
  priority_score: number;
  facility_name: string | null;
  facility_type: string | null;
  distance_km: number | null;
  first_date: string | null;
  last_date: string | null;
}

export interface BackendPersistentSourcesResponse {
  window_days: number;
  generated_at: string;
  sources: BackendPersistentSource[];
}

/* ── Density heatmap ─────────────────────────────────────────────────── */

export interface BackendDensityCell {
  lat: number;
  lon: number;
  count: number;
  mean_frp: number | null;
  dominant_class: string;
}

export interface BackendDensityResponse {
  bbox: number[];
  cell_size_deg: number;
  cells: BackendDensityCell[];
  generated_at: string;
}

/* ── Watchtower digest ───────────────────────────────────────────────── */
// NOTE: server-side watchtower is *count-based* (new/priority/requires-review
// counts + class/region breakdowns). The UI's WatchtowerDigest also carries
// event/source ARRAYS; those are left empty here — see api.ts for the gap note.

export interface BackendWatchtower {
  generated_at: string;
  window_days: number;
  new_events: number;
  priority_events: number;
  requires_review: number;
  persistent_sources: number;
  by_class: Array<{ category: string; count: number; percentage: number }>;
  top_regions: Array<{ state: string; count: number }>;
}

/* ── Event report ────────────────────────────────────────────────────── */

export interface BackendEventReport {
  event_id: string;
  generated_at: string;
  classification: string;
  classification_label: string;
  confidence: number;
  confidence_band: string;
  priority_band: string;
  priority_score: number;
  location: Record<string, unknown>;
  persistence: Record<string, unknown>;
  thermal: Record<string, unknown>;
  nearest_facility: Record<string, unknown> | null;
  key_evidence: Array<Record<string, unknown>>;
  caveats: string[];
  provenance: Record<string, unknown>;
}
