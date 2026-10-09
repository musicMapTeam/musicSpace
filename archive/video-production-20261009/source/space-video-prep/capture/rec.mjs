// rec.mjs : deterministic, frame-stepped recording kit for the real WebGL app (Playwright-core + system Google Chrome, real Apple GPU).
//
// Why frame-stepped?  Real-time capture on this Mac (CDP screencast ~15 fps with multi-second gaps, screenshot polling ~30 unique fps with
// irregular cadence, Playwright recordVideo = 25 fps VP8) cannot give smooth 1080p60.  Here the page runs on a *virtual clock*:
//   - Playwright fake clock controls Date / performance.now / setTimeout / setInterval / requestAnimationFrame
//   - CSS transitions/animations + Web-Animations (e.g. the cursor ripple) are driven one step at a time through document.getAnimations()
//   - every step advances virtual time by exactly 16 ms (= one rAF), the GPU renders the frame, we screenshot it
// Result: one unique frame per step, perfectly even cadence, independent of machine speed.  Frames are streamed into ffmpeg
// (lanczos downscale 3840x2160 -> 1920x1080, x264 CRF 12 mezzanine, labelled 60 fps => playback is 4 % slower than virtual time; timeline math uses frames/60).
import { chromium } from '/tmp/space-video-prep/tools/node_modules/playwright-core/index.mjs';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const STEP_MS = 16;            // one rAF per step (Playwright fake-clock rAF granularity)
export const OUT_FPS = 60;            // mezzanine label; assemble at 60 or decimate to 30
export const CSS_W = 1440, CSS_H = 744, DPR = 3840 / 1440;   // 1440x744 CSS px @2.667 -> 3840x1984 -> /2 = 1920x992 (UI appears 1.33x larger = legible); the remaining 88 px of the 1080p canvas is the caption band
export const OUT_W = 1920, OUT_H = 992;
export const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function launch({ headless = true } = {}) {
  return chromium.launch({
    channel: 'chrome', headless,
    args: ['--lang=zh-CN', '--ignore-gpu-blocklist', '--use-angle=metal', '--enable-gpu-rasterization', '--hide-scrollbars', '--mute-audio',
      '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--force-color-profile=srgb'],
  });
}

/** Cosmetic cursor + click ripple (recording annotation only; follows real mouse events, never changes app behaviour). */
const CURSOR_INIT = (mode) => {
  const boot = () => {
    if (document.getElementById('__rec_cursor')) return;
    const c = document.createElement('div'); c.id = '__rec_cursor';
    c.innerHTML = '<svg width="28" height="34" viewBox="0 0 28 34" xmlns="http://www.w3.org/2000/svg"><path d="M3 2 L3 26 L9.2 20.4 L13.6 30.6 L18 28.8 L13.7 18.9 L22.4 18.9 Z" fill="#203b32" stroke="#f0e9d8" stroke-width="2.2" stroke-linejoin="round"/></svg>';
    Object.assign(c.style, { position: 'fixed', left: '0', top: '0', zIndex: '2147483647', pointerEvents: 'none', transform: 'translate(-200px,-200px)', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.35))' });
    if (mode === 'touch') c.style.display = 'none';           // phones: no arrow, only the tap ring
    document.documentElement.appendChild(c);
    addEventListener('mousemove', e => { c.style.transform = `translate(${e.clientX}px,${e.clientY}px)`; }, true);
    addEventListener('mousedown', e => {
      c.firstChild.style.transform = 'scale(.9)'; c.firstChild.style.transformOrigin = '3px 2px';
      const r = document.createElement('div');
      Object.assign(r.style, { position: 'fixed', left: e.clientX - 26 + 'px', top: e.clientY - 26 + 'px', width: '52px', height: '52px', borderRadius: '50%', border: '3px solid #dbe873', boxShadow: '0 0 0 2px rgba(32,59,50,.55)', pointerEvents: 'none', zIndex: '2147483646' });
      document.documentElement.appendChild(r);
      const a = r.animate([{ transform: 'scale(.25)', opacity: 1 }, { transform: 'scale(1.25)', opacity: 0 }], { duration: 520, easing: 'cubic-bezier(.2,.7,.3,1)' });
      a.onfinish = () => r.remove();
    }, true);
    addEventListener('mouseup', () => { c.firstChild.style.transform = ''; }, true);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
};

export const SINKS = new Set();
export function killSinks() { for (const k of SINKS) { try { k.p.kill('SIGKILL'); } catch {} } SINKS.clear(); }
class FrameSink {
  constructor(file, { w = OUT_W, h = OUT_H, fps = OUT_FPS, crf = 12, preset = 'veryfast', srcFormat = 'mjpeg' } = {}) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    this.file = file; this.frames = 0; SINKS.add(this);
    this.p = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-c:v', srcFormat, '-framerate', String(fps), '-i', '-',
      '-vf', `scale=${w}:${h}:flags=lanczos+accurate_rnd+full_chroma_int:in_range=pc:in_color_matrix=bt601:out_range=tv:out_color_matrix=bt709,format=yuv420p`,
      '-c:v', 'libx264', '-preset', preset, '-crf', String(crf), '-r', String(fps), '-x264-params', 'colorprim=bt709:transfer=bt709:colormatrix=bt709:fullrange=off', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
      '-movflags', '+faststart', file], { stdio: ['pipe', 'inherit', 'inherit'] });
    this.done = new Promise((res, rej) => { this.p.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg exit ' + c))); });
  }
  async write(buf) {
    this.frames++;
    if (!this.p.stdin.write(buf)) await new Promise(r => this.p.stdin.once('drain', r));
  }
  async end() { this.p.stdin.end(); await this.done; SINKS.delete(this); return { file: this.file, frames: this.frames, seconds: this.frames / OUT_FPS, bytes: fs.statSync(this.file).size }; }
}

