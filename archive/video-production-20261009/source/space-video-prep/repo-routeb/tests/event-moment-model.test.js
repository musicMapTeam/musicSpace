// Pure rules of the photo wall (no DOM). The pairing rules themselves are web/js/moment.js and are tested by scripts/test/moment.test.mjs;
// these tests pin what the room adds on top: grouping, which photo is 「同一刻的另一面」, the suggestion order and the byline text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SAME_MOMENT_MS, orderWall, readPair, trustedTime, venueTime } from '../web/js/moment.js';
import { cardOf, groupTitle, momentGroups, offerSuggestions, photoMetaLine, photoTime, readingReason, viewpointByline, wallReadings } from '../web/event-room/moment-model.js';

const DATE = '2026.09.26';
const at = (hour, minute, second = 0) => venueTime(2026, 9, 26, hour, minute, second);
let serial = 0;
/** A room photo as the worker's photoJSON returns it. */
const photo = (id, takenAt, viewpoint, extra = {}) => ({
  id, roomId: 'room', ownerId: extra.ownerId ?? `owner-${id}`, visibility: 'members', revision: 1,
  createdAt: new Date(Date.UTC(2026, 9, 5, 10, 0, serial++)).toISOString(),
  takenAt, takenSource: takenAt === null ? null : 'manual', viewpoint: viewpoint ?? null, viewpointSource: viewpoint ? 'manual' : null, ...extra,
});
const ids = list => list.map(item => item.id);

// the fictional night the demo shows: three photos inside one 3-minute window, one much later
const yaoStage = photo('yao-stage', at(21, 47, 20), 'stage');
const manCrowd = photo('man-crowd', at(21, 48, 5), 'crowd');
const beiDetail = photo('bei-detail', at(21, 49, 30), 'detail');
const manNear = photo('man-near', at(22, 21, 10), 'friends');
const cast = [yaoStage, manCrowd, manNear, beiDetail];

test('cardOf gives moment.js the fields it reads and nothing it could mistake for a chosen moment', () => {
  const card = cardOf({ id: 'p1', takenAt: 5, takenSource: 'exif', viewpoint: 'stage', createdAt: '2026-10-05T10:00:00.000Z', visibility: 'members', imageUrl: '/x' });
  assert.deepEqual(card, { id: 'p1', takenAt: 5, takenSource: 'exif', perspective: 'stage', momentId: '', createdAt: '2026-10-05T10:00:00.000Z' });
  assert.deepEqual(cardOf({ id: 'p2' }), { id: 'p2', takenAt: null, takenSource: null, perspective: '', momentId: '', createdAt: undefined });
  assert.deepEqual(cardOf({ id: 'p3', takenAt: null, viewpoint: null }), { id: 'p3', takenAt: null, takenSource: null, perspective: '', momentId: '', createdAt: undefined });
  assert.equal(cardOf(null).perspective, '', 'a missing photo does not throw');
});

test('photoTime is the time moment.js would pair by: camera or typed only', () => {
  assert.equal(photoTime({ takenAt: 1_800_000_000_000, takenSource: 'exif' }), 1_800_000_000_000);
  assert.equal(photoTime({ takenAt: 1_800_000_000_000, takenSource: 'manual' }), 1_800_000_000_000);
  assert.equal(photoTime({ takenAt: 1_800_000_000_000, takenSource: 'file' }), null, 'a file modification time is a guess');
  assert.equal(photoTime({ takenAt: 1_800_000_000_000, takenSource: null }), null);
  assert.equal(photoTime({ takenAt: null, takenSource: 'exif' }), null);
  assert.equal(photoTime({ takenAt: '1800000000000', takenSource: 'exif' }), null, 'a string is not a time');
  assert.equal(photoTime({ takenAt: NaN, takenSource: 'manual' }), null);
});

test('viewpointByline says who decided the side, and says nothing without one', () => {
  assert.equal(viewpointByline({ viewpoint: 'crowd', viewpointSource: 'ai' }), 'AI 建议，未改动');
  assert.equal(viewpointByline({ viewpoint: 'stage', viewpointSource: 'manual' }), '作者选择');
  assert.equal(viewpointByline({ viewpoint: null, viewpointSource: null }), '');
  assert.equal(viewpointByline({}), '');
  assert.equal(viewpointByline({ viewpoint: 'crowd', viewpointSource: null }), '', 'no source, no claim');
  assert.equal(viewpointByline({ viewpoint: 'crowd', viewpointSource: 'server' }), '');
  assert.equal(viewpointByline({ viewpoint: '<b>', viewpointSource: 'ai' }), '', 'an unknown side is no side');
  assert.equal(viewpointByline(undefined), '');
});

