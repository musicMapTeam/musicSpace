// rec2.mjs : deterministic frame-stepped recorder for the Doodle build (adapted from /tmp/space-video-prep/capture/rec.mjs).
//
// The page runs on Playwright's fake clock (Date, performance.now, setTimeout/setInterval, requestAnimationFrame).  Every captured frame
// advances virtual time by exactly STEP_MS = 16 ms (Playwright's fake rAF fires on 16 ms boundaries), then CSS animations / transitions /
// Web Animations are set to the same virtual time through document.getAnimations(), the GPU renders, and one CDP screenshot is piped into
// ffmpeg.  Consequences:
//   - one unique render per output frame, perfectly even cadence, independent of machine load;
//   - the doodle line boil (three-scene.js: setTimeout(boil, 1000/7)) runs on the fake clock -> deterministic, ~8.9 frames per boil step;
//   - output is labelled 60 fps while virtual time advances 16 ms/frame => playback is 4 % slower than real time (62.5 -> 60).
// Harness-only extras (no repo change): seeded Math.random (identical retakes), optional rAF time-warp (slow motion of the product's own
// camera moves), cosmetic tap ring / arrow cursor in the Doodle palette.
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

export const PHONE = { width: 390, height: 845, dpr: 36 / 13, mobile: true };      // 390x845 CSS @2.769 = 1080x2340 device px
export const DESKTOP = { width: 1440, height: 810, dpr: 4 / 3, mobile: false };     // 1440x810 CSS @1.333 = 1920x1080 device px

export async function launch({ headless = true, extra = [] } = {}) {
  return chromium.launch({
    executablePath: CHROME, headless,
    args: ['--lang=zh-CN', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--hide-scrollbars', '--mute-audio',
      '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--force-color-profile=srgb', ...extra],
  });
}

/** Cosmetic pointer (recording annotation only; follows real mouse events, never changes app behaviour).  Doodle palette: ink + pink. */
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
      const r = document.createElement('div');
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
 *  Must be installed AFTER page.clock.install() so it wraps the fake rAF.  Timers (the 7 Hz line boil, NPC delays) are not warped. */
const WARP_INIT = () => {
  const raf = window.requestAnimationFrame.bind(window);
  let last = null, warped = 0; window.__warp = 1;
  window.requestAnimationFrame = cb => raf(t => { if (last === null) { last = t; warped = t; } if (t !== last) { warped += (t - last) * window.__warp; last = t; } cb(warped); });
};

