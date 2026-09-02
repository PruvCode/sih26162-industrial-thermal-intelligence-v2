# ADR-004: MapLibre GL JS for Frontend Mapping

## Status
Accepted

## Context
We need a web mapping library for the GIS command center. Requirements:
- High-performance rendering (1000+ points, polygons)
- Vector tile support
- Open source (no vendor lock-in)
- TypeScript support
- React integration
- Custom styling

## Decision
Use **MapLibre GL JS v4** as the mapping library.

## Consequences

### Positive
- **Open source**: Fork of Mapbox GL JS v1 (before BSL license change)
- **Performance**: WebGL rendering, 60fps with thousands of features
- **Vector tiles**: Native MVT support, efficient over wire
- **Style spec**: Full Mapbox Style Spec compliance
- **React integration**: Works well with `react-map-gl` or native wrapper
- **No token required**: Can use free OSM tiles (OpenMapTiles, MapTiler free tier)
- **Active community**: MapLibre organization, regular releases

### Negative
- **Smaller ecosystem**: Fewer plugins than Mapbox
- **Documentation**: Good but not as extensive as Mapbox
- **Migration**: If team knows Mapbox GL JS v1, easy; if v2+, some API differences

### Neutral
- **Alternatives considered**:
  - **Mapbox GL JS v2+**: BSL license, requires token, vendor lock-in → Rejected
  - **Leaflet**: Raster tiles only, slower for dynamic data, no 3D → Rejected
  - **OpenLayers**: Powerful but heavier API, Canvas/WebGL hybrid → Rejected
  - **Deck.gl**: Great for analytics layers, but more complex for base map → Could complement
  - **CesiumJS**: 3D globe, overkill for 2D command center → Rejected

## Implementation

### Base Map Style
```json
// Custom style hosted on MapTiler Cloud or self-hosted
{
  "version": 8,
  "name": "SIH26162 Dark",
  "sources": {
    "osm": {
      "type": "vector",
      "url": "maptiler://tiles/openmaptiles/{z}/{x}/{y}.pbf"
    }
  },
  "layers": [
    {
      "id": "background",
      "type": "background",
      "paint": { "background-color": "#020617" }
    },
    // Water, land, roads, labels from OpenMapTiles
    // Custom layers added at runtime via JS API
  ]
}
```

### React Integration
```tsx
// apps/web/src/components/map/Map.tsx
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';

export function Map({ events, onEventClick, selectedId }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map>();

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: process.env.NEXT_PUBLIC_MAP_STYLE_URL,
      center: [78, 22], // India center
      zoom: 5,
      antialias: true
    });
    
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    mapRef.current = map;
    
    return () => { map.remove(); mapRef.current = null; };
  }, []);
  
  // Layer updates in separate effect
  useEffect(() => {
    if (!mapRef.current?.loaded()) return;
    updateEventLayer(mapRef.current, events, selectedId);
  }, [events, selectedId]);
  
  return <div ref={containerRef} className="w-full h-full" />;
}
```

## Related
- ADR-006: Next.js frontend (hosts the map)
- Frontend Architecture: `docs/architecture/frontend-architecture.md`
- Map Components: `apps/web/src/components/map/`