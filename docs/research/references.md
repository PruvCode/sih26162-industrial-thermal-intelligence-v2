# References & Resources — SIH26162

## Problem Statement & Official Documents

- **SIH 2026 Problem Statement SIH26162**: "AI-Based Detection and Classification of Industrial Fires and Persistent Thermal Sources Using NASA FIRMS, OSM & Satellite Data"
- **Smart India Hackathon 2026 Official Website**: https://sih.gov.in
- **SIH 2026 Guidelines & Evaluation Criteria**

## NASA FIRMS

### Official Documentation
- [FIRMS API Documentation](https://firms.modaps.eosdis.nasa.gov/api/area/)
- [FIRMS User Guide](https://firms.modaps.eosdis.nasa.gov/user-guide/)
- [FIRMS FAQ](https://firms.modaps.eosdis.nasa.gov/faq/)
- [MODIS Fire Product (MOD14/MYD14)](https://modis-fire.umd.edu/)
- [VIIRS Active Fire Product](https://www.star.nesdis.noaa.gov/jpss/viirs-active-fire.php)

### Technical Papers
- Giglio et al. "The Collection 6 MODIS Active Fire Detection Algorithm" (2016)
- Schroeder et al. "VIIRS Active Fire Detection Algorithm" (2018)
- "FIRMS: Near Real-Time Fire Information" - NASA Technical Memorandum

### Access
- **API Key Registration**: https://firms.modaps.eosdis.nasa.gov/api/area/
- **Data Archive**: https://firms.modaps.eosdis.nasa.gov/download/
- **Map Viewer**: https://firms.modaps.eosdis.nasa.gov/map/

## OpenStreetMap

### Tagging References
- [Map Features - Industrial](https://wiki.openstreetmap.org/wiki/Map_Features#Industrial)
- [Map Features - Man_made](https://wiki.openstreetmap.org/wiki/Map_Features#Man_made)
- [Map Features - Power](https://wiki.openstreetmap.org/wiki/Map_Features#Power)
- [Industrial Tagging Guidelines](https://wiki.openstreetmap.org/wiki/Tag:industrial%3D*)
- [Man_made=flare](https://wiki.openstreetmap.org/wiki/Tag:man_made%3Dflare)

### API & Tools
- [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API)
- [Overpass Turbo (Query Builder)](https://overpass-turbo.eu/)
- [Overpass API Status](https://overpass-api.de/status.html)
- [OSM Data Extracts (Geofabrik)](https://download.geofabrik.de/) - India: https://download.geofabrik.de/asia/india.html

### India-Specific
- [OSM India Community](https://wiki.openstreetmap.org/wiki/India)
- [Indian Industrial Corridors on OSM](https://wiki.openstreetmap.org/wiki/India/Industrial_Corridors)
- [CPCB Industrial Categories](https://cpcb.nic.in/industrial-pollution/)

## Satellite Data (Beyond FIRMS)

### Sentinel-3 SLSTR
- [SLSTR Fire Products](https://sentinels.copernicus.eu/web/sentinel/technical-guides/sentinel-3-slstr/products-algorithms/level-2-fire-products)
- [Copernicus Open Access Hub](https://scihub.copernicus.eu/)
- [Sentinel Hub](https://www.sentinel-hub.com/) - Commercial API with free tier

### Geostationary (India Focus)
- [MOSDAC - INSAT Products](https://mosdac.gov.in/)
- [INSAT-3D Fire Detection](https://www.mosdac.gov.in/insat-3d-fire-detection)
- [IMD Satellite Products](https://mausam.imd.gov.in/)

### Sentinel-2 / Landsat
- [Sentinel-2 on AWS](https://registry.opendata.aws/sentinel-2/)
- [Landsat on AWS](https://registry.opendata.aws/landsat/)
- [Microsoft Planetary Computer](https://planetarycomputer.microsoft.com/)

### GOES / Himawari
- [GOES on AWS](https://registry.opendata.aws/noaa-goes/)
- [Himawari-8/9 on AWS](https://registry.opendata.aws/himawari-ahi/)

## Machine Learning for Fire Detection

### Key Papers
1. **Schroeder et al. (2018)** - "Active fire detection using VIIRS" - Remote Sensing of Environment
2. **Zhang et al. (2020)** - "Global gas flare detection from VIIRS" - Earth System Science Data
3. **Chen et al. (2021)** - "Deep learning for wildfire detection from GOES" - Remote Sensing
4. **Kumar et al. (2022)** - "XGBoost for fire type classification" - ISPRS Journal
5. **Lundberg & Lee (2020)** - "SHAP for tree models" - JMLR

### Datasets & Benchmarks
- [FireCCI51 Burned Area](https://climate.esa.int/en/projects/fire/)
- [MTBS (US Wildfire Perimeters)](https://www.mtbs.gov/)
- [Global Flare Database](https://www.ngdc.noaa.gov/eog/viirs/download_dnb_composites.html)
- [California Fire Dataset](https://github.com/MLforWildfire/MLforWildfire)

### ML Libraries & Tools
- [XGBoost](https://xgboost.readthedocs.io/) - Gradient boosting
- [LightGBM](https://lightgbm.readthedocs.io/) - Alternative GBM
- [SHAP](https://shap.readthedocs.io/) - Explainability
- [MLflow](https://mlflow.org/) - Experiment tracking
- [Evidently](https://www.evidentlyai.com/) - Data/model monitoring

## Geospatial Python Stack

### Core Libraries
- [GeoPandas](https://geopandas.org/) - Vector data
- [Shapely](https://shapely.readthedocs.io/) - Geometry operations
- [Rasterio](https://rasterio.readthedocs.io/) - Raster data
- [PyProj](https://pyproj4.github.io/pyproj/) - Projections
- [H3](https://h3geo.org/) - Hexagonal grid (Uber)

### Spatial Databases
- [PostGIS](https://postgis.net/) - Spatial PostgreSQL
- [TimescaleDB](https://www.timescale.com/) - Time-series + PostGIS
- [pgvector](https://github.com/pgvector/pgvector) - Vector embeddings

### Visualization
- [MapLibre GL JS](https://maplibre.org/maplibre-gl-js-docs/) - Web mapping
- [Deck.gl](https://deck.gl/) - WebGL geospatial
- [Kepler.gl](https://kepler.gl/) - Web-based exploration
- [Folium](https://python-visualization.github.io/folium/) - Python → Leaflet

## Backend Stack

### FastAPI
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Pydantic v2](https://docs.pydantic.dev/) - Validation
- [SQLAlchemy 2.0](https://docs.sqlalchemy.org/) - ORM
- [Alembic](https://alembic.sqlalchemy.org/) - Migrations
- [AsyncPG](https://github.com/MagicStack/asyncpg) - Async PostgreSQL driver

### Testing
- [pytest](https://docs.pytest.org/)
- [pytest-asyncio](https://github.com/pytest-dev/pytest-asyncio)
- [httpx](https://www.python-httpx.org/) - Async HTTP client for testing

## Frontend Stack

### Next.js
- [Next.js 14 App Router](https://nextjs.org/docs/app)
- [Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)
- [Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions)

### Mapping
- [MapLibre GL JS API](https://maplibre.org/maplibre-gl-js-docs/api/)
- [MapLibre Style Spec](https://maplibre.org/maplibre-gl-js-docs/style-spec/)
- [MapTiler Cloud](https://cloud.maptiler.com/) - Vector tiles hosting
- [OpenMapTiles](https://openmaptiles.org/) - Self-hosted vector tiles

### UI & State
- [Tailwind CSS](https://tailwindcss.com/)
- [Radix UI](https://www.radix-ui.com/) - Accessible primitives
- [TanStack Query](https://tanstack.com/query/latest) - Server state
- [Zustand](https://zustand.docs.pmnd.rs/) - Client state (if needed)
- [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/) - Forms
- [Recharts](https://recharts.org/) - Charts
- [Lucide React](https://lucide.dev/) - Icons

## DevOps & Tooling

### Code Quality
- [Ruff](https://docs.astral.sh/ruff/) - Fast Python linter (replaces flake8, isort, black)
- [Black](https://black.readthedocs.io/) - Python formatter
- [mypy](https://mypy-lang.org/) - Python type checker
- [ESLint](https://eslint.org/) + [Prettier](https://prettier.io/) - JS/TS
- [pre-commit](https://pre-commit.com/) - Git hooks

### CI/CD
- [GitHub Actions](https://github.com/features/actions)
- [Docker](https://www.docker.com/)
- [Docker Compose](https://docs.docker.com/compose/)

### Container Images
- [PostGIS Docker](https://hub.docker.com/r/postgis/postgis)
- [MLflow Docker](https://github.com/mlflow/mlflow/tree/master/docker)
- [Node.js Docker](https://hub.docker.com/_/node)

## India-Specific Resources

### Industrial Data
- [CPCB - Central Pollution Control Board](https://cpcb.nic.in/)
- [SPCB - State Pollution Control Boards](https://cpcb.nic.in/state-pollution-control-boards/)
- [NIC - National Industrial Corridors](https://www.india.gov.in/spotlight/national-industrial-corridors)
- [DFC - Dedicated Freight Corridor](https://dfccil.com/)
- [PCPIR - Petroleum, Chemicals and Petrochemical Investment Regions](https://www.pcpir.gov.in/)
- [SEZ - Special Economic Zones](https://sezindia.nic.in/)

### Geospatial Data
- [Bhuvan - ISRO Geoportal](https://bhuvan.nrsc.gov.in/)
- [NRSC - National Remote Sensing Centre](https://www.nrsc.gov.in/)
- [SoI - Survey of India](https://www.surveyofindia.gov.in/)
- [India Water Tool](https://indiawatertool.in/)

### Environmental Data
- [India Air Quality Data](https://app.cpcbccr.com/ccr/#/caaqm-dashboard)
- [India Meteorological Department](https://mausam.imd.gov.in/)
- [Forest Survey of India](https://fsi.nic.in/)

## Hackathon Resources

### SIH Specific
- [SIH 2026 Schedule](https://sih.gov.in/schedule)
- [SIH Evaluation Criteria](https://sih.gov.in/evaluation)
- [Previous SIH Winners](https://sih.gov.in/winners)

### Presentation
- [Technical Presentation Template](https://github.com/.../template)
- [Demo Video Guidelines](https://sih.gov.in/demo-guidelines)
- [Judging Criteria Breakdown](https://sih.gov.in/judging)

## Team Learning Resources

### GIS Fundamentals
- "Geographic Information Systems and Science" - Longley et al.
- "Python for Geospatial Data Analysis" - Bonzanigo
- [GIS StackExchange](https://gis.stackexchange.com/)

### ML for Earth Observation
- "Deep Learning for the Earth Sciences" - Reichstein et al.
- [ESA Φ-lab](https://phi-lab.esa.int/) - ML for EO
- [Radiant Earth ML Hub](https://mlhub.earth/)

### FastAPI + Next.js Full Stack
- [Full Stack FastAPI + Next.js](https://github.com/tiangolo/full-stack-fastapi-nextjs)
- [Next.js + MapLibre Tutorial](https://maplibre.org/maplibre-gl-js-docs/example/nextjs/)

---

## Quick Links for Team

| Resource | Link |
|----------|------|
| **FIRMS API Key Request** | https://firms.modaps.eosdis.nasa.gov/api/area/ |
| **Overpass Turbo (Test Queries)** | https://overpass-turbo.eu/ |
| **MapTiler Cloud (Free Tiles)** | https://cloud.maptiler.com/ |
| **Sentinel Hub (Free Tier)** | https://www.sentinel-hub.com/ |
| **MLflow UI (Local)** | http://localhost:5000 |
| **API Docs (Local)** | http://localhost:8000/docs |
| **Frontend (Local)** | http://localhost:3000 |
| **PostgreSQL (Local)** | postgresql://postgres:postgres@localhost:5432/sih26162 |

---

*Last Updated: 2024-01-15 | For SIH26162 Team Internal Use*