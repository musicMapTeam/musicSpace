// Where does the shell's sticky close rest once the sheet is scrolled, per viewport? (upload sheet after the reveal)
const L = require('./lib.cjs');
L.watchdog(250);
(async () => {
  const browser = await L.launch();
  try {
    for (const kind of (process.argv[2] || 'phone,narrow,desktop,p360').split(',')) {
      const run = await L.open(browser, kind);
      const { page } = run;
      await L.enter(run);
      await L.press(run, '[data-tour-action="sample:sample-crowd"]');
      await page.waitForSelector('form[data-form="upload"] .photo-review', { timeout: 30000 });
      await L.aiSettled(page);
      await L.sleep(1000);
      const g = await page.evaluate(() => {
        const p = document.querySelector('#panel'), c = document.querySelector('#panel-close'), cs = getComputedStyle(p), cc = getComputedStyle(c);
        const pr = p.getBoundingClientRect(), cr = c.getBoundingClientRect();
        const R = sel => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left - pr.left), Math.round(b.top - pr.top), Math.round(b.right - pr.left), Math.round(b.bottom - pr.top)]; };
        return { vw: innerWidth, st: Math.round(p.scrollTop), panelPad: cs.padding, panelW: Math.round(pr.width), close: [Math.round(cr.left - pr.left), Math.round(cr.top - pr.top), Math.round(cr.right - pr.left), Math.round(cr.bottom - pr.top)], closeCss: { pos: cc.position, top: cc.top, margin: cc.margin }, clock: R('form.moment-upload [data-taken-line]'), note: R('form.moment-upload [data-taken-note]'), legend: R('form.moment-upload .moment-view legend'), chips: R('form.moment-upload .moment-chips'), taken: R('form.moment-upload .moment-taken') };
      });
      console.log(kind, JSON.stringify(g));
      await run.context.close();
    }
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); } finally { await browser.close(); }
})();
