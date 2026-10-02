import { removeTempAfterTests } from './helpers/temp-directory.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createAvatarApi } from '../server/avatar-api.js';
import { createEventApi } from '../server/event-api.js';
import { createEventStore } from '../server/event-store.js';
import { createAvatarWorker } from '../runtime-preview/src/avatar-worker.js';
import { createEventWorker } from '../runtime-preview/src/event-worker.js';
import { createFakeEnv } from '../runtime-preview/tests/d1-adapter.mjs';
import { photoData } from './event-contract.test.js';

async function fixture(t, mode = 'Node', { rateLimits = false } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'musicspace-chat-'));
  let time = Date.parse('2026-09-30T10:00:00Z'), env, server, avatar, event, base;
  async function start() {
    if (mode === 'Worker') { env = createFakeEnv(join(dir, 'events.sqlite')); return; }
    avatar = createAvatarApi({ dataDir: dir, clock: () => time, rateLimits: false });
    event = createEventApi({ dataDir: dir, clock: () => time, rateLimits });
    server = createServer(async (req, res) => { if (!await event(req, res) && !await avatar(req, res)) { res.writeHead(404); res.end(); } });
    server.listen(0, '127.0.0.1'); await once(server, 'listening'); base = `http://127.0.0.1:${server.address().port}`;
  }
  async function stop() {
    if (mode === 'Worker') { env.DB.close(); return; }
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); avatar.close(); event.close();
  }
  await start(); t.after(async () => { await stop(); await removeTempAfterTests(dir); });
  const controllers = []; t.after(() => controllers.forEach(c => c.dispose()));
  const f = { dir, get baseUrl() { return base; }, get env() { return env; }, advance: ms => time += ms, restart: async () => { await stop(); await start(); },
    async request(path, { method = 'GET', token, data, key = randomUUID(), headers = {} } = {}) {
      const suffix = path.startsWith('/api/') ? path : '/api/event' + path;
      const options = { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(data === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(method === 'GET' || key === null ? {} : { 'Idempotency-Key': key }), ...headers }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) };
      const result = mode === 'Node' ? await fetch(base + suffix, options) : await (suffix.startsWith('/api/avatar') ? createAvatarWorker({ clock: () => time, rateLimits: false }) : createEventWorker({ clock: () => time, rateLimits })).fetch(new Request('https://musicspace.test' + suffix, options), env);
      const bytes = Buffer.from(await result.arrayBuffer());
      return { status: result.status, headers: result.headers, bytes, body: result.headers.get('Content-Type')?.includes('json') ? JSON.parse(bytes) : null };
    },
  };
  f.session = async name => (await f.request('/api/avatar/session', { method: 'POST', data: { name } })).body;
  f.room = async a => (await f.request('/rooms', { method: 'POST', token: a.token, data: { title: '合成现场', venue: '合成场地', songId: 'late-train', joinConsent: true } })).body.room;
  f.join = (room, a) => f.request(`/rooms/${room.code}/join`, { method: 'POST', token: a.token, data: { joinConsent: true } });
  f.send = (room, a, b, options = {}) => f.request(`/rooms/${room.id}/greetings`, { method: 'POST', token: a.token, data: { recipientId: b.user.id }, ...options });
  f.respond = (greeting, action, a, options = {}) => f.request(`/greetings/${greeting.id}/${action}`, { method: 'POST', token: a.token, data: { revision: greeting.revision }, ...options });
  f.block = (a, b, options = {}) => f.request(`/blocks/${b.user.id}`, { method: 'POST', token: a.token, data: {}, ...options });
  f.unblock = (a, b, revision, options = {}) => f.request(`/blocks/${b.user.id}`, { method: 'DELETE', token: a.token, data: { revision }, ...options });
  f.social = async a => { const r = await f.request('/social', { token: a.token }); assert.equal(r.status, 200, JSON.stringify(r.body)); return r.body; };
  f.upload = async (room, a, visibility) => (await f.request(`/rooms/${room.id}/photos`, { method: 'POST', token: a.token, data: { ...photoData(), visibility } })).body.photo;
  f.two = async () => { const a = await f.session('A'), b = await f.session('B'), room = await f.room(a); assert.equal((await f.join(room, b)).status, 200); return { a, b, room }; };
  f.chatSend = (a, b, text = '合成测试消息', options = {}) => f.request(`/chats/${b.user.id}/messages`, { method: 'POST', token: a.token, data: { text }, ...options });
  f.messages = (a, b, query = '') => f.request(`/chats/${b.user.id}/messages${query}`, { token: a.token });
  f.ack = (a, b, ids, options = {}) => f.request(`/chats/${b.user.id}/read`, { method: 'POST', token: a.token, data: { messageIds: ids }, ...options });
  f.friends = async () => { const pair = await f.two(); const greeting = (await f.send(pair.room, pair.a, pair.b)).body.greeting; assert.equal((await f.respond(greeting, 'accept', pair.b)).status, 200); return pair; };
  f.client = (actor, { storage = localStore(), ...options } = {}) => {
    if (actor) storage.setItem(SESSION_KEY, JSON.stringify(actor));
    const c = createChatController({ storage, baseUrl: base, timeoutMs: 2000, ...options }); controllers.push(c); return { c, storage };
  };
  return f;
}



