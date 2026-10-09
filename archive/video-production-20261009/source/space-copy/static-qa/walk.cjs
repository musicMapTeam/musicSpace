// Walk the screens the static copy touches, at one viewport: screenshots + text + overflow probe.
const L = require('./lib.cjs');
L.watchdog(285);
const vp = process.argv[2] || 'phone';
const only = process.argv[3] || 'all';

/** Elements under `selector` that stick out of the viewport sideways, or that scroll sideways themselves. */
function overflow(page, selector = 'body') {
  return page.evaluate(selector => {
    const vw = document.documentElement.clientWidth;
    const out = [];
    if (document.documentElement.scrollWidth > vw + 1) out.push(`page scrollWidth ${document.documentElement.scrollWidth} > ${vw}`);
    for (const root of document.querySelectorAll(selector)) {
      for (const el of [root, ...root.querySelectorAll('*')]) {
        const rects = el.getClientRects();
        if (!rects.length) continue;
        const style = getComputedStyle(el);
        if (style.visibility === 'hidden' || style.position === 'fixed' && el.id === 'space-boot-banner') continue;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        if (el.closest('.sr-only') || style.clipPath === 'inset(50%)') continue;
        const name = `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''}`;
        if (r.right > vw + 1 || r.left < -1) out.push(`${name} sticks out: ${Math.round(r.left)}..${Math.round(r.right)} of ${vw} «${(el.textContent || '').trim().slice(0, 30)}»`);
        if (el.scrollWidth > el.clientWidth + 1 && ['auto', 'scroll', 'hidden'].includes(style.overflowX) && !['svg', 'canvas'].includes(el.tagName.toLowerCase()) && el.clientWidth > 0) out.push(`${name} overflows inside: ${el.scrollWidth} > ${el.clientWidth} «${(el.textContent || '').trim().slice(0, 30)}»`);
      }
    }
    return [...new Set(out)].slice(0, 40);
  }, selector);
}
async function probe(page, label, selector) {
  const issues = await overflow(page, selector);
  console.log(`--- overflow ${label}: ${issues.length ? '\n    ' + issues.join('\n    ') : 'none'}`);
}
/** Small tap targets among visible buttons/links/summary/inputs under selector. */
function targets(page, selector) {
  return page.evaluate(selector => {
    const out = [];
    for (const root of document.querySelectorAll(selector)) for (const el of root.querySelectorAll('button, a[href], summary, input[type=checkbox], input[type=radio], label.consent, select')) {
      if (!el.getClientRects().length) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      const box = el.matches('input[type=checkbox], input[type=radio]') ? (el.closest('label')?.getBoundingClientRect() || r) : r;
      if (box.height < 43.5 || box.width < 43.5) out.push(`${el.tagName.toLowerCase()} ${Math.round(box.width)}x${Math.round(box.height)} «${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 24)}»`);
    }
    return out;
  }, selector);
}
async function tapCheck(page, label, selector) {
  const small = await targets(page, selector);
  console.log(`--- small targets ${label}: ${small.length ? '\n    ' + small.join('\n    ') : 'none'}`);
}
async function sheetShots(page, name) {
  // the sheet scrolls: shoot top, middle, bottom
  const h = await page.evaluate(() => { const p = document.querySelector('#panel'); return p ? { sh: p.scrollHeight, ch: p.clientHeight } : null; });
  await L.shot(page, `${name}-top-${vp}`);
  if (h && h.sh > h.ch + 40) {
    const steps = Math.min(4, Math.ceil((h.sh - h.ch) / (h.ch * 0.8)));
    for (let i = 1; i <= steps; i++) {
      await page.evaluate(([i, steps]) => { const p = document.querySelector('#panel'); p.scrollTop = (p.scrollHeight - p.clientHeight) * i / steps; }, [i, steps]);
      await L.sleep(250);
      await L.shot(page, `${name}-s${i}-${vp}`);
    }
    await page.evaluate(() => { document.querySelector('#panel').scrollTop = 0; });
  }
}

