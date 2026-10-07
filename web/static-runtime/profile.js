// The static (GitHub Pages) profile of the event room: the in-page room service, the seeded cast, and everything the page says about
// itself. vite.static.config.js aliases web/event-room/runtime-profile.js (the Node-server profile) to this file, and app.js imports the
// profile FIRST, so this module is evaluated before any API client exists. At evaluation it
//   1. replaces globalThis.fetch with the in-page transport (every client of the page defaults to it: /api/event and /api/avatar are
//      answered inside the page, everything else goes to the network untouched),
//   2. starts sql.js (the wasm download begins at once) and the boot (web/static-runtime/boot.js) in parallel, and
//   3. exports `profile`: ready resolves when the world is laid out and rejects in safe mode (the rescue overlay is up by then).
// This is the ONLY Vite-specific module of the static runtime (import.meta.glob, the CSS import, the sql.js browser build): boot.js and
// the rest are plain ESM that Node tests import.
import './demo.css';
import initSqlJs from 'sql.js/dist/sql-wasm-browser.js';
import { createStaticRuntime } from './runtime.js';
import { openIdbStore } from './idb-store.js';
import { ensureShowcase } from './showcase/seed.js';
import { createAutopilot } from './showcase/autopilot.js';
import { createDemoProfile } from './showcase/demo-hooks.js';
import { copy } from './showcase/copy.js';
import { NPCS, SAMPLE_PHOTOS, EVENT_DATE } from './showcase/roster.js';
import { startStaticBoot, installStaticFetch, createByteLoader, createSamples } from './boot.js';
import { siteUrl } from '../shared/site-base.js';

// Every migration of the room service, in file-name order (0000_ ... 0013_): the ledger inside the database records their hashes.
const sources = import.meta.glob('../../runtime-preview/drizzle/*.sql', { query: '?raw', import: 'default', eager: true });
const migrations = Object.keys(sources).sort().map(path => ({ name: path.split('/').pop(), sql: sources[path] }));

// vite.static.config.js defines __SPACE_BUILD__ ({ version, commit, builtAt, buildAtMs }); a dev server has no such define.
const build = typeof __SPACE_BUILD__ !== 'undefined'
  ? __SPACE_BUILD__
  : { version: 'dev', commit: 'dev', builtAt: '2026-10-05T00:00:00.000Z', buildAtMs: Date.parse('2026-10-05T00:00:00.000Z') };

// 1. The page's fetch. nativeFetch is kept for what is not ours (sql.js's wasm, the demo photos, the model files).
const nativeFetch = globalThis.fetch.bind(globalThis);
let started = null;
const { staticFetch } = installStaticFetch({ getRuntime: () => started.ready.then(site => site.runtime), nativeFetch });

// 2. sql.js and the boot. The wasm path is the one T2's <link rel=preload> names, so the preload is consumed, not wasted.
const SQL = initSqlJs({ locateFile: () => siteUrl('sql/sql-wasm.wasm') });
const fetchBytes = createByteLoader({ fetch: nativeFetch, resolve: siteUrl });
// The cast's photos are what a first visit waits for after sql.js: they download while it starts (and are kept for the seed). A returning
// visitor's browser answers them from its cache.
fetchBytes.prefetch(NPCS.flatMap(npc => npc.photos.map(photo => `demo/${photo.file}`)));
const samples = createSamples({ samples: SAMPLE_PHOTOS, fetchBytes, resolve: siteUrl });
let demo = null;
started = startStaticBoot({
  SQL, migrations, build, window, document, navigator, fetchBytes,
  localStorage: (() => { try { return window.localStorage; } catch { return null; } })(),
  openStore: name => openIdbStore(name),
  createRuntime: createStaticRuntime, ensureShowcase, createAutopilot,
  castNames: NPCS.map(npc => npc.name),
  notifyChanged: () => demo?.notifyChanged(),
});
const ready = started.ready.then(() => undefined);
ready.catch(() => {});                       // app.js and the demo hooks handle a rejection; nobody else should get an unhandled-rejection report
ready.then(() => fetchBytes.prefetch(SAMPLE_PHOTOS.map(sample => `demo/${sample.file}`)), () => {});    // the two ready-made photos, ready before the tour card asks

demo = createDemoProfile({
  getWorld: () => started.site.world,
  eventDate: EVENT_DATE,
  samples: () => samples.list(),
  loadSample: id => samples.load(id),
  build: { version: build.version, commit: build.commit, builtAt: build.builtAt },
  channel: started.site.channel,
  persistent: () => started.site.persistent,
  readOnly: () => !started.site.writable,
  reset: () => started.site.reset(),
  quietReload: () => started.site.healReload,
  ready,
});

export { staticFetch };
export const profile = {
  mode: 'static',
  channel: started.site.channel,
  ready,
  controllerOptions: () => ({ fetch: staticFetch }),
  copy,
  demo,
};
