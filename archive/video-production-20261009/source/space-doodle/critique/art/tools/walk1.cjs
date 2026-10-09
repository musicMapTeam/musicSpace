// walk1: loading, first screen, join form, room (3 camera views, panels closed and open), route card step 1 expanded/collapsed.
// usage: node walk1.cjs <phone|desktop|narrow>
const L = require('./lib.cjs');
L.watchdog(280);
const kind = process.argv[2] || 'phone';
(async () => {
  const b = await L.launch();
  const { ctx, page } = await L.open(b, kind, { waitReady: false });
  try {
    // loading: grab it as early as possible
    for (let i = 0; i < 12; i++) {
      const vis = await page.evaluate(() => { const l = document.querySelector('#loading'); return !!l && !l.hidden && getComputedStyle(l).display !== 'none' && document.fonts.status; }).catch(() => false);
      if (vis) { await page.waitForTimeout(i === 0 ? 350 : 0); await L.shot(page, 'a01-loading', kind, { settle: 0, audit: false }); break; }
      await L.sleep(120);
    }
    await L.ready(page);
    await L.shot(page, 'a02-first-screen', kind);
    if (kind === 'phone') await L.shot(page, 'a02b-first-screen-full', kind, { fullPage: true, audit: false });
    // join form
    await page.locator('button:visible', { hasText: '进入示例现场' }).first().click();
    await page.waitForSelector('form[data-form="demo-entry"]', { timeout: 20000 });
    await L.sleep(800);
    await L.shot(page, 'a03-join-form', kind, { scope: '#panel' });
    await page.evaluate(() => { const p = document.querySelector('#panel-body'); if (p) p.scrollTop = p.scrollHeight; document.querySelector('#panel')?.scrollTo?.(0, 99999); });
    await page.locator('form[data-form="demo-entry"] input[name=consent]').check();
    await page.waitForSelector('form[data-form="demo-entry"] button[type=submit]:not([disabled])', { timeout: 60000 });
    await L.sleep(400);
    await L.shot(page, 'a04-join-form-ready', kind, { scope: '#panel' });
    await page.locator('form[data-form="demo-entry"] button[type=submit]').click();
    // try to catch the toast right after entering
    for (let i = 0; i < 20; i++) { const t = await page.evaluate(() => { const n = document.querySelector('#toast'); return n && n.classList.contains('visible') ? n.textContent : ''; }); if (t) { console.log('toast:', t); await L.shot(page, 'a05-toast-after-join', kind, { settle: 250 }); break; } await L.sleep(200); }
    await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"]'), null, { timeout: 60000 });
    await page.waitForFunction(() => (window.__SPACE_EVENT_QA__?.()?.members || []).length > 1, null, { timeout: 30000 }).catch(() => console.log('members never arrived'));
    await L.sleep(3000);
    console.log('render', await page.evaluate(() => { const s = window.__SPACE_EVENT_QA__?.()?.camera?.scene; return s && JSON.stringify({ st: s.renderStyle, v: s.venueAsset?.status }); }));
    await L.shot(page, 'a06-room-overview-tour1', kind);
    // collapse the route card
    const tog = page.locator('[data-tour-toggle]');
    if (await tog.count()) { await tog.first().click(); await L.sleep(700); await L.shot(page, 'a07-room-overview-tour-collapsed', kind); await tog.first().click(); await L.sleep(500); }
    // camera: 同场的人
    await page.click('nav.camera-nav button[data-view=person]');
    await L.sleep(2600);
    await L.shot(page, 'a08-view-person-panel', kind);
    if (await page.isVisible('#panel-close')) { await page.click('#panel-close').catch(() => {}); await L.sleep(1800); }
    await L.shot(page, 'a09-view-person', kind);
    // camera: 照片墙
    await page.click('nav.camera-nav button[data-view=photos]');
    await L.sleep(2600);
    await L.shot(page, 'a10-view-photos-panel', kind);
    if (await page.isVisible('#panel-close')) { await page.click('#panel-close').catch(() => {}); await L.sleep(1800); }
    await L.shot(page, 'a11-view-photos', kind);
    // back to overview
    await page.click('nav.camera-nav button[data-view=overview]');
    await L.sleep(2600);
    await L.shot(page, 'a12-view-overview', kind);
    // room menu (···)
    await page.click('#room-info').catch(() => {});
    await L.sleep(1200);
    await L.shot(page, 'a13-room-menu', kind);
    await L.closeEverything(page);
    // about (footer button)
    await L.openKind(page, 'about');
    await L.sleep(800);
    await L.shot(page, 'a14-about', kind, { scope: '#panel' });
    await page.evaluate(() => { const p = document.querySelector('#panel-body'); if (p) p.scrollTop = p.scrollHeight; document.querySelector('#panel')?.scrollTo?.(0, 99999); });
    await L.shot(page, 'a15-about-end', kind, { scope: '#panel' });
    console.log('logs', JSON.stringify(page.__logs.slice(0, 10)));
  } catch (e) { console.error('ERR', e.message.split('\n')[0]); await page.screenshot({ path: `${L.OUT}/ERR-walk1-${kind}.png` }).catch(() => {}); }
  await b.close();
})();
