import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
await p.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 60000 }).catch(()=>{});
await p.waitForTimeout(1200);
await p.evaluate(()=>{const m=Math.max(1,document.documentElement.scrollHeight-window.innerHeight);window.scrollTo(0,m);});
await p.waitForTimeout(3000);
const btn = p.locator('button[aria-label="Map layers"]');
const box = await btn.first().boundingBox().catch(()=>null);
const vp = {w:1440,h:900};
console.log('layers button box:', box ? {x:Math.round(box.x),y:Math.round(box.y),w:Math.round(box.width),h:Math.round(box.height)} : 'none');
console.log('in left sidebar rail (x < 360):', box ? box.x < 360 && box.x > 0 : false);
// toggle open
await btn.first().click();
await p.waitForTimeout(400);
const panelVisible = await p.locator('text=Density surface').first().isVisible().catch(()=>false);
console.log('layer panel opens with toggles:', panelVisible);
// confirm not floating over center/right
console.log('not on right side (x > 900):', box ? box.x > 900 : 'n/a');
await b.close();
