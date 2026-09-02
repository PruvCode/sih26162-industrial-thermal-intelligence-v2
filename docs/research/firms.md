# NASA FIRMS Research — SIH26162

## Overview

NASA's Fire Information for Resource Management System (FIRMS) provides near real-time (NRT) active fire data from satellite sensors. This is our primary data source.

## Data Sources

### 1. MODIS (Moderate Resolution Imaging Spectroradiometer)

| Parameter | Value |
|-----------|-------|
| **Satellites** | Terra (launched 1999), Aqua (launched 2002) |
| **Sensor** | MODIS |
| **Resolution** | 1km (at nadir) |
| **Overpass Times** | Terra: ~10:30 AM/PM local; Aqua: ~1:30 PM/AM local |
| **Latency** | ~3 hours (NRT) |
| **Spectral Bands** | 36 bands (0.4 - 14.4 μm) |
| **Fire Detection** | Contextual algorithm (MOD14/MYD14) |
| **Confidence** | 0-100% (low, nominal, high) |

**Detection Algorithm**: 
- Uses 4μm and 11μm channels
- Contextual: compares pixel to surrounding background
- Flags: fire, no fire, cloud, water, unknown

### 2. VIIRS (Visible Infrared Imaging Radiometer Suite)

| Parameter | Value |
|-----------|-------|
| **Satellites** | Suomi-NPP (2011), NOAA-20 (2017), NOAA-21 (2022) |
| **Sensor** | VIIRS |
| **Resolution** | 375m (I-bands), 750m (M-bands) |
| **Overpass Times** | ~1:30 AM/PM local (varies) |
| **Latency** | ~3 hours (NRT) |
| **Spectral Bands** | 22 bands (0.4 - 12.5 μm) |
| **Fire Detection** | Hybrid threshold + contextual |
| **Confidence** | Low/Nominal/High (categorical) |

**Key Improvements over MODIS**:
- Higher spatial resolution (375m vs 1km)
- Better nighttime detection (Day/Night Band)
- Improved small fire detection
- Better geolocation accuracy

### 3. FIRMS Data Products

| Product | Description | Update Frequency |
|---------|-------------|------------------|
| **NRT (Near Real-Time)** | Active fire detections within 3 hours | Every ~3 hours |
| **Standard** | Higher quality, calibrated | ~4-6 months lag |
| **Ultra Real-Time (URT)** | Experimental, <60 min latency | Continuous |

## API Access

### FIRMS API (Area-based)

```
Base URL: https://firms.modaps.eosdis.nasa.gov/api/area/

Parameters:
- MAP_KEY: Your API key (required)
- SOURCE: MODIS_NRT, VIIRS_SNPP_NRT, VIIRS_NOAA20_NRT, VIIRS_NOAA21_NRT
- AREA: world, or bounding box "xmin,ymin,xmax,ymax"
- DAYS: 1-10 (days of data to return)
- FORMAT: csv (default), json, kml, geojson

Example:
https://firms.modaps.eosdis.nasa.gov/api/area/csv/MAP_KEY/VIIRS_SNPP_NRT/world/1
```

### Rate Limits

| Tier | Requests/Day | Concurrent |
|------|--------------|------------|
| Standard | 1,000 | 5 |
| Enhanced | 10,000 | 20 |
| Research | Unlimited | 50 |

**Apply for MAP_KEY**: https://firms.modaps.eosdis.nasa.gov/api/area/

### Response Format (CSV)

```csv
latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight
19.0760,72.8777,312.4,1.2,1.1,2024-01-15,0430,Terra,MODIS,85,6.1NRT,298.1,12.5,D
23.0225,72.5714,345.2,0.8,0.9,2024-01-15,0515,Suomi-NPP,VIIRS,high,2.1NRT,310.5,45.2,N
```

### Field Definitions

| Field | Type | Description |
|-------|------|-------------|
| `latitude` | float | Decimal degrees, WGS84 |
| `longitude` | float | Decimal degrees, WGS84 |
| `brightness` | float | Brightness temperature (K) - MODIS: 4μm; VIIRS: I-4 (3.74μm) |
| `scan` | float | Along-scan pixel size (km) |
| `track` | float | Along-track pixel size (km) |
| `acq_date` | date | Acquisition date (YYYY-MM-DD) UTC |
| `acq_time` | string | Acquisition time (HHMM) UTC |
| `satellite` | string | Terra, Aqua, Suomi-NPP, NOAA-20, NOAA-21 |
| `instrument` | string | MODIS, VIIRS |
| `confidence` | int/string | MODIS: 0-100; VIIRS: low, nominal, high |
| `version` | string | Processing version (e.g., 6.1NRT) |
| `bright_t31` | float | Band 31 BT (MODIS only, 11μm) |
| `frp` | float | Fire Radiative Power (MW) |
| `daynight` | char | D (day), N (night) |

