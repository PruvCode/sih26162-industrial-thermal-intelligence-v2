/**
 * Numeric model of the globe -> map handoff.
 *
 * The screen is near-black when every layer that can put light on it is
 * simultaneously at ~0 opacity. This script composites the four contributors
 * in the raw-scroll domain and reports the darkest stretch, so the transition
 * can be tuned against a number instead of a guess.
 *
 *   G = globe canvas     (GlobeScene dissolve)
 *   O = observation view (ObservationLayer)
 *   W = ambient wash     (HandoffBackdrop)
 *   M = operational map  (page.tsx mapOpacity)
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const CONSTANTS = resolve(HERE, '../src/lib/constants.ts');

/**
 * Pull the real HANDOFF bands out of the app source. If this script hardcoded
 * its own copy of the numbers it would happily pass while the app drifted.
 */
function readHandoff() {
  const src = readFileSync(CONSTANTS, 'utf8');
  const block = src.match(/export const HANDOFF = \{([\s\S]*?)\n\} as const;/);
  if (!block) throw new Error('HANDOFF block not found in apps/web/src/lib/constants.ts');
  const num = (key) => {
    const m = block[1].match(new RegExp(`${key}:\\s*([0-9.]+)`));
    if (!m) throw new Error(`HANDOFF.${key} not found`);
    return Number(m[1]);
  };
  const pair = (key) => {
    const m = block[1].match(new RegExp(`${key}:\\s*\\[([0-9.]+),\\s*([0-9.]+)\\]`));
    if (!m) throw new Error(`HANDOFF.${key} not found`);
    return [Number(m[1]), Number(m[2])];
  };
  return {
    dissolveStart: num('dissolveStart'),
    dissolveEnd: num('dissolveEnd'),
    globeSettled: num('globeSettled'),
    washIn: pair('washIn'),
    washOut: pair('washOut'),
    observationIn: pair('observationIn'),
    observationOut: pair('observationOut'),
  };
}

/** Parse the reveal ramp and map ramp out of source too, for the same reason. */
function readRamps() {
  const useExp = readFileSync(resolve(HERE, '../src/hooks/useExperience.ts'), 'utf8');
  const rs = useExp.match(/const REVEAL_START = ([0-9.]+)/);
  const re = useExp.match(/const REVEAL_END = ([0-9.]+)/);
  if (!rs || !re) throw new Error('REVEAL_START/REVEAL_END not found in useExperience.ts');

  const page = readFileSync(resolve(HERE, '../src/app/page.tsx'), 'utf8');
  const mapRamp = page.match(/mapOpacity = clamp01\(smootherstep\(([0-9.]+),\s*([0-9.]+),\s*reveal\)\)/);
  if (!mapRamp) throw new Error('mapOpacity ramp not found in page.tsx');

  return {
    revealStart: Number(rs[1]),
    revealEnd: Number(re[1]),
    mapIn: [Number(mapRamp[1]), Number(mapRamp[2])],
  };
}

const H = readHandoff();
const R = readRamps();
console.log('HANDOFF read from source:', JSON.stringify(H));
console.log('RAMPS   read from source:', JSON.stringify(R));

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smoothstep = (e0, e1, x) => (e0 === e1 ? (x < e0 ? 0 : 1) : clamp01((x - e0) / (e1 - e0)));
const smootherstep = (e0, e1, x) => {
  const t = smoothstep(e0, e1, x);
  return t * t * (3 - 2 * t);
};

// cinematicProgress as published by useExperience
const OBSERVATION_START = 0.68;
const cine = (raw) => smootherstep(0, OBSERVATION_START, raw);
// operationalProgress ("reveal"), quantised 1/200 in the real app
const revealNow = (raw) => smoothstep(R.revealStart, R.revealEnd, raw);
// the ramp as it shipped before this work
const revealBefore = (raw) => smoothstep(0.86, 1, raw);

/**
 * PERCEIVED-BRIGHTNESS MODEL.
 *
 * The 0..1 "composite" above only says *something* is on screen. It cannot see
 * that the globe view is ~4x brighter than the dashboard view, so a crossfade
 * can pass the composite check and still visibly dip.
 *
 * Anchors are MEASURED, not guessed — from scripts/handoff-probe.mjs, which
 * screenshots the real page and integrates Rec.709 luminance:
 *   globe dominant   mean 128.2  (raw 0.79–0.85)
 *   map dominant     mean  30.4  (raw 1.00)
 *   backdrop + obs   mean  11.8  (raw 0.882, globe and map both ~0)
 * The bare stage background #05070B is 6.86.
 */
const L_GLOBE = 128.2;
const L_MAP = 30.4;
const L_WITH_BACKDROP = 11.8;
const L_BARE = 6.86;

/** Map sits above the globe; the globe sits above the ambient base. */
const luminance = (m, raw) => {
  const g = clamp01(m.G(raw));
  const mm = clamp01(m.M(raw));
  const under = g * L_GLOBE + (1 - g) * m.base;
  return mm * L_MAP + (1 - mm) * under;
};

// ── CURRENT (as shipped) ─────────────────────────────────────────────────
const current = {
  base: L_BARE, // no backdrop existed

  // GlobeScene drives the dissolve off cinematicProgress, not raw progress.
  G: (raw) => 1 - smoothstep(0.62, 0.9, cine(raw)),
  // ObservationLayer uses raw progress, but page.tsx gates it hidden whenever
  // globeOpacity >= 0.99 -- which is always, because globeOpacity is derived
  // from `reveal` (0 until raw 0.86). So it never renders.
  O: () => 0,
  W: () => 0,
  M: (raw) => smootherstep(0.02, 0.72, revealBefore(raw)),
};

