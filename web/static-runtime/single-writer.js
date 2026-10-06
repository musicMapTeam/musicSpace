/**
 * Single-writer lock for the in-browser runtime (route B, architecture section 4.2).
 *
 * The static site keeps the whole database in this browser. Two tabs of the same origin would each load the same IndexedDB snapshot and
 * overwrite one another, so the first tab takes an exclusive Web Lock and any later tab becomes a read-only copy (the boot code then calls
 * runtime.setWritable(false): no seeding, no autopilot, no wipe, no snapshot).
 *
 * Behaviour contract (tests/static-single-writer.test.js pins each line):
 *  - acquire: navigator.locks.request(name, { mode: 'exclusive', ifAvailable: true }, callback). The callback keeps the lock by returning a
 *    promise that only release() resolves, so the lock lives exactly as long as the caller wants, or until the document goes away.
 *  - busy: ifAvailable answers `null`. A document that was just unloaded may not have given its lock back yet (a reload, or the return from
 *    the Map, which is a new navigation), so the request is repeated up to `retries` more times, `delayMs` apart (5 x 300 ms by default,
 *    1.5 s at most), and only then does the result say held:false.
 *  - no Web Locks API, or an API that cannot answer (request() throws or rejects, e.g. SecurityError in a sandboxed frame): the tab is
 *    treated as the only one, held:true. The lock protects against a second copy of the demo; it is not a security boundary, and a lock that
 *    cannot be asked must not turn a working demo into a read-only one.
 *  - release() is idempotent and never throws. The boot code calls it from pagehide, so it starts the release synchronously (the holding
 *    promise is resolved at once and the browser frees the lock a microtask later); the promise it returns settles when the browser has
 *    actually let go of the lock, and a stale handle can never free a lock somebody else took afterwards.
 *
 * Nothing here touches the DOM at import time; every environment object arrives through the options so Node tests can pass a fake.
 */

export const WRITER_LOCK_NAME = 'music-space-static-writer';

const noop = () => {};
const defaultSleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const nothingToRelease = () => Promise.resolve();

/**
 * One ifAvailable request. Resolves with
 *   { status: 'held', release }   the callback ran with a lock and keeps it until release()
 *   { status: 'busy' }            the callback ran with null: somebody else holds the lock
 *   { status: 'unsupported' }     request() settled without ever running the callback (a broken polyfill)
 *   { status: 'error', error }    request() threw or rejected before granting anything
 */
function requestOnce(locks, name) {
  return new Promise(resolve => {
    let answered = false;
    const answer = value => { if (!answered) { answered = true; resolve(value); } };
    let letGo = noop;
    const hold = new Promise(done => { letGo = done; });
    let freed = noop;
    const lockIsFree = new Promise(done => { freed = done; });
    let request;
    try {
      request = locks.request(name, { mode: 'exclusive', ifAvailable: true }, lock => {
        if (!lock) { answer({ status: 'busy' }); return undefined; }
        answer({ status: 'held', release: () => { letGo(); return lockIsFree; } });
        return hold;
      });
    } catch (error) { answer({ status: 'error', error }); return; }
    // request() settles once the callback's promise has settled, which is the moment the lock really is free again.
    Promise.resolve(request).then(
      () => { freed(); answer({ status: 'unsupported' }); },
      error => { freed(); answer({ status: 'error', error }); },
    );
  });
}

/**
 * @param {object} [options]
 * @param {string} [options.name='music-space-static-writer']  every tab of one origin must use the same name
 * @param {number} [options.retries=5]    extra attempts after the first one while the lock is busy
 * @param {number} [options.delayMs=300]  pause between attempts
 * @param {object} [options.locks=globalThis.navigator?.locks]  a LockManager or a fake; null, undefined or no request() = no Locks API
 * @param {(ms:number)=>Promise<void>} [options.sleep]  timer, replaceable in tests
 * @returns {Promise<{ held: boolean, reason: 'acquired'|'busy'|'unsupported'|'error', error?: unknown, release: () => Promise<void> }>}
 */
export async function acquireWriterLock({ name = WRITER_LOCK_NAME, retries = 5, delayMs = 300, locks = globalThis.navigator?.locks, sleep = defaultSleep } = {}) {
  if (!locks || typeof locks.request !== 'function') return { held: true, reason: 'unsupported', release: nothingToRelease };
  const extraAttempts = Number.isFinite(retries) ? Math.max(0, Math.floor(retries)) : 5;
  const pause = Math.max(0, Number(delayMs) || 0);
  for (let attempt = 0; ; attempt++) {
    const answer = await requestOnce(locks, name);
    if (answer.status === 'held') return { held: true, reason: 'acquired', release: answer.release };
    if (answer.status === 'unsupported') return { held: true, reason: 'unsupported', release: nothingToRelease };
    if (answer.status === 'error') return { held: true, reason: 'error', error: answer.error, release: nothingToRelease };
    if (attempt >= extraAttempts) return { held: false, reason: 'busy', release: nothingToRelease };
    await sleep(pause);
  }
}
