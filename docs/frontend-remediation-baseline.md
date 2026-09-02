# SIH26162 — Frontend Remediation Baseline

**Date:** 2026-08-30
**Branch:** `frontend-audit-remediation` (cut from `frontend-cinematic-redesign`)
**Baseline commit:** `127e039` — *checkpoint: pre-remediation baseline (audited state)*
**Source of truth:** `SIH26162-FRONTEND-AUDIT.md`

This document records the state of the application **before any remediation**, so every
later claim can be measured against a fixed reference. No functional changes were made
to produce it.

---

## 1. Repository state at baseline

| Item | Value |
|---|---|
| Working tree at start | **Dirty** — 7 modified files, 593 insertions / 250 deletions |
| Branch at start | `frontend-cinematic-redesign` |
| Action taken | `git checkout -b frontend-audit-remediation` (carries changes, discards nothing) |
| Commit | `127e039` capturing the audited state verbatim |
| Tree after commit | Clean |
| Original branch | Left untouched, still holding its uncommitted work |

The 7 modified files were **the audited state itself** — the in-progress cinematic
redesign that the audit measured. They were committed verbatim, not reverted or merged.

```
apps/web/src/app/page.tsx                        |  26 +-
apps/web/src/components/globe/GlobeHero.tsx      | 218 +++++--
apps/web/src/components/globe/GlobeScene.tsx     | 399 +++++++----
apps/web/src/components/layout/CommandCenter.tsx |  16 +
apps/web/src/components/map/Map.tsx              |  83 +++-
apps/web/src/components/ui/CustomCursor.tsx      |   8 +-
apps/web/src/hooks/useScrollProgress.ts          |  93 ++++-
```

## 2. Commands

| Purpose | Command | Baseline result |
|---|---|---|
| Dev server | `npm run dev -- --port 3010` | HTTP 200 |
| Build | `npm run build` | _not yet run at baseline_ |
| Lint | `npm run lint` | _not yet run at baseline_ |
| Typecheck | `npx tsc --noEmit` | **PASS** (exit 0) |
| Verification harness | `node scripts/verify-frontend.mjs http://localhost:3010/ 1920 1080` | **3/11 passed, 7 critical failures** |

URL under test: `http://localhost:3010/`

## 3. Verification harness (Phase 0 instrumentation)

Created: `apps/web/scripts/verify-frontend.mjs`

Drives real Chrome over the DevTools Protocol using **only Node 22 built-ins**
(`fetch` + global `WebSocket`) — no npm dependency added to the project.

Checks, in one run: webfont loading · CTA handler · nav handlers · map opacity at
operational state · map fills viewport · reverse-scroll escape × 5 cycles · MapLibre
canvas · event row count · cluster console errors · font CORS failures · favicon.

Exits `1` if any critical check fails, so it can gate each phase.

```
node scripts/verify-frontend.mjs [url] [width] [height] [--shots]
```

Latest machine-readable result: `%TEMP%\audit\verify-latest.json`

## 4. Baseline measurements (re-verified, all reproduce the audit)

| # | Check | Baseline | Audit prediction | Match |
|---|---|---|---|---|
| 1 | Webfonts loaded | **0** FontFace objects | 0 | ✅ |
| 2 | Hero CTA onClick | **false** | dead | ✅ |
| 3 | Nav buttons wired | **0 / 4** | dead | ✅ |
| 4 | Map opacity at max scroll | **0.463845** | 0.4638 | ✅ |
| 5 | Map fills viewport | **no** — top `-140`, bottom `940`, vh `1080` | footer eats 140px | ✅ |
| 6 | Reverse wheel escape | **0 / 5 cycles** | trapped | ✅ |
| 7 | MapLibre canvas | 1920×1080 present | present | ✅ |
| 8 | Event rows rendered | **10** | 10 | ✅ |
| 9 | Analytics claim | **12.5K** (12,543) | 12,543 | ✅ |
| 10 | Cluster layer errors | **1 distinct, 15 console entries** | throws ×17 | ✅ |
| 11 | Favicon | **404** | 404 | ✅ |

**Every audit measurement reproduced.** The baseline is trustworthy.

### Scroll geometry — root cause confirmed
```
max scrollTop           = 2084 px
document height         = 3164 px
viewport height         = 1080 px
operationalProgress max = 2084 / 3024 = 0.689      ← can never reach 1.0
map opacity             = (0.689 - 0.55) / 0.3 = 0.463845
```
`regionTravel` is computed as `heroTravel + vh = 1.8vh + 1vh = 2.8vh = 3024px`, but
`CommandCenter` carries `marginTop: -100vh`, so the hero container and the map **end at
the same document offset**. The normaliser is larger than the scrollable range.

### Camera journey — geography failure confirmed
Screenshots: `%TEMP%\audit\journey\` (1280×720, 8 stops)

| Stop | `heroProgress` | What the Earth shows |
|---|---|---|
| 01-space | 0.00 | **North & South America** |
| 02-earth | 0.15 | Americas |
| 03-early | 0.30 | Americas, rotating |
| 04-asia | 0.45 | **Greenland / Canada / northern USA** |
| 05-india | 0.60 | rotating, India not identifiable |
| 06-region | 0.72 | **unrecognisable ice/snow close-up** |
| 07-descent | 0.85 | clipped surface, Earth leaving frame |
| 08-transition | 0.95 | Earth faded, map under way |

Required journey is SPACE → EARTH → ASIA → INDIA → INDIA+surr. → descent.
Delivered journey is **Americas → Americas → Americas → ice**. Product-level P0.

## 5. Console / network at baseline

```
Error: layers.clusters.paint.circle-color: Expected an even number of arguments.
   at addLayer (maplibre-gl.js) via Map.tsx:216        [15 entries]
404   http://localhost:3010/favicon.ico
CORS  tiles.basemaps.cartocdn.com/fonts/Noto Sans Mono Regular/0-255.pbf
ERR   net::ERR_ABORTED  /  net::ERR_FAILED   (glyph fetches)
```

## 6. Assets

Earthpack (used by `GlobeScene`, in `apps/web/public/`):

| File | Size | GPU cost (uncompressed RGBA) |
|---|---|---|
| `8k_earth_daymap.jpg` | 4.5 MB | ~134 MB |
| `8k_earth_clouds.jpg` | 11.6 MB | ~134 MB |
| `8k_earth_nightmap.jpg` | 3.1 MB | ~134 MB |
| **Total** | **19.2 MB** | **~400 MB VRAM (~530 MB w/ mipmaps)** |

## 7. Baseline scoreboard (carried from the audit)

| Dimension | Baseline |
|---|---|
| Visual Design | 5 / 10 |
| UX | 3 / 10 |
| Motion | 4 / 10 |
| Technical Quality | 3 / 10 |
| Map Experience | 3 / 10 |
| Backend Readiness | 5 / 10 |
| SIH Presentation Readiness | 2 / 10 |
| **Overall** | **3.5 / 10** |

## 8. Phase 0 conclusion

Baseline captured and confirmed. **No functional changes made.**

- [x] Git state inspected; uncommitted work preserved on a checkpoint branch
- [x] App runs (`http://localhost:3010/`)
- [x] Typecheck passes
- [x] Verification harness built and committed
- [x] All 11 audit measurements reproduced
- [x] Camera journey captured for later comparison

Ready to begin **Phase 1 — map opacity / document-height bug**.
