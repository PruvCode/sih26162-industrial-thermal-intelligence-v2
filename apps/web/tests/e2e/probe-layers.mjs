/**
 * SIH26162 — layers-in-sidebar placement probe.
 *
 * Verifies the map layer control that was moved into the event navigator:
 *   1. The layers toggle button lives INSIDE the sidebar (not floating).
 *   2. Clicking it expands the panel within the sidebar's bounds.
 *   3. The layer switches actually toggle analytics layers.
 *   4. The control is completely absent from every non-command view.
 *
 *   Run:  node tests/e2e/probe-layers.mjs
 *   Needs: dev server on http://localhost:3000
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHOTS = resolve(HERE, 'shots-layers');
mkdirSync(SHOTS, { recursive: true });

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

const results = [];
let browser;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function test(name, fn) {
  const started = Date.now();
  try {
    const detail = await fn();
    results.push({ name, pass: true });
    console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ''}`);
  } catch (err) {
    results.push({ name, pass: false });
    console.log(`  FAIL  ${name} — ${err.message}`);
  }
  void started;
}

/** Scroll to a fraction of the document and let the rAF loop settle. */
async function scrollTo(page, p, settleMs = 900) {
  await page.evaluate((frac) => {
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    window.scrollTo(0, Math.round(max * frac));
  }, p);
  await page.waitForTimeout(settleMs);
}

/** CDP screenshot — page.screenshot hangs on document.fonts.ready here. */
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

