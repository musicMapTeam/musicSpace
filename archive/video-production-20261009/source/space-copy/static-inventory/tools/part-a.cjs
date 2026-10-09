// Part A: lobby, entry, About (from the entry), room + tour, the sample upload, the wall, the exchange.
const L = require('./lib.cjs');
L.watchdog(280);
const vp = process.argv[2] || 'phone';
(async () => {
  const browser = await L.launch();
  try {
    const run = await L.open(browser, vp);
    const { page } = run;
    await L.grab(page, 'lobby', 'body');
    await L.shot(page, `a-lobby-${vp}`);
    await L.press(run, '#join');
    await page.waitForSelector('form[data-form="demo-entry"]', { timeout: 30000 });
    await L.sleep(500);
    await L.grab(page, 'entry', '#panel');
    await L.shot(page, `a-entry-${vp}`);
    // the 自己开个房 disclosure
    await page.locator('#panel details.demo-entry-more summary').first().evaluate(s => s.click());
    await L.sleep(300);
    await L.grab(page, 'entry-more', '#panel details.demo-entry-more');
    // consent refusal: submit without consent
    await page.waitForFunction(() => { const b = document.querySelector('form[data-form="demo-entry"] button[type="submit"]'); return b && !b.disabled; }, null, { timeout: 90000 });
    await page.evaluate(() => { const f = document.querySelector('form[data-form="demo-entry"]'); const c = f.querySelector('input[name="consent"]'); c.required = false; f.requestSubmit(); });
    await L.sleep(800);
    await L.log(page, 'log-after-refusal');
    // About from the entry
    await page.locator('#panel [data-open="about"]').first().evaluate(b => b.click());
    await L.sleep(700);
    await L.grab(page, 'about-lobby', '#panel');
    await L.shot(page, `a-about-${vp}`);
    await L.closeSheet(run);
    await L.enter(run);
    await L.sleep(800);
    await L.grab(page, 'room-tour-1', 'body');
    await L.shot(page, `a-room-${vp}`);
    // collapse/expand labels of the tour
    await L.grab(page, 'tour-1', '#demo-tour');
    // the sample photo
    await L.press(run, '[data-tour-action="sample:sample-crowd"]');
    await page.waitForSelector('form[data-form="upload"] .photo-review', { timeout: 30000 });
    await page.waitForFunction(() => /^(sure|unsure|off)/.test(document.querySelector('form[data-form="upload"] [data-ai-line]')?.getAttribute('data-ai-key') || ''), null, { timeout: 90000 }).catch(() => {});
    await L.sleep(1200);
    await L.grab(page, 'upload-sample', '#panel');
    await L.shot(page, `a-upload-${vp}`);
    const chosen = await page.evaluate(() => Boolean(document.querySelector('form[data-form="upload"] .moment-chip[aria-pressed="true"]')));
    if (!chosen) await page.locator('form[data-form="upload"] .moment-chip[data-moment-viewpoint="crowd"]').first().evaluate(b => b.click());
    await page.locator('form[data-form="upload"] button[type="submit"]').first().evaluate(b => b.click());
    await page.locator('#panel [data-moment-badge] [data-exchange-offer]').first().waitFor({ state: 'attached', timeout: 45000 });
    await L.sleep(800);
    await L.grab(page, 'wall', '#panel');
    await L.shot(page, `a-wall-${vp}`);
    await page.locator('#panel [data-exchange-offer]').first().evaluate(b => b.click());
    await L.sleep(1200);
    await L.grab(page, 'exchange-compose', '.frame .exchange-panel, .frame [class*="exchange"]');
    await L.shot(page, `a-exchange-${vp}`);
    // tick consent and send
    const consent = page.locator('.frame [class*="exchange"] input[type="checkbox"]').first();
    if (await consent.count()) await consent.check({ force: true });
    await L.sleep(300);
    const sendBtn = page.locator('.frame [class*="exchange"] button[type="submit"], .frame [class*="exchange"] [data-exchange-send]').first();
    if (await sendBtn.count()) await sendBtn.evaluate(b => b.click());
    await page.waitForFunction(() => /交换已接受/.test(document.body.innerText), null, { timeout: 45000 }).catch(() => console.log('no 交换已接受 seen'));
    await L.sleep(800);
    await L.grab(page, 'exchange-accepted', '.frame [class*="exchange"]');
    await L.shot(page, `a-exchange-accepted-${vp}`);
    await L.log(page, 'log-a');
    L.save(`part-a-${vp}`);
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); } finally { await browser.close(); }
})();
