# Requirements — SIH26162 Industrial Thermal Intelligence

## Functional Requirements

### FR-1: Data Ingestion
| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-1.1 | Ingest NASA FIRMS NRT data (MODIS + VIIRS) via Area API | Must | Configurable sources, area, lookback |
| FR-1.2 | Validate incoming records against schema (required fields, ranges) | Must | Reject invalid, log warnings |
| FR-1.3 | Deduplicate spatiotemporal overlaps (same location ±1km, ±6h) | Must | Keep highest confidence |
| FR-1.4 | Normalize column names, units, coordinate reference system (WGS84) | Must | Standard internal schema |
| FR-1.5 | Store raw + cleaned events in PostGIS with acquisition timestamp | Must | Partition by date for performance |
| FR-1.6 | Incremental ingestion (only new records since last run) | Should | Track last processed `acq_datetime` |
| FR-1.7 | Manual re-ingestion trigger for date ranges | Could | Backfill capability |

### FR-2: Geospatial Enrichment
| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-2.1 | Extract industrial sites from OSM (Overpass API) for India + buffer | Must | Tags: `industrial=*`, `man_made=*`, `landuse=industrial` |
| FR-2.2 | Store industrial sites as PostGIS geometries with metadata | Must | Name, type, OSM ID, tags JSONB |
| FR-2.3 | Spatial join: nearest industrial site for each thermal event | Must | Distance, bearing, site type |
| FR-2.4 | Land cover classification context (ESA WorldCover / Copernicus) | Should | Raster lookup at event centroid |
| FR-2.5 | Population density context (WorldPop / GHSL) | Could | Raster lookup |
| FR-2.6 | Administrative boundary context (district, state, country) | Should | For filtering/reporting |
| FR-2.7 | Wind direction at acquisition time (ERA5 / GFS) | Could | For plume modeling future |

### FR-3: Persistence & Temporal Analysis
| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-3.1 | Cluster events spatiotemporally (DBSCAN: eps=1km, min_samples=3) | Must | Identify recurring sources |
| FR-3.2 | Compute persistence metrics per cluster: count, frequency, seasonality | Must | Daily/weekly/monthly patterns |
| FR-3.3 | Detect brightness temperature trends (increasing/decreasing/stable) | Should | Linear regression over time |
| FR-3.4 | Flag new vs. recurring clusters | Should | For alerting |
| FR-3.5 | Associate clusters with industrial sites (spatial containment) | Must | Enrich cluster with site info |

### FR-4: ML Classification
| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-4.1 | Feature engineering: 30+ features (spatial, temporal, radiometric, contextual) | Must | Documented feature dictionary |
| FR-4.2 | Train/validation/test split with temporal stratification | Must | No data leakage |
| FR-4.3 | Baseline XGBoost classifier (4 classes) | Must | Handle class imbalance |
| FR-4.4 | Model evaluation: precision, recall, F1 per class + macro/micro avg | Must | Confusion matrix, PR curves |
| FR-4.5 | Model versioning with MLflow (or local filesystem) | Should | Reproducible artifacts |
| FR-4.6 | Inference API: single event + batch | Must | <100ms per event |
| FR-4.7 | Confidence calibration (Platt scaling / isotonic regression) | Should | Reliable probabilities |
| FR-4.8 | Feature importance + SHAP explanations per prediction | Must | Feed evidence panel |

### FR-5: Explainability & Evidence
| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-5.1 | Evidence builder: structured JSON with positive/negative factors | Must | Extensible schema |
| FR-5.2 | Proximity evidence: distance to industrial site, site type match | Must | Weighted by site criticality |
| FR-5.3 | Persistence evidence: recurrence count, temporal regularity score | Must | Normalized 0-1 |
| FR-5.4 | Intensity evidence: brightness temp, FRP proxy, trend direction | Must | Compared to class baselines |
| FR-5.5 | Context evidence: land cover, population, admin boundary | Should | Supporting factors |
| FR-5.6 | Counterfactual: "What would change classification?" | Could | For analyst trust |

### FR-6: API Layer
| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-6.1 | `GET /health` — liveness/readiness | Must | Kubernetes-ready |
| FR-6.2 | `GET /events` — paginated, filterable (bbox, time, class, confidence) | Must | GeoJSON + JSON response |
| FR-6.3 | `GET /events/{id}` — full event detail with geometry | Must | Include enrichment + classification |
| FR-6.4 | `GET /events/{id}/history` — temporal sequence of related events | Must | For timeline replay |
| FR-6.5 | `GET /events/{id}/evidence` — structured explainability payload | Must | Frontend evidence panel |
| FR-6.6 | `GET /analytics/summary` — counts by class, severity, region, time | Must | Dashboard cards |
| FR-6.7 | `GET /analytics/clusters` — persistent source clusters | Should | Map layer |
| FR-6.8 | WebSocket `/ws/events` — real-time new event push | Could | Live updates |

