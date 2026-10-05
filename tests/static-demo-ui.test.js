// What the static (GitHub Pages) build shows that the server product does not: copy, entry panel, About, the example route and the
// profile.demo assembly (web/static-runtime/showcase/{copy,entry-panel,about-panel,tour,demo-hooks}.js and demo.css).
// String markup and fake controllers only: this is NOT a browser, layout, screen-reader or touch test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { removeTempAfterTests } from './helpers/temp-directory.js';
import { createAvatarApi } from '../server/avatar-api.js';
import { createEventApi } from '../server/event-api.js';
import { createEventController } from '../web/event-client/controller.js';
import { copy, createCopy, COPY_KEYS, CAST_LABEL, RESET_CONFIRM, MEMORY_ONLY_NOTE, READ_ONLY_NOTE, DEMO_TIME_COPY, TOUR_SAMPLES, TOUR_MORE } from '../web/static-runtime/showcase/copy.js';
import { entryMarkup, enter } from '../web/static-runtime/showcase/entry-panel.js';
import { aboutMarkup, roomInviteMarkup, ABOUT_SECTIONS } from '../web/static-runtime/showcase/about-panel.js';
import { createTour, tourProgress, tourMarkup, TOUR_STEPS, TOUR_STORAGE_KEY } from '../web/static-runtime/showcase/tour.js';
import { createDemoProfile, randomAvatar, randomName } from '../web/static-runtime/showcase/demo-hooks.js';
import { renderAvatarSvg } from '../web/illustrated-avatar/index.js';
import { TEMPLATES, SKINS, safeAvatar, escape as esc } from '../web/avatar/model.js';
import { SAME_MOMENT_MS } from '../web/js/moment.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const showcase = path.join(root, 'web/static-runtime/showcase');
const MODULES = ['copy', 'entry-panel', 'about-panel', 'tour', 'demo-hooks'];
const sourceOf = name => readFileSync(path.join(showcase, `${name}.js`), 'utf8');
const css = readFileSync(path.join(root, 'web/static-runtime/demo.css'), 'utf8');

const WITH_AI = '同一晚，你拍了舞台，TA 拍了人海。AI 在本机给你一个视角建议，规则帮你找到同一刻的另一面，双方同意才交换。';
const WITHOUT_AI = '同一晚，你拍了舞台，TA 拍了人海。规则帮你找到同一刻的另一面，双方同意才交换。';

// Phrases the static build must never show: server wording that is false here (the design's list and the five the build transform
// rewrites elsewhere), plus claims about real users or a launch. A character disclaimer such as 「不是真人」 is not on the list.
const BANNED = ['房间服务已连接', '上传至', '服务器已确认', '服务已收到', '邀请同场朋友', '真实房间',
  '服务已确认', '结果按服务器当前票数决定', '停止等待不会撤销服务器操作', 'AI 认出', '已上线', '正式上线', '真实用户', '真实观众'];

