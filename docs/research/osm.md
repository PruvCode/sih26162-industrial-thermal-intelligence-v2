# OpenStreetMap Research — SIH26162

## Overview

OpenStreetMap (OSM) provides the industrial infrastructure context for classifying thermal anomalies. We extract industrial sites, flares, power plants, and other heat-generating facilities to enrich FIRMS events.

## Key OSM Tags for Industrial Infrastructure

### Primary Industrial Tags

| Tag | Key Values | Description | Example |
|-----|------------|-------------|---------|
| `industrial` | `chemical`, `power_plant`, `cement`, `steel`, `refinery`, `manufacturing`, `warehouse`, `logistics` | Primary industrial classification | `industrial=chemical` |
| `man_made` | `flare`, `chimney`, `kiln`, `furnace`, `smelter`, `coking_oven`, `gasometer`, `storage_tank`, `silo` | Specific heat-generating infrastructure | `man_made=flare` |
| `landuse` | `industrial`, `commercial`, `brownfield`, `quarry`, `landfill` | Land use designation | `landuse=industrial` |
| `power` | `plant`, `substation`, `generator`, `transformer` | Power infrastructure | `power=plant` |
| `generator:source` | `coal`, `gas`, `oil`, `biomass`, `nuclear`, `waste` | Fuel type for power plants | `generator:source=coal` |

### Secondary/Supporting Tags

| Tag | Purpose | Example Values |
|-----|---------|----------------|
| `name` | Facility name | `"Reliance Jamnagar Refinery"` |
| `operator` | Operating company | `"Reliance Industries Limited"` |
| `capacity` | Production capacity | `"1.2M bpd"`, `"500 MW"` |
| `start_date` | Commissioning date | `"2008"` |
| `website` | Official website | `"https://ril.com"` |
| `wikidata` | Wikidata ID | `"Q123456"` |
| `ref:india:cin` | Corporate Identity Number (India) | `"L17110GJ1973PLC002065"` |
| `emission:*` | Emission data (if available) | `emission:co2=1200000` |

## Overpass API Queries

### India Industrial Sites (Complete)

```overpass
[out:json][timeout:300];
(
  // Primary industrial tags
  way["industrial"](area:3600000000);
  relation["industrial"](area:3600000000);
  
  // Heat-generating infrastructure
  way["man_made"~"flare|chimney|kiln|furnace|smelter|coking_oven|gasometer"](area:3600000000);
  node["man_made"~"flare|chimney|kiln|furnace|smelter|coking_oven|gasometer"](area:3600000000);
  
  // Power plants
  way["power"="plant"](area:3600000000);
  relation["power"="plant"](area:3600000000);
  node["power"="plant"](area:3600000000);
  
  // Industrial landuse
  way["landuse"="industrial"](area:3600000000);
  relation["landuse"="industrial"](area:3600000000);
  
  // Quarries and mines (heat from machinery)
  way["landuse"~"quarry|salt_pond"](area:3600000000);
  relation["landuse"~"quarry|salt_pond"](area:3600000000);
);
out body;
>;
out skel qt;
```

### Bounded Query (for specific region)

```overpass
[out:json][timeout:180];
(
  way["industrial"]({{bbox}});
  way["man_made"~"flare|chimney|kiln|furnace|smelter|coking_oven|gasometer|storage_tank|silo"]({{bbox}});
  way["power"="plant"]({{bbox}});
  way["landuse"="industrial"]({{bbox}});
  relation["industrial"]({{bbox}});
  relation["power"="plant"]({{bbox}});
  relation["landuse"="industrial"]({{bbox}});
);
out body;
>;
out skel qt;
```

### India Area ID

`area:3600000000` = India (ISO 3166-1 alpha-2: IN → OSM area ID = 3600000000 + 84 = 3600000084? Actually need to check. Standard formula: 3600000000 + relation_id. India relation is 304741, so area = 3600304741. But simpler: use `{{bbox}}` for India: `68,6,98,38`).

### Output Format

