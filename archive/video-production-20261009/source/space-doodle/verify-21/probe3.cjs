// verify-21 probe 3: several desktop viewports, measured ~3 s after entering (4 people) and after 林间 arrives (5 people).
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const OUT = '/tmp/space-doodle/verify-21';
const URL = process.env.SPACE_URL || 'http://127.0.0.1:5190/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const src = fs.readFileSync(`${OUT}/probe.cjs`, 'utf8');
const MEASURE = eval(src.slice(src.indexOf('const MEASURE = ') + 'const MEASURE = '.length, src.indexOf('\n};\n', src.indexOf('const MEASURE = ')) + 2));
const short = m => ({
  presence: m.presence, tour: m.tour, members: m.members, meTagHit: m.meTagHit, world: m.world,
  tags: m.tags.filter(t => t.coveredPct > 0 || /我/.test(t.label)).map(t => `${t.label}:${t.coveredPct}%`),
  avatars: m.avatars.filter(a => a.coveredPct > 0 || a.me).map(a => `${a.name}${a.me ? '(me)' : ''}:${a.coveredPct}%@${a.box[0]}-${a.box[2]}`),
});
const VPS = (process.argv[2] || '1280x720,1440x790,1512x862,1536x730,1920x970').split(',').map(s => s.split('x').map(Number));

async function one(browser, [w, h]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage(); page.setDefaultTimeout(30000);
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
    await page.evaluate(() => document.fonts.ready); await sleep(800);
    await page.locator('#join').click();
    await page.waitForSelector('form[data-form="demo-entry"]');
    await page.locator('form[data-form="demo-entry"] input[name=consent]').check();
    await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"] button[type=submit]')?.disabled, null, { timeout: 60000 });
    await page.locator('form[data-form="demo-entry"] button[type=submit]').click();
    await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"]'), null, { timeout: 60000 });
    await sleep(3500);
    const a = short(await page.evaluate(MEASURE)); log(`${w}x${h} 4p`, JSON.stringify(a));
    await page.screenshot({ path: `${OUT}/vp-${w}x${h}-4p.png` });
    await page.waitForFunction(() => window.__SPACE_EVENT_QA__().members.length >= 5, null, { timeout: 30000 }).catch(() => {});
    await sleep(2500);
    const b = short(await page.evaluate(MEASURE)); log(`${w}x${h} 5p`, JSON.stringify(b));
    await page.screenshot({ path: `${OUT}/vp-${w}x${h}-5p.png` });
    return { a, b };
  } finally { await ctx.close(); }
}
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist', '--hide-scrollbars'] });
  const out = {};
  try {
    const res = await Promise.all(VPS.map(vp => one(browser, vp).catch(e => ({ error: e.message.slice(0, 200) }))));
    VPS.forEach((vp, i) => { out[vp.join('x')] = res[i]; });
    fs.writeFileSync(`${OUT}/viewports.json`, JSON.stringify(out, null, 1));
  } catch (e) { log('ERROR', e.message); } finally { await browser.close(); }
})();
