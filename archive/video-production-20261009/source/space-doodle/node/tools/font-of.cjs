// computed font-family + rendered font for a selector after hosting a room
const { launch, open, sleep } = require('./lib.cjs');
(async () => {
  const browser = await launch(); const { page } = await open(browser, 'phone');
  await page.goto('http://127.0.0.1:8890/event-room/', { waitUntil: 'load' });
  await page.waitForFunction(() => /已连接/.test(document.querySelector('#render-status')?.innerText || ''), null, { timeout: 30000 }); await sleep(1500);
  await page.getByRole('button', { name: '带上小人，进入现场' }).click(); await sleep(800);
  await page.getByRole('button', { name: /我是主办方/ }).click(); await sleep(700);
  await page.locator('#panel input[name=name]').fill('阿遥'); await page.getByRole('button', { name: '保存昵称，继续' }).click(); await sleep(900);
  await page.locator('#panel input[name=title]').fill('返场夜'); await page.locator('#panel input[name=venue]').fill('月台 Livehouse');
  await page.locator('#panel input[name=participation][value=open]').check(); const c = page.locator('#panel input[name=consent]'); if (!(await c.isChecked())) await c.check();
  await page.getByRole('button', { name: '开房并进入现场' }).click(); await sleep(3000);
  await page.locator('[data-open=room]').first().click(); await sleep(1200);
  const cdp = await page.context().newCDPSession(page); await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
  for (const sel of ['#panel .invite-code', '#panel .invite-address', '#invite-qr']) {
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: sel }); if (!nodeId) { console.log(sel, 'missing'); continue; }
    const f = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
    const cs = await page.evaluate(s => { const e = document.querySelector(s); const c = getComputedStyle(e); return { ff: c.fontFamily, fs: c.fontSize, ls: c.letterSpacing, w: e.getBoundingClientRect().width, h: e.getBoundingClientRect().height }; }, sel);
    console.log(sel, JSON.stringify(cs), JSON.stringify(f.fonts));
  }
  await page.locator('#invite-qr').scrollIntoViewIfNeeded(); await sleep(300);
  const box = await page.locator('#panel').boundingBox();
  await page.screenshot({ path: '/tmp/space-doodle/critique/node/node-invite-block-phone.png', clip: box });
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
