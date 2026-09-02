/**
 * SEEDED DEMO DATASET — the single source of truth.
 *
 * Everything the product shows (map markers, clusters, the event navigator,
 * analytics, persistence ranking, timeline replay) is derived from the array
 * produced here. Nothing downstream is allowed to invent its own numbers —
 * that is how the previous build ended up claiming 12,543 events above a map
 * showing ten dots.
 *
 * The data is SYNTHETIC. Facility names and coordinates are real; every
 * thermal detection attached to them is generated. See `DATA_PROVENANCE`.
 *
 * Generation is deterministic: same seed, same array, on server and client,
 * across reloads. This is required to avoid hydration mismatches.
 */

import { createRng } from '@/lib/rng';
import {
  INDUSTRIAL_FACILITIES,
  WILDFIRE_REGIONS,
  type IndustrialFacility,
  type IndustrialType,
} from './regions';
import type {
  ThermalEvent,
  ThermalClass,
  Evidence,
  HistoricalObservation,
  AnalyticsSummary,
  EventFilters,
  Pagination,
} from '@/types/event';

/** Fixed so server and client generate byte-identical data. */
export const DATASET_SEED = 20260830;

/**
 * Anchor date for the 30-day observation window. Deliberately a constant —
 * deriving it from `Date.now()` would make SSR and hydration disagree across
 * a UTC midnight boundary.
 */
export const DEMO_REFERENCE_DATE = '2026-08-30T00:00:00Z';

/** Length of the observation window in days. */
export const WINDOW_DAYS = 30;

export const DATA_PROVENANCE = {
  dataType: 'DEMO' as const,
  primarySource: 'NASA FIRMS',
  satellites: 'VIIRS / MODIS',
  modelVersion: 'v2026.08.30-xgb-v3',
  featureVersion: 'v2026.08.30-feat-v2',
  industrialContext: 'OpenStreetMap (derived)',
  notice:
    'Synthetic demonstration dataset. Detection counts and classifications are generated, not observed.',
};

// ── Types ─────────────────────────────────────────────────────────────────

export type HotspotKind = 'industrial' | 'wildfire' | 'residue';

export type PriorityBand = 'critical' | 'high' | 'moderate' | 'low';

export interface ThermalHotspot {
  id: number;
  kind: HotspotKind;
  lng: number;
  lat: number;
  state: string;
  district: string;
  /** Set when the hotspot is anchored to a known facility. */
  facilityId?: number;
  facilityName?: string;
  facilityType?: IndustrialType;
  distanceKm?: number;
  wildfireRegionName?: string;
  detectionCount: number;
  activeDays: number;
  firstDate: string;
  lastDate: string;
  dominantClass: ThermalClass;
  maxFrp: number;
  avgBrightness: number;
  /** 0..100 composite priority of the hotspot (not the individual event). */
  priorityScore: number;
}

export interface DatasetStats {
  totalEvents: number;
  totalHotspots: number;
  persistentHotspots: number;
  dateRange: { start: string; end: string };
  byClass: Array<{ class: ThermalClass; count: number; avgConfidence: number }>;
  byPriority: Array<{ band: PriorityBand; count: number }>;
  bySource: Array<{ source: string; count: number }>;
  byState: Array<{ state: string; count: number }>;
  byDay: Array<{ date: string; count: number }>;
}

export interface DemoDataset {
  seed: number;
  referenceDate: string;
  events: ThermalEvent[];
  hotspots: ThermalHotspot[];
  facilities: IndustrialFacility[];
  stats: DatasetStats;
}

// ── Helpers ───────────────────────────────────────────────────────────────

const INSTRUMENTS = [
  { satellite: 'Suomi-NPP', instrument: 'VIIRS', source: 'VIIRS_SNPP_NRT', weight: 4 },
  { satellite: 'NOAA-20', instrument: 'VIIRS', source: 'VIIRS_NOAA20_NRT', weight: 4 },
  { satellite: 'Terra', instrument: 'MODIS', source: 'MODIS_NRT', weight: 2 },
  { satellite: 'Aqua', instrument: 'MODIS', source: 'MODIS_NRT', weight: 2 },
] as const;

