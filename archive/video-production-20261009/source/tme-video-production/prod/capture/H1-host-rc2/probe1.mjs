// probe 1 (real time, not recorded): landing + entry panel + host create sheet on the rc2 build; dumps texts and screenshots.
import { chromium } from '/tmp/space-video-prep/tools/node_modules/playwright-core/index.mjs';
import fs from 'node:fs';
const BASE = process.env.SPACE_BASE || 'http://127.0.0.1:48613/musicSpace/';
const OUT = '/tmp/space-video-doodle/prod/capture/H1-host-rc2/probe';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--lang=zh-CN', '--use-angle=metal', '--enable-gpu', '--hide-scrollbars', '--force-color-profile=srgb'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 845 }, deviceScaleFactor: 36 / 13, isMobile: true, hasTouch: true, locale: 'zh-CN', timezoneId: 'Asia/Shanghai' });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 200)));
let n = 0;
const shot = async name => { n++; const f = `${OUT}/p1-${String(n).padStart(2, '0')}-${name}.png`; await page.screenshot({ path: f }); console.log('shot', f); };
const texts = async sel => page.evaluate(s => [...document.querySelectorAll(s)].filter(e => e.getClientRects().length).map(e => (e.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 100)), sel);
const bad = async () => page.evaluate(() => { const t = document.body.innerText; return ['示例', '虚构', '本页'].filter(w => t.includes(w)).map(w => { const i = t.indexOf(w); return w + ': …' + t.slice(Math.max(0, i - 30), i + 30).replace(/\s+/g, ' ') + '…'; }); });
try {
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 60000 });
  await page.waitForTimeout(2500);
  await shot('landing');
  console.log('landing buttons', await texts('button, summary, a'));
  console.log('landing bad', await bad());
  await page.locator('#join').click(); await page.waitForTimeout(900);
  await shot('entry');
  console.log('entry texts', await texts('#panel h2, #panel p, #panel label, #panel button, #panel summary'));
  console.log('entry bad', await bad());
  fs.writeFileSync(`${OUT}/p1-entry.html`, await page.evaluate(() => document.querySelector('#panel').innerHTML));
  const det = page.locator('#panel details summary').first();
  if (await det.count()) { await det.scrollIntoViewIfNeeded(); await det.click(); await page.waitForTimeout(600); await shot('entry-details'); console.log('details', await texts('#panel details')); }
  const cb = page.locator('#panel details button[data-open="create"]').first();
  if (await cb.count()) { await cb.scrollIntoViewIfNeeded(); await cb.click(); await page.waitForTimeout(900); await shot('create'); console.log('create texts', await texts('#panel h2, #panel p, #panel label, #panel button, #panel small, #panel .eyebrow, #panel legend'));
    fs.writeFileSync(`${OUT}/p1-create.html`, await page.evaluate(() => document.querySelector('#panel').innerHTML));
    console.log('create bad', await bad());
    await page.evaluate(() => { const p = document.querySelector('#panel'); p.scrollTop = p.scrollHeight; }); await page.waitForTimeout(400); await shot('create-bottom');
  }
} catch (e) { console.error('FAILED', e); await shot('fail'); }
await browser.close();
