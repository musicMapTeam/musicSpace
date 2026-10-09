// Is the late "ERR_ABORTED" on ai/ort/ort-wasm-simd-threaded.wasm the page's own doing? Fresh contexts, enter the example room (which starts the
// AI warm-up), with AbortController.abort and fetch body reads instrumented; CDP counts the bytes that arrived before the cancel.
//   node probe-abort.cjs <tries> [base]
const L = require('./lib.cjs');
L.watchdog(285);
const tries = Number(process.argv[2] || 6);
const BASE = process.argv[3] || 'http://127.0.0.1:4783/musicSpace/';
(async () => {
  const browser = await L.launch();
  const summary = [];
  try {
    for (let i = 0; i < tries; i++) {
      const context = await browser.newContext({ ...L.VP.desktop, locale: 'zh-CN' });
      await context.addInitScript(() => {
        window.__abortCalls = [];
        const abort = AbortController.prototype.abort;
        AbortController.prototype.abort = function (...a) { window.__abortCalls.push(new Error('abort').stack.split('\n').slice(1, 4).join(' | ')); return abort.apply(this, a); };
        window.__wasmReads = [];
        const f = window.fetch;
        window.fetch = function (input, init) {
          const url = String(input && input.url || input);
          const p = f.apply(this, arguments);
          if (/threaded\.wasm/.test(url)) p.then(r => window.__wasmReads.push(`resolved ${r.status} ${performance.now().toFixed(0)}`), e => window.__wasmReads.push(`rejected ${e && e.name} ${performance.now().toFixed(0)}`));
          return p;
        };
      });
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send('Network.enable');
      const ids = new Map(), got = new Map(), events = [];
      cdp.on('Network.requestWillBeSent', e => { if (/threaded\.wasm/.test(e.request.url)) ids.set(e.requestId, 1); });
      cdp.on('Network.dataReceived', e => { if (ids.has(e.requestId)) got.set(e.requestId, (got.get(e.requestId) || 0) + e.dataLength); });
      cdp.on('Network.loadingFinished', e => { if (ids.has(e.requestId)) events.push(`finished received=${got.get(e.requestId)}`); });
      cdp.on('Network.loadingFailed', e => { if (ids.has(e.requestId)) events.push(`FAILED ${e.errorText} canceled=${e.canceled} received=${got.get(e.requestId)}`); });
      const run = { page, kind: 'desktop', touch: false };
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 120000 });
      await L.enter(run);
      await page.waitForFunction(() => /^(ready|loaded)/.test(String(window.__aiState || '')) || true);
      await L.sleep(3500);
      const app = await page.evaluate(() => ({ aborts: window.__abortCalls, reads: window.__wasmReads }));
      // does the model actually run? pick the sample photo and read the AI line
      await L.press(run, '[data-tour-action="sample:sample-crowd"]');
      await page.waitForSelector('form[data-form="upload"] .photo-review', { timeout: 30000 });
      const settled = await L.aiSettled(page);
      const key = await page.evaluate(() => document.querySelector('form[data-form="upload"] [data-ai-line]')?.getAttribute('data-ai-key'));
      const wasmRequests = ids.size;
      const line = { i, events, wasmRequests, aiKey: key, settled, abortCalls: app.aborts.length, abortStacks: app.aborts.slice(0, 2), fetch: app.reads };
      summary.push(line);
      console.log(JSON.stringify(line));
      await context.close();
    }
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); } finally {
    console.log('canceled runs:', summary.filter(s => s.events.some(e => e.startsWith('FAILED'))).length, 'of', summary.length);
    await browser.close();
  }
})();
