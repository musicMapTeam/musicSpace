import { removeTempAfterTests } from './helpers/temp-directory.js';
// Real HTTP + SQLite, independent browser stores. This verifies controller
// state/authorization races, not rendered browser or WebGL appearance.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createAvatarApi, DEFAULT_AVATAR } from '../server/avatar-api.js';
import { createEventApi } from '../server/event-api.js';
import { createEventController, SESSION_KEY, EVENT_STORAGE_KEY } from '../web/event-client/controller.js';
import { photoData } from './event-contract.test.js';

const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
const localStore = () => { const items = new Map(); return { get length(){return items.size;},key:i=>[...items.keys()][i]??null, getItem: key => items.get(key) ?? null, setItem: (key, value) => items.set(key, String(value)), removeItem: key => items.delete(key) }; };
const profile = name => ({ name, avatar: { ...DEFAULT_AVATAR } });
const roomInput = (title = 'Synthetic social show') => ({ title, venue: 'Synthetic venue', songId: 'late-train', joinConsent: true, participation: 'open' });
const actorId = pair => pair.c.getState().identity.user.id;
const token = pair => JSON.parse(pair.storage.getItem(SESSION_KEY)).token;
async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'event-social-controller-')), controllers = [];
  let avatar, event, server, baseUrl, time = Date.parse('2026-09-30T10:00:00Z');
  async function start() {
    avatar = createAvatarApi({ dataDir: dir, clock: () => time, rateLimits: false });
    event = createEventApi({ dataDir: dir, clock: () => time, rateLimits: false });
    server = createServer(async (req, res) => { if (!await event(req, res) && !await avatar(req, res)) { res.writeHead(404); res.end(); } });
    server.listen(0, '127.0.0.1'); await once(server, 'listening'); baseUrl = `http://127.0.0.1:${server.address().port}`;
  }
  async function stop() { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); avatar.close(); event.close(); }
  await start();
  t.after(async () => { controllers.forEach(c => c.dispose()); await stop(); await removeTempAfterTests(dir); });
  const f = {
    dir, get baseUrl() { return baseUrl; }, advance: ms => time += ms,
    restart: async () => { await stop(); await start(); },
    client({ storage = localStore(), fetch: fetcher = fetch } = {}) {
      const c = createEventController({ storage, fetch: fetcher, baseUrl, timeoutMs: 2000 }); controllers.push(c); return { c, storage };
    },
    async person(name) { const p = f.client(); await p.c.connect(); await p.c.establishIdentity(profile(name)); return p; },
    async request(path, p, method = 'GET', body = {}) {
      const response = await fetch(baseUrl + '/api/event' + path, { method, headers: { Authorization: `Bearer ${token(p)}`, 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID() }, ...(method === 'GET' ? {} : { body: JSON.stringify(body) }) });
      return { status: response.status, body: await response.json() };
    },
  };
  return f;
}
async function joinRoom(c, room) { await c.previewRoom(room.code); await c.joinRoom(room.code, { joinConsent: true, participation: 'open' }); }
async function pairRoom(f) {
  const a = await f.person('A'), b = await f.person('B'), room = (await a.c.createRoom(roomInput())).room;
  await joinRoom(b.c, room); await a.c.refreshRoom(); await Promise.all([a.c.loadSocial(), b.c.loadSocial()]); return { a, b, room };
}
async function greet(a, b, room) { const result = await a.c.sendGreeting(actorId(b), { roomId: room.id }); await b.c.loadSocial(); return result.greeting; }

