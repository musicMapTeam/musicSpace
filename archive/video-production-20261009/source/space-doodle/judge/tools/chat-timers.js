// Confirm the chat thread poll (setTimeout 4000) is re-armed before it can fire while a thread is open.
const L = require('./lib.js');
(async () => {
  const browser = await L.launch();
  const run = await L.open(browser, 'desktop', { label: 'chat-timers' });
  const { page, context } = run;
  await context.addInitScript(() => {
    const st = window.setTimeout, ct = window.clearTimeout;
    const live = new Map(); window.__T4 = { created: 0, cleared: 0, fired: 0, log: [] };
    window.setTimeout = function (fn, ms, ...rest) {
      if (ms === 4000) {
        window.__T4.created++;
        let id;
        const wrapped = function () { live.delete(id); window.__T4.fired++; window.__T4.log.push(['fired', Math.round(performance.now())]); return typeof fn === 'function' ? fn.apply(this, arguments) : undefined; };
        id = st.call(window, wrapped, ms, ...rest); live.set(id, performance.now()); return id;
      }
      return st.call(window, fn, ms, ...rest);
    };
    window.clearTimeout = function (id) { if (live.has(id)) { window.__T4.cleared++; live.delete(id); } return ct.call(window, id); };
  });
  const t = async sel => { const l = page.locator(sel).first(); await l.waitFor({ state: 'visible', timeout: 45000 }); await l.click(); };
  await L.boot(page, L.baseUrl('root'));
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
  const before = await page.evaluate(() => ({ ...window.__T4, log: undefined }));
  await page.locator('#chat-text').fill('测试一下');
  await page.click('.chat-composer button[type="submit"]');
  await L.sleep(20000);
  const after = await page.evaluate(() => ({ ...window.__T4, log: undefined }));
  const shown = await page.evaluate(() => /今晚的返场太好听了/.test(document.querySelector('.chat-messages')?.innerText || ''));
  const list = await page.evaluate(() => JSON.stringify(document.querySelector('.chat-conversations')?.textContent || '').slice(0, 120));
  console.log(JSON.stringify({ before, after, in20s: { created: after.created - before.created, cleared: after.cleared - before.cleared, fired: after.fired - before.fired }, replyShownInThread: shown, hiddenListText: list }));
  await browser.close();
})();
