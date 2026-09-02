# API Documentation — SIH26162

## Base URL
- **Development**: `http://localhost:8000`
- **Production**: `https://api.sih26162.example.com`

## Authentication
- **MVP**: None (internal network)
- **Future**: JWT Bearer tokens, API keys for external consumers

## Rate Limiting
- **Default**: 100 requests/minute per IP
- **Burst**: 200 requests/minute
- **Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

## Response Format

### Success
```json
{
  "data": { ... },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "request_id": "req_abc123",
    "version": "v1"
  }
}
```

### Error
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid bounding box",
    "details": [
      { "field": "bbox", "issue": "min_lon must be < max_lon" }
    ]
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "request_id": "req_abc123"
  }
}
```

### Pagination
```json
{
  "data": { "features": [...] },
  "meta": {
    "pagination": {
      "limit": 100,
      "offset": 0,
      "total": 1523,
      "has_more": true
    }
  }
}
```

## Endpoints

### Health Check
```http
GET /health
```

**Response**:
```json
{
  "status": "healthy",
  "checks": {
    "database": "ok",
    "redis": "ok",
    "ml_model": "ok"
  },
  "version": "0.1.0",
  "uptime_seconds": 3600
}
```

---

### List Events
```http
GET /events
```

**Query Parameters**:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `bbox` | string | - | `min_lon,min_lat,max_lon,max_lat` (WGS84) |
| `class` | string | - | Filter: `industrial_fire`, `persistent_thermal_source`, `natural_wildfire`, `other` |
| `confidence_min` | float | 0.0 | Minimum classification confidence |
| `start_date` | datetime | - | ISO 8601 (inclusive) |
| `end_date` | datetime | - | ISO 8601 (inclusive) |
| `source` | string | - | `MODIS_NRT`, `VIIRS_SNPP_NRT`, `VIIRS_NOAA20_NRT` |
| `limit` | int | 500 | Max results (1-2000) |
| `offset` | int | 0 | Pagination offset |
| `format` | string | `geojson` | `geojson` or `json` |

**Response (GeoJSON)**:
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "evt_abc123",
      "geometry": { "type": "Point", "coordinates": [72.8777, 19.0760] },
      "properties": {
        "brightness": 312.4,
        "confidence": 0.85,
        "acq_datetime": "2024-01-15T04:30:00Z",
        "satellite": "Terra",
        "instrument": "MODIS",
        "source": "MODIS_NRT",
        "classification": {
          "class": "industrial_fire",
          "confidence": 0.92,
          "model_version": "v2024.01.15-xgb-v3"
        }
      }
    }
  ],
  "meta": {
    "pagination": { "limit": 500, "offset": 0, "total": 1523, "has_more": true }
  }
}
```

---

### Get Event Detail
```http
GET /events/{event_id}
```

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `event_id` | string | Event ID (e.g., `evt_abc123`) |

**Response**:
```json
{
  "id": "evt_abc123",
  "geometry": { "type": "Point", "coordinates": [72.8777, 19.0760] },
  "brightness": 312.4,
  "bright_t31": 298.1,
  "scan": 1.2,
  "track": 1.1,
  "frp": 12.5,
  "acq_datetime": "2024-01-15T04:30:00Z",
  "satellite": "Terra",
  "instrument": "MODIS",
  "confidence": 0.85,
  "daynight": "D",
  "source": "MODIS_NRT",
  "cluster_id": 42,
  "classification": {
    "class": "industrial_fire",
    "confidence": 0.92,
    "all_probabilities": {
      "industrial_fire": 0.92,
      "persistent_thermal_source": 0.05,
      "natural_wildfire": 0.02,
      "other": 0.01
    },
    "model_version": "v2024.01.15-xgb-v3",
    "evidence": {
      "positive_factors": [
        { "factor": "proximity_to_industrial", "weight": 0.35, "detail": "0.8km from chemical plant", "source": "rule" },
        { "factor": "persistence", "weight": 0.28, "detail": "15 detections in 30 days", "source": "rule" }
      ],
      "negative_factors": [],
      "shap_summary": {
        "top_features": [
          { "feature": "dist_to_nearest_industrial_km", "shap_value": 0.31 },
          { "feature": "cluster_detection_count", "shap_value": 0.24 }
        ]
      }
    },
    "created_at": "2024-01-15T10:30:00Z"
  },
  "enrichment": {
    "nearest_industrial_site": {
      "id": 123,
      "name": "Reliance Chemical Complex",
      "type": "chemical",
      "distance_km": 0.8,
      "bearing_deg": 45
    },
    "land_cover": "industrial",
    "admin": { "state": "Maharashtra", "district": "Raigad" },
    "population_density": 1200
  }
}
```

---

### Get Event History (Timeline)
```http
GET /events/{event_id}/history
```

**Response**:
```json
{
  "event_id": "evt_abc123",
  "cluster_id": 42,
  "observations": [
    {
      "acq_datetime": "2024-01-15T04:30:00Z",
      "geometry": { "type": "Point", "coordinates": [72.8777, 19.0760] },
      "brightness": 312.4,
      "confidence": 0.85,
      "satellite": "Terra",
      "source": "MODIS_NRT"
    },
    {
      "acq_datetime": "2024-01-14T04:45:00Z",
      "geometry": { "type": "Point", "coordinates": [72.8778, 19.0761] },
      "brightness": 308.2,
      "confidence": 0.82,
      "satellite": "Aqua",
      "source": "MODIS_NRT"
    }
  ],
  "cluster_summary": {
    "detection_count": 15,
    "unique_dates": 12,
    "temporal_span_days": 30,
    "brightness_trend_k_per_day": 2.3,
    "regularity_score": 0.78
  }
}
```

