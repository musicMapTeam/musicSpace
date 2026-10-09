// The exchange step's suggestion: option labels, the recommendation and its reason (pure functions), and the panel behaviour around them
// (pollMs, ordering the select, pre-selecting the recommended photo once the target image has loaded, consent and send staying manual).
// The panel runs in a bounded DOM shell, like tests/event-moderation-panel.test.js: callbacks, state and ordering only; layout needs a browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { venueTime } from '../web/js/moment.js';
import { escape as esc } from '../web/avatar/model.js';
import { offerSuggestions } from '../web/event-room/moment-model.js';
import { NO_RECOMMENDATION, PLACEHOLDER, RULE_NOTE, optionLabel, optionsMarkup, reasonText, suggestionMarkup, verdictLabel, verdictOf } from '../web/event-room/exchange-suggest.js';

const DATE = '2026.09.26';
const at = (hour, minute, second = 0) => venueTime(2026, 9, 26, hour, minute, second);
let serial = 0;
const photo = (id, ownerId, takenAt, viewpoint, extra = {}) => ({
  id, roomId: 'room', ownerId, visibility: 'members', revision: 1,
  createdAt: new Date(Date.UTC(2026, 9, 5, 10, 0, serial++)).toISOString(),
  takenAt, takenSource: takenAt === null ? null : 'manual', viewpoint: viewpoint ?? null, viewpointSource: viewpoint ? 'manual' : null, ...extra,
});
const target = photo('t-crowd', 'man', at(21, 48, 5), 'crowd'); // the other person's crowd photo, 21:48:05
const rowsFor = (mine, other = target) => offerSuggestions(mine, other, { eventDate: DATE });
const byId = rows => Object.fromEntries(rows.map(row => [row.photo.id, row]));
const plain = html => html.replace(/<[^>]*>/g, '');

// ---- pure functions ---------------------------------------------------------------------------------------------------------------

test('labels: 「我的第 N 张 · 已上墙 · …」 with the verdict of the rule', () => {
  const mine = [
    photo('late', 'me', at(23, 5), 'crowd'), // 1: an hour and a bit later
    photo('same', 'me', at(21, 48, 0), 'crowd'), // 2: same moment, same side
    photo('stage', 'me', at(21, 47, 50), 'stage', { visibility: 'private' }), // 3: same moment, other side
    photo('other-stage', 'me', at(21, 48, 30), 'stage'), // 4: also another side, a larger gap
    photo('no-time', 'me', null, 'stage'), // 5
  ];
  const rows = byId(rowsFor(mine));
  assert.equal(optionLabel(rows.stage), '我的第 3 张 · 未上墙 · 同一刻的另一面（推荐）');
  assert.equal(optionLabel(rows['other-stage']), '我的第 4 张 · 已上墙 · 同一刻的另一面');
  assert.equal(optionLabel(rows.same), '我的第 2 张 · 已上墙 · 同一刻');
  assert.equal(optionLabel(rows.late), '我的第 1 张 · 已上墙 · 不是同一刻（隔了 1 小时）');
  assert.equal(optionLabel(rows['no-time']), '我的第 5 张 · 已上墙', 'a missing time: nothing is claimed in the label');
  assert.deepEqual(Object.fromEntries(Object.entries(rows).map(([id, row]) => [id, verdictOf(row)])), { stage: 'recommended', 'other-stage': 'other-side', same: 'same', late: 'apart', 'no-time': 'unknown' });
  assert.equal(verdictLabel(rows.late), '不是同一刻（隔了 1 小时）');
});

test('labels: the gap is said the way moment.js says it', () => {
  const rows = byId(rowsFor([photo('five', 'me', at(21, 53, 30), 'stage'), photo('three-and-a-bit', 'me', at(21, 51, 6), 'stage'), photo('days', 'me', venueTime(2026, 9, 29, 21, 48), 'stage')]));
  assert.equal(verdictLabel(rows.five), '不是同一刻（隔了 5 分多钟）');
  assert.equal(verdictLabel(rows['three-and-a-bit']), '不是同一刻（隔了 3 分多钟）', '3:01 is not "3 分钟": at most 3:00 is the same moment');
  assert.equal(verdictLabel(rows.days), '不是同一刻（隔了 3 天）');
});

