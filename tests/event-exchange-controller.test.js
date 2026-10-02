import { removeTempAfterTests } from './helpers/temp-directory.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAvatarApi } from '../server/avatar-api.js';
import { createEventApi } from '../server/event-api.js';
import { photoData } from './event-contract.test.js';
import { createExchangeController, EXCHANGE_STORAGE_PREFIX } from '../web/event-client/exchange-controller.js';

const SESSION_KEY = 'music-space-avatar-session:v1';
const store = () => { const values = new Map(); return { get length(){return values.size;},key:index=>[...values.keys()][index]??null,getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) }; };
const storedOperations=(storage,actor)=>Array.from({length:storage.length},(_,i)=>storage.key(i)).filter(key=>key.startsWith(EXCHANGE_STORAGE_PREFIX+actor+':')).map(key=>storage.getItem(key));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'space-exchange-client-'));
  const avatar = createAvatarApi({ dataDir: dir, rateLimits: false }), event = createEventApi({ dataDir: dir, rateLimits: false });
  const server = createServer(async (req, res) => { if (!await event(req, res) && !await avatar(req, res)) { res.writeHead(404); res.end(); } });
  server.listen(0, '127.0.0.1'); await once(server, 'listening'); const baseUrl = `http://127.0.0.1:${server.address().port}`, clients = [];
  t.after(async () => { clients.forEach(c => c.dispose()); server.closeAllConnections(); await new Promise(done => server.close(done)); avatar.close(); event.close(); await removeTempAfterTests(dir); });
  async function request(path, token, data, method = data ? 'POST' : 'GET') {
    const response = await fetch(baseUrl + (path.startsWith('/api/') ? path : '/api/event' + path), { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(data ? { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) });
    const body = await response.json(); assert.ok(response.ok, JSON.stringify(body)); return body;
  }
  const a = await request('/api/avatar/session', null, { name: 'A' }), b = await request('/api/avatar/session', null, { name: 'B' }), outsider = await request('/api/avatar/session', null, { name: 'C' });
  const room = (await request('/rooms', a.token, { title: '合成交换测试', venue: '合成现场', songId: 'late-train', joinConsent: true, participation: 'open' })).room;
  await request(`/rooms/${room.code}/join`, b.token, { joinConsent: true, participation: 'open' });
  const offered = (await request(`/rooms/${room.id}/photos`, a.token, { ...photoData(), visibility: 'private' })).photo;
  const requested = (await request(`/rooms/${room.id}/photos`, b.token, { ...photoData(), visibility: 'members' })).photo;
  const payload = { recipientId: b.user.id, offeredPhotoId: offered.id, requestedPhotoId: requested.id, offeredRevision: 1, requestedRevision: 1, offerPreviewConsent: true, offerOriginalConsent: true, offeredPreviewDataUrl: photoData().dataUrl };
  return { a, b, outsider, room, offered, requested, payload, request, baseUrl,
    client(actor, { storage = store(), ...options } = {}) { if (actor) storage.setItem(SESSION_KEY, JSON.stringify(actor)); const c = createExchangeController({ storage, baseUrl, timeoutMs: 2000, ...options }); clients.push(c); return { c, storage }; },
  };
}

