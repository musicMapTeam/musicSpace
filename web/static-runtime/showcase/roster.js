// The seeded show of the online edition: the room, its people and their photos. The show, the venue, the people and the times are made up
// for this site; the About panel says so in the product's one disclosure sentence, so nothing here carries a label (no suffix on the names,
// no note on the photos), and no line a character says claims to be a person. All times are 2026-09-26 on the Asia/Shanghai clock (venueTime);
// three photos fall inside one 3-minute window, so the wall already shows a 「同一刻」 group before the visitor has done anything.
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
// 3: complete-product copy — names, room, venue, lines, sample labels. 2: man-near.jpg re-encoded with a levels lift (scripts/demo/README.md).
export const SEED_REV = 3;

const at = (hour, minute, second = 0) => venueTime(2026, 9, 26, hour, minute, second);
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
// Valid v2 avatars (the avatar worker validates them): a look from web/avatar/model.js TEMPLATES, with this person's own skin, face and pose.
const look = (template, own) => ({ ...TEMPLATES[template].avatar, ...own });

/**
 * The show's room. `community` is the venue's fan community, which the host (阿遥, 「月台的阿遥」) links the room to before anyone arrives:
 * the next show is already posted there, so 「这家 Livehouse 的乐迷社群」 in the room's chat leads somewhere (seed.js openCommunity).
 */
export const ROOM = freeze({
  title: '回声现场', venue: '月台 Livehouse', songId: 'late-train',
  community: {
    title: '月台 Livehouse 乐迷社群',
    description: '散场后，乐迷留在这里；下一场的预告也发在这里。',
    next: { title: '回声现场 Vol.2', venue: '月台 Livehouse', startsAt: null, note: '时间定了就在这里说。' },
  },
});

/**
 * key         short id (Idempotency-Key part, `people` key in seed.js)       host   creates the room
 * participation  'open' (can be greeted) | 'quiet' (cannot)                  joins  'seed' (there when the page opens) | 'after-visitor'
 * photos      uploaded as this person, in order, with the facts they "typed" (time and side are theirs, never the model's)
 * line        what they said in the room's group chat before anyone arrived
 */
export const NPCS = freeze([
  { key: 'yao', name: '阿遥', host: true, participation: 'open', joins: 'seed',
    avatar: look(3, { skin: 2, expression: 'smile', accessory: 'none' }),
    photos: [{ file: 'yao-stage.jpg', viewpoint: 'stage', takenAt: at(21, 47, 20) }],
    line: '大家好，我是月台的阿遥。今晚舞台这一面，我先放上照片墙啦。' },
  { key: 'man', name: '小满', participation: 'open', joins: 'seed',
    avatar: look(2, { skin: 1, expression: 'wink', accessory: 'headphones', pose: 'sing' }),
    photos: [
      { file: 'man-crowd.jpg', viewpoint: 'crowd', takenAt: at(21, 48, 5) },
      { file: 'man-near.jpg', viewpoint: 'friends', takenAt: at(22, 21, 10) },
    ],
    line: '我拍的是人海这一面，手都举起来了。' },
  { key: 'bei', name: '北屿', participation: 'open', joins: 'seed',
    avatar: look(1, { skin: 3, expression: 'focused', accessory: 'cap' }),
    photos: [{ file: 'bei-balcony.jpg', viewpoint: 'detail', takenAt: at(21, 49, 30) }],
    line: '我只拍了看台边的一盏灯，算细节。' },
  // arrives a few seconds after the visitor and chooses to take part quietly: the one person who cannot be greeted
  { key: 'lin', name: '林间', participation: 'quiet', joins: 'after-visitor',
    avatar: look(5, { skin: 0, expression: 'neutral', accessory: 'none', pose: 'listen' }),
    photos: [] },
]);

/**
 * The two photos a visitor can put on the wall with one tap. The capture time is written inside each file (demo-assets, EXIF: 21:48:10 and
 * 21:47:50), so the upload form reads it like any photo's (「拍摄于 21:48 · 来自照片自带的信息」).
 */
export const SAMPLE_PHOTOS = freeze([
  { id: 'sample-crowd', file: 'sample-crowd.jpg', label: '人海那张' },
  { id: 'sample-stage', file: 'sample-stage.jpg', label: '舞台那张' },
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
