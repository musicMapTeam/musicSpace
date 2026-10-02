import { removeTempAfterTests } from './helpers/temp-directory.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createAvatarApi } from '../server/avatar-api.js';
import { createEventApi } from '../server/event-api.js';
import { createAvatarWorker } from '../runtime-preview/src/avatar-worker.js';
import { createEventWorker } from '../runtime-preview/src/event-worker.js';
import { createFakeEnv } from '../runtime-preview/tests/d1-adapter.mjs';
import { EVENT_RECAP_PAGE_SIZE } from '../runtime-preview/src/event-recap.js';
import { photoData } from './event-contract.test.js';

async function fixture(t, mode = 'Worker') {
  const dir = await mkdtemp(join(tmpdir(), 'musicspace-recap-'));
  let time = Date.parse('2026-10-01T07:00:00Z'), env, server, avatar, event, base, sql;
  async function start() {
    if (mode === 'Worker') { env = createFakeEnv(join(dir, 'events.sqlite')); sql = env.DB.sql; return; }
    avatar = createAvatarApi({ dataDir: dir, clock: () => time, rateLimits: false });
    event = createEventApi({ dataDir: dir, clock: () => time, rateLimits: false });
    sql = new DatabaseSync(join(dir, 'avatar-space.sqlite'));
    server = createServer(async (req, res) => { if (!await event(req, res) && !await avatar(req, res)) { res.writeHead(404); res.end(); } });
    server.listen(0, '127.0.0.1'); await once(server, 'listening'); base = `http://127.0.0.1:${server.address().port}`;
  }
  async function stop() {
    if (mode === 'Worker') { env.DB.close(); return; }
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); sql.close(); avatar.close(); event.close();
  }
  await start(); t.after(async () => { await stop(); await removeTempAfterTests(dir); });
  const f = { get env() { return env; }, get sql() { return sql; }, advance: ms => time += ms, restart: async () => { await stop(); await start(); },
    async request(path, { method = 'GET', token, data, key = randomUUID(), headers = {} } = {}) {
      const suffix = path.startsWith('/api/') ? path : '/api/event' + path;
      const options = { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(data === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(method === 'GET' ? {} : { 'Idempotency-Key': key }), ...headers }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) };
      const result = mode === 'Node' ? await fetch(base + suffix, options) : await (suffix.startsWith('/api/avatar') ? createAvatarWorker({ clock: () => time, rateLimits: false }) : createEventWorker({ clock: () => time, rateLimits: false })).fetch(new Request('https://musicspace.test' + suffix, options), env);
      const bytes = Buffer.from(await result.arrayBuffer());
      return { status: result.status, headers: result.headers, bytes, body: result.headers.get('Content-Type')?.includes('json') ? JSON.parse(bytes) : null };
    },
  };
  f.session = async name => (await f.request('/api/avatar/session', { method: 'POST', data: { name } })).body;
  f.room = async a => (await f.request('/rooms', { method: 'POST', token: a.token, data: { title: '合成回顾现场', venue: '合成场地', songId: 'late-train', joinConsent: true, participation: 'open' } })).body.room;
  f.join = (room, a) => f.request(`/rooms/${room.code}/join`, { method: 'POST', token: a.token, data: { joinConsent: true, participation: 'open' } });
  f.leave = (room, a) => f.request(`/rooms/${room.id}/leave`, { method: 'POST', token: a.token, data: {} });
  f.block = (a, b) => f.request(`/blocks/${b.user.id}`, { method: 'POST', token: a.token, data: {} });
  f.upload = async (room, a, visibility = 'members') => (await f.request(`/rooms/${room.id}/photos`, { method: 'POST', token: a.token, data: { ...photoData(), visibility } })).body.photo;
  f.friend = async (room, a, b) => {
    const sent = await f.request(`/rooms/${room.id}/greetings`, { method: 'POST', token: a.token, data: { recipientId: b.user.id } }); assert.equal(sent.status, 201);
    const accepted = await f.request(`/greetings/${sent.body.greeting.id}/accept`, { method: 'POST', token: b.token, data: { revision: sent.body.greeting.revision } }); assert.equal(accepted.status, 200);
    return accepted.body.friend;
  };
  f.removeFriend = (a, b, revision) => f.request(`/friends/${b.user.id}`, { method: 'DELETE', token: a.token, data: { revision } });
  f.recap = (room, a, query = '') => f.request(`/rooms/${room.id}/recap${query}`, { token: a.token });
  f.two = async () => { const a = await f.session('Synthetic host'), b = await f.session('Synthetic attendee'), room = await f.room(a); assert.equal((await f.join(room, b)).status, 200); return { a, b, room }; };
  return f;
}

