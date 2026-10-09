// verify-18: independent repro of "toast catches taps / sits on panel header on phones"
// usage: node t-toast.cjs <w320|w390|w768|w1440> <inbox|wall> [url]
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const OUT = '/tmp/space-doodle/verify-18';
const VP = {
  w320: { viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  w390: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  w768: { viewport: { width: 768, height: 1024 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  w1440: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};
const [, , vp = 'w320', scen = 'inbox', url = 'http://127.0.0.1:5190/'] = process.argv;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 23), ...a);
let browser;
setTimeout(async () => { console.error('watchdog'); try { await browser?.close(); } catch {} process.exit(2); }, 280000).unref();

async function measure(page, sels = []) {
  return page.evaluate((sels) => {
    const R = n => { if (!n) return null; const r = n.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom].map(v => Math.round(v)); };
    const name = h => h ? (h.id ? '#' + h.id : (h.tagName.toLowerCase() + (h.className && typeof h.className === 'string' ? '.' + h.className.trim().split(/\s+/).join('.') : ''))) : null;
    const t = document.querySelector('#toast'); const cs = getComputedStyle(t);
    const out = { toastText: t.textContent, toastVisible: t.classList.contains('visible'), display: cs.display, pointerEvents: cs.pointerEvents, z: cs.zIndex, toast: R(t),
      panelHidden: document.querySelector('#panel').hidden, panelRect: R(document.querySelector('#panel')), items: {} };
    for (const sel of ['#panel-close', ...sels]) {
      const n = document.querySelector(sel); if (!n) { out.items[sel] = null; continue; }
      const r = n.getBoundingClientRect(); const hits = [];
      for (const [fx, fy] of [[.5, .5], [.2, .2], [.8, .2], [.2, .8], [.8, .8]]) hits.push(name(document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy)));
      out.items[sel] = { rect: R(n), text: (n.textContent || '').trim().slice(0, 24), hitsCentreFirst: hits };
    }
    return out;
  }, sels);
}
async function enter(page) {
  await page.locator('#join').click();
  await page.waitForSelector('form[data-form="demo-entry"]', { timeout: 20000 });
  await page.locator('form[data-form="demo-entry"] input[name=consent]').check();
  await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"] button[type=submit]')?.disabled, null, { timeout: 60000 });
  await page.locator('form[data-form="demo-entry"] button[type=submit]').click();
  await page.waitForSelector(".frame[data-stage='room']", { timeout: 30000 });
  await sleep(1500);
  if (!(await page.evaluate(() => document.querySelector('#panel').hidden))) { await page.locator('#panel-close').click(); await sleep(400); }
}
async function tapCentre(page, rect) {
  const x = (rect[0] + rect[2]) / 2, y = (rect[1] + rect[3]) / 2;
  if (VP[vp].hasTouch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
  return [Math.round(x), Math.round(y)];
}

(async () => {
  browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--hide-scrollbars'] });
  const ctx = await browser.newContext({ ...VP[vp] });
  const page = await ctx.newPage(); page.setDefaultTimeout(25000);
  page.on('pageerror', e => log('[pageerror]', e.message.slice(0, 160)));
  const result = { vp, scen };
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
    await page.evaluate(() => document.fonts.ready); await sleep(1000);
    if (process.env.FIX) { await page.addStyleTag({ content: process.env.FIX }); result.fix = process.env.FIX; }
    await enter(page); log('entered');
    if (scen === 'inbox') {
      const skip = page.locator('[data-tour-skip]'); if (await skip.count() && await skip.first().isVisible()) { await skip.first().click(); await sleep(600); }
      const people = await page.evaluate(() => [...document.querySelectorAll('#hotspots [data-kind="person"]')].map(n => ({ id: n.dataset.sceneTarget, label: n.textContent.trim() })));
      log('people', JSON.stringify(people));
      const xm = people.find(p => p.label.includes('小满')) || people.find(p => !p.label.includes('我'));
      // real route: tap the name tag, then 「认识一下」 in the context bar
      await page.locator(`#hotspots [data-scene-target="${xm.id}"]`).first().click({ timeout: 8000 }).catch(e => log('hotspot click failed', e.message.split('\n')[0]));
      await page.waitForSelector('#context-actions:not([hidden]) [data-open="person"]', { timeout: 15000 }).catch(() => log('no context bar'));
      await sleep(400);
      const ctxBtn = page.locator('#context-actions:not([hidden]) [data-open="person"]');
      if (await ctxBtn.count()) await ctxBtn.first().click(); else await page.evaluate(id => { const b = document.createElement('button'); b.dataset.open = 'person'; b.dataset.id = id; document.body.append(b); b.click(); b.remove(); }, xm.id);
      await page.waitForSelector('#panel-body [data-social-send]', { timeout: 15000 });
      await sleep(500);
      await page.locator('#panel-body [data-social-send]').first().click();
      const t0 = Date.now();
      await page.waitForFunction(() => document.querySelector('#toast').classList.contains('visible'), null, { timeout: 8000 });
      result.afterGreet = await measure(page);
      await page.screenshot({ path: `${OUT}/${vp}-person-toast.png` });
      await page.locator('#social-inbox').click(); await sleep(600);
      result.inbox = await measure(page, ['#panel-body .eyebrow', '#panel-body h2']);
      result.inbox.msSinceToast = Date.now() - t0;
      await page.screenshot({ path: `${OUT}/${vp}-inbox-toast${process.env.FIX ? '-fix' : ''}.png` });
      if (result.inbox.items['#panel-close']) {
        result.tapAt = await tapCentre(page, result.inbox.items['#panel-close'].rect);
        await sleep(500);
        result.closedByCentreTap = await page.evaluate(() => document.querySelector('#panel').hidden);
        result.tapMsSinceToast = Date.now() - t0;
        // after the toast has gone, does the same tap work?
        if (!result.closedByCentreTap) {
          await page.waitForFunction(() => !document.querySelector('#toast').classList.contains('visible'), null, { timeout: 8000 });
          result.afterToastGone = await measure(page);
          await tapCentre(page, result.inbox.items['#panel-close'].rect); await sleep(500);
          result.closedAfterToastGone = await page.evaluate(() => document.querySelector('#panel').hidden);
        }
      }
    } else if (scen === 'wall') {
      await page.waitForSelector('[data-tour-action="sample:sample-crowd"]', { timeout: 20000 });
      await page.click('[data-tour-action="sample:sample-crowd"]');
      await page.waitForSelector('form[data-form="upload"] .photo-review', { timeout: 30000 });
      await page.waitForSelector('form[data-form="upload"] .moment-chip.is-ai, form[data-form="upload"] .moment-ai-tag', { timeout: 60000 }).catch(() => log('no AI answer'));
      await sleep(600);
      const hasView = await page.evaluate(() => Boolean(document.querySelector('form[data-form="upload"] .moment-chip[aria-pressed="true"]')));
      result.aiPreselected = hasView;
      if (!hasView) await page.click('form[data-form="upload"] .moment-chip[data-moment-viewpoint="crowd"]');
      const submit = page.locator('form[data-form="upload"] button[type="submit"]');
      await submit.scrollIntoViewIfNeeded();
      await submit.click();
      const t0 = Date.now();
      await page.waitForFunction(() => document.querySelector('#toast').classList.contains('visible'), null, { timeout: 30000 });
      await page.waitForSelector('#panel-body [data-moment-wall], #panel-body .photo-grid', { timeout: 30000 }).catch(() => log('no wall'));
      await page.waitForFunction(() => document.querySelectorAll('#panel-body .moment-card img, #panel-body .photo-item img').length >= 2, null, { timeout: 8000 }).catch(() => {});
      await sleep(300);
      result.wall = await measure(page, ['[data-exchange-offer]', '#panel-body .eyebrow', '#panel-body h2', '[data-moment-badge]']);
      result.wall.msSinceToast = Date.now() - t0;
      await page.screenshot({ path: `${OUT}/${vp}-wall-toast${process.env.FIX ? '-fix' : ''}.png` });
      // Is the exchange button in view? where is it relative to the toast?
      const off = result.wall.items['[data-exchange-offer]'];
      if (off) {
        // scroll the panel so the offer button sits under the toast, as a person reading the wall would
        result.scroll = await page.evaluate(() => {
          const btn = document.querySelector('[data-exchange-offer]'); const t = document.querySelector('#toast').getBoundingClientRect();
          let sc = btn.parentElement; while (sc && !(sc.scrollHeight > sc.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
          if (!sc) return { scroller: null };
          const b = btn.getBoundingClientRect(); const before = sc.scrollTop;
          sc.scrollTop += (b.top + b.height * 0.75) - (t.top + t.height / 2);
          return { scroller: sc.id || sc.className, before, after: sc.scrollTop };
        });
        await sleep(250);
        result.wallScrolled = await measure(page, ['[data-exchange-offer]']);
        result.wallScrolled.msSinceToast = Date.now() - t0;
        await page.screenshot({ path: `${OUT}/${vp}-wall-scrolled-toast${process.env.FIX ? '-fix' : ''}.png` });
        const r = result.wallScrolled.items['[data-exchange-offer]'].rect;
        const tr = result.wallScrolled.toast;
        // tap the part of the button that is under the bubble (if any)
        const ox = Math.max(r[0], tr[0]) + 10, oy = Math.max(r[1], tr[1]) + 4;
        const under = r[0] < tr[2] && r[2] > tr[0] && r[1] < tr[3] && r[3] > tr[1] && result.wallScrolled.toastVisible;
        result.offerUnderToast = under;
        if (under) {
          const tx = Math.min(Math.max(ox, r[0] + 4), Math.min(r[2], tr[2]) - 4), ty = Math.min(Math.max(oy, r[1] + 4), Math.min(r[3], tr[3]) - 4);
          result.offerTap = [tx, ty];
          result.offerTapHit = await page.evaluate(([x, y]) => { const h = document.elementFromPoint(x, y); return h && (h.id || h.className || h.tagName); }, [tx, ty]);
          if (VP[vp].hasTouch) await page.touchscreen.tap(tx, ty); else await page.mouse.click(tx, ty);
          await sleep(1200);
          result.exchangeOpenedByTapUnderToast = await page.evaluate(() => Boolean(document.querySelector('.photo-exchanges:not([hidden])')));
          result.offerTapMsSinceToast = Date.now() - t0;
        }
      }
      // check the close button too
      result.wallClose = result.wall.items['#panel-close'];
    }
  } catch (e) { result.error = e.message.split('\n').slice(0, 3).join(' | '); await page.screenshot({ path: `${OUT}/${vp}-${scen}-error.png` }).catch(() => {}); }
  fs.writeFileSync(`${OUT}/${vp}-${scen}${process.env.FIX ? '-fix' : ''}.json`, JSON.stringify(result, null, 1));
  console.log(JSON.stringify(result, null, 1));
  await browser.close();
})();
