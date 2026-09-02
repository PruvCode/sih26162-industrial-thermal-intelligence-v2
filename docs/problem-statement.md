# SIH26162 Problem Statement Interpretation

## Original Problem Statement

> **AI-Based Detection and Classification of Industrial Fires and Persistent Thermal Sources Using NASA FIRMS, OSM & Satellite Data**

## Our Interpretation

SIH26162 asks us to build an intelligent monitoring platform that:

1. **Detects** thermal anomalies from satellite sensors (NASA FIRMS: MODIS + VIIRS)
2. **Classifies** each anomaly into one of four categories:
   - **Industrial Fire** — Active combustion at industrial facilities
   - **Persistent Thermal Source** — Recurring heat signatures (flares, furnaces, kilns, power plants)
   - **Natural/Wildfire** — Forest fires, agricultural burning, volcanic activity
   - **Other** — Urban heat islands, false positives, unknown
3. **Explains** classifications with geospatial evidence and confidence scores
4. **Enables** analyst investigation through a GIS command center

## Key Technical Challenges

| Challenge | Our Approach |
|-----------|--------------|
| **Noisy FIRMS data** | Multi-source validation, spatiotemporal deduplication, confidence filtering |
| **No ground truth labels** | Weak supervision via OSM industrial tags, persistence heuristics, expert labeling workflow |
| **Class imbalance** | Focal loss, stratified sampling, synthetic minority oversampling (SMOTE) |
| **Real-time requirements** | Incremental ingestion, materialized views, WebSocket updates |
| **Geospatial scale** | PostGIS spatial indexes, H3/quadkey tiling, vector tiles for frontend |
| **Explainability mandate** | SHAP values + rule-based evidence builder (proximity, persistence, intensity) |

## What This Is NOT

- ❌ A generic fire mapping dashboard
- ❌ A wildfire-only tracking system
- ❌ A pure ML research project without operational UI
- ❌ A satellite imagery processing pipeline (we use derived thermal anomaly products)

## What This IS

- ✅ **Industrial-focused**: Purpose-built for factory/plant/flare monitoring
- ✅ **Explainable**: Every classification shows *why* (evidence panel)
- ✅ **Analyst-centric**: GIS command center for investigation, not just visualization
- ✅ **Production-minded**: Reproducible pipelines, CI/CD, testing, monitoring
- ✅ **Extensible**: Swap FIRMS → Sentinel-3, swap XGBoost → PyTorch, swap MapLibre → Deck.gl

## Success Criteria for SIH

1. **Live demo**: Ingest last 24h FIRMS data → classify → show on map with evidence
2. **Accuracy**: >85% F1 on held-out expert-labeled set (industrial vs persistent vs natural)
3. **Latency**: <2s end-to-end from FIRMS fetch to API response
4. **Usability**: Judge can click event → see evidence → replay history → export report
5. **Architecture**: Clean separation allowing parallel team development

## Scope Boundaries

### In Scope (MVP)
- FIRMS NRT ingestion (MODIS + VIIRS)
- OSM industrial site extraction (India + global fallback)
- PostGIS database with spatial indexes
- XGBoost classifier with 4 classes
- SHAP explainability + evidence panel
- Next.js + MapLibre command center
- Event investigation + timeline replay
- Summary analytics cards

### Out of Scope (Future)
- Sentinel-2/Landsat active fire confirmation
- Smoke plume modeling
- Regulatory compliance reporting
- Mobile app / field worker tools
- Multi-tenant SaaS architecture
- Real-time alerting (webhook/email/SMS)

## Assumptions & Risks

| Assumption | Risk if Wrong | Mitigation |
|------------|---------------|------------|
| FIRMS NRT latency <3h | Delayed detection | Cache + show "data age" badge |
| OSM industrial tags reliable in India | Missed sites | Supplement with India industrial corridor data |
| Persistence = industrial | False positives (volcanoes) | Multi-temporal + land cover context |
| 4 classes sufficient | Edge cases | "Other" bucket + human-in-the-loop labeling |
| Team has GIS/ML skills | Knowledge gaps | Pair programming, docs, research spikes |

## Decision Log References

- [ADR-001: FIRMS as primary source](../decisions/001-firms-primary-source.md)
- [ADR-002: PostGIS for spatial backend](../decisions/002-postgis-spatial-backend.md)
- [ADR-003: XGBoost baseline classifier](../decisions/003-xgboost-baseline.md)
- [ADR-004: MapLibre for frontend mapping](../decisions/004-maplibre-frontend.md)