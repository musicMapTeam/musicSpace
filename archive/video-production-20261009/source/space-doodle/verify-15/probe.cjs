// verify-15: independent probe of phone sheet vs 3D frame geometry (read-only; never touches the repo)
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const OUT = '/tmp/space-doodle/verify-15/shots';
const URL = process.env.URL || 'http://127.0.0.1:5190/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
setTimeout(() => { console.error('watchdog'); process.exit(2); }, 240000).unref();
const ONLY = (process.env.ONLY || 'join,upload,wall,recap,about,personal').split(',');

async function measure(page, label) {
  const r = await page.evaluate(() => {
    const R = e => { if (!e) return null; const b = e.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom].map(v => Math.round(v * 10) / 10); };
    const P = (e, pseudo) => { const s = getComputedStyle(e, pseudo); return { content: s.content, top: s.top, left: s.left, right: s.right, w: s.width, h: s.height, transform: s.transform, vis: s.visibility, disp: s.display, bg: s.backgroundColor, z: s.zIndex }; };
    const w = document.querySelector('.world-shell'), p = document.querySelector('#panel');
    const drawers = [...document.querySelectorAll('.frame>.community-panel,.frame>.private-chat,.frame>.room-moderation')].filter(d => !d.hidden && d.getClientRects().length);
    const cs = e => { const s = getComputedStyle(e); return { border: s.borderTopWidth + ' ' + s.borderTopStyle, radius: s.borderRadius, shadow: s.boxShadow, z: s.zIndex, bottom: s.bottom, maxH: s.maxHeight }; };
    const tapes = [...document.querySelectorAll('.ds-tape, .frame *')].filter(el => {
      // any element whose ::before/::after paints a tape mask, visible on screen in the top 160px
      return false;
    });
    return {
      vp: [innerWidth, innerHeight],
      world: R(w), worldCS: cs(w), worldBefore: P(w, '::before'), worldAfter: P(w, '::after'),
      panelHidden: p.hidden, panel: p.hidden ? null : R(p), panelKind: p.dataset.kind, panelCS: p.hidden ? null : cs(p), panelBefore: p.hidden ? null : P(p, '::before'),
      panelScroll: p.hidden ? null : [p.scrollHeight, p.clientHeight],
      drawers: drawers.map(d => ({ cls: d.className, box: R(d), cs: cs(d), before: P(d, '::before') })),
      presenceVis: getComputedStyle(document.querySelector('.presence')).visibility,
    };
  });
  console.log('\n== ' + label + '\n' + JSON.stringify(r));
  return r;
}
async function shots(page, label) {
  await page.evaluate(() => document.activeElement?.blur?.()).catch(() => {});
  await sleep(700);
  await page.screenshot({ path: `${OUT}/${label}-full.png` });
  await page.screenshot({ path: `${OUT}/${label}-top.png`, clip: { x: 0, y: 40, width: 390, height: 110 } });
  await page.screenshot({ path: `${OUT}/${label}-bottom.png`, clip: { x: 0, y: 690, width: 390, height: 80 } });
  await page.screenshot({ path: `${OUT}/${label}-tl.png`, clip: { x: 0, y: 50, width: 90, height: 60 } });
}
async function hiddenClick(page, kind, id) {
  await page.evaluate(([k, i]) => { const b = document.createElement('button'); b.dataset.open = k; if (i) b.dataset.id = i; b.style.cssText = 'position:fixed;left:-9999px'; document.body.append(b); b.click(); b.remove(); }, [kind, id]);
  await sleep(1400);
}
async function closeAll(page) {
  for (let i = 0; i < 2; i++) { await page.keyboard.press('Escape').catch(() => {}); await sleep(150); }
  await page.evaluate(() => { const c = document.querySelector('#panel-close'); if (c && !document.querySelector('#panel').hidden) c.click(); document.querySelectorAll('.frame>.community-panel:not([hidden])>header>button').forEach(b => b.click()); });
  await sleep(600);
}
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 160)));
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
  await page.waitForFunction(() => document.querySelector('#loading')?.hidden === true, null, { timeout: 60000 }).catch(() => console.log('loading never hid'));
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await sleep(1200);
  await measure(page, 'lobby');
  await page.screenshot({ path: `${OUT}/lobby-full.png` });
  // join sheet
  await page.locator('button:visible', { hasText: '进入示例现场' }).first().click();
  await page.waitForSelector('form[data-form="demo-entry"]', { timeout: 20000 });
  await sleep(900);
  if (ONLY.includes('join')) { await measure(page, 'join'); await shots(page, 'join'); }
  await page.locator('form[data-form="demo-entry"] input[name=consent]').check();
  await page.waitForSelector('form[data-form="demo-entry"] button[type=submit]:not([disabled])', { timeout: 60000 });
  await page.locator('form[data-form="demo-entry"] button[type=submit]').click();
  await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"]'), null, { timeout: 60000 });
  await sleep(3000);
  await closeAll(page);
  await measure(page, 'room');
  await page.screenshot({ path: `${OUT}/room-full.png` });
  if (ONLY.includes('upload')) {
    const card = page.locator('[data-tour-action="sample:sample-crowd"]');
    if (await card.count()) { await card.first().click(); await page.waitForSelector('form[data-form="upload"]', { timeout: 30000 }).catch(() => console.log('no upload form')); }
    else await hiddenClick(page, 'upload');
    await sleep(1500);
    await measure(page, 'upload'); await shots(page, 'upload');
    await closeAll(page);
  }
  if (ONLY.includes('wall')) {
    await page.locator('.camera-nav button[data-view="photos"]').click().catch(() => {}); await sleep(1500);
    await hiddenClick(page, 'wall'); await sleep(1500);
    await measure(page, 'wall'); await shots(page, 'wall');
    await closeAll(page);
  }
  if (ONLY.includes('recap')) { await hiddenClick(page, 'recap'); await sleep(1500); await measure(page, 'recap'); await shots(page, 'recap'); await closeAll(page); }
  if (ONLY.includes('about')) { await page.locator('#room-info').click(); await sleep(1500); await measure(page, 'about'); await shots(page, 'about'); await closeAll(page); }
  if (ONLY.includes('personal')) { await page.locator('#my-space').click(); await sleep(2000); await measure(page, 'personal'); await shots(page, 'personal'); await closeAll(page); }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