// ── PROPOSED ─────────────────────────────────────────────────────────────
const proposed = {
  base: L_WITH_BACKDROP, // backdrop + observation view carry the floor
  G: (raw) => 1 - smoothstep(H.dissolveStart, H.dissolveEnd, raw),
  O: (raw) =>
    smootherstep(H.observationIn[0], H.observationIn[1], raw) *
    (1 - smootherstep(H.observationOut[0], H.observationOut[1], raw)),
  W: (raw) =>
    smootherstep(H.washIn[0], H.washIn[1], raw) *
    (1 - smootherstep(H.washOut[0], H.washOut[1], raw)),
  M: (raw) => smootherstep(R.mapIn[0], R.mapIn[1], revealNow(raw)),
};

// The globe must be fully dissolved, and three.js stopped, before the map owns
// the screen — otherwise the planet is still rendering behind the dashboard.
if (H.globeSettled < H.dissolveEnd) {
  console.error('\nHANDOFF.globeSettled must be >= dissolveEnd (the loop is cancelled too early)');
  process.exit(1);
}

const composite = (m, raw) => {
  const g = clamp01(m.G(raw));
  const o = clamp01(m.O(raw));
  const w = clamp01(m.W(raw));
  const mm = clamp01(m.M(raw));
  return 1 - (1 - g) * (1 - o) * (1 - w) * (1 - mm);
};

function report(name, m) {
  let min = Infinity;
  let minAt = 0;
  let blackFrom = null;
  let blackTo = null;
  const rows = [];
  for (let raw = 0; raw <= 1.0001; raw += 0.002) {
    const v = composite(m, raw);
    if (v < min) {
      min = v;
      minAt = raw;
    }
    // "reads as black" = under 6% of full brightness
    if (v < 0.06) {
      if (blackFrom === null) blackFrom = raw;
      blackTo = raw;
    }
    if (Math.abs(raw * 100 - Math.round(raw * 100)) < 1e-6 && Math.round(raw * 100) % 5 === 0) {
      rows.push([raw, m.G(raw), m.O(raw), m.W(raw), m.M(raw), v]);
    }
  }

  console.log(`\n=== ${name} ===`);
  console.log('  raw    globe   obs     wash    map     composite');
  for (const [r, g, o, w, mm, v] of rows) {
    const bar = '#'.repeat(Math.round(v * 40));
    console.log(
      `  ${r.toFixed(2)}   ${g.toFixed(3)}   ${o.toFixed(3)}   ${w.toFixed(3)}   ${mm.toFixed(3)}   ${v.toFixed(3)}  ${bar}`
    );
  }
  console.log(`  darkest composite: ${min.toFixed(4)} at raw=${minAt.toFixed(3)}`);
  console.log(
    blackFrom === null
      ? '  black band: NONE'
      : `  black band (<0.06): raw ${blackFrom.toFixed(3)} .. ${blackTo.toFixed(3)}  (${(blackTo - blackFrom).toFixed(3)} of journey = ${Math.round((blackTo - blackFrom) * 420)}vh)`
  );
  return min;
}

const curMin = report('CURRENT', current);
const proMin = report('PROPOSED', proposed);

/**
 * TROUGH CHECK.
 *
 * A crossfade that never goes black can still blink: if brightness dips below
 * where the journey ENDS, the user sees it fall away and come back. Require
 * the descent to stay within 10% of the settled dashboard brightness.
 */
function troughCheck(name, m) {
  const finalLum = luminance(m, 1.0);
  let min = Infinity;
  let minAt = 0;
  const rows = [];
  for (let raw = 0.74; raw <= 1.0001; raw += 0.002) {
    const l = luminance(m, raw);
    if (l < min) {
      min = l;
      minAt = raw;
    }
    if (Math.abs(raw * 100 - Math.round(raw * 100)) < 1e-6 && Math.round(raw * 100) % 3 === 0) {
      rows.push([raw, l]);
    }
  }
  console.log(`\n=== ${name} — predicted luminance across the descent ===`);
  console.log('  raw    lum    ');
  for (const [r, l] of rows) {
    console.log(`  ${r.toFixed(2)}   ${l.toFixed(1).padStart(5)}  ${'#'.repeat(Math.round(l / 4))}`);
  }
  const ok = min >= finalLum * 0.9;
  console.log(
    `  settles at ${finalLum.toFixed(1)}; darkest point of descent ${min.toFixed(1)} at raw=${minAt.toFixed(3)} → ${
      ok ? 'no trough' : 'TROUGH (dips below 90% of final brightness)'
    }`
  );
  return ok;
}

const curOk = troughCheck('CURRENT', current);
const proOk = troughCheck('PROPOSED', proposed);

console.log('\n── verdict ──');
console.log(`current  min composite : ${curMin.toFixed(4)}   no-trough: ${curOk}`);
console.log(`proposed min composite : ${proMin.toFixed(4)}   no-trough: ${proOk}`);

const pass = proMin > 0.25 && proOk;
console.log(pass ? '\nPROPOSED PASSES' : '\nPROPOSED FAILS');
process.exit(pass ? 0 : 1);