test('momentGroups: any two photos of a group are within 3:00; exactly 3:00 is in and 3:00.001 is out', () => {
  const base = at(21, 0, 0);
  const edge = momentGroups([{ id: 'a', takenAt: base, takenSource: 'manual' }, { id: 'b', takenAt: base + SAME_MOMENT_MS, takenSource: 'manual' }, { id: 'c', takenAt: base + SAME_MOMENT_MS + 1, takenSource: 'manual' }]);
  assert.deepEqual(edge.groups.map(group => ids(group.photos)), [['a', 'b'], ['c']]);
  assert.equal(SAME_MOMENT_MS, 180_000);
  for (const group of edge.groups) assert.ok(group.endAt - group.startAt <= SAME_MOMENT_MS);
});

test('momentGroups: a group is anchored at its earliest photo, so a chain of near photos does not stretch it', () => {
  const base = at(21, 0, 0);
  const chain = momentGroups([0, 120, 240, 360].map((seconds, index) => ({ id: `p${index}`, takenAt: base + seconds * 1000, takenSource: 'exif' })));
  // p2 is 4:00 after the anchor p0 although only 2:00 after p1: it opens a new group, which then takes p3 (2:00 after it)
  assert.deepEqual(chain.groups.map(group => ids(group.photos)), [['p0', 'p1'], ['p2', 'p3']]);
  assert.deepEqual(chain.groups.map(group => group.startAt), [base, base + 240_000]);
});

test('momentGroups: time order, labels, flags, distinct sides in the order moment.js lists them, untimed last in the order given', () => {
  const untimedA = photo('no-time-a', null, 'crowd');
  const untimedB = photo('file-time', at(21, 50), 'stage', { takenSource: 'file' });
  const { groups, untimed } = momentGroups([manNear, untimedA, beiDetail, untimedB, yaoStage, manCrowd, photo('dup-stage', at(21, 48, 40), 'stage')], { eventDate: DATE });
  assert.deepEqual(groups.map(group => group.label), ['21:47', '22:21']);
  assert.deepEqual(groups.map(group => group.key), [`m${at(21, 47, 20)}`, `m${at(22, 21, 10)}`]);
  assert.deepEqual(ids(groups[0].photos), ['yao-stage', 'man-crowd', 'dup-stage', 'bei-detail']);
  assert.deepEqual(groups[0].viewpoints, ['stage', 'crowd', 'detail'], 'stage appears twice and is listed once');
  assert.equal(groups[0].sameMoment, true);
  assert.equal(groups[1].sameMoment, false);
  assert.deepEqual(groups[1].viewpoints, ['friends']);
  assert.deepEqual(ids(untimed), ['no-time-a', 'file-time'], 'a file time is not a trusted time');
  assert.equal(groups[0].startAt, at(21, 47, 20));
  assert.equal(groups[0].endAt, at(21, 49, 30));
});

test('momentGroups: a photo on another day prints its own day; photos are never dropped or doubled', () => {
  const late = photo('after-midnight', venueTime(2026, 9, 27, 0, 12), 'stage');
  const { groups } = momentGroups([late, yaoStage], { eventDate: DATE });
  assert.deepEqual(groups.map(group => group.label), ['21:47', '9月27日 00:12']);
  assert.deepEqual(momentGroups([], {}), { groups: [], untimed: [] });
  assert.deepEqual(momentGroups(undefined), { groups: [], untimed: [] });
  assert.deepEqual(momentGroups([null, 7, 'x']), { groups: [], untimed: [] });
});

test('momentGroups: equal times fall back to the upload time then the id, whatever order the photos arrive in', () => {
  const same = at(21, 47, 0);
  const first = { id: 'z-first', takenAt: same, takenSource: 'manual', createdAt: '2026-10-05T10:00:00.000Z' };
  const second = { id: 'a-second', takenAt: same, takenSource: 'manual', createdAt: '2026-10-05T10:00:05.000Z' };
  const third = { id: 'b-third', takenAt: same, takenSource: 'manual', createdAt: '2026-10-05T10:00:05.000Z' };
  for (const order of [[first, second, third], [third, second, first], [second, first, third]]) {
    assert.deepEqual(ids(momentGroups(order).groups[0].photos), ['z-first', 'a-second', 'b-third']);
  }
});

