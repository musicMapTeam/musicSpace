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
      const log = (...a) => window.__log.push([Math.round(performance.now() - t0), ...a]);
      const desc = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop');
      Object.defineProperty(panel, 'scrollTop', { get() { return desc.get.call(this); }, set(v) { log('set scrollTop', v, 'from', desc.get.call(this), new Error().stack.split('\n').slice(2, 5).map(s => s.trim().slice(0, 90)).join(' | ')); desc.set.call(this, v); } });
      const focus = HTMLElement.prototype.focus;
      HTMLElement.prototype.focus = function (o) { log('focus', this.tagName, this.id, this.className, this.name || '', JSON.stringify(o || {}), 'st', desc.get.call(panel)); const r = focus.call(this, o); log('focused', 'st', desc.get.call(panel)); return r; };
      const siv = Element.prototype.scrollIntoView;
      Element.prototype.scrollIntoView = function (o) { log('scrollIntoView', this.className, JSON.stringify(o), new Error().stack.split('\n').slice(2, 4).map(s => s.trim().slice(0, 90)).join(' | ')); return siv.call(this, o); };
      panel.addEventListener('scroll', () => log('scroll', Math.round(desc.get.call(panel)), document.activeElement?.tagName, document.activeElement?.name || document.activeElement?.id));
    });
    await page.setInputFiles('form[data-form="upload"] input[type="file"]', '/tmp/space-video-prep/photos/pack/demo-unsure-2150.jpg');
    await L.sleep(3000);
    const log = await page.evaluate(() => window.__log);
    for (const row of log) console.log(JSON.stringify(row));
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); } finally { await browser.close(); }
})();
