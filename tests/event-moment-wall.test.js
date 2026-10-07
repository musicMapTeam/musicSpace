// The photo wall's markup. The rules are tested in event-moment-model.test.js; here: what the viewer sees (group headers, the badge, the tags,
// the meta lines, and no pipeline ribbon), that the plain wall is exactly today's grid, pagination, and that nothing a person typed can carry markup.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { venueTime } from '../web/js/moment.js';
import { escape as esc } from '../web/avatar/model.js';
import * as WALL from '../web/event-room/moment-wall.js';
import { BADGE_TITLE, EMPTY_WALL, EXCHANGED_TAG, GROUP_NOTE, OFFER_LABEL, UNTIMED_TITLE, photoMetaHtml, wallMarkup } from '../web/event-room/moment-wall.js';

const DATE = '2026.09.26';
const at = (hour, minute, second = 0) => venueTime(2026, 9, 26, hour, minute, second);
let serial = 0;
const photo = (id, ownerId, takenAt, viewpoint, extra = {}) => ({
  id, roomId: 'room', ownerId, visibility: 'members', revision: 1,
  createdAt: new Date(Date.UTC(2026, 9, 5, 10, 0, serial++)).toISOString(),
  takenAt, takenSource: takenAt === null ? null : 'manual', viewpoint: viewpoint ?? null, viewpointSource: viewpoint ? 'manual' : null, ...extra,
});
const members = [{ id: 'me', name: '我自己' }, { id: 'yao', name: '阿遥' }, { id: 'man', name: '小满' }, { id: 'bei', name: '北屿' }];

// app.js's own photo button (its photoCards item), which the wall must wrap and never rewrite
const nameOf = ownerId => members.find(member => member.id === ownerId)?.name || '观众';
const renderItem = p => `<button class="photo-item" data-photo="${esc(p.id)}"><span>正在读取照片…</span><strong>${esc(nameOf(p.ownerId))}</strong><small>${p.visibility === 'private' ? '照片墙：不展示' : '照片墙：本场成员可见'}</small></button>`;
// app.js's photoCards before this change (line 153): the wall must reduce to exactly this when no photo has a trusted time
const legacy = (photos, shown = 24) => (photos.length
  ? `<div class="photo-grid">${photos.slice(0, shown).map(renderItem).join('')}</div>${photos.length > shown ? '<button class="quiet" data-show-more>再看 24 张</button>' : ''}`
  : '<div class="empty"><b>还没有照片。</b><p>别急，今晚总有一个瞬间值得留下。</p></div>');

const yao = photo('yao-stage', 'yao', at(21, 47, 20), 'stage');
const manCrowd = photo('man-crowd', 'man', at(21, 48, 5), 'crowd');
const bei = photo('bei-detail', 'bei', at(21, 49, 30), 'detail');
const manNear = photo('man-near', 'man', at(22, 21, 10), 'friends');
const mine = photo('me-stage', 'me', at(21, 47, 50), 'stage');
const wall = (photos, extra = {}) => wallMarkup({ photos, members, ownId: 'me', eventDate: DATE, shown: 24, renderItem, esc, ...extra });

