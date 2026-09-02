# Product Vision — Industrial Thermal Intelligence Platform

## Vision Statement

> **Empower environmental regulators, industrial operators, and emergency responders with an explainable, real-time intelligence platform that distinguishes harmful industrial fires from legitimate persistent thermal sources — using satellite-derived thermal anomalies enriched with geospatial context.**

## Target Users

| User Persona | Role | Primary Needs |
|--------------|------|---------------|
| **Environmental Regulator** | Pollution Control Board officer | Detect unreported industrial fires, verify compliance, generate evidence for enforcement |
| **Industrial EHS Manager** | Plant safety/environment head | Monitor own flares/furnaces, prove legitimate operations, receive anomaly alerts |
| **Emergency Responder** | Fire brigade / disaster management | Triangulate satellite detections with ground reports, prioritize response |
| **GIS Analyst** | Research / consulting | Historical trend analysis, spatial correlation with infrastructure, export data |
| **SIH Judge** | Hackathon evaluator | Understand problem → solution → impact in 5 minutes, see live working demo |

## Core Value Propositions

### 1. **Discrimination, Not Just Detection**
Traditional fire maps show *where* it's hot. We show *what* it is — industrial fire vs. legitimate flare vs. wildfire — with evidence.

### 2. **Explainable by Design**
Every classification surfaces:
- **Proximity evidence**: Distance to nearest OSM industrial site, site type, tags
- **Persistence evidence**: Recurrence count, temporal pattern, seasonal correlation
- **Intensity evidence**: Brightness temperature trend, FRP (Fire Radiative Power) proxy
- **Context evidence**: Land cover, population density, wind direction
- **Confidence**: Calibrated probability + model uncertainty

### 3. **Analyst Workflow, Not Dashboard**
- **Command Center**: Live map with severity-ranked events
- **Investigation Panel**: Click event → evidence drawer → satellite context → history
- **Timeline Replay**: Scrub time → see persistence patterns emerge
- **Analytics**: Cluster detection, hotspot ranking, trend lines

### 4. **India-First, Global-Ready**
- Pre-loaded Indian industrial corridors (DFC, PCPIR, SEZs)
- OSM tagging schema aligned with Indian context
- Multi-language ready (UI i18n scaffolded)

## User Journeys

### Journey 1: Regulator Morning Briefing
```
1. Open Command Center → sees 47 events in last 24h
2. Filters: "Industrial Fire" + "High Confidence" + "Maharashtra"
3. Sees 3 events near MIDC industrial areas
4. Clicks Event #1 → Evidence Panel shows:
   - 850m from "Reliance Petrochemical Complex" (OSM: industrial=chemical)
   - Persistence: 12 detections in 30 days at same coordinate
   - Brightness: 320K → 340K → 355K (rising trend)
   - Confidence: 0.92 (Industrial Fire)
5. Exports PDF evidence package for inspection team
```

### Journey 2: Plant EHS Manager Verification
```
1. Receives webhook alert: "Persistent Thermal Source detected at your flare stack"
2. Opens link → sees Event classified as "Persistent Thermal Source" (0.88 confidence)
3. Evidence shows:
   - Exact match with registered flare location (OSM: man_made=flare)
   - Diurnal pattern matching operational schedule
   - No brightness anomaly vs. 90-day baseline
3. Marks "Verified Legitimate" → feeds back to model as positive label
```

### Journey 3: Analyst Historical Investigation
```
1. Opens Analytics → "Top 10 Persistent Sources in Gujarat"
2. Sees cluster near Jamnagar refinery complex
3. Opens Timeline Replay → scrubs 6 months
4. Observes: Seasonal spike during maintenance shutdowns (flaring)
5. Exports GeoJSON for report
```

## Design Principles

| Principle | Implementation |
|-----------|----------------|
| **Map-First** | Map is the primary interface; panels are secondary |
| **Dark Analytical Theme** | Low eye strain, high contrast for severity colors |
| **Information Density** | Compact cards, hover details, progressive disclosure |
| **Severity Hierarchy** | 🔴 Critical (industrial fire) → 🟠 High (persistent) → 🟡 Medium (wildfire) → ⚪ Low (other) |
| **Keyboard Navigable** | Full operation without mouse for power users |
| **Offline-First Data** | Cache last 7 days for demo resilience |

## Visual Language

```
Color Palette (Tailwind-compatible):
├── Background:     slate-950 / #020617
├── Surface:        slate-900 / #0f172a
├── Border:         slate-700 / #334155
├── Text Primary:   slate-100 / #f1f5f9
├── Text Muted:     slate-400 / #94a3b8
├── Accent Blue:    sky-400  / #38bdf8 (primary actions, info)
├── Accent Green:   emerald-400 / #34d399 (success, verified)
├── Severity Red:   red-500   / #ef4444 (industrial fire)
├── Severity Orange: amber-500  / #f59e0b (persistent source)
├── Severity Yellow: yellow-400  / #facc15 (wildfire)
├── Severity Gray:   slate-500  / #64748b (other)
└── Focus Ring:     sky-500   / #0ea5e9
```

## Competitive Differentiation

| Feature | Generic Fire Maps | **Our Platform** |
|---------|-------------------|------------------|
| Classification | ❌ Binary (fire/no fire) | ✅ 4-class + confidence |
| Industrial Context | ❌ None | ✅ OSM enrichment + custom registries |
| Persistence Analysis | ❌ Single frame | ✅ Multi-temporal clustering |
| Explainability | ❌ Black box | ✅ SHAP + rule-based evidence |
| Analyst Workflow | ❌ View only | ✅ Investigate, annotate, export |
| Extensibility | ❌ Monolithic | ✅ Plugin architecture (sources, models, exports) |

## Success Metrics (Post-SIH)

| Metric | Target |
|--------|--------|
| Classification F1 (industrial) | >0.85 |
| False positive rate (flare as fire) | <0.10 |
| API p95 latency | <500ms |
| Map render time (1000 events) | <2s |
| Analyst time-to-insight | <30s |
| Weekly active users (regulators) | >50 |

## Roadmap Horizons

### Horizon 1: SIH MVP (Weeks 1-4)
- [x] FIRMS ingestion + validation
- [x] OSM industrial enrichment
- [x] PostGIS schema + API
- [x] XGBoost baseline + SHAP
- [x] Next.js + MapLibre command center
- [x] Event investigation + timeline
- [x] Demo script + synthetic data

### Horizon 2: Operational Pilot (Months 2-4)
- [ ] Sentinel-3 SLSTR confirmation layer
- [ ] Human-in-the-loop labeling UI
- [ ] Alerting engine (webhook/email)
- [ ] India-specific industrial registry import
- [ ] Multi-language UI (Hindi, Gujarati, Tamil)
- [ ] Performance optimization (vector tiles, caching)

### Horizon 3: Platform Scale (Months 5-12)
- [ ] Multi-tenant architecture
- [ ] Model registry + A/B testing
- [ ] Advanced analytics (trend detection, anomaly scoring)
- [ ] Mobile field app for ground truthing
- [ ] Integration with CPCB/SPCB systems
- [ ] Open API for researchers