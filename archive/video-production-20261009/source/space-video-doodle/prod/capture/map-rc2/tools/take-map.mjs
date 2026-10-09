// TAKE-MAP (film v2 re-capture, rc2 build 0.22.0-rc.2): the embedded Music Map 「音乐探索」 in its Doodle look.
//   node take-map.mjs P1 | P2 | D1 | D2          env: DRY=1 (CSS px at DPR 1, files under ../dry/), SPACE_BASE
//   P1  phone   1080x2340  MAP-P1-round      room 「回声现场」 -> tap 「音乐探索」 -> the record table round 费玉清 → 邓紫棋 (ink draws in) ->
//                                          翻开《千里之外》 (× 周杰伦) -> 来源 (paper, ~2.5 s) -> 前往 周杰伦 -> 翻开《稻香 / Stay With You》 (× 林俊杰)
//                                          -> 前往 林俊杰 -> 翻开《手心的蔷薇》 (× 邓紫棋 终点) -> 前往 邓紫棋 -> 抵达 -> 连线歌单 -> 「+ 留下」 -> the setlist
//   P2  phone   1080x2340  MAP-P2-courtyard  music-map 小院 opened fresh (ink draws in) -> 7 s untouched courtyard -> tap the 「唱片店」 pin ->
//                                          the product's own camera flight into the record shop at 1/3 speed (Date.now warp: GSAP) -> the
//                                          round's table -> 「小院」 -> the flight back out at natural speed -> courtyard
//   D1  desktop 3840x2160 (+1920x1080 edit copy)  MAP-D1-round      as P1
//   D2  desktop 3840x2160 (+1920x1080 edit copy)  MAP-D2-courtyard  as P2
// Frame-stepped on the fake clock (maprig.mjs): 16 ms of virtual time per frame, 60 fps files (4 % slower than real time, as every clip of
// this rig).  Taps on a 123 BPM grid (Flipping In; 29.268 frames per beat), see marks 'grid ...'.  Setup (entering the room as 阿宁 in 失真,
// waiting for the cast, skipping the first-visit card) runs in real time and is not recorded.
import fs from 'node:fs';
import { launch, Session, PHONE, DESKTOP4K, PHONE1X, DESKTOP1X, OUT_FPS, sleep, killSinks, TEXT_GUARD, dupStats } from './maprig.mjs';

