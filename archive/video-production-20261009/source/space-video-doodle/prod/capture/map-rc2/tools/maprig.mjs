// maprig.mjs : frame-stepped recorder for the Music Map (音乐探索) takes on the rc2 build.
// Adapted from the proven rig /tmp/space-video-doodle/prod/capture/desktop/tools/rig.mjs (verbatim copy next to this file as
// rig-desktop-orig.mjs), itself from capture-test/rec2.mjs.  Same as there: Playwright fake clock, every captured frame advances
// virtual time by STEP_MS = 16 ms, CSS/WAAPI animations pinned to the same virtual time, one lossless CDP PNG screenshot per frame,
// seeded Math.random, the cosmetic doodle tap ring, rAF time-warp, 4K master + 1920x1080 Lanczos edit copy from the same PNG frames.
// New for the map:
//   - survives a full-page navigation inside a take (the room's 「音乐探索」 assigns location to music-map/): no stepping while the
//     new document loads (real time), then the per-document rig state is set up again (afterNavigation);
//   - Date.now time-warp (window.__setDateWarp): the map's camera flights and paper motion run on GSAP, whose ticker reads Date.now,
//     not the rAF timestamp; a rate of 1/3 films the product's own courtyard -> record-shop flight in slow motion (timers untouched);
//   - the map's scene redraws at <= 30 fps when idle and every frame while its camera moves, measured on the rAF timestamp: the rAF
//     warp 1.05 (16.8 ms per frame) gives exactly that cadence (idle every 2nd frame, camera moves every frame) on the 16 ms fake rAF;
//   - per-frame PNG md5 for the frozen-frame check, text guard (示例/虚构/本页) helper.
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

export const PHONE = { width: 390, height: 845, dpr: 36 / 13, mobile: true };          // 390x845 CSS @2.769 = 1080x2340 device px
export const DESKTOP4K = { width: 1440, height: 810, dpr: 8 / 3, mobile: false };      // 1440x810 CSS @2.667 = 3840x2160 device px
export const PHONE1X = { width: 390, height: 845, dpr: 1, mobile: true };              // dry runs only
export const DESKTOP1X = { width: 1440, height: 810, dpr: 1, mobile: false };          // dry runs only

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
      Object.assign(r.style, { position: 'fixed', left: e.clientX - 27 + 'px', top: e.clientY - 27 + 'px', right: 'auto', bottom: 'auto', margin: '0', padding: '0', overflow: 'visible', boxSizing: 'border-box', width: '54px', height: '54px', borderRadius: '50%', border: '4px solid #ffd447', boxShadow: '0 0 0 2.5px #1c1b1a, inset 0 0 0 2.5px #1c1b1a, 4px 4px 0 2.5px #ff5c8a', background: 'rgba(255,212,71,.22)', pointerEvents: 'none', zIndex: '2147483646' });
      document.documentElement.appendChild(r);
      // a manual popover lives in the top layer: the ring stays visible over the map's modal papers (<dialog> via showModal)
      try { r.setAttribute('popover', 'manual'); r.showPopover(); } catch (err) { r.removeAttribute('popover'); }
      const a = r.animate([{ transform: 'scale(.3)', opacity: 1 }, { transform: 'scale(1.15)', opacity: 0 }], { duration: 480, easing: 'cubic-bezier(.2,.7,.3,1)' });
      a.onfinish = () => r.remove();
    }, true);
    // a paper opened (or re-rendered) after the press goes on top of the top layer: lift the live rings above it again
    new MutationObserver(recs => {
      if (!recs.some(x => x.target.tagName === 'DIALOG' && x.target.open)) return;
      for (const r of document.querySelectorAll('.__rec_ring[popover]')) { try { r.hidePopover(); r.showPopover(); } catch (err) {} }
    }).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['open'] });
    addEventListener('mouseup', () => { c.firstChild.style.transform = ''; }, true);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
};

