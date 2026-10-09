const L = require('./lib.cjs');
L.watchdog(200);
(async () => {
  const b = await L.launch();
  const { page } = await L.open(b, 'desktop');
  try {
    await L.enter(page);
    await page.addStyleTag({ content: '.panel>#panel-close.abs{position:absolute!important;top:10px!important;right:10px!important;margin:0!important}' });
    await page.evaluate(() => document.querySelector('#panel-close').classList.add('abs'));
    await page.click('#room-info'); await L.sleep(800);
    const r = await page.evaluate(async () => {
      const p = document.querySelector('#panel'), c = document.querySelector('#panel-close'), out = [];
      const st = () => { const x = c.getBoundingClientRect(), q = p.getBoundingClientRect(); return `${p.scrollTop}|${Math.round(x.top - q.top)}`; };
      out.push('abs ' + st());
      c.blur(); c.classList.remove('abs'); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      out.push('sticky ' + st());
      c.focus(); out.push('focus ' + st());
      p.scrollTop = 0; await new Promise(r => requestAnimationFrame(r)); out.push('reset ' + st());
      c.focus({ preventScroll: false }); out.push('focus2 ' + st());
      p.scrollTop = 0; c.blur(); await new Promise(r => requestAnimationFrame(r));
      document.querySelector('#panel-body button').focus(); out.push('firstbtn ' + st());
      p.scrollTop = 0; c.blur(); await new Promise(r => requestAnimationFrame(r));
      c.scrollIntoView({ block: 'nearest' }); out.push('siv-nearest ' + st());
      return out.join('  ');
    });
    console.log(r);
  } catch (e) { console.error('ERR', e.message.split('\n')[0]); }
  await b.close();
})();
