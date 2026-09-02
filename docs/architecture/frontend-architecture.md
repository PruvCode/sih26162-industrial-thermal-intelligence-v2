# Frontend Architecture — SIH26162

## Overview

A **map-first, dark-theme, analytical GIS command center** built with Next.js 14, TypeScript, Tailwind CSS, and MapLibre GL JS. Designed for intelligence analysts who need high information density, rapid investigation workflows, and presentation-ready visualizations.

## Tech Stack

| Layer | Technology | Version | Rationale |
|-------|------------|---------|-----------|
| Framework | Next.js | 14 (App Router) | SSR, RSC, Server Actions, Vercel-ready |
| Language | TypeScript | 5.x | Type safety, refactoring confidence |
| Styling | Tailwind CSS | 3.4 | Utility-first, dark mode, responsive |
| Mapping | MapLibre GL JS | 4.x | Open-source, vector tiles, no Mapbox lock-in |
| State | TanStack Query | 5.x | Server state, caching, background refetch |
| UI Primitives | Radix UI / Headless UI | Latest | Accessible, unstyled, composable |
| Charts | Recharts / Tremor | Latest | Analytical visualizations |
| Forms | React Hook Form + Zod | Latest | Type-safe validation |
| Icons | Lucide React | Latest | Clean, consistent icon set |
| Font | Geist / JetBrains Mono | - | Technical, monospace for data |

## Application Structure

```
apps/web/
├── public/
│   ├── map-styles/           # Custom MapLibre styles
│   └── icons/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx          # Root layout + providers
│   │   ├── page.tsx            # Command Center (main)
│   │   ├── globals.css         # Tailwind + custom CSS
│   │   ├── events/
│   │   │   └── [id]/
│   │   │       └── page.tsx    # Event detail page (SEO)
│   │   ├── analytics/
│   │   │   └── page.tsx        # Analytics dashboard
│   │   └── api/                # API routes (if needed)
│   ├── components/             # Shared UI components
│   │   ├── map/
│   │   │   ├── Map.tsx              # Main map component
│   │   │   ├── MapControls.tsx      # Zoom, pitch, rotate, layers
│   │   │   ├── EventLayer.tsx       # Event markers + clustering
│   │   │   ├── ClusterLayer.tsx     # Cluster circles + counts
│   │   │   ├── IndustrialLayer.tsx  # Industrial sites polygons
│   │   │   ├── HeatmapLayer.tsx     # Optional density heatmap
│   │   │   └── MapLegend.tsx        # Dynamic legend
│   │   ├── panels/
│   │   │   ├── EventListPanel.tsx   # Collapsible event list
│   │   │   ├── EventDetailDrawer.tsx # Slide-over detail
│   │   │   ├── EvidencePanel.tsx    # SHAP + rule evidence
│   │   │   ├── TimelinePanel.tsx    # Temporal replay
│   │   │   └── AnalyticsPanel.tsx   # Summary cards + charts
│   │   ├── ui/                   # Primitive components
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Slider.tsx
│   │   │   ├── Tooltip.tsx
│   │   │   ├── Dropdown.tsx
│   │   │   ├── Skeleton.tsx
│   │   │   └── ...
│   │   ├── charts/
│   │   │   ├── SeverityDistribution.tsx
│   │   │   ├── TemporalTrend.tsx
│   │   │   ├── TopClusters.tsx
│   │   │   └── ClassBreakdown.tsx
│   │   └── layout/
│   │       ├── Header.tsx
│   │       ├── Sidebar.tsx
│   │       ├── Footer.tsx
│   │       └── KeyboardShortcuts.tsx
│   ├── features/               # Feature-specific logic
│   │   ├── events/
│   │   │   ├── useEvents.ts           # TanStack Query hooks
│   │   │   ├── useEventDetails.ts
│   │   │   ├── useEventEvidence.ts
│   │   │   ├── useEventHistory.ts
│   │   │   └── useEventActions.ts     # Mutations (acknowledge, export)
│   │   ├── map/
│   │   │   ├── useMap.ts              # MapLibre instance + methods
│   │   │   ├── useMapLayers.ts        # Layer management
│   │   │   └── useMapInteractions.ts  # Click, hover, keyboard
│   │   ├── analytics/
│   │   │   ├── useAnalytics.ts
│   │   │   └── useClusterAnalytics.ts
│   │   └── websocket/
│   │       └── useWebSocket.ts        # Real-time updates
│   ├── hooks/                    # Generic reusable hooks
│   │   ├── useDebounce.ts
│   │   ├── useLocalStorage.ts
│   │   ├── useMediaQuery.ts
│   │   ├── useKeyboardShortcut.ts
│   │   └── useIntersectionObserver.ts
│   ├── lib/                      # Utilities
│   │   ├── api.ts                  # API client (fetch wrapper)
│   │   ├── map-utils.ts            # Map helpers (bounds, zoom, projection)
│   │   ├── formatters.ts           # Number, date, severity formatting
│   │   ├── severity.ts             # Severity color/class mapping
│   │   ├── geo.ts                  # GeoJSON, bbox, distance utils
│   │   └── constants.ts            # App constants
│   ├── services/                 # Business logic
│   │   ├── eventService.ts         # Event filtering, sorting, export
│   │   ├── mapService.ts           # Layer styling, clustering config
│   │   └── exportService.ts        # PDF, GeoJSON, CSV export
│   ├── types/                    # TypeScript types
│   │   ├── event.ts
│   │   ├── map.ts
│   │   ├── evidence.ts
│   │   ├── analytics.ts
│   │   └── api.ts
│   ├── styles/                   # Global styles
│   │   ├── globals.css
│   │   ├── variables.css           # CSS custom properties
│   │   ├── maplibre-overrides.css  # MapLibre customizations
│   │   └── animations.css
│   └── mocks/                    # Development mock data
│       ├── events.ts
│       ├── industrialSites.ts
│       └── analytics.ts
├── tests/
│   ├── components/               # Component tests (React Testing Library)
│   ├── features/                 # Feature hook tests
│   ├── lib/                      # Utility tests
│   └── e2e/                      # Playwright E2E tests
├── next.config.js
├── tsconfig.json
├── tailwind.config.ts
├── package.json
└── .eslintrc.json
```