test('exchange client: exact explicit two-user exchange, separate preview, canonical permission, after-leave revoke', async t => {
  const f = await fixture(t); let requests = 0;
  const aa = f.client(f.a, { fetch: (...args) => { requests++; return fetch(...args); } }), bb = f.client(f.b), cc = f.client(f.outsider);
  assert.equal(requests, 0); assert.throws(() => aa.c.create(f.room.id, { ...f.payload, offerOriginalConsent: false }), e => e.code === 'EXCHANGE_CONSENT_REQUIRED');
  const result = await aa.c.create(f.room.id, f.payload); assert.equal(result.committed, true); assert.equal(result.permissionConfirmed, true); const id = result.exchangeId;
  assert.equal(aa.c.getState().current.exchange.status, 'pending'); assert.ok((await aa.c.fetchImage({ kind: 'preview' })).size > 0);
  await assert.rejects(aa.c.fetchImage({ photoId: f.requested.id }), e => e.code === 'EXCHANGE_UNAVAILABLE');
  await assert.rejects(cc.c.open(id), e => e.status === 404); await cc.c.list(); assert.equal(cc.c.getState().list.items.length, 0);
  await bb.c.open(id); assert.throws(() => bb.c.respond('accept', { revision: 1 }), e => e.code === 'EXCHANGE_CONSENT_REQUIRED');
  await bb.c.respond('accept', { revision: 1, exchangeConsent: true }); await aa.c.refresh();
  assert.ok((await aa.c.fetchImage({ photoId: f.requested.id })).size > 0); assert.ok((await bb.c.fetchImage({ photoId: f.offered.id })).size > 0);
  await f.request(`/rooms/${f.room.id}/leave`, f.a.token, {}); await f.request(`/rooms/${f.room.id}/leave`, f.b.token, {});
  await aa.c.refresh(); assert.ok((await aa.c.fetchImage({ photoId: f.requested.id })).size > 0);
  await aa.c.respond('revoke', { revision: 2 }); await bb.c.refresh(); assert.equal(bb.c.getState().current.exchange.status, 'revoked');
  await assert.rejects(bb.c.fetchImage({ photoId: f.offered.id }), e => e.code === 'EXCHANGE_UNAVAILABLE');
  assert.ok(!JSON.stringify(aa.c.getState()).includes(f.a.token)); assert.ok(!JSON.stringify(storedOperations(aa.storage,f.a.user.id)).includes(f.a.token));
  assert.throws(() => { aa.c.getState().current.confirmed = true; }, TypeError);
});

test('exchange client: double click shares frozen operation, different two-photo choice cannot replace it', async t => {
  const f = await fixture(t), started = deferred(), gate = deferred(); let posts = 0;
  const aa = f.client(f.a, { fetch: async (url, options) => { const response = await fetch(url, options); if (options.method === 'POST') { posts++; started.resolve(); await gate.promise; } return response; } });
  const first = aa.c.create(f.room.id, f.payload), duplicate = aa.c.create(f.room.id, f.payload); assert.equal(first, duplicate); await started.promise;
  assert.throws(() => aa.c.create(f.room.id, { ...f.payload, offeredRevision: 2 }), e => e.code === 'OPERATION_PENDING');
  gate.resolve(); await first; assert.equal(posts, 1); assert.equal(aa.c.getState().pending.length, 0);
  const bb = f.client(f.b, { fetch: async (url, options) => { if (options.method === 'POST') posts++; return fetch(url, options); } });
  await bb.c.open(aa.c.getState().current.id); const accepted = bb.c.respond('accept', { revision: 1, exchangeConsent: true });
  assert.equal(accepted, bb.c.respond('accept', { revision: 1, exchangeConsent: true })); await accepted; assert.equal(posts, 2);
});

test('exchange client: lost write keeps exact key and payload across reload, old accepted receipt does not revive revoke', async t => {
  const f = await fixture(t), calls = []; let lose = true;
  const fetcher = async (url, options) => { const response = await fetch(url, options); if (options.method === 'POST') { calls.push({ url, body: options.body, key: options.headers['Idempotency-Key'] }); if (lose) { lose = false; throw Error('Synthetic loss'); } } return response; };
  const aa = f.client(f.a, { fetch: fetcher }); await assert.rejects(aa.c.create(f.room.id, f.payload), e => e.uncertain); const op = aa.c.getState().pending[0]; aa.c.dispose();
  const restored = f.client(null, { storage: aa.storage, fetch: fetcher }); await restored.c.retry(op.id); assert.deepEqual(calls[0], calls[1]);
  const id = restored.c.getState().current.id, bb = f.client(f.b, { fetch: fetcher }); await bb.c.open(id); lose = true;
  await assert.rejects(bb.c.respond('accept', { revision: 1, exchangeConsent: true }), e => e.uncertain); const accept = bb.c.getState().pending[0];
  await restored.c.refresh(); await restored.c.respond('revoke', { revision: 2 }); await bb.c.retry(accept.id);
  assert.equal(bb.c.getState().current.exchange.status, 'revoked'); await assert.rejects(bb.c.fetchImage({ photoId: f.offered.id }), e => e.code === 'EXCHANGE_UNAVAILABLE');
});

