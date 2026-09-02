# System Architecture — SIH26162 Industrial Thermal Intelligence

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SIH26162 INDUSTRIAL THERMAL INTELLIGENCE             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐  │
│  │ EXTERNAL │    │   INGESTION  │    │   STORAGE   │    │    SERVING   │  │
│  │ SOURCES  │    │   LAYER      │    │   LAYER     │    │    LAYER     │  │
│  ├──────────┤    ├──────────────┤    ├─────────────┤    ├──────────────┤  │
│  │          │    │              │    │             │    │              │  │
│  │ NASA     │───▶│ FIRMS Client │───▶│ PostgreSQL  │◀───│ FastAPI      │  │
│  │ FIRMS    │    │ Validator    │    │ + PostGIS   │    │ REST API     │  │
│  │ (MODIS/  │    │ Normalizer   │    │ (Timescale) │    │ WebSocket    │  │
│  │  VIIRS)  │    │ Deduplicator │    │             │    │              │  │
│  │          │    │ Enricher     │    │ Redis       │    │ Next.js      │  │
│  │ OSM      │───▶│ (OSM, Land   │    │ (Cache/     │    │ Frontend     │  │
│  │ Overpass │    │  Cover,      │    │  Sessions)  │    │ (MapLibre)   │  │
│  │ API      │    │  Admin)      │    │             │    │              │  │
│  │          │    │              │    │ MLflow      │    │              │  │
│  │ Sentinel │    │ Scheduler    │    │ (Experiments)│   │              │  │
│  │ Hub      │    │ (Airflow/    │    │             │    │              │  │
│  │ (Future) │    │  Cron)       │    │ Model       │    │              │  │
│  │          │    │              │    │ Registry    │    │              │  │
│  └──────────┘    └──────────────┘    └─────────────┘    └──────────────┘  │
│        │                │                   │                   │          │
│        │                │                   │                   │          │
│        ▼                ▼                   ▼                   ▼          │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                    ML PIPELINE (Batch / Async)                      │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │  │
│  │  │  Feature    │  │   Model     │  │  Evaluation │  │ Explain-  │  │  │
│  │  │ Engineering │──▶│  Training   │──▶│  & Registry │──▶│ ability   │  │  │
│  │  │             │  │  (XGBoost)  │  │             │  │  (SHAP)   │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └───────────┘  │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

### 1. Ingestion Layer (`ml/src/ingestion/`)
| Component | Responsibility | Technology |
|-----------|----------------|------------|
| `firms_client.py` | Fetch FIRMS NRT CSV from NASA Area API | `httpx`, async, retry/backoff |
| `validators.py` | Schema validation (Pydantic), range checks | `pydantic`, `pandera` |
| `normalizers.py` | Column standardization, CRS conversion (WGS84) | `pandas`, `pyproj` |
| `deduplicator.py` | Spatiotemporal dedup (1km, 6h window) | `geopandas`, `scipy.spatial` |
| `enricher.py` | OSM spatial join, land cover, admin lookup | `geopandas`, `rasterio` |
| `storage.py` | Batch upsert to PostGIS (COPY + ON CONFLICT) | `sqlalchemy`, `psycopg2` |
| `pipeline.py` | Orchestration (Prefect / simple cron) | `prefect` or `schedule` |

### 2. Storage Layer
| Store | Purpose | Schema |
|-------|---------|--------|
| **PostgreSQL + PostGIS** | Primary: events, sites, features, classifications, history | `database/schemas/` |
| **Redis** | API cache (tiles, analytics), session, task queue | Key-value + Pub/Sub |
| **MLflow** | Experiment tracking, model registry, artifacts | Local SQLite + file store |
| **Object Storage** (Future) | Raw FIRMS CSV, satellite imagery, model artifacts | S3 / MinIO |

### 3. ML Pipeline (`ml/src/`)
| Stage | Module | Input | Output |
|-------|--------|-------|--------|
| Feature Engineering | `features/feature_engineering.py` | Enriched events + context | Feature matrix (Parquet) |
| Training | `models/train.py` | Feature matrix + labels | Model artifact + metrics |
| Evaluation | `evaluation/evaluate.py` | Model + test set | Reports, confusion matrix |
| Explainability | `explainability/shap_explainer.py` | Model + sample | SHAP values + evidence |
| Inference | `inference/predictor.py` | Event features | Class + confidence + SHAP |

