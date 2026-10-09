import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync, crc32 } from 'node:zlib';
import { readPng } from '/Users/alakazan/workplace/tme/musicSpace/scripts/demo/build-demo-photos.mjs';
const src = readPng(readFileSync('/Users/alakazan/workplace/tme/musicSpace/web/assets/crowd-scene.png'));
function writePng({ width, height, channels, pixels }) {
  const chunk = (kind, body) => { const head = Buffer.alloc(8); head.writeUInt32BE(body.length, 0); head.write(kind, 4, 'latin1'); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(kind, 'latin1'), body])) >>> 0, 0); return Buffer.concat([head, body, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = channels === 4 ? 6 : 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const stride = width * channels, raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) { raw[y * (stride + 1)] = 0; pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride); }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const box = { x: 0, y: 650, w: 700, h: 374 };
const cut = { width: box.w, height: box.h, channels: 3, pixels: Buffer.alloc(box.w * box.h * 3) };
for (let y = 0; y < box.h; y++) for (let x = 0; x < box.w; x++) { const i = ((box.y + y) * src.width + box.x + x) * src.channels, o = (y * box.w + x) * 3; cut.pixels[o] = src.pixels[i]; cut.pixels[o + 1] = src.pixels[i + 1]; cut.pixels[o + 2] = src.pixels[i + 2]; }
const lut = (black, white, e) => Uint8Array.from({ length: 256 }, (_, v) => Math.round(255 * Math.pow(Math.min(1, Math.max(0, (v - black) / (white - black))), e)));
for (const [name, b, w, e] of [['raw', 0, 255, 1], ['d-2-70-085', 2, 70, .85], ['ps-2-70-085', 2, 70, 1 / .85], ['d-2-90-085', 2, 90, .85]]) {
  const t = lut(b, w, e), out = { ...cut, pixels: Buffer.from(cut.pixels.map(v => t[v])) };
  const png = writePng(out);
  // round trip
  const back = readPng(png); if (!back.pixels.equals(out.pixels)) throw new Error('round trip failed');
  writeFileSync(`/tmp/space-doodle/fix/app/raw/man-near-${name}.png`, png);
}
console.log('ok');
