# Data Flow Architecture — SIH26162

## Overview

This document describes the end-to-end data flow from raw satellite observations to classified, explainable events in the analyst interface.

## 1. Ingestion Pipeline

### 1.1 FIRMS Data Sources

| Source | Satellite | Sensor | Latency | Resolution | Coverage |
|--------|-----------|--------|---------|------------|----------|
| `MODIS_NRT` | Terra/Aqua | MODIS | ~3 hours | 1km | Global |
| `VIIRS_SNPP_NRT` | Suomi-NPP | VIIRS | ~3 hours | 375m | Global |
| `VIIRS_NOAA20_NRT` | NOAA-20 | VIIRS | ~3 hours | 375m | Global |

### 1.2 Raw FIRMS Schema (CSV)

```csv
latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight
19.0760,72.8777,312.4,1.2,1.1,2024-01-15,0430,Terra,MODIS,85,6.1NRT,298.1,12.5,D
```

### 1.3 Ingestion Steps

```
┌─────────────┐
│  SCHEDULER  │  (Every 3 hours: 00:00, 03:00, 06:00, ...)
└──────┬──────┘
       ▼
┌──────────────────┐
│ FETCH FIRMS CSV  │  Parallel per source
│  (httpx, retry)  │  Params: MAP_KEY, AREA=world, DAYS=1
└────────┬─────────┘
         ▼
┌──────────────────┐
│  VALIDATE ROWS   │  Pydantic model: FirmsRawRecord
│  - Required fields present
│  - Lat/lon in [-90,90], [-180,180]
│  - Brightness > 0, < 500K
│  - Confidence in [0,100]
│  - acq_date parseable
└────────┬─────────┘
         ▼
┌──────────────────┐
│  NORMALIZE       │  Output: ThermalEventCreate (internal)
│  - Column rename: latitude→lat, longitude→lon
│  - Geometry: ST_SetSRID(ST_MakePoint(lon, lat), 4326)
│  - Timestamp: acq_date + acq_time → acq_datetime (UTC)
│  - Confidence: 0-100 → 0.0-1.0
│  - Source tag: MODIS/VIIRS_SNPP/VIIRS_NOAA20
└────────┬─────────┘
         ▼
┌──────────────────┐
│  DEDUPLICATE     │  Strategy: Spatiotemporal clustering
│  - Group by: ST_DWithin(geom, 1000m) AND 
│              |acq_datetime - other.acq_datetime| < 6h
│  - Keep: highest confidence, then latest acq_datetime
│  - Log: dropped count per source
└────────┬─────────┘
         ▼
┌──────────────────┐
│  ENRICH          │  Parallel spatial lookups
│  1. Nearest industrial site (KNN, max 5km)
│  2. Land cover class (raster sample)
│  3. Admin boundary (point-in-polygon)
│  4. Population density (raster sample)
│  5. Elevation (DEM sample)
└────────┬─────────┘
         ▼
┌──────────────────┐
│  STORE           │  Transaction: single COPY + upsert
│  - thermal_events: core event record
│  - event_features: enriched features (JSONB)
│  - historical_observations: append for persistence
└────────┬─────────┘
         ▼
┌──────────────────┐
│  TRIGGER ML      │  Async: push event_ids to Redis queue
│  - Worker picks up batch
│  - Feature engineering
│  - Inference
│  - Store classification + SHAP
└──────────────────┘
```

### 1.4 Error Handling

| Failure Point | Strategy |
|---------------|----------|
| Network timeout | Retry 3x with exponential backoff (1s, 2s, 4s) |
| Invalid CSV row | Skip row, increment counter, continue |
| Schema validation fail | Log full row, alert if >5% failure rate |
| PostGIS insert fail | Rollback transaction, alert, dead letter queue |
| Enrichment timeout | Skip enrichment, store event with null features, retry later |

## 2. Enrichment Details

### 2.1 Industrial Site Extraction (OSM)

**Overpass Query:**
```overpass
[out:json][timeout:180];
(
  way["industrial"]({{bbox}});
  way["man_made"="flare"]({{bbox}});
  way["man_made"="chimney"]({{bbox}});
  way["man_made"="kiln"]({{bbox}});
  way["man_made"="furnace"]({{bbox}});
  way["landuse"="industrial"]({{bbox}});
  relation["industrial"]({{bbox}});
  relation["landuse"="industrial"]({{bbox}});
);
out body;
>;out skel qt;
```

