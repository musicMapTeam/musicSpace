import { removeTempAfterTests } from '../../tests/helpers/temp-directory.js';
// Contract tests use node:sqlite through an asynchronous D1 fake and private R2 fake.
// These verify application semantics, not a deployed Cloudflare/Sites runtime.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import { once } from 'node:events';
import { randomUUID, createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createAvatarApi } from './d1-adapter.mjs';
import { DEFAULT_AVATAR, sanitizeAvatarJpeg, createAvatarWorker } from '../src/avatar-worker.js';
import { createFakeEnv } from './d1-adapter.mjs';

// 2×2 solid JPEG generated for this test, no user photograph.
const JPEG_FIXTURE = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAACAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDx6iiitzM//9k=';
const imageUrl = bytes => `data:image/jpeg;base64,${Buffer.from(bytes).toString('base64')}`;
const photoScene = () => ({ kind: 'photo', dataUrl: `data:image/jpeg;base64,${JPEG_FIXTURE}` });
const baseComposition = () => ({ title: '同一片晚风', caption: '来屋顶听一首歌', scene: { kind: 'builtin', id: 'rooftop-night' }, songId: 'late-train', transform: { x: 32, y: 65, scale: 1, rotation: -5 } });

async function fixture(t, settings = {}) {
  let time = Date.parse('2026-09-30T06:00:00Z');
  const dataDir = settings.dataDir || await mkdtemp(join(tmpdir(), 'music-space-avatar-test-'));
  const api = createAvatarApi({ dataDir, clock: () => time, rateLimits: false, ...settings });
  const server = createServer(async (req, res) => { if (!(await api(req, res))) { res.writeHead(404); res.end(); } });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  let closed = false;
  async function close() {
    if (closed) return;
    closed = true;
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    api.close();
  }
  t.after(async () => { await close(); if (!settings.dataDir) await removeTempAfterTests(dataDir); });
  async function request(path, { method = 'GET', token, data, key = randomUUID(), headers = {} } = {}) {
    const result = await fetch(base + (path.startsWith('/api/') ? path : '/api/avatar' + path), {
      method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(data === undefined ? {} : { 'Content-Type': 'application/json' }), ...(method === 'GET' || key === null ? {} : { 'Idempotency-Key': key }), ...headers },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
    return { status: result.status, headers: result.headers, body: result.headers.get('content-type')?.startsWith('image/') ? Buffer.from(await result.arrayBuffer()) : await result.json() };
  }
  async function session(name = '听众', value = DEFAULT_AVATAR) {
    const result = await request('/session', { method: 'POST', data: { name, avatar: value } });
    assert.equal(result.status, 201);
    return result.body;
  }
  async function create(host, overrides = {}) {
    const result = await request('/compositions', { method: 'POST', token: host.token, data: { ...baseComposition(), ...overrides } });
    assert.equal(result.status, 201);
    return result.body.composition;
  }
  async function invite(host, room) {
    const result = await request(`/compositions/${room.id}/invite`, { method: 'POST', token: host.token, data: { revision: room.revision } });
    assert.equal(result.status, 200);
    return result.body;
  }
  async function joined(overrides = {}) {
    const host = await session('主人'), guest = await session('朋友', { ...DEFAULT_AVATAR, skin: 3, outfit: 2 });
    let room = await create(host, overrides);
    const invitation = await invite(host, room);
    const result = await request(`/invites/${invitation.inviteToken}/join`, { method: 'POST', token: guest.token, data: { revision: invitation.composition.revision, response: '我带来另一阵风', transform: { x: 68, y: 65, scale: 0.9, rotation: 5 }, consent: true } });
    assert.equal(result.status, 200);
    room = result.body.composition;
    return { host, guest, room, invitation };
  }
  async function acceptedAndConsented(pair) {
    let result = await request(`/compositions/${pair.room.id}/decision`, { method: 'POST', token: pair.host.token, data: { revision: pair.room.revision, accept: true } });
    assert.equal(result.status, 200);
    for (const person of [pair.host, pair.guest]) {
      result = await request(`/compositions/${pair.room.id}/consent`, { method: 'POST', token: person.token, data: { revision: result.body.composition.revision, consent: true } });
      assert.equal(result.status, 200);
    }
    return result.body.composition;
  }
  return { base, request, session, create, invite, joined, acceptedAndConsented, dataDir, close, advance: ms => { time += ms; } };
}

test('identity is a private bearer capability, with recoverability boundary and idempotent bootstrap', async t => {
  const f = await fixture(t), key = randomUUID();
  const first = await f.request('/session', { method: 'POST', data: { name: 'Lin' }, key });
  const second = await f.request('/session', { method: 'POST', data: { name: 'Lin' }, key });
  assert.equal(first.status, 201);
  assert.deepEqual(second.body, first.body);
  assert.equal(second.headers.get('idempotency-replayed'), 'true');
  assert.match(first.body.token, /^[A-Za-z0-9_-]{43}$/);
  assert.match(first.body.recoveryNotice, /无法找回/);
  const different = await f.session('Lin');
  assert.notEqual(different.user.id, first.body.user.id);
  assert.equal((await f.request('/session')).status, 401);
  assert.equal((await f.request(`/session?token=${first.body.token}`)).status, 401);
  assert.equal((await f.request('/session', { token: 'A'.repeat(43) })).body.error.code, 'SESSION_INVALID');
  const restored = await f.request('/session', { token: first.body.token });
  assert.equal(restored.body.user.id, first.body.user.id);
  assert.equal(restored.body.token, undefined);
  const db = new DatabaseSync(join(f.dataDir, 'avatar-space.sqlite'));
  const stored = db.prepare('SELECT token_hash FROM avatar_users WHERE id = ?').get(first.body.user.id);
  assert.equal(stored.token_hash, createHash('sha256').update(first.body.token).digest('hex'));
  assert.ok(!db.prepare('SELECT response FROM avatar_idempotency').all().some(row => row.response.includes(first.body.token)));
  db.close();
});

test('profile survives reload but composition avatar snapshots are independent', async t => {
  const f = await fixture(t), host = await f.session('Lin'), room = await f.create(host);
  const updated = await f.request('/profile', { method: 'PUT', token: host.token, data: { revision: host.user.revision, name: '新昵称', avatar: { ...DEFAULT_AVATAR, hair: 3, pose: 'wave' } } });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.user.revision, 2);
  assert.equal((await f.request('/session', { token: host.token })).body.user.name, '新昵称');
  const savedRoom = (await f.request(`/compositions/${room.id}`, { token: host.token })).body.composition;
  assert.equal(savedRoom.host.name, 'Lin');
  assert.deepEqual(savedRoom.host.avatar, DEFAULT_AVATAR);
  assert.equal((await f.request('/profile', { method: 'PUT', token: host.token, data: { revision: 1, name: '过期' } })).body.error.code, 'REVISION_CONFLICT');
});

