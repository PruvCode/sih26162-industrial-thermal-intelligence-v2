# ADR-001: FIRMS as Primary Data Source

## Status
Accepted

## Context
We need a reliable, global, near real-time source of thermal anomaly detections for industrial fire monitoring. Multiple satellite data sources are available.

## Decision
Use NASA FIRMS (Fire Information for Resource Management System) as the primary and sole satellite data source for the SIH26162 MVP.

### Sources Used
- MODIS_NRT (Terra/Aqua)
- VIIRS_SNPP_NRT (Suomi-NPP)
- VIIRS_NOAA20_NRT (NOAA-20)

### Not Used (for MVP)
- Sentinel-3 SLSTR
- Landsat 8/9
- GOES/INSAT geostationary
- Sentinel-2 MSI (optical only)

## Consequences

### Positive
- **Ready-to-use**: FIRMS provides validated fire detections, not raw radiances
- **Multi-sensor**: 4 overpasses/day (Terra, Aqua, SNPP, NOAA-20) combined
- **Global API**: Single endpoint, consistent format, free with registration
- **Proven**: Used operationally by fire services worldwide
- **Low latency**: ~3 hours from acquisition to API availability
- **No preprocessing**: No atmospheric correction, cloud masking, geolocation needed

### Negative
- **Coarse resolution**: 1km (MODIS) / 375m (VIIRS) - may miss small fires
- **No imagery**: Only centroid points + attributes, no visual context
- **Fixed algorithm**: Can't tune detection thresholds
- **Rate limited**: 1000-10000 req/day depending on tier
- **No push**: Must poll API (but 3h latency matches satellite revisit)

### Neutral
- Confidence values differ: MODIS (0-100), VIIRS (low/nominal/high)
- Day/night detection capability varies by sensor
- FRP (Fire Radiative Power) only for VIIRS

## Alternatives Considered

### Sentinel-3 SLSTR
- **Pros**: Independent confirmation, better FRP accuracy, open data
- **Cons**: Higher latency (6-24h), more complex access (Copernicus Hub), requires preprocessing
- **Verdict**: Add as confirmation layer post-MVP

### Geostationary (GOES/INSAT)
- **Pros**: 15-min temporal resolution, captures diurnal cycle
- **Cons**: Coarser spatial (2-4km), India-specific (INSAT), different data format
- **Verdict**: Integrate INSAT-3D for India post-MVP

### Sentinel-2 / Landsat
- **Pros**: High spatial resolution (10-30m), visual confirmation
- **Cons**: Low revisit (5-16 days), not near real-time, optical only (no thermal at high res)
- **Verdict**: Use for on-demand visual validation in investigation panel

## Related
- ADR-002: PostGIS for spatial backend (stores FIRMS data)
- ADR-003: XGBoost baseline (uses FIRMS features)
- Issue #12: FIRMS ingestion pipeline