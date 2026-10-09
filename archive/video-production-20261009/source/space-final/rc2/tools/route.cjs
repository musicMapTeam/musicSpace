// The judge route on a production build, in a fresh context:
//   进入现场 → consent → 进入现场 → 第一次来 「人海那张」 → 保存这张照片 → 照片墙 「和 TA 交换这个视角」 → consent → 「把这两张交给对方确认 ↗」 →
//   「交换已接受」 → a chat reply (同场的人 → 北屿 → 招个手 → 私聊 → reply) → 关于 Music Space → 「音乐探索」 → the map → open a 「来源」 →
//   「← 返回现场」.
// Every tap is a real tap/click on a visible element. Records /api, third-party and outside-prefix requests, failed requests, HTTP errors,
// console errors/warnings and page errors; dumps the text of every state for the copy audit.
//   node route.cjs <phone|desktop> <baseUrl> <outDir> [shotDir]
const { launch, openContext, act, dump, sleep, mkdir, fs } = require('./lib.cjs');
const [kind = 'phone', BASE = 'http://127.0.0.1:4783/musicSpace/', OUT_ARG, SHOT_DIR] = process.argv.slice(2);
const OUT = mkdir(OUT_ARG || `/tmp/space-final/rc2/route/${kind}`);
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
const report = { kind, base: BASE, steps: [], states: {}, shots: [] };
let browser, rec;
const watchdog = setTimeout(() => { log('WATCHDOG: giving up after 270 s'); finish(3); }, 270000); watchdog.unref();
async function finish(code) {
  if (rec) { const { setPhase, ...plain } = rec; report.rec = plain; }
  fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
  try { await browser?.close(); } catch {}
  process.exit(code);
}
function step(name, ok, detail = '') { report.steps.push({ name, ok, detail, t: ((Date.now() - t0) / 1000).toFixed(1) }); log(ok ? 'OK  ' : 'FAIL', name, detail); }
async function state(page, label, shotName) {
  await sleep(450);
  const d = await dump(page);
  report.states[label] = d;
  await page.screenshot({ path: `${OUT}/${label}.png` });
  if (SHOT_DIR && shotName) { const file = `${SHOT_DIR}/${kind}-${shotName}.png`; await page.screenshot({ path: file }); report.shots.push(file); }
  return d;
}
const panelKind = page => page.evaluate(() => { const p = document.querySelector('#panel'); return p && !p.hidden ? p.dataset.kind : null; });