const ROOT = '/tmp/space-video-doodle/prod/capture/map-rc2';
const BASE = process.env.SPACE_BASE || 'http://127.0.0.1:48613/musicSpace/';
const DRY = process.env.DRY === '1';
const which = process.argv[2];
const PHONE_TAKE = which && which.startsWith('P');
const V = PHONE_TAKE ? (DRY ? PHONE1X : PHONE) : (DRY ? DESKTOP1X : DESKTOP4K);
const BPM = 123, FPB = 3600 / BPM;
const CLOCK = '2026-10-09T22:40:00+08:00';        // same Friday night as the host take and the P1/desktop takes
const CSS = 'input,textarea{caret-color:transparent!important}';
const IDS = { P1: 'MAP-P1-round', P2: 'MAP-P2-courtyard', D1: 'MAP-D1-round', D2: 'MAP-D2-courtyard', D3: 'MAP-D3-push' };
const id = IDS[which];
if (!id) { console.error('usage: node take-map.mjs P1|P2|D1|D2|D3'); process.exit(2); }
const OUTF = DRY ? { master: null, edit: null } : PHONE_TAKE ? { master: `${ROOT}/phone/${id}.mp4`, edit: null } : { master: `${ROOT}/desktop/master/${id}.mp4`, edit: `${ROOT}/desktop/1080/${id}.mp4` };
const STILLS = DRY ? `${ROOT}/dry/stills` : `${ROOT}/stills`;
const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${id}`, ...a);

let s, page;
const guards = [], warnings = [];
const warn = m => { warnings.push({ t: s?.t ?? null, msg: m }); log('WARN', m); };

// ------------------------------------------------------------------------------------------------ helpers
/** the brief: grep the DOM text that is about to be filmed for 示例 / 虚构 / 本页 */
async function guard(label) {
  const hits = await page.evaluate(TEXT_GUARD);
  guards.push({ label, t: s.sink ? s.t : null, hits });
  if (hits.length) { warn(`text guard ${label}: ${hits.join(' | ')}`); throw new Error('text guard failed: ' + label); }
  log('guard ok', label);
}
/** beat grid from the next frame to be written (+lead frames) */
function grid(name, lead = 4) {
  const zero = s.sink.frames + lead;
  const g = k => zero + Math.round(k * FPB);
  s.marks.push({ label: `grid ${name}`, frame: zero, t: +(zero / OUT_FPS).toFixed(3), type: 'grid', bpm: BPM, fpb: +FPB.toFixed(4) });
  return g;
}
async function untilFrame(f) { const n = f - s.sink.frames; if (n > 0) await s.frames(n); else if (n < 0) warn(`late by ${-n} frames`); }
/** box of the first visible element matching sel whose text contains `text` (CSS px) */
async function boxOf(sel, text = '') {
  return page.evaluate(([sel, text]) => {
    const vis = e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]');
    const e = [...document.querySelectorAll(sel)].find(e => vis(e) && (!text || (e.innerText || e.textContent || '').includes(text)));
    if (!e) return null;
    const r = e.getBoundingClientRect();
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2, hit: !!hit && (e === hit || e.contains(hit)), by: hit ? hit.tagName + '.' + String(hit.className).slice(0, 40) : 'none' };
  }, [sel, text]);
}
/** a touch: the ring appears on frame `at` (mouse down), the DOM click fires `press` frames later (mouse up) */
async function tap(sel, { text = '', at = null, press = 3, label = '', navigates = false } = {}) {
  label = label || `tap ${sel}${text ? ' ' + text : ''}`;
  if (at != null) await untilFrame(at);
  const b = await boxOf(sel, text);
  if (!b) throw new Error('tap: not visible: ' + label);
  if (!b.hit) throw new Error(`tap: ${label}: covered by ${b.by}`);
  if (b.cy < 4 || b.cy > s.H - 4 || b.cx < 4 || b.cx > s.W - 4) throw new Error(`tap: off-screen ${label}`);
  await page.mouse.move(b.cx, b.cy);
  const down = s.sink.frames;
  await page.mouse.down(); await s.frames(press);
  const ev = { type: 'tap', label, frame: down, t: +(down / OUT_FPS).toFixed(3), clickFrame: s.sink.frames, x: Math.round(b.cx * s.dpr), y: Math.round(b.cy * s.dpr), box: [b.x, b.y, b.w, b.h].map(v => Math.round(v * s.dpr)), ...(at != null ? { onBeat: at === down } : {}) };
  s.events.push(ev); log('tap', label, `f${down}`);
  await page.mouse.up();
  if (!navigates) await s.park();
  return ev;
}
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
/** recorded eased scroll of the scroller that holds `inner` (axis x or y) so that `inner` lands at `align` (start | center | end) with `pad`
 *  CSS px; quantised to whole CSS px, every captured frame moves (the head/tail frames that would not move are skipped) */
async function scrollToEl(inner, { axis = 'x', align = 'start', pad = 12, seconds = 0.6, label = '', text = '' } = {}) {
  const info = await page.evaluate(([inner, axis, align, pad, text]) => {
    const el = [...document.querySelectorAll(inner)].find(e => e.getClientRects().length && (!text || (e.innerText || '').includes(text)));
    if (!el) return null;
    let sc = el.parentElement;
    const can = e => axis === 'x' ? e.scrollWidth > e.clientWidth + 4 && /(auto|scroll)/.test(getComputedStyle(e).overflowX) : e.scrollHeight > e.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(e).overflowY);
    while (sc && !can(sc)) sc = sc.parentElement;
    if (!sc) return { none: true };
    window.__scrollEl = sc;
    const er = el.getBoundingClientRect(), sr = sc.getBoundingClientRect();
    const cur = axis === 'x' ? sc.scrollLeft : sc.scrollTop;
    const max = axis === 'x' ? sc.scrollWidth - sc.clientWidth : sc.scrollHeight - sc.clientHeight;
    const off = axis === 'x' ? er.left - sr.left : er.top - sr.top;
    const size = axis === 'x' ? sr.width - er.width : sr.height - er.height;
    let to = cur + off - (align === 'start' ? pad : align === 'center' ? size / 2 : size - pad);
    to = Math.max(0, Math.min(max, to));
    // scroll snapping (the hand is scroll-snap x mandatory on phones, proximity on desktops): ask the browser where the wanted position
    // snaps to (instant scroll, read, restore: no frame is drawn in between), then animate there with snapping off, like a finger drag
    // that lets go on a snap point; snapping is restored when the scroll ends
    const snap = getComputedStyle(sc).scrollSnapType;
    if (snap && snap !== 'none') {
      const set = v => sc.scrollTo(axis === 'x' ? { left: v, behavior: 'instant' } : { top: v, behavior: 'instant' });
      set(to); const snapped = axis === 'x' ? sc.scrollLeft : sc.scrollTop; set(cur);
      to = snapped; sc.style.scrollSnapType = 'none'; window.__snapRestore = sc;
    } else window.__snapRestore = null;
    return { from: cur, to, snap, scroller: sc.tagName + '.' + String(sc.className).slice(0, 50) };
  }, [inner, axis, align, pad, text]);
  if (!info) throw new Error('scrollToEl: missing ' + inner);
  if (info.none) { warn('scrollToEl: no scroller for ' + inner); return null; }
  const e0 = { type: 'scroll', label: label || `scroll ${axis} -> ${inner}`, frame: s.sink.frames, t: s.t, from: Math.round(info.from), to: Math.round(info.to), axis, scroller: info.scroller };
  if (Math.abs(info.to - info.from) < 2) { await page.evaluate(() => { if (window.__snapRestore) window.__snapRestore.style.scrollSnapType = ''; }); e0.noop = true; s.events.push(e0); return e0; }
  const n = Math.max(1, Math.round(seconds * OUT_FPS)); let last = info.from;
  for (let i = 1; i <= n; i++) {
    let v = info.from + (info.to - info.from) * ease(i / n);
    const next = info.from + (info.to - info.from) * ease(Math.min(1, (i + 1) / n));
    if (i > n / 2 && Math.abs(next - v) < 1) v = info.to;
    v = Math.round(v);
    if (Math.abs(v - last) < 0.5 && i <= n / 2) continue;
    await page.evaluate(([v, axis]) => window.__scrollEl.scrollTo(axis === 'x' ? { left: v, behavior: 'instant' } : { top: v, behavior: 'instant' }), [v, axis]);
    await s.frames(1); last = v;
    if (v === Math.round(info.to)) break;
  }
  const after = await page.evaluate(([axis]) => { const sc = window.__scrollEl; const v0 = axis === 'x' ? sc.scrollLeft : sc.scrollTop; if (window.__snapRestore) { window.__snapRestore.style.scrollSnapType = ''; } const v1 = axis === 'x' ? sc.scrollLeft : sc.scrollTop; return [v0, v1]; }, [axis]);
  if (Math.abs(after[1] - after[0]) > 0.5) warn(`scroll snapped after restore: ${after[0]} -> ${after[1]}`);
  e0.snap = info.snap || 'none'; e0.frames = s.sink.frames - e0.frame; s.events.push(e0);
  return e0;
}
/** step + capture until pred is true (real-time polling between frames) */
async function waitFor(label, pred, { max = 600, arg } = {}) {
  const f0 = s.sink.frames; const r = await s.until(pred, { max, arg });
  if (r < 0) throw new Error(`waitFor timeout: ${label} (${s.sink.frames - f0} frames)`);
  s.events.push({ type: 'state', label, frame: s.sink.frames, t: s.t, waited: s.sink.frames - f0 });
  log('state', label, `f${s.sink.frames}`, `(+${s.sink.frames - f0})`);
}
async function still(name) { if (DRY) return; const f = await s.still(`${STILLS}/${name}.png`); s.marks.push({ label: `still ${name}`, frame: s.sink.frames - 1, t: +((s.sink.frames - 1) / OUT_FPS).toFixed(3), file: f }); }
const toast = () => page.evaluate(() => { const t = document.querySelector('#toast'); return t && t.classList.contains('visible') ? t.textContent : ''; });
const cardSel = title => `.map-round-hand__cards > li.map-round-card`;
async function cardBox(title) { return page.evaluate(t => { const li = [...document.querySelectorAll('.map-round-hand__cards > li.map-round-card')].find(li => (li.querySelector('.map-round-card__title')?.textContent || '').includes(t)); if (!li) return null; const r = li.getBoundingClientRect(); return { slot: li.dataset.slot, open: li.classList.contains('is-open'), x: r.x, w: r.width }; }, title); }
/** tap a button inside the hand card whose title contains `title` */
async function tapCard(title, action, opts = {}) {
  const slot = (await cardBox(title))?.slot;
  if (slot == null) throw new Error('no card ' + title);
  return tap(`.map-round-hand__cards > li.map-round-card[data-slot="${slot}"] [data-map-action="${action}"]`, { label: `${action} 《${title}》`, ...opts });
}
/** per-frame state for the manifest (cheap) */
const PROBE = () => {
  const q = s => document.querySelector(s);
  const t = (e, n = 40) => e ? (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, n) : '';
  const dlg = [...document.querySelectorAll('dialog.map-dialog[open]')].map(d => d.className.replace('map-dialog', '').trim()).join(',');
  return [location.pathname.includes('music-map') ? (document.body.dataset.view || '?') : 'room', document.body.dataset.spatialShot || '', document.body.hasAttribute('data-spatial-travelling') ? 1 : 0, t(q('.map-round-slip__status'), 30), t(q('.map-round-hand__who h2'), 8), dlg, t(q('#toast.visible'), 30)];
};

// ------------------------------------------------------------------------------------------------ setup (real time, not recorded)
async function enterRoomAsAning() {
  await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  await sleep(2000);
  await page.locator('#join').click();
  await page.waitForSelector('form[data-form="demo-entry"] button[type=submit]', { timeout: 60000 });
  await sleep(600);
  await page.locator('form[data-form="demo-entry"] button', { hasText: '现在换个造型' }).first().click();
  await page.waitForSelector('.wardrobe', { timeout: 30000 }); await sleep(900);
  const nick = page.locator('.wardrobe input[aria-label="昵称"]'); await nick.fill('阿宁'); await sleep(200);
  const sum = page.locator('.wardrobe summary', { hasText: '试试现成搭配' }).first(); await sum.scrollIntoViewIfNeeded(); await sum.click(); await sleep(400);
  const pre = page.locator('.wardrobe [data-preset="4"]'); await pre.scrollIntoViewIfNeeded(); await pre.click(); await sleep(500);
  await page.locator('[data-wardrobe-save]').first().click();
  await page.waitForFunction(() => /小人已保存/.test(document.querySelector('#toast')?.textContent || ''), null, { timeout: 30000 });
  await sleep(1200);
  if (await page.evaluate(() => document.querySelector('#panel').hidden)) await page.locator('#join').click();
  await page.waitForSelector('form[data-form="demo-entry"] input[name=consent]', { timeout: 30000 }); await sleep(500);
  await page.locator('form[data-form="demo-entry"] input[name=consent]').check({ force: true }); await sleep(250);
  await page.locator('form[data-form="demo-entry"] button[type=submit]').click();
  await page.waitForFunction(() => document.querySelector('#panel')?.hidden && /回声现场/.test(document.body.innerText), null, { timeout: 60000 });
  // the cast: 林间 arrives ~8 s after the visitor
  await page.waitForFunction(() => [...document.querySelectorAll('#hotspots .hotspot[data-kind=person]')].some(e => /林间/.test(e.innerText)), null, { timeout: 12000 }).catch(() => log('林间 not in the room after 12 s (she arrives later in rc2): room filmed with 阿遥, 小满, 北屿, 阿宁'));
  await sleep(1200);
  const skip = page.locator('[data-tour-skip]:visible');
  if (await skip.count()) { await skip.first().click(); await sleep(900); log('tour skipped'); } else warn('no 跳过路线 button');
  await page.mouse.move(2, 2);
  await sleep(1500);
  log('room ready', JSON.stringify(await page.evaluate(() => ({ title: document.querySelector('#room-title')?.textContent, people: [...document.querySelectorAll('#hotspots .hotspot[data-kind=person]')].map(e => e.innerText.replace(/\s+/g, ' ')) }))));
}

// ------------------------------------------------------------------------------------------------ the round (P1, D1)
async function takeRound() {
  s = await Session.open(browser, { url: BASE, ...V, cursor: 'touch', name: id, css: CSS, clockStart: CLOCK });
  page = s.page;
  await enterRoomAsAning();
  await guard('room before recording');
  await s.freeze();
  await s.step(2);
  s.startRecording(OUTF.master, OUTF.edit);
  s.frameProbe = PROBE;
  // ---- the room: a beat and a half, then 「音乐探索」 in the header
  await s.mark('room (回声现场, 阿宁 in 失真, cast on stage)', { header: '.frame > header', mapEntry: '#music-map-entry', roomTitle: '#room-title' });
  {
    const g = grid('room', 0);
    await tap('#music-map-entry', { at: g(3), press: 9, label: 'tap 「音乐探索」 (beat 3)', navigates: true });
  }
  await s.mark('cut: the page navigates to music-map/#/explore (no frames recorded while it loads)');
  const ms = await s.afterNavigation('music-map');
  log('map loaded in', ms, 'ms (real time, not recorded)');
  await s.setWarp(1.05);   // map scene cadence: idle redraws every 2nd frame (30 fps), camera moves every frame
  const dw = await page.evaluate(() => ({ wrapped: !/native code/.test(String(Date.now)), failed: window.__dateWarpFailed || null }));
  if (!dw.wrapped) warn('Date.now not wrapped: ' + JSON.stringify(dw));
  await guard('map round (before the first map frame)');
  await s.mark('map first frame: 寻声 费玉清 → 邓紫棋 (the scene draws its ink in, the paper fades in)', { slip: '.map-round-slip', hand: '.map-round-hand', canvas: 'canvas.sakura-scene__canvas', from: '.map-round-slip .is-from', to: '.map-round-slip .is-to', tools: '.map-round-tools' });
  // ---- 翻开《千里之外》
  {
    const g = grid('flip 千里之外', Math.round(2.2 * OUT_FPS));
    await tapCard('千里之外', 'flip', { at: g(0) });
    await waitFor('card open × 周杰伦', () => !!document.querySelector('.map-round-card.is-open [data-map-action="move"][data-id="real-jay"]'));
    await s.mark('card 《千里之外》 × 周杰伦 open', { card: '.map-round-card.is-open', toast: '#toast', table: 'canvas.sakura-scene__canvas' });
    // ---- 来源
    await tapCard('千里之外', 'edge', { at: g(3), label: '来源 《千里之外》 (beat 3)' });
    await waitFor('来源 paper open', () => !!document.querySelector('dialog.map-dialog[open] details.map-sources[open]'));
    await guard('来源 paper');
    await s.hold(0.5);
    await s.mark('来源 paper (共同演唱 周杰伦 × 费玉清 · 千里之外 · 来源 open)', { dialog: 'dialog.map-dialog[open]', sources: 'dialog.map-dialog[open] details.map-sources', pair: 'dialog.map-dialog[open] h2' });
    await still(`${id}-sources`);
    await untilFrame(g(3) + Math.round(2.6 * OUT_FPS));
    const gc = grid('close 来源', 0);
    await tap('dialog.map-dialog[open] [data-map-action="close"]', { at: gc(0.5), label: 'close the paper (×)' });
    await waitFor('paper closed', () => !document.querySelector('dialog.map-dialog[open]'));
  }
  // ---- 前往 周杰伦
  {
    const g = grid('go 周杰伦', 8);
    await tapCard('千里之外', 'move', { at: g(1), label: '前往 周杰伦 (beat 1)' });
    await waitFor('hand: 周杰伦', () => /周杰伦/.test(document.querySelector('.map-round-hand__who h2')?.textContent || ''));
    await s.mark('step 1: 周杰伦 (10 首合唱)', { who: '.map-round-hand__who', slip: '.map-round-slip__status', toast: '#toast' });
    await s.hold(1.4);
    await guard('周杰伦 hand');
    await scrollToEl('.map-round-hand__cards > li.map-round-card', { text: '稻香', axis: 'x', align: PHONE_TAKE ? 'start' : 'center', seconds: 0.7, label: 'hand scroll -> 《稻香 / Stay With You》' });
    await s.hold(0.25);
    const g2 = grid('flip 稻香', 4);
    await tapCard('稻香', 'flip', { at: g2(0) });
    await waitFor('card open × 林俊杰', () => !!document.querySelector('.map-round-card.is-open [data-map-action="move"][data-id="real-jj"]'));
    await s.mark('card 《稻香 / Stay With You》 × 林俊杰 open', { card: '.map-round-card.is-open [data-id="real-jj"]' });
    await tapCard('稻香', 'move', { at: g2(3), label: '前往 林俊杰 (beat 3)' });
    await waitFor('hand: 林俊杰', () => /林俊杰/.test(document.querySelector('.map-round-hand__who h2')?.textContent || ''));
    await s.mark('step 2: 林俊杰', { who: '.map-round-hand__who', slip: '.map-round-slip__status' });
    await s.hold(1.3);
    await guard('林俊杰 hand');
    await scrollToEl('.map-round-hand__cards > li.map-round-card', { text: '手心的蔷薇', axis: 'x', align: PHONE_TAKE ? 'start' : 'center', seconds: 0.6, label: 'hand scroll -> 《手心的蔷薇》' });
    await s.hold(0.25);
    const g3 = grid('flip 手心的蔷薇', 4);
    await tapCard('手心的蔷薇', 'flip', { at: g3(0) });
    await waitFor('card open × 邓紫棋 (终点)', () => !!document.querySelector('.map-round-card.is-open [data-map-action="move"][data-id="real-gem"]'));
    await s.mark('card 《手心的蔷薇》 × 邓紫棋 终点 (toast 是邓紫棋！前往即抵达)', { card: '.map-round-card.is-open.is-target', toast: '#toast' });
    await tapCard('手心的蔷薇', 'move', { at: g3(3), label: '前往 邓紫棋 = 抵达 (beat 3)' });
  }
  // ---- 抵达 -> 连线歌单
  await waitFor('ceremony (寻声 · 已抵达)', () => /已抵达/.test(document.querySelector('.map-round-slip__eyebrow')?.textContent || '') || !!document.querySelector('dialog.map-dialog--setlist[open]'), { max: 300 });
  await s.mark('抵达 邓紫棋 · 3 步 (closing ceremony on the table)', { slip: '.map-round-slip', toast: '#toast', canvas: 'canvas.sakura-scene__canvas' });
  await waitFor('连线歌单 open', () => !!document.querySelector('dialog.map-dialog--setlist[open]'), { max: 900 });
  await guard('连线歌单');
  await s.mark('连线歌单: 费玉清 与 邓紫棋，隔着 3 首歌', { dialog: 'dialog.map-dialog--setlist[open]', title: 'dialog.map-dialog--setlist[open] h2' });
  {
    const g = grid('keep 千里之外', Math.round(2.0 * OUT_FPS));
    await tap('dialog.map-dialog--setlist[open] [data-map-action="save"]', { at: g(0), label: '「+ 留下」《千里之外》' });
    await waitFor('已留下', () => !!document.querySelector('dialog.map-dialog--setlist[open] [data-map-action="save"].is-saved'));
    await s.mark('《千里之外》 已留下 (a found song kept)', { save: 'dialog.map-dialog--setlist[open] [data-map-action="save"].is-saved', toast: '#toast' });
    await still(`${id}-kept`);
    await untilFrame(g(4));
  }
  await scrollToEl('dialog.map-dialog--setlist[open] .map-setlist__song', { text: '手心的蔷薇', axis: 'y', align: 'center', seconds: 1.0, label: 'setlist scroll -> 《手心的蔷薇》' }).catch(e => warn(String(e)));
  await guard('连线歌单 (scrolled)');
  await s.mark('the setlist: 千里之外 → 稻香 / Stay With You → 手心的蔷薇');
  await s.hold(2.2);
  await still(`${id}-setlist`);
  await s.mark('end');
}

// ------------------------------------------------------------------------------------------------ the courtyard (P2, D2) + the push (P3, D3)
const fileFor = recId => DRY ? { master: null, edit: null } : PHONE_TAKE ? { master: `${ROOT}/phone/${recId}.mp4`, edit: null } : { master: `${ROOT}/desktop/master/${recId}.mp4`, edit: `${ROOT}/desktop/1080/${recId}.mp4` };
let current = null;                    // { recId, files } of the open recording
const done = [];
function begin(recId) { const files = fileFor(recId); current = { recId, files }; s.startRecording(files.master, files.edit); s.frameProbe = PROBE; log('recording', recId); }
async function finish(extra = {}) {
  if (!current || !s?.sink) return null;
  const rep = await s.stopRecording({ take: 'TAKE-MAP', id: current.recId, build: '0.22.0-rc.2', base: BASE, viewport: { css: [V.width, V.height], dpr: V.dpr }, dry: DRY, ...extra });
  const out = writeLog(current.recId, current.files, rep, null);
  done.push(out); current = null; return out;
}
function writeLog(recId, files, rep, failedErr) {
  const out = {
    id: recId, take: 'TAKE-MAP', dry: DRY, failed: failedErr ? String(failedErr.stack || failedErr).slice(0, 900) : null, files, base: BASE, clock: CLOCK, bpm: BPM, fpb: +FPB.toFixed(4), fps: OUT_FPS,
    viewport: { css: [V.width, V.height], dpr: V.dpr, px: [Math.round(V.width * V.dpr), Math.round(V.height * V.dpr)] }, wall_seconds: Math.round((Date.now() - t0) / 1000),
    frames: rep?.frames ?? null, seconds: rep?.seconds ?? null, bytes: rep?.bytes ?? null, editBytes: rep?.editBytes ?? null, msPerFrame: rep?.msPerFrame ?? null, dup: rep?.dup ?? null,
    marks: rep?.marks ?? [], events: rep?.events ?? [], guards: guards.slice(), warnings: warnings.slice(), navs: s?.navs ?? [], errors: s?.errors ?? [], console: (s?.console ?? []).slice(0, 60),
    fontWaits: rep?.fontWaits ?? [], probe: rep?.probe ?? [], hashes: rep?.hashes ?? [], cams: rep?.cams ?? [],
  };
  fs.mkdirSync(`${ROOT}/logs`, { recursive: true });
  fs.writeFileSync(`${ROOT}/logs/${recId}${DRY ? '.dry' : ''}.take.json`, JSON.stringify(out, null, 1));
  log('written', recId, out.frames, 'frames', out.seconds, 's', JSON.stringify(out.dup), 'font waits', JSON.stringify(out.fontWaits));
  return out;
}
/** a product camera flight (GSAP) at `rate` x speed (Date.now warp); returns frames of travel */
async function flight(selector, text, label, rate) {
  const g = grid(label, 4);
  if (rate !== 1) { await s.setDateWarp(rate); s.marks.push({ label: `Date.now warp ${rate.toFixed(3)} on (GSAP: the product's camera flight and paper motion at ${rate.toFixed(3)} x speed; timers, rAF and the ink boil untouched)`, frame: s.sink.frames, t: s.t, type: 'warp', rate }); }
  await tap(selector, { text, at: g(0), label });
  await waitFor(`${label}: travelling`, () => document.body.hasAttribute('data-spatial-travelling'), { max: 60 });
  const f0 = s.sink.frames;
  await waitFor(`${label}: arrived`, () => !document.body.hasAttribute('data-spatial-travelling'), { max: 600 });
  const n = s.sink.frames - f0;
  await s.hold(0.3);                    // the arrival's last reframe settles on the same clock
  if (rate !== 1) { await s.setDateWarp(1); s.marks.push({ label: 'Date.now warp back to 1', frame: s.sink.frames, t: s.t, type: 'warp', rate: 1 }); }
  return n;
}
async function takeCourtyard() {
  // the map opened fresh on its courtyard, the clock paused from the start: the first recorded frame is the scene's first frame
  s = await Session.open(browser, { url: BASE + 'music-map/#/home', ...V, cursor: 'touch', name: id, css: CSS, clockStart: CLOCK, pausedFromStart: true });
  page = s.page;
  await page.evaluate(() => document.fonts.ready);
  await sleep(1500);
  await page.evaluate(() => document.fonts.ready);
  await s.setWarp(1.05);
  const dw = await page.evaluate(() => ({ setter: typeof window.__setDateWarp, failed: window.__dateWarpFailed || null }));
  if (dw.setter !== 'function' || dw.failed) warn('Date.now warp unavailable: ' + JSON.stringify(dw));
  await guard('courtyard');
  await s.park();
  // ---- A: the courtyard, the flight into the record shop and back (1/3 speed)
  const A = PHONE_TAKE ? 'MAP-P2-courtyard' : 'MAP-D2-courtyard';
  begin(A);
  await s.mark('first frame: 小院 (the courtyard draws its ink in, the title and the paper come in)', { title: '.home-hero', paper: '[data-home-paper]', canvas: 'canvas.sakura-scene__canvas', pin: '.world-pin' });
  await s.hold(1.2);
  await s.mark('courtyard settled: untouched hold (idle petals, spinning record, ink boil), usable for an edit push');
  await s.hold(7.0);
  await still(`${A}-courtyard`);
  await guard('courtyard (before the flight)');
  const nIn = await flight('.world-pin', '唱片店', 'tap the 「唱片店」 pin: the camera flies into the record shop (1/3 speed)', 1 / 3);
  await s.mark(`the record table (寻声 费玉清 → 邓紫棋); the flight in lasted ${nIn} frames at 1/3 speed (natural speed ~${Math.round(nIn / 3)} frames)`, { slip: '.map-round-slip', hand: '.map-round-hand' });
  await guard('table after the flight');
  await s.hold(1.6);
  const out = (await boxOf('.world-compass button[data-world-view="home"]')) ? '.world-compass button[data-world-view="home"]' : 'button.nav-item[data-nav="home"]';
  const nOut = await flight(out, '', `tap 「小院」 (${out}): the camera flies back out over the courtyard (1/3 speed)`, 1 / 3);
  await s.mark(`courtyard again (flight out ${nOut} frames at 1/3 speed)`);
  await s.hold(2.0);
  await guard('courtyard at the end of A');
  await s.mark('end');
  await finish();
  // ---- B: a slow push over the paper courtyard (screen push: CDP clip zoom, eased, the scene keeps living); desktop: see takeDesktopPush (D3)
  if (!PHONE_TAKE) return;
  const B = 'MAP-P3-push';
  await s.step(30);                     // the courtyard rests (not recorded)
  const pin = await boxOf('.world-pin', '唱片店');
  const canvasBox = await boxOf('canvas.sakura-scene__canvas');
  // aim: the diorama (the shop pin, a little below it on phones); zoom 1.35 desktop / 1.3 phone
  const aim = PHONE_TAKE ? { cx: pin.cx, cy: pin.cy + 20, z: 1.3 } : { cx: pin.cx + 10, cy: pin.cy + 10, z: 1.35 };
  begin(B);
  s.cam = { cx: s.W / 2, cy: s.H / 2, z: 1 };
  const cams = [];
  await s.mark(`push start (full frame); aim CSS (${Math.round(aim.cx)}, ${Math.round(aim.cy)}) zoom ${aim.z}`, { pin: '.world-pin', canvas: 'canvas.sakura-scene__canvas' });
  await s.hold(0.6);
  const N = Math.round(5.0 * OUT_FPS);
  const easeIO = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;   // gentle quad in-out
  const c0 = { cx: s.W / 2, cy: s.H / 2, z: 1 };
  await s.mark('push moving (5.0 s, quad in-out)');
  for (let i = 1; i <= N; i++) {
    const k = easeIO(i / N);
    s.cam = { cx: c0.cx + (aim.cx - c0.cx) * k, cy: c0.cy + (aim.cy - c0.cy) * k, z: c0.z + (aim.z - c0.z) * k };
    cams.push([s.sink.frames, +s.cam.cx.toFixed(2), +s.cam.cy.toFixed(2), +s.cam.z.toFixed(4)]);
    await s.frames(1);
  }
  await s.mark('push end (holding at the aim)');
  await s.hold(1.5);
  await guard('courtyard after the push');
  await s.mark('end');
  const clip = s.camClip();
  await finish({ cams, push: { aim, startClip: { x: 0, y: 0, w: s.W, h: s.H }, endClipCss: { x: +clip.x.toFixed(1), y: +clip.y.toFixed(1), w: +clip.width.toFixed(1), h: +clip.height.toFixed(1) }, canvasCss: canvasBox ? [canvasBox.x, canvasBox.y, canvasBox.w, canvasBox.h].map(v => Math.round(v)) : null } });
  s.cam = null;
}

