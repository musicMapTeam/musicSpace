// TAKE-P1 helpers on top of the proven frame-stepped rig (rig/rec2.mjs = byte copy of capture-test/rec2.mjs).
// Adds: one continuous master recording + any number of overlapping per-shot sub-clip sinks fed with the same frames,
// a per-frame DOM state probe (exact first frames of state changes), real-time load settling before each grab
// (decoded images, fonts), beat-grid taps (the click lands on an exact output frame) and eased scrolls.
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { FFMPEG, OUT_FPS, sleep } from './rig/rec2.mjs';

/** ffmpeg sink, same settings as rec2 FrameSink: PNG frames -> H.264 High, yuv420p, BT.709 limited, 60 fps CFR. */
export class Sink {
  constructor(file, { w, h, crf = 15, preset = 'slow', tune = 'animation' }) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    this.file = file; this.frames = 0; this.hashes = [];
    const vf = `scale=${w}:${h}:flags=lanczos+accurate_rnd+full_chroma_int:out_range=tv:out_color_matrix=bt709,format=yuv420p`;
    this.p = spawn(FFMPEG, ['-y', '-v', 'error', '-f', 'image2pipe', '-c:v', 'png', '-framerate', String(OUT_FPS), '-i', '-',
      '-vf', vf, '-c:v', 'libx264', '-preset', preset, ...(tune ? ['-tune', tune] : []), '-crf', String(crf), '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', String(OUT_FPS),
      '-x264-params', 'colorprim=bt709:transfer=bt709:colormatrix=bt709:fullrange=off', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
      '-movflags', '+faststart', file], { stdio: ['pipe', 'inherit', 'inherit'] });
    this.done = new Promise((res, rej) => { this.p.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg exit ' + c + ' ' + file))); });
  }
  async write(buf, hash) {
    this.frames++; this.hashes.push(hash);
    if (!this.p.stdin.write(buf)) await new Promise(r => this.p.stdin.once('drain', r));
  }
  async end() { this.p.stdin.end(); await this.done; return { file: this.file, frames: this.frames, bytes: fs.statSync(this.file).size }; }
  kill() { try { this.p.kill('SIGKILL'); } catch {} }
}

/** In-page helpers (read-only: they never change the DOM or app state). */
export const PAGE_HELPERS = () => {
  const hash = s => { if (!s) return ''; let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36); };
  const vis = e => !!(e && e.getClientRects().length && !e.closest('[hidden]') && getComputedStyle(e).visibility !== 'hidden');
  const t = (e, n = 40) => e ? (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, n) : '';
  const q = s => document.querySelector(s);
  const visQ = s => [...document.querySelectorAll(s)].find(vis) || null;
  const dec = new WeakSet();
  window.__p1 = {
    vis, visQ,
    /** first visible element matching sel whose text contains `text` */
    find(sel, text) {
      if (sel === '@text') { const all = [...document.querySelectorAll('body *')].filter(e => vis(e) && (e.innerText || '').includes(text)); return all.filter(e => !all.some(o => o !== e && e.contains(o)))[0] || null; }   // deepest element holding the text
      return [...document.querySelectorAll(sel)].find(e => vis(e) && (!text || (e.innerText || e.textContent || '').includes(text))) || null;
    },
    box(sel, text) { const e = this.find(sel, text); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 }; },
    union(list) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [sel, text] of list) { const e = this.find(sel, text); if (!e) continue; const r = e.getBoundingClientRect(); x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom); } return x1 < x0 ? null : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; },
    /** union box of every visible match of sel */
    unionAll(sel) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const e of document.querySelectorAll(sel)) { if (!vis(e)) continue; const r = e.getBoundingClientRect(); x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom); } return x1 < x0 ? null : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; },
    /** box of the nearest common ancestor of the first visible matches of a and b */
    commonBox(a, b) { const ea = visQ(a), eb = visQ(b); if (!ea || !eb) return null; let p = ea; while (p && !p.contains(eb)) p = p.parentElement; if (!p) return null; const r = p.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, tag: p.tagName + '.' + p.className }; },
    /** is the centre of the element really hittable (not covered by another element)? */
    hit(sel, text) { const e = this.find(sel, text); if (!e) return 'missing'; const r = e.getBoundingClientRect(); const h = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); if (!h) return 'none'; if (e.contains(h) || (e.closest('label') && e.closest('label').contains(h))) return 'ok'; return 'covered by ' + h.tagName + '.' + String(h.className).slice(0, 40); },
    /** top of the element in the viewport (or null) */
    top(sel) { const e = visQ(sel); return e ? Math.round(e.getBoundingClientRect().top) : null; },
    /** wait (real time) until visible <img> are decoded and fonts are loaded; returns the number of images awaited */
    async settle() {
      const imgs = [...document.images].filter(i => !dec.has(i) && i.getClientRects().length).filter(i => { const r = i.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; });
      await Promise.all(imgs.map(i => i.decode().then(() => dec.add(i), () => dec.add(i))));
      if (document.fonts.status !== 'loaded') await document.fonts.ready;
      return imgs.length;
    },
    state() {
      const pn = q('#panel'); const pOpen = !!(pn && !pn.hidden);
      let qa = null; try { qa = window.__SPACE_EVENT_QA__(); } catch {}
      const comm = visQ('.community-panel');
      const cup = visQ('.worldcup-panel'); const game = visQ('.music-games'); const corner = visQ('.corner-panel');
      const chat = visQ('.private-chat');
      const np = cup ? [...cup.querySelectorAll('[data-cup-choice][data-album="night-platform"]')].map(b => t(b.closest('article,li,div'), 60)).join('') : '';
      return {
        view: qa?.camera?.view || '', mv: qa?.camera?.moving ? 1 : 0, nmem: qa?.members?.length ?? -1,
        pnl: pOpen ? t(pn.querySelector('h2, h3'), 18) : '', pst: pOpen ? Math.round(pn.scrollTop) : -1,
        toast: t(q('#toast'), 24),
        entry: pOpen && !!q('form[data-form="demo-entry"]') ? 1 : 0, ec: q('form[data-form="demo-entry"] input[name=consent]')?.checked ? 1 : 0,
        wd: vis(q('.wardrobe')) ? hash(q('.wardrobe .wardrobe-figure svg')?.outerHTML) : '', ang: vis(q('.wardrobe')) ? (q('.wardrobe [data-angle][aria-pressed="true"]')?.dataset.angle || '') : '',
        nick: vis(q('.wardrobe')) ? (q('.wardrobe input[aria-label="昵称"]')?.value || '') : '', wst: vis(q('.wardrobe')) ? Math.round(q('.wardrobe-tools')?.scrollTop || 0) : -1,
        tour: t(visQ('.demo-tour'), 14),
        up: pOpen && !!q('form[data-form="upload"]') ? 1 : 0, ai: t(q('.moment-ai-tag'), 14), think: pOpen && /AI 在本机判断视角/.test(pn.innerText) ? 1 : 0,
        aiy: q('.moment-ai-tag') && vis(q('.moment-ai-tag')) ? Math.round(q('.moment-ai-tag').getBoundingClientRect().top) : null,
        sel: [...document.querySelectorAll('[data-moment-viewpoint][aria-pressed="true"]')].map(b => b.dataset.momentViewpoint).join(','),
        badge: vis(q('[data-moment-badge="other-side"]')) ? 1 : 0,
        x: vis(q('.photo-exchanges')) ? 1 : 0, xst: vis(q('.exchange-status')) ? t(q('.exchange-status'), 8) : '', xc: q('[data-x-consent]')?.checked ? 1 : 0, xb: vis(q('.exchange-body')) ? Math.round(q('.exchange-body').scrollTop) : -1,
        inbox: t(q('#social-inbox'), 6), greet: pOpen ? (/你们已经认识了/.test(pn.innerText) ? 'friends' : /已招手，等待本人回应/.test(pn.innerText) ? 'waiting' : '') : '',
        chat: chat ? chat.querySelectorAll('.chat-message').length : -1, ta: chat ? (chat.querySelector('textarea')?.value.length ?? -1) : -1,
        comm: comm ? (comm.className.replace('community-panel', '').trim().slice(0, 30) + '|' + t(comm.querySelector('h2, h3'), 12)) : '',
        cst: comm ? Math.round((comm.querySelector('.conversation-content') || comm.querySelector('.community-scroll'))?.scrollTop ?? -1) : -1, row: Math.round(visQ('.conversation-actions')?.scrollLeft ?? -1),
        cup: cup ? (np.slice(0, 40) + (cup.querySelector('form[data-cup-vote]') ? '|form' : '') + (cup.querySelector('form[data-cup-vote] input[name=consent]')?.checked ? '+c' : '')) : '', cupst: cup ? Math.round(cup.querySelector('.community-scroll')?.scrollTop ?? -1) : -1,
        game: game ? ((game.innerText.match(/音乐偏好默契局 · [^·\n]*/) || [''])[0] + '|' + (game.innerText.match(/\d 人选择 · 本轮有共同选择/) ? 'reveal' : '') + [...game.querySelectorAll('form')].map(f => f.dataset.gameForm + (f.querySelector('input[name=consent]')?.checked ? '+c' : '')).join(',')) : '',
        corner: corner ? (/等待朋友本人明确参与/.test(corner.innerText) ? 'invited' : corner.querySelector('input[name=participation]')?.checked ? 'ticked' : 'open') : '',
        mem: pOpen && !!q('#panel input[name="memory-photo"]') ? ['memory-photo', 'memory-avatar', 'memory-confirm'].map(n => q(`#panel input[name="${n}"]`)?.checked ? 1 : 0).join('') + (/已发起下载/.test(pn.innerText) ? '|dl' : '') : '',
        my: vis(q('.personal-space')) ? Math.round(q('.personal-space .community-scroll')?.scrollTop ?? 0) : -1,
      };
    },
  };
};

export const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const md5 = b => crypto.createHash('md5').update(b).digest('hex').slice(0, 12);
export { sleep };
