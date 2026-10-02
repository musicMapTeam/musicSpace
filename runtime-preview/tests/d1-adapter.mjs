import { DatabaseSync } from 'node:sqlite';
import { createAvatarWorker } from '../src/avatar-worker.js';
import { readFileSync, readdirSync } from 'node:fs';
const migrationDir = new URL('../drizzle/', import.meta.url);
const migration = readdirSync(migrationDir).filter(name => name.endsWith('.sql')).sort().map(name => readFileSync(new URL(name, migrationDir), 'utf8')).join('\n');
const blobsByFile = new Map();
export function makeD1(file, { clock } = {}) {
  const sql = new DatabaseSync(file);
  // Production D1 uses its built-in SQL clock. Only an explicit test clock
  // overrides this exact two-argument call, evaluated during sqlite3_step.
  if (clock) sql.function('strftime', { deterministic: false }, (format, source) => {
    if (format !== '%Y-%m-%dT%H:%M:%fZ' || source !== 'now') throw new Error('Unsupported injected SQL clock expression');
    return new Date(clock()).toISOString();
  });
  if (!sql.prepare("SELECT name FROM sqlite_master WHERE name = 'avatar_meta'").get()) sql.exec(migration);
  sql.exec('PRAGMA foreign_keys=ON');
  function execute(prepared) {
    if (DB.readFailures && prepared.query.startsWith('SELECT')) { DB.readFailures--; throw Error('Temporary read outage'); }
    const query = sql.prepare(prepared.query);
    if (query.columns().length) return { success: true, results: query.all(...prepared.args), meta: { changes: 0 } };
    const result = query.run(...prepared.args);
    return { success: true, results: [], meta: { changes: Number(result.changes) } };
  }
  const DB = {
    prepare(query) { return { query, args: [], bind(...args) { return { ...this, args }; }, async first() { return execute(this).results[0] || null; }, async all() { return execute(this); }, async run() { return execute(this); } }; },
    withSession(mode) { if (mode !== 'first-primary') throw Error('Expected primary'); return this; },
    async batch(statements) {
      sql.exec('BEGIN IMMEDIATE');
      let results;
      try { results = statements.map(execute); sql.exec('COMMIT'); }
      catch (error) { sql.exec('ROLLBACK'); throw error; }
      if (DB.failAfterCommit && statements.some(s => s.query.startsWith('INSERT INTO avatar_idempotency'))) { DB.failAfterCommit = false; if (DB.blockRecoveryReads) DB.readFailures = 2; throw Error('Transport disappeared after commit'); }
      return results;
    },
    close() { sql.close(); }, sql,
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
