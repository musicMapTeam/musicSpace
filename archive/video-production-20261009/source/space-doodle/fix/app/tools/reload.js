// Independent reproduction: judge route -> accepted exchange -> 回看这一晚 -> reload; read tour card, storage and wall.
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const ORIGIN = process.env.ORIGIN || 'http://127.0.0.1:5190/';
const vp = process.argv[2] || 'desktop';
const OUT = process.env.OUT || '/tmp/space-doodle/fix/app/route'; const TAG = process.env.TAG || 'dev';
const VPS = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, desktop: { viewport: { width: 1440, height: 900 } } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const context = await browser.newContext({ ...VPS[vp], locale: 'zh-CN' });
  const page = await context.newPage();
  page.setDefaultTimeout(45000);
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  const tap = async sel => { const l = page.locator(sel).first(); await l.waitFor({ state: 'visible' }); if (vp === 'phone') await l.tap(); else await l.click(); };
  const tour = () => page.evaluate(() => { const t = document.querySelector('#demo-tour'); if (!t) return 'no card'; const title = t.querySelector('.demo-tour-title')?.textContent.replace(/\s+/g, ' ').trim(); const dots = [...t.querySelectorAll('.demo-tour-bar i')].map(i => i.classList.contains('on') ? '●' : '○').join(''); const acts = [...t.querySelectorAll('[data-tour-action]')].map(b => b.dataset.tourAction + '=' + b.textContent.trim()); return `${t.hidden ? '(hidden) ' : ''}${title} [${dots}] ${acts.join(' | ')}`; });
  const shot = async n => page.screenshot({ path: `${OUT}/${TAG}-${vp}-${n}.png` });
  const wallInfo = () => page.evaluate(() => ({ kind: document.querySelector('#panel')?.dataset.kind, hidden: document.querySelector('#panel')?.hidden, offers: [...document.querySelectorAll('#panel [data-exchange-offer]')].map(b => b.dataset.exchangeOffer.slice(0, 8) + ':' + b.textContent.trim()), exchangedTags: [...document.querySelectorAll('#panel [data-moment-exchanged]')].map(n => n.textContent.trim()), badge: document.querySelector('#panel [data-moment-badge]')?.innerText.replace(/\s+/g, ' ').slice(0, 160) }));
  const log = (k, v) => console.log(`[${TAG} ${vp}] ${k}:`, typeof v === 'string' ? v : JSON.stringify(v));
  try {
    await page.goto(ORIGIN, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
    await tap('#join');
    await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"] button[type="submit"]')?.disabled, null, { timeout: 60000 });
    await page.check('form[data-form="demo-entry"] input[name="consent"]');
    await tap('form[data-form="demo-entry"] button[type="submit"]');
    await page.waitForFunction(() => document.querySelector('.frame')?.dataset.stage === 'room', null, { timeout: 30000 });
    await sleep(800);
    log('room', await tour());
    await tap('[data-tour-action="sample:sample-crowd"]');
    await page.waitForFunction(() => /^(sure|unsure|off)/.test(document.querySelector('form[data-form="upload"] [data-ai-line]')?.getAttribute('data-ai-key') || ''), null, { timeout: 90000 }).catch(() => log('ai', 'timeout'));
    await tap('form[data-form="upload"] button[type="submit"]');
    await page.locator('[data-moment-badge] [data-exchange-offer]').first().waitFor({ state: 'visible', timeout: 30000 });
    await sleep(800);
    log('wall before exchange', await wallInfo());
    await tap('[data-moment-badge] [data-exchange-offer]');
    await page.locator('.photo-exchanges [data-x-consent]').waitFor({ state: 'attached' });
    await page.locator('.photo-exchanges [data-x-consent]').check();
    await page.waitForFunction(() => !document.querySelector('.photo-exchanges [data-x-send]')?.disabled, null, { timeout: 30000 });
    await tap('.photo-exchanges [data-x-send]');
    await page.waitForFunction(() => /交换已接受/.test(document.querySelector('.photo-exchanges .exchange-status')?.textContent || ''), null, { timeout: 60000 });
    log('accepted', await page.evaluate(() => document.querySelector('.photo-exchanges .exchange-status')?.textContent));
    await tap('.photo-exchanges [data-x-close]');
    await sleep(1500);
    log('after close exchange (panel)', await page.evaluate(() => ({ kind: document.querySelector('#panel')?.dataset.kind, hidden: document.querySelector('#panel')?.hidden })));
    if (!(await page.evaluate(() => document.querySelector('#panel')?.hidden))) { log('wall after exchange', await wallInfo()); await shot('a-wall-after-accept'); await tap('#panel-close'); await sleep(1000); }
    log('tour after exchange', await tour());
    await shot('b-tour-after-exchange');
    await tap('[data-tour-action="open:recap"]');
    await page.waitForSelector('#panel[data-kind="recap"]:not([hidden])', { timeout: 15000 }).catch(() => log('recap', 'not open'));
    await sleep(2500);
    await tap('#panel-close');
    await sleep(2000);
    log('tour after recap', await tour());
    await shot('c-tour-after-recap');
    await tap('[data-view="photos"]');
    await page.locator('#context-buttons [data-open="wall"]').waitFor({ state: 'visible', timeout: 20000 }).catch(() => log('wall', 'no context button'));
    await tap('#context-buttons [data-open="wall"]').catch(() => {});
    await page.waitForSelector('#panel[data-kind="wall"]:not([hidden])', { timeout: 15000 }).catch(() => log('wall', 'not open via nav'));
    await sleep(2000);
    log('wall before reload (nav)', await wallInfo());
    await shot('c2-wall-before-reload');
    if (!(await page.evaluate(() => document.querySelector('#panel')?.hidden))) { await tap('#panel-close'); await sleep(1000); }
    log('tour before reload', await tour());
    log('storage before reload', await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(k => /tour|exchange/.test(k)).map(k => [k, localStorage.getItem(k).slice(0, 200)]))));
    // ---- reload ----
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
    for (const s of [1, 4, 10]) { await sleep(s === 1 ? 1000 : s === 4 ? 3000 : 6000); log(`tour after reload +${s}s`, await tour()); }
    await shot('d-tour-after-reload');
    log('storage after reload', await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(k => /tour|exchange/.test(k)).map(k => [k, localStorage.getItem(k).slice(0, 200)]))));
    // after the reload: the wall through the camera nav (the card has no 「回到照片墙」 any more), then the exchange list
    await tap('[data-view="photos"]');
    await page.locator('#context-buttons [data-open="wall"]').waitFor({ state: 'visible', timeout: 20000 }).catch(() => log('wall', 'no context button'));
    await tap('#context-buttons [data-open="wall"]').catch(() => {});
    await page.waitForSelector('#panel[data-kind="wall"]:not([hidden])', { timeout: 15000 }).catch(() => log('wall', 'not open via nav'));
    await sleep(2000);
    log('wall after reload', await wallInfo());
    await shot('e-wall-after-reload');
    await tap('#panel [data-open="exchanges"]');
    await page.waitForFunction(() => document.querySelectorAll('.photo-exchanges [data-x-open]').length > 0, null, { timeout: 20000 }).catch(() => log('list', 'no rows'));
    log('exchange list rows', await page.evaluate(() => [...document.querySelectorAll('.photo-exchanges [data-x-open]')].map(b => b.innerText.replace(/\s+/g, ' '))));
    log('pending/failed records', await page.evaluate(() => [...document.querySelectorAll('.photo-exchanges .exchange-pending')].map(n => n.innerText.replace(/\s+/g, ' '))));
    await tap('.photo-exchanges [data-x-close]');
    await sleep(1200);
    if (!(await page.evaluate(() => document.querySelector('#panel')?.hidden))) { await tap('#panel-close').catch(() => {}); await sleep(1000); }
    await tap('[data-view="overview"]').catch(() => {});
    await sleep(2500);
    log('tour at the end', await tour());
    await shot('g-tour-end');
    log('errors', errs);
  } catch (e) { log('FAILED', e.message.split('\n')[0]); await shot('zz-fail').catch(() => {}); log('errors', errs); }
  await browser.close();
})();