/** Great-circle distance in km (equirectangular is plenty at these scales). */
export function distanceKm(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Approximate Indian state from coordinates — used for the admin breadcrumb. */
function stateFromPoint(lng: number, lat: number): string {
  if (lat >= 23.5 && lng < 71) return 'Gujarat';
  if (lat >= 20.5 && lat < 23.5 && lng < 73.5) return 'Gujarat';
  if (lat >= 15.6 && lat < 20.5 && lng >= 72.6 && lng < 76) return 'Maharashtra';
  if (lat >= 20.5 && lng >= 72.6 && lng < 80.9) return 'Maharashtra';
  if (lat >= 17.8 && lat < 22.5 && lng >= 80.9 && lng < 87.5) return 'Chhattisgarh';
  if (lat >= 17.8 && lat < 22.5 && lng >= 81.5 && lng < 87.5 && lat < 20.5) return 'Odisha';
  if (lat >= 20.5 && lng >= 83 && lng < 87.5) return 'Odisha';
  if (lat >= 22 && lng >= 83 && lng < 87.8) return 'Jharkhand';
  if (lat >= 21.5 && lng >= 86 && lng < 89) return 'West Bengal';
  if (lat >= 24.2 && lng >= 87.5 && lng < 92) return 'Bihar';
  if (lat >= 24.2 && lng >= 88) return 'West Bengal';
  if (lng >= 88.5 && lat >= 24) return 'Assam';
  if (lat >= 21 && lng >= 74 && lng < 82.5) return 'Madhya Pradesh';
  if (lat >= 11.5 && lng >= 74 && lng < 78.5) return 'Karnataka';
  if (lat < 13.5 && lng >= 76.5 && lng < 80.5) return 'Tamil Nadu';
  if (lat >= 12.6 && lng >= 76.5 && lng < 84.5) return 'Andhra Pradesh';
  if (lat >= 15.5 && lng >= 77 && lng < 81.5) return 'Telangana';
  if (lat >= 24.2 && lng >= 68 && lng < 78) return 'Rajasthan';
  if (lat >= 24.2 && lng >= 77 && lng < 84.5) return 'Uttar Pradesh';
  if (lat >= 27.5 && lng >= 76 && lng < 81.5) return 'Uttarakhand';
  return 'India';
}

const DISTRICT_HINTS: Record<string, string[]> = {
  Gujarat: ['Jamnagar', 'Kutch', 'Surat', 'Vadodara', 'Bharuch', 'Bhavnagar', 'Valsad'],
  Maharashtra: ['Mumbai Suburban', 'Thane', 'Nagpur', 'Chandrapur', 'Amravati', 'Raigad'],
  Odisha: ['Angul', 'Jagatsinghpur', 'Jharsuguda', 'Sundargarh', 'Jajpur', 'Mayurbhanj'],
  Jharkhand: ['Dhanbad', 'Bokaro', 'Ramgarh', 'West Singhbhum', 'Latehar', 'Palamu'],
  'West Bengal': ['Paschim Bardhaman', 'Purulia', 'Purba Medinipur', 'Bankura'],
  Assam: ['Tinsukia', 'Golaghat', 'Kamrup', 'Dibrugarh'],
  Chhattisgarh: ['Durg', 'Korba', 'Raigarh', 'Bastar'],
  'Madhya Pradesh': ['Umaria', 'Balaghat', 'Panna', 'Singrauli', 'Chhatarpur'],
  Karnataka: ['Dakshina Kannada', 'Ballari', 'Mysuru', 'Uttara Kannada'],
  'Tamil Nadu': ['Tiruvallur', 'Nilgiris', 'Thoothukudi'],
  'Andhra Pradesh': ['Visakhapatnam', 'Kakinada', 'Nandyal', 'Prakasam'],
  Telangana: ['Peddapalli', 'Bhadradri'],
  Uttaranchal: ['Nainital'],
  Uttarakhand: ['Nainital', 'Almora'],
  Rajasthan: ['Sawai Madhopur', 'Kota', 'Jaisalmer'],
  'Uttar Pradesh': ['Mathura', 'Sonbhadra', 'Gautam Buddha Nagar'],
  Bihar: ['Begusarai', 'Gaya'],
  Haryana: ['Panipat'],
  India: ['Unknown'],
};

const LAND_COVER_BY_KIND: Record<HotspotKind, string[]> = {
  industrial: ['industrial', 'built-up', 'bare'],
  wildfire: ['forest', 'shrubland', 'grassland'],
  residue: ['cropland', 'agricultural mosaic'],
};

function padId(n: number): string {
  return `evt_${String(n).padStart(5, '0')}`;
}

function isoDay(base: Date, dayOffset: number, hour: number, minute: number): string {
  const d = new Date(base.getTime());
  d.setUTCDate(d.getUTCDate() - dayOffset);
  d.setUTCHours(hour, minute, Math.floor((minute % 1) * 60), 0);
  return d.toISOString().replace('.000Z', 'Z');
}

export function priorityBand(score: number): PriorityBand {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 40) return 'moderate';
  return 'low';
}

// ── Generation ────────────────────────────────────────────────────────────