### 4. Serving Layer (`apps/api/`)
| Module | Responsibility |
|--------|----------------|
| `api/routes/events.py` | Event CRUD, filtering, GeoJSON |
| `api/routes/analytics.py` | Summary stats, clusters, trends |
| `api/routes/health.py` | Liveness, readiness, dependencies |
| `services/event_service.py` | Business logic: queries, transformations |
| `services/analytics_service.py` | Aggregations, materialized view refresh |
| `core/config.py` | Pydantic Settings from `.env` |
| `core/database.py` | SQLAlchemy async engine, session management |

### 5. Frontend (`apps/web/`)
| Area | Technology | Purpose |
|------|------------|---------|
| Map | MapLibre GL JS + MapTiler/OSM tiles | Primary spatial interface |
| State | TanStack Query + React Context | Server state + UI state |
| UI | Tailwind CSS + Headless UI / Radix | Accessible, dark-theme components |
| Charts | Recharts / Tremor | Analytics visualizations |
| Export | `@react-pdf/renderer` | Evidence report generation |

## Data Flow

### Ingestion Flow (Scheduled: Every 3 hours)
```
1. Scheduler triggers `pipeline.run()`
2. FIRMS Client fetches CSV for each source (MODIS, VIIRS_SNPP, VIIRS_NOAA20)
3. Validator checks schema, drops invalid rows, logs metrics
4. Normalizer: standardizes columns, ensures WGS84 Point geometry
5. Deduplicator: spatial index lookup → keep highest confidence per cluster
6. Enricher: 
   a. Spatial join → nearest industrial site (distance, type)
   b. Raster lookup → land cover class
   c. Admin boundary → district/state
7. Storage: batch upsert to `thermal_events` + `event_features`
8. ML Pipeline: async trigger for new events → classification
9. Cache invalidation: Redis keys for affected tiles/analytics
```

### Classification Flow (Async, per event batch)
```
1. New events detected (DB trigger / polling / message queue)
2. Feature Engineering: compute 30+ features per event
3. Predictor: load latest model → predict_proba + SHAP
4. Evidence Builder: rule-based + SHAP → structured evidence JSON
5. Store: `classifications` + `event_features` (SHAP values)
6. WebSocket: broadcast new classification to connected clients
```

### API Query Flow
```
1. Frontend requests `/events?bbox=...&class=industrial_fire&limit=500`
2. FastAPI: validate params → service layer
3. Service: 
   - Check Redis cache (key: hash of params)
   - If miss: PostGIS query with spatial index (GIST)
   - Transform to GeoJSON FeatureCollection
   - Cache in Redis (TTL: 60s)
4. Return GeoJSON + pagination metadata
```

### Frontend Render Flow
```
1. Map loads → fetches vector tiles (or GeoJSON for demo)
2. Event markers clustered at zoom < 12 (supercluster)
3. User clicks marker → fetch `/events/{id}` + `/events/{id}/evidence`
4. Drawer opens: metadata tabs + evidence panel (SHAP waterfall)
5. Timeline: fetch `/events/{id}/history` → animate on map
6. Analytics: fetch `/analytics/summary` → cards + charts
```

## Deployment Architecture (Local Dev)

