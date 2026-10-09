// After a reload the wall offers the already-accepted pair again: send it and see what the runtime and the UI do.
const L = require('./lib.js');
const vp = process.argv[2] || 'desktop';
const label = `dup-send-${vp}`;
(async () => {
  const browser = await L.launch();
  const run = await L.open(browser, vp, { label });
  const { page } = run;
  const say = (k, v) => console.log(k, '=>', typeof v === 'string' ? v : JSON.stringify(v));
  const t = async sel => { const l = page.locator(sel).first(); await l.waitFor({ state: 'visible', timeout: 45000 }); await l.click(); };
  try {
    await L.boot(page, L.baseUrl('root'));
    await t('#join');
    await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"] button[type="submit"]')?.disabled, null, { timeout: 60000 });
    await page.check('form[data-form="demo-entry"] input[name="consent"]');
    await t('form[data-form="demo-entry"] button[type="submit"]');
    await t('[data-tour-action="sample:sample-crowd"]');
    await page.waitForFunction(() => /^(sure|unsure|off)/.test(document.querySelector('form[data-form="upload"] [data-ai-line]')?.getAttribute('data-ai-key') || ''), null, { timeout: 90000 }).catch(() => {});
    await t('form[data-form="upload"] button[type="submit"]');
    await t('[data-moment-badge] [data-exchange-offer]');
    await page.locator('.photo-exchanges [data-x-consent]').check();
    await t('.photo-exchanges [data-x-send]:not([disabled])');
    await page.waitForFunction(() => /交换已接受/.test(document.querySelector('.photo-exchanges .exchange-status')?.textContent || ''), null, { timeout: 60000 });
    await page.click('.photo-exchanges [data-x-close]');
    await L.sleep(800);
    // wall before reload
    await page.click('.camera-nav [data-view="photos"]').catch(() => {});
    await L.sleep(1500);
    if (await page.evaluate(() => document.querySelector('#panel')?.hidden)) { await page.evaluate(() => document.querySelector('[data-open="wall"]')?.click()); }
    await L.sleep(1500);
    say('wall before reload', await page.evaluate(() => ({ offers: [...document.querySelectorAll('#panel [data-exchange-offer]')].length, done: [...document.querySelectorAll('#panel [data-moment-exchanged]')].map(e => e.textContent.trim()), panelKind: document.querySelector('#panel')?.dataset.kind })));
    await L.shot(run, 'wall-before-reload');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
    await L.sleep(3000);
    await t('[data-tour-action="open:wall"]');
    await L.sleep(2500);
    say('wall after reload', await page.evaluate(() => ({ offers: [...document.querySelectorAll('#panel [data-exchange-offer]')].length, done: [...document.querySelectorAll('#panel [data-moment-exchanged]')].map(e => e.textContent.trim()) })));
    await L.shot(run, 'wall-after-reload');
    await t('[data-moment-badge] [data-exchange-offer]');
    await page.locator('.photo-exchanges [data-x-consent]').check();
    await t('.photo-exchanges [data-x-send]:not([disabled])');
    const outcome = await page.waitForFunction(() => {
      const s = document.querySelector('.photo-exchanges .exchange-status')?.textContent || '';
      const p = document.querySelector('.photo-exchanges .exchange-problem')?.textContent || '';
      const toast = document.querySelector('#toast')?.textContent || '';
      return (/交换已接受|等待本人回应|谢绝/.test(s) || p.trim()) ? { status: s.trim(), problem: p.trim(), toast: toast.trim() } : false;
    }, null, { timeout: 30000 }).then(h => h.jsonValue()).catch(() => 'no outcome in 30 s');
    say('second send outcome', outcome);
    await L.sleep(5000);
    say('after 5 s', await page.evaluate(() => ({ status: document.querySelector('.photo-exchanges .exchange-status')?.textContent.trim(), problem: document.querySelector('.photo-exchanges .exchange-problem')?.textContent.trim() })));
    await L.shot(run, 'second-send');
    // the exchange list
    const back = page.locator('.photo-exchanges [data-x-back]');
    if (await back.isVisible().catch(() => false)) { await back.click(); await L.sleep(2000); }
    say('exchange list', await page.evaluate(() => document.querySelector('.photo-exchanges .exchange-body')?.innerText.trim().replace(/\s+/g, ' ').slice(0, 400)));
    await L.shot(run, 'exchange-list');
  } catch (e) { say('FAILED', e.message.split('\n')[0]); await L.shot(run, 'failure').catch(() => {}); }
  say('console', run.consoleMsgs); say('pageErrors', run.pageErrors);
  await browser.close();
})();
