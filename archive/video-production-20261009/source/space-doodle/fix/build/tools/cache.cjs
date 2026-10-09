// Two visits to /event-room/ in one browser context: are the Doodle font files (and the page) downloaded again or revalidated?
const { launch, open, sleep } = require('./lib.cjs');
const port = process.argv[2] || '8892';
(async () => {
  const browser = await launch(); const { page } = await open(browser, 'phone');
  const cdp = await page.context().newCDPSession(page); await cdp.send('Network.enable');
  const reqs = new Map(); let visit = 0;
  cdp.on('Network.requestWillBeSent', e => reqs.set(e.requestId, { url: e.request.url, visit, inm: e.request.headers['If-None-Match'] || e.request.headers['if-none-match'] || null }));
  cdp.on('Network.requestWillBeSentExtraInfo', e => { const r = reqs.get(e.requestId); if (r) r.inm = r.inm || e.headers['if-none-match'] || e.headers['If-None-Match'] || null; });
  cdp.on('Network.responseReceived', e => { const r = reqs.get(e.requestId); if (r) Object.assign(r, { status: e.response.status, fromDisk: e.response.fromDiskCache, fromMem: e.response.fromMemoryCache, cc: e.response.headers['cache-control'] || e.response.headers['Cache-Control'], etag: e.response.headers['etag'] || e.response.headers['ETag'] || null }); });
  cdp.on('Network.responseReceivedExtraInfo', e => { const r = reqs.get(e.requestId); if (r) r.wireStatus = e.statusCode; });
  cdp.on('Network.loadingFinished', e => { const r = reqs.get(e.requestId); if (r) r.bytes = e.encodedDataLength; });
  cdp.on('Network.requestServedFromCache', e => { const r = reqs.get(e.requestId); if (r) r.servedFromCache = true; });
  for (visit = 1; visit <= 2; visit++) {
    await page.goto(`http://127.0.0.1:${port}/event-room/`, { waitUntil: 'load' });
    await page.waitForFunction(() => /已连接|同场/.test(document.querySelector('#render-status')?.innerText || ''), null, { timeout: 30000 });
    await sleep(3500);
  }
  const sum = {};
  for (const r of reqs.values()) {
    const kind = /\.woff2/.test(r.url) ? 'woff2' : /fonts\.css/.test(r.url) ? 'fonts.css' : /event-room\/(\?|$)/.test(r.url) ? 'html' : /three\.(module|core)\.js/.test(r.url) ? 'three' : 'other';
    const k = `visit${r.visit}:${kind}`; sum[k] = sum[k] || { n: 0, bytes: 0, cached: 0, wire: new Set(), cc: new Set(), etag: 0, ifNoneMatch: 0 };
    sum[k].n++; sum[k].bytes += r.bytes || 0; if (r.fromDisk || r.fromMem || r.servedFromCache) sum[k].cached++; sum[k].wire.add(r.wireStatus ?? r.status); sum[k].cc.add(r.cc); if (r.etag) sum[k].etag++; if (r.inm) sum[k].ifNoneMatch++;
  }
  for (const [k, v] of Object.entries(sum)) console.log(k, JSON.stringify({ ...v, wire: [...v.wire], cc: [...v.cc] }));
  const fontsOk = await page.evaluate(async () => { await document.fonts.ready; return { display: document.fonts.check('16px "Doodle Display"', '现场'), marker: document.fonts.check('16px "Doodle Marker"', '现场') }; });
  console.log('fonts after visit 2', JSON.stringify(fontsOk));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
