// After an exchange (no recap) and a reload: every state the tour card shows from the first paint on (no 3/4 flash expected).
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const ORIGIN = process.env.ORIGIN || 'http://127.0.0.1:47391/musicSpace/';
const vp = process.argv[2] || 'desktop';
const VPS = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, desktop: { viewport: { width: 1440, height: 900 } } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
setTimeout(() => { console.log('watchdog'); process.exit(2); }, 240000).unref();
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const page = await (await browser.newContext({ ...VPS[vp], locale: 'zh-CN' })).newPage();
  page.setDefaultTimeout(45000);
  const tap = async sel => { const l = page.locator(sel).first(); await l.waitFor({ state: 'visible' }); if (vp === 'phone') await l.tap(); else await l.click(); };
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
  // record from the very first script of the next page load
  await page.addInitScript(() => {
    window.__tourStates = [];
    const t0 = performance.now();
    const read = () => { const t = document.querySelector('#demo-tour'); if (!t) return null; const title = t.querySelector('.demo-tour-title')?.textContent.replace(/\s+/g, ' ').trim() || ''; const dots = [...t.querySelectorAll('.demo-tour-bar i')].map(i => i.classList.contains('on') ? '●' : '○').join(''); const loading = document.querySelector('#loading'); return `${t.hidden ? '(hidden) ' : ''}${title} [${dots}]${loading && !loading.hidden ? ' (loading screen up)' : ''}`; };
    const tick = () => { const s = read(); const last = window.__tourStates.at(-1); if (s && s !== last?.s) window.__tourStates.push({ ms: Math.round(performance.now() - t0), s }); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  console.log('before reload:', await page.evaluate(() => document.querySelector('#demo-tour .demo-tour-title')?.textContent.replace(/\s+/g, ' ').trim()));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
  await sleep(4000);
  console.log('states after reload:', JSON.stringify(await page.evaluate(() => window.__tourStates), null, 0));
  await browser.close();
})();
