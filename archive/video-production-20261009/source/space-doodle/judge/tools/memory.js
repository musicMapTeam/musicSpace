// Recap -> 保存我的纪念卡 -> PNG download on the production build (after the judge route).
const L = require('./lib.js');
const fs = require('fs');
const vp = process.argv[2] || 'phone';
(async () => {
  const browser = await L.launch();
  const run = await L.open(browser, vp, { label: `memory-${vp}` });
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
    await t('.photo-exchanges [data-x-close]');
    await L.sleep(1000);
    await t('[data-tour-action="open:recap"]');
    await page.waitForSelector('.panel[data-kind="recap"]:not([hidden])', { timeout: 15000 });
    await L.sleep(2500);
    await t('.panel[data-kind="recap"] [data-open="memory-card"]');
    await page.waitForSelector('form[data-form="memory-card"]', { timeout: 20000 });
    await page.waitForFunction(() => document.querySelectorAll('form[data-form="memory-card"] .memory-photo-options img').length >= 1, null, { timeout: 20000 }).catch(() => say('no photo options', ''));
    await L.sleep(800);
    say('photo options', await page.evaluate(() => document.querySelectorAll('form[data-form="memory-card"] input[name="memory-photo"]').length));
    await page.locator('form[data-form="memory-card"] input[name="memory-photo"]').first().check();
    await page.locator('form[data-form="memory-card"] input[name="memory-avatar"]').check().catch(e => say('avatar', e.message.split('\n')[0]));
    await page.locator('form[data-form="memory-card"] input[name="memory-confirm"]').check();
    await L.sleep(400);
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }).catch(() => null),
      page.click('form[data-form="memory-card"] button[type="submit"]'),
    ]);
    if (download) {
      const file = `${L.OUT}/memory-${vp}-card.png`;
      await download.saveAs(file);
      const buf = fs.readFileSync(file);
      say('download', { name: download.suggestedFilename(), bytes: buf.length, png: buf.slice(1, 4).toString(), w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) });
    } else say('download', 'NONE in 30 s');
    await page.waitForSelector('.memory-result img', { timeout: 20000 }).then(() => say('result img', 'shown')).catch(() => say('result img', 'not shown'));
    await L.sleep(800);
    await L.shot(run, 'result');
    say('panel text', await page.evaluate(() => document.querySelector('#panel-body')?.innerText.trim().replace(/\s+/g, ' ').slice(0, 220)));
  } catch (e) { say('FAILED', e.message.split('\n')[0]); await L.shot(run, 'failure').catch(() => {}); }
  say('console', run.consoleMsgs.map(c => `${c.type}: ${c.text.slice(0, 200)}`)); say('pageErrors', run.pageErrors);
  const net = L.summarizeNet(run); say('net', { api: net.api.length, external: net.external.length, bad: net.bad.map(r => `${r.status} ${r.url}`) });
  await browser.close();
})();
