import { removeTempAfterTests } from './helpers/temp-directory.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createAvatarApi } from '../server/avatar-api.js';
import { createEventApi } from '../server/event-api.js';
import { createAvatarWorker } from '../runtime-preview/src/avatar-worker.js';
import { createEventWorker } from '../runtime-preview/src/event-worker.js';
import { createFakeEnv } from '../runtime-preview/tests/d1-adapter.mjs';
import { photoData } from './event-contract.test.js';

// Migration 0013: the photo facts behind 「同一刻，另一面」 (capture time and viewpoint, each with its source). They travel through the
// real worker in both engines (Worker on a D1-style adapter, Node over HTTP) and stay nullable, additive and invisible when private.
const DAY = 24 * 60 * 60 * 1000;
const START = Date.parse('2026-09-30T10:00:00Z');
const TAKEN_MIN = Date.UTC(2000, 0, 1);
const TAKEN_MAX = 32503680000000; // the database ceiling (year 3000); the worker is stricter: tomorrow
const FACTS = { takenAt: Date.parse('2026-09-26T21:47:20+08:00'), takenSource: 'exif', viewpoint: 'stage', viewpointSource: 'ai' };
const NONE = { takenAt: null, takenSource: null, viewpoint: null, viewpointSource: null };
const PHOTO_KEYS = ['createdAt', 'id', 'imageUrl', 'ownerId', 'revision', 'roomId', 'takenAt', 'takenSource', 'updatedAt', 'viewpoint', 'viewpointSource', 'visibility'];
const COLUMNS = ['taken_at', 'taken_source', 'viewpoint', 'viewpoint_source'];
const sqlCount = (sql, where, ...args) => sql.prepare(`SELECT COUNT(*) AS n FROM event_photos WHERE ${where}`).get(...args).n;
const plain = row => ({ ...row }); // node:sqlite rows have no prototype, which strict deepEqual tells apart from an object literal
const factsOf = photo => ({ takenAt: photo.takenAt, takenSource: photo.takenSource, viewpoint: photo.viewpoint, viewpointSource: photo.viewpointSource });
const ok = (response, status = 200) => { assert.equal(response.status, status, JSON.stringify(response.body)); return response.body; };
const rejected = (response, code, status = 400) => { assert.equal(response.status, status, JSON.stringify(response.body)); assert.equal(response.body.error.code, code); return response; };

async function fixture(t, mode) {
  const dir = await mkdtemp(join(tmpdir(), 'musicspace-photo-moment-')), file = join(dir, mode === 'Worker' ? 'events.sqlite' : 'avatar-space.sqlite');
  let time = START, env, server, avatar, event, base, sql;
  async function start() {
    if (mode === 'Worker') { env = createFakeEnv(file); sql = env.DB.sql; return; }
    avatar = createAvatarApi({ dataDir: dir, clock: () => time, rateLimits: false });
    event = createEventApi({ dataDir: dir, clock: () => time, rateLimits: false });
    sql = new DatabaseSync(file); sql.exec('PRAGMA foreign_keys = ON'); // a second connection for direct SQL; the server keeps its own
    server = createServer(async (req, res) => { if (!await event(req, res) && !await avatar(req, res)) { res.writeHead(404); res.end(); } });
    server.listen(0, '127.0.0.1'); await once(server, 'listening'); base = `http://127.0.0.1:${server.address().port}`;
  }
  async function stop() {
    if (mode === 'Worker') { env.DB.close(); return; }
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); sql.close(); avatar.close(); event.close();
  }
  await start(); t.after(async () => { await stop(); await removeTempAfterTests(dir); });
  const f = {
    get sql() { return sql; }, get time() { return time; }, advance: ms => time += ms, restart: async () => { await stop(); await start(); },
    /** Runs `work` on the closed database file (no server, no adapter), then starts again; this is where a database is put back to 0012. */
    async offline(work) { await stop(); const raw = new DatabaseSync(file); raw.exec('PRAGMA foreign_keys = ON'); try { await work(raw); } finally { raw.close(); await start(); } },
    async request(path, { method = 'GET', token, data, key = randomUUID() } = {}) {
      const suffix = path.startsWith('/api/') ? path : '/api/event' + path;
      const options = { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(data === undefined ? {} : { 'Content-Type': 'application/json' }), ...(method === 'GET' ? {} : { 'Idempotency-Key': key }) }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) };
      const result = mode === 'Node' ? await fetch(base + suffix, options) : await (suffix.startsWith('/api/avatar') ? createAvatarWorker({ clock: () => time, rateLimits: false }) : createEventWorker({ clock: () => time, rateLimits: false })).fetch(new Request('https://musicspace.test' + suffix, options), env);
      const bytes = Buffer.from(await result.arrayBuffer());
      return { status: result.status, headers: result.headers, bytes, body: result.headers.get('Content-Type')?.includes('json') ? JSON.parse(bytes) : null };
    },
    blobs: () => mode === 'Worker' ? env.PHOTOS.blobs.size : sql.prepare('SELECT COUNT(*) AS n FROM event_photo_blobs').get().n,
    rows: () => sql.prepare('SELECT COUNT(*) AS n FROM event_photos').get().n,
  };
  f.session = async name => ok(await f.request('/api/avatar/session', { method: 'POST', data: { name } }), 201);
  f.room = async a => ok(await f.request('/rooms', { method: 'POST', token: a.token, data: { title: '合成现场', venue: '合成场地', songId: 'late-train', joinConsent: true, participation: 'open' } }), 201).room;
  f.join = (room, a) => f.request(`/rooms/${room.code}/join`, { method: 'POST', token: a.token, data: { joinConsent: true, participation: 'open' } });
  /** The raw upload response; `extra` is merged over the explicit fields so a test can add, replace or (with undefined) leave out any key. */
  f.post = (room, a, visibility = 'members', extra = {}, key) => f.request(`/rooms/${room.id}/photos`, { method: 'POST', token: a.token, key, data: { ...photoData(), visibility, ...extra } });
  f.upload = async (...args) => ok(await f.post(...args), 201).photo;
  f.setVisibility = (photo, a, visibility) => f.request(`/photos/${photo.id}`, { method: 'PATCH', token: a.token, data: { revision: photo.revision, visibility } });
  f.roomPhotos = async (room, a) => ok(await f.request(`/rooms/${room.id}`, { token: a.token })).photos;
  f.ownPhotos = async a => ok(await f.request('/photos', { token: a.token })).photos;
  f.recap = async (room, a) => ok(await f.request(`/rooms/${room.id}/recap`, { token: a.token })).photos.items;
  f.two = async () => { const a = await f.session('Synthetic host'), b = await f.session('Synthetic attendee'), room = await f.room(a); ok(await f.join(room, b)); return { a, b, room }; };
  return f;
}

