// node pngdiff.js a.png b.png [out.png] -> differing pixel count, bbox, max channel diff
const { PNG } = require('/tmp/space-video-prep/tools/node_modules/pngjs');
const fs = require('fs');
const [a, b, out] = process.argv.slice(2);
const A = PNG.sync.read(fs.readFileSync(a)), B = PNG.sync.read(fs.readFileSync(b));
if (A.width !== B.width || A.height !== B.height) { console.log('size differs', A.width, A.height, B.width, B.height); process.exit(0); }
let n = 0, max = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; const O = new PNG({ width: A.width, height: A.height });
for (let y = 0; y < A.height; y++) for (let x = 0; x < A.width; x++) {
  const i = (y * A.width + x) * 4; let d = 0;
  for (let c = 0; c < 4; c++) d = Math.max(d, Math.abs(A.data[i + c] - B.data[i + c]));
  if (d > 0) { n++; max = Math.max(max, d); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const g = Math.round((A.data[i] + A.data[i + 1] + A.data[i + 2]) / 3 * .3);
  O.data[i] = d ? 255 : g; O.data[i + 1] = d ? Math.max(0, 255 - d * 4) : g; O.data[i + 2] = d ? 0 : g; O.data[i + 3] = 255;
}
console.log(JSON.stringify({ pixels: A.width * A.height, differing: n, pct: +(100 * n / (A.width * A.height)).toFixed(3), maxDiff: max, bbox: n ? [x0, y0, x1, y1] : null }));
if (out) fs.writeFileSync(out, PNG.sync.write(O));
