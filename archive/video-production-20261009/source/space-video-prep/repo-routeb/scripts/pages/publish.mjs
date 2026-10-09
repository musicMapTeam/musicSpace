// Publishes a Pages tree to the gh-pages branch of the origin remote, through a temporary git worktree of origin/gh-pages.
// A dry run unless --push. Never force-pushes: a push that is not a fast-forward is refused and nothing is overwritten.
//
//   node scripts/pages/publish.mjs --channel preview                    # dry run: what dist-pages would change below preview/
//   node scripts/pages/publish.mjs --channel preview --push
//   node scripts/pages/publish.mjs --channel pages --from-preview       # dry run of THE SWITCH
//   node scripts/pages/publish.mjs --channel pages --from-preview --push
//
//   --channel preview   writes only preview/ of the worktree (the tree is replaced by dist-pages); everything else is untouched.
//   --channel pages     replaces the site root (all but avatar-preview/, preview/ and .git) and REMOVES preview/ in the same commit.
//   --from-preview      with --channel pages: the new root is the tree that gh-pages already holds at preview/ (the bytes that were
//                       tested), not dist-pages. Refused when preview/build.json is missing or its hashes do not match.
//   --dist <dir>        the built tree (default dist-pages); --repo <dir> (default .), --remote origin, --branch gh-pages
//   --allow-no-demo     publish a tree without demo/manifest.json (only for experiments)
//   --no-verify         skip verify-tree before publishing (emergencies only)
//
// The commit message is "pages: publish <channel> <sha>" with the source commit recorded in the tree's build.json.
import {execFileSync} from 'node:child_process';
import {chmodSync, cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyTree} from './verify-tree.mjs';

const KEEP_AT_ROOT = new Set(['.git', 'avatar-preview', 'preview']);

