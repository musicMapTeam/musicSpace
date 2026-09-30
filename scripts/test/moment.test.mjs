// Rules of 「同一刻，另一面」 (web/js/moment.js): capture-time formatting, the 3-minute test, pairing and ranking, viewpoints, songs, ticket facts.
// Plain node:assert, no framework, no browser: `npm test` or `node scripts/test/moment.test.mjs`.
import assert from 'node:assert/strict';
import * as M from '../../web/js/moment.js';

const moments = [{ id: 'encore', name: '返场' }, { id: 'chorus', name: '全场合唱' }, { id: 'lights', name: '灯光亮起' }];
const event = { title: '回声现场', date: '2026.09.26', song: '把晚风借给你', isDemo: true };
const t = (h, m, s = 0) => M.venueTime(2026, 9, 26, h, m, s);

// venue clock
assert.equal(M.formatTaken(t(21, 47), '2026.09.26'), '21:47');
assert.equal(M.formatTaken(t(21, 47), '2026-09-26'), '21:47');
assert.equal(M.formatTaken(M.venueTime(2026, 9, 27, 0, 12), '2026.09.26'), '9月27日 00:12');
assert.equal(M.formatTaken(M.venueTime(2018, 4, 22, 15, 19), '2026.09.26'), '2018年4月22日 15:19');
assert.equal(M.toInputValue(t(21, 47)), '2026-09-26T21:47');
assert.equal(M.fromInputValue('2026-09-26T21:47'), t(21, 47));
assert.equal(M.fromInputValue('2026-09-26T21:47:30'), t(21, 47, 30));
assert.equal(M.fromInputValue('2026-02-30T21:47'), null);
assert.equal(M.fromInputValue(''), null);
assert.equal(M.fromInputValue('1999-12-31T23:59'), null);
assert.equal(M.fromInputValue('2999-01-01T00:00'), null);

// EXIF -> card time
const withOffset = M.takenFromExif({ epochMs: Date.parse('2026-09-26T21:47:10+08:00'), wallMs: Date.UTC(2026, 8, 26, 21, 47, 10), source: 'DateTimeOriginal', format: 'jpeg' });
assert.deepEqual(withOffset, { takenAt: Date.parse('2026-09-26T21:47:10+08:00'), trusted: true, zoneAssumed: false, origin: 'exif' });
const noOffset = M.takenFromExif({ epochMs: null, wallMs: Date.UTC(2026, 8, 26, 21, 47, 10), source: 'DateTimeOriginal', format: 'jpeg' });
assert.equal(noOffset.takenAt, Date.parse('2026-09-26T21:47:10+08:00'));
assert.equal(noOffset.zoneAssumed, true);
assert.equal(M.takenFromExif({ epochMs: null, wallMs: Date.UTC(2026, 8, 26, 21, 47, 10), source: 'DateTime', format: 'jpeg' }).trusted, false);
assert.equal(M.takenFromExif({ epochMs: null, wallMs: Date.UTC(2026, 8, 26, 21, 47, 10), source: 'DateTimeOriginal', format: 'png' }).trusted, false);
assert.equal(M.takenFromExif({ epochMs: null, wallMs: Date.UTC(1970, 0, 1), source: 'DateTimeOriginal', format: 'jpeg' }), null);
assert.equal(M.takenFromExif(null), null);
// the clock behind an EXIF time: a photo shot in another zone is shown converted to Beijing time, and says what it read
const xiaomi = { local: '2026-04-07T20:18:38', offset: '-07:00', epochMs: Date.parse('2026-04-07T20:18:38-07:00'), wallMs: Date.UTC(2026, 3, 7, 20, 18, 38), source: 'DateTimeOriginal', format: 'jpeg' };
assert.equal(M.formatTaken(M.takenFromExif(xiaomi).takenAt, '2026.09.26'), '4月8日 11:18');
assert.equal(M.zoneNote(xiaomi), '已换算成北京时间，照片自带的是 4月7日 20:18（UTC−07:00）');
assert.equal(M.zoneNote({ ...xiaomi, local: '2026-09-26T21:47:10', offset: '+08:00', epochMs: Date.parse('2026-09-26T21:47:10+08:00') }), '');
assert.equal(M.zoneNote({ ...xiaomi, local: '2026-09-26T21:47:10', offset: '+05:30', epochMs: Date.parse('2026-09-26T21:47:10+05:30') }), '已换算成北京时间，照片自带的是 9月26日 21:47（UTC+05:30）');
assert.equal(M.zoneNote({ local: '2026-09-26T21:47:10', offset: null, epochMs: null, wallMs: Date.UTC(2026, 8, 26, 21, 47, 10) }), '照片没写时区，按北京时间算');
assert.equal(M.zoneNote(null), '');
assert.equal(M.zoneNote({ offset: '-07:00', epochMs: 1 }), '');
assert.equal(M.takenFromFile({ epochMs: Date.now() - 1000 }).origin, 'file');
assert.equal(M.takenFromFile({ epochMs: 0 }), null);

