// web/static-runtime/idb-store.js (IndexedDB wrapper with open timeout and a reopen-and-retry for Safari's closing connections, plus its
// Map twin) and r2-idb.js (the R2-shaped PHOTOS binding over the 'blobs' store). IndexedDB itself is a small in-memory fake here that
// can hang, refuse, close a connection under the caller or abort a transaction; the real browser path is checked separately in Tabbit.
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { openIdbStore, deleteIdbDatabase, createMemoryStore, IdbStoreError, STORES, IDB_OPEN_TIMEOUT_MS } from '../web/static-runtime/idb-store.js';
import { createPhotos } from '../web/static-runtime/r2-idb.js';
import { Buffer as ShimBuffer } from '../web/static-runtime/shims/node-buffer.js';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** A just-enough IndexedDB: open / upgrade / transaction / get put delete getAllKeys clear / deleteDatabase, structured-cloned values. */
function createFakeIndexedDB() {
  const databases = new Map();
  const connections = new Set();
  const stats = { opens: 0, transactions: [] };
  const knobs = { open: 'ok', openDelayMs: 0, invalidState: 0, transactionFailure: null, abortWith: null, requestErrorWith: null, ignoreVersionChange: false };

  function makeTransaction(db, names, mode) {
    stats.transactions.push({ names, mode });
    const tx = { error: null, oncomplete: null, onerror: null, onabort: null, queue: [], scheduled: false };
    function run() {
      const saved = new Map(names.map(name => [name, new Map(db.stores[name])]));
      try {
        if (knobs.requestErrorWith) {                                  // a request fails: its error event bubbles to the transaction while tx.error is still null
          const failure = knobs.requestErrorWith; knobs.requestErrorWith = null;
          const request = tx.queue[0].request; request.error = failure;
          tx.onerror?.({ target: request, preventDefault() {} });
          for (const [name, map] of saved) db.stores[name] = map;
          tx.error = failure; tx.onabort?.({});
          return;
        }
        for (const entry of tx.queue) { entry.request.result = entry.work(); entry.request.onsuccess?.({ target: entry.request }); }
        if (knobs.abortWith) { const error = knobs.abortWith; knobs.abortWith = null; throw error; }
        tx.oncomplete?.({});
      } catch (error) {
        for (const [name, map] of saved) db.stores[name] = map;       // rollback: a commit-time failure (quota) is a transaction abort, no request error event
        tx.error = error; tx.onabort?.({});
      }
    }
    const enqueue = work => {
      const request = { result: undefined, error: null, onsuccess: null, onerror: null };
      tx.queue.push({ request, work });
      if (!tx.scheduled) { tx.scheduled = true; setTimeout(run, 0); }
      return request;
    };
    tx.objectStore = name => {
      if (!names.includes(name)) throw new DOMException(`${name} is not in the transaction scope`, 'NotFoundError');
      const map = () => db.stores[name];
      const writable = () => { if (mode !== 'readwrite') throw new DOMException('read-only transaction', 'ReadOnlyError'); };
      return {
        get: key => enqueue(() => structuredClone(map().get(key))),
        getAllKeys: () => enqueue(() => [...map().keys()].sort()),
        put: (value, key) => { writable(); const copy = structuredClone(value); return enqueue(() => { map().set(key, copy); return key; }); },
        delete: key => { writable(); return enqueue(() => { map().delete(key); }); },
        clear: () => { writable(); return enqueue(() => { map().clear(); }); },
      };
    };
    tx.abort = () => { tx.queue.length = 0; };
    return tx;
  }
  function makeConnection(name, db) {
    const connection = {
      name, closed: false, closing: false, onversionchange: null, onclose: null,
      objectStoreNames: { contains: store => store in db.stores },
      createObjectStore(store) { db.stores[store] = new Map(); },
      transaction(names, mode = 'readonly') {
        if (knobs.transactionFailure?.times > 0) {
          knobs.transactionFailure.times -= 1;
          throw new DOMException(knobs.transactionFailure.message, knobs.transactionFailure.name);
        }
        if (connection.closed || connection.closing || knobs.invalidState > 0) {
          if (knobs.invalidState > 0) knobs.invalidState -= 1;
          throw new DOMException('The database connection is closing.', 'InvalidStateError');
        }
        return makeTransaction(db, [].concat(names), mode);
      },
      close() { connection.closed = true; connections.delete(connection); },
    };
    return connection;
  }
  const factory = {
    open(name) {
      if (knobs.open === 'throw') throw new DOMException('The operation is insecure.', 'SecurityError');
      stats.opens += 1;
      const request = { result: null, error: null, onsuccess: null, onerror: null, onupgradeneeded: null, onblocked: null };
      if (knobs.open === 'hang') return request;
      setTimeout(() => {
        if (knobs.open === 'error') { request.error = new DOMException('Internal error opening backing store', 'UnknownError'); request.onerror?.({ preventDefault() {} }); return; }
        let db = databases.get(name);
        const created = !db;
        if (created) { db = { stores: {} }; databases.set(name, db); }
        const connection = makeConnection(name, db);
        connections.add(connection);
        request.result = connection;
        if (created) request.onupgradeneeded?.({ target: request });
        request.onsuccess?.({ target: request });
      }, knobs.openDelayMs);
      return request;
    },
    deleteDatabase(name) {
      const request = { error: null, onsuccess: null, onerror: null, onblocked: null };
      setTimeout(async () => {
        const open = [...connections].filter(connection => connection.name === name);
        if (!knobs.ignoreVersionChange) for (const connection of open) connection.onversionchange?.({});
        if (open.some(connection => !connection.closed)) request.onblocked?.({});
        while (open.some(connection => !connection.closed)) await sleep(5);
        databases.delete(name);
        request.onsuccess?.({});
      }, 0);
      return request;
    },
  };
  return {
    factory, knobs, stats, databases,
    openConnections: () => [...connections].filter(connection => !connection.closed).length,
    /** What Safari does: every live connection starts refusing transactions with InvalidStateError until it is closed and reopened. */
    closeUnderneath() { for (const connection of connections) connection.closing = true; },
    /** What Chrome does on "clear site data": the connection is closed abnormally and the close event fires. */
    abnormalClose() { for (const connection of [...connections]) { connection.close(); connection.onclose?.({}); } },
    versionChange() { for (const connection of [...connections]) connection.onversionchange?.({}); },
  };
}

