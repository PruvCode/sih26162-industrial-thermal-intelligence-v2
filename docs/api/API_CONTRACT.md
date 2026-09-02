# API Contract — SIH26162 Thermal Intelligence

**Backend:** FastAPI (`apps/api`), mounted under `/api/v1`.
**Base URL:** `http://localhost:8000` (dev) · `NEXT_PUBLIC_API_URL` controls the
frontend's live provider.
**Status:** 14 endpoints implemented, tested (25 backend tests green), lint-clean,
Postgres/PostGIS schema generated via Alembic.

This document is the contract between `apps/api` and the frontend
`DataProvider` (`apps/web/src/lib/api/providers/api.ts`). If you change a wire
field here, change it in `app/schemas/*.py` **and** in
`apps/web/src/lib/api/dto.ts` — they mirror each other field-for-field by
design.

---

## 1. Conventions

### Pagination
List endpoints accept `page` (1-based) and `page_size` (default `20`, max `100`).
Responses use an envelope:

```json
{
  "items": [ ... ],
  "total": 142,
  "page": 1,
  "page_size": 20,
  "pages": 8
}
```

### Error envelope
Every non-2xx response is a single JSON object:

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Event abc not found",
    "details": { "event_id": "abc" }
  },
  "request_id": "req_3f2a..."
}
```

| HTTP | `code`                | Meaning / when                                              |
|------|-----------------------|-------------------------------------------------------------|
| 400  | `BAD_REQUEST`         | Malformed query (e.g. un-parseable `bbox`)                  |
| 404  | `NOT_FOUND`           | Resource missing (`NotFoundError`)                         |
| 422  | `VALIDATION_ERROR`    | Pydantic validation failed; `details.fields[]` lists each  |
| 500  | `INTERNAL_ERROR`      | Unhandled server error (details usually empty)             |

`VALIDATION_ERROR.details` shape:
```json
{ "fields": [ { "field": "date_from", "message": "..." } ] }
```

### CORS
`CORS_ORIGINS` (comma string or JSON array) from env. Default
`http://localhost:3000,http://localhost:5173`. `X-Request-ID` is echoed back.

### Dates
`date_from` / `date_to` are **date-only** strings (`YYYY-MM-DD`), validated by
FastAPI. A malformed value returns `422` with the offending field named — not a
500. Timestamps in bodies are naive ISO (`TIMESTAMP WITHOUT TIME ZONE`).

### Geometry
Wire geometry is `{ "type": "Point", "coordinates": [lon, lat] }` (GeoJSON
order). The DB stores `geometry(POINT, 4326)`; on SQLite (tests only) it
degrades to `TEXT` (WKT) — never rely on that outside the test suite.

---

## 2. Endpoints

### Health
| Method | Path                | Notes                                  |
|--------|---------------------|----------------------------------------|
| GET    | `/`                 | Service identity (name/version/env)    |
| GET    | `/api/v1/health`    | Liveness — always 200, no DB needed    |
| GET    | `/api/v1/health/ready` | Readiness — reports DB connectivity  |