test('exchange client: saved mutation with failed canonical read reports committed without granting images', async t => {
  const f = await fixture(t); let failRead = true;
  const aa = f.client(f.a, { fetch: (url, options) => options.method === 'GET' && /\/exchanges\/[0-9a-f-]{36}$/.test(url) && failRead ? Promise.reject(Error('Synthetic read failure')) : fetch(url, options) });
  const result = await aa.c.create(f.room.id, f.payload); assert.equal(result.committed, true); assert.equal(result.permissionConfirmed, false); assert.equal(aa.c.getState().pending.length, 0);
  await assert.rejects(aa.c.fetchImage({ kind: 'preview' }), e => e.code === 'EXCHANGE_UNAVAILABLE'); failRead = false; await aa.c.refresh(); assert.equal(aa.c.getState().current.confirmed, true);
});

test('exchange client: retry preflight failure cannot turn an unresolved committed write into a dismissible failure', async t => {
  const f = await fixture(t); let stage = 'lose'; const calls = [];
  const aa = f.client(f.a, { fetch: async (url, options) => {
    if (stage === 'preflight' && options.method === 'GET') throw Error('Synthetic preflight outage');
    const response = await fetch(url, options);
    if (options.method === 'POST') { calls.push({ key: options.headers['Idempotency-Key'], body: options.body }); if (stage === 'lose') { stage = 'preflight'; throw Error('Synthetic lost response'); } }
    return response;
  } });
  await assert.rejects(aa.c.create(f.room.id, f.payload), e => e.uncertain); const op = aa.c.getState().pending[0];
  await assert.rejects(aa.c.retry(op.id), e => e.uncertain); assert.equal(aa.c.getState().pending[0].status, 'uncertain');
  assert.throws(() => aa.c.discard(op.id), e => e.code === 'OPERATION_UNCERTAIN');
  aa.c.dispose(); const restored = f.client(null, { storage: aa.storage }); await restored.c.retry(op.id); assert.equal(restored.c.getState().current.exchange.status, 'pending');
  assert.equal((await f.request('/exchanges', f.a.token)).exchanges.length, 1);
});

test('exchange client: a definitive retried POST rejection resolves uncertainty and permits removing the failed attempt', async t => {
  const f = await fixture(t); let dropBeforeSend = true;
  const aa = f.client(f.a, { fetch: (url, options) => { if (options.method === 'POST' && dropBeforeSend) { dropBeforeSend = false; return Promise.reject(Error('Synthetic failure before dispatch')); } return fetch(url, options); } });
  await assert.rejects(aa.c.create(f.room.id, f.payload), e => e.uncertain); const op = aa.c.getState().pending[0];
  await f.request(`/photos/${f.requested.id}`, f.b.token, { visibility: 'members', revision: 1 }, 'PATCH');
  await assert.rejects(aa.c.retry(op.id), e => e.status === 409 && !e.uncertain); assert.equal(aa.c.getState().pending[0].status, 'failed');
  aa.c.discard(op.id); assert.equal(aa.c.getState().pending.length, 0); assert.equal(storedOperations(aa.storage, f.a.user.id).length, 0); assert.equal((await f.request('/exchanges', f.a.token)).exchanges.length, 0);
});

