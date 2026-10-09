// Direct walk of the unified map: home → singer → duet → 来源 → 前往 → 留下 → 本次发现 → 我的发现 → 寻声 → 来源 chip → reveal → setlist →
// 关于 · 数据来源 → 开放曲库 → 返回现场. KIND=phone|desktop|w320 PREFIX=/musicSpace/ LABEL=...
const { launch, open, audit, outside, ORIGIN, mkdir, fs } = require('./lib.cjs');
const KIND = process.env.KIND || 'desktop';
const PREFIX = process.env.PREFIX || '/musicSpace/';
const LABEL = process.env.LABEL || `walk-${KIND}${PREFIX.includes('preview') ? '-preview' : ''}`;
const OUT = mkdir(`/tmp/space-map/shots/verify/${LABEL}`);
const QUERY = process.env.QUERY || '';
const touch = KIND !== 'desktop';
const results = [];
(async () => {
  const browser = await launch();
  const { ctx, page, rec } = await open(browser, KIND, process.env.REDUCED ? { reducedMotion: 'reduce' } : {});
  let n = 0;
  const visibleActions = () => page.$$eval('[data-map-action],[data-open-catalogue],[data-about-sources],.world-music-label,.world-music-link,.world-pin,summary,[data-nav],[data-home],[data-home-start]', els => els.filter(e => e.checkVisibility && e.checkVisibility({ visibilityProperty: true, opacityProperty: true })).map(e => `${e.dataset.mapAction || e.className.split(' ')[0] || e.tagName}: ${(e.getAttribute('aria-label') || e.innerText || '').replace(/\s+/g, ' ').slice(0, 40)}${e.disabled ? ' (disabled)' : ''}`));
  async function snap(name, opts = {}) {
    n += 1;
    await page.waitForTimeout(opts.wait ?? 1100);
    const file = `${OUT}/${String(n).padStart(2, '0')}-${name}.png`;
    await page.screenshot({ path: file, fullPage: false });
    const a = await audit(page);
    a.toast = await page.evaluate(() => document.querySelector('#toast.visible')?.innerText || '');
    const acts = opts.actions === false ? [] : await visibleActions();
    results.push({ n, name, file, ...a, actions: acts });
    const flags = [a.hits.length && `WORDS ${a.hits.join(' | ')}`, a.small.length && `SMALL ${a.small.join(' | ')}`, a.over.length && `OVER ${a.over.join(' | ')}`, Object.keys(a.sysFallback).length && `SYSFONT ${JSON.stringify(a.sysFallback)}`, Object.keys(a.notLoaded).length && `NOTLOADED ${JSON.stringify(a.notLoaded)}`, a.noDoodle.length && `NODOODLE ${a.noDoodle.join(' | ')}`].filter(Boolean);
    console.log(`#${n} ${name} url=${a.url} style=${a.renderStyle} modal=${a.modal || '-'}${a.toast ? ' TOAST=' + a.toast : ''} ${flags.join(' || ')}`);
    if (process.env.VERBOSE) console.log('   ACTIONS:', acts.join(' | ').slice(0, 1800));
    return a;
  }
  async function tap(target, opts = {}) {
    const l = typeof target === 'string' ? page.locator(target).filter({ visible: true }).nth(opts.index || 0) : target;
    await l.waitFor({ state: 'visible', timeout: opts.timeout || 15000 });
    await l.scrollIntoViewIfNeeded({ timeout: 4000 }).catch(() => {});
    try { if (touch) await l.tap({ timeout: 6000 }); else await l.click({ timeout: 6000 }); }
    catch (e) { console.log('   (programmatic click)', String(e.message).split('\n')[0].slice(0, 160)); await l.evaluate(el => el.click()); }
  }
  async function nav(view) {
    const l = page.locator(`[data-nav="${view}"]:not(.brand)`).filter({ visible: true }).first();
    if (await l.count()) return tap(l);
    return tap(`.world-compass [data-world-view="${view}"]`);
  }
  async function step(name, fn, opts) { try { await fn(); return await snap(name, opts); } catch (e) { console.log(`FAIL ${name}: ${String(e.message || e).split('\n')[0].slice(0, 300)}`); results.push({ name, fail: String(e.message || e).slice(0, 400) }); await page.screenshot({ path: `${OUT}/FAIL-${name}.png` }).catch(() => {}); return null; } }
  const base = ORIGIN + PREFIX + 'music-map/' + QUERY;
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForSelector('#sakura-world canvas', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(5000);
  const gl = await page.evaluate(() => { const c = document.createElement('canvas'); const g = c.getContext('webgl2'); if (!g) return 'no webgl2'; const d = g.getExtension('WEBGL_debug_renderer_info'); return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER); });
  console.log('GL', gl);
  await snap('home');
  await step('home-search', async () => { await page.fill('#home-artist-search', '林'); });
  await step('home-search-none', async () => { await page.fill('#home-artist-search', '王菲'); });
  await page.fill('#home-artist-search', '');
  // pick a singer → roam on the full table
  await step('roam-start', async () => { await tap('[data-home-start="real-jj"]'); await page.waitForURL(/#\/explore/); await page.waitForTimeout(3500); }, { wait: 1500 });
  // open the list of duets of the selected singer and the first duet's paper
  await step('roam-index', async () => { const s = page.locator('.map-network-index > summary').filter({ visible: true }).first(); if (await s.count()) await tap(s); });
  await step('duet-paper', async () => { await tap('.map-network-connection'); await page.waitForSelector('dialog.map-dialog[open]'); });
  await step('duet-sources-open', async () => { await tap('dialog[open] details.map-sources > summary'); });
  // 留下 the song from the paper
  await step('duet-save', async () => { await tap('dialog[open] [data-map-action="save"]'); }, { wait: 700 });
  // follow the duet: 前往 X
  await step('duet-move', async () => { await tap('dialog[open] [data-map-action="move"]'); await page.waitForTimeout(2500); }, { wait: 1200 });
  // the scene's record tags and edge tags
  await step('roam-recap', async () => { await tap('[data-map-action="recap"]'); await page.waitForSelector('dialog.map-dialog[open]'); });
  await step('roam-recap-sources', async () => { const s = page.locator('dialog[open] details.map-sources > summary').filter({ visible: true }).first(); if (await s.count()) await tap(s); });
  await step('roam-recap-close', async () => { await tap('dialog[open] [data-map-action="close"]'); });
  await step('artist-songs', async () => { await tap('[data-map-action="artist"]'); await page.waitForSelector('dialog.map-dialog[open]'); });
  await step('artist-credits', async () => { await tap('dialog[open] [data-map-action="credits"]'); });
  await step('artist-close', async () => { await tap('dialog[open] [data-map-action="close"]'); });
  await step('roam-finish', async () => { await tap('[data-map-action="finish"]'); });
  await step('roam-finish-close', async () => { const d = page.locator('dialog[open] [data-map-action="close"]').filter({ visible: true }).first(); if (await d.count()) await tap(d); });
  // 我的发现
  await step('records', async () => { await nav('records'); await page.waitForTimeout(2500); }, { wait: 1200 });
  await step('records-recap', async () => { await tap('.map-record [data-map-action="recap"]'); await page.waitForSelector('dialog.map-dialog[open]'); });
  await step('records-recap-sources', async () => { const s = page.locator('dialog[open] details.map-sources > summary').filter({ visible: true }).first(); if (await s.count()) await tap(s); });
  await step('records-recap-close', async () => { await tap('dialog[open] [data-map-action="close"]'); });
  await step('records-music', async () => { await tap('[data-records-filter="music"]'); });
  await step('records-music-sources', async () => { const s = page.locator('details.map-sources > summary').filter({ visible: true }).first(); if (await s.count()) await tap(s); });
  // 寻声 round in the record shop
  await step('home-again', async () => { await nav('home'); await page.waitForTimeout(2500); }, { wait: 1200 });
  await step('round', async () => { await tap('[data-home="round"]'); await page.waitForURL(/#\/explore/); await page.waitForTimeout(3500); }, { wait: 1200 });
  await step('round-flip', async () => { await tap('[data-map-action="flip"]'); await page.waitForTimeout(800); });
  await step('round-card-sources', async () => { await tap('.map-round-card [data-map-action="edge"]'); await page.waitForSelector('dialog.map-dialog[open]'); });
  await step('round-card-sources-close', async () => { await tap('dialog[open] [data-map-action="close"]'); });
  await step('round-move', async () => { await tap('.map-round-card [data-map-action="move"]'); await page.waitForTimeout(2500); }, { wait: 1200 });
  await step('round-hint', async () => { await tap('[data-map-action="hint"]'); });
  await step('round-menu', async () => { await tap('.map-shop-menu > summary'); });
  await step('round-reveal', async () => { await tap('.map-shop-menu [data-map-action="reveal"]'); await page.waitForSelector('dialog.map-dialog[open]'); });
  await step('round-revealed', async () => { await tap('dialog[open] [data-map-action="reveal-confirm"]'); await page.waitForTimeout(3500); }, { wait: 1500 });
  await step('setlist', async () => { if (!(await page.locator('dialog.map-dialog[open]').count())) await tap('[data-map-action="recap"]'); await page.waitForSelector('dialog.map-dialog[open]'); });
  await step('setlist-sources', async () => { await tap('dialog[open] details.map-sources > summary'); });
  await step('setlist-bottom', async () => { await page.evaluate(() => { const d = document.querySelector('dialog[open] .map-dialog__content') || document.querySelector('dialog[open]'); d.scrollTop = d.scrollHeight; }); });
  await step('setlist-close', async () => { await tap('dialog[open] [data-map-action="close"]'); });
  await step('atlas', async () => { await tap('[data-map-action="return-roam"]'); await page.waitForTimeout(3000); }, { wait: 1200 });
  // 关于 · 数据来源
  await step('about', async () => { await tap('#demo-help'); await page.waitForSelector('#about-dialog[open]'); });
  await step('about-sources', async () => { await page.evaluate(() => document.querySelector('#about-sources').scrollIntoView({ block: 'start' })); });
  await step('about-close', async () => { await tap('#close-about'); });
  // 开放曲库 → 数据来源
  await step('table-tag', async () => { await tap('.world-music-label:not([disabled])', { index: 3 }); await page.waitForTimeout(1200); });
  await step('table-link', async () => { const l = page.locator('.world-music-link').filter({ visible: true }).first(); if (await l.count()) { await tap(l); await page.waitForSelector('dialog.map-dialog[open]'); } else console.log('   no visible edge tag'); });
  await step('table-link-close', async () => { const d = page.locator('dialog[open] [data-map-action="close"]').filter({ visible: true }).first(); if (await d.count()) await tap(d); });
  await step('records-cabinet', async () => { await nav('records'); await page.waitForTimeout(3000); }, { wait: 1200 });
  await step('catalogue', async () => { await nav('home'); await page.waitForTimeout(2000); await tap('[data-home] ~ [data-open-catalogue], .home-paper__foot [data-open-catalogue]'); await page.waitForSelector('dialog[open]'); });
  await step('catalogue-row', async () => { const row = page.locator('dialog[open] details > summary, dialog[open] .open-catalogue__row, dialog[open] [data-open-track]').filter({ visible: true }).first(); if (await row.count()) await tap(row); });
  await step('catalogue-to-sources', async () => { await tap('dialog[open] [data-about-sources]'); await page.waitForSelector('#about-dialog[open]'); });
  await step('catalogue-about-close', async () => { await tap('#close-about'); });
  // back to the room
  await step('home-pin', async () => { await nav('home'); await page.waitForTimeout(2500); });
  await step('pin-to-shop', async () => { await tap('.world-pin'); await page.waitForTimeout(3500); }, { wait: 1200 });
  await step('back-to-room', async () => { await Promise.all([page.waitForURL(u => !String(u).includes('music-map'), { timeout: 20000 }), tap('.space-map-back')]); await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 60000 }); await page.waitForTimeout(2000); }, { actions: false });
  const summary = { kind: KIND, prefix: PREFIX, gl, console: rec.console, pageerrors: rec.pageerrors, failed: rec.failed, bad: rec.bad, outside: outside(rec), popups: rec.popups, fontsRequested: [...new Set(rec.requests.filter(u => u.includes('/fonts/doodle/')).map(u => u.replace(ORIGIN, '')))] };
  console.log('SUMMARY', JSON.stringify(summary, null, 1));
  fs.writeFileSync(`${OUT}/results.json`, JSON.stringify({ summary, results }, null, 1));
  await ctx.close(); await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
