/**
 * Minimal promise wrapper over IndexedDB, plus a Map-backed twin with the same surface for tests and for browsers where IndexedDB is
 * unavailable or hung (the runtime then keeps working for the page's lifetime and says its data will not survive a reload).
 *
 * Surface (both stores): get(store, key) -> value | undefined, put(store, key, value), delete(store, key), keys(store), clear(),
 * close(), persistent, name. Two object stores exist: 'kv' (the database snapshot and bookkeeping) and 'blobs' (photo bytes).
 *
 * openIdbStore never hangs: it rejects with an IdbStoreError whose code is IDB_TIMEOUT (no answer within timeoutMs, 3 s by default,
 * which is what a stuck Safari or a blocked upgrade looks like) or IDB_UNAVAILABLE (no IndexedDB, open threw or failed, private mode,
 * storage blocked). Callers fall back to createMemoryStore(). A connection that opens after its timeout is closed again.
 *
 * Safari (and Chrome after "clear site data") can close a connection under a live page: db.transaction() then throws
 * InvalidStateError ("The database connection is closing"); iOS Safari can lose its database server ("Connection to Indexed Database
 * server lost", UnknownError). The store reopens ONCE and retries the operation once, transparently; concurrent operations share that
 * one reopen. A second failure is the caller's.
 *
 * Nothing here touches a browser global at import time: indexedDB is looked up when a store is opened (or injected for tests).
 */
export const STORES = Object.freeze(['kv', 'blobs']);
export const DEFAULT_STORE_NAME = 'music-space-static:v1';
export const IDB_OPEN_TIMEOUT_MS = 3000;

export class IdbStoreError extends Error {
  constructor(code, message, cause) {
    super(message);
    this.name = 'IdbStoreError';
    this.code = code;
    if (cause !== undefined) this.cause = cause;
  }
}

const unavailable = (message, cause) => new IdbStoreError('IDB_UNAVAILABLE', message, cause);
const timeout = (what, ms) => new IdbStoreError('IDB_TIMEOUT', `IndexedDB did not ${what} within ${ms} ms.`);
// A connection the browser took away: Safari's "The database connection is closing" (InvalidStateError) and iOS Safari's
// "Connection to Indexed Database server lost. Refresh the page to try again" (UnknownError). Both are cured by reopening.
const isConnectionLost = error => error?.name === 'InvalidStateError' || error?.name === 'UnknownError';
const checkStore = store => { if (!STORES.includes(store)) throw new TypeError(`Unknown store "${store}" (expected one of ${STORES.join(', ')}).`); };

/** Resolves with an IDBDatabase, or rejects with IDB_TIMEOUT / IDB_UNAVAILABLE. Closes a connection that arrives after the timeout. */
function openDatabase(factory, name, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false, timer = null;
    const settle = (action, value) => {
      if (settled) return false;
      settled = true; clearTimeout(timer); action(value); return true;
    };
    let request;
    try { request = factory.open(name, 1); } catch (error) { reject(unavailable('IndexedDB could not be opened.', error)); return; }
    timer = setTimeout(() => settle(reject, timeout('open', timeoutMs)), timeoutMs);
    request.onupgradeneeded = () => {
      const database = request.result;
      for (const store of STORES) if (!database.objectStoreNames.contains(store)) database.createObjectStore(store);
    };
    request.onerror = event => { event?.preventDefault?.(); settle(reject, unavailable('IndexedDB could not be opened.', request.error ?? undefined)); };
    // 'blocked' only means another connection delays an upgrade; it can still open, so the timeout decides.
    request.onblocked = () => {};
    request.onsuccess = () => {
      const database = request.result;
      if (!settle(resolve, database)) { try { database.close(); } catch { /* nothing left to close */ } }
    };
  });
}

