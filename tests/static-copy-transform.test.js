import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  COPY_RULES, RESCUE_PURGE_PREFIXES, RESCUE_WATCHDOG_MS, applyCopyRules, buildInfo, newCopyCounts, rescueScript, staticCopyPlugin,
  staticHtmlPlugin, transformStaticHtml, unmatchedCopyRules,
} from '../scripts/build/static-html-plugin.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const BUILD = {version: '0.21.0-rc.4', commit: 'abc1234'};

// ---------------------------------------------------------------------------------------------------------------------------
// Copy transform (architecture 5.6)

test('each of the three rules drops the server from its sentence and leaves the rest of the line alone', () => {
  assert.deepEqual(COPY_RULES.map(rule => [rule.id, rule.from, rule.to]), [
    ['server-confirmed', '服务器已确认', '已确认'],
    ['service-confirmed', '服务已确认', '已确认'],
    ['service-received', '服务已收到', '已收到'],
  ]);
  const fixtures = [
    ["notice='服务器已确认。';", "notice='已确认。';"],
    ["notice='服务已确认。';", "notice='已确认。';"],
    ["notice='服务已收到，无需重发。';", "notice='已收到，无需重发。';"],
  ];
  assert.equal(fixtures.length, COPY_RULES.length);
  fixtures.forEach(([before, after], index) => {
    const counts = newCopyCounts();
    assert.equal(applyCopyRules(before, counts), after);
    assert.equal(counts.get(COPY_RULES[index].id), 1, COPY_RULES[index].id);
    assert.deepEqual(unmatchedCopyRules(counts), COPY_RULES.map(rule => rule.id).filter((_, i) => i !== index));
  });
});

test('every occurrence is rewritten and counted, unrelated text is untouched, and the rewrite is stable', () => {
  const counts = newCopyCounts();
  const code = 'a="服务器已确认";b="服务器已确认。";c="服务已确认这次操作。";d="服务器连接中";e="房间服务已连接";f="服务已收到上一条，无需重发。";g="服务已收到，无需重发。";';
  const out = applyCopyRules(code, counts);
  assert.equal(out, 'a="已确认";b="已确认。";c="已确认这次操作。";d="服务器连接中";e="房间服务已连接";f="已收到上一条，无需重发。";g="已收到，无需重发。";');
  assert.equal(counts.get('server-confirmed'), 2);
  assert.equal(counts.get('service-confirmed'), 1);
  assert.equal(counts.get('service-received'), 2);
  assert.equal(applyCopyRules(out, newCopyCounts()), out, 'no rewritten sentence matches another rule');
  for (const rule of COPY_RULES) assert.ok(!rule.to.includes(rule.from) && COPY_RULES.every(other => !rule.to.includes(other.from)), `${rule.id} output cannot trigger a rule`);
  assert.equal(applyCopyRules('没有任何相关句子', newCopyCounts()), '没有任何相关句子');
});

test('the copy plugin rewrites only JavaScript under web/event-room and web/event-client', () => {
  const plugin = staticCopyPlugin({roots: ['/repo/web/event-room/', '/repo/web/event-client']});
  const sentence = "x='服务器已确认';";
  assert.equal(plugin.transform(sentence, '/repo/web/event-room/music-games.js').code, "x='已确认';");
  assert.equal(plugin.transform(sentence, '/repo/web/event-client/api.js?v=1').code, "x='已确认';");
  assert.equal(plugin.transform(sentence, '/elsewhere/web/event-room/panel.mjs'), null, 'a path outside the roots is left alone');
  assert.equal(staticCopyPlugin({roots: ['C:/repo/web/event-room/']}).transform(sentence, 'C:\\repo\\web\\event-room\\panel.mjs').code, "x='已确认';", 'Windows-style ids are normalised');
  assert.equal(plugin.transform(sentence, '/repo/web/js/app.js'), null);
  assert.equal(plugin.transform(sentence, '/repo/web/event-room-other/x.js'), null, 'a sibling directory that merely starts with the same name');
  assert.equal(plugin.transform(sentence, '/repo/web/event-room/style.css'), null);
  assert.equal(plugin.transform('nothing to say', '/repo/web/event-room/a.js'), null);
  assert.equal(plugin.apply, 'build');
});

