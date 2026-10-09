// Visible text on the first screen, grouped by the primary font family, with the @font-face slices each family needs.
//   node first-screen-text.cjs <url> <phone|desktop> <out.json>
const {chromium} = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const [,, url, vpArg = 'phone', out] = process.argv;
const vp = vpArg === 'desktop' ? {viewport: {width: 1440, height: 900}, deviceScaleFactor: 1} : {viewport: {width: 390, height: 844}, deviceScaleFactor: 2};
const COLLECT = () => {
  const parse = r => r.split(',').map(s => s.trim().replace(/^U\+/i, '')).map(s => { const [a, b] = s.split('-'); return [parseInt(a, 16), parseInt(b || a, 16)]; });
  const faces = [...document.fonts].map(f => ({family: f.family.replace(/"/g, ''), ranges: parse(f.unicodeRange), status: f.status}));
  const sliceOf = (fam, cp) => { const i = faces.filter(f => f.family === fam).findIndex(f => f.ranges.some(([a, b]) => cp >= a && cp <= b)); return i; };
  const byFam = {};
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = walker.nextNode());) {
    const text = n.textContent.replace(/\s+/g, ' ').trim(); if (!text) continue;
    const el = n.parentElement; const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const range = document.createRange(); range.selectNodeContents(n); const rects = [...range.getClientRects()];
    const vis = rects.some(r => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth);
    if (!vis) continue;
    let hidden = false; for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) { hidden = true; break; } }
    if (hidden) continue;
    const fam = cs.fontFamily.split(',')[0].trim().replace(/"/g, '');
    const sel = el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '');
    (byFam[fam] ||= []).push({sel, text: text.slice(0, 80), size: cs.fontSize, slices: [...new Set([...text].map(c => sliceOf(fam, c.codePointAt(0))))].sort()});
  }
  return {byFam, loaded: [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family + ' ' + f.unicodeRange.slice(0, 16))};
};
(async () => {
  const browser = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  const ctx = await browser.newContext(vp); const page = await ctx.newPage();
  await page.goto(url);
  // loading screen state: as soon as #loading is visible
  await page.waitForSelector('#loading', {state: 'visible', timeout: 60000}).catch(() => {});
  const loading = await page.evaluate(COLLECT);
  await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, {timeout: 90000});
  await page.waitForTimeout(3000);
  const lobby = await page.evaluate(COLLECT);
  fs.writeFileSync(out, JSON.stringify({url, vp: vpArg, loading, lobby}, null, 1));
  await browser.close();
  for (const [name, s] of Object.entries({loading, lobby})) {
    console.log('==', name, 'loaded faces:', s.loaded.length);
    for (const [fam, items] of Object.entries(s.byFam)) for (const it of items) console.log(fam.padEnd(15), JSON.stringify(it.slices).padEnd(10), it.size.padEnd(7), it.sel.slice(0, 60).padEnd(60), it.text);
  }
})().catch(e => { console.error(e); process.exit(1); });