```
┌─────────────────────────────────────────────────────────────┐
│                    DOCKER COMPOSE NETWORK                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │ postgres │  │  redis   │  │  mlflow  │  │   nginx    │  │
│  │  :5432   │  │  :6379   │  │  :5000   │  │   :80/443  │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │
│        │           │           │             ▲              │
│        ▼           ▼           ▼             │              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  api (FastAPI) :8000  ◀─────────────────────────────┘  │
│  └──────────────────────────────────────────────────────┘  │
│        │                                                   │
│        ▼                                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  web (Next.js) :3000                                 │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Production Considerations (Post-SIH)

| Concern | Current (Dev) | Production Target |
|---------|---------------|-------------------|
| **Orchestration** | Cron / Prefect local | Airflow / Temporal / Prefect Cloud |
| **Ingestion** | Sequential sync | Parallel async + dead letter queue |
| **ML Serving** | In-process (FastAPI) | Separate Triton / BentoML / TorchServe |
| **Caching** | Redis single | Redis Cluster + CDN for tiles |
| **Database** | Single PG | Read replicas + TimescaleDB hypertable |
| **Monitoring** | Logs only | Prometheus + Grafana + Sentry |
| **Secrets** | `.env` file | Vault / AWS Secrets Manager |
| **CI/CD** | GitHub Actions | ArgoCD / Flux + staged environments |

## Technology Decisions (ADR References)

| Decision | ADR | Rationale |
|----------|-----|-----------|
| PostGIS for spatial | [ADR-002](../decisions/002-postgis-spatial-backend.md) | Mature, performant, SQL-native, team knows it |
| FastAPI for backend | [ADR-005](../decisions/005-fastapi-backend.md) | Async, OpenAPI, Pydantic, type-safe, fast |
| Next.js for frontend | [ADR-006](../decisions/006-nextjs-frontend.md) | React ecosystem, SSR, App Router, Vercel-ready |
| MapLibre for mapping | [ADR-004](../decisions/004-maplibre-frontend.md) | Open-source, vector tiles, GL JS API, no Mapbox lock-in |
| XGBoost baseline | [ADR-003](../decisions/003-xgboost-baseline.md) | Tabular champion, fast inference, SHAP native |
| SHAP for explainability | [ADR-007](../decisions/007-shap-explainability.md) | Model-agnostic, local + global, industry standard |

## Security Boundaries

```
┌────────────────────────────────────────────────────────────────┐
│                      TRUST BOUNDARIES                          │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  INTERNET                                                      │
│     │                                                          │
│     ▼                                                          │
│  ┌─────────┐    ┌─────────────────────────────────────────┐   │
│  │  WAF/   │    │            APPLICATION ZONE             │   │
│  │ Cloudflare          ┌─────────────┐  ┌─────────────┐    │   │
│  │  (Prod)  │──────▶  │   NGINX     │──▶│   FastAPI   │    │   │
│  └─────────┘         │  (TLS Term) │    │  (Internal) │    │   │
│                      └─────────────┘    └──────┬──────┘    │   │
│                                                │            │   │
│                    ┌───────────────────────────┼────────┐  │   │
│                    │       DATA ZONE           │        │  │   │
│                    │  ┌─────────┐ ┌─────────┐  │        │  │   │
│                    │  │PostgreSQL│ │ Redis   │  │        │  │   │
│                    │  │  (SSL)   │ │ (Auth)  │  │        │  │   │
│                    │  └─────────┘ └─────────┘  │        │  │   │
│                    └────────────────────────────┘        │   │
│                                                         │   │
│  ┌─────────────────────────────────────────────────────┘   │
│  │              ML ZONE (isolated network)                 │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐                   │
│  │  │ MLflow  │ │ Model   │ │ Feature │                   │
│  │  │ Tracking│ │ Registry│ │ Store   │                   │
│  │  └─────────┘ └─────────┘ └─────────┘                   │
│  └─────────────────────────────────────────────────────────┘
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

## Scaling Strategy

| Component | Horizontal Scaling | Vertical Scaling |
|-----------|-------------------|------------------|
| **API** | Multiple replicas behind LB | Increase workers (uvicorn `--workers`) |
| **Ingestion** | Partition by source/date (Prefect map) | Larger instance for heavy raster ops |
| **ML Training** | Not needed (batch) | GPU instance for deep learning |
| **ML Inference** | Model server replicas | GPU for batch / large models |
| **Database** | Read replicas, connection pooling | TimescaleDB, partitioning, indexes |
| **Frontend** | Static export + CDN | N/A (client-side) |
| **Redis** | Cluster mode | Memory-optimized instance |

## Failure Modes & Mitigations

| Failure | Detection | Mitigation |
|---------|-----------|------------|
| FIRMS API down | Health check + ingestion alert | Exponential backoff, cache last known good |
| DB connection pool exhausted | Prometheus alert | PgBouncer, query optimization, read replicas |
| ML model load fails | `/health` model check | Fallback to previous version, circuit breaker |
| Redis OOM | Memory alert | LRU eviction, TTL tuning, cluster |
| Map tiles slow | Frontend perf monitoring | Vector tiles, clustering, bbox filtering |
| Classification drift | Monitoring dashboard | Retraining pipeline, alert on metric drop |

## Related Documents
- [Data Flow Architecture](data-flow.md)
- [Database Architecture](database-architecture.md)
- [ML Architecture](ml-architecture.md)
- [Frontend Architecture](frontend-architecture.md)
- [ADR Index](../decisions/README.md)