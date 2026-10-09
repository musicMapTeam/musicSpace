// TAKE-H-rc2: the host / venue side re-filmed on the rc2 build (0.22.0-rc.2 content, /tmp/space-final/dist-pages) after the owner's copy
// decisions of 2026-10-07 (no explanatory copy, the host side and the long-term community are the Livehouse's).  Same frame-stepped rig as
// TAKE-H (rig/rec2.mjs + rig/p1lib.mjs = byte copies of ../P1/rig/rec2.mjs and ../P1/p1lib.mjs; phone 1080x2340 @ 60 fps, fake clock, taps
// and typing on a 123 BPM grid).  Same three clips, same ids, one continuous world:
//   setup  (not recorded)  landing -> 进入现场 -> wardrobe: 阿宁 in 失真 (the film's "you") -> saved -> entry panel ->
//          「我是 Livehouse / 主办方，开个房」 -> 「开一个房间」 -> the create sheet
//   H-01   Livehouse / 为这一场开房 · 今晚叫什么名字？: 场次名称 「周五 · 月台夜」, 场地 「月台 Livehouse」 typed on 32nds, consent,
//          开房并进入现场 -> the new room 「周五 · 月台夜」
//   H-02   room panel -> 「Livehouse 乐迷社群」 -> 社群名称 「月台 Livehouse 乐迷社群」 typed on 32nds (beat 0..2), tick (beat 3),
//          「创建 Livehouse 乐迷社群」 (beat 4), open it (beat 4.5) -> the community room: 3D header with the sign 「月台 Livehouse / 乐迷社群」,
//          散场以后，也留一个位置
//   H-03   设置与管理 ··· -> 下一场预告 -> LIVEHOUSE / 下一场见 · 发布下一场预告 filled (周六 · 月台夜 / 月台 Livehouse / 10/17 20:00 /
//          下周六，还在月台见！); tick 「发布给社群成员」 (beat 1) -> 「发布预告」 (beat 2) -> 下一场: the card 「下一场预告 · 周六 · 月台夜」
// Before each clip and at each state the DOM text is checked for 示例 / 虚构 / 本页 (the take stops on a hit).
// Output: clips/H-0x.mp4, stills/CUT-H*.png, take.json (events, beat grids, guards, per-frame state of the recorded frames).
//   env: SPACE_BASE (default http://127.0.0.1:48613/musicSpace/)  BPM=123  DRY=1 (no grabs)
import fs from 'node:fs';
import { launch, Session, PHONE, OUT_FPS, sleep } from './rig/rec2.mjs';
import { Sink, PAGE_HELPERS, md5 } from './rig/p1lib.mjs';

const DIR = '/tmp/space-video-doodle/prod/capture/H1-host-rc2';
const BASE = process.env.SPACE_BASE || 'http://127.0.0.1:48613/musicSpace/';
const DRY = process.env.DRY === '1';
const BPM = +(process.env.BPM || 123);
const FPB = 60 * OUT_FPS / BPM;                           // output frames per beat (29.268 at 123 BPM)
const CLOCK = '2026-10-09T22:40:00+08:00';                // a Friday night (the room is 「周五 · 月台夜」; the next show 10/17 is a Saturday)
const W = 1080, H = 2340;
const CSS = 'input,textarea{caret-color:transparent!important}';
const OUTV = `${DIR}/clips`, STILLS = `${DIR}/stills`;
const COMMUNITY = '月台 Livehouse 乐迷社群';

