// The in-page room backend (web/static-runtime): the D1 shim over sql.js, the clock, and the strict runtime with its persistence rules,
// read-only mode and reset. The workers run unchanged on top of it. Needs sql.js (devDependency 1.14.2); without it these tests skip.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createD1 } from '../web/static-runtime/d1-sqljs.js';
import { createClock } from '../web/static-runtime/clock.js';
import { createStaticRuntime, StaticRuntimeError, READ_ONLY_MESSAGE, DB_KEY } from '../web/static-runtime/runtime.js';
import { createTransport } from '../web/static-runtime/transport.js';
import { createMemoryStore } from '../web/static-runtime/idb-store.js';
import { createEventApiClient } from '../web/event-client/api.js';

const require = createRequire(import.meta.url);
let SQL = null, skip = false;
try { SQL = await require('sql.js')(); } catch (error) {
  if (error?.code !== 'MODULE_NOT_FOUND') throw error;                       // a broken install must fail loudly, only a missing one skips
  skip = 'sql.js is not installed (package.json devDependency sql.js 1.14.2 is added by the static-build task)';
}
const sqlTest = (name, fn) => test(name, { skip }, fn);

const migrationDir = new URL('../runtime-preview/drizzle/', import.meta.url);
const migrations = skip ? [] : readdirSync(migrationDir).filter(name => name.endsWith('.sql')).sort().map(name => ({ name, sql: readFileSync(new URL(name, migrationDir), 'utf8') }));
const JPEG_FIXTURE = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAACAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDx6iiitzM//9k=';
const AVATAR = { version: 2, skin: 1, hair: 0, hairColor: 0, outfit: 0, accessory: 'headphones', pose: 'sway', top: 0, bottom: 0, shoes: 1, eyewear: 0, topColor: 0, bottomColor: 1, shoeColor: 0, expression: 'neutral' };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const uuid = () => crypto.randomUUID();
/** Waits for a condition instead of guessing how long the machine needs. */
async function until(condition, what, timeoutMs = 4000) {
  const deadline = Date.now() + timeoutMs;
  while (!(await condition())) { if (Date.now() > deadline) assert.fail(`timed out waiting for ${what}`); await sleep(2); }
}

// ---- helpers ----------------------------------------------------------------------------------------------------------------------

/** A persistent-looking store whose kv puts can be counted, held back, failed or applied late, and whose clear() is immediate. */
function gatedStore(base = createMemoryStore()) {
  const store = {
    base, persistent: true, name: 'gated', puts: 0, clears: 0, hold: null, failWith: null, applyDelayMs: 0, getFails: null, clearHangs: false, jitter: null,
    async get(name, key) { if (store.getFails) throw store.getFails; return base.get(name, key); },
    async put(name, key, value) {
      if (name === 'kv') store.puts += 1;
      if (store.jitter) await sleep(store.jitter());
      if (store.hold) await store.hold;
      if (name === 'kv' && store.failWith) throw store.failWith;
      if (store.applyDelayMs) await sleep(store.applyDelayMs);
      return base.put(name, key, value);
    },
    delete: (...args) => base.delete(...args),
    keys: name => base.keys(name),
    async clear() { store.clears += 1; if (store.clearHangs) await new Promise(() => {}); return base.clear(); },
    close() {},
    holdPuts() { let release; store.hold = new Promise(resolve => { release = resolve; }); store.release = () => { store.hold = null; release(); }; },
  };
  return store;
}
const boot = (storage, options = {}) => createStaticRuntime({ SQL, migrations, storage, ...options });
function connect(runtime) {
  const transport = createTransport(() => runtime, () => { throw new Error('the network must not be used'); });
  return { transport, api: createEventApiClient({ fetch: transport }) };
}
const newUser = (api, name = 'visitor') => api.request('/session', { namespace: 'avatar', method: 'POST', bodyJson: JSON.stringify({ name, avatar: AVATAR }), key: uuid() });
const post = (api, token, path, body, namespace = 'event') => api.request(path, { namespace, method: 'POST', token, bodyJson: JSON.stringify(body), key: uuid() });
const userCount = async runtime => (await runtime.env.DB.prepare('SELECT COUNT(*) AS n FROM avatar_users').first()).n;
const snapshotOf = async storage => (await storage.get('kv', DB_KEY));

// ---- D1 shim ----------------------------------------------------------------------------------------------------------------------

sqlTest('d1: prepare() / bind() / first() / all() / run() have the D1 shapes and keep the `query` and `args` properties', async () => {
  const { DB } = createD1({ SQL });
  await DB.prepare('CREATE TABLE t (a INTEGER PRIMARY KEY, b TEXT, c BLOB)').run();
  const insert = DB.prepare('INSERT INTO t (b, c) VALUES (?, ?)');
  assert.equal(insert.query, 'INSERT INTO t (b, c) VALUES (?, ?)');
  assert.deepEqual(insert.args, []);
  const bound = insert.bind('x', new Uint8Array([1, 2]));
  assert.notEqual(bound, insert, 'bind() returns a new statement');
  assert.equal(bound.query, insert.query);
  assert.deepEqual(insert.args, [], 'the original is not changed');
  const ran = await bound.run();
  assert.equal(ran.success, true);
  assert.deepEqual(ran.results, []);
  assert.equal(ran.meta.changes, 1);
  await insert.bind(null, new ArrayBuffer(2)).run();
  const all = await DB.prepare('SELECT a, b, c FROM t ORDER BY a').all();
  assert.equal(all.success, true);
  assert.deepEqual(all.results, [{ a: 1, b: 'x', c: new Uint8Array([1, 2]) }, { a: 2, b: null, c: new Uint8Array([0, 0]) }]);
  assert.equal(all.meta.rows_read, 2);
  assert.deepEqual(await DB.prepare('SELECT a, b FROM t WHERE a = ?').bind(1).first(), { a: 1, b: 'x' });
  assert.equal(await DB.prepare('SELECT a, b FROM t WHERE a = ?').bind(1).first('b'), 'x');
  assert.equal(await DB.prepare('SELECT a FROM t WHERE a = ?').bind(99).first(), null);
  assert.equal(await DB.prepare('SELECT a FROM t WHERE a = ?').bind(99).first('a'), null);
  await assert.rejects(DB.prepare('SELECT a FROM t').first('nope'), /D1_ERROR/);
  assert.equal((await DB.prepare('UPDATE t SET b = ? WHERE a = ?').bind('y', 1).run()).meta.changes, 1);
  assert.equal((await DB.prepare('UPDATE t SET b = ? WHERE a = ?').bind('y', 99).run()).meta.changes, 0);
  assert.deepEqual((await DB.prepare('SELECT 1 AS one').run()).results, [{ one: 1 }], 'run() of a SELECT still returns the rows');
  const { prepare } = DB;                         // detached: no `this` needed
  assert.deepEqual(await prepare('SELECT 7 AS n').first(), { n: 7 });
  const spread = { ...DB.prepare('SELECT ? AS v').bind(5) };            // the sql.js adapter for the Worker-mode suite spreads statements
  assert.equal(spread.query, 'SELECT ? AS v');
  assert.deepEqual(spread.args, [5]);
});

