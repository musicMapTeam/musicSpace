const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const OUT = '/tmp/space-doodle/verify-8';
const kill = setTimeout(() => { console.error('watchdog'); process.exit(2); }, 270000);
const VIEW = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};
async function fontsFor(page, cdp, selector) {
  const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector });
  if (!nodeId) return null;
  const out = {};
  // walk descendants' text nodes via child elements: ask for each element under selector
  const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId, selector: '*' });
  for (const id of [nodeId, ...nodeIds]) {
    try { const r = await cdp.send('CSS.getPlatformFontsForNode', { nodeId: id }); for (const f of r.fonts) out[f.familyName] = (out[f.familyName] || 0) + f.glyphCount; } catch {}
  }
  return out;
}
(async () => {
  const kind = process.argv[2] || 'phone';
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const ctx = await browser.newContext(VIEW[kind]);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  try {
    await page.goto('http://127.0.0.1:5190/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 120000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1500);
    const info = await page.evaluate(() => {
      const q = s => document.querySelector(s);
      const cs = el => el && { text: el.textContent.trim(), ff: getComputedStyle(el).fontFamily, fs: getComputedStyle(el).fontSize, vis: !!(el.offsetWidth || el.offsetHeight) };
      return { roomTitle: cs(q('#room-title')), captionKey: cs(q('.desktop-caption .caption-key')) };
    });
    console.log(kind, 'first screen', JSON.stringify(info));
    console.log(kind, 'room-title fonts', JSON.stringify(await fontsFor(page, cdp, '#room-title')));
    if (info.roomTitle?.vis) await page.locator('#room-title').screenshot({ path: `${OUT}/${kind}-room-title.png` });
    if (info.captionKey?.vis) {
      console.log(kind, 'caption-key fonts', JSON.stringify(await fontsFor(page, cdp, '.desktop-caption .caption-key')));
      await page.locator('.desktop-caption h2').screenshot({ path: `${OUT}/${kind}-caption.png` });
    }
    await page.screenshot({ path: `${OUT}/${kind}-first-screen.png` });
    await page.locator('button:visible', { hasText: '进入示例现场' }).first().click();
    await page.waitForSelector('form[data-form="demo-entry"] h2', { timeout: 30000 });
    await page.waitForTimeout(1200);
    const h2 = await page.evaluate(() => { const el = document.querySelector('form[data-form="demo-entry"] h2'); const s = getComputedStyle(el); return { text: el.textContent, ff: s.fontFamily, fs: s.fontSize }; });
    console.log(kind, 'join h2', JSON.stringify(h2));
    console.log(kind, 'join h2 fonts', JSON.stringify(await fontsFor(page, cdp, 'form[data-form="demo-entry"] h2')));
    await page.locator('form[data-form="demo-entry"] h2').screenshot({ path: `${OUT}/${kind}-join-h2.png` });
    await page.screenshot({ path: `${OUT}/${kind}-join-form.png` });
    // About sheet heading from the join form
    const about = page.locator('form[data-form="demo-entry"] button[data-open="about"]');
    if (await about.count()) {
      await about.first().scrollIntoViewIfNeeded(); await about.first().click(); await page.waitForTimeout(1200);
      const ah = await page.evaluate(() => { const el = [...document.querySelectorAll('#panel-body h2, #panel-body h1')].find(e => /关于这个示例/.test(e.textContent)); if (!el) return null; el.setAttribute('data-v8', 'about'); const s = getComputedStyle(el); return { text: el.textContent, ff: s.fontFamily, fs: s.fontSize }; });
      console.log(kind, 'about h2', JSON.stringify(ah));
      if (ah) { console.log(kind, 'about h2 fonts', JSON.stringify(await fontsFor(page, cdp, '[data-v8="about"]'))); await page.locator('[data-v8="about"]').screenshot({ path: `${OUT}/${kind}-about-h2.png` }); }
    }
  } catch (e) { console.error('ERR', e.message.split('\n')[0]); await page.screenshot({ path: `${OUT}/ERR-${kind}.png` }).catch(() => {}); }
  await browser.close(); clearTimeout(kill);
})();
