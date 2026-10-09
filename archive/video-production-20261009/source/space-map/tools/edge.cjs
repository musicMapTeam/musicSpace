// Edge states: WebGL fallback (NOGL=1) and 320px narrow width, with overflow + tap-target audit.
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const BASE = process.env.MAP_URL || 'http://127.0.0.1:4791/musicSpace/music-map/';
const OUT = '/tmp/space-map/shots/base'; fs.mkdirSync(OUT, { recursive: true });
const runs = [
  ['nogl-phone', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, ['--disable-webgl', '--disable-3d-apis']],
  ['nogl-desktop', { viewport: { width: 1440, height: 900 } }, ['--disable-webgl', '--disable-3d-apis']],
  ['w320', { viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, ['--use-angle=metal', '--enable-gpu']],
];
const report = [];
(async () => {
  for (const [name, opts, args] of runs) {
    const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args });
    const context = await browser.newContext(opts); const page = await context.newPage();
    const errors = []; page.on('pageerror', e => errors.push(String(e).slice(0, 160)));
    const audit = async label => {
      await page.waitForTimeout(1200);
      const file = `${OUT}/${name}-${label}.png`; await page.screenshot({ path: file });
      const r = await page.evaluate(() => {
        const W = window.innerWidth;
        const vis = el => { const s = getComputedStyle(el); const b = el.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && b.width > 0 && b.height > 0; };
        const over = [...document.querySelectorAll('body *')].filter(vis).filter(el => { const b = el.getBoundingClientRect(); return b.right > W + 1 && !el.closest('.spatial-world,.os-scrollbar,[class*="hand__cards"],.map-route-trail'); }).map(el => `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} r=${Math.round(el.getBoundingClientRect().right)}`).slice(0, 12);
        const small = [...document.querySelectorAll('button,a,summary,input,select')].filter(vis).filter(el => { const b = el.getBoundingClientRect(); return (b.width < 44 || b.height < 44); }).map(el => `${(el.innerText || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').slice(0, 24)} ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`).slice(0, 30);
        return { scrollW: document.documentElement.scrollWidth, W, over, small, fallback: document.body.classList.contains('spatial-fallback') };
      });
      report.push({ name, label, file, ...r, errors: errors.splice(0) }); console.log(name, label, 'scrollW', r.scrollW, 'over', r.over.length, 'small', r.small.length, 'fallback', r.fallback);
    };
    try {
      await page.goto(BASE, { waitUntil: 'load' }); await page.waitForTimeout(5000); await audit('home');
      await page.goto(BASE + '#/explore', { waitUntil: 'load' }); await page.waitForTimeout(4000); await audit('explore');
      await page.click('[data-map-action="flip"]').catch(() => {}); await audit('flip');
      await page.evaluate(() => { const d = document.querySelector('.map-shop-menu'); if (d) d.open = true; }); await page.click('[data-map-action="reveal"]').catch(() => {}); await page.click('[data-map-action="reveal-confirm"]').catch(() => {});
      await page.waitForTimeout(800); await page.click('[data-map-action="ceremony-done"]').catch(() => {});
      await page.waitForSelector('.map-dialog--setlist', { timeout: 8000 }).catch(() => {}); await audit('setlist');
      await page.click('.map-dialog [data-map-action="close"]').catch(() => {}); await page.click('.map-round-hand--closed [data-map-action="return-roam"]').catch(() => {}); await page.waitForTimeout(2500); await audit('atlas');
      await page.goto(BASE + '#/records', { waitUntil: 'load' }); await page.waitForTimeout(3500); await audit('records');
      await page.click('#demo-help').catch(() => {}); await audit('about');
    } catch (e) { console.log('FAIL', name, String(e).slice(0, 200)); }
    await browser.close();
  }
  fs.writeFileSync(`${OUT}/edge.json`, JSON.stringify(report, null, 1));
})();
