// verify-11: try the refined fix by injecting CSS into the page (never touches the repo).
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const OUT = '/tmp/space-doodle/verify-11/shots';
const URL = 'http://127.0.0.1:5190/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
setTimeout(() => { console.error('watchdog'); process.exit(2); }, 285000).unref();
const FIX_A = `
.frame .presence.demo-tour-open > :not(.demo-tour){display:none}
.frame .presence.demo-tour-open{padding:0;background:transparent;border-color:transparent;box-shadow:none}
.frame .presence.demo-tour-open::before,.frame .presence.demo-tour-open::after{display:none}
.frame .presence.demo-tour-open > .demo-tour:first-child{margin-bottom:0}
.frame .presence.demo-tour-open > .demo-tour:first-child::before{display:block}
.frame .presence.demo-tour-open > .demo-tour .demo-tour-step{text-shadow:.06em .06em 0 var(--ds-pink)}
`;
async function measure(page, label, vp) {
  await page.setViewportSize(vp); await sleep(900);
  const m = await page.evaluate(() => {
    const vis = el => { if (!el || !el.getClientRects().length) return false; for (let n = el; n; n = n.parentElement) { const s = getComputedStyle(n); if (s.display === 'none' || s.visibility === 'hidden') return false; } const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
    const R = el => { const r = el.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; };
    const pres = document.querySelector('.frame .presence'); const tour = document.querySelector('.demo-tour');
    const box = tour && vis(tour) && pres.classList.contains('demo-tour-open') && getComputedStyle(pres).backgroundColor === 'rgba(0, 0, 0, 0)' ? tour : pres;
    const pr = box.getBoundingClientRect();
    const tags = [...document.querySelectorAll('#hotspots [data-kind]')].filter(vis).map(t => { const r = t.getBoundingClientRect(); const c = Math.max(0, Math.min(r.right, pr.right) - Math.max(r.left, pr.left)) * Math.max(0, Math.min(r.bottom, pr.bottom) - Math.max(r.top, pr.top)) / (r.width * r.height); return { text: t.textContent.trim().slice(0, 14), covered: Math.round(c * 100) }; }).filter(t => t.covered > 0);
    const ink = [...pres.querySelectorAll('button')].filter(vis).filter(b => getComputedStyle(b).backgroundColor === 'rgb(28, 27, 26)').map(b => b.textContent.trim());
    const all = [...pres.querySelectorAll('button')].filter(vis).map(b => b.textContent.trim());
    return { card: R(box), world: R(document.querySelector('.world-shell')), ink, all, tags };
  });
  await page.evaluate(() => document.activeElement?.blur?.()); await sleep(300);
  await page.screenshot({ path: `${OUT}/${label}.png` });
  console.log(label, JSON.stringify(m));
}
(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
    await page.waitForFunction(() => document.querySelector('#loading')?.hidden === true, null, { timeout: 60000 }).catch(() => {});
    await page.evaluate(() => document.fonts.ready); await sleep(800);
    if (!(await page.locator('form[data-form="demo-entry"]').count())) await page.locator('button:visible', { hasText: '进入示例现场' }).first().click();
    await page.waitForSelector('form[data-form="demo-entry"]', { timeout: 20000 });
    await page.locator('form[data-form="demo-entry"] input[name=consent]').check();
    await page.waitForSelector('form[data-form="demo-entry"] button[type=submit]:not([disabled])', { timeout: 60000 });
    await page.locator('form[data-form="demo-entry"] button[type=submit]').click();
    await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"]'), null, { timeout: 60000 });
    await page.waitForFunction(() => (window.__SPACE_EVENT_QA__?.()?.members || []).length > 1, null, { timeout: 30000 }).catch(() => {});
    await sleep(2500);
    const inject = () => page.evaluate(css => { let s = document.getElementById('v11-fix'); if (!s) { s = document.createElement('style'); s.id = 'v11-fix'; document.head.append(s); } s.textContent = css; }, FIX_A);
    const eject = () => page.evaluate(() => document.getElementById('v11-fix')?.remove());
    for (const [w, h] of [[1440, 900], [1280, 800]]) { await eject(); await measure(page, `fix-step1-before-${w}`, { width: w, height: h }); await inject(); await measure(page, `fix-step1-A-${w}`, { width: w, height: h }); }
    await eject(); await page.setViewportSize({ width: 1440, height: 900 }); await sleep(600);
    await page.click('[data-tour-action="sample:sample-crowd"]');
    await page.waitForSelector('form[data-form="upload"] .photo-review', { timeout: 30000 });
    try { await page.waitForSelector('form[data-form="upload"] .moment-chip.is-ai, form[data-form="upload"] .moment-ai-tag', { timeout: 40000 }); } catch {}
    await sleep(500);
    if (!(await page.evaluate(() => Boolean(document.querySelector('form[data-form="upload"] .moment-chip[aria-pressed="true"]'))))) await page.click('form[data-form="upload"] .moment-chip[data-moment-viewpoint="crowd"]');
    await page.click('form[data-form="upload"] button[type="submit"]');
    await page.waitForSelector('.moment-wall, .panel .photo-grid', { timeout: 30000 }); await sleep(2500);
    await page.keyboard.press('Escape').catch(() => {}); await sleep(300);
    await page.evaluate(() => { const c = document.querySelector('#panel-close'); if (c && !document.querySelector('#panel').hidden) c.click(); }); await sleep(1500);
    await page.evaluate(() => document.querySelector('[data-tour-action="open:wall"]')?.click()); await sleep(1800);
    await page.waitForSelector('[data-moment-badge] [data-exchange-offer]', { timeout: 20000 });
    await page.click('[data-moment-badge] [data-exchange-offer]');
    await page.waitForSelector('.photo-exchanges:not([hidden]) .exchange-pair', { timeout: 20000 });
    await page.check('.photo-exchanges [data-x-consent]');
    await page.waitForFunction(() => !document.querySelector('.photo-exchanges [data-x-send]')?.disabled, null, { timeout: 20000 });
    await page.click('.photo-exchanges [data-x-send]');
    await page.waitForFunction(() => /交换已接受/.test(document.querySelector('.photo-exchanges .exchange-status')?.textContent || ''), null, { timeout: 60000 });
    await sleep(800); await page.click('.photo-exchanges [data-x-close]'); await sleep(1800);
    for (const [w, h] of [[1440, 900], [1280, 800]]) { await eject(); await measure(page, `fix-step4-before-${w}`, { width: w, height: h }); await inject(); await measure(page, `fix-step4-A-${w}`, { width: w, height: h }); }
    // collapsed with the fix: presence content must come back
    await page.setViewportSize({ width: 1440, height: 900 }); await page.click('.demo-tour [data-tour-toggle]'); await sleep(900);
    await measure(page, 'fix-step4-A-collapsed-1440', { width: 1440, height: 900 });
    await page.click('.demo-tour [data-tour-toggle]'); await sleep(500);
    // phone with the fix: must be unchanged
    await measure(page, 'fix-step4-A-phone', { width: 390, height: 844 });
  } catch (e) { console.error('ERR', e.message.split('\n')[0]); await page.screenshot({ path: `${OUT}/ERR-fix.png` }).catch(() => {}); }
  await b.close();
})();