test('recommended index: first row only, never more than one, none without an other side', () => {
  const some = rowsFor([photo('a', 'me', at(23, 5), 'crowd'), photo('b', 'me', at(21, 47, 50), 'stage')]);
  assert.deepEqual(some.map(row => [row.photo.id, row.recommended]), [['b', true], ['a', false]]);
  assert.equal(some.findIndex(row => row.recommended), 0);
  const many = rowsFor([photo('a', 'me', at(21, 47, 0), 'stage'), photo('b', 'me', at(21, 47, 30), 'detail'), photo('c', 'me', at(21, 48, 0), 'friends')]);
  assert.equal(many.filter(row => row.recommended).length, 1);
  assert.equal(many.filter(row => row.reading.complementary).length, 3);
  assert.equal(many[0].recommended, true);
  const none = rowsFor([photo('a', 'me', at(21, 48, 0), 'crowd'), photo('b', 'me', at(23, 5), 'stage')]);
  assert.ok(none.every(row => !row.recommended));
  assert.ok(rowsFor([photo('a', 'me', at(21, 48, 0), 'crowd')], photo('t', 'man', null, 'stage')).every(row => !row.recommended), 'the other photo has no time: nothing to recommend');
});

test('ranking: other side in the same moment, then the same moment, then the rest by the rule\'s own order (relevance, then the smaller known gap)', () => {
  const mine = [
    photo('far-stage', 'me', at(23, 5), 'stage'),
    photo('no-time-stage', 'me', null, 'stage'),
    photo('same-crowd', 'me', at(21, 48, 0), 'crowd'),
    photo('near-stage', 'me', at(21, 47, 50), 'stage'),
  ];
  const rows = rowsFor(mine);
  assert.deepEqual(rows.map(row => row.photo.id), ['near-stage', 'same-crowd', 'far-stage', 'no-time-stage'], 'moment.js scores both leftovers alike; a gap that is known sorts before one that is not');
  assert.deepEqual(rows.map(row => row.number), [4, 3, 1, 2], 'numbers stay with the photos: far-stage was the 1st, no-time-stage the 2nd');
});

test('reason text: the whole sentence for a 同一刻, the first clause for anything else, an honest line when a time is missing', () => {
  const rows = byId(rowsFor([photo('stage', 'me', at(21, 47, 50), 'stage'), photo('same', 'me', at(21, 48, 0), 'crowd'), photo('late', 'me', at(23, 5), 'crowd'), photo('no-time', 'me', null, 'stage')]));
  assert.equal(reasonText(rows.stage, target), '同一刻 · 21:47，相差不到 1 分钟；你拍舞台，TA 拍人海');
  assert.equal(reasonText(rows.same, target), '同一刻 · 21:48，几乎同时；你们都拍了人海');
  assert.equal(reasonText(rows.late, target), '不是同一刻（拍摄时间隔了 1 小时）');
  assert.ok(!reasonText(rows.late, target).includes('；'), 'no hope for an other side that the rule did not find');
  assert.equal(reasonText(rows['no-time'], target), '你的这张没有拍摄时间，无法判断是不是同一刻。');
  const noTimeTheirs = rowsFor([photo('mine', 'me', at(21, 48, 0), 'stage')], photo('t', 'man', null, 'crowd'))[0];
  assert.equal(reasonText(noTimeTheirs, photo('t', 'man', null, 'crowd')), '对方的这张没有拍摄时间，无法判断是不是同一刻。');
  const noTimeEither = rowsFor([photo('mine', 'me', null, 'stage')], photo('t', 'man', null, 'crowd'))[0];
  assert.equal(reasonText(noTimeEither, photo('t', 'man', null, 'crowd')), '两张照片都没有拍摄时间，无法判断是不是同一刻。');
});

