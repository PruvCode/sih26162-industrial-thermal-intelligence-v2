# Satellite Data Research — SIH26162

## Overview

Beyond FIRMS (which provides *derived* thermal anomaly points), we may need raw or higher-level satellite data for validation, context, and future enhancement.

## Data Sources Comparison

| Source | Sensor | Resolution | Revisit | Latency | Access | Cost |
|--------|--------|------------|---------|---------|--------|------|
| **FIRMS (MODIS/VIIRS)** | Derived product | 1km / 375m | 4x/day | 3h | API | Free |
| **Sentinel-3 SLSTR** | SLSTR | 1km (fire) | 1-2 days | 6-24h | Copernicus Open Access Hub | Free |
| **Sentinel-2 MSI** | MSI | 10-20m | 5 days | 24h | Copernicus / AWS S3 | Free |
| **Landsat 8/9** | OLI/TIRS | 30m (100m thermal) | 16 days | 24h | USGS / AWS | Free |
| **GOES-16/17/18** | ABI | 2km (fire) | 5-15 min | <5 min | NOAA / AWS | Free |
| **INSAT-3D/3DR** | Imager | 4km | 15-30 min | <10 min | MOSDAC / IMD | Free (India) |
| **Himawari-8/9** | AHI | 2km | 10 min | <10 min | JAXA / AWS | Free |
| **Sentinel-3 OLCI** | OLCI | 300m | 1-2 days | 24h | Copernicus | Free |

## For SIH26162 MVP: FIRMS Only

**Decision**: Use FIRMS as sole satellite source for MVP. Reasons:
1. **Ready-to-use**: No preprocessing, calibrated fire detection
2. **Global coverage**: Consistent API worldwide
3. **Multi-sensor**: MODIS + 2x VIIRS = 4 overpasses/day
4. **Proven**: Used by operational fire services globally
5. **Timebox**: Adding raw satellite processing adds weeks

## Future: Sentinel-3 SLSTR Confirmation Layer

### Why SLSTR?

- **Independent confirmation**: Different sensor, different algorithm
- **Fire Radiative Power (FRP)**: More accurate than MODIS/VIIRS
- **Active fire + burn scar**: Can see progression
- **Open data**: Free via Copernicus

### Integration Concept

```
FIRMS Detection → Buffer 1km → Query SLSTR L2 FRP product
                                    ↓
                            Match within 1km & ±3h
                                    ↓
                            If match: confidence += 0.15
                            If no match but clear sky: confidence -= 0.1
                            If cloud: no change
```

### SLSTR Data Access

```python
# Future: Sentinel-3 client
from sentinelhub import SHConfig, SentinelHubCatalog, DataCollection

config = SHConfig()
config.sh_client_id = os.getenv('SENTINEL_HUB_CLIENT_ID')
config.sh_client_secret = os.getenv('SENTINEL_HUB_CLIENT_SECRET')

catalog = SentinelHubCatalog(config)

# Search SLSTR FRP for bbox + time
search_results = catalog.search(
    DataCollection.SENTINEL3_SLSTR_FRP,
    bbox=[72, 18, 74, 20],  # Example: Gujarat
    time=('2024-01-15T00:00:00Z', '2024-01-15T23:59:59Z'),
    filter="cloudCover < 30"
)
```

## Future: Geostationary for India (INSAT-3D/3DR)

### Why Geostationary?

- **High temporal**: 15-min intervals over India
- **Diurnal cycle**: Capture full fire progression
- **Local**: Operated by ISRO/IMD, optimized for India
- **Free**: MOSDAC provides data

### INSAT-3D Fire Product

| Parameter | Value |
|-----------|-------|
| **Product** | INSAT-3D Fire Detection (FD) |
| **Algorithm** | Threshold-based on 3.9μm & 11μm |
| **Resolution** | 4km at nadir |
| **Coverage** | India + Indian Ocean |
| **Latency** | ~10 minutes |
| **Access** | MOSDAC (requires registration) |

### Integration

