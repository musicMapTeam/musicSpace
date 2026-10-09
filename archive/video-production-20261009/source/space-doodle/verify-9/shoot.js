// verify-9: reproduce the desktop first screen and measure the headline/decoration load
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const OUT = '/tmp/space-doodle/verify-9';
const BASE = process.argv[2] || 'http://127.0.0.1:5190/';
const TAG = process.argv[3] || 'dev';
const sizes = (process.argv[4] || '1440x900').split(',').map(s => { const [w, h] = s.split('x').map(Number); return { width: w, height: h }; });

(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const results = {};
  try {
    for (const vp of sizes) {
      const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(String(e)));
      await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
      await page.evaluate(() => document.fonts.ready);
      // wait for the loading veil to go
      await page.waitForFunction(() => { const l = document.querySelector('#loading'); return !l || l.hidden || getComputedStyle(l).display === 'none' || getComputedStyle(l).opacity === '0' || getComputedStyle(l).visibility === 'hidden'; }, null, { timeout: 60000 }).catch(() => {});
      await page.waitForTimeout(3500);
      const name = `${TAG}-first-${vp.width}x${vp.height}.png`;
      await page.screenshot({ path: `${OUT}/${name}` });
      const data = await page.evaluate(() => {
        const q = s => document.querySelector(s);
        const box = el => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
        const vis = el => { if (!el) return false; const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0 && +cs.opacity > 0; };
        const info = (sel, pseudo) => { const el = q(sel); if (!el) return { sel, missing: true }; const cs = getComputedStyle(el, pseudo || null);
          return { sel: sel + (pseudo || ''), visible: pseudo ? (cs.content !== 'none' && cs.display !== 'none') : vis(el), box: pseudo ? null : box(el), text: pseudo ? cs.content : (el.textContent || '').trim().slice(0, 40),
            font: cs.fontFamily.split(',')[0], size: cs.fontSize, color: cs.color, shadow: cs.textShadow, stroke: cs.webkitTextStrokeWidth, bg: cs.backgroundImage !== 'none' ? cs.backgroundImage.slice(0, 60) : cs.backgroundColor, display: cs.display, transform: cs.transform }; };
        return {
          channel: document.documentElement.dataset.channel || null,
          stage: q('.frame')?.dataset.stage,
          welcome: q('.presence')?.classList.contains('welcome'),
          items: [
            info('header .brand'),
            info('.desktop-caption'),
            info('.desktop-caption .caption-tag'),
            info('.desktop-caption h2'),
            info('.desktop-caption .caption-line--a'),
            info('.desktop-caption .caption-line--b'),
            info('.desktop-caption .caption-key'),
            info('.desktop-caption .caption-line--c'),
            info('.desktop-caption .caption-hl'),
            info('.desktop-caption p'),
            info('.desktop-caption small'),
            info('.desktop-caption .caption-note'),
            info('.desktop-caption .caption-arrow'),
            info('.desktop-caption .caption-star'),
            info('.desktop-caption .caption-sparkle'),
            info('.desktop-caption .caption-squiggle'),
            info('.scene-heading small'),
            info('#room-title'),
            info('.scene-code'),
            info('#presence-title'),
            info('#presence-title', '::after'),
            info('.presence'),
            info('.presence .presence-star'),
            info('.presence .presence-sparkle'),
            info('.track'),
            info('.world-shell'),
          ],
        };
      });
      data.errors = errors;
      results[`${vp.width}x${vp.height}`] = data;
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
  fs.writeFileSync(`${OUT}/${TAG}-measure.json`, JSON.stringify(results, null, 1));
  for (const [k, d] of Object.entries(results)) {
    console.log(`== ${k} channel=${d.channel} stage=${d.stage} welcome=${d.welcome} errors=${d.errors.length}`);
    for (const it of d.items) console.log(JSON.stringify(it));
  }
})().catch(e => { console.error(e); process.exit(1); });
