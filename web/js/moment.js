/**
 * 「同一刻，另一面」 as plain rules: when a photo was taken, which side of the night it shows, which card fits which,
 * which songs were playing, and where to look a song up.
 *
 * No DOM and no imports, so every rule can be run and checked in Node. The local demo (space.js), the rooms page (live.js),
 * the duet page and its PNG all read the same functions; nothing here decides consent or touches a photo.
 *
 * Times are epoch milliseconds. They are DISPLAYED in Asia/Shanghai (the product is for one venue on one night, and two
 * phones in different zones must read the same clock). A photo that carries no time-zone offset is read as Asia/Shanghai
 * wall-clock time: the camera was most likely set to the venue's zone, and there is nothing better to assume.
 */

/** Two cards are 「同一刻」 when their capture times are at most this far apart. */
export const SAME_MOMENT_MS = 3 * 60_000;

const VENUE_OFFSET_MS = 8 * 3_600_000; // Asia/Shanghai is UTC+8 all year since 1991; every date this product accepts is later
const DAY_MS = 86_400_000;
/** The server enforces the same window: 2000-01-01 up to one day ahead of "now". */
export const TAKEN_MIN = Date.UTC(2000, 0, 1);
export const takenMax = (now = Date.now()) => now + DAY_MS;
export const validTakenAt = value => Number.isFinite(value) && value >= TAKEN_MIN && value <= takenMax();

/**
 * Where a card's time came from. Only 'exif' and 'manual' can decide 「同一刻」 and only they ever leave the device: a file's
 * modification time ('file') is a guess the person has not confirmed, so it stays on the editing page: it is not saved into a card, not even in the local demo's own storage.
 * The moment the person types or edits the time, it becomes 'manual'.
 */
export const TAKEN_SOURCES = Object.freeze(['exif', 'manual', 'file']);
const TRUSTED_SOURCES = Object.freeze(['exif', 'manual', 'sample']); // 'sample' = the demo's fictional example photos
const SENT_SOURCES = Object.freeze(['exif', 'manual']);              // the sources a room server is told about

const pad = value => String(value).padStart(2, '0');

/** Calendar fields of an instant on the Asia/Shanghai wall clock. */
export function venueParts(ms) {
  const date = new Date(ms + VENUE_OFFSET_MS);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(), hour: date.getUTCHours(), minute: date.getUTCMinutes() };
}

/** Instant of a wall-clock reading on the Asia/Shanghai clock. */
export const venueTime = (year, month, day, hour = 0, minute = 0, second = 0) => Date.UTC(year, month - 1, day, hour, minute, second) - VENUE_OFFSET_MS;

const eventDay = value => {
  const match = String(value || '').match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  return match ? { year: +match[1], month: +match[2], day: +match[3] } : null;
};

/** Whether an instant falls on the event's own calendar day (Asia/Shanghai). False when the event has no usable date. */
export function onEventDay(ms, eventDate = '') {
  const ref = eventDay(eventDate);
  if (!ref || !Number.isFinite(ms)) return false;
  const at = venueParts(ms);
  return ref.year === at.year && ref.month === at.month && ref.day === at.day;
}

/** 21:47 on the event's own date; 9月27日 00:12 on another day; 2018年4月22日 15:19 in another year. */
export function formatTaken(ms, eventDate = '') {
  if (!Number.isFinite(ms)) return '';
  const at = venueParts(ms);
  const clock = `${pad(at.hour)}:${pad(at.minute)}`;
  if (onEventDay(ms, eventDate)) return clock;
  const ref = eventDay(eventDate);
  const currentYear = ref ? ref.year : venueParts(Date.now()).year;
  return `${at.year !== currentYear ? `${at.year}年` : ''}${at.month}月${at.day}日 ${clock}`;
}

/**
 * What a ticket prints on its date line. A trusted capture time on the event's own day joins the event date ("2026.09.26 · 21:47");
 * a photo from another day prints its own day and time instead ("拍摄于 2025年7月10日 10:53"), so the line never pairs the show's
 * date with a photo that was taken on some other night. Without a trusted time it is the event date alone.
 */
