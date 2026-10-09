// Typing a nickname with a character outside the app's character set: which font slices load?
const {chromium} = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  const ctx = await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 2});
  const page = await ctx.newPage(); const got = [];
  page.on('response', async r => { if (/\.woff2$/.test(r.url())) { let b = 0; try { b = (await r.body()).length; } catch (e) {} got.push([r.url().split('/').pop(), Math.round(b / 1024)]); } });
  await page.goto(process.argv[2], {waitUntil: 'domcontentloaded'});
  await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, {timeout: 60000}); await sleep(1500);
  await page.getByRole('button', {name: '进入示例现场'}).first().click();
  await page.waitForSelector('form[data-form=demo-entry]', {timeout: 15000}); await sleep(1000);
  const inputs = await page.$$eval('form[data-form=demo-entry] input[type=text], form[data-form=demo-entry] input:not([type])', els => els.map(e => ({name: e.name, value: e.value, font: getComputedStyle(e).fontFamily.split(',')[0]})));
  console.log('entry inputs', JSON.stringify(inputs));
  const before = got.length;
  const sel = 'form[data-form=demo-entry] input[name="' + (inputs[0] && inputs[0].name) + '"]';
  await page.fill(sel, '磊鑫');
  await sleep(2500);
  console.log('after typing 磊鑫 (both outside the app set):', JSON.stringify(got.slice(before)));
  await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