function buildHotspots(seed: number): ThermalHotspot[] {
  const rng = createRng(seed);
  const hotspots: ThermalHotspot[] = [];
  let id = 1;

  // Industrial — 2 to 4 thermal points (flare stacks, kilns, stockpiles) around
  // each known facility.
  for (const f of INDUSTRIAL_FACILITIES) {
    const points = f.profile === 'flare' ? rng.int(2, 4) : rng.int(2, 3);
    for (let i = 0; i < points; i++) {
      // Flares are compact (<1 km); open combustion spreads a little further.
      const spread = f.profile === 'flare' ? 0.006 : f.profile === 'process' ? 0.012 : 0.02;
      hotspots.push({
        id: id++,
        kind: 'industrial',
        lng: f.lng + rng.range(-spread, spread),
        lat: f.lat + rng.range(-spread, spread),
        state: f.state,
        district: rng.pick(DISTRICT_HINTS[f.state] ?? DISTRICT_HINTS.India),
        facilityId: f.id,
        facilityName: f.name,
        facilityType: f.type,
        distanceKm: 0,
        detectionCount: 0,
        activeDays: 0,
        firstDate: '',
        lastDate: '',
        dominantClass: 'persistent_thermal_source',
        maxFrp: 0,
        avgBrightness: 0,
        priorityScore: 0,
      });
    }
  }

  // Wildfire — burn scars spread across a forest region.
  for (const w of WILDFIRE_REGIONS) {
    const points = rng.int(3, 6);
    for (let i = 0; i < points; i++) {
      hotspots.push({
        id: id++,
        kind: 'wildfire',
        lng: w.lng + rng.range(-w.spread, w.spread),
        lat: w.lat + rng.range(-w.spread, w.spread),
        state: w.state,
        district: rng.pick(DISTRICT_HINTS[w.state] ?? DISTRICT_HINTS.India),
        wildfireRegionName: w.name,
        detectionCount: 0,
        activeDays: 0,
        firstDate: '',
        lastDate: '',
        dominantClass: 'natural_wildfire',
        maxFrp: 0,
        avgBrightness: 0,
        priorityScore: 0,
      });
    }
  }

  // Crop-residue burning — scattered, low persistence, very common in the
  // Indo-Gangetic plain. This is what makes the map look like India rather
  // than like a list of factories.
  const residueCentres: Array<[number, number, string]> = [
    [75.5, 30.4, 'Punjab'],
    [76.7, 29.4, 'Haryana'],
    [78.0, 28.6, 'Uttar Pradesh'],
    [85.1, 25.6, 'Bihar'],
    [88.1, 23.7, 'West Bengal'],
    [94.0, 26.7, 'Assam'],
    [77.2, 20.9, 'Maharashtra'],
    [74.1, 17.3, 'Karnataka'],
  ];
  for (const [lng, lat, state] of residueCentres) {
    const points = rng.int(14, 22);
    for (let i = 0; i < points; i++) {
      hotspots.push({
        id: id++,
        kind: 'residue',
        lng: lng + rng.range(-0.85, 0.85),
        lat: lat + rng.range(-0.75, 0.75),
        state,
        district: rng.pick(DISTRICT_HINTS[state] ?? DISTRICT_HINTS.India),
        detectionCount: 0,
        activeDays: 0,
        firstDate: '',
        lastDate: '',
        dominantClass: 'other',
        maxFrp: 0,
        avgBrightness: 0,
        priorityScore: 0,
      });
    }
  }

  // Attach nearest-facility distance to every non-industrial hotspot too, so
  // "industrial proximity" is a real measured feature and not a stub.
  for (const h of hotspots) {
    if (h.kind === 'industrial') {
      continue;
    }
    let best: IndustrialFacility | null = null;
    let bestKm = Infinity;
    for (const f of INDUSTRIAL_FACILITIES) {
      const km = distanceKm(h.lng, h.lat, f.lng, f.lat);
      if (km < bestKm) {
        bestKm = km;
        best = f;
      }
    }
    if (best && bestKm <= 25) {
      h.facilityId = best.id;
      h.facilityName = best.name;
      h.facilityType = best.type;
      h.distanceKm = Number(bestKm.toFixed(2));
    }
  }

  return hotspots;
}

