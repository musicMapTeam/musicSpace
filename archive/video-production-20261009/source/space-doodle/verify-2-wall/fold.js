// Independent check: is the 「同一刻的另一面」 block on the first screen of the wall right after 「保存这张照片」?
// usage: node fold.js <phone|desktop> [baseUrl] [label]
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const vp = process.argv[2] || 'phone';
const base = process.argv[3] || 'http://127.0.0.1:5190/';
const label = process.argv[4] || 'dev';
const OUT = '/tmp/space-doodle/verify-2-wall';
const VP = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const context = await browser.newContext({ ...VP[vp], locale: 'zh-CN' });
  const page = await context.newPage();
  page.setDefaultTimeout(45000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message).slice(0, 200)));
  const click = async sel => { const l = page.locator(sel).first(); await l.waitFor({ state: 'visible', timeout: 60000 }); if (vp === 'phone') await l.tap(); else await l.click(); };
  try {
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 120000 });
    await page.evaluate(() => document.fonts.ready);
    await click('#join');
    await page.waitForFunction(() => { const b = document.querySelector('form[data-form="demo-entry"] button[type="submit"]'); return b && !b.disabled; }, null, { timeout: 90000 });
    await page.check('form[data-form="demo-entry"] input[name="consent"]', { force: true });
    await click('form[data-form="demo-entry"] button[type="submit"]');
    await click('[data-tour-action="sample:sample-crowd"]');
    await page.locator('form[data-form="upload"]').waitFor({ state: 'visible' });
    const ai = await page.waitForFunction(() => { const k = document.querySelector('form[data-form="upload"] [data-ai-line]')?.getAttribute('data-ai-key') || ''; return /^(sure|unsure|off)/.test(k) ? k : false; }, null, { timeout: 90000 }).then(h => h.jsonValue()).catch(() => 'timeout');
    await click('form[data-form="upload"] button[type="submit"]');
    await page.locator('#panel [data-moment-badge] [data-exchange-offer]').first().waitFor({ state: 'attached', timeout: 45000 });
    await page.waitForFunction(() => [...document.querySelectorAll('#panel .moment-card img')].every(i => i.complete && i.naturalWidth), null, { timeout: 30000 }).catch(() => {});
    await page.evaluate(() => document.fonts.ready);
    await sleep(2500);
    const m = await page.evaluate(() => {
      const panel = document.querySelector('#panel');
      const cs = getComputedStyle(panel);
      const pr = panel.getBoundingClientRect();
      const nav = document.querySelector('.camera-nav')?.getBoundingClientRect();
      // what really scrolls
      const scrollers = [];
      for (let e = document.querySelector('#panel-body'); e; e = e.parentElement) { const s = getComputedStyle(e); if (/(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 1) scrollers.push({ el: e.id || e.className || e.tagName, st: e.scrollTop, sh: e.scrollHeight, ch: e.clientHeight }); }
      const R = sel => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height) }; };
      // first point (from top) where the panel is covered by something else along x = the offer button center
      const offer = document.querySelector('#panel [data-exchange-offer]');
      const ob = offer.getBoundingClientRect();
      const x = Math.round(ob.left + ob.width / 2);
      let coveredFrom = null;
      for (let y = Math.round(pr.top) + 2; y < window.innerHeight; y += 2) { const hit = document.elementFromPoint(x, y); if (!hit || !panel.contains(hit)) { coveredFrom = { y, by: hit ? `${hit.tagName.toLowerCase()}#${hit.id}.${String(hit.className).split(' ').slice(0, 2).join('.')}` : 'none' }; break; } }
      const titleBadge = document.querySelector('#panel .moment-badge__title');
      const tb = titleBadge.getBoundingClientRect();
      const hitBadge = document.elementFromPoint(tb.left + tb.width / 2, tb.top + tb.height / 2);
      const hitOffer = document.elementFromPoint(x, ob.top + ob.height / 2);
      return {
        win: [innerWidth, innerHeight], panelKind: panel.dataset.kind, panelRect: { top: Math.round(pr.top), bottom: Math.round(pr.bottom), left: Math.round(pr.left), right: Math.round(pr.right) },
        panelOverflowY: cs.overflowY, scrollers, navTop: nav ? Math.round(nav.top) : null, coveredFrom,
        eyebrow: R('#panel-body .eyebrow, #panel-body small'), h2: R('#panel-body h2'), ribbon: R('#panel [data-moment-ribbon]'), groupTitle: R('#panel .moment-group__title'), clock: R('#panel .moment-group__clock'), note: R('#panel .moment-group__note'),
        bestCard: R('#panel .moment-card--best'), bestImgSpan: R('#panel .moment-card--best .photo-item > span'), bestName: R('#panel .moment-card--best .photo-item strong'), meta: R('#panel .moment-card--best .moment-meta'),
        badge: R('#panel [data-moment-badge]'), badgeTitle: R('#panel .moment-badge__title'), reason: R('#panel .moment-badge__reason'), offer: R('#panel [data-exchange-offer]'),
        badgeTitleVisibleHit: hitBadge ? (titleBadge.contains(hitBadge) || hitBadge === titleBadge) : false, offerHit: hitOffer ? `${hitOffer.tagName.toLowerCase()}.${String(hitOffer.className).split(' ')[0]}` : null,
        offerText: offer.textContent.trim(), cards: document.querySelectorAll('#panel .moment-card').length,
        firstCardIsBest: document.querySelector('#panel .moment-grid > .moment-card')?.classList.contains('moment-card--best'),
        toast: (() => { const t = document.querySelector('#toast'); const b = t.getBoundingClientRect(); return { text: t.textContent.trim(), top: Math.round(b.top), bottom: Math.round(b.bottom), vis: getComputedStyle(t).opacity }; })(),
      };
    });
    console.log(label, vp, 'ai=', ai, JSON.stringify(m, null, 1));
    await page.screenshot({ path: `${OUT}/${label}-${vp}-wall.png` });
    if (errors.length) console.log('pageerrors', errors);
  } catch (e) {
    console.log('FAILED', e.message.split('\n')[0]);
    await page.screenshot({ path: `${OUT}/${label}-${vp}-fail.png` }).catch(() => {});
  }
  await browser.close();
})();
