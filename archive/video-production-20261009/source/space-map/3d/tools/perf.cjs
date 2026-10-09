// Steady-state frame cost: the scene's own draw() K times back-to-back + one readPixels sync, median of 5 batches.
// TARGETS='{"night":{"url":"..","paper":false},"doodle":{"url":"..","paper":true}}' [VIEWS=home,explore,records] [ROUNDS=3] [K=120] [SOFT=1] node perf.cjs
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const K = Number(process.env.K || 120); const SOFT = Boolean(process.env.SOFT);
const TARGETS = JSON.parse(process.env.TARGETS);
const VPS = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, desktop: { viewport: { width: 1440, height: 900 } }, retina: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 } };
const ONLY = (process.env.VPS || 'phone,desktop').split(',');
const VIEWS = (process.env.VIEWS || 'home,explore,records').split(','); const ROUNDS = Number(process.env.ROUNDS || 3);
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: SOFT ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-angle=metal', '--enable-gpu'] });
  for (const vp of ONLY) for (const view of VIEWS) for (let round = 0; round < ROUNDS; round++) for (const [name, target] of Object.entries(TARGETS)) {
    const ctx = await browser.newContext({ ...VPS[vp], reducedMotion: 'reduce' });
    if (target.paper) await ctx.addInitScript(() => { const apply = () => document.documentElement?.style.setProperty('--ds-paper', '#f7efdf'); apply(); document.addEventListener('readystatechange', apply); });
    const page = await ctx.newPage();
    await page.goto(`${target.url}#/${view}`, { waitUntil: 'load' });
    await page.waitForFunction(() => globalThis.__MAP3D__, null, { timeout: 60000 }); await sleep(1500);
    const r = await page.evaluate(async k => {
      const P = globalThis.__MAP3D__, gl = P.renderer.getContext(), px = new Uint8Array(4);
      const sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const batch = () => { const t = performance.now(); for (let i = 0; i < k; i++) P.draw(); sync(); return (performance.now() - t) / k; };
      batch(); batch();
      const out = []; for (let i = 0; i < 5; i++) { out.push(batch()); await new Promise(res => setTimeout(res, 30)); }
      out.sort((a, b) => a - b);
      const c = gl.canvas, t = P.doodle ? P.doodle.size : { rtWidth: P.pipeline.size.x, rtHeight: P.pipeline.size.y };
      const info = P.renderer.info.render;
      return { canvas: `${c.width}x${c.height}`, scene: `${t.rtWidth}x${t.rtHeight}`, ms: +out[2].toFixed(2), calls: info.calls, programs: P.renderer.info.programs?.length, lowEnd: P.doodle?.lowEnd ?? null, style: document.querySelector('#sakura-world').dataset.renderStyle };
    }, K);
    console.log(JSON.stringify({ vp, view, round, name, ...r }));
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
