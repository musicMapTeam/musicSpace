// 3D interactions on paper: pin, compass, picking a record on the canvas, wheel zoom. BASE=.. [PAPER=1] node interact.cjs
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--enable-gpu'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  if (process.env.PAPER) await ctx.addInitScript(() => { const apply = () => document.documentElement?.style.setProperty('--ds-paper', '#f7efdf'); apply(); document.addEventListener('readystatechange', apply); });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  const state = () => page.evaluate(() => ({ hash: location.hash, shot: document.querySelector('#sakura-world').dataset.shot, zoom: document.querySelector('.world-hotspots').dataset.musicZoom, style: document.querySelector('#sakura-world').dataset.renderStyle }));
  await page.goto(process.env.BASE + '#/home'); await page.waitForSelector('canvas.sakura-scene__canvas'); await sleep(3500);
  await page.click('.world-pin'); await sleep(2200); console.log('pin ->', JSON.stringify(await state()));
  // The current record's tag, then the record itself on the canvas (picked through the scene).
  const tag = page.locator('.world-music-label--node.is-current').first();
  const box = await tag.boundingBox(); console.log('current tag', box ? 'shown' : 'hidden');
  // Sweep the table until the canvas offers a pointer (a record picked through the scene).
  let hits = 0;
  for (let y = 200; y < 560 && hits < 3; y += 18) for (let x = 700; x < 1260 && hits < 3; x += 18) { await page.mouse.move(x, y); if (await page.evaluate(() => document.querySelector('canvas.sakura-scene__canvas').style.cursor === 'pointer')) hits++; }
  console.log('records picked through the scene:', hits);
  await page.mouse.move(820, 420); await page.mouse.wheel(0, -400); await sleep(600); console.log('wheel ->', JSON.stringify(await state()));
  await page.click('.world-compass button[data-world-view="records"]'); await sleep(2200); console.log('compass records ->', JSON.stringify(await state()));
  await page.click('.world-compass button[data-world-view="home"]'); await sleep(2200); console.log('compass home ->', JSON.stringify(await state()));
  console.log('errors:', errs.length ? errs.join(' | ') : 'none');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
