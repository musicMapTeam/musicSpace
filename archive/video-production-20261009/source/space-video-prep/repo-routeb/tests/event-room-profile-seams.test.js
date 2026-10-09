// The profile seams of web/event-room/app.js: one page script serving the Node room server (profile 'server') and the in-browser example
// site (profile 'static'). Same bounded shell as tests/event-room-binding.test.js: app.js runs in a vm after its single-line imports are
// deleted and replaced by injected globals. These are callback, state and wording checks, NOT browser/WebGL/visual QA.
//
// Names that app.js imports and this harness has no stand-in for are replaced by an inert stand-in, so a later task that adds an import
// does not break these tests. The profile objects here are stubs (distinctive strings, so a test fails when a seam stops reading the
// profile); the real static profile and its wording live under web/static-runtime and are tested there.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { invitation, invitationUrl, nfcInvitation } from '../runtime-preview/src/admission-protocol.js';
import { memberFloorPositions, layoutSceneLabels } from '../web/event-room/scene-layout.js';
import { DEFAULT_AVATAR, SKINS, HAIRS, GARMENT_COLORS, SONGS, safeAvatar, escape as esc } from '../web/avatar/model.js';
import { renderAvatarSvg } from '../web/illustrated-avatar/index.js';
import { recapMarkup } from '../web/event-room/recap-view.js';
import { createMemoryCardExporter } from '../web/event-room/memory-card.js';
import { memoryCardMarkup } from '../web/event-room/memory-card-view.js';
import { renderMemoryCardPng, saveMemoryCardDownload } from '../web/event-room/memory-card-png.js';
import { profile as serverProfile } from '../web/event-room/runtime-profile.js';

