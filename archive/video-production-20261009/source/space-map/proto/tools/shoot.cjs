// Screenshot the prototype map at phone + desktop on the real GPU.
// Usage: node shoot.cjs <baseUrl> <label> [views=home,explore,records] [extraQuery]
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const [base, label, viewsArg = 'home,explore,records', query = ''] = process.argv.slice(2);
const views = viewsArg.split(',');
const VPS = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, desktop: { viewport: { width: 1440, height: 900 } } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const dir = `/tmp/space-map/shots/3d-${label}`; fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--enable-gpu'] });
  for (const [name, opts] of Object.entries(VPS)) {
    if (process.env.ONLY && process.env.ONLY !== name) continue;
    const ctx = await browser.newContext({ ...opts, reducedMotion: process.env.REDUCED ? 'reduce' : 'no-preference' });
    const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push('pageerror ' + String(e).slice(0, 200)));
    page.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && !m.text().includes('flatShading')) errs.push(m.type() + ' ' + m.text().slice(0, 200)); });
    for (const view of views) {
      await page.goto(`${base}${query}#/${view}`, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__MAP_PROTO__, null, { timeout: 30000 });
      await sleep(Number(process.env.WAIT || 3500));
      await page.screenshot({ path: `${dir}/${view}-${name}.png` });
      console.log(name, view, 'ok');
    }
    const gl = await page.evaluate(() => { const r = window.__MAP_PROTO__.renderer; const g = r.getContext(); const d = g.getExtension('WEBGL_debug_renderer_info'); return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER); });
    console.log(name, 'GL:', gl, '| errors:', errs.length ? errs.join(' || ') : 'none');
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
