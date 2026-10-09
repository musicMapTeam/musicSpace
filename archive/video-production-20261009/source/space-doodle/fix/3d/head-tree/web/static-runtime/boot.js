/**
 * The boot of the static site (route B, architecture section 4): everything that has to happen before the visitor can touch the page, in
 * one place that Node can import. Nothing here reads a browser global, import.meta or a Vite-only module: every part of the environment
 * arrives through `deps` (web/static-runtime/profile.js is the one module that knows about Vite and hands the real ones in; the tests hand
 * in fakes). Only pure siblings are imported (transport, clock, memory store, writer lock, storage guard).
 *
 *   const { site, ready } = startStaticBoot(deps);   // starts at once; `site` is a live view that fills in as the boot goes
 *   const site = await bootStaticSite(deps);          // the same, as one promise: resolves when the world is laid out
 *
 * deps (required unless marked optional)
 *   SQL                  the initialised sql.js module, or a promise of it (the wasm download may still be running when the boot starts)
 *   migrations           [{ name, sql }] in order (runtime-preview/drizzle/*.sql)
 *   build                { version, commit, builtAt, buildAtMs } (the Vite define __SPACE_BUILD__)
 *   window, document     the page; location.pathname picks the channel. localStorage / navigator may be null or missing
 *   openStore(name)      -> an idb-store surface (openIdbStore); a rejection (IDB_TIMEOUT, IDB_UNAVAILABLE, anything) means "use memory"
 *   fetchBytes(path)     -> Uint8Array of a site-relative file ('demo/yao-stage.jpg'); the seed reads the cast photos through it
 *   createRuntime        createStaticRuntime            ensureShowcase   showcase/seed.js          createAutopilot   showcase/autopilot.js
 *   now                  optional, the device clock (default Date.now)
 *   navigator            optional, only navigator.locks is read      localStorage   optional, the event client's storage
 *   notifyChanged        optional, called (coalesced) after every change the cast makes (profile.demo.notifyChanged)
 *   castNames            optional, the cast's display names: a read-only tab finds the cast's ids by name
 *   acquireWriterLock, reconcile, resetStorage, createMemoryStore   optional, default to the real ones
 *   lockOptions          optional, passed to acquireWriterLock ({ retries, delayMs, sleep }: tests make the retries instant)
 *   timeouts             optional { runtimeMs, wipeMs, resetMs, coalesceMs }
 *   log(event, detail)   optional, a debug channel (never an error channel)
 *
 * The sequence (each step waits for the one before it)
 *   a  channel from the URL: a path that ends with /preview/ is the preview, anything else is the site root. EXACTLY the rescue script's
 *      rule (scripts/build/static-html-plugin.mjs), so its 「重置示例数据」 deletes the database this boot opened. Sets
 *      <html data-channel> and names the IndexedDB database music-space-static:<channel>:v1.
 *   b  writer lock (single-writer.js). Not held = this tab is a read-only copy of another tab's demo (below).
 *   c  open the store. IDB_TIMEOUT, IDB_UNAVAILABLE or anything else = the memory store plus the banner 「示例数据只保存在本页，刷新会重置」.
 *      navigator.storage.persist() is never called (Firefox would ask the visitor for permission).
 *   d  createStaticRuntime on a clock that is never behind the build (see createBootClock).
 *   e  reconcile localStorage with the database: an identity the database does not know is purged (no 「身份已失效」 screen).
 *   f  status 「正在布置示例现场…」, then ensureShowcase through a SEPARATE transport bound straight to the runtime (never to the boot
 *      promise: the page's transport waits for the boot, so seeding through it would wait for itself). Only when writable.
 *   g  the autopilot starts (only when writable); its changes reach the page through notifyChanged. A world laid out by THIS load also drops
 *      a stale ?room= from the address (nothing from before exists any more), so the page opens in the lobby, not on 「找不到这一场」.
 *   h  pagehide: flush (not awaited), stop the autopilot, release the lock. visibilitychange to hidden: flush.
 *   i  window.__SPACE_BOOT__ = 'ready' and window.__SPACE_STATIC__ (the QA handle, see below).
 *
 * Self-heal (writable tab only). The browser's data is disposable, so every kind of bad state ends in the same cure: wipe the store (kv and
 * blobs in one transaction) and the event client's localStorage keys, rebuild from scratch ONCE, toast 「示例已更新，已为你重新布置」
 * (not on a first visit: nothing was thrown away then). Triggers: SNAPSHOT_CORRUPT, MIGRATION_CHANGED, MIGRATION_FAILED, a ShowcaseStaleError
 * (the roster or the seed changed since the world was laid out), and any seeding failure. A store that cannot be read (STORAGE_UNAVAILABLE) or
 * answers nothing (IDB_HUNG) is not wiped: the page carries on in memory. A second failure is SAFE MODE: window.__SPACE_BOOT__ =
 * 'failed:<code>', window.__SPACE_RESCUE__.show('failed:<code>') (the overlay of scripts/build/static-html-plugin.mjs) and `ready` rejects
 * with a StaticBootError.
 *
 * Read-only tab (the lock is held elsewhere): the runtime answers every mutation 409 READ_ONLY_COPY and writes nothing; no seeding, no
 * autopilot, no reconcile, NO wipe, whatever the data looks like (this tab must never destroy the first tab's world). Corrupt data there
 * goes to safe mode without wiping. The banner 「示例已在另一个标签页打开，这里不能操作」 says so.
 *
 * A purge makes the page reload once. app.js builds its event controller at module evaluation, which reads the stored identity BEFORE this boot
 * has looked at the database. When reconcile (or a self-heal) then removes an identity the database does not know, the controller sees the
 * change at its first connect(), reloads the page ONCE (its toast 「浏览器身份已变化，正在重新载入」) and the visitor lands in the lobby. That is
 * the controller's own rule for an identity that changed under it; it only happens when such an identity exists (a flip between the preview and
 * the root of the same origin, a browser that cleared IndexedDB but not localStorage, a self-heal). A first visit never reloads.
 *
 * window.__SPACE_STATIC__ (QA, no tokens and no photo bytes): { channel, idbName, build, phase 'booting'|'ready'|'failed', writable, persistent,
 * memoryOnly, healed, fresh (this load laid the world out), lockReason, roomCode, castIds, timings, stats() -> { puts (snapshot writes),
 * blobPuts, failedPuts, lastPutAt, autopilot }, reset() }.
 */
