// Part 2: people → wave → private chat with NPC lines; room group chat (join, conversation, games, topics, worldcup).
const S = require('/tmp/space-copy/panels-inv/dump.cjs');
S.watchdog(285);
const back = async page => { await page.evaluate(() => { const b = [...document.querySelectorAll('.community-panel button')].find(b => /回到聊天室|返回聊天室|回到聊天室讨论/.test(b.textContent) || b.getAttribute('aria-label') === '返回聊天室' || b.getAttribute('aria-label') === '回到聊天室'); b?.click(); }); await S.sleep(1200); };
(async () => {
  const browser = await S.launch();
  try {
    const run = await S.open(browser, process.argv[2] || 'phone');
    const { page } = run;
    await S.enter(run);
    // people → 阿遥
    await S.clickHidden(page, { open: 'people' });
    await page.waitForSelector('.panel[data-kind="people"] [data-person]', { timeout: 20000 });
    await S.sleep(800);
    await S.dump(page, 'people');
    await page.locator('#panel [data-person]').first().evaluate(b => b.click());
    await page.waitForSelector('.panel[data-kind="person"]', { timeout: 20000 });
    await S.sleep(1200);
    await S.dump(page, 'person-before-wave');
    const peer = await page.evaluate(() => document.querySelector('#panel [data-social-send]')?.dataset.socialSend || document.querySelector('#panel [data-open="feedback"]')?.dataset.id);
    console.log('peer', peer);
    const send = page.locator('#panel [data-social-send]');
    if (await send.count()) await send.first().evaluate(b => b.click());
    await page.waitForSelector('#panel [data-open="chats"]', { timeout: 60000 }).catch(() => console.log('no chats button'));
    await S.sleep(800);
    await S.dump(page, 'person-friend');
    await page.locator('#panel [data-open="chats"]').first().evaluate(b => b.click());
    await page.waitForSelector('.private-chat:not([hidden])', { timeout: 20000 });
    await page.waitForFunction(() => document.querySelectorAll('.private-chat .chat-message').length >= 2, null, { timeout: 30000 }).catch(() => console.log('no welcome lines'));
    await S.sleep(800);
    await S.dump(page, 'chat-thread-welcome', '.private-chat');
    for (const text of ['你好呀', '我拍的是人海', '下次见']) {
      const before = await page.evaluate(() => document.querySelectorAll('.private-chat .chat-message.theirs').length);
      await page.fill('#chat-text', text);
      await page.locator('.private-chat form button[type="submit"]').first().evaluate(b => b.click());
      await page.waitForFunction(n => document.querySelectorAll('.private-chat .chat-message.theirs').length > n, before, { timeout: 30000 }).catch(() => console.log('no reply to', text));
      await S.sleep(500);
    }
    await S.dump(page, 'chat-thread-replies', '.private-chat');
    await page.locator('.private-chat .chat-back').first().evaluate(b => b.click());
    await S.sleep(1200);
    await S.dump(page, 'chat-list', '.private-chat');
    await page.locator('.private-chat .chat-close').first().evaluate(b => b.click());
    await S.sleep(500);
    // the room's group chat
    await S.clickHidden(page, { open: 'conversation' });
    await page.waitForSelector('.music-community:not([hidden])', { timeout: 20000 });
    await page.waitForFunction(() => /加入|发送到聊天室/.test(document.querySelector('.music-community')?.textContent || ''), null, { timeout: 20000 }).catch(() => {});
    await S.sleep(800);
    await S.dump(page, 'room-chat-join', '.music-community');
    const join = page.locator('.music-community form[data-group-join]');
    if (await join.count()) {
      await page.locator('.music-community form[data-group-join] input[name="consent"]').check({ force: true });
      await page.locator('.music-community form[data-group-join] button[type="submit"]').first().evaluate(b => b.click());
      await page.waitForSelector('.music-community .community-messages article', { timeout: 30000 }).catch(() => console.log('no messages'));
      await S.sleep(1500);
    }
    await S.dump(page, 'room-chat-joined', '.music-community');
    // games
    await page.locator('.music-community [data-group-games]').first().evaluate(b => b.click());
    await page.waitForSelector('.music-games', { timeout: 20000 });
    await page.waitForFunction(() => document.querySelector('.music-games [data-game-id]') || /还没有小游戏/.test(document.querySelector('.music-games')?.textContent || ''), null, { timeout: 20000 }).catch(() => {});
    await S.sleep(800);
    await S.dump(page, 'games-list', '.music-games');
    // the create form with custom options and relay
    await page.evaluate(() => { const d = document.querySelector('.music-games details'); if (d) d.open = true; });
    await page.locator('.music-games form[data-game-form="create"] select[name="type"]').selectOption('relay').catch(() => {});
    await S.sleep(800);
    await S.dump(page, 'games-create-relay', '.music-games');
    await page.locator('.music-games form[data-game-form="create"] select[name="type"]').selectOption('preference').catch(() => {});
    await S.sleep(500);
    const gid = await page.evaluate(() => document.querySelector('.music-games [data-game-id]')?.dataset.gameId);
    if (gid) {
      await page.locator('.music-games [data-game-id]').first().evaluate(b => b.click());
      await page.waitForSelector('.music-games .game-phase', { timeout: 20000 }).catch(() => {});
      await S.sleep(1000);
      await S.dump(page, 'game-detail', '.music-games');
      const gj = page.locator('.music-games form[data-game-form="join"]');
      if (await gj.count()) {
        await page.locator('.music-games form[data-game-form="join"] input[name="consent"]').check({ force: true });
        await page.locator('.music-games form[data-game-form="join"] button').first().evaluate(b => b.click());
        await S.sleep(2500);
        await S.dump(page, 'game-joined', '.music-games');
      }
      // wait for the autopilot to start the game
      await page.waitForFunction(() => document.querySelector('.music-games [data-game-choice]'), null, { timeout: 25000 }).catch(() => console.log('game not started'));
      await S.sleep(500);
      const choice = page.locator('.music-games [data-game-choice]');
      if (await choice.count()) {
        await choice.first().evaluate(b => b.click());
        await S.sleep(500);
        await S.dump(page, 'game-choice', '.music-games');
        await page.locator('.music-games form[data-game-form="answer"] input[name="consent"]').check({ force: true });
        await page.locator('.music-games form[data-game-form="answer"] button').first().evaluate(b => b.click());
        await page.waitForFunction(() => document.querySelector('.music-games .game-result') || /本局完成/.test(document.querySelector('.music-games')?.textContent || ''), null, { timeout: 30000 }).catch(() => console.log('no result'));
        await S.sleep(1000);
        await S.dump(page, 'game-result', '.music-games');
      }
    }
    await page.evaluate(() => document.querySelector('.music-games [data-game="close"]')?.click());
    await S.sleep(1200);
    // topics
    await page.locator('.music-community [data-group-topics]').first().evaluate(b => b.click());
    await page.waitForSelector('.music-topics', { timeout: 20000 });
    await S.sleep(1500);
    await S.dump(page, 'topics', '.music-topics');
    await page.evaluate(() => document.querySelector('.music-topics [data-topic="close"]')?.click());
    await S.sleep(1200);
    // worldcup
    await page.locator('.music-community [data-group-worldcup]').first().evaluate(b => b.click());
    await page.waitForSelector('.worldcup-panel', { timeout: 20000 });
    await S.sleep(1500);
    await S.dump(page, 'worldcup-list', '.worldcup-panel');
    await page.locator('.worldcup-panel input[name="custom"]').check({ force: true }).catch(() => {});
    await S.sleep(600);
    await S.dump(page, 'worldcup-create-custom', '.worldcup-panel');
    await page.locator('.worldcup-panel input[name="custom"]').uncheck({ force: true }).catch(() => {});
    const cup = page.locator('.worldcup-panel [data-cup-id]');
    if (await cup.count()) {
      await cup.first().evaluate(b => b.click());
      await page.waitForSelector('.worldcup-panel .worldcup-match', { timeout: 20000 }).catch(() => {});
      await S.sleep(1200);
      await S.dump(page, 'worldcup-detail', '.worldcup-panel');
      const pickc = page.locator('.worldcup-panel [data-cup-choice]');
      if (await pickc.count()) { await pickc.first().evaluate(b => b.click()); await S.sleep(600); await S.dump(page, 'worldcup-vote', '.worldcup-panel'); }
    }
    await page.evaluate(() => document.querySelector('.worldcup-panel [data-cup-close]')?.click());
    await S.sleep(1200);
    await S.dump(page, 'room-chat-after', '.music-community');
    console.log('errors', JSON.stringify(page.__errors));
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); } finally { await browser.close(); }
})();
