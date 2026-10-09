import { venueTime } from './moment.js';

export const SPACE_EVENT = {
  id: 'echo-live-2026',
  title: '回声现场',
  subtitle: '夏末特别场',
  date: '2026.09.26',
  city: '广州',
  song: '把晚风借给你',
  // A card's "带上这首歌" flag. The room server stores exactly this value ('' means no song), so it stays.
  trackId: 'co-0',
};

export const SPACE_ACTORS = {
  a: { id: 'a', name: 'Lin', initial: 'L', perspective: '舞台这一面', color: 'mint' },
  b: { id: 'b', name: '阿遥', initial: '遥', perspective: '人海这一面', color: 'coral' },
};

export const SPACE_MOMENTS = [
  { id: 'encore', name: '返场', phrase: '最后一首，还想再听一次。' },
  { id: 'chorus', name: '全场合唱', phrase: '这一句，我们一起唱了。' },
  { id: 'lights', name: '灯光亮起', phrase: '灯光亮起的瞬间，我记住了。' },
];

// The example photos are AI-generated and fictional, and so are their capture times: one minute apart on the event night
// (Asia/Shanghai), so the demo shows a 「同一刻」 pair at once. A visitor's own photo brings its own time (or none) instead.
export const SPACE_PHOTOS = {
  stage: {
    id: 'stage',
    name: '我的舞台',
    description: '舞台视角 · 示例图片',
    url: new URL('../assets/stage-scene.webp', import.meta.url).href,
    viewpoint: 'stage',
    takenAt: venueTime(2026, 9, 26, 21, 47),
  },
  crowd: {
    id: 'crowd',
    name: '你的人海',
    description: '人海视角 · 示例图片',
    url: new URL('../assets/crowd-scene.webp', import.meta.url).href,
    viewpoint: 'crowd',
    takenAt: venueTime(2026, 9, 26, 21, 48),
  },
};

export function seedSpaceCard(owner = 'b') {
  const key = owner === 'a' ? 'stage' : 'crowd';
  return {
    id: `live-card-${owner}`,
    revision: 1,
    owner,
    eventId: SPACE_EVENT.id,
    photoKey: key,
    photoDataUrl: '',
    perspective: SPACE_PHOTOS[key].viewpoint,
    takenAt: SPACE_PHOTOS[key].takenAt,
    takenSource: 'sample',
    song: '',
    momentId: 'encore',
    trackId: SPACE_EVENT.trackId,
    caption: owner === 'a' ? '灯光暗下去，还舍不得说再见。' : '你在看舞台，我拍下了和你一起唱歌的人海。',
    isPublic: owner === 'b',
    createdAt: '2026-09-26T15:30:00.000Z',
    updatedAt: '2026-09-26T15:30:00.000Z',
  };
}
