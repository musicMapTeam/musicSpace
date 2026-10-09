// Checks that every character of every text event exists in the raw TTF of its font role (/tmp/music-space-font-cache/*.ttf).
// Method: draw each char on a canvas with  "Raw<role>", "Courier New"  and with  "Courier New"  alone; identical pixels = the raw font
// lacks the glyph (the browser fell back to the same system font in both cases).   usage: node glyph_check.cjs
const fs = require('fs');
const path = require('path');
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const tl = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'out', 'timeline.json'), 'utf8'));
const FILES = { D: 'display', M: 'marker', H: 'hand', N: 'note', L: 'logo', G: 'digits' };
const byFont = {};
for (const t of tl.text) {
  const set = (byFont[t.font] ||= new Set());
  for (const ch of t.text) if (ch.trim()) set.add(ch);
}
// extra strings the edit draws as graphics (captions, chips, the end card)
const EXTRA = { N: '你拍的TA拍的你！上墙啦看这里今晚我这样', M: '陌生人的手机只有这一面阿宁·人海阿遥·示例·舞台不到1分钟示例照片原创虚构专辑设想', G: '21:4721:48 23分钟以内' };
for (const [f, s] of Object.entries(EXTRA)) for (const ch of s) (byFont[f] ||= new Set()).add(ch);
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const page = await browser.newPage();
  await page.setContent('<html><body></body></html>');
  const out = {};
  for (const [role, set] of Object.entries(byFont)) {
    const file = `/tmp/music-space-font-cache/${FILES[role]}.ttf`;
    const b64 = fs.readFileSync(file).toString('base64');
    const chars = [...set].join('');
    out[role] = await page.evaluate(async ({ b64, chars, role }) => {
      const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const face = new FontFace('Raw' + role, bin.buffer);
      await face.load();
      document.fonts.add(face);
      const c = document.createElement('canvas'); c.width = 64; c.height = 64;
      const g = c.getContext('2d', { willReadFrequently: true });
      const draw = (font, ch) => { g.clearRect(0, 0, 64, 64); g.font = font; g.fillText(ch, 4, 48); return g.getImageData(0, 0, 64, 64).data.join(','); };
      const missing = [];
      for (const ch of chars) {
        if (/\s/.test(ch)) continue;
        const a = draw(`40px "Raw${role}", "Courier New"`, ch), b = draw('40px "Courier New"', ch);
        if (a === b) missing.push(ch);
      }
      return { checked: [...chars].length, missing: missing.join('') };
    }, { b64, chars, role });
  }
  await browser.close();
  fs.writeFileSync(path.join(__dirname, '..', 'out', 'glyphs.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
})();