```python
# Future: INSAT client
class InsatClient:
    def __init__(self, username: str, password: str):
        self.session = requests.Session()
        self.auth = (username, password)
        self.base_url = "https://mosdac.gov.in/api"
    
    def get_fire_detections(self, date: datetime, bbox: tuple):
        """Fetch INSAT fire detections for date + bbox."""
        params = {
            'date': date.strftime('%Y-%m-%d'),
            'bbox': ','.join(map(str, bbox)),
            'format': 'geojson'
        }
        response = self.session.get(f"{self.base_url}/fire", params=params, auth=self.auth)
        return response.json()
```

## Future: Sentinel-2 / Landsat for Validation

### Use Case: Confirm Fire vs. Industrial

```python
# For high-confidence industrial_fire predictions
# Fetch Sentinel-2 true color + SWIR for visual confirmation

def get_sentinel2_context(event_geom, date, buffer_km=2):
    """Get Sentinel-2 imagery around event for visual validation."""
    from sentinelhub import SentinelHubRequest, DataCollection, MimeType, bbox_to_dimensions
    
    bbox = event_geom.buffer(buffer_km / 111).bounds  # Rough degrees
    size = bbox_to_dimensions(bbox, resolution=10)
    
    request = SentinelHubRequest(
        evalscript="""
            // True color + SWIR visualization
            function setup() { return { input: ["B02", "B03", "B04", "B11", "B12", "SCL"], output: { bands: 3 } }; }
            function evaluatePixel(s) {
                // Fire visualization: SWIR (B12) as Red, NIR (B08) as Green, Red (B04) as Blue
                return [2.5*s.B12, 2.5*s.B08, 2.5*s.B04];
            }
        """,
        input_data=[SentinelHubRequest.input_data(DataCollection.SENTINEL2_L2A, time_interval=(date, date))],
        responses=[SentinelHubRequest.output_response('default', MimeType.PNG)],
        bbox=bbox, size=size, config=config
    )
    
    return request.get_data()[0]  # Returns numpy array
```

## Cloud Cover Handling

| Source | Typical Cloud Cover (India) | Strategy |
|--------|----------------------------|----------|
| **FIRMS** | N/A (algorithm handles) | Built-in |
| **Sentinel-2** | 40-60% (monsoon) | Filter by SCL band, use multiple dates |
| **Sentinel-3** | 30-50% | SLSTR has cloud masking |
| **Landsat** | 30-50% | QA band for cloud mask |
| **Geostationary** | Real-time visible | Use clear-sky composite |

## Data Access Patterns

| Pattern | Implementation |
|---------|----------------|
| **On-demand** | API call per event (for investigation panel) |
| **Batch pre-fetch** | Daily download for high-priority regions |
| **Catalog search** | STAC API for discovery |
| **Cloud-optimized** | COG/GeoParquet on S3 for fast access |

## Cost Estimation (Post-SIH)

| Service | Monthly Cost (Est.) | Notes |
|---------|---------------------|-------|
| **Sentinel Hub** | $50-500 | Pay-per-request or subscription |
| **AWS Open Data** | $0 (data) + compute | Need own processing |
| **Google Earth Engine** | Free (research) / $500+ (commercial) | Powerful but vendor lock-in |
| **Custom Pipeline** | $200-1000 (compute/storage) | Full control, more dev effort |

## Recommendation for SIH

1. **MVP**: FIRMS only (done)
2. **Post-SIH Phase 1**: Add Sentinel-3 SLSTR confirmation (via Sentinel Hub free tier)
3. **Phase 2**: INSAT-3D integration for India-specific high-temporal
4. **Phase 3**: Sentinel-2/Landsat visual validation for evidence panel

## References

- [Copernicus Open Access Hub](https://scihub.copernicus.eu/)
- [Sentinel Hub Documentation](https://docs.sentinel-hub.com/)
- [MOSDAC INSAT Products](https://mosdac.gov.in/)
- [GOES on AWS](https://registry.opendata.aws/noaa-goes/)
- [INSAT-3D Fire Algorithm](https://www.mosdac.gov.in/insat-3d-fire-detection)
- [SLSTR FRP Product](https://sentinels.copernicus.eu/web/sentinel/technical-guides/sentinel-3-slstr/products-algorithms/level-2-fire-products)

---

*Last Updated: 2024-01-15 | For SIH26162 Team Internal Use*