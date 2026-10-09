// Node (server profile) screens on a throwaway local room server: lobby caption, entry, profile, create, room + invite, people alone,
// close/leave confirms, rooms, and a second visitor's preview of the invite link.
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const S = require('/tmp/space-copy/panels-inv/sheets.cjs');
const OUT = '/tmp/space-copy/shell-work/shots';
const BASE = 'http://127.0.0.1:5899/';
const VP = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, desktop: { viewport: { width: 1440, height: 900 } }, narrow: { viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } };
const t = setTimeout(() => { console.log('WATCHDOG'); process.exit(3); }, 280000); t.unref();
const kind = process.argv[2] || 'desktop';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const text = (page, sel = '#panel-body') => page.evaluate(sel => document.querySelector(sel)?.innerText.replace(/\n+/g, ' | ').slice(0, 900), sel);
async function overflow(page) { return page.evaluate(() => { const root = document.querySelector('#panel'); if (!root || root.hidden) return 'no panel'; const rb = root.getBoundingClientRect(); const bad = []; for (const el of root.querySelectorAll('*')) { if (!el.getClientRects().length) continue; const b = el.getBoundingClientRect(); if (b.right > rb.right + 1 || b.left < rb.left - 1) bad.push(`${el.tagName.toLowerCase()}「${el.textContent.trim().slice(0, 16)}」`); } return { docOverflowX: document.documentElement.scrollWidth > innerWidth + 1, bad: bad.slice(0, 6) }; }); }
async function shot(page, label) { await sleep(350); await page.screenshot({ path: `${OUT}/node-${kind}-${label}.png` }); const tall = await page.evaluate(() => { const p = document.querySelector('#panel'); return p && !p.hidden && p.scrollHeight > p.clientHeight + 4; }); if (tall) { await page.evaluate(() => { const p = document.querySelector('#panel'); p.scrollTop = p.scrollHeight; }); await sleep(250); await page.screenshot({ path: `${OUT}/node-${kind}-${label}-end.png` }); await page.evaluate(() => { document.querySelector('#panel').scrollTop = 0; }); } }
async function sheet(page, label, open) { if (open) { await S.clickHidden(page, open); await sleep(1000); } console.log(`--- ${label}: ${await text(page)}`); console.log('    overflow', JSON.stringify(await overflow(page))); await shot(page, label); }
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    const context = await browser.newContext({ ...VP[kind], locale: 'zh-CN' }); const page = await context.newPage(); page.setDefaultTimeout(30000);
    const errors = []; page.on('pageerror', e => errors.push(String(e.message).slice(0, 160)));
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('#loading')?.hidden === true, null, { timeout: 60000 }).catch(() => console.log('loading not hidden'));
    await sleep(1500);
    console.log('--- lobby status:', await text(page, '#render-status'), '| presence:', await text(page, '.presence'), '| footer:', JSON.stringify(await page.evaluate(() => document.querySelector('footer').innerHTML)), '| caption:', await page.evaluate(() => { const c = document.querySelector('.desktop-caption'); return c && c.getClientRects().length ? c.innerText.replace(/\n+/g, ' | ') : 'hidden'; }));
    await shot(page, 'lobby');
    await page.locator('#join').click(); await sleep(800);
    await sheet(page, 'entry', null);
    await page.locator('#panel [data-open="create"]').click(); await sleep(800);
    await sheet(page, 'profile', null);
    await page.fill('form[data-form="profile"] input[name="name"]', '月台主理人');
    await page.locator('form[data-form="profile"] button[type="submit"]').click(); await sleep(2500);
    await sheet(page, 'create', null);
    await page.fill('form[data-form="create"] input[name="title"]', '周五的最后一首');
    await page.fill('form[data-form="create"] input[name="venue"]', '月台 Livehouse');
    await page.check('form[data-form="create"] input[name="consent"]', { force: true });
    await page.locator('form[data-form="create"] button[type="submit"]').click(); await sleep(4000);
    console.log('--- room scene:', await text(page, '#scene-heading'), '|', await text(page, '#scene-code'), '| presence:', await text(page, '.presence'), '| track:', await text(page, '.track'), '| status:', await text(page, '#render-status'));
    await shot(page, 'room-scene');
    await sheet(page, 'room', { open: 'room' });
    const invite = await page.evaluate(() => location.href);
    await sheet(page, 'people', { open: 'people' });
    await sheet(page, 'wall', { open: 'wall' });
    await sheet(page, 'close', { open: 'close' });
    await sheet(page, 'rooms', { open: 'rooms' });
    await sheet(page, 'social', { open: 'social' });
    // a second visitor opens the invite link
    const guest = await browser.newContext({ ...VP[kind], locale: 'zh-CN' }); const gp = await guest.newPage(); gp.on('pageerror', e => errors.push('guest: ' + String(e.message).slice(0, 160)));
    await gp.goto(invite, { waitUntil: 'domcontentloaded' }); await gp.waitForFunction(() => document.querySelector('#panel')?.dataset.kind === 'preview' && !document.querySelector('#panel').hidden, null, { timeout: 60000 }).catch(() => console.log('no preview panel'));
    await sleep(1200);
    console.log('--- guest preview:', await text(gp)); await gp.screenshot({ path: `${OUT}/node-${kind}-guest-preview.png` });
    await gp.locator('#panel [data-open="profile"]').click(); await sleep(800);
    await gp.fill('form[data-form="profile"] input[name="name"]', '小满同学');
    await gp.locator('form[data-form="profile"] button[type="submit"]').click(); await sleep(2500);
    console.log('--- guest join form:', await text(gp)); await gp.screenshot({ path: `${OUT}/node-${kind}-guest-join.png` });
    await gp.check('form[data-form="join"] input[name="consent"]', { force: true });
    await gp.locator('form[data-form="join"] input[name="participation"][value="open"]').check({ force: true });
    await gp.locator('form[data-form="join"] button[type="submit"]').click(); await sleep(4000);
    console.log('--- guest in room:', await text(gp, '.presence'));
    await S.clickHidden(gp, { open: 'people' }); await sleep(1200);
    console.log('--- guest people:', await text(gp)); await gp.screenshot({ path: `${OUT}/node-${kind}-guest-people.png` });
    const host = await gp.evaluate(() => document.querySelector('#panel [data-person]')?.dataset.person);
    if (host) { await S.clickHidden(gp, { person: host }); await sleep(3000); console.log('--- guest sees host:', await text(gp)); await gp.screenshot({ path: `${OUT}/node-${kind}-guest-person-host.png` }); }
    await guest.close();
    console.log('errors', JSON.stringify(errors));
    await context.close();
  } finally { await browser.close(); }
})().catch(e => { console.error('FAILED', e); process.exit(1); });
