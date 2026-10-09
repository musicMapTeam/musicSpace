// Route-card fix check: node tour-fix.js <phone|desktop|narrow|laptop|tablet> [prefix=after] [port=5190]
// Shots: /tmp/space-doodle/shots/showcase/<prefix>-tour-*-<kind>.png ; measurements printed as JSON lines.
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('node:fs');
const [, , KIND = 'desktop', PREFIX = 'after', PORT = '5190'] = process.argv;
const URL = process.env.BASE || `http://127.0.0.1:${PORT}/`;
const OUT = process.env.OUT || '/tmp/space-doodle/shots/showcase';
const VP = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  laptop: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 },
  tablet: { viewport: { width: 900, height: 1100 }, deviceScaleFactor: 1 },
  narrow: { viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const t0 = Date.now();
setTimeout(() => { console.log('WATCHDOG'); process.exit(2); }, 270000).unref();
async function shot(page, name) { const file = `${OUT}/${PREFIX}-${name}-${KIND}.png`; await page.evaluate(() => document.activeElement?.blur?.()); await sleep(450); await page.screenshot({ path: file }); console.log('saved', file); }
async function measure(page, label) {
  const m = await page.evaluate(() => {
    const r = n => { if (!n || !n.getClientRects().length) return null; const x = n.getBoundingClientRect(); return [Math.round(x.left), Math.round(x.top), Math.round(x.width), Math.round(x.height)]; };
    const p = document.querySelector('.frame .presence'), t = document.querySelector('#demo-tour, .demo-tour');
    const visKids = p ? [...p.children].filter(c => c.getClientRects().length && getComputedStyle(c).display !== 'none').map(c => (c.id ? '#' + c.id : '') + (c.className ? '.' + String(c.className).split(' ').join('.') : c.tagName)) : [];
    const step = document.querySelector('.demo-tour .demo-tour-step');
    const tape = t ? getComputedStyle(t, '::before') : null;
    const ink = [...document.querySelectorAll('.frame .presence button')].filter(b => b.getClientRects().length && getComputedStyle(b).backgroundColor === getComputedStyle(document.documentElement).getPropertyValue('--ds-ink').trim() || (b.getClientRects().length && /rgb\(28, 27, 26\)/.test(getComputedStyle(b).backgroundColor))).map(b => b.textContent.trim());
    const buttons = [...document.querySelectorAll('.frame .presence button')].filter(b => b.getClientRects().length).map(b => b.textContent.trim());
    const display = [...document.querySelectorAll('.frame *')].filter(n => n.getClientRects().length && n.childElementCount < 3 && /Doodle Display/.test(getComputedStyle(n).fontFamily) && n.textContent.trim() && getComputedStyle(n).visibility !== 'hidden' && !n.closest('[hidden]') && [...n.childNodes].some(c => c.nodeType === 3 && c.textContent.trim())).map(n => ({ text: n.textContent.trim().slice(0, 24), shadow: getComputedStyle(n).textShadow !== 'none', size: getComputedStyle(n).fontSize }));
    const ps = p ? getComputedStyle(p) : null;
    return { vw: innerWidth, vh: innerHeight, presence: r(p), presenceBg: ps && ps.backgroundColor, presencePad: ps && ps.padding, presenceClass: p && p.className, tour: r(t), tourHidden: t && t.hidden, visKids, stepShadow: step && getComputedStyle(step).textShadow, tapeDisplay: tape && tape.display, buttons, displayFace: display, overflowX: document.documentElement.scrollWidth > innerWidth };
  });
  console.log('MEASURE', label, JSON.stringify(m));
  return m;
}
async function closePanel(page) { const c = page.locator('#panel-close'); if (await c.isVisible().catch(() => false)) { await c.click(); await sleep(400); } }
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    const ctx = await browser.newContext(VP[KIND]);
    const page = await ctx.newPage();
    page.on('pageerror', e => console.log('pageerror', e.message.slice(0, 200)));
    await page.goto(URL);
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
    await page.evaluate(() => document.fonts.ready);
    await sleep(600);
    await page.locator('#join').click();
    await page.waitForSelector("form[data-form='demo-entry']");
    await page.locator("form[data-form='demo-entry'] input[name=consent]").check();
    await page.waitForSelector("form[data-form='demo-entry'] button[type=submit]:not([disabled])", { timeout: 60000 });
    await page.locator("form[data-form='demo-entry'] button[type=submit]").click();
    await page.waitForSelector(".frame[data-stage='room']", { timeout: 30000 });
    await sleep(800);
    await closePanel(page);
    await page.waitForSelector('#demo-tour:not([hidden])', { timeout: 15000 });
    await page.waitForFunction(() => (window.__SPACE_EVENT_QA__?.()?.members || []).length > 1, null, { timeout: 30000 }).catch(() => console.log('members never arrived'));
    await sleep(1800);
    await measure(page, 'tour-1');
    await shot(page, 'tour-1');
    await page.locator('[data-tour-toggle]').click();
    await sleep(500);
    await measure(page, 'tour-1-collapsed');
    await shot(page, 'tour-1-collapsed');
    await page.locator('[data-tour-toggle]').click();
    await sleep(500);
    await measure(page, 'tour-1-reopened');
    // step 1: the crowd sample, saved
    await page.locator('[data-tour-action="sample:sample-crowd"]').click();
    const save = page.locator('button[type=submit]', { hasText: '保存这张照片' });
    await save.waitFor({ timeout: 30000 });
    await page.waitForFunction(() => { const b = [...document.querySelectorAll('button[type=submit]')].find(x => x.textContent.includes('保存这张照片')); return b && !b.disabled; }, null, { timeout: 30000 });
    await sleep(500);
    await save.click();
    await sleep(2500);
    await closePanel(page);
    await sleep(900);
    await measure(page, 'tour-3');
    await shot(page, 'tour-3');
    // exchange
    await page.locator('[data-tour-action="open:wall"]').click();
    await sleep(1200);
    const offer = page.locator('[data-exchange-offer]').first();
    await offer.waitFor({ timeout: 20000 });
    await offer.scrollIntoViewIfNeeded();
    await offer.click();
    await page.locator('[data-x-consent]').waitFor({ timeout: 15000 });
    await page.locator('[data-x-consent]').check();
    await sleep(400);
    await page.waitForFunction(() => { const b = document.querySelector('[data-x-send]'); return b && !b.disabled; }, null, { timeout: 15000 });
    await page.locator('[data-x-send]').click();
    await page.waitForFunction(() => document.body.textContent.includes('交换已接受'), null, { timeout: 60000 }).catch(() => console.log('no accept seen'));
    await sleep(800);
    for (let i = 0; i < 3; i += 1) {
      const closers = page.locator('#panel-close:visible, [data-x-close]:visible, .exchange-close:visible');
      if (await closers.count()) { await closers.first().click().catch(() => {}); await sleep(400); } else break;
    }
    await page.keyboard.press('Escape').catch(() => {});
    await sleep(1200);
    await measure(page, 'tour-4');
    await shot(page, 'tour-4');
    await page.locator('[data-tour-action="open:recap"]').click();
    await sleep(1500);
    await closePanel(page);
    await sleep(900);
    await measure(page, 'tour-done');
    await shot(page, 'tour-done');
    await page.locator('[data-tour-skip]').click();
    await sleep(700);
    await measure(page, 'tour-dismissed');
    await shot(page, 'tour-dismissed');
    await ctx.close();
  } catch (e) { console.error('FAILED', e.message.split('\n')[0]); }
  finally { await browser.close(); console.log('done in', Math.round((Date.now() - t0) / 1000), 's'); }
})();
