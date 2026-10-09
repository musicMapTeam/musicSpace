import { removeTempAfterTests } from './helpers/temp-directory.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAvatarApi, DEFAULT_AVATAR } from '../server/avatar-api.js';
import { createEventApi } from '../server/event-api.js';
import { photoData } from './event-contract.test.js';
import { createEventController, SESSION_KEY, EVENT_STORAGE_KEY } from '../web/event-client/controller.js';
import { createEventApiClient } from '../web/event-client/api.js';

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const actor = { id: id(1), name: 'Synthetic actor', avatar: { hair: 1 }, revision: 1 };
const peer = { id: id(2), name: 'Synthetic peer', avatar: { hair: 2 } };
const room = (n, joined = true) => ({ id: id(n), title: `Synthetic room ${n}`, code: 'AAAAAAAAAAAA', joined, role: 'host', status: 'open', revision: 1 });
const photo = (n, roomId = id(10), ownerId = actor.id) => ({ id: id(n), roomId, ownerId, visibility: 'members', revision: 1, imageUrl: `/api/event/photos/${id(n)}/image` });
const friend = (n, roomId = id(10), userId = peer.id) => ({ id: id(n), roomId, userId, revision: 1, peer: { ...peer, id: userId } });
const page = (items = [], nextCursor = null) => ({ items, nextCursor });
const recap = (n, photos = [], friends = []) => ({ actorId: actor.id, room: room(n), photos: page(photos), friends: page(friends) });
const response = (data, status = 200) => Response.json(data, { status });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function setup(t, handler = () => undefined) {
  const entries = new Map([[SESSION_KEY, JSON.stringify({ token: 'a'.repeat(43), user: actor })]]);
  const storage = { get length(){return entries.size;},key:i=>[...entries.keys()][i]??null, getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, String(value)), removeItem: key => entries.delete(key) };
  const requests = [];
  const c = createEventController({ storage, timeoutMs: 3000, fetch: async (url, options) => {
    const path = url.replace(/^\/api\/(event|avatar)/, ''); requests.push({ url, path, method: options.method });
    const custom = await handler(path, options); if (custom !== undefined) return custom;
    if (path === '/health') return response({ ok: true });
    if (url === '/api/avatar/session') return response({ user: actor });
    if (/^\/rooms\/[^/]+$/.test(path)) return response({ actorId: actor.id, room: room(Number(path.slice(-12))), members: [actor, peer], photos: [] });
    if (path === '/social') return response({ actorId: actor.id, incoming: [], outgoing: [], friends: [], blocks: [], nextCursors: { incoming: null, outgoing: null, friends: null, blocks: null } });
    throw Error(`Unexpected test request: ${options.method} ${path}`);
  } });
  t.after(() => c.dispose()); return { c, storage, requests };
}

test('recap replaces independent photo/friend pages and refresh preserves both positions without persisting private rows', async t => {
  const firstPhotos = Array.from({ length: 24 }, (_, index) => photo(100 + index));
  const firstFriends = Array.from({ length: 24 }, (_, index) => friend(200 + index, id(10), id(400 + index)));
  const laterPhotos = [photo(124), photo(125)], laterFriends = [friend(224)];
  const { c, requests, storage } = setup(t, path => {
    if (!path.includes('/recap')) return;
    if (path.includes('?')) return response(recap(10, laterPhotos, laterFriends));
    return response({ ...recap(10), photos: page(firstPhotos, id(123)), friends: page(firstFriends, id(223)) });
  });
  assert.equal(requests.length, 0); await c.connect(); await c.openRoom(id(11));
  const before = c.getState(); await c.loadRoomRecap(id(10));
  assert.equal(c.getState().recap.photos.items.length, 24);
  await c.loadRoomRecap(id(10), { photosCursor: id(123), friendsCursor: id(223) });
  const state = c.getState();
  for (const key of ['room', 'route', 'members', 'photos', 'preview']) assert.deepEqual(state[key], before[key]);
  assert.deepEqual(state.recap.photos.items, laterPhotos); assert.deepEqual(state.recap.friends.items, laterFriends);
  assert.equal(state.recap.photosCursor, id(123)); assert.equal(state.recap.friendsCursor, id(223));
  assert.throws(() => { state.recap.photos.items.pop(); }, TypeError);
  await c.refreshRoomRecap();
  assert.equal(requests.at(-1).path, `/rooms/${id(10)}/recap?photosCursor=${id(123)}&friendsCursor=${id(223)}`);
  assert.deepEqual(c.getState().recap.photos.items, laterPhotos);
  assert.ok(!storage.getItem(EVENT_STORAGE_KEY).includes('imageUrl'));
  c.clearRoomRecap(); assert.equal(c.getState().recap.roomId, null); assert.equal(c.getState().room.id, id(11));
});

