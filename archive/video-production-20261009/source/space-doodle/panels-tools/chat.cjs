// The private chat: wave at a cast member, wait for the accept, open 私聊, send lines until the thread scrolls; the × stays visible.
// usage: node chat.cjs <phone|desktop>
const S = require('./sheets.cjs');
const path = require('path');
S.watchdog(285);
const vp = process.argv[2] || 'phone';
const OUT = process.env.SHOTS_OUT || '/tmp/space-doodle/shots/panels';
const file = name => path.join(OUT, `${name}-${vp}.png`);
const log = (label, value) => console.log(`${label} ${JSON.stringify(value)}`);
(async () => {
  const browser = await S.launch();
  try {
    const run = await S.open(browser, vp);
    const { page } = run;
    await S.enter(run);
    await S.clickHidden(page, { open: 'people' });
    await page.waitForSelector('.panel[data-kind="people"] [data-person]', { timeout: 20000 });
    await page.locator('#panel [data-person]').first().evaluate(b => b.click());
    await page.waitForSelector('.panel[data-kind="person"] [data-social-send]', { timeout: 20000 });
    await page.locator('#panel [data-social-send]').first().evaluate(b => b.click());
    await page.waitForSelector('#panel [data-open="chats"]', { timeout: 90000 });
    await page.locator('#panel [data-open="chats"]').first().evaluate(b => b.click());
    await page.waitForSelector('.private-chat:not([hidden]) .chat-thread:not([hidden])', { timeout: 20000 });
    await S.sleep(1500);
    const measure = () => S.measure(page, { root: '.private-chat', close: '.chat-close', scroller: '.chat-thread' });
    log('chat:open', await measure());
    for (let i = 1; i <= 7; i++) {
      await page.fill('#chat-text', `第 ${i} 句：刚刚那首歌真好听，灯一亮大家都举起了手。`);
      await page.locator('.chat-composer button[type="submit"]').evaluate(b => b.click());
      await S.sleep(900);
    }
    await S.sleep(1500);
    log('chat:after-sending', await measure());
    await S.shot(page, file('chat-bottom'));
    await S.scrollTo(page, 0, '.private-chat .chat-thread'); await S.sleep(300);
    log('chat:scrolled-to-top', await measure());
    await S.shot(page, file('chat-top'));
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); } finally { await browser.close(); }
})();
