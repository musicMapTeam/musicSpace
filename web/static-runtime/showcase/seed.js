// Lays out the seeded show through the REAL worker API, as its characters, so every rule, revision and consent in it is the product's own,
// and records that it did. The data is a fixture (roster.js says who and what); everything else about the room is the product's code.
import { createEventApiClient } from '../../event-client/api.js';
import { ROOM, NPCS, SHOWCASE_VERSION } from './roster.js';

export const META_TABLE = '_static_meta';
export const MARKER_KEY = 'showcase';
/** The showcase room never expires; rooms a visitor opens keep the worker's own 24 hours. */
export const SHOWCASE_EXPIRES_AT = '2099-12-31T00:00:00.000Z';
export const CUP_TITLE = '今晚的专辑世界杯';
export const GAME_TITLE = '今晚谁和你同一首';

/**
 * The database holds a showcase from another build (the roster, SEED_REV or the worker changed since it was laid out).
 * The browser's data is disposable: the boot policy wipes it and seeds again. Thrown before anything was written.
 *   reason 'version'              the marker names another SHOWCASE_VERSION (`found`)
 *   reason 'marker'               the marker row cannot be read (not JSON, or without the room, the cup and the game it must name)
 *   reason 'idempotency-conflict' a character's /session key replayed with a different request, i.e. the request this build would send
 *                                 is not the one that created the character
 */
export class ShowcaseStaleError extends Error {
  constructor(reason, details = {}) {
    super(`The saved showcase is not this build's (${reason}).`);
    this.name = 'ShowcaseStaleError';
    this.code = 'SHOWCASE_STALE';
    this.reason = reason;
    this.expected = SHOWCASE_VERSION;
    Object.assign(this, details);
  }
}

// Idempotency-Key shape [A-Za-z0-9_-]{16,128}. Fixed per version: a second run is a replay at every step, and the three tokens
// (HMAC of a secret in the database, the actor and the key) come out the same on every boot, so no token is ever stored.
const key = suffix => `showcase-${SHOWCASE_VERSION}-${suffix}`;

/** `data:` URL for JPEG bytes (a typed array, a Buffer or an ArrayBuffer), in chunks (one spread of a whole photo would overflow the argument limit); no Buffer in the browser. */
export function toDataUrl(bytes, mime = 'image/jpeg') {
  const view = ArrayBuffer.isView(bytes) ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength) : new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < view.length; i += 0x2000) binary += String.fromCharCode(...view.subarray(i, i + 0x2000));
  return `data:${mime};base64,${btoa(binary)}`;
}

/** A bearer-token caller for one identity. Every mutation carries a fixed or fresh Idempotency-Key. */
export function actor(client, token) {
  return {
    token,
    get: (path, namespace = 'event') => client.request(path, { namespace, token }),
    post: (path, data, options = {}) => client.request(path, { method: 'POST', token, bodyJson: JSON.stringify(data ?? {}), key: options.key || crypto.randomUUID(), namespace: options.namespace || 'event' }),
    blob: id => client.photoBlob(id, { token }),
  };
}

/** One showcase photo, uploaded as its character with the facts that character "typed" (time and side are theirs, not the model's). */
export const uploader = ({ room, loadPhoto }) => async (person, photo, index) => (await person.api.post(`/rooms/${room.id}/photos`, {
  dataUrl: toDataUrl(await loadPhoto(photo.file)), visibility: 'members',
  takenAt: photo.takenAt, takenSource: 'manual', viewpoint: photo.viewpoint, viewpointSource: 'manual',
}, { key: key(`photo-${person.npc.key}-${index}`) })).photo;

