// The boot of the static site (web/static-runtime/boot.js) and the assembly around it: channel, writer lock, store (with the memory fallback),
// runtime, localStorage reconcile, showcase seed, autopilot, the self-heal table, safe mode, read-only copy, reset, pagehide, the QA handle,
// the page's fetch, and the small helpers profile.js composes. Real sql.js, the real runtime / seed / transport / storage guard / lock module,
// a memory store, and a fake window, document, navigator and localStorage. No browser: web/static-runtime/profile.js (the one Vite-specific
// module) is covered by source checks here and by the real-browser run in the QA evidence.
import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  startStaticBoot, bootStaticSite, installStaticFetch, createByteLoader, createSamples, createBootClock, channelOf, idbNameOf,
  TEXT, StaticBootError, IDB_NAME_PREFIX, BOOT_TIMEOUTS,
} from '../web/static-runtime/boot.js';
import { createStaticRuntime, DB_KEY } from '../web/static-runtime/runtime.js';
import { createMemoryStore, openIdbStore } from '../web/static-runtime/idb-store.js';
import { acquireWriterLock } from '../web/static-runtime/single-writer.js';
import { PURGE_PREFIXES, KEEP_PREFIXES, AVATAR_SESSION_KEY, reconcileLocalStorage } from '../web/static-runtime/storage-guard.js';
import { ensureShowcase, META_TABLE, MARKER_KEY } from '../web/static-runtime/showcase/seed.js';
import { createAutopilot } from '../web/static-runtime/showcase/autopilot.js';
import { NPCS, SAMPLE_PHOTOS, SHOWCASE_VERSION } from '../web/static-runtime/showcase/roster.js';
import { copy, MEMORY_ONLY_NOTE, READ_ONLY_NOTE } from '../web/static-runtime/showcase/copy.js';
import { rescueScript } from '../scripts/build/static-html-plugin.mjs';

/** Every test has a deadline: a boot that waits for itself must fail the test, not hang the suite. */
const test = (name, fn) => nodeTest(name, { timeout: 30_000 }, fn);
const here = new URL('../', import.meta.url);
const root = fileURLToPath(here);
const SQL = await createRequire(import.meta.url)('sql.js')();
const migrations = readdirSync(new URL('runtime-preview/drizzle/', here)).filter(name => name.endsWith('.sql')).sort()
  .map(name => ({ name, sql: readFileSync(new URL(`runtime-preview/drizzle/${name}`, here), 'utf8') }));
