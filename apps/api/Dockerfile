# apps/api/Dockerfile — Production FastAPI image for SIH26162 Thermal Intelligence API
#
# IMPORTANT (Render build context):
#   Render builds Docker from the REPOSITORY ROOT, not from apps/api. The
#   Dockerfile path is configured as `apps/api/Dockerfile`, but every COPY
#   source is resolved relative to the repo root. That is why every COPY below
#   is prefixed with `apps/api/`. A Dockerfile written for a local
#   `docker build -f apps/api/Dockerfile .` context would use the same paths.
#
#   To build locally for testing, run from the repo root:
#     docker build -f apps/api/Dockerfile -t sih26162-api .
#     docker run -p 8000:8000 -e PORT=8000 sih26162-api

FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Build deps: GEOS for Shapely, curl for the container healthcheck.
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libgeos-dev curl \
    && rm -rf /var/lib/apt/lists/*

# Copy only the backend package manifest first (repo-root context -> apps/api/).
COPY apps/api/pyproject.toml ./
RUN pip install --upgrade pip && pip install -e .

# Now the application source, Alembic config and migrations.
COPY apps/api/app ./app
COPY apps/api/alembic.ini ./alembic.ini
COPY apps/api/migrations ./migrations

# Render injects PORT at runtime. EXPOSE documents the default for local runs;
# the CMD below actually binds to $PORT, so do not hardcode 8000 here.
EXPOSE 8000

# Liveness only — hits /api/v1/health, which does NOT require the database, so a
# brief DB outage must not restart the pod (see app/api/v1/endpoints/health.py).
# PORT falls back to 8000 for local `docker run -e PORT=8000` testing.
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
    CMD curl -fsS "http://localhost:${PORT:-8000}/api/v1/health" || exit 1

# Alembic is the schema source of truth: apply migrations, then serve.
# Demo data is loaded separately via `POST /api/v1/admin/seed` (development).
# Bind 0.0.0.0 on Render's $PORT (Render's proxy forwards to this port).
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
