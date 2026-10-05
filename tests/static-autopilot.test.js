// The fictional cast's autopilot (web/static-runtime/showcase/autopilot.js) and its lines (npc-lines.js), against the REAL worker API: the
// workers run on sql.js through the static runtime, the world is laid out by the showcase seed, a fake clock is shared by the runtime and
// the autopilot, and the visitor is an ordinary bearer-token client. Every tick goes through w.tick(), which also checks that the autopilot
// used nothing but the cast's own tokens on /api/event. Needs sql.js (devDependency 1.14.2) and the showcase seed (roster.js, seed.js); when
// one of them is missing the world tests skip with the reason, and the tests of the lines and of the pure rules still run.
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import { createStaticRuntime } from '../web/static-runtime/runtime.js';
import { createTransport } from '../web/static-runtime/transport.js';
import { createMemoryStore } from '../web/static-runtime/idb-store.js';
import { createEventApiClient } from '../web/event-client/api.js';
import { createAutopilot, wantsExchange, cupPick, gameChoice, THINK_MS, ARRIVE_MS, INTERVAL_MS } from '../web/static-runtime/showcase/autopilot.js';
import { WELCOME_LINES, GENERIC_LINES, REPLY_LINES, GROUP_LINES, CHAT_LINES, DISCLOSURE, replyLine } from '../web/static-runtime/showcase/npc-lines.js';

const require = createRequire(import.meta.url);
let SQL = null, seed = null, roster = null, skip = false;
try { SQL = await require('sql.js')(); } catch (error) {
  if (error?.code !== 'MODULE_NOT_FOUND') throw error;                       // a broken install must fail loudly, only a missing one skips
  skip = 'sql.js is not installed (package.json devDependency sql.js 1.14.2)';
}
if (!skip) {
  try { [seed, roster] = await Promise.all([import('../web/static-runtime/showcase/seed.js'), import('../web/static-runtime/showcase/roster.js')]); } catch (error) {
    if (error?.code !== 'ERR_MODULE_NOT_FOUND' || !/showcase[\\/](seed|roster)\.js/.test(String(error.message))) throw error;
    skip = 'the showcase seed is not in the tree yet (web/static-runtime/showcase/seed.js and roster.js, task T7)';
  }
}
const worldTest = (name, fn) => test(name, { skip }, fn);

const root = new URL('../', import.meta.url);
const migrationDir = new URL('runtime-preview/drizzle/', root);
const assetDir = new URL('web/static-runtime/demo-assets/', root);
const migrations = skip ? [] : readdirSync(migrationDir).filter(name => name.endsWith('.sql')).sort().map(name => ({ name, sql: readFileSync(new URL(name, migrationDir), 'utf8') }));
const loadPhoto = async file => new Uint8Array(readFileSync(new URL(file, assetDir)));
const JPEG_FIXTURE = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAACAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDx6iiitzM//9k=';
const PHOTO_URL = `data:image/jpeg;base64,${JPEG_FIXTURE}`;
const AVATAR = { version: 2, skin: 1, hair: 0, hairColor: 0, outfit: 0, accessory: 'headphones', pose: 'sway', top: 0, bottom: 0, shoes: 1, eyewear: 0, topColor: 0, bottomColor: 1, shoeColor: 0, expression: 'neutral' };
const TAKEN_AT = Date.UTC(2026, 8, 26, 13, 47, 50);                          // 21:47:50 Asia/Shanghai on the fictional night
// An hour ahead of the device clock: SQLite's own strftime('now') in event-exchanges.js reads the device clock, and an exchange made at the fake
// time must not look expired to it (the runtime's real clock is never behind the device's, section 3.5 of the design).
const START = Math.max(Date.now(), Date.parse('2026-10-05T00:00:00Z')) + 3_600_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
/** Every mutation the cast may make (paths under /api/event); creating anything else is a bug. */
const ALLOWED_WRITES = [
  /^\/greetings\/[0-9a-f-]{36}\/accept$/,
  /^\/chats\/[0-9a-f-]{36}\/messages$/,
  /^\/exchanges\/[0-9a-f-]{36}\/(accept|decline)$/,
  /^\/rooms\/[A-Z2-7]{12}\/join$/,
  /^\/rooms\/[0-9a-f-]{36}\/conversation\/join$/,
  /^\/worldcups\/[0-9a-f-]{36}\/matches\/[0-9a-f-]{36}\/(vote|advance)$/,
  /^\/games\/[0-9a-f-]{36}\/(start|answer|reveal)$/,
];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(condition, what, timeoutMs = 4000) {
  const deadline = Date.now() + timeoutMs;
  while (!(await condition())) { if (Date.now() > deadline) assert.fail(`timed out waiting for ${what}`); await sleep(2); }
}
const caller = (client, token, id) => ({
  token, id,
  get: path => client.request(path, { token }),
  post: (path, body, key = crypto.randomUUID()) => client.request(path, { method: 'POST', token, bodyJson: JSON.stringify(body ?? {}), key }),
  blob: (path) => client.request(path, { token, blob: true }),
});

/** A fresh world: runtime on sql.js, the showcase laid out through the API, a fake clock the autopilot shares. Nothing but the cast has joined. */
async function createWorld({ settle = true } = {}) {
  const w = { time: START, sent: [], names: new Map(), visitor: null };
  w.clock = () => w.time;
  w.advance = ms => { w.time += ms; };
  w.storage = createMemoryStore();
  w.runtime = await createStaticRuntime({ SQL, migrations, storage: w.storage, clock: w.clock });
  w.connect = () => {                                                         // the page's fetch: the in-page transport, with every request written down
    const base = createTransport(() => w.runtime, () => { throw new Error('the network must not be used'); });
    w.fetch = async (input, init = {}) => {
      const url = new URL(String(input), 'http://page.test');
      const headers = init.headers ?? {};
      const entry = { method: init.method ?? 'GET', api: url.pathname.startsWith('/api/avatar') ? 'avatar' : 'event', path: url.pathname.replace(/^\/api\/(event|avatar)/, ''), query: url.search,
        token: /^Bearer (.+)$/.exec(headers.Authorization ?? '')?.[1] ?? null, key: headers['Idempotency-Key'] ?? null, body: init.body ? JSON.parse(init.body) : null, status: null };
      w.sent.push(entry);
      const response = await base(input, init);
      entry.status = response.status;
      return response;
    };
    w.client = createEventApiClient({ fetch: w.fetch });
  };
  w.connect();
  Object.assign(w, await seed.ensureShowcase({ runtime: w.runtime, loadPhoto, transport: w.fetch, clock: w.clock }));
  w.cast = new Map(Object.entries(w.people).map(([key, person]) => [person.token, key]));
  for (const [token, key] of w.cast) w.names.set(token, key);
  if (settle) w.advance(5000);                                                // the page has been open a while: the seeded cup and game are no longer brand new
  w.sent.length = 0;
  w.sql = async (query, ...args) => (await w.runtime.env.DB.prepare(query).bind(...args).all()).results;
  w.visit = async (participation = 'open') => {
    const session = await w.client.request('/session', { namespace: 'avatar', method: 'POST', bodyJson: JSON.stringify({ name: '评委', avatar: AVATAR }), key: crypto.randomUUID() });
    w.names.set(session.token, 'visitor');
    w.visitor = caller(w.client, session.token, session.user.id);
    await w.visitor.post(`/rooms/${w.room.code}/join`, { joinConsent: true, participation });
    return w.visitor;
  };
  w.pilot = (options = {}) => createAutopilot({ people: w.people, room: w.room, now: w.clock, ...options });
  /** One tick `ms` later. Everything the autopilot sent in it must carry a cast token and stay on /api/event. */
  w.tick = async (pilot, ms = 0) => {
    w.advance(ms);
    const from = w.sent.length, ran = await pilot.tick();
    for (const entry of w.sent.slice(from)) {
      assert.equal(entry.api, 'event', `${entry.method} ${entry.path}: the autopilot only uses /api/event`);
      assert.ok(w.cast.has(entry.token), `${entry.method} ${entry.path}: the autopilot only carries the cast's own bearer tokens`);
    }
    return ran;
  };
  /** Ticks 1.5 s apart (the real interval) until `done()` holds; fails when it takes more than `steps` ticks. */
  w.drive = async (pilot, done, { steps = 8, step = INTERVAL_MS } = {}) => {
    for (let i = 0; i < steps; i += 1) { if (await done()) return i; await w.tick(pilot, step); }
    assert.ok(await done(), 'the cast did not get there within the allowed ticks');
    return steps;
  };
  w.by = who => w.sent.filter(entry => w.names.get(entry.token) === who);
  /** Every mutation the cast made, optionally one character's, optionally only paths matching `pattern`. */
  w.writes = (who = null, pattern = null) => w.sent.filter(entry => entry.method !== 'GET' && w.cast.has(entry.token) && (!who || w.names.get(entry.token) === who) && (!pattern || pattern.test(entry.path)));
  /** The visitor is in the room and the cast has had its first look: whatever it does on its own (the votes in the seeded cup) is done and forgotten. */
  w.warm = async pilot => { await w.tick(pilot); w.sent.length = 0; };
  w.pairPhotos = async owner => (await w.visitor.get(`/rooms/${w.room.id}`)).photos.filter(photo => photo.ownerId === w.people[owner].id);
  w.upload = async ({ viewpoint = null, visibility = 'members' } = {}) => (await w.visitor.post(`/rooms/${w.room.id}/photos`, {
    dataUrl: PHOTO_URL, visibility, ...(viewpoint ? { takenAt: TAKEN_AT, takenSource: 'manual', viewpoint, viewpointSource: 'manual' } : {}),
  })).photo;
  w.offer = async (mine, theirs) => (await w.visitor.post(`/rooms/${w.room.id}/exchanges`, {
    recipientId: theirs.ownerId, offeredPhotoId: mine.id, requestedPhotoId: theirs.id, offeredRevision: mine.revision, requestedRevision: theirs.revision,
    offerPreviewConsent: true, offerOriginalConsent: true, offeredPreviewDataUrl: PHOTO_URL,
  })).exchange;
  w.exchange = async id => (await w.visitor.get(`/exchanges/${id}`)).exchange;
  w.greet = async who => (await w.visitor.post(`/rooms/${w.room.id}/greetings`, { recipientId: w.people[who].id })).greeting;
  w.thread = async who => (await w.visitor.get(`/chats/${w.people[who].id}/messages`)).messages;
  w.arrive = async pilot => {                                                 // sees the visitor, waits arriveMs, 林间 comes in
    await w.tick(pilot);
    await w.tick(pilot, ARRIVE_MS);
  };
  return w;
}