## Visual Design System

### Color Palette (CSS Variables)

```css
/* apps/web/src/styles/variables.css */
:root {
  /* Base */
  --bg-primary: #020617;        /* slate-950 */
  --bg-secondary: #0f172a;      /* slate-900 */
  --bg-tertiary: #1e293b;       /* slate-800 */
  --bg-elevated: #334155;       /* slate-700 */
  
  /* Borders */
  --border-primary: #334155;    /* slate-700 */
  --border-secondary: #475569;  /* slate-600 */
  --border-focus: #0ea5e9;      /* sky-500 */
  
  /* Text */
  --text-primary: #f1f5f9;      /* slate-100 */
  --text-secondary: #cbd5e1;    /* slate-300 */
  --text-muted: #94a3b8;        /* slate-400 */
  --text-disabled: #64748b;     /* slate-500 */
  
  /* Accent */
  --accent-blue: #38bdf8;       /* sky-400 */
  --accent-blue-hover: #0ea5e9; /* sky-500 */
  --accent-green: #34d399;      /* emerald-400 */
  --accent-purple: #a78bfa;     /* violet-400 */
  
  /* Severity */
  --severity-critical: #ef4444;     /* red-500 */
  --severity-critical-bg: #7f1d1d;  /* red-900 */
  --severity-high: #f59e0b;         /* amber-500 */
  --severity-high-bg: #78350f;      /* amber-900 */
  --severity-medium: #facc15;       /* yellow-400 */
  --severity-medium-bg: #713f12;    /* yellow-900 */
  --severity-low: #64748b;          /* slate-500 */
  --severity-low-bg: #334155;       /* slate-700 */
  
  /* Map */
  --map-bg: #081020;
  --map-water: #0c1a2e;
  --map-land: #111e33;
  
  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  
  /* Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-full: 9999px;
  
  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.4);
  --shadow-lg: 0 8px 24px rgba(0,0,0,0.5);
  --shadow-glow: 0 0 20px rgba(56, 189, 248, 0.3);
  
  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-normal: 250ms ease;
  --transition-slow: 350ms ease;
}
```

### Severity Mapping