---

### Get Event Evidence (Explainability)
```http
GET /events/{event_id}/evidence
```

**Response**:
```json
{
  "event_id": "evt_abc123",
  "predicted_class": "industrial_fire",
  "confidence": 0.92,
  "model_version": "v2024.01.15-xgb-v3",
  "evidence": {
    "positive_factors": [
      { "factor": "proximity_to_industrial", "weight": 0.35, "detail": "0.8km from chemical plant", "source": "rule" },
      { "factor": "persistence", "weight": 0.28, "detail": "15 detections in 30 days", "source": "rule" },
      { "factor": "brightness_intensity", "weight": 0.22, "detail": "312K (95th percentile)", "source": "rule" },
      { "factor": "brightness_trend", "weight": 0.15, "detail": "+2.3K/day increasing", "source": "rule" }
    ],
    "negative_factors": [
      { "factor": "land_cover_industrial", "weight": -0.08, "detail": "Industrial land cover (expected)", "source": "rule" }
    ],
    "shap_summary": {
      "top_features": [
        { "feature": "dist_to_nearest_industrial_km", "shap_value": 0.31 },
        { "feature": "cluster_detection_count", "shap_value": 0.24 },
        { "feature": "brightness", "shap_value": 0.18 },
        { "feature": "cluster_brightness_trend", "shap_value": 0.12 }
      ]
    }
  },
  "generated_at": "2024-01-15T10:30:00Z"
}
```

---

### Analytics Summary
```http
GET /analytics/summary
```

**Query Parameters**:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `bbox` | string | - | Filter by bounding box |
| `start_date` | datetime | -7d | ISO 8601 |
| `end_date` | datetime | now | ISO 8601 |
| `group_by` | string | `class` | `class`, `source`, `day`, `state` |

**Response**:
```json
{
  "period": { "start": "2024-01-08T00:00:00Z", "end": "2024-01-15T23:59:59Z" },
  "totals": {
    "events": 12543,
    "classified": 12498,
    "unclassified": 45
  },
  "by_class": [
    { "class": "industrial_fire", "count": 342, "avg_confidence": 0.87 },
    { "class": "persistent_thermal_source", "count": 1876, "avg_confidence": 0.82 },
    { "class": "natural_wildfire", "count": 8921, "avg_confidence": 0.79 },
    { "class": "other", "count": 1359, "avg_confidence": 0.65 }
  ],
  "by_source": [
    { "source": "MODIS_NRT", "count": 4211 },
    { "source": "VIIRS_SNPP_NRT", "count": 5123 },
    { "source": "VIIRS_NOAA20_NRT", "count": 3209 }
  ],
  "by_day": [
    { "date": "2024-01-15", "count": 1823 },
    { "date": "2024-01-14", "count": 1756 }
  ],
  "top_clusters": [
    { "cluster_id": 42, "detection_count": 45, "centroid": [72.8777, 19.0760], "dominant_class": "industrial_fire" },
    { "cluster_id": 18, "detection_count": 38, "centroid": [70.1234, 22.4567], "dominant_class": "persistent_thermal_source" }
  ]
}
```

---

### Persistent Clusters
```http
GET /analytics/clusters
```

**Query Parameters**:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `min_detections` | int | 5 | Minimum detections in cluster |
| `bbox` | string | - | Filter by bounding box |
| `class` | string | - | Filter by dominant class |
| `limit` | int | 100 | Max results |

**Response (GeoJSON)**:
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "cluster_42",
      "geometry": { "type": "Polygon", "coordinates": [...] },
      "properties": {
        "centroid": [72.8777, 19.0760],
        "detection_count": 45,
        "unique_dates": 32,
        "temporal_span_days": 60,
        "brightness_trend_k_per_day": 2.3,
        "regularity_score": 0.78,
        "dominant_class": "industrial_fire",
        "dominant_class_ratio": 0.82,
        "associated_site": {
          "id": 123,
          "name": "Reliance Chemical Complex",
          "type": "chemical",
          "distance_m": 800
        }
      }
    }
  ]
}
```

---

### Real-time Updates (WebSocket)
```http
GET /ws/events
```

**Connection**: Upgrade to WebSocket

**Server → Client Messages**:
```json
{ "type": "event_new", "payload": { ...Event GeoJSON Feature... } }
{ "type": "event_classified", "payload": { "event_id": "evt_abc123", "class": "industrial_fire", "confidence": 0.92 } }
{ "type": "analytics_update", "payload": { ...AnalyticsSummary... } }
```

**Client → Server** (optional):
```json
{ "type": "subscribe", "bbox": [68, 6, 98, 38] }
{ "type": "unsubscribe" }
```

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request parameter validation failed |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `MODEL_UNAVAILABLE` | 503 | ML model not loaded |
| `DATABASE_ERROR` | 503 | Database connection failed |

---

## OpenAPI/Swagger
- **Development**: `http://localhost:8000/docs` (Swagger UI)
- **Development**: `http://localhost:8000/redoc` (ReDoc)
- **Schema**: `http://localhost:8000/openapi.json`

---

## Versioning
- **URL**: `/api/v1/...` (future)
- **Current**: No version prefix (MVP)
- **Headers**: `Accept: application/vnd.sih26162.v1+json`

---

## SDKs (Future)
- **Python**: `pip install sih26162-client`
- **TypeScript**: `npm install @sih26162/api-client`