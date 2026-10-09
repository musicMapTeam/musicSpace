// Showcase-layer screenshots: node shoot.js <before|after> <phone|desktop> [steps,comma,separated] [port]
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('node:fs');

const [, , PREFIX = 'after', VIEW = 'phone', STEPS = 'all', PORT = '5190'] = process.argv;
const URL = `http://127.0.0.1:${PORT}/`;
const OUT = '/tmp/space-doodle/shots/showcase';
fs.mkdirSync(OUT, { recursive: true });
const VIEWPORTS = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, narrow: { viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } };
const want = name => STEPS === 'all' || STEPS.split(',').includes(name);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function shot(page, name) {
  const file = `${OUT}/${PREFIX}-${name}-${VIEW}.png`;
  await sleep(350);
  await page.screenshot({ path: file });
  console.log('saved', file);
}
async function booted(page, timeout = 60000) {
  await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout });
  await page.evaluate(() => document.fonts.ready);
  await sleep(600);
}
async function closePanel(page) {
  const close = page.locator('#panel-close');
  if (await close.isVisible().catch(() => false)) { await close.click(); await sleep(400); }
}
async function enterRoom(page) {
  await page.locator('#join').click();
  await page.waitForSelector("form[data-form='demo-entry']");
  await page.locator("form[data-form='demo-entry'] input[name=consent]").check();
  await page.locator("form[data-form='demo-entry'] button[type=submit]").click();
  await page.waitForSelector(".frame[data-stage='room']", { timeout: 30000 });
  await sleep(800);
  await closePanel(page);
  await page.waitForSelector('#demo-tour:not([hidden])', { timeout: 15000 });
  await sleep(500);
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const opts = VIEWPORTS[VIEW];
  try {
    if (want('preparing')) {
      const ctx = await browser.newContext(opts);
      const page = await ctx.newPage();
      await page.route('**/demo/**', async route => { await sleep(4000); await route.continue(); });
      await page.goto(URL, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => (document.querySelector('#loading small')?.textContent || '').includes('布置'), null, { timeout: 15000 }).then(async () => {
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({ path: `${OUT}/${PREFIX}-loading-preparing-${VIEW}.png` });
        console.log('saved loading-preparing');
      }).catch(() => console.log('loading text not seen'));
      await page.waitForSelector('#join', { state: 'visible', timeout: 20000 });
      await page.evaluate(() => document.fonts.ready);
      await sleep(700);
      await page.locator('#join').click().catch(() => {});
      await sleep(600);
      await page.evaluate(() => { const n = document.querySelector('.demo-entry-status'); if (n) n.scrollIntoView({ block: 'center' }); });
      await sleep(300);
      const phase = await page.evaluate(() => [window.__SPACE_BOOT__, document.querySelector('.demo-entry-status')?.textContent]);
      console.log('preparing phase', JSON.stringify(phase));
      await shot(page, 'entry-preparing');
      await ctx.close();
    }
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    page.on('pageerror', e => console.log('pageerror', e.message));
    await page.goto(URL);
    await booted(page);
    if (want('first')) await shot(page, 'first-screen');
    if (want('preview')) {
      await page.evaluate(() => { document.documentElement.dataset.channel = 'preview'; });
      await sleep(300);
      await page.screenshot({ path: `${OUT}/${PREFIX}-preview-tab-${VIEW}.png`, clip: { x: 0, y: 0, width: opts.viewport.width, height: 120 } });
      console.log('saved preview-tab');
      await page.evaluate(() => { delete document.documentElement.dataset.channel; });
    }
    if (want('rescue')) {
      const has = await page.evaluate(() => Boolean(window.__SPACE_RESCUE__));
      console.log('rescue available', has);
      if (has) {
        await page.evaluate(() => { window.__SPACE_BOOT__ = 'booting'; window.__SPACE_RESCUE__.show('failed:SHOWCASE_STALE'); });
        await sleep(500);
        await shot(page, 'rescue');
        await page.evaluate(() => { window.__SPACE_RESCUE__.hide(); window.__SPACE_BOOT__ = 'ready'; });
      }
    }
    if (want('about')) {
      await page.locator('#evidence button').click();
      await page.waitForSelector('#panel:not([hidden]) .demo-about');
      await sleep(500);
      await shot(page, 'about');
      await page.evaluate(() => { const b = document.querySelector('#panel-body') || document.querySelector('#panel'); const s = [b, document.querySelector('#panel')].find(n => n && n.scrollHeight > n.clientHeight + 4); if (s) s.scrollTop = s.scrollHeight; });
      await shot(page, 'about-end');
      await closePanel(page);
    }
    if (want('entry')) {
      await page.locator('#join').click();
      await page.waitForSelector("form[data-form='demo-entry']");
      await sleep(400);
      await shot(page, 'entry');
      await page.evaluate(() => { const b = document.querySelector('#panel-body') || document.querySelector('#panel'); const s = [b, document.querySelector('#panel')].find(n => n && n.scrollHeight > n.clientHeight + 4); if (s) s.scrollTop = s.scrollHeight; });
      await shot(page, 'entry-end');
      await closePanel(page);
    }
    if (!/^(first|about|entry|preparing|memory)(,(first|about|entry|preparing|memory))*$/.test(STEPS)) {
      await enterRoom(page);
      if (want('tour')) {
        await shot(page, 'tour-1');
        await page.locator('[data-tour-toggle]').click();
        await sleep(300);
        await shot(page, 'tour-1-collapsed');
        await page.locator('[data-tour-toggle]').click();
        await sleep(300);
      }
      // step 1: the crowd sample, saved
      await page.locator('[data-tour-action="sample:sample-crowd"]').click();
      const save = page.locator('button[type=submit]', { hasText: '保存这张照片' });
      await save.waitFor({ timeout: 20000 });
      await page.waitForFunction(() => { const b = [...document.querySelectorAll('button[type=submit]')].find(x => x.textContent.includes('保存这张照片')); return b && !b.disabled; }, null, { timeout: 20000 });
      await sleep(500);
      await save.click();
      await sleep(2500);
      await closePanel(page);
      if (want('tour')) {
        // step 2 is passed over by the judge route (the wall opens after saving); forget having seen it to show the card
        await page.evaluate(() => localStorage.setItem('music-space-tour:v1', JSON.stringify({ v: 1, skipped: false, collapsed: false, seenWall: false })));
        await page.reload();
        await booted(page);
        await page.waitForSelector('#demo-tour:not([hidden])', { timeout: 15000 });
        await shot(page, 'tour-2');
        await page.locator('[data-tour-action="open:wall"]').click();
        await sleep(1500);
        await closePanel(page);
        await sleep(500);
        await shot(page, 'tour-3');
      }
      // exchange
      await page.locator('[data-tour-action="open:wall"]').click();
      await sleep(1200);
      const offer = page.locator('[data-exchange-offer]').first();
      await offer.waitFor({ timeout: 15000 });
      await offer.scrollIntoViewIfNeeded();
      await offer.click();
      await page.locator('[data-x-consent]').waitFor({ timeout: 15000 });
      await page.locator('[data-x-consent]').check();
      await sleep(400);
      await page.waitForFunction(() => { const b = document.querySelector('[data-x-send]'); return b && !b.disabled; }, null, { timeout: 15000 });
      await page.locator('[data-x-send]').click();
      await page.waitForFunction(() => document.body.textContent.includes('交换已接受'), null, { timeout: 40000 }).catch(() => console.log('no accept seen'));
      await sleep(800);
      // close whatever is open
      for (let i = 0; i < 3; i += 1) {
        const closers = page.locator('#panel-close:visible, [data-x-close]:visible, .exchange-close:visible');
        if (await closers.count()) { await closers.first().click().catch(() => {}); await sleep(400); } else break;
      }
      await page.keyboard.press('Escape').catch(() => {});
      await sleep(800);
      if (want('tour')) await shot(page, 'tour-4');
      if (want('people')) {
        await page.locator('[data-tour-action="open:people"]').click();
        await page.waitForSelector('.cast-badge', { timeout: 10000 });
        await sleep(500);
        await shot(page, 'people-badges');
        await closePanel(page);
      }
      if (want('tour')) {
        await page.locator('[data-tour-action="open:recap"]').click();
        await sleep(1500);
        await closePanel(page);
        await sleep(600);
        await shot(page, 'tour-done');
      }
      if (want('room')) {
        await page.evaluate(() => document.querySelector('#join').click());
        await page.waitForSelector('.demo-room-note', { timeout: 10000 });
        await page.locator('.demo-room-note').scrollIntoViewIfNeeded();
        await sleep(400);
        await shot(page, 'room-note');
        await closePanel(page);
      }
      if (want('readonly')) {
        const second = await ctx.newPage();
        await second.goto(URL);
        await second.waitForSelector('#space-boot-banner', { timeout: 40000 });
        await second.evaluate(() => document.fonts.ready);
        await sleep(1200);
        const file = `${OUT}/${PREFIX}-readonly-banner-${VIEW}.png`;
        await second.screenshot({ path: file });
        console.log('saved', file);
        await second.locator('#evidence button').click().catch(() => {});
        await sleep(800);
        await second.evaluate(() => { const w = document.querySelector('.demo-about-warn'); if (w) w.scrollIntoView({ block: 'center' }); });
        await sleep(300);
        await second.screenshot({ path: `${OUT}/${PREFIX}-readonly-about-${VIEW}.png` });
        console.log('saved readonly-about');
        await second.close();
      }
      if (want('toast')) {
        await page.bringToFront();
        await page.evaluate(() => { const n = document.querySelector('#toast'); n.textContent = '示例已更新，已为你重新布置'; n.classList.add('visible'); clearTimeout(n.timer); });
        await sleep(600);
        await shot(page, 'toast-healed');
      }
    }
    await ctx.close();
    if (want('memory')) {
      const mctx = await browser.newContext(opts);
      await mctx.addInitScript(() => { try { const broken = () => { throw new DOMException('blocked for QA', 'SecurityError'); }; Object.defineProperty(window, 'indexedDB', { configurable: true, get: () => ({ open: broken, deleteDatabase: broken, databases: async () => [] }) }); } catch {} });
      const page2 = await mctx.newPage();
      await page2.goto(URL);
      await page2.waitForSelector('#space-boot-banner', { timeout: 40000 }).catch(() => console.log('no memory banner'));
      await page2.evaluate(() => document.fonts.ready);
      await sleep(1200);
      await page2.screenshot({ path: `${OUT}/${PREFIX}-memory-banner-${VIEW}.png` });
      console.log('saved memory-banner');
      await mctx.close();
    }
  } catch (error) {
    console.error('FAILED', error.message);
  } finally {
    await browser.close();
  }
})();
