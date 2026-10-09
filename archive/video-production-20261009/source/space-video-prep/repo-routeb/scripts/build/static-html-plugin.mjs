// Post-processing shared by the two static (GitHub Pages) Vite configs: vite.static.config.js (the event room as the site root)
// and vite.static-map.config.js (the Map one directory down). Nothing here touches the Node-server builds.
//
//   staticHtmlPlugin  rewrites the single-file HTML Vite writes: the inline module script moves from <head> to the end of <body>
//                     (the loading screen paints before 2 MB of script has been read), head hints start the three.js and wasm
//                     downloads early, the page-relative metas (space-site-root, space-event-room, space-build, space-ai-base)
//                     replace every root-absolute assumption, a classic rescue script lives outside the module graph, and
//                     <noscript> / <script nomodule> explain themselves to browsers that cannot run the page.
//   staticCopyPlugin  rewrites the sentences that say a "server" confirmed or received something, so the static site does not claim
//                     a server answered. Only the room's static config uses it; every rule must match at least once or the build fails.
//
// Pure functions (transformStaticHtml, applyCopyRules, rescueScript, buildInfo) are exported for tests/static-copy-transform.test.js.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

export const SITE_TITLE = 'Music Space · 同一刻，另一面';
/** Milliseconds the page may take to report window.__SPACE_BOOT__ === 'ready' before the rescue overlay appears. */
export const RESCUE_WATCHDOG_MS = 30_000;
/**
 * localStorage key prefixes the rescue reset clears. Must equal PURGE_PREFIXES of web/static-runtime/storage-guard.js
 * (tests/static-prefix-sync.test.js): the keys of the event-client, avatar, game, topic, corner and community stores. Never the
 * music-space-map-* / music-map-* keys, music-space:v1, music-space-live:v1, music-space-duet-seen:v1 or Cache Storage, because
 * the 0.16 root page, the Map and the standalone Map share this origin.
 */
export const RESCUE_PURGE_PREFIXES = [
  'music-space-avatar',
  'music-space-event-',
  'music-space-worldcup-',
  'music-space-topic-',
  'music-space-organization',
  'music-space-game-',
  'music-space-corner-',
  'music-space-community-',
  'music-space-tour:',
];

// ---------------------------------------------------------------------------------------------------------------------------
// Build identity: one value per `npm run build:pages`, shared by both Vite configs and build.json (scripts/pages/build.mjs sets
// STATIC_BUILT_AT once). The channel is deliberately not part of it: root and preview are the same bytes.

/** {version, commit, builtAt, buildAtMs}. commit is the git short sha, 'unknown' outside a git checkout. */
export function buildInfo({root = ROOT, env = process.env, now = () => Date.now()} = {}) {
  const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
  let commit = String(env.STATIC_COMMIT || '').trim();
  if (!commit) {
    try { commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).trim(); } catch { commit = ''; }
  }
  const stamp = env.STATIC_BUILT_AT ? new Date(env.STATIC_BUILT_AT) : new Date(now());
  if (Number.isNaN(stamp.getTime())) throw new Error(`STATIC_BUILT_AT is not a date: ${env.STATIC_BUILT_AT}`);
  return {version, commit: commit || 'unknown', builtAt: stamp.toISOString(), buildAtMs: stamp.getTime()};
}

// ---------------------------------------------------------------------------------------------------------------------------
// Copy transform (architecture 5.6): sentences in the panels say the server confirmed or received something. In the static site the
// "server" is the page itself, so the sentences are re-worded to what is true there. The Node-server build never loads this.

export const COPY_RULES = Object.freeze([
  {id: 'server-confirmed', from: '服务器已确认', to: '示例已确认'},
  {id: 'service-confirmed', from: '服务已确认', to: '示例已确认'},
  {id: 'service-received', from: '服务已收到', to: '示例已收到'},
  {id: 'vote-count', from: '结果按服务器当前票数决定', to: '结果按当前票数决定'},
  {id: 'stop-waiting', from: '停止等待不会撤销服务器操作', to: '停止等待不会撤销已发出的操作'},
]);

