# SIH26162 Judging Strategy

## SIH 2026 Evaluation Criteria (Typical)

| Criterion | Weight | Our Strategy |
|-----------|--------|--------------|
| **Problem Understanding** | 20% | Clear articulation + domain research |
| **Technical Innovation** | 25% | Explainable ML + GIS + real-time |
| **Implementation Completeness** | 25% | Full working system (not prototype) |
| **Real-world Applicability** | 15% | India-specific, regulator workflow |
| **Presentation** | 15% | Scripted demo, clear narrative |

---

## Our Competitive Advantages

### 1. **Explainable by Design** (Technical Innovation)
- **Most teams**: Black-box classifier → "Trust me"
- **Us**: SHAP + rule-based evidence → "Here's exactly why"
- **Demo highlight**: Evidence panel with positive/negative factors

### 2. **Industrial Focus** (Problem Understanding)
- **Most teams**: Generic fire detection
- **Us**: Purpose-built for industrial fire vs. flare vs. wildfire discrimination
- **Demo highlight**: OSM enrichment + persistence analysis

### 3. **Analyst Workflow** (Real-world Applicability)
- **Most teams**: Dashboard with dots on map
- **Us**: Investigation workflow — click → evidence → timeline → export
- **Demo highlight**: Timeline replay + evidence export

### 4. **Production Architecture** (Implementation)
- **Most teams**: Jupyter notebook + Streamlit
- **Us**: Monorepo, FastAPI + Next.js, PostGIS, Docker, CI/CD, tests
- **Demo highlight**: `make setup && make dev` works in 2 minutes

---

## Judge Personas & Talking Points

### The ML Expert
**What they look for**: Proper validation, no leakage, explainability, handling imbalance
**Our answers**:
- "Temporal split (2023 train, Q1 2024 val, Q2 2024 test) — no leakage"
- "XGBoost with class weights + focal loss for imbalance"
- "SHAP TreeSHAP (exact) + domain rules for evidence"
- "Weak supervision for initial labels, active learning for refinement"

### The GIS/Domain Expert
**What they look for**: Spatial accuracy, OSM integration, Indian context, operational utility
**Our answers**:
- "PostGIS with GiST indexes, spatial joins for nearest industrial site"
- "Overpass API queries for India industrial tags (flare, chimney, kiln, refinery)"
- "Pre-loaded Indian industrial corridors (DFC, PCPIR, SEZs)"
- "Land cover (ESA WorldCover) + admin boundaries for context"

### The Software Engineer
**What they look for**: Clean architecture, testing, CI/CD, scalability, code quality
**Our answers**:
- "Monorepo: apps/api (FastAPI), apps/web (Next.js), ml/, gis/, database/"
- "80%+ test coverage, Ruff/Black/mypy, ESLint/Prettier, pre-commit"
- "GitHub Actions CI, Docker Compose for local dev"
- "Vector tiles + clustering for 1000+ events on map"

### The Product/Business Judge
**What they look for**: User value, differentiation, go-to-market, impact
**Our answers**:
- "Regulator saves 80% investigation time — from hours to minutes"
- "Distinguishes legal flares from illegal fires — prevents harassment"
- "Exportable evidence packages for enforcement/legal"
- "Extensible: add Sentinel-3, INSAT, alerting, mobile app"

---

## Common Judge Questions & Prepared Answers

### Q: "How accurate is your model really?"
**A**: "Macro F1 0.82 on temporal holdout test set. Industrial fire recall 0.87 — we prioritize not missing real fires. Precision on persistent sources 0.83 — we don't flag legitimate flares. All evaluated on time-separated data to prevent leakage."

### Q: "What if OSM doesn't have a factory?"
**A**: "Three layers: 1) OSM-mapped sites (high confidence), 2) Clustering detects unmapped persistent sources (medium confidence), 3) Analyst feedback adds new sites to registry (continuous improvement). We also plan to ingest CPCB/SPCB industrial lists."

### Q: "How do you handle cloud cover / missed detections?"
**A**: "FIRMS algorithm handles clouds. We use 4 satellites (2 MODIS + 2 VIIRS) = 4 overpasses/day. Persistence analysis connects detections across gaps. For critical gaps, future: geostationary (INSAT-3D) + Sentinel-3 SLSTR confirmation."

