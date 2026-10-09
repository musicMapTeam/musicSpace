const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  for (const [w, h] of [[1280, 720], [1366, 768]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale: 'zh-CN' });
    const page = await ctx.newPage(); page.setDefaultTimeout(60000);
    await page.goto('http://127.0.0.1:5190/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 120000 });
    await page.click('#join');
    await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"] button[type="submit"]')?.disabled);
    await page.check('form[data-form="demo-entry"] input[name="consent"]');
    await page.click('form[data-form="demo-entry"] button[type="submit"]');
    await page.waitForFunction(() => document.querySelector('.frame')?.dataset.stage === 'room');
    await sleep(5000);
    const r = await page.evaluate(() => {
      const R = e => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; };
      const t = document.querySelector('[data-tour-toggle]'), tr = t.getBoundingClientRect();
      const hit = document.elementFromPoint(tr.left + tr.width / 2, tr.top + tr.height / 2);
      const ws = document.querySelector('.world-shell');
      return { card: R(document.querySelector('.presence')), toggle: R(t), toggleHit: hit === t || t.contains(hit) ? 'self' : `${hit.tagName.toLowerCase()}#${hit.id}.${String(hit.className).split(' ')[0]}`, header: R(document.querySelector('.frame>header')), worldShell: R(ws) };
    });
    console.log(`${w}x${h}`, JSON.stringify(r));
    await page.screenshot({ path: `/tmp/space-doodle/critique/verify-3/base-${w}x${h}-expanded.png` });
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
