// rig.mjs : frame-stepped recorder for the desktop takes (4K master + 1080 edit copy in one pass).
// rc2 copy (2026-10-08) of ../../desktop/tools/rig.mjs, two changes only:
//   - default clock 2026-10-08T22:40:00+08:00: the static runtime's clock never runs earlier than the build (createClock clamps to
//     buildAtMs; rc2 was built 2026-10-08 04:18 +08:00), so the old 2026-10-07 22:40 would print 04:19 on screen; SHOTS.md: "an
//     evening after the build time";
//   - optional text audit while recording (Session.audit = async () => ({hits}); run every auditEvery frames, hits kept in
//     Session.auditHits and written to rec.json), so every take is checked for old copy all the way through, not only before.
// Adapted from the proven capture rig /tmp/space-video-doodle/capture-test/rec2.mjs (read-only original; a verbatim copy sits next to
// this file as rec2-orig.mjs).  What is the same: Playwright fake clock, every captured frame advances virtual time by STEP_MS = 16 ms,
// CSS/WAAPI animations are pinned to the same virtual time, one CDP PNG screenshot per frame, seeded Math.random, rAF time-warp.
// What is new here:
//   - one ffmpeg process takes the lossless PNG frames once and writes TWO files: the 3840x2160 master and a 1920x1080 Lanczos
//     downscale made from the same lossless frames (no second-generation encode);
//   - the cosmetic pointer runs in 'touch' mode by default (no arrow; only the doodle tap ring on a press);
//   - mark() can store element boxes (master px) so the edit can aim punch-ins without guessing;
//   - per-frame camera probe for the 3D takes (smoothness check).
// Virtual time advances 16 ms per frame and the file is labelled 60 fps -> playback is 4 % slower than real time (62.5 -> 60), exactly
// like every other clip made with this rig; all times in the manifest are video times (frame / 60).
import { chromium } from '/tmp/space-video-prep/tools/node_modules/playwright-core/index.mjs';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export const FFMPEG = '/opt/homebrew/bin/ffmpeg';
export const STEP_MS = 16;
export const OUT_FPS = 60;
export const sleep = ms => new Promise(r => setTimeout(r, ms));

export const DESKTOP4K = { width: 1440, height: 810, dpr: 8 / 3, mobile: false };   // 1440x810 CSS @2.667 = 3840x2160 device px
export const DESKTOP1X = { width: 1440, height: 810, dpr: 1, mobile: false };       // probes only

export async function launch({ headless = true, extra = [] } = {}) {
  return chromium.launch({
    executablePath: CHROME, headless,
    args: ['--lang=zh-CN', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--hide-scrollbars', '--mute-audio',
      '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--force-color-profile=srgb', ...extra],
  });
}

/** Cosmetic pointer (recording annotation only; follows real mouse events, never changes app behaviour).  'touch' = no arrow, only the
 *  doodle tap ring (yellow ring, ink outline, pink offset) on each press. */