const BUILD = { version: '0.22.0-test', commit: 'abc1234', builtAt: '2026-10-05T12:00:00.000Z', buildAtMs: Date.parse('2026-10-05T12:00:00.000Z') };
const AVATAR = { version: 2, skin: 1, hair: 0, hairColor: 0, outfit: 0, accessory: 'headphones', pose: 'sway', top: 0, bottom: 0, shoes: 1, eyewear: 0, topColor: 0, bottomColor: 1, shoeColor: 0, expression: 'neutral' };

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
/** Waits for a condition instead of guessing how long the machine needs. */
async function until(condition, what, timeoutMs = 4000) {
  const deadline = Date.now() + timeoutMs;
  while (!(await condition())) { if (Date.now() > deadline) assert.fail(`timed out waiting for ${what}`); await sleep(2); }
}
/** The code of a source file without its comments (the header comments talk about the very things the code must not do). */
const codeOf = file => readFileSync(join(root, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
const assetCache = new Map();
/** The site-relative path the seed asks for ('demo/yao-stage.jpg') read from web/static-runtime/demo-assets. */
async function readAsset(path) {
  if (!assetCache.has(path)) assetCache.set(path, new Uint8Array(readFileSync(new URL(`web/static-runtime/${path.replace(/^demo\//, 'demo-assets/')}`, here))));
  return assetCache.get(path);
}

// ---- a fake browser --------------------------------------------------------------------------------------------------------------------

class FakeElement {
  constructor(tag, document, text = '') {
    this.tagName = String(tag).toUpperCase(); this.document = document; this.children = []; this.parentNode = null;
    this.style = {}; this.attributes = {}; this.dataset = {}; this.listeners = {}; this.id = ''; this._text = text; this.classes = new Set();
    this.classList = { add: name => this.classes.add(name), remove: name => this.classes.delete(name), contains: name => this.classes.has(name) };
  }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  set textContent(value) { this._text = String(value); this.children = []; this.document?.onText?.(this, this._text); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  removeChild(child) { this.children = this.children.filter(item => item !== child); child.parentNode = null; return child; }
  addEventListener(type, handler) { (this.listeners[type] ||= []).push(handler); }
  click() { for (const handler of this.listeners.click ?? []) handler({ target: this }); }
  focus() {}
  find(predicate) { return [this, ...this.children.flatMap(child => child.find(predicate))].filter(predicate); }
}

class FakeDocument {
  constructor() {
    this.documentElement = new FakeElement('html', this);
    this.body = new FakeElement('body', this);
    this.visibilityState = 'visible';
    this.listeners = {};
    this.status = new FakeElement('span', this, '正在打开现场');
    this.loadingSmall = new FakeElement('small', this, '正在准备三维场景');
    this.toastNode = new FakeElement('div', this);
    this.known = new Map([['#render-status', this.status], ['#loading small', this.loadingSmall], ['#toast', this.toastNode]]);
  }
  createElement(tag) { return new FakeElement(tag, this); }
  querySelector(selector) { return this.known.get(selector) ?? null; }
  addEventListener(type, handler) { (this.listeners[type] ||= new Set()).add(handler); }
  removeEventListener(type, handler) { this.listeners[type]?.delete(handler); }
  dispatch(type) { for (const handler of [...(this.listeners[type] ?? [])]) handler({ type }); }
  banner() { return this.body.children.find(child => child.id === 'space-boot-banner') ?? null; }
}

class FakeWindow extends EventTarget {
  constructor(pathname = '/musicSpace/') {
    super();
    this.location = { pathname, search: '', hash: '', replaced: [], replace(url) { this.replaced.push(url); } };
    this.history = { states: [], replaceState: (state, title, url) => this.history.states.push(url) };
    this.bootLog = [];
    let boot;
    Object.defineProperty(this, '__SPACE_BOOT__', { enumerable: true, configurable: true, get: () => boot, set: value => { boot = value; this.bootLog.push(value); this.onBoot?.(value); } });
  }
}

/** localStorage as a browser has it: insertion-ordered, key(i) and length are live. */
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

/** navigator.locks with the semantics the boot relies on: exclusive per name, ifAvailable answers null while somebody holds it. */
function fakeLocks({ busy = false, fail = null } = {}) {
  const locks = {
    held: new Set(), requests: 0,
    async request(name, options, callback) {
      assert.equal(options?.ifAvailable, true, 'the boot never waits for a lock another tab holds');
      locks.requests += 1;
      if (fail) throw fail;
      if (busy || locks.held.has(name)) return callback(null);
      locks.held.add(name);
      try { return await callback({ name }); } finally { locks.held.delete(name); }
    },
  };
  return locks;
}

/** A store that looks like IndexedDB (persistent) over a Map, and counts and can break what the boot does to it. */
function spyStore(base = createMemoryStore()) {
  const spy = {
    base, persistent: true, name: 'spy', puts: 0, blobPuts: 0, clears: 0, deletes: 0, closes: 0, failPuts: null, failGet: null, failClear: null, hangClear: false,
    async get(area, key) { if (spy.failGet && area === 'kv') throw spy.failGet; return base.get(area, key); },
    async put(area, key, value) {
      if (area === 'kv') { spy.puts += 1; if (spy.failPuts) throw spy.failPuts; } else spy.blobPuts += 1;
      return base.put(area, key, value);
    },
    async delete(area, key) { spy.deletes += 1; return base.delete(area, key); },
    keys: area => base.keys(area),
    async clear() { spy.clears += 1; if (spy.failClear) throw spy.failClear; if (spy.hangClear) await new Promise(() => {}); return base.clear(); },
    close() { spy.closes += 1; },
    reset() { Object.assign(spy, { puts: 0, blobPuts: 0, clears: 0, deletes: 0, closes: 0 }); },
  };
  return spy;
}

const stubAutopilot = (options, order) => ({
  options, started: 0, stopped: 0,
  start() { this.started += 1; order?.push('autopilot.start'); },
  stop() { this.stopped += 1; },
  get state() { return { running: this.started > this.stopped, stopped: this.stopped > 0, ticks: 0, requests: 0, mutations: 0, failures: 0 }; },
});

/**
 * Everything a boot needs, with the real modules and recorders. `autopilot: 'stub'` (default) keeps the cast quiet; 'real' runs the real one.
 * Returns the env; env.boot(extraDeps) starts and awaits a boot (disposed when the test ends), env.start(extraDeps) only starts it.
 */
function makeEnv(t, { pathname = '/musicSpace/', store = spyStore(), locks = fakeLocks(), local = new FakeStorage(), autopilot = 'stub', now } = {}) {
  const win = new FakeWindow(pathname), doc = new FakeDocument();
  const env = { win, doc, store, locks, local, order: [], pilots: [], sites: [], seeds: 0, runtimes: [], opened: [], shown: [] };
  win.onBoot = value => env.order.push(`boot:${value}`);
  let channelValue;
  Object.defineProperty(doc.documentElement.dataset, 'channel', { enumerable: true, configurable: true, get: () => channelValue, set: value => { channelValue = value; env.order.push('channel'); } });
  doc.onText = (element, text) => { if (element === doc.status && text === TEXT.preparing) env.order.push('status'); };
  win.__SPACE_RESCUE__ = { show: reason => env.shown.push(reason) };
  env.deps = {
    SQL, migrations, build: BUILD, window: win, document: doc, navigator: { locks }, localStorage: local,
    ...(now ? { now } : {}),
    lockOptions: { retries: 1, delayMs: 1 },
    castNames: NPCS.map(npc => npc.name),
    openStore: async name => { env.order.push('openStore'); env.opened.push(name); return store; },
    fetchBytes: readAsset,
    acquireWriterLock: async options => { env.order.push('lock'); return acquireWriterLock(options); },
    reconcile: async options => { env.order.push('reconcile'); return reconcileLocalStorage(options); },
    createRuntime: async options => { env.order.push('createRuntime'); const runtime = await createStaticRuntime(options); env.runtimes.push(runtime); return runtime; },
    ensureShowcase: async options => { env.order.push('ensureShowcase'); env.seeds += 1; return ensureShowcase(options); },
    createAutopilot: options => {
      env.order.push('createAutopilot');
      const pilot = autopilot === 'real' ? createAutopilot(options) : stubAutopilot(options, env.order);
      pilot.options = options;
      env.pilots.push(pilot);
      return pilot;
    },
  };
  env.start = (extra = {}) => { const started = startStaticBoot({ ...env.deps, ...extra }); env.sites.push(started.site); return started; };
  env.boot = async (extra = {}) => { const started = env.start(extra); await started.ready; return started.site; };
  t.after(async () => { for (const site of env.sites) await site.dispose().catch(() => {}); });
  return env;
}

/** Another boot that can seed: the same store and localStorage, a new page (window and document). */
const nextPage = (t, env, options = {}) => makeEnv(t, { store: env.store, local: env.local, ...options });

/** The page's fetch as the profile builds it, for one boot. */
function pageFetch(started, nativeFetch = async () => { throw new Error('the network must not be used'); }) {
  const target = {};
  const { staticFetch } = installStaticFetch({ target, getRuntime: () => started.ready.then(site => site.runtime), nativeFetch });
  return staticFetch;
}
const json = async response => ({ status: response.status, body: await response.json() });

// ---- channel and names -------------------------------------------------------------------------------------------------------------------

test('the channel is the preview only when the path ends with /preview/, and names its own database', () => {
  assert.equal(channelOf('/musicSpace/preview/'), 'preview');
  assert.equal(channelOf('/preview/'), 'preview');
  for (const path of ['/musicSpace/', '/', '/musicSpace/preview', '/musicSpace/preview/index.html', '/musicSpace/preview/x/', '/musicSpace/previews/', '', undefined, null]) assert.equal(channelOf(path), 'pages', String(path));
  assert.equal(IDB_NAME_PREFIX, 'music-space-static');
  assert.equal(idbNameOf('pages'), 'music-space-static:pages:v1');
  assert.equal(idbNameOf('preview'), 'music-space-static:preview:v1');
});

test('the boot and the rescue overlay name the same database for every path (its 「重置示例数据」 must delete what the boot opened)', () => {
  for (const pathname of ['/musicSpace/', '/musicSpace/preview/', '/', '/preview/', '/musicSpace/preview', '/musicSpace/preview/index.html', '/a/b/c/', '/musicSpace/classic/']) {
    const win = new FakeWindow(pathname), doc = new FakeDocument();
    win.setTimeout = () => 0; win.setInterval = () => 0; win.clearInterval = () => {};
    new Function('window', 'document', rescueScript())(win, doc);
    assert.equal(win.__SPACE_RESCUE__.dbName, idbNameOf(channelOf(pathname)), pathname);
    assert.equal(win.__SPACE_RESCUE__.channel, channelOf(pathname), pathname);
  }
});

test('the two banners and the status line are the words the About panel and the copy file use', () => {
  assert.equal(TEXT.memoryOnly, MEMORY_ONLY_NOTE);
  assert.equal(TEXT.readOnly, READ_ONLY_NOTE);
  assert.equal(TEXT.preparing, copy.statusPreparing);
  assert.equal(TEXT.memoryOnly, '示例数据只保存在本页，刷新会重置');
  assert.equal(TEXT.readOnly, '示例已在另一个标签页打开，这里不能操作');
  assert.equal(TEXT.healed, '示例已更新，已为你重新布置');
});

test('the marker the read-only tab reads is the one the seed writes', () => {
  const bootSource = readFileSync(join(root, 'web/static-runtime/boot.js'), 'utf8');
  assert.ok(bootSource.includes(`const META_TABLE = '${META_TABLE}'`));
  assert.ok(bootSource.includes(`const MARKER_KEY = '${MARKER_KEY}'`));
});

// ---- the sequence --------------------------------------------------------------------------------------------------------------------------

test('step order: channel, lock, store, runtime, reconcile, status, seed, autopilot, ready', async t => {
  const env = makeEnv(t);
  const site = await env.boot();
  assert.deepEqual(env.order, ['boot:booting', 'channel', 'lock', 'openStore', 'createRuntime', 'reconcile', 'status', 'ensureShowcase', 'createAutopilot', 'autopilot.start', 'boot:ready']);
  assert.equal(env.win.__SPACE_BOOT__, 'ready');
  assert.deepEqual(env.win.bootLog, ['booting', 'ready']);
  assert.equal(site.phase, 'ready');
  assert.deepEqual(site.trace.map(([step]) => step), ['channel', 'lock', 'store', 'sql', 'runtime', 'reconcile', 'status', 'seed', 'ready']);
  for (const key of ['lockMs', 'storeMs', 'runtimeMs', 'seedMs', 'totalMs']) assert.ok(Number.isFinite(site.timings[key]) && site.timings[key] >= 0, key);
});

test('a first boot lays the world out once: one snapshot write, the four photos, the showcase room and four identities', async t => {
  const env = makeEnv(t);
  const site = await env.boot();
  assert.equal(site.fresh, true);
  assert.equal(site.healed, false);
  assert.equal(site.writable, true);
  assert.equal(site.persistent, true);
  assert.equal(site.lockReason, 'acquired');
  assert.equal(env.store.puts, 1, 'the whole seed is stored once');
  assert.equal(env.store.blobPuts, 4);
  assert.match(site.roomCode, /^[A-Z2-7]{12}$/);
  assert.equal(site.castIds.length, 4);
  assert.deepEqual(site.world.castNames.sort(), NPCS.map(npc => npc.name).sort());
  const marker = await site.runtime.env.DB.prepare(`SELECT value FROM ${META_TABLE} WHERE key = ?`).bind(MARKER_KEY).first('value');
  assert.equal(JSON.parse(marker).version, SHOWCASE_VERSION);
});

test('the status line and the loading screen say the room is being laid out while it is, and the loading words come back afterwards', async t => {
  const env = makeEnv(t);
  const seen = [];
  env.deps.ensureShowcase = async options => { seen.push([env.doc.status.textContent, env.doc.loadingSmall.textContent]); return ensureShowcase(options); };
  await env.boot();
  assert.deepEqual(seen, [['正在布置示例现场…', '正在布置示例现场…']]);
  assert.equal(env.doc.loadingSmall.textContent, '正在准备三维场景', 'the loading screen is the 3D scene\'s again');
});

test('a page without the status elements, the toast or a body still boots', async t => {
  const env = makeEnv(t);
  env.doc.known.clear();
  env.doc.body = undefined;
  const site = await env.boot();
  assert.equal(site.phase, 'ready');
});

test('a second boot on the same store seeds nothing: same room, same cast, no write', async t => {
  const env = makeEnv(t);
  const first = await env.boot();
  const { roomCode, castIds } = first;
  assert.equal(env.store.puts, 1);
  await first.dispose();
  env.store.reset();
  const second = await env.boot();
  assert.equal(second.fresh, false, 'nothing was laid out this time');
  assert.equal(second.roomCode, roomCode);
  assert.deepEqual(second.castIds, castIds);
  assert.equal(env.store.puts + env.store.blobPuts + env.store.clears, 0, 'a reload writes and wipes nothing');
  assert.equal(second.healed, false);
});

test('seeding goes through its own transport; the page transport waits for the boot (a seed that waited for itself would hang)', async t => {
  const env = makeEnv(t);
  let answered = 'not asked', pageStillWaiting = null, early = null;
  env.deps.ensureShowcase = async options => {
    answered = await Promise.race([options.transport('/api/event/health').then(response => response.status), sleep(3000).then(() => 'deadlock')]);
    pageStillWaiting = early.state === 'pending';
    return ensureShowcase(options);
  };
  const started = env.start();
  const staticFetch = pageFetch(started);
  early = { state: 'pending' };
  const request = staticFetch('/api/event/health').then(response => { early.state = 'answered'; return response; });
  await started.ready;
  assert.equal(answered, 200, 'the seed\'s transport answered while the boot was still running');
  assert.equal(pageStillWaiting, true, 'the page\'s transport was still waiting for the boot');
  assert.equal((await request).status, 200, 'and it answers once the boot is ready');
});

test('the seed\'s transport never reaches the network: an address that is not the room API is refused', async t => {
  const env = makeEnv(t);
  let outcome = null;
  env.deps.ensureShowcase = async options => {
    outcome = await options.transport('https://example.test/photo.jpg').then(() => 'fetched', error => error.message);
    return ensureShowcase(options);
  };
  await env.boot();
  assert.match(outcome, /only answers \/api\/event and \/api\/avatar/);
});

test('the cast photos are read through fetchBytes as demo/<file>, only the first time', async t => {
  const env = makeEnv(t);
  const asked = [];
  env.deps.fetchBytes = async path => { asked.push(path); return readAsset(path); };
  const first = await env.boot();
  assert.deepEqual(asked.sort(), ['demo/bei-balcony.jpg', 'demo/man-crowd.jpg', 'demo/man-near.jpg', 'demo/yao-stage.jpg']);
  await first.dispose();
  asked.length = 0;
  await env.boot();
  assert.deepEqual(asked, [], 'a world that exists needs no photo');
});

test('navigator.storage.persist() is never called (Firefox would ask the visitor), and the sources never mention it', async t => {
  let persistCalls = 0;
  const env = makeEnv(t);
  env.deps.navigator = { locks: env.locks, storage: { persist: () => { persistCalls += 1; return true; }, persisted: () => false, estimate: async () => ({}) } };
  await env.boot();
  assert.equal(persistCalls, 0);
  for (const file of ['boot.js', 'profile.js']) assert.equal(/navigator\.storage|\.persist\(/.test(codeOf(`web/static-runtime/${file}`)), false, `${file} calls storage.persist()`);
});

test('a world laid out by this load drops a stale ?room= from the address (and keeps the other parameters and the hash); a world that existed does not', async t => {
  const env = makeEnv(t);
  env.win.location.search = '?v=1&room=OLDCODE12345';
  env.win.location.hash = '#x';
  const first = await env.boot();
  assert.equal(first.fresh, true);
  assert.deepEqual(env.win.history.states, ['/musicSpace/?v=1#x'], 'a link or a reload from before the world existed');
  await first.dispose();

  const again = nextPage(t, env);
  again.win.location.search = `?room=${first.roomCode}`;
  const second = await again.boot();
  assert.equal(second.fresh, false);
  assert.deepEqual(again.win.history.states, [], 'the room exists: the address is left alone');

  const plain = makeEnv(t);
  plain.win.location.search = '?v=1';
  await plain.boot();
  assert.deepEqual(plain.win.history.states, [], 'nothing to drop');

  const healed = makeEnv(t);
  await healed.store.put('kv', DB_KEY, { bytes: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]), savedAt: 1, format: 1 });
  healed.win.location.search = '?room=THEROOMBEFORE';
  const site = await healed.boot();
  assert.equal(site.healed, true);
  assert.deepEqual(healed.win.history.states, ['/musicSpace/'], 'after a self-heal the old room is gone: the lobby, not an error');

  const noHistory = makeEnv(t);
  noHistory.win.location.search = '?room=X';
  delete noHistory.win.history;
  assert.equal((await noHistory.boot()).phase, 'ready', 'a window without history is not a failed boot');
});

test('a clock behind the build cannot freeze the cast: the gap is carried and the clock keeps moving', async t => {
  let device = Date.parse('2020-01-01T00:00:00Z');
  const env = makeEnv(t, { now: () => device });
  const site = await env.boot();                 // the seed would throw INVALID_TAKEN_AT on a clock before 2026-09-25
  assert.equal(site.phase, 'ready');
  const start = site.clock();
  assert.ok(start >= BUILD.buildAtMs && start < BUILD.buildAtMs + 5000, 'starts at the build time');
  device += 7000;
  assert.equal(site.clock() - start, 7000, 'and moves at the device\'s pace (a frozen clock would never find a request old enough to answer)');
  const ahead = createBootClock({ buildAtMs: BUILD.buildAtMs, now: () => BUILD.buildAtMs + 12_345 });
  assert.equal(ahead(), BUILD.buildAtMs + 12_345, 'a device that is ahead is trusted');
  const broken = createBootClock({ buildAtMs: BUILD.buildAtMs, now: () => NaN });
  assert.equal(broken(), BUILD.buildAtMs);
  assert.throws(() => createBootClock({ now: () => 1 }), TypeError);
});

// ---- the cast ----------------------------------------------------------------------------------------------------------------------------

test('the autopilot starts once, with the cast, the room and the runtime\'s own clock, and only when the tab is the writer', async t => {
  const env = makeEnv(t);
  const site = await env.boot();
  assert.equal(env.pilots.length, 1);
  const [pilot] = env.pilots;
  assert.equal(pilot.started, 1);
  assert.deepEqual(Object.keys(pilot.options.people).sort(), ['bei', 'lin', 'man', 'yao']);
  assert.equal(pilot.options.room.code, site.roomCode);
  assert.equal(pilot.options.now, site.clock, 'the same clock as the runtime: server timestamps and the autopilot agree on "now"');
  assert.equal(pilot.options.document, env.doc);
  assert.equal(typeof pilot.options.onChange, 'function');
  assert.equal(site.autopilot, pilot);
});

test('what the cast changes reaches the page at once, and a burst is answered with one more refresh at the end', async t => {
  const env = makeEnv(t);
  let refreshes = 0;
  env.deps.notifyChanged = () => { refreshes += 1; };
  env.deps.timeouts = { coalesceMs: 25 };
  await env.boot();
  const { onChange } = env.pilots[0].options;
  onChange(); onChange(); onChange();
  assert.equal(refreshes, 1, 'the first change refreshes the page without waiting');
  await until(() => refreshes === 2, 'the trailing refresh');
  await sleep(80);
  assert.equal(refreshes, 2, 'three changes made two refreshes, not three');
  onChange();
  assert.equal(refreshes, 3, 'a later change starts a new window');
});

test('an autopilot that cannot be created does not fail the boot (the demo works, nobody answers) and the QA state says so', async t => {
  const env = makeEnv(t);
  env.deps.createAutopilot = () => { throw new TypeError('no cast'); };
  const site = await env.boot();
  assert.equal(site.phase, 'ready');
  assert.equal(env.win.__SPACE_BOOT__, 'ready');
  assert.match(site.autopilotError.message, /no cast/);
  assert.equal(site.autopilot, null);
  assert.equal(site.stats().autopilot, null);
});

test('with the real autopilot the cast is reading the room within a moment, and stats() shows it', async t => {
  const env = makeEnv(t, { autopilot: 'real' });
  const site = await env.boot();
  await until(() => site.stats().autopilot?.ticks >= 1, 'the first autopilot tick');
  const stats = site.stats();
  assert.equal(stats.autopilot.running, true);
  assert.equal(stats.autopilot.mutations, 0, 'nobody is here but the cast: it reads and writes nothing');
  assert.equal(stats.puts, 1, 'and an idle tick does not write a snapshot');
});

// ---- reading and writing: the QA handle ----------------------------------------------------------------------------------------------------

test('window.__SPACE_STATIC__ exists from the first moment, is a live view and carries no token, no runtime and no photo bytes', async t => {
  const env = makeEnv(t);
  const started = env.start();
  const handle = env.win.__SPACE_STATIC__;
  assert.ok(handle, 'published before the boot finished');
  assert.equal(handle.phase, 'booting');
  assert.equal(handle.channel, 'pages');
  assert.equal(handle.idbName, 'music-space-static:pages:v1');
  assert.equal(env.doc.documentElement.dataset.channel, 'pages');
  const site = await started.ready;
  assert.deepEqual(Object.keys(handle).sort(), ['build', 'castIds', 'channel', 'fresh', 'healed', 'idbName', 'lockReason', 'memoryOnly', 'persistent', 'phase', 'reset', 'roomCode', 'stats', 'timings', 'writable']);
  assert.equal(handle.phase, 'ready');
  assert.equal(handle.writable, true);
  assert.equal(handle.persistent, true);
  assert.equal(handle.fresh, true);
  assert.equal(handle.roomCode, site.roomCode);
  assert.deepEqual(handle.build, BUILD);
  const tokens = Object.values(env.pilots[0].options.people).map(person => person.token);
  assert.equal(tokens.length, 4);
  const everything = JSON.stringify([handle, site.world, site.stats(), site.timings, site.trace, site.build]);
  for (const token of tokens) assert.ok(!everything.includes(token), 'a token leaked into the QA state');
  assert.doesNotMatch(everything, /token|bytes|dataUrl|data:image/i);
});

test('stats() counts snapshot writes: one per acknowledged change, none for reads (200 polls = 0 puts)', async t => {
  const env = makeEnv(t);
  const started = env.start();
  const staticFetch = pageFetch(started);
  const site = await started.ready;
  const before = site.stats();
  assert.equal(before.puts, 1);
  assert.equal(before.blobPuts, 4);
  assert.equal(before.failedPuts, 0);
  assert.ok(Number.isFinite(before.lastPutAt));
  for (let i = 0; i < 200; i += 1) assert.equal((await staticFetch(`/api/event/health`)).status, 200);
  assert.equal(site.stats().puts, 1, 'reads write nothing');
  const made = await staticFetch('/api/avatar/session', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'visitor-session-key-0001' }, body: JSON.stringify({ name: '访客1', avatar: AVATAR }) });
  assert.equal(made.status, 201);
  assert.equal(site.stats().puts, 2, 'a mutation is stored before it is acknowledged');
  assert.ok(site.stats().lastPutAt >= before.lastPutAt);
});

