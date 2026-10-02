import { randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { sanitizeAvatarJpeg } from './avatar-worker.js';
import { socialAllowedSQL } from './event-social.js';

const ID = '[0-9a-f-]{36}';
const DAY = 24 * 60 * 60_000;
const PAGE_SIZE = 24;
// SQLite/D1 evaluates this when the guarded statement executes, after any
// storage or batch delay. A bound JS timestamp can resurrect an expired offer.
const DB_NOW = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";
const validID = value => typeof value === 'string' && new RegExp(`^${ID}$`).test(value);
const combine = (...guards) => ({ sql: guards.map(g => `(${g.sql})`).join(' AND '), args: guards.flatMap(g => g.args) });

/** Append these statements to the caller's existing privacy transaction. Matching
 * is evaluated in the batch, so an accept that just committed is revoked too.
 * Predicates are trusted code, never request-supplied SQL. */
export function endEventExchanges(stmt, timestamp, predicate, args, { pendingOnly = false } = {}) {
  return [
    ...(!pendingOnly ? [stmt(`UPDATE event_exchange_grants SET revoked_at = ? WHERE revoked_at IS NULL AND exchange_id IN
      (SELECT id FROM event_exchanges WHERE status = 'accepted' AND (${predicate}))`, timestamp, ...args)] : []),
    stmt(`UPDATE event_exchanges SET status = CASE WHEN status = 'pending' THEN 'cancelled' ELSE 'revoked' END,
      end_reason = 'unavailable', ended_at = ?, updated_at = ?, revision = revision + 1
      WHERE status IN (${pendingOnly ? "'pending'" : "'pending','accepted'"}) AND (${predicate})`, timestamp, timestamp, ...args),
  ];
}

// No decoder or claimed correspondence to the original: this validates the
// sender-provided bounded JPEG, strips metadata, and checks its declared SOF.
function previewBytes(dataUrl, fail) {
  if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/jpeg;base64,') && Buffer.byteLength(dataUrl.slice(23), 'base64') > 32 * 1024) {
    fail(413, 'PREVIEW_TOO_LARGE', '预览图请压缩至 32 KiB 以内。');
  }
  let bytes;
  try { bytes = sanitizeAvatarJpeg(dataUrl); } catch (error) { if (error.status) fail(error.status, error.code, error.message); throw error; }
  let offset = 2;
  while (offset < bytes.length) {
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++], length = bytes.readUInt16BE(offset);
    if (marker === 0xc0 || marker === 0xc2) {
      if (bytes.readUInt16BE(offset + 3) > 320 || bytes.readUInt16BE(offset + 5) > 320) fail(400, 'INVALID_PREVIEW', '预览图每边最多 320 像素。');
      return bytes;
    }
    offset += length;
  }
  fail(400, 'INVALID_PREVIEW', '请提供有效的 JPEG 预览图。');
}

/** Directed grants use the existing identity, idempotency and transaction
 * machinery. Wall sharing, friendship and recap remain independent gates. */