(async () => {
  const browser = await L.launch();
  try {
    const run = await L.open(browser, vp);
    const { page } = run;
    await L.sleep(800);
    await L.grab(page, 'lobby', '.frame');
    await L.shot(page, `01-lobby-${vp}`);
    await probe(page, 'lobby', 'body');
    await tapCheck(page, 'lobby footer', '.frame > footer');
    await L.press(run, '#join');
    await page.waitForSelector('form[data-form="demo-entry"]', { timeout: 30000 });
    await L.sleep(600);
    await L.grab(page, 'entry', '#panel');
    await sheetShots(page, '02-entry');
    await page.locator('#panel details.demo-entry-more summary').first().evaluate(s => s.click());
    await L.sleep(400);
    await page.evaluate(() => { const p = document.querySelector('#panel'); p.scrollTop = p.scrollHeight; });
    await L.sleep(300);
    await L.shot(page, `03-entry-more-${vp}`);
    await probe(page, 'entry', '#panel');
    await tapCheck(page, 'entry', '#panel');
    // About from the entry
    await page.locator('#panel [data-open="about"]').first().evaluate(b => b.click());
    await L.sleep(800);
    await L.grab(page, 'about', '#panel');
    await sheetShots(page, '04-about');
    await probe(page, 'about', '#panel');
    await tapCheck(page, 'about', '#panel');
    await L.closeSheet(run);
    if (only === 'lobby') return;
    await L.enter(run);
    await L.sleep(1000);
    await L.grab(page, 'room-tour', '#demo-tour');
    await L.shot(page, `05-room-tour-${vp}`);
    await probe(page, 'room', 'body');
    await tapCheck(page, 'tour', '#demo-tour');
    await tapCheck(page, 'footer', '.frame > footer');
    // collapsed tour
    await page.locator('[data-tour-toggle]').first().evaluate(b => b.click());
    await L.sleep(500);
    await L.shot(page, `06-room-tour-collapsed-${vp}`);
    await page.locator('[data-tour-toggle]').first().evaluate(b => b.click());
    await L.sleep(300);
    // room panel (本场信息)
    await page.locator('#join').first().evaluate(b => b.click());
    await L.sleep(800);
    await L.grab(page, 'room-panel', '#panel');
    await sheetShots(page, '07-room-panel');
    await probe(page, 'room-panel', '#panel');
    await L.closeSheet(run);
    // people
    await L.clickHidden(page, { open: 'people' });
    await L.sleep(800);
    await L.grab(page, 'people', '#panel');
    await L.shot(page, `08-people-${vp}`);
    await L.closeSheet(run);
    // the sample photo from the tour
    await L.press(run, '[data-tour-action="sample:sample-crowd"]');
    await page.waitForSelector('form[data-form="upload"] .photo-review', { timeout: 30000 });
    await L.sleep(2500);
    await L.grab(page, 'upload', '#panel');
    await sheetShots(page, '09-upload');
    await probe(page, 'upload', '#panel');
    const chosen = await page.evaluate(() => Boolean(document.querySelector('form[data-form="upload"] .moment-chip[aria-pressed="true"]')));
    if (!chosen) await page.locator('form[data-form="upload"] .moment-chip[data-moment-viewpoint="crowd"]').first().evaluate(b => b.click());
    await page.locator('form[data-form="upload"] button[type="submit"]').first().evaluate(b => b.click());
    await page.locator('#panel [data-exchange-offer]').first().waitFor({ state: 'attached', timeout: 45000 }).catch(() => console.log('no exchange offer seen'));
    await L.sleep(800);
    await L.closeSheet(run);
    await L.sleep(800);
    await L.grab(page, 'tour-after-photo', '#demo-tour');
    await L.shot(page, `10-tour-step2-${vp}`);
    await L.log(page, 'log');
    L.save(`walk-${vp}`);
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); } finally { await browser.close(); }
})();