```typescript
// apps/web/src/lib/severity.ts

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low';

export const SEVERITY_CONFIG: Record<SeverityLevel, {
  label: string;
  color: string;
  bgColor: string;
  icon: string;
  order: number;
  classes: string[];  // API classes that map to this severity
}> = {
  critical: {
    label: 'Industrial Fire',
    color: 'var(--severity-critical)',
    bgColor: 'var(--severity-critical-bg)',
    icon: '🔴',
    order: 0,
    classes: ['industrial_fire']
  },
  high: {
    label: 'Persistent Source',
    color: 'var(--severity-high)',
    bgColor: 'var(--severity-high-bg)',
    icon: '🟠',
    order: 1,
    classes: ['persistent_thermal_source']
  },
  medium: {
    label: 'Wildfire',
    color: 'var(--severity-medium)',
    bgColor: 'var(--severity-medium-bg)',
    icon: '🟡',
    order: 2,
    classes: ['natural_wildfire']
  },
  low: {
    label: 'Other',
    color: 'var(--severity-low)',
    bgColor: 'var(--severity-low-bg)',
    icon: '⚪',
    order: 3,
    classes: ['other']
  }
};

export function getSeverityFromClass(className: string): SeverityLevel {
  for (const [severity, config] of Object.entries(SEVERITY_CONFIG)) {
    if (config.classes.includes(className)) {
      return severity as SeverityLevel;
    }
  }
  return 'low';
}

export function getSeverityColor(className: string): string {
  return SEVERITY_CONFIG[getSeverityFromClass(className)].color;
}
```

## Map Architecture

### MapLibre Configuration

```typescript
// apps/web/src/features/map/useMap.ts
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';

interface MapConfig {
  container: HTMLElement;
  style: string;           // MapTiler / custom style URL
  center: [number, number]; // [lng, lat]
  zoom: number;
  pitch?: number;
  bearing?: number;
}

export function useMap(config: MapConfig) {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  
  useEffect(() => {
    if (mapRef.current) return; // Already initialized
    
    const mapInstance = new maplibregl.Map({
      container: config.container,
      style: config.style,
      center: config.center,
      zoom: config.zoom,
      pitch: config.pitch ?? 0,
      bearing: config.bearing ?? 0,
      antialias: true,
      preserveDrawingBuffer: true, // For screenshot/export
      // Custom attribution
      customAttribution: [
        '© OpenStreetMap contributors',
        '© NASA FIRMS',
        '© SIH26162 Team'
      ].join(' | ')
    });
    
    // Add navigation controls
    mapInstance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    mapInstance.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right');
    
    // Keyboard navigation
    mapInstance.keyboard.enable();
    
    mapRef.current = mapInstance;
    setMap(mapInstance);
    
    return () => {
      mapInstance.remove();
      mapRef.current = null;
      setMap(null);
    };
  }, [config.container, config.style, config.center, config.zoom]);
  
  return map;
}
```

### Layer Management