// demo seeds
const lin = { id: 'a', perspective: 'stage', takenAt: t(21, 47), takenSource: 'sample', momentId: 'encore', trackId: 'co-0', createdAt: '2026-09-26T15:30:00Z' };
const yao = { id: 'b', perspective: 'crowd', takenAt: t(21, 48), takenSource: 'sample', momentId: 'encore', trackId: 'co-0', createdAt: '2026-09-26T15:30:00Z' };
const seedReading = M.readPair(lin, yao, { event, moments });
assert.equal(seedReading.detail, '同一刻 · 21:47，相差 1 分钟；你拍舞台，TA 拍人海');
assert.equal(seedReading.basis, 'time');
assert.equal(seedReading.complementary, true);
assert.equal(seedReading.title, '同一刻的另一面');
assert.equal(seedReading.score, 100); // the room's song rides on both seed cards: it is not a link the two people made
assert.equal(M.readPair(yao, lin, { event, moments }).detail, '同一刻 · 21:47，相差 1 分钟；你拍人海，TA 拍舞台');

// a song both typed ranks the card a little higher, and the reason says so
const songsBoth = M.readPair({ ...lin, song: '晴天' }, { ...yao, song: '《晴天》' }, { event, moments });
assert.equal(songsBoth.detail, '同一刻 · 21:47，相差 1 分钟；你拍舞台，TA 拍人海；都写下了《晴天》');
assert.equal(songsBoth.score, 105);
assert.equal(songsBoth.sharedSong, '晴天');
assert.equal(songsBoth.lead, '同一刻 · 21:47，相差 1 分钟'); // the ticket stub prints the song on its own line, so the lead stays clean
// a typed song that only one card names is no link
assert.equal(M.readPair({ ...lin, song: '晴天' }, yao, { event, moments }).score, 100);
assert.equal(M.readPair({ ...lin, song: '晴天' }, { ...yao, song: '别的歌' }, { event, moments }).score, 100);
// same typed song, times too far apart: not the same moment, no bonus
assert.equal(M.readPair({ ...lin, song: '晴天' }, { ...yao, song: '晴天', takenAt: t(23, 30) }, { event, moments }).score, 40);
// same typed song, no relation by moment: the song is the only thing they share
const songOnly = M.readPair({ id: 'm', perspective: 'stage', momentId: 'encore', song: '晴天' }, { id: 'o', perspective: 'detail', momentId: 'chorus', song: '晴天' }, { event: { title: 'x' }, moments });
assert.equal(songOnly.title, '带着同一首歌的记忆');
assert.equal(songOnly.same, false);
assert.equal(songOnly.detail, '都写下了《晴天》，各自记住了不同片刻。');

// ticket date line
assert.equal(M.ticketStamp({ takenAt: t(21, 47), takenSource: 'exif' }, event, '2026.09.26'), '2026.09.26 · 21:47');
assert.equal(M.ticketStamp({ takenAt: M.venueTime(2025, 7, 10, 10, 53), takenSource: 'exif' }, event, '2026.09.26'), '拍摄于 2025年7月10日 10:53');
assert.equal(M.ticketStamp({ takenAt: t(21, 47), takenSource: 'file' }, event, '2026.09.26'), '2026.09.26');
assert.equal(M.ticketStamp({}, event, '2026.09.26'), '2026.09.26');
assert.equal(M.ticketStamp({ takenAt: t(21, 47), takenSource: 'sample' }, event, '2026.09.26'), '2026.09.26 · 21:47');

