// The showcase world of the static site (web/static-runtime/showcase/roster.js and seed.js) and the six photos it uses
// (web/static-runtime/demo-assets, cut by scripts/demo/build-demo-photos.mjs). Real sql.js, the real worker code through the in-page runtime
// and transport, a memory store that counts writes, and a fake clock. Nothing here touches the network or a browser.
//
//   roster       the version is derived from the roster, every edit changes it, the cast and the three seeded lines are what the scene needs
//   demo-assets  manifest, hashes, worker sanitizer limits, crop overlap, EXIF of the two samples, the pixels the AI was measured on
//   seed         first seed, replay, one write, crash, stale marker, read-only copy, expiry, the pairing rules the walkthrough relies on
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { createStaticRuntime, DB_KEY } from '../web/static-runtime/runtime.js';
import { createTransport } from '../web/static-runtime/transport.js';
import { createMemoryStore } from '../web/static-runtime/idb-store.js';
import * as shimCrypto from '../web/static-runtime/shims/node-crypto.js';
import { createEventApiClient } from '../web/event-client/api.js';
import { ensureShowcase, actor, toDataUrl, ShowcaseStaleError, META_TABLE, MARKER_KEY, SHOWCASE_EXPIRES_AT, CUP_TITLE, GAME_TITLE } from '../web/static-runtime/showcase/seed.js';
import { ROOM, NPCS, SAMPLE_PHOTOS, SEED_REV, SHOWCASE_VERSION, EVENT_DATE, DISCLOSURE, canonicalJSON, showcaseVersion } from '../web/static-runtime/showcase/roster.js';
import { orderWall, readPair, venueTime, takenFromExif, SAME_MOMENT_MS } from '../web/js/moment.js';
import { readCaptureTime } from '../web/js/ai/exif-time.js';
import { safeAvatar } from '../web/avatar/model.js';
import { sanitizeAvatarJpeg } from '../runtime-preview/src/avatar-worker.js';
import { PLAN, MEASURED_SAMPLE_PIXELS, LIMITS, jpegSize } from '../scripts/demo/build-demo-photos.mjs';
import { stripCaptureTime } from '../scripts/demo/exif-inject.mjs';

const here = new URL('../', import.meta.url);
const readBytes = path => readFileSync(new URL(path, here));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const SQL = await createRequire(import.meta.url)('sql.js')();
const migrations = readdirSync(new URL('runtime-preview/drizzle/', here)).filter(name => name.endsWith('.sql')).sort()
  .map(name => ({ name, sql: readBytes(`runtime-preview/drizzle/${name}`).toString('utf8') }));
const ASSETS = 'web/static-runtime/demo-assets/';
const asset = file => new Uint8Array(readBytes(ASSETS + file));
const manifest = JSON.parse(readBytes(`${ASSETS}manifest.json`).toString('utf8'));
const entryOf = file => manifest.files.find(entry => entry.file === file);
const at = (hour, minute, second = 0) => venueTime(2026, 9, 26, hour, minute, second);
const clockText = ms => new Date(ms + 8 * 3_600_000).toISOString().slice(0, 19);       // the Asia/Shanghai wall clock of an instant
const T0 = Date.parse('2026-10-12T10:00:00Z');
const DAY = 86_400_000;

// ---- roster ----------------------------------------------------------------------------------------------------------------------------

/** Keys sorted at every level, compact: written here again, independently of roster.js's own canonicalJSON. */
const sortedKeys = value => (Array.isArray(value) ? value.map(sortedKeys)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sortedKeys(value[key])])) : value);
const parts = () => structuredClone({ ROOM, NPCS, SAMPLE_PHOTOS, SEED_REV });

test('roster: SHOWCASE_VERSION is r + the first 10 hex digits of the sha256 of the canonical JSON of {ROOM, NPCS, SAMPLE_PHOTOS, SEED_REV}', () => {
  const expected = `r${sha256(JSON.stringify(sortedKeys({ ROOM, NPCS, SAMPLE_PHOTOS, SEED_REV }))).slice(0, 10)}`;
  assert.equal(SHOWCASE_VERSION, expected);
  assert.match(SHOWCASE_VERSION, /^r[0-9a-f]{10}$/);
  assert.equal(showcaseVersion(parts()), SHOWCASE_VERSION);
  // the browser build hashes with the pure-JS shim (the Vite alias for node:crypto): the same text must give the same version there
  assert.equal(`r${shimCrypto.createHash('sha256').update(canonicalJSON(parts())).digest('hex').slice(0, 10)}`, SHOWCASE_VERSION);
  // and the order the keys were written in does not matter
  const shuffled = parts();
  shuffled.NPCS[0] = Object.fromEntries(Object.entries(shuffled.NPCS[0]).reverse());
  shuffled.ROOM = Object.fromEntries(Object.entries(shuffled.ROOM).reverse());
  assert.equal(showcaseVersion(shuffled), SHOWCASE_VERSION);
});

