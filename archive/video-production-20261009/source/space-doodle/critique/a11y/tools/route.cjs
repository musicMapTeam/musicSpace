// Walk every reachable screen state and scan it (overflow, targets, contrast, fonts).
// usage: node route.cjs <w320|w390|w768|w1440> <photo|social> [comma list of steps to scan]
const L = require('./lib.cjs');
const fs = require('fs');
const [, , vp = 'w390', group = 'photo', onlyArg = ''] = process.argv;
if (!L.VP[vp]) { console.error('unknown viewport', vp); process.exit(1); }
const only = new Set(onlyArg.split(',').filter(Boolean));
const want = n => !only.size || only.has(n);
setTimeout(() => { console.error('watchdog: 14 min'); process.exit(2); }, 14 * 60 * 1000).unref();
const sleep = L.sleep;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function scan(page, name, opts) { if (!want(name)) return; await L.scanState(page, vp, `${group === 'photo' ? 'p' : 's'}-${name}`, opts).catch(e => log('scan fail', name, e.message.split('\n')[0])); }
async function step(name, fn) { try { log('step', name); await fn(); } catch (e) { log('STEP FAIL', name, e.message.split('\n').slice(0, 3).join(' | ')); } }

async function photo(page) {
  await step('first', async () => { await scan(page, 'first'); });
  await step('about', async () => {
    const btn = page.locator('#evidence button').first();
    if (await btn.count()) { await btn.click(); await page.waitForSelector('#panel:not([hidden]) .demo-about', { timeout: 10000 }); await sleep(700); await scan(page, 'about'); }
    await L.closeEverything(page);
  });
  await step('join', async () => {
    await page.locator('#join').click();
    await page.waitForSelector('form[data-form="demo-entry"]');
    await sleep(600);
    await scan(page, 'join');
    await page.locator('form[data-form="demo-entry"] input[name=consent]').check();
    await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"] button[type=submit]')?.disabled, null, { timeout: 60000 });
    await sleep(300);
    await scan(page, 'join-ready', { maxScrollers: 1 });
    await page.locator('form[data-form="demo-entry"] button[type=submit]').click();
    await page.waitForSelector(".frame[data-stage='room']", { timeout: 30000 });
    await sleep(1500);
    const close = page.locator('#panel-close'); if (await close.isVisible().catch(() => false)) { await close.click(); await sleep(400); }
    await page.waitForSelector('#demo-tour:not([hidden])', { timeout: 15000 }).catch(() => log('no tour card'));
    await sleep(1500);
  });
  await step('room-tour', async () => { await scan(page, 'room-tour'); });
  await step('tour-collapsed', async () => {
    const t = page.locator('[data-tour-toggle]').first();
    if (await t.count()) { await t.click(); await sleep(500); await scan(page, 'tour-collapsed', { noScroll: true }); await t.click(); await sleep(400); }
  });
  await step('upload', async () => {
    await page.click('[data-tour-action="sample:sample-crowd"]');
    await page.waitForSelector('form[data-form="upload"] .photo-review', { timeout: 30000 });
    await page.waitForSelector('form[data-form="upload"] .moment-chip.is-ai, form[data-form="upload"] .moment-ai-tag', { timeout: 45000 }).catch(() => log('no AI answer'));
    await sleep(800);
    await scan(page, 'upload');
  });
  await step('wall', async () => {
    const hasView = await page.evaluate(() => Boolean(document.querySelector('form[data-form="upload"] .moment-chip[aria-pressed="true"]')));
    if (!hasView) await page.click('form[data-form="upload"] .moment-chip[data-moment-viewpoint="crowd"]');
    await page.click('form[data-form="upload"] button[type="submit"]');
    await page.waitForSelector('.moment-wall, .panel .photo-grid', { timeout: 30000 });
    await page.waitForFunction(() => document.querySelectorAll('.moment-card img, .panel .photo-item img').length >= 2, null, { timeout: 30000 }).catch(() => {});
    await sleep(1800);
    await scan(page, 'wall');
  });
  await step('compose', async () => {
    await page.click('[data-moment-badge] [data-exchange-offer]');
    await page.waitForSelector('.photo-exchanges:not([hidden]) .exchange-pair', { timeout: 20000 });
    await page.waitForFunction(() => document.querySelectorAll('.photo-exchanges .exchange-photo img').length >= 2, null, { timeout: 30000 }).catch(() => {});
    await sleep(900);
    await scan(page, 'compose');
    await page.check('.photo-exchanges [data-x-consent]');
    await page.waitForFunction(() => !document.querySelector('.photo-exchanges [data-x-send]')?.disabled, null, { timeout: 20000 });
    await page.click('.photo-exchanges [data-x-send]');
    await page.waitForSelector('.photo-exchanges .exchange-status', { timeout: 20000 });
    await sleep(600);
    await scan(page, 'pending', { maxScrollers: 1 });
  });
  await step('accepted', async () => {
    await page.waitForFunction(() => /交换已接受/.test(document.querySelector('.photo-exchanges .exchange-status')?.textContent || ''), null, { timeout: 70000 });
    await page.waitForFunction(() => document.querySelectorAll('.photo-exchanges .exchange-photo img').length >= 2, null, { timeout: 30000 }).catch(() => {});
    await sleep(1500);
    await page.evaluate(() => { const b = document.querySelector('.photo-exchanges .exchange-body'); if (b) b.scrollTop = 0; });
    await scan(page, 'accepted');
  });
  await step('exchange-list', async () => {
    const back = page.locator('.photo-exchanges [data-x-back]');
    if (await back.isVisible().catch(() => false)) { await back.click(); await sleep(1200); await scan(page, 'exchange-list', { maxScrollers: 1 }); }
    await L.closeEverything(page);
    await sleep(800);
  });
  await step('tour-after', async () => { await page.waitForSelector('#demo-tour:not([hidden])', { timeout: 5000 }).catch(() => {}); await scan(page, 'tour-after', { noScroll: true }); });
  await step('recap', async () => {
    let opened = false;
    const rb = page.locator('#room-recap'); if (await rb.isVisible().catch(() => false)) { await rb.click(); opened = true; }
    if (!opened) { const t = page.locator('[data-tour-action="open:recap"]'); if (await t.count()) { await t.first().click(); opened = true; } }
    if (!opened) await L.openKind(page, 'recap');
    await page.waitForSelector('.panel[data-kind="recap"]:not([hidden]), #panel:not([hidden]) .recap-keepsake', { timeout: 15000 }).catch(() => {});
    await page.waitForFunction(() => document.querySelector('.recap-keepsake'), null, { timeout: 20000 }).catch(() => {});
    await sleep(1800);
    await scan(page, 'recap');
  });
  await step('memory', async () => {
    const m = page.locator('#panel [data-open="memory-card"]').first();
    if (await m.count()) {
      await m.click(); await page.waitForSelector('form[data-form="memory-card"]', { timeout: 20000 });
      await sleep(1200);
      await page.locator('form[data-form="memory-card"] input[name="memory-photo"]').first().check({ timeout: 8000 }).catch(() => {});
      await scan(page, 'memory');
    }
    await L.closeEverything(page);
  });
  await step('room-panel', async () => { await page.locator('#room-info').click(); await sleep(1200); await scan(page, 'room-panel'); await L.closeEverything(page); });
  await step('nav-person', async () => {
    await page.locator('nav.camera-nav button[data-view="person"]').click(); await sleep(2500); await scan(page, 'nav-person', { noScroll: true });
  });
  await step('nav-photos', async () => {
    await page.locator('nav.camera-nav button[data-view="photos"]').click(); await sleep(2500); await scan(page, 'nav-photos', { noScroll: true });
    await L.closeEverything(page);
    await page.locator('nav.camera-nav button[data-view="overview"]').click().catch(() => {}); await sleep(2000);
    await scan(page, 'overview-after', { noScroll: true });
  });
}

