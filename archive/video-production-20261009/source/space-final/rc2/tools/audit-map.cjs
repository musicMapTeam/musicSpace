// Text audit walk of 音乐探索 (music-map/), fresh context, direct visit: 小院 → search → 图鉴 → a duet paper → 来源 → 留下 → 前往 →
// 本次发现 → artist/credits → 探索回顾 → 我的发现 (both tabs) → 寻声 round (翻开, card 来源, 前往, 提示, 目录, 揭晓) → 连线歌单 → 图鉴 → 关于 ·
// 数据来源 → 开放曲库 → ← 返回现场. Dumps the text of every state.
//   node audit-map.cjs <phone|desktop> <siteBaseUrl> <outDir> [shotDir]
const { launch, openContext, act, dump, sleep, mkdir, fs } = require('./lib.cjs');
const [kind = 'phone', BASE = 'http://127.0.0.1:4783/musicSpace/', OUT_ARG, SHOT_DIR] = process.argv.slice(2);
const OUT = mkdir(OUT_ARG || `/tmp/space-final/rc2/audit-map/${kind}`);
const MAP = BASE + 'music-map/';
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
const report = { kind, base: BASE, states: {}, misses: [], shots: [] };
let browser, rec, n = 0;
const watchdog = setTimeout(() => { log('WATCHDOG'); finish(3); }, 285000); watchdog.unref();
async function finish(code) {
  if (rec) { const { setPhase, ...plain } = rec; report.rec = plain; }
  fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
  try { await browser?.close(); } catch {}
  process.exit(code);
}