## Data Characteristics for India

### Coverage Statistics (Approximate)

| Region | MODIS Detections/Day | VIIRS Detections/Day | Peak Season |
|--------|---------------------|---------------------|-------------|
| **India (total)** | 50-200 | 100-500 | Mar-May (wheat residue), Oct-Nov (rice residue) |
| **Industrial Corridors** | 5-20 | 10-50 | Year-round |
| **Forest Areas** | 10-100 | 50-300 | Feb-May (dry season) |
| **Agricultural** | 20-150 | 50-400 | Harvest seasons |

### Known Industrial Hotspots (FIRMS-detectable)

| Region | Industries | Typical Signature |
|--------|------------|-------------------|
| **Jamnagar, Gujarat** | Reliance, Nayara refineries | Persistent flares, high FRP |
| **Mumbai-Pune Belt** | Chemical, petrochemical | Clustered, medium persistence |
| **Vizag, AP** | Steel (RINL), pharma, fertilizer | High brightness, industrial zones |
| **Durgapur, WB** | Steel (SAIL), power | Persistent, diurnal pattern |
| **Angul, Odisha** | Aluminum (NALCO), power, coal | Very persistent, large clusters |
| **Nellore, AP** | Thermal power, ports | Coastal, regular pattern |
| **Dahej, Gujarat** | Chemical complex | Dense cluster, flares |

## Data Quality Considerations

### 1. False Positives

| Source | Characteristics | Mitigation |
|--------|----------------|------------|
| **Sunglint** | Coastal/water, day only, low brightness | Filter water bodies, require land mask |
| **Volcanic** | Persistent, high temp, known locations | Cross-ref with volcano database |
| **Gas Flares** | Persistent, point source, industrial areas | OSM tag `man_made=flare` |
| **Industrial Heat** | Persistent, factories, steel/cement | OSM industrial tags |
| **Urban Heat** | Diffuse, low intensity, cities | Population density filter |
| **Satellite Artifacts** | Edge of scan, single detection | Scan angle filter, require persistence |

### 2. False Negatives

| Cause | Impact | Mitigation |
|-------|--------|------------|
| **Cloud Cover** | Blocks thermal signal | Multi-satellite fusion, temporal interpolation |
| **Small Fires** | Below detection threshold | VIIRS 375m better than MODIS 1km |
| **Timing** | Overpass misses peak | Multiple satellites (4x/day combined) |
| **Smoke Obscuration** | Attenuates signal | Use 4μm channel less affected |

### 3. Geolocation Accuracy

| Sensor | Accuracy (1σ) | Systematic Bias |
|--------|---------------|-----------------|
| MODIS | ~500m | <100m |
| VIIRS | ~250m | <50m |

**Implication**: For industrial site matching, use 1km buffer minimum.

## Integration Strategy

### Ingestion Pipeline Design

```python
# ml/src/ingestion/firms_client.py
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential
from datetime import datetime, timedelta

class FirmsClient:
    def __init__(self, map_key: str, base_url: str = "https://firms.modaps.eosdis.nasa.gov/api/area"):
        self.map_key = map_key
        self.base_url = base_url
        self.client = httpx.AsyncClient(timeout=60.0)
    
    @retry(
        wait=wait_exponential(multiplier=1, min=2, max=30),
        stop=stop_after_attempt(3)
    )
    async def fetch_latest(self, sources: list[str], area: str = "world", days: int = 1):
        """Fetch latest FIRMS data for all sources."""
        all_records = []
        
        for source in sources:
            url = f"{self.base_url}/csv/{self.map_key}/{source}/{area}/{days}"
            response = await self.client.get(url)
            response.raise_for_status()
            
            # Parse CSV
            records = self._parse_csv(response.text, source)
            all_records.extend(records)
        
        return all_records
    
    async def fetch_date_range(self, start: datetime, end: datetime, sources: list[str]):
        """Backfill for date range (use with caution - rate limits)."""
        days = (end - start).days + 1
        return await self.fetch_latest(sources, days=min(days, 10))
    
    def _parse_csv(self, csv_text: str, source: str) -> list[dict]:
        import csv
        from io import StringIO
        
        reader = csv.DictReader(StringIO(csv_text))
        records = []
        for row in reader:
            try:
                record = self._normalize_row(row, source)
                records.append(record)
            except Exception as e:
                logger.warning(f"Failed to parse FIRMS row: {row}, error: {e}")
        return records
    
    def _normalize_row(self, row: dict, source: str) -> dict:
        # Convert VIIRS confidence to numeric
        confidence_map = {'low': 30, 'nominal': 70, 'high': 90}
        conf = row['confidence']
        if conf in confidence_map:
            conf = confidence_map[conf]
        else:
            conf = int(conf)
        
        # Parse datetime
        acq_time = row['acq_time'].zfill(4)
        acq_datetime = datetime.strptime(
            f"{row['acq_date']} {acq_time[:2]}:{acq_time[2:]}", 
            "%Y-%m-%d %H:%M"
        )
        
        return {
            'latitude': float(row['latitude']),
            'longitude': float(row['longitude']),
            'brightness': float(row['brightness']),
            'bright_t31': float(row['bright_t31']) if row['bright_t31'] else None,
            'scan': float(row['scan']) if row['scan'] else None,
            'track': float(row['track']) if row['track'] else None,
            'frp': float(row['frp']) if row['frp'] else None,
            'acq_datetime': acq_datetime,
            'satellite': row['satellite'],
            'instrument': row['instrument'],
            'confidence': conf,
            'daynight': row['daynight'],
            'source': source,
            'version': row['version']
        }
```

