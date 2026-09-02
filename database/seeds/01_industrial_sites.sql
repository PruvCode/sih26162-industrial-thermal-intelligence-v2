-- SIH26162 Demo Industrial Sites (Synthetic, based on real Indian industrial locations)
-- All data is SYNTHETIC/DEMO - not authoritative real-world data
-- Run after migrations: psql -U postgres -d sih26162 -f database/seeds/01_industrial_sites.sql

-- Clear existing (idempotent)
TRUNCATE TABLE industrial_sites RESTART IDENTITY CASCADE;

-- Gujarat Industrial Belt
INSERT INTO industrial_sites (name, industrial_type, osm_id, tags, geom) VALUES
('Reliance Jamnagar Refinery', 'refinery', 'way/1001001', 
 '{"operator": "Reliance Industries Limited", "capacity": "1.2M bpd", "website": "https://www.ril.com"}',
 ST_GeogFromText('SRID=4326;POLYGON((70.12 22.42, 70.15 22.42, 70.15 22.45, 70.12 22.45, 70.12 22.42))')),
 
('Nayara Energy Vadinar Refinery', 'refinery', 'way/1001002',
 '{"operator": "Nayara Energy", "capacity": "20M TPA", "website": "https://www.nayaraenergy.com"}',
 ST_GeogFromText('SRID=4326;POLYGON((69.95 22.38, 69.98 22.38, 69.98 22.41, 69.95 22.41, 69.95 22.38))')),

('Dahej Petrochemical Complex', 'chemical', 'way/1001003',
 '{"operator": "Various (GIDC)", "website": "https://gidc.gujarat.gov.in"}',
 ST_GeogFromText('SRID=4326;POLYGON((72.55 21.70, 72.58 21.70, 72.58 21.73, 72.55 21.73, 72.55 21.70))')),

('Gujarat Alkalies & Chemicals', 'chemical', 'way/1001004',
 '{"operator": "GACL", "capacity": "1.1M TPA caustic soda"}',
 ST_GeogFromText('SRID=4326;POLYGON((72.95 21.68, 72.98 21.68, 72.98 21.71, 72.95 21.71, 72.95 21.68))')),

('Tata Chemicals Mithapur', 'chemical', 'way/1001005',
 '{"operator": "Tata Chemicals", "capacity": "1.2M TPA soda ash"}',
 ST_GeogFromText('SRID=4326;POLYGON((69.02 22.40, 69.05 22.40, 69.05 22.43, 69.02 22.43, 69.02 22.40))')),

('Essar Steel Hazira', 'steel', 'way/1001006',
 '{"operator": "ArcelorMittal Nippon Steel", "capacity": "8.6M TPA"}',
 ST_GeogFromText('SRID=4326;POLYGON((72.68 21.12, 72.71 21.12, 72.71 21.15, 72.68 21.15, 72.68 21.12))')),

-- Maharashtra Industrial Belt
('Rashtriya Chemicals & Fertilizers Trombay', 'chemical', 'way/1002001',
 '{"operator": "RCF Ltd", "capacity": "1.5M TPA urea"}',
 ST_GeogFromText('SRID=4326;POLYGON((72.92 19.02, 72.95 19.02, 72.95 19.05, 72.92 19.05, 72.92 19.02))')),

('BPCL Mumbai Refinery', 'refinery', 'way/1002002',
 '{"operator": "Bharat Petroleum", "capacity": "12M TPA"}',
 ST_GeogFromText('SRID=4326;POLYGON((72.88 19.00, 72.91 19.00, 72.91 19.03, 72.88 19.03, 72.88 19.00))')),

('HPCL Mumbai Refinery', 'refinery', 'way/1002003',
 '{"operator": "Hindustan Petroleum", "capacity": "9.5M TPA"}',
 ST_GeogFromText('SRID=4326;POLYGON((72.85 19.01, 72.88 19.01, 72.88 19.04, 72.85 19.04, 72.85 19.01))')),

('Tata Power Trombay', 'power_plant_coal', 'way/1002004',
 '{"operator": "Tata Power", "capacity": "1580 MW"}',
 ST_GeogFromText('SRID=4326;POLYGON((72.93 19.00, 72.95 19.00, 72.95 19.02, 72.93 19.02, 72.93 19.00))')),

('JSW Steel Dolvi', 'steel', 'way/1002005',
 '{"operator": "JSW Steel", "capacity": "5M TPA"}',
 ST_GeogFromText('SRID=4326;POLYGON((73.08 18.45, 73.11 18.45, 73.11 18.48, 73.08 18.48, 73.08 18.45))')),

