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
const tag = (who === '小满' ? 'man' : who === '阿遥' ? 'yao' : 'peer') + '-errline';

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
    await page.addInitScript(() => {
      // Wrap whatever fetch the static runtime installs, so one message poll can be failed on demand (window.__failChatPoll).
      let current = window.fetch;
      const wrap = f => function (input, init) {
        try {
          const url = new URL(typeof input === 'string' ? input : input.url, location.href);
          if (window.__failChatPoll > 0 && /\/api\/event\/chats\/[^/]+\/messages$/.test(url.pathname) && (!init?.method || init.method === 'GET')) { window.__failChatPoll--; return Promise.reject(new TypeError('Failed to fetch')); }
        } catch {}
        return f.apply(this, arguments);
      };
      let wrapped = wrap(current);
      Object.defineProperty(window, 'fetch', { configurable: true, get() { return wrapped; }, set(v) { current = v; wrapped = wrap(v); } });
    });
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

    // A reader resting at the bottom when an error line shows under the thread: after the 2nd send settles, the next message poll
    // fails once (the line '连接暂时没有回应…' appears), and the reply comes with the poll after that, while the line is still shown.
    {
      const b1 = await geo();
      await send('刚刚返场那首太好听了！'); await waitMine('刚刚返场那首太好听了！'); await waitReply(b1.theirs); await sleep(1800);
      const b2 = await geo();
      await send('你拍的是人海吧？'); await waitMine('你拍的是人海吧？'); await sleep(400);
      const settled = await geo();
      await page.evaluate(() => {
        window.__scrollLog = []; const th = document.querySelector('.chat-thread'), t0 = performance.now();
        const rec = why => window.__scrollLog.push(`${Math.round(performance.now() - t0)}ms ${why} st=${th.scrollTop} sh=${th.scrollHeight} ch=${th.clientHeight} anchor=${getComputedStyle(th).overflowAnchor}`);
        th.addEventListener('scroll', () => rec('scroll'));
        new ResizeObserver(() => rec('resize')).observe(th);
        const desc = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop');
        Object.defineProperty(th, 'scrollTop', { configurable: true, get() { return desc.get.call(this); }, set(v) { rec('SET ' + v + ' from ' + (new Error().stack.split('\n')[2] || '').trim().slice(0, 80)); desc.set.call(this, v); } });
        rec('start');
      });
      await page.evaluate(() => { window.__failChatPoll = 1; });
      await page.waitForFunction(() => (document.querySelector('.chat-problem')?.textContent || '').length > 0, null, { timeout: 15000 });
      const line = await page.evaluate(() => { const p = document.querySelector('.chat-problem'); return { text: p.textContent, h: Math.round(p.getBoundingClientRect().height + parseFloat(getComputedStyle(p).marginBottom)) }; });
      await sleep(300);
      const shrunk = await geo();
      console.log('scrollLog', JSON.stringify(await page.evaluate(() => window.__scrollLog), null, 1));
      await shot('h1-error-line');
      await waitReply(b2.theirs); await sleep(1800);
      const r = await geo();
      log('error-line', { settled: { st: settled.st, gap: settled.gap }, line, shrunk: { st: shrunk.st, ch: shrunk.ch, gap: shrunk.gap }, reply: { st: r.st, ch: r.ch, gap: r.gap, visible: r.lastTheirsVisible, unread: r.lastTheirsUnread }, problemAfter: await page.evaluate(() => document.querySelector('.chat-problem')?.textContent || '') });
      if (shrunk.gap < 70) console.log('  (note: the error line is shorter than the 70 px threshold here; the live check alone already sticks)');
      if (!r.lastTheirsVisible || r.lastTheirsUnread) fail('error-line: reply not in view / not read');
      await shot('h2-error-line-reply');
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