import { createTransport } from './transport.js';
import { createClock } from './clock.js';
import { createMemoryStore } from './idb-store.js';
import { acquireWriterLock } from './single-writer.js';
import { clearEventClientStorage, reconcileLocalStorage, resetStaticStorage } from './storage-guard.js';

export const IDB_NAME_PREFIX = 'music-space-static';

/** The channel of a page. The same rule as the rescue script: only a path that ends with /preview/ is the preview. */
export const channelOf = pathname => (/\/preview\/$/.test(String(pathname ?? '')) ? 'preview' : 'pages');
export const idbNameOf = channel => `${IDB_NAME_PREFIX}:${channel}:v1`;

/** Words the boot puts on the page. showcase/copy.js repeats the two banners for the About panel; a test keeps them equal. */
export const TEXT = Object.freeze({
  preparing: '正在布置示例现场…',
  memoryOnly: '示例数据只保存在本页，刷新会重置',
  readOnly: '示例已在另一个标签页打开，这里不能操作',
  healed: '示例已更新，已为你重新布置',
  failed: '示例现场没能启动。可以重新载入，或重置示例数据后再试。',
  dismiss: '知道了',
});

export const BOOT_TIMEOUTS = Object.freeze({ runtimeMs: 8000, wipeMs: 4000, resetMs: 5000, coalesceMs: 250 });

/** The marker the seed writes (showcase/seed.js META_TABLE and MARKER_KEY); a read-only tab reads the room code from it. */
const META_TABLE = '_static_meta';
const MARKER_KEY = 'showcase';

export class StaticBootError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'StaticBootError';
    this.code = code;
    Object.assign(this, details);
  }
}

const REQUIRED = ['SQL', 'migrations', 'build', 'window', 'document', 'openStore', 'fetchBytes', 'createRuntime', 'ensureShowcase', 'createAutopilot'];
const KNOWN_CODES = new Set(['SNAPSHOT_CORRUPT', 'MIGRATION_CHANGED', 'MIGRATION_FAILED', 'STORAGE_UNAVAILABLE', 'SHOWCASE_STALE', 'IDB_HUNG', 'SQL_INIT_FAILED', 'READ_ONLY_COPY']);
const BANNER_STYLE = "box-sizing:border-box;position:fixed;left:0;right:0;top:0;z-index:2147483000;display:flex;align-items:center;gap:8px;min-height:44px;padding:2px 4px 2px 14px;padding-top:max(2px,env(safe-area-inset-top));background:#f3e5c8;color:#5a3a12;border-bottom:2px solid #b9803a;font:14px/1.5 'Microsoft YaHei','PingFang SC',system-ui,sans-serif";
const BANNER_BUTTON_STYLE = "flex:none;box-sizing:border-box;min-width:44px;min-height:44px;margin:0;padding:0 12px;background:transparent;color:#5a3a12;border:1px solid #b9803a;border-radius:3px;font:inherit;font-size:14px;cursor:pointer";

// ---------------------------------------------------------------------------------------------------------------------------------
// Small pure helpers