import { createChatController, CHAT_STORAGE_KEY, CHAT_OPERATION_PREFIX, CHAT_DRAFT_PREFIX } from '../web/event-client/chat-controller.js';
const SESSION_KEY = 'music-space-avatar-session:v1';
const localStore = () => { const rows = new Map(); return { get length(){return rows.size;},key:index=>[...rows.keys()][index]??null,getItem: k => rows.get(k) ?? null, setItem: (k,v) => rows.set(k,String(v)), removeItem: k => rows.delete(k) }; };
const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; };

test('chat controller: explicit methods, secret-free immutable state, server-saved is not read', async t => {
  const f = await fixture(t), { a, b } = await f.friends(); let reads = 0;
  const aa = f.client(a, { fetch: async (...args) => { reads++; return fetch(...args); } }), bb = f.client(b);
  assert.equal(reads, 0); const seen = []; aa.c.subscribe(s => seen.push(s)); assert.equal(seen.length, 1);
  await aa.c.list(); assert.equal(aa.c.getState().list.items.length, 0);
  await aa.c.open(b.user.id); aa.c.setDraft('保留换行\n🎵'); const saved = await aa.c.send();
  assert.equal(saved.message.text, '保留换行\n🎵'); assert.equal(aa.c.getState().draft, ''); assert.equal(aa.c.getState().current.messages[0].readAt, null);
  await bb.c.list(); assert.equal(bb.c.getState().list.items[0].unreadCount, 1);
  await bb.c.open(a.user.id); assert.equal(bb.c.getState().current.chat.unreadCount, 1); await aa.c.refresh(); assert.equal(aa.c.getState().current.messages[0].readAt, null);
  await bb.c.acknowledge([saved.message.id]); await aa.c.refresh(); assert.ok(aa.c.getState().current.messages[0].readAt); assert.equal(bb.c.getState().current.chat.unreadCount, 0);
  assert.throws(() => aa.c.acknowledge([saved.message.id]), e => e.code === 'INVALID_READ_ACK');
  assert.ok(!JSON.stringify([aa.c.getState(), bb.c.getState()]).includes(a.token)); assert.ok(!aa.storage.getItem(CHAT_STORAGE_KEY).includes(a.token));
  assert.throws(() => { aa.c.getState().current.chat.canSend = false; }, TypeError);
});

test('chat controller: one frozen send per peer, double click does not duplicate and newer draft is preserved', async t => {
  const f = await fixture(t), { a, b } = await f.friends(), began = deferred(), gate = deferred(); let posts = 0;
  const aa = f.client(a, { fetch: async (url, options) => { const response = await fetch(url, options); if (options.method === 'POST' && url.endsWith('/messages')) { posts++; began.resolve(); await gate.promise; } return response; } });
  await aa.c.open(b.user.id); aa.c.setDraft('第一次'); const first = aa.c.send(), duplicate = aa.c.send(); assert.equal(first, duplicate); await began.promise;
  aa.c.setDraft('下一条草稿'); gate.resolve(); await first;
  assert.equal(posts, 1); assert.equal(aa.c.getState().draft, '下一条草稿'); assert.equal(aa.c.getState().outbox.length, 0);
  assert.equal((await f.messages(b, a)).body.messages.length, 1);
});

test('chat controller: lost send survives reload/restart with frozen peer/text/key; replay after block stays read-only', async t => {
  const f = await fixture(t), { a, b } = await f.friends(), sent = []; let lose = true;
  const fetcher = async (url, options) => { const response = await fetch(url, options); if (options.method === 'POST' && url.endsWith('/messages')) { sent.push({ path: new URL(url).pathname, text: options.body, key: options.headers['Idempotency-Key'] }); if (lose) { lose = false; throw Error('Synthetic lost response'); } } return response; };
  const aa = f.client(a, { fetch: fetcher }); await aa.c.open(b.user.id); aa.c.setDraft('准确重试原文'); await assert.rejects(aa.c.send(), e => e.uncertain);
  const op = aa.c.getState().outbox[0]; assert.equal(op.status, 'uncertain'); assert.equal(op.text, '准确重试原文');
  const savedKey = JSON.parse(aa.storage.getItem(CHAT_STORAGE_KEY)).operations[0].key; assert.ok(!JSON.stringify(aa.c.getState()).includes(savedKey));
  aa.c.setDraft('更晚草稿保留'); aa.c.dispose(); await f.block(b, a); await f.restart();
  const restored = f.client(null, { storage: aa.storage, fetch: fetcher }); await restored.c.open(b.user.id); assert.equal(restored.c.getState().current.chat.canSend, false);
  const result = await restored.c.retry(op.id); assert.equal(result.canSend, false); assert.equal(restored.c.getState().current.chat.canSend, false);
  assert.deepEqual(sent[0], sent[1]); assert.equal(restored.c.getState().draft, '更晚草稿保留'); assert.equal(restored.c.getState().outbox.length, 0);
  assert.equal((await f.messages(b, a)).body.messages.length, 1);
});

