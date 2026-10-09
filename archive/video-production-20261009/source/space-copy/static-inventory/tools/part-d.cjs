// Part D: the host side of the static site (自己开个房 → own room → ··· → 管理这一场), a read-only second tab, the rescue overlay.
const L = require('./lib.cjs');
L.watchdog(285);
const vp = process.argv[2] || 'phone';
(async () => {
  const browser = await L.launch();
  try {
    const run = await L.open(browser, vp);
    const { page } = run;
    // a read-only second tab, opened while the first holds the lock
    const second = await run.context.newPage();
    await second.goto(L.BASE, { waitUntil: 'domcontentloaded' });
    await second.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 120000 }).catch(() => console.log('second tab not ready'));
    await L.sleep(1500);
    await L.grab(second, 'readonly-banner', '#space-boot-banner');
    await L.grab(second, 'readonly-status', '#render-status');
    await L.shot(second, `d-readonly-${vp}`);
    // try to enter from the read-only tab
    await second.locator('#join').first().evaluate(b => b.click()).catch(() => {});
    await second.waitForSelector('form[data-form="demo-entry"]', { timeout: 20000 }).catch(() => {});
    await L.sleep(800);
    await L.grab(second, 'readonly-entry', '#panel');
    await second.evaluate(() => { const f = document.querySelector('form[data-form="demo-entry"]'); if (!f) return; f.querySelector('input[name="consent"]').checked = true; const b = f.querySelector('button[type="submit"]'); if (b) b.disabled = false; f.requestSubmit(); });
    await L.sleep(3000);
    await L.log(second, 'readonly-log');
    // rescue overlay in the second tab
    await second.evaluate(() => window.__SPACE_RESCUE__?.show('timeout'));
    await L.sleep(500);
    await L.grab(second, 'rescue', '#space-rescue');
    await L.shot(second, `d-rescue-${vp}`);
    await second.close();
    // host flow in the first tab
    await L.press(run, '#join');
    await page.waitForSelector('form[data-form="demo-entry"]', { timeout: 30000 });
    await page.locator('#panel details.demo-entry-more summary').first().evaluate(s => s.click());
    await page.locator('#panel [data-open="create"]').first().evaluate(b => b.click());
    await L.sleep(800);
    await L.grab(page, 'create-no-identity', '#panel');
    await L.shot(page, `d-create-${vp}`);
    // make an identity first via the showcase entry, then leave and create
    await L.closeSheet(run);
    await L.enter(run);
    await L.press(run, '#room-info');
    await L.sleep(800);
    await L.clickHidden(page, { open: 'create' });
    await L.sleep(800);
    await L.grab(page, 'create-form', '#panel');
    await L.shot(page, `d-create-form-${vp}`);
    await page.fill('#panel form[data-form="create"] input[name="title"]', '周五的最后一首');
    await page.fill('#panel form[data-form="create"] input[name="venue"]', '月台 Livehouse');
    await page.evaluate(() => { const f = document.querySelector('#panel form[data-form="create"]'); f.querySelectorAll('input[type="checkbox"]').forEach(c => { c.checked = true; }); f.requestSubmit(); });
    await L.sleep(3500);
    await L.grab(page, 'own-room-body', 'body > #app .frame > header, .presence, #demo-tour, .track');
    await L.closeSheet(run);
    await L.press(run, '#room-info');
    await L.sleep(800);
    await L.grab(page, 'own-room-panel', '#panel');
    await L.shot(page, `d-own-room-${vp}`);
    const manage = page.locator('#panel [data-open="moderation"]').first();
    if (await manage.count()) { await manage.evaluate(b => b.click()); await L.sleep(1500); await L.grab(page, 'moderation', '.room-moderation'); await L.shot(page, `d-moderation-${vp}`); }
    await L.log(page, 'log-d');
    L.save(`part-d-${vp}`);
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); L.save(`part-d-${vp}`); } finally { await browser.close(); }
})();
