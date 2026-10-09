// Host moderation panel (section.room-moderation) on Node: phone + desktop, HEAD vs now.
const { launch, open, sleep, OUT, save } = require('./lib.cjs');
async function host(page, port) {
  await page.goto(`http://127.0.0.1:${port}/event-room/`, { waitUntil: 'load' });
  await page.waitForFunction(() => /已连接/.test(document.querySelector('#render-status')?.innerText || ''), null, { timeout: 30000 }); await sleep(1500);
  await page.getByRole('button', { name: '带上小人，进入现场' }).click(); await sleep(800);
  await page.getByRole('button', { name: /我是主办方/ }).click(); await sleep(700);
  await page.locator('#panel input[name=name]').fill('阿遥'); await page.getByRole('button', { name: '保存昵称，继续' }).click(); await sleep(900);
  await page.locator('#panel input[name=title]').fill('返场夜'); await page.locator('#panel input[name=venue]').fill('月台 Livehouse');
  await page.locator('#panel input[name=participation][value=open]').check(); const c = page.locator('#panel input[name=consent]'); if (!(await c.isChecked())) await c.check();
  await page.getByRole('button', { name: '开房并进入现场' }).click(); await sleep(3000);
}
(async () => {
  const browser = await launch(); const out = {};
  for (const [tag, port] of [['head', 8891], ['now', 8890]]) for (const vp of ['phone', 'desktop']) {
    const { page, log } = await open(browser, vp);
    await host(page, port);
    await page.locator('[data-open=room]').first().click(); await sleep(1200);
    const b = page.locator('#panel button', { hasText: '管理这一场' }).first(); await b.scrollIntoViewIfNeeded(); await b.click(); await sleep(2000);
    await page.screenshot({ path: `${OUT}/moderation-${vp}-${tag}.png` });
    out[`${tag}/${vp}`] = { visible: await page.locator('section.room-moderation').isVisible(), text: (await page.locator('section.room-moderation').innerText().catch(() => '')).replace(/\n+/g, ' | ').slice(0, 300), console: log.console, pageerror: log.pageerror };
    await page.context().close();
  }
  save('moderation.json', out); console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
