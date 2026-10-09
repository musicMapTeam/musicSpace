// Text audit walk of the room (static showcase), fresh context: visits every panel a visitor can reach and dumps its text.
//   node audit-room.cjs <phone|desktop> <baseUrl> <outDir> [shotDir]
// Taps are real taps/clicks on visible elements; a step that cannot be reached is logged as MISS and the walk goes on.
const { launch, openContext, act, dump, sleep, mkdir, fs } = require('./lib.cjs');
const [kind = 'phone', BASE = 'http://127.0.0.1:4783/musicSpace/', OUT_ARG, SHOT_DIR] = process.argv.slice(2);
const OUT = mkdir(OUT_ARG || `/tmp/space-final/rc2/audit-room/${kind}`);
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
const report = { kind, base: BASE, states: {}, misses: [], shots: [] };
let browser, rec, n = 0;
const watchdog = setTimeout(() => { log('WATCHDOG'); finish(3); }, 285000); watchdog.unref();
async function finish(code) {
  if (rec) { const { setPhase, ...plain } = rec; report.rec = plain; }
  fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
  try { await browser?.close(); } catch {}
  process.exit(code);
}

(async () => {
  browser = await launch();
  const o = await openContext(browser, kind, BASE);
  const { ctx, page } = o; rec = o.rec;
  const tap = (target, label, opts) => act(page, kind, target, label, rec, { timeout: 8000, ...opts });
  const vis = sel => page.locator(sel).filter({ visible: true }).first();
  const byText = (scope, text) => page.locator(`${scope} :is(button,a,summary,[role=button])`).filter({ hasText: text }).filter({ visible: true }).first();
  async function state(label, shotName) {
    n += 1;
    await sleep(600);
    const d = await dump(page);
    const key = `${String(n).padStart(2, '0')}-${label}`;
    report.states[key] = d;
    await page.screenshot({ path: `${OUT}/${key}.png` });
    if (SHOT_DIR && shotName) { const f = `${SHOT_DIR}/${kind}-${shotName}.png`; await page.screenshot({ path: f }); report.shots.push(f); }
    log('state', key, d.modal ? `modal=${d.modal}` : '', Object.keys(d.sysFallback).length ? `SYSFONT ${JSON.stringify(d.sysFallback)}` : '');
    return d;
  }
  async function closeAll() {
    for (let i = 0; i < 3; i++) {
      let did = false;
      for (const sel of ['.private-chat:not([hidden]) .chat-close', '.photo-exchanges:not([hidden]) [data-x-close]', '.community-panel:not([hidden]) [data-group="close"]', '.wardrobe:not([hidden]) [data-wardrobe-cancel]', '#panel:not([hidden]) #panel-close']) {
        const c = vis(sel);
        if (await c.count()) { await c.evaluate(el => el.click()).catch(() => {}); await sleep(450); did = true; }
      }
      const openSection = await page.evaluate(() => [...document.querySelectorAll('[role="dialog"]:not([hidden]), dialog[open]')].filter(d => d.getClientRects().length).map(d => d.className || d.id).slice(0, 3));
      if (openSection.length) { await page.keyboard.press('Escape').catch(() => {}); await sleep(400); did = true; }
      if (!did) break;
    }
  }
  async function visit(label, fn, shotName) {
    try { rec.setPhase(label); await fn(); return await state(label, shotName); }
    catch (e) { const why = String(e.message || e).split('\n')[0].slice(0, 200); report.misses.push(`${label}: ${why}`); log('MISS', label, why); await page.screenshot({ path: `${OUT}/MISS-${label}.png` }).catch(() => {}); return null; }
  }
  const openPanelKind = k => page.waitForFunction(kk => { const p = document.querySelector('#panel'); return p && !p.hidden && p.dataset.kind === kk; }, k, { timeout: 12000 });

  // ---- before joining
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 120000 });
  await page.waitForFunction(() => document.querySelector('#loading')?.hidden === true, null, { timeout: 60000 }).catch(() => {});
  await sleep(1500);
  await state('lobby');
  await visit('lobby-more', async () => { await tap('#room-info', 'lobby ···'); await sleep(800); });
  await closeAll();
  await visit('lobby-about', async () => { await tap('[data-open="about"]', 'lobby 关于'); await openPanelKind('about'); });
  await closeAll();
  await visit('entry', async () => { await tap('#join', '进入现场'); await page.waitForSelector('form[data-form="demo-entry"]'); });
  await visit('entry-host', async () => { await tap('#panel details.demo-entry-more > summary', 'host details'); await sleep(500); });
  await visit('host-create', async () => { const b = page.locator('#panel details.demo-entry-more button').filter({ visible: true }).first(); if (!(await b.count())) throw new Error('no button inside the host details'); await tap(b, '开一个房间'); await sleep(1500); });
  await closeAll();
  // join
  await tap('#join', '进入现场');
  await page.waitForSelector('form[data-form="demo-entry"]');
  await sleep(500);
  await tap('form[data-form="demo-entry"] label.consent', 'consent');
  await page.waitForFunction(() => { const b = document.querySelector('form[data-form="demo-entry"] button[type="submit"]'); return b && !b.disabled; }, null, { timeout: 90000 });
  await tap('form[data-form="demo-entry"] button[type="submit"]', '进入现场');
  await page.waitForSelector('[data-tour-action="sample:sample-crowd"]', { timeout: 60000 });
  await sleep(2500);
  await state('room-tour-1');
  // ---- photos
  await visit('upload-own', async () => { await tap(byText('.demo-tour', '用我自己的照片'), '用我自己的照片'); await openPanelKind('upload'); });
  await visit('upload-own-photo', async () => {
    await page.setInputFiles('form[data-form="upload"] input[type="file"][name="photo"]', '/tmp/space-final/rc2/tools/own.jpg');
    await page.waitForSelector('form[data-form="upload"] .photo-review', { timeout: 20000 });
    await page.waitForFunction(() => /^(sure|unsure|off)/.test(document.querySelector('form[data-form="upload"] [data-ai-line]')?.getAttribute('data-ai-key') || ''), null, { timeout: 90000 }).catch(() => {});
  });
  await visit('upload-own-time', async () => { const b = byText('#panel', '21:47'); if (!(await b.count())) throw new Error('no 21:47 button'); await tap(b, '把拍摄时间设成 21:47'); await sleep(700); });
  await closeAll();
  await visit('upload-stage', async () => { await tap('[data-tour-action="sample:sample-stage"]', '舞台那张'); await openPanelKind('upload'); await page.waitForFunction(() => /^(sure|unsure|off)/.test(document.querySelector('form[data-form="upload"] [data-ai-line]')?.getAttribute('data-ai-key') || ''), null, { timeout: 90000 }); });
  await visit('upload-stage-saved', async () => {
    const pressed = await page.evaluate(() => Boolean(document.querySelector('form[data-form="upload"] .moment-chip[aria-pressed="true"]')));
    if (!pressed) await tap('form[data-form="upload"] .moment-chip[data-moment-viewpoint="stage"]', 'viewpoint 舞台');
    await tap('form[data-form="upload"] button[type="submit"]', '保存这张照片');
    await page.waitForFunction(() => { const p = document.querySelector('#panel'); return p && !p.hidden && p.dataset.kind === 'wall'; }, null, { timeout: 20000 });
    await sleep(1500);
  });
  await visit('photo-detail', async () => { await tap('#panel [data-moment-photo]', 'a photo on the wall'); await sleep(1500); });
  await closeAll();
  await visit('room-tour-after-photo', async () => { await sleep(800); });
  await visit('photos-view', async () => { await tap('button[data-view="photos"]', 'nav 照片墙'); await sleep(1800); });
  await visit('wall', async () => { await tap(byText('body', '看照片'), '看照片'); await page.waitForFunction(() => { const p = document.querySelector('#panel'); return p && !p.hidden && p.dataset.kind === 'wall'; }, null, { timeout: 15000 }); await sleep(1200); });
  // exchange through the tour's wall step when it is offered, else through the wall
  await visit('exchange-compose', async () => {
    const offer = vis('#panel [data-exchange-offer]');
    if (!(await offer.count())) throw new Error('no exchange offer on the wall');
    await tap(offer, '和 TA 交换这个视角');
    await page.waitForSelector('.photo-exchanges:not([hidden]) [data-x-consent]', { timeout: 15000 });
  });
  await visit('exchange-accepted', async () => {
    await tap('.photo-exchanges [data-x-consent]', 'consent');
    await page.waitForFunction(() => { const b = document.querySelector('.photo-exchanges [data-x-send]'); return b && !b.disabled; });
    await tap('.photo-exchanges [data-x-send]', 'send');
    await page.waitForFunction(() => /交换已接受/.test(document.querySelector('.photo-exchanges .exchange-status')?.innerText || ''), null, { timeout: 45000 });
    await sleep(1200);
  });
  await closeAll();
  await visit('room-tour-after-exchange', async () => { await sleep(600); });
  // ---- people, a friend, a chat
  await visit('people', async () => { await tap('button[data-view="person"]', 'nav 同场的人'); await openPanelKind('people'); });
  let peer = null;
  await visit('person', async () => {
    const people = await page.evaluate(() => [...document.querySelectorAll('#panel [data-person], #panel [data-open="person"]')].map(b => ({ id: b.dataset.person || b.dataset.id, text: b.innerText })));
    peer = people.find(p => /小满/.test(p.text)) || people.find(p => /北屿/.test(p.text));
    await tap(`#panel [data-person="${peer.id}"], #panel [data-open="person"][data-id="${peer.id}"]`, 'person');
    await openPanelKind('person');
  });
  await visit('person-waved', async () => { await tap('#panel [data-social-send]', '招个手'); await sleep(900); });
  await visit('person-friend', async () => { await page.waitForFunction(() => /你们已经是朋友了/.test(document.querySelector('#panel')?.innerText || ''), null, { timeout: 30000 }); });
  await visit('person-feedback', async () => { await tap(byText('#panel', '向本场房主反馈'), '反馈'); await sleep(1200); });
  await closeAll();
  await visit('person-block-confirm', async () => {
    await tap('button[data-view="person"]', 'nav 同场的人'); await openPanelKind('people');
    await tap(`#panel [data-person="${peer.id}"], #panel [data-open="person"][data-id="${peer.id}"]`, 'person'); await openPanelKind('person');
    await tap(byText('#panel', '屏蔽这个人'), '屏蔽这个人'); await sleep(900);
  });
  await closeAll();
  await visit('corner-invite', async () => {
    await tap('button[data-view="person"]', 'nav 同场的人'); await openPanelKind('people');
    await tap(`#panel [data-person="${peer.id}"], #panel [data-open="person"][data-id="${peer.id}"]`, 'person'); await openPanelKind('person');
    await tap(byText('#panel', '邀请共同创作'), '邀请共同创作'); await sleep(1500);
  });
  await closeAll();
  await visit('chat-thread', async () => {
    await tap('button[data-view="person"]', 'nav 同场的人'); await openPanelKind('people');
    await tap(`#panel [data-person="${peer.id}"], #panel [data-open="person"][data-id="${peer.id}"]`, 'person'); await openPanelKind('person');
    await tap(byText('#panel', '私聊'), '私聊');
    await page.waitForSelector('.private-chat:not([hidden])', { timeout: 15000 });
    await page.waitForFunction(() => (document.querySelector('.chat-messages')?.innerText || '').trim().length > 0, null, { timeout: 20000 });
    await page.locator('#chat-text').fill('散场后还去吃宵夜吗？');
    await tap('.chat-composer button[type="submit"]', 'send');
    await sleep(6000);
  });
  await closeAll();
  await visit('social-inbox', async () => { await tap('#social-inbox', '♡'); await sleep(1500); });
  await visit('chats-list', async () => { const b = vis('#panel [data-open="chats"]'); if (await b.count()) { await tap(b, '打开私聊'); await sleep(1500); } else throw new Error('no 打开私聊 in ♡'); });
  await closeAll();
  // ---- the room panel (···) and what hangs off it
  await visit('room-panel', async () => { await tap('#room-info', '···'); await sleep(1000); });
  await visit('participation-change', async () => { const q = vis('#panel form[data-form="participation"] input[value="quiet"]'); if (await q.count()) { await page.locator('#panel form[data-form="participation"] label').filter({ hasText: '安静参与' }).first().click(); await sleep(500); } else throw new Error('no participation form'); });
  await visit('recap', async () => { await tap(byText('#panel', '回看这一晚'), '回看这一晚'); await sleep(2500); });
  await visit('recap-bottom', async () => { await page.evaluate(() => { const p = document.querySelector('#panel'); if (p) p.scrollTop = p.scrollHeight; }); await sleep(600); });
  await visit('memory-card', async () => { const b = vis('#panel [data-open="memory-card"]'); if (await b.count()) await tap(b, '纪念卡'); else await tap(byText('#panel', '纪念'), '纪念卡'); await sleep(2500); });
  await closeAll();
  await visit('my-rooms', async () => { await tap('#room-info', '···'); await sleep(800); await tap(byText('#panel', '我的现场'), '我的现场'); await sleep(1500); });
  await closeAll();
  await visit('corners', async () => { await tap('#room-info', '···'); await sleep(800); await tap(byText('#panel', '我的创作与邀请'), '我的创作与邀请'); await sleep(2000); });
  await closeAll();
  await visit('communities', async () => { await tap('#room-info', '···'); await sleep(800); await tap(byText('#panel', 'Livehouse 乐迷社群'), 'Livehouse 乐迷社群'); await sleep(2000); });
  await closeAll();
  await visit('group-chat', async () => { await tap('#room-info', '···'); await sleep(800); await tap(byText('#panel', '散场聊天室'), '散场聊天室'); await page.waitForSelector('.community-panel:not([hidden])', { timeout: 15000 }); await sleep(1800); });
  await visit('group-chat-joined', async () => {
    const f = vis('.community-panel form[data-group-join] label');
    if (await f.count()) { await tap(f, 'consent'); await tap('.community-panel form[data-group-join] button[type="submit"]', '加入，继续聊'); await sleep(2500); }
    else throw new Error('no join form in the room chat');
  });
  for (const [label, sel] of [['games', '[data-group-games]'], ['topics', '[data-group-topics]'], ['worldcup', '[data-group-worldcup]']]) {
    await visit(`group-${label}`, async () => {
      if (!(await vis(`.community-panel ${sel}`).count())) { await closeAll(); await tap('#room-info', '···'); await sleep(800); await tap(byText('#panel', '散场聊天室'), '散场聊天室'); await page.waitForSelector('.community-panel:not([hidden])'); await sleep(1500); }
      await tap(`.community-panel ${sel}`, label); await sleep(2200);
    });
    await closeAll();
  }
  await visit('group-chat-settings', async () => { await tap('#room-info', '···'); await sleep(800); await tap(byText('#panel', '散场聊天室'), '散场聊天室'); await page.waitForSelector('.community-panel:not([hidden])'); await sleep(1500); const s = vis('.community-panel .conversation-management > summary'); await tap(s, '设置与管理 ···'); await sleep(700); });
  await visit('community', async () => {
    let linked = vis('.community-panel [data-group="linked"]');
    if (!(await linked.count())) { const s = vis('.community-panel .conversation-management > summary'); if (await s.count()) { await tap(s, '设置与管理'); await sleep(500); } linked = vis('.community-panel [data-group="linked"]'); }
    await tap(linked, '这家 Livehouse 的乐迷社群'); await sleep(2200);
  }, 'room-09-community');
  await visit('community-joined', async () => {
    const f = vis('.community-panel form[data-group-join] label');
    if (await f.count()) { await tap(f, 'consent'); await tap('.community-panel form[data-group-join] button[type="submit"]', '加入'); await sleep(2500); }
    else throw new Error('no join form in the community');
  });
  await visit('community-next-show', async () => {
    let b = vis('.community-panel [data-group-space]');
    if (!(await b.count())) { const s = vis('.community-panel .conversation-management > summary'); if (await s.count()) { await tap(s, '设置与管理'); await sleep(500); } b = vis('.community-panel [data-group-space]'); }
    await tap(b, '下一场预告'); await sleep(2200);
  });
  await closeAll();
  // ---- top bar and nav
  await visit('wardrobe', async () => { await tap('#my-look', '我的小人'); await sleep(2200); });
  await closeAll();
  await visit('my-space', async () => { await tap('#my-space', '我的空间'); await sleep(2200); });
  await closeAll();
  await visit('overview', async () => { await tap('button[data-view="overview"]', '全景'); await sleep(2000); });
  await visit('scene-details', async () => { await tap('#scene-details', '场次详情'); await sleep(1200); });
  await closeAll();
  await visit('leave-confirm', async () => { await tap('#room-info', '···'); await sleep(800); await tap('#panel [data-open="leave"]', '离开本场'); await sleep(1000); });
  await closeAll();
  await visit('about', async () => { await tap('[data-open="about"]', '关于 Music Space'); await openPanelKind('about'); });
  await closeAll();
  await visit('tour-final', async () => {
    // walk the rest of the 第一次来 card if it is still showing
    for (let i = 0; i < 4; i++) { const a = vis('.demo-tour [data-tour-action]'); if (!(await a.count())) break; const t = await a.innerText(); if (/人海|舞台|照片/.test(t)) break; await tap(a, `tour ${t}`); await sleep(1500); await closeAll(); }
  });
  rec.setPhase('end');
  await ctx.close();
  log('done', `${Object.keys(report.states).length} states, ${report.misses.length} misses; /api ${rec.api.length}, third-party ${rec.thirdParty.length}, outside ${rec.outsidePrefix.length}, failed ${rec.failed.length}, HTTP>=400 ${rec.badStatus.length}, console ${rec.console.length}, page errors ${rec.pageErrors.length}`);
  await finish(0);
})().catch(async e => { log('FATAL', String(e.message).split('\n')[0]); await finish(1); });