// ---- the lines ----------------------------------------------------------------------------------------------------------------------

test('lines: the welcome says what the sender is, the thread ends on the plain statement, nothing claims to be a person', () => {
  assert.deepEqual([...WELCOME_LINES], ['嗨，欢迎来到「回声现场」。我是示例角色，由这个页面自动回复。', '你拍到的是哪一面？']);
  assert.deepEqual([...GENERIC_LINES], ['今晚的返场太好听了。', '你的视角我这边没拍到，谢谢你愿意交换。', '（示例角色的自动回复：我不是真人。）']);
  assert.equal(DISCLOSURE, GENERIC_LINES.at(-1));
  assert.deepEqual([...REPLY_LINES], [...WELCOME_LINES, ...GENERIC_LINES]);
  assert.deepEqual({ welcome: [...CHAT_LINES.welcome], generic: [...CHAT_LINES.generic] }, { welcome: [...WELCOME_LINES], generic: [...GENERIC_LINES] }, 'the prototype shape is kept');
  assert.match(WELCOME_LINES[0], /示例角色/);
  assert.match(WELCOME_LINES[0], /自动回复/);
  assert.deepEqual(Object.keys(GROUP_LINES), ['yao', 'man', 'bei']);
  for (const [key, line] of Object.entries(GROUP_LINES)) assert.ok(line.endsWith(DISCLOSURE), `the group-chat line of ${key} ends with the disclosure`);
  for (const line of [...REPLY_LINES, ...Object.values(GROUP_LINES)]) {
    assert.ok(typeof line === 'string' && line.trim() && [...line].length <= 1000, 'a sendable chat text');
    assert.doesNotMatch(line, /[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/u, 'no control characters (the worker would refuse it)');
    assert.doesNotMatch(line.replaceAll('我不是真人', ''), /真人|本人|活人/, `no line claims to be a person: ${line}`);
    assert.doesNotMatch(line, /我是(真人|本人|人类)|我是.{0,3}人[。，]/, `no line claims to be a person: ${line}`);
  }
  assert.ok(Object.isFrozen(WELCOME_LINES) && Object.isFrozen(GENERIC_LINES) && Object.isFrozen(REPLY_LINES) && Object.isFrozen(GROUP_LINES));
});

test('lines: the line that answers is the number of lines already sent, clamped to the last one', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 9, 1000].map(replyLine), [...REPLY_LINES, REPLY_LINES.at(-1), REPLY_LINES.at(-1), REPLY_LINES.at(-1)]);
  assert.equal(replyLine(-3), REPLY_LINES[0]);
  assert.equal(replyLine(NaN), REPLY_LINES[0]);
  assert.equal(replyLine(undefined), REPLY_LINES[0]);
  assert.equal(replyLine(2.9), REPLY_LINES[2], 'fractions never happen, but never break');
});

test('lines: the roster (T7) says the same group-chat lines and the same disclosure', { skip: roster ? false : 'roster.js is not in the tree yet' }, () => {
  assert.equal(roster.DISCLOSURE, DISCLOSURE);
  for (const npc of roster.NPCS) {
    if (npc.joins !== 'seed') continue;
    assert.equal(GROUP_LINES[npc.key], npc.line, `npc-lines.js GROUP_LINES.${npc.key} and roster.js ${npc.key}.line are one text: change both, or let one import the other`);
  }
});

// ---- the pure rules -----------------------------------------------------------------------------------------------------------------

test('wantsExchange: they trade views, not duplicates; nothing to compare is no reason to refuse', () => {
  const photo = viewpoint => ({ id: 'p', viewpoint });
  assert.equal(wantsExchange(photo('stage'), photo('crowd')), true, 'complementary');
  assert.equal(wantsExchange(photo('crowd'), photo('detail')), true);
  assert.equal(wantsExchange(photo('stage'), photo('stage')), false, 'the same side twice');
  assert.equal(wantsExchange(photo('detail'), photo('detail')), false);
  assert.equal(wantsExchange(photo(null), photo('stage')), true, 'unknown viewpoint: accept');
  assert.equal(wantsExchange(photo('stage'), photo(null)), true);
  assert.equal(wantsExchange(photo(null), photo(null)), true);
  assert.equal(wantsExchange(undefined, photo('stage')), true, 'a photo the character cannot read is unknown');
  assert.equal(wantsExchange(photo('stage'), undefined), true);
  assert.equal(wantsExchange(undefined, undefined), true);
});

test('cupPick and gameChoice: stable per character, and the two voters never share a taste', () => {
  const match = { id: '11111111-1111-4111-8111-111111111111', left: { id: 'left-album' }, right: { id: 'right-album' } };
  assert.equal(cupPick('yao', match), cupPick('yao', match), 'the same character and match always give the same side');
  assert.ok(['left-album', 'right-album'].includes(cupPick('man', match)));
  const sides = new Set();
  for (let i = 0; i < 40; i += 1) sides.add(cupPick('yao', { ...match, id: `${i}-${match.id}` }));
  assert.equal(sides.size, 2, 'across matches the side varies');
  for (const count of [2, 3, 4]) {
    const entries = Array.from({ length: count }, (_, index) => ({ id: `entry-${index}` }));
    assert.equal(gameChoice('yao', entries), gameChoice('yao', entries));
    assert.notEqual(gameChoice('yao', entries).id, gameChoice('man', entries).id, `with ${count} entries 阿遥 and 小满 answer differently, so a shared choice always includes the visitor`);
  }
});

test('createAutopilot: refuses a missing cast, room or clock, and has the documented defaults', () => {
  const person = { id: 'a', api: { get() {}, post() {} }, npc: { key: 'yao', host: true } };
  assert.throws(() => createAutopilot({}), TypeError);
  assert.throws(() => createAutopilot({ people: { yao: person } }), /room/);
  assert.throws(() => createAutopilot({ people: { yao: person }, room: { id: 'r', code: 'C' }, now: 5 }), /clock/);
  assert.throws(() => createAutopilot({ people: { x: { id: 'x', api: {}, npc: { key: 'x' } } }, room: { id: 'r', code: 'C' } }), /host/);
  assert.deepEqual([THINK_MS, ARRIVE_MS, INTERVAL_MS], [2500, 8000, 1500]);
  const pilot = createAutopilot({ people: { yao: person }, room: { id: 'r', code: 'C' } });
  assert.deepEqual(Object.keys(pilot).sort(), ['start', 'state', 'stop', 'tick']);
  assert.deepEqual(pilot.state, { running: false, stopped: false, busy: false, ticks: 0, skipped: 0, requests: 0, mutations: 0, failures: 0, visitorSeenAt: null, lastTick: null });
});

// ---- greetings ----------------------------------------------------------------------------------------------------------------------

