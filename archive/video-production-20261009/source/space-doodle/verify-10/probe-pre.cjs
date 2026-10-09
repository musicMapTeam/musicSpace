// verify-10: independent probe of own avatar/tag vs presence card on desktop right after joining
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const OUT = '/tmp/space-doodle/verify-10/pre';
const URL = process.env.SPACE_URL || 'http://127.0.0.1:5190/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const kill = setTimeout(() => { console.log('WATCHDOG'); process.exit(2); }, 270000);
const vps = (process.env.VPS || '1440x900,1280x800,1920x1080').split(',').map(s => s.split('x').map(Number));
async function measure(page) {
  return page.evaluate(() => {
    const R = el => { if (!el) return null; const b = el.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; };
    const card = document.querySelector('.presence');
    const stage = document.querySelector('.world-shell');
    const qa = window.__SPACE_EVENT_QA__?.();
    const me = qa?.actorId;
    const tags = [...document.querySelectorAll('#hotspots .hotspot')].map(h => {
      const r = h.getBoundingClientRect();
      const lab = h.querySelector('.label');
      const lr = lab ? lab.getBoundingClientRect() : r;
      const cx = (lr.left + lr.right) / 2, cy = (lr.top + lr.bottom) / 2;
      const top = document.elementFromPoint(cx, cy);
      const clickable = !!top && (h === top || h.contains(top));
      return { id: h.dataset.sceneTarget, kind: h.dataset.kind, t: h.textContent.trim(), hidden: h.hidden, label: R(lab), clickable, topEl: top ? (top.id || top.className || top.tagName).toString().slice(0, 40) : null, mine: h.dataset.sceneTarget === me };
    });
    return { card: R(card), cardVisible: card && getComputedStyle(card).visibility, tourOpen: card?.classList.contains('demo-tour-open'), stage: R(stage), members: (qa?.members || []).map(m => m.name), me, view: qa?.camera?.view, tags };
  });
}
(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    for (const [w, h] of vps) {
      const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 160)));
      await page.goto(URL, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
      await page.waitForFunction(() => document.querySelector('#loading')?.hidden === true, null, { timeout: 60000 }).catch(() => console.log('loading never hid'));
      await page.evaluate(() => document.fonts.ready);
      await sleep(800);
      if (!(await page.locator('form[data-form="demo-entry"]').count())) await page.locator('button:visible', { hasText: '进入示例现场' }).first().click();
      await page.waitForSelector('form[data-form="demo-entry"]', { timeout: 20000 });
      await page.locator('form[data-form="demo-entry"] input[name=consent]').check();
      await page.waitForSelector('form[data-form="demo-entry"] button[type=submit]:not([disabled])', { timeout: 60000 });
      const t0 = Date.now();
      await page.locator('form[data-form="demo-entry"] button[type=submit]').click();
      await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"]'), null, { timeout: 60000 });
      await page.waitForFunction(() => (window.__SPACE_EVENT_QA__?.()?.members || []).length > 1, null, { timeout: 30000 }).catch(() => console.log('members never arrived'));
      // let the camera settle (950ms move)
      await sleep(1800);
      const m1 = await measure(page);
      console.log(`\n=== ${w}x${h} t+${((Date.now() - t0) / 1000).toFixed(1)}s`, JSON.stringify({ card: m1.card, tourOpen: m1.tourOpen, stage: m1.stage, members: m1.members, view: m1.view }));
      for (const t of m1.tags) console.log('  tag', JSON.stringify(t));
      await page.screenshot({ path: `${OUT}/a-4members-${w}x${h}.png` });
      // wait for the late arrival (5 members)
      const got5 = await page.waitForFunction(() => (window.__SPACE_EVENT_QA__?.()?.members || []).length >= 5, null, { timeout: 40000 }).then(() => true).catch(() => false);
      await sleep(1800);
      const m2 = await measure(page);
      console.log(`--- ${w}x${h} after late arrival (${got5}) t+${((Date.now() - t0) / 1000).toFixed(1)}s`, JSON.stringify({ card: m2.card, tourOpen: m2.tourOpen, members: m2.members, view: m2.view }));
      for (const t of m2.tags) console.log('  tag', JSON.stringify(t));
      await page.screenshot({ path: `${OUT}/b-5members-${w}x${h}.png` });
      await ctx.close();
    }
  } finally { await b.close(); clearTimeout(kill); }
})().catch(e => { console.error(e); process.exit(1); });
