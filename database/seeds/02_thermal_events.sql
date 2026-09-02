-- SIH26162 Demo Thermal Events (Synthetic, realistic distribution for India)
-- All data is SYNTHETIC/DEMO - not real satellite observations
-- Run after industrial sites: psql -U postgres -d sih26162 -f database/seeds/02_thermal_events.sql

TRUNCATE TABLE thermal_events RESTART IDENTITY CASCADE;

-- Helper function for generating events near a location
-- We'll use INSERT with generated data for different event types

-- ============================================================
-- 1. INDUSTRIAL FIRES (near industrial sites, sudden, hot)
-- ============================================================
-- Reliance Jamnagar area - industrial fire cluster
INSERT INTO thermal_events (geom, brightness, bright_t31, scan, track, frp, acq_datetime, satellite, instrument, confidence, daynight, source, version, cluster_id, processed_at) VALUES
-- Cluster 1: Near Reliance Jamnagar (industrial fire)
(ST_GeogFromText('SRID=4326;POINT(70.138 22.436)'), 345.2, 320.1, 1.1, 1.0, 45.3, '2024-01-15 04:30:00+00', 'Suomi-NPP', 'VIIRS', 92, 'N', 'VIIRS_SNPP_NRT', '2.1NRT', 1, NOW()),
(ST_GeogFromText('SRID=4326;POINT(70.137 22.437)'), 352.8, 325.4, 0.9, 0.9, 52.1, '2024-01-14 04:45:00+00', 'Terra', 'MODIS', 88, 'N', 'MODIS_NRT', '6.1NRT', 1, NOW()),
(ST_GeogFromText('SRID=4326;POINT(70.139 22.435)'), 361.5, 330.2, 1.0, 1.1, 61.8, '2024-01-13 05:15:00+00', 'NOAA-20', 'VIIRS', 95, 'N', 'VIIRS_NOAA20_NRT', '2.1NRT', 1, NOW()),
(ST_GeogFromText('SRID=4326;POINT(70.136 22.438)'), 338.9, 318.7, 1.2, 1.0, 38.4, '2024-01-12 04:20:00+00', 'Aqua', 'MODIS', 85, 'N', 'MODIS_NRT', '6.1NRT', 1, NOW()),
(ST_GeogFromText('SRID=4326;POINT(70.138 22.436)'), 348.3, 322.5, 1.0, 0.9, 49.2, '2024-01-11 05:00:00+00', 'Suomi-NPP', 'VIIRS', 90, 'N', 'VIIRS_SNPP_NRT', '2.1NRT', 1, NOW()),

-- BPCL Mumbai - industrial fire
(ST_GeogFromText('SRID=4326;POINT(72.892 19.012)'), 358.7, 328.4, 0.8, 0.8, 55.6, '2024-01-15 05:10:00+00', 'Terra', 'MODIS', 93, 'N', 'MODIS_NRT', '6.1NRT', 2, NOW()),
(ST_GeogFromText('SRID=4326;POINT(72.893 19.011)'), 342.1, 319.8, 1.1, 1.0, 41.3, '2024-01-14 04:55:00+00', 'Suomi-NPP', 'VIIRS', 89, 'N', 'VIIRS_SNPP_NRT', '2.1NRT', 2, NOW()),

-- JSW Dolvi - industrial fire
(ST_GeogFromText('SRID=4326;POINT(73.095 18.465)'), 365.4, 335.2, 0.9, 0.9, 68.9, '2024-01-15 06:20:00+00', 'NOAA-20', 'VIIRS', 94, 'D', 'VIIRS_NOAA20_NRT', '2.1NRT', 3, NOW()),

-- Vizag Steel - industrial fire
(ST_GeogFromText('SRID=4326;POINT(83.165 17.665)'), 351.2, 324.6, 1.0, 1.0, 47.8, '2024-01-15 03:45:00+00', 'Aqua', 'MODIS', 87, 'N', 'MODIS_NRT', '6.1NRT', 4, NOW()),