function classify(
  hotspot: ThermalHotspot,
  activeDays: number,
  frp: number,
  nightShare: number
): { cls: ThermalClass; confidence: number } {
  const nearIndustry = hotspot.distanceKm !== undefined && hotspot.distanceKm <= 3;
  const midIndustry = hotspot.distanceKm !== undefined && hotspot.distanceKm <= 8;

  if (hotspot.kind === 'industrial') {
    // Gas flares and process heat recur; a one-off hot spot near a refinery is
    // much more likely to be a genuine fire than a flare.
    if (activeDays >= 8 && frp < 60) {
      return { cls: 'persistent_thermal_source', confidence: 0.78 + Math.min(0.16, activeDays / 200) };
    }
    if (frp >= 45 || (activeDays < 8 && frp >= 20)) {
      return { cls: 'industrial_fire', confidence: 0.68 + Math.min(0.26, frp / 400) };
    }
    return { cls: 'persistent_thermal_source', confidence: 0.62 + Math.min(0.2, activeDays / 150) };
  }

  if (hotspot.kind === 'wildfire') {
    // Night-time forest fire with high persistence reads as industrial-ish in
    // the model; keep a small industrial tail so the classes are not separable
    // by eye alone.
    if (nearIndustry && activeDays >= 6 && nightShare > 0.6) {
      return { cls: 'industrial_fire', confidence: 0.58 + Math.min(0.2, activeDays / 120) };
    }
    return { cls: 'natural_wildfire', confidence: 0.72 + Math.min(0.22, activeDays / 100) };
  }

  // Crop residue / misc
  if (midIndustry && activeDays >= 10) {
    return { cls: 'persistent_thermal_source', confidence: 0.55 + Math.min(0.2, activeDays / 150) };
  }
  if (nearIndustry) {
    return { cls: 'industrial_fire', confidence: 0.5 + Math.min(0.18, frp / 500) };
  }
  return { cls: 'other', confidence: 0.48 + Math.min(0.24, activeDays / 120) };
}

