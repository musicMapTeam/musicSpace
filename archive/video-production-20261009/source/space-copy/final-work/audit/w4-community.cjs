// W4: the show's group chat (join, joined, settings), the venue's fan community as a member (join, 下一场预告), the community list,
// a community of my own (create, host view, settings, 下一场预告 management + post), 我的空间.
const L = require('./lib.cjs');
L.watchdog(295);
const vp = process.argv[2] || 'phone';
L.setCorpus(`w4-${vp}`);
const openSettings = page => page.evaluate(() => { document.querySelectorAll('.music-community details').forEach(d => d.open = true); });
(async () => {
  const browser = await L.launch();
  try {
    const run = await L.open(browser, vp);
    const { page } = run; page.__vp = vp;
    await L.ready(run);
    await L.enter(run);
    // the show's group chat
    await L.clickHidden(page, { open: 'conversation' });
    await page.waitForSelector('.music-community:not([hidden])', { timeout: 20000 });
    await page.waitForFunction(() => document.querySelector('.music-community [data-group-join]') || document.querySelector('.music-community .community-messages'), null, { timeout: 20000 }).catch(() => {});
    await L.sleep(1200);
    await L.grab(page, 'room-chat-join', '.music-community');
    await L.shotScroll(page, 'w4-01-room-chat-join', '.music-community .community-scroll', 2);
    await L.check(page, 'room-chat-join', '.music-community');
    const join = page.locator('.music-community form[data-group-join]');
    if (await join.count()) {
      await page.locator('.music-community form[data-group-join] input[name="consent"]').check({ force: true });
      await page.locator('.music-community form[data-group-join] button[type="submit"]').first().evaluate(b => b.click());
      await page.waitForSelector('.music-community .community-messages article', { timeout: 30000 }).catch(() => console.log('no messages'));
      await L.sleep(1800);
    }
    await L.grab(page, 'room-chat-joined', '.music-community');
    await L.shot(page, 'w4-02-room-chat-joined');
    await L.check(page, 'room-chat-joined', '.music-community');
    // send a message
    await page.fill('.music-community textarea', '大家好！').catch(() => {});
    await page.locator('.music-community [data-group-send] button[type="submit"]').first().evaluate(b => b.click()).catch(() => {});
    await L.sleep(2000);
    await openSettings(page);
    await L.sleep(500);
    await L.grab(page, 'room-chat-settings', '.music-community');
    await L.shotScroll(page, 'w4-03-room-chat-settings', '.music-community .conversation-content', 3);
    await page.evaluate(() => document.querySelectorAll('.music-community details').forEach(d => d.open = false));
    // the venue's community from the room chat
    await page.evaluate(() => document.querySelector('.music-community [data-group="linked"]')?.click());
    await L.sleep(2200);
    await L.grab(page, 'linked-community-before-join', '.music-community');
    await L.shotScroll(page, 'w4-04-linked-community', '.music-community .community-scroll', 2);
    await L.check(page, 'linked-community', '.music-community');
    const cj = page.locator('.music-community form[data-group-join]');
    if (await cj.count()) {
      await page.locator('.music-community form[data-group-join] input[name="consent"]').check({ force: true });
      await page.locator('.music-community form[data-group-join] button[type="submit"]').first().evaluate(b => b.click());
      await L.sleep(2500);
    }
    await L.grab(page, 'linked-community-joined', '.music-community');
    await L.grab(page, 'scene-in-community', '#scene-heading, #scene-code, #render-status, .track');
    await L.shot(page, 'w4-05-community-joined');
    await L.check(page, 'community-joined', '.music-community');
    await openSettings(page);
    await L.sleep(400);
    await L.grab(page, 'linked-community-settings', '.music-community');
    await L.shotScroll(page, 'w4-06-community-settings', '.music-community .conversation-content', 3);
    await page.evaluate(() => document.querySelectorAll('.music-community details').forEach(d => d.open = false));
    // 下一场预告 as a member
    await page.evaluate(() => document.querySelector('.music-community [data-group-space]')?.click());
    await page.waitForSelector('.space-management', { timeout: 20000 }).catch(() => console.log('no space-management'));
    await page.waitForFunction(() => !/正在读取/.test(document.querySelector('.space-management')?.textContent || ''), null, { timeout: 20000 }).catch(() => {});
    await L.sleep(1000);
    await L.grab(page, 'next-show-member', '.space-management');
    await L.shotScroll(page, 'w4-07-next-show-member', '.space-management .community-scroll', 3);
    await L.check(page, 'next-show-member', '.space-management');
    await page.evaluate(() => [...document.querySelectorAll('.space-management [data-organize="close"]')].pop()?.click());
    await L.sleep(1200);
    await page.evaluate(() => document.querySelector('.music-community [data-group="close"]')?.click());
    await L.sleep(800);
    await L.grab(page, 'scene-after-community', '#scene-heading, #scene-code, #render-status');
    // the community list
    await L.clickHidden(page, { open: 'communities' });
    await page.waitForSelector('.music-community form[data-community-create]', { timeout: 20000 });
    await L.sleep(1200);
    await L.grab(page, 'communities-list', '.music-community');
    await L.shotScroll(page, 'w4-08-communities', '.music-community .community-scroll', 2);
    await L.check(page, 'communities-list', '.music-community');
    // create my own
    await page.fill('.music-community form[data-community-create] input[name="title"]', '我的小酒馆乐迷社群');
    await page.locator('.music-community form[data-community-create] input[name="consent"]').check({ force: true });
    await page.locator('.music-community form[data-community-create] button[type="submit"]').first().evaluate(b => b.click());
    await L.sleep(2500);
    await L.grab(page, 'communities-after-create', '.music-community');
    await page.locator('.music-community [data-community]').last().evaluate(b => b.click());
    await page.waitForFunction(() => document.querySelector('.music-community .community-messages') || document.querySelector('.music-community [data-group-join]'), null, { timeout: 20000 }).catch(() => {});
    await L.sleep(1800);
    await L.grab(page, 'own-community', '.music-community');
    await L.shot(page, 'w4-09-own-community');
    await openSettings(page);
    await L.sleep(400);
    await L.grab(page, 'own-community-settings', '.music-community');
    await L.shotScroll(page, 'w4-10-own-community-settings', '.music-community .conversation-content', 4);
    await page.evaluate(() => document.querySelectorAll('.music-community details').forEach(d => d.open = false));
    // 下一场预告 as the host
    await page.evaluate(() => document.querySelector('.music-community [data-group-space]')?.click());
    await page.waitForSelector('.space-management', { timeout: 20000 });
    await page.waitForFunction(() => !/正在读取/.test(document.querySelector('.space-management')?.textContent || ''), null, { timeout: 20000 }).catch(() => {});
    await L.sleep(1000);
    await page.evaluate(() => document.querySelectorAll('.space-management details').forEach(d => d.open = true));
    await L.sleep(300);
    await L.grab(page, 'next-show-host', '.space-management');
    await L.shotScroll(page, 'w4-11-next-show-host', '.space-management .community-scroll', 4);
    await L.check(page, 'next-show-host', '.space-management');
    const ev = page.locator('.space-management form[data-organization="event"]');
    if (await ev.count()) {
      await page.fill('.space-management form[data-organization="event"] input[name="title"]', '下周六 · 返场夜');
      await page.fill('.space-management form[data-organization="event"] input[name="venue"]', '小酒馆').catch(() => {});
      await page.fill('.space-management form[data-organization="event"] input[name="note"]', '老位置见').catch(() => {});
      await page.locator('.space-management form[data-organization="event"] input[name="consent"]').check({ force: true }).catch(() => {});
      await page.locator('.space-management form[data-organization="event"] button').first().evaluate(b => b.click());
      await page.waitForSelector('.space-management .space-event', { timeout: 20000 }).catch(() => console.log('no event'));
      await L.sleep(1500);
      await page.evaluate(() => document.querySelectorAll('.space-management details').forEach(d => d.open = true));
      await L.grab(page, 'next-show-host-posted', '.space-management');
      await L.shotScroll(page, 'w4-12-next-show-posted', '.space-management .community-scroll', 4);
    }
    await page.evaluate(() => [...document.querySelectorAll('.space-management [data-organize="close"]')].pop()?.click());
    await L.sleep(1200);
    await page.evaluate(() => document.querySelector('.music-community [data-group="close"]')?.click());
    await L.sleep(600);
    // 我的空间
    await L.clickHidden(page, { open: 'personal' });
    await page.waitForSelector('.personal-space', { timeout: 20000 });
    await page.waitForFunction(() => !/正在读取/.test(document.querySelector('.personal-space')?.textContent || ''), null, { timeout: 20000 }).catch(() => {});
    await L.sleep(1200);
    await L.grab(page, 'personal-space', '.personal-space');
    await L.shotScroll(page, 'w4-13-personal', '.personal-space .community-scroll', 4);
    await L.check(page, 'personal-space', '.personal-space');
    await L.log(page, 'w4');
    console.log('errors', JSON.stringify(page.__errors));
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); } finally { L.flush(); await browser.close(); }
})();
