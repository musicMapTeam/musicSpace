// Quick multi-state check on the dev server: node quick.cjs <base> <outdir> <views>
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const [BASE, OUT, which = 'phone,desktop'] = process.argv.slice(2);
const views = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, desktop: { viewport: { width: 1440, height: 900 } }, w320: { viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } };
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--enable-gpu'] });
  for (const v of which.split(',')) {
    const context = await browser.newContext(views[v]);
    const page = await context.newPage();
    const errors = []; page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
    const shot = async name => { await page.waitForTimeout(900); await page.screenshot({ path: `${OUT}/${v}-${name}.png` }); };
    const click = async sel => { const el = page.locator(sel).first(); await el.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {}); await el.click({ timeout: 5000 }); };
    await page.goto(BASE, { waitUntil: 'load' }); await page.waitForTimeout(5000); await shot('home');
    await click('#demo-help'); await shot('about');
    await page.evaluate(() => document.querySelector('#about-sources')?.scrollIntoView()); await shot('about-sources');
    await page.keyboard.press('Escape');
    await click('[data-open-catalogue]'); await shot('catalogue');
    await page.keyboard.press('Escape');
    await page.goto(BASE + '#/explore', { waitUntil: 'load' }); await page.waitForTimeout(4500);
    await click('[data-map-action="flip"]'); await shot('flip');
    await click('.map-round-card.is-open [data-map-action="edge"]'); await shot('sources');
    await page.evaluate(() => { const d = document.querySelector('.map-dialog'); if (d) d.scrollTop = d.scrollHeight; }); await shot('sources-end');
    console.log(v, errors.length ? errors.join(' | ') : 'no errors');
    await context.close();
  }
  await browser.close();
})();
