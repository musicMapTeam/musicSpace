// B: people → wave → private chat; room group chat (join, joined layout, settings menu), games, topics, worldcup.
const Q = require('/tmp/space-copy/panels-qa/qa.cjs');
Q.watchdog(290);
const kind = process.argv[2] || 'phone';
(async () => {
  const browser = await Q.launch();
  try {
    const run = await Q.open(browser, kind);
    const { page } = run;
    await Q.enter(run);
    await Q.clickHidden(page, { open: 'people' });
    await page.waitForSelector('.panel[data-kind="people"] [data-person]', { timeout: 20000 });
    await Q.sleep(800);
    await page.locator('#panel [data-person]').first().evaluate(b => b.click());
    await page.waitForSelector('.panel[data-kind="person"]', { timeout: 20000 });
    await Q.sleep(1000);
    const send = page.locator('#panel [data-social-send]');
    if (await send.count()) await send.first().evaluate(b => b.click());
    await page.waitForSelector('#panel [data-open="chats"]', { timeout: 60000 }).catch(() => console.log('no chats button'));
    await Q.sleep(600);
    await page.locator('#panel [data-open="chats"]').first().evaluate(b => b.click());
    await page.waitForSelector('.private-chat:not([hidden])', { timeout: 20000 });
    await page.waitForFunction(() => document.querySelectorAll('.private-chat .chat-message').length >= 2, null, { timeout: 30000 }).catch(() => console.log('no welcome lines'));
    await page.fill('#chat-text', '你好呀');
    await page.locator('.private-chat form button[type="submit"]').first().evaluate(b => b.click());
    await Q.sleep(2500);
    console.log('TEXT chat-thread:', await Q.text(page, '.private-chat'));
    console.log('chat-thread', JSON.stringify(await Q.audit(page, '.private-chat')));
    await Q.snap(page, 'chat-thread', kind);
    await page.locator('.private-chat .chat-back').first().evaluate(b => b.click());
    await Q.sleep(1200);
    console.log('TEXT chat-list:', await Q.text(page, '.private-chat'));
    await Q.snap(page, 'chat-list', kind);
    await page.locator('.private-chat .chat-close').first().evaluate(b => b.click());
    await Q.sleep(500);
    // the room's group chat
    await Q.clickHidden(page, { open: 'conversation' });
    await page.waitForSelector('.music-community:not([hidden])', { timeout: 20000 });
    await page.waitForFunction(() => document.querySelector('.music-community [data-group-join]') || document.querySelector('.music-community .community-messages'), null, { timeout: 20000 }).catch(() => {});
    await Q.sleep(800);
    console.log('TEXT room-chat-join:', await Q.text(page, '.music-community'));
    await Q.snap(page, 'room-chat-join', kind);
    const join = page.locator('.music-community form[data-group-join]');
    if (await join.count()) {
      await page.locator('.music-community form[data-group-join] input[name="consent"]').check({ force: true });
      await page.locator('.music-community form[data-group-join] button[type="submit"]').first().evaluate(b => b.click());
      await page.waitForSelector('.music-community .community-messages article', { timeout: 30000 }).catch(() => console.log('no messages'));
      await Q.sleep(1500);
    }
    console.log('TEXT room-chat-joined:', await Q.text(page, '.music-community'));
    console.log('room-chat', JSON.stringify(await Q.audit(page, '.music-community')));
    await Q.snap(page, 'room-chat-joined', kind);
    await page.evaluate(() => { const d = document.querySelector('.music-community .conversation-management'); if (d) d.open = true; });
    await Q.sleep(500);
    console.log('TEXT room-chat-settings:', await Q.text(page, '.music-community .conversation-management'));
    await Q.snapScroll(page, 'room-chat-settings', kind, '.music-community .conversation-content', 3);
    await page.evaluate(() => { const d = document.querySelector('.music-community .conversation-management'); if (d) d.open = false; });
    // linked community button
    await page.evaluate(() => document.querySelector('.music-community [data-group="linked"]')?.click());
    await Q.sleep(1500);
    console.log('toasts-after-linked', JSON.stringify(await Q.toasts(page)));
    await Q.snap(page, 'room-chat-linked', kind);
    console.log('TEXT linked-community:', await Q.text(page, '.music-community'));
    // back to the room chat
    await page.evaluate(() => document.querySelector('.music-community [data-group="close"]')?.click());
    await Q.sleep(600);
    await Q.clickHidden(page, { open: 'conversation' });
    await page.waitForSelector('.music-community:not([hidden]) [data-group-games]', { timeout: 20000 });
    await Q.sleep(800);
    // games
    await page.locator('.music-community [data-group-games]').first().evaluate(b => b.click());
    await page.waitForSelector('.music-games', { timeout: 20000 });
    await Q.sleep(1500);
    console.log('TEXT games-list:', await Q.text(page, '.music-games'));
    await page.evaluate(() => { const d = document.querySelector('.music-games details'); if (d) d.open = true; });
    await Q.sleep(400);
    console.log('games', JSON.stringify(await Q.audit(page, '.music-games')));
    await Q.snapScroll(page, 'games-list', kind, '.music-games .community-scroll', 3);
    const gid = await page.evaluate(() => document.querySelector('.music-games [data-game-id]')?.dataset.gameId);
    if (gid) {
      await page.locator('.music-games [data-game-id]').first().evaluate(b => b.click());
      await page.waitForSelector('.music-games .game-phase', { timeout: 20000 }).catch(() => {});
      await Q.sleep(1000);
      console.log('TEXT game-detail:', await Q.text(page, '.music-games'));
      await Q.snapScroll(page, 'game-detail', kind, '.music-games .community-scroll', 3);
      const gj = page.locator('.music-games form[data-game-form="join"]');
      if (await gj.count()) {
        await page.locator('.music-games form[data-game-form="join"] input[name="consent"]').check({ force: true });
        await page.locator('.music-games form[data-game-form="join"] button').first().evaluate(b => b.click());
        await Q.sleep(2500);
      }
      await page.waitForFunction(() => document.querySelector('.music-games [data-game-choice]'), null, { timeout: 25000 }).catch(() => console.log('game not started'));
      const choice = page.locator('.music-games [data-game-choice]');
      if (await choice.count()) {
        await choice.first().evaluate(b => b.click());
        await Q.sleep(500);
        console.log('TEXT game-choice:', await Q.text(page, '.music-games'));
        await page.evaluate(() => document.querySelector('.music-games form[data-game-form="answer"]')?.scrollIntoView({ block: 'center' }));
        await Q.snap(page, 'game-choice', kind);
        await page.locator('.music-games form[data-game-form="answer"] input[name="consent"]').check({ force: true });
        await page.locator('.music-games form[data-game-form="answer"] button').first().evaluate(b => b.click());
        await page.waitForFunction(() => document.querySelector('.music-games .game-result') || /本局完成/.test(document.querySelector('.music-games')?.textContent || ''), null, { timeout: 30000 }).catch(() => console.log('no result'));
        await Q.sleep(1000);
        console.log('TEXT game-result:', await Q.text(page, '.music-games'));
        await Q.snapScroll(page, 'game-result', kind, '.music-games .community-scroll', 3);
      }
    }
    await page.evaluate(() => document.querySelector('.music-games [data-game="close"]')?.click());
    await Q.sleep(1200);
    // topics
    await page.locator('.music-community [data-group-topics]').first().evaluate(b => b.click());
    await page.waitForSelector('.music-topics', { timeout: 20000 });
    await Q.sleep(1500);
    await page.evaluate(() => { const d = document.querySelector('.music-topics details'); if (d) d.open = true; });
    console.log('TEXT topics:', await Q.text(page, '.music-topics'));
    console.log('topics', JSON.stringify(await Q.audit(page, '.music-topics')));
    await Q.snapScroll(page, 'topics', kind, '.music-topics .community-scroll', 3);
    await page.evaluate(() => document.querySelector('.music-topics [data-topic="close"]')?.click());
    await Q.sleep(1200);
    // worldcup
    await page.locator('.music-community [data-group-worldcup]').first().evaluate(b => b.click());
    await page.waitForSelector('.worldcup-panel', { timeout: 20000 });
    await Q.sleep(1500);
    console.log('TEXT worldcup-list:', await Q.text(page, '.worldcup-panel'));
    console.log('worldcup', JSON.stringify(await Q.audit(page, '.worldcup-panel')));
    await Q.snapScroll(page, 'worldcup-list', kind, '.worldcup-panel .community-scroll', 3);
    const cup = page.locator('.worldcup-panel [data-cup-id]');
    if (await cup.count()) {
      await cup.first().evaluate(b => b.click());
      await page.waitForSelector('.worldcup-panel .worldcup-match', { timeout: 20000 }).catch(() => {});
      await Q.sleep(1200);
      const pickc = page.locator('.worldcup-panel [data-cup-choice]');
      if (await pickc.count()) { await pickc.first().evaluate(b => b.click()); await Q.sleep(600); }
      console.log('TEXT worldcup-detail:', await Q.text(page, '.worldcup-panel'));
      await Q.snapScroll(page, 'worldcup-detail', kind, '.worldcup-panel .community-scroll', 4);
    }
    await page.evaluate(() => document.querySelector('.worldcup-panel [data-cup-close]')?.click());
    await Q.sleep(1200);
    console.log('errors', JSON.stringify(page.__errors));
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); } finally { await browser.close(); }
})();
