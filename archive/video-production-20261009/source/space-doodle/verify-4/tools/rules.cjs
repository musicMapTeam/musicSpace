// verify-4: list matched CSS rules (selector + selected props) for a selector inside the opened room panel.
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const base = process.argv[2] || 'http://127.0.0.1:5190/';
const sel = process.argv[3] || '#panel .row > button';
const props = (process.argv[4] || 'flex,flex-grow,flex-basis,font-size,padding,background,background-color,white-space,min-width,width,border,box-shadow').split(',');
(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'zh-CN' });
    const page = await ctx.newPage();
    await page.goto(base, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 }); await sleep(2000);
    await page.getByRole('button', { name: /进入示例现场/ }).first().click(); await sleep(1200);
    const consent = page.locator('#panel input[type=checkbox]').first();
    if (await consent.isVisible().catch(() => false)) await consent.check();
    await page.getByRole('button', { name: /进入示例现场/ }).last().click(); await sleep(4500);
    await page.locator('[data-open=room]:visible').first().click(); await sleep(1500);
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
    const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: sel });
    const m = await cdp.send('CSS.getMatchedStylesForNode', { nodeId });
    const sheets = {};
    cdp.on('CSS.styleSheetAdded', e => { sheets[e.header.styleSheetId] = e.header.sourceURL; });
    for (const r of m.matchedCSSRules) {
      const rule = r.rule; if (rule.origin !== 'regular') continue;
      const hits = rule.style.cssProperties.filter(p => props.some(q => p.name === q) && p.text);
      if (!hits.length) continue;
      const matched = r.matchingSelectors.map(i => rule.selectorList.selectors[i].text).join(' , ');
      const src = rule.styleSheetId;
      console.log(`[${(rule.media||[]).map(x=>x.text).join(' ')}] ${matched}  ==> ${hits.map(p => p.name + ':' + p.value + (p.important ? '!' : '')).join('; ')}   (sheet ${src}, line ${rule.style.range ? rule.style.range.startLine : '?'})`);
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