**Extracted Fields:**
| Field | Source | Example |
|-------|--------|---------|
| `osm_id` | OSM feature ID | `way/12345678` |
| `name` | `name` tag | `Reliance Jamnagar Refinery` |
| `industrial_type` | `industrial` / `man_made` / `landuse` | `chemical` / `flare` / `industrial` |
| `geometry` | Way/Relation → Polygon | `POLYGON((...))` |
| `tags` | All other tags (JSONB) | `{"operator": "RIL", "capacity": "1.2M bpd"}` |

### 2.2 Spatial Join Logic

```sql
-- For each thermal event, find nearest industrial site within 5km
WITH ranked AS (
  SELECT 
    e.id AS event_id,
    s.id AS site_id,
    s.name,
    s.industrial_type,
    ST_Distance(e.geom::geography, s.geom::geography) AS distance_m,
    ST_Azimuth(e.geom, ST_Centroid(s.geom)) AS bearing_deg,
    ROW_NUMBER() OVER (PARTITION BY e.id ORDER BY ST_Distance(e.geom::geography, s.geom::geography)) AS rn
  FROM thermal_events e
  JOIN industrial_sites s 
    ON ST_DWithin(e.geom::geography, s.geom::geography, 5000)
  WHERE e.processed_at IS NULL
)
SELECT * FROM ranked WHERE rn = 1;
```

### 2.3 Raster Sampling (Land Cover, Population, Elevation)

```python
# Using rasterio for point sampling
def sample_raster(raster_path: str, lon: float, lat: float) -> Optional[int]:
    with rasterio.open(raster_path) as src:
        # Transform WGS84 to raster CRS
        xs, ys = src.transform * (lon, lat)  # inverse transform
        row, col = src.index(xs, ys)
        if 0 <= row < src.height and 0 <= col < src.width:
            return src.read(1)[row, col]
    return None
```

## 3. Persistence & Clustering

### 3.1 DBSCAN Clustering (PostGIS + Python)

```python
# In ml/src/features/clustering.py
from sklearn.cluster import DBSCAN
import geopandas as gpd

def cluster_events(gdf: gpd.GeoDataFrame, eps_m: float = 1000, min_samples: int = 3):
    """Cluster events by spatial proximity."""
    # Project to metric CRS for distance in meters
    gdf_proj = gdf.to_crs(epsg=3857)  # Web Mercator
    coords = np.column_stack([gdf_proj.geometry.x, gdf_proj.geometry.y])
    
    # DBSCAN with haversine would be better but slower
    clustering = DBSCAN(eps=eps_m, min_samples=min_samples, metric='euclidean')
    gdf['cluster_id'] = clustering.fit_predict(coords)
    
    # Noise points get -1
    return gdf
```

### 3.2 Persistence Metrics per Cluster

| Metric | Formula | Interpretation |
|--------|---------|----------------|
| `detection_count` | COUNT(*) | Total observations |
| `unique_dates` | COUNT(DISTINCT acq_date) | Active days |
| `temporal_span_days` | MAX(acq_date) - MIN(acq_date) | Longevity |
| `mean_interval_days` | AVG(LEAD(acq_date) - acq_date) | Regularity |
| `seasonality_score` | FFT power at 365-day freq | Annual pattern |
| `brightness_trend` | Linear regression slope | Intensifying/fading |
| `industrial_association` | MODE(nearest_site_type) | Likely source type |

### 3.3 Cluster-to-Event Propagation

```sql
-- Update events with cluster persistence features
UPDATE thermal_events e
SET 
  cluster_id = c.cluster_id,
  cluster_detection_count = c.detection_count,
  cluster_unique_dates = c.unique_dates,
  cluster_temporal_span_days = c.temporal_span_days,
  cluster_brightness_trend = c.brightness_trend
FROM persistence_clusters c
WHERE e.cluster_id = c.cluster_id;
```

## 4. Feature Engineering

### 4.1 Feature Categories