// ---- the page's fetch ---------------------------------------------------------------------------------------------------------------------

test('the page\'s fetch never reaches the native one for /api/event or /api/avatar (spy), and passes everything else through untouched', async t => {
  const env = makeEnv(t);
  const started = env.start();
  const calls = [];
  const native = async (...args) => { calls.push(args); return new Response('native', { status: 200 }); };
  const target = { fetch: native };
  const { staticFetch } = installStaticFetch({ target, getRuntime: () => started.ready.then(site => site.runtime) });
  assert.equal(target.fetch, staticFetch, 'installed on the target');
  await started.ready;
  const api = [
    '/api/event/health', 'http://localhost:4783/api/event/health', 'https://musicmapteam.github.io/api/event/health', './api/event/health',
    '/musicSpace/api/event/health', 'https://example.test/api/event/health?x=1',
  ];
  for (const url of api) assert.equal((await staticFetch(url, { cache: 'no-store' })).status, 200, url);
  for (const url of ['/api/avatar/session', '/api/event/rooms/ABCDEFGHIJKL', 'https://musicmapteam.github.io/api/avatar/nope']) {
    const response = await staticFetch(url);
    assert.notEqual(await response.text(), 'native', `${url} was answered by the network`);
  }
  assert.equal((await staticFetch(new Request('https://example.test/api/event/health'))).status, 200);
  assert.equal(calls.length, 0, `the native fetch was called for an API path: ${JSON.stringify(calls[0])}`);
  const through = ['https://example.test/demo/yao-stage.jpg', './sql/sql-wasm.wasm', 'data:text/plain;base64,L2FwaS9ldmVudC9oZWFsdGg=', 'blob:https://example.test/0b1c', '/api/live/health'];
  for (const url of through) await staticFetch(url, { credentials: 'same-origin' });
  assert.deepEqual(calls.map(([url]) => url), through, 'every other request goes to the network, the very same arguments');
  assert.deepEqual(calls.map(([, init]) => init), through.map(() => ({ credentials: 'same-origin' })));
});

test('installStaticFetch defaults to the target\'s own fetch as the native one', async () => {
  let seen = null;
  const target = { fetch: async url => { seen = url; return new Response('ok'); } };
  const { staticFetch, nativeFetch } = installStaticFetch({ target, getRuntime: () => { throw new Error('no runtime needed'); } });
  await staticFetch('https://example.test/a.txt');
  assert.equal(seen, 'https://example.test/a.txt');
  assert.equal(typeof nativeFetch, 'function');
  assert.notEqual(target.fetch, nativeFetch);
});

// ---- the writer lock and the read-only copy -----------------------------------------------------------------------------------------------

