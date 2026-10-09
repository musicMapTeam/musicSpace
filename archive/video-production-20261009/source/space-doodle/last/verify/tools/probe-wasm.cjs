// Where does the aborted ort-wasm request come from? Log every ai/ request with its timing, initiator, outcome, and the route step it falls in.
//   node probe-wasm.cjs <phone|desktop> <base>
const L = require('./lib.cjs');
L.watchdog(200);
const kind = process.argv[2] || 'desktop';
const BASE = process.argv[3] || 'http://127.0.0.1:4783/musicSpace/';
(async () => {
  const browser = await L.launch();
  const t0 = Date.now();
  const T = () => ((Date.now() - t0) / 1000).toFixed(2);
  let stepName = 'boot';
  try {
    const context = await browser.newContext({ ...L.VP[kind], locale: 'zh-CN' });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    const reqs = new Map();
    const got = new Map();
    cdp.on('Network.dataReceived', e => { if (reqs.has(e.requestId)) got.set(e.requestId, (got.get(e.requestId) || 0) + e.dataLength); });
    cdp.on('Network.requestWillBeSent', e => { if (/\/ai\/|\.wasm|\.onnx/.test(e.request.url)) { reqs.set(e.requestId, e.request.url); console.log(T(), stepName, 'REQ', e.requestId, e.request.url.replace(BASE, ''), 'type=' + e.type, 'initiator=' + e.initiator?.type, (e.initiator?.stack?.callFrames || []).slice(0, 2).map(f => `${f.functionName}@${f.url.split('/').pop()}:${f.lineNumber}`).join(' < ')); } });
    cdp.on('Network.responseReceived', e => { if (reqs.has(e.requestId)) console.log(T(), stepName, 'RESP', e.requestId, e.response.status, e.response.headers['Content-Length'] || e.response.headers['content-length']); });
    cdp.on('Network.loadingFinished', e => { if (reqs.has(e.requestId)) console.log(T(), stepName, 'DONE', e.requestId, e.encodedDataLength, 'bytesReceived=' + got.get(e.requestId)); });
    cdp.on('Network.loadingFailed', e => { if (reqs.has(e.requestId)) console.log(T(), stepName, 'FAILED', e.requestId, e.errorText, 'canceled=' + e.canceled, 'type=' + e.type, 'bytesReceived=' + got.get(e.requestId)); });
    page.on('console', m => { if (/ort|onnx|wasm|ai/i.test(m.text())) console.log(T(), 'console', m.type(), m.text().slice(0, 200)); });
    const run = { page, kind, touch: Boolean(L.VP[kind].hasTouch) };
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 120000 });
    stepName = 'ready';
    console.log(T(), 'ready');
    await L.sleep(1500);
    stepName = 'enter';
    await L.enter(run);
    await L.sleep(2500);
    stepName = 'upload';
    await L.press(run, '[data-tour-action="sample:sample-crowd"]');
    await page.waitForSelector('form[data-form="upload"] .photo-review', { timeout: 30000 });
    const settled = await L.aiSettled(page);
    console.log(T(), 'ai settled', settled, await page.evaluate(() => document.querySelector('form[data-form="upload"] [data-ai-line]')?.getAttribute('data-ai-key')));
    await L.sleep(1500);
    stepName = 'save';
    await L.press(run, 'form[data-form="upload"] button[type="submit"]');
    await page.locator('#panel [data-moment-badge] [data-exchange-offer]').first().waitFor({ state: 'attached', timeout: 45000 });
    stepName = 'wall';
    await L.sleep(4000);
    stepName = 'end';
    console.log(T(), 'end');
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); } finally { await browser.close(); }
})();
