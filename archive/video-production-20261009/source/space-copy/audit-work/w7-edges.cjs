// W7: read-only second tab, memory-only storage, AI unavailable, rescue overlay (+ the classic page it links), no JavaScript, 音乐探索.
const L = require('./lib.cjs');
L.watchdog(290);
const vp = process.argv[2] || 'phone';
const which = process.argv[3] || 'readonly';
L.setCorpus(`w7-${vp}-${which}`);
(async () => {
  const browser = await L.launch();
  try {
    if (which === 'readonly') {
      const first = await L.open(browser, vp); first.page.__vp = vp;
      await L.ready(first);
      await L.enter(first);
      const page = await first.context.newPage(); page.__vp = vp;
      page.on('pageerror', e => console.log('[pageerror]', String(e.message).slice(0, 200)));
      await page.goto(L.BASE, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 120000 });
      await L.sleep(2500);
      await L.grab(page, 'readonly-tab', 'body');
      await L.shot(page, 'w7-01-readonly');
      // try to act: open the entry / upload
      await page.locator('#join').first().evaluate(b => b.click()).catch(() => {});
      await L.sleep(1200);
      await L.grab(page, 'readonly-join', 'body');
      await L.shot(page, 'w7-02-readonly-join');
      await L.closeSheet(page);
      await L.clickHidden(page, { open: 'upload' });
      await L.sleep(1200);
      await L.grab(page, 'readonly-upload', 'body');
      await L.closeSheet(page);
      await L.clickHidden(page, { open: 'about' });
      await L.sleep(900);
      await L.grab(page, 'readonly-about', '#panel');
      await L.shotScroll(page, 'w7-03-readonly-about', '#panel', 3);
      await L.log(page, 'readonly');
    }
    if (which === 'memory') {
      const run = await L.open(browser, vp, { init: () => {
        const fail = () => { const r = {}; setTimeout(() => { r.error = new DOMException('blocked', 'InvalidStateError'); r.onerror?.({ target: r }); }, 0); return r; };
        try { Object.defineProperty(window, 'indexedDB', { configurable: true, get() { return { open: fail, deleteDatabase: fail, databases: async () => [] }; } }); } catch {}
      } });
      const { page } = run; page.__vp = vp;
      await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready' || /^failed/.test(window.__SPACE_BOOT__ || ''), null, { timeout: 120000 });
      console.log('boot:', await page.evaluate(() => window.__SPACE_BOOT__));
      await L.sleep(2000);
      await L.grab(page, 'memory-only', 'body');
      await L.shot(page, 'w7-04-memory');
      await L.clickHidden(page, { open: 'about' });
      await L.sleep(900);
      await L.grab(page, 'memory-about', '#panel');
      await L.shotScroll(page, 'w7-05-memory-about', '#panel', 3);
      await L.log(page, 'memory');
    }
    if (which === 'aioff') {
      const run = await L.open(browser, vp, { init: () => { try { Object.defineProperty(window, 'createImageBitmap', { value: undefined, configurable: true }); } catch {} } });
      const { page } = run; page.__vp = vp;
      await L.ready(run);
      await L.sleep(1000);
      await L.grab(page, 'aioff-lobby', '.frame');
      await L.clickHidden(page, { open: 'about' });
      await L.sleep(900);
      await L.grab(page, 'aioff-about', '#panel');
      await L.shotScroll(page, 'w7-06-aioff-about', '#panel', 3);
      await L.closeSheet(page);
      await L.enter(run);
      await L.js(page, '[data-tour-action="sample:sample-stage"]');
      await page.waitForSelector('form[data-form="upload"] .photo-review', { timeout: 30000 });
      await L.sleep(2500);
      await L.grab(page, 'aioff-upload', '#panel');
      await L.shotScroll(page, 'w7-07-aioff-upload', '#panel', 3);
      await page.locator('form[data-form="upload"] button[type="submit"]').first().evaluate(b => b.click());
      await L.sleep(1200);
      await L.grab(page, 'aioff-after-submit', '#panel');
      await L.shotScroll(page, 'w7-08-aioff-after-submit', '#panel', 2);
      await L.log(page, 'aioff');
    }
    if (which === 'rescue') {
      const run = await L.open(browser, vp); const { page } = run; page.__vp = vp;
      await L.ready(run);
      await page.evaluate(() => { window.__SPACE_BOOT__ = 'failed:SEED_FAILED'; window.__SPACE_RESCUE__.show('failed:SEED_FAILED'); });
      await L.sleep(800);
      await L.grab(page, 'rescue', '#space-rescue');
      await L.shot(page, 'w7-09-rescue');
      const href = await page.evaluate(() => [...document.querySelectorAll('#space-rescue a')].map(a => a.href));
      console.log('rescue links', href);
      if (href[0]) {
        await page.goto(href[0], { waitUntil: 'load' });
        await L.sleep(4000);
        await L.grab(page, 'classic-page', 'body');
        await L.shot(page, 'w7-10-classic');
      }
    }
    if (which === 'noscript') {
      const context = await browser.newContext({ ...L.VP[vp], locale: 'zh-CN', javaScriptEnabled: false });
      const page = await context.newPage(); page.__vp = vp;
      await page.goto(L.BASE, { waitUntil: 'load' });
      await L.sleep(800);
      await L.grab(page, 'noscript', 'body');
      await L.shot(page, 'w7-11-noscript');
    }
    if (which === 'map') {
      const run = await L.open(browser, vp); const { page } = run; page.__vp = vp;
      await L.ready(run);
      await L.enter(run);
      await L.js(page, '#music-map-entry');
      await page.waitForURL(/music-map/, { timeout: 30000 }).catch(() => console.log('no navigation'));
      await L.sleep(5000);
      await L.grab(page, 'music-map', 'body');
      await L.shot(page, 'w7-12-map');
      // open a node detail
      const node = page.locator('[data-map-node], .map-node, button').filter({ hasText: /./ });
      console.log('map buttons', await node.count());
      await L.log(page, 'map');
    }
    console.log('done', which);
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); } finally { L.flush(); await browser.close(); }
})();
