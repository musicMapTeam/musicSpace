/**
 * On-device viewpoint suggestion for a concert photo: stage / crowd / friends / detail (舞台 / 人海 / 身边 / 细节).
 *
 * The model is the image tower of TinyCLIP-ViT-8M/16 (MIT, int8, 8.8 MB) run by onnxruntime-web (WASM, single thread) in
 * this browser tab. The photo is decoded and scored here and never leaves the device. Everything is fetched from THIS origin
 * (./ai/ next to index.html, so a GitHub Pages sub-path works): no CDN, no huggingface.co. The four viewpoint vectors are
 * precomputed text embeddings shipped in labels.json; the text tower is not shipped.
 *
 * It is a small zero-shot model and it can be wrong. `sure` means "confident enough to pre-select a chip", never "correct":
 * the person can always change the viewpoint, and when `sure` is false the UI should show the choices without a guess.
 *
 *   import { getViewpointAI } from './ai/space-ai.js';
 *   const ai = getViewpointAI();            // one shared instance
 *   if (ai.supported()) ai.load(({ loaded, total }) => showBar(loaded / total));   // optional early warm-up
 *   const r = await ai.classify(file);      // never rejects
 *   if (r.sure) preselect(r.label);         // else offer r.top2 first; r.ok === false means "no AI answer, pick by hand"
 *
 * Contract
 *   supported()      synchronous. WebAssembly SIMD + createImageBitmap + an http(s) page (not file:).
 *   whyUnsupported() synchronous. null when supported(); else 'page' (the page is not served over http(s), e.g. file://: the same browser
 *                    would run the model from a URL) or 'browser' (no WebAssembly SIMD / createImageBitmap / fetch). For wording only.
 *   status()         'idle' | 'loading' | 'ready' | 'unsupported' | 'failed'.
 *   progress()       synchronous. { loaded, total } bytes of the load so far (decoded bytes; 0 / 0 before the first one is known), so a caller
 *                    that joins a load already under way knows whether the download is still going or only the model is starting up.
 *   load(onProgress) idempotent, never rejects (failure -> status 'failed'). onProgress({ loaded, total }) in bytes.
 *   classify(blob)   queued one at a time, never rejects. Starts load() if nobody did. Takes a Blob/File (the normal input); an
 *                    ImageBitmap / <img> / <canvas> works too, and a data: or blob: URL string is read locally (a web URL is refused,
 *                    so a photo is never requested from the network). Resolves
 *       ok:      { ok: true, label, prob, margin, top2: [id, id], sure, scores: { stage, crowd, friends, detail }, ms: { prep, infer } }
 *       no answer: { ok: false, error, status, label: null, prob: 0, margin: 0, top2: [], sure: false, scores: {}, ms }
 *     error is 'unsupported' | 'failed' | 'timeout' (model still downloading) | 'input' | 'decode' | 'infer'.
 *     Callers may therefore read `sure` without a null check: a failed call always has sure === false.
 *   diagnostics()    plain object for logs and tests (timings, cache hit, last error).
 */

// Where ai/ lives, relative to the page (document.baseURI): './ai/' for a page that sits next to it (index.html on GitHub Pages), and
// whatever <meta name="space-ai-base" content="../ai/"> says for a page one level down (event-room/index.html on the Node server, which
// serves /ai/ at its root; the static build rewrites that meta to './ai/'). It is read when the first file is needed, not when this file is
// loaded, so a test's bare `document` ({ baseURI } without querySelector) and a page that has no such tag both get the default.
const DEFAULT_ASSET_DIR = './ai/';
const MODEL_DIR = 'tc8/';                  // TinyCLIP-8M pack: labels.json + vision.onnx
const ORT_DIR = 'ort/';                    // ort.wasm.min.mjs, ort-wasm-simd-threaded.mjs, ort-wasm-simd-threaded.wasm (copied at build time)
const CACHE_NAME = 'music-space-ai-v1';    // Cache Storage bucket; bump when the model or runtime files change
// The gate for pre-selecting a chip. Measured through the app's own path (compressPhoto -> classify) on the 75 CC photos and on six degraded
// copies of each (dark, crop, blur, small, tilt, wechat; 525 in all): 402 answers passed it and 400 of them were right (99.5 %). On the 75
// originals alone 57 of 57 were right. The two wrong ones are stage -> friends with a margin just above the gate (0.0203 dark, 0.0241 crop).
// A margin of 0.025 kept all 372 passing answers right (70.9 % coverage). These are figures on public photos, not on real audiences'
// phones, and 'sure' is never shown or worded as "right": it only lets the model fill an empty chip that the person can change.
const SURE_MARGIN = 0.02;                  // cosine gap between the best and second-best viewpoint
const SURE_PROB = 0.5;                     // softmax(100 * cosine) probability of the best viewpoint
const LOAD_WAIT_MS = 45000;                // how long one classify() waits for a cold download before giving up on that photo
const STALL_MS = 30000;                    // abort a download that has moved no bytes for this long
const RETRY_AFTER_MS = 15000;              // after a failed load, the next load()/classify() may retry no sooner than this
const MAX_ATTEMPTS = 3;                    // ...and at most this many times per page session

