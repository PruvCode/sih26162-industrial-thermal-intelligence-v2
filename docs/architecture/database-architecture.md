# Database Architecture — SIH26162

## Database Choice: PostgreSQL 16 + PostGIS 3.4

**Rationale**: Mature, performant spatial database with full SQL support, excellent ecosystem, team familiarity, and cloud-agnostic.

## Schema Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SIH26162 DATABASE SCHEMA                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐       ┌──────────────────┐       ┌────────────────┐ │
│  │  thermal_events  │       │  industrial_sites │       │ classifications│ │
│  ├──────────────────┤       ├──────────────────┤       ├────────────────┤ │
│  │ id (PK)          │       │ id (PK)          │       │ id (PK)        │ │
│  │ geom (Point, 4326)◀────┐│ geom (Polygon,    │       │ event_id (FK)  │ │
│  │ brightness       │     ││ 4326)            │       │ class          │ │
│  │ bright_t31       │     ││ name             │       │ confidence     │ │
│  │ scan, track      │     ││ industrial_type  │       │ model_version  │ │
│  │ acq_datetime     │     ││ osm_id           │       │ evidence (JSONB)│
│  │ satellite        │     ││ tags (JSONB)     │       │ created_at     │ │
│  │ instrument       │     │└──────────────────┘       └────────────────┘ │
│  │ confidence       │     │          ▲                      ▲            │
│  │ frp              │     │          │                      │            │
│  │ daynight         │     │          │                      │            │
│  │ source           │     │          │                      │            │
│  │ cluster_id       │     │          │                      │            │
│  │ processed_at     │     │          │                      │            │
│  │ created_at       │     │          │                      │            │
│  └──────────────────┘     │          │                      │            │
│           │               │          │                      │            │
│           │ FK            │          │                      │            │
│           ▼               │          │                      │            │
│  ┌──────────────────┐     │          │                      │            │
│  │  event_features  │     │          │                      │            │
│  ├──────────────────┤     │          │                      │            │
│  │ event_id (PK,FK) │     │          │                      │            │
│  │ features (JSONB) │     │          │                      │            │
│  │ shap_values      │     │          │                      │            │
│  │ computed_at      │     │          │                      │            │
│  └──────────────────┘     │          │                      │            │
│                           │          │                      │            │
│  ┌──────────────────┐     │          │                      │            │
│  │ historical_      │     │          │                      │            │
│  │ observations     │─────┘          │                      │            │
│  ├──────────────────┤                │                      │            │
│  │ id (PK)          │                │                      │            │
│  │ event_id (FK)    │                │                      │            │
│  │ geom (Point)     │                │                      │            │
│  │ acq_datetime     │                │                      │            │
│  │ brightness       │                │                      │            │
│  │ confidence       │                │                      │            │
│  └──────────────────┘                │                      │            │
│                                      │                      │            │
│  ┌──────────────────┐                │                      │            │
│  │ persistence_     │                │                      │            │
│  │ clusters         │────────────────┘                      │            │
│  ├──────────────────┐                                       │            │
│  │ id (PK)          │                                       │            │
│  │ geom (Polygon)   │                                       │            │
│  │ centroid (Point) │                                       │            │
│  │ detection_count  │                                       │            │
│  │ unique_dates     │                                       │            │
│  │ temporal_span_days│                                      │            │
│  │ brightness_trend │                                       │            │
│  │ regularity_score │                                       │            │
│  │ dominant_type    │                                       │            │
│  │ associated_site_id(FK)                                   │            │
│  │ created_at       │                                       │            │
│  │ updated_at       │                                       │            │
│  └──────────────────┘                                       │            │
│                                                             │            │
└─────────────────────────────────────────────────────────────┘
```

## Table Definitions

### 1. thermal_events (Core Fact Table)

```sql
CREATE TABLE thermal_events (
    -- Primary key
    id              BIGSERIAL PRIMARY KEY,
    
    -- Geometry (WGS84, SRID 4326)
    geom            GEOGRAPHY(POINT, 4326) NOT NULL,
    
    -- Radiometric measurements
    brightness      REAL NOT NULL,           -- Kelvin (MODIS) or brightness temp (VIIRS)
    bright_t31      REAL,                    -- Band 31 brightness temp (MODIS)
    scan            REAL,                    -- Along-scan pixel size (km)
    track           REAL,                    -- Along-track pixel size (km)
    frp             REAL,                    -- Fire Radiative Power (MW)
    
    -- Acquisition metadata
    acq_datetime    TIMESTAMPTZ NOT NULL,    -- UTC acquisition time
    satellite       VARCHAR(20) NOT NULL,    -- Terra, Aqua, Suomi-NPP, NOAA-20
    instrument      VARCHAR(20) NOT NULL,    -- MODIS, VIIRS
    confidence      SMALLINT NOT NULL,       -- 0-100 (FIRMS original)
    confidence_norm REAL GENERATED ALWAYS AS (confidence / 100.0) STORED,
    daynight        CHAR(1) NOT NULL,        -- 'D' or 'N'
    source          VARCHAR(30) NOT NULL,    -- MODIS_NRT, VIIRS_SNPP_NRT, VIIRS_NOAA20_NRT
    
    -- Processing
    cluster_id      BIGINT,                  -- FK to persistence_clusters (nullable)
    processed_at    TIMESTAMPTZ,             -- When enrichment + classification done
    
    -- Audit
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_confidence CHECK (confidence BETWEEN 0 AND 100),
    CONSTRAINT valid_daynight CHECK (daynight IN ('D', 'N')),
    CONSTRAINT valid_brightness CHECK (brightness > 0 AND brightness < 500)
);

