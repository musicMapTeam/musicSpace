// Community scene sticker check: create a Livehouse fan community in the in-page service, open it, read the scene heading.
const S = require('/tmp/space-copy/panels-inv/dump.cjs');
const OUT = '/tmp/space-copy/shell-work/shots';
S.watchdog(250);
const kind = process.argv[2] || 'phone';
(async () => {
  const browser = await S.launch();
  try {
    const run = await S.open(browser, kind); const { page } = run;
    await S.enter(run); await S.sleep(1200);
    await S.clickHidden(page, { open: 'communities' }); await S.sleep(2000);
    await page.fill('form[data-community-create] input[name="title"]', '月台 Livehouse 乐迷社群');
    await page.check('form[data-community-create] input[name="consent"]', { force: true });
    await page.locator('form[data-community-create] button[type="submit"]').first().evaluate(b => b.click());
    await S.sleep(3000);
    const heading = () => page.evaluate(() => ({ sticker: document.querySelector('#scene-heading small')?.textContent, title: document.querySelector('#room-title')?.textContent, code: document.querySelector('#room-code-label')?.textContent, status: document.querySelector('#render-status')?.textContent, aria: document.querySelector('#scene-details')?.getAttribute('aria-label') }));
    console.log('after create', JSON.stringify(await heading()));
    if (!/乐迷社群|COMMUNITY/.test((await heading()).sticker || '')) {
      const btn = page.locator('[data-community]').first();
      if (await btn.count()) { await btn.evaluate(b => b.click()); await S.sleep(3000); }
      console.log('after open', JSON.stringify(await heading()));
    }
    await S.shot(page, `${OUT}/${kind}-community-open.png`);
    // close the community sheet to see the sticker on the scene
    const closed = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.getClientRects().length && /^(×|x|X)$/.test(b.textContent.trim()) && b.closest('.community-panel,.community,[class*="community"]')); if (b) { b.click(); return b.className || 'closed'; } return null; });
    console.log('closed sheet via', closed);
    await S.sleep(1500);
    console.log('after close', JSON.stringify(await heading()));
    const box = await page.evaluate(() => { const s = document.querySelector('#scene-heading'); const c = document.querySelector('#scene-code'); const r = e => e && e.getClientRects().length ? (b => [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)])(e.getBoundingClientRect()) : null; return { heading: r(s), small: r(s?.querySelector('small')), code: r(c), frame: r(document.querySelector('.world-shell')) }; });
    console.log('boxes', JSON.stringify(box));
    await S.shot(page, `${OUT}/${kind}-community-scene.png`);
    console.log('errors', JSON.stringify(page.__errors));
    await run.context.close();
  } finally { await browser.close(); }
})().catch(e => { console.error('FAILED', e); process.exit(1); });
