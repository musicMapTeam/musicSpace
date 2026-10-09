// Own-photo sheets on the static dev server: save the ready-made crowd photo, then the photo sheet, withdraw, delete and library.
const S = require('/tmp/space-copy/panels-inv/dump.cjs');
const OUT = '/tmp/space-copy/shell-work/shots';
S.watchdog(280);
const kind = process.argv[2] || 'phone';
const text = (page, sel = '#panel-body') => page.evaluate(sel => document.querySelector(sel)?.innerText.replace(/\n+/g, ' | ').slice(0, 700), sel);
(async () => {
  const browser = await S.launch();
  try {
    const run = await S.open(browser, kind); const { page } = run;
    await S.enter(run);
    await page.locator('[data-tour-action="sample:sample-crowd"]').first().evaluate(b => b.click());
    await page.waitForSelector('form[data-form="upload"] .photo-review', { timeout: 30000 });
    await S.aiSettled(page); await S.sleep(800);
    const chosen = await page.evaluate(() => Boolean(document.querySelector('form[data-form="upload"] [data-moment-viewpoint][aria-pressed="true"]')));
    if (!chosen) await page.locator('form[data-form="upload"] [data-moment-viewpoint="crowd"]').first().evaluate(b => b.click());
    await page.locator('form[data-form="upload"] button[type="submit"]').first().evaluate(b => b.click());
    await page.waitForFunction(() => { const q = window.__SPACE_EVENT_QA__?.(); return q && q.photos.some(p => p.ownerId === q.actorId) && document.querySelector('#toast')?.textContent; }, null, { timeout: 45000 });
    console.log('save toast', JSON.stringify(await page.evaluate(() => document.querySelector('#toast').textContent)));
    await S.sleep(1200);
    const mine = await page.evaluate(() => { const me = window.__SPACE_EVENT_QA__?.().actorId; return window.__SPACE_EVENT_QA__?.().photos.find(p => p.ownerId === me)?.id; });
    for (const [label, ds] of [['own-photo', { photo: mine }], ['withdraw', { open: 'withdraw', id: mine }], ['delete', { open: 'delete', id: mine }], ['library', { open: 'library' }]]) {
      await S.clickHidden(page, ds); await S.sleep(1200);
      const o = await page.evaluate(() => { const root = document.querySelector('#panel'); const rb = root.getBoundingClientRect(); return [...root.querySelectorAll('*')].filter(e => e.getClientRects().length && (e.getBoundingClientRect().right > rb.right + 1)).map(e => e.tagName).slice(0, 5); });
      console.log(`--- ${kind} ${label}: ${await text(page)} | overflow: ${JSON.stringify(o)}`);
      await S.shot(page, `${OUT}/${kind}-${label}.png`, { settle: 300 });
    }
    // withdraw for real, to see the toast
    await S.clickHidden(page, { open: 'withdraw', id: mine }); await S.sleep(800);
    await page.locator('#panel [data-confirm="withdraw"]').first().evaluate(b => b.click()); await S.sleep(2500);
    console.log('withdraw toast', JSON.stringify(await page.evaluate(() => document.querySelector('#toast').textContent)));
    console.log('errors', JSON.stringify(page.__errors));
    await run.context.close();
  } finally { await browser.close(); }
})().catch(e => { console.error('FAILED', e); process.exit(1); });
