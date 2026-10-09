const { PNG } = require('/tmp/space-video-prep/tools/node_modules/pngjs');
const fs = require('fs');
const lum = ([r,g,b]) => { const f = c => { c /= 255; return c <= .03928 ? c/12.92 : Math.pow((c+.055)/1.055, 2.4); }; return .2126*f(r)+.7152*f(g)+.0722*f(b); };
const ratio = (a,b) => { const [x,y] = [lum(a),lum(b)].sort((p,q)=>q-p); return +((x+.05)/(y+.05)).toFixed(2); };
for (const label of ['head','now','now_doodle0']) {
  const im = PNG.sync.read(fs.readFileSync(`shots/phone-${label}-reduce-overview.png`));
  // the row band of the small heading line "月台 LIVEHOUSE / 09.30" (css y 60..76, x 18..186), device px x2
  const counts = new Map();
  for (let y = 120; y < 152; y++) for (let x = 36; x < 372; x++) { const i = (y*im.width+x)*4; const k = [im.data[i]>>3<<3, im.data[i+1]>>3<<3, im.data[i+2]>>3<<3].join(','); counts.set(k, (counts.get(k)||0)+1); }
  const bg = [...counts.entries()].sort((a,b)=>b[1]-a[1])[0][0].split(',').map(Number);
  console.log(label, 'dominant backdrop', bg, 'contrast vs small heading #d1d5bb', ratio([209,213,187], bg), 'vs h1 #f2ead4', ratio([242,234,212], bg));
}
