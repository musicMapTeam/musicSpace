// Verifies a built Pages tree, either a directory (dist-pages, a temp build, the tree to publish) or a live URL.
//
//   node scripts/pages/verify-tree.mjs <dir|url> [options]
//     --same-as <dir|url>     index.html must be byte-identical (sha256) to the other tree's, e.g. preview vs root
//     --index-sha256 <hex>    index.html must have exactly this sha256 (a value recorded earlier, when the other tree is gone); URL mode
//                             polls until the live build.json lists it
//     --expected <dir|url|none>  URL mode: poll until the live build.json equals this tree's (default: ./dist-pages when it exists)
//     --require-demo          demo/manifest.json must exist (publish.mjs always asks for it)
//     --ignore <path-prefix>  directory mode: files below this prefix are not judged (a gh-pages checkout: --ignore avatar-preview/ --ignore .git/)
//     --quick                 URL mode: do not download files over 1 MB (except the HTML pages), only prove they exist
//     --timeout <minutes>     URL mode polling budget (default 10); --interval <seconds> (default 15); --no-poll tries once
//     --json                  print the result as JSON
//
// GitHub Pages lags a push by a minute or more and its CDN may serve build.json for up to 10 minutes (max-age=600), so in URL
// mode every request carries a cache-busting query and the tool polls until build.json is the expected one before it judges the rest.
// Exit code 0 when every check passes, 1 when one fails, 2 for a usage error.
import {createHash} from 'node:crypto';
import {existsSync, readFileSync, readdirSync, realpathSync, statSync} from 'node:fs';
import {join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

export const MAX_ROOT_HTML_BYTES = 3_500_000;
export const QUICK_LIMIT_BYTES = 1_000_000;
export const ORT_FILES = ['ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm', 'ort.wasm.min.mjs'];
export const REQUIRED_FILES = [
  'index.html', 'music-map/index.html', 'classic/index.html', 'build.json',
  'ai/tc8/vision.onnx', 'ai/tc8/labels.json', 'ai/tc8/LICENSE-TinyCLIP-MIT.txt', 'ai/LICENSE-onnxruntime-web-MIT.txt',
  ...ORT_FILES.map(name => `ai/ort/${name}`),
  'shared/three-0.186.1/three.module.js', 'shared/three-0.186.1/three.core.js',
  'sql/sql-wasm.wasm', 'sql/LICENSE-sql.js-MIT.txt',
];
/** Patterns that must not appear in the static HTML: a root-absolute URL would escape /musicSpace/ and /musicSpace/preview/. */
export const FORBIDDEN_HTML = [
  {name: 'import from "/shared/…" (root-absolute three.js)', re: /from\s*["'`]\/shared\//},
  {name: 'URL "/shared/three…"', re: /["'`(]\/shared\/three/},
  {name: "location.assign('/music-map…')", re: /location\.assign\(\s*["'`]\/music-map/},
  {name: "location.assign('/event-room/…')", re: /location\.assign\(\s*["'`]\/event-room\//},
  {name: "startsWith('/event-room/') as a return check", re: /startsWith\(\s*["'`]\/event-room\/["'`]\s*\)/},
  {name: '"/music-map/#/explore" as a navigation target', re: /["'`]\/music-map\/#\/explore["'`]/},
];

const sha256 = data => createHash('sha256').update(data).digest('hex');
const escapeRe = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isUrl = text => /^https?:\/\//i.test(String(text));
const firstModuleScript = html => html.search(/<script\b[^>]*\btype=["']module["']/i);

/** Every file below `dir`, posix-style relative paths. */
function listFiles(dir) {
  const out = [];
  const walk = current => {
    for (const entry of readdirSync(current, {withFileTypes: true})) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) walk(path); else if (entry.isFile()) out.push(relative(dir, path).split(sep).join('/'));
    }
  };
  walk(dir);
  return out.sort();
}

/** A tree to read: a directory or a base URL. read(path) -> {ok, data?: Buffer, error?}, head(path) -> {ok, bytes?}. */
export function openSource(spec, {fetchImpl = globalThis.fetch, now = Date.now} = {}) {
  if (!isUrl(spec)) {
    const root = resolve(spec);
    return {
      kind: 'dir', label: root, root,
      async read(path) { try { return {ok: true, data: readFileSync(join(root, path))}; } catch (error) { return {ok: false, error: error.code || String(error)}; } },
      async head(path) { try { const info = statSync(join(root, path)); return {ok: info.isFile(), bytes: info.size}; } catch { return {ok: false}; } },
      list: () => listFiles(root),
    };
  }
  const base = new URL(spec.endsWith('/') ? spec : `${spec}/`);
  const urlOf = path => { const url = new URL(path, base); url.searchParams.set('verify', String(now())); return url; };
  const request = async (path, method) => {
    try {
      const response = await fetchImpl(urlOf(path), {method, cache: 'no-store', headers: {'Cache-Control': 'no-cache'}});
      return response;
    } catch (error) { return {ok: false, status: 0, error: error.message}; }
  };
  return {
    kind: 'url', label: base.href, root: base.href,
    async read(path) {
      const response = await request(path, 'GET');
      if (!response.ok) return {ok: false, error: response.error || `HTTP ${response.status}`};
      return {ok: true, data: Buffer.from(await response.arrayBuffer())};
    },
    async head(path) {
      const response = await request(path, 'HEAD');
      return {ok: response.ok, bytes: Number(response.headers?.get?.('content-length')) || undefined};
    },
    list: null,
  };
}

const sameBuild = (a, b) => Boolean(a && b) && a.version === b.version && a.commit === b.commit && a.builtAt === b.builtAt && JSON.stringify(a.files) === JSON.stringify(b.files);
const parseJson = buffer => { try { return JSON.parse(buffer.toString('utf8')); } catch { return null; } };

/** Checks on one HTML page. `kind` is 'root' (event room) or 'map'. Returns [{name, ok, detail}]. */
export function checkHtml(html, kind, build) {
  const checks = [];
  const add = (name, ok, detail = '') => checks.push({name, ok: Boolean(ok), detail: ok ? '' : detail});
  const page = kind === 'root' ? 'index.html' : 'music-map/index.html';
  const level = kind === 'root' ? './' : '../';
  const bad = FORBIDDEN_HTML.filter(({re}) => re.test(html)).map(({name}) => name);
  add(`${page}: no root-absolute navigation or shared import`, !bad.length, bad.join('; '));
  const meta = (name, content) => new RegExp(`<meta name="${name}" content="${escapeRe(content)}">`).test(html);
  add(`${page}: meta space-site-root ${level}`, meta('space-site-root', level), 'missing or different');
  add(`${page}: meta space-event-room ${level}`, meta('space-event-room', level), 'missing or different');
  const buildMeta = /<meta name="space-build" content="([^"]*)">/.exec(html)?.[1];
  const wanted = build ? `${build.version}+${build.commit}` : null;
  add(`${page}: meta space-build ${wanted || '(present)'}`, buildMeta && (!wanted || buildMeta === wanted), `found ${buildMeta ?? 'none'}`);
  for (const file of ['three.module.js', 'three.core.js']) add(`${page}: modulepreload ${level}shared/three-0.186.1/${file}`, html.includes(`<link rel="modulepreload" href="${level}shared/three-0.186.1/${file}">`), 'hint missing');
  const body = html.search(/<body\b/i), script = firstModuleScript(html);
  add(`${page}: module script comes after <body>`, body >= 0 && script > body, `body at ${body}, first module script at ${script}`);
  add(`${page}: the module script is inline`, !/<script\b[^>]*\btype=["']module["'][^>]*\bsrc=/i.test(html), 'a module script still has a src');
  const notices = kind === 'root' ? ['three-MIT.txt', 'sakura-crossing-MIT.txt', 'qrcode-generator-MIT.txt', 'sql.js-MIT.txt'] : ['three-MIT.txt', 'sakura-crossing-MIT.txt', 'gsap-notice.txt', 'overlayscrollbars-MIT.txt', 'phosphor-MIT.txt', 'qrcode-generator-MIT.txt'];
  const lacking = notices.filter(file => !html.includes(`<!-- ${file}\n`));
  add(`${page}: the ${notices.length} licence notices are kept as HTML comments`, !lacking.length, `missing: ${lacking.join(', ')}`);
  add(`${page}: <noscript> and nomodule messages`, /<noscript\b/i.test(html) && /<script nomodule\b/i.test(html), 'missing');
  if (kind === 'root') {
    add(`${page}: meta space-ai-base ./ai/`, meta('space-ai-base', './ai/'), 'missing or different');
    add(`${page}: preload ./sql/sql-wasm.wasm`, html.includes('<link rel="preload" as="fetch" crossorigin href="./sql/sql-wasm.wasm">'), 'hint missing');
    add(`${page}: title`, html.includes('<title>Music Space · 同一刻，另一面</title>'), 'title is not the site title');
    add(`${page}: rescue script`, html.includes('window.__SPACE_RESCUE__') || html.includes('w.__SPACE_RESCUE__'), 'rescue script missing');
    add(`${page}: size under ${MAX_ROOT_HTML_BYTES} bytes`, Buffer.byteLength(html) < MAX_ROOT_HTML_BYTES, `${Buffer.byteLength(html)} bytes`);
  }
  return checks;
}

/**
 * Runs every check. Options: source (dir or URL), sameAs, indexSha256, expected (a build.json object for URL polling),
 * requireDemo, quick, ignore (path prefixes a directory check does not judge), poll ({timeoutMs, intervalMs} or null), fetchImpl, log, sleep, now.
 * Resolves {ok, checks, build, indexSha256, buildJsonSha256}; never throws for a failed check.
 */
export async function verifyTree({source, sameAs = null, indexSha256 = null, expected = null, requireDemo = false, quick = false, ignore = [], poll = {timeoutMs: 600_000, intervalMs: 15_000}, fetchImpl, log = () => {}, sleep = ms => new Promise(done => setTimeout(done, ms)), now = Date.now} = {}) {
  const checks = [];
  const add = (name, ok, detail = '') => checks.push({name, ok: Boolean(ok), detail: ok ? '' : detail});
  const src = typeof source === 'object' && source ? source : openSource(source, {fetchImpl, now});
  const cache = new Map();
  const read = async path => { if (!cache.has(path)) cache.set(path, await src.read(path)); return cache.get(path); };

  // 1. build.json (URL mode: wait until the deploy is the expected one)
  const started = now();
  let build = null, buildBytes = null, last = '';
  for (;;) {
    cache.delete('build.json');
    const result = await read('build.json');
    if (result.ok) {
      build = parseJson(result.data);
      const listedIndex = Array.isArray(build?.files) ? build.files.find(file => file.path === 'index.html')?.sha256 : undefined;
      if (!build) last = 'build.json is not JSON';
      else if (expected && !sameBuild(build, expected)) last = `live build.json is ${build.version}+${build.commit} built ${build.builtAt}, expected ${expected.version}+${expected.commit} built ${expected.builtAt}`;
      else if (indexSha256 && listedIndex !== indexSha256) last = `live build.json lists index.html ${listedIndex ?? 'nothing'}, expected ${indexSha256}`;
      else { buildBytes = result.data; break; }
    } else last = `build.json: ${result.error}`;
    if (src.kind !== 'url' || !poll || now() - started >= poll.timeoutMs) {
      add(expected || indexSha256 ? 'live build.json is the expected build' : 'build.json is present and valid', false, last);
      return {ok: false, checks, build: null, indexSha256: null, buildJsonSha256: null};
    }
    log(`waiting for the deploy: ${last}; trying again in ${Math.round(poll.intervalMs / 1000)} s`);
    await sleep(poll.intervalMs);
  }
  add(expected || indexSha256 ? 'live build.json is the expected build' : 'build.json is present and valid', true);
  const listed = Array.isArray(build.files) ? build.files : [];
  add('build.json has version, commit, builtAt and files (and no channel)', build.version && build.commit && build.builtAt && listed.length && !('channel' in build), 'a field is missing, or a channel is present');
  const paths = new Set(listed.map(file => file.path));

  // 2. required files, in build.json and (dir mode) on disk without strays
  const required = [...REQUIRED_FILES, ...(requireDemo ? ['demo/manifest.json'] : [])];
  const missing = required.filter(path => path !== 'build.json' && !paths.has(path));
  add('required files are listed in build.json', !missing.length, `missing: ${missing.join(', ')}`);
  if (paths.has('demo/manifest.json')) {
    // Schema-tolerant: when the manifest lists photos as {files: [{file}]}, each must be part of the tree.
    const manifestRead = await read('demo/manifest.json');
    const manifest = manifestRead.ok ? parseJson(manifestRead.data) : null;
    const photos = Array.isArray(manifest?.files) ? manifest.files.map(entry => entry?.file).filter(name => typeof name === 'string') : null;
    if (!manifest) add('demo/manifest.json is JSON', false, manifestRead.error || 'not JSON');
    else if (photos) add(`demo/manifest.json: all ${photos.length} listed photos are in the tree`, photos.every(name => paths.has(`demo/${name}`)), `missing: ${photos.filter(name => !paths.has(`demo/${name}`)).join(', ')}`);
  }
  if (!requireDemo && !paths.has('demo/manifest.json')) log('note: no demo/manifest.json in this tree (the showcase photos); pass --require-demo once the demo assets exist');
  if (src.kind === 'dir') {
    const onDisk = src.list().filter(path => !ignore.some(prefix => path === prefix || path.startsWith(prefix)));
    add('.nojekyll is present', onDisk.includes('.nojekyll'), '.nojekyll missing');
    const strays = onDisk.filter(path => path !== 'build.json' && path !== '.nojekyll' && !paths.has(path));
    add('no file besides those build.json lists', !strays.length, `unlisted: ${strays.slice(0, 8).join(', ')}`);
  }

  // 3. every listed file: present, same size, same sha256
  const wrong = [];
  for (const file of listed) {
    if (quick && src.kind === 'url' && file.bytes > QUICK_LIMIT_BYTES && !/\.html$/.test(file.path)) {
      const head = await src.head(file.path);
      if (!head.ok) wrong.push(`${file.path} (missing)`);
      continue;
    }
    const result = await read(file.path);
    if (!result.ok) wrong.push(`${file.path} (${result.error})`);
    else if (result.data.length !== file.bytes || sha256(result.data) !== file.sha256) wrong.push(`${file.path} (bytes or sha256 differ)`);
  }
  add(`build.json hashes equal the ${src.kind === 'url' ? 'served' : 'on-disk'} files (${listed.length}${quick ? ', large ones by existence' : ''})`, !wrong.length, wrong.slice(0, 8).join('; '));

  // 4. pages
  const pages = [['root', 'index.html'], ['map', 'music-map/index.html']];
  const html = {};
  for (const [kind, path] of pages) {
    const result = await read(path);
    if (!result.ok) { add(`${path} can be read`, false, result.error); continue; }
    html[kind] = result.data.toString('utf8');
    checks.push(...checkHtml(html[kind], kind, build));
  }
  const classic = await read('classic/index.html');
  add('classic/index.html: meta space-ai-base ../ai/', classic.ok && /<meta name="space-ai-base" content="\.\.\/ai\/">/.test(classic.data.toString('utf8')), 'missing');
  add('classic/ has no ai/ directory of its own', ![...paths].some(path => path.startsWith('classic/ai/')) && (src.kind !== 'dir' || !existsSync(join(src.root, 'classic/ai'))), 'classic/ai exists (the model pack must exist once, at ai/)');

  // 5. the model pack, with the sizes labels.json states (the browser refuses any other length)
  const labelsRead = await read('ai/tc8/labels.json');
  const labels = labelsRead.ok ? parseJson(labelsRead.data) : null;
  if (!labels) add('ai/tc8/labels.json is readable', false, labelsRead.error || 'not JSON');
  else {
    const sizeOf = async path => {
      const info = listed.find(file => file.path === path);
      return info ? info.bytes : -1;
    };
    add(`ai/tc8/${labels.model} is ${labels.modelBytes} bytes`, (await sizeOf(`ai/tc8/${labels.model}`)) === labels.modelBytes, `build.json lists ${await sizeOf(`ai/tc8/${labels.model}`)}`);
    add(`ai/ort/${labels.wasm} is ${labels.wasmBytes} bytes`, (await sizeOf(`ai/ort/${labels.wasm}`)) === labels.wasmBytes, `build.json lists ${await sizeOf(`ai/ort/${labels.wasm}`)}`);
  }
  const ort = [...paths].filter(path => path.startsWith('ai/ort/')).map(path => path.slice('ai/ort/'.length)).sort();
  add('ai/ort holds exactly the three runtime files', JSON.stringify(ort) === JSON.stringify(ORT_FILES), `found: ${ort.join(', ')}`);

  // 6. identity of index.html
  const indexRead = await read('index.html');
  const indexHash = indexRead.ok ? sha256(indexRead.data) : null;
  if (indexSha256) add(`index.html sha256 is ${indexSha256.slice(0, 12)}…`, indexHash === indexSha256, `found ${indexHash}`);
  if (sameAs) {
    const other = typeof sameAs === 'object' ? sameAs : openSource(sameAs, {fetchImpl, now});
    const theirs = await other.read('index.html');
    add(`index.html equals ${other.label}index.html (sha256)`, theirs.ok && indexHash === sha256(theirs.data), theirs.ok ? `ours ${indexHash}, theirs ${sha256(theirs.data)}` : `cannot read the other tree: ${theirs.error}`);
  }
  return {ok: checks.every(check => check.ok), checks, build, indexSha256: indexHash, buildJsonSha256: buildBytes ? sha256(buildBytes) : null};
}

function usage(message) {
  if (message) console.error(`verify-tree: ${message}`);
  console.error('usage: node scripts/pages/verify-tree.mjs <dir|url> [--same-as <dir|url>] [--index-sha256 <hex>] [--expected <dir|url|none>] [--require-demo] [--quick] [--ignore <prefix>] [--timeout <min>] [--interval <s>] [--no-poll] [--json]');
  process.exit(2);
}

async function cli(argv) {
  const options = {flags: new Set(), values: {}, ignore: []};
  const valued = new Set(['--same-as', '--index-sha256', '--expected', '--timeout', '--interval', '--ignore']);
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (valued.has(arg)) {
      if (i + 1 >= argv.length) usage(`${arg} needs a value`);
      if (arg === '--ignore') options.ignore.push(argv[++i]); else options.values[arg] = argv[++i];
    }
    else if (arg.startsWith('--')) options.flags.add(arg);
    else positional.push(arg);
  }
  const known = new Set(['--require-demo', '--quick', '--no-poll', '--json']);
  for (const flag of options.flags) if (!known.has(flag)) usage(`unknown option ${flag}`);
  if (positional.length !== 1) usage('give exactly one <dir|url>');
  const [target] = positional;
  const json = options.flags.has('--json');
  const log = message => { if (!json) console.log(`verify-tree: ${message}`); };

  let expected = null;
  // A pinned index.html hash already says which deploy is wanted, so the local dist-pages is not consulted then.
  const expectedSpec = options.values['--expected'] ?? (isUrl(target) && !options.values['--index-sha256'] && existsSync(resolve('dist-pages/build.json')) ? 'dist-pages' : 'none');
  if (isUrl(target) && expectedSpec !== 'none') {
    const read = await openSource(expectedSpec).read('build.json');
    if (!read.ok) usage(`cannot read the expected build.json from ${expectedSpec}: ${read.error}`);
    expected = parseJson(read.data);
    log(`expecting ${expected?.version}+${expected?.commit} built ${expected?.builtAt} (from ${expectedSpec})`);
  }
  const result = await verifyTree({
    source: target, sameAs: options.values['--same-as'] || null, indexSha256: options.values['--index-sha256'] || null, expected,
    requireDemo: options.flags.has('--require-demo'), quick: options.flags.has('--quick'), ignore: options.ignore,
    poll: options.flags.has('--no-poll') ? null : {timeoutMs: Number(options.values['--timeout'] ?? 10) * 60_000, intervalMs: Number(options.values['--interval'] ?? 15) * 1000},
    log,
  });
  if (json) console.log(JSON.stringify(result, null, 2));
  else {
    for (const check of result.checks) console.log(`${check.ok ? 'PASS' : 'FAIL'}  ${check.name}${check.ok ? '' : `: ${check.detail}`}`);
    const failed = result.checks.filter(check => !check.ok).length;
    console.log(`verify-tree: ${result.ok ? 'ok' : `${failed} check(s) FAILED`} - ${target}${result.build ? ` (${result.build.version}+${result.build.commit}, built ${result.build.builtAt})` : ''}`);
    if (result.indexSha256) console.log(`verify-tree: index.html sha256 ${result.indexSha256}${result.buildJsonSha256 ? `, build.json sha256 ${result.buildJsonSha256}` : ''}`);
  }
  process.exit(result.ok ? 0 : 1);
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) cli(process.argv.slice(2)).catch(error => { console.error(`verify-tree: ${error?.stack || error}`); process.exit(1); });
