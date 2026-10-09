// decode a QR code from a PNG frame:  node decode-qr.mjs frame.png   -> prints the text or exits 1
import { PNG } from '/tmp/space-video-prep/tools/node_modules/pngjs/lib/png.js';
import jsQR from '/tmp/space-video-prep/tools/node_modules/jsqr/dist/jsQR.js';
import fs from 'node:fs';
const png = PNG.sync.read(fs.readFileSync(process.argv[2]));
const r = jsQR(new Uint8ClampedArray(png.data), png.width, png.height, { inversionAttempts: 'attemptBoth' });
if (!r) { console.error('no QR found'); process.exit(1); }
console.log(r.data);
