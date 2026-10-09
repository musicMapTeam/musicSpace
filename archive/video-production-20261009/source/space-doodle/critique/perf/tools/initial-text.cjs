// The first paint's text (initial HTML + CSS, before the app script runs: JS disabled), by primary font family and slice.
const {chromium} = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  for (const [name, vp] of [['phone', {viewport: {width: 390, height: 844}, deviceScaleFactor: 2}], ['desktop', {viewport: {width: 1440, height: 900}, deviceScaleFactor: 1}]]) {
    const ctx = await browser.newContext({...vp, javaScriptEnabled: false});
    const page = await ctx.newPage();
    const fonts = [];
    page.on('request', r => { if (/\.woff2$/.test(r.url())) fonts.push(r.url().split('/').pop()); });
    await page.goto(process.argv[2], {waitUntil: 'load'});
    await page.waitForTimeout(2500);
    const rows = await page.evaluate(() => {
      const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n; (n = w.nextNode());) { const t = n.textContent.replace(/\s+/g, ' ').trim(); if (!t) continue; const el = n.parentElement; let hid = false; for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden') { hid = true; break; } } if (hid) continue; if (el.closest('noscript')) continue; const r = el.getBoundingClientRect(); if (!r.width || r.bottom < 0 || r.top > innerHeight) continue; out.push([getComputedStyle(el).fontFamily.split(',')[0].replace(/"/g, ''), (el.id ? '#' + el.id : el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0]), t.slice(0, 40)]); }
      return out;
    });
    console.log('==', name, 'woff2 requested with JS off:', fonts.join(' '));
    for (const r of rows) console.log('  ', r[0].padEnd(15), r[1].padEnd(26), r[2]);
    await ctx.close();
  }
  await browser.close();
})();
