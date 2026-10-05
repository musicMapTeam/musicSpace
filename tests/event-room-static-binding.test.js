// How web/event-room/app.js wires the example-site (static profile) modules and the photo modules: the demo entry, the About panel, the 「同一刻」 wall,
// the AI upload form, the tour card and the warm-up. Same bounded shell as tests/event-room-binding.test.js: app.js runs in a vm after its
// single-line imports are deleted and replaced by injected globals. Here the photo modules (moment-upload, moment-wall, moment-model) and the
// example-site hooks (createDemoProfile, createCopy) are the REAL ones; only the browser (DOM, controller, 3D scene, the on-device model) is a
// stand-in. These are callback, state and markup checks, NOT browser/WebGL/visual QA.
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
import { createMomentUpload } from '../web/event-room/moment-upload.js';
import { wallMarkup } from '../web/event-room/moment-wall.js';
import { photoMetaLine, wallReadings } from '../web/event-room/moment-model.js';
import { profile as serverProfile } from '../web/event-room/runtime-profile.js';
import { createDemoProfile } from '../web/static-runtime/showcase/demo-hooks.js';
import { createCopy } from '../web/static-runtime/showcase/copy.js';
import { getViewpointAI } from '../web/js/ai/space-ai.js';
import { venueTime } from '../web/js/moment.js';

