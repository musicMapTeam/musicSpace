import test from 'node:test';
import assert from 'node:assert/strict';
import { acquireWriterLock, WRITER_LOCK_NAME } from '../web/static-runtime/single-writer.js';

/**
 * A LockManager stand-in with the Web Locks semantics the module relies on: an exclusive lock per name, granted by calling the callback
 * (asynchronously, like a browser) and kept until the promise the callback returned settles; ifAvailable answers `null` while it is held.
 * `onRequest(callNumber, fake)` runs before each request is judged: that is where a test lets a previous document "unload" late.
 * Anything but an ifAvailable request throws, because waiting for a lock that another tab holds would hang the page.
 */
function createFakeLocks({ onRequest = () => {} } = {}) {
  const held = new Map();
  const fake = {
    held, requests: [],
    /** A lock owned by "another document": returns the function that lets go of it. */
    holdElsewhere(name) {
      assert.ok(!held.has(name), 'already held');
      let free; const hold = new Promise(resolve => { free = resolve; });
      held.set(name, hold); hold.then(() => { if (held.get(name) === hold) held.delete(name); });
      return free;
    },
    async request(name, options, callback) {
      assert.equal(typeof callback, 'function');
      if (!options || options.ifAvailable !== true) throw new TypeError('the fake only supports ifAvailable requests (anything else would wait forever)');
      fake.requests.push({ name, options: { ...options } });
      onRequest(fake.requests.length, fake);
      await Promise.resolve();
      if (held.has(name)) return callback(null);
      const result = callback({ name, mode: options.mode || 'exclusive' });
      const done = Promise.resolve(result).then(() => {}, () => {});
      held.set(name, done);
      try { return await result; } finally { await done; if (held.get(name) === done) held.delete(name); }
    },
  };
  return fake;
}

const NAME = 'music-space-static-writer';
const instant = () => { const sleeps = []; const sleep = async ms => { if (sleeps.length >= 1000) throw new Error('runaway retry loop'); sleeps.push(ms); }; sleep.sleeps = sleeps; return sleep; };
/** Lets pending microtasks and the fake's release chain finish. */
const settle = () => new Promise(resolve => setImmediate(resolve));

test('the default lock name is the one every tab of the origin shares', () => {
  assert.equal(WRITER_LOCK_NAME, 'music-space-static-writer');
});

test('takes the lock with one exclusive ifAvailable request and holds it until release()', async () => {
  const locks = createFakeLocks();
  const lock = await acquireWriterLock({ locks, sleep: instant() });
  assert.equal(lock.held, true);
  assert.equal(lock.reason, 'acquired');
  assert.deepEqual(locks.requests, [{ name: NAME, options: { mode: 'exclusive', ifAvailable: true } }]);
  await settle();
  assert.ok(locks.held.has(NAME), 'still held after the promise resolved');
  await lock.release();
  assert.ok(!locks.held.has(NAME), 'free once release() settled');
});

test('a busy lock is retried 5 times, 300 ms apart, and then reported as not held', async () => {
  const locks = createFakeLocks();
  const free = locks.holdElsewhere(NAME);
  const sleep = instant();
  const lock = await acquireWriterLock({ locks, sleep });
  assert.equal(lock.held, false);
  assert.equal(lock.reason, 'busy');
  assert.equal(locks.requests.length, 6, 'one attempt plus five retries');
  assert.deepEqual(sleep.sleeps, [300, 300, 300, 300, 300]);
  assert.ok(locks.held.has(NAME), 'the other holder is untouched');
  await lock.release();       // nothing to release: must not free the other holder
  await settle();
  assert.ok(locks.held.has(NAME));
  free();
  await settle();
  assert.ok(!locks.held.has(NAME));
});

test('a previous document that lets go late (a reload, the return from the Map) is waited for', async () => {
  let free;
  const locks = createFakeLocks({ onRequest: call => { if (call === 3) free(); } });
  free = locks.holdElsewhere(NAME);
  const sleep = instant();
  const lock = await acquireWriterLock({ locks, sleep });
  assert.equal(lock.held, true);
  assert.equal(lock.reason, 'acquired');
  assert.equal(locks.requests.length, 3, 'busy, busy, then the lock was free');
  assert.deepEqual(sleep.sleeps, [300, 300]);
  await lock.release();
});

