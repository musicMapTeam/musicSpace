// Part 4: the visitor opens their own room (host): moderation management, room chat as host (bind community), empty exchange/chat lists, recap of an empty room.
const S = require('/tmp/space-copy/panels-inv/dump.cjs');
S.watchdog(285);
(async () => {
  const browser = await S.launch();
  try {
    const run = await S.open(browser, process.argv[2] || 'phone');
    const { page } = run;
    await S.enter(run);
    // empty lists first (fresh visitor)
    await S.clickHidden(page, { open: 'exchanges' });
    await page.waitForSelector('.photo-exchanges:not([hidden])', { timeout: 20000 });
    await page.waitForFunction(() => !/正在读取交换记录/.test(document.querySelector('.photo-exchanges')?.textContent || ''), null, { timeout: 20000 }).catch(() => {});
    await S.sleep(800);
    await S.dump(page, 'exchange-list-empty', '.photo-exchanges');
    await page.evaluate(() => document.querySelector('.photo-exchanges [data-x-close]')?.click());
    await S.sleep(400);
    await S.clickHidden(page, { open: 'chats' });
    await page.waitForSelector('.private-chat:not([hidden])', { timeout: 20000 });
    await page.waitForFunction(() => !/正在读取对话/.test(document.querySelector('.private-chat')?.textContent || ''), null, { timeout: 20000 }).catch(() => {});
    await S.sleep(800);
    await S.dump(page, 'chat-list-empty', '.private-chat');
    await page.evaluate(() => document.querySelector('.private-chat .chat-close')?.click());
    await S.sleep(400);
    await S.clickHidden(page, { open: 'my-feedback' });
    await page.waitForSelector('.room-moderation:not([hidden])', { timeout: 20000 });
    await S.sleep(1200);
    await S.dump(page, 'my-feedback-empty', '.room-moderation');
    await page.evaluate(() => document.querySelector('.room-moderation [data-mod-close]')?.click());
    await S.sleep(400);
    await S.clickHidden(page, { open: 'corners' });
    await page.waitForSelector('.corner-panel', { timeout: 20000 });
    await S.sleep(1500);
    await S.dump(page, 'corner-list-empty', '.corner-panel');
    await page.evaluate(() => document.querySelector('.corner-panel [data-corner-close]')?.click());
    await S.sleep(400);
    // own room
    await S.clickHidden(page, { open: 'create' });
    await page.waitForSelector('form[data-form="create"]', { timeout: 20000 });
    await S.sleep(500);
    await S.dump(page, 'create-room');
    await page.fill('form[data-form="create"] input[name="title"]', '周五的最后一首');
    await page.fill('form[data-form="create"] input[name="venue"]', '月台 Livehouse');
    const consent = page.locator('form[data-form="create"] input[name="consent"]');
    if (await consent.count()) await consent.check({ force: true });
    await page.locator('form[data-form="create"] button[type="submit"]').first().evaluate(b => b.click());
    await page.waitForFunction(() => /周五的最后一首/.test(document.querySelector('#room-title')?.textContent || ''), null, { timeout: 30000 }).catch(() => console.log('room not opened'));
    await S.sleep(1500);
    await S.dump(page, 'own-room-shell', '.presence, .track, footer, #scene-heading, #scene-code, .demo-tour');
    await S.clickHidden(page, { open: 'moderation' });
    await page.waitForSelector('.room-moderation:not([hidden])', { timeout: 20000 });
    await page.waitForFunction(() => !/正在确认本场房主身份/.test(document.querySelector('.room-moderation')?.textContent || ''), null, { timeout: 20000 }).catch(() => {});
    await S.sleep(800);
    await S.dump(page, 'moderation-manage-reports', '.room-moderation');
    for (const tab of ['members', 'exclusions']) { await page.evaluate(t => document.querySelector(`.room-moderation [data-mod-tab="${t}"]`)?.click(), tab); await S.sleep(600); await S.dump(page, 'moderation-manage-' + tab, '.room-moderation'); }
    await page.evaluate(() => document.querySelector('.room-moderation [data-mod-close]')?.click());
    await S.sleep(400);
    // own room chat as host
    await S.clickHidden(page, { open: 'conversation' });
    await page.waitForSelector('.music-community:not([hidden])', { timeout: 20000 });
    await S.sleep(1200);
    await S.dump(page, 'own-room-chat', '.music-community');
    const join = page.locator('.music-community form[data-group-join]');
    if (await join.count()) {
      await page.locator('.music-community form[data-group-join] input[name="consent"]').check({ force: true });
      await page.locator('.music-community form[data-group-join] button[type="submit"]').first().evaluate(b => b.click());
      await S.sleep(2500);
      await S.dump(page, 'own-room-chat-joined', '.music-community');
    }
    await page.evaluate(() => document.querySelector('.music-community [data-group="close"]')?.click());
    await S.sleep(400);
    await S.clickHidden(page, { open: 'recap' });
    await page.waitForSelector('.panel[data-kind="recap"]', { timeout: 30000 });
    await S.sleep(1500);
    await S.dump(page, 'own-recap');
    await page.locator('#panel [data-open="memory-card"]').first().evaluate(b => b.click());
    await page.waitForSelector('form[data-form="memory-card"]', { timeout: 20000 });
    await S.sleep(800);
    await S.dump(page, 'own-memory-card');
    console.log('errors', JSON.stringify(page.__errors));
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); } finally { await browser.close(); }
})();
