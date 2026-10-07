// What the exchange step says about the viewer's own photos once the other person's photo is known: option labels, which one is recommended and
// why. Plain rules over moment-model.js (which reads web/js/moment.js); no DOM, nothing here is AI, and nothing here sends or consents: the
// recommendation is only the option that is selected for the person, who still ticks the consent box and presses send.
import { reasonHtml, spanWords } from '../js/moment.js';
import { photoTime, readingReason } from './moment-model.js';

export const PLACEHOLDER = '选择自己拍的照片';
export const NO_RECOMMENDATION = '没找到同一刻的另一面，自己选一张吧。';

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeText = value => String(value ?? '').replace(/[&<>"']/g, character => ESCAPES[character]);

/** 'recommended' (the first 同一刻的另一面) | 'other-side' (a later one) | 'same' (同一刻, same side or side unknown) | 'apart' (both times known, too far apart) | 'unknown' (a time is missing). */
export function verdictOf(row) {
  const { reading } = row;
  if (row.recommended) return 'recommended';
  if (reading.complementary) return 'other-side';
  if (reading.same) return 'same';
  return reading.basis === 'apart' ? 'apart' : 'unknown';
}

/** 「同一刻的另一面（推荐）」 / 「同一刻的另一面」 / 「同一刻」 / 「不是同一刻（隔了 1 小时）」; '' when a time is missing (nothing to say). */
export function verdictLabel(row) {
  switch (verdictOf(row)) {
    case 'recommended': return '同一刻的另一面（推荐）';
    case 'other-side': return '同一刻的另一面';
    case 'same': return '同一刻';
    case 'apart': return `不是同一刻（隔了 ${spanWords(row.reading.gapMs)}）`;
    default: return '';
  }
}

/** 「我的第 2 张 · 已上墙 · 同一刻的另一面（推荐）」. `row.number` is the photo's place among the person's own photos, so a photo keeps its number when the list is reordered. */
export const optionLabel = row => [`我的第 ${row.number} 张`, row.photo.visibility === 'members' ? '已上墙' : '未上墙', verdictLabel(row)].filter(Boolean).join(' · ');

/** The reason for one option, as plain text. A reading that is not 同一刻 shows only its first clause; with a time missing it says so instead of guessing. */
export function reasonText(row, target) {
  if (verdictOf(row) !== 'unknown') return readingReason(row.reading);
  const mine = photoTime(row.photo) !== null;
  const theirs = photoTime(target) !== null;
  return `${mine ? '对方的这张' : theirs ? '你的这张' : '两张照片都'}没有拍摄时间。`;
}

/** The <option>s of the select (the placeholder first), in the order given (best first, see offerSuggestions()). */
export const optionsMarkup = (rows, { selectedId = null, esc = escapeText } = {}) => `<option value="">${PLACEHOLDER}</option>`
  + rows.map(row => `<option value="${esc(row.photo.id)}" ${row.photo.id === selectedId ? 'selected' : ''}>${esc(optionLabel(row))}</option>`).join('');

/**
 * The reason under the select: for the chosen option when there is one, otherwise a sentence that nothing was recommended (only when the person
 * has photos to choose from). The paragraph is always there, hidden when it has nothing to say, so the select can point at it.
 */
export function suggestionMarkup(rows, { selectedId = null, target = null, esc = escapeText } = {}) {
  const row = rows.find(item => item.photo.id === selectedId) || null;
  const text = row ? reasonText(row, target) : rows.length && !rows.some(item => item.recommended) ? NO_RECOMMENDATION : '';
  const mark = row?.recommended ? ' is-recommended' : '';
  return `<p class="exchange-reason${mark}" id="exchange-reason" data-x-reason${text ? '' : ' hidden'}>${text ? (row ? reasonHtml(text) : esc(text)) : ''}</p>`;
}
