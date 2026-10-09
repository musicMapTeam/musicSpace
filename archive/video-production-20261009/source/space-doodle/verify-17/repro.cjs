const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const OUT = '/tmp/space-doodle/verify-17/shots';
const URL = 'http://127.0.0.1:5190/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const VP = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};
async function boot(browser, kind) {
  const ctx = await browser.newContext(VP[kind]);
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log(`[${kind} pageerror]`, e.message.slice(0, 160)));
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 120000 });
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await sleep(1200);
  // enter the example room
  if (!(await page.locator('form[data-form="demo-entry"]').count())) await page.locator('button:visible', { hasText: '进入示例现场' }).first().click();
  await page.waitForSelector('form[data-form="demo-entry"]', { timeout: 30000 });
  await page.locator('form[data-form="demo-entry"] input[name=consent]').check();
  await page.waitForSelector('form[data-form="demo-entry"] button[type=submit]:not([disabled])', { timeout: 90000 });
  await page.locator('form[data-form="demo-entry"] button[type=submit]').click();
  await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"]'), null, { timeout: 60000 });
  await sleep(3000);
  return { ctx, page };
}
// mean luminance (Rec.601 like PIL 'L') of every <img> whose natural size is 700x374 or of every photo img in a scope
async function imgStats(page, scope) {
  return page.evaluate(async scope => {
    const root = document.querySelector(scope) || document;
    const out = [];
    for (const img of root.querySelectorAll('img')) {
      if (!img.complete || !img.naturalWidth) continue;
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      let d; try { d = g.getImageData(0, 0, c.width, c.height).data; } catch (e) { out.push({ src: img.src.slice(0, 60), err: String(e) }); continue; }
      let s = 0, n = 0, dark = 0;
      for (let i = 0; i < d.length; i += 4) { const L = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; s += L; n++; if (L < 20) dark++; }
      const r = img.getBoundingClientRect();
      const card = img.closest('article,li,figure,.photo-card,.moment-card,button,div');
      out.push({ natural: `${img.naturalWidth}x${img.naturalHeight}`, mean: +(s / n).toFixed(1), pctBelow20: +(dark / n * 100).toFixed(1), rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], text: (card?.innerText || '').replace(/\s+/g, ' ').slice(0, 80) });
    }
    return out;
  }, scope);
}
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    // ---------- phone: 2D wall + recap ----------
    const { ctx: pc, page: p } = await boot(browser, 'phone');
    await p.screenshot({ path: `${OUT}/phone-01-in-room.png` });
    // open the 2D wall panel the way the UI does
    await p.evaluate(() => { const b = document.createElement('button'); b.dataset.open = 'wall'; b.style.cssText = 'position:fixed;left:-9999px'; document.body.append(b); b.click(); b.remove(); });
    await sleep(3500);
    const wallStats = await imgStats(p, '#panel');
    console.log('PHONE WALL imgs', JSON.stringify(wallStats, null, 1));
    await p.screenshot({ path: `${OUT}/phone-02-wall-top.png` });
    // scroll the 700x374 photo into view and screenshot its card
    const found = await p.evaluate(() => {
      const imgs = [...document.querySelectorAll('#panel img')].filter(i => i.naturalWidth === 700 && i.naturalHeight === 374);
      if (!imgs.length) return null;
      imgs[0].scrollIntoView({ block: 'center' });
      return true;
    });
    await sleep(800);
    await p.screenshot({ path: `${OUT}/phone-03-wall-man-near.png` });
    console.log('phone man-near on wall found:', found);
    // recap
    await p.evaluate(() => { const c = document.querySelector('#panel-close'); if (c && !document.querySelector('#panel').hidden) c.click(); });
    await sleep(600);
    const rid = await p.evaluate(() => document.querySelector('#room-recap')?.dataset.id || '');
    await p.evaluate(id => { const b = document.createElement('button'); b.dataset.open = 'recap'; if (id) b.dataset.id = id; b.style.cssText = 'position:fixed;left:-9999px'; document.body.append(b); b.click(); b.remove(); }, rid);
    await sleep(4000);
    const recapStats = await imgStats(p, '#panel');
    console.log('PHONE RECAP imgs', JSON.stringify(recapStats, null, 1));
    await p.evaluate(() => { const h = [...document.querySelectorAll('#panel h3')].find(h => h.textContent.includes('留下的视角')); h?.scrollIntoView({ block: 'start' }); });
    await sleep(800);
    await p.screenshot({ path: `${OUT}/phone-04-recap-views.png` });
    await p.evaluate(() => { const imgs = [...document.querySelectorAll('#panel img')].filter(i => i.naturalWidth === 700 && i.naturalHeight === 374); imgs[0]?.scrollIntoView({ block: 'center' }); });
    await sleep(800);
    await p.screenshot({ path: `${OUT}/phone-05-recap-man-near.png` });
    await pc.close();
    // ---------- desktop: 3D wall ----------
    const { ctx: dc, page: d } = await boot(browser, 'desktop');
    await d.locator('nav.camera-nav button[data-view="photos"]').click();
    await sleep(6000);
    await d.screenshot({ path: `${OUT}/desktop-01-3d-wall.png` });
    await dc.close();
  } finally { await browser.close(); }
})().catch(e => { console.error('FAILED', e); process.exit(1); });