/** Fresh per-build match counters, one per rule. */
export const newCopyCounts = () => new Map(COPY_RULES.map(rule => [rule.id, 0]));

/** Applies every rule to `code`; adds the number of replacements per rule to `counts`. Returns the new text. */
export function applyCopyRules(code, counts = newCopyCounts()) {
  let out = String(code);
  for (const rule of COPY_RULES) {
    const parts = out.split(rule.from);
    if (parts.length === 1) continue;
    counts.set(rule.id, (counts.get(rule.id) || 0) + parts.length - 1);
    out = parts.join(rule.to);
  }
  return out;
}

/** Rule ids that matched nothing (empty when every rule did its job). */
export const unmatchedCopyRules = counts => COPY_RULES.filter(rule => !(counts.get(rule.id) > 0)).map(rule => rule.id);

const posix = p => String(p).replace(/\\/g, '/');
const DEFAULT_COPY_ROOTS = ['web/event-room/', 'web/event-client/'].map(dir => posix(fileURLToPath(new URL(`../../${dir}`, import.meta.url))));

/** Vite plugin: applies COPY_RULES to the JavaScript sources under web/event-room and web/event-client. */
export function staticCopyPlugin({roots = DEFAULT_COPY_ROOTS} = {}) {
  const dirs = roots.map(dir => (posix(dir).endsWith('/') ? posix(dir) : `${posix(dir)}/`));
  const counts = newCopyCounts();
  return {
    name: 'space-static-copy',
    apply: 'build',
    transform(code, id) {
      const file = posix(id).split('?')[0];
      if (!/\.m?js$/.test(file) || !dirs.some(dir => file.startsWith(dir))) return null;
      const next = applyCopyRules(code, counts);
      return next === code ? null : {code: next, map: null};
    },
    buildEnd(error) {
      if (error) return;
      const missing = unmatchedCopyRules(counts);
      if (missing.length) this.error(`static copy transform: rule(s) matched nothing: ${missing.join(', ')}. A source that carried the sentence was reworded or moved; update COPY_RULES in scripts/build/static-html-plugin.mjs on purpose.`);
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------------------
// Rescue script: a classic (ES5) inline script that runs outside the module graph, so it still works when the graph never
// starts (three.js failed to load, an old browser, a hung database). Browsers that cannot run modules get the nomodule message.

const FONT = "'Microsoft YaHei','PingFang SC',system-ui,sans-serif";

/**
 * The text of the rescue script. window.__SPACE_RESCUE__.show(reason) raises the overlay; the 30 s watchdog raises it when the
 * page never reports window.__SPACE_BOOT__ === 'ready'; a module script that fails to load raises it at once. 重置示例数据 deletes
 * this channel's IndexedDB database (music-space-static:<channel>:v1, the channel taken from the URL exactly as the boot does: a path
 * ending in /preview/ is the preview, anything else the site root) and every localStorage key under RESCUE_PURGE_PREFIXES, then reloads without
 * the query string. It needs no runtime.
 */
export function rescueScript({prefixes = RESCUE_PURGE_PREFIXES, watchdogMs = RESCUE_WATCHDOG_MS} = {}) {
  return `(function(){
var w=window,d=document;
if(w.__SPACE_RESCUE__)return;
var channel=/\\/preview\\/$/.test(w.location.pathname)?'preview':'pages';
var DB='music-space-static:'+channel+':v1';
var PREFIXES=${JSON.stringify(prefixes)};
var box=null,poll=0;
function el(tag,css,text){var e=d.createElement(tag);if(css)e.style.cssText=css;if(text)e.textContent=text;return e;}
function wipe(done){
 var over=false;function finish(){if(over)return;over=true;done();}
 try{var ls=w.localStorage,keys=[],i,j;for(i=0;i<ls.length;i++)keys.push(ls.key(i));
  for(i=0;i<keys.length;i++)for(j=0;j<PREFIXES.length;j++)if(keys[i]&&keys[i].indexOf(PREFIXES[j])===0){ls.removeItem(keys[i]);break;}}catch(e){}
 try{var req=w.indexedDB.deleteDatabase(DB);req.onsuccess=finish;req.onerror=finish;}catch(e){finish();return;}
 w.setTimeout(finish,1500);
}
function button(label,css,onclick){var b=el('button','display:block;width:100%;min-height:44px;margin:10px 0 0;padding:10px 14px;font:15px '+${JSON.stringify(FONT)}+';cursor:pointer;border-radius:2px;'+css,label);b.type='button';b.addEventListener('click',onclick);return b;}
function hide(){if(poll){w.clearInterval(poll);poll=0;}if(box&&box.parentNode)box.parentNode.removeChild(box);box=null;}
function show(reason){
 if(box||w.__SPACE_NOMODULE__)return;
 var card=el('div','box-sizing:border-box;width:100%;max-width:440px;margin:auto;padding:24px;background:#f0e9d8;color:#203b32;border:1px solid #b1a587;border-left:3px solid #a65a40;font-family:'+${JSON.stringify(FONT)}+';line-height:1.7');
 card.appendChild(el('h2','margin:0 0 8px;font-size:22px;line-height:1.4;font-weight:700','页面没能完整启动'));
 card.appendChild(el('p','margin:0;font-size:15px','这个示例在你的浏览器里运行，需要先启动一个本地小数据库。可以先重新载入；如果还是这样，重置示例数据会清除本页保存的示例内容，再重新开始。'));
 if(reason)card.appendChild(el('p','margin:8px 0 0;font-size:12px;color:#596b50;word-break:break-all','原因：'+String(reason).slice(0,160)));
 var primary='background:#294c3e;color:#f0e9d8;border:1px solid #294c3e;';
 var plain='background:#e4e4cb;color:#294c3e;border:1px solid #b2b99c;';
 var first=button('重新载入',primary,function(){w.location.reload();});
 card.appendChild(first);
 card.appendChild(button('重置示例数据',plain,function(){wipe(function(){w.location.replace(w.location.pathname);});}));
 var classic=el('a','display:block;box-sizing:border-box;width:100%;min-height:44px;margin:10px 0 0;padding:10px 14px;font:15px '+${JSON.stringify(FONT)}+';text-align:center;text-decoration:none;border-radius:2px;'+plain,'打开早期原型');
 classic.href='./classic/';card.appendChild(classic);
 card.appendChild(el('p','margin:12px 0 0;font-size:12px;color:#596b50','重置只清除这个浏览器里本页的示例数据和身份，不会上传任何内容。'));
 box=el('div','position:fixed;left:0;top:0;right:0;bottom:0;z-index:2147483647;display:flex;overflow:auto;padding:16px;box-sizing:border-box;background:rgba(24,45,38,.96)');
 box.id='space-rescue';box.setAttribute('role','alertdialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-label','页面没能完整启动');
 box.appendChild(card);(d.body||d.documentElement).appendChild(box);
 try{first.focus();}catch(e){}
 // A slow network is not a failure: if the page does finish booting later, the overlay goes away by itself.
 poll=w.setInterval(function(){if(w.__SPACE_BOOT__==='ready')hide();},1000);
}
w.__SPACE_RESCUE__={show:show,hide:hide,wipe:wipe,channel:channel,dbName:DB,prefixes:PREFIXES};
w.addEventListener('error',function(e){var t=e&&e.target;if(t&&t.tagName==='SCRIPT'&&t.type==='module')show('script-load-failed');},true);
w.setTimeout(function(){var s=w.__SPACE_BOOT__;if(s!=='ready')show(typeof s==='string'&&s.indexOf('failed:')===0?s:'timeout');},${Number(watchdogMs)});
})();`;
}

// ---------------------------------------------------------------------------------------------------------------------------
// The HTML

const PAGES = {
  // The room is the site root (and /preview/ of it); everything else is a directory below.
  root: {
    siteRoot: './', eventRoom: './', aiBase: './ai/', preload: './shared/three-0.186.1/', wasm: './sql/sql-wasm.wasm', title: SITE_TITLE, rescue: true,
    noModule: '这个浏览器版本太旧，打不开 Music Space 示例页。请换用较新的 Chrome、Edge、Safari 或 Firefox。',
    noScript: '需要开启 JavaScript 才能打开 Music Space 示例页。',
  },
  // The original Map at music-map/ (one directory down).
  map: {
    siteRoot: '../', eventRoom: '../', aiBase: '', preload: '../shared/three-0.186.1/', wasm: '', title: '', rescue: false,
    noModule: '这个浏览器版本太旧，打不开 Music Map。请换用较新的 Chrome、Edge、Safari 或 Firefox。',
    noScript: '需要开启 JavaScript 才能打开 Music Map。',
  },
};

const MARK = 'data-space-static';
const NOTICE_STYLE = `position:fixed;left:0;right:0;bottom:0;z-index:2147483646;margin:0;padding:14px 16px;background:#182d26;color:#f0e9d8;font:15px/1.7 ${FONT};text-align:center`;
/** Metas this plugin owns: any copy in the source page is replaced, never duplicated. */
const SPACE_META_NAMES = ['space-site-root', 'space-event-room', 'space-build', 'space-ai-base'];
const attr = value => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** Splits every <script> block out of `html`. Scripts are found sequentially, so markup inside a script's text is never read. */
function splitScripts(html) {
  const scripts = [];
  let rest = '', at = 0;
  const open = /<script\b([^>]*)>/gi;
  for (let m; (m = open.exec(html));) {
    const bodyStart = m.index + m[0].length;
    const close = html.indexOf('</script>', bodyStart);
    if (close < 0) throw new Error('static html: unterminated <script>');
    const end = close + '</script>'.length;
    scripts.push({tag: m[0], attrs: m[1], text: html.slice(m.index, end)});
    rest += html.slice(at, m.index);
    at = end;
    open.lastIndex = end;
  }
  return {scripts, rest: rest + html.slice(at)};
}

/**
 * Turns Vite's single-file HTML into the static page. `html` must already have its script inlined (vite-plugin-singlefile runs
 * first). Idempotent: running it on its own output gives the same output.
 */
export function transformStaticHtml(html, {page = 'root', build = {version: '0.0.0', commit: 'unknown'}} = {}) {
  const spec = PAGES[page];
  if (!spec) throw new Error(`static html: unknown page "${page}"`);
  const {scripts, rest} = splitScripts(String(html));
  const modules = scripts.filter(s => /\btype=["']module["']/i.test(s.attrs));
  if (!modules.length) throw new Error('static html: no inline module script found (vite-plugin-singlefile must run before this plugin)');
  const external = modules.find(s => /\bsrc=/i.test(s.attrs));
  if (external) throw new Error(`static html: a module script was not inlined: ${external.tag}`);
  const ours = scripts.filter(s => s.attrs.includes(MARK));
  const foreign = scripts.filter(s => !modules.includes(s) && !ours.includes(s));
  if (foreign.length) throw new Error(`static html: unexpected classic script ${foreign[0].tag}`);

  // Drop what an earlier run (or the source page) put there, so the result does not depend on how often this runs.
  let out = rest
    .replace(new RegExp(`<noscript\\b[^>]*${MARK}[^>]*>[\\s\\S]*?</noscript>`, 'gi'), '')
    .replace(/<link\b[^>]*(?:three\.module\.js|three\.core\.js|sql-wasm\.wasm)[^>]*>/gi, '')
    .replace(new RegExp(`<meta\\b[^>]*\\bname=["'](?:${SPACE_META_NAMES.join('|')})["'][^>]*>`, 'gi'), '');

  const head = /<head\b[^>]*>/i.exec(out);
  const headEnd = out.indexOf('</head>');
  if (!head || headEnd < 0 || !/<body\b[^>]*>/i.test(out.slice(headEnd)) || out.lastIndexOf('</body>') < 0) throw new Error('static html: <head> or <body> not found');

  // Head: title, metas, hints, rescue script.
  let headHtml = out.slice(head.index + head[0].length, headEnd);
  if (spec.title) headHtml = /<title>[\s\S]*?<\/title>/i.test(headHtml) ? headHtml.replace(/<title>[\s\S]*?<\/title>/i, () => `<title>${spec.title}</title>`) : `${headHtml}<title>${spec.title}</title>`;
  const metas = [
    ['space-site-root', spec.siteRoot], ['space-event-room', spec.eventRoom],
    ['space-build', `${build.version}+${build.commit}`], ...(spec.aiBase ? [['space-ai-base', spec.aiBase]] : []),
  ].map(([name, content]) => `<meta name="${name}" content="${attr(content)}">`).join('');
  const hints = [
    `<link rel="modulepreload" href="${spec.preload}three.module.js">`, `<link rel="modulepreload" href="${spec.preload}three.core.js">`,
    ...(spec.wasm ? [`<link rel="preload" as="fetch" crossorigin href="${spec.wasm}">`] : []),
  ].join('');
  const charset = /<meta\b[^>]*\bcharset=[^>]*>/i.exec(headHtml);
  const inject = metas + hints;
  headHtml = charset ? headHtml.slice(0, charset.index + charset[0].length) + inject + headHtml.slice(charset.index + charset[0].length) : inject + headHtml;
  // The rescue script closes the head: viewport, title and styles are read first, and it still starts its 30 s clock after ~100 KB.
  if (spec.rescue) headHtml += `<script ${MARK}="rescue">${rescueScript()}</script>`;
  out = out.slice(0, head.index + head[0].length) + headHtml + out.slice(headEnd);

  // Body: <noscript> first, then at the end the nomodule notice and the module script(s).
  const noScript = `<noscript ${MARK}="noscript"><div role="alert" style="${NOTICE_STYLE}">${spec.noScript}</div></noscript>`;
  const noModule = `<script nomodule ${MARK}="nomodule">(function(){var d=document,m=d.createElement('div');window.__SPACE_NOMODULE__=true;m.setAttribute('role','alert');m.style.cssText=${JSON.stringify(NOTICE_STYLE)};m.textContent=${JSON.stringify(spec.noModule)};(d.body||d.documentElement).appendChild(m);})();</script>`;
  const bodyTag = /<body\b[^>]*>/i.exec(out.slice(out.indexOf('</head>')));
  const bodyOpenEnd = out.indexOf('</head>') + bodyTag.index + bodyTag[0].length;
  const closeAt = out.lastIndexOf('</body>');
  out = out.slice(0, bodyOpenEnd) + noScript + out.slice(bodyOpenEnd, closeAt) + noModule + modules.map(s => s.text).join('') + out.slice(closeAt);
  return out;
}

/** Vite plugin: runs transformStaticHtml on the built index.html. List it after viteSingleFile() in the config's plugins. */
export function staticHtmlPlugin({page = 'root', build} = {}) {
  const info = build || buildInfo();
  return {
    name: 'space-static-html',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const chunk = bundle['index.html'];
      if (!chunk || chunk.type !== 'asset') this.error('static html: index.html is not in the bundle');
      const source = typeof chunk.source === 'string' ? chunk.source : Buffer.from(chunk.source).toString('utf8');
      chunk.source = transformStaticHtml(source, {page, build: info});
    },
  };
}
