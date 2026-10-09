// Frames during a camera move: BASE=.. FROM=home TO=records LABEL=.. [PAPER=1] node travel.cjs
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
(async () => {
  const dir = `/tmp/space-map/shots/${process.env.LABEL || '3d-travel'}`; fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--enable-gpu'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  if (process.env.PAPER) await ctx.addInitScript(() => { const apply = () => document.documentElement?.style.setProperty('--ds-paper', '#f7efdf'); apply(); document.addEventListener('readystatechange', apply); });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.goto(`${process.env.BASE}#/${process.env.FROM || 'home'}`, { waitUntil: 'load' });
  await page.waitForSelector('canvas.sakura-scene__canvas'); await page.waitForTimeout(4000);
  await page.click(`.world-compass button[data-world-view="${process.env.TO || 'records'}"]`);
  const t0 = Date.now(); const files = [];
  for (const at of [80, 300, 520, 740, 1300]) {
    const wait = at - (Date.now() - t0); if (wait > 0) await page.waitForTimeout(wait);
    const file = `${dir}/t${at}.png`; await page.screenshot({ path: file }); files.push(file);
  }
  console.log(files.join(' '), 'errors:', errs.length ? errs.join(' | ') : 'none');
  await browser.close();
})();
