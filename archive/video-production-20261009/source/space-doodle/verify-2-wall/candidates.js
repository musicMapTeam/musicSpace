// Reach the wall once, then try candidate CSS fixes (injected, not written to the repo) and re-measure each.
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const vp = process.argv[2] || 'phone';
const base = process.argv[3] || 'http://127.0.0.1:5190/';
const label = process.argv[4] || 'cand';
const width = Number(process.argv[5] || 0);
const OUT = '/tmp/space-doodle/verify-2-wall';
const VP = {
  phone: { viewport: { width: width || 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};
const CANDS = {
  none: '',
  badgeFirst: `.moment-wall .moment-card--best{display:flex;flex-direction:column}
.moment-wall .moment-card--best>.moment-badge{order:-1;margin:0 0 14px}`,
  compactPhoto: `.moment-wall .moment-card--best > .photo-item > span{aspect-ratio:16/9}
@media (max-width:700px){.moment-wall .moment-group__clock{font-size:1.9em}}`,
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const context = await browser.newContext({ ...VP[vp], locale: 'zh-CN' });
  const page = await context.newPage();
  page.setDefaultTimeout(45000);
  const click = async sel => { const l = page.locator(sel).first(); await l.waitFor({ state: 'visible', timeout: 60000 }); if (vp === 'phone') await l.tap(); else await l.click(); };
  try {
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 120000 });
    await click('#join');
    await page.waitForFunction(() => { const b = document.querySelector('form[data-form="demo-entry"] button[type="submit"]'); return b && !b.disabled; }, null, { timeout: 90000 });
    await page.check('form[data-form="demo-entry"] input[name="consent"]', { force: true });
    await click('form[data-form="demo-entry"] button[type="submit"]');
    await click('[data-tour-action="sample:sample-crowd"]');
    await page.locator('form[data-form="upload"]').waitFor({ state: 'visible' });
    await page.waitForFunction(() => /^(sure|unsure|off)/.test(document.querySelector('form[data-form="upload"] [data-ai-line]')?.getAttribute('data-ai-key') || ''), null, { timeout: 90000 }).catch(() => {});
    await click('form[data-form="upload"] button[type="submit"]');
    await page.locator('#panel [data-moment-badge] [data-exchange-offer]').first().waitFor({ state: 'attached', timeout: 45000 });
    await page.waitForFunction(() => [...document.querySelectorAll('#panel .moment-card img')].every(i => i.complete && i.naturalWidth), null, { timeout: 30000 }).catch(() => {});
    await page.evaluate(() => document.fonts.ready);
    await sleep(2500);
    for (const [name, css] of Object.entries(CANDS)) {
      await page.evaluate(css => { document.getElementById('verify-cand')?.remove(); const s = document.createElement('style'); s.id = 'verify-cand'; s.textContent = css; document.head.append(s); document.querySelector('#panel').scrollTop = 0; }, css);
      await sleep(700);
      const m = await page.evaluate(() => {
        const panel = document.querySelector('#panel');
        const pr = panel.getBoundingClientRect();
        const R = sel => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.top), Math.round(b.bottom)]; };
        return { st: panel.scrollTop, visBottom: Math.round(Math.min(pr.bottom, innerHeight, document.querySelector('.camera-nav').getBoundingClientRect().top)), card: R('#panel .moment-card--best'), img: R('#panel .moment-card--best .photo-item > span'), badgeTitle: R('#panel .moment-badge__title'), reason: R('#panel .moment-badge__reason'), offer: R('#panel [data-exchange-offer]'), clock: R('#panel .moment-group__clock'), overflowX: document.querySelector('#panel').scrollWidth > document.querySelector('#panel').clientWidth };
      });
      console.log(vp, width || '', name, JSON.stringify(m));
      await page.screenshot({ path: `${OUT}/${label}-${vp}${width ? '-' + width : ''}-${name}.png` });
    }
  } catch (e) {
    console.log('FAILED', e.message.split('\n')[0]);
    await page.screenshot({ path: `${OUT}/${label}-${vp}-fail.png` }).catch(() => {});
  }
  await browser.close();
})();
