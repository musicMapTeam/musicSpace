// Detail crop at 2x: BASE=.. OUT=file.png HASH=home CLIP=x,y,w,h [VP=1440x900] [PAPER=1] [QUERY=] [WAIT=4500] [EVAL=js] node detail.cjs
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const [w, h] = (process.env.VP || '1440x900').split('x').map(Number);
const clip = process.env.CLIP ? (([x, y, cw, ch]) => ({ x, y, width: cw, height: ch }))(process.env.CLIP.split(',').map(Number)) : undefined;
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--enable-gpu'] });
  const phone = w < 700;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: Number(process.env.DPR || 2), isMobile: phone, hasTouch: phone, reducedMotion: process.env.REDUCED ? 'reduce' : 'no-preference' });
  if (process.env.PAPER) await ctx.addInitScript(() => { const apply = () => document.documentElement?.style.setProperty('--ds-paper', '#f7efdf'); apply(); document.addEventListener('readystatechange', apply); });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push('pageerror ' + String(e).slice(0, 300)));
  page.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && !m.text().includes('flatShading')) errs.push(m.type() + ' ' + m.text().slice(0, 300)); });
  await page.goto(`${process.env.BASE}${process.env.QUERY || ''}#/${process.env.HASH || 'home'}`, { waitUntil: 'load' });
  await page.waitForSelector('canvas.sakura-scene__canvas', { timeout: 20000 });
  await page.waitForTimeout(Number(process.env.WAIT || 4500));
  if (process.env.EVAL) { const r = await page.evaluate(process.env.EVAL); if (r !== undefined) console.log('eval:', JSON.stringify(r)); await page.waitForTimeout(Number(process.env.WAIT2 || 1500)); }
  if (process.env.HIDEUI) await page.addStyleTag({ content: 'body > *:not(#sakura-world), .world-compass, .world-caption { visibility: hidden !important; }' });
  await page.screenshot({ path: process.env.OUT, clip });
  console.log('saved', process.env.OUT, 'errors:', errs.length ? errs.join(' || ') : 'none');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
