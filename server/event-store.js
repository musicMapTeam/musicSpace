import { createAvatarStore } from './avatar-store.js';
import { readFileSync } from 'node:fs';

// One additive schema source for local SQLite and D1. Existing migrations stay immutable.
const socialSchema = ['0002_event_social.sql', '0003_event_chat.sql', '0004_event_exchanges.sql', '0005_event_moderation.sql', '0006_event_participation.sql'].map(name =>
  readFileSync(new URL('../runtime-preview/drizzle/' + name, import.meta.url), 'utf8')
    .replace(/CREATE TABLE /g, 'CREATE TABLE IF NOT EXISTS ').replace(/CREATE (UNIQUE )?INDEX /g, 'CREATE $1INDEX IF NOT EXISTS ')
).join('\n');

/** Local SQLite implements the same transactional binding used by the D1 worker.
 * Image bytes stay in the private SQLite file, never a static directory.
 */
export function createEventStore(options = {}) {
  const store = createAvatarStore(options);
  // An explicitly injected clock keeps deterministic tests on the same clock
  // as the API. Normal runtime and D1 use SQLite's built-in strftime unchanged.
  // The callback executes inside SQLite, not when a query/batch is prepared.
  if (options.clock) store.db.function('strftime', { deterministic: false }, (format, source) => {
    if (format !== '%Y-%m-%dT%H:%M:%fZ' || source !== 'now') throw new Error('Unsupported injected SQL clock expression');
    return new Date(options.clock()).toISOString();
  });
  store.db.exec(socialSchema);
  store.db.exec('CREATE TABLE IF NOT EXISTS event_photo_blobs (key TEXT PRIMARY KEY, bytes BLOB NOT NULL)');
  function execute(prepared) {
    const statement = store.db.prepare(prepared.query);
    if (statement.columns().length) return { success: true, results: statement.all(...prepared.args), meta: { changes: 0 } };
    const result = statement.run(...prepared.args);
    return { success: true, results: [], meta: { changes: Number(result.changes) } };
  }
  const DB = {
    prepare(query) { return { query, args: [], bind(...args) { return { ...this, args }; }, async first() { return execute(this).results[0] || null; }, async all() { return execute(this); }, async run() { return execute(this); } }; },
    async batch(statements) { return store.transaction(() => statements.map(execute)); },
  };
  const PHOTOS = {
    async put(key, bytes) { store.run('INSERT INTO event_photo_blobs (key,bytes) VALUES (?,?)', key, Buffer.from(bytes)); },
    async get(key) { const row = store.get('SELECT bytes FROM event_photo_blobs WHERE key = ?', key); return row ? { body: row.bytes } : null; },
    async delete(key) { store.run('DELETE FROM event_photo_blobs WHERE key = ?', key); },
  };
  return { DB, PHOTOS, close: store.close };
}
