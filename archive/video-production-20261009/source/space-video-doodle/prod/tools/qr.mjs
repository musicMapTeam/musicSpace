// decode a QR code from a PNG:  node tools/qr.mjs frame.png [more.png ...]  -> prints "<file>\t<text>" per decoded file (exit 1 if none)
import { PNG } from './node_modules/pngjs/lib/png.js';
import jsQR from './node_modules/jsqr/dist/jsQR.js';
import fs from 'node:fs';
let ok = 0;
for (const f of process.argv.slice(2)) {
  const png = PNG.sync.read(fs.readFileSync(f));
  const r = jsQR(new Uint8ClampedArray(png.data), png.width, png.height, { inversionAttempts: 'attemptBoth' });
  console.log(f + '\t' + (r ? r.data : '')); if (r) ok++;
}
process.exit(ok ? 0 : 1);