export const SINKS = new Set();
export function killSinks() { for (const k of SINKS) { try { k.p.kill('SIGKILL'); } catch {} } SINKS.clear(); }
/** ffmpeg sink: PNG (or JPEG) frames on stdin -> H.264 High, CRF 15, yuv420p, BT.709 limited range, 60 fps CFR. */
class FrameSink {
  constructor(file, { w, h, fps = OUT_FPS, crf = 15, preset = 'slow', srcFormat = 'png', tune = 'animation' } = {}) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    this.file = file; this.frames = 0; this.hashes = []; SINKS.add(this);
    const inMatrix = srcFormat === 'mjpeg' ? ':in_range=pc:in_color_matrix=bt601' : '';
    const vf = `scale=${w}:${h}:flags=lanczos+accurate_rnd+full_chroma_int${inMatrix}:out_range=tv:out_color_matrix=bt709,format=yuv420p`;
    this.p = spawn(FFMPEG, ['-y', '-v', 'error', '-f', 'image2pipe', '-c:v', srcFormat, '-framerate', String(fps), '-i', '-',
      '-vf', vf, '-c:v', 'libx264', '-preset', preset, ...(tune ? ['-tune', tune] : []), '-crf', String(crf), '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', String(fps),
      '-x264-params', 'colorprim=bt709:transfer=bt709:colormatrix=bt709:fullrange=off', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
      '-movflags', '+faststart', file], { stdio: ['pipe', 'inherit', 'inherit'] });
    this.done = new Promise((res, rej) => { this.p.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg exit ' + c))); });
  }
  async write(buf) {
    this.frames++; this.hashes.push(crypto.createHash('md5').update(buf).digest('hex').slice(0, 12));
    if (!this.p.stdin.write(buf)) await new Promise(r => this.p.stdin.once('drain', r));
  }
  async end() { this.p.stdin.end(); await this.done; SINKS.delete(this); return { file: this.file, frames: this.frames, seconds: +(this.frames / OUT_FPS).toFixed(3), bytes: fs.statSync(this.file).size }; }
}

/** duplicate statistics of a hash list: unique count, runs of identical consecutive frames */
export function dupStats(hashes) {
  let dups = 0, run = 1, longest = 1, runs = [];
  for (let i = 1; i < hashes.length; i++) {
    if (hashes[i] === hashes[i - 1]) { dups++; run++; } else { if (run > 1) runs.push([i - run, run]); run = 1; }
    longest = Math.max(longest, run);
  }
  if (run > 1) runs.push([hashes.length - run, run]);
  return { frames: hashes.length, unique: new Set(hashes).size, consecutiveDuplicates: dups, longestStill: longest, stillRuns: runs.filter(r => r[1] >= 6).map(([s, n]) => `${(s / OUT_FPS).toFixed(2)}s+${n}f`) };
}

export class Session {
  // clockStart: the fake clock starts at this wall time (then follows real time until freeze()), so on-screen times are the same in every take
  static async open(browser, { url, width, height, dpr, mobile = false, cursor = 'arrow', name = 'page', css = '', seed = 20261009, warp = true, clockStart = process.env.CLOCK_START || '2026-10-09T22:30:00+08:00' } = {}) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile, locale: 'zh-CN', timezoneId: 'Asia/Shanghai', reducedMotion: 'no-preference', colorScheme: 'light' });
    if (seed !== null) await ctx.addInitScript(SEED_INIT, seed);
    if (cursor) await ctx.addInitScript(CURSOR_INIT, cursor === 'touch' ? 'touch' : 'arrow');
    if (css) await ctx.addInitScript(c => { const add = () => { const st = document.createElement('style'); st.id = '__rec_css'; st.textContent = c; (document.head || document.documentElement).appendChild(st); }; if (document.head) add(); else document.addEventListener('DOMContentLoaded', add); }, css);
    const page = await ctx.newPage();
    const s = new Session(ctx, page, name); s.W = width; s.H = height; s.dpr = dpr;
    page.on('pageerror', e => { s.errors.push(String(e).slice(0, 300)); console.log(`[${name} pageerror]`, String(e).slice(0, 200)); });
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') s.console.push(`${m.type()}: ${m.text().slice(0, 200)}`); });
    await page.clock.install(clockStart ? { time: new Date(clockStart) } : {});   // fake clock follows real time until freeze()
    if (warp) await page.addInitScript(WARP_INIT);           // after the clock: wraps the fake rAF
    s.cdp = await ctx.newCDPSession(page);
    if (url) await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    return s;
  }
  constructor(ctx, page, name) {
    Object.assign(this, { ctx, page, name, frozen: false, sink: null, mouse: { x: -200, y: -200 }, events: [], frame: 0, cdp: null, director: false, cam: null, camT: null, camK: 6, camRelease: -1, trackSel: null, trackOpts: null, errors: [], console: [], timing: { step: 0, grab: 0, write: 0, n: 0 }, grabFormat: 'png', jpegQuality: 95 });
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
  // ---- camera director (CDP clip.scale re-rasterises the region: crisp UI zoom; WebGL canvas is a bitmap, so it softens) ----
  directorOn({ k = 6 } = {}) { this.director = true; this.camK = k; this.cam = { cx: this.W / 2, cy: this.H / 2, z: 1 }; this.camT = { ...this.cam }; }
  focus({ x, y, z = 1.3, k }) { if (!this.director) return; if (k) this.camK = k; this.camT = { cx: x, cy: y, z }; this.camRelease = -1; }
  async focusOn(locator, { pad = 1.2, zmin = 1.1, zmax = 1.8, k, dy = 0 } = {}) {
    if (!this.director) return;
    const loc = typeof locator === 'string' ? this.page.locator(locator) : locator; const b = await loc.first().boundingBox(); if (!b) return;
    const z = Math.max(zmin, Math.min(zmax, Math.min(this.W / (b.width * pad), this.H / (b.height * pad))));
    this.focus({ x: b.x + b.width / 2, y: b.y + b.height / 2 + dy, z, k });
  }
  unfocus({ k } = {}) { if (!this.director) return; if (k) this.camK = k; this.camT = { cx: this.W / 2, cy: this.H / 2, z: 1 }; this.camRelease = -1; this.trackSel = null; }
  cut() { if (this.director && this.camT) this.cam = { ...this.camT }; }
  _camStep() {
    if (!this.director) return;
    if (this.camRelease >= 0 && this.frame >= this.camRelease) this.unfocus();
    const a = 1 - Math.exp(-this.camK / OUT_FPS), c = this.cam, t = this.camT;
    c.cx += (t.cx - c.cx) * a; c.cy += (t.cy - c.cy) * a; c.z += (t.z - c.z) * a;
    if (Math.abs(t.z - c.z) < 1e-4) c.z = t.z;
  }
  async grab(format = this.grabFormat) {
    const opts = { format, captureBeyondViewport: false, fromSurface: true };
    if (format === 'jpeg') opts.quality = this.jpegQuality;
    if (format === 'png') opts.optimizeForSpeed = true;
    // CDP returns CSS-px images unless the clip carries the scale (Playwright emulates the DPR): always pass it.
    if (this.director && this.cam && this.cam.z > 1.0001) {
      const z = this.cam.z, w = this.W / z, h = this.H / z;
      const x = Math.min(this.W - w, Math.max(0, this.cam.cx - w / 2)), y = Math.min(this.H - h, Math.max(0, this.cam.cy - h / 2));
      opts.clip = { x, y, width: w, height: h, scale: this.dpr * z };
    } else opts.clip = { x: 0, y: 0, width: this.W, height: this.H, scale: this.dpr };
    const r = await this.cdp.send('Page.captureScreenshot', opts);
    return Buffer.from(r.data, 'base64');
  }
  startRecording(file, opts = {}) {
    const w = opts.w ?? Math.round(this.W * this.dpr), h = opts.h ?? Math.round(this.H * this.dpr);
    this.sink = new FrameSink(file, { w, h, srcFormat: this.grabFormat === 'jpeg' ? 'mjpeg' : 'png', ...opts }); this.recStart = this.frame; this.t0 = Date.now(); this.timing = { step: 0, grab: 0, write: 0, n: 0 };
    this.marks = []; this.probeLog = []; return this.sink;
  }
  mark(label) { if (this.sink) this.marks.push({ label, frame: this.sink.frames, t: +(this.sink.frames / OUT_FPS).toFixed(3) }); }
  async stopRecording() {
    const sink = this.sink; const wall = (Date.now() - this.t0) / 1000;
    const r = await sink.end(); this.sink = null;
    const d = dupStats(sink.hashes); const n = this.timing.n || 1;
    const report = { ...r, wallSeconds: +wall.toFixed(1), wallPerVideoSecond: +(wall / r.seconds).toFixed(2), msPerFrame: { step: +(this.timing.step / n).toFixed(1), grab: +(this.timing.grab / n).toFixed(1), write: +(this.timing.write / n).toFixed(1) }, dup: d, marks: this.marks, events: this.events.map(e => ({ ...e, t: +e.t.toFixed(3) })) };
    fs.writeFileSync(r.file.replace(/\.mp4$/, '') + '.rec.json', JSON.stringify({ ...report, hashes: sink.hashes, probe: this.probeLog }, null, 1));
    this.events = []; return report;
  }
  async _oneFrame() {
    const t0 = performance.now(); await this.step(1); const t1 = performance.now();
    if (this.trackSel && this.frame % this.trackOpts.every === 0) await this._retarget();
    this._camStep();
    if (this.sink) {
      if (this.frameProbe) this.probeLog.push(await this.page.evaluate(this.frameProbe).catch(e => 'ERR ' + e.message));
      const buf = await this.grab(); const t2 = performance.now(); await this.sink.write(buf); const t3 = performance.now(); this.timing.step += t1 - t0; this.timing.grab += t2 - t1; this.timing.write += t3 - t2; this.timing.n++;
    }
    this.frame++;
  }
  async frames(n = 1) { for (let i = 0; i < n; i++) await this._oneFrame(); }
  async hold(seconds) { await this.frames(Math.round(seconds * OUT_FPS)); }
  async still(file, format = 'png') { fs.mkdirSync(path.dirname(file), { recursive: true }); const b = await this.cdp.send('Page.captureScreenshot', { format, captureBeyondViewport: false, clip: { x: 0, y: 0, width: this.W, height: this.H, scale: this.dpr } }); fs.writeFileSync(file, Buffer.from(b.data, 'base64')); return file; }
  track(selector, { pad = 1.1, zmin = 1.0, zmax = 1.7, every = 4, dy = 0, k } = {}) { if (!this.director) return; if (k) this.camK = k; this.trackSel = selector; this.trackOpts = { pad, zmin, zmax, every, dy }; this.camRelease = -1; return this._retarget(); }
  /** re-aim at the union box of the tracked selector(s) (layout can still shift: images arriving, panels growing) */
  async _retarget() {
    // CSS selectors, measured in one evaluate: no Playwright auto-wait (a missing element would stall ~30 s per call on the frozen page)
    const o = this.trackOpts;
    const box = await this.page.evaluate(sels => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const sel of sels) { const e = document.querySelector(sel); if (!e) continue; const b = e.getBoundingClientRect(); if (!b.width) continue; x0 = Math.min(x0, b.left); y0 = Math.min(y0, b.top); x1 = Math.max(x1, b.right); y1 = Math.max(y1, b.bottom); } return x1 < x0 ? null : { x0, y0, x1, y1 }; }, [].concat(this.trackSel)).catch(() => null);
    if (!box) return; const { x0, y0, x1, y1 } = box;
    const w = x1 - x0, h = y1 - y0, z = Math.max(o.zmin, Math.min(o.zmax, Math.min(this.W / (w * o.pad), this.H / (h * o.pad))));
    this.camT = { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 + o.dy, z };
  }

  // --- pointer helpers (frame-accurate, eased) ---
  async moveTo(x, y, seconds = 0.6) {
    const n = Math.max(1, Math.round(seconds * OUT_FPS)); const { x: x0, y: y0 } = this.mouse;
    const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const dx = x - x0, dy = y - y0, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len, bow = Math.min(60, len * 0.08);
    for (let i = 1; i <= n; i++) {
      const t = ease(i / n), arc = Math.sin(Math.PI * t) * bow;
      const px = x0 + dx * t + nx * arc, py = y0 + dy * t + ny * arc;
      await this.page.mouse.move(px, py); this.mouse = { x: px, y: py };
      await this.frames(1);
    }
  }
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
  /** move pointer to the target, press, release (real DOM click at mouseup).  Phones: `move` is the finger travel time (ring only). */
  async click(locator, { move = 0.5, pre = 0.1, post = 0.3, dx = 0, dy = 0 } = {}) {
    const loc = typeof locator === 'string' ? this.page.locator(locator) : locator;
    await loc.first().evaluate(el => el.scrollIntoView({ block: 'nearest' })).catch(() => {});
    const { x, y } = await this.centerOf(loc);
    await this.moveTo(x + dx, y + dy, move);
    await this.hold(pre);
    this.events.push({ t: (this.sink ? this.sink.frames : 0) / OUT_FPS, type: 'click', x, y });
    await this.page.mouse.down(); await this.frames(3); await this.page.mouse.up();
    await this.hold(post);
  }
  /** poll a predicate in real time while stepping (and capturing) virtual time; `show` = seconds recorded before the rest of the wait is skipped (jump cut) */
  async until(pred, { max = 240, arg, show = Infinity } = {}) {
    const showFrames = Number.isFinite(show) ? Math.round(show * OUT_FPS) : Infinity;
    for (let i = 0; i < max; i++) {
      if (await this.page.evaluate(pred, arg)) return true;
      await sleep(10);
      if (i < showFrames) await this.frames(1); else { await this.step(1); this.skipped = (this.skipped || 0) + 1; }
    }
    return false;
  }
  async close() { if (this.sink) await this.stopRecording(); await this.ctx.close(); }
}
