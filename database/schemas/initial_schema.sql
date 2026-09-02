-- SIH26162 Initial Database Schema
-- Run via: psql -U postgres -d sih26162 -f database/schemas/initial_schema.sql

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. THERMAL EVENTS (Core fact table, partitioned by month)
-- ============================================================
CREATE TABLE thermal_events (
    id              BIGSERIAL PRIMARY KEY,
    
    -- Geometry (WGS84, SRID 4326)
    geom            GEOGRAPHY(POINT, 4326) NOT NULL,
    
    -- Radiometric measurements
    brightness      REAL NOT NULL,
    bright_t31      REAL,
    scan            REAL,
    track           REAL,
    frp             REAL,
    
    -- Acquisition metadata
    acq_datetime    TIMESTAMPTZ NOT NULL,
    satellite       VARCHAR(20) NOT NULL,
    instrument      VARCHAR(20) NOT NULL,
    confidence      SMALLINT NOT NULL,
    daynight        CHAR(1) NOT NULL,
    source          VARCHAR(30) NOT NULL,
    version         VARCHAR(20),
    
    -- Processing
    cluster_id      BIGINT,
    processed_at    TIMESTAMPTZ,
    
    -- Audit
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_confidence CHECK (confidence BETWEEN 0 AND 100),
    CONSTRAINT valid_daynight CHECK (daynight IN ('D', 'N')),
    CONSTRAINT valid_brightness CHECK (brightness > 0 AND brightness < 500),
    CONSTRAINT valid_source CHECK (source IN ('MODIS_NRT', 'VIIRS_SNPP_NRT', 'VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT'))
) PARTITION BY RANGE (acq_datetime);

-- Create monthly partitions for 2024-2025
DO $$
DECLARE
    start_date DATE := '2024-01-01';
    end_date DATE := '2025-12-01';
    partition_name TEXT;
    partition_start DATE;
    partition_end DATE;
BEGIN
    WHILE start_date < end_date LOOP
        partition_name := 'thermal_events_y' || to_char(start_date, 'YYYY') || 'm' || to_char(start_date, 'MM');
        partition_start := start_date;
        partition_end := start_date + INTERVAL '1 month';
        
        EXECUTE format('CREATE TABLE %I PARTITION OF thermal_events FOR VALUES FROM (%L) TO (%L)',
            partition_name, partition_start, partition_end);
        
        start_date := start_date + INTERVAL '1 month';
    END LOOP;
END $$;

-- Default partition for out-of-range dates
CREATE TABLE thermal_events_default PARTITION OF thermal_events DEFAULT;

-- Indexes on thermal_events
CREATE INDEX idx_thermal_events_geom_gist ON thermal_events USING GIST (geom);
CREATE INDEX idx_thermal_events_acq_datetime ON thermal_events (acq_datetime DESC);
CREATE INDEX idx_thermal_events_source ON thermal_events (source);
CREATE INDEX idx_thermal_events_cluster ON thermal_events (cluster_id) WHERE cluster_id IS NOT NULL;
CREATE INDEX idx_thermal_events_processed ON thermal_events (processed_at) WHERE processed_at IS NULL;
CREATE INDEX idx_thermal_events_satellite_datetime ON thermal_events (satellite, acq_datetime DESC);
CREATE INDEX idx_thermal_events_confidence ON thermal_events (confidence DESC);

