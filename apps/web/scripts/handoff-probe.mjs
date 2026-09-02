/**
 * EMPIRICAL HANDOFF PROBE.
 *
 * Sweeps the scroll journey and measures the ACTUAL rendered luminance of
 * every frame, so "there is no black screen" is a measurement rather than an
 * opinion.
 *
 * Method: screenshot at each scroll stop, then decode that PNG back inside the
 * page (canvas + getImageData) to compute mean/max luminance. Decoding in-page
 * avoids needing a PNG decoder in node and uses the browser's own resampling.
 *
 * The floor: the stage background is #05070B, whose Rec.709 luminance is
 *   0.2126*5 + 0.7152*7 + 0.0722*11 = 6.86 / 255.
 * A frame at or near 6.86 is, by definition, a black screen. We require every
 * sampled frame to clear that floor by a wide margin.
 */

import { chromium } from 'playwright';

const URL = process.env.PROBE_URL || 'http://localhost:3000/';
const SAMPLES = 34; // ~3% of journey per stop; dense enough to catch a gap
const FLOOR = 6.86; // luminance of #05070B
const MIN_MEAN = 11; // must exceed ~1.6x the floor

const results = [];
const fail = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
  if (!ok) fail.push(name);
};

const browser = await chromium.launch({
  args: [
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--no-sandbox',
    '--disable-gpu-sandbox',
    '--hide-scrollbars',
  ],
});

const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));
const consoleErrors = [];
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text());
});

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

// Let the loading screen finish and the globe textures decode.
await page
  .waitForFunction(() => !document.querySelector('[data-testid="loading-screen"]'), { timeout: 60000 })
  .catch(() => {});
await page.waitForTimeout(3500);

const geo = await page.evaluate(() => ({
  maxScroll: document.documentElement.scrollHeight - window.innerHeight,
  innerHeight: window.innerHeight,
}));
console.log(`scrollable: ${geo.maxScroll}px  (${(geo.maxScroll / geo.innerHeight).toFixed(1)} viewports)\n`);

/**
 * WARM-UP.
 *
 * Sampling immediately after load measures the loading screen, not the
 * product — the hero headline has not painted and the globe has not had a
 * frame. Without this the top-of-page sample reads as a false black frame.
 */
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
await page.waitForTimeout(6000);
await measureLuminance(); // force one paint, discard the reading
await page.waitForTimeout(1500);
console.log('warm-up complete — sampling steady state\n');

/**
 * Screenshot, then decode inside the page to measure luminance.
 */
async function measureLuminance() {
  // JPEG not PNG: the frame is round-tripped through CDP as base64, and at
  // 1280x800 a PNG is ~1.5MB of string for no measurement benefit. The lossy
  // encode costs nothing here — we are integrating thousands of pixels.
  const buf = await page.screenshot({ type: 'jpeg', quality: 55, timeout: 20000 });
  const b64 = buf.toString('base64');
  return page.evaluate(async (data) => {
    const img = new Image();
    img.src = 'data:image/jpeg;base64,' + data;
    await img.decode();
    const W = 192;
    const H = 120;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, W, H);
    const d = ctx.getImageData(0, 0, W, H).data;
    let sum = 0;
    let max = 0;
    let n = 0;
    let lit = 0; // pixels clearly above the near-black floor
    for (let i = 0; i < d.length; i += 4) {
      const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      sum += l;
      if (l > max) max = l;
      if (l > 14) lit++;
      n++;
    }
    return { mean: sum / n, max, litFraction: lit / n };
  }, b64);
}

// ── Sweep ─────────────────────────────────────────────────────────────────
console.log('  raw    scrollY    mean     max     lit%    verdict');
let minMean = Infinity;
let minAt = 0;

for (let i = 0; i <= SAMPLES; i++) {
  const raw = i / SAMPLES;
  const top = Math.round(raw * geo.maxScroll);
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), top);
  // Two frames: one for the rAF loops to read scrollY, one to paint.
  await page.waitForTimeout(260);

  const { mean, max, litFraction } = await measureLuminance();
  const verdict = mean < MIN_MEAN ? 'BLACK' : mean < MIN_MEAN * 1.4 ? 'dim' : 'ok';
  if (mean < minMean) {
    minMean = mean;
    minAt = raw;
  }
  results.push({ raw, mean, max, litFraction });

  const bar = '#'.repeat(Math.round(Math.min(1, mean / 60) * 34));
  console.log(
    `  ${raw.toFixed(3)}  ${String(top).padStart(6)}   ${mean.toFixed(2).padStart(6)}  ${max
      .toFixed(0)
      .padStart(5)}   ${(litFraction * 100).toFixed(1).padStart(5)}   ${verdict.padEnd(6)} ${bar}`
  );
}

// ── Assertions ────────────────────────────────────────────────────────────
console.log('');
check(
  `no frame is black (min mean ${minMean.toFixed(2)} > ${MIN_MEAN})`,
  minMean > MIN_MEAN,
  `darkest frame at raw=${minAt.toFixed(3)}`
);
check(
  `darkest frame clears the #05070B floor by >60% (${minMean.toFixed(2)} vs ${FLOOR.toFixed(2)})`,
  minMean > FLOOR * 1.6
);

// The mid-journey band is where the bug lived. Be strict there specifically.
const midBand = results.filter((r) => r.raw >= 0.5 && r.raw <= 0.92);
const midMin = Math.min(...midBand.map((r) => r.mean));
check(
  `handoff band 0.50–0.92 stays lit (min mean ${midMin.toFixed(2)})`,
  midMin > MIN_MEAN,
  `${midBand.length} samples`
);

// Something bright must exist at every stop — a lit globe, India copy, or map.
const dullest = results.reduce((a, b) => (a.max < b.max ? a : b));
check(
  `every frame carries visible content (min peak ${dullest.max.toFixed(0)})`,
  dullest.max > 60,
  `dullest peak at raw=${dullest.raw.toFixed(3)}`
);

// The backdrop itself must be present and ramping in the handoff band.
const backdropAt = async (raw) => {
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), Math.round(raw * geo.maxScroll));
  await page.waitForTimeout(260);
  return page.evaluate(() => {
    const el = document.querySelector('[data-testid="handoff-backdrop"]');
    if (!el) return null;
    return { opacity: Number(getComputedStyle(el).opacity), visibility: getComputedStyle(el).visibility };
  });
};

const bdHero = await backdropAt(0.05);
const bdMid = await backdropAt(0.78);
check('backdrop exists and is hidden over the hero', !!bdHero && bdHero.opacity < 0.02, JSON.stringify(bdHero));
check('backdrop is at full strength mid-handoff', !!bdMid && bdMid.opacity > 0.9, JSON.stringify(bdMid));

check(`no page errors (${pageErrors.length})`, pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
check(`no console errors (${consoleErrors.length})`, consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

await browser.close();

console.log(`\n${fail.length === 0 ? 'ALL CHECKS PASSED' : `${fail.length} FAILED: ${fail.join(', ')}`}`);
process.exit(fail.length === 0 ? 0 : 1);