/** Seeded Math.random (mulberry32) so random picks repeat exactly between takes. */
const SEED_INIT = seed => { let a = seed >>> 0; Math.random = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

/** rAF time-warp: the timestamps the page's rAF callbacks see advance at window.__warp x virtual time (1 = untouched).
 *  Installed AFTER page.clock.install() so it wraps the fake rAF. */
const WARP_INIT = () => {
  const raf = window.requestAnimationFrame.bind(window);
  let last = null, warped = 0; window.__warp = 1;
  window.requestAnimationFrame = cb => raf(t => { if (last === null) { last = t; warped = t; } if (t !== last) { warped += (t - last) * window.__warp; last = t; } cb(warped); });
};

/** Date.now time-warp: Date.now() advances at the current rate x virtual time; window.__setDateWarp(rate) re-anchors (monotonic).
 *  GSAP keeps >= 4 ms (and >= 1000/240 ms) of its own Date.now time between ticks: with 16 ms frames a rate below ~0.27 would make it
 *  tick on every 2nd/3rd frame only (judder); the takes use 1/3 (5.33 ms per frame: one tick per frame).
 *  Installed AFTER the clock (wraps the fake Date.now) and before the page's scripts (GSAP's ticker keeps a reference to Date.now). */
const DATE_WARP_INIT = () => {
  const fake = Date.now;
  let baseIn = null, baseOut = 0, rate = 1;
  const now = () => { const t = fake.call(Date); return baseIn === null ? t : baseOut + (t - baseIn) * rate; };
  window.__setDateWarp = r => { const t = fake.call(Date); const out = now(); baseIn = t; baseOut = out; rate = r; return out; };
  window.__dateWarpRate = () => rate;
  try { Date.now = now; } catch (e) { window.__dateWarpFailed = String(e); }
};

export const SINKS = new Set();
export function killSinks() { for (const k of SINKS) { try { k.p.kill('SIGKILL'); } catch {} } SINKS.clear(); }

const X264 = (crf, preset) => ['-c:v', 'libx264', '-preset', preset, '-tune', 'animation', '-crf', String(crf), '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', String(OUT_FPS),
  '-x264-params', 'colorprim=bt709:transfer=bt709:colormatrix=bt709:fullrange=off', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
  '-movflags', '+faststart'];
const CONV = (w, h) => `scale=${w}:${h}:flags=lanczos+accurate_rnd+full_chroma_int:out_range=tv:out_color_matrix=bt709,format=yuv420p`;

/** ffmpeg sink: lossless PNG frames on stdin -> master (native size) [+ edit copy 1920x1080 Lanczos from the same frames],
 *  H.264 High, CRF 15, yuv420p, BT.709 limited range, 60 fps CFR. */
export class DualSink {
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
  async write(buf, hash) {
    this.frames++; this.hashes.push(hash || crypto.createHash('md5').update(buf).digest('hex').slice(0, 12));
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

/** In-page text guard: every occurrence of the words the brief bans from the filmed copy, with context. */
export const TEXT_GUARD = () => {
  const t = (document.body && document.body.innerText) || '';
  const out = [];
  for (const w of ['示例', '虚构', '本页']) { let i = -1; while ((i = t.indexOf(w, i + 1)) >= 0) out.push(w + ': …' + t.slice(Math.max(0, i - 24), i + 24).replace(/\s+/g, ' ') + '…'); }
  return out;
};

export class Session {
  static async open(browser, { url, width, height, dpr, mobile = false, cursor = 'touch', name = 'page', css = '', seed = 20261009, warp = true, clockStart = '2026-10-09T22:40:00+08:00', pausedFromStart = false } = {}) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile, locale: 'zh-CN', timezoneId: 'Asia/Shanghai', reducedMotion: 'no-preference', colorScheme: 'light' });
    if (seed !== null) await ctx.addInitScript(SEED_INIT, seed);
    if (cursor) await ctx.addInitScript(CURSOR_INIT, cursor === 'touch' ? 'touch' : 'arrow');
    if (css) await ctx.addInitScript(c => { const add = () => { const st = document.createElement('style'); st.id = '__rec_css'; st.textContent = c; (document.head || document.documentElement).appendChild(st); }; if (document.head) add(); else document.addEventListener('DOMContentLoaded', add); }, css);
    const page = await ctx.newPage();
    const s = new Session(ctx, page, name); s.W = width; s.H = height; s.dpr = dpr; s.clockStart = clockStart; s.seed = seed;
    page.on('pageerror', e => { s.errors.push(String(e).slice(0, 300)); console.log(`[${name} pageerror]`, String(e).slice(0, 200)); });
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') s.console.push(`${m.type()}: ${m.text().slice(0, 200)}`); });
    page.on('framenavigated', f => { if (f === page.mainFrame()) s.navs.push({ url: f.url(), atFrame: s.frame }); });
    await page.clock.install({ time: new Date(clockStart) });   // fake clock follows real time until freeze()
    if (warp) await page.addInitScript(WARP_INIT);              // after the clock: wraps the fake rAF
    await page.addInitScript(DATE_WARP_INIT);                   // after the clock: wraps the fake Date.now (GSAP keeps a reference)
    s.cdp = await ctx.newCDPSession(page);
    if (pausedFromStart) { await page.clock.pauseAt(new Date(new Date(clockStart).getTime() + 3000)); s.frozen = true; s.pausedLoad = true; }
    if (url) await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    if (s.frozen) await s.initDoc();
    return s;
  }
  constructor(ctx, page, name) {
    Object.assign(this, { ctx, page, name, frozen: false, sink: null, cam: null, mouse: { x: -200, y: -200 }, events: [], frame: 0, cdp: null, errors: [], console: [], navs: [], timing: { step: 0, grab: 0, write: 0, n: 0 }, marks: [], probeLog: [], frameProbe: null, beforeGrab: null, fontWaits: [] });
  }
  /** per-document rig state (the animation pinning map and virtual now) */
  async initDoc() { await this.page.evaluate(() => { window.__anims = new Map(); window.__done = new WeakSet(); window.__vnow = 0; }); }
  async freeze() {
    if (this.frozen) return;
    const now = await this.page.evaluate(() => Date.now());
    await this.page.clock.pauseAt(now + 50);
    await this.initDoc();
    this.frozen = true;
  }
  async setWarp(w) { await this.page.evaluate(v => { window.__warp = v; }, w); }
  async setDateWarp(r) { return this.page.evaluate(v => window.__setDateWarp(v), r); }
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
  /** camera push on the screen (CDP clip with scale: the DOM is re-rasterised at the zoom, the WebGL canvas is its own bitmap):
   *  this.cam = { cx, cy, z } in CSS px, null = full frame.  The output size never changes. */
  camClip() {
    const c = this.cam; if (!c || c.z <= 1.0001) return { x: 0, y: 0, width: this.W, height: this.H, scale: this.dpr };
    const w = this.W / c.z, h = this.H / c.z;
    const x = Math.min(this.W - w, Math.max(0, c.cx - w / 2)), y = Math.min(this.H - h, Math.max(0, c.cy - h / 2));
    return { x, y, width: w, height: h, scale: this.dpr * c.z };
  }
  async grab(format = 'png') {
    const opts = { format, captureBeyondViewport: false, fromSurface: true, optimizeForSpeed: true, clip: this.camClip() };
    const r = await this.cdp.send('Page.captureScreenshot', opts);
    return Buffer.from(r.data, 'base64');
  }
  startRecording(master, edit = null, opts = {}) {
    const w = Math.round(this.W * this.dpr), h = Math.round(this.H * this.dpr);
    this.sink = master ? new DualSink(master, edit, { w, h, ...opts }) : { frames: 0, hashes: [], async write(b, h) { this.frames++; this.hashes.push(h); }, async end() { return { file: null, frames: this.frames, seconds: +(this.frames / OUT_FPS).toFixed(3), bytes: 0 }; } };
    this.t0 = Date.now(); this.timing = { step: 0, grab: 0, write: 0, n: 0 };
    this.marks = []; this.probeLog = []; this.events = []; return this.sink;
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
  /** union boxes of selectors (CSS selectors or text=...), in master px (x, y, w, h); null when missing */
  async boxes(map) {
    const k = this.dpr;
    const r = await this.page.evaluate(m => {
      const o = {};
      for (const [name, sels] of Object.entries(m)) {
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (const sel of [].concat(sels)) {
          if (sel.startsWith('text=')) { const want = sel.slice(5); const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { if (n.textContent.includes(want) && n.parentElement && n.parentElement.getClientRects().length) { const rg = document.createRange(); const i = n.textContent.indexOf(want); rg.setStart(n, i); rg.setEnd(n, i + want.length); const b = rg.getBoundingClientRect(); if (b.width) { x0 = Math.min(x0, b.left); y0 = Math.min(y0, b.top); x1 = Math.max(x1, b.right); y1 = Math.max(y1, b.bottom); break; } } } continue; }
          const els = [...document.querySelectorAll(sel)].filter(e => e.getClientRects().length); const el = els[0]; if (!el) continue; const b = el.getBoundingClientRect(); if (!b.width) continue;
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
    const report = { ...r, wallSeconds: +wall.toFixed(1), wallPerVideoSecond: +(wall / Math.max(r.seconds, 0.001)).toFixed(2), msPerFrame: { step: +(this.timing.step / n).toFixed(1), grab: +(this.timing.grab / n).toFixed(1), write: +(this.timing.write / n).toFixed(1) }, dup: d, marks: this.marks, events: this.events, clockStart: this.clockStart, seed: this.seed, fontWaits: this.fontWaits, ...extra };
    this.fontWaits = [];
    if (r.file) fs.writeFileSync(r.file.replace(/\.mp4$/, '') + '.rec.json', JSON.stringify({ ...report, hashes: sink.hashes, probe: this.probeLog }, null, 1));
    return { ...report, hashes: sink.hashes, probe: this.probeLog };
  }
  async _oneFrame() {
    const t0 = performance.now(); await this.step(1); const t1 = performance.now();
    if (this.sink) {
      // the Doodle faces are sliced by character (font-display: swap): new text can start a slice load; never grab a fallback-font frame
      const fs0 = await this.page.evaluate(() => { void document.body.offsetHeight; return document.fonts.status; }).catch(() => 'loaded');   // forced layout first: font loads start at layout
      if (fs0 !== 'loaded') { const w0 = Date.now(); await Promise.race([this.page.evaluate(() => document.fonts.ready.then(() => document.fonts.status)), sleep(5000)]).catch(() => 0); this.fontWaits.push([this.sink.frames, Date.now() - w0]); }
      if (this.beforeGrab) await Promise.race([this.beforeGrab(), sleep(1500)]).catch(() => 0);
      if (this.frameProbe) this.probeLog.push(await this.page.evaluate(this.frameProbe).catch(e => 'ERR ' + e.message));
      const buf = await this.grab(); const t2 = performance.now();
      const h = crypto.createHash('md5').update(buf).digest('hex').slice(0, 12);
      await this.sink.write(buf, h); const t3 = performance.now(); this.timing.step += t1 - t0; this.timing.grab += t2 - t1; this.timing.write += t3 - t2; this.timing.n++;
    }
    this.frame++;
  }
  async frames(n = 1) { for (let i = 0; i < n; i++) await this._oneFrame(); }
  async hold(seconds) { await this.frames(Math.round(seconds * OUT_FPS)); }
  async still(file) { fs.mkdirSync(path.dirname(file), { recursive: true }); const b = await this.cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true, clip: { x: 0, y: 0, width: this.W, height: this.H, scale: this.dpr } }); fs.writeFileSync(file, Buffer.from(b.data, 'base64')); return file; }
  /** park the (invisible) pointer where it hovers nothing that reacts */
  async park(x = 2, y = 2) { await this.page.mouse.move(x, y); this.mouse = { x, y }; }
  /** poll a predicate in real time while stepping (and capturing) virtual time; returns frames waited or -1 */
  async until(pred, { max = 240, arg } = {}) {
    for (let i = 0; i < max; i++) {
      if (await this.page.evaluate(pred, arg)) return i;
      await sleep(5);
      await this.frames(1);
    }
    return -1;
  }
  /** real time, no stepping: wait for a full-page navigation (started by the last click) to commit and load, then set the rig up again
   *  in the new document. The fake clock carries over (Playwright replays its log into the new document); no virtual time passes. */
  async afterNavigation(urlPart, { timeout = 30000, settle = 1200 } = {}) {
    const t = Date.now();
    while (!this.page.url().includes(urlPart)) { if (Date.now() - t > timeout) throw new Error('navigation did not start: ' + urlPart); await sleep(25); }
    await this.page.waitForLoadState('load', { timeout });
    let ok = false;
    for (let i = 0; i < 400 && !ok; i++) { ok = await this.page.evaluate(() => document.readyState === 'complete' && !!document.body).catch(() => false); if (!ok) await sleep(25); }
    await this.initDoc();
    await this.page.evaluate(() => document.fonts.ready.then(() => document.fonts.status));
    await sleep(settle);
    await this.page.evaluate(() => document.fonts.ready.then(() => document.fonts.status));
    return Date.now() - t;
  }
  async close() { if (this.sink) await this.stopRecording(); await this.ctx.close(); }
}
