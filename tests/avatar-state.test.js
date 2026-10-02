import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

// Execute the real frontend logic in an isolated DOM shell. These are state/API
// regressions, not browser layout, focus, pointer or visual acceptance tests.
const modelSource = readFileSync(new URL('../web/avatar/model.js', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../web/avatar/app.js', import.meta.url), 'utf8');
const apiSource = readFileSync(new URL('../web/avatar/api.js', import.meta.url), 'utf8');
const withoutExports = text => text.replace(/\bexport\s+(?=(?:async\s+)?(?:function|class|const|let))/g, '');
const plain = value => JSON.parse(JSON.stringify(value));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const storageFor = (entries = new Map()) => ({
  getItem: key => entries.get(key) ?? null,
  setItem: (key, value) => { entries.set(key, String(value)); },
  removeItem: key => { entries.delete(key); },
});
const avatar = { skin: 1, hair: 0, hairColor: 0, outfit: 0, accessory: 'headphones', pose: 'sway' };
const session = role => ({ token: (role === 'host' ? 'h' : 'g').repeat(43), user: { id: role, name: role, avatar: { ...avatar }, revision: 1 } });
function composition(role = 'host', overrides = {}) {
  return {
    id: '00000000-0000-4000-8000-000000000001', title: 'Shared composition', caption: 'An invitation',
    scene: { kind: 'builtin', id: 'rooftop-night' }, songId: 'late-train', revision: 4, contentRevision: 2,
    status: 'accepted', role, consents: { host: false, guest: false }, exportEligible: false, inviteActive: true,
    host: { id: 'host', name: 'Host', avatar: { ...avatar }, transform: { x: 37, y: 81, scale: 1, rotation: 0 } },
    guest: { id: 'guest', name: 'Guest', avatar: { ...avatar, outfit: 2 }, transform: { x: 66, y: 81, scale: 1, rotation: 0 }, response: 'Old response' },
    updatedAt: '2026-09-30T00:00:00.000Z', ...overrides,
  };
}
function appHarness({ request = async () => { throw Error('Unexpected request'); }, entries = new Map() } = {}) {
  const listeners = new Map(), modalListeners = new Map(), elements = new Map(), app = { innerHTML: '' }, toast = { textContent: '', className: '' };
  const modal = { open: false, innerHTML: '', addEventListener(event, fn) { modalListeners.set(event, fn); }, setAttribute() {}, removeAttribute() {}, querySelector() { return null; },
    showModal() { this.open = true; }, close() { this.open = false; } };
  const location = { hash: '', href: 'https://space.example/avatar/', pathname: '/avatar/', search: '', hostname: 'space.example' };
  const context = vm.createContext({ console, crypto: webcrypto, structuredClone, URL, TextEncoder, AbortSignal,
    localStorage: storageFor(entries), navigator: { onLine: true }, location,
    document: { querySelector: selector => elements.get(selector) || ({ '#app': app, '#modal': modal, '#toast': toast }[selector] || null), querySelectorAll: () => [],
      addEventListener: (event, fn) => { const items = listeners.get(event) || []; items.push(fn); listeners.set(event, items); },
      activeElement: null, body: { classList: { add() {}, remove() {} } } },
    window: { addEventListener() {}, history: { replaceState(_state, _title, url) { location.hash = new URL(url, location.href).hash; } } },
    setTimeout() { return 1; }, clearTimeout() {}, setInterval() { return 1; },
    avatarSVG: () => '<svg aria-hidden="true"></svg>', playMusic() {}, stopMusic() {},
    photoBlob: async () => 'blob:authorized-photo', exportImage: async () => { throw Error('Unexpected image export'); }, request,
  });
  const body = appSource.replace(/^import .*;$/gm, '').replace(/const sceneAssets=import\.meta\.glob\([^\n]+;/, 'const sceneAssets={};');
  const bootstrap = body.lastIndexOf('// AVATAR_BOOTSTRAP');
  assert.ok(bootstrap > 0, 'locate frontend bootstrap without changing implementation');
  vm.runInContext(`'use strict';\n${withoutExports(modelSource)}\nconst e=escape;\n${body.slice(0, bootstrap)}\n` + `
    globalThis.state = {
      get: () => ({ profile, session, draft, localDraft, remote, invite, inviteToken, history, redo, storageFailed, busy, works, avatarDraft, avatarEditing }),
      set: s => { if ('profile' in s) profile=s.profile; if ('session' in s) session=s.session;
        if ('draft' in s) draft=s.draft; if ('localDraft' in s) localDraft=s.localDraft;
        if ('remote' in s) remote=s.remote; if ('invite' in s) invite=s.invite;
        if ('inviteToken' in s) inviteToken=s.inviteToken; },
      newDraft, remoteDraft, isDirty, consent, decision, makeExport, confirmInvitation,
      joinInvitation, updateRemote, openRoute, persist, render, ensureSession, readSaved,
      normalizeSaved, safeAvatar, saveLocal, loadPhoto, refreshRemote, withBusy, avatarDialog, closeModal, identityPortrait, refreshPortraits,
    };`, context, { filename: 'avatar-app-state-harness.js' });
  return { context, state: context.state, app, modal, toast, entries, location, listeners, modalListeners, elements };
}
function sharedHarness(role = 'host', options) {
  const h = appHarness(options), c = composition(role);
  h.state.set({ profile: { name: role, avatar: { ...avatar } }, session: session(role) });
  h.state.remoteDraft(c);
  return { ...h, c };
}

for (const action of ['consent', 'decision', 'export']) {
  test(`dirty shared edits block ${action} without submitting or discarding changes`, async () => {
    const requests = [], h = sharedHarness('host', { request: async (...args) => { requests.push(args); return { composition: composition() }; } });
    h.state.get().draft.avatar.outfit = 5;
    if (action === 'consent') await h.state.consent(true);
    if (action === 'decision') await h.state.decision(true);
    if (action === 'export') await h.state.makeExport(true);
    assert.equal(requests.length, 0, 'unsubmitted visible edits must not authorize a different snapshot');
    assert.equal(h.state.get().draft.avatar.outfit, 5);
    assert.equal(h.modal.open, true, 'offer an explicit save/discard choice');
  });
}

test('private local draft survives opening and joining another person’s invitation', async () => {
  const c = composition('guest'), h = appHarness({ request: async path => {
    if (path === '/session') return session('guest');
    if (path.endsWith('/join')) return { composition: c };
    return { preview: { ...c, available: true } };
  } });
  h.state.set({ profile: { name: 'Guest', avatar }, session: session('guest') });
  const original = { ...plain(h.state.get().draft), title: 'My private unsent work' };
  h.state.set({ draft: original });
  h.location.hash = '#invite=' + 'i'.repeat(43);
  await h.state.openRoute();
  assert.equal(h.state.get().localDraft.id, original.id);
  h.state.get().draft.joinConsent = true;
  await h.state.joinInvitation();
  assert.equal(h.state.get().localDraft.id, original.id, 'joining must not replace private draft with invitation draft');
  assert.equal(h.state.get().localDraft.title, original.title);
  const persisted = JSON.parse(h.entries.get('music-space-avatar:v1'));
  assert.equal(persisted.draft.id, original.id);
  assert.equal(h.location.hash, '#work=' + c.id);
});

test('invitation submission freezes the reviewed payload before awaiting identity lookup', async () => {
  const identity = deferred(), captured = [], c = composition('host', { guest: null, status: 'waiting' });
  const h = appHarness({ request: async (path, options) => {
    if (path === '/session') return identity.promise;
    if (path === '/compositions') { captured.push(plain(options.body)); return { composition: c }; }
    if (path.endsWith('/invite')) return { composition: c, inviteToken: 'i'.repeat(43) };
    throw Error('Unexpected path ' + path);
  } });
  h.state.set({ profile: { name: 'Host', avatar }, session: session('host') });
  h.state.get().draft.title = 'The reviewed title';
  const operation = h.state.confirmInvitation();
  h.state.get().draft.title = 'A later unreviewed title';
  h.state.get().draft.avatar.outfit = 5;
  identity.resolve(session('host'));
  await operation;
  assert.equal(captured.length, 1);
  assert.equal(captured[0].title, 'The reviewed title');
  assert.equal(captured[0].avatar.outfit, 0, 'nested avatar fields must also be frozen');
});

test('corrupt stored fields are normalized instead of crashing initial render', () => {
  for (const payload of [
    { version: 1, draft: {}, works: 'not-an-array', profile: { name: 'A', avatar: null } },
    { version: 1, draft: { id: 'bad', title: 'Bad', scene: null }, works: [null, {}, 42] },
    { version: 1, profile: { name: 'A', avatar: { skin: 1.5, hair: -9, outfit: 200 } }, works: [] },
  ]) {
    const entries = new Map([['music-space-avatar:v1', JSON.stringify(payload)]]), h = appHarness({ entries });
    assert.doesNotThrow(() => h.state.render());
    assert.ok(Array.isArray(h.state.readSaved().works));
    assert.doesNotThrow(() => h.state.safeAvatar(null));
    assert.ok(Number.isInteger(h.state.safeAvatar({ skin: 1.5 }).skin));
  }
});

test('valid separately stored identity survives corrupt main draft JSON', () => {
  const entries = new Map([['music-space-avatar:v1', '{broken'], ['music-space-avatar-session:v1', JSON.stringify(session('host'))]]);
  const h = appHarness({ entries });
  assert.equal(h.state.get().session?.token, session('host').token, 'draft corruption must not orphan a valid identity');
});

test('guest can intentionally clear an existing response', async () => {
  let submitted;
  const h = sharedHarness('guest', { request: async (_path, options) => {
    submitted = plain(options.body);
    const c = composition('guest'); c.guest.response = submitted.response;
    return { composition: c };
  } });
  h.state.get().draft.response = '';
  await h.state.updateRemote();
  assert.equal(submitted.response, '');
  assert.equal(h.state.get().draft.response, '');
});

function apiHarness(entries, fetch) {
  const c = vm.createContext({ crypto: webcrypto, TextEncoder, Uint8Array, AbortSignal, localStorage: storageFor(entries), fetch });
  vm.runInContext(`'use strict';\n${withoutExports(apiSource)}\nglobalThis.call=request;`, c);
  return c.call;
}
test('network-lost response retries retain idempotency key across page reload and clear on success', async () => {
  const entries = new Map(), keys = [];
  const first = apiHarness(entries, async (_url, options) => { keys.push(options.headers['Idempotency-Key']); throw Error('Connection closed after server commit'); });
  const options = { method: 'POST', token: session('host').token, body: { title: 'Same operation' } };
  await assert.rejects(first('/compositions', options), /网络/);
  const retry = apiHarness(entries, async (_url, requestOptions) => { keys.push(requestOptions.headers['Idempotency-Key']); return { ok: true, status: 201, json: async () => ({ saved: true }) }; });
  await retry('/compositions', options);
  await retry('/compositions', options);
  assert.equal(keys[1], keys[0], 'unknown-outcome retry must replay same operation');
  assert.notEqual(keys[2], keys[1], 'a later intentional operation needs a new key');
});

test('late invitation response cannot overwrite a newer work navigation', async () => {
  const invitation = deferred(), work = composition('guest'), h = appHarness({ request: async path => {
    if (path.startsWith('/invites/')) return invitation.promise;
    if (path.startsWith('/compositions/')) return { composition: work };
    throw Error('Unexpected path ' + path);
  } });
  h.state.set({ profile: { name: 'Guest', avatar }, session: session('guest') });
  h.location.hash = '#invite=' + 'i'.repeat(43);
  const older = h.state.openRoute();
  h.location.hash = '#work=' + work.id;
  await h.state.openRoute();
  invitation.resolve({ preview: { ...composition('guest'), id: 'other-invitation', available: true } });
  await older;
  assert.equal(h.state.get().remote?.id, work.id, 'latest route must remain the displayed composition');
  assert.equal(h.state.get().invite, null);
  assert.equal(h.location.hash, '#work=' + work.id);
});


test('private photo cache refreshes when shared content revision changes at the same URL', async () => {
  const first = composition('guest', { scene: { kind: 'photo', photoUrl: '/api/avatar/compositions/room/photo' }, contentRevision: 2 });
  const newer = { ...first, revision: 8, contentRevision: 3 }, h = appHarness({ request: async () => ({ composition: newer }) });
  let reads = 0;
  h.context.photoBlob = async () => `blob:photo-${++reads}`;
  h.state.set({ profile: { name: 'Guest', avatar }, session: session('guest') });
  h.state.remoteDraft(first);
  await h.state.loadPhoto(first.scene, session('guest').token);
  await h.state.refreshRemote();
  assert.equal(reads, 2, 'stable authorized URL must not mean permanently immutable photo bytes');
});

test('request freezes body before asynchronous idempotency hashing', async () => {
  const hashing = deferred(), entries = new Map();
  let posted;
  const c = vm.createContext({
    crypto: { randomUUID: () => webcrypto.randomUUID(), subtle: { digest: () => hashing.promise } },
    TextEncoder, Uint8Array, AbortSignal, localStorage: storageFor(entries),
    fetch: async (_url, options) => { posted = JSON.parse(options.body); return { ok: true, status: 201, json: async () => ({ ok: true }) }; },
  });
  vm.runInContext(`'use strict';\n${withoutExports(apiSource)}\nglobalThis.call=request;`, c);
  const body = { avatar: { ...avatar }, title: 'Reviewed body' };
  const pending = c.call('/compositions', { method: 'POST', body });
  body.avatar.outfit = 5;
  body.title = 'Later body';
  hashing.resolve(new Uint8Array(32).buffer);
  await pending;
  assert.equal(posted.title, 'Reviewed body');
  assert.equal(posted.avatar.outfit, 0);
});

test('existing embedded identity is not lost when a draft write upgrades storage', () => {
  const entries = new Map([['music-space-avatar:v1', JSON.stringify({ version: 1, session: session('host'), works: [] })]]);
  const original = appHarness({ entries });
  assert.equal(original.state.get().session?.token, session('host').token);
  original.state.persist();
  const reloaded = appHarness({ entries });
  assert.equal(reloaded.state.get().session?.token, session('host').token, 'migrate credentials before removing the legacy session field');
});

test('corrupt operation-key storage cannot permanently break all mutations', async () => {
  for (const bad of ['bad', 42, true]) {
    const entries = new Map([['music-space-avatar-operations:v1', JSON.stringify(bad)]]);
    const request = apiHarness(entries, async () => ({ ok: true, status: 201, json: async () => ({ ok: true }) }));
    const result = await request('/session', { method: 'POST', body: { name: 'Guest' } });
    assert.equal(result.ok, true);
  }
});

test('opening a saved shared composition preserves the latest unsent private draft', async () => {
  const entries = new Map(), h = appHarness({ entries, request: async () => ({ composition: composition('guest') }) });
  h.state.set({ profile: { name: 'Guest', avatar }, session: session('guest') });
  const id = h.state.get().draft.id;
  h.state.get().draft.title = 'Latest private draft';
  h.state.persist();
  h.location.hash = '#work=' + composition().id;
  await h.state.openRoute();
  const saved = JSON.parse(entries.get('music-space-avatar:v1'));
  assert.equal(saved.draft.id, id);
  assert.equal(saved.draft.title, 'Latest private draft', 'entering a saved shared work must capture current local edits');
});

test('switching between invitations preserves the original private draft', async () => {
  const h = appHarness({ request: async path => ({ preview: { ...composition('guest'), id: path.slice(-4), available: true } }) });
  h.state.set({ profile: { name: 'Guest', avatar }, session: session('guest') });
  h.state.get().draft.title = 'Private before invitations';
  const id = h.state.get().draft.id;
  h.location.hash = '#invite=' + 'a'.repeat(43);
  await h.state.openRoute();
  h.location.hash = '#invite=' + 'b'.repeat(43);
  await h.state.openRoute();
  assert.equal(h.state.get().localDraft.id, id);
  assert.equal(h.state.get().localDraft.title, 'Private before invitations');
});

test('opening an existing work exits invitation mode before rendering shared controls', async () => {
  const work = composition('guest'), h = appHarness({ request: async path => path.startsWith('/invites/')
    ? { preview: { ...work, id: 'another-invitation', available: true } } : { composition: work } });
  h.state.set({ profile: { name: 'Guest', avatar }, session: session('guest') });
  h.location.hash = '#invite=' + 'i'.repeat(43);
  await h.state.openRoute();
  assert.ok(h.state.get().invite);
  h.location.hash = '#work=' + work.id;
  await h.state.openRoute();
  assert.equal(h.state.get().invite, null, 'stale invitation must not override currentHost, isGuest, or primaryAction');
  assert.equal(h.state.get().remote.id, work.id);
  assert.doesNotMatch(h.app.innerHTML, /data-action="join"/);
});


function clickAction(h, action, extra = {}) {
  for (const handler of h.listeners.get('click') || []) {
    handler({ target: { closest: () => ({ disabled: false, dataset: { action, ...extra } }) } });
  }
}

test('failed or cancelled invitation lookup preserves edits made since page load', async () => {
  for (const cancelWhileLoading of [false, true]) {
    const lookup = deferred(), h = appHarness({ request: () => lookup.promise });
    const original = plain(h.state.get().draft);
    original.title = 'Latest private title'; original.avatar.top = 5; original.avatar.eyewear = 4;
    h.state.set({ draft: original }); h.state.persist();
    h.location.hash = '#invite=' + 'a'.repeat(43);
    const opening = h.state.openRoute();
    if (cancelWhileLoading) clickAction(h, 'cancel-route');
    lookup.reject(Error('Offline invitation lookup')); await opening;
    if (!cancelWhileLoading) clickAction(h, 'cancel-route');
    assert.deepEqual(plain(h.state.get().draft), original);
    assert.deepEqual(JSON.parse(h.entries.get('music-space-avatar:v1')).draft, original);
    assert.equal(h.location.hash, '');
  }
});

test('failed work lookup preserves the current private draft before requiring identity', async () => {
  const h = appHarness();
  h.state.get().draft.title = 'Private work without an online identity';
  h.location.hash = '#work=' + composition().id;
  await h.state.openRoute(); clickAction(h, 'cancel-route');
  assert.equal(h.state.get().draft.title, 'Private work without an online identity');
});

test('join cannot transfer consent to another invitation during identity lookup', async () => {
  const identity = deferred(), joins = [];
  const h = appHarness({ request: async (path, options) => {
    if (path === '/session') return identity.promise;
    if (path.endsWith('/join')) { joins.push([path, plain(options.body)]); return { composition: composition('guest') }; }
    return { preview: { ...composition('guest'), id: path.endsWith('a') ? 'invitation-a' : 'invitation-b', available: true } };
  } });
  h.state.set({ profile: { name: 'Guest', avatar }, session: session('guest') });
  h.location.hash = '#invite=' + 'a'.repeat(43); await h.state.openRoute();
  h.state.get().draft.joinConsent = true; h.state.get().draft.response = 'Reviewed A';
  const joining = h.state.withBusy(h.state.joinInvitation);
  h.location.hash = '#invite=' + 'b'.repeat(43); await h.state.openRoute();
  identity.resolve(session('guest')); await joining;
  assert.equal(joins.length, 0, 'cancel old action rather than sharing with an unreviewed destination');
  assert.equal(h.state.get().invite.id, 'invitation-b');
  assert.equal(h.state.get().draft.joinConsent, undefined);
});

test('join freezes the reviewed appearance, position and response before identity lookup', async () => {
  const identity = deferred(), submitted = [];
  const h = appHarness({ request: async (path, options) => {
    if (path === '/session') return identity.promise;
    if (path.endsWith('/join')) { submitted.push(plain(options.body)); return { composition: composition('guest') }; }
    return { preview: { ...composition('guest'), available: true } };
  } });
  h.state.set({ profile: { name: 'Guest', avatar }, session: session('guest') });
  h.location.hash = '#invite=' + 'a'.repeat(43); await h.state.openRoute();
  Object.assign(h.state.get().draft, { joinConsent: true, response: 'Reviewed response' });
  h.state.get().draft.avatar.top = 4;
  const expected = plain(h.state.get().draft), joining = h.state.withBusy(h.state.joinInvitation);
  h.state.get().draft.avatar.top = 5; h.state.get().draft.transform.x = 25; h.state.get().draft.response = 'Later response';
  identity.resolve(session('guest')); await joining;
  assert.deepEqual(submitted[0], { revision: 4, response: expected.response, avatar: expected.avatar, transform: expected.transform, consent: true });
});

test('late successful join preserves newer navigation and keeps the joined work discoverable', async () => {
  const joined = deferred(), submitted = deferred(), roomA = composition('guest'), roomB = composition('guest', { id: '00000000-0000-4000-8000-000000000002' });
  const h = appHarness({ request: async path => {
    if (path === '/session') return session('guest');
    if (path.endsWith('/join')) { submitted.resolve(); return joined.promise; }
    if (path.startsWith('/compositions/')) return { composition: roomB };
    return { preview: { ...roomA, available: true } };
  } });
  h.state.set({ profile: { name: 'Guest', avatar }, session: session('guest') });
  h.location.hash = '#invite=' + 'a'.repeat(43); await h.state.openRoute(); h.state.get().draft.joinConsent = true;
  const joining = h.state.withBusy(h.state.joinInvitation); await submitted.promise;
  h.location.hash = '#work=' + roomB.id; await h.state.openRoute();
  joined.resolve({ composition: roomA }); await joining;
  assert.equal(h.state.get().remote.id, roomB.id);
  assert.equal(h.location.hash, '#work=' + roomB.id);
  assert.ok(h.state.get().works.some(w => w.remoteId === roomA.id));
});

for (const action of ['update', 'decision', 'consent']) {
  test(`late ${action} completion cannot replace a newer shared-work route`, async () => {
    const mutation = deferred(), a = composition('host'), b = composition('host', { id: '00000000-0000-4000-8000-000000000002' });
    const h = appHarness({ request: async (_path, options) => options?.method ? mutation.promise : { composition: b } });
    h.state.set({ profile: { name: 'Host', avatar }, session: session('host') }); h.state.remoteDraft(a);
    if (action === 'update') h.state.get().draft.avatar.top = 5;
    const running = h.state.withBusy(() => action === 'update' ? h.state.updateRemote() : action === 'decision' ? h.state.decision(true) : h.state.consent(true));
    h.location.hash = '#work=' + b.id; await h.state.openRoute();
    mutation.resolve({ composition: { ...a, revision: 5 } }); await running;
    assert.equal(h.state.get().remote.id, b.id);
    assert.equal(h.state.get().draft.id, b.id);
    assert.equal(h.location.hash, '#work=' + b.id);
  });
}

test('join conflict refreshes preview, keeps contribution edits, and requires fresh consent', async () => {
  let previews = 0; const joins = [];
  const h = appHarness({ request: async (path, options) => {
    if (path === '/session') return session('guest');
    if (path.endsWith('/join')) {
      joins.push(plain(options.body));
      if (joins.length === 1) throw Object.assign(Error('Stale preview'), { status: 409, code: 'REVISION_CONFLICT' });
      return { composition: composition('guest', { revision: 6 }) };
    }
    previews++;
    return { preview: { ...composition('guest'), revision: previews === 1 ? 4 : 5, caption: previews === 1 ? 'Old caption' : 'Updated caption', available: true } };
  } });
  h.state.set({ profile: { name: 'Guest', avatar }, session: session('guest') });
  h.location.hash = '#invite=' + 'a'.repeat(43); await h.state.openRoute();
  Object.assign(h.state.get().draft, { joinConsent: true, response: 'Keep my response' });
  h.state.get().draft.avatar.eyewear = 5; h.state.get().draft.transform.x = 61;
  await h.state.withBusy(h.state.joinInvitation);
  assert.equal(previews, 2);
  assert.equal(h.state.get().invite.revision, 5);
  assert.equal(h.state.get().draft.caption, 'Updated caption');
  assert.equal(h.state.get().draft.response, 'Keep my response');
  assert.equal(h.state.get().draft.avatar.eyewear, 5);
  assert.equal(h.state.get().draft.transform.x, 61);
  assert.equal(h.state.get().draft.joinConsent, false);
  await h.state.withBusy(h.state.joinInvitation); assert.equal(joins.length, 1, 'retry without new consent must not submit');
  h.state.get().draft.joinConsent = true; await h.state.withBusy(h.state.joinInvitation);
  assert.equal(joins[1].revision, 5);
  assert.equal(joins[1].response, 'Keep my response');
});

test('wardrobe preview cancellation keeps profile and composition appearance unchanged', () => {
  for (const exit of ['cancel-button', 'escape']) {
    const h = appHarness(); h.state.set({ profile: { name: 'Saved identity', avatar: h.state.safeAvatar(avatar) } });
    const before = plain(h.state.get().draft), profileBefore = plain(h.state.get().profile);
    h.elements.set('#avatar-name', { value: 'Unsaved identity', focus() {} });
    h.state.avatarDialog();
    clickAction(h, 'avatar-option', { key: 'hair', value: '7' });
    clickAction(h, 'avatar-option', { key: 'eyewear', value: '5' });
    assert.equal(h.state.get().avatarDraft.avatar.hair, 7);
    assert.deepEqual(plain(h.state.get().draft), before);
    if (exit === 'escape') h.modalListeners.get('cancel')({ preventDefault() {} }); else clickAction(h, 'close-modal');
    assert.equal(h.state.get().avatarEditing, false); assert.equal(h.modal.open, false);
    assert.deepEqual(plain(h.state.get().profile), profileBefore);
    assert.deepEqual(plain(h.state.get().draft), before);
  }
});

test('solo export passes the exact modular draft appearance rather than the saved profile preset', async () => {
  const h = appHarness(); let exported;
  h.state.set({ profile: { name: 'Host', avatar: h.state.safeAvatar(avatar) } });
  Object.assign(h.state.get().draft.avatar, { hair: 7, eyewear: 5, top: 4, bottom: 2, shoes: 3, topColor: 6, bottomColor: 5, shoeColor: 7, accessory: 'crossbody', expression: 'wink' });
  h.context.exportImage = async c => { exported = plain(c); return new Blob(['synthetic-export']); };
  await h.state.makeExport(false);
  assert.deepEqual(exported.host.avatar, plain(h.state.get().draft.avatar));
  assert.notDeepEqual(exported.host.avatar, plain(h.state.get().profile.avatar));
});

test('late export response cannot open an obsolete preview after navigation', async () => {
  const exporting = deferred(), a = composition('host', { exportEligible: true }), b = composition('host', { id: '00000000-0000-4000-8000-000000000002' });
  const h = appHarness({ request: async path => path.endsWith('/export') ? exporting.promise : { composition: b } });
  h.state.set({ profile: { name: 'Host', avatar }, session: session('host') }); h.state.remoteDraft(a);
  let exports = 0; h.context.exportImage = async () => { exports++; return new Blob(['synthetic-export']); };
  const running = h.state.withBusy(() => h.state.makeExport(true));
  h.location.hash = '#work=' + b.id; await h.state.openRoute(); exporting.resolve({ composition: a }); await running;
  assert.equal(exports, 0); assert.equal(h.modal.open, false); assert.equal(h.state.get().remote.id, b.id);
});


test('hash navigation dismisses obsolete confirmation and returns home to the private draft', async () => {
  const h = appHarness({ request: async () => ({ composition: composition('guest') }) });
  h.state.set({ profile: { name: 'Guest', avatar }, session: session('guest') });
  const privateId = h.state.get().draft.id;
  h.state.get().draft.title = 'Private before navigating';
  h.state.avatarDialog();
  h.location.hash = '#work=' + composition().id; await h.state.openRoute();
  assert.equal(h.modal.open, false); assert.equal(h.state.get().avatarEditing, false);
  h.location.hash = ''; await h.state.openRoute();
  assert.equal(h.state.get().remote, null); assert.equal(h.state.get().invite, null);
  assert.equal(h.state.get().draft.id, privateId);
  assert.equal(h.state.get().draft.title, 'Private before navigating');
});

test('repeated join clicks submit exactly once while an operation is pending', async () => {
  const sent = deferred(), response = deferred(); let joins = 0;
  const h = appHarness({ request: async path => {
    if (path === '/session') return session('guest');
    if (path.endsWith('/join')) { joins++; sent.resolve(); return response.promise; }
    return { preview: { ...composition('guest'), available: true } };
  } });
  h.state.set({ profile: { name: 'Guest', avatar }, session: session('guest') });
  h.location.hash = '#invite=' + 'a'.repeat(43); await h.state.openRoute(); h.state.get().draft.joinConsent = true;
  clickAction(h, 'join'); clickAction(h, 'join'); await sent.promise; clickAction(h, 'join');
  response.resolve({ composition: composition('guest') }); await new Promise(resolve => setImmediate(resolve));
  assert.equal(joins, 1); assert.equal(h.state.get().busy, false);
});

for (const action of ['regenerate-invite', 'confirm-revoke', 'confirm-leave']) {
  test(`late ${action} response preserves the new route`, async () => {
    const mutation = deferred(), a = composition('guest'), b = composition('guest', { id: '00000000-0000-4000-8000-000000000002' });
    const h = appHarness({ request: async (_path, options) => options?.method ? mutation.promise : { composition: b } });
    h.state.set({ profile: { name: 'Guest', avatar }, session: session('guest') }); h.state.remoteDraft(a);
    clickAction(h, action);
    h.location.hash = '#work=' + b.id; await h.state.openRoute();
    mutation.resolve({ composition: a, inviteToken: 'a'.repeat(43), withdrawn: true });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.state.get().remote.id, b.id); assert.equal(h.state.get().draft.id, b.id);
    assert.equal(h.location.hash, '#work=' + b.id); assert.equal(h.modal.open, false);
    if (action === 'regenerate-invite') assert.match(JSON.parse(h.entries.get('music-space-avatar:v1')).inviteLinks[a.id], /#invite=a{43}$/);
  });
}


test('participant portrait metadata preserves exact modular snapshots, including no eyewear', () => {
  const h = appHarness();
  const exact = h.state.safeAvatar({ ...avatar, version: 2, top: 5, bottom: 4, shoes: 1, eyewear: 0, hair: 7, accessory: 'none', expression: 'wink' });
  const markup = h.state.identityPortrait(exact);
  const encoded = markup.match(/data-avatar-portrait="([^"]+)"/)[1];
  const decoded = encoded.replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
  assert.deepEqual(JSON.parse(decoded), plain(exact));
  assert.equal(JSON.parse(decoded).eyewear, 0);
});

test('participant summaries request the same normalized mesh instead of a preset fallback', () => {
  const h = appHarness(), captures = [];
  const exact = h.state.safeAvatar({ ...avatar, version: 2, top: 3, bottom: 2, shoes: 3, eyewear: 0, hair: 6, accessory: 'none', expression: 'focused' });
  const node = { dataset: { avatarPortrait: JSON.stringify(exact) }, innerHTML: '' };
  h.context.document.querySelectorAll = selector => selector === '[data-avatar-portrait]' ? [node] : [];
  h.context.testRenderer = { portrait(a, options) { captures.push(plain({ a, options })); return 'data:image/png;base64,synthetic-render'; } };
  vm.runInContext('toon = testRenderer;', h.context);
  h.state.refreshPortraits();
  const identity = captures.find(c => c.a.hair === 6 && c.a.top === 3);
  assert.ok(identity); assert.equal(identity.a.eyewear, 0); assert.equal(identity.a.accessory, 'none');
  assert.deepEqual(identity.a, { ...plain(exact), pose: 'listen' });
  assert.equal(identity.options.fullBody, true);
  assert.match(node.innerHTML, /synthetic-render/);
});