test('options markup: placeholder first, best first, the chosen one selected, text escaped', () => {
  const evil = '"><script>alert(1)</script>';
  const rows = rowsFor([photo('late', 'me', at(23, 5), 'crowd'), photo(evil, 'me', at(21, 47, 50), 'stage')]);
  const html = optionsMarkup(rows, { selectedId: evil, esc });
  assert.ok(html.startsWith(`<option value="">${PLACEHOLDER}</option>`));
  assert.equal(PLACEHOLDER, '选择自己拍的照片');
  assert.ok(!html.includes('<script'), 'no markup from an id');
  assert.match(html, /<option value="&quot;&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt;" selected>我的第 2 张 · 已上墙 · 同一刻的另一面（推荐）<\/option>/);
  assert.ok(html.indexOf('我的第 2 张') < html.indexOf('我的第 1 张'), 'the recommended option is listed first');
  assert.equal((html.match(/ selected>/g) || []).length, 1);
  assert.equal((optionsMarkup(rows, { esc }).match(/ selected>/g) || []).length, 0);
  assert.ok(optionsMarkup(rows).includes('&quot;&gt;&lt;script'), 'escapes without an escaper given');
  assert.equal(optionsMarkup([], { esc }), `<option value="">${PLACEHOLDER}</option>`);
});

test('suggestion markup: the reason of the chosen option, a note when nothing is recommended, hidden when there is nothing to say', () => {
  const rows = rowsFor([photo('late', 'me', at(23, 5), 'crowd'), photo('stage', 'me', at(21, 47, 50), 'stage')]);
  const chosen = suggestionMarkup(rows, { selectedId: 'stage', target, esc });
  assert.match(chosen, /^<p class="exchange-reason is-recommended" id="exchange-reason" data-x-reason>/);
  assert.match(chosen, /同一刻 · <span class="nowrap">21:47<\/span>，<span class="nowrap">相差不到 1 分钟<\/span>；<span class="nowrap">你拍舞台，<\/span><span class="nowrap">TA 拍人海<\/span>/);
  assert.ok(chosen.includes(`<small>${RULE_NOTE}</small>`));
  assert.equal(RULE_NOTE, '规则判断，不是 AI。要不要交换，仍由你和对方决定。');
  const apart = suggestionMarkup(rows, { selectedId: 'late', target, esc });
  assert.ok(!apart.includes('is-recommended'));
  assert.equal(plain(apart), '不是同一刻（拍摄时间隔了 1 小时）' + RULE_NOTE);
  assert.match(apart, /<span class="nowrap">不是同一刻<\/span>（<span class="nowrap">拍摄时间<\/span><span class="nowrap">隔了 1 小时<\/span>）/, 'moment.js reasonHtml keeps the small units whole');
  assert.equal(suggestionMarkup(rows, { selectedId: null, target, esc }), '<p class="exchange-reason" id="exchange-reason" data-x-reason hidden></p>', 'the recommendation is shown by selecting it, not by a second line');
  const nothing = rows.filter(row => !row.recommended);
  assert.equal(suggestionMarkup(nothing, { selectedId: null, target, esc }), `<p class="exchange-reason" id="exchange-reason" data-x-reason>${NO_RECOMMENDATION}</p>`);
  assert.equal(suggestionMarkup([], { selectedId: null, target, esc }), '<p class="exchange-reason" id="exchange-reason" data-x-reason hidden></p>');
  assert.ok(!NO_RECOMMENDATION.includes('AI'));
});

// ---- the panel -------------------------------------------------------------------------------------------------------------------

const source = readFileSync(new URL('../web/event-room/exchange-panel.js', import.meta.url), 'utf8').replace(/^import .*;$/gm, '').replace(/^export /gm, '');
const tick = () => new Promise(done => setImmediate(done));
const defer = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

function fakeNode() {
  const selectors = new Map();
  const events = new Map();
  const node = {
    hidden: false, innerHTML: '', textContent: '', dataset: {}, scrollTop: 0, isConnected: true, events,
    setAttribute() {}, removeAttribute() {}, append() {}, remove() {}, focus() {}, contains: () => false, querySelectorAll: () => [],
    querySelector(selector) { if (!selectors.has(selector)) selectors.set(selector, fakeNode()); return selectors.get(selector); },
    addEventListener(type, fn) { if (!events.has(type)) events.set(type, []); events.get(type).push(fn); },
  };
  return node;
}

