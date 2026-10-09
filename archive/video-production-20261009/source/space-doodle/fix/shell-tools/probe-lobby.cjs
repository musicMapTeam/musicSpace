// node probe-lobby.cjs <vp>  : ticket note clip, brand and consent hit areas, eyebrow size
const L = require('./lib.cjs');
L.watchdog(200);
const kind = process.argv[2] || 'desktop';
(async () => {
  const b = await L.launch();
  const { page } = await L.open(b, kind);
  try {
    const q = () => page.evaluate(() => {
      const r = el => { if (!el) return null; const x = el.getBoundingClientRect(); return [x.left, x.top, x.width, x.height].map(Math.round); };
      const sm = document.querySelector('.track small');
      const tr = document.querySelector('.track');
      const brand = document.querySelector('.frame>header .brand');
      const eb = document.querySelector('.scene-heading small');
      return { trackVisible: !!tr.getClientRects().length && getComputedStyle(tr).display !== 'none', track: r(tr), small: r(sm), smallSW: sm.scrollWidth, smallCW: sm.clientWidth, smallText: sm.textContent,
        brand: r(brand), eyebrow: eb && [getComputedStyle(eb).fontSize, eb.scrollWidth, eb.clientWidth] };
    });
    console.log('lobby', JSON.stringify(await q()));
    await page.click('#join');
    await page.waitForSelector('form[data-form="demo-entry"]', { timeout: 20000 });
    await L.sleep(800);
    console.log('consent', JSON.stringify(await page.evaluate(() => { const c = document.querySelector('.panel .consent'); const x = c.getBoundingClientRect(); return [x.width, x.height].map(Math.round); })));
    await L.closeEverything(page);
    await L.enter(page);
    console.log('room', JSON.stringify(await q()));
  } catch (e) { console.error('ERR', e.message.split('\n')[0]); }
  await b.close();
})();
