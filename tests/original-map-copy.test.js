// 音乐探索 (web/original-map) reads as one finished product (decided 2026-10-07): no storage, offline, legal or meta notes in
// the interface, no invented example catalogue, the Doodle look loaded the same way in every build, and the data and licence
// attributions kept in one place (关于 · 数据来源).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, existsSync} from 'node:fs';

const root = new URL('../web/original-map/', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
/** Source without comments, so a code note may still quote an old sentence; every string and template literal stays. */
const code = path => read(path).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
const UI_FILES = ['js/app.js', 'js/home.js', 'js/map.js', 'js/open-catalogue.js', 'js/share-card.js', 'js/space-bridge.js', 'js/map-data.js', 'index.html'];
const BANNED = ['示例', '虚构', '情景', '模拟', '演示', '只存在这个浏览器', '仅保存在当前浏览器', '仅存当前浏览器', '清除浏览器数据', '清除网站数据', '原版三维唱片桌',
  '真实合作精选', '真实的', '不代表', '未核实', '已核实', '核对', '樱下放映', '夜场唱片店', 'Web Locks', '不构成', '站内没有音频', '会离开本站', '策展标签',
  // the old collection word: the shortest route is 「最短」 everywhere now
  '本专题'];

test('no explanatory, storage, legal or example wording in the interface sources', () => {
  for (const file of UI_FILES) {
    // the one place that names an open check is the pattern that strips it from version lines (its text stays in 来源)
    const source = code(file).replace(/const OPEN_CHECK = \/[^\n]*\/g;/, '');
    for (const word of BANNED) assert.ok(!source.includes(word), `${file} still says 「${word}」`);
  }
});

test('「Music Map」 survives only as the origin line in 关于 · 数据来源', () => {
  for (const file of UI_FILES) {
    const hits = code(file).split('\n').filter(line => line.includes('Music Map'));
    if (file === 'js/app.js') assert.deepEqual(hits.map(line => line.trim()), ['<li><b>来历</b><span>唱片店、寻声和合唱目录来自 Music Map。</span></li>'], file);
    else assert.equal(hits.length, 0, `${file}: ${hits.join(' | ')}`);
  }
});

test('the invented 0.15 catalogue is gone, and a stored record that still points at it is let go', async () => {
  const data = await import('../web/original-map/js/map-data.js');
  assert.deepEqual(Object.keys(data.catalogues), ['real']);
  assert.ok(data.artists.length > 0 && data.artists.every(artist => artist.dataset === 'real'));
  assert.ok(data.edges.every(edge => edge.dataset === 'real' && edge.mode === 'co' && edge.sourceUrl));
  assert.ok(Object.values(data.songs).every(song => song.dataset === 'real'));
  const { prepareStoredMap, createMapState } = await import('../web/original-map/js/map.js');
  const state = { map: createMapState() };
  const real = state.map.sessions[0];
  const invented = { id: 'old-fiction', dataset: 'fictional', type: 'challenge', fog: true, start: 'a', target: 'f', status: 'active', mode: 'co', path: [{ id: 'a' }], events: [], saved: [{ id: 'co-0' }], flipped: [], hints: [], created: 1, updated: Date.now() };
  state.map.sessions.push(invented);
  state.map.activeId = invented.id;
  state.map.lastSessionByDataset.fictional = invented.id;
  state.map.undo = { sessionId: invented.id, item: { id: 'co-0' } };
  const api = { getState: () => state, update(mutate) { mutate(state); return true; } };
  prepareStoredMap(api);
  assert.deepEqual(state.map.sessions.map(session => session.id), [real.id]);
  assert.equal(state.map.activeId, real.id);
  assert.equal(state.map.undo, null);
  assert.ok(!Object.values(state.map.lastSessionByDataset).includes(invented.id));
});

test('the 关于 sheet keeps the data and licence attributions, counted from the data', () => {
  const app = code('js/app.js');
  assert.match(app, /<h2 id="about-title">关于音乐探索<\/h2>/);
  assert.match(app, /id="about-sources"/);
  assert.match(app, /<h3 id="about-sources-title">数据来源<\/h3>/);
  for (const piece of ['source.repository', 'source.revision.slice(0, 7)', 'source.licenseLabel', 'openCatalogue.counts.rows', 'openCatalogue.tracks.length', 'qqLinkedCount',
    "'fonts/doodle/LICENSES.txt'", 'eventRoomUrl()', 'ZCOOL QingKe HuangYou', 'LXGW Marker Gothic', 'Yozai', 'Luckiest Guy', 'Smiley Sans', 'SIL OFL 1.1', 'GSAP（Standard No Charge 许可）', 'three.js', 'OverlayScrollbars', 'qrcode-generator']) assert.ok(app.includes(piece), piece);
  // the open crate's footer opens it there, and its rows keep their dataset row as a citation
  const crate = code('js/open-catalogue.js');
  assert.match(crate, /data-about-sources/);
  assert.match(crate, /Hugging Face 数据集第 \$\{row\.toLocaleString\('en-US'\)\} 行/);
  assert.match(crate, /共同署名，不一定是合唱/);
});

test('the Doodle look: one switch on <html>, the wobble filter, paper theme colour; legacy CSS layered, the Doodle layer unlayered and last', () => {
  const html = read('index.html');
  assert.match(html, /<html lang="zh-CN" data-theme="sakura" data-look="doodle">/);
  assert.match(html, /<meta name="theme-color" content="#f7efdf" \/>/);
  assert.match(html, /<filter id="ds-wobble"/);
  assert.match(html, /<title>Music Space · 音乐探索<\/title>/);
  assert.ok(!/fonts\.css/.test(html), 'the font link is added per build, never in the source page');
  const app = read('js/app.js');
  const imports = [...app.matchAll(/^import '([^']+)';$/gm)].map(match => match[1]);
  assert.deepEqual(imports, ['../css/legacy.css', '../css/doodle/index.css']);
  // no other module brings in a stylesheet that would land outside the legacy layer
  for (const file of readdirSync(new URL('js/', root)).filter(name => name.endsWith('.js') && !['app.js', 'space-bridge.js'].includes(name))) {
    assert.ok(!/import\s+'[^']+\.css'/.test(read(`js/${file}`)), `js/${file} imports CSS`);
  }
  const legacy = read('css/legacy.css');
  const layered = [...legacy.matchAll(/^@import '([^']+)' layer\(legacy\);$/gm)].map(match => match[1]);
  const legacyFiles = readdirSync(new URL('css/', root)).filter(name => name.endsWith('.css') && !['legacy.css', 'space-bridge.css'].includes(name)).map(name => `./${name}`);
  assert.deepEqual(layered.filter(path => path.startsWith('./')).sort(), legacyFiles.sort(), 'every legacy stylesheet sits in the layer');
  const doodle = read('css/doodle/index.css').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const shared of ['tokens', 'type', 'kit']) assert.ok(doodle.includes(`@import '../../../event-room/doodle/${shared}.css';`), shared);
  assert.ok(!/fonts\.css|woff2/.test(doodle), 'fonts are linked by the build, never imported (the single-file page would inline them)');
});

