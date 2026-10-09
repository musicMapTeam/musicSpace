// Try candidate CSS fixes (injected at runtime, no repo edits) and measure what the room card covers at 1440x900.
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const OUT = '/tmp/space-doodle/critique/verify-3';
const BASE = process.env.BASE || 'http://127.0.0.1:5190/';
const VARIANTS = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const only = process.argv[3] ? process.argv[3].split(',') : null;
const AVATAR = [993, 385, 1055, 620], WALL = [915, 205, 1005, 415];
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function run(browser, name, css, vp) {
  const m = /^(\d+)x(\d+)$/.exec(vp);
  const ctx = await browser.newContext(vp === 'phone' ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'zh-CN' } : m ? { viewport: { width: +m[1], height: +m[2] }, deviceScaleFactor: 1, locale: 'zh-CN' } : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: 'zh-CN' });
  const page = await ctx.newPage();
  page.setDefaultTimeout(60000);
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 120000 });
  if (css) await page.addStyleTag({ content: css });
  const click = async sel => (vp === 'phone' ? page.tap(sel) : page.click(sel));
  await click('#join');
  await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"] button[type="submit"]')?.disabled, null, { timeout: 60000 });
  await page.check('form[data-form="demo-entry"] input[name="consent"]');
  await click('form[data-form="demo-entry"] button[type="submit"]');
  await page.waitForFunction(() => document.querySelector('.frame')?.dataset.stage === 'room', null, { timeout: 60000 });
  await sleep(5500);
  const measure = () => page.evaluate(([AVATAR, WALL]) => {
    const R = r => [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)];
    const pres = document.querySelector('.presence'), card = pres.getBoundingClientRect();
    const ovl = (b, c) => Math.max(0, Math.min(b[2], c.right) - Math.max(b[0], c.left)) * Math.max(0, Math.min(b[3], c.bottom) - Math.max(b[1], c.top)) / ((b[2] - b[0]) * (b[3] - b[1]));
    const tags = {};
    for (const h of document.querySelectorAll('#hotspots .hotspot')) {
      if (h.hidden) continue; const r = h.querySelector('.label').getBoundingClientRect(); if (!r.width) continue;
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      tags[h.querySelector('.label').textContent.trim()] = { cov: Math.round(100 * ovl([r.left, r.top, r.right, r.bottom], card)), hit: h.contains(hit) ? 'self' : (hit ? hit.tagName.toLowerCase() + '.' + String(hit.className).split(' ')[0] : null) };
    }
    // small text / short targets inside the card
    const small = [], short = [], overflow = [];
    for (const el of pres.querySelectorAll('*')) {
      const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
      const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
      if (own && parseFloat(cs.fontSize) < 13) small.push(el.textContent.trim().slice(0, 12) + ':' + cs.fontSize);
      if (el.tagName === 'BUTTON' && (r.height < 44 || r.width < 44)) short.push(el.textContent.trim().slice(0, 12) + ':' + Math.round(r.width) + 'x' + Math.round(r.height));
      if (el.scrollWidth > el.clientWidth + 1 && cs.overflowX !== 'visible') overflow.push(el.className || el.tagName);
    }
    const btns = [...pres.querySelectorAll('button')].filter(b => b.getBoundingClientRect().height && getComputedStyle(b).visibility !== 'hidden').map(b => b.textContent.trim().slice(0, 10) + ':' + Math.round(b.getBoundingClientRect().height));
    return { cls: pres.className, card: R(card), w: Math.round(card.width), h: Math.round(card.height), avatarCov: Math.round(100 * ovl(AVATAR, card)), wallCov: Math.round(100 * ovl(WALL, card)), tags, small, short, overflow, btns,
      inWindow: card.top >= document.querySelector('.world-shell').getBoundingClientRect().top };
  }, [AVATAR, WALL]);
  const exp = await measure();
  await page.screenshot({ path: `${OUT}/v-${name}-${vp}-expanded.png` });
  { const tg = Object.entries(exp.tags).filter(([l]) => /照片墙|我/.test(l)).map(([l, v]) => `${l}=${v.cov}%(${v.hit})`).join(' '); console.log(`  [pre] ${name} ${vp} exp: card=${exp.card} ${exp.w}x${exp.h} ${tg}`); }
  await page.waitForTimeout(10);
  { const hit = await page.evaluate(() => { const t = document.querySelector('[data-tour-toggle]'), r = t.getBoundingClientRect(), h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return t.contains(h) ? 'self' : (h ? h.tagName.toLowerCase() + '#' + h.id : null); }); console.log(`  [pre] toggleHit=${hit}`); }
  await page.evaluate(() => document.querySelector('[data-tour-toggle]').click());
  await sleep(1200);
  const col = await measure();
  await page.screenshot({ path: `${OUT}/v-${name}-${vp}-collapsed.png` });
  await ctx.close();
  return { exp, col };
}
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  for (const [name, spec] of Object.entries(VARIANTS)) {
    if (only && !only.includes(name)) continue;
    for (const vp of spec.vps || ['desktop']) {
      try {
        const r = await run(browser, name, spec.css, vp);
        for (const k of ['exp', 'col']) {
          const m = r[k];
          const tg = Object.entries(m.tags).filter(([l]) => /照片墙|我/.test(l)).map(([l, v]) => `${l}=${v.cov}%(${v.hit})`).join(' ');
          console.log(`${name} ${vp} ${k}: card=${m.card} ${m.w}x${m.h} avatar=${m.avatarCov}% wall=${m.wallCov}% ${tg} | btns ${m.btns.join(', ')} | small ${m.small.join(',') || '-'} | short ${m.short.join(',') || '-'} | overflow ${m.overflow.join(',') || '-'}`);
        }
      } catch (e) { console.log(name, vp, 'FAIL', String(e).slice(0, 300)); }
    }
  }
  await browser.close();
})();
