/**
 * The page's `fetch` for the static site: /api/event and /api/avatar are answered by the in-page runtime, every other URL goes to the
 * real network function untouched. No /api request ever leaves the page.
 *
 *   createTransport(getRuntime, realFetch) -> async (input, init) => Response
 *
 * `getRuntime` is a runtime, a promise of one, or a function returning either (boot may still be running; requests wait for it).
 * The transport is NOT installed on globalThis here: boot code does `globalThis.fetch = createTransport(...)`.
 *
 * - Only http(s) URLs whose pathname contains /api/event or /api/avatar are answered in-page. The scheme is checked first: a data: URL's
 *   pathname is its payload, so `data:text/plain;base64,...` (or a blob: URL) that happens to contain "/api/event" must not be hijacked.
 *   A base path in front of the API prefix (/musicSpace/api/event/...) is tolerated and stripped.
 * - The workers get a request-like object { url, method, headers: Headers, body: null | { getReader() } }: they never touch a Request.
 * - AbortSignal: an already-aborted signal rejects with AbortError and nothing is sent; an abort while the runtime is still booting
 *   also sends nothing; an abort after the request reached the runtime rejects the fetch with AbortError while the work still
 *   completes (and is stored), like a real network where the server has the request.
 * - A path the runtime does not answer (it returned null) becomes a JSON 404 with error code NOT_FOUND.
 */
const API = /\/api\/(event|avatar)(?:\/|$)/;
const PSEUDO_ORIGIN = 'http://in-browser.invalid';
const encoder = new TextEncoder();

const abortError = signal => {
  const reason = signal?.reason;
  return reason && typeof reason === 'object' && typeof reason.name === 'string' ? reason : new DOMException('The operation was aborted.', 'AbortError');
};
const notFound = () => new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: '接口不存在。' } }), {
  status: 404, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

async function bodyBytes(body) {
  if (body === undefined || body === null) return null;
  const bytes = typeof body === 'string' ? encoder.encode(body)
    : body instanceof ArrayBuffer ? new Uint8Array(body)
    : ArrayBuffer.isView(body) ? new Uint8Array(body.buffer, body.byteOffset, body.byteLength)
    : new Uint8Array(await new Response(body).arrayBuffer());          // Blob, URLSearchParams, FormData, ReadableStream
  return bytes.length ? bytes : null;
}
const toBody = bytes => bytes && { getReader() {
  let done = false;
  return { read: async () => (done ? { done: true, value: undefined } : (done = true, { done: false, value: bytes })), cancel: async () => { done = true; }, releaseLock() {} };
} };

export function createTransport(getRuntime, realFetch = globalThis.fetch?.bind(globalThis)) {
  return async function staticFetch(...args) {
    const [input] = args;
    const requestLike = input !== null && typeof input === 'object' && !(input instanceof URL);
    const asUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input?.url;
    let url = null;
    try { url = typeof asUrl === 'string' ? new URL(asUrl, globalThis.location?.href || `${PSEUDO_ORIGIN}/`) : null; } catch { url = null; }
    const match = url && (url.protocol === 'http:' || url.protocol === 'https:') ? API.exec(url.pathname) : null;
    if (!match) return realFetch(...args);                         // not ours: the very same arguments, untouched

    const init = args[1] ?? {};
    const method = String(init.method ?? (requestLike ? input.method : undefined) ?? 'GET').toUpperCase();
    const headers = new Headers(init.headers ?? (requestLike ? input.headers : undefined) ?? undefined);
    const signal = init.signal ?? (requestLike ? input.signal : undefined);
    if (signal?.aborted) throw abortError(signal);
    const hasBody = method !== 'GET' && method !== 'HEAD';
    const bytes = !hasBody ? null : init.body !== undefined ? await bodyBytes(init.body)
      : requestLike && typeof input.arrayBuffer === 'function' ? await bodyBytes(await input.arrayBuffer()) : null;
    if (signal?.aborted) throw abortError(signal);
    const like = { url: `${PSEUDO_ORIGIN}${url.pathname.slice(match.index)}${url.search}`, method, headers, body: toBody(bytes) };

    const work = (async () => {
      const runtime = await (typeof getRuntime === 'function' ? getRuntime() : getRuntime);
      if (signal?.aborted) throw abortError(signal);               // gave up while the runtime was booting: never sent
      return (await runtime.handle(like)) ?? notFound();
    })();
    if (!signal) return work;
    return new Promise((resolve, reject) => {
      const onAbort = () => { signal.removeEventListener('abort', onAbort); reject(abortError(signal)); };
      signal.addEventListener('abort', onAbort, { once: true });
      work.then(
        response => { signal.removeEventListener('abort', onAbort); resolve(response); },
        error => { signal.removeEventListener('abort', onAbort); reject(error); },
      );
    });
  };
}
