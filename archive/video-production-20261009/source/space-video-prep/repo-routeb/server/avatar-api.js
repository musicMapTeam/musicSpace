import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { createAvatarStore } from './avatar-store.js';

export const AVATAR_API_PREFIX = '/api/avatar';
export const AVATAR_SCENES = ['rooftop-night', 'sakura-night', 'fan-stage'];
export const AVATAR_SONGS = ['late-train', 'moon-window', 'sakura-echo'];
export const DEFAULT_AVATAR = Object.freeze({
  version: 2, skin: 1, hair: 0, hairColor: 0, outfit: 0, accessory: 'headphones', pose: 'sway',
  top: 0, bottom: 0, shoes: 1, eyewear: 0, topColor: 0, bottomColor: 1, shoeColor: 0, expression: 'neutral',
});
// outfit is only a compatibility seed. Explicit components are never tied to it.
const OUTFIT_SHOES = [1, 0, 2, 2, 3, 0];
const OUTFIT_TOP_COLORS = [0, 2, 3, 4, 6, 2];
const OUTFIT_BOTTOM_COLORS = [1, 1, 0, 0, 1, 3];
const OUTFIT_SHOE_COLORS = [0, 0, 1, 1, 0, 0];
const PHOTO_LIMIT = 300 * 1024;
const BODY_LIMIT = 420 * 1024;
const SMALL_BODY_LIMIT = 8 * 1024;
const INVITE_LIFETIME = 7 * 24 * 60 * 60 * 1000;
const CAPABILITY = /^[A-Za-z0-9_-]{43}$/;
const ID = '[0-9a-f-]{36}';
const recoveryNotice = '身份只保存在当前浏览器。清除浏览器数据或丢失身份凭证后，无法找回旧作品；昵称不是登录凭证。';
const hash = value => createHash('sha256').update(value).digest('hex');
const plain = value => value && typeof value === 'object' && !Array.isArray(value);

class AvatarApiError extends Error {
  constructor(status, code, message, extra = {}) { super(message); Object.assign(this, { status, code, ...extra }); }
}
const fail = (status, code, message, extra) => { throw new AvatarApiError(status, code, message, extra); };
function text(value, field, maximum, fallback) {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== 'string' || [...value.trim()].length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) {
    fail(400, 'INVALID_INPUT', `${field}请填写不超过 ${maximum} 个字的文字。`);
  }
  return value.trim();
}
function choice(value, allowed, field) {
  if (!allowed.includes(value)) fail(400, 'INVALID_INPUT', `${field}的选择无效。`);
  return value;
}
function allowedKeys(data, allowed) {
  const unknown = Object.keys(data).find(key => !allowed.includes(key));
  if (unknown) fail(400, 'INVALID_INPUT', '提交内容含有不允许修改的字段。');
}
/** Validate both original six-field avatars and modular v2 avatars.
 * Read-time normalization must not rewrite stored snapshots or consent revisions.
 */
