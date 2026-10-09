// Where is the 「唱片店」 pin? BASE=.. [PAPER=1] VP=320x568 node pin.cjs
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--enable-gpu'] });
  for (const vp of (process.env.VPS || '320x568,360x640,375x667,390x844,1440x900,1280x720').split(',')) {
    const [w, h] = vp.split('x').map(Number); const phone = w < 700;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: phone, hasTouch: phone });
    if (process.env.PAPER) await ctx.addInitScript(() => { const apply = () => document.documentElement?.style.setProperty('--ds-paper', '#f7efdf'); apply(); document.addEventListener('readystatechange', apply); });
    const page = await ctx.newPage();
    await page.goto(process.env.BASE + '#/home'); await page.waitForSelector('canvas.sakura-scene__canvas'); await page.waitForTimeout(3000);
    const r = await page.evaluate(() => { const pin = document.querySelector('.world-pin'); const b = pin.getBoundingClientRect(); return { hidden: pin.hidden, box: [b.left, b.top, b.width, b.height].map(Math.round) }; });
    console.log(vp, JSON.stringify(r));
    if (process.env.SHOT) await page.screenshot({ path: `/tmp/space-map/shots/3d-detail3/pin-${process.env.PAPER ? 'paper' : 'night'}-${vp}.png` });
    await ctx.close();
  }
  await browser.close();
})();
