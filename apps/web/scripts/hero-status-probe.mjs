/**
 * HERO STATUS-LINE PROBE.
 *
 * The "System active · VIIRS / MODIS" line read as cramped punctuation soup
 * because a status and an instrument list were one tracked-out string. This
 * asserts the structure that replaced it: two separate facts, a hairline
 * divider, consistent gutters, one line, sane vertical rhythm against the
 * button above it.
 *
 * Geometry, not pixels — these are layout invariants, and they are what "the
 * spacing looks wrong" actually means.
 */

import { chromium } from 'playwright';

const URL = process.env.PROBE_URL || 'http://localhost:3000/';
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
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page
  .waitForFunction(() => !document.querySelector('[data-testid="loading-screen"]'), { timeout: 60000 })
  .catch(() => {});
await page.waitForTimeout(6000);

const m = await page.evaluate(() => {
  const root = document.querySelector('[data-testid="hero-status"]');
  if (!root) return { missing: true };

  const kids = Array.from(root.children).map((el) => {
    const r = el.getBoundingClientRect();
    return {
      tag: el.tagName.toLowerCase(),
      text: (el.textContent || '').trim(),
      left: r.left,
      right: r.right,
      top: r.top,
      bottom: r.bottom,
      width: r.width,
      height: r.height,
      centreY: r.top + r.height / 2,
    };
  });

  // The status group holds the dot and the "System active" label.
  const group = root.children[0];
  const dot = group?.querySelector('span');
  const dotRect = dot?.getBoundingClientRect();
  const label = group?.querySelectorAll('span')[1];
  const labelRect = label?.getBoundingClientRect();

  // Button directly above, for vertical rhythm.
  const button = root.parentElement?.querySelector('button');
  const buttonRect = button?.getBoundingClientRect();

  // Dividers are the 1px-wide children.
  const divider = kids.find((k) => k.width <= 2);

  return {
    missing: false,
    rootRect: (({ top, left, right, height, width }) => ({ top, left, right, height, width }))(
      root.getBoundingClientRect()
    ),
    kids,
    divider,
    dot: dotRect ? { width: dotRect.width, height: dotRect.height, centreY: dotRect.top + dotRect.height / 2 } : null,
    label: labelRect
      ? { text: label.textContent.trim(), centreY: labelRect.top + labelRect.height / 2, height: labelRect.height }
      : null,
    buttonBottom: buttonRect ? buttonRect.bottom : null,
    fonts: {
      label: label ? getComputedStyle(label).fontSize : null,
      tracking: label ? getComputedStyle(label).letterSpacing : null,
    },
    fullText: (root.textContent || '').replace(/\s+/g, ' ').trim(),
  };
});

if (m.missing) {
  check('hero-status exists', false);
  await browser.close();
  process.exit(1);
}

console.log(`\nstatus line box: top=${m.rootRect.top.toFixed(1)} width=${m.rootRect.width.toFixed(1)} height=${m.rootRect.height.toFixed(1)}`);
console.log(`children: ${m.kids.map((k) => `[${k.text || 'divider'} @${k.left.toFixed(0)}..${k.right.toFixed(0)}]`).join('  ')}`);
console.log(`rendered text: "${m.fullText}"\n`);

// ── Structure ─────────────────────────────────────────────────────────────
check('three flex children (status · divider · instruments)', m.kids.length === 3, `got ${m.kids.length}`);

check(
  'the two facts are separate elements, not one middot-joined string',
  !m.fullText.includes('·'),
  `"${m.fullText}"`
);
check('reads as two facts', /system active/i.test(m.fullText) && /viirs/i.test(m.fullText) && /modis/i.test(m.fullText));

// ── Horizontal order and gutters ──────────────────────────────────────────
const [status, , instruments] = m.kids;
check('order is status → divider → instruments', status.right <= m.divider.left && m.divider.right <= instruments.left);
check('no overlap between any two children', status.right <= m.divider.left + 0.5 && m.divider.right <= instruments.left + 0.5);

const gutterA = m.divider.left - status.right;
const gutterB = instruments.left - m.divider.right;
check(`gutter status→divider is 12px (${gutterA.toFixed(1)})`, Math.abs(gutterA - 12) < 1.5);
check(`gutter divider→instruments is 12px (${gutterB.toFixed(1)})`, Math.abs(gutterB - 12) < 1.5);
check('gutters are symmetric', Math.abs(gutterA - gutterB) < 1.5);

// ── Vertical alignment ────────────────────────────────────────────────────
const centres = m.kids.map((k) => k.centreY);
const centreSpread = Math.max(...centres) - Math.min(...centres);
check(`all three share one baseline line (spread ${centreSpread.toFixed(2)}px)`, centreSpread < 1.5);

const rowTops = [...new Set(m.kids.map((k) => Math.round(k.top)))];
check(`renders on a single row, no wrap (${rowTops.length} row)`, rowTops.length === 1);

check(
  `dot is optically centred with its label (Δ ${Math.abs(m.dot.centreY - m.label.centreY).toFixed(2)}px)`,
  Math.abs(m.dot.centreY - m.label.centreY) < 1.0
);
check(`dot is 6px (${m.dot.width}×${m.dot.height})`, Math.abs(m.dot.width - 6) < 0.6 && Math.abs(m.dot.height - 6) < 0.6);

// ── Vertical rhythm against the button ────────────────────────────────────
const gapToButton = m.rootRect.top - m.buttonBottom;
check(
  `sits 32px under the button, grouped with it (${gapToButton.toFixed(1)}px)`,
  Math.abs(gapToButton - 32) < 1.5
);
check(
  `button→status gap is tighter than paragraph→button, so they read as one cluster (${gapToButton.toFixed(1)} < 36)`,
  gapToButton < 36
);

// ── Typography ────────────────────────────────────────────────────────────
check(`label type is 10px, up from 9px (${m.fonts.label})`, parseFloat(m.fonts.label) === 10);
check(`tracking relaxed to 0.16em (${m.fonts.tracking})`, Math.abs(parseFloat(m.fonts.tracking) - 1.6) < 0.15);

await browser.close();
console.log(`\n${fail.length === 0 ? 'ALL CHECKS PASSED' : `${fail.length} FAILED: ${fail.join(', ')}`}`);
process.exit(fail.length === 0 ? 0 : 1);
