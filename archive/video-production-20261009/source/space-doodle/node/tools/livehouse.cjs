// Livehouse sample page (/livehouse/): HEAD vs now across views (overview, person, photos), plus ?doodle=0 on now.
const { launch, open, sleep, OUT, save } = require('./lib.cjs');
const vp = process.argv[2] || 'phone';
const SERVERS = { head: 'http://127.0.0.1:8891/livehouse/', now: 'http://127.0.0.1:8890/livehouse/', now_doodle0: 'http://127.0.0.1:8890/livehouse/?doodle=0' };
(async () => {
  const browser = await launch(); const report = {};
  for (const [tag, url] of Object.entries(SERVERS)) {
    const { ctx, page, log } = await open(browser, vp, { reducedMotion: 'reduce' });
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__SPACE_LIVEHOUSE_QA__?.().ready === true, null, { timeout: 40000 });
    await sleep(2500);
    await page.screenshot({ path: `${OUT}/livehouse-${vp}-${tag}-overview.png` });
    for (const view of ['person', 'photos']) {
      await page.locator(`nav [data-view=${view}]`).click(); await sleep(3500);
      await page.screenshot({ path: `${OUT}/livehouse-${vp}-${tag}-${view}.png` });
    }
    await page.locator('nav [data-view=photos]').click(); await sleep(500);
    const details = page.locator('[data-details=wall]'); if (await details.isVisible().catch(() => false)) { await details.click(); await sleep(1200); await page.screenshot({ path: `${OUT}/livehouse-${vp}-${tag}-wallpanel.png` }); }
    report[tag] = { qa: await page.evaluate(() => { const q = window.__SPACE_LIVEHOUSE_QA__(); return { mode: q.mode, style: q.camera?.scene?.renderStyle, venue: q.camera?.scene?.venueAsset?.status }; }), console: [...new Set(log.console)], pageerror: log.pageerror, bad: log.bad };
    await ctx.close();
  }
  save(`livehouse-${vp}.json`, report); console.log(JSON.stringify(report, null, 1));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