test('chat controller: late open/refresh never overwrites newer conversation or closed view', async t => {
  const f = await fixture(t), { a, b } = await f.friends(), third = await f.session('C'), room = await f.room(a); await f.join(room, third);
  const greeting = (await f.send(room, a, third)).body.greeting; await f.respond(greeting, 'accept', third);
  const began = deferred(), gate = deferred(); let hold = true;
  const aa = f.client(a, { fetch: async (url, options) => { const response = await fetch(url, options); if (hold && options.method === 'GET' && url.endsWith(`/chats/${b.user.id}/messages`)) { hold = false; began.resolve(); await gate.promise; } return response; } });
  const old = aa.c.open(b.user.id).catch(e => e); await began.promise; await aa.c.open(third.user.id); gate.resolve(); await old;
  assert.equal(aa.c.getState().current.peerId, third.user.id);
  aa.c.setDraft('C的草稿'); aa.c.close(); assert.equal(aa.c.getState().current, null); await aa.c.open(third.user.id); assert.equal(aa.c.getState().draft, 'C的草稿');
});

test('chat controller: late send response cannot revive canSend after fresher block read', async t => {
  const f = await fixture(t), { a, b } = await f.friends(), began = deferred(), gate = deferred(); let hold = true;
  const aa = f.client(a, { fetch: async (url, options) => { const response = await fetch(url, options); if (hold && options.method === 'POST' && url.endsWith('/messages')) { hold = false; began.resolve(); await gate.promise; } return response; } });
  await aa.c.open(b.user.id); aa.c.setDraft('先存后屏蔽'); const pending = aa.c.send(); await began.promise; await f.block(b, a); await aa.c.refresh();
  assert.equal(aa.c.getState().current.chat.canSend, false); gate.resolve(); const result = await pending;
  assert.equal(result.canSend, false); assert.equal(aa.c.getState().current.chat.canSend, false); assert.equal(aa.c.getState().current.messages.length, 1);
});

test('chat controller: identity switch clears private state, draft/outbox isolation and reconnect clears old error', async t => {
  const f = await fixture(t), { a, b } = await f.friends(); let lose = true;
  const aa = f.client(a, { fetch: async (url, options) => { const response = await fetch(url, options); if (lose && options.method === 'POST' && url.endsWith('/messages')) { lose = false; throw Error('Synthetic loss'); } return response; } });
  await aa.c.open(b.user.id); aa.c.setDraft('A草稿'); await assert.rejects(aa.c.send()); const op = aa.c.getState().outbox[0];
  aa.storage.setItem(SESSION_KEY, JSON.stringify(b)); aa.c.syncIdentity(b);
  assert.equal(aa.c.getState().actorId, b.user.id); assert.equal(aa.c.getState().current, null); assert.equal(aa.c.getState().draft, ''); assert.deepEqual(aa.c.getState().outbox, []); assert.equal(aa.c.getState().error, null);
  assert.throws(() => aa.c.retry(op.id), e => e.code === 'IDENTITY_CHANGED');
  aa.storage.setItem(SESSION_KEY, JSON.stringify(a)); aa.c.syncIdentity(a); await aa.c.open(b.user.id); assert.equal(aa.c.getState().draft, 'A草稿'); assert.equal(aa.c.getState().outbox.length, 1);
  await aa.c.retry(op.id); assert.equal(aa.c.getState().outbox.length, 0);
});

test('chat controller: storage failure keeps draft and prevents untracked new sends', async t => {
  const f = await fixture(t), { a, b } = await f.friends(), storage = localStore(); let blocked = false, posts = 0;
  const set = storage.setItem; storage.setItem = (key, value) => { if (blocked && key === CHAT_STORAGE_KEY) throw Error('Quota'); set(key, value); };
  const aa = f.client(a, { storage, fetch: async (url, options) => { if (options.method === 'POST') posts++; return fetch(url, options); } });
  await aa.c.open(b.user.id); blocked = true; aa.c.setDraft('没丢的草稿'); assert.throws(() => aa.c.send(), e => e.code === 'STORAGE_REQUIRED');
  assert.equal(posts, 0); assert.equal(aa.c.getState().draft, '没丢的草稿'); assert.equal(aa.c.getState().storage.refreshRecovery, false);
  blocked = false; await aa.c.send(); assert.equal(posts, 1); assert.equal(aa.c.getState().draft, '');
});

test('chat controller: old token401 clears history and cannot silently substitute identity', async t => {
  const f = await fixture(t), { a, b } = await f.friends(), aa = f.client(a); await aa.c.open(b.user.id);
  aa.storage.setItem(SESSION_KEY, JSON.stringify({ ...a, token: 'x'.repeat(43) })); aa.c.syncIdentity(JSON.parse(aa.storage.getItem(SESSION_KEY)));
  await assert.rejects(aa.c.open(b.user.id), e => e.status === 401); assert.equal(aa.c.getState().identityStatus, 'invalid'); assert.equal(aa.c.getState().current, null);
  assert.throws(() => aa.c.send(), e => e.code === 'IDENTITY_REQUIRED');
  aa.storage.setItem(SESSION_KEY, JSON.stringify(a)); aa.c.syncIdentity(a); assert.equal(aa.c.getState().error, null); await aa.c.open(b.user.id); assert.equal(aa.c.getState().current.chat.canSend, true);
});

