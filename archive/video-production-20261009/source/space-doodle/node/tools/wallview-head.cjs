// Photo-wall camera view without a panel: Node (hosted room with one photo) and static (example world), desktop + phone.
const { launch, open, sleep, OUT } = require('./lib.cjs');
const PHOTO = '/tmp/space-video-prep/photos/pack/demo-stage-2147.jpg';
async function nodeRoom(browser, vp) {
  const { page, log } = await open(browser, vp);
  await page.goto('http://127.0.0.1:8891/event-room/', { waitUntil: 'load' });
  await page.waitForFunction(() => /已连接/.test(document.querySelector('#render-status')?.innerText || ''), null, { timeout: 30000 }); await sleep(1500);
  await page.getByRole('button', { name: '带上小人，进入现场' }).click(); await sleep(800);
  await page.getByRole('button', { name: /我是主办方/ }).click(); await sleep(700);
  await page.locator('#panel input[name=name]').fill('阿遥'); await page.getByRole('button', { name: '保存昵称，继续' }).click(); await sleep(900);
  await page.locator('#panel input[name=title]').fill('返场夜'); await page.locator('#panel input[name=venue]').fill('月台 Livehouse');
  await page.locator('#panel input[name=participation][value=open]').check(); const c = page.locator('#panel input[name=consent]'); if (!(await c.isChecked())) await c.check();
  await page.getByRole('button', { name: '开房并进入现场' }).click(); await sleep(3000);
  await page.locator('#room-first-photo, #panel .primary:has-text("放上我的一张")').first().click(); await sleep(700);
  await page.locator('#panel input[type=file]').setInputFiles(PHOTO); await sleep(6000);
  await page.locator('#panel select[name=visibility]').selectOption('members').catch(() => {});
  await page.getByRole('button', { name: '保存这张照片' }).click(); await sleep(2500);
  const x = page.locator('#panel-close'); if (await x.isVisible().catch(() => false)) { await x.click(); await sleep(600); }
  return { page, log };
}
(async () => {
  const browser = await launch();
  for (const vp of ['desktop', 'phone']) {
    const { page, log } = await nodeRoom(browser, vp);
    await page.locator('nav button[data-view=photos]').first().click(); await sleep(4000);
    await page.screenshot({ path: `${OUT}/head-wallview-${vp}.png` });
    await page.locator('nav button[data-view=person]').first().click().catch(() => {}); await sleep(4000);
    await page.screenshot({ path: `${OUT}/head-personview-${vp}.png` });
    console.log(vp, JSON.stringify(log.console.slice(0, 4)), JSON.stringify(log.pageerror));
    await page.context().close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
