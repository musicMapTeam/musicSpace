// Part B: people, a wave, the private chat with every scripted reply, the room panel, the group chat, cup/game, the long-term community.
const L = require('./lib.cjs');
L.watchdog(285);
const vp = process.argv[2] || 'phone';
(async () => {
  const browser = await L.launch();
  try {
    const run = await L.open(browser, vp);
    const { page } = run;
    await L.enter(run);
    await L.clickHidden(page, { open: 'people' });
    await page.waitForSelector('.panel[data-kind="people"] [data-person]', { timeout: 20000 });
    await L.sleep(600);
    await L.grab(page, 'people', '#panel');
    // 小满 (second person) — open characters accept
    const persons = page.locator('#panel [data-person]');
    await persons.nth(1).evaluate(b => b.click());
    await page.waitForSelector('.panel[data-kind="person"]', { timeout: 20000 });
    await L.sleep(1200);
    await L.grab(page, 'person', '#panel');
    const send = page.locator('#panel [data-social-send]');
    if (await send.count()) await send.first().evaluate(b => b.click());
    await page.waitForSelector('#panel [data-open="chats"]', { timeout: 60000 }).catch(() => console.log('no chats button'));
    await L.sleep(800);
    await L.grab(page, 'person-friend', '#panel');
    await page.locator('#panel [data-open="chats"]').first().evaluate(b => b.click());
    await page.waitForSelector('.private-chat:not([hidden])', { timeout: 20000 });
    await page.waitForFunction(() => /你拍到的是哪一面/.test(document.querySelector('.private-chat')?.innerText || ''), null, { timeout: 30000 }).catch(() => console.log('no welcome lines'));
    await L.grab(page, 'chat-welcome', '.private-chat');
    for (let i = 0; i < 4; i++) {
      const before = await page.evaluate(() => document.querySelector('.private-chat').innerText.length);
      await page.fill('.private-chat textarea, .private-chat input[type="text"]', `第${i + 1}句`);
      await page.locator('.private-chat .chat-composer button').first().evaluate(b => b.click());
      await page.waitForFunction(n => document.querySelector('.private-chat').innerText.length > n + 8, before, { timeout: 20000 }).catch(() => {});
      await L.sleep(6000);
    }
    await L.grab(page, 'chat-replies', '.private-chat');
    await L.shot(page, `b-chat-${vp}`);
    await page.locator('.private-chat > header > button').last().evaluate(b => b.click()).catch(() => {});
    await L.sleep(500);
    // room panel (···)
    await L.closeSheet(run);
    await L.press(run, '#room-info');
    await L.sleep(800);
    await L.grab(page, 'room-panel', '#panel');
    await L.shot(page, `b-room-${vp}`);
    // the group chat
    await page.locator('#panel [data-open="conversation"]').first().evaluate(b => b.click());
    await L.sleep(2500);
    await L.grab(page, 'group-chat', '.community-panel');
    await L.shot(page, `b-groupchat-${vp}`);
    await L.log(page, 'log-b');
    L.save(`part-b-${vp}`);
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); L.save(`part-b-${vp}`); } finally { await browser.close(); }
})();