sqlTest('d1: bind() throws D1-style errors for undefined and for values D1 cannot store, never bare strings', () => {
  const { DB } = createD1({ SQL });
  const select = DB.prepare('SELECT ?');
  for (const bad of [undefined, {}, [], () => 1, Symbol('s'), new Date(0)]) {
    assert.throws(() => select.bind(bad), error => error instanceof Error && /^D1_TYPE_ERROR: Type '/.test(error.message), String(typeof bad));
  }
  assert.throws(() => select.bind('ok', undefined), /D1_TYPE_ERROR: Type 'undefined' not supported for value 'undefined'/);
  assert.doesNotThrow(() => select.bind(null));
  assert.doesNotThrow(() => select.bind(1, 'a', true, 2n, new Uint8Array(1), new ArrayBuffer(1)));
  assert.doesNotThrow(() => DB.prepare('SELECT 1').bind());
});

sqlTest('d1: values round trip (booleans as 1/0, big text, unicode, blobs) and SQL errors are Errors with SQLite\'s own message', async () => {
  const { DB } = createD1({ SQL });
  await DB.prepare('CREATE TABLE v (k TEXT PRIMARY KEY, t TEXT, n, b BLOB)').run();
  const big = '同一刻😀'.repeat(50000);
  await DB.prepare('INSERT INTO v VALUES (?, ?, ?, ?)').bind('a', big, true, new Uint8Array([0, 255])).run();
  await DB.prepare('INSERT INTO v VALUES (?, ?, ?, ?)').bind('b', 'x', false, null).run();
  const rows = (await DB.prepare('SELECT * FROM v ORDER BY k').all()).results;
  assert.equal(rows[0].t, big);
  assert.equal(rows[0].n, 1);
  assert.equal(rows[1].n, 0);
  assert.deepEqual(rows[0].b, new Uint8Array([0, 255]));
  await assert.rejects(DB.prepare('SELEC nope').run(), error => error instanceof Error && /syntax error/.test(error.message));
  await assert.rejects(DB.prepare('INSERT INTO v (k) VALUES (?)').bind('a').run(), error => error instanceof Error && /UNIQUE constraint failed: v\.k/.test(error.message));
  await assert.rejects(DB.prepare('SELECT * FROM missing_table').all(), /no such table/);
  await assert.rejects(DB.prepare('SELECT ? AS a').bind('x', 'too many').first(), Error);
});

sqlTest('d1: batch() is one transaction: all statements land together, results come back in order', async () => {
  const { DB } = createD1({ SQL });
  await DB.prepare('CREATE TABLE t (a INTEGER PRIMARY KEY, b TEXT)').run();
  const results = await DB.batch([
    DB.prepare('INSERT INTO t (b) VALUES (?)').bind('one'),
    DB.prepare('INSERT INTO t (b) VALUES (?)').bind('two'),
    DB.prepare('SELECT COUNT(*) AS n FROM t'),
    DB.prepare('UPDATE t SET b = upper(b)'),
    DB.prepare('SELECT b FROM t ORDER BY a'),
  ]);
  assert.equal(results.length, 5);
  assert.deepEqual(results.map(result => result.success), [true, true, true, true, true]);
  assert.deepEqual(results.map(result => result.meta.changes), [1, 1, 0, 2, 0]);
  assert.deepEqual(results[2].results, [{ n: 2 }], 'a later statement sees the earlier ones');
  assert.deepEqual(results[4].results, [{ b: 'ONE' }, { b: 'TWO' }]);
  assert.deepEqual(await DB.batch([]), [], 'an empty batch is fine');
});

sqlTest('d1: a failing statement rolls the whole batch back and rethrows SQLite\'s own message (the workers match on it)', async () => {
  const { DB } = createD1({ SQL });
  await DB.prepare('CREATE TABLE t (a INTEGER PRIMARY KEY, b TEXT CHECK (b <> \'bad\'))').run();
  await DB.prepare('INSERT INTO t (a, b) VALUES (1, \'first\')').run();
  const count = async () => (await DB.prepare('SELECT COUNT(*) AS n FROM t').first()).n;
  const guard = /event_mutation_guard_assertion|CHECK constraint|UNIQUE constraint/;
  await assert.rejects(DB.batch([DB.prepare('INSERT INTO t (b) VALUES (?)').bind('fine'), DB.prepare('INSERT INTO t (b) VALUES (?)').bind('bad')]), error => error instanceof Error && guard.test(error.message) && /CHECK constraint failed/.test(error.message));
  assert.equal(await count(), 1, 'the first insert was rolled back');
  await assert.rejects(DB.batch([DB.prepare('INSERT INTO t (b) VALUES (?)').bind('fine'), DB.prepare('INSERT INTO t (a, b) VALUES (1, ?)').bind('dup')]), error => guard.test(error.message) && /UNIQUE constraint failed/.test(error.message));
  assert.equal(await count(), 1);
  await assert.rejects(DB.batch([DB.prepare('INSERT INTO t (b) VALUES (?)').bind('fine'), DB.prepare('SELEC broken')]), /syntax error/);
  assert.equal(await count(), 1);
  await assert.rejects(DB.batch([DB.prepare('INSERT INTO t (b) VALUES (?)').bind('fine'), { not: 'a statement' }]), TypeError);
  assert.equal(await count(), 1, 'even a malformed statement list leaves nothing behind');
  await assert.rejects(DB.batch('nope'), TypeError);
  await DB.batch([DB.prepare('INSERT INTO t (b) VALUES (?)').bind('after')]);
  assert.equal(await count(), 2, 'the database is usable after every failed batch (no open transaction left)');
});

sqlTest('d1: the real guard table from the migrations fails with the message the worker regex expects', async () => {
  const { DB, sql } = createD1({ SQL });
  for (const migration of migrations) sql().exec(migration.sql);
  const guard = DB.prepare('INSERT INTO event_mutation_guard (id,assertion) VALUES (?,CASE WHEN (?) THEN 1 ELSE 0 END)');
  await DB.batch([guard.bind('g1', 1), DB.prepare('DELETE FROM event_mutation_guard WHERE id = ?').bind('g1')]);
  await assert.rejects(DB.batch([guard.bind('g2', 0), DB.prepare('DELETE FROM event_mutation_guard WHERE id = ?').bind('g2')]), error => /event_mutation_guard_assertion|CHECK constraint/.test(error.message) && /event_mutation_guard_assertion/.test(error.message));
  assert.equal((await DB.prepare('SELECT COUNT(*) AS n FROM event_mutation_guard').first()).n, 0, 'no guard row is left behind');
});

sqlTest('d1: batch() runs without an await between statements: when the call returns its promise, everything has already happened', async () => {
  const raw = createD1({ SQL });
  raw.sql().run('CREATE TABLE t (a)');
  const pending = raw.DB.batch([raw.DB.prepare('INSERT INTO t VALUES (1)'), raw.DB.prepare('INSERT INTO t VALUES (2)')]);
  assert.equal(raw.sql().exec('SELECT COUNT(*) FROM t')[0].values[0][0], 2, 'committed before the first await could resume');
  await pending;
  // two concurrent batches never interleave their statements
  const order = [];
  const probe = createD1({ SQL, onWrite: () => order.push('write') });
  await probe.DB.prepare('CREATE TABLE log (who TEXT, n INTEGER)').run();
  order.length = 0;
  const a = probe.DB.batch([1, 2, 3].map(n => probe.DB.prepare('INSERT INTO log VALUES (?, ?)').bind('a', n)));
  const b = probe.DB.batch([1, 2, 3].map(n => probe.DB.prepare('INSERT INTO log VALUES (?, ?)').bind('b', n)));
  await Promise.all([a, b]);
  assert.deepEqual((await probe.DB.prepare('SELECT who FROM log ORDER BY rowid').all()).results.map(row => row.who), ['a', 'a', 'a', 'b', 'b', 'b']);
  assert.deepEqual(order, ['write', 'write'], 'one notification per batch');
});

sqlTest('d1: onWrite fires only for statements that changed rows, once per batch, after COMMIT, and a read-only batch is not a write', async () => {
  const events = [];
  let d1;
  d1 = createD1({ SQL, onWrite() {
    // Inside a transaction BEGIN fails: a notification during a batch would be caught here.
    let inside = false;
    try { d1.sql().run('BEGIN'); d1.sql().run('ROLLBACK'); } catch { inside = true; }
    events.push(inside ? 'write-inside-transaction' : 'write');
  } });
  const { DB } = d1;
  await DB.prepare('CREATE TABLE t (a INTEGER PRIMARY KEY, b TEXT)').run();
  events.length = 0;
  await DB.prepare('SELECT * FROM t').all();
  await DB.prepare('SELECT * FROM t').first();
  await DB.prepare('UPDATE t SET b = ? WHERE a = ?').bind('x', 1).run();           // matches nothing
  await DB.prepare('DELETE FROM t WHERE a = 1').run();
  await DB.prepare('INSERT OR IGNORE INTO t (a, b) VALUES (1, NULL)').run();       // the first one is a real insert
  assert.deepEqual(events, ['write'], 'only the real insert was a write');
  await DB.prepare('INSERT OR IGNORE INTO t (a, b) VALUES (1, \'dup\')').run();    // ignored duplicate: no change
  assert.deepEqual(events, ['write']);
  await DB.prepare('UPDATE t SET b = ? WHERE a = ?').bind('y', 1).run();
  assert.deepEqual(events, ['write', 'write']);
  events.length = 0;
  await DB.batch([DB.prepare('SELECT * FROM t'), DB.prepare('SELECT COUNT(*) FROM t'), DB.prepare('UPDATE t SET b = ? WHERE a = 99').bind('z')]);
  assert.deepEqual(events, [], 'a batch that read and changed nothing');
  await DB.batch([DB.prepare('SELECT * FROM t'), DB.prepare('INSERT INTO t (b) VALUES (?)').bind('p'), DB.prepare('INSERT INTO t (b) VALUES (?)').bind('q'), DB.prepare('DELETE FROM t WHERE b = ?').bind('p')]);
  assert.deepEqual(events, ['write'], 'one notification for the batch, after it committed');
  events.length = 0;
  await assert.rejects(DB.batch([DB.prepare('INSERT INTO t (b) VALUES (?)').bind('r'), DB.prepare('INSERT INTO t (a, b) VALUES (1, ?)').bind('dup')]), /UNIQUE/);
  assert.deepEqual(events, [], 'a rolled-back batch is not a write');
});

sqlTest('d1: DML after DML does not leak the previous change count; DDL and WITH...DML are recognised; RETURNING counts', async () => {
  const events = [];
  const { DB } = createD1({ SQL, onWrite: () => events.push('write') });
  await DB.prepare('CREATE TABLE t (a INTEGER PRIMARY KEY, b TEXT)').run();
  await DB.prepare('INSERT INTO t (b) VALUES (\'x\')').run();
  events.length = 0;
  assert.equal((await DB.prepare('UPDATE t SET b = ? WHERE a = 99').bind('q').run()).meta.changes, 0, 'sqlite3_changes() would still say 1 here');
  assert.deepEqual(events, []);
  await DB.prepare('CREATE TABLE u (a)').run();                                  // DDL right after a zero-row DML
  assert.deepEqual(events, ['write'], 'schema changes are never missed');
  events.length = 0;
  const cte = await DB.prepare('WITH s(v) AS (SELECT 5) INSERT INTO t (a, b) SELECT v, \'cte\' FROM s').run();
  assert.equal(cte.meta.changes, 1);
  assert.deepEqual(events, ['write']);
  events.length = 0;
  const read = await DB.prepare('WITH s(v) AS (SELECT 1) SELECT v FROM s').all();
  assert.deepEqual(read.results, [{ v: 1 }]);
  assert.deepEqual(events, [], 'a WITH ... SELECT is a read');
  const returning = await DB.prepare('INSERT INTO t (b) VALUES (\'r\') RETURNING a, b').all();
  assert.equal(returning.results.length, 1);
  assert.deepEqual(events, ['write'], 'RETURNING rows do not hide the write');
  events.length = 0;
  await DB.prepare('-- a comment first\n  /* and another */ UPDATE t SET b = \'c\' WHERE a = 5').run();
  assert.deepEqual(events, ['write'], 'leading comments and whitespace are skipped when classifying');
});

sqlTest('d1: a listener that serialises the database from onWrite works (the statement is already freed) and the bytes hold the row', async () => {
  const snapshots = [];
  let d1;
  d1 = createD1({ SQL, onWrite: () => snapshots.push(d1.exportBytes()) });
  await d1.DB.prepare('CREATE TABLE t (a)').run();
  await d1.DB.prepare('INSERT INTO t VALUES (1)').run();
  await d1.DB.batch([d1.DB.prepare('INSERT INTO t VALUES (2)'), d1.DB.prepare('INSERT INTO t VALUES (3)')]);
  assert.equal(snapshots.length, 3);
  const countIn = bytes => { const db = new SQL.Database(bytes); try { return db.exec('SELECT COUNT(*) FROM t')[0].values[0][0]; } finally { db.close(); } };
  assert.deepEqual(snapshots.map(countIn), [0, 1, 3]);
  await d1.DB.prepare('INSERT INTO t VALUES (4)').run();               // and the live database still works after each export
  assert.equal((await d1.DB.prepare('SELECT COUNT(*) AS n FROM t').first()).n, 4);
});

sqlTest('d1: exportBytes() re-applies PRAGMA foreign_keys = ON, and a database opened from bytes has it on', async () => {
  const fk = async DB => { await DB.prepare('INSERT INTO parent VALUES (1)').run(); await DB.prepare('INSERT INTO child VALUES (1, 1)').run(); await assert.rejects(DB.prepare('INSERT INTO child VALUES (2, 99)').run(), /FOREIGN KEY constraint failed/); };
  const first = createD1({ SQL });
  first.sql().exec('CREATE TABLE parent (id INTEGER PRIMARY KEY); CREATE TABLE child (id INTEGER PRIMARY KEY, p INTEGER REFERENCES parent(id))');
  assert.equal(first.sql().exec('PRAGMA foreign_keys')[0].values[0][0], 1);
  const bytes = first.exportBytes();
  assert.ok(bytes instanceof Uint8Array && bytes.length > 0);
  assert.equal(first.sql().exec('PRAGMA foreign_keys')[0].values[0][0], 1, 'still on after the export closed and reopened the connection');
  await fk(first.DB);
  const second = createD1({ SQL, bytes: first.exportBytes() });
  assert.equal(second.sql().exec('PRAGMA foreign_keys')[0].values[0][0], 1);
  assert.equal((await second.DB.prepare('SELECT COUNT(*) AS n FROM child').first()).n, 1, 'the data came along');
  await assert.rejects(second.DB.prepare('INSERT INTO child VALUES (3, 98)').run(), /FOREIGN KEY constraint failed/);
});

sqlTest('d1: close() is idempotent and a closed database refuses work with a clear error; bad construction is a TypeError', async () => {
  const d1 = createD1({ SQL });
  await d1.DB.prepare('CREATE TABLE t (a)').run();
  d1.close(); d1.close();
  await assert.rejects(d1.DB.prepare('SELECT 1').first(), /closed/);
  await assert.rejects(d1.DB.batch([d1.DB.prepare('SELECT 1')]), /closed/);
  assert.throws(() => d1.exportBytes(), /closed/);
  assert.throws(() => createD1({}), TypeError);
  assert.throws(() => createD1(), TypeError);
  assert.throws(() => createD1({ SQL: {} }), TypeError);
});

// ---- clock ------------------------------------------------------------------------------------------------------------------------

test('clock: max(device time, build time), so a device clock behind the build cannot fail the seed', () => {
  const buildAtMs = Date.parse('2026-10-05T12:00:00Z');
  let device = Date.parse('2020-01-01T00:00:00Z');
  const clock = createClock({ buildAtMs, now: () => device });
  assert.equal(clock(), buildAtMs, 'behind the build: the build time');
  device = Date.parse('2026-09-24T00:00:00Z');
  assert.equal(clock(), buildAtMs, 'also before the seeded photos\' night');
  device = buildAtMs;
  assert.equal(clock(), buildAtMs);
  device = Date.parse('2027-01-01T00:00:00Z');
  assert.equal(clock(), device, 'ahead of the build: the device clock');
  device = NaN;
  assert.equal(clock(), buildAtMs, 'a broken clock falls back to the build time');
  const real = createClock({ buildAtMs: 0 });
  assert.ok(Math.abs(real() - Date.now()) < 1000, 'now defaults to Date.now');
  assert.throws(() => createClock({}), TypeError);
  assert.throws(() => createClock({ buildAtMs: 'soon' }), TypeError);
  assert.throws(() => createClock({ buildAtMs: 1, now: 5 }), TypeError);
});

sqlTest('clock: the runtime gives the workers the injected clock, so a room made on a skewed device is stamped with the build time', async () => {
  const buildAtMs = Date.parse('2026-10-05T12:00:00.000Z');
  for (const [device, expected] of [[Date.parse('2020-01-01T00:00:00Z'), buildAtMs], [Date.parse('2027-03-04T05:06:07.000Z'), Date.parse('2027-03-04T05:06:07.000Z')]]) {
    const runtime = await boot(createMemoryStore(), { clock: createClock({ buildAtMs, now: () => device }) });
    const { api } = connect(runtime);
    const me = await newUser(api);
    const { room } = await post(api, me.token, '/rooms', { title: 't', venue: '', songId: 'late-train', joinConsent: true, participation: 'open' });
    assert.equal(room.createdAt, new Date(expected).toISOString());
    assert.equal(room.status, 'open');
    assert.equal(Date.parse(room.expiresAt) - Date.parse(room.createdAt), 24 * 3600 * 1000, 'a visitor\'s room keeps the real 24 h rule');
    await runtime.close();
  }
});

// ---- runtime: boot, ledger, strictness --------------------------------------------------------------------------------------------

sqlTest('runtime: a fresh runtime boots on the memory store in under 150 ms and applies every migration', async () => {
  const times = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    const started = performance.now();
    const runtime = await boot(createMemoryStore());
    times.push(performance.now() - started);
    assert.equal(runtime.fresh, true);
    const applied = (await runtime.env.DB.prepare('SELECT name FROM _static_migrations ORDER BY name').all()).results.map(row => row.name);
    assert.deepEqual(applied, migrations.map(migration => migration.name));
    assert.equal((await runtime.env.DB.prepare('SELECT COUNT(*) AS n FROM sqlite_master WHERE type = \'table\'').first()).n > 40, true, 'the schema exists');
    await runtime.close();
  }
  assert.ok(Math.min(...times) < 150, `boot times ${times.map(t => t.toFixed(1)).join(', ')} ms`);
});

