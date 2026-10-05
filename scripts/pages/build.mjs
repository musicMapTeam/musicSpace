// `npm run build:pages`: builds the whole GitHub Pages tree into dist-pages/ (STATIC_OUT overrides the directory).
//
//   index.html            the event room, static profile (vite.static.config.js)
//   music-map/            the original Map (vite.static-map.config.js)
//   classic/              the 0.16 root app, kept unlinked as the cheapest fallback; its ai/ resolves to ../ai/
//   ai/                   on-device model pack and onnxruntime-web files (web/public/ai), one copy for the whole site
//   shared/three-0.186.1/ the shared three.js modules both pages import
//   sql/                  sql-wasm.wasm (+ licence)
//   demo/                 the demo photos and their manifest (web/static-runtime/demo-assets); a build without them FAILS (the showcase world
//                         reads its photos from here: without them every visitor would see the rescue screen)
//   build.json            {version, commit, builtAt, files: [{path, bytes, sha256}]}: the identity of these bytes. No channel:
//                         root and preview are the same bytes, the page derives its channel from its URL.
//   .nojekyll
import {spawnSync} from 'node:child_process';
import {cpSync, existsSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build as viteBuild} from 'vite';
import {buildInfo} from '../build/static-html-plugin.mjs';

const ROOT = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const OUT = resolve(process.env.STATIC_OUT || join(ROOT, 'dist-pages'));
const started = Date.now();

/** A failure with a message that says what to do; printed without a stack. */
class BuildError extends Error {}

function step(name, run) {
  const t = Date.now();
  process.stdout.write(`build:pages - ${name}...\n`);
  return Promise.resolve(run()).then(result => { process.stdout.write(`build:pages - ${name}: ${((Date.now() - t) / 1000).toFixed(1)} s\n`); return result; });
}

/** Every file below `dir` as a sorted list of posix-style relative paths. */
export function listFiles(dir) {
  const out = [];
  const walk = current => {
    for (const entry of readdirSync(current, {withFileTypes: true})) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) walk(path); else if (entry.isFile()) out.push(relative(dir, path).split(sep).join('/'));
    }
  };
  walk(dir);
  return out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** The build.json document for the tree in `dir` (build.json and .nojekyll are not listed in it). */
