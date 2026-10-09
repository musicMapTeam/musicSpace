// Frame-time of the live room render, doodle vs ?doodle=0, measured in the real page.
// Usage: node perf.js [phone|desktop|both] [--soft] [--views=overview,person,photos] [--n=40]
// Each "frame" = the scene's own resize() callback (captured from its ResizeObserver):
// it re-settles the camera on the current shot and calls renderFrame(). The same
// callback runs in both modes, so the difference is the renderer.
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const VP = { phone: { width: 390, height: 844, deviceScaleFactor: 2 }, desktop: { width: 1440, height: 900, deviceScaleFactor: 1 } };
const args = process.argv.slice(2);
const which = args.find(a => !a.startsWith('--')) || 'both';
const soft = args.includes('--soft');
const views = (args.find(a => a.startsWith('--views=')) || '--views=overview').slice(8).split(',');
const N = Number((args.find(a => a.startsWith('--n=')) || '--n=40').slice(4));
const base = process.env.SPACE_URL || 'http://127.0.0.1:5190/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function settle(page) { const t0 = Date.now(); await sleep(200); while (Date.now() - t0 < 6000) { const m = await page.evaluate(() => window.__SPACE_EVENT_QA__?.()?.camera?.moving); if (!m) break; await sleep(80); } await sleep(400); }
async function measure(page, n) {
  return page.evaluate(async n => {
    const hit = (window.__roHooks || []).find(h => h.el?.querySelector?.(':scope > canvas.toon-scene-canvas'));
    if (!hit) return { error: 'no scene resize hook' };
    const canvas = hit.el.querySelector('canvas.toon-scene-canvas'), gl = canvas.getContext('webgl2');
    const px = new Uint8Array(4), sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    for (let i = 0; i < 8; i++) { hit.cb([]); sync(); }
    const wall = [];
    for (let i = 0; i < n; i++) { const t0 = performance.now(); hit.cb([]); sync(); wall.push(performance.now() - t0); }
    const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2'); const gpu = [];
    if (ext) {
      const queries = [];
      for (let i = 0; i < n; i++) { const q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); hit.cb([]); gl.endQuery(ext.TIME_ELAPSED_EXT); queries.push(q); sync(); }
      for (let tries = 0; tries < 200 && queries.some(q => q && !gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)); tries++) await new Promise(r => setTimeout(r, 10));
      const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
      for (const q of queries) { if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) gpu.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6); gl.deleteQuery(q); }
      if (disjoint) gpu.length = 0;
    }
    const stat = a => { const s = [...a].sort((x, y) => x - y); return s.length ? { median: +s[s.length >> 1].toFixed(2), p90: +s[Math.floor(s.length * .9)].toFixed(2), mean: +(s.reduce((x, y) => x + y, 0) / s.length).toFixed(2) } : null; };
    return { canvas: [canvas.width, canvas.height], css: [canvas.clientWidth, canvas.clientHeight], wall: stat(wall), gpu: stat(gpu), style: window.__SPACE_EVENT_QA__?.()?.camera?.scene?.renderStyle };
  }, n);
}
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: soft ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [] });
  const out = {};
  for (const vp of which === 'both' ? ['phone', 'desktop'] : [which]) {
    for (const query of ['', '?doodle=0']) {
      const ctx = await browser.newContext({ viewport: { width: VP[vp].width, height: VP[vp].height }, deviceScaleFactor: VP[vp].deviceScaleFactor });
      await ctx.addInitScript(() => {
        const RO = window.ResizeObserver; window.__roHooks = [];
        window.ResizeObserver = class extends RO { constructor(cb) { super(cb); this.__cb = cb; } observe(el, o) { window.__roHooks.push({ el, cb: this.__cb }); return super.observe(el, o); } };
        window.__boil = { queries: [], gpu: [] }; const st = window.setTimeout;
        window.setTimeout = function (fn, ms, ...rest) {
          if (typeof fn === 'function' && ms > 140 && ms < 146) {
            const wrapped = () => { const c = document.querySelector('canvas.toon-scene-canvas'); const gl = c && c.getContext('webgl2'); const ext = gl && gl.getExtension('EXT_disjoint_timer_query_webgl2');
              if (!ext || !window.__boilMeasure) return fn();
              const q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); try { fn(); } finally { gl.endQuery(ext.TIME_ELAPSED_EXT); window.__boil.queries.push(q); } };
            return st.call(this, wrapped, ms, ...rest);
          }
          return st.call(this, fn, ms, ...rest);
        };
      });
      const page = await ctx.newPage(); const logs = [];
      page.on('pageerror', e => logs.push('pageerror: ' + e.message.slice(0, 200)));
      await page.goto(base + query, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
      await page.waitForFunction(() => document.querySelector('#loading')?.hidden === true, null, { timeout: 90000 }).catch(() => logs.push('loading never hid'));
      await sleep(600);
      await page.getByRole('button', { name: '进入示例现场' }).first().click();
      await page.waitForSelector('form[data-form=demo-entry]', { timeout: 15000 });
      await page.check('form[data-form=demo-entry] input[name=consent]');
      await page.waitForSelector('form[data-form=demo-entry] button[type=submit]:not([disabled])', { timeout: 30000 });
      await page.click('form[data-form=demo-entry] button[type=submit]');
      await page.waitForFunction(() => (window.__SPACE_EVENT_QA__?.()?.members || []).length > 1, null, { timeout: 30000 }).catch(() => logs.push('members never arrived'));
      await sleep(2500);
      const key = `${vp}${query || ' doodle'}`; out[key] = {};
      for (const view of views) {
        if (view === 'person') {
          await page.click('nav.camera-nav button[data-view=person]'); await page.waitForSelector('#panel-body [data-person]', { timeout: 10000 });
          const own = await page.evaluate(() => window.__SPACE_EVENT_QA__?.()?.actorId);
          const ids = await page.$$eval('#panel-body [data-person]', els => els.map(e => e.dataset.person));
          await page.click(`#panel-body [data-person="${ids.find(id => id !== own) || ids[0]}"]`);
        } else await page.click(`nav.camera-nav button[data-view=${view}]`).catch(() => {});
        await settle(page);
        out[key][view] = await measure(page, N);
        if (view === 'overview' && !query) out[key].boil = await page.evaluate(async () => {
          window.__boil.queries.length = 0; window.__boilMeasure = true; await new Promise(r => setTimeout(r, 3000)); window.__boilMeasure = false;
          const gl = document.querySelector('canvas.toon-scene-canvas').getContext('webgl2'); const ms = [];
          for (let i = 0; i < 100 && window.__boil.queries.some(q => !gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)); i++) await new Promise(r => requestAnimationFrame(r));
          for (const q of window.__boil.queries) { if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) ms.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6); gl.deleteQuery(q); }
          ms.sort((a, b) => a - b); return { boilsIn3s: ms.length, gpuMedian: ms.length ? +ms[ms.length >> 1].toFixed(3) : null };
        });
      }
      if (logs.length) out[key].logs = logs;
      await ctx.close();
    }
  }
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
