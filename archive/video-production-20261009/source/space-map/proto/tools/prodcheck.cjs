// Production build of the doodle prototype under /musicSpace/music-map/: fonts resolve, console clean, prints repainted.
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const dir = '/tmp/space-map/shots/3d-prod'; fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--enable-gpu'] });
  await fetch('http://127.0.0.1:5295/__clear');
  for (const [vp, opts] of [['desktop', { viewport: { width: 1440, height: 900 } }], ['phone', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
    const ctx = await browser.newContext(opts); const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push('pageerror ' + String(e).slice(0, 160)));
    page.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && !m.text().includes('flatShading')) errs.push(m.type() + ' ' + m.text().slice(0, 160)); });
    page.on('requestfailed', r => errs.push('requestfailed ' + r.url()));
    for (const view of ['home', 'explore']) {
      await page.goto(`http://127.0.0.1:5295/musicSpace/music-map/?ui=paper#/${view}`, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__MAP_PROTO__); await sleep(3500);
      await page.screenshot({ path: `${dir}/${view}-${vp}.png` });
    }
    const fonts = await page.evaluate(async () => { await document.fonts.ready; return ['Doodle Logo', 'Doodle Display', 'Doodle Marker'].map(f => `${f}:${document.fonts.check(`20px "${f}"`, 'RECORDS 唱片店')}`).join(' '); });
    console.log(vp, 'fonts', fonts, '| errors:', errs.length ? errs.join(' || ') : 'none');
    await ctx.close();
  }
  const log = await (await fetch('http://127.0.0.1:5295/__log')).json();
  console.log('requests:', [...new Set(log.map(l => l.replace(/^GET /, '')))].filter(p => !p.includes('/demo/')).join(' '));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
