// The photo wall's rules, as plain functions (no DOM, no network, no storage). Pairing, reasons and ordering are the existing rules in
// web/js/moment.js (readPair, orderWall, trustedTime, formatTaken); nothing here is AI and nothing here decides consent or permission.
// It only reads what a room photo already carries: its capture time (takenAt / takenSource) and its side (viewpoint / viewpointSource).
import { SAME_MOMENT_MS, VIEWPOINTS, formatTaken, orderWall, readPair, trustedTime, viewpointName } from '../js/moment.js';

const photoList = value => (Array.isArray(value) ? value.filter(photo => photo && typeof photo === 'object') : []);
const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0); // code-unit order: the same answer in every locale
const createdMs = photo => {
  const ms = Date.parse(photo?.createdAt || '');
  return Number.isFinite(ms) ? ms : 0;
};

/** A room photo as the card moment.js reads it: its capture time and its side. A room has no 「时刻」 list, so a missing time means no pairing. */
export const cardOf = photo => ({
  id: photo?.id,
  takenAt: photo?.takenAt ?? null,
  takenSource: photo?.takenSource ?? null,
  perspective: photo?.viewpoint || '',
  momentId: '',
  createdAt: photo?.createdAt,
});

/** The capture time a photo may be paired by (epoch ms), or null: only a time from the camera or one the person typed counts. */
export const photoTime = photo => trustedTime(cardOf(photo));

/** Who decided the viewpoint. The server only records that the person kept the model's suggestion unchanged ('ai'); anything else the person chose. */
export function viewpointByline(photo) {
  if (!viewpointName(photo?.viewpoint)) return '';
  if (photo.viewpointSource === 'ai') return 'AI 建议，未改动';
  return photo.viewpointSource === 'manual' ? '作者选择' : '';
}

/**
 * Photos in time order, grouped into moments. A group is anchored at its earliest photo and takes every photo up to SAME_MOMENT_MS after it,
 * so any two photos in one group are at most 3 minutes apart (the 「同一刻」 rule). Photos without a trusted time go last, ungrouped, in the order given.
 */
export function momentGroups(photos, { eventDate = '' } = {}) {
  const timed = [];
  const untimed = [];
  for (const photo of photoList(photos)) {
    const at = photoTime(photo);
    if (at === null) untimed.push(photo);
    else timed.push({ photo, at });
  }
  timed.sort((a, b) => a.at - b.at || createdMs(a.photo) - createdMs(b.photo) || compare(String(a.photo.id), String(b.photo.id)));
  const groups = [];
  for (const { photo, at } of timed) {
    const open = groups.at(-1);
    if (open && at - open.startAt <= SAME_MOMENT_MS) {
      open.photos.push(photo);
      open.endAt = at;
    } else groups.push({ key: `m${at}`, startAt: at, endAt: at, photos: [photo] });
  }
  for (const group of groups) {
    group.label = formatTaken(group.startAt, eventDate);
    group.viewpoints = VIEWPOINTS.map(item => item.id).filter(id => group.photos.some(photo => photo.viewpoint === id));
    group.sameMoment = group.photos.length > 1;
  }
  return { groups, untimed };
}

/** 「21:47 · 同一刻 · 3 个视角：舞台 · 人海 · 细节」; a group of one photo is just its time. */
export function groupTitle(group) {
  if (!group.sameMoment) return group.label;
  const names = group.viewpoints.map(viewpointName);
  return `${group.label} · 同一刻 · ${names.length ? `${names.length} 个视角：${names.join(' · ')}` : `${group.photos.length} 张照片`}`;
}

/** What one reading says, as one sentence: all of it for a 「同一刻」; for anything else only the clause before the first 「；」 (the rest would hope for a side the rule did not find). */
export const readingReason = reading => (reading.same ? reading.detail : String(reading.detail).split('；')[0]);

// the better of two readings of one photo (higher relevance, then the smaller time gap)
const closer = (a, b) => a.score > b.score || (a.score === b.score && (a.gapMs ?? Infinity) < (b.gapMs ?? Infinity));

/**
 * For a viewer with photos of their own: every other photo with its best reading against any of the viewer's photos (and which of theirs it was),
 * and which one is 「同一刻的另一面」. The pick does not depend on the order the photos arrive in: relevance, then the smaller time gap, then the
 * earlier capture time, then the earlier upload, then the id. `skip` (optional ids) are photos that are not offered again, for instance because an
 * exchange about them is already open: they keep their reading but are never the pick, so the mark moves on to the next one.
 */
export function wallReadings(minePhotos, others, { eventDate = '', skip } = {}) {
  const event = { date: eventDate };
  const skipped = new Set(Array.isArray(skip) || skip instanceof Set ? skip : []);
  const mine = photoList(minePhotos);
  const mineIds = new Set(mine.map(photo => photo.id));
  const cards = photoList(others).filter(photo => !mineIds.has(photo.id)).map(cardOf);
  const byPhoto = new Map();
  for (const photo of mine) {
    for (const { card, reading } of orderWall(cardOf(photo), cards, { event }).items) {
      const known = byPhoto.get(card.id);
      if (!known || closer(reading, known.reading)) byPhoto.set(card.id, { reading, mine: photo });
    }
  }
  const cardById = new Map(cards.map(card => [card.id, card]));
  const time = id => trustedTime(cardById.get(id)) ?? Infinity;
  const [best] = [...byPhoto.entries()].filter(([id, found]) => found.reading.complementary && !skipped.has(id))
    .sort(([idA, a], [idB, b]) => b.reading.score - a.reading.score || (a.reading.gapMs ?? Infinity) - (b.reading.gapMs ?? Infinity)
      || time(idA) - time(idB) || createdMs(cardById.get(idA)) - createdMs(cardById.get(idB)) || compare(String(idA), String(idB)));
  return { byPhoto, best: best ? best[0] : null };
}

/**
 * The photos a person could offer for `target`, best first. Only the first 「同一刻的另一面」 is recommended, and it is only recommended: the
 * person still chooses, ticks the consent box and sends. `number` is the photo's place in the list given (「我的第 N 张」), which does not
 * change when the rows are reordered.
 */
export function offerSuggestions(minePhotos, target, { eventDate = '' } = {}) {
  const event = { date: eventDate };
  const goal = cardOf(target);
  const rows = photoList(minePhotos).map((photo, index) => ({ photo, index, number: index + 1, reading: readPair(cardOf(photo), goal, { event }) }))
    .sort((a, b) => b.reading.score - a.reading.score || (a.reading.gapMs ?? Infinity) - (b.reading.gapMs ?? Infinity) || a.index - b.index);
  const first = rows.findIndex(row => row.reading.complementary);
  return rows.map(({ photo, number, reading }, index) => ({ photo, number, reading, recommended: index === first && first !== -1, viewpoint: viewpointName(photo.viewpoint) }));
}

/** 「拍摄于 21:47 · 视角：人海 · AI 建议，未改动」; a part the photo does not carry is left out ('' when it carries none). The time is the one moment.js would pair by. */
export function photoMetaLine(photo, { eventDate = '', esc } = {}) {
  const parts = [];
  const at = photoTime(photo);
  if (at !== null) parts.push(`拍摄于 ${formatTaken(at, eventDate)}`);
  const side = viewpointName(photo?.viewpoint);
  if (side) {
    parts.push(`视角：${side}`);
    const by = viewpointByline(photo);
    if (by) parts.push(by);
  }
  const line = parts.join(' · ');
  return typeof esc === 'function' ? esc(line) : line;
}
