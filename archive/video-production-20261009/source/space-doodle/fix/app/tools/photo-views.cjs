// man-near.jpg (小满, 身边, 22:21) on the 3D wall (desktop), the 2D wall and the recap (phone), in the production build.
process.env.SPACE_URL = process.env.SPACE_URL || 'http://127.0.0.1:47391/musicSpace/';
process.env.OUT = process.env.OUT || '/tmp/space-doodle/fix/app/raw';
const L = require('/tmp/space-doodle/critique/art/tools/lib.cjs');
const OUT = process.env.OUT;
L.watchdog(280);
const which = process.argv[2] || 'both';
(async () => {
  const b = await L.launch();
  if (which !== 'phone') {
    const { ctx, page } = await L.open(b, 'desktop');
    await L.enter(page);
    await page.locator('.camera-nav [data-view="photos"]').first().click();
    await page.waitForFunction(() => !window.__SPACE_EVENT_QA__?.()?.camera?.moving && window.__SPACE_EVENT_QA__?.()?.camera?.view === 'photos', null, { timeout: 20000 }).catch(() => console.log('camera never settled'));
    await L.sleep(2500);
    await page.screenshot({ path: `${OUT}/photo-3dwall-desktop.png` });
    console.log('saved 3D wall');
    await ctx.close();
  }
  if (which !== 'desktop') {
    const { ctx, page } = await L.open(b, 'phone');
    await L.enter(page);
    await L.openKind(page, 'wall');
    await L.sleep(2500);
    const near = page.locator('#panel [data-moment-photo]').filter({ has: page.locator('img') }).last();
    const info = await page.evaluate(() => [...document.querySelectorAll('#panel [data-moment-photo]')].map(card => card.innerText.replace(/\s+/g, ' ').slice(0, 60)));
    console.log('wall cards:', JSON.stringify(info));
    const target = page.locator('#panel [data-moment-photo]', { hasText: '22:21' }).first();
    if (await target.count()) { await target.scrollIntoViewIfNeeded(); await L.sleep(800); }
    await page.screenshot({ path: `${OUT}/photo-wall-phone.png` });
    console.log('saved 2D wall');
    await L.closeEverything(page);
    await page.evaluate(() => { const b = document.querySelector('#room-recap'); if (b) b.click(); });
    await page.waitForSelector('#panel[data-kind="recap"]:not([hidden])', { timeout: 15000 }).catch(() => console.log('recap not open'));
    await L.sleep(3000);
    const recapTarget = page.locator('#panel .photo-item', { hasText: '小满' }).last();
    const items = await page.evaluate(() => [...document.querySelectorAll('#panel .photo-item')].map(b => b.innerText.replace(/\s+/g, ' ').slice(0, 50)));
    console.log('recap items:', JSON.stringify(items));
    const nearItem = page.locator('#panel .photo-item', { hasText: '22:21' }).first();
    if (await nearItem.count()) { await nearItem.scrollIntoViewIfNeeded(); await L.sleep(800); }
    await page.screenshot({ path: `${OUT}/photo-recap-phone.png` });
    console.log('saved recap');
    await ctx.close();
  }
  await b.close();
})();
