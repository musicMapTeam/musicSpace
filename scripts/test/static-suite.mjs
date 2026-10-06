// The test suite behind `npm run test:static` (which runs this, then scripts/test/static-build.test.mjs):
//   node scripts/test/static-suite.mjs            run everything, exit non-zero when any stage fails
//   node scripts/test/static-suite.mjs --list     print the files of each stage and exit
//
// Stages
//  1. static tests       node --test tests/static-*.test.js: the browser-runtime modules, on Node's own engine.
//  2. engine self-check  proves that stage 3 really runs on sql.js and the shims (the redirect in sqljs-loader.mjs can fail quietly, and a
//                        conformance run that fell back to node:sqlite would be green and mean nothing) and exercises the sql.js
//                        D1 adapter itself: file-backed, ':memory:' leaves no file, injected clock survives exports, read outages.
//  3. Worker-mode suite  the repo's own tests of event-worker.js / avatar-worker.js, run with
//                        node --import ./scripts/test/sqljs-register.mjs --test: runtime-preview/tests/*.test.mjs, tests/event-*.test.js and
//                        tests/avatar-*.test.js, except the two binding tests that run app.js in a vm (they own their own harness).
//                        On this engine exactly two tests skip themselves (SPACE_TEST_ENGINE=sqljs): see runtime-preview/tests/avatar-*.test.mjs.
import { readdirSync, existsSync, mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const REGISTER = './scripts/test/sqljs-register.mjs';
const WORKER_EXCLUDES = new Set(['tests/event-room-binding.test.js', 'tests/event-room-static-binding.test.js']);
const SKIP_SITES = ['runtime-preview/tests/avatar-worker.test.mjs', 'runtime-preview/tests/avatar-components-worker.test.mjs'];

const list = (dir, pattern) => readdirSync(join(root, dir)).filter(name => pattern.test(name)).sort().map(name => `${dir}/${name}`);
const staticFiles = list('tests', /^static-.*\.test\.js$/);
const workerFiles = [
  ...list('runtime-preview/tests', /\.test\.mjs$/),
  ...list('tests', /^event-.*\.test\.js$/),
  ...list('tests', /^avatar-.*\.test\.js$/),
].filter(file => !WORKER_EXCLUDES.has(file));

/** Stage 2, run in a child that was started with --import sqljs-register.mjs. Prints one line per check, exits 1 on any failure. */
async function engineSelfCheck() {
  const { default: assert } = await import('node:assert/strict');
  const failures = [];
  const check = async (name, work) => {
    try { const note = await work(); console.log(`  ok - ${name}${note ? ` (${note})` : ''}`); }
    catch (error) { failures.push(name); console.log(`  not ok - ${name}\n    ${String(error && error.message || error).split('\n').join('\n    ')}`); }
  };
  let adapter;
  await check('the register hook set SPACE_TEST_ENGINE=sqljs', () => assert.equal(process.env.SPACE_TEST_ENGINE, 'sqljs'));
  await check('importing d1-adapter.mjs yields the sql.js adapter', async () => {
    adapter = await import('../../runtime-preview/tests/d1-adapter.mjs');
    assert.equal(adapter.ENGINE, 'sqljs', 'the loader did not redirect d1-adapter.mjs: the suite would silently run on node:sqlite');
  });
  await check('runtime-preview/src is linked to the crypto and Buffer shims', async () => {
    await import('../../runtime-preview/src/avatar-worker.js');
    await import('../../runtime-preview/src/event-worker.js');
    assert.deepEqual({ ...globalThis.__SPACE_SQLJS_ENGINE__ }, { crypto: true, buffer: true }, 'a worker module still imports the real node:crypto / node:buffer');
  });
  const dir = mkdtempSync(join(tmpdir(), 'space-static-suite-'));
  try {
    await check('the worker migrations apply on sql.js', () => {
      const DB = adapter.makeD1(':memory:');
      try {
        const version = DB.sql.prepare('SELECT sqlite_version() AS v').get().v;
        const tables = DB.sql.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table'").get().n;
        assert.ok(tables >= 40, `only ${tables} tables`);
        return `SQLite ${version}, ${tables} tables`;
      } finally { DB.close(); }
    });
    await check(":memory: touches no file", () => {
      adapter.makeD1(':memory:').close();
      assert.ok(!existsSync(join(root, ':memory:')) && !existsSync(join(process.cwd(), ':memory:')), "a file named ':memory:' was written; delete it");
    });
    await check('file-backed: every kind of write reaches the file, close() and a reopen keep it', async () => {
      const file = join(dir, 'file-backed.sqlite');
      const { DatabaseSync } = await import('node:sqlite');
      const rows = () => { const reader = new DatabaseSync(file, { readOnly: true }); try { return reader.prepare('SELECT id FROM selfcheck_probe ORDER BY id').all().map(row => row.id); } finally { reader.close(); } };
      const DB = adapter.makeD1(file);
      DB.sql.exec('CREATE TABLE selfcheck_probe (id INTEGER PRIMARY KEY, v TEXT)');
      assert.deepEqual(rows(), [], 'DDL through DB.sql.exec');
      DB.sql.prepare('INSERT INTO selfcheck_probe (id, v) VALUES (?, ?)').run(1, 'a');
      assert.deepEqual(rows(), [1], 'DB.sql.prepare().run()');
      await DB.prepare('INSERT INTO selfcheck_probe (id, v) VALUES (?, ?)').bind(2, 'b').run();
      assert.deepEqual(rows(), [1, 2], 'D1 prepare().bind().run()');
      await DB.batch([DB.prepare('INSERT INTO selfcheck_probe (id, v) VALUES (?, ?)').bind(3, 'c')]);
      assert.deepEqual(rows(), [1, 2, 3], 'D1 batch()');
      assert.equal(DB.sql.prepare('SELECT v FROM selfcheck_probe WHERE id = 99').get(), undefined, 'get() of nothing is undefined, as in node:sqlite');
      DB.close(); DB.close();
      const again = adapter.makeD1(file);
      try { assert.deepEqual(again.sql.prepare('SELECT id FROM selfcheck_probe ORDER BY id').all().map(row => row.id), [1, 2, 3], 'reopened'); } finally { again.close(); }
    });
    await check('the injected SQL clock survives every export', async () => {
      const DB = adapter.makeD1(join(dir, 'clock.sqlite'), { clock: () => Date.parse('2026-10-05T12:00:00Z') });
      try {
        const now = () => DB.sql.prepare("SELECT strftime('%Y-%m-%dT%H:%M:%fZ', 'now') AS now").get().now;
        assert.equal(now(), '2026-10-05T12:00:00.000Z', 'initially');
        DB.sql.exec('CREATE TABLE clock_probe (id INTEGER)');
        assert.equal(now(), '2026-10-05T12:00:00.000Z', 'after exec');
        await DB.prepare('INSERT INTO clock_probe (id) VALUES (1)').run();
        assert.equal(now(), '2026-10-05T12:00:00.000Z', 'after a D1 write');
      } finally { DB.close(); }
    });
    await check('readFailures fails reads like the Node adapter and then recovers', async () => {
      const DB = adapter.makeD1(':memory:');
      try {
        DB.readFailures = 2;
        await assert.rejects(DB.prepare('SELECT 1 AS n').first(), /Temporary read outage/);
        await assert.rejects(DB.batch([DB.prepare('SELECT 1 AS n')]), /Temporary read outage/);
        assert.equal(DB.readFailures, 0);
        assert.deepEqual(await DB.prepare('SELECT 1 AS n').first(), { n: 1 });
      } finally { DB.close(); }
    });
  } finally { rmSync(dir, { recursive: true, force: true }); }
  await check('exactly two tests skip themselves on this engine', () => {
    const sites = SKIP_SITES.map(file => (readFileSync(join(root, file), 'utf8').match(/process\.env\.SPACE_TEST_ENGINE === 'sqljs'/g) || []).length);
    assert.deepEqual(sites, [1, 1], `skip sites per file ${SKIP_SITES.join(', ')}: ${sites}`);
    const elsewhere = workerFiles.filter(file => !SKIP_SITES.includes(file) && /SPACE_TEST_ENGINE/.test(readFileSync(join(root, file), 'utf8')));
    assert.deepEqual(elsewhere, [], 'only the two engine-specific tests may skip');
  });
  process.exit(failures.length ? 1 : 0);
}

function runStage(title, args) {
  console.log(`\n=== ${title} ===`);
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
  const ok = result.status === 0;
  const why = result.status === null ? ` (${result.signal || result.error?.message || 'did not finish'})` : ` (exit ${result.status})`;
  console.log(`--- ${title}: ${ok ? 'ok' : `FAILED${why}`}`);
  return ok;
}

if (process.argv.includes('--engine-check')) {
  await engineSelfCheck();
} else if (process.argv.includes('--list')) {
  console.log(`static tests (${staticFiles.length}):\n  ${staticFiles.join('\n  ')}\nWorker-mode tests on sql.js (${workerFiles.length}):\n  ${workerFiles.join('\n  ')}`);
} else {
  const stages = [];
  if (staticFiles.length) stages.push(['static tests', runStage('static tests (Node engine)', ['--test', '--test-concurrency=4', '--test-reporter=spec', ...staticFiles])]);
  else { console.error('static-suite: no tests/static-*.test.js found'); stages.push(['static tests', false]); }
  const engineOk = runStage('engine self-check (sql.js, shims, D1 adapter)', ['--import', REGISTER, fileURLToPath(import.meta.url), '--engine-check']);
  stages.push(['engine self-check', engineOk]);
  // A run that did not prove its engine would be green and mean nothing, so it does not run at all.
  stages.push(['Worker-mode suite on sql.js', engineOk ? runStage(`Worker-mode suite on sql.js (${workerFiles.length} files)`, ['--import', REGISTER, '--test', '--test-concurrency=4', '--test-reporter=spec', ...workerFiles]) : false]);
  console.log(`\nstatic-suite: ${stages.map(([name, ok]) => `${name} ${ok ? 'ok' : 'FAILED'}`).join(' | ')}`);
  process.exit(stages.every(([, ok]) => ok) ? 0 : 1);
}
