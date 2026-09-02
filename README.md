# SIH26162 — Industrial Thermal Intelligence Platform

> **Smart India Hackathon 2026** | Problem Statement: **SIH26162**  
> *AI-Based Detection and Classification of Industrial Fires and Persistent Thermal Sources Using NASA FIRMS, OSM & Satellite Data*

## Overview

This platform ingests satellite-derived thermal anomalies (NASA FIRMS), enriches them with geospatial context from OpenStreetMap and industrial infrastructure databases, classifies events as industrial fires, persistent thermal sources, natural wildfires, or other categories using ML, and exposes results through a GIS-centric analyst interface for real-time monitoring and historical investigation.

## Core Capabilities

| Capability | Description |
|------------|-------------|
| **FIRMS Ingestion** | Automated pull from NASA FIRMS API (MODIS + VIIRS) with validation & deduplication |
| **Geospatial Enrichment** | PostGIS-powered spatial joins with OSM industrial sites, land use, infrastructure |
| **Persistence Analysis** | Temporal clustering to detect recurring thermal sources at same location |
| **ML Classification** | XGBoost baseline classifying: `industrial_fire`, `persistent_thermal_source`, `natural_wildfire`, `other` |
| **Explainability** | SHAP-based evidence: proximity to industry, thermal intensity, historical recurrence, confidence |
| **GIS Command Center** | MapLibre GL JS dashboard: live events, investigation panel, timeline replay, analytics |

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   NASA      │     │   Ingestion │     │  PostGIS    │     │   FastAPI   │
│   FIRMS     │────▶│  & Enrich   │────▶│  Database   │────▶│   Backend   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │                   │
       │                   ▼                   │                   ▼
       │            ┌─────────────┐            │            ┌─────────────┐
       │            │    OSM      │            │            │  Next.js    │
       └───────────▶│  Industrial │            └───────────▶│  Frontend   │
                    │  Infrastructure         (GeoJSON)     │  (MapLibre) │
                    └─────────────┘                        └─────────────┘
                           │                                    │
                           ▼                                    │
                    ┌─────────────┐                             │
                    │  ML Pipeline │────────────────────────────┘
                    │ (XGBoost +   │
                    │  SHAP)      │
                    └─────────────┘
```

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for frontend development)
- Python 3.11+ (for backend/ML development)
- Make (or use scripts directly)

### 1. Clone & Configure
```bash
git clone git@github.com:PruvCode/sih26162-industrial-thermal-intelligence.git
cd sih26162-industrial-thermal-intelligence
cp .env.example .env
# Edit .env with your NASA FIRMS MAP_KEY and other secrets
```

### 2. Start Infrastructure
```bash
make db-up        # Starts PostgreSQL + PostGIS
make db-migrate   # Runs Alembic migrations
make seed         # Loads demo industrial sites & synthetic thermal events
```

### 3. Run Development Servers
```bash
# Terminal 1: Backend API
make backend

# Terminal 2: Frontend
make frontend

# Terminal 3: ML Pipeline (optional)
make ml-train     # Train baseline model on sample data
```

### 4. Access
- **Frontend**: http://localhost:3000
- **API Docs**: http://localhost:8000/docs
- **Database**: `postgresql://postgres:postgres@localhost:5432/sih26162`

## Project Structure

```
sih26162-industrial-thermal-intelligence/
├── apps/
│   ├── api/              # FastAPI backend
│   └── web/              # Next.js frontend
├── packages/             # Shared TypeScript/Python packages
├── data/                 # Data lake (gitignored raw data)
├── ml/                   # ML pipeline & models
├── gis/                  # GIS utilities & PostGIS queries
├── database/             # Migrations, seeds, schemas
├── docs/                 # Architecture, decisions, research
├── scripts/              # Dev, CI, data scripts
├── infra/                # Docker, GitHub Actions, deployment
└── tests/                # Integration & E2E tests
```

## Key Technologies

| Layer | Stack |
|-------|-------|
| **Frontend** | Next.js 14, TypeScript, Tailwind CSS, MapLibre GL JS, TanStack Query |
| **Backend** | FastAPI, SQLAlchemy 2.0, Pydantic v2, Alembic, PostgreSQL 16 + PostGIS 3.4 |
| **ML** | XGBoost, scikit-learn, SHAP, MLflow (optional) |
| **GIS** | GeoPandas, Shapely, PyProj, Rasterio |
| **DevOps** | Docker Compose, GitHub Actions, Ruff, Black, mypy, ESLint, Prettier, pre-commit |

## Team Roles

| Role | Focus Area |
|------|------------|
| **Data/GIS Engineer** | FIRMS ingestion, OSM enrichment, PostGIS, spatial pipelines |
| **ML Engineer** | Feature engineering, model training, evaluation, explainability |
| **Backend Engineer** | API design, database models, services, performance |
| **Frontend Engineer** | Map UI, event investigation, analytics, real-time updates |
| **Research/QA** | Literature review, labeling strategy, testing, demo prep |

## Development Workflow

```bash
# Feature branches from develop
git checkout develop
git checkout -b feature/firms-ingestion-pipeline

# Conventional commits
git commit -m "feat(ingestion): add FIRMS VIIRS client with retry logic"

# PR to develop → CI runs → merge → deploy preview
```

## Documentation

- [Problem Statement](docs/problem-statement.md)
- [Product Vision](docs/product-vision.md)
- [Requirements](docs/requirements.md)
- [System Architecture](docs/architecture/system-architecture.md)
- [Data Flow](docs/architecture/data-flow.md)
- [Database Architecture](docs/architecture/database-architecture.md)
- [ML Architecture](docs/architecture/ml-architecture.md)
- [Frontend Architecture](docs/architecture/frontend-architecture.md)
- [FIRMS Research](docs/research/firms.md)
- [OSM Research](docs/research/osm.md)
- [Demo Strategy](docs/demo/demo-script.md)

## License

MIT License - see [LICENSE](LICENSE) for details.

## Security

See [SECURITY.md](SECURITY.md) for vulnerability reporting and security practices.

---

**Built for SIH 2026 by Team PruvCode** 🚀