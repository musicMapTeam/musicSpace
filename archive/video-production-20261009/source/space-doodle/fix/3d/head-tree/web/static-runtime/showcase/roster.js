// The fictional cast and their photos. Everything here is invented: the show, the venue, the people, the times. Names carry 「·示例」 so no
// screen can mistake them for real attendees. All times are 2026-09-26 on the Asia/Shanghai clock (venueTime); three photos fall inside one
// 3-minute window, so the wall already shows a 「同一刻」 group before the visitor has done anything.
//
// What the scene needs from this cast (tests/static-showcase-seed.test.js holds each of these):
//  - FOUR photos exist before the visitor arrives: the 3D wall shows the first six member photos oldest first, so the visitor's own
//    photos land inside it. 林间 therefore has no photo of her own (her job is the quiet rule) and joins later.
//  - THREE people exist before the visitor: portrait phones draw the first four people, so the visitor is one of them.
//  - The sample photo times (EXIF 21:47:50 / 21:48:10, in demo-assets) pair by the real rules in web/js/moment.js: sample-stage with
//    小满's crowd photo, sample-crowd with 阿遥's stage photo.
//
// SHOWCASE_VERSION is derived from what is written below (and SEED_REV), never typed: a browser that holds an older world sees another
// version, throws away its disposable data and lays the new one out (seed.js, boot policy). SEED_REV is the lever for changes this file
// cannot show: bump it when seed.js builds something different (cup, game, order of the steps) or a cast photo in demo-assets is re-cut
// (scripts/demo/README.md). tests/static-showcase-seed.test.js fails when the seeded world changes under an unchanged SEED_REV.
import { createHash } from 'node:crypto';              // the browser build aliases this to web/static-runtime/shims/node-crypto.js
import { venueTime } from '../../js/moment.js';
import { TEMPLATES } from '../../avatar/model.js';

export const EVENT_DATE = '2026.09.26';                // moment.js `event.date`: times on this day print as 21:47
export const SEED_REV = 1;
/** How each seeded group-chat line ends (npc-lines.js closes a private thread with the same words), so nobody can take the cast for people. */
export const DISCLOSURE = '（示例角色的自动回复：我不是真人。）';

const at = (hour, minute, second = 0) => venueTime(2026, 9, 26, hour, minute, second);
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
// Valid v2 avatars (the avatar worker validates them): a look from web/avatar/model.js TEMPLATES, with this person's own skin, face and pose.
const look = (template, own) => ({ ...TEMPLATES[template].avatar, ...own });

export const ROOM = freeze({ title: '回声现场 · 示例场', venue: '月台 Livehouse（虚构场地）', songId: 'late-train' });

/**
 * key         short id (Idempotency-Key part, `people` key in seed.js)       host   creates the room
 * participation  'open' (can be greeted) | 'quiet' (cannot)                  joins  'seed' (there when the page opens) | 'after-visitor'
 * photos      uploaded as this person, in order, with the facts they "typed" (time and side are theirs, never the model's)
 * line        what they said in the room's group chat before anyone arrived
 */
export const NPCS = freeze([
  { key: 'yao', name: '阿遥·示例', host: true, participation: 'open', joins: 'seed',
    avatar: look(3, { skin: 2, expression: 'smile', accessory: 'none' }),
    photos: [{ file: 'yao-stage.jpg', viewpoint: 'stage', takenAt: at(21, 47, 20) }],
    line: `大家好，今晚我把舞台这一面放上了照片墙。${DISCLOSURE}` },
  { key: 'man', name: '小满·示例', participation: 'open', joins: 'seed',
    avatar: look(2, { skin: 1, expression: 'wink', accessory: 'headphones', pose: 'sing' }),
    photos: [
      { file: 'man-crowd.jpg', viewpoint: 'crowd', takenAt: at(21, 48, 5) },
      { file: 'man-near.jpg', viewpoint: 'friends', takenAt: at(22, 21, 10) },
    ],
    line: `我拍的是人海这一面，手都举起来了。${DISCLOSURE}` },
  { key: 'bei', name: '北屿·示例', participation: 'open', joins: 'seed',
    avatar: look(1, { skin: 3, expression: 'focused', accessory: 'cap' }),
    photos: [{ file: 'bei-balcony.jpg', viewpoint: 'detail', takenAt: at(21, 49, 30) }],
    line: `我只拍了看台边的一盏灯，算细节。${DISCLOSURE}` },
  // arrives a few seconds after the visitor and chooses to take part quietly: the one person who cannot be greeted
  { key: 'lin', name: '林间·示例', participation: 'quiet', joins: 'after-visitor',
    avatar: look(5, { skin: 0, expression: 'neutral', accessory: 'none', pose: 'listen' }),
    photos: [] },
]);

/** The two photos a visitor can put on the wall with one tap; the capture time is written inside each file (demo-assets, EXIF). */
export const SAMPLE_PHOTOS = freeze([
  { id: 'sample-crowd', file: 'sample-crowd.jpg', label: '人海 · 示例照片', note: '虚构的拍摄时间 21:48，写在文件里' },
  { id: 'sample-stage', file: 'sample-stage.jpg', label: '舞台 · 示例照片', note: '虚构的拍摄时间 21:47，写在文件里' },
]);

/** Keys sorted, no whitespace: the same data always gives the same text. */
export function canonicalJSON(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).filter(key => value[key] !== undefined).sort().map(key => `${JSON.stringify(key)}:${canonicalJSON(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** 'r' plus the first 10 hex digits of the sha256 of the canonical JSON of the roster and SEED_REV. */
export const showcaseVersion = ({ ROOM, NPCS, SAMPLE_PHOTOS, SEED_REV }) =>
  `r${createHash('sha256').update(canonicalJSON({ ROOM, NPCS, SAMPLE_PHOTOS, SEED_REV })).digest('hex').slice(0, 10)}`;

export const SHOWCASE_VERSION = showcaseVersion({ ROOM, NPCS, SAMPLE_PHOTOS, SEED_REV });
