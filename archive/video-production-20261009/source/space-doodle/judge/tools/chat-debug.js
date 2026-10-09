// Why no example reply after the visitor writes? Watch the autopilot counters, then reopen the thread.
const L = require('./lib.js');
const vp = process.argv[2] || 'desktop';
const label = `chat-debug-${vp}`;
(async () => {
  const browser = await L.launch();
  const run = await L.open(browser, vp, { label });
  const { page } = run;
  const say = (k, v) => console.log(new Date().toISOString().slice(11, 19), k, '=>', typeof v === 'string' ? v : JSON.stringify(v));
  const t = async sel => { const l = page.locator(sel).first(); await l.waitFor({ state: 'visible', timeout: 45000 }); await l.click(); };
  const stats = () => page.evaluate(() => { const s = window.__SPACE_STATIC__?.stats?.() || {}; const a = s.autopilot || {}; return { ticks: a.ticks, skipped: a.skipped, req: a.requests, mut: a.mutations, fail: a.failures, busy: a.busy, running: a.running, last: a.lastTick && { req: a.lastTick.requests, mut: a.lastTick.mutations, fail: a.lastTick.failures, ms: Math.round(a.lastTick.ms) }, vis: document.visibilityState }; });
  const thread = () => page.evaluate(() => document.querySelector('.chat-messages')?.innerText.trim().replace(/\s+/g, ' ').slice(0, 400));
  try {
    await L.boot(page, L.baseUrl('root'));
    say('keys of stats', await page.evaluate(() => Object.keys(window.__SPACE_STATIC__?.stats?.() || {})));
    await t('#join');
    await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"] button[type="submit"]')?.disabled, null, { timeout: 60000 });
    await page.check('form[data-form="demo-entry"] input[name="consent"]');
    await t('form[data-form="demo-entry"] button[type="submit"]');
    await page.waitForFunction(() => document.querySelector('.frame')?.dataset.stage === 'room', null, { timeout: 30000 });
    await L.sleep(1000);
    await t('.camera-nav [data-view="person"]');
    await page.locator('#panel button[data-person]', { hasText: '小满' }).first().click();
    await t('#panel [data-social-send]');
    await t('#panel [data-open="chats"][data-id]');
    await page.waitForFunction(() => /你拍到的是哪一面/.test(document.querySelector('.chat-messages')?.innerText || ''), null, { timeout: 20000 });
    say('stats before send', await stats());
    await page.locator('#chat-text').fill('刚刚返场那首太好听了！');
    await page.click('.chat-composer button[type="submit"]');
    for (let i = 0; i < 12; i++) {
      await L.sleep(4000);
      say(`+${(i + 1) * 4}s`, { ...(await stats()), thread: (await thread())?.slice(-80) });
      if (/今晚的返场太好听了/.test((await thread()) || '')) break;
    }
    // reopen the thread from the list
    await page.click('.chat-back').catch(() => {});
    await L.sleep(1500);
    say('list', await page.evaluate(() => document.querySelector('.chat-conversations')?.innerText.trim().replace(/\s+/g, ' ').slice(0, 300)));
    await page.locator('.chat-conversations [data-chat-peer]').first().click().catch(e => say('reopen fail', e.message.split('\n')[0]));
    await L.sleep(3000);
    say('thread after reopen', await thread());
    await L.shot(run, 'thread');
    // try a second message
    await page.locator('#chat-text').fill('你拍的是人海吧？');
    await page.click('.chat-composer button[type="submit"]');
    for (let i = 0; i < 6; i++) { await L.sleep(4000); const th = await thread(); say(`2nd +${(i + 1) * 4}s`, { ...(await stats()), thread: th?.slice(-100) }); }
  } catch (e) { say('FAILED', e.message.split('\n')[0]); }
  say('console', run.consoleMsgs); say('pageErrors', run.pageErrors);
  await browser.close();
})();