test('exchange client: same-identity tabs persist distinct lost operations in independent atomic storage items', async t => {
  const f = await fixture(t); await f.request(`/rooms/${f.room.code}/join`, f.outsider.token, { joinConsent: true, participation: 'open' });
  const targetC = (await f.request(`/rooms/${f.room.id}/photos`, f.outsider.token, { ...photoData(), visibility: 'members' })).photo;
  const payloadC = { ...f.payload, recipientId: f.outsider.user.id, requestedPhotoId: targetC.id },storage = store(),sent = [];
  const fetcher = async (url, options) => { const response = await fetch(url, options); if (options.method === 'POST') { sent.push(options.headers['Idempotency-Key']); throw Error('Synthetic lost response'); } return response; };
  const first = f.client(f.a, { storage, fetch: fetcher }),second = f.client(null, { storage, fetch: fetcher });
  await Promise.all([assert.rejects(first.c.create(f.room.id, f.payload), e => e.uncertain), assert.rejects(second.c.create(f.room.id, payloadC), e => e.uncertain)]);
  const saved = storedOperations(storage,f.a.user.id).map(value=>JSON.parse(value).operation); assert.equal(saved.length, 2); assert.deepEqual(new Set(saved.map(op=>op.key)),new Set(sent));
  first.c.dispose();second.c.dispose();const restored=f.client(null,{storage});assert.equal(restored.c.getState().pending.length,2);
  for(const op of restored.c.getState().pending)await restored.c.retry(op.id);
  assert.equal(storedOperations(storage,f.a.user.id).length,0);assert.equal((await f.request('/exchanges',f.a.token)).exchanges.length,2);
});

test('exchange client: concurrent successful operations keep their own receipt when one canonical read finishes later', async t => {
  const f=await fixture(t);await f.request(`/rooms/${f.room.code}/join`,f.outsider.token,{joinConsent:true,participation:'open'});
  const targetC=(await f.request(`/rooms/${f.room.id}/photos`,f.outsider.token,{...photoData(),visibility:'members'})).photo,started=deferred(),gate=deferred();let held=false,firstId;
  const aa=f.client(f.a,{fetch:async(url,options)=>{const response=await fetch(url,options);if(options.method==='GET'&&/\/exchanges\/[0-9a-f-]{36}$/.test(url)&&!held){held=true;firstId=url.split('/').at(-1);started.resolve();await gate.promise;}return response;}});
  const first=aa.c.create(f.room.id,f.payload);await started.promise;const second=await aa.c.create(f.room.id,{...f.payload,recipientId:f.outsider.user.id,requestedPhotoId:targetC.id});gate.resolve();const result=await first;
  assert.equal(result.exchangeId,firstId);assert.notEqual(result.exchangeId,second.exchangeId);assert.notEqual(result.operationId,second.operationId);assert.equal(aa.c.getState().lastResult.exchangeId,second.exchangeId);assert.equal(aa.c.getState().lastResult.permissionConfirmed,true);
});

test('exchange client: cross-tab identity replacement clears rows and detaches late writes without old-actor storage overwrite', async t => {
  const f = await fixture(t), started = deferred(), gate = deferred(), calls = [];
  const aa = f.client(f.a, { fetch: async (url, options) => { const result = await fetch(url, options); if (options.method === 'POST') { calls.push({ token: options.headers.Authorization, body: options.body, key: options.headers['Idempotency-Key'] }); started.resolve(); await gate.promise; } return result; } });
  const pending = aa.c.create(f.room.id, f.payload); await started.promise; const oldRecord = storedOperations(aa.storage,f.a.user.id);
  aa.storage.setItem(SESSION_KEY, JSON.stringify(f.outsider)); aa.c.syncIdentity(); assert.equal(aa.c.getState().actorId, f.outsider.user.id); assert.equal(aa.c.getState().pending.length, 0); assert.equal(aa.c.getState().current, null);
  gate.resolve(); assert.equal((await pending).applied, false); assert.deepEqual(storedOperations(aa.storage,f.a.user.id), oldRecord); assert.equal(aa.c.getState().lastResult, null);
  await aa.c.list(); assert.equal(aa.c.getState().list.items.length, 0);
  aa.storage.setItem(SESSION_KEY, JSON.stringify(f.a)); aa.c.syncIdentity(); const op = aa.c.getState().pending[0]; await aa.c.retry(op.id); assert.deepEqual(calls[0], calls[1]);
  assert.equal(calls.length, 2); assert.ok(calls.every(call => call.token === `Bearer ${f.a.token}`));
});

