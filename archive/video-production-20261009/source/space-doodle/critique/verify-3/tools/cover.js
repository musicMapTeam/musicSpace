// Independent check: what does the room-stage presence card cover at 1440x900 (tour expanded / collapsed)?
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const OUT = '/tmp/space-doodle/critique/verify-3';
const BASE = process.env.BASE || 'http://127.0.0.1:5190/';
const EXTRA_CSS = process.env.EXTRA_CSS || '';
const TAG = process.env.TAG || 'dev';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: 'zh-CN' });
  const page = await ctx.newPage();
  page.setDefaultTimeout(60000);
  const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready' || String(window.__SPACE_BOOT__ || '').startsWith('failed'), null, { timeout: 120000 });
  console.log('boot', await page.evaluate(() => window.__SPACE_BOOT__));
  if (EXTRA_CSS) await page.addStyleTag({ content: EXTRA_CSS });
  await page.click('#join');
  await page.waitForSelector('form[data-form="demo-entry"]');
  await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"] button[type="submit"]')?.disabled, null, { timeout: 60000 });
  await page.check('form[data-form="demo-entry"] input[name="consent"]');
  await page.click('form[data-form="demo-entry"] button[type="submit"]');
  await page.waitForFunction(() => document.querySelector('.frame')?.dataset.stage === 'room', null, { timeout: 60000 });
  await sleep(6000);
  const measure = () => page.evaluate(() => {
    const R = r => [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)];
    const pres = document.querySelector('.presence');
    const card = pres.getBoundingClientRect();
    const stage = document.querySelector('#hotspots').getBoundingClientRect();
    const tour = document.querySelector('#demo-tour');
    const out = { presenceClass: pres.className, tourExpanded: document.querySelector('[data-tour-toggle]')?.getAttribute('aria-expanded'), card: R(card), cardW: Math.round(card.width), cardH: Math.round(card.height), tour: tour ? R(tour.getBoundingClientRect()) : null, stage: R(stage), hotspots: [] };
    for (const h of document.querySelectorAll('#hotspots .hotspot')) {
      if (h.hidden) continue;
      const lab = h.querySelector('.label');
      const r = lab.getBoundingClientRect(); if (!r.width) continue;
      const ov = Math.max(0, Math.min(r.right, card.right) - Math.max(r.left, card.left)) * Math.max(0, Math.min(r.bottom, card.bottom) - Math.max(r.top, card.top));
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const hit = document.elementFromPoint(cx, cy);
      // anchor the 3D point the tag points at (from the stem vars set by app.js projected())
      const L = parseFloat(h.style.getPropertyValue('--stem-length')) || 0, th = parseFloat(h.style.getPropertyValue('--stem-angle')) || 0;
      const left = parseFloat(h.style.left), top = parseFloat(h.style.top);
      const ax = stage.left + left - L * Math.sin(th), ay = stage.top + top + 22 + L * Math.cos(th);
      const anchorHit = document.elementFromPoint(ax, ay);
      out.hotspots.push({ label: lab.textContent.trim(), kind: h.dataset.kind, labelRect: R(r), coveredPct: Math.round(100 * ov / (r.width * r.height)),
        centerHit: hit ? (h.contains(hit) ? 'self' : `${hit.tagName.toLowerCase()}${hit.id ? '#' + hit.id : ''}.${String(hit.className).split(' ')[0]}`) : null,
        anchor: [Math.round(ax), Math.round(ay)], anchorInCard: ax >= card.left && ax <= card.right && ay >= card.top && ay <= card.bottom,
        anchorHit: anchorHit ? `${anchorHit.tagName.toLowerCase()}${anchorHit.id ? '#' + anchorHit.id : ''}.${String(anchorHit.className).split(' ')[0]}` : null });
    }
    const q = window.__SPACE_EVENT_QA__ && window.__SPACE_EVENT_QA__();
    out.me = q ? q.members.find(m => m.id === q.actorId)?.name : null;
    return out;
  });
  const exp = await measure();
  console.log('EXPANDED', JSON.stringify(exp, null, 1));
  await page.screenshot({ path: `${OUT}/${TAG}-expanded.png` });
  await page.addStyleTag({ content: '.presence{visibility:hidden!important}' }).then(h => h.evaluate(n => n.id = 'hidecard'));
  await sleep(400);
  await page.screenshot({ path: `${OUT}/${TAG}-expanded-cardhidden.png` });
  await page.evaluate(() => document.getElementById('hidecard')?.remove());
  await page.click('[data-tour-toggle]');
  await sleep(1500);
  const col = await measure();
  console.log('COLLAPSED', JSON.stringify(col, null, 1));
  await page.screenshot({ path: `${OUT}/${TAG}-collapsed.png` });
  await page.addStyleTag({ content: '.presence{visibility:hidden!important}' }).then(h => h.evaluate(n => n.id = 'hidecard'));
  await sleep(400);
  await page.screenshot({ path: `${OUT}/${TAG}-collapsed-cardhidden.png` });
  console.log('pageErrors', JSON.stringify(errs));
  await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