test('library, photo, and composition state cannot be read by another identity or invite bearer', async t => {
  const f = await fixture(t), host = await f.session('主人'), stranger = await f.session('路人');
  const photo = await f.create(host, { scene: photoScene() });
  await f.create(host, { title: '绝不出现在邀请里的作品' });
  const invitation = await f.invite(host, photo);
  assert.equal((await f.request(`/compositions/${photo.id}`, { token: stranger.token })).status, 404);
  assert.equal((await f.request(photo.scene.photoUrl, { token: stranger.token })).status, 404);
  assert.equal((await f.request(photo.scene.photoUrl)).status, 401);
  assert.equal((await f.request(`/compositions/${photo.id}`, { token: invitation.inviteToken })).status, 401);
  const preview = await f.request(`/invites/${invitation.inviteToken}`);
  assert.equal(preview.status, 200);
  assert.equal(preview.body.preview.host.id, host.user.id);
  assert.equal(preview.body.preview.guest, undefined);
  assert.equal(preview.body.preview.consents, undefined);
  assert.equal(preview.body.compositions, undefined);
  assert.ok(!JSON.stringify(preview.body).includes('绝不出现在邀请'));
  assert.equal((await f.request(preview.body.preview.scene.photoUrl)).status, 200);
  assert.deepEqual((await f.request('/session', { token: stranger.token })).body.compositions, []);
});

test('guest needs their own distinct identity, explicit placement consent, and current revision', async t => {
  const f = await fixture(t), host = await f.session(), guest = await f.session();
  const invitation = await f.invite(host, await f.create(host));
  const path = `/invites/${invitation.inviteToken}/join`, data = { revision: invitation.composition.revision, consent: true };
  assert.equal((await f.request(path, { method: 'POST', data })).status, 401);
  assert.equal((await f.request(path, { method: 'POST', token: host.token, data })).body.error.code, 'DISTINCT_IDENTITY_REQUIRED');
  assert.equal((await f.request(path, { method: 'POST', token: guest.token, data: { ...data, consent: false } })).body.error.code, 'JOIN_CONSENT_REQUIRED');
  assert.equal((await f.request(path, { method: 'POST', token: guest.token, data: { ...data, revision: 1 } })).body.error.code, 'REVISION_CONFLICT');
  assert.equal((await f.request(path, { method: 'POST', token: guest.token, data: { ...data, ownerId: host.user.id } })).status, 400);
  const join = await f.request(path, { method: 'POST', token: guest.token, data });
  assert.equal(join.status, 200);
  assert.equal(join.body.composition.guest.id, guest.user.id);
  assert.equal(join.body.composition.status, 'pending');
  assert.equal(join.body.composition.exportEligible, false);
  assert.deepEqual(join.body.composition.consents, { host: false, guest: false });
});

