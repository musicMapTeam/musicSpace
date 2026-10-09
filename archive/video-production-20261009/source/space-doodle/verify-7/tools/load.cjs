// Verification helper: one cold load of the example site in a fresh Chrome; prints JSON with timings and font requests.
// usage: node load.cjs <url> <phone|desktop> <throttle:4g|fast|none> <fonts:on|off> <out.json> [framesDir]
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const [url, vp, thr, fontsMode, out, framesDir] = process.argv.slice(2);
const VPS = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
              desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } };
const THR = { '4g': { latency: 150, down: 9e6 / 8, up: 1.5e6 / 8, cpu: 4 }, 'fast': { latency: 40, down: 40e6 / 8, up: 10e6 / 8, cpu: 1 }, none: null };
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const pid = browser.process && browser.process() ? browser.process().pid : null;
  try {
    const ctx = await browser.newContext(VPS[vp]);
    const page = await ctx.newPage();
    if (fontsMode === 'off') await page.route(/\.woff2(\?|$)/, r => r.abort());
    await page.addInitScript(() => {
      const T = (window.__T = { faces: [], loadingHiddenAt: null, readyAt: null, fcp: null });
      new PerformanceObserver(l => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') T.fcp = e.startTime; }).observe({ type: 'paint', buffered: true });
      document.fonts.addEventListener('loadingdone', e => { for (const f of e.fontfaces) T.faces.push({ fam: f.family, range: f.unicodeRange.slice(0, 60), t: performance.now() }); });
      const iv = setInterval(() => {
        const l = document.getElementById('loading');
        if (l && T.loadingHiddenAt == null && (l.hidden || getComputedStyle(l).display === 'none')) T.loadingHiddenAt = performance.now();
        if (window.__SPACE_BOOT__ === 'ready' && T.readyAt == null) T.readyAt = performance.now();
        if (T.readyAt != null && T.loadingHiddenAt != null) clearInterval(iv);
      }, 10);
    });
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    const t = THR[thr];
    if (t) {
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: t.latency, downloadThroughput: t.down, uploadThroughput: t.up });
      if (t.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: t.cpu });
    }
    const reqs = new Map(); let t0 = null;
    cdp.on('Network.requestWillBeSent', e => { if (t0 == null && e.type === 'Document') t0 = e.timestamp; reqs.set(e.requestId, { url: e.request.url, type: e.type, start: e.timestamp, prio: e.request.initialPriority }); });
    cdp.on('Network.responseReceived', e => { const r = reqs.get(e.requestId); if (r) r.resp = e.timestamp; });
    cdp.on('Network.loadingFinished', e => { const r = reqs.get(e.requestId); if (r) { r.end = e.timestamp; r.bytes = e.encodedDataLength; } });
    cdp.on('Network.loadingFailed', e => { const r = reqs.get(e.requestId); if (r) { r.end = e.timestamp; r.failed = e.errorText; } });
    const frames = [];
    if (framesDir) {
      fs.mkdirSync(framesDir, { recursive: true });
      cdp.on('Page.screencastFrame', async f => { frames.push({ ts: f.metadata.timestamp, data: f.data }); try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch {} });
      await cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 1, maxWidth: VPS[vp].viewport.width * (VPS[vp].deviceScaleFactor || 1), maxHeight: VPS[vp].viewport.height * (VPS[vp].deviceScaleFactor || 1) });
    }
    const wall0 = Date.now() / 1000;
    await page.goto(url, { waitUntil: 'commit', timeout: 60000 });
    await page.waitForFunction(() => window.__T && window.__T.readyAt != null && window.__T.loadingHiddenAt != null, null, { timeout: 60000, polling: 50 });
    await page.waitForTimeout(4000);
    if (framesDir) await cdp.send('Page.stopScreencast');
    const T = await page.evaluate(() => ({ ...window.__T, timeOrigin: performance.timeOrigin, nav: performance.getEntriesByType('navigation')[0].toJSON() }));
    const ms = s => (s == null || t0 == null ? null : Math.round((s - t0) * 1000));
    const list = [...reqs.values()].map(r => ({ file: r.url.replace(/^.*\/musicSpace\//, ''), type: r.type, prio: r.prio, start: ms(r.start), resp: ms(r.resp), end: ms(r.end), KB: r.bytes != null ? +(r.bytes / 1024).toFixed(1) : null, failed: r.failed }));
    const doc = list.find(r => r.type === 'Document');
    const fonts = list.filter(r => /\.woff2$/.test(r.file));
    const byType = {}; for (const r of list) byType[r.type] = +((byType[r.type] || 0) + (r.KB || 0)).toFixed(0);
    const res = { url, vp, thr, fontsMode, fcp: Math.round(T.fcp), loadingHidden: Math.round(T.loadingHiddenAt), ready: Math.round(T.readyAt), htmlEnd: doc && doc.end,
      fontKB: +fonts.reduce((a, r) => a + (r.KB || 0), 0).toFixed(0), fonts: fonts.map(r => `${r.file.replace('fonts/doodle/', '')} ${r.KB}KB ${r.prio} ${r.start}-${r.end}${r.failed ? ' FAILED' : ''}`),
      faces: T.faces.map(f => `${f.fam} ${Math.round(f.t)} ${f.range.slice(0, 30)}`), byTypeKB: byType };
    if (framesDir) {
      // frame timestamps are wall-clock seconds; align to navigation start using the page timeOrigin (ms since epoch)
      const origin = T.timeOrigin / 1000;
      res.frames = frames.map((f, i) => { const name = `f${String(i).padStart(3, '0')}-${Math.round((f.ts - origin) * 1000)}ms.png`; fs.writeFileSync(`${framesDir}/${name}`, Buffer.from(f.data, 'base64')); return name; });
    }
    fs.writeFileSync(out, JSON.stringify(res, null, 1));
    console.log(JSON.stringify({ fcp: res.fcp, htmlEnd: res.htmlEnd, loadingHidden: res.loadingHidden, ready: res.ready, fontKB: res.fontKB, nFonts: fonts.length }));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
