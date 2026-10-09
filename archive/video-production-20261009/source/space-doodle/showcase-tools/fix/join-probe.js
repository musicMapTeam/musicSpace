// Join sheet fold probe: node join-probe.js [shotPrefix] [port]   (sizes: 320x568, 390x844, 768x1024, 1440x900, 1280x720)
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const [, , PREFIX = '', PORT = '5190'] = process.argv;
const URL = process.env.BASE || `http://127.0.0.1:${PORT}/`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
setTimeout(() => { console.log('WATCHDOG'); process.exit(2); }, 270000).unref();
const SIZES = { w320: [320, 568, 2, true], w390: [390, 844, 2, true], w768: [768, 1024, 1, false], w1280: [1280, 720, 1, false], w1440: [1440, 900, 1, false] };
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    for (const [name, [w, h, dpr, mobile]] of Object.entries(SIZES)) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile });
      const page = await ctx.newPage();
      page.on('pageerror', e => console.log('pageerror', e.message.slice(0, 200)));
      await page.goto(URL);
      await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
      await page.evaluate(() => document.fonts.ready);
      await sleep(500);
      await page.locator('#join').click();
      await page.waitForSelector('form[data-form="demo-entry"]');
      await sleep(900);
      const m = await page.evaluate(() => {
        const panel = document.querySelector('#panel'), body = document.querySelector('#panel-body');
        const sc = [panel, body].find(n => n.scrollHeight > n.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(n).overflowY)) || panel;
        const sr = sc.getBoundingClientRect();
        const q = s => document.querySelector(s);
        const R = n => { if (!n) return null; const x = n.getBoundingClientRect(); return [Math.round(x.top), Math.round(x.bottom)]; };
        const form = q('form[data-form="demo-entry"]');
        const actions = form.querySelector('.demo-entry-actions');
        return { scroller: sc.id || sc.className, visible: [Math.round(sr.top), Math.round(sr.bottom)], clientH: sc.clientHeight, scrollH: sc.scrollHeight,
          consent: R(form.querySelector('label.consent')), submit: R(form.querySelector('button[type=submit]')), status: R(form.querySelector('.demo-entry-status')), actions: R(actions),
          actionsPos: actions ? getComputedStyle(actions).position : null, submitBelowFold: Math.max(0, Math.round(form.querySelector('button[type=submit]').getBoundingClientRect().bottom - sr.bottom)), nav: R(q('nav.camera-nav')), vh: innerHeight, overflowX: document.documentElement.scrollWidth > innerWidth };
      });
      console.log(name, JSON.stringify(m));
      if (PREFIX) {
        await page.evaluate(() => document.activeElement?.blur?.());
        await page.screenshot({ path: `${PREFIX}-${name}.png` });
        // scrolled to the end
        await page.evaluate(() => { const panel = document.querySelector('#panel'), body = document.querySelector('#panel-body'); const sc = [panel, body].find(n => n.scrollHeight > n.clientHeight + 2) || panel; sc.scrollTop = sc.scrollHeight; });
        await sleep(400);
        await page.screenshot({ path: `${PREFIX}-${name}-end.png` });
        // scrolled to the middle (sticky footer over flowing content)
        await page.evaluate(() => { const panel = document.querySelector('#panel'), body = document.querySelector('#panel-body'); const sc = [panel, body].find(n => n.scrollHeight > n.clientHeight + 2) || panel; sc.scrollTop = Math.round((sc.scrollHeight - sc.clientHeight) * 0.45); });
        await sleep(400);
        await page.screenshot({ path: `${PREFIX}-${name}-mid.png` });
      }
      await ctx.close();
    }
  } catch (e) { console.error('FAILED', e.message.split('\n')[0]); }
  finally { await browser.close(); }
})();