test('groupTitle: 「21:47 · 同一刻 · 3 个视角：舞台 · 人海 · 细节」, a lone photo is only its time', () => {
  const { groups } = momentGroups([...cast, photo('me', at(21, 47, 50), 'stage')], { eventDate: DATE });
  assert.equal(groupTitle(groups[0]), '21:47 · 同一刻 · 3 个视角：舞台 · 人海 · 细节');
  assert.equal(groupTitle(groups[1]), '22:21');
  const noSides = momentGroups([photo('x', at(20, 0), null), photo('y', at(20, 1), null)], { eventDate: DATE }).groups[0];
  assert.equal(groupTitle(noSides), '20:00 · 同一刻 · 2 张照片');
  const oneSide = momentGroups([photo('x', at(20, 0), 'stage'), photo('y', at(20, 1), 'stage')], { eventDate: DATE }).groups[0];
  assert.equal(groupTitle(oneSide), '20:00 · 同一刻 · 1 个视角：舞台');
});

test('wallReadings: the visitor who took the stage gets 「另一面」 on the crowd photo; the same side is 同一刻 but not 另一面', () => {
  const mine = photo('me-stage', at(21, 47, 50), 'stage', { ownerId: 'me' });
  const { byPhoto, best } = wallReadings([mine], cast, { eventDate: DATE });
  assert.equal(best, 'man-crowd');
  assert.equal(byPhoto.get('man-crowd').reading.complementary, true);
  assert.match(byPhoto.get('man-crowd').reading.detail, /^同一刻 · 21:47，相差不到 1 分钟；你拍舞台，TA 拍人海$/);
  assert.equal(byPhoto.get('man-crowd').mine, mine);
  assert.equal(byPhoto.get('yao-stage').reading.same, true);
  assert.equal(byPhoto.get('yao-stage').reading.complementary, false, 'you both shot the stage');
  assert.equal(byPhoto.get('bei-detail').reading.complementary, true, 'also another side, but a larger gap');
  assert.equal(byPhoto.get('man-near').reading.same, false);
  assert.equal(byPhoto.get('man-near').reading.basis, 'apart');
  assert.equal(byPhoto.size, 4);
});

test('wallReadings: the crowd photo of the other sample pairs with the stage photo', () => {
  const mine = photo('me-crowd', at(21, 48, 10), 'crowd', { ownerId: 'me' });
  assert.equal(wallReadings([mine], cast, { eventDate: DATE }).best, 'yao-stage');
});

test('wallReadings: no photo of mine, or none with a side, or none with a time: nothing is 另一面', () => {
  assert.deepEqual(wallReadings([], cast, { eventDate: DATE }), { byPhoto: new Map(), best: null });
  assert.equal(wallReadings(undefined, cast).best, null);
  const noSide = photo('me-noside', at(21, 47, 50), null, { ownerId: 'me' });
  const noSideReadings = wallReadings([noSide], cast, { eventDate: DATE });
  assert.equal(noSideReadings.best, null);
  assert.equal(noSideReadings.byPhoto.get('man-crowd').reading.same, true, 'still the same moment');
  const noTime = photo('me-notime', null, 'stage', { ownerId: 'me' });
  const noTimeReadings = wallReadings([noTime], cast, { eventDate: DATE });
  assert.equal(noTimeReadings.best, null);
  assert.ok([...noTimeReadings.byPhoto.values()].every(found => !found.reading.same));
  assert.equal(wallReadings([photo('me', at(21, 47, 50), 'stage')], []).best, null);
});