export function ticketStamp(card, event = {}, dateLabel = '') {
  const date = dateLabel || event.date || '';
  const ms = trustedTime(card);
  if (ms === null) return date;
  const clock = formatTaken(ms, event.date);
  return onEventDay(ms, event.date) ? [date, clock].filter(Boolean).join(' · ') : `拍摄于 ${clock}`;
}

/** 9月26日 21:47: always the day, never the year (for a sentence about a specific night). */
export function formatDayTime(ms) {
  if (!Number.isFinite(ms)) return '';
  const at = venueParts(ms);
  return `${at.month}月${at.day}日 ${pad(at.hour)}:${pad(at.minute)}`;
}

/** The value of an <input type="datetime-local"> for an instant, on the Asia/Shanghai clock. */
export function toInputValue(ms) {
  if (!Number.isFinite(ms)) return '';
  const at = venueParts(ms);
  return `${at.year}-${pad(at.month)}-${pad(at.day)}T${pad(at.hour)}:${pad(at.minute)}`;
}

/** The instant a <input type="datetime-local"> value names on the Asia/Shanghai clock; null when blank, impossible or out of range. */
export function fromInputValue(value) {
  const match = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)(?::(\d\d))?$/.exec(String(value || ''));
  if (!match) return null;
  const [year, month, day, hour, minute, second] = match.slice(1).map(part => (part === undefined ? 0 : Number(part)));
  const ms = venueTime(year, month, day, hour, minute, second);
  const back = venueParts(ms);
  // Feb 30 or 25:61 roll over into another day; a value that does not survive the round trip was never a real time.
  if (back.year !== year || back.month !== month || back.day !== day || back.hour !== hour || back.minute !== minute) return null;
  return validTakenAt(ms) ? ms : null;
}

/**
 * What readCaptureTime() found, as a card time. `trusted` is false for evidence that is not a capture time: IFD0 DateTime is when
 * an editor saved the file, and a PNG usually comes from a screenshot. Those are offered to the person as a guess, never used silently.
 */
export function takenFromExif(found) {
  if (!found) return null;
  const zoneAssumed = !Number.isFinite(found.epochMs);
  const ms = zoneAssumed ? found.wallMs - VENUE_OFFSET_MS : found.epochMs;
  if (!validTakenAt(ms)) return null;
  const weak = found.source === 'DateTime' || found.format === 'png';
  return { takenAt: Math.round(ms), trusted: !weak, zoneAssumed, origin: weak ? 'weak' : 'exif' };
}

/**
 * What to tell the person about the clock behind a trusted EXIF time, when it is not simply Beijing time. Every time is DISPLAYED in
 * Beijing time, so a photo whose camera wrote another UTC offset is converted, and someone who took it at 20:18 in another zone would
 * otherwise see 4月8日 11:18 and think the photo was misread: the sentence says it was converted and what the photo itself read.
 * A photo that wrote no offset is read as Beijing time (see the header of this file), and says so. '' when the photo's own clock already
 * is Beijing time or there is nothing to say. `found` = readCaptureTime()'s result.
 */
export function zoneNote(found) {
  const local = /^\d{4}-(\d\d)-(\d\d)T(\d\d):(\d\d)/.exec(found?.local || '');
  if (!local) return '';
  const zone = /^([+-])(\d\d):(\d\d)$/.exec(found.offset || '');
  if (!zone || !Number.isFinite(found.epochMs)) return '照片没写时区，按北京时间算';
  const minutes = (zone[1] === '-' ? -1 : 1) * (Number(zone[2]) * 60 + Number(zone[3]));
  if (minutes === VENUE_OFFSET_MS / 60_000) return '';
  return `已换算成北京时间，照片自带的是 ${Number(local[1])}月${Number(local[2])}日 ${local[3]}:${local[4]}（UTC${zone[1] === '-' ? '−' : '+'}${zone[2]}:${zone[3]}）`;
}

/** File.lastModified (through fallbackTime()) as an approximate card time. It is a guess and is marked so. */
export function takenFromFile(fallback) {
  const ms = fallback?.epochMs;
  return validTakenAt(ms) ? { takenAt: Math.round(ms), trusted: false, zoneAssumed: false, origin: 'file' } : null;
}