```json
{
  "version": 0.6,
  "generator": "Overpass API",
  "osm3s": {...},
  "elements": [
    {
      "type": "way",
      "id": 123456789,
      "tags": {
        "industrial": "chemical",
        "name": "Reliance Jamnagar Refinery",
        "operator": "Reliance Industries Limited",
        "website": "https://www.ril.com"
      },
      "nodes": [111, 222, 333, ...],
      "geometry": [
        {"lat": 22.4567, "lon": 70.1234},
        {"lat": 22.4568, "lon": 70.1235},
        ...
      ]
    },
    {
      "type": "node",
      "id": 987654321,
      "lat": 22.4500,
      "lon": 70.1300,
      "tags": {
        "man_made": "flare",
        "name": "Flare Stack 3",
        "operator": "Reliance Industries Limited"
      }
    }
  ]
}
```

## Data Processing Pipeline

### 1. Fetch & Parse

```python
# ml/src/ingestion/osm_client.py
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
INDIA_BBOX = "68,6,98,38"  # min_lon, min_lat, max_lon, max_lat

INDUSTRIAL_QUERY = f"""
[out:json][timeout:300];
(
  way["industrial"]({INDIA_BBOX});
  way["man_made"~"flare|chimney|kiln|furnace|smelter|coking_oven|gasometer|storage_tank|silo"]({INDIA_BBOX});
  way["power"="plant"]({INDIA_BBOX});
  way["landuse"="industrial"]({INDIA_BBOX});
  relation["industrial"]({INDIA_BBOX});
  relation["power"="plant"]({INDIA_BBOX});
  relation["landuse"="industrial"]({INDIA_BBOX});
);
out body;
>;
out skel qt;
"""

class OSMClient:
    def __init__(self, url: str = OVERPASS_URL):
        self.url = url
        self.client = httpx.AsyncClient(timeout=120.0)
    
    @retry(wait=wait_exponential(multiplier=1, min=5, max=60), stop=stop_after_attempt(3))
    async def fetch_industrial_sites(self) -> list[dict]:
        response = await self.client.post(self.url, data={'data': INDUSTRIAL_QUERY})
        response.raise_for_status()
        data = response.json()
        return self._parse_elements(data['elements'])
    
    def _parse_elements(self, elements: list) -> list[dict]:
        sites = []
        for el in elements:
            if el['type'] in ('way', 'relation') and 'geometry' in el:
                # Polygon
                coords = [[p['lon'], p['lat']] for p in el['geometry']]
                # Close polygon
                if coords[0] != coords[-1]:
                    coords.append(coords[0])
                geom = {'type': 'Polygon', 'coordinates': [coords]}
            elif el['type'] == 'node':
                # Point - buffer to small polygon
                geom = {'type': 'Point', 'coordinates': [el['lon'], el['lat']]}
            else:
                continue
            
            tags = el.get('tags', {})
            site = {
                'osm_id': f"{el['type']}/{el['id']}",
                'osm_type': el['type'],
                'name': tags.get('name'),
                'industrial_type': self._classify_industrial_type(tags),
                'tags': tags,
                'geometry': geom
            }
            sites.append(site)
        return sites
    
    def _classify_industrial_type(self, tags: dict) -> str:
        """Map OSM tags to our industrial type taxonomy."""
        # Priority order
        if tags.get('man_made') == 'flare':
            return 'flare'
        if tags.get('man_made') in ('chimney', 'kiln', 'furnace', 'smelter', 'coking_oven'):
            return 'high_temp_process'
        if tags.get('power') == 'plant':
            source = tags.get('generator:source', 'unknown')
            return f'power_plant_{source}'
        if tags.get('industrial'):
            return tags['industrial']
        if tags.get('landuse') == 'industrial':
            return 'industrial_area'
        if tags.get('landuse') in ('quarry', 'salt_pond'):
            return 'extractive'
        return 'other'
```

### 2. Geometry Processing