export class Session {
  /** Open a page whose clock can be frozen/stepped.  `query`/`url` navigates unfrozen (real time) so the app can boot normally. */
  static async open(browser, { url, width = CSS_W, height = CSS_H, dpr = DPR, storageState, cursor = 'arrow', name = 'page', css = '' } = {}) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, locale: 'zh-CN', timezoneId: 'Asia/Shanghai', reducedMotion: 'no-preference', storageState });
    if (cursor) await ctx.addInitScript(CURSOR_INIT, cursor === 'touch' ? 'touch' : 'arrow');
    if (process.env.SPACE_WORKAROUNDS === '1') {      // rehearsal only: see workarounds.css (RC4 radio-card layout defect)
      const css = fs.readFileSync(new URL('./workarounds.css', import.meta.url), 'utf8');
      await ctx.addInitScript(c => { const add = () => { const st = document.createElement('style'); st.textContent = c; document.head.appendChild(st); }; if (document.head) add(); else document.addEventListener('DOMContentLoaded', add); }, css);
    }
    if (css) {                                         // recording-only stylesheet (e.g. capture/cinematic.css: full-bleed 3D canvas for establishing shots)
      await ctx.addInitScript(c => { const add = () => { const st = document.createElement('style'); st.id = '__rec_css'; st.textContent = c; (document.head || document.documentElement).appendChild(st); }; if (document.head) add(); else document.addEventListener('DOMContentLoaded', add); }, css);
    }
    const page = await ctx.newPage();
    page.on('pageerror', e => console.log(`[${name} pageerror]`, String(e).slice(0, 200)));
    await page.clock.install();            // fake clock follows real time until freeze()
    const s = new Session(ctx, page, name); s.W = width; s.H = height; s.dpr = dpr;
    if (url) await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    return s;
  }
  constructor(ctx, page, name) { this.ctx = ctx; this.page = page; this.name = name; this.frozen = false; this.sink = null; this.mouse = { x: -200, y: -200 }; this.events = []; this.frame = 0; this.W = CSS_W; this.H = CSS_H; this.dpr = DPR; this.cdp = null; this.director = false; this.cam = null; this.camT = null; this.camK = 6; this.auto = null; this.camRelease = -1; this.trackSel = null; this.trackOpts = null; }

  async freeze() {
    if (this.frozen) return;
    const now = await this.page.evaluate(() => Date.now());
    await this.page.clock.pauseAt(now + 50);
    await this.page.evaluate(() => { window.__anims = new Map(); window.__done = new WeakSet(); window.__vnow = 0; });
    this.frozen = true;
  }
  async unfreeze() {
    if (!this.frozen) return;
    // animations we paused for stepping must run again, otherwise transitions/animations never finish in real time
    await this.page.evaluate(() => { for (const a of document.getAnimations()) { try { if (a.playState === 'paused') a.play(); } catch (e) {} } window.__anims = new Map(); window.__done = new WeakSet(); });
    await this.page.clock.resume(); this.frozen = false;
  }

  /** advance virtual time one step and sync CSS/WAAPI animations (no capture) */
  async step(n = 1) {
    for (let i = 0; i < n; i++) {
      await this.page.clock.runFor(STEP_MS);
      await this.page.evaluate(dt => {
        window.__vnow += dt; const m = window.__anims;
        for (const a of document.getAnimations()) {
          if (window.__done.has(a)) continue;                      // finished (e.g. fill:forwards) animations stay finished - never re-adopt
          if (!m.has(a)) { m.set(a, window.__vnow - dt); a.pause(); }
          try {
            const t = Math.max(0, window.__vnow - m.get(a));
            const end = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming().endTime : Infinity;
            if (Number.isFinite(end) && t >= end) { a.currentTime = end; if (a.playState !== 'finished') a.finish(); m.delete(a); window.__done.add(a); }   // let 'finish' fire so transient overlays (ripple) get removed
            else a.currentTime = t;
          } catch (e) { /* ignore */ }
        }
      }, STEP_MS);
    }
  }
  // ---- camera director: Screen-Studio-style smooth zoom/pan.  Chrome re-rasterises the clipped region (CDP clip.scale), so zoomed text/UI stays crisp; output stays W*dpr x H*dpr. ----
  async directorOn({ k = 6, auto = null } = {}) {
    if (!this.cdp) this.cdp = await this.ctx.newCDPSession(this.page);
    this.director = true; this.camK = k; this.auto = auto;       // auto = { z: 1.4, hold: 1.1 } => every click() eases in on its target and out again
    this.cam = { cx: this.W / 2, cy: this.H / 2, z: 1 }; this.camT = { ...this.cam };
  }
  /** aim the camera at a CSS-px point with zoom z (1 = full page).  k = smoothing rate (higher = snappier; ~6 = 0.17 s time constant) */
  focus({ x, y, z = 1.4, k }) { if (!this.director) return; if (k) this.camK = k; this.camT = { cx: x, cy: y, z }; this.camRelease = -1; }
  /** aim at an element so that it fills ~1/pad of the frame (zoom clamped to [zmin,zmax]) */
  async focusOn(locator, { pad = 1.25, zmin = 1.15, zmax = 1.9, k, dy = 0 } = {}) {
    if (!this.director) return;
    const loc = typeof locator === 'string' ? this.page.locator(locator) : locator; const b = await loc.first().boundingBox(); if (!b) return;
    const z = Math.max(zmin, Math.min(zmax, Math.min(this.W / (b.width * pad), this.H / (b.height * pad))));
    this.focus({ x: b.x + b.width / 2, y: b.y + b.height / 2 + dy, z, k });
  }
  unfocus({ k } = {}) { if (!this.director) return; if (k) this.camK = k; this.camT = { cx: this.W / 2, cy: this.H / 2, z: 1 }; this.camRelease = -1; this.trackSel = null; }
  /** keep the camera framed on an element even while it grows / shrinks / slides (panels change height as content loads): re-aims every few frames until unfocus() */
  track(selector, { pad = 1.1, zmin = 1.15, zmax = 1.75, every = 6, dy = 0 } = {}) { if (!this.director) return; this.trackSel = selector; this.trackOpts = { pad, zmin, zmax, every, dy }; this.camRelease = -1; }
  async _retarget() {
    const o = this.trackOpts; const b = await this.page.locator(this.trackSel).first().boundingBox().catch(() => null); if (!b || !b.width) return;
    const z = Math.max(o.zmin, Math.min(o.zmax, Math.min(this.W / (b.width * o.pad), this.H / (b.height * o.pad))));
    this.camT = { cx: b.x + b.width / 2, cy: b.y + b.height / 2 + o.dy, z };
  }
  cut() { if (this.director && this.camT) this.cam = { ...this.camT }; }           // jump (no easing) to the target
  _camStep() {
    if (!this.director) return;
    if (this.camRelease >= 0 && this.frame >= this.camRelease) this.unfocus();
    const a = 1 - Math.exp(-this.camK / OUT_FPS), c = this.cam, t = this.camT;
    c.cx += (t.cx - c.cx) * a; c.cy += (t.cy - c.cy) * a; c.z += (t.z - c.z) * a;
    if (Math.abs(t.z - c.z) < 1e-4) c.z = t.z;
  }
  async grab(format = 'jpeg') {
    if (this.director && this.cdp) {
      const z = Math.max(1, this.cam.z), w = this.W / z, h = this.H / z;
      const x = Math.min(this.W - w, Math.max(0, this.cam.cx - w / 2)), y = Math.min(this.H - h, Math.max(0, this.cam.cy - h / 2));
      const r = await this.cdp.send('Page.captureScreenshot', { format, quality: format === 'jpeg' ? 96 : undefined, clip: { x, y, width: w, height: h, scale: this.dpr * z } });
      return Buffer.from(r.data, 'base64');
    }
    return this.page.screenshot({ type: format, quality: format === 'jpeg' ? 96 : undefined, animations: 'allow', caret: 'initial', timeout: 30000 });
  }
  startRecording(file, opts) { this.sink = new FrameSink(file, opts); this.recStart = this.frame; return this.sink; }
  async stopRecording() { const f = this.sink.file; const r = await this.sink.end(); this.sink = null; try { fs.writeFileSync(f.replace(/\.mp4$/, '') + '.events.json', JSON.stringify(this.events.map(e => ({ ...e, t: +e.t.toFixed(3) })))); } catch {} this.events = []; return r; }   // click/tap times (s, in recorded-clip time) for optional auto-foley
  async _oneFrame() { await this.step(1); if (this.trackSel && this.frame % this.trackOpts.every === 0) await this._retarget(); this._camStep(); if (this.sink) await this.sink.write(await this.grab()); this.frame++; }
  /** step + capture n frames (and the peer session in lockstep, if linked) */
  async frames(n = 1) {
    for (let i = 0; i < n; i++) {
      if (this.peer) await Promise.all([this._oneFrame(), this.peer._oneFrame()]); else await this._oneFrame();
    }
  }
  async hold(seconds) { await this.frames(Math.round(seconds * OUT_FPS)); }
  async still(file) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, await this.grab('png')); return file; }

  // --- pointer helpers (frame-accurate, eased) ---
  async moveTo(x, y, seconds = 0.6) {
    const n = Math.max(1, Math.round(seconds * OUT_FPS)); const { x: x0, y: y0 } = this.mouse;
    const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    // slight arc so it feels human
    const dx = x - x0, dy = y - y0, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len, bow = Math.min(60, len * 0.08);
    for (let i = 1; i <= n; i++) {
      const t = ease(i / n), arc = Math.sin(Math.PI * t) * bow;
      const px = x0 + dx * t + nx * arc, py = y0 + dy * t + ny * arc;
      await this.page.mouse.move(px, py); this.mouse = { x: px, y: py };
      await this.frames(1);
    }
  }
  /** wait until the element exists and is visible, STEPPING (and capturing) virtual time while waiting: the frozen page can only make progress when we advance it.
   *  (Playwright's own auto-wait polls with in-page timers, which are frozen, so it would hang instead of failing.) */
  async ready(locator, maxFrames = 420) {
    const l = locator.first();
    for (let i = 0; i <= maxFrames; i++) {
      if ((await l.count()) && await l.isVisible().catch(() => false)) return;
      await sleep(8);
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
  /** move cursor to target, press, release; real DOM click happens at mouseup */
  async click(locator, { move = 0.6, pre = 0.12, post = 0.35, dx = 0, dy = 0 } = {}) {
    const loc = typeof locator === 'string' ? this.page.locator(locator) : locator;
    if (process.env.SHOT_DEBUG) console.log(`[${this.name} f${this.frame}] click ${typeof locator === 'string' ? locator : String(locator)}`);
    await loc.first().scrollIntoViewIfNeeded().catch(() => {});
    const { x, y } = await this.centerOf(loc);
    if (this.director && this.auto) this.focus({ x: x + dx, y: y + dy, z: this.auto.z });          // ease in on the target while the cursor travels there
    await this.moveTo(x + dx, y + dy, move);
    await this.hold(pre);
    this.events.push({ t: this.frame / OUT_FPS, type: 'click', x, y });
    await this.page.mouse.down(); await this.frames(3); await this.page.mouse.up();
    await this.hold(post);
    if (this.director && this.auto) this.camRelease = this.frame + Math.round((this.auto.hold ?? 1.0) * OUT_FPS);   // ease back out unless the next click re-targets first
  }
  /** inject / remove a recording-only stylesheet at run time (e.g. cinematic.css after the setup flow), then nudge the 3D engine with a resize event */
  async addCss(css, id = '__rec_css_rt') {
    await this.page.evaluate(([c, i]) => { let st = document.getElementById(i); if (!st) { st = document.createElement('style'); st.id = i; document.head.appendChild(st); } st.textContent = c; window.dispatchEvent(new Event('resize')); }, [css, id]);
  }
  async removeCss(id = '__rec_css_rt') { await this.page.evaluate(i => { document.getElementById(i)?.remove(); window.dispatchEvent(new Event('resize')); }, id); }
  /** smooth digital push-in/pull-out (sub-pixel, GPU compositor, driven frame-exactly by the stepper) on an element, e.g. '.world-shell'.  Replaces any earlier push on it. */
  async push(selector, from, to, seconds, { origin = '50% 50%', ease = 'cubic-bezier(.35,.0,.25,1)' } = {}) {
    await this.page.evaluate(([sel, a, b, ms, org, easing]) => {
      const el = document.querySelector(sel); if (!el) return;
      el.getAnimations().filter(x => x.id === '__push').forEach(x => x.cancel());
      el.style.transformOrigin = org; el.style.willChange = 'transform';
      const an = el.animate([{ transform: `scale(${a})` }, { transform: `scale(${b})` }], { duration: ms, easing, fill: 'forwards' }); an.id = '__push';
    }, [selector, from, to, seconds * 1000, origin, ease]);
  }
  async hideCursor() { await this.page.evaluate(() => { const c = document.getElementById('__rec_cursor'); if (c) c.style.visibility = 'hidden'; }); }
  async showCursor() { await this.page.evaluate(() => { const c = document.getElementById('__rec_cursor'); if (c) c.style.visibility = ''; }); }
  /** programmatic click without moving the cursor overlay (cinematic establishing shots / camera tours) */
  async tap(locator) { const loc = typeof locator === 'string' ? this.page.locator(locator) : locator; await loc.first().evaluate(el => el.click()); this.events.push({ t: this.frame / OUT_FPS, type: 'tap' }); }
  /** type text char by char (keyboard events), `cps` characters per second */
  async type(locator, text, { cps = 9, clickFirst = true } = {}) {
    const loc = typeof locator === 'string' ? this.page.locator(locator) : locator;
    if (clickFirst) await this.click(loc, { post: 0.15 });
    const per = Math.max(1, Math.round(OUT_FPS / cps));
    for (const ch of text) { await this.page.keyboard.insertText(ch); await this.frames(per); }
  }
  /** let the real network settle while paused: poll a predicate in real time, stepping (and capturing) until it holds */
  async until(pred, { max = 240, arg, show = Infinity } = {}) {
    if (process.env.SHOT_DEBUG) console.log(`[${this.name} f${this.frame}] until ${String(pred).slice(0, 90)}`);
    // `show` (seconds): record only the first `show` seconds of the wait, then keep advancing the virtual clock WITHOUT capturing (a jump cut: real waiting - an automatic reply, a download - is cut, never faked).
    const showFrames = Number.isFinite(show) ? Math.round(show * OUT_FPS) : Infinity;
    for (let i = 0; i < max; i++) {
      if (await this.page.evaluate(pred, arg)) return true;
      await sleep(15);
      if (i < showFrames) await this.frames(1); else { await this.step(1); this.skipped = (this.skipped || 0) + 1; }
    }
    if (process.env.SHOT_DEBUG) console.log(`[${this.name}] until TIMED OUT after ${max} frames`);
    return false;
  }
  async close() { if (this.sink) await this.stopRecording(); await this.ctx.close(); }
}

/** Two sessions in lockstep (split-screen shots): each step advances A and B together. */
export class Duo {
  constructor(a, b) { this.a = a; this.b = b; a.peer = b; b.peer = a; }   // from now on a.frames()/b.frames() advance both
  startRecording(dir, name) { this.a.startRecording(path.join(dir, name + '-A.mp4')); this.b.startRecording(path.join(dir, name + '-B.mp4')); }
  async stopRecording() { return Promise.all([this.a.stopRecording(), this.b.stopRecording()]); }
  async frames(n = 1) { return this.a.frames(n); }
  async hold(s) { await this.frames(Math.round(s * OUT_FPS)); }
}