function avatar(value = DEFAULT_AVATAR) {
  if (!plain(value)) fail(400, 'INVALID_AVATAR', '请选择你的分身。');
  allowedKeys(value, ['version', 'skin', 'hair', 'hairColor', 'outfit', 'accessory', 'pose',
    'top', 'bottom', 'shoes', 'eyewear', 'topColor', 'bottomColor', 'shoeColor', 'expression']);
  if (value.version !== undefined && value.version !== 2) fail(400, 'INVALID_AVATAR', '分身版本无效，请重新选择。');
  const result = { version: 2 };
  function index(key, maximum, fallback) {
    const number = value[key] === undefined ? fallback : value[key];
    if (!Number.isInteger(number) || number < 0 || number > maximum) fail(400, 'INVALID_AVATAR', '分身样式无效，请重新选择。');
    return number;
  }
  result.skin = index('skin', 4);
  result.hair = index('hair', value.version === 2 ? 7 : 3);
  result.hairColor = index('hairColor', 3);
  result.outfit = index('outfit', 5);
  // The old cargo preset rendered hair:2 as twists. Make that geometry explicit.
  if (value.version === undefined && result.hair === 2 && result.outfit === 3) result.hair = 4;
  const accessory = choice(value.accessory, ['headphones', 'glasses', 'none', 'earbuds', 'chain', 'crossbody', 'cap'], '配饰');
  result.accessory = accessory === 'glasses' ? 'none' : accessory;
  result.pose = choice(value.pose, ['sway', 'wave', 'sing', 'listen'], '姿势');
  result.top = index('top', 5, result.outfit);
  result.bottom = index('bottom', 5, result.outfit);
  result.shoes = index('shoes', 3, OUTFIT_SHOES[result.outfit]);
  const legacyEyewear = accessory !== 'glasses' ? 0 : [2, 5].includes(result.outfit) ? 2 : result.outfit === 4 ? 3 : 1;
  result.eyewear = index('eyewear', 5, legacyEyewear);
  result.topColor = index('topColor', 7, OUTFIT_TOP_COLORS[result.outfit]);
  result.bottomColor = index('bottomColor', 7, OUTFIT_BOTTOM_COLORS[result.outfit]);
  result.shoeColor = index('shoeColor', 7, OUTFIT_SHOE_COLORS[result.outfit]);
  result.expression = choice(value.expression === undefined ? 'neutral' : value.expression, ['neutral', 'smile', 'wink', 'focused'], '表情');
  return result;
}
const participantJSON = participant => participant ? { ...participant, avatar: avatar(participant.avatar) } : null;
// Old idempotency results remain immutable at rest, but get the same compatible
// response shape as ordinary reads. Capabilities are still reconstructed separately.
function avatarResponseJSON(body) {
  if (body.user) body.user = participantJSON(body.user);
  if (body.composition) body.composition = { ...body.composition,
    host: participantJSON(body.composition.host), guest: participantJSON(body.composition.guest) };
  return body;
}

function transform(value = { x: 35, y: 68, scale: 1, rotation: 0 }) {
  if (!plain(value)) fail(400, 'INVALID_TRANSFORM', '分身位置无效。');
  allowedKeys(value, ['x', 'y', 'scale', 'rotation']);
  const result = {};
  for (const [key, min, max] of [['x', 0, 100], ['y', 0, 100], ['scale', 0.5, 1.5], ['rotation', -20, 20]]) {
    if (typeof value[key] !== 'number' || !Number.isFinite(value[key]) || value[key] < min || value[key] > max) fail(400, 'INVALID_TRANSFORM', '分身位置超出画面范围。');
    result[key] = Math.round(value[key] * 1000) / 1000;
  }
  return result;
}

/** Strip every JPEG APP/COM segment (including EXIF/GPS), reject malformed/trailing data.
 * The browser must canvas-reencode uploads first; this is structural validation,
 * metadata removal and a dimension bound, not a full JPEG pixel decoder.
 */