test('concurrent joins fill one guest slot and idempotent retries never add a second participant', async t => {
  const f = await fixture(t), host = await f.session(), g1 = await f.session(), g2 = await f.session();
  const invitation = await f.invite(host, await f.create(host)), path = `/invites/${invitation.inviteToken}/join`;
  const data = { revision: invitation.composition.revision, consent: true }, key = randomUUID();
  const responses = await Promise.all([f.request(path, { method: 'POST', token: g1.token, data, key }), f.request(path, { method: 'POST', token: g2.token, data })]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
  const winningIndex = responses.findIndex(r => r.status === 200);
  const room = responses[winningIndex].body.composition;
  assert.equal(room.guest.id, [g1, g2][winningIndex].user.id);
  if (winningIndex === 0) assert.deepEqual((await f.request(path, { method: 'POST', token: g1.token, data, key })).body, responses[0].body);
});

test('only host decides; invite viewer and guest cannot substitute host acceptance or sharing consent', async t => {
  const f = await fixture(t), p = await f.joined(), stranger = await f.session();
  const decision = `/compositions/${p.room.id}/decision`, consent = `/compositions/${p.room.id}/consent`;
  assert.equal((await f.request(decision, { method: 'POST', token: p.guest.token, data: { revision: p.room.revision, accept: true } })).status, 403);
  assert.equal((await f.request(decision, { method: 'POST', token: p.invitation.inviteToken, data: { revision: p.room.revision, accept: true } })).status, 401);
  assert.equal((await f.request(consent, { method: 'POST', token: stranger.token, data: { revision: p.room.revision, consent: true } })).status, 404);
  assert.equal((await f.request(consent, { method: 'POST', token: p.guest.token, data: { revision: p.room.revision, consent: true } })).body.error.code, 'ACCEPTANCE_REQUIRED');
  const accepted = await f.request(decision, { method: 'POST', token: p.host.token, data: { revision: p.room.revision, accept: true } });
  let room = accepted.body.composition;
  assert.equal(room.status, 'accepted');
  assert.deepEqual(room.consents, { host: false, guest: false });
  room = (await f.request(consent, { method: 'POST', token: p.guest.token, data: { revision: room.revision, consent: true } })).body.composition;
  assert.deepEqual(room.consents, { host: false, guest: true });
  assert.equal(room.exportEligible, false);
  assert.equal((await f.request(`/compositions/${room.id}/export`, { token: p.guest.token })).body.error.code, 'EXPORT_CONSENT_REQUIRED');
  assert.equal((await f.request(consent, { method: 'POST', token: p.guest.token, data: { revision: room.revision, consent: true, role: 'host' } })).status, 400);
  room = (await f.request(consent, { method: 'POST', token: p.host.token, data: { revision: room.revision, consent: true } })).body.composition;
  assert.equal(room.exportEligible, true);
  for (const person of [p.host, p.guest]) {
    const result = await f.request(`/compositions/${room.id}/export`, { token: person.token });
    assert.equal(result.status, 200);
    assert.equal(result.body.authorizedContentRevision, room.contentRevision);
  }
});

test('either participant can revoke sharing consent and every content edit invalidates both consents', async t => {
  const f = await fixture(t), p = await f.joined();
  let room = await f.acceptedAndConsented(p);
  room = (await f.request(`/compositions/${room.id}/consent`, { method: 'POST', token: p.guest.token, data: { revision: room.revision, consent: false } })).body.composition;
  assert.equal(room.exportEligible, false);
  assert.equal((await f.request(`/compositions/${room.id}/export`, { token: p.host.token })).status, 409);
  room = (await f.request(`/compositions/${room.id}`, { method: 'PATCH', token: p.guest.token, data: { revision: room.revision, response: '新的回应', avatar: { ...DEFAULT_AVATAR, pose: 'sing' }, transform: { x: 70, y: 55, scale: 1.2, rotation: 8 } } })).body.composition;
  assert.equal(room.status, 'pending');
  assert.deepEqual(room.consents, { host: false, guest: false });
  assert.equal(room.guest.avatar.pose, 'sing');
  assert.equal(room.host.avatar.pose, 'sway');
  const stale = await f.request(`/compositions/${room.id}/decision`, { method: 'POST', token: p.host.token, data: { revision: room.revision - 1, accept: true } });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.error.currentRevision, room.revision);
  room = await f.acceptedAndConsented({ ...p, room });
  const edited = await f.request(`/compositions/${room.id}`, { method: 'PATCH', token: p.host.token, data: { revision: room.revision, caption: '更改场景含义' } });
  assert.equal(edited.body.composition.exportEligible, false);
  assert.equal(edited.body.composition.status, 'pending');
  assert.deepEqual(edited.body.composition.consents, { host: false, guest: false });
});

