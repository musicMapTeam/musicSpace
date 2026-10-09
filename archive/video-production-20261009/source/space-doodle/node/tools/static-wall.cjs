const { launch, open, sleep, OUT } = require('./lib.cjs');
(async () => {
  const browser = await launch(); const { page, log } = await open(browser, 'desktop');
  await page.goto('http://127.0.0.1:5190/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 60000 }); await sleep(2500);
  await page.getByRole('button', { name: /进入示例现场/ }).first().click(); await sleep(1200);
  const consent = page.locator('#panel input[type=checkbox]').first(); if (await consent.isVisible().catch(() => false)) await consent.check();
  await page.getByRole('button', { name: /进入示例现场/ }).last().click(); await sleep(4000);
  const skip = page.getByRole('button', { name: '跳过路线' }); if (await skip.isVisible().catch(() => false)) { await skip.click(); await sleep(800); }
  await page.locator('nav button[data-view=photos]').first().click(); await sleep(4500);
  await page.screenshot({ path: `${OUT}/static-wallview-desktop.png` });
  const cam = await page.evaluate(() => window.__SPACE_EVENT_QA__?.()?.camera);
  console.log(JSON.stringify({ view: cam?.view, style: cam?.scene?.renderStyle, pos: cam?.camera?.position }));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