test('exchange client: delayed blob is rejected after close, privacy invalidation or identity replacement', async t => {
  const f = await fixture(t); let waiting = null;
  const aa = f.client(f.a, { fetch: async (url, options) => { const response = await fetch(url, options); if (url.endsWith('/preview') && waiting) { waiting.started.resolve(); await waiting.gate.promise; } return response; } });
  const { exchangeId } = await aa.c.create(f.room.id, f.payload);
  for (const action of ['close', 'privacy', 'identity']) {
    if (action === 'identity') aa.storage.setItem(SESSION_KEY, JSON.stringify(f.a)); await aa.c.open(exchangeId);
    waiting = { started: deferred(), gate: deferred() }; const image = aa.c.fetchImage({ kind: 'preview' }); image.catch(() => {}); await waiting.started.promise;
    if (action === 'close') aa.c.close(); if (action === 'privacy') aa.c.invalidatePermissions({ photoId: f.offered.id });
    if (action === 'identity') { aa.storage.setItem(SESSION_KEY, JSON.stringify(f.outsider)); aa.c.syncIdentity(); }
    waiting.gate.resolve(); await assert.rejects(image, e => ['ABORTED', 'TARGET_CHANGED'].includes(e.code)); waiting = null;
  }
});

test('exchange client: older list cannot restore accepted after a newer revoke', async t => {
  const f = await fixture(t); let waiting = null;
  const aa = f.client(f.a, { fetch: async (url, options) => { const response = await fetch(url, options); if (url.endsWith('/exchanges') && options.method === 'GET' && waiting) { const gate = waiting; waiting = null; gate.started.resolve(); await gate.gate.promise; } return response; } }), bb = f.client(f.b);
  const { exchangeId } = await aa.c.create(f.room.id, f.payload); await bb.c.open(exchangeId); await bb.c.respond('accept', { revision: 1, exchangeConsent: true }); await aa.c.refresh();
  waiting = { started: deferred(), gate: deferred() }; const hold = waiting, oldList = aa.c.list(); oldList.catch(() => {}); await hold.started.promise;
  await aa.c.respond('revoke', { revision: 2 }); hold.gate.resolve(); await assert.rejects(oldList, e => e.code === 'ABORTED');
  assert.equal(aa.c.getState().current.exchange.status, 'revoked');
});

test('exchange client: denied storage never transmits mutation or preview, forged session actor fails before write', async t => {
  const f = await fixture(t); let posts = 0; const storage = store(); storage.setItem(SESSION_KEY, JSON.stringify(f.a)); storage.setItem = () => { throw Error('Quota'); };
  const aa = f.client(null, { storage, fetch: (url, options) => { if (options.method === 'POST') posts++; return fetch(url, options); } });
  assert.throws(() => aa.c.create(f.room.id, f.payload), e => e.code === 'STORAGE_REQUIRED'); assert.equal(posts, 0);
  const forged = f.client({ token: f.a.token, user: f.outsider.user }, { fetch: (url, options) => { if (options.method === 'POST') posts++; return fetch(url, options); } });
  await assert.rejects(forged.c.create(f.room.id, f.payload), e => e.code === 'ACTOR_MISMATCH'); assert.equal(posts, 0); assert.equal(forged.c.getState().identityStatus, 'invalid');
});