export function sanitizeAvatarJpeg(dataUrl) {
  const prefix = 'data:image/jpeg;base64,';
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith(prefix)) fail(400, 'INVALID_PHOTO', '请先将照片转换为 JPEG 后上传。');
  const encoded = dataUrl.slice(prefix.length);
  if (!encoded || encoded.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) fail(400, 'INVALID_PHOTO', '照片内容无效。');
  const data = Buffer.from(encoded, 'base64');
  if (data.length > PHOTO_LIMIT) fail(413, 'PHOTO_TOO_LARGE', '照片请压缩至 300 KB 以内。');
  if (data.toString('base64') !== encoded || data.length < 20 || data[0] !== 0xff || data[1] !== 0xd8) fail(400, 'INVALID_PHOTO', '照片不是有效的 JPEG。');
  const chunks = [data.subarray(0, 2)];
  let offset = 2, frame = false, scan = false;
  const invalid = () => fail(400, 'INVALID_PHOTO', '照片不是有效的 JPEG，请重新选择。');
  while (offset < data.length) {
    const start = offset;
    if (data[offset++] !== 0xff) invalid();
    while (offset < data.length && data[offset] === 0xff) offset++;
    if (offset >= data.length) invalid();
    const marker = data[offset++];
    if (marker === 0xd9) {
      if (!frame || !scan || offset !== data.length) invalid();
      chunks.push(Buffer.from([0xff, 0xd9]));
      return Buffer.concat(chunks);
    }
    if (marker === 0 || marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) invalid();
    if (offset + 2 > data.length) invalid();
    const length = data.readUInt16BE(offset);
    const end = offset + length;
    if (length < 2 || end > data.length) invalid();
    const isMetadata = (marker >= 0xe0 && marker <= 0xef) || marker === 0xfe;
    const supported = isMetadata || [0xc0, 0xc2, 0xc4, 0xda, 0xdb, 0xdd].includes(marker);
    if (!supported) invalid();
    if (marker === 0xc0 || marker === 0xc2) {
      if (frame || length < 11 || data[offset + 2] !== 8) invalid();
      const height = data.readUInt16BE(offset + 3), width = data.readUInt16BE(offset + 5);
      const components = data[offset + 7];
      if (![1, 3].includes(components) || length !== 8 + components * 3 || !width || !height || width > 2400 || height > 2400 || width * height > 4_000_000) invalid();
      frame = true;
    }
    if (marker === 0xda) {
      if (!frame || length < 8) invalid();
      const components = data[offset + 2];
      if (components < 1 || components > 3 || length !== 6 + components * 2) invalid();
      scan = true;
    }
    if (!isMetadata) chunks.push(data.subarray(start, end));
    offset = end;
    if (marker === 0xda) {
      const scanStart = offset;
      while (offset < data.length) {
        if (data[offset] !== 0xff) { offset++; continue; }
        if (offset + 1 >= data.length) invalid();
        if (data[offset + 1] === 0x00 || (data[offset + 1] >= 0xd0 && data[offset + 1] <= 0xd7)) { offset += 2; continue; }
        if (data[offset + 1] === 0xff) { offset++; continue; }
        break;
      }
      if (offset >= data.length) invalid();
      chunks.push(data.subarray(scanStart, offset));
    }
  }
  invalid();
}

