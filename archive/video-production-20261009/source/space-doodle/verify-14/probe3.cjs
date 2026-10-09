// verify-14 probe 3: geometry between the sample row and the photo block (read-only)
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const URL = process.env.SPACE_URL || 'http://127.0.0.1:5190/';
const VP = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  narrow: { viewport: { width: 320, height: 640 }, deviceScaleFactor: 2 },
  desktop1920: { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 },
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
setTimeout(() => { console.log('watchdog'); process.exit(3); }, 270000).unref();
async function run(kind) {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const ctx = await browser.newContext(VP[kind]);
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
  await page.waitForFunction(() => document.querySelector('#loading')?.hidden === true, null, { timeout: 60000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await sleep(800);
  if (!(await page.locator('form[data-form="demo-entry"]').count())) await page.locator('button:visible', { hasText: '进入示例现场' }).first().click();
  await page.waitForSelector('form[data-form="demo-entry"]', { timeout: 20000 });
  await page.locator('form[data-form="demo-entry"] input[name=consent]').check();
  await page.waitForSelector('form[data-form="demo-entry"] button[type=submit]:not([disabled])', { timeout: 60000 });
  await page.locator('form[data-form="demo-entry"] button[type=submit]').click();
  await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"]'), null, { timeout: 60000 });
  await sleep(2500);
  await page.locator('[data-tour-action^="sample:"]:visible', { hasText: '人海' }).first().click();
  await page.waitForSelector('form[data-form="upload"] .photo-review', { timeout: 30000 });
  await sleep(3500);
  const g = await page.evaluate(() => {
    const p = document.querySelector('#panel');
    const asis = p.scrollTop;
    p.scrollTop = 0;
    const r = el => { const b = el.getBoundingClientRect(); return [Math.round(b.top), Math.round(b.bottom)]; };
    const taken = p.querySelector('.moment-taken');
    const samples = p.querySelector('.moment-samples');
    const sampleBtns = [...p.querySelectorAll('.moment-samples button, .moment-samples [data-sample-photo], .moment-samples__list > *')];
    const shadowExtent = el => { const s = getComputedStyle(el).boxShadow; const m = s.match(/(-?\d+(?:\.\d+)?)px (-?\d+(?:\.\d+)?)px 0px/); return m ? Number(m[2]) : 0; };
    let samplesVisualBottom = samples ? samples.getBoundingClientRect().bottom : null;
    for (const b of sampleBtns) { const bb = b.getBoundingClientRect(); const tr = getComputedStyle(b).transform; samplesVisualBottom = Math.max(samplesVisualBottom, bb.bottom + shadowExtent(b)); }
    // highest decoration inside the photo block (pseudo-element tapes are not measurable directly: read their computed top/transform)
    const pseudo = [];
    for (const el of [taken, ...taken.querySelectorAll('*')]) for (const which of ['::before', '::after']) {
      const cs = getComputedStyle(el, which);
      if (cs.content && cs.content !== 'none' && cs.position === 'absolute') pseudo.push({ el: el.className || el.tagName, which, top: cs.top, height: cs.height, transform: cs.transform, elTop: Math.round(el.getBoundingClientRect().top) });
    }
    const out = {
      asis, takenTop: r(taken)[0], samples: samples && r(samples), samplesVisualBottom: Math.round(samplesVisualBottom),
      gapSamplesToTaken: Math.round(taken.getBoundingClientRect().top - samplesVisualBottom),
      fileChoice: r(p.querySelector('.file-choice')), h2: r(p.querySelector('#panel-body h2')),
      pseudo, panelTop: Math.round(p.getBoundingClientRect().top), border: getComputedStyle(p).borderTopWidth, paddingTop: getComputedStyle(p).paddingTop,
      viewBottom: Math.round(p.querySelector('.moment-view').getBoundingClientRect().bottom), panelBottom: Math.round(p.getBoundingClientRect().bottom),
    };
    p.scrollTop = asis;
    return out;
  });
  console.log(kind, JSON.stringify(g));
  await ctx.close(); await browser.close();
}
(async () => { for (const k of (process.env.KINDS || 'phone,desktop,narrow,desktop1920').split(',')) { try { await run(k); } catch (e) { console.log(k, 'FAILED', e.message.slice(0, 300)); } } process.exit(0); })();