const deferred = () => { let resolve; let reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
const textOf = html => html.replace(/<[^>]*>/g, '');
const count = (html, pattern) => (html.match(pattern) || []).length;

const WORLD = { people: {
  yao: { id: 'u-yao', token: 'SECRET-TOKEN-yao', npc: { key: 'yao', name: '阿遥·示例' } },
  man: { id: 'u-man', token: 'SECRET-TOKEN-man', npc: { key: 'man', name: '小满·示例' } },
  bei: { id: 'u-bei', token: 'SECRET-TOKEN-bei', npc: { key: 'bei', name: '北屿·示例' } },
  lin: { id: 'u-lin', token: 'SECRET-TOKEN-lin', npc: { key: 'lin', name: '林间·示例' } },
}, room: { id: 'room-1', code: 'ABCDEFGHIJKL' } };
const SAMPLES = [{ id: 'sample-crowd', label: '人海 · 示例照片', note: 'n1', thumbUrl: './demo/sample-crowd.jpg' }, { id: 'sample-stage', label: '舞台 · 示例照片', note: 'n2', thumbUrl: './demo/sample-stage.jpg' }];
const BUILD = { version: '0.22.0-rc.1', commit: 'abc1234', builtAt: '2026-10-06T02:15:30.123Z' };

/** The client calls enter() uses, recorded in order; each can be made to fail. */
function fakeController({ status = 'missing', failAt = null, error = new Error('boom') } = {}) {
  const calls = [];
  const state = { identity: { status } };
  const step = (name, result) => async (...args) => {
    calls.push([name, ...args]);
    if (failAt === name) throw error;
    return result;
  };
  return {
    calls,
    getState: () => state,
    establishIdentity: async (...args) => { calls.push(['establishIdentity', ...args]); if (failAt === 'establishIdentity') throw error; state.identity.status = 'ready'; return { ok: true }; },
    previewRoom: step('previewRoom', { preview: true }),
    joinRoom: step('joinRoom', { joined: true, code: 'ABCDEFGHIJKL' }),
  };
}

// ---------------------------------------------------------------------------------------------------------------------------
// copy.js
// ---------------------------------------------------------------------------------------------------------------------------

test('copy has exactly the keys of design 10.3 and the specified words', () => {
  const off = createCopy({ aiAvailable: () => false });
  assert.deepEqual(Object.keys(copy), [...COPY_KEYS]);
  assert.deepEqual(Object.keys(off), [...COPY_KEYS]);
  assert.deepEqual({ ...off }, {
    statusReady: '示例现场 · 在本页运行',
    statusPreparing: '正在布置示例现场…',
    reconnectLabel: '重新连接示例现场',
    reconnectToast: '示例现场已就绪',
    presenceTitleLobby: '同一刻，另一面。',
    presenceCopyLobby: WITHOUT_AI,
    presenceTitleAlone: '先留下你的这一晚。',
    presenceCopyAlone: '放一张照片，看看你拍到的是哪一面。',
    presenceTitleRoom: '同一晚，各自的视角。',
    presenceCopyRoom: '先放一张你的照片，看看你拍到的是哪一面。',
    joinLabelLobby: '进入示例现场',
    joinLabelRoom: '本场与示例说明',
    trackNote: '原创示例声景 · 不代表真实演出',
    evidenceButton: '示例站 · 数据只存在这个浏览器 · 关于这个示例',
    nonHttpToast: '请通过网址打开；离线 HTML 无法运行示例现场',
    keepRoomInUrl: true,
    pollMs: 2000,
    exchangePollMs: 2000,
  });
  assert.equal(typeof off.keepRoomInUrl, 'boolean');
  assert.equal(typeof off.pollMs, 'number');
  const header = sourceOf('copy').slice(0, sourceOf('copy').indexOf('*/'));
  for (const key of COPY_KEYS) assert.ok(header.includes(key), `the header comment of copy.js lists ${key}`);
});

test('presenceCopyLobby is a getter that asks aiAvailable() each time it is read', () => {
  let available = true;
  let asked = 0;
  const live = createCopy({ aiAvailable: () => { asked += 1; return available; } });
  assert.equal(typeof Object.getOwnPropertyDescriptor(live, 'presenceCopyLobby').get, 'function');
  assert.equal(asked, 0, 'nothing is asked until the text is read');
  assert.equal(live.presenceCopyLobby, WITH_AI);
  available = false;
  assert.equal(live.presenceCopyLobby, WITHOUT_AI);
  available = true;
  assert.equal(live.presenceCopyLobby, WITH_AI);
  assert.equal(asked, 3);
  assert.equal(WITHOUT_AI, WITH_AI.replace('AI 在本机给你一个视角建议，', ''), 'the same sentence minus the AI sentence');
  assert.ok(!WITHOUT_AI.includes('AI'));
  for (const [key, value] of Object.entries({ ...live, presenceCopyLobby: WITHOUT_AI })) if (typeof value === 'string') assert.ok(!/AI/.test(value), `${key} carries no AI words`);
});

test('the exported copy object reads the real classifier: no model here, then a stand-in page and engine', () => {
  const run = prelude => execFileSync(process.execPath, ['--input-type=module', '-e',
    `${prelude}\nconst { copy } = await import(${JSON.stringify(pathToFileURL(path.join(showcase, 'copy.js')).href)});\nconsole.log(copy.presenceCopyLobby);`], { encoding: 'utf8' }).trim();
  assert.equal(run(''), WITHOUT_AI, 'plain Node has no page: aiAvailable() is false');
  assert.equal(run("globalThis.document = { baseURI: 'https://example.test/space/' }; globalThis.location = { protocol: 'https:' }; globalThis.createImageBitmap = () => {};"), WITH_AI);
  assert.equal(run("globalThis.document = { baseURI: 'file:///space/' }; globalThis.location = { protocol: 'file:' }; globalThis.createImageBitmap = () => {};"), WITHOUT_AI, 'a file: page cannot fetch the model');
});

test('the shared strings say what they are for', () => {
  assert.equal(CAST_LABEL, '示例角色 · 自动回复');
  assert.match(RESET_CONFIRM, /清除/);
  assert.match(RESET_CONFIRM, /确定/);
  assert.equal(MEMORY_ONLY_NOTE, '示例数据只保存在本页，刷新会重置');
  assert.equal(READ_ONLY_NOTE, '示例已在另一个标签页打开，这里不能操作');
  assert.deepEqual({ ...DEMO_TIME_COPY }, { label: '演示用：把拍摄时间设成示例现场的 21:47', note: '你填写的时间 · 演示用' });
  assert.deepEqual(TOUR_SAMPLES.map(sample => [sample.id, sample.label]), [['sample-crowd', '人海 · 示例照片'], ['sample-stage', '舞台 · 示例照片']]);
  assert.deepEqual([...TOUR_MORE], ['我的空间', '音乐社群', '专辑世界杯', '一起玩', '音乐探索']);
});

// ---------------------------------------------------------------------------------------------------------------------------
// the banned-phrase audit: every word the static build can say, in every state
// ---------------------------------------------------------------------------------------------------------------------------

function everything() {
  const out = new Map();
  const add = (label, text) => out.set(label, String(text));
  for (const on of [true, false]) for (const [key, value] of Object.entries({ ...createCopy({ aiAvailable: () => on }) })) add(`copy.${key} (model ${on ? 'on' : 'off'})`, value);
  for (const [name, value] of Object.entries({ CAST_LABEL, RESET_CONFIRM, MEMORY_ONLY_NOTE, READ_ONLY_NOTE, ...DEMO_TIME_COPY })) add(`copy.js ${name}`, value);
  add('copy.js TOUR_MORE', TOUR_MORE.join('、'));
  add('copy.js TOUR_SAMPLES', TOUR_SAMPLES.map(sample => sample.label).join(' '));
  const avatar = randomAvatar(() => 0.5);
  for (const known of [null, { name: '访客1', avatar }]) for (const preparing of [false, true]) for (const castNames of [[], ['阿遥·示例', '小满·示例']]) for (const participation of ['open', 'quiet']) {
    add(`entry known=${Boolean(known)} preparing=${preparing} cast=${castNames.length} ${participation}`,
      entryMarkup({ state: { identity: known ? { status: 'ready', user: known } : { status: 'missing' } }, esc, avatarSvg: renderAvatarSvg, defaults: { name: '访客1234', avatar, preparing, castNames, participation } }));
  }
  for (const persistent of [true, false]) for (const readOnly of [false, true]) for (const ai of ['on', 'unsupported', 'page', 'failed']) for (const channel of ['', 'pages', 'preview']) {
    add(`about persistent=${persistent} readOnly=${readOnly} ai=${ai} channel=${channel}`, aboutMarkup({ build: BUILD, castNames: ['阿遥·示例', '小满·示例', '北屿·示例', '林间·示例'], persistent, channel, readOnly, ai }));
  }
  add('about without anything', aboutMarkup({ ai: 'on' }));
  add('roomInvite showcase', roomInviteMarkup({ isShowcase: true }));
  add('roomInvite own room', roomInviteMarkup({ isShowcase: false }));
  const flags = [false, true];
  for (const photo of flags) for (const other of flags) for (const exchange of flags) for (const people of flags) for (const collapsed of flags) {
    const progress = tourProgress({ stage: 'room', ownPhotos: photo ? 1 : 0, hasPairing: other, exchanges: { total: exchange ? 1 : 0 }, friends: people ? 1 : 0, panel: null }, { seenWall: other });
    add(`tour ${[photo, other, exchange, people, collapsed]}`, tourMarkup({ progress, collapsed, esc }));
  }
  return out;
}

test('no banned phrase appears in any copy string or in anything the demo modules render', () => {
  const corpus = everything();
  assert.ok(corpus.size > 100, 'the audit actually covers the states');
  for (const [label, text] of corpus) for (const phrase of BANNED) assert.ok(!text.includes(phrase), `${label} contains the banned phrase 「${phrase}」`);
});

test('no banned phrase appears in the source of the demo modules', () => {
  for (const name of MODULES) {
    const source = sourceOf(name);
    for (const phrase of BANNED) assert.ok(!source.includes(phrase), `${name}.js contains the banned phrase 「${phrase}」`);
  }
  for (const phrase of BANNED) assert.ok(!css.includes(phrase), `demo.css contains the banned phrase 「${phrase}」`);
});

test('AI words appear only where the model may be spoken of', () => {
  for (const [label, text] of everything()) {
    if (/^(entry|roomInvite|tour|copy\.js)/.test(label)) assert.ok(!/AI/.test(text), `${label} must not mention the AI`);
    if (/^copy\./.test(label) && !/presenceCopyLobby \(model on\)/.test(label)) assert.ok(!/AI/.test(text), `${label} must not mention the AI`);
  }
  assert.match(aboutMarkup({ ai: 'on' }), /AI/, 'the About panel always explains the model');
});

// ---------------------------------------------------------------------------------------------------------------------------
// entry-panel.js
// ---------------------------------------------------------------------------------------------------------------------------

test('entry markup: one required consent checkbox, participation open by default, the words of the design', () => {
  const avatar = randomAvatar(() => 0.3);
  const seen = [];
  const html = entryMarkup({ state: { identity: { status: 'missing' } }, esc, avatarSvg: (...args) => { seen.push(args); return '<svg data-preview="1"></svg>'; }, defaults: { name: '访客2468', avatar, preparing: false } });
  assert.match(html, /^<form data-form="demo-entry"/);
  assert.equal(count(html, /type="checkbox"/g), 1);
  assert.equal(count(html, /<input\b[^>]*\brequired\b/g), 2, 'the nickname and the consent are the only required inputs');
  const consent = html.match(/<input name="consent" type="checkbox" required>/);
  assert.ok(consent, 'the consent checkbox is named consent, is a checkbox and is required');
  assert.match(html, /我愿意向本场成员（示例角色）展示我的昵称和小人。数据只存在这个浏览器里。/);
  assert.match(html, /<input type="radio" name="participation" value="open" checked>/);
  assert.doesNotMatch(html, /value="quiet" checked/);
  assert.match(html, /value="quiet"/);
  assert.match(html, /愿意打招呼<small>别人可以招手；成为朋友仍需我明确接受。<\/small>/);
  assert.match(html, /安静参与<small>照样保存和分享照片，不接收新招呼。<\/small>/);
  assert.match(html, /<small class="eyebrow">示例现场 · 回声现场（虚构）<\/small><h2>带上小人，进入示例现场<\/h2>/);
  assert.match(html, /<input name="name" maxlength="18" value="访客2468" autocomplete="nickname" required>/);
  assert.match(html, /<button type="button" class="quiet" data-open="wardrobe">现在换个造型 ↗<\/button>/);
  assert.match(html, /<button class="primary" type="submit">进入示例现场<\/button>/);
  assert.match(html, /<button type="button" class="quiet" data-open="about">关于这个示例<\/button>/);
  assert.match(html, /<details class="demo-entry-more"><summary>自己开个房<\/summary>[\s\S]*data-open="create"/);
  assert.match(html, /没有服务器，也没有账号/);
  assert.match(html, /<div aria-hidden="true"><svg data-preview="1"><\/svg><\/div>/);
  assert.deepEqual(seen, [[avatar, { view: 'quarter', width: 92, height: 192 }]]);
  const paragraph = textOf(html.match(/<p>(同场的[\s\S]*?)<\/p>/)[1]);
  assert.match(paragraph, /虚构/);
  assert.match(paragraph, /自动回复/);
  assert.match(paragraph, /不是真人/);
  assert.match(paragraph, /先放一张你的照片/);
});

test('entry markup: quiet default, preparing disables only the submit button, names are listed and escaped', () => {
  const quiet = entryMarkup({ esc, avatarSvg: () => '', defaults: { name: 'a', participation: 'quiet' } });
  assert.match(quiet, /value="quiet" checked/);
  assert.doesNotMatch(quiet, /value="open" checked/);
  assert.equal(count(quiet, /type="radio"/g), 2);
  const preparing = entryMarkup({ esc, avatarSvg: () => '', defaults: { name: 'a', preparing: true } });
  assert.match(preparing, /<button class="primary" type="submit" disabled>进入示例现场<\/button>/);
  assert.match(preparing, /role="status">正在布置示例现场…<\/p>/);
  assert.equal(count(preparing, /\bdisabled\b/g), 1);
  const ready = entryMarkup({ esc, avatarSvg: () => '', defaults: { name: 'a', preparing: false } });
  assert.doesNotMatch(ready, /\bdisabled\b/);
  assert.match(ready, /role="status"><\/p>/, 'the status line keeps its place so nothing moves when it fills');
  const hostile = entryMarkup({ esc, avatarSvg: () => '', defaults: { name: '"><script>alert(1)</script>', castNames: ['<img src=x onerror=alert(1)>', '小满·示例'] } });
  assert.doesNotMatch(hostile, /<script|<img/);
  assert.match(hostile, /value="&quot;&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt;"/);
  assert.match(hostile, /同场的&lt;img src=x onerror=alert\(1\)&gt;、小满·示例都是虚构的/);
  assert.match(entryMarkup({ esc, avatarSvg: () => '', defaults: { name: 'a' } }), /同场的几位示例角色都是虚构的/);
  assert.doesNotThrow(() => entryMarkup());
});

test('entry markup shows the identity this browser already holds and does not offer to replace it', () => {
  const user = { name: '阿晴', avatar: randomAvatar(() => 0.9) };
  const seen = [];
  const html = entryMarkup({ state: { identity: { status: 'ready', user } }, esc, avatarSvg: avatar => { seen.push(avatar); return ''; }, defaults: { name: '访客1', avatar: randomAvatar(() => 0.1) } });
  assert.match(html, /<input name="name" maxlength="18" value="阿晴" autocomplete="nickname" required readonly>/);
  assert.deepEqual(seen, [user.avatar]);
  assert.match(html, /已经有你的小人/);
});

test('enter(): nothing is called without consent === true', async () => {
  for (const consent of [false, undefined, null, 'on', 1, 'true', 0]) {
    const controller = fakeController();
    let awaited = false;
    const ready = { then(resolve) { awaited = true; resolve(); } };
    await assert.rejects(() => enter({ name: 'a', avatar: {}, participation: 'open', consent }, controller, { ready, roomCode: 'ABCDEFGHIJKL' }), error => error.code === 'JOIN_CONSENT_REQUIRED');
    assert.deepEqual(controller.calls, [], `consent ${String(consent)}`);
    assert.equal(awaited, false, 'it does not even wait for the room');
  }
  await assert.rejects(() => enter(undefined, fakeController(), {}), error => error.code === 'JOIN_CONSENT_REQUIRED');
});

test('enter(): waits for the room, then identity, preview and join in that order with these arguments', async () => {
  const controller = fakeController();
  const avatar = randomAvatar(() => 0.2);
  const ready = deferred();
  const running = enter({ name: '  阿晴  ', avatar, participation: 'quiet', consent: true }, controller, { ready: ready.promise, roomCode: () => 'ABCDEFGHIJKL' });
  await tick();
  assert.deepEqual(controller.calls, [], 'no API call before the in-page room is ready');
  ready.resolve();
  const result = await running;
  assert.deepEqual(controller.calls, [
    ['establishIdentity', { name: '阿晴', avatar }],
    ['previewRoom', 'ABCDEFGHIJKL'],
    ['joinRoom', 'ABCDEFGHIJKL', { joinConsent: true, participation: 'quiet' }],
  ]);
  assert.deepEqual(result, { joined: true, code: 'ABCDEFGHIJKL' }, 'the join result is returned');
});

test('enter(): an identity that exists is kept; participation is open unless the visitor chose quiet', async () => {
  const controller = fakeController({ status: 'ready' });
  await enter({ name: 'x', avatar: {}, participation: 'whatever', consent: true }, controller, { ready: Promise.resolve(), roomCode: 'ABCDEFGHIJKL' });
  assert.deepEqual(controller.calls.map(call => call[0]), ['previewRoom', 'joinRoom']);
  assert.deepEqual(controller.calls[1], ['joinRoom', 'ABCDEFGHIJKL', { joinConsent: true, participation: 'open' }]);
  const other = fakeController({ status: 'unverified' });
  await enter({ name: 'x', avatar: {}, participation: undefined, consent: true }, other, { roomCode: 'ABCDEFGHIJKL' });
  assert.equal(other.calls[0][0], 'establishIdentity', 'anything but ready is left to the client, which refuses it in its own words');
});

test('enter(): the first error is thrown unchanged and nothing is retried or continued', async () => {
  for (const failAt of ['establishIdentity', 'previewRoom', 'joinRoom']) {
    const error = new Error(`fail at ${failAt}`);
    const controller = fakeController({ failAt, error });
    await assert.rejects(() => enter({ name: 'a', avatar: {}, participation: 'open', consent: true }, controller, { ready: Promise.resolve(), roomCode: 'ABCDEFGHIJKL' }), caught => caught === error);
    const names = controller.calls.map(call => call[0]);
    assert.equal(names.filter(name => name === failAt).length, 1, `${failAt} is called once`);
    assert.equal(names.at(-1), failAt, 'nothing runs after the failing call');
  }
  const boom = new Error('safe mode');
  const controller = fakeController();
  await assert.rejects(() => enter({ name: 'a', avatar: {}, consent: true }, controller, { ready: Promise.reject(boom), roomCode: 'ABCDEFGHIJKL' }), caught => caught === boom);
  assert.deepEqual(controller.calls, []);
  await assert.rejects(() => enter({ name: 'a', avatar: {}, consent: true }, fakeController(), { ready: Promise.resolve(), roomCode: () => null }), error => error.code === 'SHOWCASE_NOT_READY');
});

// ---------------------------------------------------------------------------------------------------------------------------
// enter() against the real client and the real room API (Node server on 127.0.0.1, the same code the in-page worker runs)
// ---------------------------------------------------------------------------------------------------------------------------

async function realRoom(t) {
  const dir = await mkdtemp(path.join(tmpdir(), 'static-demo-ui-'));
  const avatar = createAvatarApi({ dataDir: dir, rateLimits: false });
  const event = createEventApi({ dataDir: dir, rateLimits: false });
  const server = createServer(async (req, res) => { if (!await event(req, res) && !await avatar(req, res)) { res.writeHead(404); res.end(); } });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const controllers = [];
  t.after(async () => { controllers.forEach(controller => controller.dispose()); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); avatar.close(); event.close(); removeTempAfterTests(dir); });
  const storage = () => { const items = new Map(); return { get length() { return items.size; }, key: index => [...items.keys()][index] ?? null, getItem: key => items.get(key) ?? null, setItem: (key, value) => items.set(key, String(value)), removeItem: key => items.delete(key) }; };
  /** A client like the page's, recording the requests it makes as 'METHOD /path'. */
  const client = () => {
    const calls = [];
    const controller = createEventController({ storage: storage(), baseUrl, timeoutMs: 2000, fetch: (url, init) => { calls.push(`${init?.method || 'GET'} ${new URL(url).pathname}`); return fetch(url, init); } });
    controllers.push(controller);
    return { controller, calls };
  };
  const host = client().controller;
  await host.connect();
  await host.establishIdentity({ name: '阿遥·示例', avatar: randomAvatar(() => 0.2) });
  const room = (await host.createRoom({ title: 'Synthetic show', venue: 'Synthetic venue', songId: 'late-train', joinConsent: true, participation: 'open' })).room;
  return { room, client, host };
}

