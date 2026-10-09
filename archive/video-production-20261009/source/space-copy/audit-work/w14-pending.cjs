// W14: how long 「上一步还没确认，可以重试。」 stays on screen during an ordinary community write (join, send).
const L = require('./lib.cjs');
L.watchdog(200);
const vp = process.argv[2] || 'phone';
L.setCorpus(`w14-${vp}`);
(async () => {
  const browser = await L.launch();
  try {
    const run = await L.open(browser, vp);
    const { page } = run; page.__vp = vp;
    await L.ready(run);
    await L.enter(run);
    await L.clickHidden(page, { open: 'conversation' });
    await page.waitForSelector('.music-community:not([hidden]) form[data-group-join]', { timeout: 20000 });
    await page.evaluate(() => { window.__pend = []; const t0 = performance.now(); new MutationObserver(() => { const on = /上一步还没确认/.test(document.querySelector('.music-community')?.textContent || ''); const last = window.__pend[window.__pend.length - 1]; if (!last || last[0] !== on) window.__pend.push([on, Math.round(performance.now() - t0)]); }).observe(document.querySelector('.music-community'), { childList: true, subtree: true, characterData: true }); });
    await page.locator('.music-community form[data-group-join] input[name="consent"]').check({ force: true });
    await page.locator('.music-community form[data-group-join] button[type="submit"]').first().evaluate(b => b.click());
    await L.sleep(2000);
    for (let i = 0; i < 3; i++) {
      await page.fill('.music-community textarea', `第 ${i + 1} 句`).catch(() => {});
      await page.locator('.music-community [data-group-send] button[type="submit"]').first().evaluate(b => b.click()).catch(() => {});
      await L.sleep(400);
      await L.shot(page, `w14-send-${i}`);
      await L.sleep(1200);
    }
    console.log('pending shown (on, ms):', JSON.stringify(await page.evaluate(() => window.__pend)));
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); } finally { L.flush(); await browser.close(); }
})();