-- ============================================================
-- 2. PERSISTENT THERMAL SOURCES (flares, furnaces - recurring)
-- ============================================================
-- Reliance Jamnagar Flare 1 - persistent (20+ detections over 30 days)
INSERT INTO thermal_events (geom, brightness, bright_t31, scan, track, frp, acq_datetime, satellite, instrument, confidence, daynight, source, version, cluster_id, processed_at)
SELECT 
    ST_GeogFromText('SRID=4326;POINT(70.135 22.435)') + ST_MakePoint(random()*0.002-0.001, random()*0.002-0.001)::geography,
    310 + random()*30,  -- 310-340K
    295 + random()*25,
    0.8 + random()*0.4,
    0.8 + random()*0.4,
    15 + random()*20,
    ('2024-01-15 04:30:00+00'::timestamptz - (n || ' days')::interval + (random()*3600 || ' seconds')::interval),
    CASE (n % 4) WHEN 0 THEN 'Terra' WHEN 1 THEN 'Aqua' WHEN 2 THEN 'Suomi-NPP' ELSE 'NOAA-20' END,
    CASE (n % 2) WHEN 0 THEN 'MODIS' ELSE 'VIIRS' END,
    75 + floor(random()*20),  -- 75-95
    CASE WHEN random() > 0.5 THEN 'D' ELSE 'N' END,
    CASE (n % 3) WHEN 0 THEN 'MODIS_NRT' WHEN 1 THEN 'VIIRS_SNPP_NRT' ELSE 'VIIRS_NOAA20_NRT' END,
    CASE WHEN n % 2 = 0 THEN '6.1NRT' ELSE '2.1NRT' END,
    5,
    NOW()
FROM generate_series(0, 25) n;

-- Nayara Vadinar Flare - persistent
INSERT INTO thermal_events (geom, brightness, bright_t31, scan, track, frp, acq_datetime, satellite, instrument, confidence, daynight, source, version, cluster_id, processed_at)
SELECT 
    ST_GeogFromText('SRID=4326;POINT(69.965 22.395)') + ST_MakePoint(random()*0.001-0.0005, random()*0.001-0.0005)::geography,
    305 + random()*25,
    290 + random()*20,
    0.9 + random()*0.3,
    0.9 + random()*0.3,
    12 + random()*15,
    ('2024-01-15 05:00:00+00'::timestamptz - (n || ' days')::interval + (random()*3600 || ' seconds')::interval),
    CASE (n % 4) WHEN 0 THEN 'Terra' WHEN 1 THEN 'Aqua' WHEN 2 THEN 'Suomi-NPP' ELSE 'NOAA-20' END,
    CASE (n % 2) WHEN 0 THEN 'MODIS' ELSE 'VIIRS' END,
    70 + floor(random()*25),
    CASE WHEN random() > 0.5 THEN 'D' ELSE 'N' END,
    CASE (n % 3) WHEN 0 THEN 'MODIS_NRT' WHEN 1 THEN 'VIIRS_SNPP_NRT' ELSE 'VIIRS_NOAA20_NRT' END,
    CASE WHEN n % 2 = 0 THEN '6.1NRT' ELSE '2.1NRT' END,
    6,
    NOW()
FROM generate_series(0, 18) n;

-- HPCL Vizag Flare - persistent
INSERT INTO thermal_events (geom, brightness, bright_t31, scan, track, frp, acq_datetime, satellite, instrument, confidence, daynight, source, version, cluster_id, processed_at)
SELECT 
    ST_GeogFromText('SRID=4326;POINT(83.295 17.695)') + ST_MakePoint(random()*0.0015-0.00075, random()*0.0015-0.00075)::geography,
    315 + random()*20,
    300 + random()*15,
    0.85 + random()*0.3,
    0.85 + random()*0.3,
    18 + random()*12,
    ('2024-01-15 04:15:00+00'::timestamptz - (n || ' days')::interval + (random()*3600 || ' seconds')::interval),
    CASE (n % 4) WHEN 0 THEN 'Terra' WHEN 1 THEN 'Aqua' WHEN 2 THEN 'Suomi-NPP' ELSE 'NOAA-20' END,
    CASE (n % 2) WHEN 0 THEN 'MODIS' ELSE 'VIIRS' END,
    78 + floor(random()*17),
    CASE WHEN random() > 0.5 THEN 'D' ELSE 'N' END,
    CASE (n % 3) WHEN 0 THEN 'MODIS_NRT' WHEN 1 THEN 'VIIRS_SNPP_NRT' ELSE 'VIIRS_NOAA20_NRT' END,
    CASE WHEN n % 2 = 0 THEN '6.1NRT' ELSE '2.1NRT' END,
    7,
    NOW()
