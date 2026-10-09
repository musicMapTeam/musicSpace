// Does anything in the memory-card sheet (z-index:2 checkboxes) take the ×'s place when the × is at the old z-index 2? And at 3?
const S = require('./sheets.cjs');
const path = require('path');
S.watchdog(250);
const vp = process.argv[2] || 'phone';
const OUT = '/tmp/space-doodle/shots/panels';
const scan = page => page.evaluate(async () => {
  const p = document.querySelector('#panel'), c = document.querySelector('#panel-close');
  const frame = () => new Promise(r => requestAnimationFrame(() => r()));
  const bad = [];
  for (let y = 0; y <= p.scrollHeight - p.clientHeight + 10; y += 6) {
    p.scrollTop = y; await frame();
    const r = c.getBoundingClientRect();
    for (const [fx, fy] of [[0.5, 0.5], [0.25, 0.5], [0.75, 0.5], [0.5, 0.25], [0.5, 0.75]]) {
      const hit = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy);
      if (hit && !(hit === c || c.contains(hit))) { bad.push({ y: p.scrollTop, at: [fx, fy], hit: hit.tagName + '.' + (hit.getAttribute('class') || '') + (hit.type ? '[' + hit.type + ']' : '') }); break; }
    }
  }
  return bad;
});
(async () => {
  const browser = await S.launch();
  try {
    const run = await S.open(browser, vp);
    const { page } = run;
    await S.enter(run);
    await S.press(run, '[data-tour-action="sample:sample-crowd"]');
    await page.waitForSelector('form[data-form="upload"] .photo-review', { timeout: 30000 });
    await S.aiSettled(page); await S.sleep(800);
    const chosen = await page.evaluate(() => Boolean(document.querySelector('form[data-form="upload"] .moment-chip[aria-pressed="true"]')));
    if (!chosen) await S.press(run, 'form[data-form="upload"] .moment-chip[data-moment-viewpoint="crowd"]');
    await S.press(run, 'form[data-form="upload"] button[type="submit"]');
    await page.locator('#panel [data-moment-badge] [data-exchange-offer]').first().waitFor({ state: 'attached', timeout: 45000 });
    await S.press(run, '#panel-close'); await S.sleep(300);
    await S.press(run, '#room-info'); await S.sleep(500);
    await page.locator('#panel [data-open="recap"]').first().evaluate(b => b.click());
    await page.waitForSelector('.panel[data-kind="recap"] .photo-grid .photo-item', { timeout: 30000 });
    await S.sleep(2500);
    await page.waitForSelector('.panel[data-kind="recap"] [data-open="memory-card"]:not([disabled])', { timeout: 30000 });
    await page.locator('.panel[data-kind="recap"] [data-open="memory-card"]:not([disabled])').first().evaluate(b => b.click());
    await S.sleep(2500);
    console.log('after click', JSON.stringify(await page.evaluate(() => ({ kind: document.querySelector('#panel').dataset.kind, hidden: document.querySelector('#panel').hidden, opens: [...document.querySelectorAll('#panel [data-open]')].map(b => b.dataset.open + (b.disabled ? '(disabled)' : '')), toast: document.querySelector('#toast')?.textContent }))));
    await page.waitForSelector('.panel[data-kind="memory-card"]', { timeout: 20000 });
    await S.sleep(2500);
    console.log('memory sheet', JSON.stringify(await page.evaluate(() => ({ kind: document.querySelector('#panel').dataset.kind, options: document.querySelector('.memory-photo-options')?.innerHTML.slice(0, 300), boxes: document.querySelectorAll('#panel input[type="checkbox"]').length }))));
    await page.waitForSelector('.panel[data-kind="memory-card"] input[type="checkbox"]', { state: 'attached', timeout: 20000 });
    await S.sleep(1200);
    const info = await page.evaluate(() => [...document.querySelectorAll('#panel input[type="checkbox"]')].slice(0, 2).map(i => { const cs = getComputedStyle(i); const b = i.getBoundingClientRect(); return { z: cs.zIndex, pos: cs.position, rect: [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)] }; }));
    console.log('checkboxes', JSON.stringify(info));
    console.log('z=3 bad', JSON.stringify((await scan(page)).slice(0, 4)));
    await page.addStyleTag({ content: '.panel>#panel-close{z-index:2!important}' });
    const bad2 = await scan(page);
    console.log('z=2 bad', JSON.stringify(bad2.slice(0, 4)), 'count', bad2.length);
    if (bad2.length) {
      await page.evaluate(y => { document.querySelector('#panel').scrollTop = y; }, bad2[0].y);
      await S.sleep(200);
      const r = await page.evaluate(() => { const b = document.querySelector('#panel-close').getBoundingClientRect(); return { x: Math.round(b.left - 60), y: Math.round(b.top - 40), width: 130, height: 130 }; });
      await page.screenshot({ path: path.join(OUT, `ztest-memory-before-${vp}.png`), clip: r });
      await page.evaluate(() => document.querySelectorAll('style').forEach(s => { if (s.textContent.includes('z-index:2!important')) s.remove(); }));
      await S.sleep(200);
      await page.screenshot({ path: path.join(OUT, `ztest-memory-after-${vp}.png`), clip: r });
      console.log('saved memory crops at y', bad2[0].y);
    }
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); } finally { await browser.close(); }
})();
