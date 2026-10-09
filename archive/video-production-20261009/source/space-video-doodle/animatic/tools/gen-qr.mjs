// QR for the end card: ink modules on paper-card, 4-module quiet zone, ECC M.  node tools/gen-qr.mjs [url]
import qrcode from '/tmp/space-video-prep/repo-rc4/node_modules/qrcode-generator/dist/qrcode.js';
import fs from 'node:fs';
const url = process.argv[2] || 'https://musicmapteam.github.io/musicSpace/';
const qr = qrcode(0, 'M'); qr.addData(url); qr.make();
const n = qr.getModuleCount(), cell = 10, quiet = 4; let rects = '';
for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) rects += `<rect x="${(c + quiet) * cell}" y="${(r + quiet) * cell}" width="${cell}" height="${cell}"/>`;
const size = (n + quiet * 2) * cell;
fs.writeFileSync('/tmp/space-video-doodle/animatic/assets/qr.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fffaf0"/><g fill="#1c1b1a">${rects}</g></svg>`);
console.log('qr', url, 'modules', n);