test('enter() through the real client: identity, preview, join, with the participation the visitor chose', async t => {
  const { room, client } = await realRoom(t);
  const demo = createDemoProfile({ getWorld: () => ({ room: { code: room.code } }), ready: Promise.resolve() });
  const { controller, calls } = client();
  await controller.connect();
  assert.equal(controller.getState().identity.status, 'missing');
  const joined = await demo.enter({ name: ' 访客1234 ', avatar: demo.defaultAvatar, participation: 'quiet', consent: true }, controller);
  const state = controller.getState();
  assert.equal(state.identity.status, 'ready');
  assert.equal(state.identity.user.name, '访客1234');
  assert.deepEqual(state.identity.user.avatar, demo.defaultAvatar, 'the random look is a valid avatar for the worker as it stands');
  assert.equal(state.room.joined, true);
  assert.deepEqual(state.members.map(member => [member.name, member.participation]), [['阿遥·示例', 'open'], ['访客1234', 'quiet']]);
  assert.equal(joined.room.code, room.code, 'the join result is returned');
  assert.deepEqual(calls.filter(call => !call.startsWith('GET /api/event/rooms/')), ['GET /api/event/health', 'POST /api/avatar/session', `GET /api/event/preview/${room.code}`, `POST /api/event/rooms/${room.code}/join`]);
});

test('enter() through the real client: a second walk-in keeps the identity, and a failure is the client\'s own error with no second try', async t => {
  const { room, client } = await realRoom(t);
  const demo = createDemoProfile({ getWorld: () => ({ room: { code: room.code } }), ready: Promise.resolve() });
  const { controller, calls } = client();
  await controller.connect();
  await demo.enter({ name: '访客1', avatar: demo.defaultAvatar, participation: 'open', consent: true }, controller);
  const id = controller.getState().identity.user.id;
  await controller.leaveRoom(room.id);
  const mark = calls.length;
  await demo.enter({ name: '另一个名字', avatar: demo.defaultAvatar, participation: 'open', consent: true }, controller);
  assert.equal(controller.getState().identity.user.id, id, 'no second identity');
  assert.equal(controller.getState().identity.user.name, '访客1', 'the name typed on the second form is not applied to the one that exists');
  assert.equal(controller.getState().room.joined, true);
  assert.ok(!calls.slice(mark).some(call => call.includes('/api/avatar/session')), 'establishIdentity is not called again');

  const missing = createDemoProfile({ getWorld: () => ({ room: { code: 'AAAAAAAAAAAA' } }), ready: Promise.resolve() });
  const other = client();
  await other.controller.connect();
  await assert.rejects(() => missing.enter({ name: 'x', avatar: demo.defaultAvatar, participation: 'open', consent: true }, other.controller), error => error.name === 'EventClientError' && error.status === 404 && error.code === 'ROOM_NOT_FOUND');
  assert.equal(other.calls.filter(call => call.startsWith('GET /api/event/preview/')).length, 1, 'the failed preview is not repeated');
  assert.equal(other.controller.getState().identity.status, 'ready', 'the identity made before the failure is kept, so the visitor\'s next try does not make another');
  await assert.rejects(() => missing.enter({ name: 'x', avatar: demo.defaultAvatar, participation: 'open', consent: true }, other.controller), error => error.status === 404);
  assert.equal(other.calls.filter(call => call.includes('/api/avatar/session')).length, 1);
});

test('enter() through the real client: without consent not one request is made', async t => {
  const { room, client } = await realRoom(t);
  const demo = createDemoProfile({ getWorld: () => ({ room: { code: room.code } }), ready: Promise.resolve() });
  const { controller, calls } = client();
  await assert.rejects(() => demo.enter({ name: 'x', avatar: demo.defaultAvatar, participation: 'open', consent: false }, controller), error => error.code === 'JOIN_CONSENT_REQUIRED');
  assert.deepEqual(calls, []);
  assert.equal(controller.getState().identity.status, 'missing');
});

// ---------------------------------------------------------------------------------------------------------------------------
// about-panel.js
// ---------------------------------------------------------------------------------------------------------------------------

