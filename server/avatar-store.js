import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

/** Independent storage: importing the avatar API never changes the live database. */
export function createAvatarStore({ dataDir, databasePath } = {}) {
  const projectRoot = fileURLToPath(new URL('../', import.meta.url));
  const file = databasePath || resolve(dataDir || process.env.DATA_DIR || resolve(projectRoot, 'data'), 'avatar-space.sqlite');
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(file, { timeout: 3000 });
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS avatar_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS avatar_users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, avatar TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE, revision INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS avatar_compositions (
      id TEXT PRIMARY KEY, host_id TEXT NOT NULL REFERENCES avatar_users(id),
      guest_id TEXT REFERENCES avatar_users(id), snapshot TEXT NOT NULL,
      revision INTEGER NOT NULL, content_revision INTEGER NOT NULL,
      photo BLOB, invite_hash TEXT UNIQUE, invite_expires_at TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      CHECK (guest_id IS NULL OR host_id != guest_id)
    );
    CREATE INDEX IF NOT EXISTS avatar_host ON avatar_compositions(host_id, updated_at);
    CREATE INDEX IF NOT EXISTS avatar_guest ON avatar_compositions(guest_id, updated_at);
    CREATE TABLE IF NOT EXISTS avatar_idempotency (
      actor_id TEXT NOT NULL, key_hash TEXT NOT NULL, request_hash TEXT NOT NULL,
      status INTEGER NOT NULL, response TEXT NOT NULL, capability_kind TEXT,
      created_at TEXT NOT NULL, PRIMARY KEY (actor_id, key_hash)
    );
  `);
  // Additive event schema; existing avatar rows and composition permissions are unchanged.
  db.exec(`CREATE TABLE IF NOT EXISTS event_idempotency (
	actor_id text NOT NULL,
	key_hash text NOT NULL,
	request_hash text NOT NULL,
	status integer NOT NULL,
	response text NOT NULL,
	created_at text NOT NULL,
	PRIMARY KEY(actor_id, key_hash)
);

CREATE TABLE IF NOT EXISTS event_members (
	room_id text NOT NULL,
	user_id text NOT NULL,
	joined_at text NOT NULL,
	left_at text,
	PRIMARY KEY(room_id, user_id),
	FOREIGN KEY (room_id) REFERENCES event_rooms(id) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (user_id) REFERENCES avatar_users(id) ON UPDATE no action ON DELETE no action
);

CREATE INDEX IF NOT EXISTS event_member_user ON event_members (user_id,left_at);
CREATE TABLE IF NOT EXISTS event_mutation_guard (
	id text PRIMARY KEY NOT NULL,
	assertion integer NOT NULL,
	CONSTRAINT "event_mutation_guard_assertion" CHECK("event_mutation_guard"."assertion" = 1)
);

CREATE TABLE IF NOT EXISTS event_photos (
	id text PRIMARY KEY NOT NULL,
	room_id text NOT NULL,
	owner_id text NOT NULL,
	photo_key text,
	visibility text NOT NULL,
	revision integer DEFAULT 1 NOT NULL,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	deleted_at text,
	FOREIGN KEY (room_id) REFERENCES event_rooms(id) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (owner_id) REFERENCES avatar_users(id) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "event_photo_visibility" CHECK("event_photos"."visibility" IN ('private', 'members')),
	CONSTRAINT "event_photo_storage" CHECK(("event_photos"."deleted_at" IS NULL AND "event_photos"."photo_key" IS NOT NULL) OR ("event_photos"."deleted_at" IS NOT NULL AND "event_photos"."photo_key" IS NULL))
);

CREATE INDEX IF NOT EXISTS event_photo_room ON event_photos (room_id,deleted_at);
CREATE INDEX IF NOT EXISTS event_photo_owner ON event_photos (owner_id,created_at);
CREATE INDEX IF NOT EXISTS event_photo_key ON event_photos (photo_key) WHERE "event_photos"."photo_key" IS NOT NULL;
CREATE TABLE IF NOT EXISTS event_rate_limits (
	key text PRIMARY KEY NOT NULL,
	count integer NOT NULL,
	reset_at integer NOT NULL
);

CREATE INDEX IF NOT EXISTS event_rate_expiry ON event_rate_limits (reset_at);
CREATE TABLE IF NOT EXISTS event_rooms (
	id text PRIMARY KEY NOT NULL,
	code text NOT NULL,
	host_id text NOT NULL,
	title text NOT NULL,
	venue text DEFAULT '' NOT NULL,
	song_id text NOT NULL,
	revision integer DEFAULT 1 NOT NULL,
	created_at text NOT NULL,
	expires_at text NOT NULL,
	closed_at text,
	FOREIGN KEY (host_id) REFERENCES avatar_users(id) ON UPDATE no action ON DELETE no action
);

CREATE UNIQUE INDEX IF NOT EXISTS event_rooms_code_unique ON event_rooms (code);
CREATE INDEX IF NOT EXISTS event_room_host ON event_rooms (host_id,created_at);`);
  const get = (sql, ...values) => db.prepare(sql).get(...values);
  const all = (sql, ...values) => db.prepare(sql).all(...values);
  const run = (sql, ...values) => db.prepare(sql).run(...values);
  run('INSERT OR IGNORE INTO avatar_meta (key, value) VALUES (?, ?)', 'capability_secret', randomBytes(32).toString('hex'));
  const secret = Buffer.from(get('SELECT value FROM avatar_meta WHERE key = ?', 'capability_secret').value, 'hex');
  function transaction(callback) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = callback();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
  return { db, get, all, run, transaction, secret, close: () => db.close() };
}
