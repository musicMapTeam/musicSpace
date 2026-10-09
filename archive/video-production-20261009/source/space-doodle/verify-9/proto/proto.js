const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const [,, base, variants, sizesArg] = process.argv;
const sizes = sizesArg.split(',').map(s => { const [w, h] = s.split('x').map(Number); return { width: w, height: h }; });
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    for (const vp of sizes) {
      const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(3500);
      for (const v of variants.split(',')) {
        await page.evaluate(() => document.querySelectorAll('style[data-proto]').forEach(s => s.remove()));
        if (v !== 'none') await page.evaluate(css => { const s = document.createElement('style'); s.dataset.proto = '1'; s.textContent = css; document.head.appendChild(s); }, fs.readFileSync(`${v}.css`, 'utf8'));
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(700);
        await page.screenshot({ path: `proto-${v}-${vp.width}x${vp.height}.png` });
        const m = await page.evaluate(() => { const g = s => { const e = document.querySelector(s); if (!e) return null; const c = getComputedStyle(e); const r = e.getBoundingClientRect(); return { s, size: c.fontSize, shadow: c.textShadow === 'none' ? 'none' : 'yes', vis: c.display !== 'none' && r.width > 0, box: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] }; };
          return [g('.desktop-caption .caption-line--b'), g('#presence-title'), g('#room-title'), g('.desktop-caption .caption-tag'), g('.desktop-caption .caption-star'), g('.scene-code')]; });
        console.log(v, vp.width + 'x' + vp.height, JSON.stringify(m));
      }
      await ctx.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