test('About has every section, in order, with the facts the design lists', () => {
  const html = aboutMarkup({ build: BUILD, castNames: WORLD.people ? Object.values(WORLD.people).map(person => person.npc.name) : [], persistent: true, channel: 'pages', readOnly: false, ai: 'on' });
  const headings = [...html.matchAll(/<section class="demo-about-section" data-about="([a-z]+)"><h3>([^<]+)<\/h3>/g)].map(match => [match[1], match[2]]);
  assert.deepEqual(headings, [...ABOUT_SECTIONS.map(([id, title]) => [id, title])]);
  assert.deepEqual(headings.map(item => item[1]), ['这是什么', '同场的人', '照片', 'AI', '规则', '数据', '版本']);
  const section = id => textOf(html.match(new RegExp(`data-about="${id}">([\\s\\S]*?)</section>`))[1]);
  assert.match(section('what'), /SQLite 被编译成 WebAssembly/);
  assert.match(section('what'), /没有服务器，没有账号，什么都不会上传/);
  assert.match(section('cast'), /阿遥·示例、小满·示例、北屿·示例、林间·示例/);
  assert.match(section('cast'), /4 位角色/);
  assert.match(section('cast'), /自动回复，不是真人/);
  assert.match(section('cast'), /招呼要双方都愿意/);
  assert.match(section('cast'), /交换要照片的主人同意/);
  assert.match(section('cast'), /选了安静参与的人不能被招呼/);
  assert.match(section('cast'), /他们的回应是固定的规则，不是 AI：比如你提议交换的视角和 TA 自己的一样，TA 会婉拒/);
  assert.match(section('cast'), /不会学习/);
  assert.match(section('cast'), /不会记录或发送任何关于你的信息/);
  assert.match(section('photos'), /2026 年 9 月 26 日生成的虚构演唱会 AI 图像的裁切/);
  assert.match(section('photos'), /你放的照片只留在这个浏览器里，不会上传/);
  for (const fact of ['TinyCLIP-ViT-8M/16', 'MIT', 'int8', '8.8 MB', 'onnxruntime-web', 'WASM', '舞台', '人海', '身边', '细节', '「不确定」', '约 10 MB', '后台', '省流量', '公开的演唱会照片', '不能当作产品的准确率']) assert.ok(section('ai').includes(fact), `the AI section says ${fact}`);
  assert.match(section('rules'), /相差不超过 3 分钟/);
  assert.match(section('rules'), /EXIF/);
  assert.match(section('rules'), /自己填写的时间/);
  assert.match(section('rules'), /规则计算，不是 AI/);
  assert.match(section('data'), /IndexedDB/);
  assert.match(section('data'), /重置示例/);
  assert.match(section('data'), /换一台设备也看不到/);
  assert.match(section('data'), /完整的房间服务/);
  assert.match(section('data'), /第二个标签页.*只读/);
  assert.match(section('version'), /版本 0\.22\.0-rc\.1 · 提交 abc1234 · 构建于 2026-10-06 02:15 UTC · 渠道 pages/);
  assert.match(section('version'), /早期原型/);
  assert.doesNotMatch(html, /href=/, 'About links nowhere (the early prototype is named, never linked)');
  assert.doesNotMatch(html, /classic/);
  assert.equal(count(html, /早期原型/g), 1);
  assert.equal(count(html, /0\.16/g), 1);
});

test('About: the capture-time window in the text is the rule the product uses', () => {
  assert.equal(SAME_MOMENT_MS, 3 * 60_000);
  assert.match(textOf(aboutMarkup({ ai: 'on' })), /拍摄时间相差不超过 3 分钟/);
});

test('About escapes the build stamp, the channel and the names', () => {
  const html = aboutMarkup({ build: { version: '<b>1</b>', commit: '"><img src=x onerror=alert(1)>', builtAt: '<script>alert(2)</script>' }, castNames: ['<i>阿遥</i>'], channel: '<svg onload=alert(3)>', ai: 'on' });
  assert.doesNotMatch(html, /<script|<img|<svg|<b>|<i>/);
  for (const escaped of ['&lt;b&gt;1&lt;/b&gt;', '&quot;&gt;&lt;img src=x onerror=alert(1)&gt;', '&lt;script&gt;alert(2)&lt;/script&gt;', '&lt;i&gt;阿遥&lt;/i&gt;', '&lt;svg onload=alert(3)&gt;']) assert.ok(html.includes(escaped), escaped);
  assert.doesNotThrow(() => aboutMarkup({ ai: 'on' }));
  assert.match(aboutMarkup({ ai: 'on' }), /这次构建没有留下版本信息/);
  assert.match(aboutMarkup({ castNames: [], ai: 'on' }), /同场的几位角色都是虚构的/);
  assert.match(aboutMarkup({ build: { version: '1', builtAt: '2026-10-06' }, ai: 'on' }), /构建于 <code>2026-10-06<\/code>/);
});

test('About: the preview label, the memory-only warning, the other-tab note and the reset button', () => {
  const plain = aboutMarkup({ build: BUILD, channel: 'pages', ai: 'on' });
  assert.doesNotMatch(plain, /预览版/);
  assert.doesNotMatch(plain, /demo-about-warn/);
  assert.match(aboutMarkup({ build: BUILD, channel: 'preview', ai: 'on' }), /<strong class="demo-about-channel">预览版<\/strong>：发布前的测试副本，不是最终版本/);
  const memory = aboutMarkup({ persistent: false, ai: 'on' });
  assert.match(memory, /<p class="demo-about-warn" role="note">这个浏览器没有让这里保存数据：示例数据只保存在本页，刷新会重置。<\/p>/);
  const readOnly = aboutMarkup({ readOnly: true, ai: 'on' });
  assert.match(readOnly, /<p class="demo-about-warn" role="note">这个标签页是只读的：示例已在另一个标签页打开，这里不能操作。/);
  assert.match(readOnly, /data-demo-reset[^>]* disabled>重置示例<\/button>/, 'a read-only tab cannot wipe the data the other tab is using');
  const open = aboutMarkup({ ai: 'on' });
  assert.match(open, /<button type="button" class="quiet demo-reset" data-demo-reset data-confirm="[^"]+">重置示例<\/button>/);
  assert.doesNotMatch(open, /data-demo-reset[^>]* disabled/);
  assert.ok(open.includes(`data-confirm="${esc(RESET_CONFIRM)}"`), 'the confirm sentence travels with the button');
  assert.equal(count(open, /data-demo-reset/g), 1);
});

test('About names why the model is absent in the product\'s own sentence, and only then', async () => {
  const { AI_OFF_LINES } = await import('../web/js/photo-insight.js');
  assert.doesNotMatch(aboutMarkup({ ai: 'on' }), /用不了本机 AI|没能载入/);
  for (const state of ['unsupported', 'page', 'failed']) assert.ok(aboutMarkup({ ai: state }).includes(`<p class="fine">${AI_OFF_LINES[state]}</p>`), state);
  assert.ok(aboutMarkup({ ai: 'nonsense' }).includes(AI_OFF_LINES.unsupported));
  assert.ok(aboutMarkup().includes(AI_OFF_LINES.unsupported), 'by default it asks the real classifier, which has no page in Node');
});

test('roomInviteMarkup has no code, no QR, no link and nothing to copy', () => {
  for (const isShowcase of [true, false]) {
    const html = roomInviteMarkup({ room: { code: 'ABCDEFGHIJKL', id: 'room-1' }, isShowcase });
    assert.doesNotMatch(html, /ABCDEFGHIJKL/);
    assert.doesNotMatch(html, /qr|invite|copy|href|nfc/i);
    assert.doesNotMatch(html, /邀请码|二维码/);
    assert.match(html, /别的设备.*进不来/);
    assert.match(html, /data-open="about"/);
    assert.match(html, /完整的房间服务/);
  }
  assert.match(roomInviteMarkup({ isShowcase: true }), /示例角色都是自动回复的虚构角色/);
  assert.match(roomInviteMarkup({ isShowcase: false }), /自己开的房间.*示例角色不会来/);
});

// ---------------------------------------------------------------------------------------------------------------------------
// tour.js
// ---------------------------------------------------------------------------------------------------------------------------

const ROOM = { stage: 'room', ownPhotos: 0, hasPairing: false, exchanges: { total: 0 }, friends: 0, openedRecap: false, panel: null };

test('tour completion table', () => {
  const table = [
    ['nothing yet', {}, {}, [false, false, false, false], 0],
    ['a photo of their own', { ownPhotos: 1 }, {}, [true, false, false, false], 1],
    ['a photo and a partner, wall not seen', { ownPhotos: 1, hasPairing: true }, {}, [true, false, false, false], 1],
    ['a photo, a partner, wall seen before', { ownPhotos: 1, hasPairing: true }, { seenWall: true }, [true, true, false, false], 2],
    ['the wall is open now', { ownPhotos: 1, hasPairing: true, panel: 'wall' }, {}, [true, true, false, false], 2],
    ['seen the wall but there is no partner', { ownPhotos: 1, hasPairing: false, panel: 'wall' }, { seenWall: true }, [true, false, false, false], 1],
    ['an exchange exists', { ownPhotos: 1, hasPairing: true, exchanges: { total: 1 } }, {}, [true, true, true, false], 3],
    ['an exchange without a partner reading still passes step 2', { ownPhotos: 1, exchanges: { total: 2 } }, {}, [true, true, true, false], 3],
    ['a friend', { ownPhotos: 1, hasPairing: true, exchanges: { total: 1 }, friends: 1 }, {}, [true, true, true, true], null],
    ['the recap was opened', { ownPhotos: 1, hasPairing: true, exchanges: { total: 1 }, openedRecap: true }, {}, [true, true, true, true], null],
    ['a friend before anything else', { friends: 2 }, {}, [false, false, false, true], 0],
    ['no photo means no later step from the wall', { hasPairing: true, panel: 'wall' }, { seenWall: true }, [false, false, false, false], 0],
  ];
  for (const [label, patch, flags, done, current] of table) {
    const progress = tourProgress({ ...ROOM, ...patch }, flags);
    assert.deepEqual(progress.done, done, label);
    assert.equal(progress.current, current, label);
    assert.equal(progress.complete, current === null, label);
  }
});