test('chat controller: refresh catches up across more than50 new messages without gaps or duplicate ordering', async t => {
  const f = await fixture(t), { a, b } = await f.friends(), aa = f.client(a);
  const first = (await f.chatSend(b, a, 'first')).body.message; await aa.c.open(b.user.id);
  const later = []; for (let n = 0; n < 121; n++) later.push((await f.chatSend(b, a, 'after-' + n)).body.message);
  await aa.c.refresh(); assert.deepEqual(aa.c.getState().current.messages.map(m => m.id), [first, ...later].map(m => m.id));
  assert.equal(aa.c.getState().current.chat.unreadCount, 122); assert.equal(aa.c.getState().current.olderCursor, null);
  await aa.c.acknowledge([first.id]); assert.equal(aa.c.getState().current.chat.unreadCount, 121);
});

test('chat controller: silent storage identity change prevents late read adoption and clears old private state', async t => {
  const f = await fixture(t), { a, b } = await f.friends(), began = deferred(), gate = deferred(); let hold = true;
  const aa = f.client(a, { fetch: async (url, options) => { const response = await fetch(url, options); if (hold && options.method === 'GET' && url.includes('/messages')) { hold = false; began.resolve(); await gate.promise; } return response; } });
  const pending = aa.c.open(b.user.id); await began.promise; aa.storage.setItem(SESSION_KEY, JSON.stringify(b)); gate.resolve();
  const result = await pending; assert.equal(result.applied, false); assert.equal(aa.c.getState().actorId, b.user.id); assert.equal(aa.c.getState().current, null); assert.equal(aa.c.getState().draft, '');
});

test('chat controller: late send completion after navigation updates no other peer draft or history', async t => {
  const f = await fixture(t), { a, b, room } = await f.friends(), third = await f.session('C'); await f.join(room, third);
  const greeting = (await f.send(room, a, third)).body.greeting; await f.respond(greeting, 'accept', third);
  const began = deferred(), gate = deferred(); let hold = true;
  const aa = f.client(a, { fetch: async (url, options) => { const response = await fetch(url, options); if (hold && options.method === 'POST' && url.endsWith('/messages')) { hold = false; began.resolve(); await gate.promise; } return response; } });
  await aa.c.open(b.user.id); aa.c.setDraft('只发给B'); const pending = aa.c.send(); await began.promise;
  await aa.c.open(third.user.id); aa.c.setDraft('C草稿'); gate.resolve(); const result = await pending;
  assert.equal(result.applied, false); assert.equal(aa.c.getState().current.peerId, third.user.id); assert.equal(aa.c.getState().current.messages.length, 0); assert.equal(aa.c.getState().draft, 'C草稿');
  assert.equal((await f.messages(b, a)).body.messages[0].text, '只发给B');
});

test('chat controller: malformed persisted outbox cannot change an actor, peer or endpoint', async t => {
  const f = await fixture(t), { a, b } = await f.friends(), storage = localStore();
  storage.setItem(CHAT_STORAGE_KEY, JSON.stringify({ version: 1, operations: [
    { id: randomUUID(), key: randomUUID(), type: 'send', actorId: a.user.id, peerId: a.user.id, text: 'self' },
    { id: randomUUID(), key: randomUUID(), type: 'upload', actorId: a.user.id, peerId: b.user.id, text: 'injected' },
    { id: randomUUID(), key: randomUUID(), type: 'read', actorId: a.user.id, peerId: b.user.id, messageIds: [randomUUID(), 'not-id'] },
  ] }));
  const aa = f.client(a, { storage }); assert.deepEqual(aa.c.getState().outbox, []);
});

test('chat controller: normal refresh makes one request and an initially empty chat retains new older-page access', async t => {
  const f = await fixture(t), { a, b } = await f.friends(); let messageReads = 0;
  const aa = f.client(a, { fetch: async (url, options) => { if (options.method === 'GET' && url.includes('/messages')) messageReads++; return fetch(url, options); } });
  await aa.c.open(b.user.id); messageReads = 0; await aa.c.refresh(); assert.equal(messageReads, 1);
  for (let n = 0; n < 55; n++) await f.chatSend(b, a, 'queued-' + n);
  await aa.c.refresh(); assert.equal(aa.c.getState().current.messages.length, 50); assert.ok(aa.c.getState().current.olderCursor);
  await aa.c.older(); assert.equal(aa.c.getState().current.messages.length, 55); assert.equal(aa.c.getState().current.olderCursor, null);
});

test('chat controller: old-page acknowledgment is not repeatedly transmitted merely because recent-page refresh omits it', async t => {
  const f = await fixture(t), { a, b } = await f.friends(); let acks = 0;
  const aa = f.client(a, { fetch: async (url, options) => { if (options.method === 'POST' && url.endsWith('/read')) acks++; return fetch(url, options); } });
  const first = (await f.chatSend(b, a, 'old')).body.message; await aa.c.open(b.user.id);
  for (let n = 0; n < 60; n++) await f.chatSend(b, a, 'new-' + n);
  await aa.c.refresh(); await aa.c.acknowledge([first.id]); await aa.c.acknowledge([first.id]); assert.equal(acks, 1);
});

