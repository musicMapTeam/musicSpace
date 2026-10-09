// Scene-only screenshots for a list of query variants. Usage: node variants.cjs <label> <view> <vp> <q1> <q2> ...
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const [label, view, vp, ...queries] = process.argv.slice(2);
const VPS = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, desktop: { viewport: { width: 1440, height: 900 } } };
const HIDE = process.env.UI === '1' ? '' : `.app-masthead,.app-body,.mobile-nav,.world-compass,.world-caption,.world-hotspots,#toast,.space-map-return{visibility:hidden!important}.spatial-world::after{display:none!important}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const dir = `/tmp/space-map/shots/3d-${label}`; fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--enable-gpu'] });
  const ctx = await browser.newContext({ ...VPS[vp] });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push('pageerror ' + String(e).slice(0, 300)));
  page.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && !m.text().includes('flatShading')) errs.push(m.type() + ' ' + m.text().slice(0, 300)); });
  for (const [i, q] of queries.entries()) {
    const [host, query] = q.includes('|') ? q.split('|') : ['http://127.0.0.1:5292/music-map/', q];
    await page.goto(`${host}${query}#/${view}`, { waitUntil: 'load' });
    if (HIDE) await page.addStyleTag({ content: HIDE });
    await page.waitForFunction(() => window.__MAP_PROTO__, null, { timeout: 30000 });
    if (HIDE) { await sleep(800); await page.evaluate(() => window.dispatchEvent(new Event('resize'))); }
    await sleep(Number(process.env.WAIT || 3000));
    const name = `${view}-${vp}-${i}.png`;
    await page.screenshot({ path: `${dir}/${name}` });
    console.log(name, q);
  }
  console.log('errors:', errs.length ? errs.join(' || ') : 'none');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
