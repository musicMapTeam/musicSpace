// Item 9: the route card after a reload. Do the route to 交换已接受, reload, then (a) read the card + localStorage, (b) follow the card's
// 「回到照片墙」 and look at what the wall offers, (c) open the exchange list from the ··· menu and read the card again.
const L = require('./lib.js');
const vp = process.argv[2] || 'desktop';
const label = process.argv[3] || `tour-reload-${vp}`;

async function routeToAccepted(page, vp) {
  const t = async sel => { const l = page.locator(sel).first(); await l.waitFor({ state: 'visible', timeout: 45000 }); if (vp === 'phone') await l.tap(); else await l.click(); };
  await t('#join');
  await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"] button[type="submit"]')?.disabled, null, { timeout: 60000 });
  await page.check('form[data-form="demo-entry"] input[name="consent"]');
  await t('form[data-form="demo-entry"] button[type="submit"]');
  await t('[data-tour-action="sample:sample-crowd"]');
  await page.waitForFunction(() => /^(sure|unsure|off)/.test(document.querySelector('form[data-form="upload"] [data-ai-line]')?.getAttribute('data-ai-key') || ''), null, { timeout: 90000 }).catch(() => {});
  await t('form[data-form="upload"] button[type="submit"]');
  await t('[data-moment-badge] [data-exchange-offer]');
  await page.locator('.photo-exchanges [data-x-consent]').check();
  await page.waitForFunction(() => !document.querySelector('.photo-exchanges [data-x-send]')?.disabled, null, { timeout: 20000 });
  await t('.photo-exchanges [data-x-send]');
  await page.waitForFunction(() => /交换已接受/.test(document.querySelector('.photo-exchanges .exchange-status')?.textContent || ''), null, { timeout: 60000 });
}

(async () => {
  const browser = await L.launch();
  const run = await L.open(browser, vp, { label });
  const { page } = run;
  const log = [];
  const say = (k, v) => { log.push([k, v]); console.log(k, '=>', typeof v === 'string' ? v : JSON.stringify(v)); };
  try {
    await L.boot(page, L.baseUrl('root'));
    await routeToAccepted(page, vp);
    await page.click('.photo-exchanges [data-x-close]');
    await L.sleep(1200);
    say('before reload', await L.tourText(page));
    say('tour storage', await page.evaluate(() => localStorage.getItem('music-space-tour:v1')));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
    await L.sleep(4000);
    say('after reload', await L.tourText(page));
    say('tour storage after reload', await page.evaluate(() => localStorage.getItem('music-space-tour:v1')));
    // (b) follow the regressed card
    const back = page.locator('[data-tour-action="open:wall"]');
    if (await back.isVisible().catch(() => false)) {
      say('card button', (await back.innerText()).trim());
      await back.click();
      await page.waitForSelector('#panel:not([hidden])', { timeout: 15000 });
      await L.sleep(2500);
      const wall = await page.evaluate(() => {
        const offers = [...document.querySelectorAll('#panel [data-exchange-offer]')].map(b => b.innerText.trim());
        const badge = document.querySelector('#panel [data-moment-badge]')?.innerText.trim().replace(/\s+/g, ' ').slice(0, 200);
        return { offers, badge };
      });
      say('wall after following the card', wall);
      await L.shot(run, 'wall-after-reload');
      // does tapping the offer again start a second exchange?
      const offer = page.locator('[data-moment-badge] [data-exchange-offer]').first();
      if (await offer.isVisible().catch(() => false)) {
        await offer.click();
        await L.sleep(2500);
        const xs = await page.evaluate(() => ({ open: !document.querySelector('.photo-exchanges')?.hidden, status: document.querySelector('.photo-exchanges .exchange-status')?.textContent.trim(), title: document.querySelector('.photo-exchanges .exchange-body h3')?.textContent.trim(), send: document.querySelector('.photo-exchanges [data-x-send]') ? document.querySelector('.photo-exchanges [data-x-send]').innerText.trim() : null, text: document.querySelector('.photo-exchanges .exchange-body')?.innerText.trim().replace(/\s+/g, ' ').slice(0, 260) }));
        say('offer tapped again', xs);
        await L.shot(run, 'offer-again-after-reload');
        await page.click('.photo-exchanges [data-x-close]').catch(() => {});
        await L.sleep(800);
      }
      if (!(await page.evaluate(() => document.querySelector('#panel')?.hidden))) { await page.click('#panel-close').catch(() => {}); await L.sleep(1000); }
      say('after wall + exchange panel', await L.tourText(page));
    }
  } catch (e) { say('FAILED', e.message.split('\n')[0]); await L.shot(run, 'failure').catch(() => {}); }
  say('console', run.consoleMsgs);
  say('pageErrors', run.pageErrors);
  L.writeJson(`${label}.json`, log);
  await browser.close();
})();
