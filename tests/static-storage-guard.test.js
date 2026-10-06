import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PURGE_PREFIXES, KEEP_PREFIXES, AVATAR_SESSION_KEY, classifyStorageKey, clearEventClientStorage, reconcileLocalStorage, resetStaticStorage,
} from '../web/static-runtime/storage-guard.js';
import { SESSION_KEY, EVENT_STORAGE_KEY, EVENT_OPERATION_PREFIX } from '../web/event-client/controller.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const guardSource = readFileSync(join(root, 'web/static-runtime/storage-guard.js'), 'utf8');

/** localStorage as a browser has it: insertion-ordered, and key(i) / length are live, so removing while walking skips entries. */
class FakeStorage {
  #map = new Map();
  constructor(entries = {}) { for (const [key, value] of Object.entries(entries)) this.setItem(key, value); }
  get length() { return this.#map.size; }
  key(index) { return [...this.#map.keys()][index] ?? null; }
  getItem(key) { return this.#map.has(String(key)) ? this.#map.get(String(key)) : null; }
  setItem(key, value) { this.#map.set(String(key), String(value)); }
  removeItem(key) { this.#map.delete(String(key)); }
  keys() { return [...this.#map.keys()]; }
}

const USER_ID = '2c1b1f3e-7c25-4f55-9f6a-0b9d7a2d5e11';
const session = (id = USER_ID) => JSON.stringify({ token: 'T'.repeat(43), user: { id, name: '小满', avatar: { version: 2 }, revision: 3 } });
/** One key for every purge prefix, one for every keep prefix, and keys that belong to nobody we know. */
const sampleKeys = () => ({
  purge: PURGE_PREFIXES.map(prefix => `${prefix}${prefix.endsWith(':') || prefix.endsWith('-') ? '' : ':'}v1:sample`),
  keep: KEEP_PREFIXES.map(prefix => `${prefix}${prefix.endsWith('-') ? 'sample' : ''}`),
  other: ['some-other-app:v1', 'x-music-space-avatar:v1', 'music-space', 'music-space-ai-v1', 'theme', ''],
});
const filled = () => {
  const { purge, keep, other } = sampleKeys();
  const storage = new FakeStorage();
  for (const key of [...purge, ...keep, ...other].filter(Boolean)) storage.setItem(key, 'value');
  return { storage, purge, keep, other: other.filter(Boolean) };
};

test('the purge and keep lists are exactly the agreed ones', () => {
  assert.deepEqual([...PURGE_PREFIXES], [
    'music-space-avatar', 'music-space-event-', 'music-space-worldcup-', 'music-space-topic-', 'music-space-organization',
    'music-space-game-', 'music-space-corner-', 'music-space-community-', 'music-space-tour:',
  ]);
  assert.deepEqual([...KEEP_PREFIXES], ['music-space-map-', 'music-space:v1', 'music-space-live:v1', 'music-space-duet-seen:v1', 'music-map-']);
  assert.ok(Object.isFrozen(PURGE_PREFIXES) && Object.isFrozen(KEEP_PREFIXES));
  assert.equal(AVATAR_SESSION_KEY, 'music-space-avatar-session:v1');
});

test('no key can be both purged and kept', () => {
  for (const purge of PURGE_PREFIXES) for (const keep of KEEP_PREFIXES) {
    assert.ok(!purge.startsWith(keep) && !keep.startsWith(purge), `${purge} overlaps ${keep}`);
  }
  assert.equal(new Set([...PURGE_PREFIXES, ...KEEP_PREFIXES]).size, PURGE_PREFIXES.length + KEEP_PREFIXES.length, 'duplicates');
});

test('the keys the event client really uses are all purged, and the session key matches the client constant', () => {
  assert.equal(AVATAR_SESSION_KEY, SESSION_KEY);
  for (const key of [SESSION_KEY, EVENT_STORAGE_KEY, EVENT_OPERATION_PREFIX + USER_ID]) assert.equal(classifyStorageKey(key), 'purge', key);
});

test('classifyStorageKey: purge, keep or unknown, by prefix only', () => {
  const { purge, keep, other } = sampleKeys();
  for (const key of purge) assert.equal(classifyStorageKey(key), 'purge', key);
  for (const key of keep) assert.equal(classifyStorageKey(key), 'keep', key);
  for (const key of other) assert.equal(classifyStorageKey(key), null, key);
  assert.equal(classifyStorageKey('music-space-avatar-session:v1'), 'purge');
  assert.equal(classifyStorageKey('music-space-map-return:v1'), 'keep');
  assert.equal(classifyStorageKey('music-space-live:v1'), 'keep');
  assert.equal(classifyStorageKey(undefined), null);
  assert.equal(classifyStorageKey(42), null);
});

test('clearEventClientStorage removes every purge key and nothing else', () => {
  const { storage, purge, keep, other } = filled();
  const removed = clearEventClientStorage(storage);
  assert.deepEqual([...removed].sort(), [...purge].sort());
  assert.deepEqual(storage.keys().sort(), [...keep, ...other].sort());
});

test('clearEventClientStorage walks a snapshot: consecutive purge keys are not skipped as the indexes shift', () => {
  const storage = new FakeStorage();
  for (let index = 0; index < 25; index++) storage.setItem(`music-space-event-operation:v2:${index}`, 'op');
  storage.setItem('music-space-live:v1', 'keep');
  for (let index = 0; index < 25; index++) storage.setItem(`music-space-chat-x${index}`, 'unknown');   // not a purge prefix
  for (let index = 0; index < 25; index++) storage.setItem(`music-space-game-draft:v1:${index}`, 'draft');
  const removed = clearEventClientStorage(storage);
  assert.equal(removed.length, 50);
  assert.equal(storage.length, 26);
  assert.ok(storage.keys().every(key => key === 'music-space-live:v1' || key.startsWith('music-space-chat-x')));
});

test('clearEventClientStorage never throws: no storage, a broken storage, a key that refuses to go', () => {
  assert.deepEqual(clearEventClientStorage(null), []);
  assert.deepEqual(clearEventClientStorage(undefined), []);
  assert.deepEqual(clearEventClientStorage({}), []);
  const blocked = { removeItem() {}, get length() { throw new DOMException('denied', 'SecurityError'); }, key() { return null; } };
  assert.deepEqual(clearEventClientStorage(blocked), []);
  const stubborn = new FakeStorage({ 'music-space-event-client:v1': '1', 'music-space-avatar:v1': '2', 'music-space-live:v1': '3' });
  const original = stubborn.removeItem.bind(stubborn);
  stubborn.removeItem = key => { if (key === 'music-space-event-client:v1') throw new Error('quota'); original(key); };
  assert.deepEqual(clearEventClientStorage(stubborn), ['music-space-avatar:v1']);
  assert.deepEqual(stubborn.keys().sort(), ['music-space-event-client:v1', 'music-space-live:v1']);
});

test('reconcileLocalStorage purges the event client keys when the stored identity is unknown to the database', async () => {
  const { storage, purge, keep, other } = filled();
  storage.setItem(AVATAR_SESSION_KEY, session());
  const asked = [];
  const purged = await reconcileLocalStorage({ storage, hasUser: async id => { asked.push(id); return false; } });
  assert.equal(purged, true);
  assert.deepEqual(asked, [USER_ID]);
  assert.deepEqual(storage.keys().sort(), [...keep, ...other].sort());
  assert.equal(storage.getItem(AVATAR_SESSION_KEY), null);
  assert.ok(purge.every(key => storage.getItem(key) === null));
});

test('reconcileLocalStorage leaves everything alone when the database knows the identity (a plain reload)', async () => {
  const { storage } = filled();
  storage.setItem(AVATAR_SESSION_KEY, session());
  const before = storage.keys().sort();
  assert.equal(await reconcileLocalStorage({ storage, hasUser: async () => true }), false);
  assert.deepEqual(storage.keys().sort(), before);
  assert.equal(await reconcileLocalStorage({ storage, hasUser: () => true }), false, 'a synchronous answer works too');
  assert.deepEqual(storage.keys().sort(), before);
});

test('reconcileLocalStorage does not ask or purge without a readable identity', async () => {
  const cases = {
    'no identity': undefined,
    'not JSON': '{oops',
    'JSON null': 'null',
    'a string': '"abc"',
    'no user': JSON.stringify({ token: 'T' }),
    'user without id': JSON.stringify({ token: 'T', user: { name: 'x' } }),
    'numeric id': JSON.stringify({ token: 'T', user: { id: 7 } }),
    'empty id': JSON.stringify({ token: 'T', user: { id: '' } }),
  };
  for (const [name, value] of Object.entries(cases)) {
    const { storage } = filled();
    if (value !== undefined) storage.setItem(AVATAR_SESSION_KEY, value);
    const before = storage.keys().sort();
    let asked = 0;
    assert.equal(await reconcileLocalStorage({ storage, hasUser: async () => { asked++; return false; } }), false, name);
    assert.equal(asked, 0, `${name}: the database must not be asked`);
    assert.deepEqual(storage.keys().sort(), before, name);
  }
});

test('reconcileLocalStorage never purges on doubt and never rejects', async () => {
  const { storage } = filled();
  storage.setItem(AVATAR_SESSION_KEY, session());
  const before = storage.keys().sort();
  assert.equal(await reconcileLocalStorage({ storage, hasUser: async () => { throw new Error('database closed'); } }), false);
  assert.equal(await reconcileLocalStorage({ storage, hasUser: () => { throw new Error('sync failure'); } }), false);
  assert.equal(await reconcileLocalStorage({ storage }), false, 'no hasUser');
  assert.equal(await reconcileLocalStorage({ storage: null, hasUser: async () => false }), false);
  assert.equal(await reconcileLocalStorage({ storage: { getItem() { throw new DOMException('denied', 'SecurityError'); } }, hasUser: async () => false }), false);
  assert.equal(await reconcileLocalStorage(), false);
  assert.deepEqual(storage.keys().sort(), before);
});

// ---- resetStaticStorage ------------------------------------------------------------------------------------------------------------

/** A stand-in for window.indexedDB whose deleteDatabase answers the way each scenario needs (always asynchronously, like a browser). */
function fakeIndexedDB(behave) {
  const factory = { deleted: [], requests: [],
    deleteDatabase(name) {
      factory.deleted.push(name);
      const request = {};
      factory.requests.push(request);
      setTimeout(() => behave(request), 0);
      return request;
    } };
  return factory;
}

test('resetStaticStorage deletes the database and purges the event client keys, and keeps the others', async () => {
  const { storage, keep, other } = filled();
  const indexedDB = fakeIndexedDB(request => request.onsuccess({}));
  const result = await resetStaticStorage({ idbName: 'music-space-static:pages:v1', storage, indexedDB });
  assert.deepEqual(indexedDB.deleted, ['music-space-static:pages:v1']);
  assert.equal(result.indexedDb, 'deleted');
  assert.equal(result.removedKeys.length, PURGE_PREFIXES.length);
  assert.deepEqual(storage.keys().sort(), [...keep, ...other].sort());
});

test('resetStaticStorage resolves after the timeout when another tab blocks the delete, and says so', async () => {
  const { storage } = filled();
  const indexedDB = fakeIndexedDB(request => request.onblocked({}));
  const started = Date.now();
  const result = await resetStaticStorage({ idbName: 'db', storage, indexedDB, timeoutMs: 40 });
  assert.equal(result.indexedDb, 'blocked');
  assert.ok(Date.now() - started >= 30, 'waited for the timeout');
  assert.equal(result.removedKeys.length, PURGE_PREFIXES.length, 'the keys are cleared even though the database is still pending');
});

test('resetStaticStorage: a blocked delete that completes before the timeout is a success', async () => {
  const indexedDB = fakeIndexedDB(request => { request.onblocked({}); setTimeout(() => request.onsuccess({}), 5); });
  assert.equal((await resetStaticStorage({ idbName: 'db', storage: new FakeStorage(), indexedDB, timeoutMs: 500 })).indexedDb, 'deleted');
});

test('resetStaticStorage does not hang on an IndexedDB that never answers', async () => {
  const indexedDB = fakeIndexedDB(() => {});
  const result = await resetStaticStorage({ idbName: 'db', storage: new FakeStorage(), indexedDB, timeoutMs: 20 });
  assert.equal(result.indexedDb, 'timeout');
});

test('resetStaticStorage reports a failing delete, and a synchronous throw, without rejecting', async () => {
  const failing = fakeIndexedDB(request => { request.error = new Error('UnknownError: disk'); request.onerror({}); });
  const failed = await resetStaticStorage({ idbName: 'db', storage: new FakeStorage(), indexedDB: failing, timeoutMs: 500 });
  assert.equal(failed.indexedDb, 'error');
  assert.match(failed.error, /disk/);
  const throwing = { deleteDatabase() { throw new DOMException('denied', 'SecurityError'); } };
  const thrown = await resetStaticStorage({ idbName: 'db', storage: new FakeStorage(), indexedDB: throwing });
  assert.equal(thrown.indexedDb, 'error');
  assert.match(thrown.error, /denied/);
});

test('resetStaticStorage still clears the keys without IndexedDB, without a name, and with blocked storage', async () => {
  const { storage, purge } = filled();
  const none = await resetStaticStorage({ idbName: 'db', storage, indexedDB: null });
  assert.equal(none.indexedDb, 'unavailable');
  assert.equal(none.removedKeys.length, purge.length);
  const { storage: second } = filled();
  const indexedDB = fakeIndexedDB(request => request.onsuccess({}));
  const nameless = await resetStaticStorage({ storage: second, indexedDB });
  assert.equal(nameless.indexedDb, 'skipped');
  assert.deepEqual(indexedDB.deleted, [], 'no database is guessed');
  assert.equal(nameless.removedKeys.length, purge.length);
  const denied = { get length() { throw new DOMException('denied', 'SecurityError'); }, key() { return null; }, removeItem() {} };
  const blocked = await resetStaticStorage({ idbName: 'db', storage: denied, indexedDB: fakeIndexedDB(request => request.onsuccess({})) });
  assert.deepEqual({ indexedDb: blocked.indexedDb, removedKeys: blocked.removedKeys }, { indexedDb: 'deleted', removedKeys: [] });
  assert.equal((await resetStaticStorage({ idbName: 'db', storage: null, indexedDB: fakeIndexedDB(request => request.onsuccess({})) })).indexedDb, 'deleted');
  assert.equal((await resetStaticStorage()).indexedDb, 'skipped', 'called with nothing at all (Node has neither localStorage nor indexedDB)');
});

test('resetStaticStorage: one key that refuses to go does not stop the others', async () => {
  const { storage, purge, keep, other } = filled();
  const original = storage.removeItem.bind(storage);
  storage.removeItem = key => { if (key === purge[0]) throw new Error('quota'); original(key); };
  const result = await resetStaticStorage({ idbName: 'db', storage, indexedDB: fakeIndexedDB(request => request.onsuccess({})) });
  assert.deepEqual([...result.removedKeys].sort(), purge.slice(1).sort());
  assert.deepEqual(storage.keys().sort(), [purge[0], ...keep, ...other].sort());
});

test('resetStaticStorage waits 1.5 s by default before it stops waiting for a blocked or silent database', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  for (const [answer, expected] of [[request => request.onblocked({}), 'blocked'], [() => {}, 'timeout']]) {
    let result = null;
    const indexedDB = { deleteDatabase() { const request = {}; queueMicrotask(() => answer(request)); return request; } };
    const pending = resetStaticStorage({ idbName: 'db', storage: new FakeStorage(), indexedDB }).then(value => { result = value; });
    await Promise.resolve(); await Promise.resolve();
    t.mock.timers.tick(1499);
    await Promise.resolve(); await Promise.resolve();
    assert.equal(result, null, 'still waiting at 1499 ms');
    t.mock.timers.tick(1);
    await pending;
    assert.equal(result.indexedDb, expected);
  }
});

test('resetStaticStorage falls back to the browser globals when no storage or indexedDB is passed', async () => {
  const saved = { local: Object.getOwnPropertyDescriptor(globalThis, 'localStorage'), idb: Object.getOwnPropertyDescriptor(globalThis, 'indexedDB') };
  const restore = (name, descriptor) => { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; };
  const storage = new FakeStorage({ 'music-space-event-client:v1': '1', 'music-space-live:v1': '2' });
  const indexedDB = fakeIndexedDB(request => request.onsuccess({}));
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'indexedDB', { value: indexedDB, configurable: true, writable: true });
  try {
    const result = await resetStaticStorage({ idbName: 'music-space-static:preview:v1' });
    assert.deepEqual(result, { indexedDb: 'deleted', removedKeys: ['music-space-event-client:v1'] });
    assert.deepEqual(indexedDB.deleted, ['music-space-static:preview:v1']);
    assert.deepEqual(storage.keys(), ['music-space-live:v1']);
  } finally { restore('localStorage', saved.local); restore('indexedDB', saved.idb); }
});

test('resetStaticStorage is self-contained: rebuilt from its own text with no scope it still works', async () => {
  const text = resetStaticStorage.toString();
  assert.match(text, /^function resetStaticStorage\(/, 'a plain function declaration, embeddable in a classic script');
  assert.ok(!/\b(?:import|export|await)\b|=>|\blet\b|\bconst\b|`|\?\.|\?\?/.test(text), 'ES5 syntax only: no module, arrow, let/const, template, optional chaining');
  const detached = new Function(`return (${text});`)();      // no module scope, no closures: a ReferenceError here means something leaked in
  const { storage, keep, other } = filled();
  const indexedDB = fakeIndexedDB(request => request.onsuccess({}));
  const result = await detached({ idbName: 'db', storage, indexedDB });
  assert.equal(result.indexedDb, 'deleted');
  assert.deepEqual(storage.keys().sort(), [...keep, ...other].sort());
});

test('the prefix list repeated inside resetStaticStorage equals PURGE_PREFIXES', () => {
  const text = resetStaticStorage.toString();
  const embedded = [...text.matchAll(/'(music-space[^']*)'/g)].map(match => match[1]);
  assert.deepEqual([...embedded].sort(), [...PURGE_PREFIXES].sort());
  assert.deepEqual(embedded, [...PURGE_PREFIXES], 'same order too, so a diff of the two lists reads cleanly');
});

test('nothing in the module touches Cache Storage (the shared music-space-ai-v1 model cache), in code or at run time', async () => {
  assert.ok(!/\bcaches\b/.test(guardSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')), 'the code does not mention `caches`');
  const had = Object.getOwnPropertyDescriptor(globalThis, 'caches');
  let touched = 0;
  Object.defineProperty(globalThis, 'caches', { configurable: true, get() { touched++; throw new Error('Cache Storage must not be touched'); } });
  try {
    const { storage } = filled();
    storage.setItem(AVATAR_SESSION_KEY, session());
    await reconcileLocalStorage({ storage, hasUser: async () => false });
    clearEventClientStorage(filled().storage);
    await resetStaticStorage({ idbName: 'db', storage: filled().storage, indexedDB: fakeIndexedDB(request => request.onsuccess({})) });
    classifyStorageKey('music-space-ai-v1');
  } finally { if (had) Object.defineProperty(globalThis, 'caches', had); else delete globalThis.caches; }
  assert.equal(touched, 0);
});

// ---- completeness: every `music-space-` literal in the event room code is purged, kept, or explicitly not a storage key ------------------

const SCAN_DIRS = ['web/event-room', 'web/event-client', 'web/avatar', 'web/original-map/js', 'web/shared'];
const SCAN_FILES = /\.(?:js|mjs|cjs|html)$/;
/** Not storage keys. Exact literal, exact file: a storage key that merely starts with one of these must still be classified. */
const NOT_A_STORAGE_KEY = [
  { file: 'web/event-client/identity-backup.js', literal: 'music-space-identity-backup', why: 'magic header of the encrypted identity-backup file' },
  { file: 'web/event-room/corner-panel.js', literal: 'music-space-two-sides.png', why: 'file name of the downloaded two-sides card' },
];

/** `music-space-…` / `music-space:…` runs: the characters a storage key, event name or file name is made of. */
const LITERAL = /music-space(?![A-Za-z0-9])[A-Za-z0-9_.:-]*/g;

/** A literal used as a CSS class or id (class="…", classList.add('…'), a '.music-space-x' selector) is a name in the DOM, not a storage key. */
function inClassContext(text, index) {
  const before = text.slice(Math.max(0, index - 200), index);
  return /(?:^|[^\w$])class(?:Name)?\s*=\s*(["'`])[^"'`]*$/.test(before)
    || /classList\s*\.\s*\w+\s*\([^)]*$/.test(before)
    || /[.#]$/.test(before);
}

function literalsOf(text, file) {
  if (file.endsWith('.css')) return [];       // every name in a stylesheet is a selector
  return [...text.matchAll(LITERAL)].map(match => ({
    literal: match[0], line: text.slice(0, match.index).split('\n').length, classContext: inClassContext(text, match.index),
  }));
}

function* walk(dir) {
  const absolute = join(root, dir);
  if (!existsSync(absolute)) return;     // web/shared arrives with the base-path task
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) { if (entry.name !== 'vendor' && entry.name !== 'node_modules') yield* walk(path); }
    else if (SCAN_FILES.test(entry.name)) yield path;
  }
}

/** null = fine (classified, a class name, or allowlisted for that very file); 'unclassified' = needs a decision. */
function judge(file, { literal, classContext }) {
  if (classifyStorageKey(literal) !== null) return null;
  if (classContext) return null;
  if (NOT_A_STORAGE_KEY.some(entry => entry.file === file && entry.literal === literal)) return null;
  return 'unclassified';
}

test('every music-space- literal under the event room code is purged, kept, or explicitly not a storage key', () => {
  const scanned = [];
  const problems = [];
  const seenAllowed = new Set();
  let literals = 0;
  for (const dir of SCAN_DIRS) for (const file of walk(dir)) {
    scanned.push(file);
    for (const found of literalsOf(readFileSync(join(root, file), 'utf8'), file)) {
      literals++;
      if (NOT_A_STORAGE_KEY.some(entry => entry.file === file && entry.literal === found.literal)) seenAllowed.add(`${file} ${found.literal}`);
      if (judge(file, found)) problems.push(`${file}:${found.line}  ${found.literal}`);
    }
  }
  assert.ok(scanned.length > 50, `scanned only ${scanned.length} files: is ${SCAN_DIRS.join(', ')} still where the sources are?`);
  assert.ok(scanned.some(file => file.startsWith('web/event-client/')) && scanned.some(file => file.startsWith('web/event-room/')), 'scan reached the client and the room');
  assert.ok(literals >= 20, `found only ${literals} music-space- literals: the scanner is not seeing the sources (there are about 35)`);
  assert.deepEqual(problems, [], `a new browser-storage literal needs a decision.\n  A key the event room owns and may lose with the demo data: add its prefix to PURGE_PREFIXES (web/static-runtime/storage-guard.js), to the copy in resetStaticStorage, and to RESCUE_PURGE_PREFIXES in scripts/build/static-html-plugin.mjs.\n  A key another product owns or that must survive: add it to KEEP_PREFIXES.\n  Not a storage key at all (a file name, a magic string): add it to NOT_A_STORAGE_KEY in this test with the reason.\n  Unclassified:\n    ${problems.join('\n    ')}`);
  for (const entry of NOT_A_STORAGE_KEY) assert.ok(seenAllowed.has(`${entry.file} ${entry.literal}`), `stale allowlist entry (the literal is gone from the file, remove it): ${entry.file} ${entry.literal}`);
});

test('the literal scanner: what it finds, and the class-name exemption', () => {
  const text = [
    `const KEY = 'music-space-live:v1';`,
    `const A = \`music-space-worldcup-draft:v1:\${actor}\`;`,
    `<div class="card music-space-card wide"> <p id="x">`,
    `el.classList.add('music-space-badge');`,
    `document.querySelector('.music-space-panel');`,
    `el.className = "music-space-title";`,
    `localStorage.getItem('music-space-brand-new:v1');`,
    `save('music-space-spaceship');`,
    `const camel = 'musicSpace-ignored';`,
    `a.download = 'music-space-two-sides.png';`,
    `const bare = 'music-space';`,
  ].join('\n');
  const found = literalsOf(text, 'x.js');
  assert.deepEqual(found.map(f => f.literal), [
    'music-space-live:v1', 'music-space-worldcup-draft:v1:', 'music-space-card', 'music-space-badge', 'music-space-panel', 'music-space-title',
    'music-space-brand-new:v1', 'music-space-spaceship', 'music-space-two-sides.png', 'music-space',
  ]);
  const verdicts = Object.fromEntries(found.map(f => [f.literal, judge('x.js', f)]));
  assert.deepEqual(verdicts, {
    'music-space-live:v1': null, 'music-space-worldcup-draft:v1:': null,
    'music-space-card': null, 'music-space-badge': null, 'music-space-panel': null, 'music-space-title': null,   // class contexts
    'music-space-brand-new:v1': 'unclassified', 'music-space-spaceship': 'unclassified',
    'music-space-two-sides.png': 'unclassified',      // allowlisted only in its own file
    'music-space': 'unclassified',
  });
  assert.equal(judge('web/event-room/corner-panel.js', { literal: 'music-space-two-sides.png', classContext: false }), null);
  assert.equal(judge('web/event-room/other.js', { literal: 'music-space-two-sides.png', classContext: false }), 'unclassified');
  assert.equal(judge('web/event-client/identity-backup.js', { literal: 'music-space-identity-backup-draft:v1', classContext: false }), 'unclassified', 'a longer key is not covered by the allowlist entry');
  assert.deepEqual(literalsOf('.music-space-x { color: red }', 'style.css'), [], 'stylesheets only hold selectors');
});

test('the scan walks real files: the keys of the storage-using modules are found', () => {
  const byFile = new Map();
  for (const dir of SCAN_DIRS) for (const file of walk(dir)) {
    const literals = literalsOf(readFileSync(join(root, file), 'utf8'), file).map(found => found.literal);
    if (literals.length) byFile.set(file, literals);
  }
  assert.ok(byFile.get('web/event-client/controller.js').includes(SESSION_KEY));
  assert.ok(byFile.get('web/event-client/identity-backup.js').includes('music-space-identity-backup'));
  assert.ok(byFile.get('web/event-room/corner-panel.js').includes('music-space-two-sides.png'));
  assert.ok([...byFile.keys()].every(file => !file.split('/').includes('vendor')), 'third-party code is not scanned');
});
