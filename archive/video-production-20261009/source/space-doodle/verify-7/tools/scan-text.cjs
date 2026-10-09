// Verification helper: after boot, list visible text per font family on the lobby, and which slices it needs.
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const [url, vp, out] = process.argv.slice(2);
const VPS = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, desktop: { viewport: { width: 1440, height: 900 } } };
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    const ctx = await browser.newContext(VPS[vp]); const page = await ctx.newPage();
    const fontReqs = []; page.on('request', r => { if (/\.woff2$/.test(r.url())) fontReqs.push(r.url().split('/').pop()); });
    await page.goto(url); await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 60000 }); await page.waitForTimeout(3000);
    const res = await page.evaluate(() => {
      const fam = {}; const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n; while ((n = walker.nextNode())) {
        const t = n.nodeValue.trim(); if (!t) continue; const el = n.parentElement; if (!el) continue;
        const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
        if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) || r.width === 0 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
        const f = cs.fontFamily.split(',')[0].replace(/"/g, '').trim(); (fam[f] = fam[f] || []).push(t);
      }
      return fam;
    });
    fs.writeFileSync(out, JSON.stringify({ text: res, fontReqs }, null, 1));
    console.log(JSON.stringify(fontReqs));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