test('a tab that does not get the lock is a read-only copy: no seed, no autopilot, no write, no wipe, and mutations answer READ_ONLY_COPY', async t => {
  const writer = makeEnv(t);
  const first = await writer.boot();
  const { roomCode, castIds } = first;
  await first.dispose();
  writer.store.reset();
  writer.local.setItem(PURGE_PREFIXES[1] + 'draft', '{"a":1}');
  writer.local.setItem(KEEP_PREFIXES[1], 'kept');
  const before = JSON.stringify(await writer.store.base.get('kv', DB_KEY), (key, value) => (value instanceof Uint8Array ? [...value.slice(0, 16), value.length] : value));

  const copyTab = nextPage(t, writer, { locks: fakeLocks({ busy: true }) });
  const writableCalls = [];
  copyTab.deps.createRuntime = async options => {
    copyTab.order.push('createRuntime');
    assert.equal(options.writable, false, 'created read-only');
    assert.equal(options.persist, false, 'and told not to persist');
    const runtime = await createStaticRuntime(options);
    const setWritable = runtime.setWritable;
    runtime.setWritable = value => { writableCalls.push(value); return setWritable(value); };
    return runtime;
  };
  const started = copyTab.start();
  const staticFetch = pageFetch(started);
  const site = await started.ready;
  assert.equal(site.phase, 'ready');
  assert.equal(copyTab.win.__SPACE_BOOT__, 'ready', 'the page works as a view');
  assert.deepEqual(writableCalls, [false], 'runtime.setWritable(false)');
  assert.equal(site.writable, false);
  assert.equal(site.lockReason, 'busy');
  assert.equal(copyTab.seeds, 0, 'no seeding');
  assert.equal(copyTab.pilots.length, 0, 'no autopilot');
  assert.equal(site.autopilot, null);
  assert.equal(site.fresh, false);
  assert.equal(site.healed, false);
  assert.equal(site.roomCode, roomCode, 'the room is read from the marker the other tab wrote');
  assert.deepEqual(site.castIds.sort(), [...castIds].sort(), 'and the cast by name');
  assert.equal((await staticFetch('/api/event/health')).status, 200, 'reading works');
  const refused = await json(await staticFetch('/api/avatar/session', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'visitor-session-key-0002' }, body: JSON.stringify({ name: '访客2', avatar: AVATAR }) }));
  assert.equal(refused.status, 409);
  assert.equal(refused.body.error.code, 'READ_ONLY_COPY');
  assert.equal(writer.store.puts + writer.store.blobPuts + writer.store.clears + writer.store.deletes, 0, 'nothing was written, cleared or deleted');
  assert.equal(JSON.stringify(await writer.store.base.get('kv', DB_KEY), (key, value) => (value instanceof Uint8Array ? [...value.slice(0, 16), value.length] : value)), before, 'the snapshot is the first tab\'s, untouched');
  assert.equal(writer.local.getItem(PURGE_PREFIXES[1] + 'draft'), '{"a":1}', 'the first tab\'s keys are not touched');
  assert.equal(site.persistent, true, 'the data is in IndexedDB; the other tab saves it');
  assert.equal(copyTab.win.__SPACE_STATIC__.writable, false);
  assert.equal(started.site.stats().puts, 0);
});

test('a read-only tab shows its banner, a dismiss button, and 44 px targets; the writer shows none', async t => {
  const writer = makeEnv(t);
  await (await writer.boot()).dispose();
  const tab = nextPage(t, writer, { locks: fakeLocks({ busy: true }) });
  await tab.boot();
  const banner = tab.doc.banner();
  assert.ok(banner, 'a banner is on the page');
  assert.equal(banner.textContent, `${TEXT.readOnly}${TEXT.dismiss}`);
  assert.equal(banner.getAttribute('role'), 'status');
  assert.equal(banner.getAttribute('data-kind'), 'read-only');
  assert.match(banner.style.cssText, /min-height:44px/);
  const [, button] = banner.children;
  assert.equal(button.tagName, 'BUTTON');
  assert.match(button.style.cssText, /min-height:44px/);
  assert.match(button.style.cssText, /min-width:44px/);
  assert.match(banner.style.cssText, /font:14px/, 'body text is 14 px');
  button.click();
  assert.equal(tab.doc.banner(), null, 'dismissed');
  const quiet = makeEnv(t);
  await quiet.boot();
  assert.equal(quiet.doc.banner(), null, 'the writer has nothing to say');
});

test('no Locks API at all, or a Locks API that breaks, is treated as the only tab: writable', async t => {
  const none = makeEnv(t);
  none.deps.navigator = {};
  const site = await none.boot();
  assert.equal(site.writable, true);
  assert.equal(site.lockReason, 'unsupported');
  assert.equal(none.seeds, 1);
  assert.equal(none.doc.banner(), null);

  const absent = makeEnv(t);
  absent.deps.navigator = undefined;
  assert.equal((await absent.boot()).writable, true);

  const broken = makeEnv(t, { locks: fakeLocks({ fail: new DOMException('denied', 'SecurityError') }) });
  const open = await broken.boot();
  assert.equal(open.writable, true, 'a lock that cannot be asked must not turn a working demo into a read-only one');
  assert.equal(open.lockReason, 'error');
});

test('a tab that was waiting for a previous document\'s lock takes it when it is let go (a reload, the return from the Map)', async t => {
  const locks = fakeLocks();
  locks.held.add('music-space-static-writer');
  setTimeout(() => locks.held.delete('music-space-static-writer'), 15);
  const env = makeEnv(t, { locks });
  env.deps.lockOptions = { retries: 40, delayMs: 5 };
  const site = await env.boot();
  assert.equal(site.writable, true);
  assert.ok(locks.requests >= 2, 'it asked again');
});

test('reset is refused in a read-only tab (it would destroy the first tab\'s world), and nothing changes', async t => {
  const writer = makeEnv(t);
  await (await writer.boot()).dispose();
  writer.store.reset();
  const tab = nextPage(t, writer, { locks: fakeLocks({ busy: true }) });
  const site = await tab.boot();
  await assert.rejects(site.reset(), { code: 'READ_ONLY_COPY' });
  await assert.rejects(tab.win.__SPACE_STATIC__.reset(), { code: 'READ_ONLY_COPY' });
  assert.deepEqual(tab.win.location.replaced, [], 'the page is not reloaded');
  assert.equal(writer.store.clears + writer.store.deletes, 0);
});

test('a read-only tab never reconciles: an identity the database does not know is left for the first tab', async t => {
  const writer = makeEnv(t);
  await (await writer.boot()).dispose();
  const stranger = JSON.stringify({ token: 'T'.repeat(43), user: { id: 'not-in-this-database', name: '访客' } });
  writer.local.setItem(AVATAR_SESSION_KEY, stranger);
  const tab = nextPage(t, writer, { locks: fakeLocks({ busy: true }) });
  await tab.boot();
  assert.equal(writer.local.getItem(AVATAR_SESSION_KEY), stranger);
  assert.ok(!tab.order.includes('reconcile'));
});

// ---- reconcile -----------------------------------------------------------------------------------------------------------------------------

test('an identity in localStorage that the database does not know is purged before the page starts; one it knows is kept', async t => {
  const env = makeEnv(t);
  const started = env.start();
  const staticFetch = pageFetch(started);
  const site = await started.ready;
  const made = await json(await staticFetch('/api/avatar/session', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'visitor-session-key-0003' }, body: JSON.stringify({ name: '访客3', avatar: AVATAR }) }));
  assert.equal(made.status, 201);
  const session = JSON.stringify({ token: made.body.token, user: made.body.user });
  await site.dispose();

  env.local.setItem(AVATAR_SESSION_KEY, session);
  env.local.setItem(PURGE_PREFIXES[1] + 'ops', '[]');
  env.local.setItem(KEEP_PREFIXES[0] + 'state', 'map');
  const again = nextPage(t, env);
  await again.boot();
  assert.equal(env.local.getItem(AVATAR_SESSION_KEY), session, 'the database knows this visitor: kept');
  await again.sites[0].dispose();

  const otherDatabase = makeEnv(t, { local: env.local });                 // a new, empty database (another channel, or the browser cleared IndexedDB)
  await otherDatabase.boot();
  assert.equal(env.local.getItem(AVATAR_SESSION_KEY), null, 'the identity of another database is purged: no 「身份已失效」 screen');
  assert.equal(env.local.getItem(PURGE_PREFIXES[1] + 'ops'), null);
  assert.equal(env.local.getItem(KEEP_PREFIXES[0] + 'state'), 'map', 'what belongs to the Map is never touched');
});

// ---- self-heal --------------------------------------------------------------------------------------------------------------------------------

/** Keys of every kind the wipe must treat differently. */
function populate(local) {
  for (const prefix of PURGE_PREFIXES) local.setItem(`${prefix}${/[-:]$/.test(prefix) ? '' : ':'}v1:probe`, 'x');
  for (const prefix of KEEP_PREFIXES) local.setItem(`${prefix}${/-$/.test(prefix) ? 'probe' : ''}`, 'keep');
  local.setItem('some-other-app:v1', 'other');
}
const purgeKeys = local => local.keys().filter(key => PURGE_PREFIXES.some(prefix => key.startsWith(prefix)));
const keptKeys = local => local.keys().filter(key => !PURGE_PREFIXES.some(prefix => key.startsWith(prefix)));

test('self-heal: a snapshot that is not a database (corrupt bytes) is wiped with the photos and the event keys, rebuilt once, and the visitor is told', async t => {
  const env = makeEnv(t);
  await env.store.put('kv', DB_KEY, { bytes: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]), savedAt: 1, format: 1 });
  await env.store.put('blobs', 'old-photo', new Uint8Array([9, 9, 9]));
  populate(env.local);
  const keep = keptKeys(env.local);
  env.store.reset();
  const site = await env.boot();
  assert.equal(site.phase, 'ready');
  assert.equal(site.healed, true);
  assert.equal(site.fresh, true, 'the world was laid out again');
  assert.equal(env.store.clears, 1, 'one wipe: kv and blobs in a single clear');
  assert.deepEqual(await env.store.base.keys('blobs').then(keys => keys.includes('old-photo')), false, 'the photos of the old world are gone');
  assert.equal((await env.store.base.keys('blobs')).length, 4, 'only the new world\'s four');
  assert.deepEqual(purgeKeys(env.local), [], 'the event client\'s keys are gone');
  assert.deepEqual(keptKeys(env.local), keep, 'everything that belongs to the Map, the 0.16 app or another product is untouched');
  assert.equal(env.doc.toastNode.textContent, TEXT.healed);
  assert.ok(env.doc.toastNode.classes.has('visible'));
  assert.equal(env.seeds, 1);
  assert.equal(env.runtimes.length, 1, 'the corrupt snapshot never became a runtime');
  // and the next boot is an ordinary one
  await site.dispose();
  const next = nextPage(t, env);
  const again = await next.boot();
  assert.equal(again.healed, false);
  assert.equal(again.fresh, false);
});

