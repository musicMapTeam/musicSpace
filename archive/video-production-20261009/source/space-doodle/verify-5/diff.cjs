const { PNG } = require('/tmp/space-video-prep/tools/node_modules/pngjs');
const fs = require('fs');
const DIR = '/tmp/space-doodle/verify-5/shots';
const mode = process.argv[2] || 'reduce';
const read = f => PNG.sync.read(fs.readFileSync(f));
function diff(a, b, region) {
  let n = 0, total = 0;
  const [x0, y0, x1, y1] = region || [0, 0, a.width, a.height];
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * a.width + x) * 4; total++;
    if (Math.abs(a.data[i] - b.data[i]) > 16 || Math.abs(a.data[i + 1] - b.data[i + 1]) > 16 || Math.abs(a.data[i + 2] - b.data[i + 2]) > 16) n++;
  }
  return +(100 * n / total).toFixed(2);
}
function side(images, out) {
  const gap = 12, w = images.reduce((s, im) => s + im.width, 0) + gap * (images.length - 1), h = Math.max(...images.map(im => im.height));
  const o = new PNG({ width: w, height: h }); o.data.fill(255);
  let ox = 0;
  for (const im of images) { PNG.bitblt(im, o, 0, 0, im.width, im.height, ox, 0); ox += im.width + gap; }
  fs.writeFileSync(out, PNG.sync.write(o));
}
const res = {};
for (const vp of ['phone', 'desktop']) for (const view of ['overview', 'person', 'photos']) {
  const f = l => `${DIR}/${vp}-${l}-${mode}-${view}.png`;
  if (!fs.existsSync(f('head'))) continue;
  const head = read(f('head')), now = read(f('now')), d0 = read(f('now_doodle0'));
  res[`${vp}-${view}`] = { head_vs_now: diff(head, now), head_vs_doodle0: diff(head, d0) };
  side([head, now, d0], `${DIR}/SIDE-${vp}-${mode}-${view}.png`);
}
console.log(JSON.stringify(res, null, 1));
