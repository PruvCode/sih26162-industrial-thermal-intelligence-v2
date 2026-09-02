/**
 * SIH26162 — Frontend verification harness (Phase 0 instrumentation).
 *
 * Drives a real Chrome instance over the DevTools Protocol with ZERO npm
 * dependencies (Node 22 global `fetch` + `WebSocket`).
 *
 * Re-run this after every remediation phase. A phase is only "done" when the
 * checks it targets report PASS here — not when the code looks right.
 *
 *   node scripts/verify-frontend.mjs [url] [width] [height] [--shots]
 *
 * Exit code 1 if any CRITICAL check fails (useful for CI / phase gating).
 */

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = process.argv[2] || 'http://localhost:3010/';
const W = Number(process.argv[3] || 1920);
const H = Number(process.argv[4] || 1080);
const WANT_SHOTS = process.argv.includes('--shots');
const PORT = 9400 + Math.floor(Math.random() * 300);
const SHOT_DIR = 'C:\\Users\\pruth\\AppData\\Local\\Temp\\audit\\verify';
if (WANT_SHOTS) mkdirSync(SHOT_DIR, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const consoleErrors = [];
const netFailures = [];

function check(name, pass, detail, critical = true) {
  results.push({ name, pass: !!pass, detail, critical });
  return pass;
}

// ── Launch Chrome ────────────────────────────────────────────────────────────
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, '--remote-allow-origins=*',
  '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
  '--no-sandbox', '--disable-gpu-sandbox', '--hide-scrollbars',
  '--force-device-scale-factor=1', `--window-size=${W},${H}`, 'about:blank',
], { stdio: 'ignore' });

let ready = false;
for (let i = 0; i < 60 && !ready; i++) {
  try { ready = (await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok; } catch {}
  if (!ready) await sleep(500);
}
if (!ready) { console.error('Chrome debug port never opened'); chrome.kill(); process.exit(2); }

const page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let id = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === 'Runtime.consoleAPICalled') {
    const t = m.params.type;
    if (t === 'error' || t === 'warning') {
      consoleErrors.push(`${t}: ${(m.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ')}`);
    }
  }
  if (m.method === 'Runtime.exceptionThrown') {
    consoleErrors.push(`exception: ${m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text}`);
  }
  if (m.method === 'Network.loadingFailed') netFailures.push(m.params.errorText);
  if (m.method === 'Network.responseReceived' && m.params.response.status >= 400) {
    netFailures.push(`${m.params.response.status} ${m.params.response.url}`);
  }
};

const send = (method, params = {}) => {
  const mid = ++id;
  return new Promise((res, rej) => {
    pending.set(mid, (m) => (m.error ? rej(new Error(m.error.message)) : res(m.result)));
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
};
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) return { __error: r.exceptionDetails.exception?.description || 'eval error' };
  return r.result.value;
};
const shot = async (name) => {
  if (!WANT_SHOTS) return;
  const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 70 });
  writeFileSync(join(SHOT_DIR, `${name}.jpg`), Buffer.from(r.data, 'base64'));
};