`/health` and `/health/ready` intentionally do **not** require PostgreSQL at
boot (a service that can't serve `/health` when the DB is briefly down is a
service you can't monitor).

### Events
| Method | Path                                  | Purpose                              |
|--------|---------------------------------------|--------------------------------------|
| GET    | `/api/v1/events`                      | List + filter + paginate             |
| GET    | `/api/v1/events/{event_id}`           | Single event                         |
| GET    | `/api/v1/events/{event_id}/history`   | Chronological observations           |
| GET    | `/api/v1/events/{event_id}/evidence`  | Classification evidence (read-only)  |
| POST   | `/api/v1/events/{event_id}/classify`  | (Re)classify — idempotent            |
| GET    | `/api/v1/events/{event_id}/report`    | Exportable investigation report      |

**`GET /api/v1/events`** — query params:
`lon_min`, `lat_min`, `lon_max`, `lat_max` (bbox), `date_from`, `date_to`
(`YYYY-MM-DD`), `page`, `page_size`. Returns the pagination envelope of
`ThermalEvent` objects. Unknown id on the detail routes → `404`.

**`POST /api/v1/events/{event_id}/classify`** — runs the (deterministic,
placeholder) classifier and stores a `Classification`. Returns `201` on first
classification, `200` on replay (idempotent). `response.status_code` tells the
caller which. Accepts `force` to overwrite. **This replaced a write-side-effect
that previously lived inside `GET /evidence`** — evidence is now read-only and
reports label `"unknown"` for an unclassified event.

**`GET /api/v1/events/{event_id}/report`** — `404` if the event does not exist
(frontend maps this to `null`). See §4 for the response shape.

### Analytics
| Method | Path                            | Purpose                              |
|--------|---------------------------------|--------------------------------------|
| GET    | `/api/v1/analytics/summary`     | Totals, class breakdown, 7-day series |
| GET    | `/api/v1/analytics/density`     | Heatmap grid                         |

**`GET /analytics/density`** — query params: `bbox` (comma string
`w,s,e,n`), `cell_size` (degrees, default `0.1`). A malformed `bbox` → `400`
`BAD_REQUEST`. Returns:
```json
{
  "bbox": [68.0, 8.0, 98.0, 37.0],
  "cell_size_deg": 0.1,
  "generated_at": "2026-09-02T...",
  "cells": [
    { "lat": 23.05, "lon": 77.05, "count": 4, "mean_frp": 62.3, "dominant_class": "industrial_fire" }
  ]
}
```

> **Gap:** `analytics/summary` supplies totals, class breakdown and a daily
> series, but **not** priority bands, per-state counts, per-satellite counts or
> ranked sources. The frontend `getAnalytics()` fills those arrays empty and
> renders what it can. Closing this needs server-side grouping (see §6).

### Intelligence (previously "missing")
| Method | Path                              | Purpose                              |
|--------|-----------------------------------|--------------------------------------|
| GET    | `/api/v1/persistent-sources`      | Recurring sources, clustered+ranked |
| GET    | `/api/v1/watchtower`              | Monitoring digest                    |

**`GET /persistent-sources`** — `window_days` (1–365, default `30`). Returns
`{ window_days, generated_at, sources: [...] }`. Each source:
`hotspot_id, label, kind (industrial|wildfire|residue), state, district, lat,
lon, active_days, detection_count, dominant_class, max_frp, avg_brightness,
priority_score, facility_name?, facility_type?, distance_km?, first_date?,
last_date?`. Empty list (not an error) when the DB has no events.

**`GET /watchtower`** — `window_days` (1–365, default `30`). **Count-based:**
```json
{
  "generated_at": "...",
  "window_days": 30,
  "new_events": 8,
  "priority_events": 3,
  "requires_review": 1,
  "persistent_sources": 8,
  "by_class": [ { "category": "industrial_fire", "count": 5, "percentage": 62.5 } ],
  "top_regions": [ { "state": "Maharashtra", "count": 4 } ]
}
```

> **Contract gap (important):** the backend watchtower returns **aggregates, not
> event objects**. The frontend `WatchtowerDigest` also carries `newEvents`,
> `priorityEvents` and `persistentSources` *arrays*; the live provider populates
> `totals` from these counts and leaves those arrays empty. To populate them,
> the backend must expose the underlying events (a future `/events?since=...`
> or a richer watchtower payload). Tracked as a remaining issue in the readiness
> report.

---

## 3. ML label vocabulary (a hard contract)

The classifier's `LABELS` MUST be exactly:
```
["industrial_fire", "persistent_thermal_source", "natural_wildfire", "other"]
```
The frontend `mapClassLabel()` returns `undefined` for anything else, which the
UI renders as "no classification". The placeholder classifier is deterministic
(seeded from the event id) and versioned (`MODEL_VERSION = "mock-v0.2"`) but is
**not** a trained model — `caveats` in the report say so explicitly.

---

## 4. Event report response (`GET /events/{id}/report`)

```json
{
  "event_id": "abc",
  "generated_at": "2026-09-02T...",
  "classification": "industrial_fire",
  "classification_label": "industrial fire",
  "confidence": 0.82,
  "confidence_band": "high",
  "priority_band": "high",
  "priority_score": 0.61,
  "location": { "lat": 23.0, "lng": 77.0, "state": "MP", "district": "X", "breadcrumb": ["N", "VIIRS"] },
  "persistence": { "active_days": 4, "detection_count": 9, "window_days": 30 },
  "thermal": { "brightness": 340, "frp": 80.5, "satellite": "N", "instrument": "VIIRS", "daynight": "N" },
  "nearest_facility": { "name": "…", "type": "…", "distance_km": 4.2 },
  "key_evidence": [ { "factor": "thermal_signature", "weight": 0.6, "detail": "…", "source": "model" } ],
  "caveats": [ "Confidence is from the placeholder classifier…" ],
  "provenance": { "data_type": "satellite_thermal_anomaly", "primary_source": "NASA FIRMS", "satellites": "N", "model_version": "mock-v0.2", "industrial_context": "…" }
}
```

---

## 5. Admin (development only)

| Method | Path                  | Purpose                              |
|--------|-----------------------|--------------------------------------|
| POST   | `/api/v1/admin/seed`  | Idempotent demo data load           |

Seeds mock events + classifications. **Raises `NotReadyError` (→ 500/blocked) in
production** — it exists so the live provider has data to show during demos and
local runs. Idempotent: re-running does not duplicate rows.

> This endpoint is **last** in the router and is the only write endpoint today.
> The API is otherwise read-only.

---

## 6. Known gaps (also in the readiness report)

1. **Watchtower lists** — count-based, no event/source arrays (§2).
2. **Analytics breakdown** — no priority/state/satellite/source grouping (§2).
3. **Pagination-only filters** — classification, priority band, free-text search,
   sort order are applied client-side by the frontend, not the server.
4. **Real ingestion** — no FIRMS/MOSDAC pull; data arrives via `/admin/seed` or a
   future POST `/events`.
5. **Real ML** — classifier is a deterministic placeholder; swap for the trained
   service at `ML_SERVICE_URL` when ready.
