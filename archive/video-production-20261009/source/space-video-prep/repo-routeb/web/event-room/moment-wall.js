// The room's photo wall as markup (no DOM, no styles: wall-moments.css is imported by app.js). The rules come from moment-model.js, which reads
// web/js/moment.js; nothing here is AI. Buttons carry the attributes app.js already routes: data-photo (inside renderItem), data-exchange-offer
// and data-show-more. When no photo has a trusted capture time the output is exactly today's plain grid.
import { SAME_MOMENT_MS, reasonHtml, viewpointName } from '../js/moment.js';
import { groupTitle, momentGroups, photoMetaLine, photoTime, wallReadings } from './moment-model.js';

export const GROUP_NOTE = `按拍摄时间分组（相差不超过 ${SAME_MOMENT_MS / 60_000} 分钟），规则判断，不是 AI`;
export const UNTIMED_TITLE = '没有拍摄时间';
export const UNTIMED_NOTE = '没有拍摄时间，无法按时间配对';
export const PIPELINE_RIBBON = 'AI 建议视角 → 规则找同一刻 → 双方同意才交换';
export const BADGE_TITLE = '同一刻的另一面';
export const OFFER_LABEL = '和 TA 交换这个视角';
export const SAME_TAG = '同一刻';
export const EXCHANGED_TAG = '已有交换';
export const EMPTY_WALL = '<div class="empty"><b>还没有照片。</b><p>别急，今晚总有一个瞬间值得留下。</p></div>';
const MORE_BUTTON = '<button class="quiet" data-show-more>再看 24 张</button>';

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeText = value => String(value ?? '').replace(/[&<>"']/g, character => ESCAPES[character]);

// The small units of a heading or a meta line never break across two lines ("人 / 海", "视角：细 / 节"); a line may still break between units, and a long
// date (「2025年7月10日 10:53」) breaks between its day and its clock. Applied to text that is already escaped, like moment.js reasonHtml does.
const TITLE_UNITS = /(\d{4}年|\d{1,2}月\d{1,2}日|\d{2}:\d{2}|同一刻|\d+ 个视角：|\d+ 张照片|舞台|人海|身边|细节)/g;
const META_UNITS = /(拍摄于 \d{2}:\d{2}|拍摄于|\d{4}年|\d{1,2}月\d{1,2}日|\d{2}:\d{2}|视角：(?:舞台|人海|身边|细节)|AI 建议，未改动|作者选择)/g;
const NOTE_UNITS = /(（相差不超过 \d+ 分钟）|规则判断，不是 AI)/g;
const units = (escaped, pattern) => escaped.replace(pattern, '<span class="nowrap">$1</span>');

/**
 * The wall. `renderItem(photo)` is app.js's own photo button (the existing .photo-item markup), so it is not written twice; `esc` is its escaper.
 * `photos` is the room's photo list in the order the app holds it: the first `shown` are on the wall (app.js loads exactly those images), while the
 * viewer's own photos anywhere in the list still count when looking for 「同一刻的另一面」. `exchanged` (optional, an array or Set of photo ids) names the
 * photos that already have a pending or accepted exchange with the viewer: the mark moves on to the next other side and they say 「已有交换」.
 */
export function wallMarkup({ photos = [], members = [], ownId = '', eventDate = '', shown = 24, renderItem, esc, exchanged } = {}) {
  const safe = typeof esc === 'function' ? esc : escapeText;
  const item = typeof renderItem === 'function' ? renderItem : () => '';
  const all = Array.isArray(photos) ? photos.filter(photo => photo && typeof photo === 'object') : [];
  if (!all.length) return EMPTY_WALL;
  const limit = Number.isFinite(shown) && shown > 0 ? Math.floor(shown) : 24;
  const visible = all.slice(0, limit);
  const more = all.length > limit ? MORE_BUTTON : '';
  if (!visible.some(photo => photoTime(photo) !== null)) return `<div class="photo-grid">${visible.map(item).join('')}</div>${more}`;

  const own = photo => Boolean(ownId) && photo.ownerId === ownId;
  const handled = new Set(Array.isArray(exchanged) || exchanged instanceof Set ? exchanged : []);
  const readings = wallReadings(all.filter(own), visible.filter(photo => !own(photo) && photo.visibility === 'members'), { eventDate, skip: handled });
  const nameOf = photo => (Array.isArray(members) ? members.find(member => member?.id === photo.ownerId)?.name : '') || '';
  const ribbon = visible.some(photo => photo.viewpointSource === 'ai' && viewpointName(photo.viewpoint));

  const badge = photo => {
    const name = nameOf(photo);
    const label = name ? ` aria-label="${safe(`${OFFER_LABEL}（${name} 的照片）`)}"` : '';
    return `<div class="moment-badge" data-moment-badge="other-side"><b class="moment-badge__title">${BADGE_TITLE}</b>`
      + `<p class="moment-badge__reason">${reasonHtml(readings.byPhoto.get(photo.id).reading.detail)}</p>`
      + `<button type="button" class="primary" data-exchange-offer="${safe(photo.id)}"${label}>${OFFER_LABEL}</button></div>`;
  };
  const tag = (text, attribute, extra = '') => `<span class="moment-tag${extra}" ${attribute}>${text}</span>`;
  const tags = photo => (readings.byPhoto.get(photo.id)?.reading.same ? tag(SAME_TAG, 'data-moment-tag') : '')
    + (!own(photo) && handled.has(photo.id) ? tag(EXCHANGED_TAG, 'data-moment-exchanged', ' moment-tag--done') : '');
  const card = photo => {
    const best = readings.best !== null && photo.id === readings.best;
    const meta = photoMetaLine(photo, { eventDate });
    return `<div class="moment-card${best ? ' moment-card--best' : ''}" data-moment-photo="${safe(photo.id)}">${item(photo)}`
      + `${meta ? `<p class="moment-meta">${units(safe(meta), META_UNITS)}</p>` : ''}${best ? badge(photo) : tags(photo)}</div>`;
  };
  // inside its group the best other side comes first (the rest stay in time order), so the block is on the first screen of a phone
  const bestFirst = list => {
    const index = readings.best === null ? -1 : list.findIndex(photo => photo.id === readings.best);
    return index > 0 ? [list[index], ...list.slice(0, index), ...list.slice(index + 1)] : list;
  };
  const section = (key, title, note, list) => `<section class="moment-group${key === 'untimed' ? ' moment-group--untimed' : ''}" data-moment-group="${safe(key)}" aria-labelledby="moment-title-${safe(key)}">`
    + `<h3 class="moment-group__title" id="moment-title-${safe(key)}">${units(safe(title), TITLE_UNITS)}</h3>${note ? `<p class="moment-group__note">${units(safe(note), NOTE_UNITS)}</p>` : ''}`
    + `<div class="photo-grid moment-grid">${list.map(card).join('')}</div></section>`;

  const { groups, untimed } = momentGroups(visible, { eventDate });
  return `<div class="moment-wall" data-moment-wall>${ribbon ? `<p class="moment-ribbon" data-moment-ribbon>${PIPELINE_RIBBON}</p>` : ''}`
    + groups.map(group => section(group.key, groupTitle(group), group.sameMoment ? GROUP_NOTE : '', bestFirst(group.photos))).join('')
    + (untimed.length ? section('untimed', UNTIMED_TITLE, UNTIMED_NOTE, untimed) : '')
    + `</div>${more}`;
}