test('wallReadings: equal gaps give the same best photo in every arrival order', () => {
  const mine = photo('me', at(21, 48, 0), 'stage', { ownerId: 'me' });
  const early = photo('early', at(21, 47, 30), 'crowd', { createdAt: '2026-10-05T10:00:09.000Z' }); // 30 s before
  const late = photo('late', at(21, 48, 30), 'detail', { createdAt: '2026-10-05T10:00:01.000Z' }); // 30 s after
  const twin = photo('twin', at(21, 48, 30), 'crowd', { createdAt: '2026-10-05T10:00:01.000Z' }); // same time, same upload second as `late`
  const orders = [[early, late, twin], [twin, late, early], [late, early, twin], [late, twin, early], [twin, early, late], [early, twin, late]];
  for (const order of orders) assert.equal(wallReadings([mine], order, { eventDate: DATE }).best, 'early', 'the earlier capture wins an equal gap');
  const sameTimeOrders = [[late, twin], [twin, late]];
  for (const order of sameTimeOrders) assert.equal(wallReadings([mine], order, { eventDate: DATE }).best, 'late', 'then the earlier upload, then the id');
});

test('wallReadings: of several photos of mine the closest same-moment one reads, and the best other side is the closest', () => {
  const near = photo('me-near', at(21, 47, 55), 'stage', { ownerId: 'me' });
  const far = photo('me-far', at(21, 49, 0), 'stage', { ownerId: 'me' });
  const readings = wallReadings([far, near], cast, { eventDate: DATE });
  assert.equal(readings.byPhoto.get('man-crowd').mine, near);
  assert.equal(readings.best, 'man-crowd');
  assert.equal(readings.byPhoto.get('bei-detail').mine, far, 'the 30 s gap to the later photo beats the 95 s gap to the earlier');
});

test('wallReadings: skipped photos keep their reading but are never the pick, so the mark moves on', () => {
  const mine = photo('me-stage', at(21, 47, 50), 'stage', { ownerId: 'me' });
  assert.equal(wallReadings([mine], cast, { eventDate: DATE }).best, 'man-crowd');
  const moved = wallReadings([mine], cast, { eventDate: DATE, skip: ['man-crowd'] });
  assert.equal(moved.best, 'bei-detail', 'the next other side in the same moment');
  assert.equal(moved.byPhoto.get('man-crowd').reading.complementary, true, 'the reading itself is unchanged');
  assert.equal(wallReadings([mine], cast, { eventDate: DATE, skip: new Set(['man-crowd', 'bei-detail']) }).best, null, 'nothing left to offer');
  for (const junk of ['man-crowd', 5, null, undefined, {}, true]) assert.equal(wallReadings([mine], cast, { eventDate: DATE, skip: junk }).best, 'man-crowd', 'only an array or a Set counts');
});

test('wallReadings: one of my own photos handed in as an "other" is skipped, and hostile ids stay plain keys', () => {
  const mine = photo('me', at(21, 47, 50), 'stage', { ownerId: 'me' });
  assert.equal(wallReadings([mine], [mine, manCrowd]).byPhoto.has('me'), false);
  const hostile = ['__proto__', 'constructor', 'toString', '"><img src=x onerror=alert(1)>', '<script>alert(1)</script>'];
  const others = hostile.map((id, index) => photo(id, at(21, 48, index), index % 2 ? 'detail' : 'crowd'));
  const readings = wallReadings([mine], others, { eventDate: DATE });
  assert.equal(readings.byPhoto.size, hostile.length);
  for (const id of hostile) assert.equal(readings.byPhoto.get(id).reading.same, true);
  assert.equal(readings.best, '__proto__', 'the smallest gap (10 s) wins; the id is a plain string like any other');
  assert.equal(Object.keys(Object.prototype).length, 0, 'nothing leaked into the prototype');
});

test('offerSuggestions: best first, only the first 另一面 is recommended, numbers follow the list given', () => {
  const target = manCrowd; // crowd at 21:48:05
  const sameSide = photo('mine-crowd', at(21, 48, 0), 'crowd', { ownerId: 'me' });
  const later = photo('mine-late', at(23, 5, 0), 'crowd', { ownerId: 'me' });
  const stage = photo('mine-stage', at(21, 47, 50), 'stage', { ownerId: 'me', visibility: 'private' });
  const rows = offerSuggestions([later, sameSide, stage], target, { eventDate: DATE });
  assert.deepEqual(ids(rows.map(row => row.photo)), ['mine-stage', 'mine-crowd', 'mine-late']);
  assert.deepEqual(rows.map(row => row.recommended), [true, false, false]);
  assert.deepEqual(rows.map(row => row.number), [3, 2, 1]);
  assert.deepEqual(rows.map(row => row.viewpoint), ['舞台', '人海', '人海']);
  assert.equal(rows[0].reading.complementary, true);
  assert.equal(rows[1].reading.same, true);
  assert.equal(rows[2].reading.basis, 'apart');
  assert.equal(rows.filter(row => row.recommended).length, 1);
});