/**
 * The runtime's clock: the device clock, but never behind the build. A device that is behind (a wrong date, a phone that lost its time)
 * would otherwise freeze at the build time (createClock floors it), and a frozen clock means a character never finds a request old enough to
 * answer. So the gap at boot is carried along: the clock starts at the build time and keeps moving at the device's pace.
 */
export function createBootClock({ buildAtMs, now = Date.now } = {}) {
  const first = now();
  const behind = Number.isFinite(first) && first < buildAtMs ? buildAtMs - first : 0;
  return createClock({ buildAtMs, now: () => now() + behind });
}

/** Races `promise` against a timer; rejects with an error that carries `code`. `onLate` gets a value that arrives after the timeout. */
function bounded(promise, ms, code, { setTimer, clearTimer, onLate } = {}) {
  return new Promise((resolve, reject) => {
    let over = false;
    const timer = setTimer(() => { over = true; reject(Object.assign(new Error(`${code}: no answer within ${ms} ms`), { code })); }, ms);
    Promise.resolve(promise).then(
      value => { clearTimer(timer); if (over) { try { onLate?.(value); } catch { /* nothing to clean up */ } } else resolve(value); },
      error => { clearTimer(timer); if (!over) reject(error); },
    );
  });
}

/**
 * Counts the writes the runtime makes ('kv' = database snapshots, 'blobs' = photos): the QA handle's stats(). Everything else is passed on.
 * `onSaved` is told when a snapshot reached the store (the banner that says "cannot save" learns that it can again).
 */
function countingStore(store, counters, now, { onSaved } = {}) {
  return {
    get persistent() { return store.persistent; },
    get name() { return store.name; },
    get: (area, key) => store.get(area, key),
    async put(area, key, value) {
      if (area === 'kv') { counters.puts += 1; counters.lastPutAt = now(); } else counters.blobPuts += 1;
      let result;
      try { result = await store.put(area, key, value); } catch (error) { counters.failedPuts += 1; throw error; }
      if (area === 'kv') { try { onSaved?.(); } catch { /* a banner must not fail a write */ } }
      return result;
    },
    delete: (area, key) => store.delete(area, key),
    keys: area => store.keys(area),
    clear: () => store.clear(),
    close: () => store.close?.(),
  };
}

/** leading + trailing: the first change fires at once (the visitor sees a reply as soon as it exists), a burst gets one more call at the end. */
function coalesced(fn, ms, { setTimer, clearTimer }) {
  let timer = null, again = false;
  const settle = () => { timer = null; if (again) { again = false; trigger(); } };
  function trigger() {
    if (timer !== null) { again = true; return; }
    timer = setTimer(settle, ms);
    timer?.unref?.();
    try { fn(); } catch { /* a refresh that failed must not stop the cast */ }
  }
  trigger.cancel = () => { if (timer !== null) clearTimer(timer); timer = null; again = false; };
  return trigger;
}

/** Does the database know this user? (reconcile asks: an identity it does not know is purged.) Reads only; works on a read-only runtime. */
async function databaseKnowsUser(runtime, id) {
  const row = await runtime.env.DB.prepare('SELECT 1 AS found FROM avatar_users WHERE id = ?').bind(id).first();
  return row !== null;
}

/**
 * What a read-only tab can learn about the world without tokens: the showcase room (from the marker the seed wrote) and who the cast is
 * (the users that carry the cast's names). null when there is no marker yet (the first tab is still laying the world out).
 */
async function readWorld(runtime, castNames) {
  try {
    const DB = runtime.env.DB;
    const raw = await DB.prepare(`SELECT value FROM ${META_TABLE} WHERE key = ?`).bind(MARKER_KEY).first('value');
    const room = typeof raw === 'string' ? JSON.parse(raw)?.room : null;
    if (!room?.id || !room?.code) return null;
    const names = castNames.filter(name => typeof name === 'string' && name);
    const found = names.length ? (await DB.prepare(`SELECT id FROM avatar_users WHERE name IN (${names.map(() => '?').join(', ')})`).bind(...names).all()).results : [];
    return { room: { id: room.id, code: room.code }, roomCode: room.code, castIds: found.map(row => row.id), castNames: names };
  } catch { return null; }
}

/** The short code `__SPACE_BOOT__` and the rescue overlay carry: what went wrong, in one token. */
function failureCode(error, stage) {
  const code = error?.code;
  if (typeof code === 'string' && KNOWN_CODES.has(code)) return code;
  return stage === 'seed' ? 'SEED_FAILED' : 'BOOT_FAILED';
}

/** A store that cannot be read or answers nothing: not a reason to wipe anything, only to stop using it. */
const isStorageProblem = error => error?.code === 'STORAGE_UNAVAILABLE' || error?.code === 'IDB_HUNG';

