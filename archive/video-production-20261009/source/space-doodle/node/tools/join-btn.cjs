const { launch, open, sleep, OUT } = require('./lib.cjs');
(async () => {
  const browser = await launch();
  for (const [port, tag] of [[8890, 'now'], [8891, 'head']]) for (const vp of ['desktop', 'phone']) {
    const { page, ctx } = await open(browser, vp);
    await page.goto(`http://127.0.0.1:${port}/event-room/`, { waitUntil: 'load' });
    await page.waitForFunction(() => /已连接/.test(document.querySelector('#render-status')?.innerText || ''), null, { timeout: 30000 }); await sleep(2500);
    const cdp = await ctx.newCDPSession(page); await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
    const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '#join' });
    const m = await cdp.send('CSS.getMatchedStylesForNode', { nodeId });
    const rules = m.matchedCSSRules.map(r => ({ sel: r.rule.selectorList.text.slice(0, 120), p: r.rule.style.cssProperties.filter(p => /^(width|max-width|min-width|flex|white-space|padding|font-size|inline-size)$/.test(p.name) && p.text).map(p => p.name + ':' + p.value).join('; ') })).filter(r => r.p);
    const box = await page.evaluate(() => { const b = document.querySelector('#join'); const r = b.getBoundingClientRect(); const pr = b.parentElement.getBoundingClientRect(); return { text: b.innerText, w: Math.round(r.width), h: Math.round(r.height), parentW: Math.round(pr.width), parentCls: b.parentElement.className, lines: Math.round(r.height / parseFloat(getComputedStyle(b).lineHeight || 20)) }; });
    console.log(tag, vp, JSON.stringify(box)); if (tag === 'now' && vp === 'desktop') rules.forEach(r => console.log('   ', r.sel, '=>', r.p));
    await ctx.close();
  }
  await browser.close();
})();
