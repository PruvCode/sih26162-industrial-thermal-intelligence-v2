// nav-overlap-probe.mjs
// Measures two things on a fresh front-page load:
//   1. Top-nav <header> computed opacity (should be >= 0.7, not the old 0.25)
//      plus an inactive nav button's color (should be the brighter #B4C0CF).
//   2. Vertical gap between the hero-status line ("System active") and the
//      "LOW EARTH ORBIT" breadcrumb block (should be > 0 = no overlap).
// Run from apps/web:  node scripts/nav-overlap-probe.mjs

import { chromium } from 'playwright';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'http://localhost:3000/';

const viewport = { width: 1280, height: 720 };
const settleMs = 2500;

const browser = await chromium.launch({
  executablePath: CHROME,
  args: [
    '--headless=new',
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--no-sandbox',
  ],
});

const page = await browser.newPage({ viewport });
const errors = [];
const bad = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('response', (r) => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('header', { timeout: 10000 });
await page.waitForSelector('[data-testid="hero-status"]', { timeout: 10000 });
await page.waitForTimeout(settleMs);

// --- (1) Nav visibility ---
const nav = await page.evaluate(() => {
  const header = document.querySelector('header');
  const cs = getComputedStyle(header);
  // inactive nav button = the "Events" item (never active on the front page)
  const btns = Array.from(document.querySelectorAll('nav button'));
  const events = btns.find((b) => b.textContent?.trim() === 'Events');
  const dot = header.querySelector('span.rounded-full');
  const dotColor = dot ? getComputedStyle(dot).backgroundColor : null;
  return {
    headerOpacity: Number(cs.opacity),
    eventsColor: events ? getComputedStyle(events).color : null,
    dotColor,
    navCount: btns.length,
  };
});

// --- (2) Overlap geometry ---
const geo = await page.evaluate(() => {
  const status = document.querySelector('[data-testid="hero-status"]');
  // breadcrumb span carries the "LOW EARTH ORBIT" text; its parent is the
  // journey-chrome block anchored to the bottom.
  const bc = Array.from(document.querySelectorAll('span')).find(
    (s) => s.textContent?.trim() === 'LOW EARTH ORBIT'
  );
  const bcBlock = bc ? bc.closest('div.absolute.bottom-7') ?? bc.parentElement : null;
  const r = (el) => {
    const x = el.getBoundingClientRect();
    return { top: x.top, bottom: x.bottom, left: x.left, right: x.right, w: x.width, h: x.height };
  };
  return {
    status: status ? r(status) : null,
    breadcrumb: bc ? r(bc) : null,
    breadcrumbBlock: bcBlock ? r(bcBlock) : null,
  };
});

await browser.close();

const statusBottom = geo.status?.bottom ?? null;
const bcTop = geo.breadcrumbBlock?.top ?? geo.breadcrumb?.top ?? null;
const gap = statusBottom != null && bcTop != null ? +(bcTop - statusBottom).toFixed(1) : null;

console.log('=== NAV VISIBILITY (fresh load) ===');
console.log('header computed opacity :', nav.headerOpacity, '(expect >= 0.7, old was 0.25)');
console.log('inactive nav color       :', nav.eventsColor, '(expect rgb(180,192,207) = #B4C0CF)');
console.log('logo dot color           :', nav.dotColor);
console.log('nav buttons found        :', nav.navCount);
console.log('');
console.log('=== OVERLAP GEOMETRY (', viewport.width + 'x' + viewport.height, ') ===');
console.log('hero-status bottom (px)  :', statusBottom);
console.log('breadcrumb block top(px) :', bcTop);
console.log('vertical gap (px)        :', gap, gap != null && gap > 0 ? '=> NO OVERLAP' : '=> OVERLAP');
console.log('');
console.log('page/console errors      :', errors.length ? errors : 'none');
console.log('>=400 responses           :', bad.length ? bad : 'none');

const pass =
  nav.headerOpacity >= 0.7 &&
  nav.eventsColor === 'rgb(180, 192, 207)' &&
  gap != null && gap > 0 &&
  errors.length === 0;

console.log('');
console.log(pass ? 'RESULT: ALL CHECKS PASSED' : 'RESULT: SOME CHECKS FAILED — review above');
process.exit(pass ? 0 : 1);
