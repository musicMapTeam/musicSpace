// Second visit in the same context: are the doodle font files served from cache or downloaded again?
const { launch, open, sleep } = require('./lib.cjs');
(async () => {
  const browser = await launch(); const { page } = await open(browser, 'phone');
  const cdp = await page.context().newCDPSession(page); await cdp.send('Network.enable');
  const reqs = new Map(); let visit = 0; const rows = [];
  cdp.on('Network.requestWillBeSent', e => reqs.set(e.requestId, { url: e.request.url, visit }));
  cdp.on('Network.responseReceived', e => { const r = reqs.get(e.requestId); if (r) Object.assign(r, { status: e.response.status, fromDisk: e.response.fromDiskCache, fromMem: e.response.fromMemoryCache, cc: e.response.headers['cache-control'] || e.response.headers['Cache-Control'], etag: e.response.headers['etag'] || e.response.headers['ETag'] || null, lm: e.response.headers['last-modified'] || null }); });
  cdp.on('Network.loadingFinished', e => { const r = reqs.get(e.requestId); if (r) r.bytes = e.encodedDataLength; });
  cdp.on('Network.requestServedFromCache', e => { const r = reqs.get(e.requestId); if (r) r.servedFromCache = true; });
  for (visit = 1; visit <= 2; visit++) {
    await page.goto('http://127.0.0.1:8890/event-room/', { waitUntil: 'load' });
    await page.waitForFunction(() => /已连接/.test(document.querySelector('#render-status')?.innerText || ''), null, { timeout: 30000 });
    await sleep(3500);
  }
  const sum = {};
  for (const r of reqs.values()) {
    const kind = /\.woff2/.test(r.url) ? 'woff2' : /fonts\.css/.test(r.url) ? 'fonts.css' : /event-room\/(\?|$)/.test(r.url) ? 'html' : /\.glb/.test(r.url) ? 'glb' : 'other';
    const k = `visit${r.visit}:${kind}`; sum[k] = sum[k] || { n: 0, bytes: 0, cached: 0, statuses: new Set(), cc: new Set(), etag: 0 };
    sum[k].n++; sum[k].bytes += r.bytes || 0; if (r.fromDisk || r.fromMem || r.servedFromCache) sum[k].cached++; sum[k].statuses.add(r.status); sum[k].cc.add(r.cc); if (r.etag || r.lm) sum[k].etag++;
  }
  for (const [k, v] of Object.entries(sum)) console.log(k, JSON.stringify({ ...v, statuses: [...v.statuses], cc: [...v.cc] }));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
