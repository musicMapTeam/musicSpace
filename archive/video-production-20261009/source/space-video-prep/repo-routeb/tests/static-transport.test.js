// web/static-runtime/transport.js: which requests the in-page runtime answers, what request-like object the workers get, abort
// semantics, and that every other URL (data:, blob:, other hosts, other paths) reaches the real fetch with the very same arguments.
import test from 'node:test';
import assert from 'node:assert/strict';
import { getEventListeners } from 'node:events';
import { createTransport } from '../web/static-runtime/transport.js';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** A runtime double that records every request-like object it is given. */
function fakeRuntime(answer = () => json(200, { ok: true })) {
  const seen = [];
  return { seen, async handle(like) { seen.push(like); return answer(like); } };
}
/** A real network double: records its arguments, never reaches anything. */
function fakeNetwork() {
  const calls = [];
  const fetch = async (...args) => { calls.push(args); return new Response('network', { status: 200 }); };
  return { calls, fetch };
}
async function readBody(like) {
  if (!like.body) return null;
  const reader = like.body.getReader(), chunks = [];
  for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); }
  reader.releaseLock();
  return Buffer.concat(chunks);
}

test('only http(s) /api/event and /api/avatar are answered in-page; the response is the runtime\'s own object', async () => {
  const runtime = fakeRuntime(), network = fakeNetwork();
  const response = json(201, { made: 1 });
  runtime.handle = async like => { runtime.seen.push(like); return response; };
  const fetch = createTransport(runtime, network.fetch);
  for (const url of ['/api/event/health', '/api/avatar/session', 'https://musicmapteam.github.io/api/event/rooms', 'http://localhost:4173/api/avatar/', '/api/event', '/api/avatar']) {
    assert.equal(await fetch(url), response, url);
  }
  assert.equal(runtime.seen.length, 6);
  assert.equal(network.calls.length, 0, 'nothing left the page');
});

test('every other URL goes to the real fetch with the very same arguments, untouched', async () => {
  const runtime = fakeRuntime(), network = fakeNetwork();
  const fetch = createTransport(runtime, network.fetch);
  const init = { method: 'POST', body: 'x', headers: { A: 'b' }, signal: AbortSignal.abort() };
  const urls = [
    '/api/live/health', '/api/events', '/api/eventful', '/api/avatars/1', '/api/', '/index.html', '/ai/tc8/model.onnx', './demo/manifest.json', 'https://huggingface.co/api/models/x',
    'https://example.com/#/api/event/x', 'https://example.com/?next=/api/event/x',
  ];
  for (const url of urls) await fetch(url, init);
  assert.equal(runtime.seen.length, 0, 'the runtime saw none of them');
  assert.equal(network.calls.length, urls.length);
  network.calls.forEach(([url, passed], index) => { assert.equal(url, urls[index]); assert.equal(passed, init, 'the init object itself, not a copy'); });
  const request = new Request('https://example.com/asset.js');
  await fetch(request);
  assert.deepEqual([network.calls.at(-1).length, network.calls.at(-1)[0]], [1, request], 'no second argument invented');
  await fetch(new URL('https://example.com/x.json'));
  assert.ok(network.calls.at(-1)[0] instanceof URL);
  await fetch();
  await fetch(undefined);
  await fetch(null);
  await fetch(12);
  assert.equal(network.calls.length, urls.length + 6, 'unclassifiable inputs are left to the real fetch to judge');
});

test('data: and blob: URLs are never hijacked, even when their payload contains /api/event (a data: URL\'s pathname is its payload)', async () => {
  const runtime = fakeRuntime(), network = fakeNetwork();
  const fetch = createTransport(runtime, network.fetch);
  const payload = Buffer.from('{"url":"/api/event/health","also":"/api/avatar/session"}').toString('base64');
  const urls = [
    `data:application/json;base64,${payload}`,
    'data:text/plain,/api/event/health',
    'data:text/plain;charset=utf-8,GET%20/api/avatar/session',
    'data:,/api/event/',
    'blob:https://musicmapteam.github.io/api/event/0b0b0b0b-1111-2222-3333-444444444444',
    'blob:null/api/avatar/x',
    'file:///api/event/health', 'ftp://example.com/api/event/x', 'ws://example.com/api/event/x', 'about:blank#/api/event/x', 'chrome-extension://abc/api/avatar/x', 'javascript:"/api/event"',
  ];
  for (const url of urls) await fetch(url);
  assert.equal(runtime.seen.length, 0);
  assert.deepEqual(network.calls.map(call => call[0]), urls);
  assert.equal(new URL(urls[0]).pathname, `application/json;base64,${payload}`, 'the premise: the pathname of a data: URL is its payload');
  assert.match(new URL('data:text/plain,/api/event/health').pathname, /\/api\/(event|avatar)(?:\/|$)/, 'so a pathname-only rule WOULD match such a data: URL; the scheme check is what keeps it out');
});

