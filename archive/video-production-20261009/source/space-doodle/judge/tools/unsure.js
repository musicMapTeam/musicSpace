// Item 2: 「舞台 · 示例照片」 must give the honest 「不确定，请选择」 (no chip chosen for the person), then the person's choice saves and pairs.
const L = require('./lib.js');
const vp = process.argv[2] || 'phone';
const label = `unsure-${vp}`;
(async () => {
  const browser = await L.launch();
  const run = await L.open(browser, vp, { label });
  const { page } = run;
  const out = {};
  const say = (k, v) => { out[k] = v; console.log(k, '=>', typeof v === 'string' ? v : JSON.stringify(v)); };
  const t = async (sel, how = 'click') => { const l = page.locator(sel).first(); await l.waitFor({ state: 'visible', timeout: 45000 }); if (vp === 'phone') await l.tap(); else await l.click(); };
  try {
    await L.boot(page, L.baseUrl('root'));
    await t('#join');
    await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"] button[type="submit"]')?.disabled, null, { timeout: 60000 });
    await page.check('form[data-form="demo-entry"] input[name="consent"]');
    await t('form[data-form="demo-entry"] button[type="submit"]');
    await t('[data-tour-action="sample:sample-stage"]');
    const tAt = Date.now();
    const key = await page.waitForFunction(() => { const l = document.querySelector('form[data-form="upload"] [data-ai-line]'); const k = l?.getAttribute('data-ai-key') || ''; return /^(sure|unsure|off)/.test(k) ? k : false; }, null, { timeout: 90000 }).then(h => h.jsonValue()).catch(() => 'timeout');
    say('ai key', `${key} after ${Date.now() - tAt} ms`);
    say('ai line text', await page.evaluate(() => document.querySelector('form[data-form="upload"] [data-ai-line]')?.textContent.trim()));
    say('chips', await page.evaluate(() => [...document.querySelectorAll('form[data-form="upload"] .moment-chip')].map(c => `${c.dataset.momentViewpoint}:${c.getAttribute('aria-pressed')}${c.classList.contains('is-suggested') ? '(suggested)' : ''}${c.classList.contains('is-ai') ? '(ai)' : ''}`).join(' ')));
    await page.evaluate(() => document.querySelector('form[data-form="upload"] [data-ai-line]')?.scrollIntoView({ block: 'center' }));
    await L.shot(run, 'unsure');
    // try to save without choosing: the form must nudge, not save
    await t('form[data-form="upload"] button[type="submit"]');
    await L.sleep(1200);
    say('after save without choice', await page.evaluate(() => ({ panelKind: document.querySelector('#panel')?.dataset.kind, nudge: document.querySelector('form[data-form="upload"] .is-nudged, form[data-form="upload"] [data-nudge], form[data-form="upload"] .moment-nudge')?.textContent?.trim() || null, focused: document.activeElement?.className || document.activeElement?.tagName, toast: document.querySelector('#toast')?.textContent.trim() })));
    await L.shot(run, 'unsure-nudge');
    // choose stage (what the photo is)
    await t('form[data-form="upload"] .moment-chip[data-moment-viewpoint="stage"]');
    await L.sleep(400);
    say('chips after choice', await page.evaluate(() => [...document.querySelectorAll('form[data-form="upload"] .moment-chip')].map(c => `${c.dataset.momentViewpoint}:${c.getAttribute('aria-pressed')}`).join(' ')));
    say('ai line after choice', await page.evaluate(() => document.querySelector('form[data-form="upload"] [data-ai-line]')?.textContent.trim()));
    await t('form[data-form="upload"] button[type="submit"]');
    const offer = page.locator('[data-moment-badge] [data-exchange-offer]').first();
    const ok = await offer.waitFor({ state: 'visible', timeout: 30000 }).then(() => true).catch(() => false);
    say('wall offer visible', ok);
    if (ok) {
      say('badge', await page.evaluate(() => document.querySelector('#panel [data-moment-badge]')?.innerText.trim().replace(/\s+/g, ' ')));
      say('offer aria', await offer.getAttribute('aria-label'));
      await page.evaluate(() => document.querySelector('#panel [data-moment-badge]')?.scrollIntoView({ block: 'center' }));
      await L.shot(run, 'unsure-wall');
    }
  } catch (e) { say('FAILED', e.message.split('\n')[0]); await L.shot(run, 'failure').catch(() => {}); }
  say('console', run.consoleMsgs); say('pageErrors', run.pageErrors);
  const net = L.summarizeNet(run); say('net', { total: net.total, api: net.api.length, external: net.external.length, bad: net.bad.map(r => `${r.status} ${r.url}`) });
  L.writeJson(`${label}.json`, out);
  await browser.close();
})();
