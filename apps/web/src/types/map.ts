export interface MapConfig {
  container: HTMLElement | null;
  style: string;
  center: [number, number];
  zoom: number;
  pitch?: number;
  bearing?: number;
  minZoom?: number;
  maxZoom?: number;
}

export interface MapViewState {
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
  bounds: [number, number, number, number];
}

export interface LayerConfig {
  id: string;
  visible: boolean;
  opacity: number;
}

export interface ClusterOptions {
  radius: number;
  maxZoom: number;
  minPoints: number;
}

export const DEFAULT_MAP_CONFIG: MapConfig = {
  container: null,
  style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  center: [78, 22],
  zoom: 5,
  pitch: 0,
  bearing: 0,
  minZoom: 2,
  maxZoom: 18,
};

export const INDIA_BOUNDS: [number, number, number, number] = [68, 6, 98, 38];

export const SEVERITY_COLORS: Record<string, string> = {
  industrial_fire: '#EF4444',
  persistent_thermal_source: '#F97316',
  natural_wildfire: '#FACC15',
  other: '#64748B',
};

export const SEVERITY_GLOW: Record<string, string> = {
  industrial_fire: 'rgba(239, 68, 68, 0.3)',
  persistent_thermal_source: 'rgba(249, 115, 22, 0.3)',
  natural_wildfire: 'rgba(250, 204, 21, 0.2)',
  other: 'rgba(100, 116, 139, 0.15)',
};
