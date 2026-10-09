// Play the default round to the end with hints ② (费玉清 → 邓紫棋), shoot the arrival ceremony and the arrived setlist.
const { launch, open, audit, ORIGIN, mkdir } = require('./lib.cjs');
const OUT = mkdir('/tmp/space-map/shots/verify/solve');
(async () => {
  const browser = await launch();
  for (const kind of ['phone', 'desktop']) {
    const { ctx, page, rec } = await open(browser, kind);
    const touch = kind !== 'desktop';
    const tap = async (sel, i = 0) => { const l = typeof sel === 'string' ? page.locator(sel).filter({ visible: true }).nth(i) : sel; await l.waitFor({ state: 'visible', timeout: 10000 }); await l.scrollIntoViewIfNeeded().catch(() => {}); if (touch) await l.tap(); else await l.click(); };
    await page.goto(ORIGIN + '/musicSpace/music-map/#/explore', { waitUntil: 'load' }); await page.waitForSelector('#sakura-world canvas'); await page.waitForTimeout(4000);
    for (let step = 0; step < 8; step++) {
      const closed = await page.locator('.map-round-hand--closed').count();
      if (closed) break;
      // take hints until a card is hinted (② pencils a card or says go back)
      for (let k = 0; k < 2; k++) {
        if (await page.locator('.map-round-card.is-hinted').count()) break;
        const label = await page.locator('[data-map-action="hint"]').first().getAttribute('aria-label');
        if (/第三级/.test(label)) break;
        await tap('[data-map-action="hint"]'); await page.waitForTimeout(900);
      }
      const card = page.locator('.map-round-card.is-hinted').first();
      if (!(await card.count())) { console.log(kind, 'no hinted card at step', step); break; }
      if (await card.locator('[data-map-action="flip"]').count()) { await tap(card.locator('[data-map-action="flip"]')); await page.waitForTimeout(900); }
      if (step === 1) await page.screenshot({ path: `${OUT}/${kind}-hint2.png` });
      const go = page.locator('.map-round-card.is-hinted [data-map-action="move"], .map-round-card [data-map-action="move"].is-target').first();
      await tap(go); await page.waitForTimeout(2500);
    }
    // arrival ceremony frames
    await page.screenshot({ path: `${OUT}/${kind}-arrived-0.png` });
    await page.waitForTimeout(1500); await page.screenshot({ path: `${OUT}/${kind}-arrived-1.png` });
    await page.waitForTimeout(2500); await page.screenshot({ path: `${OUT}/${kind}-arrived-2.png` });
    const a = await audit(page);
    console.log(kind, 'after arrival modal=' + (a.modal || '-'), 'text:', a.text.replace(/\s+/g, ' ').slice(0, 260), a.small.length ? 'SMALL ' + a.small.join(' | ') : '', a.over.length ? 'OVER ' + a.over.join(' | ') : '', Object.keys(a.sysFallback).length ? 'SYS ' + JSON.stringify(a.sysFallback) : '');
    const ceremony = page.locator('[data-map-action="ceremony-done"]').filter({ visible: true }).first();
    if (await ceremony.count()) { await tap(ceremony); await page.waitForTimeout(2000); }
    if (!(await page.locator('dialog.map-dialog[open]').count())) { const r = page.locator('[data-map-action="recap"]').filter({ visible: true }).first(); if (await r.count()) { await tap(r); await page.waitForTimeout(1500); } }
    await page.screenshot({ path: `${OUT}/${kind}-setlist-arrived.png` });
    const b = await audit(page); console.log(kind, 'setlist', b.modal, b.text.replace(/\s+/g, ' ').slice(0, 200));
    console.log(kind, 'errors', JSON.stringify({ c: rec.console, p: rec.pageerrors, f: rec.failed }));
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