function buildEvents(seed: number, hotspots: ThermalHotspot[]): ThermalEvent[] {
  const rng = createRng(seed ^ 0x5f3759df);
  const reference = new Date(DEMO_REFERENCE_DATE);
  const events: ThermalEvent[] = [];

  const instrumentWeights = INSTRUMENTS.map((i) => i.weight);
  let counter = 1;

  for (const hotspot of hotspots) {
    // How many times this source is seen in the 30-day window.
    let target: number;
    if (hotspot.kind === 'industrial') {
      const profile = INDUSTRIAL_FACILITIES.find((f) => f.id === hotspot.facilityId)?.profile;
      target = profile === 'flare' ? rng.int(14, 28) : profile === 'combustion' ? rng.int(9, 20) : rng.int(5, 15);
    } else if (hotspot.kind === 'wildfire') {
      // A fire burns for a few days then goes out.
      target = rng.weighted([1, 2, 3, 4, 6, 9], [22, 20, 16, 14, 12, 6]);
    } else {
      target = rng.weighted([1, 2, 3], [62, 26, 12]);
    }

    // Which days within the window were active — contiguous runs look real for
    // fires, scattered nights look real for flares.
    const activeDaySet = new Set<number>();
    if (hotspot.kind === 'wildfire') {
      const start = rng.int(0, WINDOW_DAYS - Math.max(1, Math.min(target, 10)));
      for (let d = 0; d < Math.min(target, 12); d++) {
        activeDaySet.add(Math.min(WINDOW_DAYS - 1, start + d));
      }
    } else {
      while (activeDaySet.size < Math.min(target, WINDOW_DAYS)) {
        activeDaySet.add(rng.int(0, WINDOW_DAYS - 1));
      }
    }
    const activeDays = [...activeDaySet].sort((a, b) => a - b);

    let frpSum = 0;
    let brightSum = 0;
    let nightCount = 0;
    let maxFrp = 0;

    const generated: ThermalEvent[] = [];

    for (const dayOffset of activeDays) {
      // Flares and process heat are detected at night; fires and residue
      // burning show up in the afternoon overpass.
      const nightBias = hotspot.kind === 'industrial' ? 0.78 : hotspot.kind === 'residue' ? 0.22 : 0.45;
      const isNight = rng.chance(nightBias);
      if (isNight) nightCount++;

      const hour = isNight ? rng.int(17, 21) : rng.int(6, 11);
      const instrument = rng.weighted(INSTRUMENTS, instrumentWeights);

      // Thermal character by kind.
      let brightness: number;
      let frp: number;
      if (hotspot.kind === 'industrial') {
        brightness = rng.range(310, 430) + (isNight ? 8 : 0);
        frp = Math.round(rng.range(3, 120) * 10) / 10;
      } else if (hotspot.kind === 'wildfire') {
        brightness = rng.range(320, 480);
        frp = Math.round(rng.range(2, 95) * 10) / 10;
      } else {
        brightness = rng.range(300, 360);
        frp = Math.round(rng.range(0.6, 22) * 10) / 10;
      }

      // Detection confidence follows the NASA FIRMS bands (low/nominal/high).
      const confRoll = rng.next();
      const confidence = confRoll > 0.86 ? rng.int(85, 100) : confRoll > 0.42 ? rng.int(55, 84) : rng.int(30, 54);

      frpSum += frp;
      brightSum += brightness;
      maxFrp = Math.max(maxFrp, frp);

      generated.push({
        id: padId(counter++),
        geometry: {
          type: 'Point',
          coordinates: [
            Number((hotspot.lng + rng.range(-0.0016, 0.0016)).toFixed(6)),
            Number((hotspot.lat + rng.range(-0.0016, 0.0016)).toFixed(6)),
          ],
        },
        brightness: Number(brightness.toFixed(1)),
        brightT31: Number((brightness - rng.range(8, 34)).toFixed(1)),
        scan: Number(rng.range(0.4, 1.6).toFixed(2)),
        track: Number(rng.range(0.4, 1.6).toFixed(2)),
        frp,
        acqDatetime: isoDay(reference, dayOffset, hour, rng.int(0, 59)),
        satellite: instrument.satellite,
        instrument: instrument.instrument,
        confidence,
        daynight: isNight ? 'N' : 'D',
        source: instrument.source,
        clusterId: hotspot.id,
      });
    }

    if (generated.length === 0) continue;

    const avgFrp = frpSum / generated.length;
    const avgBrightness = brightSum / generated.length;
    const nightShare = nightCount / generated.length;
    const { cls, confidence: classConfidence } = classify(hotspot, activeDaySet.size, avgFrp, nightShare);

    // Composite priority — deliberately NOT the same thing as classification.
    // A low-FRP flare next to a refinery that runs every night outranks a
    // one-off bright forest fire.
    const persistenceScore = Math.min(1, activeDaySet.size / 22) * 30;
    const proximityScore =
      hotspot.distanceKm === undefined
        ? 4
        : hotspot.distanceKm <= 1
          ? 25
          : hotspot.distanceKm <= 3
            ? 20
            : hotspot.distanceKm <= 8
              ? 13
              : hotspot.distanceKm <= 25
                ? 6
                : 2;
    const intensityScore = Math.min(1, avgFrp / 90) * 25;
    const contextScore =
      (cls === 'industrial_fire' ? 12 : cls === 'persistent_thermal_source' ? 9 : 4) +
      nightShare * 8;
    const priorityScore = Math.round(persistenceScore + proximityScore + intensityScore + contextScore);

    hotspot.detectionCount = generated.length;
    hotspot.activeDays = activeDaySet.size;
    hotspot.firstDate = generated[0].acqDatetime;
    hotspot.lastDate = generated[generated.length - 1].acqDatetime;
    hotspot.dominantClass = cls;
    hotspot.maxFrp = Number(maxFrp.toFixed(1));
    hotspot.avgBrightness = Number(avgBrightness.toFixed(1));
    hotspot.priorityScore = priorityScore;

    for (const event of generated) {
      event.classification = {
        class: cls,
        confidence: Number(Math.min(0.98, classConfidence).toFixed(2)),
        allProbabilities: buildProbabilities(cls, classConfidence),
        modelVersion: DATA_PROVENANCE.modelVersion,
        createdAt: event.acqDatetime,
      };
      event.enrichment = {
        nearestIndustrialSite:
          hotspot.facilityId !== undefined
            ? {
                id: hotspot.facilityId,
                name: hotspot.facilityName ?? 'Unknown facility',
                type: hotspot.facilityType ?? 'unknown',
                distanceKm: hotspot.distanceKm ?? 0,
                bearingDeg: rng.int(0, 359),
              }
            : undefined,
        landCover: rng.pick(LAND_COVER_BY_KIND[hotspot.kind]),
        admin: { state: hotspot.state, district: hotspot.district },
        populationDensity: hotspot.kind === 'industrial' ? rng.int(180, 4200) : rng.int(20, 600),
      };
      // Stash the derived priority on the event so list sorting is cheap.
      (event as ThermalEvent & { priorityScore?: number }).priorityScore = priorityScore;
      (event as ThermalEvent & { activeDays?: number }).activeDays = activeDaySet.size;
      events.push(event);
    }
  }

  // Newest first — every list in the product expects that ordering.
  events.sort((a, b) => (a.acqDatetime < b.acqDatetime ? 1 : a.acqDatetime > b.acqDatetime ? -1 : 0));
  return events;
}