test('self-heal: a migration that changed after it was applied (a hand-edited or re-generated file) wipes and rebuilds', async t => {
  const env = makeEnv(t);
  await (await env.boot()).dispose();
  populate(env.local);
  env.store.reset();
  const edited = migrations.map(migration => (migration.name.startsWith('0004') ? { ...migration, sql: `${migration.sql}\n-- edited after it was applied\n` } : migration));
  const next = nextPage(t, env);
  const site = await next.boot({ migrations: edited });
  assert.equal(site.healed, true);
  assert.equal(site.fresh, true);
  assert.equal(env.store.clears, 1);
  assert.deepEqual(purgeKeys(env.local), []);
  assert.equal(next.doc.toastNode.textContent, TEXT.healed);
  assert.equal(next.seeds, 1);
});

test('self-heal: a showcase from another version (the roster or the seed changed since the world was laid out) is wiped and laid out again', async t => {
  const env = makeEnv(t);
  const first = await env.boot();
  await first.dispose();
  // an older build's world: the marker names another SHOWCASE_VERSION
  const old = await createStaticRuntime({ SQL, migrations, storage: env.store, clock: () => BUILD.buildAtMs });
  await old.maintenance(db => db.run(`UPDATE ${META_TABLE} SET value = ? WHERE key = ?`, [JSON.stringify({ version: 'r0000000000', room: { id: 'x', code: 'Y' }, cupId: 'c', gameId: 'g' }), MARKER_KEY]));
  await old.close();
  populate(env.local);
  env.store.reset();
  const next = nextPage(t, env);
  const site = await next.boot();
  assert.equal(site.healed, true);
  assert.equal(site.fresh, true);
  assert.equal(next.seeds, 2, 'the stale one threw before it wrote anything; the second laid the world out');
  assert.equal(next.runtimes.length, 2);
  await assert.rejects(next.runtimes[0].handle({ url: '/api/event/health', method: 'GET' }), { code: 'RUNTIME_CLOSED' }, 'the stale runtime was closed, not leaked');
  assert.equal(env.store.clears, 1);
  assert.deepEqual(purgeKeys(env.local), []);
  assert.equal(next.doc.toastNode.textContent, TEXT.healed);
  const marker = await site.runtime.env.DB.prepare(`SELECT value FROM ${META_TABLE} WHERE key = ?`).bind(MARKER_KEY).first('value');
  assert.equal(JSON.parse(marker).version, SHOWCASE_VERSION);
});

test('self-heal: a seeding failure halfway (photos already stored) wipes those photos too and tries once more; a first visit gets no 「已更新」 toast', async t => {
  const env = makeEnv(t);
  populate(env.local);
  let calls = 0;
  env.deps.ensureShowcase = async options => {
    calls += 1;
    if (calls > 1) return ensureShowcase(options);
    // the network drops after the photos were uploaded: the batch rethrows and the snapshot is never stored
    const transport = (input, init) => (/conversation\/messages/.test(String(input)) ? Promise.reject(new TypeError('network down')) : options.transport(input, init));
    return ensureShowcase({ ...options, transport });
  };
  const site = await env.boot();
  assert.equal(calls, 2);
  assert.equal(site.healed, true);
  assert.equal(site.fresh, true);
  assert.equal(env.store.clears, 1);
  assert.equal((await env.store.base.keys('blobs')).length, 4, 'the four photos of the failed try were wiped, not doubled');
  assert.equal(env.store.puts, 1, 'the half-built world was never stored');
  assert.equal(env.doc.banner(), null, 'the failed try reported a persist error, but the world that replaced it saves fine: no 「只保存在本页」 banner');
  assert.equal(site.persistent, true);
  assert.equal(site.memoryOnly, false);
  assert.equal(env.doc.toastNode.textContent, '', 'nothing was thrown away on a first visit, so nothing is announced');
  assert.deepEqual(purgeKeys(env.local), []);
});

test('self-heal: a failed photo fetch is a seeding failure, and a retry that works ends well', async t => {
  const env = makeEnv(t);
  let attempts = 0;
  env.deps.fetchBytes = async path => { attempts += 1; if (attempts <= 4) throw new Error('offline'); return readAsset(path); };
  const site = await env.boot();
  assert.equal(site.healed, true);
  assert.equal(site.phase, 'ready');
  assert.equal(env.seeds, 2);
});

test('safe mode: a second failure shows the rescue overlay, flags the boot as failed, rejects ready, releases everything and leaves no cast', async t => {
  const env = makeEnv(t);
  env.deps.fetchBytes = async () => { throw new Error('offline'); };
  const started = env.start();
  const staticFetch = pageFetch(started);
  const early = staticFetch('/api/event/health').then(() => 'answered', error => error);
  await assert.rejects(started.ready, error => error instanceof StaticBootError && error.code === 'SEED_FAILED' && error.stage === 'seed' && /offline/.test(error.cause.message));
  assert.equal(env.win.__SPACE_BOOT__, 'failed:SEED_FAILED');
  assert.deepEqual(env.win.bootLog, ['booting', 'failed:SEED_FAILED']);
  assert.deepEqual(env.shown, ['failed:SEED_FAILED']);
  assert.equal(env.seeds, 2, 'one try and one rebuild');
  assert.equal(env.store.clears, 1, 'wiped once, not in a loop');
  assert.equal(env.pilots.length, 0);
  assert.equal(env.win.__SPACE_STATIC__.phase, 'failed');
  assert.equal(started.site.phase, 'failed');
  assert.equal(started.site.error.code, 'SEED_FAILED');
  await until(() => env.locks.held.size === 0, 'the lock to be released');
  assert.equal(env.doc.loadingSmall.textContent, '正在准备三维场景');
  assert.ok(started.site.runtime === null);
  assert.equal((await early).code, 'SEED_FAILED', 'the page\'s transport rejects: nothing answers from a world that is not there');
  assert.equal(env.store.puts, 0);
});

test('safe mode raises the real rescue overlay with the reason, outside the module graph', async t => {
  const env = makeEnv(t);
  env.win.setTimeout = () => 0; env.win.setInterval = () => 0; env.win.clearInterval = () => {};
  delete env.win.__SPACE_RESCUE__;
  new Function('window', 'document', rescueScript())(env.win, env.doc);
  env.deps.ensureShowcase = async () => { throw new Error('the seed is broken'); };
  await assert.rejects(env.boot(), { code: 'SEED_FAILED' });
  const overlay = env.doc.body.children.find(child => child.id === 'space-rescue');
  assert.ok(overlay, 'the overlay is up');
  assert.match(overlay.textContent, /页面没能完整启动/);
  assert.match(overlay.textContent, /原因：failed:SEED_FAILED/);
  assert.match(overlay.textContent, /重置示例数据/);
  assert.match(overlay.textContent, /打开早期原型/);
});

test('safe mode: a new migration that cannot run is wiped once and then reported as MIGRATION_FAILED', async t => {
  const env = makeEnv(t);
  await (await env.boot()).dispose();
  env.store.reset();
  const broken = [...migrations, { name: '0099_broken.sql', sql: 'THIS IS NOT SQL;' }];
  const next = nextPage(t, env);
  await assert.rejects(next.boot({ migrations: broken }), { code: 'MIGRATION_FAILED' });
  assert.equal(next.win.__SPACE_BOOT__, 'failed:MIGRATION_FAILED');
  assert.equal(env.store.clears, 1);
  assert.deepEqual(next.shown, ['failed:MIGRATION_FAILED']);
});

test('safe mode: a sql.js that cannot start is reported at once (nothing is wiped: the data is fine)', async t => {
  const env = makeEnv(t);
  populate(env.local);
  const before = env.local.keys();
  await assert.rejects(env.boot({ SQL: Promise.reject(new Error('wasm 404')) }), error => error.code === 'SQL_INIT_FAILED' && /wasm 404/.test(error.cause.message));
  assert.equal(env.win.__SPACE_BOOT__, 'failed:SQL_INIT_FAILED');
  assert.deepEqual(env.shown, ['failed:SQL_INIT_FAILED']);
  assert.equal(env.store.clears, 0);
  assert.deepEqual(env.local.keys(), before);
  assert.equal(env.seeds, 0);
  await until(() => env.locks.held.size === 0, 'the lock to be released');
});

test('safe mode: a rejected SQL promise is not reported as unhandled while the boot is still opening the store', async t => {
  const unhandled = [];
  const listener = reason => unhandled.push(reason);
  process.on('unhandledRejection', listener);
  t.after(() => process.off('unhandledRejection', listener));
  const env = makeEnv(t);
  await assert.rejects(env.boot({ SQL: Promise.reject(new Error('early failure')) }), { code: 'SQL_INIT_FAILED' });
  await sleep(20);
  assert.deepEqual(unhandled, []);
});

test('safe mode in a read-only tab: corrupt data shows the overlay and wipes NOTHING (the first tab\'s world is not ours to destroy)', async t => {
  const env = makeEnv(t, { locks: fakeLocks({ busy: true }) });
  const garbage = { bytes: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]), savedAt: 1, format: 1 };
  await env.store.put('kv', DB_KEY, garbage);
  await env.store.put('blobs', 'photo', new Uint8Array([7]));
  populate(env.local);
  const keys = env.local.keys();
  env.store.reset();
  await assert.rejects(env.boot(), { code: 'SNAPSHOT_CORRUPT' });
  assert.equal(env.win.__SPACE_BOOT__, 'failed:SNAPSHOT_CORRUPT');
  assert.deepEqual(env.shown, ['failed:SNAPSHOT_CORRUPT']);
  assert.equal(env.store.clears + env.store.deletes + env.store.puts, 0, 'no wipe, no write');
  assert.deepEqual(env.local.keys(), keys, 'no key was touched');
  assert.deepEqual([...(await env.store.base.get('kv', DB_KEY)).bytes], [...garbage.bytes]);
  assert.equal(env.seeds, 0);
  assert.equal(env.pilots.length, 0);
});

