# SIH26162 — Project Readiness Report

**Generated:** 2026-09-02 (rescue & deploy audit, Phases 1–8)
**Scope:** Inspect the entire on-disk project, verify it runs, audit the end-to-end
pipeline, fix blockers, scan for secrets, and document deployment. The NEW GitHub
repository (Phases 9–12) is **BLOCKED pending a repository URL from the user** — see
§9.

> **Golden rule applied:** the on-disk filesystem was treated as the source of truth.
> The old Git history was **not** trusted, no destructive Git operations were performed,
> and no secrets were committed.

---

## 1. Inventory (Phases 1–2)

The working tree is a **double-nested checkout** of `PruvCode/sih26162-industrial-thermal-intelligence`:

| Location | Role | Git? |
|---|---|---|
| `C:/Users/pruth/sih26162-industrial-thermal-intelligence/` (outer) | Monorepo template: `apps/api` (backend), `ml/`, `gis/`, `database/`, `data/`, `infra/`, `packages/`, `tests/`, `scripts/`, root configs | yes (`origin` = SSH PruvCode) |
| `…/sih26162-industrial-thermal-intelligence/` (inner) | **Live frontend** at `apps/web` (branch `frontend-audit-remediation`) + its own `database/`, `docs/`, `docker-compose.yml`, `.github/` | yes (separate repo, HTTPS PruvCode) |
| `apps/web/` (outer) | **Stale scaffold** — references a phantom `@sih/shared` package; not the real frontend | (within outer repo) |

**What actually makes the product:**
- **Backend** — `apps/api/` (51 source files): FastAPI app, Alembic migration, 5 endpoint
  modules (health, events, analytics, intelligence, admin), services (event, classification,
  evidence, intelligence, analytics), SQLAlchemy models, geo `PointColumn`, tests.
- **Frontend** — inner `apps/web/src`: Next.js 14 App Router; provider-agnostic data layer
  (`demoProvider` default, `apiProvider` for live); cinematic globe, investigation, map,
  navigator, analytics, watchtower.
- **ML** — `ml/src`: ingestion (FIRMS reader), preprocessing, features, models (trainer),
  evaluation, explainability. **`ml/src/inference/` is empty** (see §4).
- **Infra/data** — `database/seeds` (synthetic demo SQL), `infra/docker/nginx.conf` (added
  this pass), `gis/`, `data/`, `scripts/`, `packages/`.

---

## 2. Runnability (Phase 3) — what was actually executed

| Check | Command | Result |
|---|---|---|
| Backend tests | `apps/api/.venv/Scripts/python -m pytest` (SQLite) | ✅ **25 passed** |
| Backend lint | `ruff check app tests` | ✅ All checks passed |
| Backend boot | `uvicorn app.main:app` → `GET /` | ✅ service identity JSON |
| Backend liveness | `GET /api/v1/health` | ✅ `{"status":"healthy",…}` |
| Backend readiness | `GET /api/v1/health/ready` (no DB) | ✅ HTTP 503 (correct — DB down) |
| Backend Swagger | `GET /docs` | ✅ 200 (dev only) |
| Frontend typecheck | `npm run typecheck` | ✅ clean |
| Frontend build | `npm run build` (Next 14.2.21) | ✅ compiled, 4 static pages |

> **Environment limits (no fakes claimed):** Postgres/PostGIS and Docker are **not installed**
> in this sandbox, so the DB-backed live endpoints (`/events`, `/analytics/*`,
> `/intelligence/*`) were verified via the **SQLite-backed test suite** (which exercises the
> same services/endpoints through an in-memory DB) rather than a live PostGIS instance.
> A real PostGIS container is required to certify spatial queries end-to-end.

---

## 3. End-to-End Pipeline Audit (Phase 4)

Legend: ✅ working · 🟡 partial/mock · ⚠️ present-but-unwired · ❌ missing