/** A card's capture time when something trustworthy says so, else null. */
export function trustedTime(card) {
  const ms = card?.takenAt;
  return Number.isFinite(ms) && TRUSTED_SOURCES.includes(card.takenSource) ? ms : null;
}

/**
 * Sanitised card fields for a server request: a finite time from the camera ('exif') or typed by the person ('manual'), or neither.
 * A file's modification time is only a guess at when the photo was taken, so it is never sent (see TAKEN_SOURCES).
 */
export function takenFields(card) {
  const ok = validTakenAt(card?.takenAt) && SENT_SOURCES.includes(card.takenSource);
  return ok ? { takenAt: Math.round(card.takenAt), takenSource: card.takenSource } : { takenAt: null, takenSource: null };
}

/**
 * "3 分钟" / "3 分多钟" / "5 小时" / "14 天" / "15 个月" / "12 年": rounded, and only as fine as a sentence about a night needs.
 * Minutes are never rounded up to a whole one: "3 分钟" is exactly 3:00 or less and "3 分多钟" is a little more, so a sentence about
 * the 3-minute rule (SAME_MOMENT_MS) cannot read "3 分钟" on both sides of the line.
 */
export function spanWords(ms) {
  const span = Math.abs(ms);
  if (span < 60_000) return '不到 1 分钟';
  if (span < 3_600_000) {
    const whole = Math.floor(span / 60_000);
    return `${whole} 分${span > whole * 60_000 ? '多' : ''}钟`;
  }
  const hours = Math.round(span / 3_600_000);
  if (hours < 48) return `${hours} 小时`;
  const days = Math.round(hours / 24);
  if (days < 60) return `${days} 天`;
  return days < 730 ? `${Math.round(days / 30)} 个月` : `${Math.round(days / 365)} 年`;
}

/**
 * Reason text as HTML for a narrow column: the small units of a reason never break across two lines, so no line ends or starts with
 * half of one ("相差 1 / 分钟", "TA 拍人 / 海", "「返 / 场」"). The units are a clock time, a span of minutes ("相差 2 分多钟"), a viewpoint clause
 * ("你拍舞台，" / "TA 拍人海" / "你们都拍了舞台"), a moment name in 「」, a short song title in 《》 and the few two-to-five-character
 * phrases a line would otherwise split ("拍摄时间", "不算同一刻", "几乎同时"). The line may still break between units, and inside
 * anything longer.
 * The text is escaped first; the wrappers are added after, so nothing typed by a person can carry markup.
 */