// ---- the store ---------------------------------------------------------------------------------------------------------------------------------

test('IndexedDB that times out or is unavailable: the page runs from memory, says so, never wipes, and the world still works', async t => {
  for (const code of ['IDB_TIMEOUT', 'IDB_UNAVAILABLE']) {
    const env = makeEnv(t);
    populate(env.local);
    const keys = env.local.keys();
    env.deps.openStore = async () => { throw Object.assign(new Error(code), { code }); };
    const started = env.start();
    const staticFetch = pageFetch(started);
    const site = await started.ready;
    assert.equal(site.phase, 'ready', code);
    assert.equal(site.store.name, 'memory');
    assert.equal(site.persistent, false);
    assert.equal(site.memoryOnly, true);
    assert.equal(site.writable, true, 'a tab without storage is still the only tab');
    assert.equal(site.fresh, true);
    assert.equal(env.win.__SPACE_STATIC__.memoryOnly, true);
    assert.equal(env.win.__SPACE_STATIC__.persistent, false);
    assert.equal(env.doc.banner().textContent, `${TEXT.memoryOnly}${TEXT.dismiss}`, code);
    assert.equal(env.doc.banner().getAttribute('data-kind'), 'memory-only');
    assert.equal(env.store.clears + env.store.puts, 0, 'the unavailable store was never touched');
    assert.deepEqual(env.local.keys(), keys, 'nothing was wiped');
    assert.equal(env.doc.toastNode.textContent, '', 'no 「已更新」: nothing was thrown away');
    assert.equal((await staticFetch('/api/event/health')).status, 200);
    assert.equal(site.stats().puts, 1, 'the memory store is written like any other');
  }
});

test('a real openIdbStore that never answers (a hung IndexedDB) times out and the page falls back to memory', async t => {
  const env = makeEnv(t);
  const neverAnswers = { open: () => ({}), deleteDatabase: () => ({}) };
  env.deps.openStore = name => openIdbStore(name, { timeoutMs: 25, indexedDB: neverAnswers });
  const site = await env.boot();
  assert.equal(site.store.name, 'memory');
  assert.equal(site.memoryOnly, true);
  assert.equal(env.doc.banner().textContent, `${TEXT.memoryOnly}${TEXT.dismiss}`);
});

test('a store that opens but cannot be read (STORAGE_UNAVAILABLE) is dropped for memory, not wiped', async t => {
  const env = makeEnv(t);
  env.store.failGet = new Error('transaction failed');
  populate(env.local);
  const keys = env.local.keys();
  const site = await env.boot();
  assert.equal(site.phase, 'ready');
  assert.equal(site.store.name, 'memory');
  assert.equal(site.memoryOnly, true);
  assert.equal(env.store.clears, 0);
  assert.ok(env.store.closes >= 1, 'the broken connection was let go');
  assert.deepEqual(env.local.keys(), keys);
  assert.equal(site.healed, false);
});

test('a store that never answers after it opened (a hung read) is dropped for memory after the runtime timeout', async t => {
  const env = makeEnv(t);
  const hang = new Promise(() => {});
  env.store.get = () => hang;
  const site = await env.boot({ timeouts: { runtimeMs: 250 } });         // generous: the memory store's own runtime must fit inside it on a busy machine
  assert.equal(site.store.name, 'memory');
  assert.equal(site.memoryOnly, true);
  assert.equal(site.phase, 'ready');
  assert.equal(site.healed, false);
});

test('a store that cannot be wiped is dropped for memory and the rebuild goes on', async t => {
  const env = makeEnv(t);
  await env.store.put('kv', DB_KEY, { bytes: new Uint8Array([1, 2, 3, 4]), savedAt: 1, format: 1 });
  env.store.failClear = new Error('clear failed');
  populate(env.local);
  const site = await env.boot();
  assert.equal(site.healed, true);
  assert.equal(site.phase, 'ready');
  assert.equal(site.store.name, 'memory');
  assert.equal(site.memoryOnly, true);
  assert.deepEqual(purgeKeys(env.local), [], 'the event client\'s keys are still cleared');
  assert.equal(env.doc.banner().getAttribute('data-kind'), 'memory-only');
});

test('a store that hangs on the wipe is given up on after the wipe timeout', async t => {
  const env = makeEnv(t);
  await env.store.put('kv', DB_KEY, { bytes: new Uint8Array([1, 2, 3, 4]), savedAt: 1, format: 1 });
  env.store.hangClear = true;
  const site = await env.boot({ timeouts: { wipeMs: 40 } });
  assert.equal(site.store.name, 'memory');
  assert.equal(site.healed, true);
});

test('a snapshot that cannot be saved (quota, a failing transaction) keeps the page working, flips persistent and shows the memory banner until saving works again', async t => {
  const env = makeEnv(t);
  const started = env.start();
  const staticFetch = pageFetch(started);
  env.store.failPuts = new DOMException('full', 'QuotaExceededError');
  const site = await started.ready;
  assert.equal(site.phase, 'ready', 'the world is laid out in memory');
  assert.equal(site.persistent, false);
  assert.equal(site.memoryOnly, true);
  assert.equal(env.doc.banner().textContent, `${TEXT.memoryOnly}${TEXT.dismiss}`);
  assert.equal(site.stats().failedPuts, 1);
  assert.equal(env.win.__SPACE_STATIC__.persistent, false);
  // the next change is stored again: the banner stops saying it cannot be
  env.store.failPuts = null;
  const made = await staticFetch('/api/avatar/session', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'visitor-session-key-0006' }, body: JSON.stringify({ name: '访客6', avatar: AVATAR }) });
  assert.equal(made.status, 201);
  await until(() => env.doc.banner() === null, 'the banner to go away once a snapshot is stored');
  assert.equal(site.persistent, true);
  assert.equal(site.memoryOnly, false);
});

test('a change that cannot be saved after the boot is over shows the banner at once, and it goes when saving works again', async t => {
  const env = makeEnv(t);
  const started = env.start();
  const staticFetch = pageFetch(started);
  const site = await started.ready;
  assert.equal(env.doc.banner(), null, 'a healthy boot says nothing');
  const change = key => staticFetch('/api/avatar/session', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify({ name: '访客', avatar: AVATAR }) });
  env.store.failPuts = new DOMException('full', 'QuotaExceededError');
  assert.equal((await change('visitor-session-key-0009')).status, 201, 'the change is still served, from memory');
  assert.equal(site.persistent, false);
  assert.equal(env.doc.banner()?.textContent, `${TEXT.memoryOnly}${TEXT.dismiss}`);
  assert.equal(env.doc.banner().getAttribute('data-kind'), 'memory-only');
  env.store.failPuts = null;
  assert.equal((await change('visitor-session-key-0010')).status, 201);
  await until(() => env.doc.banner() === null, 'the banner to go away');
  assert.equal(site.persistent, true);
});

test('a dismissed banner stays dismissed when the same trouble comes back', async t => {
  const env = makeEnv(t);
  const started = env.start();
  const staticFetch = pageFetch(started);
  env.store.failPuts = new Error('busy');
  const site = await started.ready;
  const change = key => staticFetch('/api/avatar/session', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify({ name: '访客', avatar: AVATAR }) });
  assert.ok(env.doc.banner());
  env.doc.banner().children[1].click();
  assert.equal(env.doc.banner(), null);
  env.store.failPuts = null;
  await change('visitor-session-key-0007');
  await until(() => site.persistent, 'saving to work again');
  env.store.failPuts = new Error('busy again');
  await change('visitor-session-key-0008');
  assert.equal(site.persistent, false);
  await sleep(20);
  assert.equal(env.doc.banner(), null, 'the visitor already said 知道了');
});

test('a read-only banner outranks the memory one, and a dismissed banner stays dismissed', async t => {
  const writer = makeEnv(t);
  await (await writer.boot()).dispose();
  const tab = nextPage(t, writer, { locks: fakeLocks({ busy: true }) });
  tab.deps.openStore = async () => { throw Object.assign(new Error('x'), { code: 'IDB_UNAVAILABLE' }); };
  await tab.boot();
  assert.equal(tab.doc.banner().getAttribute('data-kind'), 'read-only');
  tab.doc.banner().children[1].click();
  assert.equal(tab.doc.banner(), null);
});

// ---- the page's lifetime --------------------------------------------------------------------------------------------------------------------

test('pagehide stops the cast, stores what is dirty and gives the lock to the next document; hiding the tab stores too', async t => {
  const env = makeEnv(t);
  let flushes = 0;
  env.deps.createRuntime = async options => {
    const runtime = await createStaticRuntime(options);
    const flush = runtime.flush;
    runtime.flush = (...args) => { flushes += 1; return flush(...args); };
    return runtime;
  };
  await env.boot();
  const flushesAfterBoot = flushes;
  assert.ok(env.locks.held.has('music-space-static-writer'), 'the writer holds the lock');
  env.doc.visibilityState = 'visible';
  env.doc.dispatch('visibilitychange');
  assert.equal(flushes, flushesAfterBoot, 'a visible tab stores nothing extra');
  env.doc.visibilityState = 'hidden';
  env.doc.dispatch('visibilitychange');
  assert.equal(flushes, flushesAfterBoot + 1, 'hidden: flush');
  env.win.dispatchEvent(new Event('pagehide'));
  assert.equal(flushes, flushesAfterBoot + 2, 'pagehide: flush (not awaited)');
  assert.equal(env.pilots[0].stopped, 1, 'the cast stops acting once the page is going');
  await until(() => env.locks.held.size === 0, 'the lock to be released');
  // a second document can take it at once
  const next = nextPage(t, env, { locks: env.locks });
  next.deps.lockOptions = { retries: 0, delayMs: 0 };
  assert.equal((await next.boot()).writable, true);
});

test('pagehide flushes a change that is still dirty, so the hop to the Map cannot lose it', async t => {
  const env = makeEnv(t);
  const started = env.start();
  const staticFetch = pageFetch(started);
  const site = await started.ready;
  // a put that fails leaves the database dirty; the next flush (hidden, pagehide) stores it
  env.store.failPuts = new Error('transaction aborted');
  const made = await staticFetch('/api/avatar/session', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'visitor-session-key-0004' }, body: JSON.stringify({ name: '访客4', avatar: AVATAR }) });
  assert.equal(made.status, 201, 'still served from memory');
  assert.equal(site.persistent, false);
  env.store.failPuts = null;
  const putsBefore = env.store.puts;
  env.win.dispatchEvent(new Event('pagehide'));
  await until(() => env.store.puts === putsBefore + 1, 'the pagehide flush to write the dirty database');
  await until(() => site.persistent, 'persistence to recover');
});

