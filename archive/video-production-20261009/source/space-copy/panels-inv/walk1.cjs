// Part 1: upload form (empty, sample, own photo without EXIF), wall, exchange (compose → accepted → list), recap, memory card.
const S = require('/tmp/space-copy/panels-inv/dump.cjs');
S.watchdog(280);
(async () => {
  const browser = await S.launch();
  try {
    const run = await S.open(browser, process.argv[2] || 'phone');
    const { page } = run;
    await S.dump(page, 'lobby-presence', '.presence, .track, footer, #scene-heading, #room-code-label');
    await S.enter(run);
    await S.dump(page, 'room-after-enter', '.presence, .track, footer, #scene-heading, #scene-code, .demo-tour');
    // upload form, empty
    await S.clickHidden(page, { open: 'upload' });
    await page.waitForSelector('form[data-form="upload"]', { timeout: 20000 });
    await S.sleep(800);
    await S.dump(page, 'upload-empty');
    // own photo without EXIF (a PNG made on the fly)
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8CAFWEXHbQSACj/P8Fu7N9hAAAAAElFTkSuQmCC', 'base64');
    await page.setInputFiles('form[data-form="upload"] input[type="file"]', { name: 'mine.png', mimeType: 'image/png', buffer: png });
    await page.waitForSelector('form[data-form="upload"] .photo-review', { timeout: 30000 });
    await S.aiSettled(page);
    await S.sleep(1200);
    await S.dump(page, 'upload-own-photo');
    // demo-time button
    const demoBtn = page.locator('form[data-form="upload"] [data-demo-time]');
    if (await demoBtn.count()) { await demoBtn.first().evaluate(b => b.click()); await S.sleep(500); await S.dump(page, 'upload-own-demo-time-on'); await demoBtn.first().evaluate(b => b.click()); await S.sleep(300); }
    // the edit-time field with a bad time
    const edit = page.locator('form[data-form="upload"] [data-taken-edit]');
    // nudge: try to save the sample without a side later
    // sample photo
    await page.locator('form[data-form="upload"] [data-sample-photo="sample-stage"]').first().evaluate(b => b.click());
    await page.waitForFunction(() => document.querySelector('form[data-form="upload"] [data-sample-flag]'), null, { timeout: 30000 }).catch(() => {});
    await S.aiSettled(page);
    await S.sleep(1500);
    await S.dump(page, 'upload-sample-stage');
    // type an off-night time to see the off-night line
    const input = page.locator('form[data-form="upload"] input[name="takenAt"]');
    await page.locator('form[data-form="upload"] [data-taken-edit]').first().evaluate(b => b.click()).catch(() => {});
    await S.sleep(300);
    await input.fill('2026-09-20T21:00').catch(() => {});
    await input.dispatchEvent('input').catch(() => {});
    await S.sleep(500);
    await S.dump(page, 'upload-sample-offnight');
    await input.fill('1990-01-01T21:00').catch(() => {});
    await input.dispatchEvent('input').catch(() => {});
    await S.sleep(500);
    await S.dump(page, 'upload-sample-badtime');
    // back to the crowd sample, save
    await page.locator('form[data-form="upload"] [data-sample-photo="sample-crowd"]').first().evaluate(b => b.click());
    await S.aiSettled(page);
    await S.sleep(1500);
    await S.dump(page, 'upload-sample-crowd');
    const chosen = await page.evaluate(() => Boolean(document.querySelector('form[data-form="upload"] .moment-chip[aria-pressed="true"]')));
    if (!chosen) await page.locator('form[data-form="upload"] .moment-chip[data-moment-viewpoint="crowd"]').first().evaluate(b => b.click());
    await page.locator('form[data-form="upload"] button[type="submit"]').first().evaluate(b => b.click());
    await page.locator('#panel [data-moment-badge] [data-exchange-offer]').first().waitFor({ state: 'attached', timeout: 45000 });
    await S.sleep(1200);
    await S.dump(page, 'wall-after-save');
    console.log('toasts', JSON.stringify(await S.toasts(page)));
    // exchange
    await page.locator('#panel [data-exchange-offer]').first().evaluate(b => b.click());
    await page.waitForSelector('.photo-exchanges:not([hidden]) [data-x-consent]', { timeout: 30000 });
    await S.sleep(2500);
    await S.dump(page, 'exchange-compose', '.photo-exchanges');
    await page.locator('.photo-exchanges [data-x-consent]').first().check({ force: true });
    await S.sleep(300);
    await page.locator('.photo-exchanges [data-x-send]').first().evaluate(b => b.click());
    await S.sleep(1500);
    await S.dump(page, 'exchange-sent', '.photo-exchanges');
    await page.waitForFunction(() => /交换已接受/.test(document.querySelector('.photo-exchanges')?.textContent || ''), null, { timeout: 60000 }).catch(() => console.log('no accepted yet'));
    await S.sleep(1500);
    await S.dump(page, 'exchange-accepted', '.photo-exchanges');
    // revoke confirm
    const revoke = page.locator('.photo-exchanges [data-x-action="revoke"]');
    if (await revoke.count()) { await revoke.first().evaluate(b => b.click()); await S.sleep(400); await S.dump(page, 'exchange-revoke-confirm', '.photo-exchanges'); await page.locator('.photo-exchanges [data-x-dismiss]').first().evaluate(b => b.click()); }
    await page.locator('.photo-exchanges [data-x-back]').first().evaluate(b => b.click());
    await S.sleep(1200);
    await S.dump(page, 'exchange-list', '.photo-exchanges');
    await page.locator('.photo-exchanges [data-x-close]').first().evaluate(b => b.click());
    await S.sleep(500);
    // recap
    await S.clickHidden(page, { open: 'recap' });
    await page.waitForSelector('.panel[data-kind="recap"]', { timeout: 30000 });
    await S.sleep(1500);
    await S.dump(page, 'recap');
    await page.locator('#panel [data-open="memory-card"]').first().evaluate(b => b.click());
    await page.waitForSelector('form[data-form="memory-card"]', { timeout: 20000 });
    await S.sleep(800);
    await S.dump(page, 'memory-card');
    await page.locator('form[data-form="memory-card"] input[name="memory-confirm"]').check({ force: true });
    await page.locator('form[data-form="memory-card"] button[type="submit"]').first().evaluate(b => b.click());
    await page.waitForSelector('.memory-result img', { timeout: 30000 }).catch(() => console.log('no memory preview'));
    await S.sleep(800);
    await S.dump(page, 'memory-card-done');
    const src = await page.evaluate(() => document.querySelector('.memory-result img')?.src);
    if (src) { const b64 = await page.evaluate(async src => { const r = await fetch(src); const b = await r.blob(); return await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); }); }, src); require('fs').writeFileSync('/tmp/space-copy/panels-inv/dumps/memory-card.png', Buffer.from(b64.split(',')[1], 'base64')); console.log('saved memory png'); }
    console.log('errors', JSON.stringify(page.__errors));
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); } finally { await browser.close(); }
})();