### FR-7: Frontend — Command Center
| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-7.1 | Map view: vector tile base + event markers (clustered at low zoom) | Must | MapLibre GL JS |
| FR-7.2 | Event list panel: sortable, filterable, severity-colored | Must | Virtualized for 1000+ |
| FR-7.3 | Event detail drawer: metadata, evidence, satellite context | Must | Slide-over panel |
| FR-7.4 | Evidence panel: visual feature importance + narrative | Must | SHAP waterfall + rule text |
| FR-7.5 | Timeline replay: time slider + animation controls | Must | Historical events |
| FR-7.6 | Analytics dashboard: summary cards, charts, top clusters | Should | Recharts / Tremor |
| FR-7.7 | Keyboard shortcuts: map navigation, event selection, panel toggle | Should | Power user efficiency |
| FR-7.8 | Export: GeoJSON, CSV, PDF evidence report | Could | For regulators |

### FR-8: Data Management
| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-8.1 | Database migrations (Alembic) — reproducible schema evolution | Must | Version controlled |
| FR-8.2 | Seed scripts for demo data (synthetic, labeled DEMO) | Must | No real data in repo |
| FR-8.3 | Data retention policy (raw: 90d, processed: 2y, aggregates: forever) | Should | Configurable |
| FR-8.4 | Backup/restore procedures documented | Should | Point-in-time recovery |

---

## Non-Functional Requirements

| Category | Requirement | Target |
|----------|-------------|--------|
| **Performance** | API p95 latency (simple queries) | <200ms |
| **Performance** | API p95 latency (complex spatial) | <1s |
| **Performance** | Map initial load (1000 events) | <3s |
| **Performance** | Ingestion pipeline (daily 50k events) | <10min |
| **Performance** | ML inference (batch 1000) | <5s |
| **Scalability** | Concurrent API users | 50+ |
| **Scalability** | Database size (2 years) | <100GB |
| **Reliability** | Ingestion success rate | >99.5% |
| **Reliability** | API uptime | 99.9% (dev) |
| **Security** | No secrets in code/repo | Enforced by pre-commit |
| **Security** | API rate limiting | 100 req/min default |
| **Security** | CORS restricted to frontend origin | Configurable |
| **Observability** | Structured JSON logging | All services |
| **Observability** | Health checks (DB, Redis, ML model) | `/health` endpoint |
| **Maintainability** | Test coverage (backend) | >80% |
| **Maintainability** | Test coverage (frontend) | >70% |
| **Maintainability** | Type safety (Python + TS) | Strict mode |
| **Portability** | Runs locally via `docker compose up` | Single command |
| **Portability** | Cloud-agnostic (AWS/GCP/Azure) | Container-first |

---

## MVP Scope (SIH Submission)

### Must Have (Demo-Ready)
- [ ] FIRMS ingestion (last 24h, India bbox)
- [ ] OSM industrial sites for India (pre-loaded)
- [ ] PostGIS database with 5 core tables
- [ ] Spatial join + persistence clustering
- [ ] XGBoost model (trained on synthetic + weak labels)
- [ ] SHAP explanations + evidence JSON
- [ ] FastAPI with 6 core endpoints
- [ ] Next.js + MapLibre command center
- [ ] Event list, detail, evidence, timeline
- [ ] Analytics summary cards
- [ ] Synthetic demo data (50 events, 20 sites)
- [ ] `make setup && make dev` works on fresh clone

### Should Have (Polish)
- [ ] Vector tile caching for map performance
- [ ] WebSocket live updates
- [ ] PDF evidence export
- [ ] Keyboard shortcuts
- [ ] Loading skeletons / error boundaries
- [ ] Demo script rehearsal

### Could Have (Bonus)
- [ ] Sentinel-2 true color thumbnail per event
- [ ] Alerting webhook to Slack/Discord
- [ ] Multi-language UI toggle
- [ ] Offline PWA mode

### Won't Have (Post-SIH)
- User authentication/authorization
- Multi-tenancy
- Real-time streaming ingestion (Kafka/Flink)
- Advanced plume modeling
- Mobile app

---

## Acceptance Criteria for SIH Demo

1. **Clone → Run**: Fresh clone + `make setup && make dev` → both servers up in <5 min
2. **Live Data**: Map shows events from last 24h FIRMS pull (or seeded demo data)
3. **Classification**: Click event → shows class badge + confidence + evidence panel
4. **Evidence**: Evidence panel shows 4+ factors with visual weights
5. **History**: Timeline replay shows event recurrence at same location
6. **Analytics**: Summary cards update with filtered data
7. **No Errors**: Console clean, no 500s, no broken UI
8. **Story**: 3-minute walkthrough covers problem → architecture → live demo → impact