const {chromium} = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  for (const block of [false, true]) {
    const ctx = await browser.newContext({viewport: {width: 1440, height: 900}, javaScriptEnabled: false});
    const page = await ctx.newPage();
    if (block) await page.route(/\.woff2$/, r => r.abort());
    await page.goto(process.argv[2], {waitUntil: 'load'}); await page.waitForTimeout(2000);
    const m = await page.evaluate(() => {
      const h = document.querySelector('.desktop-caption h2'); const cs = getComputedStyle(h);
      document.querySelectorAll(".desktop-caption .caption-line").forEach(s => s.style.whiteSpace = "nowrap"); const lines = [...h.querySelectorAll('.caption-line')].map(s => { const r = s.getBoundingClientRect(); const range = document.createRange(); range.selectNodeContents(s); const rr = range.getBoundingClientRect(); return [s.textContent, Math.round(rr.width), Math.round(r.height), getComputedStyle(s).display, getComputedStyle(s).whiteSpace]; });
      const cap = document.querySelector('.desktop-caption').getBoundingClientRect();
      return {font: cs.fontSize + ' ' + cs.fontFamily.slice(0, 40), h2: [Math.round(h.getBoundingClientRect().width), Math.round(h.getBoundingClientRect().height)], caption: [Math.round(cap.left), Math.round(cap.top), Math.round(cap.width), Math.round(cap.height)], lines};
    });
    console.log(block ? 'FALLBACK (woff2 blocked)' : 'DOODLE FONTS', JSON.stringify(m));
    await ctx.close();
  }
  await browser.close();
})();