test('chat controller: definitive failed operations can be discarded but uncertain sends cannot', async t => {
  const f = await fixture(t), { a, b } = await f.friends(), aa = f.client(a);
  await aa.c.open(b.user.id); aa.c.setDraft('清楚地未发出'); await f.block(b, a);
  await assert.rejects(aa.c.send(), e => e.status === 404);
  const failed = aa.c.getState().outbox[0]; assert.equal(failed.status, 'failed'); aa.c.discard(failed.id); assert.equal(aa.c.getState().outbox.length, 0); assert.equal(aa.c.getState().draft, '清楚地未发出');
  const c = f.client(b, { fetch: async () => { throw Error('Offline'); } });
  const storage = c.storage; storage.setItem(CHAT_STORAGE_KEY, JSON.stringify({ version: 1, operations: [{ id: randomUUID(), key: randomUUID(), actorId: b.user.id, peerId: a.user.id, type: 'send', text: 'unknown', status: 'uncertain' }] })); c.c.dispose();
  // dispose preserves its actual state; inject again as a previously interrupted tab.
  const id = randomUUID(); storage.setItem(CHAT_STORAGE_KEY, JSON.stringify({ version: 1, operations: [{ id, key: randomUUID(), actorId: b.user.id, peerId: a.user.id, type: 'send', text: 'unknown', status: 'uncertain' }] }));
  const restored = f.client(null, { storage }); assert.throws(() => restored.c.discard(id), e => e.code === 'OPERATION_UNCERTAIN');
});

test('chat controller: unread total includes an unloaded51st chat and read ack refreshes total without collapsing loaded pages', async t => {
  const f = await fixture(t), { a, b, room } = await f.friends(), sql = new DatabaseSync(join(f.dir, 'avatar-space.sqlite'));
  t.after(() => sql.close()); sql.exec('PRAGMA foreign_keys=ON');
  const lastId = 'ffffffff-ffff-4fff-bfff-ffffffffffff';
  sql.prepare('UPDATE event_social_pairs SET id=? WHERE (low_id=? AND high_id=?)').run(lastId, ...[a.user.id, b.user.id].sort());
  const stamp = '2026-09-30T10:00:00.000Z';
  for (let n = 0; n < 50; n++) {
    const id = randomUUID(), pairId = randomUUID(), person = { id, name: 'Synthetic peer ' + n, avatar: a.user.avatar }, [low, high] = [a.user.id, id].sort();
    sql.prepare('INSERT INTO avatar_users (id,name,avatar,token_hash,revision,created_at) VALUES (?,?,?,?,1,?)').run(id, person.name, JSON.stringify(person.avatar), randomUUID(), stamp);
    sql.prepare("INSERT INTO event_social_pairs (id,low_id,high_id,status,revision,greeting_id,sender_id,recipient_id,room_id,created_at,updated_at,friends_at) VALUES (?,?,?,'accepted',2,?,?,?,?,?,?,?)").run(pairId, low, high, randomUUID(), a.user.id, id, room.id, stamp, stamp, stamp);
    sql.prepare('INSERT INTO event_chat_threads (pair_id,low_profile,high_profile,created_at,updated_at) VALUES (?,?,?,?,?)').run(pairId, JSON.stringify(low === a.user.id ? a.user : person), JSON.stringify(high === a.user.id ? a.user : person), stamp, stamp);
    sql.prepare('INSERT INTO event_chat_messages (id,pair_id,sender_id,recipient_id,text,created_at) VALUES (?,?,?,?,?,?)').run(randomUUID(), pairId, a.user.id, id, 'Outgoing has no unread for A', stamp);
  }
  const aa = f.client(a), firstMessage = (await f.chatSend(b, a, 'Unloaded first')).body.message;
  await aa.c.list(); assert.equal(aa.c.getState().list.items.length, 50); assert.equal(aa.c.getState().list.totalUnreadCount, 1);
  assert.equal(aa.c.getState().list.items.reduce((n, chat) => n + chat.unreadCount, 0), 0);
  const secondMessage = (await f.chatSend(b, a, 'Unloaded new message')).body.message;
  await aa.c.list(); assert.equal(aa.c.getState().list.totalUnreadCount, 2); assert.ok(!aa.c.getState().list.items.some(chat => chat.userId === b.user.id));
  await aa.c.list({ cursor: aa.c.getState().list.nextCursor }); assert.equal(aa.c.getState().list.items.length, 51);
  await aa.c.open(b.user.id); await aa.c.acknowledge([firstMessage.id, secondMessage.id]);
  assert.equal(aa.c.getState().list.totalUnreadCount, 0); assert.equal(aa.c.getState().list.items.length, 51); assert.equal(aa.c.getState().list.nextCursor, null);
});

