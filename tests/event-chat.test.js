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

async function fixture(t, mode = 'Worker', { rateLimits = false } = {}) {
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
  const f = { get env() { return env; }, advance: ms => time += ms, restart: async () => { await stop(); await start(); },
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
  return f;
}


for (const mode of ['Node', 'Worker']) {
  test(`${mode} chat: authenticated mutual friends only, empty lists and forged identities fail closed`, async t => {
    const f = await fixture(t, mode), { a, b, room } = await f.two(), outsider = await f.session('Outside');
    assert.notEqual(a.token, b.token); assert.notEqual(a.user.id, b.user.id);
    assert.equal((await f.request('/chats')).status, 401);
    assert.equal((await f.request('/chats', { token: 'x'.repeat(43) })).status, 401);
    assert.deepEqual((await f.request('/chats', { token: a.token })).body, { actorId: a.user.id, chats: [], nextCursor: null, totalUnreadCount: 0 });
    assert.equal((await f.messages(a, b)).status, 404); assert.equal((await f.chatSend(a, b)).status, 404);
    const greeting = (await f.send(room, a, b)).body.greeting;
    assert.equal((await f.chatSend(a, b)).status, 404); await f.respond(greeting, 'accept', b);
    const empty = await f.messages(a, b); assert.equal(empty.status, 200); assert.equal(empty.body.chat.canSend, true); assert.deepEqual(empty.body.messages, []);
    assert.equal((await f.messages(outsider, b)).status, 404);
    assert.equal((await f.chatSend(a, outsider)).status, 404);
    assert.equal((await f.chatSend(a, b, 'test', { data: { text: 'test', senderId: outsider.user.id } })).status, 400);
    assert.equal((await f.chatSend(a, a)).status, 400);
    assert.equal((await f.chatSend(a, b, 'test', { key: null })).body.error.code, 'IDEMPOTENCY_KEY_REQUIRED');
    assert.equal((await f.chatSend(a, b, 'test', { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
    const sent = await f.chatSend(a, b, '有名字的合成测试消息\n🎵'); assert.equal(sent.status, 201); assert.equal(sent.body.canSend, true);
    assert.equal(sent.body.message.senderId, a.user.id); assert.equal(sent.body.message.recipientId, b.user.id); assert.equal(sent.body.message.readAt, null);
    assert.deepEqual(Object.keys(sent.body.message).sort(), ['createdAt', 'id', 'readAt', 'recipientId', 'senderId', 'text']);
    assert.equal((await f.request('/chats', { token: outsider.token })).body.chats.length, 0);
  });

  test(`${mode} chat: server acceptance and fetching never equal read; explicit per-message acknowledgment governs unread`, async t => {
    const f = await fixture(t, mode), { a, b } = await f.friends();
    const one = (await f.chatSend(a, b, '第一条')).body.message, two = (await f.chatSend(a, b, '第二条')).body.message;
    const list = await f.request('/chats', { token: b.token }); assert.equal(list.body.chats[0].unreadCount, 2);
    assert.equal((await f.ack(b, a, [one.id])).status, 400); // Thread preview grants no read eligibility.
    const page = await f.messages(b, a); assert.deepEqual(page.body.messages.map(m => m.id), [one.id, two.id]); assert.equal(page.body.chat.unreadCount, 2);
    assert.equal((await f.messages(a, b)).body.messages[0].readAt, null);
    f.advance(1000); const ack = await f.ack(b, a, [one.id]); assert.equal(ack.status, 200); assert.deepEqual(ack.body.acknowledged, [one.id]);
    const after = await f.messages(a, b); assert.ok(after.body.messages[0].readAt); assert.equal(after.body.messages[1].readAt, null);
    assert.equal((await f.request('/chats', { token: b.token })).body.chats[0].unreadCount, 1);
    const readAt = after.body.messages[0].readAt; f.advance(1000); await f.ack(b, a, [one.id]);
    assert.equal((await f.messages(a, b)).body.messages[0].readAt, readAt);
    await f.ack(b, a, [two.id]); assert.equal((await f.messages(b, a)).body.chat.unreadCount, 0);
    assert.equal((await f.ack(a, b, [one.id])).status, 400); // Cannot acknowledge one's sent messages.
  });

  test(`${mode} chat: invalid text, forged read IDs and foreign cursors never mutate a conversation`, async t => {
    const f = await fixture(t, mode), { a, b } = await f.friends(), other = await f.friends();
    for (const text of ['', '   ', 'x'.repeat(1001), '\u0000', 'fake\u202etext', '\ud800', 123, null]) assert.equal((await f.chatSend(a, b, text)).status, 400);
    assert.equal((await f.chatSend(a, b, '🎵'.repeat(1000))).status, 201);
    const incoming = (await f.chatSend(b, a)).body.message, foreign = (await f.chatSend(other.a, other.b)).body.message;
    await f.messages(a, b);
    for (const ids of [[randomUUID()], [foreign.id], [incoming.id, foreign.id], [incoming.id, incoming.id], [], Array.from({ length: 51 }, () => randomUUID())]) assert.equal((await f.ack(a, b, ids)).status, 400);
    assert.equal((await f.messages(b, a)).body.messages.find(m => m.id === incoming.id).readAt, null);
    assert.equal((await f.messages(a, b, '?before=' + foreign.id)).status, 400);
    assert.equal((await f.messages(a, b, '?after=' + randomUUID())).status, 400);
    assert.equal((await f.messages(a, b, '?before=' + incoming.id + '&after=' + incoming.id)).status, 400);
    assert.equal((await f.messages(other.a, b)).status, 404);
  });

  test(`${mode} chat: concurrent same-key sends insert once; old receipt after block exposes current canSend false`, async t => {
    const f = await fixture(t, mode), { a, b } = await f.friends(), key = randomUUID();
    const results = await Promise.all([f.chatSend(a, b, '同一请求', { key }), f.chatSend(a, b, '同一请求', { key })]);
    assert.deepEqual(results.map(r => r.status), [201, 201]); assert.equal(results[0].body.message.id, results[1].body.message.id);
    assert.equal((await f.messages(a, b)).body.messages.length, 1);
    assert.equal((await f.chatSend(a, b, '不同请求', { key })).body.error.code, 'IDEMPOTENCY_CONFLICT');
    await f.block(b, a);
    const replay = await f.chatSend(a, b, '同一请求', { key }); assert.equal(replay.status, 201); assert.equal(replay.headers.get('Idempotency-Replayed'), 'true'); assert.equal(replay.body.canSend, false);
    assert.deepEqual(replay.body.message, results[0].body.message); assert.equal((await f.messages(a, b)).body.messages.length, 1);
    assert.equal((await f.chatSend(a, b)).status, 404); assert.equal((await f.social(a)).friends.length, 0);
  });

  test(`${mode} chat: removed/blocked history stays read-only, profile and new peer receipts stay private, photos unchanged`, async t => {
    const f = await fixture(t, mode), { a, b, room } = await f.friends();
    const photo = await f.upload(room, b, 'private'), message = (await f.chatSend(a, b, '保留此前记录')).body.message;
    const friend = (await f.social(a)).friends[0];
    assert.equal((await f.request(`/friends/${b.user.id}`, { method: 'DELETE', token: a.token, data: { revision: friend.revision } })).status, 200);
    assert.equal((await f.chatSend(a, b)).status, 404); assert.equal((await f.chatSend(b, a)).status, 404);
    const previous = await f.messages(a, b); assert.equal(previous.body.chat.canSend, false); assert.equal(previous.body.chat.peer.name, 'B');
    assert.equal((await f.request('/api/avatar/profile', { token: b.token, method: 'PUT', data: { name: 'Later private name', avatar: b.user.avatar, revision: b.user.revision } })).status, 200);
    const blocked = (await f.block(b, a)).body.block;
    await f.messages(b, a); assert.equal((await f.ack(b, a, [message.id])).status, 200);
    const history = await f.messages(a, b); assert.equal(history.status, 200); assert.equal(history.body.messages[0].readAt, null); assert.equal(history.body.chat.receiptsAvailable, false);
    assert.equal(history.body.chat.peer.name, 'B'); assert.equal((await f.request('/chats', { token: a.token })).body.chats[0].peer.name, 'B');
    assert.equal((await f.request(photo.imageUrl, { token: a.token })).status, 404); assert.equal((await f.request(photo.imageUrl, { token: b.token })).status, 200);
    await f.unblock(b, a, blocked.revision); assert.equal((await f.messages(a, b)).body.chat.canSend, false); assert.equal((await f.chatSend(a, b)).status, 404);
  });

  test(`${mode} chat: restart preserves messages, read eligibility, unread state and idempotency`, async t => {
    const f = await fixture(t, mode), { a, b } = await f.friends(), key = randomUUID();
    const sent = await f.chatSend(a, b, '重启也留在这里', { key }); await f.messages(b, a); await f.restart();
    assert.equal((await f.ack(b, a, [sent.body.message.id])).status, 200);
    assert.ok((await f.messages(a, b)).body.messages[0].readAt);
    assert.equal((await f.messages(b, a)).body.chat.unreadCount, 0);
    const replay = await f.chatSend(a, b, '重启也留在这里', { key }); assert.equal(replay.headers.get('Idempotency-Replayed'), 'true'); assert.deepEqual(replay.body.message, sent.body.message);
    assert.equal((await f.messages(b, a)).body.messages.length, 1);
  });
}

function pauseBatch(f, matches) {
  const batch = f.env.DB.batch.bind(f.env.DB); let armed = true, release, began;
  const waiting = new Promise(resolve => release = resolve), started = new Promise(resolve => began = resolve);
  f.env.DB.batch = async statements => { if (armed && statements.some(s => matches(s.query))) { armed = false; began(); await waiting; } return batch(statements); };
  return { started, release };
}

for (const change of ['remove', 'block']) {
  test(`Worker chat: ${change} before delayed send atomically rejects message and retry receipt`, async t => {
    const f = await fixture(t), { a, b } = await f.friends();
    const barrier = pauseBatch(f, q => q.startsWith('INSERT INTO event_chat_messages'));
    const pending = f.chatSend(a, b); await barrier.started;
    if (change === 'block') await f.block(b, a);
    else { const friend = (await f.social(a)).friends[0]; await f.request(`/friends/${b.user.id}`, { method: 'DELETE', token: a.token, data: { revision: friend.revision } }); }
    barrier.release(); assert.equal((await pending).status, 409);
    assert.equal((await f.request('/chats', { token: a.token })).body.chats.length, 0);
    assert.equal(f.env.DB.sql.prepare('SELECT COUNT(*) AS n FROM event_chat_messages').get().n, 0);
  });
}

test('Worker chat: lost send response with failed recovery read retries once without duplicate', async t => {
  const f = await fixture(t), { a, b } = await f.friends(), key = randomUUID(), batch = f.env.DB.batch.bind(f.env.DB); let armed = true;
  f.env.DB.batch = async statements => { const result = await batch(statements); if (armed && statements.some(s => s.query.startsWith('INSERT INTO event_chat_messages'))) { armed = false; f.env.DB.readFailures = 1; throw Error('Synthetic response loss'); } return result; };
  assert.equal((await f.chatSend(a, b, '重试', { key })).status, 503);
  const retry = await f.chatSend(a, b, '重试', { key }); assert.equal(retry.status, 201); assert.equal(retry.headers.get('Idempotency-Replayed'), 'true');
  assert.equal((await f.messages(b, a)).body.messages.length, 1);
});

test('Worker chat: stable message pages tolerate tied clocks and later arrivals without skipping unseen acknowledgments', async t => {
  const f = await fixture(t), { a, b } = await f.friends();
  const sent = [];
  for (let n = 0; n < 121; n++) { const r = await f.chatSend(a, b, 'message-' + n); assert.equal(r.status, 201); sent.push(r.body.message); }
  const latest = (await f.messages(b, a)).body; assert.equal(latest.messages.length, 50); assert.deepEqual(latest.messages.map(m => m.id), sent.slice(71).map(m => m.id));
  assert.equal(latest.messages.every(m => m.createdAt === sent[0].createdAt), true); assert.equal(latest.newerCursor, null); assert.ok(latest.olderCursor);
  assert.equal((await f.ack(b, a, [sent[0].id])).status, 400); // Still not fetched, despite seeing newest messages.
  await f.ack(b, a, latest.messages.map(m => m.id)); assert.equal((await f.request('/chats', { token: b.token })).body.chats[0].unreadCount, 71);
  const middle = (await f.messages(b, a, '?before=' + latest.olderCursor)).body;
  const oldest = (await f.messages(b, a, '?before=' + middle.olderCursor)).body;
  assert.equal(oldest.messages.length, 21); assert.equal(oldest.olderCursor, null);
  assert.deepEqual([...oldest.messages, ...middle.messages, ...latest.messages].map(m => m.id), sent.map(m => m.id));
  const newest = (await f.chatSend(a, b, 'later-message')).body.message;
  const after = (await f.messages(b, a, '?after=' + sent.at(-1).id)).body; assert.deepEqual(after.messages.map(m => m.id), [newest.id]); assert.equal(after.newerCursor, null);
  const catchup = (await f.messages(b, a, '?after=' + sent[0].id)).body; assert.equal(catchup.messages.length, 50); assert.ok(catchup.newerCursor); assert.deepEqual(catchup.messages.map(m => m.id), sent.slice(1, 51).map(m => m.id));
});

test('Worker chat: persistent send rate limits new messages but exact retries remain safe', async t => {
  const f = await fixture(t, 'Worker', { rateLimits: true }), { a, b } = await f.friends(), key = randomUUID();
  const first = await f.chatSend(a, b, 'same', { key }); assert.equal(first.status, 201);
  for (let n = 1; n < 20; n++) assert.equal((await f.chatSend(a, b, 'burst-' + n)).status, 201);
  await f.restart(); assert.equal((await f.chatSend(a, b, 'over-limit')).status, 429);
  assert.equal((await f.chatSend(a, b, 'same', { key })).status, 201);
  f.advance(60_001); assert.equal((await f.chatSend(a, b, 'new-minute')).status, 201);
});

test('Worker chat: send committed before a waiting block remains history, while later sends are denied', async t => {
  const f = await fixture(t), { a, b } = await f.friends();
  const barrier = pauseBatch(f, q => q.startsWith('INSERT INTO event_social_blocks'));
  const blocking = f.block(b, a); await barrier.started;
  const sent = await f.chatSend(a, b, '先完成的消息'); assert.equal(sent.status, 201);
  barrier.release(); assert.equal((await blocking).status, 200);
  const history = await f.messages(a, b); assert.equal(history.body.chat.canSend, false); assert.deepEqual(history.body.messages.map(m => m.id), [sent.body.message.id]);
  assert.equal((await f.chatSend(a, b)).status, 404);
});

test('Worker chat: block during delivery bookkeeping strips newly observed peer receipt permissions', async t => {
  const f = await fixture(t), { a, b } = await f.friends();
  const sent = (await f.chatSend(a, b, 'A发出')).body.message;
  await f.messages(b, a); await f.ack(b, a, [sent.id]); await f.chatSend(b, a, 'B回复');
  const barrier = pauseBatch(f, q => q.startsWith('INSERT INTO event_chat_receipts'));
  const reading = f.messages(a, b); await barrier.started;
  assert.equal((await f.block(b, a)).status, 200); barrier.release();
  const result = await reading; assert.equal(result.status, 200); assert.equal(result.body.chat.canSend, false); assert.equal(result.body.chat.receiptsAvailable, false);
  assert.equal(result.body.messages.find(m => m.id === sent.id).readAt, null);
});

test('Worker chat: transaction failure rolls back thread, message and idempotency together', async t => {
  const f = await fixture(t), { a, b } = await f.friends(), key = randomUUID(), batch = f.env.DB.batch.bind(f.env.DB); let armed = true;
  f.env.DB.batch = async statements => { if (armed && statements.some(s => s.query.startsWith('INSERT INTO event_chat_messages'))) { armed = false; statements.push(f.env.DB.prepare('INSERT INTO event_mutation_guard (id,assertion) VALUES (?,0)').bind(randomUUID())); } return batch(statements); };
  assert.equal((await f.chatSend(a, b, '原请求', { key })).status, 409);
  for (const table of ['event_chat_threads', 'event_chat_messages']) assert.equal(f.env.DB.sql.prepare('SELECT COUNT(*) AS n FROM ' + table).get().n, 0);
  assert.equal((await f.chatSend(a, b, '原请求', { key })).status, 201); assert.equal((await f.messages(a, b)).body.messages.length, 1);
});

test('Worker chat: read acknowledgment response loss retries exactly and never marks unfetched messages', async t => {
  const f = await fixture(t), { a, b } = await f.friends(), message = (await f.chatSend(a, b)).body.message;
  await f.messages(b, a); const second = (await f.chatSend(a, b, '尚未提取')).body.message;
  const key = randomUUID(), batch = f.env.DB.batch.bind(f.env.DB); let armed = true;
  f.env.DB.batch = async statements => { const result = await batch(statements); if (armed && statements.some(s => s.query.startsWith('UPDATE event_chat_receipts SET read_at'))) { armed = false; f.env.DB.readFailures = 1; throw Error('Synthetic ack response loss'); } return result; };
  assert.equal((await f.ack(b, a, [message.id], { key })).status, 503);
  f.advance(1000); const replay = await f.ack(b, a, [message.id], { key }); assert.equal(replay.status, 200); assert.equal(replay.headers.get('Idempotency-Replayed'), 'true');
  assert.equal((await f.ack(b, a, [second.id])).status, 400);
  const received = await f.messages(a, b); assert.ok(received.body.messages[0].readAt); assert.equal(received.body.messages[1].readAt, null);
});

test('Worker chat: independent thread pagination is stable and contains only the authenticated participant history', async t => {
  const f = await fixture(t), { a, b, room } = await f.friends(), stranger = await f.session('Outside');
  await f.chatSend(a, b);
  const sql = f.env.DB.sql, stamp = '2026-09-30T10:00:00.000Z';
  const insertUser = sql.prepare('INSERT INTO avatar_users (id,name,avatar,token_hash,revision,created_at) VALUES (?,?,?,?,1,?)');
  const insertPair = sql.prepare("INSERT INTO event_social_pairs (id,low_id,high_id,status,revision,greeting_id,sender_id,recipient_id,room_id,created_at,updated_at,friends_at) VALUES (?,?,?,'accepted',1,?,?,?,?,?,?,?)");
  const insertThread = sql.prepare('INSERT INTO event_chat_threads (pair_id,low_profile,high_profile,created_at,updated_at) VALUES (?,?,?,?,?)');
  const insertMessage = sql.prepare('INSERT INTO event_chat_messages (id,pair_id,sender_id,recipient_id,text,created_at) VALUES (?,?,?,?,?,?)');
  for (let n = 0; n < 52; n++) {
    const id = randomUUID(), pairId = randomUUID(), person = { id, name: 'Synthetic ' + n, avatar: a.user.avatar }; insertUser.run(id, person.name, JSON.stringify(person.avatar), randomUUID(), stamp);
    const [low, high] = [a.user.id, id].sort(); insertPair.run(pairId, low, high, randomUUID(), a.user.id, id, room.id, stamp, stamp, stamp);
    insertThread.run(pairId, JSON.stringify(low === a.user.id ? a.user : person), JSON.stringify(high === a.user.id ? a.user : person), stamp, stamp);
    insertMessage.run(randomUUID(), pairId, id, a.user.id, 'Synthetic thread', stamp);
  }
  const first = (await f.request('/chats', { token: a.token })).body; assert.equal(first.chats.length, 50); assert.ok(first.nextCursor);
  const second = (await f.request('/chats?cursor=' + first.nextCursor, { token: a.token })).body; assert.equal(second.chats.length, 3); assert.equal(second.nextCursor, null);
  assert.equal(new Set([...first.chats, ...second.chats].map(c => c.id)).size, 53);
  assert.equal(first.totalUnreadCount, 52); assert.equal(second.totalUnreadCount, 52);
  const unloaded = second.chats.find(chat => chat.userId !== b.user.id), newMessage = randomUUID();
  insertMessage.run(newMessage, unloaded.id, unloaded.userId, a.user.id, 'New unread beyond first page', stamp);
  const refreshed = (await f.request('/chats', { token: a.token })).body;
  assert.ok(!refreshed.chats.some(chat => chat.id === unloaded.id)); assert.equal(refreshed.totalUnreadCount, 53);
  const peer = { user: { id: unloaded.userId } }; await f.messages(a, peer);
  assert.equal((await f.ack(a, peer, [newMessage])).status, 200);
  assert.equal((await f.request('/chats', { token: a.token })).body.totalUnreadCount, 52);
  assert.equal((await f.request('/chats', { token: stranger.token })).body.totalUnreadCount, 0);
  assert.equal((await f.request('/chats', { token: stranger.token })).body.chats.length, 0);
  assert.equal((await f.request('/chats?cursor=invalid', { token: a.token })).status, 400);
});

test('Worker chat: daily500-send budget persists across minute windows and server restarts', async t => {
  const f = await fixture(t, 'Worker', { rateLimits: true }), { a, b } = await f.friends();
  for (let group = 0; group < 25; group++) {
    for (let n = 0; n < 20; n++) assert.equal((await f.chatSend(a, b, `bounded-${group}-${n}`)).status, 201);
    f.advance(60_001);
  }
  await f.restart(); assert.equal((await f.chatSend(a, b, 'one-too-many')).status, 429);
  f.advance(24 * 60 * 60_000); assert.equal((await f.chatSend(a, b, 'new-day')).status, 201);
});

test('Chat additive0003 migration preserves existing identities, rooms and accepted social relations', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'musicspace-chat-upgrade-')), file = join(dir, 'upgrade.sqlite'); t.after(() => removeTempAfterTests(dir));
  const db = new DatabaseSync(file);
  for (const name of ['0000_known_colonel_america.sql', '0001_event_rooms.sql', '0002_event_social.sql']) db.exec(await readFile(new URL('../runtime-preview/drizzle/' + name, import.meta.url), 'utf8'));
  const a = randomUUID(), b = randomUUID(), pair = randomUUID(), room = randomUUID(), [low, high] = [a, b].sort(), stamp = 'old-date';
  for (const id of [a, b]) db.prepare('INSERT INTO avatar_users (id,name,avatar,token_hash,revision,created_at) VALUES (?,?,?,?,9,?)').run(id, 'Existing', '{}', randomUUID(), stamp);
  db.prepare('INSERT INTO event_rooms (id,code,host_id,title,venue,song_id,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?)').run(room, 'OLD', a, 'Existing show', '', 'late-train', stamp, 'later');
  db.prepare("INSERT INTO event_social_pairs (id,low_id,high_id,status,revision,greeting_id,sender_id,recipient_id,room_id,created_at,updated_at,friends_at) VALUES (?,?,?,'accepted',2,?,?,?,?,?,?,?)").run(pair, low, high, randomUUID(), a, b, room, stamp, stamp, stamp);
  const tables = ['avatar_users', 'event_rooms', 'event_social_pairs'], before = tables.map(table => db.prepare('SELECT * FROM ' + table).all()); db.close();
  const store = createEventStore({ databasePath: file }); store.close(); const restarted = createEventStore({ databasePath: file }); restarted.close();
  const read = new DatabaseSync(file); try {
    assert.deepEqual(tables.map(table => read.prepare('SELECT * FROM ' + table).all()), before);
    for (const table of ['event_chat_threads', 'event_chat_messages', 'event_chat_receipts']) assert.equal(read.prepare('SELECT COUNT(*) AS n FROM ' + table).get().n, 0);
    assert.deepEqual(read.prepare('PRAGMA foreign_key_check').all(), []);
  } finally { read.close(); }
});
