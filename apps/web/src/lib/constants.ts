/**
 * Application constants.
 *
 * The cinematic phase map below is the SINGLE shared definition consumed by
 * the scroll hook, the hero UI, the globe camera and the observation overlay.
 * Duplicating those boundaries across four files is what previously let the
 * headline, the camera and the breadcrumb tell three different stories about
 * where in the journey the user actually was.
 */

import type { ThermalClass } from '@/types/event';
import { INDIA_OUTLINE } from '@/lib/adapters/geojson';

export const APP_NAME = 'SIH26162';
export const APP_TAGLINE = 'Industrial Thermal Intelligence';
export const APP_DESCRIPTION =
  'Satellite-powered detection and classification of industrial thermal anomalies across India.';

// ── Classification ────────────────────────────────────────────────────────

export const EVENT_COLORS: Record<ThermalClass, string> = {
  industrial_fire: '#EF4444',
  persistent_thermal_source: '#F97316',
  natural_wildfire: '#FACC15',
  other: '#64748B',
};

export const CLASS_LABELS: Record<ThermalClass, string> = {
  industrial_fire: 'Industrial Fire',
  persistent_thermal_source: 'Persistent Thermal Source',
  natural_wildfire: 'Natural Wildfire',
  other: 'Other / Unclassified',
};

export const CLASS_SHORT: Record<ThermalClass, string> = {
  industrial_fire: 'FIRE',
  persistent_thermal_source: 'PERSISTENT',
  natural_wildfire: 'WILDFIRE',
  other: 'OTHER',
};

export const THERMAL_CLASSES: ThermalClass[] = [
  'industrial_fire',
  'persistent_thermal_source',
  'natural_wildfire',
  'other',
];

export const SEVERITY_ORDER = THERMAL_CLASSES;

// ── Priority (deliberately NOT the same axis as classification) ────────────

export type PriorityBand = 'critical' | 'high' | 'moderate' | 'low';

export const PRIORITY_LABELS: Record<PriorityBand, string> = {
  critical: 'Critical',
  high: 'High',
  moderate: 'Moderate',
  low: 'Low',
};

export const PRIORITY_COLORS: Record<PriorityBand, string> = {
  critical: '#EF4444',
  high: '#F97316',
  moderate: '#FACC15',
  low: '#64748B',
};

export const PRIORITY_BANDS: PriorityBand[] = ['critical', 'high', 'moderate', 'low'];

// ── Confidence banding (confidence-aware UX) ───────────────────────────────

export type ConfidenceBand = 'high' | 'moderate' | 'uncertain';

export interface ConfidenceDescriptor {
  band: ConfidenceBand;
  label: string;
  note: string;
  color: string;
  requiresReview: boolean;
}

export function describeConfidence(confidence: number): ConfidenceDescriptor {
  if (confidence >= 0.75) {
    return {
      band: 'high',
      label: 'High confidence',
      note: 'Classification is stable across the evidence stack.',
      color: '#22C55E',
      requiresReview: false,
    };
  }
  if (confidence >= 0.55) {
    return {
      band: 'moderate',
      label: 'Moderate confidence',
      note: 'Classification is probable but not settled. Verify against context.',
      color: '#FACC15',
      requiresReview: false,
    };
  }
  return {
    band: 'uncertain',
    label: 'Requires review',
    note: 'Evidence is weak or contradictory. Do not action without verification.',
    color: '#F97316',
    requiresReview: true,
  };
}

// ── Map ───────────────────────────────────────────────────────────────────

export const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

/** Raster satellite context layer. Public tile service, no API key required. */
export const SATELLITE_SOURCE = {
  id: 'satellite-context',
  tiles: [
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  ],
  attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
  tileSize: 256,
  maxzoom: 18,
};

/**
 * Fallback style used when the CDN basemap cannot be reached. A bare but valid
 * style means the operational view degrades to "no basemap, events still
 * plotted" instead of an empty black rectangle — a demo venue has no wifi
 * guarantee, and glyph/tiles are fetched at runtime.
 *
 * We still plot the India + neighbours outline inline (no network needed) so
 * the analyst keeps a geographic anchor even fully offline. The thermal event
 * layers are added on top of this style by the map component, so detections
 * remain fully readable against the dark void.
 */
export const FALLBACK_STYLE = {
  version: 8 as const,
  name: 'void',
  sources: {
    'fallback-outline': { type: 'geojson' as const, data: INDIA_OUTLINE },
  },
  layers: [
    { id: 'background', type: 'background' as const, paint: { 'background-color': '#070B12' } },
    {
      id: 'fallback-outline-fill',
      type: 'fill' as const,
      source: 'fallback-outline',
      paint: { 'fill-color': '#0C1726', 'fill-opacity': 0.55 },
    },
    {
      id: 'fallback-outline-line',
      type: 'line' as const,
      source: 'fallback-outline',
      paint: {
        'line-color': [
          'case',
          ['==', ['get', 'primary'], true],
          'rgba(0,217,255,0.55)',
          'rgba(148,163,184,0.3)',
        ],
        'line-width': ['case', ['==', ['get', 'primary'], true], 1.3, 0.8],
      },
    },
  ],
};

export const CLUSTER_RADIUS = 52;
export const CLUSTER_MAX_ZOOM = 11;

/**
 * Font stack for symbol layers. 'Noto Sans Mono Regular' is not served by the
 * CARTO glyph endpoint; its CORS-blocked request silently killed every cluster
 * label in the previous build.
 */
export const GLYPH_FONT = ['Open Sans Regular', 'Arial Unicode MS Regular'];

