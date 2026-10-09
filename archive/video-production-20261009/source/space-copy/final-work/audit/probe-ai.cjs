// Which photo makes the on-device AI unsure? Upload candidates, read the AI line; then show the nudge for an unsure one.
const L = require('./lib.cjs');
const fs = require('fs');
L.watchdog(280);
const vp = process.argv[2] || 'phone';
L.setCorpus(`probe-ai-${vp}`);
const zlib = require('zlib');
function png(w, h, fn) { const rows = []; for (let y = 0; y < h; y++) { const r = Buffer.alloc(1 + w * 3); for (let x = 0; x < w; x++) { const [a, b, c] = fn(x, y); r[1 + x * 3] = a; r[2 + x * 3] = b; r[3 + x * 3] = c; } rows.push(r); }
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = b => { let x = 0xFFFFFFFF; for (const v of b) x = crcT[(x ^ v) & 0xFF] ^ (x >>> 8); return (x ^ 0xFFFFFFFF) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]); }
const candidates = [
  ['gray.png', 'image/png', png(320, 240, () => [128, 128, 128])],
  ['noise.png', 'image/png', png(320, 240, () => [Math.random() * 255 | 0, Math.random() * 255 | 0, Math.random() * 255 | 0])],
  ['dark.png', 'image/png', png(320, 240, (x, y) => [10 + (x % 7), 10, 20 + (y % 5)])],
  ['bei-balcony.jpg', 'image/jpeg', fs.readFileSync('/tmp/space-copy/audit/dist-pages/demo/bei-balcony.jpg')],
  ['man-near.jpg', 'image/jpeg', fs.readFileSync('/tmp/space-copy/audit/dist-pages/demo/man-near.jpg')],
];
(async () => {
  const browser = await L.launch();
  try {
    const run = await L.open(browser, vp);
    const { page } = run; page.__vp = vp;
    await L.ready(run);
    await L.enter(run);
    await L.js(page, '[data-tour-action="open:upload"]');
    await page.waitForSelector('form[data-form="upload"]', { timeout: 20000 });
    let unsure = null;
    for (const [name, mimeType, buffer] of candidates) {
      await page.setInputFiles('form[data-form="upload"] input[type="file"]', { name, mimeType, buffer });
      await page.waitForSelector('form[data-form="upload"] .photo-review', { timeout: 30000 });
      await L.aiSettled(page); await L.sleep(2500);
      const line = await page.evaluate(() => { const f = document.querySelector('form[data-form="upload"]'); return [...f.querySelectorAll('.moment-ai, [data-moment-ai], .moment-ai-tag, .moment-view')].map(n => n.innerText).join(' | ') || f.innerText.slice(0, 400); });
      const pressed = await page.evaluate(() => document.querySelector('form[data-form="upload"] .moment-chip[aria-pressed="true"]')?.innerText || '');
      console.log(name, '=>', JSON.stringify(line).slice(0, 300), 'pressed:', pressed);
      if (!pressed && !unsure) unsure = name;
      if (!pressed) { await L.grab(page, `upload-unsure-${name}`, '#panel'); await L.shotScroll(page, `pa-unsure-${name}`, '#panel', 3); }
    }
    if (unsure) {
      const c = candidates.find(x => x[0] === unsure);
      await page.setInputFiles('form[data-form="upload"] input[type="file"]', { name: c[0], mimeType: c[1], buffer: c[2] });
      await L.aiSettled(page); await L.sleep(2500);
      await page.locator('form[data-form="upload"] button[type="submit"]').first().evaluate(b => b.click());
      await L.sleep(800);
      await L.grab(page, 'upload-nudge', '#panel');
      await L.shotScroll(page, 'pa-nudge', '#panel', 3);
    }
    await L.log(page, 'probe-ai');
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); } finally { L.flush(); await browser.close(); }
})();
