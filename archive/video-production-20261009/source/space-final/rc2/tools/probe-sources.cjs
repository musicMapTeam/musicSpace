// Opens the 来源 of the two 五月天 live recordings whose full label carries an open check (「（未核对…）」) and dumps what it prints.
//   node probe-sources.cjs <phone|desktop> <siteBaseUrl> <outDir>
const { launch, openContext, act, dump, sleep, mkdir, fs } = require('./lib.cjs');
const [kind = 'desktop', BASE = 'http://127.0.0.1:4783/musicSpace/', OUT_ARG] = process.argv.slice(2);
const OUT = mkdir(OUT_ARG || `/tmp/space-final/rc2/probe-sources/${kind}`);
(async () => {
  const browser = await launch();
  const { ctx, page, rec } = await openContext(browser, kind, BASE);
  const tap = (t, l) => act(page, kind, t, l, rec, { timeout: 10000 });
  const out = {};
  await page.goto(BASE + 'music-map/', { waitUntil: 'load' });
  await page.waitForSelector('#sakura-world canvas', { timeout: 30000 }).catch(() => {});
  await sleep(4000);
  await page.fill('#home-artist-search', '五月天');
  await sleep(600);
  await tap('[data-home-start="real-mayday"]', '五月天');
  await page.waitForURL(/#\/explore/);
  await sleep(3500);
  const index = page.locator('.map-network-index > summary').filter({ visible: true }).first();
  if (await index.count()) { await tap(index, 'N 条连接'); await sleep(800); }
  for (const title of ['离开地球表面', '你不是真正的快乐']) {
    const row = page.locator('.map-network-connection').filter({ hasText: title }).first();
    await row.scrollIntoViewIfNeeded().catch(() => {});
    await tap(row, title);
    await page.waitForSelector('dialog.map-dialog[open]', { timeout: 10000 });
    await sleep(600);
    const main = await page.evaluate(() => document.querySelector('dialog.map-dialog[open]')?.innerText || '');
    await tap('dialog[open] details.map-sources > summary', '来源');
    await sleep(900);
    const d = await dump(page);
    const src = await page.evaluate(() => document.querySelector('dialog.map-dialog[open] details.map-sources')?.innerText || '');
    out[title] = { paperWithoutSources: main, sources: src, hitInBody: /核对/.test(d.body) };
    await page.evaluate(() => document.querySelector('dialog.map-dialog[open] details.map-sources')?.scrollIntoView({ block: 'center' }));
    await sleep(400);
    await page.screenshot({ path: `${OUT}/${title}.png` });
    await tap('dialog[open] [data-map-action="close"]', 'close');
    await sleep(700);
    const idx = page.locator('.map-network-index:not([open]) > summary').filter({ visible: true }).first();
    if (await idx.count()) { await tap(idx, 'N 条连接'); await sleep(600); }
  }
  fs.writeFileSync(`${OUT}/sources.json`, JSON.stringify({ out, console: rec.console, pageErrors: rec.pageErrors, failed: rec.failed }, null, 1));
  for (const [t, v] of Object.entries(out)) console.log(`== ${t}: 核对 on screen with 来源 open: ${v.hitInBody}; on the paper before 来源: ${/核对/.test(v.paperWithoutSources)}\n${v.sources.replace(/\n+/g, ' | ')}`);
  await browser.close();
})().catch(e => { console.error('FATAL', e.message.split('\n')[0]); process.exit(1); });
