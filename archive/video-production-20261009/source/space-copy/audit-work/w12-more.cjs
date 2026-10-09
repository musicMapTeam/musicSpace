// W12: (a) a removed friend's chat; (b) the ready-made photos inside a room the visitor opened (开个房).
const L = require('./lib.cjs');
L.watchdog(290);
const vp = process.argv[2] || 'phone';
L.setCorpus(`w12-${vp}`);
(async () => {
  const browser = await L.launch();
  try {
    const run = await L.open(browser, vp);
    const { page } = run; page.__vp = vp;
    await L.ready(run);
    await L.enter(run);
    const members = await page.evaluate(() => window.__SPACE_EVENT_QA__().members);
    const yao = members.find(m => m.name === '阿遥')?.id;
    await L.clickHidden(page, { open: 'person', id: yao });
    await page.waitForSelector('.panel[data-kind="person"]', { timeout: 20000 });
    await L.js(page, '#panel [data-social-send]');
    await page.waitForSelector('#panel [data-open="remove-friend"]', { timeout: 60000 });
    await L.js(page, '#panel [data-open="remove-friend"]');
    await L.sleep(600);
    await L.js(page, '#panel [data-social-remove]');
    await L.sleep(2500);
    await L.grab(page, 'after-remove-friend', '#panel');
    await L.clickHidden(page, { open: 'chats', id: yao });
    await page.waitForSelector('.private-chat:not([hidden])', { timeout: 20000 });
    await L.sleep(2500);
    await L.grab(page, 'chat-after-remove', '.private-chat');
    await L.shot(page, 'w12-01-chat-ended');
    await page.locator('.private-chat .chat-close').first().evaluate(b => b.click()).catch(() => {});
    await L.sleep(500);
    await L.clickHidden(page, { open: 'person', id: yao });
    await L.sleep(1000);
    await L.grab(page, 'person-after-remove', '#panel');
    await L.closeSheet(page);
    // (b) open my own room and pick 「人海那张」 there
    await L.clickHidden(page, { open: 'create' });
    await page.waitForSelector('form[data-form="create"]', { timeout: 20000 });
    await page.fill('form[data-form="create"] input[name="title"]', '周五的最后一首');
    await page.fill('form[data-form="create"] input[name="venue"]', '小酒馆 Livehouse');
    const consent = page.locator('form[data-form="create"] input[name="consent"]');
    if (await consent.count()) await consent.check({ force: true });
    await page.locator('form[data-form="create"] button[type="submit"]').first().evaluate(b => b.click());
    await page.waitForFunction(() => /周五的最后一首/.test(document.querySelector('#room-title')?.textContent || ''), null, { timeout: 30000 });
    await L.sleep(2000);
    await L.grab(page, 'own-room-tour', '.demo-tour');
    await L.js(page, '[data-tour-action="sample:sample-crowd"]');
    await page.waitForSelector('form[data-form="upload"] .photo-review', { timeout: 30000 });
    await L.aiSettled(page); await L.sleep(2000);
    await L.grab(page, 'own-room-sample', '#panel');
    await L.shotScroll(page, 'w12-02-own-room-sample', '#panel', 3);
    await page.locator('form[data-form="upload"] button[type="submit"]').first().evaluate(b => b.click());
    await L.sleep(3000);
    await L.grab(page, 'own-room-wall-sample', '#panel');
    await L.shotScroll(page, 'w12-03-own-room-wall', '#panel', 2);
    await L.log(page, 'w12');
    console.log('errors', JSON.stringify(page.__errors));
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); } finally { L.flush(); await browser.close(); }
})();