const open = (fake, name = 'music-space-static:test:v1', options = {}) => openIdbStore(name, { timeoutMs: 200, indexedDB: fake.factory, ...options });

// ---- the surface both stores share ------------------------------------------------------------------------------------------------

const KINDS = [
  ['memory twin', async () => ({ store: createMemoryStore(), persistent: false, name: 'memory' })],
  ['indexedDB (fake)', async () => ({ store: await open(createFakeIndexedDB(), 'surface-test'), persistent: true, name: 'surface-test' })],
];
for (const [kind, make] of KINDS) {
  test(`${kind}: get / put / delete / keys / clear, persistent and name`, async () => {
    const { store, persistent, name } = await make();
    assert.equal(store.persistent, persistent);
    assert.equal(store.name, name);
    assert.deepEqual([...STORES], ['kv', 'blobs']);
    assert.equal(await store.get('kv', 'missing'), undefined);
    assert.equal(await store.put('kv', 'db', { bytes: new Uint8Array([1, 2, 3]), savedAt: 5 }), undefined);
    assert.deepEqual(await store.get('kv', 'db'), { bytes: new Uint8Array([1, 2, 3]), savedAt: 5 });
    await store.put('blobs', 'b', new Uint8Array([9]));
    await store.put('blobs', 'a', new Uint8Array([8]));
    assert.deepEqual(await store.keys('kv'), ['db']);
    assert.deepEqual(await store.keys('blobs'), ['a', 'b'], 'keys come back sorted, like getAllKeys');
    assert.equal(await store.delete('blobs', 'a'), undefined);
    assert.deepEqual(await store.keys('blobs'), ['b']);
    assert.equal(await store.delete('blobs', 'never-there'), undefined, 'deleting a missing key is fine');
    assert.equal(await store.clear(), undefined);
    assert.deepEqual([await store.keys('kv'), await store.keys('blobs')], [[], []], 'clear empties both stores');
    assert.equal(await store.get('kv', 'db'), undefined);
  });

  test(`${kind}: values are copied in and out (structured clone), never shared with the caller`, async () => {
    const { store } = await make();
    const bytes = new Uint8Array([1, 2, 3]);
    await store.put('blobs', 'k', bytes);
    bytes[0] = 99;
    const first = await store.get('blobs', 'k');
    assert.equal(first[0], 1, 'a later change by the caller does not reach the store');
    first[1] = 77;
    assert.equal((await store.get('blobs', 'k'))[1], 2, 'a change to a returned value does not reach the store');
    assert.ok((await store.get('blobs', 'k')) instanceof Uint8Array);
  });

  test(`${kind}: an unknown store name rejects`, async () => {
    const { store } = await make();
    await assert.rejects(store.get('nope', 'k'), TypeError);
    await assert.rejects(store.put('nope', 'k', 1), TypeError);
    await assert.rejects(store.delete('nope', 'k'), TypeError);
    await assert.rejects(store.keys('nope'), TypeError);
  });

  test(`${kind}: r2-idb PHOTOS binding puts, gets, deletes and copies the bytes`, async () => {
    const { store } = await make();
    const photos = createPhotos(store);
    assert.equal(await photos.get('events/a.jpg'), null, 'a missing object is null, like R2');
    const source = ShimBuffer.from([0xff, 0xd8, 1, 2, 3, 0xff, 0xd9]);
    assert.equal(await photos.put('events/a.jpg', source, { httpMetadata: { contentType: 'image/jpeg' } }), undefined, 'options are accepted');
    source[2] = 99;
    const object = await photos.get('events/a.jpg');
    assert.ok(object.body instanceof Uint8Array);
    assert.deepEqual([...object.body], [0xff, 0xd8, 1, 2, 3, 0xff, 0xd9], 'the stored bytes do not change with the caller\'s buffer');
    assert.equal(object.body.cancel, undefined, 'no stream: the workers call body.cancel?.()');
    const response = new Response(object.body, { headers: { 'Content-Type': 'image/jpeg' } });
    assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [0xff, 0xd8, 1, 2, 3, 0xff, 0xd9]);
    assert.deepEqual(await store.keys('blobs'), ['events/a.jpg'], 'photos live in the blobs store');
    assert.deepEqual(await store.keys('kv'), []);
    await photos.put('events/b.jpg', new Uint8Array([4, 5]).buffer);
    await photos.put('events/c.txt', 'héllo');
    await photos.put('events/d.bin', new Uint16Array([0x0102, 0x0304]));
    assert.deepEqual([...(await photos.get('events/b.jpg')).body], [4, 5]);
    assert.equal(new TextDecoder().decode((await photos.get('events/c.txt')).body), 'héllo');
    assert.deepEqual([...(await photos.get('events/d.bin')).body], [2, 1, 4, 3], 'a typed array is stored by its bytes');
    await assert.rejects(photos.put('x', 12), TypeError);
    await assert.rejects(photos.put('x', null), TypeError);
    assert.equal(await photos.delete('events/a.jpg'), undefined);
    assert.equal(await photos.get('events/a.jpg'), null);
    assert.equal(await photos.delete('events/a.jpg'), undefined, 'deleting twice is fine');
  });
}

