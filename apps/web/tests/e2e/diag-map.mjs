/**
 * Quick diagnostic: why aren't the map event layers appearing?
 */

import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
let browser;

async function scrollTo(page, p, settleMs = 900) {
  await page.evaluate((frac) => {
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    window.scrollTo(0, Math.round(max * frac));
  }, p);
  await page.waitForTimeout(settleMs);
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

  const consoleMsgs = [];
  page.on('console', (m) => consoleMsgs.push(`[${m.type()}] ${m.text().slice(0, 200)}`));
  page.on('pageerror', (e) => consoleMsgs.push(`[pageerror] ${e.message.slice(0, 200)}`));

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.addStyleTag({ content: '[data-variant]{display:none !important;}' }).catch(() => {});

  await page.waitForTimeout(4000);
  const early = await page.evaluate(() => ({
    loadingScreen: Boolean(document.querySelector('[data-testid="loading-screen"]')),
    mapCanvas: Boolean(document.querySelector('.maplibregl-canvas')),
    sihMap: Boolean(window.__sihMap),
  }));
  console.log('after 4s:', JSON.stringify(early));

  await page.waitForFunction(() => !document.querySelector('[data-testid="loading-screen"]'), { timeout: 60_000 });
  await scrollTo(page, 1, 2400);
  await page.waitForTimeout(6000);

  const state = await page.evaluate(() => {
    const m = window.__sihMap;
    return {
      sihMap: Boolean(m),
      mapStyleLoaded: m ? m.isStyleLoaded() : null,
      styleUrl: m ? (m.getStyle()?.name ?? 'unnamed') : null,
      layers: m ? m.getStyle().layers.map((l) => l.id) : null,
      eventLayers: m
        ? ['events-glow', 'events-core', 'clusters-glow', 'clusters'].filter((id) => Boolean(m.getLayer(id)))
        : null,
      canvas: Boolean(document.querySelector('.maplibregl-canvas')),
      degradedBanner: document.body.innerText.includes('Tile server unreachable'),
      webglError: (() => {
        const c = document.createElement('canvas');
        const gl = c.getContext('webgl2') ?? c.getContext('webgl');
        return gl ? null : 'no-webgl-context';
      })(),
    };
  });
  console.log('final state:', JSON.stringify(state, null, 2));
  console.log('\nconsole messages (' + consoleMsgs.length + '):');
  consoleMsgs.slice(0, 30).forEach((m) => console.log('  ' + m));

  await browser.close();
}

main().catch(async (err) => {
  console.error('DIAG ERROR:', err.message);
  if (browser) await browser.close();
  process.exit(1);
});