test('the build fails when a rule matched nothing, and stays quiet when another error already stopped it', () => {
  const plugin = staticCopyPlugin({roots: ['/repo/web/event-room/']});
  const failures = [];
  const context = {error: message => { failures.push(message); throw new Error(message); }};
  plugin.transform("a='服务器已确认。';b='服务已确认。';", '/repo/web/event-room/a.js');
  assert.throws(() => plugin.buildEnd.call(context), /service-received/, 'the one rule that never matched is named');
  assert.match(failures[0], /matched nothing/);
  assert.doesNotMatch(failures[0], /server-confirmed|service-confirmed/);
  plugin.transform("c='服务已收到，无需重发。';", '/repo/web/event-room/b.js');
  assert.doesNotThrow(() => plugin.buildEnd.call(context));
  const idle = staticCopyPlugin({roots: ['/repo/web/event-room/']});
  assert.doesNotThrow(() => idle.buildEnd.call(context, new Error('some other failure')), 'a failed build is not blamed on the rules');
});

test('the real sources still carry every sentence, so the static build can apply every rule', () => {
  const found = newCopyCounts();
  const walk = dir => {
    for (const entry of readdirSync(dir, {withFileTypes: true})) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path); else if (/\.m?js$/.test(entry.name)) applyCopyRules(readFileSync(path, 'utf8'), found);
    }
  };
  for (const dir of ['web/event-room', 'web/event-client']) walk(join(ROOT, dir));
  assert.deepEqual(unmatchedCopyRules(found), [], 'a sentence was reworded or moved: change COPY_RULES (scripts/build/static-html-plugin.mjs) on purpose, or the static build stops');
});

// ---------------------------------------------------------------------------------------------------------------------------
// The HTML

const SCRIPT = 'import*as e from"./shared/three-0.186.1/three.module.js";const s="<body> </head> <title>inner</title> <style> <meta name=\\"space-build\\">";document.title=s;const t="\\x3C/script>";';
const PAGE = [
  '<!doctype html>\n<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
  '<meta name="space-ai-base" content="../ai/"><title>Music Space · 这一场，我们在一起</title>',
  `<script type="module" crossorigin>${SCRIPT}</script>`,
  '<style rel="stylesheet" crossorigin>body{margin:0}</style></head>',
  '<body><div id="app"><svg><title>icon</title></svg></div></body></html>\n<!-- three-MIT.txt\nlicense text\n-->\n',
].join('');
const moduleTag = `<script type="module" crossorigin>${SCRIPT}</script>`;
const indexOfTag = (html, tag) => html.indexOf(tag);

test('the root page: module script at the end of body, hints, metas, title, rescue, noscript and nomodule', () => {
  const html = transformStaticHtml(PAGE, {page: 'root', build: BUILD});
  assert.ok(html.indexOf(moduleTag) > html.indexOf('<body>'), 'the module script comes after <body>');
  assert.ok(html.indexOf(moduleTag) > html.indexOf('<div id="app">'), 'and after the markup it boots');
  assert.equal(html.split(moduleTag).length, 2, 'the script text is moved byte for byte, exactly once');
  assert.ok(html.indexOf('</body>') > html.indexOf(moduleTag));
  assert.ok(!html.slice(0, html.indexOf('<body>')).includes('type="module"'), 'no module script is left in the head');
  assert.match(html, /<meta name="space-site-root" content="\.\/">/);
  assert.match(html, /<meta name="space-event-room" content="\.\/">/);
  assert.match(html, /<meta name="space-build" content="0\.21\.0-rc\.4\+abc1234">/);
  assert.equal(html.match(/<meta name="space-ai-base"/g).length, 1, 'the source page\'s ../ai/ is replaced, not duplicated');
  assert.match(html, /<meta name="space-ai-base" content="\.\/ai\/">/);
  assert.match(html, /<link rel="modulepreload" href="\.\/shared\/three-0\.186\.1\/three\.module\.js">/);
  assert.match(html, /<link rel="modulepreload" href="\.\/shared\/three-0\.186\.1\/three\.core\.js">/);
  assert.match(html, /<link rel="preload" as="fetch" crossorigin href="\.\/sql\/sql-wasm\.wasm">/);
  assert.match(html, /<title>Music Space · 同一刻，另一面<\/title>/);
  assert.ok(html.indexOf('<title>Music Space · 同一刻') < html.indexOf('</head>') && html.includes('<svg><title>icon</title></svg>'), 'only the head title is replaced');
  assert.ok(html.indexOf('<meta charset="UTF-8"><meta name="space-site-root"') > 0, 'the hints follow <meta charset>');
  assert.ok(html.indexOf('data-space-static="rescue"') > html.indexOf('<style') && html.indexOf('data-space-static="rescue"') < html.indexOf('</head>'), 'the rescue script closes the head');
  assert.match(html, /<body><noscript data-space-static="noscript"><div role="alert" style="[^"]*">需要开启 JavaScript 才能打开 Music Space。<\/div><\/noscript>/);
  assert.match(html, /<script nomodule data-space-static="nomodule">.*"这个浏览器版本太旧，打不开 Music Space。请换用较新的 Chrome、Edge、Safari 或 Firefox。".*<\/script>/s);
  assert.doesNotMatch(html.slice(html.indexOf('<body>')), /示例/, 'the notices name the product, not an example page');
  assert.ok(html.indexOf('<script nomodule') < html.indexOf(moduleTag), 'the nomodule notice comes before the module script');
  assert.ok(html.endsWith('<!-- three-MIT.txt\nlicense text\n-->\n'), 'text after </html> (the licence comments) is kept');
});

