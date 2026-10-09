# Prepares every asset the doodle-motion scenes read (idempotent).  Run with the venv that has numpy + PIL:
#   /tmp/space-video-doodle/music-cc0/tools/venv-ana/bin/python tools/prep_assets.py
# Sources: product screenshots / clips captured from our own dist-pages build (script/probe, capture-test), the repo's two AI
# concert images (web/assets, provenance in image-provenance.json).  Textures are generated here (numpy noise), nothing downloaded.
import os, subprocess, numpy as np
from PIL import Image, ImageFilter
ROOT = '/tmp/space-video-doodle/animatic'; A = f'{ROOT}/assets'; SH = '/tmp/space-video-doodle/script/probe/shots'
FF = '/opt/homebrew/bin/ffmpeg'
os.makedirs(f'{A}/tex', exist_ok=True); os.makedirs(f'{A}/cut', exist_ok=True)
rng = np.random.default_rng(20261009)

# 1) paper grain: tileable fibre noise, multiplied over the paper at low strength; re-positioned at 12 fps (boil)
N = 512
def tile_noise(scale):
    f = rng.standard_normal((N, N)); F = np.fft.fft2(f)
    ky = np.fft.fftfreq(N)[:, None]; kx = np.fft.fftfreq(N)[None, :]; k = np.sqrt(kx**2 + ky**2) + 1e-6
    return np.real(np.fft.ifft2(F * np.exp(-(k * scale) ** 2) / (k ** 0.35)))
n1 = tile_noise(6); n1 = (n1 - n1.mean()) / n1.std()
fib = np.zeros((N, N))
for _ in range(900):   # short fibres at ~17 deg, the product's hairline direction
    x, y = rng.uniform(0, N, 2); L = rng.uniform(6, 26); a = np.deg2rad(17 + rng.normal(0, 25))
    for s in np.linspace(0, L, int(L * 2)):
        fib[int(y + s * np.sin(a)) % N, int(x + s * np.cos(a)) % N] += rng.uniform(0.4, 1.0)
fib = np.array(Image.fromarray((np.clip(fib, 0, 1.5) / 1.5 * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))) / 255.0
v = np.clip(0.5 + 0.10 * n1 - 0.55 * fib, 0, 1)            # 0.5 = neutral (multiply against white = darken slightly)
g = (255 * (1 - (0.5 - v).clip(0, None) * 0.55 - 0.012)).clip(0, 255)
img = np.dstack([g, g * 0.985, g * 0.96, np.full_like(g, 255)]).astype(np.uint8)
Image.fromarray(img, 'RGBA').save(f'{A}/tex/grain.png')
# 2) rubber-stamp ink texture (alpha mask with speckles and uneven pressure)
w, hgt = 400, 200
m = tile_noise(3)[:hgt, :w]; m = (m - m.mean()) / m.std(); sp = rng.random((hgt, w))
alpha = np.clip(1.0 - 0.18 * (m < -1.2) - 0.75 * (sp < 0.035) - 0.25 * (sp < 0.12) * (m < 0), 0, 1)
Image.fromarray((np.dstack([np.full((hgt, w), 255)] * 3 + [alpha * 255])).astype(np.uint8), 'RGBA').save(f'{A}/tex/stamp.png')

# 3) real-UI cut-outs for the cold-open collage (crops of phone 1080x2340 / desktop 3840x2160 captures)
os.makedirs(f'{A}/src', exist_ok=True)
if not os.path.exists(f'{A}/src/b-end.png'):   # the wall with the 同一刻的另一面 badge: last part of capture-test clip B
    subprocess.run([FF, '-v', 'error', '-y', '-ss', '7.3', '-i', '/tmp/space-video-doodle/capture-test/clips/B-phone-upload-ai-wall.mp4', '-frames:v', '1', f'{A}/src/b-end.png'], check=True)
CUTS = {
  'room':   (f'{SH}/c-desktop-overview-clean-4k.png', (330, 420, 2560, 1620)),     # 3D livehouse, the five on stage
  'wall':   (f'{SH}/p41-photos-view.png', (200, 380, 860, 1560)),                  # 3D photo wall, sign 同一晚，另一面。
  'ai':     (f'{SH}/p08-upload-ai.png', (70, 1080, 1010, 1690)),                   # 我拍的这一面 + AI 判断：人海
  'badge':  (f'{A}/src/b-end.png', (60, 1150, 1010, 1770)),   # 同一刻的另一面 badge card
  'accept': (f'{SH}/p13-exchange-accepted.png', (40, 290, 1050, 1340)),            # 交换已接受 + the two polaroids
  'chat':   (f'{SH}/p17-chat-reply.png', (30, 340, 1050, 1350)),                   # private chat bubbles
  'card':   (f'{SH}/memory-card-export.png', (0, 0, 1080, 1440)),                  # memory card PNG export
  'first':  (f'{SH}/p01-landing.png', (0, 380, 1080, 1760)),                       # first screen: 3D stage + 同一刻，另一面。
}
for k, (src, box) in CUTS.items():
    im = Image.open(src).convert('RGB').crop(box)
    if im.width > 1400: im = im.resize((1400, round(im.height * 1400 / im.width)), Image.LANCZOS)
    im.save(f'{A}/cut/{k}.jpg', quality=93); print('cut', k, im.size)

# 4) footage frame sequences (JPEG, full resolution) from the capture-test clips
def frames(clip, out, q=3):
    os.makedirs(out, exist_ok=True)
    if len(os.listdir(out)) > 10: return
    subprocess.run([FF, '-v', 'error', '-y', '-i', clip, '-q:v', str(q), '-start_number', '0', f'{out}/f%05d.jpg'], check=True)
frames('/tmp/space-video-doodle/capture-test/clips/A-phone-venue.mp4', f'{A}/clipA')
frames('/tmp/space-video-doodle/capture-test/clips/B-phone-upload-ai-wall.mp4', f'{A}/clipB')
frames('/tmp/space-video-doodle/capture-test/clips/C-desktop-exchange.mp4', f'{A}/clipC')
frames('/tmp/space-video-doodle/animatic/capture/D-desktop-room-2880.mp4', f'{A}/clipD', q=2)   # recorded by capture/clip-d-room.mjs
for d in ['clipA', 'clipB', 'clipC', 'clipD']: print(d, len(os.listdir(f'{A}/{d}')), 'frames')