FROM generate_series(0, 22) n;

-- BPCL Mumbai Flare - persistent
INSERT INTO thermal_events (geom, brightness, bright_t31, scan, track, frp, acq_datetime, satellite, instrument, confidence, daynight, source, version, cluster_id, processed_at)
SELECT 
    ST_GeogFromText('SRID=4326;POINT(72.895 19.015)') + ST_MakePoint(random()*0.001-0.0005, random()*0.001-0.0005)::geography,
    308 + random()*22,
    293 + random()*18,
    0.9 + random()*0.25,
    0.9 + random()*0.25,
    14 + random()*10,
    ('2024-01-15 05:30:00+00'::timestamptz - (n || ' days')::interval + (random()*3600 || ' seconds')::interval),
    CASE (n % 4) WHEN 0 THEN 'Terra' WHEN 1 THEN 'Aqua' WHEN 2 THEN 'Suomi-NPP' ELSE 'NOAA-20' END,
    CASE (n % 2) WHEN 0 THEN 'MODIS' ELSE 'VIIRS' END,
    72 + floor(random()*23),
    CASE WHEN random() > 0.5 THEN 'D' ELSE 'N' END,
    CASE (n % 3) WHEN 0 THEN 'MODIS_NRT' WHEN 1 THEN 'VIIRS_SNPP_NRT' ELSE 'VIIRS_NOAA20_NRT' END,
    CASE WHEN n % 2 = 0 THEN '6.1NRT' ELSE '2.1NRT' END,
    8,
    NOW()
FROM generate_series(0, 15) n;

-- Neyveli Kiln - persistent (diurnal pattern)
INSERT INTO thermal_events (geom, brightness, bright_t31, scan, track, frp, acq_datetime, satellite, instrument, confidence, daynight, source, version, cluster_id, processed_at)
SELECT 
    ST_GeogFromText('SRID=4326;POINT(79.465 11.590)') + ST_MakePoint(random()*0.002-0.001, random()*0.002-0.001)::geography,
    320 + random()*15,
    305 + random()*10,
    1.0 + random()*0.2,
    1.0 + random()*0.2,
    8 + random()*8,
    ('2024-01-15 06:00:00+00'::timestamptz - (n || ' days')::interval + (random()*1800 || ' seconds')::interval),
    CASE (n % 4) WHEN 0 THEN 'Terra' WHEN 1 THEN 'Aqua' WHEN 2 THEN 'Suomi-NPP' ELSE 'NOAA-20' END,
    CASE (n % 2) WHEN 0 THEN 'MODIS' ELSE 'VIIRS' END,
    80 + floor(random()*15),
    'D',
    CASE (n % 3) WHEN 0 THEN 'MODIS_NRT' WHEN 1 THEN 'VIIRS_SNPP_NRT' ELSE 'VIIRS_NOAA20_NRT' END,
    CASE WHEN n % 2 = 0 THEN '6.1NRT' ELSE '2.1NRT' END,
    9,
    NOW()
FROM generate_series(0, 30) n;

-- Durgapur Coke Oven - persistent
INSERT INTO thermal_events (geom, brightness, bright_t31, scan, track, frp, acq_datetime, satellite, instrument, confidence, daynight, source, version, cluster_id, processed_at)
SELECT 
    ST_GeogFromText('SRID=4326;POINT(87.316 23.531)') + ST_MakePoint(random()*0.001-0.0005, random()*0.001-0.0005)::geography,
    330 + random()*20,
    315 + random()*15,
    0.95 + random()*0.2,
    0.95 + random()*0.2,
    20 + random()*15,
    ('2024-01-15 03:30:00+00'::timestamptz - (n || ' days')::interval + (random()*3600 || ' seconds')::interval),
    CASE (n % 4) WHEN 0 THEN 'Terra' WHEN 1 THEN 'Aqua' WHEN 2 THEN 'Suomi-NPP' ELSE 'NOAA-20' END,
    CASE (n % 2) WHEN 0 THEN 'MODIS' ELSE 'VIIRS' END,
    82 + floor(random()*13),
    CASE WHEN random() > 0.5 THEN 'D' ELSE 'N' END,
    CASE (n % 3) WHEN 0 THEN 'MODIS_NRT' WHEN 1 THEN 'VIIRS_SNPP_NRT' ELSE 'VIIRS_NOAA20_NRT' END,
    CASE WHEN n % 2 = 0 THEN '6.1NRT' ELSE '2.1NRT' END,
    10,
    NOW()
