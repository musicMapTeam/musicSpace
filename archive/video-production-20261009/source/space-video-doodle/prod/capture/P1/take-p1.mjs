// TAKE-P1 (SHOTS.md §3): the continuous phone judge route in ONE example world, 1080x2340 @ 60 fps, frame-stepped.
// Records one continuous master (P1-master.mp4) and, from the same frames, one sub-clip per storyboard shot with >= 1 s handles
// (clips/P-xx.mp4), stills (stills/CUT-xx*.png), the memory card PNG, and take.json (per-frame DOM state, events, clip ranges).
// Rhythmic rows (♩) put the visible effect of each tap on an exact frame of a beat grid (BPM env, default 123 = working track).
//   env: SPACE_BASE (default http://127.0.0.1:47831/musicSpace/)  DRY=1 (no grabs/encodes: flow test)  STOP_AT=<step>  BPM=123
import fs from 'node:fs';
import { launch, Session, PHONE, OUT_FPS, sleep } from './rig/rec2.mjs';
import { Sink, PAGE_HELPERS, ease, md5 } from './p1lib.mjs';

const DIR = '/tmp/space-video-doodle/prod/capture/P1';
const BASE = process.env.SPACE_BASE || 'http://127.0.0.1:47831/musicSpace/';
const DRY = process.env.DRY === '1';
const STOP_AT = process.env.STOP_AT || '';
const BPM = +(process.env.BPM || 123);
const FPB = 60 * OUT_FPS / BPM;                          // output frames per beat (29.268 at 123 BPM)
const CLOCK = '2026-10-07T22:40:00+08:00';               // SHOTS.md §1: an evening after the build (2026-10-07 04:13 +08:00)
const OUTV = DRY ? `${DIR}/dry` : `${DIR}/clips`;
const STILLS = DRY ? `${DIR}/dry/stills` : `${DIR}/stills`;
const W = 1080, H = 2340;
// text caret: Chrome blinks it on real time (500 ms), which frame-stepping turns into a ~7 Hz flicker; hide it like the mouse cursor
const CSS = 'input,textarea{caret-color:transparent!important}';