test('a delayed recap cannot replace another room, a newer page, a closed recap, or navigation', async t => {
  let held = null;
  const { c } = setup(t, async path => {
    if (!path.includes('/recap')) return;
    const roomNumber = Number(path.split('/')[2].slice(-12));
    const result = recap(roomNumber, [photo(path.includes('?') ? 101 : 100, id(roomNumber))]);
    if (held) { const pending = held; held = null; pending.started.resolve(); await pending.gate.promise; }
    return response(result);
  });
  await c.connect();
  for (const action of ['switch', 'page', 'close', 'navigate']) {
    held = { started: deferred(), gate: deferred() }; const gate = held;
    const stale = c.loadRoomRecap(id(10)); stale.catch(() => {}); await gate.started.promise;
    if (action === 'switch') await c.loadRoomRecap(id(11));
    if (action === 'page') await c.loadRoomRecap(id(10), { photosCursor: id(100) });
    if (action === 'close') c.clearRoomRecap();
    if (action === 'navigate') await c.openRoom(id(12));
    gate.gate.resolve(); await assert.rejects(stale, error => error.code === 'ABORTED');
    if (action === 'switch') assert.equal(c.getState().recap.roomId, id(11));
    if (action === 'page') assert.deepEqual(c.getState().recap.photos.items.map(item => item.id), [id(101)]);
    if (action === 'close' || action === 'navigate') assert.equal(c.getState().recap.roomId, null);
  }
});

test('recap rejects mismatched identity, room, page shape, ordering, scope and after-leave peer visibility', async t => {
  let result;
  const { c } = setup(t, path => path.endsWith('/recap') ? response(result) : undefined); await c.connect();
  const cases = [
    { ...recap(10), actorId: peer.id }, { ...recap(10), room: room(11) }, { ...recap(10), photos: { items: [] } },
    recap(10, [photo(100, id(11))]), recap(10, [photo(101), photo(100)]), recap(10, [photo(100), photo(100)]),
    { ...recap(10, [photo(100, id(10), peer.id)]), room: room(10, false) },
    recap(10, [], [{ ...friend(200), peer: actor }]),
  ];
  for (result of cases) { c.clearRoomRecap(); await assert.rejects(c.loadRoomRecap(id(10)), error => error.code === 'INVALID_RESPONSE'); assert.equal(c.getState().recap.loaded, false); }
  result = recap(10, [photo(100)]); await c.loadRoomRecap(id(10)); assert.equal(c.getState().recap.loaded, true);
});

test('identity replacement clears a pending recap and prevents its response from restoring private rows', async t => {
  const gate = deferred(), started = deferred();
  const { c, storage } = setup(t, async path => { if (path.endsWith('/recap')) { started.resolve(); await gate.promise; return response(recap(10, [photo(100)])); } });
  await c.connect(); const pending = c.loadRoomRecap(id(10)); await started.promise;
  storage.setItem(SESSION_KEY, JSON.stringify({ token: 'b'.repeat(43), user: { ...actor, id: peer.id } })); gate.resolve();
  assert.equal((await pending).applied, false); assert.equal(c.getState().identity.requiresReload, true);
  assert.equal(c.getState().recap.roomId, null); assert.deepEqual(c.getState().recap.photos.items, []);
});

