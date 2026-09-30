import { SPACE_MOMENTS } from './space-data.js';
import { cardFacts, pairSides, sharedFacts, songsOf } from './moment.js';

/** Facts shared by the duet page and its PNG. They only read accepted snapshots. */
export const momentLabel = id => SPACE_MOMENTS.find(item => item.id === id)?.name || '现场瞬间';

/**
 * What joins the two cards, printed on the ticket's stub: the same moment (by capture time when both cards have one), a song both
 * name, the chosen moment, or the night itself. A song only one card names stays on that card's half (see duetSides).
 */
export function sharedLine(cards = [], event = {}) {
  return sharedFacts(cards, event, SPACE_MOMENTS);
}

/** Per half: viewpoint, chosen moment, capture time (only a trusted one) and the song that half prints itself. */
export function duetSides(cards = [], event = {}) {
  return pairSides(cards, event, SPACE_MOMENTS);
}

/** One card's own facts, for a single-card PNG and the collection. */
export const facts = (card = {}, event = {}) => cardFacts(card, event, SPACE_MOMENTS);

/** A single card PNG uses the same stub language: its own song first, then the song it brought along, then the moment. */
export function singleLine(card = {}, event = {}) {
  const [song] = songsOf(card, event);
  if (song) return { label: song.from === 'card' ? '这一刻在唱的歌' : '带上的这首歌', value: `♪ ${song.title}`, kind: 'song' };
  return { label: '我记得的这一刻', value: momentLabel(card.momentId), kind: 'moment' };
}

/** 2026-09-26 and 2026.09.26 both print as 2026.09.26. */
export function eventDateLabel(value) {
  if (!value) return '';
  const match = String(value).match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  return match ? `${match[1]}.${match[2].padStart(2, '0')}.${match[3].padStart(2, '0')}` : String(value);
}

export const eventTitle = (event = {}) => [event.title, event.subtitle].filter(Boolean).join(' / ') || '这一场现场';
export const eventMeta = (event = {}) => [eventDateLabel(event.date), event.city].filter(Boolean).join(' · ');

const pad = value => String(value).padStart(2, '0');
function dateOf(iso) {
  const date = new Date(iso || Date.now());
  return Number.isNaN(date.getTime()) ? new Date() : date;
}
/** 09/27 21:14 */
export function completedLabel(iso) {
  if (!iso) return '';
  const date = dateOf(iso);
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
/** 2026/09/27 21:14 */
export function completedFull(iso) {
  const date = dateOf(iso);
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
/** 09·27 for the consent seal. */
export function stampDate(iso) {
  const date = dateOf(iso);
  return `${pad(date.getMonth() + 1)}·${pad(date.getDate())}`;
}
