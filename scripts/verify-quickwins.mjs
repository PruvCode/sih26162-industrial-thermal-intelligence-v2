// Post-fix verification for the SIH26162 frontend quick wins.
//
// Drives real Chrome over the DevTools Protocol with zero npm dependencies
// (Node 22 global WebSocket + fetch). Re-measures the exact numbers the audit
// reported, so "fixed" means "measured differently", not "should be fine".
//
//   node scripts/verify-quickwins.mjs
//
// Requires the dev server to already be running on port 3010:
//   cd sih26162-industrial-thermal-intelligence/apps/web
//   npm run dev -- --port 3010

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL_UNDER_TEST = 'http://127.0.0.1:3010/';
const PORT = 9333;
const SHOTS = path.resolve('reports/verify-shots');
const VIEWPORT = { width: 1920, height: 1080 };

const results = [];
const consoleErrors = [];
const failedRequests = [];

function record(name, detail) {
  results.push({ name, detail });
  console.log(`  ${String(name).padEnd(34)} ${detail}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(SHOTS, { recursive: true });

// ── Launch Chrome ──────────────────────────────────────────────────────────
const userDataDir = path.join(process.env.TEMP || '/tmp', `cdp-verify-${Date.now()}`);
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${userDataDir}`,
    '--window-size=1920,1080',
    'about:blank',
  ],
  { stdio: 'ignore' }
);

async function waitForDevtools() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) return await res.json();
    } catch {}
    await sleep(250);
  }
  throw new Error('Chrome devtools never came up');
}

const version = await waitForDevtools();

const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
let page = targets.find((t) => t.type === 'page');
if (!page) {
  const created = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' });
  page = await created.json();
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => {
  ws.onopen = res;
  ws.onerror = rej;
});

let msgId = 0;
const pending = new Map();
const listeners = [];

ws.onmessage = (evt) => {
  const msg = JSON.parse(evt.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
  } else if (msg.method) {
    for (const fn of listeners) fn(msg);
  }
};