/** Viewpoint ids in the order of `scores`. The model's own class "near" is the product's "friends" (身边). */
export const VIEWPOINTS = Object.freeze(['stage', 'crowd', 'friends', 'detail']);
const ID_OF = { stage: 'stage', crowd: 'crowd', near: 'friends', friends: 'friends', detail: 'detail' };

// A 1-function module using a v128 op: validates only when the engine has WebAssembly SIMD (the ORT WASM build needs it).
const SIMD_PROBE = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]);

function assetDir() {
  let dir = '';
  try { dir = String(document.querySelector?.('meta[name="space-ai-base"]')?.content ?? '').trim(); } catch { dir = ''; }
  if (!dir) return DEFAULT_ASSET_DIR;
  return dir.endsWith('/') ? dir : `${dir}/`;
}

const assetUrl = path => new URL(assetDir() + path, document.baseURI).href;

/** Why the model cannot run here: 'page' (not an http(s) page, so it cannot fetch its own files), 'browser' (missing engine features), or null. */
function unsupportedReason() {
  try {
    if (typeof document === 'undefined') return 'browser';
    if (!/^https?:$/.test(location.protocol)) return 'page';
    if (typeof WebAssembly !== 'object' || typeof createImageBitmap !== 'function' || typeof fetch !== 'function') return 'browser';
    return WebAssembly.validate(SIMD_PROBE) ? null : 'browser';
  } catch { return 'browser'; }
}

// ---- bytes: Cache Storage + streamed progress ---------------------------------------------------------------------------

// Cache Storage exists only in secure contexts (https or localhost); a LAN http:// page simply has no persistent cache.
async function openCache() {
  try { return typeof caches === 'object' ? await caches.open(CACHE_NAME) : null; } catch { return null; }
}

/** Read a body into one Uint8Array, reporting the running byte count (decoded bytes, so gzip does not skew progress). */
async function readBody(response, expected, onBytes) {
  if (!response.body?.getReader) {
    const whole = new Uint8Array(await response.arrayBuffer());
    onBytes?.(whole.length);
    return whole;
  }
  const reader = response.body.getReader();
  let out = new Uint8Array(expected || 1 << 20);
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (length + value.length > out.length) {
      const bigger = new Uint8Array(Math.max(out.length * 2, length + value.length));
      bigger.set(out.subarray(0, length));
      out = bigger;
    }
    out.set(value, length);
    length += value.length;
    onBytes?.(length);
  }
  return length === out.length ? out : out.subarray(0, length);
}

async function fetchBytes(url, expected, onBytes, reload) {
  const controller = new AbortController();
  let timer = 0;
  const arm = () => { clearTimeout(timer); timer = setTimeout(() => controller.abort(), STALL_MS); };
  arm();
  try {
    const response = await fetch(url, { signal: controller.signal, credentials: 'same-origin', cache: reload ? 'reload' : 'default' });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return await readBody(response, expected, length => { arm(); onBytes?.(length); });
  } finally { clearTimeout(timer); }
}

/**
 * One asset as bytes. Cache-first by default; a cached copy whose length is not the expected one is dropped and refetched.
 * A download is stored only after its length checks out, so a truncated or captive-portal answer never enters the cache.
 * `reload` skips the browser's HTTP cache (used on a retry, in case the failure was a bad answer it kept).
 */
async function getAsset(url, { expected = 0, onBytes = null, networkFirst = false, reload = false } = {}) {
  const cache = await openCache();
  const fromCache = async () => {
    if (!cache) return null;
    try {
      const hit = await cache.match(url);
      if (!hit) return null;
      const bytes = await readBody(hit, expected, onBytes);
      if (!expected || bytes.length === expected) return { bytes, from: 'cache' };
    } catch { /* unreadable entry: refetch */ }
    cache.delete(url).catch(() => {});
    return null;
  };
  const fromNetwork = async () => {
    const bytes = await fetchBytes(url, expected, onBytes, reload);
    if (expected && bytes.length !== expected) throw new Error(`${url} is ${bytes.length} bytes, expected ${expected}`);
    if (cache) cache.put(url, new Response(bytes, { headers: { 'Content-Type': 'application/octet-stream' } })).catch(() => {});
    return { bytes, from: 'network' };
  };
  if (networkFirst) {
    try { return await fromNetwork(); } catch (error) { const hit = await fromCache(); if (hit) return hit; throw error; }
  }
  return (await fromCache()) || fromNetwork();
}