const CURSOR_INIT = (mode) => {
  const boot = () => {
    if (document.getElementById('__rec_cursor')) return;
    const c = document.createElement('div'); c.id = '__rec_cursor';
    c.innerHTML = '<svg width="30" height="36" viewBox="0 0 30 36" xmlns="http://www.w3.org/2000/svg"><path d="M6 5 L6 29 L12.2 23.4 L16.6 33.6 L21 31.8 L16.7 21.9 L25.4 21.9 Z" fill="#ff5c8a"/><path d="M3 2 L3 26 L9.2 20.4 L13.6 30.6 L18 28.8 L13.7 18.9 L22.4 18.9 Z" fill="#1c1b1a" stroke="#fffaf0" stroke-width="2.2" stroke-linejoin="round"/></svg>';
    Object.assign(c.style, { position: 'fixed', left: '0', top: '0', zIndex: '2147483647', pointerEvents: 'none', transform: 'translate(-200px,-200px)' });
    if (mode === 'touch') c.style.display = 'none';
    document.documentElement.appendChild(c);
    addEventListener('mousemove', e => { c.style.transform = `translate(${e.clientX}px,${e.clientY}px)`; }, true);
    addEventListener('mousedown', e => {
      c.firstChild.style.transform = 'scale(.9)'; c.firstChild.style.transformOrigin = '3px 2px';
      const r = document.createElement('div'); r.className = '__rec_ring';
      Object.assign(r.style, { position: 'fixed', left: e.clientX - 27 + 'px', top: e.clientY - 27 + 'px', width: '54px', height: '54px', borderRadius: '50%', border: '4px solid #ffd447', boxShadow: '0 0 0 2.5px #1c1b1a, inset 0 0 0 2.5px #1c1b1a, 4px 4px 0 2.5px #ff5c8a', background: 'rgba(255,212,71,.22)', pointerEvents: 'none', zIndex: '2147483646' });
      document.documentElement.appendChild(r);
      const a = r.animate([{ transform: 'scale(.3)', opacity: 1 }, { transform: 'scale(1.15)', opacity: 0 }], { duration: 480, easing: 'cubic-bezier(.2,.7,.3,1)' });
      a.onfinish = () => r.remove();
    }, true);
    addEventListener('mouseup', () => { c.firstChild.style.transform = ''; }, true);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
};

/** Seeded Math.random (mulberry32) so autopilot timings / random picks repeat exactly between takes. */
const SEED_INIT = seed => { let a = seed >>> 0; Math.random = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

/** rAF time-warp: the timestamps the page's rAF callbacks see advance at window.__warp x virtual time (1 = untouched).
 *  Installed AFTER page.clock.install() so it wraps the fake rAF.  Timers (the 7 Hz line boil, the cast's reply delays) are not warped. */
const WARP_INIT = () => {
  const raf = window.requestAnimationFrame.bind(window);
  let last = null, warped = 0; window.__warp = 1;
  window.requestAnimationFrame = cb => raf(t => { if (last === null) { last = t; warped = t; } if (t !== last) { warped += (t - last) * window.__warp; last = t; } cb(warped); });
};

export const SINKS = new Set();
export function killSinks() { for (const k of SINKS) { try { k.p.kill('SIGKILL'); } catch {} } SINKS.clear(); }

const X264 = (crf, preset) => ['-c:v', 'libx264', '-preset', preset, '-tune', 'animation', '-crf', String(crf), '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', String(OUT_FPS),
  '-x264-params', 'colorprim=bt709:transfer=bt709:colormatrix=bt709:fullrange=off', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
  '-movflags', '+faststart'];
const CONV = (w, h) => `scale=${w}:${h}:flags=lanczos+accurate_rnd+full_chroma_int:out_range=tv:out_color_matrix=bt709,format=yuv420p`;

/** ffmpeg sink: lossless PNG frames on stdin -> master (native size) + edit copy (1920x1080 Lanczos), H.264 High, CRF 15, yuv420p,
 *  BT.709 limited range, 60 fps CFR. */
class DualSink {
  constructor(master, edit, { w, h, ew = 1920, eh = 1080, crf = 15, preset = 'slow' } = {}) {
    for (const f of [master, edit]) if (f) fs.mkdirSync(path.dirname(f), { recursive: true });
    this.file = master; this.edit = edit; this.frames = 0; this.hashes = []; SINKS.add(this);
    const fc = edit ? `[0:v]split=2[a][b];[a]${CONV(w, h)}[m];[b]${CONV(ew, eh)}[d]` : `[0:v]${CONV(w, h)}[m]`;
    const args = ['-y', '-v', 'error', '-f', 'image2pipe', '-c:v', 'png', '-framerate', String(OUT_FPS), '-i', '-', '-filter_complex', fc,
      '-map', '[m]', ...X264(crf, preset), master];
    if (edit) args.push('-map', '[d]', ...X264(crf, preset), edit);
    this.p = spawn(FFMPEG, args, { stdio: ['pipe', 'inherit', 'inherit'] });
    this.done = new Promise((res, rej) => { this.p.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg exit ' + c))); });
  }
  async write(buf) {
    this.frames++; this.hashes.push(crypto.createHash('md5').update(buf).digest('hex').slice(0, 12));
    if (!this.p.stdin.write(buf)) await new Promise(r => this.p.stdin.once('drain', r));
  }
  async end() {
    this.p.stdin.end(); await this.done; SINKS.delete(this);
    return { file: this.file, edit: this.edit, frames: this.frames, seconds: +(this.frames / OUT_FPS).toFixed(3), bytes: fs.statSync(this.file).size, editBytes: this.edit ? fs.statSync(this.edit).size : 0 };
  }
}

/** duplicate statistics of a hash list: unique count, runs of identical consecutive frames */
export function dupStats(hashes) {
  let dups = 0, run = 1, longest = 1, runs = [];
  for (let i = 1; i < hashes.length; i++) {
    if (hashes[i] === hashes[i - 1]) { dups++; run++; } else { if (run > 1) runs.push([i - run, run]); run = 1; }
    longest = Math.max(longest, run);
  }
  if (run > 1) runs.push([hashes.length - run, run]);
  return { frames: hashes.length, unique: new Set(hashes).size, consecutiveDuplicates: dups, longestStill: longest, stillRunsOver9f: runs.filter(r => r[1] > 9).map(([s, n]) => `${(s / OUT_FPS).toFixed(2)}s+${n}f`) };
}

export class Session {
  static async open(browser, { url, width, height, dpr, mobile = false, cursor = 'touch', name = 'page', css = '', seed = 20261009, warp = true, clockStart = process.env.CLOCK_START || '2026-10-08T22:40:00+08:00' } = {}) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile, locale: 'zh-CN', timezoneId: 'Asia/Shanghai', reducedMotion: 'no-preference', colorScheme: 'light', acceptDownloads: true });
    if (seed !== null) await ctx.addInitScript(SEED_INIT, seed);
    if (cursor) await ctx.addInitScript(CURSOR_INIT, cursor === 'touch' ? 'touch' : 'arrow');
    if (css) await ctx.addInitScript(c => { const add = () => { const st = document.createElement('style'); st.id = '__rec_css'; st.textContent = c; (document.head || document.documentElement).appendChild(st); }; if (document.head) add(); else document.addEventListener('DOMContentLoaded', add); }, css);
    const page = await ctx.newPage();
    const s = new Session(ctx, page, name); s.W = width; s.H = height; s.dpr = dpr; s.clockStart = clockStart; s.seed = seed;
    page.on('pageerror', e => { s.errors.push(String(e).slice(0, 300)); console.log(`[${name} pageerror]`, String(e).slice(0, 200)); });
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') s.console.push(`${m.type()}: ${m.text().slice(0, 200)}`); });
    await page.clock.install(clockStart ? { time: new Date(clockStart) } : {});   // fake clock follows real time until freeze()
    if (warp) await page.addInitScript(WARP_INIT);           // after the clock: wraps the fake rAF
    s.cdp = await ctx.newCDPSession(page);
    if (url) await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    return s;
  }
  constructor(ctx, page, name) {
    Object.assign(this, { ctx, page, name, frozen: false, sink: null, mouse: { x: -200, y: -200 }, events: [], frame: 0, cdp: null, errors: [], console: [], timing: { step: 0, grab: 0, write: 0, n: 0 }, marks: [], probeLog: [], frameProbe: null, audit: null, auditEvery: 12, auditHits: [], auditRuns: 0 });
  }
  async freeze() {
    if (this.frozen) return;
    const now = await this.page.evaluate(() => Date.now());
    await this.page.clock.pauseAt(now + 50);
    await this.page.evaluate(() => { window.__anims = new Map(); window.__done = new WeakSet(); window.__vnow = 0; });
    this.frozen = true;
  }
  async unfreeze() {
    if (!this.frozen) return;
    await this.page.evaluate(() => { for (const a of document.getAnimations()) { try { if (a.playState === 'paused') a.play(); } catch (e) {} } window.__anims = new Map(); window.__done = new WeakSet(); });
    await this.page.clock.resume(); this.frozen = false;
  }
  async setWarp(w) { await this.page.evaluate(v => { window.__warp = v; }, w); }
  /** advance virtual time one step and sync CSS/WAAPI animations (no capture) */
  async step(n = 1) {
    for (let i = 0; i < n; i++) {
      await this.page.clock.runFor(STEP_MS);
      await this.page.evaluate(dt => {
        window.__vnow += dt; const m = window.__anims;
        for (const a of document.getAnimations()) {
          if (window.__done.has(a)) continue;
          if (!m.has(a)) { m.set(a, window.__vnow - dt); a.pause(); }
          try {
            const t = Math.max(0, window.__vnow - m.get(a));
            const end = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming().endTime : Infinity;
            if (Number.isFinite(end) && t >= end) { a.currentTime = end; if (a.playState !== 'finished') a.finish(); m.delete(a); window.__done.add(a); }
            else a.currentTime = t;
          } catch (e) { /* ignore */ }
        }
      }, STEP_MS);
    }
  }
  async grab(format = 'png') {
    const opts = { format, captureBeyondViewport: false, fromSurface: true, optimizeForSpeed: true, clip: { x: 0, y: 0, width: this.W, height: this.H, scale: this.dpr } };
    const r = await this.cdp.send('Page.captureScreenshot', opts);
    return Buffer.from(r.data, 'base64');
  }
  startRecording(master, edit, opts = {}) {
    const w = Math.round(this.W * this.dpr), h = Math.round(this.H * this.dpr);
    this.sink = new DualSink(master, edit, { w, h, ...opts }); this.t0 = Date.now(); this.timing = { step: 0, grab: 0, write: 0, n: 0 };
    this.marks = []; this.probeLog = []; this.events = []; this.auditHits = []; this.auditRuns = 0; return this.sink;
  }
  get t() { return this.sink ? +(this.sink.frames / OUT_FPS).toFixed(3) : 0; }
  /** time stamp (the next frame to be written) + optional element boxes in master px */
  async mark(label, boxes = null, extra = {}) {
    if (!this.sink) return;
    const m = { label, frame: this.sink.frames, t: +(this.sink.frames / OUT_FPS).toFixed(3), ...extra };
    if (boxes) m.boxes = await this.boxes(boxes);
    this.marks.push(m); console.log(`  mark ${label} @ f${m.frame} ${m.t}s`);
    return m;
  }
  /** union boxes of selectors, in master px (x, y, w, h), rounded; null when the element is missing */
  async boxes(map) {
    const k = this.dpr;
    const r = await this.page.evaluate(m => {
      const o = {};
      for (const [name, sels] of Object.entries(m)) {
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (const sel of [].concat(sels)) {
          let el = null;
          if (sel.startsWith('text=')) { const want = sel.slice(5); const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { if (n.textContent.includes(want) && n.parentElement && n.parentElement.getClientRects().length) { const rg = document.createRange(); const i = n.textContent.indexOf(want); rg.setStart(n, i); rg.setEnd(n, i + want.length); const b = rg.getBoundingClientRect(); if (b.width) { x0 = Math.min(x0, b.left); y0 = Math.min(y0, b.top); x1 = Math.max(x1, b.right); y1 = Math.max(y1, b.bottom); el = 1; break; } } } continue; }
          el = document.querySelector(sel); if (!el) continue; const b = el.getBoundingClientRect(); if (!b.width) continue;
          x0 = Math.min(x0, b.left); y0 = Math.min(y0, b.top); x1 = Math.max(x1, b.right); y1 = Math.max(y1, b.bottom);
        }
        o[name] = x1 < x0 ? null : [x0, y0, x1 - x0, y1 - y0];
      }
      return o;
    }, map);
    for (const n of Object.keys(r)) if (r[n]) r[n] = r[n].map(v => Math.round(v * k));
    return r;
  }
  async stopRecording(extra = {}) {
    const sink = this.sink; const wall = (Date.now() - this.t0) / 1000;
    const r = await sink.end(); this.sink = null;
    const d = dupStats(sink.hashes); const n = this.timing.n || 1;
    const report = { ...r, wallSeconds: +wall.toFixed(1), wallPerVideoSecond: +(wall / r.seconds).toFixed(2), msPerFrame: { step: +(this.timing.step / n).toFixed(1), grab: +(this.timing.grab / n).toFixed(1), write: +(this.timing.write / n).toFixed(1) }, dup: d, marks: this.marks, events: this.events.map(e => ({ ...e, t: +e.t.toFixed(3) })), clockStart: this.clockStart, seed: this.seed, textAudit: this.audit ? { every: this.auditEvery, runs: this.auditRuns, hits: this.auditHits } : null, auditBefore: this.auditBefore || null, ...extra };
    fs.writeFileSync(r.file.replace(/\.mp4$/, '') + '.rec.json', JSON.stringify({ ...report, hashes: sink.hashes, probe: this.probeLog }, null, 1));
    return report;
  }
  async _oneFrame() {
    const t0 = performance.now(); await this.step(1); const t1 = performance.now();
    if (this.sink) {
      if (this.frameProbe) this.probeLog.push(await this.page.evaluate(this.frameProbe).catch(e => 'ERR ' + e.message));
      if (this.audit && this.sink.frames % this.auditEvery === 0) { const a = await this.audit().catch(e => ({ hits: ['ERR ' + e.message] })); this.auditRuns++; if (a.hits.length) { this.auditHits.push({ frame: this.sink.frames, hits: a.hits }); console.log(`  [${this.name}] TEXT AUDIT HIT f${this.sink.frames}`, JSON.stringify(a.hits)); } }
      const buf = await this.grab(); const t2 = performance.now(); await this.sink.write(buf); const t3 = performance.now(); this.timing.step += t1 - t0; this.timing.grab += t2 - t1; this.timing.write += t3 - t2; this.timing.n++;
    }
    this.frame++;
  }
  async frames(n = 1) { for (let i = 0; i < n; i++) await this._oneFrame(); }
  async hold(seconds) { await this.frames(Math.round(seconds * OUT_FPS)); }
  async still(file) { fs.mkdirSync(path.dirname(file), { recursive: true }); const b = await this.cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true, clip: { x: 0, y: 0, width: this.W, height: this.H, scale: this.dpr } }); fs.writeFileSync(file, Buffer.from(b.data, 'base64')); return file; }

  // --- pointer helpers (frame-accurate) ---
  async moveTo(x, y, seconds = 0) {
    const n = Math.round(seconds * OUT_FPS);
    if (n <= 0) { await this.page.mouse.move(x, y); this.mouse = { x, y }; return; }
    const { x: x0, y: y0 } = this.mouse; const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    for (let i = 1; i <= n; i++) { const t = ease(i / n); const px = x0 + (x - x0) * t, py = y0 + (y - y0) * t; await this.page.mouse.move(px, py); this.mouse = { x: px, y: py }; await this.frames(1); }
  }
  /** park the (invisible) pointer where it hovers nothing that reacts */
  async park(x = 6, y = 404) { await this.page.mouse.move(x, y); this.mouse = { x, y }; }
  /** wait (stepping + capturing virtual time) until the locator is visible; Playwright auto-wait would hang on the frozen clock */
  async ready(locator, maxFrames = 420) {
    const l = (typeof locator === 'string' ? this.page.locator(locator) : locator).first();
    for (let i = 0; i <= maxFrames; i++) {
      if ((await l.count()) && await l.isVisible().catch(() => false)) return;
      if (this.frozen) await this.frames(1); else await sleep(40);
    }
    throw new Error('element not visible after ' + maxFrames + ' stepped frames: ' + String(locator));
  }
  async centerOf(locator) {
    await this.ready(locator);
    const box = await locator.first().boundingBox();
    if (!box) throw new Error('no bounding box for ' + locator);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }
  /** pointer to the target (teleport by default: no visible travel), press 3 frames, release (real DOM click at mouseup), then park */
  async click(locator, { move = 0, pre = 0.08, post = 0.2, dx = 0, dy = 0, label = null, scroll = true, park = true } = {}) {
    const loc = typeof locator === 'string' ? this.page.locator(locator) : locator;
    if (scroll) await loc.first().evaluate(el => el.scrollIntoView({ block: 'nearest' })).catch(() => {});
    const { x, y } = await this.centerOf(loc);
    await this.moveTo(x + dx, y + dy, move);
    await this.hold(pre);
    const ev = { t: (this.sink ? this.sink.frames : 0) / OUT_FPS, frame: this.sink ? this.sink.frames : 0, type: 'tap', x: Math.round((x + dx) * this.dpr), y: Math.round((y + dy) * this.dpr), label };
    this.events.push(ev);
    await this.page.mouse.down(); await this.frames(3); await this.page.mouse.up();
    if (park) await this.park();
    await this.hold(post);
    return ev;
  }
  /** poll a predicate in real time while stepping (and capturing) virtual time; `show` = seconds recorded before the rest of the wait is
   *  stepped without capture (a jump cut in the take; avoided here: the edit cuts waits itself) */
  async until(pred, { max = 240, arg, show = Infinity } = {}) {
    const showFrames = Number.isFinite(show) ? Math.round(show * OUT_FPS) : Infinity;
    for (let i = 0; i < max; i++) {
      if (await this.page.evaluate(pred, arg)) return i;
      await sleep(5);
      if (i < showFrames) await this.frames(1); else { await this.step(1); this.skipped = (this.skipped || 0) + 1; }
    }
    return -1;
  }
  async close() { if (this.sink) await this.stopRecording(); await this.ctx.close(); }
}