const ids = page => page.items.map(item => item.id).sort();

for (const mode of ['Node', 'Worker']) {
  test(`${mode} recap: authenticates historical access and returns current photos/friends without an attendee archive`, async t => {
    const f = await fixture(t, mode), { a, b, room } = await f.two(), outsider = await f.session('Outside');
    const own = await f.upload(room, a, 'private'), shared = await f.upload(room, b), hidden = await f.upload(room, b, 'private');
    assert.equal((await f.request(`/rooms/${room.id}/recap`)).status, 401);
    assert.equal((await f.recap(room, outsider)).status, 404);
    assert.equal((await f.recap({ id: randomUUID() }, a)).status, 404);
    let recap = await f.recap(room, a); assert.equal(recap.status, 200); assert.match(recap.headers.get('Cache-Control'), /no-store/);
    assert.deepEqual(Object.keys(recap.body).sort(), ['actorId', 'friends', 'photos', 'room']);
    assert.equal(recap.body.actorId, a.user.id); assert.equal(recap.body.room.joined, true);
    assert.deepEqual(ids(recap.body.photos), [own.id, shared.id].sort()); assert.deepEqual(recap.body.friends, { items: [], nextCursor: null });
    assert.ok(!JSON.stringify(recap.body).includes(hidden.id));
    for (const field of ['members', 'photo_key', 'token_hash', 'dataUrl', 'total']) assert.ok(!Object.hasOwn(recap.body, field));
    assert.ok(!JSON.stringify(recap.body).includes(b.user.name));
    const friend = await f.friend(room, a, b); recap = await f.recap(room, a);
    assert.deepEqual(recap.body.friends.items, [{ ...friend, userId: b.user.id, peer: { id: b.user.id, name: b.user.name, avatar: b.user.avatar } }]);
    assert.deepEqual(Object.keys(recap.body.photos.items[0]).sort(), ['createdAt', 'id', 'imageUrl', 'ownerId', 'revision', 'roomId', 'updatedAt', 'visibility']);
    assert.deepEqual(Object.keys(recap.body.friends.items[0].peer).sort(), ['avatar', 'id', 'name']);
    assert.equal((await f.request(shared.imageUrl, { token: a.token })).status, 200);
  });

  test(`${mode} recap: either member leaving removes others' photos while preserving own photos and current friends after restart`, async t => {
    const f = await fixture(t, mode), { a, b, room } = await f.two();
    const own = await f.upload(room, a), peer = await f.upload(room, b), friend = await f.friend(room, a, b);
    assert.equal((await f.leave(room, a)).status, 200);
    for (let pass = 0; pass < 2; pass++) {
      if (pass) await f.restart();
      const recap = (await f.recap(room, a)).body;
      assert.equal(recap.room.joined, false); assert.equal(recap.room.role, 'host'); assert.deepEqual(ids(recap.photos), [own.id]);
      assert.equal(recap.photos.items[0].visibility, 'private'); assert.deepEqual(ids(recap.friends), [friend.id]);
      assert.deepEqual(ids((await f.recap(room, b)).body.photos), [peer.id]);
      assert.equal((await f.request(peer.imageUrl, { token: a.token })).status, 404);
      assert.equal((await f.request(own.imageUrl, { token: a.token })).status, 200);
    }
    assert.equal((await f.join(room, a)).status, 200);
    assert.deepEqual(ids((await f.recap(room, a)).body.photos), [own.id, peer.id].sort());
    assert.deepEqual(ids((await f.recap(room, b)).body.photos), [peer.id]); // Rejoin never republishes the host's photo.
    assert.equal((await f.leave(room, b)).status, 200);
    assert.deepEqual(ids((await f.recap(room, a)).body.photos), [own.id]);
    const departed = (await f.recap(room, b)).body; assert.equal(departed.room.joined, false); assert.equal(departed.room.role, 'member'); assert.deepEqual(ids(departed.photos), [peer.id]);
  });

  test(`${mode} recap: closed and expired rooms retain readable photos; withdrawal and deletion revoke them`, async t => {
    const f = await fixture(t, mode), { a, b, room } = await f.two(), p = await f.upload(room, a);
    const second = await f.room(a); await f.join(second, b); const q = await f.upload(second, a);
    assert.equal((await f.request(`/rooms/${room.id}/close`, { method: 'POST', token: a.token, data: { revision: room.revision } })).status, 200);
    f.advance(24 * 60 * 60 * 1000 + 1);
    assert.equal((await f.recap(room, b)).body.room.status, 'closed');
    assert.equal((await f.recap(second, b)).body.room.status, 'expired');
    assert.deepEqual(ids((await f.recap(room, b)).body.photos), [p.id]); assert.deepEqual(ids((await f.recap(second, b)).body.photos), [q.id]);
    assert.equal((await f.request(`/photos/${p.id}`, { method: 'PATCH', token: a.token, data: { revision: 1, visibility: 'private' } })).status, 200);
    assert.deepEqual(ids((await f.recap(room, b)).body.photos), []); assert.deepEqual(ids((await f.recap(room, a)).body.photos), [p.id]);
    assert.equal((await f.request(`/photos/${q.id}`, { method: 'DELETE', token: a.token, data: { revision: 1 } })).status, 200);
    for (const actor of [a, b]) assert.deepEqual(ids((await f.recap(second, actor)).body.photos), []);
    assert.equal((await f.request(q.imageUrl, { token: a.token })).status, 404);
  });

  test(`${mode} recap: either-way blocking hides photos and current friends; unblocking never revives friendship`, async t => {
    const f = await fixture(t, mode), { a, b, room } = await f.two(), p = await f.upload(room, a), q = await f.upload(room, b);
    await f.friend(room, a, b);
    const block = (await f.block(b, a)).body.block;
    for (const [actor, own] of [[a, p], [b, q]]) { const recap = (await f.recap(room, actor)).body; assert.deepEqual(ids(recap.photos), [own.id]); assert.deepEqual(ids(recap.friends), []); }
    assert.equal((await f.request(`/blocks/${a.user.id}`, { method: 'DELETE', token: b.token, data: { revision: block.revision } })).status, 200);
    assert.deepEqual(ids((await f.recap(room, a)).body.photos), [p.id, q.id].sort()); assert.deepEqual(ids((await f.recap(room, a)).body.friends), []);
    await f.friend(room, a, b); await f.block(a, b);
    assert.deepEqual(ids((await f.recap(room, a)).body.photos), [p.id]); assert.deepEqual(ids((await f.recap(room, b)).body.friends), []);
  });

  test(`${mode} recap: friendship removal and a new greeting in another room never become historical friends here`, async t => {
    const f = await fixture(t, mode), { a, b, room } = await f.two(), other = await f.room(a); await f.join(other, b);
    const first = await f.friend(room, a, b);
    assert.deepEqual(ids((await f.recap(other, a)).body.friends), []);
    assert.equal((await f.removeFriend(a, b, first.revision)).status, 200);
    assert.deepEqual(ids((await f.recap(room, a)).body.friends), []);
    const second = await f.friend(other, a, b); assert.equal(second.id, first.id);
    for (let pass = 0; pass < 2; pass++) {
      if (pass) await f.restart();
      assert.deepEqual(ids((await f.recap(room, a)).body.friends), []);
      assert.deepEqual(ids((await f.recap(other, a)).body.friends), [second.id]);
    }
  });

  test(`${mode} recap: bounded pages independently scope both UUID cursors and tolerate removed cursor rows`, async t => {
    const f = await fixture(t, mode), { a, b, room } = await f.two(), foreign = await f.room(b), stamp = '2026-10-01T07:00:00.000Z';
    const photoIds = [], friendIds = [];
    // Synthetic metadata stays in a disposable test database. No test images or real users are seeded.
    const photo = f.sql.prepare('INSERT INTO event_photos (id,room_id,owner_id,photo_key,visibility,created_at,updated_at) VALUES (?,?,?,?,?,?,?)');
    const user = f.sql.prepare('INSERT INTO avatar_users (id,name,avatar,token_hash,created_at) VALUES (?,?,?,?,?)');
    const pair = f.sql.prepare("INSERT INTO event_social_pairs (id,low_id,high_id,status,greeting_id,sender_id,recipient_id,room_id,created_at,updated_at,friends_at) VALUES (?,?,?,'accepted',?,?,?,?,?,?,?)");
    for (let i = 0; i < EVENT_RECAP_PAGE_SIZE + 3; i++) {
      const photoId = randomUUID(), peerId = randomUUID(), pairId = randomUUID(); photoIds.push(photoId); friendIds.push(pairId);
      photo.run(photoId, room.id, a.user.id, 'synthetic/' + photoId, 'private', stamp, stamp);
      user.run(peerId, 'Synthetic peer ' + i, JSON.stringify(a.user.avatar), 'synthetic-' + peerId, stamp);
      pair.run(pairId, ...[a.user.id, peerId].sort(), randomUUID(), a.user.id, peerId, room.id, stamp, stamp, stamp);
    }
    photo.run(randomUUID(), foreign.id, a.user.id, 'synthetic/foreign', 'private', stamp, stamp);
    const first = (await f.recap(room, a)).body; assert.equal(first.photos.items.length, 24); assert.equal(first.friends.items.length, 24);
    assert.deepEqual(ids(first.photos), photoIds.sort().slice(0, 24)); assert.deepEqual(ids(first.friends), friendIds.sort().slice(0, 24));
    assert.ok(first.photos.nextCursor); assert.ok(first.friends.nextCursor);
    const photoOnly = (await f.recap(room, a, '?photosCursor=' + first.photos.nextCursor)).body;
    assert.deepEqual(ids(photoOnly.photos), photoIds.slice(24)); assert.deepEqual(photoOnly.friends, first.friends);
    const friendOnly = (await f.recap(room, a, '?friendsCursor=' + first.friends.nextCursor)).body;
    assert.deepEqual(ids(friendOnly.friends), friendIds.slice(24)); assert.deepEqual(friendOnly.photos, first.photos);
    await f.request('/photos/' + first.photos.nextCursor, { method: 'DELETE', token: a.token, data: { revision: 1 } });
    f.sql.prepare("UPDATE event_social_pairs SET status='removed',friends_at=NULL,revision=revision+1 WHERE id=?").run(first.friends.nextCursor);
    const both = '?photosCursor=' + first.photos.nextCursor + '&friendsCursor=' + first.friends.nextCursor;
    await f.restart();
    const second = (await f.recap(room, a, both)).body;
    assert.deepEqual(ids(second.photos), photoIds.slice(24)); assert.deepEqual(ids(second.friends), friendIds.slice(24));
    assert.equal(second.photos.nextCursor, null); assert.equal(second.friends.nextCursor, null);
    assert.equal(new Set([...ids(first.photos), ...ids(second.photos)]).size, 27);
    // An arbitrary valid position and IDs taken from another collection are never credentials.
    assert.equal((await f.recap(room, a, '?photosCursor=' + randomUUID())).status, 200);
    const outsider = await f.session('Outside'); assert.equal((await f.recap(room, outsider, both)).status, 404);
    for (const query of ['?photosCursor=bad', '?friendsCursor=', '?cursor=' + randomUUID(), '?photosCursor=' + first.photos.nextCursor + '&photosCursor=' + first.photos.nextCursor, '?photosCursor=' + randomUUID() + '&other=x']) {
      const rejected = await f.recap(room, a, query); assert.equal(rejected.status, 400); assert.equal(rejected.body.error.code, 'INVALID_CURSOR');
    }
  });
}

