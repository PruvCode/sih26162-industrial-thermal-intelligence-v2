# Deployment — SIH26162 Industrial Thermal Intelligence

Target production architecture (changed from the single-service monorepo deploy):

```
GitHub (PruvCode/sih26162-industrial-thermal-intelligence-v2, branch main)
   │
   ├──► Vercel   : frontend  (apps/web, Next.js 14)          ← vercel.json
   │
   └──► Render   : backend   (apps/api, FastAPI + Uvicorn)   ← render.yaml (Docker)
                     │
                     └──► PostgreSQL + PostGIS
```

The frontend and backend are **separate deployments on separate providers** and
talk to each other over HTTPS via `NEXT_PUBLIC_API_URL`. Neither provider builds
the whole monorepo.

---

## 0. Prerequisites

- GitHub repo connected to both Vercel and Render.
- A **PostgreSQL + PostGIS** database (see §4 — Render's native Postgres does
  **NOT** include PostGIS, which this schema requires).
- A Render plan that allows **Docker** (the free tier does not — see §3).
- No application code changes are required for this topology; it is driven
  entirely by `vercel.json`, `render.yaml`, and environment variables.

---

## 1. Frontend → Vercel (`apps/web`)

`vercel.json` at the repo root already scopes the build:

```json
{
  "rootDirectory": "apps/web",
  "framework": "nextjs",
  "installCommand": "npm ci",
  "buildCommand": "npm run build"
}
```

**Deploy steps**

1. Import the GitHub repo in Vercel.
2. **Project Settings → General → Root Directory = `apps/web`** (this OVERRIDES
   `vercel.json`; if left at `.`, Vercel runs `npm ci` at the repo root where
   there is no lockfile and the build fails with `EUSAGE`).
3. Framework preset = Next.js (auto-detected once Root Directory is `apps/web`).
4. Build command `npm run build` and install `npm ci` are taken from
   `vercel.json`; you can leave them blank.
5. **Environment Variables (optional):**
   - `NEXT_PUBLIC_API_URL` = `https://<your-render-api>.onrender.com`
     - **Omit it** to ship the demo experience (seeded offline data, no backend).
     - **Set it** to go live against the Render API. The frontend then probes
       `${NEXT_PUBLIC_API_URL}/api/v1/health` and switches to `apiProvider`.
6. Deploy. Vercel gives you a `*.vercel.app` URL (and a custom domain if added).

The frontend is provider-agnostic and needs **no backend or API key at build
time** — `npm ci` + `npm run build` succeed with `NEXT_PUBLIC_API_URL` unset.

---

## 2. Backend → Render (Docker, `apps/api`)

`render.yaml` in this repo deploys **only** the API as a Docker web service.

**Deploy steps**

1. In Render, **New → Blueprint** and connect the GitHub repo. Render reads
   `render.yaml`.
2. The blueprint defines service `sih26162-api`:
   - `runtime: docker`, `dockerfilePath: apps/api/Dockerfile`
   - Render builds Docker from the **repo root**, so the Dockerfile's `COPY`
     paths are `apps/api/...` (already written that way).
   - `healthCheckPath: /api/v1/health`
   - `plan: starter` — **Docker requires a paid plan** (free tier is
     buildpack-only and will reject a Docker service).
3. Set the environment variables listed in `render.yaml` (also summarized in §5).
4. **Do not deploy without a database configured** unless you only want to
   verify the container boots: `alembic upgrade head` runs at container start and
   will fail (and the deploy will fail) until `DATABASE_URL_SYNC` points at a
   reachable PostGIS DB. See §4.
5. After the first successful deploy, note the `*.onrender.com` URL and put it in
   the frontend's `NEXT_PUBLIC_API_URL` (§1, step 5).

**Local Docker parity (for testing):**

```bash
# from the repo root
docker build -f apps/api/Dockerfile -t sih26162-api .
docker run -p 8000:8000 -e PORT=8000 \
  -e DATABASE_URL_SYNC=postgresql://postgres:postgres@host.docker.internal:5432/sih26162_thermal \
  sih26162-api
```

---

## 3. Render plan note (Docker)

Render's **free tier does not support Docker**. A Docker web service needs at
least the **`starter`** plan. (Native buildpack runtimes — Node/Python — are
free, but this backend is intentionally Docker so it carries GEOS/Shapely and an
identical image everywhere.) If you must stay on free, you would have to rebuild
the backend as a Render Python *buildpack* service (change `render.yaml` to
`runtime: python`, `rootDir: apps/api`, `buildCommand: pip install -e .`,
`startCommand: uvicorn app.main:app --host 0.0.0.0 --port $PORT`) — but the
Dockerfile path approach is what this repo ships.

---

## 4. Database → PostgreSQL + PostGIS (required)

The initial Alembic migration (`migrations/versions/0001_initial_schema.py`)
emits `geometry(POINT, 4326)` columns and does **not** run
`CREATE EXTENSION postgis`. Therefore the database must already be PostgreSQL
**with the PostGIS extension**.

