"""One decode pass of the film at 640x360: save one frame per beat (at beat + 0.35 beat) and per-frame metrics
(paper fraction, marker colour fractions, ink fraction) to metrics.json.  Usage: python scan.py video outdir"""
import sys, subprocess, json, os
import numpy as np
from PIL import Image
video, out = sys.argv[1], sys.argv[2]
W, H, FPS = 640, 360, 60
BEAT = 60/123.0
os.makedirs(out + '/beats', exist_ok=True)
cmd = ['ffmpeg', '-v', 'error', '-i', video, '-vf', f'scale={W}:{H}:flags=area', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']
p = subprocess.Popen(cmd, stdout=subprocess.PIPE)
fsz = W*H*3
paper = np.array([0xf7, 0xef, 0xdf], float)
pink = np.array([0xff, 0x5c, 0x8a], float); mint = np.array([0x5f, 0xdc, 0xc0], float); yellow = np.array([0xff, 0xd4, 0x47], float)
ink = np.array([0x1c, 0x1b, 0x1a], float)
# targets: frame index nearest to (k + 0.35) * BEAT
targets = {}
k = 0
while (k + 0.35) * BEAT < 174.7:
    targets[int(round((k + 0.35) * BEAT * FPS))] = k
    k += 1
metrics = []
n = 0
prev = None
while True:
    buf = p.stdout.read(fsz)
    if len(buf) < fsz: break
    a = np.frombuffer(buf, np.uint8).reshape(H, W, 3)
    if n % 3 == 0 or n in targets:
        f = a.astype(float)
        def frac(c, tol):
            return float((np.abs(f - c).max(axis=2) < tol).mean())
        m = {'f': n, 't': round(n / FPS, 4), 'paper': round(frac(paper, 22), 4), 'pink': round(frac(pink, 40), 4),
             'mint': round(frac(mint, 40), 4), 'yellow': round(frac(yellow, 40), 4), 'ink': round(frac(ink, 40), 4),
             'lum': round(float(f.mean()), 2)}
        if prev is not None:
            m['diff'] = round(float(np.abs(f - prev).mean()), 3)
        prev = f
        metrics.append(m)
    if n in targets:
        k = targets[n]
        bar = k // 4 + 1; beat = k % 4 + 1
        Image.fromarray(a).save(f'{out}/beats/b{k:03d}_{bar:02d}-{beat}.png')
    n += 1
p.wait()
json.dump({'W': W, 'H': H, 'n': n, 'metrics': metrics}, open(out + '/metrics.json', 'w'))
print('frames', n, 'saved', len(targets))
