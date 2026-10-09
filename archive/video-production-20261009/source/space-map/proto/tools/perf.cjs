// Frame time of the map's courtyard render, base (night) vs doodle prototype, real GPU.
// Each frame = the scene's own draw() (scene + post), timed with a 1-pixel readPixels sync (wall) and
// EXT_disjoint_timer_query_webgl2 (GPU). Usage: node perf.cjs [n=60]
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const N = Number(process.argv[2] || 60); const SOFT = process.argv.includes('--soft'); const VIEWS = SOFT ? ['home', 'explore'] : ['home', 'explore', 'records'];
const TARGETS = { base: 'http://127.0.0.1:5291/music-map/', doodle: 'http://127.0.0.1:5292/music-map/' };
const VPS = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, desktop: { viewport: { width: 1440, height: 900 } } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: SOFT ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-angle=metal', '--enable-gpu'] });
  const rows = [];
  const ROUNDS = Number(process.env.ROUNDS || 1);
  for (const [vp, opts] of Object.entries(VPS)) for (const view of VIEWS) for (let round = 0; round < ROUNDS; round++) for (const [name, url] of Object.entries(TARGETS)) {
    const ctx = await browser.newContext(opts); const page = await ctx.newPage();
    const t0 = Date.now();
    await page.goto(`${url}#/${view}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__MAP_PROTO__, null, { timeout: 30000 });
    const mountMs = await page.evaluate(() => Math.round(window.__MAP_PROTO_T__));
    await sleep(1500);
    for (let i = 0; i < 60 && await page.evaluate(() => window.__MAP_PROTO__.director.moving); i++) await sleep(100);
    await sleep(800);
    const r = await page.evaluate(async n => {
      const P = window.__MAP_PROTO__, gl = P.renderer.getContext(), px = new Uint8Array(4);
      const sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      for (let i = 0; i < 60; i++) { P.draw(); sync(); }
      const wall = [];
      for (let i = 0; i < n; i++) { const t = performance.now(); P.draw(); sync(); wall.push(performance.now() - t); }
      const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2'); const gpu = [];
      if (ext) {
        const qs = [];
        for (let i = 0; i < n; i++) { const q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); P.draw(); gl.endQuery(ext.TIME_ELAPSED_EXT); qs.push(q); sync(); }
        for (let t = 0; t < 200 && qs.some(q => !gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)); t++) await new Promise(res => setTimeout(res, 10));
        const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
        for (const q of qs) { if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) gpu.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6); gl.deleteQuery(q); }
        if (disjoint) gpu.length = 0;
      }
      const info = P.renderer.info; info.autoReset = false; info.reset(); P.draw(); sync();
      const calls = info.render.calls, triangles = info.render.triangles; info.autoReset = true;
      const st = a => { const s = [...a].sort((x, y) => x - y); return s.length ? { med: +s[s.length >> 1].toFixed(2), p90: +s[Math.floor(s.length * .9)].toFixed(2) } : null; };
      const c = gl.canvas, target = P.doodle ? P.doodle.size : { rtWidth: P.pipeline.size.x, rtHeight: P.pipeline.size.y };
      const dbg = gl.getExtension('WEBGL_debug_renderer_info'); return { gl: String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '').slice(0, 40), lowEnd: P.doodle?.lowEnd ?? null, canvas: `${c.width}x${c.height}`, sceneTarget: `${target.rtWidth}x${target.rtHeight}`, wall: st(wall), gpu: st(gpu), calls, triangles, programs: P.renderer.info.programs.length };
    }, N);
    rows.push({ vp, view, name, round, mountMs, ...r });
    console.log(JSON.stringify(rows[rows.length - 1]));
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
