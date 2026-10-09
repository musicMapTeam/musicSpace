// The rescue overlay is only in built pages: inject the same script into the dev page and raise it.
import { rescueScript } from '/Users/alakazan/workplace/tme/musicSpace/scripts/build/static-html-plugin.mjs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
for (const [view, opts] of [['phone', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }], ['desktop', { viewport: { width: 1440, height: 900 } }]]) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:5190/');
  await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  await page.addScriptTag({ content: rescueScript() });
  await page.evaluate(() => { window.__SPACE_BOOT__ = 'booting'; window.__SPACE_RESCUE__.show('failed:SHOWCASE_STALE'); });
  await sleep(600);
  await page.screenshot({ path: `/tmp/space-doodle/shots/showcase/${process.argv[2] || 'after'}-rescue-${view}.png` });
  await ctx.close();
}
await browser.close();
console.log('rescue shots done');
