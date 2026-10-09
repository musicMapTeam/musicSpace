// verify-14 probe 2: own-photo path + runtime simulation of candidate fixes (read-only; never touches the repo)
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const URL = process.env.SPACE_URL || 'http://127.0.0.1:5190/';
const OUT = process.env.OUT || '/tmp/space-doodle/verify-14/sim';
fs.mkdirSync(OUT, { recursive: true });
const MODE = process.env.MODE || 'own'; // own | fixA | fixA-own
const KINDS = (process.env.KINDS || 'phone,desktop').split(',');
const VP = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  desktop1920: { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 },
  narrow: { viewport: { width: 320, height: 640 }, deviceScaleFactor: 2 },
};
const PHOTO = process.env.PHOTO || '';
const sleep = ms => new Promise(r => setTimeout(r, ms));
setTimeout(() => { console.log('watchdog'); process.exit(3); }, 270000).unref();

const measure = () => {
  const p = document.querySelector('#panel');
  if (!p || p.hidden) return { panel: 'hidden' };
  const pb = p.getBoundingClientRect(); const cs = getComputedStyle(p);
  const innerTop = pb.top + parseFloat(cs.borderTopWidth), innerBottom = pb.bottom - parseFloat(cs.borderBottomWidth);
  const cb = document.querySelector('#panel-close').getBoundingClientRect();
  const h2 = p.querySelector('#panel-body h2'); const hb = h2 && h2.getBoundingClientRect();
  const view = p.querySelector('.moment-view')?.getBoundingClientRect();
  const taken = p.querySelector('.moment-taken')?.getBoundingClientRect();
  const ai = p.querySelector('.moment-ai, [data-moment-ai], .moment-view .moment-ai-line, .moment-view [role=status]');
  // first element (in the sheet) whose box straddles the top inner edge = "sliced" element
  let sliced = null;
  for (const el of p.querySelectorAll('#panel-body *')) {
    if (!el.getClientRects().length) continue;
    const b = el.getBoundingClientRect();
    if (b.height < 8 || !el.textContent.trim()) continue;
    if (b.top < innerTop - 1 && b.bottom > innerTop + 4 && el.children.length === 0) { sliced = { el: el.tagName.toLowerCase() + '.' + (el.className || ''), text: el.textContent.trim().slice(0, 24), hiddenPx: Math.round(innerTop - b.top), of: Math.round(b.height) }; break; }
  }
  return {
    scrollTop: Math.round(p.scrollTop), clientHeight: p.clientHeight, scrollHeight: p.scrollHeight,
    innerTop: Math.round(innerTop), innerBottom: Math.round(innerBottom),
    closeVisible: cb.bottom > innerTop + 2 && cb.top < innerBottom,
    h2HiddenPx: hb ? Math.max(0, Math.round(innerTop - hb.top)) : null,
    takenTop: taken && Math.round(taken.top), viewTop: view && Math.round(view.top), viewBottom: view && Math.round(view.bottom),
    viewFullyVisible: view ? view.bottom <= innerBottom + 0.5 && view.top >= innerTop - 0.5 : null,
    sliced,
  };
};

async function run(kind) {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const ctx = await browser.newContext(VP[kind]);
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log(kind, '[pageerror]', e.message.slice(0, 160)));
  if (MODE.startsWith('fixA')) {
    await page.addInitScript(m => { window.__V14M = m; }, Number(process.env.MARGIN || 18));
    // Simulate the refined fix in the page only: when the upload module asks to reveal .moment-view, reveal only if it is not
    // already fully in view, and then put the photo block (.moment-taken) at the top with a 24px scroll margin.
    await page.addInitScript(() => {
      const orig = Element.prototype.scrollIntoView;
      Element.prototype.scrollIntoView = function (...a) {
        if (this.classList && this.classList.contains('moment-view')) {
          const p = this.closest('#panel');
          const taken = this.closest('form')?.querySelector('.moment-taken');
          if (p && taken) {
            const pb = p.getBoundingClientRect(); const vb = this.getBoundingClientRect();
            window.__V14SIM = { at: Math.round(performance.now()), needed: vb.bottom > pb.bottom };
            if (vb.bottom <= pb.bottom) return; // already in view: keep the heading and the close
            const margin = Number(window.__V14M || 18);
            taken.style.scrollMarginTop = margin + 'px';
            this.style.scrollMarginTop = '12px';
            // the photo block and the chips fit together: put the photo (with its tape) at the top; otherwise start at the chips
            const fits = (vb.bottom - taken.getBoundingClientRect().top) + margin <= p.clientHeight;
            window.__V14SIM.target = fits ? 'moment-taken' : 'moment-view';
            return orig.call(fits ? taken : this, { block: 'start', inline: 'nearest' });
          }
        }
        return orig.apply(this, a);
      };
    });
  }
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
  await page.waitForFunction(() => document.querySelector('#loading')?.hidden === true, null, { timeout: 60000 }).catch(() => console.log('loading never hid'));
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await sleep(800);
  if (!(await page.locator('form[data-form="demo-entry"]').count())) await page.locator('button:visible', { hasText: '进入示例现场' }).first().click();
  await page.waitForSelector('form[data-form="demo-entry"]', { timeout: 20000 });
  await page.locator('form[data-form="demo-entry"] input[name=consent]').check();
  await page.waitForSelector('form[data-form="demo-entry"] button[type=submit]:not([disabled])', { timeout: 60000 });
  await page.locator('form[data-form="demo-entry"] button[type=submit]').click();
  await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"]'), null, { timeout: 60000 });
  await sleep(2500);
  if (MODE.endsWith('own')) {
    // route card 「用我自己的照片」 -> upload sheet -> 选照片 with a real EXIF photo
    await page.locator('[data-tour-action="open:upload"]:visible').first().click();
    await page.waitForSelector('form[data-form="upload"] input[name=photo]', { state: 'attached', timeout: 20000 });
    await sleep(600);
    console.log(kind, 'before pick', JSON.stringify(await page.evaluate(measure)));
    await page.setInputFiles('form[data-form="upload"] input[name=photo]', PHOTO);
  } else {
    await page.locator('[data-tour-action^="sample:"]:visible', { hasText: '人海' }).first().click();
  }
  await page.waitForSelector('form[data-form="upload"] .photo-review', { timeout: 30000 });
  await sleep(4000);
  const m = await page.evaluate(measure);
  console.log(kind, MODE, JSON.stringify(m), JSON.stringify(await page.evaluate(() => window.__V14SIM || null)));
  await page.screenshot({ path: `${OUT}/${MODE}-m${process.env.MARGIN || 18}-${kind}.png` });
  await ctx.close();
  await browser.close();
}
(async () => { for (const k of KINDS) { try { await run(k); } catch (e) { console.log(k, 'FAILED', e.message.slice(0, 300)); } } process.exit(0); })();
