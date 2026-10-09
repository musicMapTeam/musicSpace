// Shell screenshots: node shots.js <prefix> [phone|desktop|both] [base]
const {chromium} = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const prefix = process.argv[2] || 'after';
const which = process.argv[3] || 'both';
const BASE = process.argv[4] || 'http://127.0.0.1:5190/';
const OUT = '/tmp/space-doodle/shots/shell';
const VIEWS = {phone: {width: 390, height: 844, deviceScaleFactor: 2}, desktop: {width: 1440, height: 900, deviceScaleFactor: 1}, narrow: {width: 320, height: 640, deviceScaleFactor: 2}};
const wait = ms => new Promise(r => setTimeout(r, ms));
async function boot(page) {
  await page.goto(BASE, {waitUntil: 'domcontentloaded'});
  await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, {timeout: 60000});
  await page.waitForFunction(() => document.querySelector('#loading')?.hidden !== false || getComputedStyle(document.querySelector('#loading')).display === 'none', null, {timeout: 30000}).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await wait(1800);
}
async function run(name) {
  const browser = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']});
  const ctx = await browser.newContext({viewport: {width: VIEWS[name].width, height: VIEWS[name].height}, deviceScaleFactor: VIEWS[name].deviceScaleFactor, locale: 'zh-CN', reducedMotion: 'no-preference'});
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await boot(page);
  const shot = async label => { await page.screenshot({path: `${OUT}/${prefix}-${label}-${name}.png`}); console.log('saved', `${prefix}-${label}-${name}.png`); };
  await shot('first');
  await page.click('#join');
  await page.waitForSelector('#panel:not([hidden]) form[data-form="demo-entry"]', {timeout: 15000});
  await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"] button.primary')?.disabled, null, {timeout: 30000}).catch(() => console.log('entry still preparing'));
  await wait(700);
  await shot('join');
  // scrolled join panel (bottom of the form)
  await page.evaluate(() => { const p = document.querySelector('#panel'); p.scrollTop = p.scrollHeight; });
  await wait(300);
  await shot('join-bottom');
  await page.evaluate(() => { const p = document.querySelector('#panel'); p.scrollTop = 0; });
  await page.check('form[data-form="demo-entry"] input[name="consent"]');
  await page.click('form[data-form="demo-entry"] button.primary');
  await page.waitForFunction(() => document.querySelector('.frame')?.dataset.stage === 'room', null, {timeout: 30000});
  await wait(3500);
  await shot('room');
  const toastVisible = await page.evaluate(() => document.querySelector('#toast')?.classList.contains('visible'));
  if (!toastVisible) await page.evaluate(() => { const n = document.querySelector('#toast'); n.textContent = '昵称和小人已保存'; n.classList.add('visible'); });
  await wait(400);
  await shot('toast');
  await browser.close();
}
(async () => {
  const list = which === 'both' ? ['phone', 'desktop'] : which.split(',');
  for (const name of list) { try { await run(name); } catch (e) { console.log('FAILED', name, e.message); } }
})();