export async function openIdbStore(name = DEFAULT_STORE_NAME, { timeoutMs = IDB_OPEN_TIMEOUT_MS, indexedDB: factory } = {}) {
  const idb = factory ?? globalThis.indexedDB;
  if (!idb || typeof idb.open !== 'function') throw unavailable('IndexedDB is unavailable in this browser.');
  let current = null, opening = null, closed = false;

  const watch = database => {
    database.onversionchange = () => { if (current === database) current = null; try { database.close(); } catch { /* already closed */ } };
    database.onclose = () => { if (current === database) current = null; };
    return database;
  };
  function connect() {
    if (closed) return Promise.reject(new IdbStoreError('IDB_CLOSED', 'The store was closed.'));
    if (current) return Promise.resolve(current);
    return opening ??= openDatabase(idb, name, timeoutMs).then(database => {
      if (closed) { try { database.close(); } catch { /* already closed */ } throw new IdbStoreError('IDB_CLOSED', 'The store was closed.'); }
      return current = watch(database);
    }).finally(() => { opening = null; });
  }
  current = watch(await openDatabase(idb, name, timeoutMs));

  /** One transaction over `stores`; resolves with the result of the request `work(tx)` returns, after the transaction completed. */
  const attempt = (database, stores, mode, work) => new Promise((resolve, reject) => {
    let tx;
    try { tx = database.transaction(stores, mode); } catch (error) { reject(error); return; }
    let result;
    tx.oncomplete = () => resolve(result);
    // A failed request reaches here first, while tx.error is still null: its own error is on the event's target.
    tx.onerror = event => reject(event?.target?.error ?? tx.error ?? new IdbStoreError('IDB_TX_FAILED', 'IndexedDB transaction failed.'));
    tx.onabort = () => reject(tx.error ?? new IdbStoreError('IDB_TX_ABORTED', 'IndexedDB transaction aborted.'));
    let request;
    try { request = work(tx); } catch (error) { try { tx.abort(); } catch { /* already finished */ } reject(error); return; }
    if (request) request.onsuccess = () => { result = request.result; };
  });
  async function run(stores, mode, work) {
    const database = await connect();
    try { return await attempt(database, stores, mode, work); } catch (error) {
      if (!isConnectionLost(error) || closed) throw error;
      if (current === database) current = null;
      try { database.close(); } catch { /* already closing */ }
      return attempt(await connect(), stores, mode, work);
    }
  }

  return {
    persistent: true, name,
    async get(store, key) { checkStore(store); return run(store, 'readonly', tx => tx.objectStore(store).get(key)); },
    async put(store, key, value) { checkStore(store); await run(store, 'readwrite', tx => tx.objectStore(store).put(value, key)); },
    async delete(store, key) { checkStore(store); await run(store, 'readwrite', tx => tx.objectStore(store).delete(key)); },
    async keys(store) { checkStore(store); return run(store, 'readonly', tx => tx.objectStore(store).getAllKeys()); },
    /** Empties both stores in ONE transaction, so an interrupted reset never leaves a snapshot without its photos or the reverse. */
    async clear() { await run([...STORES], 'readwrite', tx => { for (const store of STORES) tx.objectStore(store).clear(); }); },
    close() { closed = true; const database = current; current = null; try { database?.close(); } catch { /* already closed */ } },
  };
}

/** Deletes the whole database (this page's connections close on versionchange, so it is not blocked by itself). */
export function deleteIdbDatabase(name = DEFAULT_STORE_NAME, { timeoutMs = IDB_OPEN_TIMEOUT_MS, indexedDB: factory } = {}) {
  return new Promise((resolve, reject) => {
    const idb = factory ?? globalThis.indexedDB;
    if (!idb || typeof idb.deleteDatabase !== 'function') { reject(unavailable('IndexedDB is unavailable in this browser.')); return; }
    let settled = false, timer = null;
    const settle = (action, value) => { if (settled) return; settled = true; clearTimeout(timer); action(value); };
    let request;
    try { request = idb.deleteDatabase(name); } catch (error) { reject(unavailable('IndexedDB could not be deleted.', error)); return; }
    timer = setTimeout(() => settle(reject, timeout('delete the database', timeoutMs)), timeoutMs);
    request.onsuccess = () => settle(resolve, undefined);
    request.onerror = event => { event?.preventDefault?.(); settle(reject, unavailable('IndexedDB could not be deleted.', request.error ?? undefined)); };
    request.onblocked = () => {};                    // other connections were asked to close; success follows, or the timeout decides
  });
}

/** Map-backed twin: same surface, values copied in and out like IndexedDB does (structured clone), nothing survives a reload. */
export function createMemoryStore() {
  const maps = Object.fromEntries(STORES.map(store => [store, new Map()]));
  const copy = value => (typeof structuredClone === 'function' ? structuredClone(value) : value);
  return {
    persistent: false, name: 'memory',
    async get(store, key) { checkStore(store); return copy(maps[store].get(key)); },
    async put(store, key, value) { checkStore(store); maps[store].set(key, copy(value)); },
    async delete(store, key) { checkStore(store); maps[store].delete(key); },
    async keys(store) { checkStore(store); return [...maps[store].keys()].sort(); },
    async clear() { for (const map of Object.values(maps)) map.clear(); },
    close() {},
    maps,
  };
}
