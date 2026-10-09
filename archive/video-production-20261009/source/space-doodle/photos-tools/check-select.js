// Functional check of the compose select overlay: the tap target is the real <select>, a new choice updates the written-out label, focus shows a ring.
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const vp = process.argv[2] === 'desktop' ? { viewport: { width: 1440, height: 900 } } : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
  const page = await (await browser.newContext({ ...vp, reducedMotion: process.env.REDUCED ? 'reduce' : 'no-preference' })).newPage();
  page.setDefaultTimeout(25000);
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.goto('http://127.0.0.1:5190/');
  await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 60000 });
  await sleep(600);
  await page.locator('button', { hasText: '进入示例现场' }).first().click();
  await page.check('form[data-form="demo-entry"] input[name="consent"]');
  await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"] button[type="submit"]')?.disabled);
  await page.click('form[data-form="demo-entry"] button[type="submit"]');
  await page.waitForSelector('[data-tour-action="sample:sample-crowd"]');
  await sleep(500);
  await page.click('[data-tour-action="sample:sample-crowd"]');
  await page.waitForSelector('form[data-form="upload"] .photo-review');
  await page.click('form[data-form="upload"] .moment-chip[data-moment-viewpoint="crowd"]');
  await page.click('form[data-form="upload"] button[type="submit"]');
  await page.waitForSelector('[data-moment-badge] [data-exchange-offer]');
  await sleep(800);
  await page.click('[data-moment-badge] [data-exchange-offer]');
  await page.waitForSelector('.photo-exchanges:not([hidden]) .exchange-select', { timeout: 20000 });
  await page.waitForFunction(() => /推荐/.test(document.querySelector('.exchange-select__shown')?.textContent || ''), null, { timeout: 20000 }).catch(() => {});
  const report = await page.evaluate(() => {
    const shown = document.querySelector('.exchange-select__shown');
    const select = document.querySelector('[data-x-choice]');
    const r = shown.getBoundingClientRect();
    const hits = [[.15, .5], [.5, .5], [.92, .5]].map(([fx, fy]) => document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy));
    const s = select.getBoundingClientRect();
    return {
      shown: shown.textContent, options: [...select.options].map(o => o.textContent), value: select.value,
      hitsSelect: hits.every(el => el === select), selectBox: [Math.round(s.width), Math.round(s.height)], shownBox: [Math.round(r.width), Math.round(r.height)],
    };
  });
  console.log(JSON.stringify(report, null, 1));
  console.log('css', JSON.stringify(await page.evaluate(() => ({ transition: getComputedStyle(document.querySelector('.exchange-select__shown')).transitionDuration, dots: getComputedStyle(document.querySelector('.exchange-select__shown .pc-dots__in') || document.body).display, last: getComputedStyle(document.querySelector('.photo-exchanges .exchange-pair figure')).animationName }))));
  // keyboard: focus the select and look at the ring on the label under it
  await page.focus('[data-x-choice]');
  await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');
  const ring = await page.evaluate(() => { const cs = getComputedStyle(document.querySelector('.exchange-select__shown')); return { focused: document.activeElement?.hasAttribute('data-x-choice'), outline: cs.outlineStyle + ' ' + cs.outlineWidth, shadow: cs.boxShadow }; });
  console.log('focus', JSON.stringify(ring));
  // choose the placeholder, then the first real option: the written-out label follows and the reason updates
  const values = await page.evaluate(() => [...document.querySelectorAll('[data-x-choice] option')].map(o => o.value));
  await page.selectOption('[data-x-choice]', '');
  await sleep(400);
  console.log('placeholder ->', await page.evaluate(() => document.querySelector('.exchange-select__shown').textContent), '| send disabled:', await page.evaluate(() => document.querySelector('[data-x-send]').disabled));
  await page.selectOption('[data-x-choice]', values[1]);
  await sleep(1200);
  console.log('option 1 ->', await page.evaluate(() => document.querySelector('.exchange-select__shown').textContent), '| reason:', await page.evaluate(() => document.querySelector('[data-x-reason]')?.textContent.slice(0, 40)));
  await page.screenshot({ path: `/tmp/space-doodle/photos-tools/v2/check-select-${process.argv[2] || 'phone'}.png` });
  await browser.close();
})().catch(e => { console.log('ERR', e.message.split('\n').slice(0, 6).join(' | ')); process.exit(1); });