test('guest cannot edit host, scene, song, or title; host cannot edit guest response or avatar', async t => {
  const f = await fixture(t), p = await f.joined();
  for (const patch of [{ title: '劫持' }, { scene: { kind: 'builtin', id: 'sakura-night' } }, { songId: 'sakura-echo' }, { host: { name: '假的' } }]) {
    const result = await f.request(`/compositions/${p.room.id}`, { method: 'PATCH', token: p.guest.token, data: { revision: p.room.revision, ...patch } });
    assert.equal(result.status, 400);
  }
  for (const patch of [{ response: '替对方回应' }, { guest: { avatar: DEFAULT_AVATAR } }]) {
    assert.equal((await f.request(`/compositions/${p.room.id}`, { method: 'PATCH', token: p.host.token, data: { revision: p.room.revision, ...patch } })).status, 400);
  }
});

test('reject clears consent and revokes invitation; guest withdrawal removes their state and read access', async t => {
  const f = await fixture(t), p = await f.joined({ scene: photoScene() });
  let room = await f.acceptedAndConsented(p);
  room = (await f.request(`/compositions/${room.id}/decision`, { method: 'POST', token: p.host.token, data: { revision: room.revision, accept: false } })).body.composition;
  assert.equal(room.status, 'rejected');
  assert.equal(room.exportEligible, false);
  assert.equal(room.inviteActive, false);
  assert.equal((await f.request(`/invites/${p.invitation.inviteToken}`)).status, 404);
  const withdrawn = await f.request(`/compositions/${room.id}/participation`, { method: 'DELETE', token: p.guest.token, data: { revision: room.revision } });
  assert.equal(withdrawn.status, 200);
  assert.equal(withdrawn.body.withdrawn, true);
  assert.equal((await f.request(`/compositions/${room.id}`, { token: p.guest.token })).status, 404);
  assert.equal((await f.request(room.scene.photoUrl, { token: p.guest.token })).status, 404);
  const current = (await f.request(`/compositions/${room.id}`, { token: p.host.token })).body.composition;
  assert.equal(current.guest, null);
  assert.equal(current.status, 'waiting');
  assert.deepEqual((await f.request('/session', { token: p.guest.token })).body.compositions, []);
});

test('invitation rotation, explicit revocation, and seven-day expiry immediately remove preview/photo/join access', async t => {
  const f = await fixture(t), host = await f.session(), guest = await f.session();
  const first = await f.invite(host, await f.create(host, { scene: photoScene() }));
  const second = await f.invite(host, first.composition);
  assert.notEqual(first.inviteToken, second.inviteToken);
  assert.equal((await f.request(`/invites/${first.inviteToken}`)).status, 404);
  assert.equal((await f.request(`/invites/${first.inviteToken}/photo`)).status, 404);
  let result = await f.request(`/compositions/${second.composition.id}/invite`, { method: 'DELETE', token: host.token, data: { revision: second.composition.revision } });
  assert.equal(result.status, 200);
  assert.equal((await f.request(`/invites/${second.inviteToken}`)).status, 404);
  assert.equal((await f.request(`/invites/${second.inviteToken}/join`, { method: 'POST', token: guest.token, data: { revision: result.body.composition.revision, consent: true } })).status, 404);
  const third = await f.invite(host, result.body.composition);
  f.advance(7 * 24 * 60 * 60 * 1000 + 1);
  assert.equal((await f.request(`/invites/${third.inviteToken}`)).status, 404);
  assert.equal((await f.request(`/invites/${third.inviteToken}/photo`)).status, 404);
  assert.equal((await f.request(`/compositions/${third.composition.id}`, { token: host.token })).body.composition.inviteActive, false);
  assert.equal((await f.request(third.composition.scene.photoUrl, { token: host.token })).status, 200);
});

test('mutation retries are stable and conflicting reuse is rejected without duplicate works or consent changes', async t => {
  const f = await fixture(t), host = await f.session(), key = randomUUID(), data = baseComposition();
  const first = await f.request('/compositions', { method: 'POST', token: host.token, data, key });
  const second = await f.request('/compositions', { method: 'POST', token: host.token, data, key });
  assert.deepEqual(second.body, first.body);
  assert.equal((await f.request('/session', { token: host.token })).body.compositions.length, 1);
  assert.equal((await f.request('/compositions', { method: 'POST', token: host.token, data: { ...data, title: '另一件' }, key })).body.error.code, 'IDEMPOTENCY_CONFLICT');
  assert.equal((await f.request('/compositions', { method: 'POST', token: host.token, data, key: null })).body.error.code, 'IDEMPOTENCY_KEY_REQUIRED');
  const inviteKey = randomUUID(), invitePath = `/compositions/${first.body.composition.id}/invite`, inviteData = { revision: first.body.composition.revision };
  const invite1 = await f.request(invitePath, { method: 'POST', token: host.token, data: inviteData, key: inviteKey });
  const invite2 = await f.request(invitePath, { method: 'POST', token: host.token, data: inviteData, key: inviteKey });
  assert.deepEqual(invite1.body, invite2.body);
  const db = new DatabaseSync(join(f.dataDir, 'avatar-space.sqlite'));
  assert.ok(!db.prepare('SELECT response FROM avatar_idempotency').all().some(row => row.response.includes(invite1.body.inviteToken)));
  db.close();
});

