// W13: (a) the seeded community's invite link opened by somebody else (a fresh browser); (b) 「把拍摄时间设成 21:47」 inside a room the visitor opened.
const L = require('./lib.cjs');
const fs = require('fs');
L.watchdog(290);
const vp = process.argv[2] || 'phone';
L.setCorpus(`w13-${vp}`);
(async () => {
  const browser = await L.launch();
  try {
    const run = await L.open(browser, vp);
    const { page } = run; page.__vp = vp;
    await run.context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://127.0.0.1:5491' }).catch(() => {});
    await L.ready(run);
    await L.enter(run);
    await L.clickHidden(page, { open: 'conversation' });
    await page.waitForSelector('.music-community:not([hidden])', { timeout: 20000 });
    await L.sleep(1200);
    await page.evaluate(() => document.querySelector('.music-community [data-group="linked"]')?.click());
    await L.sleep(2000);
    if (await page.locator('.music-community form[data-group-join]').count()) {
      await page.locator('.music-community form[data-group-join] input[name="consent"]').check({ force: true });
      await page.locator('.music-community form[data-group-join] button[type="submit"]').first().evaluate(b => b.click());
      await L.sleep(2500);
    }
    await page.evaluate(() => document.querySelectorAll('.music-community details').forEach(d => d.open = true));
    await page.evaluate(() => document.querySelector('.music-community [data-group="copy"]')?.click());
    await L.sleep(1000);
    const link = await page.evaluate(() => navigator.clipboard.readText().catch(e => 'ERR ' + e.message));
    console.log('copied link:', link);
    await L.log(page, 'after-copy');
    // somebody else opens it
    if (/^http/.test(link)) {
      const other = await L.open(browser, vp, { url: link });
      other.page.__vp = vp;
      await other.page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready' || /^failed/.test(window.__SPACE_BOOT__ || ''), null, { timeout: 120000 });
      await L.sleep(4000);
      await L.grab(other.page, 'invite-opened-elsewhere', 'body');
      await L.shot(other.page, 'w13-01-invite-elsewhere');
      await L.log(other.page, 'invite-elsewhere');
      await other.context.close();
    }
    // (b) own room + own photo + 21:47
    await page.evaluate(() => document.querySelector('.music-community [data-group="close"]')?.click());
    await L.sleep(600);
    await L.clickHidden(page, { open: 'create' });
    await page.waitForSelector('form[data-form="create"]', { timeout: 20000 });
    await page.fill('form[data-form="create"] input[name="title"]', '周五的最后一首');
    const consent = page.locator('form[data-form="create"] input[name="consent"]');
    if (await consent.count()) await consent.check({ force: true });
    await page.locator('form[data-form="create"] button[type="submit"]').first().evaluate(b => b.click());
    await page.waitForFunction(() => /周五的最后一首/.test(document.querySelector('#room-title')?.textContent || ''), null, { timeout: 30000 });
    await L.sleep(1500);
    await L.clickHidden(page, { open: 'upload' });
    await page.waitForSelector('form[data-form="upload"]', { timeout: 20000 });
    await page.setInputFiles('form[data-form="upload"] input[type="file"]', { name: 'mine.png', mimeType: 'image/png', buffer: fs.readFileSync('/tmp/space-copy/final-work/audit/plain.png') });
    await page.waitForSelector('form[data-form="upload"] .photo-review', { timeout: 30000 });
    await L.aiSettled(page); await L.sleep(1500);
    const demo = page.locator('form[data-form="upload"] [data-demo-time]');
    console.log('demo-time button in own room:', await demo.count(), await demo.first().innerText().catch(() => ''));
    if (await demo.count()) { await demo.first().evaluate(b => b.click()); await L.sleep(600); }
    await L.grab(page, 'own-room-demo-time', 'form[data-form="upload"] .moment-taken');
    await page.evaluate(() => document.querySelector('form[data-form="upload"] [data-demo-time]')?.scrollIntoView({ block: 'center' }));
    await L.shot(page, 'w13-02-own-room-time');
    await L.log(page, 'w13');
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); } finally { L.flush(); await browser.close(); }
})();
