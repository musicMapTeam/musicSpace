// Probe: when and why does the ORT wasm request end as ERR_ABORTED? fresh context, join, optionally open the upload panel at once.
const { launch, openContext, act, sleep } = require('./lib.cjs');
const [kind = 'phone', BASE = 'http://127.0.0.1:4783/musicSpace/', mode = 'upload'] = process.argv.slice(2);
(async () => {
  const browser = await launch();
  const { ctx, page, rec } = await openContext(browser, kind, BASE);
  const t0 = Date.now(); const T = () => ((Date.now() - t0) / 1000).toFixed(2);
  page.on('request', r => { if (/\/ai\//.test(r.url())) console.log(T(), 'REQ', r.url().split('/').slice(-2).join('/')); });
  page.on('requestfinished', r => { if (/\/ai\//.test(r.url())) console.log(T(), 'DONE', r.url().split('/').slice(-2).join('/')); });
  page.on('requestfailed', r => console.log(T(), 'FAIL', r.failure()?.errorText, r.url().split('/').slice(-2).join('/')));
  page.on('console', m => console.log(T(), 'console', m.type(), m.text().slice(0, 200)));
  await page.goto(BASE);
  await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 120000 });
  await sleep(1500);
  await act(page, kind, '#join', 'join', rec);
  await page.waitForSelector('form[data-form="demo-entry"]');
  if (mode === 'host') { await act(page, kind, '#panel details.demo-entry-more > summary', 'host', rec); await sleep(500); await act(page, kind, '#panel details.demo-entry-more > summary', 'host', rec); await sleep(500); }
  await act(page, kind, 'form[data-form="demo-entry"] label.consent', 'consent', rec);
  await page.waitForFunction(() => { const b = document.querySelector('form[data-form="demo-entry"] button[type="submit"]'); return b && !b.disabled; }, null, { timeout: 90000 });
  await act(page, kind, 'form[data-form="demo-entry"] button[type="submit"]', 'enter', rec);
  console.log(T(), 'entered');
  await page.waitForSelector('[data-tour-action="sample:sample-crowd"]', { timeout: 60000 });
  if (mode === 'upload' || mode === 'host') { await sleep(2500); await act(page, kind, page.locator('.demo-tour button').filter({ hasText: '用我自己的照片' }).first(), 'own', rec); console.log(T(), 'opened upload'); }
  await sleep(20000);
  console.log(T(), 'failed:', JSON.stringify(rec.failed));
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
