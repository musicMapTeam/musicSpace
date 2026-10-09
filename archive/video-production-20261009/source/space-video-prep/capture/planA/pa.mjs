// Shared helpers for the Plan A shots (live 0.16 page).  Real-time steps are plain Playwright; recorded steps use the Session kit (frame-stepped, virtual clock).
import { Session, sleep } from '../rec.mjs';
import fs from 'node:fs';
export { sleep };
export const CLIP = id => `/tmp/space-video-prep/clips/planA/${id}.mp4`;
export const PHOTOS = {
  stage: '/tmp/space-video-prep/photos/pack/demo-stage-2147.jpg',     // EXIF 21:47:12, AI: 舞台 (sure)
  crowd: '/tmp/space-video-prep/photos/pack/demo-crowd-2148.jpg',     // EXIF 21:48:03, AI: 人海 (sure)
  unsure: '/tmp/space-video-prep/photos/pack/demo-unsure-2150.jpg',   // EXIF 21:50:20, AI: 不确定 (honest case)
};
/** recording-only stylesheet: hides the app's panels/dialogs so the 3D camera moves are seen alone (same principle as capture/cinematic.css; the scene and camera are the product's own) */
export const HIDE_UI = `#main-content,dialog,.sp-dialog,#toast,.toast,.sp-toast{opacity:0!important;pointer-events:none!important;transition:none!important}`;
export const DIALOG = 'dialog.sp-dialog[open]';

/** fresh visitor on the page (new browser context = empty storage); returns when the 3D intro has settled */
export async function open(browser, base, { width, height, dpr, cursor = 'arrow', css = '' } = {}) {
  const s = await Session.open(browser, { url: base, width, height, dpr, cursor, css, name: 'live' });
  const p = s.page;
  await p.waitForFunction(() => document.querySelector('.sakura-scene__canvas') && /体验示例/.test(document.body.innerText), null, { timeout: 60000 });
  await sleep(4200);                                                    // the page's own camera intro
  return s;
}
// ---- real-time flow steps (not recorded) ----
export const btn = (p, re) => p.getByRole('button', { name: re }).first();
export async function toDemo(p) { await btn(p, /体验示例/).click(); await sleep(2800); }
export async function openMake(p) { await btn(p, /做一张卡/).click(); await sleep(2400); }
export async function pickFile(p, file, { wait = true } = {}) {
  await p.locator('input[name=photo]').setInputFiles(file);
  if (wait) await p.waitForFunction(() => /AI 判断|不确定/.test(document.body.innerText), null, { timeout: 60000 }).catch(() => console.log('WARN: no AI verdict (model unavailable?)'));
  await sleep(500);
}
export async function saveCard(p) { await btn(p, /保存现场卡/).click(); await sleep(2200); }
export async function toRequest(p) { await btn(p, /看看阿遥的卡/).click(); await sleep(2200); await btn(p, /申请换卡/).click(); await sleep(1800); }
export async function send(p) { await btn(p, /发送申请/).click(); await sleep(2200); }
export async function asYao(p) { await btn(p, /切到阿遥/).click(); await sleep(2200); }
export async function viewRequest(p) { await btn(p, /查看申请/).click(); await sleep(1800); }
export async function agree(p) { await btn(p, /同意交换/).click(); await sleep(1500); }
/** real time: run the model once on the crowd sample so the recorded pick never shows the 10 MB download; leaves the editor open with the sample photo selected again */
export async function warmModel(p) {
  await pickFile(p, PHOTOS.crowd);
  await btn(p, /我的舞台/).click().catch(() => {}); await sleep(600);        // back to the bundled sample: the form shows no verdict until the next real pick
}

/** director: aim the camera at the union box of several elements (CSS px), zoom so it fills ~1/pad of the frame (clamped) */
export async function focusUnion(s, locators, { pad = 1.2, zmin = 1.15, zmax = 1.9, dy = 0, k } = {}) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const l of locators) { const b = await (typeof l === 'string' ? s.page.locator(l) : l).first().boundingBox().catch(() => null); if (!b) continue; x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height); }
  if (x1 < x0) return false;
  const w = x1 - x0, h = y1 - y0, z = Math.max(zmin, Math.min(zmax, Math.min(s.W / (w * pad), s.H / (h * pad))));
  s.focus({ x: (x0 + x1) / 2, y: (y0 + y1) / 2 + dy, z, k }); return true;
}
/** frame-accurate eased scroll of the dialog's scroll container (the first scrollable ancestor of the form/body) */
export async function scrollDialog(s, to, seconds = 0.8, root = 'dialog[open]') {
  const n = Math.max(1, Math.round(seconds * 60));
  const from = await s.page.evaluate(root => {
    const d = document.querySelector(root); if (!d) return 0;
    const cand = [d, ...d.querySelectorAll('*')].find(e => e.scrollHeight > e.clientHeight + 8 && /(auto|scroll)/.test(getComputedStyle(e).overflowY));
    window.__scrollEl = cand || null; return cand ? cand.scrollTop : 0;
  }, root);
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  for (let i = 1; i <= n; i++) {
    const y = from + (to - from) * ease(i / n);
    await s.page.evaluate(v => { if (window.__scrollEl) window.__scrollEl.scrollTop = v; }, y);
    await s.frames(1);
  }
}

// ---- composite real-time setups: bring a fresh visitor to a given state (not recorded) ----
/** demo opened, own stage photo (EXIF 21:47) picked, song written, card saved, 阿遥's card dialog open */
export async function setupPeer(p, { song = '晴天', file = PHOTOS.stage } = {}) {
  await toDemo(p); await openMake(p);
  if (song) await p.locator('#sp-song-input').fill(song);
  await pickFile(p, file); await saveCard(p);
  await btn(p, /看看阿遥的卡/).click(); await sleep(2200);
}
/** ... and the request dialog (「和阿遥交换这两张卡？」) open */
export async function setupRequest(p, opts) { await setupPeer(p, opts); await btn(p, /申请换卡/).click(); await sleep(1800); }
/** ... and the ceremony (双联票根) open after 阿遥 agreed */
export async function setupAgreed(p, opts) {
  await setupRequest(p, opts); await send(p); await asYao(p); await viewRequest(p); await agree(p); await sleep(4500);
}
/** capture the exported duet PNG (1600x1800) through the page's own download button; real time, after the preview is showing */
export async function downloadTicket(p, file) {
  const dl = p.waitForEvent('download', { timeout: 20000 });
  await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /下载图片/.test(b.textContent))?.click());
  const d = await dl; await d.saveAs(file); return file;
}

/** a hold with life in it: the director's camera creeps toward z+dz (and optionally toward x,y) at rate k while time passes (no static frames) */
export async function drift(s, seconds, { dz = 0.08, k = 0.5, x, y } = {}) {
  const t = s.camT || { cx: s.W / 2, cy: s.H / 2, z: 1 };
  s.focus({ x: x ?? t.cx, y: y ?? t.cy, z: t.z + dz, k });
  await s.hold(seconds);
}
