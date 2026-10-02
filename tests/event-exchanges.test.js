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
import { photoData, JPEG_FIXTURE } from './event-contract.test.js';

const DAY = 24 * 60 * 60 * 1000;
const EXCHANGE_FIELDS = ['id', 'roomId', 'senderId', 'recipientId', 'offeredPhotoId', 'requestedPhotoId', 'offeredRevision', 'requestedRevision', 'status', 'revision', 'createdAt', 'updatedAt', 'expiresAt', 'acceptedAt', 'endedAt', 'endReason', 'peer'];
const previewUrl = exchange => `/exchanges/${exchange.id}/preview`;
const imageUrl = (exchange, photo) => `/exchanges/${exchange.id}/photos/${typeof photo === 'string' ? photo : photo.id}/image`;
const jpegUrl = bytes => 'data:image/jpeg;base64,' + Buffer.from(bytes).toString('base64');
const ok = (response, status = 200) => { assert.equal(response.status, status, JSON.stringify(response.body)); return response.body; };

// Both adapters execute the real permission engine against durable SQLite. Node
// also exercises the actual HTTP bridge; only external object storage is faked.
async function fixture(t, mode = 'Worker', { rateLimits = false } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'musicspace-exchanges-'));
  let time = Date.parse('2026-09-30T10:00:00Z'), env, server, avatar, event, base;
  async function start() {
    if (mode === 'Worker') { env = createFakeEnv(join(dir, 'events.sqlite'), { clock: () => time }); return; }
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
  const f = {
    get env() { return env; }, get time() { return time; }, advance: ms => time += ms,
    restart: async () => { await stop(); await start(); },
    async request(path, { method = 'GET', token, data, key = randomUUID(), headers = {} } = {}) {
      const suffix = path.startsWith('/api/') ? path : '/api/event' + path;
      const options = { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(data === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(method === 'GET' || key === null ? {} : { 'Idempotency-Key': key }), ...headers }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) };
      const result = mode === 'Node' ? await fetch(base + suffix, options) : await (suffix.startsWith('/api/avatar') ? createAvatarWorker({ clock: () => time, rateLimits: false }) : createEventWorker({ clock: () => time, rateLimits })).fetch(new Request('https://musicspace.test' + suffix, options), env);
      const bytes = Buffer.from(await result.arrayBuffer());
      return { status: result.status, headers: result.headers, bytes, body: result.headers.get('Content-Type')?.includes('json') ? JSON.parse(bytes) : null };
    },
  };
  f.session = async name => ok(await f.request('/api/avatar/session', { method: 'POST', data: { name } }), 201);
  f.room = async a => ok(await f.request('/rooms', { method: 'POST', token: a.token, data: { title: '合成现场', venue: '合成场地', songId: 'late-train', joinConsent: true } }), 201).room;
  f.join = (room, a) => f.request(`/rooms/${room.code}/join`, { method: 'POST', token: a.token, data: { joinConsent: true } });
  f.leave = (room, a) => f.request(`/rooms/${room.id}/leave`, { method: 'POST', token: a.token, data: {} });
  f.close = (room, a) => f.request(`/rooms/${room.id}/close`, { method: 'POST', token: a.token, data: { revision: room.revision } });
  f.upload = async (room, a, visibility = 'private') => ok(await f.request(`/rooms/${room.id}/photos`, { method: 'POST', token: a.token, data: { ...photoData(), visibility } }), 201).photo;
  f.patch = (photo, a, visibility) => f.request(`/photos/${photo.id}`, { method: 'PATCH', token: a.token, data: { revision: photo.revision, visibility } });
  f.withdraw = (photo, a, options = {}) => f.request(`/photos/${photo.id}/withdraw`, { method: 'POST', token: a.token, data: { revision: photo.revision }, ...options });
  f.remove = (photo, a, options = {}) => f.request(`/photos/${photo.id}`, { method: 'DELETE', token: a.token, data: { revision: photo.revision }, ...options });
  f.block = (a, b, options = {}) => f.request(`/blocks/${b.user.id}`, { method: 'POST', token: a.token, data: {}, ...options });
  f.unblock = (a, b, revision) => f.request(`/blocks/${b.user.id}`, { method: 'DELETE', token: a.token, data: { revision } });
  f.data = (b, offered, requested) => ({ recipientId: b.user.id, offeredPhotoId: offered.id, requestedPhotoId: requested.id, offeredRevision: offered.revision, requestedRevision: requested.revision, offerPreviewConsent: true, offerOriginalConsent: true, offeredPreviewDataUrl: photoData().dataUrl });
  f.send = (room, a, b, offered, requested, options = {}) => f.request(`/rooms/${room.id}/exchanges`, { method: 'POST', token: a.token, data: f.data(b, offered, requested), ...options });
  f.respond = (exchange, action, a, options = {}) => f.request(`/exchanges/${exchange.id}/${action}`, { method: 'POST', token: a.token, data: { revision: exchange.revision, ...(action === 'accept' ? { exchangeConsent: true } : {}) }, ...options });
  f.list = async (a, cursor) => ok(await f.request('/exchanges' + (cursor ? '?cursor=' + cursor : ''), { token: a.token }));
  f.get = async (exchange, a) => ok(await f.request(`/exchanges/${exchange.id}`, { token: a.token })).exchange;
  f.two = async ({ offeredVisibility = 'private' } = {}) => {
    const a = await f.session('A'), b = await f.session('B'), room = await f.room(a); ok(await f.join(room, b));
    const offered = await f.upload(room, a, offeredVisibility), requested = await f.upload(room, b, 'members');
    return { a, b, room, offered, requested };
  };
  f.accepted = async options => { const pair = await f.two(options); const pending = ok(await f.send(pair.room, pair.a, pair.b, pair.offered, pair.requested), 201).exchange; return { ...pair, exchange: ok(await f.respond(pending, 'accept', pair.b)).exchange }; };
  return f;
}

function assertReceipt(exchange, peer) {
  assert.deepEqual(Object.keys(exchange).sort(), [...EXCHANGE_FIELDS].sort());
  assert.deepEqual(Object.keys(exchange.peer).sort(), ['avatar', 'id', 'name']);
  assert.equal(exchange.peer.id, peer.user.id);
  for (const forbidden of ['photo_key', 'preview_key', 'imageUrl', 'data:image', 'token_hash', peer.token]) assert.ok(!JSON.stringify(exchange).includes(forbidden), forbidden);
}