let s, page;
let frame = 0;                                            // every stepped frame (recorded or not)
const clips = new Map(), finished = [], events = [], grids = [], stills = [], warnings = [], states = [], guards = [], fontWaits = [];
const F = () => frame;
const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}] f${F()}`, ...a);
const warn = m => { warnings.push({ frame: F(), msg: m }); log('WARN', m); };
const ev = (label, extra = {}) => { const e = { label, frame: F(), ...extra }; for (const c of clips.values()) e['f_' + c.id] = F() - c.start; events.push(e); return e; };

function clipStart(id, meta = {}) {
  clips.set(id, { id, start: F(), frames: 0, meta, sink: DRY ? null : new Sink(`${OUTV}/${id}.mp4`, { w: W, h: H, crf: 15, preset: 'slow' }) });
  log('clip start', id);
}
function clipEnd(id) {
  const c = clips.get(id); clips.delete(id); c.end = F();
  c.result = c.sink ? c.sink.end() : Promise.resolve(null);
  finished.push(c); log('clip end', id, `${c.end - c.start} frames`);
}
function grid(name, lead = 4) { const b0 = F() + lead; const g = k => b0 + Math.round(k * FPB); grids.push({ name, beat0: b0, bpm: BPM, fpb: +FPB.toFixed(4), clips: Object.fromEntries([...clips.values()].map(c => [c.id, b0 - c.start])) }); ev(`♩ ${name} beat0`, { type: 'grid', beat0: b0 }); return g; }
async function untilFrame(f) { const n = f - F(); if (n > 0) await s.frames(n); else if (n < 0) warn(`untilFrame late by ${-n}`); }
const hold = sec => s.hold(sec);
/** the brief: grep the DOM text that is (about to be) filmed for 示例 / 虚构 / 本页 */
async function guard(label) {
  const hits = await page.evaluate(() => { const t = document.body.innerText || ''; const out = []; for (const w of ['示例', '虚构', '本页']) { let i = -1; while ((i = t.indexOf(w, i + 1)) >= 0) out.push(w + ': …' + t.slice(Math.max(0, i - 24), i + 24).replace(/\s+/g, ' ') + '…'); } return out; });
  const rec = { label, frame: F(), hits }; for (const c of clips.values()) rec['f_' + c.id] = F() - c.start; guards.push(rec);
  if (hits.length) { warn(`text guard ${label}: ${hits.join(' | ')}`); throw new Error('text guard failed: ' + label); }
  log('guard ok', label);
}
async function boxOf(sel, text = '') { return page.evaluate(([a, b]) => window.__p1.box(a, b), [sel, text]); }
async function tap(sel, { text = '', at = null, press = 3, label = '', check = false } = {}) {
  label = label || `tap ${sel}${text ? ' ' + text : ''}`;
  if (at != null) await untilFrame(at - press);
  let b = await boxOf(sel, text);
  if (!b) throw new Error(`tap: not visible: ${label}`);
  if (check && b.w * b.h < 36) {
    b = await page.evaluate(([a]) => { const e = window.__p1.visQ(a) || document.querySelector(a); const l = e && e.closest('label'); if (!l) return null; const r = l.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + 22, cy: r.y + r.height / 2 }; }, [sel]);
    if (!b) throw new Error(`tap: checkbox without box: ${label}`);
  }
  const hit = check ? 'ok' : await page.evaluate(([a, t]) => window.__p1.hit(a, t), [sel, text]);
  if (hit !== 'ok') throw new Error(`tap: ${label}: ${hit}`);
  const x = b.cx, y = b.cy;
  if (y < 6 || y > s.H - 6 || x < 6 || x > s.W - 6) throw new Error(`tap: off-screen ${label} @${x | 0},${y | 0}`);
  await page.mouse.move(x, y);
  const down = F(); await page.mouse.down(); await s.frames(press); await page.mouse.up();
  return ev(label, { type: 'tap', down, x: Math.round(x * s.dpr), y: Math.round(y * s.dpr), ...(at != null ? { target: at } : {}) });
}
const tapCheck = (sel, o = {}) => tap(sel, { ...o, check: true });
async function typeChars(chars, frameAt, label) {
  for (let i = 0; i < chars.length; i++) { await untilFrame(frameAt(i)); await page.keyboard.type(chars[i]); ev(`${label} key ${chars[i]}`, { type: 'key', i }); }
}
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
async function scrollEl(sel, to, { n = 36, label = '', axis = 'y' } = {}) {
  const info = await page.evaluate(([a, v, ax]) => { const e = window.__p1.visQ(a); if (!e) return null; const max = ax === 'y' ? e.scrollHeight - e.clientHeight : e.scrollWidth - e.clientWidth; return { from: ax === 'y' ? e.scrollTop : e.scrollLeft, to: Math.max(0, Math.min(max, v)) }; }, [sel, to, axis]);
  if (!info) throw new Error('scroll: no visible ' + sel);
  const e0 = ev(label || `scroll ${sel}`, { type: 'scroll', from: Math.round(info.from), to: Math.round(info.to), frames: n, axis });
  if (Math.abs(info.to - info.from) < 1) { warn('scroll no-op ' + sel); return e0; }
  // eased and quantised to whole CSS px (2.77 device px): the head skips the frames that would not move (nothing is captured for them),
  // the tail snaps to the target once a step drops under 1 px -> every captured frame of the scroll moves
  let last = Math.round(info.from), captured = 0;
  for (let i = 1; i <= n; i++) {
    let v = info.from + (info.to - info.from) * ease(i / n);
    const next = info.from + (info.to - info.from) * ease(Math.min(1, (i + 1) / n));
    if (i > n / 2 && Math.abs(next - v) < 1) v = info.to;
    v = Math.round(v);
    if (v === last && i <= n / 2) continue;
    if (v === last) break;
    await page.evaluate(([a, v, ax]) => { window.__p1.visQ(a).scrollTo(ax === 'y' ? { top: v, behavior: 'instant' } : { left: v, behavior: 'instant' }); }, [sel, v, axis]);
    await s.frames(1); last = v; captured++;
    if (v === Math.round(info.to)) break;
  }
  e0.frames = captured;
  return e0;
}
/** scroll so that the top of `target` (inside the scroller `sel`) sits `margin` CSS px below the scroller's top */
async function scrollTo(sel, target, { margin = 16, n = 30, label = '' } = {}) {
  const v = await page.evaluate(([a, t, m]) => { const sc = window.__p1.visQ(a), el = document.querySelector(t); if (!sc || !el) return null; return sc.scrollTop + el.getBoundingClientRect().top - sc.getBoundingClientRect().top - m; }, [sel, target, margin]);
  if (v == null) throw new Error('scrollTo: missing ' + sel + ' / ' + target);
  return scrollEl(sel, v, { n, label });
}
async function scrollToText(scroller, sel, text, { margin = 16, n = 24, label = '' } = {}) {
  const v = await page.evaluate(([a, s2, t, m]) => { const sc = window.__p1.visQ(a); const el = [...document.querySelectorAll(s2)].find(e => e.getClientRects().length && (e.innerText || '').includes(t)); if (!sc || !el) return null; return sc.scrollTop + el.getBoundingClientRect().top - sc.getBoundingClientRect().top - m; }, [scroller, sel, text, margin]);
  if (v == null) throw new Error('scrollToText: missing ' + scroller + ' / ' + sel + ' ' + text);
  return scrollEl(scroller, v, { n, label });
}
async function waitFor(label, pred, { max = 600, arg } = {}) {
  const f0 = F(); const ok = await s.until(pred, { max, arg });
  if (!ok) throw new Error(`waitFor timeout: ${label} (${F() - f0} frames)`);
  return ev(label, { type: 'state', waited: F() - f0 });
}
const VIS = a => !!window.__p1.visQ(a);
const waitVis = (label, sel, o = {}) => waitFor(label, VIS, { ...o, arg: sel });
async function still(name, { sel, text = '', pad = 12, full = false } = {}) {
  let clip;
  if (full) clip = { x: 0, y: 0, width: s.W, height: s.H, scale: s.dpr };
  else {
    const b = await boxOf(sel, text); if (!b) { warn('still: no box ' + name); return; }
    const x = Math.max(0, b.x - pad), y = Math.max(0, b.y - pad);
    clip = { x, y, width: Math.min(s.W - x, b.w + 2 * pad), height: Math.min(s.H - y, b.h + 2 * pad), scale: s.dpr };
  }
  const rec = { name, file: `${STILLS}/${name}.png`, frame: F() - 1, clip_px: { x: Math.round(clip.x * s.dpr), y: Math.round(clip.y * s.dpr), w: Math.round(clip.width * s.dpr), h: Math.round(clip.height * s.dpr) } };
  for (const c of clips.values()) rec['f_' + c.id] = F() - 1 - c.start;
  stills.push(rec);
  if (DRY) return;
  fs.mkdirSync(STILLS, { recursive: true });
  const r = await s.cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true, clip });
  fs.writeFileSync(rec.file, Buffer.from(r.data, 'base64'));
}
/** element boxes in device px (for the film's measurements) */
async function boxes(label, list) {
  const r = await page.evaluate(l => Object.fromEntries(l.map(([k, sel, text]) => { const b = window.__p1.box(sel, text || ''); return [k, b ? [b.x, b.y, b.w, b.h] : null]; })), list);
  const px = Object.fromEntries(Object.entries(r).map(([k, b]) => [k, b ? b.map(v => Math.round(v * s.dpr)) : null]));
  ev('boxes ' + label, { type: 'boxes', px });
  return px;
}

// ------------------------------------------------------------------------------------------------------------------------------
const browser = await launch();
const t0 = Date.now();
let failed = null;
try {
  s = await Session.open(browser, { url: BASE, ...PHONE, cursor: 'touch', name: 'H', clockStart: CLOCK, css: CSS });
  page = s.page;
  await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => Promise.all([...document.fonts].map(f => f.load().then(() => 1, () => 0))));
  await page.evaluate(PAGE_HELPERS);
  await sleep(2500);
  await s.freeze();
  s._oneFrame = async function () {                       // step; grab only while a clip is open
    await this.step(1);
    if (clips.size) {
      // the Doodle faces are sliced by character (font-display: swap): force layout (font loads start there), then never grab while a slice loads
      if (!DRY) { const fsx = await this.page.evaluate(() => { void document.body.offsetHeight; return document.fonts.status; }).catch(() => 'loaded'); if (fsx !== 'loaded') { const w0 = Date.now(); await Promise.race([this.page.evaluate(() => document.fonts.ready.then(() => 1)), sleep(5000)]).catch(() => 0); fontWaits.push([frame, Date.now() - w0]); } }
      if (!DRY) await Promise.race([this.page.evaluate(() => window.__p1.settle()).catch(() => 0), sleep(1500)]);
      const st = await this.page.evaluate(() => window.__p1.state()).catch(e => ({ err: String(e).slice(0, 80) }));
      const buf = DRY ? null : await this.grab(); const h = buf ? md5(buf) : '';
      states.push({ f: frame, ...st });
      await Promise.all([...clips.values()].map(c => { c.frames++; return c.sink ? c.sink.write(buf, h) : null; }));
    }
    this.frame++; frame++;
  };

  // ---------------------------------------------------------------- setup (not recorded): 阿宁 in 失真, saved
  log('== setup');
  await guard('landing');
  await tap('#join', { label: 'tap 进入现场' });
  await waitFor('entry panel', () => !document.querySelector('#panel').hidden && !!document.querySelector('form[data-form="demo-entry"]'));
  await hold(0.6);
  await tap('form[data-form="demo-entry"] button', { text: '现在换个造型', label: 'tap 现在换个造型' });
  await waitVis('wardrobe', '.wardrobe');
  await hold(0.8);
  await tap('.wardrobe input[aria-label="昵称"]', { label: 'nickname field' });
  await page.keyboard.press('Meta+A').catch(() => {}); await page.keyboard.press('Backspace').catch(() => {});
  await page.evaluate(() => { const i = document.querySelector('.wardrobe input[aria-label="昵称"]'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.keyboard.type('阿宁'); await hold(0.3);
  await scrollEl('.wardrobe-tools', 1e5, { n: 20 });
  await tap('.wardrobe summary', { text: '试试现成搭配', label: 'tap 试试现成搭配' });
  await hold(0.3);
  await scrollEl('.wardrobe-tools', 1e5, { n: 20 });
  await hold(0.3);
  await tap('.wardrobe [data-preset="4"]', { label: 'preset 失真' });
  await hold(0.5);
  await tap('[data-wardrobe-save]', { label: 'save' });
  await waitFor('toast 小人已保存', () => /小人已保存/.test(document.querySelector('#toast')?.textContent || ''));
  await hold(1.0);
  if (await page.evaluate(() => document.querySelector('#panel').hidden)) {
    await tap('#join', { label: 'tap 进入现场 (again)' });
  }
  await waitFor('entry panel (阿宁)', () => !document.querySelector('#panel').hidden && !!document.querySelector('form[data-form="demo-entry"]'));
  await hold(0.6);
  // the entry's 「我是 Livehouse / 主办方，开个房」 (details) -> 「开一个房间」 -> the create sheet
  await scrollTo('#panel', 'details.demo-entry-more', { margin: 120, n: 20 });
  await tap('details.demo-entry-more summary', { label: 'open 我是 Livehouse / 主办方，开个房' });
  await hold(0.4);
  await scrollTo('#panel', 'details.demo-entry-more button[data-open="create"]', { margin: 160, n: 16 });
  await hold(0.2);
  await tap('details.demo-entry-more button[data-open="create"]', { label: 'tap 开一个房间' });
  await waitFor('create sheet', () => !!document.querySelector('form[data-form="create"]'));
  await hold(0.2);
  if (await page.evaluate(() => document.querySelector('#panel').scrollTop > 0)) await scrollEl('#panel', 0, { n: 10 });
  await guard('create sheet');
  // the setup's toast 「小人已保存…」 (5 s) must be gone before the clip starts
  await waitFor('toast gone', () => !document.querySelector('#toast')?.classList.contains('visible'), { max: 900 });
  await hold(0.6);

  // ---------------------------------------------------------------- H-01 Livehouse / 为这一场开房
  log('== H-01');
  clipStart('H-01', { feeds: ['A6 73'], what: 'Livehouse / 为这一场开房 · 今晚叫什么名字？: 场次名称 「周五 · 月台夜」 (32nds from beat 0.25), 场地 「月台 Livehouse」 (32nds from beat 1.625, done on beat 3); consent; 开房并进入现场 -> the new room 「周五 · 月台夜」' });
  await hold(1.0);
  await boxes('create', [['eyebrow', '#panel .eyebrow'], ['h2', '#panel h2'], ['title', 'form[data-form="create"] input[name=title]'], ['venue', 'form[data-form="create"] input[name=venue]'], ['song', 'form[data-form="create"] select']]);
  {
    const g = grid('create sheet', 6);
    await tap('form[data-form="create"] input[name=title]', { at: g(0), label: 'tap 场次名称 (beat 0)' });
    await typeChars([...'周五 · 月台夜'], i => g(0.25 + i / 8), 'title');
    await tap('form[data-form="create"] input[name=venue]', { at: g(1.5), label: 'tap 场地 (beat 1.5)' });
    await typeChars([...'月台 Livehouse'], i => g(1.625 + i / 8), 'venue');
    await untilFrame(g(4));
    await still('CUT-H1-create-sheet', { full: true });
    await boxes('create typed', [['title', 'form[data-form="create"] input[name=title]'], ['venue', 'form[data-form="create"] input[name=venue]'], ['h2', '#panel h2']]);
    await hold(0.6);
  }
  await scrollTo('#panel', 'form[data-form="create"] label.consent', { margin: 300, n: 30, label: 'scroll to the consent' });
  await hold(0.3);
  await tapCheck('form[data-form="create"] input[name=consent]', { label: 'tick 我愿意向本场成员展示我的昵称和小人' });
  await hold(0.4);
  await tap('form[data-form="create"] button[type=submit]', { label: 'tap 开房并进入现场' });
  await waitFor('the new room', () => document.querySelector('#panel').hidden && /月台夜/.test(document.querySelector('#room-title')?.textContent || ''), { max: 900 });
  await hold(1.0);
  await guard('the new room');
  await hold(1.5);
  await still('CUT-H1-new-room', { full: true });
  await hold(0.5);
  clipEnd('H-01');

  // ---------------------------------------------------------------- H-02 the venue's 乐迷社群
  log('== H-02');
  await tap('#scene-details', { label: 'tap #scene-details' });
  await waitVis('room panel', '#panel [data-open="communities"]');
  await hold(0.5);
  await tap('#panel [data-open="communities"]', { label: 'tap Livehouse 乐迷社群' });
  await waitVis('create form', 'form[data-community-create] input[name=title]');
  await hold(0.5);
  await tap('form[data-community-create] input[name=title]', { label: 'tap 社群名称' });
  await hold(0.3);
  await guard('乐迷社群 list + create form');
  clipStart('H-02', { feeds: ['A5 S7 65-66', 'A6 74'], what: 'Livehouse 乐迷社群: 社群名称 「月台 Livehouse 乐迷社群」 typed on 32nds from beat 0 (done on beat 2), tick 「创建社群，向成员展示我的昵称、小人和发言」 (beat 3), 「创建 Livehouse 乐迷社群」 (beat 4); open it (beat 4.5) -> the community room: the 3D header with the sign 「月台 Livehouse / 乐迷社群」, 散场以后，也留一个位置' });
  await hold(1.0);
  await boxes('community create', [['list', '.music-community'], ['input', 'form[data-community-create] input[name=title]'], ['consent', 'form[data-community-create] label'], ['create', 'form[data-community-create] button[type=submit]']]);
  {
    const g = grid('community', 6);
    await typeChars([...COMMUNITY], i => g(i / 8), 'community');
    await tapCheck('form[data-community-create] input[name=consent]', { at: g(3), label: 'tick 创建社群… (beat 3)' });
    await tap('form[data-community-create] button[type=submit]', { at: g(4), label: 'tap 创建 Livehouse 乐迷社群 (beat 4)' });
    await waitFor('community entry', () => !!window.__p1.find('.music-community .entry-list button', '月台 Livehouse 乐迷社群'));
    await boxes('community list', [['entry', '.music-community .entry-list button']]);
    await untilFrame(Math.max(F() + 2, g(4.5)));
    await tap('.music-community .entry-list button', { text: '月台 Livehouse 乐迷社群', label: 'tap 月台 Livehouse 乐迷社群 (beat 4.5)' });
  }
  await waitFor('community room', () => { const c = window.__p1.visQ('.community-panel.conversation-layout'); return !!c && /月台 Livehouse 乐迷社群/.test(c.innerText); });
  await hold(1.0);
  await guard('community room');
  await hold(2.0);
  await still('CUT-H2-community-room', { full: true });
  await boxes('community room', [['panel', '.community-panel.conversation-layout'], ['h2', '.community-panel h2'], ['eyebrow', '.community-panel .eyebrow'], ['actions', '.conversation-actions']]);
  await hold(0.5);
  clipEnd('H-02');

  // ---------------------------------------------------------------- H-03 下一场预告, published to the community
  log('== H-03');
  await tap('.community-panel summary', { text: '设置与管理', label: 'open 设置与管理 ···' });
  await hold(0.5);
  await tap('.community-panel [data-group-space]', { label: 'tap 下一场预告' });
  await waitVis('space panel', '.space-management');
  await waitFor('space loaded', () => /下一场/.test(document.querySelector('.space-management')?.innerText || '') && !/正在读取/.test(document.querySelector('.space-management')?.innerText || ''));
  await hold(0.6);
  await scrollToText('.space-management .community-scroll', '.space-management summary', '发布下一场预告', { margin: 260, n: 24 }).catch(e => warn(String(e)));
  await tap('.space-management summary', { text: '发布下一场预告', label: 'open 发布下一场预告' });
  await waitVis('event form', 'form[data-organization="event"] input[name=title]');
  await hold(0.4);
  const ef = 'form[data-organization="event"]';
  // frame the whole form: the details' summary 发布下一场预告 near the top of the sheet
  await scrollToText('.space-management .community-scroll', '.space-management summary', '发布下一场预告', { margin: 150, n: 24, label: 'frame the event form' }).catch(e => warn(String(e)));
  await hold(0.3);
  await tap(`${ef} input[name=title]`, { label: 'tap 演出名称' });
  await typeChars([...'周六 · 月台夜'], i => F() + 4, 'event title');
  await tap(`${ef} input[name=venue]`, { label: 'tap 场地' });
  await typeChars([...'月台 Livehouse'], i => F() + 4, 'event venue');
  await page.evaluate(sel => { const i = document.querySelector(sel); i.value = '2026-10-17T20:00'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); }, `${ef} input[name=startsAt]`);
  await s.frames(4);
  await tap(`${ef} input[name=note]`, { label: 'tap 给乐迷的话' });
  await typeChars([...'下周六，还在月台见！'], i => F() + 4, 'event note');
  await hold(0.3);
  await guard('event form filled');
  clipStart('H-03', { feeds: ['A6 75-76'], what: 'LIVEHOUSE / 下一场见 · 发布下一场预告 filled (周六 · 月台夜 / 月台 Livehouse / 10/17 20:00 / 下周六，还在月台见！); tick 「发布给社群成员」 (beat 1), 「发布预告」 (beat 2) -> 下一场: the card 「下一场预告 · 周六 · 月台夜」' });
  await hold(1.0);
  await still('CUT-H3-event-form', { sel: ef, pad: 16 });
  await boxes('event form', [['form', ef], ['consent', `${ef} label:has(input[name=consent])`], ['publish', `${ef} button`], ['title', `${ef} input[name=title]`], ['note', `${ef} input[name=note]`]]);
  {
    const g = grid('publish', 6);
    await tapCheck(`${ef} input[name=consent]`, { at: g(1), label: 'tick 发布给社群成员 (beat 1)' });
    await tap(`${ef} button`, { at: g(2), label: 'tap 发布预告 (beat 2)' });
  }
  await waitFor('event card', () => !!window.__p1.visQ('.space-management article.space-event'));
  ev('event card on screen', { type: 'state' });
  await hold(0.6);
  await guard('event card');
  await hold(0.6);
  await still('CUT-H3-event-card', { sel: '.space-management article.space-event', pad: 14 });
  await still('CUT-H3-space-after', { full: true });
  await boxes('event card', [['card', '.space-management article.space-event'], ['small', '.space-management article.space-event small'], ['title', '.space-management article.space-event h3'], ['start', '.space-management [data-event-start]']]);
  await hold(1.5);
  clipEnd('H-03');
} catch (e) { failed = e; console.error('FAILED', e); try { await s.still(`${DIR}/probe/take-fail.png`); } catch {} }
finally {
  for (const id of [...clips.keys()]) clipEnd(id);
  const results = await Promise.all(finished.map(c => c.result.catch(e => ({ error: String(e) }))));
  const out = {
    take: 'TAKE-H-rc2 (host / venue side, rc2 build)', build: '0.22.0-rc.2', dry: DRY, failed: failed ? String(failed.stack || failed).slice(0, 800) : null, base: BASE, clock: CLOCK, bpm: BPM, fpb: FPB, fps: OUT_FPS,
    viewport: { css: [PHONE.width, PHONE.height], dpr: PHONE.dpr, px: [W, H] }, wall_seconds: Math.round((Date.now() - t0) / 1000), frames: F(),
    clips: finished.map((c, i) => ({ id: c.id, start: c.start, end: c.end, frames: c.frames, meta: c.meta, file: results[i]?.file || null, bytes: results[i]?.bytes || null, error: results[i]?.error || null, hashes: c.sink ? c.sink.hashes : [] })),
    events, grids, stills, guards, fontWaits, warnings, errors: s?.errors || [], console: (s?.console || []).slice(0, 50), states,
  };
  fs.writeFileSync(`${DIR}/take.json`, JSON.stringify(out, null, 1));
  log('done', failed ? 'FAILED' : 'ok', `${F()} frames`, `${out.wall_seconds}s wall`, 'font waits', JSON.stringify(fontWaits));
  await s?.ctx.close().catch(() => {});
  await browser.close();
  if (failed) process.exitCode = 1;
}
