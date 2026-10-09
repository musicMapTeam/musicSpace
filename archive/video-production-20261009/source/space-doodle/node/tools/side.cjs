// Side-by-side PNG (left | right), optional integer downscale. usage: node side.cjs left.png right.png out.png [scale]
const { PNG } = require('/tmp/space-video-prep/tools/node_modules/pngjs');
const fs = require('fs');
const [l, r, out, s = '1'] = process.argv.slice(2);
const k = Math.max(1, parseInt(s, 10));
const A = PNG.sync.read(fs.readFileSync(l)), B = PNG.sync.read(fs.readFileSync(r));
const gap = 16 * k;
const W = Math.floor((A.width + gap + B.width) / k), H = Math.floor(Math.max(A.height, B.height) / k);
const O = new PNG({ width: W, height: H });
O.data.fill(255);
function blit(P, ox) {
  for (let y = 0; y < Math.floor(P.height / k); y++) for (let x = 0; x < Math.floor(P.width / k); x++) {
    const si = ((y * k) * P.width + x * k) * 4, di = (y * W + Math.floor(ox / k) + x) * 4;
    O.data[di] = P.data[si]; O.data[di + 1] = P.data[si + 1]; O.data[di + 2] = P.data[si + 2]; O.data[di + 3] = 255;
  }
}
blit(A, 0); blit(B, A.width + gap);
fs.writeFileSync(out, PNG.sync.write(O));
console.log('saved', out, W, H);
