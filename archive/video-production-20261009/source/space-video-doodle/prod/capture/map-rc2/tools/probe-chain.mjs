// probe (real time): the whole 寻声 chain 费玉清 -> 周杰伦 -> 林俊杰 -> 邓紫棋 on the rc2 map, screenshots + texts at each step.
//   node probe-chain.mjs [phone|desktop]
import { chromium } from '/tmp/space-video-prep/tools/node_modules/playwright-core/index.mjs';
import fs from 'node:fs';
const BASE = process.env.SPACE_BASE || 'http://127.0.0.1:48613/musicSpace/';
const MODE = process.argv[2] || 'phone';
const OUT = `/tmp/space-video-doodle/prod/capture/map-rc2/probe/chain-${MODE}`;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
fs.mkdirSync(OUT, { recursive: true });
const V = MODE === 'phone' ? { viewport: { width: 390, height: 845 }, deviceScaleFactor: 36 / 13, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 810 }, deviceScaleFactor: 4 / 3, isMobile: false, hasTouch: false };
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--lang=zh-CN', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--hide-scrollbars', '--force-color-profile=srgb'] });
const ctx = await browser.newContext({ ...V, locale: 'zh-CN', timezoneId: 'Asia/Shanghai' });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 200)));
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[console ${m.type()}]`, m.text().slice(0, 200)); });
let n = 0;
const shot = async name => { n++; const f = `${OUT}/${String(n).padStart(2, '0')}-${name}.png`; await page.screenshot({ path: f }); console.log('shot', f); };
const texts = async sel => page.evaluate(s => [...document.querySelectorAll(s)].filter(e => e.getClientRects().length).map(e => (e.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 160)), sel);
const bad = async () => page.evaluate(() => { const t = document.body.innerText; const out = []; for (const w of ['示例', '虚构', '本页']) { let i = -1; while ((i = t.indexOf(w, i + 1)) >= 0) out.push(w + ': …' + t.slice(Math.max(0, i - 30), i + 30).replace(/\s+/g, ' ') + '…'); } return out; });
const wait = ms => page.waitForTimeout(ms);
const cardIndex = async title => page.evaluate(t => [...document.querySelectorAll('.map-round-hand__cards > li.map-round-card')].findIndex(li => (li.querySelector('.map-round-card__title')?.textContent || '').includes(t)), title);
async function flipAndGo(title) {
  const i = await cardIndex(title);
  console.log('card', title, 'index', i);
  const li = page.locator('.map-round-hand__cards > li.map-round-card').nth(i);
  await li.scrollIntoViewIfNeeded();
  await wait(400);
  await shot(`hand-before-${title.slice(0, 4)}`);
  await li.locator('[data-map-action="flip"]').click();
  await wait(1200); await shot(`flipped-${title.slice(0, 4)}`);
  console.log('card text', (await li.innerText()).replace(/\s+/g, ' '));
  console.log('toast', await page.evaluate(() => document.querySelector('#toast')?.textContent));
  const go = li.locator('[data-map-action="move"]');
  await go.click();
  await wait(300); await shot(`go-t300-${title.slice(0, 4)}`);
  await wait(1500); await shot(`go-t1800-${title.slice(0, 4)}`);
  console.log('toast', await page.evaluate(() => document.querySelector('#toast')?.textContent));
  console.log('slip', await texts('.map-round-slip'));
  console.log('hand', await texts('.map-round-hand__who, .map-round-card__title'));
  console.log('bad', await bad());
}
try {
  await page.goto(BASE + 'music-map/#/explore', { waitUntil: 'load' });
  await wait(2500);
  await shot('start');
  await flipAndGo('千里之外');
  await flipAndGo('稻香');
  await flipAndGo('手心的蔷薇');
  for (const ms of [500, 1000, 1500, 2000, 3000, 4000, 6000]) { await wait(ms - (ms === 500 ? 0 : [500, 1000, 1500, 2000, 3000, 4000, 6000][[500, 1000, 1500, 2000, 3000, 4000, 6000].indexOf(ms) - 1])); await shot(`arrive-t${ms}`); }
  console.log('after arrive', JSON.stringify(await texts('.map-panel, [role=dialog], .map-round-hand--closed, .map-round-slip')).slice(0, 3000));
  console.log('bad', await bad());
  fs.writeFileSync(`${OUT}/arrive.html`, await page.evaluate(() => document.querySelector('#main-content').innerHTML.slice(0, 60000)));
  const save = page.locator('[data-map-action="save"]').first();
  if (await save.count()) { console.log('save label', await save.getAttribute('aria-label')); await save.click(); await wait(900); await shot('saved'); console.log('toast', await page.evaluate(() => document.querySelector('#toast')?.textContent)); }
} catch (e) { console.error('FAILED', e); await shot('fail'); }
await browser.close();
