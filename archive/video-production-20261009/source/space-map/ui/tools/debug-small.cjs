const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto('http://127.0.0.1:5296/', { waitUntil: 'load' }); await page.waitForTimeout(4000);
  await page.locator('[data-open-catalogue]').first().click(); await page.waitForTimeout(800);
  const out = await page.evaluate(() => [...document.querySelectorAll('button,a,summary,input,select,[role=button]')].filter(el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && (r.width < 44 || r.height < 44) && r.bottom > 0 && r.top < innerHeight; }).map(el => `${el.tagName}.${el.className} [${el.getAttribute('role')}] ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)} ${el.outerHTML.slice(0, 120)}`));
  console.log(out.join('\n'));
  await page.goto('http://127.0.0.1:5296/#/explore', { waitUntil: 'load' }); await page.waitForTimeout(4000);
  const out2 = await page.evaluate(() => [...document.querySelectorAll('button,a,summary,input,select,[role=button]')].filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.width < 20) && r.height > 200; }).map(el => `${el.tagName}.${el.className} ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)} ${el.outerHTML.slice(0, 160)}`));
  console.log(out2.join('\n'));
  await browser.close();
})();
