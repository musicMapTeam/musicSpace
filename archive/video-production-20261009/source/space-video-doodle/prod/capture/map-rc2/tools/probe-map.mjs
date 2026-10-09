// probe (real time, not recorded): room -> 音乐探索 -> the record-table round on the rc2 build; screenshots + DOM text dumps.
//   node probe-map.mjs [phone|desktop]
import { chromium } from '/tmp/space-video-prep/tools/node_modules/playwright-core/index.mjs';
import fs from 'node:fs';
const BASE = process.env.SPACE_BASE || 'http://127.0.0.1:48613/musicSpace/';
const MODE = process.argv[2] || 'phone';
const OUT = `/tmp/space-video-doodle/prod/capture/map-rc2/probe/${MODE}`;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
fs.mkdirSync(OUT, { recursive: true });
const V = MODE === 'phone' ? { viewport: { width: 390, height: 845 }, deviceScaleFactor: 36 / 13, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 810 }, deviceScaleFactor: 4 / 3, isMobile: false, hasTouch: false };
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--lang=zh-CN', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--hide-scrollbars', '--force-color-profile=srgb'] });
const ctx = await browser.newContext({ ...V, locale: 'zh-CN', timezoneId: 'Asia/Shanghai' });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 200)));
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[console ${m.type()}]`, m.text().slice(0, 200)); });
page.on('framenavigated', f => { if (f === page.mainFrame()) console.log('[nav]', f.url()); });
let n = 0;
const shot = async name => { n++; const f = `${OUT}/${String(n).padStart(2, '0')}-${name}.png`; await page.screenshot({ path: f }); console.log('shot', f); };
const texts = async sel => page.evaluate(s => [...document.querySelectorAll(s)].filter(e => e.getClientRects().length).map(e => (e.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 140)), sel);
const bad = async () => page.evaluate(() => { const t = document.body.innerText; const out = []; for (const w of ['示例', '虚构', '本页']) { let i = -1; while ((i = t.indexOf(w, i + 1)) >= 0) out.push(w + ': …' + t.slice(Math.max(0, i - 30), i + 30).replace(/\s+/g, ' ') + '…'); } return out; });
const wait = ms => page.waitForTimeout(ms);
try {
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 60000 });
  await wait(2500);
  await page.locator('#join').click(); await wait(900);
  await page.locator('form[data-form="demo-entry"] input[name=consent]').check({ force: true });
  await page.locator('form[data-form="demo-entry"] button[type=submit]').click();
  await page.waitForFunction(() => document.querySelector('#panel')?.hidden, null, { timeout: 30000 });
  await wait(3000);
  await shot('room');
  console.log('room bad', await bad());
  console.log('header', await texts('.frame > header button, .frame > header a'));
  const t0 = Date.now();
  await page.locator('#music-map-entry').click();
  await page.waitForURL(/music-map/, { timeout: 30000 });
  console.log('nav after', Date.now() - t0, 'ms');
  { let prev = 0; for (const ms of [300, 700, 1200, 2000, 3500, 6000]) { await wait(ms - prev); prev = ms; await shot(`map-t${ms}`); } }
  console.log('map url', page.url());
  console.log('map bad', await bad());
  console.log('map texts', JSON.stringify(await texts('h1, h2, h3, .map-round-slip, .map-round-hand, .map-round-card, button, summary, .map-round-note, .eyebrow'), null, 0).slice(0, 4000));
  fs.writeFileSync(`${OUT}/map-body.html`, await page.evaluate(() => document.body.innerHTML));
  console.log('canvas', await page.evaluate(() => [...document.querySelectorAll('canvas')].map(c => [c.width, c.height, c.className, getComputedStyle(c).display])));
  console.log('state view', await page.evaluate(() => location.hash));
  // flip the first sealed card
  const flip = page.locator('[data-map-action="flip"]').first();
  if (await flip.count()) {
    console.log('flip label', await flip.getAttribute('aria-label'));
    await flip.click(); await wait(400); await shot('flip-t400'); await wait(1200); await shot('flip-t1600');
    console.log('cards after flip', await texts('.map-round-card'));
    console.log('bad', await bad());
  }
  const src = page.locator('.map-round-card [data-map-action="edge"]').first();
  if (await src.count()) {
    await src.click(); await wait(500); await shot('sources-t500'); await wait(1200); await shot('sources-t1700');
    console.log('sources paper', await texts('.map-panel, .map-sources, [role=dialog]'));
    fs.writeFileSync(`${OUT}/sources.html`, await page.evaluate(() => (document.querySelector('.map-panel') || document.querySelector('[role=dialog]') || document.body).outerHTML.slice(0, 40000)));
    console.log('bad', await bad());
    const close = page.locator('[data-map-action="close"]').first();
    if (await close.count()) { await close.click(); await wait(800); await shot('sources-closed'); }
  }
  const go = page.locator('.map-round-card [data-map-action="move"]').first();
  if (await go.count()) {
    console.log('move label', await go.getAttribute('aria-label'));
    await go.click(); { let prev = 0; for (const ms of [300, 800, 1600, 3000]) { await wait(ms - prev); prev = ms; await shot(`move-t${ms}`); } }
    console.log('after move', JSON.stringify(await texts('.map-round-slip, .map-round-hand__who, .map-round-card, .map-round-note')).slice(0, 3000));
    console.log('bad', await bad());
  }
  // the courtyard
  await page.evaluate(() => { location.hash = '#/home'; });
  await wait(2500); await shot('home-t2500'); await wait(3000); await shot('home-t5500');
  console.log('home texts', JSON.stringify(await texts('h1, h2, h3, button, a, summary')).slice(0, 3000));
  console.log('home bad', await bad());
  fs.writeFileSync(`${OUT}/home-body.html`, await page.evaluate(() => document.body.innerHTML));
} catch (e) { console.error('FAILED', e); await shot('fail'); }
await browser.close();
