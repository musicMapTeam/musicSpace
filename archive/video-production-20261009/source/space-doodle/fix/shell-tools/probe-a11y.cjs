// node probe-a11y.cjs <vp> <prefix> : tab order behind an open sheet, brand / consent hit areas, drawer tapes
const L = require('./lib.cjs');
L.watchdog(250);
const kind = process.argv[2] || 'phone', prefix = process.argv[3] || 'a11y';
(async () => {
  const b = await L.launch();
  const { page } = await L.open(b, kind);
  try {
    console.log('brand', JSON.stringify(await page.evaluate(() => { const r = document.querySelector('.frame>header .brand').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })));
    await page.click('#join');
    await page.waitForSelector('form[data-form="demo-entry"]');
    await L.sleep(800);
    // consent: a tap 8px above / below the text box lands on the label
    console.log('consent', JSON.stringify(await page.evaluate(() => { const c = document.querySelector('.panel .consent'), r = c.getBoundingClientRect(), cb = c.querySelector('input'); const q = cb.getBoundingClientRect(); const at = (x, y) => { const h = document.elementFromPoint(x, y); return h ? (h === c || c.contains(h) ? 'label' : `${h.tagName.toLowerCase()}.${String(h.className).split(' ')[0]}`) : null; }; return { box: [Math.round(r.width), Math.round(r.height)], above: at(r.left + 40, r.top - 8), below: at(r.left + 40, r.bottom + 8), onBox: at(q.left + q.width / 2, q.top + q.height / 2) === 'label' ? document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2).tagName : 'other' }; })));
    // Tab through: does focus ever land on something hidden behind the sheet?
    await page.focus('#panel-close');
    const stops = [];
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      const s = await page.evaluate(() => { const a = document.activeElement; if (!a || a === document.body) return null; const inPanel = !!a.closest('#panel'); const cs = getComputedStyle(a); return `${inPanel ? 'P' : 'O'}:${a.id || a.className || a.tagName}:${cs.visibility}`; });
      stops.push(s);
    }
    const outside = [...new Set(stops.filter(s => s && s.startsWith('O')))];
    console.log('outside-panel tab stops', JSON.stringify(outside));
    console.log('scene-details', await page.evaluate(() => getComputedStyle(document.querySelector('#scene-details')).visibility));
    await L.closeEverything(page);
    console.log('scene-details after close', await page.evaluate(() => getComputedStyle(document.querySelector('#scene-details')).visibility));
    await L.enter(page);
    // 我的空间 drawer: the window's tapes step away
    await page.click('#my-space');
    await page.waitForSelector('.community-panel.personal-space:not([hidden])', { timeout: 20000 }).catch(() => console.log('no personal drawer'));
    await L.sleep(1200);
    console.log('drawer', JSON.stringify(await page.evaluate(() => { const d = document.querySelector('.community-panel:not([hidden])'); return { parentIsFrame: d?.parentElement?.classList.contains('frame'), tapes: [getComputedStyle(document.querySelector('.world-shell'), '::before').visibility, getComputedStyle(document.querySelector('.world-shell'), '::after').visibility] }; })));
    await L.shot(page, `${prefix}-myspace-${kind}`);
  } catch (e) { console.error('ERR', e.message.split('\n')[0]); }
  await b.close();
})();
