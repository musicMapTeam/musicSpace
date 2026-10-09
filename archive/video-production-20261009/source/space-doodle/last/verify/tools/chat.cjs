// Private chat with an example character (fresh context, production build): wave from the person card, open the private thread, send three
// messages in a row. After each: the own message is in view inside .chat-thread, the reply arrives, is in view and acknowledged (no
// [data-incoming] left). Then close: the ♡ count (#social-count) must end at 0 (hidden or "0"), also in the chat list.
//   node chat.cjs <phone|desktop> <base> <小满|阿遥> <label>
const L = require('./lib.cjs');
const fs = require('fs');
L.watchdog(285);
const [, , kind = 'desktop', BASE = 'http://127.0.0.1:4783/musicSpace/', who = '小满', label = 'chat'] = process.argv;
const DIR = `${L.OUT}/${label}`;
fs.mkdirSync(DIR, { recursive: true });
const out = { kind, base: BASE, who, results: {}, failures: [] };
const fail = m => { out.failures.push(m); console.log(kind, '!! FAIL', m); };
const note = (k, v) => { out.results[k] = v; console.log(kind, k, JSON.stringify(v)); };

(async () => {
  const browser = await L.launch();
  let run;
  try {
    run = await L.open(browser, kind, BASE);
    const { page } = run;
    const badge = () => page.evaluate(() => { const c = document.querySelector('#social-count'); return c && !c.hidden && c.getClientRects().length ? c.textContent.trim() || '0' : '0'; });
    const geo = () => page.evaluate(() => {
      const th = document.querySelector('.chat-thread'), r = th.getBoundingClientRect();
      const inView = n => { const b = n.getBoundingClientRect(); return b.height > 0 && b.top >= Math.max(0, r.top) - 1 && b.bottom <= Math.min(innerHeight, r.bottom) + 1; };
      const theirs = [...document.querySelectorAll('.chat-messages .chat-message.theirs')], mine = [...document.querySelectorAll('.chat-messages .chat-message.mine')];
      return { st: Math.round(th.scrollTop), sh: th.scrollHeight, ch: th.clientHeight, gap: Math.round(th.scrollHeight - th.scrollTop - th.clientHeight), theirs: theirs.length, mine: mine.length,
        lastMineVisible: mine.length ? inView(mine.at(-1)) : null, lastTheirsVisible: theirs.length ? inView(theirs.at(-1)) : null,
        lastTheirs: theirs.at(-1)?.querySelector('p')?.textContent.slice(0, 24) || '', unread: [...document.querySelectorAll('.chat-messages [data-incoming]')].map(n => n.textContent.trim().slice(0, 16)) };
    });
    const waitMine = text => page.waitForFunction(t => [...document.querySelectorAll('.chat-messages .chat-message.mine p')].some(p => p.textContent === t), text, { timeout: 20000 });
    const waitReply = n => page.waitForFunction(k => document.querySelectorAll('.chat-messages .chat-message.theirs').length > k, n, { timeout: 40000 });

    await L.enter(run);
    await L.sleep(1200);
    await L.press(run, '.camera-nav [data-view="person"]');
    await L.press(run, page.locator('#panel button[data-person]', { hasText: who }).first());
    await L.sleep(600);
    note('person-card', await page.evaluate(() => ({ kind: document.querySelector('#panel').dataset.kind, st: Math.round(document.querySelector('#panel').scrollTop), title: document.querySelector('#panel-body h2')?.textContent.trim() })));
    await L.press(run, page.locator('#panel [data-social-send]').first());
    const chatBtn = page.locator('#panel [data-open="chats"][data-id]').first();
    await chatBtn.waitFor({ state: 'visible', timeout: 45000 });
    note('chat-button', (await chatBtn.innerText()).trim());
    await L.press(run, chatBtn);
    await page.waitForSelector('.chat-thread', { timeout: 20000 });
    await page.waitForFunction(() => document.querySelectorAll('.chat-messages .chat-message.theirs').length > 0, null, { timeout: 30000 });
    await L.sleep(2200);
    note('welcome', { ...(await geo()), badge: await badge() });
    await L.shot(page, `${DIR}/0-welcome-${kind}.png`);

    const lines = ['刚刚返场那首太好听了！', '你拍的是人海吧？', '下次还一起来吗？'];
    for (const [i, text] of lines.entries()) {
      const before = await geo();
      await page.locator('#chat-text').fill(text);
      await L.press(run, '.chat-composer button[type="submit"]');
      await waitMine(text);
      await L.sleep(450);
      const m = await geo();
      await waitReply(before.theirs);
      await L.sleep(1900); // the ack timer + read + unread refresh
      const r = await geo(), b = await badge();
      note(`send-${i + 1}`, { own: { st: m.st, sh: m.sh, ch: m.ch, gap: m.gap, visible: m.lastMineVisible }, reply: { st: r.st, sh: r.sh, ch: r.ch, gap: r.gap, visible: r.lastTheirsVisible, text: r.lastTheirs, unread: r.unread }, badge: b });
      if (!m.lastMineVisible) fail(`send ${i + 1}: own message not in view`);
      if (!r.lastTheirsVisible) fail(`send ${i + 1}: reply not in view`);
      if (r.unread.length) fail(`send ${i + 1}: reply still unread in the thread`);
      await L.shot(page, `${DIR}/${i + 1}-reply-${kind}.png`);
    }
    await page.locator('.chat-close').first().click();
    await L.sleep(3000);
    const closed = await badge();
    note('badge-after-close', closed);
    if (closed !== '0') fail(`♡ after close shows ${closed}`);
    await L.shot(page, `${DIR}/4-closed-${kind}.png`);
    // the chat list (♡ → 私聊 list) shows nothing unread either
    await page.evaluate(() => { const b = document.createElement('button'); b.dataset.open = 'chats'; b.style.position = 'fixed'; b.style.left = '-9999px'; document.body.append(b); b.click(); b.remove(); });
    await L.sleep(2500);
    const list = await page.evaluate(() => [...document.querySelectorAll('.chat-conversations [data-chat-peer]')].map(b => (b.querySelector('b')?.textContent || b.textContent.trim().slice(0, 10)) + ' unread=' + (b.querySelector('i')?.textContent || 0)));
    note('chat-list', list);
    if (list.some(s => !/unread=0$/.test(s))) fail('chat list still shows unread');
    await L.shot(page, `${DIR}/5-chat-list-${kind}.png`);
    await page.locator('.chat-close').first().click();
    await L.sleep(4000); // one more poll round
    const final = await badge();
    note('badge-final', final);
    if (final !== '0') fail(`♡ at the end shows ${final}`);
  } catch (e) { fail('EXCEPTION ' + e.message.split('\n')[0]); }
  finally {
    const log = run?.log || {};
    Object.assign(out, { api: log.api, foreign: log.foreign, failedRequests: log.failedRequests, consoleErrors: log.consoleErrors, pageErrors: log.pageErrors });
    for (const k of ['api', 'foreign', 'failedRequests', 'consoleErrors', 'pageErrors']) if (out[k]?.length) fail(`${k}: ${JSON.stringify(out[k].slice(0, 4))}`);
    out.ok = !out.failures.length;
    fs.writeFileSync(`${DIR}/chat-${kind}.json`, JSON.stringify(out, null, 1));
    console.log(kind, out.ok ? 'RESULT: PASS' : `RESULT: FAIL ${JSON.stringify(out.failures)}`);
    await browser.close();
    process.exit(out.ok ? 0 : 1);
  }
})();
