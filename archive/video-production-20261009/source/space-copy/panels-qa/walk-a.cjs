// A: upload form (empty, own photo + one-press time, sample), wall, exchange (compose, accepted, list), recap, memory card.
const Q = require('/tmp/space-copy/panels-qa/qa.cjs');
Q.watchdog(285);
const kind = process.argv[2] || 'phone';
(async () => {
  const browser = await Q.launch();
  try {
    const run = await Q.open(browser, kind);
    const { page } = run;
    await Q.enter(run);
    await Q.clickHidden(page, { open: 'upload' });
    await page.waitForSelector('form[data-form="upload"]', { timeout: 20000 });
    await Q.sleep(900);
    console.log('upload-empty', JSON.stringify(await Q.audit(page, '#panel')));
    console.log('TEXT upload-empty:', await Q.text(page, '#panel'));
    await Q.snap(page, 'upload-empty', kind);
    // own photo without EXIF
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8CAFWEXHbQSACj/P8Fu7N9hAAAAAElFTkSuQmCC', 'base64');
    await page.setInputFiles('form[data-form="upload"] input[type="file"]', { name: 'mine.png', mimeType: 'image/png', buffer: png });
    await page.waitForSelector('form[data-form="upload"] .photo-review', { timeout: 30000 });
    await Q.aiSettled(page);
    await Q.sleep(1000);
    console.log('TEXT upload-own:', await Q.text(page, 'form[data-form="upload"]'));
    await Q.snapScroll(page, 'upload-own', kind, '#panel', 3);
    const demoBtn = page.locator('form[data-form="upload"] [data-demo-time]');
    if (await demoBtn.count()) { await demoBtn.first().evaluate(b => b.click()); await Q.sleep(500); console.log('TEXT demo-on:', await Q.text(page, 'form[data-form="upload"] .moment-taken')); await page.evaluate(() => document.querySelector('form[data-form="upload"] [data-demo-time]')?.scrollIntoView({ block: 'center' })); await Q.snap(page, 'upload-demo-on', kind); }
    // sample stage
    await page.locator('form[data-form="upload"] [data-sample-photo="sample-stage"]').first().evaluate(b => b.click());
    await page.waitForFunction(() => /拍摄于/.test(document.querySelector('form[data-form="upload"] [data-taken-line]')?.textContent || ''), null, { timeout: 30000 }).catch(() => {});
    await Q.aiSettled(page);
    await Q.sleep(1200);
    console.log('TEXT upload-sample:', await Q.text(page, 'form[data-form="upload"]'));
    console.log('upload-sample', JSON.stringify(await Q.audit(page, '#panel')));
    await Q.snapScroll(page, 'upload-sample', kind, '#panel', 3);
    // off-night typed time
    await page.locator('form[data-form="upload"] [data-taken-edit]').first().evaluate(b => b.click()).catch(() => {});
    const input = page.locator('form[data-form="upload"] input[name="takenAt"]');
    await input.fill('2026-09-20T21:00').catch(() => {}); await input.dispatchEvent('input').catch(() => {});
    await Q.sleep(500);
    console.log('TEXT offnight:', await Q.text(page, 'form[data-form="upload"] .moment-taken'));
    await page.evaluate(() => document.querySelector('form[data-form="upload"] [data-taken-off]')?.scrollIntoView({ block: 'center' }));
    await Q.snap(page, 'upload-offnight', kind);
    await input.fill('1990-01-01T21:00').catch(() => {}); await input.dispatchEvent('input').catch(() => {});
    await Q.sleep(400);
    console.log('TEXT badtime:', await Q.text(page, 'form[data-form="upload"] .moment-taken'));
    // crowd sample, save
    await page.locator('form[data-form="upload"] [data-sample-photo="sample-crowd"]').first().evaluate(b => b.click());
    await Q.aiSettled(page); await Q.sleep(1200);
    const chosen = await page.evaluate(() => Boolean(document.querySelector('form[data-form="upload"] .moment-chip[aria-pressed="true"]')));
    if (!chosen) await page.locator('form[data-form="upload"] .moment-chip[data-moment-viewpoint="crowd"]').first().evaluate(b => b.click());
    await page.locator('form[data-form="upload"] button[type="submit"]').first().evaluate(b => b.click());
    await page.locator('#panel [data-moment-badge] [data-exchange-offer]').first().waitFor({ state: 'attached', timeout: 45000 });
    await Q.sleep(1200);
    console.log('TEXT wall:', await Q.text(page, '#panel'));
    console.log('wall', JSON.stringify(await Q.audit(page, '#panel')));
    await Q.snapScroll(page, 'wall', kind, '#panel', 3);
    // exchange
    await page.locator('#panel [data-exchange-offer]').first().evaluate(b => b.click());
    await page.waitForSelector('.photo-exchanges:not([hidden]) [data-x-consent]', { timeout: 30000 });
    await Q.sleep(2500);
    console.log('TEXT x-compose:', await Q.text(page, '.photo-exchanges'));
    console.log('x-compose', JSON.stringify(await Q.audit(page, '.photo-exchanges')));
    await Q.snapScroll(page, 'x-compose', kind, '.photo-exchanges .exchange-body', 3);
    await page.locator('.photo-exchanges [data-x-consent]').first().check({ force: true });
    await Q.sleep(300);
    await page.locator('.photo-exchanges [data-x-send]').first().evaluate(b => b.click());
    await Q.sleep(1500);
    console.log('TEXT x-sent:', await Q.text(page, '.photo-exchanges'));
    await Q.snap(page, 'x-sent', kind);
    await page.waitForFunction(() => /交换已接受/.test(document.querySelector('.photo-exchanges')?.textContent || ''), null, { timeout: 60000 }).catch(() => console.log('no accepted yet'));
    await Q.sleep(1500);
    console.log('TEXT x-accepted:', await Q.text(page, '.photo-exchanges'));
    await Q.snapScroll(page, 'x-accepted', kind, '.photo-exchanges .exchange-body', 3);
    const revoke = page.locator('.photo-exchanges [data-x-action="revoke"]');
    if (await revoke.count()) { await revoke.first().evaluate(b => b.click()); await Q.sleep(400); console.log('TEXT x-revoke-confirm:', await Q.text(page, '.photo-exchanges .exchange-confirm')); await page.evaluate(() => document.querySelector('.photo-exchanges .exchange-confirm')?.scrollIntoView({ block: 'center' })); await Q.snap(page, 'x-revoke-confirm', kind); await page.locator('.photo-exchanges [data-x-dismiss]').first().evaluate(b => b.click()); }
    await page.locator('.photo-exchanges [data-x-back]').first().evaluate(b => b.click());
    await Q.sleep(1200);
    console.log('TEXT x-list:', await Q.text(page, '.photo-exchanges'));
    await Q.snap(page, 'x-list', kind);
    await page.locator('.photo-exchanges [data-x-close]').first().evaluate(b => b.click());
    await Q.sleep(500);
    // recap
    await Q.clickHidden(page, { open: 'recap' });
    await page.waitForSelector('.panel[data-kind="recap"]', { timeout: 30000 });
    await Q.sleep(1500);
    console.log('TEXT recap:', await Q.text(page, '#panel'));
    console.log('recap', JSON.stringify(await Q.audit(page, '#panel')));
    await Q.snapScroll(page, 'recap', kind, '#panel', 6);
    await page.locator('#panel [data-open="memory-card"]').first().evaluate(b => b.click());
    await page.waitForSelector('form[data-form="memory-card"]', { timeout: 20000 });
    await Q.sleep(800);
    console.log('TEXT memory:', await Q.text(page, '#panel'));
    console.log('memory', JSON.stringify(await Q.audit(page, '#panel')));
    await Q.snapScroll(page, 'memory', kind, '#panel', 4);
    await page.locator('form[data-form="memory-card"] input[name="memory-confirm"]').check({ force: true });
    await page.locator('form[data-form="memory-card"] button[type="submit"]').first().evaluate(b => b.click());
    await page.waitForSelector('.memory-result img', { timeout: 30000 }).catch(() => console.log('no memory preview'));
    await Q.sleep(800);
    console.log('TEXT memory-done:', await Q.text(page, '#panel'));
    await Q.snapScroll(page, 'memory-done', kind, '#panel', 5);
    const src = await page.evaluate(() => document.querySelector('.memory-result img')?.src);
    if (src) { const b64 = await page.evaluate(async src => { const r = await fetch(src); const b = await r.blob(); return await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); }); }, src); require('fs').writeFileSync(`${Q.OUT}/${kind}-memory-card.png`, Buffer.from(b64.split(',')[1], 'base64')); console.log('saved memory png'); }
    console.log('errors', JSON.stringify(page.__errors));
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); } finally { await browser.close(); }
})();
