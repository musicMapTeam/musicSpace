// The Livehouse story in the online edition: room chat -> 设置与管理 -> 这家 Livehouse 的乐迷社群 -> join -> 下一场预告.
const L = require('./lib.cjs');
L.watchdog(280);
const vp = process.argv[2] || 'phone';
(async () => {
  const browser = await L.launch();
  try {
    const run = await L.open(browser, vp);
    const { page } = run;
    await L.enter(run);
    await L.clickHidden(page, { open: 'conversation', id: await page.evaluate(() => window.__SPACE_EVENT_QA__?.().roomId) });
    await page.waitForSelector('.community-panel:not([hidden]) .conversation-management, [class*="community"]:not([hidden]) .conversation-management', { timeout: 30000 }).catch(() => {});
    await L.sleep(1500);
    await L.shot(page, `11-room-chat-${vp}`);
    const linked = page.locator('[data-group="linked"]').first();
    await linked.evaluate(b => b.click());
    await L.sleep(1800);
    await L.grab(page, 'community-before-join', '.frame [aria-label="乐迷社群与聊天室"]');
    await L.shot(page, `12-community-join-${vp}`);
    const box = page.locator('form[data-group-join] input[name="consent"]').first();
    await box.check({ force: true });
    await page.locator('form[data-group-join] button[type="submit"]').first().evaluate(b => b.click());
    await L.sleep(2000);
    await L.grab(page, 'community-joined', '.frame [aria-label="乐迷社群与聊天室"]');
    await L.shot(page, `13-community-joined-${vp}`);
    await page.locator('[data-group-space]').first().evaluate(b => b.click());
    await L.sleep(1800);
    await L.grab(page, 'next-show', 'body');
    await L.shot(page, `14-next-show-${vp}`);
    await L.log(page, 'log');
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); } finally { await browser.close(); }
})();