const plain = html => html.replace(/<[^>]*>/g, '').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
const sectionsOf = html => [...html.matchAll(/<section class="moment-group[^"]*" data-moment-group="([^"]*)"[\s\S]*?<\/section>/g)].map(match => ({ key: match[1], html: match[0] }));
const cardsOf = html => html.split(/(?=<div class="moment-card)/).slice(1).map(chunk => chunk.split('</section>')[0]).map(chunk => ({ id: /data-moment-photo="([^"]*)"/.exec(chunk)[1], html: chunk }));
const count = (html, needle) => html.split(needle).length - 1;
const metaLines = html => [...html.matchAll(/<p class="moment-meta">(.*?)<\/p>/g)].map(match => plain(match[1]));

test('plain wall: with no trusted capture time the output is exactly the grid app.js drew before', () => {
  const noTime = ['a', 'b', 'c', 'd', 'e', 'f'].map(id => photo(id, id === 'a' ? 'me' : 'yao', null, id === 'b' ? 'crowd' : null));
  assert.equal(wall(noTime), legacy(noTime));
  const fileTime = noTime.map(item => ({ ...item, takenAt: at(21, 47), takenSource: 'file' }));
  assert.equal(wall(fileTime), legacy(fileTime), 'a file modification time is not a trusted time');
  const withAi = noTime.map(item => ({ ...item, viewpoint: 'crowd', viewpointSource: 'ai' }));
  assert.equal(wall(withAi), legacy(withAi), 'no times: the wall stays plain, whoever chose the sides');
  assert.equal(wall([]), legacy([]));
  assert.equal(wall([]), EMPTY_WALL);
  assert.equal(wallMarkup(), EMPTY_WALL);
  assert.equal(wallMarkup({ photos: [null, 3, 'x'] }), EMPTY_WALL);
});

test('plain wall: 24 photos and a 再看 24 张 button beyond them, like before', () => {
  const many = Array.from({ length: 30 }, (_, index) => photo(`p${index}`, 'yao', null, null));
  assert.equal(wall(many), legacy(many));
  assert.equal(count(wall(many), 'class="photo-item"'), 24);
  assert.equal(count(wall(many), 'data-show-more'), 1);
  assert.equal(wall(many, { shown: 48 }), legacy(many, 48));
  assert.equal(count(wall(many, { shown: 48 }), 'data-show-more'), 0);
  assert.equal(wall(many, { shown: undefined }), legacy(many), 'shown defaults to 24');
});

test('moment wall: one section per moment, header with the sides, one note, the items followed by their meta line', () => {
  const html = wall([yao, manCrowd, manNear, bei, mine]);
  const sections = sectionsOf(html);
  assert.deepEqual(sections.map(section => section.key), [`m${at(21, 47, 20)}`, `m${at(22, 21, 10)}`]);
  assert.deepEqual(sections.map(section => plain(/<h3[^>]*>([\s\S]*?)<\/h3>/.exec(section.html)[1])), ['21:47 · 同一刻 · 3 个视角：舞台 · 人海 · 细节', '22:21']);
  assert.equal(GROUP_NOTE, '3 分钟内拍下');
  assert.equal(count(plain(html), GROUP_NOTE), 1, 'the note sits under the header of the group that claims 同一刻, not under a lone photo');
  assert.equal(plain(/<p class="moment-group__note">(.*?)<\/p>/.exec(sections[0].html)[1]), GROUP_NOTE);
  assert.match(sections[0].html, /<p class="moment-group__note"><span class="nowrap">3 分钟内<\/span>拍下<\/p>/, 'the 「3」 never ends a line alone');
  assert.doesNotMatch(html, /规则判断|不是 AI|按拍摄时间分组/, 'the note says what the group is, not how it was worked out');
  assert.ok(!sections[1].html.includes('moment-group__note'));
  assert.deepEqual(cardsOf(sections[0].html).map(entry => entry.id), ['man-crowd', 'yao-stage', 'me-stage', 'bei-detail'], 'the best other side first, the rest in time order');
  assert.deepEqual(cardsOf(sections[1].html).map(entry => entry.id), ['man-near']);
  for (const entry of cardsOf(html)) {
    assert.ok(entry.html.includes(renderItem([yao, manCrowd, manNear, bei, mine].find(item => item.id === entry.id))), 'renderItem output is used untouched');
    assert.match(entry.html, /<\/button><p class="moment-meta">/, 'the meta line follows the item');
    assert.match(metaLines(entry.html)[0], /^拍摄于 \d\d:\d\d · 视角：.+ · 作者选择$/);
  }
  assert.equal(count(html, '<h3'), 2);
  assert.match(html, /^<div class="moment-wall" data-moment-wall>/);
});

test('moment wall: only the best other side carries the 同一刻的另一面 block with the reason and the exchange button', () => {
  const html = wall([yao, manCrowd, manNear, bei, mine]);
  assert.equal(count(html, 'data-moment-badge="other-side"'), 1);
  assert.equal(count(html, 'data-exchange-offer='), 1);
  const owner = cardsOf(html).filter(entry => entry.html.includes('data-moment-badge'));
  assert.deepEqual(owner.map(entry => entry.id), ['man-crowd']);
  const badge = /<div class="moment-badge"[\s\S]*?<\/button><\/div>/.exec(owner[0].html)[0];
  assert.equal(plain(/<b class="moment-badge__title">([\s\S]*?)<\/b>/.exec(badge)[1]), BADGE_TITLE);
  assert.equal(BADGE_TITLE, '同一刻的另一面');
  assert.equal(plain(/<p class="moment-badge__reason">([\s\S]*?)<\/p>/.exec(badge)[1]), '同一刻 · 21:47，相差不到 1 分钟；你拍舞台，TA 拍人海');
  assert.match(badge, /<span class="nowrap">21:47<\/span>/, 'the reason is moment.js reasonHtml: small units do not break');
  assert.match(badge, /<button type="button" class="primary" data-exchange-offer="man-crowd" aria-label="和 TA 交换这个视角（小满 的照片）">和 TA 交换这个视角<\/button>/);
  assert.equal(OFFER_LABEL, '和 TA 交换这个视角');
  // the block leads the best card (it is drawn there, so focus meets the button first too): the block, then the item, then its meta line
  assert.ok(owner[0].html.indexOf('data-moment-badge') < owner[0].html.indexOf('class="photo-item"'), 'the block, then the item');
  assert.ok(owner[0].html.indexOf('class="photo-item"') < owner[0].html.indexOf('<p class="moment-meta">'), 'the item, then its meta line');
  assert.match(owner[0].html, /^<div class="moment-card moment-card--best" data-moment-photo="man-crowd"><div class="moment-badge" data-moment-badge="other-side">/);
  assert.match(owner[0].html, /<\/button><p class="moment-meta">[\s\S]*<\/p><\/div>$/, 'the meta line closes the card');
  assert.ok(owner[0].html.includes('moment-card moment-card--best'));
});

test('moment wall: other same-moment photos get the small 同一刻 tag; the rest, and my own, get nothing', () => {
  const html = wall([yao, manCrowd, manNear, bei, mine]);
  const tagged = cardsOf(html).filter(entry => entry.html.includes('data-moment-tag')).map(entry => entry.id);
  assert.deepEqual(tagged, ['yao-stage', 'bei-detail']);
  assert.match(cardsOf(html).find(entry => entry.id === 'yao-stage').html, /<span class="moment-tag" data-moment-tag>同一刻<\/span><\/div>$/);
  const near = cardsOf(html).find(entry => entry.id === 'man-near').html;
  assert.ok(!near.includes('moment-tag') && !near.includes('moment-badge'), 'an hour later is not the same moment');
  const own = cardsOf(html).find(entry => entry.id === 'me-stage').html;
  assert.ok(!own.includes('moment-tag') && !own.includes('moment-badge'));
});

test('moment wall: a viewer with no photo, no side or no time gets groups but no badge', () => {
  const noPhoto = wall([yao, manCrowd, bei], { ownId: 'nobody' });
  assert.equal(sectionsOf(noPhoto).length, 1);
  assert.deepEqual(cardsOf(noPhoto).map(entry => entry.id), ['yao-stage', 'man-crowd', 'bei-detail'], 'plain time order when nothing is marked');
  assert.equal(count(noPhoto, 'data-moment-badge'), 0);
  assert.equal(count(noPhoto, 'data-moment-tag'), 0);
  assert.equal(count(noPhoto, 'data-exchange-offer'), 0);
  const noSide = wall([yao, manCrowd, bei, photo('me-noside', 'me', at(21, 47, 50), null)]);
  assert.equal(count(noSide, 'data-moment-badge'), 0);
  assert.equal(count(noSide, 'data-moment-tag'), 3, 'still the same moment, just no other side to name');
  const noTime = wall([yao, manCrowd, bei, photo('me-notime', 'me', null, 'stage')]);
  assert.equal(count(noTime, 'data-moment-badge'), 0);
  assert.equal(count(noTime, 'data-moment-tag'), 0);
  const unknownViewer = wall([yao, manCrowd, bei, mine], { ownId: '' });
  assert.equal(count(unknownViewer, 'data-moment-badge'), 0, 'no viewer id, no pairing');
});

test('moment wall: photos that already have an exchange are not offered again; the mark moves to the next other side', () => {
  const list = [yao, manCrowd, manNear, bei, mine];
  const moved = wall(list, { exchanged: ['man-crowd'] });
  assert.equal(count(moved, 'data-moment-badge="other-side"'), 1);
  assert.equal(count(moved, 'data-exchange-offer="man-crowd"'), 0, 'no button to offer the same photo twice');
  assert.equal(count(moved, 'data-exchange-offer="bei-detail"'), 1);
  const crowd = cardsOf(moved).find(entry => entry.id === 'man-crowd').html;
  assert.match(crowd, /<span class="moment-tag" data-moment-tag>同一刻<\/span><span class="moment-tag moment-tag--done" data-moment-exchanged>已有交换<\/span><\/div>/);
  assert.equal(EXCHANGED_TAG, '已有交换');
  assert.deepEqual(cardsOf(sectionsOf(moved)[0].html).map(entry => entry.id), ['bei-detail', 'yao-stage', 'me-stage', 'man-crowd'], 'the new pick comes first, the rest in time order');
  const none = wall(list, { exchanged: new Set(['man-crowd', 'bei-detail']) });
  assert.equal(count(none, 'data-moment-badge'), 0);
  assert.equal(count(none, 'data-exchange-offer'), 0);
  assert.equal(count(none, 'data-moment-exchanged'), 2);
  const own = wall(list, { exchanged: ['man-crowd', 'me-stage'] });
  assert.equal(count(own, 'data-moment-exchanged'), 1, 'my own photo is not tagged');
  const elsewhere = wall(list, { exchanged: ['man-near'] });
  assert.match(cardsOf(elsewhere).find(entry => entry.id === 'man-near').html, /data-moment-exchanged/, 'the state is shown wherever the photo is');
  assert.equal(count(elsewhere, 'data-exchange-offer="man-crowd"'), 1);
  for (const junk of ['man-crowd', 7, null, {}, true]) assert.equal(count(wall(list, { exchanged: junk }), 'data-exchange-offer="man-crowd"'), 1, 'only an array or a Set counts');
  assert.equal(wall(list, { exchanged: [] }), wall(list), 'no exchanges: exactly the same wall');
});

test('moment wall: a photo that is not on the wall for members cannot be offered', () => {
  const hidden = { ...manCrowd, visibility: 'private' };
  const html = wall([yao, hidden, bei, mine]);
  assert.equal(count(html, 'data-exchange-offer="man-crowd"'), 0);
  assert.equal(cardsOf(html).find(entry => entry.id === 'bei-detail').html.includes('data-moment-badge'), true, 'the next best visible photo takes the block');
});

test('moment wall: photos without a trusted time come last, in their own section, and are never paired', () => {
  const html = wall([photo('no-time', 'yao', null, 'crowd'), yao, manCrowd, photo('file-time', 'man', at(21, 48), 'stage', { takenSource: 'file' }), mine]);
  const sections = sectionsOf(html);
  assert.equal(sections.at(-1).key, 'untimed');
  assert.equal(sections.length, 2);
  assert.equal(plain(/<h3[^>]*>([\s\S]*?)<\/h3>/.exec(sections.at(-1).html)[1]), UNTIMED_TITLE);
  assert.equal(UNTIMED_TITLE, '没有拍摄时间');
  assert.ok(!sections.at(-1).html.includes('moment-group__note'), 'the heading 没有拍摄时间 says it all: no note under it');
  assert.ok(!/无法按时间配对/.test(html));
  assert.deepEqual(cardsOf(sections.at(-1).html).map(entry => entry.id), ['no-time', 'file-time'], 'in the order given');
  assert.ok(!/data-moment-badge|data-moment-tag|data-exchange-offer/.test(sections.at(-1).html));
  assert.ok(!sections.at(-1).html.includes('同一刻'), 'no claim about the moment for a photo without a time');
  assert.deepEqual(metaLines(sections.at(-1).html), ['视角：人海 · 作者选择', '视角：舞台 · 作者选择'], 'the side is still shown, and a file time is not shown as a capture time');
});

test('moment wall: no pipeline ribbon, even when some photo carries a side the model suggested; that photo\'s own line says so', () => {
  assert.equal(WALL.PIPELINE_RIBBON, undefined, 'the ribbon sentence is gone');
  assert.equal(WALL.UNTIMED_NOTE, undefined, 'and so is the note under 没有拍摄时间');
  const manual = wall([yao, manCrowd, bei, mine]);
  assert.equal(count(manual, 'moment-ribbon'), 0, 'seeded photos are the authors\' own choices');
  const withAi = wall([yao, manCrowd, bei, { ...mine, viewpointSource: 'ai' }]);
  assert.equal(count(withAi, 'moment-ribbon'), 0, 'no strip above the groups');
  assert.ok(!/AI 建议视角|规则找同一刻|双方同意才交换/.test(withAi));
  assert.ok(withAi.startsWith('<div class="moment-wall" data-moment-wall><section'), 'the first group opens the wall');
  assert.deepEqual(metaLines(cardsOf(withAi).find(entry => entry.id === 'me-stage').html), ['拍摄于 21:47 · 视角：舞台 · AI 建议，未改动'], 'the AI byline stays on the photo itself');
  const aiWithoutSide = wall([yao, manCrowd, { ...mine, viewpoint: null, viewpointSource: 'ai' }]);
  assert.equal(count(aiWithoutSide, 'moment-ribbon'), 0);
  assert.ok(!/AI 建议/.test(aiWithoutSide), 'a source without a side claims nothing');
});

test('moment wall: respects shown, keeps the 再看 24 张 button, and renders only the photos on the wall', () => {
  const many = Array.from({ length: 30 }, (_, index) => photo(`p${String(index).padStart(2, '0')}`, 'yao', at(20, index), index % 2 ? 'crowd' : 'stage'));
  const rendered = [];
  const html = wall(many, { renderItem: item => { rendered.push(item.id); return renderItem(item); } });
  assert.equal(count(html, 'data-moment-photo='), 24);
  assert.equal(rendered.length, 24);
  assert.deepEqual(new Set(rendered), new Set(many.slice(0, 24).map(item => item.id)), 'the first 24 of the list given, which are the images app.js loads');
  assert.equal(count(html, '<button class="quiet" data-show-more>再看 24 张</button>'), 1);
  assert.ok(html.endsWith('<button class="quiet" data-show-more>再看 24 张</button>'));
  const all = wall(many, { shown: 48 });
  assert.equal(count(all, 'data-moment-photo='), 30);
  assert.equal(count(all, 'data-show-more'), 0);
  assert.equal(count(wall(many, { shown: 5 }), 'data-moment-photo='), 5);
});

test('moment wall: my own photos beyond the wall still decide which visible photo is the other side', () => {
  const crowd = Array.from({ length: 24 }, (_, index) => photo(`o${index}`, 'yao', index === 0 ? at(21, 48, 5) : at(19, index), index === 0 ? 'crowd' : 'stage'));
  const html = wall([...crowd, mine], { shown: 24 });
  assert.equal(count(html, 'data-moment-photo="me-stage"'), 0, 'my photo is not on this page of the wall');
  assert.equal(count(html, 'data-exchange-offer="o0"'), 1, 'but it still finds the crowd photo that is');
});

test('moment wall: the order of the list does not change the sections or the badge', () => {
  const list = [yao, manCrowd, manNear, bei, mine];
  const expected = wall(list);
  for (const order of [[mine, bei, manNear, manCrowd, yao], [manNear, mine, yao, bei, manCrowd], [bei, yao, mine, manCrowd, manNear]]) assert.equal(wall(order), expected);
});

test('moment wall: nothing a person typed becomes markup', () => {
  const evil = '"><img src=x onerror=alert(1)><script>alert(2)</script>';
  const hostile = [
    photo(evil, 'evil', at(21, 48, 5), 'crowd'),
    photo(`${evil}2`, 'evil', at(21, 48, 30), 'detail'),
    { ...mine },
  ];
  const html = wall(hostile, { members: [...members, { id: 'evil', name: `<b>${evil}</b>` }] });
  assert.ok(!html.includes('<script'), 'no script element');
  assert.ok(!/<img src=x/.test(html), 'no injected image');
  assert.ok(!html.includes(`"${evil}`), 'no attribute breakout');
  assert.match(html, /data-exchange-offer="&quot;&gt;&lt;img src=x onerror=alert\(1\)&gt;&lt;script&gt;alert\(2\)&lt;\/script&gt;"/);
  assert.match(html, /data-moment-photo="&quot;&gt;&lt;img/);
  assert.match(html, /aria-label="和 TA 交换这个视角（&lt;b&gt;&quot;&gt;&lt;img src=x onerror=alert\(1\)&gt;&lt;script&gt;alert\(2\)&lt;\/script&gt;&lt;\/b&gt; 的照片）"/);
  const wrongSides = wall([{ ...yao, viewpoint: '<img src=x>', viewpointSource: 'ai' }, { ...manCrowd, takenSource: '<b>' }]);
  assert.ok(!wrongSides.includes('<img src=x>'));
  assert.equal(count(wrongSides, 'data-moment-ribbon'), 0);
});

test('moment wall: the escaper and renderItem given are the ones used; a missing escaper still escapes', () => {
  const marks = [];
  const html = wall([yao, manCrowd, mine], { esc: text => { marks.push(String(text)); return `«${text}»`; } });
  assert.ok(html.includes('data-exchange-offer="«man-crowd»"'));
  assert.ok(marks.includes('man-crowd'));
  const noEsc = wallMarkup({ photos: [{ ...manCrowd, id: 'a"b' }, yao, mine], ownId: 'me', eventDate: DATE, renderItem: () => '' });
  assert.ok(noEsc.includes('data-exchange-offer="a&quot;b"'));
  assert.ok(wallMarkup({ photos: [yao, manCrowd], ownId: 'me', eventDate: DATE }).includes('data-moment-wall'), 'no renderItem: still markup, no throw');
  const noMembers = wallMarkup({ photos: [yao, manCrowd, mine], ownId: 'me', eventDate: DATE, renderItem, esc });
  assert.ok(noMembers.includes('data-exchange-offer="man-crowd">和 TA 交换这个视角</button>'), 'no name known: the button has no aria-label, its own text names it');
});

test('moment wall: only attributes app.js already routes or that are the wall\'s own', () => {
  const html = wall([yao, manCrowd, manNear, bei, mine, photo('x', 'yao', null, null)], { renderItem: () => '', exchanged: ['man-near'] });
  const names = new Set([...html.matchAll(/ (data-[a-z-]+)/g)].map(match => match[1]));
  assert.deepEqual([...names].sort(), ['data-exchange-offer', 'data-moment-badge', 'data-moment-exchanged', 'data-moment-group', 'data-moment-photo', 'data-moment-tag', 'data-moment-wall'].filter(name => names.has(name)).sort());
  assert.ok(!names.has('data-moment-ribbon'), 'the ribbon hook is gone with its text');
  assert.ok(names.has('data-exchange-offer') && names.has('data-moment-group'));
  assert.ok(!/ id="(?!moment-title-)/.test(html), 'the only ids are the section heading ids');
});

test('moment wall: section headings are labelled for screen readers and ids are unique', () => {
  const html = wall([yao, manCrowd, manNear, bei, mine, photo('x', 'yao', null, null)]);
  const labels = [...html.matchAll(/aria-labelledby="([^"]+)"/g)].map(match => match[1]);
  const ids = [...html.matchAll(/ id="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(labels.sort(), ids.sort());
  assert.equal(new Set(ids).size, ids.length);
});

test('moment wall: small units never break across lines, and a long date may break between its day and its clock', () => {
  const html = wall([yao, manCrowd, bei, mine]);
  const title = /<h3[^>]*>(.*?)<\/h3>/.exec(html)[1];
  // the clock, 「同一刻」 and the sides are parts of their own; the 「 · 」 between them is a span (read aloud, spaced on screen), the text is the same
  assert.equal(title, '<span class="moment-group__clock"><span class="nowrap">21:47</span></span><span class="moment-group__sep"> · </span><span class="nowrap moment-group__same">同一刻</span><span class="moment-group__sep"> · </span>'
    + '<span class="moment-group__sides pc-dots"><span class="pc-dots__in"><span class="pc-dots__item"><span class="nowrap">3 个视角：</span><span class="nowrap">舞台</span></span><span class="moment-group__sep"> · </span><span class="pc-dots__item"><span class="nowrap">人海</span></span><span class="moment-group__sep"> · </span><span class="pc-dots__item"><span class="nowrap">细节</span></span></span></span>');
  assert.match(html, /<p class="moment-meta"><span class="moment-meta__time"><span class="nowrap">拍摄于 21:47<\/span><\/span><span class="moment-meta__sep"> · <\/span><span class="nowrap">视角：舞台<\/span><span class="moment-meta__sep"> · <\/span><span class="nowrap moment-meta__by">作者选择<\/span><\/p>/);
  const untimedSide = wall([yao, photo('no-time', 'man', null, 'crowd')]);
  assert.match(untimedSide, /<p class="moment-meta"><span class="nowrap">视角：人海<\/span><span class="moment-meta__sep"> · <\/span><span class="nowrap moment-meta__by">作者选择<\/span><\/p>/, 'no time: no time part, the byline is still marked');
  const single = /<h3[^>]*>(.*?)<\/h3>/.exec(wall([manNear, yao]).split('data-moment-group="m').at(-1))[1];
  assert.equal(single, '<span class="moment-group__clock"><span class="nowrap">22:21</span></span>', 'a group of one photo is its clock alone');
  const old = photo('old', 'yao', venueTime(2025, 7, 10, 10, 53), 'crowd', { viewpointSource: 'ai' });
  const oldHtml = wall([old, photo('old2', 'man', venueTime(2025, 7, 10, 10, 54), 'detail')]);
  assert.deepEqual(metaLines(oldHtml), ['拍摄于 2025年7月10日 10:53 · 视角：人海 · AI 建议，未改动', '拍摄于 2025年7月10日 10:54 · 视角：细节 · 作者选择']);
  assert.match(oldHtml, /<span class="nowrap moment-meta__by moment-meta__by--ai">AI 建议，未改动<\/span>/, 'the AI byline is marked apart from 作者选择');
  assert.equal(count(oldHtml, 'moment-meta__by--ai'), 1);
  assert.ok(!/<span class="nowrap">拍摄于 2025/.test(oldHtml), 'a unit never holds a whole long date, which would not fit a narrow column');
  assert.equal(plain(/<h3[^>]*>(.*?)<\/h3>/.exec(oldHtml)[1]), '2025年7月10日 10:53 · 同一刻 · 2 个视角：人海 · 细节');
});

test('photoMetaHtml: the wall\'s meta line in its parts, for the captions app.js draws outside the wall; nothing for a photo with nothing to say', () => {
  const kept = photo('me-ai', 'me', at(21, 47, 50), 'stage', { viewpointSource: 'ai' });
  const parts = photoMetaHtml(kept, { eventDate: DATE, esc });
  assert.equal(parts, '<span class="moment-meta__time"><span class="nowrap">拍摄于 21:47</span></span><span class="moment-meta__sep"> · </span><span class="nowrap">视角：舞台</span>'
    + '<span class="moment-meta__sep"> · </span><span class="nowrap moment-meta__by moment-meta__by--ai">AI 建议，未改动</span>');
  assert.ok(wall([yao, kept]).includes(`<p class="moment-meta">${parts}</p>`), 'the wall\'s own line for that photo is the same markup');
  assert.equal(plain(photoMetaHtml(yao, { eventDate: DATE })), '拍摄于 21:47 · 视角：舞台 · 作者选择', 'without an escaper given it escapes on its own; the text is the meta line');
  assert.equal(photoMetaHtml(photo('bare', 'man', null, null), { eventDate: DATE, esc }), '');
  assert.equal(photoMetaHtml({ viewpoint: '<b>x</b>', viewpointSource: 'ai' }, { esc }), '');
  assert.equal(photoMetaHtml(null), '');
});

test('moment wall: junk in any photo field never throws and never becomes markup (seeded fuzz)', () => {
  let state = 424242;
  const random = () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 2 ** 32; };
  const evil = ['<script>alert(1)</script>', '"><img src=x onerror=alert(1)>', "'; DROP TABLE photos; --", '__proto__', '&amp;', '\u0000', '\u202e', ''];
  const junk = () => {
    const pool = [null, undefined, NaN, Infinity, -1, 0, 1_790_430_420_000, '1790430420000', true, [], {}, ...evil, 'stage', 'crowd', 'manual', 'exif', 'ai', 'members', 'private'];
    return pool[Math.floor(random() * pool.length)];
  };
  for (let round = 0; round < 300; round++) {
    const photos = Array.from({ length: Math.floor(random() * 12) }, () => (random() < 0.05 ? junk() : {
      id: junk(), ownerId: random() < 0.3 ? 'me' : junk(), visibility: junk(), takenAt: random() < 0.5 ? at(21, Math.floor(random() * 6)) : junk(), takenSource: junk(), viewpoint: junk(), viewpointSource: junk(), createdAt: junk(),
    }));
    const html = wallMarkup({ photos, members: random() < 0.2 ? junk() : [{ id: 'me', name: junk() }, junk()], ownId: random() < 0.8 ? 'me' : junk(), eventDate: random() < 0.5 ? DATE : junk(), shown: junk(), renderItem: item => `<button class="photo-item" data-photo="${esc(item.id)}"></button>`, esc });
    assert.equal(typeof html, 'string');
    assert.ok(!/<script|<img/i.test(html), `round ${round}: ${html.slice(0, 200)}`);
    assert.equal(count(html, '<section'), count(html, '</section>'));
    assert.ok(count(html, 'data-moment-badge') <= 1);
  }
});
