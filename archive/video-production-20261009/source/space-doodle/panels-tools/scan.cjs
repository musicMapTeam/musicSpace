// Scroll every long #panel sheet in 30px steps: the × must be the top element at its centre at every offset (nothing in a sheet paints over
// it or takes its tap). Also: the wall's taped best card scrolled under the ×, with the old z-index 2 and with 3, for a before/after crop.
// usage: node scan.cjs <phone|desktop|narrow>
const S = require('./sheets.cjs');
const path = require('path');
S.watchdog(285);
const vp = process.argv[2] || 'phone';
const OUT = process.env.SHOTS_OUT || '/tmp/space-doodle/shots/panels';
const log = (label, value) => console.log(`${label} ${JSON.stringify(value)}`);

const scan = page => page.evaluate(async () => {
  const p = document.querySelector('#panel'), c = document.querySelector('#panel-close');
  const frame = () => new Promise(r => requestAnimationFrame(() => r()));
  const bad = [];
  let steps = 0;
  for (let y = 0; y <= p.scrollHeight - p.clientHeight + 30; y += 30) {
    p.scrollTop = y; await frame(); steps++;
    const r = c.getBoundingClientRect(), pr = p.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const inside = r.top >= pr.top && r.bottom <= pr.bottom;
    if (!hit || !(hit === c || c.contains(hit)) || !inside) bad.push({ y: p.scrollTop, hit: hit ? hit.tagName + '.' + (hit.getAttribute('class') || '') : null, inside });
  }
  p.scrollTop = 0;
  return { kind: p.dataset.kind, steps, bad };
});

(async () => {
  const browser = await S.launch();
  try {
    const run = await S.open(browser, vp);
    const { page } = run;
    await S.press(run, '#join');
    await page.waitForSelector('form[data-form="demo-entry"]');
    await S.sleep(600);
    log('scan:join', await scan(page));
    await page.keyboard.press('Escape');
    await S.sleep(300);
    await S.enter(run);
    await S.press(run, '#room-info'); await S.sleep(600);
    log('scan:menu', await scan(page));
    await page.locator('#panel [data-open="about"]').first().evaluate(b => b.click()); await S.sleep(600);
    log('scan:about', await scan(page));
    await S.press(run, '#panel-close'); await S.sleep(300);
    await S.press(run, '[data-tour-action="sample:sample-crowd"]');
    await page.waitForSelector('form[data-form="upload"] .photo-review', { timeout: 30000 });
    await S.aiSettled(page); await S.sleep(1200);
    log('scan:upload', await scan(page));
    const chosen = await page.evaluate(() => Boolean(document.querySelector('form[data-form="upload"] .moment-chip[aria-pressed="true"]')));
    if (!chosen) await S.press(run, 'form[data-form="upload"] .moment-chip[data-moment-viewpoint="crowd"]');
    await S.press(run, 'form[data-form="upload"] button[type="submit"]');
    await page.locator('#panel [data-moment-badge] [data-exchange-offer]').first().waitFor({ state: 'attached', timeout: 45000 });
    await page.waitForFunction(() => [...document.querySelectorAll('#panel .moment-card img')].every(i => i.complete && i.naturalWidth), null, { timeout: 30000 }).catch(() => {});
    await S.sleep(800);
    log('scan:wall', await scan(page));
    // the best card's tape (z-index 2) right under the ×: old z-index 2 vs the new 3
    const clip = await page.evaluate(() => {
      const p = document.querySelector('#panel'), c = document.querySelector('#panel-close'), card = document.querySelector('#panel .moment-card--best');
      const cr = c.getBoundingClientRect();
      const tape = getComputedStyle(card, '::before');
      // scroll so the card's top edge (where its tape sits) passes the × centre
      p.scrollTop += card.getBoundingClientRect().top - (cr.top + cr.height / 2) + 4;
      const r = c.getBoundingClientRect();
      return { x: Math.max(0, Math.round(r.left - 70)), y: Math.max(0, Math.round(r.top - 30)), width: 130, height: 110, tapeZ: tape.zIndex, tapeContent: tape.content };
    });
    log('wall:tape', clip);
    await S.sleep(300);
    const crop = { x: clip.x, y: clip.y, width: clip.width, height: clip.height };
    await page.screenshot({ path: path.join(OUT, `ztest-after-${vp}.png`), clip: crop });
    await page.addStyleTag({ content: '.panel>#panel-close{z-index:2!important}' });
    await S.sleep(200);
    await page.screenshot({ path: path.join(OUT, `ztest-before-${vp}.png`), clip: crop });
    console.log('saved ztest crops');
    await page.evaluate(() => document.querySelectorAll('style').forEach(s => { if (s.textContent.includes('z-index:2!important')) s.remove(); }));
    await S.press(run, '#panel-close'); await S.sleep(300);
    await S.press(run, '#room-info'); await S.sleep(500);
    await page.locator('#panel [data-open="recap"]').first().evaluate(b => b.click());
    await page.waitForSelector('.panel[data-kind="recap"] .photo-grid .photo-item', { timeout: 30000 });
    await S.sleep(1200);
    log('scan:recap', await scan(page));
    const memory = page.locator('.panel[data-kind="recap"] [data-open="memory-card"]:not([disabled])');
    if (await memory.count()) {
      await memory.first().evaluate(b => b.click());
      await page.waitForSelector('.panel[data-kind="memory-card"]', { timeout: 20000 });
      await S.sleep(1200);
      log('memory:open', await S.measure(page));
      log('scan:memory-card', await scan(page));
    } else log('memory', 'no enabled memory-card button');
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); } finally { await browser.close(); }
})();
