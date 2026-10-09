// Every one of the 37 duets: reachable 「来源」 in the UI with the vocal source link, its evidence and access date (desktop, atlas →
// each singer → 目录 · TA 的合唱). Also checks that every link in a 来源 opens in a new tab with noopener.
const { launch, open, ORIGIN, mkdir } = require('./lib.cjs');
(async () => {
  const browser = await launch();
  const { ctx, page, rec } = await open(browser, 'desktop');
  await page.goto(ORIGIN + '/musicSpace/music-map/', { waitUntil: 'load' });
  await page.waitForSelector('#sakura-world canvas'); await page.waitForTimeout(3500);
  await page.click('[data-home-start="real-jay"]'); await page.waitForTimeout(3500);
  const names = await page.$$eval('.world-music-label', els => els.filter(e => !e.hidden).map(e => e.querySelector('strong').textContent));
  console.log('tags', names.length, names.join(' '));
  const seen = new Map();
  for (const name of names) {
    const tag = page.locator('.world-music-label', { has: page.locator('strong', { hasText: new RegExp(`^${name}$`) }) }).first();
    await tag.click({ timeout: 5000 }).catch(async () => { await tag.evaluate(el => el.click()); });
    await page.waitForTimeout(500);
    await page.click('.map-shop-menu > summary'); await page.waitForTimeout(250);
    await page.locator('.map-shop-menu [data-map-action="relations"]').click();
    await page.waitForSelector('dialog[open]'); await page.waitForTimeout(300);
    const rows = await page.$$eval('dialog[open] .map-track', tracks => tracks.map(track => {
      const title = track.querySelector('.map-track__name, strong')?.textContent.trim();
      const folds = track.nextElementSibling?.classList.contains('map-track__folds') ? track.nextElementSibling : null;
      const src = folds?.querySelector('details.map-sources');
      const links = src ? [...src.querySelectorAll('a')].map(a => ({ href: a.href, ok: a.target === '_blank' && /noopener/.test(a.rel) })) : [];
      const text = src ? src.querySelector('.map-sources__body').textContent : '';
      return { title, has: !!src, links: links.length, allNewTab: links.every(l => l.ok), visited: /访问于/.test(text), evidence: (src?.querySelectorAll('li:first-child p') || []).length };
    }));
    for (const r of rows) if (!seen.has(r.title) || !seen.get(r.title).has) seen.set(r.title, r);
    await page.click('dialog[open] [data-map-action="close"]'); await page.waitForTimeout(250);
  }
  const all = [...seen.values()];
  console.log('songs seen', all.length);
  console.log('without 来源', all.filter(r => !r.has).map(r => r.title).join(', ') || 'none');
  console.log('no 访问于', all.filter(r => !r.visited).map(r => r.title).join(', ') || 'none');
  console.log('no evidence line', all.filter(r => !r.evidence).map(r => r.title).join(', ') || 'none');
  console.log('links not new-tab/noopener', all.filter(r => !r.allNewTab).map(r => r.title).join(', ') || 'none');
  console.log('min links', Math.min(...all.map(r => r.links)), 'max', Math.max(...all.map(r => r.links)));
  console.log('errors', JSON.stringify({ console: rec.console, pageerrors: rec.pageerrors, failed: rec.failed, bad: rec.bad }));
  await ctx.close(); await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