// exactly 3 minutes is the same moment, 3:01 is not
const near = { ...yao, takenAt: t(21, 50) };
assert.equal(M.readPair(lin, near, { event, moments }).basis, 'time');
const far = { ...yao, takenAt: t(21, 50, 1) };
const farReading = M.readPair(lin, far, { event, moments });
assert.equal(farReading.basis, 'apart');
assert.equal(farReading.same, false);
assert.equal(farReading.complementary, false);
assert.match(farReading.detail, /不算同一刻/);
// Not 同一刻 but the same chosen moment: the bold title above the sentence (the rooms wall shows both) is the generic one, so
// "都选了「返场」" is not printed twice in a row.
assert.equal(farReading.title, '现场的另一面');
assert.ok(!farReading.detail.includes(farReading.title));
assert.match(farReading.detail, /你们都选了「返场」/);
// same minute
assert.match(M.readPair(lin, { ...yao, takenAt: t(21, 47, 5) }, { event, moments }).detail, /几乎同时/);
assert.match(M.readPair(lin, { ...yao, takenAt: t(21, 47, 40) }, { event, moments }).detail, /相差不到 1 分钟/);
assert.match(M.readPair(lin, { ...yao, takenAt: t(21, 48, 30) }, { event, moments }).detail, /相差 2 分钟/);
assert.equal(M.reasonHtml('同一刻 · 21:47，相差 1 分钟；你拍<舞台>'), '同一刻 · <span class="nowrap">21:47</span>，<span class="nowrap">相差 1 分钟</span>；你拍&lt;舞台&gt;');
// The viewpoint clauses, the moment name and a short song title are units too: a narrow column may end a line after "你拍舞台，"
// but never inside "TA 拍人海" (the orphaned 海), and never inside 「返场」.
assert.equal(M.reasonHtml(seedReading.detail), '同一刻 · <span class="nowrap">21:47</span>，<span class="nowrap">相差 1 分钟</span>；<span class="nowrap">你拍舞台，</span><span class="nowrap">TA 拍人海</span>');
assert.equal(M.reasonHtml('你们都选了「返场」，但拍摄时间隔了 2 小时，不算同一刻'), '你们都选了<span class="nowrap">「返场」</span>，但<span class="nowrap">拍摄时间</span><span class="nowrap">隔了 2 小时</span>，<span class="nowrap">不算同一刻</span>');
assert.equal(M.reasonHtml('按你们都选的「返场」算同一刻（你的照片没有拍摄时间）'), '按你们都选的<span class="nowrap">「返场」</span>算同一刻（你的照片没有<span class="nowrap">拍摄时间</span>）');
assert.equal(M.reasonHtml('你们都拍了细节；都写下了《晴天》'), '<span class="nowrap">你们都拍了细节</span>；都写下了<span class="nowrap">《晴天》</span>');
assert.equal(M.reasonHtml(`都写下了《${'字'.repeat(11)}》`), `都写下了《${'字'.repeat(11)}》`); // a long title stays free to wrap
assert.equal(M.reasonHtml('你拍<b>舞台</b>，TA 拍人海'), '你拍&lt;b&gt;舞台&lt;/b&gt;，<span class="nowrap">TA 拍人海</span>'); // typed text never becomes markup
assert.equal(M.reasonHtml(undefined), '');

// a visitor's own photo from another day
const visitor = { id: 'v', perspective: 'friends', takenAt: M.venueTime(2026, 9, 12, 12, 28), takenSource: 'exif', momentId: 'encore' };
const vr = M.readPair(visitor, yao, { event, moments });
assert.equal(vr.basis, 'apart');
assert.match(vr.detail, /你们都选了「返场」，但拍摄时间隔了 \d+ 天，不算同一刻；你拍身边，TA 拍人海/);