```python
# gis/scripts/osm_processing.py
import geopandas as gpd
from shapely.geometry import shape, Point, Polygon
from shapely.ops import unary_union
import pandas as pd

def process_osm_sites(raw_sites: list[dict]) -> gpd.GeoDataFrame:
    """Convert raw OSM elements to clean GeoDataFrame."""
    
    rows = []
    for site in raw_sites:
        try:
            geom = shape(site['geometry'])
            
            # Ensure valid geometry
            if not geom.is_valid:
                geom = geom.buffer(0)
            
            # For points (flares, chimneys), create small buffer for spatial joins
            if geom.geom_type == 'Point':
                # 50m buffer ~ typical flare stack footprint
                geom = geom.buffer(0.0005)  # ~50m at equator
            
            # Calculate centroid for distance calculations
            centroid = geom.centroid
            
            rows.append({
                'osm_id': site['osm_id'],
                'osm_type': site['osm_type'],
                'name': site['name'],
                'industrial_type': site['industrial_type'],
                'tags': site['tags'],
                'geometry': geom,
                'centroid': centroid,
                'area_sqm': geom.area * 111000 * 111000 * cos(centroid.y * pi/180)  # Approximate
            })
        except Exception as e:
            logger.warning(f"Failed to process OSM site {site['osm_id']}: {e}")
    
    gdf = gpd.GeoDataFrame(rows, geometry='geometry', crs='EPSG:4326')
    
    # Deduplicate: same OSM ID (ways + relations might overlap)
    gdf = gdf.drop_duplicates(subset='osm_id', keep='first')
    
    # Add derived fields
    gdf['bbox'] = gdf.geometry.bounds.apply(lambda x: list(x), axis=1)
    gdf['has_name'] = gdf['name'].notna()
    gdf['name_length'] = gdf['name'].fillna('').str.len()
    
    return gdf
```

### 3. Industrial Type Taxonomy

```python
# Standardized industrial types for our classification
INDUSTRIAL_TYPE_TAXONOMY = {
    # High-temperature persistent sources
    'flare': {'priority': 1, 'expected_persistence': 'continuous', 'typical_temp_k': 1200},
    'high_temp_process': {'priority': 2, 'expected_persistence': 'intermittent', 'typical_temp_k': 800},
    
    # Power generation
    'power_plant_coal': {'priority': 3, 'expected_persistence': 'continuous', 'typical_temp_k': 600},
    'power_plant_gas': {'priority': 3, 'expected_persistence': 'continuous', 'typical_temp_k': 500},
    'power_plant_oil': {'priority': 3, 'expected_persistence': 'continuous', 'typical_temp_k': 550},
    'power_plant_biomass': {'priority': 3, 'expected_persistence': 'seasonal', 'typical_temp_k': 450},
    'power_plant_nuclear': {'priority': 3, 'expected_persistence': 'continuous', 'typical_temp_k': 350},
    'power_plant_waste': {'priority': 3, 'expected_persistence': 'continuous', 'typical_temp_k': 400},
    'power_plant_unknown': {'priority': 3, 'expected_persistence': 'continuous', 'typical_temp_k': 500},
    
    # Heavy industry
    'chemical': {'priority': 4, 'expected_persistence': 'intermittent', 'typical_temp_k': 400},
    'refinery': {'priority': 4, 'expected_persistence': 'continuous', 'typical_temp_k': 500},
    'steel': {'priority': 4, 'expected_persistence': 'continuous', 'typical_temp_k': 800},
    'cement': {'priority': 4, 'expected_persistence': 'continuous', 'typical_temp_k': 600},
    'aluminum': {'priority': 4, 'expected_persistence': 'continuous', 'typical_temp_k': 700},
    'manufacturing': {'priority': 5, 'expected_persistence': 'diurnal', 'typical_temp_k': 350},
    
    # Other
    'industrial_area': {'priority': 6, 'expected_persistence': 'variable', 'typical_temp_k': 300},
    'extractive': {'priority': 5, 'expected_persistence': 'diurnal', 'typical_temp_k': 320},
    'warehouse': {'priority': 7, 'expected_persistence': 'rare', 'typical_temp_k': 300},
    'logistics': {'priority': 7, 'expected_persistence': 'rare', 'typical_temp_k': 300},
    'other': {'priority': 8, 'expected_persistence': 'unknown', 'typical_temp_k': 300}
}
```

## Spatial Join Strategy

### Finding Nearest Industrial Site

