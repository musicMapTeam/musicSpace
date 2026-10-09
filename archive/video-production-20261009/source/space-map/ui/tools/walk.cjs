// UI walker (from the survey's walk.cjs): screenshots + visible text for every map state, phone and desktop.
// MAP_URL=<…/music-map/> LABEL=<label> [ONLY=phone,desktop] [NOGL=1] [REDUCED=1] node walk.cjs
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const BASE = process.env.MAP_URL || 'http://127.0.0.1:5296/';
const LABEL = process.env.LABEL || 'ui-after';
const OUT = `/tmp/space-map/shots/${LABEL}`;
fs.mkdirSync(OUT, { recursive: true });
const ONLY = (process.env.ONLY || 'phone,desktop').split(',');
const GPU = process.env.NOGL ? ['--disable-webgl', '--disable-3d-apis'] : ['--use-angle=metal', '--enable-gpu'];
const views = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 } },
  w320: { viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const BANNED = /示例|虚构|模拟|演示|只存在这个浏览器|仅保存在当前浏览器|仅存当前浏览器|清除浏览器数据|原版三维唱片桌|真实合作精选|不代表|未核实|核对|樱下放映|夜场唱片店|Music Map/;
const log = [];
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: GPU });
  for (const name of ONLY) {
    const context = await browser.newContext({ ...views[name], reducedMotion: process.env.REDUCED ? 'reduce' : 'no-preference' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
    let n = 0;
    const shot = async (label, opts = {}) => {
      n++;
      const file = `${OUT}/${name}-${String(n).padStart(2, '0')}-${label}.png`;
      await page.waitForTimeout(opts.wait ?? 900);
      await page.screenshot({ path: file, fullPage: !!opts.full });
      const text = await page.evaluate(banned => {
        const vis = el => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0; };
        const dialogs = [...document.querySelectorAll('dialog[open]')].map(d => '[dialog ' + d.className + '] ' + d.innerText.replace(/\s+/g, ' '));
        const toast = document.querySelector('#toast.visible')?.innerText || '';
        const body = document.body.innerText.replace(/\s+/g, ' ').slice(0, 4000);
        const overflow = document.documentElement.scrollWidth > window.innerWidth ? `HSCROLL ${document.documentElement.scrollWidth}` : '';
        const inView = el => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; };
        const small = [...document.querySelectorAll('button,a,summary,input,select,[role=button]')].filter(vis).filter(inView).filter(el => { const r = el.getBoundingClientRect(); return (r.width < 44 || r.height < 44) && !el.closest('[hidden]') && !el.closest('details:not([open])>:not(summary)') && !el.matches('.world-music-label,.world-music-link,.map-network-node.is-unknown'); }).map(el => `${(el.innerText || el.getAttribute('aria-label') || el.className).replace(/\s+/g, ' ').slice(0, 30)}(${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)})`).slice(0, 40);
        const offscreen = [...document.querySelectorAll('button,a,summary')].filter(vis).filter(el => { const r = el.getBoundingClientRect(); return r.right > innerWidth + 1 || r.left < -1; }).filter(el => !el.closest('.map-round-hand__cards,.map-route-trail,.open-catalogue__list,dialog')).map(el => (el.innerText || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').slice(0, 20)).slice(0, 10);
        const words = (body + ' ' + dialogs.join(' ') + ' ' + toast).match(new RegExp(banned, 'g')) || [];
        return { body, dialogs, toast, overflow, small, offscreen, banned: [...new Set(words)] };
      }, BANNED.source);
      log.push({ view: name, n, label, file, ...text, errors: errors.splice(0) });
      console.log(name, n, label, text.overflow, text.banned.length ? 'BANNED:' + text.banned.join(',') : '', text.offscreen.length ? 'OFFSCREEN:' + text.offscreen.join('|') : '', text.toast ? 'TOAST:' + text.toast : '');
    };
    const step = async (label, fn, opts) => { try { await fn(); await shot(label, opts); } catch (e) { console.log('FAIL', name, label, String(e).slice(0, 200)); log.push({ view: name, label, fail: String(e).slice(0, 300) }); } };
    const click = async (sel, i = 0) => { const el = page.locator(sel).nth(i); await el.scrollIntoViewIfNeeded({ timeout: 4000 }).catch(() => {}); await el.click({ timeout: 5000 }); };
    const closeMenu = () => page.evaluate(() => { const d = document.querySelector('.map-shop-menu'); if (d) d.open = false; });
    const openMenu = () => page.evaluate(() => { const d = document.querySelector('.map-shop-menu'); if (d) d.open = true; });
    // 1 home
    await page.goto(BASE, { waitUntil: 'load' });
    await page.waitForTimeout(6500);
    await shot('home', { wait: 200 });
    await step('home-search-typed', async () => { await page.fill('#home-artist-search', '王菲'); });
    await step('home-search-found', async () => { await page.fill('#home-artist-search', '林'); });
    await page.fill('#home-artist-search', '');
    await step('about', async () => { await click('#demo-help'); });
    await step('about-sources', async () => { await page.evaluate(() => document.querySelector('#about-sources')?.scrollIntoView()); });
    await page.keyboard.press('Escape');
    await step('catalogue', async () => { await click('[data-open-catalogue]'); });
    await step('catalogue-row', async () => { await click('.open-catalogue__record summary'); });
    await step('catalogue-to-sources', async () => { await click('.open-catalogue [data-about-sources]'); });
    await page.keyboard.press('Escape');
    // 2 judge entry: record shop
    await page.goto(BASE + '#/explore', { waitUntil: 'load' });
    await page.waitForTimeout(5000);
    await shot('explore-round', { wait: 200 });
    await step('round-flip', async () => { await click('[data-map-action="flip"]'); });
    await step('round-hint1', async () => { await click('[data-map-action="hint"]'); });
    await step('round-menu', async () => { await click('.map-shop-menu > summary'); });
    await step('round-sources', async () => { await page.keyboard.press('Escape'); await closeMenu(); await click('.map-round-card.is-open [data-map-action="edge"]'); });
    await step('round-sources-end', async () => { await page.evaluate(() => { const d = document.querySelector('.map-dialog'); if (d) d.scrollTop = d.scrollHeight; }); });
    await step('round-moved', async () => { await click('.map-dialog [data-map-action="close"]'); await click('.map-round-card.is-open [data-map-action="move"]'); });
    await step('round-reveal-confirm', async () => { await openMenu(); await click('[data-map-action="reveal"]'); });
    await step('ceremony', async () => { await click('[data-map-action="reveal-confirm"]'); }, { wait: 1500 });
    await step('setlist', async () => { const skip = page.locator('[data-map-action="ceremony-done"]'); if (await skip.count()) await skip.first().click({ timeout: 3000 }).catch(() => {}); await page.waitForSelector('.map-dialog--setlist', { timeout: 9000 }); });
    await step('setlist-sources', async () => { await click('.map-setlist .map-sources > summary'); });
    await step('setlist-full', async () => { await page.evaluate(() => { const d = document.querySelector('.map-dialog'); if (d) d.scrollTop = d.scrollHeight; }); });
    await step('credits', async () => { await click('.map-dialog [data-map-action="credits"]'); });
    await step('credits-sources', async () => { await click('.map-dialog--credits .map-sources > summary'); await page.evaluate(() => { const d = document.querySelector('.map-dialog'); if (d) d.scrollTop = d.scrollHeight; }); });
    await step('share-card', async () => { await click('.map-dialog [data-map-action="close"]'); await click('.map-round-hand--closed [data-map-action="save-card"], .map-save-card'); }, { wait: 2500 });
    await step('closed-bar', async () => { await page.keyboard.press('Escape'); });
    await step('share-link-paper', async () => { await page.evaluate(() => { try { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); } catch {} navigator.clipboard.writeText = () => Promise.reject(new Error('blocked')); }); await click('.map-round-hand--closed [data-map-action="share-round"]'); });
    await page.keyboard.press('Escape').catch(() => {});
    // atlas
    await step('atlas', async () => { await click('.map-round-hand--closed [data-map-action="return-roam"]'); }, { wait: 3000 });
    await step('atlas-index', async () => { await click('.map-network-index > summary'); });
    await step('atlas-edge', async () => { await click('.map-network-connection'); });
    await step('atlas-edge-kept', async () => { await click('.map-dialog [data-map-action="save"]'); });
    await step('atlas-artist', async () => { await click('.map-dialog [data-map-action="close"]'); await click('.map-network-selection [data-map-action="artist"]'); });
    await step('atlas-search', async () => { await click('.map-dialog [data-map-action="close"]'); await click('.map-studio-tools [data-map-action="search"]'); });
    await step('atlas-search-typed', async () => { await page.fill('#map-artist-search', '周'); });
    await step('atlas-relations', async () => { await click('.map-dialog [data-map-action="close"]'); await openMenu(); await click('[data-map-action="relations"]'); });
    await step('challenge-form', async () => { await click('.map-dialog [data-map-action="close"]'); await openMenu(); await click('.map-shop-menu [data-map-action="challenge"]'); });
    await page.keyboard.press('Escape').catch(() => {});
    // roam from home
    await page.goto(BASE + '#/home', { waitUntil: 'load' });
    await page.waitForTimeout(4000);
    await step('roam-start', async () => { await click('[data-home-start]'); }, { wait: 3500 });
    // a roam with progress asks before it is replaced
    if (await page.locator('.map-dialog--replace').count()) { await step('roam-replace-confirm', async () => { await click('[data-map-action="replace-confirm"]'); }, { wait: 2500 }); }
    await step('roam-walked', async () => { await click('.map-network-index > summary'); await click('.map-network-connection'); await click('.map-dialog [data-map-action="move"]'); }, { wait: 2500 });
    await step('roam-kept', async () => { await click('.map-roam-bar [data-map-action="recap"]'); });
    await step('roam-kept-save', async () => { await click('.map-dialog [data-map-action="save"]'); });
    await step('roam-recap-full', async () => { await page.evaluate(() => { const d = document.querySelector('.map-dialog'); if (d) d.scrollTop = d.scrollHeight; }); });
    await step('roam-end', async () => { await click('.map-dialog [data-map-action="close"]'); await click('.map-roam-bar [data-map-action="finish"]'); });
    await step('roam-ended-bar', async () => { await click('.map-dialog [data-map-action="close"]'); });
    // records
    await page.goto(BASE + '#/records', { waitUntil: 'load' });
    await page.waitForTimeout(4000);
    await shot('records', { wait: 200 });
    await step('records-music', async () => { await click('[data-records-filter="music"]'); });
    await step('records-music-row', async () => { await click('.saved-music .open-catalogue__record summary'); });
    await step('records-recap', async () => { await click('[data-records-filter="map"]'); await click('.map-record [data-map-action="recap"]'); });
    await step('records-delete', async () => { await click('.map-dialog [data-map-action="close"]'); await click('.map-record [data-map-action="delete"]'); });
    await page.keyboard.press('Escape').catch(() => {});
    // home returning state
    await page.goto(BASE + '#/home', { waitUntil: 'load' });
    await page.waitForTimeout(4000);
    await shot('home-returning', { wait: 200 });
    // a friend's puzzle link
    await page.goto(BASE + '?from=real-jay&to=real-gem#/explore', { waitUntil: 'load' });
    await page.waitForTimeout(4500);
    await shot('friend-note', { wait: 200 });
    await page.goto(BASE + '#/home', { waitUntil: 'load' });
    await page.waitForTimeout(3500);
    // offline back
    await step('offline-back', async () => { await context.setOffline(true); await page.evaluate(() => window.dispatchEvent(new Event('offline'))); await click('.space-map-return button'); });
    await context.setOffline(false);
    // storage conflict: another writer changes the key
    await step('storage-conflict', async () => {
      await page.evaluate(() => { localStorage.setItem('music-space-map-exploration:v1', JSON.stringify({ version: 1, map: JSON.parse(localStorage.getItem('music-space-map-exploration:v1')).map, touched: Date.now() })); window.dispatchEvent(new Event('focus')); });
      await page.waitForTimeout(600);
    });
    await context.close();
  }
  await browser.close();
  fs.writeFileSync(`${OUT}/walk.json`, JSON.stringify(log, null, 1));
})();
