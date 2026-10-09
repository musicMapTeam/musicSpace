#!/usr/bin/env python3
"""Local assets of act A0-A1 v3 (2026-10-08): crops of the rc.2 re-captures (review art #11: the hook's 3D room and 3D wall polaroids
show the 3D canvas only, no page header / nav / footer).  Writes prod/assets/v3/A0-A1/*.png + provenance.json.
  PY -I make-assets.py
"""
import hashlib, json, os
from PIL import Image
CAP = '/tmp/space-video-doodle/prod/capture/P2P3-rc2/stills/'
OUT = '/tmp/space-video-doodle/prod/assets/v3/A0-A1/'
os.makedirs(OUT, exist_ok=True)
# name: (source, crop box in source px (x0, y0, x1, y1), why)
CROPS = {
    'CUT-01-room-stage.png': ('CUT-01_room-overview-4k.png', (600, 470, 2600, 1539),
        'H1 1:1 polaroid (photo window 636x340, aspect 1.87): the 3D stage with the five present and their tags (阿遥/小满/北屿 · 可招呼, 阿宁 · 我, 林间 · 安静), 照片墙 pill'),
    'CUT-03-wall.png': ('CUT-03_3d-wall-5-photos-4k.png', (1400, 440, 2420, 1040),
        'H1 2:1 polaroid (photo window 426x250, aspect 1.70): the 3D photo wall close, its sign 「同一晚，另一面。」 over the top row of photos (the stage, the crowd, a close-up); page chrome and the wall bar cropped out'),
}
sha = lambda p: hashlib.sha256(open(p, 'rb').read()).hexdigest()
prov = {'made': '2026-10-08', 'by': 'act A0-A1 v3 (review/act-A0-A1-v3/tools/make-assets.py)', 'build': '0.22.0-rc.2 (/tmp/space-final/dist-pages), capture pass P2P3-rc2', 'files': {}}
for name, (src, box, why) in CROPS.items():
    im = Image.open(CAP + src).convert('RGB'); c = im.crop(box); c.save(OUT + name, optimize=True)
    prov['files'][name] = {'source': 'capture/P2P3-rc2/stills/' + src, 'source_sha256': sha(CAP + src), 'crop_xyxy': list(box), 'size': list(c.size), 'sha256': sha(OUT + name), 'why': why}
    print(name, c.size, os.path.getsize(OUT + name))
json.dump(prov, open(OUT + 'provenance.json', 'w'), ensure_ascii=False, indent=1)
