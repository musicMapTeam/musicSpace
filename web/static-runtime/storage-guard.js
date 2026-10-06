/**
 * Browser-storage guard for the in-browser runtime (route B, architecture section 4.4).
 *
 * The demo database lives in IndexedDB (music-space-static:<channel>:v1) but the event client keeps its identity, drafts and pending
 * operations in localStorage, and the origin is shared with the 0.16 root app, the Music Map and the standalone Map. Wiping the database
 * alone leaves an identity the database has never heard of (「此浏览器身份已失效」); wiping localStorage wholesale would destroy the others'
 * data. This module owns the list of what belongs to the event room and may be thrown away, and what must be left alone.
 *
 *  PURGE_PREFIXES  keys of the event room client: identity, drafts, pending operations, the tour card. Disposable with the database.
 *  KEEP_PREFIXES   keys that belong to other products on the same origin. Never touched.
 *  Cache Storage `music-space-ai-v1` (model and wasm, 10 MB) is shared by every page and is never touched by anything in this file.
 *
 * tests/static-storage-guard.test.js scans the event room sources and fails when a new `music-space-` literal is in neither list;
 * tests/static-prefix-sync.test.js keeps the rescue overlay's copy of PURGE_PREFIXES (scripts/build/static-html-plugin.mjs) equal to this one.
 */

export const PURGE_PREFIXES = Object.freeze([
  'music-space-avatar', 'music-space-event-', 'music-space-worldcup-', 'music-space-topic-', 'music-space-organization',
  'music-space-game-', 'music-space-corner-', 'music-space-community-', 'music-space-tour:',
]);

export const KEEP_PREFIXES = Object.freeze([
  'music-space-map-', 'music-space:v1', 'music-space-live:v1', 'music-space-duet-seen:v1', 'music-map-',
]);

/** The event client's identity record: JSON { token, user: { id, ... } } (web/event-client/controller.js SESSION_KEY). */
export const AVATAR_SESSION_KEY = 'music-space-avatar-session:v1';

const startsWithAny = (key, prefixes) => typeof key === 'string' && prefixes.some(prefix => key.startsWith(prefix));

/** 'purge' | 'keep' | null (null: not a key this module knows, left alone by every function here). */
export function classifyStorageKey(key) {
  if (startsWithAny(key, PURGE_PREFIXES)) return 'purge';
  if (startsWithAny(key, KEEP_PREFIXES)) return 'keep';
  return null;
}

/** A snapshot of the keys: removing while walking `storage.key(i)` skips entries because the indexes shift. */
function snapshotKeys(storage) {
  const keys = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (typeof key === 'string') keys.push(key);
  }
  return keys;
}

/**
 * Removes only the event client's keys (PURGE_PREFIXES) and returns the keys it removed. Never throws: no storage, blocked storage or a
 * key that cannot be removed simply leaves that key where it is.
 */
export function clearEventClientStorage(storage) {
  const removed = [];
  let keys;
  try { keys = storage && typeof storage.removeItem === 'function' ? snapshotKeys(storage) : []; } catch { return removed; }
  for (const key of keys) {
    if (!startsWithAny(key, PURGE_PREFIXES)) continue;
    try { storage.removeItem(key); removed.push(key); } catch { /* leave it */ }
  }
  return removed;
}

/**
 * The browser remembers an identity (localStorage) that the database may never have issued: after a self-heal, a reset in another tab, or
 * a different build channel. When the stored identity parses and its user id is unknown to the database, the event client's keys are
 * purged so the visitor starts with a fresh identity instead of a 「身份已失效」 screen. `hasUser(id)` answers from the database.
 * Resolves true when keys were purged. Never rejects, and never purges on doubt: no storage, no identity, an unreadable identity (the
 * event client has its own handling for that) or a failing `hasUser` all leave everything in place.
 */
