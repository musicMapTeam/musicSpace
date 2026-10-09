const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-gl=angle','--enable-webgl','--ignore-gpu-blocklist','--hide-scrollbars'] });
  const ctx = await browser.newContext({ viewport: { width: 768, height: 1024 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:5190/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
  await sleep(2500);
  const r = await page.evaluate(async () => {
    const m = () => { const c = document.querySelector('#world canvas').getBoundingClientRect(); return { w: Math.round(c.width), h: Math.round(c.height), aspect: +(c.width / c.height).toFixed(3) }; };
    const before = m();
    const doodle = [...document.querySelectorAll('style[data-vite-dev-id],link[rel=stylesheet]')].filter(s => /\/doodle\//.test(s.dataset?.viteDevId || s.href || ''));
    doodle.forEach(s => s.disabled = true); if (doodle.length) doodle.forEach(s => s.media = 'not all');
    window.dispatchEvent(new Event('resize')); await new Promise(r => setTimeout(r, 800));
    const after = m();
    return { doodleSheets: doodle.map(s => (s.dataset?.viteDevId || s.href).replace(/.*\/web\//, 'web/')), withDoodle: before, legacyOnly: after };
  });
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
