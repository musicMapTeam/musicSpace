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
  const dir = await mkdtemp(join(tmpdir(), 'musicspace-social-'));
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
  f.room = async a => (await f.request('/rooms', { method: 'POST', token: a.token, data: { title: '合成现场', venue: '合成场地', songId: 'late-train', joinConsent: true, participation: 'open' } })).body.room;
  f.join = (room, a) => f.request(`/rooms/${room.code}/join`, { method: 'POST', token: a.token, data: { joinConsent: true, participation: 'open' } });
  f.send = (room, a, b, options = {}) => f.request(`/rooms/${room.id}/greetings`, { method: 'POST', token: a.token, data: { recipientId: b.user.id }, ...options });
  f.respond = (greeting, action, a, options = {}) => f.request(`/greetings/${greeting.id}/${action}`, { method: 'POST', token: a.token, data: { revision: greeting.revision }, ...options });
  f.block = (a, b, options = {}) => f.request(`/blocks/${b.user.id}`, { method: 'POST', token: a.token, data: {}, ...options });
  f.unblock = (a, b, revision, options = {}) => f.request(`/blocks/${b.user.id}`, { method: 'DELETE', token: a.token, data: { revision }, ...options });
  f.social = async a => { const r = await f.request('/social', { token: a.token }); assert.equal(r.status, 200, JSON.stringify(r.body)); return r.body; };
  f.upload = async (room, a, visibility) => (await f.request(`/rooms/${room.id}/photos`, { method: 'POST', token: a.token, data: { ...photoData(), visibility } })).body.photo;
  f.two = async () => { const a = await f.session('A'), b = await f.session('B'), room = await f.room(a); assert.equal((await f.join(room, b)).status, 200); return { a, b, room }; };
  return f;
}

