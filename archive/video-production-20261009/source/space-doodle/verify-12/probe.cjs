// verify-12: independent probe of the overview name tags (ellipsis claim)
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const OUT = '/tmp/space-doodle/verify-12';
const URL = process.env.SPACE_URL || 'http://127.0.0.1:5190/';
const TAG = process.env.TAG || 'dev';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const kill = setTimeout(() => { console.log('WATCHDOG'); process.exit(2); }, 280000);
const vps = (process.env.VPS || '390x844x2').split(',').map(s => s.split('x').map(Number));
async function measure(page) {
  return page.evaluate(() => {
    const qa = window.__SPACE_EVENT_QA__?.();
    const me = qa?.actorId;
    const fontOK = document.fonts.check('12px "Doodle Marker"', '阿遥示例可招呼安静我访客');
    const tags = [...document.querySelectorAll('#hotspots .hotspot')].map(h => {
      const lab = h.querySelector('.label'); const cs = getComputedStyle(lab); const hs = getComputedStyle(h);
      const hr = h.getBoundingClientRect(), lr = lab.getBoundingClientRect();
      return { kind: h.dataset.kind, mine: h.dataset.sceneTarget === me, hidden: h.hidden, text: lab.textContent,
        hotspot: [Math.round(hr.left), Math.round(hr.top), Math.round(hr.width), Math.round(hr.height)],
        label: [Math.round(lr.left), Math.round(lr.top), Math.round(lr.width), Math.round(lr.height)],
        client: lab.clientWidth, scroll: lab.scrollWidth, truncated: lab.scrollWidth > lab.clientWidth,
        css: { ws: cs.whiteSpace, ov: cs.overflowX, to: cs.textOverflow, ff: cs.fontFamily.slice(0, 40), fs: cs.fontSize, lh: cs.lineHeight, pad: cs.padding, bw: cs.borderLeftWidth, disp: cs.display, hsH: hs.height, hsDisp: hs.display, hsAlign: hs.alignItems } };
    });
    return { fontOK, members: (qa?.members || []).map(m => m.name + '|' + (m.participation || '')), me, view: qa?.camera?.view, tags };
  });
}
(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    for (const [w, h, dsf] of vps) {
      const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf || 1, isMobile: w < 700, hasTouch: w < 700 });
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
      await sleep(2200);
      await page.evaluate(() => document.fonts.ready);
      const m1 = await measure(page);
      console.log(`\n=== ${TAG} ${w}x${h} t+${((Date.now() - t0) / 1000).toFixed(1)}s`, JSON.stringify({ fontOK: m1.fontOK, members: m1.members, view: m1.view }));
      for (const t of m1.tags) console.log('  tag', JSON.stringify(t));
      await page.screenshot({ path: `${OUT}/${TAG}-a-${w}x${h}.png` });
      const got5 = await page.waitForFunction(() => (window.__SPACE_EVENT_QA__?.()?.members || []).length >= 5, null, { timeout: 40000 }).then(() => true).catch(() => false);
      await sleep(2200);
      const m2 = await measure(page);
      console.log(`--- ${TAG} ${w}x${h} later (${got5}) t+${((Date.now() - t0) / 1000).toFixed(1)}s`, JSON.stringify({ fontOK: m2.fontOK, members: m2.members, view: m2.view }));
      for (const t of m2.tags) console.log('  tag', JSON.stringify(t));
      await page.screenshot({ path: `${OUT}/${TAG}-b-${w}x${h}.png` });
      if (process.env.FIX) {
        await page.addStyleTag({ content: process.env.FIX });
        await sleep(400);
        const m3 = await measure(page);
        console.log(`+++ ${TAG} ${w}x${h} with FIX`);
        for (const t of m3.tags) console.log('  tag', JSON.stringify({ text: t.text, label: t.label, client: t.client, scroll: t.scroll, truncated: t.truncated, hotspot: t.hotspot }));
        await page.screenshot({ path: `${OUT}/${TAG}-c-fix-${w}x${h}.png` });
      }
      await ctx.close();
    }
  } finally { await b.close(); clearTimeout(kill); }
})().catch(e => { console.error(e); process.exit(1); });
