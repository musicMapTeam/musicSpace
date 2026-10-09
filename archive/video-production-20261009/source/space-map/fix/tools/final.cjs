// Final screenshots of the unified map on the production build: courtyard, search, a path with 「来源」 open, a found song,
// 我的发现, the record shop — phone and desktop. ORIGIN=http://127.0.0.1:5643 PREFIX=/musicSpace/ node final.cjs
const { launch, open, audit, MAP, mkdir, fs } = require('./lib.cjs');
const OUT = mkdir('/tmp/space-map/final');
const results = [];
(async () => {
  const browser = await launch();
  for (const kind of (process.argv.slice(2).length ? process.argv.slice(2) : ['phone', 'desktop'])) {
    const { ctx, page, rec } = await open(browser, kind);
    const touch = kind !== 'desktop';
    const tap = async target => {
      const l = typeof target === 'string' ? page.locator(target).filter({ visible: true }).first() : target;
      await l.waitFor({ state: 'visible', timeout: 15000 });
      await l.scrollIntoViewIfNeeded({ timeout: 4000 }).catch(() => {});
      if (touch) await l.tap(); else await l.click();
    };
    const shot = async (name, wait = 1200) => {
      await page.waitForTimeout(wait);
      await page.evaluate(() => document.fonts.ready);
      const file = `${OUT}/${kind}-${name}.png`;
      await page.screenshot({ path: file });
      const a = await audit(page);
      const flags = [a.small.length && `SMALL ${a.small.join(' | ')}`, a.over.length && `OVER ${a.over.join(' | ')}`, Object.keys(a.sysFallback).length && `SYSFONT ${JSON.stringify(a.sysFallback)}`, Object.keys(a.notLoaded).length && `NOTLOADED ${JSON.stringify(a.notLoaded)}`].filter(Boolean);
      results.push({ kind, name, file, flags });
      console.log(kind, name, a.url, flags.join(' || '));
    };
    await page.goto(MAP, { waitUntil: 'load' });
    await page.waitForSelector('#sakura-world canvas', { timeout: 30000 });
    await page.waitForTimeout(4500);
    await shot('1-courtyard');
    // search: type a part of a name, the picks become the matches
    await tap('#home-artist-search'); await page.keyboard.type('林');
    await shot('2-search', 900);
    // a path: start from 林俊杰, walk one duet, then open the next duet on the way and its 来源
    await tap('[data-home-start="real-jj"]'); await page.waitForURL(/#\/explore/); await page.waitForTimeout(3500);
    const index = page.locator('.map-network-index > summary').filter({ visible: true }).first();
    if (await index.count()) { await tap(index); await page.waitForTimeout(400); }
    await tap(page.locator('.map-network-connection').nth(1)); await page.waitForSelector('dialog.map-dialog[open]');
    await tap('dialog[open] [data-map-action="move"]'); await page.waitForTimeout(3000);
    const index2 = page.locator('.map-network-index:not([open]) > summary').filter({ visible: true }).first();
    if (await index2.count()) { await tap(index2); await page.waitForTimeout(400); }
    await tap(page.locator('.map-network-connection').first()); await page.waitForSelector('dialog.map-dialog[open]');
    await tap('dialog[open] details.map-sources > summary');
    await shot('3-path-sources');
    // a found song: keep it (本次发现 1 首) — the paper shows 已留下
    await page.evaluate(() => { const d = document.querySelector('dialog[open] details.map-sources'); if (d) d.open = false; });
    await tap('dialog[open] [data-map-action="save"]');
    await shot('4-found-song', 900);
    await tap('dialog[open] [data-map-action="close"]'); await page.waitForTimeout(600);
    // 我的发现: the cabinet, the exploration, and 留下的歌 with its 来源 in sight
    const nav = page.locator('.world-compass [data-world-view="records"], .mobile-nav [data-nav="records"]').filter({ visible: true }).first();
    await tap(nav); await page.waitForTimeout(3200);
    await shot('5-my-discoveries');
    await tap('[data-records-filter="music"]');
    await shot('5b-kept-songs', 900);
    // the record shop: a 寻声 round with one card turned over
    const home = page.locator('.world-compass [data-world-view="home"], .mobile-nav [data-nav="home"]').filter({ visible: true }).first();
    await tap(home); await page.waitForTimeout(2500);
    await tap('[data-home="round"]'); await page.waitForURL(/#\/explore/); await page.waitForTimeout(3500);
    await tap('[data-map-action="flip"]'); await page.waitForTimeout(900);
    await shot('6-record-shop', 3600);
    console.log(kind, 'errors', JSON.stringify({ c: rec.console, p: rec.pageerrors, f: rec.failed, b: rec.bad }));
    await ctx.close();
  }
  fs.writeFileSync(`${OUT}/final-results.json`, JSON.stringify(results, null, 1));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