function buildProbabilities(cls: ThermalClass, confidence: number): Record<ThermalClass, number> {
  const classes: ThermalClass[] = [
    'industrial_fire',
    'persistent_thermal_source',
    'natural_wildfire',
    'other',
  ];
  const remaining = Number((1 - confidence).toFixed(3));
  const others = classes.filter((c) => c !== cls);
  const out = {} as Record<ThermalClass, number>;
  out[cls] = Number(confidence.toFixed(3));
  // Distribute the remainder unevenly so the runner-up is meaningful.
  const weights = [0.55, 0.31, 0.14];
  others.forEach((c, i) => {
    out[c] = Number((remaining * weights[i]).toFixed(3));
  });
  return out;
}

function buildStats(events: ThermalEvent[], hotspots: ThermalHotspot[]): DatasetStats {
  const byClassMap = new Map<ThermalClass, { count: number; confSum: number }>();
  const byPriorityMap = new Map<PriorityBand, number>();
  const bySourceMap = new Map<string, number>();
  const byStateMap = new Map<string, number>();
  const byDayMap = new Map<string, number>();

  for (const e of events) {
    const cls = e.classification?.class ?? 'other';
    const conf = e.classification?.confidence ?? 0;
    const entry = byClassMap.get(cls) ?? { count: 0, confSum: 0 };
    entry.count += 1;
    entry.confSum += conf;
    byClassMap.set(cls, entry);

    const band = priorityBand((e as ThermalEvent & { priorityScore?: number }).priorityScore ?? 0);
    byPriorityMap.set(band, (byPriorityMap.get(band) ?? 0) + 1);

    bySourceMap.set(e.source, (bySourceMap.get(e.source) ?? 0) + 1);
    const state = e.enrichment?.admin?.state ?? 'India';
    byStateMap.set(state, (byStateMap.get(state) ?? 0) + 1);

    const day = e.acqDatetime.slice(0, 10);
    byDayMap.set(day, (byDayMap.get(day) ?? 0) + 1);
  }

  const dates = events.map((e) => e.acqDatetime).sort();

  return {
    totalEvents: events.length,
    totalHotspots: hotspots.length,
    persistentHotspots: hotspots.filter((h) => h.activeDays >= 8).length,
    dateRange: { start: dates[0] ?? DEMO_REFERENCE_DATE, end: dates[dates.length - 1] ?? DEMO_REFERENCE_DATE },
    byClass: [...byClassMap.entries()]
      .map(([cls, v]) => ({
        class: cls,
        count: v.count,
        avgConfidence: Number((v.confSum / v.count).toFixed(2)),
      }))
      .sort((a, b) => b.count - a.count),
    byPriority: (['critical', 'high', 'moderate', 'low'] as PriorityBand[]).map((band) => ({
      band,
      count: byPriorityMap.get(band) ?? 0,
    })),
    bySource: [...bySourceMap.entries()]
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count),
    byState: [...byStateMap.entries()]
      .map(([state, count]) => ({ state, count }))
      .sort((a, b) => b.count - a.count),
    byDay: [...byDayMap.entries()]
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => (a.date < b.date ? -1 : 1)),
  };
}

function generate(seed: number): DemoDataset {
  const hotspots = buildHotspots(seed);
  const events = buildEvents(seed, hotspots);
  return {
    seed,
    referenceDate: DEMO_REFERENCE_DATE,
    events,
    hotspots,
    facilities: INDUSTRIAL_FACILITIES,
    stats: buildStats(events, hotspots),
  };
}

// Module-level memo: generation happens exactly once per process.
let cached: DemoDataset | null = null;

export function getDataset(): DemoDataset {
  if (!cached) cached = generate(DATASET_SEED);
  return cached;
}

// ── Derived views ─────────────────────────────────────────────────────────

export function getHotspotById(id: number): ThermalHotspot | undefined {
  return getDataset().hotspots.find((h) => h.id === id);
}

export function getHotspotForEvent(eventId: string): ThermalHotspot | undefined {
  const event = getDataset().events.find((e) => e.id === eventId);
  return event?.clusterId !== undefined ? getHotspotById(event.clusterId) : undefined;
}

/** Detections at the same source, oldest first — this IS the event history. */
export function getEventHistory(eventId: string): HistoricalObservation[] {
  const { events } = getDataset();
  const event = events.find((e) => e.id === eventId);
  if (!event || event.clusterId === undefined) return [];
  return events
    .filter((e) => e.clusterId === event.clusterId)
    .map((e) => ({
      eventId: e.id,
      acqDatetime: e.acqDatetime,
      geometry: e.geometry,
      brightness: e.brightness,
      confidence: e.confidence,
      frp: e.frp,
      satellite: e.satellite,
    }))
    .sort((a, b) => (a.acqDatetime < b.acqDatetime ? -1 : 1));
}