```typescript
// apps/web/src/features/map/useMapLayers.ts
import { Map } from 'maplibre-gl';
import { EventGeoJSON, IndustrialSiteGeoJSON } from '@/types/map';

interface LayerConfig {
  map: Map;
  events: EventGeoJSON;
  industrialSites: IndustrialSiteGeoJSON;
  selectedEventId?: string;
  filters: EventFilters;
}

export function useMapLayers(config: LayerConfig) {
  const { map, events, industrialSites, selectedEventId, filters } = config;
  
  useEffect(() => {
    if (!map.loaded()) return;
    
    // 1. Industrial Sites (bottom layer)
    upsertLayer(map, {
      id: 'industrial-sites',
      type: 'fill',
      source: 'industrial-sites',
      data: industrialSites,
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': 0.15,
        'fill-outline-color': ['get', 'color']
      }
    });
    
    // 2. Event Clusters (zoom < 12)
    upsertLayer(map, {
      id: 'event-clusters',
      type: 'circle',
      source: 'events',
      filter: ['all', ['<', 'zoom', 12], ['!', ['has', 'point_count']]],
      paint: {
        'circle-radius': ['step', ['get', 'point_count'], 20, 10, 30, 100, 40],
        'circle-color': ['step', ['get', 'point_count'], '#38bdf8', 10, '#f59e0b', 100, '#ef4444'],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
      }
    });
    
    // 3. Cluster Count Labels
    upsertLayer(map, {
      id: 'event-cluster-labels',
      type: 'symbol',
      source: 'events',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
        'text-size': 12
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': '#000000',
        'text-halo-width': 1
      }
    });
    
    // 4. Individual Events (zoom >= 12)
    upsertLayer(map, {
      id: 'events',
      type: 'circle',
      source: 'events',
      filter: ['all', ['>=', 'zoom', 12], ['!', ['has', 'point_count']]],
      paint: {
        'circle-radius': [
          'interpolate', ['linear'], ['zoom'],
          12, 6,
          16, 10,
          20, 14
        ],
        'circle-color': [
          'match',
          ['get', 'classification'],
          'industrial_fire', '#ef4444',
          'persistent_thermal_source', '#f59e0b',
          'natural_wildfire', '#facc15',
          '#64748b'
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
        'circle-opacity': [
          'case',
          ['==', ['get', 'id'], selectedEventId], 1.0,
          0.85
        ]
      }
    });
    
    // 5. Selected Event Halo
    if (selectedEventId) {
      upsertLayer(map, {
        id: 'selected-event-halo',
        type: 'circle',
        source: 'events',
        filter: ['all', ['==', 'id', selectedEventId], ['!', ['has', 'point_count']]],
        paint: {
          'circle-radius': 18,
          'circle-color': '#38bdf8',
          'circle-opacity': 0.3,
          'circle-blur': 0.5
        }
      });
    }
    
    // 6. Heatmap (optional, toggleable)
    if (filters.showHeatmap) {
      upsertLayer(map, {
        id: 'events-heatmap',
        type: 'heatmap',
        source: 'events',
        maxzoom: 12,
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'brightness'], 300, 0, 400, 1],
          'heatmap-intensity': 1,
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(56,189,248,0)',
            0.3, 'rgb(56,189,248)',
            0.6, 'rgb(245,158,11)',
            1, 'rgb(239,68,68)'
          ],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 10, 12, 30]
        }
      });
    } else {
      removeLayer(map, 'events-heatmap');
    }
    
  }, [map, events, industrialSites, selectedEventId, filters]);
  
  return { refresh: () => {/* trigger re-render */} };
}

function upsertLayer(map: Map, layer: maplibregl.Layer) {
  if (map.getLayer(layer.id)) {
    // Update paint/layout
    Object.entries(layer.paint || {}).forEach(([key, value]) => {
      map.setPaintProperty(layer.id, key, value);
    });
    Object.entries(layer.layout || {}).forEach(([key, value]) => {
      map.setLayoutProperty(layer.id, key, value);
    });
  } else {
    map.addLayer(layer);
  }
}

function removeLayer(map: Map, id: string) {
  if (map.getLayer(id)) map.removeLayer(id);
  if (map.getSource(id)) map.removeSource(id);
}
```

### Clustering (Supercluster)

```typescript
// apps/web/src/lib/map-utils.ts
import Supercluster from 'supercluster';

export function clusterEvents(
  events: EventGeoJSON['features'],
  options: { radius?: number; maxZoom?: number; minZoom?: number } = {}
): GeoJSON.FeatureCollection {
  const index = new Supercluster({
    radius: options.radius ?? 60,
    maxZoom: options.maxZoom ?? 16,
    minZoom: options.minZoom ?? 0,
    extent: 512,
    nodeSize: 64
  });
  
  const points = events.map((feature, i) => ({
    type: 'Feature' as const,
    id: i,
    geometry: feature.geometry,
    properties: {
      ...feature.properties,
      cluster_id: feature.properties.cluster_id
    }
  }));
  
  index.load(points);
  
  // Get clusters for current viewport zoom
  const clusters = index.getClusters([-180, -90, 180, 90], Math.floor(map.getZoom()));
  
  return {
    type: 'FeatureCollection',
    features: clusters.map(cluster => {
      if (cluster.properties.cluster) {
        // Cluster
        return {
          ...cluster,
          properties: {
            ...cluster.properties,
            point_count_abbreviated: abbreviateNumber(cluster.properties.point_count)
          }
        };
      }
      // Individual point
      return cluster;
    })
  };
}

function abbreviateNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}
```

## Component Architecture

