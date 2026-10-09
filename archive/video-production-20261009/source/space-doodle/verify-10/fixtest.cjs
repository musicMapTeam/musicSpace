// verify-10: try the proposed scene-layout.js change in the browser via request interception (repo untouched)
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const OUT = '/tmp/space-doodle/verify-10/fix';
fs.mkdirSync(OUT, { recursive: true });
const URL = 'http://127.0.0.1:5190/';
const K = Number(process.env.K || 1.8), GAP4 = process.env.GAP4 !== '0';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const kill = setTimeout(() => { console.log('WATCHDOG'); process.exit(2); }, 280000);
let src = fs.readFileSync('/Users/alakazan/workplace/tme/musicSpace/web/event-room/scene-layout.js', 'utf8');
if (GAP4) src = src.replace('(count>4?1.45:2.15)', '(count>3?1.45:2.15)');
src = src.replace(':{position:[-.493*distance,2.15+.20*distance,1+.87004*distance],target:[0,2.15,1]};',
  `:{position:[-.493*distance+${K}*.87004,2.15+.20*distance,1+.87004*distance+${K}*.493],target:[${K}*.87004,2.15,1+${K}*.493]};`);
if (!src.includes(`${K}*.87004`)) { console.log('PATCH FAILED'); process.exit(1); }
const vps = (process.env.VPS || '1280x800,1366x768,1440x900,1536x864,1920x1080').split(',').map(s => s.split('x').map(Number));
async function measure(page) {
  return page.evaluate(() => {
    const R = el => { const b = el.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; };
    const qa = window.__SPACE_EVENT_QA__?.();
    const card = R(document.querySelector('.presence'));
    const tags = [...document.querySelectorAll('#hotspots .hotspot')].map(h => { const lab = h.querySelector('.label'); const r = lab.getBoundingClientRect(); const top = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2); return { t: h.textContent.trim(), hidden: h.hidden, label: R(lab), clickable: !!top && h.contains(top) }; });
    return { card, n: (qa?.members || []).length, target: qa?.camera?.target?.map(v => +v.toFixed(2)), tags };
  });
}
(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    for (const [w, h] of vps) {
      const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
      let hit = 0;
      await ctx.route('**/scene-layout.js*', route => { hit++; route.fulfill({ status: 200, contentType: 'text/javascript', body: src }); });
      const page = await ctx.newPage();
      await page.goto(URL, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
      await page.waitForFunction(() => document.querySelector('#loading')?.hidden === true, null, { timeout: 60000 }).catch(() => {});
      await page.evaluate(() => document.fonts.ready); await sleep(800);
      if (!(await page.locator('form[data-form="demo-entry"]').count())) await page.locator('button:visible', { hasText: '进入示例现场' }).first().click();
      await page.waitForSelector('form[data-form="demo-entry"]', { timeout: 20000 });
      await page.locator('form[data-form="demo-entry"] input[name=consent]').check();
      await page.waitForSelector('form[data-form="demo-entry"] button[type=submit]:not([disabled])', { timeout: 60000 });
      await page.locator('form[data-form="demo-entry"] button[type=submit]').click();
      await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"]'), null, { timeout: 60000 });
      await page.waitForFunction(() => (window.__SPACE_EVENT_QA__?.()?.members || []).length > 1, null, { timeout: 30000 }).catch(() => {});
      await sleep(1800);
      const a = await measure(page);
      console.log(`\n=== FIX k=${K} ${w}x${h} routeHits=${hit} n=${a.n} target=${a.target} card=${a.card}`);
      for (const t of a.tags) console.log('  ', JSON.stringify(t));
      await page.screenshot({ path: `${OUT}/fix-k${K}-4-${w}x${h}.png` });
      await page.waitForFunction(() => (window.__SPACE_EVENT_QA__?.()?.members || []).length >= 5, null, { timeout: 40000 }).catch(() => {});
      await sleep(1800);
      const c = await measure(page);
      console.log(`--- n=${c.n}`);
      for (const t of c.tags) console.log('  ', JSON.stringify(t));
      await page.screenshot({ path: `${OUT}/fix-k${K}-5-${w}x${h}.png` });
      await ctx.close();
    }
  } finally { await b.close(); clearTimeout(kill); }
})().catch(e => { console.error(e); process.exit(1); });
