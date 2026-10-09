// node probe-mini.cjs <vp> <prefix>: the room chat's mini stage heading
const L = require('./lib.cjs');
L.watchdog(200);
const kind = process.argv[2] || 'phone', prefix = process.argv[3] || 'mini';
(async () => {
  const b = await L.launch();
  const { page } = await L.open(b, kind);
  try {
    await L.enter(page);
    await page.click('#room-info');
    await L.sleep(1000);
    await page.click('#panel-body [data-open="conversation"]');
    await page.waitForFunction(() => document.querySelector('.frame').classList.contains('conversation-open'), null, { timeout: 15000 });
    await L.sleep(2500);
    console.log('mini', JSON.stringify(await page.evaluate(() => { const s = document.querySelector('#scene-heading small'), h = document.querySelector('#scene-heading'); const r = s.getBoundingClientRect(), q = h.getBoundingClientRect(); return { small: [getComputedStyle(s).fontSize, getComputedStyle(s).whiteSpace, Math.round(r.width), Math.round(r.height), s.scrollWidth, s.clientWidth], heading: [Math.round(q.width), Math.round(q.height)], n: document.querySelectorAll('.scene-heading').length }; })));
    await L.shot(page, `${prefix}-mini-stage-${kind}`);
  } catch (e) { console.error('ERR', e.message.split('\n')[0]); }
  await b.close();
})();