(async () => {
  browser = await launch();
  const o = await openContext(browser, kind, BASE);
  const { ctx, page } = o; rec = o.rec;
  const tap = (target, label, opts) => act(page, kind, target, label, rec, { timeout: 10000, ...opts });
  const vis = sel => page.locator(sel).filter({ visible: true }).first();
  async function state(label, shotName, wait = 1000) {
    n += 1;
    await sleep(wait);
    const d = await dump(page);
    d.toast = await page.evaluate(() => document.querySelector('#toast.visible, .toast.visible')?.innerText || '');
    const key = `${String(n).padStart(2, '0')}-${label}`;
    report.states[key] = d;
    await page.screenshot({ path: `${OUT}/${key}.png` });
    if (SHOT_DIR && shotName) { const f = `${SHOT_DIR}/${kind}-${shotName}.png`; await page.screenshot({ path: f }); report.shots.push(f); }
    log('state', key, d.modal ? `modal=${d.modal}` : '', d.toast ? `toast=${d.toast}` : '', Object.keys(d.sysFallback).length ? `SYSFONT ${JSON.stringify(d.sysFallback)}` : '');
    return d;
  }
  async function visit(label, fn, shotName, wait) {
    try { rec.setPhase(label); await fn(); return await state(label, shotName, wait); }
    catch (e) { const why = String(e.message || e).split('\n')[0].slice(0, 200); report.misses.push(`${label}: ${why}`); log('MISS', label, why); await page.screenshot({ path: `${OUT}/MISS-${label}.png` }).catch(() => {}); return null; }
  }
  async function nav(view) {
    const l = page.locator(`[data-nav="${view}"]:not(.brand)`).filter({ visible: true }).first();
    if (await l.count()) return tap(l, `nav ${view}`);
    return tap(`.world-compass [data-world-view="${view}"]`, `compass ${view}`);
  }
  const dialogOpen = () => page.waitForSelector('dialog.map-dialog[open], dialog[open]', { timeout: 10000 });
  const closePaper = async () => { const c = vis('dialog[open] [data-map-action="close"]'); if (await c.count()) { await tap(c, 'close paper'); await sleep(500); } };

  rec.setPhase('home');
  await page.goto(MAP, { waitUntil: 'load' });
  await page.waitForSelector('#sakura-world canvas', { timeout: 30000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await sleep(5000);
  report.gl = await page.evaluate(() => { const c = document.createElement('canvas'); const g = c.getContext('webgl2'); if (!g) return 'no webgl2'; const d = g.getExtension('WEBGL_debug_renderer_info'); return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER); });
  report.firstScreenFonts = rec.fonts.filter(f => f.phase === 'home').map(f => `${f.file} ${f.bytes}`);
  await state('home', 'map-00-home');
  await visit('home-search', async () => { await page.fill('#home-artist-search', '林'); });
  await visit('home-search-none', async () => { await page.fill('#home-artist-search', '王菲'); });
  await page.fill('#home-artist-search', '').catch(() => {});
  await visit('roam-start', async () => { await tap('[data-home-start="real-jj"]', 'pick 林俊杰'); await page.waitForURL(/#\/explore/); await sleep(3500); }, null, 1500);
  await visit('roam-index', async () => { const s = vis('.map-network-index > summary'); if (await s.count()) await tap(s, 'N 条连接'); else throw new Error('no connection index'); });
  await visit('duet-paper', async () => { await tap('.map-network-connection', 'a duet'); await dialogOpen(); });
  await visit('duet-sources-open', async () => { await tap('dialog[open] details.map-sources > summary', '来源'); });
  await visit('duet-save', async () => { await tap('dialog[open] [data-map-action="save"]', '留下'); }, null, 700);
  await visit('duet-move', async () => { await tap('dialog[open] [data-map-action="move"]', '前往'); await sleep(2500); }, null, 1200);
  await visit('roam-recap', async () => { await tap('[data-map-action="recap"]', '本次发现'); await dialogOpen(); });
  await visit('roam-recap-sources', async () => { const s = vis('dialog[open] details.map-sources > summary'); if (await s.count()) await tap(s, '来源'); else throw new Error('no 来源 in 本次发现'); });
  await closePaper();
  await visit('artist-songs', async () => { await tap('[data-map-action="artist"]', '作品'); await dialogOpen(); });
  await visit('artist-credits', async () => { await tap('dialog[open] [data-map-action="credits"]', '作品署名'); });
  await closePaper();
  await visit('search-paper', async () => { const b = vis('[data-map-action="search"]'); if (!(await b.count())) throw new Error('no 找音乐人'); await tap(b, '找音乐人'); await dialogOpen(); });
  await closePaper();
  await visit('roam-finish', async () => { await tap('[data-map-action="finish"]', '结束'); });
  await closePaper();
  await visit('records', async () => { await nav('records'); await sleep(2500); }, 'map-03-my-discoveries', 1200);
  await visit('records-recap', async () => { await tap('.map-record [data-map-action="recap"]', 'record'); await dialogOpen(); });
  await visit('records-recap-sources', async () => { const s = vis('dialog[open] details.map-sources > summary'); if (await s.count()) await tap(s, '来源'); else throw new Error('no 来源'); });
  await closePaper();
  await visit('records-music', async () => { await tap('[data-records-filter="music"]', '留下的歌'); }, 'map-03b-my-discoveries-songs');
  await visit('records-music-sources', async () => { const s = vis('details.map-sources > summary'); if (await s.count()) await tap(s, '来源'); else throw new Error('no 来源'); });
  await visit('home-again', async () => { await nav('home'); await sleep(2500); }, null, 1200);
  await visit('round', async () => { await tap('[data-home="round"]', '寻声'); await page.waitForURL(/#\/explore/); await sleep(3500); }, null, 1200);
  await visit('round-flip', async () => { await tap('[data-map-action="flip"]', '翻开'); await sleep(800); });
  await visit('round-card-sources', async () => { await tap('.map-round-card [data-map-action="edge"]', 'card 来源'); await dialogOpen(); });
  await closePaper();
  await visit('round-move', async () => { await tap('.map-round-card [data-map-action="move"]', '前往'); await sleep(2500); }, null, 1200);
  await visit('round-hint', async () => { await tap('[data-map-action="hint"]', '提示'); });
  await visit('round-menu', async () => { await tap('.map-shop-menu > summary', '目录'); });
  await visit('round-reveal', async () => { await tap('.map-shop-menu [data-map-action="reveal"]', '揭晓'); await dialogOpen(); });
  await visit('round-revealed', async () => { await tap('dialog[open] [data-map-action="reveal-confirm"]', '揭晓答案'); await sleep(3500); }, null, 1500);
  await visit('setlist', async () => { if (!(await page.locator('dialog.map-dialog[open]').count())) await tap('[data-map-action="recap"]', '连线歌单'); await dialogOpen(); });
  await visit('setlist-sources', async () => { await tap('dialog[open] details.map-sources > summary', '来源'); });
  await visit('setlist-bottom', async () => { await page.evaluate(() => { const d = document.querySelector('dialog[open] .map-dialog__content') || document.querySelector('dialog[open]'); d.scrollTop = d.scrollHeight; }); });
  await closePaper();
  await visit('round-closed-bar', async () => { await sleep(500); });
  await visit('share-challenge', async () => { const b = vis('[data-map-action="share-round"]'); if (!(await b.count())) throw new Error('no 出题给朋友'); await tap(b, '出题给朋友'); await sleep(1500); });
  await closePaper(); await page.keyboard.press('Escape').catch(() => {}); await sleep(400);
  await visit('save-card', async () => { const b = vis('[data-map-action="save-card"]'); if (!(await b.count())) throw new Error('no 保存战绩卡'); await tap(b, '保存战绩卡'); await sleep(2500); });
  await page.keyboard.press('Escape').catch(() => {}); await sleep(500); await closePaper();
  await visit('atlas', async () => { const b = vis('[data-map-action="return-roam"], [data-map-action="atlas"]'); if (!(await b.count())) throw new Error('no 完整图鉴'); await tap(b, '完整图鉴'); await sleep(3000); }, null, 1200);
  await visit('about', async () => { await tap('#demo-help', '关于音乐探索'); await page.waitForSelector('#about-dialog[open]'); });
  await visit('about-sources', async () => { await page.evaluate(() => document.querySelector('#about-sources').scrollIntoView({ block: 'start' })); });
  await visit('about-close', async () => { await tap('#close-about', '关闭'); });
  await visit('table-tag', async () => { await tap('.world-music-label:not([disabled])', 'table tag', { index: 3 }); await sleep(1200); });
  await visit('table-link', async () => { const l = vis('.world-music-link'); if (!(await l.count())) throw new Error('no visible edge tag'); await tap(l, 'edge tag'); await dialogOpen(); });
  await closePaper();
  await visit('catalogue', async () => { await nav('home'); await sleep(2000); await tap('[data-home] ~ [data-open-catalogue], .home-paper__foot [data-open-catalogue], [data-open-catalogue]', '开放曲库'); await page.waitForSelector('dialog[open]'); });
  await visit('catalogue-row', async () => { const row = vis('dialog[open] details > summary, dialog[open] .open-catalogue__row, dialog[open] [data-open-track]'); if (await row.count()) await tap(row, 'row'); else throw new Error('no row'); });
  await visit('catalogue-to-sources', async () => { await tap('dialog[open] [data-about-sources]', '数据来源'); await page.waitForSelector('#about-dialog[open]'); });
  await visit('catalogue-about-close', async () => { await tap('#close-about', '关闭'); });
  await visit('friend-link', async () => { rec.setPhase('friend-link'); await page.goto(MAP + '?from=real-jj&to=real-gem#/explore', { waitUntil: 'load' }); await sleep(4500); }, null, 1200);
  await visit('back-to-room', async () => { await Promise.all([page.waitForURL(u => !String(u).includes('music-map'), { timeout: 20000 }), tap('.space-map-back', '← 返回现场')]); await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 60000 }); await sleep(2000); });
  rec.setPhase('end');
  await ctx.close();
  log('done', `GL ${report.gl}; ${Object.keys(report.states).length} states, ${report.misses.length} misses; /api ${rec.api.length}, third-party ${rec.thirdParty.length}, outside ${rec.outsidePrefix.length}, failed ${rec.failed.length}, HTTP>=400 ${rec.badStatus.length}, console ${rec.console.length}, page errors ${rec.pageErrors.length}`);
  await finish(0);
})().catch(async e => { log('FATAL', String(e.message).split('\n')[0]); await finish(1); });
