import type { ThermalEvent, EventGeoJSON } from '@/types/event';
import type { IndustrialSite, IndustrialGeoJSON } from '@/types/event';

export function eventsToGeoJSON(events: ThermalEvent[]): EventGeoJSON {
  return {
    type: 'FeatureCollection',
    features: events.map((event) => ({
      type: 'Feature',
      id: event.id,
      geometry: event.geometry,
      properties: {
        id: event.id,
        brightness: event.brightness,
        confidence: event.confidence,
        acqDatetime: event.acqDatetime,
        satellite: event.satellite,
        class: event.classification?.class,
        classConfidence: event.classification?.confidence,
        clusterId: event.clusterId,
      },
    })),
  };
}

export function sitesToGeoJSON(sites: IndustrialSite[]): IndustrialGeoJSON {
  return {
    type: 'FeatureCollection',
    features: sites.map((site) => ({
      type: 'Feature',
      id: site.id,
      geometry: site.geometry,
      properties: {
        id: site.id,
        name: site.name,
        industrialType: site.industrialType,
        color: getSiteColor(site.industrialType),
      },
    })),
  };
}

function getSiteColor(type: string): string {
  const colors: Record<string, string> = {
    flare: '#f59e0b',
    refinery: '#ef4444',
    chemical: '#a78bfa',
    steel: '#64748b',
    power_plant_coal: '#f97316',
    power_plant_gas: '#38bdf8',
    cement: '#78716c',
    high_temp_process: '#ef4444',
    aluminum: '#94a3b8',
    extractive: '#64748b',
    industrial_area: 'rgba(100, 116, 139, 0.4)',
  };
  return colors[type] || '#64748b';
}

export function getBoundsFromEvents(events: ThermalEvent[]): [number, number, number, number] | null {
  if (events.length === 0) return null;

  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  for (const event of events) {
    const [lng, lat] = event.geometry.coordinates as [number, number];
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
  }

  const padding = 0.5;
  return [minLng - padding, minLat - padding, maxLng + padding, maxLat + padding];
}

export function abbreviateNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}