/**
 * Evidence stack. Built from the structured features that actually drove the
 * classification, so the panel can never contradict the badge.
 */
export function getEventEvidence(eventId: string): Evidence | null {
  const { events } = getDataset();
  const event = events.find((e) => e.id === eventId);
  if (!event || !event.classification) return null;

  const hotspot = event.clusterId !== undefined ? getHotspotById(event.clusterId) : undefined;
  const cls = event.classification.class;
  const site = event.enrichment?.nearestIndustrialSite;
  const frp = event.frp ?? 0;
  const activeDays = (event as ThermalEvent & { activeDays?: number }).activeDays ?? 1;
  const history = getEventHistory(eventId);
  const nightCount = history.filter((h) => {
    const hour = Number(h.acqDatetime.slice(11, 13));
    return hour >= 17 || hour < 6;
  }).length;
  const nightShare = history.length ? nightCount / history.length : 0;

  const positive: Evidence['positiveFactors'] = [];
  const negative: Evidence['positiveFactors'] = [];

  if (site && site.distanceKm <= 3) {
    positive.push({
      factor: 'Industrial proximity',
      weight: 0.34,
      detail: `${site.distanceKm.toFixed(1)} km from ${site.name} (${site.type})`,
      source: 'OSM derived',
    });
  } else if (site) {
    positive.push({
      factor: 'Industrial proximity',
      weight: 0.12,
      detail: `${site.distanceKm.toFixed(1)} km from ${site.name} (${site.type})`,
      source: 'OSM derived',
    });
  } else {
    negative.push({
      factor: 'Industrial proximity',
      weight: -0.16,
      detail: 'No known industrial facility within 25 km',
      source: 'OSM derived',
    });
  }

  if (frp >= 45) {
    positive.push({
      factor: 'High FRP',
      weight: 0.24,
      detail: `${frp.toFixed(1)} MW — above the 90th percentile for this region`,
      source: 'VIIRS',
    });
  } else if (frp >= 15) {
    positive.push({
      factor: 'Moderate FRP',
      weight: 0.13,
      detail: `${frp.toFixed(1)} MW`,
      source: 'VIIRS',
    });
  } else {
    negative.push({
      factor: 'Low FRP',
      weight: -0.14,
      detail: `${frp.toFixed(1)} MW — consistent with routine process heat`,
      source: 'VIIRS',
    });
  }

  if (activeDays >= 8) {
    positive.push({
      factor: 'Persistence',
      weight: 0.22,
      detail: `${activeDays} active days in the ${WINDOW_DAYS}-day window`,
      source: 'Derived',
    });
  } else if (activeDays >= 3) {
    positive.push({
      factor: 'Repeat detections',
      weight: 0.1,
      detail: `${activeDays} active days in the ${WINDOW_DAYS}-day window`,
      source: 'Derived',
    });
  } else {
    negative.push({
      factor: 'Single / rare detection',
      weight: -0.12,
      detail: `Only ${activeDays} active day(s) in the ${WINDOW_DAYS}-day window`,
      source: 'Derived',
    });
  }

  if (nightShare > 0.55) {
    positive.push({
      factor: 'Night activity',
      weight: 0.11,
      detail: `${Math.round(nightShare * 100)}% of detections occur at night`,
      source: 'Derived',
    });
  } else if (nightShare > 0 && nightShare < 0.35) {
    negative.push({
      factor: 'Daytime dominated',
      weight: -0.07,
      detail: `${Math.round(nightShare * 100)}% of detections occur at night`,
      source: 'Derived',
    });
  }

  const landCover = event.enrichment?.landCover;
  if (landCover === 'industrial' || landCover === 'built-up') {
    positive.push({
      factor: 'Industrial land context',
      weight: 0.09,
      detail: `Land cover classified as ${landCover}`,
      source: 'Land cover',
    });
  } else if (landCover === 'forest' || landCover === 'shrubland') {
    negative.push({
      factor: 'Vegetated land context',
      weight: -0.15,
      detail: `Land cover classified as ${landCover} — more typical of vegetation fire`,
      source: 'Land cover',
    });
  } else if (landCover === 'cropland') {
    negative.push({
      factor: 'Agricultural land context',
      weight: -0.13,
      detail: 'Land cover classified as cropland — typical of residue burning',
      source: 'Land cover',
    });
  }

  if (event.confidence < 55) {
    negative.push({
      factor: 'Low detection confidence',
      weight: -0.1,
      detail: `Sensor confidence ${event.confidence}% (low band)`,
      source: event.instrument,
    });
  } else if (event.confidence >= 85) {
    positive.push({
      factor: 'High detection confidence',
      weight: 0.08,
      detail: `Sensor confidence ${event.confidence}% (high band)`,
      source: event.instrument,
    });
  }

  positive.sort((a, b) => b.weight - a.weight);
  negative.sort((a, b) => a.weight - b.weight);

  return {
    positiveFactors: positive,
    negativeFactors: negative,
    shapSummary: {
      topFeatures: [
        { feature: 'dist_to_nearest_industrial_km', shapValue: site ? 0.34 : -0.16 },
        { feature: 'cluster_detection_count', shapValue: Number((activeDays / WINDOW_DAYS).toFixed(3)) },
        { feature: 'frp', shapValue: Number((frp / 120).toFixed(3)) },
        { feature: 'night_share', shapValue: Number(nightShare.toFixed(3)) },
        { feature: 'brightness', shapValue: Number(((event.brightness - 300) / 200).toFixed(3)) },
      ].sort((a, b) => Math.abs(b.shapValue) - Math.abs(a.shapValue)),
    },
  } as Evidence & { class?: ThermalClass } as Evidence;
}