-- ============================================================
-- 2. INDUSTRIAL SITES (Reference data from OSM)
-- ============================================================
CREATE TABLE industrial_sites (
    id              BIGSERIAL PRIMARY KEY,
    
    -- Geometry (WGS84)
    geom            GEOGRAPHY(POLYGON, 4326) NOT NULL,
    centroid        GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (ST_Centroid(geom::geometry)::geography) STORED,
    
    -- Identity
    name            VARCHAR(500),
    industrial_type VARCHAR(100) NOT NULL,
    osm_id          VARCHAR(50) UNIQUE,
    
    -- Metadata
    tags            JSONB NOT NULL DEFAULT '{}',
    source          VARCHAR(50) NOT NULL DEFAULT 'osm',
    verified        BOOLEAN NOT NULL DEFAULT FALSE,
    verified_by     VARCHAR(100),
    verified_at     TIMESTAMPTZ,
    
    -- Audit
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes on industrial_sites
CREATE INDEX idx_industrial_sites_geom_gist ON industrial_sites USING GIST (geom);
CREATE INDEX idx_industrial_sites_type ON industrial_sites (industrial_type);
CREATE INDEX idx_industrial_sites_osm_id ON industrial_sites (osm_id);
CREATE INDEX idx_industrial_sites_name_gin ON industrial_sites USING GIN (name gin_trgm_ops);
CREATE INDEX idx_industrial_sites_tags_gin ON industrial_sites USING GIN (tags);

-- ============================================================
-- 3. EVENT FEATURES (Enriched features + SHAP values)
-- ============================================================
CREATE TABLE event_features (
    event_id        BIGINT PRIMARY KEY REFERENCES thermal_events(id) ON DELETE CASCADE,
    
    -- All engineered features (JSONB for flexibility)
    features        JSONB NOT NULL DEFAULT '{}',
    
    -- SHAP values per class (JSONB: feature_name -> {class: value})
    shap_values     JSONB,
    
    -- Feature version for reproducibility
    feature_version VARCHAR(64) NOT NULL,
    
    computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes on event_features
CREATE INDEX idx_event_features_version ON event_features (feature_version);
CREATE INDEX idx_event_features_features_gin ON event_features USING GIN (features);
CREATE INDEX idx_event_features_shap_gin ON event_features USING GIN (shap_values);

-- ============================================================
-- 4. CLASSIFICATIONS (Model predictions)
-- ============================================================
CREATE TABLE classifications (
    id              BIGSERIAL PRIMARY KEY,
    event_id        BIGINT NOT NULL REFERENCES thermal_events(id) ON DELETE CASCADE,
    
    -- Prediction
    class           VARCHAR(30) NOT NULL,
    confidence      REAL NOT NULL,
    all_probas      JSONB NOT NULL,
    
    -- Model metadata
    model_version   VARCHAR(50) NOT NULL,
    model_type      VARCHAR(30) NOT NULL DEFAULT 'xgboost',
    
    -- Explainability
    evidence        JSONB NOT NULL DEFAULT '{}',
    
    -- Audit
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_class CHECK (class IN ('industrial_fire', 'persistent_thermal_source', 'natural_wildfire', 'other')),
    CONSTRAINT valid_confidence CHECK (confidence >= 0 AND confidence <= 1)
);

-- Indexes on classifications
CREATE INDEX idx_classifications_event ON classifications (event_id);
CREATE INDEX idx_classifications_class ON classifications (class);
CREATE INDEX idx_classifications_model_version ON classifications (model_version);
CREATE INDEX idx_classifications_confidence ON classifications (confidence DESC);
CREATE INDEX idx_classifications_created ON classifications (created_at DESC);

-- Latest classification per event (materialized view for fast API)
CREATE MATERIALIZED VIEW latest_classifications AS
SELECT DISTINCT ON (event_id) 
    event_id, class, confidence, all_probas, model_version, evidence, created_at
FROM classifications
ORDER BY event_id, created_at DESC;

CREATE UNIQUE INDEX idx_latest_classifications_event ON latest_classifications (event_id);

-- ============================================================
-- 5. HISTORICAL OBSERVATIONS (Temporal sequence for timeline)
-- ============================================================
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
) PARTITION BY RANGE (acq_datetime);

-- Monthly partitions for historical_observations
DO $$
DECLARE
    start_date DATE := '2024-01-01';
    end_date DATE := '2025-12-01';
    partition_name TEXT;
    partition_start DATE;
    partition_end DATE;
BEGIN
    WHILE start_date < end_date LOOP
        partition_name := 'historical_observations_y' || to_char(start_date, 'YYYY') || 'm' || to_char(start_date, 'MM');
        partition_start := start_date;
        partition_end := start_date + INTERVAL '1 month';
        
        EXECUTE format('CREATE TABLE %I PARTITION OF historical_observations FOR VALUES FROM (%L) TO (%L)',
            partition_name, partition_start, partition_end);
        
        start_date := start_date + INTERVAL '1 month';
    END LOOP;
END $$;

CREATE TABLE historical_observations_default PARTITION OF historical_observations DEFAULT;

-- Indexes on historical_observations
CREATE INDEX idx_historical_event_datetime ON historical_observations (event_id, acq_datetime DESC);
CREATE INDEX idx_historical_geom_gist ON historical_observations USING GIST (geom);

-- ============================================================
-- 6. PERSISTENCE CLUSTERS (Computed spatiotemporal clusters)
-- ============================================================
CREATE TABLE persistence_clusters (
    id                      BIGSERIAL PRIMARY KEY,
    
    -- Cluster geometry (convex hull of member events)
    geom                    GEOGRAPHY(POLYGON, 4326) NOT NULL,
    centroid                GEOGRAPHY(POINT, 4326) NOT NULL,
    
    -- Persistence metrics
    detection_count         INTEGER NOT NULL,
    unique_dates            INTEGER NOT NULL,
    temporal_span_days      INTEGER NOT NULL,
    brightness_trend        REAL,
    regularity_score        REAL,
    seasonality_score       REAL,
    
    -- Classification
    dominant_class          VARCHAR(30),
    dominant_class_ratio    REAL,
    
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

-- Indexes on persistence_clusters
CREATE INDEX idx_persistence_clusters_geom_gist ON persistence_clusters USING GIST (geom);
CREATE INDEX idx_persistence_clusters_site ON persistence_clusters (associated_site_id);
CREATE INDEX idx_persistence_clusters_dominant_class ON persistence_clusters (dominant_class);
CREATE INDEX idx_persistence_clusters_detection_count ON persistence_clusters (detection_count DESC);

-- ============================================================
-- 7. MATERIALIZED VIEWS FOR ANALYTICS
-- ============================================================

-- Daily summary by class and source
CREATE MATERIALIZED VIEW daily_event_summary AS
SELECT 
    DATE(acq_datetime AT TIME ZONE 'UTC') AS event_date,
    source,
    COALESCE(c.class, 'unclassified') AS class,
    COUNT(*) AS event_count,
    AVG(brightness) AS avg_brightness,
    AVG(confidence)::numeric(10,2) AS avg_confidence,
    COUNT(DISTINCT ST_GeoHash(geom::geometry, 5)) AS unique_hex5_cells
FROM thermal_events e
LEFT JOIN latest_classifications c ON e.id = c.event_id
GROUP BY event_date, source, class
ORDER BY event_date DESC, event_count DESC;

CREATE UNIQUE INDEX idx_daily_summary_date_source_class ON daily_event_summary (event_date, source, class);

-- Regional summary (state/district)
CREATE MATERIALIZED VIEW regional_event_summary AS
SELECT 
    f.features->>'admin_level_4' AS state,
    f.features->>'admin_level_6' AS district,
    COALESCE(c.class, 'unclassified') AS class,
    COUNT(*) AS event_count,
    AVG(c.confidence)::numeric(10,3) AS avg_confidence,
    MAX(e.acq_datetime) AS latest_event
FROM thermal_events e
LEFT JOIN latest_classifications c ON e.id = c.event_id
LEFT JOIN event_features f ON e.id = f.event_id
WHERE f.features->>'admin_level_4' IS NOT NULL
GROUP BY state, district, class
ORDER BY event_count DESC;

CREATE UNIQUE INDEX idx_regional_summary_state_district_class ON regional_event_summary (state, district, class);

-- Top persistent clusters for dashboard
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

-- ============================================================
-- 8. REFRESH FUNCTION FOR MATERIALIZED VIEWS
-- ============================================================
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY latest_classifications;
    REFRESH MATERIALIZED VIEW CONCURRENTLY daily_event_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY regional_event_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY top_persistent_clusters;
END;
$$;

-- Grant permissions (adjust for production)
GRANT SELECT ON ALL TABLES IN SCHEMA public TO PUBLIC;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO PUBLIC;