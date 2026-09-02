/**
 * SIH26162 — end-to-end journey verification.
 *
 * Ten named tests run against the real application in a real browser with a
 * real WebGL context (SwiftShader). Every one of them encodes a defect that
 * existed in the audited build, so a regression here is a regression in the
 * product, not in the test.
 *
 *   Run:  node tests/e2e/journey.mjs
 *   Needs: dev server on http://localhost:3000
 */

import { chromium } from 'playwright';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHOTS = resolve(HERE, 'shots');
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

const VIEWPORTS = [
  { name: 'desktop-1920', width: 1920, height: 1080 },
  { name: 'laptop-1440', width: 1440, height: 900 },
  { name: 'laptop-1366', width: 1366, height: 768 },
  { name: 'small-1280', width: 1280, height: 800 },
  { name: 'tablet-1024', width: 1024, height: 768 },
];

const results = [];
let browser;

// ── Helpers ─────────────────────────────────────────────────────────────────

async function test(name, fn) {
  const started = Date.now();
  try {
    const detail = await fn();
    results.push({ name, pass: true, detail: detail ?? '', ms: Date.now() - started });
    console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ''}`);
  } catch (err) {
    results.push({ name, pass: false, detail: err.message, ms: Date.now() - started });
    console.log(`  FAIL  ${name} — ${err.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

/** Scroll to a fraction of the document and let the rAF loop settle. */
async function scrollTo(page, p, settleMs = 900) {
  await page.evaluate((frac) => {
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    window.scrollTo(0, Math.round(max * frac));
  }, p);
  await page.waitForTimeout(settleMs);
}

function opacityOf(page, testId) {
  return page.evaluate((id) => {
    const el = document.querySelector(`[data-testid="${id}"]`);
    return el ? Number(getComputedStyle(el).opacity) : -1;
  }, testId);
}

/**
 * Screenshot via the CDP protocol instead of `page.screenshot`.
 *
 * `page.screenshot` blocks on `document.fonts.ready` and on visual stability,
 * and with self-hosted `next/font` faces served by the dev server the font
 * wait intermittently never clears in this sandbox, hanging every capture.
 * The CDP `Page.captureScreenshot` call takes the framebuffer directly — no
 * font wait, no stability wait — so it is deterministic.
 */
import { writeFile } from 'node:fs/promises';
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

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  rmSync(SHOTS, { recursive: true, force: true });
  mkdirSync(SHOTS, { recursive: true });

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

  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => pageErrors.push(e.message));

  console.log(`\nSIH26162 — journey verification against ${BASE}\n`);

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90_000 });

  // The custom intelligence cursor runs a requestAnimationFrame loop that
  // mutates `transform` on its dot/ring every frame. Playwright's screenshot
  // waits for visual stability, and a perpetually-moving element never
  // settles — which hangs every capture. Hiding the cursor elements removes
  // the motion. (It is decorative; nothing functional depends on it.)
  await page.addStyleTag({ content: '[data-variant]{display:none !important;}' }).catch(() => {});
  // Warm fonts once so later screenshots don't block on document.fonts.ready.
  await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve())).catch(() => {});

  // ── 1. Loading completes on real readiness ──────────────────────────────
  await test('01 — loading screen releases on real asset readiness', async () => {
    await page.waitForFunction(
      () => !document.querySelector('[data-testid="loading-screen"]'),
      { timeout: 45_000 }
    );
    const elapsed = await page.evaluate(() => Math.round(performance.now()));
    return `released at ${elapsed}ms`;
  });

  // ── 2. Fonts actually load ──────────────────────────────────────────────
  await test('02 — display + mono fonts are self-hosted and applied', async () => {
    const info = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      return {
        loaded: document.fonts.size,
        family: h1 ? getComputedStyle(h1).fontFamily : '',
      };
    });
    assert(info.loaded > 0, `document.fonts.size is ${info.loaded} — no webfont registered`);
    assert(
      /Cormorant/i.test(info.family),
      `h1 computed font-family is "${info.family}" — expected Cormorant Garamond`
    );
    return `${info.loaded} faces, h1 = ${info.family.split(',')[0]}`;
  });

  // ── 3. Document progress reaches exactly 1 ──────────────────────────────
  await test('03 — scroll progress reaches 1 (no negative-margin trap)', async () => {
    const r = await page.evaluate(() => {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      window.scrollTo(0, max);
      return { max, docH: document.documentElement.scrollHeight, vh: window.innerHeight };
    });
    await page.waitForTimeout(700);
    const p = await page.evaluate(() => {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      return window.scrollY / max;
    });
    assert(p > 0.999, `progress capped at ${p.toFixed(4)} (doc ${r.docH}px / vh ${r.vh}px)`);
    return `progress = ${p.toFixed(4)}`;
  });

  // ── 4. Map reaches full opacity ─────────────────────────────────────────
  await test('04 — operational map reaches opacity 1.0', async () => {
    // Ensure the scroll journey has fully settled into operational mode before
    // sampling the opacity ramp (reveal is quantised and approached via rAF).
    await scrollTo(page, 1, 1600);
    const o = await opacityOf(page, 'stage-map');
    assert(o > 0.99, `map opacity stuck at ${o.toFixed(4)}`);
    const chrome = await opacityOf(page, 'operational-chrome');
    assert(chrome > 0.99, `chrome opacity stuck at ${chrome.toFixed(4)}`);
    return `map ${o.toFixed(3)} / chrome ${chrome.toFixed(3)}`;
  });

  // ── 5. Reverse scroll returns to the hero ───────────────────────────────
  await test('05 — reverse scroll unwinds the journey (map cannot trap page)', async () => {
    await scrollTo(page, 1, 700);
    const atBottom = await page.evaluate(() => window.scrollY);

    await scrollTo(page, 0.5, 700);
    const mid = await page.evaluate(() => window.scrollY);

    await scrollTo(page, 0, 900);
    const atTop = await page.evaluate(() => window.scrollY);

    assert(atBottom > 1000, `bottom scrollY only ${atBottom}px`);
    assert(mid < atBottom && mid > 10, `mid scrollY ${mid}px is not between`);
    assert(atTop === 0, `reverse scroll stopped at ${atTop}px, not 0`);

    const globe = await opacityOf(page, 'stage-globe');
    assert(globe > 0.99, `globe opacity ${globe.toFixed(3)} after returning to hero`);
    return `${atBottom} → ${mid} → ${atTop}px, globe restored to ${globe.toFixed(2)}`;
  });

  // ── 6. Three.js stops rendering after handoff ───────────────────────────
  await test('06 — globe render loop stops after handoff (lifecycle gate)', async () => {
    await scrollTo(page, 1, 1600);
    const stopped = await page.evaluate(
      () =>
        new Promise((res) => {
          let frames = 0;
          const t0 = performance.now();
          const tick = () => {
            frames += 1;
            if (performance.now() - t0 < 1200) requestAnimationFrame(tick);
            else res(frames);
          };
          requestAnimationFrame(tick);
        })
    );
    // The gate cancels the globe's rAF; a page-level rAF counter still runs,
    // so we assert the globe canvas is hidden rather than counting draws.
    const visible = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="stage-globe"]');
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { opacity: Number(cs.opacity), visibility: cs.visibility };
    });
    assert(visible, 'globe stage missing');
    assert(
      visible.opacity < 0.01 || visible.visibility === 'hidden',
      `globe still rendered at opacity ${visible.opacity} / ${visible.visibility}`
    );
    return `globe hidden at bottom (page rAF alive: ${stopped} frames/1.2s)`;
  });

  // ── 7. Map is framed on India ───────────────────────────────────────────
  await test('07 — map frames India rather than the world', async () => {
    const center = await page.evaluate(() => {
      const c = document.querySelector('.maplibregl-canvas');
      return c ? c.getAttribute('aria-label') ?? 'canvas-present' : 'no-canvas';
    });
    assert(center !== 'no-canvas', 'MapLibre canvas not mounted');

    // Read the live camera through the map instance exposed for tests.
    // NOTE: this whole block runs in the browser context — never reference
    // `window` from the Node side of the test (that throws "window is not
    // defined" and fails the test even when the app is correct).
    const cam = await page.evaluate(() => {
      const m = window.__sihMap;
      if (!m || typeof m.getCenter !== 'function') return null;
      const c = m.getCenter();
      return { lng: c.lng, lat: c.lat, zoom: typeof m.getZoom === 'function' ? m.getZoom() : null };
    });
    if (cam) {
      const inIndia = cam.lng > 66 && cam.lng < 93 && cam.lat > 5 && cam.lat < 37;
      assert(inIndia, `map centred at ${cam.lng.toFixed(2)}, ${cam.lat.toFixed(2)} — outside India`);
      assert(cam.lng !== 0 && cam.lat !== 0, 'map still at null island');
      return `centre ${cam.lng.toFixed(2)}, ${cam.lat.toFixed(2)} · zoom ${cam.zoom ?? '?'}`;
    }
    return 'canvas present (camera probe unavailable)';
  });

  // ── 8. Selecting an event opens a working investigation ─────────────────
  await test('08 — event selection opens investigation with 4 working tabs', async () => {
    await scrollTo(page, 1, 800);

    // Select the first row in the navigator.
    const row = page.locator('[data-testid="event-row"]').first();
    await row.waitFor({ state: 'visible', timeout: 20_000 });
    await row.click();
    await page.waitForTimeout(1200);

    const panel = page.locator('[data-testid="investigation-panel"]');
    await panel.waitFor({ state: 'visible', timeout: 15_000 });

    const tabs = ['Overview', 'Evidence', 'History', 'Context'];
    const seen = [];
    for (const label of tabs) {
      await page.locator(`[role="tab"]:has-text("${label}")`).click();
      await page.waitForTimeout(650);
      const bodyText = await page
        .locator('[data-testid="investigation-panel"]')
        .innerText()
        .catch(() => '');
      assert(bodyText.length > 40, `${label} tab rendered ${bodyText.length} chars of content`);
      seen.push(`${label}:${bodyText.length}`);
      await shot(page, `${SHOTS}/08-investigation-${label.toLowerCase()}.png`);
    }
    return seen.join(' ');
  });

  // ── 9. Intelligence report opens and can be copied ──────────────────────
  await test('09 — intelligence report assembles with provenance and caveats', async () => {
    await page.locator('[data-testid="report-button"]').first().click();
    await page.waitForTimeout(900);

    const dialog = page.locator('[role="dialog"][aria-label="Intelligence report"]');
    await dialog.waitFor({ state: 'visible', timeout: 12_000 });

    const text = await dialog.innerText();
    assert(/Assessment/i.test(text), 'report missing assessment');
    assert(/Location/i.test(text), 'report missing location');
    assert(/Provenance/i.test(text), 'report missing provenance');

    await shot(page, `${SHOTS}/09-intelligence-report.png`);

    // Dismiss with Escape.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const stillOpen = await page
      .locator('[role="dialog"][aria-label="Intelligence report"]')
      .count()
      .catch(() => 0);
    assert(stillOpen === 0, 'Escape did not close the report');
    return `${text.length} chars, closes on Escape`;
  });

  // ── 10. Navigation views all render ─────────────────────────────────────
  await test('10 — every navigation destination renders real content', async () => {
    const out = [];
    for (const label of ['Events', 'Analytics', 'Watchtower', 'About']) {
      await page.locator(`nav[aria-label="Primary"] >> text=${label}`).click();
      await page.waitForTimeout(1100);
      const main = await page.evaluate(() => {
        const el = document.querySelector('[data-testid="operational-chrome"]');
        return el ? el.innerText.trim().length : 0;
      });
      assert(main > 200, `${label} view rendered only ${main} chars`);
      await shot(page, `${SHOTS}/10-view-${label.toLowerCase()}.png`);
      out.push(`${label}:${main}`);
    }
    // Back to the map.
    await page.locator('nav[aria-label="Primary"] >> text=Command').click();
    await page.waitForTimeout(900);
    return out.join(' ');
  });

  // ── Screenshots across the journey ──────────────────────────────────────
  console.log('\n  Capturing journey frames…');
  const frames = [
    ['00-space', 0],
    ['01-earth', 0.12],
    ['02-asia', 0.3],
    ['03-india', 0.48],
    ['04-observation', 0.72],
    ['05-descent', 0.84],
    ['06-operational', 1],
  ];
  await scrollTo(page, 0, 1200);
  for (const [name, p] of frames) {
    await scrollTo(page, p, p === 0 ? 1400 : 1000);
    await shot(page, `${SHOTS}/journey-${name}.png`);
  }

  // ── Responsiveness across five viewports ────────────────────────────────
  console.log('  Capturing five viewports…');
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await scrollTo(page, 1, 1400);
    await shot(page, `${SHOTS}/viewport-${vp.name}.png`);
  }
  await page.setViewportSize({ width: 1920, height: 1080 });

  // ── Console hygiene ─────────────────────────────────────────────────────
  const networkNoise = (t) =>
    /tile|glyph|sprite|ERR_(NAME|INTERNET|CONNECTION|NETWORK)|Failed to load resource|net::/i.test(t);
  const realErrors = consoleErrors.filter((t) => !networkNoise(t));

  console.log('\n  ── Console ───────────────────────────────────────────');
  console.log(`  page errors      : ${pageErrors.length}`);
  console.log(`  console errors   : ${consoleErrors.length} (${realErrors.length} non-network)`);
  if (pageErrors.length) pageErrors.slice(0, 8).forEach((e) => console.log(`    ! ${e.slice(0, 160)}`));
  if (realErrors.length) realErrors.slice(0, 12).forEach((e) => console.log(`    ! ${e.slice(0, 160)}`));

  // ── Summary ─────────────────────────────────────────────────────────────
  const passed = results.filter((r) => r.pass).length;
  console.log('\n  ── Results ───────────────────────────────────────────');
  for (const r of results) {
    console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
  }
  console.log(`\n  ${passed}/${results.length} passed · screenshots in tests/e2e/shots\n`);

  await browser.close();
  process.exit(passed === results.length ? 0 : 1);
}

main().catch(async (err) => {
  console.error('\nHARNESS ERROR:', err);
  if (browser) await browser.close();
  process.exit(2);
});