test('the Map page: relative hints one directory down, no wasm preload, no rescue script, its own title', () => {
  const html = transformStaticHtml(PAGE, {page: 'map', build: BUILD});
  assert.match(html, /<meta name="space-site-root" content="\.\.\/">/);
  assert.match(html, /<meta name="space-event-room" content="\.\.\/">/);
  assert.match(html, /<link rel="modulepreload" href="\.\.\/shared\/three-0\.186\.1\/three\.module\.js">/);
  assert.ok(!html.includes('sql-wasm.wasm') && !html.includes('space-ai-base') && !html.includes('__SPACE_RESCUE__'));
  assert.match(html, /<title>Music Space · 这一场，我们在一起<\/title>/, 'the Map keeps its own title');
  assert.ok(html.indexOf(moduleTag) > html.indexOf('<body>'));
  assert.match(html, /<body><noscript data-space-static="noscript"><div role="alert" style="[^"]*">需要开启 JavaScript 才能打开音乐探索。<\/div><\/noscript>/);
  assert.match(html, /<script nomodule data-space-static="nomodule">.*"这个浏览器版本太旧，打不开音乐探索。请换用较新的 Chrome、Edge、Safari 或 Firefox。".*<\/script>/s);
  assert.doesNotMatch(html.slice(html.indexOf('<body>')), /Music Map|示例/, 'the notices use the page\'s name, 音乐探索');
});

test('running the transform twice gives the same page', () => {
  for (const page of ['root', 'map']) {
    const once = transformStaticHtml(PAGE, {page, build: BUILD});
    assert.equal(transformStaticHtml(once, {page, build: BUILD}), once, page);
  }
});

test('the transform refuses a page it cannot place safely', () => {
  assert.throws(() => transformStaticHtml('<html><head></head><body></body></html>'), /no inline module script/);
  assert.throws(() => transformStaticHtml(PAGE.replace('<script type="module" crossorigin>', '<script type="module" crossorigin src="./x.js">')), /was not inlined/);
  assert.throws(() => transformStaticHtml(PAGE.replace('<style rel=', '<script>alert(1)</script><style rel=')), /unexpected classic script/);
  assert.throws(() => transformStaticHtml(PAGE.replace('</body>', '')), /<head> or <body> not found/);
  assert.throws(() => transformStaticHtml(PAGE, {page: 'nowhere'}), /unknown page/);
});

test('the plugin is a post-order build plugin that rewrites index.html in the bundle', () => {
  const plugin = staticHtmlPlugin({page: 'root', build: BUILD});
  assert.equal(plugin.enforce, 'post');
  assert.equal(plugin.apply, 'build');
  const bundle = {'index.html': {type: 'asset', source: PAGE}};
  plugin.generateBundle.call({error: message => { throw new Error(message); }}, {}, bundle);
  assert.ok(bundle['index.html'].source.indexOf(moduleTag) > bundle['index.html'].source.indexOf('<body>'));
  assert.throws(() => plugin.generateBundle.call({error: message => { throw new Error(message); }}, {}, {}), /index\.html is not in the bundle/);
});

test('buildInfo takes the version from package.json and honours STATIC_COMMIT and STATIC_BUILT_AT', () => {
  const info = buildInfo({env: {STATIC_COMMIT: 'deadbee', STATIC_BUILT_AT: '2026-10-05T12:00:00Z'}});
  assert.equal(info.version, JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version);
  assert.equal(info.commit, 'deadbee');
  assert.equal(info.builtAt, '2026-10-05T12:00:00.000Z');
  assert.equal(info.buildAtMs, Date.parse('2026-10-05T12:00:00Z'));
  assert.equal(buildInfo({env: {STATIC_COMMIT: 'x'}, now: () => 1_700_000_000_000}).buildAtMs, 1_700_000_000_000);
  assert.throws(() => buildInfo({env: {STATIC_BUILT_AT: 'not a date'}}), /not a date/);
  assert.match(buildInfo({env: {}}).commit, /^([0-9a-f]{7,}|unknown)$/);
});