### Command Center Layout

```tsx
// apps/web/src/app/page.tsx
'use client';

import { useState } from 'react';
import { Map } from '@/components/map/Map';
import { EventListPanel } from '@/components/panels/EventListPanel';
import { EventDetailDrawer } from '@/components/panels/EventDetailDrawer';
import { EvidencePanel } from '@/components/panels/EvidencePanel';
import { TimelinePanel } from '@/components/panels/TimelinePanel';
import { AnalyticsPanel } from '@/components/panels/AnalyticsPanel';
import { Header } from '@/components/layout/Header';
import { KeyboardShortcuts } from '@/components/layout/KeyboardShortcuts';
import { useEvents } from '@/features/events/useEvents';
import { useMap } from '@/features/map/useMap';
import { mapRef } from '@/lib/map-utils';

export default function CommandCenter() {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<'list' | 'evidence' | 'timeline' | 'analytics'>('list');
  const [bbox, setBbox] = useState<[number, number, number, number]>([68, 6, 98, 38]); // India
  
  const { data: events, isLoading, refetch } = useEvents({ bbox, limit: 1000 });
  const map = useMap({ container: mapRef.current!, style: MAP_STYLE_URL, center: [78, 22], zoom: 5 });
  
  // Handle map move → update bbox → refetch
  useEffect(() => {
    if (!map) return;
    const handleMove = () => {
      const bounds = map.getBounds();
      setBbox([bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()]);
    };
    map.on('moveend', handleMove);
    return () => map.off('moveend', handleMove);
  }, [map]);
  
  return (
    <div className="h-screen w-full flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <Header 
        onRefresh={refetch} 
        isLoading={isLoading}
        activePanel={activePanel}
        setActivePanel={setActivePanel}
      />
      
      <div className="flex-1 flex overflow-hidden relative">
        {/* Map - Full screen */}
        <Map
          ref={mapRef}
          events={events}
          selectedEventId={selectedEventId}
          onEventClick={setSelectedEventId}
          onMapClick={() => setSelectedEventId(null)}
        />
        
        {/* Side Panels - Overlay on map */}
        <div className="absolute inset-0 pointer-events-none flex">
          {/* Left: Event List / Evidence / Timeline */}
          <div className="w-80 md:w-96 flex flex-col pointer-events-auto">
            {activePanel === 'list' && (
              <EventListPanel 
                events={events?.features || []}
                selectedId={selectedEventId}
                onSelect={setSelectedEventId}
              />
            )}
            {activePanel === 'evidence' && selectedEventId && (
              <EvidencePanel eventId={selectedEventId} onClose={() => setActivePanel('list')} />
            )}
            {activePanel === 'timeline' && selectedEventId && (
              <TimelinePanel eventId={selectedEventId} onClose={() => setActivePanel('list')} />
            )}
          </div>
          
          {/* Right: Analytics */}
          <div className="w-72 flex flex-col pointer-events-auto ml-auto">
            <AnalyticsPanel />
          </div>
        </div>
        
        {/* Map Controls */}
        <div className="absolute bottom-4 right-4 pointer-events-auto z-10">
          <MapControls />
        </div>
      </div>
      
      <KeyboardShortcuts />
      <Footer />
    </div>
  );
}
```

### Evidence Panel (SHAP Waterfall)

