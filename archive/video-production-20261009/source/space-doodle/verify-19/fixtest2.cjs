// Inject the proposed CSS (runtime only, no repo edits) and re-measure name tags.
// usage: node fixtest.cjs <base> <w> <h> <label> [wait5]
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const [, , base, W, H, label, mode = ''] = process.argv;
const OUT = '/tmp/space-doodle/verify-19/out'; fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
setTimeout(() => { console.error('watchdog'); process.exit(2); }, 280000).unref();
const FIX = process.env.FIX;
const measure = () => [...document.querySelectorAll('#hotspots .hotspot')].filter(h => !h.hidden).map(h => {
  const l = h.querySelector('.label'), r = l.getBoundingClientRect(), hr = h.getBoundingClientRect();
  const range = document.createRange(); range.selectNodeContents(l);
  const lines = [...range.getClientRects()].reduce((a, q) => { const y = Math.round(q.top); if (!a.includes(y)) a.push(y); return a; }, []).length;
  return { text: l.textContent, lines, labelH: Math.round(r.height), hotspotH: Math.round(hr.height), clientW: l.clientWidth, scrollW: l.scrollWidth,
    cut: l.scrollWidth > l.clientWidth, textW: Math.round(range.getBoundingClientRect().width), fitsHotspot: r.top >= hr.top - 1 && r.bottom <= hr.bottom + 1, box: [r.left, r.top, r.right, r.bottom].map(Math.round) };
});
const overlaps = () => { const rs = [...document.querySelectorAll('#hotspots .hotspot:not([hidden]) .label')].map(l => [l.textContent, l.getBoundingClientRect()]); const out = [];
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) { const a = rs[i][1], b = rs[j][1]; if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) out.push([rs[i][0], rs[j][0]]); } return out; };
(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    const ctx = await b.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
    await page.locator('#join').click();
    await page.waitForSelector('form[data-form="demo-entry"]');
    await page.locator('form[data-form="demo-entry"] input[name=consent]').check();
    await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"] button[type=submit]')?.disabled, null, { timeout: 60000 });
    await page.locator('form[data-form="demo-entry"] button[type=submit]').click();
    await page.waitForSelector(".frame[data-stage='room']", { timeout: 30000 });
    await sleep(2500);
    const close = page.locator('#panel-close'); if (await close.isVisible().catch(() => false)) { await close.click(); await sleep(500); }
    await sleep(2500); await page.evaluate(() => document.fonts.ready);
    if (mode === 'wait5') { await page.waitForFunction(() => [...document.querySelectorAll('#hotspots .hotspot')].length >= 6, null, { timeout: 200000 }).catch(() => console.log('no 5th person yet')); await sleep(2500); }
    // digit-width probe for the own tag: widest/narrowest 4-digit visitor names at the current tag font
    const probe = await page.evaluate(() => { const l = document.querySelector('#hotspots .hotspot .label'); const s = document.createElement('span'); const cs = getComputedStyle(l);
      Object.assign(s.style, { position: 'fixed', left: '-999px', top: '0', whiteSpace: 'nowrap', font: cs.font, letterSpacing: cs.letterSpacing }); document.body.append(s);
      const w = t => { s.textContent = t; return Math.round(s.getBoundingClientRect().width * 10) / 10; };
      const d = {}; for (const c of '0123456789') d[c] = w('访客' + c.repeat(4) + ' · 我'); s.remove(); return { font: cs.fontSize, content: l.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), d }; });
    console.log(label, 'own-tag widths by digit', JSON.stringify(probe));
    console.log(label, 'BEFORE', JSON.stringify(await page.evaluate(measure)));
    await page.screenshot({ path: `${OUT}/${label}-before.png` });
    await page.addStyleTag({ content: FIX }); await sleep(800);
    console.log(label, 'AFTER-FIX', JSON.stringify(await page.evaluate(measure)));

    await page.evaluate(() => { ['一二三四五六七八九十 · 可招呼', 'ThisIsAVeryLongName · 我', '评委老师 · 我'].forEach((t, i) => { const b = document.createElement('button'); b.className = 'hotspot stress'; b.style.cssText = 'left:' + (60 + i * 110) + 'px;top:110px;width:88px'; b.innerHTML = '<span class="dot"></span><span class="label"></span>'; b.querySelector('.label').textContent = t; document.querySelector('#hotspots').append(b); }); });
    await sleep(300);
    console.log(label, 'STRESS', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.hotspot.stress .label')].map(l => { const r = l.getBoundingClientRect(), h = l.parentElement.getBoundingClientRect(); return { t: l.textContent, labelH: Math.round(r.height), sw: l.scrollWidth, cw: l.clientWidth, sh: l.scrollHeight, ch: l.clientHeight, spillsX: l.scrollWidth > l.clientWidth + 1, overHotspot: r.top < h.top - 1 || r.bottom > h.bottom + 1 }; }))));
    await page.screenshot({ path: OUT + '/' + label + '-stress.png' });
    console.log(label, 'overlaps', JSON.stringify(await page.evaluate(overlaps)));
    await page.screenshot({ path: `${OUT}/${label}-fix.png` });
  } catch (e) { console.log('ERR', e.message.split('\n').slice(0, 3).join(' | ')); }
  finally { await b.close(); }
})();