// ---------------------------------------------------------------------------------------------------------------------------------

export function startStaticBoot(deps = {}) {
  for (const name of REQUIRED) if (deps[name] === undefined || deps[name] === null) throw new TypeError(`bootStaticSite needs deps.${name}`);
  if (!Number.isFinite(deps.build.buildAtMs)) throw new TypeError('bootStaticSite needs deps.build.buildAtMs (milliseconds since the epoch).');
  const win = deps.window, doc = deps.document;
  const now = typeof deps.now === 'function' ? deps.now : Date.now;
  const setTimer = typeof deps.setTimeout === 'function' ? deps.setTimeout : (fn, ms) => globalThis.setTimeout(fn, ms);
  const clearTimer = typeof deps.clearTimeout === 'function' ? deps.clearTimeout : handle => globalThis.clearTimeout(handle);
  const limits = { ...BOOT_TIMEOUTS, ...deps.timeouts };
  const log = (event, detail) => { try { deps.log?.(event, detail); } catch { /* a logger must not break the boot */ } };
  const local = deps.localStorage ?? null;
  const castNames = Array.isArray(deps.castNames) ? deps.castNames : [];
  const lockFor = deps.acquireWriterLock ?? acquireWriterLock;
  const reconcile = deps.reconcile ?? reconcileLocalStorage;
  const resetStorage = deps.resetStorage ?? resetStaticStorage;
  const makeMemoryStore = deps.createMemoryStore ?? createMemoryStore;
  const timers = { setTimer, clearTimer };
  Promise.resolve(deps.SQL).catch(() => {});             // a failure is reported by the boot when it gets there, not as an unhandled rejection

  const channel = channelOf(win.location?.pathname);
  const idbName = idbNameOf(channel);
  const build = { ...deps.build };
  const counters = { puts: 0, blobPuts: 0, failedPuts: 0, lastPutAt: null };
  const timings = {};
  const trace = [];
  const began = now();
  const mark = step => trace.push([step, now() - began]);

  const state = {
    phase: 'booting', stage: 'start', lock: null, lockHeld: true, store: null, counted: null, runtime: null, SQL: null, clock: null,
    memoryOnly: false, persistErrored: false, healed: false, discarded: false, seeded: false, world: null, autopilot: null, autopilotRefresh: null,
    autopilotError: null, error: null, resetting: null, disposed: false,
  };
  const listeners = [];                                   // the cast's identities (with tokens) are only ever passed on to the autopilot, never kept here

  // ---- the page: banner, toast, status text ----------------------------------------------------------------------------------
  const find = selector => { try { return typeof doc.querySelector === 'function' ? doc.querySelector(selector) : null; } catch { return null; } };

  const banner = { node: null, text: null, shown: '', dismissed: new Set() };
  function removeBanner() {
    try { banner.node?.parentNode?.removeChild(banner.node); } catch { /* already gone */ }
    banner.node = null; banner.text = null; banner.shown = '';
  }
  /** One slim notice at the top, dismissible. A read-only tab outranks a tab that cannot save: its words are the more important. */
  function renderBanner() {
    const text = !site.writable ? TEXT.readOnly : (site.memoryOnly ? TEXT.memoryOnly : '');
    if (!text || banner.dismissed.has(text) || state.disposed) { removeBanner(); return; }
    if (!banner.node) {
      const node = doc.createElement('div');
      node.id = 'space-boot-banner';
      node.setAttribute('role', 'status');
      node.style.cssText = BANNER_STYLE;
      const words = doc.createElement('span');
      words.style.cssText = 'flex:1 1 auto;min-width:0';
      const close = doc.createElement('button');
      close.type = 'button';
      close.textContent = TEXT.dismiss;
      close.setAttribute('aria-label', `${TEXT.dismiss}：关闭这条提示`);
      close.style.cssText = BANNER_BUTTON_STYLE;
      close.addEventListener('click', () => { banner.dismissed.add(banner.shown); removeBanner(); });
      node.appendChild(words);
      node.appendChild(close);
      (doc.body ?? doc.documentElement).appendChild(node);
      banner.node = node; banner.text = words;
    }
    banner.shown = text;
    banner.node.setAttribute('data-kind', text === TEXT.readOnly ? 'read-only' : 'memory-only');
    banner.text.textContent = text;
  }

  /** app.js's own toast, from the outside: same element, same class, same five seconds (its toast() function is private to that module). */
  function toast(message) {
    const node = find('#toast');
    if (!node) return;
    node.textContent = message;
    node.classList?.add('visible');
    clearTimer(node.timer);
    node.timer = setTimer(() => node.classList?.remove('visible'), 5000);
    node.timer?.unref?.();
  }

  const loading = { node: null, text: null };
  function showPreparing() {
    const status = find('#render-status');
    if (status) status.textContent = TEXT.preparing;
    const small = find('#loading small');
    if (small) {
      if (loading.node !== small) { loading.node = small; loading.text = small.textContent; }
      small.textContent = TEXT.preparing;
    }
  }
  function restoreLoading() {
    if (loading.node && loading.text !== null) loading.node.textContent = loading.text;
    loading.node = null; loading.text = null;
  }

  // ---- the live view -----------------------------------------------------------------------------------------------------------
  const site = {
    get channel() { return channel; },
    get idbName() { return idbName; },
    get build() { return { ...build }; },
    get phase() { return state.phase; },
    get writable() { return state.runtime ? state.runtime.writable : state.lockHeld; },
    /** Will the world survive a reload? A read-only tab saves nothing itself, so it asks the store; before the runtime exists: assume yes. */
    get persistent() {
      if (!state.runtime) return true;
      return state.runtime.writable ? state.runtime.persistent : Boolean(state.store?.persistent);
    },
    /** The data will not survive a reload: the store is the memory one, or a snapshot could not be saved and none has been saved since. */
    get memoryOnly() { return state.memoryOnly || (state.persistErrored && Boolean(state.runtime?.writable) && !state.runtime.persistent); },
    get healed() { return state.healed; },
    get fresh() { return state.seeded; },
    get lockReason() { return state.lock?.reason ?? null; },
    get roomCode() { return state.world?.roomCode ?? null; },
    get castIds() { return [...(state.world?.castIds ?? [])]; },
    /** { room, roomCode, castIds, castNames }: what the demo profile reads (showcase/demo-hooks.js getWorld). No tokens. */
    get world() { return state.world; },
    get runtime() { return state.runtime; },
    get store() { return state.store; },
    get clock() { return state.clock; },
    get autopilot() { return state.autopilot; },
    get autopilotError() { return state.autopilotError; },
    get error() { return state.error; },
    get timings() { return { ...timings }; },
    get trace() { return trace.map(entry => [...entry]); },
    stats: () => ({ ...counters, autopilot: state.autopilot?.state ? { ...state.autopilot.state } : null }),
    reset: () => reset(),
    flush: () => Promise.resolve(state.runtime?.flush?.()).catch(() => {}),
    dispose: () => dispose(),
  };

  /** What window.__SPACE_STATIC__ shows: the live view minus everything that can act (runtime, store, autopilot). */
  const handle = {
    get channel() { return channel; },
    get idbName() { return idbName; },
    get build() { return site.build; },
    get phase() { return state.phase; },
    get writable() { return site.writable; },
    get persistent() { return site.persistent; },
    get memoryOnly() { return site.memoryOnly; },
    get healed() { return state.healed; },
    get fresh() { return state.seeded; },
    get lockReason() { return site.lockReason; },
    get roomCode() { return site.roomCode; },
    get castIds() { return site.castIds; },
    get timings() { return site.timings; },
    stats: () => site.stats(),
    reset: () => reset(),
  };

  // ---- the store, the runtime and the world ------------------------------------------------------------------------------------
  function useStore(store, { memory = false } = {}) {
    const previous = state.store;
    state.store = store;
    state.counted = countingStore(store, counters, now, { onSaved: () => { if (state.persistErrored) setTimer(renderBanner, 0); } });
    if (previous && previous !== store) { try { previous.close?.(); } catch { /* already closed */ } }
    if (memory) { state.memoryOnly = true; renderBanner(); }
  }

  async function openStore() {
    const at = now();
    try { useStore(await deps.openStore(idbName)); }
    catch (error) { log('store-unavailable', error?.code ?? error?.name); useStore(makeMemoryStore(), { memory: true }); }
    timings.storeMs = now() - at;
  }

  function onPersistError(error) {
    state.persistErrored = true;
    log('persist-error', error?.code ?? error?.name ?? 'PERSIST_FAILED');
    renderBanner();
  }

  async function discardRuntime() {
    const runtime = state.runtime;
    state.runtime = null;
    renderBanner();                                     // a failed seed reports a persist error and may have raised the banner; the next runtime starts clean
    try { await runtime?.close?.(); } catch { /* it is going away anyway */ }
  }

  /** Empties the store (kv and blobs) and the event client's localStorage keys. A store that cannot be emptied is dropped for the memory store. */
  async function wipe() {
    try { await bounded(state.store.clear(), limits.wipeMs, 'WIPE_TIMEOUT', timers); }
    catch (error) { log('wipe-failed', error?.code ?? error?.name); useStore(makeMemoryStore(), { memory: true }); }
    clearEventClientStorage(local);
  }

  /** One try at a runtime (and, for the writer, the world on top of it). Throws what went wrong; `state.runtime` is the runtime that exists. */
  async function attempt({ writable }) {
    const at = now();
    state.stage = 'runtime';
    const options = { SQL: state.SQL, migrations: deps.migrations, storage: state.counted, clock: state.clock, rateLimits: false, persist: writable, writable, onPersistError };
    const creating = Promise.resolve().then(() => deps.createRuntime(options));
    const runtime = await bounded(creating, limits.runtimeMs, 'IDB_HUNG', { ...timers, onLate: late => late?.close?.() });
    state.runtime = runtime;
    timings.runtimeMs = now() - at;
    mark('runtime');
    if (!writable) { runtime.setWritable?.(false); return null; }          // already created read-only; said again so nothing can assume otherwise

    state.stage = 'reconcile';
    await reconcile({ storage: local, hasUser: id => databaseKnowsUser(runtime, id) });
    mark('reconcile');

    state.stage = 'seed';
    showPreparing();
    mark('status');
    const transport = createTransport(runtime, () => Promise.reject(new Error('The in-page showcase transport only answers /api/event and /api/avatar.')));
    const seeding = now();
    try { return await deps.ensureShowcase({ runtime, loadPhoto: file => deps.fetchBytes(`demo/${file}`), transport, clock: state.clock }); }
    finally { restoreLoading(); timings.seedMs = now() - seeding; mark('seed'); }
  }

  /** The writer's world, with the one self-heal. Resolves with ensureShowcase's world ({ people, room, ... }). */
  async function buildWorld() {
    let healTried = false;
    for (;;) {
      try { return await attempt({ writable: true }); }
      catch (error) {
        const lost = state.runtime;
        log('attempt-failed', { stage: state.stage, code: error?.code ?? error?.name });
        await discardRuntime();
        if (isStorageProblem(error) && !state.memoryOnly) { useStore(makeMemoryStore(), { memory: true }); continue; }
        if (healTried) throw error;
        healTried = true;
        state.healed = true;
        state.discarded = lost ? !lost.fresh : true;       // a first visit that failed to seed had nothing to throw away
        await wipe();
        mark('wipe');
      }
    }
  }

  /**
   * A world that was just laid out knows no room from before, so a ?room= in the address (a reload after a self-heal or after the browser
   * cleared IndexedDB, or a link somebody shared) can only be stale: the page would open on an error instead of the lobby. Other parameters stay.
   */
  function dropStaleRoomParam() {
    try {
      const search = win.location?.search ?? '';
      if (!/[?&]room=/.test(search) || typeof win.history?.replaceState !== 'function') return;
      const params = new URLSearchParams(search);
      params.delete('room');
      const rest = params.toString();
      win.history.replaceState(null, '', `${win.location.pathname}${rest ? `?${rest}` : ''}${win.location.hash ?? ''}`);
    } catch { /* the address stays as it is */ }
  }

  function startAutopilot(world) {
    try {
      const refresh = coalesced(() => deps.notifyChanged?.(), limits.coalesceMs, timers);
      const pilot = deps.createAutopilot({ people: world.people, room: world.room, now: state.clock, onChange: refresh, log: (...detail) => log('autopilot', detail), document: doc });
      pilot.start();
      state.autopilot = pilot;
      state.autopilotRefresh = refresh;
    } catch (error) {
      // The demo still works without it (nobody answers). Say so in the QA state instead of failing the whole boot.
      state.autopilotError = error;
      log('autopilot-failed', error?.message);
    }
  }

  // ---- the page's lifetime -------------------------------------------------------------------------------------------------------
  function listen(target, type, handler) {
    if (typeof target?.addEventListener !== 'function') return;
    target.addEventListener(type, handler);
    listeners.push([target, type, handler]);
  }
  function removeListeners() {
    for (const [target, type, handler] of listeners.splice(0)) { try { target.removeEventListener?.(type, handler); } catch { /* already gone */ } }
  }
  const releaseLock = () => Promise.resolve(state.lock?.release?.()).catch(() => {});
  /** Leaving (a reload, the hop to the Map, closing the tab): stop acting, store what is dirty, and give the lock to the next document. */
  function onPageHide() {
    try { state.autopilot?.stop(); } catch { /* stopping must not throw */ }
    void site.flush();
    void releaseLock();
  }
  function onVisibility() {
    if (doc.visibilityState === 'hidden') void site.flush();
  }

  async function teardown() {
    try { state.autopilot?.stop(); } catch { /* nothing to stop */ }
    state.autopilotRefresh?.cancel?.();
    try { await state.runtime?.close?.(); } catch { /* closing twice is fine */ }
    try { state.store?.close?.(); } catch { /* closed already */ }
    await releaseLock();
  }
  async function dispose() {
    state.disposed = true;
    removeListeners();
    removeBanner();
    await teardown();
  }

  /**
   * 「重置示例」: stop the cast, forget the world (the runtime's closed flag first, so a late pagehide flush cannot write it back), clear the
   * event client's keys, give the lock away, and reload the bare address (this drops ?room= and anything else in the query). A read-only tab
   * refuses: it would destroy the first tab's data. With no runtime (safe mode) the database is deleted without one. Always reloads, and
   * rejects with what went wrong, if anything did.
   */
  function reset() {
    if (!state.resetting) {
      if (!site.writable && state.phase !== 'failed') {
        const error = Object.assign(new Error(TEXT.readOnly), { code: 'READ_ONLY_COPY' });
        return Promise.reject(error);
      }
      state.resetting = doReset();
    }
    return state.resetting;
  }
  async function doReset() {
    try { state.autopilot?.stop(); } catch { /* stopping must not throw */ }
    state.autopilotRefresh?.cancel?.();
    let failure = null;
    try {
      let cleared = false;
      if (state.runtime) {
        try { await state.runtime.reset(); cleared = true; } catch (error) { failure = error; }
        try { state.store?.close?.(); } catch { /* closed already */ }
      }
      if (!cleared) {
        // No runtime (safe mode), or it could not clear its store: delete the whole database instead (works without a runtime).
        const outcome = await resetStorage({ idbName, storage: local, indexedDB: win.indexedDB ?? null, timeoutMs: limits.resetMs });
        if (outcome?.indexedDb === 'deleted' || outcome?.indexedDb === 'blocked' || outcome?.indexedDb === 'unavailable' || outcome?.indexedDb === 'skipped') failure = null;
        else failure = failure ?? Object.assign(new Error(`reset: IndexedDB ${outcome?.indexedDb ?? 'did not answer'}`), { code: 'RESET_FAILED' });
      }
      clearEventClientStorage(local);
      await bounded(releaseLock(), limits.resetMs, 'LOCK_RELEASE_TIMEOUT', timers).catch(() => {});
    } catch (error) {
      failure = failure ?? error;
    } finally {
      try { win.location.replace(win.location.pathname); } catch (error) { failure = failure ?? error; }
    }
    if (failure) throw failure;
  }

  // ---- the boot --------------------------------------------------------------------------------------------------------------------
  async function run() {
    win.__SPACE_STATIC__ = handle;
    win.__SPACE_BOOT__ = 'booting';
    if (doc.documentElement?.dataset) doc.documentElement.dataset.channel = channel;            // a
    mark('channel');

    state.stage = 'lock';
    const locking = now();
    state.lock = await lockFor({ locks: deps.navigator?.locks ?? null, ...deps.lockOptions });      // b
    state.lockHeld = state.lock.held !== false;
    timings.lockMs = now() - locking;
    mark('lock');
    listen(win, 'pagehide', onPageHide);                                                          // h
    listen(doc, 'visibilitychange', onVisibility);
    if (!state.lockHeld) renderBanner();

    state.stage = 'store';
    await openStore();                                                                           // c
    mark('store');

    state.stage = 'sql';
    try { state.SQL = await deps.SQL; }
    catch (cause) { throw new StaticBootError('SQL_INIT_FAILED', TEXT.failed, { cause, stage: 'sql' }); }
    mark('sql');
    state.clock = createBootClock({ buildAtMs: build.buildAtMs, now });                          // d

    let world = null;
    if (state.lockHeld) {
      world = await buildWorld();                                                                // d, e, f (and the self-heal)
      state.seeded = Boolean(world.seeded);
      state.world = {
        room: { id: world.room.id, code: world.room.code }, roomCode: world.room.code,
        castIds: Object.values(world.people).map(person => person.id),
        castNames: Object.values(world.people).map(person => person.npc?.name).filter(Boolean),
      };
    } else {
      state.stage = 'runtime';
      await attempt({ writable: false });                                                         // never wipes, never seeds
      state.world = await readWorld(state.runtime, castNames);
    }

    if (world) startAutopilot(world);                                                            // g
    if (state.seeded) dropStaleRoomParam();                                                      // before app.js reads the address
    state.phase = 'ready';
    state.stage = 'ready';
    win.__SPACE_BOOT__ = 'ready';                                                                // i
    timings.totalMs = now() - began;
    mark('ready');
    if (state.healed && state.discarded) toast(TEXT.healed);
    return site;
  }

  /** Second failure (or a failure that must not be healed): the rescue overlay, a failed flag, and everything released. */
  async function failBoot(error) {
    const code = failureCode(error, state.stage);
    const failure = error instanceof StaticBootError ? error : new StaticBootError(code, TEXT.failed, { cause: error, stage: state.stage });
    state.error = failure;
    state.phase = 'failed';
    state.stage = 'failed';
    win.__SPACE_BOOT__ = `failed:${failure.code}`;
    restoreLoading();
    removeListeners();
    await teardown();
    try { win.__SPACE_RESCUE__?.show?.(`failed:${failure.code}`); } catch { /* the overlay is a courtesy */ }
    log('failed', failure.code);
    return failure;
  }

  const ready = (async () => {
    try { return await run(); } catch (error) { throw await failBoot(error); }
  })();
  ready.catch(() => {});                          // whoever awaits `ready` sees the rejection; nobody else gets an unhandled-rejection report

  return { site, ready };
}

