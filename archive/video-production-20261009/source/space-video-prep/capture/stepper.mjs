// Deterministic frame-stepped capture for the real WebGL app.
//  - Playwright fake clock controls Date / performance.now / setTimeout / setInterval / requestAnimationFrame
//  - CSS transitions & animations (document timeline) are driven through the Web Animations API, one step at a time
//  - every step: advance virtual time by exactly 1/FPS, render, then screenshot (lossless PNG or high-q JPEG)
// Result: one unique frame per output frame at an exact cadence, independent of machine speed.
import { sleep, fs, path, ensureDir } from './lib.mjs';

export class Stepper {
  constructor(page, { fps = 30, outDir, format = 'png', quality = 95 } = {}) {
    this.page = page; this.fps = fps; this.dt = 1000 / fps; this.outDir = outDir; this.format = format; this.quality = quality;
    this.n = 0; this.vt = 0; this.clockStarted = false; this.timings = [];
    if (outDir) ensureDir(outDir);
  }
  /** Must be called BEFORE page.goto so the fake timers are in place from the first script. */
  static async install(page) {
    await page.clock.install();            // fake clock follows real time until pauseAt()
  }
  /** Freeze the page clock; from now on only step() advances the app. */
  async freeze() {
    const now = await this.page.evaluate(() => Date.now());
    await this.page.clock.pauseAt(now + 50);   // jump a hair forward and pause
    await this.page.evaluate(() => {
      window.__stepAnims = new Map();       // Animation -> virtual start (ms) so we can drive CSS animations/transitions
      window.__vnow = 0;
    });
    this.frozen = true;
  }
  async resume() { await this.page.clock.resume(); this.frozen = false; }

  /** Advance virtual time by dtMs (default one frame) and sync CSS animations. */
  async advance(dtMs = this.dt) {
    // 1) run JS timers/rAF for the interval
    await this.page.clock.runFor(dtMs);
    // 2) drive CSS animations/transitions deterministically
    await this.page.evaluate(dt => {
      window.__vnow += dt;
      const m = window.__stepAnims;
      for (const a of document.getAnimations()) {
        if (!m.has(a)) { m.set(a, window.__vnow - dt); a.pause(); }   // adopt: start at the previous step boundary
        const start = m.get(a);
        try { a.currentTime = Math.max(0, window.__vnow - start); } catch (e) {}
      }
    }, dtMs);
    this.vt += dtMs;
  }
  async shot() {
    const t = Date.now();
    const buf = await this.page.screenshot({ type: this.format, quality: this.format === 'jpeg' ? this.quality : undefined, animations: 'allow', caret: 'initial', timeout: 30000 });
    this.timings.push(Date.now() - t);
    return buf;
  }
  /** Step and save N frames (or until `until(ms)` true). Returns count. */
  async record(seconds, { name = 'f', tick } = {}) {
    const frames = Math.round(seconds * this.fps);
    for (let i = 0; i < frames; i++) {
      if (tick) await tick(i, this.n, this.vt);
      await this.advance();
      const buf = await this.shot();
      if (this.outDir) fs.writeFileSync(path.join(this.outDir, `${name}${String(this.n).padStart(6, '0')}.${this.format === 'png' ? 'png' : 'jpg'}`), buf);
      this.n++;
    }
    return frames;
  }
  /** Do a real-time action (click etc.) while frozen; the page reacts in zero virtual time. */
  async act(fn, settleMs = 50) { await fn(); await sleep(settleMs); }
}