// ------------------------------------------------------------------------------------------------ the desktop push (D3)
// The slow screen push over the courtyard, aimed at the record shop so that no UI is left at the frame's edges.  A slower product
// flight than 1/3 is not offered: GSAP keeps at least 4 ms of its own (Date.now) time between ticks, so below ~1/3.8 speed it would move
// the camera on every 2nd/3rd frame only (a 1/8 test showed exactly that judder and was dropped).
async function takeDesktopPush() {
  s = await Session.open(browser, { url: BASE + 'music-map/#/home', ...V, cursor: 'touch', name: id, css: CSS, clockStart: CLOCK, pausedFromStart: true });
  page = s.page;
  await page.evaluate(() => document.fonts.ready);
  await sleep(1500);
  await page.evaluate(() => document.fonts.ready);
  await s.setWarp(1.05);
  await s.park();
  await s.step(Math.round(4.0 * OUT_FPS));            // the intro (ink, title, paper) completes, not recorded
  await guard('courtyard');
  const B = 'MAP-D3-push';
  const pin = await boxOf('.world-pin', '唱片店');
  const aim = { cx: pin.cx + 63, cy: pin.cy - 20, z: 1.6 };      // CSS px: (885, 480) on 1440x810 -> visible 900x506 from x 435: title, paper, header and nav out
  begin(B);
  s.cam = { cx: s.W / 2, cy: s.H / 2, z: 1 };
  const cams = [];
  await s.mark(`push start (full frame); aim CSS (${Math.round(aim.cx)}, ${Math.round(aim.cy)}) zoom ${aim.z}`, { pin: '.world-pin', canvas: 'canvas.sakura-scene__canvas', paper: '[data-home-paper]', title: '.home-hero' });
  await s.hold(0.6);
  const N = Math.round(5.0 * OUT_FPS);
  const easeIO = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const c0 = { cx: s.W / 2, cy: s.H / 2, z: 1 };
  await s.mark('push moving (5.0 s, quad in-out)');
  for (let i = 1; i <= N; i++) {
    const k = easeIO(i / N);
    s.cam = { cx: c0.cx + (aim.cx - c0.cx) * k, cy: c0.cy + (aim.cy - c0.cy) * k, z: c0.z + (aim.z - c0.z) * k };
    cams.push([s.sink.frames, +s.cam.cx.toFixed(2), +s.cam.cy.toFixed(2), +s.cam.z.toFixed(4)]);
    await s.frames(1);
  }
  await s.mark('push end (holding at the aim)');
  await s.hold(1.5);
  await guard('courtyard after the push');
  await s.mark('end');
  const clip = s.camClip();
  await finish({ cams, push: { aim, endClipCss: { x: +clip.x.toFixed(1), y: +clip.y.toFixed(1), w: +clip.width.toFixed(1), h: +clip.height.toFixed(1) } } });
  s.cam = null;
}

