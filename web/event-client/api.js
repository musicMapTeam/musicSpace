/** Same-origin transport only. Tokens belong in Authorization, never URLs/logs. */
export class EventClientError extends Error {
  constructor(message, { status = 0, code = 'CLIENT_ERROR', retryable = false, uncertain = false, retryAfter = null, operationId = null } = {}) {
    super(message); this.name = 'EventClientError'; Object.assign(this, { status, code, retryable, uncertain, retryAfter, operationId });
  }
}
const RECAP_UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const RECAP_PATH = new RegExp(`^/rooms/${RECAP_UUID}/recap$`);
const RECAP_CURSOR = new RegExp(`^(photosCursor|friendsCursor)=${RECAP_UUID}$`);
function validPath(path, namespace, method) {
  if (typeof path !== 'string' || path.includes('..') || path.includes('//')) return false;
  const [pathname, query, ...extra] = path.split('?');
  if (/^\/rooms\/[^/]+\/recap$/.test(pathname)) {
    if (!RECAP_PATH.test(pathname) || namespace !== 'event' || method !== 'GET' || extra.length) return false;
    if (query === undefined) return true;
    const fields = query.split('&');
    return fields.length <= 2 && fields.every(field => RECAP_CURSOR.test(field)) && new Set(fields.map(field => field.split('=')[0])).size === fields.length;
  }
  // Only recap has a two-cursor query. Keep other transport paths restricted.
  return /^\/[A-Za-z0-9/_?-]*(?:=[A-Za-z0-9_-]*)?$/.test(path);
}
export function createEventApiClient({ fetch: fetcher = globalThis.fetch?.bind(globalThis), baseUrl = '', timeoutMs = 20_000 } = {}) {
  if (typeof fetcher !== 'function') throw new EventClientError('此环境不能连接现场服务。');
  if (baseUrl) {
    const url = new URL(baseUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new EventClientError('服务地址必须是一个不含路径或凭据的来源。');
    baseUrl = url.origin;
  }
  async function send(path, { namespace = 'event', method = 'GET', bodyJson, token, key, signal, blob = false } = {}) {
    if (!['event', 'avatar'].includes(namespace) || !validPath(path, namespace, method)) throw new EventClientError('接口路径无效。', { code: 'INVALID_PATH' });
    const mutation = method !== 'GET';
    const abort = new AbortController();
    let timedOut = false;
    const cancel = () => abort.abort();
    if (signal?.aborted) cancel(); else signal?.addEventListener('abort', cancel, { once: true });
    const timer = setTimeout(() => { timedOut = true; abort.abort(); }, timeoutMs);
    try {
      if (abort.signal.aborted) throw new EventClientError('已停止等待；操作可能已送达。', { code: 'ABORTED', retryable: mutation, uncertain: mutation });
      let response;
      try {
        response = await fetcher(`${baseUrl}/api/${namespace}${path}`, { method, signal: abort.signal, redirect: 'error', cache: 'no-store', credentials: 'omit',
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(bodyJson === undefined ? {} : { 'Content-Type': 'application/json' }), ...(mutation && key ? { 'Idempotency-Key': key } : {}) },
          ...(bodyJson === undefined ? {} : { body: bodyJson }) });
      } catch {
        const code = abort.signal.aborted ? timedOut ? 'TIMEOUT' : 'ABORTED' : 'NETWORK';
        throw new EventClientError(code === 'ABORTED' ? '已停止等待；操作可能已送达。' : '网络没有回应，请稍后重试', { code, retryable: true, uncertain: mutation });
      }
      // Some injected transports cannot abort. Never adopt their stale response.
      if (abort.signal.aborted) throw new EventClientError('连接超时，请重试', { code: timedOut ? 'TIMEOUT' : 'ABORTED', retryable: true, uncertain: mutation });
      if (blob && response.ok) {
        if (!/^image\/jpeg(?:;|$)/i.test(response.headers.get('Content-Type') || '')) throw new EventClientError('照片读取失败', { status: response.status, code: 'INVALID_RESPONSE', retryable: true });
        const result = await response.blob();
        if (abort.signal.aborted) throw new EventClientError('照片读取已取消。', { code: 'ABORTED', retryable: true });
        return result;
      }
      let data;
      try { data = await response.json(); } catch { throw new EventClientError('读取失败，请稍后重试', { status: response.status, code: 'INVALID_RESPONSE', retryable: true, uncertain: mutation }); }
      if (abort.signal.aborted) throw new EventClientError('读取已取消，可以重试', { code: timedOut ? 'TIMEOUT' : 'ABORTED', retryable: true, uncertain: mutation });
      if (!response.ok) throw new EventClientError(data.error?.message || '操作没有完成，请重试。', { status: response.status, code: data.error?.code || 'SERVICE_ERROR', retryable: response.status >= 500 || response.status === 429, uncertain: mutation && response.status >= 500, retryAfter: Number(response.headers.get('Retry-After')) || null });
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new EventClientError('服务响应无效。', { code: 'INVALID_RESPONSE', retryable: true, uncertain: mutation });
      return data;
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
  }
  return { request: send, photoBlob: (id, options) => {
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new EventClientError('照片编号无效。', { code: 'INVALID_INPUT' });
    return send(`/photos/${id}/image`, { ...options, blob: true });
  } };
}