sqlTest('runtime: exposes {fresh, env, handle, flush, batch, maintenance, reset, close, setWritable, writable, persistent} and the worker bindings', async () => {
  const storage = gatedStore();
  const runtime = await boot(storage);
  for (const name of ['fresh', 'env', 'handle', 'flush', 'batch', 'maintenance', 'reset', 'close', 'setWritable', 'writable', 'persistent']) assert.ok(name in runtime, name);
  for (const name of ['handle', 'flush', 'batch', 'maintenance', 'reset', 'close', 'setWritable']) assert.equal(typeof runtime[name], 'function', name);
  assert.equal(runtime.writable, true);
  assert.equal(runtime.persistent, true, 'a persistent store');
  assert.deepEqual(Object.keys(runtime.env).sort(), ['ASSETS', 'DB', 'EVENT_CLIENT_IP', 'PHOTOS']);
  assert.equal(runtime.env.EVENT_CLIENT_IP, 'in-browser');
  const missing = await runtime.env.ASSETS.fetch(new Request('https://x.test/anything'));
  assert.equal(missing.status, 404);
  assert.equal(typeof runtime.env.DB.prepare, 'function');
  assert.equal(typeof runtime.env.DB.batch, 'function');
  await runtime.env.PHOTOS.put('events/x.jpg', new Uint8Array([1, 2, 3]));
  assert.deepEqual([...(await runtime.env.PHOTOS.get('events/x.jpg')).body], [1, 2, 3]);
  assert.deepEqual(await storage.keys('blobs'), ['events/x.jpg'], 'PHOTOS is the blobs store');
  assert.equal((await boot(createMemoryStore())).persistent, false, 'a memory store is not persistent');
  assert.equal((await boot(gatedStore(), { persist: false })).persistent, false, 'persist: false');
});