// a file-derived time is never used to decide 同一刻
const guessed = { id: 'g', perspective: 'stage', takenAt: t(21, 48), takenSource: 'file', momentId: 'encore' };
const gr = M.readPair(guessed, yao, { event, moments });
assert.equal(gr.basis, 'moment');
assert.match(gr.detail, /按你们都选的「返场」算同一刻（你的照片没有拍摄时间）；你拍舞台，TA 拍人海/);
assert.equal(M.trustedTime(guessed), null);
// nobody has a time and the moments differ
const other = { id: 'o', perspective: 'detail', momentId: 'chorus' };
const or = M.readPair({ id: 'm', perspective: 'stage', momentId: 'encore' }, other, { event: { title: 'x' }, moments });
assert.equal(or.basis, null);
assert.equal(or.same, false);
assert.equal(or.title, '现场的另一面');
// unknown viewpoint never claims "另一面"
const unknown = M.readPair({ id: 'm', perspective: '', takenAt: t(21, 47), takenSource: 'exif', momentId: 'encore' }, yao, { event: { date: '2026.09.26' }, moments });
assert.equal(unknown.basis, 'time');
assert.equal(unknown.complementary, false);
assert.equal(unknown.title, '同一刻');
assert.equal(unknown.detail, '同一刻 · 21:47，相差 1 分钟');
// legacy cards derive a viewpoint from the example photo
assert.equal(M.viewpointOf({ photoKey: 'crowd' }), 'crowd');
assert.equal(M.viewpointOf({ photoKey: 'custom' }), '');
assert.equal(M.viewpointOf({ photoKey: 'stage', perspective: '' }), '');
assert.equal(M.viewpointOf({ photoKey: 'stage', perspective: 'detail' }), 'detail');
// no own card
assert.equal(M.readPair(null, yao, { event, moments }).score, 0);

// wall ordering
const cards = [
  { id: 'x1', perspective: 'stage', momentId: 'chorus', createdAt: '2026-09-26T13:00:00Z' },
  { id: 'x2', perspective: 'crowd', takenAt: t(21, 49), takenSource: 'exif', momentId: 'encore', createdAt: '2026-09-26T13:05:00Z' },
  { id: 'x3', perspective: 'stage', takenAt: t(21, 47, 30), takenSource: 'exif', momentId: 'encore', createdAt: '2026-09-26T13:10:00Z' },
  { id: 'x4', perspective: 'detail', takenAt: t(21, 46), takenSource: 'exif', momentId: 'encore', createdAt: '2026-09-26T13:15:00Z' },
];
const mine = { id: 'me', perspective: 'stage', takenAt: t(21, 47), takenSource: 'exif', momentId: 'encore' };
const wall = M.orderWall(mine, cards, { event: { date: '2026-09-26' }, moments });
assert.deepEqual(wall.items.map(i => i.card.id), ['x4', 'x2', 'x3', 'x1']);
assert.equal(wall.best, 'x4'); // 1 minute apart and a different viewpoint beats 2 minutes
assert.equal(M.orderWall(mine, [], {}).best, null);
assert.equal(M.orderWall(mine, [cards[2]], { moments }).best, null); // same viewpoint: nothing complementary

// songs
assert.equal(M.cleanSong('  《晴天》 '), '晴天');
assert.equal(M.cleanSong('a\u0000b‮c\nd'), 'a b c d');
assert.equal(M.cleanSong('《A》 and 《B》'), '《A》 and 《B》');
assert.equal([...M.cleanSong('字'.repeat(60))].length, 40);
assert.equal(M.songKey('晴天'), M.songKey(' 《晴天》'));
assert.equal(M.songKey('Ｙellow Submarine'), M.songKey('yellow  submarine'));
assert.equal(M.qqSearchUrl('晴天'), 'https://y.qq.com/n/ryqq/search?w=%E6%99%B4%E5%A4%A9&t=song');
assert.equal(M.qqSearchUrl('a&b=c #x'), 'https://y.qq.com/n/ryqq/search?w=a%26b%3Dc%20%23x&t=song');