function send(method, params = {}) {
  const id = ++msgId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

function on(method, fn) {
  listeners.push((msg) => {
    if (msg.method === method) fn(msg.params);
  });
}

async function evaluate(expression) {
  const r = await send('Runtime.evaluate', {
    // Async IIFE so page-side expressions may use `await` (e.g. fonts.ready).
    expression: `(async () => { ${expression} })()`,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.exception?.description ?? 'evaluate failed');
  }
  return r.result.value;
}

async function screenshot(name) {
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(path.join(SHOTS, `${name}.png`), Buffer.from(data, 'base64'));
}

async function wheel(deltaY, times = 1) {
  for (let i = 0; i < times; i++) {
    await send('Input.dispatchMouseEvent', {
      type: 'mouseWheel',
      x: VIEWPORT.width / 2,
      y: VIEWPORT.height / 2,
      deltaX: 0,
      deltaY,
    });
    await sleep(120);
  }
}

// Cached selector for the command-centre wrapper (its only reliable marker is
// the -100vh pull-up; `main > div` indexing is unreliable because CustomCursor
// renders two extra divs into main).
const WRAP = `
  const wrap = [...document.querySelectorAll('div')]
    .find(d => d.style.marginTop && d.style.marginTop.startsWith('-100'));
`;

try {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Log.enable');

  on('Runtime.consoleAPICalled', (p) => {
    if (p.type === 'error') {
      consoleErrors.push((p.args?.[0]?.value ?? '') + ' ' + (p.args?.[1]?.value ?? ''));
    }
  });
  on('Log.entryAdded', (p) => {
    if (p.entry.level === 'error') consoleErrors.push(p.entry.text);
  });
  on('Network.loadingFailed', (p) => failedRequests.push(p.errorText));

  // Count WebGL draw calls per canvas so we can prove the three.js loop
  // actually stops once the globe has dissolved.
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `
      window.__draws = new WeakMap();
      const wrapGl = (proto) => {
        if (!proto) return;
        for (const m of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']) {
          const orig = proto[m];
          if (typeof orig !== 'function') continue;
          proto[m] = function (...a) {
            if (this.canvas) {
              window.__draws.set(this.canvas, (window.__draws.get(this.canvas) || 0) + 1);
            }
            return orig.apply(this, a);
          };
        }
      };
      wrapGl(WebGLRenderingContext.prototype);
      wrapGl(WebGL2RenderingContext.prototype);
    `,
  });

  await send('Emulation.setDeviceMetricsOverride', {
    ...VIEWPORT,
    deviceScaleFactor: 1,
    mobile: false,
  });

  console.log(`\nChrome ${version.Browser} — ${URL_UNDER_TEST}\n`);
  await send('Page.navigate', { url: URL_UNDER_TEST });
  await sleep(7000); // let fonts, three.js and MapLibre all settle

  // ── 1. FONTS ─────────────────────────────────────────────────────────────
  console.log('FONTS');
  const fonts = await evaluate(`
    await document.fonts.ready;
    return {
      size: document.fonts.size,
      status: document.fonts.status,
      families: [...new Set([...document.fonts].map(f => f.family))],
    };
  `);
  record('document.fonts.size', `${fonts.size}   (was 0)`);
  record('font families loaded', fonts.families.join(', ') || '(none)');
  const h1 = await evaluate(`
    const h = document.querySelector('h1');
    return h ? getComputedStyle(h).fontFamily : null;
  `);
  record('h1 computed font-family', String(h1).split(',')[0] + '   (was Georgia)');

  // ── 2. CURSOR ────────────────────────────────────────────────────────────
  console.log('\nCURSOR');
  record(
    'body computed cursor',
    `${await evaluate(`return getComputedStyle(document.body).cursor;`)}   (was none)`
  );

  // ── 3. SCROLL GEOMETRY + MAP OPACITY ─────────────────────────────────────
  console.log('\nSCROLL / MAP OPACITY');
  record(
    'max scrollTop',
    `${await evaluate(`return document.documentElement.scrollHeight - window.innerHeight;`)}px`
  );

  await evaluate(`window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });`);
  await sleep(1800);

  const atBottom = await evaluate(`
    ${WRAP}
    return {
      scrollTop: Math.round(window.scrollY),
      opacity: wrap ? Number(wrap.style.opacity) : null,
      pointerEvents: wrap ? wrap.style.pointerEvents : null,
    };
  `);
  record('scrollTop at bottom', `${atBottom.scrollTop}px`);
  record('map wrapper opacity', `${atBottom.opacity}   (was 0.463845, capped)`);
  record('map wrapper pointerEvents', String(atBottom.pointerEvents));
  await screenshot('01-bottom-map');

  // ── 4. REVERSE SCROLL (the trap) ─────────────────────────────────────────
  console.log('\nREVERSE SCROLL');
  for (let cycle = 1; cycle <= 3; cycle++) {
    await evaluate(`window.scrollTo({ top: 0, behavior: 'instant' });`);
    await sleep(500);
    await wheel(400, 14); // down into the map
    await sleep(1400);
    const parked = await evaluate(`return Math.round(window.scrollY);`);
    await wheel(-400, 10); // try to come back up
    await sleep(1400);
    const after = await evaluate(`return Math.round(window.scrollY);`);
    record(`cycle ${cycle}`, `down->${parked}px  up->${after}px  escaped ${parked - after}px`);
  }

  // ── 5. WEBGL DRAW COUNTS (globe render gate) ─────────────────────────────
  console.log('\nTHREE.JS RENDER GATE');
  const readDraws = () =>
    evaluate(`
      return [...document.querySelectorAll('canvas')]
        .map(c => window.__draws.get(c) || 0);
    `);

  await evaluate(`window.scrollTo({ top: 0, behavior: 'instant' });`);
  await sleep(2000);
  const a = await readDraws();
  await sleep(2000);
  const b = await readDraws();
  record('hero: draws / 2s per canvas', JSON.stringify(b.map((v, i) => v - (a[i] || 0))));

  await evaluate(`window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });`);
  await sleep(3000); // let the globe dissolve fully
  const c = await readDraws();
  await sleep(2000);
  const d = await readDraws();
  record('bottom: draws / 2s per canvas', JSON.stringify(d.map((v, i) => v - (c[i] || 0))));
  await screenshot('02-bottom-idle');

  // ── 6. EVENT IDS ─────────────────────────────────────────────────────────
  console.log('\nEVENT IDS');
  const ids = await evaluate(`
    const nodes = [...document.querySelectorAll('span,div')]
      .filter(n => n.children.length === 0 && /^#[A-Z0-9_-]+$/.test(n.textContent.trim()))
      .map(n => n.textContent.trim());
    return [...new Set(nodes)].slice(0, 6);
  `);
  record('rendered event ids', ids.join(' ') || '(none visible)   (was #T_001)');

  // ── 7. STATUS BAR POSITION ───────────────────────────────────────────────
  console.log('\nSTATUS BAR');
  const statusBar = await evaluate(`
    const el = [...document.querySelectorAll('div')]
      .find(d => d.textContent.includes('MONITORING') && d.clientHeight > 0 && d.clientHeight < 60);
    return el ? getComputedStyle(el).position : null;
  `);
  record('status bar position', `${statusBar}   (was fixed)`);

  // ── 8. HERO CTA ──────────────────────────────────────────────────────────
  console.log('\nHERO CTA');
  await evaluate(`window.scrollTo({ top: 0, behavior: 'instant' });`);
  await sleep(600);
  const beforeCta = await evaluate(`return Math.round(window.scrollY);`);
  const btnBox = await evaluate(`
    const b = [...document.querySelectorAll('button')]
      .find(x => x.textContent.includes('EXPLORE INTELLIGENCE'));
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  `);
  if (btnBox) {
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...btnBox, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...btnBox, button: 'left', clickCount: 1 });
    await sleep(2500);
  } else {
    console.log('  (CTA button not found)');
  }
  const afterCta = await evaluate(`return Math.round(window.scrollY);`);
  record('CTA click scroll', `${beforeCta} -> ${afterCta}  (moved ${afterCta - beforeCta}px)`);
  await screenshot('03-after-cta');

  // ── 9. CONSOLE / NETWORK ─────────────────────────────────────────────────
  console.log('\nCONSOLE / NETWORK');
  const clusterErrors = consoleErrors.filter((e) => /even number of arguments|clusters/i.test(e));
  record('total console errors', String(consoleErrors.length));
  record('cluster step-expr errors', `${clusterErrors.length}   (was 17)`);
  record('failed network requests', `${failedRequests.length}   (was 2, glyph)`);
  const unique = [...new Set(consoleErrors)];
  if (unique.length) {
    console.log('\n  --- error samples ---');
    for (const e of unique.slice(0, 12)) console.log('   ', String(e).slice(0, 180));
  }
  if (failedRequests.length) {
    console.log('   network:', [...new Set(failedRequests)].join(', '));
  }

  console.log(`\nscreenshots -> ${SHOTS}`);
} catch (err) {
  console.error('\nHARNESS ERROR:', err.message);
  process.exitCode = 1;
} finally {
  ws.close();
  chrome.kill();
}
