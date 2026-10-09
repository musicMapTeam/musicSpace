// Trace the reveal for the own-photo path: scroll events, scrollIntoView calls, the view's and the polaroid's tops, font loading.
const L = require('./lib.cjs');
L.watchdog(200);
const kind = process.argv[2] || 'narrow';
(async () => {
  const browser = await L.launch();
  try {
    const run = await L.open(browser, kind);
    const { page } = run;
    await L.enter(run);
    await L.press(run, '[data-tour-action="sample:sample-crowd"]');
    await page.waitForSelector('form[data-form="upload"] .photo-review', { timeout: 30000 });
    await L.aiSettled(page);
    await L.sleep(1200);
    await page.evaluate(() => {
      window.__log = [];
      const t0 = performance.now();
      const panel = document.querySelector('#panel');
      const pos = sel => { const e = document.querySelector(sel); return e ? Math.round(e.getBoundingClientRect().top - panel.getBoundingClientRect().top) : null; };
      const log = (...a) => window.__log.push([Math.round(performance.now() - t0), ...a]);
      const orig = Element.prototype.scrollIntoView;
      Element.prototype.scrollIntoView = function (o) { log('scrollIntoView', this.className, 'view', pos('form.moment-upload .moment-view'), 'taken', pos('form.moment-upload .moment-taken'), 'st', panel.scrollTop); const r = orig.call(this, o); log('after', 'view', pos('form.moment-upload .moment-view'), 'st', panel.scrollTop); return r; };
      panel.addEventListener('scroll', () => log('scroll', Math.round(panel.scrollTop), 'view', pos('form.moment-upload .moment-view'), 'taken', pos('form.moment-upload .moment-taken'), 'fonts', document.fonts.status));
      let last = '';
      const tick = () => { const k = `${pos('form.moment-upload .moment-view')}|${pos('form.moment-upload .moment-taken')}|${Math.round(panel.scrollTop)}|${document.fonts.status}|${document.querySelector('[data-pick-status]')?.textContent}`; if (k !== last) { last = k; log('tick', k); } if (performance.now() - t0 < 20000) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
      document.fonts.addEventListener('loading', e => log('fonts-loading', e.fontfaces.map(f => f.family).join(',')));
      document.fonts.addEventListener('loadingdone', e => log('fonts-done', e.fontfaces.map(f => f.family).join(',')));
    });
    await page.setInputFiles('form[data-form="upload"] input[type="file"]', '/tmp/space-video-prep/photos/pack/demo-unsure-2150.jpg');
    await L.sleep(3000);
    const log = await page.evaluate(() => window.__log);
    for (const row of log) console.log(JSON.stringify(row));
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); } finally { await browser.close(); }
})();