const list = M.buildSetlist([
  { card: { ...lin, song: '' }, event, name: 'Lin' },
  { card: { ...yao }, event, name: '阿遥' },
  { card: { id: 'p', song: '晴天', takenAt: t(21, 30), takenSource: 'exif', createdAt: '2026-09-26T14:00:00Z' }, event, name: '小满' },
  { card: { id: 'q', song: '《晴天》', takenAt: t(21, 20), takenSource: 'exif' }, event, name: '阿岚' },
  { card: { id: 'r', song: 'Yellow Submarine', takenAt: t(22, 10), takenSource: 'file', createdAt: '2026-09-26T14:10:00Z' }, event, name: '路人' },
  { card: { id: 's', song: '无时间的歌', createdAt: '2026-09-26T13:00:00Z' }, event, name: '小明' },
]);
assert.deepEqual(list.map(item => item.title), ['晴天', '把晚风借给你', '无时间的歌', 'Yellow Submarine']);
assert.deepEqual(list[0].names, ['小满', '阿岚']);
assert.equal(list[0].at, t(21, 20));
assert.equal(list[0].url, 'https://y.qq.com/n/ryqq/search?w=%E6%99%B4%E5%A4%A9&t=song');
assert.equal(list[1].example, true);
assert.equal(list[1].url, '');
assert.equal(list[1].at, t(21, 47));
assert.deepEqual(list[1].names, ['Lin', '阿遥']);
assert.equal(list[3].at, null); // a file time does not place a song on the timeline
// a user who types the fictional title makes it searchable
const typed = M.buildSetlist([{ card: { ...yao }, event, name: '阿遥' }, { card: { id: 'z', song: '把晚风借给你' }, event, name: '我' }]);
assert.equal(typed.length, 1);
assert.equal(typed[0].example, false);
assert.ok(typed[0].url.startsWith('https://y.qq.com/'));
// a real room's song is searchable
assert.equal(M.buildSetlist([{ card: { ...yao }, event: { song: '真的歌', isDemo: false }, name: 'x' }])[0].example, false);

// ticket facts
const sides = M.pairSides([lin, yao], event, moments);
assert.deepEqual(sides.map(s => [s.viewpoint, s.moment, s.time, s.songs]), [['舞台', '返场', '21:47', []], ['人海', '返场', '21:48', []]]);
const shared = M.sharedFacts([lin, yao], event, moments);
assert.deepEqual(shared, { label: '同一刻 · 21:47，相差 1 分钟', value: '♪ 把晚风借给你', kind: 'time', songs: ['把晚风借给你'] });
const two = M.pairSides([{ ...lin, trackId: '', song: '歌一' }, { ...yao, trackId: '', song: '歌二' }], event, moments);
assert.deepEqual(two.map(s => s.songs), [['歌一'], ['歌二']]);
// two shared songs (a typed one and the room's) are printed together on the stub and dropped from both halves
const both = M.pairSides([{ ...lin, song: '晴天' }, { ...yao, song: '晴天' }], event, moments);
assert.deepEqual(both.map(s => s.songs), [[], []]);
assert.equal(M.sharedFacts([{ ...lin, song: '晴天' }, { ...yao, song: '晴天' }], event, moments).value, '♪ 晴天\u3000♪ 把晚风借给你');
assert.equal(M.sharedFacts([{ ...lin, trackId: '', song: '歌一' }, { ...yao, trackId: '', song: '歌二' }], event, moments).value, '返场');
assert.equal(M.sharedFacts([{ id: 1, momentId: 'a' }, { id: 2, momentId: 'b' }], { title: '某场' }, moments).label, '我们交换的这一晚');
assert.deepEqual(M.takenFields({ takenAt: t(21, 47), takenSource: 'sample' }), { takenAt: null, takenSource: null });
assert.deepEqual(M.takenFields({ takenAt: t(21, 47), takenSource: 'exif' }), { takenAt: t(21, 47), takenSource: 'exif' });
console.log('moment.js: all assertions passed');