/** Both possible aria-labels of the layers toggle (closed / open). */
const TOGGLE_SEL = 'button[aria-label="Show map layers"], button[aria-label="Hide map layers"]';

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

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    reducedMotion: 'no-preference',
  });
  const page = await context.newPage();

  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));

  console.log(`\nSIH26162 — layers placement probe against ${BASE}\n`);

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.addStyleTag({ content: '[data-variant]{display:none !important;}' }).catch(() => {});
  await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve())).catch(() => {});

  await page.waitForFunction(
    () => !document.querySelector('[data-testid="loading-screen"]'),
    { timeout: 60_000 }
  );

  // Enter operational mode.
  await scrollTo(page, 1, 2200);
  const chromeOpacity = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="operational-chrome"]');
    return el ? Number(getComputedStyle(el).opacity) : -1;
  });
  assert(chromeOpacity > 0.9, `chrome opacity ${chromeOpacity} — never reached operational mode`);

  // ── 1. Toggle lives inside the sidebar ──────────────────────────────────
  await test('layers toggle lives inside the event navigator sidebar', async () => {
    await page.locator('button[aria-label="Show map layers"]').waitFor({ state: 'visible', timeout: 15_000 });
    const info = await page.evaluate(() => {
      const btn = document.querySelector('button[aria-label="Show map layers"]');
      const nav = btn.closest('div.pointer-events-auto'); // EventNavigator root
      const b = btn.getBoundingClientRect();
      const n = nav.getBoundingClientRect();
      return { b, n, navW: n.width };
    });
    assert(info.navW < 400, `toggle's panel ancestor is ${info.navW}px wide — not the sidebar`);
    assert(
      info.b.x >= info.n.x - 1 && info.b.right <= info.n.right + 1,
      `toggle x ${info.b.x.toFixed(0)}–${info.b.right.toFixed(0)} escapes sidebar ${info.n.x.toFixed(0)}–${info.n.right.toFixed(0)}`
    );
    assert(
      info.b.y >= info.n.y - 1 && info.b.bottom <= info.n.bottom + 1,
      `toggle y ${info.b.y.toFixed(0)}–${info.b.bottom.toFixed(0)} escapes sidebar`
    );
    return `toggle at (${info.b.x.toFixed(0)}, ${info.b.y.toFixed(0)}) in sidebar w=${info.navW.toFixed(0)}px`;
  });

  await shot(page, `${SHOTS}/01-sidebar-closed.png`);

  // ── 2. Panel expands inside the sidebar ─────────────────────────────────
  await test('expanding the panel keeps it inside the sidebar bounds', async () => {
    await page.click('button[aria-label="Show map layers"]');
    await page.locator('[data-testid="layer-control-panel"]').waitFor({ state: 'visible', timeout: 10_000 });
    const info = await page.evaluate(() => {
      const panel = document.querySelector('[data-testid="layer-control-panel"]');
      const nav = panel.closest('div.pointer-events-auto');
      const p = panel.getBoundingClientRect();
      const n = nav.getBoundingClientRect();
      return { p, n };
    });
    assert(
      info.p.x >= info.n.x - 1 && info.p.right <= info.n.right + 1,
      `panel x ${info.p.x.toFixed(0)}–${info.p.right.toFixed(0)} escapes sidebar ${info.n.x.toFixed(0)}–${info.n.right.toFixed(0)}`
    );
    assert(
      info.p.bottom <= info.n.bottom + 1,
      `panel bottom ${info.p.bottom.toFixed(0)} escapes sidebar bottom ${info.n.bottom.toFixed(0)}`
    );
    const flipped = await page.evaluate(() =>
      Boolean(document.querySelector('button[aria-label="Hide map layers"]'))
    );
    assert(flipped, 'toggle did not flip to its open state');
    return `panel ${info.p.width.toFixed(0)}px wide, y ${info.p.y.toFixed(0)}, fully inside sidebar`;
  });

  await shot(page, `${SHOTS}/02-sidebar-open.png`);

  // ── 3. Switches actually toggle layers ──────────────────────────────────
  await test('layer switches toggle analytics layers', async () => {
    const active = () =>
      page.evaluate(
        () => document.querySelectorAll('[data-testid="layer-control-panel"] [role="switch"][aria-checked="true"]').length
      );
    const switchState = () =>
      page.evaluate(
        () =>
          document
            .querySelector('[data-testid="layer-control-panel"] button[aria-label="Density surface"]')
            ?.getAttribute('aria-checked') ?? 'missing'
      );
    const before = await active();
    const stateBefore = await switchState();
    await page.click('[data-testid="layer-control-panel"] button[aria-label="Density surface"]');
    await page.waitForTimeout(350);
    const after = await active();
    const stateAfter = await switchState();
    assert(stateAfter !== stateBefore, `switch did not flip (${stateBefore} → ${stateAfter})`);
    assert(Math.abs(after - before) === 1, `active switches ${before} → ${after}, expected exactly ±1`);
    await page.click('[data-testid="layer-control-panel"] button[aria-label="Density surface"]');
    await page.waitForTimeout(350);
    const restored = await active();
    assert(restored === before, `active switches did not restore (${before} → ${restored})`);
    return `heatmap ${stateBefore} → ${stateAfter} → restored; active layers ${before} → ${after} → ${restored}`;
  });

  await shot(page, `${SHOTS}/03-panel-toggled.png`);

  // ── 4. Absent from every non-command view ───────────────────────────────
  await test('layers control absent from every non-command view', async () => {
    const out = [];
    for (const label of ['Events', 'Analytics', 'Watchtower', 'About']) {
      await page.click(`nav[aria-label="Primary"] >> text=${label}`);
      await page.waitForTimeout(1100);
      const toggles = await page.locator(TOGGLE_SEL).count();
      const panels = await page.locator('[data-testid="layer-control-panel"]').count();
      assert(toggles === 0, `${label} view still shows ${toggles} layer toggle button(s)`);
      assert(panels === 0, `${label} view still shows ${panels} layer panel(s)`);
      out.push(`${label}:0`);
    }
    await page.click('nav[aria-label="Primary"] >> text=Command');
    await page.waitForTimeout(900);
    const back = await page.locator(TOGGLE_SEL).count();
    assert(back === 1, `layers toggle did not return on command view (${back})`);
    out.push('Command:1');
    return out.join(' ');
  });

  await shot(page, `${SHOTS}/04-command-restored.png`);

  // ── Hygiene ──────────────────────────────────────────────────────────────
  const networkNoise = (t) =>
    /tile|glyph|sprite|ERR_(NAME|INTERNET|CONNECTION|NETWORK)|Failed to load resource|net::/i.test(t);
  const realErrors = errors.filter((t) => !networkNoise(t));

  const passed = results.filter((r) => r.pass).length;
  console.log(`\n  ${passed}/${results.length} passed · ${realErrors.length} real console errors`);
  if (realErrors.length) realErrors.slice(0, 8).forEach((e) => console.log(`    ! ${e.slice(0, 160)}`));
  console.log(`  screenshots in tests/e2e/shots-layers\n`);

  await browser.close();
  process.exit(passed === results.length && realErrors.length === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error('\nHARNESS ERROR:', err);
  if (browser) await browser.close();
  process.exit(2);
});