// The main thread is busy for the length of one inference (~0.15-0.4 s on a desktop, longer on a phone). Let the page paint first,
// so an "identifying..." state set just before classify() is on screen rather than frozen half-drawn.
const afterPaint = () => new Promise(resolve => {
  const fallback = setTimeout(resolve, 100);                 // hidden tabs do not run animation frames
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => setTimeout(() => { clearTimeout(fallback); resolve(); }, 0));
});

/** The photo as something createImageBitmap accepts, or null. Only data: and blob: strings are fetched: never a web URL. */
async function asImageSource(photo) {
  if (typeof photo === 'string') return /^(data|blob):/i.test(photo) ? (await fetch(photo)).blob() : null;
  return photo && typeof photo === 'object' ? photo : null;
}

function parseLabels(bytes) {
  const labels = JSON.parse(new TextDecoder().decode(bytes));
  const plain = name => typeof name === 'string' && /^[\w.-]+$/.test(name);
  const dim = labels?.vectors?.[0]?.length;
  const ok = labels?.version === 1 && plain(labels.model) && plain(labels.wasm) && plain(labels.input) && plain(labels.output)
    && labels.modelBytes > 0 && labels.wasmBytes > 0 && labels.scale > 0 && dim > 0
    && Array.isArray(labels.classes) && labels.classes.length === labels.vectors.length && labels.classes.every(name => name in ID_OF)
    && labels.vectors.every(vector => Array.isArray(vector) && vector.length === dim)
    && labels.preprocess?.size > 0 && labels.preprocess.mean?.length === 3 && labels.preprocess.std?.length === 3;
  if (!ok) throw new Error('labels.json is not the expected format');
  return labels;
}

// ---- the classifier -------------------------------------------------------------------------------------------------------