test('memory twin: close() is a no-op, the data stays readable (a "reload" is a second runtime on the same store)', async () => {
  const store = createMemoryStore();
  await store.put('kv', 'a', 1);
  assert.equal(store.close(), undefined);
  assert.equal(await store.get('kv', 'a'), 1);
  assert.ok(store.maps.kv instanceof Map && store.maps.blobs instanceof Map);
});

// ---- open: timeout, unavailable, late connections ---------------------------------------------------------------------------------

test('open: the default timeout is 3 s and the rejection says IDB_TIMEOUT (fake clock)', async () => {
  assert.equal(IDB_OPEN_TIMEOUT_MS, 3000);
  const fake = createFakeIndexedDB();
  fake.knobs.open = 'hang';
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    let outcome = 'pending';
    const opening = openIdbStore('hung', { indexedDB: fake.factory }).then(() => { outcome = 'opened'; }, error => { outcome = error; });
    mock.timers.tick(2999); await Promise.resolve();
    assert.equal(outcome, 'pending', 'still waiting at 2999 ms');
    mock.timers.tick(1); await opening;
    assert.ok(outcome instanceof IdbStoreError);
    assert.equal(outcome.code, 'IDB_TIMEOUT');
  } finally { mock.timers.reset(); }
});

test('open: an indexedDB that never answers rejects IDB_TIMEOUT and leaves no timer behind', async () => {
  const fake = createFakeIndexedDB();
  fake.knobs.open = 'hang';
  const started = performance.now();
  await assert.rejects(open(fake, 'hung', { timeoutMs: 40 }), { name: 'IdbStoreError', code: 'IDB_TIMEOUT' });
  const waited = performance.now() - started;
  assert.ok(waited >= 30 && waited < 1000, `waited ${waited} ms`);
});