/** Runs git in `cwd`; returns stdout. Errors carry git's own message. */
function git(cwd, ...args) {
  try { return execFileSync('git', args, {cwd, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe']}); }
  catch (error) { throw new Error(`git ${args.join(' ')}: ${String(error.stderr || error.message).trim()}`); }
}

/** Sets directories to 0755 and files to 0644 so the commit never records an executable bit by accident. */
function normaliseModes(dir) {
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) { chmodSync(path, 0o755); normaliseModes(path); } else if (entry.isFile()) chmodSync(path, 0o644);
  }
}

/** "add 3 / modify 1 / delete 2" per first path segment, from `git diff --cached --name-status`. */
function summarise(nameStatus) {
  const groups = new Map();
  for (const line of nameStatus.split('\n').filter(Boolean)) {
    const [status, ...rest] = line.split('\t');
    const path = rest[rest.length - 1];
    const top = path.includes('/') ? `${path.split('/')[0]}/` : path;
    const group = groups.get(top) || {A: 0, M: 0, D: 0, other: 0};
    group[status[0] in group ? status[0] : 'other']++;
    groups.set(top, group);
  }
  return [...groups].map(([top, g]) => `  ${top.padEnd(18)} +${g.A} added  ~${g.M} changed  -${g.D} removed${g.other ? `  ?${g.other} other` : ''}`).join('\n');
}

/**
 * The whole operation. Returns {changed, pushed, message, summary, base, head}. `log` receives progress lines.
 * Throws (after cleaning up the temporary worktree) when anything is wrong; nothing is pushed in that case.
 */
export async function publish({channel, fromPreview = false, push = false, dist = 'dist-pages', repo = '.', remote = 'origin', branch = 'gh-pages', allowNoDemo = false, noVerify = false, log = line => console.log(line)}) {
  if (channel !== 'preview' && channel !== 'pages') throw new Error('--channel must be "preview" or "pages"');
  if (fromPreview && channel !== 'pages') throw new Error('--from-preview only makes sense with --channel pages');
  const repoDir = resolve(repo);
  const top = git(repoDir, 'rev-parse', '--show-toplevel').trim();
  const distDir = resolve(repoDir, dist);
  if (!fromPreview && !existsSync(join(distDir, 'build.json'))) throw new Error(`${distDir} has no build.json: run npm run build:pages first`);

  const workRoot = mkdtempSync(join(tmpdir(), 'space-pages-'));
  const tree = join(workRoot, 'worktree');
  let added = false;
  try {
    log(`publish: fetching ${remote}/${branch}`);
    git(top, 'fetch', '--quiet', remote, branch);
    const base = git(top, 'rev-parse', `${remote}/${branch}`).trim();
    git(top, 'worktree', 'add', '--detach', '--quiet', tree, base);
    added = true;

    // The tree that becomes the new content.
    let source = distDir;
    if (fromPreview) {
      if (!existsSync(join(tree, 'preview', 'build.json'))) throw new Error(`${remote}/${branch} has no preview/build.json: publish the preview first (--channel preview --push); nothing was changed`);
      source = join(workRoot, 'preview-copy');
      cpSync(join(tree, 'preview'), source, {recursive: true});
      log(`publish: taking the tree at ${remote}/${branch}:preview/ (${base.slice(0, 7)}) as the new root`);
    }
    if (!noVerify) {
      const result = await verifyTree({source, requireDemo: !allowNoDemo, poll: null});
      if (!result.ok) throw new Error(`the tree to publish fails verify-tree:\n${result.checks.filter(check => !check.ok).map(check => `  FAIL ${check.name}: ${check.detail}`).join('\n')}\n(--no-verify skips this; only for emergencies)`);
      log(`publish: verify-tree passed (${result.build.version}+${result.build.commit}, ${result.build.files.length} files)`);
    } else log('publish: WARNING --no-verify: the tree was not verified');
    const build = JSON.parse(readFileSync(join(source, 'build.json'), 'utf8'));

    // Apply it to the worktree.
    if (channel === 'preview') {
      rmSync(join(tree, 'preview'), {recursive: true, force: true});
      cpSync(source, join(tree, 'preview'), {recursive: true});
      normaliseModes(join(tree, 'preview'));
    } else {
      if (!fromPreview) log('publish: note: --channel pages without --from-preview ships dist-pages, not the bytes that were tested at preview/');
      for (const entry of readdirSync(tree)) if (!KEEP_AT_ROOT.has(entry)) rmSync(join(tree, entry), {recursive: true, force: true});
      for (const entry of readdirSync(source)) if (!KEEP_AT_ROOT.has(entry)) cpSync(join(source, entry), join(tree, entry), {recursive: true});
      rmSync(join(tree, 'preview'), {recursive: true, force: true});
      for (const entry of readdirSync(tree)) if (!KEEP_AT_ROOT.has(entry)) { const path = join(tree, entry); if (statSync(path).isDirectory()) { chmodSync(path, 0o755); normaliseModes(path); } else chmodSync(path, 0o644); }
    }

    // --force: the tree is exactly what verify-tree vouched for; a user's global ignore rules must not drop a file from it.
    git(tree, 'add', '-A', '--force');
    const tracked = git(tree, 'ls-files', '-z').split('\0').filter(Boolean);
    const ours = channel === 'preview' ? tracked.filter(path => path.startsWith('preview/')).map(path => path.slice('preview/'.length)) : tracked.filter(path => !path.startsWith('avatar-preview/'));
    const wanted = [...build.files.map(file => file.path), 'build.json', '.nojekyll'];
    const lacking = wanted.filter(path => !ours.includes(path)), extra = ours.filter(path => !wanted.includes(path));
    if (lacking.length || extra.length) throw new Error(`the staged tree differs from build.json (missing: ${lacking.slice(0, 5).join(', ') || 'none'}; extra: ${extra.slice(0, 5).join(', ') || 'none'})`);
    const names = git(tree, 'diff', '--cached', '--no-renames', '--name-only').split('\n').filter(Boolean);
    const message = `pages: publish ${channel} ${build.commit}`;
    if (!names.length) { log(`publish: ${remote}/${branch} already holds this tree; nothing to publish`); return {changed: false, pushed: false, message, summary: '', base, head: base}; }
    const outside = channel === 'preview' ? names.filter(path => !path.startsWith('preview/')) : names.filter(path => path.startsWith('avatar-preview/'));
    if (outside.length) throw new Error(`refusing: this would change ${channel === 'preview' ? 'files outside preview/' : 'avatar-preview/'}: ${outside.slice(0, 5).join(', ')}`);
    const summary = summarise(git(tree, 'diff', '--cached', '--no-renames', '--name-status'));
    log(`publish: ${names.length} file(s) change on ${remote}/${branch} (${base.slice(0, 7)}):\n${summary}`);
    log(git(tree, 'diff', '--cached', '--no-renames', '--stat=140,100').trimEnd());

    if (!push) {
      log(`publish: DRY RUN, nothing committed or pushed. With --push this commits "${message}" and pushes it to ${remote}/${branch} (fast-forward only, never --force).`);
      return {changed: true, pushed: false, message, summary, base, head: base};
    }
    git(tree, 'commit', '--quiet', '-m', message);
    const head = git(tree, 'rev-parse', 'HEAD').trim();
    try { git(tree, 'push', '--quiet', remote, `HEAD:refs/heads/${branch}`); }
    catch (error) { throw new Error(`push refused (${error.message}). ${remote}/${branch} moved or is protected; nothing was overwritten. Fetch, re-run the dry run and push again.`); }
    log(`publish: pushed ${head.slice(0, 7)} to ${remote}/${branch} ("${message}")`);
    return {changed: true, pushed: true, message, summary, base, head};
  } finally {
    if (added) { try { git(top, 'worktree', 'remove', '--force', tree); } catch { /* removed with the directory below */ } }
    rmSync(workRoot, {recursive: true, force: true});
    try { git(top, 'worktree', 'prune'); } catch { /* nothing to prune */ }
  }
}

function parseArgs(argv) {
  const out = {push: false, fromPreview: false, allowNoDemo: false, noVerify: false};
  const valued = {'--channel': 'channel', '--dist': 'dist', '--repo': 'repo', '--remote': 'remote', '--branch': 'branch'};
  const flags = {'--push': 'push', '--from-preview': 'fromPreview', '--allow-no-demo': 'allowNoDemo', '--no-verify': 'noVerify'};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg in valued) { if (i + 1 >= argv.length) throw new Error(`${arg} needs a value`); out[valued[arg]] = argv[++i]; }
    else if (arg in flags) out[flags[arg]] = true;
    else throw new Error(`unknown argument ${arg}`);
  }
  return out;
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  let options;
  try { options = parseArgs(process.argv.slice(2)); } catch (error) {
    console.error(`publish: ${error.message}\nusage: node scripts/pages/publish.mjs --channel preview|pages [--from-preview] [--push] [--dist dist-pages] [--repo .] [--remote origin] [--branch gh-pages] [--allow-no-demo] [--no-verify]`);
    process.exit(2);
  }
  publish(options).then(result => { if (result.pushed) console.log('publish: next, node scripts/pages/verify-tree.mjs <live url> (it polls until Pages has deployed)'); }).catch(error => { console.error(`publish: FAILED: ${error.message}`); process.exit(1); });
}