FROM generate_series(0, 12) n;

-- ============================================================
-- 3. NATURAL WILDFIRES (forest areas, seasonal, not near industry)
-- ============================================================
-- Central India forests (wildfire cluster)
INSERT INTO thermal_events (geom, brightness, bright_t31, scan, track, frp, acq_datetime, satellite, instrument, confidence, daynight, source, version, cluster_id, processed_at)
SELECT 
    ST_GeogFromText('SRID=4326;POINT(' || (78.5 + random()*1.5) || ' ' || (21.5 + random()*1.0) || ')'),
    300 + random()*50,
    285 + random()*40,
    1.0 + random()*0.5,
    1.0 + random()*0.5,
    5 + random()*30,
    ('2024-01-15 06:00:00+00'::timestamptz - (n || ' days')::interval + (random()*7200 || ' seconds')::interval),
    CASE (n % 4) WHEN 0 THEN 'Terra' WHEN 1 THEN 'Aqua' WHEN 2 THEN 'Suomi-NPP' ELSE 'NOAA-20' END,
    CASE (n % 2) WHEN 0 THEN 'MODIS' ELSE 'VIIRS' END,
    60 + floor(random()*30),
    'D',
    CASE (n % 3) WHEN 0 THEN 'MODIS_NRT' WHEN 1 THEN 'VIIRS_SNPP_NRT' ELSE 'VIIRS_NOAA20_NRT' END,
    CASE WHEN n % 2 = 0 THEN '6.1NRT' ELSE '2.1NRT' END,
    11 + floor(random()*5),
    NOW()
FROM generate_series(0, 200) n;

-- Western Ghats (wildfire)
INSERT INTO thermal_events (geom, brightness, bright_t31, scan, track, frp, acq_datetime, satellite, instrument, confidence, daynight, source, version, cluster_id, processed_at)
SELECT 
    ST_GeogFromText('SRID=4326;POINT(' || (74.5 + random()*1.0) || ' ' || (13.5 + random()*2.0) || ')'),
    310 + random()*40,
    290 + random()*35,
    1.1 + random()*0.4,
    1.1 + random()*0.4,
    8 + random()*25,
    ('2024-01-15 05:45:00+00'::timestamptz - (n || ' days')::interval + (random()*7200 || ' seconds')::interval),
    CASE (n % 4) WHEN 0 THEN 'Terra' WHEN 1 THEN 'Aqua' WHEN 2 THEN 'Suomi-NPP' ELSE 'NOAA-20' END,
    CASE (n % 2) WHEN 0 THEN 'MODIS' ELSE 'VIIRS' END,
    65 + floor(random()*25),
    'D',
    CASE (n % 3) WHEN 0 THEN 'MODIS_NRT' WHEN 1 THEN 'VIIRS_SNPP_NRT' ELSE 'VIIRS_NOAA20_NRT' END,
    CASE WHEN n % 2 = 0 THEN '6.1NRT' ELSE '2.1NRT' END,
    16 + floor(random()*3),
    NOW()
FROM generate_series(0, 150) n;

-- ============================================================
-- 4. OTHER (urban heat, agricultural, scattered)
-- ============================================================
-- Urban heat islands (major cities)
INSERT INTO thermal_events (geom, brightness, bright_t31, scan, track, frp, acq_datetime, satellite, instrument, confidence, daynight, source, version, cluster_id, processed_at)
SELECT 
    ST_GeogFromText('SRID=4326;POINT(' || 
        CASE (n % 6) 
            WHEN 0 THEN '77.2 + random()*0.3'  -- Delhi
            WHEN 1 THEN '72.8 + random()*0.3'  -- Mumbai
            WHEN 2 THEN '80.2 + random()*0.3'  -- Chennai
            WHEN 3 THEN '77.5 + random()*0.3'  -- Bangalore
            WHEN 4 THEN '78.4 + random()*0.3'  -- Hyderabad
            ELSE '88.3 + random()*0.3'         -- Kolkata
        END || ')'),
    295 + random()*20,
    285 + random()*15,
    1.2 + random()*0.4,
    1.2 + random()*0.4,
    2 + random()*5,
    ('2024-01-15 14:00:00+00'::timestamptz - (n || ' days')::interval + (random()*3600 || ' seconds')::interval),
    CASE (n % 4) WHEN 0 THEN 'Terra' WHEN 1 THEN 'Aqua' WHEN 2 THEN 'Suomi-NPP' ELSE 'NOAA-20' END,
    CASE (n % 2) WHEN 0 THEN 'MODIS' ELSE 'VIIRS' END,
    40 + floor(random()*30),
    'D',
    CASE (n % 3) WHEN 0 THEN 'MODIS_NRT' WHEN 1 THEN 'VIIRS_SNPP_NRT' ELSE 'VIIRS_NOAA20_NRT' END,
    CASE WHEN n % 2 = 0 THEN '6.1NRT' ELSE '2.1NRT' END,
    NULL,
    NOW()
