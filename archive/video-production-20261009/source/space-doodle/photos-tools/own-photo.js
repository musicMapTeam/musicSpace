// The judge's own-photo path: 「选照片」 with a real EXIF photo (landscape), save; then a second photo whose time is edited to another day.
// usage: node own-photo.js <phone|desktop|narrow> [tag]
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const path = require('path');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const OUT = process.env.SHOTS_OUT || '/tmp/space-doodle/photos-tools/v2';
const VPS = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, desktop: { viewport: { width: 1440, height: 900 } }, narrow: { viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } };
const vp = process.argv[2] || 'phone', tag = process.argv[3] || 'own';
async function reveal(page, selector, block = 'start', index = 0) {
  await page.evaluate(([selector, block, index]) => {
    const el = document.querySelectorAll(selector)[index]; if (!el) return;
    let box = el.parentElement; while (box && !(box.scrollHeight > box.clientHeight + 2 && /(auto|scroll)/.test(getComputedStyle(box).overflowY))) box = box.parentElement;
    if (!box) return; const r = el.getBoundingClientRect(), b = box.getBoundingClientRect();
    if (block === 'end') box.scrollTop += r.bottom - b.bottom + 16; else if (block === 'center') box.scrollTop += (r.top + r.height / 2) - (b.top + b.height / 2); else box.scrollTop += r.top - b.top - 12;
  }, [selector, block, index]);
}
const shot = async (page, name) => { await sleep(500); const file = path.join(OUT, `${tag}-${name}-${vp}.png`); await page.screenshot({ path: file }); console.log('saved', file); };
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const page = await (await browser.newContext(VPS[vp])).newPage();
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
  // the judge's own photo through 「选照片」
  await page.setInputFiles('form[data-form="upload"] input[type="file"]', '/tmp/space-video-prep/photos/pack/demo-unsure-2150.jpg');
  await page.waitForFunction(() => !document.querySelector('[data-sample-flag]') && /21:50/.test(document.querySelector('[data-taken-line]')?.textContent || ''), null, { timeout: 30000 }).catch(() => console.log('own photo time not shown'));
  try { await page.waitForSelector('form[data-form="upload"] .moment-ai-tag', { timeout: 45000 }); } catch { console.log('no AI answer'); }
  await reveal(page, 'form[data-form="upload"] .moment-taken', 'start');
  await shot(page, 'upload');
  await reveal(page, 'form[data-form="upload"] .moment-view', 'start');
  await shot(page, 'upload-view');
  const chosen = await page.evaluate(() => Boolean(document.querySelector('form[data-form="upload"] .moment-chip[aria-pressed="true"]')));
  if (!chosen) await page.click('form[data-form="upload"] .moment-chip[data-moment-viewpoint="friends"]');
  await page.click('form[data-form="upload"] button[type="submit"]');
  await page.waitForSelector('.moment-wall', { timeout: 30000 });
  await sleep(1500);
  // a second photo, its time edited by hand to another day
  await page.click('#panel-body button[data-open="upload"]');
  await page.waitForSelector('form[data-form="upload"]');
  await page.setInputFiles('form[data-form="upload"] input[type="file"]', '/tmp/space-video-prep/photos/pack/demo-stage-2147.jpg');
  await page.waitForFunction(() => /21:47/.test(document.querySelector('[data-taken-line]')?.textContent || ''), null, { timeout: 30000 }).catch(() => console.log('second photo time not shown'));
  await page.click('form[data-form="upload"] [data-taken-edit]');
  await page.fill('form[data-form="upload"] input[name="takenAt"]', '2026-09-25T20:15');
  await page.locator('form[data-form="upload"] input[name="takenAt"]').blur();
  await sleep(600);
  await reveal(page, 'form[data-form="upload"] .moment-taken', 'start');
  await shot(page, 'upload-edited');
  const chosen2 = await page.evaluate(() => Boolean(document.querySelector('form[data-form="upload"] .moment-chip[aria-pressed="true"]')));
  if (!chosen2) await page.click('form[data-form="upload"] .moment-chip[data-moment-viewpoint="stage"]');
  await page.click('form[data-form="upload"] button[type="submit"]');
  await page.waitForSelector('.moment-wall', { timeout: 30000 });
  await sleep(1800);
  await page.waitForFunction(() => { const t = document.querySelector('#toast'); return !t || t.hidden || !t.classList.contains('visible') || getComputedStyle(t).opacity === '0'; }, null, { timeout: 15000 }).catch(() => console.log('toast still up'));
  await sleep(400);
  const titles = await page.evaluate(() => [...document.querySelectorAll('.moment-group__title')].map(h => h.textContent));
  console.log('groups:', JSON.stringify(titles));
  const n = titles.length;
  for (let i = 0; i < n; i++) { await reveal(page, '.moment-group', 'start', i); await shot(page, `wall-group${i + 1}`); }
  await browser.close();
})().catch(e => { console.log('ERR', e.message.split('\n').slice(0, 6).join(' | ')); process.exit(1); });