test('social lists are explicit, identity-global and secret-free; only recipient acceptance creates mutual friends', async t => {
  const f = await fixture(t), { a, b, room } = await pairRoom(f), outsider = await f.person('Outside');
  assert.equal(a.c.getState().social.loaded, true); assert.equal(a.c.getState().social.actorId, actorId(a));
  const privatePhoto = (await a.c.uploadPhoto(photoData().dataUrl, 'private', { roomId: room.id })).photo;
  const greeting = await greet(a, b, room);
  assert.equal(a.c.getState().social.outgoing[0].id, greeting.id); assert.equal(b.c.getState().social.incoming[0].id, greeting.id);
  assert.throws(() => a.c.acceptGreeting(greeting.id, { revision: greeting.revision }), error => error.code === 'SOCIAL_REQUIRED');
  await assert.rejects(b.c.sendGreeting(actorId(a), { roomId: room.id }), error => error.code === 'GREETING_PENDING');
  assert.deepEqual(a.c.getState().social.friends, []); assert.deepEqual(b.c.getState().social.friends, []);
  await b.c.acceptGreeting(greeting.id, { revision: greeting.revision }); await a.c.loadSocial();
  assert.equal(a.c.getState().social.friends[0].userId, actorId(b)); assert.equal(b.c.getState().social.friends[0].userId, actorId(a));
  await assert.rejects(b.c.fetchPhotoBlob(privatePhoto.id), error => error.status === 404);
  await outsider.c.loadSocial(); assert.deepEqual(outsider.c.getState().social.friends, []); assert.deepEqual(outsider.c.getState().social.incoming, []);
  await b.c.leaveRoom(room.id); await b.c.loadSocial(); assert.equal(b.c.getState().social.friends.length, 1);
  const publicState = JSON.stringify([a.c.getState(), b.c.getState(), await b.c.loadSocial()]);
  assert.ok(!publicState.includes(token(a))); assert.ok(!publicState.includes(token(b))); assert.ok(!a.storage.getItem(EVENT_STORAGE_KEY).includes(token(a)));
  assert.throws(() => { b.c.getState().social.friends[0].peer.name = 'Changed'; }, TypeError);
});

test('send reviews current room/peer and response actions bind exact IDs, roles and revisions', async t => {
  const f = await fixture(t), { a, b, room } = await pairRoom(f), other = (await a.c.createRoom(roomInput('Other show'))).room;
  assert.throws(() => a.c.sendGreeting(actorId(b), { roomId: room.id }), error => error.code === 'TARGET_CHANGED');
  assert.throws(() => a.c.sendGreeting(actorId(b), { roomId: other.id }), error => error.code === 'PERSON_REQUIRED');
  await a.c.openRoom(room.id); const first = await greet(a, b, room);
  assert.throws(() => b.c.acceptGreeting(first.id, { revision: first.revision + 1 }), error => error.code === 'REVIEW_STALE');
  await b.c.rejectGreeting(first.id, { revision: first.revision }); await a.c.loadSocial();
  assert.deepEqual(a.c.getState().social.outgoing, []); assert.deepEqual(b.c.getState().social.friends, []);
  await assert.rejects(a.c.sendGreeting(actorId(b), { roomId: room.id }), error => error.status === 429 && error.code === 'GREETING_COOLDOWN');
  f.advance(11 * 60_000); const second = await greet(a, b, room);
  await a.c.cancelGreeting(second.id, { revision: second.revision }); await b.c.loadSocial();
  assert.deepEqual(a.c.getState().social.outgoing, []); assert.deepEqual(b.c.getState().social.incoming, []);
});