test('tour visibility: hidden in the lobby, in a read-only tab, behind a panel and after skipping', () => {
  assert.equal(tourProgress({ ...ROOM }).visible, true);
  assert.equal(tourProgress({ ...ROOM, stage: 'lobby' }).visible, false);
  assert.equal(tourProgress({ ...ROOM, readOnly: true }).visible, false);
  assert.equal(tourProgress({ ...ROOM, panel: 'upload' }).visible, false);
  assert.equal(tourProgress({ ...ROOM }, { skipped: true }).visible, false);
  assert.equal(tourMarkup({ progress: tourProgress({ ...ROOM, stage: 'lobby' }) }), '');
  assert.equal(tourMarkup({}), '');
});

test('tour markup: the title line, the four steps and the sample buttons of step 1', () => {
  assert.deepEqual(TOUR_STEPS.map(step => step.title), ['放一张你的照片', '看「同一刻的另一面」', '发起交换', '招个手 / 私聊 / 回看这一晚']);
  const first = tourMarkup({ progress: tourProgress({ ...ROOM }), esc });
  assert.equal(textOf(first.match(/<p class="demo-tour-title">([\s\S]*?)<\/p>/)[1]), '示例路线 1/4 · 放一张你的照片');
  const buttons = [...first.matchAll(/<button type="button" class="demo-tour-action (primary|quiet)" data-tour-action="([^"]+)">([^<]+)<\/button>/g)].map(match => [match[1], match[2], match[3]]);
  assert.deepEqual(buttons, [['primary', 'sample:sample-crowd', '人海 · 示例照片'], ['quiet', 'sample:sample-stage', '舞台 · 示例照片'], ['quiet', 'open:upload', '用我自己的照片']]);
  assert.match(first, /<button type="button" class="demo-tour-skip quiet" data-tour-skip>跳过路线<\/button>/);
  assert.match(first, /<button type="button" class="demo-tour-toggle" data-tour-toggle aria-expanded="true" aria-label="收起示例路线">收起<\/button>/);
  const own = tourMarkup({ progress: tourProgress({ ...ROOM }), esc, samples: [{ id: 'a"b', label: '<b>x</b>' }] });
  assert.match(own, /data-tour-action="sample:a&quot;b">&lt;b&gt;x&lt;\/b&gt;<\/button>/);
  assert.doesNotMatch(own, /<b>/);
  const none = tourMarkup({ progress: tourProgress({ ...ROOM }), esc, samples: [] });
  assert.doesNotMatch(none, /sample:/);
  assert.match(none, /data-tour-action="open:upload"/);

  const second = tourMarkup({ progress: tourProgress({ ...ROOM, ownPhotos: 1, hasPairing: true }), esc });
  assert.equal(textOf(second.match(/<p class="demo-tour-title">([\s\S]*?)<\/p>/)[1]), '示例路线 2/4 · 看「同一刻的另一面」');
  assert.deepEqual([...second.matchAll(/data-tour-action="([^"]+)"/g)].map(match => match[1]), ['open:wall']);
  const third = tourMarkup({ progress: tourProgress({ ...ROOM, ownPhotos: 1, hasPairing: true }, { seenWall: true }), esc });
  assert.match(textOf(third), /示例路线 3\/4 · 发起交换/);
  assert.deepEqual([...third.matchAll(/data-tour-action="([^"]+)"/g)].map(match => match[1]), ['open:wall']);
  const fourth = tourMarkup({ progress: tourProgress({ ...ROOM, ownPhotos: 1, hasPairing: true, exchanges: { total: 1 } }), esc });
  assert.match(textOf(fourth), /示例路线 4\/4 · 招个手 \/ 私聊 \/ 回看这一晚/);
  assert.deepEqual([...fourth.matchAll(/data-tour-action="([^"]+)"/g)].map(match => match[1]), ['open:people', 'open:recap']);
  for (const html of [first, second, third, fourth]) assert.equal(count(html, /class="[^"]*\bprimary\b[^"]*" data-tour-action/g), 1, 'one primary action');

  const last = tourMarkup({ progress: tourProgress({ ...ROOM, ownPhotos: 1, hasPairing: true, exchanges: { total: 1 }, friends: 1 }), esc });
  assert.match(textOf(last), /示例路线 4\/4 · 路线走完了/);
  assert.match(textOf(last), /更多可以逛：我的空间、音乐社群、专辑世界杯、一起玩、音乐探索。/);
  assert.doesNotMatch(last, /data-tour-action/);
  assert.match(last, /data-tour-skip/);
  assert.equal(count(first, /<i( class="on")?><\/i>/g), 4, 'four progress segments');
  assert.equal(count(second, /<i class="on"><\/i>/g), 1);
});

test('tour markup, collapsed: the title and the toggle only', () => {
  const html = tourMarkup({ progress: tourProgress({ ...ROOM }), esc, collapsed: true });
  assert.match(html, /aria-expanded="false" aria-label="展开示例路线">展开<\/button>/);
  assert.doesNotMatch(html, /data-tour-action|data-tour-skip|demo-tour-hint/);
  assert.match(textOf(html), /示例路线 1\/4 · 放一张你的照片/);
});

function fakeContainer() {
  const container = {
    hidden: false, writes: 0, listeners: {}, attrs: {}, classes: new Set(), html: '',
    classList: { add: name => container.classes.add(name) },
    setAttribute: (name, value) => { container.attrs[name] = String(value); },
    addEventListener: (type, listener) => { container.listeners[type] = listener; },
    removeEventListener: type => { delete container.listeners[type]; },
    get innerHTML() { return container.html; },
    set innerHTML(value) { container.writes += 1; container.html = value; },
    /** Click the first control in the current markup that carries this attribute; returns false when there is none. */
    click(attribute, value) {
      const found = [...container.html.matchAll(/<button\b([^>]*)>/g)].map(match => Object.fromEntries([...match[1].matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map(item => [item[1], item[2] ?? '']))).find(attrs => attribute in attrs && (value === undefined || attrs[attribute] === value));
      if (!found) return false;
      const dataset = Object.fromEntries(Object.entries(found).filter(([name]) => name.startsWith('data-')).map(([name, text]) => [name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()), text]));
      const target = { dataset, closest: selector => (selector.split(',').some(part => (part.match(/^\[([\w-]+)\]$/) || [])[1] in found) ? target : null) };
      container.listeners.click({ target });
      return true;
    },
  };
  return container;
}
const memoryStorage = (initial = {}) => { const items = new Map(Object.entries(initial)); return { items, getItem: key => items.get(key) ?? null, setItem: (key, value) => items.set(key, String(value)) }; };

test('tour: the container becomes the live region, the card follows the view and only touches the DOM when it changes', () => {
  const container = fakeContainer();
  const tour = createTour({ container, esc, onAction() {}, storage: memoryStorage() });
  assert.ok(container.classes.has('demo-tour'));
  assert.deepEqual([container.attrs.role, container.attrs['aria-live'], container.attrs['aria-label']], ['region', 'polite', '示例路线']);
  assert.equal(typeof container.listeners.click, 'function');
  assert.deepEqual(tour.update({ ...ROOM, stage: 'lobby' }), { visible: false, step: 1, complete: false, done: [false, false, false, false] });
  assert.equal(container.hidden, true);
  assert.equal(container.html, '');
  assert.deepEqual(tour.update(ROOM), { visible: true, step: 1, complete: false, done: [false, false, false, false] });
  assert.equal(container.hidden, false);
  assert.match(container.html, /示例路线 1\/4/);
  const writes = container.writes;
  for (let i = 0; i < 5; i += 1) tour.update({ ...ROOM });
  assert.equal(container.writes, writes, 'a poll that changes nothing writes nothing');
  assert.equal(tour.update({ ...ROOM, ownPhotos: 1, hasPairing: true }).step, 2);
  assert.equal(container.writes, writes + 1);
  assert.equal(tour.update({ ...ROOM, ownPhotos: 1, hasPairing: true, panel: 'wall' }).visible, false, 'the wall panel covers the card');
  assert.equal(container.hidden, true);
  assert.equal(tour.update({ ...ROOM, ownPhotos: 1, hasPairing: true }).step, 3, 'the wall was seen with a partner on it: the card moves on');
  tour.dispose();
  assert.equal(container.hidden, true);
  assert.equal(container.html, '');
  assert.equal(container.listeners.click, undefined);
  assert.equal(tour.update(ROOM).visible, false, 'a disposed tour stays quiet');
  assert.doesNotThrow(() => tour.dispose());
});

test('tour: a host placed just before .presence moves in as its first child; any other place is left alone', () => {
  const moved = [];
  const presence = { firstChild: {}, classList: { contains: name => name === 'presence' }, prepend: node => moved.push(node) };
  const before = fakeContainer();
  before.nextElementSibling = presence;
  createTour({ container: before, esc, storage: memoryStorage() });
  assert.deepEqual(moved, [before]);
  const first = fakeContainer();
  first.nextElementSibling = { ...presence, firstChild: first, prepend: node => moved.push(node) };
  createTour({ container: first, esc, storage: memoryStorage() });
  assert.equal(moved.length, 1, 'already the first child');
  const elsewhere = fakeContainer();
  elsewhere.nextElementSibling = { classList: { contains: () => false }, prepend: node => moved.push(node) };
  createTour({ container: elsewhere, esc, storage: memoryStorage() });
  createTour({ container: fakeContainer(), esc, storage: memoryStorage() });
  assert.equal(moved.length, 1);
});

test('tour: the parent carries demo-tour-open exactly while the card is visible and expanded', () => {
  const classes = new Set();
  const container = fakeContainer();
  container.parentElement = { classList: { toggle: (name, on) => { if (on) classes.add(name); else classes.delete(name); }, remove: name => classes.delete(name) } };
  const tour = createTour({ container, esc, storage: memoryStorage() });
  tour.update({ ...ROOM, stage: 'lobby' });
  assert.deepEqual([...classes], []);
  tour.update(ROOM);
  assert.deepEqual([...classes], ['demo-tour-open']);
  assert.ok(container.click('data-tour-toggle'));
  assert.deepEqual([...classes], [], 'collapsed: the presence gets its own text and buttons back');
  assert.ok(container.click('data-tour-toggle'));
  assert.deepEqual([...classes], ['demo-tour-open']);
  tour.update({ ...ROOM, panel: 'upload' });
  assert.deepEqual([...classes], [], 'hidden behind a panel');
  tour.update(ROOM);
  assert.ok(container.click('data-tour-skip'));
  assert.deepEqual([...classes], []);
  tour.update(ROOM);
  tour.dispose();
  assert.deepEqual([...classes], []);
});

test('tour: a click on a card button is reported as its data-tour-action; skip and collapse are remembered', () => {
  const container = fakeContainer();
  const storage = memoryStorage();
  const actions = [];
  const tour = createTour({ container, esc, onAction: (action, detail) => actions.push([action, detail]), storage });
  tour.update(ROOM);
  assert.ok(container.click('data-tour-action', 'sample:sample-crowd'));
  assert.ok(container.click('data-tour-action', 'sample:sample-stage'));
  assert.ok(container.click('data-tour-action', 'open:upload'));
  assert.deepEqual(actions, [
    ['sample:sample-crowd', { kind: 'sample', id: 'sample-crowd' }],
    ['sample:sample-stage', { kind: 'sample', id: 'sample-stage' }],
    ['open:upload', { kind: 'open', id: 'upload' }],
  ]);
  assert.equal(storage.items.size, 0, 'taking an action stores nothing');
  assert.ok(container.click('data-tour-toggle'));
  assert.match(container.html, /aria-expanded="false"/);
  assert.equal(actions.length, 3, 'collapse is not an action');
  assert.deepEqual(JSON.parse(storage.items.get(TOUR_STORAGE_KEY)), { v: 1, skipped: false, collapsed: true, seenWall: false });
  assert.ok(container.click('data-tour-toggle'));
  assert.match(container.html, /aria-expanded="true"/);
  assert.ok(container.click('data-tour-skip'));
  assert.deepEqual(actions.at(-1), ['skip', { kind: 'skip', id: '' }]);
  assert.equal(container.hidden, true);
  assert.deepEqual(JSON.parse(storage.items.get(TOUR_STORAGE_KEY)), { v: 1, skipped: true, collapsed: false, seenWall: false });
  assert.equal(tour.update(ROOM).visible, false);
  assert.equal(TOUR_STORAGE_KEY, 'music-space-tour:v1');
  container.listeners.click({ target: { closest: () => null, dataset: {} } });
  container.listeners.click({});
  assert.equal(actions.length, 4, 'a click elsewhere in the card does nothing');
});

test('tour: a saved state is read back (a reload keeps the skip and the collapse), the wall sighting too', () => {
  const skipped = memoryStorage({ [TOUR_STORAGE_KEY]: JSON.stringify({ v: 1, skipped: true, collapsed: false, seenWall: false }) });
  const a = fakeContainer();
  assert.equal(createTour({ container: a, esc, storage: skipped }).update(ROOM).visible, false);
  const collapsed = memoryStorage({ [TOUR_STORAGE_KEY]: JSON.stringify({ collapsed: true }) });
  const b = fakeContainer();
  createTour({ container: b, esc, storage: collapsed }).update(ROOM);
  assert.match(b.html, /aria-expanded="false"/);
  const storage = memoryStorage();
  const c = fakeContainer();
  const first = createTour({ container: c, esc, storage });
  first.update({ ...ROOM, ownPhotos: 1, hasPairing: true, panel: 'wall' });
  assert.equal(JSON.parse(storage.items.get(TOUR_STORAGE_KEY)).seenWall, true);
  const d = fakeContainer();
  assert.equal(createTour({ container: d, esc, storage }).update({ ...ROOM, ownPhotos: 1, hasPairing: true }).step, 3, 'after a reload the wall counts as seen');
  const noPartner = memoryStorage();
  createTour({ container: fakeContainer(), esc, storage: noPartner }).update({ ...ROOM, ownPhotos: 1, hasPairing: false, panel: 'wall' });
  assert.equal(noPartner.items.size, 0, 'a wall without a partner is not a sighting');
});

test('tour: unreadable or unavailable storage never breaks the card', () => {
  for (const storage of [{ getItem: () => '{not json', setItem() { throw new Error('quota'); } }, { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } }, { getItem: () => '[1,2]', setItem() {} }]) {
    const container = fakeContainer();
    const tour = createTour({ container, esc, storage });
    assert.equal(tour.update(ROOM).visible, true);
    assert.ok(container.click('data-tour-toggle'));
    assert.match(container.html, /aria-expanded="false"/);
    assert.ok(container.click('data-tour-toggle'));
    assert.ok(container.click('data-tour-skip'));
    assert.equal(container.hidden, true);
  }
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('SecurityError'); } });
  try {
    const container = fakeContainer();
    assert.equal(createTour({ container, esc }).update(ROOM).visible, true);
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original); else delete globalThis.localStorage;
  }
  const empty = createTour({ container: null });
  assert.equal(empty.update(ROOM).visible, false);
  assert.doesNotThrow(() => empty.dispose());
});