export function describeTree(dir, info) {
  const files = listFiles(dir).filter(path => path !== 'build.json' && path !== '.nojekyll').map(path => {
    const data = readFileSync(join(dir, path));
    return {path, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex')};
  });
  return {version: info.version, commit: info.commit, builtAt: info.builtAt, files};
}

/** Puts <meta name="space-ai-base" content="../ai/"> into the classic page: its model files live one level up, in the shared ai/. */
export function addAiBaseMeta(html, content = '../ai/') {
  const meta = `<meta name="space-ai-base" content="${content}">`;
  const clean = html.replace(/<meta\b[^>]*\bname=["']space-ai-base["'][^>]*>\s*/gi, '');
  const charset = /<meta\b[^>]*\bcharset=[^>]*>/i.exec(clean);
  const head = /<head\b[^>]*>/i.exec(clean);
  const at = charset ? charset.index + charset[0].length : head ? head.index + head[0].length : -1;
  if (at < 0) throw new Error('classic/index.html has no <head>');
  return clean.slice(0, at) + meta + clean.slice(at);
}

/**
 * demo/ is not optional: the page lays the showcase room out from these photos on every first visit. Missing manifest.json, an unreadable
 * one, or a photo it lists that is not on disk fails the build, before any Vite step has run.
 */
export function checkDemoAssets(dir) {
  const shown = path => { const inside = relative(ROOT, path); return inside && !inside.startsWith('..') ? inside : path; };
  const manifestPath = join(dir, 'manifest.json');
  if (!existsSync(manifestPath)) throw new BuildError(`${shown(manifestPath)} is missing: the showcase photos are part of the site (run node scripts/demo/build-demo-photos.mjs, or restore web/static-runtime/demo-assets).`);
  let manifest;
  try { manifest = JSON.parse(readFileSync(manifestPath, 'utf8')); } catch (error) { throw new BuildError(`${shown(manifestPath)} is not JSON (${error.message}).`); }
  const listed = Array.isArray(manifest?.files) ? manifest.files.map(entry => entry?.file).filter(name => typeof name === 'string' && name) : [];
  if (!listed.length) throw new BuildError(`${shown(manifestPath)} lists no photos ({"files": [{"file": ...}]}).`);
  const missing = listed.filter(name => !existsSync(join(dir, name)));
  if (missing.length) throw new BuildError(`demo photo(s) listed in manifest.json are not in ${shown(dir)}: ${missing.join(', ')}.`);
  return listed;
}

/** The build empties OUT first, so it only does that to the repository's own dist-pages, to nothing, or to an earlier build's output. */
function guardOutDir() {
  if (OUT === ROOT || ROOT.startsWith(OUT + sep) || OUT === resolve('/') || existsSync(join(OUT, 'package.json')) || existsSync(join(OUT, '.git'))) {
    throw new BuildError(`refusing to build into ${OUT}: it is the repository, one of its parents or a git directory. Use STATIC_OUT=<empty or throw-away directory>.`);
  }
  const ours = OUT === join(ROOT, 'dist-pages') || !existsSync(OUT) || readdirSync(OUT).length === 0 || existsSync(join(OUT, 'build.json')) || existsSync(join(OUT, '.nojekyll'));
  if (!ours) throw new BuildError(`refusing to empty ${OUT}: it is not empty and does not look like the output of an earlier build:pages (no build.json or .nojekyll). Delete it yourself or choose another STATIC_OUT.`);
}

async function main() {
  guardOutDir();
  const demoSource = join(ROOT, 'web/static-runtime/demo-assets');
  checkDemoAssets(demoSource);                  // fail before the three Vite builds, not after them
  const info = buildInfo();
  // One identity for the three Vite configs and for build.json (the configs read these when they load).
  process.env.STATIC_OUT = OUT;
  process.env.STATIC_BUILT_AT = info.builtAt;
  process.env.STATIC_COMMIT = info.commit;
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  process.stdout.write(`build:pages - ${pkg.name} ${info.version} (${info.commit}) -> ${OUT}\n`);
  if (spawnSync('git', ['status', '--porcelain'], {cwd: ROOT, encoding: 'utf8'}).stdout?.trim()) process.stdout.write('build:pages - note: the working tree has uncommitted changes; build.json records the HEAD commit only.\n');

  await step('ai:ort', () => {
    // The package script is the single source of truth (it also refuses an unaudited onnxruntime-web).
    const command = String(pkg.scripts?.['ai:ort'] || '').replace(/^node\b/, JSON.stringify(process.execPath));
    if (!command) throw new BuildError('package.json has no ai:ort script');
    const result = spawnSync(command, {cwd: ROOT, shell: true, stdio: 'inherit'});
    if (result.status !== 0) throw new BuildError('npm run ai:ort failed (see its output above)');
  });

  rmSync(OUT, {recursive: true, force: true});
  await step('event room (site root)', () => viteBuild({configFile: join(ROOT, 'vite.static.config.js'), logLevel: 'warn'}));
  await step('Map (music-map/)', () => viteBuild({configFile: join(ROOT, 'vite.static-map.config.js'), logLevel: 'warn'}));
  await step('classic (0.16 root app)', async () => {
    // copyPublicDir:false: web/public holds 23 MB of ai/, which the whole site shares from OUT/ai.
    await viteBuild({configFile: join(ROOT, 'vite.config.js'), logLevel: 'warn', build: {outDir: join(OUT, 'classic'), emptyOutDir: true, copyPublicDir: false}});
    const file = join(OUT, 'classic', 'index.html');
    writeFileSync(file, addAiBaseMeta(readFileSync(file, 'utf8')));
  });
  await step('ai/ and demo/', () => {
    cpSync(join(ROOT, 'web/public/ai'), join(OUT, 'ai'), {recursive: true});
    cpSync(demoSource, join(OUT, 'demo'), {recursive: true});
  });

  writeFileSync(join(OUT, '.nojekyll'), '');
  const tree = describeTree(OUT, info);
  writeFileSync(join(OUT, 'build.json'), `${JSON.stringify(tree, null, 2)}\n`);
  const bytes = tree.files.reduce((sum, file) => sum + file.bytes, 0);
  process.stdout.write(`build:pages - ok: ${tree.files.length} files, ${(bytes / 1048576).toFixed(1)} MB, index.html ${statSync(join(OUT, 'index.html')).size} B, ${((Date.now() - started) / 1000).toFixed(1)} s\n`);
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  main().catch(error => { process.stderr.write(`build:pages - FAILED: ${error instanceof BuildError ? error.message : error?.stack || error}\n`); process.exit(1); });
}