test('lost greeting survives reload/server restart and replays frozen key/body without returning to the old room or resurrecting a handled greeting', async t => {
  const f = await fixture(t), { a, b, room } = await pairRoom(f), other = (await a.c.createRoom(roomInput('Other show'))).room;
  a.c.dispose(); const sent = []; let lose = true;
  const transport = async (url, options) => {
    const response = await fetch(url, options);
    if (options.method === 'POST' && url.endsWith('/greetings')) { sent.push({ url: new URL(url).pathname, body: options.body, key: options.headers['Idempotency-Key'] }); if (lose) { lose = false; throw Error('Synthetic lost send response'); } }
    return response;
  };
  const c = f.client({ storage: a.storage, fetch: transport }).c; await c.connect(); await c.openRoom(room.id);
  await assert.rejects(c.sendGreeting(actorId(b), { roomId: room.id }), error => error.code === 'NETWORK');
  const op = c.getState().pending[0], review = c.reviewOperation(op.id);
  assert.equal(review.target.userId, actorId(b)); assert.equal(review.target.roomId, room.id); assert.equal(review.payload.recipientId, actorId(b));
  assert.throws(() => { review.payload.recipientId = randomUUID(); }, TypeError);
  const savedKey = JSON.parse(a.storage.getItem(EVENT_STORAGE_KEY)).operations[0].key;
  assert.ok(!JSON.stringify([c.getState(), review]).includes(savedKey)); c.dispose();
  await b.c.loadSocial(); const greeting = b.c.getState().social.incoming[0]; await b.c.acceptGreeting(greeting.id, { revision: greeting.revision });
  await b.c.blockUser(actorId(a)); await f.restart();
  const restored = f.client({ storage: a.storage, fetch: transport }).c; await restored.connect(); await restored.openRoom(other.id); await restored.retry(op.id);
  assert.deepEqual(sent[0], sent[1]); assert.equal(restored.getState().route.target, other.id); assert.equal(restored.getState().room.id, other.id);
  assert.deepEqual(restored.getState().social.outgoing, []); assert.deepEqual(restored.getState().social.friends, []); assert.deepEqual(restored.getState().pending, []);
});

