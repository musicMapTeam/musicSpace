// W3: inbox (empty, waiting, accepted), friends, a friend's person card, private chat with the cast's full reply script, chat list,
// 林间 (quiet), the block / remove-friend / unblock confirmations.
const L = require('./lib.cjs');
L.watchdog(290);
const vp = process.argv[2] || 'phone';
L.setCorpus(`w3-${vp}`);
(async () => {
  const browser = await L.launch();
  try {
    const run = await L.open(browser, vp);
    const { page } = run; page.__vp = vp;
    await L.ready(run);
    await L.enter(run);
    // inbox, empty
    await L.js(page, '#social-inbox');
    await L.sleep(1200);
    await L.grab(page, 'inbox-empty', '#panel');
    await L.shot(page, 'w3-01-inbox-empty');
    await L.check(page, 'inbox-empty', '#panel');
    // the empty private chat list
    await L.js(page, '#panel [data-open="chats"]');
    await page.waitForSelector('.private-chat:not([hidden])', { timeout: 20000 });
    await L.sleep(1500);
    await L.grab(page, 'chats-empty', '.private-chat');
    await L.shot(page, 'w3-02-chats-empty');
    await page.locator('.private-chat .chat-close').first().evaluate(b => b.click()).catch(() => {});
    await L.sleep(500);
    const members = await page.evaluate(() => window.__SPACE_EVENT_QA__().members);
    console.log('members', JSON.stringify(members));
    const byName = n => members.find(m => m.name === n)?.id;
    // wave to 北屿 (no exchange with her): see the waiting state before the cast answers
    await L.clickHidden(page, { open: 'person', id: byName('北屿') });
    await page.waitForSelector('.panel[data-kind="person"]', { timeout: 20000 });
    await L.sleep(800);
    await L.js(page, '#panel [data-social-send]');
    await L.sleep(500);
    await L.grab(page, 'person-waved-bei', '#panel');
    await L.shot(page, 'w3-03-waved');
    await L.js(page, '#social-inbox');
    await L.sleep(700);
    await L.grab(page, 'inbox-outgoing', '#panel');
    await L.shot(page, 'w3-04-inbox-outgoing');
    await L.closeSheet(page);
    // wait for acceptance
    await L.clickHidden(page, { open: 'person', id: byName('北屿') });
    await page.waitForSelector('#panel [data-open="chats"]', { timeout: 60000 }).catch(() => console.log('not accepted'));
    await L.sleep(1200);
    await L.grab(page, 'person-friend-bei', '#panel');
    await L.shotScroll(page, 'w3-05-friend-card', '#panel', 2);
    await L.check(page, 'friend-card', '#panel');
    // remove-friend and block confirmations (not confirmed)
    await L.js(page, '#panel [data-open="remove-friend"]');
    await L.sleep(700);
    await L.grab(page, 'remove-friend-confirm', '#panel');
    await L.shot(page, 'w3-06-remove-friend');
    await L.clickHidden(page, { open: 'person', id: byName('北屿') });
    await L.sleep(800);
    await L.js(page, '#panel [data-open="block-user"]');
    await L.sleep(700);
    await L.grab(page, 'block-confirm', '#panel');
    await L.shot(page, 'w3-07-block');
    // chat with 北屿: the welcome lines, then four messages
    await L.clickHidden(page, { open: 'chats', id: byName('北屿') });
    await page.waitForSelector('.private-chat:not([hidden])', { timeout: 20000 });
    await page.waitForFunction(() => document.querySelectorAll('.private-chat .chat-message').length >= 2, null, { timeout: 30000 }).catch(() => console.log('no welcome lines'));
    await L.sleep(800);
    await L.grab(page, 'chat-welcome', '.private-chat');
    await L.shot(page, 'w3-08-chat-welcome');
    const lines = ['你好呀', '你也在二楼吗？', '返场那首是什么？', '下次见'];
    for (let i = 0; i < lines.length; i++) {
      await page.fill('#chat-text', lines[i]);
      await page.locator('.private-chat form button[type="submit"]').first().evaluate(b => b.click());
      await page.waitForFunction(n => document.querySelectorAll('.private-chat .chat-message').length >= n, 2 + (i + 1) * 2, { timeout: 30000 }).catch(() => console.log('no reply to', lines[i]));
      await L.sleep(700);
    }
    await L.sleep(1200);
    await L.grab(page, 'chat-thread', '.private-chat');
    await L.shot(page, 'w3-09-chat-thread');
    await L.check(page, 'chat-thread', '.private-chat');
    // the composer's error states: an empty send
    await page.fill('#chat-text', '');
    await page.locator('.private-chat form button[type="submit"]').first().evaluate(b => b.click());
    await L.sleep(500);
    await L.grab(page, 'chat-empty-send', '.private-chat');
    await page.locator('.private-chat .chat-back').first().evaluate(b => b.click()).catch(() => {});
    await L.sleep(1200);
    await L.grab(page, 'chat-list', '.private-chat');
    await L.shot(page, 'w3-10-chat-list');
    await page.locator('.private-chat .chat-close').first().evaluate(b => b.click()).catch(() => {});
    await L.sleep(500);
    // inbox with a friend
    await L.js(page, '#social-inbox');
    await L.sleep(1000);
    await L.grab(page, 'inbox-friend', '#panel');
    await L.shotScroll(page, 'w3-11-inbox-friend', '#panel', 2);
    // friends list
    const fr = page.locator('#panel [data-open="friends"]');
    if (await fr.count()) { await fr.first().evaluate(b => b.click()); await L.sleep(800); await L.grab(page, 'friends', '#panel'); await L.shot(page, 'w3-12-friends'); }
    // 林间 (quiet), after she arrives
    await page.waitForFunction(() => window.__SPACE_EVENT_QA__().members.some(m => m.name === '林间'), null, { timeout: 30000 }).catch(() => console.log('林间 never came'));
    const lin = await page.evaluate(() => window.__SPACE_EVENT_QA__().members.find(m => m.name === '林间')?.id);
    await L.clickHidden(page, { open: 'person', id: lin });
    await L.sleep(1200);
    await L.grab(page, 'person-lin-quiet', '#panel');
    await L.shot(page, 'w3-13-lin');
    // people list now
    await L.clickHidden(page, { open: 'people' });
    await L.sleep(900);
    await L.grab(page, 'people-later', '#panel');
    await L.shot(page, 'w3-14-people-later');
    // block 小满, then the blocked list and the unblock confirmation
    await L.clickHidden(page, { open: 'person', id: byName('小满') });
    await L.sleep(800);
    await L.js(page, '#panel [data-open="block-user"]');
    await L.sleep(600);
    await L.js(page, '#panel [data-social-block]');
    await L.sleep(2000);
    await L.grab(page, 'after-block', 'body');
    await L.js(page, '#social-inbox');
    await L.sleep(900);
    const bl = page.locator('#panel [data-open="blocked"]');
    if (await bl.count()) { await bl.first().evaluate(b => b.click()); await L.sleep(800); await L.grab(page, 'blocked-list', '#panel'); await L.shot(page, 'w3-15-blocked');
      const ub = page.locator('#panel [data-open="unblock-user"]'); if (await ub.count()) { await ub.first().evaluate(b => b.click()); await L.sleep(600); await L.grab(page, 'unblock-confirm', '#panel'); await L.shot(page, 'w3-16-unblock'); } }
    // the participation switch: quiet
    await L.js(page, '#join');
    await L.sleep(800);
    await page.check('#panel input[name="participation"][value="quiet"]', { force: true }).catch(() => console.log('no quiet radio'));
    await page.locator('#panel form button[type="submit"]').filter({ hasText: '更新参与方式' }).first().evaluate(b => b.click()).catch(() => console.log('no update button'));
    await L.sleep(1500);
    await L.grab(page, 'room-panel-quiet', '#panel');
    await L.closeSheet(page);
    await L.clickHidden(page, { open: 'person', id: byName('阿遥') });
    await L.sleep(1000);
    await L.grab(page, 'person-while-quiet', '#panel');
    await L.shot(page, 'w3-17-person-while-quiet');
    await L.closeSheet(page);
    await L.grab(page, 'room-quiet', '.frame');
    await L.log(page, 'w3');
    console.log('errors', JSON.stringify(page.__errors));
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); } finally { L.flush(); await browser.close(); }
})();
