// Same surface as d1-adapter.mjs (makeD1 / createFakeEnv / createAvatarApi), but the database is sql.js (SQLite compiled to WASM): the exact
// engine and D1 shim the in-browser runtime uses (web/static-runtime/d1-sqljs.js). scripts/test/sqljs-loader.mjs hands every
// `d1-adapter.mjs` import to this file, so the repo's own Worker-mode tests run against the browser stack unchanged:
//   node --import ./scripts/test/sqljs-register.mjs --test runtime-preview/tests/*.test.mjs   (npm run test:static does this)
//
// Fidelity rules, all checked by running the existing suite on it:
//  - file-backed like the Node adapter: the file is read when the database is opened, rewritten after every write and on close, so a test
//    can restart a worker on the same path, or open the file with node:sqlite to READ rows. (A test that EDITS the file while a worker holds
//    it open cannot work here, sql.js keeps its own copy in memory; those tests skip themselves when SPACE_TEST_ENGINE is 'sqljs'.)
//  - ':memory:' (and '') never touch the disk.
//  - the injected test clock (`strftime('%Y-%m-%dT%H:%M:%fZ','now')`) is installed again after every export: sql.js drops
//    application-defined functions whenever it serialises the database.
//  - DB.sql is the raw database behind the same prepare().get/all/run and exec() calls node:sqlite offers; its writes are persisted too.
//  - readFailures / failAfterCommit / blockRecoveryReads behave exactly as in d1-adapter.mjs.
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { createAvatarWorker } from '../src/avatar-worker.js';
import { createD1 } from '../../web/static-runtime/d1-sqljs.js';

/** Lets scripts/test/static-suite.mjs prove that the redirect really happened (the Node adapter has no such export). */
export const ENGINE = 'sqljs';

const require = createRequire(import.meta.url);
const SQL = await (require('sql.js'))();
const migrationDir = new URL('../drizzle/', import.meta.url);
const migration = readdirSync(migrationDir).filter(name => name.endsWith('.sql')).sort().map(name => readFileSync(new URL(name, migrationDir), 'utf8')).join('\n');
const blobsByFile = new Map();
const isMemory = file => file === ':memory:' || file === '';

const hasSchema = db => db.exec("SELECT 1 FROM sqlite_master WHERE name = 'avatar_meta'").length > 0;

export function makeD1(file, { clock } = {}) {
  const durable = !isMemory(file);
  const saved = durable && existsSync(file) ? readFileSync(file) : null;
  if (durable && !saved && !existsSync(dirname(file))) throw new Error('unable to open database file');   // what node:sqlite says for a missing directory
  const holder = {};
  const d1 = createD1({ SQL, bytes: saved && saved.length ? saved : null, onWrite: () => holder.persist() });
  const db = d1.sql();
  // sql.js drops application-defined functions whenever it serialises the database, so the injected clock is installed again after each export.
  const installClock = () => { if (clock) db.create_function('strftime', (format, source) => {
    if (format !== '%Y-%m-%dT%H:%M:%fZ' || source !== 'now') throw new Error('Unsupported injected SQL clock expression');
    return new Date(clock()).toISOString();
  }); };
  // A test may remove its temporary directory while a late write is still landing. node:sqlite keeps writing to the unlinked file without
  // complaint, so a vanished directory is not an error here either.
  const writeFile = () => { try { writeFileSync(file, d1.exportBytes()); } catch (error) { if (error?.code !== 'ENOENT') throw error; } };
  holder.persist = () => { if (durable) writeFile(); installClock(); };
  installClock();
  // Same rule as the Node adapter: the schema goes in unless it is already there (a missing or empty file is a new database).
  if (!hasSchema(db)) { db.exec(migration); holder.persist(); }
  let closed = false;

  // The raw connection behind DB.sql, shaped like the node:sqlite handle the Node adapter exposes. Every write through it is persisted too.
  const sqlFacade = {
    prepare: query => ({
      all: (...args) => { const s = db.prepare(query); try { if (args.length) s.bind(args); const rows = []; while (s.step()) rows.push(s.getAsObject()); return rows; } finally { s.free(); } },
      get(...args) { return this.all(...args)[0]; },
      run: (...args) => {
        const s = db.prepare(query);
        let changes;
        try { if (args.length) s.bind(args); s.step(); changes = db.getRowsModified(); } finally { s.free(); }
        holder.persist();   // also after DDL, where getRowsModified() still reports the previous statement's count
        return { changes };
      },
    }),
    exec: query => { db.exec(query); holder.persist(); },
    close: () => DB.close(),
  };

  const DB = {
    prepare: d1.DB.prepare,
    withSession(mode) { if (mode !== 'first-primary') throw Error('Expected primary'); return this; },
    async batch(statements) {
      if (DB.readFailures && statements.some(s => s.query.startsWith('SELECT'))) { DB.readFailures--; throw Error('Temporary read outage'); }
      const results = await d1.DB.batch(statements);
      if (DB.failAfterCommit && statements.some(s => s.query.startsWith('INSERT INTO avatar_idempotency'))) { DB.failAfterCommit = false; if (DB.blockRecoveryReads) DB.readFailures = 2; throw Error('Transport disappeared after commit'); }
      return results;
    },
    close() { if (closed) return; closed = true; if (durable) writeFile(); d1.close(); },
    sql: sqlFacade,
  };
  const prepare = DB.prepare;
  DB.prepare = query => {
    const read = String(query).startsWith('SELECT');
    const outage = () => { if (DB.readFailures && read) { DB.readFailures--; throw Error('Temporary read outage'); } };
    const guarded = prepared => ({ ...prepared, bind: (...args) => guarded(prepared.bind(...args)),
      async first(column) { outage(); return prepared.first(column); },
      async all() { outage(); return prepared.all(); },
      async run() { outage(); return prepared.run(); } });
    return guarded(prepare(query));
  };
  return DB;
}

export function createFakeEnv(file, options) {
  const DB = makeD1(file, options);
  if (!blobsByFile.has(file)) blobsByFile.set(file, new Map());
  const blobs = blobsByFile.get(file);
  return { DB, PHOTOS: {
    async put(key, bytes) { blobs.set(key, Buffer.from(bytes)); },
    async get(key) { return blobs.has(key) ? { body: new Uint8Array(blobs.get(key)) } : null; },
    async delete(key) { blobs.delete(key); }, blobs,
  }, ASSETS: { async fetch() { return new Response('<!doctype html><title>Music Space</title>', { headers: { 'Content-Type': 'text/html' } }); } } };
}

export function createAvatarApi({ dataDir, databasePath, clock, rateLimits } = {}) {
  const env = createFakeEnv(databasePath || dataDir + '/avatar-space.sqlite', { clock });
  const worker = createAvatarWorker({ clock, rateLimits });
  const api = async (request, response) => {
    if (!request.url.startsWith('/api/avatar')) return false;
    const pending = [];
    const chunks = []; for await (const chunk of request) chunks.push(chunk);
    const req = new Request('https://musicspace.test' + request.url, { method: request.method, headers: request.headers,
      ...(['GET','HEAD'].includes(request.method) ? {} : { body: Buffer.concat(chunks), duplex: 'half' }) });
    const result = await worker.fetch(req, env, { waitUntil: promise => pending.push(promise) });
    response.writeHead(result.status, Object.fromEntries(result.headers));
    response.end(Buffer.from(await result.arrayBuffer()));
    await Promise.all(pending);
    return true;
  };
  api.close = () => env.DB.close();
  api.env = env;
  return api;
}
