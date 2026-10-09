// First-load probe for verify-6. Interleaves variants each round; fresh browser per load; cache off.
//   node probe.cjs <outDir> <rounds> <phone|desktop> <throttle:4g|none> label=url [label=url ...]
const {chromium} = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs'), path = require('path');
const [,, outDir, roundsArg, vpArg, thArg, ...pairs] = process.argv;
const EXE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const vp = vpArg === 'desktop' ? {viewport: {width: 1440, height: 900}, deviceScaleFactor: 1} : {viewport: {width: 390, height: 844}, deviceScaleFactor: 2};
const targets = pairs.map(p => { const i = p.indexOf('='); return {label: p.slice(0, i), url: p.slice(i + 1)}; });
const INIT = `(() => {
  const log = window.__V6__ = {ready: null, loadingHidden: null, firstStyled: null};
  const iv = setInterval(() => {
    if (log.ready == null && window.__SPACE_BOOT__ === 'ready') log.ready = performance.now();
    const ld = document.getElementById('loading');
    if (ld && log.loadingHidden == null) { const cs = getComputedStyle(ld); if (ld.hidden || cs.display === 'none' || cs.opacity === '0' || cs.visibility === 'hidden') log.loadingHidden = performance.now(); }
    if (log.ready != null && log.loadingHidden != null) clearInterval(iv);
  }, 20);
})();`;
async function once(t, round) {
  const browser = await chromium.launch({executablePath: EXE, args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding']});
  try {
    const context = await browser.newContext({...vp, ignoreHTTPSErrors: true});
    await context.addInitScript(INIT);
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', {cacheDisabled: true});
    if (thArg === '4g') {
      await cdp.send('Network.emulateNetworkConditions', {offline: false, latency: Number(process.env.LAT || 150), downloadThroughput: Number(process.env.DOWN || 9e6) / 8, uploadThroughput: 1.5e6 / 8, connectionType: 'cellular4g'});
      await cdp.send('Emulation.setCPUThrottlingRate', {rate: 4});
    }
    const reqs = new Map();
    cdp.on('Network.requestWillBeSent', e => { if (e.request.url.startsWith('data:')) return; reqs.set(e.requestId, {url: e.request.url, wall0: e.wallTime, ts0: e.timestamp, prio: e.request.initialPriority}); });
    cdp.on('Network.responseReceived', e => { const r = reqs.get(e.requestId); if (r) { r.proto = e.response.protocol; r.tsResp = e.timestamp; r.timing = e.response.timing; } });
    cdp.on('Network.loadingFinished', e => { const r = reqs.get(e.requestId); if (r) { r.tsEnd = e.timestamp; r.bytes = e.encodedDataLength; } });
    const frames = [];
    cdp.on('Page.screencastFrame', async f => { frames.push({ts: f.metadata.timestamp, data: f.data}); try { await cdp.send('Page.screencastFrameAck', {sessionId: f.sessionId}); } catch (e) {} });
    await cdp.send('Page.startScreencast', {format: 'jpeg', quality: 60, maxWidth: vp.viewport.width, maxHeight: vp.viewport.height, everyNthFrame: 1});
    await page.goto(t.url, {waitUntil: 'commit', timeout: 120000});
    let ok = true;
    try { await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, {timeout: 60000, polling: 100}); } catch (e) { ok = false; }
    await page.waitForTimeout(1500);
    const perf = await page.evaluate(() => ({origin: performance.timeOrigin, paints: performance.getEntriesByType('paint').map(p => ({name: p.name, t: p.startTime})), log: window.__V6__, boot: window.__SPACE_BOOT__,
      fontsLoaded: [...document.fonts].filter(f => f.status === 'loaded').length, title: document.title}));
    await cdp.send('Page.stopScreencast').catch(() => {});
    const origin = perf.origin / 1000;
    const rel = (r, ts) => ts == null ? null : Math.round(((r.wall0 + (ts - r.ts0)) - origin) * 1000);
    const net = [...reqs.values()].map(r => ({url: r.url.replace(/^https?:\/\/[^/]+/, ''), proto: r.proto, prio: r.prio, bytes: r.bytes || 0, start: rel(r, r.ts0), resp: rel(r, r.tsResp), end: rel(r, r.tsEnd)}));
    const fdir = path.join(outDir, `${t.label}-r${round}-frames`);
    fs.rmSync(fdir, {recursive: true, force: true}); fs.mkdirSync(fdir, {recursive: true});
    for (const f of frames) { const ms = Math.round((f.ts - origin) * 1000); fs.writeFileSync(path.join(fdir, `${String(ms).padStart(6, '0')}.jpg`), Buffer.from(f.data, 'base64')); }
    const fcp = perf.paints.find(p => p.name === 'first-contentful-paint')?.t ?? null;
    const doc = net.find(n => /\/musicSpace\/$/.test(n.url));
    const css = net.find(n => /fonts\.css$/.test(n.url));
    const fontsLate = net.filter(n => /\.woff2$/.test(n.url) && !/(marker|display)-0\.woff2$/.test(n.url)).map(n => n.start);
    const res = {label: t.label, round, ok, fcp: fcp && Math.round(fcp), ready: perf.log.ready && Math.round(perf.log.ready), loadingHidden: perf.log.loadingHidden && Math.round(perf.log.loadingHidden),
      proto: doc?.proto, docEnd: doc?.end, css: css ? `${css.start}/${css.resp}/${css.end}` : null, firstOtherFontStart: fontsLate.length ? Math.min(...fontsLate) : null, frames: frames.length, fontsLoaded: perf.fontsLoaded};
    fs.writeFileSync(path.join(outDir, `${t.label}-r${round}.json`), JSON.stringify({...res, net, perf}, null, 1));
    console.log(JSON.stringify(res));
    return res;
  } finally { await browser.close(); }
}
(async () => {
  fs.mkdirSync(outDir, {recursive: true});
  const rounds = Number(roundsArg);
  for (let r = 1; r <= rounds; r++) {
    const order = r % 2 ? targets : [...targets].reverse();
    for (const t of order) await once(t, r);
  }
})().catch(e => { console.error(e); process.exit(1); });
