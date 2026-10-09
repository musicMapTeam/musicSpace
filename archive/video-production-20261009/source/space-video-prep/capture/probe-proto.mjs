// one-off: load a static site, dump console + what is on screen, save a screenshot.  usage: node probe-proto.mjs <url> <out.png>
import { chromium } from '/tmp/space-video-prep/tools/node_modules/playwright-core/index.mjs';
const [url, out = '/tmp/space-video-prep/stills/proto-probe.png'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 744 }, deviceScaleFactor: 1, locale: 'zh-CN' });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(m.type() + ': ' + m.text().slice(0, 200)); });
page.on('pageerror', e => logs.push('pageerror: ' + String(e).slice(0, 300)));
page.on('requestfailed', r => logs.push('requestfailed: ' + r.url().slice(0, 150)));
const t0 = Date.now();
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(6000);
const info = await page.evaluate(() => ({
  title: document.title, boot: window.__SPACE_BOOT__, status: document.querySelector('#render-status')?.innerText,
  buttons: [...document.querySelectorAll('button')].filter(b => b.offsetParent).map(b => (b.innerText || b.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ')).filter(Boolean).slice(0, 40),
  presence: document.querySelector('.presence')?.innerText?.replace(/\s+/g, ' ').slice(0, 300),
  webgl: !!document.querySelector('canvas'),
}));
console.log(JSON.stringify(info, null, 1)); console.log('logs:', logs.slice(0, 15)); console.log('loaded in', Date.now() - t0, 'ms');
await page.screenshot({ path: out });
await browser.close();
