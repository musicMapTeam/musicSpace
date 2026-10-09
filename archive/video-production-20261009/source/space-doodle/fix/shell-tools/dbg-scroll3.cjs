const L = require('./lib.cjs');
L.watchdog(200);
(async () => {
  const b = await L.launch();
  const { page } = await L.open(b, process.argv[2] || 'desktop');
  try {
    await L.enter(page);
    const probe = async label => { await page.click('#room-info'); await L.sleep(500); console.log(label, await page.evaluate(() => document.querySelector('#panel').scrollTop)); await page.keyboard.press('Escape'); await L.sleep(500); };
    await probe('sticky+anim');
    await page.addStyleTag({ content: '.panel:not([hidden]){animation:none!important}' });
    await probe('sticky, no anim');
    // trace the open sequence
    await page.evaluate(() => { const p = document.querySelector('#panel'); const orig = HTMLElement.prototype.focus; window.__trace = []; HTMLElement.prototype.focus = function (...a) { window.__trace.push(`focus ${this.id || this.tagName} before ${p.scrollTop} hidden ${p.hidden}`); const r = orig.apply(this, a); window.__trace.push(`after ${p.scrollTop}`); return r; }; const d = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop'); Object.defineProperty(p, 'scrollTop', { get() { return d.get.call(this); }, set(v) { window.__trace.push(`set scrollTop ${v}`); d.set.call(this, v); } }); });
    await page.click('#room-info'); await L.sleep(500);
    console.log(JSON.stringify(await page.evaluate(() => window.__trace)));
  } catch (e) { console.error('ERR', e.message.split('\n')[0]); }
  await b.close();
})();
