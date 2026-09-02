# Deployment Architecture — SIH26162 Industrial Thermal Intelligence

This document describes the **target** deployment topology. It does not claim anything is
running; it explains how the pieces fit and where the long-running work actually belongs.

## 1. Components

| Component | Tech | Repo path | Deploy target |
|---|---|---|---|
| Frontend | Next.js 14 (App Router), `output: standalone` | `apps/web` | Vercel (preferred) or Docker behind nginx |
| Backend API | FastAPI + Uvicorn | `apps/api` | Docker container (any orchestrator) |
| Relational DB | PostgreSQL 16 + PostGIS 3.4 | — | Managed Postgres / container volume |
| Cache / queue | Redis 7 | — | Container / managed |
| (Optional) Ingestion worker | Python batch job | `ml/`, `scripts/` | Cron / scheduled Action / separate container |
| (Optional) Model training | MLflow + trainer | `ml/` | Ephemeral job |

## 2. Request flow

```
Browser
  │
  ▼
Next.js (apps/web)  ──demoProvider (default, offline)──► seeded dataset
  │                         │
  │  NEXT_PUBLIC_API_URL set │ apiProvider
  ▼                         ▼
                    FastAPI (apps/api)
                      │  ├─ /health, /health/ready   (k8s/Docker probes)
                      │  ├─ /events, /events/{id}/…   (CRUD + evidence + report)
                      │  ├─ /analytics/summary,/density
                      │  └─ /intelligence/persistent-sources,/watchtower
                      ▼
                 PostgreSQL + PostGIS   (thermal_events, classifications,
                                         historical_observations, industrial_sites,
                                         event_features)
                      ▲
                 Redis (cache / future task queue)
```

The frontend is **provider-agnostic**: `demoProvider` serves the seeded dataset with zero
backend; `apiProvider` hits the FastAPI endpoints. Switching is a single env var
(`NEXT_PUBLIC_API_URL`) — no component changes.

## 3. Schema ownership

**Alembic is the single source of truth.** The API runs `alembic upgrade head` on boot.
The raw SQL in `database/seeds/*.sql` is **demo enrichment data only** (industrial sites,
sample events) and must be applied *after* migrations, never mounted into the Postgres
`initdb` directory (that would race Alembic and fail). For a clean demo, prefer
`POST /api/v1/admin/seed` (development only).

## 4. Long-running / background work — where it actually lives

These are **NOT** faked inside the request path:

- **FIRMS polling** — a scheduled job (cron / GitHub Action / container) fetches NASA FIRMS
  area JSON, normalizes it (`ml/src/preprocessing`), and inserts `thermal_events`.
- **OSM / industrial-context enrichment** — batch job that resolves nearby industrial sites
  and writes `industrial_sites` + proximity features.
- **ML classification** — today `classification_service` is a deterministic **mock**
  (`mock-v0.2`). Replacing it with a real model is a single-function swap (keep the
  signature + 4-label vocab). Training runs in an ephemeral MLflow job; inference is an HTTP
  call to `ML_SERVICE_URL` (fail-open by default).
- **Prioritisation / watchtower** — derived on read from `thermal_events` + `classifications`;
  no separate worker needed.

## 5. Local stack

```bash
cp .env.example .env          # fill FIRMS_MAP_KEY etc. only if going live
docker compose up             # db + redis + api + web
# optional reverse proxy:
docker compose --profile proxy up
```

Backend health: `GET /api/v1/health` (liveness, always 200) and
`GET /api/v1/health/ready` (503 until Postgres answers).

## 6. Production checklist

- [ ] PostGIS 16 + PostGIS 3.4 instance with a managed volume.
- [ ] `DATABASE_URL` / `DATABASE_URL_SYNC` point at the managed DB; `ENVIRONMENT=production`
      (disables Swagger + seeding).
- [ ] `NEXT_PUBLIC_API_URL` points at the deployed API; CORS origins set.
- [ ] Secrets via the platform secret store — **never** commit `.env`.
- [ ] Ingestion worker scheduled (FIRMS + OSM).
- [ ] (Optional) trained model behind `ML_SERVICE_URL`; set `ML_FAIL_OPEN=false` in prod once
      the model is trusted.
- [ ] Health probes wired to `/health` + `/health/ready`.
