// 320 px overflow probe on the production build: the sheets whose copy changed most (entry + host details, About, room panel, recap end,
// community list, upload with the hint). Reports elements that stick out of the viewport or scroll sideways, and buttons whose label wraps
// mid-word (more than one line for a short label).
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const BASE = process.argv[2] || 'http://127.0.0.1:5471/musicSpace/';
const OUT = '/tmp/space-copy/ci-work/shots/w320';
fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const t = setTimeout(() => { console.log('WATCHDOG'); process.exit(3); }, 270000); t.unref();
const clickHidden = (page, dataset) => page.evaluate(dataset => { const o = document.createElement('button'); Object.assign(o.dataset, dataset); o.style.position = 'fixed'; o.style.left = '-9999px'; document.body.append(o); o.click(); o.remove(); }, dataset);
function probe(page, label) {
  return page.evaluate(label => {
    const vw = document.documentElement.clientWidth, out = [];
    if (document.documentElement.scrollWidth > vw + 1) out.push(`page scrollWidth ${document.documentElement.scrollWidth} > ${vw}`);
    for (const el of document.querySelectorAll('body *')) {
      if (!el.getClientRects().length) continue;
      const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.position === 'fixed' && !el.closest('#panel,.community-panel,.photo-exchanges,.private-chat')) continue;
      if (el.closest('svg,canvas,.sr-only') || cs.clipPath === 'inset(50%)') continue;
      const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
      const name = `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : ''}`;
      if (r.right > vw + 1 || r.left < -1) out.push(`sticks out: ${name} ${Math.round(r.left)}..${Math.round(r.right)} «${(el.textContent || '').trim().slice(0, 24)}»`);
      if (el.scrollWidth > el.clientWidth + 1 && ['auto', 'scroll', 'hidden'].includes(cs.overflowX) && el.clientWidth > 0 && !['svg','canvas'].includes(el.tagName.toLowerCase())) out.push(`scrolls: ${name} ${el.scrollWidth}>${el.clientWidth} «${(el.textContent || '').trim().slice(0, 24)}»`);
    }
    // short button labels that wrap
    const wraps = [];
    for (const b of document.querySelectorAll('#panel button, #panel summary, .community-panel button, .demo-tour button')) {
      if (!b.getClientRects().length) continue;
      const text = b.innerText.trim(); if (!text || text.length > 22) continue;
      const lh = parseFloat(getComputedStyle(b).lineHeight) || 20; const lines = Math.round((b.getBoundingClientRect().height - parseFloat(getComputedStyle(b).paddingTop) - parseFloat(getComputedStyle(b).paddingBottom)) / lh);
      if (lines > 1) wraps.push(`${text} (${lines} lines)`);
    }
    return { label, issues: [...new Set(out)].slice(0, 12), wraps };
  }, label);
}
(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    const ctx = await b.newContext({ viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'zh-CN' });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 120000 });
    await page.waitForFunction(() => document.querySelector('#loading')?.hidden === true, null, { timeout: 60000 }).catch(() => {});
    await page.evaluate(() => document.fonts.ready); await sleep(800);
    console.log(JSON.stringify(await probe(page, 'lobby')));
    await page.locator('#join').tap(); await page.waitForSelector('form[data-form="demo-entry"]'); await sleep(600);
    await page.evaluate(() => { const d = document.querySelector('#panel details.demo-entry-more'); d.open = true; const p = document.querySelector('#panel'); p.scrollTop = p.scrollHeight; });
    await sleep(400); console.log(JSON.stringify(await probe(page, 'entry+host'))); await page.screenshot({ path: `${OUT}/entry-host.png` });
    await clickHidden(page, { open: 'about' }); await sleep(800);
    await page.evaluate(() => { const p = document.querySelector('#panel'); p.scrollTop = p.scrollHeight; }); await sleep(300);
    console.log(JSON.stringify(await probe(page, 'about'))); await page.screenshot({ path: `${OUT}/about-end.png` });
    await page.locator('#panel-close').tap(); await sleep(500);
    await page.locator('#join').tap(); await page.waitForSelector('form[data-form="demo-entry"]');
    await page.check('form[data-form="demo-entry"] input[name="consent"]', { force: true });
    await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"] button[type="submit"]')?.disabled, null, { timeout: 90000 });
    await page.locator('form[data-form="demo-entry"] button[type="submit"]').tap();
    await page.waitForSelector('[data-tour-action="sample:sample-crowd"]', { timeout: 60000 }); await sleep(1000);
    console.log(JSON.stringify(await probe(page, 'room+tour'))); await page.screenshot({ path: `${OUT}/room-tour.png` });
    await page.locator('[data-tour-action="sample:sample-crowd"]').tap();
    await page.waitForSelector('form[data-form="upload"] .photo-review'); await sleep(2500);
    await page.evaluate(() => { const p = document.querySelector('#panel'); p.scrollTop = p.scrollHeight; }); await sleep(300);
    console.log(JSON.stringify(await probe(page, 'upload'))); await page.screenshot({ path: `${OUT}/upload-end.png` });
    await page.locator('#panel-close').tap(); await sleep(500);
    await page.locator('#room-info').tap(); await sleep(900);
    console.log(JSON.stringify(await probe(page, 'room-panel'))); await page.screenshot({ path: `${OUT}/room-panel.png` });
    await clickHidden(page, { open: 'recap' }); await sleep(2200);
    await page.evaluate(() => { const p = document.querySelector('#panel'); p.scrollTop = p.scrollHeight; }); await sleep(300);
    console.log(JSON.stringify(await probe(page, 'recap-end'))); await page.screenshot({ path: `${OUT}/recap-end.png` });
    await page.locator('#panel-close').tap().catch(() => {}); await sleep(500);
    await clickHidden(page, { open: 'communities' }); await sleep(2200);
    console.log(JSON.stringify(await probe(page, 'communities'))); await page.screenshot({ path: `${OUT}/communities.png` });
    await page.evaluate(() => { const s = document.querySelector('.community-panel:not([hidden]) .community-scroll'); if (s) s.scrollTop = s.scrollHeight; }); await sleep(300); await page.screenshot({ path: `${OUT}/communities-end.png` });
    console.log('errors', JSON.stringify(errs));
  } finally { await b.close(); }
})().catch(e => { console.error('FAILED', e.message.split('\n')[0]); process.exit(1); });