test('dispose removes the listeners and the banner, stops the cast and releases the lock', async t => {
  const env = makeEnv(t, { locks: fakeLocks() });
  env.store.failPuts = new Error('no');
  const site = await env.boot();
  assert.ok(env.doc.banner());
  await site.dispose();
  assert.equal(env.doc.banner(), null);
  assert.equal(env.pilots[0].stopped, 1);
  assert.equal(env.locks.held.size, 0);
  assert.equal(env.doc.listeners.visibilitychange.size, 0);
  assert.equal(env.win.dispatchEvent(new Event('pagehide')), true);
  assert.equal(env.pilots[0].stopped, 1, 'a disposed boot ignores pagehide');
});

// ---- reset -----------------------------------------------------------------------------------------------------------------------------------------

test('reset: stops the cast, closes the runtime, empties the store, clears only the event client\'s keys, frees the lock and reloads the bare address', async t => {
  const env = makeEnv(t, { pathname: '/musicSpace/preview/' });
  populate(env.local);
  const keep = keptKeys(env.local);
  const site = await env.boot();
  assert.equal(env.opened[0], 'music-space-static:preview:v1');
  assert.equal(env.doc.documentElement.dataset.channel, 'preview');
  env.store.reset();
  const done = env.win.__SPACE_STATIC__.reset();
  assert.equal(env.win.__SPACE_STATIC__.reset(), done, 'a second tap is the same reset');
  await done;
  assert.equal(env.pilots[0].stopped >= 1, true);
  await assert.rejects(site.runtime.handle({ url: '/api/event/health', method: 'GET' }), { code: 'RUNTIME_CLOSED' });
  assert.equal(env.store.clears, 1);
  assert.deepEqual(await env.store.base.keys('kv'), []);
  assert.deepEqual(await env.store.base.keys('blobs'), []);
  assert.deepEqual(purgeKeys(env.local), []);
  assert.deepEqual(keptKeys(env.local), keep);
  assert.equal(env.locks.held.size, 0, 'the next document takes the lock without waiting');
  assert.deepEqual(env.win.location.replaced, ['/musicSpace/preview/'], 'the bare path: ?room= and ?v= are dropped');
  assert.ok(env.store.closes >= 1);
});

test('a pagehide after reset cannot write the old world back', async t => {
  const env = makeEnv(t);
  const started = env.start();
  const staticFetch = pageFetch(started);
  const site = await started.ready;
  env.store.failPuts = new Error('busy');
  await staticFetch('/api/avatar/session', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'visitor-session-key-0005' }, body: JSON.stringify({ name: '访客5', avatar: AVATAR }) });
  env.store.failPuts = null;                                    // dirty, and the next flush would succeed
  await site.reset();
  env.store.reset();
  env.win.dispatchEvent(new Event('pagehide'));
  env.doc.visibilityState = 'hidden';
  env.doc.dispatch('visibilitychange');
  await sleep(30);
  assert.equal(env.store.puts, 0, 'the closed flag came first');
  assert.deepEqual(await env.store.base.keys('kv'), []);
});

test('reset with no runtime (safe mode) deletes the database without one and reloads', async t => {
  const env = makeEnv(t);
  env.deps.ensureShowcase = async () => { throw new Error('broken'); };
  const resets = [];
  env.deps.resetStorage = async options => { resets.push(options); return { indexedDb: 'deleted', removedKeys: [] }; };
  env.win.indexedDB = { marker: 'indexedDB' };
  populate(env.local);
  await assert.rejects(env.boot(), { code: 'SEED_FAILED' });
  await env.win.__SPACE_STATIC__.reset();
  assert.equal(resets.length, 1);
  assert.equal(resets[0].idbName, 'music-space-static:pages:v1');
  assert.equal(resets[0].storage, env.local);
  assert.equal(resets[0].indexedDB, env.win.indexedDB);
  assert.deepEqual(env.win.location.replaced, ['/musicSpace/']);
  assert.deepEqual(purgeKeys(env.local), []);
});

test('reset falls back to deleting the database when the runtime cannot clear its store, and still reloads', async t => {
  const env = makeEnv(t);
  const resets = [];
  env.deps.resetStorage = async options => { resets.push(options.idbName); return { indexedDb: 'deleted', removedKeys: [] }; };
  env.deps.createRuntime = async options => { const runtime = await createStaticRuntime(options); runtime.reset = async () => { throw new Error('clear hangs'); }; return runtime; };
  const site = await env.boot();
  await site.reset();
  assert.deepEqual(resets, ['music-space-static:pages:v1']);
  assert.deepEqual(env.win.location.replaced, ['/musicSpace/']);
});

test('reset that cannot be done at all still reloads, and says why', async t => {
  const env = makeEnv(t);
  env.deps.resetStorage = async () => ({ indexedDb: 'timeout', removedKeys: [] });
  env.deps.createRuntime = async options => { const runtime = await createStaticRuntime(options); runtime.reset = async () => { throw new Error('clear hangs'); }; return runtime; };
  const site = await env.boot();
  await assert.rejects(site.reset(), /clear hangs/);
  assert.deepEqual(env.win.location.replaced, ['/musicSpace/'], 'the reload happens anyway: the next boot heals or the rescue overlay takes over');
});

// ---- the helpers profile.js composes ----------------------------------------------------------------------------------------------------------

test('createByteLoader reads a site-relative file as bytes, resolving it with the site root', async () => {
  const asked = [];
  const load = createByteLoader({ fetch: async (url, init) => { asked.push([url, init]); return new Response(new Uint8Array([1, 2, 3])); }, resolve: path => `https://example.test/musicSpace/${path}` });
  const bytes = await load('demo/a.jpg');
  assert.ok(bytes instanceof Uint8Array);
  assert.deepEqual([...bytes], [1, 2, 3]);
  assert.equal(asked[0][0], 'https://example.test/musicSpace/demo/a.jpg');
  assert.ok(asked[0][1].signal, 'each try has a timeout signal');
});

test('createByteLoader retries a flaky connection, pauses longer each time, and gives up with the last error', async () => {
  const pauses = [];
  let calls = 0;
  const flaky = createByteLoader({ fetch: async () => { calls += 1; if (calls < 3) throw new TypeError(`network ${calls}`); return new Response(new Uint8Array([9])); }, sleep: async ms => { pauses.push(ms); }, delayMs: 100 });
  assert.deepEqual([...await flaky('demo/a.jpg')], [9]);
  assert.equal(calls, 3);
  assert.deepEqual(pauses, [100, 200]);

  calls = 0; pauses.length = 0;
  const dead = createByteLoader({ fetch: async () => { calls += 1; throw new TypeError(`network ${calls}`); }, sleep: async ms => { pauses.push(ms); }, delayMs: 100, retries: 2 });
  await assert.rejects(dead('demo/a.jpg'), /network 3/);
  assert.equal(calls, 3);

  const missing = createByteLoader({ fetch: async () => new Response('nope', { status: 404 }), sleep: async () => {}, retries: 1 });
  await assert.rejects(missing('demo/zzz.jpg'), /HTTP 404 for demo\/zzz\.jpg/);
});

test('createByteLoader gives each try a deadline: a connection that never answers is aborted and retried', async () => {
  let calls = 0;
  const hanging = (url, init) => new Promise((resolve, reject) => {
    calls += 1;
    if (calls === 1) init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    else resolve(new Response(new Uint8Array([5])));
  });
  const load = createByteLoader({ fetch: hanging, timeoutMs: 20, sleep: async () => {} });
  assert.deepEqual([...await load('demo/a.jpg')], [5]);
  assert.equal(calls, 2);
  assert.throws(() => createByteLoader({}), TypeError);
});

test('fetchBytes.prefetch starts low-priority downloads that a later fetchBytes shares: one request per file, the bytes at once when they are in', async () => {
  const calls = [], releases = [];
  const fetcher = (url, init) => { calls.push([url, init]); return new Promise(resolve => releases.push(() => resolve(new Response(new Uint8Array([7, 7]))))); };
  const load = createByteLoader({ fetch: fetcher, resolve: path => `https://example.test/${path}` });
  load.prefetch(['demo/a.jpg', 'demo/b.jpg', 'demo/a.jpg']);
  assert.equal(calls.length, 2, 'a file named twice is one request');
  assert.deepEqual(calls.map(([url]) => url), ['https://example.test/demo/a.jpg', 'https://example.test/demo/b.jpg']);
  assert.ok(calls.every(([, init]) => init.priority === 'low' && init.signal), 'low priority, with a deadline');
  const shared = load('demo/a.jpg');
  assert.equal(calls.length, 2, 'the fetch that needs the file waits for the prefetch instead of asking again');
  releases.forEach(release => release());
  assert.deepEqual([...await shared], [7, 7]);
  assert.deepEqual([...await load('demo/b.jpg')], [7, 7], 'and the other file is there already');
  assert.equal(calls.length, 2);
  load('demo/c.jpg').catch(() => {});
  assert.equal(calls.length, 3, 'a file nobody prefetched is an ordinary request');
  assert.equal('priority' in calls[2][1], false, 'without a priority hint');
  load.prefetch(['demo/a.jpg']);
  assert.equal(calls.length, 3, 'prefetching what is already in changes nothing');
});

test('a prefetch that failed is asked again by the fetch that needs the file (and the failure is not an unhandled rejection)', async t => {
  const unhandled = [];
  const listener = reason => unhandled.push(reason);
  process.on('unhandledRejection', listener);
  t.after(() => process.off('unhandledRejection', listener));
  let calls = 0;
  const load = createByteLoader({ fetch: async () => { calls += 1; if (calls === 1) throw new TypeError('offline'); return new Response(new Uint8Array([4])); }, retries: 0, sleep: async () => {} });
  load.prefetch(['demo/a.jpg']);
  await sleep(20);
  assert.deepEqual(unhandled, []);
  assert.deepEqual([...await load('demo/a.jpg')], [4]);
  assert.equal(calls, 2, 'one failed prefetch, one real request');
  assert.deepEqual([...await load('demo/a.jpg')], [4], 'a file that failed once is not cached as a failure');
  assert.equal(calls, 3);
});

