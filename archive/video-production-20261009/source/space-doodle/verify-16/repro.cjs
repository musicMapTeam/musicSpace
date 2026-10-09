// verify-16: independent repro of "room menu / 我的现场 = wall of ink primary slabs with broken wraps". Read-only.
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const OUT = '/tmp/space-doodle/verify-16/shots';
const URL = process.env.SPACE_URL || 'http://127.0.0.1:5190/';
const VP = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  narrow: { viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const kill = setTimeout(() => { console.error('watchdog'); process.exit(2); }, 270000);
async function measure(page) {
  return page.evaluate(() => {
    const body = document.querySelector('#panel-body');
    const panel = document.querySelector('#panel');
    const out = { kind: panel?.dataset.kind, panelW: Math.round(panel.getBoundingClientRect().width), bodyW: Math.round(body.getBoundingClientRect().width), buttons: [] };
    for (const b of body.querySelectorAll('button')) {
      const r = b.getBoundingClientRect(); if (!r.width) continue;
      const cs = getComputedStyle(b);
      // count rendered lines of the label via a Range over its text
      const range = document.createRange(); range.selectNodeContents(b);
      const tops = [...new Set([...range.getClientRects()].map(x => Math.round(x.top)))];
      // per-character line positions to show the break
      const walker = document.createTreeWalker(b, NodeFilter.SHOW_TEXT); let lines = []; let cur = '', lastTop = null; let n;
      while ((n = walker.nextNode())) { for (let i = 0; i < n.length; i++) { const rr = document.createRange(); rr.setStart(n, i); rr.setEnd(n, i + 1); const rc = rr.getClientRects()[0]; if (!rc) continue; const t = Math.round(rc.top); if (lastTop !== null && Math.abs(t - lastTop) > 4) { lines.push(cur); cur = ''; } cur += n.data[i]; lastTop = t; } }
      if (cur) lines.push(cur);
      out.buttons.push({ text: b.textContent.trim().replace(/\s+/g, ' ').slice(0, 40), cls: b.className, open: b.dataset.open || '', parent: b.parentElement === body ? 'body' : (b.parentElement.className || b.parentElement.tagName), w: Math.round(r.width), h: Math.round(r.height), y: Math.round(r.top), bg: cs.backgroundColor, fg: cs.color, shadow: cs.boxShadow.slice(0, 40), font: cs.fontSize + ' ' + cs.fontFamily.split(',')[0], ws: cs.whiteSpace, lines });
    }
    return out;
  });
}
(async () => {
  const kinds = (process.argv[2] || 'phone,desktop').split(',');
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    for (const kind of kinds) {
      const ctx = await browser.newContext({ ...VP[kind] });
      const page = await ctx.newPage();
      page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 160)));
      await page.goto(URL, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
      await page.waitForFunction(() => document.querySelector('#loading')?.hidden === true, null, { timeout: 60000 }).catch(() => console.log('loading never hid'));
      await page.evaluate(() => document.fonts.ready);
      await sleep(800);
      await page.locator('button:visible', { hasText: '进入示例现场' }).first().click();
      await page.waitForSelector('form[data-form="demo-entry"]', { timeout: 20000 });
      await page.locator('form[data-form="demo-entry"] input[name=consent]').check();
      await page.waitForSelector('form[data-form="demo-entry"] button[type=submit]:not([disabled])', { timeout: 60000 });
      await page.locator('form[data-form="demo-entry"] button[type=submit]').click();
      await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"]'), null, { timeout: 60000 });
      await page.waitForFunction(() => (window.__SPACE_EVENT_QA__?.()?.members || []).length > 1, null, { timeout: 30000 }).catch(() => console.log('members never arrived'));
      await sleep(2500);
      // room menu via the header ···
      await page.click('#room-info');
      await page.waitForFunction(() => document.querySelector('#panel')?.dataset.kind === 'room' && !document.querySelector('#panel').hidden, null, { timeout: 15000 });
      await page.evaluate(() => document.fonts.ready); await sleep(1200);
      await page.evaluate(() => document.activeElement?.blur?.());
      // scroll the 3-up row into view
      await page.evaluate(() => document.querySelector('#panel-body .row button[data-open=recap]')?.scrollIntoView({ block: 'center' }));
      await sleep(500);
      await page.screenshot({ path: `${OUT}/room-menu-${kind}.png` });
      const m1 = await measure(page);
      console.log(kind, 'ROOM', JSON.stringify(m1, null, 0));
      const row = await page.$('#panel-body > .row');
      if (row) { const bb = await row.boundingBox(); await page.screenshot({ path: `${OUT}/room-menu-row-${kind}.png`, clip: { x: Math.max(0, bb.x - 20), y: Math.max(0, bb.y - 20), width: Math.min(bb.width + 40, VP[kind].viewport.width), height: bb.height + 300 } }); }
      // 我的现场
      await page.click('#panel-body .row button[data-open=rooms]');
      await page.waitForFunction(() => document.querySelector('#panel')?.dataset.kind === 'rooms', null, { timeout: 15000 });
      await sleep(1500);
      await page.evaluate(() => document.activeElement?.blur?.());
      await page.evaluate(() => { const b = document.querySelector('#panel-body'); const btn = b.querySelector(':scope > button.primary'); btn?.scrollIntoView({ block: 'center' }); });
      await sleep(500);
      await page.screenshot({ path: `${OUT}/my-rooms-${kind}.png` });
      const m2 = await measure(page);
      console.log(kind, 'ROOMS', JSON.stringify(m2, null, 0));
      await ctx.close();
    }
  } catch (e) { console.error('ERR', e.message.split('\n')[0]); }
  await browser.close();
  clearTimeout(kill);
})();