/** The panel with a fake controller. `photos` are the room's photos as the app holds them; `me` is the actor. */
function setup({ photos, pollMs, eventDate = DATE, fetchPhoto } = {}) {
  const me = 'me';
  const root = fakeNode();
  const timers = new Map();
  let nextTimer = 0;
  const calls = [];
  const state = { actorId: me, identityStatus: 'ready', list: { items: [], loaded: true, nextCursor: null, cursor: null }, current: null, error: null, lastResult: null, storage: { ok: true, message: null }, pending: [] };
  const client = {
    getState: () => structuredClone(state), subscribe() {}, syncIdentity() {}, close() {}, dispose() {}, invalidatePermissions() {},
    async list() { calls.push(['list']); }, async refreshList() { calls.push(['refreshList']); }, async refresh() { calls.push(['refresh']); },
    async create(roomId, payload) { calls.push(['create', roomId, payload]); return { applied: true, committed: true, permissionConfirmed: true }; },
  };
  const context = { actorId: me, room: { id: 'room', joined: true, status: 'open' }, photos, members: [{ id: 'man', name: '小满·示例' }, { id: me, name: '我' }], eventDate };
  const fetched = [];
  const document = {
    createElement: tag => (tag === 'canvas' ? { width: 0, height: 0, getContext: () => ({ drawImage() {} }), toDataURL: () => 'data:image/jpeg;base64,AAAA' } : root),
    activeElement: fakeNode(), hidden: false, addEventListener() {}, removeEventListener() {},
  };
  const sandbox = vm.createContext({
    document, esc, offerSuggestions, optionsMarkup, suggestionMarkup, console,
    createExchangeController: () => client,
    URL: { createObjectURL: blob => `blob:${blob.id}`, revokeObjectURL() {} },
    createImageBitmap: async () => ({ width: 100, height: 80, close() {} }),
    setTimeout: (fn, delay) => { const id = ++nextTimer; timers.set(id, { fn, delay }); return id; },
    clearTimeout: id => timers.delete(id),
  });
  vm.runInContext(`${source}\nglobalThis.createExchangePanel = createExchangePanel;`, sandbox);
  const panel = sandbox.createExchangePanel({
    container: fakeNode(), getContext: () => context, pollMs,
    fetchPhoto: fetchPhoto || (async id => { fetched.push(id); return { id }; }),
  });
  const body = root.querySelector('.exchange-body');
  const fire = async (type, targetNode) => { for (const fn of root.events.get(type) || []) await fn({ target: targetNode, stopPropagation() {}, preventDefault() {} }); await tick(); };
  const button = attributes => ({ dataset: {}, hasAttribute: name => name in attributes, closest() { return this; } });
  return {
    panel, root, body, calls, timers, fetched, context, state,
    pollDelays: () => [...timers.values()].map(timer => timer.delay),
    choose: value => fire('change', { value, hasAttribute: name => name === 'data-x-choice' }),
    consent: checked => fire('change', { checked, hasAttribute: name => name === 'data-x-consent' }),
    send: () => fire('click', button({ 'data-x-send': '' })),
    html: () => body.innerHTML,
    selected: () => /<option value="([^"]*)" selected>/.exec(body.innerHTML)?.[1] ?? null,
  };
}

const mineRows = [
  photo('mine-late', 'me', at(23, 5), 'crowd', { visibility: 'members' }),
  photo('mine-stage', 'me', at(21, 47, 50), 'stage', { visibility: 'private' }),
  photo('mine-crowd', 'me', at(21, 48, 0), 'crowd'),
];
const roomPhotos = [target, ...mineRows];

test('panel: poll interval defaults to 5000 ms and takes pollMs when it is a positive number', async () => {
  const defaults = setup({ photos: roomPhotos });
  await defaults.panel.open();
  assert.deepEqual(defaults.pollDelays(), [5000]);
  const fast = setup({ photos: roomPhotos, pollMs: 2000 });
  await fast.panel.open();
  assert.deepEqual(fast.pollDelays(), [2000]);
  for (const bad of [0, -1, NaN, null, '2000', Infinity]) {
    const odd = setup({ photos: roomPhotos, pollMs: bad });
    await odd.panel.open();
    assert.deepEqual(odd.pollDelays(), [5000], `pollMs ${String(bad)} falls back to the default`);
  }
});