test('photo parser removes EXIF, GPS-like metadata and comments, bounds pixels, rejects fake JPEG and trailing bytes', async t => {
  if (process.env.SPACE_TEST_ENGINE === 'sqljs') return t.skip('engine-specific: sanitizeAvatarJpeg returns the shim Buffer there, and deepEqual against Node\'s Buffer compares prototypes');
  const bytes = Buffer.from(JPEG_FIXTURE, 'base64');
  const metadata = Buffer.from('Exif\0\0GPS-private-location');
  const marker = Buffer.alloc(4); marker[0] = 0xff; marker[1] = 0xe1; marker.writeUInt16BE(metadata.length + 2, 2);
  const comment = Buffer.from([0xff, 0xfe, 0x00, 0x06, 0x73, 0x65, 0x63, 0x72]);
  const tagged = Buffer.concat([bytes.subarray(0, 2), marker, metadata, comment, bytes.subarray(2)]);
  const clean = sanitizeAvatarJpeg(imageUrl(tagged));
  assert.ok(!clean.includes(Buffer.from('GPS-private')));
  assert.ok(!clean.includes(Buffer.from('Exif')));
  assert.ok(!clean.includes(Buffer.from('JFIF')));
  assert.ok(!clean.includes(Buffer.from('secr')));
  assert.equal(clean[0], 0xff);
  assert.equal(clean.at(-1), 0xd9);
  assert.throws(() => sanitizeAvatarJpeg(imageUrl(Buffer.from([0xff, 0xd8, 0xff, 0xd9]))), /JPEG/);
  assert.throws(() => sanitizeAvatarJpeg(imageUrl(Buffer.concat([bytes, Buffer.from('<script>')]))), /JPEG/);
  assert.throws(() => sanitizeAvatarJpeg('data:image/png;base64,' + JPEG_FIXTURE), /JPEG/);
  assert.throws(() => sanitizeAvatarJpeg(imageUrl(bytes.subarray(0, 100))), /JPEG/);
  const big = Buffer.from(bytes), sof = big.indexOf(Buffer.from([0xff, 0xc0]));
  big.writeUInt16BE(4000, sof + 5);
  assert.throws(() => sanitizeAvatarJpeg(imageUrl(big)), /JPEG/);
  const f = await fixture(t), host = await f.session();
  const room = await f.create(host, { scene: { kind: 'photo', dataUrl: imageUrl(tagged) } });
  const stored = await f.request(room.scene.photoUrl, { token: host.token });
  assert.deepEqual(stored.body, clean);
  assert.equal(stored.headers.get('cache-control'), 'private, no-store');
  const switched = await f.request(`/compositions/${room.id}`, { method: 'PATCH', token: host.token, data: { revision: room.revision, scene: { kind: 'builtin', id: 'fan-stage' } } });
  assert.equal(switched.status, 200);
  assert.equal((await f.request(room.scene.photoUrl, { token: host.token })).status, 404);
});

