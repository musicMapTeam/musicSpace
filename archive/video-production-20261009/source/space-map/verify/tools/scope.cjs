// Opened from a chat song: the masthead's 「这首歌」, the draft buttons under a song, and the way back. 390 and 320.
const { launch, open, audit, ORIGIN, mkdir } = require('./lib.cjs');
const OUT = mkdir('/tmp/space-map/shots/verify/scope');
(async () => {
  const browser = await launch();
  for (const kind of ['phone', 'w320', 'desktop']) {
    const { ctx, page, rec } = await open(browser, kind);
    await ctx.addInitScript(() => { if (!sessionStorage.getItem('music-space-map-return:v1')) sessionStorage.setItem('music-space-map-return:v1', JSON.stringify({ actor: 'u1', view: null, scope: { kind: 'chat', id: 'c1' }, returnUrl: '/musicSpace/', recordingId: 'real-hello' })); });
    await page.goto(ORIGIN + '/musicSpace/music-map/#/explore', { waitUntil: 'load' }); await page.waitForTimeout(4500);
    await page.screenshot({ path: `${OUT}/${kind}-landing.png` });
    let a = await audit(page);
    console.log(kind, 'landing', a.small.length ? 'SMALL ' + a.small.join(' | ') : '', a.over.length ? 'OVER ' + a.over.join(' | ') : '', 'masthead:', await page.evaluate(() => document.querySelector('.app-masthead').innerText.replace(/\s+/g, ' ')));
    const ctxBtn = page.locator('.space-map-context');
    if (kind === 'desktop') await ctxBtn.click(); else await ctxBtn.tap();
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `${OUT}/${kind}-this-song.png` });
    a = await audit(page);
    console.log(kind, 'after 这首歌', a.url, 'title', await page.evaluate(() => document.querySelector('.map-studio-title h1, .map-round-slip h1, h1')?.innerText), a.small.length ? 'SMALL ' + a.small.join(' | ') : '', a.over.length ? 'OVER ' + a.over.join(' | ') : '');
    // open TA 的歌 to see draft buttons under songs
    const ta = page.locator('[data-map-action="artist"]').filter({ visible: true }).first();
    if (await ta.count()) { if (kind === 'desktop') await ta.click(); else await ta.tap(); await page.waitForSelector('dialog[open]'); await page.waitForTimeout(800); }
    await page.screenshot({ path: `${OUT}/${kind}-drafts.png` });
    a = await audit(page);
    console.log(kind, 'drafts', await page.locator('dialog[open] .space-map-draft button').count(), 'draft buttons;', a.small.length ? 'SMALL ' + a.small.join(' | ') : '', a.over.length ? 'OVER ' + a.over.join(' | ') : '', a.hits.length ? 'WORDS ' + a.hits.join(' | ') : '');
    console.log('   errors', JSON.stringify({ c: rec.console, p: rec.pageerrors, f: rec.failed }));
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
