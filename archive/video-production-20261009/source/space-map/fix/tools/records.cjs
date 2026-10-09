// The 我的发现 (records) camera view across portrait and landscape sizes: screenshot + where the shop sign lands.
// OUT=dir node records.cjs [w x h ...]
const { launch, MAP, mkdir } = require('./lib.cjs');
const OUT = mkdir(process.env.OUT || '/tmp/space-map/shots/fix/records');
const QUERY = process.env.QUERY || '';
const sizes = (process.argv.slice(2).length ? process.argv.slice(2) : ['390x844', '360x740', '320x568', '430x932', '768x1024', '820x1180', '1024x1366', '1024x768', '1440x900'])
  .map(s => s.split('x').map(Number));
(async () => {
  const browser = await launch();
  for (const [w, h] of sizes) {
    const touch = w <= 1024 && h > w;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: touch ? 2 : 1, isMobile: touch, hasTouch: touch, ...(process.env.REDUCED ? { reducedMotion: 'reduce' } : {}) });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
    await page.goto(MAP + QUERY, { waitUntil: 'load' });
    await page.waitForSelector('#sakura-world canvas', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2500);
    // one exploration so the paper has a record card
    await page.locator('[data-home-start="real-jay"]').click().catch(() => {});
    await page.waitForTimeout(2500);
    const nav = page.locator('.world-compass [data-world-view="records"], .mobile-nav [data-nav="records"]').filter({ visible: true }).first();
    await nav.click();
    await page.waitForTimeout(3200);
    const file = `${OUT}/${w}x${h}-records.png`;
    await page.screenshot({ path: file });
    const info = await page.evaluate(() => {
      const r = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; };
      return { brand: r('.app-studio-shell .brand'), tools: r('.masthead-tools'), caption: r('.world-caption'), main: r('.main-content'), nav: r('.mobile-nav'), compass: r('.world-compass'), shot: document.querySelector('#sakura-world')?.dataset.shot };
    });
    console.log(`${w}x${h}`, JSON.stringify(info), errors.length ? 'ERR ' + errors.join(' | ') : '');
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