FROM generate_series(0, 80) n;

-- Agricultural burning (Punjab/Haryana - seasonal)
INSERT INTO thermal_events (geom, brightness, bright_t31, scan, track, frp, acq_datetime, satellite, instrument, confidence, daynight, source, version, cluster_id, processed_at)
SELECT 
    ST_GeogFromText('SRID=4326;POINT(' || (75.5 + random()*1.5) || ' ' || (30.0 + random()*1.0) || ')'),
    305 + random()*30,
    290 + random()*25,
    1.3 + random()*0.3,
    1.3 + random()*0.3,
    3 + random()*10,
    ('2024-01-15 07:00:00+00'::timestamptz - (n || ' days')::interval + (random()*3600 || ' seconds')::interval),
    CASE (n % 4) WHEN 0 THEN 'Terra' WHEN 1 THEN 'Aqua' WHEN 2 THEN 'Suomi-NPP' ELSE 'NOAA-20' END,
    CASE (n % 2) WHEN 0 THEN 'MODIS' ELSE 'VIIRS' END,
    55 + floor(random()*25),
    'D',
    CASE (n % 3) WHEN 0 THEN 'MODIS_NRT' WHEN 1 THEN 'VIIRS_SNPP_NRT' ELSE 'VIIRS_NOAA20_NRT' END,
    CASE WHEN n % 2 = 0 THEN '6.1NRT' ELSE '2.1NRT' END,
    NULL,
    NOW()
FROM generate_series(0, 60) n;

-- Scattered other events across India
INSERT INTO thermal_events (geom, brightness, bright_t31, scan, track, frp, acq_datetime, satellite, instrument, confidence, daynight, source, version, cluster_id, processed_at)
SELECT 
    ST_GeogFromText('SRID=4326;POINT(' || (68.0 + random()*30.0) || ' ' || (6.0 + random()*32.0) || ')'),
    290 + random()*60,
    280 + random()*40,
    1.0 + random()*0.6,
    1.0 + random()*0.6,
    1 + random()*15,
    ('2024-01-15 12:00:00+00'::timestamptz - (n || ' hours')::interval),
    CASE (n % 4) WHEN 0 THEN 'Terra' WHEN 1 THEN 'Aqua' WHEN 2 THEN 'Suomi-NPP' ELSE 'NOAA-20' END,
    CASE (n % 2) WHEN 0 THEN 'MODIS' ELSE 'VIIRS' END,
    30 + floor(random()*50),
    CASE WHEN random() > 0.5 THEN 'D' ELSE 'N' END,
    CASE (n % 3) WHEN 0 THEN 'MODIS_NRT' WHEN 1 THEN 'VIIRS_SNPP_NRT' ELSE 'VIIRS_NOAA20_NRT' END,
    CASE WHEN n % 2 = 0 THEN '6.1NRT' ELSE '2.1NRT' END,
    NULL,
    NOW()
FROM generate_series(0, 300) n;

-- ============================================================
-- VERIFICATION
-- ============================================================
SELECT 
    COUNT(*) as total_events,
    COUNT(DISTINCT cluster_id) as clusters,
    COUNT(*) FILTER (WHERE cluster_id IS NOT NULL) as clustered_events,
    COUNT(*) FILTER (WHERE processed_at IS NOT NULL) as processed_events
FROM thermal_events;

-- Distribution by source
SELECT source, COUNT(*) FROM thermal_events GROUP BY source ORDER BY COUNT(*) DESC;

-- Date range
SELECT MIN(acq_datetime), MAX(acq_datetime) FROM thermal_events;