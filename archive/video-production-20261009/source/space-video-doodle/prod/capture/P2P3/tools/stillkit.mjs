// Stills and die-cuts from a rig Session (CDP screenshots at the session's device scale, so phone stills are 2.769x CSS px).
// cut(): an opaque region still (what the screen shows) + an alpha die-cut of the same region (only the target subtree is
// painted: a temporary <style> hides every other box with `visibility`, so nothing moves, and the default background is made
// transparent).  Both are taken with the page frozen (rig fake clock + paused animations), so they show the same instant.
import fs from 'node:fs';
import path from 'node:path';
import { freezeKeep } from './lib.mjs';

const HIDE_ID = '__cut_style';
function hideCss(sels) {
  const keep = sels.map(s => `:not(${s}):not(${s} *)`).join('');
  return `*,*::before,*::after{transition:none!important}
html,body{background:transparent!important;background-image:none!important}
body{visibility:hidden!important}
body *${keep}{visibility:hidden!important}
${sels.join(',')}{visibility:visible!important}`;
}

export class StillKit {
  constructor(s, root) { this.s = s; this.root = root; this.items = []; this.frozen = false; }
  async freeze() { if (!this.s.frozen) { await freezeKeep(this.s); await this.s.step(1); } }
  async thaw() { if (this.s.frozen) await this.s.unfreeze(); }
  async _cap(clip, transparent) {
    const { cdp, dpr } = this.s;
    if (transparent) await cdp.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
    try {
      const r = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: clip.x, y: clip.y, width: clip.width, height: clip.height, scale: dpr }, captureBeyondViewport: false, fromSurface: true });
      return Buffer.from(r.data, 'base64');
    } finally { if (transparent) await cdp.send('Emulation.setDefaultBackgroundColorOverride', {}); }
  }
  async box(sels, pad) {
    const p = typeof pad === 'number' ? { l: pad, t: pad, r: pad, b: pad } : pad;
    const b = await this.s.page.evaluate(sels => {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, n = 0;
      for (const s of sels) for (const e of document.querySelectorAll(s)) {
        const r = e.getBoundingClientRect(); if (!r.width || !r.height || !e.getClientRects().length) continue; n++;
        x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom);
      }
      return n ? { x0, y0, x1, y1, n, vw: innerWidth, vh: innerHeight } : null;
    }, sels);
    if (!b) return null;
    const x = Math.max(0, Math.floor(b.x0 - p.l)), y = Math.max(0, Math.floor(b.y0 - p.t));
    return { x, y, width: Math.min(b.vw, Math.ceil(b.x1 + p.r)) - x, height: Math.min(b.vh, Math.ceil(b.y1 + p.b)) - y, n: b.n, clipped: b.y0 < 0 || b.y1 > b.vh || b.x0 < 0 || b.x1 > b.vw, padClamped: b.y0 - p.t < 0 || b.y1 + p.b > b.vh || b.x0 - p.l < 0 || b.x1 + p.r > b.vw };
  }
  /** opaque region + alpha die-cut of the union of `sels` (CSS selectors) */
  async cut(id, name, sels, { pad = 16, scroll = 'center', alpha = true, opaque = true, note = '', storyboard = '' } = {}) {
    sels = [].concat(sels);
    const page = this.s.page;
    if (scroll) {
      await this.thaw();
      await page.evaluate(([sel, block]) => document.querySelector(sel)?.scrollIntoView({ block, inline: 'nearest' }), [sels[0], scroll]);
      await page.waitForTimeout(350);
    }
    await this.freeze();
    const clip = await this.box(sels, pad);
    if (!clip) throw new Error(`cut ${id}: nothing visible for ${sels.join(' | ')}`);
    const base = path.join(this.root, name);
    fs.mkdirSync(path.dirname(base), { recursive: true });
    const out = { id, name, sels, clipCss: clip, note, storyboard, files: {} };
    if (opaque) { fs.writeFileSync(base + '.opaque.png', await this._cap(clip, false)); out.files.opaque = base + '.opaque.png'; }
    if (alpha) {
      await page.evaluate(([id, css]) => { const st = document.createElement('style'); st.id = id; st.textContent = css; document.head.appendChild(st); }, [HIDE_ID, hideCss(sels)]);
      try { fs.writeFileSync(base + '.png', await this._cap(clip, true)); out.files.alpha = base + '.png'; }
      finally { await page.evaluate(id => document.getElementById(id)?.remove(), HIDE_ID); }
    }
    this.items.push(out);
    console.log('cut', id, name, JSON.stringify(clip));
    return out;
  }
  /** full viewport still at device resolution */
  async full(id, name, { note = '', storyboard = '' } = {}) {
    await this.freeze();
    const file = path.join(this.root, name + '.png');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, await this._cap({ x: 0, y: 0, width: this.s.W, height: this.s.H }, false));
    const out = { id, name, files: { full: file }, note, storyboard };
    this.items.push(out);
    console.log('full', id, name);
    return out;
  }
}
