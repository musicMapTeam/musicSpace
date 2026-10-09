// Element close-ups at 3x: node zoom.js <prefix> [port]
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const [, , PREFIX = 'zoom', PORT = '5190', W = '390'] = process.argv;
const URL = `http://127.0.0.1:${PORT}/`;
const OUT = '/tmp/space-doodle/shots/showcase';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const ctx = await browser.newContext({ viewport: { width: +W, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(URL);
  await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 60000 });
  await page.evaluate(() => document.fonts.ready); await sleep(800);
  await page.locator('.frame > footer').screenshot({ path: `${OUT}/${PREFIX}-footer-${W}.png` });
  await page.locator('.presence').screenshot({ path: `${OUT}/${PREFIX}-lobby-presence-${W}.png` });
  await page.locator('#join').click();
  await page.waitForSelector("form[data-form='demo-entry']");
  await page.locator("form[data-form='demo-entry'] input[name=consent]").check();
  await page.locator("form[data-form='demo-entry'] button[type=submit]").click();
  await page.waitForSelector(".frame[data-stage='room']", { timeout: 30000 });
  await sleep(800);
  if (await page.locator('#panel-close').isVisible()) await page.locator('#panel-close').click();
  await page.waitForSelector('#demo-tour:not([hidden])'); await sleep(900);
  const box = await page.locator('#demo-tour').boundingBox();
  await page.screenshot({ path: `${OUT}/${PREFIX}-tour-${W}.png`, clip: { x: Math.max(0, box.x - 14), y: box.y - 18, width: Math.min(+W - Math.max(0, box.x - 14), box.width + 28), height: box.height + 30 } });
  console.log('done');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