test('roster: any edit changes the version by itself (a browser holding the old world then lays out the new one)', () => {
  const edits = {
    'room title': p => { p.ROOM.title += '！'; },
    'room venue': p => { p.ROOM.venue = '月台'; },
    'room song': p => { p.ROOM.songId = 'moon-window'; },
    'a name': p => { p.NPCS[1].name = '小满'; },
    'the host flag': p => { delete p.NPCS[0].host; },
    'a participation': p => { p.NPCS[2].participation = 'quiet'; },
    'when 林间 joins': p => { p.NPCS[3].joins = 'seed'; },
    'an avatar skin': p => { p.NPCS[0].avatar.skin = 3; },
    'an avatar accessory': p => { p.NPCS[1].avatar.accessory = 'cap'; },
    'a photo file': p => { p.NPCS[0].photos[0].file = 'other.jpg'; },
    'a viewpoint': p => { p.NPCS[1].photos[0].viewpoint = 'stage'; },
    'a capture time by one second': p => { p.NPCS[1].photos[0].takenAt += 1000; },
    'a photo removed': p => { p.NPCS[1].photos.pop(); },
    'a photo added to 林间': p => { p.NPCS[3].photos.push({ file: 'x.jpg', viewpoint: 'detail', takenAt: at(22, 0) }); },
    'a person removed': p => { p.NPCS.pop(); },
    'a person added': p => { p.NPCS.push({ ...p.NPCS[3], key: 'extra' }); },
    'a seeded line': p => { p.NPCS[0].line += '。'; },
    'a sample label': p => { p.SAMPLE_PHOTOS[0].label += ' '; },
    'a sample note': p => { p.SAMPLE_PHOTOS[1].note = '虚构的拍摄时间 21:50，写在文件里'; },
    'a sample file': p => { p.SAMPLE_PHOTOS[0].file = 'sample-other.jpg'; },
    'a sample id': p => { p.SAMPLE_PHOTOS[0].id = 'sample-x'; },
    'the order of the samples': p => { p.SAMPLE_PHOTOS.reverse(); },
    'SEED_REV': p => { p.SEED_REV += 1; },
  };
  const seen = new Map([[SHOWCASE_VERSION, 'unchanged']]);
  for (const [name, edit] of Object.entries(edits)) {
    const edited = parts();
    edit(edited);
    const version = showcaseVersion(edited);
    assert.match(version, /^r[0-9a-f]{10}$/);
    assert.ok(!seen.has(version), `${name} gives the version of ${seen.get(version)}`);
    seen.set(version, name);
  }
});

test('roster: four labelled fictional people, three there before the visitor with four photos, 林间 quiet and late with none', () => {
  assert.equal(EVENT_DATE, '2026.09.26');
  assert.deepEqual({ ...ROOM }, { title: '回声现场 · 示例场', venue: '月台 Livehouse（虚构场地）', songId: 'late-train' });
  assert.deepEqual(NPCS.map(npc => npc.key), ['yao', 'man', 'bei', 'lin']);
  assert.deepEqual(NPCS.map(npc => npc.name), ['阿遥·示例', '小满·示例', '北屿·示例', '林间·示例']);
  assert.deepEqual(NPCS.filter(npc => npc.host).map(npc => npc.key), ['yao'], 'one host, and it is the first');
  assert.equal(NPCS[0].host, true);
  const present = NPCS.filter(npc => npc.joins === 'seed'), late = NPCS.filter(npc => npc.joins === 'after-visitor');
  assert.deepEqual(present.map(npc => [npc.key, npc.participation]), [['yao', 'open'], ['man', 'open'], ['bei', 'open']]);
  assert.deepEqual(late.map(npc => [npc.key, npc.participation, npc.photos.length, npc.line]), [['lin', 'quiet', 0, undefined]]);
  assert.deepEqual(present.flatMap(npc => npc.photos.map(photo => [npc.key, photo.file, photo.viewpoint, photo.takenAt])), [
    ['yao', 'yao-stage.jpg', 'stage', at(21, 47, 20)],
    ['man', 'man-crowd.jpg', 'crowd', at(21, 48, 5)],
    ['man', 'man-near.jpg', 'friends', at(22, 21, 10)],
    ['bei', 'bei-balcony.jpg', 'detail', at(21, 49, 30)],
  ]);
  // all of it on the fictional night, on the Asia/Shanghai clock
  assert.deepEqual(present.flatMap(npc => npc.photos.map(photo => clockText(photo.takenAt))),
    ['2026-09-26T21:47:20', '2026-09-26T21:48:05', '2026-09-26T22:21:10', '2026-09-26T21:49:30']);
  assert.ok(Object.isFrozen(NPCS) && Object.isFrozen(NPCS[1].photos[0]) && Object.isFrozen(NPCS[0].avatar) && Object.isFrozen(ROOM) && Object.isFrozen(SAMPLE_PHOTOS[0]));
  // valid v2 avatars, each its own look (the worker validates them again in the seed test)
  for (const npc of NPCS) assert.deepEqual(safeAvatar(npc.avatar), npc.avatar, npc.key);
  assert.equal(new Set(NPCS.map(npc => JSON.stringify(npc.avatar))).size, 4);
});

test('roster: the samples, and the lines the cast says on its own, which always say they are automatic', () => {
  assert.deepEqual(SAMPLE_PHOTOS.map(sample => ({ ...sample })), [
    { id: 'sample-crowd', file: 'sample-crowd.jpg', label: '人海 · 示例照片', note: '虚构的拍摄时间 21:48，写在文件里' },
    { id: 'sample-stage', file: 'sample-stage.jpg', label: '舞台 · 示例照片', note: '虚构的拍摄时间 21:47，写在文件里' },
  ]);
  const lines = NPCS.filter(npc => npc.line).map(npc => npc.line);
  assert.equal(lines.length, 3);
  for (const line of lines) {
    assert.ok(line.endsWith(DISCLOSURE), line);
    assert.ok(line.length > DISCLOSURE.length + 8 && [...line].length <= 120, line);
    assert.ok(!/我是真人|真实观众|真实用户/.test(line), line);
  }
  assert.match(DISCLOSURE, /自动回复/);
  assert.match(DISCLOSURE, /不是真人/);
});

// ---- demo-assets -----------------------------------------------------------------------------------------------------------------------