const source = readFileSync(new URL('../web/event-room/app.js', import.meta.url), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
const tick = () => new Promise(resolve => setImmediate(resolve));
const settle = async (rounds = 8) => { for (let i = 0; i < rounds; i++) await tick(); };
const defer = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
async function until(check, label = 'condition', limit = 2000) {
  const started = Date.now();
  while (!check()) {
    if (Date.now() - started > limit) throw new Error(`timed out waiting for ${label}`);
    await tick();
  }
}

const actor = '00000000-0000-4000-8000-000000000001';
const roomId = '00000000-0000-4000-8000-000000000002';
const YAO = '00000000-0000-4000-8000-0000000000a1';
const MAN = '00000000-0000-4000-8000-0000000000a2';
const BEI = '00000000-0000-4000-8000-0000000000a3';
const CODE = 'AAAAAAAAAAAA';
const EVENT_DATE = '2026.09.26';
const night = (hour, minute, second = 0) => venueTime(2026, 9, 26, hour, minute, second);
const room = (extra = {}) => ({ id: roomId, code: CODE, title: '回声现场 · 示例场', venue: '月台 Livehouse（虚构场地）', role: 'member', joined: true, revision: 1, status: 'open', createdAt: '2026-09-26T08:00:00.000Z', songId: 'late-train', ...extra });
const me = { id: actor, name: '访客1234', participation: 'open' };
const cast = [{ id: YAO, name: '阿遥·示例', participation: 'open' }, { id: MAN, name: '小满·示例', participation: 'open' }, { id: BEI, name: '北屿·示例', participation: 'open' }];
const photoId = n => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
/** A room photo as the room API returns it, with the four moment facts. */
const shot = (n, ownerId, at, viewpoint, extra = {}) => ({
  id: photoId(n), roomId, ownerId, visibility: 'members', revision: 1, createdAt: `2026-09-26T13:${String(50 + n).padStart(2, '0')}:00.000Z`,
  takenAt: at ? night(...at) : null, takenSource: at ? 'manual' : null, viewpoint: viewpoint || null, viewpointSource: viewpoint ? 'manual' : null, ...extra,
});
const seeded = () => [shot(1, YAO, [21, 47, 20], 'stage'), shot(2, MAN, [21, 48, 5], 'crowd'), shot(3, BEI, [21, 49, 30], 'detail'), shot(4, MAN, [22, 21, 10], 'friends')];

function initial(extra = {}) {
  return { connection: 'connected', identity: { status: 'ready', user: { id: actor, name: me.name, avatar: DEFAULT_AVATAR, revision: 1 } }, route: { kind: 'home', target: null }, room: null, preview: null, members: [], photos: [], myPhotos: { items: [], nextCursor: null }, myRooms: { items: [], nextCursor: null }, drafts: { photo: null, profile: null, room: null }, draftVersions: { photo: 0, profile: 0, room: 0 }, dirty: { photo: false, profile: false, room: false }, pending: [], loading: [], storage: { ok: true, refreshRecovery: true }, error: null, ...extra };
}
const lobby = (extra = {}) => initial({ identity: { status: 'missing', user: null }, ...extra });
const inRoom = (extra = {}) => initial({ room: room(), route: { kind: 'room', target: roomId }, members: [me, ...cast], photos: seeded(), ...extra });

// ---- the page stand-in --------------------------------------------------------------------------------------------------------
function element() {
  const events = new Map();
  const node = {
    events, hidden: false, innerHTML: '', textContent: '', scrollTop: 0, dataset: {}, isConnected: true, children: [], id: '', classList: { add() {}, remove() {}, toggle() {} },
    addEventListener(type, fn) { const list = events.get(type) || []; list.push(fn); events.set(type, list); }, setAttribute() {}, removeAttribute() {}, focus() {},
    append(...nodes) { node.children.push(...nodes); }, prepend(...nodes) { node.children.unshift(...nodes); }, remove() {}, querySelector() { return null; }, querySelectorAll() { return []; },
  };
  return node;
}
const camel = name => name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
/** A clicked element: closest('[data-x]') finds it when it carries data-x. */
function control(dataset = {}) {
  const node = { dataset, closest(selector) { const key = /^\[data-([a-z-]+)\]$/.exec(selector)?.[1]; return key && camel(key) in dataset ? node : selector === 'button' ? node : null; } };
  return node;
}

// ---- a browser that can draw and a model the test steers (as tests/event-moment-upload.test.js does) ----------------------------
globalThis.createImageBitmap = async () => ({ width: 1200, height: 800, close() {} });
globalThis.document = {
  baseURI: 'https://musicspace.test/musicSpace/',
  createElement() { const canvas = { width: 0, height: 0, getContext: () => ({ drawImage() {} }), toDataURL: () => `data:image/jpeg;base64,${'A'.repeat(1200)}` }; return canvas; },
};
function installModel() {
  const model = getViewpointAI();
  const control = { supported: true, status: 'idle', progress: { loaded: 0, total: 0 }, result: { ok: true, sure: true, label: 'crowd', top2: ['crowd', 'stage'] }, loads: 0, classified: 0 };
  Object.assign(model, {
    supported: () => control.supported,
    whyUnsupported: () => (control.supported ? null : 'browser'),
    status: () => (control.supported ? control.status : 'unsupported'),
    progress: () => ({ ...control.progress }),
    load() { control.loads += 1; control.status = 'ready'; return Promise.resolve(); },
    async classify() { control.classified += 1; return control.result; },
  });
  return control;
}
const model = installModel();
const SAMPLE_FILES = {
  'sample-crowd': () => new File([readFileSync(new URL('../web/static-runtime/demo-assets/sample-crowd.jpg', import.meta.url))], 'sample-crowd.jpg', { type: 'image/jpeg' }),
  'sample-stage': () => new File([readFileSync(new URL('../web/static-runtime/demo-assets/sample-stage.jpg', import.meta.url))], 'sample-stage.jpg', { type: 'image/jpeg' }),
};
const SAMPLES = [
  { id: 'sample-crowd', label: '人海 · 示例照片', note: '虚构的拍摄时间', thumbUrl: './demo/sample-crowd.jpg' },
  { id: 'sample-stage', label: '舞台 · 示例照片', note: '虚构的拍摄时间', thumbUrl: './demo/sample-stage.jpg' },
];
// The sample's own EXIF time (written into the shipped JPEG): stage 21:47:50, crowd 21:48:10, Beijing time.
const SAMPLE_TIME = { 'sample-crowd': night(21, 48, 10), 'sample-stage': night(21, 47, 50) };

/** The example-site hooks as the page gets them: the real createDemoProfile over a fake world, plus a record of what the page asked of it. */
function makeProfile({ ready, overrides = {} } = {}) {
  const seen = { resets: [], tours: [], syncs: [], entered: [] };
  const flags = { persistent: true, readOnly: false };
  const demo = createDemoProfile({
    getWorld: () => ({ room: { id: roomId, code: CODE }, people: Object.fromEntries(cast.map((person, index) => [`npc${index}`, { id: person.id, npc: { name: person.name } }])) }),
    eventDate: EVENT_DATE, samples: SAMPLES, loadSample: async id => SAMPLE_FILES[id](), reset: async () => { seen.resets.push(true); },
    build: { version: '0.21.0-test', commit: 'abc1234', builtAt: '2026-10-05T12:00:00.000Z' }, channel: 'preview', persistent: () => flags.persistent, readOnly: () => flags.readOnly, ready, random: () => 0.25,
  });
  const realEnter = demo.enter, realSync = demo.syncEntry;
  demo.enter = (values, controller) => { seen.entered.push(clone(values)); return realEnter(values, controller); };
  demo.syncEntry = root => { const done = realSync(root); seen.syncs.push(done); return done; };
  Object.assign(demo, overrides);
  return { profile: { mode: 'static', controllerOptions: () => ({}), copy: createCopy({ aiAvailable: () => true }), demo, ready: Promise.resolve() }, demo, seen, flags };
}

function harness({ start = inRoom(), url = 'https://musicspace.test/musicSpace/', profile = makeProfile().profile, confirms = true, exchange = {}, uploadFails = false } = {}) {
  let current = clone(start), subscriber, nextTimer = 0;
  const elements = new Map(), doc = element(), window = element(), calls = [], drafts = [], timers = new Map(), confirmed = [], created = { exchange: [], elements: [] };
  const get = selector => { if (!elements.has(selector)) elements.set(selector, element()); return elements.get(selector); };
  window.location = { reload() { calls.push(['reload']); } };
  doc.querySelector = get; doc.querySelectorAll = () => []; doc.hidden = false; doc.activeElement = element();
  doc.createElement = () => { const node = element(); created.elements.push(node); return node; };
  const body = get('#panel-body');
  let html = '', writes = 0;
  Object.defineProperty(body, 'innerHTML', { get: () => html, set: value => { writes += 1; html = String(value); }, configurable: true });
  const emit = next => { current = clone(next); subscriber?.(clone(current)); };
  const controller = {
    getState: () => clone(current), subscribe(fn) { subscriber = fn; fn(clone(current)); return () => {}; },
    setDraft(kind, value) { current.drafts[kind] = clone(value); current.draftVersions[kind]++; current.dirty[kind] = true; drafts.push([kind, clone(value)]); emit(current); },
    async connect() { calls.push(['connect']); return { applied: true }; }, async loadSocial() { return { applied: true }; }, async loadSocialPeer() { return { applied: true }; }, async loadMyRooms() { return { applied: true }; }, async loadMyPhotos() { return { applied: true }; },
    async establishIdentity(value) { calls.push(['establishIdentity', clone(value)]); emit({ ...current, identity: { status: 'ready', user: { id: actor, name: value.name, avatar: value.avatar, revision: 1 } } }); return { applied: true }; },
    async previewRoom(code) { calls.push(['previewRoom', code]); emit({ ...current, route: { kind: 'preview', target: code }, room: null, preview: { ...room({ joined: false }), code } }); return { applied: true, preview: current.preview }; },
    async joinRoom(code, options) { calls.push(['joinRoom', code, clone(options)]); emit({ ...current, route: { kind: 'room', target: roomId }, room: room(), preview: null, members: [me, ...cast], photos: seeded() }); return { applied: true, room: current.room, actorId: actor }; },
    async openRoom(id) { calls.push(['openRoom', id]); emit({ ...current, route: { kind: 'room', target: id }, room: room() }); return { applied: true }; },
    async refreshRoom() { calls.push(['refreshRoom']); return { applied: true }; }, async fetchPhotoBlob(id) { calls.push(['fetchPhotoBlob', id]); return new Blob(['synthetic'], { type: 'image/jpeg' }); },
    async loadRoomRecap(id) { calls.push(['loadRoomRecap', id]); return { applied: true }; }, clearRoomRecap() {},
    async uploadPhoto(dataUrl, visibility, options) { calls.push(['uploadPhoto', dataUrl, visibility, clone(options)]); if (uploadFails) throw Object.assign(new Error('offline'), { code: 'NETWORK' }); return { applied: true }; },
    retry: async id => ({ operationId: id, applied: false }), cancel() {}, dispose() {}, setPhotoVisibility: async () => ({ applied: true }), removePhoto: async () => ({ applied: true }), leaveRoom: async () => ({ applied: true }), closeRoom: async () => ({ applied: true }), createRoom: async () => ({ applied: true }),
  };
  class SafeURL extends URL { static createObjectURL() { return 'blob:synthetic-' + Math.random(); } static revokeObjectURL() {} }
  const location = new URL(url), history = { replaceState(_a, _b, next) { location.href = String(next); } };
  const engine = { ready: Promise.resolve(), update() {}, goTo() {}, getState: () => ({ view: 'overview' }), setReducedMotion(value) { calls.push(['reducedMotion', value]); }, dispose() {}, pick() { return null; } };
  const exchangeState = { state: exchange };
  const context = vm.createContext({
    console, document: doc, window, location, history, navigator: { clipboard: { writeText: async () => {} } }, URL: SafeURL, Blob, confirm: message => { confirmed.push(message); return confirms; },
    invitation, invitationUrl, nfcInvitation, createMusicMap: () => ({ open() {}, close() {}, syncIdentity() {}, dispose() {} }), createPersonalSpace: () => ({ open: async () => {}, close() {}, syncIdentity() {}, dispose() {} }), createCornerPanel: () => ({ open: async () => {}, close() {}, syncIdentity() {}, dispose() {} }), createIdentityContinuityPanel: () => ({ open() {}, close() {}, dispose() {} }),
    createCommunityPanel: () => ({ open: async () => {}, close() {}, syncIdentity() {}, dispose() {} }), createWorldCupPanel: () => ({ open: async () => {}, close() {}, syncIdentity() {}, dispose() {} }),
    createMusicGames: () => ({ open: async () => {}, close() {}, syncIdentity() {}, dispose() {} }), createMusicTopics: () => ({ open: async () => {}, close() {}, syncIdentity() {}, dispose() {} }), createSpaceManagement: () => ({ open: async () => {}, close() {}, syncIdentity() {}, dispose() {} }),
    createModerationPanel: () => ({ close() {}, syncIdentity() {}, refresh: async () => {}, dispose() {} }),
    createExchangePanel: options => { created.exchange.push(options); return { open: async () => {}, openOffer: async photo => calls.push(['exchangeOffer', clone(photo)]), close() {}, syncIdentity() {}, refresh: async () => {}, invalidate() {}, getState: () => exchangeState.state, dispose() {} }; },
    matchMedia: () => ({ matches: false, addEventListener() {} }), setTimeout: (callback, delay) => { const id = ++nextTimer; timers.set(id, { callback, delay }); return id; }, clearTimeout: id => timers.delete(id),
    createEventController: () => controller, profile, mountLivehouseScene: () => engine,
    memberFloorPositions, layoutSceneLabels, renderAvatarSvg, recapMarkup, createMemoryCardExporter, memoryCardMarkup, renderMemoryCardPng, saveMemoryCardDownload, createMomentUpload, wallMarkup, photoMetaLine, wallReadings,
    AbortController, venueAssetUrl: 'data:model/gltf-binary;base64,c3ludGhldGlj', SESSION_KEY: 'music-space-avatar-session:v1', DEFAULT_AVATAR, SKINS, HAIRS, GARMENT_COLORS, SONGS, safeAvatar, esc,
    qrcode: () => { calls.push(['qrcode']); return { addData() {}, make() {}, createSvgTag: () => '<svg></svg>' }; },
    FormData: class { constructor(form) { this.values = form.values || {}; } get(key) { return this.values[key] ?? null; } getAll(key) { const v = this.values[key]; return v === undefined ? [] : Array.isArray(v) ? v : [v]; } },
  });
  const code = source.replace(/^import .*;$/gm, '').replace('void boot();', '');
  vm.runInContext(code + `\nglobalThis.binding={openPanel,closePanel,renderPanel,uploadHtml,momentUpload,tourAction,get:()=>({state,panelKind,panelTarget,photoDraft,lastPanelMarkup,warmedUp,openedRecap,tour}),setPhotoDraft:value=>{photoDraft=value;}};`, context, { filename: 'event-room-static-binding.vm.js' });
  const binding = context.binding;
  return {
    controller, calls, drafts, emit, window, document: doc, element: get, body, binding, created, confirmed, writes: () => writes, html: () => html, get: () => binding.get(), presence: get('.presence'),
    setExchange(next) { exchangeState.state = next; },
    async click(dataset) { const button = { dataset, closest(selector) { return selector === 'button' ? this : null; } }; for (const fn of doc.events.get('click') || []) await fn({ target: button }); await tick(); },
    /** The panel body's own delegated listeners (the upload module's), as the browser would call them. */
    fire(type, target, extra = {}) { for (const fn of body.events.get(type) || []) fn({ type, target, ...extra }); },
    submit(kind, values = {}, dataset = {}) { const form = { dataset: { form: kind, ...dataset }, values, setAttribute() {}, removeAttribute() {}, querySelectorAll: () => [] }; for (const fn of body.events.get('submit') || []) fn({ preventDefault() {}, target: form }); return form; },
    pickSample: id => binding.momentUpload.pickSample(id),
    pick: file => binding.momentUpload.pick(file),
  };
}
const text = (h, selector) => h.element(selector).textContent;
const plain = html => html.replace(/<[^>]*>/g, '');
const stateOf = h => h.get().state;

// ============================================================================================================================
// the example-site entry and About
// ============================================================================================================================
test('the lobby entry is the example entry: one consent box, no invite code, and no identity backup', () => {
  const { profile } = makeProfile();
  const h = harness({ start: lobby(), profile });
  h.binding.openPanel('entry');
  const html = h.html();
  assert.match(html, /<form data-form="demo-entry"/);
  assert.doesNotMatch(html, /data-form="preview"|name="code"|identity-backup|备份或恢复/, 'the invitation-code form and the backup button belong to the room server');
  const consent = html.match(/<input name="consent"[^>]*>/)?.[0];
  assert.ok(consent && /required/.test(consent) && !/checked/.test(consent), 'the consent box is required and starts unticked');
  assert.match(html, /name="participation" value="open" checked/, 'open participation is the default');
  assert.match(html, /虚构/, 'the entry says the cast is fictional');
  assert.equal(h.element('.frame').dataset.stage, 'lobby');
});

test('an operation left unconfirmed (a join cut short by a reload) is still reachable from the example entry', () => {
  const h = harness({ start: lobby({ pending: [{ id: 'op-1', type: 'joinRoom', status: 'uncertain', durable: true }] }), profile: makeProfile().profile });
  h.binding.openPanel('entry');
  assert.match(h.html(), /data-open="pending"[^>]*>1 个操作待确认/);
  const clean = harness({ start: lobby(), profile: makeProfile().profile });
  clean.binding.openPanel('entry');
  assert.doesNotMatch(clean.html(), /data-open="pending"/);
});

test('a joined visitor who opens the entry panel still gets the page\'s own entry (the example form is for the lobby)', () => {
  const h = harness({ start: inRoom() });
  h.binding.openPanel('entry');
  assert.match(h.html(), /data-form="preview"/);
  assert.doesNotMatch(h.html(), /demo-entry/);
});

test('while the example world is still being built the entry button is disabled; when it is ready the open form is patched in place, not redrawn', async () => {
  const gate = defer();
  const { profile, seen } = makeProfile({ ready: gate.promise });
  const h = harness({ start: lobby(), profile });
  h.binding.openPanel('entry');
  assert.match(h.html(), /<button class="primary" type="submit" disabled>/, 'no join while the example world is not ready');
  const submit = { disabled: true }, status = { textContent: '正在布置示例现场…' };
  h.body.querySelector = selector => (selector === "form[data-form='demo-entry']" ? { querySelector: inner => (inner === "button[type='submit']" ? submit : inner === '.demo-entry-status' ? status : null) } : null);
  const writes = h.writes();
  gate.resolve();
  await settle();
  assert.deepEqual(seen.syncs, [true], 'the page asked the demo to patch the open form');
  assert.equal(submit.disabled, false);
  assert.equal(status.textContent, '');
  assert.equal(h.writes(), writes, 'what the visitor typed in the form is not thrown away');
  h.binding.renderPanel(false);
  assert.equal(h.writes(), writes, 'and a later render of the same panel does not redraw it either (the page\'s copy of the markup is in sync)');
});

test('the entry submit passes consent false unless the box is ticked, and then nothing is sent', async () => {
  const { profile, seen } = makeProfile();
  const h = harness({ start: lobby(), profile });
  h.binding.openPanel('entry');
  h.submit('demo-entry', { name: '小客', participation: 'open' });
  await settle();
  assert.deepEqual(seen.entered.map(values => values.consent), [false]);
  assert.equal(h.calls.some(([method]) => ['establishIdentity', 'previewRoom', 'joinRoom'].includes(method)), false, 'no identity, preview or join without consent');
  assert.match(text(h, '#toast'), /勾选|愿意/, 'the refusal is said, not swallowed');
});

test('a ticked entry creates the identity once, previews the example room, joins with consent and the chosen participation, and closes the panel', async () => {
  const { profile, demo, seen } = makeProfile();
  const h = harness({ start: lobby(), profile });
  h.binding.openPanel('entry');
  h.submit('demo-entry', { name: '小客', participation: 'quiet', consent: 'on' });
  await settle();
  assert.deepEqual(seen.entered, [{ name: '小客', avatar: safeAvatar(demo.defaultAvatar), participation: 'quiet', consent: true }], 'the random look the form started with goes in');
  assert.deepEqual(h.calls.filter(([method]) => ['establishIdentity', 'previewRoom', 'joinRoom'].includes(method)).map(call => call[0]), ['establishIdentity', 'previewRoom', 'joinRoom']);
  assert.deepEqual(h.calls.find(([method]) => method === 'joinRoom').slice(1), [CODE, { joinConsent: true, participation: 'quiet' }]);
  assert.equal(h.get().panelKind, null, 'the entry panel is closed once the visitor is in');
  assert.equal(stateOf(h).room.id, roomId);
  assert.equal(h.element('.frame').dataset.stage, 'room');
});

test('the look picked in the wardrobe (a saved profile draft) is the one the entry creates the identity with', async () => {
  const look = { ...DEFAULT_AVATAR, hair: 7 };
  const { profile, seen } = makeProfile();
  const h = harness({ start: lobby({ drafts: { photo: null, profile: { name: '换装的人', avatar: look }, room: null } }), profile });
  h.binding.openPanel('entry');
  h.submit('demo-entry', { name: '换装的人', participation: 'open', consent: 'on' });
  await settle();
  assert.deepEqual(seen.entered[0].avatar, safeAvatar(look));
  assert.deepEqual(h.calls.find(([method]) => method === 'establishIdentity')[1].avatar, safeAvatar(look));
});

test('a browser that already holds an identity walks in with it: no second identity is created', async () => {
  const { profile } = makeProfile();
  const h = harness({ start: initial(), profile });
  h.binding.openPanel('entry');
  h.submit('demo-entry', { name: me.name, participation: 'open', consent: 'on' });
  await settle();
  assert.equal(h.calls.some(([method]) => method === 'establishIdentity'), false);
  assert.ok(h.calls.some(([method]) => method === 'joinRoom'));
});

test('the room panel of the example site has no code, no QR, no link and no NFC; the About link is there instead', () => {
  const { profile } = makeProfile();
  const h = harness({ start: inRoom(), profile });
  h.window.NDEFReader = function NDEFReader() {};
  h.binding.openPanel('room');
  const html = h.html();
  for (const gone of ['invite-code', 'invite-qr', 'data-copy-invite', 'data-write-nfc', 'invite-address', '二维码', 'NFC', 'identity-backup']) assert.ok(!html.includes(gone), `${gone} is not rendered`);
  assert.match(html, /demo-room-note/);
  assert.match(html, /data-open="about"/);
  assert.equal(h.calls.some(([method]) => method === 'qrcode'), false);
});

test('the footer About button opens the About panel: the seven sections, the build stamp and a reset button that carries its own question', async () => {
  const { profile } = makeProfile();
  const h = harness({ start: inRoom(), profile });
  assert.equal(h.element('#evidence').innerHTML.includes('data-open="about"'), true);
  await h.click({ open: 'about' });
  assert.equal(h.get().panelKind, 'about');
  const html = h.html();
  for (const id of ['what', 'cast', 'photos', 'ai', 'rules', 'data', 'version']) assert.match(html, new RegExp(`data-about="${id}"`), `section ${id}`);
  assert.match(html, /0\.21\.0-test/);
  assert.match(html, /预览版/, 'a preview build says so');
  assert.match(html, /data-demo-reset[^>]*data-confirm="[^"]+"/);
  assert.match(html, /阿遥·示例/, 'the cast is named, with the 「·示例」 mark');
});

test('the About panel is drawn again when what it reports changes (the browser stopped saving)', () => {
  const { profile, flags } = makeProfile();
  const h = harness({ start: inRoom(), profile });
  h.binding.openPanel('about');
  assert.doesNotMatch(h.html(), /没有让这里保存数据/);
  flags.persistent = false;
  h.emit(inRoom());
  assert.match(h.html(), /没有让这里保存数据/);
});

test('reset asks first: a refusal does nothing, an agreement resets once, a failure is shown', async () => {
  const refused = makeProfile();
  const a = harness({ start: inRoom(), profile: refused.profile, confirms: false });
  a.binding.openPanel('about');
  const question = a.html().match(/data-confirm="([^"]+)"/)[1];
  await a.click({ demoReset: '', confirm: question });
  assert.deepEqual(a.confirmed, [question], 'the question on the button is the one asked');
  assert.equal(refused.seen.resets.length, 0);

  const agreed = makeProfile();
  const b = harness({ start: inRoom(), profile: agreed.profile, confirms: true });
  b.binding.openPanel('about');
  await b.click({ demoReset: '', confirm: question });
  await settle();
  assert.equal(agreed.seen.resets.length, 1);

  const broken = makeProfile({ overrides: { reset: async () => { throw new Error('这个示例现在不能重置。'); } } });
  const c = harness({ start: inRoom(), profile: broken.profile, confirms: true });
  c.binding.openPanel('about');
  await c.click({ demoReset: '', confirm: question });
  await settle();
  assert.equal(text(c, '#toast'), '这个示例现在不能重置。');
});

