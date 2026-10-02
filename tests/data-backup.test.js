import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync, copyFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { removeTempAfterTests } from './helpers/temp-directory.js';
import { createAvatarApi } from '../server/avatar-api.js';
import { createEventApi } from '../server/event-api.js';
import { backupData, restoreData } from '../scripts/ops/data-backup.mjs';
import { photoData, JPEG_FIXTURE } from './event-contract.test.js';

const checksum = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const cli = fileURLToPath(new URL('../scripts/ops/data-backup.mjs', import.meta.url));
const ok = (r, status = 200) => { assert.equal(r.status, status, JSON.stringify(r.body)); return r.body; };
function temporary(t) {
  const root = mkdtempSync(join(tmpdir(), 'musicspace-offline-backup-'));
  t.after(() => removeTempAfterTests(root));
  return root;
}
function legacyDatabase(dir) {
  const moduleURL = new URL('../server/db.js', import.meta.url).href;
  const script = `const {db}=await import(${JSON.stringify(moduleURL)});db.prepare('INSERT INTO users VALUES (?,?,?,?)').run('synthetic-user','Synthetic Legacy','synthetic-token-hash','2026-10-02');db.prepare('INSERT INTO rooms (id,code,title,event_id,creator_id,created_at) VALUES (?,?,?,?,?,?)').run('synthetic-room','SYNTH1','Synthetic Legacy Show','echo-live-2026','synthetic-user','2026-10-02');db.prepare('INSERT INTO photos VALUES (?,?,?,?,?,?)').run('synthetic-photo','synthetic-room','synthetic-user','image/jpeg',Buffer.from(${JSON.stringify(JPEG_FIXTURE)},'base64'),'2026-10-02');db.close();`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { env: { ...process.env, DATA_DIR: dir }, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
}
async function fixture(t, dir) {
  const clock = () => Date.parse('2026-10-02T01:00:00Z');
  let server, avatar, event, base, running = false;
  async function start(dataDir = dir) {
    avatar = createAvatarApi({ dataDir, clock, rateLimits: false });
    event = createEventApi({ dataDir, clock, rateLimits: false });
    server = createServer(async (req, res) => { if (!await event(req, res) && !await avatar(req, res)) { res.writeHead(404); res.end(); } });
    server.listen(0, '127.0.0.1'); await once(server, 'listening'); base = `http://127.0.0.1:${server.address().port}`; running = true;
  }
  async function stop() { if (!running) return; server.closeAllConnections(); await new Promise(done => server.close(done)); avatar.close(); event.close(); running = false; }
  t.after(stop);
  await start();
  return { start, stop, async request(path, { token, data, method = data ? 'POST' : 'GET', key = randomUUID() } = {}) {
    const full = path.startsWith('/api/') ? path : '/api/event' + path;
    const r = await fetch(base + full, { method, headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(data ? { 'Content-Type': 'application/json', 'Idempotency-Key': key } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) });
    const bytes = Buffer.from(await r.arrayBuffer()); return { status: r.status, bytes, body: r.headers.get('content-type')?.includes('json') ? JSON.parse(bytes) : null };
  } };
}

test('offline backup/restore: real HTTP identities, room, exact photo bytes, accepted and revoked grants, exclusions and signing receipts survive', async t => {
  const root = temporary(t), data = join(root, 'source'), backup = join(root, 'backup'), restored = join(root, 'restored'); mkdirSync(data);
  legacyDatabase(data);
  mkdirSync(join(data, 'private-sidecars'));
  writeFileSync(join(data, 'private-sidecars', 'synthetic-photo.jpg'), Buffer.from(JPEG_FIXTURE, 'base64'));
  writeFileSync(join(data, 'private-sidecars', 'synthetic-chunks.bin'), Buffer.alloc(2 * 1024 * 1024 + 17, 73));
  const f = await fixture(t, data), sessionKey = 'synthetic-offline-backup-host';
  const a = ok(await f.request('/api/avatar/session', { data: { name: 'Synthetic Host' }, key: sessionKey }), 201);
  const b = ok(await f.request('/api/avatar/session', { data: { name: 'Synthetic Guest' } }), 201);
  const removed = ok(await f.request('/api/avatar/session', { data: { name: 'Synthetic Removed' } }), 201);
  const outside = ok(await f.request('/api/avatar/session', { data: { name: 'Synthetic Outside' } }), 201);
  const room = ok(await f.request('/rooms', { token: a.token, data: { title: 'Synthetic Backup Show', venue: 'Synthetic', songId: 'late-train', joinConsent: true, participation: 'open' } }), 201).room;
  const joinGuest = ok(await f.request(`/rooms/${room.code}/join`, { token: b.token, data: { joinConsent: true, participation: 'open' } }));
  const joinedRemoved = ok(await f.request(`/rooms/${room.code}/join`, { token: removed.token, data: { joinConsent: true, participation: 'open' } }));
  ok(await f.request(`/rooms/${room.code}/join`, { token: outside.token, data: { joinConsent: true, participation: 'open' } }));
  const greeting = ok(await f.request(`/rooms/${room.id}/greetings`, { token: a.token, data: { recipientId: b.user.id } }), 201).greeting;
  ok(await f.request(`/greetings/${greeting.id}/accept`, { token: b.token, data: { revision: greeting.revision } }));
  ok(await f.request(`/chats/${b.user.id}/messages`, { token: a.token, data: { text: 'Synthetic backup message only' } }), 201);
  const messagesBefore = ok(await f.request(`/chats/${a.user.id}/messages`, { token: b.token }));
  const socialBefore = ok(await f.request('/social', { token: a.token }));
  ok(await f.request(`/blocks/${outside.user.id}`, { token: removed.token, data: {} }));
  const blocksBefore = ok(await f.request('/social', { token: removed.token }));
  const upload = async (actor, visibility) => ok(await f.request(`/rooms/${room.id}/photos`, { token: actor.token, data: { ...photoData(), visibility } }), 201).photo;
  const send = async (p, q) => {
    const e = ok(await f.request(`/rooms/${room.id}/exchanges`, { token: a.token, data: { recipientId: b.user.id, offeredPhotoId: p.id, requestedPhotoId: q.id, offeredRevision: p.revision, requestedRevision: q.revision, offerPreviewConsent: true, offerOriginalConsent: true, offeredPreviewDataUrl: photoData().dataUrl } }), 201).exchange;
    return ok(await f.request(`/exchanges/${e.id}/accept`, { token: b.token, data: { revision: e.revision, exchangeConsent: true } })).exchange;
  };
  const privatePhoto = await upload(a, 'private'), publicPhoto = await upload(b, 'members');
  const accepted = await send(privatePhoto, publicPhoto);
  const withdrawn = await upload(a, 'private'), other = await upload(b, 'members'), revoking = await send(withdrawn, other);
  const revoked = ok(await f.request(`/exchanges/${revoking.id}/revoke`, { token: a.token, data: { revision: revoking.revision } })).exchange;
  const roomBefore = ok(await f.request(`/rooms/${room.id}`, { token: a.token }));
  const member = roomBefore.members.find(m => m.id === removed.user.id || m.userId === removed.user.id);
  const membershipJoinedAt = member?.joinedAt || joinedRemoved.membership?.joinedAt;
  assert.ok(membershipJoinedAt, 'real joined-at receipt must be available');
  ok(await f.request(`/rooms/${room.id}/exclusions/${removed.user.id}`, { token: a.token, data: { membershipJoinedAt, removalConsent: true } }));
  const image = `/exchanges/${accepted.id}/photos/${privatePhoto.id}/image`;
  const originalBytes = (await f.request(image, { token: b.token })).bytes;
  assert.equal((await f.request(image, { token: b.token })).status, 200);
  assert.equal((await f.request(privatePhoto.imageUrl, { token: b.token })).status, 404);
  await f.stop();
  const originalDb = checksum(join(data, 'avatar-space.sqlite')), originalLegacy = checksum(join(data, 'music-map.sqlite'));
  const copied = spawnSync(process.execPath, [cli, 'backup', '--data-dir', data, '--output', backup, '--service-stopped'], { encoding: 'utf8' });
  assert.equal(copied.status, 0, copied.stderr); assert.equal(JSON.parse(copied.stdout).verified, true);
  const recovered = spawnSync(process.execPath, [cli, 'restore', '--input', backup, '--data-dir', restored, '--service-stopped'], { encoding: 'utf8' });
  assert.equal(recovered.status, 0, recovered.stderr); assert.equal(JSON.parse(recovered.stdout).verified, true);
  assert.equal(checksum(join(data, 'avatar-space.sqlite')), originalDb, 'backup never mutates source');
  assert.equal(checksum(join(restored, 'avatar-space.sqlite')), originalDb);
  assert.equal(checksum(join(restored, 'music-map.sqlite')), originalLegacy);
  assert.deepEqual(readFileSync(join(restored, 'private-sidecars', 'synthetic-photo.jpg')), Buffer.from(JPEG_FIXTURE, 'base64'));
  assert.equal(checksum(join(restored, 'private-sidecars', 'synthetic-chunks.bin')), checksum(join(data, 'private-sidecars', 'synthetic-chunks.bin')));
  await f.start(restored);
  assert.equal(ok(await f.request('/rooms', { token: a.token })).actorId, a.user.id);
  assert.equal(ok(await f.request(`/rooms/${room.id}`, { token: b.token })).room.id, room.id);
  assert.deepEqual((await f.request(image, { token: b.token })).bytes, originalBytes);
  assert.equal((await f.request(image, { token: outside.token })).status, 404);
  assert.equal((await f.request(privatePhoto.imageUrl, { token: b.token })).status, 404);
  assert.equal(ok(await f.request(`/exchanges/${accepted.id}`, { token: b.token })).exchange.status, 'accepted');
  assert.equal(ok(await f.request(`/exchanges/${revoked.id}`, { token: b.token })).exchange.status, 'revoked');
  assert.deepEqual(ok(await f.request('/social', { token: a.token })), socialBefore);
  assert.deepEqual(ok(await f.request('/social', { token: removed.token })), blocksBefore);
  assert.deepEqual(ok(await f.request(`/chats/${a.user.id}/messages`, { token: b.token })), messagesBefore);
  assert.equal((await f.request(`/chats/${a.user.id}/messages`, { token: outside.token })).status, 404);
  assert.equal((await f.request(`/exchanges/${revoked.id}/photos/${withdrawn.id}/image`, { token: b.token })).status, 404);
  assert.equal((await f.request(`/rooms/${room.code}/join`, { token: removed.token, data: { joinConsent: true, participation: 'open' } })).status, 403);
  assert.equal((await f.request(`/rooms/${room.id}`, { token: removed.token })).status, 404);
  const replay = ok(await f.request('/api/avatar/session', { data: { name: 'Synthetic Host' }, key: sessionKey }), 201);
  assert.equal(replay.token, a.token, 'persistent signing key and exact bootstrap receipt survive');
  assert.notEqual(joinGuest, null);
});

test('offline backup refuses a running WAL database and incomplete source without publishing a backup', async t => {
  const root = temporary(t), data = join(root, 'source'); mkdirSync(data); legacyDatabase(data); const f = await fixture(t, data);
  ok(await f.request('/api/avatar/session', { data: { name: 'Synthetic WAL' } }), 201);
  const out = join(root, 'refused');
  assert.throws(() => backupData({ dataDir: data, output: out, serviceStopped: true }), /journal present/);
  assert.equal(existsSync(out), false);
  await f.stop();
  assert.throws(() => backupData({ dataDir: data, output: out }), /confirmation/);
  const incomplete = join(root, 'incomplete'); mkdirSync(incomplete);
  copyFileSync(join(data, 'music-map.sqlite'), join(incomplete, 'music-map.sqlite'));
  assert.throws(() => backupData({ dataDir: incomplete, output: out, serviceStopped: true }), /Both/);
  assert.equal(existsSync(out), false);
});

test('offline restore rejects corrupt bytes, SQLite corruption, missing photo bytes and existing targets without touching original data', async t => {
  const root = temporary(t), data = join(root, 'source'); mkdirSync(data); legacyDatabase(data); const f = await fixture(t, data);
  const a = ok(await f.request('/api/avatar/session', { data: { name: 'Synthetic A' } }), 201);
  const r = ok(await f.request('/rooms', { token: a.token, data: { title: 'Synthetic', songId: 'late-train', joinConsent: true, participation: 'open' } }), 201).room;
  ok(await f.request(`/rooms/${r.id}/photos`, { token: a.token, data: photoData() }), 201);
  await f.stop();
  const before = checksum(join(data, 'avatar-space.sqlite')), backup = join(root, 'backup');
  backupData({ dataDir: data, output: backup, serviceStopped: true });
  assert.throws(() => restoreData({ input: backup, dataDir: data, serviceStopped: true }), /already exists/);
  assert.equal(checksum(join(data, 'avatar-space.sqlite')), before);
  const corrupted = join(backup, 'avatar-space.sqlite'); writeFileSync(corrupted, Buffer.from('synthetic corruption'));
  const target = join(root, 'refused');
  assert.throws(() => restoreData({ input: backup, dataDir: target, serviceStopped: true }), /checksum mismatch/);
  assert.equal(existsSync(target), false);
  assert.equal(checksum(join(data, 'avatar-space.sqlite')), before);
  const manifestPath = join(backup, '.musicspace-backup.json'), manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const entry = manifest.files.find(e => e.path === 'avatar-space.sqlite'); entry.bytes = readFileSync(corrupted).length; entry.sha256 = checksum(corrupted);
  writeFileSync(manifestPath, JSON.stringify(manifest));
  assert.throws(() => restoreData({ input: backup, dataDir: target, serviceStopped: true }), /database|file is not/i);
  assert.equal(existsSync(target), false, 'corrupt SQLite copy is removed, original is preserved');
  assert.equal(checksum(join(data, 'avatar-space.sqlite')), before);
  const db = new DatabaseSync(join(data, 'avatar-space.sqlite')); db.exec('DELETE FROM event_photo_blobs'); db.close();
  assert.throws(() => backupData({ dataDir: data, output: target, serviceStopped: true }), /missing image bytes/);
  assert.equal(existsSync(target), false);
});

test('offline backup rejects links, nested outputs, manifest traversal and duplicate paths; CLI fails closed', async t => {
  const root = temporary(t), data = join(root, 'source'); mkdirSync(data); legacyDatabase(data); const f = await fixture(t, data); await f.stop();
  const out = join(root, 'backup');
  assert.throws(() => backupData({ dataDir: data, output: join(data, 'nested'), serviceStopped: true }), /separate/);
  symlinkSync(data, join(data, 'linked-data'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => backupData({ dataDir: data, output: out, serviceStopped: true }), /Links/);
  rmSync(join(data, 'linked-data'));
  backupData({ dataDir: data, output: out, serviceStopped: true });
  const manifest = join(out, '.musicspace-backup.json'), original = readFileSync(manifest, 'utf8'), m = JSON.parse(original);
  m.files[0].path = '../outside'; writeFileSync(manifest, JSON.stringify(m));
  assert.throws(() => restoreData({ input: out, dataDir: join(root, 'refused'), serviceStopped: true }), /Unsafe/);
  const duplicate = JSON.parse(original); duplicate.files.push(duplicate.files[0]); writeFileSync(manifest, JSON.stringify(duplicate));
  assert.throws(() => restoreData({ input: out, dataDir: join(root, 'refused'), serviceStopped: true }), /Invalid/);
  const result = spawnSync(process.execPath, [cli, 'backup', '--data-dir', data, '--output', join(root, 'cli-output')], { encoding: 'utf8' });
  assert.equal(result.status, 1); assert.match(result.stderr, /confirmation/); assert.equal(existsSync(join(root, 'cli-output')), false);
});