| Category | Features | Count |
|----------|----------|-------|
| **Radiometric** | brightness, bright_t31, frp, confidence, daynight, satellite, instrument | 7 |
| **Spatial** | dist_to_nearest_industrial_km, nearest_industrial_type, land_cover_class, admin_level_4, admin_level_6, population_density, elevation_m | 7 |
| **Temporal** | hour_of_day, day_of_week, day_of_year, month, is_weekend, days_since_last_detection_at_loc | 6 |
| **Persistence** | cluster_id, cluster_detection_count, cluster_unique_dates, cluster_temporal_span, cluster_brightness_trend, cluster_regularity_score | 6 |
| **Contextual** | wind_speed, wind_direction, temperature, humidity (from ERA5) | 4 |
| **Derived** | brightness_zscore_local, frp_per_km2, industrial_density_5km, night_fire_ratio | 4 |
| **TOTAL** | | **34** |

### 4.2 Feature Store

```
ml/
├── features/
│   ├── feature_engineering.py    # Main pipeline
│   ├── feature_definitions.yaml  # Name, type, description, source
│   ├── feature_stats.json        # Mean, std, min, max for scaling
│   └── feature_version.txt       # Hash of feature definitions
```

## 5. ML Inference Flow

```
┌─────────────────────┐
│  NEW EVENT BATCH    │  (from ingestion queue)
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  FEATURE VECTORIZER │  Load feature_stats.json → scale/encode
│  - Numeric: StandardScaler (mean/std from train)
│  - Categorical: TargetEncoder (fitted on train)
│  - Missing: median imputation (train median)
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  MODEL PREDICT      │  XGBoost Booster.predict_proba
│  - Load latest model from MLflow/Model Registry
│  - Output: probas [4 classes] + pred_class
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  SHAP EXPLAINER     │  TreeExplainer (fast, exact for trees)
│  - shap_values: (n_samples, n_features, n_classes)
│  - base_values: expected value per class
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  EVIDENCE BUILDER   │  Combine SHAP + Rule-based
│  1. Top 5 SHAP features (positive for predicted class)
│  2. Rule checks:
│     - dist_to_industrial < 1km → "Proximity to industrial site"
│     - cluster_detection_count > 10 → "Persistent source"
│     - brightness_trend > 0.5K/day → "Intensifying heat"
│  3. Format: structured JSON for frontend
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  STORE RESULTS      │
│  - classifications: event_id, class, confidence, model_version
│  - event_features: append SHAP values (JSONB)
│  - Invalidate API cache for event
└─────────────────────┘
```

## 6. API Data Flow

### 6.1 Query: `GET /events`

```
Request: GET /events?bbox=72,18,74,20&class=industrial_fire&limit=100&offset=0

1. Validate params (Pydantic)
2. Cache key: hash(params) → check Redis
3. If cache miss:
   a. Build PostGIS query:
      SELECT id, geom, brightness, confidence, acq_datetime, 
             class, confidence as class_confidence
      FROM thermal_events e
      JOIN classifications c ON e.id = c.event_id
      WHERE e.geom && ST_MakeEnvelope(72, 18, 74, 20, 4326)
        AND c.class = 'industrial_fire'
      ORDER BY e.acq_datetime DESC
      LIMIT 100 OFFSET 0
   b. Convert to GeoJSON FeatureCollection
   c. Cache in Redis (TTL 60s)
4. Return: { features: [...], pagination: {...}, cached: bool }
```

### 6.2 Query: `GET /events/{id}/evidence`

```
Response:
{
  "event_id": "evt_abc123",
  "predicted_class": "industrial_fire",
  "confidence": 0.92,
  "model_version": "v2024.01.15-xgb-v3",
  "evidence": {
    "positive_factors": [
      {"factor": "proximity_to_industrial", "weight": 0.35, "detail": "0.8km from chemical plant"},
      {"factor": "persistence", "weight": 0.28, "detail": "15 detections in 30 days"},
      {"factor": "brightness_intensity", "weight": 0.22, "detail": "340K (95th percentile)"},
      {"factor": "brightness_trend", "weight": 0.15, "detail": "+2.3K/day increasing"}
    ],
    "negative_factors": [
      {"factor": "land_cover_forest", "weight": -0.12, "detail": "Adjacent to forest cover"}
    ],
    "shap_summary": {
      "top_features": [
        {"feature": "dist_to_nearest_industrial_km", "shap_value": 0.31},
        {"feature": "cluster_detection_count", "shap_value": 0.24},
        {"feature": "brightness", "shap_value": 0.18}
      ]
    }
  },
  "generated_at": "2024-01-15T10:30:00Z"
}
```

