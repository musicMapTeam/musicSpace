// The ten final screens of the copy revision, one fresh world per viewport: first screen, join, room, onboarding card, upload, wall,
// accepted exchange, chat, community, about. node final-shots.cjs <phone|desktop>  (SPACE_URL = the served build)
const L = require('./lib.cjs');
const path = require('path');
L.watchdog(290);
const vp = process.argv[2] || 'phone';
const DIR = process.env.FINAL_DIR || '/tmp/space-copy/final';
L.setCorpus(`final-${vp}`);
const shoot = async (page, name) => { await L.sleep(450); const file = path.join(DIR, `${vp}-${name}.png`); await page.screenshot({ path: file }); console.log('shot', file); };
(async () => {
  const browser = await L.launch();
  try {
    const run = await L.open(browser, vp);
    const { page } = run; page.__vp = vp;
    await L.ready(run);
    await page.evaluate(() => document.fonts.ready).catch(() => {});
    await L.sleep(1200);
    await L.grab(page, 'first-screen', 'body', { quiet: true });
    await shoot(page, '01-first-screen');
    await L.press(run, '#join');
    await page.waitForSelector('form[data-form="demo-entry"]', { timeout: 30000 });
    await L.sleep(800);
    await L.grab(page, 'join', '#panel', { quiet: true });
    await shoot(page, '02-join');
    await page.check('form[data-form="demo-entry"] input[name="consent"]', { force: true });
    await page.waitForFunction(() => { const b = document.querySelector('form[data-form="demo-entry"] button[type="submit"]'); return b && !b.disabled; }, null, { timeout: 90000 });
    await L.press(run, 'form[data-form="demo-entry"] button[type="submit"]');
    await page.waitForSelector('[data-tour-action="sample:sample-crowd"]', { timeout: 60000 });
    await L.sleep(2500);
    // the room: the card folded away, then the onboarding card itself
    await L.press(run, '[data-tour-toggle]');
    await L.sleep(1200);
    await L.grab(page, 'room', 'body', { quiet: true });
    await shoot(page, '03-room');
    await L.press(run, '[data-tour-toggle]');
    await L.sleep(1000);
    await L.grab(page, 'onboarding', '#demo-tour', { quiet: true });
    await shoot(page, '04-onboarding-card');
    await L.press(run, '[data-tour-action="sample:sample-crowd"]');
    await page.waitForSelector('form[data-form="upload"] .photo-review', { timeout: 30000 });
    await page.waitForFunction(() => /^(sure|unsure|off)/.test(document.querySelector('form[data-form="upload"] [data-ai-line]')?.getAttribute('data-ai-key') || ''), null, { timeout: 90000 }).catch(() => {});
    await L.sleep(900);
    await L.grab(page, 'upload', '#panel', { quiet: true });
    await shoot(page, '05-upload');
    const pressed = await page.evaluate(() => Boolean(document.querySelector('form[data-form="upload"] .moment-chip[aria-pressed="true"]')));
    if (!pressed) await L.js(page, 'form[data-form="upload"] .moment-chip[data-moment-viewpoint="crowd"]');
    await L.js(page, 'form[data-form="upload"] button[type="submit"]');
    await page.locator('#panel [data-exchange-offer]').first().waitFor({ state: 'visible', timeout: 30000 });
    await L.sleep(1500);
    await L.grab(page, 'wall', '#panel', { quiet: true });
    await shoot(page, '06-wall');
    await L.press(run, '#panel [data-exchange-offer]');
    await page.waitForSelector('.photo-exchanges:not([hidden]) [data-x-consent]', { timeout: 30000 });
    await L.sleep(600);
    await L.js(page, '.photo-exchanges [data-x-consent]');
    await page.waitForFunction(() => { const b = document.querySelector('.photo-exchanges [data-x-send]'); return b && !b.disabled; }, null, { timeout: 30000 });
    await L.js(page, '.photo-exchanges [data-x-send]');
    await page.waitForFunction(() => /交换已接受/.test(document.querySelector('.photo-exchanges .exchange-status')?.innerText || ''), null, { timeout: 45000 });
    await L.sleep(1800);
    await L.grab(page, 'exchange-accepted', '.photo-exchanges', { quiet: true });
    await shoot(page, '07-exchange-accepted');
    await page.locator('.photo-exchanges [data-x-close]').first().evaluate(el => el.click()).catch(() => {});
    await L.sleep(700);
    await L.closeSheet(page);
    // chat: wave at 北屿, then talk
    await L.clickHidden(page, { open: 'people' });
    await page.waitForFunction(() => document.querySelector('#panel')?.dataset.kind === 'people' && !document.querySelector('#panel').hidden, null, { timeout: 15000 });
    const bei = await page.evaluate(() => [...document.querySelectorAll('#panel [data-person]')].find(b => /北屿/.test(b.innerText))?.dataset.person);
    await page.locator(`#panel [data-person="${bei}"]`).evaluate(b => b.click());
    await page.waitForSelector('#panel [data-social-send]', { timeout: 20000 });
    await page.locator('#panel [data-social-send]').evaluate(b => b.click());
    await page.waitForFunction(() => /你们已经是朋友了/.test(document.querySelector('#panel')?.innerText || ''), null, { timeout: 30000 });
    await L.clickHidden(page, { open: 'chats' });
    await page.waitForSelector('.private-chat:not([hidden])', { timeout: 15000 }).catch(() => {});
    await L.sleep(800);
    const inThread = await page.evaluate(() => { const t = document.querySelector('.chat-thread'); return t && !t.hidden; });
    if (!inThread) await page.locator(`[data-chat-peer="${bei}"]`).first().evaluate(b => b.click());
    await page.waitForFunction(() => /你拍到的是哪一面/.test(document.querySelector('.chat-messages')?.innerText || ''), null, { timeout: 30000 });
    for (const [text, reply] of [['我在二楼拍到了人海，你呢？', '今晚的返场太好听了。'], ['你也在二楼吗？', '照片墙上有好几张是同一刻拍的']]) {
      await page.locator('#chat-text').fill(text);
      await page.locator('.chat-composer button[type="submit"]').evaluate(b => b.click());
      await page.waitForFunction(r => (document.querySelector('.chat-messages')?.innerText || '').includes(r), reply, { timeout: 30000 });
    }
    await L.sleep(1200);
    await L.grab(page, 'chat', '.private-chat', { quiet: true });
    await shoot(page, '08-chat');
    await page.locator('.private-chat .chat-close').first().evaluate(el => el.click()).catch(() => {});
    await L.sleep(700);
    await L.closeSheet(page);
    // the venue's fan community, from the show's group chat
    await L.clickHidden(page, { open: 'conversation' });
    await page.waitForSelector('.music-community:not([hidden])', { timeout: 20000 });
    await page.waitForFunction(() => document.querySelector('.music-community [data-group-join]') || document.querySelector('.music-community .community-messages'), null, { timeout: 20000 }).catch(() => {});
    if (await page.locator('.music-community form[data-group-join]').count()) {
      await page.locator('.music-community form[data-group-join] input[name="consent"]').check({ force: true });
      await page.locator('.music-community form[data-group-join] button[type="submit"]').first().evaluate(b => b.click());
      await page.waitForSelector('.music-community .community-messages article', { timeout: 30000 }).catch(() => {});
      await L.sleep(1000);
    }
    await page.evaluate(() => document.querySelector('.music-community [data-group="linked"]')?.click());
    await page.waitForSelector('.music-community form[data-group-join]', { timeout: 20000 });
    await L.sleep(800);
    await page.locator('.music-community form[data-group-join] input[name="consent"]').check({ force: true });
    await page.locator('.music-community form[data-group-join] button[type="submit"]').first().evaluate(b => b.click());
    await page.waitForSelector('.music-community .community-messages', { timeout: 30000 }).catch(() => {});
    await page.locator('.music-community #community-text, .music-community textarea').first().fill('下一场见！').catch(() => {});
    await page.locator('.music-community [data-group-send] button[type="submit"]').first().evaluate(b => b.click()).catch(() => {});
    await L.sleep(2500);
    await L.grab(page, 'community', '.music-community', { quiet: true });
    await shoot(page, '09-community');
    await page.evaluate(() => document.querySelector('.music-community [data-group="close"]')?.click());
    await L.sleep(700);
    await L.clickHidden(page, { open: 'about' });
    await page.waitForFunction(() => /关于 Music Space/.test(document.querySelector('#panel')?.innerText || ''), null, { timeout: 15000 });
    await L.sleep(900);
    await L.grab(page, 'about', '#panel', { quiet: true });
    await shoot(page, '10-about');
    await page.evaluate(() => { const p = document.querySelector('#panel'); p.scrollTop = p.scrollHeight; });
    await shoot(page, '10-about-end');
    console.log('page errors:', JSON.stringify(page.__errors));
    await L.log(page, 'final');
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); } finally { L.flush(); await browser.close(); }
})();