// ---------------------------------------------------------------------------------------------------------------------------
// demo-hooks.js
// ---------------------------------------------------------------------------------------------------------------------------

test('a random avatar is one of the product\'s looks with a valid skin tone, a random name is 访客 and four digits', () => {
  for (const random of [() => 0, () => 0.5, () => 0.999999]) {
    const avatar = randomAvatar(random);
    assert.deepEqual(avatar, safeAvatar(avatar), 'already a valid, normalised v2 avatar');
    assert.ok(TEMPLATES.some(template => template.avatar.hair === avatar.hair && template.avatar.top === avatar.top && template.avatar.outfit === avatar.outfit), 'one of TEMPLATES');
    assert.ok(avatar.skin >= 0 && avatar.skin < SKINS.length);
    assert.match(renderAvatarSvg(avatar, { view: 'quarter', width: 92, height: 192 }), /^<svg /);
  }
  assert.equal(randomAvatar(() => 0).skin, 0);
  assert.equal(randomAvatar(() => 0.999999).skin, SKINS.length - 1);
  assert.equal(randomName(() => 0), '访客1000');
  assert.equal(randomName(() => 0.999999), '访客9999');
  assert.match(randomName(), /^访客\d{4}$/);
  assert.ok(randomName().length <= 18);
});

test('createDemoProfile: the shape of profile.demo, with options read when needed', async () => {
  let world = null;
  let persistent = true;
  let readOnly = false;
  const demo = createDemoProfile({ getWorld: () => world, eventDate: '2026.09.26', samples: SAMPLES, loadSample: async id => ({ file: id }), reset: async () => 'reset', ready: Promise.resolve(), build: BUILD, channel: 'preview', persistent: () => persistent, readOnly: () => readOnly, random: () => 0.25 });
  for (const key of ['mode', 'roomCode', 'eventDate', 'isCast', 'castLabel', 'samples', 'loadSample', 'demoTime', 'entryMarkup', 'enter', 'roomInviteMarkup', 'aboutMarkup', 'reset', 'createTour', 'onWorldChanged', 'notifyChanged']) assert.ok(key in demo, key);
  assert.equal(demo.mode, 'static');
  assert.equal(demo.eventDate, '2026.09.26');
  assert.equal(demo.roomCode(), null, 'no world yet');
  assert.deepEqual(demo.castNames(), []);
  assert.equal(demo.isCast('u-yao'), false);
  world = WORLD;
  assert.equal(demo.roomCode(), 'ABCDEFGHIJKL');
  assert.deepEqual(demo.castNames(), ['阿遥·示例', '小满·示例', '北屿·示例', '林间·示例']);
  assert.equal(demo.samples, SAMPLES);
  assert.deepEqual(await demo.loadSample('sample-crowd'), { file: 'sample-crowd' });
  assert.equal(await demo.reset(), 'reset');
  assert.match(demo.aboutMarkup({ ai: 'on' }), /预览版/);
  assert.doesNotMatch(demo.aboutMarkup({ ai: 'on' }), /demo-about-warn/);
  persistent = false;
  readOnly = true;
  const about = demo.aboutMarkup({ ai: 'on' });
  assert.match(about, /这个浏览器没有让这里保存数据/);
  assert.match(about, /这个标签页是只读的/);
  assert.match(about, /阿遥·示例、小满·示例、北屿·示例、林间·示例/);
  assert.match(about, /版本 <code>0\.22\.0-rc\.1<\/code>/);
});

