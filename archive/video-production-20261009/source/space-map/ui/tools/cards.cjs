// Draw both PNG keepsakes on the dev server and save them: node cards.cjs <base> <outdir>
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const [BASE, OUT] = process.argv.slice(2);
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  const click = async sel => { const el = page.locator(sel).first(); await el.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {}); await el.click({ timeout: 5000 }); };
  const grab = async name => {
    await page.waitForSelector('.share-card-export img', { timeout: 15000 });
    await page.waitForTimeout(500);
    const data = await page.evaluate(async () => { const img = document.querySelector('.share-card-export img'); const r = await fetch(img.src); const b = await r.blob(); return await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); }); });
    fs.writeFileSync(`${OUT}/${name}.png`, Buffer.from(data.split(',')[1], 'base64'));
    await page.screenshot({ path: `${OUT}/${name}-preview.png` });
  };
  await page.goto(BASE + '#/explore', { waitUntil: 'load' }); await page.waitForTimeout(4000);
  await click('[data-map-action="flip"]'); await click('.map-round-card.is-open [data-map-action="move"]');
  await page.evaluate(() => { const d = document.querySelector('.map-shop-menu'); if (d) d.open = true; });
  await click('[data-map-action="reveal"]'); await click('[data-map-action="reveal-confirm"]');
  await page.waitForTimeout(1200);
  await click('.map-dialog [data-map-action="close"]').catch(() => {});
  await click('.map-round-hand--closed [data-map-action="save-card"]');
  await grab('challenge-card');
  await page.keyboard.press('Escape');
  await page.goto(BASE + '#/home', { waitUntil: 'load' }); await page.waitForTimeout(3000);
  await click('[data-home-start]'); await page.waitForTimeout(1500);
  await click('.map-network-index > summary'); await click('.map-network-connection'); await click('.map-dialog [data-map-action="save"]'); await click('.map-dialog [data-map-action="move"]');
  await page.waitForTimeout(800);
  await click('.map-roam-bar [data-map-action="recap"]'); await page.waitForTimeout(600);
  await click('.map-dialog [data-map-action="save-discovery"]');
  await grab('discovery-card');
  console.log(errors.length ? errors.join('|') : 'no errors');
  await browser.close();
})();