test('open: a connection that arrives after the timeout is closed again (no leaked connection to block deletes)', async () => {
  const fake = createFakeIndexedDB();
  fake.knobs.openDelayMs = 80;
  await assert.rejects(open(fake, 'slow', { timeoutMs: 20 }), { code: 'IDB_TIMEOUT' });
  assert.equal(fake.openConnections(), 0);
  await sleep(150);
  assert.equal(fake.openConnections(), 0, 'the late success closed its own connection');
});

test('open: IDB_UNAVAILABLE when there is no indexedDB, open() throws (Firefox private mode, blocked storage) or the request errors', async () => {
  await assert.rejects(openIdbStore('x', { timeoutMs: 20 }), { name: 'IdbStoreError', code: 'IDB_UNAVAILABLE' }, 'Node has no indexedDB global');
  await assert.rejects(openIdbStore('x', { indexedDB: {}, timeoutMs: 20 }), { code: 'IDB_UNAVAILABLE' });
  const throwing = createFakeIndexedDB(); throwing.knobs.open = 'throw';
  await assert.rejects(open(throwing), error => error.code === 'IDB_UNAVAILABLE' && error.cause?.name === 'SecurityError');
  const failing = createFakeIndexedDB(); failing.knobs.open = 'error';
  await assert.rejects(open(failing), error => error.code === 'IDB_UNAVAILABLE' && error.cause?.name === 'UnknownError');
});

test('open: creates both object stores, reuses an existing database and keeps data across connections', async () => {
  const fake = createFakeIndexedDB();
  const first = await open(fake, 'persist');
  assert.deepEqual(Object.keys(fake.databases.get('persist').stores).sort(), ['blobs', 'kv']);
  await first.put('kv', 'db', { n: 1 });
  first.close();
  assert.equal(fake.openConnections(), 0, 'close() closes the connection');
  const second = await open(fake, 'persist');
  assert.deepEqual(await second.get('kv', 'db'), { n: 1 });
  assert.equal(fake.stats.opens, 2);
});

// ---- operations: single transaction clear, errors, close --------------------------------------------------------------------------

test('clear() empties both stores in ONE readwrite transaction', async () => {
  const fake = createFakeIndexedDB();
  const store = await open(fake);
  await store.put('kv', 'db', 1); await store.put('blobs', 'p', 2);
  const before = fake.stats.transactions.length;
  await store.clear();
  const used = fake.stats.transactions.slice(before);
  assert.equal(used.length, 1);
  assert.deepEqual(used[0], { names: ['kv', 'blobs'], mode: 'readwrite' });
});

test('an aborted transaction (quota) rejects with its own error, rolls back and is not retried', async () => {
  const fake = createFakeIndexedDB();
  const store = await open(fake);
  await store.put('kv', 'db', 'old');
  fake.knobs.abortWith = new DOMException('The quota has been exceeded.', 'QuotaExceededError');
  await assert.rejects(store.put('kv', 'db', 'new'), { name: 'QuotaExceededError' });
  assert.equal(fake.stats.opens, 1, 'no reopen for an error that is not InvalidStateError');
  assert.equal(await store.get('kv', 'db'), 'old', 'the failed write left the old value');
  await store.put('kv', 'db', 'newer');
  assert.equal(await store.get('kv', 'db'), 'newer', 'the store keeps working');
});

