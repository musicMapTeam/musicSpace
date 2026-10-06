/**
 * Cloudflare-D1-compatible binding (prepare / bind / first / all / run / batch) over a sql.js Database.
 *
 * Runtime-agnostic: the caller passes the initialised sql.js module (`SQL`), so Node tests and the browser share this file and it
 * never imports sql.js itself. The shape follows what runtime-preview/src/*.js use:
 *   first() -> row | null, all() / run() -> { success, results, meta: { changes, rows_read, rows_written } }.
 *
 * Contract the workers (and the tests) rely on:
 * - batch() is ONE transaction: BEGIN, every statement with no await between them (nothing else can interleave), COMMIT; on any error
 *   ROLLBACK and rethrow SQLite's own message, so the workers' /event_mutation_guard_assertion|CHECK constraint|UNIQUE constraint/
 *   regexes keep matching. A batch of reads does not look like a write.
 * - onWrite() fires when rows changed (or the statement is not plain DML), never while a batch is open, and only after the statement
 *   was freed: a listener may serialise the database (export() frees every open statement and reopens the connection).
 *   It must not throw; one that does fails the statement that already committed.
 * - bind() rejects undefined (and every other value D1 cannot store) with a D1-style Error at bind time, like Cloudflare does.
 *   sql.js itself throws bare strings for these; nothing leaves this module that is not an Error.
 * - exportBytes() serialises the database and re-applies PRAGMA foreign_keys = ON (export closes and reopens the connection).
 * - Prepared statements are never cached: export() frees them all and drops application-defined functions, so every call prepares,
 *   steps and frees its own statement.
 */

const asError = error => (error instanceof Error ? error : new Error(String(error)));
const d1TypeError = value => new Error(`D1_TYPE_ERROR: Type '${typeof value}' not supported for value '${String(value)}'`);

// Leading keyword of a statement, skipping whitespace and SQL comments.
const KEYWORD = /^(?:\s+|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)*([A-Za-z]+)/;
const DML = new Set(['insert', 'update', 'delete', 'replace']);
const leadingKeyword = query => (KEYWORD.exec(query)?.[1] ?? '').toLowerCase();

function boundValue(value) {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return value;
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  throw d1TypeError(value);
}

export function createD1({ SQL, bytes = null, onWrite = () => {} } = {}) {
  if (!SQL || typeof SQL.Database !== 'function') throw new TypeError('createD1 needs the initialised sql.js module as { SQL }.');
  const db = bytes ? new SQL.Database(bytes) : new SQL.Database();
  const pragmas = () => db.run('PRAGMA foreign_keys = ON');
  pragmas();
  let closed = false;
  const open = () => { if (closed) throw new Error('The database is closed.'); };

  /** Runs one prepared statement ({ query, args }). Returns { result, wrote }; never notifies. */
  function execute(prepared) {
    const { query, args } = prepared ?? {};
    if (typeof query !== 'string' || !Array.isArray(args)) throw new TypeError('Expected a prepared statement created by DB.prepare().');
    open();
    const statement = db.prepare(query);
    try {
      if (args.length) statement.bind(args);
      const keyword = leadingKeyword(query);
      if (statement.getColumnNames().length) {
        const results = [];
        while (statement.step()) results.push(statement.getAsObject());
        // The only statement with columns that writes is INSERT/UPDATE/DELETE ... RETURNING; getRowsModified() is exact right after DML.
        const changes = DML.has(keyword) ? db.getRowsModified() : 0;
        return { result: { success: true, results, meta: { changes, rows_read: results.length, rows_written: changes } }, wrote: changes > 0 };
      }
      statement.step();
      // sql.js getRowsModified() is sqlite3_changes(): it keeps the value of the last DML, so it is only trusted right after DML
      // ("WITH ..." without columns can only be DML). DDL, PRAGMA assignments and anything else without columns count as a write:
      // persisting once too often is harmless, missing a schema change is not.
      const dml = DML.has(keyword) || keyword === 'with';
      const changes = dml ? db.getRowsModified() : 0;
      return { result: { success: true, results: [], meta: { changes, rows_read: 0, rows_written: changes } }, wrote: dml ? changes > 0 : true };
    } finally { statement.free(); }
  }
  const notify = wrote => { if (wrote) onWrite(); };         // batch() never goes through here: it notifies once, after COMMIT

  const make = (query, args = []) => ({
    query, args,
    bind(...values) { return make(query, values.map(boundValue)); },       // boundValue throws for undefined, like D1
    async first(column) {
      const { result, wrote } = execute({ query, args });
      notify(wrote);
      const row = result.results[0] ?? null;
      if (column === undefined || row === null) return row;
      if (!(column in row)) throw new Error(`D1_ERROR: No such column: ${column}`);
      return row[column];
    },
    async all() { const { result, wrote } = execute({ query, args }); notify(wrote); return result; },
    async run() { const { result, wrote } = execute({ query, args }); notify(wrote); return result; },
  });

  const DB = {
    prepare: query => make(String(query)),
    async batch(statements) {
      if (!Array.isArray(statements)) throw new TypeError('batch() takes an array of prepared statements.');
      if (!statements.length) return [];
      open();
      db.run('BEGIN');
      let outcomes;
      try {
        outcomes = statements.map(execute);       // synchronous on purpose: no await, so no other task runs inside the transaction
        db.run('COMMIT');
      } catch (error) {
        try { db.run('ROLLBACK'); } catch { /* SQLite already rolled the transaction back */ }
        throw asError(error);
      }
      if (outcomes.some(outcome => outcome.wrote)) onWrite();   // a read-only batch (most polls) must not look like a write
      return outcomes.map(outcome => outcome.result);
    },
  };

  return {
    DB,
    /** Serialises the database. sql.js closes and reopens the connection to do this, so the pragma is set again. */
    exportBytes() { open(); const out = db.export(); pragmas(); return out; },
    /** The raw sql.js Database (maintenance and tests). */
    sql: () => db,
    close() { if (closed) return; closed = true; db.close(); },
  };
}