// ---------------------------------------------------------------------------------------------------------------------------
// The rescue script, run against a fake browser

test('the rescue purge list is the architecture 4.4 list, never a keep key', () => {
  assert.deepEqual([...RESCUE_PURGE_PREFIXES], ['music-space-avatar', 'music-space-event-', 'music-space-worldcup-', 'music-space-topic-', 'music-space-organization', 'music-space-game-', 'music-space-corner-', 'music-space-community-', 'music-space-tour:']);
  for (const keep of ['music-space-map-state:v1', 'music-space:v1', 'music-space-live:v1', 'music-space-duet-seen:v1', 'music-map-theme']) {
    assert.ok(!RESCUE_PURGE_PREFIXES.some(prefix => keep.startsWith(prefix)), `${keep} must survive a reset`);
  }
});

function fakeBrowser({pathname = '/musicSpace/', keys = [], boot, noModule = false} = {}) {
  const timers = [], listeners = {}, calls = {reload: 0, replaced: [], deleted: []};
  let clock = 0, nextId = 1;
  const makeElement = tag => ({
    tag, style: {}, children: [], attrs: {}, parentNode: null, handlers: {}, focused: false,
    appendChild(child) { child.parentNode = this; this.children.push(child); return child; },
    removeChild(child) { this.children = this.children.filter(c => c !== child); child.parentNode = null; },
    setAttribute(name, value) { this.attrs[name] = String(value); },
    addEventListener(type, fn) { this.handlers[type] = fn; },
    focus() { this.focused = true; },
    get text() { return (this.textContent || '') + this.children.map(c => c.text).join(''); },
  });
  const storage = new Map(keys.map(key => [key, 'v']));
  const body = makeElement('body');
  const sandbox = {
    document: {body, documentElement: makeElement('html'), createElement: makeElement},
    localStorage: {get length() { return storage.size; }, key: index => [...storage.keys()][index] ?? null, removeItem: key => storage.delete(key)},
    indexedDB: {deleteDatabase(name) { calls.deleted.push(name); const request = {}; sandbox.pendingDelete = request; return request; }},
    location: {pathname, reload() { calls.reload++; }, replace(url) { calls.replaced.push(url); }},
    setTimeout(fn, ms) { const id = nextId++; timers.push({id, fn, at: clock + ms, every: 0}); return id; },
    setInterval(fn, ms) { const id = nextId++; timers.push({id, fn, at: clock + ms, every: ms}); return id; },
    clearInterval(id) { const i = timers.findIndex(t => t.id === id); if (i >= 0) timers.splice(i, 1); },
    addEventListener(type, fn, capture) { (listeners[type] ||= []).push({fn, capture}); },
  };
  sandbox.window = sandbox;
  if (boot !== undefined) sandbox.__SPACE_BOOT__ = boot;
  if (noModule) sandbox.__SPACE_NOMODULE__ = true;
  vm.createContext(sandbox);
  return {
    sandbox, body, calls, storage, listeners,
    run: code => vm.runInContext(code, sandbox),
    advance(ms) {
      const until = clock + ms;
      for (;;) {
        const due = timers.filter(t => t.at <= until).sort((a, b) => a.at - b.at)[0];
        if (!due) break;
        clock = due.at;
        if (due.every) due.at += due.every; else timers.splice(timers.indexOf(due), 1);
        due.fn();
      }
      clock = until;
    },
    overlay: () => body.children.find(child => child.id === 'space-rescue') || null,
    click(label) {
      const find = node => (node.children || []).flatMap(child => [child, ...find(child)]);
      const target = find(this.overlay()).find(node => (node.tag === 'button' || node.tag === 'a') && node.text === label);
      target.handlers.click();
    },
  };
}

