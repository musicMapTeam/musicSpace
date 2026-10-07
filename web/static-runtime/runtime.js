import { createEventWorker, EVENT_API_PREFIX } from '../../runtime-preview/src/event-worker.js';
import { createAvatarWorker, AVATAR_API_PREFIX } from '../../runtime-preview/src/avatar-worker.js';
import { createHash } from 'node:crypto';
import { createD1 } from './d1-sqljs.js';
import { createPhotos } from './r2-idb.js';

/**
 * The room backend, in this page: event-worker.js and avatar-worker.js, unchanged, on a D1 shim over sql.js (the database lives in
 * memory as one snapshot, saved to `storage` kv/'db') and an R2 shim over the 'blobs' store.
 *
 * Strict and never self-healing: a snapshot or migration problem throws a StaticRuntimeError and the boot policy (T10) decides to wipe.
 *   MIGRATION_CHANGED    an applied migration's sha256 differs from the ledger table _static_migrations(name, sha256)
 *   SNAPSHOT_CORRUPT     the saved snapshot is not a database (bad record, new SQL.Database(bytes) or its first query fails)
 *   MIGRATION_FAILED     a NEW migration failed (it was rolled back; the saved snapshot is untouched)
 *   STORAGE_UNAVAILABLE  storage.get('kv', 'db') itself failed
 * and, later, RUNTIME_CLOSED from handle()/batch()/maintenance() after close() or reset(), READ_ONLY_COPY from maintenance() when not writable.
 *
 * `migrations` = [{ name, sql }] in order (runtime-preview/drizzle/*.sql). Applied once, recorded with their hash, so a later build only
 * runs the new ones (each inside BEGIN/COMMIT) and a changed old one is refused (same rule as the Node store).
 *
 * Persistence: a mutating request is stored (export + one storage.put, through one coalesced writer loop) BEFORE its response
 * resolves, so a reload never loses an acknowledged action. Read-only requests never write. A failed put calls onPersistError once per
 * failure episode, keeps serving from memory and flips `persistent` to false; the next mutation tries again. A put that does not
 * answer within persistTimeoutMs (a hung IndexedDB transaction) counts as failed (PERSIST_TIMEOUT) instead of freezing every mutation;
 * no second put is issued behind a stuck one, and the first mutation after it finally settles stores again.
 *
 * Read-only copy: setWritable(false) answers every non-GET/HEAD request with 409 READ_ONLY_COPY without touching the database; nothing is
 * persisted, so a second tab can never write an older copy over the first tab's data. Making a stale copy writable again is the
 * caller's responsibility (boot reloads the page instead).
 */
export const DB_KEY = 'db';
export const META_KEY = 'meta';
export const SNAPSHOT_FORMAT = 1;
export const DEFAULT_PERSIST_TIMEOUT_MS = 10_000;
export const READ_ONLY_CODE = 'READ_ONLY_COPY';
export const READ_ONLY_MESSAGE = '已在另一个标签页打开，请回到那里操作。';

export class StaticRuntimeError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'StaticRuntimeError';
    this.code = code;
    Object.assign(this, details);
  }
}