test('a failing request rejects with the request\'s own error (not a generic transaction error), rolls back and is not retried', async () => {
  const fake = createFakeIndexedDB();
  const store = await open(fake);
  await store.put('kv', 'k', 'old');
  fake.knobs.requestErrorWith = new DOMException('Key already exists in the object store.', 'ConstraintError');
  await assert.rejects(store.put('kv', 'k', 'new'), { name: 'ConstraintError' });
  assert.equal(fake.stats.opens, 1, 'no reopen');
  assert.equal(await store.get('kv', 'k'), 'old');
});

test('a value that cannot be cloned rejects and leaves the store usable', async () => {
  const fake = createFakeIndexedDB();
  const store = await open(fake);
  await assert.rejects(store.put('kv', 'x', { f() {} }), { name: 'DataCloneError' });
  await store.put('kv', 'x', 1);
  assert.equal(await store.get('kv', 'x'), 1);
});

test('close(): later operations reject with IDB_CLOSED and do not reopen', async () => {
  const fake = createFakeIndexedDB();
  const store = await open(fake);
  await store.put('kv', 'a', 1);
  store.close();
  await assert.rejects(store.get('kv', 'a'), { code: 'IDB_CLOSED' });
  await assert.rejects(store.put('kv', 'a', 2), { code: 'IDB_CLOSED' });
  assert.equal(fake.stats.opens, 1);
  assert.equal(fake.openConnections(), 0);
  store.close();                                  // twice is fine
});

// ---- Safari: the connection closes under a live page ------------------------------------------------------------------------------

test('InvalidStateError from transaction(): reopen once and retry the operation, transparently', async () => {
  const fake = createFakeIndexedDB();
  const store = await open(fake);
  await store.put('kv', 'a', 1);
  fake.knobs.invalidState = 1;
  assert.equal(await store.get('kv', 'a'), 1, 'the read succeeded on the retry');
  assert.equal(fake.stats.opens, 2, 'exactly one reopen');
  fake.knobs.invalidState = 1;
  await store.put('kv', 'b', 2);
  assert.equal(await store.get('kv', 'b'), 2, 'writes are retried too, and applied once');
  assert.equal(fake.stats.opens, 3);
  assert.equal(fake.openConnections(), 1, 'the closing connection was replaced, not leaked');
});

test('iOS Safari\'s "Connection to Indexed Database server lost" (UnknownError) is cured the same way: one reopen, one retry', async () => {
  const fake = createFakeIndexedDB();
  const store = await open(fake);
  await store.put('kv', 'a', 1);
  fake.knobs.transactionFailure = { name: 'UnknownError', message: 'Connection to Indexed Database server lost. Refresh the page to try again', times: 1 };
  assert.equal(await store.get('kv', 'a'), 1);
  assert.equal(fake.stats.opens, 2, 'exactly one reopen');
  fake.knobs.transactionFailure = { name: 'UnknownError', message: 'again', times: 2 };
  await assert.rejects(store.get('kv', 'a'), { name: 'UnknownError' });
  assert.equal(fake.stats.opens, 3, 'and the second failure reaches the caller');
  fake.knobs.transactionFailure = { name: 'QuotaExceededError', message: 'full', times: 1 };
  await assert.rejects(store.get('kv', 'a'), { name: 'QuotaExceededError' });
  assert.equal(fake.stats.opens, 3, 'other errors are never retried');
});

test('InvalidStateError twice in a row: the retry is the last, the second error reaches the caller; the next call still works', async () => {
  const fake = createFakeIndexedDB();
  const store = await open(fake);
  fake.knobs.invalidState = 2;
  await assert.rejects(store.put('kv', 'a', 1), { name: 'InvalidStateError' });
  assert.equal(fake.stats.opens, 2, 'one reopen, no loop');
  await store.put('kv', 'a', 1);
  assert.equal(await store.get('kv', 'a'), 1);
});

