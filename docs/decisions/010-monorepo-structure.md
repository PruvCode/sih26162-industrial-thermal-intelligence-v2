# ADR-010: Monorepo with apps/packages Structure

## Status
Accepted

## Context
SIH26162 is built by a 5-person team working in parallel on:
- Data/GIS pipelines (Python)
- ML modeling (Python)
- Backend API (Python/FastAPI)
- Frontend (TypeScript/Next.js)
- Research/QA (Cross-cutting)

We need a repository structure that enables:
- Independent development and testing
- Shared types/config between frontend/backend
- Clear ownership boundaries
- Single CI pipeline
- Easy onboarding

## Decision
Use a **monorepo** with `apps/` for deployable units and `packages/` for shared code.

## Structure

```
sih26162-industrial-thermal-intelligence/
├── apps/
│   ├── api/              # FastAPI backend (deployable)
│   └── web/              # Next.js frontend (deployable)
├── packages/
│   ├── shared-types/     # TypeScript/Python shared types
│   ├── ui/               # Shared React components (future)
│   └── config/           # Shared configuration schemas
├── data/                 # Data lake (gitignored raw data)
├── ml/                   # ML pipeline (notebooks, src, configs)
├── gis/                  # GIS utilities & PostGIS queries
├── database/             # Migrations, seeds, schemas
├── scripts/              # Dev, CI, data scripts
├── infra/                # Docker, GitHub Actions, deployment
├── tests/                # Integration & E2E tests
├── docs/                 # All documentation
└── .github/              # Workflows, templates
```

## Consequences

### Positive
- **Atomic commits**: Cross-cutting changes (API + types + frontend) in one PR
- **Shared types**: `packages/shared-types` ensures frontend/backend contract
- **Single CI**: One pipeline tests everything
- **Code reuse**: GIS utilities shared between ingestion and API
- **Team autonomy**: Each app has own `package.json`/`pyproject.toml`
- **Tooling**: Works with Turborepo, Nx, or plain Makefile

### Negative
- **Larger clone**: But shallow clone / sparse checkout available
- **Coupling risk**: Changes in `packages/` affect multiple apps (mitigated by versioning)
- **Tool complexity**: Need to configure lint/test for multiple languages

### Neutral
- **Alternatives considered**:
  - **Polyrepo (separate repos)**: Harder to share types, coordinate releases, CI
  - **Single app (Django + templates)**: Not suitable for map-heavy frontend
  - **Backend + frontend only**: ML/GIS code would be duplicated or awkwardly placed

## Package Details

### packages/shared-types
```json
// package.json
{
  "name": "@sih26162/shared-types",
  "version": "0.1.0",
  "main": "dist/index.ts",
  "types": "dist/index.d.ts",
  "files": ["dist"]
}
```

```typescript
// src/event.ts
export interface ThermalEvent {
  id: string;
  geometry: GeoJSON.Point;
  brightness: number;
  confidence: number;
  acq_datetime: string;
  satellite: string;
  instrument: string;
  classification?: Classification;
}

export interface Classification {
  class: 'industrial_fire' | 'persistent_thermal_source' | 'natural_wildfire' | 'other';
  confidence: number;
  evidence: Evidence;
  model_version: string;
}

export interface Evidence {
  positive_factors: Factor[];
  negative_factors: Factor[];
  shap_summary: ShapSummary;
}

export interface Factor {
  factor: string;
  weight: number;
  detail: string;
  source: 'shap' | 'rule';
}
```

```python
# Python equivalent (generated or manual sync)
# ml/src/schemas.py or apps/api/app/schemas/event.py
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class ThermalEvent(BaseModel):
    id: str
    geometry: dict
    brightness: float
    confidence: float
    acq_datetime: datetime
    satellite: str
    instrument: str
    classification: Optional['Classification'] = None
```

### packages/config
```yaml
# config/firms_sources.yaml
sources:
  - MODIS_NRT
  - VIIRS_SNPP_NRT
  - VIIRS_NOAA20_NRT

area: "world"
days: 1
```

## Development Workflow

```bash
# Install all
make setup

# Run specific app
make backend      # apps/api
make frontend     # apps/web
make ml-train     # ml/

# Test specific area
make test-api
make test-web
make test-ml
```

## CI/CD

```yaml
# .github/workflows/ci.yml
jobs:
  api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
      - run: make setup-api test-api
  
  web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: make setup-web test-web
  
  ml:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
      - run: make setup-ml test-ml
```

## Related
- All ADRs (this structure enables them)
- Makefile: `Makefile`
- Docker Compose: `docker-compose.yml`