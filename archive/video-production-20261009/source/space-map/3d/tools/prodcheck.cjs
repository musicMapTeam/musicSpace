// Production tree under /musicSpace/: fonts resolve for the prints, console clean, nothing outside the prefix.
// ORIGIN=http://127.0.0.1:5392 [PATHS=/musicSpace/music-map/,/musicSpace/preview/music-map/] [PAPER=1] node prodcheck.cjs
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const ORIGIN = process.env.ORIGIN || 'http://127.0.0.1:5392';
const PATHS = (process.env.PATHS || '/musicSpace/music-map/,/musicSpace/preview/music-map/').split(',');
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--enable-gpu'] });
  for (const path of PATHS) for (const [vp, opts] of [['phone', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }], ['desktop', { viewport: { width: 1440, height: 900 } }]]) {
    await fetch(ORIGIN + '/__clear');
    const ctx = await browser.newContext(opts);
    if (process.env.PAPER) await ctx.addInitScript(() => { const apply = () => document.documentElement?.style.setProperty('--ds-paper', '#f7efdf'); apply(); document.addEventListener('readystatechange', apply); });
    const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push('pageerror ' + String(e).slice(0, 160)));
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ' ' + m.text().slice(0, 160)); });
    page.on('requestfailed', r => errs.push('requestfailed ' + r.url()));
    page.on('response', r => { if (r.status() >= 400) errs.push(`http ${r.status()} ${r.url()}`); });
    for (const view of ['home', 'explore']) { await page.goto(`${ORIGIN}${path}#/${view}`, { waitUntil: 'load' }); await page.waitForSelector('canvas.sakura-scene__canvas'); await page.waitForTimeout(3500); }
    const fonts = await page.evaluate(async () => { await document.fonts.ready; return ['Doodle Logo', 'Doodle Display', 'Doodle Marker'].map(f => `${f}:${document.fonts.check(`20px "${f}"`, f === 'Doodle Display' ? '唱片店' : 'RECORDS')}`).join(' '); });
    const style = await page.evaluate(() => document.querySelector('#sakura-world').dataset.renderStyle);
    const log = await (await fetch(ORIGIN + '/__log')).json();
    const outside = log.filter(line => !line.includes(' /musicSpace/') && !line.includes('/__'));
    const fontsSeen = [...new Set(log.filter(l => l.includes('/fonts/doodle/')).map(l => l.replace(/^GET /, '')))];
    console.log(path, vp, 'style=' + style, '|', fonts, '| outside prefix:', outside.length ? outside.join(' ') : 'none', '| font files:', fontsSeen.length, fontsSeen.slice(0, 4).join(' '), '| errors:', errs.length ? errs.join(' || ') : 'none');
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