test('chat controller: legal A-to-C storage replacement drops delayed current/list/unread reads before applying any old data', async t => {
  const f = await fixture(t), { a, b } = await f.friends(), c = await f.session('C'); await f.chatSend(b, a, 'A private incoming');
  const gates = { list: deferred(), messages: deferred() }, starts = { list: deferred(), messages: deferred() }; let hold = false;
  const aa = f.client(a, { fetch: async (url, options) => { const response = await fetch(url, options); if (hold && options.method === 'GET') { const kind = url.endsWith('/chats') ? 'list' : url.includes('/messages') ? 'messages' : null; if (kind) { starts[kind].resolve(); await gates[kind].promise; } } return response; } });
  await aa.c.list(); await aa.c.open(b.user.id); aa.c.setDraft('A private draft'); assert.equal(aa.c.getState().list.totalUnreadCount, 1);
  hold = true; const list = aa.c.list(), current = aa.c.refresh(); await Promise.all([starts.list.promise, starts.messages.promise]);
  aa.storage.setItem(SESSION_KEY, JSON.stringify(c)); gates.list.resolve(); gates.messages.resolve();
  const results = await Promise.all([list, current]); assert.ok(results.every(r => r.applied === false));
  const state = aa.c.getState(); assert.equal(state.actorId, c.user.id); assert.equal(state.current, null); assert.equal(state.list.items.length, 0); assert.equal(state.list.totalUnreadCount, 0); assert.equal(state.draft, ''); assert.equal(state.outbox.length, 0);
  assert.ok(!JSON.stringify(state).includes('A private')); assert.equal((await f.messages(c, b)).status, 404);
});

test('chat controller: legal A-to-C replacement during send preserves A frozen retry and never writes A completion into C state', async t => {
  const f = await fixture(t), { a, b } = await f.friends(), { a: c, b: d } = await f.friends(); await f.chatSend(d, c, 'C incoming');
  const began = deferred(), gate = deferred(), sent = []; let hold = true;
  const aa = f.client(a, { fetch: async (url, options) => { const response = await fetch(url, options); if (options.method === 'POST' && url.endsWith('/messages')) { sent.push({ token: options.headers.Authorization, key: options.headers['Idempotency-Key'], body: options.body, url }); if (hold) { hold = false; began.resolve(); await gate.promise; } } return response; } });
  await aa.c.open(b.user.id); aa.c.setDraft('Only A to B'); const sending = aa.c.send(); await began.promise;
  const op = aa.c.getState().outbox[0], durableBefore = JSON.parse(aa.storage.getItem(CHAT_STORAGE_KEY)).operations[0];
  aa.storage.setItem(SESSION_KEY, JSON.stringify(c)); aa.c.syncIdentity();
  assert.equal(aa.c.getState().current, null); assert.equal(aa.c.getState().outbox.length, 0);
  assert.throws(() => aa.c.retry(op.id), error => error.code === 'IDENTITY_CHANGED'); // Even while the old promise is running.
  await aa.c.list(); await aa.c.open(d.user.id); aa.c.setDraft('C own draft'); const cState = aa.c.getState(); assert.equal(cState.list.totalUnreadCount, 1);
  gate.resolve(); const result = await sending; assert.deepEqual(result, { operationId: op.id, applied: false });
  const after = aa.c.getState(); assert.equal(after.actorId, c.user.id); assert.equal(after.current.peerId, d.user.id); assert.equal(after.draft, 'C own draft'); assert.equal(after.list.totalUnreadCount, 1); assert.equal(after.current.messages[0].text, 'C incoming'); assert.equal(after.outbox.length, 0); assert.equal(after.lastResult, null);
  const persisted = JSON.parse(aa.storage.getItem(CHAT_STORAGE_KEY)), original = persisted.operations.find(row => row.id === op.id);
  assert.equal(original.actorId, a.user.id); assert.equal(original.key, durableBefore.key); assert.equal(original.text, 'Only A to B');
  assert.equal(persisted.drafts.find(row => row.actorId === a.user.id && row.peerId === b.user.id).text, 'Only A to B');
  aa.storage.setItem(SESSION_KEY, JSON.stringify(a)); aa.c.syncIdentity(); await aa.c.open(b.user.id); assert.equal(aa.c.getState().outbox[0].status, 'uncertain');
  await aa.c.retry(op.id); assert.equal(aa.c.getState().outbox.length, 0); assert.equal((await f.messages(b, a)).body.messages.length, 1);
  assert.equal(sent.length, 2); assert.equal(sent[0].key, sent[1].key); assert.equal(sent[0].body, sent[1].body); assert.ok(sent.every(row => row.token === `Bearer ${a.token}`));
});

test('chat controller: offline syncIdentity event clears private state immediately and rejects a stale supplied session', async t => {
  const f = await fixture(t), { a, b } = await f.friends(), c = await f.session('C'), storage = localStore(); let offline = false, requests = 0;
  const op = { id: randomUUID(), key: randomUUID(), actorId: a.user.id, peerId: b.user.id, type: 'send', text: 'A durable retry', status: 'uncertain' };
  storage.setItem(CHAT_STORAGE_KEY, JSON.stringify({ version: 1, operations: [op] })); await f.chatSend(b, a, 'A unread');
  const aa = f.client(a, { storage, fetch: async (...args) => { requests++; if (offline) throw Error('Offline'); return fetch(...args); } });
  await aa.c.list(); await aa.c.open(b.user.id); aa.c.setDraft('A unsent'); const before = requests; offline = true;
  storage.setItem(SESSION_KEY, JSON.stringify(c)); aa.c.syncIdentity();
  assert.equal(requests, before); assert.equal(aa.c.getState().actorId, c.user.id); assert.equal(aa.c.getState().current, null); assert.equal(aa.c.getState().list.totalUnreadCount, 0); assert.equal(aa.c.getState().draft, ''); assert.deepEqual(aa.c.getState().outbox, []);
  aa.c.syncIdentity(a); assert.equal(aa.c.getState().actorId, c.user.id); assert.equal(requests, before);
  assert.throws(() => aa.c.retry(op.id), error => error.code === 'IDENTITY_CHANGED');
  assert.equal(JSON.parse(storage.getItem(CHAT_STORAGE_KEY)).operations[0].key, op.key);
});