export async function handleEventExchanges(c) {
  const { request, path, method, user, db, stmt, get, now, clock, rate, mutate, readJSON, keys, revision, fail, json, env, headers } = c;
  const create = new RegExp(`^/rooms/(${ID})/exchanges$`).exec(path);
  const route = new RegExp(`^/exchanges/(${ID})(?:/(preview|accept|decline|cancel|revoke)|/photos/(${ID})/image)?$`).exec(path);
  if (path !== '/exchanges' && !create && !route) return null;
  const unblocked = (sender, recipient) => ({ sql: socialAllowedSQL('?', '?'), args: [sender, recipient, recipient, sender] });
  const sources = row => ({ sql: `EXISTS (SELECT 1 FROM event_rooms WHERE id = ?) AND
    EXISTS (SELECT 1 FROM event_photos WHERE id = ? AND room_id = ? AND owner_id = ? AND deleted_at IS NULL AND photo_key IS NOT NULL) AND
    EXISTS (SELECT 1 FROM event_photos WHERE id = ? AND room_id = ? AND owner_id = ? AND deleted_at IS NULL AND photo_key IS NOT NULL)`,
    args: [row.room_id, row.offered_photo_id, row.room_id, row.sender_id, row.requested_photo_id, row.room_id, row.recipient_id] });
  const members = row => ({ sql: `EXISTS (SELECT 1 FROM event_members WHERE room_id = ? AND user_id = ? AND left_at IS NULL) AND
    EXISTS (SELECT 1 FROM event_members WHERE room_id = ? AND user_id = ? AND left_at IS NULL)`, args: [row.room_id, row.sender_id, row.room_id, row.recipient_id] });
  const sourceRevisions = row => ({ sql: `EXISTS (SELECT 1 FROM event_photos WHERE id = ? AND revision = ?) AND
    EXISTS (SELECT 1 FROM event_photos WHERE id = ? AND revision = ? AND visibility = 'members')`, args: [row.offered_photo_id, row.offered_revision, row.requested_photo_id, row.requested_revision] });
  const pending = row => combine(sources(row), members(row), unblocked(row.sender_id, row.recipient_id), {
    sql: `EXISTS (SELECT 1 FROM event_exchanges WHERE id = ? AND revision = ? AND status = 'pending' AND expires_at > ${DB_NOW})`, args: [row.id, row.revision],
  });
  const participantRow = id => get(`SELECT *,${DB_NOW} AS observed_at FROM event_exchanges WHERE id = ? AND (sender_id = ? OR recipient_id = ?)`, id, user.id, user.id);
  function found(row) { if (!row) fail(404, 'EXCHANGE_NOT_FOUND', '交换不存在，或当前身份无权查看。'); return row; }
  const satisfies = guard => get(`SELECT 1 AS ok WHERE ${guard.sql}`, ...guard.args);
  const exchangeJSON = row => {
    const expired = row.status === 'pending' && row.expires_at <= (row.observed_at || now());
    return { id: row.id, roomId: row.room_id, senderId: row.sender_id, recipientId: row.recipient_id,
      offeredPhotoId: row.offered_photo_id, requestedPhotoId: row.requested_photo_id,
      offeredRevision: row.offered_revision, requestedRevision: row.requested_revision,
      status: expired ? 'expired' : row.status, revision: row.revision, createdAt: row.created_at, updatedAt: expired ? row.expires_at : row.updated_at,
      expiresAt: row.expires_at, acceptedAt: row.accepted_at, endedAt: expired ? row.expires_at : row.ended_at,
      endReason: expired ? 'expired' : row.end_reason, peer: JSON.parse(row.sender_id === user.id ? row.recipient_profile : row.sender_profile) };
  };

  if (method === 'GET' && path === '/exchanges') {
    const query = [...new URL(request.url).searchParams];
    if (query.length > 1 || query.some(([key, value]) => key !== 'cursor' || !validID(value))) fail(400, 'INVALID_CURSOR', '请提供一个有效的分页位置。');
    const cursor = query[0]?.[1];
    const last = cursor && await participantRow(cursor);
    if (cursor && !last) fail(400, 'INVALID_CURSOR', '分页位置不属于当前身份。');
    const rows = (await stmt(`SELECT *,${DB_NOW} AS observed_at FROM event_exchanges WHERE (sender_id = ? OR recipient_id = ?)${last ? ' AND (created_at < ? OR (created_at = ? AND id < ?))' : ''}
      ORDER BY created_at DESC,id DESC LIMIT 25`, user.id, user.id, ...(last ? [last.created_at, last.created_at, last.id] : [])).all()).results;
    return json(200, { actorId: user.id, exchanges: rows.slice(0, PAGE_SIZE).map(exchangeJSON), nextCursor: rows.length > PAGE_SIZE ? rows[PAGE_SIZE - 1].id : null });
  }

  if (method === 'POST' && create) {
    const data = await readJSON(request);
    keys(data, ['recipientId', 'offeredPhotoId', 'requestedPhotoId', 'offeredRevision', 'requestedRevision', 'offerPreviewConsent', 'offerOriginalConsent', 'offeredPreviewDataUrl']);
    if (![data.recipientId, data.offeredPhotoId, data.requestedPhotoId].every(validID)) fail(400, 'INVALID_INPUT', '成员或照片编号无效。');
    if (data.recipientId === user.id) fail(400, 'SELF_INTERACTION', '不能与自己交换照片。');
    if (data.offeredPhotoId === data.requestedPhotoId) fail(400, 'INVALID_INPUT', '请选择双方各自的一张照片。');
    if (data.offerPreviewConsent !== true) fail(400, 'PREVIEW_CONSENT_REQUIRED', '请确认向这位成员展示这张照片的限尺寸预览。');
    if (data.offerOriginalConsent !== true) fail(400, 'OFFER_CONSENT_REQUIRED', '请确认对方接受后可以在线查看这张指定照片的原图。');
    return mutate(data, async () => {
      const timestamp = now(), [low, high] = [user.id, data.recipientId].sort(), [lowPhoto, highPhoto] = [data.offeredPhotoId, data.requestedPhotoId].sort();
      const row = { id: randomUUID(), room_id: create[1], sender_id: user.id, recipient_id: data.recipientId,
        offered_photo_id: data.offeredPhotoId, requested_photo_id: data.requestedPhotoId, offered_revision: data.offeredRevision, requested_revision: data.requestedRevision,
        low_id: low, high_id: high, low_photo_id: lowPhoto, high_photo_id: highPhoto,
        status: 'pending', revision: 1, created_at: timestamp, updated_at: timestamp, expires_at: new Date(clock() + DAY).toISOString(), accepted_at: null, ended_at: null, end_reason: null };
      const participants = combine(sources(row), members(row), unblocked(row.sender_id, row.recipient_id));
      if (!await satisfies(participants)) fail(404, 'EXCHANGE_UNAVAILABLE', '请在同一场未结束的现场选择双方的照片。');
      const open = { sql: `EXISTS (SELECT 1 FROM event_rooms WHERE id = ? AND closed_at IS NULL AND expires_at > ${DB_NOW}) AND ? > ${DB_NOW}`, args: [row.room_id, row.expires_at] };
      if (!await satisfies(open)) fail(409, 'ROOM_CLOSED', '此现场已结束，不能发起新的交换。');
      const availability = combine(participants, open);
      const offered = await get('SELECT revision FROM event_photos WHERE id = ?', row.offered_photo_id);
      const requested = await get('SELECT revision,visibility FROM event_photos WHERE id = ?', row.requested_photo_id);
      revision(offered, data.offeredRevision); revision(requested, data.requestedRevision);
      if (requested.visibility !== 'members') fail(404, 'EXCHANGE_UNAVAILABLE', '这张照片当前未在本场展示。');
      const noDuplicate = { sql: `NOT EXISTS (SELECT 1 FROM event_exchanges WHERE room_id = ? AND low_id = ? AND high_id = ? AND status = 'pending' AND expires_at > ${DB_NOW}) AND
        NOT EXISTS (SELECT 1 FROM event_exchanges WHERE low_photo_id = ? AND high_photo_id = ? AND (status = 'accepted' OR (status = 'pending' AND expires_at > ${DB_NOW})))`,
        args: [row.room_id, low, high, lowPhoto, highPhoto] };
      if (!await satisfies(noDuplicate)) fail(409, 'EXCHANGE_EXISTS', '已有待回应的交换或这两张照片的有效交换。');
      const bytes = previewBytes(data.offeredPreviewDataUrl, fail);
      await rate(`exchange:${user.id}`, 20, 60 * 60_000);
      await rate(`exchange-pair:${low}:${high}`, 10, DAY);
      const profiles = (await stmt('SELECT id,name,avatar FROM avatar_users WHERE id IN (?,?)', user.id, data.recipientId).all()).results;
      for (const [field, id] of [['sender_profile', user.id], ['recipient_profile', data.recipientId]]) {
        const profile = profiles.find(p => p.id === id);
        row[field] = JSON.stringify({ id: profile.id, name: profile.name, avatar: JSON.parse(profile.avatar) });
      }
      if (!env.PHOTOS?.put) fail(503, 'PHOTO_SERVICE_UNAVAILABLE', '预览图服务暂时不可用。');
      const objectKey = `event-exchanges/${row.id}/${randomUUID()}.jpg`;
      await env.PHOTOS.put(objectKey, bytes, { httpMetadata: { contentType: 'image/jpeg' } });
      return { status: 201, body: { exchange: exchangeJSON(row) }, uploadedKey: objectKey,
        guard: combine(availability, sourceRevisions(row), noDuplicate), statements: [
          // Logical expiration is enforced on every access; materializing it here
          // only releases the pending uniqueness slot for a fresh request.
          stmt(`UPDATE event_exchanges SET status = 'expired',end_reason = 'expired',ended_at = expires_at,updated_at = expires_at,revision = revision + 1
            WHERE room_id = ? AND low_id = ? AND high_id = ? AND status = 'pending' AND expires_at <= ${DB_NOW}`, row.room_id, low, high),
          stmt(`INSERT INTO event_exchanges (id,room_id,sender_id,recipient_id,offered_photo_id,requested_photo_id,offered_revision,requested_revision,
            low_id,high_id,low_photo_id,high_photo_id,sender_profile,recipient_profile,preview_key,status,revision,created_at,updated_at,expires_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending',1,?,?,?)`, row.id, row.room_id, row.sender_id, row.recipient_id, row.offered_photo_id, row.requested_photo_id,
            row.offered_revision, row.requested_revision, low, high, lowPhoto, highPhoto, row.sender_profile, row.recipient_profile, objectKey, timestamp, timestamp, row.expires_at),
        ] };
    });
  }

  if (!route) return null;
  const id = route[1], action = route[2], photoId = route[3];
  if (method === 'GET' && !action && !photoId) return json(200, { actorId: user.id, exchange: exchangeJSON(found(await participantRow(id))) });

  async function readableObject() {
    const row = await participantRow(id);
    if (!row) return null;
    if (action === 'preview') {
      if (!await satisfies(pending(row))) return null;
      return { key: row.preview_key };
    }
    if (![row.offered_photo_id, row.requested_photo_id].includes(photoId) || row.status !== 'accepted' || !await satisfies(combine(sources(row), unblocked(row.sender_id, row.recipient_id)))) return null;
    // Each accepted exchange stores two explicit owner -> viewer grants. Owners
    // can read the same fixed pair here; no other photo is authorized.
    const photo = await get(`SELECT p.photo_key FROM event_exchange_grants g JOIN event_photos p ON p.id = g.photo_id
      WHERE g.exchange_id = ? AND g.photo_id = ? AND (g.viewer_id = ? OR g.owner_id = ?) AND g.owner_id = p.owner_id AND g.revoked_at IS NULL
      AND p.deleted_at IS NULL AND p.room_id = ?`, id, photoId, user.id, user.id, row.room_id);
    return photo && { key: photo.photo_key };
  }
  if (method === 'GET' && (action === 'preview' || photoId)) {
    const readable = await readableObject();
    if (!readable) fail(404, 'PHOTO_NOT_FOUND', '照片不存在，或当前身份无权查看。');
    if (!env.PHOTOS?.get) fail(503, 'PHOTO_SERVICE_UNAVAILABLE', '照片暂时无法读取。');
    const object = await env.PHOTOS.get(readable.key);
    if (!object) fail(503, 'PHOTO_SERVICE_UNAVAILABLE', '照片暂时无法读取。');
    const current = await readableObject();
    if (!current || current.key !== readable.key) { await object.body?.cancel?.(); fail(404, 'PHOTO_NOT_FOUND', '照片已不可用，请重新读取。'); }
    return new Response(object.body, { headers: { ...headers, 'Content-Type': 'image/jpeg' } });
  }

  if (method === 'POST' && ['accept', 'decline', 'cancel', 'revoke'].includes(action)) {
    const data = await readJSON(request); keys(data, action === 'accept' ? ['revision', 'exchangeConsent'] : ['revision']);
    if (action === 'accept' && data.exchangeConsent !== true) fail(400, 'EXCHANGE_CONSENT_REQUIRED', '请确认双方在线查看这两张指定照片。');
    return mutate(data, async () => {
      const row = found(await participantRow(id));
      if (action !== 'revoke' && (action === 'cancel' ? row.sender_id !== user.id : row.recipient_id !== user.id)) fail(403, 'EXCHANGE_ROLE_REQUIRED', '只有本人可以回应或撤回这项交换。');
      revision(row, data.revision);
      if (row.status !== (action === 'revoke' ? 'accepted' : 'pending') || (row.status === 'pending' && row.expires_at <= row.observed_at)) fail(409, 'EXCHANGE_RESOLVED', '这项交换已结束，请刷新状态。');
      const guard = action === 'revoke' ? { sql: "EXISTS (SELECT 1 FROM event_exchanges WHERE id = ? AND revision = ? AND status = 'accepted')", args: [id, row.revision] }
        : combine(pending(row), ...(action === 'accept' ? [sourceRevisions(row)] : []));
      if (!await satisfies(guard)) fail(409, 'EXCHANGE_UNAVAILABLE', '交换条件已变化，请刷新状态。');
      const timestamp = now(), status = { accept: 'accepted', decline: 'declined', cancel: 'cancelled', revoke: 'revoked' }[action];
      const updated = { ...row, status, revision: row.revision + 1, updated_at: timestamp,
        accepted_at: action === 'accept' ? timestamp : row.accepted_at, ended_at: action === 'accept' ? null : timestamp, end_reason: action === 'accept' ? null : status };
      return { body: { exchange: exchangeJSON(updated) }, guard, statements: [
        stmt('UPDATE event_exchanges SET status = ?,revision = revision + 1,updated_at = ?,accepted_at = ?,ended_at = ?,end_reason = ? WHERE id = ? AND revision = ?',
          status, timestamp, updated.accepted_at, updated.ended_at, updated.end_reason, id, row.revision),
        ...(action === 'accept' ? [[row.offered_photo_id, row.sender_id, row.recipient_id], [row.requested_photo_id, row.recipient_id, row.sender_id]].map(([photo, owner, viewer]) =>
          stmt('INSERT INTO event_exchange_grants (exchange_id,photo_id,owner_id,viewer_id,created_at,revoked_at) VALUES (?,?,?,?,?,NULL)', id, photo, owner, viewer, timestamp)) : []),
        ...(action === 'revoke' ? [stmt('UPDATE event_exchange_grants SET revoked_at = ? WHERE exchange_id = ? AND revoked_at IS NULL', timestamp, id)] : []),
      ] };
    });
  }
  return null;
}