let s, page, master;
const clips = new Map(), finished = [], events = [], states = [], hashes = [], stills = [], warnings = [], grids = [];
const F = () => (master ? master.frames : 0);
const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}] f${F()}`, ...a);
const warn = m => { warnings.push({ frame: F(), msg: m }); log('WARN', m); };

class Master {
  constructor() { this.frames = 0; this.sink = DRY ? null : new Sink(`${DIR}/P1-master.mp4`, { w: W, h: H, crf: 16, preset: 'medium' }); }
  async write(buf, st) {
    const h = buf ? md5(buf) : '';
    hashes.push(h); states.push(st);
    const ws = [];
    if (this.sink) ws.push(this.sink.write(buf, h));
    for (const c of clips.values()) { c.frames++; if (c.sink) ws.push(c.sink.write(buf, h)); }
    await Promise.all(ws);
    this.frames++;
  }
}

function clipStart(id, meta = {}) {
  if (clips.has(id)) throw new Error('clip already open ' + id);
  clips.set(id, { id, start: F(), frames: 0, meta, sink: DRY ? null : new Sink(`${OUTV}/${id}.mp4`, { w: W, h: H, crf: 15, preset: 'slow' }) });
  log('clip start', id);
}
function clipEnd(id) {
  const c = clips.get(id); if (!c) throw new Error('clip not open ' + id);
  clips.delete(id); c.end = F();
  c.result = c.sink ? c.sink.end() : Promise.resolve(null);
  finished.push(c); log('clip end', id, `${c.end - c.start} frames`);
}
const ev = (label, extra = {}) => { const e = { label, frame: F(), ...extra }; events.push(e); return e; };
/** beat grid: beat k -> output frame (master index); beat 0 = `lead` frames from now */
function grid(name, lead = 4) { const b0 = F() + lead; const g = k => b0 + Math.round(k * FPB); grids.push({ name, beat0: b0, bpm: BPM, fpb: +FPB.toFixed(4) }); ev(`♩ ${name} beat0`, { type: 'grid', beat0: b0 }); return g; }
async function untilFrame(f) { const n = f - F(); if (n > 0) await s.frames(n); else if (n < 0) warn(`untilFrame late by ${-n}`); }
const hold = sec => s.hold(sec);

async function boxOf(sel, text = '') { return page.evaluate(([a, b]) => window.__p1.box(a, b), [sel, text]); }
/** tap: optional `at` = the output frame on which the click lands (first frame that can show its effect) */
async function tap(sel, { text = '', at = null, press = 3, label = '', dx = 0, dy = 0, check = false } = {}) {
  label = label || `tap ${sel}${text ? ' ' + text : ''}`;
  if (at != null) await untilFrame(at - press);
  let b = await boxOf(sel, text);
  if (!b) throw new Error(`tap: not visible: ${label}`);
  if (check && b.w * b.h < 36) {   // visually hidden checkbox: tap its label's box at the box position
    b = await page.evaluate(([a]) => { const e = window.__p1.visQ(a) || document.querySelector(a); const l = e && e.closest('label'); if (!l) return null; const r = l.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + 22, cy: r.y + r.height / 2 }; }, [sel]);
    if (!b) throw new Error(`tap: checkbox without box: ${label}`);
  }
  const hit = check ? 'ok' : await page.evaluate(([a, t]) => window.__p1.hit(a, t), [sel, text]);
  if (hit !== 'ok') throw new Error(`tap: ${label}: ${hit}`);
  const x = b.cx + dx, y = b.cy + dy;
  if (y < 6 || y > s.H - 6 || x < 6 || x > s.W - 6) throw new Error(`tap: off-screen ${label} @${x | 0},${y | 0}`);
  await page.mouse.move(x, y);
  const down = F(); await page.mouse.down(); await s.frames(press); await page.mouse.up();
  return ev(label, { type: 'tap', down, x: Math.round(x), y: Math.round(y), ...(at != null ? { target: at } : {}) });
}
const tapCheck = (sel, o = {}) => tap(sel, { ...o, check: true });
async function typeChars(chars, frameAt, label) {
  for (let i = 0; i < chars.length; i++) { await untilFrame(frameAt(i)); await page.keyboard.type(chars[i]); ev(`${label} key ${chars[i]}`, { type: 'key' }); }
}
/** eased scroll of the first visible `sel` to `to` (clamped), one instant step per output frame */
async function scrollEl(sel, to, { n = 36, axis = 'y', label = '' } = {}) {
  const info = await page.evaluate(([a, ax, v]) => { const e = window.__p1.visQ(a); if (!e) return null; const max = ax === 'y' ? e.scrollHeight - e.clientHeight : e.scrollWidth - e.clientWidth; return { from: ax === 'y' ? e.scrollTop : e.scrollLeft, to: Math.max(0, Math.min(max, v)) }; }, [sel, axis, to]);
  if (!info) throw new Error('scroll: no visible ' + sel);
  const e0 = ev(label || `scroll ${sel}`, { type: 'scroll', from: Math.round(info.from), to: Math.round(info.to), frames: n });
  if (Math.abs(info.to - info.from) < 1) { warn(`scroll no-op ${sel}`); return e0; }
  for (let i = 1; i <= n; i++) {
    const v = info.from + (info.to - info.from) * ease(i / n);
    await page.evaluate(([a, ax, v]) => { const e = window.__p1.visQ(a); e.scrollTo(ax === 'y' ? { top: v, behavior: 'instant' } : { left: v, behavior: 'instant' }); }, [sel, axis, v]);
    await s.frames(1);
  }
  const got = await page.evaluate(([a, ax]) => { const e = window.__p1.visQ(a); return ax === 'y' ? e.scrollTop : e.scrollLeft; }, [sel, axis]);
  if (Math.abs(got - info.to) > 2) throw new Error(`scroll did not apply: ${sel} at ${got}, wanted ${info.to}`);
  return e0;
}
async function waitFor(label, pred, { max = 600, arg } = {}) {
  const f0 = F();
  const ok = await s.until(pred, { max, arg });
  if (!ok) throw new Error(`waitFor timeout: ${label} (${F() - f0} frames)`);
  return ev(label, { type: 'state', waited: F() - f0 });
}
const settled = () => s.until(() => { try { return !window.__SPACE_EVENT_QA__().camera.moving; } catch { return true; } }, { max: 300 });
async function still(name, { sel, text = '', union, all, common, pad = 12, full = false } = {}) {
  let clip, b = null;
  if (full) clip = { x: 0, y: 0, width: s.W, height: s.H, scale: s.dpr };
  else {
    b = union ? await page.evaluate(u => window.__p1.union(u), union) : all ? await page.evaluate(a => window.__p1.unionAll(a), all) : common ? await page.evaluate(c => window.__p1.commonBox(c[0], c[1]), common) : await boxOf(sel, text);
    if (!b) { warn('still: no box ' + name); return; }
    const x = Math.max(0, b.x - pad), y = Math.max(0, b.y - pad);
    clip = { x, y, width: Math.min(s.W - x, b.w + 2 * pad), height: Math.min(s.H - y, b.h + 2 * pad), scale: s.dpr };
  }
  const rec = { name, file: `${STILLS}/${name}.png`, frame: F() - 1, clip_css: Object.fromEntries(Object.entries(clip).map(([k, v]) => [k, +(+v).toFixed(2)])) };
  stills.push(rec);
  if (DRY) return;
  fs.mkdirSync(STILLS, { recursive: true });
  const r = await s.cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true, clip });
  fs.writeFileSync(rec.file, Buffer.from(r.data, 'base64'));
}
const VIS = a => !!window.__p1.visQ(a);
const waitVis = (label, sel, o = {}) => waitFor(label, VIS, { ...o, arg: sel });

// ------------------------------------------------------------------------------------------------------------------------------
const STEPS = [];
const step = (id, fn) => STEPS.push([id, fn]);

step('P-01 landing', async () => {
  clipStart('P-01', { feeds: ['E1', 'W1 (CUT-13)'], what: 'phone first screen (doodle 3D stage, 「同一刻，另一面。」), tap 「进入示例现场」 → entry panel' });
  await hold(2.0);
  await still('CUT-13-phone-first-screen', { full: true });
  await hold(4.0);
  await tap('#join', { label: 'tap 进入示例现场 (#join)' });
  await waitFor('entry panel opens', () => !document.querySelector('#panel').hidden && !!document.querySelector('form[data-form="demo-entry"]'));
  await hold(1.5);
  clipStart('P-02', { feeds: ['E2', 'CUT-02'], what: 'wardrobe: nickname 阿宁 (16ths), presets 断拍/循迹/回声/失真 on 4 beats (starts on 留白), angles 正面/侧面/背面/3/4 on 4 beats, save on beat 7.5' });
  await hold(1.0);
  clipEnd('P-01');
});

step('P-02 wardrobe', async () => {
  await tap('form[data-form="demo-entry"] button', { text: '现在换个造型', label: 'tap 现在换个造型 ↗' });
  await waitVis('wardrobe opens', '.wardrobe');
  await hold(1.0);
  await tap('.wardrobe input[aria-label="昵称"]', { label: 'tap nickname field' });
  const gn = grid('nickname 16ths', 8);
  await typeChars('阿宁', i => gn(i * 0.25), 'nickname');
  await hold(0.6);
  await scrollEl('.wardrobe-tools', 1e5, { n: 40, label: 'scroll wardrobe tools down' });
  await hold(0.25);
  await tap('.wardrobe summary', { text: '试试组合示例', label: 'tap 试试组合示例' });
  await hold(0.3);
  await scrollEl('.wardrobe-tools', 1e5, { n: 30, label: 'scroll to the presets' });
  await hold(0.7);
  const g = grid('wardrobe presets + angles', 6);
  // the wardrobe starts on the 留白 look, so 留白 first would not change anything: 断拍, 循迹, 回声, 失真 change the figure on every beat
  const presets = [['1', '断拍'], ['2', '循迹'], ['3', '回声'], ['4', '失真']];
  for (let k = 0; k < 4; k++) {
    await tap(`.wardrobe [data-preset="${presets[k][0]}"]`, { at: g(k), label: `preset ${presets[k][1]} (beat ${k})` });
    if (k === 3) { await untilFrame(g(3) + 20); await still('CUT-02-wardrobe-stand-shizhen-3q', { sel: '.wardrobe .wardrobe-figure', pad: 8 }); await still('CUT-02-wardrobe-full', { full: true }); }
  }
  const angles = [['front', '正面'], ['side', '侧面'], ['back', '背面'], ['quarter', '3/4']];
  for (let k = 0; k < 4; k++) await tap(`.wardrobe [data-angle="${angles[k][0]}"]`, { at: g(4 + k), label: `angle ${angles[k][1]} (beat ${4 + k})` });
  await tap('[data-wardrobe-save]', { at: g(7.5), label: 'tap 保存这个我 ↗ (beat 7.5)' });
  await waitFor('toast 小人已保存', () => /小人已保存/.test(document.querySelector('#toast')?.textContent || ''));
  await hold(0.8);
  clipStart('P-03', { feeds: ['E3'], what: 'entry form again (阿宁 + 失真): scroll to 这一场，我想怎样参与 (beat 1), tick consent (beat 4), 进入示例现场 (beat 6) → room' });
  await hold(1.0);
  clipEnd('P-02');
});

step('P-03 entry', async () => {
  await tap('#join', { label: 'tap 进入示例现场 (#join, again)' });
  await waitFor('entry panel (with 阿宁)', () => !document.querySelector('#panel').hidden && document.querySelector('form[data-form="demo-entry"] input[name=name]')?.value === '阿宁');
  await hold(0.9);
  const g = grid('entry form', 4);
  await untilFrame(g(1));
  await scrollEl('#panel', 170, { n: Math.round(FPB), label: 'scroll to 这一场，我想怎样参与 (beat 1)' });
  await tapCheck('form[data-form="demo-entry"] input[name=consent]', { at: g(4), label: 'tick consent (beat 4)' });
  await tap('form[data-form="demo-entry"] button[type=submit]', { at: g(6), label: 'tap 进入示例现场 (beat 6)' });
  await waitFor('room: entry closed, tour card', () => document.querySelector('#panel').hidden && !!window.__p1.visQ('.demo-tour'));
  await hold(1.5);
  clipEnd('P-03');
});

step('P-04 room wait', async () => {
  await hold(5.0);                                         // master only: the room settles, 林间·示例 joins (~8 s after you)
  clipStart('P-04', { feeds: ['A1'], what: 'room with the route card 「示例路线 1/4 · 放一张你的照片」, tap 「人海 · 示例照片」' });
  await hold(4.0);
  if ((await page.evaluate(() => window.__SPACE_EVENT_QA__().members.length)) < 5) await waitFor('林间·示例 joined', () => window.__SPACE_EVENT_QA__().members.length >= 5, { max: 400 });
  clipStart('P-05', { feeds: ['A1', 'A2', 'CUT-04'], what: 'upload form: 拍摄于 21:48, the AI chip 「AI 判断：人海」 with 人海 pre-selected, hint; scroll to 保存这张照片' });
  await hold(1.0);
  await tap('.demo-tour [data-tour-action="sample:sample-crowd"]', { label: 'tap 人海 · 示例照片' });
  await waitFor('upload form', () => !document.querySelector('#panel').hidden && !!document.querySelector('form[data-form="upload"]'));
  await waitFor('AI chip in DOM', () => /AI 判断：/.test(document.querySelector('.moment-ai-tag')?.textContent || ''), { max: 900 });
  await waitFor('form auto-scroll to the photo', () => document.querySelector('#panel').scrollTop > 100, { max: 240 });
  await hold(1.3);
  clipEnd('P-04');
});

step('P-05 upload + AI', async () => {
  await hold(1.4);
  await still('CUT-04-ai-tag', { sel: '.moment-ai-tag', pad: 10 });
  await still('CUT-04-chips-ai-hint', { union: [['[data-moment-viewpoint="stage"]'], ['[data-moment-viewpoint="detail"]'], ['.moment-ai-tag'], ['@text', '配对时，用它来找互补的那一面']], pad: 14 });
  await still('CUT-04-full', { full: true });
  await hold(0.6);
  await scrollEl('#panel', 1e5, { n: 48, label: 'scroll to 可见范围 + 保存这张照片' });
  await hold(1.2);
  clipStart('P-07', { feeds: ['A4'], what: 'tap 保存这张照片 → toast 「已分享给本场成员」, the wall panel slides in' });
  clipStart('P-08', { feeds: ['A5', 'M2', 'CUT-05'], what: 'wall panel: header, ribbon, 21:47 同一刻 group, rule line, badge 「同一刻的另一面」; slow scroll through the polaroids; back to the badge' });
  await hold(1.0);
  clipEnd('P-05');
});

step('P-07 save', async () => {
  await tap('form[data-form="upload"] button[type=submit]', { label: 'tap 保存这张照片' });
  await waitFor('wall panel with badge', () => !!window.__p1.visQ('[data-moment-badge="other-side"]'), { max: 600 });
  await hold(2.2);
  clipEnd('P-07');
});

step('P-08 wall', async () => {
  await hold(0.6);
  await still('CUT-05-badge', { sel: '[data-moment-badge="other-side"]', pad: 14 });
  await still('CUT-05-wall-top-full', { full: true });
  await scrollEl('#panel', 420, { n: 66, label: 'wall scroll → 阿遥·示例 stage photo' });
  await hold(1.3);
  await scrollEl('#panel', 820, { n: 66, label: 'wall scroll → polaroid grid (yours: AI 建议，未改动)' });
  await hold(1.6);
  await scrollEl('#panel', 1270, { n: 60, label: 'wall scroll → 北屿 21:49 + 22:21 group' });
  await hold(1.1);
  await scrollEl('#panel', 120, { n: 72, label: 'wall scroll back to the badge' });
  await hold(1.0);
  clipStart('P-09', { feeds: ['M3', 'M4', 'CUT-11'], what: 'tap 和 TA 交换这个视角 (beat 0) → compose; scroll (beat 4, beat 8); tick consent (beat 9); send (beat 10)' });
  await hold(1.0);
  clipEnd('P-08');
});

step('P-09 exchange compose', async () => {
  const g = grid('exchange', 5);
  await tap('[data-exchange-offer]', { at: g(0), label: 'tap 和 TA 交换这个视角 (beat 0)' });
  await waitFor('compose open', () => !!window.__p1.visQ('[data-x-send]') && /（推荐）/.test(document.querySelector('select[data-x-choice]')?.selectedOptions?.[0]?.textContent || ''));
  await untilFrame(g(4));
  await scrollEl('.exchange-body', 64, { n: Math.round(FPB), label: 'scroll to the reason card (beat 4)' });
  await untilFrame(g(7.5));
  clipStart('P-10', { feeds: ['M4', 'M5'], what: 'send → 「等待本人回应」 (the whole real wait) → 「交换已接受」' });
  await untilFrame(g(8));
  await scrollEl('.exchange-body', 1e5, { n: Math.round(FPB * 0.8), label: 'scroll to the consent + send (beat 8)' });
  await tapCheck('[data-x-consent]', { at: g(9), label: 'tick 我同意提供选中照片的预览… (beat 9)' });
  await untilFrame(g(9) + 25);
  await still('CUT-11-consent-send', { union: [['[data-x-consent]'], ['[data-x-send]'], ['.exchange-agreement']], pad: 14 });
  await still('CUT-11-full', { full: true });
  await tap('[data-x-send]', { at: g(10), label: 'tap 把这两张交给对方确认 ↗ (beat 10)' });
  await waitFor('pending 等待本人回应', () => /等待本人回应/.test(document.querySelector('.exchange-status')?.textContent || ''));
  await hold(0.4);
  clipStart('P-11', { feeds: ['M6', 'M7', 'CUT-06'], what: '「交换已接受」 sticker, both polaroids, 双方已明确同意…, 撤销这次交换的在线访问 + fine print (all on one screen)' });
  await hold(0.8);
  clipEnd('P-09');
});

step('P-10/P-11 pending → accepted', async () => {
  await waitFor('交换已接受', () => /交换已接受/.test(document.querySelector('.exchange-status')?.textContent || ''), { max: 900 });
  await hold(1.5);
  await still('CUT-06-accepted', { union: [['.exchange-status'], ['.exchange-pair']], pad: 16 });
  await still('CUT-06-accepted-full', { full: true });
  clipEnd('P-10');
  await hold(3.0);
  clipStart('P-12a', { feeds: ['(spare) people list'], what: 'close the exchange, 同场的人 list: 阿遥/小满/北屿/林间, each 示例角色 · 自动回复' });
  await hold(1.0);
  clipEnd('P-11');
});

step('P-12 greet', async () => {
  await tap('[data-x-close]', { label: 'tap × (close exchange)' });
  await waitFor('exchange closed', () => !window.__p1.visQ('.photo-exchanges'));
  await hold(0.8);
  await tap('nav.camera-nav [data-view="person"]', { label: 'tap 同场的人 (bottom nav)' });
  await waitFor('people list', () => !!window.__p1.find('[data-person]', '小满'));
  await settled();
  await hold(1.4);
  clipStart('P-12', { feeds: ['S1'], what: 'tap 小满 → 3D close-up + card; tap 向 小满·示例 招个手 → toast; the whole wait → 「你们已经认识了」, ♡ 2' });
  await hold(1.0);
  await tap('[data-person]', { text: '小满', label: 'tap 小满·示例' });
  await waitVis('person card', '[data-social-send]');
  await settled();
  await hold(1.2);
  await tap('[data-social-send]', { label: 'tap 向 小满·示例 招个手' });
  await waitFor('已招手，等待本人回应', () => /已招手/.test(document.querySelector('#panel')?.innerText || ''));
  clipEnd('P-12a');
  await waitFor('你们已经认识了', () => /你们已经认识了/.test(document.querySelector('#panel')?.innerText || ''), { max: 900 });
  await s.until(() => /2/.test(document.querySelector('#social-inbox')?.textContent || ''), { max: 120 });
  ev('inbox ♡ 2 (or timeout)', { type: 'state' });
  await hold(1.6);
  clipStart('P-13', { feeds: ['S2', 'CUT-07'], what: 'private chat ONE TO ONE 小满·示例: welcome bubbles; type 「返场那首我在人海里，手都举酸了！」 (16ths), send on the downbeat; the reply 「今晚的返场太好听了。」' });
  await hold(1.0);
  clipEnd('P-12');
});

step('P-13 chat', async () => {
  await tap('[data-open="chats"]', { text: '私聊', label: 'tap 和 小满·示例 私聊 ↗' });
  await waitFor('chat open', () => (window.__p1.visQ('.private-chat')?.querySelectorAll('.chat-message').length || 0) >= 2);
  await hold(1.3);
  await tap('.private-chat textarea', { label: 'tap the composer' });
  const msg = '返场那首我在人海里，手都举酸了！';
  const g = grid('chat typing 16ths + send', 10);
  await typeChars([...msg], i => g(i * 0.25), 'chat');
  await tap('.private-chat .chat-composer button[type=submit]', { at: g(4), label: 'tap 发送 ↗ (beat 4)' });
  await waitFor('my bubble', () => (window.__p1.visQ('.private-chat')?.querySelectorAll('.chat-message').length || 0) >= 3);
  await waitFor('reply 今晚的返场太好听了。', () => (window.__p1.visQ('.private-chat')?.querySelectorAll('.chat-message').length || 0) >= 4, { max: 900 });
  await hold(1.5);
  await still('CUT-07-chat-bubbles', { all: '.private-chat .chat-message', pad: 14 });
  await still('CUT-07-full', { full: true });
  await hold(0.6);
  clipEnd('P-13');
});

step('P-14 chat room', async () => {
  await tap('.private-chat .chat-close', { label: 'tap × (close chat)' });
  await waitFor('chat closed', () => !window.__p1.visQ('.private-chat'));
  await hold(0.6);
  await tap('nav.camera-nav [data-view="overview"]', { label: 'tap 全景' });
  await s.frames(2); await settled();
  await hold(0.5);
  await tap('#scene-details', { label: 'tap 回声现场 · 示例场 (#scene-details)' });
  await waitVis('room panel', '#panel [data-open="conversation"]');
  await hold(0.5);
  clipStart('P-14', { feeds: ['S4'], what: '散场聊天室: join card (consent) → 3D header + the seeded lines, each 「（示例角色的自动回复：我不是真人。）」; chip row scrolled to 专辑世界杯 (Music Map chip out of frame), then a slow message scroll' });
  await hold(1.0);
  await tap('#panel [data-open="conversation"]', { label: 'tap 散场聊天室' });
  await waitVis('join card', 'form[data-group-join]');
  await hold(1.0);
  await tapCheck('form[data-group-join] input[name=consent]', { label: 'tick 我愿意加入这个聊天室' });
  await hold(0.45);
  await tap('form[data-group-join] button[type=submit]', { label: 'tap 明确加入，继续聊' });
  await waitFor('messages', () => !document.querySelector('form[data-group-join]') && /我不是真人/.test(window.__p1.visQ('.community-panel')?.innerText || ''));
  await hold(1.0);
  await scrollEl('.conversation-actions', 1e5, { axis: 'x', n: 42, label: 'chip row → 专辑世界杯' });
  await hold(1.0);
  await scrollEl('.community-panel .conversation-content', 1e5, { n: 100, label: 'slow scroll through the messages' });
  await hold(1.0);
  clipStart('P-15', { feeds: ['S5', 'CUT-12'], what: '专辑世界杯: VS card 午夜站台 vs 樱花电波; tap 选《午夜站台》 (beat 2), tick (beat 4), 确认这一票 (beat 5), scroll to 「2票 · 你选了这张」 (beat 6)' });
  await hold(1.0);
  clipEnd('P-14');
});

step('P-15 world cup', async () => {
  await scrollEl('.community-panel .conversation-content', 0, { n: 40, label: 'scroll the chat room back up to the chips' });
  await hold(0.4);
  await tap('[data-group-worldcup]', { label: 'tap 专辑世界杯 · 一起选张来聊' });
  await waitVis('cup list', '.worldcup-panel .entry-list button');
  await hold(0.9);
  await tap('.worldcup-panel .entry-list button', { text: '今晚的专辑世界杯', label: 'tap 今晚的专辑世界杯' });
  await waitVis('VS card', '[data-cup-choice][data-album="night-platform"]');
  await hold(0.5);
  await still('CUT-12-worldcup-vs', { common: ['[data-cup-choice][data-album="night-platform"]', '[data-cup-choice][data-album="sakura-static"]'], pad: 12 });
  await still('CUT-12-full', { full: true });
  const g = grid('world cup', 4);
  await tap('[data-cup-choice][data-album="night-platform"]', { at: g(2), label: 'tap 选《午夜站台》 (beat 2)' });
  await waitVis('vote form', 'form[data-cup-vote]');
  await tapCheck('form[data-cup-vote] input[name=consent]', { at: g(4), label: 'tick 确认投票 (beat 4)' });
  await tap('form[data-cup-vote] button[type=submit]', { at: g(5), label: 'tap 确认这一票 (beat 5)' });
  await waitFor('voted 你选了这张', () => /你选了这张/.test(window.__p1.visQ('.worldcup-panel')?.innerText || ''));
  await untilFrame(g(6));
  const top = await page.evaluate(() => { const sc = window.__p1.visQ('.worldcup-panel .community-scroll'); const el = [...sc.querySelectorAll('*')].find(e => e.children.length === 0 && e.textContent.trim() === '你选了这张'); return el ? sc.scrollTop + el.getBoundingClientRect().top - 480 : sc.scrollTop - 260; });
  await scrollEl('.worldcup-panel .community-scroll', top, { n: Math.round(FPB), label: 'scroll to 「2票 · 你选了这张」 (beat 6)' });
  await hold(2.0);
  clipStart('P-16', { feeds: ['S6'], what: '默契局 「今晚谁和你同一首」: join (tick + 明确加入小游戏), the round starts, 我选「午夜站台」, tick + 先保留我的选择, reveal 「2 人选择 · 本轮有共同选择」' });
  await hold(1.0);
  clipEnd('P-15');
});

step('P-16 game', async () => {
  await tap('[data-cup-close]', { label: 'tap × (close world cup)' });
  await waitFor('cup closed', () => !window.__p1.visQ('.worldcup-panel'));
  await hold(0.5);
  await scrollEl('.conversation-actions', 0, { axis: 'x', n: 36, label: 'chip row back → 一起玩' });
  await hold(0.3);
  await tap('[data-group-games]', { label: 'tap 一起玩 · 默契局／音乐关系接龙' });
  await waitVis('games list', '.music-games .entry-list button');
  await hold(0.9);
  await tap('.music-games .entry-list button', { text: '今晚谁和你同一首', label: 'tap 今晚谁和你同一首' });
  await waitVis('join form', 'form[data-game-form="join"]');
  await hold(0.9);
  await tapCheck('form[data-game-form="join"] input[name=consent]', { label: 'tick 我自愿参加这一局' });
  await hold(0.45);
  await tap('form[data-game-form="join"] button', { text: '明确加入小游戏', label: 'tap 明确加入小游戏' });
  if (!(await s.until(() => !!window.__p1.visQ('[data-game-choice="night-platform"]'), { max: 360 }))) {
    await tap('[data-game="refresh"]', { label: 'tap 刷新游戏状态' });
    await waitVis('round', '[data-game-choice="night-platform"]', { max: 420 });
  } else ev('round starts', { type: 'state' });
  await hold(0.9);
  await tap('[data-game-choice="night-platform"]', { label: 'tap 我选「午夜站台」' });
  await waitVis('answer form', 'form[data-game-form="answer"]');
  await hold(0.6);
  await tapCheck('form[data-game-form="answer"] input[name=consent]', { label: 'tick 确认提交本轮选择' });
  await hold(0.45);
  await tap('form[data-game-form="answer"] button', { text: '先保留我的选择', label: 'tap 先保留我的选择' });
  if (!(await s.until(() => /本轮有共同选择/.test(window.__p1.visQ('.music-games')?.innerText || ''), { max: 360 }))) {
    await tap('[data-game="refresh"]', { label: 'tap 刷新游戏状态' });
    await waitFor('reveal', () => /本轮有共同选择/.test(window.__p1.visQ('.music-games')?.innerText || ''), { max: 420 });
  } else ev('reveal 2 人选择 · 本轮有共同选择', { type: 'state' });
  await hold(2.2);
  clipEnd('P-16');
});

step('P-17 community', async () => {
  await tap('[data-game="close"]', { label: 'tap × (close game)' });
  await waitFor('game closed', () => !window.__p1.visQ('.music-games'));
  await hold(0.5);
  await tap('.community-panel [data-group="close"]', { label: 'tap × (close chat room)' });
  await waitFor('chat room closed', () => !window.__p1.visQ('.community-panel'));
  await hold(0.6);
  await tap('#scene-details', { label: 'tap #scene-details' });
  await waitVis('room panel', '#panel [data-open="communities"]');
  await hold(0.4);
  clipStart('P-17', { feeds: ['S7'], what: '音乐社群: type 「周五散场以后」 (16ths), tick (beat 2), 创建我的社群 (beat 3); open it → community room with the 3D header 「周五散场以后」' });
  await hold(1.0);
  await tap('#panel [data-open="communities"]', { label: 'tap 长期音乐社群' });
  await waitVis('create form', 'form[data-community-create] input[name=title]');
  await hold(0.9);
  await tap('form[data-community-create] input[name=title]', { label: 'tap the title field' });
  const g = grid('community title 16ths', 10);
  await typeChars([...'周五散场以后'], i => g(i * 0.25), 'community');
  await tapCheck('form[data-community-create] input[name=consent]', { at: g(2), label: 'tick 创建长期空间… (beat 2)' });
  await tap('form[data-community-create] button[type=submit]', { at: g(3), label: 'tap 创建我的社群 (beat 3)' });
  await waitFor('community entry', () => !!window.__p1.find('.music-community .entry-list button', '周五散场以后'));
  await hold(0.9);
  await tap('.music-community .entry-list button', { text: '周五散场以后', label: 'tap 周五散场以后' });
  await waitFor('community room', () => { const c = window.__p1.visQ('.community-panel.conversation-layout'); return !!c && /周五散场以后/.test(c.innerText); });
  await hold(1.4);
  await scrollEl('.conversation-actions', 1e5, { axis: 'x', n: 40, label: 'chip row → 专辑世界杯 (Music Map chip out of frame)' });
  await hold(2.0);
  clipEnd('P-17');
});

step('P-18 corner', async () => {
  await tap('.community-panel [data-group="close"]', { label: 'tap × (close community)' });
  await waitFor('community closed', () => !window.__p1.visQ('.community-panel'));
  await hold(0.5);
  await tap('nav.camera-nav [data-view="person"]', { label: 'tap 同场的人' });
  await waitFor('people list', () => !!window.__p1.find('[data-person]', '小满'));
  await settled();
  await hold(0.6);
  clipStart('P-18', { feeds: ['S8'], what: '小满·示例 (friends) → 邀请共同创作 → 「TWO SIDES / 两个人的创作角 · 一起留张纪念。」 tick (beat 1), 创建共同创作邀请 (beat 2) → 「等待朋友本人明确参与。你不能替对方同意，也不会自动分享照片。」' });
  await hold(1.0);
  await tap('[data-person]', { text: '小满', label: 'tap 小满·示例' });
  await waitVis('friend card', '#panel [data-open="corners"]');
  await settled();
  await hold(1.0);
  await tap('#panel [data-open="corners"]', { label: 'tap 邀请共同创作' });
  await waitVis('corner sheet', '.corner-panel input[name=participation]');
  await hold(0.7);
  const g = grid('corner', 4);
  await tapCheck('.corner-panel input[name=participation]', { at: g(1), label: 'tick 我选择邀请这位朋友… (beat 1)' });
  await tap('.corner-panel button', { text: '创建共同创作邀请', at: g(2), label: 'tap 创建共同创作邀请 (beat 2)' });
  await waitFor('等待朋友本人明确参与', () => /等待朋友本人明确参与/.test(window.__p1.visQ('.corner-panel')?.innerText || ''));
  await hold(2.0);
  clipEnd('P-18');
});

let download = null;
step('P-19 recap + memory card', async () => {
  await tap('[data-corner-close]', { label: 'tap × (close corner)' });
  await waitFor('corner closed', () => !window.__p1.visQ('.corner-panel'));
  await hold(0.4);
  if (!(await page.evaluate(() => document.querySelector('#panel').hidden))) { await tap('#panel-close', { label: 'tap × (close panel)' }); await hold(0.4); }
  await tap('nav.camera-nav [data-view="overview"]', { label: 'tap 全景' });
  await s.frames(2); await settled();
  await hold(0.4);
  await tap('#scene-details', { label: 'tap #scene-details' });
  await waitVis('room panel', '#panel [data-open="recap"]');
  await hold(0.3);
  clipStart('P-19', { feeds: ['S9', 'CUT-08'], what: 'recap 「把这一晚，留在手里。」 → 保存我的纪念卡 ↗ (beat 2) → ticks photo/avatar/confirm (beats 4,5,6) → 下载纪念卡 PNG (beat 7) → 「已发起下载…」 → preview 你的纪念卡' });
  await hold(1.0);
  await tap('#panel [data-open="recap"]', { label: 'tap 回看这一晚' });
  await waitVis('recap', '#panel [data-open="memory-card"]');
  await hold(0.9);
  const tgt = await page.evaluate(() => { const b = window.__p1.visQ('#panel [data-open="memory-card"]'); const p = document.querySelector('#panel'); return p.scrollTop + b.getBoundingClientRect().top - 470; });
  await scrollEl('#panel', tgt, { n: 48, label: 'scroll to 把这一晚，留在手里。' });
  await hold(0.4);
  const g = grid('memory card', 4);
  await tap('#panel [data-open="memory-card"]', { at: g(2), label: 'tap 保存我的纪念卡 ↗ (beat 2)' });
  await waitVis('memory form', '#panel input[name="memory-photo"]');
  await untilFrame(g(3));
  await scrollEl('#panel', 1e5, { n: Math.round(FPB * 0.9), label: 'scroll to the ticks + download (beat 3)' });
  download = page.waitForEvent('download', { timeout: 120000 }).catch(e => { warn('download: ' + e.message); return null; });
  await tapCheck('#panel input[name="memory-photo"]', { at: g(4), label: 'tick photo (beat 4)' });
  await tapCheck('#panel input[name="memory-avatar"]', { at: g(5), label: 'tick avatar (beat 5)' });
  await tapCheck('#panel input[name="memory-confirm"]', { at: g(6), label: 'tick confirm (beat 6)' });
  await tap('#panel button', { text: '下载纪念卡 PNG', at: g(7), label: 'tap 下载纪念卡 PNG (beat 7)' });
  await waitFor('已发起下载', () => /已发起下载/.test(document.querySelector('#panel')?.innerText || ''), { max: 600 });
  await hold(1.4);
  await scrollEl('#panel', 1e5, { n: 54, label: 'scroll to the preview 你的纪念卡' });
  await hold(1.8);
  clipEnd('P-19');
  const d = await Promise.race([download, sleep(20000).then(() => null)]);
  if (d && !DRY) { fs.mkdirSync(STILLS, { recursive: true }); await d.saveAs(`${STILLS}/CUT-08-memory-card.png`); ev('memory card PNG saved: ' + d.suggestedFilename(), { type: 'file' }); }
  else if (!d) warn('no download event');
});

step('P-20 my space', async () => {
  await tap('#panel-close', { label: 'tap × (close recap)' });
  await waitFor('panel closed', () => document.querySelector('#panel').hidden);
  await hold(0.4);
  clipStart('P-20', { feeds: ['S10'], what: 'MY SPACE / 长期留在这里: avatar, 阿宁, tiles; slow scroll to 我的社群 / 我的现场 / 我的音乐朋友' });
  await hold(1.0);
  await tap('#my-space', { label: 'tap 我的空间' });
  await waitVis('my space', '.personal-space');
  await hold(2.6);
  await scrollEl('.personal-space .community-scroll', 1e5, { n: 84, label: 'slow scroll my space' });
  await hold(1.5);
  clipEnd('P-20');
});

step('P-SP1 photo wall', async () => {
  await tap('.personal-space [data-space="close"]', { label: 'tap × (close my space)' });
  await waitFor('my space closed', () => !window.__p1.visQ('.personal-space'));
  await hold(0.4);
  clipStart('P-SP1', { feeds: ['(spare) 3D photo wall, 5 polaroids'], what: 'tap 照片墙 → the product camera glides to the 3D wall with 5 polaroids' });
  await hold(1.0);
  await tap('nav.camera-nav [data-view="photos"]', { label: 'tap 照片墙' });
  await s.frames(2); await settled();
  ev('camera settled on the photo wall', { type: 'state' });
  await hold(3.0);
  clipEnd('P-SP1');
});

// ------------------------------------------------------------------------------------------------------------------------------
const t0 = Date.now();
const browser = await launch();
let failed = null;
try {
  s = await Session.open(browser, { url: BASE, ...PHONE, cursor: 'touch', name: 'P1', clockStart: CLOCK, css: CSS });
  page = s.page;
  await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  const faces = await page.evaluate(() => Promise.all([...document.fonts].map(f => f.load().then(() => 1, () => 0))).then(a => a.length));
  await page.evaluate(PAGE_HELPERS);
  await sleep(2500);                                      // landing entrance settles in real time (clock not frozen yet)
  log('boot ok, font faces preloaded:', faces);
  master = new Master(); s.sink = master;
  await s.freeze();
  s._oneFrame = async function () {                       // rig frame + load settling + state probe + multi-sink write
    await this.step(1);
    if (!DRY) await Promise.race([this.page.evaluate(() => window.__p1.settle()).catch(() => 0), sleep(1500)]);
    const st = await this.page.evaluate(() => window.__p1.state()).catch(e => ({ err: String(e).slice(0, 80) }));
    const buf = DRY ? null : await this.grab();
    await master.write(buf, st);
    this.frame++;
  };
  for (const [id, fn] of STEPS) {
    log('==', id);
    await fn();
    if (STOP_AT && id.startsWith(STOP_AT)) { log('STOP_AT', STOP_AT); break; }
  }
} catch (e) { failed = e; console.error('FAILED', e); }
finally {
  for (const id of [...clips.keys()]) clipEnd(id);
  const results = await Promise.all(finished.map(c => c.result.catch(e => ({ error: String(e) }))));
  const m = master?.sink ? await master.sink.end().catch(e => ({ error: String(e) })) : null;
  const out = {
    take: 'TAKE-P1', dry: DRY, failed: failed ? String(failed.stack || failed).slice(0, 600) : null, base: BASE, clock: CLOCK, bpm: BPM, fpb: FPB, fps: OUT_FPS,
    viewport: { css: [PHONE.width, PHONE.height], dpr: PHONE.dpr, px: [W, H] }, wall_seconds: Math.round((Date.now() - t0) / 1000),
    master: m, frames: F(), clips: finished.map((c, i) => ({ id: c.id, start: c.start, end: c.end, frames: c.frames, meta: c.meta, file: results[i]?.file || null, bytes: results[i]?.bytes || null, error: results[i]?.error || null })),
    events, grids, stills, warnings, errors: s?.errors || [], console: (s?.console || []).slice(0, 50), hashes, states,
  };
  fs.writeFileSync(DRY ? `${DIR}/dry/take.json` : `${DIR}/take.json`, JSON.stringify(out));
  log('done', failed ? 'FAILED' : 'ok', `${F()} frames`, `${out.wall_seconds}s wall`);
  await s?.ctx.close().catch(() => {});
  await browser.close();
  if (failed) process.exitCode = 1;
}
