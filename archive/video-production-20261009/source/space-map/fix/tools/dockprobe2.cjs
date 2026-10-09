const { launch, MAP } = require('./lib.cjs');
(async () => {
  const browser = await launch();
  for (const [w, h] of [[390, 844], [375, 667], [360, 740]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto(MAP, { waitUntil: 'load' }); await page.waitForTimeout(2500);
    await page.locator('[data-home-start="real-jay"]').tap(); await page.waitForTimeout(3000);
    await page.addStyleTag({ content: '.map-roam-bar .map-roam-bar__long{display:inline!important}' }); await page.waitForTimeout(300);
    const r = await page.evaluate(() => [...document.querySelector('.map-roam-bar').children].filter(e => e.checkVisibility()).map(e => { const b = e.getBoundingClientRect(); const s = getComputedStyle(e); return `${e.innerText.replace(/\s+/g, '')}:${Math.round(b.width)} sw${e.scrollWidth}/cw${e.clientWidth} fs${s.fontSize} pad${s.padding} dir${s.flexDirection}`; }));
    console.log(w, r.join(' | '));
    await ctx.close();
  }
  await browser.close();
})();
