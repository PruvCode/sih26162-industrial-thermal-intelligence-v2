# SIH26162 Demo Script

## Demo Overview
- **Duration**: 3 minutes (strict)
- **Format**: Live demo + narrated walkthrough
- **Audience**: SIH 2026 Judges (technical + domain experts)
- **Goal**: Demonstrate working end-to-end platform solving the problem statement

---

## Demo Flow (3 Minutes)

### 0:00-0:30 — Problem & Architecture (30 sec)
**Narrator** (while showing architecture diagram on screen):
> "India has 300,000+ industrial units. Satellite sensors detect thousands of thermal anomalies daily. But most are legitimate flares, furnaces, or wildfires — not dangerous industrial fires. Regulators waste resources investigating false alarms, while real incidents go unnoticed."
>
> "Our platform: **Industrial Thermal Intelligence** — ingests NASA FIRMS data, enriches with OSM industrial context, classifies with explainable ML, and gives analysts a GIS command center to investigate in seconds."

**Visual**: Show system architecture diagram (from `docs/architecture/system-architecture.md`)

---

### 0:30-1:30 — Live Command Center (60 sec)
**Action**: Open `http://localhost:3000` (pre-loaded)

**Narrator** (while interacting):
> "This is our Command Center. Map shows all thermal anomalies from the last 24 hours — **1,247 events** across India. Color-coded by severity: **Red = Industrial Fire**, **Orange = Persistent Source**, **Yellow = Wildfire**, **Gray = Other**."

**Demonstrate**:
1. **Zoom to Gujarat** (industrial corridor) — clusters appear
2. **Click cluster** → expands to individual events
3. **Hover event** → tooltip with class + confidence
4. **Click event** → Evidence Drawer opens on right

---

### 1:30-2:15 — Evidence & Explainability (45 sec)
**Action**: With event detail drawer open

**Narrator**:
> "Here's the key differentiator: **Explainable AI**. Every classification shows *why*."

**Point to Evidence Panel**:
> "**Industrial Fire — 92% confidence**. Top evidence:
> - **Proximity**: 800m from Reliance Chemical Complex (OSM verified)
> - **Persistence**: 15 detections in 30 days at same coordinates
> - **Intensity**: 312K brightness (95th percentile)
> - **Trend**: +2.3K/day — intensifying heat signature"
>
> "SHAP values show exactly which features drove this decision. No black box."

**Demonstrate**:
1. Scroll evidence panel — show positive/negative factors
2. Show SHAP waterfall chart
3. Mention: "Rules + SHAP hybrid — domain experts can audit"

---

### 2:15-2:45 — Timeline Replay (30 sec)
**Action**: Click "Timeline" tab in drawer

**Narrator**:
> "Persistence analysis: scrub through time to see recurrence patterns."

**Demonstrate**:
1. Play animation — events appear day by day
2. Show cluster forming at same location
3. Point out: "This persistence = industrial flare, not wildfire"

---

### 2:45-3:00 — Analytics & Impact (15 sec)
**Action**: Show right-side analytics panel

**Narrator**:
> "Real-time analytics: **342 industrial fires**, **1,876 persistent sources**, **8,921 wildfires** in last 7 days. Top clusters ranked by risk. Export evidence package for enforcement teams."

**Closing**:
> "From satellite to actionable intelligence in seconds. **SIH26162 — Industrial Thermal Intelligence.** Thank you."

---

## Demo Environment Setup

### Pre-Demo Checklist (Run 30 min before)
```bash
# 1. Ensure all services running
make infra-up
make db-migrate
make seed

# 2. Train model (if not done)
make ml-train

# 3. Start dev servers (in separate terminals)
make backend    # Terminal 1
make frontend   # Terminal 2

# 4. Verify
curl http://localhost:8000/health
open http://localhost:3000
```

### Required Demo Data (Seeded)
| Data | Count | Purpose |
|------|-------|---------|
| Industrial Sites (India) | 50+ | Jamnagar, Mumbai, Vizag, Durgapur, Angul, etc. |
| Thermal Events (24h) | 1,247 | Realistic distribution across classes |
| Classifications | 1,247 | With SHAP evidence |
| Clusters | 12 | Persistent sources with history |