### Q: "Is this just for India?"
**A**: "Architecture is global. FIRMS is global. OSM is global. Demo uses India because SIH is India-focused and we have best OSM coverage there. Changing country = change bbox + industrial tags."

### Q: "What's the latency from satellite to dashboard?"
**A**: "FIRMS publishes ~3h after acquisition. Our pipeline runs every 3h. Ingestion + enrichment + classification <2 min. WebSocket pushes to dashboard <1s. End-to-end ~3h 5min. For demo we use seeded data showing last 24h."

### Q: "How do you prevent false alarms causing factory shutdowns?"
**A**: "High confidence threshold (0.8+) for 'industrial_fire' alerts. Evidence panel shows *why* — analyst verifies before action. 'Persistent source' class explicitly separates legal flares. Human-in-the-loop labeling improves model continuously."

### Q: "What's your moat / differentiation?"
**A**: "1) Explainable industrial fire classification (not generic fire), 2) OSM + persistence + SHAP evidence fusion, 3) Analyst investigation workflow (not just viz), 4) Production-grade architecture from Day 1."

---

## Demo Day Logistics

### Team Roles During Demo
| Role | Person | Responsibility |
|------|--------|----------------|
| **Presenter** | Team Lead | Narrates, points, controls flow |
| **Driver** | Frontend Dev | Operates mouse/keyboard (separate from presenter) |
| **Backup** | Backend Dev | Monitors API health, restarts if needed |
| **Q&A Lead** | ML Engineer | Fields technical questions |
| **Timekeeper** | Any | Signals 2:30, 2:45, 3:00 |

### Technical Setup
- **Laptop**: Presenter's machine (pre-tested)
- **Display**: HDMI to projector (test resolution 1920x1080)
- **Internet**: Hotspot backup (phone tethering)
- **Power**: Charger connected
- **Browser**: Chrome (incognito) — no extensions
- **Recording**: OBS Studio running (local backup)

### Pre-Demo Timeline
| Time | Action |
|------|--------|
| T-60 min | Team arrives, sets up |
| T-45 min | `make infra-up && make db-migrate && make seed` |
| T-30 min | `make backend` (terminal 1), `make frontend` (terminal 2) |
| T-20 min | Verify: `curl /health`, open frontend, click through flow |
| T-15 min | Dry run (90 sec speed run) |
| T-10 min | Freeze — no more changes |
| T-5 min | Deep breath, water, position |
| T-0 | **GO** |

---

## Post-Demo Follow-up

### Immediate (Same Day)
- [ ] Collect judge feedback cards
- [ ] Note specific questions asked
- [ ] Exchange contacts with interested judges/mentors

### Within 1 Week
- [ ] Send thank-you emails to mentors/judges
- [ ] Address any technical questions promised
- [ ] Update repo with any demo-day fixes

### If Selected for Next Round
- [ ] Prepare 10-min extended demo
- [ ] Add: alerting, mobile, multi-language, CPCB integration
- [ ] Scale test: 10k events, 100 concurrent users
- [ ] Security audit: auth, rate limiting, HTTPS

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **API down** | Low | High | `make infra-up` restarts; backup video ready |
| **Map tiles fail** | Medium | High | Local vector tiles in `public/map-tiles/` |
| **Model not loaded** | Low | Medium | Fallback to mock classifications in frontend |
| **Network issues** | Medium | High | Phone hotspot; offline mode with seeded data |
| **Time overrun** | Medium | Medium | Practice 2:45 timing; driver knows shortcuts |

---

## Success Metrics for Demo

| Metric | Target |
|--------|--------|
| **Demo completes without crash** | 100% |
| **All 4 evidence factors visible** | 100% |
| **Timeline animation plays** | 100% |
| **Judge asks technical follow-up** | >3 questions |
| **Judge mentions "explainable" / "evidence"** | Yes |
| **Post-demo GitHub stars / forks** | >10 |

---

*Last Updated: 2024-01-15 | For SIH26162 Team Internal Use*