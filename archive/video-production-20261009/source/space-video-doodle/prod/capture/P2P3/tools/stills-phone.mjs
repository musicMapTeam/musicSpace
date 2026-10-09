// Cut-outs and exports from one fresh phone world, walked like TAKE-P1 (real time, real UI actions, nothing injected into the
// product state).  Visitor 阿宁 in 失真 (rig seed -> same default skin/expression/pose as the clips).  Output: cut/, exports/, stills/
//   CUT-13 landing · CUT-02 wardrobe stand (失真 3/4) + visitor SVG views · CUT-04 AI chip / chips / upload polaroid ·
//   CUT-05 badge + wall polaroids · CUT-11 consent + send · exchange pair · CUT-06 交换已接受 · CUT-07 chat bubbles ·
//   cast SVGs (chat room) · CUT-12 World Cup VS card · creation-corner invitation · CUT-08 memory card PNG (product download)
// usage: node tools/stills-phone.mjs
import fs from 'node:fs';
import { launch } from '/tmp/space-video-doodle/capture-test/rec2.mjs';
import { openApp, VIEW, ROOT, CLOCK, NICK, sleep } from './lib.mjs';
import { StillKit } from './stillkit.mjs';

const browser = await launch();
let s;
const log = [];
const step = (m, x) => { const l = `${new Date().toISOString().slice(11, 19)} ${m}`; log.push(x ? `${l} ${JSON.stringify(x)}` : l); console.log(l, x ? JSON.stringify(x).slice(0, 300) : ''); };
const extra = { clock: CLOCK, svgs: {}, texts: {} };
try {
  s = await openApp(browser, VIEW.phone, { name: 'phone-stills', cursor: false });
  const p = s.page;
  const K = new StillKit(s, ROOT);
  const closePanel = async () => { for (let i = 0; i < 3; i++) { const open = await p.evaluate(() => document.querySelector('#panel') && !document.querySelector('#panel').hidden); if (!open) break; await p.locator('#panel-close').click().catch(() => {}); await sleep(500); } };
  await p.evaluate(() => Promise.all([...document.fonts].map(f => f.load().catch(() => null))));
  await sleep(1500);

  // ---- CUT-13: phone first screen
  await K.full('CUT-13', 'stills/CUT-13_phone-landing', { storyboard: 'W1 (and E1 reference)', note: 'first screen before entering; 3D doodle stage, 进到同一个现场, card 同一刻，另一面。, 进入示例现场' });
  await K.thaw();

  // ---- wardrobe: 失真, nickname; CUT-02 + visitor SVG views
  await p.locator('#join').click();
  await p.waitForSelector('form[data-form="demo-entry"] button.primary:not([disabled])', { timeout: 60000 });
  await p.locator('form[data-form="demo-entry"] button', { hasText: '现在换个造型' }).first().click();
  await p.waitForSelector('.wardrobe', { timeout: 30000 }); await sleep(1200);
  const sum = p.locator('.wardrobe summary', { hasText: '试试组合示例' }).first();
  await sum.scrollIntoViewIfNeeded(); await sum.click(); await sleep(400);
  const pre = p.locator('[data-preset="4"]'); await pre.scrollIntoViewIfNeeded(); await pre.click(); await sleep(500);
  await p.locator('.wardrobe input[aria-label="昵称"]').fill(NICK); await sleep(200);
  await p.evaluate(() => document.activeElement?.blur?.());
  await p.evaluate(() => document.querySelector('.wardrobe-look')?.scrollIntoView({ block: 'start' }));
  for (const angle of ['front', 'side', 'back', 'quarter']) {
    await p.locator(`[data-angle="${angle}"]`).click(); await sleep(450);
    extra.svgs[`visitor-${angle}`] = await p.evaluate(() => document.querySelector('.wardrobe .wardrobe-figure svg').outerHTML);
  }
  extra.texts.wardrobeLayers = await p.evaluate(() => [...document.querySelectorAll('.wardrobe [data-layer]')].map(e => e.dataset.layer + ':' + e.dataset.part).join(' '));
  await K.cut('CUT-02', 'cut/CUT-02_wardrobe-stand-shizhen-quarter', ['.wardrobe .wardrobe-look'], { pad: 0, scroll: false, alpha: false, storyboard: 'H1 (avatar), E2 reference', note: 'the real wardrobe stand: YOU lettering, mint orbit, figure 失真 at 3/4, 试穿中 · 仅自己可见, angle switch' });
  await K.cut('CUT-02s', 'cut/CUT-02s_wardrobe-figure-on-orbit', ['.wardrobe .wardrobe-orbit', '.wardrobe .wardrobe-figure'], { pad: 14, scroll: false, opaque: true, storyboard: 'H1 die-cut sticker', note: 'figure + mint orbit only (alpha die-cut)' });
  await K.thaw();
  await p.locator('[data-wardrobe-save]').first().click();
  await p.waitForFunction(() => { const w = document.querySelector('.wardrobe'); return !w || !w.getClientRects().length; }, null, { timeout: 30000 });
  await sleep(1200);
  await p.locator('#join').click();
  await p.waitForSelector('form[data-form="demo-entry"] button.primary:not([disabled])', { timeout: 60000 });
  await p.locator('form[data-form="demo-entry"] input[name=consent]').check();
  await p.locator('form[data-form="demo-entry"] button.primary').click();
  await p.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"]') && /回声现场/.test(document.body.innerText), null, { timeout: 60000 });
  step('entered room');
  await sleep(9500);

  // ---- upload: crowd sample, AI chip
  await p.locator('[data-tour-action="sample:sample-crowd"]').click();
  await p.waitForFunction(() => /AI 判断：/.test(document.querySelector('.moment-ai-tag')?.textContent || ''), null, { timeout: 60000 });
  await sleep(1200);
  extra.texts.aiTag = await p.evaluate(() => document.querySelector('.moment-ai-tag')?.textContent.trim());
  await K.cut('CUT-04a', 'cut/CUT-04a_ai-tag-renhai', ['.moment-ai-tag'], { pad: 14, storyboard: 'H1, W3 (隐私)', note: '「✦ AI 判断：人海」 chip (P-05 state)' });
  await K.cut('CUT-04b', 'cut/CUT-04b_viewpoint-chips-renhai-selected', ['.moment-chips'], { pad: 14, storyboard: 'H1, W3', note: 'the four viewpoint chips, 人海 pre-selected by the AI suggestion' });
  await K.cut('CUT-04c', 'cut/CUT-04c_viewpoint-block', ['.moment-view'], { pad: 14, storyboard: 'W3 polaroid (隐私)', note: '我拍的这一面 + chips + AI chip + hint 「AI 在本机判断，照片不上传…」' });
  await K.cut('POL-upload', 'cut/POL-01_upload-polaroid-crowd-2148', ['.moment-taken'], { pad: 18, storyboard: 'A1/M1 polaroid', note: 'upload form polaroid of 人海 · 示例照片 with 拍摄于 21:48 and the 示例照片 note' });
  await K.thaw();

  // ---- save -> wall: badge, cards
  await p.locator('form[data-form="upload"] button[type=submit]').click();
  await p.waitForSelector('[data-moment-badge="other-side"]', { timeout: 30000 });
  await sleep(2600);                                                     // let the toast go
  await K.cut('CUT-05', 'cut/CUT-05_badge-other-side', ['[data-moment-badge="other-side"]'], { pad: 16, storyboard: 'H1, M2', note: '「同一刻的另一面」 + reason 「同一刻 · 21:47，相差不到 1 分钟；你拍人海，TA 拍舞台」 + 「和 TA 交换这个视角」' });
  await K.cut('POL-best', 'cut/POL-02_wall-best-card-yao-stage', ['#panel .moment-card--best'], { pad: 20, storyboard: 'M2 / H1 polaroid', note: 'the wall card with tapes: badge, button, 阿遥·示例 stage photo, 拍摄于 21:47 · 视角：舞台 · 作者选择' });
  const gid = await p.evaluate(() => document.querySelector('#panel .moment-group')?.dataset.momentGroup);
  await K.cut('WALL-head', 'cut/WALL-01_group-header-2147-rule', [`#panel .moment-group[data-moment-group="${gid}"] > .moment-group__title`, `#panel .moment-group[data-moment-group="${gid}"] > .moment-group__note`], { pad: 14, storyboard: 'A5', note: '21:47 同一刻 · 3 个视角 + 「按拍摄时间分组（相差不超过 3 分钟），规则判断，不是 AI」' });
  const cards = await p.evaluate(() => [...document.querySelectorAll('#panel .moment-card:not(.moment-card--best)')].map(c => ({ id: c.dataset.momentPhoto, text: c.innerText.replace(/\s+/g, ' ').trim() })));
  extra.texts.wallCards = cards;
  const who = t => /阿宁/.test(t) ? 'aning-crowd-2148-ai' : /小满/.test(t) && /22:21/.test(t) ? 'man-friends-2221' : /小满/.test(t) ? 'man-crowd-2148' : /北屿/.test(t) ? 'bei-detail-2149' : 'other';
  let k = 3;
  for (const c of cards) {
    await K.cut(`POL-${who(c.text)}`, `cut/POL-0${k++}_wall-card-${who(c.text)}`, [`#panel .moment-card[data-moment-photo="${c.id}"]`], { pad: 16, storyboard: 'polaroid stickers (H1/S11/M1)', note: c.text });
  }
  await K.thaw();

  // ---- exchange compose -> consent -> send -> accepted
  await p.locator('[data-exchange-offer]').first().click();
  await p.waitForSelector('[data-x-send]', { timeout: 20000 });
  await p.waitForFunction(() => /（推荐）/.test(document.querySelector('select[data-x-choice]')?.selectedOptions?.[0]?.textContent || ''), null, { timeout: 20000 });
  await sleep(1200);
  await K.cut('POL-pair', 'cut/POL-08_exchange-pair-compose', ['.photo-exchanges .exchange-pair'], { pad: 18, storyboard: 'M3', note: '「我提供的 / 我选中的这一张」 ⇄ 「阿遥·示例的 / 照片墙上的这一张」' });
  await K.thaw();
  await p.evaluate(() => document.querySelector('[data-x-consent]').closest('label').scrollIntoView({ block: 'center' })); await sleep(300);
  await p.locator('[data-x-consent]').check(); await sleep(500);
  await p.evaluate(() => document.querySelector('[data-x-consent]').closest('label').scrollIntoView({ block: 'center' })); await sleep(300);
  await K.cut('CUT-11', 'cut/CUT-11_consent-tick-send', ['.photo-exchanges label:has([data-x-consent])', '.photo-exchanges [data-x-send]'], { pad: 14, scroll: false, storyboard: 'W3 (同意), M4', note: 'tick 「我同意提供选中照片的预览，并在对方接受后分享这张原图」 + 「把这两张交给对方确认 ↗」' });
  await K.cut('CUT-11b', 'cut/CUT-11b_consent-agreement-block', ['.photo-exchanges .exchange-agreement', '.photo-exchanges [data-x-send]'], { pad: 14, scroll: false, storyboard: 'M4', note: 'agreement text 「发送后，阿遥·示例 可以看并保存我的小图预览…」 + tick + send' }).catch(e => step('CUT-11b skipped: ' + e.message));
  await K.thaw();
  await p.locator('[data-x-send]').click();
  const tSend = Date.now();
  await p.waitForSelector('.exchange-status', { timeout: 20000 }); await sleep(300);
  await p.evaluate(() => document.querySelector('.exchange-status')?.scrollIntoView({ block: 'start' }));
  extra.texts.pending = await p.evaluate(() => document.querySelector('.exchange-status')?.textContent.trim());
  if (/等待/.test(extra.texts.pending || '')) await K.cut('PENDING', 'cut/EXCH-01_pending-status-pair', ['.photo-exchanges .exchange-status', '.photo-exchanges .exchange-body > h3', '.photo-exchanges .exchange-pair'], { pad: 18, scroll: false, storyboard: 'M5', note: '等待本人回应 + 和 阿遥·示例 的两张照片 (before 阿遥 answers)' }).catch(e => step('pending cut skipped: ' + e.message));
  await K.thaw();
  await p.waitForFunction(() => /交换已接受/.test(document.querySelector('.exchange-status')?.textContent || ''), null, { timeout: 30000 });
  extra.texts.acceptMs = Date.now() - tSend;
  await sleep(1500);
  await p.evaluate(() => document.querySelector('.exchange-status')?.scrollIntoView({ block: 'start' }));
  await sleep(300);
  await K.cut('CUT-06', 'cut/CUT-06_exchange-accepted-pair', ['.photo-exchanges .exchange-status', '.photo-exchanges .exchange-body > h3', '.photo-exchanges .exchange-pair'], { pad: { l: 24, t: 38, r: 30, b: 22 }, scroll: false, storyboard: 'H1, M6', note: '「交换已接受」 sticker with star + 「和 阿遥·示例 的两张照片」 + both polaroids (我提供的 / 阿遥·示例提供的)' });
  await K.cut('CUT-06s', 'cut/CUT-06s_exchange-accepted-sticker', ['.photo-exchanges .exchange-status'], { pad: { l: 70, t: 40, r: 40, b: 24 }, scroll: false, storyboard: 'M6 punch-in', note: 'the mint 「交换已接受」 sticker alone (star + sparkles are its own pseudo-elements)' });
  await K.thaw();
  await p.evaluate(() => [...document.querySelectorAll('.photo-exchanges .exchange-body > button')].find(b => /撤销/.test(b.textContent))?.scrollIntoView({ block: 'center' }));
  await sleep(300);
  await K.cut('REVOKE', 'cut/EXCH-02_revoke-button-fineprint', ['.photo-exchanges .exchange-body > p:not(.exchange-status):not(.exchange-fine)', '.photo-exchanges .exchange-body > button', '.photo-exchanges .exchange-fine'], { pad: 14, scroll: false, storyboard: 'M7, W3', note: '双方已明确同意… + 撤销这次交换的在线访问 + fine print' }).catch(e => step('revoke cut skipped: ' + e.message));
  await K.thaw();

  // ---- greet 小满 -> friends -> private chat
  await p.locator('[data-x-close]').first().click().catch(() => {}); await sleep(800);
  await closePanel();
  await p.locator('[data-view="person"]').click(); await sleep(1500);
  await p.locator('[data-person]', { hasText: '小满' }).first().click(); await sleep(2000);
  await p.locator('[data-social-send]').first().click();
  await p.waitForFunction(() => /你们已经认识了/.test(document.body.innerText), null, { timeout: 30000 }); await sleep(1000);
  await p.locator('[data-open="chats"]').first().click(); await sleep(1500);
  await p.locator('.private-chat textarea').click(); await p.keyboard.insertText('返场那首我在人海里，手都举酸了！');
  await p.locator('.private-chat .chat-composer button[type=submit]').click();
  await p.waitForFunction(() => /今晚的返场太好听了/.test(document.querySelector('.private-chat')?.innerText || ''), null, { timeout: 30000 });
  await sleep(1000); await p.evaluate(() => document.activeElement?.blur?.()); await sleep(300);
  extra.texts.chat = await p.evaluate(() => [...document.querySelectorAll('.private-chat .chat-message')].map(m => m.innerText.replace(/\s+/g, ' ')));
  await K.cut('CUT-07', 'cut/CUT-07_chat-bubbles', ['.private-chat .chat-message'], { pad: 16, scroll: false, storyboard: 'H1, S2', note: 'the four bubbles: welcome (示例角色，由这个页面自动回复), 你拍到的是哪一面？, yours (mint), reply 今晚的返场太好听了。' });
  await K.cut('CUT-07h', 'cut/CUT-07h_chat-header', ['.private-chat > header'], { pad: 12, scroll: false, storyboard: 'S2', note: 'ONE TO ONE 小满·示例 header' }).catch(e => step('chat header cut skipped: ' + e.message));
  await K.thaw();

  // ---- after-show chat room: cast SVGs, World Cup VS card
  await p.keyboard.press('Escape').catch(() => {}); await sleep(400);
  await p.locator('.private-chat .chat-close').first().click().catch(() => {}); await sleep(600);
  await closePanel();
  await p.locator('#scene-details').click(); await sleep(1200);
  await p.locator('#panel [data-open="conversation"]').first().click(); await sleep(2000);
  const join = p.locator('.community-panel form[data-group-join]');
  if (await join.count()) { await join.locator('input[name=consent]').check(); await join.locator('button[type=submit]').click(); await sleep(2500); }
  const cast = await p.evaluate(() => [...document.querySelectorAll('.community-panel article')].map(a => { const svg = a.querySelector('svg[data-illustrated-avatar]'); return svg ? { name: (a.innerText || '').split('\n')[0].trim(), svg: svg.outerHTML } : null; }).filter(Boolean));
  for (const c of cast) { const key = { '阿遥·示例': 'cast-yao', '小满·示例': 'cast-man', '北屿·示例': 'cast-bei' }[c.name]; if (key && !extra.svgs[key]) extra.svgs[key] = c.svg; }
  step('cast svgs', cast.map(c => c.name));
  await p.evaluate(() => { const row = document.querySelector('.conversation-actions'); const b = row?.querySelector('[data-group-worldcup]'); if (row && b) row.scrollLeft = b.offsetLeft - row.offsetLeft - 2; });
  await sleep(300);
  await p.locator('[data-group-worldcup]').click(); await sleep(2000);
  await p.locator('.worldcup-panel .entry-list button', { hasText: '今晚的专辑世界杯' }).first().click(); await sleep(2200);
  extra.texts.cup = await p.evaluate(() => document.querySelector('.worldcup-panel section.worldcup-match')?.innerText.replace(/\s+/g, ' '));
  await K.cut('CUT-12', 'cut/CUT-12_worldcup-vs-card', ['.worldcup-panel section.worldcup-match:has([data-album="night-platform"])'], { pad: 16, storyboard: 'W3 (好玩), S5', note: '第一轮 · 第1组: 01 原创虚构专辑 午夜站台 / 纸灯乐队 VS 02 樱花电波 / 薄荷收音机, before the visitor votes (the cast votes already counted)' });
  await K.thaw();
  await p.locator('[data-cup-close]').first().click().catch(() => {}); await sleep(600);
  await p.locator('[data-group="close"]').first().click().catch(() => {}); await sleep(800);
  await closePanel();

  // ---- creation corner: invitation (the example cast never joins, so this is the real end state)
  await p.locator('[data-view="person"]').click(); await sleep(1500);
  await p.locator('[data-person]', { hasText: '小满' }).first().click(); await sleep(2000);
  await p.locator('#panel [data-open="corners"]').first().click(); await sleep(2200);
  await p.locator('.corner-panel input[type=checkbox]').first().check(); await sleep(250);
  await p.locator('.corner-panel button', { hasText: '创建共同创作邀请' }).click();
  await p.waitForFunction(() => /等待朋友本人明确参与/.test(document.querySelector('.corner-panel')?.innerText || ''), null, { timeout: 20000 });
  await sleep(1500);
  extra.texts.corner = await p.evaluate(() => document.querySelector('.corner-panel')?.innerText.replace(/\s+/g, ' '));
  await K.full('CORNER', 'exports/CORNER-01_creation-corner-invitation-phone', { storyboard: 'S8', note: '3D close-up of 小满·示例 + 「TWO SIDES / 两个人的创作角 · 一起留张纪念。」 + 「等待朋友本人明确参与。你不能替对方同意，也不会自动分享照片。」 (product has no invitation-image export; this is a full-resolution still of the real state)' });
  await K.cut('CORNER-panel', 'exports/CORNER-02_creation-corner-panel', ['.corner-panel'], { pad: 8, scroll: false, storyboard: 'S8', note: 'the corner sheet alone (alpha die-cut + opaque)' });
  await K.thaw();
  await p.locator('[data-corner-close]').first().click().catch(() => {}); await sleep(900);
  await closePanel();

  // ---- recap -> memory card -> download (CUT-08)
  await p.locator('[data-view="overview"]').click(); await sleep(1500);
  await p.locator('#scene-details').click(); await sleep(1200);
  await p.locator('#panel [data-open="recap"]').first().click(); await sleep(2200);
  await p.locator('#panel [data-open="memory-card"]').first().click(); await sleep(2500);
  await p.locator('#panel input[name="memory-photo"]').first().check(); await sleep(250);
  await p.locator('#panel input[name="memory-avatar"]').check(); await sleep(250);
  await p.locator('#panel input[name="memory-confirm"]').check(); await sleep(400);
  const dl = p.waitForEvent('download', { timeout: 30000 });
  await p.locator('#panel button', { hasText: '下载纪念卡 PNG' }).click();
  const d = await dl;
  const card = `${ROOT}/exports/CUT-08_memory-card.png`;
  await d.saveAs(card);
  extra.memoryCard = { file: card, suggested: d.suggestedFilename() };
  step('memory card downloaded', extra.memoryCard);
  await sleep(2500);
  await p.evaluate(() => document.querySelector('#panel .memory-result')?.scrollIntoView({ block: 'center' }));
  await sleep(500);
  await K.full('CUT-08ui', 'stills/CUT-08ui_memory-card-result-phone', { storyboard: 'S9', note: 'phone after the download: 已发起下载… + preview 你的纪念卡' });
  await K.thaw();

  // ---- write SVGs + log
  fs.mkdirSync(`${ROOT}/avatars/svg`, { recursive: true });
  for (const [k2, svg] of Object.entries(extra.svgs)) fs.writeFileSync(`${ROOT}/avatars/svg/${k2}.from-build.svg`, svg.includes('xmlns=') ? svg : svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"'));
  fs.writeFileSync(`${ROOT}/logs/stills-phone.json`, JSON.stringify({ items: K.items, extra: { ...extra, svgs: Object.keys(extra.svgs) }, log, errors: s.errors, console: s.console.slice(0, 20) }, null, 1));
  console.log('DONE', K.items.length, 'items');
} catch (e) {
  console.error('FAILED', e);
  try { await s?.page.screenshot({ path: `${ROOT}/review/stills-phone-FAIL.png` }); } catch {}
  fs.writeFileSync(`${ROOT}/logs/stills-phone.fail.json`, JSON.stringify({ error: String(e && e.stack || e), log }, null, 1));
  process.exitCode = 1;
} finally { await s?.ctx.close().catch(() => {}); await browser.close(); }
