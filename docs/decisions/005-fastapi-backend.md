# ADR-005: FastAPI for Backend API

## Status
Accepted

## Context
We need a Python backend API that:
- Serves spatial data (GeoJSON) efficiently
- Integrates with SQLAlchemy/PostGIS
- Provides automatic OpenAPI docs
- Supports async for concurrent requests
- Type-safe with Pydantic
- Easy to test and deploy

## Decision
Use **FastAPI** with **SQLAlchemy 2.0 (async)**, **Pydantic v2**, and **Alembic**.

## Consequences

### Positive
- **Async native**: `async/await` for high concurrency (critical for spatial queries)
- **Auto OpenAPI**: `/docs` and `/redoc` generated from type hints
- **Pydantic integration**: Request/response validation, serialization
- **Dependency injection**: Clean separation of concerns (DB, auth, config)
- **Performance**: One of fastest Python frameworks (Starlette + Uvicorn)
- **Type safety**: Full mypy support with Pydantic v2
- **Testing**: Easy with `httpx.AsyncClient` and `pytest-asyncio`
- **Deployment**: Single Uvicorn process, Docker-friendly

### Negative
- **Less batteries-included**: No admin, auth, ORM built-in (but we choose our own)
- **Async learning curve**: Team must understand async patterns
- **Middleware ecosystem**: Smaller than Django/Flask

### Neutral
- **Alternatives considered**:
  - **Django + GeoDjango**: Great admin/auth, but sync, heavier, ORM less flexible for complex spatial
  - **Flask**: Simple but no async, no auto-docs, manual validation
  - **Starlette alone**: Too low-level, reimplement FastAPI features
  - **FastAPI + Django Ninja**: If Django needed for admin later

## Architecture

```
apps/api/
├── app/
│   ├── main.py              # FastAPI app factory
│   ├── api/
│   │   ├── routes/
│   │   │   ├── events.py    # GET /events, /events/{id}
│   │   │   ├── analytics.py # GET /analytics/summary
│   │   │   └── health.py    # GET /health
│   │   └── deps.py          # Dependencies (DB, auth, rate limit)
│   ├── core/
│   │   ├── config.py        # Pydantic Settings
│   │   ├── database.py      # SQLAlchemy async engine
│   │   └── security.py      # Auth (future)
│   ├── db/
│   │   ├── session.py       # Async session manager
│   │   └── base.py          # Declarative base
│   ├── models/
│   │   ├── thermal_event.py # SQLAlchemy models
│   │   ├── industrial_site.py
│   │   └── classification.py
│   ├── schemas/
│   │   ├── event.py         # Pydantic request/response
│   │   └── analytics.py
│   ├── services/
│   │   ├── event_service.py # Business logic
│   │   └── analytics_service.py
│   └── utils/
│       └── geo.py           # GeoJSON helpers
├── alembic/                 # Migrations
├── tests/
└── pyproject.toml
```

## Key Patterns

### Async Database
```python
# app/core/database.py
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

engine = create_async_engine(
    settings.DATABASE_URL.replace('postgresql://', 'postgresql+asyncpg://'),
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True
)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
```

### Pydantic Schemas with Geometry
```python
# app/schemas/event.py
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class EventResponse(BaseModel):
    id: str
    geometry: dict  # GeoJSON Point
    brightness: float
    confidence: float
    acq_datetime: datetime
    satellite: str
    instrument: str
    classification: Optional['ClassificationResponse'] = None
    
    model_config = ConfigDict(from_attributes=True)
```

### Spatial Query Service
```python
# app/services/event_service.py
from sqlalchemy import select, func
from geoalchemy2.functions import ST_AsGeoJSON, ST_Distance

async def get_events_in_bbox(
    db: AsyncSession, 
    bbox: tuple[float, float, float, float],  # minx, miny, maxx, maxy
    filters: EventFilters,
    limit: int = 1000
) -> list[Event]:
    # Build query with spatial index
    stmt = (
        select(ThermalEvent)
        .join(Classification, isouter=True)
        .where(
            ThermalEvent.geom.ST_Intersects(
                func.ST_MakeEnvelope(*bbox, 4326)
            )
        )
        .order_by(ThermalEvent.acq_datetime.desc())
        .limit(limit)
    )
    # Apply filters (class, confidence, date range)
    # ...
    result = await db.execute(stmt)
    return result.scalars().all()
```

## Related
- ADR-002: PostGIS backend (queried by FastAPI)
- ADR-006: Next.js frontend (consumes FastAPI)
- API Documentation: `docs/api/README.md`