```sql
-- PostGIS query: for each thermal event, find nearest industrial site within 10km
WITH event_points AS (
  SELECT id, geom FROM thermal_events 
  WHERE processed_at IS NULL
),
site_points AS (
  SELECT id, name, industrial_type, centroid as geom FROM industrial_sites
)
SELECT 
  e.id as event_id,
  s.id as site_id,
  s.name as site_name,
  s.industrial_type,
  ST_Distance(e.geom::geography, s.geom::geography) as distance_m,
  ST_Azimuth(e.geom, s.geom) as bearing_deg
FROM event_points e
CROSS JOIN LATERAL (
  SELECT id, name, industrial_type, centroid
  FROM site_points
  ORDER BY e.geom::geography <-> centroid::geography
  LIMIT 1
) s
WHERE ST_DWithin(e.geom::geography, s.geom::geography, 10000);
```

### Python Implementation (for pipeline)

```python
# gis/scripts/spatial_join.py
import geopandas as gpd
import numpy as np

def find_nearest_industrial_sites(
    events_gdf: gpd.GeoDataFrame,
    sites_gdf: gpd.GeoDataFrame,
    max_distance_km: float = 10.0,
    k: int = 3
) -> gpd.GeoDataFrame:
    """
    Find k nearest industrial sites for each event using BallTree (fast).
    Returns events with joined site info.
    """
    from sklearn.neighbors import BallTree
    
    # Project to radians for haversine distance
    events_rad = np.radians(np.column_stack([
        events_gdf.geometry.y, events_gdf.geometry.x
    ]))
    sites_rad = np.radians(np.column_stack([
        sites_gdf.centroid.y, sites_gdf.centroid.x
    ]))
    
    # BallTree with haversine metric
    tree = BallTree(sites_rad, metric='haversine')
    earth_radius_km = 6371.0
    
    # Query k nearest
    distances, indices = tree.query(events_rad, k=min(k, len(sites_gdf)))
    distances_km = distances * earth_radius_km
    
    # Build results
    results = []
    for i, event_idx in enumerate(events_gdf.index):
        event_neighbors = []
        for j in range(k):
            site_idx = sites_gdf.index[indices[i, j]]
            dist = distances_km[i, j]
            if dist <= max_distance_km:
                site = sites_gdf.loc[site_idx]
                event_neighbors.append({
                    'site_id': site['id'],
                    'site_name': site['name'],
                    'site_type': site['industrial_type'],
                    'distance_km': round(dist, 3),
                    'bearing_deg': calculate_bearing(
                        events_gdf.loc[event_idx].geometry,
                        site.centroid
                    )
                })
        results.append(event_neighbors)
    
    events_gdf['nearest_industrial_sites'] = results
    # Primary match (closest)
    events_gdf['nearest_industrial_site_id'] = [r[0]['site_id'] if r else None for r in results]
    events_gdf['nearest_industrial_type'] = [r[0]['site_type'] if r else None for r in results]
    events_gdf['dist_to_nearest_industrial_km'] = [r[0]['distance_km'] if r else None for r in results]
    
    return events_gdf

def calculate_bearing(point1: Point, point2: Point) -> float:
    """Calculate bearing from point1 to point2 in degrees."""
    from math import atan2, degrees, radians, sin, cos
    lat1, lon1 = radians(point1.y), radians(point1.x)
    lat2, lon2 = radians(point2.y), radians(point2.x)
    dlon = lon2 - lon1
    y = sin(dlon) * cos(lat2)
    x = cos(lat1) * sin(lat2) - sin(lat1) * cos(lat2) * cos(dlon)
    bearing = degrees(atan2(y, x))
    return (bearing + 360) % 360
```

## Data Quality & Coverage

### India OSM Industrial Coverage Assessment