test('panel: the poll timer runs the refresh and schedules the next one at the same interval', async () => {
  const fast = setup({ photos: roomPhotos, pollMs: 2000 });
  await fast.panel.open();
  const [[id, timer]] = [...fast.timers.entries()];
  fast.timers.delete(id);
  await timer.fn();
  await tick();
  assert.ok(fast.calls.some(call => call[0] === 'refreshList'));
  assert.deepEqual(fast.pollDelays(), [2000]);
});

test('panel: compose lists my photos best first and pre-selects the recommended one after the target image has loaded', async () => {
  const run = setup({ photos: roomPhotos });
  await run.panel.openOffer(target);
  assert.deepEqual(run.fetched, ['t-crowd', 'mine-stage'], 'the target image loads first, then the recommended photo is read through choose()');
  assert.equal(run.selected(), 'mine-stage');
  const html = run.html();
  const order = ['mine-stage', 'mine-crowd', 'mine-late'].map(id => html.indexOf(`<option value="${id}"`));
  assert.ok(order.every(index => index > 0) && order[0] < order[1] && order[1] < order[2], 'best first');
  assert.match(html, />我的第 2 张 · 未上墙 · 同一刻的另一面（推荐）<\/option>/);
  assert.match(html, />我的第 3 张 · 已上墙 · 同一刻<\/option>/);
  assert.match(html, />我的第 1 张 · 已上墙 · 不是同一刻（隔了 1 小时）<\/option>/);
  assert.match(html, /<select data-x-choice aria-describedby="exchange-reason">/);
  assert.match(html, /<p class="exchange-reason is-recommended" id="exchange-reason" data-x-reason>同一刻 · <span class="nowrap">21:47<\/span>/);
  assert.ok(html.includes(RULE_NOTE));
});

test('panel: the consent box and the send button stay manual; nothing is sent until both are done', async () => {
  const run = setup({ photos: roomPhotos });
  await run.panel.openOffer(target);
  assert.match(run.html(), /<input data-x-consent type="checkbox" >/, 'not ticked for the person');
  assert.match(run.html(), /data-x-send disabled>/, 'send is disabled until the box is ticked');
  await run.send();
  assert.equal(run.calls.some(call => call[0] === 'create'), false, 'a click on a disabled send sends nothing');
  await run.consent(true);
  assert.match(run.html(), /<input data-x-consent type="checkbox" checked>/);
  assert.doesNotMatch(run.html(), /data-x-send disabled>/);
  assert.equal(run.calls.some(call => call[0] === 'create'), false, 'ticking sends nothing either');
  await run.send();
  const sent = run.calls.filter(call => call[0] === 'create');
  assert.equal(sent.length, 1);
  assert.equal(sent[0][1], 'room');
  assert.deepEqual({ ...sent[0][2], offeredPreviewDataUrl: undefined }, {
    recipientId: 'man', offeredPhotoId: 'mine-stage', requestedPhotoId: 't-crowd', offeredRevision: 1, requestedRevision: 1,
    offerPreviewConsent: true, offerOriginalConsent: true, offeredPreviewDataUrl: undefined,
  });
  assert.match(sent[0][2].offeredPreviewDataUrl, /^data:image\/jpeg;base64,/);
});

test('panel: the person can choose another photo, which resets the consent', async () => {
  const run = setup({ photos: roomPhotos });
  await run.panel.openOffer(target);
  await run.consent(true);
  await run.choose('mine-crowd');
  assert.equal(run.selected(), 'mine-crowd');
  assert.match(run.html(), /<input data-x-consent type="checkbox" >/, 'choosing again asks for consent again');
  assert.match(run.html(), /同一刻 · <span class="nowrap">21:48<\/span>，<span class="nowrap">几乎同时<\/span>；<span class="nowrap">你们都拍了人海<\/span>/);
  assert.doesNotMatch(run.html(), /is-recommended/, 'the reason of a photo that is not the recommended one is not styled as the recommendation');
  await run.choose('');
  assert.equal(run.selected(), null);
});

