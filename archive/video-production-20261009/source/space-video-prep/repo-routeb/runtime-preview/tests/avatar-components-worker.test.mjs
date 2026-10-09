import { removeTempAfterTests } from '../../tests/helpers/temp-directory.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { randomUUID, createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createAvatarApi } from './d1-adapter.mjs';
import { DEFAULT_AVATAR } from '../src/avatar-worker.js';

// Synthetic fixtures only. Keep this contract identical for Node and Worker/D1.
const legacy = { skin: 1, hair: 2, hairColor: 3, outfit: 3, accessory: 'glasses', pose: 'listen' };
const modular = {
  version: 2, skin: 4, hair: 7, hairColor: 2, outfit: 3, accessory: 'crossbody', pose: 'wave',
  top: 1, bottom: 5, shoes: 3, eyewear: 4, topColor: 7, bottomColor: 4, shoeColor: 6, expression: 'wink',
};
const legacyExpected = {
  version: 2, skin: 1, hair: 4, hairColor: 3, outfit: 3, accessory: 'none', pose: 'listen',
  top: 3, bottom: 3, shoes: 2, eyewear: 1, topColor: 4, bottomColor: 0, shoeColor: 1, expression: 'neutral',
};
const baseComposition = { title: 'Synthetic component test', caption: '', scene: { kind: 'builtin', id: 'rooftop-night' }, songId: 'late-train' };

