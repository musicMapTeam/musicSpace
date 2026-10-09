import { readFileSync } from 'node:fs';
import { readPng } from '/Users/alakazan/workplace/tme/musicSpace/scripts/demo/build-demo-photos.mjs';
const src = readPng(readFileSync('/Users/alakazan/workplace/tme/musicSpace/web/assets/crowd-scene.png'));
const crop = (box) => { const out = []; for (let y = 0; y < box.h; y++) for (let x = 0; x < box.w; x++) { const i = ((box.y + y) * src.width + box.x + x) * src.channels; out.push([src.pixels[i], src.pixels[i + 1], src.pixels[i + 2]]); } return out; };
const lum = ([r, g, b]) => (r * 299 + g * 587 + b * 114) / 1000;
const stats = px => { let s = 0, mx = 0; const hist = new Array(256).fill(0); for (const p of px) { const l = lum(p); s += l; mx = Math.max(mx, l); hist[Math.round(l)]++; } const sorted = []; let acc = 0, p50 = 0, p95 = 0, p99 = 0; for (let v = 0; v < 256; v++) { acc += hist[v]; if (!p50 && acc >= px.length * .5) p50 = v; if (!p95 && acc >= px.length * .95) p95 = v; if (!p99 && acc >= px.length * .99) p99 = v; } return `mean ${(s / px.length).toFixed(1)} max ${mx.toFixed(0)} p50 ${p50} p95 ${p95} p99 ${p99}`; };
const lut = (black, white, gamma, mode) => Array.from({ length: 256 }, (_, v) => { const t = Math.min(1, Math.max(0, (v - black) / (white - black))); const e = mode === 'ps' ? 1 / gamma : gamma; return Math.round(255 * Math.pow(t, e)); });
const apply = (px, table) => px.map(([r, g, b]) => [table[r], table[g], table[b]]);
const box = { x: 0, y: 650, w: 700, h: 374 };
const px = crop(box);
console.log('man-near raw:', stats(px));
for (const [b, w, g] of [[2, 70, .85], [2, 80, .85], [2, 90, .85], [2, 70, 1], [0, 118, .6], [2, 100, .85], [2, 110, .8]]) {
  console.log(`levels ${b}/${w}/${g}  ps(1/g): ${stats(apply(px, lut(b, w, g, 'ps')))}   direct(g): ${stats(apply(px, lut(b, w, g, 'direct')))}`);
}
for (const [name, bx, f] of [['yao-stage', { x: 0, y: 60, w: 620, h: 413 }, 'crowd'], ['man-crowd', { x: 200, y: 380, w: 620, h: 413 }, 'crowd']]) console.log(name, stats(crop(bx)));
