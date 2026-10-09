// W5: World Cup (list, a match, vote), games (list, join, answer, result), topics, the corner (with a friend) + PNG if reachable,
// feedback to the host (form, sent, my reports, withdraw confirm), wardrobe in the room, identity backup.
const L = require('./lib.cjs');
const fs = require('fs');
L.watchdog(295);
const vp = process.argv[2] || 'phone';
const part = process.argv[3] || 'all';
L.setCorpus(`w5-${vp}-${part}`);
(async () => {
  const browser = await L.launch();
  try {
    const run = await L.open(browser, vp);
    const { page } = run; page.__vp = vp;
    await L.ready(run);
    await L.enter(run);
    const members = await page.evaluate(() => window.__SPACE_EVENT_QA__().members);
    const byName = n => members.find(m => m.name === n)?.id;
    if (part === 'all' || part === 'cup') {
      await L.clickHidden(page, { open: 'conversation' });
      await page.waitForSelector('.music-community:not([hidden])', { timeout: 20000 });
      await page.waitForFunction(() => document.querySelector('.music-community [data-group-join]') || document.querySelector('.music-community .community-messages'), null, { timeout: 20000 }).catch(() => {});
      const join = page.locator('.music-community form[data-group-join]');
      if (await join.count()) {
        await page.locator('.music-community form[data-group-join] input[name="consent"]').check({ force: true });
        await page.locator('.music-community form[data-group-join] button[type="submit"]').first().evaluate(b => b.click());
        await page.waitForSelector('.music-community [data-group-worldcup]', { timeout: 30000 }).catch(() => {});
        await L.sleep(1200);
      }
      // World Cup
      await page.locator('.music-community [data-group-worldcup]').first().evaluate(b => b.click());
      await page.waitForSelector('.worldcup-panel', { timeout: 20000 });
      await L.sleep(1800);
      await page.evaluate(() => document.querySelectorAll('.worldcup-panel details').forEach(d => d.open = true));
      await L.grab(page, 'worldcup-list', '.worldcup-panel');
      await L.shotScroll(page, 'w5-01-worldcup-list', '.worldcup-panel .community-scroll', 3);
      await L.check(page, 'worldcup-list', '.worldcup-panel');
      const cup = page.locator('.worldcup-panel [data-cup-id]');
      if (await cup.count()) {
        await cup.first().evaluate(b => b.click());
        await L.sleep(1800);
        await L.grab(page, 'worldcup-detail', '.worldcup-panel');
        await L.shotScroll(page, 'w5-02-worldcup-detail', '.worldcup-panel .community-scroll', 4);
        await L.check(page, 'worldcup-detail', '.worldcup-panel');
        const pick = page.locator('.worldcup-panel [data-cup-choice]');
        if (await pick.count()) { await pick.first().evaluate(b => b.click()); await L.sleep(600); }
        const vote = page.locator('.worldcup-panel [data-cup-vote] button, .worldcup-panel form[data-cup-vote] button');
        await page.locator('.worldcup-panel form[data-cup-vote] input[type="checkbox"]').first().check({ force: true }).catch(() => {});
        if (await vote.count()) { await vote.first().evaluate(b => b.click()); await L.sleep(2500); }
        await L.grab(page, 'worldcup-voted', '.worldcup-panel');
        await L.shotScroll(page, 'w5-03-worldcup-voted', '.worldcup-panel .community-scroll', 4);
        // wait for the round to advance (the cast votes)
        await L.sleep(6000);
        await L.grab(page, 'worldcup-later', '.worldcup-panel');
        await L.shotScroll(page, 'w5-04-worldcup-later', '.worldcup-panel .community-scroll', 4);
      }
      await page.evaluate(() => document.querySelector('.worldcup-panel [data-cup-close]')?.click());
      await L.sleep(1200);
      // games
      await page.locator('.music-community [data-group-games]').first().evaluate(b => b.click());
      await page.waitForSelector('.music-games', { timeout: 20000 });
      await L.sleep(1800);
      await page.evaluate(() => document.querySelectorAll('.music-games details').forEach(d => d.open = true));
      await L.grab(page, 'games-list', '.music-games');
      await L.shotScroll(page, 'w5-05-games', '.music-games .community-scroll', 3);
      await L.check(page, 'games-list', '.music-games');
      if (await page.locator('.music-games [data-game-id]').count()) {
        await page.locator('.music-games [data-game-id]').first().evaluate(b => b.click());
        await L.sleep(1500);
        await L.grab(page, 'game-detail', '.music-games');
        await L.shotScroll(page, 'w5-06-game-detail', '.music-games .community-scroll', 3);
        const gj = page.locator('.music-games form[data-game-form="join"]');
        if (await gj.count()) {
          await page.locator('.music-games form[data-game-form="join"] input[name="consent"]').check({ force: true });
          await page.locator('.music-games form[data-game-form="join"] button').first().evaluate(b => b.click());
          await L.sleep(2500);
          await L.grab(page, 'game-joined', '.music-games');
        }
        await page.waitForFunction(() => document.querySelector('.music-games [data-game-choice]'), null, { timeout: 25000 }).catch(() => console.log('game not started'));
        const choice = page.locator('.music-games [data-game-choice]');
        if (await choice.count()) {
          await choice.first().evaluate(b => b.click());
          await L.sleep(500);
          await L.grab(page, 'game-choice', '.music-games');
          await L.shotScroll(page, 'w5-07-game-choice', '.music-games .community-scroll', 3);
          await page.locator('.music-games form[data-game-form="answer"] input[name="consent"]').check({ force: true }).catch(() => {});
          await page.locator('.music-games form[data-game-form="answer"] button').first().evaluate(b => b.click()).catch(() => {});
          await page.waitForFunction(() => document.querySelector('.music-games .game-result') || /本局完成|揭晓|结果/.test(document.querySelector('.music-games')?.textContent || ''), null, { timeout: 30000 }).catch(() => console.log('no result'));
          await L.sleep(1500);
          await L.grab(page, 'game-result', '.music-games');
          await L.shotScroll(page, 'w5-08-game-result', '.music-games .community-scroll', 3);
        }
      }
      await page.evaluate(() => document.querySelector('.music-games [data-game="close"]')?.click());
      await L.sleep(1200);
      // topics
      await page.locator('.music-community [data-group-topics]').first().evaluate(b => b.click());
      await page.waitForSelector('.music-topics', { timeout: 20000 });
      await L.sleep(1800);
      await page.evaluate(() => document.querySelectorAll('.music-topics details').forEach(d => d.open = true));
      await L.grab(page, 'topics', '.music-topics');
      await L.shotScroll(page, 'w5-09-topics', '.music-topics .community-scroll', 3);
      await L.check(page, 'topics', '.music-topics');
      await page.evaluate(() => document.querySelector('.music-topics [data-topic="close"]')?.click());
      await L.sleep(1000);
      await page.evaluate(() => document.querySelector('.music-community [data-group="close"]')?.click());
      await L.sleep(600);
    }
    if (part === 'all' || part === 'corner') {
      // a friend (阿遥), then the corner
      await L.clickHidden(page, { open: 'person', id: byName('阿遥') });
      await page.waitForSelector('.panel[data-kind="person"]', { timeout: 20000 });
      await L.js(page, '#panel [data-social-send]');
      await page.waitForSelector('#panel [data-open="corners"]', { timeout: 60000 }).catch(() => console.log('not accepted'));
      await L.sleep(800);
      await L.js(page, '#panel [data-open="corners"]');
      await page.waitForSelector('.corner-panel', { timeout: 20000 });
      await L.sleep(1500);
      await L.grab(page, 'corner-invite', '.corner-panel');
      await L.shot(page, 'w5-10-corner-invite');
      const cc = page.locator('.corner-panel form[data-corner-create]');
      if (await cc.count()) {
        await page.locator('.corner-panel form[data-corner-create] input[name="participation"]').check({ force: true });
        await page.locator('.corner-panel form[data-corner-create] button').first().evaluate(b => b.click());
        await L.sleep(3000);
        await L.grab(page, 'corner-after-invite', '.corner-panel');
        await L.shot(page, 'w5-11-corner-waiting');
        await page.waitForFunction(() => document.querySelector('.corner-panel form[data-corner-edit]'), null, { timeout: 20000 }).catch(() => console.log('corner never joined by the cast'));
        await L.grab(page, 'corner-after-wait', '.corner-panel');
        await L.shot(page, 'w5-12-corner-after-wait');
      }
      await page.evaluate(() => document.querySelector('.corner-panel [data-corner-list]')?.click());
      await L.sleep(1500);
      await L.grab(page, 'corner-list', '.corner-panel');
      await L.shot(page, 'w5-13-corner-list');
      await page.evaluate(() => document.querySelector('.corner-panel [data-corner-close]')?.click());
      await L.sleep(500);
      // feedback to the host about 北屿
      await L.clickHidden(page, { open: 'person', id: byName('北屿') });
      await page.waitForSelector('.panel[data-kind="person"]', { timeout: 20000 });
      await L.sleep(600);
      await L.js(page, '#panel [data-open="feedback"]');
      await page.waitForSelector('.room-moderation:not([hidden])', { timeout: 20000 });
      await L.sleep(1000);
      await L.grab(page, 'feedback-form', '.room-moderation');
      await L.shotScroll(page, 'w5-14-feedback', '.room-moderation .moderation-body', 3);
      await L.check(page, 'feedback-form', '.room-moderation');
      await page.fill('.room-moderation textarea[name="details"]', '一直挡在前面').catch(() => {});
      await page.locator('.room-moderation input[name="consent"]').check({ force: true }).catch(() => {});
      await page.locator('.room-moderation button[type="submit"]').first().evaluate(b => b.click()).catch(() => {});
      await L.sleep(2500);
      await L.grab(page, 'feedback-sent', '.room-moderation');
      await L.shotScroll(page, 'w5-15-feedback-sent', '.room-moderation .moderation-body', 2);
      const wd = page.locator('.room-moderation [data-mod-withdraw]');
      if (await wd.count()) { await wd.first().evaluate(b => b.click()); await L.sleep(600); await L.grab(page, 'feedback-withdraw-confirm', '.room-moderation'); await L.shot(page, 'w5-16-feedback-withdraw'); }
      await page.evaluate(() => document.querySelector('.room-moderation [data-mod-close]')?.click());
      await L.sleep(500);
      // wardrobe in the room
      await L.press(run, '#my-look');
      await page.waitForSelector('.wardrobe:not([hidden])', { timeout: 20000 });
      await L.sleep(800);
      await page.evaluate(() => { const d = document.querySelector('.wardrobe details'); if (d) d.open = true; });
      await L.grab(page, 'wardrobe-room', '.wardrobe');
      await L.shot(page, 'w5-17-wardrobe');
      await L.check(page, 'wardrobe', '.wardrobe');
      // try another hairstyle and save
      await page.locator('.wardrobe [data-wardrobe-close]').first().evaluate(b => b.click()).catch(() => {});
      await L.sleep(500);
      // identity backup
      await L.clickHidden(page, { open: 'identity-backup' });
      await L.sleep(1000);
      await L.grab(page, 'identity-backup', '.identity-continuity, #panel');
      await L.shot(page, 'w5-18-identity');
    }
    await L.log(page, 'w5');
    console.log('errors', JSON.stringify(page.__errors));
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); } finally { L.flush(); await browser.close(); }
})();
