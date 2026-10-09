// W10: a declined exchange (same viewpoint), the recap's 去另一个现场 / Livehouse 乐迷社群 targets, 我的现场 (rooms) as a visitor,
// a photo detail of a cast photo, the exchange list empty state, leaving the show, at one viewport.
const L = require('./lib.cjs');
L.watchdog(295);
const vp = process.argv[2] || 'phone';
L.setCorpus(`w10-${vp}`);
(async () => {
  const browser = await L.launch();
  try {
    const run = await L.open(browser, vp);
    const { page } = run; page.__vp = vp;
    await L.ready(run);
    await L.enter(run);
    await L.check(page, 'room-tour', '.frame');
    // 我的现场 as a visitor
    await L.clickHidden(page, { open: 'rooms' });
    await L.sleep(1200);
    await L.grab(page, 'rooms-visitor', '#panel');
    await L.shotScroll(page, 'w10-01-rooms', '#panel', 2);
    await L.check(page, 'rooms-visitor', '#panel');
    // the cast photo detail
    const photos = await page.evaluate(() => window.__SPACE_EVENT_QA__().photos);
    const members = await page.evaluate(() => window.__SPACE_EVENT_QA__().members);
    const man = members.find(m => m.name === '小满')?.id;
    const manCrowd = photos.find(p => p.ownerId === man);
    if (manCrowd) { await L.clickHidden(page, { open: 'photo', id: manCrowd.id }); await L.sleep(1200); await L.grab(page, 'cast-photo-detail', '#panel'); await L.shotScroll(page, 'w10-02-cast-photo', '#panel', 2); await L.check(page, 'cast-photo', '#panel'); }
    // a crowd photo of mine, then offer it for 小满's crowd photo (same viewpoint: 小满 declines)
    await L.closeSheet(page);
    await L.sleep(600);
    await L.js(page, '[data-tour-action="sample:sample-crowd"]');
    await page.waitForSelector('form[data-form="upload"] .photo-review', { timeout: 30000 });
    await L.aiSettled(page); await L.sleep(1500);
    const chosen = await page.evaluate(() => Boolean(document.querySelector('form[data-form="upload"] .moment-chip[aria-pressed="true"]')));
    if (!chosen) await page.locator('form[data-form="upload"] .moment-chip[data-moment-viewpoint="crowd"]').first().evaluate(b => b.click());
    await page.selectOption('form[data-form="upload"] select', 'members').catch(() => {});
    await page.locator('form[data-form="upload"] button[type="submit"]').first().evaluate(b => b.click());
    await L.sleep(3000);
    await L.closeSheet(page);
    if (manCrowd) {
      await L.clickHidden(page, { open: 'photo', id: manCrowd.id });
      await L.sleep(1200);
      await L.grab(page, 'cast-photo-detail-after', '#panel');
      const offer = page.locator('#panel [data-exchange-offer]');
      if (await offer.count()) {
        await offer.first().evaluate(b => b.click());
        await page.waitForSelector('.photo-exchanges:not([hidden]) [data-x-consent]', { timeout: 30000 });
        await L.sleep(1500);
        await L.grab(page, 'x-compose-same-side', '.photo-exchanges');
        await L.shotScroll(page, 'w10-03-x-compose-same', '.photo-exchanges .exchange-body', 3);
        await page.locator('.photo-exchanges [data-x-consent]').first().check({ force: true });
        await page.locator('.photo-exchanges [data-x-send]').first().evaluate(b => b.click());
        await page.waitForFunction(() => /谢绝/.test(document.querySelector('.photo-exchanges')?.textContent || ''), null, { timeout: 40000 }).catch(() => console.log('no decline'));
        await L.sleep(1200);
        await L.grab(page, 'x-declined', '.photo-exchanges');
        await L.shotScroll(page, 'w10-04-x-declined', '.photo-exchanges .exchange-body', 2);
        await page.locator('.photo-exchanges [data-x-back]').first().evaluate(b => b.click()).catch(() => {});
        await L.sleep(1000);
        await L.grab(page, 'x-list-declined', '.photo-exchanges');
        await page.locator('.photo-exchanges [data-x-close]').first().evaluate(b => b.click()).catch(() => {});
        await L.sleep(600);
      } else console.log('no offer button on 小满 photo');
    }
    // recap targets
    await L.clickHidden(page, { open: 'recap' });
    await page.waitForSelector('.panel[data-kind="recap"]', { timeout: 30000 });
    await L.sleep(1500);
    await page.evaluate(() => { const p = document.querySelector('#panel'); p.scrollTop = p.scrollHeight; });
    await L.sleep(400);
    await L.shot(page, 'w10-05-recap-end');
    await L.check(page, 'recap', '#panel');
    await L.js(page, '#panel [data-open="entry"]');
    await L.sleep(1200);
    await L.grab(page, 'recap-other-show', '#panel');
    await L.shotScroll(page, 'w10-06-other-show', '#panel', 2);
    await L.check(page, 'other-show', '#panel');
    // try a code
    const code = page.locator('#panel form input[name="code"], #panel form input[type="text"]');
    if (await code.count()) {
      await code.first().fill('ABCDEFGH1234');
      await page.locator('#panel form button[type="submit"]').first().evaluate(b => b.click()).catch(() => {});
      await L.sleep(2000);
      await L.grab(page, 'other-show-bad-code', '#panel');
      await L.shot(page, 'w10-07-bad-code');
    }
    await L.closeSheet(page);
    await L.clickHidden(page, { open: 'recap' });
    await page.waitForSelector('.panel[data-kind="recap"]', { timeout: 30000 });
    await L.sleep(1200);
    await L.js(page, '#panel [data-open="communities"]');
    await L.sleep(1800);
    await L.grab(page, 'recap-communities', '.music-community');
    await page.evaluate(() => document.querySelector('.music-community [data-group="close"]')?.click());
    await L.sleep(600);
    // leave the show
    await L.js(page, '#join');
    await L.sleep(800);
    await L.js(page, '#panel [data-open="leave"]');
    await L.sleep(700);
    await L.js(page, '#panel [data-confirm="leave"]');
    await L.sleep(3000);
    await L.grab(page, 'after-leave', 'body');
    await L.shot(page, 'w10-08-after-leave');
    await L.clickHidden(page, { open: 'rooms' });
    await L.sleep(1200);
    await L.grab(page, 'rooms-after-leave', '#panel');
    await L.shot(page, 'w10-09-rooms-after-leave');
    await L.log(page, 'w10');
    console.log('errors', JSON.stringify(page.__errors));
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); } finally { L.flush(); await browser.close(); }
})();
