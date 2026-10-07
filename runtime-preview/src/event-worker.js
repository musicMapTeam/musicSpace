import {admissionRoute} from './admission-protocol.js';
import {handleEventCorners} from './event-corners.js';
import {handleMusicTopics} from './event-music-topics.js';
import {handleEventGames} from './event-games.js';
import {handleEventCommunity} from './event-community.js';
import {handleEventSpaces} from './event-spaces.js';
import {handleEventWorldCup} from './event-worldcup.js';
import {handleEventParticipation,participationMode} from './event-participation.js';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { sanitizeAvatarJpeg } from './avatar-worker.js';
import { handleEventSocial, socialAllowedSQL } from './event-social.js';
import { handleEventChat } from './event-chat.js';
import { handleEventRecap } from './event-recap.js';
import { handleEventExchanges, endEventExchanges } from './event-exchanges.js';
import { handleEventModeration } from './event-moderation.js';

// Event rooms are independent of avatar compositions, but reuse their identity.
// D1 authorizes every image read; R2 object keys are never returned to clients.
export const EVENT_API_PREFIX = '/api/event';
export const EVENT_CAPACITY = 24;
export const EVENT_PHOTO_LIMIT = 6;
const DAY = 24 * 60 * 60 * 1000;
const SONGS = ['late-train', 'moon-window', 'sakura-echo'];
const VIEWPOINTS = ['stage', 'crowd', 'friends', 'detail'];
const TAKEN_MIN = Date.UTC(2000, 0, 1);
const ID = '[0-9a-f-]{36}';
const CODE = '[A-Z2-7]{12}';
const hash = value => createHash('sha256').update(value).digest('hex');
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
const json = (status, data, extra = {}) => new Response(JSON.stringify(data), { status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8', ...extra } });
class EventError extends Error { constructor(status, code, message, extra = {}) { super(message); Object.assign(this, { status, code, ...extra }); } }
const fail = (status, code, message, extra) => { throw new EventError(status, code, message, extra); };
function keys(data, allowed) { if (Object.keys(data).some(key => !allowed.includes(key))) fail(400, 'INVALID_INPUT', '提交内容包含不支持的字段。'); }
function label(value, field, optional = false) {
  if (optional && value === undefined) return '';
  if (typeof value !== 'string' || [...value.trim()].length > 40 || /[\p{Cc}\u2028\u2029\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/u.test(value) || (!optional && !value.trim())) fail(400, 'INVALID_INPUT', `${field}请填写不超过 40 个字的单行文字。`);
  return value.trim();
}
function revision(row, value) {
  if (!Number.isInteger(value) || value < 1) fail(400, 'REVISION_REQUIRED', '请提交当前版本。');
  if (row.revision !== value) fail(409, 'REVISION_CONFLICT', '内容已更新，请刷新后重试。', { currentRevision: row.revision });
}
/** The photo facts behind 「同一刻，另一面」: both halves of each pair or neither. Time: camera (exif) or person (manual), 2000-01-01 .. tomorrow. */
function photoMoment(data, nowMs) {
  const at = data.takenAt ?? null, source = data.takenSource ?? null, view = data.viewpoint ?? null, viewSource = data.viewpointSource ?? null;
  if ((at === null) !== (source === null)) fail(400, 'INVALID_INPUT', '拍摄时间需要同时提供时间和来源。');
  if (at !== null && (!Number.isSafeInteger(at) || at < TAKEN_MIN || at > nowMs + DAY)) fail(400, 'INVALID_TAKEN_AT', '拍摄时间需在 2000 年至明天之间。');
  if (source !== null && !['exif', 'manual'].includes(source)) fail(400, 'INVALID_TAKEN_SOURCE', '拍摄时间只能来自照片自带信息或本人填写。');
  if ((view === null) !== (viewSource === null)) fail(400, 'INVALID_INPUT', '视角需要同时提供选择和来源。');
  if (view !== null && !VIEWPOINTS.includes(view)) fail(400, 'INVALID_VIEWPOINT', '视角只能是舞台、人海、身边或细节。');
  if (viewSource !== null && !['ai', 'manual'].includes(viewSource)) fail(400, 'INVALID_VIEWPOINT_SOURCE', '视角来源无效。');
  return { takenAt: at, takenSource: source, viewpoint: view, viewpointSource: viewSource };
}
function visibility(value) { if (!['private', 'members'].includes(value)) fail(400, 'VISIBILITY_REQUIRED', '请明确选择仅自己可见或向本场成员展示。'); return value; }
function consent(data) { if (data.joinConsent !== true) fail(400, 'JOIN_CONSENT_REQUIRED', '请先勾选同意，再进入现场。'); }
function code() { const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; return [...randomBytes(12)].map(value => alphabet[value & 31]).join(''); }
async function readJSON(request) {
  if (request.headers.get('Content-Encoding') && request.headers.get('Content-Encoding') !== 'identity') fail(415, 'ENCODING_UNSUPPORTED', '请提交未压缩的 JSON。');
  const maximum = 420 * 1024;
  if (Number(request.headers.get('Content-Length') || 0) > maximum) fail(413, 'BODY_TOO_LARGE', '提交内容过大。');
  if (!request.body) return {};
  const reader = request.body.getReader(), chunks = []; let length = 0;
  try { for (;;) { const { done, value } = await reader.read(); if (done) break; length += value.byteLength; if (length > maximum) { await reader.cancel(); fail(413, 'BODY_TOO_LARGE', '提交内容过大。'); } chunks.push(Buffer.from(value)); } } finally { reader.releaseLock(); }
  if (!length) return {};
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type') || '')) fail(415, 'JSON_REQUIRED', '请使用 JSON 提交。');
  let data; try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { fail(400, 'INVALID_JSON', '提交内容不是有效的 JSON。'); }
  if (!plain(data)) fail(400, 'INVALID_JSON', '提交内容应为 JSON 对象。');
  return data;
}

/** Returns null for routes outside /api/event, never falls back to ASSETS. */
export function createEventWorker({ clock = Date.now, rateLimits = true } = {}) {
  return { async fetch(request, env) {
    const pathname = new URL(request.url).pathname;
    if (pathname !== EVENT_API_PREFIX && !pathname.startsWith(`${EVENT_API_PREFIX}/`)) return null;
    try {
      if (request.headers.get('Sec-Fetch-Site') === 'cross-site') fail(403, 'ORIGIN_DENIED', '请从 Music Space 页面打开。');
      if (!env.DB?.prepare || !env.DB?.batch) fail(503, 'SERVICE_UNAVAILABLE', '现场服务暂时不可用，请稍后重试。');
      const db = env.DB; // D1 primary binding; no read-replica opt-in for permission checks.
      const stmt = (sql, ...args) => db.prepare(sql).bind(...args);
      const get = (sql, ...args) => stmt(sql, ...args).first();
      const all = async (sql, ...args) => (await stmt(sql, ...args).all()).results;
      const now = () => new Date(clock()).toISOString();
      const method = request.method, path = admissionRoute(pathname.slice(EVENT_API_PREFIX.length), method);
      const roomJSON = (room, actorId, joined = true) => ({ id: room.id, code: room.code, title: room.title, venue: room.venue, songId: room.song_id,
        status: room.closed_at ? 'closed' : room.expires_at <= now() ? 'expired' : 'open', revision: room.revision,
        createdAt: room.created_at, expiresAt: room.expires_at, capacity: EVENT_CAPACITY, ...(actorId ? { role: room.host_id === actorId ? 'host' : 'member', joined, entryState:room.is_excluded?'removed':joined?'joined':'left' } : {}) });
      const photoJSON = photo => ({ id: photo.id, roomId: photo.room_id, ownerId: photo.owner_id, visibility: photo.visibility,
        revision: photo.revision, createdAt: photo.created_at, updatedAt: photo.updated_at,
        takenAt: photo.taken_at ?? null, takenSource: photo.taken_source ?? null, viewpoint: photo.viewpoint ?? null, viewpointSource: photo.viewpoint_source ?? null, imageUrl: `${EVENT_API_PREFIX}/photos/${photo.id}/image` });
      async function rate(key, maximum, period = 60_000) {
        if (!rateLimits) return;
        const time = clock(), opaque = hash(key);
        const result = await db.batch([
          stmt('DELETE FROM event_rate_limits WHERE key IN (SELECT key FROM event_rate_limits WHERE reset_at <= ? LIMIT 100)', time),
          stmt('INSERT INTO event_rate_limits (key,count,reset_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count = CASE WHEN reset_at <= ? THEN 1 ELSE count + 1 END, reset_at = CASE WHEN reset_at <= ? THEN ? ELSE reset_at END', opaque, time + period, time, time, time + period),
          stmt('SELECT count,reset_at FROM event_rate_limits WHERE key = ?', opaque),
        ]);
        const entry = result[2].results[0];
        if (entry.count > maximum) fail(429, 'RATE_LIMITED', '操作有些频繁，请稍后重试。', { retryAfter: Math.max(1, Math.ceil((entry.reset_at - time) / 1000)) });
      }
      // 24 shared-NAT attendees: roster/social polling plus one explicit24-image
      // gallery per person and setup/preview requests. Per-user limits stay lower.
      await rate(`ip:${request.headers.get('CF-Connecting-IP') || env.EVENT_CLIENT_IP || 'unknown'}`, 1800);
      if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(method)) fail(405, 'METHOD_NOT_ALLOWED', '不支持这个操作。');
      if (method === 'GET' && path === '/health') { await get('SELECT id FROM event_rooms LIMIT 1'); return json(200, { ok: true, capacity: EVENT_CAPACITY, identity: 'avatar-session' }); }
      const preview = new RegExp(`^/preview/(${CODE})$`).exec(path);
      if (method === 'GET' && preview) {
        await rate(`preview:${request.headers.get('CF-Connecting-IP') || env.EVENT_CLIENT_IP || 'unknown'}`, 120);
        const room = await get('SELECT * FROM event_rooms WHERE code = ?', preview[1]);
        if (!room) fail(404, 'ROOM_NOT_FOUND', '现场不存在。');
        return json(200, { preview: roomJSON(room) });
      }
      const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(request.headers.get('Authorization') || '');
      if (!match) fail(401, 'SESSION_REQUIRED', '请先确认你的小人身份。');
      const user = await get('SELECT * FROM avatar_users WHERE token_hash = ?', hash(match[1]));
      if (!user) fail(401, 'SESSION_INVALID', '身份已失效，请刷新页面。');
      await rate(`user:${user.id}:${method === 'GET' ? 'read' : 'write'}`, method === 'GET' ? 180 : 40);
      const active = (roomId, userId = user.id) => get('SELECT * FROM event_members WHERE room_id = ? AND user_id = ? AND left_at IS NULL', roomId, userId);
      async function memberRoom(id) {
        const room = await get('SELECT r.* FROM event_rooms r JOIN event_members m ON m.room_id = r.id WHERE r.id = ? AND m.user_id = ? AND m.left_at IS NULL', id, user.id);
        if (!room) fail(404, 'ROOM_NOT_FOUND', '现场不存在，或当前身份未加入。');
        return room;
      }
      function requireOpen(room) { if (room.closed_at || room.expires_at <= now()) fail(409, 'ROOM_CLOSED', '此现场已结束，不能继续加入或上传。'); }
      const membershipGuard = roomId => ({ sql: 'EXISTS (SELECT 1 FROM event_members WHERE room_id = ? AND user_id = ? AND left_at IS NULL)', args: [roomId, user.id] });
      async function ownPhoto(id) {
        const photo = await get('SELECT * FROM event_photos WHERE id = ? AND owner_id = ? AND deleted_at IS NULL', id, user.id);
        if (!photo) fail(404, 'PHOTO_NOT_FOUND', '照片不存在，或当前身份无权修改。');
        return photo;
      }
      async function readablePhoto(id) {
        return get(`SELECT p.* FROM event_photos p WHERE p.id = ? AND p.deleted_at IS NULL AND (p.owner_id = ? OR (p.visibility = 'members'
          AND EXISTS (SELECT 1 FROM event_members WHERE room_id = p.room_id AND user_id = ? AND left_at IS NULL)
          AND EXISTS (SELECT 1 FROM event_members WHERE room_id = p.room_id AND user_id = p.owner_id AND left_at IS NULL)
          AND ${socialAllowedSQL('?', 'p.owner_id')}))`, id, user.id, user.id, user.id, user.id);
      }
      // Only a confirmed, currently unreferenced key can be removed. When a batch
      // response is lost, preserve objects until the outcome is established.
      async function removeUnreferenced(key) {
        if (!key || !env.PHOTOS?.delete) return;
        try { if (!await get('SELECT id FROM event_photos WHERE photo_key = ? UNION ALL SELECT id FROM event_exchanges WHERE preview_key = ? LIMIT 1', key, key)) await env.PHOTOS.delete(key); } catch { /* retention is safer than uncertain deletion */ }
      }
      async function replayOperation(data){const key=request.headers.get('Idempotency-Key');if(typeof key!=='string'||!/^[A-Za-z0-9_-]{16,128}$/.test(key))fail(400,'IDEMPOTENCY_KEY_REQUIRED','请求缺少编号，请重试。');const previous=await get('SELECT * FROM event_idempotency WHERE actor_id=? AND key_hash=?',user.id,hash(key));if(!previous)return null;if(previous.request_hash!==hash(`${method}\n${path}\n${JSON.stringify(data)}`))fail(409,'IDEMPOTENCY_CONFLICT','同一请求编号对应不同内容。');return json(previous.status,JSON.parse(previous.response),{'Idempotency-Replayed':'true'});}
      async function mutate(data, action) {
        const key = request.headers.get('Idempotency-Key');
        if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(key)) fail(400, 'IDEMPOTENCY_KEY_REQUIRED', '请为此次操作提供唯一重试编号。');
        const keyHash = hash(key), requestHash = hash(`${method}\n${path}\n${JSON.stringify(data)}`);
        function replay(previous) {
          if (previous.request_hash !== requestHash) fail(409, 'IDEMPOTENCY_CONFLICT', '此重试编号已用于另一项操作。');
          return json(previous.status, JSON.parse(previous.response), { 'Idempotency-Replayed': 'true' });
        }
        const previous = await get('SELECT * FROM event_idempotency WHERE actor_id = ? AND key_hash = ?', user.id, keyHash);
        if (previous) return replay(previous);
        let plan;
        try {
          plan = await action();
          const guardId = randomUUID(), statements = [];
          if (plan.guard) statements.push(stmt(`INSERT INTO event_mutation_guard (id,assertion) VALUES (?,CASE WHEN (${plan.guard.sql}) THEN 1 ELSE 0 END)`, guardId, ...plan.guard.args));
          statements.push(...(plan.statements || []));
          statements.push(stmt('INSERT INTO event_idempotency (actor_id,key_hash,request_hash,status,response,created_at) VALUES (?,?,?,?,?,?)', user.id, keyHash, requestHash, plan.status || 200, JSON.stringify(plan.body), now()));
          if (plan.guard) statements.push(stmt('DELETE FROM event_mutation_guard WHERE id = ?', guardId));
          await db.batch(statements);
        } catch (error) {
          const winner = await get('SELECT * FROM event_idempotency WHERE actor_id = ? AND key_hash = ?', user.id, keyHash).catch(() => null);
          if (winner) { if (plan?.uploadedKey) await removeUnreferenced(plan.uploadedKey); return replay(winner); }
          // Do not purge uploaded R2 bytes after an ambiguous transaction failure.
          // Unreferenced orphans require a separately designed retention job.
          if (/event_mutation_guard_assertion|CHECK constraint|UNIQUE constraint/.test(String(error.message))) {
            if (plan?.uploadedKey) await removeUnreferenced(plan.uploadedKey);
            fail(409, 'STATE_CONFLICT', '现场或照片刚刚有了变化，请刷新后重试。');
          }
          throw error;
        }
        if (plan.removeKey) await removeUnreferenced(plan.removeKey);
        return json(plan.status || 200, plan.body);
      }
      const gamesResponse=await handleEventGames({request,path,method,user,db,stmt,get,now,rate,mutate,replayOperation,readJSON,keys,revision,fail,json});
      if(gamesResponse)return gamesResponse;
      const topicsResponse=await handleMusicTopics({request,path,method,user,db,stmt,get,now,rate,mutate,readJSON,keys,revision,fail,json});
      if(topicsResponse)return topicsResponse;
      const cornerResponse=await handleEventCorners({request,path,method,user,db,stmt,get,now,rate,mutate,readJSON,keys,revision,fail,json,env,headers});
      if(cornerResponse)return cornerResponse;
      const worldcupResponse=await handleEventWorldCup({request,path,method,user,db,stmt,get,now,rate,mutate,replayOperation,readJSON,keys,revision,fail,json});
      if(worldcupResponse)return worldcupResponse;
      const spacesResponse=await handleEventSpaces({request,path,method,user,db,stmt,get,now,rate,mutate,readJSON,keys,revision,fail,json});
      if(spacesResponse)return spacesResponse;
      const communityResponse=await handleEventCommunity({request,path,method,user,db,stmt,get,now,rate,mutate,readJSON,keys,revision,fail,json});
      if(communityResponse)return communityResponse;
      const participationResponse=await handleEventParticipation({request,path,method,user,stmt,get,now,mutate,readJSON,keys,revision,fail,json});
      if(participationResponse)return participationResponse;
      const endExchanges = (predicate, args, options) => endEventExchanges(stmt, now(), predicate, args, options);
      const moderationResponse = await handleEventModeration({request,path,method,user,stmt,get,now,rate,mutate,readJSON,keys,revision,fail,json,endExchanges});
      if(moderationResponse)return moderationResponse;
      const exchangeResponse = await handleEventExchanges({ request, path, method, user, db, stmt, get, now, clock, rate, mutate, readJSON, keys, revision, fail, json, env, headers });
      if (exchangeResponse) return exchangeResponse;
      const chatResponse = await handleEventChat({ request, path, method, user, db, stmt, get, now, rate, mutate, readJSON, keys, fail, json });
      if (chatResponse) return chatResponse;
      const socialResponse = await handleEventSocial({ request, path, method, user, db, stmt, get, now, clock, rate, mutate, readJSON, keys, revision, fail, json, endExchanges });
      if (socialResponse) return socialResponse;
      const recapResponse = await handleEventRecap({ request, path, method, user, db, stmt, get, roomJSON, photoJSON, fail, json });
      if (recapResponse) return recapResponse;
      if (method === 'GET' && ['/rooms', '/photos'].includes(path)) {
        const cursor = new URL(request.url).searchParams.get('cursor');
        if (cursor && !new RegExp(`^${ID}$`).test(cursor)) fail(400, 'INVALID_CURSOR', '分页位置无效。');
        if (path === '/rooms') {
          // Past participation retains event metadata only; is_member and every
          // roster/photo gate still require an active (not departed) membership.
          const last = cursor && await get('SELECT r.* FROM event_rooms r WHERE r.id = ? AND (r.host_id = ? OR EXISTS (SELECT 1 FROM event_members m WHERE m.room_id = r.id AND m.user_id = ?))', cursor, user.id, user.id);
          if (cursor && !last) fail(400, 'INVALID_CURSOR', '分页位置已失效，请重新读取列表。');
          const rooms = await all('SELECT r.*,EXISTS (SELECT 1 FROM event_members WHERE room_id = r.id AND user_id = ? AND left_at IS NULL) AS is_member,EXISTS (SELECT 1 FROM event_room_exclusions WHERE room_id = r.id AND user_id = ? AND restored_at IS NULL) AS is_excluded FROM event_rooms r WHERE (r.host_id = ? OR EXISTS (SELECT 1 FROM event_members m WHERE m.room_id = r.id AND m.user_id = ?))' + (last ? ' AND (r.created_at < ? OR (r.created_at = ? AND r.id < ?))' : '') + ' ORDER BY r.created_at DESC,r.id DESC LIMIT 101', user.id, user.id, user.id, user.id, ...(last ? [last.created_at, last.created_at, last.id] : []));
          return json(200, { rooms: rooms.slice(0, 100).map(room => roomJSON(room, user.id, Boolean(room.is_member))), actorId: user.id, nextCursor: rooms.length > 100 ? rooms[99].id : null });
        }
        const last = cursor && await get('SELECT * FROM event_photos WHERE id = ? AND owner_id = ?', cursor, user.id);
        if (cursor && !last) fail(400, 'INVALID_CURSOR', '分页位置无效。');
        const photos = await all('SELECT * FROM event_photos WHERE owner_id = ? AND deleted_at IS NULL' + (last ? ' AND (created_at < ? OR (created_at = ? AND id < ?))' : '') + ' ORDER BY created_at DESC,id DESC LIMIT 101', user.id, ...(last ? [last.created_at, last.created_at, last.id] : []));
        return json(200, { photos: photos.slice(0, 100).map(photoJSON), actorId: user.id, nextCursor: photos.length > 100 ? photos[99].id : null });
      }
      if (method === 'POST' && path === '/rooms') {
        const data = await readJSON(request); keys(data, ['title', 'venue', 'songId', 'joinConsent', 'participation']); consent(data);
        const title = label(data.title, '现场名称'), venue = label(data.venue, '场地', true);
        if(!['quiet','open'].includes(participationMode(data.participation)))fail(400,'PARTICIPATION_REQUIRED','请选择安静参与或愿意打招呼。');
        if (!SONGS.includes(data.songId)) fail(400, 'INVALID_INPUT', '歌曲选择无效。');
        return await mutate(data, async () => {
          await rate(`create:${user.id}`, 6, DAY);
          const room = { id: randomUUID(), code: code(), host_id: user.id, title, venue, song_id: data.songId, revision: 1, created_at: now(), expires_at: new Date(clock() + DAY).toISOString(), closed_at: null };
          return { status: 201, body: { room: roomJSON(room, user.id), actorId: user.id }, statements: [
            stmt('INSERT INTO event_rooms (id,code,host_id,title,venue,song_id,revision,created_at,expires_at,closed_at) VALUES (?,?,?,?,?,?,?,?,?,?)', room.id, room.code, user.id, title, venue, room.song_id, 1, room.created_at, room.expires_at, null),
            stmt('INSERT INTO event_members (room_id,user_id,joined_at,left_at) VALUES (?,?,?,NULL)', room.id, user.id, now()),
            stmt('INSERT INTO event_participation (room_id,user_id,mode,revision,updated_at) VALUES (?,?,?,1,?)',room.id,user.id,participationMode(data.participation),now()),
          ] };
        });
      }
      const join = new RegExp(`^/rooms/(${CODE})/join$`).exec(path);
      if (method === 'POST' && join) {
        const data = await readJSON(request); keys(data, ['joinConsent','participation']); consent(data);
        if(!['quiet','open'].includes(participationMode(data.participation)))fail(400,'PARTICIPATION_REQUIRED','请选择安静参与或愿意打招呼。');
        await rate(`join:${user.id}`, 20);
        return await mutate(data, async () => {
          const room = await get('SELECT * FROM event_rooms WHERE code = ?', join[1]);
          if (!room) fail(404, 'ROOM_NOT_FOUND', '现场不存在。');
          requireOpen(room);
          if(await get('SELECT 1 AS denied FROM event_room_exclusions WHERE room_id = ? AND user_id = ? AND restored_at IS NULL',room.id,user.id))fail(403,'ROOM_EXCLUDED','你已被房主移出这一场，你的照片还在。');
          if (await active(room.id)) return { body: { room: roomJSON(room, user.id), actorId: user.id } };
          const count = await get('SELECT COUNT(*) AS total FROM event_members WHERE room_id = ? AND left_at IS NULL', room.id);
          if (count.total >= EVENT_CAPACITY) fail(409, 'ROOM_FULL', '本场已有 24 位成员。');
          return { body: { room: roomJSON(room, user.id), actorId: user.id }, guard: {
            sql: 'EXISTS (SELECT 1 FROM event_rooms WHERE id = ? AND closed_at IS NULL AND expires_at > ?) AND ((SELECT COUNT(*) FROM event_members WHERE room_id = ? AND left_at IS NULL) < ? OR EXISTS (SELECT 1 FROM event_members WHERE room_id = ? AND user_id = ? AND left_at IS NULL)) AND NOT EXISTS (SELECT 1 FROM event_room_exclusions WHERE room_id = ? AND user_id = ? AND restored_at IS NULL)',
            args: [room.id, now(), room.id, EVENT_CAPACITY, room.id, user.id,room.id,user.id],
          }, statements: [stmt('INSERT INTO event_members (room_id,user_id,joined_at,left_at) VALUES (?,?,?,NULL) ON CONFLICT(room_id,user_id) DO UPDATE SET joined_at = excluded.joined_at, left_at = NULL', room.id, user.id, now()),stmt('INSERT INTO event_participation (room_id,user_id,mode,revision,updated_at) VALUES (?,?,?,1,?) ON CONFLICT(room_id,user_id) DO UPDATE SET mode=excluded.mode,revision=event_participation.revision+1,updated_at=excluded.updated_at',room.id,user.id,participationMode(data.participation),now()),...(participationMode(data.participation)==='quiet'?[stmt("UPDATE event_social_pairs SET status='cancelled',revision=revision+1,updated_at=?,cooldown_until=NULL WHERE room_id=? AND status='pending' AND (sender_id=? OR recipient_id=?) AND NOT EXISTS(SELECT 1 FROM event_community_greetings g WHERE g.pair_id=event_social_pairs.id AND g.greeting_id=event_social_pairs.greeting_id)",now(),room.id,user.id,user.id)]:[])] };
        });
      }
      const roomRoute = new RegExp(`^/rooms/(${ID})(/leave|/close|/photos)?$`).exec(path);
      if (roomRoute) {
        const id = roomRoute[1], action = roomRoute[2] || '';
        if (method === 'GET' && !action) {
          const room = await memberRoom(id);
          const members = await all(`SELECT u.id,u.name,u.avatar,m.joined_at,COALESCE(p.mode,'quiet') AS participation,COALESCE(p.revision,1) AS participation_revision FROM event_members m JOIN avatar_users u ON u.id = m.user_id LEFT JOIN event_participation p ON p.room_id=m.room_id AND p.user_id=m.user_id WHERE m.room_id = ? AND m.left_at IS NULL AND ${socialAllowedSQL('?', 'u.id')} ORDER BY m.joined_at,u.id`, id, user.id, user.id);
          const photos = await all(`SELECT p.* FROM event_photos p WHERE p.room_id = ? AND p.deleted_at IS NULL AND (p.owner_id = ? OR (p.visibility = 'members' AND EXISTS (SELECT 1 FROM event_members WHERE room_id = p.room_id AND user_id = p.owner_id AND left_at IS NULL) AND ${socialAllowedSQL('?', 'p.owner_id')})) ORDER BY p.created_at,p.id`, id, user.id, user.id, user.id);
          // Recheck membership after the reads so a concurrent leave cannot expose a fresh roster response.
          await memberRoom(id);
          const denied = new Set((await all(`SELECT m.user_id AS peer_id FROM event_members m WHERE m.room_id = ? AND NOT (${socialAllowedSQL('?', 'm.user_id')})`, id, user.id, user.id)).map(row => row.peer_id));
          return json(200, { room: {...roomJSON(room, user.id),hostId:room.host_id}, members: members.filter(member => !denied.has(member.id)).map(member => ({ id: member.id, name: member.name, avatar: JSON.parse(member.avatar), joinedAt: member.joined_at,participation:member.participation,participationRevision:member.participation_revision })), photos: photos.filter(photo => !denied.has(photo.owner_id)).map(photoJSON), actorId: user.id });
        }
        if (method === 'POST' && ['/leave', '/close', '/photos'].includes(action)) {
          const data = await readJSON(request);
          return await mutate(data, async () => {
            // Hosting permits management only, never a membership bypass for people/photos.
            const room = action === '/close' ? await get('SELECT r.*,EXISTS (SELECT 1 FROM event_members WHERE room_id = r.id AND user_id = ? AND left_at IS NULL) AS is_member FROM event_rooms r WHERE r.id = ? AND (r.host_id = ? OR EXISTS (SELECT 1 FROM event_members WHERE room_id = r.id AND user_id = ? AND left_at IS NULL))', user.id, id, user.id, user.id) : await memberRoom(id);
            if (!room) fail(404, 'ROOM_NOT_FOUND', '现场不存在，或当前身份无权管理。');
            if (action === '/leave') {
              keys(data, []);
              return { body: { left: true, roomId: id }, guard: membershipGuard(id), statements: [
                stmt('UPDATE event_members SET left_at = ? WHERE room_id = ? AND user_id = ? AND left_at IS NULL', now(), id, user.id),
                ...endExchanges('room_id = ? AND (sender_id = ? OR recipient_id = ?)', [id, user.id, user.id], { pendingOnly: true }),
                stmt("UPDATE event_photos SET visibility = 'private', revision = revision + 1, updated_at = ? WHERE room_id = ? AND owner_id = ? AND visibility = 'members' AND deleted_at IS NULL", now(), id, user.id),
              ] };
            }
            if (action === '/close') {
              keys(data, ['revision']); if (room.host_id !== user.id) fail(403, 'HOST_REQUIRED', '只有开场人可以结束现场。'); revision(room, data.revision);
              const updated = { ...room, closed_at: now(), revision: room.revision + 1 };
              return { body: { room: roomJSON(updated, user.id, Boolean(room.is_member)) }, guard: { sql: 'EXISTS (SELECT 1 FROM event_rooms WHERE id = ? AND revision = ? AND host_id = ?)', args: [id, room.revision, user.id] },
                statements: [stmt('UPDATE event_rooms SET closed_at = ?,revision = revision + 1 WHERE id = ? AND revision = ?', updated.closed_at, id, room.revision)] };
            }
            keys(data, ['dataUrl', 'visibility', 'takenAt', 'takenSource', 'viewpoint', 'viewpointSource']); requireOpen(room); visibility(data.visibility); const moment = photoMoment(data, clock());
            await rate(`upload:${user.id}`, 20, 60 * 60_000);
            const count = await get('SELECT COUNT(*) AS total FROM event_photos WHERE room_id = ? AND owner_id = ? AND deleted_at IS NULL', id, user.id);
            if (count.total >= EVENT_PHOTO_LIMIT) fail(409, 'PHOTO_LIMIT', '每人每场最多保留 6 张照片。');
            let bytes; try { bytes = sanitizeAvatarJpeg(data.dataUrl); } catch (error) { if (error.status) fail(error.status, error.code, error.message); throw error; }
            if (!env.PHOTOS?.put) fail(503, 'PHOTO_SERVICE_UNAVAILABLE', '照片服务暂时不可用。');
            const photo = { id: randomUUID(), room_id: id, owner_id: user.id, visibility: data.visibility, revision: 1, created_at: now(), updated_at: now(), taken_at: moment.takenAt, taken_source: moment.takenSource, viewpoint: moment.viewpoint, viewpoint_source: moment.viewpointSource };
            const objectKey = `events/${id}/${photo.id}/${randomUUID()}.jpg`;
            await env.PHOTOS.put(objectKey, bytes, { httpMetadata: { contentType: 'image/jpeg' } });
            return { status: 201, body: { photo: photoJSON(photo) }, uploadedKey: objectKey, guard: {
              sql: 'EXISTS (SELECT 1 FROM event_rooms WHERE id = ? AND closed_at IS NULL AND expires_at > ?) AND EXISTS (SELECT 1 FROM event_members WHERE room_id = ? AND user_id = ? AND left_at IS NULL) AND (SELECT COUNT(*) FROM event_photos WHERE room_id = ? AND owner_id = ? AND deleted_at IS NULL) < ?',
              args: [id, now(), id, user.id, id, user.id, EVENT_PHOTO_LIMIT],
            }, statements: [stmt('INSERT INTO event_photos (id,room_id,owner_id,photo_key,visibility,revision,created_at,updated_at,deleted_at,taken_at,taken_source,viewpoint,viewpoint_source) VALUES (?,?,?,?,?,1,?,?,NULL,?,?,?,?)', photo.id, id, user.id, objectKey, photo.visibility, photo.created_at, photo.updated_at, moment.takenAt, moment.takenSource, moment.viewpoint, moment.viewpointSource)] };
          });
        }
      }
      const photoRoute = new RegExp(`^/photos/(${ID})(/image|/withdraw)?$`).exec(path);
      if (photoRoute) {
        const id = photoRoute[1];
        if (method === 'GET' && photoRoute[2] === '/image') {
          const photo = await readablePhoto(id);
          if (!photo) fail(404, 'PHOTO_NOT_FOUND', '照片不存在，或当前身份无权查看。');
          if (!env.PHOTOS?.get) fail(503, 'PHOTO_SERVICE_UNAVAILABLE', '照片暂时无法读取。');
          const object = await env.PHOTOS.get(photo.photo_key);
          if (!object) fail(503, 'PHOTO_SERVICE_UNAVAILABLE', '照片暂时无法读取。');
          // Permission can change while private object storage is responding.
          if (!await readablePhoto(id)) { await object.body?.cancel?.(); fail(404, 'PHOTO_NOT_FOUND', '照片已撤回，或当前身份无权查看。'); }
          return new Response(object.body, { headers: { ...headers, 'Content-Type': 'image/jpeg' } });
        }
        const withdrawing = method === 'POST' && photoRoute[2] === '/withdraw';
        if (withdrawing || (!photoRoute[2] && ['PATCH', 'DELETE'].includes(method))) {
          const data = await readJSON(request); keys(data, method === 'PATCH' ? ['revision', 'visibility'] : ['revision']);
          return await mutate(data, async () => {
            const photo = await ownPhoto(id); revision(photo, data.revision);
            const guard = { sql: 'EXISTS (SELECT 1 FROM event_photos WHERE id = ? AND owner_id = ? AND revision = ? AND deleted_at IS NULL)', args: [id, user.id, photo.revision] };
            if (method === 'DELETE') return { body: { removed: true, photoId: id }, guard, removeKey: photo.photo_key,
              statements: [stmt('UPDATE event_photos SET photo_key = NULL,deleted_at = ?,updated_at = ?,revision = revision + 1 WHERE id = ? AND revision = ?', now(), now(), id, photo.revision),
                ...endExchanges('offered_photo_id = ? OR requested_photo_id = ?', [id, id])] };
            if (withdrawing) {
              const updated = { ...photo, visibility: 'private', revision: photo.revision + 1, updated_at: now() };
              return { body: { photo: photoJSON(updated) }, guard, statements: [
                stmt("UPDATE event_photos SET visibility = 'private',revision = revision + 1,updated_at = ? WHERE id = ? AND revision = ?", updated.updated_at, id, photo.revision),
                ...endExchanges('offered_photo_id = ? OR requested_photo_id = ?', [id, id]),
              ] };
            }
            visibility(data.visibility);
            if (data.visibility === 'members') {
              await memberRoom(photo.room_id);
              guard.sql += ' AND EXISTS (SELECT 1 FROM event_members WHERE room_id = ? AND user_id = ? AND left_at IS NULL)'; guard.args.push(photo.room_id, user.id);
            }
            const updated = { ...photo, visibility: data.visibility, revision: photo.revision + 1, updated_at: now() };
            return { body: { photo: photoJSON(updated) }, guard, statements: [stmt('UPDATE event_photos SET visibility = ?,revision = revision + 1,updated_at = ? WHERE id = ? AND revision = ?', data.visibility, updated.updated_at, id, photo.revision),
              ...(photo.visibility === 'members' && data.visibility === 'private' ? endExchanges('offered_photo_id = ? OR requested_photo_id = ?', [id, id], { pendingOnly: true }) : []),
            ] };
          });
        }
      }
      fail(404, 'NOT_FOUND', '接口不存在。');
    } catch (error) {
      const known = error instanceof EventError;
      if (!known) console.error('Event API error:', error.code || error.name);
      return json(known ? error.status : 503, { error: { code: known ? error.code : 'SERVICE_UNAVAILABLE', message: known ? error.message : '服务暂时不可用。请保留原重试编号，稍后重试。', ...(error.currentRevision ? { currentRevision: error.currentRevision } : {}) } }, error.retryAfter ? { 'Retry-After': String(error.retryAfter) } : {});
    }
  } };
}
export default createEventWorker();
