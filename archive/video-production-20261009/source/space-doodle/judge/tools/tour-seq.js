// Item 9: the showcase owner's sequence without any reload: 4/4 -> 看看同场的人 -> close -> 回看这一晚 -> close (+ waits).
const L = require('./lib.js');
const vp = process.argv[2] || 'phone';
(async () => {
  const browser = await L.launch();
  const run = await L.open(browser, vp, { label: `tour-seq-${vp}` });
  const { page } = run;
  const say = (k, v) => console.log(k, '=>', typeof v === 'string' ? v : JSON.stringify(v));
  const t = async sel => { const l = page.locator(sel).first(); await l.waitFor({ state: 'visible', timeout: 45000 }); if (vp === 'phone') await l.tap(); else await l.click(); };
  let loads = 0; page.on('load', () => { loads++; });
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
    await L.sleep(1500);
    say('1 after exchange', await L.tourText(page));
    await t('[data-tour-action="open:people"]');
    await L.sleep(8000);
    await t('#panel-close');
    await L.sleep(1500);
    say('2 after people panel', await L.tourText(page));
    await t('[data-tour-action="open:recap"]');
    await page.waitForSelector('.panel[data-kind="recap"]:not([hidden])', { timeout: 15000 });
    await L.sleep(10000);
    await t('#panel-close');
    await L.sleep(1500);
    say('3 after recap', await L.tourText(page));
    await L.sleep(20000);
    say('4 +20 s idle', await L.tourText(page));
    say('page loads', loads);
  } catch (e) { say('FAILED', e.message.split('\n')[0]); }
  await browser.close();
})();
