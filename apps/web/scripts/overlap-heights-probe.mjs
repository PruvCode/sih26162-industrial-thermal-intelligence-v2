// overlap-heights-probe.mjs
// Confirms the LOW EARTH ORBIT breadcrumb never overlaps the "System active"
// hero-status line across a range of short viewport heights (the stress case).
import { chromium } from 'playwright';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--headless=new','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--no-sandbox'],
});
const heights = [640, 680, 720, 768, 900];
const rows = [];
for (const h of heights) {
  const page = await browser.newPage({ viewport: { width: 1280, height: h } });
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="hero-status"]', { timeout: 10000 });
  await page.waitForTimeout(1500);
  const g = await page.evaluate(() => {
    const status = document.querySelector('[data-testid="hero-status"]');
    const bc = Array.from(document.querySelectorAll('span')).find((s) => s.textContent?.trim() === 'LOW EARTH ORBIT');
    const block = bc ? bc.closest('div.absolute.bottom-7') ?? bc.parentElement : null;
    const sb = status.getBoundingClientRect().bottom;
    const bt = block.getBoundingClientRect().top;
    return { sb, bt, gap: +(bt - sb).toFixed(1) };
  });
  rows.push({ h, ...g });
  await page.close();
}
await browser.close();
console.log('height | heroStatusBottom | breadcrumbTop | gap');
for (const r of rows) console.log(`${r.h}\t| ${r.sb}\t\t| ${r.bt}\t\t| ${r.gap} ${r.gap > 0 ? 'OK' : 'OVERLAP'}`);
const minGap = Math.min(...rows.map((r) => r.gap));
console.log('\nmin gap across heights :', minGap, minGap > 0 ? '=> NO OVERLAP AT ANY HEIGHT' : '=> OVERLAP AT SOME HEIGHT');
process.exit(minGap > 0 ? 0 : 1);
