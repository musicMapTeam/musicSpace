// Tab through the join sheet and check that the focused control is never hidden behind the pinned footer.
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const [, , W = '390', H = '844', PORT = '5190'] = process.argv;
const sleep = ms => new Promise(r => setTimeout(r, ms));
setTimeout(() => { console.log('WATCHDOG'); process.exit(2); }, 200000).unref();
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    const ctx = await browser.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(`http://127.0.0.1:${PORT}/`);
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
    await page.evaluate(() => document.fonts.ready);
    await page.locator('#join').click();
    await page.waitForSelector('form[data-form="demo-entry"]');
    await sleep(800);
    const info = await page.evaluate(() => { const p = document.querySelector('#panel'); const cs = getComputedStyle(p); return { overflowX: cs.overflowX, overflowY: cs.overflowY, padding: cs.padding }; });
    console.log('panel', JSON.stringify(info));
    await page.locator('form[data-form="demo-entry"] input[name=name]').focus();
    for (let i = 0; i < 9; i += 1) {
      const r = await page.evaluate(() => {
        const a = document.activeElement, f = document.querySelector('.demo-entry-actions'), p = document.querySelector('#panel');
        const ar = a.getBoundingClientRect(), fr = f.getBoundingClientRect(), pr = p.getBoundingClientRect();
        const inFooter = f.contains(a);
        const hidden = !inFooter && ar.bottom > fr.top + 1 && ar.top < fr.bottom;
        return { el: a.tagName + (a.name ? '[' + a.name + (a.value && a.type === 'radio' ? '=' + a.value : '') + ']' : '') + (a.textContent ? ' ' + a.textContent.trim().slice(0, 10) : ''), top: Math.round(ar.top), bottom: Math.round(ar.bottom), footerTop: Math.round(fr.top), panelBottom: Math.round(pr.bottom), scrollTop: Math.round(p.scrollTop), inFooter, hiddenBehindFooter: hidden, outOfView: ar.bottom > pr.bottom || ar.top < pr.top };
      });
      console.log(JSON.stringify(r));
      await page.keyboard.press('Tab');
      await sleep(250);
    }
    await ctx.close();
  } catch (e) { console.error('FAILED', e.message.split('\n')[0]); }
  finally { await browser.close(); }
})();