test('the Doodle layer takes its colours from the tokens only (no new hex values)', () => {
  const sheets = [...readdirSync(new URL('css/doodle/', root)).map(name => `css/doodle/${name}`), 'css/space-bridge.css'];
  for (const sheet of sheets) {
    const hex = read(sheet).replace(/\/\*[\s\S]*?\*\//g, '').match(/#[0-9a-f]{3,8}\b/gi) || [];
    assert.deepEqual(hex, [], sheet);
  }
});

test('each map build links the event room\'s Doodle fonts at the path that build serves them from', async () => {
  const builds = [['../../vite.static-map.config.js', '../fonts/doodle/'], ['../../vite.map.config.js', '../event-room/fonts/doodle/']];
  for (const [config, dir] of builds) {
    const { default: options } = await import(new URL(config, root));
    const plugin = options.plugins.flat().find(item => item?.name === 'map-doodle-fonts');
    assert.ok(plugin, `${config}: font plugin`);
    assert.equal(plugin.apply, 'build');
    const tags = plugin.transformIndexHtml.handler();
    assert.deepEqual(tags.map(tag => tag.attrs.href), [`${dir}marker-0.woff2`, `${dir}display-0.woff2`, `${dir}fonts.css`], config);
    for (const tag of tags.slice(0, 2)) assert.deepEqual({ rel: tag.attrs.rel, as: tag.attrs.as, crossorigin: tag.attrs.crossorigin }, { rel: 'preload', as: 'font', crossorigin: true }, config);
    assert.equal(tags[2].attrs.rel, 'stylesheet');
  }
  // fonts.css names its files relative to itself, so one link works on /musicSpace/, /musicSpace/preview/ and the Node server
  const fontsDir = new URL('../web/event-room/public/fonts/doodle/', import.meta.url);
  const css = readFileSync(new URL('fonts.css', fontsDir), 'utf8');
  const urls = [...css.matchAll(/url\("([^"]+)"\)/g)].map(match => match[1]);
  assert.ok(urls.length > 0);
  for (const url of urls) {
    assert.match(url, /^\.\/[a-z0-9-]+\.woff2$/, url);
    assert.ok(existsSync(new URL(url, fontsDir)), url);
  }
  for (const slice of ['marker-0.woff2', 'display-0.woff2', 'LICENSES.txt']) assert.ok(existsSync(new URL(slice, fontsDir)), slice);
});

test('downloads carry the product name, units sit outside the digits face, and kept duets show their 「来源」 in sight', async () => {
  const { challengeCardName, discoveryCardName } = await import('../web/original-map/js/share-card.js');
  assert.equal(challengeCardName({ start: 'real-jay', target: 'real-jj' }), 'music-space-map-xunsheng-jay-jj.png');
  assert.match(discoveryCardName({ updated: Date.UTC(2026, 9, 8, 10) }), /^music-space-map-discovery-2026-10-0\d\.png$/);
  assert.ok(code('js/app.js').includes("link.download = 'music-space-map-exploration-backup.json';"));
  for (const file of UI_FILES) assert.ok(!/['`"]music-map-(?!return)/.test(code(file)), `${file}: an old music-map- name`);
  // Doodle Digits and Doodle Logo carry no CJK: 位 and 次 are set in the marker face beside the number
  const map = code('js/map.js');
  assert.ok(map.includes('<small><b class="map-num">${people.length}</b> 位</small>'), '作品署名 N 位');
  assert.ok(map.includes('<dd>${usedHints(session)}<small>次</small></dd>'), '提示 N 次');
  const papers = read('css/doodle/papers.css');
  assert.match(papers, /\.map-credits>summary small[^{]*\{font-family:var\(--ds-font-ui\)/);
  assert.match(papers, /\.map-setlist__stats dd small\{[^}]*font-family:var\(--ds-font-ui\)/);
  // 留下的歌: a kept duet's 来源 sits beside 去 QQ 音乐听, not inside the folded row (which shows a chevron)
  assert.ok(code('js/open-catalogue.js').includes('listen: song?.dataset === \'real\' ? listenHTML(song, icon) + sourcesHTML(song) : \'\''));
  assert.match(read('css/doodle/records.css'), /\.open-catalogue__record>details>summary::after\{content:'▾'/);
  // the ended-roam toast names the resume button as it reads on screen
  assert.ok(map.includes("document.querySelector('.map-roam-bar__resume')?.innerText"));
});

test('「数据来源」 lands under the sticky title of 关于, and the 目录 paper clears a toast', () => {
  const app = code('js/app.js');
  assert.match(app, /section\.scrollIntoView\(\{ block: 'start' \}\);\s*const covered = dialog\.querySelector\('\.about-top'\)\.getBoundingClientRect\(\)\.bottom \+ 10 - section\.getBoundingClientRect\(\)\.top;\s*if \(covered > 0\) dialog\.scrollTop -= covered;/);
  assert.match(app, /document\.addEventListener\('toggle', event => \{\s*if \(!event\.target\.open \|\| !event\.target\.matches\?\.\('\.map-shop-menu'\)\) return;/);
});

test('− 全图 + on the scene is one pill no wider than 0.16\'s, so the dock and the hand (200px clear each side) never cover it', () => {
  const shop = read('css/doodle/shop.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const scene = "html[data-theme='sakura'] body[data-view='explore']:not(.spatial-fallback) .map-stage-top .map-network-tools";
  const rule = selector => shop.match(new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\{([^}]*)\\}'))?.[1] || '';
  assert.match(rule(scene), /gap:0;padding:0;/);
  assert.match(rule(`${scene}>.icon-button`), /width:44px/);
  // 44 + 全图 (two marker glyphs at 16px, 2 × 10px, two 2px rules) + 44 + two 2px borders: about 144px (the browser walks check it)
  assert.match(rule(`${scene}>.button`), /padding:0 10px;\s*border-inline:var\(--ds-line-thin\) dashed/);
});
