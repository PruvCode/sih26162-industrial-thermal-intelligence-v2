# ADR-002: PostgreSQL + PostGIS for Spatial Backend

## Status
Accepted

## Context
We need a database that can:
- Store thermal event points with geometry
- Store industrial site polygons
- Perform spatial joins (nearest neighbor, distance, containment)
- Handle time-series queries (persistence analysis)
- Scale to millions of events
- Support standard SQL for analytics

## Decision
Use **PostgreSQL 16 + PostGIS 3.4** as the primary spatial database.

## Consequences

### Positive
- **Mature**: 20+ years, battle-tested in production (Carto, Uber, OSM, etc.)
- **Full SQL**: Complex spatial + temporal queries in single language
- **Performance**: GiST indexes, BRIN for time, partitioning, parallel query
- **Ecosystem**: SQLAlchemy, GeoPandas, QGIS, pgAdmin all work natively
- **Team familiarity**: Standard skill set, easy to hire for
- **Cloud-agnostic**: Runs on AWS RDS, GCP Cloud SQL, Azure, self-hosted
- **Extensions**: TimescaleDB for hypertables, pgvector for embeddings, pg_cron for scheduling

### Negative
- **Single-node write**: Horizontal write scaling requires Citus or sharding (not needed for MVP)
- **Operational overhead**: Vacuum, indexing, connection pooling needed
- **Memory**: Large geometries can be memory-intensive

### Neutral
- Alternative: MongoDB (geospatial but limited SQL, no PostGIS functions)
- Alternative: BigQuery/Redshift (cloud lock-in, cost, latency)
- Alternative: Elasticsearch (great search, weak analytics, no ACID)

## Implementation Details

### Extensions Required
```sql
CREATE EXTENSION postgis;
CREATE EXTENSION postgis_raster;  -- For raster sampling (land cover, DEM)
CREATE EXTENSION pg_trgm;         -- Fuzzy name search on industrial sites
CREATE EXTENSION btree_gin;       -- Composite indexes
-- Optional for scale:
-- CREATE EXTENSION timescaledb;   -- Hypertable partitioning
```

### Key Indexes
```sql
-- Spatial (GiST)
CREATE INDEX idx_events_geom ON thermal_events USING GIST (geom);
CREATE INDEX idx_sites_geom ON industrial_sites USING GIST (geom);

-- Temporal (BRIN for time-series)
CREATE INDEX idx_events_acq_datetime ON thermal_events USING BRIN (acq_datetime);

-- Composite for common queries
CREATE INDEX idx_events_source_time ON thermal_events (source, acq_datetime DESC);
CREATE INDEX idx_events_cluster ON thermal_events (cluster_id) WHERE cluster_id IS NOT NULL;

-- JSONB for features
CREATE INDEX idx_features_gin ON event_features USING GIN (features);
```

### Partitioning Strategy
```sql
-- Monthly partitions for thermal_events (via pg_partman or manual)
CREATE TABLE thermal_events_y2024m01 PARTITION OF thermal_events
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
-- ... automate partition creation
```

## Related
- ADR-001: FIRMS data source (feeds this DB)
- ADR-005: FastAPI backend (queries this DB)
- Database schema: `database/schemas/initial_schema.sql`