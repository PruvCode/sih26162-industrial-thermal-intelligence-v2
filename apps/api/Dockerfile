# apps/api/Dockerfile — Production FastAPI image for SIH26162 Thermal Intelligence API
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

COPY pyproject.toml ./
RUN pip install --upgrade pip && pip install -e .

COPY app ./app
COPY alembic.ini ./alembic.ini
COPY migrations ./migrations

EXPOSE 8000

# Liveness only — does not require the database, so a brief DB outage must not
# restart the pod (see app/api/v1/endpoints/health.py).
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
    CMD curl -fsS http://localhost:8000/api/v1/health || exit 1

# Alembic is the schema source of truth: apply migrations, then serve.
# Demo data is loaded separately via `POST /api/v1/admin/seed` (development).
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
