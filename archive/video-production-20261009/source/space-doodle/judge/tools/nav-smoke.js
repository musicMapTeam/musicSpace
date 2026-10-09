// Top bar and bottom nav entries after joining: each opens something, no console errors, no /api, no 404, no external hosts.
const L = require('./lib.js');
const vp = process.argv[2] || 'phone';
const channel = process.argv[3] || 'root';
(async () => {
  const browser = await L.launch();
  const run = await L.open(browser, vp, { label: `nav-${channel}-${vp}` });
  const { page } = run;
  const say = (k, v) => console.log(k, '=>', typeof v === 'string' ? v : JSON.stringify(v));
  const t = async sel => { const l = page.locator(sel).first(); await l.waitFor({ state: 'visible', timeout: 45000 }); await l.click(); };
  const openState = () => page.evaluate(() => {
    const vis = s => { const e = document.querySelector(s); return !!e && !e.hidden && e.getClientRects().length > 0; };
    return { panel: vis('#panel') ? document.querySelector('#panel').dataset.kind : null, chat: vis('.private-chat'), exchanges: vis('.photo-exchanges'), dialogs: [...document.querySelectorAll('[role=dialog]')].filter(d => !d.hidden && d.getClientRects().length).map(d => d.getAttribute('aria-label') || d.className).slice(0, 4), heading: (document.querySelector('#panel:not([hidden]) h2, [role=dialog]:not([hidden]) h2')?.textContent || '').trim().slice(0, 40), url: location.pathname + location.search + location.hash };
  });
  const closeAll = async () => {
    await page.keyboard.press('Escape').catch(() => {});
    await L.sleep(400);
    for (const sel of ['#panel-close', '.chat-close', '.photo-exchanges [data-x-close]', '.wardrobe-header button', '[data-close]', '[aria-label^="关闭"]']) {
      const l = page.locator(sel).filter({ visible: true }).first();
      if (await l.count().catch(() => 0)) { await l.click().catch(() => {}); await L.sleep(400); }
    }
  };
  try {
    await L.boot(page, L.baseUrl(channel));
    await t('#join');
    await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"] button[type="submit"]')?.disabled, null, { timeout: 60000 });
    await page.check('form[data-form="demo-entry"] input[name="consent"]');
    await t('form[data-form="demo-entry"] button[type="submit"]');
    await page.waitForFunction(() => document.querySelector('.frame')?.dataset.stage === 'room', null, { timeout: 30000 });
    await L.sleep(2000);
    for (const [name, sel] of [['同场的人', '.camera-nav [data-view="person"]'], ['照片墙', '.camera-nav [data-view="photos"]'], ['我的空间', '#my-space'], ['♡', '#social-inbox'], ['我的小人', '#my-look'], ['···', '#room-info'], ['footer about', '#evidence button']]) {
      const before = run.consoleMsgs.length + run.pageErrors.length;
      try { await t(sel); } catch (e) { say(name, `CLICK FAILED ${e.message.split('\n')[0]}`); continue; }
      await L.sleep(2500);
      say(name, { ...(await openState()), newErrors: run.consoleMsgs.length + run.pageErrors.length - before });
      await L.shot(run, name.replace(/[^\w]/g, '') || 'x' + Buffer.from(name).toString('hex').slice(0, 6));
      await closeAll();
    }
    // 音乐探索 navigates away to music-map/
    const nav = page.waitForNavigation({ timeout: 20000 }).catch(() => null);
    await t('#music-map-entry');
    await nav;
    await L.sleep(4000);
    say('音乐探索', { url: page.url(), title: await page.title(), body: (await page.evaluate(() => document.body.innerText.trim().replace(/\s+/g, ' ').slice(0, 120))) });
    await L.shot(run, 'musicmap');
  } catch (e) { say('FAILED', e.message.split('\n')[0]); }
  say('console', run.consoleMsgs.map(c => `${c.type}: ${c.text.slice(0, 200)} @${c.loc}`));
  say('pageErrors', run.pageErrors);
  const net = L.summarizeNet(run); say('net', { total: net.total, api: net.api.map(r => r.url), external: net.external.map(r => r.url), bad: net.bad.map(r => `${r.status} ${r.url} ${r.failure || ''}`) });
  await browser.close();
})();