async function fixture(t, dataDir) {
  const ownDirectory = !dataDir;
  dataDir ||= await mkdtemp(join(tmpdir(), 'music-space-components-'));
  const api = createAvatarApi({ dataDir, rateLimits: false });
  const server = createServer(async (req, res) => { if (!(await api(req, res))) { res.writeHead(404); res.end(); } });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api/avatar`;
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    api.close();
  };
  t.after(async () => { await close(); if (ownDirectory) await removeTempAfterTests(dataDir); });
  async function call(path, { method = 'GET', token, data, key = randomUUID() } = {}) {
    const result = await fetch(base + path, {
      method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(method === 'GET' ? {} : { 'Idempotency-Key': key }) },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
    return { status: result.status, headers: result.headers, body: await result.json() };
  }
  async function session(avatar = modular) {
    const result = await call('/session', { method: 'POST', data: { name: 'Synthetic fixture', avatar } });
    assert.equal(result.status, 201, JSON.stringify(result.body));
    return result.body;
  }
  async function create(host, avatar) {
    const result = await call('/compositions', { method: 'POST', token: host.token, data: { ...baseComposition, ...(avatar ? { avatar } : {}) } });
    assert.equal(result.status, 201);
    return result.body.composition;
  }
  async function invited(host, room) {
    const result = await call(`/compositions/${room.id}/invite`, { method: 'POST', token: host.token, data: { revision: room.revision } });
    assert.equal(result.status, 200);
    return result.body;
  }
  async function joined() {
    const host = await session(), guestAvatar = { ...modular, hair: 5, top: 4, bottom: 0, eyewear: 5, accessory: 'cap', expression: 'smile' };
    const guest = await session(guestAvatar), invite = await invited(host, await create(host));
    const result = await call(`/invites/${invite.inviteToken}/join`, { method: 'POST', token: guest.token,
      data: { revision: invite.composition.revision, consent: true } });
    assert.equal(result.status, 200);
    return { host, guest, guestAvatar, invite, room: result.body.composition };
  }
  async function consented(pair) {
    let result = await call(`/compositions/${pair.room.id}/decision`, { method: 'POST', token: pair.host.token,
      data: { revision: pair.room.revision, accept: true } });
    assert.equal(result.status, 200);
    for (const person of [pair.host, pair.guest]) {
      result = await call(`/compositions/${pair.room.id}/consent`, { method: 'POST', token: person.token,
        data: { revision: result.body.composition.revision, consent: true } });
      assert.equal(result.status, 200);
    }
    return result.body.composition;
  }
  return { call, session, create, invited, joined, consented, close, dataDir };
}

test('Worker/D1: all legacy outfit seeds normalize without losing explicit components', async t => {
  const f = await fixture(t);
  const shoes = [1, 0, 2, 2, 3, 0], topColor = [0, 2, 3, 4, 6, 2];
  const bottomColor = [1, 1, 0, 0, 1, 3], shoeColor = [0, 0, 1, 1, 0, 0], eyewear = [1, 1, 2, 1, 3, 2];
  for (let outfit = 0; outfit < 6; outfit++) {
    const result = await f.session({ ...legacy, outfit });
    assert.deepEqual(result.user.avatar, { ...legacyExpected, outfit, hair: outfit === 3 ? 4 : 2,
      top: outfit, bottom: outfit, shoes: shoes[outfit], eyewear: eyewear[outfit],
      topColor: topColor[outfit], bottomColor: bottomColor[outfit], shoeColor: shoeColor[outfit] });
  }
  const overrides = { top: 0, bottom: 4, shoes: 0, eyewear: 0, topColor: 0, bottomColor: 7, shoeColor: 5, expression: 'focused' };
  assert.deepEqual((await f.session({ ...legacy, ...overrides })).user.avatar, { ...legacyExpected, ...overrides });
  const versioned = (await f.session({ ...legacy, version: 2 })).user.avatar;
  assert.equal(versioned.hair, 2, 'v2 hair geometry is never inferred from outfit');
  assert.equal(versioned.eyewear, 1);
  assert.equal(versioned.accessory, 'none');
  for (const hair of [0, 1, 3]) assert.equal((await f.session({ ...legacy, hair })).user.avatar.hair, hair);
  assert.deepEqual((await f.session(DEFAULT_AVATAR)).user.avatar, DEFAULT_AVATAR);
});

test('Worker/D1: every new component value round-trips independently of outfit', async t => {
  const f = await fixture(t);
  const ranges = { skin: 4, hair: 7, hairColor: 3, outfit: 5, top: 5, bottom: 5, shoes: 3, eyewear: 5, topColor: 7, bottomColor: 7, shoeColor: 7 };
  for (const [field, maximum] of Object.entries(ranges)) {
    for (let value = 0; value <= maximum; value++) {
      const expected = { ...modular, [field]: value };
      assert.deepEqual((await f.session(expected)).user.avatar, expected, `${field}:${value}`);
    }
  }
  for (const accessory of ['none', 'headphones', 'earbuds', 'chain', 'crossbody', 'cap']) {
    const expected = { ...modular, accessory };
    assert.deepEqual((await f.session(expected)).user.avatar, expected);
  }
  for (const expression of ['neutral', 'smile', 'wink', 'focused']) {
    const expected = { ...modular, expression };
    assert.deepEqual((await f.session(expected)).user.avatar, expected);
  }
});

test('Worker/D1: a full appearance payload changes one part and leaves stored compositions independent', async t => {
  const f = await fixture(t), host = await f.session(), room = await f.create(host);
  const changed = { ...host.user.avatar, shoes: 0 };
  const result = await f.call('/profile', { method: 'PUT', token: host.token, data: { revision: host.user.revision, avatar: changed } });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.user.avatar, changed);
  const restored = (await f.call('/session', { token: host.token })).body;
  assert.equal(restored.user.id, host.user.id);
  assert.deepEqual(restored.user.avatar, changed);
  assert.deepEqual(restored.compositions[0].host.avatar, modular);
  const invitation = await f.invited(host, room);
  const preview = await f.call(`/invites/${invitation.inviteToken}`);
  assert.deepEqual(preview.body.preview.host.avatar, modular);
  assert.equal(preview.body.preview.guest, undefined);
  assert.equal(preview.body.preview.consents, undefined);
  const next = await f.create(host);
  assert.deepEqual(next.host.avatar, changed);
  const db = new DatabaseSync(join(f.dataDir, 'avatar-space.sqlite'));
  assert.deepEqual(JSON.parse(db.prepare('SELECT avatar FROM avatar_users WHERE id = ?').get(host.user.id).avatar), changed);
  db.close();
});

test('Worker/D1: modular snapshots preserve invite privacy and two-person export approval', async t => {
  const f = await fixture(t), pair = await f.joined(), stranger = await f.session();
  assert.deepEqual(pair.room.host.avatar, modular);
  assert.deepEqual(pair.room.guest.avatar, pair.guestAvatar);
  let room = await f.consented(pair);
  assert.equal(room.exportEligible, true);
  assert.equal((await f.call(`/compositions/${room.id}`, { token: stranger.token })).status, 404);
  assert.equal((await f.call(`/compositions/${room.id}/export`, { token: pair.invite.inviteToken })).status, 401);
  const exported = await f.call(`/compositions/${room.id}/export`, { token: pair.guest.token });
  assert.equal(exported.status, 200);
  assert.deepEqual(exported.body.composition.host.avatar, modular);
  assert.deepEqual(exported.body.composition.guest.avatar, pair.guestAvatar);
  assert.equal(exported.body.authorizedContentRevision, room.contentRevision);
  const invalid = await f.call(`/compositions/${room.id}`, { method: 'PATCH', token: pair.host.token,
    data: { revision: room.revision, avatar: { ...modular, eyewear: 6 } } });
  assert.equal(invalid.status, 400);
  const unchanged = (await f.call(`/compositions/${room.id}`, { token: pair.host.token })).body.composition;
  assert.equal(unchanged.revision, room.revision);
  assert.deepEqual(unchanged.consents, { host: true, guest: true });
  const changed = { ...pair.guestAvatar, topColor: 2 };
  const edit = await f.call(`/compositions/${room.id}`, { method: 'PATCH', token: pair.guest.token,
    data: { revision: room.revision, avatar: changed } });
  assert.equal(edit.status, 200);
  room = edit.body.composition;
  assert.deepEqual(room.guest.avatar, changed);
  assert.deepEqual(room.host.avatar, modular);
  assert.deepEqual(room.consents, { host: false, guest: false });
  assert.equal(room.status, 'pending');
  assert.equal(room.exportEligible, false);
  assert.equal((await f.call(`/compositions/${room.id}/export`, { token: pair.host.token })).status, 409);
  assert.deepEqual((await f.call('/session', { token: pair.guest.token })).body.user.avatar, pair.guestAvatar);
});

test('Worker/D1: old stored profiles and accepted snapshots normalize on read without rewriting identity or consent', async t => {
  if (process.env.SPACE_TEST_ENGINE === 'sqljs') return t.skip('engine-specific: edits the database file while the worker holds it open, sql.js keeps its own in-memory copy');
  const f = await fixture(t), pair = await f.joined();
  const accepted = await f.consented(pair);
  const db = new DatabaseSync(join(f.dataDir, 'avatar-space.sqlite'));
  t.after(() => db.close());
  db.prepare('UPDATE avatar_users SET avatar = ? WHERE id = ?').run(JSON.stringify(legacy), pair.host.user.id);
  const oldRoom = db.prepare('SELECT * FROM avatar_compositions WHERE id = ?').get(accepted.id);
  const snapshot = JSON.parse(oldRoom.snapshot);
  snapshot.host.avatar = legacy;
  snapshot.guest.avatar = { ...legacy, outfit: 4, hair: 1 };
  db.prepare('UPDATE avatar_compositions SET snapshot = ? WHERE id = ?').run(JSON.stringify(snapshot), accepted.id);
  const storedUser = db.prepare('SELECT * FROM avatar_users WHERE id = ?').get(pair.host.user.id);
  const storedRoom = db.prepare('SELECT * FROM avatar_compositions WHERE id = ?').get(accepted.id);
  await f.close();
  const restarted = await fixture(t, f.dataDir);
  const session = await restarted.call('/session', { token: pair.host.token });
  assert.equal(session.status, 200);
  assert.equal(session.body.user.id, pair.host.user.id);
  assert.equal(session.body.user.revision, pair.host.user.revision);
  assert.deepEqual(session.body.user.avatar, legacyExpected);
  const room = (await restarted.call(`/compositions/${accepted.id}`, { token: pair.host.token })).body.composition;
  assert.deepEqual(room.host.avatar, legacyExpected);
  assert.deepEqual(room.guest.avatar, { ...legacyExpected, hair: 1, outfit: 4, top: 4, bottom: 4, shoes: 3, eyewear: 3, topColor: 6, bottomColor: 1, shoeColor: 0 });
  assert.equal(room.revision, accepted.revision);
  assert.equal(room.contentRevision, accepted.contentRevision);
  assert.deepEqual(room.consents, { host: true, guest: true });
  assert.equal(room.exportEligible, true);
  const preview = await restarted.call(`/invites/${pair.invite.inviteToken}`);
  assert.equal(preview.status, 200);
  assert.deepEqual(preview.body.preview.host.avatar, legacyExpected);
  assert.equal(preview.body.preview.guest, undefined);
  const exported = await restarted.call(`/compositions/${accepted.id}/export`, { token: pair.guest.token });
  assert.equal(exported.status, 200);
  assert.deepEqual(exported.body.composition, { ...room, role: 'guest' });
  assert.deepEqual(db.prepare('SELECT * FROM avatar_users WHERE id = ?').get(pair.host.user.id), storedUser);
  assert.deepEqual(db.prepare('SELECT * FROM avatar_compositions WHERE id = ?').get(accepted.id), storedRoom);
});

test('Worker/D1: legacy cached retries return normalized avatars without replacing their capability or saved response', async t => {
  const f = await fixture(t), key = randomUUID(), data = { name: 'Legacy retry fixture', avatar: legacy };
  const original = await f.call('/session', { method: 'POST', data, key });
  assert.equal(original.status, 201);
  const db = new DatabaseSync(join(f.dataDir, 'avatar-space.sqlite'));
  t.after(() => db.close());
  const keyHash = createHash('sha256').update(key).digest('hex');
  const cached = db.prepare('SELECT response FROM avatar_idempotency WHERE actor_id = ? AND key_hash = ?').get('bootstrap', keyHash);
  const oldBody = JSON.parse(cached.response);
  oldBody.user.avatar = legacy;
  const oldResponse = JSON.stringify(oldBody);
  db.prepare('UPDATE avatar_idempotency SET response = ? WHERE actor_id = ? AND key_hash = ?').run(oldResponse, 'bootstrap', keyHash);
  const retried = await f.call('/session', { method: 'POST', data, key });
  assert.equal(retried.status, 201);
  assert.equal(retried.headers.get('idempotency-replayed'), 'true');
  assert.equal(retried.body.token, original.body.token);
  assert.equal(retried.body.user.id, original.body.user.id);
  assert.deepEqual(retried.body.user.avatar, legacyExpected);
  assert.equal(db.prepare('SELECT response FROM avatar_idempotency WHERE actor_id = ? AND key_hash = ?').get('bootstrap', keyHash).response, oldResponse);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM avatar_users').get().count, 1);
});

test('Worker/D1: malformed and non-finite components are rejected rather than silently reset', async t => {
  const f = await fixture(t);
  const invalid = [null, [], false, 'avatar', {}, { ...modular, unknownPart: 1 }, JSON.parse('{"__proto__":{},"version":2}')];
  const ranges = { skin: 4, hair: 7, hairColor: 3, outfit: 5, top: 5, bottom: 5, shoes: 3, eyewear: 5, topColor: 7, bottomColor: 7, shoeColor: 7 };
  for (const [field, maximum] of Object.entries(ranges)) {
    for (const value of [-1, maximum + 1, 0.5, '1', true, null, NaN, Infinity, -Infinity]) invalid.push({ ...modular, [field]: value });
  }
  for (const version of [0, 1, 3, 2.1, '2', null]) invalid.push({ ...modular, version });
  for (const field of ['skin', 'hair', 'hairColor', 'outfit', 'accessory', 'pose']) {
    const incomplete = { ...modular }; delete incomplete[field]; invalid.push(incomplete);
  }
  for (const expression of ['', 'angry', null, 1]) invalid.push({ ...modular, expression });
  for (const accessory of ['', 'glasses<script>', null, 1]) invalid.push({ ...modular, accessory });
  for (const pose of ['', 'dance', null, 1]) invalid.push({ ...modular, pose });
  invalid.push({ ...legacy, hair: 4 });
  for (const value of invalid) {
    const result = await f.call('/session', { method: 'POST', data: { name: 'Invalid fixture', avatar: value } });
    assert.equal(result.status, 400, JSON.stringify(value));
    assert.ok(['INVALID_AVATAR', 'INVALID_INPUT'].includes(result.body.error.code));
  }
  const db = new DatabaseSync(join(f.dataDir, 'avatar-space.sqlite'));
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM avatar_users').get().count, 0);
  db.close();
});