test('a connection Safari closes under the page: concurrent operations share ONE reopen', async () => {
  const fake = createFakeIndexedDB();
  const store = await open(fake);
  await store.put('kv', 'a', 1);
  fake.closeUnderneath();
  const results = await Promise.all([store.get('kv', 'a'), store.put('kv', 'b', 2), store.keys('kv'), store.get('kv', 'a'), store.delete('kv', 'zzz')]);
  assert.equal(results[0], 1);
  assert.deepEqual(results[2].includes('a'), true);
  assert.equal(fake.stats.opens, 2, 'five operations, one reopen');
  assert.equal(await store.get('kv', 'b'), 2);
});

test('a reopen that times out rejects IDB_TIMEOUT (callers then fall back to the memory store)', async () => {
  const fake = createFakeIndexedDB();
  const store = await open(fake, 'x', { timeoutMs: 30 });
  fake.closeUnderneath();
  fake.knobs.open = 'hang';
  await assert.rejects(store.get('kv', 'a'), { code: 'IDB_TIMEOUT' });
});

test('versionchange from another tab closes this connection and the next operation reopens', async () => {
  const fake = createFakeIndexedDB();
  const store = await open(fake);
  await store.put('kv', 'a', 1);
  fake.versionChange();
  assert.equal(fake.openConnections(), 0, 'our connection yielded to the other tab');
  assert.equal(await store.get('kv', 'a'), 1);
  assert.equal(fake.stats.opens, 2);
});

test('an abnormal close event (site data cleared) is noticed: the next operation reopens', async () => {
  const fake = createFakeIndexedDB();
  const store = await open(fake);
  await store.put('kv', 'a', 1);
  fake.abnormalClose();
  assert.equal(await store.get('kv', 'a'), 1);
  assert.equal(fake.stats.opens, 2);
});

// ---- deleteIdbDatabase ----------------------------------------------------------------------------------------------------------

test('deleteIdbDatabase removes the database, also from under an open connection of this page', async () => {
  const fake = createFakeIndexedDB();
  const store = await open(fake, 'doomed');
  await store.put('kv', 'a', 1);
  assert.equal(await deleteIdbDatabase('doomed', { indexedDB: fake.factory, timeoutMs: 300 }), undefined);
  assert.equal(fake.databases.has('doomed'), false);
  assert.equal(fake.openConnections(), 0, 'the connection closed on versionchange, so the delete was not blocked by this page');
  const again = await open(fake, 'doomed');
  assert.equal(await again.get('kv', 'a'), undefined, 'a fresh, empty database');
});

test('deleteIdbDatabase: blocked by a connection that ignores versionchange times out; unavailable rejects IDB_UNAVAILABLE', async () => {
  const fake = createFakeIndexedDB();
  await open(fake, 'stuck');
  fake.knobs.ignoreVersionChange = true;
  await assert.rejects(deleteIdbDatabase('stuck', { indexedDB: fake.factory, timeoutMs: 40 }), { code: 'IDB_TIMEOUT' });
  fake.abnormalClose();                          // let the fake's pending delete finish, or its polling loop would keep the process alive
  await assert.rejects(deleteIdbDatabase('x', {}), { code: 'IDB_UNAVAILABLE' });
  await assert.rejects(deleteIdbDatabase('x', { indexedDB: { deleteDatabase() { throw new DOMException('no', 'SecurityError'); } } }), { code: 'IDB_UNAVAILABLE' });
  const erroring = { deleteDatabase() { const request = {}; setTimeout(() => { request.error = new DOMException('boom', 'UnknownError'); request.onerror?.({ preventDefault() {} }); }, 0); return request; } };
  await assert.rejects(deleteIdbDatabase('x', { indexedDB: erroring }), { code: 'IDB_UNAVAILABLE' });
});

test('deleteIdbDatabase works on a database that was never opened', async () => {
  const fake = createFakeIndexedDB();
  assert.equal(await deleteIdbDatabase('nothing-here', { indexedDB: fake.factory }), undefined);
});

test('IdbStoreError carries code, message and cause', () => {
  const cause = new Error('inner');
  const error = new IdbStoreError('IDB_TIMEOUT', 'too slow', cause);
  assert.ok(error instanceof Error);
  assert.deepEqual([error.name, error.code, error.message, error.cause], ['IdbStoreError', 'IDB_TIMEOUT', 'too slow', cause]);
});