test('panel: a choice made while the target image loads is never overridden by the recommendation', async () => {
  const gate = defer();
  const fetched = [];
  const run = setup({ photos: roomPhotos, fetchPhoto: async id => { fetched.push(id); if (id === 't-crowd') await gate.promise; return { id }; } });
  const opening = run.panel.openOffer(target);
  await tick();
  await run.choose('mine-late');
  assert.equal(run.selected(), 'mine-late');
  gate.resolve();
  await opening;
  await tick();
  assert.equal(run.selected(), 'mine-late');
  assert.deepEqual(fetched, ['t-crowd', 'mine-late']);
});

test('panel: without a recommendation nothing is pre-selected and the select says so', async () => {
  const photos = [target, photo('m-crowd', 'me', at(21, 48, 0), 'crowd'), photo('m-late', 'me', at(23, 5), 'stage')];
  const run = setup({ photos });
  await run.panel.openOffer(target);
  assert.equal(run.selected(), null);
  assert.deepEqual(run.fetched, ['t-crowd'], 'only the target image was read');
  assert.ok(run.html().includes(NO_RECOMMENDATION));
  assert.match(run.html(), /data-x-send disabled>/);
});

test('panel: no photos of mine, no pre-selection and the old message', async () => {
  const run = setup({ photos: [target] });
  await run.panel.openOffer(target);
  assert.equal(run.selected(), null);
  assert.ok(run.html().includes('你在这一场还没有照片。先保存一张自己的，再回来交换。'));
  assert.ok(run.html().includes('<p class="exchange-reason" id="exchange-reason" data-x-reason hidden></p>'));
});

test('panel: photos without capture time keep the old labels and say why they cannot be compared', async () => {
  const photos = [photo('t-plain', 'man', null, null), photo('m1', 'me', null, null), photo('m2', 'me', null, null, { visibility: 'private' })];
  const run = setup({ photos });
  await run.panel.openOffer(photos[0]);
  assert.equal(run.selected(), null);
  assert.match(run.html(), />我的第 1 张 · 已上墙<\/option>/);
  assert.match(run.html(), />我的第 2 张 · 未上墙<\/option>/);
  await run.choose('m1');
  assert.ok(plain(run.html()).includes('两张照片都没有拍摄时间，无法判断是不是同一刻。'));
});

test('panel: eventDate from getContext() decides how times read', async () => {
  const withDate = setup({ photos: roomPhotos, eventDate: DATE });
  await withDate.panel.openOffer(target);
  assert.match(withDate.html(), /同一刻 · <span class="nowrap">21:47<\/span>，/);
  const withoutDate = setup({ photos: roomPhotos, eventDate: '' });
  await withoutDate.panel.openOffer(target);
  assert.ok(withoutDate.html().includes('9月26日 21:47'), 'no event day known: the day is printed');
});

test('panel: a target image that cannot be read, or a panel closed while it loads, pre-selects nothing', async () => {
  const failing = setup({ photos: roomPhotos, fetchPhoto: async id => { if (id === 't-crowd') throw Error('读不到'); return { id }; } });
  await failing.panel.openOffer(target);
  assert.equal(failing.selected(), null);
  assert.equal(failing.root.querySelector('.exchange-problem').textContent, '读不到');
  const gate = defer();
  const fetched = [];
  const closing = setup({ photos: roomPhotos, fetchPhoto: async id => { fetched.push(id); if (id === 't-crowd') await gate.promise; return { id }; } });
  const opening = closing.panel.openOffer(target);
  await tick();
  closing.panel.close();
  gate.resolve();
  await opening;
  await tick();
  assert.deepEqual(fetched, ['t-crowd'], 'nothing else was read after the panel closed');
});

test('panel: opening another photo while the first is loading keeps the first from selecting anything', async () => {
  const other = photo('t-other', 'man', at(23, 5), 'stage');
  const gate = defer();
  const fetched = [];
  const run = setup({ photos: [...roomPhotos, other], fetchPhoto: async id => { fetched.push(id); if (id === 't-crowd') await gate.promise; return { id }; } });
  const first = run.panel.openOffer(target);
  await tick();
  await run.panel.openOffer(other);
  gate.resolve();
  await first;
  await tick();
  assert.equal(run.selected(), 'mine-late', 'the second offer pre-selected its own recommendation');
  assert.ok(!fetched.includes('mine-stage'), 'the first offer, replaced while loading, read nothing of mine');
  assert.ok(run.html().includes('blob:t-other'), 'the second offer is the one on screen');
});
