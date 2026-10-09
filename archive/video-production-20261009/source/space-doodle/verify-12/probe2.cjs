// verify-12 probe2: own-tag overflow frequency, desktop check, and fix variants injected at runtime (no repo edits)
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const OUT = '/tmp/space-doodle/verify-12';
const URL = process.env.SPACE_URL || 'http://127.0.0.1:5190/';
const TAG = process.env.TAG || 'dev';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const kill = setTimeout(() => { console.log('WATCHDOG'); process.exit(2); }, 285000);
const VARIANTS = {
  reviewer: '.hotspot .label{white-space:normal;overflow:visible;text-overflow:clip;word-break:keep-all;line-height:1.22;padding:4px 4px 3px}',
  clamp2: '.hotspot .label{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;white-space:normal;overflow:hidden;text-overflow:clip;word-break:keep-all;overflow-wrap:anywhere;line-height:1.22;padding:4px 4px 3px}',
  clamp2bal: '.hotspot .label{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;white-space:normal;overflow:hidden;text-overflow:clip;word-break:keep-all;overflow-wrap:anywhere;text-wrap:balance;line-height:1.22;padding:4px 4px 3px}',
};
async function join(page) {
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
  await page.waitForFunction(() => document.querySelector('#loading')?.hidden === true, null, { timeout: 60000 }).catch(() => console.log('loading never hid'));
  await page.evaluate(() => document.fonts.ready);
  await sleep(800);
  if (!(await page.locator('form[data-form="demo-entry"]').count())) await page.locator('button:visible', { hasText: '进入示例现场' }).first().click();
  await page.waitForSelector('form[data-form="demo-entry"]', { timeout: 20000 });
  await page.locator('form[data-form="demo-entry"] input[name=consent]').check();
  await page.waitForSelector('form[data-form="demo-entry"] button[type=submit]:not([disabled])', { timeout: 60000 });
  await page.locator('form[data-form="demo-entry"] button[type=submit]').click();
  await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"]'), null, { timeout: 60000 });
  await page.waitForFunction(() => (window.__SPACE_EVENT_QA__?.()?.members || []).length >= 4, null, { timeout: 30000 }).catch(() => console.log('members never arrived'));
  await sleep(2500);
  await page.evaluate(() => document.fonts.ready);
}
const tagInfo = page => page.evaluate(() => [...document.querySelectorAll('#hotspots .hotspot')].filter(h => !h.hidden).map(h => {
  const lab = h.querySelector('.label'); const lr = lab.getBoundingClientRect(); const hr = h.getBoundingClientRect();
  const rg = document.createRange(); rg.selectNodeContents(lab); const tops = new Set([...rg.getClientRects()].map(r => Math.round(r.top)));
  return { text: lab.textContent, slot: [Math.round(hr.left), Math.round(hr.top), Math.round(hr.width), Math.round(hr.height)], label: [Math.round(lr.left), Math.round(lr.top), Math.round(lr.width), Math.round(lr.height)], lines: tops.size, sw: lab.scrollWidth, cw: lab.clientWidth, sh: lab.scrollHeight, ch: lab.clientHeight };
}));
(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    // phone
    {
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      const page = await ctx.newPage();
      page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 160)));
      await join(page);
      // own-tag overflow frequency over all 访客1000..9999 using an off-screen clone of a real label (same computed styles)
      const freq = await page.evaluate(() => {
        const src = [...document.querySelectorAll('#hotspots .hotspot')].find(h => !h.hidden && h.dataset.kind === 'person');
        const clone = src.cloneNode(true); clone.style.left = '-9999px'; clone.style.top = '0px'; clone.hidden = false; clone.removeAttribute('data-scene-target');
        src.parentNode.append(clone); const lab = clone.querySelector('.label'); let over = 0, n = 0; const bad = [];
        for (let i = 1000; i <= 9999; i++) { lab.textContent = `访客${i} · 我`; n++; if (lab.scrollWidth > lab.clientWidth) { over++; if (bad.length < 8) bad.push(i); } }
        const out = { n, over, sample: bad };
        for (const t of ['阿遥·示例 · 安静', '林间·示例 · 可招呼', '阿遥·示例 · 我', '访客1111 · 我', '访客8888 · 我']) { lab.textContent = t; out[t] = [lab.scrollWidth, lab.clientWidth]; }
        clone.remove(); return out;
      });
      console.log('own-tag overflow over 访客1000-9999 at 390px:', JSON.stringify(freq));
      console.log('phone current', JSON.stringify(await tagInfo(page)));
      // crop of the stage name-tag band
      await page.screenshot({ path: `${OUT}/${TAG}-phone-current-crop.png`, clip: { x: 12, y: 190, width: 366, height: 120 } });
      for (const [name, css] of Object.entries(VARIANTS)) {
        const h = await page.addStyleTag({ content: css });
        await sleep(350);
        console.log(`phone ${name}`, JSON.stringify(await tagInfo(page)));
        await page.screenshot({ path: `${OUT}/${TAG}-phone-${name}-crop.png`, clip: { x: 12, y: 190, width: 366, height: 120 } });
        await page.screenshot({ path: `${OUT}/${TAG}-phone-${name}-full.png` });
        await h.evaluate(n => n.remove());
        await sleep(200);
      }
      await ctx.close();
    }
    // desktop + narrow phone
    for (const [w, hgt, dsf] of [[1440, 900, 1], [360, 780, 2], [320, 640, 2]]) {
      const ctx = await b.newContext({ viewport: { width: w, height: hgt }, deviceScaleFactor: dsf, isMobile: w < 700, hasTouch: w < 700 });
      const page = await ctx.newPage();
      await join(page);
      console.log(`${w}x${hgt} current`, JSON.stringify(await tagInfo(page)));
      await page.screenshot({ path: `${OUT}/${TAG}-${w}x${hgt}-current.png` });
      const h = await page.addStyleTag({ content: VARIANTS.clamp2 });
      await sleep(350);
      console.log(`${w}x${hgt} clamp2`, JSON.stringify(await tagInfo(page)));
      await page.screenshot({ path: `${OUT}/${TAG}-${w}x${hgt}-clamp2.png` });
      await ctx.close();
    }
  } finally { await b.close(); clearTimeout(kill); }
})().catch(e => { console.error(e); process.exit(1); });