worldTest('greeting: nothing before thinkMs, then exactly one accept and the two welcome lines, with fresh Idempotency-Keys', async () => {
  const w = await createWorld();
  await w.visit();
  const pilot = w.pilot();
  await w.warm(pilot);
  const greeting = await w.greet('man');
  await w.tick(pilot);
  await w.tick(pilot, THINK_MS - 1);
  assert.equal(w.writes().length, 0, 'the character is still thinking');
  assert.equal((await w.visitor.get('/social')).outgoing[0].id, greeting.id, 'still pending');

  await w.tick(pilot, 1);
  const writes = w.writes('man');
  assert.deepEqual(writes.map(entry => `${entry.method} ${entry.path.replace(/[0-9a-f-]{36}/g, ':id')}`), ['POST /greetings/:id/accept', 'POST /chats/:id/messages', 'POST /chats/:id/messages']);
  assert.deepEqual(writes.map(entry => entry.status), [200, 201, 201]);
  assert.equal(writes[0].path, `/greetings/${greeting.id}/accept`);
  assert.deepEqual(writes[0].body, { revision: greeting.revision });
  assert.deepEqual(writes.slice(1).map(entry => entry.body.text), [...WELCOME_LINES]);
  assert.ok(writes.slice(1).every(entry => entry.path === `/chats/${w.visitor.id}/messages`));
  assert.deepEqual((await w.visitor.get('/social')).friends.map(friend => friend.peer.name), ['小满·示例']);
  assert.deepEqual((await w.thread('man')).map(message => [message.senderId === w.people.man.id, message.text]), WELCOME_LINES.map(text => [true, text]));

  for (let i = 0; i < 3; i += 1) await w.tick(pilot, 10_000);
  assert.equal(w.writes('man').length, 3, 'answered once: later ticks do nothing more');
  const keys = w.writes().map(entry => entry.key);
  assert.ok(keys.length >= 5 && keys.every(key => UUID.test(key)), 'every mutation carries a UUID Idempotency-Key');
  assert.equal(new Set(keys).size, keys.length, 'and every one is fresh');
});

worldTest('greeting: an open character accepts, the quiet one (林间) cannot be greeted: the worker says PARTICIPATION_QUIET and nothing overrides it', async () => {
  const w = await createWorld();
  await w.visit();
  const pilot = w.pilot();
  await assert.rejects(w.greet('lin'), { status: 404, code: 'PERSON_UNAVAILABLE' }, 'she is not in the room yet');
  await w.arrive(pilot);
  assert.equal((await w.visitor.get(`/rooms/${w.room.id}`)).members.find(member => member.id === w.people.lin.id).participation, 'quiet');
  await assert.rejects(w.greet('lin'), { status: 409, code: 'PARTICIPATION_QUIET' });
  await w.tick(pilot, 5 * THINK_MS);
  await w.tick(pilot, 5 * THINK_MS);
  assert.deepEqual(w.writes('lin').map(entry => entry.path.replace(/[0-9a-f-]{36}/, ':id')), [`/rooms/${w.room.code}/join`, '/rooms/:id/conversation/join'], 'her only requests are the two that bring her in');
  const social = await w.visitor.get('/social');
  assert.deepEqual([social.friends, social.outgoing, social.incoming], [[], [], []]);
  assert.deepEqual(await w.sql('SELECT COUNT(*) AS n FROM event_social_pairs WHERE low_id = ? OR high_id = ?', w.people.lin.id, w.people.lin.id), [{ n: 0 }], 'no pair row was ever written for her');
});

