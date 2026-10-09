// `node scripts/test/static-build.test.mjs` (part of `npm run test:static`): builds the whole Pages tree into a throw-away directory
// and checks it, then exercises serve-prefix.mjs, verify-tree.mjs and publish.mjs against it (publish against a local bare repo
// standing in for origin: nothing here talks to GitHub). Takes a few seconds to a minute, mostly the build.
import test, {after, before} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import {chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {FORBIDDEN_HTML, MAX_ROOT_HTML_BYTES, REQUIRED_FILES, checkHtml, openSource, verifyTree} from '../pages/verify-tree.mjs';
import {publish} from '../pages/publish.mjs';
import {createPrefixServer} from '../pages/serve-prefix.mjs';
import {COPY_RULES, RESCUE_PURGE_PREFIXES} from '../build/static-html-plugin.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const work = mkdtempSync(join(tmpdir(), 'static-build-test-'));
const dist = join(work, 'dist');
// Once the showcase photos exist in the repo, the built tree must carry them.
const demoExpected = existsSync(join(ROOT, 'web/static-runtime/demo-assets/manifest.json'));
const sha256 = data => createHash('sha256').update(data).digest('hex');
const read = (...parts) => readFileSync(join(dist, ...parts));
const text = (...parts) => read(...parts).toString('utf8');
let buildSeconds = 0, buildOutput = '';

const savedEnv = {};
const GIT_ENV = {GIT_AUTHOR_NAME: 'static-build-test', GIT_AUTHOR_EMAIL: 'test@example.invalid', GIT_COMMITTER_NAME: 'static-build-test', GIT_COMMITTER_EMAIL: 'test@example.invalid', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_TERMINAL_PROMPT: '0'};
const git = (cwd, ...args) => execFileSync('git', args, {cwd, encoding: 'utf8', env: {...process.env, ...GIT_ENV}, stdio: ['ignore', 'pipe', 'pipe']});

before(() => {
  for (const key of Object.keys(GIT_ENV)) { savedEnv[key] = process.env[key]; process.env[key] = GIT_ENV[key]; }
  const started = Date.now();
  const result = spawnSync(process.execPath, ['scripts/pages/build.mjs'], {cwd: ROOT, env: {...process.env, STATIC_OUT: dist}, encoding: 'utf8', timeout: 180_000, maxBuffer: 64 * 1024 * 1024});
  buildSeconds = (Date.now() - started) / 1000;
  buildOutput = `${result.stdout}\n${result.stderr}`;
  assert.equal(result.status, 0, `build:pages failed:\n${buildOutput}`);
});
after(() => {
  for (const key of Object.keys(GIT_ENV)) { if (savedEnv[key] === undefined) delete process.env[key]; else process.env[key] = savedEnv[key]; }
  rmSync(work, {recursive: true, force: true});
});

test('npm run build:pages finishes in under 90 s and records its identity in build.json (no channel)', () => {
  assert.ok(buildSeconds < 90, `${buildSeconds} s`);
  const build = JSON.parse(text('build.json'));
  assert.deepEqual(Object.keys(build), ['version', 'commit', 'builtAt', 'files']);
  assert.equal(build.version, JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version);
  assert.match(build.commit, /^([0-9a-f]{7,}|unknown)$/);
  assert.ok(!Number.isNaN(Date.parse(build.builtAt)));
  assert.ok(build.files.every(file => file.path && file.bytes >= 0 && /^[0-9a-f]{64}$/.test(file.sha256)));
  assert.deepEqual(build.files.map(file => file.path), build.files.map(file => file.path).sort(), 'files are listed in a stable order');
  assert.ok(!build.files.some(file => file.path === 'build.json' || file.path === '.nojekyll'));
  assert.ok(existsSync(join(dist, '.nojekyll')));
});

test('build:pages never empties a directory that is not its own output', () => {
  const precious = join(work, 'precious');
  mkdirSync(precious);
  writeFileSync(join(precious, 'keep.txt'), 'mine');
  for (const target of [precious, ROOT, join(ROOT, 'web')]) {
    const result = spawnSync(process.execPath, ['scripts/pages/build.mjs'], {cwd: ROOT, env: {...process.env, STATIC_OUT: target}, encoding: 'utf8', timeout: 60_000});
    assert.equal(result.status, 1, target);
    assert.match(result.stderr, /refusing to/, target);
  }
  assert.equal(readFileSync(join(precious, 'keep.txt'), 'utf8'), 'mine');
  assert.ok(existsSync(join(ROOT, 'package.json')) && existsSync(join(ROOT, 'web/event-room/app.js')));
});

test('verify-tree passes on the fresh tree', async () => {
  const result = await verifyTree({source: dist, requireDemo: demoExpected, poll: null});
  assert.deepEqual(result.checks.filter(check => !check.ok), []);
  assert.ok(result.ok);
  assert.match(result.indexSha256, /^[0-9a-f]{64}$/);
});

test('the tree has the pieces of the Pages site', () => {
  for (const path of REQUIRED_FILES) assert.ok(existsSync(join(dist, path)), path);
  for (const path of ['index.html', 'music-map/index.html', 'classic/index.html', 'ai/tc8/vision.onnx', 'shared/three-0.186.1/three.module.js', 'shared/three-0.186.1/three.core.js', 'sql/sql-wasm.wasm']) assert.ok(statSync(join(dist, path)).isFile() && statSync(join(dist, path)).size > 0, path);
  assert.ok(statSync(join(dist, 'ai')).isDirectory() && statSync(join(dist, 'shared/three-0.186.1')).isDirectory());
  if (demoExpected) assert.ok(existsSync(join(dist, 'demo/manifest.json')), 'demo/ is built from web/static-runtime/demo-assets');
});

test('the Map references ../shared/three-0.186.1/, the room ./shared/three-0.186.1/, and nothing is root-absolute', () => {
  const room = text('index.html'), map = text('music-map/index.html');
  assert.match(map, /from\s*"\.\.\/shared\/three-0\.186\.1\/three\.module\.js"/);
  assert.match(room, /from\s*"\.\/shared\/three-0\.186\.1\/three\.module\.js"/);
  for (const [name, html] of [['index.html', room], ['music-map/index.html', map]]) {
    assert.ok(!/["'`(]\/shared\//.test(html), `${name} has a root-absolute /shared/ URL`);
    for (const {name: what, re} of FORBIDDEN_HTML) assert.ok(!re.test(html), `${name}: ${what}`);
  }
  assert.ok(Buffer.byteLength(room) < MAX_ROOT_HTML_BYTES, `the room page is ${Buffer.byteLength(room)} bytes`);
});

test('classic/ is the 0.16 app without a copy of ai/', () => {
  assert.ok(!existsSync(join(dist, 'classic/ai')), 'classic/ai must not exist: the model pack lives once, at ai/');
  assert.deepEqual(readdirSync(join(dist, 'classic')), ['index.html']);
  assert.match(text('classic/index.html'), /<meta name="space-ai-base" content="\.\.\/ai\/">/);
  assert.ok(JSON.parse(text('build.json')).files.every(file => !file.path.startsWith('classic/ai/')));
});

test('none of the replaced notices is left in index.html, and their replacements are', () => {
  const room = text('index.html');
  for (const rule of COPY_RULES) {
    assert.ok(!room.includes(rule.from), `"${rule.from}" is still in index.html`);
    assert.ok(room.includes(rule.to), `"${rule.to}" is not in index.html`);
  }
});

test('the sql.js wasm and its licence are the installed package\'s, the licence text is the repo copy', () => {
  assert.deepEqual(read('sql/sql-wasm.wasm'), readFileSync(join(ROOT, 'node_modules/sql.js/dist/sql-wasm-browser.wasm')));
  assert.deepEqual(read('sql/LICENSE-sql.js-MIT.txt'), readFileSync(join(ROOT, 'node_modules/sql.js/LICENSE')));
  assert.deepEqual(readFileSync(join(ROOT, 'web/assets/licenses/sql.js-MIT.txt')), readFileSync(join(ROOT, 'node_modules/sql.js/LICENSE')), 'web/assets/licenses/sql.js-MIT.txt is the 1.14.2 LICENSE verbatim');
  assert.match(text('index.html'), /<!-- sql\.js-MIT\.txt\nMIT license/);
  assert.equal(JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).devDependencies['sql.js'], '1.14.2', 'exact version');
});

test('the rescue script in the page carries the purge list of the architecture', () => {
  const html = text('index.html');
  const script = /<script data-space-static="rescue">([\s\S]*?)<\/script>/.exec(html)?.[1];
  assert.ok(script, 'rescue script present');
  const prefixes = JSON.parse(/var PREFIXES=(\[.*?\]);/.exec(script)[1]);
  assert.deepEqual(prefixes, [...RESCUE_PURGE_PREFIXES]);
  assert.ok(html.indexOf('<script type="module"') > html.indexOf('<body>'));
});

test('two builds with a pinned identity are byte-identical (so a rebuild of the same commit is the same site)', () => {
  const pinned = {...process.env, STATIC_BUILT_AT: '2026-10-05T12:00:00Z', STATIC_COMMIT: 'abc1234'};
  const hashes = [1, 2].map(n => {
    const out = join(work, `pinned-${n}`);
    const result = spawnSync(process.execPath, ['scripts/pages/build.mjs'], {cwd: ROOT, env: {...pinned, STATIC_OUT: out}, encoding: 'utf8', timeout: 180_000, maxBuffer: 64 * 1024 * 1024});
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const build = JSON.parse(readFileSync(join(out, 'build.json'), 'utf8'));
    assert.equal(build.commit, 'abc1234');
    assert.equal(build.builtAt, '2026-10-05T12:00:00.000Z');
    return sha256(readFileSync(join(out, 'build.json')));
  });
  assert.equal(hashes[0], hashes[1], 'build.json lists every file hash, so equal build.json means equal bytes');
});

// --- verify-tree has teeth ---------------------------------------------------------------------------------------------------

/** The built tree with some files replaced (null = missing) and extra paths listed, without copying 30 MB. */
function overlay(replace = {}, extra = []) {
  const base = openSource(dist);
  return {
    ...base,
    async read(path) { if (path in replace) return replace[path] === null ? {ok: false, error: 'ENOENT'} : {ok: true, data: Buffer.from(replace[path])}; return base.read(path); },
    list: () => [...base.list().filter(path => replace[path] !== null), ...extra].sort(),
  };
}
const failed = result => result.checks.filter(check => !check.ok).map(check => `${check.name}: ${check.detail}`);

test('verify-tree notices changed bytes, a missing file, a stray file and a channel in build.json', async () => {
  const tampered = await verifyTree({source: overlay({'index.html': `${text('index.html')} `}), poll: null});
  assert.ok(!tampered.ok && failed(tampered).some(line => /hashes equal.*index\.html/.test(line)), failed(tampered).join('\n'));
  const missing = await verifyTree({source: overlay({'sql/sql-wasm.wasm': null}), poll: null});
  assert.ok(failed(missing).some(line => /sql\/sql-wasm\.wasm/.test(line)));
  const stray = await verifyTree({source: overlay({}, ['stray.txt']), poll: null});
  assert.ok(failed(stray).some(line => /no file besides.*stray\.txt/.test(line)));
  const ignored = await verifyTree({source: overlay({}, ['avatar-preview/index.html']), ignore: ['avatar-preview/'], poll: null});
  assert.ok(ignored.ok, 'ignored prefixes are not judged');
  const build = JSON.parse(text('build.json'));
  const withChannel = await verifyTree({source: overlay({'build.json': JSON.stringify({...build, channel: 'pages'})}), poll: null});
  assert.ok(failed(withChannel).some(line => /no channel/.test(line)));
  const noDemo = await verifyTree({source: overlay({}), requireDemo: true, poll: null});
  assert.equal(noDemo.ok, demoExpected || existsSync(join(dist, 'demo/manifest.json')), '--require-demo asks for demo/manifest.json');
});

test('verify-tree reads demo/manifest.json: every photo it lists has to be in the tree', async () => {
  const build = JSON.parse(text('build.json'));
  const manifest = JSON.stringify({files: [{file: 'a.jpg'}, {file: 'b.jpg'}]});
  const files = [...build.files, {path: 'demo/manifest.json', bytes: manifest.length, sha256: sha256(Buffer.from(manifest))}, {path: 'demo/a.jpg', bytes: 1, sha256: sha256(Buffer.from('a'))}].sort((x, y) => (x.path < y.path ? -1 : 1));
  const result = await verifyTree({source: overlay({'build.json': JSON.stringify({...build, files}), 'demo/manifest.json': manifest, 'demo/a.jpg': 'a'}), requireDemo: true, poll: null});
  assert.ok(failed(result).some(line => /listed photos are in the tree: missing: b\.jpg/.test(line)), failed(result).join('\n'));
  const fine = JSON.stringify({files: [{file: 'a.jpg'}]});
  const ok = await verifyTree({source: overlay({'build.json': JSON.stringify({...build, files: files.map(file => (file.path === 'demo/manifest.json' ? {...file, bytes: fine.length, sha256: sha256(Buffer.from(fine))} : file))}), 'demo/manifest.json': fine, 'demo/a.jpg': 'a'}), requireDemo: true, poll: null});
  assert.ok(ok.checks.some(check => /1 listed photos are in the tree/.test(check.name) && check.ok));
});

test('the HTML checks catch each defect they exist for', () => {
  const build = JSON.parse(text('build.json'));
  const room = text('index.html'), map = text('music-map/index.html');
  const only = (html, kind) => checkHtml(html, kind, build).filter(check => !check.ok).map(check => check.name);
  assert.deepEqual(only(room, 'root'), []);
  assert.deepEqual(only(map, 'map'), []);
  assert.ok(only(room.replace('from"./shared/three-0.186.1/three.module.js"', 'from"/shared/three-0.186.1/three.module.js"'), 'root').some(name => /root-absolute/.test(name)));
  assert.ok(only(map.replace(/location\.assign\(([a-zA-Z$_]+)\)/, 'location.assign("/music-map/#/explore")'), 'map').some(name => /root-absolute/.test(name)));
  assert.ok(only(`${room}<script>x.startsWith("/event-room/")</script>`, 'root').some(name => /root-absolute/.test(name)));
  const script = /<script type="module" crossorigin>[\s\S]*?<\/script>/.exec(room)[0];
  assert.ok(only(room.replace(script, '').replace('<head>', `<head>${script}`), 'root').some(name => /after <body>/.test(name)), 'a module script in the head is caught');
  assert.ok(only(room.replace(/<meta name="space-site-root"[^>]*>/, ''), 'root').some(name => /space-site-root/.test(name)));
  assert.ok(only(room.replace('<!-- sql.js-MIT.txt\n', '<!-- gone\n'), 'root').some(name => /licence notices/.test(name)), 'a dropped licence notice is caught');
  assert.ok(only(map.replace('<!-- phosphor-MIT.txt\n', '<!-- gone\n'), 'map').some(name => /licence notices/.test(name)));
  assert.ok(only(room.replace(/<link rel="modulepreload"[^>]*three\.core\.js">/, ''), 'root').some(name => /three\.core\.js/.test(name)));
  assert.ok(only(room.replace(/<link rel="preload"[^>]*sql-wasm\.wasm">/, ''), 'root').some(name => /sql-wasm/.test(name)));
  assert.ok(only(room.replace(/<meta name="space-build" content="[^"]*">/, '<meta name="space-build" content="9.9.9+0000000">'), 'root').some(name => /space-build/.test(name)));
  assert.ok(only(`${room}${' '.repeat(MAX_ROOT_HTML_BYTES)}`, 'root').some(name => /size under/.test(name)));
  assert.ok(only(room.replace('<title>Music Space · 同一刻，另一面</title>', '<title>x</title>'), 'root').some(name => /title/.test(name)));
});

test('verify-tree against a URL: it waits for the expected build, then checks what is served', async () => {
  const fresh = JSON.parse(text('build.json'));
  const stale = {...fresh, commit: '0000000', builtAt: '2020-01-01T00:00:00.000Z', files: fresh.files.map(file => (file.path === 'index.html' ? {...file, sha256: '0'.repeat(64)} : file))};
  let buildRequests = 0;
  const waits = [];
  // A fake Pages: serves the tree, but build.json is the previous deploy's for the first three requests.
  const fakeFetch = async url => {
    const path = decodeURIComponent(new URL(url).pathname.replace(/^\/musicSpace\//, ''));
    if (path === 'build.json' && ++buildRequests <= 3) return new Response(JSON.stringify(stale), {status: 200});
    const file = join(dist, path);
    return existsSync(file) && statSync(file).isFile() ? new Response(readFileSync(file), {status: 200}) : new Response('nope', {status: 404});
  };
  let clock = 0;
  const result = await verifyTree({source: 'https://example.invalid/musicSpace/', expected: fresh, fetchImpl: fakeFetch, poll: {timeoutMs: 60_000, intervalMs: 15_000}, sleep: async ms => { waits.push(ms); clock += ms; }, now: () => clock, log: () => {}, requireDemo: demoExpected});
  assert.deepEqual(failed(result), []);
  assert.ok(result.ok);
  assert.deepEqual(waits, [15_000, 15_000, 15_000], 'three polls saw the old deploy');
  assert.equal(result.build.commit, fresh.commit);
  // The same wait, pinned by the recorded index.html hash instead of a local build.json
  buildRequests = 0;
  clock = 0;
  const pinned = await verifyTree({source: 'https://example.invalid/musicSpace/', indexSha256: fresh.files.find(file => file.path === 'index.html').sha256, fetchImpl: fakeFetch, poll: {timeoutMs: 60_000, intervalMs: 15_000}, sleep: async ms => { clock += ms; }, now: () => clock, log: () => {}, requireDemo: demoExpected});
  assert.deepEqual(failed(pinned), []);
  assert.equal(clock, 45_000, 'it waited out the three old deploys');
  // A deploy that never arrives fails with what it saw.
  buildRequests = -1000;
  clock = 0;
  const never = await verifyTree({source: 'https://example.invalid/musicSpace/', expected: fresh, fetchImpl: fakeFetch, poll: {timeoutMs: 45_000, intervalMs: 15_000}, sleep: async ms => { clock += ms; }, now: () => clock, log: () => {}});
  assert.ok(!never.ok && /live build\.json is 0\.21\.0-rc\.4\+0000000/.test(failed(never)[0]), failed(never)[0]);
  // 404 for build.json
  const notThere = await verifyTree({source: 'https://example.invalid/musicSpace/', fetchImpl: async () => new Response('', {status: 404}), poll: null});
  assert.ok(!notThere.ok && /HTTP 404/.test(failed(notThere)[0]));
});

test('serve-prefix serves the tree below its prefix only, like GitHub Pages, and verify-tree can read it over HTTP', async () => {
  const {server, log} = createPrefixServer({dir: dist, prefix: '/musicSpace'});
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  const base = `http://127.0.0.1:${server.address().port}`;
  const status = async (path, init = {}) => (await fetch(base + path, {redirect: 'manual', ...init})).status;
  try {
    for (const path of ['/musicSpace/', '/musicSpace/music-map/', '/musicSpace/classic/', '/musicSpace/sql/sql-wasm.wasm', '/musicSpace/ai/tc8/vision.onnx', '/musicSpace/build.json', '/musicSpace/index.html?v=1']) assert.equal(await status(path), 200, path);
    for (const path of ['/api/event/health', '/', '/shared/three-0.186.1/three.module.js', '/musicSpace/api/event/health', '/musicSpace/nope', '/musicSpace/../package.json', '/musicSpacey/']) assert.equal(await status(path), 404, path);
    assert.equal(await status('/musicSpace'), 301);
    assert.equal((await fetch(`${base}/musicSpace`, {redirect: 'manual'})).headers.get('location'), '/musicSpace/');
    assert.equal(await status('/musicSpace/music-map'), 301, 'a directory without its slash redirects, like Pages');
    assert.equal(await status('/musicSpace/', {method: 'POST'}), 405);
    const wasm = await fetch(`${base}/musicSpace/sql/sql-wasm.wasm`);
    assert.equal(wasm.headers.get('content-type'), 'application/wasm');
    assert.equal(wasm.headers.get('cache-control'), 'no-store');
    assert.equal(Number(wasm.headers.get('content-length')), statSync(join(dist, 'sql/sql-wasm.wasm')).size);
    assert.equal(await status('/musicSpace/sql/sql-wasm.wasm', {method: 'HEAD'}), 200);
    // QA helpers
    const seen = await (await fetch(`${base}/__log`)).json();
    assert.ok(seen.includes('GET /api/event/health') && seen.includes('GET /musicSpace/'));
    assert.ok(seen.every(line => !line.includes('?')), 'queries are not logged');
    assert.equal(await (await fetch(`${base}/__clear`)).text(), 'ok');
    assert.deepEqual(await (await fetch(`${base}/__log`)).json(), ['GET /__log']);
    log.length = 0;
    const live = await verifyTree({source: `${base}/musicSpace/`, expected: JSON.parse(text('build.json')), poll: null, requireDemo: demoExpected});
    assert.deepEqual(failed(live), []);
    const quick = await verifyTree({source: `${base}/musicSpace/preview/`, poll: null});
    assert.ok(!quick.ok && /HTTP 404/.test(failed(quick)[0]), 'a tree that is not there fails cleanly');
    const sameAs = await verifyTree({source: dist, sameAs: `${base}/musicSpace/`, poll: null, requireDemo: demoExpected});
    assert.ok(sameAs.checks.some(check => /equals .*index\.html \(sha256\)/.test(check.name) && check.ok));
    const different = await verifyTree({source: overlay({'index.html': `${text('index.html')} `}), sameAs: `${base}/musicSpace/`, poll: null});
    assert.ok(failed(different).some(line => /equals .*index\.html/.test(line)));
  } finally {
    await new Promise(done => server.close(done));
  }
});

// --- publish ----------------------------------------------------------------------------------------------------------------

/** A local bare "origin" with a legacy gh-pages (root files plus avatar-preview/) and a clone to run publish from. */
function scratchRemote(name, {hook = false} = {}) {
  const base = join(work, name);
  mkdirSync(base, {recursive: true});
  const origin = join(base, 'origin.git'), clone = join(base, 'work');
  git(base, 'init', '--bare', '-q', 'origin.git');
  git(base, 'clone', '-q', origin, 'work');
  git(clone, 'checkout', '-q', '-b', 'main');
  writeFileSync(join(clone, 'README.md'), 'scratch\n');
  git(clone, 'add', '.');
  git(clone, 'commit', '-q', '-m', 'init');
  git(clone, 'push', '-q', 'origin', 'main');
  git(clone, 'checkout', '-q', '--orphan', 'gh-pages');
  git(clone, 'rm', '-rfq', '.');
  mkdirSync(join(clone, 'avatar-preview'));
  mkdirSync(join(clone, 'ai/tc8'), {recursive: true});
  writeFileSync(join(clone, 'index.html'), '<!doctype html><title>legacy 0.16 root</title>\n');
  writeFileSync(join(clone, '.nojekyll'), '');
  writeFileSync(join(clone, 'avatar-preview/index.html'), 'redirect page\n');
  writeFileSync(join(clone, 'ai/tc8/old.bin'), 'old model\n');
  git(clone, 'add', '-A');
  git(clone, 'commit', '-q', '-m', 'legacy root');
  git(clone, 'push', '-q', 'origin', 'gh-pages');
  git(clone, 'checkout', '-q', 'main');
  if (hook) { const file = join(origin, 'hooks/pre-receive'); writeFileSync(file, '#!/bin/sh\necho "remote says no" >&2\nexit 1\n'); chmodSync(file, 0o755); }
  const remoteHead = () => git(clone, 'ls-remote', 'origin', 'gh-pages').split('\t')[0];
  const filesAt = ref => git(clone, 'ls-tree', '-r', '--name-only', ref).split('\n').filter(Boolean);
  return {origin, clone, remoteHead, filesAt, legacy: remoteHead()};
}
const quiet = () => {};
const options = remote => ({dist, repo: remote.clone, allowNoDemo: !demoExpected, log: quiet});

test('publish: a dry run changes nothing, leaves no worktree, and says what would change below preview/', async () => {
  const remote = scratchRemote('dry');
  const lines = [];
  const result = await publish({...options(remote), channel: 'preview', log: line => lines.push(line)});
  assert.equal(result.changed, true);
  assert.equal(result.pushed, false);
  assert.equal(remote.remoteHead(), remote.legacy, 'origin is untouched');
  assert.equal(git(remote.clone, 'worktree', 'list').trim().split('\n').length, 1, 'the temporary worktree is gone');
  assert.match(lines.join('\n'), /DRY RUN/);
  assert.match(lines.join('\n'), /preview\/\s+\+\d+ added/);
  assert.match(result.message, /^pages: publish preview [0-9a-f]{7,}|unknown$/);
});

test('publish --channel preview --push writes preview/ only, and publishing the same tree again is a no-op', async () => {
  const remote = scratchRemote('preview');
  const build = JSON.parse(text('build.json'));
  const result = await publish({...options(remote), channel: 'preview', push: true});
  assert.equal(result.pushed, true);
  assert.equal(result.message, `pages: publish preview ${build.commit}`);
  git(remote.clone, 'fetch', '-q', 'origin', 'gh-pages');
  assert.equal(git(remote.clone, 'log', '-1', '--format=%s', 'origin/gh-pages').trim(), result.message);
  const changed = git(remote.clone, 'diff', '--name-only', remote.legacy, 'origin/gh-pages').split('\n').filter(Boolean);
  assert.ok(changed.length > 10 && changed.every(path => path.startsWith('preview/')), 'only preview/ changed');
  assert.equal(git(remote.clone, 'show', 'origin/gh-pages:index.html'), '<!doctype html><title>legacy 0.16 root</title>\n', 'the root is still the legacy page');
  assert.deepEqual(remote.filesAt('origin/gh-pages').filter(path => !path.startsWith('preview/')), remote.filesAt(remote.legacy));
  const again = await publish({...options(remote), channel: 'preview', push: true});
  assert.equal(again.changed, false, 'same tree: nothing to publish');
  git(remote.clone, 'fetch', '-q', 'origin', 'gh-pages');
  assert.equal(remote.remoteHead(), git(remote.clone, 'rev-parse', 'origin/gh-pages').trim());
});

test('publish --channel pages --from-preview --push: the tested preview bytes become the root, preview/ goes, avatar-preview/ stays', async () => {
  const remote = scratchRemote('switch');
  const build = JSON.parse(text('build.json'));
  await publish({...options(remote), channel: 'preview', push: true});
  git(remote.clone, 'fetch', '-q', 'origin', 'gh-pages');
  const previewHead = git(remote.clone, 'rev-parse', 'origin/gh-pages').trim();
  const lines = [];
  const dry = await publish({...options(remote), dist: join(work, 'does-not-exist'), channel: 'pages', fromPreview: true, log: line => lines.push(line)});
  assert.equal(dry.pushed, false, 'dist-pages is not even needed with --from-preview');
  assert.match(lines.join('\n'), /preview\/\s+\+0 added\s+~0 changed\s+-\d+ removed/);
  assert.equal(remote.remoteHead(), previewHead, 'the dry run changed nothing');
  const result = await publish({...options(remote), dist: join(work, 'does-not-exist'), channel: 'pages', fromPreview: true, push: true});
  assert.equal(result.message, `pages: publish pages ${build.commit}`);
  git(remote.clone, 'fetch', '-q', 'origin', 'gh-pages');
  const files = remote.filesAt('origin/gh-pages');
  assert.ok(!files.some(path => path.startsWith('preview/')), 'preview/ was removed in the same commit');
  assert.ok(files.includes('avatar-preview/index.html'));
  assert.equal(git(remote.clone, 'show', 'origin/gh-pages:avatar-preview/index.html'), 'redirect page\n', 'avatar-preview/ is byte-identical');
  assert.ok(!files.includes('ai/tc8/old.bin'), 'the legacy root files are replaced');
  const built = build.files.map(file => file.path).sort();
  assert.deepEqual(files.filter(path => path !== 'avatar-preview/index.html' && path !== '.nojekyll' && path !== 'build.json').sort(), built);
  for (const file of build.files) assert.equal(sha256(execFileSync('git', ['show', `origin/gh-pages:${file.path}`], {cwd: remote.clone, maxBuffer: 256 * 1024 * 1024})), file.sha256, file.path);
  assert.equal(git(remote.clone, 'rev-list', '--count', `${previewHead}..origin/gh-pages`).trim(), '1', 'one commit');
  assert.equal(execFileSync('git', ['diff-tree', '-r', '--no-commit-id', '--name-only', 'origin/gh-pages', '--', 'avatar-preview'], {cwd: remote.clone, encoding: 'utf8'}), '');
  // the published tree verifies as a directory too (avatar-preview/ is not part of build.json)
  const checkout = join(work, 'switch-checkout');
  git(work, 'clone', '-q', '--branch', 'gh-pages', remote.origin, checkout);
  const verified = await verifyTree({source: checkout, ignore: ['avatar-preview/', '.git/'], requireDemo: demoExpected, poll: null});
  assert.deepEqual(failed(verified), []);
  assert.equal(verified.indexSha256, sha256(read('index.html')), 'the root index.html is the tested one');
});

test('publish refuses: --from-preview without a preview, a tree that fails verify-tree, a rejected push, bad options', async () => {
  const remote = scratchRemote('refuse');
  await assert.rejects(publish({...options(remote), channel: 'pages', fromPreview: true, push: true}), /no preview\/build\.json/);
  assert.equal(remote.remoteHead(), remote.legacy);
  const tampered = join(work, 'tampered');
  cpSync(dist, tampered, {recursive: true});
  writeFileSync(join(tampered, 'index.html'), `${readFileSync(join(tampered, 'index.html'), 'utf8')} `);
  await assert.rejects(publish({...options(remote), dist: tampered, channel: 'preview', push: true}), /fails verify-tree[\s\S]*index\.html/);
  assert.equal(remote.remoteHead(), remote.legacy);
  const empty = join(work, 'empty');
  mkdirSync(empty);
  await assert.rejects(publish({...options(remote), dist: empty, channel: 'preview'}), /has no build\.json/);
  await assert.rejects(publish({...options(remote), channel: 'staging'}), /--channel must be/);
  await assert.rejects(publish({...options(remote), channel: 'preview', fromPreview: true}), /only makes sense with --channel pages/);
  const noElsewhere = scratchRemote('hook', {hook: true});
  await assert.rejects(publish({...options(noElsewhere), channel: 'preview', push: true}), /push refused[\s\S]*remote says no/);
  assert.equal(noElsewhere.remoteHead(), noElsewhere.legacy, 'a refused push leaves origin as it was');
  assert.equal(git(noElsewhere.clone, 'worktree', 'list').trim().split('\n').length, 1, 'and the worktree is cleaned up');
});

test('publish: a user\'s global ignore rules cannot drop a file from the published tree', async () => {
  const remote = scratchRemote('ignored');
  const excludes = join(work, 'global-excludes'), config = join(work, 'global-gitconfig');
  writeFileSync(excludes, '*.wasm\n*.onnx\n.nojekyll\nbuild.json\n');
  writeFileSync(config, `[core]\n\texcludesFile = ${excludes}\n`);
  const saved = process.env.GIT_CONFIG_GLOBAL;
  process.env.GIT_CONFIG_GLOBAL = config;
  try {
    await publish({...options(remote), channel: 'preview', push: true});
  } finally { process.env.GIT_CONFIG_GLOBAL = saved; }
  git(remote.clone, 'fetch', '-q', 'origin', 'gh-pages');
  const files = remote.filesAt('origin/gh-pages');
  for (const path of ['preview/sql/sql-wasm.wasm', 'preview/ai/tc8/vision.onnx', 'preview/ai/ort/ort-wasm-simd-threaded.wasm', 'preview/.nojekyll', 'preview/build.json']) assert.ok(files.includes(path), path);
});

test('publish --channel pages from dist-pages replaces the root, keeps avatar-preview/ and removes an existing preview/', async () => {
  const remote = scratchRemote('direct');
  await publish({...options(remote), channel: 'preview', push: true});
  const lines = [];
  await publish({...options(remote), channel: 'pages', push: true, log: line => lines.push(line)});
  git(remote.clone, 'fetch', '-q', 'origin', 'gh-pages');
  const files = remote.filesAt('origin/gh-pages');
  assert.ok(!files.some(path => path.startsWith('preview/')) && files.includes('avatar-preview/index.html') && files.includes('index.html'));
  assert.match(lines.join('\n'), /without --from-preview/);
});
