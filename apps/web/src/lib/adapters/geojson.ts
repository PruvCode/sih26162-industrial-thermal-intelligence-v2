/**
 * ThermalEvent[] → GeoJSON adapter.
 *
 * The map consumes the adapter output, never the domain objects directly.
 * That is what lets the same map code render the seeded demo dataset today and
 * a real `/events` GeoJSON response tomorrow without touching a component.
 *
 * `promoteId: 'id'` on the source is what makes `setFeatureState` work, so
 * `id` must be present as a top-level *feature property* here.
 */

import type { ThermalEvent, EventGeoJSON, EventGeoJSONFeature } from '@/types/event';
import type { DensityCell } from '@/types/intelligence';
import type { IndustrialFacility } from '@/data/regions';
import { eventActiveDays, eventClass, eventConfidence, eventPriorityBand, eventPriorityScore } from '@/data/derive';

export function eventsToGeoJSON(events: ThermalEvent[]): EventGeoJSON {
  const features: EventGeoJSONFeature[] = events.map((event) => {
    const cls = eventClass(event);
    return {
      type: 'Feature',
      id: event.id,
      geometry: event.geometry,
      properties: {
        id: event.id,
        // Normalised 0..1 intensity used by the paint expressions. FRP is the
        // physically meaningful signal; brightness is the fallback for MODIS
        // records that do not carry it.
        frp: event.frp ?? 0,
        intensity: intensityNorm(event),
        brightness: event.brightness,
        confidence: eventConfidence(event),
        acqDatetime: event.acqDatetime,
        satellite: event.satellite,
        class: cls,
        classConfidence: eventConfidence(event),
        priority: eventPriorityScore(event),
        priorityBand: eventPriorityBand(event),
        activeDays: eventActiveDays(event),
        clusterId: event.clusterId ?? undefined,
        state: event.enrichment?.admin?.state ?? 'Unassigned',
        district: event.enrichment?.admin?.district ?? '',
        facility: event.enrichment?.nearestIndustrialSite?.name ?? '',
      },
    };
  });

  return { type: 'FeatureCollection', features };
}

/**
 * Fire radiative power normalised to 0..1 on a log scale.
 *
 * FRP across the dataset spans ~0.5–120 MW with a heavy low tail; a linear map
 * would render everything except the top few events as identical dots.
 */
export function intensityNorm(event: ThermalEvent): number {
  const frp = Math.max(0.2, event.frp ?? 0);
  const t = Math.log10(frp / 0.2) / Math.log10(120 / 0.2);
  return Math.min(1, Math.max(0, Number(t.toFixed(3))));
}

export function facilitiesToGeoJSON(facilities: IndustrialFacility[]) {
  return {
    type: 'FeatureCollection' as const,
    features: facilities.map((f) => ({
      type: 'Feature' as const,
      id: f.id,
      geometry: { type: 'Point' as const, coordinates: [f.lng, f.lat] },
      properties: {
        id: f.id,
        name: f.name,
        type: f.type,
        state: f.state,
        profile: f.profile,
      },
    })),
  };
}

/**
 * Density cells → GeoJSON for the heatmap layer.
 *
 * `weight` is what MapLibre's `heatmap-weight` reads. Count alone makes the
 * surface look busy in rural areas where a single source repeats; weighting by
 * mean radiative power makes genuinely energetic clusters read hotter.
 */
export function densityToGeoJSON(cells: DensityCell[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: cells.map((c, i) => ({
      type: 'Feature' as const,
      id: i,
      geometry: { type: 'Point' as const, coordinates: [c.lng, c.lat] },
      properties: {
        count: c.count,
        meanFrp: c.meanFrp,
        dominantClass: c.dominantClass,
        weight: Math.min(1, Math.log10(1 + c.count) / 2 + (c.meanFrp > 12 ? 0.18 : 0)),
      },
    })),
  };
}

/**
 * Minimal India + neighbours administrative outline.
 *
 * Deliberately coarse: this is present to give the operational map a sense of
 * national boundaries when the "Administrative boundaries" layer is on, and to
 * keep the product usable when the CDN basemap is unavailable. It is a
 * low-resolution outline, not a survey-grade boundary — the About panel says so.
 */
