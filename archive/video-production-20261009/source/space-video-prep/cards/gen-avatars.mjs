// Pre-render the product's own layered 2D avatars (web/illustrated-avatar) to standalone SVG files for the title cards.
import { renderAvatarSvg, ILLUSTRATED_PRESETS } from '/tmp/space-video-prep/repo-rc4/web/illustrated-avatar/index.js';
import { TEMPLATES, DEFAULT_AVATAR, safeAvatar } from '/tmp/space-video-prep/repo-rc4/web/avatar/model.js';
import fs from 'node:fs';
const out = '/tmp/space-video-prep/cards/assets/';
const looks = TEMPLATES.map((t, i) => ({ id: t.english.toLowerCase(), name: t.name, avatar: t.avatar }));
// extra hand-made looks for variety (same stable-identity components)
looks.push({ id: 'cap', name: '鸭舌帽', avatar: safeAvatar({ ...DEFAULT_AVATAR, hair: 7, hairColor: 1, top: 3, topColor: 5, bottom: 2, bottomColor: 1, shoes: 1, eyewear: 4, accessory: 'cap', expression: 'smile', pose: 'wave' }) });
looks.push({ id: 'phones', name: '大耳机', avatar: safeAvatar({ ...DEFAULT_AVATAR, hair: 3, hairColor: 2, top: 4, topColor: 3, bottom: 4, bottomColor: 0, shoes: 3, eyewear: 1, accessory: 'headphones', expression: 'wink', pose: 'sway' }) });
const views = ['front', 'quarter', 'side', 'back'];
const index = [];
for (const l of looks) for (const v of views) {
  const svg = renderAvatarSvg(l.avatar, { view: v, shadow: false, label: l.name });
  const f = `${out}avatar-${l.id}-${v}.svg`;
  fs.writeFileSync(f, svg);
  index.push({ id: l.id, name: l.name, view: v, file: f, bytes: svg.length });
}
fs.writeFileSync(out + 'avatars.json', JSON.stringify(looks.map(l => ({ id: l.id, name: l.name, avatar: l.avatar })), null, 1));
console.log(index.length, 'svgs;', looks.map(l => l.id).join(','));