sqlTest('runtime: handle() answers /api/event and /api/avatar only, accepts {bodyText} and plain-object headers, passes headers to the worker', async () => {
  const runtime = await boot(createMemoryStore());
  assert.equal(await runtime.handle({ url: '/index.html', method: 'GET', headers: new Headers() }), null);
  assert.equal(await runtime.handle({ url: '/api/live/health', method: 'GET', headers: new Headers() }), null);
  assert.equal(await runtime.handle({ url: '/api/eventful', method: 'GET', headers: new Headers() }), null);
  assert.equal((await runtime.handle({ url: 'http://in-browser.invalid/api/event/health', method: 'GET', headers: {} })).status, 200);
  const created = await runtime.handle({ url: '/api/avatar/session', method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': uuid() }, bodyText: JSON.stringify({ name: 'bodyText', avatar: AVATAR }) });
  assert.equal(created.status, 201);
  assert.equal(typeof (await created.json()).token, 'string');
  const crossSite = await runtime.handle({ url: '/api/event/health', method: 'GET', headers: new Headers({ 'Sec-Fetch-Site': 'cross-site' }) });
  assert.equal(crossSite.status, 403, 'the worker saw the headers');
  const noBody = await runtime.handle({ url: '/api/avatar/session', method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': uuid() } });
  assert.ok([201, 400].includes(noBody.status), `a POST without a body reaches the worker as an empty body and gets its answer (${noBody.status})`);
  assert.equal(typeof (await noBody.json()), 'object');
  await runtime.close();
});

sqlTest('runtime: the migration ledger records name and sha256; a reboot applies nothing again and writes nothing', async () => {
  const storage = gatedStore();
  const first = await boot(storage);
  await first.flush();
  assert.equal(storage.puts, 1, 'the fresh database was stored once');
  const rows = (await first.env.DB.prepare('SELECT name, sha256 FROM _static_migrations ORDER BY name').all()).results;
  assert.equal(rows.length, migrations.length);
  assert.ok(rows.every(row => /^[0-9a-f]{64}$/.test(row.sha256)));
  const { createHash } = await import('node:crypto');
  assert.equal(rows[0].sha256, createHash('sha256').update(migrations[0].sql).digest('hex'));
  await first.close();
  const second = await boot(storage);
  assert.equal(second.fresh, false);
  await second.flush();
  assert.equal(storage.puts, 1, 'nothing changed, nothing was written');
  assert.equal((await second.env.DB.prepare('SELECT COUNT(*) AS n FROM _static_migrations').first()).n, migrations.length);
  await second.close();
});

sqlTest('runtime: a changed applied migration throws MIGRATION_CHANGED, names it, and heals nothing', async () => {
  const storage = gatedStore();
  const first = await boot(storage);
  await first.flush();
  await first.close();
  const before = (await snapshotOf(storage)).bytes;
  const edited = migrations.map((migration, index) => (index === 2 ? { ...migration, sql: `${migration.sql}\n-- edited` } : migration));
  await assert.rejects(createStaticRuntime({ SQL, migrations: edited, storage }), error => error instanceof StaticRuntimeError && error.name === 'StaticRuntimeError' && error.code === 'MIGRATION_CHANGED' && error.migration === migrations[2].name);
  assert.deepEqual((await snapshotOf(storage)).bytes, before, 'the saved snapshot was not touched');
  assert.equal(storage.clears, 0, 'strict: the runtime never wipes (boot policy does)');
  // a changed migration is refused even when a brand-new migration comes before it in the list
  const reordered = [{ name: '0000_aaa_new.sql', sql: 'CREATE TABLE brand_new (a)' }, ...edited];
  await assert.rejects(createStaticRuntime({ SQL, migrations: reordered, storage }), { code: 'MIGRATION_CHANGED' });
  const good = await boot(storage);
  assert.equal(good.fresh, false, 'and the untouched build still opens it');
  await good.close();
});

sqlTest('runtime: an unreadable snapshot throws SNAPSHOT_CORRUPT (garbage, truncated, wrong record, empty, future format) and is left in place', async () => {
  const healthy = gatedStore();
  const source = await boot(healthy);
  await source.flush();
  await source.close();
  const real = (await snapshotOf(healthy)).bytes;
  const cases = {
    'garbage bytes': { bytes: new Uint8Array(4096).fill(7), savedAt: 1, format: 1 },
    'truncated database': { bytes: real.slice(0, 1500), savedAt: 1, format: 1 },
    'only the 100-byte header, no pages': { bytes: Uint8Array.from(real.subarray(0, 100)), savedAt: 1, format: 1 },
    'no bytes': { savedAt: 1, format: 1 },
    'zero bytes': { bytes: new Uint8Array(0), savedAt: 1, format: 1 },
    'bytes are not bytes': { bytes: 'text', format: 1 },
    'future format': { bytes: real, savedAt: 1, format: 2 },
    'a string record': 'not an object',
    'a number record': 42,
  };
  for (const [label, record] of Object.entries(cases)) {
    const storage = gatedStore();
    await storage.base.put('kv', DB_KEY, record);
    await assert.rejects(createStaticRuntime({ SQL, migrations, storage }), error => error instanceof StaticRuntimeError && error.code === 'SNAPSHOT_CORRUPT', label);
    assert.equal(storage.clears, 0, `${label}: not wiped`);
    assert.equal(storage.puts, 0, `${label}: nothing written`);
    assert.deepEqual(await storage.base.get('kv', DB_KEY), record, `${label}: the bad record is still there for the boot policy to deal with`);
  }
  const readable = gatedStore();
  await readable.base.put('kv', DB_KEY, { bytes: real, savedAt: 1 });
  await (await boot(readable)).close();                                    // a record without `format` is accepted: format 1 is the default
});

sqlTest('runtime: storage.get failing throws STORAGE_UNAVAILABLE (not a corrupt snapshot)', async () => {
  const storage = gatedStore();
  storage.getFails = new Error('IDB read failed');
  await assert.rejects(boot(storage), error => error instanceof StaticRuntimeError && error.code === 'STORAGE_UNAVAILABLE' && error.cause === storage.getFails);
});

sqlTest('runtime: a NEW migration applies inside BEGIN/COMMIT to an existing snapshot; a failing one rolls back and leaves the snapshot untouched', async () => {
  const storage = gatedStore();
  const first = await boot(storage);
  await first.flush();
  await first.close();
  const bytes = (await snapshotOf(storage)).bytes;
  const extra = { name: '9990_extra.sql', sql: 'CREATE TABLE extra_t (a INTEGER PRIMARY KEY, b TEXT);\nINSERT INTO extra_t (b) VALUES (\'seeded by the migration\');' };
  const upgraded = await createStaticRuntime({ SQL, migrations: [...migrations, extra], storage });
  assert.equal(upgraded.fresh, false);
  assert.deepEqual((await upgraded.env.DB.prepare('SELECT b FROM extra_t').first()), { b: 'seeded by the migration' });
  assert.equal((await upgraded.env.DB.prepare('SELECT COUNT(*) AS n FROM _static_migrations').first()).n, migrations.length + 1);
  await upgraded.flush();
  assert.equal(storage.puts, 2, 'the upgrade was stored');
  await upgraded.close();
  const again = await createStaticRuntime({ SQL, migrations: [...migrations, extra], storage });
  assert.equal(storage.puts, 2, 'and is not applied twice');
  await again.close();

  const clean = gatedStore();
  await clean.base.put('kv', DB_KEY, { bytes, savedAt: 1, format: 1 });
  const broken = { name: '9991_broken.sql', sql: 'CREATE TABLE half_done (a);\nINSERT INTO table_that_does_not_exist VALUES (1);' };
  await assert.rejects(createStaticRuntime({ SQL, migrations: [...migrations, broken], storage: clean }), error => error instanceof StaticRuntimeError && error.code === 'MIGRATION_FAILED' && error.migration === broken.name && error.cause instanceof Error);
  assert.deepEqual((await clean.base.get('kv', DB_KEY)).bytes, bytes, 'the saved snapshot is untouched');
  const fine = await createStaticRuntime({ SQL, migrations, storage: clean });
  await assert.rejects(fine.env.DB.prepare('SELECT * FROM half_done').first(), /no such table/);
  await fine.close();
});

// ---- runtime: persistence ---------------------------------------------------------------------------------------------------------

sqlTest('runtime: a mutating request is acknowledged only after storage.put resolved (delayed store), and the stored snapshot holds it', async () => {
  const storage = gatedStore();
  const runtime = await boot(storage);
  const { api } = connect(runtime);
  await runtime.flush();
  const baseline = storage.puts;
  storage.holdPuts();
  let acknowledged = false;
  const pending = newUser(api, 'held').then(result => { acknowledged = true; return result; });
  await until(() => storage.puts === baseline + 1, 'the snapshot put to start');
  await sleep(30);                                    // give a response that wrongly skipped the put every chance to arrive
  assert.equal(acknowledged, false, 'the response is held back while the put is pending');
  assert.equal(await userCount(runtime), 1, 'the row is already in memory');
  storage.release();
  const me = await pending;
  assert.equal(acknowledged, true);
  const reloaded = await boot(storage);
  assert.equal(await userCount(reloaded), 1, 'the acknowledged user is in the stored snapshot');
  const same = await connect(reloaded).api.request('/session', { namespace: 'avatar', token: me.token });
  assert.equal(same.user.name, 'held');
  await reloaded.close(); await runtime.close();
});

sqlTest('runtime: through the real client and transport: session, room, join, photo, reload, everything comes back; zero network', async () => {
  const storage = createMemoryStore();
  let runtime = await boot(storage);
  let { api } = connect(runtime);
  assert.deepEqual(await api.request('/health'), { ok: true, capacity: 24, identity: 'avatar-session' });
  const host = await newUser(api, '阿遥'), guest = await newUser(api, '小满');
  const { room } = await post(api, host.token, '/rooms', { title: '示例场', venue: '月台', songId: 'late-train', joinConsent: true, participation: 'open' });
  await post(api, guest.token, `/rooms/${room.code}/join`, { joinConsent: true, participation: 'open' });
  const { photo } = await post(api, host.token, `/rooms/${room.id}/photos`, { dataUrl: `data:image/jpeg;base64,${JPEG_FIXTURE}`, visibility: 'members' });
  const blob = await api.photoBlob(photo.id, { token: guest.token });
  assert.equal(blob.type, 'image/jpeg');
  assert.deepEqual(Buffer.from(await blob.arrayBuffer()).subarray(0, 2), Buffer.from([0xff, 0xd8]));
  assert.equal((await snapshotOf(storage)).bytes.length > 100000, true, 'the snapshot is in the store');
  assert.equal((await storage.keys('blobs')).length, 1, 'and the photo bytes in the blobs store');
  await runtime.close();

  runtime = await boot(storage);
  ({ api } = connect(runtime));
  assert.equal(runtime.fresh, false);
  const me = await api.request('/session', { namespace: 'avatar', token: guest.token });
  assert.equal(me.user.name, '小满');
  const view = await api.request(`/rooms/${room.id}`, { token: guest.token });
  assert.equal(view.members.length, 2);
  assert.equal(view.photos.length, 1);
  const again = await api.photoBlob(photo.id, { token: guest.token });
  assert.equal(again.size, blob.size, 'the photo survived the reload');
  await runtime.close();
});

sqlTest('runtime: read-only requests never write: 200 polling reads cost zero kv puts', async () => {
  const storage = gatedStore();
  const runtime = await boot(storage);
  const { api } = connect(runtime);
  const me = await newUser(api);
  const { room } = await post(api, me.token, '/rooms', { title: 't', venue: '', songId: 'late-train', joinConsent: true, participation: 'open' });
  await runtime.flush();
  const before = storage.puts;
  for (let i = 0; i < 50; i++) {
    await api.request(`/rooms/${room.id}`, { token: me.token });
    await api.request('/social', { token: me.token });
    await api.request('/chats', { token: me.token });
    await api.request('/exchanges', { token: me.token });
  }
  assert.equal(storage.puts - before, 0, '200 polls, no snapshot write');
  await sleep(30);
  assert.equal(storage.puts - before, 0, 'and none arrives late either');
  await runtime.close();
});

sqlTest('runtime: concurrent mutations share a coalesced writer loop; every response resolves after its change is stored', async () => {
  const storage = gatedStore();
  const runtime = await boot(storage);
  const { api } = connect(runtime);
  await runtime.flush();
  const before = storage.puts;
  storage.holdPuts();                                                    // the first writer round is stuck inside storage.put
  let resolved = 0;
  const all = Promise.all(Array.from({ length: 10 }, (_, index) => newUser(api, `u${index}`).then(user => { resolved += 1; return user; })));
  await until(() => storage.puts === before + 1, 'the first put to start');
  await until(async () => (await userCount(runtime)) === 10, 'all ten requests to finish their SQL');
  await sleep(10);
  assert.equal(resolved, 0, 'nobody is acknowledged while the stored copy lacks their change');
  assert.equal(storage.puts, before + 1, 'the other nine joined the running writer instead of starting their own');
  storage.release();
  assert.equal((await all).length, 10);
  const rounds = storage.puts - before;
  assert.ok(rounds === 1 || rounds === 2, `ten concurrent mutations took ${rounds} snapshot writes: the first round, plus one more only if some of them committed after it exported`);
  const reloaded = await boot(storage);
  assert.equal(await userCount(reloaded), 10, 'the stored snapshot holds all ten');
  await reloaded.close(); await runtime.close();
});

sqlTest('runtime: property test: every acknowledged mutation is already in the stored snapshot, whatever the put timing', async () => {
  const storage = gatedStore();
  let seed = 12345;
  storage.jitter = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed % 9); };      // 0-8 ms, deterministic
  const runtime = await boot(storage);
  const { api } = connect(runtime);
  await runtime.flush();
  const storedNames = () => {
    return storage.base.get('kv', DB_KEY).then(record => {
      const db = new SQL.Database(record.bytes);
      try { return new Set(db.exec('SELECT name FROM avatar_users')[0]?.values.map(row => row[0]) ?? []); } finally { db.close(); }
    });
  };
  const violations = [];
  const one = async index => {
    await sleep(index % 7);                                  // stagger the arrivals so rounds of the writer loop overlap in many ways
    const name = `p${index}`;
    await newUser(api, name);
    const stored = await storedNames();
    if (!stored.has(name)) violations.push(name);
    if (index % 5 === 0) await api.request('/health');       // reads in between
  };
  await Promise.all(Array.from({ length: 60 }, (_, index) => one(index)));
  assert.deepEqual(violations, [], 'a mutation was acknowledged before its snapshot was stored');
  assert.equal((await storedNames()).size, 60);
  assert.ok(storage.puts < 60, `coalesced: ${storage.puts} puts for 60 mutations`);
  await runtime.close();
});

sqlTest('runtime: batch(work) persists once at its end; a batch that changes nothing writes nothing; nested batches write at the outermost end', async () => {
  const storage = gatedStore();
  const runtime = await boot(storage);
  const { api } = connect(runtime);
  await runtime.flush();
  const before = storage.puts;
  const result = await runtime.batch(async () => {
    await newUser(api, 'a'); await newUser(api, 'b');
    assert.equal(storage.puts, before, 'nothing is stored while the batch runs');
    await runtime.batch(async () => { await newUser(api, 'c'); });
    assert.equal(storage.puts, before, 'nor when an inner batch ends');
    await sleep(10);
    assert.equal(storage.puts, before);
    return 'done';
  });
  assert.equal(result, 'done');
  assert.equal(storage.puts - before, 1, 'one write for the whole batch');
  assert.equal(await userCount(await boot(storage)), 3);
  const idle = storage.puts;
  await runtime.batch(async () => { await api.request('/health'); });
  assert.equal(storage.puts, idle, 'a batch that only read stored nothing');
  await runtime.close();
});

sqlTest('runtime: a failing batch stores nothing, now or later (the half-built world is never saved), and reports once', async () => {
  const storage = gatedStore();
  const failures = [];
  const runtime = await boot(storage, { onPersistError: error => failures.push(error) });
  const { api } = connect(runtime);
  await runtime.flush();
  const before = storage.puts;
  const boom = new Error('seed failed halfway');
  await assert.rejects(runtime.batch(async () => { await newUser(api, 'half'); throw boom; }), error => error === boom);
  assert.equal(storage.puts, before, 'nothing stored by the failed batch');
  assert.deepEqual(failures, [boom], 'persistence being off is reported once');
  assert.equal(runtime.persistent, false);
  await newUser(api, 'later');                                                    // the page keeps working in memory...
  assert.equal(await userCount(runtime), 2);
  assert.equal(storage.puts, before, '...and still stores nothing');
  assert.equal(failures.length, 1);
  const reloaded = await boot(storage);
  assert.equal(await userCount(reloaded), 0, 'the next boot starts from what was stored before: no half-built world');
  await reloaded.close(); await runtime.close();
});

sqlTest('runtime: a failing put calls onPersistError once per episode, keeps serving from memory, flips persistent, and recovers on the next mutation', async () => {
  const storage = gatedStore();
  const errors = [];
  const runtime = await boot(storage, { onPersistError: error => errors.push(error) });
  const { api } = connect(runtime);
  await runtime.flush();
  assert.equal(runtime.persistent, true);
  const quota = new DOMException('The quota has been exceeded.', 'QuotaExceededError');
  storage.failWith = quota;
  const a = await newUser(api, 'a'), b = await newUser(api, 'b'), c = await newUser(api, 'c');
  assert.deepEqual([a, b, c].map(user => typeof user.token), ['string', 'string', 'string'], 'every request was still served');
  assert.equal(errors.length, 1, 'once, not once per request');
  assert.equal(errors[0], quota);
  assert.equal(runtime.persistent, false);
  assert.equal(await userCount(runtime), 3, 'all three are in memory');
  storage.failWith = null;
  const d = await newUser(api, 'd');
  assert.equal(runtime.persistent, true, 'the next successful write restores it');
  const reloaded = await boot(storage);
  assert.equal(await userCount(reloaded), 4, 'and it stored everything made while storage was failing');
  assert.equal((await connect(reloaded).api.request('/session', { namespace: 'avatar', token: d.token })).user.name, 'd');
  storage.failWith = quota;
  await newUser(api, 'e');
  assert.equal(errors.length, 2, 'a new failure episode is reported again');
  await reloaded.close(); await runtime.close();
});

sqlTest('runtime: a put that never answers (hung IndexedDB) fails after persistTimeoutMs instead of freezing every mutation, and recovers once it settles', async () => {
  const storage = gatedStore();
  const errors = [];
  const runtime = await boot(storage, { persistTimeoutMs: 60, onPersistError: error => errors.push(error) });
  const { api } = connect(runtime);
  await runtime.flush();
  const before = storage.puts;
  storage.holdPuts();                                                      // the next put hangs until released
  const started = performance.now();
  const first = await newUser(api, 'first');
  const waited = performance.now() - started;
  assert.ok(waited >= 50 && waited < 3000, `the mutation was acknowledged after the timeout (${waited.toFixed(0)} ms), not never`);
  assert.equal(typeof first.token, 'string', 'and served');
  assert.equal(errors.length, 1);
  assert.ok(errors[0] instanceof StaticRuntimeError && errors[0].code === 'PERSIST_TIMEOUT');
  assert.equal(runtime.persistent, false);
  assert.equal(storage.puts, before + 1);
  await newUser(api, 'second'); await newUser(api, 'third');              // answered at once: no second put queued behind the stuck one
  assert.equal(storage.puts, before + 1, 'nothing new was issued while a put is stuck');
  assert.equal(errors.length, 1, 'one report per episode');
  assert.equal(await userCount(runtime), 3, 'everything is served from memory');
  storage.release();                                                       // the stuck put finally completes (with the old snapshot)
  await sleep(20);
  const fourth = await newUser(api, 'fourth');
  assert.equal(storage.puts, before + 2, 'the first mutation after it settled stores again');
  assert.equal(runtime.persistent, true);
  const reloaded = await boot(storage);
  assert.equal(await userCount(reloaded), 4, 'and that snapshot holds everything');
  assert.equal((await connect(reloaded).api.request('/session', { namespace: 'avatar', token: fourth.token })).user.name, 'fourth');
  await reloaded.close(); await runtime.close();
});

sqlTest('runtime: reset() on a store whose clear() hangs rejects PERSIST_TIMEOUT but still leaves the runtime closed', async () => {
  const storage = gatedStore();
  storage.clearHangs = true;
  const runtime = await boot(storage, { persistTimeoutMs: 50 });
  await assert.rejects(runtime.reset(), { code: 'PERSIST_TIMEOUT' });
  await assert.rejects(runtime.handle({ url: '/api/event/health', method: 'GET', headers: new Headers() }), { code: 'RUNTIME_CLOSED' });
  await runtime.flush();
  assert.equal(storage.puts, 0, 'nothing is ever written after a reset, failed or not');
});

sqlTest('runtime: persistTimeoutMs 0 or Infinity switches the bound off', async () => {
  for (const persistTimeoutMs of [0, Infinity]) {
    const storage = gatedStore();
    const runtime = await boot(storage, { persistTimeoutMs });
    const { api } = connect(runtime);
    await runtime.flush();
    storage.holdPuts();
    let acknowledged = false;
    const pending = newUser(api, 'patient').then(() => { acknowledged = true; });
    await sleep(150);
    assert.equal(acknowledged, false, `still waiting with persistTimeoutMs ${persistTimeoutMs}`);
    storage.release();
    await pending;
    await runtime.close();
  }
});

sqlTest('runtime: an onPersistError listener that throws does not break serving', async () => {
  const storage = gatedStore();
  storage.failWith = new Error('disk full');
  const runtime = await boot(storage, { onPersistError() { throw new Error('listener bug'); } });
  const { api } = connect(runtime);
  assert.equal(typeof (await newUser(api)).token, 'string');
  assert.equal(runtime.persistent, false);
  await runtime.close();
});

sqlTest('runtime: persist:false never writes (ephemeral runtime), onPersistError stays silent', async () => {
  const storage = gatedStore();
  const errors = [];
  const runtime = await boot(storage, { persist: false, onPersistError: error => errors.push(error) });
  const { api } = connect(runtime);
  await newUser(api);
  await runtime.flush();
  assert.equal(storage.puts, 0);
  assert.deepEqual(errors, []);
  await runtime.close();
});

sqlTest('runtime: maintenance(fn) hands over the raw sql.js database, stores a change once, ignores a no-op, and is writable-only', async () => {
  const storage = gatedStore();
  const runtime = await boot(storage);
  await runtime.flush();
  const before = storage.puts;
  const seen = await runtime.maintenance(db => { assert.equal(typeof db.exec, 'function'); assert.equal(typeof db.run, 'function'); return db.exec('SELECT COUNT(*) FROM _static_migrations')[0].values[0][0]; });
  assert.equal(seen, migrations.length, 'returns what the callback returns');
  await runtime.maintenance(db => { db.run('CREATE TABLE IF NOT EXISTS _static_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)'); });
  const created = storage.puts - before;
  assert.equal(created, 1, 'a new table is a change');
  await runtime.maintenance(db => { db.run('CREATE TABLE IF NOT EXISTS _static_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)'); db.exec('SELECT * FROM _static_meta'); });
  assert.equal(storage.puts - before, created, 'the same call again changes nothing and stores nothing');
  await runtime.maintenance(async db => { await sleep(1); db.run('INSERT OR REPLACE INTO _static_meta VALUES (?, ?)', ['showcase', '{"v":1}']); });
  assert.equal(storage.puts - before, created + 1, 'an async callback that wrote is stored');
  await runtime.maintenance(db => db.run('UPDATE _static_meta SET value = value WHERE key = ?', ['nobody']));
  assert.equal(storage.puts - before, created + 1, 'an UPDATE that matched nothing is not a change');
  await runtime.batch(async () => { await runtime.maintenance(db => db.run('INSERT OR REPLACE INTO _static_meta VALUES (?, ?)', ['k', 'v'])); assert.equal(storage.puts - before, created + 1, 'inside a batch the write waits'); });
  assert.equal(storage.puts - before, created + 2);
  await assert.rejects(runtime.maintenance(() => { throw new Error('callback failed'); }), /callback failed/);
  const reloaded = await boot(storage);
  assert.deepEqual((await reloaded.env.DB.prepare('SELECT key, value FROM _static_meta ORDER BY key').all()).results, [{ key: 'k', value: 'v' }, { key: 'showcase', value: '{"v":1}' }]);
  await reloaded.close(); await runtime.close();
});

// ---- runtime: read-only copy ------------------------------------------------------------------------------------------------------

sqlTest('runtime: setWritable(false) answers every non-GET/HEAD request 409 READ_ONLY_COPY, touches nothing, persists nothing; reads still work', async () => {
  const storage = gatedStore();
  const runtime = await boot(storage);
  const { api, transport } = connect(runtime);
  const me = await newUser(api, 'owner');
  await runtime.flush();
  const putsBefore = storage.puts, usersBefore = await userCount(runtime);
  runtime.setWritable(false);
  assert.equal(runtime.writable, false);

  const mutation = await transport('/api/avatar/session', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': uuid() }, body: JSON.stringify({ name: 'intruder', avatar: AVATAR }) });
  assert.equal(mutation.status, 409);
  assert.match(mutation.headers.get('Content-Type'), /^application\/json/);
  assert.deepEqual(await mutation.json(), { error: { code: 'READ_ONLY_COPY', message: '已在另一个标签页打开，请回到那里操作。' } });
  assert.equal(READ_ONLY_MESSAGE, '已在另一个标签页打开，请回到那里操作。');
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    for (const path of ['/api/event/rooms', '/api/avatar/session', '/api/event/photos/00000000-0000-4000-8000-000000000000']) {
      const response = await transport(path, { method, headers: { Authorization: `Bearer ${me.token}`, 'Idempotency-Key': uuid(), 'Content-Type': 'application/json' }, body: '{}' });
      assert.equal(response.status, 409, `${method} ${path}`);
      assert.equal((await response.json()).error.code, 'READ_ONLY_COPY');
    }
  }
  const apiError = await newUser(api, 'through the client').catch(error => error);
  assert.equal(apiError.code, 'READ_ONLY_COPY');
  assert.equal(apiError.status, 409);
  assert.equal(apiError.uncertain, false, 'a 409 is a clear refusal, not an uncertain outcome');
  assert.equal(apiError.message, READ_ONLY_MESSAGE);

  assert.equal(await userCount(runtime), usersBefore, 'the database was not touched (no user, no idempotency row)');
  assert.equal((await runtime.env.DB.prepare('SELECT COUNT(*) AS n FROM avatar_idempotency').first()).n, 1, 'only the owner\'s own session key exists');
  assert.equal((await api.request('/health')).ok, true, 'GET still works');
  assert.equal((await api.request('/session', { namespace: 'avatar', token: me.token })).user.name, 'owner', 'reads of existing state work');
  await runtime.flush();
  assert.equal(storage.puts, putsBefore, 'nothing was persisted');
  await assert.rejects(runtime.maintenance(() => {}), error => error.code === 'READ_ONLY_COPY' && error instanceof StaticRuntimeError);
  assert.equal((await transport('/api/event/rooms', { method: 'POST', headers: {}, body: '{}' })).status, 409);
  await runtime.batch(async () => { assert.equal((await transport('/api/event/rooms', { method: 'POST', headers: {}, body: '{}' })).status, 409); });
  assert.equal(storage.puts, putsBefore, 'not even through batch');

  runtime.setWritable(true);
  assert.equal(runtime.writable, true);
  await newUser(api, 'allowed again');
  assert.equal(storage.puts, putsBefore + 1, 'a writable runtime persists again');
  await runtime.close();
});

sqlTest('runtime: a read-only runtime never flushes even if the database is dirty (a late pagehide flush cannot overwrite the other tab)', async () => {
  const storage = gatedStore();
  const runtime = await boot(storage, { writable: false });                       // starts read-only: the fresh database's migrations are dirty
  assert.equal(runtime.writable, false);
  await runtime.flush();
  assert.equal(storage.puts, 0);
  assert.equal(await storage.base.get('kv', DB_KEY), undefined, 'the other tab\'s snapshot (or none) stays as it is');
  await runtime.close();
});

// ---- runtime: reset and close -----------------------------------------------------------------------------------------------------

sqlTest('runtime: reset() clears storage (both stores) and afterwards handle() rejects', async () => {
  const storage = gatedStore();
  const runtime = await boot(storage);
  const { api, transport } = connect(runtime);
  const me = await newUser(api);
  const { room } = await post(api, me.token, '/rooms', { title: 't', venue: '', songId: 'late-train', joinConsent: true, participation: 'open' });
  await post(api, me.token, `/rooms/${room.id}/photos`, { dataUrl: `data:image/jpeg;base64,${JPEG_FIXTURE}`, visibility: 'private' });
  assert.equal((await storage.keys('blobs')).length, 1);
  assert.ok(await storage.get('kv', DB_KEY));
  await runtime.reset();
  assert.equal(storage.clears, 1);
  assert.equal(await storage.get('kv', DB_KEY), undefined);
  assert.deepEqual(await storage.keys('blobs'), []);
  await assert.rejects(runtime.handle({ url: '/api/event/health', method: 'GET', headers: new Headers() }), error => error instanceof StaticRuntimeError && error.code === 'RUNTIME_CLOSED');
  await assert.rejects(transport('/api/event/health'), { code: 'RUNTIME_CLOSED' });
  await assert.rejects(runtime.batch(async () => {}), { code: 'RUNTIME_CLOSED' });
  await assert.rejects(runtime.maintenance(() => {}), { code: 'RUNTIME_CLOSED' });
  await runtime.flush();
  await runtime.close();
  assert.equal(storage.puts, 3, 'no write after the reset (session, room and photo were the only stores)');
  assert.equal(await storage.get('kv', DB_KEY), undefined);
  const fresh = await boot(storage);
  assert.equal(fresh.fresh, true, 'a boot after the reset starts from nothing');
  await fresh.close();
});

sqlTest('runtime: a flush started before reset() cannot write after it, even on a store that applies puts late; a later flush (pagehide) is a no-op', async () => {
  const storage = gatedStore();
  const runtime = await boot(storage);
  const { api } = connect(runtime);
  storage.holdPuts();
  storage.applyDelayMs = 60;                                  // once released, the put lands 60 ms later; clear() is immediate: the worst ordering
  const mutation = newUser(api, 'in flight').catch(error => error);
  await until(() => storage.puts === 1, 'the snapshot put to be issued');
  const resetting = runtime.reset();                          // sets the closed flag, then must wait for that put before clearing
  let cleared = false;
  resetting.then(() => { cleared = true; });
  await sleep(30);
  assert.equal(storage.clears, 0, 'storage was not cleared underneath a put that is still in flight');
  assert.equal(cleared, false);
  storage.release();
  await resetting;
  await mutation;                                             // whatever happens to the in-flight request, it must not matter
  await sleep(150);
  assert.equal(storage.clears, 1);
  assert.equal(await storage.get('kv', DB_KEY), undefined, 'the old database was not written back after the reset');
  assert.deepEqual(await storage.keys('blobs'), []);
  const putsAfterReset = storage.puts;
  await runtime.flush();                                      // the pagehide handler
  await runtime.flush();
  assert.equal(storage.puts, putsAfterReset, 'a late flush is a no-op');
  assert.equal(await storage.get('kv', DB_KEY), undefined);
});

sqlTest('runtime: a change made while a put is in flight is not written after reset() either (the writer loop stops)', async () => {
  const storage = gatedStore();
  const runtime = await boot(storage);
  const { api } = connect(runtime);
  storage.holdPuts();
  const first = newUser(api, 'first').catch(error => error);
  await until(() => storage.puts === 1, 'the first put to be issued');
  const second = newUser(api, 'second').catch(error => error);          // dirties the database again while the first put is held
  await until(async () => (await userCount(runtime)) === 2, 'the second request to finish its SQL');
  const resetting = runtime.reset();
  storage.release();
  await resetting; await first; await second;
  await sleep(50);
  assert.equal(storage.puts, 1, 'the loop did not start another round after the reset');
  assert.equal(await storage.get('kv', DB_KEY), undefined);
});

sqlTest('runtime: the closed flag is set before anything is awaited: a request arriving during reset() is refused, never half-served', async () => {
  const storage = gatedStore();
  storage.holdPuts();
  const runtime = await boot(storage);
  const { api } = connect(runtime);
  const first = newUser(api, 'one').catch(error => error);
  await until(() => storage.puts === 1, 'the snapshot put to be issued');
  const resetting = runtime.reset();
  const late = await newUser(api, 'too late').catch(error => error);
  assert.ok(late instanceof Error, 'refused');
  assert.equal(late.code, 'NETWORK', 'the client sees an unreachable service (RUNTIME_CLOSED underneath)');
  storage.release();
  await resetting; await first;
  assert.equal(await storage.get('kv', DB_KEY), undefined);
});

sqlTest('runtime: close() stops serving and writing, waits for a put already in flight, and is idempotent', async () => {
  const storage = gatedStore();
  const runtime = await boot(storage);
  const { api } = connect(runtime);
  await runtime.flush();
  const before = storage.puts;
  storage.holdPuts();
  const mutation = newUser(api, 'x').catch(error => error);
  await until(() => storage.puts === before + 1, 'the snapshot put to be issued');
  let closed = false;
  const closing = runtime.close().then(() => { closed = true; });
  await sleep(30);
  assert.equal(closed, false, 'close() waits for the put in flight');
  storage.release();
  await closing; await mutation;
  await runtime.close();
  await assert.rejects(runtime.handle({ url: '/api/event/health', method: 'GET', headers: new Headers() }), { code: 'RUNTIME_CLOSED' });
  const puts = storage.puts;
  await runtime.flush();
  assert.equal(storage.puts, puts);
  assert.ok(await storage.get('kv', DB_KEY), 'close() does not wipe anything');
  assert.equal((await boot(storage).then(async other => { const n = await userCount(other); await other.close(); return n; })), 1, 'the put that was in flight landed');
});

// ---- no DOM at import time --------------------------------------------------------------------------------------------------------

test('no static-runtime module touches DOM or browser globals at import time and none uses top-level await', () => {
  const modules = ['d1-sqljs.js', 'idb-store.js', 'r2-idb.js', 'runtime.js', 'clock.js', 'transport.js', 'shims/node-crypto.js', 'shims/node-buffer.js'].map(file => new URL(`../web/static-runtime/${file}`, import.meta.url));
  const script = `
    const touched = [];
    for (const name of ['window', 'document', 'self', 'location', 'navigator', 'indexedDB', 'localStorage', 'sessionStorage', 'HTMLElement', 'customElements', 'requestAnimationFrame', 'Worker', 'matchMedia', 'devicePixelRatio']) {
      Object.defineProperty(globalThis, name, { configurable: true, get() { touched.push(name); return undefined; } });
    }
    for (const url of ${JSON.stringify(modules.map(String))}) await import(url);
    console.log(JSON.stringify(touched));
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout.trim().split('\n').at(-1)), [], 'no browser global was read while importing');
  for (const url of modules) {
    const source = readFileSync(fileURLToPath(url), 'utf8');
    assert.doesNotMatch(source, /^(?:await\b|for\s+await\b|(?:const|let|var)\s+[\w{}\[\],\s]+=\s*await\b)/m, `${url.pathname}: top-level await`);
    assert.doesNotMatch(source, /import\.meta\.glob/, `${url.pathname}: import.meta.glob is not importable in Node`);
  }
});
