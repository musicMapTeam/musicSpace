// node probe-toast.cjs <vp> <prefix> : wave to someone, open ♡ within 5 s, tap the × at its centre; tags and nav at this width
const L = require('./lib.cjs');
L.watchdog(250);
const kind = process.argv[2] || 'narrow', prefix = process.argv[3] || 'toast';
(async () => {
  const b = await L.launch();
  const { page } = await L.open(b, kind);
  try {
    await L.enter(page);
    console.log('labels', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('#hotspots .hotspot:not([hidden]) .label')].map(l => { const r = l.getBoundingClientRect(); return `${l.textContent}|${l.scrollWidth}>${l.clientWidth}|${l.scrollHeight}>${l.clientHeight}|h${Math.round(r.height)}`; }))));
    console.log('nav', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.camera-nav button')].map(n => { const cs = getComputedStyle(n), r = n.getBoundingClientRect(); return `${n.textContent.trim()}|${cs.fontSize}|${Math.round(r.width)}x${Math.round(r.height)}|ovf:${n.scrollWidth > n.clientWidth}`; }))));
    console.log('docOverflow', await page.evaluate(() => document.documentElement.scrollWidth > innerWidth));
    await L.shot(page, `${prefix}-room-${kind}`);
    // the people list -> a person -> wave
    await page.click('nav.camera-nav button[data-view=person]');
    await page.waitForSelector('#panel:not([hidden]) [data-person]', { timeout: 15000 });
    await L.sleep(600);
    await page.click('#panel [data-person]');
    await page.waitForSelector('#panel[data-kind="person"]:not([hidden]) [data-social-send]', { timeout: 20000 });
    await L.sleep(600);
    await page.click('#panel [data-social-send]');
    const t0 = Date.now();
    let msg = '';
    while (Date.now() - t0 < 6000) { msg = await page.evaluate(() => document.querySelector('#toast')?.classList.contains('visible') ? document.querySelector('#toast').textContent : ''); if (msg) break; await L.sleep(120); }
    console.log('toast:', msg, 'after', Date.now() - t0, 'ms');
    await page.click('#social-inbox');
    await L.sleep(700);
    const geo = await page.evaluate(() => { const t = document.querySelector('#toast').getBoundingClientRect(), c = document.querySelector('#panel-close').getBoundingClientRect(); const hit = document.elementFromPoint(c.left + c.width / 2, c.top + c.height / 2); return { visible: document.querySelector('#toast').classList.contains('visible'), toast: [t.left, t.top, t.right, t.bottom].map(Math.round), close: [c.left, c.top, c.right, c.bottom].map(Math.round), hit: hit?.id || hit?.tagName, kind: document.querySelector('#panel').dataset.kind }; });
    console.log('geo', JSON.stringify(geo));
    await L.shot(page, `${prefix}-inbox-toast-${kind}`, { settle: 100 });
    const c = await page.evaluate(() => { const r = document.querySelector('#panel-close').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    if (kind === 'desktop') await page.mouse.click(c.x, c.y); else await page.touchscreen.tap(c.x, c.y);
    await L.sleep(500);
    console.log('closedByCentreTap', await page.evaluate(() => document.querySelector('#panel').hidden));
  } catch (e) { console.error('ERR', e.message.split('\n')[0]); await page.screenshot({ path: `${L.OUT}/ERR-toast-${kind}.png` }).catch(() => {}); }
  await b.close();
})();
