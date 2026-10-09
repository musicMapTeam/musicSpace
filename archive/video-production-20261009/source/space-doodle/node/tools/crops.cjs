const { launch, open, sleep, OUT } = require('./lib.cjs');
(async () => {
  const browser = await launch(); const { page } = await open(browser, 'desktop');
  await page.goto('http://127.0.0.1:8890/event-room/', { waitUntil: 'load' });
  await page.waitForFunction(() => /已连接/.test(document.querySelector('#render-status')?.innerText || ''), null, { timeout: 30000 }); await sleep(3000);
  const pres = await page.locator('.presence').boundingBox();
  await page.screenshot({ path: `${OUT}/crop-node-desktop-hero-cta.png`, clip: { x: pres.x - 10, y: pres.y - 30, width: pres.width + 30, height: pres.height + 50 } });
  await page.getByRole('button', { name: '带上小人，进入现场' }).click(); await sleep(800);
  await page.getByRole('button', { name: '备份或恢复我的小人身份' }).click(); await sleep(1500);
  const dlg = await page.locator('section.identity-continuity').boundingBox();
  await page.screenshot({ path: `${OUT}/crop-node-desktop-identity-backup.png`, clip: { x: dlg.x - 10, y: dlg.y - 10, width: dlg.width + 30, height: dlg.height + 30 } });
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