await send('Runtime.enable');
await send('Log.enable');
await send('Network.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: URL });
await sleep(14000); // loading screen + hydration + texture decode

// ── Helpers injected into the page ───────────────────────────────────────────
await ev(`
  window.__cc = () => [...document.querySelector('main').querySelectorAll(':scope > div')]
    .find(d => d.style.marginTop && d.style.marginTop.includes('-100vh'));
  window.__hasHandler = (el) => {
    if (!el) return false;
    const k = Object.keys(el).find(k => k.startsWith('__reactProps'));
    return !!(k && el[k] && typeof el[k].onClick === 'function');
  };
  'ok';
`);

// ════════════════════════════════════════════════════════════════════════════
// CHECK 1 — Fonts
// ════════════════════════════════════════════════════════════════════════════
const fonts = await ev(`(() => {
  const set = [...document.fonts];
  return {
    count: set.length,
    families: [...new Set(set.map(f => f.family))],
    loaded: set.filter(f => f.status === 'loaded').map(f => f.family),
    h1: getComputedStyle(document.querySelector('h1')).fontFamily,
    body: getComputedStyle(document.body).fontFamily,
  };
})()`);
check('fonts: webfonts loaded', fonts.count > 0,
  `${fonts.count} FontFace(s): [${fonts.families.join(', ') || 'NONE'}] — h1 renders "${fonts.h1}"`);

// ════════════════════════════════════════════════════════════════════════════
// CHECK 2 — CTA & navigation handlers
// ════════════════════════════════════════════════════════════════════════════
const handlers = await ev(`(() => {
  const cta = [...document.querySelectorAll('button')].find(b => /EXPLORE/i.test(b.textContent));
  const navs = [...document.querySelectorAll('nav button')];
  return {
    ctaFound: !!cta,
    ctaHasOnClick: window.__hasHandler(cta),
    navLabels: navs.map(b => b.textContent.trim()),
    navWithOnClick: navs.filter(b => window.__hasHandler(b)).map(b => b.textContent.trim()),
  };
})()`);
check('cta: EXPLORE button has onClick', handlers.ctaHasOnClick,
  handlers.ctaFound ? `found, onClick=${handlers.ctaHasOnClick}` : 'CTA button NOT FOUND');
check('nav: navigation buttons are functional',
  handlers.navLabels.length > 0 && handlers.navWithOnClick.length === handlers.navLabels.length,
  `${handlers.navWithOnClick.length}/${handlers.navLabels.length} wired: [${handlers.navLabels.join(', ')}]`);

// ════════════════════════════════════════════════════════════════════════════
// CHECK 3 — Scroll geometry & map opacity (PHASE 1)
// ════════════════════════════════════════════════════════════════════════════
const geo = await ev(`(() => {
  window.scrollTo({ top: 999999, behavior: 'instant' });
  return {
    maxScroll: document.documentElement.scrollHeight - window.innerHeight,
    docHeight: document.documentElement.scrollHeight,
    vh: window.innerHeight,
  };
})()`);
await sleep(2500);
const opState = await ev(`(() => {
  const cc = window.__cc();
  if (!cc) return { error: 'CommandCenter wrapper not found' };
  const r = cc.getBoundingClientRect();
  return {
    opacity: parseFloat(getComputedStyle(cc).opacity),
    pointerEvents: getComputedStyle(cc).pointerEvents,
    top: Math.round(r.top),
    bottom: Math.round(r.bottom),
    height: Math.round(r.height),
  };
})()`);
check('map: reaches full opacity at operational state', opState.opacity >= 0.999,
  `opacity=${opState.opacity} (baseline was 0.463845)`);
check('map: fills viewport at operational state',
  opState.top <= 1 && opState.bottom >= geo.vh - 1,
  `wrapper top=${opState.top} bottom=${opState.bottom} vh=${geo.vh} (footer must not consume operational viewport)`);

await shot('operational');

// ════════════════════════════════════════════════════════════════════════════
// CHECK 4 — Reverse scroll trap (PHASE 2)
// ════════════════════════════════════════════════════════════════════════════
const CYCLES = 5;
const cycles = [];
for (let c = 1; c <= CYCLES; c++) {
  await ev(`window.scrollTo({top:0, behavior:'instant'})`);
  await sleep(700);
  await ev(`window.scrollTo({top: 999999, behavior:'instant'})`);
  await sleep(1500);
  const atMap = await ev(`Math.round(window.scrollY)`);
  // Real wheel-up dispatch, mid-viewport (squarely over the map)
  for (let i = 0; i < 6; i++) {
    await send('Input.dispatchMouseEvent', {
      type: 'mouseWheel', x: Math.round(W / 2), y: Math.round(H / 2),
      deltaX: 0, deltaY: 200, pointerType: 'mouse',
    });
    await sleep(90);
  }
  await sleep(900);
  const after = await ev(`Math.round(window.scrollY)`);
  cycles.push({ cycle: c, atMap, after, moved: atMap - after, escaped: after < atMap - 100 });
}
const escapedAll = cycles.every((c) => c.escaped);
check(`scroll: reverse wheel escapes map (${CYCLES} cycles)`, escapedAll,
  cycles.map((c) => `c${c.cycle}:${c.atMap}→${c.after}`).join('  '));

// ════════════════════════════════════════════════════════════════════════════
// CHECK 5 — MapLibre layers & clustering (PHASE 6)
// ════════════════════════════════════════════════════════════════════════════
await ev(`window.scrollTo({top: 999999, behavior:'instant'})`);
await sleep(2500);
const mapInfo = await ev(`(() => {
  const c = document.querySelector('.maplibregl-canvas');
  return { hasCanvas: !!c, size: c ? c.width + 'x' + c.height : null };
})()`);
check('map: MapLibre canvas present', mapInfo.hasCanvas, `canvas ${mapInfo.size}`);

// ════════════════════════════════════════════════════════════════════════════
// CHECK 6 — Event data (PHASE 7)
// ════════════════════════════════════════════════════════════════════════════
const dataInfo = await ev(`(() => {
  const txt = document.body.innerText;
  // AnalyticsPanel renders the label ABOVE the value: "Total Events\n12.5K"
  const m = txt.match(/Total Events\\s*\\n\\s*([\\d.,]+K?)/i);
  const rows = [...document.querySelectorAll('button')].filter(b => /#EVT|#T_|#\\d/i.test(b.textContent)).length;
  return { totalEventsLabel: m ? m[1] : null, listRows: rows, demoBadge: /DEMO|SIMULATED/i.test(txt) };
})()`);
check('data: event list renders rows', dataInfo.listRows > 0,
  `${dataInfo.listRows} rows; analytics claims "${dataInfo.totalEventsLabel}"`);

// ════════════════════════════════════════════════════════════════════════════
// CHECK 7 — Console hygiene
// ════════════════════════════════════════════════════════════════════════════
const clusterErrs = consoleErrors.filter((e) => /clusters|even number of arguments/i.test(e));
const fontErrs = netFailures.filter((n) => /font|glyph|pbf/i.test(n));
const favicon = netFailures.filter((n) => /favicon/i.test(n));
check('console: no cluster layer errors', clusterErrs.length === 0, `${clusterErrs.length} cluster errors`);
check('console: no font/glyph CORS failures', fontErrs.length === 0, `${fontErrs.length} font failures`);
check('console: no favicon 404', favicon.length === 0, `${favicon.length} favicon failures`, false);

// ════════════════════════════════════════════════════════════════════════════
// Report
// ════════════════════════════════════════════════════════════════════════════
console.log(`\n${'='.repeat(78)}`);
console.log(`SIH26162 VERIFICATION — ${W}x${H} — ${URL}`);
console.log('='.repeat(78));
for (const r of results) {
  const tag = r.pass ? 'PASS' : (r.critical ? 'FAIL' : 'warn');
  console.log(`  [${tag}] ${r.name}`);
  console.log(`         ${r.detail}`);
}
const failed = results.filter((r) => !r.pass);
const critFailed = failed.filter((r) => r.critical);
console.log('-'.repeat(78));
console.log(`  ${results.length - failed.length}/${results.length} passed   (${critFailed.length} critical failures)`);
if (consoleErrors.length) {
  console.log(`\n  Console errors (${consoleErrors.length}):`);
  for (const e of [...new Set(consoleErrors)].slice(0, 8)) console.log(`    - ${String(e).slice(0, 150)}`);
}
if (netFailures.length) {
  console.log(`\n  Network failures (${netFailures.length}):`);
  for (const n of [...new Set(netFailures)].slice(0, 8)) console.log(`    - ${n}`);
}
console.log('='.repeat(78) + '\n');

const summary = {
  url: URL, viewport: `${W}x${H}`, timestamp: new Date().toISOString(),
  results, consoleErrors: [...new Set(consoleErrors)], netFailures: [...new Set(netFailures)],
  fonts, geo, opState, cycles, dataInfo,
};
writeFileSync('C:\\Users\\pruth\\AppData\\Local\\Temp\\audit\\verify-latest.json', JSON.stringify(summary, null, 2));

ws.close();
chrome.kill();
process.exit(critFailed.length ? 1 : 0);