```tsx
// apps/web/src/components/panels/EvidencePanel.tsx
'use client';

import { useEventEvidence } from '@/features/events/useEventEvidence';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface EvidencePanelProps {
  eventId: string;
  onClose: () => void;
}

export function EvidencePanel({ eventId, onClose }: EvidencePanelProps) {
  const { data: evidence, isLoading } = useEventEvidence(eventId);
  const severity = evidence?.predicted_class ? getSeverityFromClass(evidence.predicted_class) : 'low';
  const config = SEVERITY_CONFIG[severity];
  
  if (isLoading) return <EvidenceSkeleton />;
  
  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-[var(--border-primary)]">
        <div className="flex items-center gap-3">
          <Badge variant={severity}>{config.label}</Badge>
          <span className="text-sm text-[var(--text-muted)]">Confidence: {(evidence?.confidence * 100).toFixed(0)}%</span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-[var(--bg-tertiary)] rounded">✕</button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Positive Factors */}
        <section>
          <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--accent-green)]"></span>
            Supporting Evidence
          </h4>
          <div className="space-y-2">
            {evidence?.positive_factors?.map((factor, i) => (
              <EvidenceFactorRow key={i} factor={factor} positive />
            ))}
          </div>
        </section>
        
        {/* Negative Factors */}
        {evidence?.negative_factors?.length > 0 && (
          <section>
            <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--severity-critical)]"></span>
              Contradicting Evidence
            </h4>
            <div className="space-y-2">
              {evidence?.negative_factors?.map((factor, i) => (
                <EvidenceFactorRow key={i} factor={factor} positive={false} />
              ))}
            </div>
          </section>
        )}
        
        {/* SHAP Waterfall Chart */}
        {evidence?.shap_summary?.top_features && (
          <section>
            <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
              Feature Impact (SHAP)
            </h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={evidence.shap_summary.top_features
                    .filter(f => f.shap_value !== 0)
                    .sort((a, b) => Math.abs(b.shap_value) - Math.abs(a.shap_value))
                    .slice(0, 10)
                    .reverse()
                    .map(f => ({ name: formatFeatureName(f.feature), value: f.shap_value }))}
                  layout="vertical"
                >
                  <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" width={160} tick={{ fill: 'var(--text-primary)', fontSize: 10 }} />
                  <Tooltip 
                    formatter={(value: number) => [value.toFixed(4), 'SHAP value']}
                    contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
                  />
                  <Bar 
                    dataKey="value" 
                    radius={[0, 4, 4, 0]}
                    fill={(props) => props.payload.value > 0 ? 'var(--accent-green)' : 'var(--severity-critical)'}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}
      </div>
    </Card>
  );
}

function EvidenceFactorRow({ factor, positive }: { factor: any; positive: boolean }) {
  const width = Math.min(Math.abs(factor.weight) * 100, 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="font-medium">{factor.factor.replace(/_/g, ' ')}</span>
        <span className="text-[var(--text-muted)]">{factor.detail}</span>
      </div>
      <div className="h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
        <div 
          className="h-full rounded-full transition-all duration-300"
          style={{ 
            width: `${width}%`,
            backgroundColor: positive ? 'var(--accent-green)' : 'var(--severity-critical)'
          }}
        />
      </div>
    </div>
  );
}
```

## Real-time Updates (WebSocket)

```typescript
// apps/web/src/features/websocket/useWebSocket.ts
import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface WSMessage {
  type: 'event_new' | 'event_classified' | 'analytics_update';
  payload: any;
}

export function useWebSocket(url: string) {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    
    const ws = new WebSocket(url);
    wsRef.current = ws;
    
    ws.onopen = () => {
      console.log('[WS] Connected');
    };
    
    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        handleMessage(msg);
      } catch (e) {
        console.error('[WS] Parse error', e);
      }
    };
    
    ws.onclose = () => {
      console.log('[WS] Disconnected, reconnecting in 5s...');
      reconnectTimeoutRef.current = setTimeout(connect, 5000);
    };
    
    ws.onerror = (err) => {
      console.error('[WS] Error', err);
    };
  }, [url]);
  
  const handleMessage = (msg: WSMessage) => {
    switch (msg.type) {
      case 'event_new':
        queryClient.setQueryData(['events', 'all'], (old: any) => {
          if (!old) return old;
          return {
            ...old,
            features: [msg.payload, ...old.features.slice(0, 999)]
          };
        });
        break;
        
      case 'event_classified':
        queryClient.setQueryData(['event', msg.payload.event_id], (old: any) => ({
          ...old,
          classification: msg.payload
        }));
        queryClient.invalidateQueries({ queryKey: ['events'] });
        break;
        
      case 'analytics_update':
        queryClient.setQueryData(['analytics', 'summary'], msg.payload);
        break;
    }
  };
  
  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      clearTimeout(reconnectTimeoutRef.current);
    };
  }, [connect]);
  
  const send = useCallback((msg: any) => {
    wsRef.current?.send(JSON.stringify(msg));
  }, []);
  
  return { send, isConnected: wsRef.current?.readyState === WebSocket.OPEN };
}
```

## Keyboard Shortcuts

