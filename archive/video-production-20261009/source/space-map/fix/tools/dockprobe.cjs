// The atlas dock's roam bar at tablet widths: each control's box, scroll vs client width.
const { launch, MAP } = require('./lib.cjs');
const sizes = (process.argv.slice(2).length ? process.argv.slice(2) : ['768x1024', '820x1180', '900x1100', '1024x768']).map(s => s.split('x').map(Number));
(async () => {
  const browser = await launch();
  for (const [w, h] of sizes) {
    const touch = h > w;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: touch ? 2 : 1, isMobile: touch, hasTouch: touch });
    const page = await ctx.newPage();
    await page.goto(MAP, { waitUntil: 'load' }); await page.waitForTimeout(2500);
    await page.locator('[data-home-start="real-jay"]').click(); await page.waitForTimeout(3000);
    const r = await page.evaluate(() => {
      const dock = document.querySelector('.map-studio-dock'); const db = dock.getBoundingClientRect();
      const bar = document.querySelector('.map-roam-bar');
      const kids = [...bar.children].filter(e => e.checkVisibility()).map(e => { const b = e.getBoundingClientRect(); return `${(e.innerText || '').replace(/\s+/g, '')}:${Math.round(b.left)}-${Math.round(b.right)} sw${e.scrollWidth}/cw${e.clientWidth} flex=${getComputedStyle(e).flex}`; });
      const tools = [...document.querySelectorAll('.map-network-tools')].find(e => e.checkVisibility()); const tb = tools?.getBoundingClientRect();
      return { dock: [db.left, db.top, db.right, db.bottom].map(Math.round), pad: getComputedStyle(dock).padding, wrap: getComputedStyle(bar).flexWrap, kids, tools: tb ? [tb.left, tb.top, tb.right, tb.bottom].map(Math.round) : null };
    });
    console.log(`${w}x${h}`, JSON.stringify(r, null, 0));
    await page.screenshot({ path: `/tmp/space-map/shots/fix/dock-${w}x${h}.png` });
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
