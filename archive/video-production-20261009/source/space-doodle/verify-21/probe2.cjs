// verify-21 probe 2: idle timeline after entering + candidate fixes injected as page styles (no repo edits).
// usage: node probe2.cjs <width> <height> <tag> <mode: idle|fixes>
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const OUT = '/tmp/space-doodle/verify-21';
const URL = process.env.SPACE_URL || 'http://127.0.0.1:5190/';
const [W, H, TAG, MODE] = [Number(process.argv[2] || 1440), Number(process.argv[3] || 900), process.argv[4] || 'w1440', process.argv[5] || 'idle'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const src = fs.readFileSync(`${OUT}/probe.cjs`, 'utf8');
// reuse MEASURE from probe.cjs
const MEASURE = eval(src.slice(src.indexOf('const MEASURE = ') + 'const MEASURE = '.length, src.indexOf('\n};\n', src.indexOf('const MEASURE = ')) + 2));

const short = m => ({
  presence: m.presence, cls: m.presenceClass, tour: m.tour, step: m.tourTitle, members: m.members, cam: m.camView, camPos: m.camPos, meTagHit: m.meTagHit,
  tags: m.tags.filter(t => t.coveredPct > 0 || /我/.test(t.label)).map(t => `${t.label}:${t.coveredPct}%@${t.rect.join(',')}`),
  avatars: m.avatars.map(a => `${a.name}${a.me ? '(me)' : ''}:${a.coveredPct}%@${a.box.join(',')}`),
});
async function enter(page) {
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
  await page.evaluate(() => document.fonts.ready); await sleep(800);
  await page.locator('#join').click();
  await page.waitForSelector('form[data-form="demo-entry"]');
  await page.locator('form[data-form="demo-entry"] input[name=consent]').check();
  await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"] button[type=submit]')?.disabled, null, { timeout: 60000 });
  await page.locator('form[data-form="demo-entry"] button[type=submit]').click();
  await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"]'), null, { timeout: 60000 });
  return Date.now();
}

const FIXES = {
  // the reviewer's proposal
  A_340_r28: '@media (min-width:1100px){.frame[data-stage=room] .presence.demo-tour-open{max-width:340px;right:28px}}',
  // same width, keep the card inside the window's right edge
  B_340_r60: '@media (min-width:1100px){.frame[data-stage=room] .presence.demo-tour-open{max-width:340px}}',
  // pre-restyle geometry (~332px wide, right edge ~1380)
  C_332_r60: '@media (min-width:1100px){.frame[data-stage=room] .presence.demo-tour-open{max-width:332px}}',
  // narrow for every room state (open, collapsed, skipped)
  D_all_340_r40: '@media (min-width:1100px){.frame[data-stage=room] .presence:not(.welcome){max-width:340px;right:40px}}',
};

(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist', '--hide-scrollbars'] });
  const out = {};
  try {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.setDefaultTimeout(30000);
    page.on('pageerror', e => log('[pageerror]', e.message.slice(0, 160)));
    const t0 = await enter(page);
    if (MODE === 'idle') {
      out.timeline = [];
      for (let i = 0; i < 13; i++) {
        await sleep(2000);
        const m = await page.evaluate(MEASURE);
        const s = { t: Math.round((Date.now() - t0) / 1000), ...short(m) };
        out.timeline.push(s); log(JSON.stringify(s));
        if (i === 1) await page.screenshot({ path: `${OUT}/${TAG}-idle-${s.t}s.png` });
      }
      await page.screenshot({ path: `${OUT}/${TAG}-idle-end.png` });
    } else {
      await sleep(2500);
      out.base = short(await page.evaluate(MEASURE)); log('base', JSON.stringify(out.base));
      await page.screenshot({ path: `${OUT}/${TAG}-fix-base.png` });
      for (const [name, css] of Object.entries(FIXES)) {
        const h = await page.addStyleTag({ content: css }); await sleep(500);
        const m = await page.evaluate(MEASURE);
        const tourBtns = await page.evaluate(() => [...document.querySelectorAll('.demo-tour button, .presence-actions button')].filter(b => b.getClientRects().length).map(b => { const r = b.getBoundingClientRect(); const lh = parseFloat(getComputedStyle(b).lineHeight) || 20; return `${b.textContent.trim()}:${Math.round(r.width)}x${Math.round(r.height)}${b.scrollWidth > b.clientWidth + 1 ? ' OVERFLOW' : ''}`; }));
        out[name] = { ...short(m), tourBtns }; log(name, JSON.stringify(out[name]));
        await page.screenshot({ path: `${OUT}/${TAG}-fix-${name}.png` });
        await h.evaluate(n => n.remove()); await sleep(300);
      }
    }
    fs.writeFileSync(`${OUT}/${TAG}-${MODE}.json`, JSON.stringify(out, null, 1));
    await ctx.close();
  } catch (e) { log('ERROR', e.stack.slice(0, 400)); }
  finally { await browser.close(); }
})();
