// Throttled first-load probe: fresh browser per run, CDP 4G-ish network (9 Mbps down, 150 ms RTT) + CPU 4x.
//   node perf-load.cjs <label> <url> <outDir> [runs=3] [phone|desktop] [extraWaitMs=8000]
// Writes <outDir>/<label>-run<N>.json (network, paints, LCP, CLS, font events, boot marks) and screencast frames
// <outDir>/<label>-run<N>-frames/<ms>.jpg (ms since navigation start).
const {chromium} = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs'), path = require('path');
const [,, label, url, outDir, runsArg = '3', vpArg = 'phone', extraArg = '8000'] = process.argv;
const EXE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const vp = vpArg === 'desktop' ? {viewport: {width: 1440, height: 900}, deviceScaleFactor: 1} : {viewport: {width: 390, height: 844}, deviceScaleFactor: 2};
const INIT = `(() => {
  const log = window.__PERF__ = {lcp: [], cls: [], fonts: [], marks: {}, loadingHidden: null, heroText: []};
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) log.lcp.push({t: e.startTime, size: e.size, url: e.url || '', el: e.element ? (e.element.id || String(e.element.className || '') || e.element.tagName) : null, text: e.element ? (e.element.textContent || '').trim().slice(0, 40) : null}); }).observe({type: 'largest-contentful-paint', buffered: true}); } catch (e) {}
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) log.cls.push({t: e.startTime, v: e.value, had: e.hadRecentInput, src: (e.sources || []).map(s => s.node ? (s.node.id || String(s.node.className || '') || s.node.nodeName) : '?').slice(0, 5)}); }).observe({type: 'layout-shift', buffered: true}); } catch (e) {}
  if (document.fonts) document.fonts.addEventListener('loadingdone', e => { for (const f of e.fontfaces) log.fonts.push({t: performance.now(), family: f.family, range: (f.unicodeRange || '').slice(0, 30), status: f.status}); });
  const iv = setInterval(() => {
    if (!log.marks.ready && window.__SPACE_BOOT__ === 'ready') log.marks.ready = performance.now();
    const ld = document.getElementById('loading');
    if (ld && log.loadingHidden == null && (ld.hidden || getComputedStyle(ld).display === 'none' || getComputedStyle(ld).opacity === '0' || getComputedStyle(ld).visibility === 'hidden')) log.loadingHidden = performance.now();
    const pt = document.getElementById('presence-title');
    if (pt) { const txt = pt.textContent; if (!log.heroText.length || log.heroText[log.heroText.length - 1].text !== txt) log.heroText.push({t: performance.now(), text: txt}); }
    if (log.marks.ready && log.loadingHidden != null && performance.now() > 60000) clearInterval(iv);
  }, 25);
})();`;
(async () => {
  fs.mkdirSync(outDir, {recursive: true});
  for (let run = 1; run <= Number(runsArg); run++) {
    const browser = await chromium.launch({executablePath: EXE, args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding']});
    const context = await browser.newContext(vp);
    await context.addInitScript(INIT);
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', {cacheDisabled: true});
    await cdp.send('Network.emulateNetworkConditions', {offline: false, latency: 150, downloadThroughput: 9e6 / 8, uploadThroughput: 1.5e6 / 8, connectionType: 'cellular4g'});
    await cdp.send('Emulation.setCPUThrottlingRate', {rate: 4});
    const reqs = new Map();
    cdp.on('Network.requestWillBeSent', e => { if (e.request.url.startsWith('data:')) return; reqs.set(e.requestId, {url: e.request.url, type: e.type, wall0: e.wallTime, ts0: e.timestamp, priority: e.request.initialPriority}); });
    cdp.on('Network.responseReceived', e => { const r = reqs.get(e.requestId); if (r) { r.status = e.response.status; r.mime = e.response.mimeType; r.tsResp = e.timestamp; r.enc = e.response.headers['content-encoding'] || e.response.headers['Content-Encoding'] || ''; } });
    cdp.on('Network.loadingFinished', e => { const r = reqs.get(e.requestId); if (r) { r.tsEnd = e.timestamp; r.bytes = e.encodedDataLength; } });
    cdp.on('Network.loadingFailed', e => { const r = reqs.get(e.requestId); if (r) { r.failed = e.errorText; r.tsEnd = e.timestamp; } });
    const frameDir = path.join(outDir, `${label}-run${run}-frames`);
    fs.rmSync(frameDir, {recursive: true, force: true}); fs.mkdirSync(frameDir, {recursive: true});
    const frames = [];
    cdp.on('Page.screencastFrame', async f => { frames.push({ts: f.metadata.timestamp, data: f.data}); try { await cdp.send('Page.screencastFrameAck', {sessionId: f.sessionId}); } catch (e) {} });
    await cdp.send('Page.startScreencast', {format: 'jpeg', quality: 70, maxWidth: vp.viewport.width, maxHeight: vp.viewport.height, everyNthFrame: 1});
    const navWall = Date.now();
    await page.goto(url, {waitUntil: 'commit', timeout: 120000});
    let ok = true;
    try { await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, {timeout: 120000, polling: 100}); } catch (e) { ok = false; }
    await page.waitForTimeout(Number(extraArg));
    const perf = await page.evaluate(() => ({origin: performance.timeOrigin, paints: performance.getEntriesByType('paint').map(p => ({name: p.name, t: p.startTime})), nav: performance.getEntriesByType('navigation')[0]?.toJSON?.(), log: window.__PERF__, boot: window.__SPACE_BOOT__, mem: performance.memory ? {used: performance.memory.usedJSHeapSize, total: performance.memory.totalJSHeapSize} : null,
      gl: (() => { try { const c = document.createElement('canvas').getContext('webgl2'); const d = c.getExtension('WEBGL_debug_renderer_info'); return d ? c.getParameter(d.UNMASKED_RENDERER_WEBGL) : c.getParameter(c.RENDERER); } catch (e) { return String(e); } })(),
      fontsUsed: [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family + ' ' + f.unicodeRange.slice(0, 20)),
    }));
    await cdp.send('Page.stopScreencast').catch(() => {});
    const origin = perf.origin / 1000; // epoch seconds
    const rel = (r, ts) => ts == null ? null : Math.round(((r.wall0 + (ts - r.ts0)) - origin) * 1000);
    const network = [...reqs.values()].map(r => ({url: r.url.replace(/^https?:\/\/[^/]+/, ''), type: r.type, priority: r.priority, status: r.status, enc: r.enc, bytes: r.bytes || 0, start: rel(r, r.ts0), resp: rel(r, r.tsResp), end: rel(r, r.tsEnd), failed: r.failed}));
    for (const f of frames) { const ms = Math.round((f.ts - origin) * 1000); fs.writeFileSync(path.join(frameDir, `${String(ms).padStart(6, '0')}.jpg`), Buffer.from(f.data, 'base64')); }
    const out = {label, url, run, viewport: vp, ok, navWall, perf, network, frames: frames.length};
    fs.writeFileSync(path.join(outDir, `${label}-run${run}.json`), JSON.stringify(out, null, 1));
    const byType = {}; for (const n of network) byType[n.type] = (byType[n.type] || 0) + n.bytes;
    const fonts = network.filter(n => /\.woff2$/.test(n.url)).map(n => `${path.basename(n.url)}:${(n.bytes / 1024).toFixed(0)}K@${n.start}-${n.end}`);
    console.log(JSON.stringify({label, run, ok, fcp: perf.paints.find(p => p.name === 'first-contentful-paint')?.t, ready: perf.log.marks.ready, loadingHidden: perf.log.loadingHidden, lcp: perf.log.lcp.at(-1), totalKB: Math.round(network.reduce((s, n) => s + n.bytes, 0) / 1024), byTypeKB: Object.fromEntries(Object.entries(byType).map(([k, v]) => [k, Math.round(v / 1024)])), fonts, gl: perf.gl, frames: frames.length}));
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