test('input bounds, HTTP body limits, non-JSON and cross-site requests fail clearly', async t => {
  const f = await fixture(t), host = await f.session();
  for (const overrides of [{ songId: 'copyrighted-track' }, { scene: { kind: 'builtin', id: '../private' } }, { transform: { x: -1, y: 50, scale: 1, rotation: 0 } }, { avatar: { ...DEFAULT_AVATAR, skin: 99 } }, { avatar: { ...DEFAULT_AVATAR, accessory: '<script>' } }, { caption: 'a'.repeat(161) }]) {
    assert.equal((await f.request('/compositions', { method: 'POST', token: host.token, data: { ...baseComposition(), ...overrides } })).status, 400);
  }
  assert.equal((await f.request('/session', { method: 'POST', data: { name: 'a'.repeat(9000) } })).status, 413);
  assert.equal((await f.request('/compositions', { method: 'POST', token: host.token, data: { ...baseComposition(), caption: 'a'.repeat(430 * 1024) } })).status, 413);
  assert.equal((await f.request('/session', { method: 'POST', data: { name: 'Lin' }, headers: { 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await f.request('/session', { token: host.token, headers: { 'Sec-Fetch-Site': 'cross-site' } })).body.error.code, 'ORIGIN_DENIED');
  assert.equal((await f.request('/session', { token: host.token, headers: { 'Sec-Fetch-Site': 'same-origin' } })).status, 200);
  assert.equal((await f.request('/session', { token: host.token, headers: { 'Sec-Fetch-Site': 'same-site' } })).status, 200);
  assert.equal((await f.request('/does-not-exist', { token: host.token })).status, 404);
  assert.equal((await f.request('/health')).body.storage, 'd1');
  assert.equal((await f.request('/health')).headers.get('referrer-policy'), 'no-referrer');
});

test('identities, avatar profile, invited composition, photo and idempotency persist across a fresh server', async t => {
  const dataDir = await mkdtemp(join(tmpdir(), 'music-space-avatar-persist-'));
  t.after(() => removeTempAfterTests(dataDir));
  const f = await fixture(t, { dataDir }), host = await f.session('持久身份');
  const room = await f.create(host, { scene: photoScene() });
  const key = randomUUID(), inviteData = { revision: room.revision }, path = `/compositions/${room.id}/invite`;
  const invitation = await f.request(path, { method: 'POST', token: host.token, data: inviteData, key });
  await f.close();
  const fresh = await fixture(t, { dataDir });
  const session = await fresh.request('/session', { token: host.token });
  assert.equal(session.status, 200);
  assert.equal(session.body.user.id, host.user.id);
  assert.equal(session.body.compositions[0].id, room.id);
  assert.equal((await fresh.request(room.scene.photoUrl, { token: host.token })).status, 200);
  assert.equal((await fresh.request(`/invites/${invitation.body.inviteToken}`)).status, 200);
  assert.deepEqual((await fresh.request(path, { method: 'POST', token: host.token, data: inviteData, key })).body, invitation.body);
});

test('rate limiting returns retry advice without creating more identities', async t => {
  const f = await fixture(t, { rateLimits: true });
  for (let index = 0; index < 30; index++) assert.equal((await f.request('/session', { method: 'POST', data: { name: `听众${index}` } })).status, 201);
  const result = await f.request('/session', { method: 'POST', data: { name: '太频繁' } });
  assert.equal(result.status, 429);
  assert.equal(result.body.error.code, 'RATE_LIMITED');
  assert.ok(Number(result.headers.get('retry-after')) > 0);
  f.advance(15 * 60 * 1000 + 1);
  assert.equal((await f.request('/session', { method: 'POST', data: { name: '稍后再试' } })).status, 201);
});

test('database failure yields recoverable service error without leaking SQL or paths', async t => {
  const api = createAvatarApi({ databasePath: ':memory:', rateLimits: false });
  const server = createServer(async (request, response) => { await api(request, response); });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  api.close();
  const result = await fetch(`http://127.0.0.1:${server.address().port}/api/avatar/session`, { headers: { Authorization: 'Bearer ' + 'A'.repeat(43) } });
  const body = await result.json();
  assert.equal(result.status, 503);
  assert.equal(body.error.code, 'SERVICE_UNAVAILABLE');
  assert.match(body.error.message, /保留当前草稿/);
  assert.ok(!JSON.stringify(body).includes('sqlite'));
});


test('streamed body over limit returns JSON 413 instead of a disconnected socket', async t => {
  const f = await fixture(t);
  const result = await new Promise((resolve, reject) => {
    const request = httpRequest(f.base + '/api/avatar/session', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID(), 'Transfer-Encoding': 'chunked' } }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) }));
      response.on('error', reject);
    });
    request.on('error', reject);
    request.write('{"name":"' + 'a'.repeat(8500));
    request.end('"}');
  });
  assert.equal(result.status, 413);
  assert.equal(result.body.error.code, 'BODY_TOO_LARGE');
});