const PSEUDO_ORIGIN = 'http://in-browser.invalid';
const encoder = new TextEncoder();
const sha = text => createHash('sha256').update(text).digest('hex');
const onPath = (pathname, prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`);

/** The `body` the workers read: only getReader() with read / cancel / releaseLock (they never touch a Request). */
function bytesBody(bytes) {
  if (!bytes?.length) return null;
  return { getReader() {
    let done = false;
    return { read: async () => (done ? { done: true, value: undefined } : (done = true, { done: false, value: bytes })), cancel: async () => { done = true; }, releaseLock() {} };
  } };
}
function requestBody({ body, bodyText }) {
  if (body && typeof body.getReader === 'function') return body;
  if (typeof bodyText === 'string') return bytesBody(encoder.encode(bodyText));
  if (typeof body === 'string') return bytesBody(encoder.encode(body));
  if (ArrayBuffer.isView(body)) return bytesBody(new Uint8Array(body.buffer, body.byteOffset, body.byteLength));
  return null;
}

/** A saved record is { bytes: Uint8Array, savedAt, format: 1 }. Anything else is not a snapshot this build wrote. */
function snapshotBytes(saved) {
  const bytes = saved && typeof saved === 'object' ? saved.bytes : null;
  if (!ArrayBuffer.isView(bytes) || !bytes.byteLength || (saved.format !== undefined && saved.format !== SNAPSHOT_FORMAT)) {
    throw new StaticRuntimeError('SNAPSHOT_CORRUPT', 'The saved snapshot is not a database this build can read.');
  }
  return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/**
 * createStaticRuntime({ SQL, migrations, storage, clock, rateLimits, persist, writable, persistTimeoutMs, onPersistError })
 *   SQL                 the initialised sql.js module (Node: require('sql.js')(), browser: initSqlJs())
 *   storage             an idb-store surface (openIdbStore() or createMemoryStore()); storage.persistent says whether it survives a reload
 *   clock               () => ms, given to both workers and used for snapshot timestamps (createClock({ buildAtMs }) in the browser)
 *   rateLimits=false    the workers' own rate limiting; off in the browser (one human)
 *   persist=true        false = never write (read-only copies and tests)
 *   writable=true       false = start as a read-only copy (same as setWritable(false) right after creation)
 *   persistTimeoutMs    how long a snapshot put (or the reset's clear) may take before it counts as failed (default 10 s)
 *   onPersistError(e)   called once per failure episode (failed or timed-out put, or a failed batch)
 * -> { fresh, env, handle, flush, batch, maintenance, reset, close, setWritable, writable, persistent }
 */
export async function createStaticRuntime({ SQL, migrations, storage, clock = Date.now, rateLimits = false, persist = true, writable = true, persistTimeoutMs = DEFAULT_PERSIST_TIMEOUT_MS, onPersistError = () => {} } = {}) {
  if (!SQL || typeof SQL.Database !== 'function') throw new TypeError('createStaticRuntime needs the initialised sql.js module as { SQL }.');
  if (!Array.isArray(migrations)) throw new TypeError('createStaticRuntime needs migrations: [{ name, sql }].');
  if (!storage || typeof storage.get !== 'function' || typeof storage.put !== 'function') throw new TypeError('createStaticRuntime needs a storage with get/put/clear.');

  let saved;
  try { saved = await storage.get('kv', DB_KEY); }
  catch (cause) { throw new StaticRuntimeError('STORAGE_UNAVAILABLE', 'The saved snapshot could not be read.', { cause }); }
  const bytes = saved === undefined || saved === null ? null : snapshotBytes(saved);
  const fresh = !bytes;

  let dirty = false, writer = null, persistFailed = false, held = 0, closed = false, canWrite = Boolean(writable), poisoned = null, stuck = false;
  const d1 = (() => {
    try { return createD1({ SQL, bytes, onWrite: () => { dirty = true; } }); }
    catch (cause) {
      if (bytes) throw new StaticRuntimeError('SNAPSHOT_CORRUPT', 'The saved snapshot could not be opened.', { cause });
      throw cause;
    }
  })();
  const raw = d1.sql();
  const bail = error => { try { d1.close(); } catch { /* nothing to close */ } throw error; };

  // The first real query is where a damaged snapshot shows ("file is not a database"); PRAGMA foreign_keys does not read the file.
  let applied;
  try {
    raw.run('CREATE TABLE IF NOT EXISTS _static_migrations (name TEXT PRIMARY KEY, sha256 TEXT NOT NULL)');
    applied = new Map(raw.exec('SELECT name, sha256 FROM _static_migrations')[0]?.values ?? []);
  } catch (cause) { bail(bytes ? new StaticRuntimeError('SNAPSHOT_CORRUPT', 'The saved snapshot is not a readable database.', { cause }) : cause); }

  const digests = migrations.map(migration => ({ ...migration, digest: sha(migration.sql) }));
  for (const migration of digests) {                      // refuse a changed old migration before any new one runs
    const previous = applied.get(migration.name);
    if (previous !== undefined && previous !== migration.digest) {
      bail(new StaticRuntimeError('MIGRATION_CHANGED', `Migration ${migration.name} changed after it was applied.`, { migration: migration.name }));
    }
  }
  for (const migration of digests) {
    if (applied.has(migration.name)) continue;
    raw.run('BEGIN');
    try {
      raw.exec(migration.sql);
      raw.run('INSERT INTO _static_migrations (name, sha256) VALUES (?, ?)', [migration.name, migration.digest]);
      raw.run('COMMIT');
    } catch (cause) {
      try { raw.run('ROLLBACK'); } catch { /* already rolled back */ }
      bail(new StaticRuntimeError('MIGRATION_FAILED', `Migration ${migration.name} could not be applied.`, { migration: migration.name, cause }));
    }
    dirty = true;
  }

  const env = { DB: d1.DB, PHOTOS: createPhotos(storage), ASSETS: { async fetch() { return new Response('Not found', { status: 404 }); } }, EVENT_CLIENT_IP: 'in-browser' };
  const event = createEventWorker({ clock, rateLimits }), avatar = createAvatarWorker({ clock, rateLimits });

  const assertOpen = () => { if (closed) throw new StaticRuntimeError('RUNTIME_CLOSED', 'This runtime was closed or reset. Reload the page.'); };
  const persistable = () => persist && canWrite && !closed && !poisoned;
  const reportPersistError = error => { try { onPersistError(error); } catch { /* a failing listener must not break serving */ } };

  /** Races a storage call against persistTimeoutMs. The call is not cancelled: it may still land later. */
  const bounded = (promise, what) => (!(persistTimeoutMs > 0) || persistTimeoutMs === Infinity ? promise : new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new StaticRuntimeError('PERSIST_TIMEOUT', `${what} did not finish within ${persistTimeoutMs} ms.`)), persistTimeoutMs);
    promise.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  }));
  async function putSnapshot() {
    const attempt = Promise.resolve(storage.put('kv', DB_KEY, { bytes: d1.exportBytes(), savedAt: clock(), format: SNAPSHOT_FORMAT }));
    let settled = false;
    attempt.then(() => { settled = true; stuck = false; }, () => { settled = true; stuck = false; });
    try { await bounded(attempt, 'Saving the snapshot'); }
    catch (error) { if (!settled && error.code === 'PERSIST_TIMEOUT') stuck = true; throw error; }
  }
  /** Writes snapshots until nothing is dirty. Resolves true when everything is stored, false when a put failed (dirty stays set). */
  async function writeLoop() {
    while (dirty && persistable() && !stuck) {
      dirty = false;
      try {
        await putSnapshot();
        persistFailed = false;
      } catch (error) {
        dirty = true;
        if (!persistFailed) { persistFailed = true; reportPersistError(error); }
        return false;
      }
    }
    return true;
  }
  /**
   * Resolves when every change made before the call is stored (or a put failed, or persistence is off). One writer at a time: a request
   * that arrives while it runs marks the database dirty again and is covered by the same loop's next round. Never rejects.
   */
  async function flush() {
    while (writer) { if (!await writer) return; }       // a failed round was already reported; do not retry once per waiter
    if (!dirty || !persistable() || stuck) return;
    const round = writeLoop();
    writer = round;
    try { await round; } finally { if (writer === round) writer = null; }
  }

  const readOnlyResponse = () => new Response(JSON.stringify({ error: { code: READ_ONLY_CODE, message: READ_ONLY_MESSAGE } }), {
    status: 409, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

  /**
   * `request` = { url, method, headers, body } with body = null | { getReader() } (what transport.js builds); { bodyText } and string /
   * Uint8Array bodies are accepted too. Returns a Response, or null when the path is not /api/event or /api/avatar.
   */
  async function handle(request) {
    assertOpen();
    const method = String(request?.method ?? 'GET').toUpperCase();
    const url = new URL(String(request?.url ?? ''), PSEUDO_ORIGIN);
    const isEvent = onPath(url.pathname, EVENT_API_PREFIX), isAvatar = onPath(url.pathname, AVATAR_API_PREFIX);
    if (!isEvent && !isAvatar) return null;
    const mutating = method !== 'GET' && method !== 'HEAD';
    if (mutating && !canWrite) return readOnlyResponse();
    const like = { url: url.href, method, headers: request.headers instanceof Headers ? request.headers : new Headers(request.headers ?? undefined), body: requestBody(request) };
    const pending = [];
    try {
      const response = isEvent ? await event.fetch(like, env) : await avatar.fetch(like, env, { waitUntil: promise => pending.push(promise) });
      await Promise.allSettled(pending);
      return response;
    } finally {
      if (!held) { if (mutating) await flush(); else if (dirty) void flush(); }
    }
  }

  const marks = () => `${raw.exec('SELECT total_changes()')[0].values[0][0]}:${raw.exec('PRAGMA schema_version')[0].values[0][0]}`;

  return {
    fresh, env, handle, flush,
    get persistent() { return Boolean(storage.persistent) && persist && !persistFailed && !poisoned; },
    get writable() { return canWrite; },
    setWritable(value) { canWrite = Boolean(value); },
    /**
     * Run `work` as one persistence unit (showcase seeding): nothing is written until it ends, so a tab closed halfway leaves no
     * half-built world. If `work` throws, nothing is persisted by this runtime from then on (the in-memory half-built state is
     * never saved); the boot policy resets and rebuilds, or carries on unsaved.
     */
    async batch(work) {
      assertOpen();
      held += 1;
      let result;
      try { result = await work(); }
      catch (error) {
        held -= 1;
        if (!poisoned) { poisoned = error; reportPersistError(error); }
        throw error;
      }
      held -= 1;
      if (!held) await flush();
      return result;
    },
    /**
     * Raw sql.js access outside the worker API (marker table, long expiry). Writable only; stored when it changed something (new rows
     * or a schema change, detected through total_changes() and schema_version). Keep any BEGIN...COMMIT inside the callback
     * synchronous: serialising the database closes and reopens the connection, which would drop a transaction left open across an await.
     */
    async maintenance(callback) {
      assertOpen();
      if (!canWrite) throw new StaticRuntimeError(READ_ONLY_CODE, READ_ONLY_MESSAGE);
      const before = marks();
      let result;
      try { result = await callback(raw); }
      finally { if (!closed && marks() !== before) dirty = true; }
      if (!held) await flush();
      return result;
    },
    /**
     * Forget everything: the closed flag goes first, so no later flush (pagehide included) can write this database back. The runtime is
     * dead afterwards either way; reset() rejects when storage could not be cleared (its own error, or PERSIST_TIMEOUT for a hung store).
     */
    async reset() {
      closed = true;
      while (writer) await writer;                       // a put already in flight lands before the clear, whatever the store's ordering
      try { await bounded(storage.clear(), 'Clearing storage'); } finally { d1.close(); }
    },
    async close() {
      closed = true;
      while (writer) await writer;
      d1.close();
    },
  };
}
