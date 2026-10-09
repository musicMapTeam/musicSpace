const L = require('./lib.cjs');
L.watchdog(120);
(async () => {
  const b = await L.launch();
  const { page } = await L.open(b, process.argv[2] || 'phone');
  await page.click('#join');
  await page.waitForSelector('form[data-form="demo-entry"]');
  await L.sleep(800);
  console.log(JSON.stringify(await page.evaluate(() => {
    const c = document.querySelector('#panel-close'), p = document.querySelector('#panel'), cs = getComputedStyle(c), ps = getComputedStyle(p);
    const r = c.getBoundingClientRect(), q = p.getBoundingClientRect(), bdy = document.querySelector('#panel-body').getBoundingClientRect();
    return { pos: cs.position, mt: cs.marginTop, mb: cs.marginBottom, mr: cs.marginRight, ml: cs.marginLeft, disp: cs.display, top: cs.top, float: cs.cssFloat, pPad: ps.padding, pDisp: ps.display, pOv: ps.overflowY,
      close: [r.left - q.left, r.top - q.top, q.right - r.right].map(Math.round), bodyTop: Math.round(bdy.top - q.top), first: p.firstElementChild?.id, kids: [...p.children].map(k => k.id || k.className) };
  })));
  await b.close();
})();