async function readJSON(request, maximum = SMALL_BODY_LIMIT) {
  if (request.headers['content-encoding'] && request.headers['content-encoding'] !== 'identity') fail(415, 'ENCODING_UNSUPPORTED', '请提交未压缩的 JSON。');
  if (Number(request.headers['content-length'] || 0) > maximum) { request.resume(); fail(413, 'BODY_TOO_LARGE', '提交内容过大，请压缩照片或缩短文字后重试。'); }
  const chunks = [];
  let length = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    length += chunk.length;
    if (length > maximum) { request.resume(); fail(413, 'BODY_TOO_LARGE', '提交内容过大。'); }
    chunks.push(chunk);
  }
  if (!length) return {};
  if (!/^application\/json(?:;|$)/i.test(request.headers['content-type'] || '')) fail(415, 'JSON_REQUIRED', '请使用 JSON 提交。');
  let data;
  try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { fail(400, 'INVALID_JSON', '提交内容不是有效的 JSON。'); }
  if (!plain(data)) fail(400, 'INVALID_JSON', '提交内容应为 JSON 对象。');
  return data;
}
function json(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
  response.end(JSON.stringify(data));
}
function jpeg(response, bytes) {
  response.writeHead(200, { 'Content-Type': 'image/jpeg', 'Content-Length': bytes.length, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
  response.end(Buffer.from(bytes));
}

/** Returns false for other paths, true after responding; usable before the live router.
 * Tests may create an isolated handler with {dataDir} or {databasePath: ':memory:'}.
 */
export function createAvatarApi(options = {}) {
  const store = createAvatarStore(options);
  const { get, all, run, transaction } = store;
  const clock = options.clock || Date.now;
  const now = () => new Date(clock()).toISOString();
  const limits = new Map();
  const capability = (kind, actor, key) => createHmac('sha256', store.secret).update(`${kind}\0${actor}\0${key}`).digest('base64url');
  function rateLimit(key, maximum, period = 60_000) {
    if (options.rateLimits === false) return;
    const time = clock();
    if (limits.size > 2000) for (const [id, entry] of limits) if (entry.until <= time) limits.delete(id);
    let entry = limits.get(key);
    if (!entry || entry.until <= time) { entry = { count: 0, until: time + period }; limits.set(key, entry); }
    entry.count++;
    if (entry.count > maximum) fail(429, 'RATE_LIMITED', '操作有些频繁，请稍后重试。', { retryAfter: Math.ceil((entry.until - time) / 1000) });
  }
  function authenticate(request) {
    const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(request.headers.authorization || '');
    if (!match) fail(401, 'SESSION_REQUIRED', '请先建立你的分身身份。');
    const user = get('SELECT * FROM avatar_users WHERE token_hash = ?', hash(match[1]));
    if (!user) fail(401, 'SESSION_INVALID', '此浏览器身份已失效。新建身份无法恢复旧作品。');
    return user;
  }
  const userJSON = user => ({ id: user.id, name: user.name, avatar: avatar(JSON.parse(user.avatar)), revision: user.revision });
  function requireRoom(id, userId) {
    const room = get('SELECT * FROM avatar_compositions WHERE id = ? AND (host_id = ? OR guest_id = ?)', id, userId, userId);
    if (!room) fail(404, 'COMPOSITION_NOT_FOUND', '作品不存在，或当前身份无权查看。');
    return room;
  }
  function requireInvite(token) {
    if (!CAPABILITY.test(token)) fail(404, 'INVITE_UNAVAILABLE', '邀请不存在、已撤销或已过期。');
    const room = get('SELECT * FROM avatar_compositions WHERE invite_hash = ? AND invite_expires_at > ?', hash(token), now());
    if (!room) fail(404, 'INVITE_UNAVAILABLE', '邀请不存在、已撤销或已过期。');
    return room;
  }
  const invitationActive = room => Boolean(room.invite_hash && room.invite_expires_at > now());
  function sceneJSON(room, state, inviteToken) {
    return state.scene.kind === 'photo' ? { kind: 'photo', photoUrl: inviteToken ? `${AVATAR_API_PREFIX}/invites/${inviteToken}/photo` : `${AVATAR_API_PREFIX}/compositions/${room.id}/photo` } : state.scene;
  }
  function roomJSON(room, userId) {
    const state = JSON.parse(room.snapshot);
    const consents = { host: state.consents.host === room.content_revision, guest: Boolean(room.guest_id) && state.consents.guest === room.content_revision };
    return {
      id: room.id, title: state.title, caption: state.caption, scene: sceneJSON(room, state), songId: state.songId,
      host: participantJSON(state.host), guest: participantJSON(state.guest), revision: room.revision, contentRevision: room.content_revision,
      status: state.status, consents,
      exportEligible: state.status === 'accepted' && state.acceptedContent === room.content_revision && consents.host && consents.guest,
      inviteActive: invitationActive(room), role: room.host_id === userId ? 'host' : 'guest',
      createdAt: room.created_at, updatedAt: room.updated_at,
    };
  }
  function previewJSON(room, token) {
    const state = JSON.parse(room.snapshot);
    return { preview: { id: room.id, title: state.title, caption: state.caption, scene: sceneJSON(room, state, token),
      songId: state.songId, host: participantJSON(state.host), revision: room.revision, status: state.status,
      available: !room.guest_id }, expiresAt: room.invite_expires_at };
  }
  function revision(room, value) {
    if (!Number.isInteger(value) || value < 1) fail(400, 'REVISION_REQUIRED', '请提交当前作品版本。');
    if (room.revision !== value) fail(409, 'REVISION_CONFLICT', '作品刚刚有了更新。请刷新后再确认，当前草稿尚未提交。', { currentRevision: room.revision });
  }
  function saveRoom(room, state, { contentChanged = false, photo = room.photo, guestId = room.guest_id, inviteHash = room.invite_hash, inviteExpiresAt = room.invite_expires_at } = {}) {
    const contentRevision = room.content_revision + Number(contentChanged);
    if (contentChanged) {
      state.consents = { host: null, guest: null };
      state.acceptedContent = null;
      state.status = guestId ? 'pending' : 'waiting';
    }
    run(`UPDATE avatar_compositions SET snapshot = ?, revision = revision + 1, content_revision = ?, photo = ?, guest_id = ?, invite_hash = ?, invite_expires_at = ?, updated_at = ? WHERE id = ?`,
      JSON.stringify(state), contentRevision, photo, guestId, inviteHash, inviteExpiresAt, now(), room.id);
    return get('SELECT * FROM avatar_compositions WHERE id = ?', room.id);
  }
  function parseScene(value, currentPhoto) {
    if (!plain(value)) fail(400, 'INVALID_SCENE', '请选择场景或上传照片。');
    if (value.kind === 'builtin') {
      allowedKeys(value, ['kind', 'id']);
      return { scene: { kind: 'builtin', id: choice(value.id, AVATAR_SCENES, '场景') }, photo: null };
    }
    if (value.kind === 'photo') {
      allowedKeys(value, ['kind', 'dataUrl']);
      if (value.dataUrl === undefined && currentPhoto) return { scene: { kind: 'photo' }, photo: currentPhoto };
      return { scene: { kind: 'photo' }, photo: sanitizeAvatarJpeg(value.dataUrl) };
    }
    fail(400, 'INVALID_SCENE', '请选择场景或上传照片。');
  }
  function idemKey(request, optional = false) {
    const key = request.headers['idempotency-key'];
    if (optional && !key) return randomBytes(24).toString('base64url');
    if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(key)) fail(400, 'IDEMPOTENCY_KEY_REQUIRED', '请为此次操作提供唯一重试编号。');
    return key;
  }
  function mutate(request, path, data, actor, action, { optionalKey = false } = {}) {
    const key = idemKey(request, optionalKey), keyHash = hash(key);
    const requestHash = hash(`${request.method}\n${path}\n${JSON.stringify(data)}`);
    const addCapability = result => {
      if (result.capabilityKind) result.body[result.capabilityKind === 'session' ? 'token' : 'inviteToken'] = capability(result.capabilityKind, actor, key);
      return result;
    };
    return transaction(() => {
      const previous = get('SELECT * FROM avatar_idempotency WHERE actor_id = ? AND key_hash = ?', actor, keyHash);
      if (previous) {
        if (previous.request_hash !== requestHash) fail(409, 'IDEMPOTENCY_CONFLICT', '这个重试编号已用于另一项操作，请刷新后重试。');
        return addCapability({ status: previous.status, body: avatarResponseJSON(JSON.parse(previous.response)), capabilityKind: previous.capability_kind, replay: true });
      }
      const result = action(key);
      run('INSERT INTO avatar_idempotency (actor_id,key_hash,request_hash,status,response,capability_kind,created_at) VALUES (?,?,?,?,?,?,?)', actor, keyHash, requestHash, result.status || 200, JSON.stringify(result.body), result.capabilityKind || null, now());
      return addCapability({ ...result, status: result.status || 200 });
    });
  }
  function mutationResponse(response, result) {
    if (result.replay) response.setHeader('Idempotency-Replayed', 'true');
    json(response, result.status, result.body);
  }

  async function dispatch(request, response, path) {
    const method = request.method;
    if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) fail(405, 'METHOD_NOT_ALLOWED', '不支持这个操作。');
    const ip = request.socket.remoteAddress || 'unknown';
    rateLimit(`ip:${ip}`, 600);
    if (method === 'GET' && path === '/health') return json(response, 200, { ok: true, storage: 'sqlite', identityRecovery: 'device-capability-only' });
    if (method === 'POST' && path === '/session') {
      rateLimit(`session:${ip}`, 30, 15 * 60_000);
      const data = await readJSON(request);
      allowedKeys(data, ['name', 'avatar']);
      const name = text(data.name, '称呼', 20, '无名听众');
      if (!name) fail(400, 'INVALID_INPUT', '请填写一个称呼。');
      const value = avatar(data.avatar);
      return mutationResponse(response, mutate(request, path, data, 'bootstrap', key => {
        const token = capability('session', 'bootstrap', key), id = randomUUID();
        run('INSERT INTO avatar_users (id,name,avatar,token_hash,created_at) VALUES (?,?,?,?,?)', id, name, JSON.stringify(value), hash(token), now());
        return { status: 201, body: { user: userJSON(get('SELECT * FROM avatar_users WHERE id = ?', id)), recoveryNotice }, capabilityKind: 'session' };
      }, { optionalKey: true }));
    }
    const inviteRoute = /^\/invites\/([A-Za-z0-9_-]{43})(\/photo|\/join)?$/.exec(path);
    if (method === 'GET' && inviteRoute && inviteRoute[2] !== '/join') {
      rateLimit(`invite:${ip}`, 180);
      const room = requireInvite(inviteRoute[1]);
      if (inviteRoute[2] === '/photo') {
        if (!room.photo) fail(404, 'PHOTO_NOT_FOUND', '此作品没有上传照片。');
        return jpeg(response, room.photo);
      }
      return json(response, 200, previewJSON(room, inviteRoute[1]));
    }
    const user = authenticate(request);
    rateLimit(`user:${user.id}:${method === 'GET' ? 'read' : 'write'}`, method === 'GET' ? 180 : 60);
    if (method === 'GET' && path === '/session') {
      const rooms = all('SELECT * FROM avatar_compositions WHERE host_id = ? OR guest_id = ? ORDER BY updated_at DESC LIMIT 100', user.id, user.id);
      return json(response, 200, { user: userJSON(user), compositions: rooms.map(room => roomJSON(room, user.id)), recoveryNotice });
    }
    if (method === 'PUT' && path === '/profile') {
      const data = await readJSON(request);
      allowedKeys(data, ['revision', 'name', 'avatar']);
      return mutationResponse(response, mutate(request, path, data, user.id, () => {
        const latest = get('SELECT * FROM avatar_users WHERE id = ?', user.id);
        revision(latest, data.revision);
        const name = text(data.name, '称呼', 20, latest.name);
        if (!name) fail(400, 'INVALID_INPUT', '请填写一个称呼。');
        const value = data.avatar === undefined ? JSON.parse(latest.avatar) : avatar(data.avatar);
        run('UPDATE avatar_users SET name = ?, avatar = ?, revision = revision + 1 WHERE id = ?', name, JSON.stringify(value), user.id);
        return { body: { user: userJSON(get('SELECT * FROM avatar_users WHERE id = ?', user.id)) } };
      }));
    }
    if (method === 'POST' && path === '/compositions') {
      const data = await readJSON(request, BODY_LIMIT);
      allowedKeys(data, ['title', 'caption', 'scene', 'songId', 'transform', 'avatar']);
      return mutationResponse(response, mutate(request, path, data, user.id, () => {
        if (get('SELECT COUNT(*) AS count FROM avatar_compositions WHERE host_id = ?', user.id).count >= 100) fail(409, 'COMPOSITION_LIMIT', '当前身份最多保存 100 个作品。');
        const { scene, photo } = parseScene(data.scene);
        const currentUser = get('SELECT * FROM avatar_users WHERE id = ?', user.id);
        const state = {
          title: text(data.title, '标题', 60, '一起待在这首歌里'), caption: text(data.caption, '邀请短句', 160, ''), scene,
          songId: choice(data.songId, AVATAR_SONGS, '场景音乐'),
          host: { id: user.id, name: currentUser.name, avatar: avatar(data.avatar === undefined ? JSON.parse(currentUser.avatar) : data.avatar), transform: transform(data.transform) },
          guest: null, status: 'waiting', acceptedContent: null, consents: { host: null, guest: null },
        };
        const id = randomUUID(), time = now();
        run('INSERT INTO avatar_compositions (id,host_id,snapshot,revision,content_revision,photo,created_at,updated_at) VALUES (?,?,?,1,1,?,?,?)', id, user.id, JSON.stringify(state), photo, time, time);
        return { status: 201, body: { composition: roomJSON(requireRoom(id, user.id), user.id) } };
      }));
    }
    if (method === 'POST' && inviteRoute?.[2] === '/join') {
      const data = await readJSON(request);
      allowedKeys(data, ['revision', 'response', 'transform', 'avatar', 'consent']);
      return mutationResponse(response, mutate(request, path, data, user.id, () => {
        const room = requireInvite(inviteRoute[1]);
        if (room.host_id === user.id) fail(409, 'DISTINCT_IDENTITY_REQUIRED', '请把邀请交给另一个人的浏览器；不能替对方加入或同意。');
        revision(room, data.revision);
        if (room.guest_id) fail(409, 'COMPOSITION_FULL', '这个双人场景已经有人加入。');
        if (data.consent !== true) fail(400, 'JOIN_CONSENT_REQUIRED', '请明确同意把你的分身与回应放入这个场景。');
        const state = JSON.parse(room.snapshot), currentUser = get('SELECT * FROM avatar_users WHERE id = ?', user.id);
        state.guest = { id: user.id, name: currentUser.name, avatar: avatar(data.avatar === undefined ? JSON.parse(currentUser.avatar) : data.avatar),
          transform: transform(data.transform || { x: 65, y: 68, scale: 1, rotation: 0 }), response: text(data.response, '回应', 160, '') };
        const updated = saveRoom(room, state, { contentChanged: true, guestId: user.id });
        return { body: { composition: roomJSON(updated, user.id) } };
      }));
    }
    const route = new RegExp(`^/compositions/(${ID})(/invite|/photo|/decision|/consent|/export|/participation)?$`).exec(path);
    if (!route) fail(404, 'NOT_FOUND', '接口不存在。');
    const id = route[1], action = route[2] || '';
    if (method === 'GET') {
      const room = requireRoom(id, user.id);
      if (action === '') return json(response, 200, { composition: roomJSON(room, user.id) });
      if (action === '/photo') {
        if (!room.photo) fail(404, 'PHOTO_NOT_FOUND', '此作品没有上传照片。');
        return jpeg(response, room.photo);
      }
      if (action === '/export') {
        const composition = roomJSON(room, user.id);
        if (!composition.exportEligible) fail(409, 'EXPORT_CONSENT_REQUIRED', '需要发起人接受此版本，并由两人分别同意保存分享后才能导出。');
        return json(response, 200, { composition, authorizedRevision: room.revision, authorizedContentRevision: room.content_revision,
          exportNotice: '双方已同意保存和分享此版本。撤回同意只能阻止后续导出，无法收回已经保存的图片。' });
      }
      fail(404, 'NOT_FOUND', '接口不存在。');
    }
    const validMutation = (method === 'PATCH' && action === '') || (method === 'POST' && ['/invite', '/decision', '/consent'].includes(action)) || (method === 'DELETE' && ['/invite', '/participation'].includes(action));
    if (!validMutation) fail(404, 'NOT_FOUND', '接口不存在。');
    const data = await readJSON(request, method === 'PATCH' ? BODY_LIMIT : SMALL_BODY_LIMIT);
    return mutationResponse(response, mutate(request, path, data, user.id, key => {
      const room = requireRoom(id, user.id), state = JSON.parse(room.snapshot), host = room.host_id === user.id;
      revision(room, data.revision);
      if (method === 'PATCH' && action === '') {
        allowedKeys(data, host ? ['revision', 'title', 'caption', 'scene', 'songId', 'transform', 'avatar'] : ['revision', 'response', 'transform', 'avatar']);
        if (Object.keys(data).length === 1) return { body: { composition: roomJSON(room, user.id) } };
        let photo = room.photo;
        if (host) {
          if (data.title !== undefined) state.title = text(data.title, '标题', 60);
          if (data.caption !== undefined) state.caption = text(data.caption, '邀请短句', 160);
          if (data.songId !== undefined) state.songId = choice(data.songId, AVATAR_SONGS, '场景音乐');
          if (data.scene !== undefined) { const parsed = parseScene(data.scene, room.photo); state.scene = parsed.scene; photo = parsed.photo; }
        } else if (data.response !== undefined) state.guest.response = text(data.response, '回应', 160);
        const actor = host ? state.host : state.guest;
        if (data.transform !== undefined) actor.transform = transform(data.transform);
        if (data.avatar !== undefined) actor.avatar = avatar(data.avatar);
        return { body: { composition: roomJSON(saveRoom(room, state, { contentChanged: true, photo }), user.id) } };
      }
      if (action === '/invite') {
        allowedKeys(data, ['revision']);
        if (!host) fail(403, 'HOST_REQUIRED', '只有发起人可以管理邀请。');
        if (method === 'DELETE') return { body: { composition: roomJSON(saveRoom(room, state, { inviteHash: null, inviteExpiresAt: null }), user.id) } };
        if (room.guest_id) fail(409, 'COMPOSITION_FULL', '这个双人场景已经有人加入。');
        const token = capability('invite', user.id, key), expiresAt = new Date(clock() + INVITE_LIFETIME).toISOString();
        const updated = saveRoom(room, state, { inviteHash: hash(token), inviteExpiresAt: expiresAt });
        return { body: { composition: roomJSON(updated, user.id), expiresAt }, capabilityKind: 'invite' };
      }
      if (action === '/decision') {
        allowedKeys(data, ['revision', 'accept']);
        if (!host) fail(403, 'HOST_REQUIRED', '只有发起人可以接受或拒绝回应。');
        if (typeof data.accept !== 'boolean') fail(400, 'INVALID_INPUT', '请明确选择接受或拒绝。');
        if (!room.guest_id) fail(409, 'GUEST_REQUIRED', '等待另一人加入后再作决定。');
        state.status = data.accept ? 'accepted' : 'rejected';
        state.acceptedContent = data.accept ? room.content_revision : null;
        state.consents = { host: null, guest: null };
        return { body: { composition: roomJSON(saveRoom(room, state, data.accept ? {} : { inviteHash: null, inviteExpiresAt: null }), user.id) } };
      }
      if (action === '/consent') {
        allowedKeys(data, ['revision', 'consent']);
        if (typeof data.consent !== 'boolean') fail(400, 'INVALID_INPUT', '请明确选择是否同意保存分享。');
        if (data.consent && (state.status !== 'accepted' || state.acceptedContent !== room.content_revision || !room.guest_id)) fail(409, 'ACCEPTANCE_REQUIRED', '等待发起人接受当前版本后，两人再分别同意保存分享。');
        state.consents[host ? 'host' : 'guest'] = data.consent ? room.content_revision : null;
        return { body: { composition: roomJSON(saveRoom(room, state), user.id) } };
      }
      allowedKeys(data, ['revision']);
      if (host) fail(403, 'GUEST_REQUIRED', '只有加入者可以撤回自己的参与。');
      state.guest = null;
      const updated = saveRoom(room, state, { contentChanged: true, guestId: null, inviteHash: null, inviteExpiresAt: null });
      return { body: { withdrawn: true, compositionId: updated.id } };
    }));
  }

  const handler = async (request, response) => {
    let pathname;
    try { pathname = new URL(request.url, 'http://localhost').pathname; } catch { return false; }
    if (pathname !== AVATAR_API_PREFIX && !pathname.startsWith(`${AVATAR_API_PREFIX}/`)) return false;
    try {
      // Same-origin bearer API. Never emit CORS headers or accept browser cross-origin writes.
      if (request.headers['sec-fetch-site'] === 'cross-site') fail(403, 'ORIGIN_DENIED', '请从 Music Space 页面打开这个操作。');
      await dispatch(request, response, pathname.slice(AVATAR_API_PREFIX.length));
    } catch (error) {
      if (!response.headersSent && !response.destroyed) {
        const known = error instanceof AvatarApiError;
        if (known && error.retryAfter) response.setHeader('Retry-After', error.retryAfter);
        if (!known) console.error('Avatar API error:', error.code || error.name);
        json(response, known ? error.status : 503, { error: { code: known ? error.code : 'SERVICE_UNAVAILABLE',
          message: known ? error.message : '服务暂时不可用。请保留当前草稿，恢复连接后重试。',
          ...(error.currentRevision ? { currentRevision: error.currentRevision } : {}) } });
      }
    }
    return true;
  };
  handler.close = () => store.close();
  return handler;
}

let defaultHandler;
export async function handleAvatarApi(request, response) {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (pathname !== AVATAR_API_PREFIX && !pathname.startsWith(`${AVATAR_API_PREFIX}/`)) return false;
  defaultHandler ||= createAvatarApi();
  return defaultHandler(request, response);
}
export function closeAvatarApi() { defaultHandler?.close(); defaultHandler = undefined; }
