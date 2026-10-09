// Item 6: a second tab of the same site gets the read-only notice and cannot change the first tab's world.
const L = require('./lib.js');
const vp = process.argv[2] || 'phone';
const label = `second-tab-${vp}`;
(async () => {
  const browser = await L.launch();
  const run = await L.open(browser, vp, { label });
  const { page, context } = run;
  const say = (k, v) => console.log(k, '=>', typeof v === 'string' ? v : JSON.stringify(v));
  try {
    await L.boot(page, L.baseUrl('root'));
    say('tab A', await page.evaluate(() => ({ writable: window.__SPACE_STATIC__?.writable, lock: window.__SPACE_STATIC__?.lockReason })));
    const b = await context.newPage();
    const runB = { ...run, page: b, label: `${label}-B` };
    const t0 = Date.now();
    await b.goto(L.baseUrl('root'), { waitUntil: 'domcontentloaded' });
    await b.waitForFunction(() => window.__SPACE_BOOT__ === 'ready' || String(window.__SPACE_BOOT__ || '').startsWith('failed'), null, { timeout: 90000 });
    say('tab B boot', `${await b.evaluate(() => window.__SPACE_BOOT__)} in ${Date.now() - t0} ms`);
    say('tab B static', await b.evaluate(() => ({ writable: window.__SPACE_STATIC__?.writable, lock: window.__SPACE_STATIC__?.lockReason, roomCode: window.__SPACE_STATIC__?.roomCode })));
    await L.sleep(1500);
    const banner = await b.evaluate(() => {
      const hits = [...document.querySelectorAll('body *')].filter(n => n.children.length < 4 && /另一个标签页/.test(n.textContent || '') && n.getClientRects().length);
      const el = hits[0];
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + 20, r.top + r.height / 2);
      return { text: el.textContent.trim().slice(0, 80), tag: el.tagName, y: Math.round(r.top), h: Math.round(r.height), onTop: !!top && (el.contains(top) || top.contains(el)) };
    });
    say('read-only banner', banner);
    await L.shot(runB, 'banner');
    // what does the entry button do in the read-only tab?
    const join = b.locator('#join');
    if (await join.isVisible().catch(() => false)) {
      say('join label in B', (await join.innerText()).trim());
      await join.click();
      await L.sleep(1500);
      const form = await b.evaluate(() => { const f = document.querySelector('form[data-form="demo-entry"]'); const s = f?.querySelector('button[type="submit"]'); return f ? { submitDisabled: s?.disabled, status: f.querySelector('.demo-entry-status')?.textContent.trim(), text: f.innerText.slice(0, 160).replace(/\s+/g, ' ') } : document.querySelector('#panel-body')?.innerText.slice(0, 200).replace(/\s+/g, ' '); });
      say('entry in B', form);
      await L.shot(runB, 'entry');
      const f = b.locator('form[data-form="demo-entry"]');
      if (await f.isVisible().catch(() => false)) {
        const enabled = await f.locator('button[type="submit"]').isEnabled();
        if (enabled) {
          await f.locator('input[name="consent"]').check();
          await f.locator('button[type="submit"]').click();
          await L.sleep(2500);
          say('after submit in B', await b.evaluate(() => ({ stage: document.querySelector('.frame')?.dataset.stage, toast: document.querySelector('#toast')?.textContent.trim(), problem: document.querySelector('#panel-body .error, #panel-body [role=alert], #panel-body .problem')?.textContent?.trim(), panel: document.querySelector('#panel-body')?.innerText.slice(0, 200).replace(/\s+/g, ' ') })));
          await L.shot(runB, 'after-submit');
        }
      }
    }
    say('console', run.consoleMsgs); say('pageErrors', run.pageErrors);
  } catch (e) { say('FAILED', e.message.split('\n')[0]); }
  await browser.close();
})();