test('the watchdog raises the overlay after 30 s without a ready boot, and a ready boot silences it', () => {
  const stalled = fakeBrowser();
  stalled.run(rescueScript());
  stalled.advance(RESCUE_WATCHDOG_MS - 1);
  assert.equal(stalled.overlay(), null, 'not before 30 s');
  stalled.advance(1);
  assert.ok(stalled.overlay(), 'at 30 s');
  assert.match(stalled.overlay().text, /页面没能完整启动/);
  assert.equal(stalled.overlay().attrs['data-reason'], 'timeout');
  assert.doesNotMatch(stalled.overlay().text, /timeout|原因/, 'the reason is for QA, not for the visitor');
  const ready = fakeBrowser({boot: 'ready'});
  ready.run(rescueScript());
  ready.advance(RESCUE_WATCHDOG_MS * 2);
  assert.equal(ready.overlay(), null);
  const failed = fakeBrowser({boot: 'failed:SNAPSHOT_CORRUPT'});
  failed.run(rescueScript());
  failed.advance(RESCUE_WATCHDOG_MS);
  assert.equal(failed.overlay().attrs['data-reason'], 'failed:SNAPSHOT_CORRUPT');
});

test('a slow boot that finishes after the overlay appeared removes it by itself', () => {
  const browser = fakeBrowser();
  browser.run(rescueScript());
  browser.advance(RESCUE_WATCHDOG_MS);
  assert.ok(browser.overlay());
  browser.sandbox.__SPACE_BOOT__ = 'ready';
  browser.advance(1000);
  assert.equal(browser.overlay(), null);
  assert.equal(browser.body.children.length, 0);
});

test('show(reason) from the boot raises the overlay with two actions of at least 44 px and two short lines; the reason stays off screen', () => {
  const browser = fakeBrowser();
  browser.run(rescueScript());
  browser.sandbox.__SPACE_RESCUE__.show('failed:MIGRATION_CHANGED');
  const overlay = browser.overlay();
  assert.equal(overlay.attrs.role, 'alertdialog');
  assert.equal(overlay.attrs['aria-modal'], 'true');
  const flat = node => (node.children || []).flatMap(child => [child, ...flat(child)]);
  const actions = flat(overlay).filter(node => node.tag === 'button' || node.tag === 'a');
  assert.deepEqual(actions.map(node => node.text), ['重新载入', '重新开始']);
  assert.ok(!flat(overlay).some(node => node.tag === 'a'), 'no link: classic/ (the 0.16 page) stays unlinked');
  const lines = flat(overlay).filter(node => node.tag === 'p').map(node => node.text);
  assert.deepEqual(lines, ['先重新载入试试；还不行的话，点「重新开始」。', '「重新开始」会清除你的昵称、小人、照片和交换。']);
  assert.equal(flat(overlay).find(node => node.tag === 'span').style.cssText.includes('white-space:nowrap'), true, 'the button\'s name never breaks across lines');
  assert.equal(flat(overlay).find(node => node.tag === 'h2').textContent, '页面没能完整启动');
  assert.doesNotMatch(overlay.text, /示例|早期原型|经典版|数据库|上传|原因|MIGRATION_CHANGED/);
  for (const node of actions) assert.match(node.style.cssText, /min-height:44px/, node.text);
  assert.ok(actions[0].focused, 'focus lands on the first action');
  assert.equal(overlay.attrs['data-reason'], 'failed:MIGRATION_CHANGED');
  browser.sandbox.__SPACE_RESCUE__.show('again');
  assert.equal(browser.body.children.length, 1, 'a second show does not stack another overlay');
  for (const node of flat(overlay)) {
    const size = /font(?:-size)?:[^;]*?(\d+)px/.exec(node.style.cssText || '');
    if (node.textContent) assert.ok(size && Number(size[1]) >= 12, `${node.tag} "${node.textContent.slice(0, 12)}" is at least 12px`);
    if (node.textContent && node.tag !== 'p' && node.tag !== 'h2') assert.ok(Number(size[1]) >= 14, `${node.tag} is body text: at least 14px`);
    if (node.tag === 'p' && /margin:0;font-size/.test(node.style.cssText)) assert.ok(Number(size[1]) >= 14, 'the explanation is body text: at least 14px');
  }
});

test('重新载入 reloads', () => {
  const browser = fakeBrowser();
  browser.run(rescueScript());
  browser.sandbox.__SPACE_RESCUE__.show('x');
  browser.click('重新载入');
  assert.equal(browser.calls.reload, 1);
});

