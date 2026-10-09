// Mid-ceremony frames (reveal): the answer's ink grows song by song. BASE=.. [PAPER=1] node ceremony.cjs
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
(async () => {
  const dir = '/tmp/space-map/shots/3d-ceremony'; fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--enable-gpu'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  if (process.env.PAPER) await ctx.addInitScript(() => { const apply = () => document.documentElement?.style.setProperty('--ds-paper', '#f7efdf'); apply(); document.addEventListener('readystatechange', apply); });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto(process.env.BASE + '#/explore'); await page.waitForSelector('canvas.sakura-scene__canvas'); await page.waitForTimeout(4000);
  await page.evaluate(() => { const d = document.querySelector('.map-shop-menu'); if (d) d.open = true; });
  await page.click('[data-map-action="reveal"]'); await page.waitForTimeout(400); await page.click('[data-map-action="reveal-confirm"]');
  const t0 = Date.now(); const files = [];
  for (const at of [350, 700, 1050, 1500]) { const wait = at - (Date.now() - t0); if (wait > 0) await page.waitForTimeout(wait); const f = `${dir}/t${at}.png`; await page.screenshot({ path: f, clip: { x: 640, y: 110, width: 640, height: 520 } }); files.push(f); }
  console.log(files.join(' '), 'errors:', errs.length ? errs.join(' | ') : 'none'); await browser.close();
})();