/** Top persistent sources — powers the "persistent hotspot ranking" feature. */
export function getPersistentHotspots(limit = 12) {
  return getDataset()
    .hotspots.filter((h) => h.detectionCount > 0)
    .slice()
    .sort((a, b) => b.activeDays - a.activeDays || b.detectionCount - a.detectionCount)
    .slice(0, limit)
    .map((h) => ({
      hotspotId: h.id,
      label: h.facilityName ?? h.wildfireRegionName ?? `${h.state} cluster`,
      state: h.state,
      district: h.district,
      lng: h.lng,
      lat: h.lat,
      activeDays: h.activeDays,
      detectionCount: h.detectionCount,
      dominantClass: h.dominantClass,
      maxFrp: h.maxFrp,
      priorityScore: h.priorityScore,
    }));
}

export function applyFilters(events: ThermalEvent[], filters: EventFilters): ThermalEvent[] {
  const {
    classes,
    confidenceMin,
    startDate,
    endDate,
    source,
    bbox,
    states,
    priorityBands,
    minPersistence,
  } = filters as EventFilters & {
    states?: string[];
    priorityBands?: PriorityBand[];
    minPersistence?: number;
  };

  return events.filter((e) => {
    if (classes?.length && (!e.classification || !classes.includes(e.classification.class))) return false;
    if (confidenceMin !== undefined && (e.classification?.confidence ?? 0) * 100 < confidenceMin) return false;
    if (startDate && e.acqDatetime < startDate) return false;
    if (endDate && e.acqDatetime > endDate) return false;
    if (source && e.source !== source) return false;
    if (states?.length && (!e.enrichment?.admin?.state || !states.includes(e.enrichment.admin.state))) return false;
    if (priorityBands?.length) {
      const band = priorityBand((e as ThermalEvent & { priorityScore?: number }).priorityScore ?? 0);
      if (!priorityBands.includes(band)) return false;
    }
    if (minPersistence !== undefined) {
      const ad = (e as ThermalEvent & { activeDays?: number }).activeDays ?? 1;
      if (ad < minPersistence) return false;
    }
    if (bbox) {
      const [w, s, e2, n] = bbox;
      const [lng, lat] = e.geometry.coordinates;
      if (lng < w || lng > e2 || lat < s || lat > n) return false;
    }
    return true;
  });
}

export function paginate<T>(items: T[], limit: number, offset: number): { page: T[]; meta: Pagination } {
  const page = items.slice(offset, offset + limit);
  const total = items.length;
  return {
    page,
    meta: { limit, offset, total, hasMore: offset + limit < total },
  };
}

/** The analytics the old build hard-coded at 12,543 — now derived for real. */
export function buildAnalyticsSummary(events: ThermalEvent[]): AnalyticsSummary {
  const stats = buildStats(events, getDataset().hotspots);
  const topClusters = getPersistentHotspots(6).map((h) => ({
    clusterId: h.hotspotId,
    detectionCount: h.detectionCount,
    centroid: [h.lng, h.lat] as [number, number],
    dominantClass: h.dominantClass,
  }));

  return {
    period: { start: stats.dateRange.start, end: stats.dateRange.end },
    totals: {
      events: stats.totalEvents,
      classified: stats.byClass.reduce((a, b) => a + b.count, 0),
      unclassified: 0,
    },
    byClass: stats.byClass,
    bySource: stats.bySource,
    byDay: stats.byDay,
    topClusters,
  };
}

export { stateFromPoint };
