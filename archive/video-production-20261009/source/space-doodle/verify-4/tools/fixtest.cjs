// verify-4: simulate fixes in-place in the doodle sheet (CSSOM), then measure the room-panel row.
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const VP = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, small: { viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const base = process.argv[2] || 'http://127.0.0.1:5190/';
const vp = process.argv[3] || 'phone';
const variant = process.argv[4] || 'none';
const OUT = '/tmp/space-doodle/verify-4/shots';
const VARIANTS = {
  none: [],
  // reviewer's fix, literally
  reviewer: [
    `.panel .row button:where(:not(.quiet)){font-family:var(--ds-font-ui);font-size:15px;color:var(--ds-ink);background:var(--ds-paper-card);border:var(--ds-line-thin) solid var(--ds-ink);border-radius:var(--ds-radius-btn);box-shadow:4px 4px 0 var(--ds-mint)}`,
    `.panel .row>button{flex:1 1 auto;white-space:nowrap;padding:9px 12px}`,
  ],
  // refined: secondary recipe at the legacy (0,3,0) specificity, content-sized, unbreakable
  refined: [
    `.panel .row .primary{font-size:15px;color:var(--ds-ink);background:var(--ds-paper-card);border:var(--ds-line-thin) solid var(--ds-ink);box-shadow:4px 4px 0 var(--ds-mint);padding:9px 12px}`,
    `.panel .row .primary:active{transform:translate(2px,2px);box-shadow:2px 2px 0 var(--ds-mint)}`,
    `.panel .row>button{flex:1 1 auto;width:auto;margin:0;white-space:nowrap}`,
  ],
  final: [
    `.panel .row .primary{font-size:15px;color:var(--ds-ink);background:var(--ds-paper-card);border:var(--ds-line-thin) solid var(--ds-ink);box-shadow:4px 4px 0 var(--ds-mint);padding:9px 12px;flex:1 1 auto;width:auto;margin:0;white-space:nowrap}`,
    `.panel .row .primary:active{transform:translate(2px,2px);box-shadow:2px 2px 0 var(--ds-mint)}`,
  ],
};
const measure = () => {
  const ink = 'rgb(28, 27, 26)';
  const lines = el => { const r = document.createRange(); r.selectNodeContents(el); const ys = new Set([...r.getClientRects()].filter(x => x.width > 1).map(x => Math.round(x.top))); return ys.size; };
  const desc = b => { const cs = getComputedStyle(b), rc = b.getBoundingClientRect(); return `${b.className || '-'}|${b.innerText.replace(/\s+/g, ' ').trim()}|x=${Math.round(rc.left)} y=${Math.round(rc.top)} w=${Math.round(rc.width)} h=${Math.round(rc.height)} lines=${lines(b)} sw=${b.scrollWidth}/${b.clientWidth} ${cs.fontSize} pad=${cs.padding} m=${cs.margin} bg=${cs.backgroundColor === ink ? 'INK' : cs.backgroundColor} col=${cs.color} bd=${cs.borderTopWidth} ${cs.borderTopColor} sh=${cs.boxShadow}`; };
  return { rows: [...document.querySelectorAll('#panel .row')].map(r => ({ w: Math.round(r.getBoundingClientRect().width), b: [...r.querySelectorAll(':scope > button')].map(desc) })),
    inkBtns: [...document.querySelectorAll('#panel button')].filter(b => b.getClientRects().length && getComputedStyle(b).backgroundColor === ink).map(b => b.innerText.replace(/\s+/g, ' ').trim()) };
};
(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars', '--mute-audio', '--force-color-profile=srgb'] });
  try {
    const ctx = await browser.newContext({ ...VP[vp], locale: 'zh-CN', timezoneId: 'Asia/Shanghai' });
    const page = await ctx.newPage();
    await page.goto(base, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 }); await sleep(2000);
    await page.getByRole('button', { name: /进入示例现场/ }).first().click(); await sleep(1200);
    const consent = page.locator('#panel input[type=checkbox]').first();
    if (await consent.isVisible().catch(() => false)) await consent.check();
    await page.getByRole('button', { name: /进入示例现场/ }).last().click(); await sleep(4500);
    if (variant !== 'none') {
      const r = await page.evaluate(rules => {
        for (const sheet of document.styleSheets) {
          let list; try { list = sheet.cssRules; } catch { continue; }
          for (let i = 0; i < list.length; i++) {
            const rule = list[i];
            if (rule.selectorText && /\.panel \.row \.primary/.test(rule.selectorText) && /^\.primary,/.test(rule.selectorText)) {
              const before = rule.selectorText; rule.selectorText = '.primary, .panel .primary';
              // find the secondary recipe that follows in the same sheet and insert after it
              let at = i + 1; for (let j = i; j < Math.min(list.length, i + 12); j++) if (list[j].selectorText && list[j].selectorText.includes(':not(.primary, .quiet)):active')) { at = j + 1; break; }
              rules.forEach((t, k) => sheet.insertRule(t, at + k));
              return { before, after: rule.selectorText, insertedAt: at, total: list.length };
            }
          }
        }
        return 'rule not found';
      }, VARIANTS[variant]);
      console.log('patch', JSON.stringify(r));
    }
    await page.locator('#room-info').click(); await sleep(1500);
    if (process.argv[5] === 'entryrow') await page.evaluate(() => { const r = document.querySelector('#panel .row'); r.innerHTML = ['我是主办方，开个房|create', '我的现场 / 照片|rooms', '我的创作与邀请|corners'].map(x => { const [l, k] = x.split('|'); return `<button type="button" class="primary" data-open="${k}">${l}</button>`; }).join(''); });
    const m = await page.evaluate(measure);
    console.log(JSON.stringify(m, null, 1));
    const row = page.locator('#panel .row').first();
    await row.scrollIntoViewIfNeeded(); await sleep(300);
    const box = await page.locator('#panel').boundingBox();
    await page.screenshot({ path: `${OUT}/fix-${variant}-${vp}.png`, clip: { x: box.x, y: Math.max(0, box.y), width: box.width, height: Math.min(box.height, VP[vp].viewport.height - Math.max(0, box.y)) } });
    const mh = await page.evaluate(() => [...document.querySelectorAll('#panel .row > button')].map(b => getComputedStyle(b).minHeight + '/' + getComputedStyle(b).lineHeight));
    console.log('minHeight/lineHeight', JSON.stringify(mh));
    await page.locator('#panel-close').click().catch(() => {}); await sleep(600);
    await page.locator('#social-inbox').click(); await sleep(1500);
    console.log('SOCIAL', JSON.stringify((await page.evaluate(measure)).rows, null, 1));
    const r2 = page.locator('#panel .row').last(); if (await r2.count()) { await r2.scrollIntoViewIfNeeded(); await sleep(300); }
    const box2 = await page.locator('#panel').boundingBox();
    await page.screenshot({ path: `${OUT}/fix-${variant}-${vp}-social.png`, clip: { x: box2.x, y: Math.max(0, box2.y), width: box2.width, height: Math.min(box2.height, VP[vp].viewport.height - Math.max(0, box2.y)) } });
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