test('chat controller: dispose after external A-to-C store replacement never overwrites C chat bytes', async t => {
  const f = await fixture(t), { a, b } = await f.friends(), c = await f.session('C'), aa = f.client(a);
  await aa.c.open(b.user.id); aa.c.setDraft('A old draft');
  const replacement = JSON.stringify({ version: 1, drafts: [{ actorId: c.user.id, peerId: b.user.id, text: 'C external draft', version: 1 }], operations: [] });
  aa.storage.setItem(SESSION_KEY, JSON.stringify(c)); aa.storage.setItem(CHAT_STORAGE_KEY, replacement);
  aa.c.dispose(); assert.equal(aa.storage.getItem(CHAT_STORAGE_KEY), replacement); assert.equal(JSON.parse(aa.storage.getItem(SESSION_KEY)).token, c.token);
});

test('chat controller: dispose after storage was cleared cannot resurrect old drafts or credentials', async t => {
  const f = await fixture(t), { a, b } = await f.friends(), aa = f.client(a);
  await aa.c.open(b.user.id); aa.c.setDraft('Must stay cleared');
  aa.storage.removeItem(SESSION_KEY); aa.storage.removeItem(CHAT_STORAGE_KEY);
  aa.c.dispose(); assert.equal(aa.storage.getItem(CHAT_STORAGE_KEY), null); assert.equal(aa.storage.getItem(SESSION_KEY), null);
});

test('chat controller: no-write disposal preserves an already durable uncertain send and its exact retry key', async t => {
  const f = await fixture(t), { a, b } = await f.friends(); let lose = true; const posts = [];
  const fetcher = async (url, options) => { const response = await fetch(url, options); if (options.method === 'POST' && url.endsWith('/messages')) { posts.push(options.headers['Idempotency-Key']); if (lose) { lose = false; throw Error('Synthetic loss'); } } return response; };
  const aa = f.client(a, { fetch: fetcher }); await aa.c.open(b.user.id); aa.c.setDraft('Already durable before disposal'); await assert.rejects(aa.c.send(), e => e.uncertain);
  const op = aa.c.getState().outbox[0], bytes = aa.storage.getItem(CHAT_STORAGE_KEY); aa.c.dispose(); assert.equal(aa.storage.getItem(CHAT_STORAGE_KEY), bytes);
  const restored = f.client(null, { storage: aa.storage, fetch: fetcher }); await restored.c.retry(op.id);
  assert.equal(posts.length, 2); assert.equal(posts[0], posts[1]); assert.equal((await f.messages(b, a)).body.messages.length, 1); assert.equal(restored.c.getState().outbox.length, 0);
});

test('chat controller: failed actor preflight after reload cannot discard an earlier unresolved message', async t => {
  const f=await fixture(t),{a,b}=await f.friends();let lose=true;
  const aa=f.client(a,{fetch:async(url,options)=>{const response=await fetch(url,options);if(lose&&options.method==='POST'&&url.endsWith('/messages')){lose=false;throw Error('Synthetic committed response loss');}return response;}});
  await aa.c.open(b.user.id);aa.c.setDraft('这条已存但未确认');await assert.rejects(aa.c.send(),e=>e.uncertain);const op=aa.c.getState().outbox[0];aa.c.dispose();
  let offline=true;const restored=f.client(null,{storage:aa.storage,fetch:(url,options)=>offline&&options.method==='GET'?Promise.reject(Error('Synthetic preflight failure')):fetch(url,options)});
  await assert.rejects(restored.c.retry(op.id),e=>e.uncertain);assert.equal(restored.c.getState().outbox[0].status,'uncertain');assert.throws(()=>restored.c.discard(op.id),e=>e.code==='OPERATION_UNCERTAIN');
  offline=false;await restored.c.retry(op.id);assert.equal((await f.messages(b,a)).body.messages.length,1);assert.equal(restored.c.getState().outbox.length,0);
});

