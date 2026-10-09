// walk4: loading screen (venue GLB held back), WebGL error state, read-only second tab banner, offline connection banner, room-menu/rooms.
// usage: node walk4.cjs <phone|desktop>
const L = require('./lib.cjs');
L.watchdog(240);
const kind = process.argv[2] || 'phone';
(async () => {
  const b = await L.launch();
  // 1) loading: hold the GLB for 6 s
  {
    const ctx = await b.newContext({ ...L.VP[kind] });
    const page = await ctx.newPage();
    await page.route(/venue\.glb/, async route => { await L.sleep(7000); await route.continue(); });
    await page.goto(L.URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => { const l = document.querySelector('#loading'); return l && !l.hidden; }, null, { timeout: 30000 }).catch(() => {});
    await page.evaluate(() => document.fonts.ready).catch(() => {});
    await L.sleep(2500);
    const vis = await page.evaluate(() => !document.querySelector('#loading')?.hidden);
    console.log('loading visible', vis);
    await L.shot(page, 'f01-loading', kind, { settle: 0 });
    await ctx.close();
  }
  // 2) error state: no WebGL
  {
    const ctx = await b.newContext({ ...L.VP[kind] });
    await ctx.addInitScript(() => { const orig = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { if (/webgl/i.test(String(t))) return null; return orig.call(this, t, ...a); }; });
    const page = await ctx.newPage();
    await page.goto(L.URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 60000 }).catch(() => {});
    await L.sleep(3000);
    await L.shot(page, 'f02-webgl-error', kind);
    await ctx.close();
  }
  // 3) read-only second tab + offline banner in the first
  {
    const ctx = await b.newContext({ ...L.VP[kind] });
    const page = await ctx.newPage();
    await page.goto(L.URL, { waitUntil: 'domcontentloaded' });
    await L.ready(page);
    await L.enter(page);
    const p2 = await ctx.newPage();
    await p2.goto(L.URL, { waitUntil: 'domcontentloaded' });
    await p2.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 60000 }).catch(() => {});
    await L.sleep(3500);
    await p2.bringToFront();
    await L.shot(p2, 'f03-readonly-tab', kind);
    await p2.close();
    await page.bringToFront();
    await L.sleep(800);
    // offline banner (connection state) — simulate by going offline
    await ctx.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await L.sleep(7000);
    await L.shot(page, 'f04-offline', kind);
    await ctx.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await L.sleep(500);
    // the room panel (···) and "我的现场"
    await page.click('#room-info').catch(() => {});
    await L.sleep(1200);
    await page.evaluate(() => { const p = document.querySelector('#panel-body'); if (p) p.scrollTop = p.scrollHeight; });
    await L.shot(page, 'f05-room-menu-end', kind, { scope: '#panel' });
    await L.openKind(page, 'rooms');
    await L.sleep(1200);
    await L.shot(page, 'f06-my-rooms', kind, { scope: '#panel' });
    await L.closeEverything(page);
    // 我的空间 on its own
    await page.click('#my-space').catch(() => {});
    await L.sleep(2500);
    await L.shot(page, 'f07-my-space', kind);
    await page.evaluate(() => { const s = [...document.querySelectorAll('.personal-space .community-scroll')].pop(); if (s) s.scrollTop = 520; });
    await L.sleep(600);
    await L.shot(page, 'f08-my-space-mid', kind);
    await ctx.close();
  }
  await b.close();
})();