-- Andhra Pradesh
('Visakhapatnam Steel Plant (RINL)', 'steel', 'way/1003001',
 '{"operator": "Rashtriya Ispat Nigam Ltd", "capacity": "7.3M TPA"}',
 ST_GeogFromText('SRID=4326;POLYGON((83.15 17.65, 83.18 17.65, 83.18 17.68, 83.15 17.68, 83.15 17.65))')),

('HPCL Visakhapatnam Refinery', 'refinery', 'way/1003002',
 '{"operator": "Hindustan Petroleum", "capacity": "13.7M TPA"}',
 ST_GeogFromText('SRID=4326;POLYGON((83.28 17.68, 83.31 17.68, 83.31 17.71, 83.28 17.71, 83.28 17.68))')),

('NALCO Angul Aluminum', 'aluminum', 'way/1003003',
 '{"operator": "National Aluminium Company", "capacity": "0.46M TPA"}',
 ST_GeogFromText('SRID=4326;POLYGON((85.10 20.85, 85.13 20.85, 85.13 20.88, 85.10 20.88, 85.10 20.85))')),

('NTPC Simhadri Power Plant', 'power_plant_coal', 'way/1003004',
 '{"operator": "NTPC Ltd", "capacity": "2000 MW"}',
 ST_GeogFromText('SRID=4326;POLYGON((83.05 17.58, 83.08 17.58, 83.08 17.61, 83.05 17.61, 83.05 17.58))')),

-- Odisha
('Tata Steel Kalinganagar', 'steel', 'way/1004001',
 '{"operator": "Tata Steel", "capacity": "3M TPA (Phase 1)"}',
 ST_GeogFromText('SRID=4326;POLYGON((86.05 20.95, 86.08 20.95, 86.08 20.98, 86.05 20.98, 86.05 20.95))')),

('NTPC Talcher Thermal', 'power_plant_coal', 'way/1004002',
 '{"operator": "NTPC Ltd", "capacity": "460 MW"}',
 ST_GeogFromText('SRID=4326;POLYGON((85.22 21.05, 85.25 21.05, 85.25 21.08, 85.22 21.08, 85.22 21.05))')),

('Mahanadi Coalfields', 'extractive', 'way/1004003',
 '{"operator": "MCL", "capacity": "150M TPA coal"}',
 ST_GeogFromText('SRID=4326;POLYGON((84.85 21.15, 84.90 21.15, 84.90 21.20, 84.85 21.20, 84.85 21.15))')),

-- Tamil Nadu
('NLC India Neyveli', 'power_plant_coal', 'way/1005001',
 '{"operator": "NLC India Ltd", "capacity": "3240 MW"}',
 ST_GeogFromText('SRID=4326;POLYGON((79.45 11.58, 79.48 11.58, 79.48 11.61, 79.45 11.61, 79.45 11.58))')),

('CPCL Manali Refinery', 'refinery', 'way/1005002',
 '{"operator": "Chennai Petroleum Corporation", "capacity": "10.5M TPA"}',
 ST_GeogFromText('SRID=4326;POLYGON((80.25 13.15, 80.28 13.15, 80.28 13.18, 80.25 13.18, 80.25 13.15))')),

('Sterlite Copper Tuticorin', 'extractive', 'way/1005003',
 '{"operator": "Vedanta Ltd", "capacity": "400k TPA copper"}',
 ST_GeogFromText('SRID=4326;POLYGON((78.15 8.78, 78.18 8.78, 78.18 8.81, 78.15 8.81, 78.15 8.78))')),

-- West Bengal
('Durgapur Steel Plant (SAIL)', 'steel', 'way/1006001',
 '{"operator": "Steel Authority of India", "capacity": "2.2M TPA"}',
 ST_GeogFromText('SRID=4326;POLYGON((87.30 23.52, 87.33 23.52, 87.33 23.55, 87.30 23.55, 87.30 23.52))')),

('DVC Mejia Thermal', 'power_plant_coal', 'way/1006002',
 '{"operator": "Damodar Valley Corporation", "capacity": "2340 MW"}',
 ST_GeogFromText('SRID=4326;POLYGON((87.10 23.55, 87.13 23.55, 87.13 23.58, 87.10 23.58, 87.10 23.55))')),