const named = value => typeof value === 'string' && value !== '';
/** The marker row, or null when there is none (or no marker table yet); { unreadable: true } for a row that is not a marker. Reads only: a database that has no showcase is left untouched. */
const readMarker = runtime => runtime.maintenance(db => {
  if (!db.exec(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '${META_TABLE}'`).length) return null;
  const raw = db.exec(`SELECT value FROM ${META_TABLE} WHERE key = '${MARKER_KEY}'`)[0]?.values[0]?.[0];
  if (typeof raw !== 'string') return null;
  let marker;
  try { marker = JSON.parse(raw); } catch { return { unreadable: true }; }
  const whole = named(marker?.version) && named(marker.room?.id) && named(marker.room?.code) && named(marker.cupId) && named(marker.gameId);
  return whole ? marker : { unreadable: true, version: named(marker?.version) ? marker.version : null };
});

/** The cast's identities: POST /api/avatar/session with fixed keys, which creates them once and answers with the same tokens ever after. */
async function introduce(client) {
  const people = {};
  for (const npc of NPCS) {
    const session = await client.request('/session', { namespace: 'avatar', method: 'POST', bodyJson: JSON.stringify({ name: npc.name, avatar: npc.avatar }), key: key(`npc-${npc.key}-session`) });
    people[npc.key] = { npc, id: session.user.id, token: session.token, api: actor(client, session.token) };
  }
  return people;
}

/** Every photo the cast uploads before the visitor comes, read up front and side by side: a missing or unreachable file then stops the seed before it writes anything. */
async function loadCastPhotos(loadPhoto) {
  const files = [...new Set(NPCS.filter(npc => npc.joins === 'seed').flatMap(npc => npc.photos.map(photo => photo.file)))];
  return new Map(await Promise.all(files.map(async file => [file, await loadPhoto(file)])));
}

/**
 * The venue keeps its fans after the show: 阿遥 (the host) opens the venue's fan community, links the show's room to it and posts the next
 * show there (ROOM.community). Every step replays like the others; the one update that carries a revision is skipped once it is in place,
 * because a replayed key with a newer revision would conflict.
 */
async function openCommunity({ host, room }) {
  const plan = ROOM.community;
  const { community } = await host.api.post('/communities', { title: plan.title, joinConsent: true }, { key: key('community') });
  await host.api.post(`/rooms/${room.id}/community`, { communityId: community.id }, { key: key('community-link') });
  const { space } = await host.api.get(`/communities/${community.id}/space`);
  if (space.title !== plan.title || space.description !== plan.description) {
    await host.api.post(`/communities/${community.id}/space`, { title: plan.title, description: plan.description, archived: false, revision: space.revision, editConsent: true }, { key: key('community-space') });
  }
  await host.api.post(`/communities/${community.id}/events`, { ...plan.next, organizeConsent: true }, { key: key('community-next') });
  return community.id;
}

/**
 * The world as it was before the visitor: 阿遥 opens the room, the people who are there join (open, with their participation) and upload their
 * photos with facts, join the room's group chat and say one line each, 阿遥 sets up an album cup and a one-round preference game that 小满
 * joins, and links the room to the venue's fan community with the next show in it. 林间 is not here yet (roster: joins 'after-visitor'; the
 * autopilot brings her).
 */
async function layOut({ runtime, people, photos, clock }) {
  const host = people[NPCS.find(npc => npc.host).key];
  const present = Object.values(people).filter(person => person.npc.joins === 'seed');
  const { room } = await host.api.post('/rooms', { title: ROOM.title, venue: ROOM.venue, songId: ROOM.songId, joinConsent: true, participation: host.npc.participation }, { key: key('room') });
  const upload = uploader({ room, loadPhoto: file => photos.get(file) });
  for (const person of present) {
    if (person !== host) await person.api.post(`/rooms/${room.code}/join`, { joinConsent: true, participation: person.npc.participation }, { key: key(`join-${person.npc.key}`) });
    for (const [index, photo] of person.npc.photos.entries()) await upload(person, photo, index);
  }
  for (const person of present) await person.api.post(`/rooms/${room.id}/conversation/join`, { joinConsent: true }, { key: key(`chatjoin-${person.npc.key}`) });
  for (const person of present) if (person.npc.line) await person.api.post(`/rooms/${room.id}/conversation/messages`, { text: person.npc.line }, { key: key(`say-${person.npc.key}-0`) });
  const cup = await host.api.post(`/rooms/${room.id}/worldcups`, { title: CUP_TITLE, createConsent: true }, { key: key('worldcup') });
  const game = await host.api.post(`/rooms/${room.id}/games`, { type: 'preference', title: GAME_TITLE, roundLimit: 1, createConsent: true }, { key: key('game') });
  // 小满 joins the game; the revision comes from the game itself (a replay finds him in it already, and a replayed key with a newer revision would conflict)
  const joining = people.man, waiting = await host.api.get(`/games/${game.gameId}`);
  if (!waiting.players.some(player => player.id === joining.id)) await joining.api.post(`/games/${game.gameId}/join`, { revision: waiting.game.revision, joinConsent: true }, { key: key('game-join-man') });
  await openCommunity({ host, room });
  const marker = { version: SHOWCASE_VERSION, room: { id: room.id, code: room.code }, cupId: cup.worldcup.id, gameId: game.gameId, seededAt: new Date(clock()).toISOString() };
  await runtime.maintenance(db => {
    db.run(`CREATE TABLE IF NOT EXISTS ${META_TABLE} (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
    db.run('UPDATE event_rooms SET expires_at = ? WHERE id = ?', [SHOWCASE_EXPIRES_AT, room.id]);
    db.run(`INSERT OR REPLACE INTO ${META_TABLE} (key, value) VALUES (?, ?)`, [MARKER_KEY, JSON.stringify(marker)]);
  });
  return marker;
}

/**
 * Makes sure the seeded world exists and hands back its people: { people, room: {id, code}, cupId, gameId, seeded }.
 *  - marker for this SHOWCASE_VERSION: nothing is written; the identities come back from replayed /session calls (same ids, same tokens).
 *  - no marker: the whole world is laid out inside runtime.batch(), so it is stored ONCE at the end, and a failure anywhere (a photo that
 *    cannot be read, a rejected request, a tab closed halfway) rethrows and stores nothing; the next boot starts from an empty database.
 *  - marker of another version (or not readable), or a replayed /session answering 409 IDEMPOTENCY_CONFLICT: throws ShowcaseStaleError before
 *    writing anything; the boot policy wipes the (disposable) data and calls this again.
 * `loadPhoto(file)` -> Uint8Array of a file in demo-assets. `transport` is the page's in-page fetch (it must not wait for the boot that is
 * calling this). `clock` is the runtime's clock (only the marker's seededAt reads it: the worker takes its own time from the runtime).
 * `runtime.maintenance(fn)` runs raw SQL on the same database (marker table, the showcase room's long expiry).
 */
export async function ensureShowcase({ runtime, loadPhoto, transport, clock = Date.now, client = createEventApiClient({ fetch: transport }) }) {
  const outcome = await runtime.batch(async () => {
    const marker = await readMarker(runtime);
    if (marker?.unreadable) return { stale: new ShowcaseStaleError('marker', { found: marker.version ?? null }) };
    if (marker && marker.version !== SHOWCASE_VERSION) return { stale: new ShowcaseStaleError('version', { found: marker.version }) };
    const photos = marker ? null : await loadCastPhotos(loadPhoto);          // before the first write
    let people;
    try { people = await introduce(client); }
    catch (error) {
      if (marker && error?.code === 'IDEMPOTENCY_CONFLICT') return { stale: new ShowcaseStaleError('idempotency-conflict', { cause: error }) };
      throw error;
    }
    if (marker) return { world: { people, room: marker.room, cupId: marker.cupId, gameId: marker.gameId, seeded: false } };
    const laid = await layOut({ runtime, people, photos, clock });
    return { world: { people, room: laid.room, cupId: laid.cupId, gameId: laid.gameId, seeded: true } };
  });
  if (outcome.stale) throw outcome.stale;
  return outcome.world;
}
