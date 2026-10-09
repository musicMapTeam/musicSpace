// WebGL off: the 2D table. Home, round, flip, 来源, atlas; phone + desktop.
process.env.NOGL = '1';
const { launch, open, audit, outside, ORIGIN, mkdir } = require('./lib.cjs');
const OUT = mkdir('/tmp/space-map/shots/verify/nogl');
(async () => {
  const browser = await launch();
  for (const kind of ['phone', 'desktop', 'w320']) {
    const { ctx, page, rec } = await open(browser, kind);
    const touch = kind !== 'desktop';
    const tap = async sel => { const l = page.locator(sel).filter({ visible: true }).first(); await l.waitFor({ state: 'visible', timeout: 10000 }); await l.scrollIntoViewIfNeeded().catch(() => {}); if (touch) await l.tap(); else await l.click(); };
    const snap = async name => { await page.waitForTimeout(900); await page.screenshot({ path: `${OUT}/${kind}-${name}.png`, fullPage: false }); const a = await audit(page); console.log(kind, name, 'gl?', await page.evaluate(() => !!document.querySelector('#sakura-world canvas')), 'fallback', await page.evaluate(() => document.body.classList.contains('spatial-fallback')), a.hits.length ? 'WORDS ' + a.hits.join(' | ').slice(0, 300) : '', a.small.length ? 'SMALL ' + a.small.join(' | ') : '', a.over.length ? 'OVER ' + a.over.join(' | ') : '', Object.keys(a.sysFallback).length ? 'SYS ' + JSON.stringify(a.sysFallback) : ''); };
    try {
      await page.goto(ORIGIN + '/musicSpace/music-map/', { waitUntil: 'load' }); await page.waitForTimeout(2500);
      await snap('home');
      await tap('[data-home="round"]'); await page.waitForTimeout(1500); await snap('round');
      await tap('[data-map-action="flip"]'); await page.waitForTimeout(800); await snap('flip');
      await tap('.map-round-card [data-map-action="edge"]'); await page.waitForTimeout(800); await tap('dialog[open] details.map-sources > summary'); await snap('sources');
      await tap('dialog[open] [data-map-action="close"]');
      await page.goto(ORIGIN + '/musicSpace/music-map/', { waitUntil: 'load' }); await page.waitForTimeout(1500);
      await tap('[data-home-start="real-jay"]'); await page.waitForTimeout(1500); await snap('atlas');
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await snap('atlas-bottom');
    } catch (e) { console.log(kind, 'FAIL', String(e.message).split('\n')[0]); await page.screenshot({ path: `${OUT}/${kind}-FAIL.png` }); }
    console.log(kind, 'errors', JSON.stringify({ c: rec.console, p: rec.pageerrors, f: rec.failed, b: rec.bad, out: outside(rec) }));
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