-- Karnataka
('MRPL Mangalore Refinery', 'refinery', 'way/1007001',
 '{"operator": "Mangalore Refinery & Petrochemicals", "capacity": "15M TPA"}',
 ST_GeogFromText('SRID=4326;POLYGON((74.80 12.90, 74.83 12.90, 74.83 12.93, 74.80 12.93, 74.80 12.90))')),

('JSW Steel Vijayanagar', 'steel', 'way/1007002',
 '{"operator": "JSW Steel", "capacity": "12M TPA"}',
 ST_GeogFromText('SRID=4326;POLYGON((76.55 15.20, 76.58 15.20, 76.58 15.23, 76.55 15.23, 76.55 15.20))')),

-- Rajasthan
('HZL Dariba Smelter', 'extractive', 'way/1008001',
 '{"operator": "Hindustan Zinc Ltd", "capacity": "300k TPA lead-zinc"}',
 ST_GeogFromText('SRID=4326;POLYGON((74.15 25.05, 74.18 25.05, 74.18 25.08, 74.15 25.08, 74.15 25.05))')),

-- Flares (point features buffered to small polygons)
('Reliance Jamnagar Flare Stack 1', 'flare', 'node/2001001',
 '{"operator": "RIL", "height": "120m", "type": "elevated"}',
 ST_Buffer(ST_GeogFromText('SRID=4326;POINT(70.135 22.435)'), 50)),

('Reliance Jamnagar Flare Stack 2', 'flare', 'node/2001002',
 '{"operator": "RIL", "height": "120m", "type": "elevated"}',
 ST_Buffer(ST_GeogFromText('SRID=4326;POINT(70.140 22.438)'), 50)),

('Nayara Vadinar Flare', 'flare', 'node/2001003',
 '{"operator": "Nayara Energy", "height": "100m"}',
 ST_Buffer(ST_GeogFromText('SRID=4326;POINT(69.965 22.395)'), 50)),

('HPCL Vizag Flare', 'flare', 'node/2003001',
 '{"operator": "HPCL", "height": "90m"}',
 ST_Buffer(ST_GeogFromText('SRID=4326;POINT(83.295 17.695)'), 50)),

('BPCL Mumbai Flare', 'flare', 'node/2002001',
 '{"operator": "BPCL", "height": "80m"}',
 ST_Buffer(ST_GeogFromText('SRID=4326;POINT(72.895 19.015)'), 50)),

-- Chimneys / Kilns
('Durgapur Coke Oven Battery', 'high_temp_process', 'way/2006001',
 '{"operator": "SAIL", "type": "coke_oven"}',
 ST_GeogFromText('SRID=4326;POLYGON((87.315 23.530, 87.318 23.530, 87.318 23.533, 87.315 23.533, 87.315 23.530))')),

('Neyveli Kiln 1', 'high_temp_process', 'way/2005001',
 '{"operator": "NLC", "type": "rotary_kiln"}',
 ST_GeogFromText('SRID=4326;POLYGON((79.465 11.590, 79.468 11.590, 79.468 11.593, 79.465 11.593, 79.465 11.590))')),

-- Industrial Areas (landuse=industrial)
('Naroda Industrial Estate Ahmedabad', 'industrial_area', 'way/3001001',
 '{"zone": "GIDC Naroda", "established": "1960"}',
 ST_GeogFromText('SRID=4326;POLYGON((72.65 23.05, 72.68 23.05, 72.68 23.08, 72.65 23.08, 72.65 23.05))')),

('Vapi Industrial Estate', 'industrial_area', 'way/3001002',
 '{"zone": "GIDC Vapi", "established": "1967"}',
 ST_GeogFromText('SRID=4326;POLYGON((72.92 20.37, 72.95 20.37, 72.95 20.40, 72.92 20.40, 72.92 20.37))')),

('Pune MIDC Bhosari', 'industrial_area', 'way/3002001',
 '{"zone": "MIDC Bhosari", "established": "1960"}',
 ST_GeogFromText('SRID=4326;POLYGON((73.85 18.62, 73.88 18.62, 73.88 18.65, 73.85 18.65, 73.85 18.62))'));

-- Verify
SELECT count(*) as total_sites, 
       count(*) FILTER (WHERE industrial_type = 'flare') as flares,
       count(*) FILTER (WHERE industrial_type = 'refinery') as refineries,
       count(*) FILTER (WHERE industrial_type = 'steel') as steel_plants,
       count(*) FILTER (WHERE industrial_type = 'chemical') as chemical_plants,
       count(*) FILTER (WHERE industrial_type = 'power_plant_coal') as coal_power
FROM industrial_sites;