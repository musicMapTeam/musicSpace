// Print the CSS rules that win for selected elements (via CDP CSS.getMatchedStylesForNode), on the Node build after host setup.
// usage: node rules.cjs <port> <selector> [props comma list] [vp]
const { launch, open, sleep } = require('./lib.cjs');
const port = process.argv[2] || '8890';
const selector = process.argv[3] || '#panel .row button';
const props = (process.argv[4] || 'background-color,background,font-size,box-shadow,color').split(',');
const vp = process.argv[5] || 'phone';
(async () => {
  const browser = await launch();
  const { page } = await open(browser, vp);
  const base = `http://127.0.0.1:${port}`;
  await page.goto(`${base}/event-room/`, { waitUntil: 'load' });
  await page.waitForFunction(() => /已连接/.test(document.querySelector('#render-status')?.innerText || ''), null, { timeout: 30000 });
  await sleep(1500);
  await page.getByRole('button', { name: '带上小人，进入现场' }).click(); await sleep(800);
  if (process.env.HOST_ROOM) {
    await page.getByRole('button', { name: /我是主办方/ }).click(); await sleep(700);
    await page.locator('#panel input[name=name]').fill('阿遥');
    await page.getByRole('button', { name: '保存昵称，继续' }).click(); await sleep(900);
    await page.locator('#panel input[name=title]').fill('返场夜'); await page.locator('#panel input[name=venue]').fill('月台 Livehouse');
    await page.locator('#panel input[name=participation][value=open]').check();
    const c = page.locator('#panel input[name=consent]'); if (!(await c.isChecked())) await c.check();
    await page.getByRole('button', { name: '开房并进入现场' }).click(); await sleep(3000);
    await page.locator('[data-open=room]').first().click().catch(() => {}); await sleep(1200);
  }
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
  const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector });
  console.log(selector, 'matches', nodeIds.length);
  for (const nodeId of nodeIds.slice(0, 6)) {
    const { outerHTML } = await cdp.send('DOM.getOuterHTML', { nodeId });
    console.log('\n==', outerHTML.slice(0, 160));
    const m = await cdp.send('CSS.getMatchedStylesForNode', { nodeId });
    for (const r of m.matchedCSSRules) {
      const hit = r.rule.style.cssProperties.filter(p => props.some(q => p.name === q) && !p.disabled && p.text);
      if (!hit.length) continue;
      const sel = r.rule.selectorList.text.replace(/\s+/g, ' ').slice(0, 160);
      console.log(`  [${r.rule.origin}] ${sel}  =>  ${hit.map(p => p.name + ':' + p.value).join('; ').slice(0, 200)}`);
    }
    const comp = await page.evaluate(([s, i]) => { const el = document.querySelectorAll(s)[i]; const c = getComputedStyle(el); return { bg: c.backgroundColor, fs: c.fontSize, sh: c.boxShadow, w: el.getBoundingClientRect().width, cls: el.className }; }, [selector, nodeIds.indexOf(nodeId)]);
    console.log('  computed', JSON.stringify(comp));
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