(async () => {
  browser = await launch();
  const o = await openContext(browser, kind, BASE);
  const { ctx, page } = o; rec = o.rec;
  const tap = (target, label, opts) => act(page, kind, target, label, rec, opts);

  // 1. first screen
  rec.setPhase('first-screen');
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 120000 });
  await page.waitForFunction(() => document.querySelector('#loading')?.hidden === true, null, { timeout: 60000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await sleep(1500);
  report.gl = await page.evaluate(() => { const c = document.createElement('canvas'); const g = c.getContext('webgl2') || c.getContext('webgl'); if (!g) return 'no webgl'; const d = g.getExtension('WEBGL_debug_renderer_info'); return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER); });
  report.channelHint = await page.evaluate(() => document.body.innerText.includes('预览版'));
  step('boot ready', true, `GL ${report.gl}; 预览版 on the page: ${report.channelHint}`);
  await state(page, 'room-01-first-screen', 'room-01-first-screen');

  // 2. 进入现场 → the entry sheet
  rec.setPhase('join');
  const joinText = await tap('#join', 'lobby 进入现场');
  await page.waitForSelector('form[data-form="demo-entry"]', { timeout: 30000 });
  await sleep(800);
  step('lobby button', joinText === '进入现场', `#join reads 「${joinText}」`);
  report.nickname = await page.evaluate(() => document.querySelector('form[data-form="demo-entry"] input[name="name"]')?.value || null);
  await state(page, 'room-02-join', 'room-02-join');
  await page.evaluate(() => { const d = document.querySelector('#panel details.demo-entry-more'); if (d) d.open = true; });
  await state(page, 'room-02b-join-host-details');
  await page.evaluate(() => { const d = document.querySelector('#panel details.demo-entry-more'); if (d) d.open = false; });

  // 3. consent → 进入现场
  await tap('form[data-form="demo-entry"] label.consent', 'entry consent');
  const checked = await page.isChecked('form[data-form="demo-entry"] input[name="consent"]');
  step('entry consent', checked, `checked by tapping its label: ${checked}`);
  if (!checked) throw new Error('consent label did not check the box');
  await page.waitForFunction(() => { const b = document.querySelector('form[data-form="demo-entry"] button[type="submit"]'); return b && !b.disabled; }, null, { timeout: 90000 });
  const enterText = await tap('form[data-form="demo-entry"] button[type="submit"]', 'entry submit');
  step('entry submit', enterText === '进入现场', `submit reads 「${enterText}」`);

  // 4. the 第一次来 card; 收起 for the room itself, 展开 again, then 「人海那张」
  rec.setPhase('room');
  await page.waitForSelector('[data-tour-action="sample:sample-crowd"]', { timeout: 60000 });
  await sleep(2500);
  const tourTitle = await page.evaluate(() => document.querySelector('.demo-tour-title')?.innerText.replace(/\s+/g, ' ').trim());
  step('onboarding card', /^第一次来 1\/4/.test(tourTitle || ''), `「${tourTitle}」`);
  await state(page, 'room-04-onboarding-card', 'room-04-onboarding-card');
  const toggle = page.locator('[data-tour-toggle]').filter({ visible: true }).first();
  if (await toggle.count()) {
    const t1 = await tap(toggle, 'tour 收起');
    await sleep(900);
    await state(page, 'room-03-room', 'room-03-room');
    const t2 = await tap(page.locator('[data-tour-toggle]').filter({ visible: true }).first(), 'tour 展开');
    await sleep(700);
    step('card collapse/expand', t1 === '收起' && t2 === '展开', `「${t1}」 then 「${t2}」`);
  } else step('card collapse/expand', false, 'no [data-tour-toggle]');
  rec.setPhase('upload');
  const sampleText = await tap('[data-tour-action="sample:sample-crowd"]', 'tour 人海那张');
  step('tour sample button', sampleText === '人海那张', `「${sampleText}」`);

  // 5. the upload form, AI settles, 保存这张照片
  await page.waitForSelector('form[data-form="upload"] .photo-review', { timeout: 30000 });
  const ai = await page.waitForFunction(() => /^(sure|unsure|off)/.test(document.querySelector('form[data-form="upload"] [data-ai-line]')?.getAttribute('data-ai-key') || ''), null, { timeout: 90000 }).then(() => true).catch(() => false);
  await sleep(700);
  const aiKey = await page.evaluate(() => document.querySelector('form[data-form="upload"] [data-ai-line]')?.getAttribute('data-ai-key'));
  const aiLine = await page.evaluate(() => document.querySelector('form[data-form="upload"] [data-ai-line]')?.innerText.trim());
  step('upload AI settled', ai, `data-ai-key=${aiKey}; 「${aiLine}」`);
  await state(page, 'room-05-upload', 'room-05-upload');
  const pressed = await page.evaluate(() => Boolean(document.querySelector('form[data-form="upload"] .moment-chip[aria-pressed="true"]')));
  if (!pressed) await tap('form[data-form="upload"] .moment-chip[data-moment-viewpoint="crowd"]', 'viewpoint 人海');
  const saveText = await tap('form[data-form="upload"] button[type="submit"]', 'upload save');
  step('upload save', saveText === '保存这张照片', `「${saveText}」 (viewpoint ${pressed ? 'preselected by the AI' : 'picked by hand'})`);

  // 6. the wall → 和 TA 交换这个视角
  rec.setPhase('wall');
  const offer = await page.locator('#panel [data-exchange-offer]').first().waitFor({ state: 'visible', timeout: 30000 }).then(() => true).catch(() => false);
  step('wall after save', offer, `panel: ${await panelKind(page)}`);
  if (!offer) throw new Error('no exchange offer on the wall');
  await sleep(900);
  await state(page, 'room-06-wall', 'room-06-wall');
  const offerText = await tap('#panel [data-exchange-offer]', 'wall offer');
  step('wall offer', offerText === '和 TA 交换这个视角', `「${offerText}」`);

  // 7. compose → consent → 把这两张交给对方确认 ↗ → 交换已接受
  rec.setPhase('exchange');
  await page.waitForSelector('.photo-exchanges:not([hidden]) [data-x-consent]', { timeout: 30000 });
  await sleep(800);
  await state(page, 'room-06b-exchange-compose');
  await tap('.photo-exchanges [data-x-consent]', 'exchange consent');
  await page.waitForFunction(() => { const b = document.querySelector('.photo-exchanges [data-x-send]'); return b && !b.disabled; }, null, { timeout: 30000 });
  const sendText = await tap('.photo-exchanges [data-x-send]', 'exchange send');
  const sentAt = Date.now();
  step('exchange send', sendText === '把这两张交给对方确认 ↗', `「${sendText}」`);
  await page.waitForSelector('.photo-exchanges .exchange-status', { timeout: 30000 });
  await state(page, 'room-06c-exchange-pending');
  const accepted = await page.waitForFunction(() => /交换已接受/.test(document.querySelector('.photo-exchanges .exchange-status')?.innerText || ''), null, { timeout: 45000 }).then(() => true).catch(() => false);
  const statusText = await page.evaluate(() => document.querySelector('.photo-exchanges .exchange-status')?.innerText.trim());
  step('交换已接受', accepted, `「${statusText}」 ${((Date.now() - sentAt) / 1000).toFixed(1)} s after sending`);
  await sleep(1500);
  await state(page, 'room-07-accepted', 'room-07-accepted');
  const xclose = page.locator('.photo-exchanges [data-x-close]').filter({ visible: true }).first();
  if (await xclose.count()) await tap(xclose, 'exchange close'); else await page.keyboard.press('Escape');
  await sleep(800);
  if (await panelKind(page)) { await tap('#panel-close', 'panel close'); await sleep(600); }
  await state(page, 'room-07b-after-exchange');

  // 8. a chat reply: 同场的人 → 北屿 → 招个手 → (accepted) → 私聊 → write → reply
  rec.setPhase('chat');
  await tap('button[data-view="person"]', 'nav 同场的人');
  await page.waitForFunction(() => document.querySelector('#panel')?.dataset.kind === 'people' && !document.querySelector('#panel').hidden, null, { timeout: 15000 });
  await sleep(700);
  await state(page, 'room-08a-people');
  const people = await page.evaluate(() => [...document.querySelectorAll('#panel [data-person], #panel [data-open="person"]')].map(b => ({ id: b.dataset.person || b.dataset.id, text: b.innerText.replace(/\s+/g, ' ').trim() })));
  const target = people.find(p => /北屿/.test(p.text)) || people.find(p => /小满/.test(p.text));
  if (!target) throw new Error('no open member in 同场的人: ' + JSON.stringify(people));
  await tap(`#panel [data-person="${target.id}"], #panel [data-open="person"][data-id="${target.id}"]`, `people → ${target.text}`);
  await page.waitForFunction(() => document.querySelector('#panel')?.dataset.kind === 'person' && !document.querySelector('#panel').hidden, null, { timeout: 20000 });
  await page.waitForSelector('#panel [data-social-send]', { timeout: 20000 });
  await sleep(600);
  await state(page, 'room-08b-person');
  const waveText = await tap('#panel [data-social-send]', 'person 招个手');
  step('wave', /^向 .+ 招个手$/.test(waveText), `「${waveText}」`);
  await sleep(700);
  await state(page, 'room-08c-person-waved');
  const friends = await page.waitForFunction(() => { const t = document.querySelector('#panel')?.innerText || ''; return /你们已经是朋友了/.test(t) && /私聊/.test(t); }, null, { timeout: 30000 }).then(() => true).catch(() => false);
  await sleep(600);
  await state(page, 'room-08d-person-friend');
  step('wave accepted', friends, (await page.evaluate(() => document.querySelector('#panel')?.innerText.replace(/\n+/g, ' | ').slice(0, 260))) || '');
  const chatBtn = page.locator('#panel button').filter({ hasText: /私聊/ }).filter({ visible: true }).first();
  if (await chatBtn.count()) await tap(chatBtn, 'person → 私聊');
  else throw new Error('no 私聊 button on the person sheet');
  await page.waitForSelector('.private-chat:not([hidden])', { timeout: 15000 });
  await sleep(1000);
  const inThread = await page.evaluate(() => { const t = document.querySelector('.chat-thread'); return Boolean(t && !t.hidden && t.getClientRects().length); });
  if (!inThread) { await tap(`[data-chat-peer="${target.id}"]`, 'chat list → thread'); await sleep(900); }
  const welcome = await page.waitForFunction(() => (document.querySelector('.chat-messages')?.innerText || '').trim().length > 0, null, { timeout: 30000 }).then(() => true).catch(() => false);
  await sleep(1500);
  const before = await page.evaluate(() => document.querySelector('.chat-messages')?.innerText || '');
  step('chat opens with their lines', welcome, before.replace(/\n+/g, ' | ').slice(0, 200));
  await state(page, 'room-08e-chat-welcome');
  await page.locator('#chat-text').fill('我在二楼拍到了人海，你呢？');
  await tap('.chat-composer button[type="submit"]', 'chat send');
  const replied = await page.waitForFunction(prev => { const now = document.querySelector('.chat-messages')?.innerText || ''; const mine = now.lastIndexOf('我在二楼拍到了人海'); return mine >= 0 && now.slice(mine).split('\n').filter(l => l.trim() && !/^\d\d:\d\d/.test(l.trim()) && !/我在二楼拍到了人海/.test(l)).length > 0; }, before, { timeout: 30000 }).then(() => true).catch(() => false);
  await sleep(900);
  const after = await page.evaluate(() => document.querySelector('.chat-messages')?.innerText || '');
  step('chat reply', replied, after.slice(after.lastIndexOf('我在二楼拍到了人海')).replace(/\n+/g, ' | ').slice(0, 200));
  await state(page, 'room-08-chat', 'room-08-chat');
  const chatClose = page.locator('.private-chat .chat-close').filter({ visible: true }).first();
  if (await chatClose.count()) await tap(chatClose, 'chat close'); else await page.keyboard.press('Escape');
  await sleep(800);
  if (await panelKind(page)) { await tap('#panel-close', 'panel close'); await sleep(600); }

  // 9. 关于 Music Space (the footer button): the one disclosure
  rec.setPhase('about');
  const aboutText = await tap('[data-open="about"]', 'footer 关于 Music Space');
  await page.waitForFunction(() => /关于 Music Space/.test(document.querySelector('#panel')?.innerText || '') && document.querySelector('#panel')?.dataset.kind === 'about', null, { timeout: 15000 });
  await sleep(700);
  step('About', true, `button 「${aboutText}」`);
  await state(page, 'room-10-about', 'room-10-about');
  await page.evaluate(() => { const s = document.querySelector('#panel [data-about="data"]'); if (s) s.scrollIntoView({ block: 'center' }); });
  await sleep(500);
  await state(page, 'room-10b-about-online', 'room-10b-about-online');
  await tap('#panel-close', 'About close');
  await sleep(700);

  // 10. 音乐探索 → the map → a 「来源」 → ← 返回现场
  rec.setPhase('map');
  const mapText = await tap('#music-map-entry', 'top 音乐探索');
  await page.waitForURL(/music-map\//, { timeout: 30000 });
  await page.waitForSelector('#sakura-world canvas', { timeout: 30000 }).catch(() => {});
  await page.waitForSelector('#main-content [data-map-action], #main-content [data-home]', { timeout: 30000 });
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await sleep(4500);
  const style = await page.evaluate(() => document.querySelector('[data-render-style]')?.dataset.renderStyle || null);
  step('音乐探索', /music-map\/#\/explore$/.test(page.url()), `button 「${mapText}」 → ${page.url().replace(/^https?:\/\/[^/]+/, '')}; renderStyle=${style}`);
  await state(page, 'map-01-explore-round', 'map-01-explore-round');
  const flip = page.locator('[data-map-action="flip"]').filter({ visible: true }).first();
  if (await flip.count()) {
    const f = await tap(flip, 'round 翻开');
    await sleep(1300);
    step('flip a card', true, `「${f}」`);
    await state(page, 'map-01b-round-flipped');
    const src = await tap('.map-round-card [data-map-action="edge"]', 'card 来源');
    await page.waitForSelector('dialog.map-dialog[open] details.map-sources[open]', { timeout: 15000 });
    step('来源 from a hand card', src === '来源', `「${src}」 opens the paper with its 来源 unfolded`);
  } else {
    await tap('.map-network-connection', 'atlas duet');
    await page.waitForSelector('dialog.map-dialog[open]', { timeout: 15000 });
    const src = await tap('dialog[open] details.map-sources > summary', 'paper 来源');
    await page.waitForSelector('dialog.map-dialog[open] details.map-sources[open]', { timeout: 15000 });
    step('来源 on a duet paper', /^来源/.test(src), `「${src}」`);
  }
  await sleep(1200);
  const srcInfo = await page.evaluate(() => { const d = document.querySelector('dialog.map-dialog[open] details.map-sources[open]'); return d ? { items: d.querySelectorAll('li').length, text: d.innerText.replace(/\s+/g, ' ').slice(0, 160) } : null; });
  report.sources = srcInfo;
  await state(page, 'map-02-duet-sources', 'map-02-duet-sources');
  await tap('dialog[open] [data-map-action="close"]', 'paper close');
  await sleep(900);
  rec.setPhase('return');
  const backText = await tap('.space-map-back', 'map ← 返回现场');
  await page.waitForURL(u => !String(u).includes('music-map'), { timeout: 30000 });
  const again = await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 }).then(() => true).catch(() => false);
  await page.waitForFunction(() => document.querySelector('#loading')?.hidden === true, null, { timeout: 60000 }).catch(() => {});
  await sleep(3000);
  const inRoom = await page.evaluate(nick => ({ nick: nick ? document.body.innerText.includes(nick) : null, join: document.querySelector('#join')?.innerText.trim(), panel: document.querySelector('#panel')?.hidden === false ? document.querySelector('#panel').dataset.kind : null }), report.nickname);
  step('← 返回现场', again && backText.replace(/\s+/g, '') === '←返回现场', `button 「${backText}」 → ${page.url().replace(/^https?:\/\/[^/]+/, '')}; nickname on screen: ${inRoom.nick}; #join 「${inRoom.join}」; panel ${inRoom.panel}`);
  await state(page, 'room-11-after-map');

  rec.setPhase('end');
  await sleep(1000);
  const clean = !rec.api.length && !rec.thirdParty.length && !rec.outsidePrefix.length && !rec.failed.length && !rec.badStatus.length && !rec.pageErrors.length && !rec.console.some(l => /: error: /.test(l));
  step('network/console', clean, `${rec.requests.length} requests; /api ${rec.api.length}, third-party ${rec.thirdParty.length}, outside prefix ${rec.outsidePrefix.length}, failed ${rec.failed.length}, HTTP>=400 ${rec.badStatus.length}, console errors ${rec.console.filter(l => /: error: /.test(l)).length}, warnings ${rec.console.filter(l => /: warning: /.test(l)).length}, page errors ${rec.pageErrors.length}, programmatic clicks ${(rec.programmatic || []).length}`);
  await ctx.close();
  await finish(report.steps.every(s => s.ok) ? 0 : 1);
})().catch(async e => { step('exception', false, String(e.message).split('\n')[0].slice(0, 300)); try { if (browser) { const pages = browser.contexts().flatMap(c => c.pages()); if (pages[0]) await pages[0].screenshot({ path: `${OUT}/FAIL.png` }); } } catch {} await finish(1); });
