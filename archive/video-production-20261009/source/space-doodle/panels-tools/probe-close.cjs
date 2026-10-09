// Probe: where is #panel-close, what is the sheet's scroll offset on open, does the × stay visible when the sheet is scrolled?
// usage: node probe-close.cjs <phone|desktop|narrow> [base url]
const L = require('./lib.cjs');
L.watchdog(280);
const vp = process.argv[2] || 'phone';

const sheet = page => page.evaluate(() => {
  const p = document.querySelector('#panel'), c = document.querySelector('#panel-close');
  if (p.hidden) return { hidden: true };
  const pr = p.getBoundingClientRect(), cr = c.getBoundingClientRect(), cc = getComputedStyle(c);
  const inside = cr.top >= pr.top - 1 && cr.bottom <= pr.bottom + 1;
  return { kind: p.dataset.kind, st: Math.round(p.scrollTop), sh: p.scrollHeight, ch: p.clientHeight,
    close: [Math.round(cr.left - pr.left), Math.round(cr.top - pr.top), Math.round(cr.width), Math.round(cr.height)], inside,
    css: { pos: cc.position, top: cc.top, right: cc.right, margin: cc.margin }, focus: document.activeElement?.id || document.activeElement?.tagName };
});
const scrollBy = (page, y) => page.evaluate(y => { const p = document.querySelector('#panel'); p.scrollTop = y === 'end' ? p.scrollHeight : p.scrollTop + y; }, y);
const clickHidden = (page, dataset) => page.evaluate(dataset => { const o = document.createElement('button'); Object.assign(o.dataset, dataset); o.style.position = 'fixed'; o.style.left = '-9999px'; document.body.append(o); o.click(); o.remove(); }, dataset);

(async () => {
  const browser = await L.launch();
  try {
    const run = await L.open(browser, vp);
    const { page } = run;
    await L.enter(run);
    console.log('after enter', JSON.stringify(await sheet(page)));
    await L.press(run, '#room-info');
    await L.sleep(700);
    console.log('··· opened', JSON.stringify(await sheet(page)));
    await scrollBy(page, 'end');
    await L.sleep(300);
    console.log('··· scrolled to end', JSON.stringify(await sheet(page)));
    await L.press(run, '#panel-close');
    await L.sleep(400);
    await clickHidden(page, { open: 'about' });
    await L.sleep(700);
    console.log('about opened', JSON.stringify(await sheet(page)));
    await scrollBy(page, 'end');
    await L.sleep(300);
    console.log('about scrolled', JSON.stringify(await sheet(page)));
    await clickHidden(page, { open: 'upload' });
    await L.sleep(700);
    console.log('upload opened from scrolled about', JSON.stringify(await sheet(page)));
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); } finally { await browser.close(); }
})();