test('重新开始 deletes this channel\'s database and the purge-prefix keys only, then reloads without the query', () => {
  const purge = RESCUE_PURGE_PREFIXES.map(prefix => `${prefix}x:1`);
  const keep = ['music-space-map-state:v1', 'music-space-map-saved-music:v1', 'music-space:v1', 'music-space-live:v1', 'music-space-duet-seen:v1', 'music-map-theme', 'unrelated'];
  for (const [pathname, db] of [['/musicSpace/', 'music-space-static:pages:v1'], ['/musicSpace/index.html', 'music-space-static:pages:v1'], ['/musicSpace/preview/', 'music-space-static:preview:v1'], ['/preview/', 'music-space-static:preview:v1'], ['/musicSpace/previews/', 'music-space-static:pages:v1'], ['/musicSpace/preview/classic/', 'music-space-static:pages:v1']]) {
    const browser = fakeBrowser({pathname, keys: [...purge, ...keep]});
    browser.run(rescueScript());
    assert.equal(browser.sandbox.__SPACE_RESCUE__.dbName, db, pathname);
    browser.sandbox.__SPACE_RESCUE__.show('x');
    browser.click('重新开始');
    assert.deepEqual(browser.calls.deleted, [db], pathname);
    assert.deepEqual([...browser.storage.keys()].sort(), [...keep].sort(), `${pathname}: only the purge keys went`);
    assert.deepEqual(browser.calls.replaced, [], 'it waits for the database delete');
    browser.sandbox.pendingDelete.onsuccess();
    assert.deepEqual(browser.calls.replaced, [pathname], 'then reloads the bare path (no ?room=)');
    browser.advance(5000);
    assert.equal(browser.calls.replaced.length, 1, 'a late timeout does not reload twice');
  }
});

test('a blocked database delete does not trap the visitor: the reset goes on after 1.5 s', () => {
  const browser = fakeBrowser({keys: ['music-space-avatar-session:v1']});
  browser.run(rescueScript());
  browser.sandbox.__SPACE_RESCUE__.show('x');
  browser.click('重新开始');
  browser.advance(1499);
  assert.deepEqual(browser.calls.replaced, []);
  browser.advance(1);
  assert.deepEqual(browser.calls.replaced, ['/musicSpace/']);
  const noIdb = fakeBrowser({keys: ['music-space-avatar-session:v1']});
  noIdb.sandbox.indexedDB = undefined;
  noIdb.run(rescueScript());
  noIdb.sandbox.__SPACE_RESCUE__.show('x');
  noIdb.click('重新开始');
  assert.deepEqual(noIdb.calls.replaced, ['/musicSpace/'], 'no IndexedDB at all: the keys are cleared and the page reloads');
  assert.equal(noIdb.storage.size, 0);
});

test('a module script that fails to load raises the overlay at once; other errors do not', () => {
  const browser = fakeBrowser();
  browser.run(rescueScript());
  const capture = browser.listeners.error.find(entry => entry.capture);
  assert.ok(capture, 'a capturing error listener is installed (resource errors do not bubble)');
  capture.fn({target: {tagName: 'IMG', type: ''}});
  capture.fn({target: {tagName: 'SCRIPT', type: 'text/javascript'}});
  capture.fn({message: 'ordinary runtime error'});
  assert.equal(browser.overlay(), null);
  capture.fn({target: {tagName: 'SCRIPT', type: 'module'}});
  assert.ok(browser.overlay(), 'the overlay is up at once');
  assert.equal(browser.overlay().attrs['data-reason'], 'script-load-failed');
});

test('a browser that cannot run modules gets the nomodule notice and no rescue overlay', () => {
  const page = transformStaticHtml(PAGE, {page: 'root', build: BUILD});
  const notice = /<script nomodule data-space-static="nomodule">([\s\S]*?)<\/script>/.exec(page)[1];
  const browser = fakeBrowser();
  browser.run(rescueScript());
  browser.run(notice);
  assert.equal(browser.sandbox.__SPACE_NOMODULE__, true);
  assert.equal(browser.body.children[0].textContent, '这个浏览器版本太旧，打不开 Music Space。请换用较新的 Chrome、Edge、Safari 或 Firefox。');
  browser.advance(RESCUE_WATCHDOG_MS * 2);
  assert.equal(browser.overlay(), null, 'the watchdog stays quiet: the page can never boot there');
});

test('the rescue script is plain ES5 so it also runs where modules do not', () => {
  const code = rescueScript();
  assert.doesNotThrow(() => new vm.Script(code));
  assert.ok(!/=>|\blet\b|\bconst\b|`|\.\.\.|\basync\b|\?\./.test(code), 'no arrow functions, let/const, template strings, spread, async or optional chaining');
  assert.ok(!code.includes('</script'), 'cannot end its own script tag');
});
