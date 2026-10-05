import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PURGE_PREFIXES, KEEP_PREFIXES, resetStaticStorage } from '../web/static-runtime/storage-guard.js';

// The rescue overlay (scripts/build/static-html-plugin.mjs) is a classic inline script that has to work when the module graph does not load,
// so it cannot import storage-guard.js. It repeats the purge list instead, and this test is what keeps the two lists from drifting: a prefix
// missing from the rescue copy leaves a stale identity behind after 「重置示例数据」; an extra one would delete another product's data.
const plugin = new URL('../scripts/build/static-html-plugin.mjs', import.meta.url);
const pluginPath = fileURLToPath(plugin);
// The plugin belongs to the static-build task. Until that task has landed in a tree neither file exists and there is nothing to compare;
// from the moment either exists the comparison is mandatory (a static build without the rescue script would be a failure, not a skip).
const staticBuildPresent = existsSync(pluginPath) || existsSync(fileURLToPath(new URL('../vite.static.config.js', import.meta.url)));
const skip = staticBuildPresent ? false : 'the static build (scripts/build/static-html-plugin.mjs) is not in this tree yet';

const loadPlugin = async () => {
  assert.ok(existsSync(pluginPath), 'vite.static.config.js exists but scripts/build/static-html-plugin.mjs does not');
  return import(plugin.href);
};

/** localStorage as a browser has it: insertion-ordered, key(i) and length are live. */
class FakeStorage {
  #map = new Map();
  get length() { return this.#map.size; }
  key(index) { return [...this.#map.keys()][index] ?? null; }
  getItem(key) { return this.#map.has(key) ? this.#map.get(key) : null; }
  setItem(key, value) { this.#map.set(String(key), String(value)); }
  removeItem(key) { this.#map.delete(key); }
  keys() { return [...this.#map.keys()].sort(); }
}
/** One key per purge prefix and per keep prefix, plus bystanders, so a drifting prefix (missing, extra, or matched differently) shows. */
const filledStorage = () => {
  const storage = new FakeStorage();
  for (const prefix of PURGE_PREFIXES) { storage.setItem(`${prefix}:v1:a`, '1'); storage.setItem(`${prefix}-b`, '1'); storage.setItem(`${prefix}`, '1'); }
  for (const prefix of KEEP_PREFIXES) { storage.setItem(`${prefix}x`, '1'); storage.setItem(prefix, '1'); }
  for (const key of ['music-space-ai-v1', 'x-music-space-avatar:v1', 'music-space', 'theme', 'music-space-static:pages:v1']) storage.setItem(key, '1');
  return storage;
};
const fakeIndexedDB = () => {
  const factory = { deleted: [], deleteDatabase(name) { factory.deleted.push(name); const request = {}; setTimeout(() => request.onsuccess({}), 0); return request; } };
  return factory;
};

test('the rescue overlay purges exactly the prefixes the storage guard purges', { skip }, async () => {
  const { RESCUE_PURGE_PREFIXES } = await loadPlugin();
  assert.ok(Array.isArray(RESCUE_PURGE_PREFIXES) && RESCUE_PURGE_PREFIXES.every(prefix => typeof prefix === 'string' && prefix), 'static-html-plugin.mjs must export RESCUE_PURGE_PREFIXES, an array of non-empty strings');
  assert.equal(new Set(RESCUE_PURGE_PREFIXES).size, RESCUE_PURGE_PREFIXES.length, 'duplicates in RESCUE_PURGE_PREFIXES');
  assert.deepEqual([...RESCUE_PURGE_PREFIXES].sort(), [...PURGE_PREFIXES].sort(),
    'RESCUE_PURGE_PREFIXES (scripts/build/static-html-plugin.mjs) and PURGE_PREFIXES (web/static-runtime/storage-guard.js) must list the same prefixes');
});

test('the rescue script text carries every purge prefix and no keep prefix', { skip }, async () => {
  const { rescueScript } = await loadPlugin();
  if (typeof rescueScript !== 'function') return;     // the text is only checkable when the plugin exposes it
  const text = rescueScript();
  for (const prefix of PURGE_PREFIXES) assert.ok(text.includes(JSON.stringify(prefix)), `the rescue script does not purge ${prefix}`);
  for (const prefix of KEEP_PREFIXES) assert.ok(!text.includes(JSON.stringify(prefix)), `the rescue script mentions the kept prefix ${prefix}`);
});

test('running the rescue script and resetStaticStorage on the same browser state leaves the same state', { skip }, async t => {
  const { rescueScript } = await loadPlugin();
  if (typeof rescueScript !== 'function') return;
  for (const pathname of ['/musicSpace/', '/musicSpace/preview/', '/musicSpace/preview/index.html']) {
    const rescueStorage = filledStorage(), rescueIdb = fakeIndexedDB();
    const fakeWindow = {
      location: { pathname, reload() {}, replace() {} }, localStorage: rescueStorage, indexedDB: rescueIdb,
      setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, addEventListener() {},
    };
    const fakeDocument = { body: null, documentElement: null, createElement() { throw new Error('the overlay must not be built just to wipe'); } };
    try { new Function('window', 'document', rescueScript())(fakeWindow, fakeDocument); }
    catch (error) { return t.skip(`the rescue script does not start in a minimal fake window (${error.message}); this cross-check needs the fake brought up to date`); }
    const rescue = fakeWindow.__SPACE_RESCUE__;
    assert.ok(rescue && typeof rescue.wipe === 'function' && typeof rescue.dbName === 'string', 'the rescue script exposes window.__SPACE_RESCUE__.wipe and .dbName');
    await new Promise(done => rescue.wipe(done));

    const guardStorage = filledStorage(), guardIdb = fakeIndexedDB();
    const result = await resetStaticStorage({ idbName: rescue.dbName, storage: guardStorage, indexedDB: guardIdb });

    assert.equal(result.indexedDb, 'deleted', pathname);
    assert.deepEqual(guardStorage.keys(), rescueStorage.keys(), `${pathname}: the two resets must remove the same localStorage keys`);
    assert.deepEqual(guardIdb.deleted, rescueIdb.deleted, `${pathname}: the two resets must delete the same IndexedDB database`);
    assert.deepEqual(guardIdb.deleted, [rescue.dbName]);
    assert.match(rescue.dbName, /^music-space-static:(?:pages|preview):v1$/);
  }
});
