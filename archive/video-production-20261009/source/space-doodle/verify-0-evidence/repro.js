// Independent reproduction: does the example character's private-chat reply appear in the OPEN thread?
// usage: node repro.js <url> <phone|desktop> <label> [fix=none|app|panel]
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const OUT = '/tmp/space-doodle/verify-0/shots';
fs.mkdirSync(OUT, { recursive: true });
const [url, vp = 'desktop', label = 'run', fix = 'none'] = process.argv.slice(2);
const VP = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const t0 = Date.now();
const say = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1).padStart(6)}s]`, ...a);

const INIT = () => {
  const T = (window.__T = { created: 0, cleared: 0, fired: 0, clearStacks: {}, createStacks: {}, live: new Map(), events: [] });
  const oSet = window.setTimeout, oClear = window.clearTimeout;
  const top = () => (new Error().stack || '').split('\n').slice(2, 10).map(s => s.trim().replace(/https?:\/\/[^/]+/, '').replace(/\?[^:)]*/, '')).join(' < ');
  window.setTimeout = function (fn, ms, ...args) {
    if (ms === 4000 && typeof fn === 'function') {
      let id;
      const name = fn.name || '(anon)';
      const wrapped = function () { if (T.live.has(id)) { T.fired++; T.live.delete(id); T.events.push(['fired', Math.round(performance.now()), name]); } return fn.apply(this, arguments); };
      id = oSet.call(this, wrapped, ms, ...args);
      T.created++; T.live.set(id, name);
      const st = top(); T.createStacks[st] = (T.createStacks[st] || 0) + 1;
      return id;
    }
    return oSet.call(this, fn, ms, ...args);
  };
  window.clearTimeout = function (id) {
    if (T.live.has(id)) { T.cleared++; T.live.delete(id); const st = top(); T.clearStacks[st] = (T.clearStacks[st] || 0) + 1; }
    return oClear.call(this, id);
  };
  let current = window.fetch;
  const F = (window.__F = []);
  const wrap = f => {
    if (typeof f !== 'function' || f.__w) return f;
    const w = function (input, init) {
      try { const u = typeof input === 'string' ? input : input?.url; const p = new URL(u, location.href).pathname; if (/\/api\/event\//.test(p)) F.push([Math.round(performance.now()), init?.method || 'GET', p.replace(/^.*\/api\/event/, '')]); } catch {}
      return f.apply(this, arguments);
    };
    w.__w = true; return w;
  };
  Object.defineProperty(window, 'fetch', { configurable: true, enumerable: true, get() { return current; }, set(v) { current = wrap(v); } });
};

(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const context = await browser.newContext({ ...VP[vp], locale: 'zh-CN' });
  await context.addInitScript(INIT);
  const errors = [];
  if (fix !== 'none') {
    // Test a candidate fix WITHOUT touching the repo: rewrite the served module in the browser only (dev server serves modules one by one).
    const target = fix.startsWith('app') ? /\/app\.js(\?|$)/ : /\/chat-panel\.js(\?|$)/;
    await context.route(target, async route => {
      const res = await route.fetch();
      let body = await res.text();
      const before = body;
      if (fix === 'app') body = body.replace('await chatPanel?.refresh();', "if(document.querySelector('.private-chat')?.hidden!==false)await chatPanel?.refresh();");
      else if (fix === 'app2') body = body.replace('await chatPanel?.refresh();', 'if(!chatPanel?.getState?.()?.current)await chatPanel?.refresh();');
      else body = body.replace('refresh:()=>opened&&expandedList?Promise.resolve():client.list().catch(()=>{})', 'refresh:()=>opened?refresh():client.list().catch(()=>{})');
      console.log('FIX', fix, 'applied to', route.request().url(), body !== before);
      await route.fulfill({ response: res, body });
    });
  }
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.on('pageerror', e => errors.push('pageerror: ' + String(e.message).slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
  const shot = async name => { const f = `${OUT}/${label}-${name}.png`; await page.screenshot({ path: f }); say('shot', f); };
  const thread = () => page.evaluate(() => document.querySelector('.private-chat .chat-messages')?.innerText.replace(/\s+/g, ' ').trim() || '');
  const timers = () => page.evaluate(() => ({ created: __T.created, cleared: __T.cleared, fired: __T.fired }));
  const fetches = since => page.evaluate(s => __F.filter(f => f[0] >= s), since);
  const now = () => page.evaluate(() => Math.round(performance.now()));
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready' || String(window.__SPACE_BOOT__ || '').startsWith('failed'), null, { timeout: 120000 });
    say('boot', await page.evaluate(() => window.__SPACE_BOOT__), await page.evaluate(() => ({ channel: window.__SPACE_STATIC__?.channel, poll: window.__SPACE_EVENT_QA__?.().poll })));
    await page.click('#join');
    await page.waitForFunction(() => { const b = document.querySelector('form[data-form="demo-entry"] button[type="submit"]'); return b && !b.disabled; }, null, { timeout: 90000 });
    await page.check('form[data-form="demo-entry"] input[name="consent"]');
    await page.click('form[data-form="demo-entry"] button[type="submit"]');
    await page.waitForFunction(() => document.querySelector('.frame')?.dataset.stage === 'room', null, { timeout: 60000 });
    say('in room; poll', await page.evaluate(() => window.__SPACE_EVENT_QA__?.().poll));
    await sleep(1500);
    await page.click('.camera-nav [data-view="person"]');
    const man = page.locator('#panel button[data-person]', { hasText: '小满' }).first();
    await man.waitFor({ state: 'visible', timeout: 30000 });
    await man.click();
    const wave = page.locator('#panel [data-social-send]').first();
    await wave.waitFor({ state: 'visible', timeout: 30000 });
    say('wave button:', (await wave.innerText()).trim());
    await wave.click();
    const chatBtn = page.locator('#panel [data-open="chats"][data-id]').first();
    await chatBtn.waitFor({ state: 'visible', timeout: 45000 });
    say('chat button:', (await chatBtn.innerText()).trim());
    await chatBtn.click();
    await page.waitForSelector('.private-chat:not([hidden]) .chat-thread:not([hidden])', { timeout: 20000 });
    await page.waitForFunction(() => /你拍到的是哪一面/.test(document.querySelector('.private-chat .chat-messages')?.innerText || ''), null, { timeout: 30000 });
    say('thread before send:', await thread());
    await sleep(1000);
    const tb = await timers();
    await page.fill('#chat-text', '我拍的是舞台那一面，你呢？');
    const sendAt = await now();
    await page.click('.chat-composer button[type="submit"]');
    say('SENT; 4s timers so far', tb);
    let appearedAt = null;
    for (let i = 1; i <= 40; i++) {
      await sleep(1000);
      const th = await thread();
      if (/今晚的返场太好听了/.test(th) && appearedAt === null) { appearedAt = i; say(`REPLY VISIBLE in open thread at ~${i}s`); }
      if (i % 5 === 0 || (appearedAt === i)) {
        const f = await fetches(sendAt);
        const lists = f.filter(x => x[2] === '/chats').length, threads = f.filter(x => /^\/chats\/[^/]+\/messages/.test(x[2]) && x[1] === 'GET').length, posts = f.filter(x => x[1] === 'POST' && /messages/.test(x[2])).length;
        const listText = await page.evaluate(() => document.querySelector('.private-chat .chat-conversations')?.textContent.replace(/\s+/g, ' ').trim().slice(0, 120));
        say(`+${i}s thread_tail=${JSON.stringify(th.slice(-60))} | fetch since send: GET /chats=${lists} GET thread=${threads} POST msg=${posts} | 4s timers`, await timers(), '| hidden list:', JSON.stringify(listText));
      }
      if (appearedAt !== null && i >= appearedAt + 2) break;
    }
    await shot('after-wait');
    const T = await page.evaluate(() => ({ clearStacks: Object.entries(__T.clearStacks).sort((a, b) => b[1] - a[1]).slice(0, 4), createStacks: Object.entries(__T.createStacks).sort((a, b) => b[1] - a[1]).slice(0, 3), firedEvents: __T.events.slice(-8) }));
    console.log('TOP clearTimeout(4s) callers:'); for (const [s, n] of T.clearStacks) console.log('  x' + n, s);
    console.log('TOP setTimeout(4s) callers:'); for (const [s, n] of T.createStacks) console.log('  x' + n, s);
    console.log('fired events:', JSON.stringify(T.firedEvents));
    const f = await fetches(sendAt);
    console.log('fetch timeline since send (ms rel):', JSON.stringify(f.map(x => [x[0] - sendAt, x[1], x[2].replace(/[0-9a-f-]{36}/g, ':id')])).slice(0, 1500));
    if (appearedAt === null) {
      say('reply NOT shown in open thread after 40 s; going back to list and reopening');
      await page.click('.chat-back');
      await sleep(1500);
      say('list:', await page.evaluate(() => document.querySelector('.private-chat .chat-conversations')?.innerText.replace(/\s+/g, ' ').trim().slice(0, 200)));
      await page.locator('.private-chat .chat-conversations [data-chat-peer]').first().click();
      await sleep(2500);
      say('thread after reopen:', await thread());
      await shot('after-reopen');
    }
    say('RESULT', JSON.stringify({ label, vp, url, fix, replyVisibleInOpenThreadAfterSeconds: appearedAt }));
  } catch (e) {
    say('FAILED', e.message.split('\n')[0]);
    await shot('failed').catch(() => {});
  }
  if (errors.length) console.log('errors:', errors.slice(0, 8));
  await browser.close();
})();
