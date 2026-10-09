const S = require('/tmp/space-copy/panels-inv/dump.cjs');
S.watchdog(200);
(async () => {
  const browser = await S.launch();
  try {
    const run = await S.open(browser, 'phone'); const { page } = run;
    await S.enter(run);
    await page.locator('[data-tour-action="sample:sample-crowd"]').first().evaluate(b => b.click());
    await page.waitForSelector('form[data-form="upload"] .photo-review', { timeout: 30000 });
    await S.aiSettled(page); await S.sleep(800);
    console.log('pressed?', await page.evaluate(() => [...document.querySelectorAll('form[data-form="upload"] [data-moment-viewpoint]')].map(b => b.dataset.momentViewpoint + ':' + b.getAttribute('aria-pressed')).join(',')));
    const chosen = await page.evaluate(() => Boolean(document.querySelector('form[data-form="upload"] [data-moment-viewpoint][aria-pressed="true"]')));
    if (!chosen) await page.locator('form[data-form="upload"] [data-moment-viewpoint="crowd"]').first().evaluate(b => b.click());
    await page.locator('form[data-form="upload"] button[type="submit"]').first().evaluate(b => b.click());
    for (let i = 0; i < 20; i++) { await S.sleep(500); const s = await page.evaluate(() => ({ kind: document.querySelector('#panel')?.dataset.kind, hidden: document.querySelector('#panel')?.hidden, toast: document.querySelector('#toast')?.textContent })); if (i % 4 === 0 || s.toast) console.log(i, JSON.stringify(s)); if (s.toast) break; }
    const qa = await page.evaluate(() => { const q = window.__SPACE_EVENT_QA__(); return { actor: q.actorId, photos: q.photos }; });
    console.log(JSON.stringify(qa));
    await run.context.close();
  } finally { await browser.close(); }
})().catch(e => { console.error('FAILED', e); process.exit(1); });
