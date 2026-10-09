// verify-21 probe 4: candidate fixes served through request interception (the repo is not touched).
//   cam:K       overviewCameraLayout pans the landscape overview K units along the camera's right axis (people move left on screen)
//   css:<name>  extra page CSS
// usage: node probe4.cjs <WxH,...> <variant>
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const OUT = '/tmp/space-doodle/verify-21';
const URL = process.env.SPACE_URL || 'http://127.0.0.1:5190/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const src = fs.readFileSync(`${OUT}/probe.cjs`, 'utf8');
const MEASURE = eval(src.slice(src.indexOf('const MEASURE = ') + 'const MEASURE = '.length, src.indexOf('\n};\n', src.indexOf('const MEASURE = ')) + 2));
const VPS = (process.argv[2] || '1440x900').split(',').map(s => s.split('x').map(Number));
const VARIANT = process.argv[3] || 'cam:2';
const CSS = {
  // desktop: while the note is open it takes the place of the card's own title, text and buttons (what demo.css already does on phones)
  slim: '@media (min-width:801px){.frame[data-stage=room] .presence.demo-tour-open>:not(.demo-tour){display:none}.frame[data-stage=room] .presence.demo-tour-open>.demo-tour:first-child{margin-bottom:0}}',
};
const short = m => ({
  presence: m.presence, tour: m.tour, members: m.members, meTagHit: m.meTagHit, camPos: m.camPos,
  tags: m.tags.map(t => `${t.label}:${t.coveredPct}%@${t.rect[0]}-${t.rect[2]}`),
  avatars: m.avatars.map(a => `${a.name}${a.me ? '(me)' : ''}:${a.coveredPct}%@${a.box[0]}-${a.box[2]}`),
});

async function one(browser, [w, h]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage(); page.setDefaultTimeout(30000);
  const parts = VARIANT.split('+');
  for (const part of parts) {
    if (part.startsWith('cam:')) {
      const K = Number(part.slice(4));
      await page.route(/scene-layout\.js/, async route => {
        const res = await route.fetch(); let body = await res.text();
        const from = ':{position:[-.493*distance,2.15+.20*distance,1+.87004*distance],target:[0,2.15,1]};';
        if (!body.includes(from)) log('PATCH TARGET NOT FOUND');
        body = body.replace(from, `:{position:[-.493*distance+${K}*.87004,2.15+.20*distance,1+.87004*distance+${K}*.493],target:[${K}*.87004,2.15,1+${K}*.493]};`);
        await route.fulfill({ response: res, body, headers: { ...res.headers(), 'content-type': 'application/javascript' } });
      });
    }
  }
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
    for (const part of parts) if (part.startsWith('css:')) await page.addStyleTag({ content: CSS[part.slice(4)] });
    await page.evaluate(() => document.fonts.ready); await sleep(800);
    await page.locator('#join').click();
    await page.waitForSelector('form[data-form="demo-entry"]');
    await page.locator('form[data-form="demo-entry"] input[name=consent]').check();
    await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"] button[type=submit]')?.disabled, null, { timeout: 60000 });
    await page.locator('form[data-form="demo-entry"] button[type=submit]').click();
    await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"]'), null, { timeout: 60000 });
    await sleep(3500);
    const tag = VARIANT.replace(/[:+]/g, '_');
    const a = short(await page.evaluate(MEASURE)); log(`${w}x${h} ${VARIANT} 4p`, JSON.stringify(a));
    await page.screenshot({ path: `${OUT}/try-${tag}-${w}x${h}-4p.png` });
    await page.waitForFunction(() => window.__SPACE_EVENT_QA__().members.length >= 5, null, { timeout: 30000 }).catch(() => {});
    await sleep(2500);
    const b = short(await page.evaluate(MEASURE)); log(`${w}x${h} ${VARIANT} 5p`, JSON.stringify(b));
    await page.screenshot({ path: `${OUT}/try-${tag}-${w}x${h}-5p.png` });
    // collapsed and skipped states with 5 people
    const toggle = page.locator('.demo-tour [data-tour-toggle]');
    if (await toggle.count()) { await toggle.click(); await sleep(800); const c = short(await page.evaluate(MEASURE)); log(`${w}x${h} ${VARIANT} 5p-collapsed`, JSON.stringify(c)); await page.screenshot({ path: `${OUT}/try-${tag}-${w}x${h}-5p-collapsed.png` }); await toggle.click(); await sleep(600); }
    return { a, b };
  } finally { await ctx.close(); }
}
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist', '--hide-scrollbars'] });
  try {
    await Promise.all(VPS.map(vp => one(browser, vp).catch(e => log('ERR', vp.join('x'), e.message.slice(0, 200)))));
  } finally { await browser.close(); }
})();