test('offerSuggestions: a second 另一面 is not recommended; with none there is no recommendation; ties keep the order given', () => {
  const target = manCrowd;
  const a = photo('a-stage', at(21, 47, 50), 'stage', { ownerId: 'me' });
  const b = photo('b-stage', at(21, 47, 55), 'stage', { ownerId: 'me' });
  const rows = offerSuggestions([a, b], target, { eventDate: DATE });
  assert.deepEqual(rows.map(row => [row.photo.id, row.reading.complementary, row.recommended]), [['b-stage', true, true], ['a-stage', true, false]], 'the closer one first');
  const tied = offerSuggestions([photo('t1', at(21, 48, 35), 'stage', { ownerId: 'me' }), photo('t2', at(21, 47, 35), 'stage', { ownerId: 'me' })], target, { eventDate: DATE });
  assert.deepEqual(ids(tied.map(row => row.photo)), ['t1', 't2'], 'a 30 s gap on either side ties; the list order decides');
  const none = offerSuggestions([photo('c', at(21, 48, 0), 'crowd', { ownerId: 'me' }), photo('n', null, 'stage', { ownerId: 'me' })], target, { eventDate: DATE });
  assert.ok(none.every(row => !row.recommended));
  assert.deepEqual(offerSuggestions([], target), []);
  assert.deepEqual(offerSuggestions(undefined, target), []);
});

test('offerSuggestions agrees with moment.js on every pair, and never invents a rule', () => {
  const target = manCrowd;
  const mine = [photo('m1', at(21, 48, 0), 'stage'), photo('m2', at(22, 40, 0), 'stage'), photo('m3', null, 'stage'), photo('m4', at(21, 49, 0), null)];
  for (const row of offerSuggestions(mine, target, { eventDate: DATE })) {
    const reading = readPair(cardOf(row.photo), cardOf(target), { event: { date: DATE } });
    assert.deepEqual(row.reading, reading);
  }
});

test('photoMetaLine: time, side and who chose it; a missing part is left out', () => {
  assert.equal(photoMetaLine({ takenAt: at(21, 47, 20), takenSource: 'exif', viewpoint: 'crowd', viewpointSource: 'ai' }, { eventDate: DATE }), '拍摄于 21:47 · 视角：人海 · AI 建议，未改动');
  assert.equal(photoMetaLine(yaoStage, { eventDate: DATE }), '拍摄于 21:47 · 视角：舞台 · 作者选择');
  assert.equal(photoMetaLine(photo('x', at(21, 47), null), { eventDate: DATE }), '拍摄于 21:47');
  assert.equal(photoMetaLine(photo('x', null, 'detail'), { eventDate: DATE }), '视角：细节 · 作者选择');
  assert.equal(photoMetaLine(photo('x', null, null), { eventDate: DATE }), '');
  assert.equal(photoMetaLine({ takenAt: at(21, 47), takenSource: 'file', viewpoint: null }, { eventDate: DATE }), '', 'a file time is not shown as a capture time');
  assert.equal(photoMetaLine(photo('x', venueTime(2026, 9, 27, 0, 12), 'stage'), { eventDate: DATE }), '拍摄于 9月27日 00:12 · 视角：舞台 · 作者选择');
  assert.equal(photoMetaLine({ viewpoint: 'stage', viewpointSource: null }, {}), '视角：舞台', 'no source, no byline');
  assert.equal(photoMetaLine({ viewpoint: '<b>x</b>', viewpointSource: 'ai' }, {}), '');
  assert.equal(photoMetaLine(null), '');
  assert.equal(photoMetaLine(yaoStage, { eventDate: DATE, esc: text => `[${text}]` }), '[拍摄于 21:47 · 视角：舞台 · 作者选择]', 'the escaper given is applied to the whole line');
});