test('late same-identity greeting completion updates global lists without refreshing or navigating to its original room', async t => {
  const f = await fixture(t), { a, b, room } = await pairRoom(f), other = (await a.c.createRoom(roomInput('Other show'))).room;
  a.c.dispose(); const started = deferred(), gate = deferred(), reads = []; let hold = true;
  const c = f.client({ storage: a.storage, fetch: async (url, options) => {
    const response = await fetch(url, options);
    if (options.method === 'GET' && /\/rooms\//.test(url)) reads.push(new URL(url).pathname);
    if (hold && options.method === 'POST' && url.endsWith('/greetings')) { hold = false; started.resolve(); await gate.promise; }
    return response;
  } }).c;
  await c.connect(); await c.openRoom(room.id); const pending = c.sendGreeting(actorId(b), { roomId: room.id }); await started.promise;
  await c.openRoom(other.id); reads.length = 0; gate.resolve(); await pending;
  assert.equal(c.getState().route.target, other.id); assert.equal(c.getState().social.outgoing[0].recipientId, actorId(b));
  assert.deepEqual(reads, ['/api/event/rooms/' + other.id]);
});

test('a late acceptance receipt cannot revive friendship after the other person blocks; unblock restores nothing', async t => {
  const f = await fixture(t), { a, b, room } = await pairRoom(f), greeting = await greet(a, b, room);
  b.c.dispose(); const started = deferred(), gate = deferred(); let hold = true;
  const recipient = f.client({ storage: b.storage, fetch: async (url, options) => {
    const response = await fetch(url, options);
    if (hold && url.endsWith('/accept')) { hold = false; started.resolve(); await gate.promise; }
    return response;
  } }).c;
  await recipient.connect(); await recipient.openRoom(room.id); await recipient.loadSocial();
  const accepting = recipient.acceptGreeting(greeting.id, { revision: greeting.revision }); await started.promise;
  await a.c.blockUser(actorId(b)); await recipient.loadSocial(); assert.deepEqual(recipient.getState().social.friends, []);
  gate.resolve(); await accepting; assert.deepEqual(recipient.getState().social.friends, []); assert.deepEqual(recipient.getState().social.incoming, []);
  const block = a.c.getState().social.blocks[0]; await a.c.unblockUser(actorId(b), { revision: block.revision }); await recipient.loadSocial();
  assert.deepEqual(a.c.getState().social.blocks, []); assert.deepEqual(a.c.getState().social.friends, []); assert.deepEqual(recipient.getState().social.friends, []);
});

test('cancel/accept race rejects the old reviewed transition and reconciles current lists', async t => {
  const f = await fixture(t), { a, b, room } = await pairRoom(f), greeting = await greet(a, b, room);
  b.c.dispose(); const started = deferred(), gate = deferred(); let hold = true;
  const recipient = f.client({ storage: b.storage, fetch: async (url, options) => {
    if (hold && url.endsWith('/accept')) { hold = false; started.resolve(); await gate.promise; }
    return fetch(url, options);
  } }).c;
  await recipient.connect(); await recipient.loadSocial();
  const accepting = recipient.acceptGreeting(greeting.id, { revision: greeting.revision }); accepting.catch(() => {}); await started.promise;
  await a.c.cancelGreeting(greeting.id, { revision: greeting.revision }); gate.resolve();
  await assert.rejects(accepting, error => error.status === 409 && ['REVISION_CONFLICT', 'STATE_CONFLICT'].includes(error.code));
  assert.deepEqual(recipient.getState().social.incoming, []); assert.deepEqual(recipient.getState().social.friends, []);
  assert.equal(recipient.getState().pending[0].status, 'failed'); assert.equal(recipient.reviewOperation(recipient.getState().pending[0].id).payload.revision, greeting.revision);
});

test('confirmed block removes roster/photos immediately and failed refresh plus a pre-block late read cannot restore them', async t => {
  const f = await fixture(t), { a, b, room } = await pairRoom(f);
  const photo = (await b.c.uploadPhoto(photoData().dataUrl, 'members', { roomId: room.id })).photo; await a.c.refreshRoom(); a.c.dispose();
  const started = deferred(), gate = deferred(); let hold = false, failReads = false;
  const c = f.client({ storage: a.storage, fetch: async (url, options) => {
    if (failReads && options.method === 'GET' && (url.endsWith('/social') || url.endsWith('/rooms/' + room.id))) throw Error('Synthetic offline after block');
    const response = await fetch(url, { ...options, signal: undefined });
    if (hold && options.method === 'GET' && url.endsWith('/rooms/' + room.id)) { hold = false; started.resolve(); await gate.promise; }
    if (options.method === 'POST' && url.endsWith('/blocks/' + actorId(b))) failReads = true;
    return response;
  } }).c;
  await c.connect(); await c.openRoom(room.id); await c.loadSocial(); assert.ok(c.getState().photos.some(item => item.id === photo.id));
  hold = true; const stale = c.refreshRoom(); stale.catch(() => {}); await started.promise;
  await c.blockUser(actorId(b)); assert.ok(!c.getState().members.some(item => item.id === actorId(b))); assert.ok(!c.getState().photos.some(item => item.id === photo.id));
  assert.equal(c.getState().social.stale, true); gate.resolve(); await assert.rejects(stale, error => error.code === 'ABORTED');
  assert.ok(!c.getState().members.some(item => item.id === actorId(b))); assert.ok(!c.getState().photos.some(item => item.id === photo.id));
  failReads = false; await c.loadSocial(); await c.refreshRoom(); assert.equal(c.getState().social.blocks[0].userId, actorId(b));
});

test('pre-mutation social snapshot cannot restore a pending greeting after rejection', async t => {
  const f = await fixture(t), { a, b, room } = await pairRoom(f), greeting = await greet(a, b, room);
  b.c.dispose(); const started = deferred(), gate = deferred(); let hold = false;
  const c = f.client({ storage: b.storage, fetch: async (url, options) => {
    const response = await fetch(url, { ...options, signal: undefined });
    if (hold && url.endsWith('/social')) { hold = false; started.resolve(); await gate.promise; } return response;
  } }).c;
  await c.connect(); await c.loadSocial(); hold = true; const stale = c.loadSocial(); stale.catch(() => {}); await started.promise;
  await c.rejectGreeting(greeting.id, { revision: greeting.revision }); gate.resolve(); await assert.rejects(stale, error => error.code === 'ABORTED');
  assert.deepEqual(c.getState().social.incoming, []); assert.equal(c.getState().social.stale, false);
});

test('invalid identity clears global private lists and late reads; old frozen operations never switch actor', async t => {
  const f = await fixture(t), { a, b, room } = await pairRoom(f), greeting = await greet(a, b, room);
  await b.c.acceptGreeting(greeting.id, { revision: greeting.revision }); await a.c.loadSocial(); a.c.dispose();
  const started = deferred(), gate = deferred(); let hold = false, loseBlock = true;
  const c = f.client({ storage: a.storage, fetch: async (url, options) => {
    if (loseBlock && options.method === 'POST' && url.includes('/blocks/')) throw Error('Synthetic unavailable');
    const response = await fetch(url, { ...options, signal: undefined });
    if (hold && url.endsWith('/social')) { hold = false; started.resolve(); await gate.promise; } return response;
  } }).c;
  await c.connect(); await c.loadSocial(); assert.equal(c.getState().social.friends.length, 1);
  await assert.rejects(c.blockUser(actorId(b)), error => error.code === 'NETWORK'); const op = c.getState().pending[0];
  hold = true; const stale = c.loadSocial(); stale.catch(() => {}); await started.promise;
  const db = new DatabaseSync(join(f.dir, 'avatar-space.sqlite')); db.prepare('UPDATE avatar_users SET token_hash = ? WHERE id = ?').run('synthetic-revoked', actorId(a)); db.close();
  await assert.rejects(c.connect(), error => error.status === 401); assert.equal(c.getState().identity.status, 'invalid');
  assert.deepEqual(c.getState().social.friends, []); assert.equal(c.getState().social.loaded, false); gate.resolve(); await assert.rejects(stale, error => error.code === 'ABORTED');
  assert.deepEqual(c.getState().social.friends, []); await c.establishIdentity(profile('New A'), { replaceInvalid: true }); loseBlock = false;
  await assert.rejects(c.retry(op.id), error => error.code === 'IDENTITY_CHANGED'); await c.loadSocial(); assert.deepEqual(c.getState().social.blocks, []);
});

test('friend removal is revision-bound and authenticated contacts remain removed after page reload', async t => {
  const f = await fixture(t), { a, b, room } = await pairRoom(f), greeting = await greet(a, b, room);
  await b.c.acceptGreeting(greeting.id, { revision: greeting.revision }); await a.c.loadSocial(); const friend = a.c.getState().social.friends[0];
  assert.throws(() => a.c.removeFriend(actorId(b), { revision: friend.revision + 1 }), error => error.code === 'REVIEW_STALE');
  await a.c.removeFriend(actorId(b), { revision: friend.revision }); await b.c.loadSocial(); assert.deepEqual(b.c.getState().social.friends, []);
  a.c.dispose(); const c = f.client({ storage: a.storage }).c; assert.equal(c.getState().social.loaded, false); await c.connect(); await c.loadSocial(); assert.deepEqual(c.getState().social.friends, []);
});

test('removing browser identity during a delayed social read clears all identity-scoped lists without adopting its response', async t => {
  const f = await fixture(t), { a, b, room } = await pairRoom(f), greeting = await greet(a, b, room);
  await b.c.acceptGreeting(greeting.id, { revision: greeting.revision }); a.c.dispose();
  const started = deferred(), gate = deferred(); let hold = false;
  const c = f.client({ storage: a.storage, fetch: async (url, options) => {
    const response = await fetch(url, { ...options, signal: undefined });
    if (hold && url.endsWith('/social')) { hold = false; started.resolve(); await gate.promise; } return response;
  } }).c;
  await c.connect(); await c.loadSocial(); assert.equal(c.getState().social.friends.length, 1);
  hold = true; const stale = c.loadSocial(); await started.promise; a.storage.removeItem(SESSION_KEY); gate.resolve();
  const result = await stale; assert.equal(result.applied, false); assert.equal(c.getState().identity.status, 'lost');
  assert.deepEqual(c.getState().social.friends, []); assert.equal(c.getState().social.loaded, false);
});

test('a photo response already in flight cannot be returned to a view after its owner is blocked', async t => {
  const f = await fixture(t), { a, b, room } = await pairRoom(f);
  const photo = (await b.c.uploadPhoto(photoData().dataUrl, 'members', { roomId: room.id })).photo; a.c.dispose();
  const started = deferred(), gate = deferred(); let hold = true;
  const c = f.client({ storage: a.storage, fetch: async (url, options) => {
    const response = await fetch(url, options);
    if (hold && url.endsWith('/photos/' + photo.id + '/image')) { hold = false; started.resolve(); await gate.promise; } return response;
  } }).c;
  await c.connect(); await c.openRoom(room.id); const pending = c.fetchPhotoBlob(photo.id); pending.catch(() => {}); await started.promise;
  await c.blockUser(actorId(b)); gate.resolve(); await assert.rejects(pending, error => error.code === 'TARGET_CHANGED');
  assert.ok(!c.getState().photos.some(item => item.id === photo.id));
});

test('double-clicking a greeting shares one frozen in-flight operation and one network mutation', async t => {
  const f = await fixture(t), { a, b, room } = await pairRoom(f); a.c.dispose();
  const started = deferred(), gate = deferred(); let sends = 0;
  const c = f.client({ storage: a.storage, fetch: async (url, options) => {
    if (options.method === 'POST' && url.endsWith('/greetings')) { sends++; started.resolve(); await gate.promise; } return fetch(url, options);
  } }).c;
  await c.connect(); await c.openRoom(room.id); const first = c.sendGreeting(actorId(b), { roomId: room.id }); await started.promise;
  const second = c.sendGreeting(actorId(b), { roomId: room.id }); assert.equal(first, second); assert.equal(c.getState().pending.length, 1);
  gate.resolve(); await Promise.all([first, second]); assert.equal(sends, 1); assert.equal(c.getState().social.outgoing.length, 1);
});

test('a lost accept receipt retried after reload never revives a subsequently removed friendship', async t => {
  const f = await fixture(t), { a, b, room } = await pairRoom(f), greeting = await greet(a, b, room); b.c.dispose();
  let lose = true; const sent = [];
  const transport = async (url, options) => {
    const response = await fetch(url, options);
    if (url.endsWith('/accept')) { sent.push({ body: options.body, key: options.headers['Idempotency-Key'] }); if (lose) { lose = false; throw Error('Synthetic lost accept'); } }
    return response;
  };
  const c = f.client({ storage: b.storage, fetch: transport }).c; await c.connect(); await c.loadSocial();
  await assert.rejects(c.acceptGreeting(greeting.id, { revision: greeting.revision }), error => error.code === 'NETWORK');
  const pending = c.getState().pending[0]; c.dispose(); await a.c.loadSocial(); const friend = a.c.getState().social.friends[0];
  await a.c.removeFriend(actorId(b), { revision: friend.revision });
  const restored = f.client({ storage: b.storage, fetch: transport }).c; await restored.connect();
  const result = await restored.retry(pending.id); assert.ok(result.friend, 'original historical receipt is replayed');
  assert.deepEqual(sent[0], sent[1]); assert.deepEqual(restored.getState().social.friends, []); assert.deepEqual(restored.getState().social.incoming, []);
});

function seedFriends(f, owner, room, count = 105) {
  const db = new DatabaseSync(join(f.dir, 'avatar-space.sqlite')), time = '2026-09-30T10:00:00.000Z', peers = [];
  try {
    db.exec('PRAGMA foreign_keys=ON');
    const user = db.prepare('INSERT INTO avatar_users (id,name,avatar,token_hash,revision,created_at) VALUES (?,?,?,?,1,?)');
    const pair = db.prepare('INSERT INTO event_social_pairs (id,low_id,high_id,status,revision,greeting_id,sender_id,recipient_id,room_id,created_at,updated_at,friends_at) VALUES (?,?,?,\'accepted\',1,?,?,?,?,?,?,?)');
    for (let n = 1; n <= count; n++) {
      const id = randomUUID(), relationId = `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
      user.run(id, `Synthetic friend ${n}`, JSON.stringify(DEFAULT_AVATAR), randomUUID(), time);
      pair.run(relationId, ...[actorId(owner), id].sort(), randomUUID(), actorId(owner), id, room.id, time, time, time); peers.push(id);
    }
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  } finally { db.close(); }
  return peers;
}

test('canonical peer lookup manages a page-two friend while preserving unrelated pages/cursors and removed-peer header', async t => {
  const f = await fixture(t), a = await f.person('A'), room = (await a.c.createRoom(roomInput())).room, peers = seedFriends(f, a, room), userId = peers.at(-1);
  await a.c.loadSocial(); assert.equal(a.c.getState().social.friends.length, 100); const cursor = a.c.getState().social.nextCursors.friends;
  await a.c.loadSocial({ kind: 'friends', cursor }); const before = a.c.getState().social;
  assert.equal(before.friends.length, 105); await a.c.loadSocialPeer(userId);
  assert.equal(a.c.getState().social.friends.length, 105); assert.deepEqual(a.c.getState().social.nextCursors, before.nextCursors);
  const unrelated = a.c.getState().social.friends.filter(item => item.userId !== userId);
  await a.c.loadSocialPeer(userId); assert.deepEqual(a.c.getState().social.friends.filter(item => item.userId !== userId), unrelated);
  await a.c.loadSocial(); assert.equal(a.c.getState().social.friends.some(item => item.userId === userId), false, 'a first page is not evidence the cached last-page friend still exists');
  assert.equal(a.c.getState().social.focusedPeer.id, userId); await a.c.loadSocialPeer(userId);
  const friend = a.c.getState().social.friends.find(item => item.userId === userId); await a.c.removeFriend(userId, { revision: friend.revision }); await a.c.loadSocialPeer(userId);
  assert.equal(a.c.getState().social.focusedPeer.id, userId); assert.equal(a.c.getState().social.friends.some(item => item.userId === userId), false);
  assert.throws(() => a.c.removeFriend(userId, { revision: friend.revision }), error => error.code === 'SOCIAL_REQUIRED');
  await a.c.blockUser(userId); await a.c.loadSocialPeer(userId); const block = a.c.getState().social.blocks.find(item => item.userId === userId);
  assert.ok(block); await a.c.unblockUser(userId, { revision: block.revision }); await a.c.loadSocialPeer(userId);
  assert.equal(a.c.getState().social.focusedPeer.id, userId); assert.equal(a.c.getState().social.friends.some(item => item.userId === userId), false);
});

test('peer lookup exposes own mutual block, clears counterpart-only denied records/header, and rejects unknown identities', async t => {
  const f = await fixture(t), { a, b, room } = await pairRoom(f), greeting = await greet(a, b, room);
  await b.c.acceptGreeting(greeting.id, { revision: greeting.revision }); await a.c.loadSocial(); await a.c.loadSocialPeer(actorId(b));
  await a.c.blockUser(actorId(b)); await b.c.blockUser(actorId(a)); await a.c.loadSocialPeer(actorId(b));
  assert.equal(a.c.getState().social.blocks[0].userId, actorId(b)); assert.equal(a.c.getState().social.focusedPeer.id, actorId(b));
  await a.c.unblockUser(actorId(b), { revision: a.c.getState().social.blocks[0].revision });
  await assert.rejects(a.c.loadSocialPeer(actorId(b)), error => error.status === 404);
  assert.equal(a.c.getState().social.focusedPeer, null); assert.deepEqual(a.c.getState().social.friends, []); assert.deepEqual(a.c.getState().social.blocks, []);
  const outsider = await f.person('Outside'); await assert.rejects(a.c.loadSocialPeer(actorId(outsider)), error => error.status === 404);
  assert.equal(a.c.getState().social.focusedPeer, null);
});

test('newer peer proof of removal overrides an older global snapshot without resurrecting its friend', async t => {
  const f = await fixture(t), { a, b, room } = await pairRoom(f), greeting = await greet(a, b, room);
  await b.c.acceptGreeting(greeting.id, { revision: greeting.revision }); await a.c.loadSocial(); const friend = a.c.getState().social.friends[0]; a.c.dispose();
  const started = deferred(), gate = deferred(); let hold = false;
  const c = f.client({ storage: a.storage, fetch: async (url, options) => {
    const response = await fetch(url, options); if (hold && url.endsWith('/social')) { hold = false; started.resolve(); await gate.promise; } return response;
  } }).c;
  await c.connect(); await c.loadSocial(); hold = true; const old = c.loadSocial(); await started.promise;
  assert.equal((await f.request('/friends/' + actorId(b), a, 'DELETE', { revision: friend.revision })).status, 200);
  await c.loadSocialPeer(actorId(b)); assert.deepEqual(c.getState().social.friends, []); gate.resolve(); await old;
  assert.deepEqual(c.getState().social.friends, []); assert.equal(c.getState().social.focusedPeer.id, actorId(b));
});

test('older peer snapshot cannot reinsert a friend removed in a newer global snapshot', async t => {
  const f = await fixture(t), { a, b, room } = await pairRoom(f), greeting = await greet(a, b, room);
  await b.c.acceptGreeting(greeting.id, { revision: greeting.revision }); await a.c.loadSocial(); const friend = a.c.getState().social.friends[0]; a.c.dispose();
  const started = deferred(), gate = deferred(); let hold = true;
  const c = f.client({ storage: a.storage, fetch: async (url, options) => {
    const response = await fetch(url, options); if (hold && url.endsWith('/social/peers/' + actorId(b))) { hold = false; started.resolve(); await gate.promise; } return response;
  } }).c;
  await c.connect(); const old = c.loadSocialPeer(actorId(b)); await started.promise;
  assert.equal((await f.request('/friends/' + actorId(b), a, 'DELETE', { revision: friend.revision })).status, 200);
  await c.loadSocial(); gate.resolve(); assert.equal((await old).applied, false); assert.deepEqual(c.getState().social.friends, []);
});

test('peer reads are cancelled by navigation and social writes, and cannot cross identity loss', async t => {
  const f = await fixture(t), { a, b, room } = await pairRoom(f), other = (await a.c.createRoom(roomInput('Other'))).room; a.c.dispose();
  let pendingGate, pendingStart, hold = false;
  const c = f.client({ storage: a.storage, fetch: async (url, options) => {
    const response = await fetch(url, { ...options, signal: undefined });
    if (hold && url.endsWith('/social/peers/' + actorId(b))) { hold = false; pendingStart.resolve(); await pendingGate.promise; } return response;
  } }).c;
  await c.connect(); await c.openRoom(room.id);
  const delayed = () => { pendingGate = deferred(); pendingStart = deferred(); hold = true; const request = c.loadSocialPeer(actorId(b)); request.catch(() => {}); return request; };
  let old = delayed(); await pendingStart.promise; await c.openRoom(other.id); pendingGate.resolve(); await assert.rejects(old, error => error.code === 'ABORTED'); assert.equal(c.getState().social.focusedPeer, null);
  await c.openRoom(room.id); old = delayed(); await pendingStart.promise; await c.blockUser(actorId(b)); pendingGate.resolve(); await assert.rejects(old, error => error.code === 'ABORTED'); assert.equal(c.getState().social.blocks[0].userId, actorId(b));
  old = delayed(); await pendingStart.promise; a.storage.removeItem(SESSION_KEY); pendingGate.resolve(); assert.equal((await old).applied, false);
  assert.equal(c.getState().identity.status, 'lost'); assert.equal(c.getState().social.focusedPeer, null); assert.deepEqual(c.getState().social.blocks, []);
});

test('a peer-only canonical read supplies the exact actionable revision without pretending all lists were loaded', async t => {
  const f = await fixture(t), { a, b, room } = await pairRoom(f), greeting = await greet(a, b, room); b.c.dispose();
  const c = f.client({ storage: b.storage }).c; await c.connect(); await c.loadSocialPeer(actorId(a));
  assert.equal(c.getState().social.loaded, false); assert.equal(c.getState().social.incoming[0].revision, greeting.revision);
  await c.acceptGreeting(greeting.id, { revision: greeting.revision }); assert.equal(c.getState().social.friends[0].userId, actorId(a));
});