test('a base path in front of the API prefix is tolerated and stripped (the site lives under /musicSpace/)', async () => {
  const runtime = fakeRuntime();
  const fetch = createTransport(runtime, fakeNetwork().fetch);
  await fetch('https://musicmapteam.github.io/musicSpace/api/event/rooms?cursor=abc');
  await fetch('/musicSpace/preview/api/avatar/session');
  assert.deepEqual(runtime.seen.map(like => new URL(like.url).pathname + new URL(like.url).search), ['/api/event/rooms?cursor=abc', '/api/avatar/session']);
});

test('the workers get a request-like object: absolute url with path and query, upper-case method, Headers, a getReader body, no Request', async () => {
  const runtime = fakeRuntime();
  const fetch = createTransport(runtime, fakeNetwork().fetch);
  await fetch('/api/event/rooms/abc/photos?x=1&y=%E4%B8%AD', {
    method: 'post', headers: { 'content-type': 'application/json', Authorization: 'Bearer t', 'Idempotency-Key': 'k'.repeat(20) }, body: JSON.stringify({ title: '同一刻' }),
    credentials: 'omit', cache: 'no-store', redirect: 'error',
  });
  const [like] = runtime.seen;
  assert.deepEqual(Object.keys(like).sort(), ['body', 'headers', 'method', 'url']);
  assert.equal(like.method, 'POST');
  assert.equal(like.url, 'http://in-browser.invalid/api/event/rooms/abc/photos?x=1&y=%E4%B8%AD');
  assert.ok(like.headers instanceof Headers);
  assert.equal(like.headers.get('Content-Type'), 'application/json');
  assert.equal(like.headers.get('authorization'), 'Bearer t', 'header names are case-insensitive');
  assert.equal(like.headers.get('Idempotency-Key'), 'k'.repeat(20));
  assert.equal(like.headers.get('Sec-Fetch-Site'), null, 'nothing that would read as cross-site');
  assert.equal(typeof like.body.getReader, 'function');
  assert.equal(like instanceof Request, false);
  const reader = like.body.getReader();
  assert.deepEqual(Object.keys(reader).sort(), ['cancel', 'read', 'releaseLock']);
  const first = await reader.read();
  assert.equal(first.done, false);
  assert.ok(first.value instanceof Uint8Array);
  assert.equal(Buffer.from(first.value).toString('utf8'), '{"title":"同一刻"}');
  assert.deepEqual(await reader.read(), { done: true, value: undefined });
  reader.releaseLock();
});