test('createDemoProfile: values may also arrive as plain values or getters, and a missing reset says so', () => {
  const state = { persistent: true };
  const demo = createDemoProfile({ getWorld: () => WORLD, build: BUILD, channel: 'pages', get persistent() { return state.persistent; }, samples: () => SAMPLES });
  assert.doesNotMatch(demo.aboutMarkup({ ai: 'on' }), /demo-about-warn/);
  state.persistent = false;
  assert.match(demo.aboutMarkup({ ai: 'on' }), /demo-about-warn/);
  assert.equal(demo.samples, SAMPLES);
  assert.deepEqual(createDemoProfile().samples, []);
  assert.throws(() => demo.reset(), /不能重置/);
  assert.equal(demo.isReady(), true, 'no ready promise means ready');
});

test('createDemoProfile: castLabel tells the cast from everyone else, and no token ever reaches a screen', () => {
  const demo = createDemoProfile({ getWorld: () => WORLD, build: BUILD, channel: 'pages' });
  assert.equal(demo.castLabel({ id: 'u-yao', name: '阿遥·示例' }), CAST_LABEL);
  assert.equal(demo.castLabel({ id: 'u-lin' }), CAST_LABEL, 'the quiet member who arrives later is cast too');
  assert.equal(demo.castLabel({ id: 'u-visitor', name: '访客1234' }), '');
  assert.equal(demo.castLabel({ id: 'u-visitor', name: '阿遥·示例' }), '', 'a name is not an identity');
  assert.equal(demo.castLabel(null), '');
  assert.equal(demo.castLabel(undefined), '');
  assert.equal(demo.castLabel({}), '');
  assert.equal(demo.isCast('u-man'), true);
  assert.equal(demo.isCast(''), false);
  assert.equal(CAST_LABEL.includes('&') || CAST_LABEL.includes('<'), false, 'plain text, safe to escape once');
  const surfaces = [demo.aboutMarkup({ ai: 'on' }), demo.entryMarkup({ state: { identity: { status: 'missing' } }, esc, avatarSvg: renderAvatarSvg }), demo.roomInviteMarkup({ code: 'ABCDEFGHIJKL' }), JSON.stringify(demo.castNames()), demo.castLabel({ id: 'u-yao' })];
  for (const text of surfaces) assert.doesNotMatch(text, /SECRET-TOKEN/);
  assert.ok(!JSON.stringify(Object.keys(demo)).includes('token'));
});

test('createDemoProfile: a plainer world (ids, names and the room code only) works as well, and an array of people too', () => {
  const plain = createDemoProfile({ getWorld: () => ({ castIds: ['u-yao', 'u-lin'], castNames: ['阿遥·示例', '林间·示例'], roomCode: 'ABCDEFGHIJKL' }) });
  assert.equal(plain.roomCode(), 'ABCDEFGHIJKL');
  assert.deepEqual(plain.castNames(), ['阿遥·示例', '林间·示例']);
  assert.equal(plain.isCast('u-lin'), true);
  assert.equal(plain.isCast('u-man'), false);
  assert.equal(plain.castLabel({ id: 'u-yao' }), CAST_LABEL);
  assert.match(plain.roomInviteMarkup({ code: 'ABCDEFGHIJKL' }), /示例现场/);
  const listed = createDemoProfile({ getWorld: () => ({ people: [{ id: 'a', name: '甲·示例' }, { id: 'b', npc: { name: '乙·示例' } }, null], room: { code: 'QQQQQQQQQQQQ' } }) });
  assert.deepEqual(listed.castNames(), ['甲·示例', '乙·示例']);
  assert.equal(listed.isCast('b'), true);
  assert.equal(listed.roomCode(), 'QQQQQQQQQQQQ');
  const none = createDemoProfile({ getWorld: () => null });
  assert.deepEqual([none.roomCode(), none.castNames(), none.isCast('a')], [null, [], false]);
});

test('createDemoProfile: roomInviteMarkup tells the showcase room from the visitor\'s own', () => {
  const demo = createDemoProfile({ getWorld: () => WORLD });
  const showcase = demo.roomInviteMarkup({ code: 'ABCDEFGHIJKL', id: 'room-1' });
  const own = demo.roomInviteMarkup({ code: 'ZZZZZZZZZZZZ', id: 'room-2' });
  assert.match(showcase, /只在这个浏览器里的示例现场/);
  assert.match(own, /自己开的房间/);
  assert.doesNotMatch(showcase + own, /ABCDEFGHIJKL|ZZZZZZZZZZZZ/);
  assert.match(demo.roomInviteMarkup(undefined), /自己开的房间/, 'a room it cannot place is not claimed to be the cast\'s');
});

test('createDemoProfile: the entry form starts with the random look and a saved draft wins over it', () => {
  const demo = createDemoProfile({ getWorld: () => WORLD, ready: Promise.resolve(), random: () => 0.5 });
  assert.match(demo.defaultName, /^访客\d{4}$/);
  assert.deepEqual(demo.defaultAvatar, randomAvatar(() => 0.5));
  const first = demo.entryDefaults({});
  assert.deepEqual(first, { name: demo.defaultName, avatar: demo.defaultAvatar, preparing: true, castNames: ['阿遥·示例', '小满·示例', '北屿·示例', '林间·示例'] });
  const draft = { name: '阿晴', avatar: randomAvatar(() => 0.9) };
  assert.deepEqual(demo.entryDefaults({ drafts: { profile: draft } }), { ...first, name: '阿晴', avatar: draft.avatar });
  assert.equal(demo.entryDefaults({ drafts: { profile: draft } }).name, '阿晴');
  assert.equal(demo.entryDefaults(undefined).name, demo.defaultName);
  const html = demo.entryMarkup({ state: { identity: { status: 'missing' } }, esc, avatarSvg: renderAvatarSvg });
  assert.ok(html.includes(`value="${demo.defaultName}"`));
  assert.match(html, /同场的阿遥·示例、小满·示例、北屿·示例、林间·示例都是虚构的/);
  assert.match(html, /<button class="primary" type="submit" disabled>/, 'not ready yet in this tick');
  assert.match(demo.entryMarkup({ state: {}, esc, avatarSvg: () => '', defaults: { name: '给定', preparing: undefined } }), /value="给定"/, 'an undefined default does not override');
});

test('createDemoProfile: ready flips the form from preparing and notifies once; a rejected ready never reads as ready', async () => {
  const ready = deferred();
  const demo = createDemoProfile({ getWorld: () => WORLD, ready: ready.promise });
  const calls = [];
  const stop = demo.onWorldChanged(() => calls.push('changed'));
  assert.equal(demo.isReady(), false);
  assert.equal(demo.entryDefaults().preparing, true);
  ready.resolve();
  await tick();
  assert.equal(demo.isReady(), true);
  assert.equal(demo.entryDefaults().preparing, false);
  assert.deepEqual(calls, ['changed']);
  stop();
  demo.notifyChanged();
  assert.deepEqual(calls, ['changed']);

  const failed = deferred();
  const broken = createDemoProfile({ getWorld: () => WORLD, ready: failed.promise });
  let told = 0;
  broken.onWorldChanged(() => { told += 1; });
  failed.reject(new Error('safe mode'));
  await tick();
  assert.equal(broken.isReady(), false);
  assert.equal(broken.entryDefaults().preparing, true);
  assert.equal(told, 1);

  const lazy = createDemoProfile({ getWorld: () => WORLD, ready: () => Promise.resolve() });
  await tick();
  assert.equal(lazy.isReady(), true, 'a function that returns the promise works too');
});

test('createDemoProfile: syncEntry patches an open entry form without replacing it', async () => {
  const ready = deferred();
  const demo = createDemoProfile({ getWorld: () => WORLD, ready: ready.promise });
  const submit = { disabled: true };
  const status = { textContent: '正在布置示例现场…' };
  const form = { querySelector: selector => ({ "button[type='submit']": submit, '.demo-entry-status': status })[selector] ?? null };
  const root = { querySelector: selector => (selector === "form[data-form='demo-entry']" ? form : null) };
  assert.equal(demo.syncEntry(root), true);
  assert.deepEqual([submit.disabled, status.textContent], [true, '正在布置示例现场…']);
  ready.resolve();
  await tick();
  assert.equal(demo.syncEntry(root), true);
  assert.deepEqual([submit.disabled, status.textContent], [false, '']);
  assert.equal(demo.syncEntry({ querySelector: () => null }), false, 'no entry form open');
  assert.equal(demo.syncEntry(null), false);
  assert.equal(demo.syncEntry({}), false);
});

test('createDemoProfile: onWorldChanged and notifyChanged', () => {
  const demo = createDemoProfile({});
  const order = [];
  const { notifyChanged } = demo;
  const stopA = demo.onWorldChanged(() => order.push('a'));
  demo.onWorldChanged(() => { order.push('b'); throw new Error('a refresh that fails'); });
  demo.onWorldChanged(() => order.push('c'));
  demo.onWorldChanged('not a function');
  notifyChanged();
  assert.deepEqual(order, ['a', 'b', 'c'], 'a failing listener does not stop the others; notifyChanged needs no this');
  stopA();
  notifyChanged();
  assert.deepEqual(order, ['a', 'b', 'c', 'b', 'c']);
  assert.equal(typeof demo.onWorldChanged(null), 'function');
});

