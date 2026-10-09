// AFTER screenshots for the photos fixes, taken the way a judge gets there (no manual scrolling unless the name says so).
// usage: node shots-fix.cjs <phone|desktop|narrow> [route|own]
const L = require('./lib.cjs');
const path = require('path');
L.watchdog(285);
const vp = process.argv[2] || 'phone';
const mode = process.argv[3] || 'route';
const OUT = process.env.SHOTS_OUT || '/tmp/space-doodle/shots/photos';
const file = name => path.join(OUT, `after-${name}-${vp}.png`);
const scrollPanel = (page, selector, offset = 12) => page.evaluate(([selector, offset]) => {
  const el = document.querySelector(selector), box = document.querySelector('#panel');
  if (el && box) box.scrollTop += el.getBoundingClientRect().top - box.getBoundingClientRect().top - offset;
}, [selector, offset]);
(async () => {
  const browser = await L.launch();
  try {
    const run = await L.open(browser, vp);
    const { page } = run;
    await L.enter(run);
    await L.press(run, '[data-tour-action="sample:sample-crowd"]');
    await page.waitForSelector('form[data-form="upload"] .photo-review', { timeout: 30000 });
    if (mode === 'own') {
      await L.aiSettled(page);
      await L.sleep(600);
      await page.setInputFiles('form[data-form="upload"] input[type="file"]', '/tmp/space-video-prep/photos/pack/demo-unsure-2150.jpg');
      await page.waitForFunction(() => !document.querySelector('[data-sample-flag]') && /21:50/.test(document.querySelector('[data-taken-line]')?.textContent || ''), null, { timeout: 30000 });
      await L.aiSettled(page);
      await L.sleep(900);
      console.log('own upload', JSON.stringify(await L.uploadState(page)));
      await L.shot(page, file('own-upload'));
      return;
    }
    await L.aiSettled(page);
    await L.sleep(900);
    console.log('upload', JSON.stringify(await L.uploadState(page)));
    await L.shot(page, file('upload-sure'));
    if (vp === 'narrow') { await scrollPanel(page, 'form.moment-upload .moment-taken', 18); await L.shot(page, file('upload-photo')); }
    await page.evaluate(() => { document.querySelector('#panel').scrollTop = 0; });
    await L.shot(page, file('upload-top'));
    const chosen = await page.evaluate(() => Boolean(document.querySelector('form[data-form="upload"] .moment-chip[aria-pressed="true"]')));
    if (!chosen) await L.press(run, 'form[data-form="upload"] .moment-chip[data-moment-viewpoint="crowd"]');
    await L.press(run, 'form[data-form="upload"] button[type="submit"]');
    await page.locator('#panel [data-moment-badge] [data-exchange-offer]').first().waitFor({ state: 'attached', timeout: 45000 });
    await page.waitForFunction(() => [...document.querySelectorAll('#panel .moment-card img')].every(i => i.complete && i.naturalWidth), null, { timeout: 30000 }).catch(() => {});
    await L.sleep(1500);
    console.log('wall', JSON.stringify(await L.wallState(page)));
    await L.shot(page, file('wall'));
    await scrollPanel(page, '#panel .moment-card--best', 22);
    await L.shot(page, file('wall-badge'));
    await page.evaluate(() => { document.querySelector('#panel').scrollTop = 0; });
    await L.press(run, '#panel [data-moment-badge] [data-exchange-offer]');
    await page.waitForSelector('.photo-exchanges:not([hidden]) .exchange-pair', { timeout: 20000 });
    await page.waitForFunction(() => document.querySelectorAll('.photo-exchanges .exchange-photo img').length >= 2, null, { timeout: 30000 }).catch(() => {});
    await L.sleep(900);
    console.log('xsheet', JSON.stringify(await page.evaluate(() => ({ presence: getComputedStyle(document.querySelector('.presence')).visibility }))));
    await L.shot(page, file('compose'));
    await page.evaluate(() => document.querySelector('.photo-exchanges [data-x-close]')?.click());
    await L.sleep(500);
    await page.evaluate(() => { const b = document.querySelector('#room-recap'); if (b && !b.hidden) b.click(); else { const o = document.createElement('button'); o.dataset.open = 'recap'; o.style.position = 'fixed'; o.style.left = '-9999px'; document.body.append(o); o.click(); o.remove(); } });
    await page.waitForSelector('.panel[data-kind="recap"] .recap-venue', { timeout: 20000 });
    await page.waitForFunction(() => document.querySelector('.panel[data-kind="recap"] .recap-keepsake'), null, { timeout: 20000 }).catch(() => {});
    await L.sleep(1200);
    console.log('recap-venue', JSON.stringify(await page.evaluate(() => { const n = document.querySelector('.recap-venue'); const items = [...n.querySelectorAll('.pc-dots__item')].map(i => Math.round(i.getBoundingClientRect().top)); return { size: getComputedStyle(n).fontSize, lines: new Set(items).size, text: n.textContent }; })));
    await L.shot(page, file('recap'));
  } catch (e) {
    console.log('FAILED', e.message.split('\n')[0]);
  } finally { await browser.close(); }
})();
