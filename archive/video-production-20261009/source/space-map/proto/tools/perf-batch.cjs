// Steady-state frame cost of the map courtyard, base (night) vs doodle prototype, on the real GPU.
// A batch = K back-to-back draw() calls (scene + post, exactly what the 30 fps idle loop runs), one GPU timer
// query around the batch and one readPixels sync at its end: cost per frame = batch / K. Several batches per
// page, three rounds alternating base/doodle so both see the same GPU clock behaviour. Usage: node perf-batch.cjs [K=100] [--soft]
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const K = Number(process.argv[2] || 100); const SOFT = process.argv.includes('--soft');
const TARGETS = process.env.TARGETS ? JSON.parse(process.env.TARGETS) : { base: 'http://127.0.0.1:5291/music-map/', doodle: 'http://127.0.0.1:5292/music-map/' };
const VPS = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, desktop: { viewport: { width: 1440, height: 900 } } };
const VIEWS = process.env.VIEWS ? process.env.VIEWS.split(',') : SOFT ? ['home'] : ['home', 'explore', 'records']; const ROUNDS = Number(process.env.ROUNDS || 3);
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: SOFT ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-angle=metal', '--enable-gpu'] });
  for (const [vp, opts] of Object.entries(VPS)) for (const view of VIEWS) for (let round = 0; round < ROUNDS; round++) for (const [name, url] of Object.entries(TARGETS)) {
    const ctx = await browser.newContext({ ...opts, reducedMotion: 'reduce' }); const page = await ctx.newPage();
    await page.goto(`${url}${url.includes('?') ? '' : ''}#/${view}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__MAP_PROTO__, null, { timeout: 60000 });
    await sleep(1200);
    const r = await page.evaluate(async k => {
      const P = window.__MAP_PROTO__, gl = P.renderer.getContext(), px = new Uint8Array(4);
      const sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
      const batch = async () => {
        const q = ext && gl.createQuery(); if (q) gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
        const t = performance.now(); for (let i = 0; i < k; i++) P.draw(); if (q) gl.endQuery(ext.TIME_ELAPSED_EXT); sync(); const wall = (performance.now() - t) / k;
        let gpu = null;
        if (q) { for (let n = 0; n < 300 && !gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE); n++) await new Promise(res => setTimeout(res, 5));
          if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE) && !gl.getParameter(ext.GPU_DISJOINT_EXT)) gpu = gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6 / k; gl.deleteQuery(q); }
        return { wall, gpu };
      };
      await batch(); await batch();
      const out = []; for (let i = 0; i < 5; i++) out.push(await batch());
      const med = a => { const s = a.filter(x => x != null).sort((x, y) => x - y); return s.length ? +s[s.length >> 1].toFixed(2) : null; };
      const c = gl.canvas, t = P.doodle ? P.doodle.size : { rtWidth: P.pipeline.size.x, rtHeight: P.pipeline.size.y };
      return { canvas: `${c.width}x${c.height}`, scene: `${t.rtWidth}x${t.rtHeight}`, wall: med(out.map(o => o.wall)), gpu: med(out.map(o => o.gpu)), lowEnd: P.doodle?.lowEnd ?? null };
    }, K);
    console.log(JSON.stringify({ vp, view, round, name, ...r }));
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