-- Partition by month for performance
CREATE TABLE thermal_events_y2024m01 PARTITION OF thermal_events
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
-- ... create partitions monthly via pg_partman or migration

-- Indexes
CREATE INDEX idx_thermal_events_geom_gist ON thermal_events USING GIST (geom);
CREATE INDEX idx_thermal_events_acq_datetime ON thermal_events (acq_datetime DESC);
CREATE INDEX idx_thermal_events_source ON thermal_events (source);
CREATE INDEX idx_thermal_events_cluster ON thermal_events (cluster_id) WHERE cluster_id IS NOT NULL;
CREATE INDEX idx_thermal_events_processed ON thermal_events (processed_at) WHERE processed_at IS NULL;
CREATE INDEX idx_thermal_events_satellite_datetime ON thermal_events (satellite, acq_datetime DESC);

-- For analytics queries
CREATE INDEX idx_thermal_events_composite ON thermal_events (source, acq_datetime DESC, confidence);
```

### 2. industrial_sites (Reference Data)

```sql
CREATE TABLE industrial_sites (
    id              BIGSERIAL PRIMARY KEY,
    
    -- Geometry (WGS84)
    geom            GEOGRAPHY(POLYGON, 4326) NOT NULL,
    centroid        GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (ST_Centroid(geom::geometry)::geography) STORED,
    
    -- Identity
    name            VARCHAR(500),
    industrial_type VARCHAR(100) NOT NULL,   -- chemical, power_plant, flare, cement, steel, etc.
    osm_id          VARCHAR(50) UNIQUE,      -- way/123456 or relation/789
    
    -- Metadata
    tags            JSONB NOT NULL DEFAULT '{}',  -- All OSM tags
    source          VARCHAR(50) NOT NULL DEFAULT 'osm',  -- osm, custom, manual
    verified        BOOLEAN NOT NULL DEFAULT FALSE,
    verified_by     VARCHAR(100),
    verified_at     TIMESTAMPTZ,
    
    -- Audit
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_industrial_sites_geom_gist ON industrial_sites USING GIST (geom);
CREATE INDEX idx_industrial_sites_type ON industrial_sites (industrial_type);
CREATE INDEX idx_industrial_sites_osm_id ON industrial_sites (osm_id);
CREATE INDEX idx_industrial_sites_name_gin ON industrial_sites USING GIN (name gin_trgm_ops);

-- Enable trigram for fuzzy name search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

### 3. event_features (Enriched Features + SHAP)

```sql
CREATE TABLE event_features (
    event_id        BIGINT PRIMARY KEY REFERENCES thermal_events(id) ON DELETE CASCADE,
    
    -- All engineered features (JSONB for flexibility)
    features        JSONB NOT NULL DEFAULT '{}',
    
    -- SHAP values per class (JSONB: feature_name → {class: value})
    shap_values     JSONB,
    
    -- Feature version for reproducibility
    feature_version VARCHAR(64) NOT NULL,  -- Hash of feature definitions
    
    computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for feature lookups
CREATE INDEX idx_event_features_version ON event_features (feature_version);
CREATE INDEX idx_event_features_features_gin ON event_features USING GIN (features);
```

### 4. classifications (Model Predictions)

```sql
CREATE TABLE classifications (
    id              BIGSERIAL PRIMARY KEY,
    event_id        BIGINT NOT NULL REFERENCES thermal_events(id) ON DELETE CASCADE,
    
    -- Prediction
    class           VARCHAR(30) NOT NULL,           -- industrial_fire, persistent_thermal_source, natural_wildfire, other
    confidence      REAL NOT NULL,                  -- Calibrated probability 0-1
    all_probas      JSONB NOT NULL,                 -- {"industrial_fire": 0.92, "persistent_thermal_source": 0.05, ...}
    
    -- Model metadata
    model_version   VARCHAR(50) NOT NULL,           -- e.g., v2024.01.15-xgb-v3
    model_type      VARCHAR(30) NOT NULL DEFAULT 'xgboost',
    
    -- Explainability
    evidence        JSONB NOT NULL DEFAULT '{}',    -- Structured evidence for frontend
    
    -- Audit
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_class CHECK (class IN ('industrial_fire', 'persistent_thermal_source', 'natural_wildfire', 'other')),
    CONSTRAINT valid_confidence CHECK (confidence >= 0 AND confidence <= 1)
);

-- Indexes
CREATE INDEX idx_classifications_event ON classifications (event_id);
CREATE INDEX idx_classifications_class ON classifications (class);
CREATE INDEX idx_classifications_model_version ON classifications (model_version);
CREATE INDEX idx_classifications_confidence ON classifications (confidence DESC);
CREATE INDEX idx_classifications_created ON classifications (created_at DESC);

-- Latest classification per event (for API)
CREATE MATERIALIZED VIEW latest_classifications AS
SELECT DISTINCT ON (event_id) 
    event_id, class, confidence, all_probas, model_version, evidence, created_at
FROM classifications
ORDER BY event_id, created_at DESC;

CREATE UNIQUE INDEX idx_latest_classifications_event ON latest_classifications (event_id);
```

### 5. historical_observations (Temporal Sequence)

```sql
CREATE TABLE historical_observations (
    id              BIGSERIAL PRIMARY KEY,
    event_id        BIGINT NOT NULL REFERENCES thermal_events(id) ON DELETE CASCADE,
    
    -- Geometry at time of observation
    geom            GEOGRAPHY(POINT, 4326) NOT NULL,
    
    -- Measurements
    acq_datetime    TIMESTAMPTZ NOT NULL,
    brightness      REAL NOT NULL,
    confidence      SMALLINT NOT NULL,
    frp             REAL,
    satellite       VARCHAR(20),
    instrument      VARCHAR(20),
    
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partition by month (same as thermal_events)
CREATE INDEX idx_historical_event_datetime ON historical_observations (event_id, acq_datetime DESC);
CREATE INDEX idx_historical_geom_gist ON historical_observations USING GIST (geom);
```

### 6. persistence_clusters (Computed Clusters)

```sql
CREATE TABLE persistence_clusters (
    id                      BIGSERIAL PRIMARY KEY,
    
    -- Cluster geometry (convex hull of member events)
    geom                    GEOGRAPHY(POLYGON, 4326) NOT NULL,
    centroid                GEOGRAPHY(POINT, 4326) NOT NULL,
    
    -- Persistence metrics
    detection_count         INTEGER NOT NULL,
    unique_dates            INTEGER NOT NULL,
    temporal_span_days      INTEGER NOT NULL,
    brightness_trend        REAL,              -- K/day (positive = intensifying)
    regularity_score        REAL,              -- 0-1 (1 = perfectly periodic)
    seasonality_score       REAL,              -- 0-1 (annual cycle strength)
    
    -- Classification
    dominant_class          VARCHAR(30),       -- Most common class in cluster
    dominant_class_ratio    REAL,              -- Proportion
    
    -- Association
    associated_site_id      BIGINT REFERENCES industrial_sites(id),
    site_distance_m         REAL,
    
    -- Metadata
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT valid_dominant_class CHECK (
        dominant_class IS NULL OR dominant_class IN (
            'industrial_fire', 'persistent_thermal_source', 'natural_wildfire', 'other'
        )
    )
);

CREATE INDEX idx_persistence_clusters_geom_gist ON persistence_clusters USING GIST (geom);
CREATE INDEX idx_persistence_clusters_site ON persistence_clusters (associated_site_id);
CREATE INDEX idx_persistence_clusters_dominant_class ON persistence_clusters (dominant_class);
```

## Materialized Views for Analytics

### 1. Daily Summary (Refreshed hourly)

```sql
CREATE MATERIALIZED VIEW daily_event_summary AS
SELECT 
    DATE(acq_datetime AT TIME ZONE 'UTC') AS event_date,
    source,
    class,
    COUNT(*) AS event_count,
    AVG(brightness) AS avg_brightness,
    AVG(confidence) AS avg_confidence,
    COUNT(DISTINCT ST_GeoHash(geom::geometry, 5)) AS unique_hex5_cells
FROM thermal_events e
JOIN latest_classifications c ON e.id = c.event_id
GROUP BY event_date, source, class
ORDER BY event_date DESC, event_count DESC;

CREATE UNIQUE INDEX idx_daily_summary_date_source_class ON daily_event_summary (event_date, source, class);
```

### 2. Regional Summary (State/District)

```sql
CREATE MATERIALIZED VIEW regional_event_summary AS
SELECT 
    admin_level_4 AS state,
    admin_level_6 AS district,
    class,
    COUNT(*) AS event_count,
    AVG(confidence) AS avg_confidence,
    MAX(acq_datetime) AS latest_event
FROM thermal_events e
JOIN latest_classifications c ON e.id = c.event_id
JOIN event_features f ON e.id = f.event_id
WHERE f.features->>'admin_level_4' IS NOT NULL
GROUP BY admin_level_4, admin_level_6, class
ORDER BY event_count DESC;

CREATE UNIQUE INDEX idx_regional_summary_state_district_class ON regional_event_summary (state, district, class);
```

### 3. Top Persistent Clusters

```sql
CREATE MATERIALIZED VIEW top_persistent_clusters AS
SELECT 
    pc.id,
    pc.centroid,
    pc.detection_count,
    pc.unique_dates,
    pc.temporal_span_days,
    pc.brightness_trend,
    pc.regularity_score,
    pc.dominant_class,
    pc.dominant_class_ratio,
    s.name AS site_name,
    s.industrial_type AS site_type,
    pc.site_distance_m
FROM persistence_clusters pc
LEFT JOIN industrial_sites s ON pc.associated_site_id = s.id
WHERE pc.detection_count >= 5
ORDER BY pc.detection_count DESC
LIMIT 100;

CREATE UNIQUE INDEX idx_top_persistent_clusters_id ON top_persistent_clusters (id);
```

## Refresh Strategy

```sql
-- Function to refresh all materialized views concurrently
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY daily_event_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY regional_event_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY top_persistent_clusters;
    REFRESH MATERIALIZED VIEW CONCURRENTLY latest_classifications;
END;
$$;

-- Schedule via pg_cron (if available) or external scheduler
-- SELECT cron.schedule('refresh-analytics', '0 * * * *', 'SELECT refresh_analytics_views();');
```

## Migration Strategy (Alembic)

```
apps/api/alembic/
├── versions/
│   ├── 001_initial_schema.py       # Core tables
│   ├── 002_add_partitions.py       # Monthly partitions for thermal_events
│   ├── 003_add_materialized_views.py
│   ├── 004_add_persistence_clusters.py
│   └── 005_add_indexes.py
├── env.py
├── script.py.mako
└── README.md
```

### Example Migration (001_initial_schema.py)

```python
"""Initial schema for SIH26162

Revision ID: 001
Revises: 
Create Date: 2024-01-15
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '001'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Enable extensions
    op.execute('CREATE EXTENSION IF NOT EXISTS postgis')
    op.execute('CREATE EXTENSION IF NOT EXISTS pg_trgm')
    op.execute('CREATE EXTENSION IF NOT EXISTS btree_gin')
    
    # thermal_events
    op.create_table(
        'thermal_events',
        sa.Column('id', sa.BigInteger(), primary_key=True),
        sa.Column('geom', postgresql.GEOGRAPHY(geometry_type='POINT', srid=4326), nullable=False),
        sa.Column('brightness', sa.Float(), nullable=False),
        sa.Column('bright_t31', sa.Float(), nullable=True),
        sa.Column('scan', sa.Float(), nullable=True),
        sa.Column('track', sa.Float(), nullable=True),
        sa.Column('frp', sa.Float(), nullable=True),
        sa.Column('acq_datetime', sa.DateTime(timezone=True), nullable=False),
        sa.Column('satellite', sa.String(20), nullable=False),
        sa.Column('instrument', sa.String(20), nullable=False),
        sa.Column('confidence', sa.SmallInteger(), nullable=False),
        sa.Column('daynight', sa.CHAR(1), nullable=False),
        sa.Column('source', sa.String(30), nullable=False),
        sa.Column('cluster_id', sa.BigInteger(), nullable=True),
        sa.Column('processed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    
    # Indexes
    op.create_index('idx_thermal_events_geom_gist', 'thermal_events', ['geom'], postgresql_using='gist')
    op.create_index('idx_thermal_events_acq_datetime', 'thermal_events', ['acq_datetime'], postgresql_ops={'acq_datetime': 'DESC'})
    op.create_index('idx_thermal_events_source', 'thermal_events', ['source'])
    op.create_index('idx_thermal_events_cluster', 'thermal_events', ['cluster_id'], postgresql_where=sa.text('cluster_id IS NOT NULL'))
    op.create_index('idx_thermal_events_processed', 'thermal_events', ['processed_at'], postgresql_where=sa.text('processed_at IS NULL'))
    
    # industrial_sites
    op.create_table(
        'industrial_sites',
        sa.Column('id', sa.BigInteger(), primary_key=True),
        sa.Column('geom', postgresql.GEOGRAPHY(geometry_type='POLYGON', srid=4326), nullable=False),
        sa.Column('name', sa.String(500), nullable=True),
        sa.Column('industrial_type', sa.String(100), nullable=False),
        sa.Column('osm_id', sa.String(50), unique=True, nullable=True),
        sa.Column('tags', postgresql.JSONB(), nullable=False, server_default='{}'),
        sa.Column('source', sa.String(50), nullable=False, server_default='osm'),
        sa.Column('verified', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('verified_by', sa.String(100), nullable=True),
        sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('idx_industrial_sites_geom_gist', 'industrial_sites', ['geom'], postgresql_using='gist')
    op.create_index('idx_industrial_sites_type', 'industrial_sites', ['industrial_type'])
    op.create_index('idx_industrial_sites_osm_id', 'industrial_sites', ['osm_id'])
    op.create_index('idx_industrial_sites_name_gin', 'industrial_sites', ['name'], postgresql_using='gin', postgresql_ops={'name': 'gin_trgm_ops'})
    
    # ... other tables

def downgrade():
    op.drop_table('thermal_events')
    op.drop_table('industrial_sites')
    # ... drop other tables
    op.execute('DROP EXTENSION IF EXISTS postgis')
    op.execute('DROP EXTENSION IF EXISTS pg_trgm')
    op.execute('DROP EXTENSION IF EXISTS btree_gin')
```

## Connection Management

```python
# apps/api/app/core/database.py
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool
from app.core.config import settings

# Async engine for FastAPI
engine = create_async_engine(
    settings.DATABASE_URL.replace('postgresql://', 'postgresql+asyncpg://'),
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=3600,
    echo=settings.APP_DEBUG,
)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def get_db() -> AsyncSession:
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
```

## Performance Tuning

| Setting | Value | Reason |
|---------|-------|--------|
| `shared_buffers` | 25% RAM | Default conservative |
| `effective_cache_size` | 75% RAM | Planner hint |
| `work_mem` | 64MB | Spatial sorts/hashes |
| `maintenance_work_mem` | 512MB | Index creation |
| `max_parallel_workers_per_gather` | 4 | Parallel query |
| `random_page_cost` | 1.1 (SSD) | Encourage index scans |
| `jit` | on | Complex analytics queries |

## Backup & Recovery

```bash
# Logical backup (schema + data)
pg_dump -h localhost -U postgres -d sih26162 --no-owner --no-privileges > backup_$(date +%Y%m%d).sql

# Point-in-time recovery (PITR) requires:
# 1. wal_level = replica
# 2. archive_mode = on
# 3. archive_command = 'cp %p /backup/wal/%f'
# 4. Base backup + WAL files
```

## Related Documents
- [System Architecture](system-architecture.md)
- [Data Flow](data-flow.md)
- [Migrations](../database/migrations/)
- [Seeds](../database/seeds/)