test('createSamples lists the two example photos with their thumbnails and loads one as a JPEG File', async () => {
  const asked = [];
  const samples = createSamples({
    samples: SAMPLE_PHOTOS, fetchBytes: async path => { asked.push(path); return readAsset(path); }, resolve: path => `https://example.test/musicSpace/${path}`,
  });
  const list = samples.list();
  assert.deepEqual(list.map(sample => sample.id), ['sample-crowd', 'sample-stage'], 'the crowd photo first: the model is sure about it');
  assert.deepEqual(list.map(sample => sample.thumbUrl), ['https://example.test/musicSpace/demo/sample-crowd.jpg', 'https://example.test/musicSpace/demo/sample-stage.jpg']);
  for (const sample of list) assert.deepEqual(Object.keys(sample).sort(), ['id', 'label', 'note', 'thumbUrl']);
  const file = await samples.load('sample-stage');
  assert.ok(file instanceof File);
  assert.equal(file.type, 'image/jpeg');
  assert.equal(file.name, 'sample-stage.jpg');
  assert.deepEqual(asked, ['demo/sample-stage.jpg']);
  assert.deepEqual(new Uint8Array(await file.arrayBuffer()), await readAsset('demo/sample-stage.jpg'), 'the bytes carry their own EXIF time untouched');
  await assert.rejects(samples.load('sample-nope'), /找不到这张示例照片/);
});

// ---- the shape of the whole -----------------------------------------------------------------------------------------------------------------

test('bootStaticSite is the whole boot as one promise of the live view', async t => {
  const env = makeEnv(t);
  const site = await bootStaticSite({ ...env.deps });
  env.sites.push(site);
  assert.equal(site.phase, 'ready');
  assert.equal(typeof site.reset, 'function');
});

test('missing dependencies are named, not discovered halfway through a boot', () => {
  const env = { SQL, migrations, build: BUILD, window: {}, document: {}, openStore() {}, fetchBytes() {}, createRuntime() {}, ensureShowcase() {}, createAutopilot() {} };
  for (const name of Object.keys(env).filter(key => key !== 'build')) {
    const { [name]: removed, ...rest } = env;
    assert.throws(() => startStaticBoot(rest), new RegExp(`deps\\.${name}\\b`), name);
  }
  assert.throws(() => startStaticBoot({ ...env, build: { version: 'x' } }), /buildAtMs/);
  assert.throws(() => startStaticBoot(), TypeError);
  assert.equal(BOOT_TIMEOUTS.runtimeMs, 8000);
});

test('boot.js imports no browser global and no Vite feature: Node can import it with every DOM global poisoned', () => {
  const source = codeOf('web/static-runtime/boot.js');
  assert.equal(/import\.meta/.test(source), false, 'no import.meta');
  assert.equal(/^await\s/m.test(source), false, 'no top-level await');
  const imports = [...source.matchAll(/^import .* from '([^']+)'/gm)].map(match => match[1]);
  assert.ok(imports.length >= 5);
  for (const specifier of imports) assert.match(specifier, /^\.\/(transport|clock|idb-store|single-writer|storage-guard)\.js$/, `boot.js imports ${specifier}`);
  const probe = `for (const name of ['window', 'document', 'localStorage', 'sessionStorage', 'indexedDB', 'location', 'caches', 'BroadcastChannel']) Object.defineProperty(globalThis, name, { get() { throw new Error('boot.js touched ' + name + ' at import time'); }, configurable: true });
    const boot = await import('./web/static-runtime/boot.js');
    console.log(typeof boot.bootStaticSite, typeof boot.startStaticBoot);`;
  const run = spawnSync(process.execPath, ['--input-type=module', '-e', probe], { cwd: root, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout.trim(), 'function function');
});

test('profile.js wires it in the right order: the page\'s fetch first, then sql.js and the boot, then the profile app.js reads', () => {
  const source = codeOf('web/static-runtime/profile.js');
  assert.match(source, /^import '\.\/demo\.css';$/m, 'the stylesheet is bundled with the profile');
  assert.match(source, /import initSqlJs from 'sql\.js\/dist\/sql-wasm-browser\.js';/, 'the browser build (the default entry has require() calls and Node detection)');
  assert.match(source, /import\.meta\.glob\('\.\.\/\.\.\/runtime-preview\/drizzle\/\*\.sql', \{ query: '\?raw', import: 'default', eager: true \}\)/);
  assert.match(source, /Object\.keys\(sources\)\.sort\(\)/, 'migrations in file-name order');
  assert.match(source, /locateFile: \(\) => siteUrl\('sql\/sql-wasm\.wasm'\)/);
  const at = text => { const index = source.indexOf(text); assert.ok(index >= 0, text); return index; };
  assert.ok(at('installStaticFetch(') < at('initSqlJs({'), 'the fetch is replaced before anything can build a client');
  assert.ok(at('initSqlJs({') < at('startStaticBoot({'), 'sql.js starts first (its wasm download overlaps the lock and the store)');
  assert.ok(at('initSqlJs({') < at('fetchBytes.prefetch(NPCS'), 'the wasm is requested before the photos');
  assert.ok(at('fetchBytes.prefetch(NPCS') < at('startStaticBoot({'), 'the cast photos download while the boot starts');
  assert.match(source, /ready\.then\(\(\) => fetchBytes\.prefetch\(SAMPLE_PHOTOS\.map\(sample => `demo\/\$\{sample\.file\}`\)\), \(\) => \{\}\)/, 'the two example photos once the world is ready');
  assert.ok(at('startStaticBoot({') < at('createDemoProfile({'));
  assert.ok(at('createDemoProfile({') < at('export const profile'));
  assert.match(source, /export const profile = \{\s*mode: 'static',\s*channel: started\.site\.channel,\s*ready,\s*controllerOptions: \(\) => \(\{ fetch: staticFetch \}\),\s*copy,\s*demo,\s*\};/);
  assert.match(source, /getRuntime: \(\) => started\.ready\.then\(site => site\.runtime\)/, 'the page\'s transport waits for the boot');
  assert.match(source, /notifyChanged: \(\) => demo\?\.notifyChanged\(\)/, 'the cast\'s changes reach the page');
  assert.match(source, /readOnly: \(\) => !started\.site\.writable/);
  assert.match(source, /reset: \(\) => started\.site\.reset\(\)/);
  assert.equal(/^await\s/m.test(source), false, 'no top-level await');
  assert.equal(/from '\.\.\/\.\.\/(server|runtime-preview\/src)/.test(source), false, 'the profile imports the room service only through runtime.js, seed.js and the other static modules');
});

test('vite.static.config.js still swaps in this profile, defines the build stamp, and keeps the licence and wasm plugins', () => {
  const config = readFileSync(join(root, 'vite.static.config.js'), 'utf8');
  assert.match(config, /\{find: \/\^\\\.\\\/runtime-profile\\\.js\$\/, replacement: here\('\.\/web\/static-runtime\/profile\.js'\)\}/);
  assert.match(config, /define: \{__SPACE_BUILD__: JSON\.stringify\(build\)\}/);
  assert.match(config, /sql-wasm-browser\.wasm/);
});

test('the static build refuses to ship a page without the in-page room service (static-profile-guard)', async t => {
  const out = mkdtempSync(join(tmpdir(), 'space-static-guard-'));
  t.after(() => rmSync(out, { recursive: true, force: true }));
  process.env.STATIC_OUT = out;                      // the config reads it when it loads: nothing may be written into dist-pages
  const { build } = await import('vite');
  const { default: config } = await import('../vite.static.config.js');
  const withoutProfile = { ...config, configFile: false, logLevel: 'silent', resolve: { alias: config.resolve.alias.filter(entry => !String(entry.find).includes('runtime-profile')) } };
  await assert.rejects(build(withoutProfile), error => /static profile guard: the built page lacks/.test(error.message) && /boot \(web\/static-runtime\/boot\.js\)/.test(error.message) && /0013_event_photo_moment\.sql/.test(error.message));
  await build({ ...config, configFile: false, logLevel: 'silent' });
  const html = readFileSync(join(out, 'index.html'), 'utf8');
  for (const marker of ['__SPACE_STATIC__', 'music-space-static', '_static_migrations', 'sql/sql-wasm.wasm', '0013_event_photo_moment.sql']) assert.ok(html.includes(marker), `${marker} is in the built page`);
  assert.equal(/\bfrom\s*["']node:/.test(html), false, 'no node: import is left in the bundle');
  assert.equal(/\brequire\(/.test(html), false, 'no require() is left in the bundle (the sql.js browser build)');
  assert.equal(html.includes('__SPACE_BUILD__'), false, 'the build stamp was defined');
});

test('build:pages fails when the demo photos are missing, before any Vite step runs (checkDemoAssets)', async () => {
  const { checkDemoAssets } = await import('../scripts/pages/build.mjs');
  assert.deepEqual(checkDemoAssets(join(root, 'web/static-runtime/demo-assets')).sort(), ['bei-balcony.jpg', 'man-crowd.jpg', 'man-near.jpg', 'sample-crowd.jpg', 'sample-stage.jpg', 'yao-stage.jpg']);
  const dir = mkdtempSync(join(tmpdir(), 'space-demo-assets-'));
  try {
    assert.throws(() => checkDemoAssets(dir), /manifest\.json is missing/);
    writeFileSync(join(dir, 'manifest.json'), 'not json');
    assert.throws(() => checkDemoAssets(dir), /is not JSON/);
    writeFileSync(join(dir, 'manifest.json'), '{"files": []}');
    assert.throws(() => checkDemoAssets(dir), /lists no photos/);
    writeFileSync(join(dir, 'manifest.json'), '{"files": [{"file": "a.jpg"}, {"file": "b.jpg"}]}');
    writeFileSync(join(dir, 'a.jpg'), 'x');
    assert.throws(() => checkDemoAssets(dir), /not in .*: b\.jpg/);
    writeFileSync(join(dir, 'b.jpg'), 'y');
    assert.deepEqual(checkDemoAssets(dir), ['a.jpg', 'b.jpg']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