### Deduplication Strategy

```python
# ml/src/ingestion/deduplicator.py
import geopandas as gpd
from shapely.geometry import Point
import pandas as pd

def deduplicate_events(gdf: gpd.GeoDataFrame, 
                        distance_threshold_m: float = 1000,
                        time_threshold_hours: float = 6) -> gpd.GeoDataFrame:
    """
    Remove spatiotemporal duplicates.
    Keeps highest confidence, then most recent.
    """
    if len(gdf) == 0:
        return gdf
    
    # Ensure projected CRS for distance in meters
    gdf_proj = gdf.to_crs(epsg=3857)  # Web Mercator
    
    # Sort by confidence desc, then time desc
    gdf_proj = gdf_proj.sort_values(['confidence', 'acq_datetime'], ascending=[False, False])
    
    # Build spatial index
    from scipy.spatial import cKDTree
    coords = np.column_stack([gdf_proj.geometry.x, gdf_proj.geometry.y])
    tree = cKDTree(coords)
    
    # Find pairs within distance threshold
    pairs = tree.query_pairs(r=distance_threshold_m)
    
    # Build adjacency for temporal filtering
    to_drop = set()
    for i, j in pairs:
        time_diff = abs((gdf_proj.iloc[i].acq_datetime - gdf_proj.iloc[j].acq_datetime).total_seconds() / 3600)
        if time_diff <= time_threshold_hours:
            # Drop the lower confidence (already sorted, so j is lower)
            to_drop.add(j)
    
    return gdf_proj.drop(index=list(to_drop)).to_crs(epsg=4326)
```

## Limitations & Workarounds

| Limitation | Impact | Workaround |
|------------|--------|------------|
| **No historical API** | Can't backfill via API easily | Use FIRMS archive download (CSV/ZIP) |
| **Rate limits** | Can't poll too frequently | Cache, batch requests, use multiple MAP_KEYs |
| **No webhook/push** | Must poll | Schedule every 3 hours (matches satellite overpass) |
| **VIIRS confidence categorical** | Harder to threshold | Map: low=30, nominal=70, high=90 |
| **No fire perimeter** | Only centroid points | Use FRP + brightness for size estimate |
| **Single band brightness** | Limited spectral info | Combine with Sentinel-3 SLSTR (future) |

## Future Enhancements

1. **FIRMS URT (Ultra Real-Time)**: Sub-hour latency when available
2. **Sentinel-3 SLSTR**: European counterpart, 1km, different overpass times
3. **GOES/INSAT Geostationary**: 15-min temporal, 2-4km spatial (for India)
4. **Harmonized Product**: Fuse MODIS + VIIRS + geostationary for seamless timeline

## References

- [FIRMS User Guide](https://firms.modaps.eosdis.nasa.gov/api/area/)
- [MODIS Fire Algorithm (MOD14)](https://modis-fire.umd.edu/)
- [VIIRS Active Fire Algorithm](https://www.star.nesdis.noaa.gov/jpss/viirs-active-fire.php)
- [FIRMS FAQ](https://firms.modaps.eosdis.nasa.gov/faq/)
- [ESA WorldCover for land cover context](https://esa-worldcover.org/)

---

*Last Updated: 2024-01-15 | For SIH26162 Team Internal Use*