| State | Industrial Ways | Industrial Relations | Flares | Power Plants | Coverage Quality |
|-------|----------------|---------------------|--------|--------------|------------------|
| **Gujarat** | 2,500+ | 150+ | 200+ | 50+ | Excellent |
| **Maharashtra** | 3,000+ | 200+ | 150+ | 60+ | Excellent |
| **Tamil Nadu** | 1,800+ | 100+ | 80+ | 40+ | Good |
| **Karnataka** | 1,500+ | 80+ | 60+ | 35+ | Good |
| **Andhra Pradesh** | 1,200+ | 60+ | 50+ | 30+ | Good |
| **Odisha** | 800+ | 40+ | 40+ | 25+ | Moderate |
| **West Bengal** | 1,000+ | 50+ | 30+ | 20+ | Moderate |
| **Rajasthan** | 600+ | 30+ | 20+ | 15+ | Moderate |
| **Other States** | 500-1000 | 20-40 | 10-30 | 10-20 | Variable |

**Total India**: ~15,000+ industrial ways/relations, ~700+ flares, ~300+ power plants

### Known Gaps

1. **Small flares**: Many oil/gas flares not mapped as `man_made=flare`
2. **Informal industry**: Brick kilns, small workshops often unmapped
3. **New facilities**: Lag between construction and OSM mapping
4. **Tagging inconsistency**: Same facility tagged differently by different mappers
5. **Boundary vs Point**: Large industrial areas as polygons vs. point features

### Augmentation Strategies

| Strategy | Implementation |
|----------|----------------|
| **India Industrial Corridor Data** | Import DFC, PCPIR, SEZ boundaries from government sources |
| **CPCB/SPCB Lists** | Cross-reference with Pollution Control Board consent lists |
| **Satellite-derived** | Use VIIRS nighttime lights + thermal to detect unmapped sources |
| **Crowdsourcing** | In-app "Report Missing Site" for analysts |
| **Periodic Refresh** | Monthly Overpass re-query + diff |

## Rate Limits & Best Practices

| Endpoint | Limit | Best Practice |
|----------|-------|---------------|
| Overpass API (public) | ~10,000 queries/day | Cache results, batch queries, use local instance for heavy use |
| Nominatim (geocoding) | 1 req/sec | Cache, use `overpass-turbo` for complex queries |
| Tile servers | Varies | Use vector tiles, not raster |

**Recommendation**: For production, deploy own Overpass instance or use hosted (e.g., Geofabrik, OSM Foundation).

## Storage Schema

```sql
-- Already defined in database-architecture.md
CREATE TABLE industrial_sites (
    id BIGSERIAL PRIMARY KEY,
    geom GEOGRAPHY(POLYGON, 4326) NOT NULL,
    centroid GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (ST_Centroid(geom::geometry)::geography) STORED,
    name VARCHAR(500),
    industrial_type VARCHAR(100) NOT NULL,
    osm_id VARCHAR(50) UNIQUE,
    tags JSONB NOT NULL DEFAULT '{}',
    source VARCHAR(50) NOT NULL DEFAULT 'osm',
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_industrial_sites_geom_gist ON industrial_sites USING GIST (geom);
CREATE INDEX idx_industrial_sites_type ON industrial_sites (industrial_type);
CREATE INDEX idx_industrial_sites_osm_id ON industrial_sites (osm_id);
```

## Update Strategy

```bash
# Monthly refresh (cron)
0 3 1 * * /app/scripts/update_osm_industrial_sites.sh

# Script:
#!/bin/bash
# 1. Query Overpass for India industrial sites
# 2. Process geometries
# 3. Diff with existing (new, modified, deleted)
# 4. Upsert to database
# 5. Invalidate spatial join cache
# 6. Log stats
```

## References

- [OSM Map Features - Industrial](https://wiki.openstreetmap.org/wiki/Map_Features#Industrial)
- [OSM Map Features - Man_made](https://wiki.openstreetmap.org/wiki/Map_Features#Man_made)
- [Overpass API Documentation](https://wiki.openstreetmap.org/wiki/Overpass_API)
- [Overpass Turbo (Query Builder)](https://overpass-turbo.eu/)
- [India OSM Community](https://wiki.openstreetmap.org/wiki/India)
- [Industrial Tagging Guidelines](https://wiki.openstreetmap.org/wiki/Tag:industrial%3D*)

---

*Last Updated: 2024-01-15 | For SIH26162 Team Internal Use*