export const INDIA_OUTLINE: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'India', kind: 'country', primary: true },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [68.1, 23.9], [68.9, 22.3], [70.0, 22.9], [70.9, 22.1], [72.4, 21.4],
            [72.7, 19.6], [73.5, 18.2], [74.8, 16.3], [76.1, 14.8], [77.2, 12.5],
            [77.9, 10.3], [78.9, 9.1], [79.9, 10.4], [80.2, 13.1], [81.4, 16.3],
            [83.0, 17.5], [84.6, 19.3], [86.4, 20.4], [88.1, 21.7], [89.2, 22.1],
            [90.4, 23.3], [91.7, 23.0], [92.5, 24.1], [93.2, 25.4], [94.4, 26.4],
            [95.3, 27.0], [96.4, 28.1], [97.0, 28.4], [96.1, 29.0], [95.0, 28.2],
            [94.0, 28.9], [92.6, 28.0], [91.3, 27.7], [89.9, 27.0], [88.7, 27.4],
            [88.1, 26.8], [87.3, 26.6], [86.2, 27.4], [84.9, 28.1], [83.5, 28.8],
            [81.9, 30.0], [80.3, 30.4], [79.0, 30.8], [78.0, 31.4], [76.8, 32.5],
            [75.5, 33.6], [74.2, 34.4], [73.2, 34.8], [72.6, 33.5], [71.6, 32.6],
            [70.5, 31.6], [69.5, 30.4], [68.4, 29.2], [68.0, 27.8], [68.1, 26.2],
            [68.1, 23.9],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Pakistan', kind: 'country', primary: false },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [[61.0, 25.2], [62.5, 25.2], [64.0, 25.5], [66.0, 25.6], [67.5, 24.8],
           [68.1, 23.9], [68.1, 26.2], [68.0, 27.8], [68.4, 29.2], [69.5, 30.4],
           [70.5, 31.6], [71.6, 32.6], [72.6, 33.5], [73.2, 34.8], [74.2, 34.4],
           [75.0, 36.5], [73.5, 36.9], [71.5, 36.5], [69.5, 35.5], [67.5, 34.0],
           [65.5, 32.2], [63.5, 30.5], [61.5, 28.5], [61.0, 25.2]],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Nepal', kind: 'country', primary: false },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [[80.1, 30.4], [81.9, 30.0], [83.5, 28.8], [84.9, 28.1], [86.2, 27.4],
           [87.3, 26.6], [88.1, 26.8], [88.2, 27.9], [86.5, 28.2], [84.6, 28.4],
           [82.9, 28.6], [81.4, 29.4], [80.1, 30.4]],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Bhutan', kind: 'country', primary: false },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [[88.8, 27.9], [90.0, 27.4], [91.5, 27.0], [92.1, 27.5], [91.5, 28.2],
           [90.2, 28.3], [89.1, 28.2], [88.8, 27.9]],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Bangladesh', kind: 'country', primary: false },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [[88.1, 21.7], [89.2, 22.1], [90.4, 23.3], [91.7, 23.0], [92.5, 24.1],
           [92.3, 25.1], [91.5, 26.0], [90.1, 26.0], [89.0, 25.5], [88.6, 24.6],
           [88.9, 23.6], [88.7, 22.6], [88.1, 21.7]],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Sri Lanka', kind: 'country', primary: false },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [[79.8, 9.6], [80.3, 9.0], [80.9, 8.2], [81.4, 7.2], [81.8, 6.5],
           [81.2, 6.1], [80.4, 6.4], [79.9, 7.5], [79.7, 8.6], [79.8, 9.6]],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Afghanistan', kind: 'country', primary: false },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [[60.5, 29.5], [62.5, 29.5], [64.0, 30.5], [66.0, 31.5], [67.5, 32.2],
           [69.0, 33.0], [69.5, 35.5], [67.5, 36.9], [65.0, 37.2], [62.0, 36.0],
           [60.5, 33.0], [60.5, 29.5]],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Myanmar', kind: 'country', primary: false },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [[92.5, 21.0], [93.5, 20.0], [94.5, 19.0], [95.5, 17.5], [96.5, 16.3],
           [97.5, 16.5], [98.0, 18.0], [97.5, 20.0], [97.0, 22.0], [96.5, 24.0],
           [96.0, 26.0], [95.5, 27.5], [94.5, 28.2], [93.5, 27.5], [93.0, 25.5],
           [92.8, 23.5], [92.5, 21.0]],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'China (portion)', kind: 'country', primary: false },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [[75.5, 36.5], [78.0, 36.5], [80.5, 36.0], [83.0, 36.0], [85.0, 36.5],
           [87.5, 36.5], [90.0, 36.5], [92.5, 36.5], [95.0, 37.0], [96.5, 36.0],
           [95.0, 34.5], [92.5, 33.0], [90.0, 32.0], [87.0, 31.0], [84.0, 30.5],
           [81.0, 30.5], [78.5, 31.5], [76.5, 33.0], [75.5, 35.0], [75.5, 36.5]],
        ],
      },
    },
  ],
};
