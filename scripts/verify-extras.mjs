// Follow-up checks for things the first pass only measured loosely:
//   - body cursor under prefers-reduced-motion: reduce (the audit's actual
//     concern was reduced-motion users getting a hidden pointer)
//   - identify the single remaining 404
//   - capture the hero with the new font + new h1 layout for visual review
//   - count MapLibre's draw calls specifically (so the render-gate claim
//     is about the three.js canvas, not the map)
//
//   node scripts/verify-extras.mjs

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL_UNDER_TEST = 'http://127.0.0.1:3010/';
const PORT = 9334;
const SHOTS = path.resolve('reports/verify-extras');
const VIEWPORT = { width: 1920, height: 1080 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(SHOTS, { recursive: true });

const userDataDir = path.join(process.env.TEMP || '/tmp', `cdp-extras-${Date.now()}`);
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
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

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
  listeners.push((msg) => { if (msg.method === method) fn(msg.params); });
}
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', {
    expression: `(async () => { ${expression} })()`,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'evaluate failed');
  return r.result.value;
}
async function screenshot(name) {
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(path.join(SHOTS, `${name}.png`), Buffer.from(data, 'base64'));
}

const network404 = [];
const networkFailed = [];

try {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  on('Network.responseReceived', (p) => {
    if (p.response.status === 404) network404.push(p.response.url);
  });
  on('Network.loadingFailed', (p) => networkFailed.push(`${p.errorText} ${p.requestId}`));

  // Tag every canvas with its role so we can attribute draw counts.
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `
      window.__draws = new WeakMap();
      window.__canvasRole = new WeakMap();
      const wrapGl = (proto) => {
        if (!proto) return;
        for (const m of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']) {
          const orig = proto[m];
          if (typeof orig !== 'function') continue;
          proto[m] = function (...a) {
            if (this.canvas) window.__draws.set(this.canvas, (window.__draws.get(this.canvas) || 0) + 1);
            return orig.apply(this, a);
          };
        }
      };
      wrapGl(WebGLRenderingContext.prototype);
      wrapGl(WebGL2RenderingContext.prototype);

      const tag = (canvas, role) => window.__canvasRole.set(canvas, role);
      // MapLibre creates a canvas inside the .maplibregl-canvas-container
      new MutationObserver(() => {
        document.querySelectorAll('.maplibregl-canvas').forEach((c) => tag(c, 'maplibre'));
      }).observe(document.documentElement, { childList: true, subtree: true });
      // Three.js creates a <canvas> inside the GlobeScene container
      document.querySelectorAll('canvas').forEach((c) => {
        if (!window.__canvasRole.get(c)) tag(c, 'three.js');
      });
    `,
  });

  await send('Emulation.setDeviceMetricsOverride', { ...VIEWPORT, deviceScaleFactor: 1, mobile: false });

  // PASS 1: normal motion (the original harness)
  console.log('— pass 1: normal motion —');
  await send('Page.navigate', { url: URL_UNDER_TEST });
  await sleep(7000);
  const normal = await evaluate(`return getComputedStyle(document.body).cursor;`);
  console.log('  body cursor (normal)         =', normal);

  // Tag the canvases after load
  await evaluate(`
    document.querySelectorAll('.maplibregl-canvas').forEach((c) => window.__canvasRole.set(c, 'maplibre'));
    document.querySelectorAll('canvas').forEach((c) => {
      if (!window.__canvasRole.get(c)) window.__canvasRole.set(c, 'three.js');
    });
    return [...document.querySelectorAll('canvas')].map(c => window.__canvasRole.get(c));
  `);

  // Hero screenshot with new font
  await evaluate(`window.scrollTo({ top: 0, behavior: 'instant' });`);
  await sleep(800);
  await screenshot('hero-with-cormorant');

  // PASS 2: prefers-reduced-motion: reduce
  console.log('\n— pass 2: prefers-reduced-motion: reduce —');
  await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  // Force a reload so the new media state takes effect (CustomCursor checks MQ)
  await send('Page.reload', { ignoreCache: true });
  await sleep(7000);
  const rm = await evaluate(`return getComputedStyle(document.body).cursor;`);
  console.log('  body cursor (reduced motion)  =', rm, '   (target: auto/default)');

  // PASS 3: identify the 404 / network failure
  console.log('\n— pass 3: 404s and failed requests —');
  if (network404.length) console.log('  404s :', [...new Set(network404)].slice(0, 5));
  else console.log('  no 404s');
  if (networkFailed.length) console.log('  failed:', [...new Set(networkFailed)].slice(0, 5));

  // PASS 4: targeted WebGL draw count by canvas role
  console.log('\n— pass 4: WebGL draws per canvas role (at hero) —');
  await send('Emulation.setEmulatedMedia', { features: [] });
  await send('Page.reload', { ignoreCache: true });
  await sleep(7000);
  await evaluate(`
    document.querySelectorAll('.maplibregl-canvas').forEach((c) => window.__canvasRole.set(c, 'maplibre'));
    document.querySelectorAll('canvas').forEach((c) => {
      if (!window.__canvasRole.get(c)) window.__canvasRole.set(c, 'three.js');
    });
    return [...document.querySelectorAll('canvas')].map(c => window.__canvasRole.get(c));
  `);
  await evaluate(`window.scrollTo({ top: 0, behavior: 'instant' });`);
  await sleep(2500);
  const hero = await evaluate(`
    const out = {};
    for (const c of document.querySelectorAll('canvas')) {
      const role = window.__canvasRole.get(c) || 'unknown';
      out[role] = (out[role] || 0) + 0;  // reset
    }
    for (const c of document.querySelectorAll('canvas')) {
      const role = window.__canvasRole.get(c) || 'unknown';
      out[role] = (window.__draws.get(c) || 0);
    }
    return out;
  `);
  await sleep(2500);
  const hero2 = await evaluate(`
    const out = {};
    for (const c of document.querySelectorAll('canvas')) {
      const role = window.__canvasRole.get(c) || 'unknown';
      out[role] = (window.__draws.get(c) || 0);
    }
    return out;
  `);
  console.log('  hero counts (2s sample):', JSON.stringify(hero2));
  console.log('  hero delta / 2.5s:',
    Object.fromEntries(Object.keys(hero).map((k) => [k, hero2[k] - hero[k]])));

  // Now scroll to bottom and measure again
  await evaluate(`window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });`);
  await sleep(3500);
  const bottom = await evaluate(`
    const out = {};
    for (const c of document.querySelectorAll('canvas')) {
      const role = window.__canvasRole.get(c) || 'unknown';
      out[role] = (window.__draws.get(c) || 0);
    }
    return out;
  `);
  await sleep(2500);
  const bottom2 = await evaluate(`
    const out = {};
    for (const c of document.querySelectorAll('canvas')) {
      const role = window.__canvasRole.get(c) || 'unknown';
      out[role] = (window.__draws.get(c) || 0);
    }
    return out;
  `);
  console.log('  bottom counts (2s sample):', JSON.stringify(bottom2));
  console.log('  bottom delta / 2.5s:',
    Object.fromEntries(Object.keys(bottom).map((k) => [k, bottom2[k] - bottom[k]])));

  console.log(`\nscreenshots -> ${SHOTS}`);
} catch (err) {
  console.error('HARNESS ERROR:', err.message);
  process.exitCode = 1;
} finally {
  ws.close();
  chrome.kill();
}