test('the people list labels the cast as example characters; the server profile adds no label', () => {
  const { profile } = makeProfile();
  const h = harness({ start: inRoom(), profile });
  h.binding.openPanel('people');
  const html = h.html();
  assert.equal((html.match(/<small class="cast-badge">示例角色 · 自动回复<\/small>/g) || []).length, 3, 'one label per cast member');
  const server = harness({ start: inRoom(), profile: serverProfile });
  server.binding.openPanel('people');
  assert.doesNotMatch(server.html(), /cast-badge/);
  assert.match(server.html(), /<b>阿遥·示例<\/b>/, 'the server markup is the old one, byte for byte');
});

test('alone in a browser-local room the people panel does not tell the visitor to invite friends', () => {
  const { profile } = makeProfile();
  const h = harness({ start: inRoom({ members: [me], photos: [] }), profile });
  h.binding.openPanel('people');
  assert.doesNotMatch(h.html(), /邀请同场朋友|把邀请发给他们/);
  assert.match(h.html(), /data-open="upload"/);
  const server = harness({ start: inRoom({ members: [me], photos: [] }), profile: serverProfile });
  server.binding.openPanel('people');
  assert.match(server.html(), /邀请同场朋友/, 'the room server still sends invitations');
});

// ============================================================================================================================
// the wall by moment
// ============================================================================================================================
test('the wall groups by capture time, marks the other side for the viewer and offers the exchange from that button', async () => {
  const mine = shot(9, actor, [21, 48, 10], 'crowd', { visibility: 'members' });
  const { profile } = makeProfile();
  const h = harness({ start: inRoom({ photos: [...seeded(), mine] }), profile });
  h.binding.openPanel('wall');
  const html = h.html();
  assert.match(html, /data-moment-wall/);
  assert.ok(plain(html).includes('21:47 · 同一刻 · 3 个视角：舞台 · 人海 · 细节'), 'the night\'s first group, titled by its time and the sides in it');
  assert.equal((html.match(/data-moment-group="/g) || []).length, 2, 'the 22:21 photo is a group of its own');
  assert.match(html, /同一刻的另一面/);
  const offered = [...html.matchAll(/data-exchange-offer="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(offered, [photoId(1)], 'the stage photo is the best other side of a crowd photo taken 50 seconds apart');
  assert.match(html, /和 TA 交换这个视角/);
  assert.ok(html.indexOf('data-moment-group="m') < html.indexOf(`data-photo="${photoId(1)}"`), 'the photo buttons are app.js\'s own, inside the groups');
  assert.ok(plain(html).includes('拍摄于 21:47 · 视角：舞台 · 作者选择'), 'every photo says when it was taken and who chose its side');
  assert.doesNotMatch(html, /moment-ribbon/, 'no AI ribbon: no photo here carries a side the model suggested');
  await h.click({ exchangeOffer: photoId(1) });
  assert.equal(h.calls.find(([method]) => method === 'exchangeOffer')[1].id, photoId(1), 'the existing exchange route gets exactly that photo');
});

test('a photo whose exchange is already open is not offered again; the mark moves to the next other side', () => {
  const mine = shot(9, actor, [21, 48, 10], 'crowd');
  const exchange = { list: { items: [{ id: 'x1', status: 'pending', senderId: actor, recipientId: YAO, offeredPhotoId: mine.id, requestedPhotoId: photoId(1) }] }, current: null };
  const { profile } = makeProfile();
  const h = harness({ start: inRoom({ photos: [...seeded(), mine] }), profile, exchange });
  h.binding.openPanel('wall');
  assert.deepEqual([...h.html().matchAll(/data-exchange-offer="([^"]+)"/g)].map(match => match[1]), [photoId(3)], 'the detail photo is the next other side');
  assert.match(h.html(), /已有交换/);
});

test('the AI ribbon appears only when a photo carries a side the person kept from the model', () => {
  const kept = shot(9, actor, [21, 48, 10], 'crowd', { viewpointSource: 'ai' });
  const h = harness({ start: inRoom({ photos: [...seeded(), kept] }), profile: makeProfile().profile });
  h.binding.openPanel('wall');
  assert.match(h.html(), /data-moment-ribbon/);
  assert.ok(plain(h.html()).includes('AI 建议，未改动'));
});

test('without any capture time the wall is exactly today\'s plain grid, in both profiles', () => {
  const plain = ['a', 'b'].map((_, index) => ({ id: photoId(50 + index), roomId, ownerId: index ? YAO : actor, visibility: 'members', revision: 1 }));
  for (const profile of [serverProfile, makeProfile().profile]) {
    const h = harness({ start: inRoom({ photos: plain }), profile });
    h.binding.openPanel('wall');
    const html = h.html();
    assert.match(html, /<div class="photo-grid"><button class="photo-item" data-photo="[^"]+"><span>正在读取照片…<\/span><strong>[^<]+<\/strong><small>照片墙：本场成员可见<\/small><\/button><button class="photo-item"/);
    assert.doesNotMatch(html, /moment-wall|moment-group|data-exchange-offer/);
    assert.match(html, /刷新照片/);
    assert.match(html, /放上我的一张/);
    assert.match(html, /照片墙只按本场范围展示/);
  }
  const none = harness({ start: inRoom({ photos: [] }), profile: serverProfile });
  none.binding.openPanel('wall');
  assert.match(none.html(), /<div class="empty"><b>还没有照片。<\/b><p>别急，今晚总有一个瞬间值得留下。<\/p><\/div>/);
});

test('library and recap photos and the photo detail carry the meta line; a photo without facts gets nothing extra', () => {
  const timed = shot(7, actor, [21, 47, 50], 'stage', { viewpointSource: 'ai' });
  const bare = { id: photoId(8), roomId, ownerId: actor, visibility: 'private', revision: 1 };
  const h = harness({ start: inRoom({ myPhotos: { items: [timed, bare], nextCursor: null } }), profile: makeProfile().profile });
  h.binding.openPanel('library');
  const html = h.html();
  assert.match(html, new RegExp(`data-photo="${photoId(7)}">.*?<small class="moment-meta">拍摄于 21:47 · 视角：舞台 · AI 建议，未改动</small></button>`));
  assert.match(html, new RegExp(`data-photo="${photoId(8)}"><span>[^<]*</span><strong>[^<]*</strong><small>[^<]*</small></button>`), 'no empty meta element');
  h.binding.openPanel('photo', photoId(7));
  assert.match(h.html(), /的视角<\/h2><p class="moment-meta">拍摄于 21:47 · 视角：舞台 · AI 建议，未改动<\/p>/);
  h.binding.openPanel('photo', photoId(8));
  assert.doesNotMatch(h.html(), /moment-meta/);
});

test('the event day is the profile\'s fixed night in the example site and the room\'s creation day in Beijing time on the room server', () => {
  const late = '2026-09-26T17:00:00.000Z';   // 2026-09-27 01:00 in Beijing
  const first = harness({ start: inRoom({ room: room({ createdAt: late }) }), profile: makeProfile().profile });
  const second = harness({ start: inRoom({ room: room({ createdAt: late }) }), profile: serverProfile });
  const third = harness({ start: inRoom({ room: room({ createdAt: '2026-09-26T13:47:20.000Z' }) }), profile: serverProfile });
  assert.equal(first.created.exchange[0].getContext().eventDate, EVENT_DATE);
  assert.equal(second.created.exchange[0].getContext().eventDate, '2026.09.27');
  assert.equal(third.created.exchange[0].getContext().eventDate, '2026.09.26');
});

test('the exchange panel polls at the profile\'s own cadence and is told the event day', () => {
  const staticPage = harness({ start: inRoom(), profile: makeProfile().profile });
  assert.equal(staticPage.created.exchange[0].pollMs, 2000);
  const serverPage = harness({ start: inRoom(), profile: serverProfile });
  assert.equal(serverPage.created.exchange[0].pollMs, 5000);
});

// ============================================================================================================================
// the upload form
// ============================================================================================================================
const TIMED_BY_MODEL = { ok: true, sure: true, label: 'crowd', top2: ['crowd', 'stage'] };
const UNSURE = { ok: true, sure: false, label: 'stage', top2: ['stage', 'crowd'] };
async function openedUpload(options = {}) {
  const h = harness({ profile: makeProfile().profile, ...options });
  h.binding.openPanel('upload');
  return h;
}

test('the upload panel is the module\'s form: sample buttons, the time card, the viewpoint chips, and a disabled save until there is a photo', async () => {
  const h = await openedUpload();
  const html = h.html();
  assert.match(html, /<form class="moment-upload" data-form="upload" data-room="00000000-0000-4000-8000-000000000002" novalidate>/);
  assert.match(html, /data-sample-photo="sample-crowd"[^>]*>[\s\S]*data-sample-photo="sample-stage"/, 'the crowd photo comes first');
  assert.match(html, /name="photo" accept="image\/jpeg,image\/png,image\/webp"/);
  assert.equal((html.match(/data-moment-viewpoint="/g) || []).length, 4);
  assert.match(html, /type="submit" disabled/);
  assert.match(html, /data-demo-time/, 'the demo-only time button is there for a photo of one\'s own');
  assert.match(html, /只保存在这个浏览器里/, 'the example site says where the photo stays');
  assert.doesNotMatch(html, /上传至受权限保护的房间服务/, 'and does not promise an upload to a server that is not there');
});

test('the server profile keeps the old upload words and the module adds no example photos or demo time', async () => {
  const h = harness({ start: inRoom(), profile: serverProfile });
  h.binding.openPanel('upload');
  const html = h.html();
  for (const old of ['留一个现场瞬间', '这一张，由你决定给谁看。', '选照片', '可见范围', '仅自己保存', '分享给本场成员', '保存时照片会上传至受权限保护的房间服务。会缩小并去除位置信息；选择分享后，本场已加入成员可以浏览。', '保存这张照片', 'data-form="upload"']) assert.ok(html.includes(old), old);
  assert.doesNotMatch(html, /data-sample-photo|moment-samples|data-demo-time|只保存在这个浏览器里/);
});

test('picking a photo files its draft with the facts, and the model\'s sure answer pre-selects a chip as the AI\'s', async () => {
  model.result = TIMED_BY_MODEL;
  const h = await openedUpload();
  assert.equal(await h.pick(SAMPLE_FILES['sample-stage']()), true);
  await settle();
  const draft = h.get().photoDraft;
  assert.equal(draft.roomId, roomId);
  assert.match(draft.dataUrl, /^data:image\/jpeg;base64,/);
  assert.equal(draft.takenAt, SAMPLE_TIME['sample-stage'], 'the time came from the original file, before it was redrawn');
  assert.equal(draft.takenSource, 'exif');
  assert.equal(draft.visibility, 'private', 'a photo of one\'s own starts private');
  assert.deepEqual(stateOf(h).drafts.photo.takenAt, draft.takenAt, 'the controller holds the same draft');
  assert.match(h.binding.uploadHtml(), /aria-pressed="true"[^>]*><b>人海/, 'the model\'s sure answer is a pre-selected chip');
  assert.match(h.binding.uploadHtml(), /moment-ai-tag/, 'and the tag says the suggestion was the AI\'s');
});

test('saving sends the facts to the controller exactly once, with the draft in the order the controller recognises, and then the draft is cleared', async () => {
  model.result = TIMED_BY_MODEL;
  const h = await openedUpload();
  await h.pick(SAMPLE_FILES['sample-stage']());
  await settle();
  h.submit('upload', { visibility: 'members' }, { room: roomId });
  await settle();
  const uploads = h.calls.filter(([method]) => method === 'uploadPhoto');
  assert.equal(uploads.length, 1);
  const [, dataUrl, visibility, options] = uploads[0];
  assert.equal(visibility, 'members');
  assert.deepEqual(options, { roomId, meta: { takenAt: SAMPLE_TIME['sample-stage'], takenSource: 'exif', viewpoint: 'crowd', viewpointSource: 'ai' } });
  assert.match(dataUrl, /^data:image\/jpeg;base64,/);
  const submitted = h.drafts.filter(([kind, value]) => kind === 'photo' && value).at(-1)[1];
  assert.deepEqual(Object.keys(submitted), ['roomId', 'dataUrl', 'visibility', 'takenAt', 'takenSource', 'viewpoint', 'viewpointSource'], 'the controller only recognises a submitted draft in this key order');
  assert.equal(stateOf(h).drafts.photo, null, 'cleared after a successful save');
  assert.equal(h.get().photoDraft, null);
  assert.equal(h.get().panelKind, 'wall');
  assert.deepEqual(h.binding.momentUpload.facts(), {}, 'and the form forgot the photo');
});

test('a person\'s own choice of side is saved as theirs, even when it is the one the model suggested', async () => {
  model.result = TIMED_BY_MODEL;
  const h = await openedUpload();
  await h.pick(SAMPLE_FILES['sample-stage']());
  await settle();
  h.fire('click', control({ momentViewpoint: 'crowd' }));
  h.submit('upload', { visibility: 'private' }, { room: roomId });
  await settle();
  assert.equal(h.calls.find(([method]) => method === 'uploadPhoto')[3].meta.viewpointSource, 'manual');
});

test('a failed save keeps the draft and the person\'s later choices for a retry', async () => {
  model.result = UNSURE;
  const h = await openedUpload({ uploadFails: true });
  await h.pick(SAMPLE_FILES['sample-stage']());
  await settle();
  h.fire('click', control({ momentViewpoint: 'detail' }));
  h.submit('upload', { visibility: 'private' }, { room: roomId });
  await settle();
  assert.equal(h.calls.filter(([method]) => method === 'uploadPhoto').length, 1);
  assert.equal(h.get().panelKind, 'upload', 'still on the form');
  const kept = stateOf(h).drafts.photo;
  assert.equal(kept.viewpoint, 'detail');
  assert.equal(kept.viewpointSource, 'manual');
  assert.ok(kept.dataUrl);
  assert.equal(h.binding.momentUpload.facts().viewpoint, 'detail', 'the form still holds the photo');
});

test('a photo picked while an earlier save is still pending is not cleared by that save\'s success, and the form keeps the new photo', async () => {
  model.result = TIMED_BY_MODEL;
  const h = await openedUpload();
  await h.pick(SAMPLE_FILES['sample-stage']());
  await settle();
  const pending = defer();
  h.controller.uploadPhoto = async (...args) => { h.calls.push(['uploadPhoto', ...args]); return pending.promise; };
  h.submit('upload', { visibility: 'private' }, { room: roomId });
  await settle();
  const first = h.get().photoDraft;
  await h.pick(SAMPLE_FILES['sample-crowd']());          // the person picks another photo while the first save is on its way
  await settle();
  const second = h.get().photoDraft;
  assert.notEqual(second.dataUrl + second.takenAt, first.dataUrl + first.takenAt);
  pending.resolve({ applied: true });
  await settle();
  assert.deepEqual(h.get().photoDraft, second, 'the newer photo stays in the draft');
  assert.equal(stateOf(h).drafts.photo.takenAt, SAMPLE_TIME['sample-crowd']);
  assert.equal(h.get().panelKind, 'upload', 'the person is not taken away from the photo they just picked');
  assert.equal(h.binding.momentUpload.facts().takenAt, SAMPLE_TIME['sample-crowd'], 'and the form still holds it');
});

for (const way of ['file', 'example']) {
  test(`${way === 'file' ? 'a file' : 'an example photo'} chosen while an earlier save is pending (and still being processed) already keeps that save from clearing the form`, async () => {
    model.result = TIMED_BY_MODEL;
    const gate = defer();
    const made = makeProfile({ overrides: { loadSample: async id => { await gate.promise; return SAMPLE_FILES[id](); } } });
    const h = harness({ profile: made.profile });
    h.binding.openPanel('upload');
    await h.pick(SAMPLE_FILES['sample-stage']());
    await settle();
    const first = h.get().photoDraft;
    const pending = defer();
    h.controller.uploadPhoto = async (...args) => { h.calls.push(['uploadPhoto', ...args]); return pending.promise; };
    h.submit('upload', { visibility: 'private' }, { room: roomId });
    await settle();
    const realBitmap = globalThis.createImageBitmap;
    if (way === 'file') globalThis.createImageBitmap = () => gate.promise.then(() => ({ width: 1200, height: 800, close() {} }));   // still being redrawn
    try {
      if (way === 'file') h.fire('change', { name: 'photo', files: [SAMPLE_FILES['sample-crowd']()], value: '', closest: () => null });
      else { await h.click({ samplePhoto: 'sample-crowd' }); h.fire('click', control({ samplePhoto: 'sample-crowd' })); }   // the document and the form's own listener both see the press
      await settle();
      pending.resolve({ applied: true });
      await settle();
      assert.deepEqual(h.get().photoDraft, first, 'the form still holds the draft of the photo being replaced');
      assert.equal(h.get().panelKind, 'upload', 'the person is not sent away while the new photo is being processed');
      gate.resolve();
      await settle();
      assert.equal(h.get().photoDraft.takenAt, SAMPLE_TIME['sample-crowd'], 'the new photo lands in the form once it is ready');
    } finally { globalThis.createImageBitmap = realBitmap; }
  });
}

test('an example photo saved without a side is not sent: the form asks for one, and the save goes through once a side is chosen', async () => {
  model.result = UNSURE;
  const { profile } = makeProfile();
  const h = harness({ profile });
  h.binding.openPanel('upload');
  const asked = [];
  const realNudge = h.binding.momentUpload.nudge;
  h.binding.momentUpload.nudge = container => { asked.push(container === h.body); return realNudge(container); };
  assert.equal(await h.pickSample('sample-stage'), true);
  await settle();
  assert.equal(h.binding.momentUpload.requiresViewpoint(), true, 'the model was unsure, and nothing is selected');
  assert.equal(h.get().photoDraft.visibility, 'members', 'an example is shared by default');
  h.submit('upload', { visibility: 'members' }, { room: roomId });
  await settle();
  assert.deepEqual(asked, [true], 'the nudge is drawn in the panel body');
  assert.equal(h.calls.some(([method]) => method === 'uploadPhoto'), false, 'nothing was sent');
  assert.match(h.binding.uploadHtml(), /先选一个视角/);
  h.fire('click', control({ momentViewpoint: 'stage' }));
  h.submit('upload', { visibility: 'members' }, { room: roomId });
  await settle();
  const uploads = h.calls.filter(([method]) => method === 'uploadPhoto');
  assert.equal(uploads.length, 1);
  assert.equal(uploads[0][3].meta.viewpoint, 'stage');
  assert.equal(uploads[0][3].meta.takenAt, SAMPLE_TIME['sample-stage']);
});

test('on the room server (no examples) a photo saved without a side is still saved: only the example site blocks it', async () => {
  model.result = UNSURE;
  const h = harness({ start: inRoom(), profile: serverProfile });
  h.binding.openPanel('upload');
  await h.pick(SAMPLE_FILES['sample-stage']());
  await settle();
  h.submit('upload', { visibility: 'private' }, { room: roomId });
  await settle();
  const [upload] = h.calls.filter(([method]) => method === 'uploadPhoto');
  assert.ok(upload);
  assert.deepEqual(upload[3].meta, { takenAt: SAMPLE_TIME['sample-stage'], takenSource: 'exif' });
});

test('a model answer after the first draw is patched in place: the page\'s copy of the markup follows, so the next render redraws nothing', async () => {
  model.result = TIMED_BY_MODEL;
  const h = await openedUpload();
  await h.pickSample('sample-crowd');
  await until(() => /is-ai|aria-pressed="true"/.test(h.binding.uploadHtml()), 'the answer');
  const before = h.writes();
  assert.equal(h.get().lastPanelMarkup, h.binding.uploadHtml(), 'lastPanelMarkup is the markup the module would draw now');
  h.binding.renderPanel(false);
  assert.equal(h.writes(), before, 'rendering the panel again does not replace the DOM (it would take typed input and focus with it)');
});

test('a chip press or a typed time re-syncs the page\'s markup too, and the draft the controller holds is not touched by them', async () => {
  model.result = UNSURE;
  const h = await openedUpload();
  await h.pickSample('sample-stage');
  await settle();
  const draftsBefore = h.drafts.length;
  const before = h.writes();
  h.fire('click', control({ momentViewpoint: 'crowd' }));
  h.fire('input', { name: 'takenAt', value: '2026-09-26T21:49', closest: () => null });
  assert.equal(h.get().lastPanelMarkup, h.binding.uploadHtml());
  h.binding.renderPanel(false);
  assert.equal(h.writes(), before);
  assert.equal(h.drafts.length, draftsBefore, 'only picking a photo (and the visibility select) changes the stored draft');
});

test('the visibility select still updates the stored draft and keeps the facts in it', async () => {
  model.result = TIMED_BY_MODEL;
  const h = await openedUpload();
  await h.pick(SAMPLE_FILES['sample-crowd']());
  await settle();
  const target = { name: 'visibility', value: 'members', closest: () => ({ dataset: { form: 'upload' } }) };
  h.fire('input', target);
  const draft = stateOf(h).drafts.photo;
  assert.equal(draft.visibility, 'members');
  assert.equal(draft.takenAt, SAMPLE_TIME['sample-crowd']);
  assert.deepEqual(Object.keys(draft).slice(0, 3), ['roomId', 'dataUrl', 'visibility']);
});

test('a corrupt draft, or a draft of another room, is never drawn or restored', async () => {
  const unsafe = { roomId, dataUrl: '" onerror="alert(1)', visibility: 'private', viewpoint: 'stage', viewpointSource: 'manual' };
  const h = harness({ start: inRoom({ drafts: { photo: unsafe, profile: null, room: null } }), profile: makeProfile().profile });
  h.binding.openPanel('upload');
  assert.doesNotMatch(h.html(), /onerror|alert\(1\)/);
  assert.match(h.html(), /type="submit" disabled/);
  assert.deepEqual(h.binding.momentUpload.facts(), {}, 'its facts were not restored either');
  const other = { roomId: 'another-room', dataUrl: 'data:image/jpeg;base64,AAAA', visibility: 'private', takenAt: night(21, 47), takenSource: 'manual' };
  const g = harness({ start: inRoom({ drafts: { photo: other, profile: null, room: null } }), profile: makeProfile().profile });
  g.binding.openPanel('upload');
  assert.doesNotMatch(g.html(), /AAAA/);
  assert.deepEqual(g.binding.momentUpload.facts(), {});
});

test('a saved draft that comes back after a reload is drawn again with its facts, and saves them', async () => {
  const saved = { roomId, dataUrl: 'data:image/jpeg;base64,AAAAAAAAAAAA', visibility: 'members', takenAt: night(21, 48, 10), takenSource: 'manual', viewpoint: 'crowd', viewpointSource: 'manual' };
  const h = harness({ start: inRoom({ drafts: { photo: saved, profile: null, room: null }, draftVersions: { photo: 1, profile: 0, room: 0 } }), profile: makeProfile().profile });
  h.binding.openPanel('upload');
  assert.match(h.html(), /class="photo-review" src="data:image\/jpeg;base64,AAAAAAAAAAAA"/);
  assert.match(h.html(), /aria-pressed="true"[^>]*><b>人海/);
  h.submit('upload', { visibility: 'members' }, { room: roomId });
  await settle();
  assert.deepEqual(h.calls.find(([method]) => method === 'uploadPhoto')[3].meta, { takenAt: saved.takenAt, takenSource: 'manual', viewpoint: 'crowd', viewpointSource: 'manual' });
});

test('a pick that is running while the panel closes lands in the stored draft, and the busy model calms the 3D scene while it works', async () => {
  model.result = TIMED_BY_MODEL;
  const h = await openedUpload();
  const picking = h.pickSample('sample-crowd');
  h.binding.closePanel(false);
  await picking;
  await settle();
  assert.ok(h.get().photoDraft, 'the photo is kept for the next time the form is opened');
  const motion = h.calls.filter(([method]) => method === 'reducedMotion').map(call => call[1]);
  assert.ok(motion.includes(true), 'the scene is calmed while the model works');
  assert.equal(motion.at(-1), false, 'and let go again once the model is done');
});

test('the controls of the new form keep keyboard focus across a redraw (their data attributes are part of the control key)', async () => {
  model.result = UNSURE;
  const h = await openedUpload();
  await h.pick(SAMPLE_FILES['sample-stage']());
  await settle();
  let focused = null;
  const attrs = { 'data-moment-viewpoint': 'crowd' };
  const old = { tagName: 'BUTTON', getAttribute: key => attrs[key] || null };
  const same = { tagName: 'BUTTON', getAttribute: key => attrs[key] || null, focus() { focused = 'chip'; } };
  const other = { tagName: 'BUTTON', getAttribute: key => ({ 'data-moment-viewpoint': 'stage' })[key] || null, focus() { focused = 'wrong chip'; } };
  h.document.activeElement = old;
  h.body.contains = node => node === old;
  h.body.querySelectorAll = () => [other, same];
  h.binding.setPhotoDraft({ ...h.get().photoDraft, visibility: 'members' });
  h.binding.renderPanel(false);
  assert.equal(focused, 'chip');
});

// ============================================================================================================================
// the tour card, the cast and the warm-up
// ============================================================================================================================
function tourHarness(extra = {}) {
  const views = [], mounted = [];
  const made = makeProfile({ overrides: { createTour: options => { mounted.push(options); return { update: view => views.push(clone(view)), dispose() { mounted.disposed = (mounted.disposed || 0) + 1; } }; } } });
  const h = harness({ profile: made.profile, ...extra });
  return { h, views, mounted, ...made };
}

test('the tour card is created once, as the first thing in the presence block, and told the whole story on every render', () => {
  const { h, views, mounted } = tourHarness({ start: lobby() });
  assert.equal(mounted.length, 1);
  assert.equal(h.created.elements.length >= 1 && h.presence.children[0], mounted[0].container, 'the card\'s host sits first in .presence');
  assert.equal(typeof mounted[0].onAction, 'function');
  assert.equal(mounted[0].esc, esc);
  assert.deepEqual(views.at(-1), { stage: 'lobby', ownPhotos: 0, hasPairing: false, exchanges: { total: 0 }, friends: 0, openedRecap: false, panel: null });
  h.emit(inRoom());
  assert.deepEqual(views.at(-1), { stage: 'room', ownPhotos: 0, hasPairing: false, exchanges: { total: 0 }, friends: 0, openedRecap: false, panel: null });
  const mine = shot(9, actor, [21, 48, 10], 'crowd');
  h.emit(inRoom({ photos: [...seeded(), mine], social: { actorId: actor, incoming: [], outgoing: [], friends: [{ userId: YAO, peer: cast[0], revision: 1 }], blocks: [], nextCursors: {}, loaded: true, stale: false } }));
  assert.deepEqual(views.at(-1), { stage: 'room', ownPhotos: 1, hasPairing: true, exchanges: { total: 0 }, friends: 1, openedRecap: false, panel: null }, 'a crowd photo next to a stage photo of the same minute has a partner');
});

test('the tour knows a same-moment partner only when one exists, ignores a private photo of another member and sees the exchange state', () => {
  const { h, views } = tourHarness({ start: inRoom({ photos: [shot(9, actor, [21, 48, 10], 'stage'), shot(2, MAN, [21, 48, 5], 'stage')] }) });
  assert.equal(views.at(-1).hasPairing, false, 'two stage photos are the same moment but not another side');
  h.emit(inRoom({ photos: [shot(9, actor, [21, 48, 10], 'crowd'), shot(2, MAN, [21, 48, 5], 'stage', { visibility: 'private' })] }));
  assert.equal(views.at(-1).hasPairing, false, 'a private photo is not on the wall');
  h.setExchange({ list: { items: [{ id: 'x1', status: 'pending' }, { id: 'x2', status: 'accepted' }] }, current: { id: 'x2', exchange: { id: 'x2', status: 'accepted' } } });
  h.emit(inRoom());
  assert.equal(views.at(-1).exchanges.total, 2, 'a current exchange that is also in the list counts once');
  h.setExchange(undefined);
  h.emit(inRoom());
  assert.equal(views.at(-1).exchanges.total, 2, 'an exchange panel that has gone quiet (closed) does not make the page forget what it showed');
  const fresh = tourHarness({ start: inRoom() });
  fresh.h.setExchange(undefined);
  fresh.h.emit(inRoom());
  assert.equal(fresh.views.at(-1).exchanges.total, 0, 'and one that never had anything to say is zero, not an error');
});

test('an exchange just sent is known from its receipt and the photo its offer was opened on, after the exchange panel has closed', async () => {
  const mine = shot(9, actor, [21, 48, 10], 'crowd');
  const { h, views } = tourHarness({ start: inRoom({ photos: [...seeded(), mine] }) });
  h.binding.openPanel('wall');
  assert.deepEqual([...h.html().matchAll(/data-exchange-offer="([^"]+)"/g)].map(match => match[1]), [photoId(1)]);
  await h.click({ exchangeOffer: photoId(1) });
  h.setExchange({ list: { items: [] }, current: null, lastResult: { type: 'create', exchangeId: 'x-sent', committed: true } });   // sent; the panel was shut before it loaded a list
  h.emit(inRoom({ photos: [...seeded(), mine] }));
  assert.equal(views.at(-1).exchanges.total, 1, 'step three of the tour is done');
  h.binding.openPanel('wall');
  assert.deepEqual([...h.html().matchAll(/data-exchange-offer="([^"]+)"/g)].map(match => match[1]), [photoId(3)], 'the mark moved on to the next other side');
  assert.match(h.html(), /已有交换/);
});

test('a receipt that is not a send, or arrives with no offer opened, is not mistaken for an exchange; a new room starts again', async () => {
  const mine = shot(9, actor, [21, 48, 10], 'crowd');
  const room1 = () => inRoom({ photos: [...seeded(), mine] });
  const answered = tourHarness({ start: room1() });
  await answered.h.click({ exchangeOffer: photoId(1) });                       // an offer was opened ...
  answered.h.setExchange({ lastResult: { type: 'accept', exchangeId: 'x-1', committed: true } });   // ... but the only receipt is an answer
  answered.h.emit(room1());
  assert.equal(answered.views.at(-1).exchanges.total, 0, 'an answer to somebody else\'s exchange is not the visitor\'s own send');

  const unattached = tourHarness({ start: room1(), exchange: { lastResult: { type: 'create', exchangeId: 'x-2', committed: true } } });
  unattached.h.emit(room1());
  assert.equal(unattached.views.at(-1).exchanges.total, 0, 'a create receipt with no photo to attach it to is not guessed at');

  const sent = tourHarness({ start: room1() });
  await sent.h.click({ exchangeOffer: photoId(1) });
  sent.h.setExchange({ lastResult: { type: 'create', exchangeId: 'x-3', committed: true } });
  sent.h.emit(room1());
  assert.equal(sent.views.at(-1).exchanges.total, 1);
  sent.h.emit(initial({ room: room({ id: 'another-room-id' }), route: { kind: 'room', target: 'another-room-id' }, members: [me] }));
  assert.equal(sent.views.at(-1).exchanges.total, 0, 'leaving for another room forgets the old room\'s exchanges');
});

test('the tour follows the panels: it is told which one is open, also when it opens or closes between renders', async () => {
  const { h, views } = tourHarness();
  h.binding.openPanel('wall');
  assert.equal(views.at(-1).panel, 'wall');
  h.binding.closePanel(false);
  assert.equal(views.at(-1).panel, null);
  await h.click({ open: 'recap', id: roomId });
  assert.equal(views.at(-1).openedRecap, true, 'looking at the recap is step four');
});

test('the tour buttons route through its callback: sample photo, your own photo, wall, people, recap; skip opens nothing', async () => {
  const { h, mounted } = tourHarness();
  const picked = [];
  h.binding.momentUpload.pickSample = async id => { picked.push([id, h.get().panelKind]); return true; };
  const act = (action) => { const cut = action.indexOf(':'); mounted[0].onAction(action, { kind: cut < 0 ? action : action.slice(0, cut), id: cut < 0 ? '' : action.slice(cut + 1) }); };
  act('sample:sample-crowd');
  assert.deepEqual(picked, [['sample-crowd', 'upload']], 'the upload panel is open when the sample is loaded');
  act('open:wall');
  assert.equal(h.get().panelKind, 'wall');
  act('open:people');
  assert.equal(h.get().panelKind, 'people');
  act('open:upload');
  assert.equal(h.get().panelKind, 'upload');
  act('open:recap');
  await settle();
  assert.ok(h.calls.some(([method, id]) => method === 'loadRoomRecap' && id === roomId));
  h.binding.closePanel(false);
  act('skip');
  assert.equal(h.get().panelKind, null);
});

test('the tour belongs to the example site only: the server profile creates none', () => {
  const h = harness({ start: inRoom(), profile: serverProfile });
  assert.equal(h.get().tour, null);
  assert.equal(h.presence.children.length, 0);
});

test('the model starts to download once the visitor has joined, not at page load, and only once', async () => {
  model.loads = 0;
  const { profile } = makeProfile();
  const h = harness({ start: lobby(), profile });
  assert.equal(model.loads, 0, 'nothing at page load');
  h.binding.openPanel('entry');
  h.submit('demo-entry', { name: '小客', participation: 'open', consent: 'on' });
  await settle();
  assert.equal(h.get().warmedUp, true);
  assert.equal(model.loads, 1, 'the download starts after joinRoom succeeded');
  h.emit(inRoom());
  h.emit(inRoom());
  assert.equal(model.loads, 1, 'later renders do not start it again');
});

test('a join that committed but whose room could not be read yet warms the model too: the visitor is in', async () => {
  model.loads = 0;
  const { profile } = makeProfile();
  const h = harness({ start: lobby(), profile });
  h.controller.joinRoom = async (code, options) => { h.calls.push(['joinRoom', code, clone(options)]); return { applied: true, room: room(), actorId: actor }; };
  h.binding.openPanel('entry');
  h.submit('demo-entry', { name: '小客', participation: 'open', consent: 'on' });
  await settle();
  assert.equal(h.get().panelKind, 'arrival', 'the page offers to read the room again');
  assert.equal(model.loads, 1);
});

test('coming back to a room already joined (a reload) warms the model too, while the room server never warms it before the file picker is pressed', async () => {
  model.loads = 0;
  const { profile } = makeProfile();
  harness({ start: inRoom(), profile });
  assert.equal(model.loads, 1);
  model.loads = 0;
  const server = harness({ start: inRoom(), profile: serverProfile });
  assert.equal(model.loads, 0);
  server.binding.openPanel('upload');
  server.fire('click', { name: 'photo', type: 'file', closest: () => null });
  assert.equal(model.loads, 1, 'the picker press starts it (the module\'s own rule)');
});