## 7. Frontend Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND STATE                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │  TanStack   │    │   React     │    │   MapLibre  │         │
│  │   Query     │◀───│  Context    │───▶│    Map      │         │
│  │  (Server    │    │  (UI State) │    │  (Visual)   │         │
│  │   State)    │    │             │    │             │         │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘         │
│         │                  │                  │                │
│         ▼                  ▼                  ▼                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                    DATA LAYER                            │  │
│  │  • useEvents(bbox, filters) → /events                   │  │
│  │  useEventDetails(id) → /events/{id}                     │  │
│  │  useEventEvidence(id) → /events/{id}/evidence           │  │
│  │  useEventHistory(id) → /events/{id}/history             │  │
│  │  useAnalytics() → /analytics/summary                    │  │
│  │  useWebSocket() → /ws/events (real-time)                │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 7.1 Map Rendering Strategy

| Zoom Level | Rendering Approach |
|------------|-------------------|
| 0-8 | No events (show analytics summary only) |
| 9-11 | Clustered markers (supercluster, radius 60px) |
| 12-14 | Individual markers + cluster count badges |
| 15+ | Individual markers + labels + evidence preview on hover |

### 7.2 Real-time Updates (WebSocket)

```typescript
// Server pushes: { type: "event_new", payload: EventGeoJSON }
//                 { type: "event_classified", payload: { event_id, class, confidence } }
//                 { type: "analytics_update", payload: AnalyticsSummary }

const ws = new WebSocket(`${WS_URL}/ws/events`);
ws.onmessage = (msg) => {
  const update = JSON.parse(msg.data);
  switch (update.type) {
    case 'event_new':
      queryClient.setQueryData(['events', bbox], (old) => 
        addFeature(old, update.payload)
      );
      break;
    case 'event_classified':
      queryClient.setQueryData(['event', update.payload.event_id], (old) =>
        ({ ...old, classification: update.payload })
      );
      break;
  }
};
```

## 8. Data Retention & Archival

| Data Tier | Retention | Storage | Access Pattern |
|-----------|-----------|---------|----------------|
| **Raw FIRMS CSV** | 90 days | Object Storage (S3/MinIO) | Re-processing, audit |
| **Thermal Events** | 2 years | PostGIS (partitioned by month) | Active queries |
| **Event Features** | 2 years | PostGIS (JSONB) | ML retraining, explainability |
| **Classifications** | 2 years | PostGIS | Active queries, audit |
| **Historical Observations** | 5 years | PostGIS (partitioned) | Trend analysis |
| **Aggregated Analytics** | Forever | PostGIS (materialized views) | Dashboards, reports |
| **Model Artifacts** | Forever | MLflow / Model Registry | Reproducibility, rollback |

## 9. Monitoring & Data Quality

### 9.1 Ingestion Metrics (Prometheus)

```python
# Metrics exported by ingestion pipeline
firms_records_fetched_total{source="VIIRS_SNPP"}
firms_records_valid_total{source="VIIRS_SNPP"}
firms_records_dropped_total{source="VIIRS_SNPP", reason="validation|dedup|enrichment"}
firms_ingestion_duration_seconds{source="VIIRS_SNPP"}
firms_events_stored_total
firms_enrichment_duration_seconds
```

### 9.2 Data Quality Checks

| Check | Frequency | Alert Threshold |
|-------|-----------|-----------------|
| Events ingested per run | Every run | <100 (India) / <1000 (Global) |
| Validation failure rate | Every run | >5% |
| Enrichment null rate | Daily | >20% for industrial proximity |
| Classification coverage | Hourly | <95% of new events classified |
| Model prediction latency | Per batch | >500ms per 1000 events |
| API error rate | Continuous | >1% |

## 10. Reprocessing & Backfill

```bash
# Backfill ingestion for date range
make data-ingest-backfill START=2024-01-01 END=2024-01-31

# Re-enrich existing events (e.g., new OSM data)
make data-enrich-backfill BATCH_SIZE=1000

# Re-run classification with new model
make ml-predict-backfill MODEL_VERSION=v2024.02.01-xgb-v4
```

---

## Related Documents
- [System Architecture](system-architecture.md)
- [Database Architecture](database-architecture.md)
- [ML Architecture](ml-architecture.md)
- [FIRMS Research](../research/firms.md)
- [OSM Research](../research/osm.md)