test('the lock freed on the very last retry still counts, one more busy answer does not', async () => {
  const lastChance = createFakeLocks({ onRequest: call => { if (call === 4) free(); } });
  let free = lastChance.holdElsewhere(NAME);
  const lock = await acquireWriterLock({ locks: lastChance, retries: 3, delayMs: 7, sleep: instant() });
  assert.equal(lock.held, true);
  assert.equal(lastChance.requests.length, 4);
  await lock.release();
  const tooLate = createFakeLocks({ onRequest: call => { if (call === 5) free2(); } });
  let free2 = tooLate.holdElsewhere(NAME);
  const missed = await acquireWriterLock({ locks: tooLate, retries: 3, delayMs: 7, sleep: instant() });
  assert.equal(missed.held, false);
  assert.equal(tooLate.requests.length, 4, 'retries: 3 means 4 attempts and no fifth');
});

test('retries: 0 asks once and does not sleep; custom retries and delay are honoured', async () => {
  const locks = createFakeLocks();
  locks.holdElsewhere(NAME);
  const once = instant();
  assert.equal((await acquireWriterLock({ locks, retries: 0, sleep: once })).held, false);
  assert.equal(locks.requests.length, 1);
  assert.deepEqual(once.sleeps, []);
  const some = instant();
  await acquireWriterLock({ locks, retries: 2, delayMs: 40, sleep: some });
  assert.deepEqual(some.sleeps, [40, 40]);
  assert.equal(locks.requests.length, 1 + 3);
});

test('release() is idempotent and never frees a lock somebody else took after the first call', async () => {
  const locks = createFakeLocks();
  const a = await acquireWriterLock({ locks, sleep: instant() });
  const first = a.release();
  assert.equal(a.release(), first, 'the same promise every time');
  await first;
  assert.ok(!locks.held.has(NAME));
  const b = await acquireWriterLock({ locks, sleep: instant() });
  assert.equal(b.held, true);
  await a.release();                              // a stale handle from the previous page life
  await settle();
  assert.ok(locks.held.has(NAME), 'b still holds the lock');
  const c = await acquireWriterLock({ locks, retries: 0, sleep: instant() });
  assert.equal(c.held, false, 'and nobody else can take it');
  await b.release();
  await b.release();
  assert.ok(!locks.held.has(NAME));
});

test('a document that starts right after release() (no waiting for it) gets the lock within its retry budget', async () => {
  const locks = createFakeLocks();
  const a = await acquireWriterLock({ locks, sleep: instant() });
  const released = a.release();
  assert.ok(released instanceof Promise);
  const b = await acquireWriterLock({ locks, sleep: instant() });
  assert.equal(b.held, true);
  await released;
  await b.release();
});

test('different names are different locks', async () => {
  const locks = createFakeLocks();
  const a = await acquireWriterLock({ locks, name: 'writer-a', sleep: instant() });
  const b = await acquireWriterLock({ locks, name: 'writer-b', sleep: instant() });
  assert.equal(a.held && b.held, true);
  assert.deepEqual(locks.requests.map(r => r.name), ['writer-a', 'writer-b']);
  assert.equal((await acquireWriterLock({ locks, name: 'writer-a', retries: 0, sleep: instant() })).held, false);
  await a.release(); await b.release();
});

test('no Web Locks API: the tab is taken to be the only one', async () => {
  for (const locks of [null, {}, { request: 'nope' }]) {
    const lock = await acquireWriterLock({ locks, sleep: instant() });
    assert.deepEqual({ held: lock.held, reason: lock.reason }, { held: true, reason: 'unsupported' });
    await lock.release();
    await lock.release();
  }
});

