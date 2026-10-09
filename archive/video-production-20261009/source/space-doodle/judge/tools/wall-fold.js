// Is the 「同一刻的另一面」 badge / offer on the first screen of the wall right after saving (judge route step 6)?
const L = require('./lib.js');
const vp = process.argv[2] || 'phone';
(async () => {
  const browser = await L.launch();
  const run = await L.open(browser, vp, { label: `wall-fold-${vp}` });
  const { page } = run;
  const t = async sel => { const l = page.locator(sel).first(); await l.waitFor({ state: 'visible', timeout: 45000 }); await l.click(); };
  await L.boot(page, L.baseUrl('root'));
  await t('#join');
  await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"] button[type="submit"]')?.disabled, null, { timeout: 60000 });
  await page.check('form[data-form="demo-entry"] input[name="consent"]');
  await t('form[data-form="demo-entry"] button[type="submit"]');
  await t('[data-tour-action="sample:sample-crowd"]');
  await page.waitForFunction(() => /^(sure|unsure|off)/.test(document.querySelector('form[data-form="upload"] [data-ai-line]')?.getAttribute('data-ai-key') || ''), null, { timeout: 90000 }).catch(() => {});
  await t('form[data-form="upload"] button[type="submit"]');
  await page.locator('[data-moment-badge] [data-exchange-offer]').first().waitFor({ state: 'attached', timeout: 30000 });
  await page.waitForFunction(() => [...document.querySelectorAll('#panel .moment-card--best img')].every(i => i.complete && i.naturalWidth), null, { timeout: 20000 }).catch(() => {});
  await L.sleep(1500);
  const m = await page.evaluate(() => {
    const panel = document.querySelector('#panel'), body = document.querySelector('#panel-body');
    let box = body; while (box && !(box.scrollHeight > box.clientHeight + 2 && /(auto|scroll)/.test(getComputedStyle(box).overflowY))) box = box.parentElement;
    const view = (box || panel).getBoundingClientRect();
    const nav = document.querySelector('.camera-nav').getBoundingClientRect();
    const visibleBottom = Math.min(view.bottom, window.innerHeight, nav.top);
    const r = sel => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom) }; };
    return { scroller: box ? (box.id || box.className) : null, scrollTop: box?.scrollTop, viewTop: Math.round(view.top), visibleBottom: Math.round(visibleBottom), badge: r('#panel [data-moment-badge]'), badgeTitle: r('#panel .moment-badge__title'), offer: r('#panel [data-exchange-offer]'), bestCard: r('#panel .moment-card--best'), bestImg: r('#panel .moment-card--best img'), groupTitle: r('#panel .moment-group__title'), ribbon: r('#panel [data-moment-ribbon]') };
  });
  console.log(vp, JSON.stringify(m));
  await browser.close();
})();