```typescript
// apps/web/src/components/layout/KeyboardShortcuts.tsx
'use client';

import { useEffect } from 'react';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';
import { useMap } from '@/features/map/useMap';

export function KeyboardShortcuts() {
  const map = useMap({ container: null, style: '', center: [0,0], zoom: 0 }); // Get from context
  
  // Navigation
  useKeyboardShortcut('ArrowUp', () => map?.panBy([0, -100]), { target: 'map' });
  useKeyboardShortcut('ArrowDown', () => map?.panBy([0, 100]), { target: 'map' });
  useKeyboardShortcut('ArrowLeft', () => map?.panBy([-100, 0]), { target: 'map' });
  useKeyboardShortcut('ArrowRight', () => map?.panBy([100, 0]), { target: 'map' });
  useKeyboardShortcut('+', () => map?.zoomIn(), { target: 'map' });
  useKeyboardShortcut('-', () => map?.zoomOut(), { target: 'map' });
  useKeyboardShortcut('0', () => map?.setZoom(5), { target: 'map' });
  
  // Panels
  useKeyboardShortcut('1', () => setActivePanel('list'));
  useKeyboardShortcut('2', () => setActivePanel('evidence'));
  useKeyboardShortcut('3', () => setActivePanel('timeline'));
  useKeyboardShortcut('4', () => setActivePanel('analytics'));
  useKeyboardShortcut('Escape', () => { setSelectedEventId(null); setActivePanel('list'); });
  
  // Event actions
  useKeyboardShortcut('e', () => exportEvent(selectedEventId));
  useKeyboardShortcut('c', () => copyEventCoords(selectedEventId));
  
  return null; // Renders nothing, just registers shortcuts
}
```

## Performance Optimizations

| Technique | Implementation |
|-----------|----------------|
| **Virtualized Event List** | `@tanstack/react-virtual` for 1000+ events |
| **Map Layer Memoization** | `React.memo` + `useMemo` for layer configs |
| **Code Splitting** | Dynamic imports for heavy panels (Evidence, Timeline, Analytics) |
| **Image Optimization** | Next.js Image for satellite thumbnails |
| **Bundle Analysis** | `@next/bundle-analyzer` in CI |
| **Map Source Updates** | Batch GeoJSON updates, avoid re-creating sources |

## Accessibility

- Semantic HTML landmarks (`<main>`, `<nav>`, `<aside>`, `<section>`)
- ARIA labels on all interactive map controls
- Focus management for drawers/modals
- High contrast mode support (`prefers-contrast: more`)
- Reduced motion support (`prefers-reduced-motion: reduce`)
- Keyboard navigation for all features
- Screen reader announcements for live updates

## Testing Strategy

```typescript
// tests/components/EvidencePanel.test.tsx
import { render, screen } from '@testing-library/react';
import { EvidencePanel } from '@/components/panels/EvidencePanel';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

describe('EvidencePanel', () => {
  it('renders positive factors with correct weights', () => {
    const mockEvidence = {
      predicted_class: 'industrial_fire',
      confidence: 0.92,
      positive_factors: [
        { factor: 'proximity_to_industrial', weight: 0.35, detail: '0.8km from chemical plant', source: 'rule' }
      ],
      negative_factors: [],
      shap_summary: { top_features: [] }
    };
    
    renderWithProviders(<EvidencePanel eventId="test" onClose={jest.fn()} />, { evidence: mockEvidence });
    
    expect(screen.getByText('Supporting Evidence')).toBeInTheDocument();
    expect(screen.getByText('proximity to industrial')).toBeInTheDocument();
    expect(screen.getByText('0.8km from chemical plant')).toBeInTheDocument();
  });
});
```

## Deployment

```dockerfile
# apps/web/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
```

```yaml
# next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons']
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.maptiler.com' },
      { protocol: 'https', hostname: '**.tiles.mapbox.com' }
    ]
  },
  webpack: (config) => {
    config.externals.push('canvas'); // For maplibre-gl
    return config;
  }
};

module.exports = nextConfig;
```

## Related Documents
- [System Architecture](system-architecture.md)
- [API Architecture](../api/README.md)
- [UI Components](../apps/web/src/components/)
- [MapLibre Style Specification](https://maplibre.org/maplibre-gl-js-docs/style-spec/)