for (const mode of ['Node', 'Worker']) {
  test(`${mode} photo moment: all four facts round-trip through upload, room read, own photos and recap`, async t => {
    const f = await fixture(t, mode), { a, b, room } = await f.two();
    const uploaded = await f.upload(room, a, 'members', FACTS);
    assert.deepEqual(Object.keys(uploaded).sort(), PHOTO_KEYS); assert.deepEqual(factsOf(uploaded), FACTS);
    assert.deepEqual(plain(f.sql.prepare('SELECT taken_at,taken_source,viewpoint,viewpoint_source FROM event_photos WHERE id = ?').get(uploaded.id)), { taken_at: FACTS.takenAt, taken_source: 'exif', viewpoint: 'stage', viewpoint_source: 'ai' });
    // A member sees the shared photo's facts; the owner sees them in the room, in the personal library and in the recap of either person.
    for (const [who, photos] of [['member', await f.roomPhotos(room, b)], ['owner', await f.roomPhotos(room, a)], ['library', await f.ownPhotos(a)], ['host recap', await f.recap(room, a)], ['member recap', await f.recap(room, b)]]) {
      assert.equal(photos.length, 1, who); assert.equal(photos[0].id, uploaded.id, who); assert.deepEqual(Object.keys(photos[0]).sort(), PHOTO_KEYS, who); assert.deepEqual(factsOf(photos[0]), FACTS, who);
    }
    // Each pair stands on its own: a fully manual photo, then a time-only photo and a viewpoint-only photo.
    const manual = await f.upload(room, a, 'members', { takenAt: FACTS.takenAt + 45_000, takenSource: 'manual', viewpoint: 'friends', viewpointSource: 'manual' });
    const timeOnly = await f.upload(room, a, 'members', { takenAt: FACTS.takenAt + 90_000, takenSource: 'exif' });
    const viewOnly = await f.upload(room, a, 'members', { viewpoint: 'detail', viewpointSource: 'ai' });
    assert.deepEqual(factsOf(manual), { takenAt: FACTS.takenAt + 45_000, takenSource: 'manual', viewpoint: 'friends', viewpointSource: 'manual' });
    assert.deepEqual(factsOf(timeOnly), { ...NONE, takenAt: FACTS.takenAt + 90_000, takenSource: 'exif' });
    assert.deepEqual(factsOf(viewOnly), { ...NONE, viewpoint: 'detail', viewpointSource: 'ai' });
    const seen = new Map((await f.roomPhotos(room, b)).map(photo => [photo.id, factsOf(photo)]));
    assert.deepEqual([...seen.keys()].sort(), [uploaded, manual, timeOnly, viewOnly].map(photo => photo.id).sort());
    for (const photo of [uploaded, manual, timeOnly, viewOnly]) assert.deepEqual(seen.get(photo.id), factsOf(photo));
    // Withdrawing to private and sharing again changes visibility only; the facts are the photo's, not the visibility's.
    const withdrawn = ok(await f.setVisibility(uploaded, a, 'private')).photo; assert.deepEqual(factsOf(withdrawn), FACTS);
    const shared = ok(await f.setVisibility(withdrawn, a, 'members')).photo; assert.deepEqual(factsOf(shared), FACTS); assert.equal(shared.revision, 3);
    assert.deepEqual(factsOf((await f.roomPhotos(room, b)).find(photo => photo.id === uploaded.id)), FACTS);
  });

  test(`${mode} photo moment: facts of a private photo are invisible to everyone else until the owner shares it`, async t => {
    const f = await fixture(t, mode), { a, b, room } = await f.two(), outsider = await f.session('Outside');
    const secret = { takenAt: Date.parse('2026-09-26T22:21:10+08:00'), takenSource: 'manual', viewpoint: 'detail', viewpointSource: 'manual' };
    const hidden = await f.upload(room, a, 'private', secret), open = await f.upload(room, a, 'members', FACTS);
    const leaks = body => [hidden.id, String(secret.takenAt), '"viewpoint":"detail"', '"takenSource":"manual"'].filter(needle => JSON.stringify(body).includes(needle));
    for (const [who, token] of [['member', b.token], ['outsider', outsider.token]]) {
      const read = await f.request(`/rooms/${room.id}`, { token }); if (who === 'member') assert.deepEqual(leaks(read.body), []); else assert.equal(read.status, 404);
      const recap = await f.request(`/rooms/${room.id}/recap`, { token }); if (who === 'member') assert.deepEqual(leaks(recap.body), []); else assert.equal(recap.status, 404);
      assert.deepEqual(leaks((await f.request('/photos', { token })).body), []);
    }
    assert.deepEqual((await f.roomPhotos(room, b)).map(photo => photo.id), [open.id]);
    assert.deepEqual((await f.roomPhotos(room, a)).map(photo => photo.id).sort(), [hidden.id, open.id].sort()); // the owner still has both
    assert.deepEqual(factsOf((await f.ownPhotos(a)).find(photo => photo.id === hidden.id)), secret);
    // Sharing publishes the facts with the photo; withdrawing hides them again.
    const shared = ok(await f.setVisibility(hidden, a, 'members')).photo;
    assert.deepEqual(factsOf((await f.roomPhotos(room, b)).find(photo => photo.id === hidden.id)), secret);
    assert.deepEqual(factsOf((await f.recap(room, b)).find(photo => photo.id === hidden.id)), secret);
    ok(await f.setVisibility(shared, a, 'private'));
    assert.deepEqual(leaks((await f.request(`/rooms/${room.id}`, { token: b.token })).body), []); assert.deepEqual(leaks((await f.request(`/rooms/${room.id}/recap`, { token: b.token })).body), []);
    // After the owner leaves, the member cannot read any fact of the owner's photos either.
    ok(await f.request(`/rooms/${room.id}/leave`, { method: 'POST', token: a.token, data: {} }));
    assert.deepEqual(await f.roomPhotos(room, b), []); assert.deepEqual(await f.recap(room, b), []);
  });

  test(`${mode} photo moment: omitted facts, and explicit nulls, are stored and returned as nulls everywhere`, async t => {
    const f = await fixture(t, mode), { a, b, room } = await f.two();
    const omitted = await f.upload(room, a, 'members'), nulls = await f.upload(room, a, 'members', { takenAt: null, takenSource: null, viewpoint: null, viewpointSource: null });
    for (const photo of [omitted, nulls]) { assert.deepEqual(Object.keys(photo).sort(), PHOTO_KEYS); assert.deepEqual(factsOf(photo), NONE); }
    for (const photos of [await f.roomPhotos(room, b), await f.ownPhotos(a), await f.recap(room, b)]) { assert.equal(photos.length, 2); for (const photo of photos) assert.deepEqual(factsOf(photo), NONE); }
    assert.deepEqual(f.sql.prepare(`SELECT ${COLUMNS.join(',')} FROM event_photos`).all().map(row => Object.values(row)), [[null, null, null, null], [null, null, null, null]]);
    // The old request shape, with no new key at all, is exactly what it was before 0013.
    const legacy = await f.request(`/rooms/${room.id}/photos`, { method: 'POST', token: a.token, data: { dataUrl: photoData().dataUrl, visibility: 'private' } });
    assert.deepEqual(factsOf(ok(legacy, 201).photo), NONE);
  });

  test(`${mode} photo moment: invalid facts are rejected with their own 400 code and store nothing`, async t => {
    const f = await fixture(t, mode), { a, room } = await f.two();
    const cases = [
      ['INVALID_TAKEN_AT', { takenAt: String(FACTS.takenAt), takenSource: 'exif' }], ['INVALID_TAKEN_AT', { takenAt: FACTS.takenAt + 0.5, takenSource: 'exif' }],
      ['INVALID_TAKEN_AT', { takenAt: true, takenSource: 'exif' }], ['INVALID_TAKEN_AT', { takenAt: [FACTS.takenAt], takenSource: 'exif' }], ['INVALID_TAKEN_AT', { takenAt: { ms: FACTS.takenAt }, takenSource: 'manual' }],
      ['INVALID_TAKEN_AT', { takenAt: 0, takenSource: 'exif' }], ['INVALID_TAKEN_AT', { takenAt: -FACTS.takenAt, takenSource: 'exif' }], ['INVALID_TAKEN_AT', { takenAt: TAKEN_MIN - 1, takenSource: 'exif' }],
      ['INVALID_TAKEN_AT', { takenAt: START + DAY + 1, takenSource: 'manual' }], ['INVALID_TAKEN_AT', { takenAt: TAKEN_MAX, takenSource: 'exif' }], ['INVALID_TAKEN_AT', { takenAt: Number.MAX_SAFE_INTEGER, takenSource: 'exif' }],
      ['INVALID_TAKEN_SOURCE', { takenAt: FACTS.takenAt, takenSource: 'file' }], ['INVALID_TAKEN_SOURCE', { takenAt: FACTS.takenAt, takenSource: 'mtime' }], ['INVALID_TAKEN_SOURCE', { takenAt: FACTS.takenAt, takenSource: 'EXIF' }],
      ['INVALID_TAKEN_SOURCE', { takenAt: FACTS.takenAt, takenSource: '' }], ['INVALID_TAKEN_SOURCE', { takenAt: FACTS.takenAt, takenSource: 1 }], ['INVALID_TAKEN_SOURCE', { takenAt: FACTS.takenAt, takenSource: ['exif'] }],
      ['INVALID_VIEWPOINT', { viewpoint: 'sky', viewpointSource: 'manual' }], ['INVALID_VIEWPOINT', { viewpoint: '', viewpointSource: 'manual' }], ['INVALID_VIEWPOINT', { viewpoint: 'STAGE', viewpointSource: 'ai' }],
      ['INVALID_VIEWPOINT', { viewpoint: 1, viewpointSource: 'ai' }], ['INVALID_VIEWPOINT', { viewpoint: ['stage'], viewpointSource: 'ai' }], ['INVALID_VIEWPOINT', { viewpoint: 'constructor', viewpointSource: 'manual' }],
      ['INVALID_VIEWPOINT_SOURCE', { viewpoint: 'stage', viewpointSource: 'model' }], ['INVALID_VIEWPOINT_SOURCE', { viewpoint: 'stage', viewpointSource: 'file' }], ['INVALID_VIEWPOINT_SOURCE', { viewpoint: 'stage', viewpointSource: '' }],
      ['INVALID_VIEWPOINT_SOURCE', { viewpoint: 'crowd', viewpointSource: 'AI' }], ['INVALID_VIEWPOINT_SOURCE', { viewpoint: 'crowd', viewpointSource: true }],
    ];
    for (const [code, body] of cases) rejected(await f.post(room, a, 'members', body), code);
    assert.equal(f.rows(), 0); assert.equal(f.blobs(), 0); assert.deepEqual(await f.ownPhotos(a), []);
    // A refused request records nothing against its key, so the same key is still free for a corrected body.
    const key = randomUUID(); rejected(await f.post(room, a, 'members', { takenAt: 1, takenSource: 'exif' }, key), 'INVALID_TAKEN_AT');
    assert.deepEqual(factsOf(ok(await f.post(room, a, 'members', FACTS, key), 201).photo), FACTS);
    // The older rules still hold with facts present: visibility is still demanded, and an unauthenticated caller is still turned away.
    rejected(await f.request(`/rooms/${room.id}/photos`, { method: 'POST', token: a.token, data: { dataUrl: photoData().dataUrl, ...FACTS } }), 'VISIBILITY_REQUIRED');
    assert.equal((await f.request(`/rooms/${room.id}/photos`, { method: 'POST', data: { ...photoData(), ...FACTS } })).status, 401);
  });

  test(`${mode} photo moment: each fact pair is both-or-neither`, async t => {
    const f = await fixture(t, mode), { a, room } = await f.two();
    const halves = [{ takenAt: FACTS.takenAt }, { takenSource: 'exif' }, { viewpoint: 'stage' }, { viewpointSource: 'ai' },
      { takenAt: FACTS.takenAt, takenSource: null }, { takenAt: null, takenSource: 'manual' }, { viewpoint: 'crowd', viewpointSource: null }, { viewpoint: null, viewpointSource: 'manual' },
      { ...FACTS, viewpointSource: null }, { ...FACTS, takenSource: null }, { takenAt: FACTS.takenAt, takenSource: 'exif', viewpointSource: 'ai' }, { viewpoint: 'stage', viewpointSource: 'ai', takenSource: 'exif' }];
    for (const body of halves) rejected(await f.post(room, a, 'members', body), 'INVALID_INPUT');
    assert.equal(f.rows(), 0); assert.equal(f.blobs(), 0);
    // A complete pair on one side does not need the other side.
    ok(await f.post(room, a, 'members', { takenAt: FACTS.takenAt, takenSource: 'exif' }), 201); ok(await f.post(room, a, 'members', { viewpoint: 'crowd', viewpointSource: 'manual' }), 201);
    assert.equal(f.rows(), 2);
  });

  test(`${mode} photo moment: capture time accepts exactly 2000-01-01 .. now plus one day, judged on the worker clock`, async t => {
    const f = await fixture(t, mode), { a, b, room } = await f.two();
    const at = takenAt => f.post(room, a, 'members', { takenAt, takenSource: 'manual' });
    assert.equal(f.time, START);
    assert.equal(ok(await at(START + DAY), 201).photo.takenAt, START + DAY); // the very edge of tomorrow
    rejected(await at(START + DAY + 1), 'INVALID_TAKEN_AT');
    assert.equal(ok(await at(TAKEN_MIN), 201).photo.takenAt, TAKEN_MIN); // exactly 2000-01-01T00:00:00Z
    rejected(await at(TAKEN_MIN - 1), 'INVALID_TAKEN_AT');
    f.advance(1); assert.equal(ok(await at(START + DAY + 1), 201).photo.takenAt, START + DAY + 1); // the bound moves with the clock
    rejected(await at(START + DAY + 2), 'INVALID_TAKEN_AT');
    assert.deepEqual((await f.roomPhotos(room, b)).map(photo => photo.takenAt).sort((x, y) => x - y), [TAKEN_MIN, START + DAY, START + DAY + 1]);
    assert.equal(f.rows(), 3);
  });

  test(`${mode} photo moment: the same Idempotency-Key replays an identical body exactly and refuses a different fact`, async t => {
    const f = await fixture(t, mode), { a, room } = await f.two(), key = randomUUID();
    const first = await f.post(room, a, 'members', FACTS, key); const photo = ok(first, 201).photo;
    const replay = await f.post(room, a, 'members', FACTS, key); assert.equal(ok(replay, 201).photo.id, photo.id); assert.equal(replay.headers.get('Idempotency-Replayed'), 'true');
    assert.deepEqual(replay.body, first.body); assert.equal(f.rows(), 1); assert.equal(f.blobs(), 1);
    // The request hash covers every fact: change one, add one or drop them all and the key is not reusable.
    for (const changed of [{ ...FACTS, takenAt: FACTS.takenAt + 1 }, { ...FACTS, takenSource: 'manual' }, { ...FACTS, viewpoint: 'crowd' }, { ...FACTS, viewpointSource: 'manual' }, { takenAt: FACTS.takenAt, takenSource: 'exif' }, {}]) {
      const conflict = rejected(await f.post(room, a, 'members', changed, key), 'IDEMPOTENCY_CONFLICT', 409); assert.equal(conflict.headers.get('Idempotency-Replayed'), null);
    }
    // A body without facts keeps its own key the same way, and cannot later be replayed with facts attached.
    const bare = randomUUID(); ok(await f.post(room, a, 'members', {}, bare), 201);
    rejected(await f.post(room, a, 'members', FACTS, bare), 'IDEMPOTENCY_CONFLICT', 409); assert.equal(ok(await f.post(room, a, 'members', {}, bare), 201).photo.takenAt, null);
    assert.equal(f.rows(), 2); assert.equal(f.blobs(), 2);
    // Surviving a restart changes nothing: the stored receipt is the one replayed.
    await f.restart(); assert.deepEqual((await f.post(room, a, 'members', FACTS, key)).body, first.body);
  });

  test(`${mode} photo moment: unknown keys are still refused, a file's own modification time among them`, async t => {
    const f = await fixture(t, mode), { a, room } = await f.two();
    for (const extra of [{ mtime: FACTS.takenAt }, { lastModified: FACTS.takenAt }, { taken_at: FACTS.takenAt, taken_source: 'exif' }, { takenAtMs: FACTS.takenAt }, { viewpoint_source: 'ai' },
      { source: 'file' }, { exif: {} }, { takenSource: 'exif', takenAt: FACTS.takenAt, confidence: 0.9 }, { viewpointConfidence: 0.04 }, JSON.parse('{"__proto__":{"takenAt":1}}'), { constructor: 1 }]) {
      rejected(await f.post(room, a, 'members', { ...FACTS, ...extra }), 'INVALID_INPUT');
    }
    assert.equal(f.rows(), 0); assert.equal(f.blobs(), 0);
  });

  test(`${mode} photo moment: the database itself refuses facts that break its CHECK constraints, and accepts the edges`, async t => {
    const f = await fixture(t, mode), { a, room } = await f.two();
    const insert = f.sql.prepare('INSERT INTO event_photos (id,room_id,owner_id,photo_key,visibility,revision,created_at,updated_at,deleted_at,taken_at,taken_source,viewpoint,viewpoint_source) VALUES (?,?,?,?,?,1,?,?,NULL,?,?,?,?)');
    const put = (takenAt, takenSource, viewpoint, viewpointSource) => { const id = randomUUID(); insert.run(id, room.id, a.user.id, 'synthetic/' + id, 'members', 'date', 'date', takenAt, takenSource, viewpoint, viewpointSource); return id; };
    const bad = [
      [TAKEN_MIN - 1, 'exif', null, null], [TAKEN_MAX + 1, 'exif', null, null], [-1, 'manual', null, null], [FACTS.takenAt, null, null, null], [null, 'exif', null, null], [FACTS.takenAt, 'file', null, null], [FACTS.takenAt, '', null, null],
      [null, null, 'sky', 'ai'], [null, null, 'STAGE', 'ai'], [null, null, 'stage', null], [null, null, null, 'ai'], [null, null, 'stage', 'model'], [null, null, 'stage', ''],
    ];
    for (const values of bad) assert.throws(() => put(...values), /CHECK constraint failed/, JSON.stringify(values));
    assert.equal(f.rows(), 0);
    for (const values of [[null, null, null, null], [TAKEN_MIN, 'manual', null, null], [TAKEN_MAX, 'exif', null, null], [null, null, 'stage', 'ai'], [null, null, 'crowd', 'manual'], [null, null, 'friends', 'ai'], [null, null, 'detail', 'manual'], [FACTS.takenAt, 'exif', 'stage', 'ai']]) put(...values);
    assert.equal(f.rows(), 8);
    // The worker's own rule is the stricter one: the database ceiling is year 3000, the worker's is tomorrow.
    assert.equal(sqlCount(f.sql, 'taken_at > ?', START + DAY), 1);
    // The moment index exists, is partial (only photos that have a time and are not withdrawn) and covers room, then time.
    const index = f.sql.prepare("PRAGMA index_list('event_photos')").all().find(row => row.name === 'event_photo_moment'); assert.equal(index.partial, 1); assert.equal(index.unique, 0);
    assert.deepEqual(f.sql.prepare("PRAGMA index_info('event_photo_moment')").all().map(row => row.name), ['room_id', 'taken_at']);
    assert.match(f.sql.prepare("SELECT sql FROM sqlite_master WHERE name = 'event_photo_moment'").get().sql, /WHERE taken_at IS NOT NULL AND deleted_at IS NULL/);
    assert.deepEqual(f.sql.prepare("SELECT name FROM pragma_table_info('event_photos') WHERE name IN ('taken_at','taken_source','viewpoint','viewpoint_source') ORDER BY cid").all().map(row => row.name), COLUMNS);
    assert.deepEqual(f.sql.prepare('PRAGMA foreign_key_check').all(), []);
  });

  test(`${mode} photo moment: a database at 0012 with existing photos upgrades to 0013 with every row intact and keeps working`, async t => {
    const f = await fixture(t, mode), { a, b, room } = await f.two(), d0013 = await readFile(new URL('../runtime-preview/drizzle/0013_event_photo_moment.sql', import.meta.url), 'utf8');
    const old = { shared: randomUUID(), hidden: randomUUID(), removed: randomUUID() };
    let before;
    await f.offline(raw => {
      // Put the real database back to its 0012 shape: no photo facts, no moment index, and (Node) no ledger row for 0013.
      raw.exec('DROP INDEX event_photo_moment');
      for (const column of ['taken_source', 'taken_at', 'viewpoint_source', 'viewpoint']) raw.exec(`ALTER TABLE event_photos DROP COLUMN ${column}`);
      if (raw.prepare("SELECT 1 FROM sqlite_master WHERE name = '_node_event_migrations'").get()) raw.prepare('DELETE FROM _node_event_migrations WHERE name = ?').run('0013_event_photo_moment.sql');
      assert.deepEqual(raw.prepare('PRAGMA table_info(event_photos)').all().map(row => row.name), ['id', 'room_id', 'owner_id', 'photo_key', 'visibility', 'revision', 'created_at', 'updated_at', 'deleted_at']);
      const put = raw.prepare('INSERT INTO event_photos (id,room_id,owner_id,photo_key,visibility,revision,created_at,updated_at,deleted_at) VALUES (?,?,?,?,?,?,?,?,?)');
      put.run(old.shared, room.id, a.user.id, 'events/old/shared.jpg', 'members', 3, '2026-09-29T09:00:00.000Z', '2026-09-29T09:05:00.000Z', null);
      put.run(old.hidden, room.id, b.user.id, 'events/old/hidden.jpg', 'private', 1, '2026-09-29T09:10:00.000Z', '2026-09-29T09:10:00.000Z', null);
      put.run(old.removed, room.id, a.user.id, null, 'private', 5, '2026-09-29T09:20:00.000Z', '2026-09-29T09:25:00.000Z', '2026-09-29T09:25:00.000Z');
      before = raw.prepare('SELECT * FROM event_photos ORDER BY id').all().map(plain);
      assert.equal(before.length, 3);
      // Node applies 0013 itself on the next start (once, through its ledger); D1 is migrated by applying the file, as `wrangler d1 migrations apply` does.
      if (mode === 'Worker') raw.exec(d0013);
    });
    // Rows intact: every old value unchanged, the four new columns null, no orphan, structure sound.
    const after = f.sql.prepare('SELECT * FROM event_photos ORDER BY id').all().map(plain);
    assert.deepEqual(after, before.map(row => ({ ...row, taken_at: null, taken_source: null, viewpoint: null, viewpoint_source: null })));
    assert.deepEqual(f.sql.prepare('PRAGMA foreign_key_check').all(), []); assert.equal(f.sql.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    // The new code reads old photos as facts-less, and new uploads carry facts next to them.
    const shared = (await f.roomPhotos(room, b)).find(photo => photo.id === old.shared); assert.deepEqual(factsOf(shared), NONE); assert.equal(shared.revision, 3);
    assert.deepEqual((await f.roomPhotos(room, b)).map(photo => photo.id), [old.shared, old.hidden]); // b: the host's shared photo and b's own private one
    assert.deepEqual((await f.roomPhotos(room, a)).map(photo => photo.id), [old.shared]); // a: own shared photo; b's private and the withdrawn one stay out of sight
    assert.deepEqual((await f.ownPhotos(b)).map(photo => photo.id), [old.hidden]); assert.deepEqual(factsOf((await f.ownPhotos(b))[0]), NONE);
    const fresh = await f.upload(room, a, 'members', FACTS);
    const library = await f.ownPhotos(a); assert.deepEqual(library.map(photo => photo.id).sort(), [old.shared, fresh.id].sort());
    assert.deepEqual(factsOf(library.find(photo => photo.id === fresh.id)), FACTS); assert.deepEqual(factsOf(library.find(photo => photo.id === old.shared)), NONE);
    assert.deepEqual((await f.recap(room, a)).map(photo => [photo.id, photo.takenAt]).sort(), [[old.shared, null], [fresh.id, FACTS.takenAt]].sort());
    assert.deepEqual((await f.recap(room, b)).map(photo => photo.id).sort(), [old.shared, old.hidden, fresh.id].sort());
    // An old photo can still be shared and withdrawn: the update paths never needed the new columns.
    const withdrawn = ok(await f.setVisibility(shared, a, 'private')).photo; assert.deepEqual(factsOf(withdrawn), NONE); assert.equal(withdrawn.revision, 4);
    // Starting again does not re-run the migration (Node ledger) and keeps everything.
    await f.restart();
    assert.deepEqual(f.sql.prepare("SELECT name FROM pragma_table_info('event_photos') WHERE name LIKE 'taken%' OR name LIKE 'viewpoint%' ORDER BY cid").all().map(row => row.name), COLUMNS);
    assert.equal(f.rows(), 4);
    assert.deepEqual(factsOf((await f.roomPhotos(room, b)).find(photo => photo.id === fresh.id)), FACTS);
    if (mode === 'Node') assert.equal(f.sql.prepare("SELECT COUNT(*) AS n FROM _node_event_migrations WHERE name = '0013_event_photo_moment.sql'").get().n, 1);
  });
}

test('D1 order: applying 0013 to a populated 0012 database keeps every row, adds only nullable columns and enforces the CHECKs on the old table', async t => {
  const directory = new URL('../runtime-preview/drizzle/', import.meta.url);
  const names = (await readdir(directory)).filter(name => name.endsWith('.sql')).sort(), last = names.indexOf('0013_event_photo_moment.sql');
  assert.ok(last > 0, 'migration 0013 is part of the shared drizzle directory');
  const db = new DatabaseSync(':memory:'); t.after(() => db.close()); db.exec('PRAGMA foreign_keys = ON');
  for (const name of names.slice(0, last)) db.exec(await readFile(new URL(name, directory), 'utf8')); // exactly what D1 holds at 0012
  db.prepare('INSERT INTO avatar_users (id,name,avatar,token_hash,revision,created_at) VALUES (?,?,?,?,?,?)').run('old-user', 'Existing', '{}', 'opaque', 7, 'old-date');
  db.prepare('INSERT INTO event_rooms (id,code,host_id,title,venue,song_id,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?)').run('old-room', 'OLDROOM', 'old-user', 'Existing show', '', 'late-train', 'old-date', 'later');
  const put = db.prepare('INSERT INTO event_photos (id,room_id,owner_id,photo_key,visibility,revision,created_at,updated_at,deleted_at) VALUES (?,?,?,?,?,?,?,?,?)');
  put.run('old-kept', 'old-room', 'old-user', 'old-key', 'members', 4, 'old-date', 'old-date', null); put.run('old-removed', 'old-room', 'old-user', null, 'private', 2, 'old-date', 'old-date', 'old-date');
  const before = db.prepare('SELECT * FROM event_photos ORDER BY id').all().map(plain), tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all().map(row => row.name);
  db.exec(await readFile(new URL(names[last], directory), 'utf8'));
  assert.deepEqual(db.prepare('SELECT * FROM event_photos ORDER BY id').all().map(plain), before.map(row => ({ ...row, taken_at: null, taken_source: null, viewpoint: null, viewpoint_source: null })));
  assert.deepEqual(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all().map(row => row.name), tables, '0013 adds no table');
  assert.deepEqual(db.prepare("SELECT name,type,\"notnull\" AS required,dflt_value FROM pragma_table_info('event_photos') WHERE cid >= 9").all().map(plain),
    [['taken_at', 'INTEGER'], ['taken_source', 'TEXT'], ['viewpoint', 'TEXT'], ['viewpoint_source', 'TEXT']].map(([name, type]) => ({ name, type, required: 0, dflt_value: null })));
  assert.throws(() => db.prepare('UPDATE event_photos SET taken_at = ? WHERE id = ?').run(FACTS.takenAt, 'old-kept'), /CHECK constraint failed/); // a time needs its source, even on an old row
  db.prepare('UPDATE event_photos SET taken_at = ?, taken_source = ?, viewpoint = ?, viewpoint_source = ? WHERE id = ?').run(FACTS.takenAt, 'exif', 'crowd', 'ai', 'old-kept');
  assert.deepEqual(plain(db.prepare('SELECT taken_at,taken_source,viewpoint,viewpoint_source FROM event_photos WHERE id = ?').get('old-kept')), { taken_at: FACTS.takenAt, taken_source: 'exif', viewpoint: 'crowd', viewpoint_source: 'ai' });
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []); assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
});

