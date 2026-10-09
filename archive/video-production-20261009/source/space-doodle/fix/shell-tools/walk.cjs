// node walk.cjs <vp> <prefix> [dir]   first screen, entry sheet, room (tour open), ··· room sheet, 我的现场, person card, wall + toast
const L = require('./lib.cjs');
L.watchdog(290);
const kind = process.argv[2] || 'phone';
const prefix = process.argv[3] || 'base';
const dir = process.argv[4] || L.OUT;
const sleep = L.sleep;
const shot = (page, name, o = {}) => L.shot(page, `${prefix}-${name}-${kind}`, { dir, ...o });
async function info(page, label, fn, arg) { try { console.log(label, JSON.stringify(await page.evaluate(fn, arg))); } catch (e) { console.log(label, 'ERR', e.message.split('\n')[0]); } }
const rowInfo = () => [...document.querySelectorAll('#panel-body button.primary')].filter(b => b.getClientRects().length).map(b => { const r = b.getBoundingClientRect(), cs = getComputedStyle(b); return `${b.textContent.trim().slice(0, 12)}|${Math.round(r.width)}x${Math.round(r.height)}|${cs.fontSize}|${cs.backgroundColor}`; });
(async () => {
  const b = await L.launch();
  const { page } = await L.open(b, kind);
  try {
    await shot(page, 'first');
    await page.click('#join');
    await page.waitForSelector('form[data-form="demo-entry"]', { timeout: 20000 });
    await sleep(900);
    await shot(page, 'join');
    await info(page, 'join', () => { const c = document.querySelector('form[data-form="demo-entry"] .consent'), s = document.querySelector('form[data-form="demo-entry"] button[type=submit]'), p = document.querySelector('#panel').getBoundingClientRect(); const r = c.getBoundingClientRect(), q = s.getBoundingClientRect(); return { panel: [p.top, p.bottom].map(Math.round), consent: [r.top, r.bottom].map(Math.round), submit: [q.top, q.bottom].map(Math.round), scroll: document.querySelector('#panel').scrollHeight - document.querySelector('#panel').clientHeight }; });
    await L.enter(page);
    await sleep(1200);
    await shot(page, 'room');
    await info(page, 'cover', () => null);
    console.log('cover', JSON.stringify(await L.cover(page)));
    await info(page, 'labels', () => [...document.querySelectorAll('#hotspots .hotspot:not([hidden]) .label')].map(l => `${l.textContent}|${l.scrollWidth}>${l.clientWidth}|${l.scrollHeight}>${l.clientHeight}`));
    // ··· room sheet
    await page.click('#room-info');
    await sleep(1300);
    await shot(page, 'roommenu');
    await info(page, 'roommenu', rowInfo);
    await page.evaluate(() => { const p = document.querySelector('#panel'); p.scrollTop = 99999; });
    await sleep(400);
    await shot(page, 'roommenu-end');
    // 我的现场
    await page.evaluate(() => { const p = document.querySelector('#panel'); p.scrollTop = 0; });
    await page.click('#panel-body [data-open="rooms"]');
    await sleep(1300);
    await shot(page, 'rooms');
    await info(page, 'rooms', rowInfo);
    await L.closeEverything(page);
    // person card
    const person = page.locator('#hotspots .hotspot[data-kind="person"]:not([hidden])').first();
    if (await person.count()) {
      await person.click({ force: true });
      await page.waitForSelector("#context-buttons [data-open=person]", { timeout: 15000 }).catch(() => {});
      await L.sleep(800);
      await page.click("#context-buttons [data-open=person]").catch(e => console.log("no 认识一下", e.message.split("\n")[0]));
      await page.waitForSelector('#panel[data-kind="person"]:not([hidden])', { timeout: 15000 }).catch(() => console.log('no person card'));
      await sleep(1200);
      await shot(page, 'person');
      await info(page, 'person', () => { const p = document.querySelector('#panel'); const cs = getComputedStyle(p); return { bt: cs.borderTop, sh: cs.boxShadow }; });
      await L.closeEverything(page);
      await page.click('nav.camera-nav button[data-view=overview]').catch(() => {});
      await sleep(2200);
    }
    // the tour's sample photo -> save -> wall + toast
    const sample = page.locator('[data-tour-action^="sample:"]').first();
    if (await sample.count()) {
      await sample.click();
      await page.waitForSelector('form[data-form="upload"] .photo-review', { timeout: 30000 });
      await sleep(1500);
      const hasView = await page.evaluate(() => Boolean(document.querySelector('form[data-form="upload"] .moment-chip[aria-pressed="true"]')));
      if (!hasView) await page.click('form[data-form="upload"] .moment-chip[data-moment-viewpoint="crowd"]');
      await page.click('form[data-form="upload"] button[type="submit"]');
      const t0 = Date.now();
      while (Date.now() - t0 < 6000) { const t = await page.evaluate(() => document.querySelector('#toast')?.classList.contains('visible') ? document.querySelector('#toast').textContent : ''); if (t) { console.log('toast:', t); break; } await sleep(150); }
      await page.waitForSelector('.panel .moment-wall, .panel .photo-grid', { timeout: 30000 }).catch(() => {});
      await sleep(700);
      await shot(page, 'wall-toast', { settle: 200 });
      await info(page, 'toast', () => { const t = document.querySelector('#toast').getBoundingClientRect(), c = document.querySelector('#panel-close').getBoundingClientRect(); const hit = document.elementFromPoint(c.left + c.width / 2, c.top + c.height / 2); return { toast: [t.left, t.top, t.right, t.bottom].map(Math.round), close: [c.left, c.top, c.right, c.bottom].map(Math.round), closeHit: hit?.id || hit?.tagName, pe: getComputedStyle(document.querySelector('#toast')).pointerEvents }; });
      await sleep(5200);
      await shot(page, 'wall');
    }
    console.log('logs', JSON.stringify(page.__logs.slice(0, 6)));
  } catch (e) { console.error('ERR', e.message.split('\n')[0]); await page.screenshot({ path: `${dir}/ERR-walk-${prefix}-${kind}.png` }).catch(() => {}); }
  await b.close();
})();
