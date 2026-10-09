const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const css = fs.readFileSync('R.css', 'utf8');
const measure = page => page.evaluate(() => { const g = (s, p) => { const e = document.querySelector(s); if (!e) return null; const c = getComputedStyle(e, p || null); const r = e.getBoundingClientRect();
  return { s: s + (p || ''), size: c.fontSize, color: c.color, shadow: c.textShadow.slice(0, 40), stroke: c.webkitTextStrokeWidth, content: p ? c.content : undefined, vis: c.display !== 'none' && r.width > 0, box: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] }; };
  return { stage: document.querySelector('.frame').dataset.stage, items: [g('#room-title'), g('#presence-title'), g('#presence-title', '::after'), g('.desktop-caption'), g('.desktop-caption .caption-tag')] }; });
const inject = page => page.evaluate(c => { const s = document.createElement('style'); s.dataset.proto = '1'; s.textContent = c; document.head.appendChild(s); }, css);
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    // phone lobby with R injected: must be identical to without
    for (const vp of [{ width: 390, height: 844, deviceScaleFactor: 2 }]) {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.deviceScaleFactor, isMobile: true, hasTouch: true });
      const page = await ctx.newPage();
      await page.goto('http://127.0.0.1:5190/', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
      await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(3000);
      const before = await measure(page); await inject(page); await page.waitForTimeout(500); const after = await measure(page);
      console.log('phone lobby identical with R:', JSON.stringify(before) === JSON.stringify(after));
      console.log(' phone', JSON.stringify(after.items.slice(0, 3)));
      await page.screenshot({ path: 'scope-R-phone-lobby.png' });
      await ctx.close();
    }
    // desktop: join the example room, then compare with and without R
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto('http://127.0.0.1:5190/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
    await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(3000);
    await page.click('#join');
    await page.waitForSelector('#panel:not([hidden])', { timeout: 20000 });
    await page.waitForTimeout(800);
    const boxes = await page.$$('#panel input[type=checkbox]');
    for (const b of boxes) { if (!(await b.isChecked())) await b.check({ force: true }).catch(() => {}); }
    const btns = await page.$$('#panel .primary');
    let clicked = false;
    for (const b of btns) { const t = (await b.textContent()) || ''; if (/进入/.test(t) && await b.isVisible()) { await b.click(); clicked = true; break; } }
    console.log('join clicked:', clicked);
    await page.waitForFunction(() => document.querySelector('.frame').dataset.stage === 'room', null, { timeout: 30000 });
    await page.waitForTimeout(4000);
    // close the panel / tour if any so the heading is visible
    const before = await measure(page); await page.screenshot({ path: 'scope-none-room-1440.png' });
    await inject(page); await page.waitForTimeout(500);
    const after = await measure(page); await page.screenshot({ path: 'scope-R-room-1440.png' });
    console.log('desktop room identical with R:', JSON.stringify(before) === JSON.stringify(after));
    console.log(' room', JSON.stringify(after));
    await ctx.close();
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