const source = readFileSync(new URL('../web/event-room/app.js', import.meta.url), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
const defer = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
const actor = '00000000-0000-4000-8000-000000000001';
const roomId = '00000000-0000-4000-8000-000000000002';
const otherId = '00000000-0000-4000-8000-000000000003';
const CODE = 'AAAAAAAAAAAA';
const room = (id = roomId, extra = {}) => ({ id, code: id === roomId ? CODE : 'BBBBBBBBBBBB', title: 'Synthetic show', venue: 'Synthetic venue', role: 'host', joined: true, revision: 1, status: 'open', ...extra });
function initial(extra = {}) {
  return { connection: 'connected', identity: { status: 'ready', user: { id: actor, name: 'Synthetic viewer', avatar: DEFAULT_AVATAR, revision: 1 } }, route: { kind: 'home', target: null }, room: null, preview: null, members: [], photos: [], myPhotos: { items: [], nextCursor: null }, myRooms: { items: [], nextCursor: null }, drafts: { photo: null, profile: null, room: null }, draftVersions: { photo: 0, profile: 0, room: 0 }, dirty: { photo: false, profile: false, room: false }, pending: [], loading: [], storage: { ok: true, refreshRecovery: true }, error: null, ...extra };
}
const me = { id: actor, name: 'Synthetic viewer', participation: 'open' };
const guest = { id: otherId, name: 'Synthetic guest', participation: 'open' };
const inRoom = (extra = {}) => initial({ room: room(roomId, { songId: 'late-train' }), route: { kind: 'room', target: roomId }, members: [me, guest], ...extra });
function element() {
  const events = new Map();
  return { events, hidden: false, innerHTML: '', textContent: '', scrollTop: 0, dataset: {}, isConnected: true, classList: { add() {}, remove() {}, toggle() {} }, addEventListener(type, fn) { const list = events.get(type) || []; list.push(fn); events.set(type, list); }, setAttribute() {}, removeAttribute() {}, focus() {}, append() {}, remove() {}, querySelector() { return null; }, querySelectorAll() { return []; } };
}
/** An object that answers every property, call and construction with another inert object and reads as '' in a template. */
const inert = () => new Proxy(function () {}, { get: (_, key) => (key === Symbol.toPrimitive ? () => '' : key === 'then' ? undefined : inert()), apply: () => inert(), construct: () => inert() });
/** Every name the page's single-line imports bind (the harness injects them as globals). */
function importedNames(code) {
  return [...code.matchAll(/^import\s+(.+?)\s+from\s+'[^']+';$/gm)].flatMap(([, spec]) => (spec.startsWith('{') ? spec.slice(1, -1).split(',').map(part => part.trim().split(/\s+as\s+/).pop()) : [spec.trim()])).filter(Boolean);
}

function harness(start = initial(), url = 'https://musicspace.test/event/', profile = serverProfile) {
  let current = clone(start), subscriber;
  const elements = new Map(), doc = element(), window = element(), calls = [], timers = new Map();
  let nextTimer = 0;
  const get = selector => { if (!elements.has(selector)) elements.set(selector, element()); return elements.get(selector); };
  window.location = { reload() { calls.push(['reload']); } };
  doc.querySelector = get; doc.querySelectorAll = () => []; doc.createElement = () => element(); doc.activeElement = element(); doc.hidden = false;
  const emit = next => { current = clone(next); subscriber?.(clone(current)); };
  const controller = {
    getState: () => clone(current), subscribe(fn) { subscriber = fn; fn(clone(current)); return () => {}; },
    setDraft(kind, value) { current.drafts[kind] = clone(value); current.draftVersions[kind]++; current.dirty[kind] = true; emit(current); },
    async connect() { calls.push(['connect']); return { applied: true }; }, async loadSocial() { calls.push(['loadSocial']); return { applied: true }; }, async loadSocialPeer(id) { calls.push(['loadSocialPeer', id]); return { applied: true }; },
    async loadMyRooms() { calls.push(['loadMyRooms']); return { applied: true }; }, async loadMyPhotos() { calls.push(['loadMyPhotos']); return { applied: true }; },
    async previewRoom(code) { calls.push(['previewRoom', code]); emit({ ...current, route: { kind: 'preview', target: code }, room: null, preview: { ...room(code === CODE ? roomId : otherId), code } }); return { applied: true, preview: current.preview }; },
    async openRoom(id) { calls.push(['openRoom', id]); emit({ ...current, route: { kind: 'room', target: id }, room: room(id), members: [me, guest] }); return { applied: true, room: current.room }; },
    async refreshRoom() { calls.push(['refreshRoom']); return { applied: true }; }, async fetchPhotoBlob(id) { calls.push(['fetchPhotoBlob', id]); return new Blob(['synthetic'], { type: 'image/jpeg' }); },
    retry: async id => ({ operationId: id, applied: false }), cancel() {}, dispose() {}, uploadPhoto: async () => ({ applied: true }), establishIdentity: async () => ({ applied: true }), createRoom: async () => ({ applied: true }), joinRoom: async () => ({ applied: true }), setPhotoVisibility: async () => ({ applied: true }), removePhoto: async () => ({ applied: true }), leaveRoom: async () => ({ applied: true }), closeRoom: async () => ({ applied: true }),
  };
  class SafeURL extends URL { static createObjectURL() { return 'blob:synthetic-' + Math.random(); } static revokeObjectURL() {} }
  const location = new URL(url), history = { replaceState(_a, _b, next) { location.href = String(next); } };
  const engine = { ready: Promise.resolve(), update() {}, goTo() {}, getState: () => ({ view: 'overview' }), setReducedMotion() {}, dispose() {}, pick() { return null; } };
  const globals = {
    console, document: doc, window, location, history, navigator: { clipboard: { writeText: async () => {} } }, URL: SafeURL, Blob,
    invitation, invitationUrl, nfcInvitation, createMusicMap: () => ({ open: () => calls.push(['musicMapOpen']), close() {}, syncIdentity() {}, dispose() {} }), createPersonalSpace: () => ({ open: async () => calls.push(['personalOpen']), close() {}, syncIdentity() {}, dispose() {} }), createCornerPanel: () => ({ open: async () => {}, close() {}, syncIdentity() {}, dispose() {} }), createIdentityContinuityPanel: () => ({ open() {}, close() {}, dispose() {} }),
    createCommunityPanel: () => ({ open: async () => {}, close() {}, syncIdentity() {}, dispose() {} }), createWorldCupPanel: () => ({ open: async () => {}, close() {}, syncIdentity() {}, dispose() {} }),
    createMusicGames: () => ({ open: async () => {}, close() {}, syncIdentity() {}, dispose() {} }), createMusicTopics: () => ({ open: async () => {}, close() {}, syncIdentity() {}, dispose() {} }), createSpaceManagement: () => ({ open: async () => {}, close() {}, syncIdentity() {}, dispose() {} }),
    createModerationPanel: () => ({ close() {}, syncIdentity() {}, refresh: async () => {}, dispose() {} }), createExchangePanel: () => ({ open: async () => {}, close() {}, syncIdentity() {}, refresh: async () => {}, invalidate() {}, getState: () => ({}), dispose() {} }),
    matchMedia: () => ({ matches: true, addEventListener() {} }), setTimeout: (callback, delay) => { const id = ++nextTimer; timers.set(id, { callback, delay }); return id; }, clearTimeout: id => timers.delete(id),
    createEventController: options => { calls.push(['createEventController', options]); return controller; }, profile, mountLivehouseScene: () => engine,
    memberFloorPositions, layoutSceneLabels, renderAvatarSvg, recapMarkup, createMemoryCardExporter, memoryCardMarkup, renderMemoryCardPng, saveMemoryCardDownload, AbortController, venueAssetUrl: 'data:model/gltf-binary;base64,c3ludGhldGlj', SESSION_KEY: 'music-space-avatar-session:v1', DEFAULT_AVATAR, SKINS, HAIRS, GARMENT_COLORS, SONGS, safeAvatar, esc,
    qrcode: () => { calls.push(['qrcode']); return { addData() {}, make() {}, createSvgTag: () => '<svg></svg>' }; },
    FormData: class { constructor(form) { this.values = form.values || {}; } get(key) { return this.values[key] ?? null; } getAll(key) { const v = this.values[key]; return v === undefined ? [] : Array.isArray(v) ? v : [v]; } },
  };
  // The binding harness leaves these two undefined on purpose (app.js wraps their creation in try/catch); so does this one.
  const absent = new Set(['createChatPanel', 'createWardrobe']);
  for (const name of importedNames(source)) if (!(name in globals) && !absent.has(name)) globals[name] = inert();
  const context = vm.createContext(globals);
  const code = source.replace(/^import .*;$/gm, '').replace('void boot();', '');
  vm.runInContext(code + '\nglobalThis.binding={boot,openPanel,get:()=>({state,panelKind})};', context, { filename: 'event-room-profile-seams.vm.js' });
  /** The pending poll timer (the page's own refreshVisibleState), by name: toast timers also use 5000. */
  const pollTimer = () => [...timers].find(([, timer]) => timer.callback.name === 'refreshVisibleState');
  return {
    controller, calls, timers, location, emit, window, document: doc, element: get, binding: context.binding, body: get('#panel-body'), get: () => context.binding.get(),
    pollDelay: () => pollTimer()?.[1].delay,
    async runPoll() { const entry = pollTimer(); assert.ok(entry, 'a poll is scheduled'); timers.delete(entry[0]); await entry[1].callback(); await tick(); },
    async click(dataset) { const button = { dataset, closest(selector) { return selector === 'button' ? this : null; } }; for (const fn of doc.events.get('click') || []) await fn({ target: button }); await tick(); },
  };
}

/** A static-profile stand-in. Every key the page reads has a distinctive value; `demo.listeners` records onWorldChanged registrations. */
function staticProfile({ copy = {}, demo = {}, ...rest } = {}) {
  const listeners = [], seen = [];
  const hooks = {
    mode: 'static', eventDate: '2026.09.26', listeners, seen, samples: [], demoTime: { ms: 0, label: '', note: '' },
    roomInviteMarkup(r) { seen.push(r); return `<p class="demo-room-note">NOTE ${r.code}</p>`; },
    onWorldChanged(listener) { listeners.push(listener); return () => {}; },
    notifyChanged() { for (const listener of listeners) listener(); },
    isCast: () => false, castLabel: () => '', loadSample: async () => null, entryMarkup: () => '', aboutMarkup: () => '', enter: async () => ({}), reset: async () => {}, createTour: () => ({ update() {}, dispose() {} }),
    ...demo,
  };
  const words = {
    statusReady: 'STATIC READY', statusPreparing: 'STATIC PREPARING', reconnectLabel: 'STATIC RECONNECT', reconnectToast: 'STATIC RECONNECTED',
    presenceTitleLobby: 'STATIC LOBBY TITLE', presenceCopyLobby: 'STATIC LOBBY COPY', presenceTitleAlone: 'STATIC ALONE TITLE', presenceCopyAlone: 'STATIC ALONE COPY', presenceTitleRoom: 'STATIC ROOM TITLE', presenceCopyRoom: 'STATIC ROOM COPY',
    joinLabelLobby: 'STATIC JOIN LOBBY', joinLabelRoom: 'STATIC JOIN ROOM', trackNote: 'STATIC TRACK NOTE', evidenceButton: 'STATIC EVIDENCE', nonHttpToast: 'STATIC NOT HTTP', keepRoomInUrl: true, pollMs: 2000, exchangePollMs: 2000,
  };
  return { mode: 'static', controllerOptions: () => ({ fetch: 'STATIC FETCH' }), copy: Object.defineProperties({}, { ...Object.getOwnPropertyDescriptors(words), ...Object.getOwnPropertyDescriptors(copy) }), demo: hooks, ...rest };
}

const text = (h, selector) => h.element(selector).textContent;

test('the server profile is the plain default and app.js imports it first', () => {
  assert.equal(serverProfile.mode, 'server');
  assert.deepEqual(serverProfile.controllerOptions(), {});
  assert.deepEqual(Object.keys(serverProfile.copy), [], 'no copy overrides: every t() falls back to the server wording');
  assert.equal(serverProfile.demo, null);
  assert.equal(serverProfile.ready, undefined);
  assert.equal(source.split('\n')[0], "import {profile} from './runtime-profile.js';", 'the static profile installs fetch when it is evaluated, before any API client exists');
});

test('server profile: the landing, presence and status wording is byte for byte today\'s', () => {
  const lobby = harness(initial({ connection: 'connected' }));
  assert.equal(text(lobby, '#presence-title'), '留住现场，也遇见同场的人。');
  assert.equal(text(lobby, '#presence-copy'), '用一个小人加入现场，保存照片、看看他人的视角；愿意时再认识彼此。');
  assert.equal(text(lobby, '#join'), '带上小人，进入现场');
  assert.equal(text(lobby, '#track-title'), '这一晚的歌');
  assert.equal(text(lobby, '#track-note'), '进入房间，留下你看到的那个瞬间');
  assert.equal(text(lobby, '#render-status'), '房间服务已连接');
  assert.equal(text(harness(initial({ connection: 'unknown' })), '#render-status'), '等待连接');
  assert.equal(text(harness(initial({ connection: 'offline' })), '#render-status'), '等待连接');

  const alone = harness(inRoom({ members: [me] }));
  assert.equal(text(alone, '#presence-title'), '先留下你的这一晚。');
  assert.equal(text(alone, '#presence-copy'), '上传第一张照片，或邀请真正同场的朋友。');
  assert.equal(text(alone, '#join'), '邀请同场朋友');
  assert.equal(text(alone, '#track-title'), '这一晚 · 晚班列车');
  assert.equal(text(alone, '#track-note'), '房间选定的原创示例声景 · 不代表真实演出曲目');
  assert.equal(text(alone, '#render-status'), '1 位同场');

  const together = harness(inRoom());
  assert.equal(text(together, '#presence-title'), '同一晚，各自的视角。');
  assert.equal(text(together, '#presence-copy'), '照片可以只为自己保存。认识别人，由双方决定。');
  assert.equal(text(together, '#join'), '邀请同场朋友');
  assert.equal(text(together, '#render-status'), '2 位同场');
});

test('server profile: reconnect button, reconnect toast and the non-http toast keep their words', async () => {
  const offline = harness(initial({ connection: 'offline' }));
  offline.binding.openPanel('entry');
  assert.ok(offline.body.innerHTML.includes('<button class="quiet" data-reconnect>重新连接房间服务</button>'));
  await offline.click({ reconnect: '' });
  assert.equal(text(offline, '#toast'), '房间服务已连接');
  assert.ok(offline.calls.some(call => call[0] === 'connect'));

  const connected = harness(initial({ connection: 'connected' }));
  connected.binding.openPanel('entry');
  assert.doesNotMatch(connected.body.innerHTML, /data-reconnect/);

  const file = harness(initial(), 'file:///Users/someone/index.html');
  await file.binding.boot();
  assert.equal(text(file, '#toast'), '请通过本地房间服务打开，离线 HTML 无法建立真实房间');
  assert.equal(file.calls.some(call => call[0] === 'connect'), false, 'a file: page makes no API call');
});

test('server profile: the room panel keeps the invite block, the QR code and the identity-backup button', () => {
  const h = harness(inRoom());
  h.window.NDEFReader = function NDEFReader() {};
  h.binding.openPanel('room');
  const html = h.body.innerHTML;
  const block = `<div class="invite-code">${CODE}</div><div id="invite-qr" aria-label="现场邀请二维码"></div><button class="primary" data-copy-invite>复制现场邀请链接</button><p class="fine invite-address">https://musicspace.test/event/?room=${CODE}</p><button data-write-nfc>我选择写入 NFC 邀请标签</button><p class="fine">二维码和 NFC 标签只包含上方邀请网址，不携带身份。入场后近场连接须另行选择。</p><p class="fine">链接可转发给来参加这一场的人。入场者仍需本人同意；它不是身份凭据或照片公开链接。</p>`;
  assert.ok(html.includes(block), 'the invite block is the same markup as before');
  assert.ok(html.includes(`</p>${block}<div class="row">`), 'and sits between the member count and the first row of buttons');
  assert.ok(h.calls.some(call => call[0] === 'qrcode'));
  assert.equal(text(h, '#invite-qr').length, 0);
  assert.equal(h.element('#invite-qr').innerHTML, '<svg></svg>');
  for (const kind of ['entry', 'profile', 'rooms', 'room']) {
    h.binding.openPanel(kind);
    assert.match(h.body.innerHTML, /data-open="identity-backup"/, `${kind} panel offers the identity backup`);
  }
});

test('server profile: the footer, the stage attribute, the poll interval and the QA handle', async () => {
  const h = harness(initial());
  assert.deepEqual(h.calls.find(call => call[0] === 'createEventController')[1], {}, 'controllerOptions() is passed on');
  assert.equal(h.element('#evidence').innerHTML, '', 'the footer text of the page is left alone');
  assert.equal(h.element('#evidence').textContent, '');
  assert.equal(h.element('.frame').dataset.stage, 'lobby');
  h.emit(inRoom());
  assert.equal(h.element('.frame').dataset.stage, 'room');
  assert.equal(h.window.__SPACE_EVENT_QA__().poll.intervalMs, 5000);
  assert.equal(h.pollDelay(), 5000);
  h.controller.refreshRoom = async () => { throw new Error('offline'); };
  const delays = [];
  for (let i = 0; i < 4; i++) { await h.runPoll(); delays.push(h.pollDelay()); }
  assert.deepEqual(delays, [10000, 20000, 30000, 30000], 'backoff doubles from 5 s and stops at 30 s');
  h.controller.refreshRoom = async () => ({ applied: true });
  await h.runPoll();
  assert.equal(h.pollDelay(), 5000, 'a good poll returns to the base interval');
});

test('server profile: other query parameters stay, and a link with an extra key is still refused at boot', async () => {
  const joined = harness(initial(), 'https://musicspace.test/event/?v=1&keep=me#frag');
  await joined.controller.openRoom(roomId);
  assert.equal(joined.location.search, `?v=1&keep=me&room=${CODE}`, 'today\'s behaviour: room is added, nothing is removed');
  assert.equal(joined.location.hash, '#frag');
  joined.emit(initial({ room: null, route: { kind: 'home', target: null } }));
  assert.equal(joined.location.search, '?v=1&keep=me', 'leaving removes only room');

  const boot = harness(initial({ myRooms: { items: [room()], nextCursor: null } }), `https://musicspace.test/event/?v=1&room=${CODE}`);
  await boot.binding.boot();
  assert.equal(text(boot, '#toast'), '请使用当前 Music Space 的有效邀请链接或 12 位邀请码。');
  assert.equal(boot.calls.some(call => call[0] === 'openRoom' || call[0] === 'previewRoom'), false);
});

test('server profile: boot connects at once (there is no ready promise to wait for) and the demo hooks stay unregistered', async () => {
  const h = harness(initial());
  const booting = h.binding.boot();
  assert.ok(h.calls.some(call => call[0] === 'connect'), 'connect is called synchronously by boot()');
  await booting;
  assert.equal(serverProfile.demo, null);
});

test('static profile: controller options, status pill and landing wording come from the profile', () => {
  const profile = staticProfile();
  const lobby = harness(initial({ connection: 'connected' }), undefined, profile);
  assert.equal(lobby.calls.find(call => call[0] === 'createEventController')[1].fetch, 'STATIC FETCH');
  assert.equal(text(lobby, '#render-status'), 'STATIC READY');
  assert.equal(text(harness(initial({ connection: 'unknown' }), undefined, profile), '#render-status'), 'STATIC PREPARING');
  assert.equal(text(lobby, '#presence-title'), 'STATIC LOBBY TITLE');
  assert.equal(text(lobby, '#presence-copy'), 'STATIC LOBBY COPY');
  assert.equal(text(lobby, '#join'), 'STATIC JOIN LOBBY');
  assert.equal(text(lobby, '#track-note'), '进入房间，留下你看到的那个瞬间', 'with no room there is no song and no trackNote');

  const alone = harness(inRoom({ members: [me] }), undefined, profile);
  assert.equal(text(alone, '#presence-title'), 'STATIC ALONE TITLE');
  assert.equal(text(alone, '#presence-copy'), 'STATIC ALONE COPY');
  assert.equal(text(alone, '#join'), 'STATIC JOIN ROOM');
  assert.equal(text(alone, '#track-note'), 'STATIC TRACK NOTE');
  assert.equal(text(alone, '#render-status'), '1 位同场', 'the member count is not wording the profile owns');

  const together = harness(inRoom(), undefined, profile);
  assert.equal(text(together, '#presence-title'), 'STATIC ROOM TITLE');
  assert.equal(text(together, '#presence-copy'), 'STATIC ROOM COPY');
});

test('static profile: copy is read at render time and a missing key keeps the server wording', () => {
  let aiOn = true;
  const profile = staticProfile({ copy: { get presenceCopyLobby() { return aiOn ? 'WITH AI' : 'WITHOUT AI'; }, statusPreparing: undefined } });
  const h = harness(initial({ connection: 'unknown' }), undefined, profile);
  assert.equal(text(h, '#presence-copy'), 'WITH AI');
  aiOn = false;
  h.emit(initial({ connection: 'unknown' }));
  assert.equal(text(h, '#presence-copy'), 'WITHOUT AI', 'a getter is evaluated on every render');
  assert.equal(text(h, '#render-status'), '等待连接', 'an undefined copy value falls back to the server literal');
  const sparse = harness(initial(), undefined, { mode: 'static', controllerOptions: () => ({}), copy: { statusReady: 'ONLY THIS' }, demo: null });
  assert.equal(text(sparse, '#render-status'), 'ONLY THIS');
  assert.equal(text(sparse, '#join'), '带上小人，进入现场');
  const bare = harness(initial(), undefined, { mode: 'static', controllerOptions: () => ({}), demo: null });
  assert.equal(text(bare, '#render-status'), '房间服务已连接', 'a profile without a copy object behaves like the server profile');
});

test('static profile: the reconnect button, the reconnect toast and the non-http toast', async () => {
  // demo: null keeps the page's own entry panel (the example site swaps it for its entry form, which has no reconnect button).
  const profile = { ...staticProfile({ copy: { reconnectLabel: 'A & <B>' } }), demo: null };
  const offline = harness(initial({ connection: 'offline' }), undefined, profile);
  offline.binding.openPanel('entry');
  assert.ok(offline.body.innerHTML.includes('<button class="quiet" data-reconnect>A &amp; &lt;B&gt;</button>'), 'the label is escaped as HTML');
  await offline.click({ reconnect: '' });
  assert.equal(text(offline, '#toast'), 'STATIC RECONNECTED');
  const file = harness(initial(), 'file:///Users/someone/index.html', staticProfile({ ready: new Promise(() => {}) }));
  await file.binding.boot();
  assert.equal(text(file, '#toast'), 'STATIC NOT HTTP', 'a file: page does not wait for an in-page service that cannot start there');
});

test('static profile: the footer becomes the About button (escaped, not rewritten on every render)', () => {
  const h = harness(initial(), undefined, staticProfile({ copy: { evidenceButton: 'EVIDENCE <b>&' } }));
  assert.equal(h.element('#evidence').innerHTML, '<button type="button" data-open="about">EVIDENCE &lt;b&gt;&amp;</button>');
  const written = [];
  Object.defineProperty(h.element('#evidence'), 'innerHTML', { get: () => '', set: value => written.push(value) });
  h.emit(inRoom());
  h.emit(initial());
  assert.deepEqual(written, [], 'later renders leave the button (and its keyboard focus) alone');
  assert.equal(harness(initial(), undefined, staticProfile({ copy: { evidenceButton: undefined } })).element('#evidence').innerHTML, '<button type="button" data-open="about">关于这个示例</button>', 'a label is always present');
});

test('static profile: the room panel swaps the invite block for the demo markup and skips the QR code', () => {
  const profile = staticProfile();
  const h = harness(inRoom(), undefined, profile);
  h.window.NDEFReader = function NDEFReader() {};
  h.binding.openPanel('room');
  const html = h.body.innerHTML;
  assert.ok(html.includes(`</p><p class="demo-room-note">NOTE ${CODE}</p><div class="row">`), 'the demo markup sits where the invite block was');
  assert.deepEqual(profile.demo.seen.map(r => r.code), [CODE], 'it is asked for the current room');
  for (const gone of ['invite-code', 'invite-qr', 'data-copy-invite', 'data-write-nfc', 'invite-address', '二维码', 'NFC']) assert.ok(!html.includes(gone), `${gone} is not rendered`);
  assert.ok(html.includes('data-form="participation"') && html.includes('回看这一晚'), 'the rest of the panel is unchanged');
  assert.equal(h.calls.some(call => call[0] === 'qrcode'), false, 'no QR code is generated');
  assert.equal(h.element('#invite-qr').innerHTML, '');
  const empty = harness(inRoom(), undefined, staticProfile({ demo: { roomInviteMarkup: () => undefined } }));
  empty.binding.openPanel('room');
  assert.ok(!empty.body.innerHTML.includes('undefined') && !empty.body.innerHTML.includes('invite-code'));
});

test('static profile: no identity-backup button on any panel that used to offer one', () => {
  const h = harness(inRoom(), undefined, staticProfile());
  for (const kind of ['entry', 'profile', 'rooms', 'room']) {
    h.binding.openPanel(kind);
    if (kind !== 'entry') assert.ok(h.body.innerHTML.length > 0, `${kind} panel rendered`);
    assert.doesNotMatch(h.body.innerHTML, /identity-backup|备份或恢复我的小人身份/, `${kind} panel`);
  }
});

test('static profile: the frame carries data-stage lobby or room', async () => {
  const h = harness(initial(), undefined, staticProfile());
  assert.equal(h.element('.frame').dataset.stage, 'lobby');
  await h.controller.openRoom(roomId);
  assert.equal(h.element('.frame').dataset.stage, 'room');
  h.emit(initial());
  assert.equal(h.element('.frame').dataset.stage, 'lobby');
  h.emit(initial({ preview: { ...room(), code: CODE }, route: { kind: 'preview', target: CODE } }));
  assert.equal(h.element('.frame').dataset.stage, 'lobby', 'a previewed room is not a joined one');
});

test('static profile: the poll interval is copy.pollMs, doubles on failures and stops at 30 s', async () => {
  const h = harness(inRoom(), undefined, staticProfile());
  assert.equal(h.window.__SPACE_EVENT_QA__().poll.intervalMs, 2000);
  assert.equal(h.pollDelay(), 2000);
  await h.runPoll();
  assert.equal(h.pollDelay(), 2000, 'a good poll keeps the base interval');
  h.controller.refreshRoom = async () => { throw new Error('offline'); };
  const delays = [];
  for (let i = 0; i < 6; i++) { await h.runPoll(); delays.push(h.pollDelay()); }
  assert.deepEqual(delays, [4000, 8000, 16000, 30000, 30000, 30000]);
  h.controller.refreshRoom = async () => ({ applied: true });
  await h.runPoll();
  assert.equal(h.pollDelay(), 2000);
  const slow = harness(inRoom(), undefined, staticProfile({ copy: { pollMs: 7000 } }));
  assert.equal(slow.pollDelay(), 7000);
});

test('static profile: onWorldChanged is registered once and its callback refreshes the room at once', async () => {
  const profile = staticProfile();
  const h = harness(inRoom(), undefined, profile);
  assert.equal(profile.demo.listeners.length, 1, 'registered once at start-up');
  h.emit(inRoom());
  h.emit(initial());
  h.emit(inRoom());
  assert.equal(profile.demo.listeners.length, 1, 'renders do not register again');
  h.calls.length = 0;
  profile.demo.notifyChanged();
  await tick();
  assert.equal(h.calls.filter(call => call[0] === 'refreshRoom').length, 1, 'the world changed, so the room is read now, not at the next poll');
  assert.ok(h.pollDelay() > 0, 'and the regular poll is scheduled again');

  h.document.hidden = true;
  h.calls.length = 0;
  profile.demo.notifyChanged();
  await tick();
  assert.equal(h.calls.length, 0, 'a hidden tab does not read');

  const noHook = harness(inRoom(), undefined, staticProfile({ demo: { onWorldChanged: undefined } }));
  assert.ok(noHook.pollDelay() > 0, 'a demo without onWorldChanged still starts');
});

test('static profile: boot waits for profile.ready before the first API call', async () => {
  const ready = defer();
  const h = harness(initial(), undefined, staticProfile({ ready: ready.promise }));
  const booting = h.binding.boot();
  await tick();
  assert.equal(h.calls.some(call => call[0] === 'connect'), false, 'nothing is sent while the in-page service is still starting');
  ready.resolve();
  await booting;
  assert.equal(h.calls.filter(call => call[0] === 'connect').length, 1);
});

test('static profile: a rejected profile.ready shows its message and makes no API call', async () => {
  const ready = defer();
  ready.promise.catch(() => {});
  const h = harness(initial(), undefined, staticProfile({ ready: ready.promise }));
  const booting = h.binding.boot();
  ready.reject(new Error('示例现场没能启动'));
  await booting;
  assert.equal(text(h, '#toast'), '示例现场没能启动');
  assert.equal(h.calls.some(call => call[0] === 'connect' || call[0] === 'loadSocial' || call[0] === 'previewRoom'), false);
  const silent = defer();
  silent.promise.catch(() => {});
  const bare = harness(initial(), undefined, staticProfile({ ready: silent.promise }));
  const again = bare.binding.boot();
  silent.reject(new Error(''));
  await again;
  assert.equal(text(bare, '#toast'), '这次没有完成，请再试一次', 'an error without a message gets the product\'s generic sentence');
});

test('static profile: ?v=1&room=CODE becomes exactly ?room=CODE after joining, with other keys and the hash dropped', async () => {
  const h = harness(initial(), 'https://musicspace.test/musicSpace/?v=1&utm=x#frag', staticProfile());
  await h.controller.openRoom(roomId);
  assert.equal(h.location.search, `?room=${CODE}`);
  assert.equal(h.location.hash, '');
  assert.equal(h.location.pathname, '/musicSpace/');
  assert.equal(h.location.href, `https://musicspace.test/musicSpace/?room=${CODE}`);
  h.emit(initial({ room: null, route: { kind: 'home', target: null } }));
  assert.equal(h.location.search, '', 'leaving the room removes room');
  const clean = harness(initial(), `https://musicspace.test/musicSpace/?room=${CODE}`, staticProfile());
  await clean.controller.openRoom(roomId);
  assert.equal(clean.location.search, `?room=${CODE}`);
});

test('static profile: a boot with ?v=1&room=CODE re-enters the joined room', async () => {
  for (const url of [`https://musicspace.test/musicSpace/?v=1&room=${CODE}`, `https://musicspace.test/musicSpace/?room=${CODE}&utm_source=wechat#top`, `https://musicspace.test/musicSpace/?room=${CODE}`]) {
    const h = harness(initial({ myRooms: { items: [room()], nextCursor: null } }), url, staticProfile());
    await h.binding.boot();
    assert.deepEqual(h.calls.filter(call => call[0] === 'openRoom'), [['openRoom', roomId]], url);
    assert.equal(h.get().state.room.id, roomId, url);
    assert.equal(h.location.search, `?room=${CODE}`, `${url} is rewritten to the one key the invitation check accepts`);
    assert.equal(h.location.hash, '');
  }
});

test('static profile: a boot with an extra key and a room that is not joined yet opens the preview; a bad code is still refused', async () => {
  const h = harness(initial(), `https://musicspace.test/musicSpace/?v=1&room=${CODE}`, staticProfile());
  await h.binding.boot();
  assert.deepEqual(h.calls.filter(call => call[0] === 'previewRoom'), [['previewRoom', CODE]]);
  assert.equal(h.get().panelKind, 'preview');
  for (const bad of ['?v=1&room=short', '?v=1&room=', '?v=1&room=aaaaaaaaaaaa', '?v=1&room=AAAAAAAAAAA1']) {
    const g = harness(initial(), 'https://musicspace.test/musicSpace/' + bad, staticProfile());
    await g.binding.boot();
    assert.equal(text(g, '#toast'), '请使用当前 Music Space 的有效邀请链接或 12 位邀请码。', bad);
    assert.equal(g.calls.some(call => call[0] === 'previewRoom' || call[0] === 'openRoom'), false, bad);
  }
  const none = harness(initial(), 'https://musicspace.test/musicSpace/?v=1', staticProfile());
  await none.binding.boot();
  assert.equal(none.calls.some(call => call[0] === 'previewRoom' || call[0] === 'openRoom'), false, 'no room key, nothing to open');
});

test('static profile without keepRoomInUrl behaves like the server profile for the address', async () => {
  const h = harness(initial(), 'https://musicspace.test/musicSpace/?v=1#frag', staticProfile({ copy: { keepRoomInUrl: false } }));
  await h.controller.openRoom(roomId);
  assert.equal(h.location.search, `?v=1&room=${CODE}`);
  assert.equal(h.location.hash, '#frag');
  const boot = harness(initial(), `https://musicspace.test/musicSpace/?v=1&room=${CODE}`, staticProfile({ copy: { keepRoomInUrl: false } }));
  await boot.binding.boot();
  assert.equal(text(boot, '#toast'), '请使用当前 Music Space 的有效邀请链接或 12 位邀请码。');
});