async function social(page) {
  await L.enter(page);
  const skip = page.locator('button:visible', { hasText: '跳过路线' }); if (await skip.count()) await skip.first().click().catch(() => {});
  await sleep(1000);
  const ppl = await L.people(page); log('people', JSON.stringify(ppl));
  const ayao = ppl.find(p => p.label.includes('阿遥')) || ppl[0]; const xiaoman = ppl.find(p => p.label.includes('小满')) || ppl[1];
  await step('room-skipped', async () => { await scan(page, 'room', { noScroll: true }); });
  await step('person', async () => {
    await L.openKind(page, 'person', ayao.id); await sleep(800); await scan(page, 'person');
    const greet = page.locator('#panel-body [data-social-send]'); if (await greet.count()) { await greet.first().click(); await sleep(1200); }
    await L.openKind(page, 'person', xiaoman.id); const g2 = page.locator('#panel-body [data-social-send]'); if (await g2.count()) { await g2.first().click(); await sleep(1000); }
    await L.closeEverything(page);
  });
  await step('inbox-pending', async () => { await page.locator('#social-inbox').click(); await sleep(1200); await scan(page, 'inbox-pending'); await L.closeEverything(page); });
  await sleep(9000);
  await step('inbox', async () => { await page.locator('#social-inbox').click(); await sleep(1200); await scan(page, 'inbox'); await L.closeEverything(page); });
  await step('chat', async () => {
    await L.openKind(page, 'chats', ayao.id); await sleep(2000);
    const ta = page.locator('.private-chat textarea');
    if (await ta.count() && await ta.isEnabled()) { await ta.fill('刚刚返场那首我也拍到了！你在哪个位置？'); await page.locator('.private-chat .chat-composer button[type=submit]').click(); await sleep(1500); }
    await L.closeEverything(page); await sleep(8000);
    await L.openKind(page, 'chats', ayao.id); await sleep(2500);
    await scan(page, 'chat');
    const back = page.locator('.private-chat .chat-back'); if (await back.isVisible().catch(() => false)) { await back.click(); await sleep(1200); await scan(page, 'chat-list'); }
    await L.closeEverything(page);
  });
  await step('community', async () => {
    await L.openKind(page, 'conversation'); await sleep(2500);
    await scan(page, 'community-join');
    const join = page.locator('.community-panel form[data-group-join]');
    if (await join.count()) { await join.locator('input[name=consent]').check(); await join.locator('button[type=submit]').click(); await sleep(3000); }
    await scan(page, 'community');
    const menu = page.locator('.conversation-management>summary');
    if (await menu.count()) { await menu.first().click(); await sleep(500); await scan(page, 'community-menu', { noScroll: true }); await menu.first().click(); await sleep(300); }
  });
  await step('worldcup', async () => {
    const wc = page.locator('.community-panel [data-group-worldcup]');
    if (await wc.count()) {
      await wc.first().click(); await sleep(2500); await scan(page, 'worldcup');
      const cupBtn = page.locator('.worldcup-panel .entry-list button').first();
      if (await cupBtn.count()) { await cupBtn.click(); await sleep(2500); await scan(page, 'worldcup-detail'); }
      await page.locator('.worldcup-panel header [data-cup-close]').click().catch(() => {}); await sleep(1200);
    } else log('no worldcup entry');
  });
  await step('games', async () => {
    const gm = page.locator('.community-panel [data-group-games]');
    if (await gm.count()) {
      await gm.first().click(); await sleep(2500); await scan(page, 'games');
      const gBtn = page.locator('.music-games .entry-list button').first();
      if (await gBtn.count()) {
        await gBtn.click(); await sleep(2500); await scan(page, 'game-detail');
        const jf = page.locator('.music-games form[data-game-form="join"]');
        if (await jf.count()) { await jf.locator('input[name=consent]').check(); await jf.locator('button').click(); await sleep(7000); await scan(page, 'game-play'); }
      }
      await page.locator('.music-games header [data-game="close"]').click().catch(() => {}); await sleep(1200);
    } else log('no games entry');
  });
  await step('topics', async () => {
    const tp = page.locator('.community-panel [data-group-topics]');
    if (await tp.count()) { await tp.first().click(); await sleep(2500); await scan(page, 'topics'); await page.locator('.music-topics header [data-topic="close"]').click().catch(() => {}); await sleep(1200); }
    await L.closeEverything(page);
  });
  await step('corner', async () => { await L.openKind(page, 'corners', ayao.id); await sleep(2500); await scan(page, 'corner'); await L.closeEverything(page); });
  await step('personal', async () => { await page.locator('#my-space').click(); await sleep(2500); await scan(page, 'personal'); await L.closeEverything(page); });
  await step('wardrobe', async () => { await page.locator('#my-look').click(); await sleep(2500); await scan(page, 'wardrobe'); await L.closeEverything(page); });
  await step('friends', async () => { await L.openKind(page, 'friends'); await sleep(1200); await scan(page, 'friends'); await L.closeEverything(page); });
  await step('communities', async () => { await L.openKind(page, 'communities'); await sleep(2000); await scan(page, 'communities'); await L.closeEverything(page); });
  await step('about-room', async () => { const btn = page.locator('#evidence button').first(); if (await btn.count()) { await btn.click(); await sleep(1200); await scan(page, 'about-room', { maxScrollers: 1 }); } await L.closeEverything(page); });
  await step('room-entry-note', async () => { await page.evaluate(() => document.querySelector('#join')?.click()); await sleep(1200); await scan(page, 'room-entry', { maxScrollers: 1 }); await L.closeEverything(page); });
}

(async () => {
  const b = await L.launch();
  try {
    const { page, errors } = await L.open(b, vp);
    if (group === 'photo') await photo(page); else await social(page);
    fs.mkdirSync(`${L.ROOT}/data/${L.RUN}`, { recursive: true }); fs.writeFileSync(`${L.ROOT}/data/${L.RUN}/${vp}-${group}-errors.json`, JSON.stringify(errors));
  } catch (e) { log('FATAL', e.message.split('\n').slice(0, 4).join(' | ')); }
  finally { await b.close(); log('done'); }
})();