test('createDemoProfile: enter() uses the world\'s room and waits for ready', async () => {
  const ready = deferred();
  const demo = createDemoProfile({ getWorld: () => WORLD, ready: ready.promise });
  const controller = fakeController();
  const avatar = randomAvatar(() => 0.4);
  const running = demo.enter({ name: '阿晴', avatar, participation: 'open', consent: true }, controller);
  await tick();
  assert.deepEqual(controller.calls, []);
  ready.resolve();
  assert.deepEqual(await running, { joined: true, code: 'ABCDEFGHIJKL' });
  assert.deepEqual(controller.calls.map(call => call[0]), ['establishIdentity', 'previewRoom', 'joinRoom']);
  assert.equal(controller.calls[1][1], 'ABCDEFGHIJKL');
  const refused = fakeController();
  await assert.rejects(() => demo.enter({ name: 'a', avatar, consent: false }, refused), error => error.code === 'JOIN_CONSENT_REQUIRED');
  assert.deepEqual(refused.calls, []);
});

test('createDemoProfile: demoTime defaults to 21:47 on the event day with the product\'s words, and keeps what it is given', () => {
  const demo = createDemoProfile({ eventDate: '2026.09.26' });
  assert.deepEqual(demo.demoTime, { ms: Date.parse('2026-09-26T21:47:00+08:00'), ...DEMO_TIME_COPY });
  const given = createDemoProfile({ demoTime: { ms: Date.parse('2026-09-26T21:47:30+08:00'), label: '另一个标签', note: '另一个说明' } });
  assert.deepEqual(given.demoTime, { ms: Date.parse('2026-09-26T21:47:30+08:00'), label: '另一个标签', note: '另一个说明' });
  assert.deepEqual(createDemoProfile({ demoTime: { ms: 5 } }).demoTime, { ms: 5, ...DEMO_TIME_COPY });
  assert.equal(createDemoProfile({ eventDate: '2026.10.01' }).demoTime.ms, Date.parse('2026-10-01T21:47:00+08:00'));
  assert.equal(createDemoProfile({ eventDate: 'nonsense' }).demoTime.ms, Date.parse('2026-09-26T21:47:00+08:00'));
  assert.equal(createDemoProfile({}).eventDate, '2026.09.26');
});

test('createDemoProfile: its tour gets the samples and knows when this tab is read-only', () => {
  let readOnly = false;
  const demo = createDemoProfile({ getWorld: () => WORLD, samples: [{ id: 'sample-stage', label: '舞台 · 示例照片' }, { id: 'sample-crowd', label: '人海 · 示例照片' }], readOnly: () => readOnly });
  const container = fakeContainer();
  const actions = [];
  const tour = demo.createTour({ container, esc, onAction: action => actions.push(action), storage: memoryStorage() });
  assert.deepEqual(tour.update(ROOM).done, [false, false, false, false]);
  assert.deepEqual([...container.html.matchAll(/data-tour-action="([^"]+)"/g)].map(match => match[1]), ['sample:sample-stage', 'sample:sample-crowd', 'open:upload'], 'the first sample the roster lists is the primary one');
  assert.ok(container.click('data-tour-action', 'sample:sample-crowd'));
  assert.deepEqual(actions, ['sample:sample-crowd']);
  readOnly = true;
  assert.equal(tour.update(ROOM).visible, false);
  assert.equal(container.hidden, true);
  tour.dispose();
});

// ---------------------------------------------------------------------------------------------------------------------------
// boundaries: nothing at import time, nothing from the server side
// ---------------------------------------------------------------------------------------------------------------------------

test('importing the demo modules touches no fetch, storage, window or document', () => {
  const files = MODULES.map(name => pathToFileURL(path.join(showcase, `${name}.js`)).href);
  const script = `
    const log = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = (...args) => { log.push('fetch'); return realFetch(...args); };
    for (const name of ['localStorage', 'sessionStorage', 'document', 'window', 'indexedDB']) Object.defineProperty(globalThis, name, { configurable: true, get() { log.push(name); return undefined; } });
    for (const file of ${JSON.stringify(files)}) await import(file);
    console.log(JSON.stringify(log));
  `;
  assert.equal(execFileSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' }).trim(), '[]');
});

test('the demo modules import only the shared pure modules, never the server side', () => {
  const allowed = ['web/avatar/model.js', 'web/js/photo-insight.js', 'web/js/moment.js'];
  for (const name of MODULES) {
    const source = sourceOf(name);
    assert.doesNotMatch(source, /import\.meta/);
    const specifiers = [...source.matchAll(/(?:^|\n)\s*import\s[^;]*?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g)].map(match => match[1] || match[2]);
    for (const specifier of specifiers) {
      assert.ok(specifier.startsWith('.'), `${name}.js imports only local files: ${specifier}`);
      const resolved = path.relative(root, path.resolve(showcase, specifier)).split(path.sep).join('/');
      assert.ok(allowed.includes(resolved) || resolved.startsWith('web/static-runtime/showcase/'), `${name}.js may not import ${resolved}`);
      assert.doesNotMatch(resolved, /runtime-preview|server\//);
    }
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.doesNotMatch(code, /\b(?:document|window|indexedDB|sessionStorage)\b/, `${name}.js does not reach for the page`);
    assert.doesNotMatch(code, /\bfetch\b/, `${name}.js makes no request`);
    if (name !== 'tour') assert.doesNotMatch(code, /\blocalStorage\b/, `${name}.js keeps nothing in storage`);
  }
});

// ---------------------------------------------------------------------------------------------------------------------------
// demo.css
// ---------------------------------------------------------------------------------------------------------------------------

test('demo.css: the lobby hides what a first visit does not need and #join is a solid, 44px button', () => {
  assert.match(css, /\.frame\[data-stage='lobby'\] #music-map-entry,\s*\.frame\[data-stage='lobby'\] #social-inbox,\s*\.frame\[data-stage='lobby'\] #my-look \{\s*display: none;/);
  const join = css.match(/\.frame\[data-stage='lobby'\] \.presence-actions #join \{([^}]*)\}/)[1];
  assert.match(join, /min-height: 4[4-9]px/);
  assert.match(join, /background: #294c3e/);
  assert.match(join, /text-decoration: none/);
  assert.match(join, /width: 100%/);
});

test('demo.css: the preview ribbon, the tour card, the cast badge and the About sections are styled; nothing needs !important', () => {
  assert.match(css, /\[data-channel='preview'\] body::before \{[^}]*content: '预览版';[^}]*position: fixed;[^}]*pointer-events: none;/);
  for (const selector of ['.demo-tour', '.demo-tour[hidden]', '.demo-tour .demo-tour-action.primary', '.demo-tour .demo-tour-toggle', '.demo-tour .demo-tour-skip', '.demo-about .demo-about-section', '.demo-about .demo-about-warn', '.cast-badge', '.demo-room-note', '.demo-entry .demo-entry-more summary']) assert.ok(css.includes(selector), `demo.css styles ${selector}`);
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(rules, /!important/, 'rules win by specificity, not by force');
  assert.doesNotMatch(rules, /@import|url\(/, 'no extra request');
  assert.match(css, /pointer-events: auto;/, 'the footer button is clickable although the footer ignores the pointer');
  assert.match(css, /\.frame \.presence\.demo-tour-open > :not\(\.demo-tour\) \{\s*display: none;/);
  assert.match(css, /\.panel \.participation-choices input\[type='radio'\] \{[^}]*width: 20px;[^}]*height: 20px;/, 'radio buttons keep their size despite .panel input:not([type=checkbox])');
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /:has\(/, 'no :has(): older WeChat WebViews ignore the whole rule');
});

test('demo.css: text is 12px or more, and every tap target of the card is 44px or more', () => {
  const sizes = [...css.matchAll(/font-size:\s*([\d.]+)px/g)].map(match => Number(match[1]));
  assert.ok(sizes.length > 10);
  assert.ok(Math.min(...sizes) >= 12, `smallest font-size is ${Math.min(...sizes)}px`);
  for (const selector of ['.demo-tour .demo-tour-action,\n.demo-tour .demo-tour-skip,\n.demo-tour .demo-tour-toggle', 'body .frame > footer button', '.demo-entry .demo-entry-more summary']) {
    const start = css.indexOf(selector);
    assert.ok(start >= 0, selector);
    assert.match(css.slice(start, css.indexOf('}', start)), /min-height: 44px/, `${selector} has a 44px target`);
  }
  const body = [...css.matchAll(/\.demo-(?:tour|about|room-note)[^{]*\{[^}]*font-size:\s*(\d+)px/g)].map(match => Number(match[1]));
  assert.ok(body.every(size => size >= 12));
});

test('demo.css is balanced and names only elements the event room page really has', () => {
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.equal(count(rules, /\{/g), count(rules, /\}/g), 'every block is closed');
  const page = readFileSync(path.join(root, 'web/event-room/index.html'), 'utf8');
  for (const id of ['music-map-entry', 'social-inbox', 'my-look', 'join', 'evidence']) assert.ok(page.includes(`id="${id}"`), `index.html has #${id}`);
  for (const id of ['music-map-entry', 'social-inbox', 'my-look', 'join']) assert.ok(rules.includes(`#${id}`), `demo.css styles #${id}`);
  assert.ok(rules.includes('body .frame > footer button'), 'demo.css styles the About button in the footer (#evidence)');
  for (const name of ['frame', 'presence', 'presence-actions', 'camera-nav']) assert.match(page, new RegExp(`class="[^"]*\\b${name}\\b`), `index.html has .${name}`);
  assert.match(page, /<footer>/);
});