for (const mode of ['Node', 'Worker']) {
  test(`${mode} exchanges: authenticated participant receipts, exact photo identities and a separate consented offer preview`, async t => {
    const f = await fixture(t, mode), { a, b, room, offered, requested } = await f.two(), outsider = await f.session('Outside');
    assert.deepEqual(await f.list(a), { actorId: a.user.id, exchanges: [], nextCursor: null });
    assert.equal((await f.request('/exchanges')).status, 401);
    assert.equal((await f.request('/exchanges', { token: 'x'.repeat(43) })).status, 401);
    const response = await f.send(room, a, b, offered, requested), exchange = ok(response, 201).exchange;
    assertReceipt(exchange, b); assert.equal(exchange.roomId, room.id); assert.equal(exchange.senderId, a.user.id); assert.equal(exchange.recipientId, b.user.id);
    assert.equal(exchange.offeredPhotoId, offered.id); assert.equal(exchange.requestedPhotoId, requested.id);
    assert.equal(exchange.offeredRevision, 1); assert.equal(exchange.requestedRevision, 1); assert.equal(exchange.revision, 1); assert.equal(exchange.status, 'pending');
    assert.equal(Date.parse(exchange.expiresAt) - Date.parse(exchange.createdAt), DAY);
    assert.equal(exchange.acceptedAt, null); assert.equal(exchange.endedAt, null); assert.equal(exchange.endReason, null);
    assert.deepEqual(await f.get(exchange, a), exchange); assertReceipt(await f.get(exchange, b), a);
    const senderList = await f.list(a), recipientList = await f.list(b); assert.equal(senderList.actorId, a.user.id); assert.equal(recipientList.actorId, b.user.id);
    assert.equal(senderList.exchanges[0].id, exchange.id); assert.equal(recipientList.exchanges[0].id, exchange.id);
    assert.equal((await f.request(`/exchanges/${exchange.id}`, { token: outsider.token })).status, 404); assert.equal((await f.list(outsider)).exchanges.length, 0);
    assert.equal((await f.request(`/exchanges/${randomUUID()}`, { token: a.token })).status, 404);
    for (const participant of [a, b]) { const preview = await f.request(previewUrl(exchange), { token: participant.token }); ok(preview); assert.equal(preview.headers.get('Content-Type'), 'image/jpeg'); assert.match(preview.headers.get('Cache-Control'), /no-store/); assert.ok(preview.bytes.length > 50 && preview.bytes.length <= 32 * 1024); }
    assert.equal((await f.request(previewUrl(exchange), { token: outsider.token })).status, 404);
    assert.equal((await f.request(previewUrl(exchange))).status, 401);
    assert.equal((await f.request(offered.imageUrl, { token: b.token })).status, 404);
    assert.equal((await f.request(imageUrl(exchange, offered), { token: b.token })).status, 404);
  });

  test(`${mode} exchanges: creation rejects missing consent, forged ownership, private requested photos and cross-room targets`, async t => {
    const f = await fixture(t, mode), { a, b, room, offered, requested } = await f.two(), outsider = await f.session('Outside');
    const privateTarget = await f.upload(room, b), other = await f.room(a); ok(await f.join(other, b));
    const foreignOffer = await f.upload(other, a), foreignTarget = await f.upload(other, b, 'members'), data = f.data(b, offered, requested);
    for (const change of [{ offerPreviewConsent: false }, { offerPreviewConsent: undefined }, { offerOriginalConsent: false }, { offerOriginalConsent: undefined }, { offeredPreviewDataUrl: undefined }, { senderId: outsider.user.id }, { offeredRevision: 0 }, { requestedRevision: '1' }, { imageUrl: 'https://other.test/image.jpg' }]) {
      assert.equal((await f.send(room, a, b, offered, requested, { data: { ...data, ...change } })).status, 400, JSON.stringify(change));
    }
    for (const [sender, recipient, p, q, location] of [[outsider, b, offered, requested, room], [a, outsider, offered, requested, room], [a, b, requested, offered, room], [a, b, offered, privateTarget, room], [a, b, foreignOffer, requested, room], [a, b, offered, foreignTarget, room], [a, b, offered, requested, { id: randomUUID() }]]) {
      assert.equal((await f.send(location, sender, recipient, p, q)).status, 404);
    }
    assert.equal((await f.send(room, a, a, offered, requested)).status, 400);
    assert.equal((await f.send(room, a, b, offered, requested, { data: { ...data, requestedPhotoId: offered.id } })).status, 400);
    assert.equal((await f.send(room, a, b, offered, requested, { data: { ...data, offeredRevision: 99 } })).status, 409);
    assert.equal((await f.send(room, a, b, offered, requested, { data: { ...data, requestedRevision: 99 } })).status, 409);
    assert.equal((await f.send(room, a, b, offered, requested, { key: null })).status, 400);
    assert.equal((await f.send(room, a, b, offered, requested, { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
    assert.equal((await f.list(a)).exchanges.length, 0);
  });

  test(`${mode} exchanges: preview validation strips metadata and enforces JPEG dimensions and byte limits`, async t => {
    const f = await fixture(t, mode), { a, b, room, offered, requested } = await f.two(), source = Buffer.from(JPEG_FIXTURE, 'base64');
    const metadata = Buffer.from('Exif\0\0synthetic-private-location'), segment = Buffer.alloc(metadata.length + 4); segment[0] = 0xff; segment[1] = 0xe1; segment.writeUInt16BE(metadata.length + 2, 2); metadata.copy(segment, 4);
    const annotated = Buffer.concat([source.subarray(0, 2), segment, source.subarray(2)]);
    const large = Buffer.from(source), sof = large.indexOf(Buffer.from([0xff, 0xc0])); assert.ok(sof > 0); large.writeUInt16BE(321, sof + 7);
    // The oversize payload is after the scan marker, so metadata stripping cannot
    // turn this 33KiB image payload into a compliant small preview.
    const oversized = Buffer.concat([source.subarray(0, -2), Buffer.alloc(33 * 1024, 1), source.subarray(-2)]);
    for (const invalid of ['data:image/png;base64,' + JPEG_FIXTURE, 'data:image/jpeg;base64,ZmFrZQ==', jpegUrl(large), jpegUrl(oversized)]) {
      const result = await f.send(room, a, b, offered, requested, { data: { ...f.data(b, offered, requested), offeredPreviewDataUrl: invalid } }); assert.ok([400, 413].includes(result.status), JSON.stringify(result.body));
    }
    const exchange = ok(await f.send(room, a, b, offered, requested, { data: { ...f.data(b, offered, requested), offeredPreviewDataUrl: jpegUrl(annotated) } }), 201).exchange;
    const preview = await f.request(previewUrl(exchange), { token: b.token }); ok(preview); assert.ok(!preview.bytes.includes(metadata)); assert.ok(preview.bytes.length <= 32 * 1024);
    assert.ok(!JSON.stringify(await f.list(b)).includes(metadata.toString()));
  });

  test(`${mode} exchanges: recipient alone accepts with explicit consent and grants only the two named exchange images`, async t => {
    const f = await fixture(t, mode), { a, b, room, offered, requested } = await f.two(), outsider = await f.session('Outside'), extra = await f.upload(room, a);
    ok(await f.join(room, outsider)); const pending = ok(await f.send(room, a, b, offered, requested), 201).exchange;
    assert.equal((await f.respond(pending, 'accept', a)).status, 403); assert.equal((await f.respond(pending, 'accept', outsider)).status, 404);
    for (const data of [{ revision: 1 }, { revision: 1, exchangeConsent: false }, { revision: 1, exchangeConsent: 'true' }, { exchangeConsent: true }, { revision: 1, exchangeConsent: true, offeredPhotoId: extra.id }]) assert.equal((await f.respond(pending, 'accept', b, { data })).status, 400);
    assert.equal((await f.respond(pending, 'accept', b, { data: { revision: 99, exchangeConsent: true } })).status, 409);
    const exchange = ok(await f.respond(pending, 'accept', b)).exchange;
    assert.equal(exchange.status, 'accepted'); assert.equal(exchange.revision, 2); assert.equal(exchange.acceptedAt, exchange.updatedAt); assert.equal(exchange.endedAt, null); assertReceipt(exchange, a);
    for (const participant of [a, b]) for (const photo of [offered, requested]) { const image = await f.request(imageUrl(exchange, photo), { token: participant.token }); ok(image); assert.match(image.headers.get('Cache-Control'), /no-store/); assert.equal(image.headers.get('Content-Type'), 'image/jpeg'); }
    assert.equal((await f.request(imageUrl(exchange, extra), { token: b.token })).status, 404);
    assert.equal((await f.request(imageUrl(exchange, offered), { token: outsider.token })).status, 404);
    assert.equal((await f.request(offered.imageUrl, { token: b.token })).status, 404);
    assert.equal((await f.request(previewUrl(exchange), { token: b.token })).status, 404);
    assert.equal((await f.respond(pending, 'accept', b)).status, 409);
    assert.equal(ok(await f.request('/social', { token: a.token })).friends.length, 0);
  });

  test(`${mode} exchanges: decline/cancel/revoke are role-bound, revision-checked and preserve terminal history`, async t => {
    const f = await fixture(t, mode), { a, b, room, offered, requested } = await f.two(), outsider = await f.session('Outside');
    let pending = ok(await f.send(room, a, b, offered, requested), 201).exchange;
    assert.equal((await f.respond(pending, 'decline', a)).status, 403); assert.equal((await f.respond(pending, 'cancel', b)).status, 403);
    assert.equal((await f.respond(pending, 'revoke', a)).status, 409); assert.equal((await f.respond(pending, 'decline', outsider)).status, 404);
    assert.equal((await f.respond(pending, 'decline', b, { data: {} })).status, 400);
    assert.equal((await f.respond(pending, 'decline', b, { data: { revision: 99 } })).status, 409);
    const declined = ok(await f.respond(pending, 'decline', b)).exchange; assert.equal(declined.status, 'declined'); assert.equal(declined.endReason, 'declined'); assert.ok(declined.endedAt); assert.equal(declined.revision, 2);
    assert.equal((await f.respond(declined, 'accept', b)).status, 409); assert.equal((await f.request(previewUrl(declined), { token: b.token })).status, 404);
    pending = ok(await f.send(room, a, b, offered, requested), 201).exchange;
    const cancelled = ok(await f.respond(pending, 'cancel', a)).exchange; assert.equal(cancelled.status, 'cancelled'); assert.equal(cancelled.endReason, 'cancelled'); assert.notEqual(cancelled.id, declined.id);
    for (const revoker of [a, b]) {
      pending = ok(await f.send(room, a, b, offered, requested), 201).exchange; const accepted = ok(await f.respond(pending, 'accept', b)).exchange;
      assert.equal((await f.respond(accepted, 'revoke', outsider)).status, 404); assert.equal((await f.respond(accepted, 'revoke', revoker, { data: { revision: 1 } })).status, 409);
      const revoked = ok(await f.respond(accepted, 'revoke', revoker)).exchange; assert.equal(revoked.status, 'revoked'); assert.equal(revoked.revision, 3); assert.equal(revoked.endReason, 'revoked'); assert.ok(revoked.acceptedAt && revoked.endedAt);
      for (const user of [a, b]) assert.equal((await f.request(imageUrl(revoked, offered), { token: user.token })).status, 404);
    }
    assert.equal((await f.list(a)).exchanges.length, 4); assert.equal((await f.list(b)).exchanges.length, 4);
  });

  test(`${mode} exchanges: one pending unordered pair per room and no duplicate live exact photo pair`, async t => {
    const f = await fixture(t, mode), { a, b, room, offered, requested } = await f.two(), other = await f.room(b); ok(await f.join(other, a));
    const otherA = await f.upload(other, a, 'members'), otherB = await f.upload(other, b, 'members');
    const aShared = ok(await f.patch(offered, a, 'members')).photo;
    const pending = ok(await f.send(room, a, b, aShared, requested), 201).exchange;
    assert.equal((await f.send(room, a, b, aShared, requested)).status, 409);
    assert.equal((await f.send(room, b, a, requested, aShared)).status, 409);
    const parallelRoom = ok(await f.send(other, b, a, otherB, otherA), 201).exchange;
    assert.equal((await f.list(a)).exchanges.length, 2); assert.equal((await f.send(other, a, b, otherA, otherB)).status, 409);
    ok(await f.respond(parallelRoom, 'cancel', b));
    const accepted = ok(await f.respond(pending, 'accept', b)).exchange;
    assert.equal((await f.send(room, a, b, aShared, requested)).status, 409); assert.equal((await f.send(room, b, a, requested, aShared)).status, 409);
    const next = ok(await f.send(other, b, a, otherB, otherA), 201).exchange; assert.equal(next.status, 'pending');
    ok(await f.respond(next, 'cancel', b)); ok(await f.respond(accepted, 'revoke', a));
    assert.equal((await f.send(room, a, b, aShared, requested)).status, 201);
  });

  test(`${mode} exchanges: concurrent opposite sends and accept/cancel have exactly one winner`, async t => {
    const f = await fixture(t, mode), { a, b, room, offered, requested } = await f.two(), shared = ok(await f.patch(offered, a, 'members')).photo;
    const results = await Promise.all([f.send(room, a, b, shared, requested), f.send(room, b, a, requested, shared)]);
    assert.deepEqual(results.map(result => result.status).sort(), [201, 409]);
    const pending = results.find(result => result.status === 201).body.exchange, sender = pending.senderId === a.user.id ? a : b, recipient = sender === a ? b : a;
    const responses = await Promise.all([f.respond(pending, 'accept', recipient), f.respond(pending, 'cancel', sender)]); assert.deepEqual(responses.map(result => result.status).sort(), [200, 409]);
    const final = await f.get(pending, a); assert.equal(final.revision, 2); assert.ok(['accepted', 'cancelled'].includes(final.status)); assert.equal((await f.list(a)).exchanges.length, 1);
  });

  test(`${mode} exchanges: accepted access survives leaving, room close/expiry and friend removal`, async t => {
    const f = await fixture(t, mode), { a, b, room, offered, requested, exchange } = await f.accepted();
    const greeting = ok(await f.request(`/rooms/${room.id}/greetings`, { method: 'POST', token: a.token, data: { recipientId: b.user.id } }), 201).greeting;
    const friend = ok(await f.request(`/greetings/${greeting.id}/accept`, { method: 'POST', token: b.token, data: { revision: greeting.revision } })).friend;
    ok(await f.request(`/friends/${a.user.id}`, { method: 'DELETE', token: b.token, data: { revision: friend.revision } }));
    ok(await f.leave(room, a)); ok(await f.leave(room, b)); ok(await f.close(room, a)); f.advance(DAY + 1); await f.restart();
    assert.equal((await f.get(exchange, a)).status, 'accepted'); assert.equal((await f.get(exchange, b)).status, 'accepted');
    for (const user of [a, b]) for (const photo of [offered, requested]) assert.equal((await f.request(imageUrl(exchange, photo), { token: user.token })).status, 200);
    assert.equal((await f.request(offered.imageUrl, { token: b.token })).status, 404); assert.equal((await f.request(requested.imageUrl, { token: a.token })).status, 404);
  });

  test(`${mode} exchanges: room ending prevents creation but pending acceptance uses its own 24-hour deadline`, async t => {
    for (const end of ['close', 'expire']) {
      const f = await fixture(t, mode), { a, b, room, offered, requested } = await f.two();
      f.advance(DAY - 60_000); const pending = ok(await f.send(room, a, b, offered, requested), 201).exchange;
      if (end === 'close') ok(await f.close(room, a)); else f.advance(60_001);
      assert.equal((await f.request(previewUrl(pending), { token: b.token })).status, 200);
      assert.equal((await f.send(room, a, b, offered, requested)).status, 409);
      assert.equal(ok(await f.respond(pending, 'accept', b)).exchange.status, 'accepted');
    }
  });

  test(`${mode} exchanges: pending expires exactly at 24 hours and cannot expose preview or become accepted`, async t => {
    const f = await fixture(t, mode), { a, b, room, offered, requested } = await f.two();
    const pending = ok(await f.send(room, a, b, offered, requested), 201).exchange;
    f.advance(DAY - 1); assert.equal((await f.get(pending, b)).status, 'pending'); assert.equal((await f.request(previewUrl(pending), { token: b.token })).status, 200);
    f.advance(1); const expired = await f.get(pending, b); assert.equal(expired.status, 'expired'); assert.equal(expired.endReason, 'expired'); assert.equal(expired.revision, pending.revision); assert.equal(expired.endedAt, pending.expiresAt);
    assert.equal((await f.request(previewUrl(pending), { token: b.token })).status, 404); assert.equal((await f.respond(pending, 'accept', b)).status, 409);
    await f.restart(); assert.equal((await f.get(pending, a)).status, 'expired'); assert.equal((await f.list(b)).exchanges[0].status, 'expired');
  });

  test(`${mode} exchanges: ordinary private sharing ends only touching pending offers and preserves accepted access`, async t => {
    const f = await fixture(t, mode), { a, b, room, offered, requested, exchange } = await f.accepted(), c = await f.session('C'); ok(await f.join(room, c));
    const cPhoto = await f.upload(room, c, 'members'), otherA = await f.upload(room, a), otherB = await f.upload(room, b, 'members'), sharedOffer = ok(await f.patch(offered, a, 'members')).photo;
    const touching = ok(await f.send(room, a, c, sharedOffer, cPhoto), 201).exchange, untouched = ok(await f.send(room, b, c, otherB, cPhoto), 201).exchange;
    ok(await f.patch(sharedOffer, a, 'private'));
    const ended = await f.get(touching, c); assert.equal(ended.status, 'cancelled'); assert.equal(ended.endReason, 'unavailable');
    assert.equal((await f.get(untouched, c)).status, 'pending'); assert.equal((await f.get(exchange, b)).status, 'accepted');
    assert.equal((await f.request(imageUrl(exchange, offered), { token: b.token })).status, 200); assert.equal((await f.request(previewUrl(touching), { token: c.token })).status, 404);
    const own = ok(await f.request('/photos', { token: a.token })).photos; assert.equal(own.find(p => p.id === offered.id).revision, 3); assert.equal(own.find(p => p.id === otherA.id).revision, 1);
  });

  test(`${mode} exchanges: withdrawal atomically makes a photo private, ends all touching grants and leaves unrelated photos intact`, async t => {
    const f = await fixture(t, mode), { a, b, room, offered, requested, exchange } = await f.accepted({ offeredVisibility: 'members' }), c = await f.session('C'); ok(await f.join(room, c));
    const cPhoto = await f.upload(room, c, 'members'), touching = ok(await f.send(room, a, c, offered, cPhoto), 201).exchange, untouched = ok(await f.send(room, b, c, requested, cPhoto), 201).exchange;
    assert.equal((await f.withdraw(offered, b)).status, 404); assert.equal((await f.withdraw(offered, a, { data: {} })).status, 400); assert.equal((await f.withdraw(offered, a, { data: { revision: 99 } })).status, 409);
    ok(await f.withdraw(offered, a));
    for (const [row, viewer, status] of [[exchange, b, 'revoked'], [touching, c, 'cancelled']]) { const ended = await f.get(row, viewer); assert.equal(ended.status, status); assert.equal(ended.endReason, 'unavailable'); assert.ok(ended.endedAt); }
    assert.equal((await f.get(untouched, c)).status, 'pending');
    const own = ok(await f.request('/photos', { token: a.token })).photos.find(p => p.id === offered.id); assert.equal(own.visibility, 'private'); assert.equal(own.revision, 2);
    assert.equal((await f.request(offered.imageUrl, { token: a.token })).status, 200);
    for (const user of [a, b]) assert.equal((await f.request(imageUrl(exchange, requested), { token: user.token })).status, 404);
    assert.equal((await f.request(previewUrl(touching), { token: c.token })).status, 404);
    assert.equal((await f.withdraw(offered, a)).status, 409);
  });

  test(`${mode} exchanges: deleting either source ends live exchanges without deleting the other participant photo`, async t => {
    for (const side of ['offered', 'requested']) {
      const f = await fixture(t, mode), pair = await f.accepted(), { a, b, exchange, offered, requested } = pair;
      const removed = pair[side], owner = side === 'offered' ? a : b, survivor = side === 'offered' ? requested : offered, survivorOwner = owner === a ? b : a;
      ok(await f.remove(removed, owner)); const ended = await f.get(exchange, survivorOwner); assert.equal(ended.status, 'revoked'); assert.equal(ended.endReason, 'unavailable');
      assert.equal((await f.request(imageUrl(exchange, survivor), { token: owner.token })).status, 404); assert.equal((await f.request(survivor.imageUrl, { token: survivorOwner.token })).status, 200);
      assert.equal((await f.request(removed.imageUrl, { token: owner.token })).status, 404);
    }
  });

  test(`${mode} exchanges: block terminates both rooms in both directions and unblock never resurrects receipts`, async t => {
    const f = await fixture(t, mode), { a, b, room, offered, requested, exchange } = await f.accepted(), other = await f.room(b); ok(await f.join(other, a));
    const otherA = await f.upload(other, a, 'members'), otherB = await f.upload(other, b), pending = ok(await f.send(other, b, a, otherB, otherA), 201).exchange;
    const block = ok(await f.block(b, a)).block;
    for (const user of [a, b]) for (const row of [exchange, pending]) { const ended = await f.get(row, user); assert.equal(ended.status, row === exchange ? 'revoked' : 'cancelled'); assert.equal(ended.endReason, 'unavailable'); assertReceipt(ended, user === a ? b : a); }
    assert.equal((await f.request(imageUrl(exchange, offered), { token: b.token })).status, 404); assert.equal((await f.request(previewUrl(pending), { token: a.token })).status, 404);
    assert.equal((await f.send(room, a, b, offered, requested)).status, 404); assert.equal((await f.send(other, b, a, otherB, otherA)).status, 404);
    ok(await f.unblock(b, a, block.revision)); await f.restart();
    assert.equal((await f.get(exchange, a)).status, 'revoked'); assert.equal((await f.get(pending, b)).status, 'cancelled'); assert.equal((await f.request(imageUrl(exchange, offered), { token: b.token })).status, 404);
    assert.equal((await f.send(room, a, b, offered, requested)).status, 201);
  });

  test(`${mode} exchanges: exact retries and restart preserve receipts while old acceptance never restores a revoked grant`, async t => {
    const f = await fixture(t, mode), { a, b, room, offered, requested } = await f.two(), sendKey = randomUUID(), acceptKey = randomUUID();
    const sends = await Promise.all([f.send(room, a, b, offered, requested, { key: sendKey }), f.send(room, a, b, offered, requested, { key: sendKey })]);
    assert.ok(sends.every(r => r.status === 201)); assert.deepEqual(sends[0].body, sends[1].body); const pending = sends[0].body.exchange;
    await f.restart(); const replay = await f.send(room, a, b, offered, requested, { key: sendKey }); ok(replay, 201); assert.deepEqual(replay.body, sends[0].body); assert.equal(replay.headers.get('Idempotency-Replayed'), 'true');
    const accepted = await f.respond(pending, 'accept', b, { key: acceptKey }); ok(accepted); await f.restart(); assert.equal((await f.request(imageUrl(pending, offered), { token: b.token })).status, 200);
    ok(await f.respond(accepted.body.exchange, 'revoke', a));
    const historical = await f.respond(pending, 'accept', b, { key: acceptKey }); ok(historical); assert.deepEqual(historical.body, accepted.body); assert.equal(historical.headers.get('Idempotency-Replayed'), 'true');
    assert.equal((await f.get(pending, b)).status, 'revoked'); assert.equal((await f.request(imageUrl(pending, offered), { token: b.token })).status, 404);
    const conflict = await f.respond(pending, 'cancel', a, { key: sendKey }); assert.equal(conflict.status, 409); assert.equal(conflict.body.error.code, 'IDEMPOTENCY_CONFLICT');
    assert.equal((await f.list(a)).exchanges.length, 1);
  });

  test(`${mode} exchanges: 24-row stable pages under tied timestamps use exact owned exchange IDs`, async t => {
    const f = await fixture(t, mode), { a, b, room, offered, requested } = await f.two(), outsider = await f.session('Outside'), records = [];
    for (let n = 0; n < 27; n++) { const exchange = ok(await f.send(room, a, b, offered, requested), 201).exchange; records.push(exchange); ok(await f.respond(exchange, 'cancel', a)); }
    const sorted = [...records].sort((x, y) => y.createdAt.localeCompare(x.createdAt) || y.id.localeCompare(x.id));
    const first = await f.list(a); assert.equal(first.exchanges.length, 24); assert.equal(first.nextCursor, first.exchanges[23].id); assert.deepEqual(first.exchanges.map(e => e.id), sorted.slice(0, 24).map(e => e.id));
    const second = await f.list(a, first.nextCursor); assert.equal(second.exchanges.length, 3); assert.equal(second.nextCursor, null); assert.deepEqual(second.exchanges.map(e => e.id), sorted.slice(24).map(e => e.id));
    assert.equal(new Set([...first.exchanges, ...second.exchanges].map(e => e.id)).size, 27);
    for (const cursor of ['oops', randomUUID(), a.user.id, room.id, offered.id]) assert.equal((await f.request('/exchanges?cursor=' + cursor, { token: a.token })).status, 400);
    for (const query of ['?cursor=', '?cursor', '?limit=100', '?other=1', `?cursor=${first.nextCursor}&cursor=${first.nextCursor}`, `?cursor=${first.nextCursor}&limit=24`]) assert.equal((await f.request('/exchanges' + query, { token: a.token })).status, 400, query);
    assert.equal((await f.request('/exchanges?cursor=' + first.nextCursor, { token: outsider.token })).status, 400);
    await f.restart(); assert.deepEqual((await f.list(b, first.nextCursor)).exchanges.map(e => e.id), second.exchanges.map(e => e.id));
  });

  test(`${mode} exchanges: request-time peer snapshots stay immutable after profile changes and blocking`, async t => {
    const f = await fixture(t, mode), { a, b, room, offered, requested } = await f.two(), pending = ok(await f.send(room, a, b, offered, requested), 201).exchange;
    const beforeA = (await f.get(pending, a)).peer, beforeB = (await f.get(pending, b)).peer;
    for (const user of [a, b]) ok(await f.request('/api/avatar/profile', { method: 'PUT', token: user.token, data: { revision: user.user.revision, name: 'Changed ' + user.user.name } }));
    assert.deepEqual((await f.get(pending, a)).peer, beforeA); assert.deepEqual((await f.get(pending, b)).peer, beforeB);
    ok(await f.block(a, b)); await f.restart();
    assert.deepEqual((await f.list(a)).exchanges[0].peer, beforeA); assert.deepEqual((await f.list(b)).exchanges[0].peer, beforeB);
    assert.equal((await f.get(pending, b)).endReason, 'unavailable');
  });

  test(`${mode} exchanges: either participant leaving cancels pending and rejoin cannot resurrect its preview`, async t => {
    for (const side of ['a', 'b']) {
      const f = await fixture(t, mode), pair = await f.two(), { a, b, room, offered, requested } = pair, pending = ok(await f.send(room, a, b, offered, requested), 201).exchange;
      ok(await f.leave(room, pair[side])); const ended = await f.get(pending, side === 'a' ? b : a); assert.equal(ended.status, 'cancelled'); assert.equal(ended.endReason, 'unavailable');
      ok(await f.join(room, pair[side])); assert.equal((await f.request(previewUrl(pending), { token: b.token })).status, 404); assert.equal((await f.respond(pending, 'accept', b)).status, 409);
    }
  });

  test(`${mode} exchanges: accepting a changed source revision fails even when it remains wall-visible`, async t => {
    for (const side of ['offered', 'requested']) {
      const f = await fixture(t, mode), pair = await f.two(), { a, b, room, offered, requested } = pair, pending = ok(await f.send(room, a, b, offered, requested), 201).exchange;
      ok(await f.patch(pair[side], side === 'offered' ? a : b, 'members'));
      assert.equal((await f.respond(pending, 'accept', b)).status, 409); assert.equal((await f.request(imageUrl(pending, offered), { token: b.token })).status, 404);
      const receipt = await f.get(pending, a); assert.equal(receipt.offeredRevision, 1); assert.equal(receipt.requestedRevision, 1);
    }
  });

  test(`${mode} exchanges: an expired receipt stays terminal while participants exchange in a fresh room`, async t => {
    const f = await fixture(t, mode), { a, b, room, offered, requested } = await f.two(), pending = ok(await f.send(room, a, b, offered, requested), 201).exchange;
    f.advance(DAY); const other = await f.room(a); ok(await f.join(other, b));
    const next = ok(await f.send(other, a, b, await f.upload(other, a), await f.upload(other, b, 'members')), 201).exchange;
    assert.notEqual(next.id, pending.id); assert.equal(next.status, 'pending'); assert.equal((await f.get(pending, b)).status, 'expired'); assert.equal((await f.list(a)).exchanges.length, 2);
  });

  test(`${mode} exchanges: explicit revoke is exchange-scoped while photo withdrawal ends every live use of its source`, async t => {
    const f = await fixture(t, mode), { a, b, room, offered, requested, exchange: first } = await f.accepted(), secondTarget = await f.upload(room, b, 'members');
    const next = ok(await f.send(room, a, b, offered, secondTarget), 201).exchange, second = ok(await f.respond(next, 'accept', b)).exchange;
    ok(await f.respond(first, 'revoke', a));
    for (const photo of [offered, requested]) assert.equal((await f.request(imageUrl(first, photo), { token: b.token })).status, 404);
    for (const photo of [offered, secondTarget]) assert.equal((await f.request(imageUrl(second, photo), { token: b.token })).status, 200);
    const replacement = ok(await f.send(room, a, b, offered, requested), 201).exchange, third = ok(await f.respond(replacement, 'accept', b)).exchange;
    ok(await f.withdraw(offered, a));
    for (const row of [second, third]) { const ended = await f.get(row, b); assert.equal(ended.status, 'revoked'); assert.equal(ended.endReason, 'unavailable'); assert.equal((await f.request(imageUrl(row, offered), { token: b.token })).status, 404); }
    assert.equal((await f.get(first, b)).endReason, 'revoked');
    assert.equal((await f.request(requested.imageUrl, { token: b.token })).status, 200); assert.equal((await f.request(secondTarget.imageUrl, { token: b.token })).status, 200);
  });
}

// Pause a real SQLite transaction after planning, before its guarded batch.
function pauseMutation(t, f, matches) {
  const batch = f.env.DB.batch.bind(f.env.DB); let armed = true, release, began;
  const waiting = new Promise(resolve => { release = resolve; }), started = new Promise(resolve => { began = resolve; });
  f.env.DB.batch = async statements => { if (armed && statements.some(s => matches(s.query))) { armed = false; began(); await waiting; } return batch(statements); };
  t.after(() => release()); return { started, release };
}
function pauseObject(t, f) {
  const get = f.env.PHOTOS.get.bind(f.env.PHOTOS); let armed = true, release, began;
  const waiting = new Promise(resolve => { release = resolve; }), started = new Promise(resolve => { began = resolve; });
  f.env.PHOTOS.get = async key => { const object = await get(key); if (armed) { armed = false; began(key); await waiting; } return object; };
  t.after(() => release()); return { started, release };
}
const exchangeInsert = sql => sql.startsWith('INSERT INTO event_exchanges');
const exchangeResponse = sql => sql.startsWith('UPDATE event_exchanges SET status = ?');
const privacyMutation = {
  block: (f, p) => f.block(p.a, p.b),
  withdraw: (f, p) => f.withdraw(p.offered, p.a),
  delete: (f, p) => f.remove(p.offered, p.a),
  private: (f, p) => f.patch(p.requested, p.b, 'private'),
  leave: (f, p) => f.leave(p.room, p.b),
};

for (const action of ['send', 'accept']) for (const change of Object.keys(privacyMutation)) {
  test(`Worker exchanges: ${change} commits during delayed ${action}, so its transaction grants nothing`, { timeout: 10_000 }, async t => {
    const f = await fixture(t), pair = await f.two(), { a, b, room, offered, requested } = pair;
    const pending = action === 'accept' ? ok(await f.send(room, a, b, offered, requested), 201).exchange : null;
    const barrier = pauseMutation(t, f, action === 'send' ? exchangeInsert : exchangeResponse);
    const delayed = action === 'send' ? f.send(room, a, b, offered, requested) : f.respond(pending, 'accept', b);
    await barrier.started; ok(await privacyMutation[change](f, pair)); barrier.release();
    assert.equal((await delayed).status, 409); assert.equal(f.env.DB.sql.prepare('SELECT COUNT(*) AS n FROM event_exchange_grants WHERE revoked_at IS NULL').get().n, 0);
    if (pending) { assert.equal((await f.get(pending, a)).status, 'cancelled'); assert.equal((await f.request(previewUrl(pending), { token: b.token })).status, 404); }
    else assert.equal((await f.list(a)).exchanges.length, 0);
  });
}

for (const change of ['block', 'withdraw', 'delete']) {
  test(`Worker exchanges: accept commits during delayed ${change}, then privacy transaction revokes both new grants`, { timeout: 10_000 }, async t => {
    const f = await fixture(t), pair = await f.two(), { a, b, room, offered, requested } = pair, pending = ok(await f.send(room, a, b, offered, requested), 201).exchange;
    const barrier = pauseMutation(t, f, sql => change === 'block' ? sql.startsWith('INSERT INTO event_social_blocks') : sql.startsWith('UPDATE event_photos SET'));
    const delayed = privacyMutation[change](f, pair); await barrier.started;
    ok(await f.respond(pending, 'accept', b)); barrier.release(); ok(await delayed);
    const ended = await f.get(pending, b); assert.equal(ended.status, 'revoked'); assert.equal(ended.endReason, 'unavailable'); assert.equal(ended.revision, 3);
    const grants = f.env.DB.sql.prepare('SELECT * FROM event_exchange_grants WHERE exchange_id=?').all(pending.id); assert.equal(grants.length, 2); assert.ok(grants.every(g => g.revoked_at));
    assert.equal((await f.request(imageUrl(pending, offered), { token: b.token })).status, 404);
  });

  test(`Worker exchanges: send commits during delayed ${change}, then privacy transaction cancels its new preview`, { timeout: 10_000 }, async t => {
    const f = await fixture(t), pair = await f.two(), { a, b, room, offered, requested } = pair;
    const barrier = pauseMutation(t, f, sql => change === 'block' ? sql.startsWith('INSERT INTO event_social_blocks') : sql.startsWith('UPDATE event_photos SET'));
    const delayed = privacyMutation[change](f, pair); await barrier.started;
    const pending = ok(await f.send(room, a, b, offered, requested), 201).exchange; barrier.release(); ok(await delayed);
    const ended = await f.get(pending, b); assert.equal(ended.status, 'cancelled'); assert.equal(ended.endReason, 'unavailable');
    assert.equal((await f.request(previewUrl(pending), { token: b.token })).status, 404); assert.equal((await f.respond(pending, 'accept', b)).status, 409);
  });
}

for (const change of ['leave', 'private']) {
  test(`Worker exchanges: accept commits during delayed ${change} and its granted originals remain readable`, { timeout: 10_000 }, async t => {
    const f = await fixture(t), pair = await f.two(), { a, b, room, offered, requested } = pair, pending = ok(await f.send(room, a, b, offered, requested), 201).exchange;
    const barrier = pauseMutation(t, f, sql => change === 'leave' ? sql.startsWith('UPDATE event_members SET left_at') : sql.startsWith('UPDATE event_photos SET'));
    const delayed = privacyMutation[change](f, pair); await barrier.started; ok(await f.respond(pending, 'accept', b)); barrier.release(); ok(await delayed);
    assert.equal((await f.get(pending, a)).status, 'accepted');
    const grants = f.env.DB.sql.prepare('SELECT * FROM event_exchange_grants WHERE exchange_id=?').all(pending.id); assert.equal(grants.length, 2); assert.ok(grants.every(g => g.revoked_at === null));
    for (const [user, photo] of [[a, requested], [b, offered]]) assert.equal((await f.request(imageUrl(pending, photo), { token: user.token })).status, 200);
  });
}

test('Worker exchanges: late source revision change prevents both grants in an already planned acceptance', { timeout: 10_000 }, async t => {
  const f = await fixture(t), { a, b, room, offered, requested } = await f.two(), pending = ok(await f.send(room, a, b, offered, requested), 201).exchange;
  const barrier = pauseMutation(t, f, exchangeResponse), delayed = f.respond(pending, 'accept', b); await barrier.started;
  ok(await f.patch(requested, b, 'members')); barrier.release(); assert.equal((await delayed).status, 409);
  assert.equal((await f.get(pending, a)).status, 'pending'); assert.equal(f.env.DB.sql.prepare('SELECT COUNT(*) AS n FROM event_exchange_grants').get().n, 0);
});

for (const winner of ['accept', 'cancel']) {
  test(`Worker exchanges: deterministic ${winner} wins over a delayed competing response`, { timeout: 10_000 }, async t => {
    const f = await fixture(t), { a, b, room, offered, requested } = await f.two(), pending = ok(await f.send(room, a, b, offered, requested), 201).exchange;
    const barrier = pauseMutation(t, f, exchangeResponse), delayed = winner === 'accept' ? f.respond(pending, 'cancel', a) : f.respond(pending, 'accept', b);
    await barrier.started; ok(await f.respond(pending, winner, winner === 'accept' ? b : a)); barrier.release(); assert.equal((await delayed).status, 409);
    assert.equal((await f.get(pending, a)).status, winner === 'accept' ? 'accepted' : 'cancelled');
    assert.equal(f.env.DB.sql.prepare('SELECT COUNT(*) AS n FROM event_exchange_grants WHERE exchange_id=? AND revoked_at IS NULL').get(pending.id).n, winner === 'accept' ? 2 : 0);
  });
}

test('Worker exchanges: room close during send is guarded, while close during accept preserves pending consent', { timeout: 10_000 }, async t => {
  for (const action of ['send', 'accept']) {
    const f = await fixture(t), { a, b, room, offered, requested } = await f.two(), pending = action === 'accept' ? ok(await f.send(room, a, b, offered, requested), 201).exchange : null;
    const barrier = pauseMutation(t, f, action === 'send' ? exchangeInsert : exchangeResponse), delayed = action === 'send' ? f.send(room, a, b, offered, requested) : f.respond(pending, 'accept', b);
    await barrier.started; ok(await f.close(room, a)); barrier.release(); assert.equal((await delayed).status, action === 'accept' ? 200 : 409);
  }
});

for (const change of ['block', 'withdraw', 'delete', 'revoke', 'key', 'owner', 'room']) {
  test(`Worker exchanges: accepted original rechecks ${change} after private object storage responds`, { timeout: 10_000 }, async t => {
    const f = await fixture(t), pair = await f.accepted(), { a, b, offered, exchange } = pair;
    const other = change === 'room' ? await f.room(a) : null;
    const barrier = pauseObject(t, f), reading = f.request(imageUrl(exchange, offered), { token: b.token }); const readKey = await barrier.started;
    if (change === 'revoke') ok(await f.respond(exchange, 'revoke', a));
    else if (change === 'key') f.env.DB.sql.prepare('UPDATE event_photos SET photo_key=? WHERE id=?').run(readKey + '-replacement', offered.id);
    else if (change === 'owner') f.env.DB.sql.prepare('UPDATE event_photos SET owner_id=? WHERE id=?').run(b.user.id, offered.id);
    else if (change === 'room') f.env.DB.sql.prepare('UPDATE event_photos SET room_id=? WHERE id=?').run(other.id, offered.id);
    else ok(await privacyMutation[change](f, pair));
    barrier.release(); const response = await reading; assert.equal(response.status, 404); assert.ok(response.body?.error); assert.notEqual(response.headers.get('Content-Type'), 'image/jpeg');
  });
}

for (const change of ['block', 'withdraw', 'delete', 'private', 'leave', 'accept', 'expiry', 'key']) {
  test(`Worker exchanges: pending preview rechecks ${change} after private object storage responds`, { timeout: 10_000 }, async t => {
    const f = await fixture(t), pair = await f.two(), { a, b, room, offered, requested } = pair, pending = ok(await f.send(room, a, b, offered, requested), 201).exchange;
    const barrier = pauseObject(t, f), reading = f.request(previewUrl(pending), { token: b.token }); const readKey = await barrier.started;
    if (change === 'accept') ok(await f.respond(pending, 'accept', b));
    else if (change === 'expiry') f.advance(DAY);
    else if (change === 'key') f.env.DB.sql.prepare('UPDATE event_exchanges SET preview_key=? WHERE id=?').run(readKey + '-replacement', pending.id);
    else ok(await privacyMutation[change](f, pair));
    barrier.release(); const response = await reading; assert.equal(response.status, 404); assert.ok(response.body?.error);
  });
}

test('Worker exchanges: acceptance writes exactly two directed grants and request preview is a separate private object', async t => {
  const f = await fixture(t), { a, b, offered, requested, exchange } = await f.accepted(), sql = f.env.DB.sql;
  const grants = sql.prepare('SELECT photo_id,owner_id,viewer_id,revoked_at FROM event_exchange_grants WHERE exchange_id=? ORDER BY photo_id').all(exchange.id);
  const actual = grants.map(g => ({ ...g })), expected = [{ photo_id: offered.id, owner_id: a.user.id, viewer_id: b.user.id, revoked_at: null }, { photo_id: requested.id, owner_id: b.user.id, viewer_id: a.user.id, revoked_at: null }].sort((x, y) => x.photo_id.localeCompare(y.photo_id));
  assert.deepEqual(actual, expected);
  const row = sql.prepare('SELECT * FROM event_exchanges WHERE id=?').get(exchange.id), photos = sql.prepare('SELECT photo_key FROM event_photos WHERE id IN (?,?)').all(offered.id, requested.id);
  assert.ok(photos.every(p => p.photo_key !== row.preview_key)); assert.ok(f.env.PHOTOS.blobs.has(row.preview_key));
  for (const receipt of sql.prepare('SELECT response FROM event_idempotency').all()) assert.ok(!receipt.response.includes(row.preview_key));
});

test('Worker exchanges: missing private preview or original object fails closed without falling back to another photo', async t => {
  const f = await fixture(t), { a, b, room, offered, requested } = await f.two(), pending = ok(await f.send(room, a, b, offered, requested), 201).exchange;
  const previewKey = f.env.DB.sql.prepare('SELECT preview_key FROM event_exchanges WHERE id=?').get(pending.id).preview_key;
  await f.env.PHOTOS.delete(previewKey); assert.equal((await f.request(previewUrl(pending), { token: b.token })).status, 503);
  const accepted = ok(await f.respond(pending, 'accept', b)).exchange, originalKey = f.env.DB.sql.prepare('SELECT photo_key FROM event_photos WHERE id=?').get(offered.id).photo_key;
  await f.env.PHOTOS.delete(originalKey); assert.equal((await f.request(imageUrl(accepted, offered), { token: b.token })).status, 503);
  assert.equal((await f.request(imageUrl(accepted, requested), { token: a.token })).status, 200);
});

test('Worker exchanges: failed global block rolls back social state and both exchange grants together', async t => {
  const f = await fixture(t), { a, b, room, offered, exchange } = await f.accepted(), key = randomUUID();
  const greeting = ok(await f.request(`/rooms/${room.id}/greetings`, { method: 'POST', token: a.token, data: { recipientId: b.user.id } }), 201).greeting;
  ok(await f.request(`/greetings/${greeting.id}/accept`, { method: 'POST', token: b.token, data: { revision: greeting.revision } }));
  const batch = f.env.DB.batch.bind(f.env.DB); let armed = true;
  f.env.DB.batch = async statements => { if (armed && statements.some(s => s.query.startsWith('INSERT INTO event_social_blocks'))) { armed = false; statements.push(f.env.DB.prepare('INSERT INTO event_mutation_guard (id,assertion) VALUES (?,0)').bind(randomUUID())); } return batch(statements); };
  assert.equal((await f.block(a, b, { key })).status, 409);
  assert.equal((await f.get(exchange, a)).status, 'accepted'); assert.equal((await f.request(imageUrl(exchange, offered), { token: b.token })).status, 200);
  const social = ok(await f.request('/social', { token: a.token })); assert.equal(social.friends.length, 1); assert.equal(social.blocks.length, 0);
  const retry = await f.block(a, b, { key }); ok(retry); assert.equal(retry.headers.get('Idempotency-Replayed'), null); assert.equal((await f.get(exchange, b)).status, 'revoked');
});

for (const action of ['send', 'accept', 'withdraw']) {
  test(`Worker exchanges: ${action} failure rolls back state, both grants and its idempotency receipt together`, async t => {
    const f = await fixture(t), { a, b, room, offered, requested } = await f.two(), key = randomUUID();
    const pending = action === 'send' ? null : ok(await f.send(room, a, b, offered, requested), 201).exchange;
    const accepted = action === 'withdraw' ? ok(await f.respond(pending, 'accept', b)).exchange : null;
    const batch = f.env.DB.batch.bind(f.env.DB); let armed = true;
    f.env.DB.batch = async statements => { if (armed && statements.some(s => action === 'send' ? exchangeInsert(s.query) : action === 'accept' ? exchangeResponse(s.query) : s.query.startsWith('UPDATE event_photos SET'))) { armed = false; statements.push(f.env.DB.prepare('INSERT INTO event_mutation_guard (id,assertion) VALUES (?,0)').bind(randomUUID())); } return batch(statements); };
    const perform = () => action === 'send' ? f.send(room, a, b, offered, requested, { key }) : action === 'accept' ? f.respond(pending, 'accept', b, { key }) : f.withdraw(offered, a, { key });
    assert.equal((await perform()).status, 409);
    if (action === 'send') assert.equal((await f.list(a)).exchanges.length, 0);
    else assert.equal((await f.get(pending, a)).status, action === 'accept' ? 'pending' : 'accepted');
    const grants = f.env.DB.sql.prepare('SELECT * FROM event_exchange_grants').all(); assert.equal(grants.length, action === 'withdraw' ? 2 : 0); assert.ok(grants.every(g => g.revoked_at === null));
    if (accepted) assert.equal((await f.request(imageUrl(accepted, offered), { token: b.token })).status, 200);
    const retry = await perform(); ok(retry, action === 'send' ? 201 : 200); assert.equal(retry.headers.get('Idempotency-Replayed'), null);
  });
}

for (const action of ['send', 'accept']) {
  test(`Worker exchanges: lost ${action} commit response with failed recovery read replays the durable exact result`, async t => {
    const f = await fixture(t), { a, b, room, offered, requested } = await f.two(), key = randomUUID(), pending = action === 'accept' ? ok(await f.send(room, a, b, offered, requested), 201).exchange : null;
    const batch = f.env.DB.batch.bind(f.env.DB); let armed = true;
    f.env.DB.batch = async statements => { const result = await batch(statements); if (armed && statements.some(s => action === 'send' ? exchangeInsert(s.query) : exchangeResponse(s.query))) { armed = false; f.env.DB.readFailures = 1; throw Error('Synthetic lost exchange response'); } return result; };
    const perform = () => action === 'send' ? f.send(room, a, b, offered, requested, { key }) : f.respond(pending, 'accept', b, { key });
    assert.equal((await perform()).status, 503); await f.restart(); const retry = await perform(); ok(retry, action === 'send' ? 201 : 200); assert.equal(retry.headers.get('Idempotency-Replayed'), 'true');
    assert.equal((await f.list(a)).exchanges.length, 1); assert.equal(f.env.DB.sql.prepare('SELECT COUNT(*) AS n FROM event_exchange_grants').get().n, action === 'accept' ? 2 : 0);
    const replayAgain = await perform(); assert.deepEqual(replayAgain.body, retry.body);
    assert.equal((await f.request(action === 'send' ? previewUrl(retry.body.exchange) : imageUrl(retry.body.exchange, offered), { token: b.token })).status, 200);
  });
}

test('Exchange additive migration preserves old identity, room, photo, friendship and composition records on repeated local starts', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'musicspace-exchange-upgrade-')), file = join(dir, 'upgrade.sqlite'); t.after(() => removeTempAfterTests(dir));
  const db = new DatabaseSync(file);
  for (const name of ['0000_known_colonel_america.sql', '0001_event_rooms.sql', '0002_event_social.sql', '0003_event_chat.sql']) db.exec(await readFile(new URL('../runtime-preview/drizzle/' + name, import.meta.url), 'utf8'));
  for (const id of ['old-a', 'old-b']) db.prepare('INSERT INTO avatar_users (id,name,avatar,token_hash,revision,created_at) VALUES (?,?,?,?,?,?)').run(id, 'Existing', '{}', id + '-opaque', 9, 'old-date');
  db.prepare('INSERT INTO event_rooms (id,code,host_id,title,venue,song_id,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?)').run('old-room', 'OLD', 'old-a', 'Existing show', '', 'late-train', 'old-date', 'later');
  db.prepare('INSERT INTO event_photos (id,room_id,owner_id,photo_key,visibility,revision,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').run('old-photo', 'old-room', 'old-a', 'old-private-key', 'private', 4, 'old-date', 'old-date');
  db.prepare('INSERT INTO avatar_compositions (id,host_id,snapshot,revision,content_revision,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').run('old-composition', 'old-a', '{}', 8, 7, 'old-date', 'old-date');
  db.prepare("INSERT INTO event_social_pairs (id,low_id,high_id,status,revision,greeting_id,sender_id,recipient_id,room_id,created_at,updated_at,friends_at) VALUES (?,?,?,'accepted',2,?,?,?,?,?,?,?)").run('old-friend', 'old-a', 'old-b', 'old-greeting', 'old-a', 'old-b', 'old-room', 'old-date', 'old-date', 'old-date');
  const tables = ['avatar_users', 'event_rooms', 'event_photos', 'event_social_pairs', 'avatar_compositions'], before = tables.map(table => db.prepare('SELECT * FROM ' + table).all()); db.close();
  for (let n = 0; n < 2; n++) { const store = createEventStore({ databasePath: file }); store.close(); }
  const read = new DatabaseSync(file); try {
    assert.deepEqual(tables.map(table => read.prepare('SELECT * FROM ' + table).all()), before);
    for (const table of ['event_exchanges', 'event_exchange_grants']) assert.equal(read.prepare('SELECT COUNT(*) AS n FROM ' + table).get().n, 0);
    assert.deepEqual(read.prepare('PRAGMA foreign_key_check').all(), []);
  } finally { read.close(); }
});

test('Worker exchanges: an expired pending slot can be reused in the same room without resurrecting the old receipt', async t => {
  const f = await fixture(t), { a, b, room, offered, requested } = await f.two(), pending = ok(await f.send(room, a, b, offered, requested), 201).exchange;
  // Rooms and requests both normally last24h. Extend only this synthetic room
  // to exercise replacement of an expired row under the same unique index.
  f.env.DB.sql.prepare('UPDATE event_rooms SET expires_at=? WHERE id=?').run(new Date(f.time + 2 * DAY).toISOString(), room.id);
  f.advance(DAY); const next = ok(await f.send(room, a, b, offered, requested), 201).exchange;
  assert.notEqual(next.id, pending.id); assert.equal(next.status, 'pending'); assert.equal((await f.get(pending, b)).status, 'expired');
  const oldRow = f.env.DB.sql.prepare('SELECT status,revision,end_reason FROM event_exchanges WHERE id=?').get(pending.id); assert.equal(oldRow.status, 'expired'); assert.equal(oldRow.revision, 2); assert.equal(oldRow.end_reason, 'expired');
  assert.equal((await f.request(previewUrl(pending), { token: b.token })).status, 404); assert.equal((await f.request(previewUrl(next), { token: b.token })).status, 200);
});

test('Worker exchanges: the persistent10/day participant-pair limit spans rooms and still permits exact receipt replay', async t => {
  const f = await fixture(t, 'Worker', { rateLimits: true }), { a, b, room, offered, requested } = await f.two(), key = randomUUID(); let first;
  for (let n = 0; n < 10; n++) {
    const response = await f.send(room, a, b, offered, requested, { key: n === 0 ? key : randomUUID() }), pending = ok(response, 201).exchange; if (!n) first = response;
    ok(await f.respond(pending, 'cancel', a));
    if (n === 4) f.advance(60_001);
  }
  await f.restart(); const other = await f.room(a); ok(await f.join(other, b)); const otherA = await f.upload(other, a), otherB = await f.upload(other, b, 'members');
  const denied = await f.send(other, a, b, otherA, otherB); assert.equal(denied.status, 429); assert.equal(denied.body.error.code, 'RATE_LIMITED'); assert.ok(+denied.headers.get('Retry-After') > 0);
  const replay = await f.send(room, a, b, offered, requested, { key }); ok(replay, 201); assert.equal(replay.headers.get('Idempotency-Replayed'), 'true'); assert.deepEqual(replay.body, first.body);
  assert.equal((await f.get(first.body.exchange, b)).status, 'cancelled'); assert.equal((await f.request(previewUrl(first.body.exchange), { token: b.token })).status, 404);
  f.advance(DAY + 1); const fresh = await f.room(a); ok(await f.join(fresh, b));
  assert.equal((await f.send(fresh, a, b, await f.upload(fresh, a), await f.upload(fresh, b, 'members'))).status, 201);
});

test('Worker exchanges: the persistent20/hour sender limit spans peers and allows exact replay without restoring grants', async t => {
  const f = await fixture(t, 'Worker', { rateLimits: true }), { a, b, room, offered, requested } = await f.two(), peers = [{ user: b, photo: requested }], key = randomUUID(); let first;
  for (const name of ['C', 'D']) { const user = await f.session(name); ok(await f.join(room, user)); peers.push({ user, photo: await f.upload(room, user, 'members') }); }
  for (let n = 0; n < 20; n++) {
    const peer = peers[n % peers.length], response = await f.send(room, a, peer.user, offered, peer.photo, { key: n === 0 ? key : randomUUID() }), pending = ok(response, 201).exchange; if (!n) first = response;
    ok(await f.respond(pending, 'cancel', a));
    // Keep this test below the independent40 writes/minute ceiling, so only
    // the dedicated20/hour exchange bucket determines the tested rejection.
    if (n % 5 === 4) f.advance(60_001);
  }
  await f.restart(); const denied = await f.send(room, a, peers[2].user, offered, peers[2].photo); assert.equal(denied.status, 429); assert.equal(denied.body.error.code, 'RATE_LIMITED'); assert.ok(+denied.headers.get('Retry-After') > 0 && +denied.headers.get('Retry-After') <= 3600);
  const replay = await f.send(room, a, b, offered, requested, { key }); ok(replay, 201); assert.equal(replay.headers.get('Idempotency-Replayed'), 'true'); assert.deepEqual(replay.body, first.body);
  assert.equal((await f.get(first.body.exchange, b)).status, 'cancelled'); assert.equal(f.env.DB.sql.prepare('SELECT COUNT(*) AS n FROM event_exchange_grants').get().n, 0);
  f.advance(60 * 60_000 + 1); assert.equal((await f.send(room, a, peers[2].user, offered, peers[2].photo)).status, 201);
});

for (const action of ['accept', 'decline', 'cancel']) {
  test(`Worker exchanges: delayed ${action} crossing pending expiry cannot commit after an expired canonical read`, { timeout: 10_000 }, async t => {
    const f = await fixture(t), { a, b, room, offered, requested } = await f.two(), pending = ok(await f.send(room, a, b, offered, requested), 201).exchange, key = randomUUID();
    f.advance(DAY - 1); const actor = action === 'cancel' ? a : b, before = f.env.DB.sql.prepare('SELECT COUNT(*) AS n FROM event_idempotency').get().n;
    assert.equal((await f.get(pending, b)).status, 'pending');
    const barrier = pauseMutation(t, f, exchangeResponse), delayed = f.respond(pending, action, actor, { key }); await barrier.started;
    f.advance(60_001); assert.equal((await f.get(pending, b)).status, 'expired'); barrier.release();
    const denied = await delayed; assert.equal(denied.status, 409); assert.equal(denied.headers.get('Idempotency-Replayed'), null);
    assert.equal(f.env.DB.sql.prepare('SELECT COUNT(*) AS n FROM event_exchange_grants').get().n, 0);
    assert.equal(f.env.DB.sql.prepare('SELECT COUNT(*) AS n FROM event_idempotency').get().n, before);
    assert.equal((await f.get(pending, a)).status, 'expired');
    assert.equal((await f.request(previewUrl(pending), { token: b.token })).status, 404); assert.equal((await f.request(imageUrl(pending, offered), { token: b.token })).status, 404);
    const retry = await f.respond(pending, action, actor, { key }); assert.equal(retry.status, 409); assert.equal(retry.headers.get('Idempotency-Replayed'), null);
  });

  test(`Worker exchanges: delayed ${action} released one millisecond before expiry still commits`, { timeout: 10_000 }, async t => {
    const f = await fixture(t), { a, b, room, offered, requested } = await f.two(), pending = ok(await f.send(room, a, b, offered, requested), 201).exchange;
    f.advance(DAY - 2); const barrier = pauseMutation(t, f, exchangeResponse), delayed = f.respond(pending, action, action === 'cancel' ? a : b); await barrier.started;
    f.advance(1); barrier.release();
    const result = ok(await delayed).exchange; assert.equal(result.status, { accept: 'accepted', decline: 'declined', cancel: 'cancelled' }[action]);
    assert.equal(f.env.DB.sql.prepare('SELECT COUNT(*) AS n FROM event_exchange_grants').get().n, action === 'accept' ? 2 : 0);
  });
}

function pausePreviewPut(t, f) {
  const put = f.env.PHOTOS.put.bind(f.env.PHOTOS); let armed = true, release, began;
  const waiting = new Promise(resolve => { release = resolve; }), started = new Promise(resolve => { began = resolve; });
  f.env.PHOTOS.put = async (key, bytes, options) => { const result = await put(key, bytes, options); if (armed && key.startsWith('event-exchanges/')) { armed = false; began(key); await waiting; } return result; };
  t.after(() => release()); return { started, release };
}

for (const pauseAt of ['preview put', 'database batch']) {
  test(`Worker exchanges: creation paused at ${pauseAt} across room expiry rolls back receipt and cleans its preview`, { timeout: 10_000 }, async t => {
    const f = await fixture(t), { a, b, room, offered, requested } = await f.two(), key = randomUUID(); f.advance(DAY - 1);
    const beforeReceipts = f.env.DB.sql.prepare('SELECT COUNT(*) AS n FROM event_idempotency').get().n, beforeObjects = [...f.env.PHOTOS.blobs.keys()].sort();
    const barrier = pauseAt === 'preview put' ? pausePreviewPut(t, f) : pauseMutation(t, f, exchangeInsert), delayed = f.send(room, a, b, offered, requested, { key }); await barrier.started;
    assert.equal(f.env.PHOTOS.blobs.size, beforeObjects.length + 1);
    f.advance(60_001); assert.equal(ok(await f.request('/preview/' + room.code)).preview.status, 'expired'); barrier.release();
    const denied = await delayed; assert.equal(denied.status, 409); assert.equal(denied.headers.get('Idempotency-Replayed'), null);
    assert.equal((await f.list(a)).exchanges.length, 0); assert.equal(f.env.DB.sql.prepare('SELECT COUNT(*) AS n FROM event_exchanges').get().n, 0);
    assert.equal(f.env.DB.sql.prepare('SELECT COUNT(*) AS n FROM event_idempotency').get().n, beforeReceipts); assert.deepEqual([...f.env.PHOTOS.blobs.keys()].sort(), beforeObjects);
    const retry = await f.send(room, a, b, offered, requested, { key }); assert.equal(retry.status, 409); assert.equal(retry.headers.get('Idempotency-Replayed'), null);
  });

  test(`Worker exchanges: creation paused at ${pauseAt} and released before room expiry still succeeds`, { timeout: 10_000 }, async t => {
    const f = await fixture(t), { a, b, room, offered, requested } = await f.two(); f.advance(DAY - 2);
    const barrier = pauseAt === 'preview put' ? pausePreviewPut(t, f) : pauseMutation(t, f, exchangeInsert), delayed = f.send(room, a, b, offered, requested); await barrier.started;
    f.advance(1); barrier.release(); const exchange = ok(await delayed, 201).exchange;
    assert.equal(exchange.status, 'pending'); assert.equal((await f.request(previewUrl(exchange), { token: b.token })).status, 200); assert.equal((await f.list(a)).exchanges.length, 1);
  });
}

test('Native SQLite exchange adapter evaluates its SQL clock when a prepared guarded batch executes', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'musicspace-exchange-sql-clock-')); let time = Date.parse('2026-09-30T10:00:00.000Z');
  const store = createEventStore({ dataDir: dir, clock: () => time }); t.after(async () => { store.close(); await removeTempAfterTests(dir); });
  const deadline = new Date(time + 1000).toISOString(), guard = id => store.DB.prepare("INSERT INTO event_mutation_guard (id,assertion) VALUES (?,CASE WHEN ? > strftime('%Y-%m-%dT%H:%M:%fZ','now') THEN 1 ELSE 0 END)").bind(id, deadline);
  const beforeDeadline = guard('before'), crossingDeadline = guard('after');
  time += 999; await store.DB.batch([beforeDeadline, store.DB.prepare('DELETE FROM event_mutation_guard WHERE id=?').bind('before')]);
  time += 1; await assert.rejects(store.DB.batch([crossingDeadline]), /CHECK constraint|event_mutation_guard_assertion/);
  const observed = await store.DB.prepare("SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now') AS observed").first(); assert.equal(observed.observed, deadline);
  assert.equal((await store.DB.prepare('SELECT COUNT(*) AS n FROM event_mutation_guard').first()).n, 0);
});
