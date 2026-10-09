import { createEventWorker, EVENT_API_PREFIX } from '../runtime-preview/src/event-worker.js';
import { createEventStore } from './event-store.js';
export { EVENT_API_PREFIX };

/** Same event permission engine for Node SQLite and hosted D1/private R2.
 * Returns false for unmatched paths, true after an event API response.
 */
export function createEventApi(options = {}) {
  const store = createEventStore(options), worker = createEventWorker(options);
  const handler = async (request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname !== EVENT_API_PREFIX && !pathname.startsWith(`${EVENT_API_PREFIX}/`)) return false;
    try {
      const maximum = 420 * 1024;
      let length = 0; const chunks = [];
      if (!['GET', 'HEAD'].includes(request.method)) {
        for await (const chunk of request.iterator({ destroyOnReturn: false })) {
          length += chunk.length;
          if (length > maximum) { request.resume(); break; }
          chunks.push(chunk);
        }
      }
      const headers = new Headers(request.headers);
      // CF-Connecting-IP is authoritative only on the edge, not a user header in Node.
      headers.delete('CF-Connecting-IP');
      if (length > maximum) headers.set('Content-Length', String(length));
      const req = new Request('http://localhost' + request.url, { method: request.method, headers,
        ...(['GET', 'HEAD'].includes(request.method) ? {} : { body: Buffer.concat(chunks), duplex: 'half' }) });
      const result = await worker.fetch(req, { DB: store.DB, PHOTOS: store.PHOTOS, EVENT_CLIENT_IP: request.socket.remoteAddress });
      response.writeHead(result.status, Object.fromEntries(result.headers));
      response.end(Buffer.from(await result.arrayBuffer()));
    } catch {
      // An interrupted request body must not reject the host HTTP callback.
      if (!response.headersSent && !response.destroyed) {
        response.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
        response.end(JSON.stringify({ error: { code: 'REQUEST_INTERRUPTED', message: '提交中断，请使用原重试编号再试一次。' } }));
      }
    }
    return true;
  };
  handler.close = store.close;
  return handler;
}
let defaultHandler;
export async function handleEventApi(request, response) {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (pathname !== EVENT_API_PREFIX && !pathname.startsWith(`${EVENT_API_PREFIX}/`)) return false;
  defaultHandler ||= createEventApi();
  return defaultHandler(request, response);
}
export function closeEventApi() { defaultHandler?.close(); defaultHandler = undefined; }
