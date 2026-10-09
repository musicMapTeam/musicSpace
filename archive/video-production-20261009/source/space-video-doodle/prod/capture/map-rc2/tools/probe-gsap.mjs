// probe: is GSAP reachable from the page (globalTimeline timeScale for a slowed product camera move)? desktop layout screenshots too.
import { chromium } from '/tmp/space-video-prep/tools/node_modules/playwright-core/index.mjs';
import fs from 'node:fs';
const BASE = process.env.SPACE_BASE || 'http://127.0.0.1:48613/musicSpace/';
const OUT = `/tmp/space-video-doodle/prod/capture/map-rc2/probe/gsap`;
fs.mkdirSync(OUT, { recursive: true });
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--lang=zh-CN', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--hide-scrollbars', '--force-color-profile=srgb'] });
for (const mode of ['desktop', 'phone']) {
  const V = mode === 'phone' ? { viewport: { width: 390, height: 845 }, deviceScaleFactor: 36 / 13, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 810 }, deviceScaleFactor: 8 / 3, isMobile: false, hasTouch: false };
  const ctx = await browser.newContext({ ...V, locale: 'zh-CN', timezoneId: 'Asia/Shanghai' });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 200)));
  await page.goto(BASE + 'music-map/#/home', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  console.log(mode, 'globals', await page.evaluate(() => Object.keys(window).filter(k => /gsap|tween|timeline|three|scene/i.test(k))));
  console.log(mode, 'gsap', await page.evaluate(() => typeof window.gsap === 'object' || typeof window.gsap === 'function' ? { v: window.gsap.version, ts: window.gsap.globalTimeline?.timeScale?.() } : null));
  console.log(mode, 'canvas', await page.evaluate(() => [...document.querySelectorAll('canvas')].map(c => { const r = c.getBoundingClientRect(); return [c.width, c.height, Math.round(r.width), Math.round(r.height), Math.round(r.x), Math.round(r.y)]; })));
  await page.screenshot({ path: `${OUT}/${mode}-home.png` });
  console.log(mode, 'home texts', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('h1,h2,h3,p,button,a,summary,label')].filter(e => e.getClientRects().length).map(e => (e.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 60)).filter(Boolean))));
  const t = Date.now();
  await page.evaluate(() => { location.hash = '#/explore'; });
  await page.waitForTimeout(400); await page.screenshot({ path: `${OUT}/${mode}-explore-t400.png` });
  await page.waitForTimeout(1600); await page.screenshot({ path: `${OUT}/${mode}-explore-t2000.png` });
  console.log(mode, 'explore texts', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('h1,h2,h3,button,summary')].filter(e => e.getClientRects().length).map(e => (e.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 60)).filter(Boolean))).slice(0, 2500));
  await page.evaluate(() => { location.hash = '#/records'; });
  await page.waitForTimeout(2000); await page.screenshot({ path: `${OUT}/${mode}-records.png` });
  await ctx.close();
}
await browser.close();