function pauseRecapSnapshot(f) {
  const batch = f.env.DB.batch.bind(f.env.DB); let armed = true, began, release;
  const started = new Promise(resolve => { began = resolve; }), waiting = new Promise(resolve => { release = resolve; });
  f.env.DB.batch = async statements => {
    if (armed && statements.some(statement => statement.query.includes('SELECT p.* FROM event_photos p WHERE p.room_id'))) { armed = false; began(); await waiting; }
    return batch(statements);
  };
  return { started, release };
}

for (const change of ['viewer leave', 'owner leave', 'withdraw', 'delete', 'block', 'friend removal', 'new friendship room']) {
  test(`Worker recap: ${change} committed after history lookup is applied by the final permission snapshot`, async t => {
    const f = await fixture(t), { a, b, room } = await f.two(), photo = await f.upload(room, b), friend = await f.friend(room, a, b);
    const other = change === 'new friendship room' ? await f.room(a) : null; if (other) await f.join(other, b);
    const barrier = pauseRecapSnapshot(f); t.after(barrier.release);
    const pending = f.recap(room, a); await barrier.started;
    if (change === 'viewer leave' || change === 'owner leave') assert.equal((await f.leave(room, change === 'viewer leave' ? a : b)).status, 200);
    if (change === 'withdraw' || change === 'delete') assert.equal((await f.request(`/photos/${photo.id}`, { method: change === 'delete' ? 'DELETE' : 'PATCH', token: b.token, data: { revision: 1, ...(change === 'withdraw' ? { visibility: 'private' } : {}) } })).status, 200);
    if (change === 'block') assert.equal((await f.block(b, a)).status, 200);
    if (change === 'friend removal' || change === 'new friendship room') assert.equal((await f.removeFriend(a, b, friend.revision)).status, 200);
    if (other) await f.friend(other, a, b);
    barrier.release(); const result = await pending; assert.equal(result.status, 200);
    assert.equal(result.body.room.joined, change !== 'viewer leave');
    assert.deepEqual(ids(result.body.photos), ['friend removal', 'new friendship room'].includes(change) ? [photo.id] : []);
    assert.deepEqual(ids(result.body.friends), ['block', 'friend removal', 'new friendship room'].includes(change) ? [] : [friend.id]);
  });
}
