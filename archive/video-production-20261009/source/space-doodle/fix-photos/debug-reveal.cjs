// Why does the reveal skip on some runs? Log scrollIntoView calls, the panel's scroll and transform over time after 「人海 · 示例照片」.
const L = require('./lib.cjs');
L.watchdog(200);
const kind = process.argv[2] || 'phone';
(async () => {
  const browser = await L.launch();
  try {
    const run = await L.open(browser, kind);
    const { page } = run;
    await L.enter(run);
    await page.evaluate(() => {
      window.__log = [];
      const t0 = performance.now();
      const log = (...a) => window.__log.push([Math.round(performance.now() - t0), ...a]);
      window.__mark = () => { window.__t0 = performance.now(); };
      const orig = Element.prototype.scrollIntoView;
      Element.prototype.scrollIntoView = function (o) { log('scrollIntoView', this.className, JSON.stringify(o)); return orig.call(this, o); };
      const panel = document.querySelector('#panel');
      let last = -1;
      const tick = () => {
        const st = Math.round(panel.scrollTop);
        const tf = getComputedStyle(panel).transform;
        const anim = panel.getAnimations().map(a => `${a.animationName || a.id}:${a.playState}:${Math.round(a.currentTime || 0)}`).join(',');
        const key = `${st}|${tf}|${anim}`;
        if (key !== last) { last = key; log('panel', st, tf, anim, document.querySelector('form.moment-upload .photo-review') ? 'photo' : '-', document.querySelector('form.moment-upload [data-ai-line]')?.getAttribute('data-ai-key')); }
        if (performance.now() - t0 < 60000) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      panel.addEventListener('scroll', () => { const a = document.activeElement; const r = a?.getBoundingClientRect(); const c = document.querySelector('#panel-close'); log('scroll', Math.round(panel.scrollTop), a?.tagName + '#' + a?.id + '.' + a?.className, r && [Math.round(r.top), Math.round(r.bottom)], getComputedStyle(c).position, getComputedStyle(c).top, getComputedStyle(c).cssFloat, getComputedStyle(c).marginTop); });
    });
    await L.press(run, '[data-tour-action="sample:sample-crowd"]');
    await page.waitForSelector('form[data-form="upload"] .photo-review', { timeout: 30000 });
    await L.aiSettled(page);
    await L.sleep(1500);
    const log = await page.evaluate(() => window.__log);
    for (const row of log) console.log(JSON.stringify(row));
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); } finally { await browser.close(); }
})();
