"""Count frames whose bottom rows are a flat fill (the cut-off band): PY bandcheck.py <mp4> [step=30]"""
import sys, subprocess, numpy as np
mp4 = sys.argv[1]; step = int(sys.argv[2]) if len(sys.argv) > 2 else 30
p = subprocess.run(['ffmpeg', '-v', 'error', '-i', mp4, '-vf', f'select=not(mod(n\\,{step})),crop=1920:120:0:960', '-fps_mode', 'passthrough', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True)
a = np.frombuffer(p.stdout, dtype=np.uint8).reshape(-1, 120, 1920, 3).astype(float)
bad = []
for i, f in enumerate(a):
    s = f.std(axis=1).max(axis=1)          # per row: max over channels of the std along x
    flat = [960 + y for y in range(120) if s[y] < 0.6]
    if flat and flat[-1] == 1079:
        y0 = 1079
        while y0 - 1 in flat: y0 -= 1
        bad.append((i * step, y0))
print(mp4.split('/')[-1], f'{len(a)} frames sampled, {len(bad)} with a flat band at the bottom', ('first: ' + ', '.join(f'f{n}:y>={y}' for n, y in bad[:6])) if bad else '')