for (const mode of ['Node', 'Worker']) {
  test(`${mode} social: empty lists require a real bearer identity; forged identity/event input fails closed`, async t => {
    const f = await fixture(t, mode), { a, b, room } = await f.two(), outsider = await f.session('Outside');
    assert.notEqual(a.token, b.token); assert.notEqual(a.user.id, b.user.id);
    assert.equal((await f.request('/social')).status, 401);
    assert.equal((await f.request('/social', { token: 'x'.repeat(43) })).status, 401);
    const empty = await f.social(a);
    assert.deepEqual(empty, { actorId: a.user.id, nextCursors: { incoming: null, outgoing: null, friends: null, blocks: null }, incoming: [], outgoing: [], friends: [], blocks: [] });
    assert.equal((await f.send(room, outsider, b)).status, 404);
    assert.equal((await f.send(room, a, outsider)).status, 404);
    assert.equal((await f.send({ id: randomUUID() }, a, b)).status, 404);
    assert.equal((await f.send(room, a, a)).body.error.code, 'SELF_INTERACTION');
    assert.equal((await f.send(room, a, b, { data: { recipientId: b.user.id, senderId: outsider.user.id } })).status, 400);
    assert.equal((await f.send(room, a, b, { key: null })).body.error.code, 'IDEMPOTENCY_KEY_REQUIRED');
    assert.equal((await f.send(room, a, b, { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
    assert.equal((await f.block(a, outsider)).status, 404);
    assert.equal((await f.request('/social?incomingCursor=oops', { token: a.token })).status, 400);
    assert.equal((await f.send(room, a, b)).status, 201);
  });

  test(`${mode} social: only the recipient explicitly accepts; lists are mutual and expose app profiles only`, async t => {
    const f = await fixture(t, mode), { a, b, room } = await f.two(), outsider = await f.session('Outside');
    const sent = await f.send(room, a, b), greeting = sent.body.greeting; assert.equal(sent.status, 201); assert.equal(greeting.status, 'pending');
    assert.equal(greeting.senderId, a.user.id); assert.equal(greeting.recipientId, b.user.id); assert.equal(greeting.roomId, room.id);
    assert.equal((await f.social(a)).outgoing[0].peer.id, b.user.id); assert.equal((await f.social(b)).incoming[0].peer.id, a.user.id);
    assert.equal((await f.social(a)).friends.length, 0);
    assert.equal((await f.respond(greeting, 'accept', a)).status, 403);
    assert.equal((await f.respond(greeting, 'reject', a)).status, 403);
    assert.equal((await f.respond(greeting, 'cancel', b)).status, 403);
    assert.equal((await f.respond(greeting, 'accept', outsider)).status, 404);
    assert.equal((await f.respond(greeting, 'accept', b, { data: {} })).status, 400);
    assert.equal((await f.respond(greeting, 'accept', b, { data: { revision: 99 } })).body.error.code, 'REVISION_CONFLICT');
    const accepted = await f.respond(greeting, 'accept', b); assert.equal(accepted.status, 200); assert.equal(accepted.body.greeting.status, 'accepted');
    const sa = await f.social(a), sb = await f.social(b);
    assert.equal(sa.outgoing.length, 0); assert.equal(sb.incoming.length, 0); assert.equal(sa.friends.length, 1); assert.equal(sb.friends.length, 1);
    assert.equal(sa.friends[0].id, sb.friends[0].id); assert.equal(sa.friends[0].revision, 2); assert.equal(sa.friends[0].userId, b.user.id);
    assert.deepEqual(Object.keys(sa.friends[0].peer).sort(), ['avatar', 'id', 'name']);
    for (const secret of [a.token, b.token, '"token_hash":', '"email":', '"phone":']) assert.ok(!JSON.stringify(sa).includes(secret));
    assert.equal((await f.send(room, b, a)).body.error.code, 'ALREADY_FRIENDS');
    assert.equal((await f.respond(greeting, 'accept', b)).status, 409);
    assert.equal((await f.social(outsider)).friends.length, 0);
  });

  test(`${mode} social: reject/cancel close both lists, require fresh revision and impose pair cooldown`, async t => {
    const f = await fixture(t, mode), { a, b, room } = await f.two();
    let greeting = (await f.send(room, a, b)).body.greeting;
    assert.equal((await f.respond(greeting, 'reject', b)).body.greeting.status, 'rejected');
    assert.equal((await f.social(a)).outgoing.length, 0); assert.equal((await f.social(b)).incoming.length, 0);
    const cooldown = await f.send(room, b, a); assert.equal(cooldown.status, 429); assert.equal(cooldown.body.error.code, 'GREETING_COOLDOWN'); assert.equal(cooldown.headers.get('Retry-After'), '600');
    f.advance(600_001); const next = (await f.send(room, a, b)).body.greeting;
    assert.notEqual(next.id, greeting.id); assert.ok(next.revision > greeting.revision);
    assert.equal((await f.respond(greeting, 'accept', b)).status, 404);
    greeting = next; assert.equal((await f.respond(greeting, 'cancel', a)).body.greeting.status, 'cancelled');
    assert.equal((await f.respond(greeting, 'accept', b)).status, 409);
    assert.equal((await f.send(room, a, b)).status, 429); assert.equal((await f.social(b)).friends.length, 0);
  });

  test(`${mode} social: simultaneous opposite greetings never autoaccept and cancel versus accept has one winner`, async t => {
    const f = await fixture(t, mode), { a, b, room } = await f.two();
    const sent = await Promise.all([f.send(room, a, b), f.send(room, b, a)]);
    assert.deepEqual(sent.map(r => r.status).sort(), [201, 409]);
    assert.equal((await f.social(a)).friends.length, 0); assert.equal((await f.social(b)).friends.length, 0);
    const greeting = sent.find(r => r.status === 201).body.greeting;
    const sender = greeting.senderId === a.user.id ? a : b, recipient = sender === a ? b : a;
    const responses = await Promise.all([f.respond(greeting, 'cancel', sender), f.respond(greeting, 'accept', recipient)]);
    assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
    const sa = await f.social(a), sb = await f.social(b);
    assert.equal(sa.friends.length, sb.friends.length); assert.equal(sa.incoming.length + sa.outgoing.length, 0);
  });

  test(`${mode} social: requests survive leaving and show close; friendship never grants photo access`, async t => {
    const f = await fixture(t, mode), { a, b, room } = await f.two();
    const privatePhoto = await f.upload(room, a, 'private'), shared = await f.upload(room, a, 'members');
    const greeting = (await f.send(room, a, b)).body.greeting;
    assert.equal((await f.request(`/rooms/${room.id}/leave`, { method: 'POST', token: b.token, data: {} })).status, 200);
    assert.equal((await f.send(room, a, b)).status, 404);
    assert.equal((await f.request(`/rooms/${room.id}/close`, { method: 'POST', token: a.token, data: { revision: 1 } })).status, 200);
    assert.equal((await f.respond(greeting, 'accept', b)).status, 200);
    assert.equal((await f.social(a)).friends.length, 1);
    for (const p of [privatePhoto, shared]) assert.equal((await f.request(p.imageUrl, { token: b.token })).status, 404);
    assert.equal((await f.request(shared.imageUrl, { token: a.token })).status, 200);
  });

  test(`${mode} social: global block removes pending/friends, hides both directions without changing photos or third parties`, async t => {
    const f = await fixture(t, mode), { a, b, room } = await f.two(), third = await f.session('C'); await f.join(room, third);
    const p = await f.upload(room, a, 'members'), q = await f.upload(room, b, 'members');
    const second = await f.room(b); await f.join(second, a);
    const greeting = (await f.send(room, a, b)).body.greeting;
    const block = (await f.block(b, a)).body.block;
    assert.equal((await f.social(a)).outgoing.length, 0); assert.equal((await f.social(b)).incoming.length, 0);
    assert.equal((await f.respond(greeting, 'accept', b)).status, 404);
    for (const event of [room, second]) {
      assert.equal((await f.send(event, a, b)).status, 404); assert.equal((await f.send(event, b, a)).status, 404);
      const ar = (await f.request('/rooms/' + event.id, { token: a.token })).body, br = (await f.request('/rooms/' + event.id, { token: b.token })).body;
      assert.ok(!ar.members.some(m => m.id === b.user.id)); assert.ok(!br.members.some(m => m.id === a.user.id));
      assert.ok(!ar.photos.some(p => p.ownerId === b.user.id)); assert.ok(!br.photos.some(p => p.ownerId === a.user.id));
    }
    assert.equal((await f.request(p.imageUrl, { token: b.token })).status, 404); assert.equal((await f.request(q.imageUrl, { token: a.token })).status, 404);
    for (const [photo, owner] of [[p, a], [q, b]]) {
      assert.equal((await f.request(photo.imageUrl, { token: owner.token })).status, 200);
      assert.equal((await f.request(photo.imageUrl, { token: third.token })).status, 200);
      const own = (await f.request('/photos', { token: owner.token })).body.photos[0]; assert.equal(own.visibility, 'members'); assert.equal(own.revision, 1);
    }
    assert.equal((await f.request('/rooms', { token: a.token })).body.rooms.length, 2);
    assert.equal((await f.social(a)).blocks.length, 0); assert.equal((await f.social(b)).blocks[0].userId, a.user.id);
    assert.equal((await f.unblock(b, a, block.revision + 1)).status, 409);
    assert.equal((await f.unblock(b, a, block.revision)).status, 200);
    assert.equal((await f.social(a)).outgoing.length, 0); assert.equal((await f.social(a)).friends.length, 0);
    assert.equal((await f.respond(greeting, 'accept', b)).status, 409);
    assert.equal((await f.request(p.imageUrl, { token: b.token })).status, 200); // Existing members sharing restored, never friend access.
    const next = (await f.send(room, a, b)).body.greeting; assert.equal((await f.respond(next, 'accept', b)).status, 200);
    assert.equal((await f.block(a, b)).status, 200); assert.equal((await f.social(a)).friends.length, 0); assert.equal((await f.social(b)).friends.length, 0);
  });

  test(`${mode} social: reciprocal blocks and unblock do not resurrect; removal is mutual and receipt replay is historical`, async t => {
    const f = await fixture(t, mode), { a, b, room } = await f.two(), sendKey = randomUUID(), acceptKey = randomUUID();
    const greeting = (await f.send(room, a, b, { key: sendKey })).body.greeting;
    const accepted = await f.respond(greeting, 'accept', b, { key: acceptKey });
    const friend = accepted.body.friend;
    assert.equal((await f.request(`/friends/${a.user.id}`, { token: b.token, method: 'DELETE', data: { revision: 1 } })).status, 409);
    assert.equal((await f.request(`/friends/${a.user.id}`, { token: b.token, method: 'DELETE', data: { revision: friend.revision } })).status, 200);
    assert.equal((await f.social(a)).friends.length, 0); assert.equal((await f.social(b)).friends.length, 0);
    const replay = await f.respond(greeting, 'accept', b, { key: acceptKey }); assert.equal(replay.status, 200); assert.equal(replay.headers.get('Idempotency-Replayed'), 'true');
    assert.equal((await f.social(a)).friends.length, 0);
    const ab = (await f.block(a, b)).body.block, ba = (await f.block(b, a)).body.block;
    assert.equal((await f.unblock(a, b, ab.revision)).status, 200); assert.equal((await f.send(room, a, b)).status, 404);
    assert.equal((await f.unblock(b, a, ba.revision)).status, 200);
    assert.equal((await f.social(a)).friends.length, 0);
    const oldReceipt = await f.send(room, a, b, { key: sendKey }); assert.equal(oldReceipt.headers.get('Idempotency-Replayed'), 'true');
    assert.equal((await f.social(a)).outgoing.length, 0);
    assert.equal((await f.send(room, a, b, { key: sendKey, data: { recipientId: a.user.id } })).status, 400);
    const next = (await f.send(room, a, b)).body.greeting; assert.ok(next.revision > friend.revision);
    assert.equal((await f.respond(next, 'accept', b)).status, 200);
  });

  test(`${mode} social: restart preserves pending requests, exact receipts, mutual friends and active blocks`, async t => {
    const f = await fixture(t, mode), { a, b, room } = await f.two(), key = randomUUID();
    const sent = await f.send(room, a, b, { key }); await f.restart();
    assert.equal((await f.social(b)).incoming[0].id, sent.body.greeting.id);
    const retry = await f.send(room, a, b, { key }); assert.deepEqual(retry.body, sent.body); assert.equal(retry.headers.get('Idempotency-Replayed'), 'true');
    assert.equal((await f.respond(sent.body.greeting, 'accept', b)).status, 200); await f.restart();
    assert.equal((await f.social(a)).friends.length, 1); assert.equal((await f.social(b)).friends.length, 1);
    await f.block(a, b); await f.restart(); assert.equal((await f.social(a)).blocks.length, 1); assert.equal((await f.social(b)).friends.length, 0);
    assert.equal((await f.send(room, b, a)).status, 404);
  });
}

// Barriers delay a real transactional batch, not a fake persistence operation.
function pauseMutation(f, matches) {
  const batch = f.env.DB.batch.bind(f.env.DB); let armed = true, release, began;
  const waiting = new Promise(resolve => { release = resolve; }), started = new Promise(resolve => { began = resolve; });
  f.env.DB.batch = async statements => {
    if (armed && statements.some(s => matches(s.query))) { armed = false; began(); await waiting; }
    return batch(statements);
  };
  return { started, release };
}

for (const action of ['send', 'accept']) {
  test(`Worker social: block commits while ${action} is waiting, so guarded interaction fails`, async t => {
    const f = await fixture(t), { a, b, room } = await f.two();
    const greeting = action === 'accept' ? (await f.send(room, a, b)).body.greeting : null;
    const barrier = pauseMutation(f, q => action === 'send' ? q.includes('status=excluded.status') : q.startsWith('UPDATE event_social_pairs SET status = ?'));
    const pending = action === 'send' ? f.send(room, a, b) : f.respond(greeting, 'accept', b); await barrier.started;
    assert.equal((await f.block(a, b)).status, 200); barrier.release();
    assert.equal((await pending).status, 409); assert.equal((await f.social(a)).friends.length, 0); assert.equal((await f.social(b)).incoming.length, 0);
  });
  test(`Worker social: ${action} commits while block is waiting, then block still neutralizes it`, async t => {
    const f = await fixture(t), { a, b, room } = await f.two();
    const greeting = action === 'accept' ? (await f.send(room, a, b)).body.greeting : null;
    const barrier = pauseMutation(f, q => q.startsWith('INSERT INTO event_social_blocks'));
    const blocked = f.block(a, b); await barrier.started;
    assert.equal((action === 'send' ? await f.send(room, a, b) : await f.respond(greeting, 'accept', b)).status, action === 'send' ? 201 : 200);
    barrier.release(); assert.equal((await blocked).status, 200);
    for (const u of [a, b]) { const s = await f.social(u); assert.equal(s.incoming.length + s.outgoing.length + s.friends.length, 0); }
  });
}

test('Worker social: block during private object read prevents bytes from being returned', async t => {
  const f = await fixture(t), { a, b, room } = await f.two(), photo = await f.upload(room, a, 'members');
  const get = f.env.PHOTOS.get.bind(f.env.PHOTOS); let release, began;
  const started = new Promise(r => began = r), pause = new Promise(r => release = r);
  f.env.PHOTOS.get = async key => { const result = await get(key); began(); await pause; return result; };
  const reading = f.request(photo.imageUrl, { token: b.token }); await started; await f.block(a, b); release();
  assert.equal((await reading).status, 404);
});

test('Worker social: lost commit response and failed recovery read retry exact outcome once', async t => {
  const f = await fixture(t), { a, b, room } = await f.two(), key = randomUUID();
  const batch = f.env.DB.batch.bind(f.env.DB); let armed = true;
  f.env.DB.batch = async statements => { const result = await batch(statements); if (armed && statements.some(s => s.query.includes('status=excluded.status'))) { armed = false; f.env.DB.readFailures = 1; throw Error('Synthetic lost response'); } return result; };
  assert.equal((await f.send(room, a, b, { key })).status, 503);
  const retry = await f.send(room, a, b, { key }); assert.equal(retry.status, 201); assert.equal(retry.headers.get('Idempotency-Replayed'), 'true');
  assert.equal((await f.social(a)).outgoing.length, 1); assert.equal((await f.social(b)).incoming.length, 1);
  const wrong = await f.request(`/greetings/${retry.body.greeting.id}/cancel`, { token: a.token, method: 'POST', key, data: { revision: retry.body.greeting.revision } });
  assert.equal(wrong.status, 409); assert.equal(wrong.body.error.code, 'IDEMPOTENCY_CONFLICT');
});

test('Worker social: atomic failure rolls back social state and idempotency together', async t => {
  const f = await fixture(t), { a, b, room } = await f.two(), key = randomUUID();
  const batch = f.env.DB.batch.bind(f.env.DB); let armed = true;
  f.env.DB.batch = async statements => { if (armed && statements.some(s => s.query.includes('status=excluded.status'))) { armed = false; statements.push(f.env.DB.prepare('INSERT INTO event_mutation_guard (id,assertion) VALUES (?,0)').bind(randomUUID())); } return batch(statements); };
  assert.equal((await f.send(room, a, b, { key })).status, 409); assert.equal((await f.social(a)).outgoing.length, 0);
  assert.equal((await f.send(room, a, b, { key })).status, 201); assert.equal((await f.social(b)).incoming.length, 1);
});

test('Worker social: bounded persistent per-pair resend rate survives restarts and cooldown expiry', async t => {
  const f = await fixture(t, 'Worker', { rateLimits: true }), { a, b, room } = await f.two();
  for (let n = 0; n < 5; n++) { const r = await f.send(room, a, b); assert.equal(r.status, 201); assert.equal((await f.respond(r.body.greeting, 'reject', b)).status, 200); f.advance(600_001); }
  await f.restart(); const denied = await f.send(room, a, b); assert.equal(denied.status, 429); assert.equal(denied.body.error.code, 'RATE_LIMITED'); assert.ok(+denied.headers.get('Retry-After') > 0);
});

test('Social additive migration preserves old identity, room and composition data and applies locally on restart', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'musicspace-social-upgrade-')), file = join(dir, 'upgrade.sqlite'); t.after(() => removeTempAfterTests(dir));
  const db = new DatabaseSync(file);
  for (const name of ['0000_known_colonel_america.sql', '0001_event_rooms.sql']) db.exec(await readFile(new URL('../runtime-preview/drizzle/' + name, import.meta.url), 'utf8'));
  db.prepare('INSERT INTO avatar_users (id,name,avatar,token_hash,revision,created_at) VALUES (?,?,?,?,?,?)').run('old-user', 'Existing', '{}', 'opaque', 9, 'old-date');
  db.prepare('INSERT INTO event_rooms (id,code,host_id,title,venue,song_id,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?)').run('old-room', 'OLD', 'old-user', 'Existing show', '', 'late-train', 'old-date', 'later');
  db.prepare('INSERT INTO avatar_compositions (id,host_id,snapshot,revision,content_revision,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').run('old-composition', 'old-user', '{}', 8, 7, 'old-date', 'old-date');
  const before = ['avatar_users', 'event_rooms', 'avatar_compositions'].map(table => db.prepare('SELECT * FROM ' + table).all()); db.close();
  const store = createEventStore({ databasePath: file }); store.close(); const reopened = createEventStore({ databasePath: file }); reopened.close();
  const read = new DatabaseSync(file); try {
    const after = ['avatar_users', 'event_rooms', 'avatar_compositions'].map(table => read.prepare('SELECT * FROM ' + table).all()); assert.deepEqual(after, before);
    assert.equal(read.prepare('SELECT COUNT(*) AS n FROM event_social_pairs').get().n, 0);
    assert.equal(read.prepare('SELECT COUNT(*) AS n FROM event_social_blocks').get().n, 0);
    assert.deepEqual(read.prepare('PRAGMA foreign_key_check').all(), []);
  } finally { read.close(); }
});

test('Worker social: four lists paginate independently under tied timestamps and never expose unrelated identities', async t => {
  const f = await fixture(t), a = await f.session('A'), outsider = await f.session('Outside'), room = await f.room(a), sql = f.env.DB.sql;
  const insertUser = sql.prepare('INSERT INTO avatar_users (id,name,avatar,token_hash,revision,created_at) VALUES (?,?,?,?,1,?)');
  const insertPair = sql.prepare('INSERT INTO event_social_pairs (id,low_id,high_id,status,revision,greeting_id,sender_id,recipient_id,room_id,created_at,updated_at,friends_at) VALUES (?,?,?,?,1,?,?,?,?,?,?,?)');
  const insertBlock = sql.prepare('INSERT INTO event_social_blocks (actor_id,target_id,revision,created_at) VALUES (?,?,1,?)');
  const timestamp = '2026-09-30T10:00:00.000Z';
  for (const kind of ['incoming', 'outgoing', 'friends', 'blocks']) {
    for (let n = 0; n < 103; n++) {
      const id = randomUUID(); insertUser.run(id, `Synthetic ${kind} ${n}`, JSON.stringify(a.user.avatar), randomUUID(), timestamp);
      if (kind === 'blocks') insertBlock.run(a.user.id, id, timestamp);
      else {
        const [low, high] = [a.user.id, id].sort();
        insertPair.run(randomUUID(), low, high, kind === 'friends' ? 'accepted' : 'pending', randomUUID(), kind === 'incoming' ? id : a.user.id, kind === 'incoming' ? a.user.id : id, room.id, timestamp, timestamp, kind === 'friends' ? timestamp : null);
      }
    }
  }
  const first = await f.social(a);
  for (const kind of ['incoming', 'outgoing', 'friends', 'blocks']) {
    assert.equal(first[kind].length, 100); assert.ok(first.nextCursors[kind]);
    const second = (await f.request(`/social?${kind}Cursor=${first.nextCursors[kind]}`, { token: a.token })).body;
    assert.equal(second[kind].length, 3); assert.equal(second.nextCursors[kind], null);
    assert.equal(new Set([...first[kind], ...second[kind]].map(r => kind === 'blocks' ? r.userId : r.id)).size, 103);
    for (const other of ['incoming', 'outgoing', 'friends', 'blocks'].filter(k => k !== kind)) assert.equal(second[other].length, 100);
  }
  const stranger = await f.social(outsider); assert.equal(stranger.incoming.length + stranger.outgoing.length + stranger.friends.length + stranger.blocks.length, 0);
  const cursorGreeting = first.incoming[99]; assert.equal((await f.respond(cursorGreeting, 'reject', a)).status, 200);
  const after = await f.request('/social?incomingCursor=' + cursorGreeting.id, { token: a.token }); assert.equal(after.status, 200); assert.equal(after.body.incoming.length, 3);
});

for (const first of ['accept', 'cancel']) {
  test(`Worker social: deterministic ${first} wins over delayed competing greeting response`, async t => {
    const f = await fixture(t), { a, b, room } = await f.two(), greeting = (await f.send(room, a, b)).body.greeting;
    const barrier = pauseMutation(f, q => q.startsWith('UPDATE event_social_pairs SET status = ?'));
    const delayed = first === 'accept' ? f.respond(greeting, 'cancel', a) : f.respond(greeting, 'accept', b); await barrier.started;
    const winner = first === 'accept' ? await f.respond(greeting, 'accept', b) : await f.respond(greeting, 'cancel', a); assert.equal(winner.status, 200);
    barrier.release(); assert.equal((await delayed).status, 409);
    for (const u of [a, b]) assert.equal((await f.social(u)).friends.length, first === 'accept' ? 1 : 0);
  });
}

test('Worker social: leaving or closing during greeting send rejects its transactional guard', async t => {
  for (const change of ['leave', 'close']) {
    const f = await fixture(t), { a, b, room } = await f.two();
    const barrier = pauseMutation(f, q => q.includes('status=excluded.status'));
    const pending = f.send(room, a, b); await barrier.started;
    assert.equal((await f.request(`/rooms/${room.id}/${change}`, { method: 'POST', token: change === 'leave' ? b.token : a.token, data: change === 'leave' ? {} : { revision: 1 } })).status, 200);
    barrier.release(); assert.equal((await pending).status, 409); assert.equal((await f.social(b)).incoming.length, 0);
  }
});

test('Worker social: 24 attendees under one IP can poll room plus social every five seconds and load six wall photos', async t => {
  const f = await fixture(t, 'Worker', { rateLimits: true }), host = await f.session('Host'), room = await f.room(host);
  const people = [host, ...await Promise.all(Array.from({ length: 23 }, (_, n) => f.session('Member' + n)))];
  for (const person of people.slice(1)) assert.equal((await f.join(room, person)).status, 200);
  const photos = []; for (let n = 0; n < 6; n++) photos.push(await f.upload(room, host, 'members'));
  // Fixed clock keeps setup, 576 polling reads and 144 image reads in one bucket.
  // This is a rate-budget regression check, not network load/performance evidence.
  for (const person of people) {
    for (let n = 0; n < 12; n++) {
      assert.equal((await f.request('/rooms/' + room.id, { token: person.token })).status, 200);
      assert.equal((await f.request('/social', { token: person.token })).status, 200);
    }
    for (const photo of photos) assert.equal((await f.request(photo.imageUrl, { token: person.token })).status, 200);
  }
});

test('Worker social: each bearer still has an independent persistent 180/minute read ceiling', async t => {
  const f = await fixture(t, 'Worker', { rateLimits: true }), a = await f.session('A'), b = await f.session('B');
  for (let n = 0; n < 180; n++) assert.equal((await f.request('/social', { token: a.token })).status, 200);
  await f.restart(); assert.equal((await f.request('/social', { token: a.token })).status, 429);
  assert.equal((await f.request('/social', { token: b.token })).status, 200);
  f.advance(60_001); assert.equal((await f.request('/social', { token: a.token })).status, 200);
});

test('Worker social: temporary block/unblock cannot erase a rejection cooldown', async t => {
  const f = await fixture(t), { a, b, room } = await f.two();
  const greeting = (await f.send(room, a, b)).body.greeting; assert.equal((await f.respond(greeting, 'reject', b)).status, 200);
  const blocked = (await f.block(a, b)).body.block; assert.equal((await f.unblock(a, b, blocked.revision)).status, 200);
  const rejected = await f.send(room, a, b); assert.equal(rejected.status, 429); assert.equal(rejected.body.error.code, 'GREETING_COOLDOWN');
  f.advance(600_001); assert.equal((await f.send(room, a, b)).status, 201);
});

test('Worker social: explicit 24-image galleries for all 24 attendees plus polling, health and invite previews fit the shared-IP budget', async t => {
  const f = await fixture(t, 'Worker', { rateLimits: true }), host = await f.session('Host'), room = await f.room(host);
  const people = [host, ...await Promise.all(Array.from({ length: 23 }, (_, n) => f.session('Member' + n)))];
  for (const person of people.slice(1)) assert.equal((await f.join(room, person)).status, 200);
  const photos = [];
  for (const owner of people.slice(0, 4)) for (let n = 0; n < 6; n++) photos.push(await f.upload(room, owner, 'members'));
  for (let n = 0; n < 24; n++) assert.equal((await f.request('/health')).status, 200);
  for (let n = 0; n < 23; n++) assert.equal((await f.request('/preview/' + room.code)).status, 200);
  // 24*(12 roster + 12 social + 24 images) = 1152 reads, plus create/join24,
  // upload24, health24 and preview23 = 1247 total requests in one fixed minute.
  // This legitimate gallery burst exceeds the former 1200/IP budget, while each
  // person uses only48/180 authenticated reads; this is not a throughput test.
  for (const person of people) {
    for (let n = 0; n < 12; n++) {
      assert.equal((await f.request('/rooms/' + room.id, { token: person.token })).status, 200);
      assert.equal((await f.request('/social', { token: person.token })).status, 200);
    }
    for (const photo of photos) assert.equal((await f.request(photo.imageUrl, { token: person.token })).status, 200);
  }
});

test('Worker social: invite preview remains independently limited to120 per IP per minute', async t => {
  const f = await fixture(t, 'Worker', { rateLimits: true }), a = await f.session('A'), room = await f.room(a);
  for (let n = 0; n < 120; n++) assert.equal((await f.request('/preview/' + room.code)).status, 200);
  assert.equal((await f.request('/preview/' + room.code)).status, 429);
  assert.equal((await f.request('/health')).status, 200);
});

for (const mode of ['Node', 'Worker']) {
  test(`${mode} social peer: canonical pair snapshot respects identity, blocked/removal state and independent photo gates`, async t => {
    const f = await fixture(t, mode), { a, b, room } = await f.two(), outsider = await f.session('Outside');
    const url = '/social/peers/' + b.user.id;
    assert.equal((await f.request(url)).status, 401);
    assert.equal((await f.request(url, { token: outsider.token })).status, 404);
    assert.equal((await f.request('/social/peers/' + randomUUID(), { token: a.token })).status, 404);
    const peer = (await f.request(url, { token: a.token })).body;
    assert.deepEqual(peer, { actorId: a.user.id, peer: { id: b.user.id, name: b.user.name, avatar: b.user.avatar }, incoming: [], outgoing: [], friends: [], blocks: [] });
    const privatePhoto = await f.upload(room, b, 'private'), sharedPhoto = await f.upload(room, b, 'members');
    const greeting = (await f.send(room, a, b)).body.greeting;
    assert.equal((await f.request(url, { token: a.token })).body.outgoing[0].id, greeting.id);
    assert.equal((await f.request('/social/peers/' + a.user.id, { token: b.token })).body.incoming[0].id, greeting.id);
    await f.respond(greeting, 'accept', b);
    const accepted = (await f.request(url, { token: a.token })).body;
    assert.equal(accepted.friends.length, 1); assert.equal(accepted.outgoing.length, 0); assert.equal(accepted.friends[0].peer.id, b.user.id);
    assert.equal((await f.request(privatePhoto.imageUrl, { token: a.token })).status, 404);
    await f.request(`/rooms/${room.id}/leave`, { method: 'POST', token: a.token, data: {} });
    assert.equal((await f.request(url, { token: a.token })).body.friends.length, 1);
    assert.equal((await f.request(sharedPhoto.imageUrl, { token: a.token })).status, 404);
    assert.equal((await f.request(`/friends/${b.user.id}`, { method: 'DELETE', token: a.token, data: { revision: accepted.friends[0].revision } })).status, 200);
    const removed = (await f.request(url, { token: a.token })).body; assert.equal(removed.friends.length, 0); assert.equal(removed.peer.id, b.user.id);
    const ba = (await f.block(b, a)).body.block;
    assert.equal((await f.request(url, { token: a.token })).status, 404);
    const ab = (await f.block(a, b)).body.block;
    const own = (await f.request(url, { token: a.token })).body; assert.equal(own.blocks[0].revision, ab.revision); assert.equal(own.friends.length + own.incoming.length + own.outgoing.length, 0);
    await f.unblock(a, b, ab.revision); assert.equal((await f.request(url, { token: a.token })).status, 404);
    await f.unblock(b, a, ba.revision);
    const unblocked = (await f.request(url, { token: a.token })).body; assert.equal(unblocked.blocks.length + unblocked.friends.length + unblocked.incoming.length + unblocked.outgoing.length, 0);
    assert.equal((await f.request(privatePhoto.imageUrl, { token: a.token })).status, 404);
    assert.equal((await f.request(sharedPhoto.imageUrl, { token: a.token })).status, 404);
    for (const secret of [a.token, b.token, 'token_hash', 'photo_key', '\"phone\":', '\"email\":']) assert.ok(!JSON.stringify(unblocked).includes(secret));
  });
}

test('Worker social peer: a page2 friend/blocked target remains canonically addressable without first-page dependence', async t => {
  const f = await fixture(t), { a, b, room } = await f.two(), sql = f.env.DB.sql;
  const greeting = (await f.send(room, a, b)).body.greeting; await f.respond(greeting, 'accept', b);
  // Move this real accepted pair beyond100 synthetic earlier relationships.
  const lastId = 'ffffffff-ffff-4fff-bfff-ffffffffffff';
  sql.prepare('UPDATE event_social_pairs SET id=? WHERE greeting_id=?').run(lastId, greeting.id);
  const insertUser = sql.prepare('INSERT INTO avatar_users (id,name,avatar,token_hash,revision,created_at) VALUES (?,?,?,?,1,?)');
  const insertPair = sql.prepare("INSERT INTO event_social_pairs (id,low_id,high_id,status,revision,greeting_id,sender_id,recipient_id,room_id,created_at,updated_at,friends_at) VALUES (?,?,?,'accepted',1,?,?,?,?,?,?,?)");
  const stamp = '2026-09-30T10:00:00.000Z';
  for (let n = 0; n < 100; n++) {
    const id = randomUUID(); insertUser.run(id, 'Synthetic friend' + n, JSON.stringify(b.user.avatar), randomUUID(), stamp);
    const [low, high] = [a.user.id, id].sort(); insertPair.run(randomUUID(), low, high, randomUUID(), a.user.id, id, room.id, stamp, stamp, stamp);
  }
  const first = await f.social(a); assert.equal(first.friends.length, 100); assert.ok(!first.friends.some(row => row.userId === b.user.id));
  const second = (await f.request('/social?friendsCursor=' + first.nextCursors.friends, { token: a.token })).body; assert.equal(second.friends[0].userId, b.user.id);
  const canonical = (await f.request('/social/peers/' + b.user.id, { token: a.token })).body;
  assert.equal(canonical.friends.length, 1); assert.equal(canonical.friends[0].id, lastId); assert.equal(canonical.friends[0].revision, 2);
  assert.equal((await f.request('/friends/' + b.user.id, { method: 'DELETE', token: a.token, data: { revision: canonical.friends[0].revision } })).status, 200);
  assert.equal((await f.request('/social/peers/' + b.user.id, { token: a.token })).body.friends.length, 0);
  const block = (await f.block(a, b)).body.block;
  const manager = (await f.request('/social/peers/' + b.user.id, { token: a.token })).body;
  assert.equal(manager.blocks[0].revision, block.revision); assert.equal((await f.unblock(a, b, manager.blocks[0].revision)).status, 200);
});

test('Worker social peer: a block committed before a delayed canonical read hides the whole pair snapshot', async t => {
  const f = await fixture(t), { a, b, room } = await f.two(), greeting = (await f.send(room, a, b)).body.greeting;
  await f.respond(greeting, 'accept', b);
  const barrier = pauseMutation(f, q => q.startsWith('SELECT u.id AS peer_id'));
  const pending = f.request('/social/peers/' + b.user.id, { token: a.token }); await barrier.started;
  assert.equal((await f.block(b, a)).status, 200); barrier.release();
  assert.equal((await pending).status, 404);
  const own = (await f.request('/social/peers/' + a.user.id, { token: b.token })).body;
  assert.equal(own.blocks.length, 1); assert.equal(own.friends.length + own.incoming.length + own.outgoing.length, 0);
});
