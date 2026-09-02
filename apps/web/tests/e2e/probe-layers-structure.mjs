/**
 * SIH26162 — layers placement structural probe (no pixels needed).
 *
 * Verifies layout details the geometric probe didn't cover:
 *   - controls row reads: [filters icon][layers icon+badge] ... [sort buttons]
 *   - the layers icon does not overlap the sort buttons
 *   - the expanded panel sits between the header and the event list
 *   - the panel shows all five layer labels and its live count
 */

import { chromium } from 'playwright';

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

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.addStyleTag({ content: '[data-variant]{display:none !important;}' }).catch(() => {});
  await page.waitForFunction(() => !document.querySelector('[data-testid="loading-screen"]'), { timeout: 60_000 });
  await scrollTo(page, 1, 2200);

  // ── Controls row composition ─────────────────────────────────────────────
  const row = await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="Show map layers"]');
    const nav = btn.closest('div.pointer-events-auto');
    const r = btn.closest('div.mt-2\\.5') ?? btn.parentElement.parentElement;
    const kids = [...r.children].map((c) => ({
      tag: c.tagName,
      label: c.getAttribute('aria-label') ?? c.textContent.trim().slice(0, 24),
      x: Math.round(c.getBoundingClientRect().x),
      right: Math.round(c.getBoundingClientRect().right),
    }));
    const filters = document.querySelector('button[aria-label="Show filters"]').getBoundingClientRect();
    const layers = btn.getBoundingClientRect();
    const firstSort = [...r.querySelectorAll('button')].find((b) => /priority/i.test(b.textContent));
    const sort = firstSort ? firstSort.getBoundingClientRect() : null;
    const badge = btn.parentElement.querySelector('span[aria-hidden="true"]');
    const badgeRect = badge ? badge.getBoundingClientRect() : null;
    const navRect = nav.getBoundingClientRect();
    return { kids, filters, layers, sort, badgeRect, navRect };
  });

  console.log('controls row children:');
  row.kids.forEach((k) => console.log(`  ${k.tag} x=${k.x} right=${k.right} "${k.label}"`));

  assert(row.kids.length >= 3, `controls row has ${row.kids.length} children — expected filters + layers + sorts`);
  assert(
    row.layers.x > row.filters.right,
    `layers icon (${row.layers.x}) overlaps filters icon (right ${row.filters.right})`
  );
  assert(row.sort, 'sort buttons not found in controls row');
  assert(
    row.layers.right < row.sort.x,
    `layers icon (right ${row.layers.right}) overlaps sort buttons (x ${row.sort.x})`
  );
  assert(
    !row.badgeRect || row.badgeRect.right <= row.navRect.right,
    `layers badge escapes sidebar (right ${row.badgeRect?.right} vs ${row.navRect.right})`
  );
  console.log(
    `OK — filters [${Math.round(row.filters.x)}–${Math.round(row.filters.right)}] · layers [${Math.round(row.layers.x)}–${Math.round(row.layers.right)}] · sorts [${Math.round(row.sort.x)}…]`
  );

  // ── Panel position + content ─────────────────────────────────────────────
  await page.click('button[aria-label="Show map layers"]');
  await page.waitForSelector('[data-testid="layer-control-panel"]', { timeout: 10_000 });
  await page.waitForTimeout(400);

  const panelInfo = await page.evaluate(() => {
    const panel = document.querySelector('[data-testid="layer-control-panel"]');
    const p = panel.getBoundingClientRect();
    const text = panel.innerText;
    const firstRow = document.querySelector('[data-testid="event-row"]');
    const fr = firstRow ? firstRow.getBoundingClientRect() : null;
    const countBadge = document.querySelector('button[aria-label="Hide map layers"]').parentElement.querySelector('span[aria-hidden="true"]');
    return {
      panelText: text,
      panelBottom: Math.round(p.bottom),
      firstRowTop: fr ? Math.round(fr.top) : null,
      badgeText: countBadge ? countBadge.textContent : null,
    };
  });

  const labels = ['Thermal detections', 'Density surface', 'Industrial sites', 'Boundaries', 'Satellite imagery'];
  for (const l of labels) {
    assert(panelInfo.panelText.includes(l), `panel text missing layer label "${l}"`);
  }
  assert(/\d\/5/.test(panelInfo.panelText), `panel missing live count — got "${panelInfo.panelText.slice(0, 60)}"`);
  assert(
    panelInfo.firstRowTop === null || panelInfo.panelBottom <= panelInfo.firstRowTop,
    `panel bottom ${panelInfo.panelBottom} runs under the event list (first row top ${panelInfo.firstRowTop})`
  );
  console.log(`OK — panel lists all 5 layers, count badge on toggle = "${panelInfo.badgeText}", panel bottom ${panelInfo.panelBottom} ≤ first row top ${panelInfo.firstRowTop}`);

  await browser.close();
  console.log('\nSTRUCTURAL PROBE: ALL CHECKS PASSED');
  process.exit(0);
}

main().catch(async (err) => {
  console.error('STRUCTURAL PROBE FAILED:', err.message);
  if (browser) await browser.close();
  process.exit(1);
});