test('with no locks option the browser global navigator.locks is used, and its absence means held', async () => {
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const restore = () => { if (saved) Object.defineProperty(globalThis, 'navigator', saved); else delete globalThis.navigator; };
  try {
    const locks = createFakeLocks();
    Object.defineProperty(globalThis, 'navigator', { value: { locks }, configurable: true, writable: true });
    const lock = await acquireWriterLock({ sleep: instant() });
    assert.equal(lock.held, true);
    assert.equal(locks.requests.length, 1);
    await lock.release();
    Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true, writable: true });
    assert.equal((await acquireWriterLock({ sleep: instant() })).reason, 'unsupported');
    Object.defineProperty(globalThis, 'navigator', { value: undefined, configurable: true, writable: true });
    assert.equal((await acquireWriterLock({ sleep: instant() })).reason, 'unsupported');
  } finally { restore(); }
});

test('a Locks API that cannot answer (rejects, throws, or never runs the callback) fails open instead of freezing the demo read-only', async () => {
  const denied = Object.assign(new Error('The request was aborted: access to the Locks API is denied in this context.'), { name: 'SecurityError' });
  const rejecting = await acquireWriterLock({ locks: { request: () => Promise.reject(denied) }, sleep: instant() });
  assert.deepEqual({ held: rejecting.held, reason: rejecting.reason, error: rejecting.error }, { held: true, reason: 'error', error: denied });
  const throwing = await acquireWriterLock({ locks: { request() { throw denied; } }, sleep: instant() });
  assert.deepEqual({ held: throwing.held, reason: throwing.reason, error: throwing.error }, { held: true, reason: 'error', error: denied });
  const silent = await acquireWriterLock({ locks: { request: async () => undefined }, sleep: instant() });
  assert.deepEqual({ held: silent.held, reason: silent.reason }, { held: true, reason: 'unsupported' });
  for (const lock of [rejecting, throwing, silent]) await lock.release();
});

test('the real timer is used between attempts when none is injected', async () => {
  const locks = createFakeLocks();
  locks.holdElsewhere(NAME);
  const started = Date.now();
  const lock = await acquireWriterLock({ locks, retries: 2, delayMs: 15 });
  assert.equal(lock.held, false);
  assert.equal(locks.requests.length, 3);
  assert.ok(Date.now() - started >= 25, 'two pauses of 15 ms');
});

test('the defaults are 5 retries and 300 ms (1.5 s at most)', async () => {
  const locks = createFakeLocks();
  locks.holdElsewhere(NAME);
  const sleep = instant();
  await acquireWriterLock({ locks, sleep });
  assert.equal(sleep.sleeps.length, 5);
  assert.equal(sleep.sleeps.reduce((sum, ms) => sum + ms, 0), 1500);
});

test('nonsense retries and delays cannot loop forever or sleep negative time', async () => {
  const locks = createFakeLocks();
  locks.holdElsewhere(NAME);
  const sleep = instant();
  await acquireWriterLock({ locks, retries: Infinity, delayMs: -5, sleep });
  assert.equal(sleep.sleeps.length, 5, 'a non-finite count falls back to the default');
  assert.ok(sleep.sleeps.every(ms => ms === 0));
  const none = instant();
  await acquireWriterLock({ locks, retries: -3, sleep: none });
  assert.deepEqual(none.sleeps, []);
});

// The same scenarios against Node's own Web Locks implementation (navigator.locks, Node 24.5+), so the fake above cannot drift from the real
// thing: a second request while the lock is held answers null, release() gives it back.
test('against a real LockManager: busy while held, free after release()', { skip: typeof globalThis.navigator?.locks?.request === 'function' ? false : 'no navigator.locks in this Node' }, async () => {
  const locks = globalThis.navigator.locks;
  const name = `music-space-test-${process.pid}-${Date.now()}`;
  const first = await acquireWriterLock({ locks, name, sleep: instant() });
  assert.equal(first.held, true);
  assert.equal(first.reason, 'acquired');
  const second = await acquireWriterLock({ locks, name, retries: 1, delayMs: 5 });
  assert.equal(second.held, false);
  assert.equal(second.reason, 'busy');
  await second.release();
  assert.equal((await locks.query()).held.some(lock => lock.name === name), true, 'the first lock is still held');
  await first.release();
  await first.release();
  assert.equal((await locks.query()).held.some(lock => lock.name === name), false, 'and gone after release()');
  const third = await acquireWriterLock({ locks, name, retries: 0 });
  assert.equal(third.held, true);
  await third.release();
});
