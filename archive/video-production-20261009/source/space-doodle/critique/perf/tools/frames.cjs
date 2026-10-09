// 3D frame cost in the live room overview over 5 s: doodle vs ?doodle=0.
//   node frames.cjs <baseUrl> <phone3|desktop> <doodle|classic> [soft]
// Hooks rAF and setTimeout callbacks: main-thread time of each callback and GPU time of the GL work it issues
// (EXT_disjoint_timer_query_webgl2 on the scene's own context). Also records the browser frame cadence, and a camera
// move (overview -> photos -> overview) as the transition frames. Memory: JS heap + Chrome process RSS / footprint.
const {chromium} = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const {execSync} = require('child_process');
const [,, base, vpArg = 'phone3', mode = 'doodle', soft] = process.argv;
const VP = {phone3: {viewport: {width: 390, height: 844}, deviceScaleFactor: 3}, phone2: {viewport: {width: 390, height: 844}, deviceScaleFactor: 2}, desktop: {viewport: {width: 1440, height: 900}, deviceScaleFactor: 1}}[vpArg];
const url = base + (mode === 'classic' ? '?doodle=0' : '');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const HOOK = () => {
  const F = window.__FT__ = {on: false, cbs: [], cadence: [], gl: null, ext: null, pending: []};
  const wrap = (kind, cb) => function (...a) {
    if (!F.on) return cb.apply(this, a);
    const gl = F.gl, ext = F.ext; let q = null;
    if (gl && ext) { q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); }
    const t0 = performance.now();
    try { return cb.apply(this, a); } finally {
      const dur = performance.now() - t0;
      if (q) { gl.endQuery(ext.TIME_ELAPSED_EXT); }
      const rec = {kind, t: t0, dur, gpu: null}; F.cbs.push(rec); if (q) F.pending.push([q, rec]);
    }
  };
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => raf(wrap('raf', cb));
  const st = window.setTimeout.bind(window);
  window.setTimeout = (cb, ms, ...rest) => typeof cb === 'function' ? st(wrap(Math.abs((ms || 0) - 1000 / 7) < 1 ? 'boil' : 'timeout', cb), ms, ...rest) : st(cb, ms, ...rest);
  F.start = () => {
    const c = document.querySelector('#world canvas'); F.canvas = c ? [c.width, c.height, c.clientWidth, c.clientHeight] : null;
    F.gl = c ? c.getContext('webgl2') : null; F.ext = F.gl ? F.gl.getExtension('EXT_disjoint_timer_query_webgl2') : null;
    F.cbs = []; F.cadence = []; F.on = true; let last = 0;
    const loop = t => { if (!F.on) return; if (last) F.cadence.push(t - last); last = t; raf(loop); }; raf(loop);
  };
  F.stop = async () => {
    F.on = false; const gl = F.gl;
    for (let i = 0; i < 100 && F.pending.some(([q]) => !gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)); i++) await new Promise(r => setTimeout(r, 20));
    const disjoint = gl && F.ext ? gl.getParameter(F.ext.GPU_DISJOINT_EXT) : true;
    for (const [q, rec] of F.pending) { if (!disjoint && gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) rec.gpu = gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6; gl.deleteQuery(q); }
    F.pending = [];
    const st = a => { const s = a.filter(x => x != null).sort((x, y) => x - y); if (!s.length) return null; const p = f => +s[Math.min(s.length - 1, Math.floor(s.length * f))].toFixed(2); return {n: s.length, p50: p(.5), p95: p(.95), max: +s[s.length - 1].toFixed(2), sum: +s.reduce((x, y) => x + y, 0).toFixed(1)}; };
    const by = k => F.cbs.filter(c => c.kind === k);
    const heavy = F.cbs.filter(c => c.gpu != null && c.gpu > 0.05);
    return {canvas: F.canvas, timer: !!F.ext, disjoint,
      cadence: {...st(F.cadence), over25: F.cadence.filter(x => x > 25).length, over50: F.cadence.filter(x => x > 50).length},
      raf: {cpu: st(by('raf').map(c => c.dur)), gpu: st(by('raf').map(c => c.gpu))}, boil: {cpu: st(by('boil').map(c => c.dur)), gpu: st(by('boil').map(c => c.gpu))},
      timeout: {cpu: st(by('timeout').map(c => c.dur)), gpu: st(by('timeout').map(c => c.gpu))},
      glFrames: {n: heavy.length, gpu: st(heavy.map(c => c.gpu)), cpu: st(heavy.map(c => c.dur))}};
  };
};
function procMem(browser) {
  try {
    const out = execSync(`ps -A -o pid=,ppid=,rss=,command=`).toString().split('\n');
    const rows = out.map(l => l.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/)).filter(Boolean);
    const top = rows.find(m => +m[2] === process.pid && /Google Chrome/.test(m[4])); if (!top) return 'no browser pid'; const pid = +top[1];
    const kids = out.map(l => l.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/)).filter(Boolean).filter(m => +m[2] === pid);
    const res = {};
    for (const m of kids) { const type = (m[4].match(/--type=([\w-]+)/) || [])[1] || 'other'; let fp = null, gpuMem = null; try { const f = execSync(`footprint ${m[1]} 2>/dev/null | head -60`).toString(); fp = (f.match(/Footprint:\s*([\d.]+ \w+)/) || [])[1] || null; gpuMem = (f.match(/^\s*([\d.]+ \w+)\s+[\d.]+ \w+\s+[\d.]+ \w+\s+\d+\s+IOAccelerator/m) || [])[1] || null; } catch (e) {} (res[type] ||= []).push({pid: +m[1], rssMB: Math.round(+m[3] / 1024), footprint: fp, ioAccel: gpuMem}); }
    return res;
  } catch (e) { return String(e); }
}
(async () => {
  const args = soft ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [];
  const browser = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args});
  const ctx = await browser.newContext(VP); await ctx.addInitScript(HOOK);
  const page = await ctx.newPage(); const logs = [];
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(m.type() + ': ' + m.text().slice(0, 160)); });
  await page.goto(url, {waitUntil: 'domcontentloaded'});
  await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, {timeout: 120000});
  await page.waitForFunction(() => document.querySelector('#loading')?.hidden === true, null, {timeout: 120000}).catch(() => logs.push('loading never hid'));
  await sleep(600);
  await page.getByRole('button', {name: '进入示例现场'}).first().click();
  await page.waitForSelector('form[data-form=demo-entry]', {timeout: 15000});
  await page.check('form[data-form=demo-entry] input[name=consent]');
  await page.waitForSelector('form[data-form=demo-entry] button[type=submit]:not([disabled])', {timeout: 30000});
  await page.click('form[data-form=demo-entry] button[type=submit]');
  await page.waitForFunction(() => (window.__SPACE_EVENT_QA__?.()?.members || []).length > 1, null, {timeout: 30000}).catch(() => logs.push('members never arrived'));
  await sleep(2500);
  // close any panel so the overview is unobstructed, then settle on overview
  if (await page.isVisible('#panel-close').catch(() => false)) await page.click('#panel-close').catch(() => {});
  await page.click('nav.camera-nav button[data-view=overview]').catch(() => {});
  await sleep(2500);
  for (let i = 0; i < 60; i++) { const moving = await page.evaluate(() => window.__SPACE_EVENT_QA__?.()?.camera?.moving); if (!moving) break; await sleep(250); }
  await sleep(1000);
  const style = await page.evaluate(() => window.__SPACE_EVENT_QA__?.()?.camera?.scene?.renderStyle || null);
  await page.evaluate(() => window.__FT__.start());
  await sleep(5000);
  const idle = await page.evaluate(() => window.__FT__.stop());
  // camera transition: overview -> photos -> overview (rAF-driven frames)
  await page.evaluate(() => window.__FT__.start());
  await page.click('nav.camera-nav button[data-view=photos]').catch(() => {});
  await sleep(2200);
  await page.click('nav.camera-nav button[data-view=overview]').catch(() => {});
  await sleep(2200);
  const move = await page.evaluate(() => window.__FT__.stop());
  const cdp = await ctx.newCDPSession(page); await cdp.send('Performance.enable');
  const metrics = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.filter(m => ['JSHeapUsedSize', 'JSHeapTotalSize', 'Nodes', 'Documents'].includes(m.name)).map(m => [m.name, m.name.startsWith('JS') ? Math.round(m.value / 1048576) + 'MB' : m.value]));
  const gl = await page.evaluate(() => { const c = document.createElement('canvas').getContext('webgl2'); const d = c.getExtension('WEBGL_debug_renderer_info'); return d ? c.getParameter(d.UNMASKED_RENDERER_WEBGL) : c.getParameter(c.RENDERER); });
  const mem = procMem(browser);
  console.log(JSON.stringify({vp: vpArg, mode, soft: !!soft, style, gl, idle, move, metrics, mem, logs: logs.slice(0, 6)}));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