worldTest('greeting: a visitor who chose to take part quietly cannot greet, so the cast has nothing to answer', async () => {
  const w = await createWorld();
  await w.visit('quiet');
  const pilot = w.pilot();
  await w.warm(pilot);
  await assert.rejects(w.greet('man'), { status: 409, code: 'PARTICIPATION_QUIET' });
  await w.tick(pilot, 10_000);
  assert.equal(w.writes(null, /\/(greetings|chats)\//).length, 0);
});

// ---- chat ---------------------------------------------------------------------------------------------------------------------------

worldTest('chat: the reply is line N for the N lines the character already sent, stateless across a re-created autopilot, the last line repeated', async () => {
  const w = await createWorld();
  await w.visit();
  await w.greet('man');
  await w.tick(w.pilot(), THINK_MS);                                           // accepted, two welcome lines
  const lines = async () => (await w.thread('man')).filter(message => message.senderId === w.people.man.id).map(message => message.text);
  assert.deepEqual(await lines(), [...WELCOME_LINES]);

  const expected = [...REPLY_LINES.slice(2), REPLY_LINES.at(-1), REPLY_LINES.at(-1)];      // generic 0, 1, 2, then the last line twice more
  for (const [index, line] of expected.entries()) {
    await w.visitor.post(`/chats/${w.people.man.id}/messages`, { text: `你好 ${index}` });
    const fresh = w.pilot();                                                     // a "reload": nothing is remembered between autopilots
    await w.tick(fresh, THINK_MS - 1);
    assert.equal((await lines()).length, 2 + index, 'still thinking about the message');
    await w.tick(fresh, 1);
    assert.deepEqual((await lines()).slice(2 + index), [line], `reply number ${index}`);
    await w.tick(fresh, 10_000);
    await w.tick(w.pilot(), 10_000);
    assert.equal((await lines()).length, 3 + index, 'one reply per message, however often and from whichever autopilot it looks');
  }
  assert.deepEqual((await lines()).slice(2), expected);
  assert.equal((await w.visitor.get('/chats')).chats[0].lastMessage.senderId, w.people.man.id);
});

worldTest('chat: a character who wrote last waits, and a friend the visitor blocked gets no reply', async () => {
  const w = await createWorld();
  await w.visit();
  await w.greet('bei');
  const pilot = w.pilot();
  await w.tick(pilot, THINK_MS);
  assert.equal(w.writes('bei').length, 3);
  for (let i = 0; i < 3; i += 1) await w.tick(pilot, 10_000);
  assert.equal(w.writes('bei').length, 3, 'the character wrote last: nothing to answer');
  await w.visitor.post(`/chats/${w.people.bei.id}/messages`, { text: '在吗' });
  await w.visitor.post(`/blocks/${w.people.bei.id}`, {});
  await w.tick(pilot, 10_000);
  assert.equal(w.writes('bei').length, 3, 'the worker no longer lets the character send; nothing was tried');
});

// ---- exchanges ----------------------------------------------------------------------------------------------------------------------

worldTest('exchange: nothing before thinkMs, then exactly one answer; complementary and unknown views are accepted, the same side is declined', async () => {
  const w = await createWorld();
  await w.visit();
  const pilot = w.pilot();
  await w.warm(pilot);
  const stageA = await w.upload({ viewpoint: 'stage' }), stageB = await w.upload({ viewpoint: 'stage' }), plain = await w.upload(), hidden = await w.upload({ viewpoint: 'crowd', visibility: 'private' });
  const manCrowd = (await w.pairPhotos('man')).find(photo => photo.viewpoint === 'crowd');
  const manNear = (await w.pairPhotos('man')).find(photo => photo.viewpoint === 'friends');
  const [yaoStage] = await w.pairPhotos('yao');
  const [beiDetail] = await w.pairPhotos('bei');
  assert.deepEqual([manCrowd.viewpoint, yaoStage.viewpoint, beiDetail.viewpoint], ['crowd', 'stage', 'detail']);

  const complementary = await w.offer(stageA, manCrowd);                      // 你拍舞台，TA 拍人海
  const sameSide = await w.offer(stageB, yaoStage);                           // 你拍舞台，TA 也拍舞台
  const unknown = await w.offer(plain, beiDetail);                            // no viewpoint on the offered photo
  await w.tick(pilot);
  await w.tick(pilot, THINK_MS - 1);
  assert.equal(w.writes().length, 0, 'the cast is still thinking');
  assert.deepEqual((await Promise.all([complementary, sameSide, unknown].map(item => w.exchange(item.id)))).map(item => item.status), ['pending', 'pending', 'pending']);

  await w.tick(pilot, 1);
  const states = await Promise.all([complementary, sameSide, unknown].map(item => w.exchange(item.id)));
  assert.deepEqual(states.map(item => item.status), ['accepted', 'declined', 'accepted']);
  assert.equal(states[1].endReason, 'declined');
  assert.deepEqual(w.writes().map(entry => [w.names.get(entry.token), entry.path]), [
    ['yao', `/exchanges/${sameSide.id}/decline`], ['man', `/exchanges/${complementary.id}/accept`], ['bei', `/exchanges/${unknown.id}/accept`],
  ], 'one answer each, in the order of the cast');
  assert.deepEqual(w.writes('yao')[0].body, { revision: sameSide.revision }, 'a decline carries only the revision');
  assert.deepEqual(w.writes('man')[0].body, { revision: complementary.revision, exchangeConsent: true });
  assert.equal((await w.visitor.blob(`/exchanges/${complementary.id}/photos/${manCrowd.id}/image`)).type, 'image/jpeg', 'the grant is real');
  await assert.rejects(w.visitor.blob(`/exchanges/${sameSide.id}/photos/${yaoStage.id}/image`), { status: 404 }, 'a declined exchange grants nothing');

  // a photo the character cannot read the view of (private) is unknown, so it is accepted even where the sides would match
  const covert = await w.offer(hidden, manNear);
  const count = w.writes().length;
  await w.tick(pilot, THINK_MS);
  assert.equal((await w.exchange(covert.id)).status, 'accepted');
  assert.equal(w.writes().length, count + 1);
  for (let i = 0; i < 3; i += 1) await w.tick(pilot, 10_000);
  assert.equal(w.writes(null, /\/exchanges\//).length, 4, 'one answer per request, nothing fires twice');
});

worldTest('exchange: a reload loses nothing (a new runtime and a new autopilot answer it) and nothing fires twice', async () => {
  const w = await createWorld();
  await w.visit();
  await w.warm(w.pilot());
  const mine = await w.upload({ viewpoint: 'stage' });
  const request = await w.offer(mine, (await w.pairPhotos('man')).find(photo => photo.viewpoint === 'crowd'));
  await w.tick(w.pilot(), 1000);
  assert.equal(w.writes(null, /\/exchanges\//).length, 0);
  // the page is closed and opened again: same storage, a new runtime, the seed finds its marker, the characters keep their tokens
  const tokens = Object.fromEntries(Object.entries(w.people).map(([key, person]) => [key, person.token]));
  await w.runtime.close();
  w.runtime = await createStaticRuntime({ SQL, migrations, storage: w.storage, clock: w.clock });
  w.connect();
  const again = await seed.ensureShowcase({ runtime: w.runtime, loadPhoto, transport: w.fetch, clock: w.clock });
  assert.deepEqual(Object.fromEntries(Object.entries(again.people).map(([key, person]) => [key, person.token])), tokens);
  assert.equal(again.seeded, false);
  Object.assign(w, again);
  w.visitor = caller(w.client, w.visitor.token, w.visitor.id);
  w.sent.length = 0;
  const pilot = w.pilot();
  await w.tick(pilot, 1000);
  await w.tick(pilot, THINK_MS - 2001);
  assert.equal(w.writes().length, 0, 'the new autopilot also waits until the request is thinkMs old, and the votes are not cast twice');
  await w.tick(pilot, 1);
  assert.equal((await w.exchange(request.id)).status, 'accepted');
  assert.equal(w.writes().length, 1);
  await w.tick(w.pilot(), 20_000);
  assert.equal(w.writes(null, /\/exchanges\//).length, 1);
});

// ---- late arrival -------------------------------------------------------------------------------------------------------------------

worldTest('late arrival: 林间 comes in quietly only after a visitor has been in the room for arriveMs, and only once (members 5, photos 4)', async () => {
  const w = await createWorld();
  const pilot = w.pilot();
  const room = async () => w.people.yao.api.get(`/rooms/${w.room.id}`);
  await w.tick(pilot, 60_000);                                                   // nobody is there: no arrival, however long it takes
  await w.tick(pilot, ARRIVE_MS * 5);
  assert.equal((await room()).members.length, 3);
  assert.equal(pilot.state.visitorSeenAt, null);
  assert.equal(w.writes().length, 0);

  await w.visit();
  await w.tick(pilot);                                                           // first seen now
  assert.equal(pilot.state.visitorSeenAt, w.time);
  await w.tick(pilot, ARRIVE_MS - 1);
  assert.equal((await room()).members.length, 4, 'not yet');
  assert.equal(w.by('lin').length, 0, 'a character that is not in the room is not asked anything');
  await w.tick(pilot, 1);
  const view = await room();
  assert.equal(view.members.length, 5);
  assert.deepEqual(view.members.filter(member => member.participation === 'quiet').map(member => member.name), ['林间·示例']);
  assert.equal(view.photos.length, 4, 'she uploads nothing');
  assert.deepEqual(w.writes('lin').map(entry => [entry.path.replace(/[0-9a-f-]{36}/, ':id'), entry.body]), [
    [`/rooms/${w.room.code}/join`, { joinConsent: true, participation: 'quiet' }], ['/rooms/:id/conversation/join', { joinConsent: true }],
  ]);
  assert.ok((await w.sql('SELECT user_id FROM event_conversation_members WHERE scope_id = ? AND left_at IS NULL', w.room.id)).some(row => row.user_id === w.people.lin.id), 'and in the room chat');
  for (let i = 0; i < 4; i += 1) await w.tick(pilot, ARRIVE_MS);
  assert.equal(w.writes('lin').length, 2, 'once');
  assert.equal(w.writes('lin', /\/rooms\/[A-Z2-7]{12}\/join$/).length, 1);
  assert.deepEqual([(await room()).members.length, (await room()).photos.length], [5, 4]);
});

worldTest('late arrival: the timer belongs to this page (a reload restarts it) and a visitor who blocked 阿遥 is still seen by the others', async () => {
  const w = await createWorld();
  await w.visit();
  await w.visitor.post(`/blocks/${w.people.yao.id}`, {});                       // the host cannot see the visitor any more
  assert.ok(!(await w.people.yao.api.get(`/rooms/${w.room.id}`)).members.some(member => member.id === w.visitor.id));
  const first = w.pilot();
  await w.tick(first);
  await w.tick(first, ARRIVE_MS - 1000);
  const second = w.pilot();                                                      // reload: the new autopilot starts counting when it first sees the visitor
  await w.tick(second);
  await w.tick(second, ARRIVE_MS - 1);
  assert.equal(w.by('lin').length, 0);
  await w.tick(second, 1);
  assert.equal(w.writes('lin').length, 2, 'she arrived although the host cannot see the visitor');
  await w.greet('man');                                                          // 小满 still answers (阿遥 cannot: a block works both ways)
  await w.tick(second, THINK_MS);
  assert.deepEqual((await w.visitor.get('/social')).friends.map(friend => friend.peer.name), ['小满·示例']);
});

worldTest('the cast goes quiet again when the visitor leaves the room, and starts counting again when they come back', async () => {
  const w = await createWorld();
  await w.visit();
  const pilot = w.pilot();
  await w.warm(pilot);
  assert.notEqual(pilot.state.visitorSeenAt, null);
  await w.visitor.post(`/rooms/${w.room.id}/leave`, {});
  await w.tick(pilot, 1000);
  assert.equal(pilot.state.visitorSeenAt, null);
  assert.ok(pilot.state.lastTick.requests <= 3, `${pilot.state.lastTick.requests} requests with nobody to answer`);
  assert.equal(pilot.state.lastTick.mutations, 0);
  await w.visitor.post(`/rooms/${w.room.code}/join`, { joinConsent: true, participation: 'open' });
  await w.tick(pilot, ARRIVE_MS * 2);
  assert.equal(w.by('lin').length, 0, 'the timer started again with the visitor\'s return');
  await w.tick(pilot, ARRIVE_MS);
  assert.equal(w.writes('lin').length, 2);
});

// ---- album cup ----------------------------------------------------------------------------------------------------------------------

/** The album with the most of these votes (rows of { album_id }). */
const majority = rows => Object.entries(rows.reduce((count, row) => ({ ...count, [row.album_id]: (count[row.album_id] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1])[0][0];

worldTest('album cup: 阿遥 and 小满 vote after thinkMs, 北屿 and 林间 never, the creator advances at three votes (2:1 or 1:2) with no tie decision, to the end of the cup', async () => {
  const w = await createWorld();
  const pilot = w.pilot();
  await w.tick(pilot, THINK_MS * 4);                                             // nobody is here: nobody votes, however old the cup is
  assert.equal(w.writes().length, 0);
  await w.visit();
  await w.visitor.post(`/rooms/${w.room.id}/conversation/join`, { joinConsent: true });
  const cup = (await w.visitor.get(`/rooms/${w.room.id}/worldcups`)).worldcups[0];
  assert.equal(cup.creatorId, w.people.yao.id);
  const votesOf = async matchId => w.sql('SELECT user_id, album_id FROM event_worldcup_votes WHERE match_id = ? ORDER BY user_id', matchId);
  const state = async () => (await w.visitor.get(`/worldcups/${cup.id}`));

  for (let round = 0; round < 3; round += 1) {
    const match = (await state()).matches.find(item => !item.winner);
    assert.ok(match, `round ${round} has an open match`);
    assert.equal(match.myVote, null, 'the autopilot never votes for the visitor');
    await w.drive(pilot, async () => (await votesOf(match.id)).length === 2);
    const votes = await votesOf(match.id);
    assert.deepEqual(votes.map(row => row.user_id).sort(), [w.people.yao.id, w.people.man.id].sort(), 'only 阿遥 and 小满 voted');
    assert.equal(votes.find(row => row.user_id === w.people.yao.id).album_id, cupPick('yao', match));
    assert.equal(votes.find(row => row.user_id === w.people.man.id).album_id, cupPick('man', match));
    for (let i = 0; i < 3; i += 1) await w.tick(pilot, 10_000);                  // two votes are not three: nothing is closed
    assert.equal((await state()).matches.find(item => item.id === match.id).winner, null, 'two votes are not enough to close a match');

    const [first, second] = votes.map(row => row.album_id);
    const mine = first === second ? [match.left.id, match.right.id].find(id => id !== first) : match.left.id;    // never join them both: 2:1 or 1:2
    await w.visitor.post(`/worldcups/${cup.id}/matches/${match.id}/vote`, { revision: match.revision, albumId: mine, voteConsent: true });
    await w.drive(pilot, async () => (await state()).matches.find(item => item.id === match.id).winner !== null);
    const closed = (await state()).matches.find(item => item.id === match.id);
    assert.equal(closed.winner.id, majority(await votesOf(match.id)), 'the album with two of the three votes wins');
    assert.deepEqual([closed.leftCount, closed.rightCount].sort(), [1, 2]);
    assert.equal(closed.tieReason, null, 'no tie, so nobody was asked for a reason');
  }
  const advances = w.writes(null, /\/advance$/);
  assert.equal(advances.length, 3, 'one advance per match');
  assert.ok(advances.every(entry => w.names.get(entry.token) === 'yao'), 'only the cup creator advances');
  assert.ok(advances.every(entry => Object.keys(entry.body).sort().join() === 'advanceConsent,revision'), 'no tie input was ever sent');
  const final = await state();
  assert.equal(final.completed, true);
  assert.equal(final.matches.length, 3);
  assert.deepEqual([...new Set(w.writes(null, /\/vote$/).map(entry => w.names.get(entry.token)))].sort(), ['man', 'yao']);
  assert.equal((await w.sql('SELECT COUNT(*) AS n FROM event_worldcup_votes WHERE user_id IN (?, ?)', w.people.bei.id, w.people.lin.id))[0].n, 0, '北屿 and 林间 abstain');
  const done = w.writes().length;
  await w.tick(pilot, 20_000);
  assert.equal(w.writes().length, done, 'a finished cup is left alone');
});

worldTest('album cup: a cup the visitor opens gets two votes after thinkMs but is closed by its creator, not by 阿遥', async () => {
  const w = await createWorld();
  await w.visit();
  await w.visitor.post(`/rooms/${w.room.id}/conversation/join`, { joinConsent: true });
  const pilot = w.pilot();
  await w.warm(pilot);                                                           // the seeded cup gets its two votes
  assert.equal((await w.sql('SELECT COUNT(*) AS n FROM event_worldcup_votes'))[0].n, 2);
  const own = (await w.visitor.post(`/rooms/${w.room.id}/worldcups`, { title: '我的专辑杯', createConsent: true })).worldcup;
  await w.tick(pilot);
  await w.tick(pilot, THINK_MS - 1);
  assert.equal(w.writes(null, /\/vote$/).length, 0, 'a new cup also waits thinkMs');
  await w.tick(pilot, 1);
  const open = (await w.visitor.get(`/worldcups/${own.id}`)).matches[0];
  assert.equal(open.leftCount + open.rightCount, 2);
  const [first, second] = (await w.sql('SELECT album_id FROM event_worldcup_votes WHERE match_id = ?', open.id)).map(row => row.album_id);
  const mine = first === second ? [open.left.id, open.right.id].find(id => id !== first) : open.left.id;
  await w.visitor.post(`/worldcups/${own.id}/matches/${open.id}/vote`, { revision: open.revision, albumId: mine, voteConsent: true });
  for (let i = 0; i < 3; i += 1) await w.tick(pilot, 10_000);
  assert.equal((await w.visitor.get(`/worldcups/${own.id}`)).matches[0].winner, null, '阿遥 did not create it, so she does not close it');
  assert.equal(w.writes(null, /\/advance$/).length, 0);
});

// ---- game ---------------------------------------------------------------------------------------------------------------------------

const gameWrites = w => w.writes(null, /^\/games\//).map(entry => [w.names.get(entry.token), entry.path.split('/').pop()]);

worldTest('game: waiting with two players -> the visitor joins -> 阿遥 starts, 阿遥 and 小满 answer once, 阿遥 reveals when all three have -> completed with commonChoices', async () => {
  const w = await createWorld();
  await w.visit();
  await w.visitor.post(`/rooms/${w.room.id}/conversation/join`, { joinConsent: true });
  const pilot = w.pilot();
  await w.warm(pilot);
  const [summary] = (await w.visitor.get(`/rooms/${w.room.id}/games`)).games;
  assert.deepEqual([summary.type, summary.phase, summary.roundLimit], ['preference', 'waiting', 1]);
  const view = async () => w.visitor.get(`/games/${summary.id}`);
  await w.tick(pilot, 20_000);
  assert.equal((await view()).game.phase, 'waiting', 'two players are not enough');
  assert.equal((await view()).players.length, 2);
  assert.deepEqual(gameWrites(w), []);

  let game = await view();
  await w.visitor.post(`/games/${summary.id}/join`, { revision: game.game.revision, joinConsent: true });
  assert.equal((await view()).players.length, 3);
  await w.tick(pilot, INTERVAL_MS);
  game = await view();
  assert.equal(game.game.phase, 'playing');
  assert.equal(game.rounds.at(-1).status, 'open');
  assert.equal(game.rounds.at(-1).answeredCount, 0, 'starting does not answer');
  assert.deepEqual(gameWrites(w), [['yao', 'start']]);

  await w.tick(pilot, INTERVAL_MS);
  game = await view();
  assert.equal(game.rounds.at(-1).answeredCount, 2, '阿遥 and 小满 answered');
  assert.equal(game.rounds.at(-1).myAnswer, null, 'nobody answered for the visitor');
  assert.equal(game.rounds.at(-1).status, 'open', 'not revealed while the visitor has not answered');
  assert.deepEqual((await w.sql('SELECT user_id FROM event_game_answers')).map(row => row.user_id).sort(), [w.people.yao.id, w.people.man.id].sort());
  for (let i = 0; i < 3; i += 1) await w.tick(pilot, 10_000);
  assert.equal(w.writes(null, /\/answer$/).length, 2, 'each answered once');
  assert.equal((await view()).rounds.at(-1).status, 'open');

  const choice = gameChoice('yao', game.options.entries);                         // the visitor picks what 阿遥 picked
  await w.visitor.post(`/games/${summary.id}/answer`, { revision: game.rounds.at(-1).revision, choiceId: choice.id, answerConsent: true });
  await w.tick(pilot, INTERVAL_MS);
  game = await view();
  assert.equal(game.game.phase, 'completed');
  assert.equal(game.rounds.at(-1).status, 'revealed');
  assert.ok(game.rounds.at(-1).commonChoices.includes(choice.id), 'the visitor shares a choice');
  assert.equal(game.rounds.at(-1).result.find(item => item.entry.id === choice.id).count, 2);
  assert.deepEqual(gameWrites(w), [['yao', 'start'], ['yao', 'answer'], ['man', 'answer'], ['yao', 'reveal']]);
  assert.deepEqual(w.writes(null, /\/answer$/).map(entry => entry.body.choiceId), [gameChoice('yao', game.options.entries).id, gameChoice('man', game.options.entries).id]);
  await w.tick(pilot, 20_000);
  assert.equal(gameWrites(w).length, 4, 'a finished game is left alone');
});

worldTest('game: a relay game is none of the cast\'s business (even with three players), and a preference game the visitor opens alone is not started', async () => {
  const w = await createWorld();
  await w.visit();
  await w.visitor.post(`/rooms/${w.room.id}/conversation/join`, { joinConsent: true });
  const relay = await w.visitor.post(`/rooms/${w.room.id}/games`, { type: 'relay', title: '接龙', seedTitle: '夜航', roundLimit: 2, createConsent: true });
  const alone = await w.visitor.post(`/rooms/${w.room.id}/games`, { type: 'preference', title: '我的默契局', roundLimit: 1, createConsent: true });
  for (const who of ['yao', 'man']) {                                            // set up by hand: the cast never joins a game by itself
    const waiting = await w.people[who].api.get(`/games/${relay.gameId}`);
    await w.people[who].api.post(`/games/${relay.gameId}/join`, { revision: waiting.game.revision, joinConsent: true });
  }
  assert.equal((await w.visitor.get(`/games/${relay.gameId}`)).players.length, 3);
  w.sent.length = 0;
  const pilot = w.pilot();
  await w.tick(pilot);
  await w.tick(pilot, 20_000);
  assert.equal((await w.visitor.get(`/games/${relay.gameId}`)).game.phase, 'waiting', 'the cast does not play relay games');
  assert.equal((await w.visitor.get(`/games/${alone.gameId}`)).game.phase, 'waiting', 'one player: nothing to start');
  assert.deepEqual(gameWrites(w), []);
});

// ---- the clock, the busy flag, failures, callbacks ----------------------------------------------------------------------------------

worldTest('tick(): re-entrant safe (a second call while one runs returns false), never throws, answers true when it ran', async () => {
  const w = await createWorld();
  await w.visit();
  const pilot = w.pilot();
  const first = pilot.tick(), second = pilot.tick(), third = pilot.tick();
  assert.equal(await second, false);
  assert.equal(await third, false);
  assert.equal(pilot.state.busy, true);
  assert.equal(await first, true);
  assert.equal(pilot.state.busy, false);
  assert.deepEqual([pilot.state.ticks, pilot.state.skipped], [1, 2]);
  assert.deepEqual([pilot.state.lastTick.at, pilot.state.lastTick.failures], [w.time, 0]);
  assert.ok(pilot.state.lastTick.ms >= 0 && pilot.state.lastTick.requests > 0);
  assert.equal(await pilot.tick(), true, 'free again');

  // a world that cannot even read the room: the tick still resolves, and says why
  const logs = [];
  const down = { ...w.people.yao, api: { get: () => Promise.reject(Object.assign(new Error('down'), { code: 'NETWORK' })), post: () => Promise.reject(new Error('never')) } };
  const broken = createAutopilot({ people: { ...w.people, yao: down }, room: w.room, now: w.clock, log: (...entry) => logs.push(entry) });
  assert.equal(await broken.tick(), true);
  assert.deepEqual(logs, [['tick', 'NETWORK', undefined]]);
  assert.equal(broken.state.failures, 1);
  assert.equal(broken.state.busy, false);
});

test('tick(): a clock that throws is a logged failure, not a stuck autopilot (busy is released and the next tick runs)', async () => {
  let broken = true;
  const calls = [], logs = [];
  const yao = { id: 'yao-id', npc: { key: 'yao', host: true, participation: 'open' }, api: {
    get: async path => { calls.push(path); return { members: [{ id: 'yao-id' }], photos: [] }; },
    post: async () => { throw new Error('the cast has nothing to write in an empty room'); },
  } };
  const pilot = createAutopilot({ people: { yao }, room: { id: 'r', code: 'C' }, now: () => { if (broken) throw new Error('clock'); return 0; }, log: (...entry) => logs.push(entry) });
  assert.equal(await pilot.tick(), true, 'it did not throw');
  assert.deepEqual([pilot.state.busy, pilot.state.ticks, pilot.state.failures], [false, 1, 1]);
  assert.deepEqual(logs, [['tick', 'clock', undefined]]);
  assert.equal(pilot.state.lastTick.requests, 0);
  broken = false;
  assert.equal(await pilot.tick(), true);
  assert.deepEqual(calls, ['/rooms/r'], 'the next tick went on as usual');
  assert.deepEqual([pilot.state.ticks, pilot.state.failures], [2, 1]);
});

test('browser-safe: the two modules import nothing but each other and touch no Node-only global', () => {
  const files = { 'autopilot.js': ['./npc-lines.js'], 'npc-lines.js': [] };
  for (const [name, expected] of Object.entries(files)) {
    const source = readFileSync(new URL(`web/static-runtime/showcase/${name}`, root), 'utf8');
    const code = source.replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');       // comments say what the code does not do
    assert.deepEqual([...code.matchAll(/^import\b[^;]*?from\s+'([^']+)';/gm)].map(match => match[1]), expected, `${name}: imports`);
    assert.doesNotMatch(code, /\bprocess\.|\bBuffer\b|\brequire\s*\(|node:|import\.meta/, `${name}: Node-only API`);
    assert.doesNotMatch(code, /\b(?:setTimeout|setImmediate|localStorage|indexedDB|fetch)\b/, `${name}: the cast reaches the world only through people[].api (no fetch, no storage, no one-shot timers)`);
  }
});

worldTest('a failed action is logged and does not stop the reactions after it (and is retried on the next tick)', async () => {
  const w = await createWorld();
  await w.visit();
  const logs = [];
  let broken = true;
  const yao = { ...w.people.yao, api: { ...w.people.yao.api,
    post: (path, ...rest) => (broken && /\/greetings\//.test(path) ? Promise.reject(Object.assign(new Error('boom'), { code: 'SERVICE_ERROR', status: 503 })) : w.people.yao.api.post(path, ...rest)) } };
  const pilot = createAutopilot({ people: { ...w.people, yao }, room: w.room, now: w.clock, log: (...entry) => logs.push(entry) });
  await w.warm(pilot);
  const greeting = await w.greet('yao');                                         // 阿遥 is first in the cast: her failure comes before everything else
  const request = await w.offer(await w.upload({ viewpoint: 'stage' }), (await w.pairPhotos('man')).find(photo => photo.viewpoint === 'crowd'));
  assert.equal((await w.visitor.get('/social')).outgoing[0].id, greeting.id);
  assert.equal(await w.tick(pilot, THINK_MS), true, 'it did not throw');
  assert.deepEqual(logs, [['accept-greeting:yao', 'SERVICE_ERROR', 503]]);
  assert.equal((await w.exchange(request.id)).status, 'accepted', '小满 answered although 阿遥 failed before her');
  assert.equal((await w.visitor.get('/social')).outgoing.length, 1, 'the greeting is still pending');
  assert.equal(pilot.state.failures, 1);

  broken = false;
  await w.tick(pilot, INTERVAL_MS);
  assert.equal((await w.visitor.get('/social')).friends.length, 1, 'the failed reaction was not lost');
  assert.equal(logs.length, 1);
});

worldTest('a normal race (the visitor withdrew the greeting while the character was thinking) is swallowed and logged with its status', async () => {
  const w = await createWorld();
  await w.visit();
  const logs = [];
  const greeting = await w.greet('man');
  const stale = (await w.people.man.api.get('/social')).incoming;
  const man = { ...w.people.man, api: { ...w.people.man.api, get: async path => (path === '/social' ? { incoming: stale } : w.people.man.api.get(path)) } };
  await w.visitor.post(`/greetings/${greeting.id}/cancel`, { revision: greeting.revision });
  const race = createAutopilot({ people: { ...w.people, man }, room: w.room, now: w.clock, log: (...entry) => logs.push(entry) });
  assert.equal(await w.tick(race, THINK_MS), true);
  assert.equal(logs.length, 1);
  assert.equal(logs[0][0], 'accept-greeting:man');
  assert.ok([404, 409].includes(logs[0][2]), `status ${logs[0][2]} is a 404 or 409`);
  assert.deepEqual((await w.visitor.get('/social')).friends, []);
  const pilot = w.pilot({ log: (...entry) => logs.push(entry) });
  await w.tick(pilot, 10_000);
  assert.equal(logs.length, 1, 'with the greeting gone there is nothing left to try');
});

worldTest('onChange: called after every successful mutation (and only then), a throwing page does not stop the cast', async () => {
  const w = await createWorld();
  await w.visit();
  const changes = [];
  const pilot = w.pilot({ onChange: change => { changes.push(change); throw new Error('the page failed to refresh'); } });
  await w.warm(pilot);
  assert.deepEqual(changes, [{ kind: 'cup-vote', npc: 'yao' }, { kind: 'cup-vote', npc: 'man' }], 'the votes in the seeded cup were the first mutations');
  changes.length = 0;
  await w.greet('man');
  const request = await w.offer(await w.upload({ viewpoint: 'stage' }), (await w.pairPhotos('yao'))[0]);
  await w.tick(pilot);
  assert.equal(changes.length, 0, 'nothing was changed while they thought');
  await w.tick(pilot, THINK_MS);
  assert.equal((await w.visitor.get('/social')).friends.length, 1, 'the throwing callback did not stop 小满');
  assert.equal((await w.exchange(request.id)).status, 'declined', 'nor 阿遥');
  assert.equal(w.writes().filter(entry => entry.status < 300).length, 4, 'a decline, an accept and two lines');
  assert.deepEqual(changes, [{ kind: 'exchange-decline', npc: 'yao' }, { kind: 'greeting-accept', npc: 'man' }, { kind: 'welcome', npc: 'man' }, { kind: 'welcome', npc: 'man' }]);
  assert.equal(pilot.state.mutations, 6, 'two votes, a decline, an accept and two lines');
  assert.equal(pilot.state.failures, 0);
  await w.tick(pilot, 1000);
  assert.equal(changes.length, 4, 'an idle tick changes nothing and tells nobody');
});

worldTest('a failed mutation is not announced: onChange only follows what the worker accepted', async () => {
  const w = await createWorld();
  await w.visit();
  const changes = [];
  const man = { ...w.people.man, api: { ...w.people.man.api, post: () => Promise.reject(Object.assign(new Error('nope'), { code: 'STATE_CONFLICT', status: 409 })) } };
  const pilot = createAutopilot({ people: { ...w.people, man }, room: w.room, now: w.clock, onChange: change => changes.push(change) });
  await w.greet('man');
  await w.tick(pilot, THINK_MS);
  assert.deepEqual(changes.map(change => `${change.kind}:${change.npc}`), ['cup-vote:yao'], 'only 阿遥\'s vote went through');
  assert.equal(pilot.state.failures >= 1, true);
});

worldTest('thinkMs, arriveMs and a device clock that went backwards', async () => {
  const quickWorld = await createWorld();
  await quickWorld.visit();
  const quick = quickWorld.pilot({ thinkMs: 0, arriveMs: 0 });
  await quickWorld.greet('man');
  await quickWorld.tick(quick);
  assert.equal((await quickWorld.visitor.get('/social')).friends.length, 1, 'thinkMs 0: answered at once');
  assert.equal(quickWorld.writes('lin').length, 2, 'arriveMs 0: she comes in at once');

  const slowWorld = await createWorld();
  await slowWorld.visit();
  const slow = slowWorld.pilot({ thinkMs: 60_000 });
  await slowWorld.greet('bei');
  await slowWorld.tick(slow, 59_999);
  assert.equal(slowWorld.writes('bei').length, 0);
  await slowWorld.tick(slow, 1);
  assert.equal(slowWorld.writes('bei').length, 3);

  // the device clock jumped back an hour after the request was made: a timestamp from the future is not a fresh request
  const skewedWorld = await createWorld();
  await skewedWorld.visit();
  const careful = skewedWorld.pilot();
  await skewedWorld.greet('man');
  await skewedWorld.tick(careful);
  assert.equal(skewedWorld.writes('man', /\/greetings\//).length, 0, 'fresh');
  await skewedWorld.tick(careful, -3_600_000);
  assert.equal((await skewedWorld.visitor.get('/social')).friends.length, 1);
});

// ---- start() and stop() -------------------------------------------------------------------------------------------------------------

function fakeDocument(visibilityState = 'visible') {
  const listeners = new Set();
  return {
    visibilityState,
    addEventListener(type, listener) { if (type === 'visibilitychange') listeners.add(listener); },
    removeEventListener(type, listener) { listeners.delete(listener); },
    show(state) { this.visibilityState = state; for (const listener of [...listeners]) listener({ type: 'visibilitychange' }); },
    get listeners() { return listeners.size; },
  };
}
function fakeTimers() {
  let next = 1;
  const active = new Map();
  return {
    setInterval: (callback, ms) => { const id = next++; active.set(id, { callback, ms }); return id; },
    clearInterval: id => { active.delete(id); },
    fire() { for (const timer of [...active.values()]) timer.callback(); },
    get active() { return active.size; },
    get ms() { return [...active.values()].map(timer => timer.ms); },
  };
}

worldTest('start() ticks on the interval only while the tab is visible, once more at once when it comes back; stop() clears everything', async () => {
  const w = await createWorld();
  await w.visit();
  const doc = fakeDocument('visible'), timers = fakeTimers();
  const pilot = w.pilot({ document: doc, setInterval: timers.setInterval, clearInterval: timers.clearInterval });
  assert.equal(pilot.start(), true);
  assert.equal(pilot.start(), false, 'starting twice does nothing');
  assert.deepEqual([timers.active, timers.ms, doc.listeners], [1, [INTERVAL_MS], 1]);
  assert.equal(pilot.state.running, true);
  await until(() => pilot.state.ticks === 1, 'the first tick, at once');

  timers.fire();
  await until(() => pilot.state.ticks === 2, 'the interval tick');
  doc.show('hidden');
  assert.equal(timers.active, 0, 'a hidden tab has no timer');
  timers.fire();
  await sleep(20);
  assert.equal(pilot.state.ticks, 2, 'and gets no ticks');
  doc.show('visible');
  assert.equal(timers.active, 1, 'the timer is back');
  await until(() => pilot.state.ticks === 3, 'the catch-up tick');

  // a real reaction through the clock: the visitor greets, thinkMs passes, the interval fires
  await w.greet('man');
  w.advance(THINK_MS);
  timers.fire();
  await until(() => pilot.state.ticks === 4, 'the tick that answers');
  assert.equal((await w.visitor.get('/social')).friends.length, 1);

  pilot.stop();
  assert.deepEqual([timers.active, doc.listeners, pilot.state.running, pilot.state.stopped], [0, 0, false, true]);
  assert.equal(await pilot.tick(), false, 'a stopped autopilot never ticks');
  doc.show('visible');
  timers.fire();
  await sleep(20);
  assert.equal(pilot.state.ticks, 4);
  assert.equal(pilot.start(), false, 'and cannot be started again');
  pilot.stop();                                                                  // twice is fine
});

worldTest('start() in a hidden tab waits for it to be shown; stop() before start() keeps it from ever running', async () => {
  const w = await createWorld();
  const doc = fakeDocument('hidden'), timers = fakeTimers();
  const pilot = w.pilot({ document: doc, setInterval: timers.setInterval, clearInterval: timers.clearInterval });
  pilot.start();
  assert.deepEqual([timers.active, doc.listeners, pilot.state.ticks], [0, 1, 0]);
  await sleep(20);
  assert.equal(pilot.state.ticks, 0, 'no tick in a hidden tab');
  doc.show('visible');
  await until(() => pilot.state.ticks === 1, 'the tick when the tab is shown');
  assert.equal(timers.active, 1);
  pilot.stop();

  const never = w.pilot({ document: fakeDocument('visible'), setInterval: timers.setInterval, clearInterval: timers.clearInterval });
  never.stop();
  assert.equal(never.start(), false);
  assert.equal(await never.tick(), false);
  assert.equal(timers.active, 0);
  assert.equal(never.state.ticks, 0);
});

worldTest('start() and stop() use the page\'s own document and timers by default', async () => {
  const w = await createWorld();
  const doc = fakeDocument('visible');
  globalThis.document = doc;
  mock.timers.enable({ apis: ['setInterval'] });
  try {
    const pilot = w.pilot();
    pilot.start();
    await until(() => pilot.state.ticks === 1, 'the first tick');
    mock.timers.tick(INTERVAL_MS);
    await until(() => pilot.state.ticks === 2, 'a tick on the page\'s interval');
    mock.timers.tick(INTERVAL_MS * 3);
    await until(() => pilot.state.ticks >= 3, 'ticks keep coming (a tick that is still running is skipped)');
    pilot.stop();
    const ticks = pilot.state.ticks;
    mock.timers.tick(INTERVAL_MS * 5);
    await sleep(20);
    assert.equal(pilot.state.ticks, ticks, 'stopped');
    assert.equal(doc.listeners, 0);
  } finally {
    mock.timers.reset();
    delete globalThis.document;
  }
});

worldTest('stop() between two mutations of one reaction ends it there (a reset must not be followed by a late welcome line)', async () => {
  const w = await createWorld();
  await w.visit();
  await w.greet('man');
  const kinds = [];
  let pilot;
  pilot = w.pilot({ onChange: change => { kinds.push(change.kind); if (change.kind === 'greeting-accept') pilot.stop(); } });
  w.advance(THINK_MS);
  assert.equal(await pilot.tick(), true);
  assert.deepEqual(kinds, ['greeting-accept']);
  assert.deepEqual(w.writes().map(entry => entry.path.split('/')[1]), ['greetings']);
  assert.deepEqual([pilot.state.failures, pilot.state.mutations, pilot.state.busy], [0, 1, false]);
});

worldTest('stop() in the middle of a tick ends it without a failure being logged', async () => {
  const w = await createWorld();
  await w.visit();
  await w.greet('man');
  const logs = [];
  let pilot, reads = 0;
  const yao = { ...w.people.yao, api: { ...w.people.yao.api, get: async path => { reads += 1; const view = await w.people.yao.api.get(path); pilot.stop(); return view; } } };
  pilot = createAutopilot({ people: { ...w.people, yao }, room: w.room, now: w.clock, log: (...entry) => logs.push(entry) });
  w.advance(THINK_MS);
  assert.equal(await pilot.tick(), true);
  assert.equal(reads, 1);
  assert.deepEqual(logs, []);
  assert.equal(pilot.state.failures, 0);
  assert.equal(w.writes().length, 0, 'nothing was sent after stop()');
  assert.equal(pilot.state.busy, false);
});

// ---- cost, scope and honesty --------------------------------------------------------------------------------------------------------

worldTest('cost: one tick with an idle inbox issues at most 40 requests; with nobody to answer it asks 1 to 3 questions and writes nothing; nothing is cached across ticks', async () => {
  const w = await createWorld();
  const pilot = w.pilot();
  await w.tick(pilot);                                                           // nobody but the cast is here
  const lobby = pilot.state.lastTick.requests;
  assert.ok(lobby >= 1 && lobby <= 3, `an empty room costs ${lobby} requests`);
  assert.equal(lobby, w.sent.length, 'the counter is the number of requests that reached the page\'s fetch');
  assert.equal(w.by('lin').length, 0, 'she is not in the room: not asked');
  assert.equal(w.writes().length, 0, 'nobody to answer: nothing is written, not even the votes in the cup');
  let puts = 0;
  const put = w.storage.put.bind(w.storage);
  w.storage.put = (...args) => { puts += 1; return put(...args); };
  for (let i = 0; i < 5; i += 1) await w.tick(pilot, INTERVAL_MS);
  assert.equal(puts, 0, 'an idle page writes no snapshot');

  await w.visit();
  await w.warm(pilot);                                                           // the votes in the seeded cup are cast now
  assert.ok(puts >= 2, 'the visitor\'s join and the votes were stored');
  puts = 0;
  w.sent.length = 0;
  await w.tick(pilot, INTERVAL_MS);
  const early = pilot.state.lastTick;
  assert.ok(early.requests <= 40, `a visitor and three characters: ${early.requests} requests`);
  assert.equal(early.requests, w.sent.length);
  assert.equal(early.mutations, 0);
  assert.equal(w.by('lin').length, 0);
  assert.equal(w.sent.filter(entry => w.names.get(entry.token) === 'visitor').length, 0, 'the autopilot never uses the visitor\'s token');

  await w.arrive(pilot);
  w.sent.length = 0;
  await w.tick(pilot, INTERVAL_MS);
  const full = pilot.state.lastTick;
  assert.ok(full.requests <= 40, `all four characters in the room: ${full.requests} requests`);
  assert.equal(full.requests, w.sent.length);
  assert.equal(full.mutations, 0);
  assert.ok(w.by('lin').length >= 1, 'now she is asked, like the others');
  assert.ok(w.by('lin').every(entry => entry.path !== '/social'), 'but nobody can greet her, so her greetings are not read');
  assert.ok(full.requests > early.requests);
  const before = w.sent.length;
  await w.tick(pilot, INTERVAL_MS);
  assert.equal(w.sent.length - before, full.requests, 'every tick asks again: the same number of requests, nothing cached');
  assert.ok(w.sent.every(entry => entry.method === 'GET'), 'and only reads');
  puts = 0;
  for (let i = 0; i < 5; i += 1) await w.tick(pilot, INTERVAL_MS);
  assert.equal(puts, 0, 'idle ticks write no snapshot');
});

worldTest('cost: a visitor who opens a dozen cups and games does not make a tick grow beyond the cap', async () => {
  const w = await createWorld();
  await w.visit();
  await w.visitor.post(`/rooms/${w.room.id}/conversation/join`, { joinConsent: true });
  for (let i = 0; i < 12; i += 1) {
    await w.visitor.post(`/rooms/${w.room.id}/worldcups`, { title: `杯 ${i}`, createConsent: true });
    await w.visitor.post(`/rooms/${w.room.id}/games`, { type: 'preference', title: `局 ${i}`, roundLimit: 1, createConsent: true });
  }
  const pilot = w.pilot();
  await w.arrive(pilot);
  await w.tick(pilot, THINK_MS);                                                 // the characters vote in the cups they can see
  await w.tick(pilot, 10_000);
  w.sent.length = 0;
  await w.tick(pilot, 10_000);
  assert.ok(pilot.state.lastTick.requests <= 30, `${pilot.state.lastTick.requests} requests with 13 cups and 13 games open: only the newest three of each are looked at`);
  assert.equal(pilot.state.lastTick.mutations, 0);
  assert.equal(pilot.state.lastTick.requests, w.sent.length);
});

worldTest('scope: through a whole night the cast only ever answers; it creates nothing, uploads nothing, and never speaks in the group chat', async () => {
  const w = await createWorld();
  await w.visit();
  const pilot = w.pilot();
  await w.visitor.post(`/rooms/${w.room.id}/conversation/join`, { joinConsent: true });
  await w.greet('man');
  await w.greet('bei');
  await w.offer(await w.upload({ viewpoint: 'crowd' }), (await w.pairPhotos('yao'))[0]);
  await w.arrive(pilot);
  await w.tick(pilot, THINK_MS);
  await w.visitor.post(`/chats/${w.people.man.id}/messages`, { text: '谢谢你' });
  const game = (await w.visitor.get(`/rooms/${w.room.id}/games`)).games[0];
  await w.visitor.post(`/games/${game.id}/join`, { revision: game.revision, joinConsent: true });
  for (let i = 0; i < 12; i += 1) await w.tick(pilot, 3000);
  const writes = w.writes();
  assert.ok(writes.length >= 10, `a whole night of answers (${writes.length})`);
  for (const entry of writes) {
    assert.ok(ALLOWED_WRITES.some(pattern => pattern.test(entry.path)), `${entry.method} ${entry.path} is not something the cast may do`);
    assert.equal(entry.method, 'POST');
    assert.ok(UUID.test(entry.key), 'fresh Idempotency-Key');
  }
  assert.equal(new Set(writes.map(entry => entry.key)).size, writes.length, 'no key is ever reused');
  assert.deepEqual((await w.sql('SELECT COUNT(*) AS n FROM event_photos'))[0], { n: 5 }, 'four seeded photos and the visitor\'s: the cast uploaded nothing');
  assert.deepEqual((await w.sql('SELECT COUNT(*) AS n FROM event_rooms'))[0], { n: 1 });
  assert.deepEqual((await w.sql('SELECT COUNT(*) AS n FROM avatar_users'))[0], { n: 5 }, 'four characters and the visitor');
  assert.equal((await w.sql('SELECT sender_id FROM event_group_messages')).length, 3, 'only the three lines of the seed are in the group chat');
  assert.deepEqual((await w.sql("SELECT COUNT(*) AS n FROM event_social_pairs WHERE status = 'accepted'"))[0], { n: 2 });
  assert.ok(w.writes('lin').every(entry => /\/join$/.test(entry.path)), '林间 only joined');
  assert.deepEqual(await w.sql('SELECT COUNT(*) AS n FROM event_worldcup_votes WHERE user_id = ?', w.visitor.id), [{ n: 0 }], 'nothing was voted for the visitor');
  assert.deepEqual(await w.sql('SELECT COUNT(*) AS n FROM event_game_answers WHERE user_id = ?', w.visitor.id), [{ n: 0 }], 'nor answered');
});

worldTest('scope: a greeting or an exchange from another room is none of the cast\'s business', async () => {
  const w = await createWorld();
  await w.visit();
  const pilot = w.pilot();
  await w.warm(pilot);
  // The cast never leaves the showcase room, so this is set up by hand: the visitor hosts a room of their own and 小满 is in it.
  const other = (await w.visitor.post('/rooms', { title: '我的小场', venue: '家里', songId: 'late-train', joinConsent: true, participation: 'open' })).room;
  await w.people.man.api.post(`/rooms/${other.code}/join`, { joinConsent: true, participation: 'open' });
  const photo = async (who, viewpoint) => (await who.post(`/rooms/${other.id}/photos`, { dataUrl: PHOTO_URL, visibility: 'members', takenAt: TAKEN_AT, takenSource: 'manual', viewpoint, viewpointSource: 'manual' })).photo;
  const mine = await photo(w.visitor, 'stage'), theirs = await photo(w.people.man.api, 'crowd');
  const greeting = (await w.visitor.post(`/rooms/${other.id}/greetings`, { recipientId: w.people.man.id })).greeting;
  const request = (await w.visitor.post(`/rooms/${other.id}/exchanges`, {
    recipientId: w.people.man.id, offeredPhotoId: mine.id, requestedPhotoId: theirs.id, offeredRevision: mine.revision, requestedRevision: theirs.revision,
    offerPreviewConsent: true, offerOriginalConsent: true, offeredPreviewDataUrl: PHOTO_URL,
  })).exchange;
  // and an exchange 小满 sent himself (by hand too) is not his to answer
  const visitorPhoto = await w.upload({ viewpoint: 'detail' });
  const manCrowd = (await w.pairPhotos('man')).find(item => item.viewpoint === 'crowd');
  const sent = (await w.people.man.api.post(`/rooms/${w.room.id}/exchanges`, {
    recipientId: w.visitor.id, offeredPhotoId: manCrowd.id, requestedPhotoId: visitorPhoto.id, offeredRevision: manCrowd.revision, requestedRevision: visitorPhoto.revision,
    offerPreviewConsent: true, offerOriginalConsent: true, offeredPreviewDataUrl: PHOTO_URL,
  })).exchange;
  w.sent.length = 0;
  for (let i = 0; i < 3; i += 1) await w.tick(pilot, THINK_MS * 2);
  assert.equal(w.writes('man').length, 0, 'nothing in the other room was answered, nor the exchange he sent');
  assert.equal((await w.visitor.get('/social')).outgoing[0].id, greeting.id);
  assert.equal((await w.exchange(request.id)).status, 'pending');
  assert.equal((await w.exchange(sent.id)).status, 'pending');
});

test('keys: a fresh UUID is made even where crypto.randomUUID does not exist', async () => {
  // the in-page autopilot also runs on http://192.168.x.x pages, which have no secure context; the keys must still be valid Idempotency-Keys
  const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  const seen = [];
  const person = key => ({ id: key, npc: { key, host: key === 'yao', participation: 'open' }, api: {
    get: async path => (path.startsWith('/rooms/') ? { members: [{ id: 'yao' }, { id: 'visitor' }], photos: [] } : path === '/social' ? { incoming: [{ id: 'g1', status: 'pending', roomId: 'r', senderId: 'visitor', revision: 1, createdAt: '2000-01-01T00:00:00.000Z' }] } : { chats: [], exchanges: [], worldcups: [], games: [] }),
    post: async (path, body, options) => { seen.push(options.key); return {}; },
  } });
  try {
    for (const stub of [{ getRandomValues: values => values.fill(7) }, undefined]) {
      Object.defineProperty(globalThis, 'crypto', { value: stub, configurable: true });
      const pilot = createAutopilot({ people: { yao: person('yao') }, room: { id: 'r', code: 'ABCDEFGHJKLM' }, now: () => Date.parse('2026-10-05T00:00:00Z') });
      assert.equal(await pilot.tick(), true);
    }
  } finally { Object.defineProperty(globalThis, 'crypto', original); }
  assert.equal(seen.length, 6, 'accept and two welcome lines, twice');
  assert.ok(seen.every(key => /^[A-Za-z0-9_-]{16,128}$/.test(key) && UUID.test(key)), `UUID-shaped, within the worker's key rule: ${seen[0]}`);
  assert.equal(new Set(seen.slice(3)).size, 3, 'random even without crypto');
});
