const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const OUT = '/tmp/space-doodle/verify-15/shots';
const sleep = ms => new Promise(r => setTimeout(r, ms));
setTimeout(() => { console.error('watchdog'); process.exit(2); }, 250000).unref();
const FIX = `
@media (max-width:700px){
  .panel{bottom:106px;max-height:calc(100% - 174px)}
  .frame:has(>#panel:not([hidden]),>.community-panel:not(.conversation-layout):not([hidden])) .world-shell::before,
  .frame:has(>#panel:not([hidden]),>.community-panel:not(.conversation-layout):not([hidden])) .world-shell::after{visibility:hidden}
  .frame .community-panel:not(.conversation-layout){max-height:calc(100vh - 68px);max-height:calc(100dvh - 68px)}
}`;
async function open(page, kind) { await page.evaluate(k => { const b = document.createElement('button'); b.dataset.open = k; b.style.cssText = 'position:fixed;left:-9999px'; document.body.append(b); b.click(); b.remove(); }, kind); await sleep(1800); }
async function close(page) { for (let i = 0; i < 2; i++) { await page.keyboard.press('Escape'); await sleep(150); } await page.evaluate(() => { const c = document.querySelector('#panel-close'); if (c && !document.querySelector('#panel').hidden) c.click(); document.querySelectorAll('.frame>.community-panel:not([hidden])>header>button').forEach(b => b.click()); }); await sleep(600); }
async function snap(page, label) {
  await page.evaluate(() => document.activeElement?.blur?.()); await sleep(600);
  const m = await page.evaluate(() => { const R = e => { const b = e.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom].map(Math.round); }; const p = document.querySelector('#panel'); const d = document.querySelector('.frame>.community-panel:not([hidden])'); return { panel: p.hidden ? null : R(p), drawer: d ? R(d) : null, world: R(document.querySelector('.world-shell')), tapes: getComputedStyle(document.querySelector('.world-shell'), '::before').visibility }; });
  console.log(label, JSON.stringify(m));
  await page.screenshot({ path: `${OUT}/fix-${label}-full.png` });
  await page.screenshot({ path: `${OUT}/fix-${label}-top.png`, clip: { x: 0, y: 40, width: 390, height: 110 } });
  await page.screenshot({ path: `${OUT}/fix-${label}-bottom.png`, clip: { x: 0, y: 690, width: 390, height: 80 } });
}
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:5190/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
  await page.waitForFunction(() => document.querySelector('#loading')?.hidden === true, null, { timeout: 60000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready); await sleep(900);
  await page.addStyleTag({ content: FIX });
  await page.locator('button:visible', { hasText: '进入示例现场' }).first().click();
  await page.waitForSelector('form[data-form="demo-entry"]', { timeout: 20000 }); await sleep(900);
  await snap(page, 'join');
  await page.locator('form[data-form="demo-entry"] input[name=consent]').check();
  await page.waitForSelector('form[data-form="demo-entry"] button[type=submit]:not([disabled])', { timeout: 60000 });
  await page.locator('form[data-form="demo-entry"] button[type=submit]').click();
  await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"]'), null, { timeout: 60000 });
  await sleep(3000); await close(page);
  await snap(page, 'room-nosheet');
  await open(page, 'wall'); await snap(page, 'wall'); await close(page);
  for (const k of ['leave', 'feedback', 'close']) { await open(page, k); const h = await page.evaluate(() => { const p = document.querySelector('#panel'); return p.hidden ? null : [p.scrollHeight, p.clientHeight, p.dataset.kind]; }); console.log('try', k, JSON.stringify(h)); if (h && h[0] <= h[1] + 2) { await snap(page, 'short-' + k); await close(page); break; } await close(page); }
  await page.locator('#my-space').click(); await sleep(2200); await snap(page, 'personal'); await close(page);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
