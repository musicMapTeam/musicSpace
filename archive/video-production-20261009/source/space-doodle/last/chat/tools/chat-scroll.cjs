// Private chat stick-to-bottom check: open an example character's thread, send messages in a row, verify each reply is
// visible inside .chat-thread and acknowledged (♡ badge clears); then verify a scrolled-up reader is not yanked down by a reply,
// and that sending while scrolled up brings the visitor's own message (and the reply after it) into view.
// usage: node chat-scroll.cjs <phone|desktop> <baseUrl> <小满|阿遥> <label>
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const path = require('path');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const [, , vp = 'desktop', base = 'http://127.0.0.1:5190/', who = '小满', label = 'dev'] = process.argv;
const OUT = process.env.OUT || '/tmp/space-doodle/shots/chat';
fs.mkdirSync(OUT, { recursive: true });
const VIEWPORTS = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tag = who === '小满' ? 'man' : who === '阿遥' ? 'yao' : 'peer';

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const out = { vp, base, who, label, results: {}, failures: [], shots: [], errors: [] };
  const fail = msg => { out.failures.push(msg); console.log('  !! FAIL', msg); };
  const log = (k, v) => { out.results[k] = v; console.log(k, '=>', typeof v === 'string' ? v : JSON.stringify(v)); };
  try {
    const context = await browser.newContext({ ...VIEWPORTS[vp], locale: 'zh-CN' });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    page.on('pageerror', e => out.errors.push(String(e.message).slice(0, 300)));
    page.on('console', m => { if (m.type() === 'error') out.errors.push('console: ' + m.text().slice(0, 300)); });
    const cdp = await context.newCDPSession(page);
    const click = async loc => { await loc.waitFor({ state: 'visible', timeout: 45000 }); if (vp === 'phone') await loc.tap(); else await loc.click(); };
    const shot = async name => { const f = path.join(OUT, `${label}-${vp}-${tag}-${name}.png`); await sleep(300); await page.screenshot({ path: f }); out.shots.push(f); return f; };
    const badge = () => page.evaluate(() => { const c = document.querySelector('#social-count'); return c && !c.hidden ? c.textContent : '0'; });
    const geo = () => page.evaluate(() => {
      const th = document.querySelector('.chat-thread'), r = th.getBoundingClientRect();
      const box = n => n.getBoundingClientRect();
      const inView = n => { const b = box(n); return b.height > 0 && b.top >= Math.max(0, r.top) - 1 && b.bottom <= Math.min(innerHeight, r.bottom) + 1; };
      const theirs = [...document.querySelectorAll('.chat-messages .chat-message.theirs')], mine = [...document.querySelectorAll('.chat-messages .chat-message.mine')];
      return { st: Math.round(th.scrollTop), sh: th.scrollHeight, ch: th.clientHeight, gap: Math.round(th.scrollHeight - th.scrollTop - th.clientHeight), theirs: theirs.length, mine: mine.length,
        lastTheirsVisible: theirs.length ? inView(theirs.at(-1)) : null, lastMineVisible: mine.length ? inView(mine.at(-1)) : null,
        lastTheirs: theirs.at(-1)?.querySelector('p')?.textContent.slice(0, 22) || '', lastTheirsUnread: theirs.length ? theirs.at(-1).hasAttribute('data-incoming') : null, unreadInThread: [...document.querySelectorAll('.chat-messages [data-incoming]')].map(n => n.querySelector('p').textContent.slice(0, 14)) };
    });
    const scrollThread = async dy => { // a real wheel (desktop) or finger (phone) gesture over the thread; dy>0 scrolls towards older messages
      const r = await page.locator('.chat-thread').boundingBox();
      await cdp.send('Input.synthesizeScrollGesture', { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), yDistance: dy, xDistance: 0, gestureSourceType: vp === 'phone' ? 'touch' : 'mouse', speed: 1600, preventFling: true });
      await sleep(400);
    };
    const waitMine = text => page.waitForFunction(t => [...document.querySelectorAll('.chat-messages .chat-message.mine p')].some(p => p.textContent === t), text, { timeout: 20000 });
    const waitReply = n => page.waitForFunction(k => document.querySelectorAll('.chat-messages .chat-message.theirs').length > k, n, { timeout: 30000 });
    const send = async text => { await page.locator('#chat-text').fill(text); await click(page.locator('.chat-composer button[type="submit"]')); };

    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready' || String(window.__SPACE_BOOT__ || '').startsWith('failed'), null, { timeout: 90000 });
    log('boot', await page.evaluate(() => window.__SPACE_BOOT__));
    await click(page.locator('#join'));
    await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"] button[type="submit"]')?.disabled, null, { timeout: 60000 });
    await click(page.locator('form[data-form="demo-entry"] input[name="consent"]'));
    await click(page.locator('form[data-form="demo-entry"] button[type="submit"]'));
    await page.waitForFunction(() => document.querySelector('.frame')?.dataset.stage === 'room', null, { timeout: 30000 });
    await sleep(1500);
    await click(page.locator('.camera-nav [data-view="person"]'));
    await click(page.locator('#panel button[data-person]', { hasText: who }).first());
    await click(page.locator('#panel [data-social-send]').first());
    const chatBtn = page.locator('#panel [data-open="chats"][data-id]').first();
    await chatBtn.waitFor({ state: 'visible', timeout: 40000 });
    await click(chatBtn);
    await page.waitForFunction(() => /我是示例角色/.test(document.querySelector('.chat-messages')?.innerText || ''), null, { timeout: 20000 });
    await sleep(2000);
    const w = await geo();
    log('welcome', { ...w, badge: await badge() });
    await shot('0-welcome');

    // 1) three messages in a row: the own message and then the reply must be in view, the reply acknowledged.
    const lines = ['刚刚返场那首太好听了！', '你拍的是人海吧？', '下次还一起来吗？'];
    for (const [i, text] of lines.entries()) {
      const before = await geo();
      await send(text);
      await waitMine(text); await sleep(500);
      const m = await geo();
      await waitReply(before.theirs);
      await sleep(1800); // ack timer (350 ms) + read POST + unread refresh
      const r = await geo(), b = await badge();
      log(`send-${i + 1}`, { own: { st: m.st, sh: m.sh, ch: m.ch, gap: m.gap, visible: m.lastMineVisible }, reply: { st: r.st, sh: r.sh, ch: r.ch, gap: r.gap, visible: r.lastTheirsVisible, text: r.lastTheirs, unread: r.unreadInThread }, badge: b });
      if (!m.lastMineVisible) fail(`send ${i + 1}: own message not in view`);
      if (!r.lastTheirsVisible) fail(`send ${i + 1}: reply not in view`);
      if (r.unreadInThread.length) fail(`send ${i + 1}: reply still unread in thread`);
      await shot(`${i + 1}-reply`);
    }

    // 2) scrolled-up reading stays put: send, scroll up to the history once the own message is shown, the reply lands below.
    {
      const before = await geo(), text = '我往上翻翻刚才的聊天。';
      await send(text); await waitMine(text); await sleep(500);
      await scrollThread(10000);
      const up = await geo();
      await waitReply(before.theirs); await sleep(1800);
      const r = await geo(), b = await badge();
      log('scrolled-up', { upBefore: { st: up.st, gap: up.gap }, afterReply: { st: r.st, gap: r.gap, replyVisible: r.lastTheirsVisible, replyUnread: r.lastTheirsUnread, unread: r.unreadInThread }, badge: b });
      if (up.gap < 70) fail('scrolled-up: could not scroll up');
      if (Math.abs(r.st - up.st) > 1) fail(`scrolled-up: reader moved ${up.st} -> ${r.st}`);
      if (r.lastTheirsVisible) fail('scrolled-up: reply pulled into view');
      if (!r.lastTheirsUnread) fail('scrolled-up: reply acknowledged while out of view');
      await shot('4-scrolled-up-after-reply');
      await scrollThread(-10000); await sleep(1800);
      const d = await geo(), b2 = await badge();
      log('scrolled-back-down', { st: d.st, gap: d.gap, replyVisible: d.lastTheirsVisible, unread: d.unreadInThread, badge: b2 });
      if (!d.lastTheirsVisible || d.lastTheirsUnread) fail('scrolled-back-down: reply not read');
    }

    // 3) sending while scrolled up brings the own message, and the reply after it, into view.
    {
      await scrollThread(10000);
      const up = await geo(), text = '再发一句，看看会不会回到底部。';
      await send(text); await waitMine(text); await sleep(500);
      const m = await geo();
      await waitReply(up.theirs); await sleep(1800);
      const r = await geo(), b = await badge();
      log('send-while-up', { upBefore: { st: up.st, gap: up.gap }, own: { st: m.st, gap: m.gap, visible: m.lastMineVisible }, reply: { st: r.st, gap: r.gap, visible: r.lastTheirsVisible, unread: r.unreadInThread }, badge: b });
      if (!m.lastMineVisible) fail('send-while-up: own message not in view');
      if (!r.lastTheirsVisible || r.unreadInThread.length) fail('send-while-up: reply not read');
      await shot('5-send-while-up-reply');
    }

    await page.locator('.chat-close').click();
    await sleep(3000);
    const closed = await badge();
    log('badge-after-close', closed);
    if (closed !== '0') fail(`badge after close ${closed}`);
    await page.evaluate(() => { const b = document.createElement('button'); b.dataset.open = 'chats'; b.style.position = 'fixed'; b.style.left = '-9999px'; document.body.append(b); b.click(); b.remove(); });
    await sleep(2500);
    const marks = await page.evaluate(() => [...document.querySelectorAll('.chat-conversations [data-chat-peer]')].map(b => b.querySelector('b')?.textContent + ' unread=' + (b.querySelector('i')?.textContent || 0)));
    log('chat-list', marks);
    if (marks.some(s => !/unread=0$/.test(s))) fail('chat list still shows unread');
    await shot('6-chat-list');
    await page.locator('.chat-close').click();
    await sleep(800);
    log('badge-final', await badge());
    await shot('7-closed');
  } catch (e) { fail('EXCEPTION ' + String(e.message).split('\n')[0]); }
  log('errors', out.errors);
  out.ok = !out.failures.length;
  fs.writeFileSync(path.join(OUT, `${label}-${vp}-${tag}.json`), JSON.stringify(out, null, 2));
  console.log(out.ok ? 'RESULT: PASS' : `RESULT: FAIL (${out.failures.length})`);
  await browser.close();
})();
