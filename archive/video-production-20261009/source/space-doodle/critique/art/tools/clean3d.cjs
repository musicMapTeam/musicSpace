// clean3d: the 3D look on its own (overlays hidden) in the 3 views, plus a 2x crop for hatching/outline quality.
// usage: node clean3d.cjs <phone|desktop>
const L = require('./lib.cjs');
L.watchdog(200);
const kind = process.argv[2] || 'desktop';
(async () => {
  const b = await L.launch();
  const { page } = await L.open(b, kind);
  try {
    await L.enter(page);
    const skip = page.locator('button:visible', { hasText: '跳过路线' }); if (await skip.count()) await skip.first().click().catch(() => {});
    await L.sleep(1500);
    const hide = async on => page.evaluate(on => { let st = document.getElementById('clean3d'); if (on && !st) { st = document.createElement('style'); st.id = 'clean3d'; st.textContent = '#app .frame > *:not(.world-shell), .world-shell > *:not(#world), .desktop-caption, #toast, #connection-banner, #panel { visibility:hidden !important }'; document.head.append(st); } if (!on && st) st.remove(); }, on);
    for (const view of ['overview', 'person', 'photos']) {
      if (view === 'person') {
        await page.click('nav.camera-nav button[data-view=person]');
        await page.waitForSelector('#panel-body [data-person]', { timeout: 10000 }).catch(() => {});
        const own = await page.evaluate(() => window.__SPACE_EVENT_QA__?.()?.actorId);
        const ids = await page.$$eval('#panel-body [data-person]', els => els.map(e => e.dataset.person)).catch(() => []);
        const target = ids.find(id => id !== own) || ids[0];
        if (target) await page.click(`#panel-body [data-person="${target}"]`).catch(() => {});
        await L.sleep(2500);
        if (await page.isVisible('#panel-close')) await page.click('#panel-close').catch(() => {});
      } else { await page.click(`nav.camera-nav button[data-view=${view}]`); await L.sleep(2500); if (await page.isVisible('#panel-close')) await page.click('#panel-close').catch(() => {}); }
      await L.sleep(1800);
      await hide(true);
      await L.shot(page, `d-clean-${view}`, kind, { audit: false, settle: 300 });
      await hide(false);
    }
  } catch (e) { console.error('ERR', e.message.split('\n')[0]); }
  await b.close();
})();