| # | Stage | Status | Notes |
|---|---|---|---|
| 1 | NASA FIRMS ingestion | ⚠️ | `ml/src/ingestion/firms_reader.py` exists; no live API key; not wired into backend. |
| 2 | Normalization / cleaning | 🟡 | `ml/src/preprocessing/cleaner.py` exists; not integrated with backend ingest path. |
| 3 | Thermal detections | ✅ | `ThermalEvent` model + `seed_mock_events` produce detections. |
| 4 | Event linking (history) | ✅ | `historical_observations` model + `get_historical_observations`. |
| 5 | Industrial context (proximity) | 🟡 | `industrial_sites` table + seeds; haversine proximity is **Postgres-only** (SQLite shim skips it). |
| 6 | ML classification | 🟡 | `classification_service` is a **deterministic mock** (`mock-v0.2`); `ml/src/inference/` is empty. Frontend label vocab matches exactly. |
| 7 | Persistence (DB) | ✅ | SQLAlchemy models + Alembic `0001`; SQLite tests pass; PostGIS needs real DB. |
| 8 | Prioritisation | ✅ | `intelligence_service` computes watchtower + persistent-sources; priority bands in UI. |
| 9 | Evidence assembly | ✅ | `evidence_service.assemble_evidence`; `GET /events/{id}/evidence`. |
| 10 | Investigation report | ✅ | `GET /events/{id}/report`; `InvestigationPanel` UI. |
| 11 | PostGIS spatial | 🟡 | Models emit `geometry(POINT,4326)`; verified only via SQLite shim here. |
| 12 | FastAPI backend | ✅ | Boots; all endpoints implemented; 25 tests pass. |
| 13 | Next.js frontend | ✅ | Builds + typechecks. |
| 14 | UI rendering | ✅ | Demo dataset renders fully offline. |
| 15 | UI↔API wiring | 🟡 | `apiProvider` maps all endpoints; `/watchtower` returns counts only (documented contract gap); live mode needs backend+DB. |

**Net:** the product is **runnable and demonstrable today in demo mode** (no backend, no
keys). The live path is fully implemented but requires a PostGIS instance + (optionally) a
real FIRMS key + a trained model to go beyond the mock classifier.

---

## 4. Fixes Applied (Phase 5)

| File | Change | Why |
|---|---|---|
| `apps/api/Dockerfile` | **Created** (prod FastAPI, runs `alembic upgrade head` on boot) | docker-compose referenced a missing Dockerfile. |
| `sih26162-industrial-thermal-intelligence/apps/web/Dockerfile` | **Created** (prod Next.js `standalone`) | Missing — blocked `web` image build. |
| `infra/docker/nginx.conf` | **Created** (minimal reverse proxy) | Referenced by `nginx` `proxy` profile. |
| `docker-compose.yml` (root) | **Rewritten** to canonical: PostGIS + Redis + API + web + optional nginx; env-var injection; Alembic as schema source of truth | Old version referenced missing Dockerfiles and lacked Redis/healthchecks. |
| `.gitignore` (root) | **Hardened**: secrets first, keeps `.env.example`, **no longer ignores `package-lock.json`** (reproducible frontend builds), adds `*.pem/*.key/secrets/` | Repo must never ship secrets; lockfile must be tracked. |

**Known gaps NOT fixed (require external decisions / infra):**
- `ml/src/inference/` empty → swap mock classifier for real model later (boundary documented in `classification_service.py`).
- Inner `.env.example` uses a different variable shape than backend `Settings` (uses `APP_ENV`/`POSTGRES_*`; backend reads `ENVIRONMENT`/`DATABASE_URL`/`FIRMS_API_KEY`). The backend's own `apps/api/.env.example` is authoritative.
- Backend `database/seeds/*.sql` (raw PostGIS) vs Alembic: kept Alembic as source of truth; SQL seeds are optional enrichment (apply after migrations).

---

## 5. Security Scan (Phase 6)

- ✅ No real `.env` files on disk (only `.env.example` templates).
- ✅ Grep for private keys, GitHub/OpenAI/Google/AWS tokens, and non-placeholder
  `FIRMS_API_KEY` across all source → **zero matches**.
- ✅ `.gitignore` excludes `.env`, `.env.*` (keeps `.env.example`), `.venv`, `node_modules`,
  `.next`, `*.pem`, `*.key`, `secrets/`.