let reasonUnits = null;
function reasonUnitPattern() {
  if (!reasonUnits) { // built on first use: VIEWPOINTS is declared further down this file
    const sides = VIEWPOINTS.map(item => item.name).join('|');
    reasonUnits = new RegExp(`(相差 \\d+ 分多?钟|相差不到 1 分钟|隔了 \\d+ (?:分多?钟|小时|天|个月|年)|\\d{1,2}月\\d{1,2}日 \\d{2}:\\d{2}|\\d{2}:\\d{2}|你们都拍了(?:${sides})|你拍(?:${sides})，|TA 拍(?:${sides})|「[^」]{1,8}」|《[^》]{1,10}》|不[算是]同一刻|拍摄时间|几乎同时)`, 'g');
  }
  return reasonUnits;
}
export function reasonHtml(text) {
  const escaped = String(text ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  return escaped.replace(reasonUnitPattern(), '<span class="nowrap">$1</span>');
}

// ---- viewpoints -------------------------------------------------------------------------------------------------------

/** The four sides of a night. Same ids the on-device model answers with (see ai/space-ai.js). */
export const VIEWPOINTS = Object.freeze([
  Object.freeze({ id: 'stage', name: '舞台', detail: '灯光下的那一面' }),
  Object.freeze({ id: 'crowd', name: '人海', detail: '一起举手的那一面' }),
  Object.freeze({ id: 'friends', name: '身边', detail: '陪你听歌的那一面' }),
  Object.freeze({ id: 'detail', name: '细节', detail: '只有你留意的那一面' }),
]);

export const viewpointName = id => VIEWPOINTS.find(item => item.id === id)?.name || '';

/**
 * The viewpoint a card stands for: what the person chose; '' when they left it open (no guess is invented); and for cards
 * made before viewpoints existed, the example photo they used (stage / crowd).
 */
export function viewpointOf(card) {
  const own = card?.perspective;
  if (own === '') return '';
  if (VIEWPOINTS.some(item => item.id === own)) return own;
  const key = card?.photoKey;
  return key === 'stage' || key === 'crowd' ? key : '';
}

// ---- songs -----------------------------------------------------------------------------------------------------------

export const SONG_MAX = 40;
// Control characters, line/paragraph separators and bidirectional overrides (a title that reverses the text around it).
const SONG_STRIP = /[\p{Cc}\u2028\u2029\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/gu;

/** What a person typed as a song title, made safe to store and show: no controls, one line, ≤ 40 characters. */
export function cleanSong(value) {
  let title = String(value ?? '').replace(SONG_STRIP, ' ').replace(/\s+/g, ' ').trim();
  const wrapped = title.match(/^《([^《》]*)》$/u);
  if (wrapped) title = wrapped[1].trim();
  return [...title].slice(0, SONG_MAX).join('').trim();
}

/** Two spellings of one title share a key: 《晴天》 = 晴天 = 晴天 (full-width / case / spacing). */
export const songKey = title => cleanSong(title).normalize('NFKC').toLocaleLowerCase('zh-CN').replace(/\s+/gu, '');

/**
 * A search, not a link to a recording: the page lists songs by that title, and which version was on stage is for the person to pick.
 * Checked 2026-09-30: a desktop browser is sent from /n/ryqq/ to /n/ryqq_v2/ and gets the page (HTTP 200) with the query kept; QQ Music
 * sends a phone browser to its mobile home page and drops the query, which is why the setlist also offers to copy the title.
 */
export const qqSearchUrl = title => `https://y.qq.com/n/ryqq/search?w=${encodeURIComponent(cleanSong(title))}&t=song`;

/** The songs one card names: its own 「这一刻在唱的歌」, and the room's song when the card carries it (trackId). */
export function songsOf(card, event = {}) {
  const found = [];
  const typed = cleanSong(card?.song);
  if (typed) found.push({ title: typed, from: 'card', example: false });
  const roomSong = cleanSong(event?.song);
  if (card?.trackId && roomSong) found.push({ title: roomSong, from: 'room', example: Boolean(event.isDemo) });
  return found;
}

const createdMs = card => {
  const ms = Date.parse(card?.createdAt || '');
  return Number.isFinite(ms) ? ms : 0;
};

/**
 * 那晚的歌单: the distinct songs the viewer can see on cards, in the order they were on stage (earliest capture time first;
 * songs with no time follow, oldest card first). `entries` = [{ card, event, name }]. A song is searchable unless every mention
 * of it comes from the fictional example show.
 */
export function buildSetlist(entries) {
  const byKey = new Map();
  entries.forEach(({ card, event, name }, index) => {
    for (const song of songsOf(card, event)) {
      const key = songKey(song.title);
      if (!key) continue;
      const at = trustedTime(card);
      let item = byKey.get(key);
      if (!item) {
        item = { key, title: song.title, at: null, created: Infinity, order: index, names: [], example: true, mentions: 0 };
        byKey.set(key, item);
      }
      item.mentions += 1;
      if (at !== null && (item.at === null || at < item.at)) item.at = at;
      item.created = Math.min(item.created, createdMs(card) || Infinity);
      item.example = item.example && song.example;
      if (name && !item.names.includes(name)) item.names.push(name);
    }
  });
  return [...byKey.values()]
    .sort((a, b) => (a.at ?? Infinity) - (b.at ?? Infinity) || a.created - b.created || a.order - b.order)
    .map(({ key, title, at, names, example, mentions }) => ({ key, title, at, names, example, mentions, url: example ? '' : qqSearchUrl(title) }));
}

// ---- pairing ---------------------------------------------------------------------------------------------------------

const momentTitle = (moments, id) => moments.find(item => item.id === id)?.name || '现场瞬间';

/**
 * How two cards relate, in words a person can check.
 *
 *   basis 'time'    both cards have a trusted capture time and they are ≤ 3 minutes apart  → 同一刻
 *   basis 'moment'  a time is missing on at least one card and both chose the same moment  → 同一刻 (by the chosen moment)
 *   basis 'apart'   both have times and they are further apart: NOT 同一刻, whatever moment was chosen
 *   basis null      nothing to compare (a time is missing and the chosen moments differ)
 *
 * `complementary` = same moment and a different, known viewpoint: the 「另一面」. `mine` may be null (no card yet).
 * `moments` is the list of {id, name} the product offers (SPACE_MOMENTS).
 */
export function readPair(mine, theirs, { event = {}, moments = [] } = {}) {
  const viewTheirs = viewpointOf(theirs);
  if (!mine) {
    return {
      score: 0, basis: null, same: false, complementary: false, gapMs: null,
      title: viewTheirs ? `${viewpointName(viewTheirs)}的视角` : '另一位观众的视角',
      detail: '先留下自己的卡，再看看两种视角如何呼应。',
    };
  }
  const timeMine = trustedTime(mine);
  const timeTheirs = trustedTime(theirs);
  const viewMine = viewpointOf(mine);
  const differentView = Boolean(viewMine && viewTheirs && viewMine !== viewTheirs);
  const sameView = Boolean(viewMine && viewTheirs && viewMine === viewTheirs);
  const sameChosenMoment = Boolean(mine.momentId && mine.momentId === theirs.momentId);
  const chosenName = momentTitle(moments, mine.momentId);
  const views = differentView ? `你拍${viewpointName(viewMine)}，TA 拍${viewpointName(viewTheirs)}` : sameView ? `你们都拍了${viewpointName(viewMine)}` : '';
  const tail = views ? `；${views}` : '';

  let basis = null;
  let gapMs = null;
  if (timeMine !== null && timeTheirs !== null) {
    gapMs = Math.abs(timeMine - timeTheirs);
    basis = gapMs <= SAME_MOMENT_MS ? 'time' : 'apart';
  } else if (sameChosenMoment) basis = 'moment';
  const same = basis === 'time' || basis === 'moment';

  // Only a song each person typed counts as a link between two cards. A room's own song rides on every card that ticked
  // 「带上这首歌」, so it says nothing about these two moments; it still prints on the ticket stub (sharedFacts).
  const typedTitles = card => songsOf(card, event).filter(item => item.from === 'card').map(item => item.title);
  const typedMine = typedTitles(mine).map(songKey);
  const sharedSong = typedTitles(theirs).find(title => typedMine.includes(songKey(title))) || '';

  const theirLine = `${momentTitle(moments, theirs.momentId)} · ${viewpointName(viewTheirs) || '现场'}，或许能补上你没看到的一面。`;
  let score = 0;
  let title = '现场的另一面';
  let lead = '';     // the sentence that says how the two cards relate
  let detail = theirLine;
  if (basis === 'time') {
    const seconds = gapMs / 1000;
    // The same words as the "not 同一刻" sentence below (spanWords): "相差 3 分钟" is at most 3:00, "隔了 3 分多钟" is more, so no gap reads as both.
    const gap = seconds < 10 ? '几乎同时' : seconds < 60 ? '相差不到 1 分钟' : `相差 ${spanWords(gapMs)}`;
    score = differentView ? 100 : 80;
    title = differentView ? '同一刻的另一面' : '同一刻';
    lead = `同一刻 · ${formatTaken(Math.min(timeMine, timeTheirs), event.date)}，${gap}`;
    detail = `${lead}${tail}`;
  } else if (basis === 'moment') {
    const lacking = timeMine === null && timeTheirs === null ? '你们的照片都' : timeMine === null ? '你的照片' : 'TA 的照片';
    score = differentView ? 70 : 50;
    title = differentView ? '同一刻的另一面' : '同一刻';
    lead = `按你们都选的「${chosenName}」算同一刻（${lacking}没有拍摄时间）`;
    detail = `${lead}${tail}`;
  } else if (basis === 'apart') {
    const span = spanWords(gapMs);
    if (sameChosenMoment) {
      score = differentView ? 40 : 30;
      // The title stays the generic one: the sentence below already says what you both chose, and a bold title that said it first
      // would print the same words twice.
      lead = `你们都选了「${chosenName}」，但拍摄时间隔了 ${span}，不算同一刻`;
      detail = `${lead}${tail}`;
    } else {
      score = differentView ? 20 : 10;
      detail = `不是同一刻（拍摄时间隔了 ${span}）；${theirLine}`;
    }
  } else {
    score = differentView ? 20 : 10;
  }
  // A song both wrote ranks a card a little higher, and the reason says so: the order is never a secret.
  if (sharedSong && basis !== 'apart') {
    score += 5;
    if (same) detail += `；都写下了《${sharedSong}》`;
    else { title = '带着同一首歌的记忆'; detail = `都写下了《${sharedSong}》，各自记住了不同片刻。`; }
  }
  return { score, basis, same, complementary: same && differentView, gapMs, title, lead, detail, sharedSong };
}

/**
 * The wall for one viewer: every other card with its reading, best first, and which one to mark 「同一刻的另一面」.
 * Order: relevance, then the smaller time gap, then capture time (cards without one last), then when it was made.
 */
export function orderWall(mine, cards, options = {}) {
  const items = cards.map(card => ({ card, reading: readPair(mine, card, options) }));
  const time = card => trustedTime(card) ?? Infinity;
  items.sort((a, b) => b.reading.score - a.reading.score
    || (a.reading.gapMs ?? Infinity) - (b.reading.gapMs ?? Infinity)
    || time(a.card) - time(b.card)
    || createdMs(a.card) - createdMs(b.card)
    || String(a.card.id).localeCompare(String(b.card.id)));
  const best = items.find(item => item.reading.complementary) || null;
  return { items, best: best ? best.card.id : null };
}

// ---- ticket facts -----------------------------------------------------------------------------------------------------

/** What a card prints about itself: viewpoint name, the moment it chose, a capture time when a trusted one exists, its songs. */
export function cardFacts(card, event = {}, moments = []) {
  const time = trustedTime(card);
  return {
    viewpoint: viewpointName(viewpointOf(card)),
    moment: momentTitle(moments, card?.momentId),
    time: time === null ? '' : formatTaken(time, event.date),
    songs: songsOf(card, event).map(item => item.title),
  };
}

/**
 * The stub of a duet ticket: what joins the two cards. `label` says why they belong together, `value` is what to remember.
 * A song both cards name is printed here; a song only one names stays on its own half (see pairSides).
 */
export function sharedFacts(cards, event = {}, moments = []) {
  const [a, b] = cards;
  const reading = a && b ? readPair(a, b, { event, moments }) : null;
  const keysB = songsOf(b, event).map(item => songKey(item.title));
  const shared = songsOf(a, event).filter(item => keysB.includes(songKey(item.title))).map(item => item.title);
  const sameChosen = Boolean(a?.momentId && a.momentId === b?.momentId);
  const value = shared.length ? shared.map(title => `♪ ${title}`).join('\u3000') : sameChosen ? momentTitle(moments, a.momentId) : (event.title || '这一场现场');
  if (reading?.basis === 'time') return { label: reading.lead, value, kind: 'time', songs: shared };
  if (shared.length) return { label: '让两张卡相遇的歌', value, kind: 'song', songs: shared };
  if (sameChosen) return { label: '我们共同记住的时刻', value, kind: 'moment', songs: [] };
  return { label: '我们交换的这一晚', value, kind: 'night', songs: [] };
}

/** Per-half facts for a duet: a song both cards name is printed once on the stub, so a half only lists the songs that are its own. */
export function pairSides(cards, event = {}, moments = []) {
  const shared = sharedFacts(cards, event, moments).songs.map(songKey);
  return cards.map(card => {
    const facts = cardFacts(card, event, moments);
    const own = facts.songs.filter(title => !shared.includes(songKey(title)));
    return { viewpoint: facts.viewpoint, moment: facts.moment, time: facts.time, songs: own };
  });
}