Render's managed Postgres **add-on does not bundle PostGIS**, so `alembic
upgrade head` fails against it. Choose one:

### Option A — PostGIS as a Render Docker private service (recommended, single provider)
Uncomment the `postgis` `pserv` block in `render.yaml` (it uses the prebuilt
`postgis/postgis:15-3.4` image via `deployments/postgis/Dockerfile`) and mount a
Render disk at `/var/lib/postgresql/data`. Then set on `sih26162-api`:

```
DATABASE_URL      = postgresql+asyncpg://postgres:postgres@postgis:5432/sih26162_thermal
DATABASE_URL_SYNC = postgresql://postgres:postgres@postgis:5432/sih26162_thermal
```

Render wires private-service DNS by service name, so `postgis` resolves inside
the private network.

### Option B — External PostGIS provider
Use any PostGIS-enabled Postgres (Crunchy Bridge, a self-hosted container, etc.)
and set the two variables to its connection string (internal or external).

### Connection-string rules (important)
- `DATABASE_URL` must use the **async** driver: `postgresql+asyncpg://...`
  (the app talks asyncpg). A plain `postgresql://...` here breaks the async
  engine.
- `DATABASE_URL_SYNC` must use the **sync** driver: `postgresql://...` (Alembic
  cannot drive asyncpg).
- Both point at the **same** database.
- After the DB is reachable, the next deploy/restart runs `alembic upgrade head`
  and `/api/v1/health/ready` returns `200` (it is `503` until then).

---

## 5. Environment variables (both providers)

### Vercel (frontend)
| Key | Value | Required? |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `https://<render-api>.onrender.com` | No (omit = demo mode) |

### Render (backend, `sih26162-api`)
| Key | Value | Required? |
|---|---|---|
| `ENVIRONMENT` | `production` | Yes (disables Swagger + demo seeding) |
| `LOG_FORMAT` | `json` | Recommended (structured Render logs) |
| `TRUST_PROXY_HEADERS` | `true` | Recommended (Render terminates TLS) |
| `CORS_ORIGINS` | **JSON array string** (see below) | Yes, to accept the Vercel origin |
| `DATABASE_URL` | `postgresql+asyncpg://...` | For live data (else health/ready=503) |
| `DATABASE_URL_SYNC` | `postgresql://...` | For live data (Alembic) |

**`CORS_ORIGINS` format gotcha:** it MUST be a JSON array string, e.g.

```
["https://YOUR-VERCEL-APP.vercel.app","http://localhost:3000"]
```

NOT a comma-separated string. pydantic-settings JSON-decodes complex env fields
before the app's own comma-split validator runs, so `a,b` crashes the service at
startup with `SettingsError: error parsing value for field "CORS_ORIGINS"`. Add
your real Vercel domain as an array element. Starlette matches origins exactly
(no wildcards), because credentials are allowed.

---

## 6. Health checks

| Endpoint | Meaning | Render healthCheckPath |
|---|---|---|
| `GET /api/v1/health` | Liveness — always `200`, no DB | use this |
| `GET /api/v1/health/ready` | Readiness — `503` until Postgres answers | do NOT use for the platform check |

The Dockerfile also has an internal `HEALTHCHECK` on `/api/v1/health` (falls back
to port 8000 for local `docker run -e PORT=8000`).

---

## 7. End-to-end verification

After both deployments are live:

```bash
# 1) Backend liveness (must be 200 even before the DB is attached)
curl -i https://<render-api>.onrender.com/api/v1/health

# 2) Backend readiness (200 once PostGIS is reachable; 503 otherwise)
curl -i https://<render-api>.onrender.com/api/v1/health/ready

# 3) CORS from the Vercel origin (expect Access-Control-Allow-Origin: <vercel url>)
curl -i -H "Origin: https://<vercel-app>.vercel.app" \
  -H "Access-Control-Request-Method: GET" -X OPTIONS \
  https://<render-api>.onrender.com/api/v1/health

# 4) Frontend uses live data only if NEXT_PUBLIC_API_URL is set; otherwise it
#    serves the seeded demo. Confirm in the browser console / network tab.
```

Local equivalent (no Docker): run `uvicorn app.main:app --host 0.0.0.0 --port
8123` from `apps/api/.venv` with `ENVIRONMENT=production` and a JSON-array
`CORS_ORIGINS`, then the same curls against `localhost:8123`.

---

## 8. Security

- Secrets are never committed: root `.gitignore` excludes `.env`, `.env.*`
  (keeps `.env.example`). No `.env` is tracked.
- All backend secrets (DB credentials, `FIRMS_API_KEY`, `FIRMS_MAP_KEY`) come
  from the platform secret store / environment, never from source.
- `ENVIRONMENT=production` disables Swagger/ReDoc and OpenAPI JSON (no API
  surface disclosure).
- CORS is an explicit allow-list (no `*`).

---

## 9. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Vercel build `EUSAGE` / "No Next.js version" | Root Directory = `.` | Set Root Directory = `apps/web` |
| Render deploy fails at `alembic upgrade head` | No/ wrong DB, or PostGIS missing | Configure PostGIS DB (§4); ensure `+asyncpg` on `DATABASE_URL` |
| Service won't start: `SettingsError ... CORS_ORIGINS` | Comma-string CORS env | Use JSON array (§5) |
| Backend 503 from browser, CORS error | Vercel origin not in `CORS_ORIGINS` | Add Vercel URL to the JSON array |
| Render rejects Docker service | Free plan | Use `starter` (or buildpack runtime) |
| `/api/v1/health/ready` = 503 | Postgres unreachable | Check `DATABASE_URL_SYNC` / network |