test('demo-assets: the folder holds the six photos and manifest.json, and every size and sha256 matches the manifest', () => {
  const files = manifest.files.map(entry => entry.file);
  assert.deepEqual(files.sort(), ['bei-balcony.jpg', 'man-crowd.jpg', 'man-near.jpg', 'sample-crowd.jpg', 'sample-stage.jpg', 'yao-stage.jpg']);
  assert.deepEqual(readdirSync(new URL(ASSETS, here)).sort(), [...files, 'manifest.json'].sort());
  for (const entry of manifest.files) {
    const bytes = readBytes(ASSETS + entry.file);
    assert.equal(bytes.length, entry.bytes, `${entry.file} bytes`);
    assert.equal(sha256(bytes), entry.sha256, `${entry.file} sha256`);
  }
});

test('demo-assets: the roster, the samples and the manifest name the same files', () => {
  const named = [...NPCS.flatMap(npc => npc.photos.map(photo => photo.file)), ...SAMPLE_PHOTOS.map(sample => sample.file)];
  assert.equal(new Set(named).size, 6, 'no file is used twice');
  assert.deepEqual([...named].sort(), manifest.files.map(entry => entry.file).sort());
});

test('demo-assets: every file passes the worker sanitizer (JPEG, under 300 KB, at most 2400 px and 4 MP) at the size the manifest says', () => {
  for (const entry of manifest.files) {
    const bytes = readBytes(ASSETS + entry.file);
    assert.doesNotThrow(() => sanitizeAvatarJpeg(`data:image/jpeg;base64,${bytes.toString('base64')}`), entry.file);
    const { width, height } = jpegSize(bytes);
    assert.deepEqual([width, height], [entry.width, entry.height], `${entry.file} size`);
    assert.ok(bytes.length < 300 * 1024 && bytes.length <= LIMITS.bytes, `${entry.file} ${bytes.length} bytes`);
    assert.ok(width <= 2400 && height <= 2400 && width * height <= 4_000_000, `${entry.file} ${width}x${height}`);
  }
});

test('demo-assets: crops come from the two recorded sources, match the build script, and no two of one source overlap by more than 35 percent of the smaller', t => {
  assert.deepEqual(manifest.sources.map(source => [source.file, source.width, source.height]), [['stage-scene.png', 1536, 1024], ['crowd-scene.png', 1536, 1024]]);
  const provenance = JSON.parse(readBytes('web/assets/image-provenance.json').toString('utf8'));
  for (const source of manifest.sources) assert.equal(source.sha256, provenance.assets.find(asset => asset.file === source.file).sha256, `${source.file} is the recorded image`);
  assert.deepEqual(manifest.files.map(({ file, source, box }) => ({ file, source, box })), PLAN.map(({ file, source, box }) => ({ file, source, box })), 'manifest.json is what the build script would write');
  for (const { file, box, source } of manifest.files) {
    const size = manifest.sources.find(item => item.file === source);
    assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.w <= size.width && box.y + box.h <= size.height, `${file} lies inside ${source}`);
  }
  let worst = 0;
  for (const [index, a] of manifest.files.entries()) {
    for (const b of manifest.files.slice(index + 1)) {
      if (a.source !== b.source) continue;
      const wide = Math.min(a.box.x + a.box.w, b.box.x + b.box.w) - Math.max(a.box.x, b.box.x);
      const high = Math.min(a.box.y + a.box.h, b.box.y + b.box.h) - Math.max(a.box.y, b.box.y);
      const share = Math.max(0, wide) * Math.max(0, high) / Math.min(a.box.w * a.box.h, b.box.w * b.box.h);
      worst = Math.max(worst, share);
      assert.ok(share <= 0.35, `${a.file} and ${b.file} overlap by ${(share * 100).toFixed(1)} percent of the smaller`);
    }
  }
  t.diagnostic(`largest overlap of two crops of one source: ${(worst * 100).toFixed(1)} percent of the smaller`);
});

test('demo-assets: the two samples carry their fictional capture time in EXIF (21:47:50 and 21:48:10, +08:00) and the reader trusts it', async () => {
  const expected = { 'sample-stage.jpg': [at(21, 47, 50), '2026-09-26T21:47:50'], 'sample-crowd.jpg': [at(21, 48, 10), '2026-09-26T21:48:10'] };
  for (const [file, [ms, local]] of Object.entries(expected)) {
    const found = await readCaptureTime(new File([asset(file)], file, { type: 'image/jpeg' }));
    assert.equal(found.local, local, file);
    assert.equal(found.offset, '+08:00', file);
    assert.equal(found.epochMs, ms, file);
    assert.equal(found.source, 'DateTimeOriginal', file);
    const taken = takenFromExif(found);
    assert.equal(taken.trusted, true, file);
    assert.deepEqual([taken.takenAt, taken.origin, taken.zoneAssumed], [ms, 'exif', false], file);
    assert.equal(entryOf(file).fictionalExifTime, `${local}+08:00`);
  }
  assert.ok(SAMPLE_PHOTOS.find(sample => sample.id === 'sample-stage').note.includes('21:47'));
  assert.ok(SAMPLE_PHOTOS.find(sample => sample.id === 'sample-crowd').note.includes('21:48'));
  // the four cast photos have no capture time of their own: their facts travel as API fields, set by the person they belong to
  for (const entry of manifest.files.filter(item => !item.file.startsWith('sample-'))) {
    assert.equal(await readCaptureTime(new File([asset(entry.file)], entry.file, { type: 'image/jpeg' })), null, entry.file);
    assert.equal(entry.fictionalExifTime, null);
  }
});

test('demo-assets: the samples keep the pixels the on-device AI was measured on (changing them means measuring again)', () => {
  assert.deepEqual(Object.keys(MEASURED_SAMPLE_PIXELS).sort(), ['sample-crowd.jpg', 'sample-stage.jpg']);
  for (const [file, hash] of Object.entries(MEASURED_SAMPLE_PIXELS)) {
    const bytes = readBytes(ASSETS + file);
    assert.equal(sha256(stripCaptureTime(bytes)), hash, `${file}: the encoder's own bytes are not the measured ones; measure the AI again (architecture 7.5) before updating MEASURED_SAMPLE_PIXELS`);
    assert.equal(entryOf(file).pixelSha256, hash, file);
    assert.equal(bytes.length - stripCaptureTime(bytes).length, 94, 'the only addition is the one stamped Exif segment');
  }
});

