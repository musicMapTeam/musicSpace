// Independent repro: enter the example room and measure every projected name tag.
// usage: node tags.cjs <base-url> <w> <h> <label> [exchange]
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const [, , base, W, H, label, mode = ''] = process.argv;
const OUT = '/tmp/space-doodle/verify-19/out'; fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
setTimeout(() => { console.error('watchdog'); process.exit(2); }, 270000).unref();
const measure = () => [...document.querySelectorAll('#hotspots .hotspot')].map(h => {
  const l = h.querySelector('.label'), cs = getComputedStyle(l), r = l.getBoundingClientRect(), hr = h.getBoundingClientRect();
  const range = document.createRange(); range.selectNodeContents(l); const tr = range.getBoundingClientRect();
  return { text: l.textContent, hidden: h.hidden, kind: h.dataset.kind, hotspotW: Math.round(hr.width), hotspotH: Math.round(hr.height),
    clientW: l.clientWidth, scrollW: l.scrollWidth, contentW: l.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
    textW: Math.round(tr.width), truncated: l.scrollWidth > l.clientWidth, ws: cs.whiteSpace, to: cs.textOverflow, ov: cs.overflowX,
    fs: cs.fontSize, ff: cs.fontFamily.split(',')[0], pad: cs.padding, box: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)] };
});
(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    const ctx = await b.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
    await page.locator('#join').click();
    await page.waitForSelector('form[data-form="demo-entry"]');
    await page.locator('form[data-form="demo-entry"] input[name=consent]').check();
    await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"] button[type=submit]')?.disabled, null, { timeout: 60000 });
    await page.locator('form[data-form="demo-entry"] button[type=submit]').click();
    await page.waitForSelector(".frame[data-stage='room']", { timeout: 30000 });
    await sleep(2500);
    const close = page.locator('#panel-close'); if (await close.isVisible().catch(() => false)) { await close.click(); await sleep(500); }
    await sleep(2500);
    await document_fonts(page);
    const stageW = await page.evaluate(() => { const r = document.querySelector('#world').getBoundingClientRect(); return [Math.round(r.width * 10) / 10, Math.round(r.height)]; });
    const m1 = await page.evaluate(measure);
    console.log(JSON.stringify({ label, step: 'room-entered', vp: [+W, +H], stage: stageW, innerW: await page.evaluate(() => innerWidth), tags: m1 }, null, 0));
    await page.screenshot({ path: `${OUT}/${label}-room.png` });
    if (mode === 'exchange') {
      await page.click('[data-tour-action="sample:sample-crowd"]');
      await page.waitForSelector('form[data-form="upload"] .photo-review', { timeout: 30000 });
      await page.waitForSelector('form[data-form="upload"] .moment-chip.is-ai, form[data-form="upload"] .moment-ai-tag', { timeout: 45000 }).catch(() => console.log('no AI'));
      const hasView = await page.evaluate(() => Boolean(document.querySelector('form[data-form="upload"] .moment-chip[aria-pressed="true"]')));
      if (!hasView) await page.click('form[data-form="upload"] .moment-chip[data-moment-viewpoint="crowd"]');
      await page.click('form[data-form="upload"] button[type="submit"]');
      await page.waitForSelector('.moment-wall, .panel .photo-grid', { timeout: 30000 });
      await sleep(2000);
      await page.click('[data-moment-badge] [data-exchange-offer]');
      await page.waitForSelector('.photo-exchanges:not([hidden]) .exchange-pair', { timeout: 20000 });
      await page.check('.photo-exchanges [data-x-consent]');
      await page.waitForFunction(() => !document.querySelector('.photo-exchanges [data-x-send]')?.disabled, null, { timeout: 20000 });
      await page.click('.photo-exchanges [data-x-send]');
      await page.waitForFunction(() => /交换已接受/.test(document.querySelector('.photo-exchanges .exchange-status')?.textContent || ''), null, { timeout: 90000 });
      console.log('exchange accepted');
      await sleep(1000);
      // close everything and return to overview
      for (let i = 0; i < 4; i++) { await page.keyboard.press('Escape'); await sleep(300); }
      for (const sel of ['.photo-exchanges [data-x-close]', '.photo-exchanges header button', '#panel-close']) { const c = page.locator(sel).first(); if (await c.isVisible().catch(() => false)) { await c.click().catch(() => {}); await sleep(500); } }
      await page.locator('nav.camera-nav button[data-view="overview"]').click().catch(() => {});
      await sleep(3500);
      const m2 = await page.evaluate(measure);
      console.log(JSON.stringify({ label, step: 'overview-after-exchange', tags: m2 }));
      await page.screenshot({ path: `${OUT}/${label}-after.png` });
    }
  } catch (e) { console.log('ERR', e.message.split('\n').slice(0, 3).join(' | ')); }
  finally { await b.close(); }
})();
async function document_fonts(page) { await page.evaluate(() => document.fonts.ready); }