async function directFixture(t) {
  const dataDir = await mkdtemp(join(tmpdir(), 'worker-atomic-')), env = createFakeEnv(join(dataDir, 'test.sqlite'));
  t.after(async () => { env.DB.close(); await removeTempAfterTests(dataDir); });
  const call = async (path, { token, data, method = 'GET', key = randomUUID() } = {}) => {
    // Every call gets a new Worker instance, proving no single-isolate room state.
    const worker = createAvatarWorker({ rateLimits: false });
    const result = await worker.fetch(new Request('https://musicspace.test/api/avatar' + path, { method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json', 'Idempotency-Key': key },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }) }), env);
    return { status: result.status, body: result.headers.get('Content-Type')?.includes('image/') ? new Uint8Array(await result.arrayBuffer()) : await result.json() };
  };
  return { env, call };
}

test('fresh Worker isolates racing for one D1 guest slot cannot both commit', async t => {
  const { call } = await directFixture(t);
  const [h, a, b] = await Promise.all(['H','A','B'].map(name => call('/session', { method: 'POST', data: { name } })));
  const room = (await call('/compositions', { method: 'POST', token: h.body.token, data: baseComposition() })).body.composition;
  const invite = (await call(`/compositions/${room.id}/invite`, { method: 'POST', token: h.body.token, data: { revision: room.revision } })).body;
  const results = await Promise.all([a,b].map(g => call(`/invites/${invite.inviteToken}/join`, { method: 'POST', token: g.body.token, data: { revision: invite.composition.revision, consent: true } })));
  assert.deepEqual(results.map(r => r.status).sort(), [200,409]);
  const winner = results.find(r => r.status === 200).body.composition;
  const current = (await call(`/compositions/${room.id}`, { token: h.body.token })).body.composition;
  assert.equal(current.guest.id, winner.guest.id);
  assert.equal(current.revision, invite.composition.revision + 1);
});

test('concurrent duplicate photo creation is one composition with one private object', async t => {
  const { call, env } = await directFixture(t), host = (await call('/session', { method: 'POST', data: { name: 'H' } })).body;
  const key = randomUUID(), data = { ...baseComposition(), scene: photoScene() };
  const results = await Promise.all([1,2].map(() => call('/compositions', { method: 'POST', token: host.token, data, key })));
  assert.deepEqual(results.map(r => r.status), [201,201]);
  assert.deepEqual(results[0].body, results[1].body);
  assert.equal(env.DB.sql.prepare('SELECT COUNT(*) AS n FROM avatar_compositions').get().n, 1);
  assert.equal(env.PHOTOS.blobs.size, 1);
  assert.equal((await call(`/compositions/${results[0].body.composition.id}/photo`, { token: host.token })).status, 200);
});

test('transport loss after commit recovers idempotently without deleting committed R2 photo', async t => {
  const { call, env } = await directFixture(t), host = (await call('/session', { method: 'POST', data: { name: 'H' } })).body;
  env.DB.failAfterCommit = true;
  const result = await call('/compositions', { method: 'POST', token: host.token, data: { ...baseComposition(), scene: photoScene() } });
  assert.equal(result.status, 201);
  assert.equal(env.PHOTOS.blobs.size, 1);
  assert.equal((await call(`/compositions/${result.body.composition.id}/photo`, { token: host.token })).status, 200);
  assert.equal(env.DB.sql.prepare('SELECT COUNT(*) AS n FROM avatar_mutation_guard').get().n, 0);
});

test('simultaneous scene edits clean only failed uploads and preserve the winning photo', async t => {
  const { call, env } = await directFixture(t), host = (await call('/session', { method: 'POST', data: { name: 'H' } })).body;
  const room = (await call('/compositions', { method: 'POST', token: host.token, data: { ...baseComposition(), scene: photoScene() } })).body.composition;
  const results = await Promise.all([1,2].map(n => call(`/compositions/${room.id}`, { method: 'PATCH', token: host.token, data: { revision: room.revision, caption: `edit ${n}`, scene: photoScene() } })));
  assert.deepEqual(results.map(r => r.status).sort(), [200,409]);
  assert.equal(env.PHOTOS.blobs.size, 1);
  assert.equal((await call(`/compositions/${room.id}/photo`, { token: host.token })).status, 200);
  const current = (await call(`/compositions/${room.id}`, { token: host.token })).body.composition;
  assert.equal(current.revision, room.revision + 1);
});

test('missing private upload binding fails clearly and never stores a partial room', async t => {
  const { call, env } = await directFixture(t), host = (await call('/session', { method: 'POST', data: { name: 'H' } })).body;
  delete env.PHOTOS;
  const result = await call('/compositions', { method: 'POST', token: host.token, data: { ...baseComposition(), scene: photoScene() } });
  assert.equal(result.status, 503);
  assert.equal(result.body.error.code, 'PHOTO_SERVICE_UNAVAILABLE');
  assert.equal(env.DB.sql.prepare('SELECT COUNT(*) AS n FROM avatar_compositions').get().n, 0);
});

test('assets fallback never receives unknown API requests or private photo keys', async t => {
  const { env } = await directFixture(t), worker = createAvatarWorker({ rateLimits: false });
  assert.equal((await worker.fetch(new Request('https://musicspace.test/'), env)).status, 200);
  assert.equal((await worker.fetch(new Request('https://musicspace.test/api/live/session'), env)).status, 404);
});

test('two real capabilities, host acceptance and two current-version consents gate export', async t => {
  const { call } = await directFixture(t);
  const host = (await call('/session', { method: 'POST', data: { name: '主人' } })).body;
  const guest = (await call('/session', { method: 'POST', data: { name: '朋友' } })).body;
  const stranger = (await call('/session', { method: 'POST', data: { name: '路人' } })).body;
  let room = (await call('/compositions', { method: 'POST', token: host.token, data: { ...baseComposition(), scene: photoScene() } })).body.composition;
  const invitation = (await call(`/compositions/${room.id}/invite`, { method: 'POST', token: host.token, data: { revision: room.revision } })).body;
  const preview = (await call(`/invites/${invitation.inviteToken}`)).body.preview;
  assert.equal(preview.guest, undefined);
  assert.equal((await call(`/compositions/${room.id}/photo`, { token: stranger.token })).status, 404);
  assert.equal((await call(`/compositions/${room.id}/decision`, { method: 'POST', token: invitation.inviteToken, data: { revision: invitation.composition.revision, accept: true } })).status, 401);
  const join = { revision: invitation.composition.revision, response: '一起听', consent: true };
  assert.equal((await call(`/invites/${invitation.inviteToken}/join`, { method: 'POST', token: host.token, data: join })).body.error.code, 'DISTINCT_IDENTITY_REQUIRED');
  assert.equal((await call(`/invites/${invitation.inviteToken}/join`, { method: 'POST', token: guest.token, data: { ...join, consent: false } })).body.error.code, 'JOIN_CONSENT_REQUIRED');
  room = (await call(`/invites/${invitation.inviteToken}/join`, { method: 'POST', token: guest.token, data: join })).body.composition;
  assert.equal((await call(`/compositions/${room.id}/decision`, { method: 'POST', token: guest.token, data: { revision: room.revision, accept: true } })).status, 403);
  room = (await call(`/compositions/${room.id}/decision`, { method: 'POST', token: host.token, data: { revision: room.revision, accept: true } })).body.composition;
  assert.equal(room.exportEligible, false);
  room = (await call(`/compositions/${room.id}/consent`, { method: 'POST', token: guest.token, data: { revision: room.revision, consent: true } })).body.composition;
  assert.equal(room.consents.host, false);
  assert.equal((await call(`/compositions/${room.id}/export`, { token: guest.token })).status, 409);
  room = (await call(`/compositions/${room.id}/consent`, { method: 'POST', token: host.token, data: { revision: room.revision, consent: true } })).body.composition;
  assert.equal((await call(`/compositions/${room.id}/export`, { token: host.token })).status, 200);
  const staleRevision = room.revision;
  room = (await call(`/compositions/${room.id}`, { method: 'PATCH', token: guest.token, data: { revision: room.revision, avatar: { ...DEFAULT_AVATAR, pose: 'wave' } } })).body.composition;
  assert.equal(room.exportEligible, false);
  assert.deepEqual(room.consents, { host: false, guest: false });
  assert.equal((await call(`/compositions/${room.id}/decision`, { method: 'POST', token: host.token, data: { revision: staleRevision, accept: true } })).status, 409);
  room = (await call(`/compositions/${room.id}/invite`, { method: 'DELETE', token: host.token, data: { revision: room.revision } })).body.composition;
  assert.equal((await call(`/invites/${invitation.inviteToken}/photo`)).status, 404);
  assert.equal((await call(`/compositions/${room.id}/photo`, { token: guest.token })).status, 200);
  assert.equal((await call(`/compositions/${room.id}/participation`, { method: 'DELETE', token: guest.token, data: { revision: room.revision } })).status, 200);
  assert.equal((await call(`/compositions/${room.id}/photo`, { token: guest.token })).status, 404);
});

test('persistent rate limits cannot be bypassed by starting another Worker isolate', async t => {
  const { env } = await directFixture(t);
  let result;
  for (let i = 0; i < 31; i++) result = await createAvatarWorker().fetch(new Request('https://musicspace.test/api/avatar/session', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID() }, body: JSON.stringify({ name: '观众' }) }), env);
  assert.equal(result.status, 429);
  assert.equal((await result.json()).error.code, 'RATE_LIMITED');
  assert.ok(Number(result.headers.get('Retry-After')) > 0);
});

test('unknown commit outcome plus read outage preserves the photo for a later exact retry', async t => {
  const { call, env } = await directFixture(t), host = (await call('/session', { method: 'POST', data: { name: 'H' } })).body;
  env.DB.failAfterCommit = true;
  env.DB.blockRecoveryReads = true;
  const key = randomUUID(), data = { ...baseComposition(), scene: photoScene() };
  const uncertain = await call('/compositions', { method: 'POST', token: host.token, data, key });
  assert.equal(uncertain.status, 503);
  assert.equal(uncertain.body.error.code, 'SERVICE_UNAVAILABLE');
  assert.equal(env.PHOTOS.blobs.size, 1);
  const recovered = await call('/compositions', { method: 'POST', token: host.token, data, key });
  assert.equal(recovered.status, 201);
  assert.equal((await call(`/compositions/${recovered.body.composition.id}/photo`, { token: host.token })).status, 200);
  assert.equal(env.DB.sql.prepare('SELECT COUNT(*) AS n FROM avatar_compositions').get().n, 1);
});
