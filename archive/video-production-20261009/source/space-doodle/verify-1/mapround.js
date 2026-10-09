// Route -> 回看这一晚 -> 「音乐探索」 -> Map 「← 返回现场」: read the tour card and the wall after coming back (no explicit reload).
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const ORIGIN = process.env.ORIGIN || 'http://127.0.0.1:47419/musicSpace/';
const vp = process.argv[2] || 'phone';
const OUT = '/tmp/space-doodle/verify-1/shots';
const VPS = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, desktop: { viewport: { width: 1440, height: 900 } } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const context = await browser.newContext({ ...VPS[vp], locale: 'zh-CN' });
  const page = await context.newPage();
  page.setDefaultTimeout(45000);
  const tap = async sel => { const l = page.locator(sel).first(); await l.waitFor({ state: 'visible' }); if (vp === 'phone') await l.tap(); else await l.click(); };
  const tour = () => page.evaluate(() => { const t = document.querySelector('#demo-tour'); if (!t) return 'no card'; const title = t.querySelector('.demo-tour-title')?.textContent.replace(/\s+/g, ' ').trim(); const dots = [...t.querySelectorAll('.demo-tour-bar i')].map(i => i.classList.contains('on') ? '●' : '○').join(''); return `${t.hidden ? '(hidden) ' : ''}${title} [${dots}]`; });
  const log = (k, v) => console.log(`[map ${vp}] ${k}:`, typeof v === 'string' ? v : JSON.stringify(v));
  try {
    await page.goto(ORIGIN, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
    await tap('#join');
    await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"] button[type="submit"]')?.disabled, null, { timeout: 60000 });
    await page.check('form[data-form="demo-entry"] input[name="consent"]');
    await tap('form[data-form="demo-entry"] button[type="submit"]');
    await page.waitForFunction(() => document.querySelector('.frame')?.dataset.stage === 'room', null, { timeout: 30000 });
    await tap('[data-tour-action="sample:sample-crowd"]');
    await page.waitForFunction(() => /^(sure|unsure|off)/.test(document.querySelector('form[data-form="upload"] [data-ai-line]')?.getAttribute('data-ai-key') || ''), null, { timeout: 90000 }).catch(() => {});
    await tap('form[data-form="upload"] button[type="submit"]');
    await tap('[data-moment-badge] [data-exchange-offer]');
    await page.locator('.photo-exchanges [data-x-consent]').waitFor({ state: 'attached' });
    await page.locator('.photo-exchanges [data-x-consent]').check();
    await page.waitForFunction(() => !document.querySelector('.photo-exchanges [data-x-send]')?.disabled, null, { timeout: 30000 });
    await tap('.photo-exchanges [data-x-send]');
    await page.waitForFunction(() => /交换已接受/.test(document.querySelector('.photo-exchanges .exchange-status')?.textContent || ''), null, { timeout: 60000 });
    await tap('.photo-exchanges [data-x-close]');
    await sleep(1200);
    if (!(await page.evaluate(() => document.querySelector('#panel')?.hidden))) { await tap('#panel-close'); await sleep(800); }
    await tap('[data-tour-action="open:recap"]');
    await sleep(2500);
    await tap('#panel-close');
    await sleep(1500);
    log('tour before 音乐探索', await tour());
    await tap('#music-map-entry');
    await page.waitForURL(/music-map/, { timeout: 30000 });
    const backBtn = page.locator('button', { hasText: '返回现场' }).first();
    await backBtn.waitFor({ state: 'visible', timeout: 60000 });
    await sleep(1500);
    log('on map page', page.url().replace(ORIGIN, '/'));
    if (vp === 'phone') await backBtn.tap(); else await backBtn.click();
    await page.waitForURL(u => !/music-map/.test(String(u)), { timeout: 30000 });
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
    await sleep(5000);
    log('back in room url', page.url().replace(ORIGIN, '/'));
    log('tour after 返回现场', await tour());
    await page.screenshot({ path: `${OUT}/map-${vp}-after-return.png` });
  } catch (e) { log('FAILED', e.message.split('\n')[0]); await page.screenshot({ path: `${OUT}/map-${vp}-fail.png` }).catch(() => {}); }
  await browser.close();
})();