// ---- seed ------------------------------------------------------------------------------------------------------------------------------

/** A memory store that counts what is written to it, per object store. */
function countingStore() {
  const store = createMemoryStore();
  const puts = { kv: 0, blobs: 0 };
  const put = store.put.bind(store);
  store.put = async (name, key, value) => { puts[name] += 1; return put(name, key, value); };
  return Object.assign(store, { puts });
}

/** A runtime on a store with a fake clock, plus the in-page transport and a photo loader that records what it was asked for. */
async function openWorld({ storage = countingStore(), writable = true, clock: given } = {}) {
  let time = given ?? T0;
  const clock = () => time;
  const runtime = await createStaticRuntime({ SQL, migrations, storage, clock, writable });
  const transport = createTransport(() => runtime, () => { throw new Error('the network must not be used'); });
  const loads = [];
  const loadPhoto = async file => { loads.push(file); return asset(file); };
  const world = {
    storage, runtime, clock, transport, loads, loadPhoto,
    advance: ms => { time += ms; },
    seed: (extra = {}) => ensureShowcase({ runtime, loadPhoto, transport, clock, ...extra }),
    sql: query => runtime.maintenance(db => db.exec(query)[0]?.values ?? []),
    marker: async () => {
      if (!(await world.sql(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '${META_TABLE}'`)).length) return null;
      const rows = await world.sql(`SELECT value FROM ${META_TABLE} WHERE key = '${MARKER_KEY}'`);
      return rows.length ? JSON.parse(rows[0][0]) : null;
    },
  };
  return world;
}

const VISITOR_AVATAR = { ...NPCS[1].avatar };
async function visitorJoins(world, seeded, name = '评委') {
  const client = createEventApiClient({ fetch: world.transport });
  const session = await client.request('/session', { namespace: 'avatar', method: 'POST', bodyJson: JSON.stringify({ name, avatar: VISITOR_AVATAR }), key: crypto.randomUUID() });
  const visitor = actor(client, session.token);
  await visitor.post(`/rooms/${seeded.room.code}/join`, { joinConsent: true, participation: 'open' });
  return { client, visitor, me: session.user };
}
/** The photo a visitor adds from a bundled sample: the time is read from the file's EXIF like the upload form does, the side is theirs. */
async function addSample(visitor, room, file, viewpoint) {
  const taken = takenFromExif(await readCaptureTime(new File([asset(file)], file, { type: 'image/jpeg' })));
  return (await visitor.post(`/rooms/${room.id}/photos`, {
    dataUrl: toDataUrl(asset(file)), visibility: 'members', takenAt: taken.takenAt, takenSource: 'exif', viewpoint, viewpointSource: 'manual',
  })).photo;
}
const card = photo => ({ id: photo.id, takenAt: photo.takenAt, takenSource: photo.takenSource, perspective: photo.viewpoint ?? '', createdAt: photo.createdAt });
const keyOf = seeded => new Map(Object.values(seeded.people).map(person => [person.id, person.npc.key]));

test('seed: the first run lays out 4 identities, 1 open room that never expires, 3 members, 4 photos with facts, 3 chat lines, 1 cup, 1 game', async () => {
  const world = await openWorld();
  const seeded = await world.seed();
  assert.equal(seeded.seeded, true);
  assert.deepEqual(Object.keys(seeded.people), ['yao', 'man', 'bei', 'lin']);
  const people = Object.values(seeded.people);
  for (const person of people) {
    assert.match(person.id, /^[0-9a-f-]{36}$/);
    assert.match(person.token, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(person.npc, NPCS.find(npc => npc.key === person.npc.key));
  }
  assert.equal(new Set(people.map(person => person.id)).size, 4);
  assert.equal(new Set(people.map(person => person.token)).size, 4);
  assert.deepEqual(await world.sql('SELECT COUNT(*) FROM avatar_users'), [[4]]);
  assert.deepEqual(await world.sql('SELECT COUNT(*) FROM event_rooms'), [[1]]);

  // what a stranger holding the code sees: an open room, listed until 2099, written on the runtime's clock
  const client = createEventApiClient({ fetch: world.transport });
  const { preview } = await client.request(`/preview/${seeded.room.code}`);
  assert.deepEqual([preview.status, preview.title, preview.venue, preview.expiresAt], ['open', ROOM.title, ROOM.venue, SHOWCASE_EXPIRES_AT]);
  assert.equal(SHOWCASE_EXPIRES_AT, '2099-12-31T00:00:00.000Z');

  const host = seeded.people.yao.api, roomId = seeded.room.id;
  const view = await host.get(`/rooms/${roomId}`);
  assert.equal(view.room.createdAt, new Date(T0).toISOString(), 'the seed ran on the runtime clock');
  assert.equal(view.room.songId, ROOM.songId);
  assert.deepEqual(view.members.map(member => [member.name, member.participation]).sort(), [['北屿·示例', 'open'], ['小满·示例', 'open'], ['阿遥·示例', 'open']]);
  const keys = keyOf(seeded);
  assert.deepEqual(view.photos.map(photo => [keys.get(photo.ownerId), photo.viewpoint, photo.takenAt, photo.takenSource, photo.viewpointSource, photo.visibility]).sort((a, b) => a[2] - b[2]), [
    ['yao', 'stage', at(21, 47, 20), 'manual', 'manual', 'members'],
    ['man', 'crowd', at(21, 48, 5), 'manual', 'manual', 'members'],
    ['bei', 'detail', at(21, 49, 30), 'manual', 'manual', 'members'],
    ['man', 'friends', at(22, 21, 10), 'manual', 'manual', 'members'],
  ]);

  const chat = (await host.get(`/rooms/${roomId}/conversation/messages`)).messages;
  assert.deepEqual(chat.map(message => [keys.get(message.senderId), message.text]), NPCS.filter(npc => npc.line).map(npc => [npc.key, npc.line]));
  const cups = (await host.get(`/rooms/${roomId}/worldcups`)).worldcups;
  assert.deepEqual(cups.map(cup => [cup.id, cup.title, cup.creatorId, cup.completed]), [[seeded.cupId, CUP_TITLE, seeded.people.yao.id, false]]);
  assert.equal(CUP_TITLE, '今晚的专辑世界杯');
  const games = (await host.get(`/rooms/${roomId}/games`)).games;
  assert.deepEqual(games.map(game => [game.id, game.type, game.title, game.roundLimit, game.phase]), [[seeded.gameId, 'preference', GAME_TITLE, 1, 'waiting']]);
  assert.equal(GAME_TITLE, '今晚谁和你同一首');
  assert.deepEqual((await host.get(`/games/${seeded.gameId}`)).players.map(player => keys.get(player.id)).sort(), ['man', 'yao'], '小满 joined the game, nobody else yet');

  // the marker says what was laid out
  assert.deepEqual(await world.marker(), { version: SHOWCASE_VERSION, room: seeded.room, cupId: seeded.cupId, gameId: seeded.gameId, seededAt: new Date(T0).toISOString() });
});

test('seed: the world is stored once at the end (one snapshot write, four photo files), and a second call writes and reads nothing', async () => {
  const world = await openWorld();
  const seeded = await world.seed();
  assert.deepEqual({ ...world.storage.puts }, { kv: 1, blobs: 4 }, 'ensureShowcase runs inside runtime.batch: one snapshot, not one per request');
  assert.deepEqual(world.loads.sort(), ['bei-balcony.jpg', 'man-crowd.jpg', 'man-near.jpg', 'yao-stage.jpg'], 'only the cast photos are read, once each');
  const snapshot = await world.storage.get('kv', DB_KEY);

  world.loads.length = 0;
  const again = await world.seed();
  assert.equal(again.seeded, false);
  assert.deepEqual(world.loads, [], 'no photo is read when the world is there');
  assert.deepEqual({ ...world.storage.puts }, { kv: 1, blobs: 4 }, 'nothing written');
  assert.deepEqual(await world.storage.get('kv', DB_KEY), snapshot);
  assert.deepEqual(again.room, seeded.room);
  assert.equal(again.cupId, seeded.cupId);
  assert.equal(again.gameId, seeded.gameId);
  for (const key of Object.keys(seeded.people)) {
    assert.equal(again.people[key].id, seeded.people[key].id, `${key} id`);
    assert.equal(again.people[key].token, seeded.people[key].token, `${key} token`);
  }
  // the re-derived tokens are real: they open the same rooms
  assert.equal((await again.people.man.api.get(`/rooms/${seeded.room.id}`)).members.length, 3);
});

test('seed: a reload keeps the same people and tokens (a new runtime on the saved snapshot) and writes nothing', async () => {
  const first = await openWorld();
  const seeded = await first.seed();
  await first.runtime.close();
  const second = await openWorld({ storage: first.storage });
  assert.equal(second.runtime.fresh, false);
  const puts = { ...first.storage.puts };
  const again = await second.seed();
  assert.equal(again.seeded, false);
  assert.deepEqual(second.loads, []);
  assert.deepEqual({ ...first.storage.puts }, puts);
  assert.deepEqual(again.room, seeded.room);
  for (const key of Object.keys(seeded.people)) assert.deepEqual([again.people[key].id, again.people[key].token], [seeded.people[key].id, seeded.people[key].token], key);
});

test('seed: with the marker gone and the data still there, running again replays every step (fixed Idempotency-Keys): same room, same people, nothing doubled', async () => {
  const world = await openWorld();
  const seeded = await world.seed();
  const tables = ['avatar_users', 'event_rooms', 'event_members', 'event_photos', 'event_group_messages', 'event_worldcups', 'event_games', 'event_game_players'];
  const counts = async () => Promise.all(tables.map(async table => (await world.sql(`SELECT COUNT(*) FROM ${table}`))[0][0]));
  const before = await counts();
  assert.deepEqual(before.slice(0, 7), [4, 1, 3, 4, 3, 1, 1]);
  const marker = await world.marker();
  await world.runtime.maintenance(db => db.run(`DROP TABLE ${META_TABLE}`));
  const blobs = world.storage.puts.blobs;
  world.loads.length = 0;
  const again = await world.seed();
  assert.equal(again.seeded, true, 'without the marker the steps run again');
  assert.deepEqual(world.loads.sort(), ['bei-balcony.jpg', 'man-crowd.jpg', 'man-near.jpg', 'yao-stage.jpg']);
  assert.deepEqual(await counts(), before, 'every request was a replay: nothing was created twice');
  assert.equal(world.storage.puts.blobs, blobs, 'no photo file was stored twice');
  assert.deepEqual([again.room, again.cupId, again.gameId], [seeded.room, seeded.cupId, seeded.gameId]);
  for (const key of Object.keys(seeded.people)) assert.deepEqual([again.people[key].id, again.people[key].token], [seeded.people[key].id, seeded.people[key].token], key);
  assert.deepEqual(await world.sql('SELECT expires_at FROM event_rooms'), [[SHOWCASE_EXPIRES_AT]]);
  assert.deepEqual(await world.marker(), marker);
});

test('seed: a failure before the end stores nothing and leaves no marker, so the next boot starts clean (a photo that cannot be read, a request that fails mid-way)', async () => {
  // a photo that cannot be read: every photo is read before the first write
  const unreadable = await openWorld();
  let reads = 0;
  await assert.rejects(unreadable.seed({ loadPhoto: async file => { if (++reads === 3) throw new Error('disk gone'); return asset(file); } }), /disk gone/);
  assert.deepEqual({ ...unreadable.storage.puts }, { kv: 0, blobs: 0 });
  assert.equal(await unreadable.storage.get('kv', DB_KEY), undefined);

  // a request that fails after the room, the people and the photos exist in memory
  const crashed = await openWorld();
  const flaky = async (input, init) => { if (String(input).includes('/worldcups')) throw new TypeError('connection lost'); return crashed.transport(input, init); };
  await assert.rejects(crashed.seed({ transport: flaky }), error => error.code === 'NETWORK');
  assert.equal(crashed.storage.puts.kv, 0, 'no snapshot was written');
  assert.equal(await crashed.storage.get('kv', DB_KEY), undefined);

  // each store is as good as new: no snapshot, so a fresh database, no marker, and the whole seed works
  for (const failed of [unreadable, crashed]) {
    const next = await openWorld({ storage: failed.storage });
    assert.equal(next.runtime.fresh, true);
    assert.equal(await next.marker(), null);
    const before = next.storage.puts.kv;              // reading through maintenance() outside a batch stores the migrated, empty database once
    assert.equal((await next.seed()).seeded, true);
    assert.equal(next.storage.puts.kv, before + 1);
  }
});

test('seed: a marker of another version (another roster) is stale: ShowcaseStaleError, nothing read or written, the runtime still works', async () => {
  const world = await openWorld();
  const seeded = await world.seed();
  const old = { version: 'r0000000000', room: seeded.room, cupId: seeded.cupId, gameId: seeded.gameId };
  await world.runtime.maintenance(db => db.run(`UPDATE ${META_TABLE} SET value = ? WHERE key = '${MARKER_KEY}'`, [JSON.stringify(old)]));
  world.loads.length = 0;
  const puts = { ...world.storage.puts };
  await assert.rejects(world.seed(), error => {
    assert.ok(error instanceof ShowcaseStaleError);
    assert.deepEqual([error.name, error.code, error.reason, error.found, error.expected], ['ShowcaseStaleError', 'SHOWCASE_STALE', 'version', 'r0000000000', SHOWCASE_VERSION]);
    return true;
  });
  assert.deepEqual(world.loads, []);
  assert.deepEqual({ ...world.storage.puts }, puts);
  // the stale check did not poison the runtime: a later request is still stored
  await visitorJoins(world, seeded);
  assert.ok(world.storage.puts.kv > puts.kv);

  // a marker nobody can read, or one that does not name the room, the cup and the game, is not this build's either
  for (const [value, found] of [['{not json', null], ['null', null], [JSON.stringify({ version: SHOWCASE_VERSION, room: seeded.room }), SHOWCASE_VERSION], [JSON.stringify({ ...old, room: { id: '' } }), 'r0000000000']]) {
    await world.runtime.maintenance(db => db.run(`UPDATE ${META_TABLE} SET value = ? WHERE key = '${MARKER_KEY}'`, [value]));
    await assert.rejects(world.seed(), error => error instanceof ShowcaseStaleError && error.reason === 'marker' && error.found === found, value);
  }
  assert.deepEqual(world.loads, [], 'still nothing read');
});

test('seed: a database laid out by one roster is stale for a build whose roster was edited (copies of roster.js and seed.js with one name changed)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'showcase-edited-'));
  try {
    const source = new URL('web/static-runtime/showcase/', here);
    const rewrite = text => text.replace(/from '(\.{1,2}\/[^']+)'/g, (match, spec) => (spec === './roster.js' ? match : `from '${new URL(spec, source).href}'`));
    const roster = rewrite(readBytes('web/static-runtime/showcase/roster.js').toString('utf8')).replace("name: '小满·示例'", "name: '小满·示例二'");
    assert.ok(roster.includes("'小满·示例二'"), 'the copy carries the edited name');
    writeFileSync(join(dir, 'roster.js'), roster);
    writeFileSync(join(dir, 'seed.js'), rewrite(readBytes('web/static-runtime/showcase/seed.js').toString('utf8')));
    const edited = await import(pathToFileURL(join(dir, 'seed.js')).href);
    const editedRoster = await import(pathToFileURL(join(dir, 'roster.js')).href);
    assert.notEqual(editedRoster.SHOWCASE_VERSION, SHOWCASE_VERSION, 'one edited name is another version');
    assert.equal(editedRoster.NPCS[1].name, '小满·示例二');

    // the world the real build laid out, opened by the edited build
    const world = await openWorld();
    await world.seed();
    const puts = { ...world.storage.puts };
    world.loads.length = 0;
    await assert.rejects(edited.ensureShowcase({ runtime: world.runtime, loadPhoto: world.loadPhoto, transport: world.transport, clock: world.clock }), error => {
      assert.deepEqual([error.name, error.code, error.reason, error.found, error.expected], ['ShowcaseStaleError', 'SHOWCASE_STALE', 'version', SHOWCASE_VERSION, editedRoster.SHOWCASE_VERSION]);
      return true;
    });
    assert.deepEqual(world.loads, []);
    assert.deepEqual({ ...world.storage.puts }, puts);

    // and the other way round: the edited build's world is stale for the real build
    const other = await openWorld();
    assert.equal((await edited.ensureShowcase({ runtime: other.runtime, loadPhoto: other.loadPhoto, transport: other.transport, clock: other.clock })).seeded, true);
    await assert.rejects(other.seed(), error => error instanceof ShowcaseStaleError && error.found === editedRoster.SHOWCASE_VERSION && error.expected === SHOWCASE_VERSION);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('seed: a character whose /session key replays with another request (409 IDEMPOTENCY_CONFLICT) is stale too, before anything is written', async () => {
  const world = await openWorld();
  await world.seed();
  const keyHash = sha256(`showcase-${SHOWCASE_VERSION}-npc-yao-session`);
  await world.runtime.maintenance(db => db.run("UPDATE avatar_idempotency SET request_hash = 'another request' WHERE key_hash = ?", [keyHash]));
  const puts = { ...world.storage.puts };
  await assert.rejects(world.seed(), error => {
    assert.ok(error instanceof ShowcaseStaleError);
    assert.equal(error.reason, 'idempotency-conflict');
    assert.equal(error.cause.code, 'IDEMPOTENCY_CONFLICT');
    return true;
  });
  assert.deepEqual({ ...world.storage.puts }, puts);
});

test('seed: a read-only copy (a second tab) cannot seed: it throws READ_ONLY_COPY and stores nothing', async () => {
  const world = await openWorld({ writable: false });
  await assert.rejects(world.seed(), error => error.code === 'READ_ONLY_COPY');
  assert.deepEqual({ ...world.storage.puts }, { kv: 0, blobs: 0 });
});

test('seed: rooms the visitor opens keep the 24 hour rule while the showcase room stays open', async () => {
  const world = await openWorld();
  const seeded = await world.seed();
  world.advance(DAY * 3);                                   // three days later the visitor's own room is gone, the showcase is not
  const { visitor, client } = await visitorJoins(world, seeded);
  const mine = (await visitor.post('/rooms', { title: '我的一晚', venue: '某处', songId: 'late-train', joinConsent: true, participation: 'open' })).room;
  assert.equal(mine.expiresAt, new Date(world.clock() + DAY).toISOString());
  assert.equal((await client.request(`/preview/${seeded.room.code}`)).preview.status, 'open');
  world.advance(DAY + 1000);
  assert.equal((await client.request(`/preview/${mine.code}`)).preview.status, 'expired');
  assert.equal((await client.request(`/preview/${seeded.room.code}`)).preview.status, 'open');
});

test('seed: before the visitor does anything the wall holds a 同一刻 group of three viewpoints (21:47-21:49), and 小满\'s second photo is outside it', async () => {
  const world = await openWorld();
  const seeded = await world.seed();
  const view = await seeded.people.yao.api.get(`/rooms/${seeded.room.id}`);
  const keys = keyOf(seeded);
  const cards = view.photos.map(card);
  const first = Math.min(...cards.map(item => item.takenAt));
  const group = cards.filter(item => item.takenAt - first <= SAME_MOMENT_MS);
  assert.deepEqual(group.map(item => item.perspective).sort(), ['crowd', 'detail', 'stage']);
  assert.deepEqual(group.map(item => clockText(item.takenAt).slice(11, 16)).sort(), ['21:47', '21:48', '21:49']);
  for (const a of group) for (const b of group.filter(other => other !== a)) {
    const reading = readPair(a, b, { event: { date: EVENT_DATE } });
    assert.ok(reading.same && reading.basis === 'time', `${a.perspective} and ${b.perspective} are one moment by capture time`);
    assert.ok(reading.complementary, 'three different sides');
  }
  const outside = cards.filter(item => !group.includes(item));
  assert.deepEqual(outside.map(item => item.perspective), ['friends']);
  assert.equal(keys.get(view.photos.find(photo => photo.id === outside[0].id).ownerId), 'man');
  for (const other of group) assert.equal(readPair(outside[0], other, { event: { date: EVENT_DATE } }).basis, 'apart');
});

test('seed: the bundled samples pair by the real rules: stage with 小满\'s crowd photo, crowd with 阿遥\'s stage photo', async () => {
  const world = await openWorld();
  const seeded = await world.seed();
  world.advance(60_000);
  const { visitor, me } = await visitorJoins(world, seeded);
  world.advance(1000);
  const crowd = await addSample(visitor, seeded.room, 'sample-crowd.jpg', 'crowd');
  world.advance(1000);
  const stage = await addSample(visitor, seeded.room, 'sample-stage.jpg', 'stage');
  assert.deepEqual([crowd.takenAt, stage.takenAt], [at(21, 48, 10), at(21, 47, 50)]);
  const view = await visitor.get(`/rooms/${seeded.room.id}`);
  const byId = new Map(view.photos.map(photo => [photo.id, photo]));
  const keys = keyOf(seeded);
  const others = view.photos.filter(photo => photo.ownerId !== me.id);
  const event = { date: EVENT_DATE };

  const forStage = orderWall(card(byId.get(stage.id)), others.map(card), { event });
  const bestForStage = byId.get(forStage.best);
  assert.deepEqual([keys.get(bestForStage.ownerId), bestForStage.viewpoint], ['man', 'crowd']);
  assert.equal(forStage.items.find(item => item.card.id === forStage.best).reading.detail, '同一刻 · 21:47，相差不到 1 分钟；你拍舞台，TA 拍人海');

  const forCrowd = orderWall(card(byId.get(crowd.id)), others.map(card), { event });
  const bestForCrowd = byId.get(forCrowd.best);
  assert.deepEqual([keys.get(bestForCrowd.ownerId), bestForCrowd.viewpoint], ['yao', 'stage']);
  assert.equal(forCrowd.items.find(item => item.card.id === forCrowd.best).reading.detail, '同一刻 · 21:47，相差不到 1 分钟；你拍人海，TA 拍舞台');

  // 21:47-21:49 is one moment for both samples; 小满's 22:21 photo is not
  for (const wall of [forStage, forCrowd]) {
    assert.deepEqual(wall.items.filter(item => item.reading.same).map(item => byId.get(item.card.id).viewpoint).sort(), ['crowd', 'detail', 'stage']);
  }
});

test('seed: the visitor is one of the first four people and the visitor\'s own photos are among the first six on the wall', async () => {
  const world = await openWorld();
  const seeded = await world.seed();
  world.advance(60_000);
  const { visitor, me } = await visitorJoins(world, seeded);
  world.advance(1000);
  const crowd = await addSample(visitor, seeded.room, 'sample-crowd.jpg', 'crowd');
  world.advance(1000);
  const stage = await addSample(visitor, seeded.room, 'sample-stage.jpg', 'stage');
  const view = await visitor.get(`/rooms/${seeded.room.id}`);
  // portrait phones draw the first four people: three characters were there first, 林间 comes later
  assert.deepEqual(view.members.map(member => member.name).sort(), ['北屿·示例', '小满·示例', '评委', '阿遥·示例']);
  assert.equal(view.members.at(-1).id, me.id, 'members come in the order they joined: the visitor after the three characters');
  assert.ok(view.members.slice(0, 4).some(member => member.id === me.id));
  assert.ok(!view.members.some(member => member.name === '林间·示例'));
  // the 3D wall shows the first six member photos, oldest first: four are the cast's, so both of the visitor's fit
  assert.equal(view.photos.length, 6);
  const firstSix = view.photos.slice(0, 6).map(photo => photo.id);
  assert.ok(firstSix.includes(crowd.id) && firstSix.includes(stage.id));
  assert.deepEqual(view.photos.slice(0, 4).every(photo => photo.ownerId !== me.id), true, 'the cast\'s photos come first');
});

/** What the room holds once seeded, as text that does not depend on ids or the clock: names, facts, the bytes of every photo, lines, titles. */
async function worldDigest(seeded) {
  const host = seeded.people.yao.api, roomId = seeded.room.id, keys = keyOf(seeded);
  const view = await host.get(`/rooms/${roomId}`);
  const photos = [];
  for (const photo of view.photos) {
    const bytes = new Uint8Array(await (await host.blob(photo.id)).arrayBuffer());
    photos.push({ owner: keys.get(photo.ownerId), viewpoint: photo.viewpoint, takenAt: photo.takenAt, takenSource: photo.takenSource, viewpointSource: photo.viewpointSource, visibility: photo.visibility, sha256: sha256(bytes) });
  }
  photos.sort((a, b) => a.takenAt - b.takenAt);
  const game = await host.get(`/games/${seeded.gameId}`);
  return sha256(canonicalJSON({
    room: { title: view.room.title, venue: view.room.venue, songId: view.room.songId, status: view.room.status, expiresAt: view.room.expiresAt },
    members: view.members.map(member => [member.name, member.participation, member.avatar]).sort(),
    photos,
    chat: (await host.get(`/rooms/${roomId}/conversation/messages`)).messages.map(message => [keys.get(message.senderId), message.text]),
    cups: (await host.get(`/rooms/${roomId}/worldcups`)).worldcups.map(cup => [cup.title, cup.creatorId === seeded.people.yao.id, cup.fictional]),
    games: (await host.get(`/rooms/${roomId}/games`)).games.map(item => [item.type, item.title, item.roundLimit, item.phase]),
    players: game.players.map(player => keys.get(player.id)).sort(),
  })).slice(0, 16);
}

// One entry per SEED_REV, never edited afterwards: when the seeded world changes (a line, a title, a photo re-cut, the order of the steps) this fails
// until SEED_REV is raised and the new fingerprint is added under the new number. That is what makes browsers that hold the old world lay out the new one.
const PINNED_WORLD = { 1: '9e81cc5d430d093c' };

test('seed: the seeded world is pinned to SEED_REV (the fingerprint of what the room holds changes only together with SEED_REV)', async () => {
  const world = await openWorld();
  const digest = await worldDigest(await world.seed());
  assert.equal(PINNED_WORLD[SEED_REV], digest,
    `The seeded world changed, or SEED_REV ${SEED_REV} is not pinned. Raise SEED_REV in web/static-runtime/showcase/roster.js (browsers holding the old world must lay out the new one) and pin ${digest} under the new number.`);
});

test('seed: toDataUrl is base64 in chunks without Buffer, for every length around the chunk edge', () => {
  const saved = globalThis.Buffer;
  const cases = [0, 1, 2, 3, 4, 8191, 8192, 8193, 16384, 16385, 100_000].map(length => {
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) bytes[i] = (i * 31 + (i >> 8)) & 255;
    return [bytes, `data:image/jpeg;base64,${saved.from(bytes).toString('base64')}`];
  });
  globalThis.Buffer = undefined;
  try {
    for (const [bytes, expected] of cases) assert.equal(toDataUrl(bytes), expected, `${bytes.length} bytes`);
    assert.equal(toDataUrl(new Uint8Array([1, 2, 3]), 'image/png'), 'data:image/png;base64,AQID');
    // whatever a loader hands back: an ArrayBuffer, a view into a bigger buffer, a Buffer
    assert.equal(toDataUrl(new Uint8Array([1, 2, 3]).buffer), 'data:image/jpeg;base64,AQID');
    assert.equal(toDataUrl(new Uint8Array([9, 1, 2, 3, 9]).subarray(1, 4)), 'data:image/jpeg;base64,AQID');
  } finally { globalThis.Buffer = saved; }
  assert.equal(toDataUrl(saved.from([1, 2, 3])), 'data:image/jpeg;base64,AQID');
});

test('seed: the first seed takes well under 300 ms on the Node stack (best of three, each on an empty database)', async t => {
  const times = [];
  for (let run = 0; run < 3; run++) {
    const world = await openWorld();
    const start = performance.now();
    await world.seed();
    times.push(performance.now() - start);
  }
  t.diagnostic(`seed ms: ${times.map(ms => ms.toFixed(0)).join(', ')}`);
  assert.ok(Math.min(...times) < 300, `the fastest of three seeds took ${Math.min(...times).toFixed(0)} ms`);
});
