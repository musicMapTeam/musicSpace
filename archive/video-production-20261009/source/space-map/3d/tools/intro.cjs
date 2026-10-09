// First-visit ink intro: frames right after the scene mounts. BASE=.. [PAPER=1] node intro.cjs
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
(async () => {
  const dir = '/tmp/space-map/shots/3d-intro'; fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--enable-gpu'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  if (process.env.PAPER) await ctx.addInitScript(() => { const apply = () => document.documentElement?.style.setProperty('--ds-paper', '#f7efdf'); apply(); document.addEventListener('readystatechange', apply); });
  const page = await ctx.newPage();
  await page.goto(process.env.BASE + '#/home', { waitUntil: 'commit' });
  await page.waitForSelector('canvas.sakura-scene__canvas', { timeout: 20000 });
  const t0 = Date.now(); const files = [];
  for (const at of [60, 250, 450, 700, 1500]) { const wait = at - (Date.now() - t0); if (wait > 0) await page.waitForTimeout(wait); const f = `${dir}/t${at}.png`; await page.screenshot({ path: f, clip: { x: 420, y: 250, width: 960, height: 620 } }); files.push(f); }
  console.log(files.join(' ')); await browser.close();
})();