/** The whole boot as one promise of the live view (see startStaticBoot). */
export const bootStaticSite = deps => startStaticBoot(deps).ready;

// ---------------------------------------------------------------------------------------------------------------------------------
// The pieces profile.js assembles, kept here so Node can test them.

/**
 * Replaces the page's fetch with the in-page transport and returns it. Every API client of the page (four exist, and each defaults to
 * globalThis.fetch when it is built) must see this before it is constructed, so profile.js calls it at module evaluation.
 * `getRuntime` is what the transport waits for: a runtime, a promise of one, or a function returning either.
 */
export function installStaticFetch({ target = globalThis, getRuntime, nativeFetch } = {}) {
  const native = typeof nativeFetch === 'function' ? nativeFetch : target.fetch.bind(target);
  const staticFetch = createTransport(getRuntime, native);
  target.fetch = staticFetch;
  return { staticFetch, nativeFetch: native };
}

/**
 * fetchBytes(path) for the demo photos: a site-relative path in, the file's bytes out. Two retries with a growing pause and a per-try
 * timeout: a flaky connection on the first visit should cost a second, not the seed (a failed seed is a failed boot).
 *
 * fetchBytes.prefetch(paths) starts downloads at low priority and keeps their promises, so a later fetchBytes(path) shares the one request
 * (or gets the bytes at once). The profile prefetches the cast photos while sql.js is still starting: on a first visit the seed would
 * otherwise wait for them after everything else. A prefetch that failed is simply asked again by the fetchBytes that needs it.
 */