test('chat journal: two same-identity tabs retain both lost sends and both newer conversation drafts after reload',async t=>{
 const f=await fixture(t),{a,b}=await f.friends(),c=await f.session('C'),room=await f.room(a);await f.join(room,c);const greeting=(await f.send(room,a,c)).body.greeting;await f.respond(greeting,'accept',c);
 const storage=localStore(),sent=[];let lose=true;
 const fetcher=async(url,options)=>{const response=await fetch(url,options);if(options.method==='POST'&&url.endsWith('/messages')){sent.push({path:url,body:options.body,key:options.headers['Idempotency-Key']});if(lose)throw Error('Synthetic committed response loss');}return response;};
 const one=f.client(a,{storage,fetch:fetcher}),two=f.client(null,{storage,fetch:fetcher});await one.c.open(b.user.id);await two.c.open(c.user.id);
 one.c.setDraft('B original');two.c.setDraft('C original');await Promise.all([assert.rejects(one.c.send(),e=>e.uncertain),assert.rejects(two.c.send(),e=>e.uncertain)]);
 assert.equal(one.c.getState().outbox[0].durable,true);assert.equal(two.c.getState().outbox[0].durable,true);one.c.setDraft('B newer unsent');two.c.setDraft('C newer unsent');one.c.dispose();two.c.dispose();
 lose=false;const restored=f.client(null,{storage,fetch:fetcher});assert.equal(restored.c.getState().outbox.length,2);await restored.c.open(b.user.id);assert.equal(restored.c.getState().draft,'B newer unsent');
 const staleLegacy=storage.getItem(CHAT_STORAGE_KEY);for(const op of restored.c.getState().outbox)await restored.c.retry(op.id);
 await restored.c.open(c.user.id);assert.equal(restored.c.getState().draft,'C newer unsent');assert.equal((await f.messages(b,a)).body.messages.length,1);assert.equal((await f.messages(c,a)).body.messages.length,1);
 for(const original of sent.slice(0,2))assert.deepEqual(sent.find((item,index)=>index>=2&&item.path===original.path),original);
 const records=Array.from({length:storage.length},(_,i)=>storage.key(i)).filter(key=>key.startsWith(CHAT_OPERATION_PREFIX)).map(key=>JSON.parse(storage.getItem(key)));assert.equal(records.length,2);assert.ok(records.every(record=>record.done&&!record.operation&&!record.key&&!record.text));
 // A stale v1 snapshot from another open tab cannot resurrect settled retries.
 storage.setItem(CHAT_STORAGE_KEY,staleLegacy);restored.c.dispose();const fresh=f.client(null,{storage});assert.equal(fresh.c.getState().outbox.length,0);await fresh.c.open(b.user.id);assert.equal(fresh.c.getState().draft,'B newer unsent');
});

test('chat journal: a saved response cannot clear a newer draft written by another tab for the same conversation',async t=>{
 for(const newer of ['Second tab newer draft','First tab message']){
 const f=await fixture(t),{a,b}=await f.friends(),storage=localStore(),started=deferred(),gate=deferred();
 const one=f.client(a,{storage,fetch:async(url,options)=>{const response=await fetch(url,options);if(options.method==='POST'&&url.endsWith('/messages')){started.resolve();await gate.promise;}return response;}}),two=f.client(null,{storage});
 await one.c.open(b.user.id);await two.c.open(b.user.id);one.c.setDraft('First tab message');const pending=one.c.send();await started.promise;two.c.setDraft(newer);await one.c.open(b.user.id);gate.resolve();await pending;
 assert.equal(one.c.getState().draft,newer,'even identical text is a separate later draft');one.c.dispose();two.c.dispose();const restored=f.client(null,{storage});await restored.c.open(b.user.id);assert.equal(restored.c.getState().draft,newer);assert.equal(restored.c.getState().outbox.length,0);
 }
});

test('chat journal: discarding a rejected send keeps its draft and storage failure does not replace an in-memory draft on reopen',async t=>{
 const f=await fixture(t),{a,b}=await f.friends(),storage=localStore();let reject=true;
 const aa=f.client(a,{storage,fetch:(url,options)=>reject&&options.method==='POST'&&url.endsWith('/messages')?Promise.resolve(Response.json({error:{code:'RATE_LIMITED',message:'Synthetic429'}},{status:429})):fetch(url,options)});
 await aa.c.open(b.user.id);aa.c.setDraft('Keep rejected text');await assert.rejects(aa.c.send(),e=>e.status===429&&!e.uncertain);aa.c.discard(aa.c.getState().outbox[0].id);aa.c.dispose();
 const restored=f.client(null,{storage});await restored.c.open(b.user.id);assert.equal(restored.c.getState().draft,'Keep rejected text');const set=storage.setItem;storage.setItem=()=>{throw Error('Synthetic quota');};restored.c.setDraft('New in-memory text');restored.c.close();await restored.c.open(b.user.id);assert.equal(restored.c.getState().draft,'New in-memory text');storage.setItem=set;
});

test('chat journal: an older saved response cannot lose a newer draft written during a temporary storage failure',async t=>{
 const f=await fixture(t),{a,b}=await f.friends(),storage=localStore(),started=deferred(),gate=deferred();
 const aa=f.client(a,{storage,fetch:async(url,options)=>{const response=await fetch(url,options);if(options.method==='POST'&&url.endsWith('/messages')){started.resolve();await gate.promise;}return response;}});
 await aa.c.open(b.user.id);aa.c.setDraft('Already submitted');const pending=aa.c.send();await started.promise;
 const set=storage.setItem;storage.setItem=()=>{throw Error('Synthetic temporary quota');};aa.c.setDraft('Later local draft');assert.equal(aa.c.getState().storage.refreshRecovery,false);
 storage.setItem=set;gate.resolve();await pending;assert.equal(aa.c.getState().draft,'Later local draft');aa.c.close();await aa.c.open(b.user.id);assert.equal(aa.c.getState().draft,'Later local draft');aa.c.dispose();
 const restored=f.client(null,{storage});await restored.c.open(b.user.id);assert.equal(restored.c.getState().draft,'Later local draft');assert.equal((await f.messages(b,a)).body.messages.length,1);
});
