/**
 * SIH26162 — thermal marker restyle probe.
 *
 * Verifies the tightened + brightened detection circles on the live map:
 *   1. events-glow: 1.8x core radius, blur 0.55, brighter base opacity 0.22
 *   2. events-core: base opacity 0.95, brightened class palette
 *   3. clusters-glow: new gradient halo layer, blur 0.75, opacity 0.3
 *   4. clusters: discs shrunk to 12/17/23/30, brighter fills/strokes
 *   5. halo renders BELOW the cluster disc, and visibility follows the
 *      events layer toggle
 *
 *   Run:  node tests/e2e/probe-markers.mjs
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHOTS = resolve(HERE, 'shots-markers');
mkdirSync(SHOTS, { recursive: true });

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
let browser;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function scrollTo(page, p, settleMs = 900) {
  await page.evaluate((frac) => {
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    window.scrollTo(0, Math.round(max * frac));
  }, p);
  await page.waitForTimeout(settleMs);
}

async function shot(page, path) {
  const client = await page.context().newCDPSession(page);
  try {
    const { data } = await client.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    });
    await writeFile(path, Buffer.from(data, 'base64'));
  } finally {
    await client.detach().catch(() => {});
  }
}

async function main() {
  browser = await chromium.launch({
    args: [
      '--enable-unsafe-swiftshader',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
    ],
  });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.addStyleTag({ content: '[data-variant]{display:none !important;}' }).catch(() => {});
  await page.waitForFunction(() => !document.querySelector('[data-testid="loading-screen"]'), { timeout: 60_000 });
  await scrollTo(page, 1, 2400);

  // The style (and therefore the event layers) can arrive well after the
  // loading screen releases — especially on the first load after an edit,
  // while the dev server recompiles. Wait for the layers explicitly.
  try {
    await page.waitForFunction(
      () => {
        const m = window.__sihMap;
        return m && typeof m.getLayer === 'function' && Boolean(m.getLayer('events-core'));
      },
      { timeout: 45_000, polling: 500 }
    );
  } catch {
    console.error('page errors seen:', errors.slice(0, 6));
    throw new Error('map instance / event layers never appeared within 45s');
  }

  // ── 1. Paint properties on the live map ─────────────────────────────────
  const paint = await page.evaluate(() => {
    const m = window.__sihMap;
    if (!m) return null;
    const get = (layer, prop) => {
      try {
        return m.getPaintProperty(layer, prop);
      } catch {
        return undefined;
      }
    };
    const styleLayers = m.getStyle().layers.map((l) => l.id);
    return {
      hasGlow: Boolean(m.getLayer('events-glow')),
      hasCore: Boolean(m.getLayer('events-core')),
      hasClusterGlow: Boolean(m.getLayer('clusters-glow')),
      hasClusters: Boolean(m.getLayer('clusters')),
      glowBlur: get('events-glow', 'circle-blur'),
      glowRadius: JSON.stringify(get('events-glow', 'circle-radius')),
      glowOpacity: JSON.stringify(get('events-glow', 'circle-opacity')),
      coreRadius: JSON.stringify(get('events-core', 'circle-radius')),
      coreOpacity: JSON.stringify(get('events-core', 'circle-opacity')),
      coreColor: JSON.stringify(get('events-core', 'circle-color')),
      clusterGlowBlur: get('clusters-glow', 'circle-blur'),
      clusterGlowOpacity: get('clusters-glow', 'circle-opacity'),
      clusterRadius: JSON.stringify(get('clusters', 'circle-radius')),
      clusterFill: JSON.stringify(get('clusters', 'circle-color')),
      orderGlow: styleLayers.indexOf('clusters-glow'),
      orderDisc: styleLayers.indexOf('clusters'),
    };
  });

  assert(paint, 'map instance (window.__sihMap) not exposed');
  assert(paint.hasGlow && paint.hasCore && paint.hasClusters, 'base event layers missing');
  assert(paint.hasClusterGlow, 'clusters-glow halo layer missing');
  assert(paint.glowBlur === 0.55, `events-glow blur is ${paint.glowBlur}, expected 0.55`);
  // Glow stops = base × 1.8 (first stop 1.7 × 1.8 = 3.06); both layers must
  // also carry the FRP intensity factor — and `zoom` must sit at the TOP
  // level of the interpolate, or MapLibre silently drops the layer.
  assert(paint.glowRadius.includes('3.06'), `events-glow radius stops are not 1.8x core: ${paint.glowRadius.slice(0, 90)}`);
  assert(paint.glowRadius.includes('intensity'), `events-glow radius lost the FRP intensity factor: ${paint.glowRadius.slice(0, 90)}`);
  assert(paint.coreRadius.includes('intensity'), `events-core radius lost the FRP intensity factor: ${paint.coreRadius.slice(0, 90)}`);
  assert(paint.glowOpacity.includes('0.22'), `events-glow base opacity not 0.22: ${paint.glowOpacity}`);
  assert(paint.coreOpacity.includes('0.95'), `events-core base opacity not 0.95: ${paint.coreOpacity}`);
  assert(paint.coreColor.includes('#FF6B6B'), `brightened palette not applied: ${paint.coreColor.slice(0, 80)}`);
  assert(paint.clusterGlowBlur === 0.75, `clusters-glow blur is ${paint.clusterGlowBlur}, expected 0.75`);
  assert(paint.clusterGlowOpacity === 0.3, `clusters-glow opacity is ${paint.clusterGlowOpacity}, expected 0.3`);
  assert(/12,10,17,40,23,120,30/.test(paint.clusterRadius), `cluster discs not shrunk: ${paint.clusterRadius}`);
  assert(paint.clusterFill.includes('0.30'), `cluster fills not brightened: ${paint.clusterFill.slice(0, 80)}`);
  assert(
    paint.orderGlow !== -1 && paint.orderDisc !== -1 && paint.orderGlow < paint.orderDisc,
    `halo (idx ${paint.orderGlow}) must render below the disc (idx ${paint.orderDisc})`
  );
  console.log('PASS — all paint properties live on the map');
  console.log(`       halo below disc: ${paint.orderGlow} < ${paint.orderDisc} · glow 1.8x/blur 0.55 · discs 12/17/23/30`);

  await shot(page, `${SHOTS}/01-india-wide-clusters.png`);

  // ── 2. Zoom into a hotspot — individual detection gradients ────────────
  const zoomed = await page.evaluate(() => {
    const m = window.__sihMap;
    const feats = m.queryRenderedFeatures({ layers: ['clusters', 'events-core'] });
    const f = feats.find((x) => x.geometry?.type === 'Point');
    if (!f) return null;
    const [lng, lat] = f.geometry.coordinates;
    m.flyTo({ center: [lng, lat], zoom: 9.2, duration: 0, essential: true });
    return { lng, lat, kind: f.layer.id };
  });
  assert(zoomed, 'no rendered detection features found to zoom to');
  await page.waitForTimeout(1800);
  await shot(page, `${SHOTS}/02-zoomed-detections.png`);
  console.log(`PASS — zoomed to hotspot (${zoomed.lng.toFixed(2)}, ${zoomed.lat.toFixed(2)}) via ${zoomed.kind}`);

  // ── 3. Halo visibility follows the events toggle ────────────────────────
  await page.click('button[aria-label="Show map layers"]');
  await page.waitForSelector('[data-testid="layer-control-panel"]', { timeout: 10_000 });
  await page.click('[data-testid="layer-control-panel"] button[aria-label="Thermal detections"]');
  await page.waitForTimeout(500);
  const offOn = await page.evaluate(() => window.__sihMap.getLayoutProperty('clusters-glow', 'visibility'));
  await page.click('[data-testid="layer-control-panel"] button[aria-label="Thermal detections"]');
  await page.waitForTimeout(500);
  const offOff = await page.evaluate(() => window.__sihMap.getLayoutProperty('clusters-glow', 'visibility'));
  assert(offOn === 'none', `halo stayed visible after toggling detections off (${offOn})`);
  assert(offOff === 'visible', `halo did not return after toggling detections on (${offOff})`);
  console.log('PASS — halo visibility follows the thermal detections toggle');

  await shot(page, `${SHOTS}/03-zoomed-after-toggle.png`);

  const networkNoise = (t) => /tile|glyph|sprite|ERR_|Failed to load resource|net::/i.test(t);
  const realErrors = errors.filter((t) => !networkNoise(t));
  assert(realErrors.length === 0, `${realErrors.length} page errors: ${realErrors[0]?.slice(0, 120)}`);

  await browser.close();
  console.log('\nMARKER PROBE: ALL CHECKS PASSED');
  process.exit(0);
}

main().catch(async (err) => {
  console.error('MARKER PROBE FAILED:', err.message);
  if (browser) await browser.close();
  process.exit(1);
});
