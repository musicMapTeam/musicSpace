// Checks: boil vs reduced motion, overflow + tag targets at 320/390, render style per query. BASE=.. [PAPER=1] node checks.cjs
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const crypto = require('crypto');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const BASE = process.env.BASE;
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--enable-gpu'] });
  const paper = async ctx => { if (process.env.PAPER) await ctx.addInitScript(() => { const apply = () => document.documentElement?.style.setProperty('--ds-paper', '#f7efdf'); apply(); document.addEventListener('readystatechange', apply); }); };
  // 1. line boil: canvas hashes 330 ms apart (home, desktop), normal vs reduced motion
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion }); await paper(ctx); const page = await ctx.newPage();
    await page.goto(BASE + '#/home'); await page.waitForSelector('canvas.sakura-scene__canvas'); await sleep(3000);
    const hashes = [];
    for (let i = 0; i < 4; i++) { const buf = await page.locator('canvas.sakura-scene__canvas').screenshot(); hashes.push(crypto.createHash('md5').update(buf).digest('hex').slice(0, 6)); await sleep(330); }
    console.log('motion', reducedMotion, hashes.join(' '), 'distinct=' + new Set(hashes).size, 'style=' + await page.evaluate(() => document.querySelector('#sakura-world').dataset.renderStyle));
    await ctx.close();
  }
  // 2. small phones: overflow, tag touch bands and pins, on-screen, errors
  for (const [vp, opts] of [['320x568', { viewport: { width: 320, height: 568 } }], ['390x844', { viewport: { width: 390, height: 844 } }], ['360x860-tall', { viewport: { width: 360, height: 860 } }]]) {
    const ctx = await browser.newContext({ ...opts, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); await paper(ctx); const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(String(e).slice(0, 160))); page.on('console', m => { if (m.type() === 'error' || (m.type() === 'warning' && !m.text().includes('flatShading'))) errs.push(m.text().slice(0, 160)); });
    for (const view of ['home', 'explore', 'records']) {
      await page.goto(BASE + '#/' + view); await page.waitForSelector('canvas.sakura-scene__canvas'); await sleep(3200);
      const r = await page.evaluate(() => {
        const over = document.documentElement.scrollWidth - innerWidth;
        const tags = [...document.querySelectorAll('.world-music-label:not([hidden]),.world-music-link:not([hidden]),.world-pin:not([hidden])')];
        const small = tags.map(t => { const hit = t.querySelector('.world-music-hit') || t; const b = hit.getBoundingClientRect(); const o = t.getBoundingClientRect(); return { w: Math.max(b.width, o.width), h: Math.max(b.height, o.height), name: t.textContent.trim().slice(0, 8) }; }).filter(b => b.h < 43.5 || b.w < 43.5);
        const outside = tags.filter(t => { const b = t.getBoundingClientRect(); return b.left < 0 || b.right > innerWidth || b.top < 0 || b.bottom > innerHeight; }).length;
        return { over, tags: tags.length, small: small.map(s => `${s.name}:${Math.round(s.w)}x${Math.round(s.h)}`), outside, style: document.querySelector('#sakura-world').dataset.renderStyle, shot: document.querySelector('#sakura-world').dataset.shot };
      });
      console.log(vp, view, JSON.stringify(r));
    }
    console.log(vp, 'errors:', errs.length ? errs.join(' | ') : 'none');
    await ctx.close();
  }
  // 3. render style per address
  for (const q of ['', '?doodle=0', '?doodle=off', '?doodle=1']) {
    const ctx = await browser.newContext({ viewport: { width: 800, height: 600 } }); await paper(ctx); const page = await ctx.newPage();
    await page.goto(BASE + q + '#/home'); await page.waitForSelector('canvas.sakura-scene__canvas'); await sleep(1200);
    const r = await page.evaluate(() => ({ style: document.querySelector('#sakura-world').dataset.renderStyle, session: Object.keys(sessionStorage), local: Object.keys(localStorage).filter(k => /doodle/i.test(k)) }));
    console.log('query', q || '(none)', JSON.stringify(r));
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
