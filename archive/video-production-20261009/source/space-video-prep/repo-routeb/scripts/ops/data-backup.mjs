import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { closeSync, existsSync, lstatSync, mkdirSync, openSync, readSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync, writeSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const MANIFEST = '.musicspace-backup.json';
const DATABASES = ['music-map.sqlite', 'avatar-space.sqlite'];
const inside = (parent, child) => { const r = relative(parent, child); return !r || (!r.startsWith('..' + sep) && r !== '..' && !isAbsolute(r)); };
function streamFile(source, output) {
  const input = openSync(source, 'r'), hash = createHash('sha256'), chunk = Buffer.alloc(1024 * 1024);
  let target, bytes = 0;
  try {
    if (output) target = openSync(output, 'wx', 0o600);
    let size;
    while ((size = readSync(input, chunk, 0, chunk.length, null)) !== 0) {
      hash.update(chunk.subarray(0, size)); bytes += size;
      if (target !== undefined) { let written = 0; while (written < size) written += writeSync(target, chunk, written, size - written); }
    }
    return { bytes, sha256: hash.digest('hex') };
  } finally { closeSync(input); if (target !== undefined) closeSync(target); }
}

function sourceRoot(value) {
  const p = resolve(value);
  if (lstatSync(p).isSymbolicLink() || !lstatSync(p).isDirectory()) throw new Error('Source must be a real directory, not a link');
  return realpathSync(p);
}
function destinationRoot(value, source) {
  const lexical = resolve(value);
  const parent = realpathSync(dirname(lexical));
  const p = join(parent, basename(lexical));
  if (existsSync(p)) throw new Error('Destination already exists; original data will not be overwritten');
  if (inside(source, p) || inside(p, source)) throw new Error('Source and destination must be separate directories');
  return p;
}
function safeRelative(p) {
  if (typeof p !== 'string' || !p || /[\\:\x00-\x1f]/.test(p) || isAbsolute(p) || p.split('/').some(s => !s || s === '.' || s === '..' || /[. ]$/.test(s) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(s))) throw new Error('Unsafe backup path');
  return p;
}
function files(root, dir = root) {
  return readdirSync(dir).sort().flatMap(name => {
    const full = join(dir, name), stat = lstatSync(full);
    if (stat.isSymbolicLink()) throw new Error('Links are not allowed in a data backup');
    if (stat.isDirectory()) return files(root, full);
    if (!stat.isFile()) throw new Error('Only regular files are allowed');
    return [safeRelative(relative(root, full).split(sep).join('/'))];
  });
}
function snapshot(root, { manifest = false } = {}) {
  const names = files(root), seen = new Set();
  for (const name of names) {
    if (seen.has(name.toLowerCase())) throw new Error('Duplicate case-insensitive paths');
    seen.add(name.toLowerCase());
    if (/(?:-wal|-shm|-journal)$/.test(name)) throw new Error('SQLite journal present; stop every service normally before copying');
    if (!manifest && name === MANIFEST) throw new Error('DATA_DIR must not be a backup directory');
  }
  return names.filter(p => p !== MANIFEST).map(path => ({ path, ...streamFile(join(root, path)) }));
}
function validateDatabases(root) {
  for (const name of DATABASES) {
    // This function is used only on the newly created copy, never on the source.
    // A read-only WAL connection leaves empty WAL/SHM files behind on Windows;
    // a writable connection removes its own journals on close. Queries are read-
    // only and the entire copied database must still match its original hash.
    const db = new DatabaseSync(join(root, name));
    try {
      const integrity = db.prepare('PRAGMA integrity_check').all();
      if (integrity.length !== 1 || Object.values(integrity[0])[0] !== 'ok') throw new Error('SQLite integrity check failed: ' + name);
      if (db.prepare('PRAGMA foreign_key_check').all().length) throw new Error('SQLite foreign-key check failed: ' + name);
      if (name === 'avatar-space.sqlite') {
        const has = table => Boolean(db.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name=?").get(table));
        if (!has('avatar_meta') || !has('event_photos') || !has('event_photo_blobs')) throw new Error('Not a complete Music Space event database');
        const secret = db.prepare("SELECT length(value) AS size FROM avatar_meta WHERE key='capability_secret'").get();
        if (secret?.size !== 64) throw new Error('Persistent identity signing key missing');
        const missing = db.prepare('SELECT count(*) AS n FROM event_photos p LEFT JOIN event_photo_blobs b ON b.key=p.photo_key WHERE p.deleted_at IS NULL AND b.key IS NULL').get();
        if (missing.n) throw new Error('Photo metadata references missing image bytes');
        if (has('event_exchanges')) {
          const previews = db.prepare("SELECT count(*) AS n FROM event_exchanges e LEFT JOIN event_photo_blobs b ON b.key=e.preview_key WHERE e.status IN ('pending','accepted') AND b.key IS NULL").get();
          if (previews.n) throw new Error('Exchange preview references missing image bytes');
        }
      }
    } finally { db.close(); }
  }
}
function assertSame(a, b) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error('Data changed or checksum mismatch; backup/restore refused'); }
function copyFiles(source, target, entries) {
  for (const e of entries) {
    const targetFile = join(target, safeRelative(e.path));
    mkdirSync(dirname(targetFile), { recursive: true, mode: 0o700 });
    const actual = streamFile(join(source, e.path), targetFile);
    if (actual.bytes !== e.bytes || actual.sha256 !== e.sha256) throw new Error('Checksum mismatch during copy');
  }
}
function createNewDirectory(target, callback) {
  // Exclusive directory creation refuses both an existing target and a concurrent
  // backup/restore using the same name. Never remove a directory we did not create.
  mkdirSync(target, { mode: 0o700 });
  try { return callback(); }
  catch (error) {
    // target is the already validated absolute destination, created by this call.
    if (resolve(target) !== target || !lstatSync(target).isDirectory() || lstatSync(target).isSymbolicLink()) throw error;
    rmSync(target, { recursive: true, force: true });
    throw error;
  }
}
export function backupData({ dataDir, output, serviceStopped = false }) {
  if (!serviceStopped) throw new Error('Explicit serviceStopped confirmation is required');
  const source = sourceRoot(dataDir), target = destinationRoot(output, source);
  const before = snapshot(source);
  if (!DATABASES.every(name => before.some(e => e.path === name))) throw new Error('Both Music Space databases are required');
  return createNewDirectory(target, () => {
    copyFiles(source, target, before);
    validateDatabases(target);
    assertSame(before, snapshot(target));
    assertSame(before, snapshot(source));
    const manifest = { format: 'musicspace-offline-backup', version: 1, createdAt: new Date().toISOString(), files: before };
    // The manifest is the completion marker, written only after every check passes.
    writeFileSync(join(target, MANIFEST), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    return { directory: target, files: before.length, verified: true };
  });
}
export function verifyBackup(input) {
  const source = sourceRoot(input);
  const manifestPath = join(source, MANIFEST);
  if (lstatSync(manifestPath).isSymbolicLink()) throw new Error('Manifest cannot be a link');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (manifest.format !== 'musicspace-offline-backup' || manifest.version !== 1 || !Array.isArray(manifest.files)) throw new Error('Unsupported backup manifest');
  const seen = new Set();
  for (const e of manifest.files) {
    safeRelative(e.path);
    if (seen.has(e.path.toLowerCase()) || e.path === MANIFEST || !Number.isSafeInteger(e.bytes) || e.bytes < 0 || !/^[0-9a-f]{64}$/.test(e.sha256)) throw new Error('Invalid backup manifest entry');
    seen.add(e.path.toLowerCase());
  }
  if (!DATABASES.every(name => seen.has(name))) throw new Error('Both databases must be present');
  assertSame(manifest.files, snapshot(source, { manifest: true }));
  return { source, entries: manifest.files };
}
export function restoreData({ input, dataDir, serviceStopped = false }) {
  if (!serviceStopped) throw new Error('Explicit serviceStopped confirmation is required');
  const { source, entries } = verifyBackup(input), target = destinationRoot(dataDir, source);
  return createNewDirectory(target, () => {
    copyFiles(source, target, entries);
    validateDatabases(target);
    assertSame(entries, snapshot(target));
    assertSame(entries, verifyBackup(source).entries);
    return { directory: target, files: entries.length, verified: true };
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [operation, ...args] = process.argv.slice(2), options = {};
    const allowed = operation === 'backup' ? new Set(['--data-dir', '--output', '--service-stopped']) : operation === 'restore' ? new Set(['--input', '--data-dir', '--service-stopped']) : new Set();
    for (let i = 0; i < args.length; i++) {
      const flag = args[i];
      if (!allowed.has(flag) || options[flag] !== undefined) throw new Error('Unknown or duplicate argument');
      if (flag === '--service-stopped') options[flag] = true;
      else { if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error('Missing argument value'); options[flag] = args[++i]; }
    }
    if (!options['--data-dir'] || !(operation === 'backup' ? options['--output'] : options['--input'])) throw new Error('Usage: backup --data-dir DIR --output NEW_DIR --service-stopped | restore --input BACKUP --data-dir NEW_DIR --service-stopped');
    const result = operation === 'backup' ? backupData({ dataDir: options['--data-dir'], output: options['--output'], serviceStopped: options['--service-stopped'] }) : restoreData({ input: options['--input'], dataDir: options['--data-dir'], serviceStopped: options['--service-stopped'] });
    console.log(JSON.stringify(result));
  } catch (error) { console.error('Backup/restore failed: ' + error.message); process.exitCode = 1; }
}
