import { readFileSync } from 'node:fs';
import { readPng } from '/Users/alakazan/workplace/tme/musicSpace/scripts/demo/build-demo-photos.mjs';
for (const f of ['yao-stage', 'man-crowd', 'bei-balcony', 'man-near-before', 'man-near', 'sample-stage', 'sample-crowd']) {
  const { pixels, channels } = readPng(readFileSync(`/tmp/space-doodle/fix/app/sipscheck/${f}.png`));
  let s = 0, n = 0, mx = 0; for (let i = 0; i < pixels.length; i += channels) { const l = (pixels[i] * 299 + pixels[i + 1] * 587 + pixels[i + 2] * 114) / 1000; s += l; n++; if (l > mx) mx = l; }
  console.log(f.padEnd(16), 'mean', (s / n).toFixed(1), 'max', mx.toFixed(0));
}