test('readingReason: all of a 同一刻, only the first clause of anything else', () => {
  const event = { date: DATE };
  const same = readPair(cardOf(photo('a', at(21, 47, 50), 'stage')), cardOf(manCrowd), { event });
  assert.equal(readingReason(same), same.detail);
  assert.match(readingReason(same), /你拍舞台，TA 拍人海/);
  const apart = readPair(cardOf(photo('a', at(22, 48, 5), 'stage')), cardOf(manCrowd), { event }); // exactly one hour after the crowd photo
  assert.match(apart.detail, /；/, 'the rule appends a hopeful tail');
  assert.equal(readingReason(apart), '不是同一刻（拍摄时间隔了 1 小时）');
  assert.equal(readingReason({ same: false, detail: '没有；分号后面' }), '没有');
  assert.equal(readingReason({ same: false, detail: '没有分号' }), '没有分号');
});

// ---- randomized invariants (seeded): the model never contradicts the rule ------------------------------------------------------------

function prng(seed) {
  let state = seed >>> 0;
  return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 2 ** 32; };
}

test('invariants over random rooms: groups are pairwise within 3:00 and complete; the best pick is complementary and unbeaten', () => {
  const random = prng(20261005);
  const sides = ['stage', 'crowd', 'friends', 'detail', null];
  for (let round = 0; round < 300; round++) {
    const count = 1 + Math.floor(random() * 14);
    const photos = Array.from({ length: count }, (_, index) => {
      const timed = random() > 0.2;
      return photo(`p${index}`, timed ? at(21, 0) + Math.floor(random() * 12 * 60_000) : null, sides[Math.floor(random() * sides.length)], { ownerId: random() > 0.7 ? 'me' : `o${index}` });
    });
    const { groups, untimed } = momentGroups(photos, { eventDate: DATE });
    assert.equal(groups.reduce((sum, group) => sum + group.photos.length, 0) + untimed.length, count);
    groups.forEach((group, index) => {
      assert.ok(group.endAt - group.startAt <= SAME_MOMENT_MS);
      for (const a of group.photos) for (const b of group.photos) assert.ok(Math.abs(photoTime(a) - photoTime(b)) <= SAME_MOMENT_MS);
      if (index) assert.ok(group.startAt - groups[index - 1].startAt > SAME_MOMENT_MS, 'the next group starts beyond the previous anchor window');
    });
    assert.ok(untimed.every(item => trustedTime(cardOf(item)) === null));
    const mine = photos.filter(item => item.ownerId === 'me');
    const others = photos.filter(item => item.ownerId !== 'me');
    const { byPhoto, best } = wallReadings(mine, others, { eventDate: DATE });
    const complementary = [...byPhoto.entries()].filter(([, found]) => found.reading.complementary);
    if (!complementary.length) { assert.equal(best, null); continue; }
    const top = byPhoto.get(best).reading;
    assert.ok(top.complementary && top.gapMs <= SAME_MOMENT_MS);
    for (const [, found] of complementary) assert.ok(found.reading.score < top.score || (found.reading.score === top.score && found.reading.gapMs >= top.gapMs), 'nothing beats the pick');
  }
});

test('with one photo of mine the pick is exactly what moment.js orderWall marks (no second ranking rule)', () => {
  const random = prng(5102026);
  const sides = ['stage', 'crowd', 'friends', 'detail', null];
  for (let round = 0; round < 300; round++) {
    const count = 1 + Math.floor(random() * 12);
    const others = Array.from({ length: count }, (_, index) => photo(`o${index}`, random() > 0.15 ? at(21, 0) + Math.floor(random() * 8 * 60_000) : null, sides[Math.floor(random() * sides.length)]));
    const mine = photo('me', random() > 0.1 ? at(21, 0) + Math.floor(random() * 8 * 60_000) : null, sides[Math.floor(random() * sides.length)], { ownerId: 'me' });
    const expected = orderWall(cardOf(mine), others.map(cardOf), { event: { date: DATE } });
    const { best, byPhoto } = wallReadings([mine], others, { eventDate: DATE });
    assert.equal(best, expected.best, `round ${round}`);
    for (const { card, reading } of expected.items) assert.deepEqual(byPhoto.get(card.id).reading, reading);
    const rows = offerSuggestions(others.map(item => ({ ...item, ownerId: 'me' })), mine, { eventDate: DATE });
    const pair = rows.find(row => row.recommended);
    const complementary = rows.filter(row => row.reading.complementary);
    assert.equal(Boolean(pair), complementary.length > 0);
    if (pair) assert.equal(pair, complementary[0]);
  }
});
