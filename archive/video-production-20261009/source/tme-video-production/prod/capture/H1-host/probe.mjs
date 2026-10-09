// exploration (real time, not recorded): walk the host side of the filmed build and screenshot every state
import { chromium } from '/tmp/space-video-prep/tools/node_modules/playwright-core/index.mjs';
import fs from 'node:fs';
const BASE = process.env.SPACE_BASE || 'http://127.0.0.1:47911/musicSpace/';
const OUT = '/tmp/space-video-doodle/prod/capture/H1-host/probe';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--lang=zh-CN', '--use-angle=metal', '--enable-gpu', '--hide-scrollbars', '--force-color-profile=srgb'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 845 }, deviceScaleFactor: 36 / 13, isMobile: true, hasTouch: true, locale: 'zh-CN', timezoneId: 'Asia/Shanghai' });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 200)));
let n = 0;
const shot = async name => { n++; const f = `${OUT}/${String(n).padStart(2, '0')}-${name}.png`; await page.screenshot({ path: f }); console.log('shot', f); };
const vis = async sel => page.locator(sel).first().isVisible().catch(() => false);
const click = async (sel, text) => { const l = text ? page.locator(sel, { hasText: text }).first() : page.locator(sel).first(); await l.scrollIntoViewIfNeeded(); await l.click(); await page.waitForTimeout(700); };
const texts = async sel => page.evaluate(s => [...document.querySelectorAll(s)].filter(e => e.getClientRects().length).map(e => (e.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 80)), sel);
try {
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 60000 });
  await page.waitForTimeout(2500);
  await shot('landing');
  await click('#join');
  await page.waitForTimeout(800);
  await shot('entry');
  console.log('entry buttons', await texts('#panel button, #panel summary'));
  // fill nickname, tick consent, enter
  const name = page.locator('form[data-form="demo-entry"] input[name=name]');
  if (await name.count()) { await name.fill('阿宁'); }
  await page.locator('form[data-form="demo-entry"] input[name=consent]').check({ force: true });
  await click('form[data-form="demo-entry"] button[type=submit]');
  await page.waitForTimeout(3000);
  await shot('room');
  // room panel
  await click('#scene-details');
  await page.waitForTimeout(800);
  await shot('room-panel');
  console.log('room panel buttons', await texts('#panel button, #panel summary'));
  fs.writeFileSync(`${OUT}/room-panel.html`, await page.evaluate(() => document.querySelector('#panel').innerHTML));
  // ---- the long-term community: create one named after the venue, open it
  await click('#panel [data-open="communities"]');
  await page.waitForTimeout(900);
  await shot('communities');
  console.log('community panel', await texts('.community-panel button, .community-panel label, .community-panel p'));
  await page.locator('form[data-community-create] input[name=title]').fill('月台 Livehouse');
  await page.locator('form[data-community-create] input[name=consent]').check({ force: true });
  await click('form[data-community-create] button[type=submit]');
  await page.waitForTimeout(1500);
  await shot('community-created');
  await click('.music-community .entry-list button', '月台 Livehouse');
  await page.waitForTimeout(1500);
  await shot('community-room');
  console.log('community room', await texts('.community-panel button, .community-panel h2, .community-panel p'));
  fs.writeFileSync(`${OUT}/community-room.html`, await page.evaluate(() => [...document.querySelectorAll('.community-panel')].map(e => e.className + '\n' + e.innerHTML).join('\n=========\n')));
  console.log('summaries', await texts('.community-panel summary, .community-panel details'));
  const sum = page.locator('.community-panel summary', { hasText: '本场与管理' }).first();
  if (await sum.count()) { await sum.click(); await page.waitForTimeout(700); await shot('community-menu'); }
  // ---- 空间与活动
  await click('.community-panel [data-group-space]');
  await page.waitForTimeout(1500);
  await shot('space');
  console.log('space', await texts('.space-management button, .space-management summary, .space-management h2, .space-management h3, .space-management p'));
  await click('.space-management summary', '发布新的活动预告');
  await page.waitForTimeout(600);
  await shot('space-event-form');
  const f = 'form[data-organization="event"]';
  await page.locator(`${f} input[name=title]`).fill('周六 · 月台夜');
  await page.locator(`${f} input[name=venue]`).fill('月台 Livehouse');
  await page.locator(`${f} input[name=startsAt]`).fill('2026-10-17T20:00');
  await page.locator(`${f} input[name=note]`).fill('散场别走，我们下一场见。');
  await page.locator(`${f} input[name=consent]`).check({ force: true });
  await shot('space-event-filled');
  await click(`${f} button`);
  await page.waitForTimeout(2000);
  await shot('space-event-published');
  console.log('space after', await texts('.space-management article, .space-management button'));
  fs.writeFileSync(`${OUT}/space.html`, await page.evaluate(() => document.querySelector('.space-management').outerHTML));
  // ---- open a room for this event
  await click('.space-management [data-event-start]');
  await page.waitForTimeout(1500);
  await shot('create-for-event');
  console.log('create', await texts('#panel label, #panel h2, #panel p, #panel button'));
  fs.writeFileSync(`${OUT}/create.html`, await page.evaluate(() => document.querySelector('#panel').innerHTML));
  // submit the create form (prefilled from the event): consent + submit
  await page.locator('form[data-form="create"] input[name=consent]').check({ force: true });
  await click('form[data-form="create"] button[type=submit]');
  await page.waitForTimeout(4000);
  await shot('new-room');
  console.log('after create: panel hidden?', await page.evaluate(() => document.querySelector('#panel').hidden), 'title', await page.evaluate(() => document.querySelector('#room-title')?.textContent));
  // open the room panel and its chat
  await click('#scene-details'); await page.waitForTimeout(900);
  await shot('new-room-panel');
  console.log('new room panel', await texts('#panel button, #panel summary, #panel h2, #panel small'));
  const conv = page.locator('#panel [data-open="conversation"]').first();
  if (await conv.count()) { await conv.click(); await page.waitForTimeout(1500); await shot('new-room-chat');
    console.log('room chat', await texts('.community-panel button, .community-panel summary, .community-panel label, .community-panel h2'));
    const sum = page.locator('.community-panel summary', { hasText: '本场与管理' }).first();
    if (await sum.count()) { await sum.click(); await page.waitForTimeout(700); await shot('new-room-chat-menu'); }
    fs.writeFileSync(`${OUT}/room-chat.html`, await page.evaluate(() => [...document.querySelectorAll('.community-panel')].map(e => e.className + '\n' + e.innerHTML).join('\n=====\n')));
  }
} catch (e) { console.error('FAILED', e); await shot('fail'); }
await browser.close();
