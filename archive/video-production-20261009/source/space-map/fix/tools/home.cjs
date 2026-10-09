// Home courtyard at small phones: screenshot + layout boxes. Needs TEMP-DEBUG for the free rect.
const { launch, MAP, mkdir } = require('./lib.cjs');
const OUT = mkdir(process.env.OUT || '/tmp/space-map/shots/fix/home');
const sizes = (process.argv.slice(2).length ? process.argv.slice(2) : ['320x568', '360x640', '375x667', '390x844']).map(s => s.split('x').map(Number));
(async () => {
  const browser = await launch();
  for (const [w, h] of sizes) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto(MAP, { waitUntil: 'load' });
    await page.waitForSelector('#sakura-world canvas', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(3000);
    const r = await page.evaluate(() => {
      const box = s => { const e = [...document.querySelectorAll(s)].find(x => x.checkVisibility()); if (!e) return null; const b = e.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom].map(Math.round); };
      const d = globalThis.__mapDebug; const l = d?.framing.get('home');
      return { hero: box('.home-hero'), title: box('.home-hero__title'), paper: box('.home-paper'), pin: box('.world-pin'), nav: box('.mobile-nav'), rect: l ? [l.rect.left, l.rect.top, l.rect.right, l.rect.bottom].map(Math.round) : null };
    });
    console.log(`${w}x${h}`, JSON.stringify(r));
    await page.screenshot({ path: `${OUT}/${w}x${h}.png` });
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