export async function reconcileLocalStorage({ storage, hasUser } = {}) {
  let id = null;
  try {
    const raw = storage?.getItem(AVATAR_SESSION_KEY);
    const session = raw == null ? null : JSON.parse(raw);
    if (typeof session?.user?.id === 'string' && session.user.id) id = session.user.id;
  } catch { return false; }
  if (id === null || typeof hasUser !== 'function') return false;
  let known;
  try { known = await hasUser(id); } catch { return false; }
  if (known) return false;
  clearEventClientStorage(storage);
  return true;
}

/**
 * Deletes the IndexedDB database `idbName` and the event client's localStorage keys, with no runtime, no store and no other module:
 * this is what the rescue overlay and the boot code's reset fall back on when the runtime itself is the thing that is broken.
 *
 * SELF-CONTAINED ON PURPOSE: no imports, no references to anything outside the function (the prefix list is repeated inside), plain
 * ES5 syntax, so scripts/build/static-html-plugin.mjs can embed an equivalent text in a classic inline script and
 * tests/static-prefix-sync.test.js can prove the two lists stay equal. A test rebuilds this function from its own source text with
 * `new Function` to prove nothing leaks in from the module scope. Keep it that way: edit the list here AND in PURGE_PREFIXES.
 *
 * options: { idbName, storage = localStorage, indexedDB = the global one, timeoutMs = 1500 }
 * Resolves (never rejects) with { indexedDb, removedKeys, error? } where indexedDb is
 *   'deleted'      the database is gone
 *   'blocked'      another connection (a second tab) kept it open and the delete was still pending after timeoutMs; it completes by
 *                  itself when that connection closes, before any later open, so the caller may go on and reload
 *   'timeout'      no answer at all within timeoutMs (a hung IndexedDB); same advice
 *   'error'        the delete failed (error holds the message)
 *   'unavailable'  no IndexedDB in this browser
 *   'skipped'      no idbName was given
 */
export function resetStaticStorage(options) {
  var opts = options || {};
  var prefixes = ['music-space-avatar', 'music-space-event-', 'music-space-worldcup-', 'music-space-topic-', 'music-space-organization', 'music-space-game-', 'music-space-corner-', 'music-space-community-', 'music-space-tour:'];
  var name = typeof opts.idbName === 'string' ? opts.idbName : '';
  var waitMs = typeof opts.timeoutMs === 'number' && opts.timeoutMs >= 0 ? opts.timeoutMs : 1500;
  var storage = opts.storage;
  var factory = opts.indexedDB;
  if (storage === undefined) { try { storage = localStorage; } catch (e) { storage = null; } }
  if (factory === undefined) { try { factory = indexedDB; } catch (e) { factory = null; } }

  var removed = [];
  try {
    if (storage) {
      var keys = [];
      for (var i = 0; i < storage.length; i++) { var found = storage.key(i); if (typeof found === 'string') keys.push(found); }
      keys.forEach(function (key) {
        for (var p = 0; p < prefixes.length; p++) {
          if (key.indexOf(prefixes[p]) === 0) {
            try { storage.removeItem(key); removed.push(key); } catch (e) { /* leave it */ }
            return;
          }
        }
      });
    }
  } catch (e) { /* storage is blocked: nothing to clear */ }

  return new Promise(function (resolve) {
    var settled = false, blocked = false, timer = null;
    function finish(state, error) {
      if (settled) return;
      settled = true;
      if (timer !== null) clearTimeout(timer);
      var result = { indexedDb: state, removedKeys: removed };
      if (error !== undefined) result.error = String(error && error.message ? error.message : error);
      resolve(result);
    }
    if (!name) return finish('skipped');
    if (!factory || typeof factory.deleteDatabase !== 'function') return finish('unavailable');
    var request;
    try { request = factory.deleteDatabase(name); } catch (e) { return finish('error', e); }
    timer = setTimeout(function () { finish(blocked ? 'blocked' : 'timeout'); }, waitMs);
    request.onsuccess = function () { finish('deleted'); };
    request.onerror = function () { finish('error', request.error || 'IndexedDB delete failed'); };
    request.onblocked = function () { blocked = true; };
  });
}