test('guarded blobs require a visible recap photo and reject completion after close, switch or page replacement', async t => {
  let waiting = null;
  const { c, requests } = setup(t, async path => {
    if (path.includes('/recap')) { const roomNumber = Number(path.split('/')[2].slice(-12)); return response(recap(roomNumber, [photo(path.includes('?') ? 101 : 100, id(roomNumber))])); }
    if (path.endsWith('/image')) { const gate = waiting; if (gate) { gate.started.resolve(); await gate.release.promise; } return new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/jpeg' } }); }
  });
  await c.connect(); await c.openRoom(id(12)); await c.loadRoomRecap(id(10));
  const requestCount = requests.length;
  await assert.rejects(c.fetchPhotoBlob(id(999), { recapRoomId: id(10) }), error => error.code === 'TARGET_CHANGED'); assert.equal(requests.length, requestCount);
  for (const action of ['close', 'switch', 'page']) {
    await c.loadRoomRecap(id(10)); waiting = { started: deferred(), release: deferred() };
    const pending = c.fetchPhotoBlob(id(100), { recapRoomId: id(10) }); pending.catch(() => {}); await waiting.started.promise;
    if (action === 'close') c.clearRoomRecap();
    if (action === 'switch') await c.loadRoomRecap(id(11));
    if (action === 'page') await c.loadRoomRecap(id(10), { photosCursor: id(100) });
    waiting.release.resolve(); await assert.rejects(pending, error => error.code === 'TARGET_CHANGED');
    assert.equal(c.getState().room.id, id(12)); waiting = null;
  }
  assert.equal((await c.fetchPhotoBlob(id(100))).size, 3, 'ordinary room/library blobs do not require recap');
});

test('own recap withdrawal and deletion are revision-bound, page-local and invalidate older reads', async t => {
  let rows = [photo(100), photo(101, id(10), peer.id)], waiting = null;
  const { c } = setup(t, async (path, options) => {
    if (path.endsWith('/recap')) { const snapshot = structuredClone(rows); if (waiting) { const gate = waiting; waiting = null; gate.started.resolve(); await gate.release.promise; } return response(recap(10, snapshot)); }
    if (path === `/photos/${id(100)}` && options.method === 'PATCH') { rows[0] = { ...rows[0], visibility: 'private', revision: 2 }; return response({ photo: rows[0] }); }
    if (path === `/photos/${id(100)}` && options.method === 'DELETE') { rows = rows.filter(item => item.id !== id(100)); return response({ photoId: id(100) }); }
  });
  await c.connect(); await c.openRoom(id(11)); await c.loadRoomRecap(id(10));
  assert.throws(() => c.removePhoto(id(101), { revision: 1 }), error => error.code === 'PHOTO_REQUIRED');
  assert.throws(() => c.removePhoto(id(100), { revision: 2 }), error => error.code === 'REVIEW_STALE');
  assert.throws(() => c.setPhotoVisibility(id(100), 'members', { revision: 1 }), error => error.code === 'PHOTO_REQUIRED');
  for (const action of ['withdraw', 'delete']) {
    waiting = { started: deferred(), release: deferred() }; const gate = waiting;
    const stale = c.refreshRoomRecap(); stale.catch(() => {}); await gate.started.promise;
    if (action === 'withdraw') await c.setPhotoVisibility(id(100), 'private', { revision: 1 });
    else await c.removePhoto(id(100), { revision: 2 });
    gate.release.resolve(); await assert.rejects(stale, error => error.code === 'ABORTED');
    if (action === 'withdraw') { assert.equal(c.getState().recap.photos.items[0].visibility, 'private'); assert.equal(c.getState().recap.photos.items[0].revision, 2); }
    else assert.deepEqual(c.getState().recap.photos.items.map(item => item.id), [id(101)]);
    assert.deepEqual(c.getState().photos, []); assert.deepEqual(c.getState().myPhotos.items, []); assert.equal(c.getState().room.id, id(11));
  }
});

test('slow recap blobs survive an unchanged page refresh but fail when a refresh removes their photo', async t => {
  let rows = [photo(100)], waiting;
  const { c } = setup(t, async path => {
    if (path.endsWith('/recap')) return response(recap(10, rows));
    if (path.endsWith('/image')) { const gate = waiting; gate.started.resolve(); await gate.release.promise; return new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/jpeg' } }); }
  });
  await c.connect(); await c.loadRoomRecap(id(10));
  waiting = { started: deferred(), release: deferred() }; const same = c.fetchPhotoBlob(id(100), { recapRoomId: id(10) });
  await waiting.started.promise; await c.refreshRoomRecap(); await c.refreshRoomRecap(); waiting.release.resolve();
  assert.equal((await same).size, 3);
  waiting = { started: deferred(), release: deferred() }; const removed = c.fetchPhotoBlob(id(100), { recapRoomId: id(10) }); removed.catch(() => {});
  await waiting.started.promise; rows = []; await c.refreshRoomRecap(); waiting.release.resolve();
  await assert.rejects(removed, error => error.code === 'TARGET_CHANGED');
});

test('block immediately removes recap peers and prevents pre-block snapshots from restoring them when refresh fails', async t => {
  let blocked = false, waiting = null;
  const { c } = setup(t, async (path, options) => {
    if (blocked && options.method === 'GET' && !path.endsWith('/image')) throw Error('Synthetic disconnected read');
    if (path.endsWith('/recap')) { if (waiting) { const gate = waiting; waiting = null; gate.started.resolve(); await gate.release.promise; } return response(recap(10, [photo(100), photo(101, id(10), peer.id)], [friend(200)])); }
    if (path === `/blocks/${peer.id}` && options.method === 'POST') { blocked = true; return response({ block: { userId: peer.id, revision: 1, peer } }); }
  });
  await c.connect(); await c.loadRoomRecap(id(10));
  waiting = { started: deferred(), release: deferred() }; const gate = waiting;
  const stale = c.refreshRoomRecap(); stale.catch(() => {}); await gate.started.promise;
  await c.blockUser(peer.id); gate.release.resolve(); await assert.rejects(stale, error => error.code === 'ABORTED');
  assert.deepEqual(c.getState().recap.photos.items.map(item => item.id), [id(100)]); assert.deepEqual(c.getState().recap.friends.items, []);
  assert.equal(c.getState().recap.roomId, id(10));
});

test('friend removal clears the matching recap friend before failed reconciliation and cancels an older recap read', async t => {
  let removed = false, waiting;
  const { c } = setup(t, async (path, options) => {
    if (path === `/friends/${peer.id}` && options.method === 'DELETE') { removed = true; return response({ userId: peer.id, removed: true }); }
    if (removed && options.method === 'GET') throw Error('Synthetic unavailable reconciliation');
    if (path === '/social') return response({ actorId: actor.id, incoming: [], outgoing: [], friends: [friend(200)], blocks: [], nextCursors: { incoming: null, outgoing: null, friends: null, blocks: null } });
    if (path.endsWith('/recap')) { if (waiting) { const gate = waiting; waiting = null; gate.started.resolve(); await gate.release.promise; } return response(recap(10, [photo(100)], [friend(200)])); }
  });
  await c.connect(); await c.loadRoomRecap(id(10)); await c.loadSocial();
  waiting = { started: deferred(), release: deferred() }; const gate = waiting;
  const stale = c.refreshRoomRecap(); stale.catch(() => {}); await gate.started.promise;
  await c.removeFriend(peer.id, { revision: 1 }); gate.release.resolve(); await assert.rejects(stale, error => error.code === 'ABORTED');
  assert.deepEqual(c.getState().recap.friends.items, []); assert.deepEqual(c.getState().recap.photos.items.map(item => item.id), [id(100)]);
});

test('a newly uploaded photo does not get injected into a recap page that did not contain it', async t => {
  const { c } = setup(t, (path, options) => {
    if (path.includes('/recap')) return response(recap(10, [photo(101)]));
    if (path === `/rooms/${id(10)}/photos` && options.method === 'POST') return response({ photo: photo(999) });
  });
  await c.connect(); await c.openRoom(id(10)); await c.loadRoomRecap(id(10), { photosCursor: id(100) });
  await c.uploadPhoto('synthetic-reviewed-photo', 'members', { roomId: id(10) });
  assert.deepEqual(c.getState().photos.map(item => item.id), [id(999)]);
  assert.deepEqual(c.getState().recap.photos.items.map(item => item.id), [id(101)]);
  assert.equal(c.getState().recap.photosCursor, id(100));
});

test('late leave applies privacy to that room recap even after active navigation changed', async t => {
  const started = deferred(), release = deferred();
  const { c } = setup(t, async (path, options) => {
    if (path.endsWith('/recap')) return response(recap(10, [photo(100), photo(101, id(10), peer.id)], [friend(200)]));
    if (path === `/rooms/${id(10)}/leave` && options.method === 'POST') { started.resolve(); await release.promise; return response({ roomId: id(10), left: true }); }
  });
  await c.connect(); await c.openRoom(id(10)); const leaving = c.leaveRoom(id(10)); await started.promise;
  await c.openRoom(id(11)); await c.loadRoomRecap(id(10)); release.resolve(); assert.equal((await leaving).applied, false);
  assert.equal(c.getState().room.id, id(11)); assert.equal(c.getState().recap.room.joined, false);
  assert.deepEqual(c.getState().recap.photos.items.map(item => [item.id, item.visibility]), [[id(100), 'private']]);
  assert.equal(c.getState().recap.friends.items.length, 1, 'accepted friends remain allowed after leaving');
});

test('recap transport whitelists only unique UUID photo/friend cursors at its exact GET event endpoint', async () => {
  const calls = [], api = createEventApiClient({ fetch: async (url, options) => { calls.push({ url, options }); return response({ ok: true }); } });
  const path = `/rooms/${id(10)}/recap`;
  for (const query of ['', `?photosCursor=${id(100)}`, `?friendsCursor=${id(200)}`, `?photosCursor=${id(100)}&friendsCursor=${id(200)}`, `?friendsCursor=${id(200)}&photosCursor=${id(100)}`]) await api.request(path + query);
  const validCount = calls.length;
  for (const bad of [
    path + '?', path + '?cursor=' + id(100), path + '?photosCursor=', path + '?photosCursor=invalid',
    path + '?photosCursor=' + '-'.repeat(36), path + '?photosCursor=' + id(100) + '&photosCursor=' + id(101),
    path + '?photosCursor=' + id(100) + '&friendsCursor=' + id(200) + '&token=secret',
    path + '?photosCursor=' + id(100) + '%26friendsCursor=' + id(200), path + '?photosCursor=' + id(100) + '#fragment',
    `/rooms/${'-'.repeat(36)}/recap?photosCursor=${id(100)}`, `/social?photosCursor=${id(100)}&friendsCursor=${id(200)}`,
    `https://host.test${path}`, path + '?photosCursor=' + id(100) + '?friendsCursor=' + id(200),
  ]) await assert.rejects(api.request(bad), error => error.code === 'INVALID_PATH');
  await assert.rejects(api.request(path, { namespace: 'avatar' }), error => error.code === 'INVALID_PATH');
  await assert.rejects(api.request(path, { method: 'POST' }), error => error.code === 'INVALID_PATH');
  assert.equal(calls.length, validCount, 'malicious paths never reach the network');
  await api.request('/photos?cursor=' + id(100)); assert.equal(calls.length, validCount + 1, 'existing one-cursor paths remain supported');
});

test('real HTTP/SQLite recap stays separate from the active room and permits only current own-photo and friendship access after leave', async t => {
  const dataDir = await mkdtemp(join(tmpdir(), 'event-recap-client-'));
  const avatars = createAvatarApi({ dataDir, rateLimits: false }), events = createEventApi({ dataDir, rateLimits: false });
  const server = createServer(async (request, result) => { if (!await events(request, result) && !await avatars(request, result)) { result.writeHead(404); result.end(); } });
  server.listen(0, '127.0.0.1'); await once(server, 'listening'); const controllers = [];
  t.after(async () => { controllers.forEach(c => c.dispose()); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); avatars.close(); events.close(); await removeTempAfterTests(dataDir); });
  async function person(name) {
    const items = new Map(), storage = { get length(){return items.size;},key:i=>[...items.keys()][i]??null, getItem: key => items.get(key) ?? null, setItem: (key, value) => items.set(key, String(value)) };
    const c = createEventController({ storage, baseUrl: `http://127.0.0.1:${server.address().port}` }); controllers.push(c);
    await c.connect(); await c.establishIdentity({ name, avatar: { ...DEFAULT_AVATAR } }); return c;
  }
  const host = await person('Synthetic host'), guest = await person('Synthetic guest');
  const input = title => ({ title, venue: 'Synthetic venue', songId: 'late-train', joinConsent: true, participation: 'open' });
  const first = (await host.createRoom(input('First synthetic room'))).room;
  const hostPhoto = (await host.uploadPhoto(photoData().dataUrl, 'members', { roomId: first.id })).photo;
  await guest.previewRoom(first.code); await guest.joinRoom(first.code, { joinConsent: true, participation: 'open' });
  const ownPhoto = (await guest.uploadPhoto(photoData().dataUrl, 'members', { roomId: first.id })).photo;
  await host.refreshRoom(); const greeting = (await host.sendGreeting(guest.getState().identity.user.id)).greeting;
  await guest.loadSocial(); await guest.acceptGreeting(greeting.id, { revision: greeting.revision });
  const second = (await host.createRoom(input('Second synthetic room'))).room;
  await guest.previewRoom(second.code); await guest.joinRoom(second.code, { joinConsent: true, participation: 'open' });
  await guest.loadRoomRecap(first.id);
  assert.equal(guest.getState().room.id, second.id); assert.equal(guest.getState().recap.photos.items.length, 2); assert.equal(guest.getState().recap.friends.items.length, 1);
  assert.ok((await guest.fetchPhotoBlob(hostPhoto.id, { recapRoomId: first.id })).size > 50);
  await guest.setPhotoVisibility(ownPhoto.id, 'private', { revision: ownPhoto.revision });
  assert.equal(guest.getState().recap.photos.items.find(item => item.id === ownPhoto.id).visibility, 'private');
  assert.equal(guest.getState().room.id, second.id); assert.deepEqual(guest.getState().photos, []);
  await guest.openRoom(first.id); await guest.leaveRoom(first.id); assert.equal(guest.getState().recap.roomId, null);
  await guest.loadRoomRecap(first.id); const history = guest.getState().recap;
  assert.equal(history.room.joined, false); assert.deepEqual(history.photos.items.map(item => item.id), [ownPhoto.id]); assert.equal(history.friends.items.length, 1);
  await assert.rejects(guest.fetchPhotoBlob(hostPhoto.id, { recapRoomId: first.id }), error => error.code === 'TARGET_CHANGED');
  await guest.removePhoto(ownPhoto.id, { revision: history.photos.items[0].revision }); assert.deepEqual(guest.getState().recap.photos.items, []);
  await guest.blockUser(host.getState().identity.user.id); await guest.refreshRoomRecap();
  assert.deepEqual(guest.getState().recap.friends.items, []); assert.deepEqual(guest.getState().recap.photos.items, []);
});