// ------------------------------------------------------------------------------------------------ main
const browser = await launch();
const t0 = Date.now();
let failed = null;
process.on('SIGINT', () => { killSinks(); process.exit(130); });
try {
  if (which === 'P1' || which === 'D1') { await takeRound(); }
  else if (which === 'D3') await takeDesktopPush();
  else await takeCourtyard();
} catch (e) { failed = e; console.error('FAILED', e); try { await s.still(`${ROOT}/probe/${id}-fail.png`); } catch {} }
finally {
  try {
    if (which === 'P1' || which === 'D1') {
      const rep = s?.sink ? await s.stopRecording({ take: 'TAKE-MAP', id, build: '0.22.0-rc.2', base: BASE, viewport: { css: [V.width, V.height], dpr: V.dpr }, dry: DRY }) : null;
      writeLog(id, fileFor(id), rep, failed);
    } else if (current) {
      const rep = s?.sink ? await s.stopRecording({ failed: true }) : null;
      writeLog(current.recId, current.files, rep, failed);
    }
  } catch (e) { console.error('stopRecording failed', e); }
  log('done', failed ? 'FAILED' : 'ok', `${Math.round((Date.now() - t0) / 1000)}s wall`);
  await s?.ctx.close().catch(() => {});
  await browser.close();
  if (failed) process.exitCode = 1;
}
