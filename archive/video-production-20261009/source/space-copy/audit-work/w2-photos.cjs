// W2: upload (empty, own photo unsure, one-tap time, stage sample, crowd sample sure), save, wall, photo detail, tour steps 2-4,
// exchange compose/sent/accepted/list/revoke-confirm, recap, memory card + PNG.
const L = require('./lib.cjs');
const fs = require('fs');
L.watchdog(290);
const vp = process.argv[2] || 'phone';
L.setCorpus(`w2-${vp}`);
const tourGrab = async (page, label) => { await L.grab(page, label, '.demo-tour'); await L.shot(page, `w2-${label}`); };
(async () => {
  const browser = await L.launch();
  try {
    const run = await L.open(browser, vp);
    const { page } = run; page.__vp = vp;
    await L.ready(run);
    await L.enter(run);
    // empty upload form via the tour's own-photo button
    await L.js(page, '[data-tour-action="open:upload"]');
    await page.waitForSelector('form[data-form="upload"]', { timeout: 20000 });
    await L.sleep(900);
    await L.grab(page, 'upload-empty', '#panel');
    await L.shotScroll(page, 'w2-01-upload-empty', '#panel', 2);
    await L.check(page, 'upload-empty', '#panel');
    // own photo without EXIF (a plain PNG): the AI should be unsure, the time unknown
    const png = fs.readFileSync('/tmp/space-copy/audit-work/plain.png');
    await page.setInputFiles('form[data-form="upload"] input[type="file"]', { name: 'mine.png', mimeType: 'image/png', buffer: png });
    await page.waitForSelector('form[data-form="upload"] .photo-review', { timeout: 30000 });
    await L.aiSettled(page);
    await L.sleep(2500);
    await L.grab(page, 'upload-own', '#panel');
    await L.shotScroll(page, 'w2-02-upload-own', '#panel', 3);
    await L.check(page, 'upload-own', '#panel');
    const demoBtn = page.locator('form[data-form="upload"] [data-demo-time]');
    if (await demoBtn.count()) {
      await demoBtn.first().evaluate(b => b.click()); await L.sleep(600);
      await L.grab(page, 'upload-own-demo-time', 'form[data-form="upload"]');
      await page.evaluate(() => document.querySelector('form[data-form="upload"] [data-demo-time]')?.scrollIntoView({ block: 'center' }));
      await L.shot(page, 'w2-03-upload-time-set');
      await demoBtn.first().evaluate(b => b.click()); await L.sleep(400);
    } else console.log('no demo-time button');
    // edit the time: an off-night time and an impossible time
    await page.locator('form[data-form="upload"] [data-taken-edit]').first().evaluate(b => b.click()).catch(() => {});
    const input = page.locator('form[data-form="upload"] input[name="takenAt"]');
    if (await input.count()) {
      await input.fill('2026-09-20T21:00').catch(() => {}); await input.dispatchEvent('input').catch(() => {}); await input.dispatchEvent('change').catch(() => {});
      await L.sleep(600);
      await L.grab(page, 'upload-offnight', 'form[data-form="upload"]');
      await page.evaluate(() => document.querySelector('form[data-form="upload"] [data-taken-field]')?.scrollIntoView({ block: 'center' }));
      await L.shot(page, 'w2-04-upload-offnight');
    }
    // an impossible time
    if (await input.count()) {
      await input.fill('1990-01-01T21:00').catch(() => {}); await input.dispatchEvent('input').catch(() => {}); await input.dispatchEvent('change').catch(() => {});
      await L.sleep(600);
      await L.grab(page, 'upload-badtime', 'form[data-form="upload"] .moment-taken');
      await L.shot(page, 'w2-05-upload-badtime');
    }
    // stage sample
    await page.locator('form[data-form="upload"] [data-sample-photo="sample-stage"]').first().evaluate(b => b.click());
    await page.waitForFunction(() => /拍摄于/.test(document.querySelector('form[data-form="upload"] [data-taken-line]')?.textContent || ''), null, { timeout: 30000 }).catch(() => {});
    await L.aiSettled(page);
    await L.sleep(2500);
    await L.grab(page, 'upload-stage-sample', '#panel');
    await L.shotScroll(page, 'w2-06-upload-stage', '#panel', 3);
    await L.check(page, 'upload-stage', '#panel');
    // crowd sample (sure)
    await page.locator('form[data-form="upload"] [data-sample-photo="sample-crowd"]').first().evaluate(b => b.click());
    await L.aiSettled(page); await L.sleep(2500);
    await L.grab(page, 'upload-crowd-sample', '#panel');
    await L.shotScroll(page, 'w2-07-upload-crowd', '#panel', 3);
    await L.check(page, 'upload-crowd', '#panel');
    const chosen = await page.evaluate(() => Boolean(document.querySelector('form[data-form="upload"] .moment-chip[aria-pressed="true"]')));
    console.log('viewpoint chosen by AI:', chosen);
    if (!chosen) await page.locator('form[data-form="upload"] .moment-chip[data-moment-viewpoint="crowd"]').first().evaluate(b => b.click());
    // share with members
    await page.selectOption('form[data-form="upload"] select', 'members').catch(() => {});
    await page.locator('form[data-form="upload"] button[type="submit"]').first().evaluate(b => b.click());
    await page.locator('#panel [data-exchange-offer]').first().waitFor({ state: 'attached', timeout: 45000 }).catch(() => console.log('no exchange offer seen'));
    await L.sleep(1500);
    await L.grab(page, 'wall-after-save', '#panel');
    await L.shotScroll(page, 'w2-08-wall', '#panel', 4);
    await L.check(page, 'wall', '#panel');
    // photo detail of own photo and of a cast photo
    const items = await page.locator('#panel [data-open="photo"], #panel button[data-photo], #panel .photo-item button').count();
    console.log('photo buttons on wall:', items);
    await L.closeSheet(page);
    await L.sleep(800);
    await tourGrab(page, 'tour-after-photo');
    // the wall from the tour (step 2)
    const t2 = page.locator('[data-tour-action="open:wall"]');
    if (await t2.count()) { await t2.first().evaluate(b => b.click()); await L.sleep(1500); await L.closeSheet(page); await L.sleep(800); }
    await tourGrab(page, 'tour-step-after-wall');
    // the exchange from the wall
    await L.clickHidden(page, { open: 'wall' });
    await page.locator('#panel [data-exchange-offer]').first().waitFor({ state: 'attached', timeout: 30000 }).catch(() => {});
    await L.sleep(800);
    await page.locator('#panel [data-exchange-offer]').first().evaluate(b => b.click());
    await page.waitForSelector('.photo-exchanges:not([hidden]) [data-x-consent]', { timeout: 30000 });
    await L.sleep(2500);
    await L.grab(page, 'x-compose', '.photo-exchanges');
    await L.shotScroll(page, 'w2-09-x-compose', '.photo-exchanges .exchange-body', 3);
    await L.check(page, 'x-compose', '.photo-exchanges');
    await page.locator('.photo-exchanges [data-x-consent]').first().check({ force: true });
    await L.sleep(300);
    await page.locator('.photo-exchanges [data-x-send]').first().evaluate(b => b.click());
    await L.sleep(1200);
    await L.grab(page, 'x-sent', '.photo-exchanges');
    await L.shot(page, 'w2-10-x-sent');
    await page.waitForFunction(() => /交换已接受/.test(document.querySelector('.photo-exchanges')?.textContent || ''), null, { timeout: 60000 }).catch(() => console.log('no accepted yet'));
    await L.sleep(1500);
    await L.grab(page, 'x-accepted', '.photo-exchanges');
    await L.shotScroll(page, 'w2-11-x-accepted', '.photo-exchanges .exchange-body', 3);
    await L.check(page, 'x-accepted', '.photo-exchanges');
    const revoke = page.locator('.photo-exchanges [data-x-action="revoke"]');
    if (await revoke.count()) {
      await revoke.first().evaluate(b => b.click()); await L.sleep(500);
      await L.grab(page, 'x-revoke-confirm', '.photo-exchanges');
      await page.evaluate(() => document.querySelector('.photo-exchanges .exchange-confirm')?.scrollIntoView({ block: 'center' }));
      await L.shot(page, 'w2-12-x-revoke-confirm');
      await page.locator('.photo-exchanges [data-x-dismiss]').first().evaluate(b => b.click()).catch(() => {});
    }
    await page.locator('.photo-exchanges [data-x-back]').first().evaluate(b => b.click()).catch(() => {});
    await L.sleep(1200);
    await L.grab(page, 'x-list', '.photo-exchanges');
    await L.shot(page, 'w2-13-x-list');
    await page.locator('.photo-exchanges [data-x-close]').first().evaluate(b => b.click()).catch(() => {});
    await L.sleep(800);
    await tourGrab(page, 'tour-after-exchange');
    // wall again: now with the accepted exchange
    await L.clickHidden(page, { open: 'wall' });
    await L.sleep(1500);
    await L.grab(page, 'wall-after-exchange', '#panel');
    await L.shotScroll(page, 'w2-14-wall-after-x', '#panel', 4);
    // a photo detail: first cast photo, then own
    const photoIds = await page.evaluate(() => (window.__SPACE_EVENT_QA__?.()?.photos || []).map(p => p.id));
    console.log('photo ids', photoIds.length);
    await L.closeSheet(page);
    // recap
    await L.clickHidden(page, { open: 'recap' });
    await page.waitForSelector('.panel[data-kind="recap"]', { timeout: 30000 });
    await L.sleep(1800);
    await L.grab(page, 'recap', '#panel');
    await L.shotScroll(page, 'w2-15-recap', '#panel', 6);
    await L.check(page, 'recap', '#panel');
    await page.locator('#panel [data-open="memory-card"]').first().evaluate(b => b.click());
    await page.waitForSelector('form[data-form="memory-card"]', { timeout: 20000 });
    await L.sleep(900);
    await L.grab(page, 'memory-form', '#panel');
    await L.shotScroll(page, 'w2-16-memory', '#panel', 4);
    await L.check(page, 'memory-form', '#panel');
    await page.locator('form[data-form="memory-card"] input[name="memory-confirm"]').check({ force: true }).catch(() => console.log('no memory-confirm'));
    await page.locator('form[data-form="memory-card"] button[type="submit"]').first().evaluate(b => b.click());
    await page.waitForSelector('.memory-result img', { timeout: 30000 }).catch(() => console.log('no memory preview'));
    await L.sleep(1000);
    await L.grab(page, 'memory-done', '#panel');
    await L.shotScroll(page, 'w2-17-memory-done', '#panel', 5);
    const src = await page.evaluate(() => document.querySelector('.memory-result img')?.src);
    if (src) { const b64 = await page.evaluate(async src => { const r = await fetch(src); const b = await r.blob(); return await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); }); }, src); fs.writeFileSync(`${L.OUT}/${vp}-memory-card.png`, Buffer.from(b64.split(',')[1], 'base64')); console.log('saved memory png'); }
    await L.closeSheet(page);
    await L.sleep(800);
    await tourGrab(page, 'tour-after-recap');
    await L.grab(page, 'room-after-all', '.frame');
    await L.log(page, 'w2');
    console.log('errors', JSON.stringify(page.__errors));
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); } finally { L.flush(); await browser.close(); }
})();
