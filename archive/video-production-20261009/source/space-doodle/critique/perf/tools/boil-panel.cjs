// Does the doodle boil keep running while a full panel covers the 3D canvas (phone)? Counts boil callbacks over 3 s.
const {chromium} = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  const ctx = await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 3});
  await ctx.addInitScript(() => { const st = window.setTimeout.bind(window); window.__boils = 0; window.setTimeout = (cb, ms, ...r) => (typeof cb === 'function' && Math.abs((ms || 0) - 1000 / 7) < 1) ? st((...a) => { window.__boils++; return cb(...a); }, ms, ...r) : st(cb, ms, ...r); });
  const page = await ctx.newPage();
  await page.goto(process.argv[2], {waitUntil: 'domcontentloaded'});
  await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, {timeout: 60000});
  await sleep(1500);
  const count = async label => { const a = await page.evaluate(() => window.__boils); await sleep(3000); const b = await page.evaluate(() => window.__boils); const vis = await page.evaluate(() => { const c = document.querySelector('#world canvas'); if (!c) return 'no canvas'; const r = c.getBoundingClientRect(); const p = document.querySelector('#panel'); const pr = p && !p.hidden ? p.getBoundingClientRect() : null; return {canvas: [Math.round(r.top), Math.round(r.bottom)], panel: pr ? [Math.round(pr.top), Math.round(pr.bottom)] : null}; }); console.log(label.padEnd(28), 'boils/3s', b - a, JSON.stringify(vis)); };
  await count('lobby (canvas visible)');
  await page.getByRole('button', {name: '进入示例现场'}).first().click();
  await page.waitForSelector('form[data-form=demo-entry]', {timeout: 15000});
  await count('entry panel open');
  await page.check('form[data-form=demo-entry] input[name=consent]');
  await page.waitForSelector('form[data-form=demo-entry] button[type=submit]:not([disabled])', {timeout: 30000});
  await page.click('form[data-form=demo-entry] button[type=submit]');
  await sleep(4000);
  await page.click('#my-space').catch(e => console.log('my-space', e.message.split('\n')[0]));
  await sleep(1500);
  await count('my space panel open');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