test('schema files agree: journal, snapshot chain and drizzle schema all carry 0013 the way the SQL defines it', async () => {
  const meta = new URL('../runtime-preview/drizzle/meta/', import.meta.url), journal = JSON.parse(await readFile(new URL('_journal.json', meta), 'utf8'));
  assert.deepEqual(journal.entries.find(item => item.tag === '0013_event_photo_moment'), { tag: '0013_event_photo_moment', version: '6', idx: 13, when: 1790966400005, breakpoints: true });
  assert.deepEqual(journal.entries.map(item => item.idx), journal.entries.map((_, index) => index)); // gapless, so a new migration appends rather than edits
  assert.ok(journal.entries.every((item, index) => !index || item.when > journal.entries[index - 1].when), 'journal timestamps strictly increase');
  const [previous, snapshot] = await Promise.all(['0012', '0013'].map(async number => JSON.parse(await readFile(new URL(`${number}_snapshot.json`, meta), 'utf8'))));
  assert.equal(snapshot.prevId, previous.id); assert.notEqual(snapshot.id, previous.id); assert.equal(snapshot.version, previous.version); assert.equal(snapshot.dialect, 'sqlite');
  assert.deepEqual(Object.keys(snapshot.tables), Object.keys(previous.tables)); // 0013 adds no table
  for (const name of Object.keys(previous.tables)) if (name !== 'event_photos') assert.deepEqual(snapshot.tables[name], previous.tables[name], name);
  const photos = snapshot.tables.event_photos, was = previous.tables.event_photos;
  assert.deepEqual(Object.keys(photos.columns), [...Object.keys(was.columns), ...COLUMNS]);
  for (const [name, type] of [['taken_at', 'integer'], ['taken_source', 'text'], ['viewpoint', 'text'], ['viewpoint_source', 'text']]) assert.deepEqual(photos.columns[name], { name, type, primaryKey: false, notNull: false, autoincrement: false });
  for (const name of Object.keys(was.columns)) assert.deepEqual(photos.columns[name], was.columns[name], name);
  assert.deepEqual(photos.indexes.event_photo_moment, { name: 'event_photo_moment', columns: ['room_id', 'taken_at'], isUnique: false, where: '"event_photos"."taken_at" IS NOT NULL AND "event_photos"."deleted_at" IS NULL' });
  assert.deepEqual(Object.keys(photos.checkConstraints).slice(Object.keys(was.checkConstraints).length), ['event_photo_taken_at', 'event_photo_taken_source', 'event_photo_viewpoint', 'event_photo_viewpoint_source']);
  for (const name of Object.keys(was.checkConstraints)) assert.deepEqual(photos.checkConstraints[name], was.checkConstraints[name], name);
  const schema = await readFile(new URL('../runtime-preview/db/schema.ts', import.meta.url), 'utf8'), block = schema.slice(schema.indexOf("export const eventPhotos"), schema.indexOf('export const eventIdempotency'));
  for (const needle of ["takenAt: integer('taken_at')", "takenSource: text('taken_source')", "viewpoint: text('viewpoint')", "viewpointSource: text('viewpoint_source')", "check('event_photo_taken_at'", "check('event_photo_taken_source'", "check('event_photo_viewpoint'", "check('event_photo_viewpoint_source'", "index('event_photo_moment').on(table.roomId, table.takenAt).where("]) assert.ok(block.includes(needle), needle);
  // The SQL file and the schema describe the same four constraints: the literal bounds and enums must match.
  const sql = await readFile(new URL('../runtime-preview/drizzle/0013_event_photo_moment.sql', import.meta.url), 'utf8');
  for (const literal of ['946684800000', '32503680000000', "('exif', 'manual')", "('stage', 'crowd', 'friends', 'detail')", "('ai', 'manual')"]) { assert.ok(sql.includes(literal), 'sql: ' + literal); assert.ok(block.includes(literal), 'schema: ' + literal); }
});
