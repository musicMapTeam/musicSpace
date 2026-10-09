const { launch, open, sleep, OUT } = require('./lib.cjs');
(async () => {
  const browser = await launch();
  for (const [q, motion] of [['?doodle=0', 'no-preference'], ['', 'reduce']]) {
    const { page, log, ctx } = await open(browser, 'phone', { reducedMotion: motion });
    await page.goto(`http://127.0.0.1:8890/event-room/${q}`, { waitUntil: 'load' });
    await page.waitForFunction(() => /已连接/.test(document.querySelector('#render-status')?.innerText || ''), null, { timeout: 30000 }); await sleep(4000);
    const st = await page.evaluate(() => window.__SPACE_EVENT_QA__?.()?.camera?.scene?.renderStyle);
    const f = `${OUT}/node-room-phone${q ? '-doodle0' : ''}-${motion}.png`; await page.screenshot({ path: f });
    console.log(q || '(none)', motion, st, JSON.stringify(log.console), JSON.stringify(log.pageerror), f);
    await ctx.close();
  }
  await browser.close();
})();