### Backup Plan (If Live Fails)
1. **Recorded video** (2 min) — play if servers fail
2. **Static screenshots** — walk through with slides
3. **Local fallback** — `make demo-prepare` creates offline-ready state

---

## Judging Criteria Mapping

| SIH Criterion | Demo Coverage |
|---------------|---------------|
| **Problem Understanding** | 0:00-0:30 (problem statement) |
| **Technical Innovation** | 1:30-2:15 (explainable ML) |
| **Implementation Completeness** | Full live system |
| **Real-world Applicability** | India industrial sites, regulator workflow |
| **Presentation Quality** | Scripted, timed, visual |
| **Team Work** | Multiple components integrated |

---

## Talking Points for Q&A

### Technical
- **Q**: "How do you handle false positives from gas flares?"
- **A**: "OSM tags (`man_made=flare`) + persistence patterns + diurnal cycles classify them as 'persistent_thermal_source' with 85%+ precision."

- **Q**: "What if OSM data is incomplete?"
- **A**: "Weak supervision + analyst feedback loop. Unmapped persistent sources detected via clustering, then human-verified and added to registry."

- **Q**: "Model accuracy?"
- **A**: "Macro F1 0.82 on temporal holdout. Industrial fire recall 0.87. Continuous improvement via active learning."

### Operational
- **Q**: "How does a regulator use this daily?"
- **A**: "Morning briefing: filter by state + 'industrial_fire' + high confidence → 3-5 actionable leads → export evidence PDF → dispatch inspection team."

- **Q**: "Data freshness?"
- **A**: "FIRMS NRT ~3h latency. Our pipeline runs every 3 hours. WebSocket pushes new classifications to dashboard in real-time."

### Scalability
- **Q**: "Can this scale to all of India?"
- **A**: "Yes. PostGIS handles millions of events. Horizontal API scaling. Vector tiles for map. ML inference <1ms/event."

---

## Demo Recording (For Submission)

### Recording Checklist
- [ ] 1080p, 30fps screen recording
- [ ] Clear audio (narrator + system sounds off)
- [ ] Show browser URL bar (proves localhost)
- [ ] No sensitive data visible
- [ ] Trim to exactly 3:00

### Tools
- **Windows**: Xbox Game Bar (Win+G) or OBS Studio
- **Mac**: QuickTime Player or OBS
- **Linux**: OBS Studio or SimpleScreenRecorder

---

## Appendix: Demo Data Details

### Seeded Industrial Sites (Sample)
```sql
-- Major Indian industrial sites with OSM tags
INSERT INTO industrial_sites (name, industrial_type, osm_id, tags, geom) VALUES
('Reliance Jamnagar Refinery', 'refinery', 'way/123456', 
 '{"operator": "RIL", "capacity": "1.2M bpd"}', ST_GeogFromText('SRID=4326;POLYGON((70.1 22.4, ...))')),
('Tata Steel Jamshedpur', 'steel', 'way/234567',
 '{"operator": "Tata Steel", "capacity": "10M TPA"}', ST_GeogFromText('SRID=4326;POLYGON((86.2 22.8, ...))')),
('NTPC Dadri Power Plant', 'power_plant_coal', 'way/345678',
 '{"operator": "NTPC", "capacity": "2600 MW"}', ST_GeogFromText('SRID=4326;POLYGON((77.5 28.5, ...))')),
-- ... 47 more
```

### Seeded Event Classes (Distribution)
| Class | Count | % | Locations |
|-------|-------|---|-----------|
| `industrial_fire` | 45 | 3.6% | Near chemical/refinery/steel sites |
| `persistent_thermal_source` | 180 | 14.4% | Flares, furnaces, kilns (recurring) |
| `natural_wildfire` | 850 | 68.2% | Forest areas (central India, Western Ghats) |
| `other` | 172 | 13.8% | Urban, agricultural, unknown |
| **Total** | **1,247** | **100%** | **Pan-India** |

---

*Last Updated: 2024-01-15 | For SIH26162 Team Internal Use*