export function createByteLoader({ fetch: fetcher, resolve = path => path, retries = 2, timeoutMs = 12_000, delayMs = 400, sleep, setTimeout: setTimer, clearTimeout: clearTimer } = {}) {
  if (typeof fetcher !== 'function') throw new TypeError('createByteLoader needs a fetch function.');
  const timer = setTimer ?? ((fn, ms) => globalThis.setTimeout(fn, ms));
  const clear = clearTimer ?? (handle => globalThis.clearTimeout(handle));
  const pause = sleep ?? (ms => new Promise(done => globalThis.setTimeout(done, ms)));
  const started = new Map();
  async function download(path, priority) {
    let last;
    for (let attemptNumber = 0; attemptNumber <= retries; attemptNumber += 1) {
      if (attemptNumber) await pause(delayMs * 2 ** (attemptNumber - 1));
      const abort = typeof AbortController === 'function' ? new AbortController() : null;
      const alarm = abort ? timer(() => abort.abort(), timeoutMs) : null;
      const init = { ...(abort ? { signal: abort.signal } : {}), ...(priority ? { priority } : {}) };
      try {
        const response = await fetcher(resolve(path), Object.keys(init).length ? init : undefined);
        if (!response.ok) throw new Error(`HTTP ${response.status} for ${path}`);
        return new Uint8Array(await response.arrayBuffer());
      } catch (error) { last = error; } finally { if (alarm !== null) clear(alarm); }
    }
    throw last;
  }
  function fetchBytes(path) {
    const early = started.get(path);
    if (!early) return download(path);
    return early.catch(() => { started.delete(path); return download(path); });
  }
  fetchBytes.prefetch = paths => {
    for (const path of paths) {
      if (started.has(path)) continue;
      const promise = download(path, 'low');
      promise.catch(() => {});                       // nobody is waiting yet: a failure is only noticed by the fetchBytes that needs the file
      started.set(path, promise);
    }
  };
  return fetchBytes;
}

/**
 * The two bundled example photos as profile.demo wants them: samples (for the list and the tour) and load(id) -> File. `resolve` turns a
 * site-relative path into an absolute URL (siteUrl); the list is built on every read because that needs the page's <meta> hints.
 */
export function createSamples({ samples, fetchBytes, resolve = path => path } = {}) {
  const byId = new Map((samples ?? []).map(sample => [sample.id, sample]));
  return {
    list: () => (samples ?? []).map(({ id, label, note, file }) => ({ id, label, note, thumbUrl: resolve(`demo/${file}`) })),
    async load(id) {
      const sample = byId.get(id);
      if (!sample) throw new Error('找不到这张示例照片');
      return new File([await fetchBytes(`demo/${sample.file}`)], sample.file, { type: 'image/jpeg' });
    },
  };
}
