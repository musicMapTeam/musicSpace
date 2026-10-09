// Verifies SHOTS.md TAKE-P1 step 19 (long-term community) on dist-pages.
const L = require('./lib.cjs');
const sleep = ms => new Promise(r => setTimeout(r, ms));
setTimeout(() => { console.error('watchdog'); process.exit(2); }, 200000).unref();
(async () => {
  const browser = await L.launch();
  try {
    const { ctx, page } = await L.open(browser, 'phone');
    await page.locator('#join').click();
    await page.waitForSelector('form[data-form="demo-entry"] button.primary:not([disabled])', { timeout: 60000 });
    await page.locator('form[data-form="demo-entry"] input[name=consent]').check();
    await page.locator('form[data-form="demo-entry"] button.primary').click();
    await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"]'), null, { timeout: 60000 });
    await sleep(1500);
    const skip = page.locator('button:visible', { hasText: '跳过路线' }); if (await skip.count()) await skip.first().click();
    await page.locator('#scene-details').click(); await sleep(1200);
    await page.locator('#panel [data-open="communities"]').first().click(); await sleep(2500);
    await page.screenshot({ path: '/tmp/space-video-doodle/script/probe/shots/p33-community-form.png' });
    const f = page.locator('.music-community form[data-community-create]');
    console.log('create form', await f.count());
    await f.locator('input[name=title]').fill('周五散场以后');
    await f.locator('input[name=consent]').check();
    await f.locator('button[type=submit]').click(); await sleep(3000);
    const n = await page.locator('.music-community .entry-list button').count();
    console.log('entries', n);
    await page.locator('.music-community .entry-list button').first().click(); await sleep(3000);
    await page.screenshot({ path: '/tmp/space-video-doodle/script/probe/shots/p33-community-room.png' });
    console.log((await page.evaluate(() => document.body.innerText)).split('\n').filter(l => /周五|社群成员|散场以后/.test(l)).slice(0, 6).join(' | '));
    console.log('errors', page.__errors.length);
    await ctx.close();
  } finally { await browser.close(); }
})();