function createViewpointAI() {
  let reasonCache;                 // undefined until asked; then null (can run) or the reason it cannot
  let state = 'idle';
  let loading = null;
  let attempts = 0;
  let failedAt = 0;
  let lastError = null;
  let runtime = null;              // the onnxruntime-web module
  let session = null;
  let labels = null;
  let canvas = null;
  let context = null;
  let progress = { loaded: 0, total: 0 };
  let lastEmit = 0;
  let tail = Promise.resolve();    // classify() jobs run strictly one after another
  const listeners = new Set();
  const facts = { from: {}, downloadMs: null, sessionMs: null, loadMs: null };

  const whyUnsupported = () => (reasonCache === undefined ? (reasonCache = unsupportedReason()) : reasonCache);
  const supported = () => whyUnsupported() === null;
  const status = () => (supported() ? state : 'unsupported');

  function emit(force) {
    const now = performance.now();
    if (!force && now - lastEmit < 80) return;
    lastEmit = now;
    for (const listener of [...listeners]) {
      try { listener({ loaded: progress.loaded, total: progress.total }); } catch { /* a UI callback must not break loading */ }
    }
  }

  async function doLoad() {
    const started = performance.now();
    const reload = attempts > 1;
    const labelAsset = await getAsset(assetUrl(`${MODEL_DIR}labels.json`), { networkFirst: true, reload });
    const L = parseLabels(labelAsset.bytes);
    progress = { loaded: 0, total: L.modelBytes + L.wasmBytes };
    emit(true);
    const got = { model: 0, wasm: 0 };
    const track = key => length => { got[key] = length; progress = { loaded: got.model + got.wasm, total: progress.total }; emit(false); };
    // The model, the WASM binary and the two ORT scripts are all fetched by us: byte progress, Cache Storage, and no dependence on
    // the host serving .mjs / .wasm with a JavaScript / wasm MIME type (the scripts are imported from Blob URLs below).
    const [ortScript, loaderScript, modelFile, wasmFile] = await Promise.all([
      getAsset(assetUrl(`${ORT_DIR}ort.wasm.min.mjs`), { reload }),
      getAsset(assetUrl(`${ORT_DIR}ort-wasm-simd-threaded.mjs`), { reload }),
      getAsset(assetUrl(`${MODEL_DIR}${L.model}`), { expected: L.modelBytes, onBytes: track('model'), reload }),
      getAsset(assetUrl(`${ORT_DIR}${L.wasm}`), { expected: L.wasmBytes, onBytes: track('wasm'), reload }),
    ]);
    facts.from = { model: modelFile.from, wasm: wasmFile.from };
    facts.downloadMs = performance.now() - started;
    progress = { loaded: progress.total, total: progress.total };
    emit(true);

    const sessionStarted = performance.now();
    const blobUrls = [];
    const scriptUrl = bytes => {
      const url = URL.createObjectURL(new Blob([bytes], { type: 'text/javascript' }));
      blobUrls.push(url);
      return url;
    };
    try {
      const ort = await import(/* @vite-ignore */ scriptUrl(ortScript.bytes));
      ort.env.wasm.numThreads = 1;                              // GitHub Pages cannot send COOP/COEP, so no SharedArrayBuffer
      // Not enabled: `ort.env.wasm.proxy = true` moves the WASM work into a worker. Measured in Chrome 152 on an Apple-silicon Mac it gave
      // identical scores and no main-thread stall (worst frame gap 40 ms instead of ~340 ms per photo) at the price of a ~1 s slower load;
      // it has not been tried on Safari / WeChat WebViews, and a worker that fails to start would need a fallback to this path.
      ort.env.wasm.wasmPaths = { mjs: scriptUrl(loaderScript.bytes) };
      ort.env.wasm.wasmBinary = wasmFile.bytes;
      const created = await ort.InferenceSession.create(modelFile.bytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
      ort.env.wasm.wasmBinary = undefined;                      // let the 14 MB copy go
      // First run doubles as a shape check and pays the one-off warm-up before anyone is waiting for a photo.
      const size = L.preprocess.size;
      const probe = await created.run({ [L.input]: new ort.Tensor('float32', new Float32Array(3 * size * size), [1, 3, size, size]) });
      if (probe[L.output]?.data?.length !== L.vectors[0].length) throw new Error('model output does not match labels.json');
      runtime = ort;
      session = created;
      labels = L;
    } finally { for (const url of blobUrls) URL.revokeObjectURL(url); }
    facts.sessionMs = performance.now() - sessionStarted;
    facts.loadMs = performance.now() - started;
  }

  function load(onProgress) {
    if (!supported()) return Promise.resolve();
    const listener = typeof onProgress === 'function' ? onProgress : null;
    if (state === 'ready') {
      try { listener?.({ loaded: progress.total, total: progress.total }); } catch { /* a UI callback must not break loading */ }
      return Promise.resolve();
    }
    if (!loading) {
      if (state === 'failed' && (attempts >= MAX_ATTEMPTS || performance.now() - failedAt < RETRY_AFTER_MS)) return Promise.resolve();
      attempts += 1;
      state = 'loading';
      lastError = null;
      loading = doLoad().then(
        () => { state = 'ready'; },
        error => {
          state = 'failed';
          failedAt = performance.now();
          lastError = error;
          console.warn('[space-ai] the on-device model did not load; viewpoints stay manual:', error);
        },
      ).finally(() => { loading = null; listeners.clear(); });
    }
    if (listener) listeners.add(listener);
    return loading;
  }

  function failure(error, spent) {
    return {
      ok: false, error, status: status(), label: null, prob: 0, margin: 0, top2: [], sure: false, scores: {},
      ms: { prep: spent?.prep ?? 0, infer: spent?.infer ?? 0 },
    };
  }

  // Decode with the EXIF orientation applied, scale the shorter side to the model size and centre-crop, then normalise.
  async function prepare(photo) {
    const { size, mean, std, squash } = labels.preprocess;
    let source;
    try {
      try { source = await createImageBitmap(photo, { imageOrientation: 'from-image' }); }
      catch (error) { if (error?.name !== 'TypeError') throw error; source = await createImageBitmap(photo); }   // engines without the 'from-image' value
    } catch (cause) { throw Object.assign(new Error('photo could not be decoded'), { code: 'decode', cause }); }
    let scaled = source;
    try {
      const { width, height } = source;
      const factor = size / Math.min(width, height);
      const drawWidth = squash ? size : Math.max(size, Math.round(width * factor));
      const drawHeight = squash ? size : Math.max(size, Math.round(height * factor));
      // A 12-48 MP photo is shrunk by the browser first, so the canvas never has to resample a huge bitmap.
      if (width * height > 4 * size * size) {
        try { scaled = await createImageBitmap(source, { resizeWidth: drawWidth, resizeHeight: drawHeight, resizeQuality: 'high' }); } catch { scaled = source; }
      }
      canvas ||= typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(size, size) : Object.assign(document.createElement('canvas'), { width: size, height: size });
      context ||= canvas.getContext('2d', { willReadFrequently: true });
      context.imageSmoothingQuality = 'high';
      context.clearRect(0, 0, size, size);
      context.drawImage(scaled, (size - drawWidth) / 2, (size - drawHeight) / 2, drawWidth, drawHeight);
    } catch (cause) { throw Object.assign(new Error('photo could not be drawn'), { code: 'decode', cause }); }
    finally { if (scaled !== source) scaled.close?.(); source.close?.(); }
    const pixels = context.getImageData(0, 0, size, size).data;
    const plane = size * size;
    const chw = new Float32Array(3 * plane);
    for (let i = 0; i < plane; i++) {
      for (let c = 0; c < 3; c++) chw[c * plane + i] = (pixels[i * 4 + c] / 255 - mean[c]) / std[c];
    }
    return new runtime.Tensor('float32', chw, [1, 3, size, size]);
  }

  function score(embedding, spent) {
    let norm = 0;
    for (let i = 0; i < embedding.length; i++) norm += embedding[i] * embedding[i];
    norm = Math.sqrt(norm) || 1;
    const cosine = labels.vectors.map(vector => { let dot = 0; for (let i = 0; i < vector.length; i++) dot += vector[i] * embedding[i]; return dot / norm; });
    if (!cosine.every(Number.isFinite)) return failure('infer', spent);
    const best = Math.max(...cosine);
    const weights = cosine.map(value => Math.exp((value - best) * labels.scale));
    const sum = weights.reduce((a, b) => a + b, 0);
    const prob = weights.map(weight => weight / sum);
    const order = cosine.map((_, index) => index).sort((a, b) => cosine[b] - cosine[a]);
    const [first, second] = order;
    const margin = cosine[first] - cosine[second];
    const id = index => ID_OF[labels.classes[index]];
    const scores = {};
    for (const viewpoint of VIEWPOINTS) scores[viewpoint] = prob[labels.classes.findIndex(name => ID_OF[name] === viewpoint)];
    return {
      ok: true, label: id(first), prob: prob[first], margin, top2: [id(first), id(second)], scores, ms: spent,
      sure: margin >= SURE_MARGIN && prob[first] >= SURE_PROB,
    };
  }

  async function waitForModel(waitMs) {
    let timer = 0;
    const timeout = new Promise(resolve => { timer = setTimeout(resolve, waitMs); });
    try { await Promise.race([load(), timeout]); } finally { clearTimeout(timer); }
    return state === 'ready';
  }

  async function classifyOne(photo, waitMs) {
    if (!supported()) return failure('unsupported');
    let source = null;
    try { source = await asImageSource(photo); } catch { /* unreadable data: URL: treated as no input */ }
    if (!source) return failure('input');
    if (!(await waitForModel(waitMs))) return failure(state === 'loading' ? 'timeout' : state);
    const spent = { prep: 0, infer: 0 };
    try {
      const started = performance.now();
      const input = await prepare(source);
      await afterPaint();
      const prepared = performance.now();
      const output = await session.run({ [labels.input]: input });
      const finished = performance.now();
      spent.prep = prepared - started;
      spent.infer = finished - prepared;
      return score(output[labels.output].data, spent);
    } catch (error) {
      if (error?.code !== 'decode') console.warn('[space-ai] inference failed:', error);
      return failure(error?.code === 'decode' ? 'decode' : 'infer', spent);
    }
  }

  function classify(photo, options) {
    const waitMs = options?.waitMs > 0 ? options.waitMs : LOAD_WAIT_MS;
    const result = tail.then(() => classifyOne(photo, waitMs));
    tail = result.then(() => {}, () => {});
    return result;
  }

  function diagnostics() {
    return {
      status: status(), attempts, error: lastError ? String(lastError.message || lastError) : null,
      from: { ...facts.from }, downloadMs: facts.downloadMs, sessionMs: facts.sessionMs, loadMs: facts.loadMs,
      modelBytes: labels?.modelBytes ?? null, wasmBytes: labels?.wasmBytes ?? null, threads: 1,
    };
  }

  const bytesSoFar = () => ({ loaded: progress.loaded, total: progress.total });

  return { supported, whyUnsupported, status, progress: bytesSoFar, load, classify, diagnostics };
}

let shared = null;

/** The one shared classifier. Creating it costs nothing; nothing is fetched until load() or classify(). */
export function getViewpointAI() {
  return (shared ||= createViewpointAI());
}