- ⚠️ Inner `.env.example` still carries placeholder secrets — fine, but consolidate to the
  backend's `.env.example` shape in the new repo.

---

## 6. Deployment Architecture (Phase 7)

**Target topology**
```
            Vercel (static + serverless)
   Browser ──► Next.js (apps/web)  ──►  FastAPI (apps/api)
                                  │          │
                                  │          ├──► PostgreSQL + PostGIS  (db)
                                  │          └──► Redis (cache / queue) (redis)
                                  │
        Optional ingestion/worker ──► NASA FIRMS + OSM  ──► ML service (mock today)
```
- **Frontend:** Next.js 14, `output: 'standalone'`, deployable to Vercel (or the included
  Docker image behind nginx). Defaults to the **demo provider**; set `NEXT_PUBLIC_API_URL`
  to go live.
- **Backend:** FastAPI + Uvicorn in Docker; Alembic manages schema; `/health` (liveness) and
  `/health/ready` (readiness, 503 when DB down) for orchestration.
- **Long-running work (ingestion / model training):** **NOT faked.** FIRMS polling, OSM
  enrichment, and model (re)training are batch jobs that belong in a **separate worker /
  scheduled service** (cron, GitHub Action, or a container) that writes into PostGIS — not
  inside the request path. The backend exposes `POST /api/v1/admin/seed` for demo data only.
- **Local:** `docker compose up` brings up db + redis + api + web (+ optional `nginx` via
  `--profile proxy`).

---

## 7. Readiness Verdict (Phase 8 — 15 checks)

| # | Check | Result |
|---|---|---|
| 1 | Repo inspects without Git changes | ✅ read-only |
| 2 | Backend installs / venv present | ✅ |
| 3 | Backend tests pass | ✅ 25/25 (SQLite) |
| 4 | Backend lint clean | ✅ |
| 5 | Backend boots + `/` + `/health` | ✅ |
| 6 | Frontend typecheck | ✅ |
| 7 | Frontend build | ✅ |
| 8 | API endpoints implemented (health/events/analytics/intelligence/admin) | ✅ |
| 9 | DB schema (Alembic) present | ✅ (PostGIS not verifiable here) |
| 10 | Demo data path (seed / demo provider) | ✅ |
| 11 | Secrets scan clean | ✅ |
| 12 | `.gitignore` covers secrets/build | ✅ |
| 13 | Docker images buildable (Dockerfiles present) | ✅ (unbuilt — no Docker here) |
| 14 | Deployment docs present | ✅ (this file + §6) |
| 15 | End-to-end live (UI↔API↔PostGIS) verified | 🟡 needs PostGIS + keys (demo mode fully works) |

**Verdict:** ✅ **Deployable in demo mode; live mode ready pending a PostGIS instance and
optional FIRMS key / trained model.** No P0/P1 startup, import, route, or connection
blockers remain in code.

---

## 8. New Repository (Phases 9–12) — BLOCKED

Per the instruction, the new GitHub repository must be created **only after** the audit and
runnability check are complete. That is done. However, Phase 9–11 cannot proceed because:

1. **Name conflict:** the requested name `sih26162-industrial-thermal-intelligence` already
   exists at the current remote (`git@github.com:PruvCode/sih26162-industrial-thermal-intelligence.git`).
   I will **not** force-push or overwrite it.
2. **URL missing:** Phase 11 requires "the new repository URL provided by me." No new/empty
   repo URL has been supplied yet.

**Action needed from the user (one of):**
- Provide the URL of a **new, empty** GitHub repository (any name/owner), **or**
- Confirm the exact owner/name to `gh repo create`, **or**
- Confirm I may reuse an existing empty repo you create.

Once the URL is provided I will: assemble a single clean tree (inner `apps/web` + outer
`apps/api` + `ml/`, `gis/`, `database/`, `infra/`, `data/`, `packages/`, `tests/`, `scripts/`,
`docs/`, root configs), init a fresh git repo, commit in meaningful logical stages
(backend foundation → thermal-event APIs → geospatial intelligence → analytics/watchtower →
frontend integration → tests → deploy config), push normally (no force), and verify the
remote before claiming success.