export const LAYER_IDS = {
  eventsGlow: 'events-glow',
  eventsCore: 'events-core',
  clustersGlow: 'clusters-glow',
  clusters: 'clusters',
  clusterCount: 'clusters-count',
  heatmap: 'events-heatmap',
  industrial: 'industrial-sites',
  industrialLabel: 'industrial-sites-label',
  adminLine: 'admin-boundary-line',
  satellite: 'satellite-context',
  selectionRing: 'selection-ring',
  selectionHalo: 'selection-halo',
} as const;

// ── The cinematic journey — ONE shared phase map ───────────────────────────

/**
 * Eight states, expressed as [start, end) windows over the 0..1 cinematic
 * scroll progress. Every consumer (hero copy, breadcrumb, globe camera,
 * observation overlay, scroll state machine) imports this and nothing else.
 */
export const CINEMATIC_STATES = [
  { id: 'space', label: 'SPACE', sub: 'Orbital insertion', start: 0.0, end: 0.08 },
  { id: 'earth', label: 'EARTH', sub: 'Global observation', start: 0.08, end: 0.24 },
  { id: 'asia', label: 'ASIA', sub: 'Regional approach', start: 0.24, end: 0.42 },
  { id: 'india', label: 'INDIA', sub: 'Area of interest', start: 0.42, end: 0.58 },
  { id: 'region', label: 'REGION', sub: 'India + neighbours', start: 0.58, end: 0.72 },
  { id: 'descent', label: 'DESCENT', sub: 'Regional descent', start: 0.72, end: 0.84 },
  { id: 'signal', label: 'SIGNAL', sub: 'Thermal signal', start: 0.84, end: 0.93 },
  { id: 'surface', label: 'SURFACE', sub: 'Intelligence map', start: 0.93, end: 1.0 },
] as const;

export type CinematicStateId = (typeof CINEMATIC_STATES)[number]['id'];

export function cinematicStateAt(p: number): (typeof CINEMATIC_STATES)[number] {
  for (const s of CINEMATIC_STATES) {
    if (p < s.end) return s;
  }
  return CINEMATIC_STATES[CINEMATIC_STATES.length - 1];
}

/**
 * Globe camera keyframes. `at` is cinematic scroll progress; `altitude` is a
 * multiple of the globe radius (1.0 = at the surface), clamped at runtime by
 * MIN_SURFACE_MULTIPLE so the camera can never enter the planet.
 */
/** Named waypoints on the cinematic journey. Keys of `JOURNEY_FACING`. */
export type FacingKey = 'EARTH' | 'ASIA_APPROACH' | 'ASIA' | 'INDIA' | 'REGION';

export interface GlobeKey {
  at: number;
  facing: FacingKey;
  /** Multiple of the globe radius. 1.0 = at the surface. */
  altitude: number;
  /** Residual planetary spin at this point in the journey. */
  spin: number;
}

export const GLOBE_KEYS: GlobeKey[] = [
  { at: 0.0, facing: 'EARTH', altitude: 2.9, spin: 1.0 },
  { at: 0.18, facing: 'EARTH', altitude: 2.45, spin: 0.9 },
  { at: 0.34, facing: 'ASIA_APPROACH', altitude: 1.95, spin: 0.42 },
  { at: 0.5, facing: 'ASIA', altitude: 1.55, spin: 0.18 },
  { at: 0.66, facing: 'INDIA', altitude: 1.24, spin: 0.06 },
  { at: 0.8, facing: 'REGION', altitude: 1.09, spin: 0.0 },
  { at: 0.93, facing: 'REGION', altitude: 1.045, spin: 0.0 },
  { at: 1.0, facing: 'REGION', altitude: 1.02, spin: 0.0 },
];

/** Hard floor: the camera never gets closer than this multiple of the radius. */
export const MIN_SURFACE_MULTIPLE = 1.02;

/** Globe radius in world units. */
export const GLOBE_RADIUS = 1.5;

/** Vertical field of view of the cinematic camera, in degrees. */
export const GLOBE_FOV = 42;

// ── Handoff timeline ──────────────────────────────────────────────────────
/**
 * THE GLOBE → MAP HANDOFF, ON ONE CLOCK.
 *
 * Every band below is expressed in RAW document progress (0..1), the same
 * clock `experience.progress` publishes. That is the whole point — the layers
 * previously read three different clocks:
 *
 *   globe dissolve    cinematicProgress (saturates at 1 by raw 0.68)
 *   observation view  raw progress, but gated invisible
 *   map               operationalProgress (0 until raw 0.86)
 *
 * so the planet was gone by raw 0.54 while the map did not start until raw
 * 0.88: 143vh of black screen. Any new layer MUST take its ramp from here.
 *
 * Invariants, asserted by tests/e2e/model-handoff.mjs:
 *   - at every raw p, at least one contributor is strongly present
 *   - the composite never drops below ~0.25
 */
export const HANDOFF = {
  /** Globe canvas starts dissolving. */
  dissolveStart: 0.72,
  /** Globe canvas is fully gone; the rAF loop is cancelled just after. */
  dissolveEnd: 0.93,
  /** Raw progress at which three.js may stop rendering entirely. */
  globeSettled: 0.95,

  /** Ambient wash rises — the floor that guarantees the screen is never black. */
  washIn: [0.52, 0.74] as const,
  washOut: [0.9, 0.99] as const,

  /** Observation view rises as the planet dissolves, falls as the map lands. */
  observationIn: [0.6, 0.76] as const,
  observationOut: [0.86, 0.94] as const,
} as const;

// ── Motion ────────────────────────────────────────────────────────────────

export const MOTION = {
  micro: { duration: 200, ease: [0.16, 1, 0.3, 1] },
  interaction: { duration: 380, ease: [0.16, 1, 0.3, 1] },
  uiTransition: { duration: 900, ease: [0.16, 1, 0.3, 1] },
  cinematic: { duration: 2200, ease: [0.65, 0, 0.35, 1] },
} as const;