test('bodies: GET and HEAD have none, empty bodies have none, binary bodies keep their bytes, Request inputs are read', async () => {
  const runtime = fakeRuntime();
  const fetch = createTransport(runtime, fakeNetwork().fetch);
  await fetch('/api/event/health');
  await fetch('/api/event/health', { method: 'GET', body: 'ignored' });
  await fetch('/api/event/health', { method: 'HEAD' });
  await fetch('/api/event/x', { method: 'POST' });
  await fetch('/api/event/x', { method: 'POST', body: '' });
  await fetch('/api/event/x', { method: 'POST', body: null });
  assert.deepEqual(runtime.seen.map(like => like.body), [null, null, null, null, null, null]);

  const binary = Uint8Array.from({ length: 256 }, (_, i) => i);
  runtime.seen.length = 0;
  await fetch('/api/event/x', { method: 'PUT', body: binary });
  await fetch('/api/event/x', { method: 'PUT', body: binary.buffer });
  await fetch('/api/event/x', { method: 'PUT', body: new Blob([binary]) });
  await fetch('/api/event/x', { method: 'PUT', body: new Uint16Array([0x0102, 0x0304]) });
  await fetch('/api/event/x', { method: 'PATCH', body: new URLSearchParams({ a: '1' }) });
  const bodies = await Promise.all(runtime.seen.map(readBody));
  assert.deepEqual([...bodies[0]], [...binary]);
  assert.deepEqual([...bodies[1]], [...binary]);
  assert.deepEqual([...bodies[2]], [...binary]);
  assert.deepEqual([...bodies[3]], [2, 1, 4, 3]);
  assert.equal(bodies[4].toString(), 'a=1');
  assert.deepEqual(runtime.seen.map(like => like.method), ['PUT', 'PUT', 'PUT', 'PUT', 'PATCH']);

  runtime.seen.length = 0;
  await fetch(new Request('https://musicmapteam.github.io/api/avatar/session', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-A': '1' }, body: '{"name":"x"}' }));
  await fetch(new Request('https://musicmapteam.github.io/api/avatar/session', { method: 'POST', headers: { 'X-A': '1' }, body: 'old' }), { headers: { 'X-B': '2' }, body: 'new' });
  assert.equal(runtime.seen[0].method, 'POST');
  assert.equal(runtime.seen[0].headers.get('x-a'), '1');
  assert.equal((await readBody(runtime.seen[0])).toString(), '{"name":"x"}');
  assert.equal(runtime.seen[1].headers.get('x-a'), null, 'init.headers replace the Request\'s headers, like fetch');
  assert.equal(runtime.seen[1].headers.get('x-b'), '2');
  assert.equal((await readBody(runtime.seen[1])).toString(), 'new');
});

test('a body reader that is cancelled ends; the workers cancel when a body is too large', async () => {
  const runtime = fakeRuntime();
  await createTransport(runtime, fakeNetwork().fetch)('/api/event/x', { method: 'POST', body: 'abc' });
  const reader = runtime.seen[0].body.getReader();
  await reader.cancel();
  assert.deepEqual(await reader.read(), { done: true, value: undefined });
});

test('getRuntime may be a runtime, a promise, or a function returning either; requests wait for a booting runtime', async () => {
  const runtime = fakeRuntime();
  const fetch = createTransport(runtime, fakeNetwork().fetch);
  await fetch('/api/event/a');
  await createTransport(Promise.resolve(runtime), fakeNetwork().fetch)('/api/event/b');
  await createTransport(() => runtime, fakeNetwork().fetch)('/api/event/c');
  await createTransport(async () => runtime, fakeNetwork().fetch)('/api/event/d');
  assert.deepEqual(runtime.seen.map(like => new URL(like.url).pathname), ['/api/event/a', '/api/event/b', '/api/event/c', '/api/event/d']);

  let release;
  const booting = new Promise(resolve => { release = () => resolve(runtime); });
  runtime.seen.length = 0;
  const waiting = createTransport(() => booting, fakeNetwork().fetch)('/api/event/late');
  await sleep(20);
  assert.equal(runtime.seen.length, 0, 'not handled before the runtime is ready');
  release();
  assert.equal((await waiting).status, 200);
  assert.equal(runtime.seen.length, 1);
});

test('a runtime that does not answer the path (null) becomes a JSON 404 with error code NOT_FOUND', async () => {
  const fetch = createTransport(fakeRuntime(() => null), fakeNetwork().fetch);
  const response = await fetch('/api/event/never-heard-of-it');
  assert.equal(response.status, 404);
  assert.match(response.headers.get('Content-Type'), /^application\/json/);
  const body = await response.json();
  assert.equal(body.error.code, 'NOT_FOUND');
  assert.equal(typeof body.error.message, 'string');
});

test('errors from the runtime reject the fetch (the client reads that as a network failure)', async () => {
  const runtime = { async handle() { throw Object.assign(new Error('closed'), { code: 'RUNTIME_CLOSED' }); } };
  await assert.rejects(createTransport(runtime, fakeNetwork().fetch)('/api/event/x'), { code: 'RUNTIME_CLOSED' });
  await assert.rejects(createTransport(Promise.reject(new Error('boot failed')), fakeNetwork().fetch)('/api/event/x'), /boot failed/);
});

// ---- AbortSignal ------------------------------------------------------------------------------------------------------------------

test('an already-aborted signal rejects with AbortError and nothing is sent to the runtime', async () => {
  const runtime = fakeRuntime();
  const fetch = createTransport(runtime, fakeNetwork().fetch);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(fetch('/api/event/x', { method: 'POST', body: '{}', signal: controller.signal }), { name: 'AbortError' });
  assert.equal(runtime.seen.length, 0);
});

test('aborting while the runtime is still booting rejects AbortError and the request is never sent', async () => {
  const runtime = fakeRuntime();
  let release;
  const booting = new Promise(resolve => { release = () => resolve(runtime); });
  const fetch = createTransport(() => booting, fakeNetwork().fetch);
  const controller = new AbortController();
  const pending = fetch('/api/event/x', { method: 'POST', body: '{}', signal: controller.signal });
  await sleep(10);
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  release();
  await sleep(20);
  assert.equal(runtime.seen.length, 0, 'the runtime never saw it');
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
});

test('aborting after the request reached the runtime rejects AbortError, but the work still completes (like a server that has the request)', async () => {
  let finish; const finished = new Promise(resolve => { finish = resolve; });
  let started = false, completed = false;
  const runtime = { async handle() { started = true; await finished; completed = true; return json(200, {}); } };
  const fetch = createTransport(runtime, fakeNetwork().fetch);
  const controller = new AbortController();
  const pending = fetch('/api/event/x', { method: 'POST', body: '{}', signal: controller.signal });
  while (!started) await sleep(1);                    // the request has reached the runtime
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(completed, false, 'the rejection came first');
  finish();
  await sleep(10);
  assert.equal(completed, true, 'and the work ran to completion regardless');
});

test('an abort that loses the race to the response is harmless; the listener is removed either way', async () => {
  const runtime = fakeRuntime();
  const fetch = createTransport(runtime, fakeNetwork().fetch);
  const controller = new AbortController();
  const response = await fetch('/api/event/x', { signal: controller.signal });
  assert.equal(response.status, 200);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0, 'no listener left on a finished request');
  controller.abort();                                // after the fact: nothing to reject, no unhandled rejection
  await sleep(5);
  const failing = createTransport({ async handle() { throw new Error('boom'); } }, fakeNetwork().fetch);
  const second = new AbortController();
  await assert.rejects(failing('/api/event/x', { signal: second.signal }), /boom/);
  assert.equal(getEventListeners(second.signal, 'abort').length, 0);
});

test('abort from a Request\'s own signal and a custom abort reason', async () => {
  const runtime = fakeRuntime(() => new Promise(() => {}));            // never answers
  const fetch = createTransport(runtime, fakeNetwork().fetch);
  const controller = new AbortController();
  const request = new Request('https://x.test/api/event/y', { signal: controller.signal });
  const pending = fetch(request);
  await sleep(5);
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  const timeout = AbortSignal.timeout(10);
  const keepAlive = setTimeout(() => {}, 2000);                      // AbortSignal.timeout's own timer is unref'd: do not let the loop drain
  await assert.rejects(fetch('/api/event/z', { signal: timeout }), { name: 'TimeoutError' });
  clearTimeout(keepAlive);
  const reasoned = new AbortController();
  const waiting = fetch('/api/event/w', { signal: reasoned.signal });
  await sleep(5);
  reasoned.abort('plain string reason');
  await assert.rejects(waiting, { name: 'AbortError' });
});

// ---- defaults ---------------------------------------------------------------------------------------------------------------------

test('realFetch defaults to the global fetch at the time createTransport is called, and importing the module touches nothing', async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (...args) => { calls.push(args); return new Response('g'); };
  try {
    const fetch = createTransport(fakeRuntime());
    await fetch('https://example.com/a');
    assert.equal(calls.length, 1);
    assert.equal(globalThis.fetch !== fetch, true, 'createTransport does not install itself');
  } finally { globalThis.fetch = original; }
});

test('relative URLs resolve against location when there is one (a page under a sub-path)', async () => {
  const runtime = fakeRuntime(), network = fakeNetwork();
  const fetch = createTransport(runtime, network.fetch);
  const had = Object.getOwnPropertyDescriptor(globalThis, 'location');
  Object.defineProperty(globalThis, 'location', { configurable: true, value: { href: 'https://musicmapteam.github.io/musicSpace/preview/index.html' } });
  try {
    await fetch('/api/event/health');
    await fetch('api/event/health');                // page-relative: /musicSpace/preview/api/event/health
    await fetch('../demo/manifest.json');
  } finally { if (had) Object.defineProperty(globalThis, 'location', had); else delete globalThis.location; }
  assert.deepEqual(runtime.seen.map(like => new URL(like.url).pathname), ['/api/event/health', '/api/event/health']);
  assert.deepEqual(network.calls.map(call => call[0]), ['../demo/manifest.json']);
});
